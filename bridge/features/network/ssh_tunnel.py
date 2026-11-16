"""Supervised reverse SSH forwarding using the user's existing SSH identity."""
import os
import shutil
import subprocess
import threading
from datetime import datetime
from pathlib import Path

from bridge.features.notifications.channels import write_json


def command(target, remote_port, local_port):
    executable = shutil.which('ssh')
    if not executable:
        raise ValueError("OpenSSH 클라이언트를 찾을 수 없습니다. 먼저 시스템 SSH 클라이언트를 설치하거나 활성화하세요.")
    return [executable, '-v', '-N', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=10',
            '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
            '-o', 'ControlMaster=no', '-o', 'ControlPath=none', '-o', 'ForkAfterAuthentication=no',
            '-o', 'PermitLocalCommand=no', '-o', 'ForwardAgent=no', '-o', 'UpdateHostKeys=no', '-o', 'AddKeysToAgent=no',
            '-R', f'127.0.0.1:{remote_port}:127.0.0.1:{local_port}', target]


class SSHTunnel:
    def __init__(self, target, remote_port, local_port, data_dir, connection_id=None):
        self.args = command(target, remote_port, local_port)
        self.data_dir = Path(data_dir)
        self.suffix = "-"+connection_id if connection_id else ""
        self.stopped = threading.Event()
        self.process = None
        self.thread = None

    def status(self, state, message):
        write_json(self.data_dir/('ssh-status'+self.suffix+'.json'), {'pid': os.getpid(), 'state': state, 'message': message})

    def start(self):
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        delay = 2
        try:
            while not self.stopped.is_set():
                self.status('connecting', "서버에 연결하는 중…")
                try:
                    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
                    self.process = subprocess.Popen(self.args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                                    stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', **kwargs)
                    # close() may have raced with Popen; never leave a child behind.
                    if self.stopped.is_set():
                        self._terminate()
                    with self.process.stderr, (self.data_dir/('ssh-tunnel'+self.suffix+'.log')).open('w', encoding='utf-8') as log:
                        for line in self.process.stderr:
                            log.write(datetime.now().isoformat(timespec='seconds')+' '+line)
                            log.flush()
                            if 'remote forward success for:' in line:
                                delay = 2
                                self.status('connected', "SSH 전달이 설정되었습니다. 수정된 HTTPS 항목을 확인하세요.")
                    self.process.wait()
                except OSError:
                    pass
                if self.stopped.is_set():
                    break
                self.status('retrying', "SSH 연결이 끊어졌습니다. 자동으로 다시 시도하는 중입니다. 런타임 로그를 참조하세요.")
                if self.stopped.wait(delay):
                    break
                delay = min(delay * 2, 30)
        finally:
            self._terminate()
            self.status('stopped', 'SSH 전달이 중지되었습니다.')

    def _terminate(self):
        process = self.process
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

    def close(self):
        self.stopped.set()
        self._terminate()
        if self.thread:
            self.thread.join(timeout=5)
