"""Queued Send now crosses the real gateway/desktop IPC seam using synthetic owners."""
import copy
import json
import threading
import unittest
import uuid
from unittest.mock import Mock, patch

import test_bridge as support
from bridge.clients.codex.ipc import IPCError
from bridge.features.sessions.message_management import queue_version

THREAD = support.THREAD


class QueueSendNowTests(unittest.TestCase):
    def setUp(self):
        support.IntegrationTests.setUp(self)
        self.identity = patch.object(self.bridge, '_draft_account_identity', return_value='account-a')
        self.identity.start()
        self.addCleanup(self.identity.stop)
        self.fixture.state['threadRuntimeStatus'] = {'type': 'active'}
        self.assertTrue(self.bridge.view(THREAD)['connected'])

    tearDown = support.IntegrationTests.tearDown

    def queue(self, text='queued instructions', work_mode='plan'):
        identifier = str(uuid.uuid4())
        self.assertEqual(self.bridge.send(THREAD, text, identifier, 'queue', work_mode=work_mode)['status'], 'queued')
        return identifier

    def version(self, identifier):
        return queue_version(identifier, self.bridge.submissions[THREAD + ':' + identifier])

    def writes(self):
        return [r for r in self.fixture.requests if r['method'] in ('thread-follower-start-turn', 'thread-follower-steer-turn')]

    def test_active_queue_promotes_same_id_without_changing_work_mode_or_other_queue(self):
        first = self.queue()
        second = self.queue('next queued message')
        original = copy.deepcopy(self.bridge.submissions[THREAD + ':' + first])
        row = next(row for row in self.bridge.view(THREAD)['submissions'] if row['id'] == first)
        self.assertTrue(row['canSendNow'])
        self.assertEqual(row['version'], self.version(first))
        result = self.bridge.send_queued_now(THREAD, first, row['version'], 'account-a')
        self.assertEqual(result['status'], 'accepted')
        writes = self.writes()
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0]['method'], 'thread-follower-steer-turn')
        self.assertEqual(writes[0]['targetClientId'], 'owner')
        self.assertEqual(writes[0]['params']['clientUserMessageId'], first)
        self.assertNotIn('collaborationMode', writes[0]['params']['restoreMessage']['request'])
        self.assertEqual({k: v for k, v in self.bridge.submissions[THREAD + ':' + first].items() if k != 'status'},
                         {k: v for k, v in original.items() if k != 'status'})
        self.assertEqual(self.bridge.submissions[THREAD + ':' + second]['status'], 'queued')

    def test_idle_queue_starts_same_id_and_retains_queued_plan(self):
        identifier = self.queue()
        session = self.bridge.live[THREAD]
        with session.action_lock:
            self.fixture.state['threadRuntimeStatus'] = {'type': 'idle'}
            session.state['threadRuntimeStatus'] = {'type': 'idle'}
            result = self.bridge.send_queued_now(THREAD, identifier, self.version(identifier), 'account-a')
        self.assertEqual(result['status'], 'accepted')
        sent = self.writes()[0]
        self.assertEqual(sent['method'], 'thread-follower-start-turn')
        request = sent['params']['turnStart']['request']
        self.assertEqual(request['clientUserMessageId'], identifier)
        self.assertEqual(request['collaborationMode']['mode'], 'plan')

    def test_concurrent_clicks_dispatch_once_and_original_send_replay_keeps_receipt(self):
        identifier = self.queue()
        version = self.version(identifier)
        results, errors = [], []
        def send():
            try:
                results.append(self.bridge.send_queued_now(THREAD, identifier, version, 'account-a'))
            except Exception as error:
                errors.append(error)
        threads = [threading.Thread(target=send) for _ in range(2)]
        for thread in threads: thread.start()
        for thread in threads: thread.join(5)
        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        self.assertEqual([result['status'] for result in results], ['accepted', 'accepted'])
        self.assertEqual(len(self.writes()), 1)
        self.assertEqual(self.bridge.send(THREAD, 'queued instructions', identifier, 'queue', work_mode='plan')['status'], 'accepted')
        self.assertEqual(len(self.writes()), 1)

    def test_stale_content_account_and_hidden_goal_never_dispatch(self):
        identifier = self.queue()
        version = self.version(identifier)
        with self.assertRaises(ValueError):
            self.bridge.send_queued_now(THREAD, identifier, version, 'other-account')
        self.bridge.submissions[THREAD + ':' + identifier]['text'] = 'edited elsewhere'
        with self.assertRaises(ValueError):
            self.bridge.send_queued_now(THREAD, identifier, version, 'account-a')
        self.bridge.submissions[THREAD + ':' + identifier]['goalActivation'] = {'objective': 'hidden goal'}
        with self.assertRaises(ValueError):
            self.bridge.send_queued_now(THREAD, identifier, self.version(identifier), 'account-a')
        self.assertEqual(self.bridge.submissions[THREAD + ':' + identifier]['status'], 'queued')
        self.assertEqual(self.writes(), [])

    def test_failed_persistence_restores_queue_before_any_native_bytes(self):
        identifier = self.queue()
        original = copy.deepcopy(self.bridge.submissions[THREAD + ':' + identifier])
        with patch.object(self.bridge, '_save_ledger', side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError):
                self.bridge.send_queued_now(THREAD, identifier, self.version(identifier), 'account-a')
        self.assertEqual(self.bridge.submissions[THREAD + ':' + identifier], original)
        self.assertEqual(self.writes(), [])

    def test_connected_cli_account_work_waits_until_queue_identity_checks(self):
        identifier = self.queue(work_mode=None)
        session = self.bridge.live[THREAD]
        session.runtime = 'cli'
        with patch.object(self.bridge, '_target', return_value=session) as target, \
                patch.object(self.bridge, '_verify_cli_submission_account') as verify, \
                patch.object(self.bridge, '_dispatch', return_value={'status': 'accepted'}):
            self.bridge.send_queued_now(THREAD, identifier, self.version(identifier), 'account-a')
        target.assert_called_once_with(THREAD, defer_cli_account=True)
        verify.assert_called_once_with(session)

    def test_lost_receipt_stays_unknown_and_never_returns_to_automatic_queue(self):
        identifier = self.queue()
        version = self.version(identifier)
        original_call = self.bridge._call
        def lose_response(*args, **kwargs):
            result = original_call(*args, **kwargs)
            if args[1] == 'thread-follower-steer-turn':
                raise IPCError('synthetic lost receipt')
            return result
        with patch.object(self.bridge, '_call', side_effect=lose_response):
            with self.assertRaises(IPCError):
                self.bridge.send_queued_now(THREAD, identifier, version, 'account-a')
        self.assertEqual(json.loads(self.bridge.ledger_path.read_text())[THREAD + ':' + identifier]['status'], 'unknown')
        self.assertEqual(self.bridge.send_queued_now(THREAD, identifier, version, 'account-a')['status'], 'unknown')
        self.bridge._send_queued(self.bridge.live[THREAD], THREAD + ':' + identifier, {})
        self.assertEqual(len(self.writes()), 1)


class QueueSendNowHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record = support.password_record('correct password test')
    setUp = support.HttpTests.setUp
    tearDown = support.HttpTests.tearDown
    request = support.HttpTests.request
    login = support.HttpTests.login

    def test_send_now_is_authenticated_host_scoped_and_requires_csrf_and_exact_fields(self):
        self.server.bridge.send_queued_now = Mock(return_value={'status': 'accepted'})
        target = '/api/sessions/' + THREAD + '/queue-send?host=local'
        identifier = str(uuid.uuid4())
        body = {'id': identifier, 'version': 'version', 'expectedAccount': 'account'}
        self.assertEqual(self.request('POST', target, body)[0], 401)
        headers = self.login()
        self.assertEqual(self.request('POST', target, body, {'Cookie': headers['Cookie']})[0], 403)
        self.server.bridge.send_queued_now.assert_not_called()
        self.assertEqual(self.request('POST', target, {**body, 'mode': 'send'}, headers)[0], 400)
        self.assertEqual(self.request('POST', target, body, headers)[0], 200)
        self.server.bridge.send_queued_now.assert_called_once_with(THREAD, identifier, 'version', 'account')
        self.assertEqual(self.request('POST', target.replace('host=local', 'host=missing'), body, headers)[0], 404)
