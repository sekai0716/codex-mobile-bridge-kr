"""Read selected initial variables from a verified same-user Linux daemon."""

import os
from pathlib import Path


def process_executable(root):
    """Linux retains the executing inode after a package replaces its file."""
    executable = root / 'exe'
    try:
        return executable.resolve(strict=True)
    except FileNotFoundError:
        target = os.readlink(executable)
        if not os.path.isabs(target) or not target.endswith(' (deleted)') or executable.stat().st_nlink != 0:
            raise
        return Path(target.removesuffix(' (deleted)'))


def _process_fields(pid, root):
    try:
        raw = (root / 'stat').read_bytes()
    except FileNotFoundError:
        raise ProcessLookupError('Codex process exited') from None
    fields = raw.rpartition(b')')[2].split()
    if not raw.startswith(f'{pid} ('.encode('ascii')) or len(fields) < 20:
        raise OSError('Codex daemon process identity unavailable')
    return fields[0], int(fields[1]), int(fields[19])


def _process_ids(root):
    fields = next((line.split()[1:] for line in (root / 'status').read_bytes().splitlines()
                   if line.startswith(b'Uid:')), ())
    if len(fields) != 4:
        raise OSError('Codex process user identity unavailable')
    return tuple(int(uid) for uid in fields)


def desktop_process_identity(pid):
    """Check that the executable, ancestry and birth belong to one process."""
    if type(pid) is not int or pid <= 0:
        raise ValueError('Invalid desktop process ID')
    root = Path('/proc') / str(pid)

    def snapshot():
        state, parent, start = _process_fields(pid, root)
        uids = _process_ids(root)
        exited = state in (b'Z', b'X')
        image = '' if exited else str(process_executable(root))
        return parent, start, uids, exited, image

    try:
        before = snapshot()
        boot = Path('/proc/sys/kernel/random/boot_id').read_text(encoding='ascii').strip()
        after = snapshot()
    except FileNotFoundError:
        if not root.exists():
            raise ProcessLookupError('Codex desktop process exited') from None
        raise
    if before != after or not boot:
        raise OSError('Codex desktop process changed during inspection')
    parent, start, uids, exited, image = after
    return {'pid': pid, 'parent': parent, 'bootId': boot, 'startTicks': start,
            'ruid': uids[0], 'uid': uids[1], 'zombie': exited, 'image': image}


def _identity(pid):
    root = Path('/proc') / str(pid)
    _, _, start = _process_fields(pid, root)
    uids = _process_ids(root)
    image = process_executable(root)
    return (start, uids, str(image))


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
