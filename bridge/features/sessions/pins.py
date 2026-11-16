"""Bridge display preferences, independent of native Codex pins."""
import json
import threading
import uuid
from pathlib import Path
from bridge.app.lifecycle import private_json


class SessionPins:
    def __init__(self, directory, environment):
        self.path = Path(directory) / 'session-pins.json'
        self.environment = environment
        self.lock = threading.RLock()

    def _read(self):
        try:
            value = json.loads(self.path.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return {}
        if not isinstance(value, dict):
            raise ValueError('채팅 최고 기록이 잘못되었습니다.')
        return value

    def identifiers(self):
        with self.lock:
            return tuple(self._read().get(self.environment, []))

    def set(self, identifier, pinned, client_id=None, revision=None):
        if not isinstance(identifier, str) or not identifier or len(identifier) > 512:
            raise ValueError("잘못된 세션 식별자")
        if (client_id is None) != (revision is None):
            raise ValueError('채팅 상단 동기화 플래그가 잘못되었습니다.')
        if client_id is not None:
            if not isinstance(client_id, str):
                raise ValueError('채팅 상단 동기화 플래그가 잘못되었습니다.')
            client_id = str(uuid.UUID(client_id))
            if not isinstance(revision, int) or isinstance(revision, bool) or not 0 < revision <= 9007199254740991:
                raise ValueError('채팅 핀의 동기화된 버전이 잘못되었습니다.')
        if not isinstance(pinned, bool):
            raise ValueError('채팅 상단 스위치가 잘못되었습니다.')
        with self.lock:
            value = self._read()
            identifiers = set(value.get(self.environment, []))
            if client_id is not None:
                versions = value.setdefault('_clientRevisions', {}).setdefault(self.environment, {}).setdefault(identifier, {})
                previous = versions.get(client_id, 0)
                if revision <= previous:
                    return {'id': identifier, 'bridgePinned': identifier in identifiers,
                            'clientId': client_id, 'revision': previous}
                versions[client_id] = revision
            if pinned:
                identifiers.add(identifier)
            else:
                identifiers.discard(identifier)
            value[self.environment] = sorted(identifiers)
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            private_json(self.path, value)
        return {'id': identifier, 'bridgePinned': pinned,
                **({'clientId': client_id, 'revision': revision} if client_id is not None else {})}
