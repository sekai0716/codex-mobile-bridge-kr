"""Opt-in gateway entry delivery, independent of chat subscriptions."""
import http.client
import json
import ipaddress
import threading
import time
import uuid
from pathlib import Path

from bridge.features.notifications.channels import channels, publish, publish_bark, publish_pushplus, publish_webhook, read_json, settings, write_json, webhook_channel_config


def gateway_ready(port, instance_id):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
    try:
        connection.request('GET', '/api/health')
        response = connection.getresponse()
        value = json.loads(response.read(4096))
        return response.status == 200 and value.get('instanceId') == instance_id
    except (OSError, ValueError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def ready_url(tunnel, port, instance_id):
    """Require both a registered live tunnel and our serving local gateway."""
    if not tunnel or not tunnel.ready.is_set() or any(event.is_set() for event in
            (tunnel.closed, tunnel.broken, tunnel.finished)):
        return ''
    url = tunnel.url
    if not gateway_ready(port, instance_id):
        return ''
    if tunnel.url != url or not tunnel.ready.is_set() or any(event.is_set() for event in
            (tunnel.closed, tunnel.broken, tunnel.finished)):
        return ''
    return url


def entry_urls(preferences, hosts, quick_url='', external_status=None, lan_addresses=None):
    """Enabled fixed entries, live tunnels, and selected LAN listeners, in click order."""
    urls = []
    for entry in preferences.get('connections', []):
        if not entry['enabled']:
            continue
        mode = entry['accessMode']
        if mode in ('nas', 'external') or (mode in ('server', 'cloudflare', 'tailscale') and
                (external_status or {}).get(entry['id'], {}).get('state') == 'connected'):
            urls.append(entry['publicUrl'].rstrip('/'))
    if quick_url:
        urls.append(quick_url.rstrip('/'))
    if preferences.get('lan'):
        # hosts is only a startup snapshot; a running monitor supplies the
        # live authority after DHCP or Wi-Fi changes.
        if lan_addresses is None:
            selected = set(preferences.get('lanAddresses') or [])
            live_hosts = hosts
        else:
            selected = None
            live_hosts = sorted(set(lan_addresses), key=ipaddress.ip_address)
        for host in live_hosts:
            try:
                address = ipaddress.ip_address(host)
            except ValueError:
                continue
            if address.is_loopback or address.is_unspecified or address.is_multicast:
                continue
            if selected is None or host in selected:
                urls.append(f'http://{host}:{preferences["port"]}')
    return list(dict.fromkeys(urls))


def address_message(config, urls, first=False, test=False):
    title = 'Codex Mobile Bridge · ' + ('접속 주소 알림 테스트' if test else '게이트웨이 시작' if first else '접속 주소 변경')
    name = config.get('addressName') or 'Codex Mobile Bridge'
    body = name + ('를 시작했습니다.' if first else '의 현재 접속 주소입니다.')
    body += '\n접속 주소:\n' + '\n'.join(urls) + '\nLAN 주소는 같은 네트워크에서만 사용할 수 있습니다. 고정 도메인은 먼저 설정해야 합니다.\n기존 게이트웨이 로그인 정보로 접속하세요.'
    return title, body


def send_address(config, channel, urls, first=False, test=False, event_id=''):
    title, body = address_message(config, urls, first, test)
    if channel == 'webhook' or channel.startswith('webhook:'):
        publish_webhook(webhook_channel_config(config, channel), title, body, urls[0], event='test' if test else 'gateway.started' if first else 'gateway.address_changed',
                        event_id=event_id or uuid.uuid4().hex,
                        host=config.get('addressName') or 'Codex Mobile Bridge', count=len(urls))
    else:
        {'ntfy': publish, 'bark': publish_bark, 'pushplus': publish_pushplus}[channel](config, title, body, urls[0])


class AddressNotifications:
    def __init__(self, data_dir, current_urls, instance_id):
        self.data_dir = Path(data_dir)
        self.path = self.data_dir/'address-notifications.json'
        self.current_urls = current_urls
        self.instance_id = instance_id
        self.closed = threading.Event()
        self.worker = None
        self.state = read_json(self.path, {})
        if self.state.get('instanceId') != instance_id:
            self.state = {}

    def scan(self):
        config = settings(self.data_dir)
        if self.closed.is_set() or not config['addressEnabled']:
            return
        urls = self.current_urls()
        if not urls:
            return
        if self.state.get('urls') != urls:
            self.state = {'instanceId': self.instance_id, 'urls': urls,
                          'first': not bool(self.state.get('urls')), 'eventId': uuid.uuid4().hex, 'deliveries': {}}
            write_json(self.path, self.state)
        elif not self.state.get('eventId'):
            self.state['eventId'] = uuid.uuid4().hex
            write_json(self.path, self.state)
        targets = channels(config)
        records = self.state['deliveries']
        # Only keep destinations currently enabled; do not retain old recipients.
        if set(records) - set(targets.values()):
            self.state['deliveries'] = records = {k: v for k, v in records.items() if k in targets.values()}
            write_json(self.path, self.state)
        for channel, target in targets.items():
            record = records.get(target, {})
            now = time.time()
            if record.get('delivered') or now < record.get('next', 0):
                continue
            # Recheck after another channel's network request, before each send.
            current = settings(self.data_dir)
            if self.closed.is_set() or not current['addressEnabled'] or self.current_urls() != urls:
                return
            if channels(current).get(channel) != target:
                continue
            try:
                send_address(current, channel, urls, first=self.state['first'], event_id=self.state['eventId'])
                records[target] = {'delivered': True, 'time': now, 'channel': channel}
            except Exception:
                attempts = record.get('attempts', 0) + 1
                records[target] = {'delivered': False, 'attempts': attempts, 'time': now,
                                   'next': now + min(300, 5 * 2 ** min(attempts, 6)), 'channel': channel,
                                   'error': '포털 알림을 보내지 못했습니다. 포털이 여전히 유효하고 알림이 활성화되면 다시 시도됩니다.。'}
            write_json(self.path, self.state)

    def start(self):
        self.worker = threading.Thread(target=self._run, name='address-notifications', daemon=True)
        self.worker.start()

    def _run(self):
        while not self.closed.is_set():
            try:
                self.scan()
            except Exception:
                # Keep the worker alive on a transient local read/write failure.
                pass
            self.closed.wait(3)

    def close(self):
        self.closed.set()
        if self.worker:
            self.worker.join(timeout=2)
