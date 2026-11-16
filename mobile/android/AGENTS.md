# Android 네이티브 셸

- `src/io/github/try2love/codexbridge/MainActivity.java`의 Activity 수명 주기, WebView 탐색, 네이티브 프롬프트 브리지 검증을 유지합니다. `MobileWebScripts.java`는 기존 순서로 에셋을 읽기만 하며 권한 부여를 담당하지 않습니다.
- Android/iOS 공용 페이지 스크립트는 `../shared/web/`에 둡니다. `assets/mobile-session.js`는 Android의 Cookie 저장과 백그라운드 동기화 알림을 위한 스크립트입니다. 공용 디렉터리로 옮겨 iOS에도 삽입해서는 안 됩니다.
- 일반 APK는 저장소 루트의 `scripts/build-mobile-android.py`로 빌드하고, 선택적 FCM 빌드는 `../android-push/build.gradle`을 사용합니다. 공용 리소스를 수정할 때 두 빌드의 입력을 함께 갱신하며, 두 위치에 같은 이름의 JS를 두어서는 안 됩니다. 리소스가 없으면 계속 명시적으로 실패해야 하며 빈 문자열로 대체하지 않습니다.
- token, 현재 WebView, URL origin, 창 포커스, 크기 제한, 탐색의 메인 프레임·사용자 제스처 검사를 유지합니다. 공용 JS로 네이티브 검증을 대신하거나, 제한 없는 JavascriptInterface를 새로 추가해서는 안 됩니다.
- `GatewayURL`, 다운로드, 알림, 파일 선택에서 기존 URL·Cookie·저장된 컴퓨터·콜백 세대 구분 경계를 유지합니다. 일반 APK에는 Firebase SDK를 포함하지 않으며, 푸시 전용 의존성은 `android-push`에만 둡니다.
- Java 패키지 이름과 매니페스트 진입점을 일치시킵니다. 새 소스 파일은 기존의 재귀 소스 탐색 빌드가 찾습니다. 디렉터리 정리를 이유로 applicationId, 버전, 서명을 변경하지 않습니다.
- 소스 회귀 검사: `node --test mobile/tests/*.test.cjs`. `scripts/test-mobile-*.py`는 JDK/Swift 등의 도구를 실행합니다. 빌드·설치·실기기 검증은 이번 작업에서 허용된 범위 안에서 수행해야 합니다.
