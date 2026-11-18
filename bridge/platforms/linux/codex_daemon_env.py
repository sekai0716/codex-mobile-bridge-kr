"""Verify Linux process generations and read selected launch variables."""

import os
from pathlib import Path


def desktop_process_identity(pid):
    """공유 Desktop 연결을 현재 Linux 프로세스 세대와 실제 UID에 묶는다."""
    root = Path('/proc') / str(pid)

    def snapshot():
        raw = (root / 'stat').read_text(encoding='ascii')
        fields = raw.rpartition(')')[2].split()
        if not raw.startswith(f'{pid} (') or len(fields) < 20:
            raise OSError('Desktop process identity unavailable')
        uids = next(line.split()[1:] for line in (root / 'status').read_text().splitlines()
                    if line.startswith('Uid:'))
        zombie = fields[0] == 'Z'
        image = ''
        if not zombie:
            executable = root / 'exe'
            try:
                image = str(executable.resolve(strict=True))
            except FileNotFoundError:
                # 패키지 갱신 후에도 기존 프로세스는 삭제된 inode를 실행한다.
                # 커널 링크와 실제 링크 수를 함께 확인한다. PID·부팅·시작 시각 검증은 그대로 적용된다.
                target = os.readlink(executable)
                if not os.path.isabs(target) or not target.endswith(' (deleted)') or executable.stat().st_nlink != 0:
                    raise
                image = target.removesuffix(' (deleted)')
        return {'pid': pid, 'parent': int(fields[1]), 'uid': int(uids[1]), 'ruid': int(uids[0]),
                'image': image,
                'startTicks': int(fields[19]), 'zombie': zombie}

    try:
        before = snapshot()
        boot = Path('/proc/sys/kernel/random/boot_id').read_text(encoding='ascii').strip()
        after = snapshot()
    except FileNotFoundError:
        if not root.exists():
            raise ProcessLookupError('Desktop process exited') from None
        raise
    # PID 재사용, exec 또는 재부모화가 관찰 도중 발생하면 혼합된 신원을 반환하지 않는다.
    if before != after or not boot:
        raise OSError('Desktop process changed during inspection')
    return {**after, 'bootId': boot}


def _identity(pid):
    root = Path('/proc') / str(pid)
    stat = (root / 'stat').read_text(encoding='ascii')
    fields = stat.rpartition(')')[2].split()
    if not stat.startswith(f'{pid} (') or len(fields) < 20:
        raise OSError('Codex daemon process identity unavailable')
    uids = next(line.split()[1:] for line in (root / 'status').read_text().splitlines()
                if line.startswith('Uid:'))
    image = (root / 'exe').resolve(strict=True)
    return (int(fields[19]), tuple(int(uid) for uid in uids), str(image))


def read_process_environment(pid, record, executable, names, record_path=None):
    before = _identity(pid)
    if (before[1][0] != os.getuid() or before[1][1] != os.geteuid() or
            before[2] != str(Path(executable).resolve())):
        raise OSError('Codex daemon process identity mismatch')
    boot = (Path('/proc/sys/kernel/random/boot_id').read_text().strip())
    generation = record.get('processIdentity') or {}
    if generation.get('bootId') != boot or generation.get('startTicks') != before[0]:
        raise OSError('Codex daemon PID record is stale')
    wanted = {name.encode(): name for name in names}
    selected = {}
    with (Path('/proc') / str(pid) / 'environ').open('rb') as stream:
        raw = stream.read(2_000_001)
    if len(raw) > 2_000_000:
        raise OSError('Codex daemon launch environment is too large')
    for entry in raw.split(b'\0'):
        key, separator, value = entry.partition(b'=')
        if separator and key in wanted:
            selected[wanted[key]] = os.fsdecode(value)
    if _identity(pid) != before:
        raise OSError('Codex daemon process changed')
    return selected, (pid, before[0], before[2])
