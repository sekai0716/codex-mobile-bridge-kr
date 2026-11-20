"""Linux 공유 런타임의 실제 /proc 신원과 시작·연결 경계를 검증한다."""
import json
import os
import socket
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import Mock, patch

from bridge.clients import desktop_app
from bridge.clients.codex import desktop_runtime as runtime
from bridge.clients.codex.app_server import AppServerUnavailable
from bridge.platforms.linux.codex_daemon_env import desktop_process_identity, read_process_environment

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(sys.platform == 'linux', 'Linux /proc identity and Unix transport')
class LinuxDesktopRuntimeTests(unittest.TestCase):
    def test_package_replacement_keeps_the_running_process_generation(self):
        with tempfile.TemporaryDirectory() as folder:
            executable=Path(folder)/'sleep'
            shutil.copy2(shutil.which('sleep'),executable)
            with subprocess.Popen([str(executable),'30'], env={**os.environ,'BRIDGE_TEST_PROFILE':'isolated'}) as process:
                try:
                    before=runtime.process_identity(process.pid)
                    executable.unlink()
                    shutil.copy2(shutil.which('true'),executable)
                    self.assertEqual(runtime.process_identity(process.pid),before)
                    from bridge.platforms.linux.desktop import processes
                    self.assertIn(process.pid, processes(lambda path: path == executable))
                    profile, _ = read_process_environment(process.pid, {'processIdentity': before}, executable,
                                                          ('BRIDGE_TEST_PROFILE',))
                    self.assertEqual(profile, {'BRIDGE_TEST_PROFILE':'isolated'})
                finally:
                    process.terminate()

    def test_gateway_exit_only_allows_the_same_desktop_app_to_be_adopted_by_init(self):
        app = runtime.process_identity(os.getpid())
        record = {'app': app, 'adapter': {**app, 'pid': 20, 'parent': app['pid']},
                  'runtime': {**app, 'pid': 21, 'parent': 20}}
        current = {row['pid']: row.copy() for row in record.values()}
        current[app['pid']]['parent'] = 1
        with patch.object(runtime, 'process_identity', side_effect=current.__getitem__):
            runtime._verify_shared_processes(record)
            current[20]['parent'] = 1
            with self.assertRaises(ValueError):
                runtime._verify_shared_processes(record)
            current[20] = record['adapter']
            current[app['pid']]['startTicks'] += 1
            with self.assertRaises(ValueError):
                runtime._verify_shared_processes(record)

    def test_live_generation_uses_boot_ticks_and_real_effective_uids(self):
        identity = runtime.process_identity(os.getpid())
        self.assertEqual(identity['parent'], os.getppid())
        self.assertEqual((identity['ruid'], identity['uid']), (os.getuid(), os.geteuid()))
        self.assertEqual(identity['bootId'], Path('/proc/sys/kernel/random/boot_id').read_text().strip())
        self.assertEqual(identity['startTicks'], int(Path('/proc/self/stat').read_text().rpartition(')')[2].split()[19]))
        self.assertEqual(identity['image'], str(Path(sys.executable).resolve()))
        self.assertFalse(identity['zombie'])
        record = {'processIdentity': {key: identity[key] for key in ('bootId', 'startTicks')}}
        environment, generation = read_process_environment(os.getpid(), record, identity['image'], ())
        self.assertEqual(environment, {})
        self.assertEqual(generation, (os.getpid(), identity['startTicks'], identity['image']))
        with patch.object(runtime, 'process_identity', return_value={**identity, 'parent': 1}):
            self.assertTrue(runtime.runtime_alive(identity))
        for field, changed in (('bootId', 'another-boot'), ('startTicks', identity['startTicks'] + 1)):
            with self.subTest(field=field), \
                 patch.object(runtime, 'process_identity', return_value={**identity, field: changed}):
                self.assertFalse(runtime.runtime_alive(identity))
        with patch('bridge.platforms.linux.codex_daemon_env.desktop_process_identity',
                   return_value={**identity, 'ruid': os.getuid() + 1}):
            with self.assertRaises(ValueError):
                runtime.process_identity(os.getpid())

    def test_mid_inspection_exec_or_pid_reuse_is_rejected(self):
        original = Path.read_text
        count = 0
        def read(path, *args, **kwargs):
            nonlocal count
            text = original(path, *args, **kwargs)
            if path == Path('/proc') / str(os.getpid()) / 'stat':
                count += 1
                if count == 2:
                    head, _, tail = text.rpartition(')')
                    fields = tail.split()
                    fields[19] = str(int(fields[19]) + 1)
                    return head + ') ' + ' '.join(fields)
            return text
        with patch.object(Path, 'read_text', read):
            with self.assertRaisesRegex(OSError, 'changed during inspection'):
                desktop_process_identity(os.getpid())

    def test_pending_exec_and_reparenting_do_not_release_writer_reservation(self):
        identity = runtime.process_identity(os.getpid())
        record = {'ready': False, 'runtime': {**identity, 'image': '/bin/sh', 'parent': 1}}
        with self.assertRaisesRegex(ValueError, '종료되지'):
            runtime.require_inactive(record)
        record['ready'] = True
        record['runtime'] = {**identity, 'parent': 1}
        with self.assertRaisesRegex(ValueError, '종료되지'):
            runtime.require_inactive(record)

    def test_linux_start_passes_verified_adapter_and_waits_for_previous_exit(self):
        app = desktop_app.DesktopApp(sys.executable, ROOT)
        environment = {'CODEX_CLI_PATH': '/private/verified-adapter'}
        with patch.dict(os.environ, {'DISPLAY': ':1', 'XDG_SESSION_TYPE':'x11'}), \
             patch.object(runtime, 'launch_environment', return_value=environment), \
             patch.object(runtime, 'wait_stopped') as wait, \
             patch('bridge.platforms.posix.desktop.start') as start:
            app.start()
            wait.assert_called_once_with(app.home)
            start.assert_called_once_with(app.executable, app.home, {'CODEX_HOME': str(app.home), **environment},
                                          arguments=('--force-renderer-accessibility',))
            start.reset_mock()
            wait.side_effect = ValueError('previous writer remains')
            with self.assertRaisesRegex(ValueError, 'previous writer remains'):
                app.start()
            start.assert_not_called()

    def test_linux_configuration_connects_only_to_recorded_private_generation(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.tmp') as temporary:
            home = Path(temporary).resolve()
            executable = str(Path(sys.executable).resolve())
            runtime.configure(home, executable, executable)
            environment = runtime.launch_environment(home, executable)
            self.assertEqual(environment['CODEX_CLI_PATH'], str(runtime.directory(home) / 'codex-cli'))
            self.assertEqual(Path(environment['CODEX_CLI_PATH']).stat().st_mode & 0o777, 0o700)
            endpoint = home / 'native.sock'
            with socket.socket(socket.AF_UNIX) as server:
                server.bind(str(endpoint)); endpoint.chmod(0o600)
                actual = runtime.process_identity(os.getpid())
                identities = {1: {**actual, 'pid': 1, 'parent': 0, 'image': executable},
                              2: {**actual, 'pid': 2, 'parent': 1},
                              3: {**actual, 'pid': 3, 'parent': 2}}
                record = {'version': 1, 'ready': True, 'home': str(home), 'cli': executable,
                          'app': identities[1], 'adapter': identities[2], 'runtime': identities[3],
                          'socket': str(endpoint), 'generation': str(uuid.uuid4())}
                runtime._write(runtime.directory(home) / 'active.json', json.dumps(record))
                client = Mock(); client.connect.return_value = {'codexHome': str(home)}
                with patch.object(runtime, 'socket_path', return_value=endpoint), \
                     patch.object(runtime, 'process_identity', side_effect=lambda pid: dict(identities[pid])), \
                     patch.object(runtime, 'CodexAppServer', return_value=client):
                    self.assertIs(runtime.connect(home, executable), client)
                    def swap():
                        identities[3] = {**identities[3], 'startTicks': actual['startTicks'] + 1}
                        return {'codexHome': str(home)}
                    client.connect.side_effect = swap
                    with self.assertRaises(AppServerUnavailable):
                        runtime.connect(home, executable)
                    client.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
