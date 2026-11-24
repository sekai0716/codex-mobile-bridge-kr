"""Control only the selected GUI executable, never the bundled agent runtime."""
import os
import subprocess
import sys
import time
from pathlib import Path

from bridge.clients.codex.desktop_runtime import SUPPORTED_PLATFORMS
from bridge.platforms import desktop as native_desktop, discovery as native_discovery


def _native():
    return native_desktop(sys.platform)


def process_inventory(executables):
    """One uncached display snapshot; control operations perform fresh checks."""
    result = {Path(executable): {'pids': [], 'commands': {}} for executable in executables}
    targets = {os.path.normcase(str(path)): value for path, value in result.items()}
    if not targets:
        return result

    def match(executable):
        return targets.get(os.path.normcase(str(Path(executable).resolve())))

    _native().inventory(result, match)
    return result


class DesktopApp:
    def __init__(self, executable, home):
        self.executable = Path(executable).expanduser().resolve()
        if self.executable.suffix == '.app':
            try:
                self.executable = native_discovery('darwin').bundle_executable(self.executable)
            except (OSError, ValueError, KeyError):
                raise ValueError("유효한 Codex/ChatGPT 앱 번들을 선택하세요.") from None
        self.home = Path(home).resolve()

    @staticmethod
    def discover(runtime):
        if not runtime:
            return ''
        runtime = Path(runtime).resolve()
        if any(parent.suffix == '.app' for parent in runtime.parents):
            return native_discovery('darwin').codex_from_runtime(runtime)
        candidates = ()
        if sys.platform == 'win32':
            candidates = native_discovery('win32').codex_candidates(runtime)
        elif sys.platform == 'linux':
            candidates = native_discovery('linux').codex_candidates(runtime)
        return next((str(p) for p in candidates if p.is_file() and
                     (str(p.resolve()).casefold() != str(runtime).casefold() if sys.platform == 'win32'
                      else p.resolve() != runtime)), '')

    @staticmethod
    def scan(runtime, home):
        # An explicit scan resolves the current installation before consulting
        # an older bundled runtime which may survive an application update.
        candidate = ''
        if sys.platform == 'win32':
            from bridge.clients.discovery import discover_clients
            desktop = discover_clients({'codexHome': str(home)})['codex']
            candidate = desktop.get('executable', '') if desktop.get('installed') else ''
        candidate = candidate or DesktopApp.discover(runtime)
        if candidate:
            app = DesktopApp(candidate, home)
            app.validate(runtime)
            return str(app.executable)
        if sys.platform == 'darwin':
            for bundle in native_discovery('darwin').codex_bundles(Path.home()):
                app = DesktopApp(bundle, home)
                app.validate(runtime)
                return str(app.executable)
        raise ValueError("Codex 데스크톱 앱을 찾을 수 없습니다. 설치된 앱 번들 또는 실행 파일을 선택합니다.")

    def validate(self, runtime):
        if not self.executable.is_file() or not os.access(self.executable, os.X_OK):
            raise ValueError('설치된 것을 선택해주세요 Codex / ChatGPT 데스크탑 프로그램')
        if runtime and (str(self.executable).casefold() == str(Path(runtime).resolve()).casefold()
                        if sys.platform == 'win32' else self.executable == Path(runtime).resolve()):
            raise ValueError('桌面程序不能选择内置 Codex 命令行运行时')
        # Launch scripts cannot be matched reliably to the resulting GUI process.
        with self.executable.open('rb') as stream:
            script = stream.read(2) == b'#!'
        if script:
            raise ValueError('시작 스크립트가 아닌 데스크톱 프로그램의 실제 실행 파일을 선택하세요.')

    def processes(self):
        expected = os.path.normcase(str(self.executable))
        return _native().processes(lambda path: os.path.normcase(str(Path(path).resolve())) == expected)

    def stop(self, *, runtime_pids=(), gui_pids=None, provider=None, selected_pids=None, expected_identities=None):
        if sys.platform == 'win32' and provider in ('codex', 'zcode'):
            from bridge.platforms.windows.codex_quit import stop_codex, stop_zcode
            quit_app = stop_zcode if provider == 'zcode' else stop_codex
            return quit_app(self, gui_pids=gui_pids)
        pids = self.processes()
        if sys.platform == 'linux' and provider == 'codex' and gui_pids is None and pids:
            from bridge.clients.lifecycle import _process_state
            descriptor = {'id': 'codex', 'dataDirectory': str(self.home)}
            state = _process_state(descriptor, self, pids, _native().commands(pids))
            if state['unknown'] or len(state['mainPids']) != 1:
                raise ValueError('종료할 Codex 창을 확인할 수 없습니다. 데스크톱 앱에서 실행 중인 작업을 확인해 주세요.')
            gui_pids = state['mainPids']
        if selected_pids is not None:
            pids = [pid for pid in pids if pid in selected_pids]
        main = pids if gui_pids is None else [pid for pid in gui_pids if pid in pids]
        if expected_identities is not None and set(main) - expected_identities.keys():
            raise ValueError('Codex 桌面进程已变化，请重新初始化连接')
        native = _native()
        if main and sys.platform == 'darwin':
            native.quit_application(self.executable, pids=main)
        for pid in main:
            if sys.platform == 'darwin':
                continue
            if pid not in self.processes():
                continue
            if sys.platform == 'linux' and provider == 'codex':
                expected = expected_identities[pid] if expected_identities is not None else None
                native.quit_verified_codex(pid, self.executable, expected)
            else:
                native.quit_process(pid)
        # Only a caller that verified the native host's complete idle state may
        # include it here. Never force-kill or terminate unrelated profiles.
        for pid in runtime_pids:
            if pid not in pids or pid not in self.processes():
                continue
            native.terminate(pid)
        deadline = time.monotonic() + 25
        while set(self.processes()) & set(pids):
            if time.monotonic() >= deadline:
                raise ValueError('桌面程序尚未退出，请在电脑上关闭后重试；尚未强制结束进程')
            time.sleep(.25)

    def launch(self, *, cancelled=None, **options):
        if sys.platform == 'win32':
            from bridge.platforms.windows.discovery_ext import launch_windows_desktop
            return launch_windows_desktop(self.executable, cancelled=cancelled, **options)
        return subprocess.Popen([str(self.executable)], **options)

    def start(self, *, allow_unprepared=False):
        environment = {'CODEX_HOME': str(self.home)}
        environment_unset = ()
        shared = {}
        if sys.platform in SUPPORTED_PLATFORMS:
            from bridge.clients.codex.desktop_runtime import launch_environment, wait_stopped, DesktopRuntimeOutdated
            try:
                shared = launch_environment(self.home, self.executable)
            except DesktopRuntimeOutdated:
                if not allow_unprepared:
                    raise
                # Explicit opening may use the native App after an upgrade, but
                # never while an old shared writer is alive or unaccounted for.
                shared = {}
                environment_unset = ('CODEX_CLI_PATH', 'CMB_CODEX_DESKTOP_CONFIGURATION',
                                     'CODEX_APP_SERVER_WS_URL', 'CODEX_APP_SERVER_FORCE_CLI')
            if shared or environment_unset or sys.platform == 'linux':
                wait_stopped(self.home)
            if sys.platform == 'linux' and shared:
                environment_unset += ('CODEX_SQLITE_HOME', 'CODEX_ELECTRON_USER_DATA_PATH')
            environment.update(shared)
        if sys.platform == 'darwin':
            _native().start(self.executable, self.home, environment,
                            **({'environment_unset': environment_unset} if environment_unset else {}))
            return
        if sys.platform == 'win32':
            inherited = {key: value for key, value in os.environ.items() if key not in environment_unset}
            self.child = self.launch(require_environment=bool(shared or environment_unset), cwd=self.home, env={**inherited, **environment},
                                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL,
                                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP, close_fds=True)
            return
        else:
            from bridge.platforms.posix import desktop as native
        # Window sharing binds to the detached web document via AT-SPI on X11.
        options = ({'arguments': ('--force-renderer-accessibility',)}
                   if sys.platform == 'linux' and shared and os.environ.get('DISPLAY')
                   and os.environ.get('XDG_SESSION_TYPE') != 'wayland' else {})
        self.child = native.start(self.executable, self.home, environment,
                                  **({'environment_unset': environment_unset} if environment_unset else {}), **options)
