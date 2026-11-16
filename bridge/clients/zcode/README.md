# ZCode 데스크톱 액세스

macOS、Windows 및 Linux 게이트웨이 스캔이 설치됨 ZCode 데스크탑 애플리케이션。Windows 및 Linux 기본적으로 원본은 App 그리고 개인 파이프를 생성합니다；Linux 로그인된 그래픽 데스크탑이 필요합니다. 정상적으로 시작하는 동안 게이트웨이나 휴대폰에서 애플리케이션을 관리하고 기기에 저장된 채팅을 볼 수 있습니다. 모바일 액세스를 비활성화한 후에도 PC의 앱과 작업은 계속 실행됩니다. 종료와 강제 종료는 독립적인 작업입니다.；Windows 정상적으로 종료 ZCode 나만의 트레이 메뉴를 대화형 데스크톱에서 사용해 보세요.。

일반 로컬 액세스에서는 디버깅 포트가 시작되지 않습니다. 저장된 채팅은 읽기 전용으로 표시되며 이 채널을 통해 메시지를 보내거나 승인을 처리할 수 없습니다. 연결 후 원본을 사용하세요. App 세션 프로토콜, 프로젝트 디렉터리 및 기본 구독에 대한 제어 권한을 확인하세요. 디스플레이용 설치 버전, 모델 선택、Skill 그리고 원본에 따른 첨부파일 App 이때 제공되는 인터페이스는 오픈되어 있습니다. 저장된 계정을 전환하기 전에 모바일 접속을 비활성화하고 로그아웃하세요. ZCode。

## 레거시 명시적 세션 프로토타입

다음 지침은 개별적으로 구성된 개발 프로토타입에만 적용됩니다. 원래의 App 실행, 모델, 계정 및 작업공간을 담당합니다. 디자인과 증거를 보려면 다음을 참조하세요. [Agent Note](../../../.agents/notes/implemented/feature/2026-10-31-zcode-native-session-prototype.md)。

## 경계 사용

- 전용 네이티브 테스트 채팅만 사용하고 명시적으로 저장하세요. sessionId 그리고 절대적으로 workspace 길; 이 스크립트는 채팅을 생성하지 않습니다。
- 정상적으로 연결만 이루어졌습니다. Launch Services 시작하다, 가져오다 loopback 원래 디버그 포트 App。LAN 또는 공용 네트워크에 대한 디버그 포트를 여는 것은 금지되어 있습니다. 게이트웨이 서비스 포트가 아닙니다。
- 원본으로 App 의 SessionDataLayer Lease는 동일한 세션 프로젝션을 공유하며 데스크탑과 동시에 볼 수 있습니다. 따로는 아니고 subscribe 아니면 구독권을 다시 빼앗아。
- 읽기 전용은 콜드 세션을 자동으로 시작하거나 재개하지 않습니다. 원래의 App/host 이전 바인딩은 세대 변경 후 쓰기를 중지합니다.。
- 새 요청 사용 UUID 새로운 작업을 수행합니다. 시간이 초과되거나 결과를 알 수 없는 경우 영수증만 확인되며 변경할 수 없습니다. UUID 동일한 작업을 다시 보냅니다.。
- 실제 테스트 전에 기본 세션 실행자를 확인해야 합니다. `snapshot.config.model` ～을 위한 `GLM-5.3-Flash`、`snapshot.config.thought` ～을 위한 `low`。단순히 원작을 바탕으로 한 것이 아닌 App 드롭다운 상자 또는 Bridge 표시된 값이 적용됩니다. 둘은 아직 동기화되지 않았을 수 있습니다. 구성이 일치하지 않으면 전송을 중지하고 먼저 동기화한 후 다시 확인하세요. 테스트를 통과했고 소스 코드가 변경되지 않은 경우 무료 크레딧이 다시 소모되지 않습니다.。

## 수동 입장

창고에 `.tmp/zcode-state/binding.json` 제출하지 않고 로컬 구성 저장 Git：

```json
{
  "application": "/Applications/ZCode.app",
  "port": 17742,
  "workspace": "/absolute/path/to/test-project",
  "sessionId": "sess_existing-native-test-session"
}
```

```sh
python3 -B scripts/zcode-prototype.py --state .tmp/zcode-state attach
python3 -B scripts/zcode-prototype.py --state .tmp/zcode-state detail
python3 -B scripts/zcode-prototype.py --state .tmp/zcode-state send < .tmp/send.json
python3 -B scripts/zcode-prototype.py --state .tmp/zcode-state receipt < .tmp/receipt.json
python3 -B scripts/zcode-prototype.py --state .tmp/zcode-state detach
```

`send.json` 포함하다 UUID `id`、`text`，선택 과목 `projectFiles` 프로젝트 내의 상대 파일 경로 목록입니다. 기존 파일 액세스 경계를 ​​재사용하고 파일 프롬프트를 생성하지 않고 기본 첨부 파일 업로드 프로토콜을 통해 제출합니다. 최대 10 파일, 전체 20 MiB。

`stop` 의 JSON ～을 위한 `{ "id": "UUID", "executionId": "현재 control.activeWorks 로고 입력" }`。

`respond` 의 JSON ～을 위한 `{ "id": "UUID", "interactionId": "현재 보류 중인 항목 ID", "answer": { "optionId": "기본 옵션" } }`。객관식 질문은 기본이 될 수 있습니다 `action` / `content` 구조, 권한 항목은 기본적으로 제공되는 옵션만 사용할 수 있습니다.。

`receipt.json` ～을 위한 `{ "commandId": "원래 요청 UUID" }`。확인은 작업을 재생하지 않으며 로컬을 자동으로 덮어쓰지 않습니다. unknown 기록。

`history` 읽기 전용 네이티브에는 이미 런타임이 있습니다.；`detail` 먼저 명시적이어야 합니다. attach，그럼 원문을 읽어보세요 App 동기화된 스냅샷. 어댑터에는 자동 폴링 또는 재연결 타이머가 없습니다. 프로토타입 테스트를 완료하면 먼저 원본을 검증합니다. App 작업을 수행한 후 정상적으로 종료하여 임시 디버깅 포트를 닫습니다. 강제로 죽이지 마세요.。

## 표적 검사

```sh
node --test tests/zcode-prototype.test.mjs
python3 -B -m unittest discover -s tests -p test_zcode_prototype.py -v
python3 -B scripts/check-boundaries.py
```

## Mac Test 모바일 포털

사적인 `desktop-sessions/settings.json` 의 `zcodePrototype` 기존 공유 채팅 페이지 및 인증된 경로를 통해 액세스되고 바인딩이 활성화된 기본 테스트 채팅을 구성합니다. 모델, 계정 및 새 채팅은 여전히 ​​원본에서 생성됩니다. App 관리하다。

Mac Test 확인됨 HTTPS 보내기, 기본 첨부 파일 및 회신, LAN은 동일한 최신 결과를 읽습니다. 좁은 화면 레이아웃은 브라우저 시뮬레이션 검증을 사용합니다. iPhone 실제 기계 수용。Windows/Linux、SSH、모든 콜드 세션 및 App 업데이트 마이그레이션이 아직 검증되지 않았으며, 임시 디버깅 진입을 정식 접근으로 직접 해제할 수는 없습니다. 구체적인 증거와 제한 사항은 다음을 참조하세요. [휴대폰 Test 기록](../../../.agents/notes/implemented/feature/2026-10-31-zcode-mobile-test.md)。
