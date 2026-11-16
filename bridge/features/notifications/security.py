"""Deliver automatic IP-block alerts through the existing notification worker."""
import hashlib
import time
from pathlib import Path

from bridge.features.notifications.channels import channels, publish, publish_bark, publish_pushplus, publish_webhook, read_json, settings, write_json, webhook_channel_config


class SecurityNotifications:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.path = self.data_dir/'security-notifications.json'
        self.state = read_json(self.path, {})

    def scan(self):
        blocks = read_json(self.data_dir/'auth-sessions.json', {}).get('autoBlocks', {})
        events = {row['id']: row for row in blocks.values()}
        prior_state = self.state
        self.state = {key: value for key, value in self.state.items() if key in events}
        if self.state != prior_state:
            write_json(self.path, self.state)
        config = settings(self.data_dir)
        if not config['securityEnabled']:
            for identifier in events:
                self.state[identifier] = {'muted': True}
            if self.state != prior_state:
                write_json(self.path, self.state)
            return
        for identifier, event in events.items():
            record = self.state.setdefault(identifier, {})
            if record.get('muted'):
                continue
            for channel, target in channels(config).items():
                prior = record.get(target, {})
                if prior.get('delivered') or time.time() < prior.get('next', 0):
                    continue
                current = settings(self.data_dir)
                if not current['securityEnabled']:
                    record['muted'] = True
                    break
                if channels(current).get(channel) != target:
                    continue
                title = 'Codex Mobile Bridge · IP 자동으로 차단됨'
                body = (f"{current.get('addressName') or 'Codex Mobile Bridge'}：IP {event['ip']} 계속 잘못된 비밀번호를 입력하는 경우 {event['attempts']} 몇번이나 블랙리스트에 추가됐어요。"
                        '\n관련 로그인이 취소되었습니다. 컴퓨터 게이트웨이로 가주세요 App 의“장치에 로그인 → 자동 금지 IP”보기 또는 취소。')
                try:
                    if channel == 'webhook' or channel.startswith('webhook:'):
                        publish_webhook(webhook_channel_config(current, channel), title, body, event='security.ip_blocked', event_id=hashlib.sha256(identifier.encode()).hexdigest(),
                                        host=current.get('addressName') or 'Codex Mobile Bridge', count=event['attempts'])
                    else:
                        {'ntfy': publish, 'bark': publish_bark, 'pushplus': publish_pushplus}[channel](current, title, body)
                    record[target] = {'delivered': True, 'channel': channel, 'time': time.time()}
                except Exception:
                    record[target] = {'delivered': False, 'channel': channel, 'next': time.time()+30,
                                      'error': "차단 알림이 실패했습니다. 자동으로 다시 시도됩니다."}
                write_json(self.path, self.state)
