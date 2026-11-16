"""Normal exit and restart of one verified Antigravity GUI, never by name."""
import os
from pathlib import Path
import signal
import sys
import time

from bridge.platforms import desktop
from bridge.platforms.antigravity import _identity, _file_identity, _candidates, _flag, installation, login_processes


CHANGED = 'Antigravity 프로세스 또는 설치가 변경되었으며 계정이 전환되지 않았습니다. 다시 확인해 주세요.'
UNSCOPED = '먼저 독립 실행형을 정상적으로 종료하십시오. Antigravity CLI、다른 인스턴스 또는 사용자 정의 포털을 사용한 후 계정 전환'


def identity(pid):
    if sys.platform == 'win32':
        from bridge.platforms.windows.zcode_pipe import _identity as windows_identity
        return windows_identity(pid, parent=True)
    return _identity(pid)


def prepare(descriptor):
    """All shared-login writers must belong to a single discovered GUI tree."""
    pids = login_processes()
    if not pids:
        return None
    rows = {pid: identity(pid) for pid in pids}
    candidates = []
    for configured in descriptor.get('installations', {}).values():
        found = installation(configured.get('application', ''))
        if not found or found['surface'] not in ('app', 'ide'):
            continue
        image = os.path.normcase(str(Path(found['executable']).resolve()))
        for pid, row in rows.items():
            if row['image'] != image:
                continue
            command = desktop(sys.platform).commands([pid]).get(pid, '')
            # Never silently replace a custom profile, project or launch mode
            # with the default profile on restart. Helpers have arguments too.
            if os.path.normcase(command) not in (image, '"'+image+'"'):
                continue
            candidates.append((pid, found))
    if len(candidates) != 1:
        raise ValueError(UNSCOPED)
    pid, found = candidates[0]
    for writer in pids:
        current, seen = writer, set()
        while current != pid:
            if current <= 1 or current in seen or len(seen) >= 64:
                raise ValueError(UNSCOPED)
            seen.add(current)
            if current not in rows:
                rows[current] = identity(current)
            row = rows[current]
            current = row['parent']
    plan = {'pid': pid, 'installation': found, 'processes': rows,
            'writers': set(pids), 'imageIdentity': _file_identity(Path(found['executable']))}
    verify(plan)
    return plan


def verify(plan):
    found = plan['installation']
    if (installation(found['application']) != found or
            _file_identity(Path(found['executable'])) != plan['imageIdentity']):
        raise ValueError(CHANGED)
    if set(login_processes()) != plan['writers']:
        raise ValueError(CHANGED)
    for pid, row in plan['processes'].items():
        if identity(pid) != row:
            raise ValueError(CHANGED)


def bind_server(plan, target):
    """A terminal CLI may descend from a GUI too; ancestry alone is not scope."""
    server = target['identity']
    if set(plan['writers']) != {plan['pid'], server['pid']} or server['pid'] == plan['pid']:
        raise ValueError(UNSCOPED)
    if Path(server['image']).name.casefold() in ('agy', 'agy.exe'):
        # The IDE's official hub is an embedded server, not an interactive CLI.
        args = next((args for pid, args in _candidates() if pid == server['pid']), [])
        expected = {'app': 'antigravity', 'ide': 'antigravity-ide'}[plan['installation']['surface']]
        if '--hub' not in args or _flag(args, '--app_data_dir') != expected:
            raise ValueError(UNSCOPED)
    verify(plan)


def stop(plan):
    """Submit exactly one normal quit, then require every login writer to exit."""
    verify(plan)
    pid, found = plan['pid'], plan['installation']
    native = desktop(sys.platform)
    if sys.platform == 'darwin':
        native.quit_application(found['executable'], pids=[pid])
    elif sys.platform == 'win32':
        # CloseMainWindow is cooperative. A hidden/tray-only app may refuse or
        # keep running; neither case is permission to terminate its process.
        native.quit_process(pid)
    elif sys.platform == 'linux':
        from bridge.platforms.linux.force_exit import Native
        binder = Native()
        handle = binder.open(plan['processes'][pid])
        try:
            verify(plan)
            signal.pidfd_send_signal(handle, signal.SIGTERM)
        finally:
            binder.close(handle)
    else:
        raise ValueError('현재 시스템에서는 지원하지 않습니다. Antigravity 정상적으로 종료')
    deadline = time.monotonic() + 12
    while True:
        remaining = set(login_processes())
        if not remaining:
            return
        if remaining - plan['writers']:
            raise ValueError(CHANGED)
        for current in remaining:
            if identity(current) != plan['processes'][current]:
                raise ValueError(CHANGED)
        if time.monotonic() >= deadline:
            raise ValueError('Antigravity 정상적으로 종료되지 않았으며 계정이 수정되지 않았습니다. 원래 클라이언트의 저장 또는 종료 프롬프트를 처리하고 다시 시도하십시오.')
        time.sleep(.2)


def restart(plan):
    """Reopen only the GUI that this operation stopped, using its existing data."""
    found = plan['installation']
    if (login_processes() or installation(found['application']) != found or
            _file_identity(Path(found['executable'])) != plan['imageIdentity']):
        raise ValueError(CHANGED)
    # No new-instance flag, guessed desktop environment, launch script, profile
    # replacement, Singleton deletion, credential argument or inherited stdin.
    desktop(sys.platform).start(Path(found['executable']), Path.home(), {})
