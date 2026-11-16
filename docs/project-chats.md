# 새 프로젝트 채팅 / Create a project chat

에서 Web 또는 휴대폰의 채팅 목록을 클릭하세요. **새로운**，먼저 실행 환경을 선택한 다음 기존 프로젝트를 선택하거나 **디렉토리 선택**。디렉토리 선택기는 다른 폴더를 열고 확장할 수도 있습니다. **새 폴더 만들기**，선택한 상위 디렉터리에 프로젝트 폴더를 생성합니다. 디렉터리에 이전 채팅이 있었고 초기화되지 않을 필요는 없습니다. Git 또는 기존 파일 덮어쓰기。

실행 중인 환경이 하나만 있는 경우 해당 이름이 직접 표시됩니다. 여러 환경이 있으면 전환할 수 있습니다. 프로젝트 경로에는 기본적으로 마지막 두 수준의 디렉터리가 표시되며, 확장한 후 전체 경로를 볼 수 있습니다. 환경을 변경하면 확인되지 않은 디렉터리 선택이 지워져 다른 컴퓨터나 액세스된 다른 디렉터리를 새 채팅에 가져오는 것을 방지할 수 있습니다.。

| 연결 | 프로젝트 디렉토리의 위치 | 마지막 단계 |
| --- | --- | --- |
| Codex App | 로컬 머신을 선택하거나 등록했습니다. SSH 주인 | 생성 및 열기 |
| Codex CLI | 로컬 머신을 선택하거나 등록했습니다. SSH 주인 | 채팅 만들기 |
| WSL Codex | 배포, 사용자, 구성 디렉터리에 해당하는 환경을 선택합니다. | 채팅 만들기 |
| Claude Desktop Code / Cowork | 현재 Desktop 환경 | 첫 번째 메시지를 작성하고 작성하여 보냅니다. |
| Claude Code CLI | 이 기계는 등록될 수 있습니다 SSH 환경 | 첫 번째 메시지를 작성하고 작성하여 보냅니다. |
| DeepSeek Harness Desktop | 현재 Harness 작업공간이 위치한 컴퓨터 | 생성 및 열기 |

디렉터리를 찾아보고 선택해도 채팅이 생성되거나 메시지가 전송되지 않습니다.。Claude 대화를 만들려면 첫 번째 메시지가 필요하므로 버튼에 명확하게 라벨이 지정되어 있습니다. **작성 및 보내기**；그 외 접속은 먼저 빈 채팅을 생성한 후, 사용자가 입력하여 전송합니다. 제출 후 결과를 확인할 수 없는 경우, 원본 환경을 먼저 확인하신 후 다시 생성하지 마시기 바랍니다.。

Codex App、CLI 및 WSL 채팅 이름은 비워둘 수 있습니다. 이 이름을 입력한 후 사용하고, 이름이 지정되지 않은 원래 상태를 유지하려면 공백으로 남겨두세요. 그러면 원래 클라이언트가 나중에 이름을 지정하게 됩니다. 빈 채팅을 생성하는 것 자체는 모델을 호출하여 이름을 생성하지 않습니다.。

Codex App 및 DSH 프로젝트 채팅은 선택한 디렉터리에 해당하는 기본 프로젝트를 재사용합니다. 로컬 머신 Codex 디렉터리가 등록되지 않은 경우 컴퓨터가 켜집니다. App 빈 새 페이지 App 프로젝트를 등록합니다. 컴퓨터가 디렉토리를 확인해야 하는 경우 먼저 확인을 완료한 다음 돌아가서 다시 시도하십시오. 네이티브 프로젝트가 저장되었는지 확인한 후 채팅을 생성하세요. 등록 결과를 알 수 없는 경우에는 반복 등록이나 생성이 이루어지지 않습니다. 프로젝트 소유권 인터페이스 지원 Codex 새 채팅이 저장된 후 소유권을 확인합니다.，DSH 기본 작업공간 사용 ID 채팅을 만드세요. 이 작업은 기존 채팅을 이동하거나 기존 프로젝트 설정을 덮어쓰지 않습니다.。

Codex 이 시스템의 새 디렉토리에는 다음이 필요합니다. App 지원 디렉토리 등록 항목; 이전 런타임을 계속 사용할 수 있습니다. App 저장된 항목。SSH 먼저 컴퓨터에 새 디렉터리를 만드세요. App 프로젝트로 추가하고 선택 항목으로 돌아갑니다. 기존의 SSH 프로젝트와 Codex CLI 창작에는 이 제한이 적용되지 않습니다.。DSH 새로운 디렉터리를 생성하려면 업데이트된 커넥터와 기본 작업 공간 인터페이스 지원이 필요합니다. Harness；기존 커넥터는 기존 기능을 계속 사용할 수 있습니다. 커넥터를 업그레이드한 후에만 다른 디렉토리를 선택할 수 있는 입구가 표시됩니다.。DSH 독립이 없다 CLI 또는 SSH 액세스 옵션。

Claude Desktop Code 작업공간을 신뢰해야 한다는 메시지가 표시되면 다음을 수행하세요. Claude Desktop Code 페이지에서 선택한 디렉토리를 열고 직접 확인하세요.“신뢰 작업공간”，돌아가서 다시 시도해 보세요. 선택한 디렉토리, 채팅 이름 및 첫 번째 메시지가 유지됩니다. 신뢰는 게이트웨이에 의해 자동으로 부여되지 않습니다. 시간 초과 또는 연결 중단이 발생하는 경우에도 원래 환경을 먼저 확인해야 하며 신뢰 거부에 따라 직접 재시도할 수는 없습니다.。

디렉터리 권한은 원래 실행 환경의 권한을 사용합니다. 생성에 실패하면 사용자, 계정 또는 실행 환경이 자동으로 전환되지 않습니다. 프로젝트를 선택해도 기존 세션이 마이그레이션되거나 원래 프로젝트 구성이 수정되지 않습니다.。

## English

Select **New** in Web or mobile, choose a runtime environment, then select an existing project or **Choose directory**. The directory picker also offers a collapsed **New folder** action. A directory does not need an existing chat. Creating a folder does not initialize Git or overwrite files.

The same picker serves Codex App, local/SSH Codex CLI, WSL Codex, Claude Desktop Code/Cowork, local/SSH Claude Code CLI, and the existing DeepSeek Harness Desktop connection. Paths belong to the selected environment. Changing environments clears an unconfirmed directory selection. Expand the short path summary to see the full path.

Browsing does not create a chat or send a message. Codex App and DSH use **Create and open**; Codex CLI and WSL use **Create chat**. Claude requires an initial message and explicitly uses **Create and send**. An uncertain submission is not replayed automatically. Codex App and DSH reuse the native project for the selected directory. A new local Codex directory opens an empty Desktop creation page so the App can register the project. Complete any folder confirmation on the computer before retrying. The bridge waits for the native project record before creating a chat and does not repeat an unconfirmed registration. Existing chats and project settings are retained. Older runtimes retain the saved-project path. For a new SSH directory, add it as a project in the computer App first; existing SSH projects and Codex CLI creation keep their current behavior. Arbitrary DSH directories require an updated connector and Harness native workspace support. DSH does not offer a separate CLI or SSH connection.

If Claude Desktop Code requires workspace trust, open the selected folder in Desktop Code, explicitly approve trust, and return to retry. The selected folder, chat title and first message remain in the dialog. The bridge never grants trust automatically. A timeout or disconnect remains an uncertain submission: inspect the original environment before retrying.

Creation uses the original environment's permissions and account. Existing chats, project settings and connections are not migrated.
