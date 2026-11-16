"""Explicit Codex entries; discovery never starts a native execution owner."""
import hashlib
import json
import threading
import sys
import os
import re
from pathlib import Path, PureWindowsPath

try:
    from tomllib import loads as load_toml
except ModuleNotFoundError:  # Python 3.9 and 3.10 gateway builds
    from bridge.vendor.wsl_tomli import loads as load_toml

from bridge.app.lifecycle import private_json
from bridge.clients.codex.remote import RemoteUnavailable


def codex_list_hosts(ssh_hosts, entries):
    """Default Codex aggregates SSH/WSL; independent homes own their own lists."""
    return {**ssh_hosts, **{key: row for key, row in entries.items()
                          if row.get('kind') != 'codex-local'}}


def entry_id(distribution, user, home):
    key = json.dumps([distribution, user, home], ensure_ascii=False).encode('utf-8')
    return 'wsl:' + hashlib.sha256(key).hexdigest()[:32]


def local_home(value):
    if not isinstance(value, str) or not value.strip() or '\x00' in value:
        raise ValueError('선택해주세요 Codex 구성 디렉토리')
    path = Path(value.strip()).expanduser()
    if not path.is_absolute():
        raise ValueError('Codex 구성 디렉터리는 절대 경로여야 합니다.')
    # UNC WSL homes belong to the WSL adapter; stat can wake a stopped distro.
    if str(path).startswith(('\\\\', '//')):
        raise ValueError('통과해주세요 WSL 스캔하여 등록 WSL 예배 규칙서; 로컬 포털은 네트워크 디렉터리를 사용하지 않습니다.')
    path = path.resolve(strict=True)
    if not path.is_dir() or not any((path/name).exists() for name in ('config.toml', 'auth.json', 'sessions', 'app-server-control')):
        raise ValueError('선택한 폴더가 존재하지 않습니다 Codex 구성 디렉토리')
    config = path/'config.toml'
    if config.is_file():
        try:
            settings = load_toml(config.read_text(encoding='utf-8'))
        except (ValueError, OSError) as exc:
            raise ValueError('선택한 디렉터리를 읽을 수 없습니다. config.toml') from exc
        sqlite = settings.get('sqlite_home')
        if sqlite and Path(sqlite).expanduser().resolve() != path:
            raise ValueError('이 구성의 sqlite_home 다른 디렉터리에 위치하며 현재 독립적인 액세스는 지원되지 않습니다.')
    return path


def local_entry_id(home):
    return 'codex:' + hashlib.sha256(os.path.normcase(str(Path(home))).encode()).hexdigest()[:32]


class Entries:
    def __init__(self, directory, desktop_home=None, local_factory=None):
        self.directory = Path(directory) / 'codex-entries'
        self.path = self.directory / 'entries.json'
        self.lock = threading.RLock()
        self.closed = threading.Event()
        self.bridges = {}
        self.candidates = {}
        self.wsl = None
        if sys.platform == 'win32':
            from bridge.platforms.windows import wsl
            self.wsl = wsl
        self.local_factory = local_factory
        self.desktop_home = Path(desktop_home).resolve() if desktop_home else None
        if self.path.exists():
            value = json.loads(self.path.read_text(encoding='utf-8'))
            if value.get('version') != 1 or not isinstance(value.get('entries'), list):
                raise ValueError('Codex 항목 구성을 인식할 수 없습니다.')
            self.entries = value['entries']
            for row in self.entries:
                expected = local_entry_id(row['home']) if row.get('kind') == 'codex-local' else entry_id(row['distribution'], row['user'], row['home'])
                if row.get('id') != expected:
                    raise ValueError('Codex 포털 ID가 일치하지 않습니다.')
        else:
            self.entries = []

    @staticmethod
    def public_row(row, enabled=False, running=False):
        return {'id': row['id'], 'label': row['label'], 'kind': row.get('kind', 'wsl-cli'),
                'distribution': row.get('distribution'), 'enabled': enabled, 'running': running,
                'accessManagement': 'external'}

    def public(self):
        with self.lock:
            running = self.wsl.displayed_distributions((*self.entries, *self.candidates.values())) if self.wsl else set()
            values = {r['id']: self.public_row(r, r.get('enabled', True), True if r.get('kind') == 'codex-local'
                                              else None if running is None else r.get('distribution') in running)
                      for r in self.entries}
            for key, row in self.candidates.items():
                values.setdefault(key, self.public_row(row, False, True if row.get('kind') == 'codex-local'
                                                      else None if running is None else row.get('distribution') in running))
            return {'wslSupported': self.wsl is not None,
                    'entries': [{'id': 'desktop', 'label': '데스크탑 Codex', 'kind': 'desktop',
                                 'enabled': True, 'running': True}, *values.values()]}

    def scan(self):
        # First full inventory or explicit scan only; never periodic probing.
        if not self.wsl:
            raise ValueError('현재 컴퓨터는 지원하지 않습니다. WSL 애플리케이션')
        candidates, errors = {}, []
        for distribution in self.wsl.running_distributions():
            try:
                info = self.wsl.probe(distribution)
                for item in info.get('homes', []):
                    identifier = entry_id(distribution, info['user'], item['home'])
                    candidates[identifier] = {'id': identifier, 'distribution': distribution,
                        'user': info['user'], 'home': item['home'],
                        'windowsHome': item.get('windowsHome'),
                        'label': 'WSL · ' + distribution + ' · ' + info['user'] +
                                 ('' if item['home'] == info.get('userHome', '') + '/.codex' else ' · ' + item['home'])}
            except (OSError, ValueError, TimeoutError):
                errors.append({'distribution': distribution, 'error': '읽을 수 있는 항목이 없습니다. Codex 환경이나 Python'})
        with self.lock:
            self.candidates = candidates
        return {**self.public(), 'errors': errors}

    def local_profiles(self, scan=False):
        with self.lock:
            rows = [dict(row) for row in self.entries if row.get('kind') == 'codex-local']
        candidates, seen = [], {row['id'] for row in rows}
        if scan:
            # Explicit, shallow and bounded. Never recursively search disks or read credentials.
            for parent in {Path.home(), self.desktop_home.parent if self.desktop_home else Path.home()}:
                for candidate in sorted(parent.glob('.codex*'))[:256]:
                    try:
                        home = local_home(str(candidate)); identifier = local_entry_id(home)
                        if identifier in seen or (self.desktop_home and home.samefile(self.desktop_home)):
                            continue
                        seen.add(identifier)
                        candidates.append({'id': identifier, 'home': str(home), 'label': 'Codex · ' + home.name})
                    except (OSError, ValueError):
                        continue
        return {'profiles': rows, 'candidates': candidates}

    def save_wsl(self, distribution, user, home, label):
        if self.wsl is None:
            raise ValueError('현재 컴퓨터는 지원하지 않습니다. WSL 애플리케이션')
        if (not isinstance(label, str) or not 1 <= len(label.strip()) <= 80
                or any(ord(c) < 32 or ord(c) == 127 for c in label)):
            raise ValueError("제어 문자 없이 1~80자의 연결 이름을 입력합니다.")
        info = self.wsl.probe(distribution, user, home=home)
        if info.get('user') != user or len(info.get('homes', [])) != 1:
            raise ValueError("선택한 WSL 사용자 및 구성 디렉터리를 확인할 수 없습니다.")
        selected = info['homes'][0]
        identifier = entry_id(distribution, user, selected['home'])
        candidate = {'id': identifier, 'distribution': distribution, 'user': user,
                     'home': selected['home'], 'windowsHome': selected.get('windowsHome'), 'label': label.strip()}
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

    def save_local(self, home, label):
        home = local_home(home)
        if not isinstance(label, str) or not label.strip() or len(label.strip()) > 80:
            raise ValueError('입력해주세요 1–80 액세스 이름')
        identifier = local_entry_id(home)
        with self.lock:
            if self.desktop_home and home.samefile(self.desktop_home):
                raise ValueError('이 디렉터리는 기본적으로 이미 구성되어 있습니다. Codex 접근 및 사용, 반복적으로 추가할 수 없음')
            if any(row['id'] == identifier or (row.get('kind') == 'codex-local' and
                    Path(row['home']).exists() and home.samefile(row['home'])) for row in self.entries):
                raise ValueError('이 Codex 구성 디렉터리가 등록되었습니다. 기존 입구를 이용하세요.')
            if len(self.entries) >= 16:
                raise ValueError('가장 많이 등록된 16 개인 Codex 입구')
            self.entries.append({'id': identifier, 'kind': 'codex-local', 'home': str(home),
                                 'label': label.strip(), 'enabled': True,
                                 'directoryIdentity': [home.stat().st_dev, home.stat().st_ino]})
            self.directory.mkdir(parents=True, exist_ok=True)
            private_json(self.path, {'version': 1, 'entries': self.entries})
        return {'entry': identifier, **self.local_profiles()}

    def enabled(self, identifier):
        with self.lock:
            return any(row['id'] == identifier and row.get('enabled', True) for row in self.entries)

    def remove_local(self, identifier):
        with self.lock:
            row = next((row for row in self.entries if row['id'] == identifier and row.get('kind') == 'codex-local'), None)
            if row is None:
                raise ValueError('Codex 액세스 인스턴스가 등록되지 않았습니다.')
            if row.get('enabled', True):
                raise ValueError('구성을 제거하기 전에 이 클라이언트에 대한 모바일 액세스를 비활성화하십시오.')
            owner = self.bridges.get(identifier)
            if owner and not owner.entry_gate.acquire(timeout=3):
                raise ValueError("이 클라이언트는 작업을 처리 중입니다. 나중에 해당 구성을 다시 제거해 보세요.")
            try:
                if owner:
                    owner.assert_detachable()
                    self.bridges.pop(identifier, None)
                    owner.close()
                remaining = [row for row in self.entries if row['id'] != identifier]
                private_json(self.path, {'version': 1, 'entries': remaining})
                self.entries = remaining
            finally:
                if owner:
                    owner.entry_gate.release()

    def hosts(self):
        with self.lock:
            return {row['id']: {'label': row['label'], 'kind': row.get('kind', 'wsl-cli')}
                    for row in self.entries if row.get('enabled', True)}

    def applications(self):
        """Display inventory only; never connect or probe a daemon while polling."""
        rows = []
        for row in self.public()['entries']:
            if row['kind'] == 'codex-local':
                with self.lock:
                    bridge = self.bridges.get(row['id'])
                    connected = bool(bridge and any(session.connected for session in list(bridge.live.values())))
                rows.append({'id': row['id'], 'name': row['label'], 'kind': 'codex-local', 'icon': 'codex',
                             'installed': True, 'configured': True, 'enabled': row['enabled'], 'selectable': True,
                             'connected': connected, 'running': True if connected else None, 'setupStatus': 'ready',
                             'canQuitDesktop': False, 'canForceQuit': False,
                             'description': '독립적인 Codex 설정 · VS Code / CLI',
                             'capabilities': {'create': True, 'accounts': True, 'notifications': True},
                             'reason': '계정, 프로젝트 및 세션을 독립적으로 관리。'})
                continue
            if row['kind'] != 'wsl-cli':
                continue
            with self.lock:
                bridge = self.bridges.get(row['id'])
                server = bridge.server if bridge else None
                connected = bool(server and not server.closed and row['enabled'])
            rows.append({'id': row['id'], 'name': 'WSL Codex · ' + row['label'].removeprefix('WSL · '),
                         'kind': 'wsl-cli', 'icon': 'codex', 'installed': True, 'configured': True,
                         'enabled': row['enabled'], 'selectable': True, 'connected': connected,
                         'running': True if connected else False if row['running'] is False else None,
                         'distributionRunning': row['running'],
                         'setupStatus': 'ready', 'canQuitDesktop': False, 'canForceQuit': False,
                         'reason': ("휴대폰에서 WSL 채팅을 생성 및 재개하고 게이트웨이에서 API 프로필을 관리하세요. 원래 Codex CLI에서 공식 로그인을 완료하세요."
                                    if row['running'] is not False else "등록된 WSL 환경을 시작합니다. 채팅을 계속하면 네이티브 CLI가 연결됩니다.")})
        return rows

    def configure(self, identifier, enabled, *, _manual=False):
        if not isinstance(enabled, bool):
            raise ValueError('입구 스위치가 잘못되었습니다.')
        if not isinstance(identifier, str) or not re.fullmatch(r'(?:wsl|codex):[0-9a-f]{32}', identifier):
            raise ValueError('Codex 입구 ID가 잘못되었습니다. 먼저 구성을 스캔하거나 추가하세요.')
        with self.lock:
            row = next((r for r in self.entries if r['id'] == identifier), None)
            if _manual and row is not None:
                raise ValueError("이 WSL 구성 디렉터리는 이미 등록되어 있습니다. 기존 항목을 사용합니다.")
            if row is None:
                candidate = self.candidates.get(identifier)
                if candidate is None or not enabled:
                    raise ValueError('기존 항목을 스캔하고 선택하세요. WSL 입구')
                if self.desktop_home is not None and candidate.get('windowsHome'):
                    # Linux probe canonicalizes home before wslpath conversion.
                    # Never stat a WSL UNC path: that can hang or wake a distro.
                    def normalized(path):
                        return str(PureWindowsPath(path)).casefold().rstrip('\\').replace('\\\\wsl$\\', '\\\\wsl.localhost\\', 1)
                    if normalized(candidate['windowsHome']) == normalized(self.desktop_home):
                        raise ValueError('이 WSL 입구와 데스크탑이 동일하게 공유됩니다. Codex 디렉터리, 반복적으로 액세스할 수 없음')
                if len(self.entries) >= 16:
                    raise ValueError('가장 많이 등록된 16 개인 WSL 입구')
                row = dict(candidate)
                if not _manual:
                    self.entries.append(row)
            row['enabled'] = enabled
            self.directory.mkdir(parents=True, exist_ok=True)
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
            old = self.bridges.pop(identifier, None) if not enabled else None
            if old is not None:
                old.close()
        return self.public()

    def check_ipc_scope(self, identifier, thread_id, default_store):
        # Windows shares one native IPC pipe. A cloned UUID cannot identify a home.
        from bridge.features.sessions.store import SessionStore, StoreUnavailable
        from bridge.clients.codex.ipc import IPCError
        with self.lock:
            homes = [row['home'] for row in self.entries if row.get('kind') == 'codex-local' and row['id'] != identifier]
        for store in [default_store, *(SessionStore(home) for home in homes)]:
            try:
                if not any(store.home.glob('state_*.sqlite')):
                    continue
                store.get(thread_id)
            except KeyError:
                continue
            except (OSError, StoreUnavailable) as exc:
                raise IPCError('공유를 확인할 수 없습니다. IPC 의 구성 소유권, 다른 실행자는 연결되어 있지 않습니다.') from exc
            raise IPCError('다른 Codex 동일한 구성이 존재합니다. ID 세션, 원본을 확인할 수 없음 owner 소유; 다른 실행자는 연결되어 있지 않습니다')

    def get(self, identifier, *, management=False):
        with self.lock:
            if self.closed.is_set():
                raise KeyError('게이트웨이가 중지 중입니다.')
            row = next((r for r in self.entries if r['id'] == identifier and (r.get('enabled', True) or management and r.get('kind') == 'codex-local')), None)
            if row is None:
                raise KeyError('Codex 입구가 등록되지 않았거나 닫혔습니다.')
            if row.get('kind') == 'codex-local':
                home = local_home(row['home'])
                if (local_entry_id(home) != identifier or (self.desktop_home and home.samefile(self.desktop_home))
                        or row.get('directoryIdentity') != [home.stat().st_dev, home.stat().st_ino]):
                    raise ValueError('Codex 구성 디렉터리 ID가 변경되었습니다. 다시 구성하세요.')
            if identifier not in self.bridges:
                if row.get('kind') == 'codex-local':
                    if self.local_factory is None:
                        raise ValueError('로컬 구성 액세스를 사용할 수 없습니다.')
                    self.bridges[identifier] = self.local_factory(row, self.directory / identifier.replace(':', '-'))
                else:
                    from bridge.features.endpoints.wsl import WslEntry
                    self.bridges[identifier] = WslEntry(row, self.directory / identifier[4:])
            return self.bridges[identifier]

    def lists(self, **options):
        with self.lock:
            identifiers = [r['id'] for r in self.entries if r.get('enabled', True)]
        groups, errors = [], []
        for identifier in identifiers:
            try:
                groups.extend(self.get(identifier).list(**options))
            except (OSError, ValueError, RemoteUnavailable) as exc:
                errors.append({'host': identifier, 'label': 'WSL', 'error': str(exc)})
        return groups, errors

    def close(self):
        self.closed.set()
        with self.lock:
            values = list(self.bridges.values())
            self.bridges.clear()
        for bridge in values:
            bridge.close()
