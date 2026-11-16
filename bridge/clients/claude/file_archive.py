"""Byte-preserving local transcript archive; standalone for selected remote workers."""
import hashlib
import json
import os
import subprocess
import sys
import shutil
import re
import shlex
import threading
from collections import OrderedDict
from functools import lru_cache
import uuid
import tempfile
from pathlib import Path

# Populated only after native picker hide/restore acceptance for an exact version.
VERIFIED_PICKER_VERSIONS = {
    ('darwin', '2.1.292'): '97a01e5bc74a199e67189435d0331ea3a24eac2e07db4b76d9148c5b0386138f',
    ('linux', '2.1.308'): '356733f185fa988e6bf3aa9a555269fdd167982a2e2a80d3c8a78037bb92ad58',
}
_verified_versions = OrderedDict()
_version_lock = threading.Lock()


def _binary_stamp(path):
    stamp = path.stat()
    return (stamp.st_dev, stamp.st_ino, stamp.st_size, stamp.st_mtime_ns, stamp.st_ctime_ns)


def supported(binary, environment):
    if not any(platform == sys.platform for platform, version in VERIFIED_PICKER_VERSIONS):
        return False
    try:
        path = Path(binary).resolve(strict=True)
        stamp = _binary_stamp(path)
        digest = _binary_hash(str(path), *stamp)
        if not any(platform == sys.platform and expected == digest
                   for (platform, version), expected in VERIFIED_PICKER_VERSIONS.items()):
            return False
        # Only a successful exact-binary proof is reusable. Auth, process/task
        # ownership and archive guards are still checked afresh by the caller.
        key = (sys.platform, str(path), *stamp, digest)
        with _version_lock:
            version = _verified_versions.get(key)
            if version is not None:
                return _binary_stamp(path) == stamp and VERIFIED_PICKER_VERSIONS.get((sys.platform, version)) == digest
            result = subprocess.run([str(path), '--version'], env=environment, capture_output=True,
                                    text=True, timeout=5)
            version = result.stdout.split()[0]
            if result.returncode or VERIFIED_PICKER_VERSIONS.get((sys.platform, version)) != digest or _binary_stamp(path) != stamp:
                return False
            _verified_versions[key] = version
            if len(_verified_versions) > 8:
                _verified_versions.popitem(last=False)
            return True
    except (OSError, subprocess.SubprocessError, IndexError, ValueError):
        return False


@lru_cache(maxsize=8)
def _binary_hash(path, device, inode, size, modified, changed):
    digest = hashlib.sha256()
    with open(path, 'rb') as source:
        for block in iter(lambda: source.read(1024*1024), b''):
            digest.update(block)
    if _binary_stamp(Path(path)) != (device, inode, size, modified, changed):
        raise ValueError('Claude 검증 중 기본 프로그램 변경 사항')
    return digest.hexdigest()


def _linux_executable(pid, uid, namespace):
    """Read the actual executable with same-UID/namespace/generation evidence."""
    process = Path('/proc')/str(pid)
    def proof():
        if process.stat().st_uid != uid or os.readlink(process/'ns/pid') != namespace:
            raise ValueError('Claude 프로세스 소유권 또는 PID 네임스페이스가 변경되었습니다.')
        value = (process/'stat').read_text()
        fields = value.rpartition(')')[2].split()
        if not value.startswith(str(pid)+' (') or len(fields) < 20 or not fields[19].isdigit():
            raise ValueError('Claude 프로세스 세대를 확인할 수 없습니다.')
        return fields[19]
    try:
        before = proof()
        executable = os.readlink(process/'exe')
        if proof() != before:
            raise ValueError('Claude 프로세스 세대가 변경되었습니다.')
        return executable.removesuffix(' (deleted)')
    except FileNotFoundError:
        # A missing exe can also mean an exited main thread with live workers.
        # Only a vanished process directory proves there is no current writer.
        try:
            process.stat()
        except FileNotFoundError:
            return None
        except OSError as error:
            raise ValueError('확인할 수 없습니다 Claude 프로세스 실행 파일') from error
        raise ValueError('확인할 수 없습니다 Claude 프로세스 실행 파일') from None
    except OSError as error:
        raise ValueError('확인할 수 없습니다 Claude 프로세스 실행 파일') from error


def assert_no_cli(binary):
    """Fresh process identity census; no environment or conversation reads."""
    if sys.platform not in ('darwin', 'linux'):
        raise ValueError('현재 시스템 Claude 기본 프로세스 매니페스트가 확인되지 않았습니다.')
    namespace = None
    if sys.platform == 'linux':
        try: namespace = os.readlink('/proc/self/ns/pid')
        except OSError as error: raise ValueError('확인할 수 없습니다 Claude PID 네임스페이스') from error
        if not re.fullmatch(r'pid:\[\d+\]', namespace):
            raise ValueError('확인할 수 없습니다 Claude PID 네임스페이스')
    result = subprocess.run(['ps', '-axo', 'uid=,pid=,comm='], capture_output=True,
                            text=True, timeout=5)
    if result.returncode:
        raise ValueError('확인할 수 없습니다 Claude 기본 프로세스 목록')
    for line in result.stdout.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) != 3 or not parts[0].isdigit() or not parts[1].isdigit():
            raise ValueError('Claude 기본 프로세스 목록이 불완전합니다.')
        if int(parts[0]) != os.getuid():continue
        pid, executable = int(parts[1]), parts[2]
        if sys.platform == 'linux':
            comm = Path(executable).name
            if comm in ('claude', 'claude.exe', 'claude-code'):
                raise ValueError('아직있다 Claude CLI 프로세스가 실행 중입니다. 먼저 원래 터미널에서 종료해 주세요.')
            candidate = (comm == Path(binary).name[:15] or comm in ('node', 'nodejs', 'bun')
                         or re.fullmatch(r'\d+\.\d+\.\d+(?:[-+].*)?', comm))
            if not candidate: continue
            executable = _linux_executable(pid, os.getuid(), namespace)
            if executable is None: continue
        name = Path(executable).name
        if (name in ('claude', 'claude.exe', 'claude-code')
                or '@anthropic-ai/claude-code/' in executable
                or re.search(r'/(?:\.local/share/claude/versions/[^/]+|Caskroom/claude-code/[^/]+(?:/[^/]+)?)$', executable)
                or str(Path(executable).resolve()) == str(Path(binary).resolve())):
            raise ValueError('아직있다 Claude CLI 프로세스가 실행 중입니다. 먼저 원래 터미널에서 종료해 주세요.')
        if name not in ('node', 'nodejs', 'bun'):continue
        # Inspect the entry-script operand only; never log the argument vector,
        # parse a prompt operand, or inspect process environments.
        command = subprocess.run(['ps', '-p', str(pid), '-o', 'args='],
                                 capture_output=True, text=True, timeout=3)
        if command.returncode or not command.stdout.strip():
            raise ValueError('확인할 수 없습니다 Claude 스크립트 프로세스 ID')
        lexer = shlex.shlex(command.stdout, posix=True)
        lexer.whitespace_split = True;lexer.commenters = ''
        next(lexer, None)
        for token in lexer:
            if token in ('-e', '--eval', '-p', '--print'):break
            if token in ('-r', '--require', '--import', '--loader'):
                next(lexer, None);continue
            if token.startswith('-'):continue
            normalized = token.replace('\\', '/')
            if ('@anthropic-ai/claude-code/' in normalized
                    or '/claude-code/' in normalized
                    or Path(normalized).name in ('claude', 'claude.js', 'claude.cjs', 'claude.mjs')):
                raise ValueError('아직있다 Claude CLI 스크립트 프로세스가 실행 중입니다. 먼저 원래 터미널에서 종료해 주세요.')
            break


@lru_cache(maxsize=1)
def _domain():
    if sys.platform == 'linux':
        machine = Path('/etc/machine-id').read_text().strip()
        if not re.fullmatch(r'[0-9a-fA-F]{32}', machine):
            raise ValueError('Claude 아카이브 호스트 ID를 확인할 수 없습니다.')
        return 'linux:'+machine
    if sys.platform == 'darwin':
        result = subprocess.run(['/usr/sbin/ioreg', '-rd1', '-c', 'IOPlatformExpertDevice'],
                                capture_output=True, text=True, timeout=5)
        match = re.search(r'"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]+)"', result.stdout)
        if result.returncode or not match:
            raise ValueError('Claude 아카이브 호스트 ID를 확인할 수 없습니다.')
        return 'darwin:'+hashlib.sha256(match[1].encode()).hexdigest()
    raise ValueError('현재 시스템 Claude 파일 아카이브가 확인되지 않음')


def _identity(directory):
    directory = Path(directory)
    stat = directory.stat()
    return {'configDir': str(directory.resolve()), 'uid': os.getuid() if hasattr(os, 'getuid') else None,
            'device': stat.st_dev, 'inode': stat.st_ino, 'domain': _domain()}


def _root(directory):
    directory = Path(directory)
    root = directory/'bridge-archives'
    _owned(directory)
    if root.exists():
        _owned(root)
        if root.stat().st_dev != directory.stat().st_dev:
            raise ValueError('Claude 아카이브는 원래 구성 파일 시스템에 있어야 합니다.')
    if directory.is_symlink() or root.is_symlink():
        raise ValueError('Claude 아카이브 경로를 확인할 수 없습니다.')
    return root


def _owned(path):
    if path.is_symlink() or (hasattr(os, 'getuid') and path.stat().st_uid != os.getuid()):
        raise ValueError('Claude 아카이브 파일 속성을 확인할 수 없습니다.')


def _regular_file(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Claude 아카이브를 확인할 수 없습니다.')
    _owned(path)


def _digest(path):
    _regular_file(path)
    value = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024*1024), b''):
            value.update(block)
    return value.hexdigest()


def _sync_directory(path):
    if os.name != 'nt':
        handle = os.open(path, os.O_RDONLY)
        try:os.fsync(handle)
        finally:os.close(handle)


def _write(path, value):
    descriptor, temporary = tempfile.mkstemp(prefix='.manifest-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as target:
            json.dump(value, target, ensure_ascii=False)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
        _sync_directory(path.parent)
    finally:
        try:os.unlink(temporary)
        except FileNotFoundError:pass


def _manifest(directory, native):
    native = str(uuid.UUID(native))
    bundle = _root(directory)/native
    if bundle.is_symlink():
        raise ValueError('Claude 아카이브 디렉터리를 확인할 수 없습니다.')
    if bundle.exists():_owned(bundle)
    path = bundle/'manifest.json'
    if not path.exists():
        return bundle, None
    if path.exists():_owned(path)
    if path.is_symlink():
        raise ValueError('Claude 보관된 기록은 확인할 수 없습니다.')
    value = json.loads(path.read_text(encoding='utf-8'))
    if (value.get('schema') != 1 or value.get('nativeId') != native
            or value.get('identity') != _identity(directory)
            or not isinstance(value.get('project'), str)
            or value['project'] in ('', '.', '..')
            or '/' in value['project'] or '\\' in value['project']):
        raise ValueError('Claude 보관된 기록은 확인할 수 없습니다.')
    return bundle, value


def _original(directory, project, native):
    projects = Path(directory)/'projects'
    target = projects/project
    if projects.is_symlink() or target.is_symlink() or not target.is_dir():
        raise ValueError('Claude 원래 프로젝트 경로를 확인할 수 없습니다.')
    _owned(projects);_owned(target)
    if target.stat().st_dev != Path(directory).stat().st_dev:
        raise ValueError('Claude 세션과 아카이브는 동일한 파일 시스템에 있어야 합니다.')
    return target/(native+'.jsonl')


def archive_paths(directory, errors=None):
    if not Path(directory).exists() and not Path(directory).is_symlink():
        return []
    root = _root(directory)
    if not root.exists():
        return []
    result = []
    for bundle in root.iterdir():
        if not bundle.is_dir() or bundle.name.startswith('.'):
            continue
        try:
            native = str(uuid.UUID(bundle.name))
        except ValueError:
            continue
        try:
            bundle, manifest = _manifest(directory, native)
            if manifest and manifest.get('phase') != 'restored':
                state(directory, bundle/(native+'.jsonl'), native)
                result.append(bundle/(native+'.jsonl'))
        except (OSError, ValueError, TypeError, KeyError):
            if errors is None:raise
            errors.append({'nativeId': native, 'notice': 'Claude Code 검토를 위해 보관됨'})
    return result


def state(directory, path, native, *, verify=False):
    bundle, manifest = _manifest(directory, native)
    if not manifest:
        original = _original(directory, Path(path).parent.name, native)
        if Path(path) != original:
            raise ValueError('Claude 원래 세션 경로를 확인할 수 없습니다.')
        _regular_file(original)
        return {'archived': False}
    original = _original(directory, manifest['project'], native)
    archived = bundle/(native+'.jsonl')
    phase = manifest.get('phase')
    if phase not in ('archived', 'restored'):
        raise ValueError('Claude 파일 보관 트랜잭션이 중단되었습니다. 컴퓨터에서 확인하십시오. 자동으로 재생되지는 않습니다.')
    expected, absent = (archived, original) if phase == 'archived' else (original, archived)
    if (absent.exists() or absent.is_symlink()
            or (verify and phase == 'archived' and _digest(expected) != manifest['sha256'])):
        raise ValueError('Claude 아카이브 파일이 충돌하거나 변경되었습니다. 컴퓨터에서 확인해주세요.')
    _regular_file(expected)
    return {'archived': phase == 'archived'}


def _private_files(root):
    if not root.exists() and not root.is_symlink():return []
    _owned(root)
    if not root.is_dir():raise ValueError('Claude 세션 첨부 디렉터리를 확인할 수 없습니다.')
    result = []
    for path in root.rglob('*'):
        _owned(path)
        if path.is_file():result.append(path)
        elif not path.is_dir():raise ValueError('Claude 세션 첨부를 확인할 수 없습니다.')
    return result


def _snapshot(directory, original, bundle, native):
    destination = bundle/'sidecars'
    if destination.exists():
        _private_files(destination)
        shutil.rmtree(destination)
    roots = [original.parent/native, Path(directory)/'file-history'/native]
    # Validate the complete trees before creating any copy.
    for root in roots:
        if root.parent.exists() or root.parent.is_symlink():_owned(root.parent)
    files = [(root, _private_files(root)) for root in roots]
    inventory = {}
    for index, (root, items) in enumerate(files):
        for source in items:
            target = destination/str(index)/source.relative_to(root)
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            shutil.copy2(source, target, follow_symlinks=False)
            with target.open('rb') as copied:os.fsync(copied.fileno())
            parent = target.parent
            while parent != bundle:
                _sync_directory(parent);parent = parent.parent
            inventory[str(target.relative_to(destination))] = _digest(target)
            if _digest(source) != _digest(target):
                raise ValueError('Claude 백업 중에 첨부 파일이 변경되었습니다.')
    return inventory


def _restore_snapshots(directory, original, bundle, native, manifest):
    snapshot = bundle/'sidecars'
    actual = {str(path.relative_to(snapshot)): _digest(path) for path in _private_files(snapshot)}
    if actual != manifest.get('sidecars', {}):
        raise ValueError('Claude 사이드 파일 백업이 변경되었습니다.')
    roots = [original.parent/native, Path(directory)/'file-history'/native]
    missing = []
    for index, root in enumerate(roots):
        backup = bundle/'sidecars'/str(index)
        for source in _private_files(backup):
            target = root/source.relative_to(backup)
            parent = target.parent
            while parent != Path(directory):
                if parent.exists() or parent.is_symlink():_owned(parent)
                parent = parent.parent
            if target.exists() or target.is_symlink():
                if _digest(target) != _digest(source):
                    raise ValueError('Claude 첨부 파일이 충돌하여 복구 시 덮어쓰지 않습니다.')
            else:missing.append((source,target))
    for source,target in missing:
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Independent copy: later native edits must not mutate the backup inode.
        with source.open('rb') as reader, target.open('xb') as writer:
            shutil.copyfileobj(reader, writer);writer.flush();os.fsync(writer.fileno())
        shutil.copystat(source,target,follow_symlinks=False)


def change(directory, path, native, archived):
    """Caller must freshly verify the exact profile and stopped native writer."""
    if type(archived) is not bool:
        raise ValueError('Claude 잘못된 보관 설정')
    native = str(uuid.UUID(native))
    directory = Path(directory)
    root = _root(directory)
    root.mkdir(mode=0o700, exist_ok=True)
    lock = root/'.transaction'
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError as exc:
        raise ValueError('Claude 파일 보관 거래가 확인 대기 중이므로 자동으로 재생되지 않습니다.') from exc
    try:
        before = state(directory, path, native, verify=True)
        if before['archived'] == archived:
            return before
        bundle, manifest = _manifest(directory, native)
        if manifest is None:
            original = _original(directory, Path(path).parent.name, native)
            bundle.mkdir(mode=0o700)
            manifest = {'schema': 1, 'nativeId': native, 'project': original.parent.name,
                        'identity': _identity(directory),
                        'sha256': _digest(original)}
        original = _original(directory, manifest['project'], native)
        stored = bundle/(native+'.jsonl')
        source, target = (original, stored) if archived else (stored, original)
        if archived:
            if source.stat().st_nlink != 1:
                raise ValueError('Claude 세션에 이미 공유 하드 링크가 있으므로 보관할 수 없습니다.')
            manifest['sha256'] = _digest(source)
            manifest['sidecars'] = _snapshot(directory, original, bundle, native)
        else:
            _restore_snapshots(directory, original, bundle, native, manifest)
        previous = 'restored' if archived else 'archived'
        manifest['phase'] = 'preparing'
        _write(bundle/'manifest.json', manifest)
        linked = False
        try:
            # link refuses existing destinations atomically; same filesystem only.
            with source.open('rb') as original_file:os.fsync(original_file.fileno())
            os.link(source, target, follow_symlinks=False)
            linked = True
            if _digest(target) != manifest['sha256'] or _digest(source) != manifest['sha256']:
                raise ValueError('Claude 보관처리 중에 세션이 변경되었습니다.')
            source.unlink()
            _sync_directory(source.parent);_sync_directory(target.parent)
            manifest['phase'] = 'archived' if archived else 'restored'
            _write(bundle/'manifest.json', manifest)
        except Exception:
            if linked and source.exists() and target.exists() and _digest(source) == _digest(target):
                target.unlink()
                manifest['phase'] = previous
                _write(bundle/'manifest.json', manifest)
            raise
        return state(directory, target, native, verify=True)
    finally:
        lock.rmdir()
