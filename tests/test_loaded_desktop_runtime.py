import base64
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from bridge.clients.codex.app_server import AppServerUnavailable, AppServerUnsupported
from bridge.clients.codex.cli_session import CliSessions
from bridge.clients.codex.desktop_subscriptions import DesktopSubscriptions


@unittest.skipUnless(sys.platform == 'linux', 'Linux Desktop subscription')
class LoadedDesktopRuntimeTests(unittest.TestCase):
    sid = 'd96fd8b7-4203-4db0-9b4d-f113b59524bb'

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.home = Path(directory.name)
        self.socket = self.home / 'native.sock'
        self.desktop = DesktopSubscriptions(self.socket)
        self.desktop.directory.mkdir(mode=0o700)
        self.client = Mock(socket_path=str(self.socket), lock=threading.RLock())
        self.cli = CliSessions(self.home, lambda *args: None, lambda *args: None, cli=sys.executable)
        self.cli.store = Mock()
        self.runtime = self.make_runtime()
        self.saved = {'id': self.sid, 'cwd': '/work', 'model_provider': 'openai', 'origin': 'desktop',
                      'archived': 0, 'creator_account_id': 'historical account', 'creator_user_id': 'historical user'}
        self.thread = {'id': self.sid, 'cwd':'/work', 'modelProvider':'openai', 'source':'vscode',
                       'ephemeral':False, 'canAcceptDirectInput':True, 'status':{'type':'active'},
                       'turns':[{'id':'turn1', 'status':'inProgress'}]}
        self.auth = {'account':{'type':'chatgpt'}, 'userId':'user1', 'requiresOpenaiAuth':True,
                     'workspaceRouting':{'chatgptAccountId':'workspace1', 'backendOrigin':'https://chatgpt.com'}}
        self.write_auth('workspace1', 'user1')
        self.client.is_loaded.return_value = True
        self.client.request.side_effect = self.request
        self.client.respond.side_effect = lambda *args: self.writes.append(('respond', args))
        self.writes = []

    def make_runtime(self):
        with patch('bridge.clients.codex.desktop_runtime.connect', return_value=self.client):
            runtime = self.cli.loaded_desktop_runtime()
        runtime.store.get = lambda sid: self.saved
        return runtime

    def write_auth(self, workspace, user):
        payload = {'https://api.openai.com/auth': {'chatgpt_account_id':workspace, 'chatgpt_user_id':user}}
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        (self.home/'auth.json').write_text(json.dumps({'auth_mode':'chatgpt',
            'tokens':{'account_id':workspace, 'id_token':'e30.'+encoded+'.test'}}))

    def confirm(self):
        self.desktop.outgoing({'id':2, 'method':'thread/resume', 'params':{'threadId':self.sid}})
        self.desktop.incoming({'id':2, 'result':{'thread':self.thread}})

    def request(self, method, params, **options):
        if method == 'account/read':
            return self.auth
        if method == 'thread/read':
            return {'thread':self.thread.copy()}
        if method == 'thread/goal/get':
            return {'goal':None}
        self.writes.append((method,params))
        if method == 'thread/resume':
            self.assertIs(options['expected_process'], self.client.process)
            self.assertEqual(params, {'threadId':self.sid, 'excludeTurns':True})
            return {'thread':self.thread.copy(), 'model':'original', 'modelProvider':'openai',
                    'reasoningEffort':'high', 'cwd':'/work', 'approvalPolicy':'on-request'}
        if method == 'thread/unsubscribe':
            return {'status':'unsubscribed'}
        if method in ('turn/steer', 'turn/start', 'turn/interrupt', 'thread/settings/update'):
            return {}
        self.fail(method)

    def attach(self):
        return self.runtime.attach_loaded_desktop(self.sid,cwd='/work',provider='openai')

    def test_original_subscription_preserves_current_turn_and_settings_and_checks_approval(self):
        self.confirm()
        state = self.attach()
        self.assertEqual((state['turns'][0]['turnId'], state['latestModel'], state['latestReasoningEffort']),
                         ('turn1', 'original', 'high'))
        self.assertEqual([method for method,_ in self.writes], ['thread/resume'])
        with patch.object(self.runtime,'_queue_refresh'):
            self.runtime.call(self.sid,'thread-follower-steer-turn',{'input':[{'type':'text','text':'next'}]})
            self.assertEqual(self.writes[-1][1]['expectedTurnId'],'turn1')
            decision={'requestId':13,'decision':'accept'}
            with self.assertRaises(AppServerUnavailable):
                self.runtime.call(self.sid,'thread-follower-command-approval-decision',decision)
            self.runtime._server_request({'id':13, 'method':'item/commandExecution/requestApproval',
                                         'params':{'threadId':self.sid,'command':'fixture'}})
            self.runtime.call(self.sid,'thread-follower-command-approval-decision',decision)
        self.assertEqual(self.writes[-1],('respond',(13,{'decision':'accept'})))
        token=self.runtime.metadata[self.sid]['connectionToken']
        self.assertTrue(self.runtime.release_connection(self.sid,token)['unsubscribed'])
        self.assertEqual(self.writes[-1], ('thread/unsubscribe', {'threadId':self.sid}))
        with self.desktop.retain(self.sid):
            self.assertNotIn(self.sid,self.runtime.joined)

    def test_no_desktop_receipt_no_cold_resume_even_if_listed(self):
        self.desktop.incoming({'method':'thread/started','params':{'thread':self.thread}})
        with self.assertRaises(AppServerUnavailable):
            self.attach()
        self.assertFalse(self.writes)
        self.client.request.assert_not_called()

    def test_rejected_identity_never_resumes(self):
        self.confirm()
        for mapping,key,value in ((self.saved,'origin','cli'),(self.saved,'archived',1),
                                  (self.thread,'parentThreadId','parent'),(self.thread,'canAcceptDirectInput',False),
                                  (self.thread,'modelProvider','other'),(self.thread,'status',{'type':'notLoaded'}),
                                  (self.auth,'userId','different'),(self.auth['workspaceRouting'],'chatgptAccountId','other')):
            with self.subTest(key=key), patch.dict(mapping,{key:value}), self.assertRaises((AppServerUnsupported,AppServerUnavailable)):
                self.runtime=self.make_runtime()
                self.attach()
        self.assertFalse(self.writes)

    def test_account_switch_and_original_detach_block_writes(self):
        self.confirm()
        self.attach()
        self.write_auth('workspace1','other-user')
        with self.assertRaisesRegex(AppServerUnsupported,'different account'):
            self.runtime.call(self.sid,'thread-follower-start-turn',{})
        self.write_auth('workspace1','user1')
        self.desktop.outgoing({'id':3,'method':'thread/unsubscribe','params':{'threadId':self.sid}})
        with self.assertRaises(AppServerUnavailable):
            self.runtime.call(self.sid,'thread-follower-start-turn',{})
        self.assertEqual([m for m,_ in self.writes],['thread/resume'])

    def test_original_unsubscribe_waits_for_live_join_and_late_acks_do_not_restore_it(self):
        self.confirm()
        entered,finished=threading.Event(),threading.Event()
        self.desktop.outgoing({'id':7,'method':'thread/resume','params':{'threadId':self.sid}})
        def release():
            entered.set()
            self.desktop.outgoing({'id':8,'method':'thread/unsubscribe','params':{'threadId':self.sid}})
            finished.set()
        with self.runtime.subscriptions.retain(self.sid):
            worker=threading.Thread(target=release)
            worker.start()
            self.assertTrue(entered.wait(2))
            self.assertFalse(finished.wait(.05))
        worker.join(2)
        self.assertTrue(finished.is_set())
        self.desktop.incoming({'id':7,'result':{'thread':self.thread}})
        with self.assertRaises(AppServerUnavailable), self.runtime.subscriptions.retain(self.sid):
            self.fail('released subscription')
