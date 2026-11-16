"""Read-only permission discovery shared by native and bridge-owned chats.

Runtime support is not evidence of a native desktop feature rollout. Never
probe availability by changing a thread or write the desktop's preferences.
"""
import json
import sys
from pathlib import Path


def enabled(host='local'):
    # This compatibility path is local Linux only, never inferred for SSH hosts.
    return sys.platform == 'linux' and host == 'local'


UNKNOWN = "권한 기능을 확인할 수 없습니다. 데스크탑 설정을 확인한 후 이 패널을 다시 여십시오."
RESTRICTED = "이 작업 공간 또는 관리자 정책은 이 권한 모드를 허용하지 않습니다."
FULL_HIDDEN = "Codex 데스크탑 설정에서 전체 액세스 옵션을 활성화한 다음 이 패널을 다시 엽니다."
AUTO_UNKNOWN = "승인 가능 여부가 확인되지 않았습니다. 먼저 데스크탑에서 이 모드를 선택한 다음 이 패널을 다시 엽니다."
AUTO_DISABLED = "현재 Codex 런타임 또는 구성에서는 승인이 비활성화되어 있습니다."
PROFILE_UNAVAILABLE = "이 권한 프로필을 사용할 수 없습니다. 데스크탑에서 Codex를 확인하거나 업데이트하세요."


def read_permission_facts(request, cwd):
    """Return only allowlisted capability facts, never credentials/config dumps."""
    facts = {}
    try:
        config = request('config/read', {'cwd': cwd, 'includeLayers': False})['config']
        features = config.get('features') or {}
        facts['config'] = {'guardian': features.get('guardian_approval'),
                           'reviewer': config.get('approvals_reviewer')}
    except Exception:
        pass
    try:
        requirements = request('configRequirements/read', {})['requirements']
        if requirements is None:
            requirements = {}
        if not isinstance(requirements, dict):
            raise ValueError('Invalid requirements')
        keys = ('allowedApprovalPolicies', 'allowedApprovalsReviewers', 'allowedSandboxModes')
        for key in keys:
            value = requirements.get(key)
            if value is not None and not isinstance(value, list):
                raise ValueError('Invalid requirement list')
        for key in ('allowedPermissionProfiles', 'featureRequirements'):
            value = requirements.get(key)
            if value is not None and not isinstance(value, dict):
                raise ValueError('Invalid requirement map')
        facts['requirements'] = {key: requirements.get(key) for key in
                                 (*keys, 'allowedPermissionProfiles', 'featureRequirements')}
    except Exception:
        pass
    for method, key, params in [('permissionProfile/list', 'profiles', {'cwd': cwd}),
                                ('experimentalFeature/list', 'features', {})]:
        try:
            rows, cursor = [], None
            for _ in range(10):
                result = request(method, {**params, 'limit': 200, 'cursor': cursor})
                page = result['data']
                if not isinstance(page, list) or any(not isinstance(row, dict) for row in page):
                    raise ValueError('Invalid capability page')
                rows.extend(page)
                cursor = result.get('nextCursor')
                if not cursor:
                    break
            else:
                raise ValueError('Incomplete capability list')
            if key == 'profiles':
                if any(not isinstance(row.get('id'), str) or not isinstance(row.get('allowed'), bool) for row in rows):
                    raise ValueError('Invalid permission profile')
                facts[key] = {row['id']: row['allowed'] for row in rows}
            else:
                facts['guardianEnabled'] = any(row.get('name') == 'guardian_approval' and
                                               row.get('enabled') is True for row in rows)
        except Exception:
            pass
    return facts


def desktop_permission_preferences(home, host='local'):
    try:
        state = json.loads((Path(home) / '.codex-global-state.json').read_text(encoding='utf-8'))
        atoms = state.get('electron-persisted-atom-state', {})
        visibility = atoms.get('composer-permission-mode-visibility', {})
        full = visibility if isinstance(visibility, bool) else visibility.get('full-access', True)
        selection = atoms.get('permission-selection-by-host-id:' + host) or {}
        return {'fullAccess': full if isinstance(full, bool) else None,
                'autoReview': selection.get('kind') == 'agent-mode' and
                              selection.get('agentMode') == 'guardian-approvals'}
    except (OSError, ValueError, TypeError, AttributeError):
        return {'fullAccess': None, 'autoReview': False}


def permission_settings(preset, facts):
    reviewers = (facts.get('requirements') or {}).get('allowedApprovalsReviewers')
    reviewer = 'auto_review'
    if reviewers is not None and reviewer not in reviewers and 'guardian_subagent' in reviewers:
        reviewer = 'guardian_subagent'
    profile = ':danger-full-access' if preset == 'full-access' else ':workspace'
    return {'permissions': profile, 'approvalPolicy': 'never' if preset == 'full-access' else 'on-request',
            'approvalsReviewer': reviewer if preset == 'auto-review' else 'user'}


def permission_options(facts, preferences, current, *, native=True):
    options = []
    for preset in ('ask', 'auto-review', 'full-access'):
        settings = permission_settings(preset, facts)
        reason = None
        requirements = facts.get('requirements')
        if requirements is None or 'profiles' not in facts or 'config' not in facts:
            reason = UNKNOWN
        else:
            mode = 'danger-full-access' if preset == 'full-access' else 'workspace-write'
            for key, value in [('allowedApprovalPolicies', settings['approvalPolicy']),
                               ('allowedApprovalsReviewers', settings['approvalsReviewer']),
                               ('allowedSandboxModes', mode)]:
                allowed = requirements.get(key)
                if allowed is not None and value not in allowed:
                    reason = RESTRICTED
            allowed_profiles = requirements.get('allowedPermissionProfiles')
            if allowed_profiles is not None and allowed_profiles.get(settings['permissions']) is not True:
                reason = RESTRICTED
            if facts['profiles'].get(settings['permissions']) is False:
                reason = RESTRICTED
            elif facts['profiles'].get(settings['permissions']) is not True:
                reason = reason or PROFILE_UNAVAILABLE
        if not reason and preset == 'full-access':
            if preferences.get('fullAccess') is False:
                reason = FULL_HIDDEN
            elif preferences.get('fullAccess') is not True:
                reason = UNKNOWN
        if not reason and preset == 'auto-review':
            configured = facts['config'].get('guardian')
            required = (requirements.get('featureRequirements') or {}).get('guardian_approval')
            if configured is False or required is False or facts.get('guardianEnabled') is False:
                reason = AUTO_DISABLED
            elif native:
                evidence = (current == 'auto-review' or preferences.get('autoReview') is True or
                            facts['config'].get('reviewer') in ('auto_review', 'guardian_subagent'))
                if not evidence:
                    reason = AUTO_UNKNOWN
            elif facts.get('guardianEnabled') is not True:
                reason = UNKNOWN
        options.append({'preset': preset, 'available': reason is None, 'reason': reason})
    return {'current': current, 'options': options}


def require_permission(options, preset):
    option = next(row for row in options['options'] if row['preset'] == preset)
    if not option['available']:
        raise ValueError(option['reason'])


def current_mode(state):
    from bridge.features.sessions.model import permission_mode
    return permission_mode(state or {}, legacy_reviewer=True)
