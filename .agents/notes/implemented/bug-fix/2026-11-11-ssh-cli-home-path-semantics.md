# Agent Note: SSH CLI 구성 디렉터리는 대상 측 경로 의미 체계를 사용합니다.

Status: implemented

## 문제

Windows 게이트웨이 핸들 Linux SSH 악수로 돌아왔다 `/home/.../.codex` 이 기계에 맡겨주세요 `Path.is_absolute()`，따라서 구성 쿼리를 생성, 복원, 보관 및 생성하기 전에 유효한 원격 구성 디렉터리가 잘못 거부됩니다. 이전 설비는 게이트웨이의 자체 임시 디렉토리를 사용했으며 시스템 간 경로를 재정의하지 않았습니다.。

## 결정

Codex CLI 런타임 디렉토리는 다음을 통해 통합됩니다. `_runtime_home` 확인하다. 로컬 로컬 유지 `Path`，SSH 사용 `PurePosixPath`，그리고 후속 핸드셰이크는 첫 번째 확인의 원격 끝과 일치해야 합니다. home。모델 카탈로그 도우미는 모든 것을 변환합니다. `PurePath` 네이티브를 통해 구문 분석되거나 매핑되지 않고 원래 대상 경로로 명시적으로 직렬화됩니다.。

이 수정 사항은 남아 있습니다. SSH 로그인 shell 의 `CODEX_HOME` 선택, 원본 호스트, 원본 provider、기존 cwd 그리고 설치된 런타임. 읽기 전용 경로 확인이 스레드를 시작하거나 재개하지 않습니다.。

## 대안

삭제만 `is_absolute()` 잘못된 거부를 우회할 수 있지만 상대 경로를 허용하고 디렉터리 교체를 놓치게 됩니다. 게이트웨이 시스템 분기를 기준으로 설명할 수 없습니다. SSH 목표. 따라서 절대 경로를 유지하십시오. home 신원 비교, 경로 해석기만 교체。

## 검증

`tests/test_cli_remote_home.py` 에서 CLI 모듈의 기본 경로 유형이 다음으로 대체됩니다. `PureWindowsPath` 시간 범위 Linux home 의 resume、create、archive 및 creation_context；상대 경로、Windows 경로 home 변경사항은 작성되기 전에 거부됩니다. 모델 어시스턴트는 두 가지 모두를 다룹니다. `PurePosixPath` JSON 전염。

현실 Windows 저장을 통해 88Server SSH Alias는 소스코드가 검증된 제품에 대한 것입니다. proxy 기존 네이티브 서비스를 연결하는 경로，initialize 뒤로 `/home/sp/.codex`；같은 Windows 오래된 진행 중 `Path.is_absolute()` 뒤로 false，새로운 `_runtime_home()` 동의하고 고정하세요. POSIX home。독립적인 socket peer 메타데이터는 대상 사용자의 0.160 바이너리, 핸드셰이크 버전도 있습니다. 0.160。점검이 시작되지 않았습니다/종료 daemon、고정 세션을 읽거나 계속하고 모델 요청을 보냅니다. 원본 증거는 `.tmp/feedback-20261111-10/root-windows-ssh-handshake.json` 및 `root-ssh-peer.json`；이는 실제 시스템 간 핸드셰이크 및 오류 경로 결정을 보여 주며 전체 세션 복구 또는 이 릴리스 드레인 수용을 대체하지 않습니다.。

## 영향

게이트웨이 경로 의미 체계의 잘못된 판단으로 인해 시스템 간 액세스가 실패하지 않습니다. 원격 home 독립성을 유지하고 현지 계좌를 빌리지 마십시오. 이미 SSH 모델 도우미 및 세션 프로토콜은 변경되지 않습니다.。

## 원격 샘플 연결 수정

에서 Windows 원본 저장 사용 SSH 확인된 소스 코드 조각이 포함된 별칭 및 제품 CliSessions 어댑터, 사용자 지정 88Server 기존 CLI 대화경 thread/resume ～에 1969 ms 연결되었습니다. 진짜 목표는 Ubuntu 기본 켜짐 0.160.0，기존 ID、openai provider 작업 디렉토리는 변경되지 않고 그대로 유지됩니다. 모델 메시지가 전송되지 않거나, 계정이 교체되거나, 공유 서비스가 종료됩니다. 이 바이트 프록시만 닫으세요. 이 결과로 어댑터의 실제 연결이 완료됩니다.，Windows 새 버전의 설치 패키지 인터페이스는 여전히 최종 승인이 필요하므로 이에 따라 확장할 수 없습니다. 0.160 정상적인 비우기 지원 범위. 증거는 기본입니다 `.tmp/feedback-20261111-10/root-windows-ssh-heldout.json`。
