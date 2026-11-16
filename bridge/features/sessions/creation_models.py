"""Creation-time model choices use the same account-bound catalogs as chat settings."""
import re


FIELDS = ('model', 'effort', 'modelCatalogIdentity', 'manualModel', 'manualEffort')


def requested(value):
    return {key: value[key] for key in FIELDS if key in value}


def intent(value):
    # Catalog/environment revisions are preconditions, not a new user request.
    # Refreshing them must not replay a creation with an uncertain receipt.
    return {key: item for key, item in value.items() if key not in ('modelCatalogIdentity', 'environment')}


def validate(value, catalog):
    selection = requested(value)
    if not selection:
        return {}  # Existing callers retain the original client's default.
    identity = (catalog.get('cache') or {}).get('identity')
    if not identity or selection.get('modelCatalogIdentity') != identity:
        raise ValueError('계정이나 운영 환경이 변경되었습니다. 새 채팅의 모델 목록을 새로고침해주세요.')
    model = selection.get('model')
    if not isinstance(model, str) or not re.fullmatch(r'[^\s\x00-\x1f\x7f]{1,300}', model):
        raise ValueError('먼저 새 세션의 모델을 선택하세요.')
    capabilities = catalog.get('capabilities') or {}
    rows = catalog.get('models') or []
    selected = next((row for row in rows if row.get('id') == model), None)
    if selected is None and not (selection.get('manualModel') is True and capabilities.get('manualModels') is True):
        raise ValueError('선택한 모델은 더 이상 사용할 수 없습니다. 모델 목록을 새로 고친 후 다시 선택하세요.')
    effort = selection.get('effort')
    if effort is not None:
        if selected and selected.get('supportsEffort') is False:
            raise ValueError('선택한 모델은 반사 강도 설정을 제공하지 않습니다.')
        if not isinstance(effort, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', effort):
            raise ValueError('유효한 사고 강도를 선택하십시오')
        allowed = (selected or {}).get('efforts') or []
        if effort not in allowed and not (selection.get('manualEffort') is True and capabilities.get('manualEffort') is True):
            raise ValueError('선택한 모델은 이 사고 강도를 지원하지 않습니다. 다시 선택하세요.')
    elif selected and selected.get('efforts'):
        raise ValueError('먼저 새 세션의 사고 강도를 선택하세요.')
    return {key: val for key, val in selection.items() if key != 'modelCatalogIdentity'}
