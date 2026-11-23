"""Serialize a second subscription with the original Linux Desktop's release."""
import os
import stat
import threading
import uuid
from contextlib import contextmanager
from pathlib import Path

from bridge.clients.codex.app_server import AppServerUnavailable


def _identifier(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value
    except ValueError:
        return False


class DesktopSubscriptions:
    def __init__(self, endpoint):
        self.directory = Path(endpoint).with_suffix('.subscriptions')
        self.lock = threading.Lock()
        self.sequence = 0
        self.pending = {}
        self.revoked = {}

    @contextmanager
    def _marker(self, thread_id, *, update):
        import fcntl
        if not _identifier(thread_id):
            raise AppServerUnavailable('데스크톱 채팅 ID를 확인할 수 없습니다.')
        parent = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            info = os.fstat(parent)
            if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
                raise AppServerUnavailable('원래 데스크톱의 구독 기록을 확인할 수 없습니다.')
            flags = os.O_RDWR | os.O_CREAT if update else os.O_RDONLY
            fd = os.open(thread_id, flags | os.O_NOFOLLOW, 0o600, dir_fd=parent)
            try:
                info = os.fstat(fd)
                if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
                        or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1):
                    raise AppServerUnavailable('원래 데스크톱의 구독 기록을 확인할 수 없습니다.')
                fcntl.flock(fd, fcntl.LOCK_EX if update else fcntl.LOCK_SH)
                yield fd
            finally:
                os.close(fd)
        finally:
            os.close(parent)

    @contextmanager
    def retain(self, thread_id):
        try:
            with self._marker(thread_id, update=False) as fd:
                if os.pread(fd, 2, 0) != b'1':
                    raise AppServerUnavailable('원래 데스크톱에서 이 채팅을 다시 열어 주세요.')
                yield
        except FileNotFoundError as exc:
            raise AppServerUnavailable('원래 데스크톱의 채팅 구독을 확인할 수 없습니다.') from exc

    def _set(self, thread_id, present):
        if _identifier(thread_id):
            with self._marker(thread_id, update=True) as fd:
                os.pwrite(fd, b'1' if present else b'0', 0)

    def outgoing(self, packet):
        method, params = packet.get('method'), packet.get('params') or {}
        if not isinstance(params, dict):
            return
        with self.lock:
            self.sequence += 1
            if method in ('thread/start', 'thread/resume', 'thread/fork') and 'id' in packet:
                self.pending[packet['id']] = self.sequence
            elif method in ('thread/unsubscribe', 'thread/archive', 'thread/delete'):
                self._revoke(params.get('threadId'))

    def _revoke(self, thread_id):
        if _identifier(thread_id):
            self.revoked[thread_id] = self.sequence
            self._set(thread_id, False)

    def incoming(self, packet):
        with self.lock:
            self.sequence += 1
            if 'method' in packet:
                params = packet.get('params') or {}
                if (packet['method'] == 'thread/closed' or packet['method'] == 'thread/status/changed'
                        and (params.get('status') or {}).get('type') == 'notLoaded'):
                    self._revoke(params.get('threadId'))
                return
            sequence = self.pending.pop(packet.get('id'), None)
            if sequence is not None:
                thread = (packet.get('result') or {}).get('thread') or {}
                sid = thread.get('id')
                if _identifier(sid) and sequence > self.revoked.get(sid, 0):
                    self._set(sid, True)

    def close(self):
        for path in self.directory.iterdir():
            if _identifier(path.name):
                path.unlink(missing_ok=True)
        self.directory.rmdir()
