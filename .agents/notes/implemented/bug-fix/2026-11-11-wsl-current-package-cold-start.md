# Agent Note: WSL ～에서 current 네이티브 패키지 콜드 스타트

Status: implemented

## 문제

현실 WSL 2명에 대한 격리 수용이 완료되었습니다 writer 범위 미리보기 및 일반 릴리스, 원본 및 endpoint 둘 다 독립적으로 퇴장을 확인했습니다. 그런 다음 명시적으로 원래 내용을 계속했습니다. ID 새로운 세대가 시작되지 않았습니다. 읽기 전용 검증 확인 합성 PATH 아니요 Codex、목표 home 아니요 releases 디렉토리이지만 current/bin/codex 존재하며 실행 가능합니다. 첫 번째 성공적인 실행에 대한 기본 영수증도 파일을 다음과 같이 명시적으로 보고합니다. managedCodexPath。오래된 WSL 후보 검색만 확인 PATH、사용자 bin 및 releases，로컬 및 SSH 수락됨 current 길。

## 결정

선택한 대상만 원래 후보 목록에 추가합니다. home 의 packages/app-server-daemon/current/bin/codex，기존 실행 파일 검사 재사용, 기본 start --help 능력체크로 start 부르다. 원래 후보 우선순위, 대상 CODEX_HOME/cwd、다른 home 블록, 독립 executor 명시적인 작업만 시작할 수 있는 확인 및 범위는 변경되지 않습니다. 새로운 패키지 레이아웃이 필요하지 않으며 테스트 픽스처를 다시 구축할 필요도 없습니다. releases。

## 대안

추가 설비 생성 releases 실패를 피할 수 있지만 다음으로 인한 오류는 숨겨집니다. native 영수증으로 입증 current 패키지 계약. 새 배포 구성을 추가하거나 새 실행 프로그램을 작성할 필요가 없으며 기존 검색 및 실행 경로에는 이미 필요한 검사가 포함되어 있습니다.。

## 검증

컴포지션을 사용한 방향 회귀 current 실행 파일, 비어 있음 PATH 결과를 찾았으나 존재하지 않음 releases；원래 구현에서는 None Installed가 발생합니다. runtime，후보 추가 후 통과 및 네이티브 어설션 help/start 매개변수, 원래 대상 CODEX_HOME/cwd 및 check=True。기존 출시 경계와 함께 5 항목이 통과되고 모든 프로세스 호출이 완료됩니다. mock。

첫 번째 실제 기계의 범위 미리보기와 원래 세대의 일반 종료 결과가 유지됩니다. 현재 콜드 스타트 ​​호출의 정확도는 다음과 같습니다. stderr 원본이 아닌 helper 예약되어 있으며 입증된 것으로 설명할 수 없습니다. native start 오류를 신고하세요. 이 읽기 전용 후보 목록은 공백을 찾아 발견할 수 있을 만큼 비어 있습니다. 개정 후에도 마찬가지 ID 콜드 복구 및 정상 폐쇄는 여전히 후속 실제에 의해 결정됩니다. adapter 보충시험 확인서, 이 note 합성 회귀를 실제 머신 복구 단계라고 부르지 마세요.。

## 영향

선택된 WSL home 만 유효 current 기본 패키지를 사용하는 경우 원래 검사를 통해 콜드 연결도 시작할 수 있다는 것이 분명합니다. 수동 기록, 목록 및 알림은 서비스를 시작하지 않습니다. 그들은 상속되지 않을 것입니다. Windows 또는 로컬 기본 계정 및 에이전트。

## 관련 기록 감사

- [WSL Codex 통일된 출입구](../architecture/2026-10-24-codex-wsl-unified.md)：원래 항목과 명시적인 시작 계약을 유지하고 지원되는 네이티브 패키지의 후보 검색을 완료합니다.。
