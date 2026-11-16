"""Persist native sidebar write intent before dispatch; uncertain writes are read-only."""
import json
import threading
import uuid
from pathlib import Path

from bridge.features.sessions.organization import OrganizationNotSent, validate_change
from bridge.features.sessions.create import CreationUnavailable


class OrganizationCommands:
    def __init__(self, directory, save):
        self.path = Path(directory) / 'session-organization.json'
        self.lock = threading.RLock()
        self.save = save

    def native_memberships(self):
        """Explicit native project writes supersede old desktop migration assignments."""
        with self.lock:
            entries = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
            return {entry['id'] for entry in entries.values()
                    if entry['change']['kind'] == 'project' and entry['status'] == 'confirmed'}

    def perform(self, identifier, change, read, dispatch):
        uuid.UUID(identifier)
        if not isinstance(change, dict) or set(change) != {'id', 'kind', 'targetId', 'expectedId'}:
            raise ValueError("잘못된 채팅 조직 설정입니다.")
        request_id = change['id']
        if not isinstance(request_id, str):
            raise ValueError("잘못된 채팅 조직 설정입니다.")
        uuid.UUID(request_id)
        mutation = {key: value for key, value in change.items() if key != 'id'}
        with self.lock:
            entries = json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {}
            old = entries.get(request_id)
            if old and (old['id'] != identifier or old['change'] != mutation):
                raise ValueError('동일한 요청 ID를 다른 작업에 사용할 수 없습니다.')
            snapshot = read()
            for entry in entries.values():
                if entry['id'] == identifier and entry['status'] == 'unknown':
                    field = entry['change']['kind'] + 'Id'
                    if (snapshot.get(field) != entry['change']['targetId'] or
                            snapshot.get('identity') != entry['identity']):
                        raise ValueError("이전 조직 운영에는 아직 확인이 필요합니다. 원래 클라이언트를 확인하십시오. 다시 제출되지 않습니다.")
                    entry['status'] = 'confirmed'
            if old:
                self.save(self.path, entries)
                return {**snapshot, 'status': old['status']}
            validate_change(snapshot, mutation)
            if snapshot[mutation['kind'] + 'Id'] == mutation['targetId']:
                return snapshot
            entries[request_id] = {'id': identifier, 'change': mutation,
                                   'identity': snapshot['identity'], 'status': 'unknown'}
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            self.save(self.path, entries)
            try:
                result = dispatch(mutation)
                if (result.get('status') != 'confirmed' or
                        result.get(mutation['kind'] + 'Id') != mutation['targetId'] or
                        result.get('identity') != snapshot['identity']):
                    raise ValueError("네이티브 조직 결과를 확인해야 합니다. 채팅 목록을 새로 고칩니다.")
            except (OrganizationNotSent, CreationUnavailable):
                del entries[request_id]
                self.save(self.path, entries)
                raise
            except Exception as exc:
                raise ValueError("네이티브 조직 결과를 확인해야 합니다. 원래 클라이언트를 확인하십시오. 이 작업은 다시 제출되지 않습니다.") from exc
            entries[request_id]['status'] = 'confirmed'
            self.save(self.path, entries)
            return result
