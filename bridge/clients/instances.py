"""Lazy execution owners for registered native profiles; default owners stay put."""
from functools import partial
from contextlib import nullcontext
import json
import os
from pathlib import Path
import sys
import threading

from bridge.clients.profiles import NativeProfile, resolve_profile
from bridge.features.clients.instances import Instances
from bridge.features.auth.auth import replace_session_file
from bridge.platforms import discovery


class ClientInstances:
    def __init__(self, manager):
        self.manager = manager
        self.lock = threading.RLock()
        self.children = {}
        self.error = None
        self.registry = Instances(manager.directory.parent,
            resolvers={(family, 'desktop-profile'): partial(resolve_profile, family)
                       for family in ('claude', 'deepseek')},
            defaults=self.defaults, codex=getattr(manager.bridge, 'entries', None))

    def defaults(self):
        """Reserve the actual default roots, including native API/CLI siblings."""
        manager = self.manager
        home = Path.home()
        selected = manager.config.get('discovered', {})
        for family, row in selected.items():
            executable = row.get('executable')
            if family not in ('codex', 'claude', 'deepseek', 'zcode') or not executable:
                continue
            executable = Path(executable).expanduser().resolve()
            if executable.is_file():
                installation = next((part for part in executable.parents if part.suffix == '.app'), executable.parent)
                yield NativeProfile(family, 'installation', installation, {'application': installation})
        claude = Path(selected.get('claude', {}).get('dataDirectory') or
                      discovery(sys.platform).claude_home(home, os.environ)).expanduser().resolve()
        base = Path(str(claude)[:-3]) if str(claude).endswith('-3p') else claude
        code = Path(os.environ.get('CLAUDE_CONFIG_DIR') or home/'.claude').expanduser().resolve()
        claude_roots = {'userData': base, 'thirdParty': Path(str(base)+'-3p'), 'code': code}
        if sys.platform == 'win32':
            # Native 3p uses Local AppData even when the active official profile
            # is Roaming/Store userData; old Roaming 3p is a migration source.
            for name, key in (('nativeThirdParty', 'LOCALAPPDATA'), ('legacyThirdParty', 'APPDATA')):
                if os.environ.get(key):
                    claude_roots[name] = Path(os.environ[key]).expanduser().resolve()/'Claude-3p'
        yield NativeProfile('claude', 'default', base, claude_roots)
        dsh = Path(manager.config.get('deepseekHome') or selected.get('deepseek', {}).get('dataDirectory') or
                   os.environ.get('DSH_HOME') or home/'.dsh').expanduser().resolve()
        ui_base = (home/'Library/Application Support' if sys.platform == 'darwin' else
                   Path(os.environ.get('APPDATA') or home/'AppData/Roaming') if sys.platform == 'win32' else
                   Path(os.environ.get('XDG_CONFIG_HOME') or home/'.config'))
        dsh_roots = {'runtimeHome': dsh, 'userData': ui_base/'@deepseek-ai/dsh-desktop'}
        if sys.platform == 'win32':
            # Both packaged names are in use by installed official Windows
            # builds. Reserve their UI data without inspecting its contents.
            dsh_roots.update(desktopUserData=ui_base/'DSH Desktop', legacyUserData=ui_base/'DSH')
        yield NativeProfile('deepseek', 'default', dsh, dsh_roots)
        entries = getattr(manager.bridge, 'entries', None)
        if entries is not None and entries.desktop_home:
            yield NativeProfile('codex', 'default', entries.desktop_home, {'config': entries.desktop_home})

    def capabilities(self, family=None):
        target = family
        result = ([{'family': 'codex', 'kind': 'codex-local',
                    'supported': self.registry.codex is not None}] if target in (None, 'codex') else [])
        for family in ('claude', 'deepseek'):
            if target not in (None, family):
                continue
            reason = ''
            try:
                resolve_profile(family, self.manager.directory.parent)
                if family == 'claude' and sys.platform == 'linux':
                    raise ValueError('현재 Linux 아직 제공되지 않음 Claude 기본 데스크탑 액세스, 실행 가능한 독립 구성을 추가할 수 없음')
            except ValueError as exc:
                reason = str(exc)
            result.append({'family': family, 'kind': 'desktop-profile', 'supported': not reason,
                           **({'reason': reason} if reason else {})})
        if target in (None, 'zcode'):
            result.append(self.manager.zcode_application_capability())
        if target in (None, 'antigravity'):
            result.append(self.manager.antigravity_application_capability())
        if sys.platform == 'win32':
            for row in result:
                if row['family'] in ('codex', 'claude'):
                    registry = self.registry.codex if row['family'] == 'codex' else self.manager.claude_wsl
                    row['wslSupported'] = registry is not None
        return result

    def metadata(self, family=None):
        """Passive aggregation failures cannot take the default clients offline."""
        try:
            rows = self.registry.list(family)
            self.error = None
            return rows
        except (ValueError, OSError):
            self.error = '일시적으로 독립접속 구성을 할 수 없습니다. 클라이언트 및 접속에서 다시 확인해 주시기 바랍니다.'
            return []

    def default_claude_home(self):
        profile = next(value for value in self.defaults() if value.family == 'claude')
        # Keep ordinary Windows native package/profile selection unchanged.
        previous = self.manager.config.get('discovered', {}).get('claude', {}).get('dataDirectory')
        if sys.platform == 'win32':
            return previous or str(profile.home)
        return str(_claude_mode_home(profile))

    def rows(self):
        result = []
        for row in self.metadata():
            if row['family'] == 'codex':
                continue  # Existing Entries owns its runtime/status contract.
            child = self.children.get(row['id'])
            try:
                snapshot = child.clients_status() if child is not None else None
            except (ValueError, OSError):
                snapshot = {'clients': [{'id': row['family'], 'setupStatus': 'failed',
                    'connected': False, 'configured': False, 'reason': '이 독립적인 액세스는 일시적으로 사용할 수 없습니다. 구성 디렉터리를 다시 확인하세요.'}]}
            live = next((value for value in (snapshot or {}).get('clients', [])
                         if value.get('id') == row['family']), {})
            installed = self.manager.config.get('discovered', {}).get(row['family'], {}).get('installed') is True
            result.append({'installed': installed, 'configured': False, 'connected': False, 'running': False,
                'selectable': True, 'setupStatus': 'registered', 'reason': '독립 구성이 저장되었으며 아직 원래 애플리케이션에 연결되지 않았습니다.',
                **live, **row, 'name': row['label'], 'icon': row['family'], 'entry': row['id'],
                'capabilities': {**live.get('capabilities', {}), 'accounts': True}})
        return result

    def resolve(self, family, entry, require_enabled=True):
        with self.lock:
            return self._resolve(family, entry, require_enabled)

    def _resolve(self, family, entry, require_enabled):
        selected = self.registry.resolve(family, entry, require_enabled=require_enabled)
        if selected is None:
            if require_enabled:
                self.manager.require_enabled(family)
            return self.manager
        if family == 'codex':
            raise ValueError('Codex 독립적인 구성은 기존을 사용합니다. Codex 세션 인터페이스')
        supported = next(row for row in self.capabilities(family) if row['family'] == family)
        if not supported['supported']:
            raise ValueError(supported['reason'])
        with self.lock:
            child = self.children.get(entry)
            if child is None:
                from bridge.clients.manager import DesktopSessions
                child = DesktopSessions(selected.state_root, gateway_running=self.manager.gateway_running,
                                        instance=selected, instance_owner=self)
                self.children[entry] = child
                try:
                    child.scan(scan_wsl=False)
                except Exception:
                    self.children.pop(entry, None)
                    child.close()
                    raise
            child.instance = selected
            return child

    def descriptor(self, child, family):
        selected = self.registry.resolve(family, child.instance.id, require_enabled=False)
        child.instance = selected
        row = dict(self.manager.config.get('discovered', {}).get(family, {}))
        if not row:
            from bridge.clients.discovery import discover_clients
            row = discover_clients()[family]
        active_home = _claude_mode_home(selected.profile) if family == 'claude' else selected.profile.home
        return {**row, 'id': family, 'dataDirectory': str(active_home),
            'dataDirectoryExplicit': True, 'nativeProfile': selected.profile,
            'profileLaunchReceipt': selected.state_root/'native-launch.json',
            'profileGuard': lambda: self.registry.resolve(family, selected.id, require_enabled=False),
            'profileInitialized': lambda: self.registry.pin_initialized_roots(selected.id)}

    def control(self, value):
        allowed = {'action', 'operation', 'family', 'kind', 'label', 'home', 'application', 'entry', 'confirmed', 'distribution', 'user'}
        if not isinstance(value, dict) or set(value)-allowed:
            raise ValueError('독립적인 구성 관리 요청이 잘못되었습니다.')
        operation = value.get('operation', 'list')
        family = value.get('family')
        if operation in ('list', 'scan'):
            if set(value)-{'action', 'operation', 'family', 'kind'}:
                raise ValueError('독립형 구성 검사 요청이 잘못되었습니다.')
            rows = self.registry.list(family)
            result = {'instances': [{**row, 'name': row['label']} for row in rows],
                      'capabilities': self.capabilities()}
            if operation == 'scan':
                candidates = []
                if family in (None, 'codex') and self.registry.codex is not None:
                    for row in self.registry.codex.local_profiles(scan=True).get('candidates', []):
                        candidates.append({**row, 'family': 'codex', 'kind': 'codex-local'})
                # Native profiles have no machine-wide index. Reuse only explicit
                # registrations; choosing a folder does not import any accounts.
                result['candidates'] = candidates
            return result
        if operation == 'remove':
            if set(value)-{'action', 'operation'} != {'family', 'entry', 'confirmed'} or value['confirmed'] is not True:
                raise ValueError("이 클라이언트 구성 제거를 확인하세요.")
            entry = value['entry']
            with self.manager.client_lock, self.lock:
                row = next((row for row in self.registry.list(family) if row['id'] == entry), None)
                if row is None:
                    raise ValueError('액세스 인스턴스가 등록되지 않았습니다.')
                if row['enabled']:
                    raise ValueError('구성을 제거하기 전에 이 클라이언트에 대한 모바일 액세스를 비활성화하십시오.')
                child = self.children.get(entry)
                lock = child.locks[family] if child else None
                if lock and not lock.acquire(timeout=3):
                    raise ValueError("이 클라이언트는 작업을 처리 중입니다. 나중에 해당 구성을 다시 제거해 보세요.")
                try:
                    with child._changing(family) if child else nullcontext():
                        if child:
                            child.assert_detachable()
                        if child:
                            self.children.pop(entry, None)
                            child.close()
                        self.registry.remove(family, entry)
                finally:
                    if lock:
                        lock.release()
                self.manager.client_cache = None
            return {'removed': entry, 'instances': self.registry.list(), 'capabilities': self.capabilities()}
        if operation == 'save' and family in ('zcode', 'antigravity') and value.get('kind') == 'default-application':
            if set(value)-{'action', 'operation'} != {'family', 'kind', 'application'}:
                raise ValueError("클라이언트 구성 요청이 잘못되었습니다.")
            register = self.manager.register_zcode_application if family == 'zcode' else self.manager.register_antigravity_application
            return register(value['application'])
        if operation == 'save' and value.get('kind') == 'wsl-cli':
            if (sys.platform != 'win32' or family not in ('codex', 'claude')
                    or set(value)-{'action', 'operation'} != {'family', 'kind', 'label', 'home', 'distribution', 'user'}):
                raise ValueError("WSL 클라이언트 등록 요청이 잘못되었습니다.")
            registry = self.registry.codex if family == 'codex' else self.manager.claude_wsl
            if registry is None:
                raise ValueError('현재 컴퓨터는 지원하지 않습니다. WSL 애플리케이션')
            identifier = registry.save_wsl(value['distribution'], value['user'], value['home'], value['label'])
            self.manager.client_cache = None
            return {'entry': identifier, 'instances': self.registry.list(), 'capabilities': self.capabilities()}
        if operation != 'save' or set(value)-{'action', 'operation'} != {'family', 'kind', 'label', 'home'}:
            raise ValueError('독립형 구성 저장 요청이 잘못되었습니다.')
        capability = next((row for row in self.capabilities() if row['family'] == family), None)
        if not capability or not capability['supported']:
            raise ValueError((capability or {}).get('reason', '현재 플랫폼은 이러한 독립적인 액세스를 지원하지 않습니다.'))
        row = self.registry.register({key: value[key] for key in ('family', 'kind', 'label', 'home')})
        self.manager.client_cache = None
        return {'instance': {**row, 'name': row['label']}, 'entry': row['id'],
                'instances': self.registry.list(), 'capabilities': self.capabilities()}

    def close(self):
        with self.lock:
            children = list(self.children.values())
            self.children.clear()
        for child in children:
            child.close()


def _claude_mode_home(profile):
    mode = profile.roots['userData']/'claude_desktop_config.json'
    if mode.is_file():
        if mode.is_symlink() or mode.stat().st_size > 1024*1024:
            raise ValueError('Claude 모드 구성을 읽을 수 없습니다.')
        settings = json.loads(mode.read_text(encoding='utf-8-sig'))
        if not isinstance(settings, dict):
            raise ValueError('Claude 모드 구성을 읽을 수 없습니다.')
        if settings.get('deploymentMode') == '3p':
            return profile.roots['thirdParty']
    return profile.roots['userData']


def scan_profile(manager):
    """Bind installed code to explicit data roots without launching or logging in."""
    family = manager.instance.family
    row = manager._descriptor(family)
    public = {key: value for key, value in row.items() if not key.startswith('profile') and key != 'nativeProfile'}
    manager.config['discovered'] = {family: public}
    if row.get('installed'):
        adapter = manager.adapters[family]
        if family == 'claude':
            adapter.configure(row['executable'], row['dataDirectory'], explicit_home=True)
        else:
            manager.config['deepseekHome'] = row['dataDirectory']
            installed = adapter.discover_existing()
            if installed.get('reused'):
                manager.config['deepseekAdapterDirectory'] = str(adapter.directory)
    replace_session_file(manager.config_path, json.dumps(manager.config).encode())
    manager.client_cache = None
    return manager.clients(refresh=True)


def prepare_deepseek_profile(profile, descriptor=None):
    """Seed only the connector slot; native first launch owns all other setup."""
    if profile.family != 'deepseek':
        raise ValueError('이 구성은 다음에 속하지 않습니다. DSH')
    directory = profile.home/'profiles/desktop'
    for path in (profile.home/'profiles', directory, directory/'cordis.patch.yml',
                 directory/'package.json', directory/'pnpm-workspace.yaml'):
        if path.is_symlink() or path.resolve() != path:
            raise ValueError('DSH 독립형 구성의 플러그인 디렉터리는 다른 위치로 리디렉션될 수 없습니다.')
    if descriptor is not None:
        from bridge.clients.deepseek.profile import prepare
        if prepare(profile, descriptor):
            return
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = directory/'cordis.patch.yml'
    try:
        with target.open('x', encoding='utf-8') as stream:
            stream.write('# Bridge native profile connector\n')
        target.chmod(0o600)
    except FileExistsError:
        pass


def require_deepseek_account(manager, action, sid, body):
    """Never let a Bridge write borrow credentials from DSH's login shell."""
    adapter = manager.adapters['deepseek']
    if action == 'respond' and body.get('decision') in ('decline', 'deny') and 'answers' not in body:
        requests = adapter.call('detail', sid, {}).get('session', {}).get('requests', [])
        if any(isinstance(row, dict) and row.get('id') == body.get('requestId') and row.get('needsInput') is False
               for row in requests):
            return  # A real approval rejection cannot start a model turn.
    generates = action in ('send', 'compact', 'edit-message', 'respond') or (
        action == 'goal' and body.get('operation') not in ('pause', 'clear'))
    selection = action == 'settings' and any(key in body for key in ('model', 'effort'))
    creation = action == 'create' and any(body.get(key) for key in ('model', 'firstMessage', 'text'))
    if not (generates or selection or creation):
        return
    account = adapter.call('account', sid)
    sources = account.get('sources', [])
    if type(account.get('credentialSourcesVersion')) is not int or account['credentialSourcesVersion'] != 1:
        raise ValueError('이 독립 DSH 연결이 계정 소스를 제공하지 않았습니다. 독립적으로 구성된 연결을 준비한 후 다시 시도하십시오.')
    if not isinstance(sources, list) or not sources:
        raise ValueError('먼저 여기서 독립해주세요 DSH 구성에서 계정 또는 애플리케이션에 로그인 API 연결')
    # send does not apply body.model. Trust only the actual native selection for
    # generation, so a forged request cannot substitute an allowed route here.
    model = body.get('model') if selection or creation else None
    provider = ((account.get('current') or {}).get('id') if model is None else
                model.split('/', 1)[0] if isinstance(model, str) and '/' in model else None)
    source = next((row for row in sources if isinstance(row, dict) and row.get('id') == provider), {})
    if source.get('credentialSource') != 'file':
        raise ValueError('선택한 모델은 이 독립 구성에 저장된 계정과 일치하지 않습니다. 먼저 이 계정의 모델을 선택하세요.')
