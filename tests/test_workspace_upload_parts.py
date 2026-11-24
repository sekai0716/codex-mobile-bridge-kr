import base64
import errno
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from bridge.app.service import Bridge
from bridge.clients.codex.remote import RemoteStore
from bridge.features.workspace.workspace import WORKSPACE_UPLOAD_CHUNK, WorkspaceUpload, operate


class UploadPartTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project = Path(self.tmp.name) / 'project'
        self.project.mkdir()
        cache = str(Path(self.tmp.name) / 'cache')
        cache_env = patch.dict(os.environ, {'XDG_CACHE_HOME': cache, 'LOCALAPPDATA': cache})
        cache_env.start()
        self.addCleanup(cache_env.stop)
        self.params = dict(owner='a' * 64, identifier=str(uuid.uuid4()), path='new.bin', total=4)

    def send(self, phase, **fields):
        return operate(str(self.project), 'upload-part', {**self.params, 'phase': phase, **fields})

    def test_limit_boundaries_and_contents(self):
        block = bytes(range(256)) * (WORKSPACE_UPLOAD_CHUNK // 256)
        for total in (0, 20 << 20, (20 << 20) + 1, (48 << 20) + 37):
            with self.subTest(total=total):
                path = 'size-' + str(total)
                self.params.update(total=total, path=path)
                self.send('start')
                digest = hashlib.sha256()
                for offset in range(0, total, len(block)):
                    piece = block[:total-offset]
                    digest.update(piece)
                    position = self.send('chunk', offset=offset, encoded=base64.b64encode(piece))['offset']
                    self.assertEqual(position, offset + len(piece))
                self.assertFalse((self.project / path).exists())
                self.assertEqual(self.send('finish')['state'], 'done')
                with (self.project / path).open('rb') as saved:
                    actual = hashlib.sha256()
                    while data := saved.read(len(block)):
                        actual.update(data)
                    self.assertEqual(actual.digest(), digest.digest())
                self.assertFalse(list(self.project.glob('.bridge-upload-*')))

    def test_retry_cancel_scope_and_expiry(self):
        self.send('start')
        for _ in range(2):
            self.assertEqual(self.send('chunk', offset=0, encoded='YWI=')['offset'], 2)
        for fields in (dict(owner='b' * 64), dict(path='other.bin'), dict(total=5)):
            self.assertEqual(self.send('status', **fields)['state'], 'missing')
        for offset, data in ((0, 'Y2Q='), (3, 'ZA==')):
            with self.assertRaises(ValueError):
                self.send('chunk', offset=offset, encoded=data)
        with self.assertRaises(ValueError):
            self.send('finish')
        self.assertEqual(self.send('cancel')['state'], 'missing')
        self.assertFalse(list(self.project.iterdir()))
        self.send('start')
        old = next(self.project.iterdir())
        db = WorkspaceUpload.registry()
        try:
            with db:
                db.execute('UPDATE uploads SET touched=0')
        finally:
            db.close()
        self.send('start', identifier=str(uuid.uuid4()))
        self.assertFalse(old.exists())

    def test_retry_after_disk_full_and_lost_finish(self):
        self.send('start')
        with patch('bridge.features.workspace.workspace.os.fsync', side_effect=OSError(errno.ENOSPC, 'full')):
            with self.assertRaisesRegex(ValueError, 'disk space'):
                self.send('chunk', offset=0, encoded='YWJjZA==')
        self.assertEqual(self.send('status')['offset'], 0)
        self.send('chunk', offset=0, encoded='YWJjZA==')
        with patch.object(WorkspaceUpload, 'remove_stage', side_effect=OSError('interrupted')):
            with self.assertRaises(ValueError):
                self.send('finish')
        self.assertEqual(self.send('start')['state'], 'done')
        self.assertEqual((self.project / 'new.bin').read_bytes(), b'abcd')
        self.assertFalse(list(self.project.glob('.bridge-upload-*')))

    def test_existing_file_comparison_resumes_in_bounded_steps(self):
        dest = self.project / 'new.bin'
        dest.write_bytes(b'abcd')
        self.send('start')
        self.send('chunk', offset=0, encoded='YWJjZA==')
        with patch.object(WorkspaceUpload, 'VERIFY_BATCH', 2):
            self.assertEqual(self.send('finish')['state'], 'checking')
            self.assertEqual(self.send('start')['state'], 'checking')
            self.assertTrue(self.send('finish')['existing'])
            self.params['identifier'] = str(uuid.uuid4())
            self.send('start')
            self.send('chunk', offset=0, encoded='YWJjZA==')
            self.assertEqual(self.send('finish')['state'], 'checking')
            dest.write_bytes(b'1234')
            with self.assertRaises(ValueError):
                self.send('finish')
            self.send('cancel')
            self.assertEqual(dest.read_bytes(), b'1234')

    def test_publication_cleanup_is_serialized_after_receipt_commit(self):
        self.send('start')
        self.send('chunk', offset=0, encoded='YWJjZA==')
        remove_stage = WorkspaceUpload.remove_stage

        def verify_cleanup(row):
            with closing(WorkspaceUpload.registry()) as reader:
                reader.execute('PRAGMA busy_timeout=0')
                receipt = reader.execute('SELECT state FROM uploads WHERE id=?', (row['id'],)).fetchone()
                self.assertEqual(receipt['state'], 'done')
                with self.assertRaisesRegex(sqlite3.OperationalError, 'locked'):
                    reader.execute('BEGIN IMMEDIATE')
            remove_stage(row)

        with patch.object(WorkspaceUpload, 'remove_stage', side_effect=verify_cleanup) as cleanup:
            self.assertEqual(self.send('finish')['state'], 'done')
            cleanup.assert_called_once()

    def test_concurrent_publish_preserves_destination(self):
        identifiers = [str(uuid.uuid4()), str(uuid.uuid4())]
        for identifier in identifiers:
            self.send('start', identifier=identifier)
            self.send('chunk', identifier=identifier, offset=0, encoded='YWJjZA==')
        with ThreadPoolExecutor(2) as pool:
            receipts = list(pool.map(lambda identifier: self.send('finish', identifier=identifier), identifiers))
        self.assertEqual(sorted(record['existing'] for record in receipts), [False, True])
        self.send('start')
        self.send('chunk', offset=0, encoded='MTIzNA==')
        with self.assertRaises(ValueError):
            self.send('finish')
        self.send('cancel')
        self.assertEqual((self.project / 'new.bin').read_bytes(), b'abcd')

    def test_ssh_payload_resumes_in_fresh_destination_interpreters(self):
        store = RemoteStore('upload-fixture')
        store.get = lambda _: {'cwd': str(self.project)}
        bridge = SimpleNamespace(host='remote:fixture', local=False, store=store)

        def ssh(alias, source, timeout):
            self.assertEqual(alias, 'upload-fixture')
            result = subprocess.run([sys.executable, '-B', '-X', 'utf8', '-'], input=source,
                                    encoding='utf-8', capture_output=True, check=True, timeout=timeout)
            return json.loads(result.stdout)

        thread = str(uuid.uuid4())
        def remote(phase, **fields):
            return Bridge.workspace(bridge, thread, 'upload-part', {**self.params, 'phase': phase, **fields})

        with patch('bridge.app.service.ssh_read', side_effect=ssh):
            remote('start')
            remote('chunk', offset=0, encoded='YWI=')
            self.assertEqual(remote('start')['offset'], 2)
            remote('chunk', offset=2, encoded='Y2Q=')
            self.assertEqual(remote('finish')['state'], 'done')
        self.assertEqual((self.project / 'new.bin').read_bytes(), b'abcd')
