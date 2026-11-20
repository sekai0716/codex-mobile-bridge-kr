"""Manage one locally selected Codex browser window per gateway."""
import json
import math
import os
import queue
import secrets
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path


class BrowserShare:
    def __init__(self):
        self.lock = threading.RLock()
        self.worker = None
        self.owner = None
        self.frame_id = None
        self.controller = False
        self.expires = 0
        self.cooldown = 0

    @staticmethod
    def helper():
        return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[3])) / 'bridge/platforms/linux/browser_window.py'

    def _close(self):
        process, self.worker = self.worker, None
        self.owner = self.frame_id = None
        self.controller = False
        if process is not None:
            try:
                # The local picker and any temporary selection owners belong to this group.
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=2)
            process.stdin.close()
            process.stdout.close()

    def _read(self, process, replies):
        try:
            for line in process.stdout:
                replies.put(json.loads(line))
        except (OSError, ValueError):
            pass
        finally:
            replies.put(None)

    def close(self):
        with self.lock:
            self._close()

    def _expire(self, process):
        # Disconnecting the browser or revoking its login must not leave a share open.
        while True:
            with self.lock:
                if process is not self.worker:
                    return
                remaining = self.expires - time.monotonic()
                if remaining <= 0:
                    self._close()
                    return
            time.sleep(min(remaining, 5))

    def start(self, owner):
        with self.lock:
            if self.worker is not None:
                if self.owner == owner:
                    return {'pending': self.pending}
                raise ValueError('Another browser share is active.')
            if time.monotonic() < self.cooldown:
                raise ValueError('Try again in a few seconds.')
            helper = self.helper()
            if (sys.platform != 'linux' or not os.environ.get('DISPLAY') or
                    os.environ.get('XDG_SESSION_TYPE') == 'wayland' or not helper.is_file()):
                raise ValueError('Browser sharing requires a local Linux X11 session.')
            self.cooldown = time.monotonic() + 10
            env = os.environ.copy()
            if 'LD_LIBRARY_PATH_ORIG' in env:
                env['LD_LIBRARY_PATH'] = env.pop('LD_LIBRARY_PATH_ORIG')
            elif getattr(sys, 'frozen', False):
                env.pop('LD_LIBRARY_PATH', None)
            process = subprocess.Popen(['/usr/bin/python3', '-I', str(helper), owner[1]], env=env,
                                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                       text=True, encoding='utf-8', start_new_session=True)
            self.worker, self.owner, self.pending = process, owner, True
            self.replies = queue.SimpleQueue()
            self.expires = time.monotonic() + 90
            threading.Thread(target=self._read, args=(process, self.replies), daemon=True).start()
            threading.Thread(target=self._expire, args=(process,), daemon=True).start()
            return {'pending': True}

    def _reply(self, timeout):
        try:
            result = self.replies.get(timeout=timeout)
        except queue.Empty:
            self._close()
            raise ValueError('Browser window did not respond in time.') from None
        if not isinstance(result, dict) or result.get('error'):
            self._close()
            raise ValueError((result or {}).get('error') or 'Browser sharing ended.')
        return result

    def request(self, owner, body, *, can_control):
        op = body.get('op')
        fields = {'start': set(), 'end': set(), 'status': set(), 'take': set(), 'release': set(),
                  'frame': set(), 'click': {'x','y','frame'}, 'scroll': {'x','y','frame','delta'},
                  'text': {'text','frame'}}
        if not isinstance(op, str) or op not in fields or set(body) != fields[op] | {'op'}:
            raise ValueError('Invalid browser action.')
        if op in ('click','scroll') and not all(type(body[k]) in (int,float) and math.isfinite(body[k])
                                                and 0 <= body[k] <= 1 for k in ('x','y')):
            raise ValueError('Invalid browser coordinates.')
        if op == 'scroll' and (type(body['delta']) is not int or not 1 <= abs(body['delta']) <= 6):
            raise ValueError('Invalid scroll distance.')
        if op == 'text' and (not isinstance(body['text'], str) or not 1 <= len(body['text']) <= 4096):
            raise ValueError('Invalid text length.')
        if op == 'start' and set(body) == {'op'}:
            return self.start(owner)
        with self.lock:
            if self.worker is None or self.owner != owner:
                if op in ('status', 'end'):
                    return {'active': False}
                raise ValueError('Select a browser window on the PC first.')
            if op == 'end':
                self._close()
                return {'active': False}
            if self.pending:
                if self.replies.empty():
                    return {'pending': True}
                self._reply(1)
                self.pending = False
            self.expires = time.monotonic() + 30
            if not can_control:
                self.controller = False
            if op in ('status', 'take', 'release'):
                if op == 'take' and not can_control:
                    raise ValueError('Codex is using this chat. Wait for the turn to finish.')
                if op == 'take':
                    self.controller = True
                elif op == 'release':
                    self.controller = False
                if op != 'status':
                    self.frame_id = None
                return {'active': True, 'control': self.controller, 'canControl': can_control}
            if op not in ('frame', 'click', 'scroll', 'text'):
                raise ValueError('Unknown browser action.')
            if op != 'frame':
                if not self.controller or not self.frame_id or body.get('frame') != self.frame_id:
                    raise ValueError('The browser view changed. Refresh the frame.')
                self.frame_id = None  # A lost write response must never replay an input.
            try:
                self.worker.stdin.write(json.dumps(body, ensure_ascii=True) + '\n')
                self.worker.stdin.flush()
            except (BrokenPipeError, OSError):
                self._close()
                raise ValueError('Browser sharing ended.') from None
            result = self._reply(8)
            if op == 'frame':
                self.frame_id = secrets.token_urlsafe(18)
                result.update(frame=self.frame_id, control=self.controller, canControl=can_control)
            return result
