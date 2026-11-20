"""Display-only projections for original Codex queue and search responses."""

import hashlib
import json
import re
import sqlite3
import uuid
from contextlib import closing
from pathlib import Path

from bridge.clients.codex.app_server import AppServerError
from bridge.clients.codex.ipc import IPCError
from .model import normalize_item


def queue_page(request, thread_id):
    result, cursors, ids = [], set(), set()
    params = {'threadId': thread_id, 'limit': 100}
    while True:
        page = request('thread/queue/list', params)
        if not isinstance(page.get('data'), list):
            raise ValueError('Invalid queue response.')
        for row in page['data']:
            identifier = row['id']
            if identifier in ids:
                continue
            ids.add(identifier)
            inputs = row.get('input', [])
            result.append({'id': identifier, 'clientId': row.get('clientUserMessageId'),
                           'text': '\n'.join(v['text'] for v in inputs if v.get('type') == 'text'),
                           'attachments': [str(v.get('name') or v.get('path') or v['type']).split('/')[-1][:300]
                                           for v in inputs if v.get('type') != 'text']})
        cursor = page.get('nextCursor')
        if not cursor:
            return result
        if cursor in cursors:
            raise ValueError('Queue changed during the read. Refresh.')
        cursors.add(cursor)
        params = {**params, 'cursor': cursor}


def visible_items(turn):
    for item in turn.get('items', []):
        if item.get('type') in ('userMessage', 'steeringUserMessage', 'agentMessage', 'assistantMessage'):
            yield normalize_item(item)


def excerpt(turn_id, item_id, term, text):
    match = re.search(re.escape(term), text, re.IGNORECASE)
    if match:
        return {'turnId': turn_id, 'itemId': item_id,
                'snippet': text[max(0, match.start() - 64):match.end() + 110]}


def saved_index_search(store, thread, term, position, limit, target=None):
    """Read only an up-to-date projection of the authorized thread's rollout."""
    if not hasattr(store, '_rollout_in_home'):
        return None
    meta = store.get(thread)
    if not meta.get('rollout_path'):
        return None
    rollout = Path(meta['rollout_path']).resolve()
    if not store._rollout_in_home(rollout):
        return None
    db = store.home / 'thread_history_1.sqlite'
    try:
        with db.open('rb') as source:
            wal = source.read(20)[18:20] == b'\x02\x02'
        if wal and not all(Path(str(db) + name).exists() for name in ('-wal', '-shm')):
            return None
        with closing(sqlite3.connect(db.as_uri() + '?mode=ro', uri=True, timeout=.25)) as conn:
            conn.execute('BEGIN')
            offset = conn.execute('SELECT next_rollout_byte_offset FROM thread_history_projection_state WHERE thread_id=?',
                                  (thread,)).fetchone()
            if not offset or offset[0] != rollout.stat().st_size:
                return None
            query = ("SELECT rollout_ordinal,turn_id,item_json FROM thread_items WHERE thread_id=? "
                     "AND json_extract(item_json,'$.type') IN ('userMessage','steeringUserMessage','agentMessage','assistantMessage') ")
            if target:
                row = conn.execute(query + "AND turn_id=? AND json_extract(item_json,'$.id')=? LIMIT 1",
                                   (thread, target[0], target[1])).fetchone()
                return message_slice(visible_items({'items': [json.loads(row[2])]}) if row else (), target[1], position)
            matches, last, count = [], None, 0
            # Each page has a bounded scan even if the term is rare.
            for ordinal, turn_id, raw in conn.execute(query + 'AND rollout_ordinal>? ORDER BY rollout_ordinal LIMIT 400',
                                                      (thread, position)):
                count += 1
                last = ordinal
                item = next(visible_items({'items': [json.loads(raw)]}), None)
                if item and item.get('id') and (hit := excerpt(turn_id, item['id'], term, item.get('text') or '')):
                    matches.append(hit)
                    if len(matches) == limit:
                        break
            more = count == 400 or len(matches) == limit
            return matches, str(last) if more else None
    except (OSError, sqlite3.Error, json.JSONDecodeError):
        return None


def message_slice(messages, item_id, offset):
    for item in messages:
        if item.get('id') == item_id and item.get('role') in ('user', 'assistant'):
            text = item.get('text') or ''
            end = min(offset + 16384, len(text))
            return {'role': item['role'], 'text': text[offset:end], 'next': end if end < len(text) else None}
    raise ValueError('The original message has changed. Search again.')


def cursor_tag(thread, account, term):
    return hashlib.sha256(json.dumps([thread, account, term], ensure_ascii=False).encode()).hexdigest()[:20]


def search(owner, thread_id, body):
    uuid.UUID(thread_id)
    with owner.lock:
        session = owner.live.get(thread_id)
    identity = owner._management_identity(thread_id, refresh=True)
    if not session or not identity or identity != body.get('account'):
        raise ValueError('계정 연결이 변경되었습니다. 채팅을 새로 고치고 다시 시도하세요.')
    term = body.get('term')
    if not isinstance(term, str) or not 1 <= len(term.strip()) <= 256:
        raise ValueError('Enter a search term (1–256 characters).')
    term = term.strip()
    tag = cursor_tag(thread_id, identity, term)
    cursor = body.get('cursor')
    if cursor is not None and (not isinstance(cursor, dict) or cursor.get('tag') != tag
            or cursor.get('source') not in ('native','index','loaded') or not isinstance(cursor.get('value'), str)
            or len(cursor['value']) > 8192):
        raise ValueError('Search changed. Start a new search.')
    source, position = (cursor['source'], cursor['value']) if cursor else (None, None)
    target = body.get('target')
    if target is not None and (not cursor or not isinstance(target, list) or len(target) != 2
            or any(not isinstance(i, str) or len(i) > 1024 for i in target)):
        raise ValueError('Invalid search result.')
    offset = body.get('offset', 0)
    if type(offset) is not int or not 0 <= offset <= 2**31:
        raise ValueError('Invalid offset.')

    def token(where, value):
        return {'tag':tag, 'source':where, 'value':str(value)}

    def result(where, rows, more):
        if owner._management_identity(thread_id) != identity:
            raise ValueError('Search changed. Start a new search.')
        return {'source':where, 'data':rows, 'cursor':token(where, more) if more is not None else None}

    if source in (None, 'native'):
        try:
            with owner._thread_source(session) as (request, _):
                if target:
                    page = request('thread/turns/list', {'threadId':thread_id, 'limit':1, 'cursor':position, 'itemsView':'full'})
                    turn = next((t for t in page['data'] if t.get('id') == target[0]), {})
                    return result('native', message_slice(visible_items(turn), target[1], offset), None)
                params = {'threadId':thread_id, 'searchTerm':term, 'limit':20}
                if position is not None:
                    params['cursor'] = position
                page = request('thread/searchOccurrences', params)
                rows = [{'turnId':hit['turnId'], 'itemId':hit['itemId'], 'snippet':hit['snippet'],
                         'cursor':token('native', hit['turnCursor'])} for hit in page['data']]
                return result('native', rows, page.get('nextCursor'))
        except (AppServerError, IPCError, OSError, KeyError, ValueError):
            if source:
                raise ValueError('Search changed. Start a new search.') from None
    if source in (None, 'index'):
        lookup = saved_index_search(owner.store, thread_id, term, offset if target else int(position or -1), 20, target)
        if lookup is not None:
            if target:
                return result('index', lookup, None)
            rows, more = lookup
            for row in rows:
                row['cursor'] = token('index', 0)
            return result('index', rows, more)
        if source:
            raise ValueError('Search changed. Start a new search.')
    view = session.timeline_view() if hasattr(session, 'timeline_view') else session.view()
    turns = view.get('turns', [])
    rows = []
    after = position if source == 'loaded' and not target else None
    for turn in turns:
        if target and turn['id'] == target[0]:
            return result('loaded', message_slice(turn['messages'], target[1], offset), None)
        for item in turn['messages']:
            if target or item.get('role') not in ('assistant', 'user') or not item.get('id'):
                continue
            anchor = hashlib.sha256(json.dumps([turn['id'],item['id']]).encode()).hexdigest()[:24]
            if after:
                if anchor == after:
                    after = None
                continue
            hit = excerpt(turn['id'], item['id'], term, item.get('text') or '')
            if hit:
                rows.append({**hit, 'cursor':token('loaded', 0)})
                if len(rows) == 20:
                    return result('loaded', rows, anchor)
    if target or after:
        raise ValueError('The original message has changed. Search again.')
    return result('loaded', rows, None)
