"""대용량 첨부의 실제 저장, HTTP 수신과 중단 시 정리 계약을 확인한다."""
import hashlib
import http.client
import io
import json
import tempfile
import unittest
import uuid
from email.message import Message
from pathlib import Path
from types import SimpleNamespace

import test_bridge as support
from bridge.api.httpd import UploadBody
from bridge.features.workspace.uploads import Uploads, UPLOAD_CHUNK


class GeneratedFile:
    def __init__(self, size):
        self.remaining = size
        self.digest = hashlib.sha256()
        self.largest_read = 0

    def read(self, size):
        assert 0 < size <= UPLOAD_CHUNK
        self.largest_read = max(size, self.largest_read)
        data = b'x' * min(size, self.remaining)
        self.remaining -= len(data)
        self.digest.update(data)
        return data


class UploadStreamTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = Uploads(self.directory.name)
        self.thread, self.identifier = str(uuid.uuid4()), str(uuid.uuid4())

    def test_over_100_mib_stream_is_stored_and_resolved_without_a_whole_file_read(self):
        source = GeneratedFile(101*1024*1024+7)
        result = self.store.put(self.thread,self.identifier,'large.bin',source)
        self.assertEqual(result['size'],101*1024*1024+7)
        stored = self.store.get(self.thread,self.identifier)
        self.assertEqual(stored['sha256'],source.digest.hexdigest())
        self.assertEqual(Path(stored['localPath']).stat().st_size,result['size'])
        self.assertEqual(self.store.resolve(self.thread,[self.identifier])[0]['id'],self.identifier)
        self.assertEqual(source.largest_read,UPLOAD_CHUNK)

    def test_truncated_http_body_never_creates_a_receipt_and_removes_partial_bytes(self):
        headers=Message();headers['Content-Length']='100'
        body=UploadBody(SimpleNamespace(headers=headers,rfile=io.BytesIO(b'partial')))
        with self.assertRaisesRegex(ValueError,'중단'):
            self.store.put(self.thread,self.identifier,'file.bin',body)
        self.assertFalse((self.store.root/self.thread/(self.identifier+'.json')).exists())
        self.assertEqual(list(self.store.root.rglob('*.part')),[])

    def test_stream_retry_preserves_immutable_id_and_rejects_changed_content(self):
        first=self.store.put(self.thread,self.identifier,'file.bin',io.BytesIO(b'original'))
        self.assertEqual(self.store.put(self.thread,self.identifier,'file.bin',io.BytesIO(b'original')),first)
        with self.assertRaises(ValueError):self.store.put(self.thread,self.identifier,'file.bin',io.BytesIO(b'changed'))
        self.assertEqual(Path(self.store.get(self.thread,self.identifier)['localPath']).read_bytes(),b'original')
        self.assertEqual(list(self.store.root.rglob('*.part')),[])

    def test_invalid_http_lengths_and_thumbnail_budget_are_rejected(self):
        for values,encoding,maximum in [([],None,None),(['0'],None,None),(['-1'],None,None),(['3','3'],None,None),(['3'],'chunked',None),([str(1024*1024+1)],None,1024*1024)]:
            headers=Message()
            for value in values:headers['Content-Length']=value
            if encoding:headers['Transfer-Encoding']=encoding
            with self.assertRaises(ValueError):UploadBody(SimpleNamespace(headers=headers,rfile=io.BytesIO(b'123')),maximum)

    def test_cleanup_cannot_remove_an_attachment_while_a_retry_is_streaming(self):
        self.store.put(self.thread,self.identifier,'file.bin',b'original')
        store=self.store
        class Retry(io.BytesIO):
            def read(self,size):
                self_owner.assertEqual(store.collect(retention=-1),0)
                return super().read(size)
        self_owner=self
        self.store.put(self.thread,self.identifier,'file.bin',Retry(b'original'))
        self.assertEqual(self.store.collect(retention=-1),1)


class UploadStreamHTTPTests(unittest.TestCase):
    setUpClass=classmethod(support.HttpTests.setUpClass.__func__)
    setUp=support.HttpTests.setUp
    tearDown=support.HttpTests.tearDown
    request=support.HttpTests.request
    login=support.HttpTests.login

    def test_authenticated_21_mib_upload_uses_bounded_store_and_does_not_start_a_turn(self):
        temporary=tempfile.TemporaryDirectory();self.addCleanup(temporary.cleanup)
        store=Uploads(temporary.name)
        self.server.bridge.upload=store.put
        identifier=str(uuid.uuid4());data=b'x'*(21*1024*1024+3)
        connection=http.client.HTTPConnection('127.0.0.1',self.port,timeout=15);self.addCleanup(connection.close)
        connection.request('POST','/api/sessions/'+support.THREAD+'/uploads?id='+identifier+'&name=large.bin',data,{'Origin':self.origin,'Content-Type':'application/octet-stream',**self.login()})
        response=connection.getresponse();result=json.loads(response.read())
        self.assertEqual(response.status,200,result);self.assertEqual(result['size'],len(data))
        self.assertEqual(store.get(support.THREAD,identifier)['sha256'],hashlib.sha256(data).hexdigest())
