import json
import sqlite3
from contextlib import closing
from pathlib import Path
import tempfile
import unittest

from bridge.features.sessions.activity import function_message, preserve_turn_plan, update_turn_plan
from bridge.features.sessions.model import normalize_item, normalize_state
from bridge.features.sessions.store import SessionStore
from bridge.features.sessions.timeline import Timeline
from bridge.features.workspace.files import referenced_model_images


def timeline(items, **turn):
    native = {'id': 'parent', 'turns': [{'turnId': 'turn', 'status': 'inProgress', 'items': items, **turn}]}
    value = Timeline()
    value.update({**normalize_state(native), 'sequence': 1})
    return value


class NativeActivityProjection(unittest.TestCase):
    def test_search_commands_and_metadata_keep_user_strings_intact(self):
        items = [{'type': 'webSearch', 'id': 'web', 'query': 'topic', 'action': {'type': 'findInPage', 'pattern': 'phrase'},
                  'results': [{'title': 'source', 'url': 'https://example.test/result'}, {'url': 'https://example.test/result'},
                              {'url': 'javascript:alert(1)'}, {'url': 'https://bad:secret@example.test/'}]},
                 {'type': 'commandExecution', 'id': 'cmd', 'command': 'one\ntwo', 'cwd': '/repo', 'durationMs': 0,
                  'exitCode': 0, 'commandActions': [{'type': 'read', 'name': 'Exit code'}, {'type': 'search', 'query': 'one', 'path': '/two'}],
                  'aggregatedOutput': 'Exit code\nraw'}]
        t = timeline(items)
        search, cmd = t.rows
        self.assertEqual(search['title'], 'Searched within page')
        self.assertEqual(t.details[search['key']], 'topic\n\nphrase\n\nsource\nhttps://example.test/result')
        text = t.details[cmd['key']]
        self.assertTrue(text.startswith('one\ntwo\n\nRead file\nExit code'))
        self.assertTrue(text.endswith('Exit code\nraw'))
        self.assertEqual([text.split('\n')[i] for i in cmd['commandLabelLines']],
                         ['Read file', 'Searched files', 'Working directory', 'Duration', 'Exit code'])
        self.assertEqual(cmd['commandActions'], ['read', 'search'])

    def test_command_categories_use_only_the_native_actions(self):
        source = {'type': 'commandExecution', 'id': 'cmd', 'command': 'cat unverified.txt',
                  'commandActions': [{'type': 'read', 'path': 'C:/skills/demo/SKILL.md'},
                                     {'type': 'listFiles'}, {'type': 'search', 'path': '/repo'},
                                     {'type': 'read', 'path': '/repo/README.md'}, {'type': 'read', 'name': 'b.txt'},
                                     {'type': 'unknown'}]}
        row = timeline([source]).rows[0]
        self.assertEqual(row['commandActions'], ['readSkill', 'listFiles', 'search', 'read', 'command'])
        self.assertNotIn('commandActions', timeline([{**source, 'commandActions': []}]).rows[0])

    def test_review_internal_records_retry_progress_and_unknown_fallback(self):
        rows = [{'id': 'try1', 'type': 'error', 'willRetry': True, 'message': 'Reconnecting... 1/5'},
                {'id': 'try2', 'type': 'error', 'willRetry': True, 'message': 'Reconnecting 2/5', 'additionalDetails': 'offline'}]
        t = timeline([{'type': k} for k in ('enteredReviewMode', 'sleep', 'exitedReviewMode')] +
                     [{'type': 'hookPrompt', 'fragments': [{'text': ' '}]}, *rows, {'type': 'futureItem', 'note': 'keep'}],
                     error={'message': 'Stopped', 'additionalDetails': 'reason'})
        self.assertEqual(len(t.rows), 3)
        self.assertEqual(t.rows[0]['key'], timeline(rows[:1]).rows[0]['key'])
        self.assertEqual(t.rows[0]['text'], 'Reconnecting 2/5\noffline')
        self.assertIn('"note": "keep"', t.rows[1]['text'])
        self.assertEqual(t.rows[2]['text'], 'Stopped\nreason')
        ongoing = timeline([], error={'message': 'temporary'}, willRetry=True)
        self.assertEqual([r['role'] for r in ongoing.rows], ['activity'])
        self.assertFalse(ongoing.meta.get('strictReviewActive'))

    def test_citations_plans_review_history_child_links_and_images(self):
        child = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        items = [
            {'type': 'agentMessage', 'id': 'm', 'text': 'reply', 'memoryCitation': {'entries': [{'path': 'memory.md', 'lineStart': 1, 'lineEnd': 2, 'note': 'note'}]}},
            {'type': 'plan', 'id': 'p', 'text': 'first'},
            {'type': 'todo-list', 'id': 'todo', 'plan': [{'step': 'one', 'status': 'completed'}, {'step': 'two', 'status': 'inProgress'}]},
            {'type': 'userInputResponse', 'id': 'q', 'questions': [{'question': 'choose', 'id': 'a'}], 'answers': {'a': ['yes']}, 'completed': True},
            {'type': 'subAgentActivity', 'id': 'a', 'agentThreadId': child, 'agentPath': '/root/test', 'kind': 'interrupted'},
            {'type': 'imageGeneration', 'id': 'i', 'status': 'completed', 'savedPath': '/generated/sample.png'},
            {'type': 'imageGeneration', 'id': 'u', 'src': 'https://other.test/private'},
            {'type': 'mcpToolCall', 'id': 'tool', 'mcpAppUi': {'resourceUri': 'ui://app/view'}, 'status': 'completed', 'result': {'content': [{'type': 'text', 'text': 'answer'}]}},
            {'type': 'dynamicToolCall', 'id': 'auto', 'tool': 'automation_update', 'arguments': {'mode': 'delete', 'id': 'known'}, 'status': 'completed', 'success': True,
             'contentItems': [{'type': 'inputText', 'text': json.dumps({'mode': 'delete', 'snapshot': {'name': 'example'}})}]},
        ]
        t = timeline(items)
        self.assertEqual(t.rows[0]['text'], 'reply')
        self.assertEqual(t.rows[1]['text'], 'memory.md:1–2\nnote')
        self.assertEqual(t.rows[3]['text'], '☑ one\n◐ two')
        self.assertEqual((t.rows[4]['text'], t.rows[4]['completed']), ('choose\nyes', True))
        self.assertEqual(t.rows[5]['agent'], {'id': child, 'taskName': 'test', 'activity': 'Agent task interrupted'})
        self.assertEqual(t.rows[6]['attachments'][0]['name'], 'sample.png')
        self.assertNotIn('attachments', t.rows[7])
        self.assertNotIn('other.test', t.rows[7]['text'])
        self.assertTrue(t.rows[8]['appView'])
        self.assertNotIn('ui://', t.details[t.rows[8]['key']])
        self.assertTrue(t.rows[9]['activityCard'])
        self.assertIn('example', t.rows[9]['text'])
        state = {'turns': [{'items': items}]}
        self.assertEqual(referenced_model_images(state, image_views_only=True), {Path('/generated/sample.png').resolve()})

    def test_native_hook_function_output_and_model_notice(self):
        note = {'type': 'functionCallOutput', 'namespace': 'codex_app', 'name': 'create_thread', 'output':
                '<codex_delegation><source_thread_id>source</source_thread_id><input>&lt;task&gt;</input></codex_delegation>'}
        self.assertEqual(function_message(note), '<task>')
        t = timeline([{**note, 'id': 'delegation'}, {**note, 'name': 'other', 'id': 'private'}, {'type': 'hookPrompt', 'fragments': [{'text': 'hello'}]},
                      {'type': 'modelRerouted', 'fromModel': 'a', 'toModel': 'b', 'reason': 'busy'}])
        self.assertEqual([row['text'] for row in t.rows], ['<task>', 'hello', 'a → b\nbusy'])
        self.assertEqual(normalize_item({'type': 'planImplementation', 'isCompleted': True, 'planContent': 'body'})['title'], 'Plan implemented')

    def test_plan_projection_survives_snapshot_updates_only_in_own_turn(self):
        state = {'turns': [{'turnId': 'a', 'status': 'inProgress', 'items': [{'id': 'before'}]}, {'turnId': 'b', 'status': 'inProgress', 'items': []}]}
        for status in ('inProgress', 'completed'):
            update_turn_plan(state, {'turnId': 'a', 'plan': [{'step': 'one', 'status': status}]})
        old = state['turns'][0]['items']
        self.assertEqual(len(old), 2)
        self.assertEqual(old[-1]['plan'][0]['status'], 'completed')
        self.assertEqual(state['turns'][1]['items'], [])
        incoming = [{'id': 'before'}, {'id': 'after'}]
        self.assertEqual([item['id'] for item in preserve_turn_plan('a', old, incoming)], ['before', 'turn-plan-a', 'after'])
        self.assertIs(preserve_turn_plan('b', old, incoming), incoming)

    def test_rollout_completed_started_duplicates_match_live_web_and_command_projection(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            (home / 'sessions').mkdir()
            path = home / 'sessions' / 'sample.jsonl'
            cmd = {'id': 'cmd', 'type': 'CommandExecution', 'command': ['sh', '-c', 'echo ok'], 'parsed_cmd': [{'type': 'list_files', 'path': '/tmp'}],
                   'duration': {'secs': 1, 'nanos': 0}, 'exit_code': 0, 'status': 'completed', 'aggregated_output': 'ok'}
            search = {'id': 'web', 'type': 'Extension', 'kind': 'web.search', 'query': 'abc', 'action': {'type': 'search', 'query': 'abc'},
                      'results': [{'url': 'https://example.test', 'title': 'example'}]}
            def envelope(e, item, turn='t'):
                return {'type': 'event_msg', 'payload': {'type': e, 'thread_id': 'thread', 'turn_id': turn, 'item': item}}
            logs = [{'type': 'event_msg', 'payload': {'type': 'task_started', 'turn_id': 't'}}, envelope('item_started', cmd),
                    envelope('item_completed', cmd), envelope('item_started', {**cmd, 'status': 'inProgress'}),
                    envelope('item_completed', search), envelope('item_completed', search), envelope('item_completed', {**cmd, 'id': 'other'}, 'wrong')]
            path.write_text('\n'.join(json.dumps(record) for record in logs) + '\n')
            native = SessionStore(home)._history('thread', {'rollout_path': str(path), 'cwd': folder})
            rows = normalize_state(native)['turns'][0]['messages']
            self.assertEqual([r['kind'] for r in rows], ['commandExecution', 'webSearch'])
            self.assertEqual(rows[0]['commandInfo'], [('Listed files', '/tmp'), ('Duration', '1000 ms'), ('Exit code', '0')])
            self.assertEqual(rows[0]['commandActions'], ['listFiles'])
            self.assertEqual(rows[0]['status'], 'completed')
            self.assertEqual(rows[1]['text'], 'abc\n\nexample\nhttps://example.test')
            index = home / 'thread_history_1.sqlite'
            native_items = [{'type': 'commandExecution', 'id': 'cmd', 'command': 'echo ok', 'exitCode': 0,
                             'durationMs': 1000, 'status': 'completed', 'aggregatedOutput': 'ok',
                             'commandActions': [{'type': 'listFiles', 'path': '/tmp'}]}, {**search, 'type': 'webSearch'}]
            with closing(sqlite3.connect(index)) as conn, conn:
                conn.execute('CREATE TABLE thread_history_projection_state(thread_id,next_rollout_byte_offset)')
                conn.execute('CREATE TABLE thread_items(thread_id,turn_id,rollout_ordinal,item_json)')
                conn.execute('CREATE TABLE thread_turns(thread_id,turn_id,status,error_json,started_at,first_user_item_id)')
                conn.execute('INSERT INTO thread_history_projection_state VALUES (?,?)', ('thread', path.stat().st_size))
                conn.execute('INSERT INTO thread_turns VALUES (?,?,?,?,?,?)', ('thread', 't', 'inProgress', None, None, None))
                conn.executemany('INSERT INTO thread_items VALUES (?,?,?,?)',
                                 [('thread', 't', n, json.dumps(item)) for n, item in enumerate(native_items)])
            indexed = SessionStore(home)._indexed_history('thread', {'rollout_path': str(path), 'cwd': folder}, 5)
            self.assertEqual(normalize_state(indexed)['turns'][0]['messages'], rows)
            self.assertEqual(normalize_state({'turns': [{'turnId': 't', 'items': native_items}]})['turns'][0]['messages'], rows)
