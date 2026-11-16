"""Durable archive receipts: uncertain native mutations are never replayed."""
import json
import threading
import uuid
from pathlib import Path
from bridge.app.lifecycle import private_json
from bridge.features.sessions.create import ArchiveNotSent, ArchiveRejected


class ArchiveCommands:
    def __init__(self, directory):
        self.path = Path(directory) / 'session-archives.json'
        self.lock = threading.RLock()

    def perform(self, identifier, archived, request_id, read, dispatch):
        uuid.UUID(identifier)
        if not isinstance(request_id, str):
            raise ValueError('잘못된 보관 요청 ID')
        uuid.UUID(request_id)
        if not isinstance(archived, bool):
            raise ValueError('잘못된 채팅 보관 설정')
        with self.lock:
            entries = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
            before = read()
            old = entries.get(request_id)
            if old and (old['id'] != identifier or old['archived'] != archived):
                raise ValueError('동일한 요청 ID를 다른 작업에 사용할 수 없습니다.')
            for entry in entries.values():
                if entry['id'] == identifier and entry['status'] == 'unknown':
                    if (bool(before.get('archived')) != entry['archived'] or
                            (entry['archived'] and any((before.get('_archiveFlags') or {}).get(sid) is not True for sid in entry.get('scope', [])))):
                        raise ValueError("이전 아카이브 작업이 아직 확인되지 않았습니다. 해당 기록은 자동으로 삭제되거나 재생되지 않습니다. 원래 클라이언트를 먼저 확인하세요.")
                    entry['status'] = 'confirmed'
            if old:
                private_json(self.path, entries)
                return dict(old)
            result = {'id': identifier, 'archived': archived, 'status': 'confirmed'}
            if bool(before.get('archived')) == archived:
                return result
            # Validation and fresh runtime checks happen before persisting intent.
            call = dispatch(before)
            scope = list(before.get('_archiveFlags') or {}) if archived else []
            entries[request_id] = {**result, 'status': 'unknown', 'scope': scope}
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            private_json(self.path, entries)
            try:
                call()
            except ArchiveRejected as exc:
                try:
                    after = read()
                except Exception:
                    raise ValueError("아카이브 결과가 확인되지 않았습니다. 원래 채팅을 확인하세요. 이 작업은 반복되지 않습니다.") from exc
                flags = before.get('_archiveFlags')
                if isinstance(flags, dict) and flags and flags == after.get('_archiveFlags'):
                    del entries[request_id]
                    private_json(self.path, entries)
                    raise
                raise ValueError("아카이브 결과가 확인되지 않았습니다. 원래 채팅을 확인하세요. 이 작업은 반복되지 않습니다.") from exc
            except ArchiveNotSent:
                del entries[request_id]
                private_json(self.path, entries)
                raise
            except Exception as exc:
                raise ValueError("아카이브 결과가 확인되지 않았습니다. 원래 채팅을 확인하세요. 이 작업은 반복되지 않습니다.") from exc
            after = read()
            if bool(after.get('archived')) != archived or any((after.get('_archiveFlags') or {}).get(sid) is not True for sid in scope):
                raise ValueError("아카이브 결과가 확인되지 않았습니다. 원래 채팅을 새로 고칩니다. 이 작업은 반복되지 않습니다.")
            entries[request_id] = result
            private_json(self.path, entries)
            return result
