# Agent Note: 기본 세션 이름 바꾸기 및 DSH 프로젝트 구성원 경계

Status: implemented

후속 범위：[기본 세션 이름 바꾸기](2026-11-04-native-session-renames.md) 증가 보류 CLI 공식 제어 채널、DSH 짐을 실은 Session store 및 ZCode 영구 작업 서비스 및 이름이 변경된 별칭 롤백을 취소합니다. 이 문서의 기본 비활성화, ID 및 프로젝트 경계는 계속 적용됩니다.。

## 문제

공유 메뉴를 완성해야 합니다 Claude、DSH 이름 바꾸기 및 분류 항목이 있지만 메서드가 존재한다고 해서 호출에 부작용이 없다는 의미는 아닙니다.。DSH 의 `sessionController.rename` 콜드 세션을 구문 분석하거나 복원합니다. 일부 제3자 Harness 프로젝트 구성원에 대한 디렉터리 제한도 변경되었습니다. 직접 범용 전달은 세션을 시작하지 않고 디스플레이 메타데이터만 수정하며 원래 작업 디렉터리를 보존해야 한다는 제약을 깨뜨립니다.。

## 결정

Claude Code Desktop 및 Cowork 동시에 커넥터에서만 발견됩니다. `getSession` 및 `updateSession` 제공되는 경우 `mobileRename`。전화해서 이용하세요 `updateSession(sessionId, {title, titleSource: 'user'})`，목표를 먼저 확인해보세요 ID，원본에서 `getSession` 제목 다시 읽어보기、ID、cwd 및 Cowork 접는 사람. 이 메서드는 모델, 계정, 디렉터리 또는 프로젝트 필드가 아닌 제목만 전달합니다.。CLI 및 WSL 빌리지 않음 Desktop 이름 변경을 위해 메소드가 복원되지 않았습니다. CLI，직접 다시 작성하지도 않습니다. JSONL。

DSH 딱 맞아 `ctx.agents.get(id)` 기존 기본 세션은 기본 이름 변경 기능을 제공하고 동일한 기본 세션을 직접 호출합니다. `sessionTitle.rename(agent.session, title)` 제공하다. 서비스 확인 세션은 기본으로 유지됩니다. live store , 사용자 소스에서 제목 이벤트를 작성합니다.。Bridge 호출되지 않으면 암시적으로 복원됩니다. `sessionController.rename`。콜드 또는 언로드된 세션은 명시적 반환을 반환합니다. `notSent`；성공적인 쓰기는 다음에 의해 완료되어야 합니다. `sessionController.list` 확인하려면 다시 읽어보세요. 메뉴에서 Bridge 별칭 폴백은 공유 메타데이터 레이어에서 처리되며 이 어댑터에서는 기본 헤더가 위조되지 않습니다.。

DSH 기본 프로젝트 작업 사용 `workspaceRegistry.list/get` 작업공간이 있는 `attachSession/detachSession`，～에 따르면 `sessionIds` 기반이 아닌 멤버 읽기 cwd 프로젝트를 추측해보세요. 선택적 목표를 통과해야 합니다. `realpath` 확인 및 원본 cwd 같은; 제출 전 다시 확인, 작성 후 회원 및 합계 확인 cwd。타사 구현으로 인해 제약이 완화되더라도，Bridge 원래 작업 디렉터리를 변경하기 위해 프로젝트 작업을 차용하는 것도 허용되지 않습니다. 기본 파티셔닝에는 확인된 인터페이스가 없으므로 기본 파티셔닝 기능을 제공하지 않습니다.。

기본 수정 반환 `status: confirmed` 다시 읽기 확인만 나타냅니다. 쓰기 후 실패 또는 불일치는 결과를 알 수 없는 상태로 유지하고 재생되지 않습니다. 전달되지 않은 콜드 세션, 디렉터리 불일치 또는 대상 실종의 반환 결정 `notSent: true`。공유 관리자는 요청 및 재시작 시 영수증을 유지하는 역할을 담당합니다.。Claude 파일 브리지 `mobileRename` 쓰기 작업 세트에 포함, 커넥터 업그레이드 revision 13；DSH host 치받이 revision 9。DSH 이번 라운드의 기준에서 검증된 내용을 유지하세요. revision 8 LF/CRLF 소스 코드 요약은 원래 제어된 연결만 명시적 업그레이드가 보류 중인 것으로 식별하며 스캔 중에 소스 코드, 자격 증명 또는 구성을 다시 작성하지 않습니다. 새 게이트웨이는 아직 실행 중인 기존 커넥터를 새 인터페이스로 처리할 수 없습니다.。

## 기본 증거 및 검증

- 로컬 머신 Claude 3.6556.2 의 `app.asar` 가운데，Code 의 `LocalSessions.updateSession` 및 Cowork 의 `LocalAgentModeSessions.updateSession` 모두 수신 `(sessionId, options)`，하단 레이어는 메타데이터를 저장하고 업데이트 이벤트를 보냅니다.。Code 기존에 대한 책임을 지다 CLI 타이틀 싱크；Bridge 추가 작업 없음 CLI 파일 또는 통화 시작 인터페이스。
- 현지 공무원 DeepSeek Harness 커널 패키지 0.2.1-rc.3 의 `dsh-api-session-controller` 명시적으로 만든 `rename` 부르다 `resolveAgent`；해당 파서가 세션을 재개합니다.。`dsh-session-title.rename` 공공 서비스 구현에서는 네이티브만 허용됩니다. live session，추가 `session/title` 이벤트 및 사용 `source.kind: user`。
- 현지의 DSH Tauri 0.25.0 커널 작업공간 구현은 다음과 같이 제공됩니다. `dsh-tauri-worktree` 패치, 삭제된 공식 `attachSession` 같은 cwd 비교하다。Bridge 원래 제약 조건을 유지하기 위해 독립적인 디렉터리 검사가 사용됩니다. 프로젝트 API 의미론[공식 작업공간 문서](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/workspace.md)대응하다。
- `claude-session-rename.test.cjs` 에서 CDP、서명 파일의 두 가지 합성 전송 확인 Code/Cowork 이름 바꾸기, 제어 문자 및 길이 거부, 기본 ID 확인하세요. 알 수 없는 결과가 있으면 재시도하지 말고 세션을 시작하지 마세요.。
- `deepseek-session-actions.test.mjs` 콜드 세션이 활성화되지 않았는지 확인、live 타이틀 서비스 다시 읽기, 프로젝트 추가 및 제거, 타사의 느슨한 구현은 여전히 ​​교차할 수 없습니다. cwd、동일한 멤버는 반복적으로 작성되지 않으며, 알 수 없는 결과는 재시도되지 않습니다.。
- `test_claude_session_rename.py` 어댑터 기본 방법 선택, 게이트웨이 확인 ID 변환, 누락된 기능 거부 및 알 수 없는 결과. 이미 관련됨 Claude 커넥터/수명주기/owner/어댑터 및 DSH 데스크탑/플러그인/수동 바인딩 회귀 통과。

이 증거는 설치된 소스 코드와 격리된 합성 테스트에서 나옵니다. 이 프로젝트 라운드 동안 실제 사용자 채팅이 다시 작성되지 않았으며 공유 커넥터가 설치되거나 업그레이드되지 않았습니다. 업그레이드된 3시스템 및 휴대폰 실제 기계 수용과 동일하지 않습니다.。

## 대안

직접 재사용 DSH 기존의 `sessionController.rename` 가장 간결한 방법은 콜드 세션도 재정의하지만 암시적으로 세션을 재개하므로 로드된 기본 헤더 서비스만 재사용합니다. 콜드 세션의 스토리지 로그를 직접 추가하거나 다시 작성하면 기록 제목이 변경될 수도 있지만 기본 스토리지 소유권 및 활성 쓰기 확인을 우회하므로 사용되지 않습니다.。

제3자를 완전히 신뢰하세요 `attachSession` 보다 느슨한 작업공간 구성을 지원할 수 있지만 다양한 커널 패치의 디렉토리 의미 체계가 일관되지 않습니다. 이번 라운드는 동일하게 유지됩니다 cwd 경계가 뚜렷하고 Bridge 분류, 기본 마이그레이션 기능을 확장하지 않음。

## 역사적 기록 감사

이름 바꾸기를 누르세요. 원본 API、세션 메뉴 및 활성 기록의 카테고리 검색。[세션 메뉴 공유](2026-10-28-shared-session-menu.md)일부 겹치는 부분이 있습니다. 이 문서는 기본 메서드 확인 및 콜드 세션 제약 조건을 보완하며 메뉴 및 확인 동작을 대체하지 않습니다.；[DSH 범용 플러그인](2026-10-28-dsh-generic-plugin-binding.md)인스턴스 바인딩 및 수동 설치 계약을 계속 유지합니다. 이번 수정 라운드에서는 변경 사항이 적용되지 않습니다.[릴리스 중지 후 보관](2026-10-27-confirmed-disconnect-archive.md)그리고[로컬 우선순위가 상단에 고정됨](2026-10-26-local-first-session-pins.md)결정. 구현해야 하거나 거부된 동의어 이름 변경 제안이 없습니다.。

## 영향

지원되는 기본 이름 바꾸기 범위는 실제 기능 및 세션 로딩 상태를 기반으로 표시됩니다.。Claude CLI、WSL 및 DSH 콜드 세션은 기본 이름 변경을 약속하지 않습니다.；DSH 네이티브 프로젝트 후보는 현재 디렉터리에 해당하는 항목이 하나만 있을 수도 있고, 후보가 없을 수도 있습니다. 커넥터 업그레이드에는 기존 ID 및 진행 중인 쓰기 확인이 필요합니다. 코드가 업데이트되었다고 해서 실행 중인 버전이 적용되었다는 의미는 아닙니다.。
