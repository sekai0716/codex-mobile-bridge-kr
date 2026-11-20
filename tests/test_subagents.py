import json
from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
import unittest
import uuid
from unittest.mock import patch
from types import SimpleNamespace

import test_bridge as support
from bridge.app.service import Bridge
from bridge.clients.codex.remote import RemoteStore
from bridge.features.sessions.model import normalize_state
from bridge.features.sessions.timeline import Timeline
from bridge.clients.codex.app_server import AppServerUnknownResult


class SubagentTests(unittest.TestCase):
    def setUp(self):
        self.case=support.IntegrationTests();self.case.setUp();self.root=self.case.root;self.bridge=self.case.bridge
    def tearDown(self):self.case.tearDown()
    def child(self,parent,title='Child',source=None,path=None):
        identifier=str(uuid.uuid4());log=path or self.root/'sessions'/(identifier+'.jsonl')
        if not path:
            records=[{'type':'event_msg','payload':{'type':'task_started','turn_id':'fixture-turn'}},
                     {'type':'response_item','payload':{'type':'message','role':'assistant','content':[{'text':'Result '+title}]}},
                     {'type':'event_msg','payload':{'type':'task_complete'}}]
            log.write_text('\n'.join(json.dumps(row) for row in records))
        value=source or {'subagent':{'thread_spawn':{'parent_thread_id':parent,'agent_nickname':title,'agent_path':'/root/'+title}}}
        with closing(sqlite3.connect(self.root/'state_5.sqlite')) as db, db:
            db.execute('INSERT INTO threads VALUES(?,?,?,?,?,?,?,?)',(identifier,title,'/workspace',2,0,None,json.dumps(value),str(log)))
        return identifier
    def test_tree_includes_descendants_excludes_other_roots(self):
        first=self.child(support.THREAD);second=self.child(first,'Nested');self.child(str(uuid.uuid4()),'Unrelated')
        self.child(support.THREAD,'Guardian',{'subagent':{'other':'guardian:'+support.THREAD}})
        rows=self.bridge.subagents(support.THREAD)['agents'];self.assertEqual([r['id'] for r in rows],[first,second]);self.assertEqual(rows[1]['parentId'],first)
        self.assertEqual(self.case.fixture.requests,[])
    def test_history_saved_state_and_no_activation(self):
        child=self.child(support.THREAD);view=self.bridge.subagents(support.THREAD,child)
        self.assertTrue(view['saved']);self.assertEqual(view['turns'][-1]['status'],'completed')
        self.assertEqual(view['turns'][-1]['messages'][0]['text'],'Result Child');self.assertEqual(self.case.fixture.requests,[])
        with self.assertRaises(KeyError):self.bridge.store.get(child)
    def test_rejects_unrelated_cycles_and_external_rollout(self):
        unrelated=self.child(str(uuid.uuid4()))
        with self.assertRaises(KeyError):self.bridge.subagents(support.THREAD,unrelated)
        bad=self.child(support.THREAD,path=self.root/'external.jsonl')
        with self.assertRaises(ValueError):self.bridge.subagents(support.THREAD,bad)
        child=self.child(support.THREAD)
        with closing(sqlite3.connect(self.root/'state_5.sqlite')) as db, db:
            db.execute('UPDATE threads SET source=? WHERE id=?',(json.dumps({'subagent':{'thread_spawn':{'parent_thread_id':child}}}),child))
        with self.assertRaises(KeyError):self.bridge.subagents(support.THREAD,child)
    def test_remote_delegates_with_original_parent(self):
        child=self.child(support.THREAD);remote=RemoteStore('fixture');bridge=SimpleNamespace(store=remote)
        with patch.object(remote,'call',side_effect=lambda method,args:getattr(self.bridge.store,method)(**args)) as call:
            self.assertEqual(Bridge.subagents(bridge,support.THREAD)['agents'][0]['id'],child)
            self.assertTrue(Bridge.subagents(bridge,support.THREAD,child)['saved'])
            self.assertEqual(call.call_args.args[1],{'thread_id':support.THREAD,'agent_id':child})

    def test_creation_ids_survive_rollout_live_duplicates_and_failed_calls(self):
        a,b=self.child(support.THREAD),self.child(support.THREAD)
        activity={'type':'subAgentActivity','id':'start','kind':'started','agentThreadId':a,'agentPath':'/root/review'}
        collab={'type':'collabAgentToolCall','id':'spawn','tool':'spawnAgent','status':'completed','senderThreadId':support.THREAD,
                'receiverThreadIds':[a,b], 'receiverAgents':[{'threadId':a,'agentNickname':'Ada'},{'threadId':b,'agentNickname':'Ada'}]}
        state={'id':support.THREAD,'turns':[{'turnId':'turn','items':[activity,collab,{**activity,'kind':'interacted','id':'later'},
               {**collab,'status':'failed','id':'failed','receiverThreadIds':[str(uuid.uuid4())]}]}]}
        timeline=Timeline();timeline.update({**normalize_state(state),'sequence':1})
        created=[row for row in timeline.rows if row['kind']=='subAgentCreated']
        self.assertEqual([(row['agent']['id'],row['agent']['nickname']) for row in created],[(a,'Ada'),(b,'Ada')])
        self.assertNotEqual(created[0]['key'],created[1]['key'])
        events=[{'type':'event_msg','payload':{'type':'task_started','turn_id':'turn'}},
                {'type':'event_msg','payload':{'type':'item_completed','thread_id':support.THREAD,'turn_id':'turn','item':
                 {'type':'SubAgentActivity','id':'stored','kind':'started','agent_thread_id':a,'agent_path':'/root/review'}}},
                {'type':'event_msg','payload':{'type':'item_completed','thread_id':support.THREAD,'turn_id':'turn','item':
                 {'type':'CollabAgentToolCall','id':'c','tool':'spawn_agent','status':'completed','sender_thread_id':support.THREAD,
                  'receiver_thread_ids':[a,b],'receiver_agents':[{'thread_id':a,'agent_nickname':'Ada'}]}}}]
        (self.root/'sessions/fixture.jsonl').write_text('\n'.join(map(json.dumps,events)))
        timeline.update({**normalize_state(self.bridge.store.history(support.THREAD)),'sequence':2})
        self.assertEqual([r['key'] for r in timeline.rows],[r['key'] for r in created])

    def test_collab_delivery_and_agent_state_update_the_same_live_row(self):
        target, second = self.child(support.THREAD), self.child(support.THREAD)
        item = {'type': 'collabAgentToolCall', 'id': 'send', 'tool': 'sendInput', 'status': 'inProgress',
                'receiverThreadIds': [target, target], 'receiverThreads': [{'threadId': target, 'thread': {'agentNickname': 'Ada'}}],
                'prompt': '검토해 주세요'}
        turn = {'turnId': 'parent-turn', 'status': 'completed', 'items': [item]}
        timeline = Timeline()
        def update(sequence):
            timeline.update({**normalize_state({'id': support.THREAD, 'turns': [turn]}), 'sequence': sequence})
            self.assertEqual(len(timeline.rows), 1)
            return timeline.rows[0]
        started = update(1)
        self.assertEqual(started['status'], 'inProgress')
        item.update(status='completed', agentsStates={target: {'status': 'running', 'message': None}})
        sent = update(2)
        self.assertEqual(sent['key'], started['key'])
        self.assertNotEqual(sent['version'], started['version'])
        self.assertEqual(sent['collab'], {'tool': 'sendInput', 'targets': [{'id': target, 'nickname': 'Ada', 'status': 'running'}]})
        item['agentsStates'][target]['status'] = 'completed'
        self.assertNotEqual(update(3)['version'], sent['version'])
        item.update(tool='wait', receiverThreadIds=[], agentsStates={
            target: {'status': 'completed', 'message': '검토 결과'}, second: {'status': 'errored', 'message': '오류 원인'}})
        item.pop('prompt')
        wait = update(4)
        self.assertEqual([(a['id'], a['status']) for a in wait['collab']['targets']], [(target, 'completed'), (second, 'errored')])
        self.assertIn('Ada\n검토 결과', timeline.details[wait['key']])
        self.assertIn(second + '\n오류 원인', timeline.details[wait['key']])

    def test_saved_collab_calls_match_live_and_ignore_other_turns_and_late_starts(self):
        target = self.child(support.THREAD)
        send = {'type': 'CollabAgentToolCall', 'id': 'request', 'tool': 'send_input',
                'receiver_thread_ids': [target], 'receiver_agents': [{'thread_id': target, 'agent_nickname': 'Ada'}],
                'prompt': '검토해 주세요'}
        def event(item, phase='item_completed', thread=support.THREAD, turn='parent-turn'):
            return {'type': 'event_msg', 'payload': {'type': phase, 'thread_id': thread, 'turn_id': turn, 'item': item}}
        records = [
            {'type': 'event_msg', 'payload': {'type': 'task_started', 'turn_id': 'parent-turn'}},
            event(send, 'item_started'),
            event({**send, 'status': 'completed', 'agents_states': {target: 'running'}}),
            event(send, 'item_started'),
            event({**send, 'id': 'wait', 'tool': 'wait', 'status': 'completed', 'agents_states': {target: {'completed': '결과'}}}),
            event({'type': 'CollabAgentToolCall', 'id': 'empty', 'tool': 'wait', 'status': 'completed', 'agents_states': {}}),
            event({**send, 'id': 'failure', 'status': 'failed'}),
            event({**send, 'id': 'wrong-thread'}, thread=str(uuid.uuid4())),
            event({**send, 'id': 'wrong-turn'}, turn='different'),
            {'type': 'event_msg', 'payload': {'type': 'task_complete'}}]
        (self.root / 'sessions/fixture.jsonl').write_text('\n'.join(map(json.dumps, records)))
        saved = normalize_state(self.bridge.store.history(support.THREAD))
        rows = saved['turns'][0]['messages']
        self.assertEqual([r['id'] for r in rows], ['request', 'wait', 'empty', 'failure'])
        live = {'type': 'collabAgentToolCall', 'id': 'request', 'tool': 'sendInput', 'status': 'completed',
                'receiverThreadIds': [target], 'receiverAgents': [{'threadId': target, 'agentNickname': 'Ada'}],
                'prompt': '검토해 주세요', 'agentsStates': {target: {'status': 'running', 'message': None}}}
        view = normalize_state({'id': support.THREAD, 'turns': [{'turnId': 'parent-turn', 'items': [live]}]})
        self.assertEqual(rows[0], view['turns'][0]['messages'][0])
        self.assertEqual(rows[1]['collab']['targets'][0]['status'], 'completed')
        self.assertIn('Ada\n결과', rows[1]['text'])
        self.assertEqual(rows[2]['collab']['targets'], [])
        self.assertEqual(rows[3]['status'], 'failed')

    def test_live_control_checks_child_turn_generation_and_durable_receipt(self):
        child=self.child(support.THREAD)
        with closing(sqlite3.connect(self.root/'state_5.sqlite')) as db, db:
            db.execute('ALTER TABLE threads ADD COLUMN model_provider TEXT')
            db.execute("UPDATE threads SET model_provider='custom'")
        status={'type':'active'};turn={'id':'turn','status':'inProgress','items':[{'type':'agentMessage','id':'r','text':'live'}]}
        thread={'id':child,'parentThreadId':support.THREAD,'cwd':'/workspace','modelProvider':'custom','status':status,'canAcceptDirectInput':True}
        writes=[]
        @contextmanager
        def connect(meta, *, write):
            self.assertEqual(meta['id'],child)
            def request(method,params):
                self.assertEqual(params['threadId'],child)
                if method=='thread/read':return {'thread':thread}
                if method=='thread/turns/list':return {'data':[turn]}
                writes.append((method,params))
                if params['input'][0]['text']=='lost':raise AppServerUnknownResult('lost')
                return {'turnId':'turn'} if method=='turn/steer' else {'turn':{'id':'new'}}
            yield request,'fixture-runtime'
        self.bridge.agent_chats.connection=connect
        detail=self.bridge.subagents(support.THREAD,child,live=True)
        self.assertTrue(detail['control']['canSend']);self.assertEqual(detail['turns'][0]['messages'][0]['text'],'live')
        body={'id':str(uuid.uuid4()),'text':'test','generation':'fixture-runtime','expectedTurnId':'turn'}
        send=lambda **more:self.bridge.send_subagent(support.THREAD,child,{**body,**more})
        for fields in ({'expectedTurnId':None},{'generation':'stale'}):
            with self.assertRaises(ValueError):send(**fields)
        self.assertEqual(send()['status'],'accepted');self.assertEqual(send()['status'],'accepted')
        self.assertEqual(writes[0][1]['expectedTurnId'],'turn')
        status['type']='idle';turn['status']='completed';body.update(id=str(uuid.uuid4()),expectedTurnId=None)
        self.assertEqual(send()['status'],'accepted')
        body.update(id=str(uuid.uuid4()),text='lost')
        self.assertEqual(send()['status'],'unknown');self.assertEqual(send()['status'],'unknown')
        thread['canAcceptDirectInput']=False
        with self.assertRaises(ValueError):send(id=str(uuid.uuid4()))
        thread['parentThreadId']=str(uuid.uuid4())
        self.assertTrue(self.bridge.subagents(support.THREAD,child,live=True)['saved'])
        self.assertEqual([m for m,_ in writes],['turn/steer','turn/start','turn/start'])
        self.assertEqual(self.case.fixture.requests,[])


class SubagentHttpTests(unittest.TestCase):
    setUpClass=classmethod(support.HttpTests.setUpClass.__func__)
    setUp=support.HttpTests.setUp;tearDown=support.HttpTests.tearDown;request=support.HttpTests.request;login=support.HttpTests.login
    def test_auth_read_only_and_host(self):
        path='/api/sessions/'+support.THREAD+'/subagents';calls=[]
        self.server.bridge.subagents=lambda thread,agent:calls.append((thread,agent)) or {'agents':[]}
        self.assertEqual(self.request('GET',path)[0],401);auth=self.login()
        self.assertEqual(self.request('GET',path,headers=auth)[0],200)
        self.assertEqual(self.request('POST',path,{},auth)[0],405)
        self.assertEqual(self.request('GET',path+'?host=unknown',headers=auth)[0],404)
        self.assertEqual(calls,[(support.THREAD,None)])

    def test_send_route_requires_authenticated_post_and_keeps_the_parent(self):
        child=str(uuid.uuid4());path='/api/sessions/'+support.THREAD+'/subagents/send?id='+child
        calls=[]
        self.server.bridge.send_subagent=lambda parent,agent,body:calls.append((parent,agent,body)) or {'status':'accepted'}
        self.assertEqual(self.request('POST',path,{})[0],401)
        auth=self.login()
        self.assertEqual(self.request('GET',path,headers=auth)[0],405)
        self.assertEqual(self.request('POST',path,{}, {k:v for k,v in auth.items() if k!='X-CSRF-Token'})[0],403)
        self.assertEqual(self.request('POST',path,{'text':'hello'},auth)[0],200)
        self.assertEqual(calls,[(support.THREAD,child,{'text':'hello'})])
