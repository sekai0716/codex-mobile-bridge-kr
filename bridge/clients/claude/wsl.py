"""Selected running WSL Claude Code profiles using the existing CLI protocol."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import threading
import zlib

from bridge.app.lifecycle import private_json
from bridge.clients.claude.remote import RemoteClaudeCli, worker_source
from bridge.clients.errors import BridgeUnavailable
from bridge.platforms.windows import wsl


def entry_id(distribution, user, directory):
    identity = json.dumps([distribution, user, directory], ensure_ascii=False).encode()
    return 'wsl-claude:' + hashlib.sha256(identity).hexdigest()[:32]


# Inspect only the current user's installed CLI and profile directories. Never
# invoke Claude or return credentials/command lines during an inventory scan.
PROBE = r'''
import json,os,pwd,shutil
from pathlib import Path
uid=os.getuid(); home=Path.home(); user=pwd.getpwuid(uid).pw_name
binary=shutil.which('claude')
if not native_wsl_binary(binary):
    binary=next((str(p) for p in (home/'.local/bin/claude',Path('/usr/local/bin/claude'),home/'.npm-global/bin/claude',
                    *home.glob('.nvm/versions/node/*/bin/claude'))
                 if p.is_file() and os.access(p,os.X_OK) and native_wsl_binary(p)),None)
directories={str(selected_directory)} if 'selected_directory' in globals() else {str((home/'.claude').resolve())}
for p in (() if 'selected_directory' in globals() else Path('/proc').iterdir()):
    if not p.name.isdigit(): continue
    try:
        if p.stat().st_uid!=uid: continue
        args=(p/'cmdline').read_bytes().split(b'\0')
        if not any(Path(os.fsdecode(a)).name in ('claude','claude.js') or
                   (Path(os.fsdecode(a)).name=='cli.js' and '/@anthropic-ai/claude-code/' in os.fsdecode(a))
                   for a in args[:2] if a): continue
        env=dict(v.split(b'=',1) for v in (p/'environ').read_bytes().split(b'\0') if b'=' in v)
        selected=env.get(b'CLAUDE_CONFIG_DIR')
        if selected: directories.add(str(Path(os.fsdecode(selected)).resolve()))
    except (OSError,ValueError): continue
print(json.dumps({'user':user,'profiles':[{'configDir':d} for d in sorted(directories)
    if native_wsl_binary(binary) and Path(d).is_dir()]}))
'''


class WslClaudeEntries:
    def __init__(self, directory):
        self.path = Path(directory)/'claude-wsl-entries.json'
        self.lock = threading.RLock()
        self.candidates = {}
        self.entries = []
        if self.path.exists():
            value = json.loads(self.path.read_text(encoding='utf-8'))
            if value.get('version') != 1 or not isinstance(value.get('entries'), list):
                raise ValueError('WSL Claude Code 구성이 인식되지 않습니다.')
            self.entries = value['entries']
            for row in self.entries:
                if row.get('id') != entry_id(row['distribution'], row['user'], row['configDir']):
                    raise ValueError('WSL Claude Code 신원 불일치')

    def scan(self):
        candidates, errors = {}, []
        for distribution in wsl.running_distributions():
            try:
                info = wsl.read(distribution, '__name__="wsl_claude_probe"\n'+worker_source()+PROBE)
                for profile in info.get('profiles', []):
                    directory = profile['configDir']
                    identifier = entry_id(distribution, info['user'], directory)
                    candidates[identifier] = {'id': identifier, 'distribution': distribution,
                        'user': info['user'], 'configDir': directory,
                        'label': 'WSL · '+distribution+' · '+info['user']+' · '+directory}
            except (OSError, ValueError, TimeoutError, KeyError):
                errors.append({'distribution': distribution, 'error': '읽을 수 있는 항목이 없습니다. Claude Code 환경이나 Python'})
        with self.lock:
            self.candidates = candidates
        return {'errors': errors}

    def applications(self):
        with self.lock:
            rows = {r['id']: dict(r) for r in self.entries}
            for key, row in self.candidates.items():
                rows.setdefault(key, {**row, 'enabled': False})
        running = wsl.displayed_distributions(rows.values())
        return [{**row, 'kind': 'wsl-claude-cli', 'name': 'WSL Claude Code · '+row['distribution'],
                 'icon': 'claude', 'installed': True, 'configured': True,
                 'enabled': row.get('enabled', True), 'selectable': True,
                 'running': None if running is None else row['distribution'] in running, 'connected': False,
                 'distributionRunning': None if running is None else row['distribution'] in running,
                 'setupStatus': 'ready', 'accessManagement': 'external',
                 'canQuitDesktop': False, 'canForceQuit': False,
                 'reason': "게이트웨이에서 이 WSL API 연결을 관리할 수 있습니다. 원래 Claude Code CLI에서 공식 로그인을 완료하세요."}
                for row in rows.values()]

    def save_wsl(self, distribution, user, home, label):
        if (not isinstance(label, str) or not 1 <= len(label.strip()) <= 80
                or any(ord(c) < 32 or ord(c) == 127 for c in label)):
            raise ValueError("제어 문자 없이 1~80자의 연결 이름을 입력합니다.")
        source = (wsl.configuration_source(user, home) + '\n__name__="wsl_claude_probe"\n'
                  + worker_source() + PROBE)
        info = wsl.read(distribution, source, user)
        if info.get('user') != user or len(info.get('profiles', [])) != 1:
            raise ValueError("선택한 디렉터리에 대해 네이티브 WSL Claude Code 환경을 찾을 수 없습니다.")
        directory = info['profiles'][0]['configDir']
        identifier = entry_id(distribution, user, directory)
        candidate = {'id': identifier, 'distribution': distribution, 'user': user,
                     'configDir': directory, 'label': label.strip()}
        with self.lock:
            if any(row['id'] == identifier for row in self.entries):
                raise ValueError("이 WSL 구성 디렉터리는 이미 등록되어 있습니다. 기존 항목을 사용합니다.")
            previous = self.candidates.get(identifier)
            self.candidates[identifier] = candidate
            try:
                self.configure(identifier, True, _manual=True)
            except Exception:
                if previous is None:
                    self.candidates.pop(identifier, None)
                else:
                    self.candidates[identifier] = previous
                raise
        return identifier

    def configure(self, identifier, enabled, *, _manual=False):
        if type(enabled) is not bool or not isinstance(identifier, str) or not re.fullmatch(r'wsl-claude:[0-9a-f]{32}', identifier):
            raise ValueError('WSL Claude Code 입구 스위치가 잘못되었습니다.')
        with self.lock:
            row = next((r for r in self.entries if r['id'] == identifier), None)
            if _manual and row is not None:
                raise ValueError("이 WSL 구성 디렉터리는 이미 등록되어 있습니다. 기존 항목을 사용합니다.")
            if row is None:
                if not enabled or identifier not in self.candidates:
                    raise ValueError('기존 항목을 스캔하고 선택하세요. WSL Claude Code 입구')
                if len(self.entries) >= 16:
                    raise ValueError('가장 많이 등록된 16 개인 WSL Claude Code 입구')
                row = dict(self.candidates[identifier])
                if not _manual:
                    self.entries.append(row)
            row['enabled'] = enabled
            self.path.parent.mkdir(parents=True, exist_ok=True)
            if _manual:
                updated = [*self.entries, row]
                payload = {'version': 1, 'entries': updated}
                try:
                    private_json(self.path, payload)
                except OSError:
                    try:
                        persisted = self.path.read_bytes() == json.dumps(payload).encode('utf-8')
                    except OSError:
                        persisted = False
                    if not persisted:
                        raise
                self.entries = updated
            else:
                private_json(self.path, {'version': 1, 'entries': self.entries})

    def selected(self, identifier):
        with self.lock:
            row = next((dict(r) for r in self.entries if r['id'] == identifier and r.get('enabled', True)), None)
        if row is None:
            raise ValueError('WSL Claude Code 입구가 폐쇄되거나 변경됨')
        return row

    def hosts(self):
        running = set(wsl.running_distributions())
        with self.lock:
            return {r['id']: {**r, 'alias': r['id'], 'displayName': r['label']}
                    for r in self.entries if r.get('enabled', True) and r['distribution'] in running}

    def projects(self):
        return []

    def read(self, identifier, source, timeout=30):
        row = self.selected(identifier)
        prefix = 'import os\nos.environ["CLAUDE_CONFIG_DIR"]='+repr(row['configDir'])+'\n'
        return wsl.read(row['distribution'], prefix+source, row['user'], timeout)


class WslClaudeCli(RemoteClaudeCli):
    transport_kind = 'wsl'

    def __init__(self, hosts=None):
        super().__init__(hosts)
        self.continuations_path = Path(hosts.path).parent/'claude-wsl-continuations.json' if hosts is not None else None
        self.continuations = {}
        self.continuation_pending = {}
        if self.continuations_path and self.continuations_path.exists():
            value = json.loads(self.continuations_path.read_text(encoding='utf-8'))
            if value.get('version') != 1 or not isinstance(value.get('sessions'), dict) or not isinstance(value.get('pending'), dict):
                raise ValueError("WSL Claude Code 연속성 레코드가 유효하지 않습니다.")
            self.continuations = value['sessions']
            self.continuation_pending = value['pending']

    def _save_continuations(self):
        if self.continuations_path:
            private_json(self.continuations_path, {'version': 1, 'sessions': self.continuations,
                                                 'pending': self.continuation_pending})

    def prepare_account_switch(self, identifier, identity):
        """Snapshot only freshly verified native threads already known to this gateway."""
        row = self.hosts.selected(identifier)
        result = self._remote(identifier, {'operation': 'account-continuation'})
        profile = result.get('profile') or {}
        if profile.get('directory') != row['configDir'] or result.get('identity') != identity:
            raise ValueError("WSL Claude Code 계정 ID가 변경되었습니다. 계속하기 전에 새로고침하세요.")
        fresh = {item['nativeId']: item for item in result.get('sessions', [])}
        selected = {}
        for sid, saved in self.index.items():
            if saved.get('host') != identifier:
                continue
            native = saved.get('nativeId')
            current = fresh.get(native)
            if (not current or any(current.get(key) != saved.get(key) for key in
                                   ('origin', 'cwd', 'model', 'permissionMode', 'permissionKnown', 'projectConfig')) or
                    (current.get('stamp') or [])[:2] != (saved.get('stamp') or [])[:2]):
                raise ValueError("원래 WSL Claude Code 세션 ID가 변경되었습니다. 계정이 전환되지 않았습니다.")
            selected[sid] = {key: current.get(key) for key in
                             ('nativeId', 'cwd', 'origin', 'model', 'permissionMode', 'permissionKnown',
                              'projectConfig', 'stamp', 'draftAccountIdentity')}
        self.continuation_pending[identifier] = {'beforeIdentity': identity, 'sessions': selected}
        self._save_continuations()

    def complete_account_switch(self, identifier, identity):
        """Bind the explicit transaction's new origin to the original gateway IDs."""
        row = self.hosts.selected(identifier)
        pending = self.continuation_pending.get(identifier)
        if pending is None:
            return []
        pending['appliedIdentity'] = identity
        self._save_continuations()
        result = self._remote(identifier, {'operation': 'account-continuation'})
        profile = result.get('profile') or {}
        if profile.get('directory') != row['configDir'] or result.get('identity') != identity:
            raise ValueError("전환 후 WSL Claude Code ID가 확인되지 않았습니다.")
        fresh = {item['nativeId']: item for item in result.get('sessions', [])}
        aliases, updated, drafts = dict(self.continuations), {}, []
        host = {**row, 'alias': identifier}
        for sid, saved in pending['sessions'].items():
            current = fresh.get(saved['nativeId'])
            if (not current or current.get('origin') != profile.get('origin') or
                    any(current.get(key) != saved.get(key) for key in
                        ('cwd', 'model', 'permissionMode', 'permissionKnown', 'projectConfig')) or
                    (current.get('stamp') or [])[:2] != (saved.get('stamp') or [])[:2]):
                raise ValueError("원래 WSL Claude Code 세션 ID가 확인되지 않았습니다.")
            prior = (aliases.get(sid) or {}).get('previousAccountIdentities', [])
            lineage = list(dict.fromkeys([*prior, saved.get('draftAccountIdentity') or '']))
            lineage = [item for item in lineage if re.fullmatch(r'[0-9a-f]{64}', item) and
                       item != current.get('draftAccountIdentity')][-32:]
            aliases[sid] = {'host': identifier, 'nativeId': saved['nativeId'],
                            'cwd': saved['cwd'], 'origin': current['origin'], 'fileIdentity': current['stamp'][:2],
                            'accountIdentity': current.get('draftAccountIdentity') or '',
                            'previousAccountIdentities': lineage}
            updated[sid] = {**super()._row(identifier, host, current), 'id': sid,
                            'runtime': 'wsl', 'distribution': row['distribution'], 'user': row['user']}
            drafts.append({'id': sid, 'previousAccountIdentity': saved.get('draftAccountIdentity') or '',
                           'accountIdentity': current.get('draftAccountIdentity') or ''})
        previous = self.continuations
        self.continuations = aliases
        self.continuation_pending.pop(identifier)
        try:
            self._save_continuations()
        except Exception:
            self.continuations = previous
            self.continuation_pending[identifier] = pending
            raise
        self.index.update(updated)
        targets = {item['nativeId'] for item in updated.values()}
        self.index = {sid: item for sid, item in self.index.items() if
                      item.get('host') != identifier or item.get('nativeId') not in targets or sid in updated}
        self.history = {key: page for key, page in self.history.items() if key[0] not in updated}
        return drafts

    def call(self, action, sid, body):
        value = super().call(action, sid, body)
        if action == 'detail':
            with self.lock:
                alias, current = self.continuations.get(sid), self.index.get(sid)
                if (alias and current and alias.get('host') == current.get('host') and
                        all(alias.get(key) == current.get(key) for key in ('nativeId', 'cwd', 'origin')) and
                        alias.get('fileIdentity') == (current.get('stamp') or [])[:2] and
                        alias.get('accountIdentity') == (value.get('session') or {}).get('draftAccountIdentity')):
                    value['draftContinuation'] = {'id': sid, 'entry': alias['host'],
                        'accountIdentity': alias['accountIdentity'],
                        'previousAccountIdentities': list(alias.get('previousAccountIdentities') or [])}
        return value

    def _process_options(self):
        return wsl._options()

    def _row(self, host_id, host, raw):
        row = super()._row(host_id, host, raw)
        for sid, saved in self.continuations.items():
            if (saved.get('host') == host_id and
                    all(saved.get(key) == raw.get(key) for key in ('nativeId', 'cwd', 'origin')) and
                    saved.get('fileIdentity') == (raw.get('stamp') or [])[:2]):
                row['id'] = sid
                break
        return {**row, 'runtime': 'wsl', 'distribution': host['distribution'], 'user': host['user']}

    def _command(self, alias):
        row = self.hosts.selected(alias)
        source = 'import os\nos.environ["MOBILE_BRIDGE_WSL_NATIVE"]="1"\nos.environ["CLAUDE_CONFIG_DIR"]='+repr(row['configDir'])+'\n'
        source += worker_source()
        # wsl.command rechecks running state before each invocation. The worker
        # receives native stream-json stdin without another protocol envelope.
        encoded = base64.b64encode(zlib.compress(source.encode('utf-8'))).decode('ascii')
        loader = 'import base64,zlib;exec(compile(zlib.decompress(base64.b64decode('+repr(encoded)+')),"<claude-worker>","exec"))'
        command = wsl.command(row['distribution'], row['user'])
        inner = 'exec python3 -u -c '+shlex.quote(loader)
        return command[:-1] + ['/bin/sh', '-c', 'exec "$SHELL" -lc '+shlex.quote(inner)]

    def _remote(self, alias, request, timeout=30):
        try:
            result = subprocess.run(self._command(alias), input=json.dumps(request, ensure_ascii=False)+'\n',
                capture_output=True, text=True, encoding='utf-8', timeout=timeout, **wsl._options())
            value = json.loads(result.stdout.strip()) if result.returncode == 0 else {}
            if value.get('ok') is not True:
                raise BridgeUnavailable(value.get('message') or 'WSL Claude Code 호스트를 사용할 수 없습니다. 릴리스 버전과 원래 구성을 확인하세요.')
            return value['value']
        except (OSError, subprocess.TimeoutExpired, ValueError, KeyError) as exc:
            raise BridgeUnavailable('WSL Claude Code 호스트를 사용할 수 없습니다. 릴리스 버전과 원래 구성을 확인하세요.') from exc


class _RemoteHosts:
    def __init__(self, ssh, entries):
        self.ssh, self.entries = ssh, entries

    def hosts(self):
        return {**(self.ssh.hosts() if self.ssh else {}), **self.entries.hosts()}


class ClaudeCliRemotes:
    """Keep SSH and WSL identity/caches independent while exposing one adapter."""
    def __init__(self, hosts, entries):
        self.ssh = RemoteClaudeCli(hosts)
        self.wsl = WslClaudeCli(entries)
        self.lock = threading.RLock()
        self.ssh.lock = self.wsl.lock = self.lock
        self.hosts = _RemoteHosts(hosts, entries)

    @property
    def index(self):
        with self.lock:
            return {**self.ssh.index, **self.wsl.index}

    @property
    def owned(self):
        with self.lock:
            return {**self.ssh.owned, **self.wsl.owned}

    def cli_connections(self):
        return self.ssh.cli_connections() + self.wsl.cli_connections()

    def available(self):
        return self.ssh.available() or self.wsl.available()

    def busy(self):
        return self.ssh.busy() or self.wsl.busy()

    def listing(self):
        a, b = self.ssh.listing(), self.wsl.listing()
        return {'connected': a['connected'] or b['connected'],
                'sessions': a['sessions']+b['sessions'], 'complete': a['complete'] and b['complete']}

    def contains(self, sid):
        return self.ssh.contains(sid) or self.wsl.contains(sid)

    def projects(self, host_id=None):
        if host_id is not None:
            return (self.wsl if host_id.startswith('wsl-claude:') else self.ssh).projects(host_id=host_id)
        return self.ssh.projects()+self.wsl.projects()

    def project_environments(self, host_id=None):
        if host_id is not None:
            return (self.wsl if host_id.startswith('wsl-claude:') else self.ssh).project_environments(host_id=host_id)
        return self.ssh.project_environments()+self.wsl.project_environments()

    def create(self, host_id, *args, **options):
        target = self.wsl if host_id.startswith('wsl-claude:') else self.ssh
        return target.create(host_id, *args, **options)

    def call(self, action, sid, body):
        target = self.wsl if self.wsl.contains(sid) else self.ssh
        return target.call(action, sid, body)

    def close(self):
        self.ssh.close()
        self.wsl.close()
