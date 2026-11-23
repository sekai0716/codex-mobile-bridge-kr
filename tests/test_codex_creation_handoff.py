"""Creation intent must reach the native Desktop owner before the first turn."""
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

from bridge.app.service import Bridge, LiveSession, SubmissionRejected
from bridge.clients.codex.ipc import IPCError
from bridge.clients.codex.cli_session import CliSessions

ROOT = Path(__file__).resolve().parents[1]


class CodexCreationHandoff(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(dir=ROOT / '.tmp')
        self.addCleanup(temporary.cleanup)
        self.home = Path(temporary.name)
        self.bridge = Bridge(self.home, self.home / 'bridge')
        self.addCleanup(self.bridge.close)
        self.bridge.hosts.state = lambda: {'local-projects': {
            'project': {'id': 'project', 'name': 'Fixture', 'rootPaths': [str(self.home)]}}}
        self.bridge.ipc.connect = Mock()
        self.thread_id = str(uuid.uuid4())
        self.request_id = str(uuid.uuid4())
        self.selected = {'model': 'gpt-6-astra', 'effort': 'low', 'modelCatalogIdentity': 'fixture-account'}
        self.catalog = {'models': [{'id': 'gpt-6-astra', 'efforts': ['low', 'high']}],
                        'cache': {'identity': 'fixture-account'}, 'modelSource': 'codex'}
        self.bridge.creation_models = Mock(return_value=self.catalog)
        self.bridge.catalog = Mock(return_value=self.catalog)
        self.session = LiveSession(self.thread_id)
        self.session.connected = True
        self.session.owner = 'native-owner'
        self.session.saved_cwd = str(self.home)
        self.session.saved_provider = 'original-provider'
        self.session.state = {'id': self.thread_id, 'cwd': str(self.home), 'modelProvider': 'original-provider',
                              'latestModel': 'gpt-6-sol', 'latestReasoningEffort': 'medium',
                              'threadRuntimeStatus': {'type': 'idle'}, 'turns': [], 'requests': []}
        self.bridge.live[self.thread_id] = self.session
        self.bridge._target = Mock(return_value=self.session)
        self.turns = []
        self.bridge.ipc.request = Mock(side_effect=self.native_owner)
        for name, options in (('create_empty', {'return_value': self.thread_id}), ('open_in_desktop', {})):
            mocking = patch('bridge.app.service.' + name, **options)
            setattr(self, name, mocking.start())
            self.addCleanup(mocking.stop)

    def native_owner(self, method, params, **options):
        self.assertEqual(options['target'], 'native-owner')
        self.assertEqual(params['conversationId'], self.thread_id)
        if method == 'thread-follower-update-thread-settings':
            settings = params['threadSettings']
            with self.session.condition:
                self.session.state['latestModel'] = settings['model']
                if 'effort' in settings:
                    self.session.state['latestReasoningEffort'] = settings['effort']
                self.session.changed()
            return {'result': {'applied': True}}
        if method == 'thread-follower-start-turn':
            self.assertTrue(params['turnStart']['context']['inheritThreadSettings'])
            self.turns.append((self.session.state['latestModel'], self.session.state['latestReasoningEffort']))
            return {'result': {}}
        self.fail('Unexpected native operation: ' + method)

    def create(self):
        return self.bridge.create_chat('local|project', 'Fixture', self.request_id, model_options=self.selected)

    def test_desktop_reopened_empty_thread_keeps_creation_choice_for_first_send(self):
        result = self.create()
        self.assertEqual(result['id'], self.thread_id)
        self.assertEqual(self.session.view()['model'], 'gpt-6-astra')
        self.assertEqual(self.session.view()['effort'], 'low')
        self.bridge.send(self.thread_id, 'Fixture input', str(uuid.uuid4()))
        self.assertEqual(self.turns, [('gpt-6-astra', 'low')])
        self.assertEqual(self.session.state['modelProvider'], 'original-provider')
        self.assertEqual(self.session.state['cwd'], str(self.home))

    def test_repeating_completed_creation_never_overwrites_a_later_choice(self):
        self.create()
        self.session.state['latestModel'] = 'gpt-6-sol'
        self.session.state['latestReasoningEffort'] = 'high'
        self.bridge.ipc.request.reset_mock()
        self.create()
        self.assertEqual(self.session.view()['model'], 'gpt-6-sol')
        self.assertEqual(self.session.view()['effort'], 'high')
        self.bridge.ipc.request.assert_not_called()
        self.create_empty.assert_called_once()
        self.assertEqual(self.bridge.creations[self.request_id]['modelSettingsPhase'], 'applied')

    def test_selection_is_not_tied_to_the_native_default_model_family(self):
        self.selected['model'] = 'gpt-6-sol'
        self.catalog['models'] = [{'id': 'gpt-6-sol', 'efforts': ['low']}]
        self.session.state['latestModel'] = 'gpt-6-astra'
        self.create()
        self.bridge.send(self.thread_id, 'Fixture input', str(uuid.uuid4()))
        self.assertEqual(self.turns, [('gpt-6-sol', 'low')])

    def test_model_without_effort_controls_never_invents_a_reasoning_choice(self):
        self.selected.pop('effort')
        self.catalog['models'][0].update(efforts=[], supportsEffort=False)
        self.catalog['modelSource'] = 'api'
        self.create()
        self.assertEqual(self.session.view()['model'], self.selected['model'])
        self.assertEqual(self.session.view()['effort'], 'medium')
        settings = self.bridge.ipc.request.call_args.args[1]['threadSettings']
        self.assertEqual(settings, {'model': self.selected['model']})

    def test_creation_does_not_reenter_activation_or_wait_for_a_cold_owner(self):
        del self.bridge.live[self.thread_id]
        result = self.create()
        self.assertEqual(result['id'], self.thread_id)
        self.assertEqual(result['creationSettings'], {'model': self.selected['model'], 'effort': 'low', 'status': 'pending'})
        self.bridge._target.assert_not_called()
        self.bridge.ipc.request.assert_not_called()

    def test_owner_not_ready_retains_created_id_and_retries_only_handoff(self):
        self.session.connected = False
        result = self.create()
        self.assertEqual(result['id'], self.thread_id)
        self.assertEqual(result['creationSettings']['status'], 'pending')
        self.assertEqual(self.bridge.creations[self.request_id]['id'], self.thread_id)
        self.bridge.ipc.request.assert_not_called()
        self.session.connected = True
        with patch.object(self.bridge, 'activate', return_value=self.session):
            self.bridge.reconnect_session(self.thread_id)
        self.assertEqual(self.bridge.creations[self.request_id]['modelSettingsPhase'], 'applied')
        self.create_empty.assert_called_once()
        self.assertEqual(self.session.view()['model'], 'gpt-6-astra')

    def test_unknown_settings_are_reconciled_without_replaying_a_write(self):
        self.bridge.ipc.request.side_effect = IPCError('lost response')
        self.assertEqual(self.create()['creationSettings']['status'], 'unknown')
        self.assertEqual(self.create()['creationSettings']['status'], 'unknown')
        with self.assertRaises(SubmissionRejected):
            self.bridge.send(self.thread_id, 'preserve this draft', str(uuid.uuid4()))
        with self.assertRaises(SubmissionRejected):
            self.bridge.settings(self.thread_id, self.selected['model'], self.selected['effort'])
        self.bridge.ipc.request.assert_called_once()
        self.session.state['latestModel'] = self.selected['model']
        self.session.state['latestReasoningEffort'] = self.selected['effort']
        self.assertEqual(self.create()['creationSettings']['status'], 'applied')
        self.bridge.ipc.request.assert_called_once()
        self.create_empty.assert_called_once()

    def test_pending_choice_survives_restart_and_passive_reads_never_apply_it(self):
        self.session.connected = False
        self.create()
        self.bridge.close()
        self.bridge = Bridge(self.home, self.home/'bridge')
        self.addCleanup(self.bridge.close)
        self.bridge.session = Mock(return_value=self.session)
        self.bridge._refresh_session_goal = Mock(return_value=False)
        self.bridge.ipc.request = Mock(side_effect=AssertionError('Passive metadata must not change the owner'))
        with patch.object(self.bridge, '_save_creations', side_effect=AssertionError('No receipt writes on reads')):
            choice = self.bridge.view(self.thread_id)['creationSettings']
            self.assertEqual(choice, {'status': 'pending', 'model': self.selected['model'], 'effort': 'low'})
            self.assertEqual(self.bridge.timeline_read(self.thread_id)['meta']['creationSettings'], choice)
        self.bridge.ipc.request.assert_not_called()

    def test_two_concurrent_explicit_reconnects_apply_once_without_creating_another_thread(self):
        self.session.connected = False
        self.create()
        self.session.connected = True
        with patch.object(self.bridge, 'activate', return_value=self.session), ThreadPoolExecutor(2) as executor:
            self.assertEqual(list(executor.map(self.bridge.reconnect_session, [self.thread_id]*2)), [self.session]*2)
        self.assertIsNone(self.bridge._creation_entry(self.thread_id))
        self.bridge.ipc.request.assert_called_once()
        self.create_empty.assert_called_once()

    def test_catalog_read_cannot_transfer_settings_to_a_new_native_owner(self):
        def changed(*args, **kwargs):
            self.session.owner = 'different-owner'
            return self.catalog
        self.bridge.catalog.side_effect = changed
        self.assertEqual(self.create()['creationSettings']['status'], 'pending')
        self.bridge.ipc.request.assert_not_called()

    def test_manual_confirmation_cannot_write_to_another_working_directory(self):
        self.session.connected = False
        self.create()
        self.session.connected = True
        self.session.state['cwd'] = '/different-project'
        with self.assertRaises(ValueError):
            self.bridge.settings(self.thread_id, 'gpt-6-sol', 'high')
        self.assertEqual(self.bridge.creations[self.request_id]['modelSettingsPhase'], 'pending')
        self.bridge.ipc.request.assert_not_called()

    def test_losing_the_owner_before_dispatch_keeps_the_receipt_retryable(self):
        apply = self.bridge._apply_settings
        def changed(*args, **options):
            self.session.owner = 'replacement'
            return apply(*args, **options)
        with patch.object(self.bridge, '_apply_settings', side_effect=changed):
            self.assertEqual(self.create()['creationSettings']['status'], 'pending')
        self.bridge.ipc.request.assert_not_called()
        self.session.owner = 'native-owner'
        self.assertEqual(self.create()['creationSettings']['status'], 'applied')
        self.bridge.ipc.request.assert_called_once()

    def test_old_queued_first_message_waits_without_changing_its_receipt(self):
        self.session.connected = False
        self.create()
        self.session.connected = True
        submission = str(uuid.uuid4())
        key = self.thread_id+':'+submission
        queued = {'status': 'queued', 'text': 'queued first', 'mode': 'queue', 'skills': []}
        self.bridge.submissions[key] = dict(queued)
        self.bridge._send_queued(self.session, key, queued)
        with patch.object(self.bridge, '_management_identity', return_value='fixture-account'), \
             patch('bridge.app.service.queue_version', return_value='version'), self.assertRaises(SubmissionRejected):
            self.bridge.send_queued_now(self.thread_id, submission, 'version', 'fixture-account')
        self.assertEqual(self.bridge.submissions[key], queued)
        self.bridge.ipc.request.assert_not_called()

    def test_legacy_independent_chat_recovers_the_verified_picker_directory(self):
        self.session.connected = False
        self.create()
        entry = self.bridge.creations[self.request_id]
        entry.pop('catalogCwd')
        entry.update(project='local|independent', cwd=None, runtimeCwd=str(self.home))
        self.session.connected = True
        previous = str(self.bridge.data_dir/'independent-chats')
        with patch.object(self.bridge.catalog_reader, 'model_identity',
                          side_effect=lambda cwd, provider: 'fixture-account' if cwd == previous else 'other'), \
             patch.object(self.bridge.catalog_reader, 'get_kind', return_value=self.catalog) as read:
            self.bridge._recover_creation_settings(self.session)
        read.assert_called_once_with('models', previous, provider='original-provider')
        self.assertEqual(entry['modelSettingsPhase'], 'applied')

    def test_account_change_blocks_first_send_and_explicit_model_confirmation_unblocks(self):
        self.session.connected = False
        self.create()
        self.session.connected = True
        self.bridge.catalog.return_value = {**self.catalog, 'cache': {'identity': 'other-account'}}
        self.assertEqual(self.create()['creationSettings']['status'], 'pending')
        with self.assertRaises(SubmissionRejected):
            self.bridge.send(self.thread_id, 'first', str(uuid.uuid4()))
        self.bridge.ipc.request.assert_not_called()
        self.bridge.settings(self.thread_id, 'gpt-6-sol', 'high')
        self.bridge.send(self.thread_id, 'first', str(uuid.uuid4()))
        self.assertEqual(self.turns, [('gpt-6-sol', 'high')])
        self.assertEqual(self.bridge.creations[self.request_id]['modelSettingsPhase'], 'superseded')

    def test_original_user_message_retires_an_earlier_receipt_without_setting_write(self):
        self.session.connected = False
        self.create()
        self.session.connected = True
        self.session.state['turns'] = [{'turnId': 'previous', 'items': [
            {'type': 'userMessage', 'id': 'local', 'content': [{'type': 'text', 'text': 'original conversation'}]}]}]
        meta = {}
        with patch.object(self.bridge, '_save_creations', side_effect=AssertionError('No writes while reading')):
            self.bridge._creation_meta(self.session, meta)
        self.assertNotIn('creationSettings', meta)
        self.bridge.send(self.thread_id, 'next', str(uuid.uuid4()))
        self.assertEqual(self.turns, [('gpt-6-sol', 'medium')])
        self.assertEqual([call.args[0] for call in self.bridge.ipc.request.call_args_list], ['thread-follower-start-turn'])
        self.assertIsNone(self.bridge._creation_entry(self.thread_id))

    def test_existing_turn_or_changed_native_identity_never_receives_settings(self):
        for state in (
                {'turns': [{'turnId': 'already-used', 'items': []}]},
                {'threadRuntimeStatus': {'type': 'active'}},
                {'cwd': '/another-project'},
                {'modelProvider': 'another-provider'}):
            with self.subTest(state=state):
                self.request_id = str(uuid.uuid4())
                saved = dict(self.session.state)
                self.session.state.update(state)
                self.assertEqual(self.create()['creationSettings']['status'], 'pending')
                self.session.state = saved
                self.bridge.ipc.request.assert_not_called()

    def test_catalog_rejection_before_settings_write_can_be_explicitly_retried(self):
        self.bridge.catalog.return_value = {**self.catalog, 'models': [{'id': self.selected['model'], 'efforts': ['high']}]}
        self.assertEqual(self.create()['creationSettings']['status'], 'pending')
        self.assertEqual(self.bridge.creations[self.request_id]['modelSettingsPhase'], 'pending')
        self.bridge.ipc.request.assert_not_called()
        self.bridge.catalog.return_value = self.catalog
        self.create()
        self.create_empty.assert_called_once()

    def test_legacy_create_without_model_options_keeps_existing_behavior(self):
        self.bridge.create_chat('local|project', 'Fixture', self.request_id)
        self.bridge._target.assert_not_called()
        self.bridge.ipc.request.assert_not_called()


class CodexCliCreationChoice(unittest.TestCase):
    def test_cli_retains_its_original_runtime_and_choice_for_first_send(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.tmp') as directory:
            home = Path(directory)
            thread_id = str(uuid.uuid4())
            cli = CliSessions(home, lambda *_: None, lambda: None)
            cli.client.process = object()
            cli.client.is_loaded = Mock(return_value=True)
            cli._connect_explicit = Mock(return_value={'codexHome': str(home)})
            cli._queue_refresh = Mock()
            thread = {'id': thread_id, 'cwd': directory, 'modelProvider': 'fixture-provider',
                      'status': {'type': 'idle'}, 'turns': []}
            runtime_choice, sends = {}, []

            def request(method, params, **options):
                if method == 'thread/start':
                    runtime_choice.update(model=params['model'], effort=params['config']['model_reasoning_effort'])
                    return {'thread': thread, 'model': runtime_choice['model'], 'reasoningEffort': runtime_choice['effort']}
                if method == 'thread/read':
                    return {'thread': thread}
                if method == 'turn/start':
                    sends.append(dict(runtime_choice))
                return {}

            cli.client.request = Mock(side_effect=request)
            state = cli.create(directory, 'Fixture', model='gpt-6-sol', effort='low')
            self.assertEqual((state['latestModel'], state['latestReasoningEffort']), ('gpt-6-sol', 'low'))
            cli.call(thread_id, 'thread-follower-start-turn', {'turnStart': {
                'request': {'input': [{'type': 'text', 'text': 'Fixture'}]}, 'context': {'inheritThreadSettings': True}}})
            self.assertEqual(sends, [{'model': 'gpt-6-sol', 'effort': 'low'}])
            self.assertEqual(cli.metadata[thread_id]['modelProvider'], 'fixture-provider')
            self.assertEqual(cli.metadata[thread_id]['cwd'], directory)
            self.assertNotIn('thread/resume', [call.args[0] for call in cli.client.request.call_args_list])


if __name__ == '__main__':
    unittest.main()
