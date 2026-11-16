"""Read-only path suggestions for a terminal draft. Also embedded in the SSH helper."""
import ntpath
import os
import re
import shlex

MAX_DRAFT = 4096
MAX_SCAN = 2000
MAX_CANDIDATES = 80


def _offset(text, units):
    if type(units) is not int or units < 0: raise ValueError('잘못된 커서 위치')
    total = 0
    for index, char in enumerate(text):
        if total == units: return index
        total += 2 if ord(char) > 0xffff else 1
        if total > units: raise ValueError("커서가 문자 안에 있습니다.")
    if total == units: return len(text)
    raise ValueError('잘못된 커서 위치')


def _units(text):
    return len(text.encode('utf-16-le')) // 2


def _common_prefix(names, windows):
    first = names[0]
    for name in names[1:]:
        index = 0
        while index < min(len(first), len(name)) and (
                first[index].casefold() == name[index].casefold() if windows else first[index] == name[index]):
            index += 1
        first = first[:index]
    return first


def _word(text, cursor, windows):
    # Scan the entire draft so a later operator or unfinished quote cannot
    # turn a suggestion into part of an ambiguous shell expression.
    start = 0; spans = []; quote = None; escaped = False; decoded = ''
    for index, char in enumerate(text):
        if escaped:
            decoded += char; escaped = False; continue
        if windows:
            if char == '^':
                raise ValueError("이 명령에는 지원되지 않는 셸 이스케이프가 포함되어 있습니다.")
            if char == '"': quote = None if quote else '"'; continue
            if char in '%!': raise ValueError("이 명령에는 지원되지 않는 셸 확장 또는 연산자가 포함되어 있습니다.")
            if quote is None and char in '&|<>()': raise ValueError("이 명령에는 지원되지 않는 셸 연산자가 포함되어 있습니다.")
        else:
            if char == '\\' and quote != "'": escaped = True; continue
            if char in "'\"":
                if quote == char: quote = None; continue
                if quote is None: quote = char; continue
            if quote != "'" and char in '$`*?[]{};|&<>()':
                raise ValueError("이 명령에는 지원되지 않는 셸 확장 또는 연산자가 포함되어 있습니다.")
        if char.isspace() and quote is None:
            if index > start: spans.append((start, index))
            start = index + 1; decoded = ''
    if escaped: raise ValueError("경로는 불완전한 탈출로 끝납니다")
    if start < len(text): spans.append((start, len(text)))
    selected = next(((begin, end) for begin, end in spans if begin <= cursor <= end), None)
    if selected is None:
        if cursor < len(text) and not text[cursor].isspace():
            raise ValueError('커서를 경로 매개변수 안에 두십시오.')
        return cursor, cursor, ''
    begin, end = selected
    # Decode the selected token only through the cursor. The complete token
    # is replaced, so a suffix after the cursor cannot silently change it.
    raw = text[begin:cursor]; value = ''; quote = None; escaped = False
    for char in raw:
        if escaped: value += char; escaped = False; continue
        if windows:
            if char == '"': quote = None if quote else '"'; continue
        else:
            if char == '\\' and quote != "'": escaped = True; continue
            if char in "'\"":
                if quote == char: quote = None; continue
                if quote is None: quote = char; continue
        value += char
    if escaped: raise ValueError("경로는 불완전한 탈출로 끝납니다")
    return begin, end, value


def complete_path(session, text, selection_start):
    if not isinstance(text, str) or len(text) > MAX_DRAFT or '\x00' in text or '\n' in text or '\r' in text:
        raise ValueError("경로 완성은 최대 4096자의 한 줄 초안을 지원합니다.")
    cursor = _offset(text, selection_start)
    if session.done.is_set(): raise ValueError('터미널이 닫혔습니다. 다시 열어주세요.')
    cwd = session.current_cwd()
    windows = ntpath.basename(session.shell).lower() in ('cmd', 'cmd.exe')
    start, end, typed = _word(text, cursor, windows)
    path = ntpath if windows else os.path
    separator = '\\' if windows else '/'
    head, prefix = path.split(typed)
    expand_tilde = not windows and text[start:start + 1] not in ("'", '"')
    if expand_tilde and typed == '~': head, prefix = '~/', ''
    if windows:
        if typed.startswith('~') or (head and not path.isabs(head) and path.splitdrive(head)[0]):
            raise ValueError("이 Windows 경로 형식은 지원되지 않습니다.")
        directory = path.join(cwd, head) if head else cwd
    else:
        directory = os.path.expanduser(head) if expand_tilde and head.startswith('~') else head
        directory = path.join(cwd, directory) if not path.isabs(directory) else directory
    if len(directory) > 4096: raise ValueError('경로가 너무 깁니다.')
    candidates = []; names = []; scanned = 0; truncated = False
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                scanned += 1
                if scanned > MAX_SCAN: truncated = True; break
                if not (entry.name.casefold().startswith(prefix.casefold()) if windows else entry.name.startswith(prefix)): continue
                if windows and any(char in entry.name for char in '%!^"'): continue
                is_dir = entry.is_dir()
                raw = path.join(head, entry.name) + (separator if is_dir else '')
                if windows:
                    inserted = raw if re.fullmatch(r'[A-Za-z0-9_./\\:\-]+', raw) else '"' + raw + '"'
                else:
                    inserted = shlex.quote(os.path.expanduser(raw) if expand_tilde else raw)
                candidates.append({'label': entry.name + (separator if is_dir else ''), 'insertText': inserted,
                                   'isDirectory': is_dir})
                names.append(entry.name)
                if len(candidates) > MAX_CANDIDATES: truncated = True; candidates.pop(); break
    except (OSError, ValueError): raise ValueError("이 경로를 읽을 수 없습니다. 디렉터리에 여전히 액세스할 수 있는지 확인") from None
    candidates.sort(key=lambda item: (not item['isDirectory'], item['label'].casefold()))
    common_insert = None
    if not truncated and len(candidates) > 1:
        common = _common_prefix(names, windows)
        if len(common) > len(prefix):
            raw = path.join(head, common)
            if windows:
                common_insert = raw if re.fullmatch(r'[A-Za-z0-9_./\\:\-]+', raw) else '"' + raw + '"'
            else:
                common_insert = shlex.quote(os.path.expanduser(raw) if expand_tilde else raw)
    return {'cwd': cwd, 'replaceStart': _units(text[:start]), 'replaceEnd': _units(text[:end]),
            'candidates': candidates, 'truncated': truncated, 'commonPrefixInsertText': common_insert}
