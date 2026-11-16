"""Default local OAuth snapshots; shared UI, no Electron/profile directory copies."""
import hashlib
import json
import logging
from pathlib import Path
import re
import threading
import uuid

from bridge.features.accounts.accounts import private_bytes, private_json
from bridge.clients.errors import BridgeUnavailable
from bridge.platforms.antigravity import login_processes, profile_lease
from .credentials import NativeCredentials


TOKEN_FILES = ('jetski-standalone-oauth-token', 'antigravity-cli/antigravity-oauth-token',
               'antigravity/antigravity-oauth-token')
SCOPE_HINT = ('APP、CLI、IDE 이 컴퓨터와 공유됨 Google 로그인하세요. 원본 클라이언트로 먼저 로그인하신 후, 3가지 종류의 출입구를 모두 정상적으로 종료하신 후 저장하시기 바랍니다.；'
              '신청 후, 인증 로그인을 다시 열어주세요. 동일한 시스템을 사용하여 로그인한 사용자 정의 포털도 영향을 받습니다. 사용자 정의 디렉토리에 대한 별도의 자격 증명、GCP、WIF 및 API 원래 클라이언트 관리에서 구성을 구성하세요.。')


def require_stopped():
    if login_processes():
        raise ValueError('먼저 이 컴퓨터에서 정상적으로 로그아웃하세요. Antigravity APP、CLI、IDE，계정을 다시 저장하거나 적용하세요')


def safe(path):
    if any(item.is_symlink() for item in (path, *path.parents)):
        raise ValueError('Antigravity 계정 경로는 심볼릭 링크일 수 없습니다.')


def read(path):
    safe(path)
    try:
        return path.read_text(encoding='utf-8')
    except FileNotFoundError:
        return None


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def identity(raw):
    try:
        value = json.loads(raw)
        token = value.get('token')
        if (value.get('auth_method') != 'consumer' or value.get('wif_provider')
                or not isinstance(token, dict) or not isinstance(token.get('refresh_token'), str)
                or not token['refresh_token']):
            raise ValueError
        email = value.get('id_token_email')
        if not isinstance(email, str) or not email.strip():
            raise ValueError
        return email.strip()
    except (ValueError, TypeError, AttributeError):
        raise ValueError('지원되는 기본값이 인식되지 않습니다. Google 로그인하려면 먼저 Antigravity 원래 클라이언트가 로그인을 완료합니다.') from None


class AntigravityAccounts:
    def __init__(self, directory, home, metadata):
        self.directory, self.home, self.metadata = Path(directory), Path(home), metadata
        self.lock = threading.RLock()

    def supported(self):
        return self.home == Path.home().resolve()

    def _check(self, *, stopped=True):
        if not self.supported():
            raise ValueError('기본 사용자 디렉터리만 지원 Antigravity 계정; 원래 클라이언트에서 사용자 정의 디렉토리를 관리하십시오')
        safe(self.directory)
        for name in TOKEN_FILES:
            safe(self.home/'.gemini'/name)
        if stopped:
            require_stopped()

    def _index(self):
        raw = read(self.directory/'index.json')
        rows = json.loads(raw)['accounts'] if raw is not None else []
        if not isinstance(rows, list) or any(not isinstance(row, dict) or
                not isinstance(row.get('id'), str) or not re.fullmatch('[0-9a-f]{32}', row['id']) for row in rows):
            raise ValueError('저장됨 Antigravity 계정 색인이 잘못되었습니다.')
        return rows

    def _row(self, identifier):
        if not isinstance(identifier, str) or not re.fullmatch('[0-9a-f]{32}', identifier):
            raise ValueError('저장됨 Antigravity 계정 ID가 유효하지 않습니다.')
        row = next((item for item in self._index() if item['id'] == identifier), None)
        if row is None:
            raise ValueError('저장됨 Antigravity 계정이 존재하지 않습니다')
        return row

    def public(self, *, native=None):
        # Polling reads native identity and private metadata only, never the vault.
        with self.lock:
            native = self.metadata() if native is None else native
            rows, active, matched = [], [], set()
            for saved in self._index():
                row = {key: saved[key] for key in ('id', 'name', 'email')}
                row.update(kind='official', saved=True, canReadQuota=False)
                matches = [item for item in native['accounts'] if item.get('email') == row['email']]
                row['connectedSurfaces'] = [item['surface'] for item in matches]
                if matches:
                    active.append(row['id'])
                    matched.update(item['id'] for item in matches)
                rows.append(row)
            for row in native['accounts']:
                if row['id'] not in matched:
                    rows.append({**row, 'canSwitch': False})
                    active.append(row['id'])
            supported = self.supported()
            return {**native, 'accounts': rows, 'activeIds': active,
                    'activeId': active[0] if active else None,
                    'readOnly': not supported, 'canImport': supported, 'canSwitch': supported,
                    'enrollmentHint': SCOPE_HINT,
                    'switchConfirmation': '이 컴퓨터는 업데이트됩니다 APP、CLI、IDE 공유됨 Google 로그인, 동일한 시스템을 사용하여 로그인하는 사용자 지정 포털도 영향을 받습니다. 다른 컴퓨터는 변경되지 않습니다. 검증된 무료 싱글 APP 또는 IDE 정상적으로 종료되고 다시 열립니다. 독립적인 CLI、다른 인스턴스나 확인할 수 없는 항목은 먼저 수동으로 종료해야 합니다. 채팅, 구성 및 초안 보존. 신청 확인？',
                    'capabilities': {'addApi': False, 'quota': False, 'switchRequiresStopped': True}}

    def _snapshot(self, vault):
        return {'keyring': vault.read(), 'files': {name: read(self.home/'.gemini'/name) for name in TOKEN_FILES}}

    def _validate(self, value):
        if (not isinstance(value, dict) or set(value) != {'keyring', 'files'}
                or not isinstance(value['files'], dict) or set(value['files']) != set(TOKEN_FILES)):
            raise ValueError('Antigravity 로그인 스냅샷 형식이 잘못되었습니다.')
        values = [value['keyring'], *value['files'].values()]
        emails = {identity(raw) for raw in values if raw is not None}
        if not emails:
            raise ValueError('먼저 부탁드립니다 Antigravity 원래 클라이언트로 로그인하고 현재 액세스를 저장하세요.')
        if len(emails) != 1:
            raise ValueError('기본 포털의 로그인 ID가 일치하지 않습니다. 먼저 원본 클라이언트로 로그인 후 저장해주세요.')
        return next(iter(emails))

    def validate_saved(self, identifier):
        """Reject invalid selections before requesting any native exit."""
        with self.lock:
            self._check(stopped=False)
            row = self._row(identifier)
            value = json.loads(read(self.directory/(identifier+'.json')) or '{}')
            if self._validate(value) != row['email'] or fingerprint(value) != row['fingerprint']:
                raise ValueError('저장된 로그인 스냅샷이 불완전합니다. 다시 저장하세요.')
            return row['email']

    def import_current(self, name=''):
        if not isinstance(name, str) or len(name.strip()) > 100:
            raise ValueError('이름은 다음보다 길 수 없습니다. 100 성격')
        with self.lock:
            self._check()
            with profile_lease(self.home/'.gemini/.bridge-account.lock'):
                vault = NativeCredentials()
                snapshot = self._snapshot(vault)
                email = self._validate(snapshot)
                self._check()
                if self._snapshot(vault) != snapshot:
                    raise ValueError('기본 로그인이 변경 중입니다. 나중에 다시 저장하세요.')
                rows = self._index()
                # A new private snapshot replaces the prior entry only after both writes succeed.
                identifier = uuid.uuid4().hex
                path = self.directory/(identifier+'.json')
                row = {'id': identifier, 'name': name.strip() or email, 'email': email,
                       'fingerprint': fingerprint(snapshot)}
                previous = [item for item in rows if item['email'] == email]
                try:
                    private_json(path, snapshot)
                    private_json(self.directory/'index.json', {'accounts': [item for item in rows if item['email'] != email]+[row]})
                except Exception:
                    path.unlink(missing_ok=True)
                    raise
                for item in previous:
                    (self.directory/(item['id']+'.json')).unlink(missing_ok=True)
                return self.public()

    def _write_file(self, name, value):
        path = self.home/'.gemini'/name
        safe(path)
        if value is None:
            path.unlink(missing_ok=True)
        else:
            private_bytes(path, value.encode('utf-8'))

    def restore(self, identifier):
        with self.lock:
            row = self._row(identifier)
            self._check()
            selected = json.loads(read(self.directory/(row['id']+'.json')) or 'null')
            self._validate(selected)
            if fingerprint(selected) != row['fingerprint']:
                raise ValueError('저장됨 Antigravity 로그인 스냅샷이 변경되었습니다.')
            # Retain the saved list if post-commit discovery fails, but never
            # carry the previous native login identity across a switch.
            result = self.public(native={'accounts': []})
            with profile_lease(self.home/'.gemini/.bridge-account.lock'):
                vault = NativeCredentials()
                before = self._snapshot(vault)
                backup = self.directory/('rollback-'+uuid.uuid4().hex+'.json')
                private_json(backup, {'before': before, 'after': selected})
                written = []
                try:
                    self._check()
                    if self._snapshot(vault) != before:
                        raise ValueError('기본 로그인이 변경됩니다')
                    for name in TOKEN_FILES:
                        if read(self.home/'.gemini'/name) != before['files'][name]:
                            raise ValueError('기본 로그인 파일이 변경 중입니다.')
                        written.append(name)
                        self._write_file(name, selected['files'][name])
                    if vault.read() != before['keyring']:
                        raise ValueError('시스템 로그인 자격 증명이 변경 중입니다.')
                    written.append('keyring')
                    vault.write(selected['keyring'])
                    self._check()
                    if self._snapshot(vault) != selected:
                        raise ValueError('기본 로그인 구성 쓰기가 확인되지 않았습니다.')
                except Exception:
                    complete = True
                    try:
                        self._check()
                        for name in reversed(written):
                            old = before['keyring'] if name == 'keyring' else before['files'][name]
                            new = selected['keyring'] if name == 'keyring' else selected['files'][name]
                            current = vault.read() if name == 'keyring' else read(self.home/'.gemini'/name)
                            if current == new:
                                if name == 'keyring':
                                    vault.write(old)
                                else:
                                    self._write_file(name, old)
                            elif current != old:
                                complete = False
                        if self._snapshot(vault) != before:
                            complete = False
                    except Exception:
                        complete = False
                    if complete:
                        backup.unlink(missing_ok=True)
                    raise ValueError('계정 신청이 완료되지 않았습니다.；'+('원래 구성을 복원했습니다.' if complete else '외부 변경 사항은 다루지 않았습니다. 복구 백업이 유지되었습니다. 컴퓨터에서 확인해주세요.')) from None
                try:
                    backup.unlink(missing_ok=True)
                except OSError:
                    logging.getLogger(__name__).warning('Antigravity login applied; rollback backup retained')
                # Credential read-back above is the commit point. Cleanup or
                # presentation failures must not prevent the one safe restart.
                try:
                    result = self.public()
                except (OSError, ValueError, BridgeUnavailable):
                    pass
                return {**result, 'message': '로그인 구성이 적용되었지만 로그인이 확인되지 않았습니다. 원래 클라이언트를 다시 열고 새로고침하세요.。'}

    def edit(self, identifier):
        row = self._row(identifier)
        return {key: row[key] for key in ('id', 'name')}

    def rename(self, identifier, name):
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValueError('이름 길이는 다음과 같아야 합니다. 1–100 성격')
        with self.lock:
            self._row(identifier)
            rows = self._index()
            for row in rows:
                if row['id'] == identifier:
                    row['name'] = name.strip()
            private_json(self.directory/'index.json', {'accounts': rows})
            return self.public()

    def remove(self, identifier):
        with self.lock:
            self._row(identifier)
            private_json(self.directory/'index.json', {'accounts': [row for row in self._index() if row['id'] != identifier]})
            (self.directory/(identifier+'.json')).unlink(missing_ok=True)
            return self.public()
