"""Project native activity records into read-only chat content."""
from copy import deepcopy
import json
import ntpath
import re
from urllib.parse import urlsplit


def records(value):
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def lines(*values):
    return '\n'.join(value for value in values if isinstance(value, str) and value.strip())


def readable(value):
    if isinstance(value, dict):
        return lines(*(f'{key}: {readable(part)}' for key, part in value.items() if part is not None))
    if isinstance(value, list):
        return lines(*(readable(part) for part in value))
    return '' if value is None else str(value)


def web_url(value):
    if not isinstance(value, str) or len(value) > 8192 or re.search(r'[\s\x00-\x1f\\]', value):
        return None
    try:
        url = urlsplit(value)
        if url.scheme in ('https', 'http') and url.hostname and url.username is None and url.password is None:
            return value
    except ValueError:
        pass
    return None


def search_activity(item):
    action = item.get('action')
    action = action if isinstance(action, dict) else {}
    operation = action.get('type')
    title = {'openPage': 'Opened web page', 'findInPage': 'Searched within page'}.get(operation, 'Searched the web')
    queries = action.get('queries')
    queries = [item.get('query'), action.get('query'), *(queries if isinstance(queries, list) else []), action.get('pattern')]
    parts = list(dict.fromkeys(query for query in queries if isinstance(query, str) and query.strip()))
    seen = set()
    for source in [{'url': action.get('url')}, *records(item.get('results'))]:
        url = web_url(source.get('url'))
        if url and url not in seen:
            seen.add(url)
            parts.append(lines(source.get('title'), url))
    return title, '\n\n'.join(parts)


def command_info(item):
    info = []
    operations = []
    for action in records(item.get('commandActions')):
        kind = action.get('type')
        if kind == 'read':
            path = action.get('path') or action.get('name')
            skill = isinstance(path, str) and ntpath.basename(path) == 'SKILL.md'
            operations.append('readSkill' if skill else 'read')
            info.append(('Read file', path))
        elif kind == 'listFiles':
            operations.append('listFiles')
            info.append(('Listed files', action.get('path')))
        elif kind == 'search':
            operations.append('search')
            info.append(('Searched files', lines(action.get('query'), action.get('path'))))
        else:
            operations.append('command')
    if isinstance(item.get('cwd'), str) and item['cwd']:
        info.append(('Working directory', item['cwd']))
    for key, label, unit in [('durationMs', 'Duration', ' ms'), ('exitCode', 'Exit code', '')]:
        if type(item.get(key)) is int:
            info.append((label, f'{item[key]}{unit}'))
    return ([(label, value) for label, value in info if isinstance(value, str) and value],
            list(dict.fromkeys(operations)))


def generated_image_path(item):
    path = item.get('savedPath')
    if not isinstance(path, str) or not path or '\x00' in path or path.startswith(('//', '\\\\')):
        return None
    if path.startswith('/') or ntpath.splitdrive(path)[0] and ntpath.isabs(path):
        return path
    return None


def memory_sources(value):
    if not isinstance(value, dict):
        return ''
    citations = []
    for entry in records(value.get('entries')):
        path = entry.get('path')
        if not isinstance(path, str) or not path:
            continue
        start, end = entry.get('lineStart', entry.get('line_start')), entry.get('lineEnd', entry.get('line_end'))
        if type(start) is int:
            path += ':' + str(start)
            if type(end) is int and end != start:
                path += '–' + str(end)
        citations.append(lines(path, entry.get('note')))
    ids = value.get('threadIds', value.get('thread_ids'))
    return lines(*citations, *(ids if isinstance(ids, list) else []))


def plan_steps(item):
    marks = {'pending': '☐', 'inProgress': '◐', 'in_progress': '◐', 'completed': '☑'}
    return lines(item.get('explanation'), *(f"{marks.get(step.get('status'), '•')} {step['step']}"
                 for step in records(item.get('plan')) if isinstance(step.get('step'), str) and step['step'].strip()))


def question_answers(item):
    answers = item.get('answers')
    answers = answers if isinstance(answers, dict) else {}
    return '\n\n'.join(lines(question.get('question') or question.get('header'), readable(answers.get(question.get('id'))))
                        for question in records(item.get('questions')))


def native_activity(item):
    kind = item.get('type')
    if kind == 'webSearch':
        return search_activity(item)
    if kind in ('modelChanged', 'modelRerouted'):
        change = ' → '.join(x for x in (item.get('fromModel'), item.get('toModel')) if isinstance(x, str) and x)
        return ('Model changed' if kind == 'modelChanged' else 'Model rerouted', lines(change, item.get('reason')))
    if kind == 'todo-list':
        return 'Plan progress', plan_steps(item)
    if kind == 'userInputResponse':
        return 'Questions and answers', question_answers(item)
    if kind == 'permissionRequest':
        return 'Permission request', lines(item.get('reason'), readable(item.get('permissions')), readable(item.get('response')))
    if kind == 'mcpServerElicitation':
        return 'App request', lines(readable(item.get('params')), readable(item.get('response') or item.get('action')))
    if kind == 'worktreeInit':
        return 'Worktree setup', readable({k: v for k, v in item.items() if k not in ('type', 'id', 'timestamp')})
    fields = {
        'plan': ('Proposed plan', 'text'),
        'forkedFromConversation': ('Forked from chat', 'sourceConversationId'),
        'remoteTaskCreated': ('Remote task created', 'taskId'),
        'personalityChanged': ('Personality changed', 'personality'),
        'autoReviewInterruptionWarning': ('Automatic review interrupted', None),
        'steered': ('Steered', None),
    }
    if kind in fields:
        title, key = fields[kind]
        return title, readable(item.get(key))
    return None


def automation_result(item):
    if item.get('tool') != 'automation_update' or item.get('status') != 'completed':
        return None
    content = item.get('contentItems')
    if item.get('type') == 'mcpToolCall':
        result = item.get('result')
        if item.get('server') != 'codex_app' or not isinstance(result, dict) or result.get('isError') or item.get('error'):
            return None
        content = result.get('content')
    elif item.get('success') is not True:
        return None
    args = item.get('arguments')
    if not isinstance(args, dict) or not isinstance(args.get('mode'), str):
        return None
    result = {}
    for part in records(content):
        if part.get('type') not in ('text', 'inputText') or not isinstance(part.get('text'), str):
            continue
        try:
            data = json.loads(part['text'])
        except ValueError:
            continue
        if isinstance(data, dict):
            result = data
            break
    snapshot = result.get('snapshot')
    values = {**args, **(snapshot if isinstance(snapshot, dict) and result.get('mode') == 'delete' else {}), **result}
    return lines(*(readable(values.get(key)) for key in ('name', 'mode', 'rrule', 'automationId', 'id', 'deleteStatus')))


def retry_attempt(item):
    if item.get('type') == 'error' and item.get('willRetry') is True and isinstance(item.get('message'), str):
        return re.fullmatch(r'Reconnecting(?:…|\.{3})?\s+(\d+)\s*/\s*(\d+)\s*(?:…|\.{3})?', item['message'].strip(), re.I)
    return None


def function_message(item):
    """Only delegation and automation outputs are user-facing in the desktop projection."""
    output = item.get('output')
    if not isinstance(output, str):
        return ''
    namespace, name = item.get('namespace'), item.get('name')
    if namespace == 'codex_app' and name == 'automation_update':
        if output.startswith('Automation: ') and '\nAutomation ID: ' in output:
            return output
        match = re.fullmatch(r'<heartbeat>.*?<current_time_iso>.*?</current_time_iso>.*?<instructions>(.*?)</instructions>.*?</heartbeat>', output.strip(), re.S)
        return match.group(1).strip() if match else ''
    if (namespace == 'codex_app' and name in ('create_thread', 'send_message_to_thread', 'handoff_thread')
            or namespace == 'cloud_threads' and name == 'send_message'):
        match = re.fullmatch(r'<codex_delegation>\s*<source_thread_id>[^<]*</source_thread_id>\s*(?:<source_orbit_id>[^<]*</source_orbit_id>\s*)?<input>(.*?)</input>\s*</codex_delegation>', output.strip(), re.S)
        if match:
            content = match.group(1).strip()
            if '<' in content:
                wrapped = re.fullmatch(r'<codex_delegation_content version="1">\s*<source_orbit_id>[^<]*</source_orbit_id>\s*<task>([^<]*)</task>\s*</codex_delegation_content>', content)
                content = wrapped.group(1) if wrapped else ''
            return content.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    return ''


def visible_items(native, turn):
    items = []
    for item in native:
        kind = item.get('type')
        if kind in ('strictReviewNotice', 'sleep', 'enteredReviewMode', 'exitedReviewMode'):
            continue
        if kind == 'hookPrompt' and not any(isinstance(f.get('text'), str) and f['text'].strip() for f in records(item.get('fragments'))):
            continue
        if kind == 'functionCallOutput' and not function_message(item):
            continue
        if retry_attempt(item) and items and retry_attempt(items[-1]):
            items[-1] = {**item, 'id': items[-1].get('id')}
        else:
            items.append(item)
    if turn.get('willRetry') is True and isinstance(turn.get('error'), dict):
        item = {**turn['error'], 'type': 'error', 'willRetry': True, 'id': 'model-retry-' + str(turn.get('turnId'))}
        if not items or items[-1].get('type') != 'error' or not items[-1].get('willRetry'):
            items.append(item)
    return items


def update_turn_plan(state, params):
    plan = params.get('plan')
    if not isinstance(plan, list):
        return
    # Clone the notification payload once; the published snapshot must not alias caller-owned steps.
    state['turnPlan'] = deepcopy(plan)
    turn = next((turn for turn in state.get('turns') or [] if turn.get('turnId') == params.get('turnId')), None)
    if not turn or turn.get('status') != 'inProgress' or not isinstance(turn.get('items'), list):
        return
    entry = next((item for item in reversed(turn['items']) if item.get('type') == 'todo-list'), None)
    if entry is None:
        entry = {'type': 'todo-list', 'id': 'turn-plan-' + str(turn['turnId'])}
        turn['items'].append(entry)
    entry.update(plan=state['turnPlan'], explanation=params.get('explanation'))


def preserve_turn_plan(turn_id, previous, incoming):
    if not previous or not isinstance(incoming, list) or any(i.get('type') == 'todo-list' for i in incoming):
        return incoming
    plan_id = 'turn-plan-' + str(turn_id)
    for index, item in enumerate(previous):
        if item.get('type') == 'todo-list' and item.get('id') == plan_id:
            positions = {entry['id']: n for n, entry in enumerate(incoming) if isinstance(entry.get('id'), str)}
            pos = next((positions[entry['id']] + 1 for entry in reversed(previous[:index]) if entry.get('id') in positions), 0)
            return [*incoming[:pos], item.copy(), *incoming[pos:]]
    return incoming
