# Agent Note: 관리됨 CLI 계정 동기화 및 알 수 없는 영수증 확인

Status: implemented

[같은 home 기본 계정 팔로우](../feature/2026-11-11-cli-follows-native-account.md)기본 외부 파일 변경 동작을 보완합니다. 명시적인 연결 우선 순위 확인이 적용되었으며 필요한 경우 안전하게 재구성될 때까지 기다립니다. 여기에서 명시적으로 관리됨 login 쓰기, 알 수 없는 수신 및 원칙 보류。

## 문제

달리기 Codex 0.164 AuthManager 자격 증명 캐싱. 같은 것만 교체 home 의 auth.json，또는 기존 파일을 허용하지 않고 별도의 단기 프로세스를 통해 파일을 확인하도록 하십시오. CLI 세션은 선택된 API 계정. 디스크를 일치시키거나 account/read 의 apiKey 성공을 입력하면 새 계정이 인터페이스에 표시되지만 이전 자격 증명은 계속 사용됩니다.。

## 결정

관리됨 Codex 계정 선택 재사용 Accounts.switch 업무 확인 및 요청 ID、계좌운영문과 동일 home 강제. 오직 에서만 Desktop 실행되지 않음, 현재 관리됨 API 구성된 provider ～을 위한 bridge_api、URL/model/파일 인증 정의는 변경되지 않았으며 env_key、실험 bearer token 또는 HTTP header 주사 할 때 다음이 허용됩니다. home 관리하다 0.164 공식적으로 서비스가 파견됨 account/login/start。나머지 분기는 기존의 명확한 유지 관리 경로를 따르며 정지 신호 범위를 확장하지 않으며 ChatGPT 계정 간 복사 token。

연결되었지만 유휴 세션은 연결을 유지하지만 연결을 유지하지 않습니다. joined 작업 실행과 동일합니다. 전환하기 전에 현재 연결, 승인, 대기 중 및 unknown 로드된 모든 스레드의 실행, 백그라운드 터미널 및 대상 상태를 보호하고 즉시 확인합니다. 또한 사용자 확인을 위해서는 전환이 완료되기 전에 다른 클라이언트가 작업을 시작하지 않아야 합니다. 여러 읽기 전용 스냅샷은 원자적으로 배타적이지 않으며 외부 클라이언트가 확인 후 새 작업을 시작하는 것을 방지하지 않습니다.。RPC 에서 CLI 방지하기 위해 잠금 외부에서 이벤트 실행 account/updated 알림이 응답보다 앞에 있을 때 읽기 스레드를 차단합니다.。

네이티브 `systemError` 있는 그대로 놔둬, 그런 척 하지 말고 `idle`。유휴 계정 확인 및 정상 CLI 릴리스 공유 `clients/codex/release.py` 최종 상태 검증: 동일한 현재 연결의 핸드셰이크 ID만 검증된 상태에 속합니다. 0.164.0 명시적으로 활성화되면 최신 기본 라운드가 명시적으로 활성화되어야 합니다. `completed` / `interrupted` / `failed` 정수로 `completedAt`，동일한 스레드에서 이후에 다시 읽어도 여전히 `systemError`，알려진 보류 중인 요청, 활성 플래그 또는 진행 중인 라운드가 없습니다. 누락된 라운드/시간, 상태 변경, 알려진 승인, ​​백그라운드 터미널, 활동 Goal 또는 알 수 없는 작업 정보가 여전히 거부됩니다. 로드된 다른 하위 스레드는 여전히 하나씩 확인됩니다. 계좌 통화 원본 `check_archive_runtime` 명시적인 `allow_terminal_error` 브랜치의 경우 원래 ID, 요청 및 라운드 검증이 유지되며 기본 보관 규칙은 변경되지 않습니다. 읽기 전용 릴리스 확인은 아직 로드된 것으로만 식별하고 구독 취소는 확인과 함께 반환됩니다. `detached`，무게를 달 수 없다 `released`。

이 결정은 정확한 것에서 비롯됩니다. 0.164.0 소스 코드：[ThreadWatchManager](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server/src/thread_status.rs#L174-L181)기록 system error 언제 지우세요 running/승인 대기 중/입력할 개수, 상태 계산을 먼저 고려합니다. [active 심벌 마크](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server/src/thread_status.rs#L447-L468)，오류 플래그는 다음 라운드까지 유지됩니다. 하지만 [Error 이벤트](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server/src/bespoke_event_handling.rs#L1044-L1066)～ 전에 TurnComplete，그러니까 그냥 보고만 있을 수는 없어 systemError 전환 허용；[TurnComplete 다루다](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server/src/bespoke_event_handling.rs#L190-L205)이번 라운드의 보류 중인 서버 요청을 중단하고 최종 상태를 완료합니다. 공식적인 [Thread DTO](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server-protocol/src/protocol/v2/thread_data.rs#L204-L294)아니요 `requests` 필드: 누락된 필드는 아무 작업도 수행하지 않습니다.“승인 목록이 비어 있습니다.”증거는 위의 상태와 완료 시간이 포함된 원래 라운드에 의존해야 합니다.。StreamError 재시도 알림이 최종 상태와 동일하지 않습니다.。

발송 전 저장 authUnknown 영수증 및 요청 원장, 바인딩 대상 계정, 서비스 생성, 구성 요약 및 자격 증명 파일 저장 stat 버전 영수증은 자격 증명이나 파생 다이제스트를 저장하지 않습니다. 반복 요청은 동일한 영수증을 확인하는 데에만 허용되며 다시는 확인하지 않습니다. login。getAuthStatus(includeToken=true, refreshToken=false) 세대를 돌려주세요 AuthManager 캐시된 자격 증명，API 진행 중인 선택된 저장된 행과만 비교합니다. 로그, 영수증 또는 프런트엔드에는 쓰지 않습니다. 캐시, 디스크, 대상 정의 및 생성이 모두 검증된 후에만 표시 active。성공 후 동기화 CLI 인증/다음 네트워크 검사에서 완료된 핫 동기화를 새로운 유지 관리로 착각하지 않도록 기준선을 구성합니다. 기준선은 확인된 구성 요약과 인증된 원시 바이트 요약만 사용하며 후속 동시 파일 변경 사항은 흡수하지 않습니다. 알 수 없는 단계에서는 디스크가 변경되더라도 활성화된 것으로 표시되지 않습니다. 통합 계정 목록은 원래 대상에 대해서만 제공됩니다.“계정 동기화 확인”，원본 재사용 requestId。

복구 대상 읽기 전용 구문 분석 재사용 현재 activeId/activeStamp。기록 및 현재 저장 home 일치하는 항목이 없으면 선택되지 않은 상태로 반환하고 명시적인 항목에 전달합니다.“현재를 누르십시오 home 기본 구성”처리를 확인하고 이전 계정 키를 재사용하지 마십시오. 소스가 충돌하는 경우 일치하는 관리 액세스가 거부됩니다. 이후에 관리되는 파일 인증을 시작하면 이전 인증이 명시적으로 지워집니다. OPENAI_API_KEY/OPENAI_BASE_URL；새로운 터미널 환경을 추측하지 마세요。provider 마이그레이션 및 외부 소스 채택 CLI 복구 트랜잭션은 다른 대상을 바인딩하고 일반 세션 ID 확인을 완화하지 않습니다.。

## 검증

macOS 공식적으로 가세요 0.164 격리 home 네이티브와 결합 Responses 서비스 검증：login A 포스트 캐시는 A；login B 나중에 통 PID 원래 스레드의 캐시와 실제 요청은 모두 B；디스크만 변경하세요. C 그 후에도 읽기 전용 캐시와 실제 요청은 여전히 B。실제 계정, 업스트림 모델, 유료 요청을 사용하지 않고 테스트 서비스가 정상적으로 종료되었습니다. 이 증거는 현실과 같지 않습니다 ChatGPT 교차 계정 로그인, 기타 시스템 또는 패키징 인터페이스가 허용됩니다.。

현재 소스 코드 게이트웨이는 또한 실제 HTTP 통합 smoke：합법적으로 로그인하세요、CSRF、UUID 작업 확인과 함께 제출 A→B，응답은 다음과 같습니다 cliAuth/complete/verified；같은 PID、동일한 스레드에서 기본 머신의 후속 합성 Responses 이용신청 B 그리고 더 이상 사용되지 않습니다 A，동일한 요청이 완료 상태를 다시 읽고 원장에는 영수증이 하나만 있습니다. 현실 joined A→열렬한 B 게시물 읽기 전용 확인 CLI 네트워크는 더 이상 공유 유지 관리의 필요성을 거짓으로 보고하지 않습니다. 그 과정이 진짜다 Accounts.switch/LocalCliSync，핵심 작업 확인, 캐시 읽기 및 네이티브 RPC 없음 mock。정상 HTTP 의 all/cli 목록은 기본 유휴 상태를 나열할 수 있습니다. seed；테스트 게이트웨이、native、픽스처 프로세스와 세 개의 루프백 리스너가 정상적으로 종료됩니다. 이 항목은 패키지 제품 또는 브라우저 작동 승인과 동일하지 않습니다.。

정위 Python 발송 전 영수증, 알 수 없는 결과가 재생되지 않음, 디스크 및 캐시 불일치, 서비스 업그레이드, 저장된 자격 증명 버전 변경, 프로세스 중단, 작업 차단, 삽입 충돌, 응답 전 알림 등이 포함됩니다.。Node Fixture Coverage 공유 확인, 알 수 없는 단계에서는 원래 대상만 확인할 수 있음, 원본 requestId 정상 완료 시 보유 및 해제됩니다. 후속 패키지 브라우저 승인은 별도로 기록되며 소스 코드 테스트로 대체되지 않습니다.。

2026-11-11，현실 `.7` 독립적인 home / native 0.164 의 A 업스트림으로 인한 요청 `503/no_available_candidate` 기본 재시도 후 실패: 최신 turn=`failed` 그리고 거기에 `completedAt`，UI 유휴, 기본 `thread/read.status` 아직 `systemError`。브라우저 컷 B 이불“채팅 또는 하위 에이전트가 실행 중이거나 확인을 기다리고 있거나 상태를 알 수 없습니다.”막힌; 정상적으로 해제되었다가 같은 장면에 다시 표시됨“아직 출시되지 않았습니다. 다시 시도해 보세요. · 원본 확인 불가 CLI 세션 상태, 연결이 해제되지 않음”。근본 원인은 유휴 및 릴리스의 이전 상태 화이트리스트가 제외되기 때문입니다. systemError，아직 모델 작업이 있는 것은 아닙니다. 읽기 전용 증거는 다음 위치에 있습니다. `.tmp/real-cli-browser-20261111/isolated-real-api-a-readonly.json`；이 소스 코드 복구는 재발행되지 않습니다. A、시작하거나 종료하지 마십시오. daemon。동일한 프로토콜에 새로운 프로토콜 픽스처를 추가합니다. failed/completedAt 수리 전 형상화, 계정 복구 및 해제 거부, 수리 후 계정 사전 확인 및 일회성 탈퇴가 허용됩니다. 진실 `.8` 브라우저 재검증은 별도로 기록되며 소스 코드 픽스처로 대체할 수 없습니다.。

## 대안

업데이트만 auth.json 비용은 가장 낮지만 동일한 세대의 측정된 기본 캐시는 변경되지 않습니다. 사용 account/read 유형 또는 새로운 독립 프로세스 검증은 디스크를 읽을 수 있음을 증명할 수 있지만 기존 서비스가 새로운 디스크를 사용한다는 것을 증명할 수는 없습니다. key。자동으로 공유 다시 시작 daemon 캐시는 다시 구축할 수 있지만 다른 클라이언트 및 백그라운드 작업에 영향을 미치며 사용자 확인 및 경계 유지 관리를 대체할 수 없습니다. 비공개로 전화 chatgptAuthTokens 수입이 가능하긴 하지만 token，그러나 이는 공개 관리 계정 동기화 계약이 아니며, 본 구현에서는 이를 사용하지 않습니다.。

할 것이다 systemError 직접적으로 귀속됨 idle 오해를 없앨 수는 있지만 넘어갈 것입니다. Error 도착하다 TurnComplete 창이므로 추가 기본 최종 상태 증거가 사용됩니다. 계속해서 다 넣어 systemError 알려지지 않은 경우에는 보수적일 수 있지만, 업스트림 장애 후 계정 수정 및 구독 취소가 오랫동안 도달할 수 없게 되어 채택되지 않습니다.。

## 영향

같은 provider 관리하다 API key 순환은 기록을 다시 시작하거나 마이그레이션하지 않고 라이브 서비스를 동기화합니다. 확인할 수 없는 경우 실제 복원되지 않은 상태가 유지됩니다. 알 수 없는 수신으로 인해 사용자는 원래 서비스를 복원해야 할 수 있습니다./구성 후 확인。ChatGPT 캐시를 통한 동일 계정 자격 증명 확인 token 계정에 넣고 subject 판사님, 누르지 마세요 token 바이트 판단; 진실 ChatGPT 이번 기본 승인에는 로그인이 포함되지 않습니다.。

systemError 추가 읽기는 현재 계정에서 유지 관리하는 기존 계정에만 사용됩니다. all-loaded scope 명시적인 출시 목표; 미래까지 확장되지 않음 loaded、다른 실행기의 연관된 하위 작업。`check_archive_runtime` 호출자와 아카이브가 전달한 범위만 확인합니다./삭제의 전체 수명 주기 scope 원래 호출자로부터 오는 이 계정 확인은 실행자 전체를 순회한다고 할 수 없습니다. 확인되지 않은 버전 및 최종 상태 기능을 명시적으로 활성화하지 않은 버전 WSL 릴리스 항목은 계속해서 보수적으로 거부됩니다. systemError；idle / active / notLoaded 원래 동작은 변경되지 않습니다.。

## 관련 메모 감사

- [통합 로컬 Codex 계정](../feature/2026-10-26-unified-codex-accounts.md)：부분적으로 겹치며 활성 선택이 포함된 단일 매니페스트를 유지합니다. 이 결정은 라이브 서비스 캐시 동기화를 보완합니다.。
- [로컬 머신 CLI 계정 동기화](../feature/2026-10-14-local-cli-account-sync.md)：부분적으로 중복되어 파일 트랜잭션, 롤백 및 플랫폼 증거를 유지합니다. 이 결정에 따라 차단되는 라이브 서비스의 기존 제한이 엄격하게 적용됩니다. API 조건에 따른 보충。
- [CLI 석방 및 안전한 회복](2026-11-10-cli-release-and-safe-recovery.md)：부분 중복, 상속은 공유 서비스를 자동으로 중지하지 않으며 알 수 없는 쓰기는 재생되지 않습니다.。
- [독립적인 Codex 액세스 구성](../feature/2026-11-01-independent-codex-home.md)：부분적으로 겹쳐서 계속 누르세요 home 계정 및 실행 ID 격리。
- proposed ～에 macOS TCC 복구는 이 인증 캐시와 아무런 관련이 없으며 원래 제안은 유지됩니다.。
