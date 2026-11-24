# 메시지 관리 / Message management

채팅“더 → 메시지 관리”보낼 큐와 확인되지 않은 기록을 봅니다. 대기 중인 기록이 있는 경우 입력 영역 위에 포털도 제공됩니다.。Web、Android 및 iOS 동일한 페이지 사용。

- **순서를 조정하세요**：메시지의 왼쪽 핸들을 드래그하거나“위로 이동 / 아래로 이동”。아직 전송되지 않았으며 게이트웨이에 보관된 메시지만 정렬할 수 있습니다. 순서는 게이트웨이에 저장되고 후속 전송은 이 순서대로 수행됩니다.。
- **철회하다**：보류 중인 대기열에서 제거되었습니다. 이미 클라이언트에 전달된 메시지는 이 작업으로 취소할 수 없습니다.。
- **편집하다**：독립적인 편집 영역에서 텍스트를 수정하고 저장 후 원래 대기열 위치와 원본 첨부 파일을 유지합니다. 채팅 입력 상자의 원본 초안, 인용문, 첨부 파일은 변경되지 않습니다. 메시지가 전송되면 수정할 수 없으며 편집된 내용은 그대로 유지됩니다.。
- **확인되지 않은 기록**：대화 진입 시 원본 버튼을 눌러 전송하세요. ID 결과를 확인하세요. 확인된 기록은 기존 클라이언트에 의해 차단 해제될 수 있습니다. 결과를 알 수 없거나 찾을 수 없는 경우 보관됩니다. 채팅 기록을 확인한 후 해당 기록을 명시적으로 무시할 수 있습니다. 이 작업은 채팅 메시지를 실행 취소하거나 다시 보내거나 삭제하지 않습니다.。
- **연결 끊김 및 여러 페이지**：실행 취소, 정렬 또는 편집 내용 저장은 결과가 명확하지 않은 경우 자동으로 다시 시도되지 않습니다. 다른 페이지에서 대기열이나 레코드가 수정되면 계속하기 전에 새로 고치거나 다시 엽니다.。

Codex Desktop、로컬 머신 CLI、SSH CLI 및 WSL 게이트웨이 대기열 지원 관리。Claude / DSH 네이티브 클라이언트로 전달된 대기열은 여전히 ​​네이티브 클라이언트에서 관리됩니다. 페이지에서는 제한 사항을 설명하고 잘못된 정렬을 제공하지 않습니다. 현재 기기에 저장된 미확인 기록은 별도로 처리 가능。

在本机 Codex App 选择“完成后发送”的消息会单独显示在“Codex 中待发送”。打开消息管理时会自动刷新，它们继续由 Codex 发送，编辑、排序和撤回请在电脑端操作。

旧版 Android App 请在原电脑连接中选择“更多 → 刷新页面”，再打开会话；只切回前台可能仍在使用旧页面。它只核对该电脑、账号、接入及会话的记录，不会清空其他草稿，也不会自动发送。

## English

Open **More → Message management** in a chat. A shortcut also appears above the composer when records need attention. Web, Android and iOS share this page.

- Drag a queued message by its handle, or use **Move up / Move down**. The gateway persists the order and uses it for dispatch.
- **Withdraw** removes an unsent message. It cannot undo a message already handed to the client.
- **Edit** changes a queued message in place, keeping its position and attachments. The separate editor preserves your chat draft and quotes. If dispatch has started, the edit is kept but cannot be applied.
- Old unconfirmed records are checked against their original submission IDs. Unknown or missing results remain visible for explicit dismissal; dismissal never resends or deletes chat messages.
- Ambiguous operations are not retried automatically. Conflicts between pages require refreshing or reopening the manager.

Gateway-owned Codex Desktop, local CLI, SSH CLI and WSL queues are supported. Claude / DSH native queues remain managed by their native clients; unsupported actions are not offered. Device-local unconfirmed records can still be managed.

Messages queued in the local Codex App appear under **Queued in Codex** and refresh while Message management is open. Codex remains responsible for sending them. Use the desktop app to edit, reorder, or withdraw them.

In older Android apps, choose **More → Refresh page** in the existing computer connection, then reopen the chat. Returning to the foreground alone may keep the old page running. No app reinstall or automatic resend is required.
