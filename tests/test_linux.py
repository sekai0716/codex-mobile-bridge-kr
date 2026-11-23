import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import bridge.features.network.interfaces as interfaces
import bridge.platforms.linux.interfaces as linux_interfaces
from bridge.clients.codex.catalog import Catalog
from bridge.features.sessions.create import CreationError, open_in_desktop


class LinuxTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform == 'linux', 'Linux desktop process tree')
    def test_account_switch_quits_main_process_and_waits_for_its_helpers(self):
        from bridge.clients.desktop_app import DesktopApp
        app = DesktopApp('/fixture/ChatGPT', '/fixture/config')
        pids = [41, 42]
        commands = {41: '/fixture/ChatGPT', 42: '/fixture/ChatGPT --type=renderer'}
        with patch.object(app, 'processes', side_effect=[pids, pids, []]), \
             patch('bridge.platforms.linux.desktop.commands', return_value=commands), \
             patch('bridge.platforms.linux.desktop.quit_process') as quit_process:
            app.stop(provider='codex')
        quit_process.assert_called_once_with(41)

    @unittest.skipUnless(sys.platform == 'linux', 'Linux deleted-directory semantics')
    def test_gateway_and_url_opener_outlive_launcher_working_directory(self):
        # A separate parent process can unlink its own cwd without changing that
        # of the test runner. Both probe programs capture the real child cwd.
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            probe = """import json, os, pathlib, sys
from bridge.app.desktop import Desktop
where = pathlib.Path(os.environ['BRIDGE_TEST_ROOT'])
entry = pathlib.Path(sys.argv[0]).name
args = Desktop(sys.argv[3]).argv() if entry != 'xdg-open' else sys.argv[1:]
(where / (entry + '.json')).write_text(json.dumps([os.getcwd(), os.environ['PWD'], args]))
"""
            for name in ('desktop.py', 'codex-mobile-gateway', 'xdg-open'):
                file = folder / name
                file.write_text('#!' + sys.executable + '\n' + probe)
                file.chmod(0o700)
            launcher = """import json, os, pathlib, sys
from types import SimpleNamespace
from unittest.mock import patch
from bridge.app.desktop import Desktop
from bridge.features.sessions.create import open_in_desktop
root = pathlib.Path(os.environ['BRIDGE_TEST_ROOT'])
mode = sys.argv[1]
data = root / 'data'
app = Desktop(data)
app.status = lambda: {'running': False}
config = {'codexHome': str(data), 'lan': False, 'connections': []}
if mode == 'relative':
    config['codexHome'] = '../data'
(data / 'desktop.json').write_text(json.dumps(config))
if mode != 'relative':
    os.rmdir(os.getcwd())
    try: os.getcwd()
    except FileNotFoundError: pass
    else: raise AssertionError('launcher cwd was not removed')
if mode == 'xdg-open':
    open_in_desktop('11111111-1111-4111-8111-111111111111', 'remote host&value')
else:
    packaged = mode == 'codex-mobile-gateway'
    runtime = SimpleNamespace(platform='linux', frozen=packaged, executable=str(root/'codex-mobile-gateway') if packaged else sys.executable)
    with patch('bridge.app.desktop.project_root', return_value=root), patch('bridge.app.desktop.sys', runtime):
        child = app.start()
    _, status = os.waitpid(child['pid'], 0)
    if status: raise AssertionError((data/'gateway.log').read_text())
"""
            for mode in ('desktop.py', 'codex-mobile-gateway', 'xdg-open', 'relative'):
                with self.subTest(mode=mode):
                    launcher_dir = folder / ('cwd-' + mode)
                    launcher_dir.mkdir()
                    env = {**os.environ, 'BRIDGE_TEST_ROOT':tmp, 'PYTHONPATH':str(root),
                           'PWD':str(launcher_dir), 'PATH':tmp+os.pathsep+os.environ['PATH']}
                    subprocess.run([sys.executable, '-c', launcher, mode], cwd=launcher_dir,
                                   env=env, check=True, timeout=20)
                    result = 'desktop.py' if mode == 'relative' else mode
                    wd, pwd, args = json.loads((folder/(result+'.json')).read_text())
                    self.assertEqual((wd, pwd), ('/', '/'))
                    if mode == 'xdg-open':
                        self.assertEqual(args, ['codex://threads/11111111-1111-4111-8111-111111111111?hostId=remote+host%26value'])
                    else:
                        self.assertEqual(Path(args[args.index('--codex-home')+1]).resolve(), folder/'data')

    def test_ubuntu_chatgpt_package_layout(self):
        runtime = Path('/usr/lib/chatgpt/resources/codex')
        with patch('bridge.clients.codex.catalog.sys.platform', 'linux'), \
                patch('bridge.clients.codex.catalog.shutil.which', return_value=None), \
                patch.object(Path, 'is_file', autospec=True, side_effect=lambda path: path == runtime), \
                patch('bridge.clients.codex.catalog.os.access', return_value=True):
            self.assertEqual(Catalog.find_runtime(), runtime)

    def test_bundled_runtime_precedes_path_cli(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            launcher = root / 'chatgpt'
            launcher.touch()
            runtime = root / 'resources/codex-cli/bin/codex'
            runtime.parent.mkdir(parents=True)
            runtime.touch()
            with patch('bridge.clients.codex.catalog.sys.platform', 'linux'), \
                    patch('bridge.clients.codex.catalog.shutil.which', side_effect=lambda name: str(launcher) if name == 'chatgpt' else '/cli/codex'), \
                    patch('bridge.clients.codex.catalog.os.access', return_value=True):
                self.assertEqual(Catalog.find_runtime(), runtime.resolve())

    def test_runtime_fallback_and_missing_install(self):
        with patch('bridge.clients.codex.catalog.sys.platform', 'linux'), patch.object(Path, 'is_file', return_value=False):
            with patch('bridge.clients.codex.catalog.shutil.which', side_effect=lambda name: '/cli/codex' if name == 'codex' else None):
                self.assertEqual(Catalog.find_runtime(), Path('/cli/codex'))
            with patch('bridge.clients.codex.catalog.shutil.which', return_value=None):
                self.assertIsNone(Catalog.find_runtime())

    @unittest.skipIf(os.name == 'nt', 'POSIX executable permissions and symlinks')
    def test_symlinked_launcher_and_executable_permissions(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            launcher = root / 'app/chatgpt'
            launcher.parent.mkdir()
            launcher.touch()
            link = root / 'chatgpt'
            link.symlink_to(launcher)
            runtime = root / 'app/resources/codex'
            runtime.parent.mkdir()
            runtime.touch()
            is_file = Path.is_file
            with patch('bridge.clients.codex.catalog.shutil.which', side_effect=lambda name: str(link) if name == 'chatgpt' else None), \
                    patch.object(Path, 'is_file', autospec=True,
                                 side_effect=lambda path: is_file(path) if root in path.parents else False):
                runtime.chmod(0o600)
                self.assertIsNone(Catalog.find_linux_runtime())
                runtime.chmod(0o700)
                self.assertEqual(Catalog.find_linux_runtime(), runtime.resolve())

    def test_desktop_link_is_literal_and_keeps_remote_host(self):
        tid = '11111111-1111-4111-8111-111111111111'
        with patch('bridge.features.sessions.create.sys.platform', 'linux'), patch('bridge.features.sessions.create.subprocess.run') as opened:
            open_in_desktop(tid, 'remote host&value')
            self.assertEqual(opened.call_args.args[0],
                             ['xdg-open', 'codex://threads/' + tid + '?hostId=remote+host%26value'])
            self.assertTrue(opened.call_args.kwargs['check'])
            with self.assertRaises(ValueError):
                open_in_desktop('invalid', 'local')
            self.assertEqual(opened.call_count, 1)

    def test_missing_handler_and_timeout_are_actionable(self):
        tid = '11111111-1111-4111-8111-111111111111'
        for error in (FileNotFoundError(), subprocess.CalledProcessError(3, 'xdg-open'),
                      subprocess.TimeoutExpired('xdg-open', 10)):
            with self.subTest(error=error), patch('bridge.features.sessions.create.sys.platform', 'linux'), \
                    patch('bridge.features.sessions.create.subprocess.run', side_effect=error):
                with self.assertRaisesRegex(CreationError, 'xdg-open'):
                    open_in_desktop(tid, 'local')

    def test_linux_interfaces_do_not_depend_on_hostname_dns(self):
        data = [{'addr_info': [{'family': 'inet', 'local': ip} for ip in
                              ('127.0.0.1', '192.168.1.7', '172.16.1.2', '192.168.1.7', '0.0.0.0')]}]
        with patch.object(linux_interfaces.shutil, 'which', return_value='/usr/sbin/ip'), \
                patch.object(linux_interfaces.subprocess, 'run',
                             return_value=subprocess.CompletedProcess([], 0, json.dumps(data))) as command:
            rows = linux_interfaces.enumerate_interfaces()
            self.assertEqual(interfaces.eligible_lan_addresses(rows), ['172.16.1.2', '192.168.1.7'])
            self.assertEqual(command.call_args.args[0], ['/usr/sbin/ip', '-j', '-4', 'address', 'show', 'up'])


    def test_ip_failures_fail_closed_without_dns_guessing(self):
        for value in ('invalid json', '{}', '[null]'):
            with self.subTest(value=value), \
                    patch.object(linux_interfaces.subprocess, 'run',
                                 return_value=subprocess.CompletedProcess([], 0, value)):
                self.assertEqual(interfaces.eligible_lan_addresses(linux_interfaces.enumerate_interfaces()), [])
