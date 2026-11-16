# 플랫폼 구현

여기에 보관하세요 Windows、macOS、Linux 기본 작업 및 macOS/Linux 공유됨 POSIX 성취하다. 클라이언트, 계정, 세션 및 권한 규칙은 각각 다음과 같이 구성됩니다. `bridge/clients/`、`bridge/features/` 유지하다。

| 폴더 | 이 플랫폼 내에서 조정될 수 있는 콘텐츠 |
| --- | --- |
| `windows/` | Windows 설치 경로, 현재 데스크톱 세션, 창 종료, 명명된 파이프、ConPTY、Claude C# 기본 연결 도우미 |
| `macos/` | 애플리케이션 패키지 식별, 현재 사용자 프로세스、Launch Services、Claude 활동적인 profile 발견하고 Swift 기본 연결 도우미 |
| `linux/` | 설치 경로、`.desktop` 입장, 런처 식별, 현재 사용자 `/proc` 프로세스 정보 |
| `posix/` | Unix socket、POSIX 프로세스 시작 및 신호、PTY；일부 터미널 메서드도 있습니다. Windows 재사용 구현 |

`desktop(platform)`、`discovery(platform)` 대상 시스템에 따라 구현을 로드합니다. 다음에서 이용 가능 Windows 머신에서 수정 Windows 네이티브 코드는 다른 시스템의 구현을 동시에 변경할 필요가 없습니다. 공유 매개변수, 반환 값 또는 비즈니스 규칙에 관해서는 여전히 호출자와 다른 플랫폼을 확인해야 합니다.。

## 공통 국경

- 플랫폼 모듈은 역으로 가져오지 않습니다. `bridge.clients` 또는 `bridge.features`，클라이언트 활성화, 계정 전환, 애플리케이션 다시 시작 또는 작업 승인 여부를 스스로 결정하지 마십시오.。
- `clients/desktop_app.py` 및 `clients/lifecycle.py` 정확한 애플리케이션 ID 매칭을 유지하고 운영 전 재검증、GUI/런타임 차별화 및 종료 대기. 플랫폼 작업은 선택된 경로를 수신합니다.、PID 및 환경 변수。
- 클라이언트는 설치 메타데이터만 확인하고 시작 스크립트를 실행하지 않으며 계정 키를 읽지 않고 새 사용자를 생성하지 않는 것으로 나타났습니다. profile。검색됨, 시작됨, 연결됨 및 업스트림 인증 성공은 서로 다른 상태입니다.。
- IPC 플랫폼 모듈은 바이트 스트림만 제공합니다. 메시지 형식, 요청 번호, 데스크탑 owner 세션 라우팅은 다음에 속합니다. Codex 클라이언트 계층。
- 터미널 사용자/세션, 중복 실행 방지 및 용량 제한은 엔드포인트 기능 계층에서 조정됩니다. 이러한 규칙을 시스템별로 복사하지 마십시오.。

## 현재 Linux 범위

Linux 기존 설치 검색, 동일 사용자 프로세스 제어 및 공유 POSIX IPC/PTY 성취하다. 스캔은 기존 설치 디렉터리를 지원합니다.、PATH 이름과 일치합니다 `.desktop` 기입; 동일한 디렉터리에 대한 지점을 식별할 수 있습니다. GUI 의 shell 런처를 실행하지만 실행하지는 않습니다. 실행 권한이 없는 파일, 알 수 없는 스크립트, 데스크톱 패키지 증거가 누락된 이름 `codex`/`claude` CLI 아무것도 안 할 거야 GUI 연결。

스캔 대상 Claude 자동 연결 지원을 의미하지 않음: 현재 `clients/claude/setup.py` 오직 에서만 macOS/Windows 보고서 `native-console`；Linux 보고서 `automaticConnection=unavailable`、`setupState=unsupported`，아니요 Linux 네이티브 Console 어시스턴트. 다른 플랫폼에 구현된 대체 분기 선언을 사용하지 마세요. Linux 이 기능이 지원됩니다。

DeepSeek Harness 커넥터와 구성 논리는 여전히 클라이언트 계층에서 공유됩니다. 설치 여부 및 원래 데스크탑이 존재하는지 여부 profile、재시작이 필요한지, 인증이 완료되었는지는 실제 상태를 기준으로 판단해야 합니다. 새로운 설치 양식 또는 버전에는 해당 검색이 필요합니다./합의 증거, 디렉토리 분할 자체는 호환성 범위를 증가시키지 않습니다.。

## 검증 및 리소스

`tests/test_platform_architecture.py` 종속성 방향, 플랫폼 선택 및 사전 종료 확인 확인；`test_client_inventory.py` 세 가지 플랫폼의 검색 범위, 일괄 쿼리 시간 및 신선도 상태를 확인하세요. 클라이언트 검색, 출시 및 IPC 해당 테스트 모듈에서 각각 다룹니다.。

개정하다 `posix/terminal.py` 동시에 확인 SSH 소스코드 로딩; 파일이 원격 끝으로 전송됩니다 Python。상대 가져오기 또는 파일 이동 시 동기 검사가 필요합니다. `bridge/resources.py`、`scripts/gateway-resources.json` 그리고 포장입구. 네이티브 어시스턴트 경로와 컴파일된 스크립트도 일관성이 있어야 합니다. 시뮬레이션 테스트 통과는 해당 시스템의 기본 통합 검증을 대체할 수 없습니다.。
