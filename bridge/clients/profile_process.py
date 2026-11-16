"""Select a native profile before attaching or changing its process lifecycle."""
import json
import os
from pathlib import Path
import re
import sys
import time

from bridge.clients.profiles import launch_parameters
from bridge.features.auth.auth import replace_session_file


def _path_argument(command, option, path):
    # ps does not preserve argv quoting. Match the complete known path, never
    # a prefix of another instance (including paths containing spaces).
    flags = re.IGNORECASE if os.name == 'nt' else 0
    return bool(re.search(r'(?:^|\s)["\']?' + re.escape(option) + r'(?:=|\s+)["\']?' +
        re.escape(str(path)) + r'["\']?(?=$|\s+--|\s+["\']?--)', command, flags))


def scope_processes(descriptor, pids, commands):
    """Separate same-executable processes by native argv and parentage.

    An explicit profile never inherits an unlabelled main process. The default
    entry excludes every explicit foreign profile, registered or otherwise.
    """
    profile = descriptor.get('nativeProfile')
    if not profile and not descriptor.get('excludeProfiles'):
        return pids, commands
    from bridge.clients.deepseek.recovery import _identities
    identities = _identities(pids)
    selected, excluded, children = set(), set(), set()
    expected = profile.roots['userData'] if profile else Path(descriptor['dataDirectory'])
    for pid in pids:
        command = commands.get(pid, '')
        if not command:
            selected.add(pid)  # Unknown identity blocks lifecycle operations.
        elif re.search(r'(?:^|\s)--type(?:=|\s)', command):
            children.add(pid)
        elif 'dsh-desktop-host' in command:
            home = profile.roots['runtimeHome'] if profile else Path(descriptor['dataDirectory'])
            flags = re.IGNORECASE if os.name == 'nt' else 0
            target = re.search(r'(?:^|[\s"\'])'+re.escape(str(home/'profiles/desktop'))+r'(?:$|[\s"\'])', command, flags)
            (selected if target else excluded).add(pid)
        elif _path_argument(command, '--user-data-dir', expected):
            selected.add(pid)
        elif re.search(r'(?:^|\s)["\']?--(?:user-data-dir|profile)(?:=|\s)', command):
            excluded.add(pid)
        else:
            (excluded if profile else selected).add(pid)
    pending = set(children)
    while pending:
        moved = set()
        for pid in pending:
            parent = identities.get(pid, {}).get('parent')
            if parent in selected:
                selected.add(pid); moved.add(pid)
            elif parent in excluded:
                excluded.add(pid); moved.add(pid)
        if not moved:
            break
        pending -= moved
    # An orphan utility could still own this profile. Keep it unknown rather
    # than treating the profile as stopped and starting a competing Host.
    selected.update(pending)
    return [pid for pid in pids if pid in selected], {
        pid: commands[pid] for pid in selected if pid in commands and pid not in pending}


def _identity(descriptor, pid):
    from bridge.clients.deepseek.recovery import _identities
    from bridge.clients.desktop_app import DesktopApp
    from bridge.clients.lifecycle import _commands
    app = DesktopApp(descriptor['executable'], descriptor['dataDirectory'])
    if pid not in app.processes():
        raise ValueError('독립 클라이언트 프로세스가 변경되었습니다. 다시 연결해 주세요.')
    identity = _identities([pid]).get(pid)
    command = _commands(app, [pid]).get(pid)
    profile = descriptor['nativeProfile']
    if not identity or not command or not _path_argument(command, '--user-data-dir', profile.roots['userData']):
        raise ValueError('독립 실행형 클라이언트의 구성 디렉터리를 확인할 수 없습니다.')
    if sys.platform == 'darwin':
        from bridge.platforms.macos.force_exit import Native
        native = Native().identity(pid)
        if native['image'] != str(app.executable) or native['uid'] != os.getuid() or native['zombie']:
            raise ValueError('독립형 클라이언트 프로세스 ID가 변경되었습니다.')
        identity = {'parent': native['parent'], 'birth': list(native['birth']), 'started': list(native['started'])}
    return {'pid': pid, 'identity': identity, 'command': command,
            'executable': str(app.executable), 'home': str(profile.home)}


def require_owned(descriptor, state, *, allow_native_relaunch=False, cancelled=None):
    if not descriptor.get('nativeProfile'):
        return
    guard = descriptor.get('profileGuard')
    if guard:
        guard()
    if not state['running']:
        return
    if state.get('unknown') or len(state.get('mainPids', [])) != 1:
        raise ValueError('이 독립 실행형 구성에 대한 유일한 기본 프로세스를 확인할 수 없습니다.')
    try:
        saved = json.loads(Path(descriptor['profileLaunchReceipt']).read_text())
    except (OSError, ValueError, KeyError):
        raise ValueError('이 독립적인 구성은 게이트웨이에 의해 시작되지 않습니다. 구성을 정상적으로 종료하고 게이트웨이에서 시작하십시오.') from None
    current = _identity(descriptor, state['mainPids'][0])
    if saved != current:
        if allow_native_relaunch and sys.platform == 'darwin' and descriptor['nativeProfile'].family == 'claude':
            _recover_relaunch(descriptor, saved, current, cancelled=cancelled)
        else:
            raise ValueError('독립 클라이언트 시작 ID가 변경되었습니다. 구성을 정상적으로 종료한 다음 게이트웨이에서 시작하십시오.')


def _recover_relaunch(descriptor, saved, current, *, cancelled=None):
    """An explicit reconnect may follow the original App's own restart."""
    from bridge.clients.lifecycle import inspect_client
    from bridge.platforms.macos.desktop import verify_relaunch
    changed = '다시 시작한 후에는 독립 클라이언트의 ID를 확인할 수 없습니다. 구성을 확인하고 다시 연결하십시오.'
    profile = descriptor['nativeProfile']
    if (not isinstance(saved, dict) or type(saved.get('pid')) is not int or saved['pid'] <= 0
            or saved.get('executable') != current['executable'] or saved.get('home') != current['home']
            or not isinstance(saved.get('command'), str)
            or not _path_argument(saved['command'], '--user-data-dir', profile.roots['userData'])
            or not callable(descriptor.get('profileGuard'))):
        raise ValueError(changed)
    if cancelled is not None and cancelled.is_set():
        raise ValueError('클라이언트 연결이 취소되었습니다.')
    verify_relaunch(Path(current['executable']), saved, current, launch_parameters(profile)['environment'])
    # Never consume a stale display snapshot or overwrite a newer reconnect.
    descriptor['profileGuard']()
    fresh = inspect_client(descriptor)
    path = Path(descriptor['profileLaunchReceipt'])
    if (fresh.get('unknown') or fresh.get('mainPids') != [current['pid']]
            or _identity(descriptor, current['pid']) != current
            or json.loads(path.read_text()) != saved):
        raise ValueError(changed)
    if cancelled is not None and cancelled.is_set():
        raise ValueError('클라이언트 연결이 취소되었습니다.')
    replace_session_file(path, json.dumps(current).encode())


def launch_profile(descriptor, *, cancelled=None, allow_native_relaunch=False):
    from bridge.clients.lifecycle import inspect_client
    from bridge.platforms import desktop
    profile = descriptor['nativeProfile']
    if descriptor.get('profileGuard'):
        descriptor['profileGuard']()
    state = inspect_client(descriptor)
    if state['running']:
        require_owned(descriptor, state, allow_native_relaunch=allow_native_relaunch, cancelled=cancelled)
        return {'running': True, 'launched': False}
    params = launch_parameters(profile)
    if cancelled is not None and cancelled.is_set():
        raise ValueError('클라이언트 시작이 취소되었습니다.')
    desktop(sys.platform).start(Path(descriptor['executable']), profile.home,
        params['environment'], arguments=params['arguments'], new_instance=True,
        environment_unset=params['environmentUnset'])
    deadline = time.monotonic() + 20
    while True:
        if cancelled is not None and cancelled.is_set():
            raise ValueError('클라이언트 시작이 취소되었습니다.')
        state = inspect_client(descriptor)
        if state['running']:
            if state.get('unknown') or len(state.get('mainPids', [])) != 1:
                raise ValueError('독립 실행형 클라이언트가 시작된 후 고유한 기본 프로세스를 확인할 수 없습니다.')
            proof = _identity(descriptor, state['mainPids'][0])
            path = Path(descriptor['profileLaunchReceipt'])
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            replace_session_file(path, json.dumps(proof).encode())
            require_owned(descriptor, state)
            if descriptor.get('profileInitialized'):
                descriptor['profileInitialized']()
            return {'running': True, 'launched': True}
        if time.monotonic() >= deadline:
            return {'running': False, 'launched': True}
        time.sleep(.2)
