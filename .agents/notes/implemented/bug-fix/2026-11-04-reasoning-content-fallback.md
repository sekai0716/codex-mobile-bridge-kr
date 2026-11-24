# Agent Note: 保留 Codex reasoning 与 assistant 流式中间输出

Status: implemented

## 문제

Codex 의 reasoning 항목에 관련되지 않은 두 개의 필드가 있습니다.：`summary` 인터페이스에 표시되는 요약입니다.，`content` 원문의 생각글입니다. 공식 백엔드는 다음을 누를 것입니다. `reasoning.summary` 매개변수 반환 요약, 제3자 Responses 호환되는 백엔드는 종종 반환만 반환합니다. `content`，`summary` 항상 비어 있습니다. 제3자 액세스 API 그 후에도 휴대폰은 계속 렌더링됩니다.“생각 요약”행을 축소하고 확장했지만 텍스트가 없습니다. 입장 DSH 동일한 인터페이스가 생각을 표시할 수 있는 경우 DSH 어댑터 핸들 `thinking` 블록은 떠나지 않고 생각하는 텍스트에 직접 매핑됩니다. Codex 의 summary 필드。

게이트웨이는 이전에 읽기 전용이었습니다. `summary`，그리고 app-server 의 `item/reasoning/textDelta`、`item/reasoning/summaryTextDelta` 알림이 떨어지다 `_event` 결론 `return` 가지와 반사는 실시간으로 표시할 수 없으며 도착하기 전에 완전한 요약이 없습니다.。

Codex 的 `agentMessage` 也可能先通过 delta 发送正文，再由 `item/completed` 或 `turn/completed` 发送快照。如果快照中的正文为空，整体替换会抹掉已到达的文字；共享时间线仍会展示空 assistant 行，让用户看到模型名和操作栏，却看不到内容。

Codex 保存的历史中还会出现 `text` 只有空格的辅助 `agentMessage` / `assistantMessage`，紧挨着真正的最终答复。它不是一次可见回答，却会在旧手机客户端上生成带模型名、复制、引用和时间的空消息行。

## 决策

`normalize_item` 의 reasoning 분기는 먼저 빈 문자열을 필터링한 다음 `summary` 우선 사항、`content` 표시 텍스트는 하단에 표시되며 제목은 그대로 유지됩니다.“생각 요약”。이 줄은 둘 다 비어 있을 때 유지됩니다. 이는 이 추론이 발생했음을 나타냅니다. 숨기면 라인 순서가 바뀌게 되고 사용자는 클라이언트가 렌더링을 놓쳤다고 생각하게 됩니다.。

`CliSessions._event` 增加 `item/reasoning/textDelta` 与 `item/reasoning/summaryTextDelta` 处理：按 `turnId` 找轮次，按 `itemId` 找条目，缺失时按 reasoning 形状新建，增量写入 `summary[summaryIndex]` 或 `content[contentIndex]`。索引缺失按 0，只对小于 1024 的非负整数补齐空串，非法或巨大索引不分配数组。

同一 ID 和类型的原生快照替换条目时，只在新快照字段为空的情况下保留已有的 `text` 与 `aggregatedOutput`。reasoning 的 `summary` 与 `content` 仅在新快照两者都为空时一起保留；若新快照提供摘要，则不把旧原始思考正文拼回去。不同 ID 或类型不合并。该规则同时用于 item 与 turn 快照，避免晚到 `item/started`、`item/completed` 或 `turn/completed` 抹掉已收到的中间正文。

`normalize_state` 在时间线投影前省略空白 `agentMessage` 和 `assistantMessage`，但保留有附件的 assistant 行、非空 commentary/最终答复以及空 reasoning 项。原生状态本身不被改写；旧手机客户端也不会再收到这些空回答占位行。若同一个流式条目随后收到正文，它会按原生身份重新进入时间线。

## 대안

只改 `model.py` 的兜底可以让历史中确实存在的正文显示出来，但无法恢复 reducer 在完成事件归并时已经丢弃的 delta，因此需要在 `CliSessions._event` 保留事件链中的现有数据。

渲染层隐藏空 assistant 行可以去掉空白，但不会恢复已到达的正文，也会掩盖事件状态被回退的问题，因此在数据归并边界修复。

제목을 다음으로 변경하세요.“사고 과정”소스를 구별할 수 있지만 동일한 항목이 다른 백엔드에서 이름이 바뀌고 기존 복사본과 스크린샷도 무효화됩니다. 사용자가 이를 유지하도록 명시적으로 요구합니다.“생각 요약”。

两者都为空时丢弃 reasoning 行可以避免空面板，但会改变既有行序与条目数量，且与“思考摘要代表一次推理”的语义冲突，因此保留空 reasoning 行。assistant 行的空白占位项不表示一次可见回答，故仅过滤这一类；在手机 WebView 中藏起正文仍会留下按钮和时间，并且要求旧手机端更新，因此在服务端共享投影边界处理。

## 영향

第三方 Responses 后端接入后展开“思考摘要”能看到思考正文，并在整轮进行中随增量出现。官方后端行为不变：有 `summary` 时仍只显示摘要，不把原始思考暴露到界面。`content` 只在摘要缺失时补位，不改变 Codex 侧的字段语义。assistant 正文与命令输出在空完成快照之后仍保留已收到的内容；原生非空完成内容仍优先。

回归覆盖摘要优先、正文兜底、双空 reasoning 保留、空值与缺失字段容错，以及思考增量先于 `item/completed` 到达、增量早于 `item/started` 时自动建条目两种流式顺序；另覆盖 assistant delta 后的空 item 完成、空 turn 完成、晚到 started 事件、空白 assistant 占位过滤、有附件空白消息保留及占位项收到正文后重新出现。

로컬 통합 [PR #130](https://github.com/try2love/codex-mobile-bridge/pull/130) 제출 시 원저자를 유지하고 다음 경계를 추가합니다. 목록 형식의 제출만 허용합니다. summary/content，오류 문자열을 축어 표시로 분할하지 마십시오. 증분 인덱스는 비이어야 합니다. bool 정수 이하 1024，무한한 배열을 할당하지 않고 거대한 희소 인덱스를 거부합니다. 늦게 도착 reasoning started 수신된 증분을 지우지 마십시오.，completed 여전히 권위 있는 완전한 대체품。53 개 modes 및 64 개 CLI 세션 회귀 통과; 어디 39 임시 Unix socket 픽스처는 처음으로 샌드박스에 의해 금지되었으며, 실패한 항목만 릴리스된 후 실행됩니다. 실제 모델과의 연결이나 사용자 채팅 수정이 없습니다。
