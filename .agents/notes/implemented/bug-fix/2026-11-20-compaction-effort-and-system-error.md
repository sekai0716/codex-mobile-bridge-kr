# 압축 후 추론 강도 유지와 오류 상태 복구

## 확인한 문제

Codex의 압축 전용 내부 turn은 `params.model=null`, `params.effort=minimal`,
`params.collaborationMode=null`을 포함한다. 실제 관찰한 v13 상태에서는 이 turn 뒤
`latestReasoningEffort`가 `minimal`로 바뀌었다. 직전 사용자 turn의 실행 설정은 `max`였다.
Bridge는 작업 모드를 포함한 다음 전송에서 이 값을 우선 읽어
`collaborationMode.settings.reasoning_effort`에 복사했다. 지원하지 않는 모델/강도
조합으로 요청이 실패하고 런타임 상태가 `systemError`로 바뀌었다.

기존 스트림 검증은 `systemError`를 알 수 없는 형식으로 판정했다. 따라서 Bridge의
전송, 설정 변경, 재연결이 모두 비활성화됐다. 요청 실패와 스트림 형식 변경은 다르다.

## 처리

- 작업 모드 전송의 추론 강도는 `latestThreadSettings.effort`,
  `latestCollaborationMode.settings.reasoning_effort`, `latestReasoningEffort` 순서로 읽는다.
  실제 설정에 명시된 `null`은 네이티브 기본값으로 유지한다.
- 읽을 수 있는 런타임 상태에 `systemError`를 포함한다. 알 수 없는 상태와 잘못된
  제어 데이터는 계속 거부한다. 정상 스냅샷을 받으면 기존 복구 경로가 제어를 다시 연다.
- provider, owner, 모델, 권한과 작업 디렉터리는 전송 시 기존 경로를 유지한다.
  실패한 입력을 자동으로 다시 보내지 않는다.

## 검증

`test_modes.py`에서 압축으로 생긴 `minimal`보다 실제 설정을 우선하는지와
명시적인 `null` 보존을 검사한다. `test_stream_compatibility.py`는 v13 및 이후
버전의 오류 상태를, `test_bridge.py`는 형식 거부 후 오류 스냅샷 수신으로 연결과
전송·설정·재연결 기능이 복구되는지 검사한다.
