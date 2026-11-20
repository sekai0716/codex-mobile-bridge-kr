"""Control only the selected GUI executable, never the bundled agent runtime."""
import os
import subprocess
import sys
import time
from pathlib import Path

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
        candidate = DesktopApp.discover(runtime)
        if not candidate and sys.platform == 'win32':
            from bridge.clients.discovery import discover_clients
            desktop = discover_clients({'codexHome': str(home)})['codex']
            candidate = desktop.get('executable', '') if desktop.get('installed') else ''
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
            raise ValueError('데스크탑 프로그램은 내장을 선택할 수 없습니다 Codex 명령줄 런타임')
        # Launch scripts cannot be matched reliably to the resulting GUI process.
        with self.executable.open('rb') as stream:
            script = stream.read(2) == b'#!'
        if script:
            raise ValueError('시작 스크립트가 아닌 데스크톱 프로그램의 실제 실행 파일을 선택하세요.')

    def processes(self):
        expected = os.path.normcase(str(self.executable))
        return _native().processes(lambda path: os.path.normcase(str(Path(path).resolve())) == expected)

    def stop(self, *, runtime_pids=(), gui_pids=None, provider=None, selected_pids=None):
        if sys.platform == 'win32' and provider in ('codex', 'zcode'):
            from bridge.platforms.windows.codex_quit import stop_codex, stop_zcode
            quit_app = stop_zcode if provider == 'zcode' else stop_codex
            return quit_app(self, gui_pids=gui_pids)
        pids = self.processes()
        if selected_pids is not None:
            pids = [pid for pid in pids if pid in selected_pids]
        main = pids if gui_pids is None else [pid for pid in gui_pids if pid in pids]
        native = _native()
        if main and sys.platform == 'darwin':
            native.quit_application(self.executable, pids=main)
        for pid in main:
            if sys.platform == 'darwin':
                continue
            if pid not in self.processes():
                continue
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
                raise ValueError('데스크톱 프로그램이 종료되지 않았습니다. 컴퓨터에서 프로그램을 닫고 다시 시도하세요. 프로세스가 강제로 종료되지 않았습니다.')
            time.sleep(.25)

    def launch(self, *, cancelled=None, **options):
        if sys.platform == 'win32':
            from bridge.platforms.windows.discovery_ext import launch_windows_desktop
            return launch_windows_desktop(self.executable, cancelled=cancelled, **options)
        return subprocess.Popen([str(self.executable)], **options)

    def start(self):
        environment = {'CODEX_HOME': str(self.home)}
        if sys.platform in ('darwin', 'linux', 'win32'):
            from bridge.clients.codex.desktop_runtime import launch_environment, wait_stopped
            shared = launch_environment(self.home, self.executable)
            if shared:
                wait_stopped(self.home)
            environment.update(shared)
        if sys.platform == 'darwin':
            _native().start(self.executable, self.home, environment)
            return
        if sys.platform == 'win32':
            self.child = self.launch(require_environment=bool(shared), cwd=self.home, env={**os.environ, **environment},
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
        self.child = native.start(self.executable, self.home, environment, **options)
