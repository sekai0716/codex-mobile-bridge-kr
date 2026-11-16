"""Local desktop controller. No management API is exposed to the network."""
import http.client
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl

from bridge.resources import project_root

from bridge.features.auth.auth import Auth, password_record, session_hours, session_file_lock, INITIAL_CREDENTIAL_NAMES, initial_credentials_path
from bridge.app.lifecycle import read_record, request_stop, request_pairing
from bridge.features.notifications.channels import Notifications, read_json, write_json, settings, save_settings, save_webhook_endpoint, webhook_config, publish, publish_bark, publish_pushplus, publish_webhook, visible_webhook, WebhookDeliveryError, resolved_webhook_provider
from bridge.features.sessions.store import SessionStore, StoreUnavailable
from bridge.clients.codex.remote import AppHosts
from bridge.clients.codex.catalog import Catalog
import bridge.features.network.access as access
import bridge.features.network.addresses as network
import bridge.features.network.interfaces as interfaces
from bridge.features.network.adaptation import settings as adaptation_settings, migrate_legacy_interfaces
from bridge.features.network.tunnel import quick_url_path
from bridge.api.validation import FieldError, at_field


class Desktop:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir).expanduser().resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.config_path = self.data_dir/'config.json'
        self.local_bridge = None
        self.local_sessions = None
        self.starting_until = 0
        self.watch_hosts = None

    def close_local(self, check_busy=False):
        if self.local_bridge:
            accounts = self.local_bridge.accounts
            if check_busy:
                accounts.assert_editable()
                if accounts.thread and accounts.thread.is_alive():
                    raise ValueError('게이트웨이를 시작하기 전에 계정 작업이 완료될 때까지 기다리십시오.')
            # Finish in-flight account reads before transferring ownership.
            with self.local_bridge.account.lock:
                if self.local_sessions:
                    self.local_sessions.close()
                self.local_bridge.close()
            self.local_bridge = self.local_sessions = None

    def local_services(self):
        if time.monotonic() < self.starting_until:
            raise ValueError("게이트웨이가 시작 중입니다. 잠시 후 다시 시도하세요.")
        if self.local_bridge is None:
            from bridge.app.service import Bridge
            from bridge.clients.manager import DesktopSessions
            from bridge.clients.discovery import discover_clients, inventory_current
            p = self.preferences()
            saved = read_json(self.data_dir/'desktop-sessions/settings.json', {})
            inputs = {**p, **{key: value for key, value in saved.items()
                               if key.endswith(('Home', 'Application', 'Applications'))}}
            if saved.get('discoveryPreferences', {}).get('desktopExecutable'):
                inputs['desktopExecutable'] = saved['discoveryPreferences']['desktopExecutable']
            discovered = saved['discovered'] if inventory_current(saved, inputs) else discover_clients(inputs)
            runtime = p.get('codexBin')
            # Keep ordinary Windows installations automatic across App updates.
            # Preserve discovery's fallback for nonstandard desktop bundles.
            if not runtime and (os.name != 'nt' or not Catalog.find_runtime()):
                runtime = discovered['codex'].get('runtime')
            self.local_bridge = Bridge(Path(p['codexHome']).expanduser(), self.data_dir,
                                       ipc_path=p.get('ipcPath') or None, codex_bin=runtime or None)
            self.local_sessions = DesktopSessions(self.data_dir, self.local_bridge)
        return self.local_bridge, self.local_sessions

    def local_control(self, action, capability, value):
        record = read_record(self.data_dir/'gateway-control.json')
        if record:
            if not self.status()['running']:
                raise ValueError("게이트웨이 상태를 사용할 수 없습니다. 곧 새로고침하세요.")
            if not record.get(capability):
                raise ValueError('클라이언트 관리를 활성화하려면 게이트웨이를 다시 시작하세요.')
            self.close_local(check_busy=True)
            self.starting_until = 0
            # Claude's normal exit can spend 75 seconds saving after menu dispatch.
            return request_pairing(self.data_dir, {'action': action, 'value': value}, timeout=140)
        bridge, sessions = self.local_services()
        if action == 'desktop-sessions':
            return sessions.control(value)
        if action == 'cli-access':
            return bridge.cli_access_control(value)
        return bridge.accounts_control(value) if action == 'accounts' else bridge.accounts.account(value)

    def config(self):
        if not self.config_path.exists():
            password = secrets.token_urlsafe(18)
            write_json(self.config_path, {'auth': {'mode': 'password', 'username': 'admin', **password_record(password)}, 'origins': []})
            credentials = self.data_dir/'첫 로그인.txt'
            credentials.write_text('Codex App 모바일 게이트웨이\n계정: admin\n비밀번호: '+password+'\n', encoding='utf-8')
            credentials.chmod(0o600)
        return read_json(self.config_path, {})

    def preferences(self):
        name = 'cloudflared.exe' if os.name == 'nt' else 'cloudflared'
        executable = self.data_dir/'bin'/name
        bundled = Path(getattr(sys, '_MEIPASS', project_root()/'dist'))/'cloudflared'/name
        detected = str(bundled) if bundled.is_file() else str(executable) if executable.is_file() else shutil.which(name) or ''
        if not detected and sys.platform == 'darwin':
            detected = next((value for value in ('/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared') if Path(value).is_file()), '')
        defaults = {'autoStart': False, 'port': 8787, 'lan': True, 'lanAddresses': None, 'lanInterfaces': None,
                    'localAccess': True, 'tunnel': quick_url_path(self.data_dir).is_file(),
                    'cloudflared': detected,
                    'codexHome': os.environ.get('CODEX_HOME', str(Path.home()/'.codex')),
                    'ipcPath': '', 'codexBin': ''}
        saved = read_json(self.data_dir/'desktop.json', {})
        if not saved.get('cloudflared') or not Path(saved['cloudflared']).is_file():
            saved['cloudflared'] = defaults['cloudflared']
        if 'lanInterfaces' not in saved:
            if saved.get('lanAddresses') is not None:
                rows = interfaces.enumerate_interfaces()
                saved['lanInterfaces'] = interfaces.migrate_addresses_to_interfaces(
                    rows, network.selected_addresses(saved.get('lanAddresses')))
            else:
                saved['lanInterfaces'] = None
        rows = access.connections({**defaults, **saved})
        return {**defaults, **{k: v for k, v in saved.items() if k not in access.DEFAULTS},
                'connections': rows, 'tunnel': any(c['enabled'] and c['accessMode'] == 'quick' for c in rows)}

    def status(self):
        preferences = self.preferences()
        connected, supports, instance = False, False, None
        try:
            connection = http.client.HTTPConnection('127.0.0.1', preferences['port'], timeout=1)
            try:
                connection.request('GET', '/api/health')
                response = connection.getresponse()
                payload = json.loads(response.read(65536))
                if response.status != 200 or payload.get('service') != 'codex-mobile-bridge':
                    connection.request('GET', '/api/auth')
                    response = connection.getresponse()
                    payload = json.loads(response.read(65536))
                connected = response.status == 200 and (payload.get('service') == 'codex-mobile-bridge' or ('authenticated' in payload and 'passwordless' in payload))
                supports = bool(payload.get('notifications'))
                instance = payload.get('instanceId')
            finally:
                connection.close()
        except (OSError, ValueError, http.client.HTTPException):
            pass
        record = read_record(self.data_dir/'gateway-control.json')
        managed = connected and bool(record) and (not record.get('instanceId') or record['instanceId'] == instance)
        if not managed and record and record.get('instanceId'):
            # A specific loopback listener (for example an SSH forward) can
            # shadow a LAN listener. Verify the live owner through its
            # existing authenticated local channel, never merely a saved PID.
            try:
                reply = request_pairing(self.data_dir, {'action': 'status', 'ids': []}, timeout=1)
                if reply == {'states': {}} and read_record(self.data_dir/'gateway-control.json') == record:
                    managed = True
                    instance = record['instanceId']
                    supports = bool(record.get('notificationManagement'))
            except (OSError, ValueError):
                pass
        return {'running': managed, 'portOccupied': connected and not managed, 'supportsNotifications': supports,
                'pid': record.get('pid') if managed else None, 'instanceId': instance if managed else None}

    def snapshot(self):
        config = self.config()
        preferences = self.preferences()
        runtime = self.status()
        selected = interfaces.selected_interfaces(preferences.get('lanInterfaces'))
        network_status = {}
        if runtime['running']:
            value = read_json(self.data_dir/'network-status.json', {})
            if (value.get('pid') == runtime.get('pid') and
                    value.get('instanceId') == runtime.get('instanceId') and
                    value.get('mode') == ('off' if not preferences['lan'] else
                                          'all' if selected is None else 'selected')):
                network_status = {key: item for key, item in value.items() if key != 'updatedAt'}
        # The owned runtime publishes successfully bound addresses. A detected
        # address can still be settling or have failed to bind; never advertise it.
        rows = network_status.get('interfaces') if network_status else interfaces.enumerate_interfaces()
        if runtime['running']:
            static_addresses = network.selected_addresses(network_status.get('addresses', [])) or []
        else:
            static_addresses = (interfaces.eligible_lan_addresses(rows) if selected is None else
                                interfaces.addresses_for_interfaces(rows, selected))
        hosts = ['127.0.0.1', 'localhost'] + static_addresses if preferences['lan'] else ['127.0.0.1', 'localhost']
        if not preferences['localAccess']:
            hosts = [host for host in hosts if host not in ('127.0.0.1', 'localhost')]
        quick = read_json(self.data_dir/'cloudflare-status.json', {})
        if not runtime['running'] or quick.get('pid') != runtime.get('pid'):
            quick = {}
        quick_url = ''
        public = quick_url_path(self.data_dir)
        # Never offer a Quick Tunnel URL unless cloudflared says it is still ready.
        # A lost tunnel keeps its old text for a moment but its DNS record is gone.
        if runtime['running'] and preferences['tunnel'] and quick.get('state') == 'ready':
            # 새 게이트웨이는 현재 프로세스가 확인한 URL을 사용한다. 파일 fallback은 이전 버전용이다.
            value = quick.get('url')
            if not isinstance(value, str):
                lines = public.read_text(encoding='utf-8').splitlines() if public.is_file() else []
                value = lines[0] if lines else ''
            if value.startswith('https://'):
                quick_url = value
        urls = [url if url == quick_url else url+'/' for url in access.phone_urls(preferences, hosts, quick_url)]
        external = {}
        for entry in preferences['connections']:
            status = read_json(self.data_dir/('ssh-status-'+entry['id']+'.json'), {})
            if runtime['running'] and status.get('pid') == runtime.get('pid'):
                external[entry['id']] = status
        executable = preferences['cloudflared']
        cloudflared = {'path': executable, 'available': bool(executable and Path(executable).is_file() and os.access(executable, os.X_OK))}
        from bridge.features.notifications.addresses import entry_urls
        notification_urls = entry_urls(preferences, hosts, quick_url, external,
                                       lan_addresses=static_addresses) if runtime['running'] else []
        notifications = settings(self.data_dir)
        return {'preferences': preferences, 'auth': {'username': config['auth'].get('username', 'admin'), 'mode': config['auth']['mode'], 'sessionHours': config['auth'].get('sessionHours', 12)},
                'origins': config.get('origins', []), 'notifications': {**notifications, 'token': '', 'hasToken': bool(notifications['token']), 'barkKey': '', 'hasBarkKey': bool(notifications['barkKey']), 'pushplusToken': '', 'hasPushplusToken': bool(notifications['pushplusToken']), **visible_webhook(notifications)},
                'watches': self.notification_watches({'action': 'list'}, preferences=preferences)['watches'],
                'notificationUrls': notification_urls,
                'securityNotificationStatus': read_json(self.data_dir/'security-notifications.json', {}),
                'addressNotificationStatus': read_json(self.data_dir/'address-notifications.json', {}),
                'notificationStatus': read_json(self.data_dir/'notification-status.json', {}),
                'dataDir': str(self.data_dir), 'credentialsAvailable': initial_credentials_path(self.data_dir).is_file(),
                'networkInterfaces': rows, 'networkStatus': network_status,
                'networkAdaptation': {**adaptation_settings(self.data_dir),
                                      'running': runtime['running']},
                'runtime': runtime, 'urls': urls, 'externalStatus': external, 'cloudflared': cloudflared, 'quickTunnel': quick}

    def network_adaptation(self, value):
        if not isinstance(value, dict) or not (value == {'action': 'status'} or
                (set(value) == {'action', 'enabled'} and value['action'] == 'set'
                 and type(value['enabled']) is bool)):
            raise ValueError('네트워크 변경 자동 복구 요청이 잘못되었습니다.')
        record = read_record(self.data_dir/'gateway-control.json')
        runtime = self.status()
        if record:
            if not runtime['running']:
                raise ValueError("게이트웨이 상태를 사용할 수 없습니다. 곧 새로고침하세요.")
            if not record.get('networkAdaptationManagement'):
                raise ValueError('네트워크 변경사항의 자동 복구를 조정하려면 새 버전의 게이트웨이를 다시 시작하세요.')
            return request_pairing(self.data_dir, {'action': 'network-adaptation', 'value': value}, timeout=10)
        if runtime['running'] or runtime.get('portOccupied') or time.monotonic() < self.starting_until:
            raise ValueError('게이트웨이가 시작 중이거나 포트가 사용 중입니다. 나중에 새로 고치세요.')
        saved = adaptation_settings(self.data_dir,
                                    {'enabled': value['enabled']} if value['action'] == 'set' else None)
        return {**saved, 'running': False}

    def save(self, value):
        with session_file_lock(self.config_path):
            return self._save(value)

    def _save(self, value):
        old_preferences = self.preferences()
        preferences = {**old_preferences, **{k: v for k, v in value['preferences'].items() if k in old_preferences}}
        incoming_preferences = value.get('preferences', {})
        incoming_interfaces = incoming_preferences.get('lanInterfaces')
        if (incoming_interfaces is None and 'lanInterfaces' not in incoming_preferences) or \
                (incoming_interfaces is None and incoming_preferences.get('lanAddresses') is not None):
            preferences['lanInterfaces'] = interfaces.migrate_addresses_to_interfaces(
                interfaces.enumerate_interfaces(), incoming_preferences.get('lanAddresses',
                                                                          preferences.get('lanAddresses')))
        preferences['connections'] = access.validate_connections(preferences)
        preferences['tunnel'] = any(c['enabled'] and c['accessMode'] == 'quick' for c in preferences['connections'])
        port = preferences['port']
        if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
            raise FieldError("포트는 1~65535여야 합니다.", 'port')
        preferences['lanAddresses'] = at_field('lan-scope', network.selected_addresses, preferences['lanAddresses'])
        preferences['lanInterfaces'] = at_field('lan-scope', interfaces.selected_interfaces,
                                                preferences['lanInterfaces'])
        for key in ('lan', 'tunnel', 'autoStart', 'localAccess'):
            if not isinstance(preferences[key], bool):
                raise ValueError("잘못된 네트워크 스위치")
        for key in ('codexHome', 'codexBin', 'ipcPath', 'cloudflared'):
            if not isinstance(preferences[key], str) or '\x00' in preferences[key] or len(preferences[key]) > 4096:
                raise FieldError("잘못된 경로 형식", {'codexHome': 'codex-home', 'codexBin': 'codex-bin', 'ipcPath': 'ipc-path', 'cloudflared': 'cloudflared'}[key])
        if not Path(preferences['codexHome']).expanduser().is_dir():
            raise FieldError("Codex 데이터 디렉터리가 존재하지 않습니다.", 'codex-home')
        if self.status()['running'] and any(preferences[k] != old_preferences[k] for k in preferences if k != 'autoStart'):
            raise ValueError("현재 연결이 끊어지지 않도록 네트워크 설정이나 런타임 경로를 변경하기 전에 게이트웨이를 중지하세요.")
        config = self.config()
        old_auth = dict(config['auth'])
        auth = value['auth']
        if auth.get('mode') not in ('password', 'none') or not isinstance(auth.get('username'), str) or not auth['username'].strip() or len(auth['username']) > 200:
            raise FieldError("유효한 사용자 이름과 로그인 방법을 입력하세요.", 'username')
        if auth['mode'] == 'none' and any(c['enabled'] and c['accessMode'] == 'tailscale' and c['tailscaleMode'] == 'funnel' for c in preferences['connections']):
            raise FieldError("공개 유입경로에 액세스하려면 게이트웨이 로그인이 필요합니다. 휴대폰은 여전히 ​​QR 코드로 페어링할 수 있습니다.", 'auth-mode')
        password = auth.get('password', '')
        revoke_bound_devices = auth.get('revokeBoundDevices', True)
        if type(revoke_bound_devices) is not bool:
            raise FieldError("잘못된 장치 취소 옵션", 'revoke-bound-devices')
        hours = at_field('session-hours', session_hours, auth.get('sessionHours', config['auth'].get('sessionHours', 12)))
        if not isinstance(password, str) or (password and not 12 <= len(password) <= 1000):
            raise FieldError("새 비밀번호는 12자 이상이어야 합니다.", 'password')
        preserve_bound_devices = (bool(password) and not revoke_bound_devices and old_auth.get('mode') == 'password'
                                  and auth['mode'] == 'password' and old_auth.get('username') == auth['username'].strip())
        if preserve_bound_devices and (self.status()['running'] or self.status()['portOccupied']):
            raise ValueError("전화 바인딩을 유지하면서 비밀번호를 변경하기 전에 게이트웨이를 중지하세요.")
        origins = value.get('origins', [])
        if not isinstance(origins, list):
            raise FieldError("잘못된 추가 HTTPS 주소", 'origins')
        origins = list(dict.fromkeys(at_field('origins', access.origin, origin) for origin in origins))
        old_fixed = access.public_urls(old_preferences)
        origins = [origin for origin in origins if origin not in old_fixed]
        for fixed in access.public_urls(preferences):
            if fixed not in origins:
                origins.append(fixed)
        if self.status()['running'] and origins != config.get('origins', []):
            raise ValueError("HTTPS 주소를 변경하기 전에 게이트웨이를 중지한 다음 저장하고 다시 시작하세요.")
        if any(preferences[k] != old_preferences[k] for k in ('codexHome', 'codexBin', 'ipcPath')):
            self.close_local(check_busy=True)
        # Validate all values before writing any setting.
        notification_value = value.get('notifications', {})
        # save_settings performs the remaining validation; settings files have separate owners.
        save_settings(self.data_dir, notification_value)
        config['auth'].update(mode=auth['mode'], username=auth['username'].strip(), sessionHours=hours)
        if password:
            config['auth'].update(password_record(password))
        config['origins'] = origins
        config['publicUrl'] = access.public_url(preferences)
        config['connections'] = preferences['connections']
        config['lanAddresses'] = preferences['lanAddresses']
        config['lanInterfaces'] = preferences['lanInterfaces']
        config['localAccess'] = preferences['localAccess']
        if preserve_bound_devices:
            Auth.preserve_trusted_on_password_change(old_auth, config['auth'], self.data_dir,
                                                     lambda: write_json(self.config_path, config))
        else:
            write_json(self.config_path, config)
        write_json(self.data_dir/'desktop.json', preferences)
        if password:
            for name in INITIAL_CREDENTIAL_NAMES:
                (self.data_dir/name).unlink(missing_ok=True)
        return self.snapshot()

    def argv(self):
        p = self.preferences()
        args = ['--config', str(self.config_path), '--port', str(p['port']), '--codex-home', str(Path(p['codexHome']).expanduser())]
        for flag, key in [('--lan', 'lan'), ('--tunnel', 'tunnel')]:
            if p[key]:
                args.append(flag)
        for flag, key in [('--cloudflared', 'cloudflared'), ('--ipc-path', 'ipcPath'), ('--codex-bin', 'codexBin')]:
            if p[key]:
                args.extend([flag, p[key]])
        return args

    def start(self, value=None):
        temporary = (value or {}).get('connectionSecrets', {})
        self.config()
        state = self.status()
        if state['running']:
            return {'started': False, 'message': "실행 중인 게이트웨이에 연결됨"}
        self.close_local(check_busy=True)
        migrate_legacy_interfaces(self.config_path)
        preferences = self.preferences()
        if not Path(preferences['codexHome']).expanduser().is_dir():
            raise ValueError("기존 Codex 데이터 디렉터리를 먼저 선택하세요.")
        if any(c['enabled'] and c['accessMode'] in ('quick', 'cloudflare') for c in preferences['connections']):
            executable = preferences['cloudflared']
            if not executable or not Path(executable).is_file() or not os.access(executable, os.X_OK):
                raise ValueError("실행 가능한 cloudflared를 찾을 수 없습니다. 런타임 설정에서 설치하고 임시 Cloudflare 연결을 저장하거나 비활성화합니다.")
        access.validate_connections(preferences)
        from bridge.features.network.server_connection import managed
        if any(c['enabled'] and c['accessMode'] == 'server' and not managed(c, self.data_dir) for c in preferences['connections']) and not shutil.which('ssh'):
            raise ValueError("OpenSSH 클라이언트를 찾을 수 없습니다. 먼저 시스템 SSH 클라이언트를 설치하거나 활성화하세요.")
        from bridge.features.network.server_connection import credentials
        for entry in preferences['connections']:
            if not entry['enabled']:
                continue
            if entry['accessMode'] == 'tailscale':
                from bridge.features.network.tailscale import require_identity
                require_identity(entry)
            if entry['accessMode'] == 'cloudflare' or (entry['accessMode'] == 'server' and entry.get('sshAuth', 'config') != 'config'):
                secret = credentials(entry, self.data_dir, temporary.get(entry['id']))
                if entry['accessMode'] == 'cloudflare' and not secret.get('tunnelToken'):
                    raise FieldError("먼저 Cloudflare 터널 토큰을 입력하고 저장하세요.", 'tunnelToken', entry['id'])
                if entry['accessMode'] == 'server' and entry.get('sshAuth') == 'password' and not secret.get('password'):
                    raise FieldError("먼저 SSH 비밀번호를 입력하고 저장하세요.", 'password', entry['id'])
                temporary[entry['id']] = secret
        if preferences['lan']:
            rows = interfaces.enumerate_interfaces()
            for address in network.bindings(preferences, rows):
                probe = socket.socket()
                if os.name != "nt":
                    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    probe.bind((address, preferences['port']))
                except OSError as exc:
                    raise ValueError("선택한 어댑터 주소를 사용할 수 없거나 해당 포트가 사용 중입니다. 어댑터와 포트를 확인하세요. 다른 어댑터는 자동으로 열리지 않습니다.") from exc
                finally:
                    probe.close()
        command = [sys.executable] if getattr(sys, 'frozen', False) else [sys.executable, str(project_root()/'desktop.py')]
        command += ['serve', '--data-dir', str(self.data_dir), '--connection-secrets-stdin']
        kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
        # Frozen children run as independent applications, not multiprocessing workers.
        environment = {**os.environ, 'PYINSTALLER_RESET_ENVIRONMENT': '1'}
        with (self.data_dir/'gateway.log').open('ab') as log:
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=log, stderr=log, env=environment, **kwargs)
            process.stdin.write(json.dumps(temporary).encode('utf-8'))
            process.stdin.close()
        self.starting_until = time.monotonic() + 30
        return {'started': True, 'pid': process.pid, 'message': "게이트웨이 시작 중"}

    def stop(self):
        record = read_record(self.data_dir/'gateway-control.json') or {}
        if record.get('accountsManagement'):
            state = request_pairing(self.data_dir, {'action': 'accounts', 'value': {'action': 'list'}}, timeout=5)
            if state.get('switch', {}).get('phase') in ('preparing', 'stopping', 'applying', 'starting', 'verifying', 'restoring'):
                raise ValueError("게이트웨이를 중지하기 전에 계정 전환이 완료될 때까지 기다리세요.")
        request_stop(self.data_dir)
        self.starting_until = 0
        return {'message': '게이트웨이가 중지되었습니다.'}

    def accounts(self, value):
        return self.local_control('accounts', 'accountsManagement', value)

    def cli_access(self, value):
        return self.local_control('cli-access', 'cliAccessManagement', value)

    def desktop_sessions(self, value):
        return self.local_control('desktop-sessions', 'desktopSessionsManagement', value)

    def harness(self, value):
        from bridge.clients.deepseek.legacy_gateway import configuration, detect, save
        record = read_record(self.data_dir/'gateway-control.json') or {}
        if self.status()['running']:
            if not record.get('harnessManagement'):
                raise ValueError("Harness를 활성화하려면 게이트웨이를 다시 시작하세요.")
            return request_pairing(self.data_dir, {'action': 'harness', 'value': value}, timeout=80)
        if record:
            raise ValueError("게이트웨이 상태를 사용할 수 없습니다. 곧 새로고침하세요.")
        action = value.get('action', 'status')
        if action == 'save':
            save(self.data_dir, value.get('config', {}))
        elif action not in ('status', 'detect'):
            raise ValueError('먼저 게이트웨이를 시작해 주세요.')
        result = {'state': 'stopped', 'running': False, 'config': configuration(self.data_dir), 'logs': [], 'url': '/harness/'}
        if action == 'detect':
            result['detected'] = detect()
        return result

    def account(self, value):
        return self.local_control('account', 'accountManagement', value)

    def devices(self, value):
        if self.status()['running']:
            record = read_record(self.data_dir/'gateway-control.json') or {}
            if not record.get('deviceManagement'):
                raise ValueError("장치 관리를 활성화하려면 게이트웨이를 다시 시작하세요.")
            return request_pairing(self.data_dir, {'action': 'devices', 'value': value})
        if read_record(self.data_dir/'gateway-control.json'):
            raise ValueError("게이트웨이 상태를 일시적으로 사용할 수 없습니다. 잠시 후 장치 목록을 새로 고치십시오.")
        return Auth(self.config()['auth'], self.data_dir).manage(value)

    def notification_watches(self, value, *, preferences=None):
        if value.get('action') != 'list':
            record = read_record(self.data_dir/'gateway-control.json')
            if self.status()['running']:
                if not record or not record.get('notificationManagement'):
                    raise ValueError("채팅 알림을 관리하려면 게이트웨이를 다시 시작하세요.")
                request_pairing(self.data_dir, {'action': 'notification-watches', 'value': value}, timeout=35)
            elif record:
                raise ValueError("게이트웨이 상태를 사용할 수 없습니다. 곧 새로고침하세요.")
            else:
                Notifications(None, self.data_dir).control(value)
        rows = read_json(self.data_dir/'notification-watches.json', [])
        if not rows:
            return {'watches': rows}
        home = Path((preferences or self.preferences())['codexHome']).expanduser()
        store = SessionStore(home) if any(row['host'] == 'local' for row in rows) else None
        hosts = {}
        if any(row['host'] != 'local' for row in rows):
            if self.watch_hosts is None or self.watch_hosts.home != home:
                self.watch_hosts = AppHosts(home)
            hosts = self.watch_hosts.hosts(cached=True)
        for row in rows:
            row['hostLabel'] = '이 컴퓨터' if row['host'] == 'local' else hosts.get(row['host'], {}).get('displayName') or hosts.get(row['host'], {}).get('alias') or row['host']
            if row['host'] == 'local':
                try:
                    meta = store.get(row['id'])
                    row.update(title=meta.get('name') or meta.get('title') or '이름없는 채팅', cwd=meta.get('cwd', ''))
                except (KeyError, StoreUnavailable):
                    pass
            row['notifyOnCompletion'] = bool(row.get('notifyOnCompletion'))
        return {'watches': rows}

    def test_notification(self, value=None):
        if (value or {}).get('channel') == 'address':
            from bridge.features.notifications.addresses import send_address
            from bridge.features.notifications.channels import channels
            config = settings(self.data_dir)
            snapshot = self.snapshot()
            urls = snapshot['notificationUrls']
            targets = channels(config)
            if not config['addressEnabled'] or not targets:
                raise ValueError("입장 알림과 하나 이상의 채널을 활성화한 후 설정을 저장하세요.")
            if not urls:
                raise ValueError("게이트웨이를 시작하고 LAN 액세스를 활성화하거나 외부 항목이 준비될 때까지 기다리십시오.")
            failed = []
            for channel in targets:
                try:
                    send_address(config, channel, urls, test=True)
                except Exception:
                    failed.append(channel)
            if failed:
                raise ValueError('일부 채널에서 전송하지 못했습니다.：' + ', '.join(failed) + '；다른 채널에서 수신 여부를 휴대폰에서 확인해주세요.。')
            return {'message': "현재 항목을 활성화된 채널로 보냈습니다. 휴대폰으로 영수증을 확인하세요."}
        channel = (value or {}).get('channel', 'ntfy')
        webhook_id = (value or {}).get('webhookId', 'legacy')
        if channel not in ('ntfy', 'bark', 'pushplus', 'webhook'):
            raise ValueError('알 수 없는 알림 채널')
        name = {'bark': 'Bark', 'ntfy': 'ntfy', 'pushplus': 'PushPlus', 'webhook': 'Webhook'}[channel]
        sender = {'bark': publish_bark, 'ntfy': publish, 'pushplus': publish_pushplus, 'webhook': publish_webhook}[channel]
        config = settings(self.data_dir)
        if channel == 'webhook':
            config = webhook_config(config, webhook_id)
        elif 'webhookId' in (value or {}):
            raise ValueError("웹훅 ID는 웹훅 테스트에만 유효합니다.")
        try:
            sender(config, 'Codex 모바일 알림 테스트', f'이 메시지를 받았다는 뜻은 {name} 채널이 연결되었습니다。')
        except WebhookDeliveryError as error:
            raise ValueError(str(error)) from None
        except Exception:
            raise ValueError(f'{name} 테스트에 실패했습니다. 서비스 주소, 인증 및 네트워크를 확인하세요.') from None
        provider = resolved_webhook_provider(config) if channel == 'webhook' else 'generic'
        accepted = {'feishu': 'Feishu', 'dingtalk': 'DingTalk', 'discord': 'Discord', 'telegram': 'Telegram'}.get(provider, name) + ' 테스트 알림이 승인되었습니다.'
        return {'message': f'{accepted}，수신 여부를 휴대폰으로 확인해주세요.'}

    def deployment(self, value):
        entry = access.select_connection(self.preferences(), value)
        files = access.deployment(entry)
        return {'files': files, 'accessMode': entry['accessMode']}

    def export_deployment(self, value):
        files = access.deployment(access.select_connection(self.preferences(), value))
        path = self.data_dir/'고정 항목 배포.zip'
        with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content in files.items():
                archive.writestr(name, content)
        path.chmod(0o600)
        return {'path': str(path)}

    def read_credentials(self, value):
        # Explicit private IPC only. Never include plaintext in polled snapshots.
        if isinstance(value, dict) and value.get('channel') == 'webhook':
            if set(value) - {'channel', 'webhookId'}:
                raise ValueError('Webhook 주소 읽기 요청 형식이 잘못되었습니다.')
            return {'webhookUrl': webhook_config(settings(self.data_dir), value.get('webhookId', 'legacy')).get('webhookUrl', '')}
        if value.get('id'):
            from bridge.features.accounts.secrets import read
            if not any(c['id'] == value['id'] for c in self.preferences()['connections']):
                raise ValueError("먼저 연결 설정을 저장하세요.")
            return read(self.data_dir, value['id'])
        notification = settings(self.data_dir)
        result = {key: notification[key] for key in ('token', 'barkKey', 'pushplusToken')}
        initial = initial_credentials_path(self.data_dir)
        result['password'] = ''
        if initial.is_file():
            # 번역된 라벨의 길이로 비밀번호를 자르며 이전 배포의 라벨도 지원한다.
            prefixes = ('비밀번호: ', '비밀번호：', '비밀번호:', '\u5bc6\u7801：')
            result['password'] = next((line[len(prefix):] for line in initial.read_text(encoding='utf-8').splitlines()
                                       for prefix in prefixes if line.startswith(prefix)), '')
        return result

    def webhook_endpoint(self, value):
        config, selected = save_webhook_endpoint(self.data_dir, value)
        return {**visible_webhook(config), 'selectedWebhookId': selected}

    def connection_credentials(self, value):
        entry = next((c for c in self.preferences()['connections'] if c['id'] == value.get('id')), None)
        if not entry:
            raise ValueError("먼저 연결 설정을 저장하세요.")
        from bridge.features.accounts.secrets import save
        save(self.data_dir, entry['id'], value.get('secrets', {}))
        return {'message': "시스템 자격 증명 저장소에 저장된 연결 자격 증명입니다."}

    def server_setup(self, value):
        entry = access.select_connection(self.preferences(), value, allow_disabled=True)
        if entry['accessMode'] != 'server':
            raise ValueError("자체 호스팅 서버 연결을 선택합니다.")
        import bridge.features.network.server_connection as server_connection
        action = value.get('action')
        if action == 'diagnostics':
            return {'prompt': server_connection.diagnostic_prompt(entry, value.get('language'))}
        if action == 'host':
            return server_connection.host_probe(entry, self.data_dir)
        if action == 'trust':
            return server_connection.trust(entry, self.data_dir, value.get('fingerprint'))
        if action == 'inspect':
            return server_connection.inspect(entry, self.data_dir, value.get('secrets'))
        raise ValueError("이 앱은 SSH 연결 확인만 지원합니다. 서버 소프트웨어 및 권한을 수동으로 구성합니다.")

    def check_entry(self, value):
        status = self.status()
        if not status['running']:
            raise ValueError("고정된 항목을 확인하기 전에 게이트웨이를 시작하십시오.")
        return access.check_entry(access.select_connection(self.preferences(), value), instance_id=status.get('instanceId'))

    def tailscale_setup(self, value):
        from bridge.features.network.tailscale import inspect
        entry = access.select_connection(self.preferences(), value, allow_disabled=True)
        if entry['accessMode'] != 'tailscale':
            raise ValueError("Tailscale 연결을 선택합니다.")
        return inspect(entry)

    def pairing(self, value):
        if value.get('action') == 'create':
            from bridge.features.auth.pairing import phone_origin
            snapshot = self.snapshot()
            url = value.get('url')
            if not snapshot['runtime']['running'] or url not in snapshot['urls']:
                raise ValueError("QR 코드를 생성하기 전에 게이트웨이를 시작하세요.")
            origin = phone_origin(url)
            # Probe the actual entry, without credentials or redirects, before granting access.
            remote = access.read_auth(origin)
            if remote.get('instanceId') != snapshot['runtime']['instanceId']:
                raise ValueError("이 주소는 현재 게이트웨이를 가리키지 않습니다. 연결 설정을 확인하세요.")
        return request_pairing(self.data_dir, value)

    def transfer_settings(self, value=None):
        from bridge.features.workspace.preferences import transfer_settings
        return transfer_settings(self.data_dir, value or None)

    def logs(self):
        # Reverse complete timestamped records, keeping traceback lines readable.
        import re
        paths = [('Gateway', self.data_dir/'gateway.log'), ('Cloudflare', self.data_dir/'tunnel.log')]
        for entry in self.preferences()['connections']:
            if entry['accessMode'] == 'server':
                paths.append((entry['name'] or entry['id'], self.data_dir/('ssh-tunnel-'+entry['id']+'.log')))
        sections = []
        for label, path in paths:
            if not path.exists():
                continue
            with path.open('rb') as handle:
                offset = max(0, path.stat().st_size - 18000)
                handle.seek(offset)
                if offset:
                    handle.readline()
                text = handle.read().decode('utf-8', errors='replace')
            records = []
            for line in text.splitlines():
                continuation = line.startswith((' ', '\t', 'Traceback', 'During handling', 'The above')) or re.match(r'^[\w.]*(?:Error|Exception|Interrupt|Exit|Warning):', line)
                if not records or (line and not continuation):
                    records.append([line])
                else:
                    records[-1].append(line)
            sections.append({'name': label, 'text': '\n'.join('\n'.join(record) for record in reversed(records))})
        notifications = settings(self.data_dir)
        secrets = [notifications.get('token'), notifications.get('barkKey'), notifications.get('pushplusToken'),
                   notifications.get('webhookSignSecret')]
        for entry in [notifications, *notifications.get('webhookEndpoints', [])]:
            webhook = entry.get('webhookUrl') or ''
            parsed_webhook = urlsplit(webhook) if webhook else None
            secrets.append(webhook)
            if parsed_webhook:
                secrets.extend((parsed_webhook.path if parsed_webhook.path not in ('', '/') else '', parsed_webhook.query))
                secrets.extend(segment for segment in parsed_webhook.path.split('/') if len(segment) >= 8)
                secrets.extend(value for _, value in parse_qsl(parsed_webhook.query) if value)
            for header in (entry.get('webhookHeaders') or {}).values():
                secrets.extend((header, header.rsplit(' ', 1)[-1]))
            secrets.append(entry.get('webhookSignSecret'))
        for secret in sorted({value for value in secrets if isinstance(value, str) and value}, key=len, reverse=True):
            if secret:
                for section in sections:
                    section['text'] = section['text'].replace(secret, '[REDACTED]')
        return {'sections': sections, 'text': '\n\n'.join('--- '+s['name']+' ---\n'+s['text'] for s in sections)}
