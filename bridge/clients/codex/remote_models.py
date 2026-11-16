"""Standalone SSH worker for the joined native Codex CLI model catalog.

Catalog, CatalogError and read_daemon_environment are supplied by the injected
source bundle. The response contains only public model metadata and digests.
"""
import hashlib
import json
import os
import sys
from pathlib import Path


REMOTE_MODEL_ERROR = '확인할 수 없습니다 SSH 네이티브 CLI 데몬의 시작 환경을 다시 연결한 후 모델을 새로 고치십시오.'
REMOTE_MODEL_CHANGED = 'SSH 네이티브 CLI 데몬 프로세스가 변경되었습니다. 다시 연결한 후 모델을 새로고침하세요.'


def _remote_executable(home):
    executable = Catalog.find_ssh_runtime(home)
    if executable:
        return executable
    raise ValueError(REMOTE_MODEL_ERROR)


def _environment_snapshot(home, cwd, provider, config, account):
    if sys.platform not in ('linux', 'darwin'):
        raise ValueError('SSH 네이티브 CLI 모델 쿼리는 현재 이 시스템을 지원하지 않습니다.')
    if not isinstance(home, str) or not Path(home).is_absolute() or not isinstance(cwd, str) or not Path(cwd).is_absolute():
        raise ValueError(REMOTE_MODEL_ERROR)
    if not isinstance(config, dict) or not isinstance(account, dict) or not isinstance(provider, str) or not provider:
        raise ValueError(REMOTE_MODEL_ERROR)
    profile = (config.get('profiles') or {}).get(config.get('profile')) or {}
    effective = {**config, **profile}
    definition = (effective.get('model_providers') or {}).get(provider) or {}
    names = {name for name in (definition.get('env_key'), *(definition.get('env_http_headers') or {}).values())
             if isinstance(name, str) and name}
    if (provider == 'openai' and
            not effective.get('openai_base_url') and not definition.get('base_url')):
        names.add('OPENAI_BASE_URL')
    if (not definition.get('env_key') and not definition.get('experimental_bearer_token') and
            (definition.get('requires_openai_auth') or provider == 'openai' and
             not definition.get('http_headers') and not definition.get('env_http_headers'))):
        names.add('OPENAI_API_KEY')
    try:
        auth_bytes = (Path(home) / 'auth.json').read_bytes()
        auth_hash = hashlib.sha256(auth_bytes).hexdigest()
    except OSError:
        auth_bytes = b''
        auth_hash = None
    if 'OPENAI_API_KEY' in names:
        try:
            if json.loads(auth_bytes).get('OPENAI_API_KEY'):
                names.discard('OPENAI_API_KEY')
        except (ValueError, AttributeError, TypeError):
            pass
    environment, process = read_daemon_environment(home, _remote_executable(home), names) if names else ({}, None)
    parts = [str(Path(home).resolve()), str(Path(cwd).resolve()), provider, config, account, auth_hash,
             {name: hashlib.sha256(value.encode()).hexdigest() for name, value in sorted(environment.items())},
             process]
    identity = hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()
    return environment, identity


def remote_model_worker(value):
    """Read only the selected daemon environment; never return its values."""
    operation = value.get('operation')
    if operation not in ('identity', 'models'):
        return {'error': '알 수 없는 모델 디렉터리 작업'}
    if sys.platform not in ('linux', 'darwin'):
        return {'error': 'SSH 네이티브 CLI 모델 쿼리는 현재 이 시스템을 지원하지 않습니다.'}
    home, cwd, provider = value.get('home'), value.get('cwd'), value.get('provider')
    config, account = value.get('config'), value.get('account') or {}
    try:
        environment, identity = _environment_snapshot(home, cwd, provider, config, account)
    except (OSError, ValueError):
        return {'error': REMOTE_MODEL_ERROR}
    if operation == 'identity':
        return {'identity': identity}
    native = value.get('nativeModels') or []
    if not isinstance(native, list):
        return {'error': 'CLI 모델 메타데이터 형식이 잘못되었습니다.'}

    def request(method, params):
        if method == 'config/read':
            return {'config': config}
        if method == 'account/read':
            return {'account': account}
        if method == 'model/list':
            return {'data': native}
        raise CatalogError('CLI 모델 디렉터리는 읽기 전용 요청만 허용합니다.')

    try:
        reader = Catalog(home, _remote_executable(home), allow_background_refresh=False)
        result = reader.read_models(request, cwd, provider, metadata_request=request, environment=environment)
        if result.get('modelSource') != 'api':
            return {'error': '현재 네이티브 CLI 액세스가 불가능합니다. API 모델 디렉토리입니다. 모델을 수동으로 입력하세요. ID'}
        _, after = _environment_snapshot(home, cwd, provider, config, account)
        if identity != after:
            return {'error': REMOTE_MODEL_CHANGED}
        models = [{'id': item['model'], 'name': item.get('displayName') or item['model'],
                   'description': item.get('description', ''),
                   'efforts': [level['reasoningEffort'] for level in item.get('supportedReasoningEfforts') or []],
                   'defaultEffort': item.get('defaultReasoningEffort'), 'isDefault': False,
                   'fastTier': None, 'defaultServiceTier': None}
                  for item in result.get('models') or [] if isinstance(item, dict) and item.get('model')]
        return {'identity': identity, 'models': models, 'modelSource': 'api',
                'modelError': result.get('modelError')}
    except (OSError, ValueError, CatalogError, KeyError, TypeError):
        return {'error': REMOTE_MODEL_ERROR}
