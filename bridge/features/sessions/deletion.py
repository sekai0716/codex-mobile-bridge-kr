"""Confirmed native deletion, with an exact subtree and durable non-replay receipts."""
import json
import threading
import uuid
from pathlib import Path

from bridge.features.sessions.create import CreationError, DeleteRejected, check_archive_runtime


class DeleteNotSent(ValueError):
    """No native deletion was dispatched."""


def deletion_scope(store, identifier):
    """Read metadata only; attached children are deleted before their parent."""
    root = store.get(identifier)
    rows, visited = [], set()

    def visit(row):
        sid = row['id']
        if sid in visited:
            raise ValueError('사이드 채팅 관계가 비정상입니다. 원래 클라이언트에서 먼저 확인하세요.')
        visited.add(sid)
        for child in store.attached_children(sid):
            visit(child)
        rows.append({'id': sid, 'title': row.get('name') or row.get('title') or sid,
                     'archived': bool(row.get('archived'))})

    visit(root)
    identifiers = sorted(row['id'] for row in store.lifecycle_threads(root_id=identifier))
    return {'id': identifier, 'sessions': rows, 'scope': identifiers,
            'subagentCount': len(set(identifiers) - visited)}


def delete_native(request, snapshot, recheck):
    """Never resume, interrupt or replace an owner to make a deletion succeed."""
    try:
        if recheck() != snapshot:
            raise ValueError('채팅이나 사이드 채팅이 변경되었습니다. 삭제 범위를 다시 확인해 주세요.')
        check_archive_runtime(request, snapshot['scope'])
        for identifier in snapshot['scope']:
            thread = request('thread/read', {'threadId': identifier, 'includeTurns': False})['thread']
            if thread.get('id') != identifier:
                raise ValueError('원래 세션 ID가 변경되었습니다. 메뉴를 다시 열어주세요.')
            if (thread.get('status') or {}).get('type') != 'notLoaded':
                background = request('thread/backgroundTerminals/list', {'threadId': identifier, 'limit': 1})
                if not isinstance(background.get('data'), list) or background['data'] or background.get('nextCursor'):
                    raise ValueError('채팅에 아직 백그라운드 작업이 있습니다. 삭제하기 전에 중지하세요.')
        if recheck() != snapshot:
            raise ValueError('채팅이나 사이드 채팅이 변경되었습니다. 삭제 범위를 다시 확인해 주세요.')
    except Exception as exc:
        raise DeleteNotSent(str(exc)) from exc
    for index, row in enumerate(snapshot['sessions']):
        try:
            request('thread/delete', {'threadId': row['id']})
        except DeleteRejected as exc:
            if index == 0:
                raise DeleteNotSent(str(exc)) from exc
            raise


class DeleteCommands:
    def __init__(self, directory, write_json):
        self.path = Path(directory) / 'session-deletions.json'
        self.write_json = write_json
        self.lock = threading.RLock()

    def _pending(self, entries, scope, existing):
        pending = []
        for key, row in entries.items():
            if row['status'] == 'unknown' and set(row['scope']) & set(scope):
                if existing(row['scope']):
                    pending.append(key)
                else:
                    row['status'] = 'confirmed'
        return sorted(pending)

    def preview(self, read, existing):
        with self.lock:
            snapshot = read()
            entries = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
            pending = self._pending(entries, snapshot['scope'], existing)
            if entries:
                self.write_json(self.path, entries)
            return {**snapshot, **({'retry': pending} if pending else {})}

    def perform(self, identifier, request_id, expected, read, existing, prepare, retry=None):
        uuid.UUID(identifier)
        uuid.UUID(request_id)
        if (not isinstance(expected, list) or not expected or not all(isinstance(sid, str) for sid in expected)
                or len(expected) != len(set(expected))
                or identifier not in expected):
            raise ValueError('삭제 범위를 다시 확인해 주세요.')
        for sid in expected:
            uuid.UUID(sid)
        scope = sorted(expected)
        if retry is not None:
            if not isinstance(retry, list) or not all(isinstance(key, str) for key in retry) or len(set(retry)) != len(retry):
                raise ValueError("확인되지 않은 삭제 기록을 다시 확인하세요.")
            for key in retry:
                uuid.UUID(key)
        with self.lock:
            entries = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
            old = entries.get(request_id)
            if old and (old['id'] != identifier or old['scope'] != scope):
                raise ValueError('동일한 요청 ID를 다른 삭제 작업에 사용할 수 없습니다.')
            # Missing metadata is evidence only for a previously persisted scope.
            pending = self._pending(entries, scope, existing)
            if pending and (old or sorted(retry or []) != pending):
                raise ValueError("이전 삭제 내용은 확인되지 않으며 다시 제출되지 않습니다. 삭제 메뉴를 다시 열어 확인하세요.")
            if retry and sorted(retry) != pending:
                raise ValueError("삭제 기록이 변경되었습니다. 메뉴를 다시 열어 확인하세요.")
            if old:
                self.write_json(self.path, entries)
                return dict(old)
            snapshot = read()
            if snapshot['scope'] != scope:
                raise ValueError('채팅이나 사이드 채팅이 변경되었습니다. 삭제 범위를 다시 확인해 주세요.')
            call = prepare(snapshot)
            covered = [key for key in pending if set(existing(entries[key]['scope'])) <= set(scope)]
            result = {'id': identifier, 'scope': scope, 'status': 'unknown'}
            entries[request_id] = result
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            self.write_json(self.path, entries)
            try:
                call()
            except DeleteNotSent:
                del entries[request_id]
                self.write_json(self.path, entries)
                raise
            except Exception as exc:
                for key in covered:
                    entries[key].update(status='superseded', supersededBy=request_id)
                self.write_json(self.path, entries)
                raise CreationError('삭제 결과를 확인해야 합니다. 중복 제출되지 않으니, 원본 클라이언트에서 확인하시기 바랍니다.') from exc
            for key in covered:
                entries[key].update(status='superseded', supersededBy=request_id)
            self.write_json(self.path, entries)
            if existing(scope):
                raise CreationError('삭제 결과를 확인해야 합니다. 중복 제출되지 않으니, 원본 클라이언트에서 확인하시기 바랍니다.')
            result['status'] = 'confirmed'
            self.write_json(self.path, entries)
            return dict(result)
