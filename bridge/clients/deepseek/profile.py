"""Prepare empty native profiles with the installed App's own initializer."""
import json
import os
from pathlib import Path
import subprocess
import sys

from bridge.clients.profiles import launch_parameters


def _stamp(path):
    value = path.stat()
    return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)


def initializer(executable):
    """Discover the package's exported profile helper, without version pinning."""
    executable = Path(executable).resolve()
    package = executable.parent/'resources/app'
    manifest = package/'package.json'
    if not executable.is_file() or not manifest.is_file():
        return None
    if manifest.stat().st_size > 1024*1024:
        raise ValueError('DSH 기본 초기화 선언이 너무 큽니다. 애플리케이션을 다시 스캔하세요.')
    value = json.loads(manifest.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict) or value.get('name') not in ('dsh-plugin-desktop', '@deepseek-ai/dsh-desktop'):
        return None
    exports = value.get('exports')
    exported = exports.get('./profile') if isinstance(exports, dict) else None
    if isinstance(exported, dict):
        exported = exported.get('default') or exported.get('import')
    if not isinstance(exported, str) or not exported.startswith('./'):
        return None
    helper = (package/exported).resolve()
    if package.resolve() not in helper.parents or not helper.is_file():
        return None
    return executable, manifest, helper


_PREPARE = """import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const native=await import(pathToFileURL(process.argv[1]).href);
if(typeof native.ensureDesktopProfile!=='function') throw Error('Unsupported native profile initializer');
const home=resolve(process.argv[2]);
const directory=native.ensureDesktopProfile(home);
if(resolve(directory)!==join(home,'profiles','desktop')||!existsSync(join(directory,'package.json')))
  throw Error('Native profile preparation not confirmed');
console.log(JSON.stringify({directory,prepared:true}));
"""


def prepare(profile, descriptor):
    """No GUI, network install, account import, or model call is requested."""
    if profile.family != 'deepseek':
        raise ValueError('이 구성은 다음에 속하지 않습니다. DSH')
    directory = profile.home/'profiles/desktop'
    manifest = directory/'package.json'
    if manifest.exists():
        return False  # Existing native profiles remain authoritative.
    found = initializer(descriptor.get('executable', ''))
    if found is None:
        if sys.platform == 'win32':
            raise ValueError('이 DSH 애플리케이션은 독립적인 구성 초기화 항목을 제공하지 않습니다. 애플리케이션을 업데이트하거나 초기화된 독립 디렉터리를 선택하세요.')
        return False  # Existing verified macOS first-start path remains unchanged.
    executable, package, helper = found
    guard = descriptor.get('profileGuard')
    if guard:
        guard()
    before = {path: _stamp(path) for path in found}
    preserved = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in
                 (directory/'cordis.patch.yml', directory/'pnpm-workspace.yaml') if path.is_file()}
    parameters = launch_parameters(profile)
    removed = {name.upper() for name in parameters['environmentUnset']} | {'NODE_OPTIONS', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE'}
    environment = {key: value for key, value in os.environ.items() if key.upper() not in removed}
    environment.update(parameters['environment'], ELECTRON_RUN_AS_NODE='1')
    options = {'creationflags': subprocess.CREATE_NO_WINDOW} if sys.platform == 'win32' else {}
    try:
        result = subprocess.run([str(executable), '--input-type=module', '--eval', _PREPARE,
                                 str(helper), str(profile.home)], cwd=executable.parent,
                                env=environment, stdin=subprocess.DEVNULL, capture_output=True,
                                timeout=25, **options)
    except subprocess.TimeoutExpired:
        # subprocess owns the exact helper handle; no GUI process was launched.
        raise ValueError('DSH 독립 구성 초기화 시간이 초과되어 데스크탑 애플리케이션이 시작되지 않았습니다. 나중에 다시 시도해 주세요.') from None
    if result.returncode:
        raise ValueError('DSH 기본 독립 구성 초기화에 실패했으며 데스크톱 애플리케이션이 아직 시작되지 않았습니다.')
    if guard:
        guard()
    if any(_stamp(path) != stamp for path, stamp in before.items()):
        raise ValueError('DSH 초기화 중에 애플리케이션이 변경되었습니다. 다시 스캔해 주세요.')
    if any((path.read_bytes(), path.stat().st_mtime_ns) != saved for path, saved in preserved.items()):
        raise ValueError('기본 초기화로 인해 기존 구성이 변경되었으며 데스크탑 애플리케이션이 시작되지 않았습니다. 선택한 독립디렉터리를 확인해주세요.')
    try:
        receipt = json.loads(result.stdout.decode('utf-8').strip().splitlines()[-1])
        if receipt.get('prepared') is not True or Path(receipt['directory']).resolve() != directory.resolve():
            raise ValueError()
        value = json.loads(manifest.read_text(encoding='utf-8-sig'))
        if (not isinstance(value, dict) or not isinstance(value.get('dsh', {}).get('profile', {}).get('bundles'), list)
                or not (directory/'cordis.patch.yml').is_file() or not (directory/'pnpm-workspace.yaml').is_file()):
            raise ValueError()
    except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise ValueError('DSH 독립 구성 준비가 확인되지 않았으며 데스크톱 응용 프로그램이 시작되지 않았습니다.') from None
    return True
