"""Opt-in native Desktop runtime sharing; never take over an existing writer.

The original App launches the CLI adapter and owns its lifetime. A Bridge only
opens a separate connection to that same runtime for explicit metadata writes.
"""
import json
import os
import shlex
import stat
import sys
import hashlib
import subprocess
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from bridge.clients.codex.app_server import CodexAppServer, AppServerUnavailable
from bridge.resources import project_root


VERSION = 1


def directory(home):
    root = Path(home).resolve() / 'bridge-desktop-runtime'
    return root / 'records' if sys.platform == 'win32' else root


def private_directory(root):
    if sys.platform == 'win32':
        from bridge.platforms.windows import local_service
        local_service.directory(root.parent, create=True)
        return local_service.directory(root, create=True)
    root.mkdir(mode=0o700, exist_ok=True)
    info = root.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('공유 액세스 디렉터리 권한을 확인할 수 없습니다.')
    return root


def socket_path(home, generation):
    uuid.UUID(generation)
    # Darwin limits Unix socket paths to 104 bytes. Independent test homes and
    # non-ASCII home paths can exceed that before the filename is even added.
    digest = hashlib.sha256(str(Path(home).resolve()).encode()).hexdigest()[:16]
    root = Path('/tmp') / f'cmb-codex-{os.getuid()}-{digest}'
    return root / (generation + '.sock')


def _daemon_directory():
    # Matches Codex's private UDS root; TMPDIR and CODEX_HOME do not select it.
    return Path('/tmp').resolve() / f'codex-daemon-{os.geteuid()}'


def verified_socket(endpoint):
    """Verify either a private socket or Codex's exact protected-socket alias."""
    endpoint = Path(endpoint)
    parent = endpoint.parent.lstat()
    if (not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.geteuid() or
            stat.S_IMODE(parent.st_mode) != 0o700):
        raise ValueError('Shared runtime socket directory is not private')
    advertised = endpoint.lstat()
    if advertised.st_uid != os.geteuid():
        raise ValueError('Shared runtime socket owner changed')
    target = endpoint
    if stat.S_ISLNK(advertised.st_mode):
        # Canonicalize only the parent, not the final symlink. The native CLI
        # hashes these OS path bytes and creates the alias itself.
        digest = hashlib.sha256(os.fsencode(endpoint.parent.resolve() / endpoint.name)).hexdigest()
        root = _daemon_directory()
        target = root / digest
        if os.readlink(endpoint) != str(target):
            raise ValueError('Shared runtime socket alias changed')
        protected = root.lstat()
        if (not stat.S_ISDIR(protected.st_mode) or protected.st_uid != os.geteuid() or
                stat.S_IMODE(protected.st_mode) != 0o700):
            raise ValueError('Native runtime socket directory is not private')
    info = target.lstat()
    if (not stat.S_ISSOCK(info.st_mode) or info.st_uid != os.geteuid() or
            stat.S_IMODE(info.st_mode) != 0o600):
        raise ValueError('Shared runtime socket is not private')
    return (str(target), info.st_dev, info.st_ino, advertised.st_dev, advertised.st_ino)


class DesktopRuntimeBusy(ValueError):
    """Another verified lifecycle operation still owns this runtime lock."""


@contextmanager
def exclusive_lock(home, name, *, timeout=0):
    if sys.platform == 'win32':
        from bridge.platforms.windows.codex_daemon_env import _operation_lock
        root = private_directory(directory(home))
        deadline = time.monotonic() + timeout
        while True:
            with _operation_lock(root / (name + '.lock'), create=True) as acquired:
                if acquired:
                    yield
                    return
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DesktopRuntimeBusy('공유 액세스가 아직 사용 중이거나 종료되었습니다. 나중에 다시 시도해 주세요.')
            time.sleep(min(.25, remaining))
    import fcntl
    root = private_directory(directory(home))
    fd = os.open(root / (name + '.lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('공유 액세스 잠금 ID를 확인할 수 없습니다.')
        deadline = time.monotonic() + timeout
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError as exc:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise DesktopRuntimeBusy('공유 액세스가 아직 사용 중이거나 종료되었습니다. 나중에 다시 시도해 주세요.') from exc
                time.sleep(min(.25, remaining))
        yield
    finally:
        os.close(fd)


def initialization_lock(home):
    return exclusive_lock(home, 'initialize')


def _read(path):
    if sys.platform == 'win32':
        from bridge.platforms.windows.local_service import read_record
        return read_record(path)
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or
            info.st_mode & 0o077 or info.st_size > 65536):
        raise ValueError('공유 액세스 파일의 신원을 확인할 수 없습니다.')
    return json.loads(path.read_text(encoding='utf-8'))


def _write(path, value, mode=0o600):
    if sys.platform == 'win32':
        from bridge.platforms.windows.local_service import write_record
        return write_record(path, json.loads(value))
    # Same-directory atomic publication; never follow a preexisting temporary file.
    import tempfile
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=path.name + '-')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def settings(home):
    path = directory(home) / 'settings.json'
    if not path.exists() and not path.is_symlink():
        return None
    value = _read(path)
    if value.get('version') != VERSION or value.get('home') != str(Path(home).resolve()):
        raise ValueError('공유 액세스 구성이 일치하지 않습니다. 다시 초기화하세요.')
    return value


def preparation(home):
    """Caller holds initialization_lock; all gateways share this write receipt."""
    path = directory(home) / 'preparation.json'
    if not path.exists() and not path.is_symlink():
        return None
    value = _read(path)
    if (value.get('version') != VERSION or value.get('home') != str(Path(home).resolve())
            or value.get('state') not in ('pending', 'complete') or not isinstance(value.get('requestId'), str)):
        raise ValueError('기본 연결 준비 기록을 확인할 수 없습니다. 계정 관리에서 확인하세요.')
    return value


def record_preparation(home, request_id, *, complete=False):
    root = private_directory(directory(home))
    _write(root / 'preparation.json', json.dumps({'version': VERSION, 'home': str(Path(home).resolve()),
        'requestId': request_id, 'state': 'complete' if complete else 'pending'}))


def deferred_preparation(home, request_id):
    path = directory(home) / 'deferred-preparation.json'
    if not path.exists() and not path.is_symlink():
        return None
    value = _read(path)
    if (value.get('version') != VERSION or value.get('home') != str(Path(home).resolve())
            or value.get('state') not in ('waiting', 'consumed', 'cancelled')):
        raise ValueError('Invalid deferred connection receipt.')
    return value['state'] if value.get('requestId') == request_id else None


def update_deferred_preparation(home, request_id, action):
    """Use a separate lock so a cancellation can arrive during a passive idle audit."""
    with exclusive_lock(home, 'deferred-preparation', timeout=3):
        receipt = preparation(home)
        if not receipt or receipt['state'] != 'pending' or receipt['requestId'] != request_id:
            return None
        state = deferred_preparation(home, request_id)
        if action == 'schedule' and state is None:
            state = 'waiting'
        elif action in ('cancel', 'consume') and state == 'waiting':
            state = 'cancelled' if action == 'cancel' else 'consumed'
        else:
            return state if action != 'consume' else None
        root = private_directory(directory(home))
        _write(root / 'deferred-preparation.json', json.dumps({'version':VERSION, 'home':str(Path(home).resolve()),
               'requestId':request_id, 'state':state}))
        return state


def configure(home, application, cli):
    """Called only after the lifecycle owner has verified idle and normal exit."""
    if sys.platform not in ('darwin', 'linux', 'win32'):
        raise ValueError('이 시스템은 아직 검증되지 않았습니다. Codex 공유 액세스')
    # GUI exit precedes the adapter's cooperative proxy/native shutdown.
    with exclusive_lock(home, 'runtime', timeout=35):
        _configure(home, application, cli)


def wait_stopped(home, *, timeout=35):
    """Wait only during an explicit lifecycle operation; never terminate a process."""
    if not directory(home).exists():
        return
    with exclusive_lock(home, 'runtime', timeout=timeout):
        active = directory(home) / 'active.json'
        if active.exists() or active.is_symlink():
            require_inactive(_read(active))


def _configure(home, application, cli):
    root = private_directory(directory(home))
    active = root / 'active.json'
    if active.exists():
        old = _read(active)
        require_inactive(old)
        active.unlink()
    value = {'version': VERSION, 'home': str(Path(home).resolve()),
             'application': os.path.normcase(str(Path(application).resolve())), 'cli': str(Path(cli).resolve())}
    if sys.platform == 'win32':
        value.update(launcher_settings(application))
        _write(root / 'settings.json', json.dumps(value))
        return
    launcher = root / 'codex-cli'
    command = ([sys.executable] if getattr(sys, 'frozen', False) else
               [sys.executable, str(project_root() / 'desktop.py')])
    command += ['codex-desktop-runtime', '--configuration', str(root / 'settings.json'), '--']
    _write(launcher, '#!/bin/sh\nexec ' + shlex.join(command) + ' "$@"\n', 0o700)
    _write(root / 'settings.json', json.dumps(value))


def launcher_settings(application):
    """Check Windows launch prerequisites before quitting the original App."""
    if sys.platform != 'win32':
        return {}
    if not getattr(sys, 'frozen', False):
        raise ValueError('컴파일된 게이트웨이를 사용하세요 App 초기화 Windows 기본 연결')
    from bridge.platforms.windows.discovery_ext import application_user_model_id, application_execution_alias
    identity = application_user_model_id(application)
    packaged = any((parent / 'AppxManifest.xml').is_file() for parent in Path(application).parents)
    if packaged and not identity:
        raise ValueError('확인할 수 없습니다 Codex 패키지 ID 기본 연결 설정이 변경되지 않았습니다.')
    if packaged and application_execution_alias(application) is None:
        raise ValueError('확인할 수 없습니다 Codex 앱 실행 별칭 기본 연결 설정이 아직 변경되지 않았습니다')
    return {'launcher': str(Path(sys.executable).resolve()), 'sandboxFamily': identity.split('!')[0]}


def validate_runtime(cli):
    """Read native capabilities before any App exit; no model or daemon starts."""
    try:
        for arguments, required in ((['app-server', '--help'], 'unix://'),
                                    (['app-server', 'proxy', '--help'], '--sock')):
            options = {'creationflags': subprocess.CREATE_NO_WINDOW} if sys.platform == 'win32' else {}
            result = subprocess.run([str(cli), *arguments], stdin=subprocess.DEVNULL,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    text=True, timeout=10, check=True, **options)
            if required not in result.stdout:
                raise ValueError('이 Codex 해당 버전은 공유 액세스를 지원하지 않습니다. 먼저 원본 버전을 업데이트하세요. App')
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValueError('확인할 수 없습니다 Codex 공유 액세스 기능 원래의 App 변함없이 남아있다') from exc


def launch_environment(home, application):
    value = settings(home) if sys.platform in ('darwin', 'linux', 'win32') else None
    if value is None:
        return {}
    if value['application'] != os.path.normcase(str(Path(application).resolve())):
        raise ValueError('Codex 프로그램이 변경되었습니다. 공유 액세스를 다시 초기화하세요.')
    if sys.platform == 'win32':
        launcher = Path(value['launcher'])
        if not launcher.is_file() or launcher.resolve() != Path(sys.executable).resolve():
            raise ValueError('게이트웨이 프로그램이 변경되었습니다. 다시 초기화해 주세요. Codex 기본 연결')
        return {'CODEX_CLI_PATH': str(launcher), 'CMB_CODEX_DESKTOP_CONFIGURATION': str(directory(home) / 'settings.json'),
                'CODEX_APP_SERVER_WS_URL': '', 'CODEX_APP_SERVER_FORCE_CLI': '0'}
    launcher = directory(home) / 'codex-cli'
    info = launcher.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('공유 액세스 개시자의 신원을 확인할 수 없습니다.')
    return {'CODEX_CLI_PATH': str(launcher), 'CODEX_APP_SERVER_WS_URL': '',
            'CODEX_APP_SERVER_FORCE_CLI': '0'}


def process_identity(pid):
    # Keep the protocol independent of the platform identity implementation.
    if sys.platform == 'win32':
        from bridge.platforms.windows.zcode_pipe import _identity
        return _identity(pid, parent=True)
    if sys.platform == 'linux':
        from bridge.platforms.linux.codex_daemon_env import desktop_process_identity
        value = desktop_process_identity(pid)
    else:
        from bridge.platforms.macos.force_exit import Native
        value = Native().identity(pid)
    if value['uid'] != os.getuid() or value['ruid'] != os.getuid() or value['zombie']:
        raise ValueError('공유 런타임 프로세스 ID를 확인할 수 없습니다.')
    return {key: (list(item) if isinstance(item, tuple) else item) for key, item in value.items()}


def runtime_alive(identity):
    if sys.platform == 'win32':
        from bridge.platforms.windows.codex_daemon_env import recorded_process_absent
        # A terminated Windows process can retain a PID/handle while image
        # queries already fail. The recorded birth and wait state prove exit.
        if recorded_process_absent(identity['pid'], {'processStartTime': str(identity['created'])}):
            return False
    try:
        current = process_identity(identity['pid'])
    except ProcessLookupError:
        return False
    # 어댑터가 먼저 종료되어 자식의 부모 PID가 바뀌어도 원래 writer는 계속 살아 있을 수 있다.
    if sys.platform == 'linux':
        keys = ('pid', 'bootId', 'startTicks', 'image', 'uid', 'ruid')
    else:
        keys = ('pid', 'created', 'session', 'image') if sys.platform == 'win32' else ('pid', 'birth', 'started', 'image', 'uid', 'ruid')
    return all(current[key] == identity[key] for key in keys)


def require_inactive(record):
    """A failed launch is not permission to create an untracked second writer."""
    identity = record.get('runtime')
    if not identity:
        raise ValueError('원래 공유 런타임 시작 결과를 확인해야 합니다. 컴퓨터에서 확인하시기 바랍니다. 반복적으로 시작되지 않습니다.')
    if record.get('ready') is True or sys.platform == 'win32':
        alive = runtime_alive(identity)
    else:
        try:
            current = process_identity(identity['pid'])
        except ProcessLookupError:
            alive = False
        else:
            # A native shell launcher may exec its bundled binary before the
            # handshake; the process generation remains the same across exec.
            if sys.platform == 'linux':
                # Linux의 부팅 ID와 start_ticks는 exec 및 재부모화 후에도 유지된다.
                alive = all(current[key] == identity[key]
                            for key in ('pid', 'bootId', 'startTicks', 'uid', 'ruid'))
            else:
                alive = (current['birth'][0] == identity['birth'][0] and
                         all(current[key] == identity[key]
                             for key in ('pid', 'started', 'uid', 'ruid')))
    if alive:
        raise ValueError('원래 공유 런타임이 종료되지 않았습니다. 나중에 다시 확인하세요.')


def _verify_shared_processes(record):
    for kind in ('app', 'adapter', 'runtime'):
        saved = record[kind]
        current = process_identity(saved['pid'])
        # Linux reparents the desktop app to init when its Bridge launcher exits.
        # The adapter and runtime must still have their original direct parents.
        if sys.platform == 'linux' and kind == 'app' and current.get('parent') == 1:
            current = {**current, 'parent': saved['parent']}
        if current != saved:
            raise ValueError('Shared runtime generation changed')


def connect(home, cli):
    """None means never configured; configured but unavailable must fail closed."""
    try:
        value = settings(home) if sys.platform in ('darwin', 'linux', 'win32') else None
        if value is None:
            return None
        record = _read(directory(home) / 'active.json')
        if (record.get('version') != VERSION or record.get('ready') is not True or
                record.get('home') != value['home'] or
                record.get('cli') != value['cli'] or value['cli'] != str(Path(cli).resolve()) or
                record['app']['image'] != value['application'] or
                record['adapter']['parent'] != record['app']['pid'] or
                record['runtime']['parent'] != record['adapter']['pid']):
            raise ValueError('Shared runtime owner mismatch')
        _verify_shared_processes(record)
        if sys.platform == 'win32':
            from bridge.clients.codex.desktop_runtime_windows import MetadataClient
            client = MetadataClient(directory(home), record)
            client.connect()
            return client
        expected = socket_path(home, record['generation'])
        if record['socket'] != str(expected):
            raise ValueError('Shared runtime socket mismatch')
        endpoint_identity = verified_socket(expected)
        client = CodexAppServer(expected, cli=value['cli'])
        try:
            result = client.connect()
            if Path(result['codexHome']).resolve() != Path(home).resolve():
                raise ValueError('Shared runtime configuration changed')
            _verify_shared_processes(record)
            if verified_socket(expected) != endpoint_identity:
                raise ValueError('Shared runtime socket changed during handshake')
            client.desktop_generation = record['generation']
            def verify_owner():
                try:
                    if (settings(home) != value or _read(directory(home) / 'active.json') != record
                            or verified_socket(expected) != endpoint_identity):
                        raise ValueError('Desktop endpoint changed')
                    _verify_shared_processes(record)
                except (OSError, KeyError, ValueError, TypeError) as exc:
                    raise AppServerUnavailable('원래 데스크톱 연결이 변경되었습니다.') from exc
            client.verify_desktop_owner = verify_owner
            return client
        except Exception:
            client.close()
            raise
    except (OSError, KeyError, TypeError, ValueError, AppServerUnavailable) as exc:
        raise AppServerUnavailable('Codex 기본 공유 연결이 아직 준비되지 않았습니다. 계정 관리에서 자동 준비 상태를 확인할 수 있습니다. 다시 실행할 때 쓰기가 다시 시도되지 않습니다.') from exc


def server_arguments(arguments, socket_path):
    """Select only the Desktop stdio server, preserving every native override."""
    args = list(arguments)
    i = 0
    while i < len(args):
        token = args[i]
        if token in ('-c', '--config') and i + 1 < len(args):
            i += 2
        elif token.startswith('--config='):
            i += 1
        else:
            break
    if i == len(args) or args[i] != 'app-server':
        return None
    result = args[:i + 1]
    i += 1
    while i < len(args):
        token = args[i]
        if token in ('-c', '--config') and i + 1 < len(args):
            result.extend(args[i:i + 2]); i += 2
        elif token.startswith('--config=') or token == '--analytics-default-enabled':
            result.append(token); i += 1
        elif token == '--stdio':
            i += 1
        elif token == '--listen' and i + 1 < len(args) and args[i + 1] == 'stdio://':
            i += 2
        elif token == '--listen=stdio://':
            i += 1
        else:
            return None  # One-shot, proxy, auxiliary or newer unknown invocation.
    return [*result, '--listen', 'unix://' + str(socket_path)]
