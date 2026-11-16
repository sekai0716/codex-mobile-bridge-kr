# iOS 네이티브 셸

- `BridgePreview/App.swift`는 네이티브 UI, 탐색, WKWebView 콜백, 연결 경계를 담당합니다. `WebScripts.swift`는 앱에 함께 패키징된 스크립트만 읽고 iOS viewport 설정을 제공합니다.
- Android/iOS 공용 페이지 스크립트는 `../shared/web/`에서만 수정하며 Swift에 다시 복사해서는 안 됩니다. `BridgePreview.xcodeproj/project.pbxproj`의 메인 앱 Resources를 함께 갱신합니다. Android용 세션 갱신 스크립트는 iOS에 포함하지 않습니다.
- 번들 리소스가 없거나 UTF-8 읽기에 실패하면 연결 호출자에게 오류를 던지고 기존 `info`로 표시해야 합니다. 빈 스크립트를 반환하거나 오류를 무시하거나 앱을 종료해서는 안 됩니다. 페이지를 로드하기 전에 전체 스크립트를 확보해야 합니다.
- 연결마다 생성하는 token, 현재 WebView의 신원, 메인 프레임, source/current origin, 포그라운드 상태, 크기 검증을 유지합니다. `WKUserScript`는 계속 메인 프레임의 document end에만 삽입하며, 검증을 신뢰할 수 없는 웹페이지로 옮겨서는 안 됩니다.
- 다운로드, Cookie, 알림을 통한 이동, 사용자가 저장한 컴퓨터, 파일 선택, 콜백 세대 검사는 기존 경계를 유지합니다. 채팅 UI는 저장소 루트의 `web/`에서 관리하며 Swift에 별도 구현을 만들지 않습니다.
- 새 Swift 파일은 올바른 Xcode Sources에 등록해야 합니다. 공용 Activity 타입은 기존대로 메인 앱과 Widget에 각각 속하도록 유지합니다. 메인 앱의 브리지 리소스를 확장 타깃에 추가해서는 안 됩니다.
- 소스 회귀 검사: `node --test mobile/tests/*.test.cjs`. `scripts/test-ios-*.py`는 네이티브 컴파일러를 호출하므로 이번 작업에서 네이티브 검증이 허용된 경우에 실행합니다. 소스 테스트 통과를 실기기 검증이나 서명 빌드의 통과로 간주해서는 안 됩니다.
