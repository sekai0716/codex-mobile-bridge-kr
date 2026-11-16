# Claude Code CLI 접근 타당성 확인（2026-10-14）

## v2.1.0 후속 시행 현황

초기 조사의 조건과 결론은 이 페이지 하단에 유지되며 현재 기능 목록으로 사용되지 않습니다. 초기의 `--bare` 프로브 후，macOS 선정된 자격증 및 프로그램은 별도로 검증되었습니다. `CLAUDE.md` 고립된 상속; 이들 작곡/루프백 요청은 실제 지불을 나타내지 않거나 OAuth 수락. 후속 후보자는 기본 및 SSH Claude Code 닫힌 세션 복구, 신규, 전송, 모델/권한、Skill、파일 업로드, 승인 및 중단 계정 관리를 독립적으로 구성할 수 있습니다. CLI 입장. 아직 다른 터미널의 활성 작성자를 인수하지 않음。

Windows 10 x64 / Claude Code 2.1.168 및 Ubuntu 22.04.5 x64 / 2.1.287 독립을 통과하다 Test 패키지 설치、GUI 그리고 설치된 게이트웨이 CLI HTTP 완전한 답변 및 승인을 포함한 수락/거부 및 재시작 후 기록；Linux SSH 제어에는 실제 서버 승인도 포함됩니다. 위의 크로스 플랫폼 작업은 격리된 구성 및 시뮬레이션을 사용합니다. API，실제 유료 인증, 모든 프로젝트 구성 또는 실제 휴대폰이 승인되었음을 의미하지는 않습니다. 현재 기능과 제한 사항은 다음을 기반으로 합니다. [CLI 액세스 지침](codex-cli.md) 및 [수락 개요](../VERIFICATION.md#v210-platform-status) 대상。

## 초기 조사 결론

**검증 가능한 범위는 게이트웨이 자체에서 시작되고 보유됩니다. CLI 프로세스 및 종료된 세션의 명시적 복구。** 로컬 머신 Claude Code `2.1.287` 격리 환경에서 2차 통과 `--resume <session-id>` 동일한 프로세스 내에서 계속 및 두 개 `stream-json` 입력하다. 휴대폰에서 실시간 정보 제공 및 제어를 위해서는 프로세스의 입력을 잡아야 합니다./출력 채널을 사용하거나 공식 Agent SDK 스트리밍 세션 인터페이스. 기존 증거는 뒷받침하기에 불충분합니다.“사용자가 다른 터미널에서 실행 중인 모든 애플리케이션을 방해하지 않고 인계 Claude Code 프로세스”。

이 결론은 액세스 메커니즘에만 관련됩니다. 미사용 사용자 Claude 로그인, 구독 할당량, 정품 여부 API Key、실제 세션 또는 원격 호스트。Claude Desktop Code/Cowork 의 기존 커넥터는 다른 실행 경로에 속하며 이 경로에서 추론할 수 없습니다. CLI 프로세스가 인계될 수 있음。

## 초기 로컬 측정

설치됨 `/opt/homebrew/bin/claude --version` 뒤로 `2.1.287 (Claude Code)`。프로브는 프로젝트의 `.tmp/cli-expansion-20261014/claude-probe-artifacts/`（`probe.py`、`control_probe.py`、`approval_probe.py`），결과는 동일한 디렉터리의 별도 실행 폴더에 보관되며 제출에는 포함되지 않습니다. 프로브 사용 임시 `HOME` 및 `CLAUDE_CONFIG_DIR`、`--bare`、가짜 API Key、만을 가리킨다 `127.0.0.1` 의 `ANTHROPIC_BASE_URL`，필수적이지 않은 트래픽을 비활성화합니다. 현지의 HTTP 서비스는 기본 텍스트만 반환합니다./도구 호출, 외부 모델 요청 없음。

| 조사하다 | 관찰하다 | 증거 경계 |
| --- | --- | --- |
| 저장 및 콜드 복원 | 첫 번째 프로세스 출력 `LOCAL_MOCK_REPLY_1` 그런 다음 종료하십시오. 두 번째 프로세스는 동일한 것을 사용합니다 UUID `--resume` 산출 `LOCAL_MOCK_REPLY_2`，종료 코드는 모두 0。격리 디렉터리 사본은 하나만 있습니다. UUID 의 `.jsonl` 세션 파일; 두 번째 요청에 더 많은 기록 메시지가 포함되어 있습니다.（2 → 4）。 | 이 기계의 증거 2.1.287 가짜 인터페이스에서 누를 수 있음 ID 계속; 실제 가입을 증명하지 않습니다/사용 가능한 모델。 |
| 양방향 스트림 입력 | `--input-format stream-json --output-format stream-json` 동일한 프로세스에서 두 개의 사용자 메시지를 수락하면 두 개의 사용자 확인, 두 개의 성공적인 결과 및 동일한 세션이 발생합니다. ID。 | 메시지 및 결과 경로 증명。 |
| 동적 모델 | 같은 과정의 `set_model: haiku` 제어 요청 반환 `success`；그후 `system/init.model` 로컬 가짜 인터페이스로 전송된 요청은 둘 다입니다. `claude-haiku-4-5-20251001`。 | 다음 라운드가 적용될 것임을 증명하십시오. 실제 모델콜이나 구독 인증이 없습니다.。 |
| 동적 권한 | `set_permission_mode: plan` 및 `dontAsk` 모두 반환됨 `success` 및 `response.mode`；다음 두 `system/status.permissionMode` 차례로 보고하다 `plan`、`dontAsk`。 | 증명 상태 스위치; 실제 사용자 정책, 프로젝트 구성 및 도구 세트 조합이 확인되지 않았습니다.。 |
| 작동 중 중단 | 가짜 인터페이스로 인해 응답이 지연되는 경우，`interrupt` 받다 `success` 승인; 라운드는 나중에 온다 `[Request interrupted by user]` 및 `terminal_reason: aborted_streaming`，프로세스 종료 코드는 다음과 같습니다. 1。 | 인터럽트가 발생했습니다. 인터럽트 결과는 오류 최종 상태이고 액세스 계층은 제어 수신을 정상적인 응답으로 처리해서는 안 됩니다.。 |
| 도구 승인 | 가짜 모델 요청은 격리된 작업 디렉터리에서 실행됩니다. `Bash: touch approval-marker`；CLI 문제 `can_use_tool`，입력을 포함합니다、`tool_use_id`、`blocked_path` 그리고 제안된 규칙. 호스트 반환 `behavior: deny` 최종 도구 결과는 다음과 같습니다. `Synthetic host denial`，태그 파일이 존재하지 않습니다.。 | 거부 루프를 확인합니다. 허용 후 실행이 확인되지 않았습니다.、`AskUserQuestion` 또는 실제 구성. 단순한 `printf` 이불 CLI 모든 도구 호출이 승인 카드를 생성하지는 않음을 나타내는 자체 릴리스。 |
| 기록 저장 | 외딴 `.jsonl` 포함하다 user/assistant 등 이벤트。 | 이 파일은 읽기 전용 조사에만 사용할 수 있습니다. 안정적인 형식을 약속하는 공개 기록 읽기 프로토콜은 발견되지 않았으며 파일 레이아웃은 장기적인 것으로 직접 간주될 수 없습니다. API。 |

허위 서비스로 인해 1차 조사가 해결되지 않았습니다. `/v1/messages?beta=true` 쿼리 문자열은 시뮬레이션 모델 오류를 반환합니다. 가짜 서비스 경로를 수정한 후 위의 확인이 통과됩니다. 이 실패는 프로브에만 속하며, Claude Code 액세스 실패。

## 문서화 및 제어 프로토콜

- [Claude Code 헤드리스 모드](https://code.claude.com/docs/en/headless) 규제 `-p`、`--output-format stream-json`、`--continue` 및 `--resume` 행동; 운전 중 정지 가능 SIGINT 또는 SDK 의 `interrupt()`。하나의 `-p` 계속하기에 적합한 다음 작업 라운드 호출；[SDK 스트리밍 입력](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) 지속성을 위해 여러 라운드, 대기열 및 인터럽트。
- [SDK 승인 및 사용자 입력](https://code.claude.com/docs/en/agent-sdk/user-input) 사용 `canUseTool` 승인을 위한 콜백/거절하고 `AskUserQuestion`。[공식적인 Python SDK 소스 코드](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py)주어진 `control_request` / `control_response` 캡슐화、`set_model`、`set_permission_mode`、`interrupt`、`can_use_tool` 특정 필드 및 영수증 이번에는 이 구조에 따라 로컬 머신이 CLI 격리 테스트를 실시했습니다. 응답할 호스트 채널이 없거나 다음과 같이 구성되었습니다. `dontAsk` 이때, 휴대폰에 표시되는 승인 카드는 실제 대기 중인 요청과 일치할 수 없습니다.。
- [SDK 허가 문서](https://code.claude.com/docs/en/agent-sdk/permissions)세션 시작 및 실행 시 모드 지정 지원 `setPermissionMode()`；로컬 머신 CLI 도움말도 나열되어 있습니다. `--permission-mode` 및 `--model`。이 동적 모델, 허가, 중단 및 승인 거부는 로컬 가짜 인터페이스 조건 하의 프로토콜 동작만을 증명합니다.。
- [세션 문서](https://code.claude.com/docs/en/agent-sdk/sessions) 목표 회복 ID 영구 세션에서 다시 실행합니다. 설치됨 CLI 도움이 될 것입니다 `claude attach <id>` 첨부된 대로 설명됨 `--bg` 관리되는 백그라운드 작업 타사 프로그램이 기존 대화형 터미널의 표준 입력을 방해하지 않고 공유하도록 허용하는 방법을 찾을 수 없습니다./출력 및 승인 콜백을 위한 공개 인터페이스입니다. 따라서 활성 터미널의 실시간 인수가 유지됩니다.**확인되지 않음**，디자인은 그것을 기반으로 할 수 없습니다。

## 아이덴티티, 구성 및 제품 경계

조사 `--bare` 의도적으로 실제 구성 및 로그인을 우회합니다. 공식 후보 기획이 원래 사용자의 프로젝트 지침을 유지하려는 경우、Skills、hooks、MCP、공급업체 및 권한 규칙을 먼저 적절하게 감사해야 합니다. `-p` 설정 소스 및 현재 작업 디렉터리를 확인한 다음 원래 세션의 구성 상속을 확인합니다. 공식적인[헤드리스 모드 문서](https://code.claude.com/docs/en/headless)지적: 정상 `-p` 사용자가 로드됩니다./프로젝트 컨텍스트 및 작업공간 신뢰 상자는 신뢰할 수 없는 디렉터리에 대해 팝업되지 않습니다.；`--bare` 그런 다음 많은 컨텍스트를 건너뛰고 OAuth/키체인 로그인, 요구 사항 API Key 또는 주요 도우미를 지정하세요. 이번에는 사용할 수 없습니다 `--bare` 사용자의 일일 정보를 유지했다고 주장하는 데 성공했습니다. Claude Code 환경。

[Agent SDK 공식 설명](https://code.claude.com/docs/en/agent-sdk/overview)제3자 개발자가 제공할 수 없음을 분명히 하세요. claude.ai 로그인 또는 구독 한도를 사용해야 합니다. API Key 인증방법。SDK 유사한 프록시 루프를 시작할 수 있다고 해서 사용자의 Claude 이 제품으로 이전된 구독 로그인。[Remote Control](https://code.claude.com/docs/en/remote-control) 을 위한 claude.ai/code 공식적으로 Claude 모바일 버전; 규정 준수 구독이 필요합니다，API Key、사용자 정의 `ANTHROPIC_BASE_URL` 타사 업스트림이나 타사 업스트림 모두 이 경로를 지원하지 않습니다. 이는 사용자의 기존 공식 원격 제어 솔루션에 대한 참조로 사용될 수 있으며 이 프로젝트에서 재사용 가능한 공개 액세스 프로토콜이 아닙니다.。

## 초기 프로브의 후속 검증 요구 사항（이력）

먼저**게이트웨이는 전용 보유 CLI 프로세스**후보 형태로 명확하게 사용 가능한 인증 방식으로 일반 구성에서 스트리밍 다중 라운드를 다시 확인하고 허용합니다./승인거부 및 문제카드, 중단 후 갱신, 연결해제 후 재전송 불가. 각 항목은 원본을 유지해야 합니다. cwd、사용자 구성 및 공급업체 ID, 읽기 전용 오픈 채팅으로는 프로세스를 시작할 수 없습니다. 입장 SSH 선택한 호스트의 바이너리, 구성 경로, 세션 파일 및 프로세스 소유권을 다시 확인하세요. 적절한 인증 권한을 얻고 완전한 제어 평면 증거를 얻기 전에는 활성화하지 마십시오. Claude Code CLI 프로덕션 액세스。
