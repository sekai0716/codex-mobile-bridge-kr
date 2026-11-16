"""Read-only model discovery for an OpenAI-compatible API."""
import json
import re
import unicodedata
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from bridge.features.auth.tls import client_context


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the selected provider's credentials to another endpoint.
        return None


def valid_model_id(value):
    """Accept provider model IDs without allowing whitespace or control characters."""
    return (isinstance(value, str) and 1 <= len(value) <= 200
            and all(not character.isspace() and not unicodedata.category(character).startswith('C')
                    for character in value))


def model_catalog(base_url, key, *, headers=None, query_params=None):
    url = base_url.rstrip('/')+'/models'
    if query_params:
        url += '?' + urlencode(query_params)
    request_headers = {
        **(headers if headers is not None else ({'Authorization': 'Bearer '+key} if key else {})), 'Accept': 'application/json',
        'User-Agent': 'Codex-Mobile-Bridge'}
    for name, value in request_headers.items():
        if (not isinstance(name, str) or not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", name)
                or not isinstance(value, str) or '\r' in value or '\n' in value):
            raise ValueError('API 인증 요청 헤더 형식이 잘못되었습니다. 액세스 구성을 확인하세요.')
        try:
            value.encode('latin-1')
        except UnicodeError:
            raise ValueError('API 인증 요청 헤더 형식이 잘못되었습니다. 액세스 구성을 확인하세요.') from None
    request = Request(url, headers=request_headers)
    opener = build_opener(NoRedirect(), HTTPSHandler(context=client_context()))
    try:
        with opener.open(request, timeout=12) as response:
            payload = response.read(1024*1024+1)
        if len(payload) > 1024*1024:
            raise ValueError("모델 목록이 너무 큽니다. 모델 ID를 수동으로 입력하세요.")
        value = json.loads(payload)
        native = isinstance(value, dict) and 'data' not in value and 'models' in value
        rows = value.get('models' if native else 'data') if isinstance(value, dict) else (value if isinstance(value, list) else None)
        if not isinstance(rows, list):
            raise ValueError("공급자가 지원되지 않는 모델 목록을 반환했습니다. 모델 ID를 수동으로 입력하세요.")
        field = 'slug' if native else 'id'
        result = {}
        for row in rows:
            if (not isinstance(row, dict) or row.get('hidden') or row.get('visibility') == 'hide'
                    or row.get('lifecycle') == 'retired'
                    or not valid_model_id(row.get(field))):
                continue
            identifier = row[field]
            levels = row.get('supportedReasoningEfforts', row.get('supported_reasoning_levels', []))
            efforts = []
            for level in levels if isinstance(levels, list) else []:
                effort = level.get('reasoningEffort', level.get('effort')) if isinstance(level, dict) else level
                if isinstance(effort, str) and effort in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra') and effort not in efforts:
                    efforts.append(effort)
            if 'supportedReasoningEfforts' not in row and 'supported_reasoning_levels' not in row:
                capabilities = row.get('capabilities')
                native = capabilities.get('effort') if isinstance(capabilities, dict) else None
                if isinstance(native, dict) and native.get('supported') is True:
                    efforts = [level for level in ('low', 'medium', 'high', 'xhigh', 'max')
                               if isinstance(native.get(level), dict) and native[level].get('supported') is True]
            default = row.get('defaultReasoningEffort', row.get('default_reasoning_level'))
            name = row.get('displayName') or row.get('display_name') or row.get('name')
            result.setdefault(identifier, {'id': identifier, 'name': name if isinstance(name, str) else identifier,
                'efforts': efforts, 'defaultEffort': default if default in efforts else None})
        if not result:
            raise ValueError("공급자가 사용 가능한 모델을 반환하지 않았습니다. 모델 ID를 수동으로 입력하세요.")
        return [result[key] for key in sorted(result)]
    except HTTPError as exc:
        exc.close()
        if exc.code in (401, 403):
            raise ValueError("액세스가 거부되었습니다. API 키 및 모델 목록 권한을 확인하세요.") from None
        if 300 <= exc.code < 400:
            raise ValueError("공급자에게 리디렉션이 필요합니다. 마지막 API URL를 입력하고 다시 시도하세요.") from None
        raise ValueError("모델 목록을 확인할 수 없습니다. API URL를 확인하거나 ID 모델을 수동으로 입력하세요.") from None
    except (URLError, OSError, TimeoutError, HTTPException):
        raise ValueError("공급자에게 연결할 수 없습니다. API URL, 네트워크 및 인증서를 확인하세요.") from None
    except (json.JSONDecodeError, UnicodeError):
        raise ValueError("공급자가 지원되지 않는 모델 목록을 반환했습니다. 모델 ID를 수동으로 입력하세요.") from None


def model_ids(base_url, key, *, headers=None):
    return [row['id'] for row in model_catalog(base_url, key, headers=headers)]
