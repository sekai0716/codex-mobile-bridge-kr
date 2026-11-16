"""Antigravity history, original-server writes and explicitly enabled hooks."""
import hashlib
import json
from pathlib import Path
import threading

from bridge.clients.errors import BridgeUnavailable
from bridge.clients.file_mentions import file_mentions
from bridge.platforms.antigravity import profile_lease
from .cli_session import AntigravityCli
from .hook_ipc import HookIPCServer
from .model import COMPOSER_PRESENTATION, PERMISSION_OPTIONS, SURFACE_LABELS, gateway_id
from .setup import disable_plugin, ensure_plugin, inspect_plugin, plugin_directory
from .store import AntigravityStore


class Antigravity:
    def __init__(self, directory, home=None, model_catalog=None):
        self.directory = Path(directory).resolve()
        self.home = Path(home or Path.home()).expanduser().resolve()
        self.store = AntigravityStore(self.directory/'scratch', home=self.home)
        self.cli = AntigravityCli(self.home, model_catalog=model_catalog)
        self.hooks = None
        self._lease = None
        self._lock = threading.RLock()
        self.settings_file = self.directory/'session-settings.json'
        try:
            value = json.loads(self.settings_file.read_text(encoding='utf-8'))
            self._settings = value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            self._settings = {}

    def _hook_session(self, payload):
        cid, transcript = payload.get('conversationId'), payload.get('transcriptPath')
        if not isinstance(cid, str) or not isinstance(transcript, str):
            return None
        candidates = [row for row in self.store.list_sessions() if row['nativeId'] == cid]
        for row in candidates:
            expected = Path(row['surfaceRoot'])/'brain'/cid/'.system_generated/logs/transcript.jsonl'
            if Path(transcript).expanduser().resolve() == expected.resolve():
                return row['id']
        return None

    def ensure_plugin(self):
        with self._lock:
            if self._lease is None:
                self._lease = profile_lease(plugin_directory(self.home)/'gateway.lock')
            if self.hooks is None:
                self.hooks = HookIPCServer(self.directory, session_resolver=self._hook_session)
            try:
                return ensure_plugin(self.directory, self.home)
            except Exception:
                self.hooks.close()
                self.hooks = None
                self._lease.close()
                self._lease = None
                raise

    def disable_plugin(self):
        with self._lock:
            if self._lease is None:
                self._lease = profile_lease(plugin_directory(self.home)/'gateway.lock')
            result = disable_plugin(self.directory, self.home)
            if self.hooks:
                self.hooks.close()
                self.hooks = None
            self._lease.close()
            self._lease = None
            return result

    def status(self):
        surfaces = self.store.surfaces()
        live = any(self.cli.available(surface) for surface in SURFACE_LABELS)
        return {'installed': bool(surfaces) or live, 'configured': bool(surfaces) or live, 'connected': live,
                'historyAvailable': bool(surfaces),
                'reason': '기본 서비스가 연결되었습니다' if live else ('기계의 역사를 읽을 수 있습니다. 실시간 작업에는 해당 컴퓨터가 필요합니다. Antigravity 네이티브 서비스' if surfaces else "네이티브 서비스가 연결되지 않았습니다. 컴퓨터에서 원래 클라이언트를 엽니다"),
                'pluginEnabled': bool(self.hooks)}

    def account_scope(self, surface=None):
        if surface is not None:
            if surface not in SURFACE_LABELS:
                raise ValueError('Antigravity 잘못된 소스')
            status = self.cli.user_status(surface)
            identity = status.get('email') or status.get('userId')
            if not isinstance(identity, str) or not identity:
                raise BridgeUnavailable('먼저 답변 부탁드립니다 Antigravity 원래 클라이언트 로그인')
            return hashlib.sha256(identity.encode()).hexdigest()
        accounts = []
        for surface in SURFACE_LABELS:
            try:
                status = self.cli.user_status(surface)
            except (OSError, ValueError, BridgeUnavailable):
                continue
            identity = status.get('email') or status.get('userId')
            if identity:
                accounts.append((surface, identity))
        return hashlib.sha256(json.dumps(accounts, sort_keys=True).encode()).hexdigest() if accounts else ''

    def accounts(self):
        """Project native identities into the shared account panel, without reading credentials."""
        accounts, notices = [], []
        for surface, label in SURFACE_LABELS.items():
            if not self.cli.available(surface):
                notices.append(label+'：기본 서비스가 연결되지 않았습니다')
                continue
            try:
                user = self.cli.user_status(surface)
            except (OSError, ValueError, BridgeUnavailable):
                notices.append(label+'：계정 상태를 일시적으로 사용할 수 없습니다.')
                continue
            identity = user.get('email') or user.get('userId')
            if not isinstance(identity, str) or not identity:
                notices.append(label+'：아직 로그인하지 않았습니다.')
                continue
            identifier = surface+':'+hashlib.sha256(identity.encode()).hexdigest()
            accounts.append({'id': identifier, 'surface': surface,
                             'name': label+' · '+(user.get('name') or identity),
                             'email': user.get('email') or '', 'kind': 'official',
                             'saved': False, 'canReadQuota': False})
        return {'accounts': accounts, 'activeIds': [row['id'] for row in accounts],
                'activeId': accounts[0]['id'] if accounts else None,
                'current': {'name': ' / '.join(row['name'] for row in accounts)},
                'readOnly': True, 'canImport': False, 'canSwitch': False,
                'capabilities': {'addApi': False, 'quota': False},
                'message': '；'.join(notices),
                'enrollmentHint': 'APP、CLI、IDE 로그인 상태는 별도로 읽혀집니다. 해당 원래 클라이언트에 로그인하거나 계정을 전환한 후 이 페이지를 새로 고치십시오.。'}

    def project_environments(self):
        return [{'surface': row['key'], 'host': 'local', 'hostLabel': '이 컴퓨터', 'name': row['name'],
                 'scope': str(row['root']), 'createRequiresMessage': True, 'createTitle': False} for row in self.store.surfaces()]

    def _waiting_state(self, surface, *, live=True, fresh=False):
        if not live:
            return {}, set()
        if fresh:
            return self.cli.waiting_state_by_cid(surface=surface, max_age=0)
        try:
            return self.cli.waiting_state_by_cid(surface=surface)
        except (OSError, ValueError, BridgeUnavailable):
            return {}, set()

    def _session(self, row, *, live=None, waiting_state=None):
        key = row['id']
        cid = row['nativeId']
        surface = row['surfaceDirKey']
        if live is None:
            live = self.cli.available(surface)
        waiting_by_cid, active_cids = waiting_state if waiting_state is not None else self._waiting_state(surface, live=live)
        hook_requests = self.hooks.pending_approvals_for(key) if self.hooks else []
        native_requests = list(waiting_by_cid.get(cid) or [])
        requests = hook_requests + native_requests
        hooked = bool(self.hooks and self.hooks.has_recent_heartbeat(key))
        active = row.get('status') == 'active' or hooked or (cid in active_cids) or bool(requests)
        permission = self.hooks.permission_mode(key) if self.hooks else 'desktop'
        return {**row, 'status': 'active' if active else 'idle', 'requests': requests,
                'model': self._settings.get(key, {}).get('model') or '', 'effort': '',
                'permissionMode': permission,
                'permissionLabel': next(option['label'] for option in PERMISSION_OPTIONS if option['value'] == permission),
                'composerCapabilities': dict(COMPOSER_PRESENTATION),
                'connectionState': 'ready' if live else 'detached', 'readOnly': not live,
                'capabilities': {'send': live, 'stop': live and active, 'models': live, 'effort': False, 'manualModels': live, 'manualEffort': False,
                                 'permissions': bool(self.hooks), 'attachments': live, 'uploadFiles': live,
                                 'queue': hooked, 'steer': hooked, 'skills': False, 'rename': False,
                                 'plan': False, 'goal': False, 'archive': False, 'unarchive': False}}

    def management(self):
        """Inspect each native source and existing per-session settings without starting it."""
        found = {row['key']: row for row in self.store.surfaces()}
        live = {surface: self.cli.available(surface) for surface in SURFACE_LABELS}
        waiting = {surface: self._waiting_state(surface, live=live[surface]) for surface in SURFACE_LABELS}
        sessions = [self._session(row, live=live[row['surfaceDirKey']], waiting_state=waiting[row['surfaceDirKey']])
                    for row in self.store.list_sessions()]
        return {'surfaces': [
            {'id': surface, 'name': name, 'historyAvailable': surface in found,
             'connected': live[surface],
             'sessions': [row for row in sessions if row['surfaceDirKey'] == surface]}
            for surface, name in SURFACE_LABELS.items()],
            'plugin': {**inspect_plugin(self.directory, self.home), 'active': bool(self.hooks)},
            'permissionOptions': PERMISSION_OPTIONS}

    def record_path(self, sid):
        from bridge.features.workspace.workspace import Workspace
        row = self.store.resolve_session(sid)
        if row is None:
            raise ValueError('찾을 수 없음 Antigravity 채팅')
        workspace = Workspace(row['surfaceRoot'])
        logs = 'brain/' + row['nativeId'] + '/.system_generated/logs/'
        for relative in (logs+'transcript.jsonl', logs+'transcript_full.jsonl', 'conversation_summaries.db'):
            try:
                info = workspace.info(relative)
                if info['kind'] == 'file':
                    return info['absolutePath']
            except (OSError, ValueError, PermissionError):
                continue
        return None

    @staticmethod
    def _prompt(body):
        text = str(body.get('text') or body.get('firstMessage') or '').strip()
        files = [row for name in ('resolvedReferences', 'resolvedImages', 'resolvedFiles')
                 for row in body.get(name, []) if isinstance(row, dict) and isinstance(row.get('path'), str)]
        return file_mentions(text, files) if files else text

    def _account(self, surface='app', refresh=False):
        payload = self.cli.catalog_models(surface=surface, refresh=refresh)
        user = payload['userStatus']
        out = {'account': {'provider': 'antigravity', 'name': user.get('name') or 'Antigravity',
                           'email': user.get('email') or '', 'tier': (user.get('userTier') or {}).get('name') or ''},
               'models': payload['models'], 'notice': payload['notice'],
               'capabilities': {'models': True, 'effort': False, 'manualModels': True, 'manualEffort': False}}
        if payload.get('usageSummary'):
            out['usageSummary'] = payload['usageSummary']
        return out

    def call(self, action, sid=None, body=None):
        body = body or {}
        if action == 'status':
            return self.status()
        if action in ('list', 'lifecycle'):
            rows = self.store.list_sessions()
            live = {surface: self.cli.available(surface) for surface in {row['surfaceDirKey'] for row in rows}}
            waiting = {surface: self._waiting_state(surface, live=live[surface]) for surface in live}
            return {'connected': True, 'complete': True,
                    'sessions': [self._session(row, live=live[row['surfaceDirKey']], waiting_state=waiting[row['surfaceDirKey']]) for row in rows]}
        if action == 'projects':
            return {'projects': self.store.discover_projects(), 'createRequiresMessage': True, 'createModels': True}
        if action == 'account':
            if body.get('surface'):
                surface = body['surface']
                if surface not in SURFACE_LABELS:
                    raise ValueError('Antigravity 잘못된 소스')
                if self.cli.available(surface):
                    return self._account(surface, body.get('refresh') is True)
                return {'models': [], 'notice': '컴퓨터 네이티브 서비스가 아직 연결되지 않았습니다.', 'capabilities': {'models': False, 'effort': False}}
            groups, errors = [], []
            for surface, label in SURFACE_LABELS.items():
                if not self.cli.available(surface):
                    continue
                try:
                    value = self._account(surface, body.get('refresh') is True)
                except (OSError, ValueError, BridgeUnavailable):
                    value = {'models': [], 'notice': '원래 클라이언트 모델을 일시적으로 사용할 수 없습니다.'}
                    errors.append(label+'：'+value['notice'])
                groups.append({'surface': surface, 'label': label, **value})
            return {'groups': groups, 'models': [], 'modelError': '；'.join(errors),
                    'notice': '' if groups else '컴퓨터 네이티브 서비스가 아직 연결되지 않았습니다.',
                    'capabilities': {'models': bool(groups), 'effort': False}}
        if action == 'create':
            prompt = self._prompt(body)
            project = body.get('directoryProject') or next((p for p in self.store.discover_projects()
                                                           if p['key'] == body.get('projectKey')), None)
            if not prompt or not project:
                raise ValueError('선택해주세요 Antigravity 프로젝트를 시작하고 첫 번째 메시지를 입력하세요.')
            surface = project.get('surface') or 'app'
            cwd = project.get('cwd')
            cid = self.cli.start_cascade(surface=surface, model=body.get('model'), cwd=cwd)
            self.cli.send_user_message(cid, prompt, model=body.get('model'), surface=surface)
            key = gateway_id(surface, cid)
            return {'status': 'accepted', 'id': key, 'sessionId': key, 'result': {'id': key, 'sessionId': key}}
        row = self.store.resolve_session(sid)
        if row is None:
            raise ValueError('이것을 찾지 못했습니다 Antigravity 대화')
        key, cid, surface = row['id'], row['nativeId'], row['surfaceDirKey']
        session = self._session(row, waiting_state=None if action == 'detail' else ({}, set()))
        if action == 'detail':
            page = self.store.read_transcript_page(row['surfaceRoot'], cid, limit=body.get('historyLimit') or 40,
                                                   before=body.get('historyBefore'), session_active=session['status'] == 'active')
            if page.get('contextUsage'):
                session['contextUsage'] = page['contextUsage']
            queued = self.hooks.get_queued_items(key) if self.hooks else []
            return {'connected': True, 'session': session, **{k: page[k] for k in ('messages', 'turns', 'history')},
                    'readOnly': session['readOnly'],
                    'notice': '기본 서비스가 연결되어 있지 않습니다. 계속해서 기록을 읽고 초안을 편집할 수 있습니다. 전송 및 모델 설정을 일시적으로 사용할 수 없습니다.。' if session['readOnly'] else '',
                    'requests': session['requests'], 'queued': queued, 'capabilities': session['capabilities'],
                    'submissions': queued, 'draftAccountIdentity': self.account_scope()}
        if action == 'catalog':
            return {**self._account(surface, body.get('refresh') is True), 'currentModel': session['model'], 'skills': []}
        if action == 'tasks':
            return {'tasks': self.store.list_tasks(row['surfaceRoot'], cid)}
        if action == 'image':
            return self.store.read_image(row['surfaceRoot'], cid, body.get('source'))
        if action == 'resume':
            if not self.cli.available(surface):
                raise BridgeUnavailable('먼저 컴퓨터에서 원래 세션을 열어주세요. Antigravity 애플리케이션')
            return {'status': 'ready'}
        if action == 'access':
            if 'mode' in body and not self.hooks:
                raise ValueError('컴퓨터 게이트웨이에서 활성화하십시오. Antigravity 연결')
            mode = self.hooks.set_permission_mode(key, body['mode']) if 'mode' in body else session['permissionMode']
            return {'status': 'accepted', 'mode': mode, 'options': PERMISSION_OPTIONS}
        if action == 'respond':
            request_id = body.get('requestId')
            if not isinstance(request_id, str) or not request_id.strip():
                raise ValueError('요청 누락 ID')
            if request_id.startswith('agy-wait:'):
                self.cli.respond_interaction(cid, request_id, body.get('decision'), answers=body.get('answers'), surface=surface)
                return {'status': 'accepted'}
            if not self.hooks:
                raise ValueError('승인 연결을 사용할 수 없습니다.')
            self.hooks.resolve_approval(key, request_id, body.get('decision'))
            return {'status': 'accepted'}
        if action == 'settings':
            if body.get('effort'):
                raise ValueError('사고 강도를 선택하려면 원래 고객이 제공한 전체 모델 항목을 사용하십시오.')
            model = body.get('model')
            self.cli._model(model, surface)
            with self._lock:
                self._settings[key] = {'model': model}
                self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                temp = self.settings_file.with_suffix('.tmp')
                temp.write_text(json.dumps(self._settings), encoding='utf-8')
                temp.chmod(0o600)
                temp.replace(self.settings_file)
            return {'status': 'accepted', 'model': model}
        if action == 'stop':
            if self.hooks:
                self.hooks.request_stop(key)
            self.cli.stop(cid, surface=surface)
            return {'status': 'accepted'}
        if action == 'queue-action':
            if not self.hooks:
                raise ValueError('대기 중인 연결을 사용할 수 없습니다.')
            operation, queue_id = body.get('operation'), body.get('queueId')
            if operation in ('cancel', 'edit'):
                item = self.hooks.remove_queued_item(key, queue_id)
            elif operation in ('queue', 'steer'):
                item = self.hooks.update_queue_mode(key, queue_id, operation)
            else:
                raise ValueError('대기열 작업이 잘못되었습니다.')
            if item is None:
                raise ValueError('대기 중인 메시지가 전송되거나 제거되었습니다.')
            return {'status': 'accepted', **({'text': item['text']} if operation == 'edit' else {})}
        if action == 'send':
            native_busy = self.store.is_native_busy(row['surfaceRoot'], cid)
            prompt, mode = self._prompt(body), body.get('mode') or 'send'
            if not prompt or mode not in ('send', 'queue', 'steer'):
                raise ValueError('Antigravity 잘못된 메시지 또는 전달 방법')
            waiting_by_cid, active_cids = self._waiting_state(surface, live=True, fresh=True)
            if (waiting_by_cid.get(cid) or (self.hooks and self.hooks.has_pending_approvals(key))) and mode == 'send':
                raise BridgeUnavailable('원본 대화가 상호작용 확인을 기다리고 있습니다. 보내기 전에 먼저 응답해 주세요.')
            if native_busy or cid in active_cids:
                if mode not in ('queue', 'steer') or not self.hooks or not self.hooks.has_recent_heartbeat(key):
                    raise BridgeUnavailable('원래 세션이 실행 중입니다. 끝날 때까지 기다리거나 원래 세션에서 게이트웨이를 다시 로드하십시오. Hook 뒤에 줄을 서다')
                item = self.hooks.enqueue_follow_up(key, prompt, mode=mode)
                return {'status': 'queued', 'id': item['id'], 'delivery': 'hook-' + mode}
            self.cli.send_user_message(cid, prompt, model=session['model'], surface=surface)
            return {'status': 'accepted', 'delivery': 'native'}
        raise ValueError('이 Antigravity 작업은 아직 지원되지 않습니다.')

    def close(self):
        with self._lock:
            if self.hooks:
                self.hooks.close()
                self.hooks = None
            if self._lease:
                self._lease.close()
                self._lease = None
