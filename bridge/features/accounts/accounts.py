"""Desktop-only enrollment and shared, transactional account switching.

Credentials use Codex's native file store in owner-only directories. They never
appear in public status, HTTP responses, command arguments or diagnostic logs.
"""
import base64
import copy
import functools
import hashlib
import inspect
import json
import os
import queue
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path
from contextlib import nullcontext
from urllib.parse import urlsplit

from bridge.features.accounts.account import AccountRPC, AccountError, Account
from bridge.clients.desktop_app import DesktopApp
from bridge.clients.errors import TaskStateUnavailable, TaskAuditIncomplete
from bridge.features.accounts.models import model_catalog, model_ids, valid_model_id
from bridge.clients.codex.catalog import Catalog, ModelStore, MODEL_REFRESH_SECONDS
from bridge.features.accounts.info import AccountInfo
from bridge.features.accounts.operation_gate import OperationGate
from bridge.features.accounts.reset_forecast import ResetForecast
from bridge.clients.codex.configuration import magpie_managed
from bridge.clients.codex.transport import connect_stream
from bridge.features.notifications.channels import read_json


def private_bytes(path, content):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('계정 파일은 심볼릭 링크일 수 없습니다.')
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, name = tempfile.mkstemp(prefix='.account-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        deadline = time.monotonic() + 2 if os.name == 'nt' else 0
        while True:
            try:
                os.replace(name, path)
                break
            except PermissionError as exc:
                if os.name != 'nt' or getattr(exc, 'winerror', None) not in (5, 32, 33):
                    raise
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise
                time.sleep(min(.05, remaining))
    finally:
        Path(name).unlink(missing_ok=True)


def private_json(path, value):
    private_bytes(path, json.dumps(value, ensure_ascii=False).encode())


def token_owner(auth):
    tokens = auth.get('tokens') or {}
    try:
        encoded = tokens['id_token'].split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
        # These are local native-login records, not independent token validation.
        return [tokens.get('account_id'), claims.get('sub'), claims.get('email')]
    except (ValueError, KeyError, IndexError, TypeError):
        return None


def operation(method=None, *, host=None, project=None, entry_only=False):
    """Host operations are independent; account and lifecycle changes stay exclusive."""
    if method is None:
        return functools.partial(operation, host=host, project=project, entry_only=entry_only)
    signature = inspect.signature(method) if host or project else None
    @functools.wraps(method)
    def call(self, *args, **kwargs):
        entry_gate = getattr(self, 'entry_gate', None)
        if entry_gate is not None:
            with entry_gate.host(self.host):
                if self.closed.is_set():
                    raise ValueError('Codex 입구가 닫혀 있으니 다시 열어주세요')
                manager = None if entry_only else getattr(self, 'accounts', None)
                if manager is None:
                    return method(self, *args, **kwargs)
                with manager.gate.host(self.host):
                    manager.check_ready()
                    return method(self, *args, **kwargs)
        manager = None if entry_only else getattr(self, 'accounts', None)
        if manager is None:
            return method(self, *args, **kwargs)
        host_id = getattr(self, 'host', 'local')
        if signature:
            values = signature.bind(self, *args, **kwargs)
            values.apply_defaults()
            if host:
                host_id = values.arguments[host]
            else:
                host_id = self.project_host(values.arguments[project])
        if not isinstance(host_id, str):
            raise ValueError('실행 중인 호스트가 잘못되었습니다.')
        gate = manager.gate
        with gate.host(host_id) if isinstance(gate, OperationGate) else gate:
            guard = getattr(manager, 'require_client_enabled', None)
            if guard is not None:
                guard()
            manager.check_ready()
            return method(self, *args, **kwargs)
    return call


class ManagedRPC(AccountRPC):
    METHODS = AccountRPC.METHODS | {'account/login/start', 'account/login/cancel', 'config/batchWrite', 'model/list'}

    def __init__(self, *args):
        super().__init__(*args)
        self.notifications = []

    def request(self, method, params=None):
        if method not in self.METHODS:
            raise ValueError("지원되지 않는 계정 작업입니다.")
        self.counter += 1
        self.process.stdin.write(json.dumps({'id': self.counter, 'method': method, 'params': params})+'\n')
        self.process.stdin.flush()
        end = time.monotonic() + 30
        while time.monotonic() < end:
            try:
                value = self.messages.get(timeout=max(.01, end-time.monotonic()))
            except queue.Empty:
                break
            if value is None:
                break
            if value.get('id') == self.counter:
                if 'error' in value:
                    raise AccountError("런타임이 계정 또는 구성 작업을 거부했습니다. 로그인 및 작업 공간 제한 사항을 확인하세요.")
                return value.get('result', {})
            self.notifications.append(value)
        raise AccountError('계정 서비스 시간이 초과되었거나 연결이 끊어졌습니다.')

    def login_finished(self, cancel):
        end = time.monotonic() + 600
        while time.monotonic() < end and not cancel.is_set():
            if self.notifications:
                value = self.notifications.pop(0)
            else:
                try:
                    value = self.messages.get(timeout=.25)
                except queue.Empty:
                    continue
            if value is None:
                break
            if value.get('method') == 'account/login/completed':
                return value.get('params', {}).get('success') is True
        return False


class Accounts:
    def __init__(self, bridge):
        self.bridge = bridge
        self.home = bridge.codex_home
        self.root = bridge.data_dir/'accounts'
        if self.root.is_symlink():
            raise ValueError('계정 디렉터리는 심볼릭 링크일 수 없습니다.')
        self.lock = threading.RLock()
        self.gate = OperationGate()
        self.api_models_locks = {}
        self.api_model_store = ModelStore(bridge.data_dir)
        self.saved_model_catalogs = {}
        self.api_model_refreshing = set()
        self.api_model_timers = {}
        self.api_model_retry_at = {}
        self.index = read_json(self.root/'index.json', {'accounts': [], 'activeId': None, 'desktopExecutable': ''})
        self.state = read_json(self.root/'switch.json', {'phase': 'idle'})
        if self.state.get('phase') in ('preparing', 'stopping', 'applying', 'migrating', 'starting', 'verifying', 'restoring'):
            self.state.update(phase='interrupted', error="이전 스위치가 중단되었습니다. 데스크톱 앱에서 이전 계정을 복원하세요.")
            if self.state.get('operation') == 'desktopRuntime':
                self.state.update(phase='failed', error="이전 초기화가 중단되었습니다. 연결을 다시 초기화하십시오.")
        self.enrollment = None
        self.discovery = None
        self.candidates = {}
        self.info = AccountInfo(self)
        self.reset_forecast = ResetForecast()
        self.reset_dynamic_enabled = read_json(self.root/'reset-dynamic.json', {}).get('enabled') is True
        from bridge.features.updates.codex import DesktopUpdates
        from bridge.features.accounts.monitor import AccountMonitor
        self.updates = DesktopUpdates(self)
        self.monitor = AccountMonitor(self)
        self.login_cancel = threading.Event()
        self.thread = None
        self.desktop_preparation = {'state': 'idle'}

    @property
    def independent(self):
        return getattr(self.bridge, 'host', 'local').startswith('codex:')

    @property
    def runtime(self):
        return self.bridge.catalog_reader.executable

    def directory(self, identifier):
        if not isinstance(identifier, str) or not re.fullmatch(r'[0-9a-f]{32}', identifier):
            raise ValueError("잘못된 계정 ID.")
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.root.chmod(0o700)
        return self.root/identifier

    def saved_model_catalog(self, identifier):
        with self.lock:
            home = self.directory(identifier)
            catalog = self.saved_model_catalogs.get(identifier)
            if catalog is None:
                catalog = Catalog(home, self.runtime,
                    observation_enabled=lambda: getattr(self.bridge, 'observation_enabled', lambda: True)())
                self.saved_model_catalogs[identifier] = catalog
            return catalog

    def row(self, identifier):
        self.directory(identifier)
        row = next((r for r in self.index['accounts'] if r['id'] == identifier), None)
        if row is None:
            raise ValueError("계정이 더 이상 존재하지 않습니다. 목록을 새로 고칩니다.")
        return row

    def save(self):
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        private_json(self.root/'index.json', self.index)

    def phase(self, phase, **values):
        with self.lock:
            self.state.update(phase=phase, **values)
            private_json(self.root/'switch.json', self.state)

    def check_ready(self):
        if self.updates.status()['state'] == 'requesting':
            raise ValueError("데스크톱 업데이트를 전달하는 중입니다. 잠시 후 다시 시도하세요.")
        if self.state.get('phase') not in ('idle', 'complete', 'failed', 'restored'):
            raise ValueError("계정 전환 또는 복구가 보류 중입니다. 채팅 작업이 일시적으로 일시 중지되었습니다.")

    def active_matches(self):
        stamp = self.index.get('activeStamp')
        if not stamp:
            return False
        try:
            config_hash = hashlib.sha256((self.home/'config.toml').read_bytes()).hexdigest()
            if config_hash != stamp['config']:
                return False
            row = self.row(self.index['activeId'])
            if row['kind'] == 'chatgpt':
                tokens = read_json(self.home/'auth.json', {}).get('tokens') or {}
                return token_owner({'tokens': tokens}) == row.get('tokenOwner') and bool(row.get('tokenOwner'))
            auth = self.home/'auth.json'
            if 'auth' in stamp:
                return stamp['auth'] == (hashlib.sha256(auth.read_bytes()).hexdigest() if auth.is_file() else None)
            return read_json(auth, {}).get('OPENAI_API_KEY') == read_json(self.directory(row['id'])/'api.json', {}).get('key')
        except (OSError, ValueError, KeyError, TypeError):
            return False

    def mark_active(self, identifier):
        self.index['activeId'] = identifier
        self.index['activeStamp'] = ({'config': hashlib.sha256((self.home/'config.toml').read_bytes()).hexdigest()}
                                     if identifier else None)
        if identifier and self.row(identifier)['kind'] == 'api':
            auth = self.home/'auth.json'
            self.index['activeStamp']['auth'] = hashlib.sha256(auth.read_bytes()).hexdigest() if auth.is_file() else None
        self.save()

    def public(self):
        with self.lock:
            management = self.management()
            if management['external']:
                current = {'status': 'ready', 'kind': 'external', 'id': None, 'name': 'Magpie / 외부 관리'}
            else:
                current = self.info.current()
            if self.state.get('operation') == 'cliAuth' and self.state.get('phase') == 'authUnknown':
                current = {'status': 'error', 'kind': 'api', 'id': None,
                           'name': '기본 계정 동기화 결과를 확인해야 합니다.'}
            verified = bool(current.get('id'))
            return {'accounts': [{**{k: row[k] for k in ('id', 'name', 'kind', 'email', 'planType', 'baseUrl', 'model') if k in row},
                                  'details': copy.deepcopy(self.info.public_details(row['id']))}
                                 for row in self.index['accounts']],
                    'activeId': current.get('id'), 'activeVerified': verified, 'current': current, 'blockers': self.blockers(),
                    'externalChange': bool(self.index.get('activeId')) and not verified,
                    'sharedWithLocalCli': True, 'scope': 'profile' if self.independent else 'desktop',
                    'scopeLabel': getattr(self.bridge, 'host_label', '이 컴퓨터'), 'codexHome': str(self.home),
                    'canManageDesktop': not self.independent, 'switch': dict(self.state),
                    'desktopRuntime': self.desktop_runtime_status(),
                    'loginAccount': copy.deepcopy(self.info.current_login()),
                    'resetDynamicEnabled':self.reset_dynamic_enabled,
                    'globalReset':self.reset_forecast.status() if self.reset_dynamic_enabled else None,
                    'reminders':dict(self.monitor.preferences), 'reminderError':self.monitor.last_error,
                    'desktopUpdate':self.updates.status(), 'management': management,
                    'sshHosts': self.bridge.ssh_status() if not self.independent and hasattr(self.bridge, 'ssh_status') else [],
                    'canSwitch': not management['external']}

    def set_reset_dynamic(self, enabled):
        if type(enabled) is not bool:
            raise ValueError('동적 설정을 재설정해도 효과가 없습니다.')
        with self.lock:
            if enabled and not self.reset_dynamic_enabled:
                self.monitor.reset_global_watch()
            private_json(self.root/'reset-dynamic.json', {'enabled': enabled})
            self.reset_dynamic_enabled = enabled

    def management(self):
        try:
            text = (self.home/'config.toml').read_text(encoding='utf-8')
        except FileNotFoundError:
            text = ''
        except (OSError, UnicodeError):
            return {'mode': 'external', 'external': True, 'reason': '액세스 구성을 확인할 수 없어 오버레이 구성이 일시중지되었습니다.'}
        configured = self.index.get('accessManagement', 'auto')
        detected = magpie_managed(text=text)
        return {'mode': configured, 'external': configured == 'external' or detected,
                'detected': 'magpie' if detected else None,
                'reason': "이 항목은 외부에서 관리됩니다. Magpie 또는 원래 도구에서 연결을 전환합니다." if configured == 'external' or detected else None}

    def require_managed_writes(self):
        if self.management()['external']:
            raise ValueError('이 입구는 다음에서 제공됩니다. Magpie 또는 외부 도구 관리，Bridge 인증, 공급자 및 모델 카탈로그는 포함되지 않습니다.')

    def desktop_status(self):
        result = self.public()
        with self.lock:
            result.update(desktopExecutable=None if self.independent else self.index.get('desktopExecutable') or DesktopApp.discover(self.runtime),
                          enrollment=self.enrollment, discovery=self.discovery, codexHome=str(self.home))
        return result

    def desktop_runtime_status(self):
        supported = sys.platform in ('darwin', 'linux', 'win32') and getattr(self.bridge, 'host', 'local') == 'local'
        result = {'supported': supported, 'configured': False, 'preparation': dict(self.desktop_preparation)}
        if supported:
            from bridge.clients.codex.desktop_runtime import settings
            try:
                result['configured'] = settings(self.home) is not None
            except (OSError, ValueError, TypeError, KeyError):
                result['error'] = "공유 연결 설정을 읽을 수 없습니다. 연결을 다시 초기화하십시오."
        return result

    @staticmethod
    def name(value):
        name = value.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise ValueError("계정 이름을 1~80자 사이로 입력하세요.")
        return name.strip()

    def assert_editable(self):
        self.check_ready()
        if self.enrollment and self.enrollment.get('phase') in ('starting', 'waiting'):
            raise ValueError("먼저 대기 중인 로그인을 완료하거나 취소하세요.")

    @staticmethod
    def api_url(url):
        if not isinstance(url, str):
            raise ValueError("유효한 API URL를 입력하세요.")
        try:
            parsed = urlsplit(url)
            parsed.port
        except ValueError:
            raise ValueError("유효한 API URL를 입력하세요.") from None
        if (parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or len(url) > 2000 or any(c.isspace() for c in url)
                or (parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'))):
            raise ValueError("API URL은 HTTPS를 사용해야 합니다. HTTP는 로컬 서비스에만 허용됩니다.")
        return url.rstrip('/')

    def api_credentials(self, value):
        url, key = self.api_url(value.get('baseUrl', '')), value.get('apiKey', '')
        if key == '' and value.get('id'):
            old = self.row(value['id'])
            if old['kind'] == 'api':
                key = read_json(self.directory(old['id'])/'api.json', {}).get('key', '')
        if not isinstance(key, str) or not 1 <= len(key) <= 8192 or any(c in key for c in '\r\n\x00'):
            raise ValueError("유효한 API 키를 입력하세요.")
        return url, key

    @staticmethod
    def source_stamp(source):
        return [hashlib.sha256((source/name).read_bytes()).hexdigest() if (source/name).is_file() else None
                for name in ('config.toml', 'auth.json')]

    def scan(self, value):
        with self.gate, self.bridge.account.lock, self.lock:
            self.assert_editable()
            path = value.get('source') or str(self.home)
            if not isinstance(path, str) or not Path(path).expanduser().is_absolute():
                raise ValueError("Codex 구성 디렉터리의 전체 경로를 입력합니다.")
            source = Path(path).expanduser().resolve()
            if not source.is_dir() or not any((source/name).is_file() for name in ('config.toml', 'auth.json')):
                raise ValueError("이 디렉터리에는 config.toml 또는 auth.json이 없습니다.")
            stamp = self.source_stamp(source)
            with ManagedRPC(source, self.runtime) as rpc:
                config = rpc.request('config/read', {'includeLayers': False}).get('config', {})
            auth = read_json(source/'auth.json', {})
            if stamp != self.source_stamp(source):
                raise ValueError("로컬 구성이 변경되었습니다. 다시 스캔하세요.")
            candidates = []
            tokens, owner = auth.get('tokens') or {}, token_owner(auth)
            if owner and owner[1] and owner[2] and all(tokens.get(k) for k in ('access_token', 'refresh_token', 'account_id')):
                candidates.append({'kind': 'chatgpt', 'name': owner[2][:80], 'email': owner[2], 'tokenOwner': owner,
                                   'accountId': tokens['account_id'],
                                   'auth': {'auth_mode': 'chatgpt', 'OPENAI_API_KEY': None, 'tokens': tokens,
                                            **({'last_refresh': auth['last_refresh']} if auth.get('last_refresh') else {})}})
            definitions = dict(config.get('model_providers') or {})
            if auth.get('OPENAI_API_KEY') or os.environ.get('OPENAI_API_KEY'):
                definitions.setdefault('openai', {'name': 'OpenAI API', 'base_url': config.get('openai_base_url') or 'https://api.openai.com/v1', 'requires_openai_auth': True})
            for provider, definition in definitions.items():
                if not isinstance(definition, dict):
                    continue
                # Native defaults without a configured endpoint are not saved API connections.
                url = definition.get('base_url') or ((config.get('openai_base_url') or 'https://api.openai.com/v1') if provider == 'openai' else '')
                if not url:
                    continue
                key = (os.environ.get(definition['env_key'], '') if definition.get('env_key')
                       else definition.get('experimental_bearer_token') or '')
                if not key and not definition.get('env_key') and (provider == 'openai' or definition.get('requires_openai_auth')):
                    key = auth.get('OPENAI_API_KEY') or os.environ.get('OPENAI_API_KEY', '')
                reason = None
                if any(definition.get(k) for k in ('http_headers', 'env_http_headers', 'auth', 'aws', 'query_params', 'gateway_oauth')):
                    reason = "추가 요청 설정이 있는 공급자 가져오기는 지원되지 않습니다."
                elif definition.get('wire_api', 'responses') != 'responses':
                    reason = "이 공급자는 API 응답을 사용하지 않으며 가져올 수 없습니다."
                else:
                    try:
                        self.api_credentials({'baseUrl': url, 'apiKey': key})
                    except ValueError:
                        reason = "사용 가능한 API 키 또는 URL를 찾을 수 없습니다. 환경 변수를 확인하거나 수동으로 추가하세요."
                variants = [(provider, config.get('model') or '')]
                variants += [(provider+' / '+name, profile.get('model') or config.get('model') or '')
                             for name, profile in (config.get('profiles') or {}).items()
                             if isinstance(profile, dict) and (profile.get('model_provider') or config.get('model_provider') or 'openai') == provider]
                for name, model in variants:
                    candidates.append({'kind': 'api', 'name': name[:80], 'baseUrl': url.rstrip('/'),
                                       'model': model, 'key': key, 'reason': reason})
            self.candidates = {}
            for candidate in candidates:
                candidate.update(id=uuid.uuid4().hex, source=source, stamp=stamp)
                self.candidates[candidate['id']] = candidate
            self.discovery = {'source': str(source), 'candidates': [],
                              'notice': ("시스템 자격 증명 저장소 로그인은 여기에 복사할 수 없습니다. 공식 로그인을 통해 추가하세요."
                                         if not owner and config.get('cli_auth_credentials_store') in ('keyring', 'auto') else None)}
            self.update_discovery()
            return self.desktop_status()

    def duplicate(self, candidate):
        for row in self.index['accounts']:
            if row['kind'] != candidate['kind']:
                continue
            if row['kind'] == 'chatgpt' and row.get('tokenOwner') == candidate.get('tokenOwner'):
                return True
            if (row['kind'] == 'api' and row['baseUrl'] == candidate['baseUrl'] and row['model'] == candidate.get('model')
                    and read_json(self.directory(row['id'])/'api.json', {}).get('key') == candidate.get('key')):
                return True
        return False

    def update_discovery(self):
        if self.discovery is not None:
            self.discovery['candidates'] = [{**{k: row[k] for k in ('id', 'kind', 'name', 'email', 'baseUrl', 'model', 'reason') if k in row},
                                             'canImport': not row.get('reason'), 'imported': self.duplicate(row)}
                                            for row in self.candidates.values()]

    def candidate(self, identifier):
        row = self.candidates.get(identifier)
        if not row or row.get('reason'):
            raise ValueError("다시 스캔하고 가져올 수 있는 구성을 선택하십시오.")
        if row['stamp'] != self.source_stamp(row['source']):
            raise ValueError("로컬 구성이 변경되었습니다. 다시 스캔하세요.")
        return row

    def import_account(self, value):
        with self.lock:
            self.assert_editable()
            candidate = dict(self.candidate(value.get('candidateId')))
            if value.get('name') is not None:
                candidate['name'] = self.name(value)
            if candidate['kind'] == 'api':
                candidate['model'] = value.get('model', candidate['model'])
            if not self.duplicate(candidate):
                if candidate['kind'] == 'api':
                    self.add_api({'name': candidate['name'], 'baseUrl': candidate['baseUrl'],
                                  'apiKey': candidate['key'], 'model': candidate['model']})
                else:
                    identifier = uuid.uuid4().hex
                    private_json(self.directory(identifier)/'auth.json', candidate['auth'])
                    self.index['accounts'].append({'id': identifier, **{k: candidate[k] for k in
                                                  ('kind', 'name', 'email', 'accountId', 'tokenOwner')}})
                    self.save()
            self.candidates[candidate['id']].update(model=candidate.get('model', ''))
            self.update_discovery()
            return self.desktop_status()

    def api_model_identity(self, row):
        with self.lock:
            if self.row(row['id']).get('baseUrl') != row['baseUrl']:
                raise ValueError('현재 접근 권한이 변경되었습니다. 모델 목록을 다시 읽어주세요.')
            key = read_json(self.directory(row['id'])/'api.json', {})['key']
            return ModelStore.key('saved-api', str(self.home), row['id'], row['baseUrl'], key)

    def api_models(self, row, refresh=False, with_timestamp=False):
        with self.lock:
            self.check_ready()
            self.row(row['id'])
            model_lock = self.api_models_locks.setdefault(row['id'], threading.Lock())
        with model_lock:
            with self.lock:
                self.check_ready()
                stored = dict(self.row(row['id']))
                if any(stored.get(key) != row.get(key) for key in ('kind', 'baseUrl', 'model')):
                    raise ValueError('현재 접근 권한이 변경되었습니다. 모델 목록을 다시 읽어주세요.')
                key = read_json(self.directory(row['id'])/'api.json', {})['key']
                identity = ModelStore.key('saved-api', str(self.home), row['id'], row['baseUrl'], key)
                def result(models, updated_at, error=None):
                    with self.lock:
                        self.check_ready()
                        if (self.row(row['id']) != stored or
                                read_json(self.directory(row['id'])/'api.json', {}).get('key') != key):
                            raise ValueError('현재 접근 권한이 변경되었습니다. 모델 목록을 다시 읽어주세요.')
                    copied = copy.deepcopy(models)
                    return (copied, updated_at, error) if with_timestamp else copied
                try:
                    persisted = self.api_model_store.read(identity)
                except (OSError, sqlite3.DatabaseError, ValueError):
                    persisted = None
                if persisted and not refresh:
                    if (time.time()-persisted[0] >= MODEL_REFRESH_SECONDS and identity not in self.api_model_refreshing
                            and time.time() >= self.api_model_retry_at.get(identity, 0)):
                        self.api_model_refreshing.add(identity)
                        def update():
                            try:
                                self.api_models(row, refresh=True)
                            except ValueError:
                                pass
                            finally:
                                with self.lock:
                                    self.api_model_retry_at[identity] = time.time() + 60
                                    self.api_model_refreshing.discard(identity)
                        threading.Thread(target=update, daemon=True, name='saved-api-model-refresh').start()
                    elif time.time()-persisted[0] < MODEL_REFRESH_SECONDS:
                        self._schedule_api_model_refresh(row, identity, persisted[0])
                    return result(persisted[1], persisted[0])
            try:
                models = model_catalog(row['baseUrl'], key)
            except ValueError:
                if persisted:
                    return result(persisted[1], persisted[0], '모델 디렉터리 새로 고침이 실패했습니다. 마지막 결과가 유지되었습니다.')
                raise
            with self.lock:
                self.check_ready()
                if (self.row(row['id']) != stored or
                        read_json(self.directory(row['id'])/'api.json', {}).get('key') != key):
                    raise ValueError('현재 접근 권한이 변경되었습니다. 모델 목록을 다시 읽어주세요.')
            try:
                updated_at = self.api_model_store.write(identity, models)
                self._schedule_api_model_refresh(row, identity, updated_at, replace=True)
            except (OSError, sqlite3.DatabaseError):
                updated_at = time.time()
            return result(models, updated_at)

    def _schedule_api_model_refresh(self, row, identity, updated_at, replace=False):
        if not getattr(self.bridge, 'observation_enabled', lambda: True)():
            return
        with self.lock:
            if getattr(self.bridge, 'closed', None) is not None and self.bridge.closed.is_set():
                return
            if replace and identity in self.api_model_timers:
                self.api_model_timers.pop(identity).cancel()
            if identity in self.api_model_timers:
                return
            delay = max(1, updated_at + MODEL_REFRESH_SECONDS - time.time())
            def due():
                with self.lock:
                    self.api_model_timers.pop(identity, None)
                    if not getattr(self.bridge, 'observation_enabled', lambda: True)():
                        return
                    if getattr(self.bridge, 'closed', None) is not None and self.bridge.closed.is_set():
                        return
                try:
                    self.api_models(row, refresh=True)
                except ValueError:
                    pass
                finally:
                    with self.lock:
                        try:
                            record = self.api_model_store.read(identity)
                        except (OSError, sqlite3.DatabaseError, ValueError):
                            record = None
                        if record and any(saved['id'] == row['id'] for saved in self.index['accounts']):
                            self._schedule_api_model_refresh(row, identity, max(record[0], time.time() - MODEL_REFRESH_SECONDS + 300))
            timer = threading.Timer(delay, due)
            timer.daemon = True
            self.api_model_timers[identity] = timer
            timer.start()

    def current_model_identity(self):
        with self.lock:
            if not self.active_matches():
                return None
            row = dict(self.row(self.index['activeId']))
            if row['kind'] == 'api':
                return self.api_model_identity(row)
        return self.bridge.catalog_reader.model_identity(str(self.home), 'openai')

    def current_models(self, refresh=False):
        with self.lock:
            self.check_ready()
            if self.management()['external']:
                return None
            if not self.active_matches():
                return None
            row = dict(self.row(self.index['activeId']))
            stamp = copy.deepcopy(self.index.get('activeStamp'))
        if row['kind'] != 'api':
            result = self.bridge.catalog_reader.get_kind('models', str(self.home), refresh=refresh, provider='openai')
        else:
            result = {'models':[], 'modelSource':'api', 'fastMode':{'allowed':False}}
            try:
                result['models'], updated_at, error = self.api_models(row, refresh, with_timestamp=True)
                identity = self.api_model_identity(row)
                result['cache'] = {'state': 'stale' if error else 'fresh', 'updatedAt': updated_at,
                                   'identity': identity}
                if error:
                    result['modelError'] = error
            except ValueError as error:
                result['modelError'] = str(error)
        with self.lock:
            self.check_ready()
            if (self.index.get('activeId') != row['id'] or self.index.get('activeStamp') != stamp or
                    not self.active_matches() or self.row(row['id']) != row):
                raise ValueError('현재 접근 권한이 변경되었습니다. 모델 목록을 다시 읽어주세요.')
            return {**result, 'modelAccessName':row['name'], 'modelAccountId':row['id']}

    def models(self, value):
        with self.lock:
            self.assert_editable()
            if value.get('candidateId'):
                candidate = self.candidate(value['candidateId'])
                if candidate['kind'] != 'api':
                    raise ValueError("API 연결을 선택합니다.")
                url, key = self.api_credentials({'baseUrl': candidate['baseUrl'], 'apiKey': candidate['key']})
            else:
                url, key = self.api_credentials(value)
        # Only the explicit desktop button calls upstream; never poll models automatically.
        models = model_ids(url, key)
        return {**self.desktop_status(), 'models': models}

    def add_api(self, value):
        with self.lock:
            self.assert_editable()
            name = self.name(value)
            url, key, model = value.get('baseUrl', ''), value.get('apiKey', ''), value.get('model', '')
            url, key = self.api_credentials(value)
            if not valid_model_id(model):
                raise ValueError("유효한 모델 ID를 입력하세요.")
            existing = self.row(value['id']) if value.get('id') else None
            if existing and (existing['kind'] != 'api' or existing['id'] == self.info.current().get('id')):
                raise ValueError("이 API를 편집하기 전에 다른 계정으로 전환하세요.")
            identifier = existing['id'] if existing else uuid.uuid4().hex
            row = {'id': identifier, 'kind': 'api', 'name': name, 'baseUrl': url.rstrip('/'), 'model': model}
            private_json(self.directory(identifier)/'api.json', {'key': key})
            if existing:
                existing.update(row)
            else:
                self.index['accounts'].append(row)
            self.info.entries.pop(identifier, None)
            self.save()
            return self.desktop_status()

    def login(self, value):
        with self.lock:
            self.assert_editable()
            name = self.name(value)
            replacing = self.row(value['replaceId']) if value.get('replaceId') else None
            if replacing and (replacing['kind'] != 'chatgpt' or replacing['id'] == self.info.current().get('id')):
                raise ValueError("다시 로그인하기 전에 다른 계정으로 전환하세요.")
            identifier = uuid.uuid4().hex
            folder = self.directory(identifier)
            folder.mkdir(parents=True, mode=0o700)
            private_bytes(folder/'config.toml', b'cli_auth_credentials_store = "file"\n')
            self.enrollment = {'phase': 'starting', 'id': identifier, 'name': name}
            self.login_cancel = threading.Event()
            def run():
                accepted = False
                try:
                    with ManagedRPC(folder, self.runtime) as rpc:
                        flow = rpc.request('account/login/start', {'type': 'chatgpt'})
                        url = flow.get('authUrl', '')
                        parsed = urlsplit(url)
                        if parsed.scheme != 'https' or parsed.hostname not in ('auth.openai.com', 'chatgpt.com', 'auth0.openai.com'):
                            raise ValueError("로그인 URL 유효성 검사에 실패했습니다.")
                        with self.lock:
                            self.enrollment.update(phase='waiting', authUrl=url)
                        if not rpc.login_finished(self.login_cancel):
                            if flow.get('loginId'):
                                rpc.request('account/login/cancel', {'loginId': flow['loginId']})
                            raise ValueError("로그인이 취소되었거나 만료되었습니다. 다시 로그인하세요.")
                        auth = rpc.request('account/read', {'refreshToken': False}).get('account') or {}
                        if auth.get('type') != 'chatgpt' or not (folder/'auth.json').is_file():
                            raise ValueError("공식 계정 자격 증명은 아직 사용할 수 없습니다.")
                        saved_auth = read_json(folder/'auth.json', {})
                        tokens = saved_auth.get('tokens') or {}
                        owner = token_owner(saved_auth)
                        if not tokens.get('account_id') or not owner or not owner[1]:
                            raise ValueError("계정 ID를 사용할 수 없습니다. 다시 로그인하세요.")
                        with self.lock:
                            if self.login_cancel.is_set():
                                raise ValueError('로그인이 취소되었습니다.')
                            if any(r is not replacing and r.get('accountId') == tokens['account_id'] and r.get('email') == auth.get('email') for r in self.index['accounts']):
                                raise ValueError("이 계정은 이미 저장되어 있습니다. 다시 인증하기 전에 이전 항목을 제거하세요.")
                            self.index['accounts'].append({'id': identifier, 'name': name, 'kind': 'chatgpt',
                                                          'accountId': tokens['account_id'], 'tokenOwner': owner, 'email': auth.get('email'),
                                                          'planType': auth.get('planType')})
                            if replacing:
                                self.index['accounts'].remove(replacing)
                            self.save()
                            if replacing:
                                catalog = self.saved_model_catalogs.pop(replacing['id'], None)
                                if catalog:
                                    catalog.stop_model_refresh()
                                shutil.rmtree(self.directory(replacing['id']), ignore_errors=True)
                            accepted = True
                            self.enrollment = {'phase': 'complete', 'name': name}
                except Exception:
                    with self.lock:
                        self.enrollment = {'phase': 'failed', 'error': '로그인이 완료되지 않았거나 취소되었거나 계정이 이미 존재합니다. 다시 추가하세요.'}
                finally:
                    if not accepted:
                        shutil.rmtree(folder, ignore_errors=True)
            threading.Thread(target=run, daemon=True).start()
            return self.desktop_status()

    def current_login_account(self):
        row = self.info.current_login()
        if not row or not row.get('transient'):
            raise ValueError('계정 ID가 변경되었습니다. 목록을 새로고침하세요.')
        target = Account(self.home, self.bridge.data_dir, executable=self.runtime)
        target.usage_cache = self.bridge.account.usage_cache
        target.subscription_cache = self.bridge.account.subscription_cache
        expected_owner = self.info.identity['login']['owner']
        expected_route = self.info.identity['login']['context'].get('_routeCacheKey')
        def checked_login(rpc):
            context = Account.login_context(rpc)
            if (not context or context['accountKey'] != row['accountKey'] or
                    context.get('_routeCacheKey') != expected_route or
                    token_owner(read_json(self.home/'auth.json', {})) != expected_owner):
                raise ValueError('계정 ID가 변경되었습니다. 목록을 새로고침하세요.')
            return context
        target.context = checked_login
        return target, expected_owner

    def saved_account(self, row):
        if row['kind'] != 'chatgpt':
            raise ValueError("사용량을 재설정하려면 네이티브 ChatGPT 로그인이 필요합니다.")
        identity = self.info.read_identity()
        with self.lock:
            active = self.info.match(identity)
        login = identity.get('login')
        native_login = bool(login and login.get('owner') and login['owner'] == row.get('tokenOwner'))
        home = self.home if native_login or active and active['id'] == row['id'] else self.directory(row['id'])
        if token_owner(read_json(home/'auth.json', {})) != row.get('tokenOwner'):
            raise ValueError('계정 ID가 일치하지 않습니다.')
        if home != self.home:
            private_bytes(home/'config.toml', b'cli_auth_credentials_store = "file"\nmodel_provider = "openai"\n')
        target = Account(home, self.bridge.data_dir, executable=self.runtime)
        target.usage_cache = self.bridge.account.usage_cache
        target.subscription_cache = self.bridge.account.subscription_cache
        def checked_context(rpc):
            context = Account.login_context(rpc) if native_login else Account.context(rpc)
            if (not context or context.get('loginType') != 'chatgpt' or context.get('email') != row.get('email') or
                    native_login and (context['accountKey'] != login['context']['accountKey'] or
                                      context.get('_routeCacheKey') != login['context'].get('_routeCacheKey')) or
                    token_owner(read_json(home/'auth.json', {})) != row.get('tokenOwner')):
                raise ValueError('계정 ID가 변경되었습니다.')
            return context
        target.context = checked_context
        return target

    def read_account(self, value):
        from bridge.features.accounts.info import CURRENT_LOGIN_ID
        # Account switching shares this credential lock; chat operations keep their own gate.
        with self.bridge.account.lock:
            with self.lock:
                self.check_ready()
                row = None if value.get('id') == CURRENT_LOGIN_ID else dict(self.row(value.get('id')))
                if row is None:
                    target, owner = self.current_login_account()
            if row is not None:
                target, owner = self.saved_account(row), row.get('tokenOwner')
            result = target.read(refresh=value.get('refresh', True) is not False)
            with self.lock:
                self.check_ready()
                if ((row is not None and self.row(row['id']).get('tokenOwner') != owner) or
                        token_owner(read_json(target.home/'auth.json', {})) != owner):
                    raise ValueError('계정 ID가 변경되었습니다. 목록을 새로고침하세요.')
            return result

    def account(self, value):
        """Operate one login without changing the desktop's active connection."""
        action = value.get('operation', 'read')
        if action not in ('read', 'consume') or set(value) - {'action', 'id', 'operation', 'refresh', 'confirmed', 'requestId', 'accountKey', 'creditId'}:
            raise ValueError('계정 재설정 요청에 지원되지 않는 필드가 포함되어 있습니다.')
        if action == 'read':
            return self.read_account(value)
        from bridge.features.accounts.info import CURRENT_LOGIN_ID
        with self.gate, self.bridge.account.lock, self.lock:
            self.check_ready()
            if value.get('id') == CURRENT_LOGIN_ID:
                target, _ = self.current_login_account()
            else:
                target = self.saved_account(dict(self.row(value.get('id'))))
            result = target.control({**{k:v for k,v in value.items() if k not in ('action','id','operation')}, 'action':action})
            self.info.entries.get(value['id'], {}).pop('usage', None)
            return result

    def control(self, value):
        action = value.get('action', 'list')
        if self.independent and action in ('retrySsh', 'checkDesktopUpdate', 'requestDesktopUpdate', 'scanDesktop', 'configure', 'recover', 'initializeDesktopRuntime'):
            raise ValueError('독립 실행형 구성은 기본값을 관리하지 않습니다. Codex Desktop')
        if action == 'initializeDesktopRuntime':
            return self.initialize_desktop_runtime(value)
        if action == 'retrySsh':
            if set(value) != {'action', 'host'}:
                raise ValueError('SSH 재시도 요청에 지원되지 않는 필드가 포함되어 있습니다.')
            self.bridge.retry_ssh(value['host'])
            return self.desktop_status()
        if action == 'management':
            if set(value) != {'action', 'mode'} or value['mode'] not in ('auto', 'external'):
                raise ValueError('액세스 관리 모드가 잘못되었습니다.')
            with self.gate, self.lock:
                self.assert_editable()
                self.index['accessManagement'] = value['mode']
                self.save()
            return self.desktop_status()
        if action == 'account':
            return self.account(value)
        if action == 'reminders':
            self.monitor.configure(value.get('preferences'))
            return self.desktop_status()
        if action == 'checkDesktopUpdate':
            self.updates.check()
            return self.desktop_status()
        if action == 'requestDesktopUpdate':
            self.updates.request({k:v for k,v in value.items() if k != 'action'})
            return self.desktop_status()
        if action == 'ignoreSubmission':
            return self.ignore_submission(value)
        if action == 'details':
            self.info.request(value)
            return self.desktop_status()
        if action == 'list':
            if self.reset_dynamic_enabled and value.get('resetForecast') in (True, 'refresh'):
                self.reset_forecast.request(refresh=value.get('resetForecast') == 'refresh')
            return self.desktop_status()
        if action in ('scan', 'import', 'models'):
            return {'scan': self.scan, 'import': self.import_account, 'models': self.models}[action](value)
        if action == 'addApi':
            return self.add_api(value)
        if action == 'login':
            return self.login(value)
        if action == 'cancelLogin':
            self.login_cancel.set()
            return self.desktop_status()
        if action == 'switch':
            return self.switch(value)
        if action == 'recover':
            return self.recover(value)
        with self.lock:
            self.assert_editable()
            if action == 'scanDesktop':
                self.index['desktopExecutable'] = DesktopApp.scan(self.runtime, self.home)
            elif action == 'configure':
                executable = value.get('desktopExecutable')
                if not isinstance(executable, str) or not Path(executable).is_absolute():
                    raise ValueError("데스크톱 앱의 전체 경로를 입력하세요.")
                app = DesktopApp(executable, self.home)
                app.validate(self.runtime)
                self.index['desktopExecutable'] = str(app.executable)
            elif action in ('rename', 'delete'):
                row = self.row(value.get('id'))
                if action == 'rename':
                    row['name'] = self.name(value)
                else:
                    if row['id'] == self.info.current().get('id'):
                        raise ValueError("이 계정을 삭제하기 전에 다른 계정으로 전환하세요.")
                    self.index['accounts'].remove(row)
                    self.api_models_locks.pop(row['id'], None)
                    catalog = self.saved_model_catalogs.pop(row['id'], None)
                    if catalog:
                        catalog.stop_model_refresh()
                    self.save()
                    shutil.rmtree(self.directory(row['id']), ignore_errors=True)
            else:
                raise ValueError("지원되지 않는 계정 관리 작업입니다.")
            self.save()
            return self.desktop_status()

    @staticmethod
    def _native_cli_connection(bridge, identifier, session):
        """Identify a native route for this audit; this is not Desktop absence."""
        if (getattr(session, 'runtime', None) != 'cli' or
                getattr(session, 'owner', None) != 'cli:' + identifier):
            return None
        cli = getattr(bridge, 'cli_sessions', None)
        if cli is None:
            return None
        with cli.lock:
            process = getattr(cli.client, 'process', None)
            info = getattr(cli.client, 'server_info', None)
            expected = cli.remote_home if cli.alias else cli.home
            token = cli.metadata.get(identifier, {}).get('connectionToken')
            if (process is None or cli.joined.get(identifier) is not process or not info or
                    not token or not expected or Path(info.get('codexHome', '')) != Path(expected)):
                return None
            if not cli.alias and Path(expected).resolve() != Path(bridge.codex_home).resolve():
                return None
            return (process, token, str(expected)) if process.poll() is None else None

    def blockers(self):
        result = []
        for bridge in [self.bridge, *self.bridge.remote_bridges.values()]:
            with bridge.lock:
                sessions = list(bridge.live.items())
            for identifier, session in sessions:
                view = session.view()
                # Saved/disconnected snapshots are history, not evidence of a live task.
                if view.get('connected') and (view.get('requests') or view.get('status') in ('active', 'running', 'waiting', 'busy')):
                    result.append({'id': identifier, 'host': getattr(bridge, 'host', 'local'),
                                   'title': view.get('title') or identifier,
                                   'reason': 'approval' if view.get('requests') else 'running'})
            for key, row in list(bridge.submissions.items()):
                if row.get('status') in ('queued', 'unknown'):
                    result.append({'id': key.split(':')[0], 'host': getattr(bridge, 'host', 'local'),
                                   'title': row.get('title') or key.split(':')[0], 'reason': row['status'],
                                   'submissionId': key.split(':')[-1]})
        return result

    def ignore_submission(self, value):
        with self.gate:
            self.check_ready()
            host = value.get('host', 'local')
            bridge = self.bridge if host == 'local' else self.bridge.for_host(host)
            bridge.ignore_submission(value.get('threadId', ''), value.get('submissionId', ''))
            return self.public()

    def idle(self, *, pending_only=False):
        blocked = self.blockers()
        if pending_only:
            blocked = [row for row in blocked if row['reason'] in ('queued', 'unknown')]
        if blocked:
            names = '、'.join(row['title'] for row in blocked[:3])
            raise ValueError('작업을 종료하거나 보류 중인 메시지를 먼저 처리하세요.：'+names)

    def desktop_runtime_lifecycle(self):
        # Lock even before initialization has saved settings: another gateway
        # may be between its idle audit and the first shared configuration write.
        if sys.platform in ('darwin', 'linux', 'win32') and getattr(self.bridge, 'host', 'local') == 'local':
            from bridge.clients.codex.desktop_runtime import initialization_lock
            return initialization_lock(self.home)
        return nullcontext()

    def switch(self, value):
        self.require_managed_writes()
        if value.get('confirmed') is not True or value.get('tasksConfirmed') is not True:
            raise ValueError("모든 데스크톱 작업이 완료되었는지 확인하고 Codex 데스크톱 앱을 다시 시작하도록 허용합니다.")
        request_id = value.get('requestId')
        if not isinstance(request_id, str) or str(uuid.UUID(request_id)) != request_id:
            raise ValueError("잘못된 계정 전환 요청 ID.")
        with getattr(self.bridge, 'entry_gate', None) or nullcontext(), self.gate, self.bridge.account.lock, self.desktop_runtime_lifecycle(), self.lock:
            if self.independent and self.bridge.closed.is_set():
                raise ValueError('Codex 입구가 닫혀있습니다. 관리페이지를 다시 열어주세요')
            row = dict(self.row(value.get('id')))
            sync_cli = True
            ledger = read_json(self.root/'requests.json', {})
            from bridge.features.accounts.cli_sync import LocalCliSync
            sync = LocalCliSync(self.bridge)
            if self.state.get('operation') == 'cliAuth' and self.state.get('phase') == 'authUnknown':
                if self.state.get('requestId') != request_id or self.state.get('targetId') != row['id']:
                    raise ValueError('마지막 계정 동기화 결과를 확인해야 합니다. 동일한 스위치를 확인하고 다시 제출하지 마십시오.')
                sync.switch_live_api(row, request_id, reconcile=True)
                return self.public()
            if request_id in ledger:
                if ledger[request_id] != row['id']:
                    raise ValueError('동일한 요청을 다른 계정으로 전환할 수 없습니다.')
                return self.public()
            # One local account home always verifies CLI effectiveness.
            self.assert_editable()
            if sync.switch_live_api(row, request_id):
                return self.public()
            if self.info.current().get('id') != row['id']:
                sync.prepare_profile_switch()
            preflight = sync.preflight('codex')
            self.assert_editable()
            if self.info.current().get('id') == row['id']:
                return self.public()
            self.idle()
            if not preflight['desktopRunning']:
                before = sync.snapshot('codex')
                applied = None
                try:
                    applied = sync.apply('codex', row)
                    sync.verify('codex', row)
                except Exception:
                    if applied and applied.get('mutated') is True:
                        sync.restore('codex', before)
                    raise
                ledger[request_id] = row['id']
                private_json(self.root/'requests.json', ledger)
                self.state = {'phase': 'complete', 'requestId': request_id, 'targetId': row['id'],
                              'error': None, 'cliSync': {'status': 'verified'}}
                return self.public()
            executable = self.index.get('desktopExecutable') or DesktopApp.discover(self.runtime)
            if not executable:
                raise ValueError("먼저 데스크톱 앱에서 Codex 데스크톱 실행 파일을 선택하세요.")
            app = DesktopApp(executable, self.home)
            app.validate(self.runtime)
            ledger[request_id] = row['id']
            private_json(self.root/'requests.json', ledger)
            self.state = {'phase': 'preparing', 'requestId': request_id, 'targetId': row['id'], 'error': None,
                          'cliSync': {'status': 'pending' if sync_cli else 'shared-config-unverified'}}
            self.phase('preparing')
            self.thread = threading.Thread(target=self._switch, args=(row, app), daemon=True)
            self.thread.start()
            return self.public()

    def initialize_desktop_runtime(self, value):
        if sys.platform not in ('darwin', 'linux', 'win32') or getattr(self.bridge, 'host', 'local') != 'local':
            raise ValueError("이 항목은 Codex 네이티브 연결 초기화를 지원하지 않습니다.")
        required = {'action', 'confirmed', 'tasksConfirmed', 'requestId'}
        if (set(value) - {'acknowledgeUnavailable'} != required or value.get('confirmed') is not True
                or value.get('tasksConfirmed') is not True
                or 'acknowledgeUnavailable' in value and value['acknowledgeUnavailable'] is not True):
            raise ValueError("모든 데스크톱 작업이 완료되었는지 확인하고 Codex 데스크톱 앱을 다시 시작하도록 허용합니다.")
        request_id = value.get('requestId')
        try:
            valid_id = isinstance(request_id, str) and str(uuid.UUID(request_id)) == request_id
        except ValueError:
            valid_id = False
        if not valid_id:
            raise ValueError("잘못된 초기화 요청 ID")
        with self.gate, self.bridge.account.lock, self.lock:
            self.require_managed_writes()
            if self.state.get('operation') == 'desktopRuntime' and self.state.get('requestId') == request_id:
                return self.public()
            self.assert_editable()
            acknowledged = value.get('acknowledgeUnavailable') is True
            if acknowledged and not (self.state.get('operation') == 'desktopRuntime'
                                     and self.state.get('phase') == 'failed'
                                     and self.state.get('taskStateUnavailable') is True
                                     or self.desktop_preparation.get('state') == 'waiting'
                                     and self.desktop_preparation.get('taskStateUnavailable') is True):
                raise ValueError("계속 진행할지 결정하기 전에 네이티브 연결 초기화에 영향을 받는 작업 상태를 확인하세요.")
            self.idle(pending_only=True)
            executable = self.index.get('desktopExecutable') or DesktopApp.discover(self.runtime)
            if not executable:
                executable = DesktopApp.scan(self.runtime, self.home)
            app = DesktopApp(executable, self.home)
            app.validate(self.runtime)
            from bridge.clients.codex.desktop_runtime import validate_runtime, launcher_settings
            validate_runtime(self.runtime)
            launcher_settings(app.executable)
            self.state = {'phase': 'preparing', 'operation': 'desktopRuntime', 'requestId': request_id, 'error': None}
            self.phase('preparing')
            self.thread = threading.Thread(target=self._initialize_desktop_runtime, args=(app, acknowledged), daemon=True)
            self.thread.start()
            return self.public()

    def prepare_desktop_runtime(self, app, *, cancelled=lambda: False):
        """Startup preparation; return True only when a passive retry is safe.

        Waiting does not change account state or hold a gate between attempts.
        Once a lifecycle write starts, a failure requires explicit recovery.
        """
        if sys.platform not in ('darwin', 'linux', 'win32') or getattr(self.bridge, 'host', 'local') != 'local':
            return False
        if not self.gate.acquire(timeout=0):
            self.desktop_preparation = {'state': 'waiting', 'reason': '현재 작업이 끝날 때까지 기다린 후 기본 사이드 채팅을 자동으로 준비합니다.'}
            return True
        try:
            if self.bridge.closed.is_set() or cancelled():
                return False
            self.assert_editable()
            return self._initialize_desktop_runtime(app, automatic=True, cancelled=cancelled)
        except ValueError as exc:
            self.desktop_preparation = {'state': 'waiting', 'reason': str(exc)}
            return True
        finally:
            self.gate.release()

    def _initialize_desktop_runtime(self, app, acknowledged=False, *, automatic=False, cancelled=lambda: False):
        from bridge.clients.codex.desktop_runtime import configure, connect, initialization_lock, process_identity, DesktopRuntimeBusy
        from bridge.clients.codex.desktop_runtime import preparation, record_preparation, settings
        from bridge.clients.codex.app_server import AppServerUnavailable
        from bridge.clients.lifecycle import inspect_client, stop_client
        if sys.platform == 'win32':
            from bridge.platforms.windows.codex_daemon_env import read_process_environment
            from bridge.platforms.windows.desktop import commands
        elif sys.platform == 'linux':
            from bridge.platforms.linux.codex_daemon_env import read_process_environment
            from bridge.platforms.linux.desktop import commands
        else:
            from bridge.platforms.macos.codex_daemon_env import read_process_environment
            from bridge.platforms.macos.desktop import commands
        descriptor = {'id': 'codex', 'installed': True, 'executable': str(app.executable), 'dataDirectory': str(self.home)}

        def observed():
            state = inspect_client(descriptor)
            main = state.get('mainPids', [])
            if state.get('unknown') or len(main) > 1 or state.get('running') and not main:
                raise ValueError("단일 Codex 데스크톱 프로세스를 확인할 수 없습니다. 컴퓨터를 확인하고 다시 시도하세요.")
            identities = {pid: process_identity(pid) for pid in main}
            if any(identity['image'] != os.path.normcase(str(app.executable)) for identity in identities.values()):
                raise ValueError("Codex 데스크탑 프로세스 ID가 변경되었습니다. 연결을 다시 초기화하십시오.")
            launch_commands = commands(main) if main else {}
            for pid, identity in identities.items():
                if sys.platform == 'linux':
                    record = {'processIdentity': {key: identity[key] for key in ('bootId', 'startTicks')}}
                else:
                    record = ({'processStartTime': str(identity['created'])} if sys.platform == 'win32' else
                              {'processIdentity': {'uniqueId': identity['birth'][0], 'startSeconds': identity['started'][0],
                                                   'startMicroseconds': identity['started'][1]}})
                environment, _ = read_process_environment(pid, record, app.executable,
                    ('CODEX_HOME', 'CODEX_SQLITE_HOME', 'CODEX_ELECTRON_USER_DATA_PATH', 'HOME', 'USERPROFILE'))
                user_home = environment.get('USERPROFILE' if sys.platform == 'win32' else 'HOME') or Path.home()
                home = Path(environment.get('CODEX_HOME') or Path(user_home)/'.codex').resolve()
                sqlite_home = Path(environment.get('CODEX_SQLITE_HOME') or home).resolve()
                command = launch_commands.get(pid)
                if (home != self.home.resolve() or sqlite_home != home or environment.get('CODEX_ELECTRON_USER_DATA_PATH')
                        or not command or re.search(r'''(?:^|[\s"'])--user-data-dir(?:[=\s"']|$)''', command)):
                    raise ValueError("실행 중인 Codex는 다른 구성 디렉터리를 사용합니다. 이 연결을 초기화할 수 없습니다.")
                if process_identity(pid) != identity:
                    raise ValueError("Codex 데스크탑 프로세스 ID가 변경되었습니다. 연결을 다시 초기화하십시오.")
            return state, identities

        try:
            with self.gate, self.bridge.account.lock, initialization_lock(self.home):
                preparation_error = None
                if automatic:
                    self.desktop_preparation = {'state': 'checking'}
                    # Recheck under the shared initialization lock: another
                    # gateway may have prepared this same App in the meantime.
                    try:
                        client = connect(self.home, self.runtime)
                    except (OSError, ValueError, AppServerUnavailable):
                        client = None
                    if client is not None:
                        client.close()
                        prior = preparation(self.home)
                        if prior and prior['state'] == 'pending':
                            record_preparation(self.home, prior['requestId'], complete=True)
                        self.desktop_preparation = {'state': 'ready'}
                        return False
                    prior = preparation(self.home)
                    if prior and prior['state'] == 'pending':
                        self.desktop_preparation = {'state': 'failed', 'reason': '마지막 기본 연결 준비 결과를 확인해야 합니다. 계정관리에서 다시 준비해주세요. 자동으로 다시 시작되지 않습니다.'}
                        return False
                    app.validate(self.runtime)
                    from bridge.clients.codex.desktop_runtime import validate_runtime, launcher_settings
                    try:
                        self.require_managed_writes()
                        validate_runtime(self.runtime)
                        launcher_settings(app.executable)
                    except ValueError as exc:
                        # An unsupported shared transport must not prevent an
                        # ordinary cold App launch. Existing shared settings or
                        # an uncertain launch never use this fallback.
                        if settings(self.home) is not None:
                            raise
                        preparation_error = exc
                state, identities = observed()
                if preparation_error and state['running']:
                    raise preparation_error
                try:
                    self.bridge.assert_desktop_idle(allow_stopped_app=not state['running'], desktop_only=True,
                        desktop_executable=app.executable,
                        **({'timeout': 3} if automatic else {}))
                except (TaskStateUnavailable, TaskAuditIncomplete) as exc:
                    if automatic:
                        self.desktop_preparation = {'state': 'waiting', 'reason': str(exc), 'taskStateUnavailable': True}
                        return True
                    if not acknowledged:
                        self.phase('failed', error=str(exc), taskStateUnavailable=True)
                        return
                    # Consent covers unknown tasks, never a new queued/unknown
                    # write or a known busy owner found by the fresh audit.
                    self.idle(pending_only=True)
                except ValueError as exc:
                    if not automatic:
                        raise
                    self.desktop_preparation = {'state': 'waiting', 'reason': str(exc)}
                    return True
                current, current_identities = observed()
                if identities != current_identities or set(state['pids']) != set(current['pids']):
                    raise ValueError("Codex 데스크탑 프로세스가 변경되었습니다. 연결을 다시 초기화하십시오.")
                if automatic:
                    if self.bridge.closed.is_set() or cancelled():
                        return False
                    self.state = {'phase': 'preparing', 'operation': 'desktopRuntime', 'automatic': True,
                                  'requestId': str(uuid.uuid4()), 'error': None}
                    self.phase('preparing')
                    self.desktop_preparation = {'state': 'preparing'}
                # This receipt must precede stop/configure/start and live beside
                # the shared lock, not in a gateway-specific account directory.
                record_preparation(self.home, self.state['requestId'])
                if state['running']:
                    self.phase('stopping')
                    stop_client(descriptor, state=current)
                    self.wait_stopped()
                self.invalidate()
                if observed()[0]['running']:
                    raise ValueError("Codex 데스크탑이 다시 시작되었습니다. 연결을 다시 초기화하십시오.")
                if automatic and (self.bridge.closed.is_set() or cancelled()):
                    raise ValueError('게이트웨이 준비가 중지되었으며 기본 연결이 완료되지 않았습니다. 계정관리에서 다시 준비해주세요.')
                if not preparation_error:
                    self.phase('applying')
                    configure(self.home, app.executable, self.runtime)
                if automatic and (self.bridge.closed.is_set() or cancelled()):
                    raise ValueError('게이트웨이 준비가 중지되었으며 아직 시작되지 않았습니다. Codex；계정관리에서 다시 준비해주세요')
                self.phase('starting')
                app.start()
                self.phase('verifying')
                self.wait_ready(app, native_runtime=not preparation_error)
                record_preparation(self.home, self.state['requestId'], complete=True)
                self.phase('complete', error=None)
                self.desktop_preparation = ({'state': 'failed', 'reason': str(preparation_error)}
                                            if preparation_error else {'state': 'ready'})
                return False
        except Exception as exc:
            # Keep a successfully saved configuration available for an explicit
            # retry. Never force-stop or automatically start the App a second time.
            if automatic and isinstance(exc, DesktopRuntimeBusy) and self.desktop_preparation.get('state') != 'preparing':
                self.desktop_preparation = {'state': 'waiting', 'reason': str(exc)}
                return True
            if not automatic or self.desktop_preparation.get('state') == 'preparing':
                self.phase('failed', error=str(exc))
            self.desktop_preparation = {'state': 'failed', 'reason': str(exc)}
            return False

    def snapshot_files(self):
        result = {}
        for name in ('config.toml', 'auth.json'):
            file = self.home/name
            if file.is_symlink():
                raise ValueError("계정 전환은 심볼릭 링크된 인증 또는 구성 파일을 지원하지 않습니다.")
            result[name] = base64.b64encode(file.read_bytes()).decode() if file.exists() else None
        return result

    def restore_files(self, snapshot):
        for name, data in snapshot.items():
            if name not in ('config.toml', 'auth.json'):
                raise ValueError('복구 파일이 잘못되었습니다.')
            if data is None:
                (self.home/name).unlink(missing_ok=True)
            else:
                private_bytes(self.home/name, base64.b64decode(data))

    def prepare(self, row, before):
        self.require_managed_writes()
        folder = self.root/'prepared'
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(mode=0o700)
        if before['config.toml'] is not None:
            private_bytes(folder/'config.toml', base64.b64decode(before['config.toml']))
        changes = {'cli_auth_credentials_store': 'file', 'model_provider': 'openai', 'model_providers.bridge_api': None, 'openai_base_url': None}
        if row['kind'] == 'chatgpt':
            private_bytes(folder/'auth.json', (self.directory(row['id'])/'auth.json').read_bytes())
            changes['model_providers.openai'] = None
            # Saved chats may still use this ID. Keep an official-auth alias so
            # the desktop can resume them normally without migrating projects.
            changes['model_providers.bridge_api'] = {
                'name': 'OpenAI', 'wire_api': 'responses',
                'requires_openai_auth': True, 'supports_websockets': True}
        else:
            secret = read_json(self.directory(row['id'])/'api.json', {})['key']
            private_json(folder/'auth.json', {'auth_mode': 'apikey', 'OPENAI_API_KEY': secret})
            changes.update(model_provider='bridge_api', model=row['model'], service_tier=None)
            provider = {'name': 'Bridge API', 'base_url': row['baseUrl'], 'wire_api': 'responses',
                        'requires_openai_auth': True, 'supports_websockets': False}
            changes['model_providers.bridge_api'] = provider
            # The desktop may explicitly select openai, including when resuming an
            # existing chat. Both provider IDs must use the selected API endpoint.
            changes['model_providers.openai'] = None
            changes['openai_base_url'] = row['baseUrl']
        with ManagedRPC(folder, self.runtime) as rpc:
            config = rpc.request('config/read', {'includeLayers': False}).get('config', {})
            if config.get('forced_login_method'):
                changes['forced_login_method'] = 'chatgpt' if row['kind'] == 'chatgpt' else 'api'
            if config.get('profile'):
                raise ValueError("구성 프로필이 활성화되었습니다. 먼저 데스크탑에서 기본 구성으로 전환하십시오.")
            if row['kind'] == 'chatgpt':
                # Let the official runtime select its default model.
                changes['model'] = None
            result = rpc.request('config/batchWrite', {'edits': [{'keyPath': key, 'value': val, 'mergeStrategy': 'replace'}
                                                                for key, val in changes.items()]})
            if result.get('status') != 'ok':
                raise ValueError("다른 구성 레이어는 이 연결을 재정의합니다. 안전하게 전환할 수 없습니다.")
        if row['kind'] == 'chatgpt':
            with ManagedRPC(folder, self.runtime) as rpc:
                auth = rpc.request('account/read', {'refreshToken': False}).get('account') or {}
                if auth.get('type') != 'chatgpt' or auth.get('email') != row.get('email'):
                    raise ValueError("저장된 계정에 다시 로그인하세요.")
        return folder

    def wait_stopped(self):
        end = time.monotonic()+8
        while time.monotonic() < end:
            try:
                stream = connect_stream(self.bridge.ipc.path, timeout=.5)
            except OSError:
                if sys.platform in ('darwin', 'linux') and getattr(self.bridge, 'host', 'local') == 'local':
                    from bridge.clients.codex.desktop_runtime import wait_stopped
                    wait_stopped(self.home)
                return
            stream.close()
            time.sleep(.25)
        raise ValueError("데스크톱 인스턴스가 아직 연결을 사용하고 있습니다. 컴퓨터를 닫고 다시 시도하세요.")

    def wait_ready(self, app, row=None, *, native_runtime=False):
        end = time.monotonic()+35
        while time.monotonic() < end:
            try:
                if not app.processes():
                    time.sleep(.5)
                    continue
                self.bridge.ipc.connect()
                if native_runtime:
                    # Desktop IPC can be available before the shared handshake.
                    from bridge.clients.codex.desktop_runtime import connect
                    client = connect(self.home, self.runtime)
                    if client is None:
                        raise ValueError('확인할 수 없습니다 Codex 기본 공유 연결')
                    client.close()
                if row:
                    with ManagedRPC(self.home, self.runtime) as rpc:
                        config = rpc.request('config/read', {'includeLayers': False}).get('config', {})
                        provider = config.get('model_provider') or 'openai'
                        if provider != ('openai' if row['kind'] == 'chatgpt' else 'bridge_api'):
                            raise ValueError("모델 제공자 설정이 적용되지 않았습니다.")
                        if row['kind'] == 'chatgpt':
                            auth = rpc.request('account/read', {'refreshToken': False}).get('account') or {}
                            tokens = read_json(self.home/'auth.json', {}).get('tokens') or {}
                            if auth.get('email') != row.get('email') or token_owner({'tokens': tokens}) != row.get('tokenOwner'):
                                raise ValueError("계정 ID가 적용되지 않았습니다.")
                        else:
                            provider_config = (config.get('model_providers') or {}).get('bridge_api') or {}
                            auth = rpc.request('account/read', {'refreshToken': False}).get('account') or {}
                            if (auth.get('type') != 'apiKey' or provider_config.get('base_url') != row['baseUrl']
                                    or config.get('openai_base_url') != row['baseUrl']
                                    or config.get('model') != row['model']):
                                raise ValueError("API 연결 설정이 적용되지 않았습니다.")
                return
            except Exception:
                time.sleep(.5)
        raise ValueError('데스크톱 연결 및 대상 계정을 확인할 수 없습니다. 컴퓨터를 확인하세요.')

    def invalidate(self):
        for bridge in [self.bridge, *self.bridge.remote_bridges.values()]:
            if getattr(bridge, 'side_chats', None):
                bridge.side_chats.close()
            bridge.ipc.close()
            bridge._disconnected()
            if hasattr(bridge.catalog_reader, 'invalidate_models'):
                bridge.catalog_reader.invalidate_models()
            elif hasattr(bridge.catalog_reader, 'cache'):
                bridge.catalog_reader.cache.clear()

    def retain_current(self, snapshot):
        current_id = self.index.get('activeId')
        if current_id and self.row(current_id)['kind'] == 'chatgpt' and snapshot['auth.json']:
            auth = json.loads(base64.b64decode(snapshot['auth.json']))
            if token_owner(auth) and token_owner(auth) == self.row(current_id).get('tokenOwner'):
                private_bytes(self.directory(current_id)/'auth.json', base64.b64decode(snapshot['auth.json']))

    def _switch(self, row, app):
        try:
            with self.bridge.account.lock, self.desktop_runtime_lifecycle():
                self._apply_switch(row, app)
        except Exception as exc:
            # A competing gateway must not turn lock contention into an App
            # exit or account mutation. The caller can explicitly retry later.
            self.phase('failed', error=str(exc))

    def _apply_switch(self, row, app):
        before = None
        stopped = False
        try:
            before = self.snapshot_files()
            self.retain_current(before)
            folder = self.prepare(row, before)
            backup = {'files': before, 'activeId': self.index.get('activeId'), 'desktopExecutable': str(app.executable)}
            private_json(self.root/'rollback.json', backup)
            self.phase('stopping')
            self.invalidate()
            app.stop(provider='codex')
            self.wait_stopped()
            stopped = True
            # The GUI may refresh tokens or persist settings while exiting.
            after_stop = self.snapshot_files()
            changed = after_stop != before
            if changed:
                before = after_stop
                backup['files'] = before
                private_json(self.root/'rollback.json', backup)
                self.retain_current(before)
            if changed:
                folder = self.prepare(row, before)
            from bridge.features.accounts.cli_sync import LocalCliSync
            LocalCliSync(self.bridge)._codex_idle()
            self.phase('applying')
            self.require_managed_writes()
            if self.snapshot_files() != before:
                raise ValueError('액세스 구성이 외부 도구에 의해 수정되어 덮어쓰기가 중지되었습니다.')
            private_bytes(self.home/'config.toml', (folder/'config.toml').read_bytes())
            backup['writtenConfig'] = base64.b64encode((folder/'config.toml').read_bytes()).decode('ascii')
            private_json(self.root/'rollback.json', backup)
            self.require_managed_writes()
            if self.snapshot_files() != {'config.toml': backup['writtenConfig'], 'auth.json': before['auth.json']}:
                raise ValueError('액세스 구성 또는 인증이 다른 도구에 의해 수정되어 덮어쓰기가 중지되었습니다.')
            if (folder/'auth.json').is_file():
                private_bytes(self.home/'auth.json', (folder/'auth.json').read_bytes())
            else:
                (self.home/'auth.json').unlink(missing_ok=True)
            self.phase('starting')
            app.start()
            self.phase('verifying')
            self.wait_ready(app, row)
            with self.lock:
                self.mark_active(row['id'])
                if self.state.get('cliSync', {}).get('status') == 'pending':
                    try:
                        from bridge.features.accounts.cli_sync import LocalCliSync
                        local_cli = LocalCliSync(self.bridge)
                        local_cli._codex_idle()
                        local_cli.verify('codex', row)
                        self.state['cliSync'] = {'status': 'verified'}
                    except Exception as error:
                        self.state['cliSync'] = {'status': 'failed', 'error': str(error),
                                                 'sharedConfigChanged': True}
                self.phase('complete')
            (self.root/'rollback.json').unlink(missing_ok=True)
        except Exception:
            if stopped and before is not None:
                try:
                    self.require_managed_writes()
                    expected = backup.get('writtenConfig', before['config.toml'])
                    if self.snapshot_files()['config.toml'] != expected:
                        raise ValueError('다른 도구에 의해 구성이 수정되었으므로 덮어쓰기 및 복구가 금지됩니다.')
                    self.phase('restoring')
                    app.stop(provider='codex')
                    self.wait_stopped()
                    self.require_managed_writes()
                    if self.snapshot_files()['config.toml'] != expected:
                        raise ValueError('다른 도구에 의해 구성이 수정되었으므로 덮어쓰기 및 복구가 금지됩니다.')
                    self.restore_files(before)
                    self.invalidate()
                    app.start()
                    self.wait_ready(app)
                    with self.lock:
                        self.mark_active(backup['activeId'])
                    if self.state.get('cliSync', {}).get('status') == 'pending':
                        self.state['cliSync'] = {'status': 'not-applied', 'desktopStatus': 'restored'}
                    self.phase('restored', error="전환에 실패했습니다. 이전 계정이 복원되었습니다. 데스크톱 앱을 확인하거나 다시 로그인하세요.")
                    (self.root/'rollback.json').unlink(missing_ok=True)
                except Exception:
                    if self.state.get('cliSync', {}).get('status') == 'pending':
                        self.state['cliSync'] = {'status': 'unknown', 'desktopStatus': 'unknown'}
                    self.phase('interrupted', error="자동 복구에 실패했습니다. 데스크톱 앱에서 이전 계정을 복원하세요.")
            else:
                message = ("데스크톱 앱이 닫히지 않았습니다. 시스템 권한을 확인하거나 수동으로 닫은 후 다시 시도하세요." if self.state.get('phase') == 'stopping'
                           else "전환이 수행되지 않았습니다. 로그인, 구성 제한 및 데스크톱 실행 파일을 확인하세요.")
                if self.state.get('cliSync', {}).get('status') == 'pending':
                    self.state['cliSync'] = {'status': 'not-applied', 'desktopStatus': 'failed'}
                self.phase('failed', error=message)
        finally:
            shutil.rmtree(self.root/'prepared', ignore_errors=True)

    def recover(self, value):
        self.require_managed_writes()
        if value.get('confirmed') is not True:
            raise ValueError("이전 연결 복원을 확인하고 데스크톱 앱을 다시 시작하세요.")
        with self.gate, self.lock:
            if self.state.get('phase') != 'interrupted':
                raise ValueError("복구가 필요하지 않습니다.")
            backup = read_json(self.root/'rollback.json', None)
            if not backup:
                self.phase('failed', error='액세스가 수정되지 않았습니다. 스위치를 다시 시작하십시오.')
                return self.desktop_status()
            self.phase('restoring')
            def run():
                try:
                    with self.bridge.account.lock, self.desktop_runtime_lifecycle():
                        app = DesktopApp(backup['desktopExecutable'], self.home)
                        app.validate(self.runtime)
                        app.stop(provider='codex')
                        self.wait_stopped()
                        self.require_managed_writes()
                        if 'writtenConfig' in backup and self.snapshot_files()['config.toml'] not in (backup['writtenConfig'], backup['files']['config.toml']):
                            raise ValueError('다른 도구에 의해 구성이 수정되었으므로 덮어쓰기 및 복구가 금지됩니다.')
                        self.restore_files(backup['files'])
                        if backup.get('threadsApplying'):
                            # Only older previews wrote thread migrations to this
                            # recovery record. New switches never load projects.
                            from bridge.features.sessions.access import ThreadAccess
                            ThreadAccess(self.bridge).restore(backup['threads'])
                        self.invalidate()
                        app.start()
                        self.wait_ready(app)
                        with self.lock:
                            self.mark_active(backup['activeId'])
                            self.phase('restored', error=None)
                        (self.root/'rollback.json').unlink(missing_ok=True)
                except Exception:
                    self.phase('interrupted', error='복구가 완료되지 않았습니다. 데스크톱 프로그램 경로와 실행상태를 확인해주세요.')
            self.thread = threading.Thread(target=run, daemon=True)
            self.thread.start()
            return self.desktop_status()
