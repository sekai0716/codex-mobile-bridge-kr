"""부모에서 확인한 하위 채팅의 원본 런타임만 조회하고 입력을 보낸다."""
import hashlib
import json
import threading
import uuid
from pathlib import Path

from bridge.clients.codex.app_server import AppServerError, AppServerRequestNotSent
from bridge.clients.codex.ipc import IPCError
from bridge.features.sessions.identity import same_cwd
from bridge.features.sessions.model import normalize_state
from bridge.features.sessions.tool_images import public_turns


class SubagentChat:
    def __init__(self, store, directory, connection, save):
        self.store, self.connection, self.save = store, connection, save
        self.receipts = Path(directory) / 'subagent-sends.json'
        self.lock = threading.Lock()

    @staticmethod
    def _read(request, meta, *, limit):
        child = meta['id']
        thread = request('thread/read', {'threadId': child, 'includeTurns': False})['thread']
        if (thread.get('id') != child or thread.get('parentThreadId') != meta['parentId']
                or not same_cwd(meta.get('cwd'), thread.get('cwd'), False) or not meta.get('model_provider')
                or thread.get('modelProvider') != meta['model_provider']):
            raise ValueError('하위 에이전트의 원본 연결을 확인할 수 없습니다.')
        status = thread.get('status') or {}
        if status.get('type') not in ('idle', 'active'):
            raise ValueError('하위 에이전트의 실시간 연결이 종료되었습니다.')
        # paginated 스레드의 thread/read에는 본문이 없다. 현재 턴부터 읽고 표시할 때만 순서를 되돌린다.
        page = request('thread/turns/list', {'threadId': child, 'limit': limit, 'sortDirection': 'desc',
                                             'itemsView': 'full' if limit > 1 else 'summary'})
        turns = page['data']
        last = turns[0] if turns else {}
        active = last.get('id') if last.get('status') == 'inProgress' else None
        waiting = bool(status.get('activeFlags'))
        can_send = (thread.get('canAcceptDirectInput') is True and not meta.get('archived') and not waiting
                    and ((status['type'] == 'active' and bool(active)) or (status['type'] == 'idle' and not active)))
        return {'canSend': can_send, 'activeTurnId': active, 'status': status['type']}, turns, not page.get('nextCursor')

    @staticmethod
    def conversation_turns(view):
        turns = [{**turn, 'messages': [row for row in turn['messages'] if row.get('kind') != 'reasoning']}
                 for turn in view['turns']]
        return public_turns(turns, image_previews=False)

    def view(self, parent, child):
        meta = self.store.subagent_metadata(parent, child)
        with self.connection(meta, write=False) as (request, generation):
            control, turns, complete = self._read(request, meta, limit=10)
        recorded = [{'turnId': t['id'], 'status': t.get('status'), 'items': t.get('items') or [],
                     'turnStartedAtMs': (t.get('startedAt') or 0) * 1000} for t in reversed(turns)]
        view = normalize_state({'id': child, 'turns': recorded}, item_limit=100)
        return {'id': child, 'title': meta.get('agent_nickname') or meta.get('title'), 'live': True,
                'control': {**control, 'generation': generation}, 'turns': self.conversation_turns(view),
                'historyComplete': complete and not view['historyWindowMore']}

    def send(self, parent, child, body):
        meta = self.store.subagent_metadata(parent, child)
        if not isinstance(body, dict) or set(body) != {'id', 'text', 'generation', 'expectedTurnId'}:
            raise ValueError('하위 에이전트 전송 정보가 잘못되었습니다.')
        identifier, text, expected = body['id'], body['text'], body['expectedTurnId']
        if (not isinstance(identifier, str) or str(uuid.UUID(identifier)) != identifier or not isinstance(text, str)
                or not text.strip() or len(text) > 100000 or not isinstance(body['generation'], str)
                or (expected is not None and not isinstance(expected, str))):
            raise ValueError('하위 에이전트 전송 정보가 잘못되었습니다.')
        digest = hashlib.sha256(json.dumps([parent, child, text, body['generation'], expected]).encode()).hexdigest()
        with self.lock:
            records = json.loads(self.receipts.read_text(encoding='utf-8')) if self.receipts.exists() else {}
            if identifier in records:
                prior = records[identifier]
                if prior['digest'] != digest:
                    raise ValueError('전송 ID가 다른 메시지에 사용되었습니다.')
                return {'id': identifier, 'status': prior['status']}
            with self.connection(meta, write=True) as (request, generation):
                control, _, _ = self._read(request, meta, limit=1)
                if generation != body['generation'] or not control['canSend'] or control['activeTurnId'] != expected:
                    raise ValueError('하위 에이전트 상태가 바뀌었습니다. 현재 작업을 확인하고 다시 보내세요.')
                params = {'threadId': child, 'clientUserMessageId': identifier, 'input': [{'type': 'text', 'text': text, 'text_elements': []}]}
                if expected:
                    params['expectedTurnId'] = expected
                # 쓰기 직전에 영수증을 저장한다. 연결이 끊겨도 같은 입력을 두 번 보내지 않는다.
                record = records[identifier] = {'digest': digest, 'status': 'unknown'}
                self.save(self.receipts, records)
                try:
                    reply = request('turn/steer' if expected else 'turn/start', params)
                    if (reply.get('turnId') == expected if expected else bool((reply.get('turn') or {}).get('id'))):
                        record['status'] = 'accepted'
                except (AppServerError, IPCError, OSError, TimeoutError) as error:
                    if isinstance(error, AppServerRequestNotSent) or getattr(error, 'rpc_error', None):
                        record['status'] = 'rejected'
                self.save(self.receipts, records)
            return {'id': identifier, 'status': record['status']}
