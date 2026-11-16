# Agent Note: 기본 세션 ID 복사

Status: implemented

## 문제

채팅을 공유하려면 원래 클라이언트의 ID가 필요하며 세션을 활성화하거나 복제해서는 안 됩니다.。

## 결정

부작용 없음 BridgeSessionLinks.text 보조 함수는 네이티브로 반환됩니다. SSH hostId 의 Codex 실 URL，또는 원본 Harness Session ID。지원되지 않음 provider、유효하지 않은 Codex ID 및 WSL 엔드포인트 요약이 반환됨 null。세부 작업 사용법 BridgeClipboard，포함하다 HTTP 및 수동 복사 대체。Codex 제목 세부 정보는 메시지 관리 및 이름 바꾸기와 별도로 실행 호스트 옆에 복사 작업을 배치합니다.。Harness 세부정보 노출 원본 네이티브 Session ID。

복사 컨트롤은 이전 버전을 유지하는 것으로 알려져 있습니다. `message-copy` 수업: 게시됨 iOS/Android 주입 스크립트는 다음만 허용합니다. `message-copy` 또는 `code-copy` 웹사이트에서 신뢰할 수 있는 클릭이 발생하며, 각 클릭은 한 번만 소비됩니다. 그들은 덮는다 `BridgeClipboard.copy`，따라서 새 휴대폰 패키지만 바꾸는 것만으로는 기존 휴대폰을 수리할 수 없습니다. App。공유됨 `copyWithFeedback` 어댑터는 이 재정의 구현을 호출하고 브라우저가 확인하는 경우 또는 이전 기본 후크가 텍스트를 요청하고 실패 보고에 실패한 경우에만 메시지를 표시하고 확인 성공 태그를 설정합니다. 오래된 성공 태그나 자동으로 거부된 클릭을 새로운 확인으로 처리하지 마십시오. 브라우저의 수동 복사 대체는 후속 재시도가 성공한 후에만 메시지를 표시합니다. 기본 거부는 여전히 기존에 표시되는 오류 이벤트를 사용합니다. 토큰、frame、origin、전경 및 신뢰할 수 있는 클릭 확인은 변경되지 않았습니다.。

## 대안

각각 넣어 Bridge host 모두 Desktop hostId，허락할 것이다 WSL 링크는 유효한 것으로 보이지만 실제 끝점은 내부 레지스트리 다이제스트이므로 도우미 함수가 ID를 거부합니다. 시작하다 Desktop URL 복사하는 대신 세션을 엽니다.。

## 영향

복제는 세션을 활성화하거나 수정하지 않습니다. 토종의 WSL Desktop 매핑은 아직 지원되지 않습니다.。tests/session-links.test.cjs 기본 ID 및 지원되지 않는 조건을 확인합니다. 기존 클립보드 테스트는 복사 대체를 다룹니다.。`tests/mobile-copy-compat.test.cjs` 실제 링크에서는 파일/디렉토리와 Harness 운영상 그렇습니다 iOS/Android 불변 실행 v2.1.5 공유 주입 장치（ v2.1.4 바이트 일관성）, 기본 거부 및 만료 태그 포함. 클립보드, 딥 링크 및 세션 ID로 활성 노트를 검색합니다. 기존 링크 결정을 찾을 수 없습니다.；WSL 통합 아키텍처는 ID 경계에서 부분적으로 겹치며 변경되지 않습니다.。
