"""Lazy, session-scoped previews of images evidenced by native history.

Adapters own native reference interpretation. No paths, URLs or image bytes
from a history row are sent to the browser; loading never activates a session.
"""
import base64
import hashlib
import json
import threading
from collections import OrderedDict

from bridge.features.workspace.uploads import MAX_FILE, image_type


class HistoryImages:
    def __init__(self, max_entries=4096):
        self.references = OrderedDict()
        self.max_entries = max_entries
        self.lock = threading.Lock()

    def bind(self, provider, sid, messages):
        for message in messages:
            for image in message.get('attachments', []):
                source = image.pop('_nativeImage', None)
                if not isinstance(source, dict):
                    continue
                encoded = json.dumps([provider, sid, source], sort_keys=True, separators=(',', ':'))
                if len(encoded) > 4096:
                    continue
                identifier = hashlib.sha256(encoded.encode()).hexdigest()
                with self.lock:
                    self.references[identifier] = (provider, sid, source)
                    self.references.move_to_end(identifier)
                    while len(self.references) > self.max_entries:
                        self.references.popitem(last=False)
                image['desktopId'] = identifier

    def preview(self, provider, sid, identifier, load):
        with self.lock:
            reference = self.references.get(identifier)
            if reference is None or reference[:2] != (provider, sid):
                raise ValueError('이미지 참조가 만료되었습니다. 채팅을 새로 고치고 다시 시도해 주세요.')
            self.references.move_to_end(identifier)
            source = dict(reference[2])
        # Revalidate membership in native history on every load, including after
        # a profile switch or message deletion. Cached identifiers grant no access.
        value = load(source)
        if not isinstance(value, dict):
            raise ValueError('네이티브 이미지 응답이 잘못되었습니다.')
        data, mime = value.get('data'), value.get('mediaType')
        if not isinstance(data, str) or len(data) > ((MAX_FILE + 2) // 3) * 4:
            raise ValueError('이미지가 미리보기 크기 제한을 초과했습니다.')
        try:
            raw = base64.b64decode(data, validate=True)
        except ValueError:
            raise ValueError('원본 이미지 콘텐츠가 잘못되었습니다.') from None
        if not 0 < len(raw) <= MAX_FILE or image_type(raw) != mime or mime is None:
            raise ValueError('기본 이미지 형식은 미리보기를 지원하지 않습니다.')
        return {'previewBytes': raw, 'previewMime': mime,
                'previewSha256': hashlib.sha256(raw).hexdigest(), 'name': 'image'}, 'native'
