"""Project-scoped file operations; importing this module never starts a process."""
import base64
from contextlib import contextmanager
import difflib
import hashlib
import errno
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import subprocess
import sys
import tempfile
import threading
import uuid
import zipfile
import time
import atexit

MAX_TRANSFER = 20 * 1024 * 1024
WORKSPACE_UPLOAD_CHUNK = 1024 * 1024
MAX_PREVIEW = 512 * 1024
IMAGES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp'}


def _windows_reparse_point(path):
    # Keep this payload self-contained for SSH. Python 3.9-3.11 have no
    # Path.is_junction(), but lstat exposes Windows reparse attributes.
    if os.name != 'nt':
        return False
    try:
        return bool(path.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    except FileNotFoundError:
        return False  # An upload may be creating a new ordinary file.


def download_range(size, etag, range_header='', if_range=''):
    """Only one byte range is supported; unsupported syntax is ignored."""
    result = {'status': 200, 'offset': 0, 'length': size, 'size': size, 'etag': etag}
    # We do not advertise Last-Modified: only an exact strong validator resumes.
    if if_range and if_range != etag:
        return result
    match = re.fullmatch(r'bytes=(\d*)-(\d*)', range_header)
    if not match or not any(match.groups()):
        return result
    first, last = match.groups()
    # Limit integer parsing independently of the host Python version.
    if len(first) > 20 or len(last) > 20:
        return {**result, 'status': 416, 'length': 0, 'contentRange': 'bytes */' + str(size)}
    if first:
        start = int(first)
        end = min(int(last), size - 1) if last else size - 1
    else:
        start, end = max(0, size - int(last)), size - 1
    if start >= size or end < start:
        return {**result, 'status': 416, 'length': 0, 'contentRange': 'bytes */' + str(size)}
    return {**result, 'status': 206, 'offset': start, 'length': end - start + 1,
            'contentRange': 'bytes %d-%d/%d' % (start, end, size)}


# At most two large-file/directory snapshots; private temporary handles, never public paths.
# Keep an immutable ZIP across Range requests rather than repacking every chunk.
_ARCHIVES = {}
_ARCHIVE_LOCK = threading.RLock()


def _expire_archives(all_entries=False):
    with _ARCHIVE_LOCK:
        for key, entry in list(_ARCHIVES.items()):
            if all_entries or time.monotonic() - entry['used'] > 1800:
                with entry['lock']:
                    entry['context'].__exit__(None, None, None)
                del _ARCHIVES[key]
        if _ARCHIVES and not all_entries:
            timer = threading.Timer(1800, _expire_archives); timer.daemon = True; timer.start()


atexit.register(_expire_archives, True)


class _RangeReader:
    def __init__(self, stream, remaining):
        self.stream, self.remaining = stream, remaining

    def read(self, size=-1):
        value = self.stream.read(self.remaining if size < 0 else min(size, self.remaining))
        self.remaining -= len(value)
        return value


@contextmanager
def _cached_transfer(key, create, range_header, if_range):
    with _ARCHIVE_LOCK:
        entry = _ARCHIVES.get(key)
        if not if_range or entry is None:
            first = not _ARCHIVES
            context = create()
            metadata, stream = context.__enter__()
            entry = {'context': context, 'metadata': metadata, 'stream': stream,
                     'used': time.monotonic(), 'lock': threading.RLock()}
            old = _ARCHIVES.pop(key, None)
            if old:
                with old['lock']: old['context'].__exit__(None, None, None)
            while len(_ARCHIVES) >= 2:
                oldest = min(_ARCHIVES, key=lambda k: _ARCHIVES[k]['used'])
                old = _ARCHIVES.pop(oldest)
                with old['lock']: old['context'].__exit__(None, None, None)
            _ARCHIVES[key] = entry
            if first:
                timer = threading.Timer(1800, _expire_archives); timer.daemon = True; timer.start()
        entry['used'] = time.monotonic()
        entry['lock'].acquire()
    try:
        metadata = entry['metadata']
        result = {**download_range(metadata['size'], metadata['etag'], range_header, if_range), 'name': metadata['name']}
        entry['stream'].seek(result['offset'])
        yield result, _RangeReader(entry['stream'], result['length'])
    finally:
        entry['lock'].release()


def display_absolute_path(path):
    """Presentation only; filesystem access keeps the validated native path."""
    if path[:8].lower() == '\\\\?\\unc\\':
        return '\\\\' + path[8:]
    if path.startswith('\\\\?\\') and re.match(r'^[A-Za-z]:\\', path[4:]):
        return path[4:]
    return path


def _has_git_component(parts):
    """Reject .git segments regardless of filesystem case sensitivity."""
    return any(part.rstrip(' .').casefold() == '.git' for part in parts)


class Workspace:
    def __init__(self, root, *, directory_fd=None):
        if not root or not Path(root).is_absolute():
            raise ValueError('이 채팅은 프로젝트 디렉터리와 연결되지 않았습니다.')
        self.root = Path(root).resolve(strict=True)
        if not self.root.is_dir():
            raise ValueError('프로젝트 디렉터리를 사용할 수 없습니다.')
        self.directory_fd = directory_fd
        if directory_fd is not None and not os.path.samestat(os.fstat(directory_fd), self.root.stat()):
            raise PermissionError('프로젝트 디렉터리가 변경되었습니다. 다시 선택하세요.')

    @staticmethod
    def parts(path):
        if not isinstance(path, str) or len(path) > 4096 or any(ord(c) < 32 for c in path) or '\\' in path or ':' in path:
            raise ValueError('잘못된 파일 경로')
        parts = path.split('/') if path else []
        if any(p in ('', '.', '..') or p.lower().startswith('.bridge-upload-') for p in parts):
            raise PermissionError('현재 프로젝트 내의 파일에만 접근 가능')
        return parts

    @contextmanager
    def directory(self, parts):
        # On POSIX, walk using directory handles so a renamed/replaced symlink
        # cannot redirect an in-flight read or upload outside the project.
        if os.open in os.supports_dir_fd and hasattr(os, 'O_NOFOLLOW'):
            fd = os.dup(self.directory_fd) if self.directory_fd is not None else os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                for part in parts:
                    nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                    os.close(fd); fd = nxt
                yield self.root.joinpath(*parts), fd
            finally:
                os.close(fd)
        else:
            path = self.root
            for part in parts:
                path = path / part
                if path.is_symlink() or getattr(path, 'is_junction', lambda: False)() or _windows_reparse_point(path):
                    raise PermissionError('심볼릭 링크를 통한 파일 액세스는 현재 지원되지 않습니다.')
                if not path.exists():
                    raise FileNotFoundError('디렉토리가 존재하지 않습니다')
                if not path.is_dir():
                    raise NotADirectoryError('경로가 디렉터리가 아닙니다.')
            yield path, None

    @staticmethod
    def open_file(directory, fd, name, flags, mode=0o600):
        if fd is not None:
            return os.open(name, flags | os.O_NOFOLLOW | os.O_NONBLOCK, mode, dir_fd=fd)
        path = directory / name
        if path.is_symlink() or _windows_reparse_point(path):
            raise PermissionError('심볼릭 링크를 통한 파일 액세스는 현재 지원되지 않습니다.')
        return os.open(path, flags | getattr(os, 'O_BINARY', 0), mode)

    def listing(self, path='', hidden=False, search='', offset=0):
        parts = self.parts(path)
        if not isinstance(search, str) or len(search) > 200 or not isinstance(offset, int) or offset < 0:
            raise ValueError('디렉터리 쿼리가 잘못되었습니다.')
        rows = []
        with self.directory(parts) as (directory, fd):
            with os.scandir(fd if fd is not None else directory) as entries:
                for entry in entries:
                    if entry.name.startswith('.bridge-upload-') or (not hidden and entry.name.startswith('.')) or search.casefold() not in entry.name.casefold():
                        continue
                    try:
                        info = entry.stat(follow_symlinks=False)
                        kind = 'directory' if stat.S_ISDIR(info.st_mode) else 'file' if stat.S_ISREG(info.st_mode) else 'blocked'
                        if (getattr(entry, 'is_junction', lambda: False)() or
                                os.name == 'nt' and info.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT):
                            kind = 'blocked'
                        rows.append({'name': entry.name, 'path': '/'.join(parts + [entry.name]), 'kind': kind,
                                     'size': info.st_size if kind == 'file' else None, 'modified': info.st_mtime})
                    except OSError:
                        continue
        rows.sort(key=lambda item: (item['kind'] != 'directory', item['name'].casefold(), item['name']))
        return {'project': self.root.name, 'path': path, 'entries': rows[offset:offset + 200],
                'total': len(rows), 'nextOffset': offset + 200 if len(rows) > offset + 200 else None}

    def info(self, path):
        parts = self.parts(path)
        if not parts: raise ValueError('파일을 선택해주세요')
        with self.directory(parts[:-1]) as (directory, fd):
            info = os.stat(parts[-1], dir_fd=fd, follow_symlinks=False) if fd is not None else (directory / parts[-1]).lstat()
            if stat.S_ISDIR(info.st_mode):
                # Re-walk the full directory using the same no-link boundary.
                with self.directory(parts):
                    return {'name': parts[-1], 'path': path, 'size': None, 'kind': 'directory',
                            'absolutePath': display_absolute_path(str(self.root.joinpath(*parts)))}
            handle = self.open_file(directory, fd, parts[-1], os.O_RDONLY)
            with os.fdopen(handle, 'rb') as stream:
                info = os.fstat(stream.fileno())
                if not stat.S_ISREG(info.st_mode): raise ValueError('일반 파일만 지원')
                return {'name': parts[-1], 'path': path, 'size': info.st_size, 'kind': 'file',
                        'absolutePath': display_absolute_path(str(self.root.joinpath(*parts)))}

    def references(self, references):
        """Resolve metadata only, against this session's current project boundary."""
        if not isinstance(references, list) or len(references) > 10:
            raise ValueError("메시지당 최대 10개의 파일 첨부")
        result, seen = [], set()
        for reference in references:
            if not isinstance(reference, dict) or set(reference) != {'path', 'absolutePath'}:
                raise ValueError('프로젝트 파일 참조가 잘못되었습니다. 다시 선택하세요.')
            info = self.info(reference['path'])
            if info['absolutePath'] != reference['absolutePath']:
                raise ValueError('프로젝트 디렉터리가 변경되었습니다. 참조 파일을 다시 선택하세요.')
            if info['absolutePath'] in seen:
                raise ValueError('동일한 파일이나 디렉터리를 반복적으로 참조할 수 없습니다.')
            seen.add(info['absolutePath'])
            result.append({'name': info['name'], 'path': info['absolutePath'],
                           'kind': info['kind'], 'size': info['size'], 'image': None})
        return result

    @contextmanager
    def archive(self, path, range_header='', if_range='', limit=None):
        parts = self.parts(path)
        with self.directory(parts): pass
        with _cached_transfer(('directory', str(self.root), path), lambda: self._archive_snapshot(path), range_header, if_range) as value:
            yield value

    @contextmanager
    def _archive_snapshot(self, path):
        """Snapshot ZIP64 members on disk, without following links."""
        parts = self.parts(path)
        if not parts: raise ValueError('폴더를 선택해주세요')
        with tempfile.TemporaryFile(prefix='bridge-archive-') as snapshot:
            with zipfile.ZipFile(snapshot, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
                def walk(current, archive_path):
                    with self.directory(current) as (directory, fd):
                        archive.writestr(archive_path + '/', b'')
                        with os.scandir(fd if fd is not None else directory) as entries:
                            names = sorted(entry.name for entry in entries)
                        for name in names:
                            if name.startswith('.bridge-upload-'): continue
                            self.parts('/'.join(current + [name]))
                            target = directory / name
                            info = os.stat(name, dir_fd=fd, follow_symlinks=False) if fd is not None else target.lstat()
                            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400) or getattr(target, 'is_junction', lambda: False)():
                                raise PermissionError('폴더에 링크나 특수 파일이 포함되어 있어 다운로드할 수 없습니다.')
                            if stat.S_ISDIR(info.st_mode):
                                walk(current + [name], archive_path + '/' + name)
                            elif stat.S_ISREG(info.st_mode):
                                handle = self.open_file(directory, fd, name, os.O_RDONLY)
                                with os.fdopen(handle, 'rb') as source:
                                    before = os.fstat(source.fileno())
                                    if not stat.S_ISREG(before.st_mode): raise PermissionError('파일 형식이 변경되었습니다.')
                                    with archive.open(archive_path + '/' + name, 'w', force_zip64=True) as destination:
                                        while True:
                                            chunk = source.read(65536)
                                            if not chunk: break
                                            destination.write(chunk)
                                    after = os.fstat(source.fileno())
                                    if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                                        raise ValueError("소스 파일이 변경되었습니다. 다운로드를 다시 시작하세요.")
                            else: raise PermissionError('폴더에 링크나 특수 파일이 포함되어 있어 다운로드할 수 없습니다.')
                walk(parts, parts[-1])
            size = snapshot.tell(); snapshot.seek(0)
            digest = hashlib.sha256()
            while True:
                chunk = snapshot.read(65536)
                if not chunk: break
                digest.update(chunk)
            snapshot.seek(0)
            yield {**download_range(size, '"' + digest.hexdigest() + '"'), 'name': parts[-1] + '.zip'}, snapshot

    def read(self, path, download=False):
        parts = self.parts(path)
        if not parts: raise ValueError('파일을 선택해주세요')
        with self.directory(parts[:-1]) as (directory, fd):
            handle = self.open_file(directory, fd, parts[-1], os.O_RDONLY)
            with os.fdopen(handle, 'rb') as stream:
                info = os.fstat(stream.fileno())
                if not stat.S_ISREG(info.st_mode): raise ValueError('일반 파일만 지원')
                if download and info.st_size > MAX_TRANSFER: raise ValueError('文件超过 20 MB 下载限制')
                limit = MAX_TRANSFER if download or Path(path).suffix.lower() in IMAGES else MAX_PREVIEW
                data = stream.read(limit + 1)
        result = {'name': parts[-1], 'path': path, 'size': info.st_size, 'modified': info.st_mtime, 'kind': 'binary'}
        if len(data) > limit:
            if download: raise ValueError('文件超过 20 MB 下载限制')
            return result
        if download:
            return {**result, 'data': base64.b64encode(data).decode()}
        if Path(path).suffix.lower() in IMAGES:
            return {**result, 'kind': 'image', 'mime': IMAGES[Path(path).suffix.lower()], 'data': base64.b64encode(data).decode()}
        try:
            text = data.decode('utf-8-sig')
            if '\x00' not in text: return {**result, 'kind': 'text', 'text': text}
        except UnicodeDecodeError:
            pass
        return result

    @contextmanager
    def download(self, path, range_header='', if_range='', limit=MAX_TRANSFER):
        try:
            # Large local files are hashed once, then served from their immutable
            # disk snapshot. Revalidate path/type/version before every range.
            parts = self.parts(path)
            if not parts: raise ValueError('파일을 선택해주세요')
            with self.directory(parts[:-1]) as (directory, fd):
                handle = self.open_file(directory, fd, parts[-1], os.O_RDONLY)
                try: info = os.fstat(handle)
                finally: os.close(handle)
            if not stat.S_ISREG(info.st_mode): raise ValueError('일반 파일만 지원')
            if limit is not None and info.st_size > limit: raise ValueError('文件超过 %d MB 下载限制' % (limit // 1024 // 1024))
            if info.st_size > MAX_TRANSFER:
                stamp = (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
                with _cached_transfer(('file', str(self.root), path, stamp), lambda: self._download(path, '', '', limit), range_header, if_range) as value:
                    yield value
            else:
                with self._download(path, range_header, if_range, limit) as value:
                    yield value
        except PermissionError:
            raise
        except OSError as error:
            raise ValueError('파일에 액세스할 수 없습니다. 디렉터리를 새로 고친 후 다시 시도하세요.') from error

    @contextmanager
    def _download(self, path, range_header, if_range, limit):
        parts = self.parts(path)
        if not parts: raise ValueError('파일을 선택해주세요')
        # A private disk snapshot binds the validator to exactly the bytes sent,
        # even if an editor replaces or writes the source during the response.
        with tempfile.TemporaryFile(prefix='bridge-download-') as snapshot:
            with self.directory(parts[:-1]) as (directory, fd):
                handle = self.open_file(directory, fd, parts[-1], os.O_RDONLY)
                with os.fdopen(handle, 'rb') as stream:
                    before = os.fstat(stream.fileno())
                    if not stat.S_ISREG(before.st_mode): raise ValueError('일반 파일만 지원')
                    if limit is not None and before.st_size > limit: raise ValueError('文件超过 %d MB 下载限制' % (limit // 1024 // 1024))
                    def copy_range(selection):
                        digest, size = hashlib.sha256(), 0
                        stream.seek(0); snapshot.seek(0); snapshot.truncate()
                        while True:
                            chunk = stream.read(65536)
                            if not chunk: break
                            end = size + len(chunk)
                            if limit is not None and end > limit: raise ValueError('文件超过 %d MB 下载限制' % (limit // 1024 // 1024))
                            digest.update(chunk)
                            left = max(size, selection['offset'])
                            right = min(end, selection['offset'] + selection['length'])
                            if right > left: snapshot.write(chunk[left - size:right - size])
                            size = end
                        after = os.fstat(stream.fileno())
                        if ((before.st_size, before.st_mtime_ns, before.st_ctime_ns) !=
                                (after.st_size, after.st_mtime_ns, after.st_ctime_ns) or size != before.st_size):
                            raise ValueError('文件正在变化，请稍后重新下载')
                        return '"sha256-' + digest.hexdigest() + '"'
                    # Hash all bytes, but normally retain only the requested
                    # chunk. No file-sized allocation or repeated full snapshot.
                    selection = download_range(before.st_size, '', range_header)
                    etag = copy_range(selection)
                    result = download_range(before.st_size, etag, range_header, if_range)
                    if result['length'] != selection['length'] or result['offset'] != selection['offset']:
                        result['etag'] = copy_range(result)
            result['name'] = parts[-1]
            snapshot.seek(0)
            yield result, snapshot

    def upload(self, path, encoded):
        parts = self.parts(path)
        if not parts or _has_git_component(parts): raise PermissionError('请选择项目内的普通文件位置')
        try: data = base64.b64decode(encoded, validate=True)
        except (ValueError, TypeError): raise ValueError('잘못된 업로드 콘텐츠') from None
        if len(data) > MAX_TRANSFER: raise ValueError('각 파일은 다음을 초과할 수 없습니다. 20 MB')
        with self.directory(parts[:-1]) as (directory, fd):
            temporary = '.bridge-upload-' + uuid.uuid4().hex
            handle = self.open_file(directory, fd, temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
            try:
                with os.fdopen(handle, 'wb') as stream:
                    stream.write(data); stream.flush(); os.fsync(stream.fileno())
                try:
                    # Publish only a complete file; link fails if the destination exists.
                    if fd is not None: os.link(temporary, parts[-1], src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
                    else: os.link(directory / temporary, directory / parts[-1])
                except FileExistsError:
                    existing = self.read(path, download=True)
                    if existing['data'] == encoded:
                        return {'name': parts[-1], 'path': path, 'size': len(data), 'existing': True}
                    raise ValueError('동일한 이름의 파일이 이미 존재합니다. 업로드한 파일의 이름을 변경하세요.') from None
            finally:
                if fd is not None: os.unlink(temporary, dir_fd=fd)
                else: (directory / temporary).unlink()
        return {'name': parts[-1], 'path': path, 'size': len(data), 'existing': False}



class WorkspaceUpload:
    """Journal offsets on the destination host, including across SSH subprocesses."""

    RETENTION = 24 * 60 * 60
    VERIFY_BATCH = 8 * WORKSPACE_UPLOAD_CHUNK

    def __init__(self, workspace, path, owner, identifier, total):
        self.workspace, self.path, self.total = workspace, path, total
        self.parts = workspace.parts(path)
        if not self.parts or any(p.rstrip(' .').casefold() == '.git' for p in self.parts):
            raise PermissionError('프로젝트 내의 일반 파일 위치를 선택하세요.')
        if not re.fullmatch(r'[a-f0-9]{64}', owner) or str(uuid.UUID(identifier)) != identifier:
            raise ValueError('Invalid upload identity.')
        if type(total) is not int or not 0 <= total <= 2**53 - 1:
            raise ValueError('Invalid file size.')
        scope = json.dumps([owner, identifier, str(workspace.root), path, total])
        self.key = hashlib.sha256(scope.encode()).hexdigest()

    @staticmethod
    def registry():
        # A private per-user cache keeps bookkeeping out of browsable projects.
        base = os.environ.get('LOCALAPPDATA' if os.name == 'nt' else 'XDG_CACHE_HOME')
        cache = (Path(base) if base and Path(base).is_absolute() else Path.home() / '.cache') / 'codex-mobile-bridge' / 'workspace-uploads'
        cache.mkdir(parents=True, exist_ok=True, mode=0o700)
        db = sqlite3.connect(cache / 'journal.sqlite3', timeout=30)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def remove_stage(row):
        if not row['temp']:
            return
        workspace = Workspace(row['root'])
        parts = workspace.parts(row['path'])
        with workspace.directory(parts[:-1]) as (directory, fd):
            name = row['temp']
            try:
                info = os.stat(name, dir_fd=fd, follow_symlinks=False) if fd is not None else (directory / name).lstat()
            except FileNotFoundError:
                return
            if (str(info.st_dev), str(info.st_ino)) != (row['dev'], row['ino']):
                return
            try:
                if fd is not None:
                    os.unlink(name, dir_fd=fd)
                else:
                    (directory / name).unlink()
            except FileNotFoundError:
                pass  # A concurrent finish can close out the same committed receipt.

    def run(self, phase, offset=0, encoded=None):
        if phase not in ('start', 'status', 'chunk', 'finish', 'cancel'):
            raise ValueError('Invalid upload operation.')
        db = None
        try:
            db = self.registry()
            db.execute('PRAGMA foreign_keys=ON')
            # Serialize updates on the final host; a fresh SSH interpreter sees the same journal.
            db.execute('BEGIN IMMEDIATE')
            db.execute('CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, root TEXT, path TEXT, temp TEXT, '
                       'dev TEXT, ino TEXT, offset INTEGER, state TEXT, existing INTEGER, touched REAL)')
            db.execute('CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY REFERENCES uploads(id) ON DELETE CASCADE, '
                       'signature TEXT, checked INTEGER)')
            now = time.time()
            if phase == 'start':
                for old in db.execute('SELECT * FROM uploads WHERE touched < ?', (now - self.RETENTION,)).fetchall():
                    try:
                        self.remove_stage(old)
                    except FileNotFoundError:
                        pass
                    except (OSError, ValueError):
                        continue
                    db.execute('DELETE FROM uploads WHERE id=?', (old['id'],))
            row = db.execute('SELECT * FROM uploads WHERE id=?', (self.key,)).fetchone()
            if row is None and phase != 'start':
                if phase in ('cancel', 'status'):
                    return {'state': 'missing', 'offset': 0}
                raise ValueError('Upload expired. Start again.')
            if row is None:
                with self.workspace.directory(self.parts[:-1]) as (directory, fd):
                    name = '.bridge-upload-' + uuid.uuid4().hex
                    handle = self.workspace.open_file(directory, fd, name, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                    try:
                        info = os.fstat(handle)
                        db.execute('INSERT INTO uploads VALUES (?,?,?,?,?,?,0,?,0,?)',
                                   (self.key, str(self.workspace.root), self.path, name, str(info.st_dev),
                                    str(info.st_ino), 'pending', now))
                        db.commit()
                    except BaseException:
                        os.close(handle)
                        if fd is None:
                            (directory / name).unlink()
                        else:
                            os.unlink(name, dir_fd=fd)
                        raise
                    os.close(handle)
                return {'state': 'pending', 'offset': 0}
            state, position, existing = row['state'], row['offset'], bool(row['existing'])
            if phase == 'cancel' and state in ('pending', 'checking'):
                self.remove_stage(row)
                db.execute('DELETE FROM uploads WHERE id=?', (self.key,))
                db.commit()
                return {'state': 'missing', 'offset': 0}
            if (state == 'pending' and phase in ('chunk', 'finish')) or (state == 'checking' and phase == 'finish'):
                position, state, existing = self.update_file(db, row, phase, offset, encoded)
            db.execute('UPDATE uploads SET offset=?,state=?,existing=?,touched=? WHERE id=?',
                       (position, state, existing, now, self.key))
            db.commit()
            if state == 'done' and row['temp']:
                # Commit the receipt before cleanup so a lost response is resolved by status.
                self.remove_stage(row)
                db.execute('DELETE FROM checks WHERE id=?', (self.key,))
                db.execute("UPDATE uploads SET temp='' WHERE id=?", (self.key,))
                db.commit()
            return {'state': state, 'offset': position, 'size': self.total, 'name': self.parts[-1],
                    'path': self.path, 'existing': existing}
        except sqlite3.Error as error:
            if getattr(error, 'sqlite_errorname', '') == 'SQLITE_FULL':
                raise ValueError('Not enough disk space for the upload.') from error
            raise ValueError('Upload journal unavailable. Retry to resume.') from error
        finally:
            if db is not None:
                db.close()

    def update_file(self, db, row, phase, offset, encoded):
        position = row['offset']
        with self.workspace.directory(self.parts[:-1]) as (directory, fd):
            handle = self.workspace.open_file(directory, fd, row['temp'], os.O_RDWR)
            with os.fdopen(handle, 'r+b') as stage:
                info = os.fstat(handle)
                if not stat.S_ISREG(info.st_mode) or (str(info.st_dev), str(info.st_ino)) != (row['dev'], row['ino']):
                    raise PermissionError('Upload destination changed.')
                if phase == 'chunk':
                    data = base64.b64decode(encoded, validate=True)
                    if (type(offset) is not int or not 0 <= offset <= position or not 0 < len(data) <= WORKSPACE_UPLOAD_CHUNK
                            or offset + len(data) > self.total or info.st_size < position or info.st_nlink != 1):
                        raise ValueError('Invalid upload chunk.')
                    stage.seek(offset)
                    if offset < position:
                        if offset + len(data) > position or stage.read(len(data)) != data:
                            raise ValueError('Upload chunk differs. Start again.')
                    else:
                        # Discard an uncommitted tail left by a short write or a process exit.
                        stage.truncate(offset)
                        stage.write(data)
                        stage.flush()
                        os.fsync(handle)
                        position += len(data)
                    return position, 'pending', False
                if position != self.total or info.st_size != position:
                    raise ValueError('Upload is incomplete.')
                try:
                    if fd is None:
                        os.link(directory / row['temp'], directory / self.parts[-1])
                    else:
                        os.link(row['temp'], self.parts[-1], src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
                except FileExistsError:
                    destination = self.workspace.open_file(directory, fd, self.parts[-1], os.O_RDONLY | getattr(os, 'O_NONBLOCK', 0))
                    with os.fdopen(destination, 'rb') as target:
                        other = os.fstat(destination)
                        if stat.S_ISREG(other.st_mode) and os.path.samestat(info, other):
                            return position, 'done', False
                        if stat.S_ISREG(other.st_mode) and other.st_size == position:
                            signature = json.dumps([other.st_dev,other.st_ino,other.st_size,other.st_mtime_ns,other.st_ctime_ns])
                            check = db.execute('SELECT * FROM checks WHERE id=?', (self.key,)).fetchone()
                            checked = check['checked'] if check and check['signature'] == signature else 0
                            stage.seek(checked)
                            target.seek(checked)
                            end = min(position, checked + self.VERIFY_BATCH)
                            while checked < end:
                                size = min(WORKSPACE_UPLOAD_CHUNK, end - checked)
                                block = stage.read(size)
                                if len(block) != size or target.read(size) != block:
                                    raise ValueError('동일한 이름의 파일이 이미 존재합니다. 업로드한 파일의 이름을 변경하세요.')
                                checked += size
                            current = (os.stat(self.parts[-1], dir_fd=fd, follow_symlinks=False)
                                       if fd is not None else (directory / self.parts[-1]).lstat())
                            if (not os.path.samestat(other, current) or other.st_size != current.st_size
                                    or other.st_mtime_ns != current.st_mtime_ns or other.st_ctime_ns != current.st_ctime_ns):
                                raise ValueError('Upload destination changed.')
                            if checked == position:
                                return position, 'done', True
                            db.execute('INSERT OR REPLACE INTO checks VALUES (?,?,?)', (self.key, signature, checked))
                            return position, 'checking', False
                    raise ValueError('동일한 이름의 파일이 이미 존재합니다. 업로드한 파일의 이름을 변경하세요.') from None
                return position, 'done', False


# A remote workspace payload has no installed Bridge modules to import.
_GIT_DIRECTORY_CHILD = """
import os
import sys

fd = int(sys.argv[1])
try:
    os.fchdir(fd)
    os.close(fd)
except OSError:
    sys.exit(126)
try:
    os.execvp('git', ['git', *sys.argv[2:]])
except FileNotFoundError:
    sys.exit(127)
"""


class GitWorkspace:
    """Project Git inspection and explicitly requested local Git operations."""
    def __init__(self, workspace, *, directory_fd=None):
        self.workspace = workspace
        self.directory_fd = directory_fd
        self.environment = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
        self.environment.update(GIT_OPTIONAL_LOCKS='0', GIT_TERMINAL_PROMPT='0', GIT_NO_LAZY_FETCH='1', LC_ALL='C')
        self.command = ['git', '--no-pager', '--no-optional-locks', '--literal-pathspecs',
                        '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'protocol.allow=never']
        self.write_command = ['git', '--no-pager', '--literal-pathspecs', '-c', 'core.fsmonitor=false',
                              '-c', 'protocol.allow=never', '-c', 'gc.auto=0']
        # Status may otherwise run a repository's clean/process filter on dirty files.
        code, keys, truncated = self.run(['config', '--name-only', '--get-regexp', r'^filter\..*\.(clean|process|required)$'])
        if code not in (0, 1) or truncated: raise ValueError('읽을 수 없음 Git 구성, 컴퓨터의 창고를 확인하세요.')
        for key in keys.decode('utf-8', 'replace').splitlines():
            self.command += ['-c', key + ('=false' if key.endswith('.required') else '=')]

    def run(self, args, limit=2 * 1024 * 1024, write=False, message=None):
        source = tempfile.TemporaryFile(dir=self.gitdir) if message is not None else None
        if source: source.write(message.encode('utf-8')); source.seek(0)
        command = (self.write_command if write else self.command) + args
        needs_child = self.directory_fd is not None and sys.platform == 'darwin'
        try:
            # 선택한 하위 폴더는 검증한 핸들을 작업 위치로 사용한다.
            # 검증 뒤 링크가 바뀌어도 다른 저장소에서 명령을 실행하지 않는다.
            options = {'cwd': self.workspace.root}
            if self.directory_fd is not None:
                options = {'pass_fds': (self.directory_fd,)}
                if needs_child:
                    # macOS does not allow chdir through /dev/fd. Change the
                    # directory in a fresh process before replacing it with Git.
                    launcher = ([sys.executable, '--git-directory-child'] if getattr(sys, 'frozen', False) else
                                [sys.executable, '-I', '-S', '-c', _GIT_DIRECTORY_CHILD])
                    command = [*launcher, str(self.directory_fd), *command[1:]]
                else:
                    options['cwd'] = '/dev/fd/' + str(self.directory_fd)
            process = subprocess.Popen(command, **options, env=self.environment,
                                       stdin=source if source else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        except FileNotFoundError:
            raise ValueError('이 컴퓨터나 SSH 서버가 설치되지 않았습니다 Git') from None
        finally:
            if source: source.close()
        expired = threading.Event()
        def timeout():
            expired.set()
            try: process.kill()
            except OSError: pass
        timer = threading.Timer(30 if write else 10, timeout); timer.start()
        try:
            data = process.stdout.read(limit + 1)
            truncated = len(data) > limit
            if truncated: process.kill()
            code = process.wait()
            if expired.is_set(): raise ValueError('Git 작업 결과가 확인되지 않았습니다. 다시 시도할지 결정하기 전에 상태와 기록을 새로 고치세요.' if write else 'Git 읽기 시간이 초과되었습니다. 컴퓨터에서 창고를 확인한 후 다시 시도해 주세요.')
            if needs_child and code == 126:
                raise ValueError('프로젝트 디렉터리에 접근할 수 없습니다. 다시 선택하세요.')
            if needs_child and code == 127:
                raise ValueError('이 컴퓨터나 SSH 서버가 설치되지 않았습니다 Git')
            return code, data[:limit], truncated
        finally:
            timer.cancel(); process.stdout.close()
            if process.poll() is None: process.kill(); process.wait()

    def status(self):
        context = self.repository_context()
        if not context['available']: return context
        prefix = context['path_prefix']
        code, raw, truncated = self.run(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all',
                                          '--renames', '--ignore-submodules=dirty', '--', '.'])
        if code or truncated: raise ValueError('Git 변경 목록이 너무 크거나 읽을 수 없습니다. 컴퓨터의 저장소를 확인하세요.')
        headers, entries = {}, []
        records = iter(raw.decode('utf-8', 'surrogateescape').split('\0'))
        for record in records:
            if not record: continue
            if record.startswith('# '):
                key, _, value = record[2:].partition(' '); headers[key] = value; continue
            kind = record[0]; old = None; submodule = False
            if kind == '?': path, xy = record[2:], '??'
            elif kind in ('1', '2', 'u'):
                parts = record.split(' ', {'1': 8, '2': 9, 'u': 10}[kind]); path, xy = parts[-1], parts[1]
                submodule = parts[2].startswith('S')
                if kind == '2': old = next(records)
            else: continue
            if not path.startswith(self.prefix): continue
            relative = path[len(self.prefix):]
            entries.append({'path': relative, 'oldPath': old[len(self.prefix):] if old and old.startswith(self.prefix) else None,
                            'index': xy[0], 'worktree': xy[1], 'conflict': kind == 'u', 'untracked': kind == '?', 'submodule': submodule})
        entries.sort(key=lambda entry: entry['path'].casefold())
        counts = headers.get('branch.ab', '').split()
        # 같은 커밋·색인을 가진 복제본 사이에서도 확인용 버전을 재사용하지 않는다.
        fingerprint = hashlib.sha256(os.fsencode(self.workspace.root) + b'\0' + raw)
        for name in ('index', 'HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'):
            try: fingerprint.update((self.gitdir / name).read_bytes())
            except FileNotFoundError: pass
        for entry in entries:
            try:
                info = (self.workspace.root / entry['path']).lstat()
                fingerprint.update(str((entry['path'], info.st_mtime_ns, info.st_ctime_ns, info.st_size)).encode('utf-8', 'replace'))
            except FileNotFoundError: pass
        operation = 'merge' if (self.gitdir / 'MERGE_HEAD').exists() else 'other' if any((self.gitdir / name).exists() for name in ('rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD')) else None
        return {'available': True, 'project': self.workspace.root.name, 'repository': context['repository'], 'scope': context['scope'], 'branch': headers.get('branch.head', ''),
                'version': fingerprint.hexdigest(), 'operation': operation,
                'commit': headers.get('branch.oid', ''), 'upstream': headers.get('branch.upstream'),
                'ahead': int(counts[0]) if counts else None, 'behind': -int(counts[1]) if counts else None, 'entries': entries}

    def repository_context(self):
        """Prepare the repository boundary without enumerating working-tree changes."""
        code, top, _ = self.run(['rev-parse', '--show-toplevel'])
        if code: return {'available': False, 'message': '当前项目不是 Git 工作区，或仓库不可访问'}
        repository = Path(os.fsdecode(top.rstrip(b'\n'))).resolve()
        code, gitdir, _ = self.run(['rev-parse', '--absolute-git-dir'])
        if code: raise ValueError('无法读取 Git 仓库位置')
        self.gitdir = Path(os.fsdecode(gitdir.rstrip(b'\n')))
        relative = self.workspace.root.relative_to(repository).as_posix()
        self.prefix = '' if relative == '.' else relative + '/'
        code, head, _ = self.run(['rev-parse', '--verify', 'HEAD'])
        commit = head.decode('ascii', 'ignore').strip() if code == 0 else '(initial)'
        return {'available': True, 'repository': repository.name, 'scope': relative, 'path_prefix': self.prefix, 'commit': commit}

    def blob(self, spec):
        code, data, truncated = self.run(['cat-file', 'blob', spec], MAX_PREVIEW)
        if truncated: return None
        if code: raise ValueError('파일 상태가 변경되었거나 Git 개체를 사용할 수 없습니다. 새로고침하세요. Git 패널')
        return data

    def working(self, path):
        parts = self.workspace.parts(path)
        with self.workspace.directory(parts[:-1]) as (directory, fd):
            handle = self.workspace.open_file(directory, fd, parts[-1], os.O_RDONLY)
            with os.fdopen(handle, 'rb') as stream:
                if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode): raise ValueError('이 파일 형식은 현재 차이점 미리보기를 지원하지 않습니다.')
                data = stream.read(MAX_PREVIEW + 1)
                return data if len(data) <= MAX_PREVIEW else None

    def diff(self, path, section, *, _state=None):
        self.workspace.parts(path)
        if section not in ('staged', 'unstaged', 'untracked', 'conflict'): raise ValueError('Git 잘못된 차이 유형')
        state = self.status() if _state is None else _state
        entry = next((item for item in state.get('entries', []) if item['path'] == path), None)
        if not entry: raise ValueError('파일 상태가 변경되었습니다. 새로고침하세요. Git 패널')
        valid = ('conflict' if entry['conflict'] else 'untracked' if entry['untracked'] else None)
        if (valid and section != valid) or (not valid and (section not in ('staged', 'unstaged') or entry['index' if section == 'staged' else 'worktree'] == '.')):
            raise ValueError('파일 상태가 변경되었습니다. 새로고침하세요. Git 패널')
        result = {'path': path, 'section': section, 'oldPath': entry['oldPath'], 'kind': 'diff'}
        if entry['submodule']: return {**result, 'kind': 'submodule'}
        if section in ('untracked', 'conflict'):
            before, after = b'', self.working(path)
        elif section == 'staged':
            old = entry['oldPath'] or path
            before = b'' if entry['index'] == 'A' or (entry['index'] == 'R' and not entry['oldPath']) else self.blob('HEAD:' + self.prefix + old)
            after = b'' if entry['index'] == 'D' else self.blob(':' + self.prefix + path)
        else:
            before = b'' if entry['worktree'] == 'A' else self.blob(':' + self.prefix + path)
            after = b'' if entry['worktree'] == 'D' else self.working(path)
        preview = self.text_diff(before, after, result)
        if (preview['kind'] != 'diff' or preview.get('metadataOnly') or entry['oldPath']
                or section not in ('staged', 'unstaged') or state['operation']
                or entry['index' if section == 'staged' else 'worktree'] != 'M'):
            return preview
        patch = self.hunk_patch(path, section)
        if patch is None:
            return preview
        text, hunks = patch
        result = {**preview, 'text': text, 'hunks': hunks, 'version': state['version']}
        if section == 'unstaged':
            # Git may rewrite the entire worktree file using its checkout EOL
            # conventions. Never offer discard if that can change other lines.
            data = after.replace(b'\r\n',b'')
            mixed = b'\r\n' in after and b'\n' in data
            code, attrs, truncated = self.run(['check-attr','-z','text','eol','crlf','--',path])
            attributes = attrs.rstrip(b'\0').split(b'\0')[2::3]
            status, setting, capped = self.run(['config','--get','core.autocrlf'])
            mode = setting.strip().lower()
            ordinary = all(v in (b'unspecified',b'unset') for v in attributes)
            result['canDiscardHunk'] = (not mixed and not code and not truncated and len(attributes)==3 and ordinary
                                       and status in (0,1) and not capped and
                                       (mode in (b'',b'false',b'no',b'0',b'off') or
                                        (mode in (b'true',b'yes',b'1',b'on') and b'\n' not in data) or
                                        (mode==b'input' and b'\r\n' not in after)))
        return result

    def hunk_patch(self, path, section):
        # Generate exactly what the user reviews, including Git's quoted paths, line
        # endings and no-newline markers. Extended changes are file-level operations.
        code, attributes, truncated = self.run(['check-attr', '-z', 'filter', 'working-tree-encoding', 'ident', '--', path])
        values = attributes.rstrip(b'\0').split(b'\0')[2::3]
        if code or truncated or len(values) != 3 or any(value not in (b'unset', b'unspecified') for value in values):
            return None
        args = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-relative',
                '--full-index', '--no-renames', '--unified=3', '--src-prefix=a/', '--dst-prefix=b/']
        if section == 'staged':
            args.append('--cached')
        status, raw, truncated = self.run(args + ['--', path])
        if status or truncated:
            return None
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError:
            return None
        header, *blocks = re.split(r'(?m)(?=^@@ )', text)
        if not blocks or not re.fullmatch(r'diff --git [^\n]+\nindex [0-9a-f]+\.\.[0-9a-f]+ 100(?:644|755)\n--- [^\n]+\n\+\+\+ [^\n]+\n', header):
            return None
        # Bind tokens to the complete patch. A client supplies no Git options or
        # patch text. Indistinguishable contexts cannot be offered for mutation.
        snapshot = hashlib.sha256(section.encode() + b'\0' + raw).digest()
        counts = {}
        bodies = [block.partition('\n')[2] for block in blocks]
        for body in bodies:
            counts[body] = counts.get(body, 0) + 1
        return text, [hashlib.sha256(snapshot + block.encode()).hexdigest() if counts[body] == 1 else None
                      for block, body in zip(blocks, bodies)]

    @staticmethod
    def text_diff(before, after, result):
        if before is None or after is None: return {**result, 'kind': 'large'}
        try:
            if b'\0' in before or b'\0' in after: return {**result, 'kind': 'binary'}
            old, new = before.decode('utf-8'), after.decode('utf-8')
        except UnicodeDecodeError: return {**result, 'kind': 'binary'}
        if result.get('section') == 'conflict': return {**result, 'kind': 'conflict', 'text': new}
        old_lines, new_lines = old.splitlines(keepends=True), new.splitlines(keepends=True)
        if len(old_lines) + len(new_lines) > 8000: return {**result, 'kind': 'large'}
        lines = difflib.unified_diff(old_lines, new_lines, fromfile=result.get('oldPath') or result['path'], tofile=result['path'], n=3)
        text = ''.join(line if line.endswith('\n') else line + '\n\\ No newline at end of file\n' for line in lines)
        return {**result, 'text': text, 'metadataOnly': not text}


    def require_repository(self):
        state = self.status()
        if not state['available']: raise ValueError(state['message'])
        return state

    @staticmethod
    def revision(value):
        if not isinstance(value, str) or not re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', value):
            raise ValueError('제출 ID가 잘못되었습니다. 기록을 새로고침하세요.')
        return value

    def history(self, limit=40, ref='all'):
        state = self.repository_context()
        if not state['available']: raise ValueError(state['message'])
        if not isinstance(limit, int) or not 1 <= limit <= 1000 or ref not in ('all', 'current'):
            raise ValueError('기록 쿼리가 잘못되었습니다.')
        revisions = ['--all'] if ref == 'all' else []
        if state['commit'] != '(initial)': revisions.append('HEAD')
        elif ref == 'current': return {'commits': [], 'hasMore': False}
        code, raw, truncated = self.run(['log', '--topo-order', '-n', str(limit + 1),
            '--format=%H%x00%P%x00%an%x00%aI%x00%s%x00%D', '-z', *revisions, '--'])
        if code or truncated: raise ValueError('기록 레코드를 읽을 수 없거나 너무 큽니다. 컴퓨터의 저장소를 확인하세요.')
        fields = raw.decode('utf-8', 'replace').split('\0')
        if fields[-1] == '': fields.pop()
        commits = []
        for start in range(0, len(fields), 6):
            oid, parents, author, date, subject, refs = fields[start:start + 6]
            commits.append({'id': oid, 'parents': parents.split(), 'author': author, 'date': date,
                            'subject': subject, 'refs': refs})
        return {'commits': commits[:limit], 'hasMore': len(commits) > limit, 'scope': state['scope']}

    def commit_detail(self, revision):
        context = self.repository_context()
        if not context['available']: raise ValueError(context['message'])
        self.revision(revision)
        code, raw, truncated = self.run(['show', '-s', '--format=%H%x00%P%x00%an%x00%aI%x00%B', revision, '--'], MAX_PREVIEW)
        if code or truncated: raise ValueError('제출 세부정보를 읽을 수 없습니다.')
        oid, parents, author, date, message = raw.decode('utf-8', 'replace').split('\0', 4)
        parents = parents.split()
        comparison = [parents[0], oid] if parents else ['--root', oid]
        code, raw, truncated = self.run(['diff-tree', '--no-commit-id', '--raw', '--no-abbrev', '-z', '-r', '-M', *comparison, '--', '.'])
        if code or truncated: raise ValueError('이 커밋의 파일 목록이 너무 크거나 읽을 수 없습니다.')
        tokens = iter(raw.decode('utf-8', 'replace').split('\0')); entries = []
        for header in tokens:
            if not header: continue
            old_mode, mode, old_id, new_id, change = header[1:].split(' ')
            path = next(tokens); old = None
            if change.startswith(('R', 'C')): old, path = path, next(tokens)
            if not path.startswith(self.prefix): continue
            entries.append({'path': path[len(self.prefix):], 'oldPath': old[len(self.prefix):] if old and old.startswith(self.prefix) else None,
                            'change': change[0], 'oldId': old_id if not old or old.startswith(self.prefix) else '0' * len(old_id),
                            'newId': new_id, 'submodule': old_mode == '160000' or mode == '160000'})
        return {'id': oid, 'parents': parents, 'author': author, 'date': date, 'message': message.rstrip(), 'entries': entries}

    def historical_diff(self, revision, path):
        self.workspace.parts(path)
        detail = self.commit_detail(revision)
        entry = next((entry for entry in detail['entries'] if entry['path'] == path), None)
        if not entry: raise ValueError('파일은 이 커밋의 프로젝트 변경 사항에 속하지 않습니다.')
        result = {'path': path, 'oldPath': entry['oldPath'], 'kind': 'diff'}
        if entry['submodule']: return {**result, 'kind': 'submodule'}
        before = b'' if set(entry['oldId']) == {'0'} else self.blob(entry['oldId'])
        after = b'' if set(entry['newId']) == {'0'} else self.blob(entry['newId'])
        return self.text_diff(before, after, result)

    def branches(self):
        state = self.require_repository()
        code, raw, truncated = self.run(['for-each-ref', '--sort=refname', '--format=%(refname:short)%00%(objectname)%00%(upstream:short)', 'refs/heads/'])
        if code or truncated: raise ValueError('분기 목록을 읽을 수 없습니다.')
        entries = []
        for line in raw.decode('utf-8', 'replace').splitlines():
            name, oid, upstream = line.split('\0')
            entries.append({'name': name, 'id': oid, 'upstream': upstream, 'current': name == state['branch']})
        return {'branches': entries}

    @contextmanager
    def mutation_lock(self):
        # Shared across HTTP workers and separate SSH Python processes.
        with (self.gitdir / 'codex-mobile-workbench.lock').open('a+b') as lock:
            if os.name == 'nt':
                import msvcrt
                lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
                try: msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
                except OSError: raise ValueError('또 다른 Git 작업이 실행 중입니다. 나중에 새로고침하세요.') from None
            else:
                import fcntl
                try: fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                except OSError: raise ValueError('또 다른 Git 작업이 실행 중입니다. 나중에 새로고침하세요.') from None
            try: yield
            finally:
                if os.name == 'nt': lock.seek(0); msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
                else: fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

    def mutate(self, action, version, path='', branch='', message='', hunk=None):
        partial = {'stage-hunk': 'unstaged', 'unstage-hunk': 'staged', 'discard-hunk': 'unstaged'}
        allowed = ('stage', 'unstage', 'stage-all', 'unstage-all', 'commit', 'create-branch', 'switch-branch', 'merge', 'abort-merge', *partial)
        if action not in allowed: raise ValueError('이는 지원되지 않습니다. Git 작동하다')
        if (action in partial and (not isinstance(hunk, str) or not re.fullmatch('[0-9a-f]{64}', hunk))
                or action not in partial and hunk is not None):
            raise ValueError('Refresh the diff and select the change block again.')
        self.require_repository()
        with self.mutation_lock():
            state = self.require_repository()
            if not isinstance(version, str) or version != state['version']:
                raise ValueError('창고가 변경되었습니다. 새로고침 후 확인 후 다시 운영하시기 바랍니다.')
            if state['operation'] == 'other': raise ValueError('창고가 리베이스 또는 피킹 중입니다. 먼저 컴퓨터에서 작업을 완료하십시오.')
            if action in partial:
                # Re-read under the same repository lock used for file actions. A
                # later edit invalidates both the status version and the patch token.
                diff = self.diff(path, partial[action], _state=state)
                identifiers = diff.get('hunks', [])
                if hunk not in identifiers or (action=='discard-hunk' and not diff.get('canDiscardHunk')):
                    raise ValueError('Refresh the diff and select the change block again.')
                header, *blocks = re.split(r'(?m)(?=^@@ )', diff['text'])
                patch = header + blocks[identifiers.index(hunk)]
                command = ['apply', '--whitespace=nowarn']
                if action != 'discard-hunk': command.append('--cached')
                if action != 'stage-hunk': command.append('--reverse')
                if self.require_repository()['version'] != version:
                    raise ValueError('Refresh the diff and select the change block again.')
                # git apply checks its context, locks index writes and does not
                # allow partial success (--reject) or a three-way fallback.
                code, _, truncated = self.run(command + ['-'], write=True, message=patch)
                if code or truncated:
                    raise ValueError('Refresh the diff and select the change block again.')
                labels = {'stage-hunk': 'Change block staged', 'unstage-hunk': 'Change block unstaged',
                          'discard-hunk': 'Change block discarded'}
                return {'outcome': 'success', 'message': labels[action], 'state': self.status()}
            if action in ('commit', 'create-branch', 'switch-branch', 'merge', 'abort-merge') and state['scope'] != '.':
                raise ValueError('이 작업은 전체 창고에 영향을 미칩니다. 창고의 루트디렉토리에 해당하는 채팅에서 작업해주세요.')
            if action in ('stage', 'unstage'):
                parts = self.workspace.parts(path)
                if not parts or _has_git_component(parts): raise ValueError('请选择项目中的变更文件')
                entry = next((e for e in state['entries'] if e['path'] == path), None)
                if not entry or entry['submodule']: raise ValueError('파일 상태가 변경되었거나 하위 모듈입니다. 컴퓨터에서 새로고침하여 처리하세요.')
                # Existing parent components must not redirect staging outside the project.
                if action == 'stage':
                    try:
                        with self.workspace.directory(parts[:-1]): pass
                    except FileNotFoundError:
                        if entry['worktree'] != 'D': raise
                paths = [path]
                if action == 'unstage' and entry['oldPath']: paths.append(entry['oldPath'])
            else: paths = ['.']
            if action.startswith('stage'):
                command = ['add', '-A', '--', *paths]
            elif action.startswith('unstage'):
                # In an unborn repository, remove only index entries; preserve even
                # worktree files edited again after their first staging.
                command = ['restore', '--staged', '--source=HEAD', '--', *paths] if state['commit'] != '(initial)' else ['rm', '-r', '-f', '--cached', '--ignore-unmatch', '--', *paths]
            elif action == 'commit':
                if state['branch'] == '(detached)': raise ValueError('현재 별거 중 HEAD，제출하기 전에 지점을 만드십시오.')
                if any(e['conflict'] for e in state['entries']): raise ValueError('충돌을 해결하고 먼저 파일을 준비하십시오.')
                if state['operation'] != 'merge' and not any(not e['untracked'] and e['index'] != '.' for e in state['entries']): raise ValueError('먼저 제출해야 할 서류를 임시로 저장해주세요.')
                if not isinstance(message, str) or not message.strip() or len(message.encode('utf-8')) > 16000 or '\0' in message:
                    raise ValueError('제출 지침을 작성하십시오（최대 16 KB）')
                command = ['commit', '--file=-']
            elif action == 'abort-merge':
                if state['operation'] != 'merge': raise ValueError('현재 중단할 병합이 없습니다.')
                command = ['merge', '--abort']
            else:
                if state['operation']: raise ValueError('먼저 현재 병합을 완료하거나 중단하십시오.')
                if state['entries']: raise ValueError('지점을 운영하기 전에 커밋되지 않은 변경 사항을 컴퓨터에 제출하거나 저장하세요.')
                if not isinstance(branch, str) or not branch or len(branch) > 200 or branch.startswith('-'):
                    raise ValueError('지점 이름이 잘못되었습니다.')
                code, normalized, _ = self.run(['check-ref-format', '--branch', branch])
                if code or normalized.decode('utf-8', 'replace').strip() != branch: raise ValueError('지점 이름이 잘못되었습니다.')
                names = {entry['name'] for entry in self.branches()['branches']}
                if action == 'create-branch':
                    if branch in names: raise ValueError('같은 이름의 분기가 이미 존재합니다.')
                    command = ['switch', '-c', branch]
                else:
                    if branch not in names or branch == state['branch']: raise ValueError('다른 기존 지역 지점을 선택하세요.')
                    command = ['switch', '--no-guess', branch] if action == 'switch-branch' else ['merge', '--no-edit', '--no-stat', '--no-autostash', 'refs/heads/' + branch]
            code, _, truncated = self.run(command, write=True, message=message if action == 'commit' else None)
            result = self.status()
            if code or truncated:
                if action == 'merge' and result.get('operation') == 'merge':
                    return {'outcome': 'conflict' if any(e['conflict'] for e in result['entries']) else 'merge-pending',
                            'message': '병합이 아직 완료되지 않았습니다. 변경 사항을 확인하세요. 충돌을 해결하고 이 병합을 제출하거나 중단할 수 있습니다.。', 'state': result}
                raise ValueError('Git 작업이 완료되지 않았거나 결과가 확인되지 않았습니다. 상태와 기록을 새로 고치십시오. 변경 사항이 없으면 컴퓨터에서 확인하세요. Git 신원, 서명、hooks 아니면 창고를 잠근 후 다시 시도해 보세요.。')
            labels = {'stage': '파일 스테이징됨', 'unstage': '취소', 'stage-all': '프로젝트 변경 단계', 'unstage-all': '프로젝트 저장이 취소되었습니다.',
                      'commit': '현지 지사에 제출', 'create-branch': "분기 생성 및 전환", 'switch-branch': '지점 전환', 'merge': '지점이 병합되었습니다.', 'abort-merge': '병합이 중단되었습니다.'}
            return {'outcome': 'success', 'message': labels[action], 'state': result}


def host_operation(root, action, params, history_path=None):
    """Explicit read-only host navigation; project writes keep their old root."""
    if action not in ('list', 'info', 'preview', 'download', 'download-stream', 'archive-stream'):
        raise PermissionError("호스트 파일 탐색은 읽기 전용입니다.")
    params = dict(params)
    params.pop('scope')
    value = params.pop('path', '')
    if not isinstance(value, str) or len(value) > 4096 or any(ord(c) < 32 for c in value):
        raise ValueError('잘못된 파일 경로')
    project = Path(root).resolve() if root and Path(root).is_absolute() else None
    start = project or (Path(history_path).parent.resolve() if history_path and Path(history_path).is_absolute() else None)
    path = Path(value) if value else start
    if path is None:
        raise ValueError("이 채팅의 기록 디렉터리는 현재 사용할 수 없습니다.")
    if not path.is_absolute():
        if start is None or path.drive:
            raise ValueError('전체 디렉터리 경로를 입력하세요.')
        path = start/path
    if (os.name == 'nt' and display_absolute_path(path.anchor).startswith('\\\\')
            and (project is None or display_absolute_path(path.anchor).casefold() != display_absolute_path(project.anchor).casefold())):
        raise PermissionError("로컬 디스크 또는 현재 프로젝트의 네트워크 공유 찾아보기")
    anchor = Path(path.anchor)
    relative = path.relative_to(anchor).as_posix() if path != anchor else ''
    Workspace.parts(relative)  # Do not normalize away traversal or follow links.
    params['path'] = relative
    if action == 'info' and not relative:
        result = {'name': path.anchor, 'path': '', 'size': None, 'kind': 'directory'}
    else:
        result = operate(str(anchor), action, params)
    if not isinstance(result, dict):
        return result  # Keep the existing streaming context manager intact.
    absolute = display_absolute_path(str(path)).replace(os.sep, '/')
    result.update(path=absolute, absolutePath=absolute)
    try:
        result['projectPath'] = path.relative_to(project).as_posix() if project else None
        if result['projectPath'] == '.': result['projectPath'] = ''
    except ValueError:
        result['projectPath'] = None
    if action == 'list':
        result['project'] = display_absolute_path(str(project)).replace(os.sep, '/') if project else ''
        result['parentPath'] = display_absolute_path(str(path.parent)).replace(os.sep, '/') if path != anchor else None
        for entry in result['entries']:
            entry['path'] = display_absolute_path(str(anchor/entry['path'])).replace(os.sep, '/')
            entry['projectPath'] = ((result['projectPath'] + '/' if result['projectPath'] else '') + entry['name']) if result['projectPath'] is not None else None
    return result


@contextmanager
def git_project(workspace, repository=''):
    """채팅 폴더 아래의 선택한 Git 작업 위치를 한 요청 동안 고정한다."""
    parts = workspace.parts(repository)
    if '.git' in parts:
        raise PermissionError('Git 저장소의 작업 폴더를 선택하세요.')
    with workspace.directory(parts) as (directory, fd):
        selected = Workspace(directory, directory_fd=fd)
        if not selected.root.is_relative_to(workspace.root):
            raise PermissionError('현재 프로젝트 안의 Git 저장소를 선택하세요.')
        yield GitWorkspace(selected, directory_fd=fd)


def git_repositories(workspace):
    """현재 프로젝트와 바로 아래의 실제 저장소·워크트리를 선택 목록으로 제공한다."""
    candidates = ['']
    with workspace.directory([]) as (directory, fd):
        with os.scandir(fd if fd is not None else directory) as entries:
            for entry in entries:
                try:
                    if not entry.is_dir(follow_symlinks=False) or _windows_reparse_point(directory / entry.name):
                        continue
                    workspace.parts(entry.name)
                    with workspace.directory([entry.name]) as (child, child_fd):
                        marker = os.stat('.git', dir_fd=child_fd, follow_symlinks=False) if child_fd is not None else (child / '.git').lstat()
                        if stat.S_ISDIR(marker.st_mode) or stat.S_ISREG(marker.st_mode):
                            candidates.append(entry.name)
                except (OSError, ValueError):
                    continue
    repositories = []
    for relative in sorted(candidates, key=lambda value: (bool(value), value.casefold(), value)):
        with git_project(workspace, relative) as project:
            code, top, truncated = project.run(['rev-parse', '--show-toplevel'])
            if code or truncated:
                continue
            repositories.append({'path': relative, 'name': project.workspace.root.name,
                                 'root': str(project.workspace.root),
                                 'repository': Path(os.fsdecode(top.rstrip(b'\n'))).name})
    return {'repositories': repositories, 'project': str(workspace.root)}


def operate(root, action, params, history_path=None):
    try:
        if params.get('scope') == 'host':
            return host_operation(root, action, params, history_path)
        workspace = Workspace(root)
        if action == 'git-repositories': return git_repositories(workspace)
        if action in ('git-status', 'git-diff', 'git-history', 'git-commit', 'git-history-diff', 'git-branches', 'git-action'):
            options = dict(params)
            with git_project(workspace, options.pop('repository', '')) as project:
                if action == 'git-status': return project.status()
                if action == 'git-diff': return project.diff(**options)
                if action == 'git-history': return project.history(**options)
                if action == 'git-commit': return project.commit_detail(**options)
                if action == 'git-history-diff': return project.historical_diff(**options)
                if action == 'git-branches': return project.branches()
                if action == 'git-action': return project.mutate(**options)
        if action == 'list': return workspace.listing(**params)
        if action == 'info': return workspace.info(params['path'])
        if action == 'references': return workspace.references(params['references'])
        if action == 'archive-stream': return workspace.archive(**params)
        if action == 'preview': return workspace.read(params['path'])
        if action == 'download': return workspace.read(params['path'], download=True)
        if action == 'download-stream': return workspace.download(**params)
        if action == 'upload': return workspace.upload(**params)
        if action == 'upload-part':
            options = dict(params)
            transfer = WorkspaceUpload(workspace, *(options.pop(k) for k in ('path', 'owner', 'identifier', 'total')))
            return transfer.run(**options)
        raise ValueError('지원되지 않는 파일 작업')
    except PermissionError:
        raise
    except OSError as error:
        if error.errno in (errno.ENOSPC, getattr(errno, 'EDQUOT', errno.ENOSPC)):
            raise ValueError('Not enough disk space for the upload.') from error
        raise ValueError('파일에 액세스할 수 없습니다. 디렉터리를 새로 고친 후 다시 시도하세요.') from error
