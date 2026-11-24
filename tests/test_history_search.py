import contextlib
import json
import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from bridge.clients.codex.app_server import AppServerUnavailable
from bridge.features.sessions import history_search
import test_bridge as support


class HistoryLookupTests(unittest.TestCase):
    def setUp(self):
        support.IntegrationTests.setUp(self)
        self.addCleanup(support.IntegrationTests.tearDown, self)
        self.enterContext(patch.object(self.bridge, '_management_identity', return_value='fixture-account'))
        self.fixture.state['threadRuntimeStatus'] = {'type':'active'}
        self.assertTrue(self.bridge.view(support.THREAD)['connected'])

    def source(self, handler):
        @contextlib.contextmanager
        def connection(session, *, write=False):
            self.assertEqual(session.id, support.THREAD)
            yield handler, 'fixture-generation'
        self.enterContext(patch.object(self.bridge, '_thread_source', connection))

    def test_native_search_cursor_and_one_target_turn(self):
        calls = []
        def request(method, params):
            calls.append((method, params))
            if method == 'thread/turns/list':
                return {'data':[{'id':'turn1','items':[{'type':'agentMessage','id':'item2','text':'한글 메시지'}]}]}
            return {'data':[{'turnId':'turn1','itemId':'item2','turnCursor':'turn-anchor','snippet':'한글'}],
                    'nextCursor':None if params.get('cursor') else 'native-next'}
        self.source(request)
        def query(**extra):
            return self.bridge.thread_history_search(support.THREAD, {'account':'fixture-account','term':'한글',**extra})
        first = query()
        self.assertEqual(query(cursor=first['cursor'])['cursor'], None)
        self.assertEqual(calls[-1][1]['cursor'], 'native-next')
        hit = first['data'][0]
        result = query(target=[hit['turnId'],hit['itemId']], cursor=hit['cursor'])
        self.assertEqual(result['data']['text'], '한글 메시지')
        self.assertEqual(calls[-1][1]['limit'], 1)
        self.assertEqual(calls[-1][1]['cursor'], 'turn-anchor')
        with self.assertRaises(ValueError): query(term='changed',cursor=first['cursor'])
        with self.assertRaises(ValueError): query(account='other')

    def test_loaded_fallback_pages_stay_anchored_when_history_is_prepended(self):
        def unavailable(*args):
            raise AppServerUnavailable('not connected')
        self.source(unavailable)
        messages = [{'id':str(i),'role':'user','text':'한글 검색'} for i in range(22)]
        session = self.bridge.live[support.THREAD]
        self.enterContext(patch.object(session,'timeline_view',return_value={'turns':[{'id':'turn','messages':messages}]}))
        self.enterContext(patch.object(self.bridge,'store',SimpleNamespace()))
        params = {'account':'fixture-account','term':'한글'}
        first = self.bridge.thread_history_search(support.THREAD,params)
        self.assertEqual(first['source'],'loaded')
        messages.insert(0,{'id':'earlier','role':'assistant','text':'한글'})
        second = self.bridge.thread_history_search(support.THREAD,{**params,'cursor':first['cursor']})
        self.assertEqual([row['itemId'] for row in second['data']],['20','21'])

    def test_bridge_queue_stays_local_and_existing_native_receipt_stays_native(self):
        previous, queued = str(uuid.uuid4()), str(uuid.uuid4())
        native_row = {'id': 'native-1', 'clientUserMessageId': previous,
                      'input': [{'type': 'text', 'text': '이미 Codex에서 대기 중'}]}
        prior = {'text': '이미 Codex에서 대기 중', 'mode': 'queue', 'status': 'unknown',
                 'at': 1, 'queueOwner': 'native', 'nativeGeneration': 'fixture-generation',
                 'nativeAccount': 'fixture-account'}
        self.bridge.submissions[support.THREAD + ':' + previous] = prior
        reads = []
        def request(method, params):
            self.assertEqual(method, 'thread/queue/list')
            reads.append(params)
            if params.get('cursor'):
                return {'data': [native_row]}
            return {'data': [{'id': 'native-direct', 'input': [{'type': 'text', 'text': '앱 입력'}]}],
                    'nextCursor': 'next'}
        self.source(request)
        self.assertEqual(self.bridge.send(support.THREAD, 'Bridge 입력', queued, 'queue')['status'], 'queued')
        self.assertTrue(self.bridge.send(support.THREAD, 'Bridge 입력', queued, 'queue')['duplicate'])
        self.assertEqual(reads, [])
        key = support.THREAD + ':' + queued
        with open(self.bridge.ledger_path, encoding='utf-8') as ledger:
            self.assertEqual(json.load(ledger)[key]['queueAccount'], 'fixture-account')
        before = self.bridge.message_management(support.THREAD)
        self.assertEqual([row['id'] for row in before['queue']], [queued])
        updated = self.bridge.manage_messages(support.THREAD, {
            'action': 'edit', 'version': before['version'], 'id': queued, 'editId': str(uuid.uuid4()),
            'text': 'Bridge에서 다시 편집한 입력', 'expectedAccount': 'fixture-account'})
        self.assertEqual(updated['queue'][0]['text'], 'Bridge에서 다시 편집한 입력')
        result = self.bridge.original_queue(support.THREAD,'fixture-account')
        self.assertEqual([row['id'] for row in result['rows']], ['native-direct', 'native-1'])
        self.assertEqual(len(reads), 2)
        self.assertEqual(self.bridge.submissions[support.THREAD + ':' + previous]['status'], 'accepted')
        self.assertEqual(self.bridge.submissions[key]['status'], 'queued')

    def test_queued_message_waits_for_the_original_account_and_dispatches_once(self):
        identifier = str(uuid.uuid4())
        key = support.THREAD + ':' + identifier
        self.bridge.send(support.THREAD, '원래 계정에 보낼 메시지', identifier, 'queue')
        session = self.bridge.live[support.THREAD]
        with session.condition:
            session.state['threadRuntimeStatus'] = {'type': 'idle'}
        self.bridge._management_identity.return_value = 'different-account'
        foreign = self.bridge.message_management(support.THREAD, [identifier])
        self.assertEqual(foreign['queue'], [])
        self.assertEqual(foreign['receipts'][0]['status'], 'notFound')
        self.bridge._send_queued(session, key, self.bridge.submissions[key])
        self.assertEqual(self.bridge.submissions[key]['status'], 'queued')
        self.assertFalse(any(row['method'] == 'thread-follower-start-turn' for row in self.fixture.requests))
        self.bridge._management_identity.return_value = 'fixture-account'
        original = self.bridge._call
        def app_starts_first(selected, method, params, **options):
            with selected.condition:
                selected.state['threadRuntimeStatus'] = {'type': 'active'}
            return original(selected, method, params, **options)
        with patch.object(self.bridge, '_call', side_effect=app_starts_first):
            self.bridge._send_queued(session, key, self.bridge.submissions[key])
        self.assertEqual(self.bridge.submissions[key]['status'], 'queued')
        self.assertFalse(any(row['method'] == 'thread-follower-start-turn' for row in self.fixture.requests))
        with session.condition:
            session.state['threadRuntimeStatus'] = {'type': 'idle'}
        for _ in range(2):
            self.bridge._send_queued(session, key, self.bridge.submissions[key])
        calls = [row for row in self.fixture.requests if row['method'] == 'thread-follower-start-turn']
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['params']['turnStart']['request']['clientUserMessageId'], identifier)


class IndexLookupTests(unittest.TestCase):
    def test_saved_index_finds_older_message_and_reads_only_selected_item(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); rollout = home / 'rollout'; rollout.write_text('x')
            store = SimpleNamespace(home=home, _rollout_in_home=lambda path: path==rollout,
                                    get=lambda thread:{'rollout_path':str(rollout)})
            with contextlib.closing(sqlite3.connect(home / 'thread_history_1.sqlite')) as db:
                db.executescript('CREATE TABLE thread_history_projection_state(thread_id,next_rollout_byte_offset);'
                                 'INSERT INTO thread_history_projection_state VALUES ("thread",1);'
                                 'CREATE TABLE thread_items(thread_id,rollout_ordinal,turn_id,item_json);')
                db.executemany('INSERT INTO thread_items VALUES (?,?,?,?)', [('thread',i,'turn'+str(i),
                               json.dumps({'id':'msg','type':'agentMessage','text':'내용 한글'})) for i in range(32)])
                db.commit()
            hits, cursor = history_search.saved_index_search(store,'thread','한글',-1,20)
            self.assertEqual(len(hits),20)
            next_hits, end = history_search.saved_index_search(store,'thread','한글',int(cursor),20)
            self.assertEqual((next_hits[0]['turnId'],end), ('turn20',None))
            self.assertEqual(history_search.saved_index_search(store,'thread','한글',0,20,['turn0','msg'])['text'],'내용 한글')
            rollout.write_text('changed')
            self.assertIsNone(history_search.saved_index_search(store,'thread','한글',-1,20))
