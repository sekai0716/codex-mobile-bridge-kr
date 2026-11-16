"""Verify a loopback development endpoint belongs to a known desktop executable."""
import os
import subprocess
from pathlib import Path

from bridge.platforms.macos.force_exit import Native


def listener_identity(port, executable, *, required=True):
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError('잘못된 기본 디버그 포트')
    result = subprocess.run(['/usr/sbin/lsof', '-nP', '-a', '-iTCP:%d' % port,
                             '-sTCP:LISTEN', '-Fpnt'], capture_output=True, text=True, timeout=3)
    if not required and result.returncode == 1 and not result.stdout and not result.stderr:
        return None  # lsof found no matching TCP listener.
    rows = result.stdout.splitlines()
    pids = {int(row[1:]) for row in rows if row.startswith('p')}
    names = {row[1:] for row in rows if row.startswith('n')}
    if result.returncode or len(pids) != 1 or names != {'127.0.0.1:%d' % port}:
        raise ValueError('디버그 포트는 하나의 기본 프로세스에서만 수신 대기해야 합니다. 127.0.0.1')
    # Reuse the kernel identity reader only; no signal/terminate operation.
    identity = Native().identity(next(iter(pids)))
    if identity['uid'] != os.getuid() or identity['zombie'] or identity['image'] != str(Path(executable).resolve()):
        raise ValueError('포트 및 원본 App 프로세스 ID 불일치')
    return {'pid': identity['pid'], 'birth': list(identity['birth']), 'started': list(identity['started'])}
