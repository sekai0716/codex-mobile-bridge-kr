"""Bounded forced exit of an explicit, freshly validated target set."""
import os
from pathlib import Path
import sys
import time

from bridge.platforms import desktop

CHANGED = "앱 프로세스가 변경되었거나 확인할 수 없어 강제 종료가 중지되었습니다. 다시 시도하기 전에 다시 스캔하세요."
PROTECTED = "선택한 앱이 게이트웨이 또는 해당 앱을 실행한 프로세스와 겹치므로 강제 종료할 수 없습니다."


def force_stop(executable, commands):
    if sys.platform == 'darwin':
        from bridge.platforms.macos.force_exit import Native
    elif sys.platform == 'linux':
        from bridge.platforms.linux.force_exit import Native
    else:
        raise ValueError("이 시스템은 데스크톱 클라이언트 강제 종료를 지원하지 않습니다.")
    executable = str(Path(executable).resolve())
    native, held = Native(), {}
    deadline = time.monotonic() + 20
    try:
        protected, images, pid = set(), {str(Path(sys.executable).resolve())}, os.getpid()
        ancestor = native.ancestor if sys.platform == 'linux' else native.identity
        while pid > 1 and pid not in protected:
            protected.add(pid)
            identity = ancestor(pid)
            images.add(identity['image'])
            pid = identity['parent']
        if executable in images or protected.intersection(commands):
            raise ValueError(PROTECTED)

        def verify(pid, expected=None):
            identity = native.identity(pid)
            if (identity['pid'] != pid or identity['uid'] != os.getuid() or identity['ruid'] != os.getuid()
                    or identity['image'] != executable):
                raise ValueError(CHANGED)
            if expected and (identity['birth'] != expected['birth'] or identity['image'] != expected['image']):
                raise ValueError(CHANGED)
            return identity

        def current():
            rows = desktop(sys.platform).processes(lambda image: str(Path(image).resolve()) == executable)
            if set(rows) - set(commands):
                raise ValueError(CHANGED)
            latest = desktop(sys.platform).commands(rows) if rows else {}
            active = []
            for target in set(held) - set(rows):
                try:
                    identity = native.identity(target)
                except ProcessLookupError:
                    continue
                if (not identity['zombie'] and (identity['birth'] == held[target][1]['birth'] or
                        identity['image'] == executable and identity['uid'] == os.getuid())):
                    raise ValueError(CHANGED)  # An omitted live process is not success.
            for target in rows:
                if latest.get(target) != commands[target]:
                    raise ValueError(CHANGED)
                try:
                    identity = verify(target, held[target][1] if target in held else None)
                except ProcessLookupError:
                    continue
                if not identity['zombie']:
                    active.append(target)
            return active

        # Bind every *known* target independently of a possibly incomplete
        # inventory. The following command read is bracketed by this binding
        # and verify(expected), so PID reuse cannot attach it to a new process.
        for pid in commands:
            try:
                identity = verify(pid)
                held[pid] = (native.open(identity), identity)
            except ProcessLookupError:
                pass  # An independently verified natural exit is harmless.
        for index, pid in enumerate(current()):
            if index and pid not in current():
                continue
            if pid not in held:
                raise ValueError(CHANGED)
            verify(pid, held[pid][1])
            try:
                native.terminate(held[pid][0])
            except ProcessLookupError:
                pass
        while current():
            if time.monotonic() >= deadline:
                raise ValueError("앱이 강제 종료되기를 기다리는 중 시간이 초과되었습니다. 다시 스캔하고 컴퓨터에서 앱을 확인하세요.")
            time.sleep(.1)
    except OSError:
        raise ValueError("모든 앱 프로세스를 종료할 수 있는 것은 아닙니다. 다시 시도하기 전에 컴퓨터에서 권한을 확인하거나 문제를 해결하세요.") from None
    finally:
        for handle, _ in held.values():
            native.close(handle)
