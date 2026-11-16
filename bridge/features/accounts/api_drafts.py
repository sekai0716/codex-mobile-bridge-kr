"""Explicit model-list discovery from an unsaved API draft; never runs inference."""
import re
from urllib.parse import urlsplit

from bridge.features.accounts.accounts import Accounts
from bridge.features.accounts.models import model_ids


FORMATS = {'anthropic-messages', 'openai-chat-completions', 'openai-responses'}


def model_draft(value, *, protocol='openai-responses', fixed_url=None, saved=None):
    if not isinstance(value, dict) or set(value) - {'provider', 'action', 'operation', 'id', 'baseUrl', 'apiKey', 'authScheme', 'apiFormat'}:
        raise ValueError("잘못된 모델 조회 매개변수")
    if protocol not in FORMATS or value.get('apiFormat', protocol) != protocol:
        raise ValueError('지원되는 항목을 선택하세요. API 규약')
    url = Accounts.api_url(value.get('baseUrl', fixed_url or ''))
    if fixed_url and url != fixed_url:
        raise ValueError('이 클라이언트는 공식만 지원합니다. API 주소')
    auth = value.get('authScheme', 'x-api-key' if protocol == 'anthropic-messages' else 'bearer')
    if auth not in ('bearer', 'x-api-key') or protocol != 'anthropic-messages' and auth != 'bearer':
        raise ValueError('API 인증 방법이 잘못되었습니다.')
    key = value.get('apiKey', '')
    if key == '' and value.get('id') and saved:
        previous = saved(value['id'])
        previous_auth = previous.get('authScheme', 'x-api-key' if previous['apiFormat'] == 'anthropic-messages' else 'bearer')
        if (Accounts.api_url(previous['baseUrl']) != url or previous['apiFormat'] != protocol or previous_auth != auth):
            raise ValueError('개정하다 API 주소, 동의사항, 인증방법을 입력하신 후 다시 입력해주세요. API Key')
        key = previous['apiKey']
    if not isinstance(key, str) or not re.fullmatch(r'[\x21-\x7e]{1,8192}', key):
        raise ValueError("유효한 API 키를 입력하세요.")
    headers = None
    if protocol == 'anthropic-messages':
        if not urlsplit(url).path.rstrip('/').endswith('/v1'):
            url += '/v1'
        headers = {**({'Authorization': 'Bearer '+key} if auth == 'bearer' else {'x-api-key': key}),
                   'anthropic-version': '2023-06-01'}
    return {'models': model_ids(url, key, **({'headers': headers} if headers else {}))}
