"""Explicit account switch: scoped normal quit, existing transaction, same GUI."""
from bridge.clients.errors import BridgeUnavailable
from bridge.platforms import antigravity_lifecycle as native
from bridge.platforms.antigravity import endpoint, verify_endpoint


def switch_account(store, adapter, descriptor, identifier):
    # Match public()'s store -> CLI order so account polling cannot deadlock
    # this transaction. The manager also fences new provider operations.
    with store.lock, adapter.cli._lock:
        store.validate_saved(identifier)
        plan = native.prepare(descriptor)
        if plan:
            surface = plan['installation']['surface']
            target = endpoint(surface, adapter.home)
            native.bind_server(plan, target)
            if adapter.hooks:
                adapter.hooks.assert_account_idle()
            adapter.cli.assert_idle(surface, target['identity'])
            verify_endpoint(target)
            native.verify(plan)
            native.stop(plan)
        # This retains the existing all-writers-stopped checks, conditional
        # rollback and read-back verification. No profile tree is copied.
        result = store.restore(identifier)
        if not plan:
            return result
        try:
            native.restart(plan)
        except Exception:
            # Once native startup may have happened, its credential refreshes
            # must not be overwritten by a speculative rollback or a retry.
            return {**result, 'message': '로그인 구성이 적용되었지만 원래 클라이언트가 다시 열리는지 확인되지 않았습니다. 컴퓨터에서 확인해주세요. 반복되는 시작 없음, 롤백 없음 또는 구성 지우기 없음。'}
        # Starting a process is not proof of login. public() derives activeIds
        # exclusively from GetUserStatus; never assign a last-switched ID.
        try:
            current = store.public()
            if identifier in current.get('activeIds', []):
                return {**current, 'message': '원래 클라이언트가 다시 열리고 현재 로그인이 확인되었습니다.。'}
            result = current
        except (OSError, ValueError, BridgeUnavailable):
            pass
        return {**result, 'message': '로그인 구성이 적용되었으며 원래 클라이언트를 다시 열도록 요청되었습니다. 로그인이 확인되지 않았습니다. 나중에 계정 상태를 새로 고치십시오.。'}
