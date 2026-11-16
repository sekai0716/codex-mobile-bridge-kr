# WSL 계정 및 액세스 / WSL accounts and access

## 중국어

**실험적 기능**：현재는 안전하게 식별하고 전달할 수 있는 구성만 지원되며 모든 계정, 공급자 또는 서비스 제공자에 대해 보장되지는 않습니다. CLI 버전 호환 가능. 실제 다중 계정에 대한 전체 프로세스 검증이 완료되지 않았습니다. 구성 저장, 전환 및 모델 목록은 업스트림 인증 또는 실제 작업 검증을 통과했음을 의미하지 않습니다.。

Windows 이 기계와 WSL ～에 Codex、Claude Code 다양한 계정을 사용할 수 있으며 API。동일한 자격 증명을 수동으로 입력하더라도 여전히 독립적으로 구성되며 자동으로 동기화되지 않습니다. 각 WSL 디스트로、Linux 사용자 및 구성 디렉터리는 별도로 관리됩니다.；Codex 및 Claude Code 별도로 관리도 해준다。

첫 번째 **애플리케이션 관리** 서신 등록 및 활성화 WSL 입구, 다시 열다 **계정 관리**，이것을 선택하세요 WSL 환경. 보기가 중지된 배포를 시작하지 않거나 CLI，모델이 호출되지도 않습니다.。

- **게이트웨이 데스크탑, 로그인됨 Web 및 모바일 단말기**：다음에 추가 API 액세스, 미사용 액세스 편집, 이름 바꾸기, 미사용 액세스 삭제, 현재 기본 액세스 저장. 이 컴퓨터에 저장된 유사한 파일을 선택할 수도 있습니다. API，선택한 항목으로 명시적 가져오기 WSL。가져오기만 하면 저장되며 전환하려면 추가 확인이 필요합니다. 로컬 계정은 변경되지 않습니다. 사용 중인 액세스에 대해서는 이름 바꾸기만 허용됩니다. 주소나 키를 수정하기 전에 다른 액세스로 전환하세요.。
- **비밀번호 없이 접근 가능**：환경과 모델을 볼 수만 있고 계정을 추가, 가져오기, 수정, 삭제 또는 전환할 수는 없습니다. 키를 작성한 후에는 계정 목록에 반환되지 않습니다.。
- **공식 로그인**：원본에서는 WSL CLI 마치다. 게이트웨이가 복사되지 않습니다. Desktop 공식 로그인 또는 시스템 키체인. 지원되는 파일 구성은 다음과 같이 저장할 수 있습니다.“원래의 WSL 로그인”，나중에 복원。

전환에는 개별 확인이 필요하며 선택 항목에 대한 즉시 확인이 필요합니다. WSL 구성된 작업, 승인 및 작업 기록입니다. 대기열에 있거나 실행 중이거나 결과가 확인되지 않은 작업으로 인해 전환이 불가능합니다. 게이트웨이는 큐를 지우거나 메시지를 다시 보내지 않습니다.。Claude Code 이 게이트웨이에서 생성된 유휴 실행자만 정상적으로 해제됩니다. 다른 단말기에서 아직 이 구성을 사용하고 있다면 먼저 종료해 주시기 바랍니다.。Codex 주소와 자격 증명을 다시 로드하려면 공유 서비스가 모두 유휴 상태가 된 후 정상적으로 다시 시작해야 합니다. 원래 터미널 연결을 다시 연결해야 할 수도 있습니다. 상태를 확인할 수 없거나 프로세스 ID가 일치하지 않거나 일반 종료 시간이 초과되면 스위치가 중지되고 프로세스가 강제로 종료되지 않습니다. 구성 전환이 완료되었다고 해서 완료되는 것은 아닙니다. API 자격 증명은 업스트림에서 인증되었으며 실제 액세스는 기본 로그인 또는 실제 요청 결과에 따라 달라집니다.。

원본 구성 스냅샷은 첫 번째 전환 중에 저장되며, 복구 중에 원본 파일 콘텐츠가 복원됩니다. 원래 구성이 나중에 다른 도구에 의해 수정되면 게이트웨이는 덮어쓰기를 중지하고 처리를 위해 원래 도구를 사용하라는 메시지를 표시합니다.。Magpie、조직 관리, 시스템 자격 증명, 복잡성 profile、사용자 정의 인증 경로 및 공유 디렉터리와 같이 보안 전환을 지원하지 않는 구성은 여전히 ​​원래 도구로 관리됩니다.。

**전환 후 기존 채팅 계속하기**：기준 Codex Responses API 액세스는 현재를 유지합니다 provider ID, 업데이트 주소 및 키 쌍; 이 ID를 사용하는 기존 채팅은 여전히 ​​원래 세션을 사용합니다. ID、공유 서비스를 다시 시작하고 내역과 디렉터리를 확인한 후에는 새 채팅을 생성하지 않고도 공유 서비스에서 새 액세스를 계속 사용할 수 있습니다. 다른 provider 식별 내역은 자동으로 마이그레이션되지 않습니다. 여러 공급자 간에 인증, 환경 변수 또는 추가 인증 구성을 공유하면 여전히 전환이 방지됩니다. 이전 채팅 모델은 자동으로 변경되지 않습니다. 새로운 API 지원하지 않는 모델의 경우, 채팅 모델 설정에서 호환 가능한 모델을 선택해주세요.。Claude Code 표준 API 또한 스위치는 원래 구성 디렉터리와 기록을 유지하며 이 게이트웨이의 다음 명시적 작업은 새 액세스를 다시 로드합니다. 명시적인 전환 후 게이트웨이는 원래 세션 ID를 유지하고 전송되지 않은 초안을 새 계정과 연결합니다. 새 계정의 기존 초안은 덮어쓰여지지 않으며, 확인되지 않은 전송 기록은 마이그레이션되거나 재전송되지 않습니다. 외부 도구를 사용하여 계정을 수정해도 이 초안이 계속 실행되지 않습니다.。

**업스트림 모델 보기**선택 항목 재사용 API 업스트림에서 실제로 보고한 업데이트 시간과 이름 및 추론 강도를 표시하는 캐시입니다. 추론 강도가 반환되지 않을 때 표시됩니다.“업스트림에서 제공되지 않음”。수동으로 새로 고치고 다시 획득합니다. 캐시 사용 후 누르기 12 매시간 백그라운드 업데이트 예약, 중지 또는 종료 WSL 깨어나지 않을 것입니다. 다양한 게이트웨이 및 클라이언트、WSL 환경과 API ID는 모델 캐시를 공유하지 않습니다. 기본 공식 로그인이 있는 모델은 여전히 ​​원본을 전달합니다. CLI 또는 기존 채팅의 모델 설정을 확인하세요。

가져오기 주소는 그대로 유지됩니다.：`localhost`、`127.0.0.1` 및 `::1` 선택 항목을 가리킵니다. WSL 환경에 접근할 수 있다고 가정할 수 없습니다. Windows 서비스。

## English

**Experimental:** only configurations that can be identified and handed off safely are supported. Account/provider/CLI compatibility is not guaranteed. Real multi-account end-to-end validation remains incomplete; saved configurations, successful switches and model lists do not establish upstream authentication or task execution.

Windows and WSL Codex or Claude Code can use different accounts and APIs. Matching credentials do not make their settings shared or synchronized. Each distribution, Linux user, configuration directory and client has its own account selection.

Register and enable the WSL entry in **App management**, then select that environment in **Account management**. Viewing accounts does not start a stopped distribution or CLI, or call a model.

- **Gateway desktop app and authenticated Web/mobile clients:** add API profiles, edit inactive profiles, rename or delete inactive profiles, and save the original native configuration. Explicitly import a saved API from the same local client into the selected WSL environment. Import saves a profile; switching requires a separate confirmation and leaves the Windows account unchanged. An active profile can only be renamed; switch away before editing its endpoint or key.
- **Passwordless access:** view environments and models only. Adding, importing, editing, deleting or switching accounts requires authentication. Saved keys are never returned in the account list.
- **Official sign-in:** complete it in the original WSL CLI. Desktop OAuth credentials and system keyrings are not copied. Supported file-based configurations can be saved and restored as the original WSL sign-in.

Switching requires explicit confirmation and fresh checks of tasks, approvals and operation records for the selected WSL configuration. Running or queued work and unconfirmed results block switching; no queue is cleared or message resent. Claude Code releases only idle executors created by this gateway; exit other terminals using the configuration first. Codex must normally restart its shared service after all work is idle, so that both endpoint and credentials reload. Original terminal connections may need to reconnect. Unverifiable state, changed process identity or a normal-exit timeout stops the switch without a forced kill. A completed configuration change does not verify the credentials with the upstream service; native sign-in or an actual request provides that verification.

The first switch saves an exact original-file snapshot. External edits stop a later overwrite or restore. Magpie, managed settings, system credentials, complex profiles, custom authentication routing and shared directories remain managed by their original tools when safe switching is unavailable.

**Continue existing chats after switching:** a standard Codex Responses API profile keeps the selected provider ID and updates its endpoint and key together. Chats using that provider retain their thread ID, history and directory; continue through the new access profile after the shared service has restarted and been checked, without creating another chat. History tied to other provider IDs is not automatically migrated. Multiple providers sharing authentication, environment overrides or additional authentication settings still block switching. Existing chat models are unchanged; select a compatible model in chat settings if the new API does not support the old one. Standard Claude Code API switching likewise retains its configuration directory and history; the next explicit gateway operation loads the new profile. After an explicit switch, the gateway retains the original session ID and carries its unsent draft into the new account scope. Existing drafts in the destination scope are not overwritten, and unconfirmed sends are neither migrated nor resent. External account changes do not authorize this draft continuation.

**Upstream models** reuses the selected API's cache and shows its update time, model names and reported reasoning levels. Missing levels are shown as “Not reported by upstream.” Manual refresh fetches again. Using a cache schedules a background refresh after 12 hours; it never wakes a stopped or disabled WSL environment. Cache identities are isolated by gateway, client, environment and API profile. Native sign-in models remain available through the original CLI or existing chat model settings.

Imported URLs are unchanged: `localhost`, `127.0.0.1` and `::1` refer to the selected WSL environment, not necessarily a Windows service.
