"""Create or fork a persisted thread, then hand execution to the desktop App.

The short-lived app-server never receives turn/start. It is shut down before
returning, so the desktop can become the sole execution owner.
"""
import json
import os
import queue
import subprocess
import sys
import threading
import time
import tempfile
import uuid
from pathlib import Path
from urllib.parse import urlencode


class CreationError(RuntimeError):
    pass


class CreationUnavailable(CreationError):
    """No thread mutation could have happened."""


class SideChatConnectionUnavailable(CreationUnavailable):
    """A native fork could not be submitted to the desktop's shared runtime."""

    def __init__(self, *, manual):
        self.code = 'side_chat_setup_required' if manual else 'side_chat_setup_waiting'
        super().__init__(
            'No side chat was created. Bridge needs a shared connection to the running Codex desktop. '
            'A desktop started with standard input/output cannot share that connection. '
            'After all desktop tasks finish, open connection setup in Accounts.'
            if manual else
            'No side chat was created. The shared Codex desktop connection is not ready. '
            'Check the preparation status in Accounts before trying again.')


class SideChatReceiptUnknown(CreationError):
    code = 'side_chat_creation_unknown'
    message = 'The side chat creation result is unknown. Refresh the side chat list to check.'


class ForkUnavailable(CreationUnavailable):
    """The capability check failed before any thread could be created."""


class DeleteRejected(CreationError):
    """The native server explicitly rejected this delete, before mutation."""


def native_delete_error(error, thread_id):
    """Only known pre-mutation rejections are safe to submit again explicitly."""
    if error.get('code') == -32601:
        return DeleteRejected('현재 네이티브 런타임은 영구 삭제를 지원하지 않습니다. 원래 클라이언트에서 작업하세요.')
    if (error.get('code') == -32600 and
            error.get('message') == f'thread {thread_id} already has an active writer'):
        return DeleteRejected("원래 클라이언트는 여전히 이 채팅을 보유하고 있습니다. 아무것도 삭제되지 않았습니다. 거기에서 삭제하시거나, 채팅을 해제하고 다시 확인해 주세요.")
    return CreationError(error.get('message', '기본 삭제 결과를 확인해야 합니다.'))


def runtime_environment(codex_home, *, isolated_home=False):
    # Only a separately registered home has an enforced database boundary.
    env = dict(os.environ, CODEX_HOME=str(codex_home))
    if isolated_home:
        env.pop('CODEX_SQLITE_HOME', None)
    return env


def _runtime_operation(executable, codex_home, cwd, operation, *, failure_message=None, isolated_home=False):
    if not executable:
        raise CreationUnavailable('찾을 수 없음 Codex 실행 시 컴퓨터 런처의 실행 구성에서 경로를 지정해 주세요.')
    if not Path(cwd).is_dir():
        raise CreationUnavailable('프로젝트 디렉터리가 존재하지 않습니다. 먼저 확인하세요. App 검사항목')
    env = runtime_environment(codex_home, isolated_home=isolated_home)
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    try:
        process = subprocess.Popen([str(executable), 'app-server', '--listen', 'stdio://'],
                                   cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, text=True, encoding='utf-8', **kwargs)
    except OSError as exc:
        raise CreationUnavailable('시작할 수 없습니다 Codex 실행시 실행중인 구성에서 프로그램 경로, 프로젝트 디렉터리, 접근권한을 확인하신 후 다시 시도해주세요.') from exc
    messages = queue.Queue()

    def read():
        try:
            for line in process.stdout:
                try:
                    messages.put(json.loads(line))
                except ValueError:
                    continue
        finally:
            messages.put(None)

    reader = threading.Thread(target=read, daemon=True)
    reader.start()
    counter = 0

    def request(method, params):
        nonlocal counter
        counter += 1
        process.stdin.write(json.dumps({'id': counter, 'method': method, 'params': params}) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + 25
        while True:
            try:
                result = messages.get(timeout=max(.01, deadline - time.monotonic()))
            except queue.Empty as exc:
                raise CreationError(failure_message or '채팅 생성 시간이 초과되었습니다. 먼저 데스크톱 채팅 목록을 확인하신 후 다시 생성하지 마세요.') from exc
            if result is None:
                raise CreationError(failure_message or '채팅 생성 런타임이 중단되었습니다. 먼저 데스크톱 채팅 목록을 확인하세요.')
            if result.get('id') != counter:
                if time.monotonic() >= deadline:
                    raise CreationError(failure_message or '채팅 생성 시간이 초과되었습니다. 먼저 데스크톱 채팅 목록을 확인하세요.')
                continue
            if 'error' in result:
                if method in ('thread/archive', 'thread/unarchive'):
                    raise ArchiveRejected(result['error'])
                if method == 'thread/delete':
                    raise native_delete_error(result['error'], params['threadId'])
                raise CreationError(result['error'].get('message', failure_message or '채팅을 생성하지 못했습니다.'))
            return result['result']

    try:
        request('initialize', {'clientInfo': {'name': 'codex_mobile_bridge', 'version': '0.2'},
                               'capabilities': {'experimentalApi': True}})
        process.stdin.write('{"method":"initialized"}\n')
        process.stdin.flush()
        result = operation(request)
    finally:
        # EOF flushes pending writes and releases the thread before App takeover.
        process.stdin.close()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            raise CreationError(failure_message or '생성 런타임이 정상적으로 종료되지 않았습니다. 먼저 데스크톱 채팅 목록을 확인해주세요.')
        finally:
            reader.join(timeout=1)
            process.stdout.close()
    if process.returncode:
        raise CreationError(failure_message or '런타임 종료 예외를 생성하십시오. 먼저 데스크톱 채팅 목록을 확인하십시오.')
    return result


def independent_directory(data_dir, request_id):
    """A durable per-chat workspace, without registering a desktop project."""
    uuid.UUID(request_id)
    root = Path(data_dir) / 'independent-chats'
    target = root / request_id
    try:
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if root.is_symlink(): raise CreationUnavailable('독립형 채팅 디렉터리를 사용할 수 없습니다.')
        target.mkdir(mode=0o700, exist_ok=True)
        if target.is_symlink() or not target.is_dir(): raise CreationUnavailable('독립형 채팅 디렉터리를 사용할 수 없습니다.')
        return str(target.resolve())
    except OSError as exc:
        raise CreationUnavailable('독립형 채팅 디렉터리를 사용할 수 없습니다.') from exc


def project_directory(value, create=False, expected=None):
    """Explicit project selection only; return the canonical directory identity."""
    if not isinstance(value, str) or not value.strip() or len(value) > 4096 or any(ord(c) < 32 for c in value):
        raise ValueError('전체 프로젝트 디렉터리를 입력하세요.')
    if type(create) is not bool:
        raise ValueError('디렉터리 생성 옵션이 잘못되었습니다.')
    value = value.strip()
    # UNC/device paths can initiate remote authentication on Windows. Projects
    # on SSH/WSL must be resolved on that registered host instead.
    if os.name == 'nt' and (value.startswith(('\\\\', '//')) or ':' in value[2:]):
        raise ValueError('이 컴퓨터의 로컬 절대 경로를 사용하십시오.')
    path = Path(value).expanduser()
    if not path.is_absolute() or '..' in path.parts:
        raise ValueError('절대 경로를 사용하거나 ~/ 제외하고 처음에 디렉토리 ..')
    try:
        if create and not path.exists():
            parent = path.parent.resolve(strict=True)
            if not parent.is_dir(): raise ValueError('상위 디렉터리가 존재하지 않습니다.')
            # Deliberately create only the requested final directory, never a
            # guessed hierarchy, and never overwrite existing contents.
            try: (parent/path.name).mkdir(mode=0o700)
            except FileExistsError: pass
        canonical = path.resolve(strict=True)
        if not canonical.is_dir(): raise ValueError('선택한 경로는 디렉터리가 아닙니다.')
        if not os.access(canonical, os.R_OK | os.W_OK | os.X_OK):
            raise ValueError('프로젝트 디렉터리를 읽거나 쓸 수 없습니다.')
        st = canonical.stat()
        identity = {'cwd': str(canonical), 'device': st.st_dev, 'inode': st.st_ino}
        if expected is not None and identity != expected:
            raise ValueError('프로젝트 디렉터리가 변경되었습니다. 디렉터리를 다시 선택하세요.')
        return identity
    except OSError as exc:
        raise ValueError('프로젝트 디렉터리가 존재하지 않거나 액세스할 수 없습니다. 새 디렉토리를 생성하고 상위 디렉토리가 존재하는지 확인하십시오.') from exc


def project_trust(executable, codex_home, identity, confirmed=False):
    """Trust only an explicitly selected, unchanged directory via native config RPC."""
    if type(confirmed) is not bool:
        raise ValueError('디렉터리 신뢰 확인이 잘못되었습니다.')
    cwd = project_directory(identity['cwd'], expected=identity)['cwd']
    def run(request):
        def read():
            return request('config/read', {'cwd': cwd, 'includeLayers': True})
        def trusted(value):
            return value.get('config', {}).get('projects', {}).get(cwd, {}).get('trust_level') == 'trusted'
        value = read()
        if confirmed and not trusted(value):
            layers = [layer for layer in value.get('layers') or []
                      if layer.get('name', {}).get('type') == 'user'
                      and not layer['name'].get('profile') and not layer.get('disabledReason')]
            if len(layers) != 1 or not layers[0].get('version'):
                raise CreationUnavailable('확인할 수 없습니다 Codex 사용자 구성 버전입니다. 컴퓨터에서 구성하세요. App 이 프로젝트를 믿으세요')
            project_directory(cwd, expected=identity)
            result = request('config/batchWrite', {'edits': [{
                'keyPath': 'projects.' + json.dumps(cwd, ensure_ascii=False) + '.trust_level',
                'value': 'trusted', 'mergeStrategy': 'replace'}],
                'filePath': None, 'expectedVersion': layers[0]['version'], 'reloadUserConfig': True})
            if result.get('status') != 'ok' or not trusted(read()):
                raise CreationError('디렉터리 신뢰 결과가 아직 확인되지 않았습니다. 확인하세요. Codex App 구성; 자동으로 다시 제출되지 않습니다.')
            value = {'config': {'projects': {cwd: {'trust_level': 'trusted'}}}}
        return {'trusted': trusted(value), 'path': cwd}
    # Do not launch the temporary reader in an as-yet untrusted project.
    return _runtime_operation(executable, codex_home, str(codex_home), run,
                              failure_message='디렉터리 신뢰 결과가 아직 확인되지 않았습니다. 확인하세요. Codex App 구성; 자동으로 다시 제출되지 않습니다.')


def apply_desktop_config():
    _open_desktop_url('codex://codex-app/apply-config')


def project_directory_listing(value=None, hidden=False, name=None, identity=None):
    """Explicit filesystem picker; only directories, never file contents."""
    if type(hidden) is not bool: raise ValueError('디렉터리 표시 옵션이 잘못되었습니다.')
    if value is None: value = str(Path.home())
    if not isinstance(value, str) or len(value) > 4096 or any(ord(c) < 32 for c in value):
        raise ValueError('잘못된 디렉터리 경로')
    if os.name == 'nt' and (value.startswith(('\\\\', '//')) or ':' in value[2:]):
        raise ValueError('이 컴퓨터의 로컬 디렉토리를 사용하십시오')
    try:
        path = Path(value).expanduser()
        if not path.is_absolute() or '..' in path.parts: raise ValueError('잘못된 디렉터리 경로')
        path = path.resolve(strict=True)
        if not path.is_dir() or not os.access(path, os.R_OK | os.X_OK): raise ValueError('디렉터리를 탐색할 수 없습니다.')
        st = path.stat()
        current = {'cwd': str(path), 'device': st.st_dev, 'inode': st.st_ino}
        if name is not None:
            if (not isinstance(name, str) or not name.strip() or len(name) > 200 or name in ('.', '..')
                    or any(c in name for c in '/\\:') or any(ord(c) < 32 for c in name)):
                raise ValueError('경로 구분 기호 없이 유효한 폴더 이름을 입력하세요.')
            if identity != current: raise ValueError('현재 디렉터리가 변경되었습니다. 새로고침하여 새 디렉터리를 만드세요.')
            child = path/name.strip()
            # A lost mkdir response must never silently select an existing
            # folder or follow a replacement symlink on a later request.
            try:
                child.mkdir(mode=0o700)
            except FileExistsError as exc:
                raise ValueError('폴더가 이미 존재합니다. 새로고침한 후 선택하세요.') from exc
            path = Path(project_directory(str(child))['cwd'])
            st = path.stat(); current = {'cwd': str(path), 'device': st.st_dev, 'inode': st.st_ino}
        directories = []
        for child in path.iterdir():
            if not hidden and child.name.startswith('.'): continue
            try:
                if child.is_dir(): directories.append({'name': child.name, 'path': str(child)})
            except OSError: continue
        directories.sort(key=lambda item: (item['name'].casefold(), item['name']))
        roots = [{'name': '/', 'path': '/'}]
        if os.name == 'nt':
            import ctypes
            kernel = ctypes.windll.kernel32
            roots = [{'name': chr(n)+':', 'path': chr(n)+':\\'} for n in range(65,91)
                     if kernel.GetDriveTypeW(chr(n)+':\\') in (2,3)]
        return {'path': str(path), 'parent': str(path.parent) if path.parent != path else None,
                'home': str(Path.home()), 'roots': roots, 'identity': current, 'directories': directories}
    except (OSError, RuntimeError) as exc:
        raise ValueError('이 디렉터리를 탐색할 수 없습니다. 액세스 권한을 확인하세요.') from exc


def _native_project_support(executable, required):
    """Inspect this runtime before a new-directory operation can mutate it."""
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    try:
        with tempfile.TemporaryDirectory(prefix='project-schema-') as folder:
            result = subprocess.run([str(executable), 'app-server', 'generate-json-schema', '--experimental', '--out', folder],
                                    capture_output=True, timeout=30, **kwargs)
            def schema(name):
                paths = list(Path(folder).rglob(name + '.json'))
                return json.loads(paths[0].read_text(encoding='utf-8')) if paths else {}
            supported = (result.returncode == 0 and
                         'projectId' in schema('ThreadStartParams').get('properties', {}) and
                         bool(schema('ProjectListResponse').get('properties', {}).get('data')))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        supported = False
    if required and not supported:
        raise CreationUnavailable("이 Codex 런타임은 네이티브 프로젝트 할당을 지원하지 않습니다. Codex 데스크톱을 업데이트하거나 앱에 프로젝트를 추가하고 다시 선택하세요.")
    return supported


def _native_project(request, cwd, project):
    canonical = lambda value: os.path.normcase(os.path.realpath(value))
    matches = []
    cursor = None
    seen = set()
    while True:
        page = request('project/list', {'cursor': cursor, 'limit': 100})
        matches.extend(row for row in page['data'] if any(
            canonical(root['path']) == canonical(cwd) for root in row.get('roots', [])))
        cursor = page.get('nextCursor')
        if cursor is None:
            break
        if cursor in seen:
            raise CreationError('기본 항목 목록 커서가 잘못되었습니다. 컴퓨터에서 사용해 보세요. App 확인항목')
        seen.add(cursor)
    named = [row for row in matches if row.get('name') == project.get('name')]
    selected = named if named else matches
    if len(selected) > 1:
        raise CreationError("이 폴더는 여러 네이티브 프로젝트와 일치합니다. 다시 시도하기 전에 데스크톱 앱에서 프로젝트를 확인하세요.")
    if selected:
        return selected[0]['id']
    raise CreationUnavailable("데스크톱 프로젝트와 런타임이 아직 일치하지 않습니다. Codex 앱과 런타임 구성을 확인한 후 다시 시도하세요.")


def model_overrides(model=None, effort=None):
    if model is None and effort is None:
        return {}
    if not isinstance(model, str) or not model or len(model) > 300 or any(c.isspace() or ord(c) < 32 for c in model):
        raise CreationUnavailable('새 세션 모델이 유효하지 않습니다.')
    if effort is not None and effort not in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'):
        raise CreationUnavailable('새 세션의 생각 강도가 잘못되었습니다.')
    return {'model': model, **({'config': {'model_reasoning_effort': effort}} if effort is not None else {})}


def save_new_thread(request, thread, title):
    """Materialize a newly created empty chat without inventing a native name."""
    if title:
        request('thread/name/set', {'threadId': thread['id'], 'name': title})
    else:
        # Native placement flushes the empty rollout before another client resumes
        # it. Preserve its initial section; never apply this to an existing chat.
        request('thread/section/move', {'threadId': thread['id'], 'sectionId': thread.get('sectionId')})


def create_empty(executable, codex_home, cwd, title, project=None, model=None, effort=None):
    overrides = model_overrides(model, effort)
    supported = project is not None and _native_project_support(executable, project.get('required', False))
    def create(request):
        project_id = _native_project(request, cwd, project) if supported else None
        params = {'cwd': cwd, 'ephemeral': False, **overrides}
        if project_id is not None:
            params['projectId'] = project_id
        result = request('thread/start', params)
        thread_id = result['thread']['id']
        uuid.UUID(thread_id)
        if model is not None and (result.get('model') != model or effort is not None and result.get('reasoningEffort') != effort):
            raise CreationError('채팅이 생성되었으나 모델이나 사고 강도가 확인되지 않았습니다. 원본 대화를 확인하세요. 다시 생성되지 않습니다.')
        if project_id is not None and result['thread'].get('projectId') != project_id:
            raise CreationError("채팅이 생성되었지만 해당 프로젝트가 확인되지 않았습니다. 데스크톱 앱을 확인하세요. 다시 생성하지 마십시오.")
        save_new_thread(request, result['thread'], title)
        saved = request('thread/read', {'threadId': thread_id, 'includeTurns': True})
        if project_id is not None and saved['thread'].get('projectId') != project_id:
            raise CreationError("채팅이 생성되었지만 저장된 프로젝트 할당이 확인되지 않았습니다. 데스크톱 앱을 확인하세요. 다시 생성하지 마십시오.")
        return thread_id
    return _runtime_operation(executable, codex_home, cwd, create)


def fork_copy(executable, codex_home, cwd, source_id, turn_id, title, settings, *, thread_source=None, isolated_home=False):
    if not executable:
        raise ForkUnavailable('찾을 수 없음 Codex 실행 시 컴퓨터 런처의 실행 구성에서 경로를 지정해 주세요.')
    # Check the bundled runtime, not a guessed version. Older servers can silently
    # ignore unknown fields; that must never copy later turns or start a goal.
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    with tempfile.TemporaryDirectory(prefix='fork-schema-') as folder:
        try:
            result = subprocess.run([str(executable), 'app-server', 'generate-json-schema', '--experimental', '--out', folder],
                                    capture_output=True, timeout=30, **kwargs)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ForkUnavailable('확인할 수 없음 Codex 실행시 실행중인 구성에서 프로그램 경로를 확인하신 후 다시 시도해주세요.') from exc
        paths = list(Path(folder).rglob('ThreadForkParams.json'))
        if result.returncode or not paths:
            raise ForkUnavailable("안전한 대화 분기를 사용하려면 데스크톱 Codex 앱을 업데이트하세요.")
        properties = json.loads(paths[0].read_text(encoding='utf-8')).get('properties', {})
        required = {'lastTurnId', 'deferGoalContinuation'}
        if thread_source is not None:
            required.add('threadSource')
        if not required <= properties.keys():
            raise ForkUnavailable("안전한 대화 분기를 사용하려면 데스크톱 Codex 앱을 업데이트하세요.")
    def fork(request):
        result = request('thread/fork', {'threadId': source_id, 'lastTurnId': turn_id,
                                        'deferGoalContinuation': True, 'ephemeral': False,
                                        'cwd': cwd, **settings, **({'threadSource': thread_source} if thread_source else {})})
        thread = result['thread']
        uuid.UUID(thread['id'])
        if thread['id'] == source_id:
            raise CreationError('잘못된 분기 결과입니다. 데스크톱 채팅 목록을 확인하세요.')
        turns = thread.get('turns', [])
        if not turns or turns[-1].get('id') != turn_id:
            raise CreationError("지점 위치는 확인되지 않았습니다. 다시 시도하기 전에 데스크톱 채팅 목록을 확인하세요.")
        if result.get('modelProvider') != settings['modelProvider']:
            raise CreationError("지점 공급자가 일치하지 않습니다. 데스크톱 채팅 목록을 확인하세요.")
        request('thread/name/set', {'threadId': thread['id'], 'name': title})
        return thread['id']
    return _runtime_operation(executable, codex_home, cwd, fork, isolated_home=isolated_home)


SIDE_CHAT_BOUNDARY = """You are in a side conversation, separate from the main thread.
Inherited history is reference context only. Do not continue any task, goal, plan,
request, approval, or tool call from before this boundary. Wait for a new user
message in this side conversation. Do not interact with inherited subagents.
Answer questions and perform lightweight exploration without disrupting the main
thread. Do not modify files, Git state, settings, or permissions unless the user
explicitly requests that mutation in this side conversation. Shared files are
live, not a snapshot. Keep explicitly requested changes local to the request."""


def fork_attached(executable, codex_home, cwd, source_id, title, settings, created, *, isolated_home=False,
                  runtime_operation=None):
    """Persist a native attached child; never start a turn or retain an owner.

    The capability check precedes the durable intent's first native mutation.
    Unknown fields are ignored by older servers, so a regular fork is not a
    safe substitute. `created` records the child before subsequent writes.
    """
    if not executable:
        raise ForkUnavailable('찾을 수 없음 Codex 실행 시 컴퓨터 클라이언트 구성을 확인하세요.')
    kwargs = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    with tempfile.TemporaryDirectory(prefix='attached-schema-') as folder:
        try:
            result = subprocess.run([str(executable), 'app-server', 'generate-json-schema', '--experimental', '--out', folder],
                                    capture_output=True, timeout=30, **kwargs)
            def properties(name):
                paths = list(Path(folder).rglob(name + '.json'))
                return json.loads(paths[0].read_text(encoding='utf-8')).get('properties', {}) if paths else {}
            supported = (not result.returncode and
                         {'attachToSource', 'excludeTurns'} <= properties('ThreadForkParams').keys() and
                         {'attachedToThreadId', 'useStateDbOnly'} <= properties('ThreadListParams').keys())
        except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
            raise ForkUnavailable("네이티브 보조 채팅 지원을 확인할 수 없습니다. Codex 런타임을 확인하고 다시 시도하십시오.") from exc
    if not supported:
        raise ForkUnavailable("이 Codex 버전은 네이티브 보조 채팅을 지원하지 않습니다. Codex 앱을 업데이트하고 다시 시도해 보세요.")

    def fork(request):
        result = request('thread/fork', {**settings, 'threadId': source_id, 'cwd': cwd,
                         'attachToSource': True, 'excludeTurns': True,
                         'developerInstructions': SIDE_CHAT_BOUNDARY})
        child = result['thread']['id']
        uuid.UUID(child)
        if child == source_id or result['thread'].get('ephemeral') is True:
            raise CreationError("네이티브 보조 채팅 신원이 확인되지 않았습니다. 메인 채팅을 확인하세요. 다시 생성되지 않습니다.")
        created(child)
        if result.get('modelProvider') != settings['modelProvider'] or result.get('model') != settings['model'] or result.get('cwd') != cwd:
            raise CreationError("보조 채팅 런타임 구성이 확인되지 않았습니다. 메인 채팅을 확인하세요. 다시 생성되지 않습니다.")
        cursor, seen = None, set()
        while True:
            page = request('thread/list', {'attachedToThreadId': source_id, 'archived': False,
                           'useStateDbOnly': True, 'limit': 100, 'cursor': cursor})
            if any(row.get('id') == child for row in page.get('data', [])):
                break
            cursor = page.get('nextCursor')
            if not cursor or cursor in seen:
                raise CreationError("네이티브 보조 채팅 관계가 확인되지 않았습니다. 메인 채팅을 확인하세요. 다시 생성되지 않습니다.")
            seen.add(cursor)
        request('thread/inject_items', {'threadId': child, 'items': [{'type': 'message', 'role': 'user',
                'content': [{'type': 'input_text', 'text': SIDE_CHAT_BOUNDARY}]}]})
        request('thread/name/set', {'threadId': child, 'name': title})
        return child
    if runtime_operation is not None:
        return runtime_operation(fork)
    return _runtime_operation(executable, codex_home, cwd, fork, isolated_home=isolated_home,
                              failure_message="보조 채팅 생성이 확인되지 않았습니다. 메인 채팅을 확인하세요. 다시 생성되지 않습니다.")


def open_project_in_desktop(cwd):
    # Native newThread navigation registers the folder and opens an empty
    # composer. Never include a prompt, message, or submit instruction.
    _open_desktop_url('codex://threads/new?' + urlencode({'path': cwd}))


def open_in_desktop(thread_id, host):
    uuid.UUID(thread_id)
    url = 'codex://threads/' + thread_id
    if host != 'local':
        url += '?' + urlencode({'hostId': host})
    _open_desktop_url(url)


def _open_desktop_url(url):
    if sys.platform == 'darwin':
        subprocess.run(['open', url], check=True, timeout=10,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif sys.platform == 'linux':
        try:
            subprocess.run(['xdg-open', url], check=True, timeout=10,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.SubprocessError) as exc:
            raise CreationError("데스크톱 채팅을 열 수 없습니다. 데스크탑 로그인 세션에서 게이트웨이를 실행하고 xdg-open 및 codex:// 프로토콜 핸들러를 확인하십시오.") from exc
    elif os.name == 'nt':
        os.startfile(url)
    else:
        raise CreationError('지원해주세요 Codex App 의 Mac 또는 Windows 게이트웨이를 실행하는 컴퓨터')


def rename_thread(executable, codex_home, thread_id, title, *, isolated_home=False):
    uuid.UUID(thread_id)
    return _runtime_operation(executable, codex_home, str(codex_home),
                              lambda request: request('thread/name/set', {'threadId': thread_id, 'name': title}),
                              isolated_home=isolated_home)


class ArchiveRejected(CreationError):
    """The native archive RPC replied with an explicit error, not a lost reply."""
    def __init__(self, error):
        self.rpc_error = error if isinstance(error, dict) else {'message': str(error)}
        message = str(self.rpc_error.get('message', ''))
        self.reason = ('active_writer' if 'already has an active writer' in message else
                       'unsupported' if self.rpc_error.get('code') == -32601 else 'native_rejected')
        public = ("원래 Codex 클라이언트는 여전히 이 채팅을 소유하고 있습니다. 거기에 보관하세요. 이 연결은 보관할 수 없습니다."
                  if self.reason == 'active_writer' else
                  "원래 Codex 런타임은 이 아카이브 작업을 지원하지 않습니다. 원래 클라이언트를 사용하십시오." if self.reason == 'unsupported' else
                  "네이티브 클라이언트가 이 아카이브 작업을 거부했습니다. 다시 시도하기 전에 원래 클라이언트를 확인하세요.")
        super().__init__(public)


class ArchiveNotSent(CreationError):
    """Archive validation failed before a native mutation was dispatched."""


def check_archive_runtime(request, identifiers, *, allow_terminal_error=False):
    """Read only: never resume a thread to establish archive safety."""
    for identifier in identifiers:
        thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
        status = (thread.get('status') or {}).get('type')
        terminal_error = allow_terminal_error and status == 'systemError'
        if (thread.get('id') != identifier or (status not in ('idle', 'notLoaded') and not terminal_error) or
                thread.get('requests') or any(turn.get('status') == 'inProgress' for turn in thread.get('turns', []))):
            raise ValueError("이 채팅 또는 하위 에이전트가 실행 중이거나 승인 대기 중이거나 상태를 알 수 없습니다. 원래 클라이언트를 먼저 확인하세요.")
        if terminal_error:
            from bridge.clients.codex.release import check_terminal_system_error
            check_terminal_system_error(request, thread)


def stop_archive_runtime(request, identifiers, timeout=20):
    """Stop verified turns and background terminals on their original runtime."""
    turns = []
    def background(identifier):
        thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
        if thread.get('id') != identifier:
            raise ValueError("원래 세션 ID가 변경되었습니다. 보관 요청이 전송되지 않았습니다.")
        if (thread.get('status') or {}).get('type') == 'notLoaded':
            return False
        result = request('thread/backgroundTerminals/list', {'threadId': identifier, 'limit': 1})
        if not isinstance(result.get('data'), list):
            raise ValueError("네이티브 백그라운드 작업 상태를 확인할 수 없습니다.")
        return bool(result['data'] or result.get('nextCursor'))
    # Complete preflight before the first stop; never resume to discover activity.
    try:
        for identifier in identifiers:
            thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
            status = (thread.get('status') or {}).get('type')
            if thread.get('id') != identifier or status not in ('idle', 'notLoaded', 'active'):
                raise ValueError("원래 세션 상태를 확인할 수 없습니다. 아무것도 중지되거나 보관되지 않았습니다.")
            if status == 'active':
                rows = request('thread/turns/list', {'threadId': identifier, 'limit': 1, 'sortDirection': 'desc'})['data']
                if len(rows) != 1 or rows[0].get('status') != 'inProgress' or not isinstance(rows[0].get('id'), str):
                    raise ValueError("중지할 네이티브 작업을 확인할 수 없습니다. 아무것도 중지되거나 보관되지 않았습니다.")
                turns.append((identifier, rows[0]['id']))
            elif thread.get('requests'):
                raise ValueError("채팅에 대기 중인 요청이 있습니다. 아무것도 중지되거나 보관되지 않았습니다.")
            background(identifier)
    except Exception as exc:
        raise ArchiveNotSent(str(exc)) from exc
    for identifier, turn_id in turns:
        # Stopping a parent can already settle its descendants.
        thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
        if thread.get('id') != identifier:
            raise CreationError("원래 세션 ID가 변경되었습니다. 보관 요청이 전송되지 않았습니다.")
        if (thread.get('status') or {}).get('type') == 'active':
            request('turn/interrupt', {'threadId': identifier, 'turnId': turn_id})
    for identifier in identifiers:
        if background(identifier):
            request('thread/backgroundTerminals/clean', {'threadId': identifier})
    deadline = time.monotonic() + timeout
    while True:
        try:
            check_archive_runtime(request, identifiers)
            if any(background(identifier) for identifier in identifiers):
                raise ValueError('백그라운드 작업이 아직 중지되지 않았습니다.')
            return
        except ValueError:
            if time.monotonic() >= deadline:
                raise CreationError("정지 결과는 확인되지 않았습니다. 보관 요청이 전송되지 않았습니다.") from None
            time.sleep(.1)


def archive_thread(executable, codex_home, thread_id, archived, identifiers, *, isolated_home=False):
    uuid.UUID(thread_id)
    sent = False
    def dispatch(request):
        nonlocal sent
        check_archive_runtime(request, identifiers)
        sent = True
        return request('thread/archive' if archived else 'thread/unarchive', {'threadId': thread_id})
    try:
        return _runtime_operation(executable, codex_home, str(codex_home), dispatch, isolated_home=isolated_home)
    except Exception as exc:
        if not sent:
            raise ArchiveNotSent(str(exc)) from exc
        raise
