"""Native @file tokens shared by Claude Code and Harness, never file contents."""
import re
from pathlib import PurePosixPath, PureWindowsPath

from bridge.clients.errors import ResumePreflightBlocked


def _absolute(path):
    return PurePosixPath(path).is_absolute() or PureWindowsPath(path).is_absolute()


def file_mentions(text, files, *, quote=True):
    tokens = []
    for file in files:
        path = file.get('path')
        if not isinstance(path, str) or not _absolute(path) or re.search(r'[\x00-\x1f\x7f-\x9f"]', path):
            raise ResumePreflightBlocked('기본 파일 참조는 이 경로를 지원하지 않습니다. 파일 이름을 확인하고 다시 선택하세요.')
        if file.get('kind') == 'directory':
            path = path.rstrip('/\\') + '/'
        tokens.append('@' + ('"' + path + '"' if quote and re.search(r'\s', path) else path))
    return text + ('\n\n' if text and tokens else '') + '\n'.join(tokens)


def display_file_mentions(message):
    """Normalize a trailing native mention paragraph, retaining the user prose."""
    if message.get('role') != 'user':
        return
    text = message.get('text', '')
    head, separator, tail = text.rpartition('\n\n')
    files = []
    for line in (tail if separator else text).splitlines():
        match = re.fullmatch(r'@(?:"([^"\r\n]+)"|([^"\r\n]+))', line)
        path = (match.group(1) or match.group(2)) if match else ''
        if not path or not _absolute(path):
            return
        path = path.rstrip('/\\')
        name = (PureWindowsPath(path) if PureWindowsPath(path).is_absolute() else PurePosixPath(path)).name
        files.append({'type': 'file', 'path': path, 'name': name})
    if files:
        message['text'] = head if separator else ''
        message.setdefault('attachments', []).extend(files)
