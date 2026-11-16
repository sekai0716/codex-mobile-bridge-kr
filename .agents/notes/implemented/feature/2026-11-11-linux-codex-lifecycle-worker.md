# Agent Note: Linux 목표 Codex 라이프사이클 영수증

Status: implemented

## 문제

SSH 및 WSL Codex 연결 제어는 동일합니다. home 공유 네이티브 daemon。구독 취소 후 프록시를 닫고 전송 연결을 끊은 후 기본 writer 아마 아직 거기 있을 거예요. 게이트웨이의 현재 운영 체제 PID 신호 인터페이스는 대상을 직접 제어할 수 없습니다. Linux；또한 전송 시간 초과는 대상이 종료 작업을 수신하지 않았음을 증명하지 않습니다. 기존 기본 ID 및 신호 구현을 대상 측에서 재사용해야 하며 전체에 저장할 수 있습니다. worker 프로세스 검증 작업 영수증。

## 결정

`bridge/platforms/linux/codex_cli_control.py` 공급 `inspect`、`dispatch` 및 `check`。대상 측에서 그대로 재사용 `linux/codex_daemon_env.py` 신원 reader，추가 검증 managed-daemon 역할, 목표 home、executable 및 socket 장비/inode、동일한 사용자 SO_PEERCRED。어댑터는 동일한 런타임의 검증된 버전을 worker；정상 SIGHUP 현재는 기존으로 제한되어 있습니다. POSIX 검증된 테이블에서 0.164.0 및 0.167.0。force 검증된 프로세스 ID 및 명시적인 작동 모드, 작업 또는 인증 구성에 의존하면 읽을 수 없으며 기본 ID 확인이 변경되지 않습니다.。

worker 에서 home 아래에 `bridge-cli-maintenance/linux` 프로세스 전반에 걸쳐 개인 영수증 저장 flock。한번 배포하고 원본도 동시에 받아보세요 daemon.lock，잡고 있다 pidfd 원래 세대를 다시 확인하고 원자 교체 및 fsync 의도 문서 이후 한 번만 전송 SIGHUP 아니면 클리어 SIGKILL。업데이트되기 전에 연결이 끊어지더라도 영수증은 유지됩니다. unknown，같은 requestId 또는 동일한 프로세스와 모드를 가진 새로운 것 ID 기존 작업만 확인하세요. 정상적인 비우기 및 비우기 force 다양한 요청이 있습니다 ID，아직 알 수 없는 경우 사용자가 원래 의도를 명확히 할 수 있도록 허용 force。기존 force 이미 존재하는 경우 후속 일반 의도가 해당 작업을 관찰합니다.。

`check` 원본만 참고하세요 bootId、태어난 시간과 pidfd 종료 상태. 새로운 PID 기록, 네이티브 socket 또는 다시 시작됨 daemon 오래된 영수증에 대한 신호의 대상이 되지 않습니다.。worker 스레드 로드 안 함, 작업이나 대기열 저장 안 함, 서비스 시작 안 함, 삭제 안 함 endpoint；영향 범위, 유휴 상태 및 복구는 공유 비즈니스 계층에서 계속 조정됩니다. 원격 리소스 목록에는 기존 리소스도 포함됩니다. Linux reader 이 모듈을 사용하면 원래 신원 알고리즘을 복사하지 마십시오.。

0.164.0 의 home 입구가 가리키는데 `/tmp/codex-daemon-UID` 단일 홉 심볼릭 링크. 기본 규칙에 따라 계산된 경로만 허용됩니다. 항목 상위 디렉터리를 정규화한 다음 파일 이름을 연결하고 원래 경로 바이트를 추출합니다. SHA-256；공유 개인 디렉터리는 현재 사용자여야 하며 권한이 있어야 합니다. 0700，대상은 엔터티 전용이어야 합니다. socket。세대 저장 실제 socket 경로와 inode，매번 inspect 동시에 재시험 home 별칭 peer；외부 링크, 다중 홉 및 별칭 변경이 거부됩니다.。[네이티브 Unix socket 공들여 나열한 것](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server-transport/src/transport/unix_socket.rs#L307-L348)

## 기존 메모 감사

[CLI 명시적 강제 종료](2026-11-11-cli-explicit-force.md)이것과 부분적으로 겹치며, 의도를 명확히 하고 복구 경계를 미리 보고 공유하는 게이트웨이 역할을 계속 담당합니다. 이번에는 타겟 실행과 영구 수신만 추가됩니다.。[WSL Codex 통일된 출입구](../architecture/2026-10-24-codex-wsl-unified.md)계속해서 릴리스를 유지하세요. 사용자、home 원래 세션 ID를 사용합니다. 이번에는 배선이 없습니다. SSH/WSL adapter，쓰기 작업 게이트 잠금을 대체할 제품도 없습니다. 기존의 [shared desktop runtime 제안](../../proposed/architecture/2026-11-08-codex-shared-desktop-runtime.md)이는 여전히 독립적인 아키텍처 논의입니다. 현재 worker 그 계획을 흡수하지 않았다。

## 대안

- 기본 ID를 복사하여 단일 파일로 읽으면 원격 주입 모듈 수를 줄일 수 있지만 두 번째 세트가 생성됩니다. `/proc` 및 PID record 규칙. 기존 재사용 Linux reader，주입측은 모듈을 그대로 운반합니다.。
- 게이트웨이에 저장된 분배 기록만 로컬 운영 원장을 재사용할 수 있지만, 다중 게이트웨이 또는 전송 연결이 끊어진 후에는 worker 전송된 신호를 종합적으로 식별할 수 있는 방법은 없습니다. 목표 home 원자 영수증을 저장하고 동일한 주소로 보냅니다. home 파일 잠금 직렬화。
- 자동 재시도 시간 초과로 인해 수동 확인이 줄어들지만 기본 중복이 발생합니다. Forceable 조치가 필수로 확대될 수 있습니다.，PID 교체되었을 수도 있습니다. 잡고 있다 pidfd 단일 전송, 알 수 없는 결과 쿼리 원본。

## 시험

로컬 합성 회귀 범위 목표 home/사용자/boot/출생 시간/이미지, 네이티브 캐릭터、socket 권한 및 peer、legacy PID 필드, 기본 단일 홉 별칭 및 canonical 아이덴티티, 외부링크/더 점프해/경로 변경 거부, 프로세스 스케줄링 상태 변경, 동시 requestId 동시대 사람들과 반복하고 명확하게 force 업그레이드, 영수증 분실, 의도 지속성 실패, 동시성 및 기본 잠금, 교차 scope 영수증, 읽기 전용 수표. 시스템 프로세스 및 신호는 mock，socket 파일은 프로젝트의 임시 디렉터리에 있습니다. 이 테스트는 목표를 대체하지 않습니다. Linux 실제 신호와 네이티브 CLI 수락。

1차 격리 WSL 0.164.0 처음으로 inspect 네이티브 거부 home 심볼릭 링크, 신호 또는 모델이 디스패치되지 않았습니다. POST。읽기 전용 확인 항목, 개인 디렉토리, 실제 socket 허퉁 PID peer 나중에 오래된 것을 얼리기 위해 worker 실제 경로로 1회 디스패치하는 것이 정상입니다. SIGHUP；잡고 있다 pidfd 그리고 독립적인 관찰을 통해 자체 프로세스가 확인되었습니다.、endpoint 종료되고 원래 오류가 유지됩니다. 재현된 레이아웃에 별칭 규칙과 방향성 빨간색과 녹색을 추가했습니다. 수리 후 다른 장비를 이용해 실제 실험을 진행했습니다. fresh home，1차 라운드에는 포함되지 않습니다.。

수리 후 22 개 worker 합성 회귀 4 항목 모듈 경계가 통과되었습니다. 이미 실행 중 WSL 의 0.164.0 기본 격리 수락도 5개 항목을 통과했습니다. turn 받다 SIGHUP 계속 비우십시오. 발신자는 영수증을 완전히 수신한 후 독립적으로 폐기합니다. worker check 중복된 요청만 관찰하세요. 명백한 force 동시대인을 통해 pidfd 출구; 오래된 영수증은 교체 생성에 영향을 미치지 않습니다. 교체 생성이 한 번 발생합니다. SIGHUP 정상적으로 종료됩니다. 두 세대가 같은 세대에서 태어났다. runtime initialize 확인하다 home/버전. 루프 합성 모델은 하나만 있습니다. POST，예상치 못한 사건이 발생하지 않음 POST；상담원이 9번 거절했습니다. CONNECT，이 결과는 전체 프로세스의 아웃바운드가 0이라는 것을 증명하지 않습니다. 독립적인 관찰을 통해 2세대가 확인되었습니다. PID、scope 프로세스와 advertised/canonical 엔드포인트가 없습니다. 수신 완료 후 수신을 폐기하는 것은 실제 전송이 도중에 끊어지는 것과는 다릅니다.。

공식적인 0.164.0 의 PID record 명시적인 수락 `linuxProcessIdentity` 오래된 필드；worker 같은 것을 부를 때만 reader 전에 현재 필드로 정규화하십시오.。[네이티브 PID record](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/app-server-daemon/src/backend/pid.rs#L40-L51)

## 영향

이 단일 지점은 다음을 제공합니다. Linux 대상 제어 기본 요소 및 최대 1회 수신。SSH / WSL adapter、범위 UI、공유 비즈니스 및 계정 복구 인터페이스는 현재 구현을 유지하며 향후 독립적으로 연결될 예정입니다. 영수증은 알 수 없는 의도로 영구적으로 남아 있습니다. ID, 권한 또는 지속성 오류는 감사 가능한 오류를 유지하며 유휴 프로세스를 기본값으로 신뢰할 수 없습니다. 현실 WSL 수락 범위 목표 Linux worker 아직 검증되지 않은 기본 제어 SSH 전송 또는 게이트웨이 adapter 전체 링크 공개。
