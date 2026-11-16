# 브라우저 확인

이 디렉토리에 `*.browser.js` 진실에 의지하다 DOM、페이지 모듈 및 격리된 게이트웨이 고정 장치. 브라우저 드라이버에 의해 로드되고 파일에 선언된 확인 기능을 호출합니다.；Markdown 수식 스크립트를 사용하면 로드 후 바로 실행됩니다. 필수 페이지와 사전 상태는 각 파일의 시작 부분에 설명되어 있습니다.。

작성 세션 및 테스트 작업공간만 사용하십시오. 메시지를 보내거나, 파일을 수정하거나, 실제 사용자 세션에서 작업을 실행하지 마세요. Git 고정물。

세션 메뉴 확인: 제작물만 로드 중 `session-menu.js`、`session-menu.css` 기본 스타일을 사용한 격리된 페이지 로딩 `session-menu.browser.js`，전화해서 기다려 `runSessionMenuBrowserChecks()`。상단의 합성 콜백 유효성 검사, 이름 이스케이프, 세부 정보 복사, 기본 프로젝트 및 파티션 선택, 현재 소유권 태그, 읽기 오류 및 지연 응답 격리, 아카이브 확인 및 취소, 복구, 인증 변경 차단, 길게 누르기 및 롤링 취소 기능이 있습니다. 와이드스크린에서、390 px 및 320 px 경계와 하단 패널을 확인하세요. 합성 수표 대 실제 수표 Android WebView 합격을 별도로 기록。

이 스크립트는 다음에 의해 실행되지 않습니다. `npm run test:desktop` 구현하다. 이 명령은 다음을 찾습니다. `tests/` 및 `mobile/tests/` 아래에 `*.test.js`、`*.test.cjs`、`*.test.mjs`；브라우저 검사는 실제 실행과 비실행을 별도로 기록해야 합니다.。

`npm run test:browser` 다음에서 격리 서비스를 자동으로 시작합니다. Chromium/WebKit 의 1280 px 및 390 px 뷰포트 실행 `critical.spec.cjs` 지정된 수표. 실제 확인 기능을 호출하고 대기하며 페이지 로드를 통과한 것으로 간주하지 않습니다. 준비 방법 및 실패 증거는 다음을 참조하세요. [검증입력](../README.md#node-브라우저로)。다른 특수 고정 장치는 다음 섹션에 따라 별도로 구현됩니다. 이 승인이 모든 브라우저 기능이 포함되었음을 의미하지는 않습니다.。

Markdown 공식 확인도 이 입구에서 수행됩니다. 생산 채팅 및 공식 리소스를 먼저 로드한 다음 실행합니다. `markdown.browser.js` 의 15 아이템 체크섬 `math.browser.js` 의 13 빈 줄 없이 수식을 덮는 항목 확인、TeX 원본 텍스트, 코드, 링크 보안, 스트리밍 조각 및 좁은 화면 스크롤. 사용 가능 `npm run test:browser -- --grep 'Markdown, literal code and math rendering'` 이 네 가지 브라우저 및 뷰포트 조합을 개별적으로 실행하십시오. 휴대전화를 대표하지 않음 WebView 실제 기계 수용。

## 복구 확인 시작

달리다 `python3 -B tests/browser/bootstrap-fixture.py`，인쇄하려면 테스트 탭에서 액세스하세요. loopback 주소. 사용 `?case=success` 등. 매개변수 선택 시나리오에 대한 전체 목록은 고정 파일 헤더를 참조하세요. 생산을 위해 제공되는 설비 Web 실제 게이트웨이에 연결되지 않은 리소스 및 합성 인증; 탐색할 때마다 오류 카운트가 재설정되며 동시에 여러 페이지를 작동할 수 없습니다.。

현재 페이지를 기다리는 중 `window.__startupTest.scenario` 선택한 장면에 맞게 시작 영역이 숨겨지거나 들어갈 때까지 기다립니다. `data-state="failed"`。묶음 `/__checks.js` 외부 스크립트로 로드한 후 호출하고 기다립니다. `runBootstrapBrowserChecks()`；단순히 스크립트를 로드하면 어설션이 수행되지 않습니다.。`bootstrap-missing` 장면은 하단 프롬프트가 표시될 때까지 기다려야 합니다.；`pair-unknown` 사용 `#pair=synthetic-test-token`，～에 대한 30 단 하나의 합성 페어링만 제출되었는지 몇 초 후에 확인하세요. 일반 시나리오에서는 실행 순서, 스크립트의 반복되지 않는 실행 및 기본도 확인합니다. load 순간의 클립보드 정의，`fast` 및 `slow` 마스크 비 플래시 및 지연 표시를 각각 확인하십시오.。

기본 스타일 복귀 사용 `shell-once`、`shell-twice` 및 `shell-fatal`：각각 보자 `/style.css` 처음, 처음 두 번, 항상 반환 503，자동 복구 확인 및 초기화 포함 link 최대 3개까지 로드할 수 있습니다. 실패 스타일에는 다음이 없을 수 있습니다. `sheet`，열람 예약도 가능합니다 `cssRules` 언제 던져졌는가 `SecurityError` 물체；Node 사용 사례는 후자를 다루고, 브라우저 사용 사례는 실제 요청 체인을 확인합니다.。Chromium 아마도 초기에는 link 추가 시작 HTTP 요청의 상한은 실제 삽입된 요청 수를 기준으로 합니다. link 서버 요청 수를 유지하면서 계산합니다. 기초가 부족하다 CSS 스타일이 없는 HTML 포켓 하단은 스타일 마스크 플래싱용으로 사용되지 않습니다.。

브라우저에서 시뮬레이션 `prefers-reduced-motion: reduce`，별도로 열기 `?case=fast&motion=reduce`、`?case=slow&motion=reduce` 및 `?case=bootstrap-missing&motion=reduce`，동일한 검사 기능을 실행합니다. 쿼리 매개변수는 브라우저 설정이 적용되었는지 확인하기만 하며 시뮬레이션된 설정을 바꾸지는 않습니다. 누락된 스크립트로 인해 느린 시작이 발생함 650 ms 프롬프트가 아직 표시 시간에 도달하지 않았기 때문에 실패하지 않도록 다시 확인하십시오. 와이드스크린 vs. 390 px 좁은 화면을 검사해야 합니다. 힌트를 활성화하면 가시성 변경만 지연되고 변위, 크기 조정 또는 그라데이션이 발생하지 않습니다. 동적 효과를 줄이면 힌트가 영구적으로 숨겨져서는 안 됩니다.。

`external-script` 시나리오 시뮬레이션 Cloudflare 외부 통계 스크립트, 어설션 삽입 CSP 이를 차단하고 워크벤치는 여전히 성공적으로 로드됩니다. 리소스 다운로드와 실행이 분리된 후에도 스크립트 순서, 런타임 오류 및 종속성 실패 장벽을 계속 확인해야 합니다.。

`opaque-error` 에서 DOMContentLoaded 소스 없이 전역 오류를 주입하기 전에 재정의하세요. Safari 스크린샷 진행 중 `loading / 0s` 거짓 중단 경로；`external-runtime` 및 `external-rejection` 비시작 종속 스크립트의 예외 및 처리되지 않은 예외를 각각 다룹니다. Promise 거부하다. 세 가지 모두 미리 실패 페이지에 진입하지 않고 로그인을 계속 표시해야 합니다. 이는 합성 결함이며 실제 전화의 버그가 확장 프로그램으로 인해 발생했음을 증명하지 않습니다.；`runtime` 및 `js-fatal` 종속성 체인은 계속 종료되어야 합니다.，Node 또한 사용 사례에서는 원인을 알 수 없는 오류가 시작 시간 제한을 연장하지 않거나 진단 또는 예외 본문을 노출하지 않는지 확인합니다. URL 매개변수。

`app-cached-failure` 원본용 `/app.js` 버전 URL 캐시 가능 반환 nosniff 비스크립트 응답이 거부되었으며 시뮬레이션된 사전 로드 실패가 이어졌습니다. script 재사용. 복구는 새로운 캐시 식별자를 사용하여 동일한 경로 요청을 생성해야 하며 실제 `/app.js` 한 번만 실행할 수 있습니다. 같은 내용만 반복해서 삽입하세요. URL 여전히 실패했습니다. 이 시나리오는 캐시 복구 메커니즘을 확인하지만 진위 여부가 확인되었거나 확인되었음을 의미하지는 않습니다. Safari 콘텐츠 차단, 개인 정보 보호 설정 또는 네트워크 요청。

제거하다 `app-cached-failure` 오류 응답 외에도 고정 장치 리소스 응답이 사용됩니다. `no-store`；이러한 실패 테스트는 프로덕션 캐시 적중이나 실제 캐시 적중을 입증하지 않습니다. BFCache 동결 복구. 약한 네트워크와 휴대폰의 브라우저 시뮬레이션을 별도로 기록해야 합니다. WebView 실제 머신과 프로덕션 캐시의 검증 범위。

[PR #88](https://github.com/try2love/codex-mobile-bridge/pull/88) 작가가 녹음한 2026-10-27 검증：1213 개 Node 시험、8 개 Web 리소스 테스트 및 17 개인 Chromium 출시 시나리오가 통과되었습니다. 실행 중인 동기화 수정 Windows 게이트웨이 후 사용자가 확인합니다. iPhone Safari 복원되었습니다. 이 실제 시스템 피드백은 액세스가 복원되었음을 확인하며 원래 오류가 확장 또는 캐시 소스에서 발생했음을 의미하지 않습니다. 로컬 통합에 대한 독립적인 재테스트를 참조하세요.[결정기록](../../.agents/notes/implemented/bug-fix/2026-10-27-startup-error-attribution-and-cache-retry.md)，작성자의 실제 기계 피드백을 이 라운드의 반복 완료를 수락하는 것으로 간주하지 마십시오.。

<a id="mermaid-checks"></a>

## Mermaid 감독검사

- `mermaid.browser.js` 로드 중 Markdown 차트 카드 모듈의 페이지에서 직접 실행하고 대체 렌더러를 사용하여 펜스 식별, 원본 텍스트 복사, 스트리밍 업데이트, 소스 코드 선택, 캐시 재사용 및 정리를 확인합니다. 이러한 주장을 통과시키는 것은 진실과 같지 않습니다 Mermaid 이미지가 생성되었습니다.。
- `mermaid-viewer.browser.js` 전화해서 기다려야함 `runMermaidViewerTests()`，합성하다 SVG 전체 화면, 확대/축소, 드래그, 소스 전환 및 닫기를 확인하세요. 실제 렌더러 또는 모바일 입력 이벤트 수용을 대체하지 않습니다.。
- 패키지 승인은 실제로 설치된 게이트웨이에서 프로덕션 리소스를 로드해야 하며 중국어를 확인해야 합니다. SVG 의 `naturalWidth > 0`，그런 다음 소스 코드, 전체 화면, 스트리밍 및 캐시를 확인하십시오. 전체 페이지 유지 DOM，파괴를 피하다 App 비동기 초기화；CDP 드라이버는 메인 프레임 탐색이 완료될 때까지 기다려야 하며 기본 실행 컨텍스트를 사용해야 합니다.。iOS 프로덕션 탐색 전략과 함께 전체를 사용해야 합니다. App，복구 후 실제 이미지로 실패한 기준선을 확인합니다.。
- `tests/test_mermaid_renderer_security.py` 고정 리소스 및 인증 다루기、CSP 중계 경로 있음；`python3 scripts/test-ios-mermaid-navigation.py` 있다 Xcode/Swift 의 macOS true로 컴파일 URL 직접 및 중계 정확한 경로와 탐색 제한 사항을 결정하고 확인합니다. 후자는 탐색 규칙만 확인하고 전체를 대체하지는 않습니다. App 디스플레이 확인。

이번 라운드의 완료된 검사는 다음을 참조하세요. [Mermaid 크로스 플랫폼 수용](../../VERIFICATION.md#mermaid-preview-acceptance)。

## 기록 페이징

에서 `bootstrap-fixture.py` 의 `?case=success` 페이지가 시작된 후 로드
`desktop-history.browser.js` 그리고 전화해서 기다려 `runDesktopHistoryBrowserChecks()`。
독립적인 인터페이스, 모든 이력 및 workspace 요청은 모두 합성 읽기 전용 결과입니다. 실제 세션에 액세스할 수 없습니다.。
각각 와이드스크린과 390 px 첫 번째 화면, 이전 페이지 추가, 스크롤 위치, 파일 참조, 현재 상태 및 초안 보존 확인。
파일 참조 업데이트가 이전 메시지 노드를 합법적으로 대체할 수 있으므로 현재 메시지 노드를 사용하도록 어설션합니다. DOM 마디。


## 새 채팅 및 프로젝트 디렉토리 생성

`project-creation.browser.js` 프로덕션에 로드됨 Web 스크립트 격리 loopback 페이지에서 실행。
브라우저 드라이버를 통해 스크립트를 읽고 주입한 후 호출하고 기다립니다.
`runProjectCreationBrowserChecks({language:'zh',provider:'claude',keepOpen:true})`。
`language` 지원하다 `zh` / `en`，`provider` 지원하다 `claude` / `deepseek`；
`folder:true` 공유 디렉터리 팝업 창은 검사가 끝난 후에도 시각적으로 쉽게 확인할 수 있도록 유지됩니다.。
`keepOpen:true` 미리보기를 유지하고 완료되면 전화하세요. `window.__projectCreationPreview.cleanup()`；기본적으로 자동 청소。
각각 320 px、390 px 와이드스크린 모드에서 중국어 및 영어 검사를 실행하여 짧은 경로, 환경 ID, 첫 번째 메시지 요구 사항, 새 폴더 접기 및 수평 오버플로를 확인합니다.。
이 스크립트는 독립형을 생성합니다. `DesktopSessionsView`，모든 요청은 클로저로 합성됩니다. 새 폴더를 생성하면 메모리의 경로만 변경되고 프로젝트 등록 및 채팅 생성이 거부되며 실제 클라이언트에 액세스할 수 없습니다.。

Codex 환경 라우팅, 디렉터리 등록, 생성 확인 등은 다음에서 제공됩니다. `codex-entries.browser.js` 검사 및 지원 서비스는
`scripts/smoke-wsl-app-ui.cjs`。달리다 `CMB_FIXTURE_ONLY=1 node scripts/smoke-wsl-app-ui.cjs`
합성만 시작 API 이 서비스는 인쇄를 위해 기존 브라우저에서 열립니다. loopback 주소; 실제 게이트웨이에 대해 이러한 검사를 호출하지 마세요.。
페이지 시작 후 삽입됨 `codex-entries.browser.js`，전화해서 기다려 `checkCodexEntries()`，중국어 인터페이스 및 새로운 설비 상태 사용。
그것은 하나를 덮는다 Codex 입구、WSL 스캔 시작 및 중지, 목록 필터링 및 페이징、WSL 새 디렉토리, 로컬 및 SSH CLI 기존 프로젝트가 없는 경우 새 카탈로그 흐름, 모델 태그 및 초안 격리。
`checkCodexProjectCreation()` 네이티브로 사용 가능 Codex 액세스가 개별적으로 활성화되면 장치를 확인하고 SSH CLI 프로젝트 프로세스。
합성 서비스 검증 `environments`、폴더 `host`、WSL `entry`、`kind:'cli'`、디렉터리 ID 및 생성 요청；
이러한 채팅 생성은 메모리 내 합성 세션만 반환하고 메시지는 전송되지 않으며 모델은 호출되지 않습니다. 서버측 픽스처를 수정한 후 서비스를 다시 시작해야 합니다. 페이지를 다시 로드하면 이전 프로세스의 경로가 업데이트될 수 없습니다.。


## 현재 대화에 이미지 추가

`image-composer.browser.js` 맞잡다 `scripts/smoke-image-composer.cjs`，설치된 것을 사용하세요 Electron 검역 점검 수행。
그것은 생산을 부하한다 Workbench、ComposerQuotes、ChatAttachments、이미지 미리보기, 스타일 및 `app.js` 실제 콜백，
합성 이미지로 확인 Codex、Claude、DSH 에서 390 px 와이드스크린에서 파일 태그와 이미지 미리보기、“대화에 추가”、채팅으로 돌아가기, 첨부 파일 표시, 임시 보관。
동일한 파일 태그의 경우 계정 ID가 변경된 후에도 원본 이미지를 계속 볼 수 있지만 이전 이미지를 새 초안에 추가할 수는 없습니다.。
첨부 파일 업로드는 메모리 고정 장치에 의해 수신됩니다.，HTTP 서비스는 모든 비- GET 요청은 실제 게이트웨이나 모델을 호출하지 않습니다.。
확인 결과와 스크린샷은 다음 위치에 저장됩니다. `.tmp/v215-chat-feedback/image-workbench-check/`。

## 입력 영역 참조 레이아웃

`composer-quotes.browser.js` 에서 `bootstrap-fixture.py` 프로덕션 페이지를 완전히 시작한 후 실행。
전화해서 기다려 `runComposerQuoteLayoutChecks()`，현실의 차이 390、844、1440 px 뷰포트 실행; 창 크기를 조정한 후 대기 `innerWidth` 목표 너비 일치。
초기화된 전체 내용을 복사합니다. Codex / Claude 입력 영역（알림, 권한, 컨텍스트 및 축소 버튼 포함）은 더 이상 도구 모음을 수동으로 단순화하지 않습니다. 와이드스크린 선택 버튼이 컨텍스트에 인접해 있는지, 좁은 화면에 독립적인 컴팩트 행이 있고 원래 도구 모음이 줄바꿈되지 않았는지, 참조 미리보기 한 줄이 생략되고 전체 텍스트가 확장되었는지, 선택 클릭과 기존 초안이 유지되는지 확인하세요. 메시지가 전송되지 않습니다. 레이아웃은 실제 입력 영역 너비를 기준으로 합니다. 분할 화면 너비 대신 전체 창 너비를 사용할 수 없습니다.。

## Codex 멀티탭 전송 조정

격리 상태 `bootstrap-fixture.py?case=success` 페이지 로딩 `composer-send.browser.js` 그 후 전화해서 기다리세요 `runComposerSendCoordinationChecks()`。두 개의 독립적인 소스 문서를 사용합니다. IndexedDB 거래 및 전속구성 localStorage 키, 동일하게 확인 ID 동시 등록, 거부 순서, 알 수 없는 결과 보유 및 모든 명시적 거부를 대기열로 변경할 수 있습니다. 요청이 전송되지 않았습니다 API。최상위 탭의 동일 출처 공유 동작은 브라우저 드라이버에서 별도로 확인해야 합니다.。

`persistent-drafts.browser.js` 의 `runPersistentDraftTests()` 승인을 기다리는 동안 실제 제출 프로세서와 합성 네트워크 결과를 사용하여 계정 전환, 페이지 탐색 및 새로운 초안 보호를 보완합니다. 실제 세션 페이지에서는 두 가지 유형의 확인을 모두 수행하면 안 됩니다.。

## 채팅 목록이 먼저 시작됩니다.

`python3 -B tests/browser/list-first-fixture.py` 격리 시작 loopback 프로덕션 페이지, 버전이 지정된 리소스 및 합성 계정/목록을 사용하는 서비스는 채팅 쓰기를 거부합니다.。
`?case=first` 목록을 얻은 후 엽니다. `?case=cached`：동일한 ID 캐시가 먼저 표시되어야 합니다.，5 몇 초 후에 새 제목으로 새로고침；`?case=identity` 캐시된 다른 ID를 사용하면 이전 목록이 더 일찍 나타날 수 없습니다.。
`?case=blocked` 수식, 터미널 및 파일 미리보기 리소스에 대한 반환 503，목록은 여전히 ​​정상적으로 표시되어야 하며 이러한 구성 요소는 요청되어서는 안 됩니다. 수식이 실제로 렌더링된 후에도 소스 코드와 재시도 버튼이 유지되어야 하며 전체 화면 시작 오류를 입력해서는 안 됩니다.。
`?case=slow` 스크립트 응답을 위해 추가됨 300 ms；브라우저 단일 페이지 네트워크 속도 제한 확인 콜드 스타트와 결합。`window.__listProbe` 첫 번째 목록/캐시 업데이트 시간 및 런타임 예외를 기록합니다. 설비에만 사용되며 실제 게이트웨이에 테스트 데이터를 주입하는 것은 금지되어 있습니다.。

## WSL 팝업 창 너비

격리 생산 페이지 고정 장치에 로드 `wsl-dialog-width.browser.js`，전화해서 기다려 `runWslDialogWidthChecks({kind:"accounts"})` 또는 `{kind:"new-chat"}`。합성 긴 배포판 이름, 계정 이름, 주소 및 가져오기 옵션을 사용합니다. 실제 계정 인터페이스를 호출하거나 채팅을 보내지 않습니다. 각각 320/393/430/1280 중국어, 영어로 요소의 너비와 경계를 확인하세요.、`scrollWidth === clientWidth`、가로 스크롤 위치는 0이고 좁은 화면의 기본 선택 상자 글꼴 크기는 최소 16px。완료 후 호출됨 `window.__wslLayoutCleanup()`。

선택 상자 안의 긴 옵션은 WebKit 요소 경계가 정상인 경우에도 조상 스크롤 영역을 확장할 수 있습니다. 필요하다 WebKit 위의 롤링 어설션을 실제로 실행하려면 다음을 확인하는 것만으로는 충분하지 않습니다. Chromium 또는 요소 너비。macOS WKWebView 합격 결과는 대체할 수 없습니다. iPhone 실제 기계 입력 및 선택 승인。

## 클라이언트 세션 제어 공유

격리 상태 `bootstrap-fixture.py` 성공 페이지에 삽입 `desktop-parity.browser.js`，전화해서 기다려 `runDesktopParityChecks({language:'zh'})`。세 클라이언트의 아래쪽 열이 동일한 행에 있는지, 기본 컨텍스트 비율, 공유 참조 항목 및 긴 파일 이름 이미지 미리 보기 버튼이 줄 바꿈되지 않는지 확인하세요. 모든 데이터와 요청이 합성되며 모델 메시지가 전송되지 않습니다. 씌우다 320/390 픽셀 중국어 및 영어, 가로 및 와이드스크린。`keepOpen:true` 스크린샷을 위한 이미지 미리보기를 유지합니다. 세션 메뉴 ID 다른 사람이 복사 `session-menu.browser.js` 검증。

## visualize 반품

`npx playwright test -c tests/browser/playwright.config.cjs visualize.spec.cjs` 에서 Chromium 및 WebKit 넓고 좁은 뷰포트로 생산 실행 Markdown、셸 및 런타임을 미리 봅니다. 상호 작용, 상태 복원, 테마, 스크립트 메모리 전체 화면 유지, 질문 초안, 실패 재시도 및 격리 경계를 다룹니다. 합성 API 외부 네트워크를 가로채면 이러한 사용 사례가 설비만 작동하도록 보장합니다.。
