"""Release only the calling connection's native thread subscription."""
from bridge.clients.codex.app_server import AppServerUnsupported


GOAL_STATUSES = ('active', 'paused', 'blocked', 'usageLimited', 'budgetLimited', 'complete')


class ReleaseNotSent(ValueError):
    """Only reads ran; a fresh explicit release may safely retry."""
    def __init__(self, error):
        super().__init__(str(error))
        self.release_result = {'status': 'failed', 'notSent': True, 'error': str(error)}


def check_terminal_system_error(request, thread):
    """An Error precedes TurnComplete; systemError alone is not quiescence."""
    identifier = thread.get('id')
    def settled(snapshot):
        status = snapshot.get('status') or {}
        return (snapshot.get('id') == identifier and status.get('type') == 'systemError'
                and ('activeFlags' not in status or status['activeFlags'] == [])
                and ('requests' not in snapshot or snapshot['requests'] == [])
                and not any(turn.get('status') == 'inProgress' for turn in snapshot.get('turns') or []))
    if not settled(thread):
        raise ValueError('기존 CLI 오류 상태는 처리할 작업이 아직 남아 있거나 상태를 알 수 없는 것입니다. 먼저 원본 클라이언트에서 처리해 주세요.')
    page = request('thread/turns/list', {'threadId': identifier, 'limit': 1, 'sortDirection': 'desc'})
    rows = page.get('data') if isinstance(page, dict) else None
    if (not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict)
            or not isinstance(rows[0].get('id'), str) or not rows[0]['id']
            or rows[0].get('status') not in ('completed', 'interrupted', 'failed')
            or type(rows[0].get('completedAt')) is not int):
        raise ValueError('기존 CLI 해당 오류는 아직 확인되지 않았습니다. 먼저 원본 클라이언트에서 처리해 주세요.')
    # Thread has no requests field in 0.164. The terminal timestamp plus native
    # status (which prioritizes approval/input) is evidence, not a missing list.
    current = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
    if not settled(current):
        raise ValueError('기존 CLI 세션 상태가 변경되었습니다. 다시 확인하세요.')


def check_release(request, identifier, unsubscribed=False):
    """Verify unload without resuming or repeating an unsubscribe."""
    thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
    if thread.get('id') != identifier:
        raise ValueError('기존 CLI 세션 ID가 변경되었으며 새 연결이 확인되지 않았습니다.')
    status = (thread.get('status') or {}).get('type')
    if status == 'notLoaded':
        return {'status': 'released', 'notice': '기본 세션이 제거되었으며 컴퓨터에서 계속할 수 있습니다.'}
    if status not in ('idle', 'active', 'systemError'):
        raise ValueError('원본 확인 불가 CLI 세션 상태')
    return {'status': 'detached' if unsubscribed else 'unknown',
            'notice': '게이트웨이가 구독을 취소했습니다. 기본 세션은 여전히 ​​유지되며 다른 실행자가 인계받는 것으로 확인되지 않았습니다.' if unsubscribed
                      else '기본 세션은 여전히 ​​로드되어 있으며 이전 릴리스 결과를 확인하는 데 사용할 수 없습니다. 작업이 재생되지 않습니다'}


def unsubscribe_thread(request, identifier):
    result = request('thread/unsubscribe', {'threadId': identifier})
    if result.get('status') not in ('unsubscribed', 'notSubscribed', 'notLoaded'):
        raise ValueError('기존 CLI 구독 취소가 확인되지 않았습니다. 세션을 확인하세요. 자동으로 재생되지 않습니다')
    try:
        verified = check_release(request, identifier, unsubscribed=True)
    except Exception:
        verified = {'status': 'detached', 'notice': '게이트웨이가 구독 취소를 확인했습니다. 기본 제거 상태를 일시적으로 읽을 수 없습니다. 결과를 확인하십시오.'}
    return {**verified, 'unsubscribed': True}


def release_thread(request, identifier, stop=False, *, allow_terminal_error=False):
    original_request, mutated = request, False
    def request(method, params):
        nonlocal mutated
        if method in ('thread/goal/set', 'turn/interrupt', 'thread/backgroundTerminals/clean', 'thread/unsubscribe'):
            mutated = True
        try:
            return original_request(method, params)
        except Exception as error:
            if not mutated:
                error.release_result = {'status': 'failed', 'notSent': True, 'error': str(error)}
            raise

    def state():
        thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
        status = (thread.get('status') or {}).get('type')
        if thread.get('id') != identifier or status not in ('idle', 'active', 'notLoaded', 'systemError'):
            raise ReleaseNotSent('원본 확인 불가 CLI 세션 상태, 연결이 해제되지 않음')
        if status == 'systemError':
            if not allow_terminal_error:
                raise ReleaseNotSent('현재 CLI 해당 버전의 오류 최종 상태가 확인되지 않아 연결이 해제되지 않았습니다.')
            try:
                check_terminal_system_error(request, thread)
            except ValueError as error:
                raise ReleaseNotSent(error) from error
        return thread, status

    thread, status = state()
    if status != 'notLoaded':
        tasks = request('thread/backgroundTerminals/list', {'threadId': identifier, 'limit': 1})
        if not isinstance(tasks.get('data'), list):
            raise ReleaseNotSent('원본 확인 불가 CLI 백그라운드 작업, 연결이 해제되지 않음')
        try:
            result = request('thread/goal/get', {'threadId': identifier})
            goal = result.get('goal')
            if status == 'systemError' and ('goal' not in result or goal is not None and (
                    not isinstance(goal, dict) or goal.get('status') not in GOAL_STATUSES)):
                raise ReleaseNotSent('원본 확인 불가 CLI 대상 상태, 연결이 해제되지 않음')
        except Exception as error:
            if not isinstance(error, AppServerUnsupported) and getattr(error, 'rpc_error', {}).get('code') != -32601:
                raise
            goal = None
        if goal and goal.get('status') == 'active':
            if not stop:
                return {'status': 'waiting'}
            paused = request('thread/goal/set', {'threadId': identifier, 'status': 'paused'}).get('goal')
            if not paused or paused.get('status') != 'paused':
                raise ValueError('기본 대상 일시 중지가 확인되지 않았으며 연결이 아직 해제되지 않았습니다.')
        busy = status == 'active' or bool(thread.get('requests') or tasks['data'] or tasks.get('nextCursor'))
        if busy and not stop:
            return {'status': 'waiting'}
        if busy:
            from bridge.features.sessions.create import stop_archive_runtime
            try:
                stop_archive_runtime(request, [identifier])
            except Exception as error:
                if not mutated:
                    error.release_result = {'status': 'failed', 'notSent': True, 'error': str(error)}
                raise
    return unsubscribe_thread(request, identifier)
