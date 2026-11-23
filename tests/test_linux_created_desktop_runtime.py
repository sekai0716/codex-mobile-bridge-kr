import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

from bridge.clients.codex.app_server import AppServerError, AppServerUnknownResult, AppServerUnsupported
from bridge.clients.codex.cli_session import CliSessions, _JsonLines
from bridge.features.accounts.draft_identity import draft_identity


@unittest.skipUnless(sys.platform == 'linux', 'Linux desktop connection')
class CreatedDesktopRuntime(unittest.TestCase):
    sid = 'e9358525-4e12-492e-b0eb-564f14cd634a'

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.cwd = str(self.home/'project')
        Path(self.cwd).mkdir()
        (self.home/'auth.json').write_text(json.dumps({'auth_mode': 'chatgpt', 'tokens': {'account_id': 'workspace'}}))
        self.owner = CliSessions(self.home, Mock(), Mock())
        self.runtime = self.owner.created_desktop_runtime()
        self.assertIsNot(self.runtime.client, self.owner.client)
        self.assertIs(self.runtime.client.transport_factory, _JsonLines)
        self.client = Mock(check_socket=False)
        self.runtime.client = self.client
        self.client.connect.return_value = {'codexHome': str(self.home)}
        self.thread = {'id': self.sid, 'cwd': self.cwd, 'source': 'vscode', 'status': {'type': 'notLoaded'},
                       'turns': [], 'modelProvider': 'openai', 'ephemeral': False}
        self.saved = {'id': self.sid, 'cwd': self.cwd, 'origin': 'desktop', 'archived': 0, 'has_user_event': 0,
                      'model_provider': 'openai', 'creator_user_id': 'user', 'creator_account_id': 'workspace'}
        self.auth = {'account': {'type': 'chatgpt'}, 'userId': 'user', 'requiresOpenaiAuth': True,
                     'workspaceRouting': {'backendOrigin': 'https://chatgpt.com', 'chatgptAccountId': 'workspace'}}
        self.runtime.store.get = Mock(return_value=self.saved)
        self.client.is_loaded.side_effect = lambda sid: self.thread['status']['type'] != 'notLoaded'
        self.client.request.side_effect = self.request
        self.resume = {'model': 'fixture-model', 'reasoningEffort': 'medium', 'modelProvider': 'openai', 'cwd': self.cwd}
        self.account = draft_identity('chatgpt', 'workspace')
        self.guard = Mock(return_value=self.account)
        self.log = []

    def request(self, method, params, **kwargs):
        self.log.append((method, params))
        if method == 'account/read':
            return self.auth
        if method == 'thread/read':
            return {'thread': self.thread.copy()}
        if method == 'thread/resume':
            self.assertIs(kwargs['expected_process'], self.client.process)
            self.thread['status'] = {'type': 'idle'}
            return {**self.resume, 'thread': self.thread.copy()}
        if method == 'thread/goal/get':
            return {'goal': None}
        if method == 'thread/unsubscribe':
            return {'status': 'unsubscribed'}
        if method == 'thread/settings/update':
            return {}
        if method == 'turn/start':
            return {'turn': {'id': 'first'}}
        self.fail('Unexpected method '+method)

    def attach(self):
        return self.runtime.attach_created_desktop(self.sid, cwd=self.cwd, provider='openai',
                                                   model='fixture-model', effort='medium', guard=self.guard)

    def test_resume_preserves_id_model_and_effort_and_does_not_start_a_turn(self):
        state = self.attach()
        self.assertEqual((state['id'], state['latestModel'], state['latestReasoningEffort'], state['turns']),
                         (self.sid, 'fixture-model', 'medium', []))
        writes = [(k, v) for k, v in self.log if k in ('thread/start', 'thread/resume', 'turn/start')]
        self.assertEqual(writes, [('thread/resume', {'threadId': self.sid, 'cwd': self.cwd, 'modelProvider': 'openai',
                                                      'model': 'fixture-model', 'config': {'model_reasoning_effort': 'medium'}})])
        with patch.object(self.runtime, '_queue_refresh'):
            self.runtime.call(self.sid, 'thread-follower-update-thread-settings', {'threadSettings': {'model': 'another', 'effort': 'high'}})
            self.runtime.call(self.sid, 'thread-follower-start-turn', {'turnStart': {'request': {'input': [{'type': 'text', 'text': 'Hello'}]}}})
        self.assertEqual(sum(k == 'turn/start' for k, _ in self.log), 1)
        self.assertEqual(self.runtime.states[self.sid]['latestModel'], 'another')
        self.assertFalse(self.owner.joined)

    def test_other_workspace_nonempty_archived_child_or_changed_guard_never_resumes(self):
        for source, key, value in [(self.auth, 'userId', 'different'), (self.auth['workspaceRouting'], 'chatgptAccountId', 'other'),
                                   (self.saved, 'archived', 1), (self.saved, 'has_user_event', 1),
                                   (self.thread, 'turns', [{'id': 'real-turn'}]), (self.thread, 'attachedToThreadId', 'parent'),
                                   (self.thread, 'status', {'type': 'idle'})]:
            with self.subTest(key=key), patch.dict(source, {key: value}), self.assertRaises(AppServerUnsupported):
                self.attach()
        self.guard.side_effect = [self.account, 'changed']
        with self.assertRaises(AppServerUnsupported):
            self.attach()
        self.assertNotIn('thread/resume', [k for k, _ in self.log])

    def test_native_active_writer_is_final_and_lost_response_blocks_another_resume(self):
        for error in [AppServerError('thread already has an active writer'), AppServerUnknownResult('unknown result')]:
            def reject(method, params, **kwargs):
                if method == 'thread/resume':
                    self.log.append((method, params))
                    raise error
                return self.request(method, params, **kwargs)
            self.client.request.side_effect = reject
            with self.assertRaises(type(error)):
                self.attach()
        with self.assertRaises(AppServerUnsupported):
            self.attach()
        self.assertEqual([k for k, _ in self.log].count('thread/resume'), 2)
        self.assertNotIn('turn/start', [k for k, _ in self.log])
        self.assertTrue(self.runtime.metadata[self.sid]['cleanupOnly'])

    def test_mismatched_native_settings_release_just_the_new_subscription(self):
        self.resume['reasoningEffort'] = 'low'
        with self.assertRaises(AppServerUnsupported):
            self.attach()
        self.assertIn(('thread/unsubscribe', {'threadId': self.sid}), self.log)
        self.assertNotIn(self.sid, self.runtime.joined)

    def test_account_change_before_write_and_unverified_cli_are_rejected(self):
        self.attach()
        self.auth['workspaceRouting']['chatgptAccountId'] = 'different'
        with self.assertRaises(AppServerUnsupported):
            self.runtime.call(self.sid, 'thread-follower-start-turn', {})
        self.assertNotIn('turn/start', [k for k, _ in self.log])
        with self.assertRaises(AppServerUnsupported):
            self.owner.attach_created_desktop(self.sid, cwd=self.cwd, provider='openai', model='fixture-model',
                                               effort='medium', guard=self.guard)


class AppServerStdio(unittest.TestCase):
    def test_frames_and_incomplete_input(self):
        data = io.BytesIO()
        _JsonLines(None, data).send({'text': '한글\n메시지'})
        data.seek(0)
        self.assertEqual(_JsonLines(data, None).receive(), {'text': '한글\n메시지'})
        with self.assertRaises(AppServerError):
            _JsonLines(io.BytesIO(b'{}'), None).receive()
