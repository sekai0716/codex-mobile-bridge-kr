"""Claude discovery and visible native Console bootstrap, independent of CDP."""
import json
import os
import plistlib
import re
import struct
import subprocess
import sys
import time
from pathlib import Path
from contextlib import nullcontext

from bridge.clients.desktop_app import DesktopApp
from bridge.platforms.windows import session as windows_session
from bridge.platforms.macos import claude as macos_claude
from bridge.platforms.windows import claude as windows_claude
from bridge.resources import project_root


def _native():
    return windows_claude if sys.platform == 'win32' else macos_claude


def _archive_members(path, names=('package.json', '.vite/build/index.pre.js')):
    """Read only the bounded Electron package metadata and main startup script."""
    with path.open('rb') as stream:
        header = stream.read(16)
        if len(header) != 16:
            raise ValueError('incomplete archive header')
        _, size, _, json_size = struct.unpack('<4I', header)
        if not 0 < json_size <= 8 * 1024 * 1024 or size < json_size + 8:
            raise ValueError('invalid archive header')
        tree = json.loads(stream.read(json_size))
        base = size + 8
        for name in names:
            node = tree
            for part in name.split('/'):
                node = node.get('files', {}).get(part, {})
            length = node.get('size', 0)
            if ('offset' not in node or node.get('unpacked') or
                    not isinstance(length, int) or not 0 < length <= 32 * 1024 * 1024):
                continue
            offset = int(node['offset'])
            if offset < 0:
                raise ValueError('invalid archive offset')
            stream.seek(base + offset)
            yield name, stream.read(length).decode('utf-8', errors='replace')


def inspect_installation(executable):
    """Return capability evidence without launching Claude or reading accounts."""
    if not executable:
        return {'installed': False, 'automaticConnection': 'unavailable',
                'setupState': 'not-installed', 'reason': "Claude 데스크탑을 찾을 수 없습니다"}
    path = Path(executable).expanduser()
    bundle = next((p for p in (path, *path.parents) if p.suffix == '.app'), None)
    version = ''
    archive = path.parent/'resources/app.asar'
    if bundle:
        path, archive, version = macos_claude.installation_paths(path, bundle)
    if not path.is_file():
        return {'installed': False, 'automaticConnection': 'unavailable',
                'setupState': 'not-installed', 'reason': "Claude 데스크탑을 찾을 수 없습니다"}
    try:
        for name, content in _archive_members(archive):
            if name == 'package.json' and not version:
                version = str(json.loads(content).get('version') or '')
    except (OSError, ValueError, TypeError, AttributeError, struct.error):
        # Unknown packaging is unknown capability, never assumed compatible.
        pass
    return {'installed': True, 'executable': str(path.resolve()), 'version': version,
            'automaticConnection': 'native-console' if sys.platform in ('darwin', 'win32') else 'unavailable',
            'setupState': 'ready-to-connect' if sys.platform in ('darwin', 'win32') else 'unsupported',
            'reason': ("Claude 데스크톱을 찾았으며 연결할 준비가 되었습니다." if sys.platform in ('darwin', 'win32')
                       else "이 플랫폼에서는 아직 자동 Claude 연결을 사용할 수 없습니다.")}


def helper_path():
    root = project_root()
    if not getattr(sys, 'frozen', False):
        root = root/'dist'
    return root/'client-helpers'/('claude-bridge-helper.exe' if sys.platform == 'win32' else 'claude-bridge-helper')


def _running_profiles(executable, platform):
    """Locate the selected app's active Chromium profile, without reading it.

    Claude can select Claude-3p internally, so installation paths and another
    profile's developer settings do not establish its active data directory.
    """
    if platform == 'win32':
        return windows_claude.running_profiles(executable)
    if platform != 'darwin':
        return set()
    return macos_claude.running_profiles(DesktopApp(executable, Path.home()))


def claude_data_home(executable, fallback, platform=None, *, env=None, package_family=None, inspect_running=True):
    """Prefer unique live evidence, then a single supported Windows profile."""
    platform, fallback = platform or sys.platform, Path(fallback)
    if inspect_running:
        try:
            profiles = _running_profiles(executable, platform)
            if profiles:
                if len(profiles) != 1:
                    return fallback
                observed = next(iter(profiles))
                if platform == 'win32':
                    return windows_claude.running_profile_path(executable, observed, env, package_family)
                return observed
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    if platform == 'win32':
        return windows_claude.stopped_profile(executable, fallback, env, package_family)
    return fallback


def developer_mode_enabled(data_home):
    try:
        return json.loads((Path(data_home)/'developer_settings.json').read_text(encoding='utf-8-sig')).get('allowDevTools') is True
    except (OSError, ValueError, AttributeError):
        return False


def console_source(source, config, *, multiline=False):
    """Normalize our controlled, semicolon-terminated IIFE before adding data.

    Only standalone comment lines are removed. The connector has no template
    literals or inline line comments; parity tests run this exact transformation.
    Configuration is inserted afterwards so path/string whitespace is untouched.
    Windows can retain a few bounded lines for the Console accessibility tree.
    """
    lines, block = [], False
    for line in source.splitlines():
        line = line.strip()
        if line.startswith('/*'):
            block = True
        if block:
            if '*/' in line:
                block = False
            continue
        if not line or line.startswith('//'):
            continue
        if '`' in line:
            raise ValueError("지원되지 않는 커넥터 스크립트 형식입니다. 앱을 다시 빌드합니다.")
        lines.append(line)
    marker = '/* codex bridge connector */'
    encoded_config = json.dumps(config, ensure_ascii=True)
    if not multiline:
        return (marker + ' '.join(lines)).replace('__BRIDGE_CONFIG__', encoded_config)
    rendered = [line.replace('__BRIDGE_CONFIG__', encoded_config) for line in lines]
    groups, pending = [], []
    for line in rendered:
        pending.append(line)
        while len((marker if not groups else '') + ' '.join(pending)) > 3500:
            for cut in range(len(pending) - 1, 0, -1):
                if (pending[cut - 1].endswith((';', '{')) and
                        len((marker if not groups else '') + ' '.join(pending[:cut])) <= 3500):
                    break
            else:
                raise ValueError('연결 스크립트의 한 줄이 너무 깁니다. 애플리케이션을 다시 빌드하세요.')
            groups.append((marker if not groups else '') + ' '.join(pending[:cut]))
            pending = pending[cut:]
    groups.append((marker if not groups else '') + ' '.join(pending))
    return '\n'.join(groups)


def _native_action_macos(action, *, pid=None, executable=None, script=None, cancel_path=None, cancelled=None, recovered=None):
    if cancelled and cancelled.is_set():
        return {'setupState': 'cancelled', 'reason': "Claude 연결이 취소되었습니다."}
    helper = helper_path()
    if not helper.is_file():
        return {'setupState': 'failed', 'reason': "Claude 커넥터 구성요소가 누락되었습니다. 게이트웨이 앱을 다시 빌드하거나 다시 설치하세요."}
    command = _native().helper_command(helper, action, pid, executable, script, cancel_path)
    if command is None:
        return {'setupState': 'ready'}
    args, options = command
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', **options)
    # One read-only helper waits through screen saver/lock instead of repeatedly
    # activating Claude or launching a fresh helper on every poll.
    deadline = None if action == 'wait-desktop' else time.monotonic() + (180 if action == 'connect' else 20)
    while True:
        try:
            stdout, _ = process.communicate(timeout=1 if action == 'wait-desktop' else .2)
            break
        except subprocess.TimeoutExpired:
            connected = bool(action == 'wait-desktop' and recovered and recovered())
            if connected or (cancelled and cancelled.is_set()) or (deadline is not None and time.monotonic() >= deadline):
                # Stop only our input helper, never the Claude desktop process.
                process.terminate()
                try: process.communicate(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill(); process.communicate()
                if connected and not (cancelled and cancelled.is_set()):
                    return {'setupState': 'connected', 'reason': '데스크톱 연결 가능'}
                return {'setupState': 'cancelled' if cancelled and cancelled.is_set() else 'failed',
                        'reason': "Claude 연결이 취소되었습니다." if cancelled and cancelled.is_set() else "Claude 연결 시간이 초과되었습니다. 다시 시도해 보세요."}
    return _native().helper_result(action, stdout, process.returncode)



def native_action(action, *, pid=None, executable=None, script=None, cancel_path=None, cancelled=None, recovered=None):
    if action not in ('check', 'request-permission', 'connect', 'connect-background', 'close-devtools',
                      'close-background-devtools', 'enable-devtools', 'inspect-error', 'quit', 'wait-desktop'):
        raise ValueError('지원되지 않음 Claude 현지 운영')
    if sys.platform == 'win32':
        return windows_claude.native_action(action, helper=helper_path(), pid=pid, executable=executable,
                                            script=script, cancel_path=cancel_path, cancelled=cancelled)
    return _native_action_macos(action, pid=pid, executable=executable, script=script,
                                cancel_path=cancel_path, cancelled=cancelled, recovered=recovered)


def _main_pids(app):
    if sys.platform != 'win32':
        return app.processes()
    return windows_claude.main_pids(app)


def _native_startup_hidden(source):
    """Recognize the verified native --startup predicate and hidden-window branch."""
    symbol = r'[A-Za-z_$][\w$]*'
    predicate = rf'({symbol})=\(\)=>{symbol}\?\?=![^;]{{1,80}}\.argv\.includes\("--startup"\)'
    for match in re.finditer(predicate, source):
        branch = source[match.end():match.end() + 1800]
        visible = re.search(rf'({symbol})=\({re.escape(match[1])}\(\)\|\|!1\)&&!{symbol};', branch)
        if (visible and '"background_launch":"os_login"' in branch
                and re.search(rf'show:{re.escape(visible[1])}&&!', branch)):
            return True
    return False


def background_start_supported(executable):
    """Unknown Claude builds must not fall back to a foreground launch."""
    archive = Path(executable).parent/'resources/app.asar'
    try:
        entry = dict(_archive_members(archive, ('package.json', '.vite/build/index.js', '.vite/build/index.pre.js')))
        if json.loads(entry.get('package.json', '{}')).get('name') != '@ant/desktop':
            return False
        sources = [entry.get('.vite/build/index.pre.js', '')]
        chunks = re.findall(r'require\("\./(index\.chunk-[A-Za-z0-9_-]+\.js)"\)', entry.get('.vite/build/index.js', ''))
        if len(chunks) > 8:
            return False
        sources.extend(source for _, source in _archive_members(archive, ['.vite/build/' + name for name in chunks]))
        return any(_native_startup_hidden(source) for source in sources)
    except (OSError, ValueError, TypeError, AttributeError, struct.error):
        return False


def _native_background_console(source):
    """Require the native environment entry and its restricted-mode guard."""
    symbol = r'[A-Za-z_$][\w$]*'
    for match in re.finditer(r'env\.CLAUDE_DEV_TOOLS&&(' + symbol + r')\(\(\(\)=>!0\)\)', source):
        gate = re.escape(match[1])
        guard = re.search(r'function ' + gate + r'\((' + symbol + r')\)\{return \1\(\)&&!(' + symbol + r')\(\)\}', source)
        if not guard:
            continue
        restricted = re.search(r'function ' + re.escape(guard[2]) + r'\(\)\{return ' + symbol + r'\(\)==="restricted"\}', source)
        branch = source[match.end():match.end()+500]
        if (restricted and '"undocked"' in branch and '.includes(' in branch
                and 'env.CLAUDE_DEV_TOOLS' in branch and '.webContents.openDevTools({mode:' in branch):
            return True
    return False


def background_console_supported(executable):
    archive = Path(executable).parent/'resources/app.asar'
    try:
        entry = dict(_archive_members(archive, ('package.json', '.vite/build/index.js', '.vite/build/index.pre.js')))
        if json.loads(entry.get('package.json', '{}')).get('name') != '@ant/desktop':
            return False
        chunks = re.findall(r'require\("\./(index\.chunk-[A-Za-z0-9_-]+\.js)"\)', entry.get('.vite/build/index.js', ''))
        if len(chunks) > 8:
            return False
        sources = [entry.get('.vite/build/index.pre.js', '')]
        sources.extend(source for _, source in _archive_members(archive, ['.vite/build/' + name for name in chunks]))
        return any(_native_background_console(source) for source in sources)
    except (OSError, ValueError, TypeError, AttributeError, struct.error):
        return False


def background_running_app(executable, data_home, cancelled=None, launch_gate=None, *, initialize_console=False, explicit_home=False):
    """Start a verified Windows Claude in its native hidden mode at most once."""
    if sys.platform != 'win32':
        raise ValueError("Claude의 백그라운드 실행 항목이 이 시스템에서 확인되지 않았습니다.")
    def check():
        if cancelled is not None and cancelled.is_set():
            raise ValueError("Claude 백그라운드 실행이 취소되었습니다.")
    check()
    app = DesktopApp(executable, data_home)
    pids = _main_pids(app)
    check()
    if len(pids) > 1:
        raise ValueError("고유한 Claude 기본 프로세스를 확인할 수 없습니다. 컴퓨터에서 확인해보세요.")
    if pids:
        return {'pid': pids[0], 'launched': False}
    if not background_start_supported(app.executable):
        raise ValueError("이 Claude 버전에 대한 백그라운드 실행이 확인되지 않았습니다. 컴퓨터에서 앱을 연 다음 다시 시도하세요.")
    packaged = any(folder.name.casefold() == 'windowsapps' or (folder/'AppxManifest.xml').is_file()
                   for folder in app.executable.parents)
    if packaged:
        from bridge.platforms.windows.discovery_ext import application_execution_alias
        launcher = application_execution_alias(app.executable)
        if launcher is None:
            raise ValueError("선택한 Claude 앱의 백그라운드 실행 별칭을 확인할 수 없습니다. 컴퓨터에서 열어서 다시 시도하세요.")
    else:
        launcher = app.executable
    # No explorer fallback: it would activate the window and drop --startup.
    environment = {key: value for key, value in os.environ.items()
                   if key.upper() not in ('ELECTRON_RUN_AS_NODE', 'CLAUDE_DEV_TOOLS')}
    console_supported = initialize_console and background_console_supported(app.executable)
    with launch_gate if launch_gate is not None else nullcontext():
        check()
        # Discovery can be slow. Never reactivate an app opened in the meantime.
        pids = _main_pids(app)
        check()
        if len(pids) > 1:
            raise ValueError("고유한 Claude 기본 프로세스를 확인할 수 없습니다. 컴퓨터에서 확인해보세요.")
        if pids:
            return {'pid': pids[0], 'launched': False}
        if console_supported:
            # Account switches can change the selected profile after discovery.
            # Honor explicit overrides; otherwise resolve stopped mode evidence
            # immediately before launch, without borrowing the old profile's choice.
            profile = data_home if explicit_home else claude_data_home(app.executable, data_home, inspect_running=False)
            if developer_mode_enabled(profile):
                environment['CLAUDE_DEV_TOOLS'] = 'undocked'
        check()
        process = subprocess.Popen([str(launcher), '--startup'], cwd=app.executable.parent,
                                   env=environment,
                                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
    deadline = time.monotonic() + 20
    while True:
        check()
        pids = _main_pids(app)
        if len(pids) == 1:
            return {'pid': pids[0], 'launched': True}
        if len(pids) > 1:
            raise ValueError("출시 후 여러 Claude 기본 프로세스가 나타났습니다. 컴퓨터에서 확인하세요.")
        if process.poll() not in (None, 0) or time.monotonic() >= deadline:
            raise ValueError("Claude가 백그라운드에서 시작을 완료할 수 없습니다. 데스크톱 앱을 확인한 후 다시 시도하세요.")
        if cancelled is None:
            time.sleep(.25)
        elif cancelled.wait(.25):
            check()


def running_app(executable, data_home, restart=False, cancelled=None, allow_launch=True):
    if cancelled and cancelled.is_set():
        raise ValueError("Claude 연결이 취소되었습니다.")
    if sys.platform == 'win32':
        windows_session.require_interactive()
    app = DesktopApp(executable, data_home)
    pids = _main_pids(app)
    if cancelled and cancelled.is_set():
        raise ValueError("Claude 연결이 취소되었습니다.")
    if not allow_launch and (not pids or restart):
        raise ValueError("다시 연결하기 전에 컴퓨터에서 Claude를 엽니다.")
    if pids and restart:
        if sys.platform == 'win32':
            windows_session.require_interactive()
        if len(pids) != 1:
            raise ValueError("단일 Claude 기본 프로세스를 식별할 수 없습니다. 바탕화면 창을 확인해보세요.")
        if sys.platform == 'win32':
            windows_claude.close_main_window(pids[0])
            deadline = time.monotonic() + 25
            while _main_pids(app):
                if cancelled and cancelled.is_set(): raise ValueError("Claude 연결이 취소되었습니다.")
                if time.monotonic() >= deadline:
                    raise ValueError("Claude가 종료되지 않았습니다. 컴퓨터에서 닫고 다시 시도하세요. 강제 종료가 아니었습니다.")
                time.sleep(.25)
        else:
            app.stop()
        pids = []
    if not pids:
        if cancelled and cancelled.is_set():
            raise ValueError("Claude 연결이 취소되었습니다.")
        if sys.platform == 'win32':
            windows_session.require_interactive()
        if sys.platform == 'darwin':
            macos_claude.start(app.executable)
        else:
            # Native startup arguments only. Claude's user profile remains its own.
            app.launch(cancelled=cancelled, stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.monotonic() + 15
        while not pids and time.monotonic() < deadline:
            if cancelled and cancelled.is_set():
                raise ValueError("Claude 연결이 취소되었습니다.")
            time.sleep(.25); pids = _main_pids(app)
    if len(pids) != 1:
        raise ValueError("단일 Claude 기본 프로세스를 식별할 수 없습니다. 바탕화면 창을 확인해보세요.")
    return pids[0]
