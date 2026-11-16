# 침투가 있었네요 / 역방향 프록시 액세스（v2.1.0）

이 방법은 자체 구성에 적합합니다. SakuraFrp、다른 HTTPS 서비스에 침투하거나 실행 중**로컬 머신**의 HTTPS 역방향 프록시。Bridge 휴대폰으로 접속한 공용 주소만 저장됩니다. 침투 클라이언트, 도메인 이름, 인증서 및 프록시는 원래 서비스에서 귀하가 관리합니다. 이 연결 옵션은 이미 있습니다. [v2.1.0 공식 버전](https://github.com/try2love/codex-mobile-bridge/releases/tag/v2.1.0)에서 제공。

1. 침투 또는 대리 서비스에는 HTTP 업스트림이 실행으로 설정되어 있습니다. Bridge 예를 들어 이 컴퓨터의 루프백 주소입니다. `http://127.0.0.1:8787`。`8787` 예시일 뿐이며 데스크톱을 사용하세요. App 현재 표시된**실제 게이트웨이 포트**。서비스가 컨테이너에서 실행되는 경우 `127.0.0.1` 반드시 컴퓨터를 가리킬 필요는 없습니다. 먼저 네트워크 경로를 확인하십시오. 이러한 유형의 교차 장치 프록시는 다음을 사용해야 합니다. NAS 고급 방법。
2. 공용 입구가 유효하고 컴퓨터와 휴대폰 모두에서 신뢰할 수 있는지 확인하세요. HTTPS 자격증. 모바일 주소는 완전해야 합니다. HTTPS 예를 들어 루트 주소 `https://bridge.example.com` 또는 `https://bridge.example.com:8443`。홍보를 허용하지 않음 HTTP、`/codex/` 하위 경로, 계정, 쿼리 매개변수 또는 리디렉션 대상을 기다립니다. 닫지 마세요 TLS 인증서 확인。
3. 데스크톱에서 App 의“네트워크 접속 → 연결 추가”선택하다“침투가 있었네요 / 역방향 프록시”，휴대폰 주소를 입력하고 저장한 후 게이트웨이를 시작하세요. 이 모드는 LAN 액세스와 로컬 웹 페이지 액세스를 동시에 끌 수 있습니다.；Bridge 아직 구성만 되어 있음 HTTPS Ingress는 기본 루프백 업스트림을 유지합니다.。
4. 에서 App 가운데 클릭“고정된 출입구 감지”。컴퓨터에서 저장된 항목으로 확인이 이루어집니다. HTTPS 자격 증명 없이 주소 요청 `/api/auth`，인증서와 현재 게이트웨이 인스턴스를 확인하고 리디렉션을 따르지 마세요. 검사가 성공적으로 완료되면 카드의 이전 오류가 성공적인 결과로 대체됩니다. 항목 주소가 수정되면 이전 테스트 결과가 무효화됩니다. 그런 다음 휴대폰의 셀룰러 네트워크를 사용하여 로그인, 채팅 읽기, 전송 및 파일 액세스를 테스트합니다. QR코드를 스캔하여 로그인하시면 해당 주소가 실제로 현재 게이트웨이에 연결된 경우에만 발급됩니다.。

대리인은 반드시**원래 대중 Host（비표준 포트 포함）**、Origin、Cookie 및 `X-CSRF-Token` 게이트웨이로 전달。Nginx 사용 가능 `$http_host` 예약하다 `:8443`；`$host` 포트가 손실될 수 있습니다. 업스트림에 넣지 마세요 Host 다음으로 변경 `127.0.0.1`；게이트웨이는 공개됩니다. Host 및 Origin 요청을 확인하세요. 애플리케이션에 필요한 긴 요청, 스트리밍 응답 및 업로드를 허용하려면 프록시 캐싱 및 응답 버퍼링을 끄십시오./다운로드 크기。Bridge 주로 사용됨 HTTP 긴 폴링 또는 SSE；대리인이 지원하는 경우 WebSocket，업그레이드 요청도 유지되어야 하지만 사용할 수 없음 WebSocket 대체 스트리밍 응답 및 요청 본문 제한 확인을 지원합니다. 첨부 파일 및 대용량 파일은 여전히 ​​외부 서비스의 자체 업로드 제한, 유휴 시간 제한 및 대역폭에 의해 제한될 수 있습니다.。

안티 세대가 다른 곳에서 실행중인 경우 NAS / 서버에서 컴퓨터의 LAN 주소를 통해 게이트웨이에 액세스하고 동일한 연결 카드에서 확장됩니다. **고급: 대상 위치**，할 것이다“침투 또는 역방향 프록시는 다음에서 실행됩니다.”다음으로 선택됨 **NAS 아니면 다른 장치**：LAN 액세스를 열어두고 채우십시오. NAS 접근 가능한 컴퓨터 HTTP 업스트림, 포트는 게이트웨이와 일치해야 하며 채워질 수 없습니다. NAS 자신의 루프백 주소. 세부정보 보기 [NAS 설정](../deploy/nas/README.md)。공용 네트워크 주소만 있고 컴퓨터에 대한 업스트림 경로가 없어 여전히 연결할 수 없습니다.。

대화형 양식 참조 [DSH Remote Web UI 의 `publicBaseUrl` 설정](https://github.com/DamonKoy/dsh-web-ui/blob/main/packages/dsh-remote-web-ui/README.md)；Bridge 소스 코드를 재사용하지 않고 자체 연결 구성 및 보안 검증을 독립적으로 구현했습니다.。

### 나타나다“이 액세스 주소는 게이트웨이 구성에서 허용되지 않습니다.”

이 프롬프트는 요청이 도착했음을 나타냅니다. Bridge，그러나 요청 Host 허용 목록에 없습니다. 먼저 거기 있는지 확인하세요 Bridge 이 노출을 저장하고 활성화하세요. HTTPS 주소를 확인한 다음 프록시가 공개 도메인 이름과 포트를 예약했는지 확인하세요. `bridge.example.com:8443`。포트 매핑을 통해서만 가능하며, Bridge 공개 주소 등록은 여전히 ​​거부됩니다. 프록시 재작성 Host 또는 비표준 포트가 누락되어도 이 메시지가 나타날 수 있습니다. 보다 [issue #35](https://github.com/try2love/codex-mobile-bridge/issues/35)。위의 단계에 따라 구성하고 닫지 마십시오. Host/Origin 확인하다。

## English

Use **Existing tunnel / reverse proxy** when you manage a trusted HTTPS tunnel or a proxy running on the gateway computer. Point its HTTP upstream to that computer's actual loopback gateway address, such as `http://127.0.0.1:8787` with your real port. Save only the phone's HTTPS root URL in Bridge, optionally with a port. Public HTTP, subpaths, redirects and disabled TLS verification are unsupported. The gateway can keep LAN and local browser access off while this configured HTTPS entry uses the loopback upstream.

Preserve the public Host (including a custom port), Origin, Cookie and `X-CSRF-Token`; disable proxy caching and response buffering, and allow long requests, streaming and the file sizes you need. Bridge uses long polling or SSE; WebSocket support alone does not establish compatibility. **Check fixed entry** verifies TLS and the current instance without credentials. Success replaces the previous error in the card; editing the entry clears the stale result. Then test sign-in, chat and files from your phone's mobile network. A proxy on another device must instead use the advanced [NAS setup](../deploy/nas/README.md) with a reachable computer LAN address. This option is available in the [v2.1.0 release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v2.1.0).

If Bridge reports that the access address is not allowed, the request reached the gateway but its Host is not registered. Save and enable the public HTTPS URL, and ensure the proxy preserves the public hostname and any custom port. Port forwarding alone does not register an allowed address; do not disable Host/Origin validation. See [issue #35](https://github.com/try2love/codex-mobile-bridge/issues/35).
