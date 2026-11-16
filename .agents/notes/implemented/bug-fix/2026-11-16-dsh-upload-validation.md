# DSH Android 파일 선택 결과 검증

## 변경

DSH의 파일 선택 결과를 WebView에 전달하기 전에 일반 Android 화면과 같은 URI 검증을 적용한다. 두 Activity는 `UploadFiles.readable`을 공유한다.

- 외부 provider의 `content:` URI만 허용한다.
- 앱 자신의 UID로 실행되는 provider, 존재하지 않는 provider, 읽을 수 없는 파일은 거부한다.
- 읽기 확인용 파일 디스크립터는 즉시 닫는다.
- provider 접근은 백그라운드에서 실행한다. 페이지 탐색·Activity 종료·새 선택 이후의 검사 결과는 이전 콜백에 전달하지 않는다.
- 정상 단일·다중 선택과 기존 파일 순서를 유지한다.

## 검증

`python3 -B scripts/test-mobile-uploads.py`는 실제 helper와 Activity 메서드를 합성 provider·실행 큐에서 실행한다. 정상 선택, 잘못된 URI, 읽기 거부, 취소, 탐색, 종료, 새 선택과 늦은 완료를 포함한 assertion 100개가 통과했다. Android CI에서도 같은 검사를 실행한다.

Android API 36과 ZXing 3.5.3을 사용해 Java 소스 33개를 Java 8 대상으로 컴파일했다. 클래스 74개가 생성됐다.

실기기 설치와 시스템 파일 선택기의 실제 동작은 검증하지 않았다.
