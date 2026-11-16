"""Generic-password bytes without password arguments or replacement ACLs."""
import shlex
import subprocess


def read(service, user):
    result = subprocess.run(['/usr/bin/security', 'find-generic-password', '-s', service,
                             '-a', user, '-w'], capture_output=True, timeout=30)
    if result.returncode == 44:  # errSecItemNotFound, not access denial.
        return None
    if result.returncode:
        raise ValueError('시스템 키체인을 읽을 수 없습니다. 컴퓨터에서 인증을 확인하세요.')
    return result.stdout.removesuffix(b'\n')


def write(service, user, value):
    if value is None:
        result = subprocess.run(['/usr/bin/security', 'delete-generic-password', '-s', service,
                                 '-a', user], capture_output=True, timeout=30)
        if result.returncode not in (0, 44):
            raise ValueError('원래 시스템 자격 증명을 제거할 수 없습니다.')
        return
    command = 'add-generic-password -U -s {} -a {} -w {}\n'.format(
        shlex.quote(service), shlex.quote(user), shlex.quote(value.decode('utf-8')))
    if len(command.encode()) > 4096:
        raise ValueError('기본 키체인 명령은 이 길이의 로그인 자격 증명을 지원하지 않습니다.')
    result = subprocess.run(['/usr/bin/security', '-i'], input=command.encode(),
                            capture_output=True, timeout=30)
    # Interactive security can return success after an inner command fails.
    if result.returncode or read(service, user) != value:
        raise ValueError('시스템 키체인 쓰기가 확인되지 않았습니다. 컴퓨터에서 인증을 확인하세요.')
