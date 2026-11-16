## v2.2.1 · Antigravity 액세스, 대화형 그래프 및 기본 세션 호환성 개선

**최신 버전에 적응하려면 업데이트하는 것이 좋습니다 Codex APP 기본 연결。**

v2.2.1 새로운 Antigravity 액세스 및 채팅 내 상호 작용 차트가 개선되었습니다. CLI 연결 관리, 모델 캐싱 및 파일 찾아보기, 새 버전에 대한 수정 사항 Codex 연결 문제, 장시간 세션 읽기 및 모바일 연결 복구 문제。

### 새로운 추가 및 개선 사항

- **Antigravity 원격 작업대。** 휴대폰과 Web 확인하다 App、IDE、CLI 기본 기록, 지원되는 기본 연결을 통해 계속 채팅하고, 새 프로젝트에서 채팅하고, 모델을 전환하고, 첨부 파일을 보내고 승인을 처리하세요. 기본 질문 및 대기 상호 작용 보완, 하위 작업 관리, 기록 이미지 미리 보기 및 초안에 추가 기본 서비스에서 제공하는 실제 모델 할당량 및 컨텍스트 사용량을 표시합니다. 지원되는 기본 기본 구성은 가용성을 확인한 후 계정 및 스위치의 복사본을 저장합니다.。[PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150) · [PR #170](https://github.com/try2love/codex-mobile-bridge/pull/170)
- **채팅 내 상호작용 그래프。** Codex 답장으로 visualize 슬라이더, 버튼, 테마 적용 및 전체 화면 보기를 지원하여 콘텐츠를 직접 표시할 수 있습니다. 채팅을 다시 열면 차트의 저장된 상호 작용 상태가 복원됩니다. 차트 질문은 입력 상자에 입력하고 편집 후 사용자가 보낼 수 있습니다.。[#166](https://github.com/try2love/codex-mobile-bridge/issues/166) · [PR #167](https://github.com/try2love/codex-mobile-bridge/pull/167)
- **CLI 연결 및 네트워크 관리。** ～에 따르면 Agent、환경 및 구성 보기 연결을 실행하고, 단일 또는 구성 범위 릴리스를 지원하고, 공유 서비스 작업의 영향 범위를 표시합니다. 로컬 액세스, 에이전트 변경 확인 및 네트워크 복구 진입을 지원하는 계정이 추가되었습니다. 업무, 승인, 전송 결과가 불분명할 경우 검증 프로세스를 유지합니다.。[#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **사이드 채팅 및 와이드스크린 읽기。** 기본 사이드 채팅의 상위-하위 관계를 유지하고 명확한 임시 사이드 채팅 입구를 제공하며 입력, 첨부 파일, 모델 및 승인 인터페이스를 재사용합니다. 와이드 스크린에서는 채팅 목록을 축소하여 현재 대화를 읽을 수 있는 공간을 더 확보할 수 있습니다.。[#149](https://github.com/try2love/codex-mobile-bridge/issues/149)
- **파일 탐색 및 채팅 작업。** 승인된 호스트 디렉터리, 전체 경로 탐색 및 프로젝트 폴더로 돌아가기를 지원하며 채팅 파일 링크를 대상에 찾을 수 있습니다. 증가하다 `/` 명령 입구, 선택적 새 채팅 이름, 기본 상호 작용 시간 및 인증된 오디오 및 비디오 첨부 파일 재생, 간소화된 알림 입구。[#160](https://github.com/try2love/codex-mobile-bridge/issues/160) · [#154](https://github.com/try2love/codex-mobile-bridge/issues/154) · [#161](https://github.com/try2love/codex-mobile-bridge/issues/161) · [#148](https://github.com/try2love/codex-mobile-bridge/issues/148) · [#158](https://github.com/try2love/codex-mobile-bridge/issues/158) · [#141](https://github.com/try2love/codex-mobile-bridge/issues/141)
- **웹 및 데스크톱 경험。** 자체 서버＋SSH 입구는 사용자 정의를 지원합니다 HTTPS 포트；macOS 메뉴 표시줄에 단색 아이콘 사용。[#145](https://github.com/try2love/codex-mobile-bridge/issues/145) · [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) · [#156](https://github.com/try2love/codex-mobile-bridge/issues/156) · [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157)

- **WSL 상태 및 시작 항목。** 쿼리 실패 시 중지에 대한 잘못된 긍정을 방지하려면 릴리스 버전 중지와 확인되지 않은 상태를 구별하세요.；Codex 및 Claude 게이트웨이 및 직접 애플리케이션 관리 목록 제공“시작 및 연결 WSL”，그리고 고치다 WSL Claude 의“채팅 보기”점프 실패。

### 수정 및 최적화

- **새 버전 복원 Codex 세션 연결。** 데스크탑에 적응 v13 프로토콜을 동기화하고 구조적으로 호환되는 후속 버전을 확인한 후 동기화를 계속합니다. 주요 작업이나 승인 구조를 식별할 수 없는 경우 기록과 초안이 유지되고 제어가 일시 중단되며 업그레이드가 요청됩니다.。[#168](https://github.com/try2love/codex-mobile-bridge/issues/168) · [PR #169](https://github.com/try2love/codex-mobile-bridge/pull/169)
- **수리하다 Antigravity 일정 시간 동안 실행한 후 오프라인으로 잘못 판단되었습니다.。** 로그가 큰 경우 헤드 및 테일 포트 정보를 동시에 읽고 로그 읽기 양을 제한하며 포트 및 대상 프로세스의 소유권을 계속 확인합니다.。[PR #171](https://github.com/try2love/codex-mobile-bridge/pull/171)
- **긴 세션 읽기 개선。** 한계 Antigravity 매우 긴 단일 라운드에서 기록 페이지에 입력되는 데이터의 양입니다. 피하다 Claude 지속적인 스트리밍 기록은 최근 메시지 페이지에 표시되며 페이지 외부 완료 상태에 대한 관련 정보를 유지합니다.。
- **모델 목록이 더 안정적입니다.。** 현재 계정과 액세스된 모델 캐시를 재사용합니다. 목록 획득이 실패할 경우 명확한 수동 모델 선택 및 초안을 유지합니다. 잘못된 청산 옵션을 피하거나 계정 전체에서 이전 목록을 재사용하지 않도록 계정 변경과 임시 획득 실패를 구별하세요.。
- **연결 복구 및 애플리케이션 시작 개선。** 수리하다 Windows 스토어 버전 Codex 시동 및 준비상태 판단、Claude 초기화 실패 후 재시도 상태 및 일부 기본 런타임 호환성 문제. 개선됨 DSH 커넥터 복구 ZCode 창 인식。[#153](https://github.com/try2love/codex-mobile-bridge/issues/153)
- **전화 연결 및 탐색 수정。** 개선하다 iOS 컴퓨터, 백그라운드 복구 및 연결 페이지 보안 영역에 들어가십시오.；Android 채널 검색 프로세스 중에 컴퓨터 목록으로 돌아가서 완료할 수 있습니다. Cookie 마이그레이션 및 게이트웨이 ID 보존。[#159](https://github.com/try2love/codex-mobile-bridge/issues/159)
- **업데이트 및 인터페이스 세부정보 개선。** macOS 업데이트 후 시스템 시작 메커니즘을 통해 다시 열기 App，접근성 인증 ID 연결 개선；Windows 업데이트를 다운로드하기 전에 앱 사용량을 확인하세요. 로그인 상태 프롬프트가 완료되지 않고 중국어와 영어 간에 전환되는 문제를 수정했습니다.。

### 사용 지침

**Android 설치 지침：** 새 버전 **Bridge** 이전 버전으로 v2.2.0 App 독립적으로 설치되며 이전 버전을 직접 덮어쓸 수 없습니다. 먼저 새 버전을 설치한 후 컴퓨터를 다시 추가하고 연결이 정상인지 확인하고 필요한 초안을 이전 버전에 유지한 후 이전 버전을 제거하시기 바랍니다. 레거시 바인딩 및 초안은 자동으로 마이그레이션되지 않습니다. 설치됨 v2.2.1-preview.1 독립적인 **Bridge Preview** 사용자는 업그레이드를 직접 덮어쓰고 미리보기를 유지할 수 있습니다. App 연결 및 초안。

휴대폰 기본 내비게이션, 대화형 차트 및 연결 복구 개선 사항을 해당 휴대폰에서 동시에 업데이트해야 합니다. App。iOS 소스 코드 및 서명되지 않음 IPA 여전히 서명하고 직접 설치해야 합니다.。

Antigravity 계정 전환, 독립 클라이언트 및 WSL 관련 기능은 현재 플랫폼 및 액세스 지원에 따라 달라집니다. 임시 사이드 채팅은 지원되는 로컬 데스크톱 포털에만 적용되고 기본 기록을 기록하지 않으며 게이트웨이를 다시 시작한 후에는 복원되지 않습니다. 프로젝트 외부의 파일 탐색은 읽기 전용입니다. 전송, 승인 및 전환 결과를 알 수 없는 경우 작업이 자동으로 재생되지 않습니다.。

### 기여하다

고마워하는 [@windowmmk](https://github.com/windowmmk) 에서 [PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150)、[PR #170](https://github.com/try2love/codex-mobile-bridge/pull/170) 및 [PR #171](https://github.com/try2love/codex-mobile-bridge/pull/171) 기부금 Antigravity 액세스, 계정 관리, 기본 상호 작용 및 로그 검색 복구 감사해요 [@heiqiu47](https://github.com/heiqiu47) 에서 [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146)、[PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157)、[PR #167](https://github.com/try2love/codex-mobile-bridge/pull/167) 및 [PR #169](https://github.com/try2love/codex-mobile-bridge/pull/169) 사용자 정의에 기여 HTTPS 포트, 메뉴 표시줄 아이콘, 대화형 다이어그램 및 Codex 프로토콜 호환성 개선。

---

## English · Antigravity, interactive charts and native session compatibility

**Updating is recommended for native connections to the latest Codex App.**

v2.2.1 adds Antigravity integration and interactive charts in chats, improves CLI connection management, model caching and file browsing, and fixes newer Codex connections, long-history reads and mobile recovery.

### Features and improvements

- **Antigravity workbench:** browse local App, IDE and CLI history and use supported native connections for chats, project creation, models, attachments and approvals. Handle native questions and waiting interactions, manage child tasks, preview historical images and add them to drafts. Display model quotas and context usage supplied by the native service. Supported default local profiles can save account snapshots and switch after idle-state checks. [PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150) · [PR #170](https://github.com/try2love/codex-mobile-bridge/pull/170)
- **Interactive charts:** render Codex visualize content with controls, themes and full-screen viewing. Restore saved widget state when reopening a chat; place chart follow-up prompts in the composer for review and manual sending. [#166](https://github.com/try2love/codex-mobile-bridge/issues/166) · [PR #167](https://github.com/try2love/codex-mobile-bridge/pull/167)
- **CLI management:** group connections by agent, runtime and profile, release individual or profile-scoped connections, and preview shared-service impact. Check supported local account and proxy changes and recover network access while retaining task, approval and uncertain-send checks. [#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **Side chats and wide layouts:** preserve native parent-child relationships, provide explicit temporary side chats with shared controls, and collapse the chat list without leaving the conversation. [#149](https://github.com/try2love/codex-mobile-bridge/issues/149)
- **Files and chat controls:** browse authorized host directories, navigate by full path, return to the project, and locate linked files. Add a `/` command menu, optional new-chat names, native interaction timestamps, authorized media playback and simpler reminders. [#160](https://github.com/try2love/codex-mobile-bridge/issues/160) · [#154](https://github.com/try2love/codex-mobile-bridge/issues/154) · [#161](https://github.com/try2love/codex-mobile-bridge/issues/161) · [#148](https://github.com/try2love/codex-mobile-bridge/issues/148) · [#158](https://github.com/try2love/codex-mobile-bridge/issues/158) · [#141](https://github.com/try2love/codex-mobile-bridge/issues/141)
- **Desktop and network:** custom HTTPS ports for SSH server entries and a monochrome macOS menu-bar icon. [#145](https://github.com/try2love/codex-mobile-bridge/issues/145) · [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) · [#156](https://github.com/try2love/codex-mobile-bridge/issues/156) · [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157)

- **WSL status and startup:** distinguish stopped distributions from unavailable status queries, and expose Start and connect WSL in gateway and direct-connection management lists for Codex and Claude, and fix navigation from WSL Claude entries to their chat list.

### Fixes

- Restore Codex Desktop v13 synchronization and validate structurally compatible later versions. Preserve history and drafts while pausing controls when critical task or approval state cannot be understood. [#168](https://github.com/try2love/codex-mobile-bridge/issues/168) · [PR #169](https://github.com/try2love/codex-mobile-bridge/pull/169)
- Preserve Antigravity port discovery in large logs with bounded head-and-tail reads and process ownership checks. [PR #171](https://github.com/try2love/codex-mobile-bridge/pull/171)
- Bound long Antigravity turns in history pages. Keep persisted Claude stream history out of recent pages while preserving completion anchors outside the page.
- Reuse account-scoped model caches, retain explicit manual choices and drafts during catalog failures, and distinguish account changes from temporary discovery errors.
- Improve Windows Store Codex startup, Claude initialization retries, native runtime compatibility, DSH connector recovery and ZCode window matching. [#153](https://github.com/try2love/codex-mobile-bridge/issues/153)
- Improve iOS entry, foreground recovery and safe areas. Allow Android users to return to the computer list during connection probing, and improve cookie migration and gateway identity preservation. [#159](https://github.com/try2love/codex-mobile-bridge/issues/159)
- Relaunch macOS updates through the system launcher to improve accessibility identity continuity. Check Windows update blockers before downloading, and refresh dynamic login messages when changing languages.

### Notes

**Android installation:** The new **Bridge** app installs alongside the old v2.2.0 app and cannot replace it in place. Install Bridge, add your computers and verify the connections first. Preserve any drafts you need from the old app before uninstalling it; old bindings and drafts do not migrate automatically. Users of the separate v2.2.1-preview.1 **Bridge Preview** app can upgrade in place and retain that preview app’s connections and drafts.

Update the mobile app for native chart navigation and connection recovery improvements. iOS source and unsigned IPA packages require your own signing.

Antigravity account switching, independent profiles and WSL features depend on platform and integration support. Temporary side chats are limited to supported local desktop integrations, do not enter native history and do not survive gateway restart. Browsing outside the project remains read-only. Unknown sends, approvals and switches are not automatically replayed.

Thanks to [@windowmmk](https://github.com/windowmmk) for Antigravity contributions in [#150](https://github.com/try2love/codex-mobile-bridge/pull/150), [#170](https://github.com/try2love/codex-mobile-bridge/pull/170) and [#171](https://github.com/try2love/codex-mobile-bridge/pull/171); and [@heiqiu47](https://github.com/heiqiu47) for HTTPS ports, the menu-bar icon, interactive charts and Codex compatibility in [#146](https://github.com/try2love/codex-mobile-bridge/pull/146), [#157](https://github.com/try2love/codex-mobile-bridge/pull/157), [#167](https://github.com/try2love/codex-mobile-bridge/pull/167) and [#169](https://github.com/try2love/codex-mobile-bridge/pull/169).


---

## v2.2.1-preview.1 · Antigravity 연결、CLI 연결 관리 및 세션 경험 개선

이 미리보기 버전의 새로운 기능 Antigravity 접근성, 개선에 집중 CLI 연결 해제 및 복구, 사이드 채팅 및 파일 탐색, 복구 Windows 클라이언트 시작, 휴대폰 연결 복구 및 모델 목록 읽기 문제。

### 새로운 추가 및 개선 사항

- **Antigravity 연결。** 휴대폰과 Web 확인하다 Antigravity App、IDE、CLI 기본 기록, 지원되는 기본 연결을 사용하여 계속 채팅하고, 새 프로젝트에 대해 채팅하고, 모델을 전환하고, 첨부 파일을 보내고, 승인을 처리하세요. 소스별로 표시되는 계정 정보를 추가하고 기본 로컬 컴퓨터를 지원합니다. Google 로그인 계정 복사 관리。[PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150)
- **CLI 연결 관리가 더욱 명확해졌습니다.。** 현재를 누르십시오 Agent、로컬 머신／SSH／WSL 단일 또는 구성 범위 릴리스를 지원하는 구성 그룹화. 공유 서비스를 운영하기 전에 실제 영향 범위를 표시하고, 작업 종료 대기, 강제 해제 해제 및 확인 대기 결과를 구분합니다. 릴리스 후 원래 세션을 재개하는 프로세스 개선。[#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **CLI 계정 및 네트워크 복구。** 지원되는 로컬 액세스에서 기본 계정 및 에이전트의 변경 사항을 확인하고 네트워크 복구 입구를 추가합니다. 서비스를 재구축해야 하는 경우 먼저 작업 및 승인을 확인하고 전송되지 않은 콘텐츠를 보관해야 합니다.。SSH 및 WSL 각자의 계정, 디렉터리, 운영 환경을 계속해서 사용하세요.。
- **기본 및 임시 사이드 채팅。** 기본 사이드 채팅은 상위 대화 워크벤치에 계속 남아 있습니다. 명확한 임시 사이드 채팅 입구가 복원되고 일반 채팅의 입력, 첨부 파일, 모델 및 승인 인터페이스가 재사용됩니다. 하위 라벨 정렬 문제를 수정하고 Windows 기본 사이드 채팅의 런타임 연결 문제。[#149](https://github.com/try2love/codex-mobile-bridge/issues/149)
- **더욱 완벽한 파일 탐색。** 파일 페이지는 권한이 검증된 호스트 디렉터리, 전체 경로 탐색 및“프로젝트 폴더로 돌아가기”；채팅의 파일 링크를 통해 해당 파일을 찾을 수 있습니다. 프로젝트 외부 탐색은 읽기 전용이며 참조 업로드 및 전송은 여전히 ​​원래 프로젝트 범위를 따릅니다.。[#160](https://github.com/try2love/codex-mobile-bridge/issues/160)
- **채팅 작업 공유。** 입력 상자가 추가되었습니다. `/` 명령 입력은 현재 액세스에서 지원되는 작업을 재사용합니다. 새 채팅 이름은 선택 사항으로 변경되며, 공백으로 두면 기본 자동 이름 지정 동작이 유지됩니다.。[#154](https://github.com/try2love/codex-mobile-bridge/issues/154) · [#161](https://github.com/try2love/codex-mobile-bridge/issues/161)
- **메시지 표시 및 알림。** 읽을 수 있는 기본 상호 작용 날짜 및 시간 표시, 인증된 오디오 및 비디오 첨부 파일 재생 지원, 대화 알림 항목 간소화 및 독립적인 알림 제어 유지。[#148](https://github.com/try2love/codex-mobile-bridge/issues/148) · [#158](https://github.com/try2love/codex-mobile-bridge/issues/158) · [#141](https://github.com/try2love/codex-mobile-bridge/issues/141)
- **연결 및 데스크톱 환경。** 자체 서버＋SSH 입구는 사용자 정의를 지원합니다 HTTPS 포트；macOS 메뉴 표시줄은 단색 아이콘을 사용합니다.。[#145](https://github.com/try2love/codex-mobile-bridge/issues/145) · [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) · [#156](https://github.com/try2love/codex-mobile-bridge/issues/156) · [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157)

### 수정 및 최적화

- 수리하다 Windows 스토어 버전 Codex 초기화 및 콜드 스타트 ​​복구 개선을 위한 스타트업 ID, 공유 운영 환경 및 준비 상태 판단。
- 개선하다 Windows Claude、Codex 정상 종료 시 창 동작; 결정된 ZCode 로컬로 연결된 창 경로 일치 문제。[#153](https://github.com/try2love/codex-mobile-bridge/issues/153)
- 개선하다 DSH 누락된 커넥터의 확인 및 수리 및 기존 커넥터와의 호환성. 커넥터에 이상이 있어도 애플리케이션 종료를 독립적으로 확인할 수 있습니다.。
- 수리하다 iOS 컴퓨터에 들어갈 때 오랫동안 연결 페이지에 머무르고 백그라운드 중단 후 계속할 수 없으며 연결 페이지“더”버튼의 안전 영역 문제; 개선됨 Android Cookie 마이그레이션 및 게이트웨이 ID 보존。[#159](https://github.com/try2love/codex-mobile-bridge/issues/159)
- 프로젝트 디렉터리 또는 기록 파일이 누락된 경우 모델 목록을 사용할 수 없는 문제가 수정되었습니다. 향상된 독립성 CLI 발견하다、WSL 첫 번째 스캔과 명시적 시작 비교。
- 일부 호스트가 읽지 못하는 경우 성공적으로 로드된 채팅 목록이 유지되고 해당 오류 및 재시도 항목이 제공됩니다. 파일 페이지의 연속 반환 및 지연 응답 처리가 개선되었습니다.。
- Windows 업데이트하기 전에 설치에 영향을 미치는 응용 프로그램의 사용을 확인하여 다운로드가 완료된 후 업데이트할 수 없는 상황을 줄이십시오.。

### 사용 및 업그레이드 범위

이것은 미리보기 버전입니다. 연결 복구에 대한 피드백을 환영합니다.、CLI 릴리스, 사이드 채팅 및 Antigravity 실제 액세스 경험. 데스크톱 및 iOS 설치를 덮어쓸 때 원래 애플리케이션 ID, 서명 및 데이터 디렉터리를 유지하십시오. 먼저 제거하지 마십시오.。Android 이번에는 독립된 서비스를 제공합니다. **Bridge Preview**，요하라 App 공존하다; 원본을 보관해주세요 App，그리고 미리보기 App 컴퓨터 연결을 다시 추가하면 원본 바인딩과 초안이 자동으로 마이그레이션되지 않습니다. 휴대폰의 기본 연결 복원과 같은 변경 사항을 적용하려면 해당 휴대폰을 업데이트해야 합니다. App。

Antigravity、독립적인 구성 및 WSL 관련 기능은 여전히 ​​현재 액세스의 실제 지원에 따릅니다. 임시 사이드 채팅은 지원되는 로컬 데스크톱 포털에만 적용 가능하고 기본 기록을 쓰지 않으며 게이트웨이를 다시 시작한 후에는 복원되지 않습니다. 탭을 닫는 것과 임시 세션을 종료하는 것은 다른 작업입니다. 복구 및 해제 결과를 알 수 없는 경우 메시지나 작업이 자동으로 재전송되지 않습니다.。iOS 소스 코드 및 서명되지 않음 IPA 여전히 서명하고 직접 설치해야 합니다.。

### 기여하다


고마워하는 [@windowmmk](https://github.com/windowmmk) 에서 [PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150) 에서 제공 Antigravity 기본 사항에 액세스하고 [@heiqiu47](https://github.com/heiqiu47) 에서 [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) 및 [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157) 사용자 정의에 기여한 내용 HTTPS 항구 macOS 메뉴바 아이콘 개선。

---

### English · Antigravity, CLI connection management and chat improvements

This preview adds Antigravity integration and improves CLI handoff and recovery, side chats, file browsing, Windows startup and mobile connection recovery.

- **Antigravity:** browse local App, IDE and CLI history and use supported native connections for chat continuation, project chats, model selection, attachments and approvals. View source-specific account information and manage snapshots for supported default local Google sign-ins. [PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150)
- **CLI management:** group connections by agent, local/SSH/WSL runtime and verified configuration. Preview the impact of shared-service operations, wait for active work, explicitly force supported releases, and distinguish uncertain results from completed handoffs. [#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **Account and network recovery:** check native account and proxy changes for supported local CLI connections. Preserve unsent input while checking tasks and approvals before service recovery. SSH and WSL retain their own accounts and environments.
- **Side chats:** keep native side chats in the parent workbench and restore an explicit temporary side-chat option using shared chat controls. Fix attached-tab layout and Windows native side-chat runtime connections. [#149](https://github.com/try2love/codex-mobile-bridge/issues/149)
- **Files:** browse authorized host directories, navigate by full path, return to the chat project and locate files referenced in messages. Browsing outside the project remains read-only; uploads and send-time references retain project boundaries. [#160](https://github.com/try2love/codex-mobile-bridge/issues/160)
- **Chat controls:** add a shared `/` command menu, optional names for new chats, available native message dates and times, authorized audio/video playback, and simpler notification controls. [#154](https://github.com/try2love/codex-mobile-bridge/issues/154) · [#161](https://github.com/try2love/codex-mobile-bridge/issues/161) · [#148](https://github.com/try2love/codex-mobile-bridge/issues/148) · [#158](https://github.com/try2love/codex-mobile-bridge/issues/158) · [#141](https://github.com/try2love/codex-mobile-bridge/issues/141)
- **Network and desktop:** support custom HTTPS ports for SSH server entries and a monochrome macOS menu-bar icon. [#145](https://github.com/try2love/codex-mobile-bridge/issues/145) · [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) · [#156](https://github.com/try2love/codex-mobile-bridge/issues/156) · [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157)
- **Fixes:** improve Windows Store Codex launch identity and readiness, quiet native exits, ZCode window matching, DSH connector recovery, iOS entry deadlines and foreground recovery, Android cookie migration, model catalogs without saved history, and partial chat-list refreshes. Check Windows update blockers before downloading. [#153](https://github.com/try2love/codex-mobile-bridge/issues/153) · [#159](https://github.com/try2love/codex-mobile-bridge/issues/159)

For desktop and iOS upgrades, retain the existing identity, signature and data directory; do not uninstall first. Android is supplied as a separate **Bridge Preview** app that coexists with the original app. Keep the original app and add your computer connections to Preview; existing bindings and drafts are not migrated automatically. Update the corresponding mobile app for native connection changes. Antigravity, independent profiles and WSL capabilities depend on the selected native integration. Temporary side chats are limited to supported local desktop entry points, do not enter native history and do not survive gateway restart. Closing a tab does not end a temporary chat. Unknown writes are not automatically replayed. iOS source and unsigned IPA packages require your own signing.


Thanks to [@windowmmk](https://github.com/windowmmk) for the Antigravity foundation in [PR #150](https://github.com/try2love/codex-mobile-bridge/pull/150), and [@heiqiu47](https://github.com/heiqiu47) for [PR #146](https://github.com/try2love/codex-mobile-bridge/pull/146) and [PR #157](https://github.com/try2love/codex-mobile-bridge/pull/157).

---

## v2.2.0 · ZCode 액세스, 다중 채널 연결 및 기본 세션 관리

v2.2.0 할 것이다 ZCode 휴대폰 다중 채널 전환, 기본 사이드 채팅 및 계정 모델 관리를 개선하고 연결 복구, 알림 및 백그라운드 리소스 사용을 개선하기 위해 원격 워크벤치를 추가했습니다.。

## 새로운 추가 및 개선 사항

- **ZCode 원격 작업대。** 휴대폰과 Web 저장된 기록을 찾아보고, 기본 채팅을 계속하고, 첨부 파일을 보내고, 질문에 답하고, 승인을 처리하세요. 새로운 프로젝트 채팅, 모델 및 사고 강도 지원、Skill、지점 및 기본 이름이 변경되었습니다. 로컬 연결 및 공식 원격 제어 액세스를 제공합니다. 구체적인 방법은 플랫폼 및 설치 패키지의 지원에 따라 달라집니다. 맞춤설정 저장 API，모델별 공식 계정에서 제공하는 할당량을 확인하고 수동으로 새로고침하세요.。[#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#116](https://github.com/try2love/codex-mobile-bridge/issues/116) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124) · [#128](https://github.com/try2love/codex-mobile-bridge/issues/128) · [#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **하나의 컴퓨터, 여러 개의 연결 입구。** 동일한 게이트웨이의 LAN을 고정에 연결하십시오. HTTPS 일시적이고 HTTPS 컴퓨터 카드에 통합되어 지연 보기, 수동 선택 및 자동 전환을 지원합니다. 사용 가능한 주소가 도달할 수 없는 것으로 잘못 판단되는 상황을 줄이기 위해 다시 로그인한 후 신뢰할 수 있는 채널 복구를 개선합니다. 채팅, 초안 및 읽기 위치를 유지하기 위해 줄을 변경합니다.。[#125](https://github.com/try2love/codex-mobile-bridge/issues/125)
- **기본 사이드 채팅이 기본 대화로 돌아갑니다.。** ～에 따르면 Codex 기본 상위-하위 관계는 일반 채팅 작업을 재사용하여 기본 세션의 하위 탭으로 열리는 사이드 채팅이 이미 있음을 보여줍니다. 탭을 닫는 것은 더 이상 기본 채팅을 삭제하는 것과 동일하지 않습니다. 접근 가능한 상위 대화에 연결할 수 없는 항목은 계속 접근 가능한 상태로 유지됩니다.。[#137](https://github.com/try2love/codex-mobile-bridge/issues/137)
- **Codex 영구 삭제。** 지원되는 컴퓨터에서 Codex 세션에 영구 삭제 항목을 추가하고, 실행 전 기본 세션 및 보조 채팅 범위를 확인하고, 작업 및 확인되지 않은 작업을 확인합니다. 결과를 알 수 없는 경우 확인 항목을 보관하고 자동으로 반복적으로 삭제하지 않습니다.。macOS 기본 Codex 공유 네이티브 런타임은 네이티브를 지원하도록 명시적으로 초기화될 수 있습니다. App 세션 유지 중 데이터 생성 및 삭제。[#138](https://github.com/try2love/codex-mobile-bridge/issues/138)
- **새 채팅을 만들기 전에 모델을 선택하세요。** Codex、Claude、DSH、ZCode 공유 모델 및 반사 강도 선택, 생성 후 선택 유지. 새로운 포털, 계정 관리 및 채팅 설정은 동일한 액세스의 모델 캐시를 재사용하며 컴퓨터, 계정 및 구성별로 격리됩니다.。[#131](https://github.com/try2love/codex-mobile-bridge/issues/131)
- **독립형 클라이언트와 CLI 관리하다。** 등록 가능하고 독립적임 Codex 구성 및 VS Code 확장된 환경, 독립형 실험 지원 Claude、DSH 데스크탑 구성. 이 게이트웨이가 보유한 수를 늘리십시오. CLI 연결 관리는 작업이 완료될 때까지 기다린 후 해제를 지원하고 원래 세션과 기록을 유지합니다.。[#106](https://github.com/try2love/codex-mobile-bridge/issues/106) · [#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **긴 대화와 질문 카드。** 지원되는 액세스에서 컨텍스트 보기, 수동 압축 및 백그라운드 작업 관리；Codex 비동기식 질문은 하나씩 건너뛸 수 있으며, 제출되지 않은 다른 질문의 내용은 그대로 유지됩니다. 상태 건너뛰기 Bridge 휴대폰과 Web 사이에 공유。[#118](https://github.com/try2love/codex-mobile-bridge/issues/118) · [#119](https://github.com/try2love/codex-mobile-bridge/issues/119) · [#121](https://github.com/try2love/codex-mobile-bridge/issues/121)
- **모바일 알림 및 원격제어 출입。** Android 알림은 이벤트별로 유지되며, 동일한 채팅의 확인 및 완료 알림이 더 이상 서로 겹치지 않습니다. 중복 이벤트는 계속해서 중복 제거됩니다. 컴퓨터로 구성 추가 UU 설치된 것을 호출할 수 있는 원격포탈 UU 클라이언트의 실제 기능은 시스템 및 UU 지원하다。[#113](https://github.com/try2love/codex-mobile-bridge/issues/113)

## 수정 및 최적화

- 타사 수리 Codex Access는 텍스트에 대해 생각할 때 표시할 수 없는 질문만 반환합니다. 일반 중국어 및 기타 언어를 지원합니다. Unicode 캐릭터 공급업체 모델 ID。[#110](https://github.com/try2love/codex-mobile-bridge/issues/110) · [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130) · [PR #139](https://github.com/try2love/codex-mobile-bridge/pull/139)
- 수리하다 Tailscale 문제는 레거시 포털을 올바르게 인수할 수 없고 규칙이 손실된 후 복원할 수 없다는 것입니다. 입구의 소유권을 확인한 후 복원하고, 안정되면 감지 빈도를 줄이고, 비정상 시에는 물러났다가 다시 시도하며, 다른 서비스의 구성을 커버하지 않습니다.。[PR #135](https://github.com/try2love/codex-mobile-bridge/pull/135)
- 개선하다 Claude 초기화、Windows 스토어 버전 식별、DSH 커넥터 업그레이드 및 클라이언트 간 기본 이름 변경 결정된 Codex 원래 연결이 교체된 후 복원。[#120](https://github.com/try2love/codex-mobile-bridge/issues/120) · [#127](https://github.com/try2love/codex-mobile-bridge/issues/127)
- 긴 생각과 도구 출력의 읽기 위치를 유지하고 첫 번째 사본과 사진 저장을 개선합니다. 휴대폰 콜드 스타트 ​​스타일 로딩 및 4-클라이언트 탐색 레이아웃 수정。[#112](https://github.com/try2love/codex-mobile-bridge/issues/112) · [#114](https://github.com/try2love/codex-mobile-bridge/issues/114) · [#115](https://github.com/try2love/codex-mobile-bridge/issues/115)
- 활성화되지 않은 클라이언트의 백그라운드 관찰을 비활성화하고, 필요에 따라 선택적 서비스를 시작하고, 확인된 상태 및 모델 캐시를 재사용합니다. QR 코드를 숨기거나 접은 후 의미 없는 페어링 새로 고침을 중지하여 유휴 오버헤드를 줄입니다.。

## 사용 및 업그레이드 범위

해당 플랫폼을 덮고 설치하십시오. App，먼저 제거할 필요가 없습니다. 계정, 구성, 전화 바인딩 및 초안을 계속 사용하려면 원래 애플리케이션 ID, 서명 ID 및 데이터 디렉터리를 유지하세요. 휴대폰 채널, 알림 및 기본 메뉴 개선을 최대한 활용하려면 휴대폰 동시 업데이트가 필요합니다. App；iOS 소스 코드 및 서명되지 않음 IPA 여전히 서명하고 직접 설치해야 합니다.。

독립형 클라이언트 구성 및 WSL 계정 관리는 아직 실험적입니다. 기본 작업은 클라이언트 버전 및 액세스 기능에 따라 다릅니다. 공유 Codex 런타임은 현재 다음에서만 사용할 수 있습니다. macOS 기본 구성은 열려 있습니다. 영구 삭제는 원본이 동시에 닫히는 것을 보장하지 않습니다. App 열린 탭; 각 주제를 건너뛰는 것이 네이티브를 의미하는 것은 아닙니다. Codex App 부분 건너뛰기 상태 양방향 동기화；Codex CLI 릴리스에는 여전히 업스트림 지연 언로드가 적용될 수 있습니다.。

macOS、Windows 및 Linux 정식 패키지 제공 ZCode 지역 연결；macOS 로컬 실행 프로그램은 설치 패키지와 함께 제공되며 켤 필요가 없습니다. TCP 디버그 포트. 구성된 공식 원격 제어 방법을 사용할 수도 있습니다.。

## 기여하다

고마워하는 [@tiancai123123](https://github.com/tiancai123123) 콘텐츠 복구에 대한 타사의 생각（PR #130）、[@laozuzhen](https://github.com/laozuzhen) 의 Tailscale 복구 계획（PR #135），게다가 [@qybgh](https://github.com/qybgh) 의 Unicode 모델 ID 지원하다（PR #139）。연결, 모델, 세션 관리 및 플랫폼 간 피드백을 제공해주신 모든 미리보기 사용자에게 감사드립니다.。

---

### English · ZCode, connection recovery and native conversation management

v2.2.0 adds ZCode to the remote workspace and improves mobile channel switching, native side chats, model selection and background resource usage.

- **ZCode workspace:** browse saved history, continue native chats, send attachments, answer questions and handle approvals. Create project chats, select models and reasoning levels, use Skills, fork and rename chats. Production packages on macOS, Windows and Linux include local connections; configured official remote access remains available. macOS ships a verified local launcher without requiring a TCP debugging port. [#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#116](https://github.com/try2love/codex-mobile-bridge/issues/116) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124) · [#128](https://github.com/try2love/codex-mobile-bridge/issues/128) · [#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **Multiple routes, one computer:** combine LAN, fixed HTTPS and temporary HTTPS entries, inspect latency, select a route or recover automatically. Renew trusted routes after login and preserve drafts and reading position when switching. [#125](https://github.com/try2love/codex-mobile-bridge/issues/125)
- **Native side chats and deletion:** show Codex side chats under their parent, with shared chat controls. Closing a tab preserves the native chat. Supported local Codex sessions offer explicit permanent deletion with scope confirmation and pending-operation checks. Unknown outcomes are not automatically replayed. [#137](https://github.com/try2love/codex-mobile-bridge/issues/137) · [#138](https://github.com/try2love/codex-mobile-bridge/issues/138)
- **Models and independent clients:** choose a model before creating a chat and reuse catalogs scoped to the computer, account and configuration. Manage supported independent client profiles and release idle CLI connections owned by this gateway. [#106](https://github.com/try2love/codex-mobile-bridge/issues/106) · [#122](https://github.com/try2love/codex-mobile-bridge/issues/122) · [#131](https://github.com/try2love/codex-mobile-bridge/issues/131)
- **Questions and notifications:** skip individual Codex async questions without losing other answers. Android preserves separate notifications for separate events. Add a per-computer shortcut to an installed UU remote client. [#113](https://github.com/try2love/codex-mobile-bridge/issues/113) · [#118](https://github.com/try2love/codex-mobile-bridge/issues/118) · [#119](https://github.com/try2love/codex-mobile-bridge/issues/119) · [#121](https://github.com/try2love/codex-mobile-bridge/issues/121)
- **Fixes:** display reasoning-only responses from third-party Codex providers and accept Unicode model IDs; recover owned Tailscale routes with bounded retries; improve Claude initialization, Windows Store discovery, DSH connector upgrades, native renaming, copy/save actions and mobile cold starts. Reduce idle polling and reuse verified caches. [#110](https://github.com/try2love/codex-mobile-bridge/issues/110) · [#112](https://github.com/try2love/codex-mobile-bridge/issues/112) · [#114](https://github.com/try2love/codex-mobile-bridge/issues/114) · [#115](https://github.com/try2love/codex-mobile-bridge/issues/115) · [#120](https://github.com/try2love/codex-mobile-bridge/issues/120) · [#127](https://github.com/try2love/codex-mobile-bridge/issues/127)

Upgrade over the existing installation without uninstalling. Keep the same application identity, signing identity and data directory to retain accounts, settings, phone bindings and drafts. Update the mobile app for native route and notification changes. iOS source and unsigned IPA distributions still require your own signing.

Independent profiles and WSL account management remain experimental. Shared Codex runtime initialization currently applies only to the default macOS profile. Data deletion does not guarantee closing an already open native tab. Individual question skips synchronize between Bridge clients, not the native Codex app. CLI release may remain subject to upstream delayed unloading.

Thanks to [@tiancai123123](https://github.com/tiancai123123) for [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130), [@laozuzhen](https://github.com/laozuzhen) for [PR #135](https://github.com/try2love/codex-mobile-bridge/pull/135), and [@qybgh](https://github.com/qybgh) for [PR #139](https://github.com/try2love/codex-mobile-bridge/pull/139).

---

## v2.2.0-preview.3 · ZCode 듀얼 채널 액세스, 새로운 모델 선택 및 독립적인 클라이언트 구성

이 미리보기 버전은 계속해서 개선되고 있습니다. ZCode 액세스, 계정 및 모델 관리를 통해 새 채팅을 만들기 전 설정을 더 명확하게 만들고 세션 이름 변경, 모델 캐싱 및 게이트웨이 시작 문제를 해결합니다.。

### 새로운 추가 및 최적화

- **ZCode 로컬 연결 및 공식 원격 제어를 지원합니다.。** 데스크탑 게이트웨이에서 공식계정 로그인 및 원격제어 링크 설정을 완료하신 후, 휴대폰 및 Web 계정 관리에서 준비된 연결 방법을 선택하세요. 공식 모드는 아직 실행 중이 아닌 경우 정상적으로 시작할 수 있습니다. ZCode，그리고 원래 채팅에 다시 연결하세요. 전환 모드는 입력 초안, 첨부 파일 및 읽기 위치를 유지하며 메시지를 자동으로 다시 보내지 않습니다. 최초 구성을 위한 단계별 안내가 추가되었으며, 로그인 상태가 암호화되어 저장됩니다. 원래의 TCP 호환되는 포트 항목은 이 두 가지 방법으로 대체됩니다.。[#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124) · [#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **새 채팅을 만들 때 모델과 사고 강도를 선택하세요.。** Codex、Claude、DSH、ZCode 지원되는 데스크탑을 포함하는 공유 모델 선택 항목、CLI、SSH 및 WSL 연결。Claude 및 ZCode 채팅을 생성할 때 첫 번째 메시지는 선택한 모델을 직접 사용합니다. 사고 강도는 현재 액세스의 실제 지원 수준을 기반으로 합니다.。[#131](https://github.com/try2love/codex-mobile-bridge/issues/131)
- **모델 목록은 캐시를 보다 완벽하게 재사용합니다.。** 새로운 채팅, 채팅 설정 및 계정 관리는 동일한 액세스 하에 검증된 모델 디렉터리를 공유합니다. 하나가 새로 고쳐지면 다른 항목도 동시에 업데이트됩니다. 다양한 컴퓨터, 계정, 프로젝트 및 독립적인 구성이 계속해서 격리됩니다. 나중에 반환된 이전 결과는 새 디렉터리를 덮어쓰지 않으며 다른 채팅에서 선택한 모델을 변경하지도 않습니다.。
- **통합 계정 구성 인터페이스，ZCode 사용자 정의를 저장할 수 있습니다 API。** 공통 주소, 키 및 모델 선택 양식을 재사용하여 저장하기 전에 업스트림 제공 모델 읽기를 지원합니다.。ZCode 지원되는 원본 클라이언트를 저장할 수 있습니다. Anthropic Messages、OpenAI Chat Completions 및 OpenAI Responses 입장; 실제 애플리케이션과 별도로 구성을 저장하고, 적용 시 기존 작업 확인 내용을 유지합니다.。
- **ZCode 할당량은 활성 새로 고침을 지원합니다.。** 기존 클라이언트를 통해 현재 공식 계정의 각 모델의 일일 남은 할당량을 쿼리하고 업데이트 시간을 표시하며 캐시를 재사용합니다. 쿼리가 실패하면 동일한 계정에 대해 여전히 유효한 이전 값이 유지되며 업데이트되지 않았음을 나타냅니다. 할당량 쿼리가 모델을 호출하지 않습니다.。[#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **독립적인 클라이언트 구성, 실험적이고 개방적。** 기존에 Codex 독립된 구성 입구를 기반으로 추가 Claude、DSH 독립적인 데스크톱 구성은 기본 액세스와 공존합니다. 계정, 세션, 첨부 파일, 초안, 모델 캐시 및 알림을 각각 관리하고 현재 인스턴스를 기반으로 시작, 다시 연결 및 종료합니다.。ZCode 자동으로 검색되지 않는 설치 위치를 수동으로 지정할 수 있으며, 두 번째 독립 세트를 추가하지 않고도 기본 구성을 계속 사용할 수 있습니다. ZCode。

### 수리하다

- **세션 이름 변경은 원래 클라이언트와 동기화됩니다.。** 완벽한 Claude Desktop、Claude Code CLI、DSH 및 ZCode 기본 이름 변경 및 결과 확인 더 이상 수정만 하지 마세요 Bridge 이름을 원본으로 표시 App 이름 변경이 성공했습니다. 연결이 연결되지 않았거나 기본 버전이 이를 지원하지 않으면 명확한 메시지가 표시됩니다.。[#120](https://github.com/try2love/codex-mobile-bridge/issues/120)
- **제3자 Codex 생각하는 내용을 표시할 수 있습니다.。** 호환되는 경우 Responses API 리플렉션의 본문만 반환되고 초록이 반환되지 않는 경우 업스트림에서 제공하는 본문을 활용하여 표시 보완 및 지원 CLI 점진적으로 생각하십시오. 여전히 초록이 있는 경우 초록을 먼저 표시합니다.。[#110](https://github.com/try2love/codex-mobile-bridge/issues/110) · [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130)
- **선택적 로그인 복구로 인해 더 이상 전체 게이트웨이가 정지되지 않습니다.。** 시스템 키체인이 준비되지 않은 경우 수정，ZCode 공식 로그인은 메인 창을 차단하는 문제를 복원합니다. 공식 로그인이 구성되지 않으면 해당 키체인을 읽을 수 없습니다. 저장된 로그인은 백그라운드에서 복원되며, 실패할 경우 개별적으로 다시 시도할 수 있습니다.。
- **플랫폼 완성 및 업그레이드 호환성。** 개선하다 Linux ZCode AppImage 발견 및 원래 설치 위치 식별 수리하다 macOS 중국어 경로에 따른 프로세스 식별 Windows 패키징 매개변수가 너무 길어서 빌드가 실패합니다. 수리하다 DSH 기존 연결 플러그인 업그레이드 및 선택적 서비스 읽기 문제 및 독립성 향상 Claude 개발자 모드를 켜고 스스로 다시 시작한 후 명시적인 연결 복구。

고마워하는 [@tiancai123123](https://github.com/tiancai123123) 에서 [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130) 타사에서 제공 Codex 콘텐츠 수정에 대한 생각 및 Windows、Android 검증。

---

### English · ZCode connection modes, model selection and independent client profiles

This preview improves ZCode connectivity and account management, adds model selection before starting a chat, and fixes native renaming, model cache reuse and gateway startup.

- **Choose local or official ZCode remote access.** Configure the official login and remote link in the desktop gateway, then choose a prepared connection mode in account management on mobile or the web. Official mode can start ZCode when it is closed and reconnect to the original chat. Switching modes keeps drafts, attachments and reading position without replaying messages. Setup guidance and encrypted login persistence are included. These two modes replace the previous TCP compatibility-port option. [#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124) · [#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **Choose a model before creating a chat.** Codex, Claude, DSH and ZCode share a model picker across supported Desktop, CLI, SSH and WSL connections. Claude and ZCode use the selected model for the first message. Reasoning levels follow the capabilities of the selected connection. [#131](https://github.com/try2love/codex-mobile-bridge/issues/131)
- **Reuse model catalogs across screens.** Chat creation, conversation settings and account management share verified catalogs for the same connection. Refreshes propagate between screens while computers, accounts, projects and independent profiles stay separate. Late responses cannot replace newer catalogs or change another conversation's model selection.
- **Use a shared API account editor.** Reuse the endpoint, key and model-selection form, including upstream model discovery before saving. ZCode can save providers using its supported Anthropic Messages, OpenAI Chat Completions and OpenAI Responses protocols. Saving and applying remain separate operations, with existing task checks preserved.
- **Refresh official ZCode quotas.** Query the original client for the current account's per-model daily allowance, with timestamps and caching. A failed refresh preserves valid values for the same account and reports that they were not updated. Quota queries do not make model requests. [#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **Try independent client profiles.** Experimental Claude and DSH Desktop profiles can coexist with the default connection, extending the existing independent Codex entry. Accounts, history, attachments, drafts, model catalogs, notifications and lifecycle operations are scoped to the selected instance. ZCode supports manually selecting an installation missed by discovery, but continues to use its default profile.

**Fixes**

- Native renames in Claude Desktop, supported Claude Code CLI connections, DSH and ZCode are verified against the original client. Changing a Bridge-only display alias is no longer reported as a successful native rename. [#120](https://github.com/try2love/codex-mobile-bridge/issues/120)
- Codex third-party Responses providers that return reasoning text without a summary can display that text, including CLI reasoning deltas. An available summary still takes precedence. [#110](https://github.com/try2love/codex-mobile-bridge/issues/110) · [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130)
- Optional ZCode login restoration no longer blocks the gateway window when the system keyring is unavailable. Unconfigured logins do not access the keyring; saved logins restore in the background and can be retried separately.
- Improved Linux ZCode AppImage discovery, macOS process identification under Unicode paths, Windows packaging with long resource argument lists, DSH connector upgrades and optional-service access, and explicit reconnection after an independent Claude instance relaunches to enable developer mode.

Thanks to [@tiancai123123](https://github.com/tiancai123123) for the reasoning-content fix and Windows/Android validation in [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130).

---

## v2.2.0-preview.2 · ZCode 역사, 데스크톱 액세스 및 모델 크레딧

**이 미리보기 버전은 ”보기 기록”과 ”데스크톱 조작”을 분리합니다.。** 휴대폰과 Web 직접 열 수 있습니다 ZCode 저장된 채팅; 계속해서 승인을 보내거나 처리하려면，Bridge 원래 데스크톱 세션에 연결되어 있는지 다시 확인하세요.。

- **데스크톱 창을 전환하지 않고 기록 보기。** 에서 macOS、Windows 및 Linux 데스크톱 게이트웨이에서는 저장된 내용을 직접 읽을 수 있습니다. ZCode 채팅. 만약에 ZCode 목록 항목만 유지되며 빈 세션은 계속 열 수 있습니다. 원본 App 더 이상 찾을 수 없는 채팅에는 전송 권한이 부여되지 않습니다. 읽기에 실패하면 그 자리에서 다시 시도할 수 있습니다. 채팅을 열고 최신 뉴스를 먼저 읽어보세요. 위로 스크롤하면 배경 새로 고침이 읽기 위치를 유지합니다.。[#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **각 응답에 사용된 모델을 명확하게 확인하고 첨부 파일을 검색하세요.。** 원본 기록이 모델과 사고 강도를 제공하는 경우 채팅에서는 응답으로 현재 값을 표시합니다. 역사적인 사진의 경우 축소판을 클릭하여 원본 이미지를 볼 수 있습니다. 검증 가능한 소스가 있는 현재 프로젝트의 첨부 파일의 경우 파일 이름을 클릭하여 찾을 수 있습니다. 원본 기록에 정보가 부족한 경우 현재 모델이나 동일한 이름의 파일로 대체되지 않습니다.。
- **휴대폰에서 관리 ZCode 또는 새 프로젝트 채팅을 만드세요.。** 게이트웨이, 휴대폰 또는 Web 시작하다 ZCode、정상적으로 종료하거나 원격 액세스를 끄고 컴퓨터의 작업이 계속 실행되도록 하세요.。Windows 기본 트레이에서 정상적인 종료를 지원합니다. ”제3자 알림”은 목록에서 직접 열 수 있습니다. 원본 App 프로젝트 서비스가 준비되면 먼저 보낼 이전 대화를 찾을 필요 없이 새 프로젝트 채팅을 만들 수 있습니다.。[#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **약한 네트워크에서 원래 채팅 검색。** 전화기가 연결 결과를 수신하지 못한 경우 연결이 복원된 후에도 동일한 요청을 계속 쿼리합니다. 활성화를 반복적으로 클릭할 필요가 없으며 채팅 메시지가 다시 전송되지 않습니다. 연결 중에는 전체 기록이 반복적으로 로드되지 않습니다.。
- **모델별로 보기 ZCode 일일 할당량。** 계정 페이지를 별도로 표시할 수 있습니다. GLM-5.3、GLM-5.3-Flash 모델의 잔액과 업데이트 시간을 기다립니다. 데이터 출처: ZCode 공식 계정에서 얻은 기록 기록이 없으면 추정이 이루어지지 않으며 새로 고침을 클릭해도 모델 할당량이 소비되지 않습니다.。[#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **계속하다 VS Code 에서 사용되는 Codex 채팅。** 개별적으로 구성한 경우 `CODEX_HOME` 의 VS Code 확장하다，Bridge 원래 세션을 진행했던 확장에 대한 전송, 승인 및 중지의 우선 순위를 지정하여 동일한 채팅을 위해 경쟁하는 컴퓨터와 휴대폰의 문제를 줄입니다. 결정된 Windows 동일한 디렉터리는 다른 경로 쓰기로 인해 인식되지 않습니다. 사용 가능한 작업은 확장 버전에 따라 다릅니다.。[#106](https://github.com/try2love/codex-mobile-bridge/issues/106)
- **연결 및 업데이트。** 세션 연결을 다시 설정하지 못한 경우에도 다시 시도할 수 있습니다. 게이트웨이 설정에는 저장되지 않은 필드가 표시됩니다. 동일한 컴퓨터에 게이트웨이의 여러 복사본이 설치된 경우 업데이트하고 다시 시작할 때 잘못된 데이터 디렉터리가 사용될 수 있는 문제를 해결했습니다.。

**호환성 범위：** Windows 및 Linux 데스크톱은 기본적으로 로컬 개인 채널을 통해 액세스되며 전원을 켤 필요가 없습니다. TCP 디버그 포트. 게이트웨이는 더 이상 버전 번호만 보지 않고 원래 프로세스 ID와 실제 프로토콜 기능을 기반으로 작동합니다. 이미 Windows x64 의 ZCode 3.17.1 및 Ubuntu 22.04 x64 그래픽 데스크탑 승인에 로그인했습니다.。macOS 공개 패키지를 정상적으로 실행하면 기록을 볼 수 있습니다. 채팅을 계속하려면 ”애플리케이션 관리”에서 로컬 호환 포트를 활성화하세요.。Mac Test 잠금 화면 포트리스 실행 프로그램은 공개 패키지에 포함되어 있지 않습니다.。

**～에서 preview.1 고쳐 쓰다：** macOS 및 Windows 게이트웨이는 ”업데이트 확인”에서 ”업데이트 및 다시 시작”을 선택할 수 있습니다.」；Android 다음에서 이용 가능 App 업데이트 확인, 다운로드 및 설치 확인。Linux 해당 아키텍처를 덮어쓰고 설치하십시오. DEB，아니면 원본을 교체하세요 AppImage；iOS 다음에서 이용 가능 App 업데이트를 확인하고 릴리스 페이지를 연 후에도 원래 설치와 동일한 서명 ID 및 애플리케이션 ID로 설치를 덮어써야 합니다. 먼저 제거할 필요가 없습니다. preview.1。안정 버전을 사용하는 사용자는 이 미리보기 업데이트를 받을 수 없습니다.。

---

### English · ZCode history, desktop access and model quotas

You can now open saved ZCode chats on mobile and the web without switching the desktop window. Before sending a message or handling an approval, Bridge verifies that it is connected to the original desktop session.

- **Read saved chats.** macOS, Windows and Linux desktop gateways read ZCode history locally. An indexed chat with no transcript opens as an empty conversation. A chat missing from the original app stays read-only. Failed reads can be retried in place. Chats open at the latest message and keep your place while you read older replies. [#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **Inspect replies and attachments.** Replies show the model and reasoning effort recorded at the time, when available. Tap image thumbnails to see the original, or select a verified project attachment to locate its file.
- **Manage the desktop or start a project chat.** Start ZCode, quit normally (including via its native Windows tray), or turn off remote access while leaving local work running. Open third-party notifications from the list or start a project chat once ZCode’s project service is ready, without first opening a writable chat. [#128](https://github.com/try2love/codex-mobile-bridge/issues/128)
- **Resume over a slow connection.** If a phone misses the response, it can check the original request after reconnecting. It does not resend chat messages or repeatedly reload the full history.
- **See daily quota by model.** The account page shows the remaining allowance and update time for models such as GLM-5.3 and GLM-5.3-Flash when ZCode has recorded an official quota response. Refresh rereads those records; it does not make a model request or estimate missing values. [#129](https://github.com/try2love/codex-mobile-bridge/issues/129)
- **Continue the original VS Code Codex chat.** For extensions registered with a separate `CODEX_HOME`, Bridge routes sending, approvals and stop requests to the extension that owns the session when supported. Windows paths that refer to the same directory are now recognised consistently. [#106](https://github.com/try2love/codex-mobile-bridge/issues/106)
- **Connection and update fixes.** Retry a failed reconnection, identify unsaved gateway settings and keep the correct data directory when an update restarts one of several gateway installations.

**Compatibility:** Windows and Linux desktop gateways use a private local pipe by default, without a TCP debugging port. Controls are enabled according to the identity and capabilities of the running app, rather than its version alone. Verified with ZCode 3.17.1 on Windows x64 and a signed-in graphical desktop on Ubuntu 22.04 x64. The public macOS build reads saved chats without special setup; enable the local compatibility port in app management to continue a chat. The port-free locked-screen Mac Test launcher is not included.

**Upgrading from preview.1:** Use **Check for updates → Update and restart** on macOS or Windows. Android can check, download and prompt to install in the app. On Linux, install the matching DEB over the previous package or replace the AppImage. On iOS, the update check opens the release page; sign and install over the existing app using the same identity and bundle ID. Stable installations will not be offered this preview.

---

## v2.2.0-preview.1 · ZCode 기본 세션과 모바일 연결 간 전환

이 미리보기 버전 ZCode 기본 채팅을 휴대폰으로 가져오고 Web。휴대폰 App 또한 게이트웨이별로 컴퓨터를 정리하기 시작했습니다. LAN 및 동일한 게이트웨이로 고정 HTTPS 일시적이고 HTTPS 주소를 카드에 넣을 수 있으며 집에서나 밖에서나 원래 채팅을 계속할 수 있습니다.。

### ZCode 기본 액세스 미리보기

- **데스크톱에서 채팅 계속하기。** 구성됨 ZCode 액세스됨 macOS 또는 Windows 게이트웨이에서 다음 항목에 액세스할 수 있습니다. Web 기록 찾아보기, 원래 대화 계속하기, 첨부 파일 보내기, 질문에 답변하기, 승인 처리하기。ZCode 다시 시작한 후에도 바탕 화면이 여전히 홈페이지에 멈춰 있어도 계속할 수 있습니다. Bridge 오래된 채팅을 사전에 복원합니다. 게이트웨이 자체에 접속하여 사용하는 경우 별도의 설치가 필요하지 않습니다. Node.js 또는 Homebrew。[#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#123](https://github.com/try2love/codex-mobile-bridge/issues/123) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124)
- **프로젝트에서 세션 생성 및 구성。** 기존 프로젝트를 선택하거나 새 디렉터리를 등록하여 첫 번째 메시지로 기본 채팅을 만들 수 있습니다. 이름 바꾸기, 지정된 지점에서 응답, 원본 메시지 편집 및 재전송을 지원합니다.。[#116](https://github.com/try2love/codex-mobile-bridge/issues/116) · [#120](https://github.com/try2love/codex-mobile-bridge/issues/120)
- **다음 단계 수행 방법 제어。** 전환 가능한 모델 및 사고 강도, 인용 Skill、계획이나 대상 모드를 선택하고 액세스 권한을 조정하세요. 작업이 진행되는 동안 ”완료 후 보내기” 또는 ”현재 작업 보충”을 선택할 수 있습니다. 만약에 ZCode 대기열 추가 콘텐츠，Bridge ”이미 팀에 합류했습니다”가 표시됩니다.」。[#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#117](https://github.com/try2love/codex-mobile-bridge/issues/117) · [#126](https://github.com/try2love/codex-mobile-bridge/issues/126)

### 모바일 연결 및 세션 관리

- **게이트웨이 및 컴퓨터 카드。** 컴퓨터에 들어갈 때，App 게이트웨이 인증을 먼저 통과한 활성화된 주소가 사용됩니다. 자동 모드에서는 동일한 LAN으로 복귀한 후 LAN을 먼저 사용합니다. 나간 후에는 사용 가능한 공용 네트워크 입구로 다시 전환할 수 있습니다. 지연을 확인하고 회선을 수동으로 선택할 수도 있습니다. 회선을 전환할 때 현재 채팅, 초안 및 읽기 위치를 유지합니다.。[#125](https://github.com/try2love/codex-mobile-bridge/issues/125)
- **독립적인 액세스 VS Code Codex 설정。** 데스크톱 게이트웨이에 확장 추가 `CODEX_HOME` 이후 휴대폰과 Web 세션, 계정, 초안을 별도로 관리할 수 있는 독립 클라이언트로 표시됩니다.。[#106](https://github.com/try2love/codex-mobile-bridge/issues/106)
- **다 떨어지다 CLI 마지막으로 연결을 컴퓨터에 다시 전달하십시오.。** 세션 메뉴에서 단일 연결을 해제하거나 설정에서 이 게이트웨이가 보유한 로컬 컴퓨터를 중앙에서 관리할 수 있습니다.、SSH 및 WSL 연결하다. 기본적으로 작업 완료 후 해제되며, 원래 채팅 내용과 기록은 유지됩니다.。Codex 기본 서비스 출시가 지연되는 경우가 있으며, 컴퓨터가 인계받는 데 시간이 걸릴 수 있습니다.。[#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **긴 채팅 및 백그라운드 작업 관리。** 지원됨 Codex、Claude、DSH 및 ZCode 세션은 원래 클라이언트가 제공한 컨텍스트 사용량을 보고 유휴 상태일 때 수동 압축을 시작할 수 있습니다.。DSH 및 ZCode 현재 채팅의 백그라운드 작업을 보고 그 중 하나를 개별적으로 중지할 수도 있습니다.。[#118](https://github.com/try2love/codex-mobile-bridge/issues/118) · [#119](https://github.com/try2love/codex-mobile-bridge/issues/119) · [#121](https://github.com/try2love/codex-mobile-bridge/issues/121)

### 수리 및 독서 체험

- **Claude Desktop 연결。** 수리하다 Windows 스토어 버전（MSIX）개발자 모드가 켜져 있지만 잘못 판단되는 문제。macOS 및 Windows 첫 번째 초기화에서는 모델 호출을 트리거하는 빈 메시지를 방지하기 위해 신뢰할 수 있는 디렉터리에서 핸드셰이크를 완료할 수 있습니다. 로그인 데이터베이스가 일시적으로 사용되는 경우에도 기본 채팅 기록을 열 수 있으며, 계정 신원을 확인한 후 해당 계정의 모델 설정 및 초안을 복원할 수 있습니다.。[#127](https://github.com/try2love/codex-mobile-bridge/issues/127)
- **사진 읽기, 복사 및 저장。** 확장하다 Claude 또는 DSH 오랜 생각이나 도구 출력 후에는 백그라운드 새로 고침이 읽기 위치를 유지합니다. 세션 메뉴의 복사 작업은 첫 번째 클릭에 적용되고 피드백을 제공합니다. 이미지 미리보기에 원본 이미지를 저장할 수 있는 새로운 입구가 추가되며, 파일은 현재 휴대폰이나 컴퓨터에 저장됩니다.。[#112](https://github.com/try2love/codex-mobile-bridge/issues/112) · [#114](https://github.com/try2love/codex-mobile-bridge/issues/114) · [#115](https://github.com/try2love/codex-mobile-bridge/issues/115)
- **Ubuntu 게이트웨이 시작。** 수리부품용 Python 3.11 이전 런타임의 패키징 게이트웨이가 부족하여 누락되었습니다. TOML 구성요소를 읽는 데 문제가 있지만 시작하지 못함。

**미리보기 범위。** ZCode 현재 기존 액세스 구성이 있는 사용자만 액세스할 수 있습니다. macOS 및 Windows 게이트웨이, 확인됨 ZCode 3.17.1。휴대폰 다중 주소 전환에는 지원 장비가 필요합니다. Android 또는 iOS 시사 App。주요 피드백을 환영합니다 ZCode 콜드 스타트 ​​후 이전 채팅을 계속하면 전화가 켜집니다. Wi-Fi 셀룰러 간 전환 및 Claude 로그인 라이브러리가 점유되어 있을 때 기록 열기의 세 가지 시나리오。

고마워하는 [@SOFdian](https://github.com/SOFdian) 독립을 제안하다 VS Code 구성된 액세스 요구 사항입니다. 감사합니다. [@xtayavij](https://github.com/xtayavij) 공급 Windows 스토어 버전 Claude 재현하는 단계。[#106](https://github.com/try2love/codex-mobile-bridge/issues/106) · [#127](https://github.com/try2love/codex-mobile-bridge/issues/127)

---

### English · Native ZCode chats and mobile connection switching

This preview brings native ZCode chats to mobile and the web. The mobile app can group LAN, fixed HTTPS and temporary HTTPS addresses for the same gateway under one computer entry.

- **Native ZCode chats.** On a configured macOS or Windows gateway, read history, resume a desktop chat, send attachments, answer questions and handle approvals. Chats can also be resumed after ZCode restarts at its home screen. The gateway includes the connection runtime, so no separate Node.js or Homebrew installation is required. [#107](https://github.com/try2love/codex-mobile-bridge/issues/107) · [#123](https://github.com/try2love/codex-mobile-bridge/issues/123) · [#124](https://github.com/try2love/codex-mobile-bridge/issues/124)
- **Projects and chat controls.** Choose an existing project or register a directory, then create a native chat with its first message. Rename chats, branch from a reply, or edit and resend a message. Choose the model, reasoning effort, Skills, work mode and access permissions. Follow-up input is shown as queued when ZCode accepts it into the queue. [#116](https://github.com/try2love/codex-mobile-bridge/issues/116) · [#117](https://github.com/try2love/codex-mobile-bridge/issues/117) · [#120](https://github.com/try2love/codex-mobile-bridge/issues/120) · [#126](https://github.com/try2love/codex-mobile-bridge/issues/126)
- **One computer entry per gateway.** The mobile app opens the first enabled address that proves it belongs to the paired gateway. Automatic mode prefers a verified LAN connection when it becomes available and can fall back to a public address when LAN is lost. You can also view latency and choose a route manually. Switching keeps the current chat, draft and reading position. [#125](https://github.com/try2love/codex-mobile-bridge/issues/125)
- **Independent VS Code configurations.** Add the Codex extension’s `CODEX_HOME` in the desktop gateway to manage its chats, accounts and drafts separately on mobile and the web. [#106](https://github.com/try2love/codex-mobile-bridge/issues/106)
- **Release CLI connections.** Release a single connection from the chat menu, or manage local, SSH and WSL connections held by the gateway in Settings. Release waits for the task to finish by default and preserves chat history. Codex’s native service can take additional time before another terminal can resume the chat. [#122](https://github.com/try2love/codex-mobile-bridge/issues/122)
- **Context and background tasks.** Supported Codex, Claude, DSH and ZCode chats show the context usage reported by the client and offer manual compaction when idle. In DSH and ZCode, you can inspect background tasks for the current chat and stop an individual task. [#118](https://github.com/try2love/codex-mobile-bridge/issues/118) · [#119](https://github.com/try2love/codex-mobile-bridge/issues/119) · [#121](https://github.com/try2love/codex-mobile-bridge/issues/121)
- **Claude Desktop recovery.** Fixed developer-mode detection for Windows MSIX installations. On macOS and Windows, initialization in a trusted directory completes without sending an empty model message. Native history stays readable if the sign-in database is temporarily locked. Account-specific drafts and model settings become available once account identity can be verified again. [#127](https://github.com/try2love/codex-mobile-bridge/issues/127)
- **Reading, copying and saving images.** Expanded Claude and DSH activity keeps its reading position during refresh. Copying from a chat menu works on the first tap and gives feedback. The image viewer can save the original image to the device you are using. [#112](https://github.com/try2love/codex-mobile-bridge/issues/112) · [#114](https://github.com/try2love/codex-mobile-bridge/issues/114) · [#115](https://github.com/try2love/codex-mobile-bridge/issues/115)
- **Ubuntu startup.** Fixed a missing TOML reader that prevented packaged gateways using Python runtimes older than 3.11 from starting.

**Preview coverage.** Native ZCode access has been tested with ZCode 3.17.1 on configured macOS and Windows gateways. Mobile connection switching requires the matching Android or iOS preview app. Feedback on cold-start chat recovery, Wi-Fi/cellular switching and reading history while Claude’s sign-in database is locked is especially welcome.

Thanks to [@SOFdian](https://github.com/SOFdian) for the independent VS Code configuration request and [@xtayavij](https://github.com/xtayavij) for the Windows MSIX reproduction. [#106](https://github.com/try2love/codex-mobile-bridge/issues/106) · [#127](https://github.com/try2love/codex-mobile-bridge/issues/127)

---

## v2.1.7 · 모바일 알림, 대화 구성 및 연결 복구

<a id="v217"></a>

이 업데이트는 모바일 알림 및 세션 관리를 개선하고, 프로젝트 파일 참조 및 기록 사진 미리 보기를 추가하고, 약한 네트워크 전송을 복구합니다.、SSH 오프라인 및 일부 데스크톱 세션이 비정상적으로 연결됩니다. 데스크톱과 모바일 App 버전은 **2.1.7**，Android/iOS 빌드번호는 **40**。

### 새로운 추가 및 최적화

- **Android 백그라운드 작업 알림**：백그라운드 수신을 수동으로 켜고 나갈 수 있습니다. App 그런 다음 계속해서 작업 알림을 받으세요. 알림을 클릭하여 채팅으로 돌아갈 때 기존 페이지와 초안을 재사용하여 반복 로드를 줄입니다. 기본적으로 꺼져 있으며 언제든지 일시중지할 수 있습니다.。[Issue #47](https://github.com/try2love/codex-mobile-bridge/issues/47) · [PR #85](https://github.com/try2love/codex-mobile-bridge/pull/85)
- **알림 소스 및 전화기 모양**：여러 입구에서 반복되는 알림을 줄이기 위해 저장된 연결 주소에 따라 각각 작업 알림을 시작 및 중지합니다.；Android 및 iOS 라이트, 다크 및 팔로우 시스템에 대한 통합 지원. 개선하다 iOS 프런트 연락·정리 Android 컴퓨터 옵션 메뉴의 그룹화, 터치 영역 및 복귀 작업。[PR #85](https://github.com/try2love/codex-mobile-bridge/pull/85) · [PR #95](https://github.com/try2love/codex-mobile-bridge/pull/95)
- **통합 세션 메뉴 및 분류 구성**：길게 누르기, 마우스 오른쪽 버튼 클릭 또는 제목 입력은 세부 정보, 이름 변경, 고정, 복사, 프로젝트 및 파티션 구성을 제공합니다. 기본 작업 중 원본 클라이언트 동기화 지원；Bridge 명확하게 라벨이 지정된 카테고리 표시“오직 에서만 Bridge 에서 유효”。메뉴 복귀 및 드롭다운 닫기는 일관됩니다. 분류 결과가 확인되지 않은 경우에는 반복 제출이 이루어지지 않습니다.。[PR #92](https://github.com/try2love/codex-mobile-bridge/pull/92) · [Issue #77](https://github.com/try2love/codex-mobile-bridge/issues/77)
- **참조 호스트 프로젝트 파일**：첨부 항목을 사용하면 현재 프로젝트 내의 파일이나 폴더를 선택하고 전송하기 전에 초안에 추가할 수 있습니다. 휴대폰으로 다운로드한 후 업로드할 필요가 없습니다.。Codex、Claude 및 DSH 해당 첨부 파일이나 인용 형식을 사용하세요. 지원되는 파일 링크는 기존 파일 페이지 위치 지정 및 미리보기에 들어갈 수 있습니다.。[Issue #102](https://github.com/try2love/codex-mobile-bridge/issues/102)
- **역사적인 사진 미리보기**：Claude 및 DSH 기록 이미지는 주문형 로딩, 미리보기 및 확대/축소를 지원하여 기록 새로 고침 및 원본 이미지의 반복 전송을 방지합니다.。[Issue #99](https://github.com/try2love/codex-mobile-bridge/issues/99)
- **채팅 읽기 및 작업 상태**：코드 블록에 언어 태그 및 구문 강조를 추가하고 복사할 원본 텍스트를 유지합니다.；DSH 식별된 주입 컨텍스트는 기본적으로 축소됩니다. 채팅은 실행 중, 승인 대기 중, 비정상 상태를 일률적으로 표시합니다. 이 버전에서는 이러한 상태 프롬프트를 축어적 스트리밍 출력으로 설명하지 않습니다.。[Issue #104](https://github.com/try2love/codex-mobile-bridge/issues/104) · [Issue #101](https://github.com/try2love/codex-mobile-bridge/issues/101) · [Issue #98](https://github.com/try2love/codex-mobile-bridge/issues/98)
- **프로젝트 생성 및 신뢰 확인**：지원됨 Codex App 및 Claude Desktop Code Access는 원격으로 작업 공간의 신뢰를 확인하고 환경과 전체 경로를 명확하게 표시할 수 있습니다. 개선하다 Codex SSH 프로젝트 등록 및 목록 분류. 취소 후에도 계속 입력하세요. 신뢰 확인 시 첫 번째 메시지가 자동으로 전송되지 않습니다.。[Issue #100](https://github.com/try2love/codex-mobile-bridge/issues/100)
- **DSH 이중 경로 액세스**：공통 플러그인 및 명시적 인스턴스 바인딩, 휴대폰 추가 App 네이티브를 추가할 수도 있습니다. DSH Mobile 링크. 토종의 Mobile 페이지 Bridge 통합 채팅 인터페이스는 독립적으로 사용할 수 있습니다. 호환성 범위는 클라이언트 및 플러그인 버전 확인에 따라 달라집니다.。[Issue #91](https://github.com/try2love/codex-mobile-bridge/issues/91)
- **선택 과목 Codex 활동 재설정**：기본적으로 꺼져 있고 데이터 소스가 표시되는 타사 재설정 동적 쿼리 및 선택적 알림을 추가했습니다. 공식적인 약속이나 개인 계정의 실제 한도를 나타내지 않습니다.。[PR #86](https://github.com/try2love/codex-mobile-bridge/pull/86)

### 버그 수정

- 수리하다 Safari 일부 관련 없는 스크립트가 비정상적으로 실행됩니다.“워크벤치가 아직 로드되지 않았습니다.”문제, 실패한 리소스 재시도를 개선하는 동시에 일반 요청의 캐시 재사용을 유지합니다.。[Issue #87](https://github.com/try2love/codex-mobile-bridge/issues/87) · [PR #88](https://github.com/try2love/codex-mobile-bridge/pull/88)
- 오프라인으로 격리 SSH 로컬 세션 연결, 계정 쿼리 및 알림 속도 저하를 방지하기 위해 호스트의 요청을 느리게 합니다. 실패 백오프 및 수동 재시도를 추가합니다. 개선하다 SSH 모델 디렉토리 Skill 읽기 및 캐시 멀티플렉싱。[Issue #90](https://github.com/try2love/codex-mobile-bridge/issues/90)
- 부분적으로 Codex Desktop 예외가 제공됨“연결 재설정”기입; 실패 후 애플리케이션 관리에 들어가 작업 보호 및 명확한 확인 하에 기본 애플리케이션을 처리할 수 있습니다. 원래 클라이언트의 내부 라우팅 예외에는 여전히 복구 제한이 있으며 다음을 통해 계속 복원됩니다. [Issue #103](https://github.com/try2love/codex-mobile-bridge/issues/103) 길。
- 제출된 메시지의 확인 복구 개선: 자동으로 재전송하지 않고 전송 영수증 또는 일치하는 기본 영구 기록을 기반으로 확인합니다. 해당 제출된 초안만 정리하고 사용자의 후속 편집 내용은 유지합니다.。
- 수리하다 Windows WSL Codex 타임라인의 일부와 서면 대기 질문, 라운드에 걸쳐 질문 카드에 답변한 후 답변되지 않은 다른 카드가 사라지는 질문。
- 수리하다 Claude 모델 설정의 일부 오류“계정이 전환되었습니다”팁: 모델 소스, 계정 격리 및 사고 강도 정보를 유지합니다. 기본 설정을 지원할 때 수동 모델 입력 개선。
- 본문 텍스트 바로 다음에 오는 블록 수식의 구문 분석 및 렌더링을 수정하고 유지합니다. TeX 원래의。[Issue #94](https://github.com/try2love/codex-mobile-bridge/issues/94) · [PR #96](https://github.com/try2love/codex-mobile-bridge/pull/96)
- 첨부 파일 선택 취소 후 복구 개선、Claude 디렉터리 식별 구성、DSH 구성 요소 업그레이드 호환성 및 응답 모델 정보 표시에 액세스。[Issue #99](https://github.com/try2love/codex-mobile-bridge/issues/99) · [Issue #102](https://github.com/try2love/codex-mobile-bridge/issues/102)
- 작업이 명백히 실패하거나 차단되는 경우 기능 추가“당신이 처리해야”알림, 기존 알림 전략 및 중복 제거 메커니즘 재사용。[Issue #47](https://github.com/try2love/codex-mobile-bridge/issues/47)

### 업그레이드 및 사용 범위

해당 플랫폼의 원래 설치를 덮어씁니다. App，먼저 데이터를 제거하거나 지우지 마십시오.。Android 원본 서명 유지；iOS 원래 애플리케이션 ID를 유지하고 설치하려면 자체 서명 ID를 사용해야 합니다. 게이트웨이와 휴대폰을 동시에 업데이트하는 것이 좋습니다. App，열려 있는 공유 페이지를 새로 고칩니다. 독립형 Test 공식 버전으로 별도의 데이터 디렉토리를 유지하십시오. 각 플랫폼의 수용 범위는 다음을 참조하세요. [기록 확인](VERIFICATION.md#v217)。

Android 백그라운드 알림은 적극적으로 켜져야 하며 알림 권한 및 시스템 절전 정책의 영향을 받습니다.。**iOS 이번에는 프런트 데스크 알림이 개선되었으며 새로 추가된 내용은 없습니다. APNs 백그라운드 푸시。** DSH 호환 가능한 클라이언트 및 런타임 플러그인이 필요합니다. 기본 커넥터의 공식 버전을 공유하고 Test 호환되는 버전을 사용해야 하며, 업데이트하기 전에 작업이 중지되었는지 확인해야 합니다.。Bridge 표시 카테고리는 원래 클라이언트와 동기화되지 않습니다.。

일부 기본 보관 제한 사항은 계속해서 다음에 의해 결정됩니다. [#77](https://github.com/try2love/codex-mobile-bridge/issues/77) 길；[연결 재설정](https://github.com/try2love/codex-mobile-bridge/issues/103)수리 보증 없음 Codex 내부 라우팅이 모두 비정상이라고 해서 공용망 장애가 해소된 것은 아닙니다.。WSL 계정 관리는 실험적 기능으로 계속 제공됩니다.。

### 기여 및 피드백

- 고마워하는 [@heiqiu47](https://github.com/heiqiu47) 의 Android 백그라운드 알림 및 설정, 선택적 재설정 업데이트, 공유 세션 메뉴 및 Android 컴퓨터 옵션 메뉴：[PR #85](https://github.com/try2love/codex-mobile-bridge/pull/85)、[#86](https://github.com/try2love/codex-mobile-bridge/pull/86)、[#92](https://github.com/try2love/codex-mobile-bridge/pull/92)、[#95](https://github.com/try2love/codex-mobile-bridge/pull/95)。
- 고마워하는 [@mc373906408（waken）](https://github.com/mc373906408) 의 Safari 시작 오류 식별 및 실패한 리소스 복구：[PR #88](https://github.com/try2love/codex-mobile-bridge/pull/88)。
- 고마워하는 [@littltstream](https://github.com/littltstream) 블록 수식 렌더링 수정：[PR #96](https://github.com/try2love/codex-mobile-bridge/pull/96)。
- 원저자의 제출물은 그대로 유지되어야 하며, 통합 및 조정 사항은 별도로 기록됩니다. 관련 감사합니다 Issue 권장 사항 및 재테스트 [@SevenPwZ](https://github.com/SevenPwZ) 오른쪽 [#103](https://github.com/try2love/codex-mobile-bridge/issues/103) 결함 피드백。

### English

**v2.1.7 improves mobile notifications, session organization and connection recovery.** Desktop/mobile version: **2.1.7**, Android/iOS build **40**.

- **Android background notifications:** optional reception while away from the app, with pause controls and improved notification navigation that preserves existing pages and drafts. Disabled by default. [#47](https://github.com/try2love/codex-mobile-bridge/issues/47), [PR #85](https://github.com/try2love/codex-mobile-bridge/pull/85).
- **Mobile preferences:** choose notification sources per saved connection; unify light, dark and system themes on Android/iOS, improve iOS foreground notifications and refine the Android gateway menu. [PR #85](https://github.com/try2love/codex-mobile-bridge/pull/85), [PR #95](https://github.com/try2love/codex-mobile-bridge/pull/95).
- **Session organization:** shared long-press, right-click and title menus for details, renaming, pinning, copying, projects and sections. Use native operations where supported and clearly label Bridge-only categories. Unknown writes are not replayed. [PR #92](https://github.com/try2love/codex-mobile-bridge/pull/92), [#77](https://github.com/try2love/codex-mobile-bridge/issues/77).
- **Project references and images:** reference files/folders within the current host project without downloading them to the phone; preserve drafts and use each client's native attachment/reference format. Preview Claude/DSH history images on demand. [#102](https://github.com/try2love/codex-mobile-bridge/issues/102), [#99](https://github.com/try2love/codex-mobile-bridge/issues/99).
- **Chat reading:** language labels and syntax highlighting with original-text copying; collapsible identified DSH context and shared running/approval/error status. Status indicators do not imply token streaming. [#104](https://github.com/try2love/codex-mobile-bridge/issues/104), [#101](https://github.com/try2love/codex-mobile-bridge/issues/101), [#98](https://github.com/try2love/codex-mobile-bridge/issues/98).
- **Projects and DSH:** remote workspace trust confirmation for supported Codex App/Claude Desktop Code connections, improved Codex SSH project registration/grouping, generic DSH plugin binding and separate native DSH Mobile links. [#100](https://github.com/try2love/codex-mobile-bridge/issues/100), [#91](https://github.com/try2love/codex-mobile-bridge/issues/91).
- **Optional reset outlook:** third-party Codex reset information and optional reminders, disabled by default; not an official guarantee or personal account quota. [PR #86](https://github.com/try2love/codex-mobile-bridge/pull/86).
- **Startup and remote recovery:** fix Safari error attribution and failed-resource retries while retaining normal caching; isolate offline SSH hosts, add backoff/manual retry, and improve SSH models and Skill loading. [#87](https://github.com/try2love/codex-mobile-bridge/issues/87), [PR #88](https://github.com/try2love/codex-mobile-bridge/pull/88), [#90](https://github.com/try2love/codex-mobile-bridge/issues/90).
- **Connection and sending:** rebuild supported Desktop connections; reconcile accepted messages using receipts or matching durable native records without resending or discarding newer draft edits. Codex internal routing limitations remain tracked in [#103](https://github.com/try2love/codex-mobile-bridge/issues/103).
- **Other fixes:** WSL Codex timeline/write deadlocks, unanswered cards disappearing across turns, incorrect Claude model-identity errors, attachment picker recovery and connector compatibility. Restore display math immediately after prose. [#94](https://github.com/try2love/codex-mobile-bridge/issues/94), [PR #96](https://github.com/try2love/codex-mobile-bridge/pull/96), [#99](https://github.com/try2love/codex-mobile-bridge/issues/99), [#102](https://github.com/try2love/codex-mobile-bridge/issues/102). Explicit task failures/blocks can now trigger existing attention notifications ([#47](https://github.com/try2love/codex-mobile-bridge/issues/47)).

Install over the matching app without clearing data. Retain Android signing and use matching iOS identifiers and your own signing identity. Update the gateway and mobile app, then refresh shared pages. Android background notifications require permission and remain subject to power management; iOS improvements cover foreground notifications, not new APNs background push. DSH compatibility depends on the client and running plugin. Bridge-only categories do not modify native clients. Archive limitations ([#77](https://github.com/try2love/codex-mobile-bridge/issues/77)), native routing limitations ([#103](https://github.com/try2love/codex-mobile-bridge/issues/103)) and experimental WSL account management remain. See [verification coverage](VERIFICATION.md#v217).

Thanks to **[@heiqiu47](https://github.com/heiqiu47)** for PRs [#85](https://github.com/try2love/codex-mobile-bridge/pull/85), [#86](https://github.com/try2love/codex-mobile-bridge/pull/86), [#92](https://github.com/try2love/codex-mobile-bridge/pull/92), [#95](https://github.com/try2love/codex-mobile-bridge/pull/95); **[@mc373906408 (waken)](https://github.com/mc373906408)** for [#88](https://github.com/try2love/codex-mobile-bridge/pull/88); and **[@littltstream](https://github.com/littltstream)** for [#96](https://github.com/try2love/codex-mobile-bridge/pull/96). Original author commits are retained. Thanks to the issue reporters and testers, including **[@SevenPwZ](https://github.com/SevenPwZ)** for [#103](https://github.com/try2love/codex-mobile-bridge/issues/103).

---

<a id="v216"></a>

## v2.1.6 · 세션 구성, 파일 읽기 및 액세스 경험

이 버전은 휴대폰에 적합합니다. App 및 Web 세션 정렬, 복사 및 파일 읽기, 계정 관리 최적화, 크로스 플랫폼 프로젝트 그룹화 및 목록 업데이트 문제 해결. 데스크톱과 모바일 App 버전은 **2.1.6**，Android/iOS 빌드번호는 **39**。

### 새로운 추가 및 개선 사항

- **주요 대화**：Codex、Claude 및 DSH 에서“언론 최근 상호작용”목록은 고정 및 고정 해제를 지원합니다. 작업은 먼저 현재 장치에 적용된 다음 게이트웨이와 동기화되어 약한 네트워크에 대한 대기 시간을 줄입니다. 이것은 Bridge 휴대폰 App 및 Web 기본 설정을 나열하고 기본을 수정하지 마세요. App 또는 CLI 고정된 상태. 컴퓨터를 마우스 오른쪽 버튼으로 클릭하거나 휴대폰을 길게 눌러 세션 메뉴를 엽니다.。
- **연결 해제 및 보관**：두 번째 확인 추가, 왼쪽“보관 확인”、오른쪽“취소”，두 버튼 모두 스타일과 크기가 동일합니다. 지원되는 액세스에서 선택한 대화 및 확인 가능한 하위 작업을 중지하고 보관하기 전에 중지를 확인하세요. 채팅 기록은 유지되며 보관을 취소할 수 있습니다. 중지되거나 보관 결과를 확인할 수 없는 경우 제출이 자동으로 반복되지 않습니다. 기본 기능 제한 사항은 아래를 참조하세요. 우리는 모든 것을 보장할 수 없습니다 App/CLI 대화를 보관할 수 있습니다。
- **복제 및 세션 세부정보（#74、#75）**：복사 지원 Codex 딥링크、DSH Session ID，파일과 디렉터리의 절대 경로; 이전 버전에 대한 수정 사항 iOS/Android App 복사 시 문제가 발생하여 클립보드에 기록되지 않고 결과 프롬프트가 누락됩니다. 딥링크 항목이 세션 세부정보로 이동되었습니다.“컴퓨터에서 실행”옆에；Windows 공통 드라이브 문자 및 UNC 경로는 더 이상 확장 경로 접두사와 함께 표시되지 않습니다.。
- **파일 읽기（#80、#81）**：Markdown 읽기 모드와 소스 코드 모드 사이를 전환하고 해당 읽기 위치를 유지할 수 있습니다. 텍스트 및 코드에 적용되는 독립적인 파일 글꼴 크기 설정 추가、Markdown 및 HTML 시사; 사진과 PDF 계속해서 자체 확장 방법을 사용하세요.。
- **계정 및 API 연결（#78）**：통일된 Codex 계정 목록, 데스크톱 게이트웨이 유지“계정을 추가하거나 API”그리고 구체적인 금액이 표시됩니다. 휴대폰 API 형태는 기존 배색을 따르고 접힌 제목은 인접한 설정과 일치하며 중복된 외부 프레임은 제거되고 입력 로고가 완성됩니다. 지원됨“업스트림 모델 가져오기”그리고 기본 모델을 자동으로 채웁니다. 컴퓨터에서는 아직 공식 계정 로그인이 완료되어 있습니다。
- **게이트웨이 및 목록**：모든 액세스 주소를 직접 표시（#76），제거하다“클라이언트 및 액세스”초과 Codex/Claude 그룹 제목。Mac/Linux 초기화 또는 표시하지 않음 WSL 기준 치수. 수리하다 DSH/Claude 목록 및 고정 상태 읽기 범위로 인한 업데이트 실패, 최근 세션과 프로젝트 목록 간의 캐시 간섭。
- **연결 및 프로젝트 그룹화（PR #73、#82）**：수리하다 Windows SSH/CLI 프로젝트 디렉토리 그룹 이름. 개선하다 HTTP 대기열 용량 모니터링, 동시 연결 액세스 개선, 예외 확인 GET 후속 요청을 오염시키지 않고 연결을 닫도록 요청합니다.。

### 보관 지원 범위 및 제한 사항

- **Codex**：네이티브 런타임과의 호환성 지원 CLI/WSL 세션 및 활동적인 작성자가 없는 세션 App 역사。**아직 Codex App 개최된 세션 중 일부를 일시적으로 이용할 수 없습니다. Bridge 릴리스 및 보관**，제발 Codex App 중간 아카이브；Bridge 이것 때문에 모든 것을 그만 두지는 않을 것입니다 App、다른 세션에 영향을 미치거나 기본 데이터베이스를 직접 덮어씁니다.。
- **Claude**：Claude Code Desktop 지원되는 기본 인터페이스를 통해 중지 및 보관。CLI/SSH/WSL 기본 버전, 구성 ID, 세션 파일 및 쓰기 프로세스 검사를 통과한 후에만 활성화되는 되돌릴 수 있는 파일 보관을 사용합니다. 검증되지 않은 버전、Windows 네이티브 CLI，다른 작성자가 여전히 감지되는 환경은 보관되지 않을 수 있습니다.。**Cowork 보관 및 복구는 아직 지원되지 않습니다.。**
- **DSH**：이 버전의 보관 프로세스를 지원하는 커넥터가 필요합니다. 기본 아카이브를 호출하기 전에 대상 세션과 해당 작업을 중지하고 다시 확인하십시오. 보안 상태를 확인할 수 없으면 실행하지 마십시오. 실행 중인 이전 커넥터를 업그레이드하려면 명시적으로 액세스를 다시 시작해야 합니다. 게이트웨이 자체를 시작해도 자동으로 다시 시작되지 않습니다. DSH。
- 보관해도 채팅 기록은 삭제되지 않으며, 보관 취소 시 완료되지 않은 작업은 자동으로 복원되지 않습니다. 위의 미완성 범위는 다음에 의해 계속됩니다. [#77](https://github.com/try2love/codex-mobile-bridge/issues/77) 길。

### 치받이

해당 플랫폼 원본을 덮고 설치하십시오. App，먼저 데이터를 제거하거나 지우지 마십시오.。Android 원본 서명 유지；iOS 설치를 직접 덮어쓰려면 여전히 동일한 애플리케이션 ID와 서명 ID를 사용해야 합니다. 독립적인 Test 그리고 형식적인 App 설치 및 데이터 디렉터리를 별도로 유지。

게이트웨이 업데이트 후 새로 고침 Web 또는 휴대폰 공유 페이지; 오래된 휴대폰 App 원래 컴퓨터에 연결할 수 있습니다“더 → 페이지 새로 고침”새 버전을 로드합니다. 공식 버전과 Test 하나를 공유하다 DSH 기본 커넥터는 호환되는 버전으로 함께 업그레이드되어야 합니다. 두 개의 게이트웨이 세트를 독립적으로 설치해도 동일한 기본 커넥터가 격리되지 않습니다. 기본 작업이 중지되었음을 확인한 후에만 명시적으로 다시 시작하여 커넥터 업그레이드가 완료됩니다.。

### 기여 및 피드백

고마워하는 [@lanchengjiu](https://github.com/lanchengjiu) 의 [PR #73](https://github.com/try2love/codex-mobile-bridge/pull/73)，게다가 [@mc373906408（waken）](https://github.com/mc373906408) 의 [PR #82](https://github.com/try2love/codex-mobile-bridge/pull/82)。두 저자의 원본 제출물이 승인되었습니다. merge 예약하다. 고마워하는 #74、#75、#76、#77、#78、#80、#81 제안 및 크로스 플랫폼 테스트 피드백。

### English

**v2.1.6 improves chat organization, file reading, copying and account management.** Desktop/mobile version: **2.1.6**, Android/iOS build **39**.

- Pin Codex, Claude and DSH chats in Bridge's recently active list. Apply changes locally before gateway synchronization; native clients' pin states are unchanged. Context menus support desktop right-click and mobile long-press.
- Confirm before stopping and archiving a supported chat. Confirm archive is on the left and Cancel on the right, with equal styling and size. Verify the selected chat and its descendants have stopped before archival; retain history and never replay uncertain operations.
- Copy Codex deep links, DSH session IDs and absolute file/folder paths. Restore clipboard writes and feedback in older iOS/Android apps; normalize Windows display paths.
- Switch Markdown between reading and source views and use a separate file-text size preference. Images and PDFs retain their own zoom controls.
- Unify Codex account inventory while retaining desktop quota details and the existing add-account/API entry. Improve the mobile API form and fetch upstream models to fill a default model. Official sign-in remains on desktop.
- Show all gateway addresses, remove redundant client headings and keep WSL initialization/UI on Windows. Fix DSH/Claude list refresh scope and recent/project cache interference. PR #73 corrects Windows SSH/CLI project names; PR #82 increases the HTTP listener backlog.

**Archive limitations:** Codex App-owned writers cannot always be released externally; archive those chats in Codex App. Claude Code Desktop needs compatible native support. Claude CLI/SSH/WSL reversible file archival is gated by verified versions, identity, files and writer checks; unsupported versions and Windows native CLI may be unavailable. Cowork archive/restore is unsupported. DSH needs the compatible connector and fresh stop verification. Bridge never quits a shared app or kills unrelated work to archive a chat. Restoring history does not restart unfinished tasks. Issue #77 remains open for these limitations.

Install over the matching existing app without clearing data; retain Android signing and use matching iOS identifiers/signing. Refresh shared pages after the gateway update. If Test and production share one native DSH connector, upgrade both gateways compatibly and explicitly restart the connector only after its tasks have stopped.

Thanks to [@lanchengjiu](https://github.com/lanchengjiu) for PR #73 and [@mc373906408 (waken)](https://github.com/mc373906408) for PR #82; original author commits are retained through merges.

---

<a id="v215"></a>
<a id="v215-unreleased"></a>

## v2.1.5 · WSL CLI、프로젝트 생성 및 채팅 관리

이 버전은 확장됩니다 Windows 게이트웨이 WSL Codex / Claude Code CLI 클라이언트 전반에 걸쳐 새 프로젝트에 액세스하고 통합하며 회신 읽기, 메시지 대기열 및 브라우저 탐색을 개선합니다. 데스크톱과 모바일 App 버전은 **2.1.5**，Android/iOS 빌드번호는 **38**。

### 새로운 추가 및 개선 사항

- **WSL Codex 및 Claude Code CLI**：원본에서 실행 중인 배포판을 스캔하고 등록합니다. Linux 기록을 읽고, 사용자 및 구성 디렉터리에서 명시적으로 계속하거나 새 채팅을 생성하세요.；Codex 공유하다 APP / CLI / WSL 소스 필터링，Claude 표시 CLI · WSL。기본 기능을 기반으로 모델, 추론, 권한 제공、Skill、승인, 중지, 문서화、Git、첨부 파일, 터미널 및 알림；Codex 네이티브도 지원 Goal 지속적인 대기열이 있습니다. 각 환경의 계정, 작업 디렉터리, 초안, 기록 페이징 및 작업 영수증을 보관합니다. 모델 디렉터리는 ID로 캐시됩니다. 패시브 브라우징은 중지된 배포를 깨우지 않으며 액세스를 닫아도 원래 버전이 종료되지 않습니다. CLI 작업, 테마 스위치가 다시 작성되지 않습니다. WSL Claude 대화。[WSL 사용 지침](docs/wsl-codex.md)
- **WSL 계정 및 액세스（실험적）**：릴리스, 사용자 및 구성 디렉터리에서 지원되는 저장, 가져오기 및 전환 API 원본 파일 구성에 액세스하고 복원합니다. 공식 로그인이 아직 남아있습니다. WSL 마치다；Windows 및 WSL 자격 증명은 자동으로 동기화되지 않습니다. 전환하기 전에 작업, 승인, 대기열, 확인되지 않은 작업을 확인하세요. 유휴 실행자는 정상적으로 전달됩니다. 확인할 수 없거나 외부 도구로 관리되는 구성은 전환을 중지합니다. 이 기능은 모든 계정과 구성이 사용 가능함을 보장하지 않으며 실제 다중 계정의 전체 프로세스 검증이 완료되지 않았습니다. 성공적인 저장 또는 전환이 성공적인 업스트림 인증을 의미하지는 않습니다.。[실험 계정 설명](docs/wsl-accounts.md)
- **클라이언트 간 새 프로젝트 채팅**：Codex App、로컬 머신/SSH CLI、WSL、Claude Desktop/CLI 및 DSH Desktop 실행 환경 및 디렉터리 선택기를 공유하고, 기존 프로젝트를 선택하고, 다른 디렉터리를 찾아보거나 상위 디렉터리에 새 폴더를 만듭니다. 네이티브 프로젝트 등록 및 권한 상속；Claude 명확하게 표시“작성 및 보내기”，디렉토리 자체를 검색하는 것만으로는 메시지가 전송되지 않습니다. 새로운 SSH 디렉토리, 이전 런타임 및 DSH 커넥터 기능 경계는 다음을 참조하세요.[사용 지침](docs/project-chats.md)。
- **리뷰, 인용, 첨부 파일에 답장하기**：전체 코드 검토 표시는 복사 가능한 검토 카드로 표시되며 인증 파일을 열 수 있고 해당 코드 줄이 강조 표시됩니다. 후속 조치 버튼은 먼저 초안에 추가된 다음 사용자에 의해 전송됩니다.。Codex / Claude 메시지 및 선택한 텍스트 인용을 지원하고 원본 초안을 유지하며 세션별로 복원합니다. 현재 채팅 첨부 파일에 이미지 미리보기를 추가할 수 있습니다. 파일 참조 및 수정된 파일 요약은 권한이 제한된 위치 링크를 제공하고 긴 요약은 페이지 매김을 유지합니다.。`codex://review` 예약하다 Desktop 대상, 식별됨 GitHub PR 당시 웹포털을 제공합니다. 휴대폰에서의 재생산을 약속하지 않습니다 Desktop 단독 리뷰 상태。Mermaid 기존 미리보기 기능을 계속 사용하세요.。[작동 지침](docs/output-interactions.md)
- **메시지 관리 및 다중 페이지 일관성（#71、PR #70）**：에서“더 → 메시지 관리”보내지 않은 메시지를 회수하고, 첨부 파일과 큐 위치를 그대로 편집하고, 게이트웨이의 실제 전송 순서를 조정하고, 확인되지 않은 레코드를 조정하거나 명시적으로 무시합니다. 넘겨졌다 Claude / DSH 기본 클라이언트의 대기열은 여전히 ​​원래 클라이언트에서 관리됩니다. 전송을 명시적으로 거부한 후 남은 부분과 이전 페이지 기록 간의 간섭을 수정합니다. 다른 페이지 요청을 지우지 않고, 알 수 없는 결과를 자동으로 다시 보내지 않으며, 콘텐츠를 유지하고 관리자 다시 열기를 지원하도록 충돌을 편집합니다.。[메시지 관리](docs/message-management.md)
- **항목별로 그룹화된 반품（#67、PR #70）**：브라우저 반환은 실수로 작업대를 떠나는 것을 방지하기 위해 채팅, 도구 및 전체 화면 계층 구조를 따릅니다. 결정된 Windows / UNC 실제 실행 호스트의 경로 규칙에 따라 프로젝트를 분류하고 그룹화합니다.。
- **주문형 리소스 및 취약한 네트워크**：채팅 목록 시작 시 더 이상 선택적 파일 및 차트 렌더러를 기다리지 않습니다. 해당 기능이 켜지면 로드되어 콘텐츠 캐시를 재사용하고 제한된 복구를 유지합니다. 메시지, 페어링 등의 쓰기는 자동으로 재생되지 않습니다. 좁은 화면 WebKit 의 WSL 팝업 창은 사용 가능한 뷰포트에 맞게 조정됩니다.。
- **클라이언트 및 휴대폰 수명주기**：연결 입구 복구, 기본 채팅 출력 및 페이징 기록 복원을 개선하고, 클라이언트 작업을 유지하고 ID에 액세스합니다. 클로저를 구별하다 Bridge 실수로 다른 기본 프로세스에 영향을 주지 않도록 데스크톱 프로그램에 액세스하고, 작업을 중지하고, 종료하세요.。

### 업그레이드 및 경계

해당 플랫폼 원본을 덮고 설치하십시오. App，먼저 데이터를 제거하거나 지우지 마십시오.。Android 원본 서명 유지；iOS 설치를 덮어쓰려면 여전히 자신을 서명하고 동일한 애플리케이션 ID와 서명 ID를 사용해야 합니다. 독립적인 Test 공식 버전에는 포함되지 않습니다. 게이트웨이 업데이트 후 새로 고침 Web / 모바일 공유 페이지; 오래된 Android 원래 컴퓨터에 연결할 수 있습니다“더 → 페이지 새로 고침”새 버전을 적극적으로 로드。

WSL 기능에는 기본 설치 및 호환 기능이 필요합니다. CLI；검색은 프로그램을 설치하지 않으며 새 포털을 자동으로 활성화하지 않습니다. 계정 관리는 아직 실험적이며 시뮬레이션 테스트, 구성 작성 또는 모델 목록은 실제 다중 계정 인증 및 작업 확인으로 간주되지 않습니다. 각 플랫폼, 빌드 및 측정 범위는 다음을 참조하세요.[기록 확인](VERIFICATION.md#v215)。

### 기여 및 피드백

- 고마워하는 [@we-worker](https://github.com/we-worker) 에서 [PR #64](https://github.com/try2love/codex-mobile-bridge/pull/64) 기부금 WSL、Magpie 프로젝트 디렉토리 기능과 모두 호환 가능 **8 원래 커밋**예약하다。
- 고마워하는 [@lanchengjiu](https://github.com/lanchengjiu) 에서 [PR #70](https://github.com/try2love/codex-mobile-bridge/pull/70) 중간 수리 Windows 프로젝트 분류 및 발송 거부 잔여, 원본 제출 **d62002b** 역사에 남다。
- 고마워하는 [#67](https://github.com/try2love/codex-mobile-bridge/issues/67)、[#71](https://github.com/try2love/codex-mobile-bridge/issues/71) 관련 피드백을 읽으려면 답장을 보내세요.；[#46](https://github.com/try2love/codex-mobile-bridge/issues/46) 의 Desktop 리뷰 링크는 위의 경계에 따라 처리됩니다.。

### English

**v2.1.5 expands WSL CLI access, project creation, reply interactions and message management.** Desktop/mobile version: **2.1.5**, Android/iOS build **38**.

- **WSL Codex and Claude Code:** register running distributions and use their Linux user, configuration, account and workspace. Browse history, explicitly resume or create chats, and use native-supported models, reasoning, permissions, Skills, approvals, stop, files, Git, attachments, terminals and notifications. Codex also supports native Goal controls and durable queues. Preserve environment-scoped drafts, paging, receipts and identity-bound model caches. Passive reads do not wake stopped distributions; disconnecting Bridge does not quit original CLI tasks. Theme changes keep WSL Claude sessions intact. [WSL guide](docs/wsl-codex.md)
- **Experimental WSL account management:** save, import, switch supported API connections and restore original file configuration per distribution/user/configuration directory. Official sign-in stays in WSL; Windows credentials are not synchronized automatically. Check tasks, approvals, queues and unconfirmed operations before graceful idle-runtime handoff; refuse unverifiable or externally managed configurations. Compatibility is not guaranteed, and real multi-account end-to-end validation remains incomplete. Saving or switching configuration does not establish upstream authentication. [Account guide](docs/wsl-accounts.md)
- **New project chats:** a shared environment/directory picker serves Codex App, local/SSH CLI, WSL, Claude Desktop/CLI and DSH Desktop. Browse existing directories or create a folder, retaining native registration and permissions. Claude explicitly uses **Create and send**. New SSH paths, older runtimes and DSH connector requirements retain the limits in the [project guide](docs/project-chats.md).
- **Reply interactions:** render complete code-review directives as copyable cards; open authorized code locations with line highlighting. Follow-up buttons append to the draft for explicit sending. Codex/Claude quotes preserve and restore scoped drafts, and image previews can add current-chat attachments. File citations and paged edited-file summaries link to authorized locations. Desktop review links retain their target, with a web action for recognized GitHub PRs; Desktop-only review state is not reproduced on mobile. Existing Mermaid preview remains available. [Interaction guide](docs/output-interactions.md)
- **Message management and multiple pages (#71, PR #70):** withdraw unsent messages, edit in place while retaining attachments and queue position, persist actual dispatch order, and reconcile or explicitly dismiss unconfirmed records. Claude/DSH native queues remain with their clients. Fix residual records after explicit rejection and interference from older pages. Preserve other pages' submissions, do not replay unknown outcomes, and retain conflicting edits for reopening. [Message guide](docs/message-management.md)
- **Navigation and grouping (#67, PR #70):** browser Back follows chat/tool/fullscreen navigation without unexpectedly leaving the workbench. Correct Windows/UNC project grouping using the execution host's path rules.
- **Resources and slow links:** keep optional file/diagram renderers off chat-list startup, load them when needed, reuse cached content and retain bounded recovery. Writes are not replayed automatically. Fit WSL dialogs within narrow WebKit views.
- **Client and mobile lifecycle:** improve connection-entry recovery and native-output/paged-history restoration while preserving task and connection identity. Keep Bridge disconnection, task stopping and desktop exit distinct.

Install over the matching app without clearing data. Android retains its signing identity; iOS requires your own matching signing identity and app identifiers. Test apps remain separate. Refresh shared pages after updating the gateway; older Android apps may need **More → Refresh page** in the existing computer connection. WSL needs an installed, compatible native CLI; discovery neither installs nor automatically enables it. Experimental account configuration and simulated checks are not real multi-account authentication evidence. See [verification coverage](VERIFICATION.md#v215).

Thanks to [@we-worker](https://github.com/we-worker) for [PR #64](https://github.com/try2love/codex-mobile-bridge/pull/64), with all **eight original commits** retained, and [@lanchengjiu](https://github.com/lanchengjiu) for [PR #70](https://github.com/try2love/codex-mobile-bridge/pull/70), retaining original commit **d62002b** in ancestry. Thanks to reporters of [#67](https://github.com/try2love/codex-mobile-bridge/issues/67), [#71](https://github.com/try2love/codex-mobile-bridge/issues/71) and reply-interaction issues; [#46](https://github.com/try2love/codex-mobile-bridge/issues/46) Desktop review links retain the limits above.

---

<a id="v214"></a>

## v2.1.4 · 공용 네트워크 시작, 긴 세션 및 네트워크 복구

이 버전은 공용 및 취약한 네트워크에서 워크벤치 시작을 개선하고, 지나치게 긴 세션의 연결 끊김 문제를 수정하고, Web 원클릭 복제 및 네트워크 변경 사항에 대한 선택적 자동 복구. 데스크톱과 모바일 App 버전은 **2.1.4**，Android/iOS 빌드번호는 **37**。

### 수정 및 개선

- **공용 네트워크 시작 및 캐시 재사용（#62）**：수리하다 Cloudflare 추가 통계 스크립트가 차단되어 오류 페이지에서 입장이 멈추는 현상을 수정하였습니다. 필요한 리소스를 미리 다운로드하여 종속성 순서대로 실행합니다. 단기적인 다운로드 실패 또는 초기 로그인 상태 읽기 시간 초과는 제한된 재시도이며 변경되지 않은 캐시된 리소스는 반복적으로 열리고 재사용됩니다.。
- **긴 세션 연결 및 읽기（#65）**：대형 수리 Desktop 기록 스냅샷이 수신 상한을 초과하여 현재 세션과 다른 세션의 연결이 끊어집니다. 입장 시 캐시된 최신 콘텐츠가 먼저 표시되고, 읽은 위치를 유지하기 위해 위로 스크롤한 후 이전 기록이 로드됩니다. 이력 읽기는 원래 세션의 실시간 제어와 분리되어 있으며 전송 및 승인은 원래 연결을 통해 계속 처리됩니다.。
- **다중 클라이언트 기록**：～을 위한 Codex Desktop/CLI、Claude Code Desktop/CLI 및 DeepSeek Harness 지원되는 해당 기록 읽기 방법에 액세스합니다. 향상된 교차 페이지 도구 로깅, 만료된 응답 처리 및 Windows Claude 기록 파일의 변경 사항을 인식하고 계정, 작업 디렉터리 및 권한 경계를 유지합니다.。
- **Web 원클릭 복사（#66）**：답장, 코드 및 Mermaid 소스 코드는 원 클릭 복사를 지원하여 근거리 통신망을 완성합니다. HTTP 긴 본문을 지연하여 가져오는 호환 경로입니다. 브라우저가 거부할 경우 재복사 및 수동 입력 제공。
- **선택적 네트워크 변경 복구（PR #63）**：기본적으로 꺼져 있으며, 로그인 후 데스크톱 게이트웨이나 휴대폰에서 사용할 수 있습니다./Web 즉시 시작하고 중지합니다. 시스템 네트워크 이벤트를 사용하고 30 몇 초 만에 모든 것을 확인하고 안정화 후 실제 사용 가능한 LAN 입구를 업데이트하세요. 같은 IP 갱신은 재구축되지 않습니다. 수리하다 Windows 네트워크 카드 주소 읽기, 여러 네트워크 카드의 이전 구성 마이그레이션 및 실패한 수신 주소에 대한 잘못된 경보；Quick Tunnel 먼저 스스로 복구하고, 계속해서 클리어 실패를 겪은 후 제한된 방식으로 다시 빌드하세요.。

### 치받이

해당 플랫폼에 대한 원본 애플리케이션을 덮어쓰고 설치합니다. 구성, 컴퓨터 목록 및 유효한 휴대폰 바인딩을 유지하려면 먼저 데이터를 제거하거나 지우지 마십시오.。Android 원본 서명 유지；iOS 공식 애플리케이션 ID를 따르되 설치하려면 자체 서명 ID를 사용해야 합니다. 독립적인 Test 공식 버전에는 포함되지 않습니다. 브라우저 및 기존 휴대폰 App 게이트웨이 업데이트 후 공유 페이지를 새로 고칠 수 있습니다.。

네트워크 복구는 휴대폰에 저장된 오래된 파일을 자동으로 덮어쓰지 않습니다. IP；주소가 변경된 후에는 안정적인 도메인 이름, 기타 유효한 입구를 사용하거나 QR 코드를 다시 스캔하세요. 각 플랫폼 및 업그레이드의 허용 범위를 확인하세요.[기록 확인](VERIFICATION.md#v214)。

### 기여 및 피드백

- [@qybgh](https://github.com/qybgh) 에서 [PR #63](https://github.com/try2love/codex-mobile-bridge/pull/63) Zhongdong은 네트워크 카드 관리 입구, 주소 변경 알림 및 네트워크 복구의 기본에 기여합니다. 모두 8 원래 제출 내용은 유지되며 기본 종료, 모니터링 및 복구 전략 수정 사항은 별도로 제출됩니다.。
- 고마워하는 [@P2pfans2000](https://github.com/P2pfans2000) 에서 [Issue #62](https://github.com/try2love/codex-mobile-bridge/issues/62) 공용 네트워크 시작 문제는 물론 크로스 플랫폼 및 휴대폰 테스트에 참여하는 사용자를 보고하고 다시 테스트합니다.。

### English

**v2.1.4 improves public-entry startup, long-chat connections and reading, Web copying, and optional network recovery.** Desktop/mobile version: **2.1.4**, Android/iOS build **37**.

- **Startup and caching (#62):** fix Cloudflare entries remaining on the error page when an optional injected script is blocked. Preload required resources while preserving execution order, retry transient resource/auth-state reads within limits, and reuse unchanged cached assets.
- **Long chats (#65):** fix oversized Desktop snapshots closing the shared connection. Display cached/recent messages first, load older history on demand and preserve reading position. History display is separate from the original connection used for sending and approvals.
- **Client history:** use supported history sources for Codex Desktop/CLI, Claude Code Desktop/CLI and DeepSeek Harness. Improve cross-page tool records, stale-response handling and Windows Claude history-change detection without changing account, workspace or permission boundaries.
- **One-click Web copying (#66):** copy replies, code and Mermaid source, including LAN HTTP and delayed full-text retrieval. Retry and manual copying remain available if the browser refuses clipboard access.
- **Optional network recovery (PR #63):** off by default; toggle from desktop or signed-in mobile/Web. Native events and a 30-second fallback update working LAN entries after addresses stabilize. Same-address renewals do not rebuild entries. Fix Windows adapter addresses, legacy multi-adapter migration and failed-listener reporting. Quick Tunnel reconnects first and is replaced only after repeated confirmed failures.

Install over the matching existing app without uninstalling or clearing data. Android retains its signing identity; iOS retains official identifiers and requires your own signing. Independent Test apps do not replace release apps. Network recovery does not rewrite old IP addresses saved on phones; use a stable hostname, another working entry or a new pairing QR code.

Thanks to [@qybgh](https://github.com/qybgh) for [PR #63](https://github.com/try2love/codex-mobile-bridge/pull/63), with all eight original commits preserved, and [@P2pfans2000](https://github.com/P2pfans2000) for reporting and retesting [#62](https://github.com/try2love/codex-mobile-bridge/issues/62). See the [verification record](VERIFICATION.md#v214) for platform and upgrade coverage.

---

<a id="v214-preview1"></a>

## v2.1.4-preview.1 · 시동 복구 및 첫 번째 로드 최적화

이는 수정 사항에 초점을 맞춘 숙련된 사용자를 위한 시험판 버전입니다. Issue #62 워크벤치 시작 문제。**v2.1.3 아직 최신 공식 버전**，공식 버전 업데이트 확인에서는 이 미리보기 버전을 자동으로 설치하지 않습니다. 이 코드 라운드는 독립적인 시험판 분기에 유지되며 아직 병합되지 않았습니다. main。

### 수정 및 개선

- **Cloudflare 고정된 입구**：수리부품 Cloudflare Tunnel 첨부된 통계 스크립트로 인해 브라우저 보안 정책에 의해 해당 페이지가 차단되어 멈췄습니다.“워크벤치가 아직 로드되지 않았습니다.”문제. 원래의 액세스 보안 제한을 유지하세요。
- **최초 로딩 속도 향상**：페이지 스타일을 로드할 때 필요한 스크립트를 미리 다운로드하여 약한 네트워크 및 공용 네트워크 입구에서 여러 차례의 대기 시간을 줄입니다. 스크립트는 여전히 종속성 순서로 실행됩니다.。
- **캐시 재사용**：동일한 콘텐츠 버전의 리소스를 반복적으로 열고 재사용합니다. 업그레이드 후에는 변경된 리소스만 업데이트되며 홈페이지는 적시에 현재 버전을 읽습니다.。
- **자동 복구 시작**：짧은 리소스 다운로드 실패 또는 초기 로그인 상태 읽기 시간 초과는 제한된 방식으로 다시 시도됩니다. 오류가 계속되면 복구 상태, 확장 가능한 세부 정보 및 다시 로드 항목이 표시되고 더 이상 빈 페이지가 없습니다.。
- **휴대폰 및 접근 가능한 디스플레이**：초기 기본 클립보드 스크립트 로드 실패 후 복구가 향상되었으며 동적 효과 설정에서 시작 프롬프트가 감소되었습니다. 페어링, 메시지 등의 쓰기는 자동으로 재전송되지 않습니다.。

### 다운로드 및 업그레이드

데스크톱 및 모바일 릴리스 버전은 다음과 같습니다. **2.1.4-preview.1**，Android/iOS 빌드번호는 **36**（iOS 시스템 버전 필드는 다음과 같습니다. 2.1.4）。공급 macOS Apple Silicon/Intel、Windows x64、Linux x64/arm64、Android APK、iOS 서명되지 않은 IPA 및 Xcode 소스코드 패키지。

원래 설치를 덮어쓰고 원래 데이터 디렉터리를 유지하려면 해당 설치 패키지를 선택합니다.；Android 원본 서명 사용，iOS 원본 애플리케이션 로고를 사용하고 직접 서명하세요. 먼저 데이터를 제거하거나 지우지 마십시오. 업데이트만 Web 이 공유 페이지를 사용하여 게이트웨이를 복구할 수도 있습니다. 피드백을 제공할 때 플랫폼, 브라우저 또는 App、접근 방법 및 최초 접속 방법/반복개방의 수행 시작 페이지 확장에 대한 세부정보를 첨부할 수 있습니다. 로그인 링크나 자격 증명은 포함하지 마세요.。

고마워하는 [Issue #62](https://github.com/try2love/codex-mobile-bridge/issues/62) 크로스 플랫폼 테스트에 참여하는 문제 및 사용자에 대한 피드백입니다. 허용 범위는 다음을 참조하세요. [기록 확인](VERIFICATION.md#v214-preview1)。

### English

**v2.1.4-preview.1 is an opt-in prerelease focused on Issue #62 startup recovery and first-load performance.** v2.1.3 remains the latest stable release. Stable update checks do not install this preview automatically, and these changes remain on a separate branch pending wider feedback.

- Fix workspaces getting stuck behind “The workspace has not finished loading” when an optional script added by Cloudflare is blocked. Existing security restrictions remain in place.
- Start downloading required scripts while styles load to reduce sequential waits on slow or public connections, while preserving execution order.
- Reuse unchanged, content-versioned resources on repeat visits and after upgrades; the entry page continues to fetch the current version.
- Retry transient resource failures and the initial sign-in-state read within fixed limits. Persistent failures show recovery status, expandable details and a reload action instead of leaving an empty page.
- Improve early native clipboard recovery and startup indicators with reduced motion. Pairing, messages and other writes are not automatically replayed.

Desktop/mobile release version: **2.1.4-preview.1**, Android/iOS build **36** (iOS marketing version 2.1.4). Downloads include macOS Apple Silicon/Intel, Windows x64, Linux x64/arm64, Android APK and unsigned iOS IPA/Xcode sources. Install over the matching existing app without uninstalling or clearing data; Android retains its signing identity and iOS retains its app identifiers but requires your own signing. Updating the gateway also delivers these shared Web fixes to existing mobile apps.

Thanks to the [Issue #62](https://github.com/try2love/codex-mobile-bridge/issues/62) reporter and cross-platform testers. Please report your platform, browser/app, connection type and first/repeat-load behavior. See the [verification record](VERIFICATION.md#v214-preview1) for coverage.

---

<a id="v213"></a>
<a id="unreleased-webhook"></a>
<a id="unreleased-mermaid"></a>

## v2.1.3 · 다중 대상 알림, 차트 읽기 및 연결 복구

이 버전에는 여러 가지 독립적인 기능이 추가되었습니다. Webhook 목표와 Mermaid 차트 읽기 및 약한 네트워크 로딩 개선、iOS 연결 복구 및 휴대폰 입력 상호 작용. 데스크톱과 모바일 App 버전은 **2.1.3**，Android/iOS 빌드번호는 **35**。각 플랫폼의 수용 범위는 다음을 기반으로 합니다.[기록 확인](VERIFICATION.md)대상。

### 새로운 추가 및 개선 사항

- **다수의 Webhook 목표를 수신하다**：각 구성은 독립적으로 이름을 지정하고, 시작하고, 중지하고, 편집하고, 테스트하고, 삭제할 수 있습니다. 이전 단일 대상 구성이 계속 표시됩니다. 자동 인식, 일반 사용자 정의, Feishu 및 DingTalk 지원、Discord 및 Telegram 편집 가능 JSON 템플릿, Feishu 및 DingTalk는 선택적 서명을 지원합니다. 수리 Feishu 반환 HTTP 200 그러나 사업이 거절될 경우 오탐성 성공이 발생하는 문제가 있다. 테스트에는 저장된 구성만 사용됩니다. 저장하면 알림이 전송되지 않습니다. 일반 구성 읽기는 저장된 주소, 요청 헤더 및 서명 키를 숨기고, 주소는 적극적으로 볼 때만 반환됩니다. 활성화된 각 대상은 세션을 시작하거나 기록 알림을 다시 발행하지 않고 독립적으로 전달, 중복 제거 및 재시도됩니다. 세부정보 보기 [Webhook 구성 지침](docs/webhook-notifications.md)。
- **Mermaid 차트 읽기**：에서 Codex、Claude、DeepSeek Harness 채팅하다 Markdown 파일의 전체 미리보기 Mermaid 코드 블록에서는 소스 코드를 전환하고 원본 텍스트를 복사할 수 있습니다. 전화기가 전체 화면일 때 두 손가락을 사용하여 확대/축소, 드래그하거나 두 번 클릭하여 확대 및 복원할 수 있습니다. 와이드 화면에서는 스크롤 휠, 버튼을 사용하고 두 번 클릭하여 확대/축소한 다음 차트를 드래그할 수 있습니다. 완료되지 않은 스트리밍 콘텐츠에는 소스 코드가 유지됩니다. 후속 텍스트 업데이트는 변경되지 않은 차트를 재사용합니다.。iOS App 탐색 정책에 의해 차트 미리보기 하위 페이지가 가로채는 문제를 동기적으로 수정합니다. 게이트웨이를 업데이트해야 하며 App。
- **약한 네트워크 로딩 및 Windows 포함**：정적 리소스는 콘텐츠를 기반으로 버전 주소를 생성하고 브라우저 캐싱 및 조건부 요청은 반복 방문에 사용될 수 있습니다. 페이지별 보안 난수 사용 HTML 아직 캐시되지 않음。Windows 패키지는 계속 지원됩니다. Electron 패키지 본문을 줄이기 위한 언어 리소스。
- **액세스 및 복구**：수리하다 DeepSeek Harness 자동으로 포장됨 YAML 액세스 구성을 인식할 수 없는 문제；iOS 게이트웨이에 연결할 수 없거나 터널 오류가 발생한 경우 기본 재시도 및 반환 컴퓨터 목록 항목을 제공합니다. 데스크탑 라벨 표시 변경 후 계정 쿼리가 재개되어 불필요한 요청이 줄어듭니다.。
- **휴대폰 상호작용**：팝업 창이 열릴 때 기본 숨기기“더”입구; 휴대폰 목록, 팝업 창 및 일반 입력 상자의 초점 모양을 조정합니다. 보조 답안 카드의 입력란이 키보드로 가려지면 한 번만 보이고 위치가 지정되며, 입력 시 반복적으로 이동되지 않습니다.。

### 치받이

원래 컴퓨터 목록, 페어링 및 게이트웨이 데이터를 유지하려면 설치를 덮어쓰고 먼저 구성을 제거하거나 지우지 마십시오.。Android 원본 서명 유지；iOS 공식 앱 ID를 유지하고 설치하려면 자체 서명 ID를 사용해야 합니다.。Web 게이트웨이 업데이트 후 페이지가 새로 고쳐집니다.；iOS 기본 연결 복구 및 Mermaid 하위 페이지를 복구하려면 일치가 필요합니다. App 고쳐 쓰다. 공유 릴레이 배포에는 동기화된 업데이트 서비스가 필요합니다.。

### 기부자

- [@wangzheuser](https://github.com/wangzheuser) 제출하다 [PR #51](https://github.com/try2love/codex-mobile-bridge/pull/51)，수리하다 Harness 줄 바꿈 구성 분석; 원래 제출 작성자 [@w154594742](https://github.com/w154594742) 서명 예약됨。
- [@RigerWu](https://github.com/RigerWu) 에서 [PR #52](https://github.com/try2love/codex-mobile-bridge/pull/52) 기부금 iOS 기본 연결 복구 입구。
- [@heiqiu47](https://github.com/heiqiu47) 에서 [PR #40](https://github.com/try2love/codex-mobile-bridge/pull/40) 계정 쿼리 개선 사항은 다음에서 제안됩니다. 이 버전의 범위는 쿼리 수명 주기 수렴뿐입니다.。
- [@jasongzy](https://github.com/jasongzy) 통해 [Issue #60](https://github.com/try2love/codex-mobile-bridge/issues/60) 보편적인 제안 Webhook 통지 요구 사항。
- [@tiancai123123](https://github.com/tiancai123123) 에서 [Issue #54](https://github.com/try2love/codex-mobile-bridge/issues/54) 다음에서 정적 리소스를 찾습니다. [PR #56](https://github.com/try2love/codex-mobile-bridge/pull/56) 기여 콘텐츠 해시 캐싱 및 조건부 요청。

### English

**v2.1.3 brings multiple Webhook destinations, Mermaid reading, faster repeat loads on slow links, iOS connection recovery and mobile interaction refinements.** Desktop and mobile apps use version **2.1.3**; Android/iOS build number **35**. See the [verification record](VERIFICATION.md) for platform-specific coverage.

- **Webhook destinations:** create multiple named endpoints and enable, edit, test or delete each independently. Editable JSON presets cover automatic detection, Custom Webhook, Feishu, DingTalk, Discord and Telegram; Feishu and DingTalk offer optional signing. Feishu responses with HTTP 200 but a rejected business code no longer report success. Tests use saved settings only, and saving does not send a notification. Ordinary settings reads mask saved URLs, headers and signing secrets; a saved URL is returned only on explicit reveal. Enabled endpoints deliver, deduplicate and retry independently, without activating chats or replaying past notifications. See the [setup guide](docs/webhook-notifications.md#english).
- **Mermaid reading:** preview complete Mermaid fences in Codex, Claude and DeepSeek Harness chats and Markdown files, switch to source and copy it. In fullscreen, pinch to zoom, drag when enlarged or double-tap to zoom and reset on mobile; use the wheel, buttons or double-click to zoom, then drag, on wider screens. Incomplete streamed diagrams remain source; unchanged diagrams are reused as text continues. iOS also fixes navigation of the diagram preview subframe, so update both the gateway and iOS app.
- **Slow-link loading and Windows size:** content-versioned static assets use browser caching and conditional requests on repeat visits. The HTML shell still avoids caching because it contains a per-page security nonce. Windows packages retain supported Electron locales only.
- **Connections:** parse DeepSeek Harness YAML settings folded across lines; show native Retry and Back to computers actions when the iOS gateway or tunnel is unreachable. Account queries resume when the desktop tab becomes visible, with narrower request scope.
- **Mobile controls:** hide the native More menu over open dialogs and refine list and dialog focus appearance. When the keyboard covers an answer-card input, bring it into view once without repeatedly moving it during typing.

Install over the existing app to retain saved computers, pairings and gateway data. Android keeps its signing identity; iOS keeps its official bundle IDs and requires your own signing. Refresh Web pages after the gateway update. iOS recovery and Mermaid subframe changes require the matching app; shared-relay deployments should update the relay.

**Contributors:** [@wangzheuser](https://github.com/wangzheuser) submitted [PR #51](https://github.com/try2love/codex-mobile-bridge/pull/51), retaining original commit credit for [@w154594742](https://github.com/w154594742); [@RigerWu](https://github.com/RigerWu) contributed iOS recovery in [PR #52](https://github.com/try2love/codex-mobile-bridge/pull/52); the integrated part of [@heiqiu47](https://github.com/heiqiu47)'s [PR #40](https://github.com/try2love/codex-mobile-bridge/pull/40) is limited to account-query lifecycle improvements; and [@tiancai123123](https://github.com/tiancai123123) reported the static-download issue in [Issue #54](https://github.com/try2love/codex-mobile-bridge/issues/54) and contributed caching in [PR #56](https://github.com/try2love/codex-mobile-bridge/pull/56).

[@jasongzy](https://github.com/jasongzy) requested general Webhook notifications in [Issue #60](https://github.com/try2love/codex-mobile-bridge/issues/60).

---

## v2.1.2 · 터미널 상호 작용 및 플랫폼 간 호환성

v2.1.2 휴대폰 개선에 집중 Web 터미널 경험을 통해 직접 입력, 중국어 입력, 터치 스크롤링, 글꼴 크기 조정 및 연결 끊김 복구가 더욱 원활하고 완벽해졌습니다. Windows 터미널 구성요소 설치 및 마우스 상호작용 지원。

### 새로운 추가 및 최적화

- **터미널 직접 입력**：모바일 및 와이드스크린 Web 기본값은 터미널에 직접 입력하고 선택사항으로 남겨두는 것입니다.“쓰기 및 전송 모드”；키보드 각성, 입력 초점, 중국어 조합 입력 및 커서 표시 개선。
- **Enter 및 Tab**：독립 추가 Enter 단말기 확인 버튼 CLI 메뉴 및 명령 직접 모드 Tab 현재에 맡겨라 shell 또는 CLI，쓰기 모드는 공개 접두사 완성 및 후보 선택을 지원하며 중국어 및 공백 경로와 호환됩니다.。
- **터치 및 마우스 상호 작용**：개선하다 OpenCode 클래스 터미널 CLI 터치 스크롤, 일반적인 터미널 기록 스크롤 유지; 스크롤하는 대신 위쪽 및 아래쪽 화살표 키를 사용하지 않도록 프로그램 기반 마우스 상호 작용 지원。
- **보다 일관된 터미널 연결**：지속적인 양방향 전송은 연속적인 요청과 대기열 대기를 줄입니다. 아직 유효한 세션은 일시적인 연결 해제 후 자동으로 복원됩니다. 대기 시간이 긴 네트워크에서 추가 대기 시간을 줄입니다. 원격 에코는 여전히 실제 네트워크 지연의 영향을 받습니다.。
- **독립 터미널 글꼴 크기**：플러스 및 마이너스 버튼을 사용하여 6–24px 조정하면 현재 기기의 단말기가 이 설정을 공유합니다.；shell 터미널 본체에 더 많은 공간을 확보하기 위해 경로를 아래쪽으로 이동했습니다.。
- **읽기 설정**：테마와 언어는 설정 상단에 배치되며, 텍스트 크기 범위는 10–32px，코드 글꼴 크기는 다음과 같이 확장됩니다. 8–28px。

### Bug 수리하다

- 모바일 단말기에서 키보드 호출 후 입력이 잘못된 문제, 쓰기 모드에서 텍스트 클릭 시 입력 포커스가 잘못된 문제를 수정하였습니다.。
- 중국어, 영어, 굵은 글씨 및 정사각형 문자가 혼합되어 있고 작은 글꼴 크기가 겹칠 때 격자 정렬이 잘못되는 문제를 수정했습니다. CLI 열 배경 테두리가 고르지 않습니다.。
- 터미널 종료 대화식 수정 CLI、키보드를 접거나 크기를 조정한 후 콘텐츠가 하단 버튼과 오른쪽 스크롤 막대를 덮습니다.。
- 일부 환경에서 단말기가 사용되지 않는 문제 수정 UTF-8 이로 인해 중국어 디스플레이가 비정상적이며, 단말기에 다시 진입하려면 수동 재접속이 필요합니다.。
- 수리하다 Windows 10 체계 ConPTY 마우스 신호가 손실되었습니다. 공식적인 Windows 설치 패키지와 ZIP 완전한 운반 ConPTY 구성 요소, 수동으로 파일을 추가하거나 시스템 구성 요소를 교체할 필요가 없음。
- 수리하다 Windows 설치 프로그램에서 일부 터미널 구성 요소의 압축 해제 호환성 문제가 누락되었습니다.。

### 치받이

데스크톱과 모바일 App 다음과 같이 통일 **2.1.2**，Android/iOS 빌드 번호 **34**。설치를 덮어쓰고 원래 데이터 디렉터리를 유지합니다. 먼저 구성을 제거하거나 지우지 마십시오.；Android 원본 서명 유지，iOS 공식 앱 ID를 유지하면서도 자체 서명 ID를 사용하여 설치해야 합니다. 게이트웨이가 업그레이드되면 브라우저가 새로 고쳐집니다. 휴대폰을 추천합니다 App 완전한 터미널 경험을 위한 업데이트 동기화。

릴리스 패키지 적용 범위 macOS Apple Silicon / Intel、Windows x64、실험적 Linux x64 / ARM64、Android，그리고 직접 서명해야 하는 사람들 iOS IPA/소스코드 패키지。Windows 가방 안에 ConPTY 시스템 구성 요소를 교체하지 않음；Linux 수동으로 업그레이드하려면 설치 패키지를 사용하십시오. 사용 `SHA256SUMS.txt` 다운로드 확인。

### English

v2.1.2 focuses on mobile and Web terminals: direct input, Chinese composition, touch scrolling, font sizing and reconnection, together with complete Windows terminal components and mouse interaction support.

#### Features and improvements

- **Direct terminal input:** enabled by default on mobile and wide-screen Web, with optional Compose & send mode. Improve keyboard activation, focus, Chinese composition and cursor visibility.
- **Enter and Tab:** a dedicated Enter button confirms commands and CLI menus. Direct mode forwards Tab to the current shell or CLI; compose mode supports common-prefix completion and candidate selection, including paths with Chinese characters or spaces.
- **Touch and mouse interaction:** improve touch scrolling in terminal CLIs such as OpenCode while retaining normal terminal scrollback. Forward supported mouse interaction without substituting history-navigation arrow keys for scrolling.
- **Smoother connections:** persistent duplex transport reduces request and queueing overhead; reconnect automatically to valid sessions after temporary disconnections. Remote echo still depends on actual network latency.
- **Independent terminal size:** use minus/plus controls from 6–24px, shared across terminals on the current device. Move the shell label to the footer to free content space.
- **Reading settings:** place theme and language first; expand text size to 10–32px and code size to 8–28px.

#### Fixes

- Fix mobile keyboards opening without delivering terminal input, and ineffective terminal focus in compose mode.
- Correct cell alignment for Chinese, Latin, bold and block characters, overlapping small fonts and uneven CLI sidebar backgrounds.
- Keep terminal output inside its viewport after exiting an interactive CLI, resizing or showing/hiding the keyboard, without covering controls or the scrollbar.
- Correct UTF-8 terminal locale selection and automatic reconnection when returning to a terminal.
- Fix lost mouse signals in Windows 10 system ConPTY. Official Windows installers and ZIPs contain all required ConPTY files, without manual copying or system-component replacement.
- Fix installer extraction compatibility that omitted some Windows terminal components.

#### Updating

Desktop and mobile version **2.1.2**, Android/iOS build **34**. Install over the existing app and retain its data directory. Android keeps the existing signing identity; iOS retains the official bundle IDs and requires your own signing. Refresh Web pages after updating the gateway, and update the mobile app for the complete terminal experience.

Packages cover Apple Silicon/Intel macOS, Windows x64, experimental Linux x64/ARM64, Android and self-signed iOS. Bundled ConPTY does not replace Windows system components. Linux uses manual package upgrades. Verify downloads with `SHA256SUMS.txt`.

---

## v2.1.1 · 모델 및 계정 경험, 초안 저장 및 파일 위치

v2.1.1 개선하다 Codex、Claude 및 DeepSeek Harness 계정 및 모델 운영, 반복 로딩 감소, 휴대폰 및 Web 초안 저장, 파일 위치 지정 및 탐색 경험。

### 새로운 추가 및 최적화

- **통합 계정 및 모델 인터페이스**：세 클라이언트는 동일한 계정 카드와 모델 선택 레이아웃을 사용합니다. 당좌카드 하단에서 확인 가능“사용 가능한 모델 보기”、사용량 업데이트 시간 및 새로 고침 모델 목록에는 마지막으로 성공한 업데이트 시간이 별도로 표시됩니다.。
- **모델 디렉터리 캐시**：캐시를 먼저 표시합니다. 수동 새로 고침, 액세스 전환 또는 게이트웨이 작동 중 매번 12 매시간 업데이트됩니다. 컴퓨터, 클라이언트, 계정 및 유효한 액세스 구성별로 격리합니다. 실패할 경우 원래 디렉터리를 유지하고 실패 시간을 업데이트 성공 시간으로 간주하지 않습니다.。
- **API 및 CLI 모델 쿼리**：검증 가능한 환경 변수 액세스를 완료하고 SSH CLI 업스트림 또는 기본 런타임에서 제공하는 특정 모델과 사고 강도를 유지하는 업스트림 디렉터리。Claude 더 이상 계정 모델 쿼리에 먼저 연결할 필요가 없습니다. Desktop；지원되지 않는 기능은 모델링이나 추론 옵션이 없는 이유와 함께 설명됩니다.。
- **보내지 않은 초안 보관**：휴대폰과 Web 채팅, 클라이언트 또는 컴퓨터를 전환한 후 해당 입력 초안을 복원하십시오. 게이트웨이, 계정, 세션별로 분리하고 전송 확인 후 삭제하세요.。
- **더 빠르게 파일 찾기**：채팅 링크에서 파일이나 폴더를 찾을 때 대상으로 부드럽게 스크롤하고 강조 표시 3 초; 사용자 스크롤을 통해 자동 위치 지정이 중단될 수 있습니다. 채팅 목록으로 바로 돌아가려면 왼쪽 상단으로 돌아가세요. 계층적 탐색을 계속 유지하려면 파일 영역 및 시스템의 상위 디렉터리로 돌아갑니다.。
- **도구 스크린샷**：도구에서 반환된 스크린샷을 보고 디스플레이 설정을 통해 미리보기를 제어할 수 있습니다. 미리보기 크기 및 캐시 사용량 제한。
- **업데이트 및 바인딩 선택**：게이트웨이 및 휴대폰 App 현재 버전의 자동 알림을 건너뛸 수 있으며, 수동 확인을 통해 업데이트할 수도 있습니다. 게이트웨이 비밀번호를 수정할 때 여전히 유효한 휴대폰 바인딩을 유지하도록 선택할 수 있습니다.。

### Bug 수리하다

- 수리하다 Windows 계정이 전환되거나 복원되면 구성 파일이 일시적으로 사용되어 작업이 중단됩니다. 계속해서 사용 중인 경우에도 오류가 보고되고 원본 파일은 유지됩니다.。

- 수리하다 Codex 현재 계정 모델 목록이 오랫동안 읽기 상태로 유지됩니다.、Claude 모델 설정에 대한 반복 요청 및 계정 전환 후 기존 모델이 새 연결을 덮어쓰는 문제。
- 계정 패널의 불필요한 고주파 새로 고침을 줄이고, 스크롤 시 모델 목록이 자동으로 상위로 돌아가는 문제 수정。
- 신속하게 수리하세요 Codex 슬라이드 DeepSeek Harness 뒤로 끌려갔다 Claude；Claude/DSH 목록을 다시 입력하여 캐시를 먼저 표시한 다음 최신 콘텐츠를 동기화하세요. 필터 상자 스타일을 통일하다。
- 이미지가 아닌 첨부 파일에 대한 고정된 표시 및 상황별 정보、ChatGPT 사용자 정의 게이트웨이를 통해 로그인이 라우팅될 때 ID가 보존되고 워크벤치 시작 리소스 동시성이 제한됩니다.。
- 수리하다 iOS 시작 또는 복구 중에 보류 중인 점프 손실을 방지하기 위한 장면 수명 주기 및 알림 점프 재시도。
- 모델 디렉터리 캐시 ID 격리를 강화하고 게이트웨이가 업스트림 모델 디렉터리를 직접 쿼리할 때 환경 자격 증명의 오용을 수정합니다.。

### 기부자

- [@qybgh](https://github.com/qybgh) — [PR #38](https://github.com/try2love/codex-mobile-bridge/pull/38)：이미지가 아닌 첨부 표시 및 컨텍스트 수정。
- [@heiqiu47](https://github.com/heiqiu47) — 양자 [PR #40](https://github.com/try2love/codex-mobile-bridge/pull/40) 계정 카드, 모델 선택 및 모델 디렉토리 호환성이 개선되어 현재 다중 클라이언트 인터페이스에 맞게 조정되었습니다. 재설정 예측 기능은 포함되어 있지 않습니다。
- [@Lovest20018](https://github.com/Lovest20018) — [PR #42](https://github.com/try2love/codex-mobile-bridge/pull/42) 시작 리소스 동시성 제어 및 [PR #43](https://github.com/try2love/codex-mobile-bridge/pull/43) 의 ChatGPT 라우팅 ID 복구。
- [@RigerWu](https://github.com/RigerWu) — [PR #44](https://github.com/try2love/codex-mobile-bridge/pull/44)：도구 스크린샷 미리보기, 디스플레이 제어 및 캐시 제한 iOS 장면 수명주기 및 알림 점프 개선。

### 치받이

게이트웨이 및 휴대폰 App 모두는 **2.1.1**，Android/iOS 빌드 번호 **33**。지원하다 macOS Apple Silicon / Intel、Windows x64、실험적 Linux x64 / ARM64、Android，그리고 직접 서명해야 하는 사람들 iOS IPA/소스코드 패키지。Linux 의 Claude 접근 및 사용 Claude Code CLI；Claude Desktop 자동 연결 지원 macOS / Windows。

설치를 덮어쓰고 원래 데이터 디렉터리를 유지하여 먼저 데이터를 제거하거나 지우는 것을 방지하세요.；Android 원본 서명 유지，iOS 동일한 서명 ID를 사용하십시오. Bundle ID。게이트웨이가 업그레이드된 후 브라우저가 새로 고쳐지고 공유 릴레이 배포가 업데이트 서비스를 동기화합니다. 사용 `SHA256SUMS.txt` 다운로드 확인。

### English

v2.1.1 improves account and model controls across Codex, Claude and DeepSeek Harness, reduces repeated loading, and preserves drafts while making files easier to locate on mobile and Web.

#### Features and improvements

- **Consistent accounts and models:** matching account cards and model pickers across clients. The current account footer contains available models, quota update time and refresh; model catalogs show their own last successful update time.
- **Cached model catalogs:** show cached results first, update on manual refresh or access changes, and refresh every 12 hours while the gateway runs. Keep computers, clients, accounts and effective access configurations separate; retain the last successful catalog after a failed refresh.
- **API and CLI discovery:** query upstream catalogs for verifiable environment-based access and SSH CLI, preserving model IDs and reasoning options supplied by the upstream or native runtime. Claude account catalogs no longer require Desktop to be connected. Unsupported capabilities are explained rather than guessed.
- **Saved drafts:** restore unsent text when switching chats, clients or computers, scoped to gateway, account and conversation. Clear drafts after confirmed sends.
- **File location and navigation:** smoothly reveal a linked file or folder and highlight it for three seconds; user scrolling can interrupt. The top-left Back button returns directly to the chat list; folder-parent controls and system Back retain hierarchical navigation.
- **Tool screenshots:** display tool-returned screenshots with preview controls and bounded preview/cache sizes.
- **Update and pairing choices:** skip automatic reminders for an exact release on desktop and mobile while retaining manual updates. Choose whether valid phone bindings survive a gateway password change.

#### Fixes

- Retry brief Windows file-sharing conflicts during account changes or recovery; persistent failures still report an error and preserve the original file.

- Fix stuck Codex account model loading, repeated Claude model requests and stale catalog responses after switching access.
- Remove unnecessary frequent account refreshes and preserve model-list scroll position.
- Prevent fast client swipes from jumping back to Claude; restore cached Claude/DSH lists before background updates and unify filter styles.
- Fix non-image attachment visibility/context and ChatGPT identity behind custom gateway routing; bound workspace startup resource concurrency.
- Handle iOS scene lifecycle and retry pending notification navigation during startup or resume.
- Strengthen model cache identity isolation and fix gateway environment credentials being used for direct upstream model-catalog HTTP requests.

#### Contributors

- [@qybgh](https://github.com/qybgh), [#38](https://github.com/try2love/codex-mobile-bridge/pull/38): non-image attachment visibility and context.
- [@heiqiu47](https://github.com/heiqiu47), selected work from [#40](https://github.com/try2love/codex-mobile-bridge/pull/40): account cards, model selection and catalog compatibility, adapted to the current multi-client UI. Reset predictions are not included.
- [@Lovest20018](https://github.com/Lovest20018), [#42](https://github.com/try2love/codex-mobile-bridge/pull/42) and [#43](https://github.com/try2love/codex-mobile-bridge/pull/43): bounded startup resource loading and ChatGPT routing identity.
- [@RigerWu](https://github.com/RigerWu), [#44](https://github.com/try2love/codex-mobile-bridge/pull/44): tool screenshots, display controls, bounded caches, iOS scenes and pending notification navigation.

#### Updating

Desktop and mobile version **2.1.1**, Android/iOS build **33**. Packages cover Apple Silicon/Intel macOS, Windows x64, experimental Linux x64/ARM64, Android and self-signed iOS. Linux uses Claude Code CLI; automatic Claude Desktop connection supports macOS and Windows.

Install over the existing app and retain its data directory. Android keeps its signing identity; iOS requires the same signing identity and Bundle ID to retain data. Reload Web pages and update shared-relay deployments. Verify downloads with `SHA256SUMS.txt`.

---

## v2.1.0 · CLI 액세스, 파일 읽기 및 연결 경험

v2.1.0 할 것이다 Codex CLI 및 Claude Code CLI 모바일 및 웹 워크벤치 통합 및 기존 워크벤치 개선 HTTPS 포털, 파일 읽기 및 다중 클라이언트 연결. 합격해주셔서 감사합니다 Issues 경험에 대한 피드백。

### 새로운 기능

- **Codex CLI 대화**：네이티브 또는 SSH 이미 채팅이 켜져 있습니다. 원래 터미널을 닫은 후 명시적으로 클릭할 수 있습니다.“대화 계속하기”다시 덮다. 알려진 프로젝트 디렉터리에서 새 채팅 생성, 후속 응답 읽기, 기본 런타임에서 제공하는 범위 내에서 모델 및 추론 강도 운영을 지원합니다.、Skill、권한, 계획 모드, 승인 및 Goal。
- **Claude Code CLI 대화**：이 기계에서 또는 SSH 기록 읽기, 비공개 채팅 복원, 기존 프로젝트에서 새 채팅 생성, 모델 및 권한 사용、Skill、업로드, 승인 및 중단. 각 세션은 실행 구성 및 작업 디렉터리를 상속하며 다른 터미널에서 아직 실행 중인 파일을 인계받지 않습니다. Claude 프로세스。
- **독립적인 CLI 계정 구성**：Codex 및 Claude 별도 관리 CLI 액세스, 모델 쿼리 및 연결성 확인 데스크톱 계정 전환은 로컬 컴퓨터를 동기화하도록 선택할 수 있습니다. CLI，결과를 별도로 표시합니다.。SSH 원격 구성 유지。
- **이미 HTTPS 입구**：기존 침투 또는 역방향 프록시에 액세스할 수 있습니다. HTTPS 사용자 정의 포트를 포함한 루트 주소 고정 항목 감지 및 구성 지침을 제공합니다. 세부정보 보기[구성 지침](https://github.com/try2love/codex-mobile-bridge/blob/v2.1.0/docs/external-tunnel.md)。
- **파일 읽기**：소스 코드 강조 표시, 줄 번호, 복사 및 줄 바꿈；PDF 지속적인 슬라이딩, 확대/축소, 텍스트 선택 및 전체 화면; 독립된 HTML 격리된 미리보기 및 소스 코드 전환。

### 경험 최적화

- Codex 목록은 로컬 컴퓨터별로 구성되며 각 컴퓨터는 SSH 호스트는 점진적으로 표시되며 느린 호스트는 읽은 채팅을 차단하지 않습니다. 실패한 호스트는 기존 목록을 유지합니다.。Claude Desktop 및 CLI 혼합 목록은 실제 시간을 기준으로 정렬되며 날짜 위에 소스 레이블이 계속 표시됩니다. 클라이언트가 전환하고 슬라이드할 때 목록과 라벨 레이아웃이 더 안정적입니다.。
- iOS Safari 원본 페이지 레이아웃을 유지하고 입력 중 큰 공백 영역과 스크롤 떨림을 수정합니다. 팝업창은 외부 배경을 클릭하여 닫을 수 있습니다.。
- Claude 초기화는 커밋 확인 후 더 일찍 연결 진행 상황을 표시합니다.；Windows 및 macOS 의 Console 초기화로 불필요한 대기 시간이 줄어듭니다.。Claude 할당량은 수동 쿼리로 변경되며, 마지막으로 성공한 결과와 시간이 유지됩니다.。
- SSH 연결 진단은 요약을 복사하거나 둔감화 보고서를 내보낼 수 있습니다. 단계별로 파일 디렉터리로 돌아가서 먼저 전체 화면에서 종료하세요.，PDF 탭 전환 후에도 읽기 위치를 유지합니다. 모든 클라이언트가 비활성화된 후에도 게이트웨이를 독립적으로 시작하고 관리할 수 있습니다.。

### Bug 수리하다

- 수리하다 Windows 다음을 사용한 연속 터미널 하위 프로세스 출력 Ctrl+C，확장 경로에 프로젝트 작업 디렉터리 유지；CMD 디스크 간 전환에 대한 완전한 지침이 제공됩니다. `cd /d` 예。
- 현재를 고치다 DeepSeek Harness 다양한 개행 형식으로 호스트 레코드 인식 결정된 Claude Desktop 최초 일반 종료에 대한 세션 소유권 판단 Windows 초기화 중 오류 핸드오버, 재접속 및 초기화 중 요청 상태。
- 수리하다 Claude Desktop / CLI 혼합 날짜 정렬 및 Claude Code CLI 복원 시 합성 모델 이름이 실제 모델을 덮어씁니다. 이전 버전이 종료되었습니다 Claude Code 작성자는 종료를 확인한 후 재개할 수 있으며, 식별되지 않은 프로세스는 보호된 상태로 유지됩니다.。
- 수정하다 HTTPS 항목 감지 후에도 오래된 오류가 남아 있으며 이를 줄입니다. PDF 빠르게 스크롤하거나 확대/축소할 때 깜박임。

### 업그레이드 지침

공급 macOS Apple Silicon / Intel、Windows x64、실험적 Linux x64 / ARM64、Android APK、iOS 서명되지 않은 IPA 및 소스 코드 패키지. 권장 게이트웨이 및 휴대폰 App 함께 업데이트하세요. 브라우저 사용자는 게이트웨이를 업데이트한 후 페이지를 새로 고치고 공유 릴레이 배포도 동시에 릴레이 서비스를 업데이트해야 합니다.。Android 컴퓨터 목록과 바인딩을 유지하려면 설치를 덮어쓰십시오. 먼저 제거하지 마십시오.；iOS 유지하려면 자신을 서명하고 동일한 서명 ID로 설치를 덮어써야 합니다. App 데이터. 사용 가능 `SHA256SUMS.txt` 다운로드 확인。

CLI 실행 종료에는 해당 네이티브 프로그램이 설치 및 구성되어 있어야 합니다.。Linux 지원하다 Claude Code CLI，Claude Desktop 자동 연결은 여전히 ​​다음만 지원합니다. macOS / Windows。PDF 온라인 미리보기 제한 **20 MiB**，또한 일반 클릭 다운로드 제한도 적용됩니다. 소스코드는 동일합니다 HTML 미리보기 지원 **512 KiB 이내에 UTF-8 텍스트**。HTML 미리보기는 자체 포함된 파일을 위한 것이며 외부 네트워크 또는 게이트웨이 로그인 정보에 액세스하지 않습니다.。

### English

v2.1.0 brings Codex CLI and Claude Code CLI chats to mobile and Web, together with existing HTTPS entry support, file reading, and more reliable multi-client connections.

#### Features

- **Codex CLI chats:** discover and read local or SSH history, explicitly resume after the original terminal closes, and create chats in known project folders. Supported native runtimes provide model/effort, Skills, permissions, plan mode, approvals and Goals.
- **Claude Code CLI chats:** read history, resume closed chats, create chats in known local or SSH projects, and use available models, permissions, Skills, uploads, approvals and interrupt. The execution host retains its configuration and working directory; live writers in other terminals are not taken over.
- **Separate CLI account settings:** manage Codex and Claude CLI access independently, query available models, test connectivity, and optionally sync a desktop account switch to the local CLI with separate results. SSH hosts retain their own settings.
- **Existing HTTPS tunnels and proxies:** add a managed HTTPS root URL, including a custom port, and check the fixed entry. See the [setup guide](https://github.com/try2love/codex-mobile-bridge/blob/v2.1.0/docs/external-tunnel.md).
- **File reading:** highlighted source with line numbers, copy and wrapping; continuous PDF scrolling, zoom, text selection and fullscreen; isolated preview and source mode for self-contained HTML.

#### Improvements

- Render Codex chat rows progressively as local and SSH hosts respond. Sort mixed Claude Desktop/CLI chats by actual recency and keep source labels visible above dates. Stabilize badges and the client-swipe layout.
- Preserve the original iOS Safari layout and fix large blank areas and scroll jitter while typing. Dismiss dialogs by tapping their backdrop.
- Show Claude connection progress after verified initialization submission and avoid redundant Console waits on Windows and macOS. Query Claude quota on demand while retaining the last successful result.
- Add copy/export SSH diagnostics, preserve file and PDF reading position, and keep the gateway manageable when every client integration is disabled.

#### Fixes

- Restore Windows continuous-terminal child output and Ctrl+C, preserve project cwd for extended local paths, and document a complete `cd /d` drive-switch example.
- Recognize the current DeepSeek Harness host across LF/CRLF records. Correct Claude Desktop quit ownership checks, first-time Windows initialization handoff, and request state during reconnect and initialization.
- Correct mixed Claude Desktop/CLI date sorting and prevent a synthetic model name from replacing the real Claude CLI model on resume. Resume legacy Claude writers only after their exit is confirmed.
- Clear stale fixed-HTTPS check errors and reduce flashes during rapid PDF navigation and zoom.

#### Updating

Packages cover Apple Silicon/Intel macOS, Windows x64, experimental Linux x64/ARM64, Android APK, unsigned iOS IPA and source. Update the gateway and mobile apps together; reload browser pages and update shared-relay deployments. Install Android over the existing app to retain saved computers and pairing. Sign and install iOS with the same signing identity to retain app data. Verify downloads with `SHA256SUMS.txt`.

The execution host needs its native CLI installed and configured. Linux supports Claude Code CLI; Claude Desktop automatic connection remains limited to macOS and Windows. PDF previews are capped at **20 MiB** and the ordinary-download limit; source/HTML previews accept **UTF-8 text up to 512 KiB**. HTML previews are self-contained and cannot access external networks or gateway sign-in data.

---

## v2.1.0-preview.1 · CLI 액세스, 기존 HTTPS 입학 및 독서 경험

이것은 v2.1.0 첫 번째 미리보기 버전을 경험하고 통과해 보세요. [Issues](https://github.com/try2love/codex-mobile-bridge/issues) 피드백 질문 및 제안. 안정 버전은 그대로 유지됩니다 v2.0.3。

### 새로운 기능

- **Codex CLI 대화**：휴대폰으로 Web 기존 검색 및 읽기 CLI 채팅은 원래 단말기를 닫은 후에도 클릭이 가능합니다.“대화 계속하기”회복; 기존 로컬 또는 SSH 새 프로젝트 디렉토리 CLI 채팅. 단말기의 후속 응답은 연속적이고 동기적으로 읽을 수 있으며 각 회신은 원본 기록에 따라 모델을 표시합니다.。
- **CLI 작업 완료**：Codex CLI 지원 모델 및 추론 강도、Skill、평범한/예약 모드, 권한 전환, 승인 및 중단 호환 가능한 네이티브 및 SSH 네이티브 CLI 지원하다 Goal 생성, 일시중지, 수정, 재개 및 닫기。
- **Claude Code 이 기계와 SSH 연결**：기록 읽기, 닫힌 세션 복구, 새 채팅, 메시지 보내기, 모델 및 권한 전환 지원、Skill、파일 업로드, 승인 및 중단은 실행 종료의 구성 및 작업 디렉터리를 따릅니다.。
- **독립적인 CLI 계정 구성**：Codex 및 Claude 각 계정 관리에서 구성 CLI，의존하지 않고 업스트림 모델 쿼리 및 연결 테스트를 지원합니다. Cockpit Tools。데스크톱 계정 전환은 선택 사항입니다.“동시에 이 기계에 적용하십시오 CLI”，효과적인 결과를 별도로 표시；SSH 각 서버의 자체 구성 유지。
- **침투가 있었네요 / 역방향 프록시 입구**：기존 채우기 HTTPS 루트 주소에 액세스할 수 있으며 사용자 정의 포트가 지원됩니다. 네트워크 연결 방식을 기본으로 확장하고, 고정된 출입구 감지 및 보다 명확한 구성 안내를 제공합니다. 세부정보 보기[구성 지침](https://github.com/try2love/codex-mobile-bridge/blob/v2.1.0-preview.1/docs/external-tunnel.md)。
- **파일 읽기**：소스 코드에 강조 표시, 줄 번호, 복사 및 자동 줄 바꿈 추가；PDF 연속 슬라이딩, 두 손가락 확대/축소, 텍스트 선택 및 전체 화면을 지원합니다. 컴퓨터에는 페이지 넘김 및 확대/축소 버튼이 유지됩니다. 독립된 HTML 인라인 상호 작용, 애니메이션을 미리 보고 소스 코드를 전환할 수 있습니다.。

### 경험 최적화

- 날짜 위에 유형 라벨이 있는 실제 세션 유형을 기반으로 필터를 표시합니다. 정렬됨 Codex 및 Claude 목록 높이，Claude 세부정보를 위해 클릭 가능한 링을 상황에 맞게 사용。
- 클라이언트 상태는 백그라운드에서 업데이트되고 기존 목록은 유지됩니다.；CLI 초안을 보관하고 Skill 선택하다。
- 설정에서 사용 가능“SSH 연결 진단”，요약 복사 및 둔감화 보고서 내보내기를 지원합니다. 윗부분은 똑같음 SSH 결함이 닫힐 수 있음。
- Claude 할당량이 마지막으로 성공한 쿼리 시간을 표시하는 활성 클릭 쿼리로 변경됩니다. 쿼리가 실패하면 원래 결과가 유지됩니다.。
- 파일 설명은 다운로드, 복사 및 전체 화면 작업과 나란히 표시됩니다. 디렉터리로 돌아가려면 먼저 이전 레벨로 돌아가고, 전체 화면으로 돌아가려면 먼저 미리보기를 종료하세요.。PDF 탭 및 전체 화면 전환 시 읽기 위치 유지。

### Bug 수리하다

- 수리하다 Windows Codex 저장 기록, 콜드 복구 및 종료된 이전 버전에서 긴 경로 인식 문제 Claude Code 세션이 잘못 판단되고 점유되는 문제; 개선됨 Windows UTF-8 함께 읽기 Linux 프로세스 식별。
- 수리하다 CLI 유효한 연결이 끊어지는 백그라운드 읽기 짧은 시간 초과 문제가 개선되었습니다. Goal 실행 후 연결 복구。
- 수정하다 HTTPS 포털이 성공적으로 감지된 후에도 마지막 오류가 계속 표시되는 문제; 포털을 전환하면 이전 결과가 지워집니다.。
- 줄이다 PDF 교체가 완료될 때까지 렌더링된 이미지를 유지하면서 인접 페이지를 빠르게 넘기고, 확대/축소하고, 검토할 때 검은색 화면이 나타나고 깜박입니다.。

### 설치 및 사용

이번에 제공한 macOS Apple Silicon / Intel、Windows x64、Linux x64 / ARM64、Android APK、iOS 서명되지 않은 IPA 및 소스 코드 패키지. 권장 게이트웨이 및 휴대폰 App 함께 업데이트하세요. 브라우저 사용자는 게이트웨이를 업데이트한 후 페이지를 새로 고칩니다. 공유 릴레이 배포도 동시에 릴레이 서비스를 업데이트해야 합니다.。Android 데이터 보존을 위해 설치 덮어쓰기，iOS 스스로 서명해야합니다. 다운로드 가능 `SHA256SUMS.txt` 확인하다。

CLI 실행 터미널에는 해당 기본 프로그램이 설치 및 구성되어 있어야 합니다. 다른 터미널에서 아직 실행 중인 프로그램을 인계받지는 않습니다. Claude 대화。PDF 온라인 미리보기 제한은 다음과 같습니다. **20 MiB**，동시에 현재 일반 클릭 다운로드 제한이 적용됩니다. 소스코드는 동일합니다 HTML 미리보기 지원 **512 KiB 이내에 UTF-8 텍스트**，더 큰 파일을 다운로드하고 열 수 있습니다.。HTML 미리보기는 자체 포함된 파일을 위한 것이며 외부 네트워크 및 게이트웨이 로그인 정보를 노출하지 않습니다.。

### English

This is the first v2.1.0 preview. Try the new features and share feedback through [Issues](https://github.com/try2love/codex-mobile-bridge/issues). v2.0.3 remains the stable release.

#### New features

- **Codex CLI chats:** discover and read saved CLI chats on mobile and Web, resume after the original terminal closes, and create chats in known local or SSH project folders. Follow later terminal-written replies and show each reply's recorded model.
- **CLI controls:** model/effort, Skills, default/plan modes, permissions, approvals and interrupt. Compatible local and SSH native Codex CLI runtimes support creating, pausing, editing, resuming and clearing Goals.
- **Local and SSH Claude Code:** read history, resume closed chats, create chats, send messages, select models and permissions, use Skills, upload files, handle approvals and interrupt, preserving the execution environment's configuration and directory.
- **Separate CLI account settings:** configure Codex and Claude independently, list upstream models and test connectivity without Cockpit Tools. Desktop account changes can optionally apply to local CLI, with separate results; SSH hosts keep their own configuration.
- **Existing tunnels / reverse proxies:** enter an existing HTTPS root URL, including a custom port. Connection options open by default, with fixed-entry checks and clearer guidance. See the [setup guide](https://github.com/try2love/codex-mobile-bridge/blob/v2.1.0-preview.1/docs/external-tunnel.md).
- **File reading:** syntax highlighting, line numbers, copying and wrapping for source; continuous scrolling, pinch zoom, text selection and fullscreen for PDFs, with page/zoom buttons on desktop; inline interactions and source view for self-contained HTML.

#### Improvements

- Show chat-type filters and labels above dates when relevant; align Codex/Claude lists and use a tappable context ring for Claude.
- Refresh client status in the background while retaining the list; preserve CLI drafts and selected Skills across brief disconnects.
- Add **SSH diagnostics** with copy/export and dismissible recurring SSH errors.
- Query Claude quota on demand, displaying the last successful query time and retaining results if a refresh fails.
- Place file actions beside the description, navigate Back through parent folders, exit fullscreen first and retain PDF reading position across tabs and fullscreen.

#### Fixes

- Fix Windows Codex extended paths in saved history and cold resume, and false occupied-state detection for exited legacy Claude Code sessions; improve Windows UTF-8 reading and Linux process identification.
- Retain valid CLI connections across brief history-read timeouts, including after Goal execution.
- Replace stale fixed-HTTPS errors after successful checks and clear old results when the entry changes.
- Reduce PDF flashes during rapid navigation and zoom by retaining rendered pages until replacements are ready.

#### Installation and usage

Packages cover Apple Silicon/Intel macOS, Windows x64, Linux x64/ARM64, Android APK, unsigned iOS IPA and iOS source. Update the gateway and mobile apps together; browser users reload after updating the gateway. Update shared-relay deployments as well. Install Android over the existing app to retain data; iOS requires your own signing. Verify downloads with `SHA256SUMS.txt`.

The execution host needs its native CLI installed and configured. Live Claude chats in another terminal are not taken over. PDF previews are capped at **20 MiB** and the ordinary-download limit; source/HTML previews accept **UTF-8 text up to 512 KiB**. Download larger files to open elsewhere. HTML previews are self-contained, without external network access or access to gateway sign-in data.

---

## v2.0.3 · 휴대폰 업데이트, 타사 알림 및 인터페이스 최적화

- **Android 인앱 업데이트**：새 버전을 확인하고 업데이트 지침을 확인하세요. App 기간 내 다운로드 APK 시스템 설치자에게 넘겨졌습니다. 설치 전 크기 합계 확인 SHA-256；다운로드 완료 후 나가셔도 App 설치 권한 부여 또는 다시 열기 App，계속해서 설치하거나 저장할 수도 있습니다. APK。
- **자신만의 업데이트 다운로드 방법을 선택하세요**：”모바일 다운로드” 또는 ”컴퓨터 다운로드”를 선택할 수 있습니다. 휴대폰에서는 문의가 불가능합니다 GitHub 현재 로그인된 게이트웨이를 통해 쿼리할 수 있습니다. 다운로드할 컴퓨터를 선택한 후 컴퓨터는 이를 다운로드하고 확인한 다음 설치를 위해 휴대폰으로 전송합니다. 다운로드가 실패하면 방법을 다시 선택하거나 통과할 수 있습니다.「GitHub ↗」브라우저에서 해당 항목을 다운로드하십시오. APK，사용자가 선택한 다운로드 방법을 자동으로 대체하지 않습니다.。
- **휴대폰과 Web 타사 알림 구성**：설정 또는 채팅 목록에서 ”제3자 알림”으로 이동하여 선택하세요. **Bark（iPhone）、ntfy（Android）또는 PushPlus（WeChat）**，별도로 구성, 저장 및 테스트하십시오. 컴퓨터 게이트웨이와 구성을 공유하고 알림 점프 주소, 제목 표시 및 게이트웨이 입구 알림을 수정할 수도 있습니다. 이 구성 항목은 게이트웨이에 직접 연결하는 데 사용되며 공유 릴레이는 원래 권한을 유지합니다.。
- **검색 및 필터링이 더욱 컴팩트해졌습니다.**：검색창은 항상 표시되며 ’검색’이 표시됩니다. / Search」；각 선택 상자에는 현재 내용에 따라 너비가 할당되고 나머지 공간은 검색용으로 예약됩니다. 휴대폰 가로, 태블릿, 펼쳐진 병풍을 개선하기 위한 유선형 영어 버튼 Claude、Codex、DSH 목록 레이아웃。
- **채팅 목록은 방해 요소를 줄여줍니다.**：Claude 및 DSH 수동 풀다운 새로 고침, 검색 유지, 필터링 및 읽기 위치를 지원합니다. 영구 읽기 및 연결 성공 프롬프트를 제거하고, 성공적인 복구 후 만료 오류를 지우며, 연결 실패에 대한 설명과 재시도 항목을 계속 제공합니다. 새로 고침 실패 메시지가 지속되는 문제를 수정했습니다.。
- **설정 및 작업대가 더 명확해졌습니다.**：맨 아래 App 중국어와 영어로 된 좁은 화면 디스플레이를 고려하여 아이콘 스위치, 애플리케이션 관리 및 타사 알림 포털이 병치되어 있습니다. 파일 전송 및 저장 버튼은 목적을 명확하게 설명하고 설정이 열리지 않을 때 ”로그인하세요” 프롬프트가 남는 문제를 해결합니다. 불필요하게 분할 화면을 종료하지 않으려면 현재 도구 탭을 닫을 때 사용 가능한 탭으로 전환하세요.。
- **휴대폰 연결 복구**：Android/iOS 여전히 유효한 스캔 코드 바인딩 자격 증명을 안전하게 저장，WebView 로그인 상태를 분실한 경우 복원을 시도하십시오. 게이트웨이 비밀번호를 저장하지 마십시오. 로그아웃, 컴퓨터 제거 또는 바인딩 취소 후에는 복원되지 않습니다. 게이트웨이 로그인 세션 격리 개선、Claude 초기화된 연결에 대한 재연결 항목 macOS Claude 초기화 기간 Console 입력 검증 및 연결 효율성。

### 감사의 말

고마워하는 [@SevenPwZ（des1re）](https://github.com/SevenPwZ) 에서 [PR #32](https://github.com/try2love/codex-mobile-bridge/pull/32) 기부금 Android 인앱 업데이트. 이러한 기여를 바탕으로 이 버전은 컴퓨터 지원 다운로드, 다운로드 방법 선택 및 설치 복구 최적화를 통합합니다.。

### 업그레이드 지침

컴퓨터 게이트웨이를 다음에 연결하는 것이 좋습니다. Android/iOS App 함께 업데이트하세요 v2.0.3，전체 알림 구성, 바인딩 복구 및 업데이트 개선 사항을 활용합니다. 웹 사용자는 게이트웨이를 업데이트한 후 페이지를 다시 로드할 수 있습니다. 오래된 Android 첫 번째 버전 업그레이드를 다운로드할 수 있습니다. APK 설치를 덮어쓰고 먼저 제거하지 마십시오. 후속 업데이트에서는 새 버전의 인앱 업데이트를 사용할 수 있습니다. 컴퓨터 지원 다운로드에는 지원 게이트웨이가 필요하며 컴퓨터는 계속해서 이에 액세스할 수 있어야 합니다. GitHub；휴대폰 업데이트만 하면 휴대폰 직접 다운로드를 계속해서 이용하실 수 있습니다.。iOS IPA 그래도 직접 서명해야 하며 별도로 첨부해야 합니다. Xcode 소스코드 패키지；Linux 아직 실험적 지원이므로 설치 패키지를 사용하여 수동으로 업그레이드하세요. 공식 다운로드 파일 사용 가능 `SHA256SUMS.txt` 확인하다。

### English

- **Android in-app updates:** check releases, read notes, download the APK and open the system installer. Verify size and SHA-256 before installation. Keep a completed download available for installation or export after granting install permission or reopening the app.
- **Choose the download route:** download on the phone or let the signed-in computer gateway download, verify and transfer the APK. Release lookup can use the gateway if the phone cannot reach GitHub. Failed downloads offer route selection and a browser link to the matching APK; they do not silently switch the chosen route.
- **Third-party notifications on mobile and Web:** open **Push alerts**, select **Bark for iPhone, ntfy for Android or PushPlus for WeChat**, then configure, save and test that channel. Settings are shared with the desktop gateway, including notification links, title visibility and gateway address notifications. Configuration is available through direct gateway connections; shared-relay permissions are unchanged.
- **Compact search and filters:** keep Search visible, size selectors to their selected text and give the remaining width to search. Shorter English labels and consistent list layouts improve landscape phones, tablets and unfolded devices.
- **Quieter chat lists:** add manual pull-to-refresh to Claude and DSH, retain filters and reading position, remove persistent loading/connected messages and clear stale errors after recovery. Connection failures still show actionable messages and retry controls.
- **Clearer settings and workbench behavior:** place app-icon visibility, Apps and Push alerts together with narrow-screen English support. Clarify the file-transfer save action and prevent stale sign-in messages in unopened settings. Closing the active tool tab selects an available tab without unnecessarily leaving split view.
- **Connection recovery:** securely retain valid scanned-device credentials on Android/iOS and try to restore lost WebView sign-in state without storing the gateway password. Sign-out, removal and revocation stop recovery. Improve gateway session isolation, reconnection to initialized Claude sessions and long Console input verification during macOS Claude setup.

Thanks to [@SevenPwZ (des1re)](https://github.com/SevenPwZ) for Android in-app updates in [PR #32](https://github.com/try2love/codex-mobile-bridge/pull/32). This release builds on that contribution with gateway-assisted downloads, explicit download choices and installation recovery improvements.

Update both the gateway and mobile app for all improvements; reload browser pages after the gateway update. Older Android versions can install the APK over the existing app once, then use in-app updates. Computer-assisted downloads require a compatible gateway and computer access to GitHub. The unsigned iOS IPA requires your own signing; Linux remains experimental with manual package upgrades. Verify published downloads with `SHA256SUMS.txt`.

---

## v2.0.2 · 파일 호환성 및 채팅 목록 경험 최적화

- **채팅 목록이 더 일관되게 유지됩니다.**：Codex 목록이 하단 근처로 스크롤되면 자동으로 후속 채팅을 로드하고 영구 제거“더 로드하세요”단추. 풀다운 새로 고침 프롬프트가 더 이상 목록을 압박하지 않고 제스처 따르기 및 리바운드가 더 원활해지며 성공 프롬프트가 더 빨리 철회됩니다. 콘텐츠가 변경되지 않으면 기존 목록 노드와 읽기 위치가 유지됩니다.。
- **Windows 파일 링크가 더 안정적입니다.**：드라이브 문자, 백슬래시와 호환 가능、file URL 긴 경로 접두사; 동일한 파일에 대한 다른 참조는 다운로드 항목을 공유합니다. 기존 작업 공간 라이선스 및 구성 가능한 다운로드 한도를 계속 사용합니다.。
- **휴대폰에서 다운로드 후 바로 열기**：Android 및 iOS 다운로드한 파일은 저장 항목을 유지하면서 시스템에서 지원하는 응용 프로그램을 통해 열 수 있습니다. 현재 페이지에 따라 시스템 영역의 색상이 변경됩니다.。
- **크로스 플랫폼 로그인 자동 시작**：Windows、macOS 그리고 설치됨 Linux 고급 설정에서 데스크탑 패키지를 활성화할 수 있습니다.。Windows/macOS 로그인 후 제어판 축소，macOS 메뉴 표시줄에서 사용 가능하거나 Dock 다시 덮다；Linux 창을 계속 보이도록 유지，AppImage 원본 파일 경로 사용。
- 예약하다 v2.0.1 의 macOS 비정상적인 적용 plist 스캔하여 복구。

고마워하는 [@heiqiu47](https://github.com/heiqiu47) 에서 [PR #24](https://github.com/try2love/codex-mobile-bridge/pull/24) 기여된 파일 호환성, 휴대폰 파일 열기, 시스템 표시줄 및 로그인 자동 시작 개선. 이 버전은 현재 버전을 기반으로 합니다. main 파일 및 인증 경계를 통합하고 플랫폼 간 적응을 확장합니다.。

**치받이**：권장 게이트웨이 및 휴대폰 App 함께 업데이트하세요 v2.0.2，전체 개선 사항을 사용합니다. 채팅 목록 최적화는 게이트웨이에서 제공됩니다. 업그레이드 후 페이지를 다시 로드하면 됩니다.。Android 저장된 컴퓨터와 로그인을 유지하려면 설치를 덮어씁니다.；iOS IPA 그래도 직접 서명해야 하며 별도로 첨부해야 합니다. Xcode 소스코드 패키지。Linux 아직 실험적인 지원이므로 데이터 디렉터리를 유지하고 수동으로 설치하세요. 다운로드 가능한 파일 `SHA256SUMS.txt` 확인하다。

### English

- Load more Codex chats automatically near the bottom, remove the persistent load-more button, and make pull-to-refresh smoother with a shorter success notice. Keep unchanged list nodes and reading position.
- Improve Windows drive paths, backslashes, file URLs and long-path aliases while retaining workspace authorization and configurable download limits.
- Open downloaded files through supported system apps on Android and iOS, retain Save, and match system-area colors to the current page.
- Add opt-in login startup for Windows, macOS and installed Linux desktop packages. Windows/macOS hide the control panel on login; Linux keeps it visible. macOS provides a menu-bar entry, and AppImage startup uses its original file path.
- Retain the v2.0.1 macOS malformed-plist discovery fix.

Thanks to [@heiqiu47](https://github.com/heiqiu47) for [PR #24](https://github.com/try2love/codex-mobile-bridge/pull/24). Update both the gateway and mobile app for all improvements. Install Android over the existing app; the unsigned iOS IPA requires your own signing. Linux remains experimental. Verify downloads with `SHA256SUMS.txt`.

---

## v2.0.1 · 수리하다 macOS 클라이언트 검사가 중단되었습니다.

- 수리하다 macOS 앱을 검사할 때 앱의 `Info.plist` 존재하다 XML 형식이 잘못되어 클라이언트 검색 전체가 중단되고 클라이언트가 자동 액세스를 계속할 수 없게 됩니다.。
- 이러한 비정상적인 응용 프로그램이 발견되면 후보를 건너뛰고 계속해서 다른 클라이언트를 검색하고 게이트웨이 로그에 특정 파일 경로와 해결 이유를 기록하여 쉽게 찾을 수 있습니다.。
- 체하는 macOS 사용자는 컴퓨터 측 게이트웨이를 업데이트하는 것이 좋습니다. 기존 계정, 세션 및 연결 구성을 재설정할 필요가 없습니다.。

## v2.0.0 · 모바일 채팅부터 멀티 클라이언트 원격 워크벤치까지

v2.0.0 할 것이다 v1.4.0 의 Codex 휴대폰 게이트웨이가 확장되었습니다. **Codex、Claude Desktop、DeepSeek Harness 통합 원격 포털**。이 공식 버전은 전체 내용을 요약합니다. v2 미리보기 사이클 작업대, 휴대폰 App、다중 클라이언트, 네트워크 연결 및 플랫폼 적응 개선. 원래 컴퓨터나 상대 컴퓨터에서 작업이 계속됩니다. SSH 서버가 실행 중이고 기존 세션 공급자, 자격 증명 및 작업 디렉터리는 계속 소유됩니다.。

### 3개의 클라이언트, 각각의 세션 및 구성

- **자동 검색 및 액세스**：게이트웨이는 설치된 것을 스캔합니다. Codex、Claude Desktop 및 DeepSeek Harness。게이트웨이를 먼저 시작하지 않고도 설치 및 로그인 상태를 확인하고 액세스를 관리할 수 있습니다. 나중에 클라이언트를 설치한 후 다시 검색할 수 있습니다. 설정된 애플리케이션만 활성화할 수 있으며, 활성화된 애플리케이션은 게이트웨이가 시작된 후에 연결할 수 있습니다.。
- **독립적인 채팅 목록**：애플리케이션별로 채팅을 전환하고, 대화를 생성하면 현재 애플리케이션에 직접 속하게 됩니다.；Claude Code 및 Cowork 그룹화되고 접을 수 있습니다. 웹 페이지와 휴대폰은 세션 상태 식별자, 재연결 포털 및 사용 가능한 기능 프롬프트를 공유합니다.。
- **보호된 시작/중지**：데스크탑、Web 휴대폰에서는 구성된 클라이언트를 관리할 수 있습니다. 정상적으로 종료되기 전에 실행 중인 작업을 확인하고 인증 및 콘텐츠가 전송될 때까지 기다립니다. 작업 상태를 알 수 없는 경우 명확한 복구 지침을 유지합니다. 종료 옵션은 휴대폰 접속만 비활성화, 일반 종료, 이중 확인 후 강제 종료로 구분됩니다.。
- **기존 연결 복원**：개선하다 Claude 연결 해제 및 재연결, 숨겨진 창 복구, 중국어 경로 및 디렉터리 신뢰 프롬프트; 오래된 것을 확인하고 복원하세요 Harness 플러그인 업데이트 및 잔여 인스턴스에 액세스하고 처리합니다. 전송 또는 인증 결과를 알 수 없는 경우 작업이 자동으로 재생되지 않습니다.。

### 채팅 및 프로젝트 워크벤치

- **파일 태그**：이 기계를 찾아보거나 Codex SSH 세션의 프로젝트 파일, 텍스트 미리보기、Markdown 사진과 파일을 업로드하고 채팅 파일 링크와 디렉토리 사이를 찾습니다. 일반적으로 위치 지정 또는 다운로드를 먼저 선택하려면 클릭하세요. 기본 다운로드 임계값은 다음과 같습니다. 20 MiB，게이트웨이에서 사용 가능、Web 또는 휴대폰에서 실시간으로 조정하세요.。
- **대용량 파일 및 디렉터리 다운로드**：파일 목록에서 길게 누르기, 마우스 오른쪽 버튼 클릭 또는 키보드 메뉴를 사용하면 일반 클릭 임계값에 의해 제한되지 않는 파일 및 디렉터리를 명확하게 다운로드할 수 있습니다. 디렉토리는 다음과 같이 패키지됩니다. ZIP。다운로드 부동 창에는 진행률, 속도 및 총량이 표시되며 일시 중지, 계속 및 취소를 지원합니다. 기본 휴대폰은 디스크 다운로드를 사용하며 브라우저는 여전히 사이트 저장 공간과 장치 공간으로 인해 제한됩니다.。
- **이미지 줌**：채팅 사진, 미리 전송된 첨부 파일, 작업 공간 사진을 위한 공유 뷰어입니다. 휴대폰에서는 두 손가락을 사용하여 확대/축소하고 드래그할 수 있습니다. 컴퓨터 스크롤 휠로 확대/축소 및 드래그; 화면에 적응하고 크기를 두 배로 늘리려면 두 번 클릭하여 전환하십시오. 1–8 시간과 회복 적응. 이미지를 닫은 후에도 초안, 읽기 위치, 파일 태그 유지。
- **연속 터미널**：터미널은 작업 디렉터리, 환경 및 상호 작용 상태를 유지하고 여러 줄 명령, 중지, 화면 지우기 및 크기 변경을 지원합니다.。macOS/Linux 사용 PTY，Windows 사용 ConPTY，범위를 완료하고 `cd` 처리; 새로 생성된 터미널을 닫을 때 해당 터미널이 속한 프로세스 트리도 재활용되어 배경 잔여물을 방지합니다.。
- **Git 패널**：변경 사항, 차이점, 커밋 기록 그래프 및 분기를 봅니다. 스테이지, 커밋, 브랜치 전환, 로컬 병합 및 병합 중단이 가능합니다. 작업 공간 검사 및 확인을 유지하고 원격 푸시 또는 기록 재작성을 제공하지 않습니다.。
- **Codex 사이드 채팅 및 하위 에이전트**：워크벤치에서 하위 에이전트의 기록을 보고, 임시 사이드 채팅을 만들고, 모델과 추론을 독립적으로 선택합니다.、Skill、권한 및 첨부 파일 대기열 지원, 보충 작업, 일반/일정 모드는 동일한 게이트웨이에 있는 여러 장치와 동기화됩니다. 사이드 채팅은 종료 후 삭제되거나 게이트웨이가 다시 시작되며 이는 아직 지원되지 않습니다. SSH。
- **와이드스크린 분할 화면**：컴퓨터 브라우저, 태블릿 및 병풍에서는 도구 탭을 오른쪽으로 이동하고 너비를 조정할 수 있습니다. 좁은 화면에서는 탭, 초안 및 읽기 위치를 유지하면서 단일 열을 복원할 수 있습니다.。Claude/DSH 별도의 동의 없이 자체 계약에 따라 도구 기능을 제공합니다. Codex 독점 기능은 모든 클라이언트가 사용할 수 있는 것으로 위장됩니다.。
- **컨텍스트 및 권한**：Codex、Claude Code 및 DSH 업스트림에서 제공하는 상황별 사용법은 권한 근처에 표시됩니다. 사용량, 용량 및 설명을 보려면 클릭하세요. 제공되지 않은 데이터는 알 수 없음으로 표시됩니다. 권한 버튼은 현재 모드를 표시하며 모델 및 추론 옵션은 클라이언트 기능을 기반으로 합니다.。Codex 프로젝트를 선택하지 않고 세션 생성 지원。

### 계정、API、할당량 및 모델

- **클라이언트별로 관리**：데스크탑 게이트웨이 관리 Codex、Claude、DSH 각 저장된 계정 또는 지원됨 API 액세스, 가져오기, 수정, 이름 변경 및 삭제 제공。Web/휴대폰에는 현재 애플리케이션의 계정 정보가 표시되며 저장된 액세스로 전환할 수 있습니다. 자격 증명 추가 및 편집은 여전히 ​​컴퓨터에 남아 있습니다.。
- **현재 액세스가 더 명확해졌습니다.**：현재 계정은 고정되어 표시되며 한도 및 재설정 카드는 계정 옆에 있습니다. 전환하기 전에 작업을 확인하고 필요한 경우 해당 클라이언트를 다시 시작하고 복구 정보를 유지하십시오.。
- **API 자신만의 모델을 사용하세요**：Codex 모델 선택기와 계정 페이지는 현재를 공유합니다. API 업스트림 디렉토리는 활성 새로 고침 및 수동 채우기를 지원합니다. 스위칭 수정 API 아직도 공식 주소나 예전 주소를 사용하고 있어요 GPT 문제 목록, 호환 가능 CC Switch 모델 디렉토리. 모델을 나열할 수 있다고 해서 타사 프로토콜이 반드시 호환된다는 의미는 아닙니다.。
- **제어 가능한 쿼리 속도**：자동으로 조회할 계정 페이지를 입력하세요. 표시되면 5분마다 업데이트됩니다. 수동 쿼리는 즉시 실행되고 시간이 다시 설정됩니다. 마지막으로 성공한 값과 시간이 유지됩니다. 실패하면 알 수 없는 잔액이 0으로 표시되지 않습니다.。
- **공식 신용 한도 및 카드 재설정**：공식 계정 할당량, 복구 시간 및 서비스 반환 가입 기간을 확인하세요. 그것은 무엇이든 저장될 수 있습니다 Codex 공식 계정은 재설정 카드를 사용하므로 먼저 액세스를 전환할 필요가 없습니다. 확인 페이지에서는 계좌번호와 만료시간을 확인하고 5초간 대기한 후 소비하며, 결과를 알 수 없는 경우 원래 요청 ID를 재사용합니다.。
- **클라이언트 기능은 다양함**：Claude 로그인 구성 및 타사 게이트웨이 구성 지원，DSH 당좌계좌 저장 및 공식계좌 관리 지원 API Key 사용 가능한 잔액을 확인하려면 타사 제공업체가 다음을 수행해야 합니다. Harness 구성; 모델, 추론 및 할당량은 클라이언트 측입니다./상류로부터의 실제 수익이 우선합니다.。Codex Fast、카드 재설정 및 Skills 다른 클라이언트의 일반적인 기능으로 확장되지 않습니다.。

### Android、iOS 그리고 모바일 웹페이지

- **여러 컴퓨터에서 로그인 상태를 유지하려면 QR 코드를 스캔하세요.**：App 여러 대의 컴퓨터를 저장하고 이름 바꾸기, 삭제, 최근 방문순 정렬 및 온라인 상태 수동 새로 고침을 지원합니다. 취소 가능한 신뢰할 수 있는 장치 바인딩을 설정하려면 QR 코드를 스캔하세요. 일반 웹 페이지 로그인 만료로 인해 더 이상 전화기에 비밀번호를 반복적으로 입력하지 않아도 됩니다.。
- **더욱 간결해진 채팅 목록**：검색, 정렬 및 보관 입구가 축소되었습니다. 기능 표시줄은 응용 프로그램 전환 표시줄 위에 있습니다. 활성화된 앱이 하나만 있는 경우 토글 바를 숨깁니다. 더 많은 메뉴는 하단 아이콘을 숨깁니다. 왼쪽 및 오른쪽으로 슬라이드하여 앱 전환이 기본적으로 활성화되어 있으며 드래그 미리보기가 포함되어 있으며 비활성화할 수도 있습니다.。
- **컴퓨터 카드에 대한 애플리케이션 알림**：활성화된 애플리케이션의 원래 아이콘이 표시됩니다. 게이트웨이는 사용자 알림에 따라 각 애플리케이션에 대해 읽지 않은 데이터를 선택하고 유지합니다. 아이콘을 클릭하면 애플리케이션 목록에 바로 들어갈 수 있습니다. 목록이 성공적으로 로드되면 읽음으로 표시되고 다른 응용 프로그램과 새로운 도착 알림은 유지됩니다. 읽음은 권한 요청의 승인을 의미하지 않습니다.。
- **알림 권한 및 소스**：처음으로 애플리케이션 알림 권한을 엽니다. 권한을 부여한 후에는 배너와 사운드가 기본적으로 사용되며, 사용자의 이후 선택 사항은 유지됩니다.。Android 큰 아이콘 iOS 이미지 첨부는 소스 애플리케이션을 나타냅니다.；iOS 시스템 작은 아이콘은 여전히 ​​​​에 속합니다 Bridge，한 아이템씩 다른 아이템으로 교체할 수 없습니다. App。
- **기본 상호작용 수정**：수리하다 Android 애플리케이션 아이콘 점프 주소 확인, 추가 메뉴 반복, 입력 줄 바꿈, 클립보드, 첨부 파일 및 복귀 탐색 등의 문제；iOS 및 Android 고유한 기본 코드 스캔, 다운로드 및 시스템 반환 논리를 유지하면서 공유 페이지 호스트 적응。

### 원격 연결 및 게이트웨이 설정

- **결정된 HTTPS · Tailscale**：공식 클라이언트 감지, 수정됨 읽기 `.ts.net` 주소, 공용 네트워크 지원 Funnel 비공개로 Serve，게이트웨이를 통해 연결이 시작되고 중지됩니다.。Funnel 휴대폰을 다운로드할 때 설치가 필요하지 않습니다 Tailscale；Serve 동일한 개인 네트워크 권한이 필요합니다. 최초 로그인, 네트워크 권한 및 Funnel 승인은 공식 인터페이스에서 사용자에 의해 완료됩니다.。
- **자체 서버 + SSH**：일반 사용자 유지 SSH 역방향 전달, 호스트 지문 확인 및 고정 입구 감지. 휴대폰 접속 주소는 비워두시면 서버 공용망을 이용하실 수 있습니다. IP 의 HTTPS 주소가 있지만 서버에는 여전히 하나의 주소가 필요합니다. HTTPS 반세대적이고 IP 신뢰할 수 있는 인증서와 일치합니다. 자동 다운그레이드 없음 HTTP。
- **출입구를 여러 개 유지하세요**：LAN, 내장 Cloudflare 일시적인 HTTPS、결정된 Cloudflare Tunnel、Tailscale、자체 서버 vs. NAS/필요에 따라 구성할 수 있는 역세대가 이미 있습니다. 데스크탑 제거“자체 제작 트렁크 · 내부 베타”초대코드 입력으로 일반 사용자의 설정 부담 경감。
- **네트워크 프롬프트가 더 정확해졌습니다.**：Cloudflare 및 Tailscale 공용 네트워크 전달/릴레이는 해외 노드를 통과할 수 있으며, 중국 본토로의 직접 연결은 느리거나 시간 초과될 수 있습니다. 고정 도메인 이름은 국내 속도를 보장하지 않습니다. 초기 구성 후 실제 Wi-Fi 이동통신망으로 확인。
- **재파티셔닝 설정**：개요, 클라이언트 및 액세스, 네트워크 액세스, 로그인 및 장치, 메시지 알림, 애플리케이션 및 유지 관리는 모두 자체 임무를 수행합니다. 개요 페이지와 클라이언트 페이지 모두 게이트웨이를 시작하고 중지할 수 있습니다. 게이트웨이가 실제로 시작되었지만 인터페이스에 의해 시간 초과되었다고 잘못 보고되는 상황을 수정했습니다. 파일 전송 설정은 독립적으로 저장되며, 비동기 로딩은 더 이상 게이트웨이 구성이 저장되지 않아 시작을 방해한다고 잘못 보고하지 않습니다.。

### 보안, 효율성 및 플랫폼 유지 관리

- **요청 및 파일 경계**：보강 DSH 인증 요청으로 제한 사항을 리디렉션합니다. 압축 해제 후 볼륨 바이패스를 방지하기 위해 릴레이 압축 요청을 제한합니다. 로그인 유지、CSRF、동일 원본 이미지 입력 ​​및 파일 액세스 제어。Windows 완벽한 junction/reparse point、`.git` 대문자와 소문자 Win32 경로 별칭 검사。
- **업무 중복을 줄여라**：동일한 상태 새로 고침 라운드는 프로세스 검색을 공유하고 동일한 읽기 전용 요청이 병합됩니다. 전송, 승인 및 중지는 독립적으로 유지됩니다. 백그라운드에서 터미널 읽기를 일시 중지하고 유지합니다. shell，프론트 데스크로 돌아가서 커서를 눌러 읽기를 완료하세요. 휴대폰에서 증분 커서를 사용하라고 알리고, 검사를 중지하려면 프런트 데스크를 나가세요.。
- **Windows 및 Ubuntu 실제 지점 통합**：흡수하다 Windows 설치 검색, 프로세스 종료, 터미널 및 경로 경계 조정 개량 Ubuntu 런처 식별, 권한 기능 조회 및 사이드 채팅 권한 확인。Linux 아직 실험적인 지원，Claude 자동 연결만 가능 macOS/Windows。
- **더욱 명확한 소스 코드 구조**：공유 서비스, 클라이언트 프로토콜 및 운영 체제 구현은 별도로 분류됩니다. `features`、`clients`、`platforms`；Web 호스트는 넓고 좁은 레이아웃에 독립적입니다.，Android/iOS 각각의 기본 입구를 유지하고 공유 주입 스크립트의 사본을 하나만 보유하십시오. 대상 시스템에 대한 목표 유지 관리를 촉진합니다.。
- **예약하다 v1.4.0 기본 능력**：로그인 보호, 세션 소유권, 기본 Fast、모델/Skill 독립적으로 로드 및 설치됨 Skill 링크, 이미지 경로 정규화, 임시 터널 재시도 및 서명 업데이트 확인은 그대로 유지됩니다.。

### 설치, 업그레이드 및 기능 경계

- **PC**：공급 macOS arm64/x64 DMG 및 ZIP、Windows x64 Setup 및 ZIP，그리고 실험적이다 Ubuntu x64/ARM64 DEB 및 AppImage。macOS 사용 ad-hoc 공증되지 않은 완전한 서명；Windows 게시자 인증서 없이 서명되었습니다. 아니요 Windows ARM64 특별 패키지。
- **게이트웨이 업그레이드**：macOS/Windows 다음에서 이용 가능“업데이트 적용”공식 버전을 확인하거나 이전 게이트웨이를 중지하고 종료한 후 수동으로 설치하세요. 원래 데이터 디렉터리를 유지。Linux 수동 업그레이드. 두 개의 게이트웨이가 동일한 클라이언트 및 데이터 세트를 동시에 작동하도록 허용하지 마십시오.。
- **Android**：오버레이 설치 APK 컴퓨터 목록과 로그인을 유지하려면 먼저 제거하지 마십시오。**iOS IPA 서명되지 않은**，직접 서명해야 합니다. 소스 코드 패키지에는 다음이 포함되어 있습니다. Xcode 엔지니어링, 없음 App Store/TestFlight 분포. 사용 `SHA256SUMS.txt` 다운로드 확인。
- **Claude**：연결 Code/Cowork，일반은 포함되지 않습니다 Chat。연결이 끊어진 후 처음 초기화하거나 다시 초기화하려면 컴퓨터 잠금 해제, 접근성이 필요할 수 있습니다./개발자 모드 및 디렉터리 신뢰 확인 기존 연결은 먼저 백그라운드에서 재사용됩니다. 잠금 화면 상태에서 콜드 부팅을 완료할 것을 약속할 수 없습니다.。Cowork 신뢰할 수 있는 컨텍스트 사용이 제공되지 않으면 알 수 없음을 표시합니다.。
- **알림 및 현재 상태**：일반 휴대폰 패키지는 포그라운드 동기화에 의존하며 백그라운드, 잠금 화면 또는 시스템 종료 후 전달을 보장하지 않습니다. 당신은 사용할 수 있습니다 Bark、ntfy、PushPlus。스마트 아일랜드는 백그라운드에서 마지막 상태를 표시할 수 있습니다. 컴퓨터가 절전 모드이거나 오프라인 상태인 동안에는 원격 작업을 계속할 수 없습니다.。
- **원래의 Codex 고쳐 쓰다**：Bridge 지원되는 채널의 버전을 쿼리하고 기본 업데이트 프로그램을 안내할 수 있습니다./가게; 설치 자격 및 확인은 여전히 ​​원래 앱에서 처리되며 완전한 무인 업그레이드는 보장되지 않습니다. 이 입구는 다음과 관련이 있습니다. Bridge 자동 업데이트 및 독립적。
- 클라이언트 내부 인터페이스는 업스트림 업데이트에 따라 변경될 수 있습니다. 플랫폼 패키징, 시뮬레이션 프로토콜 확인 및 실계좌/모델 실행은 검증 범위가 다릅니다. 장치 전력 소비 측정이 없으며 구체적인 배터리 수명 개선이 주장되지 않습니다.。

### 감사의 말

크로스 플랫폼 실제 장치 테스트, 피드백 및 기여에 참여한 사용자에게 감사드립니다. 예약하다 [@qybgh](https://github.com/qybgh) 에서 [#15](https://github.com/try2love/codex-mobile-bridge/pull/15) 인계 기여 업데이트、[@702165405](https://github.com/702165405) 에서 [#16](https://github.com/try2love/codex-mobile-bridge/pull/16) 모델 카탈로그 호환성 기여 MIT 프로젝트 [coding-mobile](https://github.com/2389859005/coding-mobile) 오른쪽 Claude/Harness 접속 참고자료 관련 라이선스 및 속성은 소스 코드와 함께 유지됩니다.。

---

### English · v2.0.0

v2.0.0 expands the v1.4.0 Codex mobile gateway into **one remote entry for Codex, Claude Desktop and DeepSeek Harness**. It brings the v2 preview workbench, mobile apps, client management, networking and platform improvements into the stable release. Tasks continue on their original computer or SSH host with their session ownership, provider, authentication and working directory preserved.

#### Clients and sessions

- Discover installed clients, inspect login/setup readiness and manage connections before starting the gateway. Rescan after installing a client. Starting the gateway connects enabled, configured applications.
- Keep separate application chat lists; create chats under the selected client. Claude Code and Cowork have collapsible groups. Share activity indicators, reconnect controls and capability-aware messages across Web and mobile.
- Manage configured clients from desktop, Web and mobile. Check running tasks, approvals and queued input before quitting. Distinguish disconnecting mobile access, a normal quit and an explicitly confirmed force quit.
- Improve Claude reconnection, hidden-window recovery, Unicode paths and trust guidance. Verify and restore existing Harness integrations, including plugin updates and stale processes. Never automatically replay an operation whose outcome is unknown.

#### Chat and workbench

- Browse project files, preview text/Markdown/images, upload and locate chat-linked files in their folder. Ordinary downloads use a live configurable threshold, 20 MiB by default; larger links offer location first.
- Explicit long-press/right-click downloads allow files and ZIP folders above that threshold. A floating panel shows progress, speed and size with pause, resume and cancel. Native apps stream to disk; browser downloads remain subject to browser storage and device space.
- Zoom chat images, pending attachments and workspace images with pinch, wheel, drag or double-click. Scale from fit-to-screen to 8× and retain drafts, reading position and tabs when closing.
- Use persistent terminals with interactive shell state, multi-line input and resizing. macOS/Linux use PTY; Windows uses ConPTY with cross-drive `cd` handling; closing a newly created terminal also reaps its owned process tree.
- Review Git changes, diffs, commit graphs and branches; stage, commit, switch and locally merge branches. Dirty-worktree checks remain; remote push and history rewriting are not exposed.
- Codex temporary side chats support independent model/reasoning/Skills/permissions, attachments, queued input and Default/Plan modes. View saved subagent history. Side chats are cleared on end or gateway restart and do not support SSH.
- Move tool tabs into resizable split panes on wide browsers, tablets and unfolded phones. Smaller layouts retain drafts, tabs and reading position. Claude/DSH expose capabilities their protocols actually support, rather than claiming all Codex-specific tools.
- Show upstream context usage beside permissions for Codex, Claude Code and DSH, with a detail popover; unavailable usage remains unknown. Show current permission mode and supported model/reasoning choices. Create a Codex chat without selecting a project.

#### Accounts, models and usage

- Desktop manages each client's saved accounts or supported API connections, including import, editing, renaming and removal. Web/mobile show the selected client's information and can switch saved connections; credential creation/editing stays on desktop.
- Keep the active connection first with quota/reset credits beside the account. Verify tasks before switching, restart the appropriate client when needed and retain recovery information.
- Codex's model picker follows the active API provider. Refresh the upstream catalog or enter models manually; fix stale official API routing and GPT lists after switching, and retain CC Switch catalog compatibility. Listing a model does not prove third-party protocol compatibility.
- Fetch account data on opening, then every five minutes while visible; manual refresh runs immediately and resets the timer. Preserve successful values/timestamps on errors instead of showing unknown balances as zero.
- Use reset credits for any saved Codex official account without switching it active. Review the account/expiry and wait five seconds before confirmation; reuse the operation ID after an uncertain result. Subscription dates and balances reflect available upstream data.
- Claude supports saved login and third-party gateway configurations; DSH supports saved sign-ins, official API keys and queryable balances; arbitrary third-party providers must be configured in Harness. Quota, model and reasoning availability vary. Codex Fast, reset credits and Skills are not advertised as universal client features.

#### Mobile experience and notifications

- Save multiple computers, rename/remove them, sort by recent access and refresh reachability. QR pairing creates a revocable trusted-device binding that outlives ordinary browser login expiry.
- Compact search/sort/archive controls and application navigation. Hide the app bar when only one client is enabled, or collapse it from More. Swipe switching is enabled by default, has a visual drag preview and can be disabled.
- Computer cards show enabled app icons and gateway-maintained unread counts filtered by notification preferences. Open an application's list directly from its icon; acknowledge loaded notifications without clearing other apps, newly arriving events or pending approvals.
- Request notification permission on first launch and default to banners/sound after approval, while retaining user preferences. Android large icons and iOS attachments identify the source app; iOS retains Bridge's system app icon.
- Fix Android app-icon navigation URL validation, duplicate native menus, newlines, clipboard actions, attachments and back navigation. iOS/Android share host adaptation while retaining native scanning, downloads and navigation.

#### Networking and desktop organization

- **Tailscale HTTPS:** discover the official client and fixed `.ts.net` address, select public Funnel or private Serve, and run the entry with the gateway. Public Funnel needs no phone-side Tailscale installation; Serve requires authorized tailnet access. Login, system permissions and first authorization remain with Tailscale.
- **Own server + SSH:** retain ordinary-user reverse forwarding, host-key checks and endpoint verification. A blank phone address may use the server's public IP over HTTPS, provided the server already has HTTPS reverse proxying and a trusted certificate for that IP. No automatic HTTP downgrade.
- Keep LAN, bundled Cloudflare temporary HTTPS, fixed Cloudflare Tunnel, Tailscale, SSH servers and existing NAS/reverse proxies. Remove the invitation-based experimental relay entry from the desktop UI.
- Explain that Cloudflare and Tailscale public relay paths may cross overseas nodes and may be slow or time out in mainland China. A fixed hostname is not a performance guarantee; test actual Wi-Fi and cellular networks.
- Organize the gateway into Overview, Clients and access, Network access, Login and devices, Notifications, and App and maintenance. Both Overview and Clients control gateway start/stop. Fix false startup timeout reporting when the gateway is already reachable. Independently saved transfer settings no longer create a false gateway draft during asynchronous loading and block startup.

#### Security, efficiency and platforms

- Prevent authenticated DSH requests from following redirects; reject compressed relay requests that could bypass body limits. Retain authentication, CSRF, same-origin image and workspace boundaries. Harden Windows junction/reparse, `.git` case and Win32 alias handling.
- Reuse one process inventory per status refresh and merge identical concurrent read-only requests. Writes remain independent. Pause hidden terminal reads while keeping the shell and catch up by cursor on return. Use incremental mobile notification cursors and stop foreground polling in the background.
- Integrate Windows and Ubuntu validation branches covering discovery, shutdown, terminals and path safety; improve Ubuntu launchers and permission capability/confirmation handling. Linux remains experimental; Claude automatic connection supports macOS/Windows only.
- Separate shared business features, client protocols and OS integration, with independent Web host/layout modules and shared mobile injection sources. Preserve v1.4.0's login protection, native Fast, independent model/Skill loading, installed Skill links, image path normalization, tunnel retries and signed-update checks.

#### Downloads, upgrades and limits

- Desktop targets: macOS arm64/x64 DMG/ZIP, Windows x64 Setup/ZIP, experimental Ubuntu x64/ARM64 DEB/AppImage. Mac builds are ad-hoc signed, not notarized; Windows builds have no publisher certificate. No Windows ARM64 package.
- Update Bridge from the macOS/Windows app or stop the old gateway and manually install, retaining the data directory. Linux updates are manual. Avoid simultaneous gateways sharing client state.
- Install Android over the existing app to retain data. **The iOS IPA is unsigned** and needs your own signing; the source ZIP includes the Xcode project. No App Store/TestFlight distribution. Verify downloads with `SHA256SUMS.txt`.
- Claude integrates Code/Cowork, not regular Chat. Cold initialization or recovery may require an unlocked desktop, accessibility/developer permissions and directory trust. Existing connections are reused in the background; cold startup while locked is not guaranteed. Cowork context usage remains unknown where unsupported.
- Standard mobile builds synchronize in the foreground and do not guarantee background/locked/killed-app delivery. Use Bark, ntfy or PushPlus as needed; Live Activities may show the last state. Sleeping/offline computers cannot continue remote interaction.
- Original Codex update checks and handoff to its updater/store are separate from Bridge updates. Native eligibility and installation confirmation still apply; fully unattended Codex upgrades are not promised.
- Internal client APIs can change. Packaging checks, simulated protocol tests and real account/model execution are distinct. No battery-life gains are claimed without device power measurements.

Thanks to contributors and cross-platform testers, including [@qybgh](https://github.com/qybgh) ([#15](https://github.com/try2love/codex-mobile-bridge/pull/15)), [@702165405](https://github.com/702165405) ([#16](https://github.com/try2love/codex-mobile-bridge/pull/16)), and the MIT-licensed [coding-mobile](https://github.com/2389859005/coding-mobile) reference implementation. Attribution and licenses are retained.

---

## v2.0.0-preview.3 · 계정, 모델 및 모바일 환경 개선

- **계정 및 카드 재설정**：정돈하다“계정 및 액세스”레이아웃, 현재 접근 권한이 상단에 표시되며, 새로고침 시 마지막으로 성공한 금액과 업데이트 시간이 유지됩니다. 저장된 각 공식 계정은 먼저 로그인을 전환하거나 다른 계정에 의존하지 않고 수동으로 재설정 카드를 사용할 수 있습니다. Codex 에이전트 사용량 재설정 스위치; 확인 페이지에는 계좌번호와 카드 만료 시간이 표시되며, 5초 후에 사용하고, 결과를 알 수 없는 경우 동일한 요청을 다시 시도하세요.。
- **오래된 모델과의 채팅**：모델 선택기와 계정 페이지는 현재 액세스된 모델 소스를 공유하며 업스트림 목록을 적극적으로 새로 고칠 수 있습니다. 공식 모델의 추론 옵션은 기능에 따라 일치됩니다. 액세스를 전환한 후에도 호환되는 이전 채팅은 계속해서 새 액세스를 사용할 수 있으며, 이는 이전 공급자가 잘못 확인하고 전송하는 문제를 해결합니다. 이번 라운드의 모델과 추론 강도가 답변 옆에 표시됩니다. 기록된 과거 답변이 부족한 경우 추측 태그가 제공되지 않습니다.。
- **더 쉬운 계정 전환**：전환 시 인증 및 액세스 구성만 업데이트되며 이전 채팅은 더 이상 일괄적으로 로드되지 않거나 해당 프로젝트 디렉터리에 액세스됩니다. 게이트웨이 시작 시 문서 디렉터리 감지가 취소됩니다. 파일 트리 열기, 첨부 파일 미리 보기 또는 다운로드와 같은 파일 기능에는 여전히 해당 시스템 권한이 필요할 수 있습니다.。
- **휴대폰 연결 및 액세서리**：컴퓨터 목록은 이름 바꾸기, 연결 제거 및 포털 온라인 상태를 지원합니다. 채팅 상단에서는 저장된 연결 이름과 실제 장치 이름 간에 전환할 수 있습니다. QR코드 스캔 후 로그인 유지율 개선, 휴대폰에서 파일 선택 후 첨부파일명, 미리보기, 업로드 상태가 누락되는 문제 수정，Android 및 iOS 관련 인터페이스 및 기능 동기화。
- **더욱 컴팩트한 인터페이스**：채팅 목록 상단과 하단의 버튼 레이아웃을 조정하고 제목 옆에 계정 페이지 새로 고침 버튼을 배치하세요. 중국어 및 영어 작업 프롬프트, 게이트웨이 기본 언어 및 휴대폰 팝업 창 스타일을 개선합니다. 공유 중계 입구가 일시적으로 숨겨졌습니다.。
- **데스크톱 프로그램 및 업데이트**：데스크톱 프로그램 검사 추가，macOS 직접 작성 지원 `.app` 길。“컴퓨터에서 확인 Codex 고쳐 쓰다”원본 버전을 엽니다. Codex 의“업데이트 확인 / Check for Updates…”메뉴, 후속 점검, 다운로드 및 설치 Codex 자체적으로 처리됩니다. 게이트웨이는 여전히 별도의 업데이트 포털을 사용합니다.。

### 알려진 제한사항

- 구독 날짜 인터페이스가 제한되거나 날짜를 반환하지 못할 수 있습니다. 이때는 미확인으로 표시되며, 이를 기준으로 구독 만료 여부를 판단하지 않습니다. 실제 계정 쿼리는 여전히 업스트림에서 거부됩니다.。
- 알려진 GPT-Load v2.0.0-rc.45 의 Antigravity → Gemini 프로토콜 변환 경로가 반환될 수 있습니다. `422 protocol_conversion_unsupported`；모델을 나열할 수 있다고 해서 해당 모델이 정상적인 대화를 나눌 수 있다는 의미는 아닙니다.。
- 오래된 API 채팅이 다시 공식 액세스로 전환된 후 일부 채팅이 일시적으로 표시되지 않을 수 있습니다. Fast 스위치. 원래의 Codex 실제 종료, 시작 및 업데이트 메뉴、macOS 시스템 권한 팝업 및 실제 휴대폰에는 추가 확인이 필요합니다. 격리 런타임 및 시뮬레이션된 업스트림 테스트는 이러한 시나리오가 테스트되고 통과되었음을 의미하지 않습니다.。

경험해 볼 수 있는 적극적인 선택입니다. **Pre-release**，다음으로 설정되지 않음 Latest，하지 v1.4.0 공식 버전 사용자 푸시。Android 데이터를 보존하려면 설치를 덮어쓰십시오.；**iOS IPA 서명되지 않은**，직접 서명해야 하며 소스 코드 패키지가 제공됩니다. Xcode 엔지니어링, 없음 App Store / TestFlight 분포. 사용 `SHA256SUMS.txt` 다운로드한 파일 확인。

### English

- **Accounts and usage resets:** Improve the Accounts and access layout, keep the active connection first, and retain the last successful usage reading while refreshing. Use reset credits for any saved ChatGPT account without switching sign-in or enabling Codex's agent usage-reset setting. Review the account and credit expiry, wait five seconds to confirm, and retry the same request if its outcome is unknown.
- **Models and existing chats:** The model picker and account panel share the active connection's model source and support refreshing the upstream list. Official models show supported reasoning levels. Compatible existing chats can continue through the new connection after switching, without the stale-provider warning blocking messages. Replies show the model and reasoning level recorded for that turn; missing historical metadata is left unset.
- **Lighter account switching:** Switching updates authentication and connection configuration without loading all old chats or accessing their project folders. Remove the Documents-folder probe at gateway startup. Explicit file browsing and attachment previews or downloads may still require system file permissions.
- **Mobile connections and attachments:** Rename or remove saved computers, see connection availability, and toggle the chat header between the saved name and device name. Improve sign-in persistence after QR pairing and fix missing attachment names, previews and upload status after file selection. Android and iOS share these interface and feature updates.
- **Interface refinements:** Tighten chat-list controls, place account refresh beside the heading, and improve English/Chinese operation messages, default language selection and mobile dialogs. The shared-relay entry is temporarily hidden.
- **Desktop discovery and updates:** Scan for the desktop application and accept macOS `.app` paths directly. “Check for Codex updates on the computer” opens the original Codex app's “Check for Updates…” menu; Codex handles checking, downloading and installation. Gateway updates remain separate.

### Known limitations

- Subscription-date queries may be blocked or return no date. The interface reports an unconfirmed date rather than treating the subscription as expired; real-account queries can still be rejected by the upstream service.
- The Antigravity-to-Gemini conversion path in GPT-Load v2.0.0-rc.45 may return `422 protocol_conversion_unsupported`. A model appearing in the list does not establish that conversation requests work.
- Some former API chats may hide the Fast toggle after switching back to official sign-in. Original Codex app quit/launch and update-menu behavior, macOS permission dialogs and physical mobile devices still need further validation. Isolated runtime and mock-upstream checks do not establish that those scenarios have passed.

This is an opt-in **Pre-release**, not Latest, and is excluded from stable v1.4.0 updates. Install Android over the existing app to retain data. The **iOS IPA is unsigned** and requires your own signing; the source ZIP includes the Xcode project. There is no App Store or TestFlight distribution. Verify downloads with `SHA256SUMS.txt`.

---

## v2.0.0-preview.2 · 업데이트 및 모델 호환성 개선

- 애플리케이션 업데이트 프로세스를 최적화하고 업데이트 중에 멈출 수 있는 문제를 해결하세요.。
- 제3자를 개선하다 API 모델 목록 호환성, 지원 CC Switch 모델 카탈로그。
- 계속 존재하다 Android、iOS 및 Web 인터페이스 및 동작 모드, 3단자 공유 모델 호환성 개선。

### 기여자들에게 감사드립니다

- 고마워하는 [@qybgh](https://github.com/qybgh) 에서 [#15](https://github.com/try2love/codex-mobile-bridge/pull/15) 에서 제공한 업데이트 핸드오버 수정 사항 및 테스트입니다. 이 버전은 업데이트 도우미가 준비되었는지 확인한 후 핸드오버를 수행합니다.。
- 고마워하는 [@702165405](https://github.com/702165405) 에서 [#16](https://github.com/try2love/codex-mobile-bridge/pull/16) 기여된 모델 카탈로그 호환성 개선. 이번에는 공유 패치가 채택되었으며 독립적이고 기본입니다. Android 이 버전에는 클라이언트가 포함되어 있지 않습니다.。

이는 활성 선택 환경의 시험판 버전이며 다음으로 설정되지 않았습니다. Latest；v1.4.0 정식 버전 사용자를 위한 업데이트 채널은 변경되지 않습니다.。Android 설치 덮어쓰기 및 데이터 유지 기능；iOS 서명되지 않은 IPA 여전히 직접 서명해야 하며 소스 코드 패키지가 제공됩니다. Xcode 프로젝트. 사용 SHA256SUMS.txt 다운로드한 파일 확인。

### English

- Improve app update handoff reliability and third-party API model catalog compatibility, including CC Switch.
- Keep the existing Android, iOS and Web experience; all clients share the model catalog improvement.
- Thanks to [@qybgh](https://github.com/qybgh) for the update handoff work in [#15](https://github.com/try2love/codex-mobile-bridge/pull/15), and [@702165405](https://github.com/702165405) for the shared model catalog contribution in [#16](https://github.com/try2love/codex-mobile-bridge/pull/16). The standalone native Android client is not included.

This is an opt-in prerelease, not Latest. Stable v1.4.0 users remain on the stable channel. Install the Android APK over the previous preview; the unsigned iOS IPA requires your own signing.

---

## v2.0.0-preview.1 · 웹 및 모바일 원격 워크벤치

경험해 볼 수 있는 적극적인 선택입니다. **Pre-release**，으로 설정되지 않습니다 Latest，도 아니다 v1.4.0 공식 버전 사용자는 업데이트를 푸시합니다. 공식 버전은 계속 사용할 수 있습니다. 미리보기를 시도하기 전에 이전 게이트웨이를 중지하고 구성 백업을 유지하십시오. 경험 후 공식 버전을 다시 설치할 수 있습니다。

- **작업대 라벨**：채팅 옆에 있는 파일 찾아보기 및 전송, 텍스트 및 이미지 미리보기, 유형별 아이콘 구별, 썸네일 표시 여부 선택。
- **연속 터미널**：디렉토리를 유지하고 shell 상태, 상호 작용 지원, 정지 및 크기 적응 휴대폰은 보내기 전에 여러 줄을 쓸 수 있습니다。
- **Git 패널**：변경 및 커밋 기록 그래프, diff, 스테이징, 커밋, 분기 전환 및 로컬 병합. 현재는 원격 푸시 또는 기록 다시 쓰기를 사용할 수 없습니다.。
- **임시 사이드 채팅**：생성 시 컨텍스트를 상속하고 모델과 사고 수준을 독립적으로 설정、Skill 권한이 있으면 첨부 파일, 대기열 및 보충 작업을 지원합니다. 일반/예약 모드에서는 동일한 게이트웨이에 있는 여러 장치를 동기화할 수 있습니다. 게이트웨이를 종료하거나 다시 시작한 후 지워지면 다음과 같이 표시되지 않습니다. Codex 기본 측면 라벨; 아직 지원되지 않음 SSH 보조 채팅。
- **와이드스크린 분할 화면**：도구 레이블을 오른쪽으로 끌어 두 열의 너비를 조정합니다. 휴대폰 및 좁은 화면은 단일 열을 유지하고 입력 영역은 더 컴팩트합니다.。
- **Android 및 iOS App**：QR 코드를 스캔하여 여러 컴퓨터에 저장하고, 직접 복사하고, 파일을 미리 보고 다운로드하고, 알림을 지우고, 설정에서 새 버전을 확인하세요. 돌아가거나 종료하려면 Android 컴퓨터 목록을 두 번 클릭하세요. 애플리케이션 아이콘 및 항목 Logo 일관된。

### 다운로드 및 업데이트

PC에서 이용 가능 macOS arm64/x64、Windows x64 그리고 실험적이다 Ubuntu x64/ARM64 가방. 이 버전의 게이트웨이를 먼저 설치하세요.，Web 주소, 휴대폰 열기 App QR 코드를 스캔하여 연결하세요. 모바일 단말기는 미리보기 채널을 사용하며, 다운로드나 설치 가이드는 사용자가 적극적으로 확인하고 선택한 후에만 열립니다.。

- **Android APK**：다운로드 후 설치를 덮어씁니다. 저장된 컴퓨터와 로그인 상태를 유지하려면 먼저 제거하지 마십시오. 현지와 함께 preview.10 동일한 서명을 사용하세요.。
- **iOS 서명되지 않은 IPA**：반드시 직접 사용해야 합니다 Apple 계정에 서명한 후 설치하세요. 직접 클릭하여 설치할 수는 없습니다.。`iOS-source.zip` 공급 Xcode 휴대폰에 연결한 후 프로젝트에 서명하고 실행할 수 있습니다. 무료 개발 서명에는 정기적인 재설치가 필요할 수 있습니다. 아직 없음 App Store / TestFlight 풀어 주다。
- **통지하다**：App 전경은 새로운 작업을 상기시켜 줍니다. 백그라운드 또는 잠금 화면에서의 전달은 보장되지 않습니다.。Bark、ntfy、PushPlus 외부 알림 채널로 계속 사용할 수 있습니다. 스마트 아일랜드가 백그라운드에서 이전 상태를 표시할 수 있습니다.。

사용 `SHA256SUMS.txt` 제품 확인。macOS ～을 위한 ad-hoc 서명되었으나 공증되지 않음；Windows 인증서 서명이 없습니다. 미리보기 기능과의 호환성 문제가 여전히 있을 수 있습니다.。

### English

**An opt-in Web and mobile workbench preview.** This pre-release is not Latest and is excluded from stable v1.4.0 update checks.

Open project files, a continuous terminal, Git changes/history/branches, temporary side chats and saved subagent history in tabs. Wide browsers support resizable split panes. Side chats share state across clients and support models, reasoning, Skills, permissions, attachments, queued messages and Default/Plan modes. They are temporary Bridge chats, not native desktop side tabs; ending them or restarting the gateway clears them. SSH side chats are not supported.

Install the preview desktop gateway for the Web workbench. Android and iOS apps save multiple computers, copy directly, preview/download attachments and check for new releases from settings. Android can update by downloading the APK and installing over the existing App. The unsigned iOS IPA requires your own signing; the source ZIP includes the Xcode project. There is no App Store or TestFlight distribution yet.

**Notifications work primarily while the App is active; background/lock-screen delivery is not guaranteed.** Use external Bark, ntfy or PushPlus where needed. Live Activities may show an older state in the background.

Stop the old gateway before trying another build on the same port, and retain a configuration backup. Stable downloads remain available. Verify assets with `SHA256SUMS.txt`.

---

## v1.4.0 · 연결이 더 간단해지고 원격 사용이 더 원활해졌습니다.

- **즉시 사용 가능한 외부 네트워크 연결**：App 내장 cloudflared，일시적인 HTTPS 추가 설치가 필요하지 않습니다. 완벽한 고정 Cloudflare 도메인 이름, 일반 사용자 SSH 및 NAS / 역세대 계획이 있다。
- **더욱 명확한 구성 경험**：각 연결을 접을 수 있으며 해당 온라인 가이드를 직접 열 수 있습니다. 주소창은 자동으로 채워집니다 HTTPS 접두사, 오류 필드의 자동 확장 및 위치 지정, 단기 알림 표시 5 두번째. 저장된 자격 증명은 마스크로 볼 수 있습니다，SSH 개인 키 선택기는 숨겨진 디렉터리를 지원합니다.。
- **더욱 완벽한 로그인 보호**：지원 로그인을 기억하세요 7 요일 및 비밀번호 시도에 대한 팁、IP PC에서 차단 및 차단 해제, 선택적으로 보안 알림 보내기。
- **모델과 Skill 사용하기 더 쉬워졌습니다.**：네이티브 유지 Fast 그리고 맞춤 API 모델 디렉토리, 모델 Skill 독립적인 로딩；Skill 캐싱, 검색 페이징 및 전체 설명을 지원하며 일반 설치된 심볼릭 링크와 호환됩니다.。
- **채팅과 업데이트가 더 안정적입니다.**：사진 미리보기, 임시 터널 재시도 및 업데이트 핸드오버를 개선합니다. 만료된 액세스 기록이 실수로 차단되어 전송되는 문제 수정。App 확인되지 않은 전송 프롬프트와 웹 페이지를 무시할 수 있으며 메시지는 자동으로 재전송되지 않습니다.。
- **더욱 직관적인 튜토리얼**：일시적인 HTTPS 표시“추천하다”，고정 도메인 이름, 서버 및 NAS 표시“고급의”，참조 명령에 적용 가능한 조건에 대한 단계별 그림과 설명을 제공합니다. 서버 관리자 작업은 사용자가 직접 완료합니다.，App 실행되지 않음 sudo。

병합 PR #11，그리고 포함 Preview 테스트 중 호환성 및 환경 수정。

**치받이**：공식 버전에서는 App 의“업데이트 적용”업데이트를 확인하거나, 게이트웨이를 중지하고 먼저 종료한 후 플랫폼에 해당하는 새 패키지를 설치하십시오. 원래 데이터 디렉터리를 유지。Preview 사용자는 공식 버전을 수동으로 설치하고 원본 데이터 디렉토리를 사용하도록 확인해야 합니다. 업데이트 후 모바일 페이지를 다시 로드하세요. 일시적인 HTTPS 재가입으로 인해 주소가 변경될 수 있으니 사전에 출입구 변경 알림을 활성화해 주시기 바랍니다.。

**English**

**v1.4.0 makes remote setup and everyday access easier.** The App bundles cloudflared and provides guided Cloudflare domains, regular-user SSH and NAS/reverse-proxy setups. Connection cards collapse, link directly to online guides, and expand when a field needs attention. Saved credentials remain masked and revealable.

Remember sign-in for seven days, see remaining password attempts, and manage blocked IPs from the desktop. Native Fast and provider-specific model discovery are preserved. Skills load independently with caching, search, pagination, full descriptions and support for installed symlinks. Image previews, tunnel retries and update handoff improve. Stale account records no longer block existing chats; both interfaces can dismiss unconfirmed send records without resending messages.

Includes PR #11 and fixes validated during Preview testing. Update through the stable App or stop the gateway and install manually, retaining the data directory. Preview users should install the stable App manually and select their existing data directory. Reload the phone page after upgrading. Mac packages are ad-hoc signed and not notarized; Windows packages have no certificate signature. Linux remains experimental.

---

## v1.3.3 · 에너지 소비 및 알림 최적화

- **요청 시 세션 모니터링**：실행 중인 세션과 대기 중인 세션을 지속적으로 모니터링하고 종료 후 알림 구독을 취소합니다. 실시간 이벤트와 각 세션을 통해 30 새로운 작업을 발견하고 기록 세션의 반복 읽기를 줄이기 위해 변경 메타데이터를 몇 초 동안 확인합니다.。
- **알림 재시도는 더욱 독립적입니다.**：종료된 세션을 계속 구독하지 않고도 완료 알림 전송에 실패할 경우 재시도 기록을 유지합니다. 세션 재실행, 연결 끊김 복구, 알림 스위치 변경 및 완료 상태가 순차적으로 도착하는 처리를 완료합니다.。
- **에너지 소비 최적화**：상태 쿼리 재사용 프로세스; 창이 숨겨지면 새로 고침이 일시 중지되고 상태가 변경되지 않으면 인터페이스가 다시 그려지지 않습니다.。
- **안정적인 창 제목**：페이지 제목을 반복적으로 덮어쓰는 것을 방지하기 위한 기본 창 제목의 통합 관리 언어를 전환할 때 필요에 따라 업데이트。

Mac / Windows v1.1.0 후속 버전은 다음에서 찾을 수 있습니다.“업데이트 적용”선택하다“업데이트 및 다시 시작”。데이터 디렉터리를 유지하면 로그인, 네트워크 및 알림 설정이 유지됩니다. 일시적으로 HTTPS 원격 업그레이드 전 확인해주세요 v1.3.2 소개“게이트웨이 시작 및 포털 알림”켜져 있고 휴대전화에서 수신할 수 있습니다.。Linux 아직 실험적인 지원이므로 게이트웨이를 중지하고 종료하세요. App 그런 다음 새 버전을 수동으로 설치하십시오.。

공급 Mac Apple Silicon / Intel 의 DMG、ZIP，Windows x64 의 Setup.exe、ZIP，게다가 Ubuntu x64 / ARM64 의 DEB、AppImage。사용 `SHA256SUMS.txt` 다운로드 확인；Mac / Windows 인앱 업데이트는 서명을 사용합니다. `bridge-update.json`。Mac 아직 ad-hoc 서명되었으나 공증되지 않음；Windows 인증서 서명 없음。

---

## English

**v1.3.3 reduces notification monitoring and desktop refresh overhead.**

- Monitor running chats and pending requests, then release notification subscriptions when idle. Live events and a metadata check every 30 seconds discover new activity without repeatedly loading historical chats.
- Retry failed completion alerts independently of subscriptions. Handle resumed chats, reconnection, notification preference changes, and completion updates arriving in separate steps.
- Reuse the desktop status worker, pause refreshes while the window is hidden, and skip unchanged UI renders.
- Keep the native window title stable and update it only when the language changes.

**Upgrade:** Mac / Windows v1.1.0 and later support App updates → Update and restart. Retain the data directory to preserve settings. Before a remote update over temporary HTTPS, enable and test the startup and entry notifications introduced in v1.3.2. Linux remains experimental and requires a manual upgrade after stopping the gateway and quitting the App.

Packages include Mac arm64/x64 DMG and ZIP, Windows x64 installer and ZIP, and Ubuntu x64/ARM64 DEB and AppImage. Verify downloads with `SHA256SUMS.txt`; Mac/Windows in-app updates use the signed manifest. Mac builds are ad-hoc signed, not notarized; Windows builds have no certificate signature.
