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

    def test_native_queue_ids_and_ambiguous_ack_do_not_duplicate(self):
        rows, writes = [], []
        def request(method, params):
            if method == 'thread/queue/list':
                if params.get('limit') == 1: return {'data':rows[:1]}
                if len(rows)>1 and not params.get('cursor'): return {'data':rows[:1], 'nextCursor':'second'}
                return {'data':rows[1:] if params.get('cursor') else rows}
            self.assertEqual(method, 'thread/queue/add')
            writes.append(params)
            rows.append({'id':'native-'+str(len(rows)), 'clientUserMessageId':params['clientUserMessageId'], 'input':params['input']})
            if len(writes)==2: raise AppServerUnavailable('lost response')
            return {'queuedSubmission':rows[-1]}
        self.source(request)
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        for id_, expected in ((first,'queued'),(second,'unknown')):
            self.assertEqual(self.bridge.send(support.THREAD,'같은 본문',id_,'queue')['status'], expected)
            self.bridge.send(support.THREAD,'같은 본문',id_,'queue')
        result = self.bridge.original_queue(support.THREAD,'fixture-account')
        self.assertEqual([r['clientId'] for r in result['rows']], [first, second])
        self.assertEqual(len(writes),2)
        receipts = [self.bridge.submissions[support.THREAD+':'+id_] for id_ in (first, second)]
        self.assertEqual([row['status'] for row in receipts], ['accepted','accepted'])
        self.assertTrue(all(row['queueOwner']=='native' for row in receipts))
        self.assertEqual(self.bridge.message_management(support.THREAD)['queue'], [])


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
