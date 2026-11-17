#!/usr/bin/env python3
"""격리된 Linux Desktop 대역과 실제 Codex로 공유 사이드채팅 생성을 검증한다.

실제 계정·데스크톱 채팅을 사용하지 않으며 모델 turn을 시작하지 않는다.
POSIX 권한을 지원하는 작업 사본에서 PYTHONPATH=. python3 -B
scripts/smoke-linux-desktop-runtime.py --codex /absolute/path/to/codex 로 실행한다.
"""
import argparse
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

from bridge.app.service import Bridge
from bridge.clients.codex import desktop_runtime as runtime
from bridge.features.sessions.create import CreationError, _runtime_operation, fork_attached

ROOT = Path(__file__).resolve().parents[1]


class DesktopFixture:
    """현재 Python 프로세스를 App 소유자로 삼아 실제 시작 어댑터를 호출한다."""
    def __init__(self, home, cli, error_stream, gateway=None):
        runtime.configure(home, sys.executable, cli)
        self.home = home
        self.messages = queue.Queue()
        self.notifications = []
        self.counter = 0
        environment = {**os.environ, 'CODEX_HOME': str(home), 'CODEX_SQLITE_HOME': str(home)}
        environment.update(runtime.launch_environment(home, sys.executable))
        command = ([str(gateway), 'codex-desktop-runtime', '--configuration',
                    str(runtime.directory(home) / 'settings.json'), '--', 'app-server'] if gateway else
                   [environment['CODEX_CLI_PATH'], 'app-server'])
        self.process = subprocess.Popen(command, cwd=ROOT,
                                        env=environment, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=error_stream, text=True, encoding='utf-8')
        def read():
            try:
                for line in self.process.stdout:
                    self.messages.put(json.loads(line))
            finally:
                self.messages.put(None)
        threading.Thread(target=read, daemon=True).start()
        result = self.request('initialize', {'clientInfo': {'name': 'Codex Desktop', 'version': 'fixture'},
                                            'capabilities': {'experimentalApi': True}})
        assert Path(result['codexHome']).resolve() == home
        self.process.stdin.write(json.dumps({'method': 'initialized'}) + '\n')
        self.process.stdin.flush()

    def request(self, method, params):
        self.counter += 1
        identifier = self.counter
        self.process.stdin.write(json.dumps({'id': identifier, 'method': method, 'params': params}) + '\n')
        self.process.stdin.flush()
        while True:
            packet = self.messages.get(timeout=30)
            assert packet is not None, 'Desktop fixture transport closed'
            if packet.get('id') != identifier:
                self.notifications.append(packet)
                continue
            assert 'error' not in packet, packet.get('error')
            return packet['result']

    def close(self):
        # App의 EOF가 어댑터와 엔진을 회수하며 Bridge 연결 종료는 이를 호출하지 않는다.
        self.process.stdin.close()
        assert self.process.wait(timeout=40) == 0, 'Desktop fixture did not exit normally'
        self.process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', required=True, type=Path)
    parser.add_argument('--gateway', type=Path, help='검증할 패키징된 게이트웨이 어댑터')
    args = parser.parse_args()
    assert sys.platform == 'linux', 'Linux fixture only'
    cli = args.codex.resolve(strict=True)
    gateway = args.gateway.resolve(strict=True) if args.gateway else None
    assert os.access(cli, os.X_OK)
    requests = []

    class UnexpectedModelRequest(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            requests.append(self.path)
            self.send_error(500, 'This fixture must never start a model turn')

    server = ThreadingHTTPServer(('127.0.0.1', 0), UnexpectedModelRequest)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix='linux-shared-runtime-', dir=ROOT / '.tmp') as temporary:
            folder = Path(temporary).resolve()
            home = folder / 'home'; home.mkdir(mode=0o700)
            (home / 'config.toml').write_text(f'''model="fixture-model"
model_provider="fixture"
approval_policy="never"
sandbox_mode="read-only"
[model_providers.fixture]
name="Loopback fixture"
base_url="http://127.0.0.1:{server.server_port}/v1"
wire_api="responses"
requires_openai_auth=false
[analytics]
enabled=false
''')
            original_config = (home / 'config.toml').read_bytes()
            with (folder / 'native-stderr.log').open('w') as errors:
                fixture = DesktopFixture(home, str(cli), errors, gateway)
                try:
                    parent = fixture.request('thread/start', {'cwd': str(folder)})['thread']['id']
                    fixture.request('thread/inject_items', {'threadId': parent, 'items': [{
                        'type': 'message', 'role': 'user', 'content': [{
                            'type': 'input_text', 'text': 'PARENT_CONTEXT_MARKER: reference only'}]}]})
                    before = fixture.request('thread/read', {'threadId': parent, 'includeTurns': True})
                    record = runtime._read(runtime.directory(home) / 'active.json')
                    original_runtime = record['runtime']
                    assert record['app']['pid'] == os.getpid() and record['ready'] is True
                    settings = {'model': 'fixture-model', 'modelProvider': 'fixture',
                                'approvalPolicy': 'never', 'sandbox': 'read-only'}

                    # 동일 부모를 보유한 상태에서 과거의 별도 엔진 경로가 충돌함을 재현한다.
                    try:
                        _runtime_operation(str(cli), home, str(folder), lambda request: request('thread/fork', {
                            **settings, 'threadId': parent, 'cwd': str(folder),
                            'attachToSource': True, 'excludeTurns': True}), isolated_home=True)
                    except CreationError as error:
                        assert str(error) == f'thread {parent} already has an active writer', str(error)
                    else:
                        raise AssertionError('Separate writer unexpectedly forked the active parent')

                    bridge = SimpleNamespace(host='local', codex_home=home,
                                             catalog_reader=SimpleNamespace(executable=str(cli)))
                    created = []
                    child = fork_attached(str(cli), home, str(folder), parent, 'Fixture side chat', settings,
                        created.append, runtime_operation=lambda operation: Bridge._desktop_metadata_operation(
                            bridge, str(folder), operation, 'Unknown fixture creation result', require_shared=True))
                    assert created == [child]
                    after = fixture.request('thread/read', {'threadId': parent, 'includeTurns': True})
                    assert after['thread']['turns'] == before['thread']['turns'], 'Parent history changed'
                    assert runtime._read(runtime.directory(home) / 'active.json')['runtime'] == original_runtime
                    client = runtime.connect(home, cli)
                    try:
                        attached = client.request('thread/list', {'attachedToThreadId': parent,
                            'archived': False, 'useStateDbOnly': True, 'limit': 100})['data']
                        assert [row['id'] for row in attached] == [child], attached
                    finally:
                        client.close()
                    assert (home / 'config.toml').read_bytes() == original_config
                    assert not (home / 'auth.json').exists()
                    assert not requests, 'A model turn was started'
                finally:
                    fixture.close()
                assert not (runtime.directory(home) / 'active.json').exists(), 'Writer receipt was not cleaned'
                assert not runtime.runtime_alive(original_runtime), 'Fixture runtime remained alive'
                print(json.dumps({'packagedAdapter': gateway is not None,
                                  'separateWriterCollisionReproduced': True, 'attachedChildCount': 1,
                                  'parentHistoryAndRuntimePreserved': True, 'bridgeReconnectVerified': True,
                                  'modelRequests': len(requests), 'normalEofCleanupVerified': True}))
    finally:
        server.shutdown(); server.server_close()


if __name__ == '__main__':
    main()
