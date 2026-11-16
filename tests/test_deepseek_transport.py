"""Connector transport boundaries; servers and credentials are isolated fixtures."""
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from bridge.clients.deepseek.adapter import DeepSeek
from bridge.clients.errors import BridgeUnavailable

ROOT = Path(__file__).resolve().parents[1]


class DeepSeekProfileErrorTests(unittest.TestCase):
    def test_web_profile_missing_binding_does_not_offer_desktop_restart_or_create_profile(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.tmp') as tmp:
            root = Path(tmp)
            profile = root/'home/profiles/web/cordis.patch.yml'
            profile.parent.mkdir(parents=True)
            profile.write_text('[]')
            adapter = DeepSeek(root/'gateway', root/'home')
            with self.assertRaisesRegex(BridgeUnavailable, "찾을\\ 수\\ 없음\\ Harness\\ 데스크탑\\ 파일\\.\\ 사용\\ Web\\ 또는\\ 제3자\\ 클라이언트로\\ 문의해\\ 주세요\\.“타사\\ 클라이언트:\\ 수동\\ 설치\\ 및\\ 바인딩”액세스\\ 플러그인을\\ 스캔하고\\ 바인딩합니다\\.\\ 먼저\\ 공식\\ 데스크톱\\ 버전을\\ 시작하고\\ 데이터\\ 디렉터리를\\ 확인하세요\\.。"):
                adapter.call('list')
            self.assertFalse((root/'home/profiles/desktop').exists())
            self.assertFalse(adapter.directory.exists())
            desktop = root/'home/profiles/desktop/cordis.patch.yml'
            desktop.parent.mkdir()
            desktop.write_text('[]')
            with self.assertRaisesRegex(BridgeUnavailable, "DeepSeek\\ 데스크톱이\\ 연결되지\\ 않았습니다\\.\\ 액세스\\ 플러그인을\\ 설치하고\\ 다시\\ 열어주세요\\.\\ Harness"):
                adapter.call('list')


class DeepSeekTransportTests(unittest.TestCase):
    def server(self, handler):
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        thread.start()
        def close():
            server.shutdown(); thread.join(timeout=2); server.server_close()
        self.addCleanup(close)
        return server

    def setUp(self):
        (ROOT/'.tmp').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT/'.tmp')
        self.addCleanup(self.temp.cleanup)
        self.received, self.forwarded, self.bodies = [], [], []
        self.status = 200
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_POST(self):
                owner.bodies.append(json.loads(self.rfile.read(int(self.headers.get('Content-Length', '0')))))
                owner.received.append((self.path, self.headers.get('Authorization')))
                data = json.dumps({'sessions': [], 'error': 'Fixture rejected'}).encode()
                self.send_response(owner.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                if 300 <= owner.status < 400:
                    self.send_header('Location', 'http://127.0.0.1:'+str(owner.target.server_port)+'/redirected')
                self.end_headers(); self.wfile.write(data)
        class Target(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                owner.forwarded.append(self.headers.get('Authorization'))
                self.send_response(200); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b'{}')
            do_POST = do_GET
        self.target = self.server(Target)
        self.source = self.server(Handler)
        directory = Path(self.temp.name)
        (directory/'connection.json').write_text(json.dumps({'token': 'fixture-secret'}))
        (directory/'endpoint.json').write_text(json.dumps({'port': self.source.server_port}))
        self.adapter = DeepSeek(directory, directory/'home')

    def test_redirects_never_forward_connector_credentials(self):
        for code in (301, 302, 303, 307, 308):
            with self.subTest(status=code):
                self.status = code
                self.forwarded.clear()
                rejected = False
                try: self.adapter.call('list')
                except BridgeUnavailable: rejected = True
                self.assertEqual(self.forwarded, [], 'Connector credential reached the redirect destination')
                self.assertTrue(rejected)

    def test_direct_request_ignores_proxy_environment_and_keeps_authentication(self):
        proxy = 'http://127.0.0.1:'+str(self.target.server_port)
        with patch.dict('os.environ', {'http_proxy': proxy, 'HTTP_PROXY': proxy, 'no_proxy': '', 'NO_PROXY': ''}):
            self.assertEqual(self.adapter.call('list')['sessions'], [])
        self.assertEqual(self.received, [('/mobile', 'Bearer fixture-secret')])
        self.assertEqual(self.forwarded, [])

    def test_native_error_remains_an_adapter_error(self):
        self.status = 401
        with self.assertRaisesRegex(BridgeUnavailable, 'Fixture rejected'):
            self.adapter.call('list')
        self.assertEqual(self.forwarded, [])

    def test_native_project_mentions_keep_the_existing_plugin_protocol(self):
        body = {'id': 'fixture-id', 'text': '파일 확인', 'resolvedReferences': [
            {'path': '/project/중국 문서.md', 'kind': 'file'}, {'path': '/project/folder', 'kind': 'directory'}]}
        self.adapter.call('send', 'native-chat', body)
        self.assertEqual(self.bodies, [{'action': 'send', 'sid': 'native-chat', 'body': {
            'id': 'fixture-id', 'text': '파일 확인\n\n@"/project/중국 문서.md"\n@/project/folder/'}}])
        self.assertIn('resolvedReferences', body)


if __name__ == '__main__': unittest.main()
