"""Explicit client instances; registration never starts or authenticates an App."""
from dataclasses import dataclass
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import threading
from types import MappingProxyType

from bridge.clients.profiles import NativeProfile
from bridge.features.auth.auth import replace_session_file, session_file_lock
from bridge.features.endpoints.registry import local_entry_id, local_home


FAMILIES = ('codex', 'claude', 'deepseek', 'zcode', 'antigravity')
ENTRY = re.compile(r'([a-z][a-z0-9-]{0,31}):([0-9a-f]{32})\Z')
RECORD_FIELDS = {'id', 'family', 'kind', 'label', 'home', 'roots'}
PROOF_FIELDS = {'path', 'identity', 'anchor', 'anchorIdentity'}
MAX_ENTRIES = 16


def _path(value):
    if (not isinstance(value, (str, Path)) or not str(value).strip()
            or re.search(r'[\x00-\x1f\x7f]', str(value))):
        raise ValueError('독립적인 구성 디렉터리를 선택하세요.')
    text = str(value).strip()
    if text.startswith(('\\\\', '//')):
        raise ValueError('독립형 데스크톱 액세스는 네트워크를 사용하지 않거나 WSL 폴더')
    result = Path(text).expanduser()
    if not result.is_absolute():
        raise ValueError('독립 구성 디렉터리는 절대 경로여야 합니다.')
    return result.resolve()


def _directory_identity(path):
    value = path.stat()
    if not stat.S_ISDIR(value.st_mode):
        raise ValueError('독립 구성 경로는 디렉터리여야 합니다.')
    return [value.st_dev, value.st_ino]


def _proof(value, *, required=False):
    path = _path(value)
    exists = path.exists()
    if required and not exists:
        raise ValueError('독립 구성 디렉터리가 존재하지 않습니다. 먼저 기존 디렉터리를 선택하세요.')
    identity = _directory_identity(path) if exists else None
    anchor = path
    while not anchor.exists():
        anchor = anchor.parent
    return {'path': str(path), 'identity': identity, 'anchor': str(anchor),
            'anchorIdentity': _directory_identity(anchor)}


def instance_id(family, home):
    """Keep Codex's existing path-derived identifier convention unchanged."""
    return family + ':' + hashlib.sha256(os.path.normcase(str(home)).encode()).hexdigest()[:32]


def _overlap(left, right):
    a, b = Path(os.path.normcase(left['path'])), Path(os.path.normcase(right['path']))
    return (a == b or a in b.parents or b in a.parents or
            left['identity'] is not None and left['identity'] == right['identity'])


def _label(value):
    if (not isinstance(value, str) or not 1 <= len(value.strip()) <= 80
            or re.search(r'[\x00-\x1f\x7f]', value)):
        raise ValueError("제어 문자 없이 1~80자의 연결 이름을 입력합니다.")
    return value.strip()


@dataclass(frozen=True)
class ResolvedInstance:
    id: str
    family: str
    kind: str
    label: str
    enabled: bool
    profile: NativeProfile
    gateway_root: Path
    state_root: Path
    pending_roots: tuple = ()


class Instances:
    """Own metadata only; native path semantics are supplied by trusted resolvers.

    ``defaults`` returns NativeProfile declarations for all reserved default
    roots. Codex metadata is delegated to the existing Entries object; resolving
    it here does not call Entries.get() or construct a native execution owner.
    """

    def __init__(self, gateway_root, *, resolvers=None, defaults=None, codex=None):
        self.gateway_root = Path(gateway_root).resolve()
        self.directory = self.gateway_root/'client-instances'
        self.path = self.directory/'entries.json'
        self.resolvers = dict(resolvers or {})
        self.defaults = defaults or (lambda: ())
        self.codex = codex
        self.lock = threading.RLock()

    def _family(self, value):
        if not isinstance(value, str) or value not in set(FAMILIES) | {key[0] for key in self.resolvers}:
            raise ValueError('알 수 없는 클라이언트 플랫폼')

    def _describe(self, profile, *, family=None, kind=None, home=None, required=True):
        if not isinstance(profile, NativeProfile):
            raise ValueError('기본 디렉터리 구문 분석기가 유효한 구성 선언을 제공하지 않았습니다.')
        if (family is not None and profile.family != family or kind is not None and profile.kind != kind
                or not isinstance(profile.roots, dict) and not hasattr(profile.roots, 'items')):
            raise ValueError('기본 구성 선언이 선택한 플랫폼 또는 액세스 방법과 일치하지 않습니다.')
        native_home = _path(profile.home)
        if home is not None and native_home != _path(home):
            raise ValueError('기본 디렉터리 확인자는 선택한 구성 디렉터리를 변경합니다.')
        if not profile.roots or any(not isinstance(key, str) or not re.fullmatch(r'[a-z][A-Za-z0-9]{0,39}', key)
                                    or key == 'home' for key in profile.roots):
            raise ValueError('기본 구성 디렉터리 선언이 잘못되었습니다.')
        roots = {'home': _proof(native_home, required=required)}
        roots.update((name, _proof(path)) for name, path in profile.roots.items())
        normalized = NativeProfile(profile.family, profile.kind, native_home,
                                   MappingProxyType({name: Path(proof['path']) for name, proof in roots.items() if name != 'home'}))
        return normalized, roots

    def _native(self, family, kind, home):
        if not isinstance(kind, str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', kind):
            raise ValueError('독립적 구성 액세스 방법이 잘못되었습니다.')
        resolver = self.resolvers.get((family, kind))
        if resolver is None:
            raise ValueError('이 플랫폼은 아직 입증된 독립적인 구성 방법을 제공하지 않습니다.')
        selected = _path(home)
        return self._describe(resolver(selected), family=family, kind=kind, home=selected)

    def _load(self):
        if any(path.is_symlink() or path.resolve() != path for path in (self.directory, self.path)):
            raise ValueError('등록 파일에 액세스하는 데 기호 링크를 사용할 수 없습니다.')
        if not self.path.exists():
            return []
        if self.path.stat().st_size > 1024*1024:
            raise ValueError('접근 등록 파일이 너무 큽니다.')
        value = json.loads(self.path.read_text(encoding='utf-8'))
        if (not isinstance(value, dict) or set(value) != {'version', 'entries'}
                or type(value['version']) is not int or value['version'] != 1
                or not isinstance(value['entries'], list) or len(value['entries']) > MAX_ENTRIES):
            raise ValueError('접근등록 형식을 인식할 수 없습니다.')
        seen = set()
        for row in value['entries']:
            if (not isinstance(row, dict) or set(row) != RECORD_FIELDS or row['family'] in ('codex', 'zcode')
                    or not isinstance(row['id'], str) or not ENTRY.fullmatch(row['id'])
                    or row['id'].split(':')[0] != row['family'] or row['id'] in seen
                    or not isinstance(row['kind'], str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', row['kind'])
                    or not isinstance(row['home'], str)
                    or row['id'] != instance_id(row['family'], Path(row['home']))
                    or not isinstance(row['roots'], dict) or 'home' not in row['roots']):
                raise ValueError('잘못된 액세스 등록 ID')
            _label(row['label'])
            for name, proof in row['roots'].items():
                if (not isinstance(name, str) or not re.fullmatch(r'[a-z][A-Za-z0-9]{0,39}', name)
                        or not isinstance(proof, dict) or set(proof) != PROOF_FIELDS
                        or any(not isinstance(proof[field], str) or not Path(proof[field]).is_absolute() for field in ('path', 'anchor'))
                        or any(not isinstance(proof[field], list) or len(proof[field]) != 2
                               or any(type(item) is not int or item < 0 for item in proof[field])
                               for field in ('anchorIdentity',))
                        or proof['identity'] is not None and (not isinstance(proof['identity'], list)
                            or len(proof['identity']) != 2 or any(type(item) is not int or item < 0 for item in proof['identity']))):
                    raise ValueError('액세스 디렉터리 ID 레코드가 잘못되었습니다.')
                if Path(proof['anchor']) not in (Path(proof['path']), *Path(proof['path']).parents):
                    raise ValueError('액세스 디렉터리의 상위 디렉터리 ID 레코드가 잘못되었습니다.')
            if row['roots']['home']['path'] != row['home'] or row['roots']['home']['identity'] is None:
                raise ValueError('홈 디렉터리에 액세스하기 위한 ID 레코드가 유효하지 않습니다.')
            seen.add(row['id'])
        return value['entries']

    def _codex_rows(self):
        return self.codex.local_profiles()['profiles'] if self.codex is not None else []

    def _state_root(self, entry):
        return self.directory/entry.replace(':', '-')

    def _settings_path(self, entry):
        root = self._state_root(entry)
        path = root/'desktop-sessions/settings.json'
        if any(value.is_symlink() or value.resolve() != value for value in (self.directory, root, path.parent, path)):
            raise ValueError('인스턴스 상태 디렉터리는 심볼릭 링크를 사용할 수 없습니다.')
        return path

    def _settings(self, entry):
        path = self._settings_path(entry)
        if not path.exists():
            return {}
        value = json.loads(path.read_text(encoding='utf-8-sig'))
        if not isinstance(value, dict) or not isinstance(value.get('enabled', {}), dict):
            raise ValueError('인스턴스 활성화 구성 형식이 잘못되었습니다.')
        return value

    def _enabled(self, row):
        value = self._settings(row['id']).get('enabled', {}).get(row['family'], False)
        if type(value) is not bool:
            raise ValueError('인스턴스 활성화 스위치 형식이 잘못되었습니다.')
        return value

    def _public(self, row):
        return {**{key: row[key] for key in ('id', 'family', 'kind', 'label', 'home')},
                'enabled': self._enabled(row)}

    def _default_claims(self):
        for profile in self.defaults():
            yield self._describe(profile, required=False)[1]
        if self.codex is not None and self.codex.desktop_home is not None:
            yield {'home': _proof(self.codex.desktop_home)}

    def _check_conflicts(self, roots, rows, *, excluding=None):
        gateway = _proof(self.gateway_root)
        if any(_overlap(root, gateway) for root in roots.values()):
            raise ValueError('기본 구성 디렉터리는 게이트웨이 데이터 디렉터리와 겹칠 수 없습니다.')
        for defaults in self._default_claims():
            if any(_overlap(a, b) for a in roots.values() for b in defaults.values()):
                raise ValueError('선택한 디렉터리는 기본 접근 권한과 중복되며, 계정 디렉터리는 반복적으로 추가하거나 공유할 수 없습니다.')
        for row in rows:
            if row['id'] == excluding:
                continue
            # Another unavailable native directory must not block this instance.
            # Its reserved paths and pinned inodes are sufficient: its own
            # resolve/pin must verify any newly created directories before use.
            if any(_overlap(a, b) for a in roots.values() for b in row['roots'].values()):
                raise ValueError('선택한 디렉토리가 등록된 접근권한과 중복됩니다. 기존 출입구를 이용해주세요.')
        for row in self._codex_rows():
            if row['id'] == excluding:
                continue
            if any(_overlap(a, _proof(row['home'])) for a in roots.values()):
                raise ValueError('디렉토리를 선택하고 등록함 Codex 액세스 중복')

    def _write(self, rows):
        replace_session_file(self.path, json.dumps({'version': 1, 'entries': rows}, ensure_ascii=False).encode('utf-8'))

    @contextmanager
    def _registration_lock(self):
        with self.lock:
            if self.directory.is_symlink() or self.directory.resolve() != self.directory:
                raise ValueError('등록 디렉터리에 액세스하는 데 기호 링크를 사용할 수 없습니다.')
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            with session_file_lock(self.path):
                yield

    def register(self, value):
        if not isinstance(value, dict) or set(value) != {'family', 'kind', 'label', 'home'}:
            raise ValueError('새 액세스 요청에 알 수 없거나 누락된 필드가 포함되어 있습니다.')
        family, kind = value['family'], value['kind']
        self._family(family)
        label = _label(value['label'])
        if family == 'zcode':
            raise ValueError('ZCode 기본 액세스만 사용하고 두 번째 구성 세트를 추가하지 마세요.')
        if family == 'codex':
            if kind != 'codex-local' or self.codex is None:
                raise ValueError('기존을 이용해주세요 Codex 액세스 방법을 독립적으로 구성')
            home = local_home(value['home'])
            with self._registration_lock():
                self._check_conflicts({'home': _proof(home, required=True)}, self._load())
                result = self.codex.save_local(str(home), label)
            return next(row for row in self.list('codex') if row['id'] == result['entry'])
        profile, roots = self._native(family, kind, value['home'])
        row = {'id': instance_id(family, profile.home), 'family': family, 'kind': kind,
               'label': label, 'home': str(profile.home), 'roots': roots}
        with self._registration_lock():
            rows = self._load()
            if len(rows) >= MAX_ENTRIES:
                raise ValueError('가장 많이 등록된 16 독립적인 클라이언트 구성')
            self._check_conflicts(roots, rows)
            self._write([*rows, row])
        return self._public(row)

    def list(self, family=None):
        if family is not None:
            self._family(family)
        with self.lock:
            rows = [self._public(row) for row in self._load() if family is None or row['family'] == family]
            if family in (None, 'codex'):
                rows.extend({'id': row['id'], 'family': 'codex', 'kind': 'codex-local',
                             'label': row['label'], 'home': row['home'], 'enabled': row.get('enabled', True)}
                            for row in self._codex_rows())
            return rows

    def remove(self, family, entry):
        """Forget an explicit registration, never its native or private files."""
        self._family(family)
        if not isinstance(entry, str) or not ENTRY.fullmatch(entry) or entry.split(':')[0] != family:
            raise ValueError("추가된 독립 클라이언트만 제거할 수 있습니다.")
        with self._registration_lock():
            if family == 'codex' and self.codex is not None:
                self.codex.remove_local(entry)
                return
            rows = self._load()
            row = next((row for row in rows if row['id'] == entry), None)
            if row is None:
                raise ValueError('액세스 인스턴스가 등록되지 않았습니다.')
            if self._enabled(row):
                raise ValueError('구성을 제거하기 전에 이 클라이언트에 대한 모바일 액세스를 비활성화하십시오.')
            self._write([row for row in rows if row['id'] != entry])

    def _checked(self, row):
        profile, roots = self._native(row['family'], row['kind'], row['home'])
        if instance_id(row['family'], profile.home) != row['id'] or set(roots) != set(row['roots']):
            raise ValueError('기본 구성 디렉터리 설명이 변경되었습니다. 다시 구성하세요.')
        pending = []
        for name, saved in row['roots'].items():
            current = roots[name]
            if (current['path'] != saved['path'] or
                    _directory_identity(Path(saved['anchor'])) != saved['anchorIdentity'] or
                    saved['identity'] is not None and current['identity'] != saved['identity']):
                raise ValueError('독립 구성 디렉터리의 ID가 변경되었습니다. 다시 구성하세요.')
            if saved['identity'] is None and current['identity'] is not None:
                pending.append(name)
        return profile, roots, tuple(pending)

    def resolve(self, family, entry=None, *, require_enabled=True):
        self._family(family)
        if entry is None or entry == family or family == 'codex' and entry == 'desktop':
            return None
        if not isinstance(entry, str) or not ENTRY.fullmatch(entry) or entry.split(':')[0] != family:
            raise ValueError('액세스 인스턴스가 플랫폼과 일치하지 않습니다.')
        if family == 'codex':
            row = next((r for r in self._codex_rows() if r['id'] == entry), None)
            if row is None:
                raise ValueError('Codex 액세스 인스턴스가 등록되지 않았습니다.')
            if require_enabled and not row.get('enabled', True):
                raise ValueError('이 액세스 인스턴스가 닫혔습니다.')
            home = local_home(row['home'])
            if local_entry_id(home) != entry or _directory_identity(home) != row.get('directoryIdentity'):
                raise ValueError('Codex 구성 디렉터리 ID가 변경되었습니다. 다시 구성하세요.')
            self._check_conflicts({'home': _proof(home, required=True)}, self._load(), excluding=entry)
            profile = NativeProfile('codex', 'codex-local', home, MappingProxyType({'config': home}))
            return ResolvedInstance(entry, family, 'codex-local', row['label'], row.get('enabled', True),
                                    profile, self.gateway_root, self.codex.directory/entry.replace(':', '-'))
        with self.lock:
            rows = self._load()
            row = next((r for r in rows if r['id'] == entry), None)
            if row is None:
                raise ValueError('액세스 인스턴스가 등록되지 않았습니다.')
            enabled = self._enabled(row)
            if require_enabled and not enabled:
                raise ValueError('이 액세스 인스턴스가 닫혔습니다.')
            profile, roots, pending = self._checked(row)
            self._check_conflicts(roots, rows, excluding=entry)
            return ResolvedInstance(entry, family, row['kind'], row['label'], enabled,
                                    profile, self.gateway_root, self._state_root(entry), pending)

    def configure(self, entry, enabled):
        if not isinstance(entry, str) or not ENTRY.fullmatch(entry) or type(enabled) is not bool:
            raise ValueError('독립 액세스 스위치가 유효하지 않습니다.')
        family = entry.split(':')[0]
        if family == 'codex':
            if self.codex is None:
                raise ValueError('Codex 액세스 인스턴스가 등록되지 않았습니다.')
            if enabled:
                self.resolve(family, entry, require_enabled=False)
            self.codex.configure(entry, enabled)
            return next(row for row in self.list('codex') if row['id'] == entry)
        with self.lock:
            row = next((r for r in self._load() if r['id'] == entry), None)
            if row is None:
                raise ValueError('액세스 인스턴스가 등록되지 않았습니다.')
            if enabled:
                self.resolve(family, entry, require_enabled=False)
            path = self._settings_path(entry)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with session_file_lock(path):
                if enabled:
                    self.resolve(family, entry, require_enabled=False)
                settings = self._settings(entry)
                settings['enabled'] = {**settings.get('enabled', {}), family: enabled}
                replace_session_file(path, json.dumps(settings, ensure_ascii=False).encode('utf-8'))
        return next(row for row in self.list(family) if row['id'] == entry)

    def pin_initialized_roots(self, entry):
        """Record newly created native directories; this is not runtime proof."""
        if not isinstance(entry, str) or not ENTRY.fullmatch(entry):
            raise ValueError('독립 액세스 ID가 잘못되었습니다.')
        family = entry.split(':')[0]
        if family in ('codex', 'zcode'):
            raise ValueError('이 액세스는 기본 디렉터리 초기화 바인딩을 사용하지 않습니다.')
        with self.lock, session_file_lock(self.path):
            rows = self._load()
            row = next((r for r in rows if r['id'] == entry), None)
            if row is None:
                raise ValueError('액세스 인스턴스가 등록되지 않았습니다.')
            _, roots, pending = self._checked(row)
            self._check_conflicts(roots, rows, excluding=entry)
            if pending:
                changed = {**row, 'roots': {name: roots[name] if name in pending else proof
                                          for name, proof in row['roots'].items()}}
                self._write([changed if r['id'] == entry else r for r in rows])
        return self.resolve(family, entry, require_enabled=False)
