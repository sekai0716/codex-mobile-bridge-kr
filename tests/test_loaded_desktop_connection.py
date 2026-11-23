import threading
import unittest
from contextlib import ExitStack
from unittest.mock import Mock, patch

from bridge.app.service import Bridge, LiveSession, SHARED_DESKTOP_SETUP
from bridge.clients.codex.app_server import AppServerUnavailable, AppServerUnsupported
from bridge.clients.codex.ipc import IPCError


class LoadedDesktopConnection(unittest.TestCase):
    def setUp(self):
        self.sid = '55555555-5555-4555-8555-555555555555'
        self.session = LiveSession(self.sid)
        self.bridge = Bridge.__new__(Bridge)
        self.bridge.host, self.bridge.codex_home = 'local', '/fixture'
        self.bridge.lock, self.bridge.closed = threading.RLock(), threading.Event()
        self.bridge.live, self.bridge.reconnect_pending = {self.sid: self.session}, {}
        self.bridge.notification_dirty, self.bridge.notification_event = set(), threading.Event()
        self.bridge.created_desktop_runtime = None
        self.bridge.session = Mock(return_value=self.session)
        self.row = {'id': self.sid, 'origin': 'desktop', 'archived': 0, 'creator_account_id': 'fixture',
                    'model_provider': 'openai', 'cwd': '/project'}
        self.bridge.store = Mock()
        self.bridge.store.get.return_value = self.row
        self.bridge.ipc = Mock(client_id=None)
        self.bridge.ipc.owner.side_effect = IPCError('no-client-found')
        self.bridge._attach, self.bridge._access = Mock(), Mock(return_value={})
        self.bridge._creation_entry = Mock(return_value=None)
        self.bridge.rebuild_connection = Mock()
        self.bridge.activate = Mock()
        self.runtime = Mock()
        self.state = {'id': self.sid, 'modelProvider': 'openai', 'turns': [], 'requests': [],
                      'threadRuntimeStatus': {'type': 'active'}}
        self.runtime.attach_loaded_desktop.return_value = self.state
        self.bridge.cli_sessions = Mock()
        self.start = self.bridge.cli_sessions.loaded_desktop_runtime
        self.start.return_value = self.runtime
        patches = ExitStack()
        self.addCleanup(patches.close)
        self.settings = patches.enter_context(patch('bridge.clients.codex.desktop_runtime.settings', return_value={}))
        patches.enter_context(patch('bridge.app.service.sys.platform', 'linux'))

    def test_explicit_rebuild_retains_original_thread_and_receives_live_updates(self):
        def attach(*args, **kwargs):
            self.assertFalse(self.session.connected)
            publish = self.start.call_args.kwargs['on_state']
            publish(self.sid, dict(self.state, title='newer than resume'))
            return self.state
        self.runtime.attach_loaded_desktop.side_effect = attach
        self.assertIs(self.bridge.reconnect_session(self.sid, rebuild=True), self.session)
        self.assertIs(self.session.creation_runtime, self.runtime)
        self.assertEqual(self.session.state['title'], 'newer than resume')
        self.runtime.attach_loaded_desktop.assert_called_once_with(self.sid, cwd='/project', provider='openai')
        self.bridge._verify_cli_submission_account(self.session)
        self.runtime._check_joined_identity.assert_called_once_with(self.sid)
        self.bridge.rebuild_connection.assert_not_called()
        publish = self.start.call_args.kwargs['on_state']
        publish(self.sid, dict(self.state, title='stream'))
        self.assertEqual(self.session.state['title'], 'stream')
        self.bridge._call(self.session, 'thread-follower-start-turn', {})
        self.runtime.call.assert_called_once_with(self.sid, 'thread-follower-start-turn', {}, timeout=30)
        self.bridge.cli_sessions.call.assert_not_called()
        self.start.call_args.kwargs['on_disconnect']()
        self.assertFalse(self.session.connected)
        self.assertIsNone(self.session.creation_runtime)
        self.assertEqual(self.session.runtime, 'desktop')
        publish(self.sid, self.state)
        self.assertFalse(self.session.connected)
        with self.assertRaises(IPCError):
            self.bridge._call(self.session, 'thread-follower-start-turn', {})
        self.bridge.ipc.request.assert_not_called()

    def test_lost_original_writer_before_dispatch_cannot_use_default_cli(self):
        self.bridge.reconnect_session(self.sid)
        disconnect = self.start.call_args.kwargs['on_disconnect']
        self.runtime.call.side_effect = AppServerUnavailable('original runtime disconnected')
        with self.assertRaisesRegex(IPCError, 'original runtime disconnected'):
            self.bridge._call(self.session, 'thread-follower-start-turn', {}, before_write=disconnect)
        self.bridge.cli_sessions.call.assert_not_called()
        self.bridge.ipc.request.assert_not_called()

    def test_original_owner_and_uncertain_discovery_take_legacy_route(self):
        for error in (None, IPCError('request-timeout')):
            with self.subTest(error=error):
                self.bridge.ipc.owner.side_effect = error
                self.bridge.ipc.owner.return_value = 'desktop-writer'
                self.assertIsNone(self.bridge._connect_loaded_desktop(self.sid))
        self.start.assert_not_called()

    def test_late_original_snapshot_outlives_failed_shared_handshake(self):
        def connected(**callbacks):
            self.session.connected = True
            self.session.owner = 'original-desktop'
            raise AppServerUnavailable('shared runtime offline')
        self.start.side_effect = connected
        self.assertIs(self.bridge.reconnect_session(self.sid, rebuild=True), self.session)
        self.assertIsNone(self.session.error)
        self.assertIsNone(self.session.shared_desktop_error)
        self.bridge.rebuild_connection.assert_not_called()

    def test_unprepared_and_different_account_show_distinct_errors_without_navigation(self):
        self.start.side_effect = AppServerUnavailable('not ready')
        with self.assertRaisesRegex(IPCError, 'shared connection is not ready'):
            self.bridge.reconnect_session(self.sid, rebuild=True)
        self.assertEqual(self.session.shared_desktop_error, SHARED_DESKTOP_SETUP)
        self.start.side_effect = None
        account_error = 'The Codex desktop is connected to a different account or workspace. Select the same account in Bridge and the desktop app.'
        self.runtime.attach_loaded_desktop.side_effect = AppServerUnsupported(account_error)
        with self.assertRaisesRegex(IPCError, 'different account or workspace'):
            self.bridge.reconnect_session(self.sid, rebuild=True)
        self.assertEqual(self.session.shared_desktop_error, account_error)
        self.assertEqual(self.start.call_count, 2)
        self.assertFalse(self.session.connected)
        self.bridge.activate.assert_not_called()
        self.bridge.rebuild_connection.assert_not_called()

    def test_missing_settings_or_unrelated_threads_cannot_enter_shared_route(self):
        for key, value in [('archived', 1), ('origin', 'cli'), ('model_provider', 'other'),
                           ('agent_path', '/root/worker'), ('attached_thread_parent_id', 'parent')]:
            with self.subTest(key=key), patch.dict(self.row, {key: value}):
                self.assertIsNone(self.bridge._connect_loaded_desktop(self.sid))
        self.settings.return_value = None
        self.assertIsNone(self.bridge._connect_loaded_desktop(self.sid))
        self.start.assert_not_called()

    def test_disconnect_during_handshake_cannot_publish_stale_snapshot_or_replay(self):
        def lost(*args, **kwargs):
            self.start.call_args.kwargs['on_disconnect']()
            return self.state
        self.runtime.attach_loaded_desktop.side_effect = lost
        with self.assertRaises(IPCError):
            self.bridge.reconnect_session(self.sid)
        self.assertFalse(self.session.connected)
        self.assertIsNone(self.session.creation_runtime)
        self.runtime.close.assert_called_once()
        self.runtime.call.assert_not_called()
