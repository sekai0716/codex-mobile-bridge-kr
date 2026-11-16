# 페이지 호스트 적응

이 디렉토리 처리 페이지는 일반 브라우저에서 실행됩니다.、iOS App 또는 Android App 시차. 창 크기와 분할 화면은 다음과 같이 지정됩니다. `../layouts/` 관리; 동일한 호스트가 좁은 화면, 가로 화면 또는 와이드 화면에 있을 수 있습니다.。

## 페이지 항목

`environment.js` 고정식을 통한 공개 액세스 `/host.js` 함수 스크립트 이전에 로드되어 다음을 제공합니다. `BridgeHost`：

| 방법 | 사용 |
| --- | --- |
| `kind(userAgent?)` | 뒤로 `browser`、`ios` 또는 `android`，기존 사용 `BridgeMobile` 태그 구문 |
| `isNativeApp(userAgent?)` | 로그인 인터페이스 및 첨부 파일 다운로드 선택 기본 셸에는 이미 동작이 있습니다. |
| `hasNativeLayout()` | 네이티브 스크립트가 레이아웃에 삽입되었는지 쿼리합니다. 컴퓨터 목록 및 터미널 입력 동작을 반환하는 데 사용됩니다. |

ID와 기본 레이아웃 준비는 서로 다른 것입니다.。Android/iOS 주입 시기가 다릅니다.，`hasNativeLayout()` 현재 마크업은 매번 읽혀지며 페이지 로드 시 영구적으로 캐시되지 않습니다. 평범한 Safari/Chrome 휴대폰에서 실행되더라도 여전히 브라우저 호스트에 속합니다.。

이 정보는 프레젠테이션 및 행동 선택에만 사용되며 권한을 부여하지 않습니다. 모든 페이지는 위조될 수 있습니다 UA/class；클립보드, 다운로드, 탐색 및 기타 작업은 현재 연결을 확인하기 위해 기본 브리지에서 계속 수행됩니다.、token、메인 프레임워크 및 실제 사용자 작업。

## 브라우저 반환

`browser-navigation.js` 따르다 `/host.js` 짐. 일반 브라우저는 목록에서 세션이 처음 열릴 때 세부 기록 항목을 생성합니다. 파일과 터미널이 이 세부사항에 속합니다. 브라우저 또는 모바일 브라우저의 뒤로 키를 사용하여 채팅 목록으로 직접 돌아가고, 앞으로 이동하여 대화를 재개하고, 기존 작업공간 및 초안을 재사용하세요. 상단 표시줄은 목록에 동일한 결과를 반환합니다. 목록은 외부 반품을 차단하지 않습니다. 확장 기록을 반복하지 않고 현재 항목을 새로 고치고 재사용합니다.。

기록에는 인증, 초안 또는 세션 콘텐츠가 아닌 클라이언트, 세션 ID, 호스트 및 임의 탐색 범위만 저장됩니다. 현재 로그인은 복원 전에 계속 확인됩니다. 로그아웃하고 계정을 전환하면 이전 탐색 범위가 무효화됩니다. 토종의 App 계속 사용하다 `BridgeNavigation.back()` 팝업창, 워크벤치 레벨, 채팅 목록 순서; 브라우저 기록을 이어받지 않습니다. 기본 ID와 지연 주입 레이아웃은 모두 동적으로 확인되며 창 너비를 기준으로 판단되지 않습니다.。

합성 브라우저 확인：`CMB_NAVIGATION_FIXTURE=1 CMB_FIXTURE_ONLY=1 node scripts/smoke-wsl-app-ui.cjs`，출력 기본 페이지에 삽입 `tests/browser/browser-navigation.browser.js` 그리고 실행 `await checkBrowserNavigation()`；설비가 사용자 게이트웨이에 연결되지 않음。

## 기본 구현 및 공유 스크립트

| 대상 수정 | 위치 |
| --- | --- |
| 공통 상단 메뉴 수율, 반환 항목 및 양쪽 끝의 연결 이름 | `mobile/shared/web/mobile-ui.js` |
| 양쪽 끝에 공통된 기본 클립보드 스크립트 | `mobile/shared/web/mobile-clipboard.js` |
| Android 수명 주기 알림 및 세션 갱신 프롬프트 브리지 | `mobile/android/assets/mobile-session.js` 그리고 Android 네이티브 구현 |
| Android JavaScript 리소스 읽기 | `mobile/android/.../MobileWebScripts.java` |
| iOS 리소스 읽기、viewport 주입 | `mobile/ios/BridgePreview/WebScripts.swift` |
| 기본 탐색、token/origin/frame 검증 | 각 플랫폼의 `MainActivity.java` / `App.swift` |

주인 CSS 원본 스타일 시트의 우선 순위에 따라 분리합니다. `web/assets.json` 순서가 지정된 조합 목록입니다. 더 많은 재정의 규칙을 삽입하여 기존 레이아웃을 우회하지 마십시오. 공유 스크립트는 기본 셸과 함께 패키지되어 있으며 게이트웨이는 이를 공개적으로 제공하지 않으며 네트워크를 통해 기본 브리지 스크립트를 동적으로 로드하지도 않습니다.。

## 검증

`tests/host-environment.test.cjs` 호스트 인식, 지연 주입 및 크기 독립적 동작 확인。`mobile/tests/resources.test.cjs` 양쪽 끝에서 실제 리소스 참조를 확인하세요. 모바일의 기존 클립보드, 이름, 반환 및 세션 테스트는 여전히 공통 소스 코드에서 실행됩니다.。

브라우저의 설정 UA/class 페이지 선택 분기만 시뮬레이션하며 나타낼 수는 없습니다. Android WebView、iOS WKWebView 또는 기본 시스템 권한이 확인되었습니다.。
