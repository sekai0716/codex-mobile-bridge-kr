# Agent Note: 이미 가입했습니다 CLI 채팅 권한 전환

Status: implemented

## 문제

[CLI 세션 제어](2026-10-14-cli-session-controls.md)아직 허용되지 않음 CLI 채팅 수정 권한. 네이티브를 추가했습니다. CLI 데몬은 스레드별 권한 업데이트를 허용하지만 기존 UI 더 넓은 것을 사용하세요 Desktop 구성 기능은 임계값 역할을 합니다. 이 기능을 켜면 이름 바꾸기 및 관련 없는 작업도 노출됩니다. ～을 위한 SSH，게이트웨이 컴퓨터의 데스크탑 설정은 선택한 항목을 설명할 수 없습니다. CLI 실행 시간。

## 결정

CLI Chat에는 독립적인 노출 후 활성 소유권 프로세스가 있습니다. `canChangePermissions` 능력。App 보류된 채팅은 기존 기여 프로세스를 사용합니다. IPC。이미 네이티브에 가입했습니다. CLI 채팅은 선택한 데몬을 포함하여 선택한 데몬에서 구성 요구 사항, 구성 프로필 및 기능 가용성을 읽습니다. SSH 주인. 알 수 없거나 제한된 옵션은 비활성화된 상태로 유지됩니다. 전체 액세스에는 여전히 명시적인 확인 토큰이 필요합니다.。

기본 어댑터만 통과 `thread/settings/update` 선택한 프로필, 승인 정책 및 감사자를 보냅니다. 절대 수정하지 마세요 provider、인증、cwd 또는 전역 구성. 요청 설정은 직접 노출 상태가 되지 않습니다. 효율적인 `thread/settings/updated` 알림 업데이트 상태，Bridge 후속 상태 시퀀스가 ​​요청된 모드를 보고한 후에만 승인합니다. 다음에서 첨부 `thread/resume` 프로젝트 유효 허가 상태 연결 끊김 및 무효화는 다시 연결하기 전에 어댑터 상태를 지웁니다. 지원되지 않는 이전 데몬은 기능을 통해 검색되지 않으며 알 수 없는 쓰기는 재생되지 않습니다. 토종의 CLI 메시지가 명시적으로 호출됩니다. CLI 실행 시간；Desktop 권한 보유 메시지는 기존 문구를 유지합니다.。

기본 권한 대화 상자는 열릴 때 옵션과 저장 요청을 활성 런타임에 바인딩합니다. 채팅 또는 런타임 변경, 연결 끊김으로 인해 대화 상자가 닫힙니다. 선택적 요청 필드 `expectedRuntime` 설정을 쓰기 전에 세션 작업 잠금 내에서 확인하여 지연된 기본 대화 상자가 새로 첨부된 쓰기를 방지합니다. Desktop 귀속 과정. 이전 클라이언트는 이 필드를 생략해도 기존 요청 동작을 유지합니다.。

## 대안

사용 `canConfigure` 임계값만 변경하면 되지만 지원되지 않는 항목이 노출됩니다. CLI 이름 바꾸기 등 Desktop 제어. 네이티브와 SSH CLI 로컬 재사용 Desktop 선택한 런타임에 의해 비활성화되는 모드를 제공할 수 있는 기본 설정 파일입니다. 즉시 투영 요청 설정은 다음과 같습니다. RPC 후속 정책 결정이 다르더라도 허가 유효성의 증거로 성공적으로 오인됨。

## 기존 메모 감사

[CLI 세션 제어](2026-10-14-cli-session-controls.md)권한 제한 부분만 대체됩니다. 모델、Skill、계획、Goal 소속 경계 유지. 더 일찍 [CLI 연결](2026-10-14-codex-cli-access.md)、[감기 회복](2026-10-14-codex-cli-resume.md)그리고[기존 실행 소유권](../bug-fix/2026-10-14-cli-existing-owner.md)검색, 수명 및 속성 결정은 유지되며 권한 제한은 이 결정으로 대체됩니다. 아니요 proposed 또는 rejected 메모 오버레이 기본 CLI 권한 전환。

## 영향

선택한 런타임 및 정책이 허용하는 경우 로컬 및 SSH 네이티브 CLI 채팅 전환 가능 ask、auto-review 및 full-access。App 유지된 CLI 채팅 예약됨 Desktop 소지품 수표. 유효한 설정 이벤트가 도착할 때까지 기본 업데이트가 확인되지 않은 상태로 남아 있을 수 있습니다. 패널은 이 상태를 보고하고 성공을 선언하지 않습니다. 대상 어댑터, 서비스, 기능 및 UI 테스트가 통과되었습니다. 소켓 기반 HTTP 이 샌드박스에는 설비를 바인딩할 수 없습니다. 실제 데몬과 SSH 행동에는 별도의 동의가 필요합니다。

## 검증

`python -B -m unittest tests.test_codex_cli_session.CliSessionTests tests.test_cli_bridge_integration.CliBridgeTests` 의 61 재연결 상태 및 권한 이벤트를 포함한 테스트 통과。`PYTHONPATH=tests:. python -B -m unittest test_linux_permissions.CapabilityTests test_linux_permissions.LinuxReviewerCompatibilityTests` 의 7 전략 테스트 통과。`node --test tests/cli-access-ui.test.cjs tests/linux-permissions-ui.test.cjs` 의 15 개 UI 기본 및 Desktop 말씨. 메모 디렉터리 트리, 형식 및 보관 확인을 통과했습니다. 소켓을 바인딩해야 함 HTTP 이 샌드박스에서는 픽스처를 실행할 수 없습니다. 실제 런타임 및 SSH 승인은 이러한 고정 장치 검사와 별개입니다.。
