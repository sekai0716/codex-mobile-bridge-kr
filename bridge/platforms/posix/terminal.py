"""Continuous POSIX terminals. No shell is launched by a read-only info request."""
import codecs
import collections
import hashlib
import json
import os
from pathlib import Path
import select
import shlex
import signal
import subprocess
import sys
import threading
import time
import uuid

MAX_OUTPUT = 512 * 1024
IDLE_SECONDS = 3600


def default_shell():
    if os.name == 'nt':
        return os.environ.get('COMSPEC', 'cmd.exe')
    import pwd
    try:
        shell = pwd.getpwuid(os.getuid()).pw_shell
    except KeyError:
        shell = ''
    shell = shell or os.environ.get('SHELL') or '/bin/sh'
    if not os.path.isabs(shell) or not os.access(shell, os.X_OK):
        raise ValueError('시스템 기본값 shell 실행할 수 없습니다. 컴퓨터에서 로그인을 확인하세요. shell 설정')
    return shell


def dimensions(cols, rows):
    if type(cols) is not int or type(rows) is not int or not 2 <= cols <= 500 or not 2 <= rows <= 300:
        raise ValueError('잘못된 터미널 크기')
    return cols, rows


def utf8_terminal_environment(env):
    effective = env.get('LC_ALL') or env.get('LC_CTYPE') or env.get('LANG', 'C')
    if 'UTF8' in effective.upper().replace('-', '').replace('_', ''):
        return env
    available = subprocess.run(['locale', '-a'], capture_output=True, text=True, check=True, timeout=2).stdout.splitlines()
    locales = {name.upper().replace('-', '').replace('_', ''): name for name in available}
    selected = (locales.get('C.UTF8') or locales.get('ENUS.UTF8') or
                next((name for key, name in locales.items() if key.endswith('.UTF8')), None))
    if not selected:
        raise ValueError('시스템에 사용 가능한 항목이 없습니다. UTF-8 locale，터미널을 시작할 수 없습니다')
    env.pop('LC_ALL', None)
    env['LC_CTYPE'] = selected
    return env


def child_main(shell):
    # Executed in a fresh process, never preexec_fn inside the threaded gateway.
    import fcntl
    import termios
    os.setsid()
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)
    os.execve(shell, [shell, '-l', '-i'], {**os.environ, 'SHELL': shell})


class TerminalSession:
    def __init__(self, root, cols=80, rows=24):
        if os.name == 'nt':
            raise ValueError('이 플랫폼은 현재 연속 터미널을 지원하지 않습니다.')
        import pty
        self.lock = threading.RLock(); self.changed = threading.Event(); self.input_lock = threading.Lock()
        self.text = ''; self.end = 0; self.reason = ''; self.code = None
        self.done = threading.Event(); self.touched = time.monotonic()
        self.inputs = collections.OrderedDict(); self.shell = default_shell(); self.root = str(root)
        self.master, slave = pty.openpty()
        try:
            self.resize(cols, rows)
            args = ([sys.executable, '--terminal-child', self.shell] if getattr(sys, 'frozen', False) else
                    [sys.executable, '-c', 'import os,fcntl,termios;os.setsid();fcntl.ioctl(0,termios.TIOCSCTTY,0);os.execve('+repr(self.shell)+', ['+repr(self.shell)+',"-l","-i"], os.environ)'])
            env = {**os.environ, 'TERM': 'xterm-256color', 'COLORTERM': 'truecolor', 'SHELL': self.shell}
            # BSD ls (including ll aliases) needs this to enable automatic colors.
            # Unlike CLICOLOR_FORCE, it keeps redirected output free of escapes.
            env.setdefault('CLICOLOR', '1')
            env.pop('NO_COLOR', None)
            utf8_terminal_environment(env)
            if getattr(sys, 'frozen', False): env['PYINSTALLER_RESET_ENVIRONMENT'] = '1'
            self.process = subprocess.Popen(args, cwd=root, stdin=slave, stdout=slave, stderr=slave, env=env, close_fds=True)
            os.set_blocking(self.master, False)
        except Exception:
            os.close(self.master)
            raise
        finally:
            os.close(slave)
        threading.Thread(target=self._read, daemon=True).start()
        threading.Thread(target=self._idle, daemon=True).start()

    def append(self, text):
        with self.lock:
            self.end += len(text); self.text = (self.text + text)[-MAX_OUTPUT:]
            if text: self.changed.set()

    def _read(self):
        decoder = codecs.getincrementaldecoder('utf-8')('replace')
        try:
            while True:
                if not select.select([self.master], [], [], .5)[0]:
                    if self.process.poll() is not None: break
                    continue
                try: data = os.read(self.master, 32768)
                except BlockingIOError: continue
                except OSError: break  # POSIX PTY EIO on slave exit.
                if not data: break
                self.append(decoder.decode(data))
            self.append(decoder.decode(b'', final=True))
            self.code = self.process.wait()
        finally:
            with self.input_lock:
                self.done.set(); self.changed.set(); os.close(self.master)

    def read(self, after=0, wait_ms=0):
        if wait_ms:
            with self.lock:
                if after == self.end and not self.done.is_set():
                    self.changed.clear()
                    waiting = True
                else: waiting = False
            if waiting: self.changed.wait(wait_ms / 1000)
        with self.lock:
            start = self.end - len(self.text); reset = after < start or after > self.end
            return {'output': self.text if reset else self.text[after-start:], 'cursor': self.end,
                    'reset': reset, 'truncated': start > 0, 'running': not self.done.is_set(),
                    'exitCode': self.code, 'message': self.reason, 'shell': self.shell, 'cwd': self.root}

    def current_cwd(self):
        if self.done.is_set(): raise ValueError('터미널이 닫혔습니다. 다시 열어주세요.')
        try:
            if os.tcgetpgrp(self.master) != self.process.pid:
                raise ValueError("포그라운드 프로그램이 실행되는 동안 쉘 디렉토리를 확인할 수 없습니다")
            if sys.platform == 'linux':
                cwd = os.readlink('/proc/' + str(self.process.pid) + '/cwd')
            elif sys.platform == 'darwin':
                # lsof reads the selected shell's cwd without sending it input.
                result = subprocess.run(['/usr/sbin/lsof', '-a', '-p', str(self.process.pid), '-d', 'cwd', '-Fn'],
                                        capture_output=True, timeout=2, check=True)
                rows = result.stdout.decode('utf-8', 'strict').splitlines()
                cwd = next((row[1:] for row in rows if row.startswith('n/')), '')
            else:
                raise ValueError("이 시스템은 터미널 디렉토리를 변경하지 않고는 터미널 디렉토리를 결정할 수 없습니다")
            if not cwd or os.tcgetpgrp(self.master) != self.process.pid:
                raise ValueError("터미널 디렉터리를 확인할 수 없습니다")
            return cwd
        except (OSError, subprocess.SubprocessError, UnicodeError):
            raise ValueError("터미널 디렉토리를 변경하지 않고는 터미널 디렉토리를 결정할 수 없습니다") from None

    def write(self, identifier, data):
        if not isinstance(identifier, str): raise ValueError('잘못된 입력 번호')
        uuid.UUID(identifier)
        if not isinstance(data, str) or not data or len(data.encode('utf-8')) > 16384:
            raise ValueError('잘못된 터미널 입력')
        raw = data.encode('utf-8'); digest = hashlib.sha256(raw).digest()
        with self.input_lock:
            if self.done.is_set(): raise ValueError('터미널이 닫혔습니다. 다시 열어주세요.')
            entry = self.inputs.setdefault(identifier, [digest, 0])
            if entry[0] != digest: raise ValueError('입력 번호가 이미 다른 용도로 사용되었습니다.')
            self.touched = time.monotonic(); deadline = self.touched + 3
            while entry[1] < len(raw):
                try: entry[1] += os.write(self.master, raw[entry[1]:])
                except BlockingIOError:
                    if time.monotonic() > deadline: raise TimeoutError('터미널 입력이 혼잡합니다. 다시 시도해 주세요.')
                    select.select([], [self.master], [], .1)
            while len(self.inputs) > 256: self.inputs.popitem(last=False)
        return {'accepted': True}

    def resize(self, cols, rows):
        import fcntl
        import struct
        import termios
        dimensions(cols, rows)
        with self.input_lock:
            if self.done.is_set(): return
            fcntl.ioctl(self.master, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
        return {'resized': True}

    def stop(self, reason='터미널이 폐쇄되었습니다'):
        if self.done.is_set(): return
        self.reason = reason
        with self.input_lock:
            if self.done.is_set(): return
            try: groups = {self.process.pid, os.tcgetpgrp(self.master)}
            except OSError: groups = {self.process.pid}
        def send(sig):
            for group in groups:
                if group <= 0: continue
                try: os.killpg(group, sig)
                except ProcessLookupError: pass
        send(signal.SIGHUP)
        def finish():
            if not self.done.wait(1): send(signal.SIGKILL)
        threading.Thread(target=finish, daemon=True).start()

    def _idle(self):
        while not self.done.wait(30):
            if time.monotonic() - self.touched >= IDLE_SECONDS:
                self.stop('터미널 유휴 60 분, 닫힘'); return


def remote_main(root, cols, rows):
    session = TerminalSession(root, cols, rows)
    output_lock = threading.Lock()
    def emit(value):
        with output_lock: print(json.dumps(value), flush=True)
    def control():
        try:
            for line in sys.stdin:
                request = json.loads(line)
                try:
                    if request['action'] == 'input': result = session.write(request['inputId'], request['data'])
                    elif request['action'] == 'resize': result = session.resize(request['cols'], request['rows'])
                    elif request['action'] == 'complete': result = complete_path(session, request['text'], request['selectionStart'])
                    elif request['action'] == 'stop': session.stop(); result = {'closed': True}
                    else: raise ValueError('잘못된 터미널 작동')
                    emit({'ack': request['request'], 'result': result})
                except Exception as exc: emit({'ack': request['request'], 'error': str(exc)})
        finally: session.stop('SSH 연결이 끊어졌습니다')
    threading.Thread(target=control, daemon=True).start()
    cursor = 0
    try:
        while True:
            event = session.read(cursor); cursor = event['cursor']; emit(event)
            if not event['running']: break
            session.read(cursor, 1000)
    finally: session.stop(); session.done.wait(3)


class RemoteTerminalSession:
    def __init__(self, alias, root, cols=80, rows=24, *, transport=None, transport_name="SSH"):
        if transport is None and (not alias or alias.startswith('-') or any(c.isspace() for c in alias)): raise ValueError('SSH 잘못된 별칭')
        dimensions(cols, rows)
        self.transport_name = transport_name
        self.lock = threading.RLock(); self.changed = threading.Event(); self.write_lock = threading.Lock(); self.pending = {}
        self.text = ''; self.end = 0; self.code = None; self.reason = ''; self.shell = ''
        self.root = str(root); self.done = threading.Event(); self.ready = threading.Event()
        from bridge.resources import source_text
        source = source_text('features/terminals/completion.py') + '\n' + source_text('platforms/posix/terminal.py')
        source += '\nremote_main('+repr(str(root))+','+str(cols)+','+str(rows)+')\n'
        args = transport(source) if transport else ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ClearAllForwardings=yes',
             '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no', alias,
             'python3 -u -c '+shlex.quote(source)]
        self.process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        threading.Thread(target=self._read, daemon=True).start()
        if not self.ready.wait(12) or self.done.is_set():
            self.process.kill(); raise ValueError(self.transport_name + ' 터미널을 시작하지 못했습니다. 연결 및 원격을 확인하세요. Python')

    read = TerminalSession.read
    append = TerminalSession.append

    def _read(self):
        try:
            for line in self.process.stdout:
                event = json.loads(line)
                if 'ack' in event:
                    with self.lock:
                        pending = self.pending.get(event['ack'])
                        if pending: pending[1].update(event); pending[0].set()
                    continue
                with self.lock:
                    if event['reset']: self.text = event['output']; self.end = event['cursor']; self.changed.set()
                    else: self.append(event['output'])
                    self.shell = event['shell']; self.code = event['exitCode']; self.reason = event['message']
                self.ready.set()
                if not event['running']: break
        except (OSError, ValueError, KeyError): pass
        finally:
            self.reason = self.reason or self.transport_name + ' 터미널 연결이 끊어졌습니다'
            self.process.stdout.close()
            if self.process.poll() is None: self.process.terminate()
            self.process.wait(); self.done.set(); self.changed.set(); self.ready.set()
            with self.write_lock: self.process.stdin.close()
            with self.lock:
                for finished, value in self.pending.values(): value['error'] = self.reason; finished.set()

    def request(self, action, **params):
        identifier = str(uuid.uuid4()); finished = threading.Event(); value = {}
        with self.lock: self.pending[identifier] = (finished, value)
        try:
            with self.write_lock:
                if self.done.is_set(): raise ValueError(self.transport_name + ' 터미널이 폐쇄되었습니다')
                self.process.stdin.write((json.dumps({'request':identifier,'action':action,**params})+'\n').encode()); self.process.stdin.flush()
            if not finished.wait(6): raise TimeoutError(self.transport_name + ' 터미널 응답 시간 초과')
            if 'error' in value: raise ValueError(value['error'])
            return value['result']
        finally:
            with self.lock: self.pending.pop(identifier, None)

    def write(self, identifier, data): return self.request('input', inputId=identifier, data=data)
    def complete(self, text, selection_start): return self.request('complete', text=text, selectionStart=selection_start)
    def resize(self, cols, rows): dimensions(cols, rows); return self.request('resize', cols=cols, rows=rows)
    def stop(self, reason='터미널이 폐쇄되었습니다'):
        if self.done.is_set(): return
        try: self.request('stop')
        except (OSError, ValueError, TimeoutError): pass
        if not self.done.wait(3) and self.process.poll() is None: self.process.kill()
