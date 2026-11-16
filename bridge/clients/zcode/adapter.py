"""Bounded, opt-in native-session prototype. No App launch, patch or replacement CLI."""
import json
import base64
import mimetypes
import hashlib
import subprocess
import sys
import time
import uuid
from pathlib import Path

from bridge.clients.errors import BridgeUnavailable, ResumePreflightBlocked
from bridge.features.sessions.identity import same_cwd
from bridge.features.workspace.workspace import MAX_TRANSFER, Workspace
from .attachments import attachments, read_image
from .installation import installation, listener_identity
from .transport import operation_timeout
from .presentation import COMPOSER_CAPABILITIES, composer_presentation


ACCESS = {'build': "변경 전 확인", 'guarded': '자율 모드', 'yolo': '전체 액세스'}
LOOPBACK_PLATFORMS = ('darwin', 'win32')


def project_files(root, paths):
    if not isinstance(paths, list) or len(paths) > 10:
        raise ValueError('메시지당 최대 10 프로젝트 파일')
    workspace, result, total = Workspace(root), [], 0
    if str(workspace.root) != str(root):
        raise ValueError('프로젝트 디렉터리가 변경되었습니다. 다시 로그인하세요.')
    if len(set(paths)) != len(paths):
        raise ValueError('동일한 파일을 반복해서 참조할 수 없습니다.')
    for path in paths:
        # Reuse handle-based no-symlink reads and the existing 20 MiB file boundary.
        item = workspace.read(path, download=True)
        total += item['size']
        if total > MAX_TRANSFER:
            raise ValueError('프로토타입의 총 첨부 파일 수는 다음을 초과할 수 없습니다. 20 MB')
        result.append({'name': item['name'], 'data': item['data'],
                       'mime': mimetypes.guess_type(item['name'])[0] or 'application/octet-stream'})
    return result


def project_snapshot(snapshot, workspace, reply_models=None):
    messages = []
    turns = [{'turnId': row['turnId'], 'sequence': row['rowId'],
              'status': {'running': 'inProgress', 'completedSuccess': 'completed',
                         'completedInterrupted': 'interrupted', 'failed': 'failed'}[row['state']]}
             for row in snapshot['rows']['window'] if row['kind'] == 'turnHeader']
    for row in snapshot['rows']['window']:
        if row.get('visibility') != 'visible' or row['kind'] not in ('userInput', 'assistantText', 'reasoning', 'toolCall'):
            continue
        message = {'id': 'zcode:%s:%s' % (snapshot['sessionId'], row['rowId']),
                   'role': {'userInput': 'user', 'assistantText': 'assistant', 'reasoning': 'reasoning',
                            'toolCall': 'activity'}[row['kind']], 'text': row.get('text', '')}
        if row['kind'] in ('userInput', 'assistantText') and row.get('createdAt') is not None:
            message['timestamp'] = row['createdAt']
        if row['kind'] == 'assistantText':
            if isinstance(row.get('model'), str) and row['model']:
                message['model'] = row['model']
            if reply_models:
                message.update(reply_models.get(row.get('entityId'), {}))
        if row['kind'] == 'toolCall':
            message.update(title=row.get('toolName', "활동"), text='\n'.join(
                value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                for value in (row.get('inputText') or row.get('input'), row.get('output'), row.get('error')) if value))
        if row.get('attachments'):
            message['attachments'] = attachments(snapshot['sessionId'], row['attachments'], row.get('sourceCommandId'))
        if row.get('entityId'):
            target = json.dumps({'rowId': row['rowId'], 'entityId': row['entityId'], 'logEpoch': snapshot['logEpoch']}, separators=(',', ':'))
            if row['kind'] == 'assistantText' and row.get('actions', {}).get('canFork'):
                message['forkMessageId'] = target
            if row['kind'] == 'userInput' and row.get('actions', {}).get('canEdit'):
                message['editMessageId'] = target
        messages.append(message)
    control = snapshot['control']
    active = bool(control.get('activeWorks')) or bool(snapshot['pendingInteractions'])
    routing = snapshot.get('inputRouting', {}).get('mode')
    send_modes = {'send': not active and routing == 'startNow' and not snapshot.get('queue', {}).get('items'),
                  'queue': routing in ('startNow', 'enqueue', 'guide', 'choice') and not snapshot['pendingInteractions'],
                  'steer': bool(control.get('activeWorks')) and routing in ('enqueue', 'guide') and not snapshot['pendingInteractions']}
    error = control.get('lastError') if control.get('phase') == 'error' else None
    if error:
        text = error.get('message') or 'ZCode 네이티브 작업 실행 실패'
        if error.get('code') == '3009' and error.get('attribution', {}).get('reason') == 'rate_limited':
            text = 'ZCode 모델 서비스가 사용 중입니다.（3009）：동시성 한도에 도달했습니다. 나중에 수동으로 보내거나 나중에 보내주세요. ZCode 모델 전환。'
        messages.append({'id': 'zcode:%s:error:%s' % (snapshot['sessionId'], error.get('at', 'current')),
                         'role': 'error', 'text': text})
    requests = []
    for interaction in snapshot['pendingInteractions']:
        payload = interaction['payload']
        item = {'id': interaction['interactionId'], 'tool': payload.get('toolName', "승인 대기 중"),
                'input': payload.get('detail') or payload.get('input') or {}}
        if interaction['kind'] == 'userInput':
            item.update(needsInput=True, input=payload.get('input') or payload.get('request') or payload)
        elif interaction['kind'] == 'permission':
            # Show the native offered choices; never invent an allow vocabulary.
            item['decisions'] = [{'id': option['optionId'], 'label': option['label']}
                                 for option in payload.get('options', []) if option['kind'] in ('allowOnce', 'deny')]
        requests.append(item)
    foreground = [work['foregroundExecutionId'] for work in control.get('activeWorks', []) if work.get('foregroundExecutionId')]
    native_goal = snapshot.get('goal')
    goal = ({'goalId': native_goal['targetId'], 'objective': native_goal['objective'],
             'status': {'verified': 'complete', 'verifying': 'active', 'notSatisfied': 'active',
                        'failed': 'blocked'}.get(native_goal['status'], native_goal['status'])}
            if native_goal else None)
    native_usage = snapshot.get('usage', {}).get('contextWindow')
    usage = ({'usedTokens': native_usage['usedTokens'], 'contextWindow': native_usage['maxTokens'],
              'measurement': 'native', 'model': snapshot.get('config', {}).get('model'),
              **{key: native_usage[key] for key in ('autoCompactThresholdTokens', 'cache') if key in native_usage}}
             if native_usage else None)
    return {'session': {'id': snapshot['sessionId'], 'provider': 'zcode', 'host': 'local',
                        'cwd': workspace, 'title': snapshot.get('meta', {}).get('title', ''),
                        'status': 'active' if active else 'idle', 'backend': 'desktop', 'requests': requests,
                        'turnStatus': 'failed' if error else 'inProgress' if active else 'completed',
                        'model': '/'.join(filter(None, (snapshot.get('config', {}).get('provider'), snapshot.get('config', {}).get('model')))),
                        'modelDisplayName': snapshot.get('config', {}).get('model'), 'effort': snapshot.get('config', {}).get('thought'),
                        'composerCapabilities': dict(COMPOSER_CAPABILITIES),
                        'runtimeKnown': True,
                        'permissionMode': snapshot.get('config', {}).get('mode'),
                        'permissionLabel': ACCESS.get(snapshot.get('config', {}).get('mode')),
                        'collaborationMode': 'plan' if snapshot.get('config', {}).get('planEnabled') or snapshot.get('config', {}).get('mode') == 'plan' else 'default',
                        'goal': goal, 'contextUsage': usage,
                        'contextUsageStatus': 'available' if usage else 'unavailable',
                        'stopTarget': {'executionId': foreground[0]} if len(foreground) == 1 else {},
                        'updatedAt': max((row.get('createdAt', 0) for row in snapshot['rows']['window']), default=0)}, 'messages': messages,
            'requests': snapshot['pendingInteractions'], 'control': control, 'turns': turns,
            'native': {'revision': snapshot['revision'], 'seq': snapshot['seq'], 'logEpoch': snapshot['logEpoch']},
            'history': {'hasMore': snapshot['rows']['totalCount'] > len(snapshot['rows']['window'])},
            'capabilities': {'send': any(send_modes.values()), 'sendModes': send_modes,
                             'stop': bool(control.get('canStop')) and len(foreground) == 1,
                             'attachments': True, 'uploadFiles': True, 'resume': True, 'models': True, 'effort': True,
                             'queue': send_modes['queue'], 'steer': send_modes['steer'], 'skills': True, 'permissions': snapshot.get('config', {}).get('mode') in ACCESS,
                             'tasks': True, 'rename': True, 'fork': True, 'editMessage': True, 'compact': not active and not snapshot.get('queue', {}).get('items') and
                             snapshot.get('availability', {}).get('compact', {}).get('allowed') is True,
                             'plan': True, 'goal': True, 'goalEdit': False, 'create': True}}


def detached_session(row, workspace):
    row = dict(row)
    native_rename = row.pop('nativeRename', False) is True
    return {**row, 'provider': 'zcode', 'host': 'local', 'cwd': workspace, 'backend': 'desktop',
            **composer_presentation(row.get('model'), row.get('effort')),
            'status': 'unknown', 'runtimeKnown': False, 'requests': [], 'connectionState': 'detached',
            'capabilities': {'send': False, 'resume': True, 'plan': False, 'goal': False, 'rename': native_rename}}


class _NoLocalTransport(BridgeUnavailable):
    """A saved prototype has no verified endpoint to reconnect to."""


class ZCodeDesktop:
    """Ordinary installation, with OS management independent of chat transport."""
    unavailable = "ZCode가 설치되었습니다. 실시간 로컬 채팅 연결을 사용할 수 없습니다."

    def __init__(self, directory, config):
        self.directory = Path(directory)
        self.config = dict(config)
        self.home = Path(config.get('dataDirectory', Path.home()/'.zcode/v2'))
        self.window_binding = None

    def _window_app(self):
        path = self.config.get('application')
        if sys.platform == 'darwin' and path:
            app = installation(path)
            if app:
                from bridge.platforms.macos.zcode import supports_window_send
                if supports_window_send():
                    return app['executable']
        return None

    def release_window(self):
        self.window_binding = None

    def record_path(self, sid):
        from bridge.clients.zcode.history import saved_target
        row = saved_target(self.home, sid)
        return str(self.home/'tasks-index.sqlite' if row.get('indexOnly') else self.home.parent/'cli/db/db.sqlite')

    def call(self, action, sid=None, body=None):
        from bridge.clients.zcode.history import saved_sessions, saved_detail
        if action == 'image':
            return read_image(self.home, sid, (body or {}).get('source', {}))
        executable = self._window_app()
        if action == 'list':
            view = saved_sessions(self.home)
            if executable:
                view['sessionAccess'] = True
            return view
        if action in ('detail', 'history'):
            view = saved_detail(self.home, sid, body)
            row = view['session']
            if executable and not row['archived'] and row['title']:
                bound = self.window_binding is not None and self.window_binding[0] == sid
                caps = {**row['capabilities'], 'send': bound, 'resume': not bound, 'attachments': False,
                        'projectReferences': False, 'notifications': False, 'models': False, 'skills': False,
                        'queue': False, 'steer': False}
                row.update(capabilities=caps, readOnly=not bound, connectionState='ready' if bound else 'detached',
                           controlScope='session')
                view.update(readOnly=not bound, capabilities=caps, notice=(
                    "원래 창에 연결되었습니다. 문자를 보낼 수 있습니다." if bound else "이제 역사를 읽을 수 있습니다. 계속하면 컴퓨터에서 이 채팅이 열립니다."))
            return view
        if action not in ('resume', 'send') or not executable:
            raise BridgeUnavailable(self.unavailable)
        if action == 'resume':
            return self._resume_window(executable, sid, body or {})
        return self._send_window(executable, sid, body or {})

    def _resume_window(self, executable, sid, body):
        from bridge.clients.zcode.history import send_boundary
        from bridge.platforms.macos.zcode import operation
        if set(body) != {'id'}:
            raise ResumePreflightBlocked('ZCode 잘못된 세션 액세스 매개변수')
        self.release_window()
        try:
            title, _ = send_boundary(self.home, sid)
            receipt = operation('resume', executable, sid, title)
            pid = receipt.get('pid')
            if receipt.get('status') != 'ready' or type(pid) is not int or pid <= 0:
                raise ValueError("ZCode는 원래 채팅을 확인하지 않았습니다.")
        except (ValueError, OSError) as exc:
            raise ResumePreflightBlocked(str(exc)) from exc
        self.window_binding = (sid, pid)
        return {'id': body['id'], 'status': 'ready'}

    def _send_window(self, executable, sid, body):
        from bridge.clients.zcode.history import send_boundary
        from bridge.platforms.macos.zcode import operation
        if (set(body) - {'id', 'text', 'mode'} or body.get('mode', 'send') != 'send'
                or not isinstance(body.get('text'), str) or not body['text'].strip()):
            raise ResumePreflightBlocked("이 ZCode 창은 일반 텍스트만 허용합니다.")
        binding = self.window_binding
        if not binding or binding[0] != sid:
            raise ResumePreflightBlocked("먼저 이 ZCode 채팅을 계속하세요.")
        title, after = send_boundary(self.home, sid)
        started = int(time.time() * 1000)
        try:
            receipt = operation('send', executable, sid, title, body['text'], expected_pid=binding[1])
        except (ValueError, OSError):
            self.release_window()
            raise
        if receipt.get('status') != 'submitted' or receipt.get('pid') != binding[1]:
            self.release_window()
            raise BridgeUnavailable("배송을 확인하려면 ZCode 채팅을 확인하세요.")
        pending = {'id': body['id'], 'status': 'unknown', 'windowReceiptAfter': after, 'windowReceiptSince': started,
                   'message': "이 메시지는 아직 원래 채팅 기록에 표시되지 않았습니다. 나중에 다시 확인하세요."}
        for delay in (0, .1, .25, .5, 1):
            if delay:
                time.sleep(delay)
            result = self.check_window_receipt(sid, body, pending)
            if result['status'] == 'accepted':
                return result
        return pending

    def check_window_receipt(self, sid, body, pending):
        from bridge.clients.zcode.history import new_user_message
        try:
            mid = new_user_message(self.home, sid, pending['windowReceiptAfter'], pending['windowReceiptSince'], body['text'])
        except (ValueError, OSError):
            return pending
        return {'status': 'accepted', 'id': body['id'], 'nativeMessageId': mid} if mid else pending

    def status(self):
        available = (self.home/'tasks-index.sqlite').is_file()
        session_access = bool(available and self._window_app())
        return {'connected': False, 'historyAvailable': available, 'sessionAccess': session_access,
                'reason': ("네이티브 세션을 계속하려면 채팅을 엽니다." if session_access
                           else "로컬 기록(읽기 전용)" if available else self.unavailable)}

    def inventory_status(self):
        return self.status()

    def account_scope(self):
        """Invalidate shared catalogs on account/provider changes, not UI settings."""
        from bridge.clients.zcode.accounts import read, account_key, SETTINGS
        settings = read(self.home/'setting.json')
        value = [{k: v for k, v in read(self.home/'credentials.json').items() if account_key(k)},
                 read(self.home/'provider_config.json'), {k: settings[k] for k in SETTINGS if k in settings}]
        return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


class ZCodePrototype(ZCodeDesktop):
    def __init__(self, directory, config, transport=None, *, pipe=None):
        super().__init__(directory, config)
        self.pipe = pipe
        self.transport = transport or self._native
        self.port = config.get('debugFallbackPort', config.get('port'))
        self.sid = config.get('sessionId')
        self.workspace = str(Path(config['workspace']).resolve()) if config.get('workspace') else None
        if bool(self.workspace) != bool(self.sid) or self.sid is not None and (
                not isinstance(self.sid, str) or not self.sid.startswith('sess_')):
            raise ValueError('ZCode 원래 세션 또는 작업공간이 잘못되었습니다.')
        if not self.sid and not self.pipe and transport is None and config.get('debugFallbackPort') != 17742:
            raise ValueError('먼저 활성화해 주세요 ZCode 기본 호환 연결')
        self.process = config.get('process')
        self.application_owner = None
        self.application_create = False
        self.application_start = None
        self.debug_sessions = set()
        self.workspaces = {self.sid: self.workspace} if self.sid else {}
        self.bindings = {self.workspace: config['binding']} if config.get('binding') and self.workspace else {}

    @property
    def binding(self):
        return self.bindings.get(self.workspace)

    def _live_process(self):
        if self.pipe is not None:
            owner = self.pipe.owner()
            if owner is None:
                raise _NoLocalTransport('애플리케이션 관리에서 초기화해주세요 ZCode 연결。')
            return owner
        if sys.platform not in LOOPBACK_PLATFORMS:
            raise _NoLocalTransport('이 플랫폼의 ZCode 기본 액세스가 아직 확인되지 않았습니다.')
        application = self.config.get('application')
        app = installation(application) if application else None
        if not app:
            raise _NoLocalTransport("이 ZCode 설치는 이 로컬 라이브 연결을 지원하지 않습니다.")
        try:
            return listener_identity(self.port, app['executable'])
        except (OSError, ValueError, subprocess.TimeoutExpired) as error:
            reason = ("호환 포트를 사용할 수 없습니다. 작업이 완료되면 앱 관리에서 ZCode를 정상적으로 종료하고 게이트웨이가 다시 시작하도록 하세요."
                      if self.config.get('debugFallbackPort') else "호환되는 로컬 ZCode 연결을 찾을 수 없습니다.")
            raise _NoLocalTransport(reason) from error

    def connection_owner(self, executable):
        if self.pipe is not None:
            return self.pipe.owner()
        return self.compatibility_owner(executable)

    def compatibility_owner(self, executable):
        """A free port can be used for launch. Never displace an unknown listener."""
        try:
            return listener_identity(self.port, executable, required=False)
        except (ValueError, OSError, subprocess.TimeoutExpired) as exc:
            raise BridgeUnavailable('이 기기의 호환 포트를 확인할 수 없습니다. 확인하세요. 17742 다른 프로세스가 점유하고 있는지 여부。') from exc

    def release_window(self):
        super().release_window()
        self.application_start = None

    def _confirm_application(self, owner, result):
        if not isinstance(result, dict) or result.get('ready') is not True or self._live_process() != owner:
            raise BridgeUnavailable('ZCode 기존 App 연결이 확인되지 않았습니다.。')
        self._adopt_process(owner)
        self.application_create = result.get('canCreate') is True

    def start_private_application(self, owner):
        # Only the verified gateway-owned original may enter this state. Inventory
        # observations never launch an App, acquire a chat, or send a command.
        self.application_start = {'owner': owner, 'id': str(uuid.uuid4()), 'stage': -1, 'until': time.monotonic() + 180,
                                  'next': 0, 'delay': 2}
        state = self.observe_application_start()
        if state and state['connectionState'] == 'error':
            raise BridgeUnavailable(state['reason'])

    def observe_application_start(self):
        attempt = self.application_start
        if not attempt:
            return None
        def failed(phase, reason):
            if self.application_start is not attempt:
                return None
            self._adopt_process(None)
            self.application_start = {'failure': {'connectionState': phase, 'reason': reason}}
            return self.application_start['failure']
        if 'failure' in attempt:
            return attempt['failure']
        now = time.monotonic()
        if now >= attempt['until']:
            return failed('timeout', "ZCode의 채팅 서비스가 중단되었습니다. 다시 연결해 보세요.")
        waiting = {'connectionState': 'connecting', 'reason': "ZCode가 실행 중입니다. 채팅 서비스에 연결 중입니다."}
        if now < attempt['next']:
            return waiting
        owner = attempt['owner']
        try:
            if self._live_process() != owner:
                raise BridgeUnavailable("ZCode 프로세스가 변경되었습니다. 계속하려면 다시 연결하세요.")
            try:
                result = self.transport({'action': 'application', 'expectedProcess': owner,
                                         'body': {'startupId': attempt['id']},
                                         'expiresAt': int((time.time() + min(12, max(3, attempt['delay']))) * 1000)})
            except (TimeoutError, subprocess.TimeoutExpired):
                result = {'ready': False, 'stage': 'waiting'}
            if self.application_start is not attempt:
                return None
            if result.get('ready') is True:
                self._confirm_application(owner, result)
                self.application_start = None
                return None
            stages = ('waiting', 'window', 'services', 'handshake', 'projects')
            if result.get('ready') is not False or result.get('stage') not in stages:
                raise BridgeUnavailable('ZCode 기존 App 확인되지 않은 세션 서비스。')
            stage = stages.index(result['stage'])
        except (OSError, EOFError, ValueError, AttributeError, subprocess.SubprocessError) as error:
            return failed('error', (str(error).splitlines() or ['ZCode 기본 연결에 실패했습니다. 다시 시도해 주세요.。'])[0])
        self._adopt_process(None)
        now = time.monotonic()
        if stage > attempt['stage']:
            attempt.update(stage=stage, until=now + 180, delay=2)
        attempt.update(next=now + attempt['delay'], delay=min(20, attempt['delay'] * 2))
        return waiting

    def connect_application(self, pid, *, wait=False, deadline=None):
        # Cold startup needs time to mount its native services. Only probe the App,
        # never create/select a workspace or submit a command during this retry.
        bounded_probe = deadline is not None
        deadline = deadline if bounded_probe else time.monotonic() + (10 if wait else 0)
        delay = .25
        while True:
            try:
                owner = self._live_process()
                if owner.get('pid') == pid:
                    request = {'action': 'application', 'expectedProcess': owner}
                    if bounded_probe:
                        left = deadline - time.monotonic()
                        if left <= 0:
                            raise TimeoutError('기존 App 세션 서비스가 아직 준비되지 않았습니다.')
                        request['expiresAt'] = int((time.time() + min(12, left)) * 1000)
                    result = self.transport(request)
                    self._confirm_application(owner, result)
                    return
            except (ValueError, OSError, EOFError, subprocess.TimeoutExpired) as error:
                left = deadline - time.monotonic()
                if left <= 0:
                    raise BridgeUnavailable('ZCode 연결이 준비되지 않았습니다. 다시 시도해 주세요.。' + str(error)) from error
                time.sleep(min(left, delay))
                delay = min(1, delay * 2)
                continue
            raise BridgeUnavailable('ZCode 절차가 변경되었습니다. 다시 확인해 주세요.。')

    def _adopt_process(self, owner):
        if self.process != owner:
            self.application_create = False
            self.debug_sessions.clear()
            self.bindings.clear()
            self.workspaces.clear()
            self.workspace = self.sid = None
        self.application_owner = self.process = owner

    def _native(self, request):
        process = self._live_process()
        if process != request.get('expectedProcess', self.process):
            raise BridgeUnavailable('ZCode App 프로세스가 변경되었습니다. 다시 확인하고 명시적으로 액세스하세요.')
        if self.pipe is not None:
            return self.pipe.call({**request, 'expectedProcess': process})
        request = {**request, 'application': str(self.config['application']), 'port': self.port,
                   'expiresAt': min(int((time.time() + operation_timeout(request['action'])) * 1000),
                                    request.get('expiresAt', float('inf')))}
        request.pop('expectedProcess', None)
        from bridge.clients.zcode.transport import request_native
        try:
            return request_native(request)
        except (OSError, TimeoutError, ValueError, RuntimeError) as error:
            raise BridgeUnavailable(str(error)[:1500]) from None


    def call(self, action, sid=None, body=None):
        if action == 'image':
            return super().call(action, sid, body)
        if not self.pipe and action in ('list', 'detail', 'history', 'resume', 'send') and self._window_app():
            if action == 'resume':
                ready = self._try_window_resume(sid, body)
                if ready is not None:
                    return ready
            elif sid not in self.debug_sessions and (action != 'list' or not self.debug_sessions):
                return super().call(action, sid, body)
        try:
            return self._call_live(action, sid, body)
        except (OSError, ValueError) as error:
            if action not in ('list', 'detail', 'history') or not (self.home/'tasks-index.sqlite').is_file():
                raise
            from .history import _TranscriptUnavailable, resume_workspace
            try:
                view = super().call(action, sid, body)
            except _TranscriptUnavailable:
                if action != 'detail' or self.application_owner is None:
                    raise
                workspace = resume_workspace(self.home, sid)
                target = self.transport({'action': 'target', 'sessionId': sid, 'expectedProcess': self.application_owner})
                if not same_cwd(workspace, target.get('workspace'), sys.platform == 'win32'):
                    raise BridgeUnavailable('기존 App 세션 또는 프로젝트가 변경되었습니다. 목록을 새로고침하세요.')
                row = detached_session({'id': sid, 'title': target.get('title', '')}, workspace)
                view = {'session': row, 'messages': [], 'readOnly': True, 'capabilities': row['capabilities']}
            if not isinstance(error, _NoLocalTransport):
                if action == 'list':
                    view['sessionAccess'] = True
                elif not view['session'].get('archived'):
                    view['capabilities']['resume'] = True
                    view['notice'] = '현재 상영 중 ZCode 역사; 기본 실행 상태에 연결하려면 세션을 계속하려면 클릭하세요.。'
            return view

    def _try_window_resume(self, sid, body):
        try:
            result = super().call('resume', sid, body)
        except ResumePreflightBlocked:
            # Only an explicit operation rejected before dispatch may use the compatible transport.
            return None
        self.debug_sessions.discard(sid)
        return result

    def _resume_debug(self, sid, body):
        if not isinstance(sid, str) or not sid.startswith('sess_') or set(body or {}) != {'id'}:
            raise ResumePreflightBlocked('ZCode 잘못된 세션 액세스 매개변수')
        result, _ = self._resume_transaction(sid, body['id'], progressive=False)
        return result

    def resume_step(self, sid, request_id, continuation=None):
        if not isinstance(sid, str) or not sid.startswith('sess_') or not isinstance(request_id, str):
            raise ResumePreflightBlocked('ZCode 잘못된 세션 액세스 매개변수')
        try:
            uuid.UUID(request_id)
        except ValueError as error:
            raise ResumePreflightBlocked('ZCode 잘못된 세션 액세스 매개변수') from error
        if continuation is None and not self.pipe and self._window_app():
            ready = self._try_window_resume(sid, {'id': request_id})
            if ready is not None:
                return ready, None
        return self._resume_transaction(sid, request_id, progressive=True, continuation=continuation)

    def _resume_transaction(self, sid, request_id, *, progressive, continuation=None):
        try:
            process = self._live_process()
            target = {'sessionId': sid, 'expectedProcess': process}
            if progressive:
                # Each visit observes a native subscription; its lifetime is independent of this RPC.
                target['expiresAt'] = int((time.time() + 8) * 1000)
            if continuation is None:
                expected = self.workspaces.get(sid)
                if self.config.get('debugFallbackPort') or (self.home/'tasks-index.sqlite').is_file():
                    from bridge.clients.zcode.history import resume_workspace
                    expected = resume_workspace(self.home, sid)
                workspace = self.transport({**target, 'action': 'target'})['workspace']
                if not isinstance(workspace, str) or not Path(workspace).is_absolute() or (
                        expected is not None and not same_cwd(expected, workspace, sys.platform == 'win32')):
                    raise ValueError('기존 App 세션 또는 프로젝트가 변경되었습니다. 목록을 새로고침하세요.')
            else:
                adapter, original, session_id, operation, workspace = continuation
                if adapter is not self or (original, session_id, operation) != (process, sid, request_id):
                    raise ValueError('기존 App 세션 또는 연결이 변경되었습니다. 다시 연결하세요.')
            args = {**target, 'action': 'attach', 'workspace': workspace, 'binding': None}
            if progressive:
                args['body'] = {'resumeId': request_id, 'observe': continuation is not None}
            result = self.transport(args)
            if progressive and result.get('status') == 'pending':
                progress = result.get('progress')
                if type(progress) is not int or progress < 0 or result.get('stage') != 'restoring':
                    raise ValueError('ZCode 잘못된 연결 상태')
                return ({'id': request_id, 'status': 'pending', 'stage': 'restoring', 'progress': progress},
                        (self, process, sid, request_id, workspace))
            binding = result['binding']
            if not binding.get('clientId') or not binding.get('connectionId') or not result.get('subscriptionId') or (
                    not binding.get('runtime', {}).get('identity') or binding['runtime'].get('workspaceKey') != workspace):
                raise ValueError('ZCode 원래 세션 연결이 확인되지 않았습니다.')
            if progressive and self._live_process() != process:
                raise ValueError('기존 App 프로세스가 변경되었습니다. 다시 계속하세요.')
        except (OSError, EOFError, ValueError, AttributeError, KeyError, TypeError) as error:
            raise ResumePreflightBlocked(str(error)) from error
        self._adopt_process(process)
        self.debug_sessions.add(sid)
        self.workspace, self.sid = workspace, sid
        self.workspaces[sid], self.bindings[workspace] = workspace, binding
        return {'status': 'ready', 'id': request_id}, None

    def _call_live(self, action, sid=None, body=None):
        if action == 'resume':
            return self._resume_debug(sid, body)
        if action == 'rename':
            body = dict(body or {})
            title = body.get('title')
            if (not isinstance(sid, str) or not sid.startswith('sess_') or
                    not isinstance(title, str) or not 1 <= len(title.strip()) <= 120 or
                    any(ord(char) < 32 or ord(char) == 127 for char in title) or set(body)-{'title', 'id'}):
                raise ResumePreflightBlocked('원래 이름 변경 요청이 잘못되었습니다.')
            body.setdefault('id', str(uuid.uuid4()))
            uuid.UUID(body['id'])
            body['title'] = title.strip()
            try:
                owner = self._live_process()
                if self.application_owner != owner:
                    raise ValueError('ZCode 기존 App 연결이 변경되었습니다. 먼저 다시 연결해 주세요.')
                target = self.transport({'action': 'target', 'sessionId': sid, 'expectedProcess': owner})
                workspace = target['workspace']
                if not isinstance(workspace, str) or not Path(workspace).is_absolute():
                    raise ValueError('원래 세션 작업 디렉터리를 확인할 수 없습니다.')
            except (OSError, ValueError, KeyError, TypeError) as error:
                raise ResumePreflightBlocked(str(error)) from error
            result = self.transport({'action': 'rename', 'sessionId': sid, 'workspace': workspace,
                                     'expectedProcess': owner, 'body': body})
            if result.get('notSent') is True:
                return result
            if result.get('status') != 'confirmed' or result.get('result') != {'id': sid, 'title': body['title']}:
                raise BridgeUnavailable('이름 변경 결과를 확인해야 합니다. 원래 클라이언트를 확인하세요. 중복 제출은 되지 않습니다')
            return {**result, 'id': body['id']}
        if action in ('account', 'quota') and self.application_owner is not None:
            return self.transport({'action': action, 'expectedProcess': self.application_owner,
                                   **({'body': body or {}} if action == 'quota' else {})})
        if action == 'lifecycle' and not self.sid:
            # The original renderer can still hold active leases after a gateway restart.
            return self.transport({'action': action, 'expectedProcess': self._live_process()})
        if not self.sid:
            if action == 'list' and self.application_owner is not None:
                result = self.transport({'action': 'list', 'expectedProcess': self.application_owner})
                return {'sessions': [detached_session(row, row['cwd']) for row in result['sessions']],
                        'sessionAccess': True, 'connected': False, 'readOnly': True, 'capabilities': {'create': self.application_create}}
            if action not in ('projects', 'create') or self.application_owner is None:
                self._live_process()  # Reading saved history never selects a session.
                raise BridgeUnavailable('계속해주세요 ZCode 채팅에서 원래 대화에 연결。')
        if action in ('account', 'lifecycle'):
            return self.transport({'action': action, 'workspace': self.workspace, 'sessionId': self.sid,
                                   'expectedRuntime': (self.binding or {}).get('runtime')})
        if action == 'list':
            result = self.transport({'action': 'list', 'workspace': self.workspace, 'sessionId': self.sid,
                                     'binding': self.binding})
            rows = []
            for item in result['sessions']:
                row = (project_snapshot(item['snapshot'], item['cwd'])['session'] if 'snapshot' in item
                       else detached_session(item, item['cwd']))
                if 'title' in item:
                    row['title'] = item['title']
                row['capabilities'] = {**row.get('capabilities', {}), 'rename': item.get('nativeRename') is True}
                rows.append(row)
            self.workspaces.update({row['id']: row['cwd'] for row in rows})
            return {'sessions': rows, 'connected': True}
        if action == 'projects':
            result = self.transport({'action': action, 'workspace': self.workspace, 'sessionId': self.sid})
            if self.workspace and not any(row['cwd'] == self.workspace for row in result['projects']):
                result['projects'].append({'key': self.workspace, 'cwd': self.workspace,
                                           'name': Path(self.workspace).name, 'surface': 'desktop', 'host': 'local'})
            return {**result, 'browseDirectories': True}
        if action == 'create':
            if not isinstance(body.get('projectKey'), str) or not body['projectKey']:
                raise ValueError('선택해주세요 ZCode 프로젝트')
            uuid.UUID(body.get('id', ''))
            if not isinstance(body.get('firstMessage'), str) or not 1 <= len(body['firstMessage'].strip()) <= 100000:
                raise ValueError("첫 번째 메시지를 입력하세요")
            if not self.binding and not self.application_create:
                raise BridgeUnavailable('먼저 네이티브 프로젝트에 명시적으로 연결해야 합니다.')
            # Managed application connections use the selected project, independent
            # of which conversation was last visited. Legacy leases keep their config.
            plain_workspace = self.binding and body['projectKey'] == self.workspace and not body.get('directoryProject')
            context = ({'expectedProcess': self.application_owner} if self.application_create and not plain_workspace else
                       {'workspace': self.workspace, 'sessionId': self.sid, 'binding': self.binding})
            result = self.transport({'action': action, **context, 'body': body})
            workspace, binding = result.pop('workspace', None), result.pop('binding', None)
            if result.get('status') == 'accepted' and workspace:
                self.workspaces[result['result']['id']] = workspace
                if binding:
                    self.bindings[workspace] = binding
                    if not self.sid:
                        self.sid, self.workspace = result['result']['id'], workspace
                        self.debug_sessions.add(self.sid)
            return result
        if not isinstance(sid, str) or not sid.startswith('sess_'):
            raise ValueError('ZCode 잘못된 세션 ID')
        if action not in ('attach', 'detach', 'resume', 'history', 'detail', 'receipt', 'send', 'stop', 'respond', 'catalog', 'settings', 'access', 'work-mode', 'goal', 'compact', 'tasks', 'stop-task', 'fork', 'edit-message', 'rename'):
            raise ValueError('아직 확인되지 않음 ZCode 작동하다')
        body = dict(body or {})
        if action == 'access':
            if 'mode' not in body:
                detail = self.call('detail', sid)
                if not detail['capabilities'].get('permissions'):
                    raise ValueError('현재 세션에서는 권한 전환이 제공되지 않습니다.')
                return {'mode': detail['session']['permissionMode'],
                        'options': [{'value': mode, 'label': label, 'requiresConfirmation': mode == 'yolo'}
                                    for mode, label in ACCESS.items()]}
            if body.get('mode') not in ACCESS or set(body) - {'id', 'mode', 'confirmed'} or (
                    body['mode'] == 'yolo' and body.get('confirmed') is not True):
                raise ResumePreflightBlocked('이 권한 스위치를 확인해 주세요.')
        if action == 'rename':
            body.setdefault('id', str(uuid.uuid4()))  # Outer RenameCommands owns durable deduplication.
        if sid not in self.workspaces:
            self.workspaces[sid] = self.transport({'action': 'target', 'workspace': self.workspace,
                                                  'sessionId': sid})['workspace']
        workspace = self.workspaces[sid]
        request = {'action': action, 'workspace': workspace, 'sessionId': sid,
                   'anchorSessionId': self.sid,
                   'binding': None if action == 'attach' else self.bindings.get(workspace)}
        if action in ('send', 'stop', 'respond', 'settings', 'access', 'work-mode', 'goal', 'compact', 'stop-task', 'fork', 'edit-message', 'rename'):
            uuid.UUID(body.get('id', ''))
            if not request['binding']:
                raise BridgeUnavailable('먼저 기본 테스트 세션에 명시적으로 연결해야 합니다.')
        if action == 'send':
            if not isinstance(body.get('text'), str) or not 1 <= len(body['text'].strip()) <= 100000:
                raise ValueError("1~100000자의 메시지를 입력하세요.")
            if set(body) - {'id', 'text', 'mode', 'projectFiles', 'resolvedReferences', 'resolvedImages', 'resolvedFiles', 'plugins'}:
                raise ValueError('프로토타입은 텍스트와 현재 프로젝트 파일만 허용합니다.')
            skills = body.get('plugins', [])
            if not isinstance(skills, list) or len(skills) > 8 or any(not isinstance(v, str) for v in skills) or len(set(skills)) != len(skills):
                raise ValueError('대부분의 선택 8 유효한 Skill')
            if body.get('mode', 'send') not in ('send', 'queue', 'steer'):
                raise ValueError('잘못된 전송 방법')
            body['files'] = project_files(workspace, body.pop('projectFiles', []))
            references = body.pop('resolvedReferences', [])
            paths = [str(Path(item['path']).relative_to(workspace)) for item in references]
            body['files'].extend(project_files(workspace, paths))
            for item in body.pop('resolvedImages', []):
                header, data = item['url'].split(',', 1)
                body['files'].append({'name': item['name'], 'mime': header[5:].split(';')[0], 'data': data})
            for item in body.pop('resolvedFiles', []):
                path = Path(item['path'])
                file = Workspace(path.parent).read(path.name, download=True)
                body['files'].append({'name': item['name'], 'mime': mimetypes.guess_type(item['name'])[0] or
                                     'application/octet-stream', 'data': file['data']})
            if len(body['files']) > 10 or sum(len(base64.b64decode(f['data'], validate=True)) for f in body['files']) > MAX_TRANSFER:
                raise ValueError('최대 10 첨부 파일의 총 개수는 다음을 초과할 수 없습니다. 20 MB')
        if action in ('fork', 'edit-message'):
            try:
                target = json.loads(body['messageId'])
            except (KeyError, TypeError, ValueError):
                raise ValueError('잘못된 메시지 ID') from None
            if not isinstance(target, dict) or set(target) != {'rowId', 'entityId', 'logEpoch'}:
                raise ValueError('잘못된 메시지 ID')
            body['target'] = target
        if action == 'respond' and 'requestId' in body:
            body['interactionId'] = body.pop('requestId')
            decision = body.pop('decision')
            if decision == 'accept':
                answers = {key: ', '.join(value['answers']) for key, value in body.pop('answers', {}).items()}
                body['answer'] = {'action': 'accept', 'content': {'answers': answers}}
            else:
                body['answer'] = {'optionId': decision}
        if action == 'receipt':
            request['commandId'] = str(uuid.UUID(body['commandId']))
        if action == 'settings' and (set(body) - {'id', 'model', 'effort', 'modelCatalogIdentity', 'manualModel', 'manualEffort'} or
                                    not isinstance(body.get('model'), str) or not isinstance(body.get('effort', ''), str)):
            raise ValueError('잘못된 모델 설정 형식')
        request['body'] = body
        detached = action == 'detail' and not request['binding']
        if detached:
            request['action'] = 'history'
        result = self.transport(request)
        if action == 'detail':
            if detached:
                result = {'detached': True, 'history': result}
            if result.get('detached'):
                history = result['history']
                row = history['session']
                messages = []
                for item in history['messages']:
                    info = item['info']
                    if info.get('semantics', {}).get('uiVisibility') != 'visible':
                        continue
                    message = {'id': info['messageId'], 'role': info['role'],
                               'text': '\n'.join(part.get('text', '') for part in item.get('parts', []) if part.get('type') == 'text')}
                    if info['role'] == 'user':
                        metadata = info.get('metadata') or {}
                        intent = metadata.get('conversationInputIntent') or metadata.get('inputIntent') or {}
                        files = attachments(sid, intent.get('attachments') or intent.get('attachmentRefs'), intent.get('sourceCommandId'))
                        if files:
                            message['attachments'] = files
                    messages.append(message)
                from .reply_metadata import native_reply_models
                models = native_reply_models(self.home, sid, workspace, (m['id'] for m in messages if m['role'] == 'assistant'))
                for message in messages:
                    message.update(models.get(message['id'], {}))
                session = detached_session({'id': row['sessionId'], 'title': row.get('title', '')}, workspace)
                return {'session': session, 'messages': messages, 'capabilities': session['capabilities'],
                        'notice': '현재 상영 중 ZCode 역사; 기본 실행 상태에 연결하려면 세션을 계속하려면 클릭하세요.。'}
            from .reply_metadata import native_reply_models
            snapshot = result['snapshot']
            models = native_reply_models(self.home, sid, workspace, (row.get('entityId') for row in
                snapshot['rows']['window'] if row['kind'] == 'assistantText' and row.get('visibility') == 'visible'))
            value = project_snapshot(snapshot, workspace, models)
            value['capabilities'].update(result.get('capabilities', {}))
            if sid in self.debug_sessions:
                # The client inventory may still describe the previous connection.
                value['session'].update(controlScope='session', connectionState='ready')
            value['draftAccountIdentity'] = result.get('account', {}).get('identity', '')
            if value['history']['hasMore']:
                value['notice'] = '현재 상영 중 ZCode 로드된 기록; 이전 내용은 원본 페이지를 참조하세요. App 로드 중。'
                value['history']['hasMore'] = False
            return value
        if action in ('send', 'stop', 'respond', 'settings', 'access', 'work-mode', 'goal', 'compact', 'stop-task', 'fork', 'edit-message', 'rename'):
            status = result['status']
            if action == 'send' and status == 'accepted' and result.get('result', {}).get('delivery') == 'queue':
                status = 'queued'
            if action in ('settings', 'access', 'work-mode') and status == 'noop' and result.get('reasonCode') == 'config.unchanged':
                status = 'accepted'
            extra = {}
            if action in ('fork', 'edit-message') and status == 'accepted':
                native = result.get('result', {})
                if not native.get('sessionId') or native.get('disposition') == 'blocked':
                    status = 'rejected'
                else:
                    self.workspaces[native['sessionId']] = workspace
                    extra['result'] = {'id': native['sessionId']}
            return {'id': body['id'], 'status': status, 'nativeAck': result, **extra}
        return result

    def reconnect_existing(self):
        try:
            self.call('resume', self.sid, {'id': str(uuid.uuid4())})
            return True
        except (OSError, ValueError):
            return False

    def inventory_status(self):
        # The app inventory does not need a full conversation. Model lookup and
        # operation-specific callers retain their live session status check.
        if self.application_create or not self.sid:
            return self._application_status()
        return self.status()

    def _application_status(self):
        base = super().status()
        if self.application_owner is not None:
            try:
                if self._live_process() == self.application_owner:
                    return {**base, 'sessionAccess': True, 'canCreate': self.application_create,
                            'reason': "네이티브 세션을 계속하려면 채팅을 엽니다."}
            except _NoLocalTransport as error:
                return {**base, 'reason': str(error)}
        return base

    def status(self):
        if not self.sid:
            return self._application_status()
        if not self.pipe and self._window_app() and not self.debug_sessions:
            return super().status()
        try:
            detail = self._call_live('detail', self.sid)
            if detail.get('native'):
                return {'connected': True, 'canCreate': detail['capabilities'].get('create') is True}
        except _NoLocalTransport as error:
            return {**super().status(), 'reason': str(error)}
        except (ValueError, OSError):
            pass
        # A compatible live endpoint can renew a retired session binding.
        return {**super().status(), 'retryable': True}
