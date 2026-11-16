"""Native goal and terminal features of the original WSL CLI environment."""
import copy
import time
import uuid

from bridge.app.lifecycle import private_json
from bridge.clients.codex.ipc import IPCError
from bridge.features.sessions.goal import (
    goal_activation, goal_identity, normalize_goal_result, plan_goal_command,
)


class WslFeatures:
    def _init_features(self):
        from bridge.features.endpoints.wsl_terminal import WslTerminals
        self.wsl_terminals = WslTerminals()
        self.native_goals = {}
        self.notification_dirty = set()
        self.notification_cursor = 0
        self.notification_boundary = set()

    def _close_features(self):
        self.wsl_terminals.close()

    def terminal(self, identifier, owner, action, params):
        with self.write_lock:
            self._require_open()
            return self.wsl_terminals.terminal(self, identifier, owner, action, params)

    def _read_goal(self, identifier, runtime):
        try:
            goal = normalize_goal_result(runtime.request('thread/goal/get', {'threadId': identifier}))
        except IPCError as exc:
            if getattr(exc, 'rpc_error', {}).get('code') == -32601:
                self.native_goals[identifier] = {'supported': False, 'generation': self.generation}
            raise
        previous = self.native_goals.get(identifier)
        self.native_goals[identifier] = {'supported': True, 'value': goal,
                                        'at': time.monotonic(), 'generation': self.generation}
        session = self.live.get(identifier)
        if session and (not previous or previous.get('value') != goal or previous.get('generation') != self.generation):
            with session.condition:
                session.changed()
        return goal

    def _refresh_features(self, session):
        if not session.connected or self.server is None or self.server.closed:
            return
        cached = self.native_goals.get(session.id, {})
        if cached.get('generation') == self.generation and (
                cached.get('supported') is False or time.monotonic() - cached.get('at', 0) < 2):
            return
        try:
            self._read_goal(session.id, self.server)
        except IPCError:
            return

    def _view_features(self, session, result):
        cached = self.native_goals.get(session.id, {})
        available = bool(session.connected and cached.get('generation') == self.generation
                         and cached.get('supported') is True)
        result['capabilities'] = {**result['capabilities'], 'goal': available, 'terminal': True}
        result['goalRuntimeAvailable'] = available
        result['access']['canUseGoal'] = available
        if available:
            result['goal'] = copy.deepcopy(cached.get('value'))
        return result

    def _goal_control(self, identifier, request_id, action, *, objective=None, expected=None, ui_locale=None):
        uuid.UUID(identifier); uuid.UUID(request_id)
        if expected is not None and not isinstance(expected, dict):
            raise ValueError('대상 상태가 잘못되었습니다.')
        if objective is not None and (not isinstance(objective, str) or not 0 < len(objective.strip()) <= 4000):
            raise ValueError("목표를 1~4,000자로 입력하세요.")
        value = {'action': action, 'objective': objective, 'expected': expected}
        key = identifier + ':goal:' + request_id
        with self.write_lock, self.session(identifier, attach=False).action_lock:
            self._require_open()
            previous = self._previous_send(identifier, key, value)
            if previous is not None:
                return previous
            runtime, thread = self._target(identifier)
            current = self._read_goal(identifier, runtime)
            if expected is not None and (goal_identity(current) != goal_identity(expected)
                    or (current or {}).get('status') != expected.get('status')):
                raise ValueError("목표가 변경되었습니다. 새로고침하고 다시 시도하세요.")
            text = objective.strip() if objective is not None else (current or {}).get('objective', '')
            decision, error, status = plan_goal_command(action, text, current)
            if decision == 'invalid':
                raise ValueError(error)
            if action == 'create' and thread.get('status', {}).get('type') == 'active':
                raise ValueError('작업이 실행 중입니다. 목표를 설정하기 전에 완료될 때까지 기다리십시오.')

            def dispatch():
                if decision == 'execute':
                    params = {'threadId': identifier, 'origin': 'user'}
                    if action != 'cancel':
                        params['status'] = status
                        if action in ('create', 'edit'):
                            params['objective'] = text
                        if action == 'edit' and current.get('tokenBudget') is not None:
                            params['tokenBudget'] = current['tokenBudget']
                    runtime.request('thread/goal/clear' if action == 'cancel' else 'thread/goal/set', params)
                fresh = self._read_goal(identifier, runtime)
                proved = fresh is None if action == 'cancel' else bool(
                    fresh and fresh.get('objective') == text and fresh.get('status') == status)
                if not proved:
                    raise IPCError('아직 목표 작전 결과는 확인되지 않았다')
                return {'status': status, 'confirmed': True, 'result': fresh,
                        'duplicate': decision == 'duplicate', 'transitionId': request_id}

            response = self._mutation(identifier, key, value, dispatch)
            if response.get('confirmed') and action in ('pause', 'cancel', 'edit'):
                # Stop only queued activation messages belonging to this goal.
                for receipt_key, receipt in list(self.receipts.items()):
                    if receipt_key.startswith(identifier + ':goal:'):
                        goal_result = receipt.get('result') or {}
                        if (goal_result.get('result') or {}).get('objective') == (current or {}).get('objective'):
                            for transition in ('create', 'resume'):
                                activation_id, _ = goal_activation(identifier, current, transition,
                                    transition_id=receipt_key.rsplit(':', 1)[-1])
                                queued = self.receipts.get(identifier + ':send:' + activation_id, {})
                                if queued.get('result', {}).get('status') == 'queued':
                                    self.cancel_queued(identifier, activation_id)
            if response.get('confirmed') and action in ('create', 'resume'):
                activation_id, text = goal_activation(identifier, response['result'], action,
                    ui_locale=ui_locale, transition_id=request_id)
                # Each stage has its own durable receipt: a lost activation reply
                # can never cause a second goal write or automatic turn replay.
                response = {**response, 'activation': {'status': 'unknown', 'id': activation_id}}
                self.receipts[key]['result'] = response
                private_json(self.receipts_path, self.receipts)
                activation = self._send(identifier, text, activation_id,
                    mode='queue' if thread.get('status', {}).get('type') == 'active' else 'send',
                    goal_activation=goal_identity(response['result']))
                response = {**response, 'activation': activation}
                self.receipts[key]['result'] = response
                private_json(self.receipts_path, self.receipts)
            return response

    def send_goal(self, identifier, text, submission_id, *, mode='send', skills=None, attachments=None, ui_locale=None):
        if mode != 'send' or skills or attachments:
            raise ValueError('대상 모드는 직접 전송된 일반 텍스트 대상만 허용합니다.')
        result = self._goal_control(identifier, submission_id, 'create', objective=text, ui_locale=ui_locale)
        return {**result, 'id': submission_id,
                'status': 'accepted' if result.get('confirmed') and
                result.get('activation', {}).get('status') in ('accepted', 'queued') else 'unknown'}

    def cancel_goal(self, identifier, request_id, expected=None):
        return self._goal_control(identifier, request_id, 'cancel', expected=expected)

    def edit_goal(self, identifier, objective, request_id, expected=None):
        return self._goal_control(identifier, request_id, 'edit', objective=objective, expected=expected)

    def set_goal_status(self, identifier, status, request_id, ui_locale=None, expected=None):
        if status not in ('active', 'paused'):
            raise ValueError('대상 상태가 잘못되었습니다.')
        return self._goal_control(identifier, request_id, 'resume' if status == 'active' else 'pause',
                                  expected=expected, ui_locale=ui_locale)

    def notification_candidates(self):
        self._require_open()
        changes = self.store.notification_changes(self.notification_cursor)
        cursor = max([self.notification_cursor] + [row['changed_at'] for row in changes])
        rows = [{'id': row['id'], 'host': self.host} for row in changes
                if row['changed_at'] > self.notification_cursor or row['id'] not in self.notification_boundary]
        self.notification_boundary = {row['id'] for row in changes if row['changed_at'] == cursor}
        self.notification_cursor = cursor
        return rows

    def notification_updates(self):
        with self.lock:
            dirty, self.notification_dirty = self.notification_dirty, set()
        return [{'id': identifier, 'host': self.host} for identifier in dirty]

    def notification_session(self, identifier):
        session = self.session(identifier, attach=False)
        if not session.watched:
            session.notification_probe_until = time.monotonic() + 10
        session.watched = True
        # A notification may follow an already loaded native thread, never resume
        # unloaded history or start a distro/daemon. _target defaults to passive.
        try:
            with session.action_lock:
                runtime, thread = self._target(identifier)
                self._subscribe(identifier, runtime, thread)
            self.session(identifier, background=True)
        except IPCError:
            with session.condition:
                session.connected = False
        return session

    def release_notification_session(self, session):
        session.watched = False
        return True
