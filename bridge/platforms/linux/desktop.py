"""Linux /proc inventory; only the current user's processes are observable."""
import os
import signal
from pathlib import Path

from bridge.platforms.linux.codex_daemon_env import desktop_process_identity, process_executable
from bridge.platforms.posix.desktop import quit_process
from bridge.platforms.posix.desktop import start
from bridge.platforms.posix.desktop import terminate


def _process_rows(*, preserve_deleted_marker=False):
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            if path.stat().st_uid != os.getuid():
                continue
            exe_link = path/'exe'
            raw = os.readlink(exe_link)
            deleted = raw.endswith(' (deleted)')
            if deleted and preserve_deleted_marker:
                # Keep the kernel marker only for Antigravity's AppImage verifier.
                executable = Path(raw)
            else:
                # Keep the shared inventory's historical absolute image path.
                executable = Path(raw.removesuffix(' (deleted)'))
            if not executable.is_absolute():
                continue
        except (OSError, RuntimeError):
            continue
        yield path, executable


def inventory(result, match):
    for path, executable in _process_rows():
        state = match(executable)
        if state is not None:
            pid = int(path.name); state['pids'].append(pid)
            try:
                state['commands'][pid] = (path/'cmdline').read_bytes().decode().replace('\0', ' ').strip()
            except (OSError, UnicodeError):
                pass  # Disappearing/unreadable commands remain unknown.


def processes(matches):
    return [int(path.name) for path, executable in _process_rows() if matches(executable)]


def commands(pids):
    result = {}
    for pid in pids:
        try:
            result[pid] = (Path('/proc')/str(pid)/'cmdline').read_bytes().decode().replace('\0', ' ').strip()
        except FileNotFoundError:
            pass
    return result


def quit_verified_codex(pid, executable, expected=None):
    """Send a normal termination signal through a handle to the verified GUI."""
    if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
        raise ValueError('无法确认唯一的 Codex 桌面进程，请在电脑端检查后重试')
    try:
        handle = os.pidfd_open(pid)
    except ProcessLookupError:
        return
    try:
        identity = desktop_process_identity(pid)
        if identity['zombie']:
            return
        if (identity['image'] != str(executable) or identity['ruid'] != os.getuid()
                or identity['uid'] != os.geteuid() or expected is not None and identity != expected):
            raise ValueError('Codex 桌面进程已变化，请重新初始化连接')
        signal.pidfd_send_signal(handle, signal.SIGTERM)
    except ProcessLookupError:
        pass
    finally:
        os.close(handle)
