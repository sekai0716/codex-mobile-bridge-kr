# Webhook 통지하다

Webhook 기존 알림을 다음으로 대체 HTTP POST JSON 구성한 서비스로 전송됩니다. 추가 플러그인을 설치할 필요가 없습니다；Mac、Windows、Linux 게이트웨이는 동일한 구성을 사용합니다.，Web、Android 및 iOS 게이트웨이에 직접 연결됨“제3자 통지 → Webhook”관리하다. 컴퓨터 게이트웨이 입구는“메시지 알림 → Webhook”。이 기능은 다음에서 시작됩니다. v2.1.3 에서 사용 가능。

## 구성 및 테스트

1. 새로운 수신 대상을 생성하고 이름을 지정한 후 완전히 입력하세요. HTTPS 주소, 선택“자동인식”，또는 일반 사용자 정의, Feishu 또는 DingTalk를 선택하세요.、Discord、Telegram。동일한 유형의 여러 로봇을 추가할 수 있습니다. 이전 버전에는 단일 Webhook 구성은 독립형 기본 대상으로 유지됩니다. 서명 또는 주요 쿼리 매개변수는 유지됩니다. 정상 HTTP 로컬 테스트 주소만 허용됩니다.。
2. 에서“고급 설정”예를 들어 서비스 요구 사항에 따라 요청 헤더를 입력합니다. `{"Authorization":"Bearer YOUR_TOKEN"}`。요청 헤더는 다음과 같아야 합니다. JSON 문자열 키-값 객체。
3. 조정 JSON 텍스트 템플릿을 선택하고 구성을 저장한 후 테스트를 클릭합니다. 저장하면 알림이 전송되지 않습니다. 테스트에서는 저장된 구성만 보내고 양식에 저장되지 않은 수정 사항은 사용하지 않습니다.。
4. 서비스 확인 테스트를 받은 후 대상을 개별적으로 활성화하고 저장합니다. 각 목표는 개별적으로 편집, 테스트, 비활성화 또는 삭제할 수 있습니다. 채팅 알림은 계속해서 전역 및 단일 세션 알림 설정으로 제어되며, 게이트웨이 포털 및 보안 알림은 계속해서 해당 스위치를 사용합니다.。

만능인 Webhook 기본 템플릿：

```json
{
  "event": "{{event}}",
  "title": "{{title}}",
  "body": "{{body}}",
  "session_name": "{{session_name}}",
  "url": "{{url}}"
}
```

오직 JSON **문자열 값**～에 `{{필드 이름}}` 중첩된 객체와 배열을 지원하여 대체될 예정입니다. 필드 이름, 표현식 또는 스크립트는 실행되지 않습니다. 중국어, 따옴표 및 개행 문자는 다음과 같이 올바르게 인코딩됩니다. JSON；가장 일반적인 텍스트 64 KiB，Feishu가 가장 많은 텍스트를 가지고 있습니다. 20 KiB，대부분의 템플릿 16 KiB。

## Feishu 로봇 및 서명 검증

Feishuqun에서 맞춤형 로봇을 만들고 추가하세요. Webhook 게이트웨이 주소를 입력하세요. 선택하다“자동인식”이전 구성이 여전히 일반 기본 템플릿을 유지하는 경우 Feishu 텍스트 형식도 자동으로 사용됩니다. 사용자 정의 템플릿은 자동으로 덮어쓰이지 않으며 클릭할 수 있습니다.“선택한 템플릿 사용”바꾸다。

```json
{
  "msg_type": "text",
  "content": {
    "text": "{{title}}\n{{body}}\n{{url}}"
  }
}
```

봇이 활성화된 경우“서명 확인”，게이트웨이에서 동일한 이름의 옵션을 확인하고 로봇이 생성한 서명 키를 입력한 후 저장하고 테스트하세요. 타임스탬프와 서명은 각 전송 시 게이트웨이에 의해 생성되며 템플릿에 기록할 필요가 없습니다. 저장한 후에는 키가 표시되지 않습니다. 공백으로 두고 원래 값을 유지합니다. 수신 대상을 삭제하거나 변경하는 경우에는 다시 채워야 합니다. 서명 스위치를 끄는 것만으로도 나중에 사용할 수 있도록 키가 보존되지만 Feishu 로봇 자체도 서명되지 않은 요청을 허용해야 합니다.。

테스트에서는 Feishu의 비즈니스 반환 코드를 확인합니다. 형식, 서명 또는 시차, 키워드、IP 화이트리스트 및 현재 제한 오류에 대한 해당 프롬프트가 표시됩니다.；HTTP 200 더 이상 직접적으로 성공으로 간주되지 않습니다. Feishu가 수락을 확인한 후 그룹의 알림을 확인하세요. 키워드와 IP 화이트리스트는 여전히 Feishu에 구성되어 있습니다. 템플릿 텍스트에는 사용자가 설정한 키워드가 포함되어야 하며 게이트웨이를 실행하는 컴퓨터는 다음을 준수해야 합니다. IP 화이트리스트 요구 사항. 세부정보 보기[Feishu 맞춤형 로봇 공식 설명](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)。

## 다른 서비스 템플릿 선택

서비스를 선택한 후 기본값을 편집할 수 있습니다. JSON；기존 사용자 정의 텍스트는 유지됩니다.“선택한 템플릿 사용”교체 가능. 확장하다“사용 가능한 필드”자리 표시자와 해당 의미를 볼 수 있습니다. 서비스별로 수신 주소와 필수 내용이 다릅니다.：

| 제공하다 | 수신 주소 | 기본 텍스트 및 설정 |
| --- | --- | --- |
| 보편적인 맞춤화 | 자체 제작 HTTPS 수신 측 | 위와 공통 JSON，수신측 요구 사항에 따라 수정 가능 |
| Feishu | 로봇 생성 `open.feishu.cn` Webhook | `msg_type` 및 `content.text`；선택적 서명 |
| DingTalk | 로봇 생성 `oapi.dingtalk.com/robot/send?access_token=…` | `msgtype` 및 `text.content`；선택적 서명 |
| Discord | 생성된 채널 `discord.com/api/webhooks/…` | `content`，기본적으로 트리거되지 않음 @ 알림; 텍스트가 가장 2000 성격 |
| Telegram | `https://api.telegram.org/bot<token>/sendMessage` | 템플릿 내에서 작성해야 합니다. `chat_id`；`text` 최대 4096 성격 |

DingTalk 서명 키는 전용 서명 필드에 채워집니다. 게이트웨이는 다음을 사용하여 밀리초 타임스탬프를 생성합니다. URL 시그니처 매개변수, Feishu 시그니처는 적용할 수 없습니다.。Discord 전송은 서버 확인을 기다립니다.，Telegram 조사하다 `ok`，딩톡 검사 `errcode`；서비스가 거부되면 성공적인 배송이 표시되지 않습니다.。Telegram 여기서 사용되는 것은 Bot API 전송 인터페이스는 업데이트 수신용이 아닙니다. `setWebhook` 인터페이스。

공식 합의：[DingTalk 전송 인터페이스](https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages)、[딩톡](https://open.dingtalk.com/document/robots/customize-robot-security-settings)、[Discord Webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook)、[Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage)。

| 필드 | 콘텐츠 |
| --- | --- |
| `event` | `task.completed`、`approval.required`、`gateway.started`、`gateway.address_changed`、`security.ip_blocked` 또는 `test`；이미 개설된 계정 알림 사용 `account.*` |
| `event_id` | 수신 측의 중복 제거를 위한 이벤트 식별자입니다. 동일한 이벤트를 재시도할 때 일관성 유지 |
| `title` / `body` | 기존 알림 제목 및 요약에는 전체 채팅 또는 모델 응답이 포함되지 않습니다. |
| `session_name` | 채팅 이름 활성화된 경우에만“세션 이름을 포함합니다.”제공되는 경우 |
| `url` | 채팅 또는 현재 게이트웨이에 해당하는 액세스 링크; 링크가 없으면 비어 있음 |
| `client` / `host` | 이벤트 소스; 해당되지 않는 경우 비어 있음 |
| `count` | 알림 또는 이벤트 수 병합, 문자열로 대체됨 |

## 저장된 구성 및 전달

전체 주소에는 키가 포함될 수 있으므로 정상적으로 표시됩니다.“저장됨”및 서비스 도메인 이름 주소 입력 상자는 숨기기 및 보기를 지원하며, 전체 저장된 주소는 적극적으로 클릭하여 볼 때만 읽을 수 있습니다. 일반 구성 새로 고침은 전체 주소를 반환하지 않으며 요청 헤더와 서명 키는 페이지를 반환하지 않습니다. 주소나 요청 헤더를 비워두면 저장된 값이 유지됩니다. 삭제하려면 해당 지우기 옵션을 사용하세요. 주소를 변경하면 이전 요청 헤더가 지워집니다. 주소 또는 프로토콜 유형을 변경하면 원래 서명 키가 자동으로 사용되지 않으며 다시 입력해야 합니다. 인증 정보는 전용 구성에 넣어주시고, 다시 읽어주는 텍스트 템플릿에는 쓰지 마세요.。

각 Webhook 대상은 기본적으로 꺼져 있으며 기존 알림 전략을 재사용하고 독립적인 중복 제거 기록 및 실패 재시도를 갖습니다. 이전 단일 대상 구성은 마이그레이션할 필요가 없습니다. 새로운 대상은 완료된 채팅 기록을 재발행하지 않습니다. 대상을 비활성화, 삭제 또는 교체하면 해당 대상에 대해 보류 중인 전송 재시도만 취소됩니다. 수동 알림은 채팅을 시작하거나 인계하거나 전환하지 않습니다.。

범용 수신기 HTTP 2xx 이는 요청이 수락되었음을 의미할 뿐입니다. 내장된 서비스는 해당 프로토콜에 따라 성공을 결정합니다. 여전히 다운스트림 영수증을 확인해야 합니다. 수신 측에서 처리한 후에 타임아웃이 발생할 수 있으므로 엄격하게 한 번만 전송된다고 보장할 수 없습니다. 수신측에서는 누를 수 있습니다. `event_id` 무게를 제거하십시오. 요청은 리디렉션을 따르지 않습니다. Feishu 및 DingTalk 이외의 동적 서명 또는 비- JSON 프로토콜은 여전히 ​​자체 적응 서비스를 통해 변환되어야 합니다.。

## English

**Available since v2.1.3:** configure **Push alerts → Webhook** on Web/mobile, or **Notifications → Webhook** in the desktop gateway. Settings are shared across macOS, Windows and Linux; Android/iOS use the gateway's Web interface. Shared-relay configuration permissions are unchanged.

Create and name each destination, then set its HTTPS endpoint, optional JSON string-to-string headers and JSON body template. You can add multiple bots of the same service; an existing single Webhook remains available as the default destination. Save before testing: a test uses saved settings only, and saving does not send anything. Enable each destination after confirming receipt; you can edit, test, disable or delete it independently. Existing global/per-chat, gateway-entry, security and account notification preferences remain in control.

Use `{{event}}`, `{{event_id}}`, `{{title}}`, `{{body}}`, `{{session_name}}`, `{{url}}`, `{{client}}`, `{{host}}` and `{{count}}` inside JSON string values. No scripts, expressions or key substitution are supported. Templates are limited to 16 KiB and rendered bodies to 64 KiB. Chat names require the existing title opt-in; full conversations and model replies are not included.

Saved endpoints stay masked during ordinary configuration reads. Use the address visibility button to retrieve and view the full saved URL explicitly. Headers and signing secrets are never returned to the UI. Blank inputs retain saved values; explicit clear controls remove them. Changing the endpoint clears old headers unless replacements are supplied. Keep credentials out of the readable body template. HTTPS is required except for loopback HTTP tests, and redirects are rejected.

**Feishu bots:** Auto-detect recognizes official Feishu custom-bot endpoints, or select Feishu explicitly. The unchanged generic default becomes the Feishu text format above; custom templates are preserved. Use the selected-template button to replace a custom template explicitly. If the bot requires signature verification, enable it and enter its signing secret in the dedicated field. The gateway generates a fresh timestamp and signature on every attempt. Saved secrets are masked; a blank field preserves the secret for the same target, and changing the endpoint or protocol requires a replacement. Feishu bodies are limited to 20 KiB. Tests validate the business response code and report format, signature/time, keyword, IP-whitelist and rate-limit failures. See the [official guide](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot).

**Other presets:** choose Custom Webhook, DingTalk, Discord or Telegram and edit the supplied JSON. Custom text is preserved until you explicitly apply the selected template. The expandable field reference lists every supported placeholder. DingTalk uses `msgtype`/`text.content` and supports optional signing with its own millisecond timestamp algorithm. Discord uses `content` (up to 2000 characters), disables mentions by default and waits for message confirmation. Telegram uses the Bot API `/bot<token>/sendMessage` endpoint; fill `chat_id` in the template and keep `text` within 4096 characters. DingTalk requires `errcode: 0`; Telegram requires `ok: true`. These are outgoing notification presets, not incoming bot-update subscriptions.

Delivery fans out to enabled destinations and reuses existing policies, with separate deduplication and retries for each destination. It does not activate chats or replay completed history. Disabling, deleting or changing one destination cancels only its pending retries. Generic HTTP 2xx confirms receiver acceptance; presets use service-specific success responses. Confirm downstream receipt and use the stable `event_id` to deduplicate retries after ambiguous timeouts. Dynamic signatures beyond Feishu/DingTalk and non-JSON protocols require a separate adapter.
