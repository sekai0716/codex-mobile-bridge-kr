# Windows Preview 3 지점 통합

## 소스 및 보존 범위

통합 대상은 기능별, 클라이언트별, 운영 체제별, 인터페이스 호스트별로 분류됩니다. `refactor/platform-feature-layout` 나뭇가지. 다음과 같이 병합하기 전에 커밋하세요. `1283bea3deaf732f3bb5c6f21522d8460a139a50`，로컬 백업 지점은 다음과 같습니다. `backup/pre-windows-integration-1283bea`。원천 `codex/preview3-windows` 에 고정 `2776cf5c2431f97d43861aae5074cbe5dfbfe03f`，공통 베이스는 `d56cb0ccebc72182bf6f567062135f95a44eb9b8`。

소스는 다음과 같은 상대적으로 공통된 기반을 가지고 있습니다. 81 다음을 포함한 파일 Windows 기본 액세스 및 공유 Web、휴대폰과 데스크톱 상호 작용. 병합은 현재 지점의 안전성과 비용 최적화를 유지합니다.、Ubuntu 적응 발견 및 실행、macOS Claude 재연결 및 종료 확인, 공동 이동 삽입 스크립트, 호스트 및 창 레이아웃에 대한 별도의 파티션. 기존의 macOS/Linux 네이티브 모듈과 모바일 네이티브 소스 코드는 그렇지 않습니다. Windows 버전 적용 범위。

## 위치 수정

| 기능 | 병합된 유지 관리 위치 |
| --- | --- |
| Windows 설치 검색 등록、Store 별칭, 현재 데스크톱 세션 | `bridge/platforms/windows/discovery.py`、`discovery_ext.py`、`session.py` |
| Windows Claude 기본 작업, 영수증、profile 증거 | `bridge/platforms/windows/claude.py`、`claude-helper.cs` |
| Windows Codex/DSH 일반 종료, 명시적 강제 종료 | `bridge/platforms/windows/codex_quit.py`、`codex-quit-helper.cs`、`dsh_quit.py`、`force_exit.py` |
| Claude 백그라운드 연결 상태, 취소, 재시도 및 generation | `bridge/clients/claude/adapter.py`、`setup.py` |
| Codex 런타임 시 업데이트된 모델/계정/목표/보조 채팅 | `bridge/clients/codex/catalog.py` 그리고 `bridge/features/accounts/`、`sessions/` 소비자의 |
| DSH Host 식별, 종료 및 커넥터 업그레이드 | `bridge/clients/deepseek/`，Windows 위임 플랫폼 계층의 기본 종료 |
| 접근폐쇄, 정상퇴장, 강제퇴장 규칙 공유 | `bridge/clients/manager.py`、`lifecycle.py`、`desktop_app.py` |
| Web/휴대폰/데스크톱 공유 거부 | `web/features/clients/client-lifecycle.js`、`client-lifecycle.css` |
| 클라이언트 전환, 진행, 재시도, 세부 캐싱 및 초안 | `web/features/clients/client-navigation.js`、`desktop-sessions.js` |
| 데스크탑 게이트웨이 클라이언트 관리 | `desktop/features/clients/desktop-sessions.js` |
| Windows 현지 시험 응시 | `start-preview3-windows.cmd`、`scripts/start-preview3-windows.ps1`；`git-here.cmd` 오직 Git worktree |

원천 `web/account.css` 새로 추가된 종료 대화상자 스타일은 클라이언트 기능에 포함되었으며 계정 스타일과 혼합되지 않습니다. 리소스 목록, 고정된 정적 URL 화이트리스트, 데스크톱 참조 및 네이티브 어시스턴트 소스 코드 경로가 동시에 업데이트됩니다. 낡은 아파트 복원 안돼 Python 모듈 또는 전역 별칭 ​​레이어 추가。

## 감사 및 검증 경계

～에 따르면 GPT-6-sol 병합、GPT-6-luna 1차 심사와 본심사가 순차적으로 진행됩니다. 예비심사에서 발견된 macOS Claude 회귀 활성화가 수정 사항에 통합되었습니다.：macOS 부팅 후 액세스 상속을 명시적으로 활성화합니다.，Windows 전용 백그라운드 프로세스를 유지합니다. 진입점을 기존 인스턴스에 다시 연결하는 것만으로는 애플리케이션이 시작되거나 다시 시작되지 않습니다. 새로운 시뮬레이션 회귀는 이 차이를 다룹니다.。

소스 코드 수준 회귀：

| 조사하다 | 결과 |
| --- | --- |
| Python 소스코드 반환 | 전액 1,308 개，24 항목을 건너뛰었습니다. 유일한 실패는 스크립트 시퀀스 테스트 예상이었는데, 이는 수정되었습니다. HTTP 사용 사례 지정 재테스트 1/1 통과되었으며, 프로덕션 소스 코드가 변경되지 않았습니다. |
| Node 데스크톱 및 공유 프런트엔드 반환 | 431 개：430 통해、1 개 Windows 독점 테스트 건너뛰기 |
| 심사관의 독립적 지시심사 | 134 플랫폼 종속성, 리소스, 프로세스 목록, 클라이언트 시작 및 중지를 포함하는 모든 항목이 전달되었습니다.、macOS Claude 제어 및 릴레이 보안 |

Python 의 24 건너뛴 항목은 다음과 같습니다. 11 아이템 네이티브 컴파일/실행 설비、7 기타 품목 Windows 단독검사、2 선택적 암호화 종속성에 대한 항목 확인이 누락되었습니다.、4 항목이 누락되었습니다. SSH 의존성 검사。Node 건너뛴 항목은 다음과 같습니다. Windows WinError 32 조사하다。

독립적 검토에는 압축 요청 거부, 정상 포함 JSON、업로드하고 Range 다운로드. 인증, 문서, 엔드포인트, 알림, 모바일 네이티브 및 레거시 플랫폼 구현의 보존도 차등 검사를 통해 확인됩니다. 수정되지 않은 파일은 실제 장치 승인과 동일하지 않습니다. 6가지 네이티브 컴파일로 순수 소스코드 진입이 완료되었습니다./설비 제거 수행。

도입된 병합을 수정했습니다. macOS Claude 성능 저하 활성화, 화면 보호기 이유가 범용 상태에 의해 무시되고 데스크톱 서비스가 누락됨 `Catalog` 가져오기 문제；Windows GUI/CLI ID 비교에서는 대소문자 독립적인 의미 체계를 사용합니다. 테스트 픽스처는 새로운 모듈 위치를 동기화하고 플랫폼 모의, 리소스 순서 및 보안 어설션을 보존합니다.。

브라우저는 고정된 합성 세션과 로컬 정적 서비스를 사용하며 실제 클라이언트는 연결되지 않습니다.：

- 각 패스의 소스 및 병합 코드 85 같은 수표：7 아이템 캐시/초안/글을 쓰기 전에 새로운 내용을 확인하고, 12 그룹 종료 대화 상자 78 아이템 주장. 중국어와 영어의 세 가지 크기 조합과 강제 종료 지원 여부에서 카피라이팅과 대화 상자의 기하학적 구조에는 차이가 없습니다.。
- 병합 코드도 추가로 통과 90 항목 호스트 및 창 크기 체크섬 14 항목 분할 화면 대화형 검사, 브라우저 포함、iOS/Android 호스트 태그 및 UA，좁은 화면, 가로 화면, 와이드스크린; 초안, 탭, 읽기 위치 및 분할 화면 옵션을 확인하여 유지하세요.。
- 페이지 대화형 사용 DOM 운전사; 호스트 태그 에뮬레이션이 다음과 같지 않습니다. iOS WKWebView 또는 Android WebView 실제 기계 테스트. 정적 고정 장치는 클라이언트 아이콘 라우팅을 제공하지 않습니다. 스크린샷에 누락된 아이콘은 제품 아이콘 승인에 사용할 수 없습니다. 프로덕션 아이콘의 고정 라우팅은 변경되지 않습니다.。

이 라운드에서는 실제 구축, 설치 또는 작동하지 않습니다. Codex/Claude/DSH，실행되지 않음 Swift/C# 푸시, 수정, 태그 지정 또는 릴리스되지 않은 기본 컴파일。Windows 기본 창, 잠금 화면, 프로세스 종료 및 실제 계정 소유권은 여전히 ​​필요합니다. Windows 테스트 머신 검증；macOS、Linux 모바일 네이티브에 대한 완전한 엔드투엔드 수용도 모의 테스트로 대체되지 않습니다. 소스 브랜치 내역 Windows 확인은 이 확인으로 간주되지 않습니다.。
