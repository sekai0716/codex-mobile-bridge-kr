"""Private, immutable uploads scoped to a host and an existing chat."""
import hashlib
import json
import re
import shutil
import threading
import time
import uuid
from pathlib import Path

MAX_FILE = 20 * 1024 * 1024
MAX_FILES = 10
MAX_TOTAL = 100 * 1024 * 1024


def file_name(value):
    if not isinstance(value, str) or not value or len(value.encode('utf-8')) > 200 or value in ('.', '..') or re.search(r'[\\/\x00-\x1f\x7f]', value):
        raise ValueError('잘못된 파일 이름')
    return value


def image_type(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if data.startswith(b'\xff\xd8\xff'): return 'image/jpeg'
    if data.startswith((b'GIF87a', b'GIF89a')): return 'image/gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP': return 'image/webp'
    return None


def _stored_suffix(name, mime=None):
    known = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp'}
    if mime in known:
        return known[mime]
    suffix = Path(name).suffix.lower()
    return suffix if re.fullmatch(r'\.[a-z0-9]{1,16}', suffix) else '.bin'


def _internal_dir(folder, root):
    upload_dir = folder.resolve()
    upload_dir.relative_to(Path(root).resolve())
    directory = folder / 'internal'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.resolve().relative_to(Path(root).resolve())
    return directory


class Uploads:
    def __init__(self, directory, remote=None):
        self.root = Path(directory)/'uploads'
        self.remote = remote
        self.lock = threading.RLock()

    def put(self, thread, identifier, name, data):
        uuid.UUID(thread); uuid.UUID(identifier); file_name(name)
        if not isinstance(data, bytes) or not 0 < len(data) <= MAX_FILE:
            raise ValueError("각 첨부 파일은 1바이트에서 20MB 사이여야 합니다.")
        digest = hashlib.sha256(data).hexdigest()
        with self.lock:
            folder = self.root/thread/identifier
            meta = folder.with_suffix('.json')
            if meta.exists():
                row = self.get(thread, identifier)
                if row['sha256'] != digest or row['name'] != name:
                    raise ValueError("첨부파일 ID는 다른 파일에 재사용할 수 없습니다.")
                return self.public(row)
            folder.mkdir(parents=True, exist_ok=True, mode=0o700)
            image = image_type(data)
            internal = _internal_dir(folder, self.root)
            path = internal/('original' + _stored_suffix(name, image))
            if folder.is_symlink() or internal.is_symlink():
                raise ValueError("잘못된 첨부 파일 경로")
            temporary = internal/'original.part'
            # Uploaded names never become executable commands or overwrite project files.
            with temporary.open('wb') as stream:
                stream.write(data)
            temporary.chmod(0o600)
            temporary.replace(path)
            target = str(path.resolve())
            if self.remote:
                target = self.remote(thread, identifier, name, data, digest)
            row = {'id': identifier, 'name': name, 'size': len(data), 'sha256': digest, 'createdAt': time.time(),
                   'image': image, 'path': target, 'localPath': str(path.resolve())}
            tmp_meta = meta.with_suffix('.tmp')
            tmp_meta.write_text(json.dumps(row, ensure_ascii=False), encoding='utf-8')
            tmp_meta.chmod(0o600);tmp_meta.replace(meta)
            return self.public(row)

    @staticmethod
    def public(row):
        keys = ('id', 'name', 'size', 'image', 'thumb', 'thumbWidth', 'thumbHeight')
        return {k: row[k] for k in keys if k in row}

    def set_thumb(self, thread, identifier, data, width, height):
        uuid.UUID(thread); uuid.UUID(identifier)
        if not isinstance(data, bytes) or not 0 < len(data) <= 1024 * 1024:
            raise ValueError('썸네일은 다음과 같아야 합니다. 1 바이트 1 MB')
        if not isinstance(width, int) or isinstance(width, bool) or not isinstance(height, int) or isinstance(height, bool) or not 1 <= width <= 8192 or not 1 <= height <= 8192:
            raise ValueError('썸네일 크기가 잘못되었습니다.')
        mime = image_type(data)
        if mime not in ('image/webp', 'image/jpeg', 'image/png'):
            raise ValueError('잘못된 축소판 형식')
        with self.lock:
            row = self.get(thread, identifier)
            if not row.get('image'):
                raise ValueError('이미지 첨부만 썸네일을 생성할 수 있습니다.')
            folder = self.root/thread/identifier
            extension = mime.rsplit('/', 1)[-1].replace('jpeg', 'jpg')
            internal = _internal_dir(folder, self.root)
            path = internal/('thumb.'+extension)
            if folder.is_symlink() or internal.is_symlink():
                raise ValueError('썸네일 경로가 잘못되었습니다.')
            temporary = internal/'thumb.part'
            with temporary.open('wb') as stream:
                stream.write(data)
            temporary.chmod(0o600)
            temporary.replace(path)
            row = {**row, 'thumb': mime, 'thumbPath': path.name, 'thumbMime': mime, 'thumbSize': len(data),
                   'thumbSha256': hashlib.sha256(data).hexdigest(), 'thumbWidth': width, 'thumbHeight': height}
            meta = folder.with_suffix('.json')
            temporary_meta = meta.with_suffix('.tmp')
            temporary_meta.write_text(json.dumps(row, ensure_ascii=False), encoding='utf-8')
            temporary_meta.chmod(0o600);temporary_meta.replace(meta)
            return self.public(row)

    def preview(self, thread, identifier, variant='thumb'):
        row = self.get(thread, identifier)
        if not row.get('image'):
            raise KeyError('이미지 첨부 파일이 존재하지 않습니다')
        if variant != 'original' and row.get('thumbPath'):
            name = row['thumbPath']
            path = self.root/thread/identifier/'internal'/name
            if file_name(name) == name and path.is_file() and not path.is_symlink() and path.resolve().parent == (self.root/thread/identifier/'internal').resolve():
                return {**row, 'previewPath': str(path.resolve()), 'previewMime': row['thumbMime'],
                        'previewSha256': row['thumbSha256']}, 'thumb'
        return {**row, 'previewPath': row['localPath'], 'previewMime': row['image'],
                'previewSha256': row['sha256']}, 'fallback-original' if variant != 'original' else 'original'

    def get(self, thread, identifier):
        uuid.UUID(thread);uuid.UUID(identifier)
        meta = self.root/thread/(identifier+'.json')
        try:
            row = json.loads(meta.read_text(encoding='utf-8'))
            path = Path(row['localPath'])
            folder = self.root/thread/identifier
            upload_dir = folder.resolve()
            upload_dir.relative_to(self.root.resolve())
            if any(part.is_symlink() for part in (self.root/thread, folder, folder/'internal', meta)):
                raise ValueError("잘못된 첨부 파일 경로")
            resolved = path.resolve()
            try:
                resolved.relative_to(upload_dir)
            except ValueError:
                raise ValueError("잘못된 첨부 파일 경로")
            if path.is_symlink() or not path.is_file():
                raise ValueError("첨부파일을 사용할 수 없습니다. 다시 업로드하세요.")
            return row
        except (OSError, KeyError):
            raise ValueError("첨부파일을 사용할 수 없습니다. 다시 업로드하세요.") from None

    def by_path(self, thread, paths):
        """Map exact attachment paths to metadata for safe phone previews."""
        uuid.UUID(thread)
        wanted = {str(Path(value).resolve()) for value in paths if isinstance(value, str) and value}
        rows = {}
        if not wanted:
            return rows
        folder = self.root/thread
        try:
            candidates = list(folder.glob('*.json'))
        except OSError:
            return rows
        for meta in candidates:
            try:
                row = self.get(thread, meta.stem)
            except ValueError:
                continue
            for key in ('path', 'localPath'):
                value = row.get(key)
                if isinstance(value, str) and str(Path(value).resolve()) in wanted:
                    rows[str(Path(value).resolve())] = row
        return rows

    def collect(self, retention=7 * 24 * 60 * 60, protected=(), now=None):
        """Remove old upload directories unless a pending submission still needs them."""
        now = time.time() if now is None else now
        cutoff = now - retention
        protected = set(protected)
        removed = 0
        with self.lock:
            for meta in list(self.root.glob('*/*.json')):
                thread, identifier = meta.parent.name, meta.stem
                if identifier in protected:
                    continue
                try:
                    row = json.loads(meta.read_text(encoding='utf-8'))
                    created = row.get('createdAt', meta.stat().st_mtime)
                    if not isinstance(created,(int,float)) or created > cutoff:
                        continue
                except (OSError, ValueError, json.JSONDecodeError):
                    continue
                try:
                    shutil.rmtree(self.root/thread/identifier, ignore_errors=True)
                    meta.unlink(missing_ok=True)
                    removed += 1
                except OSError:
                    continue
        return removed

    def resolve(self, thread, identifiers):
        if not isinstance(identifiers, list) or len(identifiers) > MAX_FILES or any(not isinstance(v, str) for v in identifiers) or len(set(identifiers)) != len(identifiers):
            raise ValueError("메시지당 최대 10개의 파일 첨부")
        rows = [self.get(thread, value) for value in identifiers]
        if sum(row['size'] for row in rows) > MAX_TOTAL:
            raise ValueError("첨부 파일의 총 개수는 메시지당 MB 100개 이하여야 합니다.")
        return rows
