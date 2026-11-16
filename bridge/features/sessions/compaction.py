"""Durable receipts for explicitly requested native context maintenance."""
import json
import threading
import uuid
from pathlib import Path


class CompactCommands:
    def __init__(self, directory, save):
        self.path = Path(directory) / 'session-compactions.json'
        self.save = save
        self.lock = threading.RLock()

    def perform(self, session_id, request_id, prepare):
        uuid.UUID(session_id)
        uuid.UUID(request_id)
        with self.lock:
            entries = json.loads(self.path.read_text('utf-8')) if self.path.exists() else {}
            prior = entries.get(request_id)
            if prior:
                if prior['sessionId'] != session_id:
                    raise ValueError('동일한 요청 ID를 다른 세션에서 사용할 수 없습니다.')
                return dict(prior)
            if any(row['sessionId'] == session_id and row['status'] == 'unknown' for row in entries.values()):
                raise ValueError('이전에 압축 결과가 확인되지 않았습니다. 먼저 원본 클라이언트를 확인하세요. 중복 제출은 되지 않습니다.')
            # Fresh native idle/identity checks precede the durable write intent.
            dispatch = prepare()
            receipt = {'id': request_id, 'sessionId': session_id, 'status': 'unknown',
                       'message': '압축 결과는 아직 확인되지 않았습니다. 원본 세션을 확인하세요. 자동으로 다시 제출되지는 않습니다.'}
            entries[request_id] = receipt
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            self.save(self.path, entries)
            try:
                dispatch()
            except Exception:
                return dict(receipt)
            receipt.update(status='accepted', message="컨텍스트 압축이 제출되었습니다.")
            self.save(self.path, entries)
            return dict(receipt)
