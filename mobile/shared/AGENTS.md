# Android/iOS 공용 WebView 스크립트

- `web/mobile-ui.js`, `web/mobile-clipboard.js`, `web/mobile-system-bars.js`는 Android/iOS가 사용하는 유일한 공통 소스이며 UI, 클립보드, 시스템 영역 색상 순서로 로드합니다. 플랫폼 코드에서 같은 스크립트를 생성하거나 복제하지 않습니다.
- 이 스크립트는 모바일 네이티브 셸에 맞춘 페이지 처리를 보완하는 역할만 합니다. 공통 채팅 기능과 레이아웃은 계속 저장소 루트의 `web/`에서 관리합니다.
- token 자리표시자, 클립보드의 실제 클릭·일회성 사용 제한, 메인 프레임 보호를 유지합니다. 네이티브 권한과 origin 검증은 각 플랫폼의 네이티브 브리지에서 수행하며, 웹페이지가 스스로 신뢰할 수 있다고 선언한 값을 근거로 삼아서는 안 됩니다.
- 리소스를 추가하거나 이름을 바꿀 때 Android 일반 빌드, FCM Gradle, Xcode 메인 타깃의 리소스 목록을 모두 갱신하고 `mobile/tests/resources.test.cjs`를 실행해야 합니다. Android 전용 `mobile-session.js`를 iOS에 포함해서는 안 됩니다.
