"""Explicit, local-only binding to the independently installed Harness plugin."""
import hashlib
import json
import os
import stat
import re
import io
import tarfile
import zipfile
from pathlib import Path

from bridge.clients.deepseek.adapter import DeepSeek, BRIDGE_REVISION
from bridge.clients.errors import BridgeUnavailable

SOURCE = Path(__file__).resolve().parent
PACKAGE = 'dsh-codex-mobile-bridge'
# Wire schemas are reviewed independently of bundle patch releases.
PROTOCOL = 1
SUPPORTED_REVISIONS = (9, 11)
# Previously shipped 0.1.0 bundle: retained without trusting arbitrary legacy code.
LEGACY_HASHES = {'host.mjs': '80cc10b76e18621b90dbdd5675ce8dd3932eb381a3380f0a538a76b4bcc77ebf', 'index.mjs': 'fcec77a5c6fa824cce97d668bf099c1bd720e7d23ef34d553e699bc1c708b647', 'package.json': '40cc010b6b09629f589e1fefa077a155849d97d1be9a3dcb310423f245478219', 'cordis.patch.yml': '88dd63b62c0021216c2f94171bc1585e5ba19fcce739a8b6ef02b2206a1e4af0'}

def _compatible(plugin):
    return (isinstance(plugin, dict) and plugin.get('name') == PACKAGE
            and isinstance(plugin.get('version'), str)
            and re.fullmatch(r'0\.2\.\d+', plugin['version']) is not None
            and type(plugin.get('protocol')) is int and plugin['protocol'] == PROTOCOL
            and type(plugin.get('revision')) is int and plugin['revision'] in SUPPORTED_REVISIONS)



def package_files():
    return {**{name: (SOURCE/'plugin'/name).read_bytes() for name in
               ('package.json', 'cordis.patch.yml', 'index.mjs', 'README.md')},
            'host.mjs': (SOURCE/'host.mjs').read_bytes(),
            'LICENSE': (SOURCE.parents[2]/'LICENSE').read_bytes(),
            'NOTICE': (SOURCE.parents[2]/'NOTICE').read_bytes(),
            'LICENSE.coding-mobile': (SOURCE.parent/'LICENSE.coding-mobile').read_bytes()}


def export_package(destination):
    if not isinstance(destination, str) or not destination.strip():
        raise ValueError('플러그인 패키지가 저장된 디렉토리를 선택하십시오')
    target = Path(destination).expanduser().resolve()
    if not target.is_dir():
        raise ValueError('플러그인 패키지가 저장된 디렉토리를 선택하십시오')
    files = package_files()
    version = json.loads(files['package.json'])['version']
    path = target/f'{PACKAGE}-{version}.zip'
    tar_path = target/f'{PACKAGE}-{version}.tgz'
    if path.exists() or tar_path.exists():
        raise FileExistsError('플러그인 패키지가 이미 존재합니다. 다른 디렉터리를 선택하십시오.')
    # Never replace a user's existing package or add private connection files.
    with zipfile.ZipFile(path, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(PACKAGE+'/'+name, content)
    with tar_path.open('xb') as output, tarfile.open(fileobj=output, mode='w:gz') as archive:
        for name, content in files.items():
            entry = tarfile.TarInfo('package/'+name)
            entry.size = len(content); entry.mode = 0o644
            archive.addfile(entry, io.BytesIO(content))
    return {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'tarPath': str(tar_path), 'tarSha256': hashlib.sha256(tar_path.read_bytes()).hexdigest()}


def _private(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or (hasattr(os, 'getuid') and
            (info.st_uid != os.getuid() or info.st_mode & 0o077)):
        raise ValueError('DSH 파일 권한 바인딩이 안전하지 않습니다')
    if info.st_size > 16384:
        raise ValueError('DSH 바인딩 파일이 너무 큽니다.')
    return json.loads(path.read_text('utf-8'))


class ManualDeepSeek(DeepSeek):
    manual = True

    def connection_error(self):
        return '연결된 Harness 프로필 "'+self.binding['profile']+'"에 아직 접속되지 않았습니다. 원래 클라이언트에서 연결 플러그인을 다시 로드하세요. 데스크톱 연결을 다시 설치할 필요가 없습니다.'

    def __init__(self, binding_file, instance_id=None):
        path = Path(binding_file).expanduser().absolute()
        if path.name != 'binding.json':
            raise ValueError('플러그인에서 생성된 것을 선택하세요. binding.json')
        binding = _private(path)
        directory = path.parent.resolve()
        required = ('directory', 'home', 'profileDirectory', 'profile', 'instanceId', 'packageDirectory')
        if binding.get('protocol') != 1 or any(not isinstance(binding.get(key), str) or not binding[key] for key in required):
            raise ValueError('DSH 바인딩 형식이 호환되지 않습니다.')
        if instance_id is not None and binding['instanceId'] != instance_id:
            raise ValueError('DSH 플러그인 인스턴스가 변경되었습니다. 다시 바인딩하세요.')
        if binding['directory'] != str(directory) or directory.parent != Path(binding['profileDirectory']).resolve():
            raise ValueError('DSH 바인딩 디렉터리가 일치하지 않습니다.')
        if Path(binding['profileDirectory']).resolve() != (Path(binding['home'])/'profiles'/binding['profile']).resolve():
            raise ValueError('DSH 파일 디렉터리가 일치하지 않습니다')
        self.plugin = binding.get('plugin')
        self._package(binding)
        super().__init__(directory, binding['home'])
        self.binding = binding
        self.receipts_path = directory/'requests.sqlite'
        self._connection()

    def _package(self, binding):
        package = Path(binding['packageDirectory'])
        if binding.get('plugin') is None:
            # Legacy bundles have no negotiation metadata; retain exact verification.
            expected = package_files()
            for name in ('host.mjs', 'index.mjs', 'package.json', 'cordis.patch.yml'):
                content = (package/name).read_bytes()
                if content != expected[name] and hashlib.sha256(content).hexdigest() != LEGACY_HASHES[name]:
                    raise ValueError('DSH 플러그인 버전이 일치하지 않습니다. 범용 플러그인을 다시 설치하세요.')
            return
        manifest = json.loads((package/'package.json').read_text('utf-8'))
        declared = {'name': manifest.get('name'), 'version': manifest.get('version'), **manifest.get('dshBridge', {})}
        if not _compatible(binding['plugin']) or declared != binding['plugin']:
            raise ValueError('DSH 플러그인 프로토콜 또는 버전이 호환되지 않습니다. 지원되는 범용 플러그인을 설치하세요.')

    def _connection(self):
        binding = _private(self.directory/'binding.json')
        config = _private(self.directory/'connection.json')
        identity = lambda value: {key: item for key, item in value.items() if key != 'plugin'}
        if identity(binding) != identity(self.binding) or config.get('instanceId') != self.binding['instanceId'] or config.get('endpoint') != str(self.directory/'endpoint.json'):
            raise ValueError('DSH 플러그인 인스턴스가 변경되었습니다. 다시 바인딩하세요.')
        self._package(binding)
        self.plugin = binding.get('plugin')
        token = config.get('token')
        if not isinstance(token, str) or len(token) != 64:
            raise ValueError('DSH 잘못된 플러그인 자격 증명')
        fingerprint = hashlib.sha256(token.encode()).hexdigest()
        if hasattr(self, 'credential') and self.credential != fingerprint:
            raise ValueError('DSH 플러그인 자격 증명이 변경되었습니다. 다시 바인딩하십시오.')
        self.credential = fingerprint

    def _status(self):
        value = super().call('status')
        if self.plugin is not None:
            if value.get('plugin') != self.plugin or value.get('bridgeRevision') != self.plugin['revision']:
                raise BridgeUnavailable('DSH 실행 중인 플러그인 버전이 설치된 버전과 일치하지 않습니다. 원래 클라이언트에서 플러그인을 다시 로드하세요.')
        elif value.get('bridgeRevision') != BRIDGE_REVISION:
            raise BridgeUnavailable('DSH 플러그인 버전이 호환되지 않습니다. 업데이트하고 다시 바인딩하세요.')
        value.update(bindingMode='manual', profile=self.binding['profile'], nativeQuit=False, updateRequired=False)
        return value

    def call(self, action, sid=None, body=None):
        self._connection()
        if action == 'quit':
            raise ValueError('타사 클라이언트에서 애플리케이션을 종료하십시오. 게이트웨이는 액세스만 관리합니다.')
        # Authenticate the running schema before any command, including after hot reload.
        status = self._status()
        return status if action == 'status' else super().call(action, sid, body)

    def discover_existing(self):
        self._connection()
        return {'installed': True, 'updateRequired': False, 'manual': True}

    def ensure_installed(self):
        raise ValueError('현재 플러그인 수동 설치가 사용됩니다. 타사 클라이언트에서 플러그인을 관리하세요.')

    def uninstall(self):
        raise ValueError('먼저 바인딩을 해제한 다음 타사 클라이언트에서 플러그인을 제거하세요.')


def discover_plugins(home):
    """Inspect explicit Harness profiles, never executable names or arbitrary ports."""
    if not isinstance(home, str) or not home.strip():
        raise ValueError("Harness 데이터 디렉터리를 선택하세요.")
    root = Path(home).expanduser().resolve()
    profiles = root/'profiles'
    if not profiles.is_dir():
        return []
    candidates = []
    for profile in sorted(profiles.iterdir()):
        if profile.is_symlink() or not profile.is_dir():
            continue
        path = profile/'codex-mobile-bridge/binding.json'
        if not path.exists():
            continue
        try:
            adapter = ManualDeepSeek(path)
            if Path(adapter.binding['home']).resolve() != root:
                continue
            candidates.append({'file': str(path), 'profile': adapter.binding['profile']})
        except (OSError, ValueError):
            continue
    return candidates
