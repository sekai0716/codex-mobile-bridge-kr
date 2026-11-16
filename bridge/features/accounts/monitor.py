"""Opt-in account reminders. No model runs, account switching, or credit consumption."""
import copy
import hashlib
import json
import math
import threading
import time

from bridge.features.notifications.channels import channels, publish, publish_bark, publish_pushplus, publish_webhook, read_json, settings, write_json, webhook_channel_config


DEFAULTS = {'lowQuota':False, 'quotaReset':False, 'resetExpiry':False,
            'subscriptionExpiry':False, 'desktopUpdate':False,
            'globalReset':False, 'globalResetSignal':False}
GLOBAL_REMINDERS = ('globalReset', 'globalResetSignal')


def account_identity(owner, fallback):
    # Credential ownership survives importing or replacing a local profile and separates workspaces.
    return 'account:' + hashlib.sha256(json.dumps(owner, separators=(',', ':')).encode()).hexdigest() if owner else fallback


def events(account, previous, now, preferences):
    result = []
    for bucket in account.get('limits', []):
        for window in bucket.get('windows', []):
            key = bucket['id'] + ':' + window['kind']
            before = previous.get(key, {})
            remaining, reset = window.get('remainingPercent'), window.get('resetsAt')
            if remaining is None or reset is None:
                continue
            if preferences['lowQuota'] and remaining <= 10 and reset > now:
                result.append(('lowQuota', f'{key}:{reset}', 'Codex 사용량 한도 부족', '일부 사용량 한도의 잔여량이 10% 이하입니다. 계정과 사용량 한도에서 확인하세요.'))
            if (preferences['quotaReset'] and before.get('resetsAt')
                    and reset > before['resetsAt'] and remaining > before.get('remainingPercent', 100)):
                result.append(('quotaReset', f'{key}:{reset}', 'Codex 사용량 한도 갱신', '사용량 한도 기간이 갱신되었고, 조회 결과 사용 가능한 잔여량이 늘어났습니다.'))
    if preferences['resetExpiry']:
        for card in (account.get('resetCredits') or {}).get('credits') or []:
            expiry = card.get('expiresAt')
            if card.get('status') == 'available' and isinstance(expiry, (int, float)) and 0 < expiry-now <= 86400:
                result.append(('resetExpiry', str(card['id'])+':'+str(expiry), 'Codex 재설정 카드가 곧 만료됩니다', '24시간 내에 만료되는 재설정 카드가 있습니다. 내용을 확인한 뒤 사용 여부를 결정하세요.'))
    if preferences['subscriptionExpiry']:
        period = (account.get('subscription') or {}).get('periodEndsAt')
        if period and 0 < period-now <= 7*86400:
            days = math.ceil((period-now)/86400)
            stage = 1 if days <= 1 else 3 if days <= 3 else 7
            result.append(('subscriptionExpiry', f'{period}:{stage}', '구독 기간 알림' if account['subscription'].get('source') == 'online' else '로그인 기록의 구독 기간 알림',
                           (f'온라인으로 조회한 구독 기간이 {days}일 내에 종료됩니다. 갱신 여부는 ChatGPT 구독 페이지에서 확인하세요.'
                            if account['subscription'].get('source') == 'online' else
                            f'로그인 기록의 구독 종료일이 {days}일 남았습니다. 실시간 결제 정보가 아니므로 ChatGPT 구독 페이지에서 확인하세요.')))
    return result


class AccountMonitor:
    def __init__(self, manager):
        self.manager = manager
        self.notification_data_dir = manager.bridge.data_dir
        self.path = manager.root/'reminders.json'
        self.ledger_path = manager.root/'reminder-delivery.json'
        self.preferences = {**DEFAULTS, **read_json(self.path, {})}
        enabled = any(self.preferences[k] for k in GLOBAL_REMINDERS)
        self.preferences.update({k: enabled for k in GLOBAL_REMINDERS})
        self.ledger = read_json(self.ledger_path, {})
        self.previous = {}
        self.closed = threading.Event()
        self.worker = None
        self.last_error = ''
        self.current_value = None
        self.current_stamp = None
        self.current_checked = 0
        self.global_watch_path = manager.root/'global-reset-watch.json'
        self.global_watch = read_json(self.global_watch_path, {})

    def adopt_identity(self, identity, aliases):
        before = self.ledger.copy()
        for alias in set(aliases) - {identity}:
            if alias in self.previous:
                self.previous.setdefault(identity, self.previous.pop(alias))
            for key in [key for key in self.ledger if key.startswith(alias+'|')]:
                target = identity + key[len(alias):]
                record = self.ledger.pop(key)
                current = self.ledger.get(target)
                records = [record] if current is None else [current, record]
                self.ledger[target] = max(records, key=lambda row: (bool(row.get('sent')), row.get('time', 0)))
        if self.ledger != before:
            write_json(self.ledger_path, self.ledger)

    def observe(self, identity, value, aliases=()):
        if value.get('error') or not value.get('updatedAt') or time.time()-value['updatedAt'] > 360:
            return
        self.adopt_identity(identity, aliases)
        before = self.previous.get(identity, {})
        delivered = True
        for event in events(value, before, time.time(), self.preferences):
            delivered = self.deliver(identity, event) and delivered
        if delivered:
            self.previous[identity] = {b['id']+':'+w['kind']:w for b in value.get('limits', []) for w in b['windows']}

    def configure(self, value):
        if not isinstance(value, dict) or set(value)-set(DEFAULTS) or any(type(v) is not bool for v in value.values()):
            raise ValueError('알림 설정이 잘못되었습니다.')
        if any(k in value for k in GLOBAL_REMINDERS):
            enabled = any(value.get(k, False) for k in GLOBAL_REMINDERS)
            value = {**value, **{k: enabled for k in GLOBAL_REMINDERS}}
        with self.manager.lock:
            for kind in GLOBAL_REMINDERS:
                if value.get(kind) is True and not self.preferences.get(kind):
                    self.global_watch[kind] = time.time()
            write_json(self.global_watch_path, self.global_watch)
            self.preferences = {**self.preferences, **value}
            write_json(self.path, self.preferences)

    def reset_global_watch(self):
        self.global_watch.update({kind: time.time() for kind in GLOBAL_REMINDERS})
        write_json(self.global_watch_path, self.global_watch)

    def deliver(self, identity, event):
        kind, key, title, body = event
        config = settings(self.notification_data_dir)
        now = time.time()
        delivered = True
        before = copy.deepcopy(self.ledger)
        for channel, destination in channels(config).items():
            ledger_key = '|'.join((identity, kind, key, destination))
            if self.ledger.get(ledger_key, {}).get('sent'):
                continue
            if now < self.ledger.get(ledger_key, {}).get('next', 0):
                delivered = False
                continue
            current = settings(self.notification_data_dir)
            if (self.closed.is_set() or not self.preferences[kind] or channels(current).get(channel) != destination or
                    kind in GLOBAL_REMINDERS and (not self.manager.reset_dynamic_enabled or float(key) <= self.global_watch.get(kind, 0))):
                continue
            try:
                if channel == 'webhook' or channel.startswith('webhook:'):
                    publish_webhook(webhook_channel_config(current, channel), title, body, current['clickBase'], event='account.' + kind,
                                    event_id=hashlib.sha256((identity + '|' + kind + '|' + key).encode()).hexdigest())
                else:
                    {'ntfy':publish, 'bark':publish_bark, 'pushplus':publish_pushplus}[channel](current, title, body, current['clickBase'])
                self.ledger[ledger_key] = {'sent':True, 'time':now}
                self.last_error = ''
            except Exception:
                delivered = False
                self.ledger[ledger_key] = {'sent':False, 'time':now, 'next':now+300}
                self.last_error = "계정 알림 전송에 실패했습니다. 전화 알림 설정을 확인하세요."
        self.ledger = {k:v for k,v in self.ledger.items() if v.get('time', 0) > now-35*86400}
        if self.ledger != before:
            write_json(self.ledger_path, self.ledger)
        return delivered

    def scan_global_reset(self):
        with self.manager.lock:
            if not self.manager.reset_dynamic_enabled:
                return
            forecast = self.manager.reset_forecast
            forecast.request()
        value = forecast.status()
        if value.get('state') != 'ready' or value.get('stale'):
            return
        now = time.time()
        pending = []
        with self.manager.lock:
            for kind in GLOBAL_REMINDERS:
                if self.preferences[kind] and kind not in self.global_watch:
                    self.global_watch[kind] = now
                    write_json(self.global_watch_path, self.global_watch)
            reset = value.get('lastResetAt')
            if self.preferences['globalReset'] and reset and reset > self.global_watch['globalReset']:
                pending.append(('globalReset', str(reset), 'Codex 활동 재설정',
                                '타사 소스에서 전역 재설정이 보고되었습니다. 개인잔액은 계좌카드에서 확인하시기 바랍니다.。\n데이터：' + value['source']))
            signal = value.get('officialSignal')
            if (self.preferences['globalResetSignal'] and signal and signal.get('at') and
                    signal['at'] > self.global_watch['globalResetSignal']):
                pending.append(('globalResetSignal', str(signal['at']), 'Codex 미리보기 역학 재설정',
                                '타사 소스에 재설정 미리보기가 포함되어 있지만 아직 완료되었는지 확인되지 않았습니다.。\n데이터：' + value['source']))
        for event in pending:
            self.deliver('global', event)

    def scan(self):
        if self.closed.is_set() or not any(self.preferences.values()):
            return
        if not getattr(self.manager.bridge, 'observation_enabled', lambda: True)():
            return
        # No quota polling when all delivery channels are disabled.
        if not channels(settings(self.notification_data_dir)):
            return
        if any(self.preferences[k] for k in GLOBAL_REMINDERS):
            self.scan_global_reset()
        if self.preferences['desktopUpdate']:
            self.manager.updates.check(background=True)
            update = self.manager.updates.status()
            if update.get('state') == 'available':
                self.deliver('desktop', ('desktopUpdate', str(update['targetBuild']), 'Codex Desktop 새 버전 출시',
                                        '공식 업데이트 채널에 새 버전이 출시되었습니다. 클라이언트 관리에서 Codex 버전과 업데이트를 확인하세요.'))
        if not any(self.preferences[k] for k in DEFAULTS if k not in (*GLOBAL_REMINDERS, 'desktopUpdate')):
            return
        with self.manager.lock:
            self.manager.check_ready()
            rows = [dict(row) for row in self.manager.index['accounts'] if row['kind'] == 'chatgpt']
            current = self.manager.info.current()
            current_owner = (self.manager.info.identity or {}).get('owner') if current.get('status') == 'ready' else None
            login = self.manager.info.current_login()
            if login and login.get('transient'):
                rows.append({**login, 'tokenOwner': self.manager.info.identity['login']['owner']})
        # Older runtimes may expose native account data without a verified login card.
        if not login and not current.get('id'):
            stamp = self.manager.info.source_stamp()
            if stamp != self.current_stamp or time.time()-self.current_checked >= 300:
                self.current_checked = time.time()
                self.current_value = None
                self.current_stamp = stamp
                self.current_value = self.manager.bridge.account.read(refresh=False)
            if self.current_value and self.current_value.get('visible'):
                key = self.current_value['accountKey']
                self.observe(account_identity(current_owner, key), self.current_value, aliases=(key,))
        for row in rows:
            if self.closed.is_set():
                return
            self.manager.info.request({'id':row['id'], 'section':'usage'})
            with self.manager.lock:
                value = copy.deepcopy(self.manager.info.entries.get(row['id'], {}).get('usage', {}))
                if row.get('transient'):
                    current_login = self.manager.info.current_login()
                    if (not current_login or current_login['accountKey'] != row['accountKey'] or
                            value.get('accountKey') != row['accountKey']):
                        continue
            if value.get('status') != 'ready' or time.time()-value.get('updatedAt', 0) > 360:
                continue
            aliases = [] if row.get('transient') else [row['id']]
            if login and login['id'] == row['id']:
                aliases.append(login['accountKey'])
            key = account_identity(row.get('tokenOwner'), row.get('accountKey') or row['id'])
            self.observe(key, value, aliases=aliases)

    def start(self):
        def run():
            while not self.closed.is_set():
                try:
                    self.scan()
                except Exception:
                    self.last_error = '계정 알림을 일시적으로 사용할 수 없으며 다음 확인 시 다시 시도됩니다.'
                self.closed.wait(30)
        self.worker = threading.Thread(target=run, name='account-reminders', daemon=True)
        self.worker.start()

    def close(self):
        self.closed.set()
        if self.worker:
            self.worker.join(timeout=2)
