"""ZCode's versioned personal provider overlay, applied by the account transaction."""
import copy
import re

API_FORMATS = (
    {'value': 'anthropic-messages', 'label': 'Anthropic Messages'},
    {'value': 'openai-chat-completions', 'label': 'OpenAI Chat Completions'},
    {'value': 'openai-responses', 'label': 'OpenAI Responses'},
)
FILE = 'provider_config.json'


def provider(value, identifier, name, url, previous=None):
    if set(value) - {'operation', 'action', 'provider', 'id', 'name', 'baseUrl', 'apiKey', 'apiFormat', 'models'}:
        raise ValueError('ZCode API 구성에 지원되지 않는 필드가 포함되어 있습니다.')
    api_format = value.get('apiFormat')
    if api_format not in {row['value'] for row in API_FORMATS}:
        raise ValueError('선택해주세요 ZCode 지원됨 API 규약')
    key = value.get('apiKey', '')
    if key == '' and previous:
        key = previous['config']['access']['apiKey']
    if not isinstance(key, str) or not re.fullmatch(r'[\x21-\x7e]{1,8192}', key):
        raise ValueError("유효한 API 키를 입력하세요.")
    models = value.get('models')
    if (not isinstance(models, list) or not 1 <= len(models) <= 200 or any(
            not isinstance(model, str) or not re.fullmatch(r'[^\s\x00-\x1f\x7f]{1,200}', model) for model in models)):
        raise ValueError("지원되는 모델 ID를 한 줄에 하나씩 최대 200개까지 입력하세요.")
    models = list(dict.fromkeys(models))
    return {'providerId': previous['providerId'] if previous else 'cmb-api:'+identifier,
            'providerName': name, 'enabled': True,
            'config': {'group': 'standard-personal', 'access': {'type': 'api-key', 'apiKey': key},
                       'api': {'type': api_format, 'baseUrl': url},
                       'personalModelIds': models, 'modelOrder': models}}


def rules(value):
    """Refuse unknown/corrupt containers; never replace them with an empty config."""
    try:
        config = value['config']
        providers = config['providerConfigRules']['providerRules']
        models = config['modelConfigRules']
        if (type(value['schemaVersion']) is not int or value['schemaVersion'] != 1
                or not isinstance(providers, list) or any(not isinstance(row, dict) or
                    not isinstance(row.get('providerId'), str) or not isinstance(row.get('config'), dict) for row in providers)
                or len({row['providerId'] for row in providers}) != len(providers)
                or not isinstance(models['providerModelRules'], list)
                or not isinstance(models['manualProviderModelRules'], list)
                or any(not isinstance(row, dict) or not isinstance(row.get('providerId'), str)
                       or not isinstance(row.get('modelId'), str) or not isinstance(row.get('config'), dict)
                       for name in ('providerModelRules', 'manualProviderModelRules') for row in models[name])
                or 'providerOrder' in config and (not isinstance(config['providerOrder'], list) or
                    any(not isinstance(item, str) for item in config['providerOrder']))):
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise ValueError('ZCode 네이티브 API 구성 형식을 인식할 수 없습니다. 먼저 App 전체 구성 초기화') from None
    return providers


def matches(saved, actual):
    if not actual or actual.get('enabled') is False:
        return False
    expected, current = saved['config'], actual.get('config', {})
    if any(not isinstance(current.get(key) or {}, dict) for key in ('api', 'access')):
        return False
    return (current.get('group') == 'standard-personal' and
            current.get('personalModelIds') == expected['personalModelIds'] and
            all((current.get('api') or {}).get(key) == expected['api'][key] for key in ('type', 'baseUrl')) and
            all((current.get('access') or {}).get(key) == expected['access'][key] for key in ('type', 'apiKey')))


def apply(value, saved):
    rules(value)
    result = copy.deepcopy(value)
    target = next((row for row in result['config']['providerConfigRules']['providerRules']
                   if row['providerId'] == saved['providerId']), None)
    if target is None:
        target = copy.deepcopy(saved)
        result['config']['providerConfigRules']['providerRules'].append(target)
    else:
        if target['config'].get('group') != 'standard-personal':
            raise ValueError('이 Provider 이미 원작에서 App 다른 유형으로 변경 후 다시 저장해주세요 API 연결')
        if any(not isinstance(target['config'].get(key) or {}, dict) for key in ('api', 'access')):
            raise ValueError('ZCode 네이티브 API 구성 형식을 인식할 수 없습니다. 먼저 App 전체 구성 초기화')
        # Change only the fields exposed by the editor. Preserve native headers,
        # model properties and all other providers, OAuth state and default model.
        target.update(providerName=saved['providerName'], enabled=True)
        for key in ('access', 'api'):
            target['config'][key] = {**(target['config'].get(key) or {}), **saved['config'][key]}
        for key in ('personalModelIds', 'modelOrder'):
            target['config'][key] = list(saved['config'][key])
    config = result['config']
    if 'providerOrder' in config and saved['providerId'] not in config['providerOrder']:
        config['providerOrder'].append(saved['providerId'])
    model_rules = config['modelConfigRules']
    selected = set(saved['config']['personalModelIds'])
    for name in ('providerModelRules', 'manualProviderModelRules'):
        model_rules[name] = [row for row in model_rules[name]
                            if row.get('providerId') != saved['providerId'] or row.get('modelId') in selected]
    configured = {row.get('modelId') for name in ('providerModelRules', 'manualProviderModelRules')
                  for row in model_rules[name] if row.get('providerId') == saved['providerId']}
    model_rules['providerModelRules'].extend({'providerId': saved['providerId'], 'modelId': model,
                                            'config': {'enabled': True}}
                                           for model in saved['config']['personalModelIds'] if model not in configured)
    return result
