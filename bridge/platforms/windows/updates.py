"""Read-only checks for long-lived runtime processes that lock an installation."""
import os
from pathlib import Path

from .desktop import process_inventory
from .zcode_pipe import identity, process_args


def require_update_ready(worker):
    worker = Path(worker).resolve(strict=True)
    expected = os.path.normcase(str(worker))
    inventory = process_inventory([worker])[worker]
    for pid in inventory['pids']:
        try:
            before = identity(pid)
            if before['image'] != expected:
                continue
            argv = process_args(pid)
            if identity(pid) != before:
                raise ValueError('인스턴스를 실행하는 게이트웨이가 변경되었습니다. 업데이트를 다시 시도해 주세요.。')
            if (len(argv) != 6 or os.path.normcase(argv[0]) != expected or
                    argv[1:3] != ['zcode-pipe-host', '--data-dir'] or argv[4] != '--application'):
                continue
        except ProcessLookupError:
            continue
        except OSError as error:
            if getattr(error, 'winerror', None) == 87:
                continue
            raise
        raise ValueError('먼저 작업을 종료하고 정상적으로 종료해주세요. ZCode，게이트웨이를 다시 업데이트하세요.。')
