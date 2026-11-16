"""Gateway-owned saved access for local Codex and Claude Code CLI runtimes."""

import hashlib
import json
import re
import sqlite3
import threading
import time
import uuid
from contextlib import ExitStack
from pathlib import Path
from urllib.parse import urlsplit

from bridge.clients.claude.cli_session import _auth_ready, _profile
from bridge.clients.codex.catalog import ModelStore, MODEL_REFRESH_SECONDS
from bridge.features.accounts.accounts import private_json
from bridge.features.accounts.models import model_ids
from bridge.features.notifications.channels import read_json


class CliAccess:
    def __init__(self, bridge):
        self.bridge = bridge
        self.root = bridge.data_dir/'cli-access'
        if self.root.is_symlink():
            raise ValueError("CLI 액세스 디렉토리는 기호 링크일 수 없습니다.")
        self.lock = threading.RLock()
        self.model_store = ModelStore(self.root)
        self.model_lock = threading.Lock()
        self.model_reads = {}
        self.model_timers = {}
        self.model_refreshing = set()
        self.model_retry_at = {}
        self.model_closed = False
        self.codex_switch = None
        self.claude_verification = None
        self.index = read_json(self.root/'index.json', {'claude': [], 'activeClaude': None})

    def _save(self):
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        private_json(self.root/'index.json', self.index)

    def _claude_row(self, identifier):
        if not isinstance(identifier, str) or not re.fullmatch('[0-9a-f]{32}', identifier):
            raise ValueError("CLI 액세스 ID가 잘못되었습니다.")
        row = next((row for row in self.index['claude'] if row['id'] == identifier), None)
        if row is None:
            raise ValueError("이 CLI 액세스를 사용할 수 없습니다. 목록을 새로 고칩니다.")
        return row

    def claude_profile(self):
        """The unmodified native resolver is the default and remains testable."""
        with self.lock:
            identifier = self.index.get('activeClaude')
            row = self._claude_row(identifier) if identifier else None
            native = _profile()
            if row is None or native is None:
                return native
            directory = Path(row['directory'])
            if row['kind'] == 'native':
                try:
                    if directory.samefile(native['directory']):
                        return native
                except OSError:
                    pass
            try:
                digest = hashlib.sha256((directory/'settings.json').read_bytes()).hexdigest()
            except OSError:
                digest = 'none'
            return {**native, 'directory': directory,
                    'origin': row['originBase']+':'+digest,
                    'managedApi': row['kind'] == 'api'}

    def _claude_cli(self):
        manager = getattr(self.bridge, 'desktop_sessions', None)
        return manager.adapters['claude'].cli if manager else None

    def public(self):
        with self.lock:
            accounts = self.bridge.accounts
            codex = accounts.public()
            native = _profile()
            selected = self.claude_profile()
            rows = [{key: row[key] for key in ('id', 'name', 'kind', 'baseUrl', 'model', 'authScheme') if key in row}
                    | {'active': row['id'] == self.index.get('activeClaude'),
                       'keySaved': row['kind'] == 'api' and Path(row['secretPath']).is_file()}
                    for row in self.index['claude']]
            for provider, cards in (('codex', codex['accounts']), ('claude', rows)):
                for card in cards:
                    if card['kind'] == 'api':
                        try:
                            card['modelCatalogIdentity'] = self._probe_source(provider, card['id'])[-1]
                        except (OSError, ValueError, KeyError, TypeError):
                            pass
            return {'codex': {'accounts': codex['accounts'], 'activeId': codex['activeId'],
                              'activeVerified': codex['activeVerified'], 'sharedWithDesktop': True,
                              'switch': codex['switch'], 'cliSwitch': self.codex_switch, 'blockers': codex['blockers']},
                    'claude': {'accounts': rows, 'activeId': self.index.get('activeClaude'),
                               'nativeDirectory': str(native['directory']) if native else None,
                               'selectedDirectory': str(selected['directory']) if selected else None,
                               'available': bool(selected), 'sharedWithDesktop': False,
                               'verification': (self.claude_verification['result']
                                                if self.claude_verification and selected
                                                and self.claude_verification['origin'] == selected['origin'] else None)}}

    @staticmethod
    def _name(value):
        name = value.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise ValueError("1~80자의 액세스 이름을 입력합니다.")
        return name.strip()

    def _claude_api(self, value):
        from bridge.features.accounts.accounts import Accounts
        name = self._name(value)
        url = Accounts.api_url(value.get('baseUrl'))
        model = value.get('model', '')
        if not isinstance(model, str) or len(model) > 200 or any(c in model for c in '\r\n\x00'):
            raise ValueError('모델 ID 유효하지 않은')
        scheme = value.get('authScheme', 'x-api-key')
        if scheme not in ('x-api-key', 'bearer'):
            raise ValueError('Claude API 인증 방법이 잘못되었습니다.')
        existing = self._claude_row(value['id']) if value.get('id') else None
        if existing and (existing['kind'] != 'api' or existing['id'] == self.index.get('activeClaude')):
            raise ValueError("이 API 구성을 편집하기 전에 다른 액세스로 전환하십시오.")
        identifier = existing['id'] if existing else uuid.uuid4().hex
        native = _profile()
        if native is None:
            raise ValueError("Claude Code CLI를 찾을 수 없습니다.")
        directory = Path(existing['directory']) if existing else native['directory']
        fresh_default = (not directory.exists() and not directory.is_symlink()
                         and native['origin'].startswith('default:')
                         and directory == native['directory'])
        if not directory.is_dir() and not fresh_default:
            raise ValueError('Claude Code 구성 디렉터리를 사용할 수 없습니다.')
        private_dir = self.root/'claude'/identifier
        if private_dir.is_symlink():
            raise ValueError("CLI 액세스 디렉토리는 기호 링크일 수 없습니다.")
        secret_path = private_dir/'api.json'
        key = value.get('apiKey', '')
        if not key and existing:
            key = read_json(secret_path, {}).get('key', '')
        if not isinstance(key, str) or not 1 <= len(key) <= 8192 or any(c in key for c in '\r\n\x00'):
            raise ValueError("유효한 API 키를 입력하세요.")
        private_json(secret_path, {'key': key})
        row = {'id': identifier, 'name': name, 'kind': 'api', 'baseUrl': url,
               'model': model, 'authScheme': value.get('authScheme', 'x-api-key'),
               'directory': str(directory), 'secretPath': str(secret_path),
               'originBase': 'gateway:'+identifier+':'+str(directory)}
        if existing:
            existing.update(row)
        else:
            self.index['claude'].append(row)
        self._save()
        return identifier

    def _import_claude(self, value):
        name = self._name(value)
        native = _profile()
        if native is None:
            raise ValueError("Claude Code CLI를 찾을 수 없습니다.")
        source = value.get('directory') or str(native['directory'])
        if not isinstance(source, str) or not Path(source).expanduser().is_absolute():
            raise ValueError('이 기계를 채워주세요 Claude 구성 디렉터리의 전체 경로')
        candidate = Path(source).expanduser()
        if candidate.is_symlink():
            raise ValueError('Claude 구성 디렉터리를 사용할 수 없습니다.')
        directory = candidate.resolve(strict=True)
        if not directory.is_dir():
            raise ValueError('Claude 구성 디렉터리를 사용할 수 없습니다.')
        profile = {**native, 'directory': directory}
        if not _auth_ready(profile):
            raise ValueError("이 Claude 구성 디렉터리는 로그인되어 있지 않습니다.")
        row = next((row for row in self.index['claude'] if row['kind'] == 'native' and row['directory'] == str(directory)), None)
        if row:
            row['name'] = name
        else:
            identifier = uuid.uuid4().hex
            origin = native['origin'].rsplit(':', 1)[0] if directory.samefile(native['directory']) else 'native:'+str(directory)
            self.index['claude'].append({'id': identifier, 'name': name, 'kind': 'native',
                                         'directory': str(directory), 'originBase': origin})
        self._save()

    def change(self, value):
        if not isinstance(value, dict) or value.get('provider') not in ('codex', 'claude'):
            raise ValueError("CLI 액세스 요청이 잘못되었습니다.")
        provider, action = value['provider'], value.get('action')
        if action == 'modelsDraft':
            if provider != 'codex' or set(value) - {'provider', 'action', 'id', 'baseUrl', 'apiKey'}:
                raise ValueError("잘못된 모델 조회 매개변수")
            from bridge.features.accounts.api_drafts import model_draft
            accounts = self.bridge.accounts
            with accounts.lock:
                accounts.assert_editable()
            def saved(identifier):
                with accounts.lock:
                    row = accounts.row(identifier)
                    if row['kind'] != 'api':
                        raise ValueError('저장된 것을 선택해주세요 API 연결')
                    if accounts.api_url(value.get('baseUrl', '')) != accounts.api_url(row['baseUrl']):
                        raise ValueError("API URL를 변경한 후 다시 API 키를 입력하세요.")
                    url, key = accounts.api_credentials({'id': identifier, 'baseUrl': row['baseUrl'], 'apiKey': ''})
                    return {'baseUrl': url, 'apiKey': key, 'apiFormat': 'openai-responses'}
            return model_draft(value, saved=saved)
        if action in ('models', 'test'):
            return self._probe_api(provider, value)
        saved_id = None
        with ExitStack() as locks:
            # ClaudeCli.call holds cli.lock while resolving this manager's
            # profile. Keep the same order through the settings transaction.
            if provider == 'claude' and action == 'switch':
                cli = self._claude_cli()
                if cli:
                    locks.enter_context(cli.lock)
            locks.enter_context(self.lock)
            if provider == 'codex':
                accounts = self.bridge.accounts
                if action == 'saveApi':
                    request = dict(value)
                    if request.get('id') and not request.get('apiKey'):
                        request['apiKey'] = read_json(accounts.directory(request['id'])/'api.json', {}).get('key', '')
                    accounts.add_api(request)
                elif action == 'importCurrent':
                    accounts.scan({'source': str(accounts.home)})
                    identity = accounts.info.read_identity()
                    candidate = next((row for row in accounts.discovery['candidates']
                                      if row['canImport'] and not row['imported']
                                      and row['kind'] == identity.get('kind')
                                      and (row['kind'] == 'chatgpt' or
                                           (row['baseUrl'] == identity.get('baseUrl')
                                            and row['model'] == identity.get('model')
                                            and accounts.candidates[row['id']]['key'] == identity.get('key')))), None)
                    if not candidate:
                        raise ValueError('현재 Codex 구성에 가져올 로그인이 없거나 API 연결')
                    accounts.import_account({'candidateId': candidate['id'], 'name': value.get('name') or candidate['name']})
                elif action in ('rename', 'delete'):
                    accounts.control({'action': action, 'id': value.get('id'), 'name': value.get('name')})
                elif action == 'switch':
                    return self._switch(provider, accounts.row(value.get('id')), value)
                else:
                    raise ValueError("이 CLI 액세스 작업은 지원되지 않습니다.")
            elif action == 'saveApi':
                saved_id = self._claude_api(value)
            elif action == 'importCurrent':
                self._import_claude(value)
            elif action == 'importDesktop':
                from bridge.features.accounts.cli_sync import LocalCliSync
                settings = LocalCliSync(self.bridge).import_desktop_claude(value.get('desktopId'))
                saved_id = self._claude_api(settings)
            elif action == 'rename':
                self._claude_row(value.get('id'))['name'] = self._name(value)
                self._save()
            elif action == 'delete':
                row = self._claude_row(value.get('id'))
                if row['id'] == self.index.get('activeClaude'):
                    raise ValueError("이 구성을 삭제하기 전에 다른 액세스로 전환하세요.")
                self.index['claude'].remove(row)
                self._save()
                if row['kind'] == 'api':
                    Path(row['secretPath']).unlink(missing_ok=True)
                    Path(row['secretPath']).parent.rmdir()
            elif action == 'switch':
                return self._switch(provider, self._claude_row(value.get('id')), value)
            else:
                raise ValueError("이 CLI 액세스 작업은 지원되지 않습니다.")
            result = self.public()
            if saved_id:
                result['savedId'] = saved_id
            return result

    def _probe_api(self, provider, value):
        refresh = value.get('refresh') is True
        if (set(value) not in ({'provider', 'action', 'id'}, {'provider', 'action', 'id', 'refresh'}) or
                'refresh' in value and (value['action'] != 'models' or not isinstance(value['refresh'], bool))):
            raise ValueError("CLI 액세스 요청이 잘못되었습니다.")
        row, url, key, headers, identity = self._probe_source(provider, value['id'])
        if value['action'] == 'test':
            models = model_ids(url, key, **headers)
            if self._probe_source(provider, row['id'])[-1] != identity:
                raise ValueError('CLI 액세스 권한이 변경되었습니다. 모델 목록을 다시 읽어보세요.')
            return self._probe_result(provider, row, models)
        try:
            persisted = self.model_store.read(identity)
        except (OSError, sqlite3.DatabaseError, ValueError):
            persisted = None
        if persisted and not refresh:
            if time.time()-persisted[0] >= MODEL_REFRESH_SECONDS:
                self._start_model_refresh(provider, row['id'], identity)
            else:
                self._schedule_model_refresh(provider, row['id'], identity, persisted[0])
            return self._probe_result(provider, row, persisted[1], identity, persisted[0])
        with self.model_lock:
            lock = self.model_reads.setdefault(identity, threading.Lock())
        with lock:
            if not refresh:
                try:
                    persisted = self.model_store.read(identity)
                except (OSError, sqlite3.DatabaseError, ValueError):
                    persisted = None
                if persisted:
                    return self._probe_result(provider, row, persisted[1], identity, persisted[0])
            try:
                models = model_ids(url, key, **headers)
            except (OSError, ValueError):
                if persisted:
                    return self._probe_result(provider, row, persisted[1], identity, persisted[0], error=True)
                raise
            if self._probe_source(provider, row['id'])[-1] != identity:
                raise ValueError('CLI 액세스 권한이 변경되었습니다. 모델 목록을 다시 읽어보세요.')
            try:
                updated_at = self.model_store.write(identity, models)
                self._schedule_model_refresh(provider, row['id'], identity, updated_at, replace=True)
            except (OSError, sqlite3.DatabaseError):
                updated_at = time.time()
            return self._probe_result(provider, row, models, identity, updated_at)

    def _probe_source(self, provider, identifier):
        if provider == 'codex':
            accounts = self.bridge.accounts
            with accounts.lock:
                row = dict(accounts.row(identifier))
                if row['kind'] != 'api':
                    raise ValueError('저장된 것을 선택해주세요 API 연결')
                url, key = accounts.api_credentials({'id': row['id'], 'baseUrl': row['baseUrl'], 'apiKey': ''})
            headers = {}
        else:
            from bridge.features.accounts.cli_sync import LocalCliSync
            with self.lock:
                row = dict(self._claude_row(identifier))
                if row['kind'] != 'api':
                    raise ValueError('저장된 것을 선택해주세요 API 연결')
                key = LocalCliSync(self.bridge)._claude_key(row)
            url = row['baseUrl'].rstrip('/')
            if not urlsplit(url).path.rstrip('/').endswith('/v1'):
                url += '/v1'
            auth = {'Authorization': 'Bearer '+key} if row['authScheme'] == 'bearer' else {'x-api-key': key}
            headers = {'headers': {**auth, 'anthropic-version': '2023-06-01'}}
        identity = ModelStore.key('cli-api', provider, row['id'], url, key,
                                  row.get('authScheme'), row.get('directory'))
        return row, url, key, headers, identity

    def _probe_result(self, provider, row, models, identity=None, updated_at=None, error=False):
        if identity and self._probe_source(provider, row['id'])[-1] != identity:
            raise ValueError('CLI 액세스 권한이 변경되었습니다. 모델 목록을 다시 읽어보세요.')
        result = self.public()
        result['probe'] = {'provider': provider, 'id': row['id'], 'status': 'reachable',
                           'scope': 'models', 'models': models if identity else None,
                           'modelCount': len(models)}
        if identity:
            result['probe']['cache'] = {'state': 'stale' if error or time.time()-updated_at >= MODEL_REFRESH_SECONDS else 'fresh',
                                        'updatedAt': updated_at, 'identity': identity}
            if error:
                result['probe']['modelError'] = '모델 디렉터리 새로 고침이 실패했습니다. 마지막 결과가 유지되었습니다.'
        return result

    def _start_model_refresh(self, provider, identifier, identity):
        with self.model_lock:
            if self.model_closed or identity in self.model_refreshing or time.time() < self.model_retry_at.get(identity, 0):
                return
            self.model_refreshing.add(identity)
        def update():
            try:
                if self._probe_source(provider, identifier)[-1] == identity:
                    self._probe_api(provider, {'provider': provider, 'action': 'models', 'id': identifier, 'refresh': True})
            except (OSError, ValueError):
                pass
            finally:
                with self.model_lock:
                    self.model_retry_at[identity] = time.time()+60
                    self.model_refreshing.discard(identity)
                try:
                    record = self.model_store.read(identity)
                    if record and not self.model_closed and self._probe_source(provider, identifier)[-1] == identity:
                        self._schedule_model_refresh(provider, identifier, identity,
                            max(record[0], time.time()-MODEL_REFRESH_SECONDS+300))
                except (OSError, sqlite3.DatabaseError, ValueError):
                    pass
        threading.Thread(target=update, daemon=True, name='cli-model-refresh-'+provider).start()

    def _schedule_model_refresh(self, provider, identifier, identity, updated_at, replace=False):
        with self.model_lock:
            if replace and identity in self.model_timers:
                self.model_timers.pop(identity).cancel()
            if self.model_closed or identity in self.model_timers:
                return
            delay = max(1, updated_at+MODEL_REFRESH_SECONDS-time.time())
            def due():
                with self.model_lock:
                    self.model_timers.pop(identity, None)
                self._start_model_refresh(provider, identifier, identity)
            timer = threading.Timer(delay, due)
            timer.daemon = True
            self.model_timers[identity] = timer
            timer.start()

    def close(self):
        with self.model_lock:
            self.model_closed = True
            for timer in self.model_timers.values():
                timer.cancel()
            self.model_timers.clear()

    def control(self, value):
        return self.public() if value.get('action') == 'list' else self.change(value)

    def _switch(self, provider, row, value):
        if value.get('confirmed') is not True:
            raise ValueError("이 컴퓨터의 CLI 액세스 스위치를 확인하세요.")
        if provider == 'claude' and _profile() is None:
            raise ValueError("Claude Code CLI를 찾을 수 없습니다.")
        from bridge.features.accounts.cli_sync import LocalCliSync
        sync = LocalCliSync(self.bridge)
        if provider == 'codex' and value.get('requestId') is not None:
            if value.get('tasksConfirmed') is not True:
                raise ValueError('이 액세스를 공유하는 모든 머신이 CLI 임무 종료')
            running, _ = sync._codex_runtime()
            if running and value.get('desktopRestartConfirmed') is not True:
                raise ValueError("데스크톱 작업이 종료되었는지 확인하고 Codex 데스크톱이 다시 시작되도록 허용합니다.")
            accounts = self.bridge.accounts
            accounts.switch({'id': row['id'], 'requestId': value['requestId'],
                             'confirmed': True, 'tasksConfirmed': True})
            if running:
                self.codex_switch = {'phase': 'pending', 'targetId': row['id']}
                threading.Thread(target=self._verify_codex_desktop_switch,
                                 args=(row['id'], accounts.thread), daemon=True).start()
            return self.public()
        preflight = sync.preflight(provider)
        if provider == 'codex' and preflight['desktopRunning']:
            if value.get('desktopRestartConfirmed') is not True or value.get('tasksConfirmed') is not True:
                raise ValueError("데스크톱 작업이 종료되었는지 확인하고 Codex 데스크톱이 다시 시작되도록 허용합니다.")
            accounts = self.bridge.accounts
            request_id = str(uuid.uuid4())
            accounts.switch({'id': row['id'], 'requestId': request_id,
                             'confirmed': True, 'tasksConfirmed': True})
            self.codex_switch = {'phase': 'pending', 'targetId': row['id']}
            threading.Thread(target=self._verify_codex_desktop_switch,
                             args=(row['id'], accounts.thread), daemon=True).start()
            return self.public()
        if provider == 'codex':
            accounts = self.bridge.accounts
            with accounts.gate, self.bridge.account.lock:
                accounts.check_ready()
                before = sync.snapshot(provider)
                applied = None
                try:
                    applied = sync.apply(provider, row)
                    sync.verify(provider, row)
                except Exception:
                    # apply() handles its own partial-write rollback. A
                    # prewrite rejection must not restore an older snapshot
                    # over another account transaction.
                    if applied and applied.get('mutated') is True:
                        sync.restore(provider, before)
                    raise
            return self.public()
        cli = self._claude_cli() if provider == 'claude' else None
        before = sync.snapshot(provider)
        previous_claude = self.index.get('activeClaude')
        previous_verification = self.claude_verification
        try:
            sync.apply(provider, row)
            verification = sync.verify(provider, row)
            if provider == 'claude':
                self.index['activeClaude'] = row['id']
                self._save()
                self.claude_verification = {'result': verification if isinstance(verification, dict) else None,
                                            'origin': self.claude_profile()['origin']}
                if cli:
                    cli.auth_cache = None
        except Exception:
            pointer_changed = provider == 'claude' and self.index.get('activeClaude') != previous_claude
            if pointer_changed:
                self.index['activeClaude'] = previous_claude
            self.claude_verification = previous_verification
            sync.restore(provider, before)
            if pointer_changed:
                self._save()
            raise
        return self.public()

    def _verify_codex_desktop_switch(self, identifier, thread):
        thread.join(timeout=180)
        with self.lock:
            if not self.codex_switch or self.codex_switch.get('targetId') != identifier:
                return
            accounts = self.bridge.accounts
            if thread.is_alive() or accounts.state.get('phase') != 'complete':
                self.codex_switch = {'phase': 'failed', 'targetId': identifier,
                                     'error': accounts.state.get('error') or '데스크톱 계정 전환이 완료되지 않았습니다'}
                return
            try:
                from bridge.features.accounts.cli_sync import LocalCliSync
                sync = LocalCliSync(self.bridge)
                row = accounts.row(identifier)
                sync.apply('codex', row)
                sync.verify('codex', row)
                self.codex_switch = {'phase': 'verified', 'targetId': identifier}
            except Exception as exc:
                self.codex_switch = {'phase': 'failed', 'targetId': identifier, 'error': str(exc)}
