"""Explicit account-switch handoff of a verified idle WSL shared daemon."""
import copy
from contextlib import ExitStack, contextmanager
import json

from bridge.app.lifecycle import private_json
from bridge.clients.codex.ipc import IPCError
from bridge.clients.codex.shared_server import SharedServer
from bridge.platforms.windows import wsl
from bridge.platforms.windows import wsl_account_runtime as native


class CodexRestart:
    def __init__(self, endpoint):
        self.endpoint = endpoint
        self.row = endpoint.row
        self.path = endpoint.data_dir / 'account-restart.json'
        self.runtime = None
        self.temporary = False
        self.record = None
        self.releasable = False
        self.restartRequired = False
        self.recovery_identity = None
        self.native_lock = None

    def _native(self, operation, *args):
        return operation(self.row['distribution'], self.row['user'], self.row['home'], *args)

    def _receipts(self):
        if any(item.get('result', {}).get('status') in ('queued', 'pending', 'unknown')
               for item in self.endpoint.receipts.values()):
            raise ValueError("이 WSL 프로필에는 대기 중인 작업이나 확인되지 않은 결과가 있습니다.")
        for session in self.endpoint.live.values():
            with session.condition:
                if session.activating or session.state.get('requests'):
                    raise ValueError("이 WSL 채팅에는 활성 작업이 있거나 승인 대기 중이 있습니다.")

    def _idle(self):
        self._receipts()
        with self.runtime.lock:
            if self.runtime.pending:
                raise ValueError("이 WSL 제어 연결에는 아직 확인되지 않은 요청이 있습니다.")
        loaded, cursor, seen = [], None, set()
        while True:
            page = self.runtime.request('thread/loaded/list', {'cursor': cursor})
            values = page.get('data')
            if not isinstance(values, list) or any(not isinstance(sid, str) for sid in values):
                raise ValueError("네이티브 WSL 작업 상태를 완전히 확인할 수 없습니다.")
            loaded.extend(values)
            cursor = page.get('nextCursor')
            if not cursor:
                break
            if not isinstance(cursor, str) or cursor in seen:
                raise ValueError("전체 네이티브 WSL 작업 목록을 확인할 수 없습니다.")
            seen.add(cursor)
        threads = {}
        for sid in loaded:
            thread = self.runtime.request('thread/read', {'threadId': sid, 'includeTurns': False})['thread']
            if thread.get('id') != sid or (thread.get('status') or {}).get('type') != 'idle':
                raise ValueError("이 WSL 구성에는 활성 작업 또는 보류 중인 승인이 있습니다. 계정이 전환되지 않았습니다.")
            threads[sid] = {key: copy.deepcopy(thread.get(key)) for key in ('id', 'cwd', 'model', 'modelProvider')}
        self._receipts()
        return threads

    def inspect(self, *, advisory=False):
        self._receipts()
        result = self._native(native.inspect)
        if result.get('blockers'):
            raise ValueError(result['blockers'][0])
        daemons = result.get('daemons', [])
        if not daemons:
            if not advisory:
                if self.endpoint.server is not None and not self.endpoint.server.closed:
                    raise ValueError('WSL 원래 연결이 계속 실행 중이지만 서비스 소유권을 확인할 수 없습니다.')
                self.record = {'version': 1, 'entry': self.row['id'], 'phase': 'prepared',
                               'daemon': None, 'threads': {}, 'permissions': {}}
            return False
        if len(daemons) != 1:
            raise ValueError("여러 공유 서비스가 이 구성을 사용하므로 전체 상태를 확인할 수 없습니다.")
        daemon = daemons[0]
        self.restartRequired = True
        self.releasable = True
        if advisory:
            return True
        self.native_lock = native.OperationLock(self.row['distribution'], self.row['user'], self.row['home'])
        self.native_lock.acquire()
        verified = self._native(native.inspect)
        if verified.get('blockers') or verified.get('daemons') != daemons:
            raise ValueError("수명 주기 잠금을 획득하는 동안 네이티브 WSL 서비스가 변경되었습니다. 계정이 전환되지 않았습니다.")
        endpoint = self.endpoint
        current = getattr(endpoint, 'daemon_identity', None) or {}
        if (endpoint.server is not None and not endpoint.server.closed and
                all(current.get(key) == daemon.get(key) for key in ('pid', 'socket', 'executable'))):
            self.runtime = endpoint.server
        else:
            stream = wsl.Stream(self.row['distribution'], self.row['user'], self.row['home'], daemon)
            self.runtime = SharedServer(stream).start()
            self.temporary = True
        threads = self._idle()
        subscriptions = [sid for sid, generation in endpoint.subscriptions.items()
                         if generation == endpoint.generation and sid in threads]
        self.record = {'version': 1, 'entry': self.row['id'], 'phase': 'prepared', 'daemon': daemon,
                       'threads': {sid: threads[sid] for sid in subscriptions}, 'permissions': {}}
        for sid in subscriptions:
            # An already-loaded subscription returns effective permissions; no
            # new thread, user input, model request or configuration override.
            resumed = self.runtime.request('thread/resume', {'threadId': sid, 'excludeTurns': True})
            current = resumed.get('thread') or {}
            if any(current.get(key) != threads[sid][key] for key in ('id', 'cwd', 'modelProvider')):
                raise ValueError("원래 WSL 채팅 설정이 변경되었습니다. 계정이 전환되지 않았습니다.")
            model = resumed.get('model') or current.get('model')
            if not isinstance(model, str) or not model:
                raise ValueError('확인할 수 없습니다 WSL 원래 세션의 실제 모델, 계정이 아직 전환되지 않았습니다.')
            if any(resumed.get(key) is not None and resumed[key] != threads[sid][key]
                   for key in ('cwd', 'modelProvider')):
                raise ValueError('WSL 원래 세션 액세스 또는 디렉터리가 변경되었으며 계정이 아직 전환되지 않았습니다.')
            self.record['threads'][sid]['model'] = model
            policy = {key: copy.deepcopy(resumed[key]) for key in
                      ('approvalPolicy', 'approvalsReviewer', 'activePermissionProfile') if key in resumed}
            if 'sandbox' in resumed:
                policy['sandboxPolicy'] = copy.deepcopy(resumed['sandbox'])
            profile = policy.get('activePermissionProfile') or {}
            sandbox = policy.get('sandboxPolicy') or {}
            defaults = {'type', 'writableRoots', 'networkAccess', 'excludeTmpdirEnvVar', 'excludeSlashTmp'}
            if (not profile.get('id') and sandbox and
                    (sandbox.get('type') not in ('readOnly', 'workspaceWrite', 'dangerFullAccess') or
                     any(key not in defaults for key in sandbox) or sandbox.get('writableRoots') or
                     any(sandbox.get(key) not in (None, False) for key in
                         ('networkAccess', 'excludeTmpdirEnvVar', 'excludeSlashTmp')))):
                raise ValueError("원래 WSL 채팅은 복원 가능한 권한 프로필 없이 사용자 정의 샌드박스를 사용합니다. 계정이 전환되지 않았습니다.")
            self.record['permissions'][sid] = policy
        self._idle()
        return True

    def close(self):
        if self.temporary and self.runtime is not None:
            self.runtime.close()

    def __call__(self):
        if not self.record:
            return
        if self.record['daemon']:
            self._idle()
        if self.path.exists():
            previous = json.loads(self.path.read_text(encoding='utf-8'))
            before = previous.get('daemon') or {}
            if (self.record['daemon'] and previous.get('terminationRequested') and
                    all(before.get(key) == self.record['daemon'].get(key) for key in ('pid', 'startTicks', 'bootId'))):
                raise ValueError("원래 서비스 종료가 확인되지 않았습니다. 더 이상 종료 신호가 전송되지 않습니다. 서비스를 확인하고 복구하세요.")
        self.record['beforeIdentity'] = self.identity
        self.record.update(self.intent)
        self.record['terminationRequested'] = bool(self.record['daemon'])
        self.record['draftSnapshot'] = self.endpoint.capture_account_drafts(self.intent['provider'])
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        private_json(self.path, self.record)
        if self.record['daemon']:
            try:
                self._native(native.stop, self.record['daemon'])
            except native.HandoffError as error:
                if error.signal_sent is False:
                    self.record.update(phase='cancelled', terminationRequested=False)
                    private_json(self.path, self.record)
                raise
        self.record['phase'] = 'stopped'
        private_json(self.path, self.record)
        endpoint = self.endpoint
        endpoint.generation = None
        if endpoint.server is not None:
            endpoint.server.close()
        self.close()
        endpoint.server = None
        endpoint.subscriptions.clear()
        endpoint._managed_routes.clear()
        for session in endpoint.live.values():
            with session.condition:
                session.connected = False
                session.changed()

    def after_switch(self, identity):
        if not self.record:
            return []
        self.record.update(phase='applied', appliedIdentity=identity)
        private_json(self.path, self.record)
        return self.restore(identity)

    def restore(self, identity):
        if self.record is None:
            if not self.path.exists():
                raise ValueError("복구 대기 중인 WSL 공유 서비스가 없습니다.")
            self.record = json.loads(self.path.read_text(encoding='utf-8'))
        if self.record.get('version') != 1 or self.record.get('entry') != self.row['id']:
            raise ValueError("WSL 공유 서비스 복구 대상을 확인할 수 없습니다.")
        expected = self.record.get('appliedIdentity') or self.record.get('beforeIdentity')
        if not expected or expected != identity or self.record.get('phase') not in ('prepared', 'stopped', 'applied'):
            raise ValueError("WSL 서비스 복구 기록이 현재 계정과 일치하지 않습니다.")
        self._receipts()
        if self.record['daemon'] is None:
            drafts = self.endpoint.complete_account_drafts(self.record.get('draftSnapshot'), identity)
            self.record['phase'] = 'complete'
            private_json(self.path, self.record)
            return drafts
        self.release_native_lock()
        started = self._native(native.start, self.record['daemon'], self.record.get('terminationRequested', False))
        runtime = self.endpoint.runtime(allow_start=False)
        self.runtime = runtime
        self.temporary = False
        self._idle()
        runtime_identity = started.get('daemon')
        restored = self.record.setdefault('restoredThreads', {})
        for sid, expected in self.record['threads'].items():
            thread = runtime.request('thread/read', {'threadId': sid, 'includeTurns': False})['thread']
            if (thread.get('status') or {}).get('type') != 'notLoaded':
                proof = restored.get(sid) or {}
                if (proof.get('daemon') != runtime_identity or not runtime_identity or
                        (thread.get('status') or {}).get('type') != 'idle' or
                        any(thread.get(key) != expected[key] for key in ('id', 'cwd', 'modelProvider'))):
                    raise ValueError("원래 WSL 채팅이 다른 연결에 의해 로드되었습니다. 복구하기 전에 해당 채팅을 닫으세요.")
                checked = runtime.request('thread/resume', {'threadId': sid, 'excludeTurns': True})
                if (checked.get('model') or (checked.get('thread') or {}).get('model')) != expected['model']:
                    raise ValueError('WSL 원래 대화의 실제 모델이 변경되었습니다. 원래 채팅을 확인하세요.')
                policy = {key: copy.deepcopy(checked[key]) for key in
                          ('approvalPolicy', 'approvalsReviewer', 'activePermissionProfile') if key in checked}
                if 'sandbox' in checked:
                    policy['sandboxPolicy'] = copy.deepcopy(checked['sandbox'])
                if policy != self.record['permissions'][sid]:
                    raise ValueError('WSL 원래 대화 권한이 변경되었습니다. 원래 채팅을 확인하세요.')
                saved_route = proof.get('routeProof')
                if saved_route is not None:
                    self.endpoint._managed_routes[sid] = (self.endpoint.generation, *saved_route[1:])
                self.endpoint._check_account_route(runtime, thread)
                self.endpoint.subscriptions[sid] = self.endpoint.generation
                session = self.endpoint.session(sid, attach=False)
                with session.condition:
                    session.state['currentPermissions'] = policy
                continue
            options = {'threadId': sid, 'excludeTurns': True, 'model': expected['model']}
            policy = self.record['permissions'][sid]
            for key in ('approvalPolicy', 'approvalsReviewer'):
                if key in policy:
                    options[key] = policy[key]
            profile = policy.get('activePermissionProfile') or {}
            sandbox = policy.get('sandboxPolicy') or {}
            if profile.get('id'):
                options['permissions'] = profile['id']
            elif sandbox.get('type') in ('readOnly', 'workspaceWrite', 'dangerFullAccess'):
                options['sandbox'] = {'readOnly': 'read-only', 'workspaceWrite': 'workspace-write',
                                      'dangerFullAccess': 'danger-full-access'}[sandbox['type']]
            resumed = runtime.request('thread/resume', options)
            if (resumed.get('model') or (resumed.get('thread') or {}).get('model')) != expected['model']:
                raise ValueError('WSL 원래 세션의 실제 모델은 아직 확인을 위해 복원되지 않았습니다.')
            actual = {key: copy.deepcopy(resumed[key]) for key in
                      ('approvalPolicy', 'approvalsReviewer', 'activePermissionProfile') if key in resumed}
            if 'sandbox' in resumed:
                actual['sandboxPolicy'] = copy.deepcopy(resumed['sandbox'])
            current = runtime.request('thread/read', {'threadId': sid, 'includeTurns': False})['thread']
            if any(current.get(key) != expected[key] for key in ('id', 'cwd', 'modelProvider')):
                raise ValueError("복원된 WSL 채팅 ID, 디렉터리 또는 모델이 확인되지 않았습니다.")
            if actual != policy:
                raise ValueError("복원된 WSL 채팅 권한이 확인되지 않았습니다.")
            session = self.endpoint.session(sid, attach=False)
            with session.condition:
                session.state['currentPermissions'] = actual
                session.state['latestModel'] = expected['model']
                session.state.update(id=sid, cwd=current['cwd'], modelProvider=current['modelProvider'],
                                     threadRuntimeStatus=copy.deepcopy(current.get('status') or {}))
                session.connected = current.get('canAcceptDirectInput') is True
                session.loading, session.error = False, None
                session.changed()
            self.endpoint.subscriptions[sid] = self.endpoint.generation
            proof = self.endpoint._check_account_route(runtime, thread)
            if proof is not None:
                self.endpoint._managed_routes[sid] = (*proof[:-1], current.get('model'))
            restored[sid] = {'daemon': runtime_identity, 'routeProof': self.endpoint._managed_routes.get(sid)}
            private_json(self.path, self.record)
        drafts = self.endpoint.complete_account_drafts(self.record.get('draftSnapshot'), identity)
        self.record['phase'] = 'complete'
        private_json(self.path, self.record)
        return drafts

    def observe(self, current):
        if self.record is None and self.path.exists():
            self.record = json.loads(self.path.read_text(encoding='utf-8'))
        if not self.record:
            return False
        if (current.get('identity') == self.record.get('plannedIdentity') and
                current.get('activeId') == self.record.get('selectedAccount')):
            self.record.update(phase='applied', appliedIdentity=current['identity'])
            private_json(self.path, self.record)
            return True
        return False

    def release_native_lock(self):
        if self.native_lock is not None:
            lock, self.native_lock = self.native_lock, None
            lock.release()

    @contextmanager
    def scope(self, *, recover=False, advisory=False):
        endpoint = self.endpoint
        with ExitStack() as locks:
            locks.enter_context(endpoint.write_lock)
            with endpoint.lock:
                sessions = list(endpoint.live.values())
            if not advisory:
                for session in sorted(sessions, key=lambda item: item.id):
                    locks.enter_context(session.action_lock)
                locks.enter_context(endpoint.connection_lock)
            try:
                if not recover:
                    self.inspect(advisory=advisory)
                yield self
            finally:
                self.close()
                self.release_native_lock()
