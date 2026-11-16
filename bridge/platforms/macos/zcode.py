"""Invoke the bundled local ZCode window connector only on explicit actions."""
import json
import subprocess
import sys

from bridge.resources import project_root


def supports_window_send():
    # ZCode 3.17.2 reuses the *same* AX composer and send button across native
    # session IDs. Only advertise writes once a session-bound route is proven.
    return False


def operation(action, executable, sid, title, text='', *, expected_pid=None):
    if action != 'resume':
        raise ValueError('이는 지원되지 않습니다. ZCode 창 작업')
    root = project_root()
    helper = (root if getattr(sys, 'frozen', False) else root/'dist')/'client-helpers/zcode-bridge-helper'
    try:
        result = subprocess.run([str(helper)], input=json.dumps(
            dict(action=action, executable=str(executable), sessionId=sid, title=title,
                 text=text, expectedPid=expected_pid), ensure_ascii=False),
            capture_output=True, text=True, timeout=14)
        reply = json.loads(result.stdout)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        raise ValueError('ZCode 확인을 위해 원래 창이 반환되지 않았습니다. 다시 시도할지 결정하기 전에 세션을 확인하세요.') from None
    if reply.get('status') not in ('ready', 'submitted'):
        raise ValueError(reply.get('reason') or '작동불가 ZCode 원래 창')
    return reply
