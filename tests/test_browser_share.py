import io
import queue
import time
import unittest
from unittest.mock import Mock

from bridge.features.workspace.browser_share import BrowserShare


class BrowserShareTests(unittest.TestCase):
    def setUp(self):
        self.share = BrowserShare()
        self.owner = ('login', 'thread', 'tab')
        self.share.worker = Mock(stdin=io.StringIO())
        self.share.owner = self.owner
        self.share.pending = False
        self.share.replies = queue.SimpleQueue()

    def request(self, op, **params):
        return self.share.request(self.owner, {'op':op, **params}, can_control=True)

    def test_input_requires_same_device_chat_control_and_current_frame(self):
        for other in (('other','thread','tab'),('login','other','tab'),('login','thread','other')):
            with self.assertRaises(ValueError):
                self.share.request(other, {'op':'frame'}, can_control=True)
        self.share.replies.put({'width':1920, 'height':947, 'jpeg':'fixture'})
        frame = self.request('frame')['frame']
        with self.assertRaises(ValueError):
            self.request('click', x=0, y=1, frame=frame)
        self.request('take')
        self.share.replies.put({'width':1920,'height':947,'jpeg':'fixture'})
        frame = self.request('frame')['frame']
        self.share.replies.put({'applied':True})
        self.assertTrue(self.request('click',x=1,y=1,frame=frame)['applied'])
        with self.assertRaises(ValueError):
            self.request('click',x=1,y=1,frame=frame)
        self.assertEqual(self.share.worker.stdin.getvalue().count('"click"'),1)

    def test_busy_chat_revokes_control_and_rejects_unsupported_input(self):
        self.request('take')
        self.share.frame_id = 'current'
        with self.assertRaises(ValueError):
            self.share.request(self.owner, {'op':'text','text':'a','frame':'current'}, can_control=False)
        for body in ({'op':'key','key':'Return'},{'op':'click','x':1.2,'y':0,'frame':'x'},
                     {'op':'start','windowId':1},{'op':'text','text':'a'*4097,'frame':'x'}):
            with self.assertRaises(ValueError):
                self.share.request(self.owner, body, can_control=True)
        self.assertFalse(self.share.controller)
        self.assertEqual(self.share.worker.stdin.getvalue(),'')

    def test_pending_consent_does_not_extend_timeout(self):
        self.share.pending = True
        self.share.expires = time.monotonic()+5
        deadline = self.share.expires
        self.assertEqual(self.request('status'), {'pending':True})
        self.assertEqual(self.share.expires,deadline)
