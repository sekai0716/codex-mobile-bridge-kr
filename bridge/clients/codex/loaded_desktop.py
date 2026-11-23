"""One explicit subscription to an already loaded chat on the original Desktop."""
import json
import uuid
from pathlib import Path

from bridge.clients.codex import desktop_runtime
from bridge.clients.codex.app_server import AppServerUnavailable, AppServerUnsupported
from bridge.clients.codex.cli_session import CliSessions, _local_cli
from bridge.clients.codex.desktop_subscriptions import DesktopSubscriptions
from bridge.features.accounts.subscription import claims
from bridge.features.sessions.store import StoreUnavailable


class LoadedDesktopSessions(CliSessions):
    def __init__(self, home, on_state, on_disconnect, *, cli):
        super().__init__(home, on_state, on_disconnect, cli=cli)
        self.target = None
        self.current_account = None
        client = desktop_runtime.connect(home, _local_cli(home, cli))
        if client is None:
            raise AppServerUnavailable('원래 데스크톱의 공유 연결이 준비되지 않았습니다.')
        self.client = client
        with client.lock:
            if client.process is None:
                raise AppServerUnavailable('원래 데스크톱 연결이 끊어졌습니다.')
            client.pinned_process = client.process
            client.on_event = self._event
            client.on_server_request = self._server_request
            client.on_disconnect = self._disconnect
        self.subscriptions = DesktopSubscriptions(client.socket_path)

    def _loaded_identity(self, thread_id, cwd, provider):
        self.client.verify_desktop_owner()
        process = self.client.pinned_process
        if process is None or process is not self.client.process:
            raise AppServerUnavailable('원래 데스크톱 연결이 끊어졌습니다.')
        try:
            saved = self.store.get(thread_id)
        except (KeyError, StoreUnavailable) as exc:
            raise AppServerUnavailable('데스크톱 채팅 기록을 확인할 수 없습니다.') from exc
        if (saved.get('id') != thread_id or saved.get('origin') != 'desktop' or saved.get('archived') != 0
                or saved.get('attached_thread_parent_id') or saved.get('thread_source') == 'subagent'
                or saved.get('cwd') != cwd or saved.get('model_provider') != provider):
            raise AppServerUnsupported('원래 데스크톱 채팅의 소유 정보가 변경되었습니다.')
        self._check_current_account(process)
        before = self.client.request('thread/read', {'threadId': thread_id, 'includeTurns': False},
                                     replay_safe=True, expected_process=process)['thread']
        if (before.get('id') != thread_id or before.get('cwd') != cwd or before.get('modelProvider') != provider
                or before.get('source') != 'vscode' or before.get('ephemeral') is not False
                or before.get('attachedToThreadId') or before.get('parentThreadId')
                or before.get('canAcceptDirectInput') is not True
                or (before.get('status') or {}).get('type') not in ('active', 'idle')
                or not self.client.is_loaded(thread_id)):
            raise AppServerUnavailable('원래 데스크톱에서 열려 있는 채팅을 확인할 수 없습니다.')
        return before

    def _check_current_account(self, process):
        native = self.client.request('account/read', {'refreshToken': False}, replay_safe=True, expected_process=process)
        routing = native.get('workspaceRouting') or {}
        identity = (routing.get('chatgptAccountId'), native.get('userId'))
        try:
            auth = json.loads((self.home / 'auth.json').read_text(encoding='utf-8'))
            tokens = auth.get('tokens') or {}
            account = claims(tokens.get('id_token') or '').get('https://api.openai.com/auth') or {}
            matches = (auth.get('auth_mode') != 'apikey' and tokens.get('account_id') == identity[0]
                       and (account.get('chatgpt_account_id'), account.get('chatgpt_user_id')) == identity)
        except (OSError, ValueError, TypeError, AttributeError):
            matches = False
        if (not matches or not all(identity) or native.get('requiresOpenaiAuth') is not True
                or (native.get('account') or {}).get('type') != 'chatgpt'
                or routing.get('backendOrigin') != 'https://chatgpt.com'
                or self.current_account is not None and self.current_account != identity):
            raise AppServerUnsupported('The Codex desktop is connected to a different account or workspace. '
                                       'Select the same account in Bridge and the desktop app.')
        self.current_account = identity

    def attach_loaded_desktop(self, thread_id, *, cwd, provider):
        if str(uuid.UUID(thread_id)) != thread_id or not Path(cwd).is_absolute() or provider != 'openai':
            raise AppServerUnsupported('데스크톱 채팅의 원래 작업 폴더와 계정이 필요합니다.')
        with self.lock:
            if self.target is not None:
                raise AppServerUnsupported('이 연결은 이미 데스크톱 채팅에 사용되었습니다.')
            self.target = (thread_id, cwd, provider)
        # No native RPC can recreate a cold writer between the loaded check and
        # resume: the original Desktop cannot send its unsubscribe while retained.
        before = {'id': thread_id, 'cwd': cwd, 'modelProvider': provider}
        return self._resume_checked(thread_id, before, {'threadId': thread_id, 'excludeTurns': True}, provider,
                                    process=self.client.pinned_process,
                                    before_resume=lambda: self._loaded_identity(thread_id, cwd, provider),
                                    desktop_lease=self.subscriptions.retain(thread_id))

    def _check_joined_identity(self, thread_id):
        self._require_joined(thread_id)
        if self.target is None or self.target[0] != thread_id:
            raise AppServerUnsupported('원래 데스크톱 채팅이 변경되었습니다.')
        with self.subscriptions.retain(thread_id):
            self._loaded_identity(*self.target)

    def call(self, thread_id, desktop_method, params, timeout=30, *, reviewed_request=None):
        with self.subscriptions.retain(thread_id):
            return super().call(thread_id, desktop_method, params, timeout, reviewed_request=reviewed_request)

    def release_connection(self, identifier, token, stop=False):
        if stop:
            raise AppServerUnsupported('데스크톱의 원래 작업은 이 연결에서 종료할 수 없습니다.')
        from bridge.clients.codex.release import unsubscribe_thread
        with self.lock:
            if self.metadata.get(identifier, {}).get('connectionToken') != token:
                raise AppServerUnavailable('원래 데스크톱 채팅 연결이 변경되었습니다.')
            process = self.joined.get(identifier)
        if process is None or process is not self.client.pinned_process:
            raise AppServerUnavailable('원래 데스크톱 채팅 연결이 끊어졌습니다.')
        result = unsubscribe_thread(lambda method, params: self.client.request(method, params, expected_process=process),
                                    identifier)
        self._invalidate(identifier, process)
        return result

    def _connect_explicit(self, *, allow_start=False):
        raise AppServerUnsupported('데스크톱 채팅의 기존 공유 연결만 사용할 수 있습니다.')
