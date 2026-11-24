# 검증입력

테스트는 변경된 기능 및 플랫폼과 일치해야 합니다. 소스 코드 테스트는 세 시스템에서 실제 클라이언트 공동 디버깅이 컴파일, 설치 또는 완료되었음을 의미하지 않습니다.。

## Python 후방

웨어하우스 루트 디렉터리에서 기존 프로젝트 환경을 이용하여 실행：

```sh
python -B scripts/test-backend.py --source-only
python -B scripts/test-backend.py --source-only -p 'test_desktop_discovery.py'
python -B scripts/test-backend.py --source-only -p 'test_platform_architecture.py'
python -B scripts/test-backend.py --source-only -p 'test_resource_layout.py'
```

`--source-only` 6개의 기본 픽스처 클래스를 명시적으로 건너뛰기：Claude 의 Swift Console 선택자、macOS 데스크톱 세션 확인、Windows 창 선택기 및 Windows Codex 종료, 강제 종료 및 Explorer 런처 검증. 이러한 픽스처는 기본 프로그램을 컴파일하거나 실행할 수 있습니다. 순수한 Python 플랫폼 시뮬레이션과 보안 점검은 계속 진행 중입니다. 이 옵션을 생략하고 완료하세요. unittest discovery 마찬가지로, 현재 시스템 및 환경에 따라 기본 테스트가 실행됩니다. 플랫폼, 선택적 종속성 및 기본 SDK 건너뛴 항목이 결과에 나열됩니다. 기존의 CI 각 플랫폼을 그대로 유지 discovery。

HTTP、계전기、IPC、mailbox 테스트가 기본 격리 수신 및 합성 데이터를 사용하는 경우 테스트 프로세스 바인딩을 허용해야 합니다. loopback/Unix socket。제한된 실행 환경 EPERM 기능 패스도 아니고 제품 스킵으로 숨길 수도 없습니다. 공유 트렁크 테스트에는 기존이 필요합니다. `requirements-relay.txt` 환경; 테스트 스크립트 자체는 종속성을 설치하지 않습니다.。

| 범위 수정 | 기본 테스트 파일 접두사 |
| --- | --- |
| 계정, 할당량, 모델 | `test_account*`、`test_api_catalog*`、`test_saved_account*`、`test_remote_catalog.py` |
| 클라이언트 검색/시작 및 중지 | `test_client_*`、`test_desktop_discovery*`、`test_desktop_idle*` |
| Claude/DSH | `test_claude_*`、`test_deepseek_*`、`test_desktop_sessions*` |
| 인증/쌍/회로망 | `test_auth*`、`test_pairing*`、`test_login_security*`、`test_shared_relay*`、`test_network*`、`test_http_proxy.py` |
| 대화 및 전송/승인하다 | `test_bridge*`、`test_cli_bridge_integration.py`、`test_codex_app_server.py`、`test_codex_cli_session.py`、`test_desktop_*`、`test_goal_*`、`test_permissions*`、`test_timeline*` |
| 파일/단말기 | `test_workspace*`、`test_download_ranges*`、`test_*terminal*` |
| 디렉터리 및 리소스 경계 | `test_platform_architecture.py`、`test_resource_layout.py`、`test_web_assets.py` |

테스트 이름은 그대로 유지됩니다. `tests/` 최상위 레이어를 사용하면 접두어로 기존 고정 장치를 쉽게 검색하고 재사용할 수 있습니다. 플랫폼 테스트의 시뮬레이션 결과는 해당 운영 체제의 실제 결과를 대체할 수 없습니다.。

Windows 포장 시 Microsoft가 검증 및 운반됩니다. ConPTY 일치하는 OpenConsole，지원하다 Windows 10 터미널 마우스/터치 이벤트; 시스템 구성 요소를 교체하지 않습니다. 소스 코드 승인이 먼저 실행될 수 있습니다. `python scripts/bundle-conpty.py`，다시 실행 `python -B -m unittest discover -s tests -p test_windows_terminal.py -v`。준비되지 않은 구성 요소의 소스 코드 환경은 시스템을 상속받습니다. ConPTY，마우스 관련 사용 사례는 명시적으로 건너뜁니다. 지정하다 `CMB_TEST_RUNTIME` 패키징 게이트웨이용 EXE 그 후에는 동일한 테스트 세트가 옆에 로드됩니다. `_internal/conpty` 구성 요소, 마우스 모드 확인, 좌표 클릭、VT 입력 및 중국어는 물론 원본 디렉토리와 크기까지、Ctrl+C、다시 연결 및 종료 동작。

## Android 파일 선택

Android 파일 선택 결과의 URI 검증과 콜백 수명 검사는 `python3 scripts/test-mobile-uploads.py`로 실행합니다. 실제 검증 코드와 Activity 메서드를 합성 provider·실행 큐에서 실행하며, 실기기 파일이나 사용자 데이터를 사용하지 않습니다. Android CI에서도 이 검사를 실행합니다.

## Node 브라우저로

```sh
npm run test:desktop
npm run test:updater
npm run test:boundaries
npm run test:browser
```

`test:desktop` 통해 `scripts/test-frontend.cjs` 자동 재귀 검색 `tests/` 및 `mobile/tests/` 가운데 `*.test.js`、`*.test.cjs`、`*.test.mjs`。새로운 Node 사용 사례에서는 긴 명령 목록을 편집할 필요가 없습니다. 이 항목에는 리소스 경로 확인이 포함되어 있습니다.。

호스트 및 너비/좁은 레이아웃 변경이 먼저 실행될 수 있습니다. `node --test tests/host-environment.test.cjs tests/layouts.test.cjs tests/frontend-assets.test.cjs mobile/tests/resources.test.cjs`。이러한 검사에는 호스트 식별 및 지연 주입, 컨테이너 분할 화면 경계, 스타일 순서 및 기본 리소스 목록이 포함되며 전화를 시작하거나 컴파일하지 않습니다. App。창 변경 후 레이아웃 및 상태 유지의 실제 렌더링은 여전히 ​​브라우저 고정 장치를 통해 확인되어야 합니다.。

[브라우저 고정 장치](browser/README.md) 누워있다 `tests/browser/*.browser.js`，진실에 의지하다 DOM 또는 해당 드라이버가 호출해야 하는 격리 서비스입니다. 이러한 파일 중 일부는 테스트 함수만 정의하며 개별적으로 로드하면 어설션이 수행되지 않습니다. 이번 라운드에서는 다음과 같이 결합합니다. Node 부풀려진 패스 수를 피하기 위해 별도로 분리。

`test:browser` 시작 복구, 채팅 기록, 초안 격리 자동 호출、API 양식, 입력 참조 및 Claude/DSH 프로젝트 팝업 체크 등 Chromium/WebKit、1280 px/390 px 네 가지 조합. 모델 설정 회귀를 통한 피드백 보내기도 다룹니다. Claude Code/Cowork、DSH、느린 응답, 수동 입력 및 실제 채팅 배경을 위한 밝은 테마와 어두운 테마. 처음으로 개발 종속성을 설치한 후 실행 `PLAYWRIGHT_BROWSERS_PATH=.local/tools/playwright npx playwright install chromium webkit`；Linux CI 추가하다 `--with-deps`。Windows 사용 가능 PowerShell 동일한 이름으로 환경 변수를 설정하십시오. 또한 구성은 기본적으로 프로젝트 내의 디렉터리를 사용합니다.。Chromium 공식 다운로드를 일시적으로 사용할 수 없는 경우 이 컴퓨터에서 사용할 수 있습니다. Chrome：`CMB_CHROMIUM_CHANNEL=chrome npm run test:browser`，보고서에 브라우저 소스를 표시하세요.；CI 기본적으로 잠긴 버전 런타임 사용。

서비스 고정 바인딩 격리 loopback 포트 18279，점유된 포트의 재사용을 거부합니다. 브라우저 요청은 외부에 액세스하지 않습니다 origin。출력은 `.tmp/browser-results/`，실패 시 스크린샷과 trace。합성 페이지 검사는 실제 로그인 백엔드, 클라이언트 프로토콜 또는 휴대폰을 대체하지 않습니다. WebView 수락。

포함하다 [PR #88](https://github.com/try2love/codex-mobile-bridge/pull/88) 뒤쪽에，WebKit 지속적인 리소스 오류 복구는 전체 어설션을 통과해야 하며 더 이상 유지되지 않습니다. `known-baseline` 저장 실패가 예상됩니다. 일반 검사에는 소스가 지정되지 않은 오류, 비시작 종속 스크립트의 예외도 포함됩니다. Promise 거부, 캐시 가능한 오류 스크립트 응답; true 필수 스크립트 오류는 여전히 종속 실행을 중지해야 합니다. 자세한 경계는 다음을 참조하세요.[오류 원인 기록 시작](../.agents/notes/implemented/bug-fix/2026-10-27-startup-error-attribution-and-cache-retry.md)。

`test_module_boundaries.py` 자동으로 실행 AST 종속성 검사도 가능합니다. `python3 -B scripts/check-boundaries.py` 혼자 달리다（Windows 사용 가능 `python`）。[역사적 예외](../docs/architecture/dependency-exceptions.json) 파일 및 기호에 따라 정확하며 와일드카드 릴리스는 금지됩니다. 이전 종속성을 제거하려면 해당 예외를 삭제해야 합니다. 검사는 애플리케이션을 실행하지 않으며 가변 접합의 역학을 추론할 수 없습니다. import；원래 플랫폼 선택, 리소스 경로 및 공유 스크립트 테스트는 계속 유지됩니다.。

`scripts/smoke-*` 항목의 중간 부분은 실제 애플리케이션을 시작하거나 패키지 제품에 의존합니다. 실행하기 전에 헤더를 살펴보고 fixture，부작용이 없는 일반 단위 테스트로 취급하지 마세요.。

新版 Codex Desktop 接入的定向入口为 `test_hosted_desktop.py`。`python3 -B scripts/smoke-hosted-desktop.py --codex <已安装原生运行时绝对路径>` 在 `.tmp/` 新建私有配置，以真实原生执行器和 loopback 模型验证生产 Bridge 的历史读取、发送、中断、审批取消及同一执行器重连。该入口不连接用户的 App、账号或正式 daemon；原 App 启动握手、真实 GUI 同步与 Windows 成品另行验收。

原生侧边聊天使用 `test_native_side_chat.py`、`test_store.py` 和浏览器的 `native-side-chat.spec.cjs` 验证持久化创建、父子归属、标准聊天路由与关闭视图不删除。旧 `test_side_chat.py` 中保留临时运行时回归，仅保护升级前已打开的旧页面；新增侧边聊天不再使用该运行时。独立侧边输入区和附件 UI 夹具已移除，现复用标准会话的相应用例。

`node scripts/smoke-wsl-app-ui.cjs` 독립하여 Edge 실제 구성 디렉터리 로드 Web 페이지 및 작곡 API，실제 실행 `tests/browser/codex-entries.browser.js`，독립적인 애플리케이션 관리, 목록 격리 확인、Magpie 모델명, 초안 보존 및 WSL 휴대폰은 새로운 독립 채팅, 디렉터리 브라우저를 만들고, 상위 디렉터리를 선택하여 새 폴더를 만들고, 새 프로젝트를 만들고, 명시적으로 페이지를 넘길 수 있습니다. 기본적으로 사용됨 Windows Edge，또한 사용 가능 `CMB_BROWSER` 지정하다 Chromium 실행 파일; 자체 브라우저 프로세스만 시작하고 스크린샷과 결과는 `.tmp/`，실제 게이트웨이에 연결되지 않거나 Codex。기본 공유 서비스를 위한 SegWit은 계속해서 제공됩니다. `scripts/smoke-wsl-shared-server.py --codex <분명한 Linux 실행 시간>` 혼자 실행。

## 휴대폰 및 포장

`mobile/tests/` 가운데 Java/Swift 사용 사례는 해당 항목으로 구성됩니다. `scripts/test-mobile-*`、`scripts/test-ios-*` 드라이버, 테스트 프로그램을 컴파일할 수 있습니다. 이 작업이 허용되고 환경이 사용 가능한 경우에만 실행됩니다.。Web 리소스 확인은 대체되지 않습니다. Android WebView 또는 iOS WKWebView 기본 대화형 검증。

`scripts/gateway-resources.json` 소스 경로 테스트 보장 체크리스트와 일치하지만, 고정된 가져오기, 서명, 설치 및 업데이트는 패키징이 승인된 후 대상 시스템에서 추가로 확인되어야 합니다. 그것을 기반으로하지 마십시오 macOS 단일 기계 테스트 청구 Windows/Linux 실제 기계를 통과。

PR 의 `change-scope` 사용 `scripts/ci-test-scope.py` 백엔드를 개별적으로 선택、UI 의지、Node、브라우저、Android、iOS 모바일 업데이트 확인; 순수한 CSS 백엔드, 데스크톱 로직 또는 기본 컴파일이 실행되지 않습니다. 알 수 없는 경로, 종속성, 워크플로 및 공개 목록은 그대로 유지됩니다.。`desktop-tests` 선택한 결과를 명시적으로 집계하는 역할만 담당하며 실패, 취소 또는 예상치 못한 건너뛰기를 통과로 계산하지 않습니다. 마스터 브랜치 푸시, 버전 라벨 및 수동 트리거링이 완전히 확인된 상태로 유지됩니다. 일반적인 분기 푸시는 다음과 같이 수행됩니다. PR 전체 중복을 피하기 위한 이벤트 적용 범위。Android 선택 과목 FCM 실제 기계 동작의 구성 및 알림은 여전히 ​​별도의 승인을 받습니다.。

Android 백그라운드 알림 지시 검증：`python scripts/test-mobile-events.py` 진실을 통해 JSON 그리고 루프백 HTTP 증분 읽기, 서비스 재구성 및 갱신, 이벤트 중복 제거, 스트림 재설정 및 로그인을 다룹니다./경쟁 조건, 다중 컴퓨터 격리 및 일시 중단, 4개 주소 소스 선택의 기록 기준, 비활성화 시 전송 중 응답 및 다시 열기를 삭제합니다. 처음으로 수정된 버전을 다운로드하고 확인하세요. JVM JSON 테스트 종속성。`python scripts/test-mobile-notification-permissions.py --android-only` 검증 Android 알림 권한, 수동 백그라운드 전환 및 시작 실패 대체. 둘 다 읽었다 `JAVA_HOME`。시스템 서비스, 잠금 화면 알림, 클릭하여 점프 및 배터리 동작은 Android 장치 또는 시뮬레이터에서 별도 승인。

`python scripts/test-android-task-notifications.py` 재사용 준비 JVM JSON 종속성, 프로덕션 알림 렌더러를 컴파일하고 시스템 서비스 이중을 사용하여 다양한 이벤트가 독립적으로 유지되는지 확인하고 중복 제거를 다시 시도하고 라우팅을 클릭하고 경계를 정리합니다. 대표하지 않는다 Android 제조업체는 그룹 또는 실제 장치 클릭 경험이 통과되었음을 알립니다.。

`python scripts/test-mobile-urls.py --android-only` 컴파일 및 실행 Android URL 알림 페이지로 재사용을 위한 경계 검증; 완전한 이중 플랫폼 입구는 여전히 필요합니다. macOS 의 Swift 도구 체인。

iOS 알림 반환 시간 macOS 계속되다 `scripts/test-ios-events.py`、`scripts/test-ios-notification-routing.py`、`scripts/test-ios-notification-source.py` 및 `scripts/test-ios-notification-sources.py`，기존 모바일 단말기에 들어가셔서 CI 작업. 진짜를 덮어라 HTTP 다중 컴퓨터 격리 및 수명 주기, 장면 및 알림 클릭 중복 제거, 알림 제출 시 계속 읽을 수 있는 소스 아이콘 파일, 주소별 미리 알림 선택, 기내 콜백 무효화 및 다시 열기를 위한 기준. 마지막 두 가지 알림 시스템 유형은 대리자를 사용하며 시스템 승인 및 실제 전달에는 여전히 필요합니다. iPhone 수락。

Android 페이지 리소스 계약 설정：`node --test mobile/tests/settings.test.cjs mobile/tests/resources.test.cjs` 두 호스트 모두에 대해 밝은 리소스와 어두운 리소스 정렬, 텍스트 대비 및 구성 선언을 확인합니다. 기본 상호 작용은 전체 행 및 스위치 클릭, 백그라운드 서비스 시작 및 중지, 권한 반환 새로 고침, 설정 페이지 테마 범위, 테마 지속성 및 시스템 따르기, 프롬프트 알림, 번역, 원래 채팅으로 돌아가기, 좁은 화면 및 큰 글꼴 레이아웃도 허용합니다.。

Android 기본 PC 옵션 메뉴：`python3 scripts/test-android-gateway-menu.py --adb <이미adb길> --serial emulator-5556 --apk <이번 라운드Test가방> --keystore <동일한 서명 키> --application-id <Test애플리케이션 ID>`。서명 비밀번호는 다음과 같습니다. `CMB_ANDROID_STORE_PASSWORD` 들어오는. 명시적으로 삭제할 수 있는 에뮬레이터에서만 실행되어 에뮬레이터의 콘텐츠를 지웁니다. Test 기본 설정, 합성 연결 저장 및 알림 권한 부여 실제 장치 일련번호를 거부합니다. 사용 생산 Activity/WebView 페이지 색상, 기본 테마 대체, 시스템 및 단계별 롤백, 늦은 콜백 취소, 탐색 및 수명 주기 정리, 초안 보존, 알림 소스 기본 설정을 확인하세요. 결과는 다음 위치에 있습니다. `.tmp/android-gateway-menu-tests/`，실제 시스템 또는 실제 클라이언트 세션 승인과 동일하지 않음。

설정 페이지 애니메이션은 또한 진입 및 복귀, 스위치 및 권한 레이아웃, 테마 팝업 레이어, 라이트 및 다크 크로스페이드의 중간 프레임을 확인합니다. 또한 빠른 역방향 작업, 시스템 애니메이션 지속 시간이 0일 때 직접 프레젠테이션, 창을 닫은 후 애니메이션 및 임시 화면 정리를 다룹니다.。
