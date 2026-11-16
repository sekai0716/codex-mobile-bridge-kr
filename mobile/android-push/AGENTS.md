# 선택적 Android FCM 호스트

- 이 디렉터리에는 Firebase 푸시 초기화와 서비스만 둡니다. Activity, 다운로드, QR 코드 스캔 등 공통 네이티브 구현은 계속 `../android/src`를 참조합니다.
- Gradle은 `../shared/web`과 `../android/assets`를 모두 읽어 일반 APK와 같은 리소스를 포함해야 합니다. 에셋 파일명은 중복되어서는 안 됩니다.
- 일반 APK에 Firebase 의존성을 추가하지 않습니다. 프로젝트 키, google-services 설정, 서명 파일을 커밋하지 않습니다.
- 나머지 Android 보안·검증 요구사항은 `../android/AGENTS.md`를 따릅니다.
