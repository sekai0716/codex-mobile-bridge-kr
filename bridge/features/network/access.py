"""Fixed-domain setup files and validation; never installs or configures a server."""
import http.client
import ipaddress
import json
import re
import shlex
import socket
import ssl
from urllib.parse import urlsplit

from bridge.features.auth.tls import client_context
from bridge.api.validation import FieldError, at_field


DEFAULTS = {'accessMode': 'lan', 'publicUrl': '', 'proxyUpstream': '',
            'sshTarget': '', 'sshRemotePort': 18787, 'sshAuth': 'config',
            'sshHost': '', 'sshPort': 22, 'sshUser': '', 'sshKeyPath': '',
            'tailscaleMode': 'funnel', 'tailscalePort': 443, 'tailscaleNodeId': ''}


def origin(value, scheme='https'):
    if not isinstance(value, str) or any(c.isspace() for c in value):
        raise ValueError("주소에는 공백이 포함될 수 없습니다.")
    parsed = urlsplit(value)
    if (parsed.scheme != scheme or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in ('', '/') or '?' in value or '#' in value):
        raise ValueError(f'완전하게 채워주세요 {scheme.upper()} 경로, 계정 또는 매개변수가 없는 주소')
    try:
        port = parsed.port
    except ValueError:
        raise ValueError("잘못된 주소 포트") from None
    if parsed.netloc.endswith(':'):
        raise ValueError("잘못된 주소 포트")
    host = parsed.hostname
    try:
        ipaddress.ip_address(host)
        if '%' in host:
            raise ValueError("IPv6 영역 식별자는 지원되지 않습니다.")
    except ValueError:
        if not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?', host):
            raise ValueError("도메인 또는 IP 주소를 사용하세요. Punycode에 국제화된 도메인을 입력하세요")
    if port is not None and not 1 <= port <= 65535:
        raise ValueError("잘못된 주소 포트")
    authority = '['+host+']' if ':' in host else host
    if port is not None and port != (443 if scheme == 'https' else 80):
        authority += ':'+str(port)
    return f'{scheme}://{authority.lower()}'


def server_ip_url(preferences):
    """Use a literal public SSH address; never guess an IP from DNS or SSH aliases."""
    from bridge.features.network.server_connection import endpoint
    host = endpoint(preferences)['host']
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        raise FieldError("전화기 URL가 비어 있으면 SSH 서버 주소(또는 별칭 HostName)를 공개 IP로 설정합니다. 도메인의 경우 전체 HTTPS URL를 입력합니다.", 'publicUrl') from None
    if not address.is_global or address.is_multicast or address.is_reserved or '%' in host:
        raise FieldError("빈 전화기 URL에는 개인, 루프백 또는 특수 용도 주소가 아닌 공개 IP가 필요합니다.", 'publicUrl')
    authority = f'[{address.compressed}]' if address.version == 6 else str(address)
    return 'https://' + authority


def validate(preferences):
    p = {**DEFAULTS, **preferences}
    if p['accessMode'] not in ('lan', 'quick', 'cloudflare', 'server', 'nas', 'tailscale', 'external'):
        raise FieldError("유효한 외부 연결 유형을 선택하세요", 'connection-kind')
    if p['publicUrl']:
        p['publicUrl'] = at_field('publicUrl', origin, p['publicUrl'])
    if p['proxyUpstream']:
        p['proxyUpstream'] = at_field('proxyUpstream', origin, p['proxyUpstream'], 'http')
    if p['accessMode'] == 'tailscale':
        if p['tailscaleMode'] not in ('funnel', 'serve'):
            raise FieldError("유효한 Tailscale 액세스 범위를 선택하세요.", 'tailscaleMode')
        if type(p['tailscalePort']) is not int or p['tailscalePort'] not in (443, 8443, 10000):
            raise FieldError("Tailscale HTTPS 포트는 443, 8443 또는 10000이어야 합니다.", 'tailscalePort')
        if not isinstance(p['tailscaleNodeId'], str) or not re.fullmatch(r'[A-Za-z0-9_-]{0,128}', p['tailscaleNodeId']):
            raise FieldError("Tailscale 장치 ID가 잘못되었습니다. 다시 감지합니다.", 'publicUrl')
        if p['publicUrl']:
            parsed = urlsplit(p['publicUrl'])
            if (not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ts\.net', parsed.hostname)
                    or (parsed.port or 443) != p['tailscalePort']):
                raise FieldError("감지를 사용하여 이 컴퓨터의 Tailscale 주소를 읽으십시오.", 'publicUrl')
    if (not isinstance(p['sshTarget'], str) or len(p['sshTarget']) > 253
            or (p['sshTarget'] and not re.fullmatch(r'[\w][\w.@-]*', p['sshTarget']))):
        raise FieldError("공백이나 명령 옵션 없이 기존 SSH 호스트 별칭 또는 user@hostname을 입력하세요.", 'sshTarget')
    port = p['sshRemotePort']
    if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
        raise FieldError("서버 루프백 포트는 1024–65535여야 합니다.", 'sshRemotePort')
    if p['accessMode'] in ('nas', 'cloudflare', 'external') and not p['publicUrl']:
        raise FieldError("휴대전화에서 사용하는 고정 HTTPS URL를 입력하세요.", 'publicUrl')
    if p['accessMode'] == 'server':
        if p['sshAuth'] == 'config' and not p['sshTarget']:
            raise FieldError("서버의 SSH 대상을 입력하세요.", 'sshTarget')
    if p['accessMode'] == 'nas':
        if not p['lan'] or not p['proxyUpstream']:
            raise FieldError("NAS 액세스에는 LAN 청취 및 컴퓨터의 HTTP 주소가 필요합니다.", 'proxyUpstream')
        parsed = urlsplit(p['proxyUpstream'])
        if (parsed.port or 80) != p['port']:
            raise FieldError("업스트림 포트는 게이트웨이 수신 포트와 일치해야 합니다.", 'proxyUpstream')
        if parsed.hostname in ('localhost', '127.0.0.1', '::1'):
            raise FieldError("루프백 주소가 아닌 컴퓨터의 LAN 주소를 NAS 업스트림으로 사용합니다.", 'proxyUpstream')
    if p['sshAuth'] not in ('config', 'password', 'key', 'agent'):
        raise FieldError('선택해주세요 SSH 인증방법', 'sshAuth')
    if isinstance(p['sshPort'], bool) or not isinstance(p['sshPort'], int) or not 1 <= p['sshPort'] <= 65535:
        raise FieldError('SSH 포트는 다음과 같아야 합니다. 1–65535', 'sshPort')
    for key in ('sshHost', 'sshUser', 'sshKeyPath'):
        if not isinstance(p[key], str) or len(p[key]) > 4096 or any(c in p[key] for c in ('\x00', '\n', '\r')):
            raise FieldError('SSH 구성 형식이 잘못되었습니다.', key)
    if p['accessMode'] == 'server' and p['sshAuth'] != 'config':
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]*', p['sshHost']):
            raise FieldError('서버를 채워주세요 IP 또는 프로토콜이나 경로가 없는 호스트 이름', 'sshHost')
        if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', p['sshUser']):
            raise FieldError('올바른 내용을 입력하세요. SSH 사용자 이름', 'sshUser')
        if p['sshAuth'] == 'key' and not p['sshKeyPath']:
            raise FieldError('지역을 선택해주세요 SSH 개인 키 파일', 'sshKeyPath')
    if p['accessMode'] == 'server' and not p['publicUrl']:
        p['publicUrl'] = server_ip_url(p)
    if p['accessMode'] == 'cloudflare' and urlsplit(p['publicUrl']).port not in (None, 443):
        raise FieldError('Cloudflare 고정 터널의 경우 표준을 사용하십시오. HTTPS 도메인 이름', 'publicUrl')
    p['tunnel'] = p['accessMode'] == 'quick'
    return p


def connections(preferences):
    """Migrate the previous single-entry preferences without changing saved files."""
    if 'connections' in preferences:
        return preferences['connections']
    mode = preferences.get('accessMode', 'quick' if preferences.get('tunnel') else 'lan')
    if mode == 'lan':
        return []
    return [{**DEFAULTS, **{k: preferences[k] for k in DEFAULTS if k in preferences},
             'id': 'legacy-'+mode, 'name': '', 'enabled': True, 'accessMode': mode}]


def validate_connections(preferences):
    rows = connections(preferences)
    if not isinstance(rows, list):
        raise ValueError("연결은 목록이어야 합니다.")
    result, ids, urls, forwards = [], set(), set(), set()
    quick = tailscale = False
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', row['id']):
            raise ValueError("잘못된 연결 ID")
        if row['id'] in ids:
            raise ValueError("중복 연결 ID")
        ids.add(row['id'])
        if not isinstance(row.get('enabled'), bool) or row.get('accessMode') not in ('quick', 'cloudflare', 'server', 'nas', 'tailscale', 'external'):
            raise ValueError("잘못된 연결 유형 또는 스위치")
        if not isinstance(row.get('name', ''), str) or len(row.get('name', '')) > 100:
            raise FieldError("연결 이름은 최대 100자까지 포함할 수 있습니다.", 'name', row['id'])
        current = {**DEFAULTS, **{k: row[k] for k in DEFAULTS if k in row},
                   'id': row['id'], 'name': row.get('name', '').strip(), 'enabled': row['enabled']}
        for key in ('publicUrl', 'sshTarget', 'proxyUpstream'):
            if isinstance(current[key], str):
                current[key] = current[key].strip()
        if current['enabled']:
            try:
                checked = validate({**current, 'lan': preferences.get('lan', False), 'port': preferences.get('port', 8787)})
            except FieldError as exc:
                exc.validation['connectionId'] = row['id']
                raise
            for key in DEFAULTS:
                current[key] = checked[key]
            if current['accessMode'] == 'quick':
                if quick:
                    raise FieldError("게이트웨이당 하나의 임시 Cloudflare 항목만 필요합니다. 다른 연결 유형을 동시에 활성화할 수 있습니다.", 'enabled', row['id'])
                quick = True
            elif current['publicUrl']:
                if current['publicUrl'] in urls:
                    raise FieldError("활성화된 연결은 다른 HTTPS 주소를 사용해야 합니다.", 'publicUrl', row['id'])
                urls.add(current['publicUrl'])
            if current['accessMode'] == 'tailscale':
                if tailscale:
                    raise FieldError("게이트웨이당 하나의 Tailscale 항목만 활성화합니다.", 'enabled', row['id'])
                tailscale = True
            if current['accessMode'] == 'server':
                forward = (current['sshTarget'] if current['sshAuth'] == 'config' else (current['sshHost'], current['sshPort']), current['sshRemotePort'])
                if forward in forwards:
                    raise FieldError("동일한 SSH 대상에 대한 각 연결에는 서로 다른 루프백 포트가 필요합니다.", 'sshRemotePort', row['id'])
                forwards.add(forward)
        result.append(current)
    return result


def public_urls(preferences):
    return [c['publicUrl'] for c in connections(preferences)
            if c['enabled'] and c['accessMode'] in ('server', 'nas', 'cloudflare', 'tailscale', 'external') and c['publicUrl']]


def phone_urls(preferences, hosts, quick_url=''):
    """데스크톱 개요와 페어링된 휴대폰에서 사용할 접속 주소를 순서대로 반환한다."""
    fixed = [url.rstrip('/') for url in public_urls(preferences)]
    local = [f'http://{host}:{preferences["port"]}' for host in hosts if host != 'localhost']
    return list(dict.fromkeys(fixed + ([quick_url.rstrip('/')] if quick_url else []) + local))


def public_url(preferences):
    return next(iter(public_urls(preferences)), '')


def select_connection(preferences, value, allow_disabled=False):
    selected = next((c for c in connections(preferences) if c['id'] == value.get('id')), None)
    if not selected or (not selected['enabled'] and not allow_disabled) or selected['accessMode'] not in ('server', 'nas', 'cloudflare', 'tailscale', 'external'):
        raise ValueError("이 작업을 사용하기 전에 고정 연결을 저장하고 활성화하세요.")
    return validate({**selected, 'lan': preferences['lan'], 'port': preferences['port']})


def deployment(preferences):
    p = validate(preferences)
    if p['accessMode'] == 'cloudflare':
        raise ValueError('결정된 Cloudflare 터널을 만들어주세요 Cloudflare 공개 호스트 이름을 구성하고 App 저장 Tunnel Token。')
    if p['accessMode'] not in ('server', 'nas'):
        raise ValueError('자체 서버 또는 NAS 설정을 먼저 선택해 저장하세요.')
    ssh_example = shlex.join(['ssh', p['sshTarget']] if p['sshAuth'] == 'config' else ['ssh', '-p', str(p['sshPort']), p['sshUser']+'@'+p['sshHost']])
    url = p['publicUrl']
    https_port = urlsplit(url).port or 443
    try:
        ipaddress.ip_address(urlsplit(url).hostname)
        ip_entry = True
    except ValueError:
        ip_entry = False
    upstream = f'http://127.0.0.1:{p["sshRemotePort"]}' if p['accessMode'] == 'server' else p['proxyUpstream']
    common = f'''# Codex 모바일 게이트웨이 · 고정 항목 배포

모바일 주소：{url}/
컴퓨터 게이트웨이 포트：{p['port']}（원래 값 유지）
반세대 업스트림：{upstream}

컴퓨터, 게이트웨이 및 원본 Codex App 지속적으로 실행해야 함。Docker 배포만 HTTPS 입구。
이 패키지에는 계정 비밀번호가 포함되어 있지 않습니다.、Token、Codex 데이터 또는 SSH 개인 키。
컴퓨터의 게이트웨이 로그인 비밀번호 App 의“최초 로그인 자격 증명 보기”사용자가 획득하거나 설정함。
도메인 이름은 서버를 가리켜야 합니다./NAS，휴대폰은 지원되지 않는 독립적인 하위 도메인 루트 경로를 사용합니다. /codex/ 하위 경로。
로그인 시 계정 비밀번호를 사용하는 것을 권장합니다. 컴퓨터 포트를 공용 네트워크에 직접 매핑하지 마세요.。

'''
    if p['accessMode'] == 'server':
        files = {
            'compose.yaml': '''services:
  codex-https:
    image: caddy:2-alpine
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
volumes:
  caddy_data:
  caddy_config:
''',
            'Caddyfile': f'''{url} {{
    reverse_proxy {upstream} {{
        header_up Host {{http.request.host}}
        flush_interval -1
    }}
}}
'''}
        steps = f'''## 소유하다 Linux 서버（수동 구성 참조）

소프트웨어 설치, 방화벽 구성 및 SSH 권한, 시작 Docker 기타 작업은 사용자 또는 관리자가 직접 단말기에서 완료합니다.。App 수락하지 않음 sudo 비밀번호, 원격 명령을 실행하지 마세요. 기존 역방향 프록시에 대한 액세스 우선순위를 지정합니다. 다음 Docker 선택적 참조로 구성。

1. 사용 가능 `{ssh_example}` 서버 연결도 확인하세요. App 내부용“조사하다 SSH 로그인”。첫 번째 연결에서는 호스트 지문을 확인해야 합니다. 비밀번호, 개인 키 또는 SSH Agent 에서 App 구성, 자격 증명은 이 배포 패키지에 포함되지 않습니다.。
2. 서버는 원격 포트 전달을 허용해야 합니다.（AllowTcpForwarding remote 또는 yes），GatewayPorts 사용 no 또는 clientspecified。루프백 포트 {p['sshRemotePort']} 무료여야 합니다. 사용하지 마십시오 GatewayPorts yes，공용 네트워크에 강제로 바인딩되지 않도록 하려면。
3. 도메인 이름 DNS 의 A/AAAA 레코드는 이 서버를 가리킵니다. 이 패키지의 압축을 새 디렉터리에 푼다. 서버를 설치해야 합니다 Docker Compose，그리고 공용 네트워크 HTTPS TCP {https_port} 접근 가능하고 무료입니다. 인증서 확인에 필요 TCP 80、443 또한 접근이 가능해야 합니다. 기존 웹사이트가 이러한 포트를 점유하는 경우 기존 안티 생성을 사용하고 업스트림을 다음으로 설정합니다. {upstream} 그리고 공용 네트워크를 유지하세요. Host 그게 다야。
4. 컴퓨터에서 App 구성을 저장하고 게이트웨이를 시작합니다. 컴퓨터가 자동으로 생성합니다. SSH 백홀 연결에서는 서버가 컴퓨터 LAN에 직접 액세스할 필요가 없습니다. IP。
5. 서버 압축해제 디렉터리에서 실행：

```sh
docker compose config
docker compose up -d
docker compose logs --tail=50
```

Caddy 자동 신청 및 갱신 HTTPS 인증서, 인증서는 다음 위치에 저장됩니다. Docker 용량. 이 패키지의 host 네트워크 전용 Linux Docker Engine；SSH 앞으로 그리고 Caddy 동일한 호스트에 있어야 합니다. 여기 있지 마세요 Mac/Windows 의 Docker Desktop 이 서버 패키지 실행。
'''
    else:
        files = {
            'compose.yaml': '''services:
  codex-entry:
    image: nginx:stable-alpine
    restart: unless-stopped
    ports:
      - "${BIND_ADDRESS:-127.0.0.1}:18787:8080"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
''',
            'nginx.conf': f'''server {{
    listen 8080;
    server_name _;
    client_max_body_size 512000;
    access_log off;
    location / {{
        proxy_pass {upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }}
}}
''',
            '.env.example': '# 외부 프록시가 NAS 호스트에서 실행된다면 기본값을 유지합니다. 프록시도 컨테이너라면 NAS의 LAN IP를 입력하고 해당 프록시만 접근하도록 제한하세요.\nBIND_ADDRESS=127.0.0.1\n'}
        steps = f'''## NAS / 기존 HTTPS 역방향 프록시

1. 컴퓨터에서 NAS가 연결할 LAN 수신 주소를 활성화하고, NAS에서 {upstream}에 TCP 연결할 수 있는지 확인합니다. NAS가 컴퓨터 네트워크에 직접 접근할 수 없다면 앱의 "자체 서버 + SSH" 방식을 사용하거나 먼저 VPN 경로를 구성하세요.
2. Synology, QNAP 또는 Nginx Proxy Manager에서 HTTPS 역방향 프록시를 만듭니다. 외부 주소는 {url}, upstream은 {upstream}입니다. 기존 인증서를 사용하고 Host, Origin, Cookie, X-CSRF-Token 헤더를 유지합니다. 캐시와 버퍼링을 끄고 읽기·쓰기 시간 제한을 300초로 설정합니다. 프록시 뒤에서 클라이언트 IP 액세스 규칙을 적용하려면 컴퓨터 게이트웨이의 신뢰할 프록시 목록에 실제 NAS 프록시의 IP만 등록하세요.
3. HTTP 중계를 Docker로 관리하려면 이 패키지를 NAS의 새 디렉터리에 풀고 실행합니다.

```sh
docker compose config
docker compose up -d
docker compose logs --tail=50
```

이후 NAS의 HTTPS 역방향 프록시 upstream을 http://127.0.0.1:18787로 설정합니다. 모든 프록시 계층에서 외부 Host 헤더를 유지해야 합니다. 외부 프록시도 컨테이너에서 실행된다면 .env.example을 .env로 복사하고 BIND_ADDRESS에 NAS의 LAN IP를 입력합니다. 외부 프록시의 upstream도 해당 IP:18787로 설정합니다. 이 포트에는 해당 프록시만 접근하도록 제한하고 인터넷에 포워딩하지 마세요.
4. Docker 컨테이너는 HTTP 중계만 제공합니다. 인증서와 공개 443 포트는 NAS의 역방향 프록시가 처리합니다. HTTPS 경로가 준비되지 않았다면 별도의 Linux 서버 방식을 사용할 수 있습니다.
'''
    files['배포 지침.md'] = common + steps + f'''
## 승인 및 유지 관리

컴퓨터 App 딸깍 하는 소리“고정된 출입구 감지”，그러다 전화가 꺼지는데 Wi-Fi，셀룰러 네트워크로 열기 {url}/，로그인, 채팅 동기화 및 ntfy 도약. 테스트에서는 이 컴퓨터에 HTTPS 접속은 현재 게이트웨이로 이루어지며 휴대폰 외부 네트워크 테스트를 대체하지 않습니다.。
502/504：안티 세대 업스트림을 확인하거나 SSH 터널；403：각 레이어의 보존 여부를 확인하세요. Host，그리고 구성을 저장한 후 컴퓨터를 다시 시작할지 여부; 인증서 오류: 확인 DNS、80/443 및 인증서 로그。
시작하다/컨테이너 업데이트：docker compose up -d；통나무：docker compose logs --tail=50；입구를 막다：docker compose down（인증서 볼륨을 삭제하지 말고 컴퓨터 게이트웨이를 중지하지 마십시오.）。

## 배포하다 Agent

프로젝트：https://github.com/try2love/codex-mobile-bridge
사용자가 승인한 서버만 사용/NAS；기존 사이트, 포트 및 DNS，기존 서비스를 덮어쓰는 것은 금지되어 있습니다. 배포 종속성이 누락된 경우 먼저 설명하세요. 복사하지 마세요 Codex 자격 증명 또는 개인 키는 컴퓨터 게이트웨이 포트를 변경하지 마십시오. 완료되면 고정으로 돌아가기 HTTPS 주소, 원래 LAN 주소, 비밀번호 획득 방법, 배포 디렉터리, 시작 및 중지 명령, 통과 및 실패 수락 항목. 허가가 없거나 실제 진입이 없다면 아직 배치되지 않았으며 연결을 주장하지 않는다는 의미입니다.。
'''
    if p['accessMode'] == 'server':
        english_steps = f'''All server software installation, firewall and SSH permission changes, and Docker operations must be performed manually by the user or administrator. The app does not accept sudo passwords or execute remote commands. Prefer an existing reverse proxy; Docker is an optional reference.

1. Check `{ssh_example}` from your computer, or use Check SSH sign-in in the App. Verify the host fingerprint. Configure password, key or agent authentication in the App; credentials are not included in this package.
2. The server must allow remote forwarding (`AllowTcpForwarding remote` or `yes`). Keep `GatewayPorts no` or `clientspecified`, never `yes`. Port {p['sshRemotePort']} must be free and restricted to loopback.
3. Point the domain's A/AAAA records to this server. Have the user or administrator manually install Docker Compose if needed and ensure HTTPS TCP {https_port} is reachable and free, with TCP 80/443 available for certificate validation. Extract this bundle into a new directory. The Caddy service uses host networking on Linux Docker Engine, on the same host as SSH; do not run this bundle on Mac/Windows Docker Desktop.
4. Start the computer gateway. It connects out to the server over SSH, including behind NAT or on a campus network.
5. On the server run `docker compose config`, then `docker compose up -d`. Caddy obtains and renews certificates, persisted in the named Docker volumes. If an existing proxy already owns 80/443, keep it and use {upstream} as its upstream, preserving the public Host header; do not start another Caddy instance.
'''
    else:
        english_steps = f'''1. From the NAS, verify that {upstream}/ is reachable. It must be the computer's address, not the NAS loopback address. A home NAS cannot directly reach an isolated campus computer without a working network route; use the SSH server option or an existing VPN route in that case.
2. Prefer an existing NAS HTTPS reverse proxy directly to {upstream}. Preserve Host, Origin, Cookie and X-CSRF-Token. Disable caching/buffering and use 300-second read/send timeouts.
3. To manage an optional HTTP intermediary in Docker, extract this bundle and run `docker compose config`, then `docker compose up -d`. Set the NAS HTTPS proxy's upstream to http://127.0.0.1:18787. The container does not issue certificates: the existing NAS proxy handles HTTPS.
4. If the outer proxy is also containerized, copy .env.example to .env and set BIND_ADDRESS to the NAS LAN IP. Point the outer proxy there, restrict access to that proxy, and do not expose port 18787 publicly.
'''
    files['DEPLOYMENT_EN.md'] = f'''# Codex Mobile Bridge — fixed entry deployment

Phone URL: {url}/
Computer gateway port: {p['port']} (keep unchanged)
Proxy upstream: {upstream}

Keep the computer, gateway and original Codex App running. Docker hosts the access entry; it does not replace the desktop App. This ZIP contains no passwords, tokens, Codex data or SSH keys. Obtain gateway credentials from the computer App or the user's configured login. Use a dedicated domain root, not a subpath such as /codex/.

## Setup

{english_steps}
## Verification and maintenance

Click Check fixed entry in the desktop App, then disable phone Wi-Fi and verify HTTPS login, chat synchronization and ntfy links over mobile data. The built-in check verifies the current gateway instance from this computer only. A 502/504 suggests an unreachable upstream or SSH forwarding failure; a 403 suggests the public Host is not preserved or the gateway needs a restart after saving its allowlist. Check DNS and Caddy logs for certificate failures.

Start/update: `docker compose up -d`. Logs: `docker compose logs --tail=50`. Stop the public entry: `docker compose down` (keep certificate volumes; the computer gateway stays running).

## Instructions for deployment Agents

Project: https://github.com/try2love/codex-mobile-bridge
Use only authorized servers or NAS devices. Check existing sites, DNS and ports before deploying; do not overwrite existing services. Explain missing dependencies before installing them. Keep the computer gateway port, model authentication and SSH keys unchanged. Return the fixed HTTPS URL, original LAN URL, credential retrieval method, deployment directory, start/stop commands, verified results and remaining checks. If access is unavailable, deliver the prepared configuration and clearly say deployment is pending.
'''
    if p['accessMode'] == 'server':
        files['배포 지침.md'] = files['배포 지침.md'].split('## 배포하다 Agent')[0] + '''## 수동으로 경계 구성

이 내용은 사용자 검사 및 수동 구성에만 해당되며 자동 배포 지침이 아닙니다. 관리자 권한과 관련된 명령은 사용자가 직접 실행해야 합니다. 허용하지 않는다 App 또는 배포 Agent 대리 운송 sudo 비밀번호를 설정하거나 서비스를 설치하거나 시스템 권한을 수정하세요. 기존 사이트 유지、Codex 신임장、SSH 개인 키 및 컴퓨터 게이트웨이 포트。
'''
        files['DEPLOYMENT_EN.md'] = files['DEPLOYMENT_EN.md'].split('## Instructions for deployment Agents')[0] + '''## Manual setup boundary

This is a reference for user review and manual setup, not an automatic deployment instruction. Administrative commands must be executed by the user. Do not ask the app or an Agent to enter sudo passwords, install services or change system permissions. Preserve existing sites, Codex credentials, SSH keys and the computer gateway port.
'''
        if ip_entry:
            files['Caddyfile'] = files['Caddyfile'].replace(
                f'{url} {{\n', f'{url} {{\n    tls /etc/caddy/tls/fullchain.pem /etc/caddy/tls/privkey.pem\n')
            files['compose.yaml'] = files['compose.yaml'].replace(
                '      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n',
                '      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n      - ./tls:/etc/caddy/tls:ro\n')
            files['배포 지침.md'] = f'''# 공용 네트워크 IP HTTPS 입력（수동 구성 참조）

모바일 주소：{url}/
역방향 프록시 업스트림：{upstream}

도메인 이름을 구성할 필요가 없습니다. DNS。서버는 휴대폰, 컴퓨터 등이 신뢰할 수 있는 서버를 제공해야 하며, Subject Alternative Name 공용 네트워크 포함 IP 유효한 인증서 도메인 이름 인증서와 신뢰할 수 없는 자체 서명 인증서는 대체할 수 없습니다. IP 자격증。App 인증서를 신청하거나, 인증을 건너뛰거나, 인증서를 다운그레이드하지 마세요. HTTP。

1. 기존 서버의 재사용 우선순위 HTTPS 역방향 프록시, 위의 내용을 변환합니다. IP 입구는 다음으로 전달됩니다 {upstream}，예약하다 Host，캐싱 및 응답 버퍼링 끄기。
2. 이 패키지를 사용하는 경우 선택사항 Caddy 관리자가 전체 인증서 체인과 개인 키를 서버에 배치하는 예 tls/fullchain.pem 및 tls/privkey.pem（（이 패키지에는 제공되지 않음） 개인 키 권한을 제한하고 인증서 갱신을 담당합니다. 개인 키를 게이트웨이로 다시 전송하거나 코드 저장소에 제출하지 마십시오.。
3. 서버 공용 네트워크 TCP {https_port} 접근 가능해야 함。SSH 원격 전달을 허용해야 하며 유지해야 합니다. GatewayPorts no，{p['sshRemotePort']} 듣기만 127.0.0.1，공용 네트워크에 공개되지 않음。Docker 예시는 동일한 경우에만 적용됩니다. SSH 서버에서 Linux Docker Engine；기존 서비스가 포트를 점유하는 경우 기존 역생성을 사용합니다.。
4. 컴퓨터 구성 저장, 확인 SSH 게이트웨이를 시작하기 전에 로그인하고 지문을 확인하세요. 사용하는 경우 Docker 예, 서버에서 실행됨 docker compose config 관리자가 확인 후 실행합니다. docker compose up -d。
5. 딸깍 하는 소리“고정된 출입구 감지”，그런 다음 휴대폰 셀룰러 네트워크를 사용하여 테스트합니다. 인증서가 잘못된 경우 인증서 수정，502 정기적으로 확인하세요 SSH 터널；SSH 로그인 성공이 의미하는 것은 아닙니다. HTTPS 입장 가능。

관리자 권한이 있는 명령은 사용자가 직접 실행해야 합니다.。App 서버 구성을 수정하거나 서비스를 설치하거나 수신하지 마십시오. sudo 비밀번호. 이 패키지에는 자격 증명이 포함되어 있지 않으며 기존 서비스 및 컴퓨터 게이트웨이 포트를 유지합니다. {p['port']}。
'''
            files['DEPLOYMENT_EN.md'] = f'''# Public IP HTTPS entry (manual reference)

Phone URL: {url}/
Proxy upstream: {upstream}

No domain DNS record is needed. Provision a valid certificate trusted by the phone and computer with this public IP in its Subject Alternative Name. A domain-only certificate or untrusted self-signed certificate is insufficient. The app does not issue certificates, bypass verification or fall back to HTTP.

1. Prefer an existing HTTPS reverse proxy. Forward this IP entry to {upstream}, preserve Host and disable caching and response buffering.
2. For the optional Caddy example, place the full certificate chain and private key on the server at tls/fullchain.pem and tls/privkey.pem. They are not included. Restrict key permissions and arrange renewal. Never send the private key to the gateway or commit it.
3. Make public TCP {https_port} reachable. Allow SSH remote forwarding with GatewayPorts no and restrict port {p['sshRemotePort']} to 127.0.0.1. The Docker example requires Linux Docker Engine on the SSH server; do not start another proxy over existing listeners.
4. Save the computer configuration, check SSH sign-in and the host fingerprint, then start the gateway. For the Docker example, validate with docker compose config before the administrator runs docker compose up -d.
5. Check the fixed entry, then test on phone cellular data. Fix certificate errors at the server; for 502 check the SSH tunnel. Successful SSH authentication alone does not prove HTTPS access.

Administrative commands must be executed by the user. The app does not configure the server, install services or accept sudo passwords. This bundle contains no credentials. Preserve existing services and computer gateway port {p['port']}.
'''
    return files


def read_auth(url):
    parsed = urlsplit(url)
    if parsed.scheme == 'https':
        connection = http.client.HTTPSConnection(parsed.hostname, parsed.port, timeout=8, context=client_context())
    else:
        connection = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=8)
    try:
        connection.request('GET', '/api/auth', headers={'Cache-Control': 'no-cache'})
        response = connection.getresponse()
        if 300 <= response.status < 400:
            raise ValueError(f'입장 반환 HTTP {response.status} 리디렉션; 게이트웨이를 직접 입력해주세요 HTTPS 루트 주소')
        if response.status != 200:
            raise ValueError(f'입장 반환 HTTP {response.status}；안티 세대 업스트림 확인、Host 및 HTTPS 설정')
        try:
            value = json.loads(response.read(65536))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("항목이 게이트웨이 응답을 반환하지 않았습니다. 프록시 대상 확인") from None
        if not isinstance(value, dict):
            raise ValueError("항목이 게이트웨이 응답을 반환하지 않았습니다. 프록시 대상 확인")
        return value
    finally:
        connection.close()


def check_entry(preferences, instance_id=None):
    url = public_url(preferences)
    if not url:
        raise ValueError("고정된 HTTPS 항목을 먼저 저장하세요.")
    if instance_id is None:
        instance_id = read_auth(f'http://127.0.0.1:{preferences["port"]}').get('instanceId')
    try:
        remote = read_auth(url)
    except ssl.SSLError:
        raise ValueError('HTTPS 인증서 또는 TLS 핸드셰이크가 실패했습니다. 도메인 이름, 인증서 및 역방향 프록시 구성을 확인하세요.') from None
    except (socket.gaierror, TimeoutError, ConnectionError, OSError, http.client.HTTPException):
        raise ValueError('고정 HTTPS 접속 주소에 연결할 수 없습니다. 도메인 이름과 네트워크를 확인하고 역방향 프록시가 실행 중인지 확인하세요.') from None
    if not instance_id or remote.get('instanceId') != instance_id:
        raise ValueError("이 항목은 현재 게이트웨이에 도달하지 않습니다. 프록시 대상을 확인하십시오. 먼저 이전 게이트웨이를 업데이트하고 다시 시작하세요.")
    return {'message': "고정된 HTTPS 항목은 현재 게이트웨이에 도달합니다. 모바일 데이터를 사용하여 휴대폰에서 로그인 및 채팅을 확인하세요.", 'url': url}
