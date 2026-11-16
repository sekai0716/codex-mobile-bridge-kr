# 답변의 검토 및 인용

Web 그리고 휴대폰 App 공유 응답 렌더링 및 편집 영역。Codex 데스크탑、CLI、SSH 및 WSL 액세스 및 Claude、DSH，둘 다 현재 세션의 계정 및 작업 영역 범위를 사용합니다.。

## 의견 및 후속 조치 검토

완벽한 `::code-comment{…}` 태그는 우선순위, 제목, 설명, 파일 및 줄 번호가 포함된 리뷰 카드로 표시됩니다. 아직 완전히 출력되지 않은 코드 블록 및 마크업의 예에는 여전히 소스 코드가 표시됩니다. 이 카드는 댓글 복사를 위한 소스 코드에 대한 액세스를 제공합니다.。

현재 세션에서 파일이 인증되면 파일 위치를 클릭하여 선택합니다.“코드 위치 보기”，파일 태그에서 해당 코드를 보고 강조 표시합니다. 프로젝트 외부에 있거나 접근할 수 없는 파일은 위치 텍스트만 표시하고 파일 접근 범위를 확장하지 않습니다.。

`:codex-followup[…]` 작업 버튼으로 표시됩니다. 클릭하면 프롬프트 내용이 현재 편집 영역에 추가됩니다. 기존 입력 및 참조는 유지됩니다. 내용을 확인하고 수정한 후에도 보내기를 클릭해야 합니다.。

`codex://review` 링크는 전체 대상을 유지하므로 링크를 복사하거나 Codex Desktop 열려 있는. 링크에는 식별 가능한 정보가 포함되어 있습니다. GitHub PR 동시에 제공 PR 웹포털；Desktop 단독 리뷰 현황은 일반 파일로 읽어오지 않습니다.。

## 조각 참조 선택

Codex 및 Claude 제공된 정보“인용하다”작업; 마우스를 사용하거나 휴대폰을 길게 눌러 답장 텍스트를 선택한 다음 편집 영역 위를 클릭할 수도 있습니다.“선택한 텍스트 인용”。DSH 메시지 참조 및 선택한 참조 작업은 표시되지 않습니다. 인용된 부분은 확장하여 개별적으로 보거나 제거할 수 있으며, 기존 텍스트는 덮어쓰지 않습니다. 전화기의 시스템 복사 및 선택 메뉴는 계속 사용 가능합니다.。

견적은 컴퓨터, 계정, 앱, 호스트 및 세션별로 구성되어 현재 장치의 초안에 입력된 텍스트와 함께 저장됩니다. 목록으로 돌아가거나 세션을 전환한 후 다시 입력하면 해당 초안이 복원됩니다. 참조는 요청하지 않은 경우에만 일반 참조 텍스트로 변환됩니다. 참조를 선택하거나 추가해도 모델 요청이 시작되지 않습니다.。

승인된 파일 참조 태그는 파일 이름을 표시하며 현재 세션의 파일 링크를 통해 열 수 있습니다. 액세스할 수 없는 경로에는 파일 이름만 표시됩니다.。

사진 미리보기“대화에 추가”기존 텍스트와 첨부 파일을 유지하면서 현재 대화의 그림을 첨부 파일에 추가할 수 있습니다. 추가한 후에도 적극적으로 보내야 합니다. 컴퓨터, 계정, 앱, 호스트 또는 세션을 전환한 후 이전 미리 보기에서 새 초안에 이미지를 추가할 수 없습니다.。

Mermaid 차트는 계속해서 미리보기, 소스 코드 복사 및 전체 화면 확대/축소를 지원합니다.。

---

# Reviews and quotes in replies

The web client and mobile apps share reply rendering and the composer. Codex Desktop, CLI, SSH and WSL connections, Claude and DSH retain the current chat's account and workspace scope.

Complete `::code-comment{…}` directives appear as review cards with priority, title, explanation, file and line numbers. Code examples and incomplete directives remain readable source. Review source can be copied.

Authorized file links offer **View code location** in a file tab. Files outside the chat's permitted workspace remain plain location text. Review cards do not grant additional file access.

`:codex-followup[…]` actions append their prompt to the editable draft, preserving existing text and quotes. Sending remains a separate action.

`codex://review` links retain their full target for copying or opening in Codex Desktop. Recognized GitHub pull requests also offer a web link. Desktop-only review state is not exposed as an arbitrary file.

Codex and Claude messages offer **Quote**. You can also select part of a reply and choose **Quote selected text** above the composer. DSH does not offer message or selection quoting. Each quote can be expanded or removed. Native mobile selection and copy menus remain available. Quotes persist with the draft, scoped by gateway, account, application, host and chat. They are converted to ordinary quoted text only when you explicitly send.

Authorized file citations display the filename and open through the current chat's file link. Inaccessible paths remain plain filenames.

**Add to conversation** in an image preview adds an image from the current chat to its attachments, preserving existing text and attachments. Sending remains a separate action. Changing the gateway, account, application, host or chat invalidates an old preview's add action.

Mermaid preview, source copying and full-screen zoom remain available.
