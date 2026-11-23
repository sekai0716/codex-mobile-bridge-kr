"""A live but retired router must not trap the gateway after explicit recovery."""
import os
import socket
import time
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
import unittest
from unittest.mock import patch

from bridge.clients.codex.ipc import DesktopIPC, IPCError
from bridge.app.service import LiveSession
import test_bridge
from test_bridge import DesktopFixture, THREAD


class RecoveryTests(unittest.TestCase):
    setUp = test_bridge.IntegrationTests.setUp
    tearDown = test_bridge.IntegrationTests.tearDown

    def sibling(self):
        sibling = LiveSession('77777777-7777-4777-8777-777777777777')
        with self.bridge.lock:
            self.bridge.live[sibling.id] = sibling
        return sibling

    def test_target_failure_preserves_working_follower_and_has_no_host_restart_advice(self):
        target = self.bridge.session(THREAD)
        sibling = self.sibling()
        sibling.connected, sibling.owner = True, 'other-owner'
        sibling.retry_at, sibling.last_activation = 55, 14
        target.connected = False
        with patch.object(self.bridge, '_refresh_async'), patch.object(self.bridge, 'activate', side_effect=IPCError('no-client-found')), \
             patch.object(self.bridge.ipc, 'reconnect') as replace:
            with self.assertRaises(IPCError):
                self.bridge.rebuild_connection(target.id)
        replace.assert_not_called()
        self.assertEqual((True, 'other-owner', 55, 14, None), (sibling.connected, sibling.owner, sibling.retry_at,
                                                            sibling.last_activation, sibling.error))
        self.assertTrue(target.rebuild_recommended)
        self.assertFalse(target.desktop_restart_recommended)
        self.assertFalse(self.bridge.desktop_restart_recommended())

    def test_rebuild_preserves_another_inflight_follow(self):
        target = self.bridge.session(THREAD)
        sibling = self.sibling()
        sibling.connecting = sibling.owner_probe_inflight = sibling.discovering = True
        target.connected = False
        with patch.object(self.bridge, '_refresh_async'), patch.object(self.bridge, 'activate', return_value=target), \
             patch.object(self.bridge.ipc, 'reconnect') as replace:
            self.bridge.rebuild_connection(target.id)
        replace.assert_not_called()

    def test_transport_loss_does_not_reset_an_unfollowed_chat(self):
        target = self.bridge.session(THREAD)
        sibling = self.sibling()
        sibling.last_activation, sibling.retry_at, sibling.error = 12, 98, 'saved history only'
        self.bridge._disconnected()
        self.assertFalse(target.connected)
        self.assertTrue(target.rebuild_recommended)
        self.assertEqual((12, 98, 'saved history only', 0, False), (sibling.last_activation, sibling.retry_at,
                         sibling.error, sibling.sequence, sibling.rebuild_recommended))

    def test_late_write_failure_does_not_invalidate_recovered_session_or_repeat_write(self):
        target = self.bridge.session(THREAD)
        previous_owner = target.owner
        def late_failure(*args, **kwargs):
            self.assertEqual(kwargs['target'], previous_owner)
            self.bridge._invalidate(target, 'old connection lost', runtime='desktop', reason='desktop_ipc_disconnected')
            self.fixture.snapshot()
            with target.condition:
                self.assertTrue(target.condition.wait_for(lambda: target.connected, timeout=2))
            raise IPCError('request-timeout')
        with patch.object(self.bridge.ipc, 'request', side_effect=late_failure) as request:
            with self.assertRaisesRegex(IPCError, 'request-timeout'):
                self.bridge._call(target, 'thread-follower-start-turn', {'text': 'once'})
        request.assert_called_once()
        self.assertTrue(target.connected)
        self.assertIsNone(target.error)

    def test_owner_disconnect_requires_an_identified_client_on_this_host(self):
        target = self.bridge.session(THREAD)
        sibling = self.sibling()
        for params in (None, {'status': 'disconnected'}, {'status': 'disconnected', 'clientId': target.owner, 'hostId': 'other-host'}):
            self.bridge._event({'method': 'client-status-changed', 'params': params})
        self.assertTrue(target.connected)
        self.assertEqual(sibling.sequence, 0)
        self.bridge._event({'method': 'client-status-changed', 'params': {
            'status': 'disconnected', 'clientId': target.owner, 'hostId': self.bridge.native_host}})
        self.assertFalse(target.connected)
        self.assertEqual(sibling.sequence, 0)

    def test_recovered_host_retires_only_existing_restart_warnings(self):
        target = self.bridge.session(THREAD)
        target.connected = False
        sibling = self.sibling()
        sibling.desktop_restart_recommended = sibling.rebuild_recommended = True
        sibling.error = 'earlier host outage'
        self.fixture.snapshot()
        with sibling.condition:
            self.assertTrue(sibling.condition.wait_for(lambda: not sibling.desktop_restart_recommended, timeout=2))
        self.assertTrue(target.connected)
        self.assertTrue(sibling.rebuild_recommended)
        self.assertIn('this chat', sibling.error)
        self.assertFalse(self.bridge.desktop_restart_recommended())

    def test_follow_failure_after_matching_snapshot_keeps_connection(self):
        target = self.bridge.session(THREAD)
        target.connected = False
        def snapshot_then_fail(*args, **kwargs):
            self.fixture.snapshot()
            with target.condition:
                self.assertTrue(target.condition.wait_for(lambda: target.connected, timeout=2))
            raise IPCError('server-closed')
        with patch.object(self.bridge.ipc, 'follow', side_effect=snapshot_then_fail):
            self.bridge._attach(target)
        self.assertTrue(target.connected)
        self.assertIsNone(target.error)

    def test_changed_router_revalidates_target_even_with_a_working_sibling(self):
        target = self.bridge.session(THREAD)
        sibling = self.sibling()
        sibling.connected = True
        self.fixture.state['title'] = 'Fresh owner snapshot'
        with patch.object(self.bridge.ipc, 'endpoint_changed', return_value=True), patch.object(self.bridge.ipc, 'reconnect') as replace:
            self.bridge.activate(THREAD)
        self.assertEqual(target.state['title'], 'Fresh owner snapshot')
        self.assertTrue(sibling.connected)
        replace.assert_not_called()

    def test_recovering_one_chat_preserves_connected_sibling(self):
        session = self.bridge.session(THREAD)
        sibling = self.sibling()
        sibling.connected = True
        with session.condition:
            session.connected = False
            session.rebuild_recommended = True
        with patch.object(self.bridge.ipc, 'endpoint_changed', return_value=True), patch.object(
                self.bridge.ipc, 'reconnect') as replace:
            self.assertTrue(self.bridge.rebuild_connection(THREAD).connected)
        replace.assert_not_called()
        self.assertTrue(sibling.connected)

    def test_observed_socket_disconnect_recovers_before_old_success_cooldown(self):
        if os.name == 'nt':
            self.skipTest('Unix pathname replacement')
        session = self.bridge.session(THREAD)
        self.assertTrue(session.connected)
        session.viewers = 1
        session.retry_at = time.monotonic() + 15
        old = self.fixture
        old.loaded = False
        Path(old.path).unlink()
        alternate = self.root/'fast-router'
        alternate.mkdir()
        fresh = DesktopFixture(alternate)
        fresh.state['title'] = 'Replacement owner'
        Path(fresh.path).rename(old.path)
        self.addCleanup(fresh.close)
        started = time.monotonic()
        old.client.shutdown(socket.SHUT_RDWR)
        with session.condition:
            recovered = session.condition.wait_for(
                lambda: session.connected and session.state.get('title') == 'Replacement owner', timeout=4.5)
        self.assertTrue(recovered, 'A ready replacement owner must not wait for the old 15-second success cooldown')
        self.assertLess(time.monotonic()-started, 4.5)
        self.assertEqual(session.state['modelProvider'], 'custom-api')
        self.assertFalse(any(r['method'].startswith('thread-follower-') for r in fresh.requests))

    def test_first_failed_probe_during_native_router_startup_has_bounded_short_retry(self):
        if os.name == 'nt':
            self.skipTest('Unix pathname replacement')
        session = self.bridge.session(THREAD)
        session.viewers = 1
        old = self.fixture
        old.loaded = False
        Path(old.path).unlink()
        fresh = []
        def publish_router():
            time.sleep(1)
            alternate = self.root/'delayed-router'
            alternate.mkdir()
            replacement = DesktopFixture(alternate)
            replacement.state['title'] = 'Delayed replacement'
            Path(replacement.path).rename(old.path)
            fresh.append(replacement)
        worker = threading.Thread(target=publish_router, daemon=True)
        started = time.monotonic()
        old.client.shutdown(socket.SHUT_RDWR)
        with session.condition:
            self.assertTrue(session.condition.wait_for(lambda: not session.connected, timeout=1))
        worker.start()
        try:
            # Fail before the native replacement is listening, then let the
            # ordinary maintainer recover without an explicit user activation.
            self.bridge._refresh_async(session, force=True)
            with session.condition:
                recovered = session.condition.wait_for(
                    lambda: session.connected and session.state.get('title') == 'Delayed replacement', timeout=4.5)
            self.assertTrue(recovered)
            self.assertLess(time.monotonic()-started, 4.5)
            self.assertFalse(any(r['method'].startswith('thread-follower-') for f in fresh for r in f.requests))
        finally:
            worker.join(2)
            for replacement in fresh:
                replacement.close()

    def test_short_failure_retry_expires_and_success_has_no_failure_cooldown(self):
        session = self.bridge.session(THREAD)
        with patch.object(self.bridge, '_attach'):
            for window, low, high in ((6, .3, .7), (-1, 14, 16)):
                with session.condition:
                    session.connected = False
                    session.retry_at = 0
                    session.desktop_recovery_until = time.monotonic()+window
                self.bridge._refresh_async(session)
                with session.condition:
                    self.assertTrue(session.condition.wait_for(lambda: not session.connecting, timeout=1))
                    remaining = session.retry_at-time.monotonic()
                self.assertGreater(remaining, low)
                self.assertLess(remaining, high)
        self.bridge._refresh_async(session, force=True)
        with session.condition:
            self.assertTrue(session.condition.wait_for(lambda: session.connected and not session.connecting, timeout=1))
            self.assertEqual(session.retry_at, 0)

    def test_activity_and_notification_probes_keep_the_short_recovery_deadline(self):
        session = self.bridge.session(THREAD)
        self.bridge.listed.add(THREAD)
        for source in ('activity', 'notification'):
            started, release = threading.Event(), threading.Event()
            def attach(*args, **kwargs):
                started.set()
                release.wait(1)
            with session.condition:
                session.connected = False
                session.retry_at = 0
                session.desktop_recovery_until = time.monotonic()+6
            with patch.object(self.bridge, '_attach', side_effect=attach):
                try:
                    if source == 'activity':
                        self.bridge.activity([THREAD])
                    else:
                        self.bridge.notification_session(THREAD)
                    self.assertTrue(started.wait(1), source)
                    self.assertLess(session.retry_at-time.monotonic(), 1, source)
                finally:
                    release.set()

    def test_passive_deadline_assignment_serializes_with_invalidation(self):
        session = self.bridge.session(THREAD)
        self.bridge.listed.add(THREAD)
        for source in ('activity', 'maintenance'):
            checked, started, release = [], threading.Event(), threading.Event()
            class Deadline:
                def __gt__(self, now):
                    checked.append(session.condition._is_owned())
                    return True
            def attach(*args, **kwargs):
                started.set()
                release.wait(1)
            with session.condition:
                session.connected = False
                session.retry_at = 0
                session.desktop_recovery_until = Deadline()
                session.activity_only = source == 'maintenance'
                session.watched = source == 'maintenance'
            with patch.object(self.bridge, '_attach', side_effect=attach):
                try:
                    if source == 'activity':
                        self.bridge.activity([THREAD])
                    self.assertTrue(started.wait(4), source)
                    self.assertTrue(checked[0], source+' must atomically read the window and assign its deadline')
                finally:
                    release.set()
                    with session.condition:
                        session.desktop_recovery_until = 0

    def test_late_old_refresh_cannot_restore_deadline_after_disconnect(self):
        session = self.bridge.session(THREAD)
        started, release = threading.Event(), threading.Event()
        def attach(*_):
            started.set()
            release.wait(2)
        with session.condition:
            session.connected = False
            session.retry_at = 0
        with patch.object(self.bridge, '_attach', side_effect=attach):
            self.bridge._refresh_async(session)
            self.assertTrue(started.wait(1))
            self.bridge._invalidate(session, 'connection reset', runtime='desktop', reason='desktop_ipc_disconnected')
            release.set()
            with session.condition:
                self.assertTrue(session.condition.wait_for(lambda: not session.connecting, timeout=1))
                self.assertEqual(session.retry_at, 0, 'The retired probe must not replace the fresh recovery deadline')

    def test_explicit_connect_replaces_retired_socket_even_if_snapshot_was_connected(self):
        if os.name == 'nt':
            self.skipTest('Unix pathname replacement')
        session = self.bridge.session(THREAD)
        self.assertTrue(session.connected)
        old = self.fixture
        old.loaded = False
        Path(old.path).unlink()
        alternate = self.root / 'replacement'
        alternate.mkdir()
        fresh = DesktopFixture(alternate)
        fresh.state['title'] = 'Current router'
        Path(fresh.path).rename(old.path)
        self.addCleanup(fresh.close)
        original_socket = self.bridge.ipc.socket
        with patch('bridge.app.service.open_in_desktop') as navigate:
            result = self.bridge.activate(THREAD)
        self.assertIsNot(self.bridge.ipc.socket, original_socket)
        self.assertTrue(result.connected)
        self.assertEqual(result.state['title'], 'Current router')
        self.assertTrue(old.worker.is_alive())
        navigate.assert_not_called()
        self.assertFalse(any(r['method'].startswith('thread-follower-') for r in fresh.requests))

    def test_explicit_connect_rebuilds_once_after_owner_disconnect(self):
        session = self.bridge.session(THREAD)
        self.bridge._disconnected()
        with patch.object(self.bridge, '_refresh_async'), patch.object(
                self.bridge.ipc, 'reconnect', wraps=self.bridge.ipc.reconnect) as reconnect, patch(
                'bridge.app.service.open_in_desktop') as navigate:
            result = self.bridge.activate(THREAD)
        self.assertTrue(result.connected)
        reconnect.assert_called_once_with()
        navigate.assert_not_called()

    def test_replaced_path_does_not_detach_an_owner_still_answering_on_old_router(self):
        if os.name == 'nt':
            self.skipTest('Unix pathname replacement')
        session = self.bridge.session(THREAD)
        original_socket = self.bridge.ipc.socket
        Path(self.fixture.path).unlink()
        alternate = self.root / 'replacement'
        alternate.mkdir()
        fresh = DesktopFixture(alternate)
        fresh.loaded = False
        Path(fresh.path).rename(self.fixture.path)
        self.addCleanup(fresh.close)
        with patch('bridge.app.service.open_in_desktop') as navigate:
            result = self.bridge.activate(THREAD)
        self.assertTrue(result.connected)
        self.assertEqual(result.state['title'], 'Desktop test')
        self.assertIs(self.bridge.ipc.socket, original_socket)
        self.assertEqual(fresh.requests, [])
        navigate.assert_not_called()

    def test_recovery_waits_for_inflight_host_operation_before_replacing_follower(self):
        session = self.bridge.session(THREAD)
        self.bridge._disconnected()
        started, replaced = threading.Event(), threading.Event()
        original_socket = self.bridge.ipc.socket
        rebuild = self.bridge._rebuild_desktop_transport
        def replace(thread_id):
            replaced.set()
            return rebuild(thread_id)
        def reconnect():
            started.set()
            return self.bridge.reconnect_session(THREAD)
        with patch.object(self.bridge, '_refresh_async'), patch.object(
                self.bridge, '_rebuild_desktop_transport', side_effect=replace):
            with ThreadPoolExecutor(max_workers=1) as executor:
                with self.bridge.accounts.gate.host('local'):
                    pending = executor.submit(reconnect)
                    self.assertTrue(started.wait(1))
                    self.assertFalse(replaced.wait(.05))
                    self.assertIs(self.bridge.ipc.socket, original_socket)
                self.assertTrue(pending.result(timeout=3).connected)
        self.assertTrue(replaced.is_set())

    def test_duplicate_explicit_reconnects_share_one_result_before_gate_queue(self):
        started, release = threading.Event(), threading.Event()
        joined = threading.Barrier(3)
        future = Future()
        original_result = future.result
        def wait_for_result():
            joined.wait(timeout=2)
            return original_result()
        def activate(thread_id):
            started.set()
            release.wait(2)
            raise IPCError('owner unavailable')
        with patch.object(self.bridge, 'activate', side_effect=activate) as activate, patch(
                'bridge.app.service.Future', return_value=future), patch.object(
                future, 'result', side_effect=wait_for_result):
            with ThreadPoolExecutor(max_workers=3) as executor:
                first = executor.submit(self.bridge.reconnect_session, THREAD)
                self.assertTrue(started.wait(1))
                second = executor.submit(self.bridge.reconnect_session, THREAD)
                third = executor.submit(self.bridge.reconnect_session, THREAD)
                joined.wait(timeout=2)
                release.set()
                for result in (first, second, third):
                    with self.assertRaisesRegex(IPCError, 'owner unavailable'):
                        result.result(timeout=2)
                self.assertEqual(activate.call_count, 1)
        self.assertFalse(self.bridge.reconnect_pending)

    def test_close_interrupts_blocked_write_even_while_reader_holds_event_lock(self):
        started, released, finished = threading.Event(), threading.Event(), threading.Event()
        class BlockedStream:
            def sendall(self, data):
                started.set()
                released.wait(3)
                raise OSError('closed')
            def shutdown(self, how):
                released.set()
            def close(self):
                released.set()
        ipc = DesktopIPC('unused')
        ipc.socket = BlockedStream()
        def write():
            with ipc.event_lock:
                try:
                    ipc._send({'text': 'blocked discovery reply'})
                except IPCError:
                    pass
                finally:
                    finished.set()
        writer = threading.Thread(target=write, daemon=True)
        writer.start()
        self.assertTrue(started.wait(1))
        self.assertFalse(finished.is_set())
        closer = threading.Thread(target=ipc.close, daemon=True)
        closer.start()
        try:
            closer.join(1)
            self.assertFalse(closer.is_alive(), 'Closing must interrupt the blocked send before waiting on its locks')
            writer.join(1)
            self.assertTrue(finished.is_set())
            self.assertIsNone(ipc.socket)
        finally:
            released.set()
            writer.join(1)
            closer.join(1)

    def test_rebuild_leaves_native_running_and_uses_replacement_router(self):
        if os.name == 'nt':
            self.skipTest('Unix pathname replacement; Windows reconnect covered separately')
        session = self.bridge.session(THREAD)
        old = self.fixture
        old.loaded = False
        self.bridge._disconnected()
        Path(old.path).unlink()  # Old server and its accepted connection stay alive.
        alternate = self.root / 'replacement'
        alternate.mkdir()
        fresh = DesktopFixture(alternate)
        fresh.state['title'] = 'Current router'
        Path(fresh.path).rename(old.path)
        self.addCleanup(fresh.close)
        original_socket = self.bridge.ipc.socket
        self.bridge._attach(session, timeout=.01)
        self.assertFalse(session.connected, 'Existing connection still reaches retired router')
        with patch('bridge.app.service.open_in_desktop') as navigate:
            result = self.bridge.rebuild_connection(THREAD)
        self.assertTrue(result.connected)
        self.assertIsNot(self.bridge.ipc.socket, original_socket)
        self.assertEqual(result.state['title'], 'Current router')
        self.assertTrue(old.worker.is_alive(), 'No native shutdown')
        self.assertFalse(navigate.called, 'Available owner needs no navigation')
        self.assertFalse(any(r['method'].startswith('thread-follower-') for r in fresh.requests))

    def test_disconnection_recommends_remote_rebuild_and_snapshot_clears_it(self):
        session = self.bridge.session(THREAD)
        self.bridge._disconnected()
        self.assertTrue(session.view()['rebuildRecommended'])
        session.desktop_restart_recommended = True
        self.fixture.snapshot()
        with session.condition:
            self.assertTrue(session.condition.wait_for(lambda: session.connected, timeout=2))
        self.assertFalse(session.view()['rebuildRecommended'])
        self.assertFalse(self.bridge.desktop_restart_recommended())

    def test_reconnect_clears_old_transport_synchronously(self):
        ipc = self.bridge.ipc
        ipc.connect()
        old = ipc.socket
        ipc.reconnect()
        self.assertIsNot(ipc.socket, old)
        self.assertTrue(ipc.client_id)
        client_id = ipc.client_id
        ipc._disconnect(old)  # A delayed old reader must not invalidate the replacement.
        self.assertEqual(ipc.client_id, client_id)

    def test_unreachable_owner_finishes_with_remote_rebuild_available(self):
        session = self.bridge.session(THREAD)
        self.bridge._disconnected()
        with patch.object(self.bridge, '_attach'), patch('bridge.app.service.open_in_desktop', side_effect=OSError('unavailable')):
            with self.assertRaisesRegex(IPCError, "게이트웨이\\ 연결이\\ 다시\\ 설정되었지만\\ 원래\\ 데스크톱\\ 세션은\\ 복원되지\\ 않았습니다\\.\\ 애플리케이션\\ 관리에서\\ 작업을\\ 확인한\\ 후\\ 다시\\ 시작할\\ 수\\ 있습니다\\.\\ Codex；작업이\\ 전송되지\\ 않았습니다\\.。"):
                self.bridge.rebuild_connection(THREAD)
        self.assertTrue(session.view()['desktopRestartRecommended'])
        self.assertTrue(self.bridge.desktop_restart_recommended())
        self.assertFalse(session.activating)
        self.assertFalse(session.connected)
        self.assertTrue(session.view()['rebuildRecommended'])

    def test_retry_after_transport_replacement_error_reattaches_without_restart(self):
        session = self.bridge.session(THREAD)
        self.bridge._disconnected()
        session.rebuild_recommended = False
        with patch.object(self.bridge, '_refresh_async'), patch.object(
                self.bridge.ipc, 'reconnect', side_effect=IPCError('interrupted')):
            with self.assertRaisesRegex(IPCError, "원래\\ 데스크톱\\ 세션의\\ 연결이\\ 여전히\\ 끊어졌습니다\\.\\ 다시\\ 재구축해\\ 보세요\\.\\ 실패하면\\ Codex를\\ 다시\\ 시작하기\\ 전에\\ 앱\\ 관리에서\\ 작업을\\ 검토하세요\\."):
                self.bridge.rebuild_connection(THREAD)
        self.assertTrue(session.view()['desktopRestartRecommended'])
        self.assertTrue(session.view()['rebuildRecommended'])
        with patch('bridge.app.service.open_in_desktop') as navigate:
            result = self.bridge.rebuild_connection(THREAD)
        self.assertTrue(result.connected)
        self.assertFalse(result.view()['desktopRestartRecommended'])
        self.assertFalse(result.view()['rebuildRecommended'])
        navigate.assert_not_called()

    def test_missing_owner_invalidates_control_without_replaying_write(self):
        session = self.bridge.session(THREAD)
        with patch.object(self.bridge.ipc, 'request', side_effect=IPCError('no-client-found')) as request:
            with self.assertRaises(IPCError):
                self.bridge._call(session, 'thread-follower-start-turn', {'text': 'only once'})
        self.assertEqual(request.call_count, 1)
        self.assertFalse(session.connected)
        self.assertTrue(session.view()['rebuildRecommended'])

if __name__ == '__main__':
    unittest.main()
