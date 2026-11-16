"""Request the selected desktop's native Quit menu once and verify its exit."""
import ctypes
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from .desktop import process_inventory


BUDGET = 25
CHILD_TYPES = {'renderer', 'gpu-process', 'utility', 'zygote', 'broker',
               'crashpad-handler', 'ppapi', 'ppapi-broker'}
CHANGED = 'Codex 실행 중인 인스턴스가 변경되었거나 확인할 수 없습니다. 다시 스캔하고 다시 시도하십시오. 종료 명령이 아직 전송되지 않았습니다.'
PENDING = 'Codex 정상적인 종료가 완료되지 않았습니다. 컴퓨터에서 저장 또는 확인 메시지를 확인하고 나중에 다시 시도하세요.'


def helper_path():
    root = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[3]/'dist'))
    return root/'client-helpers/codex-quit-helper.exe'


def _remaining(deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ValueError(PENDING)
    return remaining


def _windows_argv(command):
    shell = ctypes.WinDLL('shell32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    shell.CommandLineToArgvW.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_int)]
    shell.CommandLineToArgvW.restype = ctypes.POINTER(ctypes.c_wchar_p)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    count = ctypes.c_int()
    arguments = shell.CommandLineToArgvW(command, ctypes.byref(count))
    if not arguments:
        raise ValueError(CHANGED)
    try:
        return [arguments[index] for index in range(count.value)]
    finally:
        kernel.LocalFree(ctypes.cast(arguments, ctypes.c_void_p))


def _creation_time(pid):
    """An immutable process identity; this never opens a write/terminate handle."""
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.GetProcessTimes.argtypes = [ctypes.c_void_p, *([ctypes.POINTER(ctypes.c_uint64)] * 4)]
    kernel.GetProcessTimes.restype = ctypes.c_int
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel.CloseHandle.restype = ctypes.c_int
    handle = kernel.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        raise OSError('process identity unavailable')
    try:
        values = [ctypes.c_uint64() for _ in range(4)]
        if not kernel.GetProcessTimes(handle, *(ctypes.byref(value) for value in values)):
            raise OSError('process identity unavailable')
        return values[0].value
    finally:
        kernel.CloseHandle(handle)


def _inventory(executable, deadline):
    return process_inventory([executable], timeout=min(15, _remaining(deadline))).get(executable, {})


def _snapshot(executable, deadline):
    """Unknown command lines are never treated as harmless renderer processes."""
    try:
        state = _inventory(executable, deadline)
        pids = state.get('pids')
        if not isinstance(pids, list) or any(type(pid) is not int or pid <= 0 for pid in pids):
            raise ValueError(CHANGED)
        commands, main = state.get('commands', {}), []
        if not isinstance(commands, dict):
            raise ValueError(CHANGED)
        for pid in pids:
            command = commands.get(pid)
            if not isinstance(command, str) or not command.strip():
                raise ValueError(CHANGED)
            arguments = _windows_argv(command)
            if (not arguments or not Path(arguments[0]).is_absolute()
                    or os.path.normcase(str(Path(arguments[0]).resolve())) != os.path.normcase(str(executable))):
                raise ValueError(CHANGED)
            kinds = []
            for index, argument in enumerate(arguments[1:], 1):
                if argument == '--type':
                    kinds.append(arguments[index + 1] if index + 1 < len(arguments) else '')
                elif argument.startswith('--type='):
                    kinds.append(argument.partition('=')[2])
            if len(kinds) > 1 or kinds and kinds[0] not in CHILD_TYPES:
                raise ValueError(CHANGED)
            if not kinds:
                main.append(pid)
        if Path(executable).name.casefold() == 'zcode.exe' and main:
            from .zcode_pipe import main_processes
            main, ambiguous = main_processes(executable, main, commands)
            if ambiguous:
                raise ValueError(CHANGED)
        if len(main) > 1:
            raise ValueError(CHANGED)
        created = _creation_time(main[0]) if main else None
        return {'pids': set(pids), 'main': main[0] if main else None, 'created': created}
    except (OSError, ValueError, TypeError, subprocess.SubprocessError):
        # The main process may naturally exit between the inventory and its
        # read-only identity lookup. Only fresh complete absence is success.
        try:
            fresh = _inventory(executable, deadline)
            if fresh.get('pids') == []:
                return {'pids': set(), 'main': None, 'created': None}
        except (OSError, ValueError, TypeError, subprocess.SubprocessError):
            pass
        raise ValueError(CHANGED) from None


def _receipt(output, pid):
    if isinstance(output, bytes):
        output = output.decode('utf-8', errors='replace')
    lines = output.splitlines() if isinstance(output, str) else []
    dispatched = False
    for line in lines:
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if (isinstance(value, dict) and value.get('quitPhase') == 'dispatching'
                and type(value.get('pid')) is int and value['pid'] == pid):
            dispatched = True
    try:
        value = json.loads(lines[-1])
        if (not isinstance(value, dict) or type(value.get('pid')) is not int or value['pid'] != pid
                or value.get('quitState') not in ('submitted', 'exited', 'pending', 'failed')
                or not isinstance(value.get('reason'), str)):
            raise ValueError('invalid receipt')
        return value, dispatched
    except (ValueError, IndexError):
        return None, dispatched


def _check_same(state, original):
    if state['main'] is not None and (state['main'] != original['main']
                                     or state['created'] != original['created']):
        raise ValueError(CHANGED)


def _observe(executable, original, deadline, reason=PENDING, *, wait=True):
    while True:
        if time.monotonic() >= deadline:
            raise ValueError(reason)
        state = _snapshot(executable, deadline)
        if not state['pids']:
            return
        _check_same(state, original)
        if not wait or time.monotonic() >= deadline:
            raise ValueError(reason)
        time.sleep(min(.25, _remaining(deadline)))


def stop_codex(app, gui_pids=None):
    return _stop_menu(app, gui_pids, '--quit')


def stop_private_zcode(executable, main_pids, owner, request_quit):
    """After task preflight, request one native quit and verify actual OS exit."""
    executable = Path(executable).resolve()
    deadline = time.monotonic() + BUDGET
    original = _snapshot(executable, deadline)
    if not original['pids']:
        return True
    if (not isinstance(owner, dict) or original['main'] is None or main_pids != [original['main']]
            or owner.get('pid') != original['main'] or owner.get('created') != original['created']
            or owner.get('image') != os.path.normcase(str(executable))):
        raise ValueError('ZCode 실행 중인 인스턴스가 변경되었으며 아직 종료를 요청하지 않았습니다.')
    try:
        supported = request_quit()
    except (OSError, EOFError, ValueError, subprocess.SubprocessError):
        # Electron can close the debugging stream before returning its reply.
        # Only a complete OS exit settles this; a second Quit could hit another App.
        supported = None
    if supported is False:
        current = _snapshot(executable, deadline)
        if not current['pids']:
            return True
        if current['main'] == original['main'] and current['created'] == original['created']:
            return False  # The original App definitively did not implement Browser.close.
    _observe(executable, original, deadline, '아직 확인되지 않음 ZCode 정상적으로 종료됩니다. 원본을 확인해주세요. App；반복적인 종료 요청이 없습니다.')
    return True


def stop_zcode(app, gui_pids=None):
    from .session import require_interactive
    require_interactive()
    if (app.executable.name.casefold() != 'zcode.exe'
            or not (app.executable.parent/'resources/app.asar').is_file()):
        raise ValueError('ZCode 설치 ID를 확인할 수 없습니다.')
    try:
        return _stop_menu(app, gui_pids, '--quit-zcode')
    except ValueError as exc:
        raise ValueError(str(exc).replace('Codex', 'ZCode')) from None


def _stop_menu(app, gui_pids, mode):
    """An uncertain request is never replayed or escalated to termination."""
    if sys.platform != 'win32':
        raise ValueError('이 시스템은 지원하지 않습니다 Windows Codex 네이티브 이탈 구성요소')
    executable, deadline = Path(app.executable).resolve(), time.monotonic() + BUDGET
    original = _snapshot(executable, deadline)
    if not original['pids']:
        return
    pid = original['main']
    if pid is None:
        return _observe(executable, original, deadline)
    if gui_pids is not None and set(gui_pids) != {pid}:
        raise ValueError(CHANGED)
    helper = helper_path()
    if not helper.is_file():
        raise ValueError('부족 Codex 기본 종료 구성 요소입니다. 게이트웨이를 다시 빌드하거나 설치하세요. App')
    # Recheck the selected instance after helper discovery and before sending.
    current = _snapshot(executable, deadline)
    if not current['pids']:
        return
    _check_same(current, original)
    if current['main'] is None:
        return _observe(executable, original, deadline)
    receipt, dispatched, interrupted = None, False, False
    try:
        remaining = _remaining(deadline)
        helper_timeout = remaining - min(3, remaining / 2)
        result = subprocess.run([str(helper), str(pid), mode, str(executable), str(original['created'])],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', errors='replace', timeout=helper_timeout,
            creationflags=subprocess.CREATE_NO_WINDOW, close_fds=True, check=False)
        receipt, dispatched = _receipt(result.stdout, pid)
        interrupted = result.returncode != 0 and (receipt is None or receipt['quitState'] != 'failed')
    except subprocess.TimeoutExpired as exc:
        # subprocess.run stops only this dedicated helper on timeout, never the
        # selected desktop. Its flushed marker may be the sole dispatch proof.
        receipt, dispatched = _receipt(exc.stdout, pid)
        interrupted = True
    except OSError:
        return _observe(executable, original, deadline,
            '시작할 수 없습니다 Codex 구성 요소를 기본적으로 종료하려면 게이트웨이 설치를 확인하고 다시 시도하십시오.', wait=False)
    # Even a successful receipt is not evidence that Electron children exited.
    reason = receipt['reason'].strip() if receipt is not None else ''
    reason = reason[:1000] or PENDING
    definite_failure = not interrupted and not dispatched and receipt is not None and receipt['quitState'] == 'failed'
    needs_confirmation = not interrupted and receipt is not None and receipt['quitState'] == 'pending'
    return _observe(executable, original, deadline, reason, wait=not (definite_failure or needs_confirmation))
