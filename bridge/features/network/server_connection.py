"""SSH setup and supervised loopback forwarding. Host keys are explicitly pinned."""
import base64
import hashlib
import os
import select
import socket
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from bridge.features.notifications.channels import read_json, write_json


def library():
    try:
        import paramiko
        return paramiko
    except ImportError as exc:
        raise ValueError('서버 연결 구성 요소가 없습니다. 전체 데스크톱을 사용하십시오. App 또는 설치 requirements-desktop.txt。') from exc


def endpoint(entry):
    result = {'host': entry.get('sshHost', ''), 'port': entry.get('sshPort', 22),
              'user': entry.get('sshUser', ''), 'key': entry.get('sshKeyPath', '')}
    if entry.get('sshAuth', 'config') == 'config':
        target = entry['sshTarget']
        user, _, alias = target.rpartition('@')
        config = Path.home()/'.ssh/config'
        options = library().SSHConfig.from_path(str(config)).lookup(alias) if config.exists() else {}
        if options.get('proxycommand') or options.get('proxyjump'):
            raise ValueError('이 SSH 별칭은 스프링보드 연결을 사용합니다. 배포 패키지를 내보내거나 직접 연결이 가능한 서버 주소로 변경해주세요.。')
        result = {'host': options.get('hostname', alias), 'port': int(options.get('port', 22)),
                  'user': user or options.get('user', ''), 'key': next(iter(options.get('identityfile', [])), '')}
        if not result['user']:
            import getpass
            result['user'] = getpass.getuser()
    return result


def fingerprint(key):
    return 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')


def identity(entry):
    ep = endpoint(entry)
    return f'{ep["host"]}:{ep["port"]}'


def host_probe(entry, data_dir):
    ep = endpoint(entry)
    with socket.create_connection((ep['host'], ep['port']), timeout=10) as sock:
        transport = library().Transport(sock)
        try:
            transport.start_client(timeout=10)
            key = transport.get_remote_server_key()
            value = {'host': ep['host'], 'port': ep['port'], 'type': key.get_name(),
                     'key': key.get_base64(), 'fingerprint': fingerprint(key)}
        finally:
            transport.close()
    known = read_json(Path(data_dir)/'server-host-keys.json', {}).get(identity(entry))
    value['trusted'] = bool(known and known['key'] == value['key'] and known['type'] == value['type'])
    value['changed'] = bool(known and not value['trusted'])
    return value


def trust(entry, data_dir, expected):
    current = host_probe(entry, data_dir)
    if current['fingerprint'] != expected:
        raise ValueError('서버 호스트 지문이 변경되었습니다. 다시 확인하세요. 아직 신뢰가 저장되지 않았습니다。')
    known = read_json(Path(data_dir)/'server-host-keys.json', {})
    known[identity(entry)] = {key: current[key] for key in ('type', 'key', 'fingerprint')}
    write_json(Path(data_dir)/'server-host-keys.json', known)
    return {'message': "호스트 지문이 저장되었습니다. 이제 SSH 연결을 확인할 수 있습니다."}


def credentials(entry, data_dir, temporary=None):
    if temporary is not None:
        return temporary
    if entry.get('sshAuth', 'config') in ('password', 'key') or entry['accessMode'] == 'cloudflare':
        from bridge.features.accounts.secrets import read
        return read(data_dir, entry['id'])
    return {}


def managed(entry, data_dir):
    if entry.get('sshAuth', 'config') != 'config':
        return True
    known = read_json(Path(data_dir)/'server-host-keys.json', {})
    if not known:
        return False
    try:
        return identity(entry) in known
    except ValueError:
        return False


def connect(entry, data_dir, secrets=None):
    api = library()
    ep = endpoint(entry)
    known = read_json(Path(data_dir)/'server-host-keys.json', {}).get(identity(entry))
    if not known:
        raise ValueError("먼저 서버 호스트 지문을 확인하고 확인하세요.")
    client = api.SSHClient()
    host = ep['host'] if ep['port'] == 22 else f'[{ep["host"]}]:{ep["port"]}'
    key = api.PKey.from_type_string(known['type'], base64.b64decode(known['key']))
    client.get_host_keys().add(host, known['type'], key)
    secret = credentials(entry, data_dir, secrets)
    mode = entry.get('sshAuth', 'config')
    if mode == 'password' and not secret.get('password'):
        raise ValueError('작성해주세요 SSH 비밀번호를 입력하고 저장하세요. 이번에 사용한 비밀번호만 다시 열어야 합니다. App 그런 다음 다시 입력하세요.。')
    try:
        client.connect(ep['host'], port=ep['port'], username=ep['user'],
                       password=secret.get('password') if mode == 'password' else None,
                       key_filename=str(Path(ep['key']).expanduser()) if ep['key'] else None,
                       passphrase=secret.get('passphrase'), allow_agent=mode in ('agent', 'config'),
                       look_for_keys=mode == 'config', timeout=10, banner_timeout=10, auth_timeout=15)
        client.get_transport().set_keepalive(15)
        return client
    except api.BadHostKeyException as exc:
        client.close()
        raise ValueError("서버 지문이 저장된 기록과 다릅니다. 연결이 거부되었습니다.") from exc
    except api.AuthenticationException as exc:
        client.close()
        raise ValueError("SSH 인증에 실패했습니다. 사용자 이름, 비밀번호 또는 개인 키를 확인하세요.") from exc
    except Exception as exc:
        client.close()
        raise ValueError("SSH 연결에 실패했습니다. 주소, 포트, 키, 네트워크를 확인하세요.") from exc


def inspect(entry, data_dir, secrets=None):
    """Authenticate only: never open a remote shell or change server settings."""
    client = connect(entry, data_dir, secrets)
    try:
        try:
            parsed = urlsplit(entry['publicUrl'])
            addresses = sorted({item[4][0] for item in socket.getaddrinfo(
                parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)})
        except OSError:
            addresses = []
        return {'message': "SSH 로그인이 통과되었습니다. 전달 권한 및 HTTPS 액세스는 확인되지 않습니다. 수동 설정을 완료한 후 연결을 시작하고 고정된 항목을 확인하세요.",
                'dnsAddresses': addresses, 'dnsReady': bool(addresses),
                'upstream': 'http://127.0.0.1:'+str(entry['sshRemotePort'])}
    finally:
        client.close()


class ManagedForward:
    def __init__(self, entry, local_port, data_dir, secrets=None):
        self.entry, self.local_port, self.data_dir, self.secrets = entry, local_port, Path(data_dir), secrets
        self.stopped = threading.Event()
        self.client = None
        self.thread = None
        self.channels = set()
        self.lock = threading.Lock()

    def status(self, state, message):
        write_json(self.data_dir/('ssh-status-'+self.entry['id']+'.json'),
                   {'pid': os.getpid(), 'state': state, 'message': message})

    def start(self):
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _relay(self, channel):
        sock = None
        try:
            sock = socket.create_connection(('127.0.0.1', self.local_port), timeout=10)
            sock.settimeout(30)
            channel.settimeout(30)
            while not self.stopped.is_set():
                ready, _, _ = select.select([sock, channel], [], [], 1)
                if sock in ready:
                    data = sock.recv(65536)
                    if not data:
                        break
                    channel.sendall(data)
                if channel in ready:
                    data = channel.recv(65536)
                    if not data:
                        break
                    sock.sendall(data)
        except (OSError, EOFError):
            pass
        finally:
            if sock:
                sock.close()
            channel.close()
            with self.lock:
                self.channels.discard(channel)

    def _run(self):
        delay = 2
        while not self.stopped.is_set():
            try:
                self.status('connecting', "서버에 연결하는 중…")
                self.client = connect(self.entry, self.data_dir, self.secrets)
                if self.stopped.is_set():
                    break
                transport = self.client.get_transport()
                transport.request_port_forward('127.0.0.1', self.entry['sshRemotePort'])
                self.status('connected', "SSH 전달이 설정되었습니다. 수정된 HTTPS 항목을 확인하세요.")
                delay = 2
                while not self.stopped.is_set() and transport.is_active():
                    channel = transport.accept(1)
                    if channel:
                        with self.lock:
                            if len(self.channels) >= 128:
                                channel.close()
                                continue
                            self.channels.add(channel)
                        threading.Thread(target=self._relay, args=(channel,), daemon=True).start()
            except Exception:
                self.status('retrying', "SSH의 연결이 끊어졌거나 실패했습니다. 재시도 중입니다. 자격 증명, 호스트 지문 및 루프백 포트를 확인하십시오.")
            finally:
                if self.client:
                    self.client.close()
            if self.stopped.wait(delay):
                break
            delay = min(30, delay*2)
        self.status('stopped', 'SSH 전달이 중지되었습니다.')

    def close(self):
        self.stopped.set()
        if self.client:
            self.client.close()
        with self.lock:
            for channel in list(self.channels):
                channel.close()
        if self.thread:
            self.thread.join(timeout=5)


def diagnostic_prompt(entry, language=None):
    """Prepare text for the user to paste into an Agent on the server; never run it."""
    import json
    reference = json.dumps({'httpsUrl': entry['publicUrl'], 'sshUser': entry.get('sshUser') or '(from SSH config)',
                            'sshPort': entry['sshPort'] if entry.get('sshAuth') != 'config' else '(from SSH config)',
                            'loopbackUpstream': 'http://127.0.0.1:'+str(entry['sshRemotePort'])},
                           ensure_ascii=False, indent=2)
    if language == 'en':
        return '''Please inspect this server for a Codex Mobile Bridge SSH reverse-tunnel entry using read-only checks.
Reference configuration (not shell commands):
''' + reference + '''
Check the current user and OS; existing Caddy/Nginx/other HTTPS proxies and their service status; listeners on ports 80, 443, the configured HTTPS port and the loopback port; domain resolution; and the configured user's remote forwarding permissions and loopback binding rules, where readable. Distinguish observed facts, missing services, conflicts and checks you could not perform. A local check does not prove public reachability or phone access.
Do not run sudo, request administrator credentials, install software, edit files, change permissions, firewall or DNS rules, reload services, start containers, or create an SSH tunnel. Do not read or output passwords, tokens, private keys or unrelated configuration. If access is insufficient, report that check as unverified without escalating privileges.
Return: a findings table; whether an existing HTTPS proxy can be reused; missing prerequisites or conflicts; and a minimal numbered list of actions for the user to perform manually. Explain administrative actions, but do not execute them. Preserve all existing sites and services. The computer will run the gateway and initiate SSH; this server only hosts the HTTPS proxy and loopback listener.
'''
    return '''이 서버에서 다음을 수행하십시오. Codex Mobile Bridge 의 SSH 역방향 터널 항목은 읽기 전용 상태 확인을 수행합니다.。
참조 구성（실행 보류 중이 아님） Shell 주문하다）：
''' + reference + '''
확인하십시오: 현재 사용자 및 시스템; 하나라도 있는지 Caddy、Nginx 또는 기타 HTTPS 역방향 프록시 및 실행 상태；80、443、~ 위에 HTTPS 주소 지정 포트 및 루프백 포트 점유 도메인 이름 확인; 읽기 가능한 범위 내에서 대상 일반 사용자에 대한 원격 포트 포워딩 권한 및 루프백 바인딩 규칙. 관찰된 사실, 누락된 서비스, 구성 충돌, 검사할 수 없는 항목을 구별합니다. 현지 조사에서는 공중망이나 휴대폰 접속이 정상인지 입증할 수 없음。
읽기 전용 확인, 실행하지 않음 sudo，관리자 자격 증명을 요청하지 않고 소프트웨어를 설치하거나 파일을 수정하지 않습니다./권한/방화벽/DNS，서비스를 다시 로드하거나 컨테이너 또는 터널을 시작하지 마십시오. 비밀번호를 읽거나 출력하지 마세요.、Token、SSH 개인 키와 관련 없는 구성. 권한이 부족한 경우 표시“확인되지 않음”，권위를 높이지 마라。
출력해 주십시오: 현재 상태 테이블; 기존 것을 재사용할 수 있나요？ HTTPS 서비스; 누락된 조건 또는 충돌; 사용자가 수동으로 완료해야 하는 최소 단계 목록입니다. 관리자 권한과 관련된 단계는 설명만 되어 있고 실행되지는 않습니다. 기존 웹사이트와 서비스를 유지하세요. 컴퓨터는 게이트웨이를 실행하고 적극적으로 설정하는 역할을 담당합니다. SSH，이 서버는 다음을 제공합니다. HTTPS 프록시 및 루프백 항목。
'''
