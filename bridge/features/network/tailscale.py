"""Own one foreground Serve/Funnel session; never reset the user's tailnet."""
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import urlsplit

from bridge.features.notifications.channels import write_json


def executable():
    if sys.platform == 'darwin':
        from bridge.platforms.macos import tailscale as native
    elif sys.platform == 'win32':
        from bridge.platforms.windows import tailscale as native
    else:
        from bridge.platforms.linux import tailscale as native
    candidates = native.candidates()
    found = shutil.which('tailscale')
    if found:
        candidates.append(Path(found))
    return next((str(p) for p in candidates if p.is_file() and os.access(p, os.X_OK)), '')


def command_json(binary, arguments):
    try:
        result = subprocess.run([binary, *arguments], stdin=subprocess.DEVNULL, capture_output=True,
                                encoding='utf-8', errors='replace', timeout=8,
                                **({'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}))
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError("Tailscale에 연결할 수 없습니다. 클라이언트를 열고 시스템 네트워크 권한을 확인하십시오.") from exc
    try:
        value = json.loads(result.stdout)
        if not isinstance(value, dict):
            raise ValueError()
    except (ValueError, TypeError) as exc:
        # CLI output can contain account details and login URLs; do not relay it.
        raise ValueError("Tailscale 상태를 읽을 수 없습니다. 공식 클라이언트를 업데이트하고 로그인하세요.") from exc
    if result.returncode and not value.get('BackendState'):
        raise ValueError("Tailscale 상태를 읽을 수 없습니다. 공식 클라이언트를 업데이트하고 로그인하세요.")
    return value


def authorization_url(value):
    if not isinstance(value, str) or len(value) > 2048 or any(c.isspace() for c in value):
        return ''
    try:
        parsed = urlsplit(value)
        if (parsed.scheme == 'https' and parsed.hostname == 'login.tailscale.com'
                and parsed.port in (None, 443) and not parsed.username and not parsed.password):
            return value
    except ValueError:
        pass
    return ''


def device_url(status, port):
    host = status.get('Self', {}).get('DNSName', '').rstrip('.').lower()
    if not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ts\.net', host):
        raise ValueError("Tailscale가 호스트 이름을 제공하지 않았습니다. MagicDNS를 활성화하고 로그인하세요.")
    return 'https://' + host + (':' + str(port) if port != 443 else '')


def port_in_use(config, port):
    """Foreground sessions and background rules belong to their original owners."""
    if not isinstance(config, dict):
        return False
    if str(port) in config.get('TCP', {}):
        return True
    if any(str(host).rsplit(':', 1)[-1] == str(port) for host in config.get('Web', {})):
        return True
    return any(port_in_use(item, port) for item in config.get('Foreground', {}).values())


def _layers(config):
    if not isinstance(config, dict):
        return
    yield config
    foreground = config.get('Foreground')
    if isinstance(foreground, dict):
        for value in foreground.values():
            yield from _layers(value)


def _web_entries(config):
    for layer in _layers(config):
        web = layer.get('Web')
        if isinstance(web, dict):
            yield from web.items()


def _web_key(value):
    if not isinstance(value, str):
        return None
    host, separator, port = value.rpartition(':')
    if not separator or not host or not port.isdigit():
        return None
    return host.rstrip('.').lower(), int(port)


def desired_route(entry, backend_port):
    public = urlsplit(entry.get('publicUrl', ''))
    host = (public.hostname or '').rstrip('.').lower()
    port = entry.get('tailscalePort')
    if not host or type(port) is not int:
        raise ValueError('Tailscale 고정 주소가 잘못되었습니다. 연결 구성을 다시 확인하고 저장하세요.。')
    return ((host, port), f'http://127.0.0.1:{backend_port}',
            entry.get('tailscaleMode') == 'funnel')


def route_state(config, entry, backend_port, target_validator=None):
    """Return none, same, or other without taking over an unrelated rule."""
    expected_key, expected_target, funnel = desired_route(entry, backend_port)
    matches = [(key, value) for key, value in _web_entries(config)
               if _web_key(key) == expected_key]
    if matches:
        if len(matches) != 1:
            return 'other'
        value = matches[0][1]
        handlers = value.get('Handlers') if isinstance(value, dict) else None
        root = handlers.get('/') if isinstance(handlers, dict) else None
        target = root.get('Proxy') if isinstance(root, dict) else None
        if set(handlers or {}) != {'/'} or not isinstance(target, str):
            return 'other'
        normalized = target.rstrip('/')
        if normalized != expected_target and not (target_validator and target_validator(normalized)):
            return 'other'
        allowed = any(layer.get('AllowFunnel', {}).get(f'{expected_key[0]}:{expected_key[1]}') is True
                      for layer in _layers(config)
                      if isinstance(layer.get('AllowFunnel'), dict))
        if allowed != funnel:
            return 'other'
        return 'same'
    return 'other' if port_in_use(config, expected_key[1]) else 'none'


def inspect(entry):
    binary = executable()
    if not binary:
        return {'state': 'missing', 'available': False,
                'message': "Tailscale를 찾을 수 없습니다. 공식 클라이언트를 설치하고 먼저 로그인하세요."}
    status = command_json(binary, ['status', '--json'])
    version = str(status.get('Version', ''))
    match = re.match(r'(\d+)\.(\d+)', version)
    if not match or tuple(map(int, match.groups())) < (1, 52):
        raise ValueError("Tailscale를 버전 1.52 이상으로 업데이트하세요.")
    if status.get('BackendState') != 'Running':
        return {'state': 'login', 'available': True, 'version': version,
                'authUrl': authorization_url(status.get('AuthURL', '')),
                'message': "Tailscale에 로그인하고 연결한 후 다시 검색하세요."}
    node = status.get('Self') or {}
    if node.get('KeyExpired'):
        raise ValueError("Tailscale 장치 인증이 만료되었습니다. 다시 로그인하세요.")
    node_id = node.get('ID', '')
    if not isinstance(node_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', node_id):
        raise ValueError("Tailscale 장치 ID를 읽을 수 없습니다. 공식 클라이언트를 업데이트하고 로그인하세요.")
    return {'state': 'ready', 'available': True, 'version': version,
            'url': device_url(status, entry.get('tailscalePort', 443)), 'nodeId': node_id,
            'message': "Tailscale URL가 감지되었습니다. 저장하고 게이트웨이를 시작한 다음 고정된 항목을 확인하십시오."}


def require_identity(entry):
    state = inspect(entry)
    if state['state'] != 'ready':
        raise ValueError(state['message'])
    if state['url'] != entry.get('publicUrl') or state['nodeId'] != entry.get('tailscaleNodeId'):
        raise ValueError("Tailscale 계정 또는 장치 주소가 변경되었습니다. 연결을 다시 감지하고 저장하십시오.")
    return state


class TailscaleTunnel:
    ROUTE_CHECK_INTERVAL = 60.0
    ROUTE_RECHECK_INTERVAL = 3.0
    ROUTE_FAILURE_LIMIT = 3

    def __init__(self, entry, port, data_dir, target_validator=None):
        self.entry, self.port, self.data_dir = entry, port, Path(data_dir)
        self.target_validator = target_validator
        self.stopped = threading.Event()
        self.wake = threading.Event()
        self.retry_wake = threading.Event()
        self.ready = threading.Event()
        self.connected = threading.Event()
        self.lock = threading.Lock()
        self.process = self.thread = self.reader = None
        self.last_status = None

    def status(self, state, message, auth_url=''):
        if state == 'connected':
            self.connected.set()
        record = {'pid': os.getpid(), 'state': state, 'message': message,
                  'url': self.entry['publicUrl'], 'authUrl': authorization_url(auth_url)}
        if record != self.last_status:
            write_json(self.data_dir/('ssh-status-' + self.entry['id'] + '.json'), record)
            self.last_status = record

    def start(self):
        self.thread = threading.Thread(target=self._run, name='tailscale-entry', daemon=True)
        self.thread.start()

    def network_changed(self):
        self.retry_wake.set()
        self.wake.set()
        return True

    def _route_state(self, binary):
        require_identity(self.entry)
        config = command_json(binary, ['serve', 'status', '--json'])
        return route_state(config, self.entry, self.port, self.target_validator)

    def _wait_for_route_check(self, interval):
        self.wake.wait(interval)
        self.wake.clear()

    def _monitor_adopted(self, binary):
        return self._monitor(binary)

    def _monitor_process(self, process, binary):
        return self._monitor(binary, process)

    def _monitor(self, binary, process=None):
        failures = conflicts = 0
        interval = self.ROUTE_CHECK_INTERVAL
        while not self.stopped.is_set() and (process is None or process.poll() is None):
            if process is not None and not self.ready.is_set():
                # Await the CLI's readiness/authorization result without polling
                # or restarting a foreground process still awaiting user consent.
                self._wait_for_route_check(None)
                continue
            self._wait_for_route_check(interval)
            # This fresh check handles network events received during the wait.
            # A later event can still interrupt the retry backoff.
            self.retry_wake.clear()
            if self.stopped.is_set() or (process is not None and process.poll() is not None):
                break
            try:
                state = self._route_state(binary)
            except ValueError:
                conflicts = 0
                failures += 1
                interval = self.ROUTE_RECHECK_INTERVAL
                self.status('retrying', 'Tailscale 일시적으로 입구를 폐쇄하여 재점검 중입니다.…')
                if failures >= self.ROUTE_FAILURE_LIMIT:
                    return 'retry'
                continue
            failures = 0
            if state == 'same':
                conflicts = 0
                interval = self.ROUTE_CHECK_INTERVAL
                self.status('connected', 'Tailscale 고정 포털이 시작되어 연결 상태를 유지함。')
            elif state == 'none':
                self.status('retrying', 'Tailscale 고정 항목이 손실되어 다시 설정되는 중입니다.…')
                return 'retry'
            else:
                conflicts += 1
                interval = self.ROUTE_RECHECK_INTERVAL
                if conflicts >= self.ROUTE_FAILURE_LIMIT:
                    self.status('blocked', "다른 서비스에서는 이 Tailscale 포트를 사용합니다. 다른 포트를 선택하십시오. 기존 설정은 덮어쓰이지 않습니다.")
                    return 'blocked'
                self.status('retrying', 'Tailscale 입력상태가 변경되어 재확인 중입니다.…')
        return 'stopped' if self.stopped.is_set() else 'retry'

    def _read(self, process):
        try:
            for line in process.stdout:
                if self.stopped.is_set():
                    break
                urls = re.findall(r'https://[^\s<>"\x1b]+', line)
                auth_url = next((authorization_url(url) for url in urls if authorization_url(url)), '')
                if auth_url:
                    self.status('authorization', "계속 연결하려면 Tailscale HTTPS 또는 유입경로 인증을 완료하세요.", auth_url)
                elif 'Available on the internet' in line or 'Available within your tailnet' in line:
                    self.status('connected', "Tailscale 항목이 시작되었습니다. 고정된 항목을 확인하고 휴대폰에서 인증하세요.")
                    self.ready.set()
                    self.wake.set()
        finally:
            self.ready.clear()
            # EOF can precede the process becoming waitable. Wake the monitor
            # after exit so an authorization-stage failure cannot be missed.
            process.wait()
            self.wake.set()

    def _run(self):
        delay = 3
        while not self.stopped.is_set():
            self.status('connecting', "Tailscale 고정 항목을 시작하는 중…")
            process = None
            reader = None
            result = 'retry'
            self.ready.clear()
            self.connected.clear()
            self.retry_wake.clear()
            try:
                require_identity(self.entry)
                binary = executable()
                config = command_json(binary, ['serve', 'status', '--json'])
                state = route_state(config, self.entry, self.port, self.target_validator)
                if state == 'other':
                    self.status('blocked', "다른 서비스에서는 이 Tailscale 포트를 사용합니다. 다른 포트를 선택하십시오. 기존 설정은 덮어쓰이지 않습니다.")
                    return
                if state == 'same':
                    delay = 3
                    self.status('connected', '기존 Tailscale 고정 접속 경로를 사용하며 연결 상태를 확인합니다.')
                    result = self._monitor_adopted(binary)
                else:
                    # Foreground sessions are removed by tailscaled when this CLI
                    # disconnects. Never use --bg, reset, down, or logout here.
                    flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
                    with self.lock:
                        if self.stopped.is_set():
                            return
                        process = self.process = subprocess.Popen(
                            [binary, self.entry['tailscaleMode'], '--https=' + str(self.entry['tailscalePort']),
                             'http://127.0.0.1:' + str(self.port)], stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            encoding='utf-8', errors='replace', **flags)
                    reader = self.reader = threading.Thread(
                        target=self._read, args=(process,), name='tailscale-entry-output', daemon=True)
                    reader.start()
                    result = self._monitor_process(process, binary)
            except (OSError, ValueError) as exc:
                if not self.stopped.is_set():
                    self.status('retrying', str(exc) if isinstance(exc, ValueError) else "Tailscale 항목의 연결이 끊어졌습니다. 재시도 중입니다.")
            finally:
                if process:
                    self._terminate(process)
                    if reader:
                        reader.join(timeout=3)
                    if process.stdout:
                        process.stdout.close()
                with self.lock:
                    self.process = None
                    self.reader = None
                self.ready.clear()
            if result == 'blocked':
                return
            if self.stopped.is_set():
                break
            if self.last_status and self.last_status['state'] in ('connected', 'connecting', 'authorization'):
                self.status('retrying', "Tailscale 항목이 연결을 유지하지 못했습니다. 클라이언트, 네트워크 및 유입경로 인증을 확인하세요.")
            if self.connected.is_set():
                delay = 3
            self.retry_wake.wait(delay)
            if self.stopped.is_set():
                break
            delay = min(60, delay * 2)

    @staticmethod
    def _terminate(process):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)

    def close(self):
        self.stopped.set()
        self.retry_wake.set()
        self.wake.set()
        with self.lock:
            if self.process:
                self._terminate(self.process)
        if self.thread:
            self.thread.join(timeout=20)
        if self.reader and self.reader is not threading.current_thread():
            self.reader.join(timeout=3)
        self.status('stopped', "Tailscale 고정 항목이 중지되었습니다.")
