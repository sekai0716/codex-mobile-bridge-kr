<a id="v217"></a>

## v2.1.7 릴리스 승인 / Release verification

기능적 기준은 다음과 같습니다. `25bd5c48e1b6a8b1d54e416457a131dbd62b3b3c`，공식 버전은 다음과 같이 컴파일되어 제출됩니다. `404d584`。후보자 `9ac8f0e` 정적 리소스를 강조하는 코드에 대한 두 개의 테스트 목록만 완료되었으며 제품 로직은 변경되지 않았습니다. 데스크톱 버전과 모바일 버전이 통합되었습니다. **2.1.7**，Android/iOS 빌드번호는 **40**；공식 신청서 식별、Android 서명 및 데스크탑 업데이트 서명 확인 공개 키는 변경되지 않습니다.。

| 접수항목 | 결과 및 증거 경계 |
| --- | --- |
| 전체 CI | [후보자 PR CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/41031566392) 의 10 모든 작업이 통과되었습니다. Windows/Ubuntu Python 3.9、3.13，macOS Python 3.13、프런트엔드, 실제 브라우저 및 모바일 편집/업데이트 확인. 최종 서류 제출은 여전히 ​​충족되어야 합니다. [풀어 주다 PR #109](https://github.com/try2love/codex-mobile-bridge/pull/109) 병합 전 필수 확인 사항 |
| 지역 회귀 | 프런트 엔드 1314 통해、1 뛰어넘다；Chromium/WebKit 브라우저 144 통과하다; 업데이터 32 통해、1 뛰어넘어라. 초기 백엔드 전체 실행에서 두 가지 실패는 새로 추가된 리소스가 이전 테스트 기대치에 포함되지 않았기 때문에 발생했습니다. 수정 후 관련 112 검사 통과（2 아이템 플랫폼 건너뛰기）, 완전한 크로스 플랫폼 CI 그런 다음 통과했습니다. 최종 서류 제출 macOS CI 두 가지 종속성 노출 200ms 스레드 스케줄링 타이밍/스냅샷 대기 픽스처, 시뮬레이션 후 제어 가능한 시계 및 대기 관련으로 변경됨 20 원격 시간 초과 후 로컬 사용 중인 세션을 확인하는 원래 어설션을 유지하면서 항목이 전달되었습니다. 제품 논리는 변경되지 않았습니다.。Windows 실제 범위 다운로드 테스트도 사용됩니다. 250ms 타임아웃 고정 장치，350ms 인위적인 전송 지연을 재현할 수 있음 503；파일 의미 테스트가 인접 스트리밍 통합 테스트로 전환됩니다. 5s 예산, 시간 초과 특별 테스트는 변경되지 않았습니다. |
| 5가지 데스크탑 아키텍처 | [후보 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/41031509847) 의 macOS arm64/x64、Windows x64、Linux x64/arm64 모두 통과되었습니다. 런타임 정지, 설치 시작, 로그인 및 QR 코드 페어링, 알림 포함、HTTPS、해당 플랫폼에 대한 핸드오버 및 실패 롤백 업데이트；Windows 독립된 내용을 포함 ConPTY 구성 요소, 시스템 구성 요소가 교체되지 않음 |
| 버전 간 데이터 호환성 | 실제로는 Mac arm64、Windows x64、Ubuntu x64 on, 검증된 형식을 사용하세요 v2.1.6 후보자들과 함께 v2.1.7 패키지 실행 격리 런타임 `2.1.6 → 2.1.7 → 2.1.6`，기존 QR 휴대폰 인증은 여전히 ​​유효하며 구성 바이트도 남아 있습니다. 패키지 내 게이트웨이의 버전 간 데이터 검증 항목입니다.；GUI 설치 및 업데이터 승인은 위에서 언급한 플랫폼 워크플로에서 별도로 다루며 세 가지 공식 일상 루틴으로 언급되지 않습니다. App 덮어쓰기되어 업그레이드되었습니다. |
| Android | 공식적인 APK 신청서 식별 및 서명 v2.1.6 일관된. 헌신적인 Android 35 시뮬레이터는 동일한 패키지 이름으로 덮어쓰기 업그레이드를 완료합니다./대체, 기본 설정, 컴퓨터 목록, 기본 암호화 바인딩、WebView 인증된 실제 저장소 형식의 초안 및 참조는 제거나 데이터 재설정 없이 유지됩니다. |
| iOS | 공식 로고와 두 확장 모두 2.1.7/build40，unsigned IPA 소스 코드 패키지로 빌드합니다. 헌신적인 iOS 18.2 시뮬레이터가 적용 범위 업그레이드를 완료합니다./대체, 기본 설정、WebView 인증/초안 및 기본 Keychain 바인딩 기록이 유지됩니다. 에뮬레이터 사용 Xcode 일반 서명; 다음으로 수정된 수락 스크립트 Keychain 암호화된 필드는 일반 텍스트 쿼리로 잘못 판단됩니다. 이번 라운드에는 선언이 없습니다. iPhone 실제 머신 서명 설치 승인; 사용자는 설치를 덮어쓰려면 원래 서명 ID를 계속 사용해야 합니다. |
| 데이터 및 리소스 경계 | 테스트는 격리된 구성 및 합성 바인딩만 사용하고 채팅 메시지를 보내지 않으며 모델을 호출하지 않으며 일일 계정, 구성, 휴대폰 바인딩 또는 초안을 대체하지 않습니다.。Windows 장치의 임시 파일, 설치 패키지 및 로그가 모두 들어 있습니다. F 그릇。Ubuntu 더 이상 실행되지 않는 것으로 확인된 오래된 항목만 정리하세요. Test 제품 복제, 소스 코드, 승인 기록 및 최근 롤백 사본 유지 |

PR #85/#86/#92/#95（@heiqiu47）、#88（@mc373906408 / waken）및 #96（@littltstream）원본 제출은 릴리스 분기 기록에 유지되며 독립적인 제출은 통합 및 수정됩니다. 사용을 위해 출시 merge 기여자로 남으세요, 아니요 squash。관련 기능 및 Issue 해당 관계에 대해서는 다음을 참조하세요. [릴리스 노트](RELEASE_NOTES.md#v217)。[#77](https://github.com/try2love/codex-mobile-bridge/issues/77) 기본 보관 제한 사항 및 [#103](https://github.com/try2love/codex-mobile-bridge/issues/103) 기본 라우팅 제한은 계속 추적됩니다.，WSL 계정 관리는 아직 실험적인 기능입니다.。

태그 구성을 다시 통과해야 합니다.；Release 모든 날짜까지 초안 유지 15 데스크탑/이동하다/자산 업데이트가 완료되었습니다. 매니페스트 서명을 업데이트하고 다시 다운로드하세요. SHA-256 검증을 통과한 후에만 공개됩니다. 최종 라벨링 작업 흐름 및 자산 참조 [v2.1.7 릴리스 페이지](https://github.com/try2love/codex-mobile-bridge/releases/tag/v2.1.7)。이번 라운드의 로컬 증거는 무시 디렉터리에 있습니다. `.tmp/release-v217-20261030/`，기본 구성이나 자격 증명을 커밋하지 않습니다.。

**English:** v2.1.7/build40 retains production identifiers, Android signing and the desktop update-verification key. The linked 10-job candidate CI and all five desktop architecture builds passed, including package installation/startup and applicable updater/rollback checks. Actual Mac, Windows and Ubuntu packaged runtimes passed isolated 2.1.6 → 2.1.7 → 2.1.6 data compatibility with the original QR binding and configuration bytes preserved; this is separate from GUI updater testing. Dedicated Android 35 and iOS 18.2 simulators retained preferences, native bindings, WebView authentication and drafts across overlay upgrades and rollback. This does not claim a new physical-iPhone installation. Daily apps/data were not replaced; Windows temporary files stayed on F:. Original PR author commits are retained. The final tag build, signed manifest and all 15 downloaded assets must pass verification before publication. Native archive/routing limits remain documented; WSL account management remains experimental.

---

<a id="v216"></a>

# v2.1.6 출시 전 승인（2026-10-27）

상대값으로 고정된 범위 v2.1.5 세션 정렬, 복사, 파일 읽기, 계정 표시, 목록 업데이트 및 PR #73/#82；추가 기능은 없습니다. 제품 및 빌드 입력은 다음으로 고정됩니다. `8d0880b`，후속 조치 `c3c404b` / `3e5f658` 크로스 플랫폼 테스트 픽스처만 수정하고 이를 원본 작성자 기록에 병합합니다.，`bridge/desktop/web/mobile/scripts`、항목별로 종속성 및 빌드 구성 항목에는 차이가 없습니다. 버전은 2.1.6，Android/iOS build 39。공식 릴리스는 관리자의 검토를 받습니다. Release 설명; 이번에는 태그가 생성되지 않습니다. Release。

| 접수항목 | 결과 및 증거 경계 |
| --- | --- |
| 소스코드 반환 | 로컬 백엔드 2671 개：2624 통해、47 플랫폼/네이티브 픽스쳐 스킵; 프런트엔드 1207 개：1206 통해、1 건너뛰다; 업데이터 33 개：32 통해、1 뛰어넘어라. 후속 보관 장치 76 허 시앙 CLI 계약 48 항목이 통과됨；Windows 기본 파일 보관 비활성화에 대한 부정적인 사용 사례가 최종 버전에 포함되었습니다. 2672 개 CI |
| CI 공식 데스크탑 패키지 사용 | [최종 제품 후보 5개 아키텍처 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/40383008443)씌우다 macOS arm64/x64、Windows x64、Linux x64/arm64。완전한 테스트, 패키징 및 실제 설치가 포함되어 있습니다./시작, 로그인/코드를 스캔하여 바인딩하고 알림、HTTPS、핸드오버 및 오류 롤백을 업데이트합니다. 구체적인 결론은 작업 결과에 따라 달라질 수 있습니다.。PR 병합하기 전에 필수 검사를 모두 통과해야 합니다. |
| Windows 테스트 개정 | 현실 POSIX 파일 아카이브가 없습니다 Windows 달리기; 제공하는 척하지 않음 Windows 네이티브 Claude 문서 보관。Windows 명시적으로 지원되지 않는 프로세스 릴리스, 프로토콜, 라우팅 및 부정 검사를 계속 수행합니다. 독립 원격 worker 방지하려면 임시 스크립트를 사용하여 원본 전체 페이로드를 실행하세요. Windows 명령줄 길이 제한. 제품 로직이 변경되지 않았거나 아카이브 보안 조건이 완화되었습니다. |
| 세 끝 Test | 같은 `c3c404b` 제품 소스는 별도로 컴파일되어 설치에 적용됩니다.。Mac 가방 안에 370 개인 Web 파일 일관성，Windows 727、Ubuntu 734 설치 파일 및 manifest 일관된; 3단자 게이트웨이 상태가 인스턴스와 일치하고 구성, 계정, 유효한 바인딩 및 기존 네이티브 클라이언트 프로세스가 유지됩니다. 정상적으로 종료가 확인된 경우에만 종료 Test；Windows 확인되지 않은 두 개의 역사적 기록은 원본 바이트에 따라 유지되며 삭제되거나 재생되지 않으며 원본 결과가 확인되었다고 주장하지도 않습니다. |
| 인터페이스 수용 | Mac Test 창이 실제로 열리고 모든 액세스 주소가 표시됩니다.，WSL 중복 클라이언트와의 그룹화는 나타나지 않습니다. 특정 할당량 및“계정을 추가하거나 API”유지하다, 원본 Claude 비활성화 상태는 변경되지 않습니다.。Windows/Ubuntu 원래 사용자 그래픽 세션에서 렌더링이 시작되고 확인되었습니다./인스턴스 및 리소스 이번 라운드에서는 원격 창 스크린샷을 얻지 못했고 프로세스 증거를 시각적 수용이라고 부르지 않습니다. |
| 네이티브 Codex 보관소 | Mac 0.164.0-alpha.11.1、Windows 0.164.0-alpha.11.1、Ubuntu 0.160.0、WSL 0.164.0 둘 다 새로운 격리 세션과 로컬 가짜 모델 확인을 사용합니다. 대상, 원본 런타임 아카이브만 중지합니다./복원 및 ID 보류 중 바이패스 세션은 활성 상태로 유지되며 보조 작성자는 거부됩니다. 실제 모델에 요청이 전송되지 않거나 실제 사용자 세션이 중지됩니다. |
| Claude 기본 경계 | 네이티브 CLI 2.1.292 SegWit이 입증되었습니다 interrupt → 최종 결과 → EOF → 그만두다. 후속 실제 쓰기 프로세스 검사에서는 다른 쓰기 프로세스를 올바르게 차단합니다. CLI 살아있는 동안 파일을 보관하므로 이 완료가 사실이라고 주장하지 마십시오. Claude 전체 프로세스 아카이빙。POSIX 문서 보관/복구 및 원격/WSL 경로에 합성 회귀가 있고 기본 기록 목록이 숨겨져 있습니다./격리 확인의 지정된 버전을 복원합니다. |
| DSH 치받이 | 실제 v2.1.5 오래된 커넥터 LF/CRLF 소스 코드가 식별되고, 읽기 전용으로 검색되며, 픽스처로 명시적으로 업데이트됩니다. 자격 증명 및 기타 파일 바이트/타임스탬프는 유지되며, 기본 게이트웨이를 다시 시작하지 않고도 게이트웨이가 정상적으로 시작됩니다. DSH。네이티브 stop/archive 시퀀스 및 실패 거부에는 계약 테스트가 있습니다. 이번 라운드에는 새로운 실제 항목이 추가되지 않습니다. DSH/Claude Code Desktop 활성 세션 완료 아카이브 승인 |
| Android | 공식 로고 APK 2.1.6/build39，다음으로 서명됨 v2.1.5 일관된. 헌신적인 API35 시뮬레이터 실행 v2.1.5 → v2.1.6 → v2.1.5 설치, 최초 설치 시간, 기본 설정, 컴퓨터 바인딩, 기본 및 WebView 인증이 유지됩니다. 제거 없음/데이터 재설정 |
| iOS | [공식적인 unsigned 짓다](https://github.com/try2love/codex-mobile-bridge/actions/runs/40378266701)통과; 삼 bundle 버전/로고 및 49 소스 코드 파일, 공유 JS 모두 일치합니다. 헌신적인 iOS18.2 시뮬레이터 적용 범위 업그레이드/원래 기본 설정과 기본 설정을 유지하기 위한 대체/WebView 인증. 이는 시뮬레이터 호환성 검증이므로 교체할 수 없습니다. iPhone 실제 머신 서명 설치 인증서 |

**아카이브 제한은 해결된 결함이 아니라 노출된 기능 경계입니다.。** Codex App 여전히 쓰기 액세스 권한을 보유하고 있는 세션의 일부는 다음에서 액세스할 수 없습니다. Bridge 풀어 주다; 전체를 종료하지 않습니다 App 또는 기본 데이터베이스를 다시 작성하십시오.。Claude 파일 보관은 검증된 플랫폼, 버전, 원래 구성 및 작성자 없음 조건에만 열려 있습니다.，Windows 네이티브 CLI 확인되지 않은 버전에서는 열리지 않습니다.，Cowork 아직 지원되지 않음。DSH 작업이 중지된 후 이전 커넥터를 명시적으로 다시 시작하고 업그레이드해야 합니다. 공식 버전과 동일한 기본 커넥터를 공유하는 버전 Test 호환되는 버전을 동시에 업그레이드해야 함。[Issue #77](https://github.com/try2love/codex-mobile-bridge/issues/77)계속해서 열어。

PR #73（원래 커밋 `2ecf0aab`，@lanchengjiu）및 PR #82（원래 커밋 `491a6f52`，@mc373906408 / waken）모두 사용됨 merge 저자 제출물을 유지하고 GitHub 계정 연결. 릴리스 노트 보기 [v2.1.6](RELEASE_NOTES.md#v216)。이번 라운드, 해시 및 로컬 전용 설치에 대한 자세한 로그/데이터 보호 기록은 무시 디렉터리에 저장됩니다. `.tmp/release-v216-20261027/`，자격 증명, 세션 또는 로컬 구성을 커밋하지 않습니다.。

---

<a id="v215"></a>

# v2.1.5 출시 확인

태그 게시 `v2.1.5` 가리키다 `3e90c8d`，합격한 후보자를 기준으로 `1006a4e`。데스크탑과 휴대폰이 하나로 통합되었습니다. **2.1.5**，Android/iOS 빌드 번호 **38**。PR #64 의 8 원래 커밋 PR #70 의 `d62002b` 역사 속에 보존되어 있습니다. 개정된 버전은 테스트 픽스처만 수정합니다: true registry 길、UTF-8 다시 읽다、SQLite 제품 동작을 변경하거나 어설션을 완화하지 않고 연결 종료 및 타임아웃 클록 격리。

| 조사하다 | 결과와 범위 |
| --- | --- |
| 라벨 완료 CI | [40205704693](https://github.com/try2love/codex-mobile-bridge/actions/runs/40205704693) 의 7 모든 검사 통과：Windows / Ubuntu Python 3.9、3.13，macOS Python 3.13，프런트엔드 및 모바일 업데이트를 확인합니다. 백엔드 합계 2556 항목, 플랫폼에 따라 기존 기본 픽스처를 유지하고 건너뜁니다. 건너뛰는 것은 기본 승인을 통과한 것으로 간주되지 않습니다. |
| 로컬 프런트엔드 및 업데이터 | 프런트 엔드 1146 개：1145 통해、1 건너뛰다; 업데이터 33 개：32 통해、1 뛰어넘어라. 기본 모바일 퍼블리싱 및 다운로드 및 복구 검사를 통과했습니다. |
| Android | 정장 가방 2.1.5/build38，신분증과 서명을 적용하세요. v2.1.4 일관된. 헌신적인 Android 35 시뮬레이터 완료 2.1.4 → 2.1.5 → 2.1.4 덮어쓰기 및 롤백, 제거 또는 재설정 없음; 컴퓨터 목록, 설정, 바인딩 자격 증명 및 기본/WebView 신뢰할 수 있는 인증 유지 |
| iOS | 공식 마스터 App 두 확장 식별자는 모두 2.1.5/build38；공식적인 CI 서명되지 않은 IPA 공유 스크립트는 라벨, 소스 코드와 일치합니다. ZIP 의 49 파일 Git 추적 내용은 하나씩 일관성이 있습니다. 헌신적인 iOS 18.2 시뮬레이터 완료 2.1.4 → 2.1.5 → 2.1.4，컴퓨터 목록, 설정 및 기본/WebView 신뢰할 수 있는 인증이 유지됩니다. 첫 번째 라운드 지그 cookie 기본 변경 사항은 이전 버전에서 재현되었습니다. 기준선을 수정하고 다시 검사합니다. 이번 라운드에 대한 실제 휴대폰 설치 승인으로 시뮬레이터를 선언하지 마십시오. |
| ID 업데이트 및 설치 | 데스크탑、Android、iOS 정식 식별 및 데스크톱 업데이트 서명 확인 공개키 유지관리。Windows 독립된 내용을 포함 ConPTY 구성 요소, 시스템 구성 요소를 교체하지 마십시오.；Android 정식 서명 사용，iOS 사용자는 원래 로고와 서명을 직접 덮어쓰고 설치해야 합니다. |
| 레이아웃과 WSL 경계 | 최신 WSL 팝업창이 진짜네요 macOS WKWebView 및 Chromium 좁은 화면 검사를 통과하고 검증되었습니다. Windows Test 실제 스타일; ～ 아니다 WKWebView 동등하다 iPhone 실제 기계。WSL 계정 관리는 아직 실험 중, 격리 휴직 API 구성 복구가 실제 백업 계정이 전체 프로세스를 통과했다는 의미는 아닙니다. |

공식 패키지의 5개 데스크탑 아키텍처 빌드, 설치 시작, 인증 페어링 및 업데이트 복구 확인은 다음 문서에 문서화되어 있습니다.[공식 제품 워크플로](https://github.com/try2love/codex-mobile-bridge/actions/runs/40205704812)。버전 간 업그레이드, 롤백, 정품 휴대폰 바인딩 및 공식 제품 재사용, 최종 자산 검증 결과는 다음을 참조하세요. [v2.1.5 릴리스 페이지](https://github.com/try2love/codex-mobile-bridge/releases/tag/v2.1.5)；워크플로 및 격리 수락이 모두 통과된 후에만 공개됩니다. Release。

업그레이드 확인은 공식 패키지의 격리된 복사본을 사용하며 일일 공식 버전 또는 Test 계정, 구성, 바인딩 및 초안。Windows 기본 임시 파일 및 허용 사본 제한 사항 F 디스크; 작동 중 시스템에 의해 잠긴 드래프트 저장소는 강제로 프로그램을 읽거나 닫지 않으며, 읽을 수 없는 파일은 바이트 단위로 비교된 것으로 선언되지 않습니다. 실제 채팅 메시지가 전송되지 않거나 모델이 수락을 요청하지 않습니다.。

**English:** v2.1.5 targets `3e90c8d`, retaining the original PR64/70 commits, official application identifiers and update-signing key. All seven tag CI checks passed; frontend/updater regressions retain their documented skips. Official Android signing is unchanged. Dedicated Android 35 and iOS 18.2 simulators passed 2.1.4 → 2.1.5 → 2.1.4 with settings and native/WebView trusted authentication retained. The official unsigned iOS artifact uses all three production identifiers; shared scripts and the 49-file source archive match the tag. This is not a new real-phone installation claim. See the linked build workflow and release page for official desktop artifacts, isolated cross-version upgrade/rollback and final asset verification; publication requires those gates to pass. Daily apps and data are not replaced, and Windows local temporary data stays on F:. Experimental WSL account tests do not establish real multi-account compatibility.

---

<a id="v215-pr70-integration"></a>

# v2.1.5 PR #70 파일 변경 요약과 통합（2026-10-25，현지의 Test）

나뭇가지 `fix/v2.1.5-pr70-integration`，최종 제품 제출 `e0e087a`。통해 merge 예약하다 PR #70 작가 lanchengjiu 원래 커밋 `d62002b`，UNC、경쟁 및 혼합 버전 웹 페이지 개정판을 보내고 별도로 제출하십시오. 밀리지 않았어 GitHub。내부 버전은 아직 2.1.4，정식 출시를 의미하지는 않습니다。

- PR #70 지속적인 초안 보호를 복원하기 위한 보내기 수정 사항은 이전 환경에 대한 회귀를 도입합니다. 즉, 입력을 유지하고 게이트웨이가 비커밋을 명시적으로 확인한 후 대기 또는 보충으로 전환할 수 있습니다. 네트워크 연결이 끊어지거나 기타 오류 및 결과를 알 수 없는 경우 계속 제출해 주시기 바랍니다. ID，자동 재생이 되지 않습니다. 동일한 제출에 대한 전송 시도는 차례로 등록되며, 늦게 거부하더라도 아직 진행 중이거나 결과를 알 수 없는 다른 탭의 시도는 제거되지 않습니다. 아직 열려 있는 이전 버전의 페이지에 나중에 작성된 확인되지 않은 기록은 무시할 수 없습니다. 조정이 불가능한 경우 기존 기록은 보수적으로 유지되며 명시적으로 거부된 후에도 새로운 비공개 요청은 계속 변경될 수 있습니다.。
- Windows 프로젝트 비교로 드라이브 문자가 완성됩니다.、UNC 확장된 경로 구분 기호 및 대소문자 처리; 솔직한 `//` 경로는 대상이 실행되는 플랫폼에 따라 명확하며 단일 슬래시입니다. POSIX 경로는 여전히 대소문자를 구분합니다.。SSH 게이트웨이 운영 체제를 기반으로 대상을 추측하지 말고 원본을 유지하십시오. cwd、host 네이티브 프로젝트 멤버와의 관계。
- “편집된 파일”카드에는 파일 경로와 새로운 추가 항목만 표시됩니다./요청하지 않고 줄 수를 삭제하고 패치 텍스트를 확장합니다.；125 각 파일은 전체 목록으로 나열되며 오래된 캐시 카드는 패치를 위해 다시 가져오지 않습니다. 원본 도구 프로세스 텍스트는 요청 시 계속 볼 수 있습니다. 누적된 수정 사항과 원래의 순 차이가 계속해서 구별됩니다.。

| 조사하다 | 결과와 경계 |
| --- | --- |
| 최종 프런트엔드 반환 | 1026 개：1025 통해、1 뛰어넘다。46 보낸 항목/초안 대상 확인에는 명시적 거부, 더블 탭 페이지의 늦은 반환, 웹 페이지의 혼합 버전, 사용 불가능한 저장 공간 및 계좌 번호가 포함됩니다./세션 격리, 인용 및 후속 초안 보호 |
| 백엔드 및 컴파일 모듈 | 최종 백엔드 코드 155 개：153 통해、2 Windows 독점 건너뛰기, 사용 Mac 컴파일된 모듈을 패키지화하고 로컬을 분리합니다. IPC/HTTP 집게. 마지막으로 웹 스크립트만 수정했습니다.，154 개인 Bridge 컴파일된 모듈은 승인된 후보와 하나씩 동일하므로 다시 컴파일할 필요가 없습니다. |
| 현실 Chromium | 문서 요약은 다음 위치에 있습니다. 390/1440px 흔한 24 목; 초안 사실 handler 합성 요청 포함 24 목; 최종 스크립트에 대한 이중 소스 문서 10 항목, 실제 최상위 탭 2개 4 항목, 혼합 페이지 7 항목이 통과되었습니다. 실제 채팅 메시지가 전송되거나 모델이 호출되지 않습니다. 브라우저 설비는 실제 전화 또는 실제 바쁜 작업 수락으로 간주되지 않습니다. |
| Mac Test | 최종 후보 오버레이 설치 및 자동 시작 8788；366 패키지의 웹 페이지 파일은 아카이브와 일치합니다，8 현실 HTTP 자원 매칭、7 조건 캐시 304。고정 개발 인증서는 재사용되며 이 적용 범위 이후에는 수동 키체인 인증이 없습니다. 공식 버전 문서/프로세스, 네이티브 클라이언트 프로세스, 원본 구성, 네트워크 자격 증명 및 원본 휴대폰 바인딩 보호 검사 통과 |
| Windows Test | 최종 설치 713 항목 파일을 하나씩 일치시키세요. 실제로 컴파일된 모듈을 설치합니다. 138 개：137 통해、1 건너뛰기, 관련 보내기 Node 46 아이템과 WSL/Claude 패키지 내 검사 통과。GUI 표시되고 수평 오버플로가 없으며 원래 사용자 세션이 시작됩니다. 8788，인스턴스 소유권이 정확함；8 실제 버전이 지정된 리소스 및 304 통과하다. 공식 버전/WSL Test、구성 및 효과적인 바인딩、7 원주민 DSH 프로세스 ID가 유지됨 |
| Ubuntu Test | 사용자가 설치한 후，723 설치 파일을 하나씩 일치시킵니다. DEB，dpkg 정상상태；59 프로젝트 패키지의 컴파일 모듈 회귀、Node 초안/보내다/인용하다、smoke/프로젝트 검사가 통과되었습니다. 원래 일반 그래픽 세션이 시작됩니다. GUI 및 8788 게이트웨이, 정상적인 인스턴스 소유권이 정확함；8 실제 버전이 지정된 리소스 해시 및 304 통과하면 최종 초안 모듈이 실제 리소스에 포함됩니다. 공식 버전, 자체 시작, 계정 구성, 원본 휴대폰 바인딩 및 1 원주민 Codex 프로세스 보류，Cloudflare 활성화 횟수는 여전히 0；원격이 아님 GUI 스크린샷 시각적 수용 |

산타이 Test 최종 제출된 동일한 소스 코드 아카이브 사용；Mac/Windows 마지막 웹 페이지 개정에서는 기본 입력이 변경되지 않은 상태로 유지되는지 확인한 후 허용된 컴파일된 구성 요소를 재사용합니다.。Windows 임시 파일 및 빌드 제품 제한 사항 F 그릇，Windows/Ubuntu 헤비 빌드 시리얼。Mac 대략 청소하세요. 1.71 GiB、Windows 대략 청소하세요. 2.15 GiB 논리적으로 크기가 지정된 현재 주기 반복 제품；Ubuntu 이번 라운드의 중복된 소스 코드, 압축 풀기 및 임시 디렉터리를 정리합니다. 세 끝 모두 최종 설치 또는 설치 패키지, 최종 소스 코드 아카이브 및 이번 라운드 이전의 아카이브를 유지합니다. `c0cc4a2` 사본과 필요한 기록을 롤백합니다. 청소 후 실행 및 유지 상태를 다시 확인하십시오. 추가 원본 고정 HTTPS 읽기 전용 정적 요청 반환 주소 Cloudflare HTTP 403，아직 이유가 확인되지 않아 공중망 진입이 받아들여졌다는 주장은 나오지 않고 있다. 입구가 수정되지 않았거나 출입 통제가 완화되었습니다. 레코드가 무시 디렉터리에 있습니다. `.tmp/v215-pr70-integration/` 및 `.tmp/v215-pr70-20261025/`。

**English:** PR #70 retains its author's original commit. The send-mode change restores behavior regressed by durable draft protection: only a definitive pre-submission rejection releases the corresponding attempts. Unknown delivery, concurrent tabs, older open pages and later draft edits stay protected. UNC comparisons preserve target-host semantics and original paths. Edited-file cards now expose paths and line counts without downloading patches. Final frontend and real-browser synthetic checks passed. Mac, Windows and Ubuntu Test are installed and running; installed files, live assets, configuration and bindings were verified. Ubuntu GUI process startup is not screenshot-based visual acceptance. Redundant build outputs were removed while retaining final artifacts and one pre-round rollback per platform. A supplemental public HTTPS probe returned Cloudflare 403; LAN acceptance passed and the existing network configuration was preserved. No GitHub publication or real model request occurred.

---

# v2.1.5 파일 변경 사항 요약（2026-10-25，로컬 소스 코드）

사용자 승인 피드백에 따라 파일 변경 카드는 파일 경로와 새 파일로 수렴됩니다./삭제할 행 수입니다. 확장하면 기존 목록만 표시되며 더 이상 패치 텍스트를 읽거나 표시하지 않습니다. 이상 50 전체 목록은 각 파일에도 보관됩니다. 페이지가 매겨진 카드, 세부정보, 이전 상태 응답의 파일 변경사항 metadata 더 이상 패치를 가지고 있지 않습니다. 원래 도구 프로세스 텍스트, 기본 세션 및 소스 파일은 그대로 유지됩니다. 네이티브 순 차이와“누적 수정”통계 소스를 통해 리텐션을 구별。

직접 검증: 백엔드 타임라인 22 품목 및 공개 예상 25 항목이 통과되었습니다. 프런트엔드 페이징, 메시지 세부정보 및 리소스 9 항목이 통과되었습니다. 현실 Chromium 프로덕션 자산 및 합성 데이터를 사용하여 내로우스크린 수행/와이드스크린 문서 카드 각각 12 항목, 원본 타임라인, 가시성 및 캐시 43 항목이 통과되었습니다. 확장, 축소, 다시 확장 및 통계 업데이트로 인해 패치 세부 정보 요청이 시작되지 않았습니다.；125 파일이 완전히 나열되고 큰 패치가 카드에 입력되지 않으며 일반 텍스트 세부 정보를 계속 읽을 수 있습니다. 비정상적으로 큰 단일 경로 목록은 원래의 단일 행 연결 규칙을 따르며 새 파일 목록 페이징 프로토콜은 추가되지 않습니다.。

이번에는 로컬 소스 코드만 수정되었으며 재컴파일이나 세 가지 플랫폼을 포괄하지 않습니다. Test；이전에 c0cc4a2 설치 승인은 이 요약 변경 사항에 대한 실제 시스템 승인으로 계산될 수 없습니다. 공식 버전, 구성, 계정 및 바인딩은 변경되지 않았습니다. 합격기록：`.tmp/v215-file-summary-pr70/`；푸시되지 않음 GitHub。

**English:** Edited-file cards now show paths and added/removed line counts only. Expanding a card never downloads a patch, including cards restored from older cache metadata. Timeline cards and public file-change metadata exclude patch bodies; original tool output and native state remain intact. Focused backend and frontend regressions plus 390/1440 px Chromium checks passed using synthetic data. This source-only revision has not been rebuilt or installed on the Test gateways.

---

<a id="v215-lifecycle-output"></a>

# v2.1.5 라이프사이클, 파일카드 및 휴대폰 재접속 개정（2026-10-25，지역 후보）

**개정 및 재점검：** 사용자는 다음 위치에 있습니다. iPhone 실제 테스트에서는 이를 거부함 `4927458` 참조 위치 및 파일 카드 결과, 단순화된 고정 장치의 첫 번째 버전 통과는 이러한 두 개의 실제 기계 통과를 계산하지 않습니다. 후속 제출 `c0cc4a2` 실제 입력 영역 줄 바꿈을 수정하고 native/saved 페이지 매김 병합의 생략; 실제 설치됨 Mac 8788 참조 레이아웃 및 원본 답변의 대화 페이지 재검증 9 파일 카드，Windows/Ubuntu 업데이트가 다시 정상화되었습니다. 실제 휴대폰은 아직 사용자 재테스트를 기다리고 있습니다.。

나뭇가지 `fix/v2.1.5-lifecycle-output-regressions`，제출한 제품 `4927458` 다음으로 개정됨 `c0cc4a2`，이전 라운드에서 승인된 프로젝트를 기반으로、WSL 세션과의 상호작용을 위한 후보자 밀지 마세요 GitHub。내부 버전은 아직 2.1.4，석방을 의미하지 않는다。

- 와이드 스크린 참조 버튼은 상황에 맞는 사용법을 따릅니다. 좁은 화면은 도구 모음 뒤에 있는 작고 독립적인 행을 사용하며 원래 버튼은 더 이상 줄 바꿈되지 않습니다. 입력 영역의 실제 너비에 따라 전환하고 화면 분할 및 창 확대/축소 시 선택 항목과 초안을 유지합니다. 축소된 참조는 한 줄만 표시하고 미리보기를 생략하며 원본 초안을 확장하고 유지합니다.。
- Codex 네이티브 `FileChange` 실행 프로세스가 숨겨져 있어도 완료된 내역 생성 라운드의 파일 변경 카드는 계속 표시됩니다. 기본 순차액이 우선 적용됩니다. 패치별 기록만 명시적으로 언급됩니다.“누적 수정”，척하지 않음 Desktop 최종 순 추가 및 삭제입니다. 페이징 경계에 전체 라운드가 없으면 로컬 합계가 생성되지 않습니다. 자세한 내용은 요청 시 세그먼트별로 계속 읽어볼 수 있습니다. 라운드에 해당하는 사용자 스크린샷의 읽기 전용 검증 9 파일이 없으면 메시지가 전송되지 않거나 모델이 호출되지 않습니다.。
- DSH 이전 버전의 확인된 액세스 스크립트를 마이그레이션하고 완료합니다. LF/CRLF 핑거프린팅, 보존 속성 및 구성 검증。Mac 강제 종료 후에는 빈 프로세스 컬렉션에 대해 더 이상 호출되지 않습니다. `ps`。Linux 별도로 처리 SSH 상위 프로세스에서 실행 경로를 읽을 수 없는 경우 상위 프로세스 보호 및 대상이 유지됩니다. UID、실행파일,생년월일、pidfd 엄격한 검증。
- Android 일치하는 기존 로그인 바인딩은 웹 페이지로 직접 이동하며 더 이상 백그라운드 직렬 네트워크 대기열을 기다리지 않습니다. 신원 불일치 복구는 여전히 서버에서 확인됩니다.。Android/iOS 초기 문서 로드에는 대기 및 재시도 항목이 제한되어 있습니다. 문서가 제출되면 웹페이지가 로딩 상태를 맡습니다. 채팅글은 재생되지 않습니다.。

| 조사하다 | 증거와 경계 |
| --- | --- |
| 전체 현지 반환 | 후방 2370 개：2288 통해、82 플랫폼/명시적 네이티브 건너뛰기; 프런트엔드 988 개：987 통해、1 건너뛰다; 최종 페이징 무결성 및 리소스 확인 31 개：30 통해、1 Windows 뛰어넘다 |
| 실제 브라우저 | 1440px 타임라인, 캐시, 가시성, 파일 카드 및 참조 69 목; 최신 파일 카드 추가 너비 주장, 너비/390px 모두 통과되었습니다. 합성 콘텐츠를 사용하고 오버플로 없이 스크린샷을 확인하세요. 첫 번째 버전은 단순화되었습니다 DOM 사용자 문제는 다루지 않습니다. 수정 후 전체 생산 입력 영역 복사，320/390/844/1440px、지역 확대/축소 및 초안 102 항목 통과, 동일한 설비 체크아웃으로 인해 이전 구현 실패 |
| 실제 세션 페이지 | `c0cc4a2` 설치 후 실제 B 대화 1440px 하단 인용 버튼은 컨텍스트 링 옆에 있습니다.，390px 다음은 도구 모음 뒤에 초안이 변경되지 않은 간단한 별도의 줄입니다. 원본페이지 페이지 항목, 원본답글을 통해 이력을 읽어보세요“편집됨 9 파일”카드가 나타나고 확장될 수 있습니다. 9 파일 경로, 휴대폰 너비에 가로 오버플로가 없습니다. 합성카드나 실제 휴대폰 수신이 아닙니다. |
| 실제 파일 카드 API | 현실 B 세션 원래 차례 7 페이지 읽기 반환 완료 9 파일 메타데이터, 연결은 계속 유효합니다. 저장된 패치의 총 개수는 다음과 같습니다. +206/−15，표시“누적 수정”；그것을 주장하지 마십시오 Desktop 스크린샷의 최종 순 차이 +199/−8 |
| Windows 네이티브 | 기존에 Windows 장치 실행 Python/Node 그리고 자체 구축된 프로세스가 픽스쳐를 종료합니다. 독립적인 프로세스와 관찰자가 살아남습니다. 진짜 오래된 스크립트 LF/CRLF 마이그레이션이 통과되었습니다. 공식적인/Test/WSL Test 설치 및 30 구성 보호 기록은 일관성이 있습니다. 빌드 및 설치 결과는 별도로 기록됩니다. |
| Windows Test 설치하다 | 개정 `c0cc4a2` 에서 F 디스크 직렬 빌드 및 덮어쓰기 설치，713 설치 파일이 일치합니다. 실제 설치 패키지 컴파일 모듈 125 개、WSL/Claude 83 항목이 통과됨；GUI、8788 건강 소유권과 8 실제 버전이 지정된 리소스/304 통과하다. 원래의 Test 구성, 계정, 바인딩 및 공식 버전/WSL Test 유지하다, 원본 Codex daemon 프로세스의 정체성은 변하지 않습니다. 게이트웨이를 정상적으로 종료하여 유휴 상태가 확인된 게이트웨이만 종료합니다. Claude 구현하다. 건강 재검사 후 제품을 약 1회 반복 시공하여 깨끗이 정리합니다. 1.65 GiB，설치자 및 승인 기록 유지 |
| Ubuntu 네이티브 | 271 개：270 통해、1 Windows 건너뛰다; 수리가 실패하기 전 고정 장치의 실제 종료, 수리 후 타겟이 종료되고 우회 프로세스가 유지됩니다. 공식적인/Test 구성, 바인딩, 자동 시작 및 프로세스 ID 보존 빌드 및 설치 결과는 별도로 기록됩니다. |
| Ubuntu 수정팩 | 사용자 설치 `c0cc4a2` 뒤쪽에，723 파일을 하나씩 일치시킵니다.（720 응용 프로그램 파일 및 3 개인 DEB 데스크탑/아이콘 파일）; 실제 설치 패키지 컴파일이 반환됩니다. 44 개：43 통해、1 Windows 뛰어넘다。8788 인스턴스, LAN 페이지 2회 200 그리고 다른 nonce、1 항목 버전 관리 CSS 해시시/304 검사 통과, 공식 버전, 계정 바인딩, 자동 시작 및 원본 비활성화 Cloudflare 상태가 유지되었습니다. 승인 실행 프로그램에서 처음으로 사용하는 임시 디렉터리가 너무 깁니다. Electron 단일 인스턴스 소켓이 실패했습니다. 시간을 단축하세요. GUI 프로세스의 임시 경로 이후에는 데스크톱 프로그램과 렌더링 프로세스가 1시간 이상 계속 실행됩니다. 3 몇 분 동안 게이트웨이가 다시 시작되지 않았습니다. 시스템 설정이 변경되지 않았습니다. 원격 Wayland 윈도우 화면은 아직 육안 검증이 완료되지 않았으며, 실행 중인 프로세스는 스크린샷 승인으로 간주되지 않습니다. |
| Mac Test | 완전한 오프라인 빌드, 서명 및 적용 범위 설치 패스，8788 상태 인스턴스 소유권이 정확합니다.；366 각 패키지의 웹 리소스는 소스 코드와 일치합니다.，8 현실 HTTP 자원 매칭、7 아이템 상태 캐시 304；패키지 내 컴파일된 모듈 106 확인하다，105 통해、1 플랫폼을 건너뛰었습니다. 공식 버전, 구성, 네트워크 설정 및 원본 바인딩 요약이 일관됩니다. |
| Mac 후속 개정 | `c0cc4a2` 모듈 컴파일 107 개：106 통해、1 플랫폼을 건너뛰었습니다. 설치가 시작되었습니다、8 실제 자원과 7 개 304 확인이 통과되었습니다. 동일한 코드의 로컬 Test 대신 기존 고정 개발 인증서를 사용하세요. 버전 간 designated requirement 일관된，81 개인 Mach-O 권한에는 변화가 없습니다. 사용자가 첫 번째 서명 전환 인증을 완료한 후 실제로는 정상적으로 다시 시작되고 자동으로 키체인을 읽고 새 게이트웨이를 시작합니다. 명령 약속을 시작해 0.10 몇 초 안에 반환된 다음 수동 인증을 다시 받을 필요 없이 상태 확인이 통과됩니다.。13 기본 클라이언트 프로세스, 공식 버전, 원래 구성 및 바인딩이 유지됩니다. 후속 로컬 빌드에서는 동일한 서명을 재사용하지만 서명이 실패하고 중단됩니다. 공식 패키지 서명이나 키체인 권한 규칙은 변경되지 않습니다. |
| 모바일 빌드 | Android 서명됨 APK 완벽한; 실제 추출 Android 탐색 방법 Java 고정 장치 확인 일치 바인딩이 점유된 대기열을 기다리지 않고 오래된 ID가 복원되지 않습니다.。iOS 독립적인 Test 서명된 오버레이 설치 및 실행，6 저장된 컴퓨터와 16 기본 설정은 바이트 단위로 일관됩니다. 키체인 토큰을 내보냈거나 직접 확인했다고 주장하지 않습니다. |

휴대폰이 실제 배경에 머문 후에도 체성감각 대기는 여전히 사용자에 의해 다시 테스트되어야 합니다. 기본 프로세스 검사는 자체 구축된 고정 장치를 사용하며 사용자가 사용 중인 클라이언트를 강제로 종료하지 않습니다. 기본 페이지 매김은 현재 스크린샷 라운드 반환에 순 차이가 없으므로 누적 패치 번호는 다음과 같습니다. Desktop 순 차이는 다를 수 있으며 인터페이스는 명확하게 차별화됩니다. 새로운 Test 시동이 통과된 후 오래된 것을 정리하십시오. Test 대략적인 빌드 디렉토리를 복사하고 복제하십시오. 0.99 GiB，소스코드 아카이브, 모바일 패키지, 승인 기록을 보관하세요. 수락 기록은 무시 디렉터리에 있습니다. `.tmp/v215-lifecycle-output/`。

후속 조치 `c0cc4a2` 합격 후 정리정돈 Mac ～에 대한 1.05 GB、Windows ～에 대한 1.77 GB、Ubuntu 이번 라운드의 총 금액은 약 1.62 GB 명시적 반복 페이로드（논리적 크기） 현재 설치, 원격 전류/설치 패키지, 소스 코드 아카이브 및 필요한 로그 보존 롤백。Mac 서명 도구가 로컬에 저장되는 문제 수정 `.local/test-apps/build-tools/`，공식 패키지에 포함되지 않은 임시 빌드 디렉토리로 정리되지 않았거나 GitHub。

**English:** Initial phone acceptance reopened quote layout and the missing edited-file card despite simplified fixture passes. Follow-up c0cc4a2 separates compact quote actions from the complete toolbar and retains saved file metadata when native paging exposes a partial completed turn. The installed Mac gateway now exposes the actual nine-file card through its paging API and real session page; quote placement was visually checked at 390 and 1440 pixels with the draft unchanged. Recorded patch totals remain distinct from authoritative net diffs. This candidate also covers owned DSH connector migration, macOS/Linux shutdown regressions, and mobile connection-entry scheduling. After the user authorized the local-only transition to the existing development signing identity, an actual Test restart retrieved its Keychain credential and started automatically without another manual authorization. Original client processes, permissions, configuration and bindings remain intact. Physical-device layout and resume latency still require user acceptance. No GitHub publication occurred.

---

<a id="v215-chat-feedback"></a>

# v2.1.5 프로젝트 및 세션 대화식 개정（2026-10-24，지역 후보）

나뭇가지 `fix/v2.1.5-chat-feedback`，설치된 것을 기준으로 `5e6dd00` Test。푸시 또는 병합 없음 main 또는 게시。

- Codex 새로운 네이티브 프로젝트 통과 App 디렉터리를 직접 등록한 후 채팅의 원래 프로젝트 소유권을 생성하고 확인하세요.；DSH 기본 작업 공간을 통해 ID 채팅을 만드세요. 디렉토리를 선택하는 것만으로는 등록이 시작되지 않습니다.。Claude 명시적인 작업 공간 신뢰 거부가 실행 가능한 프롬프트로 변경되었으며 첫 번째 메시지는 유지됩니다. 기타 알 수 없는 쓰기 결과는 재생이 금지된 상태로 유지됩니다.。
- Codex 완전한 메시지 참조; 현재 세션에 대해 승인된 이미지를 미리보기에서 원본 초안에 다시 추가할 수 있습니다.。DSH 잘못된 참조 항목을 숨깁니다. 파일 참조 태그는 기존 파일 권한에 따라 파일 이름을 표시하며 경로 액세스 권한을 확장하지 않습니다.。
- Claude Desktop Code、DSH 기본 기능을 사용할 수 있는 경우에만 표시됩니다.“여기에서 분기”，기본 메시지 경계를 사용하고 원본 초안을 유지하고 영수증 작성。Claude 현재 컨텍스트에서는 기본 요약만 사용됩니다. 가장 최근 요청 사용량은 별도로 표시되며 더 이상 현재 점유율로 사용되지 않습니다.。
- 위로 스크롤 기록은 상단 동작, 숨겨진 도구 기록 및 동시 실시간 재설정을 처리합니다. 단일 요청으로 최대 3페이지를 채울 수 있으며 읽기 앵커를 유지할 수 있습니다. 현실“국가고시에 지원할 수 있는 직위를 심사합니다.”세션에 대한 읽기 전용 인덱스 및 기본 후속 확인이 가능합니다. 355 기록; 모델이 활성화되거나 전송되거나 호출되지 않았습니다.。

| 조사하다 | 결과와 경계 |
| --- | --- |
| Node 프런트엔드 회귀 | 984 개，983 통해、1 플랫폼을 건너뛰었고 오류가 발생하지 않았습니다. |
| Python 방향 회귀 | 160 개，159 통해、1 Windows URL 런처 건너뛰기; 프로젝트 등록 영수증, 신뢰 거부, 분기, 컨텍스트, 파일 경계, 기록 및 리소스 매니페스트를 재정의합니다. |
| 현실 Chromium 브라우저 | 기존 타임라인/은닉처/시계 43 목; 새로운 좁은/와이드스크린 역사 및 참고 자료 20 목; 출력 상호작용 130 목; 합성 콘텐츠를 사용하며 실제 채팅 작성 인터페이스에 액세스하지 않습니다. |
| 현실 Electron 그림 상호작용 | 레이아웃 미리보기 55 목; 생산 Workbench、초안 및 첨부 파일 통합 54 개，390/1280px；전송되지 않았거나 HTTP 쓰기 요청 |
| Mac Test 설치 시작 | 제품 제출 `8ec4603` 오프라인 빌드, 서명 확인 및 적용 범위 설치 완료；366 각 패키지의 웹 페이지 리소스는 소스 코드와 일치합니다. 사용자가 키체인 시스템 확인을 완료한 후，GUI 쇼 실행 중、8788 인스턴스 소유권이 정확하며, 기존 LAN포털 홈페이지와 7 스크립트 일치、7 아이템 조건 캐시 반환 304。공식 버전 프로세스 및 파일, 원본 구성 및 휴대폰 바인딩 요약이 일관됩니다. 이번 라운드에는 업데이트되지 않았습니다. Windows/Ubuntu 설치 패키지 |
| 네이티브 인터페이스 증거 | 읽기 전용 로컬 확인 Codex、Claude、DSH 설치 패키지의 등록, 분기 및 컨텍스트 인터페이스. 격리 Codex 런타임 시 빈 채팅 확인 저장소 연결을 생성합니다. 이 확인은 데스크톱 사이드바의 전체 라이브 테스트와 동일하지 않습니다. |

실제 데스크톱 새 프로젝트 그룹화、Claude/DSH 네이티브 브랜치 및 사용자 지정 세션에 대한 컨텍스트 값은 여전히 ​​필요합니다. Test 실제 측정; 합성 인터페이스 검사는 네이티브 엔드투엔드를 통과한 것으로 계산되지 않습니다. 새로운 SSH Desktop 디렉터리에 아직 확인된 네이티브 프로젝트 등록 입구가 없습니다. 먼저 컴퓨터에 로그인해야 합니다 App 항목 추가; 기존의 SSH 프로젝트와 CLI 예약 생성。Claude Cowork 확인된 기본 분기 인터페이스가 없으며 이 작업은 표시되지 않습니다. 휴대폰 터치 및 시스템 입력 방식의 결과는 실제 기기에서 재테스트를 거치게 됩니다.。

기본 진단, 브라우저 결과 및 빌드 기록은 무시 디렉터리에 저장됩니다. `.tmp/v215-chat-feedback/`。공식 버전, 계정, 원래 세션 연결, 구성 및 휴대폰 바인딩은 변경되지 않으며 워크스페이스 신뢰가 자동으로 확인되지 않습니다.。

**English:** This local candidate fixes native project association, known Claude workspace-trust refusals, message/image reuse, native Code/Harness branching, context measurement semantics, and in-place history pagination. Frontend and targeted backend regressions pass, with real-browser synthetic coverage at narrow and wide widths. Installed native sources establish the interface contracts; native sidebar/branch behavior and the reported live context count still require user acceptance. No messages or model requests were sent, and no GitHub publication occurred.

---

<a id="v214"></a>

# v2.1.4 공식 출시 승인（2026-10-24）

제품 제출 후 `0f1934a`（상표 `v2.1.4`），역사적 읽기와 통제를 분리하는 수용된 변화를 수행합니다. 데스크톱 버전과 모바일 버전이 통합되었습니다. 2.1.4，Android/iOS 빌드 번호 37。PR #63 작가에 관한 모든 것 8 원본 제출물은 유지됩니다. 공식적인 애플리케이션 식별, 설치 ID、Android 서명 및 데스크톱 업데이트 확인을 위한 공개 키는 원본 버전과 동일하게 유지됩니다.。

| 범위 | 결과와 경계 |
| --- | --- |
| 전체 CI | Windows、Ubuntu 의 Python 3.9/3.13，macOS Python 3.13，그리고 데스크톱, 업데이터, 모바일 게시 및 다운로드 검사를 통과했습니다. 소스코드와 PR 모든 워크플로가 통과되었습니다. 구축된 워크플로는 각 기본 플랫폼에서 다시 테스트되었습니다. 수리하다 Windows Claude 과거 메타데이터에서 path stat/fstat 차이점과 고립 DSH 테스트의 시간 시뮬레이션을 종료하고 회귀를 완료합니다. |
| 포멀 데스크 백 | Mac arm64/x64 DMG、ZIP；Windows x64 NSIS、ZIP；Linux x64/arm64 DEB、AppImage 기본 빌드, 패키지 내 런타임 및 설치 시작 확인을 완료합니다.。Windows 6가지 물건을 모두 가져오세요 ConPTY 파일；Mac 중첩된 서명을 확인합니다. 5개 데스크탑 아키텍처의 주요 시작 리소스는 허용된 소스 코드와 일치합니다. |
| Mac 공식 업그레이드 | 로컬 격리 디렉터리는 공식적으로 2.1.3 서명된 패키지 실행 실제 업데이트 도우미、Electron 원래 게이트웨이를 다시 시작하고 다시 시작하고 다음으로 업그레이드하세요. 2.1.4 통과하다; 임시 실행 파일 주입이 누락된 후 자동 복원 2.1.3。원래 구성 값, 알림 구성 및 이전 QR 휴대폰 cookie 모두 유지됩니다. 일일 공식 버전 프로세스, 패키지 파일 및 Test 구성 바인딩 요약 일관성 |
| Windows 공식 업그레이드 | 실제로는 Windows 장비 F 디스크 격리 디렉터리, 게시됨 사용 2.1.3 ZIP 그리고 이번에는 2.1.4 ZIP 실제 업데이트 도우미 수행 Electron 다시 시작하세요. 일반 업그레이드가 통과되었습니다. 테스트 트랜잭션에만 속한 임시 실행 파일을 제거한 후 실패한 업데이트가 자동으로 복원되었습니다. 2.1.3。기존 QR 쌍 cookie 계속 지나가다 trusted 인증, 구성 및 알림 설정이 유지됩니다. |
| Linux 업그레이드 및 롤백 | 현실 Ubuntu 가상 머신에서는 공식적으로 DEB 페이로드 압축 풀기 2.1.3 → 2.1.4 → 2.1.3 스위치, 시작 및 원본 QR 바인딩 인증이 통과되었습니다. 본 항목은 사용자를 위한 정식 설치가 아닌 분리형 로드 스위치입니다. sudo 패키지 관리 롤백; 두 가지 아키텍처 DEB 설치 및 GUI/AppImage 다른 네이티브 시작하기 CI 검증 |
| 구성 마이그레이션 | 새 버전은 기존 LAN에만 해당됩니다. IP 해당 네트워크 카드를 보완하도록 선택 `lanInterfaces`；승인 확인을 통해 모든 이전 값이 필드별로 변경되지 않은 상태로 유지되고 새로운 선택이 시스템의 실제 네트워크 카드와 일치하는지 확인합니다. 오래된 상태를 유지하기 위한 대체 IP 필드에 있고 정상적으로 시작됩니다. 알림 구성 바이트는 변경되지 않고 그대로 유지되며 원래 바인딩 네임스페이스와 유효한 세션은 유지됩니다. 현재 공식 버전과 Test 패키지 및 영구 구성 다이제스트가 일관됩니다. |
| Android / iOS | Android 정식 서명 APK 독립하여 API 35 시뮬레이터 완료 2.1.3/build35 → 2.1.4/build37 → 2.1.3，최초 설치 ID, 컴퓨터 목록, 설정 및 기본/WebView 인증유지。iOS 정식 애플리케이션 및 확장 식별을 통해 장치 구성을 완료하고 독립적으로 iOS 18.2 시뮬레이터는 동일한 업그레이드를 완료합니다./대체, 컴퓨터 목록, 설정 및 기본/WebView cookie 인증은 유지됩니다. 재서명된 설치 사용자의 실제 시스템을 승인하는 것이 아닙니다. |
| 긴 휴대전화 세션 | 사용자는 다음 위치에 있습니다. Mac 8788 Test 원본 수정됨 HTTPS 입장, 확인 A/B 두 개의 긴 세션이 입력되면 최신 내용이 먼저 표시되고 이전 기록을 읽어 위치가 안정되며 위치가 목록으로 반환된 다음 재사용되며 모두 통과됩니다. 메시지나 승인이 필요하지 않습니다. |
| ID 다운로드 및 업데이트 | 14 배포 자산（서명된 업데이트 목록 포함） 및 SHA256SUMS 확인 및 승인됨, 합계 15 개인 Release 문서. 데스크탑 업데이트 매니페스트 서명 및 3가지 자동 업데이트 ZIP 크기와 SHA-256 원래 공개 키로 확인됨；GitHub 초안 자산 요약 및 현지 서신。iOS 세 개의 공식 로고와 Android 원본 서명이 확인되고 통과되었습니다. |

세 가지 플랫폼 Test 설치, 시작, 기본 페이징 및 구성 바인딩 보존 증거에 대해서는 다음을 참조하세요.[기록 및 제어 분할](docs/architecture/history-control-separation.md#test-설치-승인2026-10-24)。현실 A/B 세션 시간은 다음과 같습니다. Mac，Windows/Ubuntu 기본 합성 회귀는 이 두 세션의 실제 실행 환경을 가장하지 않습니다. 스크롤 없이 볼 수 있는 부분의 기록은 전체 제어 스냅샷을 기다리지 않지만 Desktop → 게이트웨이가 전체 금액을 전송하기 위해 처음으로 구독을 제어하는 ​​것은 여전히 ​​가능합니다. 네트워크는 기본적으로 폐쇄되도록 복원되며 제어된 주소 변경 테스트는 실제와 동일하지 않습니다. DHCP 임대전환。

지역 기록은 다음 위치에 있습니다. `.tmp/release-v214-20261024/`。Windows 임시서류 및 합격제품은 다음 장소에만 보관됩니다. F 그릇，Windows/Ubuntu 중작업 연속물; 테스트에서는 로컬 인증 장치가 포함된 격리된 구성만 사용하며 채팅 메시지나 모델 호출은 전송되지 않습니다. 기존 공식 버전, 원본 세션, 계정, 구성 및 휴대폰 바인딩을 유지합니다. 종료 후 이 라운드의 중복을 제거합니다. App 페이로드, 결과 유지, 해시 및 로그。

**English:** The product tag is fixed at `0f1934a`. Native CI covers macOS arm64/x64, Windows x64 and Linux x64/arm64, with official mobile identities and the existing Android/update signing keys. Isolated desktop upgrade/recovery and mobile simulator upgrade/downgrade checks verify original configuration values and trusted cookies. Linux rollback coverage is an extracted-DEB payload switch, not a system package-manager rollback. A/B long-chat reading was accepted by the user on the existing Mac Test HTTPS entry. Original desktop ownership and bindings remain intact; initial control subscription can still carry a full snapshot.

---

<a id="long-session-progressive-loading"></a>

# 긴 세션 프로그레시브 로딩 수용（2026-10-23，널리 알려지지 않은）

독립 지점 `perf/long-session-progressive-loading`，제품 후보 `898549c4054a48db8ce685df98f9fca1502e594c`，받아들인 것을 받아들인다 PR #63、Web 다음으로 복사 Issue #65 결정된; 버전이 남아있습니다 `2.1.4-preview.1`，푸시 없음, 병합 없음 main、게시되지 않음。

- 첫 번째 화면은 여전히 ​​최신 화면을 사용합니다. 20 기록을 표시합니다. 제거 및 개봉 후 자동으로 보충 100 기사요청. 로드된 레코드 상단 근처에서 위로 스크롤하거나“이전 콘텐츠 보기”페이지를 추가하고 읽기 위치를 유지하세요. 긴 텍스트와 도구 세부정보를 확장하고 별도로 읽어보세요.。
- 게이트웨이는 처음에 가장 최근의 내용을 읽습니다. 2 라운드를 저장하고 필요한 경우 누르세요. 5 보충 독서 라운드; 투영 초기 창을 가장 가까운 것으로 표시 40 스트립, 위쪽으로 돌릴 때 확장됩니다. 변경되지 않은 상태는 정규화 및 프로젝션을 재사용하고 쓰기 작업은 여전히 ​​실시간 인증 상태를 읽습니다.。
- Web 페이지가 살아있는 동안 가장 최근의 것을 유지하세요 8 대화, 각 최근 20 게이트웨이 로그인, 호스트 및 세션으로 격리된 스트립의 메모리 내 캐시입니다. 재입력 시 기존 텍스트가 먼저 표시됩니다. 완료되지 않은 백그라운드 로딩은 캐시를 지우지 않으며 실제 결과는 나중에 대체됩니다. 로그아웃하거나, 계정을 전환하거나, 게이트웨이 ID를 변경할 때 정리됩니다. 캐싱은 승인, 편집 권한 또는 초안을 복원하지 않으며 오프라인 데이터베이스도 아닙니다.。

| 수용 범위 | 결과 및 증거 |
| --- | --- |
| 백엔드 소스 코드 | `scripts/test-backend.py --source-only`：2,147 개，2,065 통해、82 뛰어넘어라. 이전 텍스트를 처리하지 않는 최근 프로젝션, 안정적인 커서, 증분 무효화, 반복 읽기 재사용, 정리하지 않는 원래 신뢰할 수 있는 상태 및 동시 세션에 대한 대규모 스냅샷 회귀를 포함합니다. |
| 프런트엔드 소스 코드 | Node 884 개，883 통해、1 건너뛰다; 브라우저 합성 테스트 43 항목 통과, 첫 화면 덮기 20 스트립, 주문형 페이징, 안정적인 위치, 스트리밍 교체, 만료된 응답 삭제 및 캐시 ID 경계 |
| Mac 기본 및 설치 패키지 | arm64 Test 전체 빌드, 패키지 내 컴파일된 모듈 18 설치 및 시작을 포함하는 기본 검사가 통과되었습니다. 원래의 14 유효한 바인딩, 네트워크 구성 및 생산 프로세스가 유지됩니다. 결정된 HTTPS 실제 리소스가 완료되었습니다. 390px 좁은 화면 30 아이템 구성 브라우저 확인 |
| Windows 기본 및 설치 패키지 | x64 Test 에서 F 적은 디스크 동시 오프라인 빌드; 전체 설치 706 파일 해시, QR 코드 종속성、GUI、패키지 내 컴파일된 모듈 18 아이템과 8788 HTTP 캐시 확인이 통과되었습니다. 원래의 4 개인 Test 바인딩 및 1 공식 버전은 바인딩되어 예약되어 있습니다. 기존 공통을 통해 Explorer 세션 설치, 새로운 예약 작업 없음 |
| Linux / Ubuntu | x64 DEB 713 독립적인 자체 시작 식별로 애플리케이션 파일을 확인하고 시뮬레이션하고 업데이트만 합니다. Test；패키지 내 컴파일된 모듈 18 항목은 진짜입니다 Ubuntu 실행이 통과되었습니다. 설치 후 716 패키지 파일（데스크톱 항목 포함） 및 DEB 사례별로 일관됩니다. 진정한 그래픽 창、8788 시작, 정적 리소스 캐싱 및 바인딩 보존 검사가 통과되었으며 기본 액세스가 비활성화되었으며 Cloudflare 구성이 남아 있습니다. |
| 약한 네트워크 | Windows Test 실제 로드된 페이지 스크립트，800 ms 네트워크 지연, 약. 1 Mbps 다운로드 조건 합성 메시지 캐시 0.4 ms 표시, 실제 읽기 전용 `/api/auth` 약속을 요청하세요 815 ms 돌아오면 업데이트됩니다. 채팅 콘텐츠에 대한 엔드투엔드 시간 소모적 벤치마크가 아님 |

현실 Mac A/B 수락은 모델 호출, 보내기, 복원 또는 세션 전환 없이 모두 수동 읽기입니다. 소스 코드 기준선 진행 중 B 의 27,810 스트립 디스플레이 투영 약. 2.92 초; 동일한 시스템의 초기 개정 샘플 40 조약 0.03 초, 변경되지 않은 경우 다시 정규화하지 않습니다. 설치 패키지를 다시 읽어보세요. B 가장 최근에 저장된 것을 가져옵니다 20 bar를 선택한 다음 기본 상태를 수신합니다. 실제 달리기 8788 HTTP 병렬로 읽기 A ～에 대한 0.07–0.19 두번째、B ～에 대한 0.39–0.81 두번째，B 켜다 100 조약 0.13 초, 이전 페이지와 첫 번째 화면이 겹치지 않고 커서가 그대로 유지됩니다. 이 세션은 계속해서 새로운 콘텐츠를 생성하며 녹음은 현재 측정값이며 고정된 네트워크 대기 시간이나 모든 사용자에 대한 엄청난 약속을 나타내지 않습니다. 일시적인 HTTP 접수 로그인은 로그아웃되었으며, 기존 휴대폰 바인딩은 유지됩니다.。

**Desktop 페이징 기능 경계：**머신이 설치되어 있는지 확인 Desktop 코드, 내부 `thread/turns/list` 및 `thread/items/list` 커서 페이징이 있습니다. 현재 게이트웨이 팔로우 채널은 전체 기록 요청 및 스냅샷 브로드캐스트를 노출하며 사용 가능한 페이징 매개변수는 없습니다. 이번에는 추측 호출이 없으며 전체 기록 요청을 트리거하거나 다음으로 전환합니다. CLI 원래 세션을 이어받습니다. 기본 전송은 여전히 ​​전체 스냅샷을 수신할 수 있습니다. 이번에는 첫 번째 화면 대기, 디스플레이 프로젝션 및 반복 처리 오버헤드를 줄인다고 주장하지 않습니다. Desktop 기본 전송이 페이징으로 변경되었습니다. 공유 연결이 유지됩니다. Issue #65 제한된 수신 보호。

추가의 Python 공공의 HTTPS 프로브는 Cloudflare ～에 의해 403/1010 거부됨; 해당 항목은 합격으로 간주되지 않습니다. 고정 도메인 이름의 브라우저 로딩 및 내로우 스크린 회귀（Narrow Screen Regression）를 통과했으며, 접근 보안 설정도 완화되지 않았습니다.。

원본 증거는 무시 디렉터리에 남아 있습니다. `.tmp/long-session-20261023/`：프로토콜 검증, 성능 샘플, 브라우저 결과, 각 플랫폼에 대한 빌드 목록 및 구성 바인딩 해시. 현재 상태만 유지 Test 패키지 및 필요한 기록을 설치하고, 기존 패키지를 교체하고, 반복 빌드 제품이 승인된 후 정리합니다. 휴대폰 공유 페이지는 원래 쉘을 변경하거나 휴대폰을 다시 설치하지 않고도 게이트웨이에 의해 업데이트됩니다. App；실제 휴대폰 경험은 사용자의 재테스트에 맡깁니다.。

---

<a id="issue65-large-desktop-snapshot"></a>

# Issue #65 그리고 크로스 플랫폼 Web 복사 접수（2026-10-23，널리 알려지지 않은）

나뭇가지 `fix/issue-65-desktop-ipc-session` 허용된 항목을 유지하세요. PR #63 및 Web 한 번의 클릭으로 변경사항을 복사하고 제품을 제출하세요. `16d6ef51ca42f3fe1da966db23c1f01833a1c35a`。데스크톱과 모바일 버전은 여전히 `2.1.4-preview.1`，푸시되지 않음 GitHub、병합되지 않음 main、게시된 업데이트가 없습니다.。

근본 원인은 읽기 전용입니다. IPC 프로브 확인: 사용자 지정 B 대략적인 세션 스냅샷 89 MB，기존 클라이언트 이상 64 MiB 수신 상한은 공유 연결의 연결 끊김을 유발하며, 이는 동일한 연결의 연결에도 영향을 미칩니다. A 세션. 찾을 수 없음“세션 링크는 다음으로 연결됩니다. A 점유하다 B 연결”증거. 수신 상한을 제한으로 변경 256 MiB，그리고 가장 1 MiB 덩어리로 읽으십시오. 아웃바운드 요청이 여전히 지속됨 64 MiB 한계. 원본 세션은 전송, 복원 또는 전환되지 않으며 전체 원본 스냅샷도 전화기로 전송되지 않습니다.。

| 범위 | 이번 라운드의 증거 |
| --- | --- |
| 반품 | 새로운 4 항목: 이상 64 MiB 스냅샷、Unicode、2세션 후속 증분, 페이징 볼륨, 샤딩된 읽기, 불법 길이 거부 및 아웃바운드 제한. 정위 Bridge 85 종 시앙 83 통해、2 뛰어넘다；CLI 41/41；플랫폼 14 종 시앙 11 통해、3 뛰어넘다；Web/네이티브 카피 8/8 |
| 현실 A/B | 소스코드 및 설치 Mac 패키지 컴파일 IPC/서비스 모듈은 모두 기본 읽기 전용 연결을 완료합니다. 후자 A 1.57 두번째、B 6.47 초, 두 사람은 연결된 상태로 유지됩니다.，B 최근의 20 약속을 잡으세요 12 KB；원래 대화 id/owner 성냥. 이후 실제 운영을 통해 Mac 8788 HTTP 인터페이스 재테스트：B 첫 번째 페이징 약. 7.05 몇 초, 후속 조치 A/B 모두는 connected、기존 id 일치, 복구 조치 없음, 각각 반환 20 약속을 잡으세요 12/94 KB。페이징 크기는 최신 채팅 콘텐츠에 따라 변경됩니다. 그럴 필요는 없다 89 MB 원본 스냅샷은 메시지 전송, 초안 변경 또는 모델 호출 없이 브라우저에 전달됩니다. 현재 시스템 및 세션에 대해서만 측정된 경과 시간 |
| Mac arm64 Test | 전체 빌드 및 서명 확인을 통과했습니다.，360 개인 Web 파일 일치. 컴파일 모듈이 설치됨 4/4；로컬 키체인이 확인된 후 정상 App 입장 시작 8788，실제 서비스를 통해 A/B 및 HTTP/HTTPS 원클릭 복사 수용. 공식 버전 프로세스 및 문서, 인증 및 모든 14 원래의 유효한 바인딩이 유지됩니다. 수동 조작 단계의 인터페이스 언어는 사전 주문 기준에서 영어로 변경되며 현재 선택은 유지됩니다. 다른 보호된 설정은 변경되지 않은 상태로 유지됩니다. |
| Windows x64 Test | F 전체 네이티브 빌드、NSIS 오버레이 설치，706 설치 파일 일치; QR 코드, 완료 ConPTY、독립적인 Test 데이터 및 자동 시작 검사를 통과했습니다. 컴파일 모듈이 설치됨 4/4；일반 데스크탑 GUI、8788 출시 및 버전 리소스 304 통과하다. 공식 버전, 원래 구성, 유효한 휴대폰 바인딩 및 사용자가 활성화한 네트워크 변경 감지 옵션이 유지됩니다.；GUI 오래된 고정물“문을 닫아야 해”전제가 수정되었으며, 갱신만 가능, 반복 설치 없음 |
| Windows 게이트웨이 Web | 실제 설치 서비스에서는 스크립트를 제공합니다.，macOS 현실 Chromium 입장 Windows 랜 HTTP 주소, 클릭 → 시스템은 중국어를 그대로 검증하여 붙여넣습니다.、emoji、여러 줄 문자, 지연 600ms 의 30,010 팝업 창의 문자 텍스트 및 소스 코드 기본 휴대폰 브리징 없음，`isSecureContext=false`、현대의 Clipboard API 존재하지 않으며, 수동 복사 창이 나타나지 않으며, 초안이 변경되지 않은 상태로 유지됩니다. 이 항목은 분명히 브라우저 클라이언트 액세스를 위한 것입니다. Windows 게이트웨이, 명의도용 금지 Windows 로컬 머신 Edge 아니면 실제 휴대폰 수용 |
| Ubuntu x64 Test | 네이티브 DEB 사용자가 이미 사용함 sudo 오버레이 설치，713 응용 프로그램 파일 및 3 아이템 패키지 관리 파일은 아이템별로 매칭됩니다. 설치 및 컴파일됨 IPC 4/4、실제 데스크탑 GUI、8788 스타트업, 리소스 immutable/304 그리고 원래 구성 바인딩은 유지되고 전달됩니다. 원본 유지 `localAccess=false`，승인을 위해 가상 머신 LAN 입구를 사용하십시오. 로컬 웹 페이지 액세스가 테스트용으로 열려 있지 않습니다. |
| Ubuntu 게이트웨이 Web | Ubuntu 실제 데스크톱에서 기존 것을 사용 Electron Chromium，샌드박스 및 웹 보안 설정을 꺼진 상태로 유지 Node 통합되어 있으며 기본 클립보드 브리징이 없으며 자동 권한 승인이 없습니다. 설치된 서비스에 액세스 HTTP 입력, 기본 마우스 클릭 → 시스템은 중국어, 여러 줄, 지연된 긴 텍스트 및 팝업 창 소스 코드가 단어 단위로 일치하는지 붙여넣고 확인합니다. 초안은 변경되지 않고 그대로 유지되며 수동 복사 상자가 없습니다. 수락에 사용된 브라우저가 종료되었습니다.，Test App 게이트웨이로 계속 실행 |

세 끝 각각은 대규모 스냅샷 수익의 기본 수신을 완료했습니다. 진실 A/B 원래 세션은 다음 위치에 있습니다. Mac，그러므로 Windows/Ubuntu 원주민의 IPC 합성 대규모 스냅샷 수용은 원래 세션 측정인 척하지 않습니다. 휴대폰의 기본 패키지는 업데이트되지 않았으며 사용자는 실제 휴대폰을 클릭하여 복사하여 계속 테스트할 수 있습니다.。

검색 종료 Mac 및 Ubuntu Test 둘 다 동일하게 활성화 Cloudflare 도메인 이름, 실제 HTTPS 요청이 반환되었습니다. Ubuntu 예를 들어, 결과적으로 Mac 단기 페어링 인증이 일치하지 않습니다. 사용자가 예약할 도메인 이름을 명시적으로 선택합니다. Mac：일반 제어 인터페이스를 통해서만 종료 Ubuntu Test 항목을 삭제하고 다시 시작하세요. Test 게이트웨이, LAN, 자격 증명, 기타 구성 및 원래 바인딩을 유지합니다. 정상적으로 저장하고 기본 네트워크 카드 선택을 명시적으로 기록합니다. `null`，여전히 자동으로 선택됩니다. 그런 다음 고정 도메인 이름은 다음과 같이 지속적으로 확인됩니다. Mac 예，HTTPS 원클릭 복사 및 재검사가 통과되었습니다. 수정 없음 DNS、공식 버전 또는 Mac 항목 구성。

설치 및 승인 후 오래된 것을 정리하십시오. Test 중복된 제품으로：Windows 1,271,041,272 바이트、Ubuntu 1,485,982,308 바이트、Mac 660,562,967 바이트（둘 다 파일의 논리적 크기이며 디스크에 릴리스된 실제 크기가 아님） 현재 설치된 상태 유지 Test、Windows/Ubuntu 최신 설치 패키지, 소스 코드 아카이브, 구성 바인딩 및 필요한 승인 기록。Windows 제품은 항상 거기에 있습니다 F 디스크, 빌드 Ubuntu 시리즈로 진행하세요. 청소 후 공식 버전과 원본 제본을 다시 확인하세요.。

로컬 빌드 및 승인 증거는 다음 위치에 저장됩니다. `.tmp/issue65-20261023/`，Windows 모든 해당 파일은 다음 위치에 있습니다. F 그릇. 이번 라운드에는 휴대폰 네이티브 패키지에 대한 업데이트가 없습니다.；Web 사본은 검증된 공유 구현 및 기본의 이전 라운드를 따릅니다. App 적응. 운영 체제나 브라우저에서 클립보드 쓰기를 명시적으로 거부하는 경우에도 수동 회피가 유지되며 권한 우회가 요구되지 않습니다.。

**English:** Issue #65 was reproduced as an oversized Desktop snapshot closing the shared IPC stream. The bounded receive budget is now 256 MiB with 1 MiB reads; outbound limits remain unchanged. All three Test installations passed native IPC, startup and preservation checks. Actual A/B sessions were verified through the running Mac gateway without sending or activating turns; Windows/Linux used native synthetic large-snapshot regressions. Browser copy/paste passed against Mac HTTP/HTTPS, Windows HTTP from macOS Chromium, and Ubuntu HTTP in a sandboxed native Electron browser. The user's shared Cloudflare hostname was isolated to Mac by disabling only the Ubuntu Test entry as explicitly authorized. Original bindings remain valid, redundant Test artifacts were removed, and no code was pushed or released.

---

<a id="web-clipboard-one-click"></a>

# Web 한 번의 클릭으로 현지 승인 복사（2026-10-23，널리 알려지지 않은）

나뭇가지 `fix/web-clipboard-one-click` 수락 된 것에서 PR #63 통합 제출 `f0bbdad` 이번 라운드의 네트워크 복구 기능을 유지하려면 새로 생성하세요. 제품 제출 `76ef57e`、`4680695`；네이티브 궁극기 Test 패키지 소스코드는 `46806959d8940470ebfff5051cb507d7542a7c8e`，버전은 아직이네요 `2.1.4-preview.1`。푸시되지 않음 GitHub、병합되지 않음 main、게시된 업데이트가 없습니다.。

- 공통 재현 및 수정 Web 그냥 시도해 보세요 Clipboard API、근거리 통신망 HTTP 수동복사창에 직접 들어가는데 문제가 있습니다. 읽은 텍스트는 클릭 한 번으로 즉시 복사되고 전체 텍스트가 전달됩니다. Promise ClipboardItem 원래 동작은 유지되며 호환 가능한 경로는 원래 초점과 선택을 복원합니다. 읽기 실패 또는 브라우저 거부는 성공을 의미할 수 없습니다. 하단 창에서는 다시 시도할 수 있는 새로운 클릭을 제공합니다.。
- Node 방향 회귀 **158 모든 항목 통과**，포함하다 8 항목 복사 사용 사례, 페이지가 매겨진 텍스트 및 버전 확인、Claude/DSH 기본적으로 신뢰할 수 있는 클릭 브리징, 리소스 화이트리스트 및 부팅 복구. 기본 클립보드 스크립트는 변경되지 않습니다.。
- 현실 Chromium 안전 loopback、일반 LAN HTTP、결정된 HTTPS 입력완료 버튼을 클릭하세요 → 시스템 붙여넣기 확인. 메시지, 지연된 전문, 코드, 전체 화면 Mermaid 소스 코드는 중국어로 유지됩니다.、emoji 그리고 개행；HTTP 명시적 검증 `isSecureContext=false`、`navigator.clipboard` 존재하지 않더라도 복사할 수 있습니다. 초안 내용은 변경되지 않습니다.。
- 390px 좁은 화면으로 일반 메시지, 지연된 텍스트, 코드 복사 완료；1280×800 브라우저 완료 Markdown 15 개、Mermaid 전체 화면 22 품목검사. 첫 번째 대형 창에서 전체 화면 설비는 크기 조정 후 패닝 가능해야 한다는 전제 조건을 충족하지 못했습니다. 표준 창을 제한한 후 통과했으며 크기 조정이나 드래그 논리는 변경되지 않았습니다.。
- Mac arm64 독립적인 Test 제작, 덮고 시작됨 8788。360 패키지 Web 파일은 소스 코드 아카이브와 일치하며 패키지의 서명과 QR 코드가 확인됩니다. 결정된 HTTPS 새로 고친 후 최종 스크립트가 로드됩니다. 공식 버전 프로세스/파일, 네트워크 설정, 원본 Test 구성 및 **12 유효한 로그인 바인딩 기록**변함없이 남아있다。
- Mac、Windows、Linux 이번에는 게이트웨이가 공유됩니다 Web 소스 코드; 이번 라운드에서만 업데이트됨 Mac Test。Windows/Ubuntu 설치 패키지、Android/iPhone 네이티브 App 재설치되지 않음；Chromium 좁은 화면은 동일하지 않습니다 iPhone Safari 또는 Android 브라우저 실제 기계 수용. 브라우저나 시스템에서 자동 복사를 명시적으로 금지하는 경우에도 백업 작업을 사용해야 합니다.。

로컬 로그 및 빌드 매니페스트는 다음 위치에 있습니다. `.tmp/web-clipboard-20261023/`、`.tmp/web-clipboard-final-20261023/`，임시 파일이나 구성, 자격 증명, 바인딩 데이터를 커밋하지 않습니다.。

**English:** local one-click Web clipboard support covers direct and delayed text, LAN HTTP compatibility, modal source copying and a fresh-click retry. All 158 targeted tests passed, with real Chromium copy/paste checks over loopback, LAN HTTP and the fixed HTTPS entry. The Mac 8788 Test was rebuilt and started with configuration, binding records and the formal app preserved. Other native packages were not rebuilt, and physical Safari/Android-browser acceptance remains separate.

---

<a id="pr63-network-adaptation"></a>

# PR #63 선택적 네트워크 복구 로컬 수용（2026-10-23，널리 알려지지 않은）

나뭇가지 `feature/pr63-network-adaptation-opt-in` 기반으로 `v2.1.4-preview.1`（`4c251de`），병합하여 유지 [@qybgh](https://github.com/qybgh) 의 [PR #63](https://github.com/try2love/codex-mobile-bridge/pull/63) 모두 8 원본 제출물; 별도로 제출된 개정판。Test 패키지 소스 코드는 다음과 같이 고정됩니다. `11bbba74b81d88c6b6a46a29f3eaf60da953d4ca`，버전은 아직이네요 `2.1.4-preview.1`，푸시되지 않음 GitHub、병합되지 않음 main、게시된 업데이트가 없습니다.。

- ”네트워크 변경으로부터 자동 복구”는 기본적으로 꺼져 있습니다. 데스크톱 게이트웨이의 ”네트워크 액세스” 및 로그인 후 Web/모바일 애플리케이션 관리 → ”게이트웨이 연결” 공유 즉시 저장 스위치; 꺼지면 배경 네트워크 카드가 시작되지 않습니다./경로 변경 모니터. 스위치는 별도로 저장되며 일반 구성 형태에서는 방금 휴대폰에 저장된 값을 덮어쓰지 않습니다. 저장 결과를 알 수 없는 경우 읽기 및 검토만 수행되고 쓰기에 대한 재생은 수행되지 않습니다.。
- 활성화한 후 플랫폼 네이티브 이벤트를 사용하고 30 두 번째 저주파 바텀아웃（bottom-out）, 단기 이벤트를 병합하고 주소가 안정화될 때까지 기다립니다. 같은 IP 갱신하면 다시 바인딩되지 않습니다. 바인딩 실패는 상한 백오프를 사용하며 실제로 성공적으로 모니터링된 주소만 게시됩니다.。
- 보정 Windows 네트워크 카드 구조 및 IPv4 주소 오프셋; 오래된 IP 여러 네트워크 카드와 이전 필드를 유지하면서 항목별로 고유한 네트워크 카드 ID로 마이그레이션을 선택합니다. 마이그레이션은 명시적으로 시작된 경우에만 저장되며 상태별로 디스크를 읽거나 쓰지 않습니다. 모호한 일치는 액세스 범위를 확장하지 않습니다.。
- Quick Tunnel LAN 주소 변경으로 인해 재구축이 직접 실행되지는 않습니다. 라우팅 변경은 먼저 복구 시간을 허용한 다음 현재 자체 프로세스의 로컬 준비 끝점을 확인합니다. 연속 클리어 실패 후 제한된 재구성이 필요하며 냉각 시간이 있습니다. 알 수 없는 상태 결과는 실패로 간주되지 않습니다. 고정 도메인 이름 터널、Tailscale 등. 여전히 원래 복구 메커니즘을 사용하고 있습니다.。

| 범위 | 현재 증거 |
| --- | --- |
| 완전한 소스 코드 반환 | Python discovery 2,127 개：2,046 통해、81 뛰어넘어라. 프런트 엔드 876 개：875 통해、1 뛰어넘어라. 최종 마이그레이션, 제어 및 네트워크 개정은 별도로 다시 테스트됩니다. 로컬 모니터링을 금지하는 첫 번째 샌드박스 체크를 모니터링 허용 후 통과했으며, 테스트를 우회하도록 제품 코드를 수정하지 않았습니다. |
| 네이티브 플랫폼 | Mac 기본 경로 모니터 생성/가까이 다가가다；Windows、Ubuntu 각 80 플랫폼 열거, 런타임, 실제 루프백 모니터링 주소 변경 및 연결 끊김 복구, 인증 제어, 이전 구성 마이그레이션 및 연결 해제를 다루는 대상 테스트를 통과했습니다. Quick Tunnel 전략 |
| 브라우저 | 현실 Chromium 중국어-영어 인터페이스, 와이드스크린 및 390px 휴대폰 뷰포트: 기본적으로 닫힘, 쓰기 없이 열기, 단일 전환 및 단일 쓰기, 멀티플렉싱 설정、CSRF、응답 손실, 알 수 없는 상태 동결 및 측면 오버플로 통과 후 읽기 전용 확인 |
| Mac arm64 Test | 새로운 고정 백엔드 통과 25 시작 및 중지를 포함한 항목 루프백 및 로컬 제어 확인/지속성 및 종합적인 신뢰할 수 있는 모바일 세션 보존을 다시 시작합니다. 덮고 시작했습니다 8788；실제 App 스위치가 활성화되지 않았는지 확인하고 해결되었습니다. HTTPS 포털은 실제 브라우저에 로그인 페이지를 표시합니다. 공식 버전 프로세스/파일은 변경되지 않고 원래 로그인 세션도 유지됩니다. 오직 Test 이전 LAN 선택이 추가되었습니다. `lanInterfaces`，원래 필드가 유지됨 |
| Windows x64 Test | 전체 기능이 포함된 새로운 고정 백엔드 NSIS 패키지가 덮어쓰기되어 설치되었습니다.，706 아이템 페이로드, QR 코드, 완료 ConPTY、F 디스크 데이터 포인터 및 독립 Test 자동 시작 확인을 통과했습니다. 일반 데스크톱 세션의 현실 GUI、새 스위치는 기본적으로 꺼져 있습니다.、8788 시작 및 버전 리소스 immutable/304 합격; 공식 버전, 원래 구성 및 유효한 휴대폰 로그인 기록이 유지됩니다.。GUI 리뉴얼 검증은 창 가시성 확인 스크립트만 수정했을 뿐, 제품 소스코드 재설치나 수정은 하지 않았습니다. |
| Ubuntu x64 Test | 새로운 동결된 백엔드 및 독립형 DEB 위에 설치됨，713 아이템 적용 로드 및 3 패키지 관리 파일 일치. 실제 GUI、새 스위치는 기본적으로 꺼져 있습니다.、8788 시작 및 정적 리소스 캐싱을 전달합니다. 원본을 유지하다 `localAccess=false`，실제 모니터링되는 LAN 입구는 웹페이지 승인을 위해 사용되며 테스트를 위해 구성이 수정되지 않습니다. 공식 버전, 원래 구성 및 유효한 휴대폰 로그인 기록이 유지됩니다. |
| 휴대폰 | 기존 사용 Android/iOS App 게이트웨이 공유 로드 Web 제어, 네이티브 코드 또는 앱 ID 변경 없음. 이번 라운드의 휴대폰 레이아웃은 다음과 같습니다. Chromium 뷰포트 승인, 가장 없음 Android/iPhone 실제 머신 터치 수용 |

격리된 구성, 루프백 수신 및 제어된 네트워크 카드를 사용하여 테스트/라우팅/터널 이벤트 확인 DHCP 주소 교체, 동일 IP 사용자의 실제 네트워크 카드를 수정하거나 해제하지 않고도 갱신, 네트워크 단절 복구 및 장애 복구가 가능합니다. DHCP 공식 네트워크를 임대하거나 중단하십시오. 휴대폰에 저장된 오래된 파일 IP 게이트웨이 복구로 인해 자동으로 새로 생성되지는 않습니다. IP；새 주소를 사용하거나 코드를 다시 스캔하거나 도메인 이름 연결을 안정화하면 원래 인증 및 바인딩이 유지됩니다. 실제 물리적 네트워크 절단 및 휴대폰 교차 IP 현재 라운드별 재접속 Test 계속해서 측정하세요。

Windows 빌드와 임시 제품 모두 F 접시, 와 Ubuntu 가상 머신 구성은 순차적으로 수행됩니다. 기존 종속성은 재사용되며 새 소프트웨어는 설치되지 않습니다. 접수 후 정리 Mac 오래된 Test 그리고 반복되는 중간산물은 대략 841 MiB、Windows 반복되는 빌드 파일의 이번 라운드는 약입니다. 1.10 GiB（파일 논리적 크기별），Ubuntu 이번 라운드의 반복곱은 대략 1.34 GiB（할당된 공간으로）. 현재 설치된 상태 유지 Test、오직 NSIS/DEB 설치 프로그램, 소스 코드 아카이브, 매니페스트 및 로그 위의 구경은 다르며 세 끝에서 실제 해제된 공간의 정확한 합계가 아닙니다. 자세한 현지 증거는 다음 위치에 있습니다. `.tmp/pr63-integration-20261023/`，구성, 자격 증명 또는 빌드 제품을 커밋하지 마세요.。

**English:** this local, unpublished integration preserves all eight original PR #63 commits and adds default-off network recovery controls shared by desktop and authenticated Web/mobile clients. Native event monitoring, bounded fallback/retries, adapter migration and conservative Quick Tunnel recovery have targeted regression coverage on Mac, Windows and Linux. All three installed Test gateways passed startup, visible GUI and preservation checks; Windows and Ubuntu also verified versioned asset caching. No real DHCP lease or physical network was changed. Mobile viewport tests are distinguished from physical-device acceptance, and saved old-IP client addresses still require an updated address or stable hostname.

---

<a id="v214-preview1"></a>

# v2.1.4-preview.1 복구 접수 시작（2026-10-22）

시험판 지점 `release/v2.1.4-preview.1` 기반으로 main `de7b840`，통합 `fix/issue-62-startup-recovery` 개정이 승인되었습니다. 데스크탑/모바일 출시 버전 `2.1.4-preview.1`，휴대폰 빌드번호 36；iOS 시스템 버전 2.1.4。애플리케이션 식별, 서명 ID, 데이터 디렉터리 및 바인딩 형식은 변경되지 않습니다. 이번 라운드에는 병합되지 않았습니다. main，v2.1.3 안정적인 채널 유지。

| 범위 | 승인된 결과 |
| --- | --- |
| 스타트업 및 리소스 | Node 회귀 적용 범위, 제한된 리소스 재시도, 엄격한 실행 순서, 조기 다운로드, 지원되지 않음 preload 대체、CSS 예외, 시간 초과 취소 및 지연 결과를 읽습니다. 현실 Chromium 생산 자원 및 설비의 적용 범위가 좁습니다./와이드 스크린, 동적 효과 감소, 지속적인 리소스 장애, 외부 통계 스크립트는 CSP 가로채기, 기본 클립보드 타이밍, 런타임 예외 및 알 수 없는 결과 페어링 |
| Mac / Cloudflare | 독립적인 8788 Test 설치 후 수정 Cloudflare HTTPS 입구; 이 차가운 짐 6.87 초, 열기 반복 1.43 두번째，55 자원 재사용 캐시. 이는 셀룰러 속도 약속이 아닌 네트워크 측정입니다. |
| Windows x64 | 독립적인 Test 완전히 설치됨 707 하나씩 일치하는 파일（포함 ConPTY），현실 GUI 게이트웨이가 시작됩니다. 업그레이드 후 이전 캐시 덮어쓰기 0.50 초 사용 가능、48/54 자원 재사용 다시 열어 0.34 두번째、54/54 재사용 |
| Ubuntu x64 | 독립적인 Test DEB 의 745 응용 프로그램 파일 및 3 패키지 관리 파일 일치，GUI/게이트웨이 시작이 통과되었습니다. 업그레이드 후 이전 캐시 덮어쓰기 0.79 두번째、48/54 재사용; 반복해서 열다 0.42 두번째、54/54 재사용 |
| 캐싱 및 보존 | Windows/Ubuntu 의 gzip、ETag 304、콘텐츠 버전 immutable、오래된 해시 no-cache、HTML no-store 통과했으며 런타임 예외가 없습니다. 공식 버전의 파일과 구성은 변경되지 않고 각 끝 부분에 원본이 있습니다. 3 조각 Test 로그인 기록 보관；Mac Test 원래 구성과 바인딩도 유지됩니다. 그런 다음 사용자는 테스트가 통과되었음을 확인합니다. |

위 구현 승인은 소스 코드 지문을 사용합니다. `0c1d7b6e1ca79269c02eef0b7ad36c688f40a5527fe07eb4de3121cae542fe46`，Test 내부 버전은 다음과 같습니다. 2.1.3；후방/네이티브 소스 코드와 v2.1.3 동일합니다. 검증된 공식 네이티브 런타임을 사용하고 모든 후보를 다시 패키징합니다. Web 의지. 이를 바탕으로 이번 프리릴리즈에서는 버전과 문서만 통일되었으며, 퍼블릭 패키지는 네이티브로 제작되었습니다. CI 완전한 빌드, 이전 빌드를 대체할 수 없음 Test 패키지를 공개 미리 보기 설치 패키지라고 합니다. 테스트에서는 알 수 없는 페어링이나 메시지 쓰기가 아닌 초기 읽기 전용 인증만 재시도합니다.；CSP 편안하지 않음。

**English:** accepted macOS, Windows and Ubuntu Test installations verified startup, resource caching and settings/binding preservation before the preview version bump. Windows/Ubuntu old-cache upgrades reused 48/54 resources, followed by 54/54 on repeat visits. Timings describe the measured connections, not a universal mobile-network guarantee. Test artifacts and public preview artifacts are distinct; the public packages are built separately by native CI. No main merge or stable-channel replacement is part of this preview.

---

## v2.1.3 릴리스 승인（2026-10-22）

이 버전은 허용된 캐시와 Windows 패키지 최적화、Mermaid、PR #51/#52、PR #40 쿼리 수명 주기 및 여러 대상 Webhook，휴대폰 팝업, 초점 및 답변 카드 위치에 대한 수정 사항도 포함됩니다. 데스크톱 버전과 모바일 버전이 통합되었습니다. 2.1.3，Android/iOS build 35；업데이트된 공개 키 상속、Android 서명과 iOS 공식 신청서 식별。

- 이 기계는 완성되었습니다 Python discovery：2,057 개，2,018 통해、39 플랫폼별로 건너뛴 항목 기존 네이티브 포함 macOS 집게. 프런트 엔드：849 개，848 통해、1 건너뛰다; 업데이터：33 개，32 통해、1 뛰어넘어라. 첫 번째 프런트엔드 실행을 위한 두 가지 항목 loopback 샌드박스에서 모니터링을 거부하였고, 로컬 모니터링을 허용한 후 동일한 코드가 전달되었습니다.。
- 모바일 업데이트 옵션：Java/Swift 둘 다 통과했습니다. 다운로드 및 설치 복구가 각각 통과되었습니다. 14、47、38、26、23 목. 자료 게시 및 체크리스트 확인 8 항목이 통과됨。
- Windows CI 원래의 실패는 2단자 격리 테스트가 출력 파일이 생성된 직후에 출력 파일을 읽는 것이었습니다. 통제된 Windows 픽스처가 파일이 존재한다는 것을 확인할 때 내용은 비어 있을 수 있습니다. 개정판은 후속 완료 표시를 기다리고, 원본 콘텐츠와 두 번째 터미널이 아직 살아 있다는 주장을 유지하고, 시간 초과를 연장하지 않으며, 제품 터미널 구현을 수정하지 않습니다. 이미 Windows Python 3.11 타겟 개정 재검사 20/20 합격; 원래 실패는 기준선에 없었습니다. 20 자연스러운 재현. 이번 라운드는 완료되었습니다 GitHub CI 의 7 다음을 포함한 모든 작업이 통과되었습니다. Windows Python 3.9/3.13、macOS Python 3.13、Ubuntu Python 3.9/3.13，데스크톱 및 모바일 확인（실행 39656034549）。
- Android API 35 에뮬레이터 대 iOS 18.2 시뮬레이터는 공식 애플리케이션 로고 아래 완성됩니다. 2.1.2 → 2.1.3 설치 재정의; 컴퓨터 목록, 현재 컴퓨터 및 Cookie 네임스페이스 예약됨, 실제 WebView/기본 인증은 업그레이드 전에 신뢰할 수 있는 합성 세션을 사용하므로 다시 로그인할 필요가 없습니다.。Android 원본 서명과 빌드 번호를 유지하세요. 34 → 35；iOS 동일 build 35。이 항목은 격리 시뮬레이터 업그레이드의 증거이며 새로운 공식 패키지 실제 기계 승인과 동일하지 않습니다.。
- 태그에 고정된 공식 빌드 `v2.1.3`（`fa483c4545d773b5d0e6002d2d20842f75ac1e0f`）。[릴리스 빌드 39658137984](https://github.com/try2love/codex-mobile-bridge/actions/runs/39658137984) 의 8 모든 작업이 통과되었습니다. macOS arm64/x64、Windows x64、Linux x64/arm64 및 iOS。데스크탑 패키지는 해당 기본 아키텍처를 기반으로 구축되었습니다.；Mac/Windows 패키지는 실제 창, 로그인 페어링, 업데이트 및 롤백 확인을 완료합니다.，Windows NSIS 항목화 페이로드를 설치하고 패키지 내에서 기본 터미널 검사를 실행합니다.，Linux DEB 설치 및 AppImage 포장 풀기 및 시작 모두 통과됨。
- Windows 공식적인 ZIP 잠긴 버전이 포함되어 있습니다. `1.25.260930003` 의 6 개 ConPTY 요소; 언어 리소스는 예약되어 있습니다. en-GB、en-US、zh-CN、zh-TW。각 데스크톱 패키지의 업데이트 공개 키는 소스 코드와 일치합니다.；Windows PEM 의 CRLF 차이점은 정규화되었으며 DER 공개 키 비교를 통해 키가 변경되지 않았음을 확인합니다.。Android 공식적인 APK 재실행 aapt/apksigner，원본 서명, 패키지 이름、2.1.3/build 35 모두 합격；iOS IPA 주님 App 두 가지 확장 기능이 포함된 공식 로고를 사용하고, 패키지의 모바일 스크립트는 소스 코드와 일치합니다.。

| 보충격리 수용 | 결과와 경계 |
| --- | --- |
| Mac arm64 | 게시된 사용 2.1.2 ZIP 그리고 이 공식 ZIP，이전 버전 업데이트 프로세스의 실제 교체, 재시작 및 오류 주입 롤백을 완료합니다. 4가지 구성은 바이트 단위로 변경되지 않으며 업그레이드 전에 생성된 신뢰할 수 있는 휴대폰 Cookie 업그레이드 및 롤백 후에도 유지됩니다. 새 패키지가 게이트웨이를 통해 정지됨 115 개 Webhook 루프백 확인 |
| Windows x64 | CI 의 NSIS 설치, 창 실행, 터미널, 업데이트 및 롤백 통과; 사용자 장치 F 접시 위의 현실 2.1.2 → 2.1.3 격리 업데이트 트랜잭션도 통과했고, 오류 주입 후 이전 패키지가 복원되었으며, 4개의 구성 원본 바이트와 원래 신뢰할 수 있는 휴대폰 바인딩이 유지되었습니다.。SSH Session 0 거래 결과는 일반적인 데스크톱 상호 작용을 가장하지 않습니다. GUI 수락, 후자는 기본으로 구성됩니다. CI 씌우다 |
| Ubuntu x64 | 사용자의 기존 가상 머신에 있는 별도의 디렉터리에서 압축을 풀고 실행합니다. 2.1.2 → 2.1.3 → 2.1.2；원본 바이트와 이전 바이트의 4가지 구성 QR 신뢰할 수 있는 바인딩이 유지되고 새로운 고정 게이트웨이가 통과됩니다. 115 개 Webhook 루프백 확인. 이 항목은 버전 전환 호환성 검사로 시스템 수준인 척하지 않습니다. dpkg 업그레이드 또는 다운그레이드 진짜 DEB 위의 네이티브에 의해 설치됨 CI 씌우다 |
| Android / iOS | 시뮬레이터의 공식 로고는 업그레이드 및 기존의 신뢰할 수 있는 세션 인증을 다루고 있으며 범위는 위와 같습니다. 사용자는 이전에 독립적이었습니다. iPhone Test 이 버전의 휴대폰 팝업 창, 포커스 및 응답 상자 위치가 수정되었는지 확인하세요. 이 피드백은 공식적으로 언급되지 않습니다 IPA 실제 기계 서명 및 승인 |

～ 위에 115 항목은 각 플랫폼에서 재검사되는 동일한 프로토콜 고정 장치이며 다른 기능 항목으로 누적되지 않습니다. 모든 새로운 알림 수락 라운드는 루프백 수신기를 사용하며 메시지는 실제 로봇으로 전송되지 않습니다. 일일 공식 버전、Test、계정 구성 및 휴대폰 바인딩은 파괴적인 테스트를 대상으로 하지 않습니다. 실행 기록은 로컬에 저장됩니다. `.tmp/release-v213-20261022/`，임시 데이터, 자격 증명 및 설치 패키지는 소스 코드를 제출하지 않습니다.。

공식후보[완전한 소스 코드 CI 39658147614](https://github.com/try2love/codex-mobile-bridge/actions/runs/39658147614) 7 모든 항목 통과。Mac 첫 번째 미션 라운드 GitHub 액추에이터 용량이 부족하여 확보되지 않았습니다. runner 그리고 취소, 테스트를 우회하기 위해 제품 코드 수정 없이 별도의 메이크업 실행 후 통과。15 초안 첨부 파일이 에서 제거되었습니다. GitHub 다시 다운로드，GitHub 자산 요약、14 파일의 체크섬과 세 가지 데스크탑 업데이트 페이로드의 서명 목록이 모두 통과되었습니다. 다운로드한 체크섬 파일은 로컬 독립 정렬 결과와 일치했습니다. 버전 번호, 애플리케이션 ID, 모바일 빌드 번호 및 기여자 기록이 통합되었습니다. 릴리스는 모든 승인 결과가 통과된 후에만 공개됩니다.。

**English:** v2.1.3 uses native CI builds for both macOS and Linux architectures, Windows x64, and official iOS identifiers. All seven source CI jobs and eight release workflow jobs passed. Additional isolated checks exercise the actual 2.1.2 → 2.1.3 update and injected-failure rollback on Mac/Windows with retained configuration and trusted sessions; Linux bundle switching is distinguished from CI DEB installation, and mobile simulator upgrades are distinguished from physical-device acceptance. Fifteen draft attachments were downloaded again and verified against asset digests, all fourteen file checksums and the signed desktop update manifest. Everyday formal/Test profiles are preserved.

<a id="webhook-multi-target-acceptance"></a>

# 여러 대상 Webhook 휴대폰 팝업을 통한 현지 승인（2026-10-22，널리 알려지지 않은）

데스크톱 게이트웨이 후보는 다음과 같습니다. `70ed6efdf71cc642dd2627c9da9cc046eea1b50e`。모바일 포커스 개정 `d2020b18e45d` 설치 후 진지한 상호작용 회귀 피드백을 받아 독립된 브랜치로 분기하게 되었습니다. `bugfix/issue60-ios-input-recovery` 의 `6acebf9556e9` 철회하다; 후보자 전체를 복원하다 `mobile/` 소스코드와 `70ed6ef` 같은. 게이트웨이 리소스는 변경되지 않았습니다. 버전은 아직이네요 `2.1.2`、휴대폰 빌드번호 `34`；푸시되지 않음 GitHub，아직 새 버전이 출시되지 않았습니다.。

이 라운드에서는 동일한 유형 또는 다른 서비스의 여러 서비스가 완료됩니다. Webhook、독립적인 대상 편집 및 전송, 프로세스 간 저장 보호, 저장된 활성화 상태, 컴팩트한 작업 레이아웃 및 휴대폰 기본 메뉴가 팝업 창을 대체합니다. 이전 단일 대상 구성 및 자격 증명은 유지됩니다. 일반적인 읽기 둔감화, 활성 보기 및 테스트는 선택한 대상으로 제한됩니다.。

| 범위 | 현재 증거 |
| --- | --- |
| 소스 코드 | Python 201 종 시앙 199 통해、2 건너뛰다; 데스크탑/Web Node 840 통해、1 뛰어넘어라. 첫 번째 Node 두 가지 루프백 서비스 테스트 실행에는 샌드박스 포트 제한이 적용되므로 루프백 통과 후 지시된 재실행이 허용됩니다. 복구 후보 전화 스크립트 33/33 통해 |
| 패키징 백엔드 | macOS、Windows、Ubuntu 얼어붙은 관문은 모두 같은 길을 지나간다 115 아이템 리얼 루프 HTTP/5가지 서비스 계약, 서명, 인증 및 CSRF、둔감화, 다중 표적 추가, 삭제, 수정, 유효하지 않은 표적 거부 및 교차 프로세스 가시성; 이번 라운드에 대한 수락 메시지는 실제 로봇으로 전송되지 않습니다. |
| 인터페이스 | 실제 브라우저 검증 데스크톱 900px、휴대폰 390px 중국어 및 영어 레이아웃, 수평 오버플로 없음; 선택 및 피어 추가, 주소 보기 피어 및 하위 작업 그룹화를 구성합니다. 다중 대상 상호 작용 및 팝업 메뉴 신호 검사 통과 |
| macOS arm64 | 독립적인 Test 교체하고 시작했습니다 8788，실제 창 레이아웃이 확인되었습니다. 공식 버전, 구성 및 휴대폰 바인딩 보호 검사를 통과했습니다. |
| Windows x64 | 빌드, 임시 파일 및 승인이 모두 포함되어 있습니다. F 디스크; 독립적인 Test 위에 설치됨，705 설치 파일은 후보자와 일치하며 정품입니다. GUI 및 8788 시작 확인을 통과했습니다. 공식 버전, 구성 및 바인딩이 유지됨 |
| Ubuntu x64 | 사용자가 오버레이 설치를 완료한 후，715 파일은 고정된 패키지와 일치하며 사실입니다. GUI、8788 시작, 정적 리소스 캐싱 및 공식 버전/설정/바인딩 보호 검사 통과 |
| iOS | 사용자 확인 `70ed6ef` 팝업 창“더”콤팩트한 레이아웃의 입구。`d2020b1` 오버레이 설치가 유지됩니다. 5 그러나 사용자들은 파란색 상자가 사라진 후 세션이 입력 방법을 활성화할 수 없고 클릭이 응답하지 않는다고 보고했습니다. 수정안은 승인되지 않았으며 철회되었습니다. 복구 패키지가 설치를 덮어쓴 후，5 컴퓨터 연결 및 기본 설정이 다시 확인되었습니다. 사용자 확인 세션 버튼과 일반 입력 상자가 복원되었으며, 답변 상자의 키보드 이후 위치 및 목록 반환 하이라이트가 개별적으로 수정되었습니다. |
| Android | 새로운 APK 그것은 지어졌습니다. 원래 패키지 이름, 버전 및 서명은 일관됩니다. 패키지의 공유 스크립트는 소스 코드 바이트와 일치합니다. 이번 라운드에는 연결되지 않았습니다. Android 실제 기계 |

철회된 초점 개정은 실제로 Chromium 버튼 윤곽과 입력 모드 전환을 확인하지만, 이 확인은 실제 사항을 놓치고 있습니다. WKWebView 대화식 터치, 키보드 팝업 및 클릭 링크는 완전한 사용성을 지원할 수 없습니다. 현재의 Chromium 터치 컨트롤은 여전히 ​​초점을 맞추고 클릭을 실행할 수 있으며 아직 사용자의 클릭을 재현하지 못했습니다. iPhone 잘못; 전체 페이지 터치 모니터링으로 인한 루트 노드 스타일 변경은 확인된 근본 원인이 아니라 확인이 필요한 이유입니다. 사용자가 롤백 확인 후 정상 입력 및 버튼 복구。

이후 3개의 독립적인 지점에서 개정됨：`8665e05` 컴팩트 레이아웃의 목록을 반환한 후에만 세션 선택 배경을 지우고 호버가 아닌 장치의 목록 호버 배경을 제한합니다. 와이드스크린 현재 세션 ID가 유지됨。`6964f48` 기본 모바일 키보드가 뷰포트를 변경하면 현재 답변 카드가 속한 스크롤 영역만 수정됩니다. 포커스가 전송되지 않고 초안이 수정되지 않으며 터치 또는 입력 이벤트가 차단되지 않습니다.。`22a9744` 계정 관리, 타사 알림 및 애플리케이션 관리 제목에 대한 초기 초점을 설정하고 버튼을 유지합니다. Tab 탐색, 일반 팝업 창 또는 입력 처리를 수정하지 않습니다.。

모바일 스크립트를 통한 새로운 개정 36/36、계정/항해/팝업창/리소스 및 레이아웃 Node 132/132、Web 의지 Python 8/8。현실 Chromium 3개의 클라이언트 컴팩트 터치 항목/와이드스크린 선택과 동일한 상태로 돌아갑니다. 6 장면이 전달되었습니다. 답안 상자는 안에 있어요 844→500px 뷰포트가 변경된 후에는 입력 없이 가시 영역에 들어가 원래 초점을 유지합니다. 반복되는 이벤트, 초점이 맞지 않는 항목, 일반 입력 상자 및 부분적으로 보이는 긴 답변 상자는 스크롤되지 않습니다. 팝업 종합 페이지 확인의 초기 초점이 버튼에서 제목으로 변경되었습니다. 추가 제출 `3173754` 이러한 비대화형 헤더 자체에서 브라우저 기본 개요를 제거하기만 하면 됩니다. 최종 생산 CSS 독립 리뷰: 세 제목 모두 개요가 없습니다.，Tab 뒤로 버튼에는 여전히 키보드 포커스 상자가 표시되며 입력을 터치하여 중국어를 입력할 수 있습니다. 위 내용은 브라우저 및 소스코드 증거로 대체될 수 없습니다. iPhone 실제 머신 키보드 애니메이션 및 버튼 색상 수용。

후속 후보 `2e4d7f87e4f013ddce9f613ecf4421ff3212951a` 컴파일된 Mac Test、징후 iOS Test 및 Android APK。Mac 독립적인 Test 덮고 시작했습니다 8788，공식 버전의 프로세스, 구성 및 바인딩 검증은 변경되지 않습니다.；5 수정 설치됨 Web 파일은 소스코드와 일치하며 실제 홈페이지는 런타임시를 제외하고는 안전합니다. nonce 외부적으로 일관되고 유지됨 no-store，세 개의 스크립트/스타일의 내용은 다음과 같습니다. 304 재검증이 통과되었습니다. 로컬 웹 포털은 원래 구성에 따라 닫힌 상태로 유지되며 원래 LAN 포털은 자산 승인에 사용됩니다.。iPhone Test 설치 덮어쓰기 및 시작，5 컴퓨터 연결 및 모든 기본 설정은 동일합니다. 그 후 사용자는 목록반환, 팝업버튼, 답안카드 동작이 기본적으로 정상인지 확인하고, 나머지 복귀버튼은、Webhook 방금 채팅에 들어간 주소창과 입력창에는 여전히 파란색 테두리가 남아 있고, 색상 승인이 모두 통과된 것으로 기록되지 않습니다.。Windows/Ubuntu 아직까지는 받아들여졌는데 `70ed6ef`，이번에는 오직 Mac/휴대폰에 설치된 코어의 후속 개정은 원격 끝이 업데이트됨에 따라 기록됩니다.。

나머지 파란색 박스는 독립된 가지 `bugfix/issue60-mobile-control-focus` 두 개의 알림 팝업 창 제목의 초기 초점만 조정하고 기본 휴대폰 호스트의 제어 스타일을 추가합니다. 기본 파란색 터치 강조 표시를 끄고 중립 가장자리 초점 프롬프트를 유지하며 기본 버튼에 고대비 내부 링을 사용합니다. 정상 Web、터미널 보조 입력 및 검사 제어는 이 규칙의 영향을 받지 않습니다. 수정 없음 `mobile/`、터치 듣기, 키보드 처리 또는 초안 로직。Node 50/50 및 자원 Python 5/5 통과하다; 완전한 생산 CSS 얕은/어두운 × 네이티브 모바일 호스트/평범한 Web 총 4가지 현실 Chromium 총알 창의 초기 제목을 포함하여 장면이 전달됩니다.、Tab 탐색, 터치 클릭 및 중국어 텍스트 삽입. 브라우저 승인에서는 기본 버튼 스타일 우선순위가 충분하지 않은 것을 발견하고 컴파일하기 전에 이를 수정했습니다. 이 증거는 확인되지 않았습니다 iOS 처음 채팅에 들어갈 때 실제 초점 소스는 실제 휴대폰과 동일하지 않습니다. IME 결합된 입력 수용. 후보자 `95153e59f7d8` 컴파일만 Mac Test；iOS/Android 네이티브 패키지 상속 `2e4d7f8`。 Mac Test 설치 및 시작됨 8788，3 변경된 각 리소스는 소스 코드와 일치하며 홈 페이지는 적시에 새로 고쳐지고 스타일이 지정됩니다. 304 재검증이 통과되었습니다. 공식 버전 파일 및 프로세스, 원래 구성 및 휴대폰 바인딩 확인은 변경되지 않습니다.。iPhone 다시 설치할 필요가 없으며 컴퓨터 목록으로 나가서 원본을 입력하십시오. Mac 다시 테스트하기 위해 연결하면 색상 결과가 사용자 확인을 기다리고 있습니다. 설치 및 승인 후 청소 14 아이템주기 반복제품 및 구형제품 Mac Test 패키지, 논리 파일 크기 약. 1.30 GiB（같지 않음 APFS 실제 여유 공간）; 현재의 DMG、설치됨 App、휴대폰 테스트 패키지 원본 및 기록 보유。

사용자 쌍 `95153e5` 피드백은 나머지 문제를 더욱 차별화했습니다.：Webhook 현재 구성에는 여전히 파란색 확인란이 있고, 새 세션 닫기 버튼과 일반 채팅 입력 상자에는 회색 프레임이 있으며, 입력 중에 보충 답변 상자가 계속 활발하게 이동합니다. 독립 지점 `bugfix/issue60-mobile-focus-residual` 의 `84a5849` 할 것이다 Webhook 영구 선택 스타일을 다음과 같이 중립 채우기 및 가중치로 변경합니다. Codex/Claude/DSH 제목의 초기 초점을 지정하기 위해 새로운 팝업창을 생성하고 기본 휴대폰 일반 채팅 입력 상자의 추가 개요만 취소합니다. 입력 상자 테두리와 커서가 유지됩니다.。`bugfix/issue60-answer-focus-once` 의 `4847b4d` 답안 카드 수정은 초점당 1회 이하로 제한: 첫 번째 1 몇 초만 기다리세요 120ms 안정적인 뷰포트, 입력, 중국어 조합 입력, 수동 터치/휠이 굴러가거나 초점이 맞지 않으면 보류 중인 수정 사항이 취소됩니다. 강제 아웃 포커스, 입력 차단, 초안 수정 또는 전체 페이지 터치 스타일 전환이 없습니다.。

통합 후보 `0af8fb61cabc` 의 Node 163/163、의지 Python 5/5 통과하다. 이전 구현에서 지속적인 키보드 크기 변경의 사용 사례는 먼저 두 번째 교대를 재현하고, 새로운 구현과 실제 Chromium 격리 고정 장치는 첫 번째 필요한 수정이 스크롤 위치를 한 번만 기록하고 후속 입력 및 뷰포트 변경 사항이 더 이상 이 보조 로직에 의해 스크롤되지 않음을 확인합니다. 브라우저 자체의 포커스 스크롤은 비활성화되지 않습니다. 생산 CSS 선택을 확인하려면 확인하세요. Webhook 외부 프레임 없음, 팝업 창 제목 초기 초점 만들기, 일반 휴대폰 입력 상자에 추가 윤곽선 없음, 기타 컨트롤은 일반과 동일 Web 포커스 스타일은。Mac Test、iOS Test 및 Android APK 모두 빌드되었으며, 서명 및 변경된 리소스가 동결된 소스 코드와 일치하는지 확인되었습니다.。Mac 8788 해당 시작, 공식 버전 파일/프로세스, 구성 및 바인딩 보호 검증 통과；4 설치됨 Web 파일, 실제 홈페이지와 3개의 정적 리소스 콘텐츠 및 304 재검증 통과。iPhone 독립적인 Test 설치 및 시작됨，5 PC 연결 및 지속성 기본 설정은 동일하며 현재 Mac 연결의 마지막 열린 시간이 업데이트됩니다. 그런 다음 사용자는 이 후보를 완성합니다. iPhone 재시험, 피드백“이제 이런 문제는 사라진 것 같습니다”；이를 토대로 본 피드백 범위에 해당하는 항목을 선정합니다./초점 프레임, 답안 카드 이동 및 기본 입력 클릭은 실제 측정값으로 기록되며 재현되지 않습니다. 이는 모든 장치 또는 시나리오에서 검증되었다는 사실로 추정되지 않습니다.。Android 실제 기계 연결 없음，Windows/Ubuntu 이 포커스 후보는 다시 로드되지 않습니다. 설치 및 인수 후 청소 18 항목이 중급 및 기존과 중복됩니다. Mac Test 패키지, 논리 파일 크기 약. 1.43 GiB；현재 설치되어 있음 App、DMG、iOS App、APK 합격 기록을 보관하세요。

지역 기록은 다음 위치에 있습니다. `.tmp/issue60-feedback-20261022/`，자격 증명이나 전체 구성을 제출하지 않고도 아카이브 및 설치 패키지 해시, 구성 보호 요약, 스크린샷, 정리 목록이 포함됩니다.。Mac 및 Windows 교체되는 것 Test 패키지 및 중복 빌드 제품이 정확한 경로에 따라 정리되었습니다. 현재 설치된 패키지, 설치됨 Test、서명 자원 및 필요한 수락 기록이 유지됩니다.。Ubuntu 설치 및 승인 후, 이전 DEB/AppImage 반복되는 중간 생성물의 경우 약 2000만 달러의 회수율이 발생합니다. 1.16 GiB，현재 설치 패키지, 압축을 푼 검증 사본 및 공유 캐시를 유지합니다. 중점 후속 개정 설치 확인을 통과한 후, 결함이 있는 휴대폰 패키지를 삭제하고, 후보 및 이전 버전을 폐기합니다. Mac 대략적인 추가 복구와 함께 패키지를 설치하고 중간체를 반복하십시오. 2.35 GiB；최신 상태를 유지하다 DMG/iOS App/APK，사용자가 마지막으로 확인한 휴대폰 패키지는 물론 기본 입력을 복원해 새롭게 개정된 실기 승인을 기다리고 있습니다.。

**English:** packaged gateways on macOS, Windows and Ubuntu passed the same 115-check loopback suite, followed by Test installation, GUI, startup and preservation checks. The user accepted iOS modal-menu and layout behavior, but reported that the subsequent touch-focus change prevented conversation input and interaction. That change failed acceptance and was reverted; all five saved computers and preferences remained intact, and the user confirmed normal input and buttons recovered. Three separate follow-ups address compact-list selection, focused answer-card visibility after keyboard resizing, and initial focus for selected management dialogs. The `2e4d7f8` candidate passed source and Chromium checks and was built for Mac, iOS and Android. Mac 8788 and the independent iPhone Test were upgraded and launched with preservation checks passed; the user accepted the interaction follow-ups while reporting remaining blue control outlines. A CSS-only mobile-host follow-up plus initial headings for notification subdialogs passed four light/dark browser scenarios and preserves keyboard focus visibility; native iPhone color acceptance remains pending. Windows/Ubuntu remain on the previously accepted gateway candidate. No GitHub push or release occurred.

The latest local candidate, `0af8fb61cabc`, removes the persistent Webhook selection outline and extra native-composer ring, starts new-chat dialogs on their heading, and bounds answer-card positioning to one initial correction. Typing, IME composition and manual scrolling cancel pending repositioning. Targeted Node checks (163), resource checks (5), and isolated Chromium scenarios passed. Mac 8788 and the existing iPhone Test were upgraded and launched; five saved computers and persistent preferences were preserved, with only the current connection's last-opened timestamp advancing. Android was built and signed. The user subsequently reported that the previously observed problems seemed absent on the iPhone retest. The reported outline, answer-card positioning and basic interaction cases are therefore recorded as no longer reproduced in that test, without extending the result to all devices or scenarios. Windows and Ubuntu were not upgraded to this focus-only candidate.

---

<a id="webhook-local-acceptance"></a>

# Webhook 서비스 기본 로컬 승인（2026-10-22，널리 알려지지 않은）

마지막 설치 라운드의 후보 소스 코드는 다음과 같습니다. `e766d406cea87d9e2f0a962a765e675564ec2239`，지점은 `feature/issue60-webhook-notifications`，기반으로 main `d900c02`。Issue #60 만능인 Webhook 이번 라운드에서는 일반 사용자 정의, Feishu 및 DingTalk로 채널이 보완됩니다.、Discord、Telegram 편집 가능한 템플릿, 사용 가능한 필드 설명, Feishu 옵션/DingTalk 서명, 서비스 업무 응답 확인 및 저장된 주소 숨기기/보다; 기존 알림 정책, 중복 제거 및 재시도를 상속합니다. 버전은 아직이네요 `2.1.2`、휴대폰 빌드번호 `34`；푸시되지 않음 GitHub，생성되지 않음 Release。

첫 번째 라운드 `76867ec` 범용 루프백 수신기 검사를 통과했지만 사용자가 실제 Feishu 테스트에서 메시지를 받지 못했습니다. 이번 승인 검증: 원래 GM JSON 얻다 HTTP 200 / 사업 코드 19002，비즈니스 코드를 얻으려면 Feishu 텍스트 형식을 수정하세요. 0，사용자는 메시지 수신을 확인합니다. 따라서 이번 서비스 계약에 따른 응답 확인 과정에서 Feishu는 더 이상 서비스를 제공하지 않습니다. HTTP 200 이는 직접적으로 수락 통지로 간주됩니다. 첫 번째 범용 수신기 결과는 Feishu 호환성의 증거로 사용되지 않습니다.。

| 범위 | 이번 라운드의 증거 |
| --- | --- |
| 백엔드 및 인터페이스 | 이번 개정안 채택 공고/데스크탑 Python 70 아이템, 데스크탑/Web JS 118 아이템, 인증 및 CSRF HTTP 3 아이템; 기본 템플릿 마이그레이션 재정의, 사용자 정의 텍스트 보존, 두 가지 서명 알고리즘, 키 보존/바꾸다/청산, 사업실패 판단 및 활성 주소 확인 |
| Web / 휴대폰 공유 인터페이스 | 390px 실제 Chromium 통과하다 24 확인하다；1200px 데스크탑 제작 페이지 조정 종합 IPC 통해 22 품목검사. 5가지 사전 설정, 서명 필드, 주소 숨기기를 포함합니다./보기, 잘못된 입력, 실패한 초안 보존 저장 및 저장된 구성 테스트만 가능합니다. 수평 오버플로 없음 |
| 세 가지 플랫폼 패키징 게이트웨이 | macOS arm64、Windows x64、Ubuntu x64 같은 그룹이 통과함 76 아이템 리얼 루프 HTTP 확인: 인증、CSRF、둔감화 및 주소 적극적 읽기, 중국어 JSON、각 서비스 및 사업 실패에 대한 Feishu의 기본 형식, 독립적인 계산/딩톡 시그니처、Discord 확인하고 Telegram chat_id；실행 후 격리 게이트웨이가 중지됩니다. |
| macOS arm64 | 새로운 Test DMG/ZIP、게이트웨이 및 서명 확인이 통과되었습니다. 오래된 Test 교체됨, 원래 구성 및 바인딩 유지，8788 정상적으로 시작됩니다. 실제 창에서 서비스 선택 및 저장 상태를 확인하였습니다. 설치된 게이트웨이는 저장된 구성을 통해 승인된 Feishu 로봇에 테스트를 보내고 Feishu는 승인 성공을 반환합니다. 공식적인 8787 프로세스 및 구성은 변경되지 않습니다. |
| Windows x64 | 모든 빌드, 임시 및 승인 파일은 다음 위치에 있습니다. F 디스크, 낮은 우선순위 단일 작업 빌드; 설치 후 705 각 페이로드 파일은 품목별, QR코드별, 실물별 후보 품목과 일치함 GUI、5가지 서비스 구성、8788 시작 및 정적 리소스 검사가 통과되었습니다. 설치 디렉토리는 대략 450 MB，포함하다 ConPTY；공식 버전, 구성, 신뢰할 수 있는 모바일 세션, 자체 시작 항목 및 실행 DSH 모두 예약됨 |
| Ubuntu x64 | DEB/AppImage 빌드 패스; 사용자 재정의는 독립적으로 설치됩니다. Test DEB，715 각 설치 파일은 후보와 일치합니다. 진실 GUI、Webhook 제어 및 8788 게이트웨이 시작이 통과되었습니다. 공식 버전 파일 및 프로세스, 구성, 신뢰할 수 있는 바인딩 및 독립성 Test 자체 시작 ID 보존 |
| Android / iOS | 이 서비스 기본 및 주소 보기 전용은 게이트웨이 공유 인터페이스를 수정하며 원래의 독립 휴대폰을 사용할 수 있습니다. Test，로드하려면 연결을 다시 엽니다. 첫 번째 서명 라운드가 생성되었습니다. Android APK，그리고 설치를 덮어쓰고 독립적으로 시작합니다. iPhone Test，12 항목의 저장된 기본 설정은 일관되게 유지됩니다. 이번에는 기본 전화 케이스가 다시 컴파일되지 않습니다. Chromium 휴대폰 사이즈 검사는 실제 휴대폰 접수와 동일합니다. |

76 검사는 세 가지 플랫폼 각각에서 실행되는 동일한 기능 검사이며 서로 다른 기능에 대한 테스트 수를 합산하지 않습니다. Feishu는 설치된 게이트웨이의 새 버전으로부터 확인 및 서비스 응답을 수신하도록 실제 로봇을 승인했습니다. 딩톡、Discord、Telegram 이 라운드는 기본 프로토콜 수신자 확인을 사용하며 실제 계정을 획득했다고 주장하는 배송 확인은 없습니다. 사용자가 실제로 본 서비스 수락과 알림은 별도로 기록됩니다. 새로 실행되지 않음 GitHub 풀어 주다 CI，또한 이전 공식 버전의 결과를 이번 라운드의 증거로 사용하지 않을 것입니다.。

소스코드 아카이브 요약, 설치 패키지 해시, 구성/바인딩 요약, 실행 결과 및 스크린샷은 로컬에 보관됩니다. `.tmp/issue60-webhook-20261021/` 및 `.tmp/issue60-feishu-20261021/`；자격 증명 및 전체 구성은 제출되지 않습니다. 설치됨 Test、현재 설치 패키지, 공유 빌드 종속성 및 승인 기록이 유지됩니다. 첫 번째 교체 라운드 Test 이번 라운드의 패키지 및 반복 빌드 디렉터리는 설치 승인이 통과된 후에 정확한 경로에 따라 정리됩니다.。

**English:** the revised, unreleased candidate supplies five editable presets, Feishu/DingTalk signing, service-specific success checks and explicit saved-endpoint visibility. All three packaged gateways passed the same 76-check loopback suite, followed by Test installation, visible GUI, startup and preservation checks. Windows compared 705 installed files; Ubuntu compared 715. Formal apps, settings and trusted phone bindings remain intact. The user confirmed receipt from the authorized Feishu bot, and the newly installed macOS gateway also obtained a successful Feishu response; other providers have protocol-fixture evidence only. Existing mobile Test apps load the shared UI without a native rebuild. No GitHub push, release CI or new release occurred.

---

<a id="mermaid-preview-acceptance"></a>

# Mermaid 현지 승인 미리보기（2026-10-21，널리 알려지지 않은）

이번 라운드의 후보자는 다음과 같습니다. `31cc463434a01c83f51abcf805cfee2350d6e1f4`，개발 지점은 `integration/mermaid-preview-test`。범위는 다음과 채팅입니다. Markdown 차트 미리보기, 소스 코드 전환 및 복사, 전체 화면 크기 조정, 파일 스트리밍 및 캐시 재사용 iOS 하위 페이지 탐색이 수정되었습니다. 사용자들은 테스트가 통과되었다고 보고했습니다. 이 섹션에서는 로컬을 기록합니다. Test 승인 결과, 버전 번호는 아직입니다. `2.1.2`、휴대폰 빌드번호 `34`。이후에는 소스 코드와 문서만 병합되고 구성은 수행되지 않습니다. App 또는 새로 만들기 Release。

| 범위 | 이번 라운드의 증거 |
| --- | --- |
| macOS arm64 / Web | 실제 패키징 게이트웨이는 다음을 통해 생산 자원을 로드합니다. 19 브라우저 확인; 중국어 포함 SVG 실제 디코딩, 소스 코드, 전체 화면 크기 조정, 스트리밍 상태, 캐시 재사용, 유효하지 않은 콘텐츠 롤백 및 CSP。사용자가 확인한 와이드스크린 Web 차트는 정상입니다 |
| Windows x64 | 독립적인 Test 설치 후 705 파일이 후보 페이로드와 일치합니다.；GUI、QR 코드와 게이트웨이가 활성화됩니다. 게이트웨이 설치됨 Chrome 같은 것을 통해 19 실제 차트 확인，JS 오류 및 CSP 위반은 모두 0，중국어 스크린샷이 확인되었습니다. |
| Ubuntu x64 | DEB/AppImage 빌드 패스；DEB 설치 덮어쓰기 후 715 파일이 패키지와 일치합니다.，Test 설치 및 자체 시작 ID는 독립적입니다.，GUI 게이트웨이부터 시작하세요. 설치된 게이트웨이가 표시됩니다. Electron 창문을 통해 19 실제 차트 확인，JS 오류 및 CSP 위반은 모두 0，중국어 스크린샷이 확인되었습니다. |
| Android | 독립적인 Test 이미 사용자에게 제공되었습니다. 사용자가 확인 App 차트는 정상적으로 로드될 수 있습니다. 공유 렌더링 기능 Web 동일한 구현 사용 |
| iOS | 전체 App 에서 iOS 18.2 시뮬레이터에서 원래의 탐색 차단을 재현합니다. 정확한 것만 추가 Mermaid 서브페이지 허가 후，19 실제 이미지, 소스 코드, 전체 화면, 스트리밍 및 캐시 검사를 모두 통과했습니다. 독립적인 iPhone Test 덮어쓰기, 설치 및 시작, 사용자가 차트 및 전체 화면 스케일링이 정상인지 확인했습니다. |
| 기본 탐색 및 모바일 리소스 | 현실 Swift URL 직접 연결을 포함하여 판정 확인 통과/릴레이 경로, 외부 도메인 및 추가 경로/query/fragment 거부하다; 소스 코드 테스트 이동 30/30 통과하다. 미리보기 셸 메인 프레임 탐색이 거부된 상태로 유지 |
| 구성 및 바인딩 | Windows、Ubuntu 설치 및 시작 전후, 공식 버전 및 Test 구성, 신뢰할 수 있는 바인딩 및 자체 시작 격리 확인이 통과되었습니다.；iPhone Test 의 10 저장된 설정은 항목별로 일관됩니다. 독립적인 Test 교체되지 않은 공무원 App |

19 브라우저 검사는 각 플랫폼을 개별적으로 확인하며 다양한 기능에 대한 총 테스트 수에 합산되지 않습니다. 순서도, 시퀀스 다이어그램, 상태 다이어그램, 클래스 다이어그램, 파이 차트 및 ER 차트; 차트 이미지가 단지 존재하는 것이 아니라 실제로 디코딩되었는지 확인합니다. SVG 끈. 검사에는 요청 시 엔진 로드, 변경되지 않은 콘텐츠 재사용 캐시, 소스 코드 원본 텍스트 보존, 후속 스트리밍 텍스트가 전체 화면을 닫지 않거나 확대/축소 재설정, 닫히지 않은 코드 블록이 소스 코드를 유지하고 차트가 페이지를 늘리지 않는 등의 검사도 포함됩니다.。

iOS 근본 원인이 완료되었습니다. App 내비게이션 에이전트는 다음만 허용합니다. HTML 미리보기 셸, 취소됨 Mermaid 하위 페이지 탐색; 쉽게 한 WKWebView 수표에는 이 제한 사항이 포함되지 않습니다. 이 라운드에서는 현재 게이트웨이 아래의 정확한 하위 페이지 주소에 대한 권한만 증가하며 외부 탐색, 기본 페이지 탐색, 인증 또는 CSP。Web 업데이트는 이 기본을 대체할 수 없습니다. App 수리하다。

위의 내용은 현지 Test 시공, 설치 및 실측기록, 대출 불가 v2.1.2 역사 CI 결과는 이번 라운드의 증거로 사용됩니다.。macOS Intel、Linux ARM64 그리고 공식 로고 iOS 새로운 릴리스 빌드는 이번 기록의 범위를 벗어납니다. 아직 새로운 전체 플랫폼 릴리스가 수행되지 않았습니다. CI。원본 로그, 스크린샷, 패키지 해시 및 정리 목록이 로컬에 유지됩니다. `.tmp/mermaid-platform-20261021/`，구성, 계정 또는 채팅 데이터를 제출하지 마세요.。

새 버전 Test 승인 후 이전 테스트가 정리되었습니다. App、패키지 설치 및 빌드 제품 반복：Mac ～에 대한 2.23 GiB、Windows ～에 대한 2.41 GiB、Ubuntu ～에 대한 3.82 GiB。현재 Test、필요한 기록을 유지하고 캐시를 재사용하며 공식 버전, 구성, 바인딩 및 Test 게이트웨이는 정상입니다。

**English:** the local Mermaid candidate passed real packaged rendering checks on macOS arm64, installed Windows x64 and Ubuntu x64 gateways, plus full-App iOS simulator checks. Each 19-check run covers actual image decoding, source, fullscreen, streaming, cache reuse and CSP; these are not additive counts of distinct features. Users confirmed Android/Web rendering and iPhone diagram/fullscreen behavior, then accepted the round. Independent Test upgrades retained configuration and trusted bindings. The iOS fix narrowly permits the expected diagram subframe; it does not weaken top-level navigation or authentication. This is local acceptance, not a new release or cross-platform release CI result.

---

<a id="v212-platform-status"></a>

# v2.1.2 공식 출시 승인（2026-10-20）

데스크톱 버전과 모바일 버전이 통합되었습니다. `2.1.2`，Android/iOS 빌드번호는 `34`。이번 라운드에서는 터미널 상호 작용에 중점을 두고 있습니다. OpenCode 클래스 터미널 CLI 터치 스크롤. 데스크탑 appId、데이터 디렉터리, 업데이트 공개 키, 휴대폰 패키지 이름 및 바인딩 저장 방법은 변경되지 않습니다.；Android 원본 발급증명서를 보관하세요.，iOS 정식응용신분증, 확장신분증을 계속 사용하고, 임시사용은 하지 않습니다. Test 심벌 마크。

| 범위 | 이번 라운드의 증거 |
| --- | --- |
| 제품 실제 측정 | 사용자가 테스트했습니다. Mac、Windows、Ubuntu、Android 그리고 독립 iPhone Test；단말기 직접 입력 및 중국어 입력 방식을 다룹니다.、Enter/Tab、터치 스크롤、OpenCode 상호 작용, 글꼴 크기 및 종료 레이아웃。Windows 10 마우스 신호는 패키지를 사용합니다 ConPTY 검증；Test 패키징 디렉터리로 파일별 설치 디렉터리 파일 확인 |
| 로컬 무결성 검사 | Python 소스코드 검사 1,997 종 시앙 1,918 통해、79 조건부 건너뛰기; 프런트 엔드 800 통해、1 조건부 건너뛰기; 업데이터 32 통해、1 조건부 건너뛰기; 공유 리소스 이동 29 통해、iOS 의지/소스 패키지 경계 6 통과하다. 서로 다른 그룹이 겹치므로 독립적인 합계에 합산되지 않습니다. |
| 크로스 플랫폼 CI | [전체 CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/39307261300)모두 합격：Windows / Ubuntu 의 Python 3.9、3.13，macOS Python 3.13，프런트엔드, 업데이터, 모바일 업데이트 확인 |
| macOS arm64 / Intel x64 | [기본 패키징 작업 흐름](https://github.com/try2love/codex-mobile-bridge/actions/runs/39307265826)통해 DMG/ZIP、중첩된 서명, 패키지됨 App 시작, 인증, 알림、HTTPS、컨트롤러 페어링 및 업데이트 확인; 성공적인 업데이트와 실패한 롤백 모두 구성과 원래의 신뢰할 수 있는 전화 세션을 유지합니다. |
| Windows x64 | [동일한 기본 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/39307265826)마치다 NSIS/ZIP；실제 설치 프로그램 설치 후 741 페이로드 파일 항목별 SHA-256 확인 후 설치 후 GUI、QR코드와 동결단말기 검사를 통과하였습니다. 또 다른 인증 로그인、HTTPS、페어링, 알림 및 업데이트가 완료되었습니다./오류 복구, 구성 및 원래의 신뢰할 수 있는 휴대폰 세션 유지 |
| Linux x64 / ARM64 | [네이티브 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/39307265826)두 가지 아키텍처 완성 deb/AppImage；deb 설치하다、AppImage 포장 풀기 시작 및 게이트웨이 확인을 통과했습니다.。Linux 실험적 지원을 유지하고 설치 패키지를 사용하여 수동으로 업그레이드하세요. |
| 실제 이전 버전 데스크탑 오버레이 업그레이드 | 공식적인 v2.1.1 macOS arm64 App 주전원에 기본 CI 의 2.1.2 ZIP 격리 디렉터리에서 실제 교체를 완료합니다. 또 다른 주입된 교체가 실패하고 이전 교체가 복원됩니다. App。두 단계 모두에서 게이트웨이, 데스크탑, 알림 및 구독 구성은 바이트 단위로 유지되며 원본 스캔 코드는 휴대폰에서 신뢰됩니다. Cookie 아직 인증받았습니다. 데일리 포멀 대체 불가 App 또는 데이터 |
| Android 오버레이 설치 | 게시됨 v2.1.1/build33 APK 격리 상태 Android 35 시뮬레이터에서 다음과 같이 직접 덮어쓰기 2.1.2/build34。서명 인증서와 첫 번째 설치 시간은 변경되지 않고 저장된 컴퓨터와 설정도 유지되며 다시 시작한 후에도 신뢰할 수 있는 동일한 영구 세션이 계속 사용됩니다. 가장 최근 액세스 시간과 바인딩 암호문은 정상적으로 새로 고쳐집니다. |
| iOS 빌드 및 오버레이 설치 | [네이티브 iOS 짓다](https://github.com/try2love/codex-mobile-bridge/actions/runs/39306057821)서명되지 않은 것을 통해 IPA 소스 패키지를 확인해보세요. 존재하다 iOS 18.2 시뮬레이터에서 공식적으로 확인된 v2.1.1/build33 다음과 같이 보장됨 2.1.2/build34 그 다음에는 컴퓨터 목록, 현재 컴퓨터、Cookie 네임스페이스와 원래 신뢰할 수 있는 영구 세션은 유지되며 다시 열 때 로그인이 필요하지 않습니다. |

이번 릴리스 점검에서는 테스트 픽스처의 오용을 수정했습니다. CI 로그인 Shell 설정、Windows 경로 구분 기호는 하드 코딩되어 있으며 원래 동작 어설션은 유지됩니다.。Windows 릴리스 파이프라인에 새로운 실제 추가 NSIS 설치 후 전체 파일 SHA-256 설치 디렉터리에서 비교 및 ​​실행 GUI 터미널 점검을 동결합니다. 확인에 사용됨 ConPTY DLL、세 종류 OpenConsole 호스트 및 기타 리소스가 모두 설치되어 있으므로 수동으로 파일을 추가할 필요가 없습니다.。

커버리지 업그레이드는 격리 구성 및 합성 게이트웨이 로그인을 사용하며 일일 공식 버전, 계정 또는 휴대폰 바인딩을 대체하지 않습니다. 모바일 커버리지 테스트는 로그인 및 저장상태를 확인하며, 실제 모델채팅은 실행하지 않습니다.。iPhone Test 실제 기계 승인과 공식적으로 표시된 시뮬레이터 적용 범위 업그레이드는 별도로 기록됩니다. 출시된 IPA 당신은 여전히 ​​​​직접 서명하고 동일한 것을 사용해야합니다 Bundle ID 서명 ID 재정의 설치. 후보 이후의 순수 문서 수정은 빌드 입력을 변경하지 않습니다. 공식 레이블은 전체 테스트 및 전체 플랫폼 빌드를 다시 실행하고 전체 자산 세트를 확인하고 출시 전에 매니페스트 서명 및 패키지 크기를 업데이트합니다./업로드 후 결과를 해시하고 다운로드합니다.。

**English:** v2.1.2/build34 retains desktop/mobile application identities, data locations, Android signing identity and trusted-device storage. Acceptance separates real-device terminal testing, native release-package checks, and isolated overwrite upgrades. Windows installer validation compares every installed file with the built payload, including bundled ConPTY, then runs GUI and terminal checks from the installed directory. Android and official-ID iOS simulator upgrades retain saved computers and the same trusted sessions. iOS distribution remains unsigned and requires the user's signing identity; Linux remains experimental with manual package upgrades.

---

<a id="v211-platform-status"></a>

# v2.1.1 공식 출시 승인（2026-10-18）

데스크톱 버전과 모바일 버전이 통합되었습니다. `2.1.1`，Android/iOS 빌드번호는 `33`。데스크톱 유지 appId、데이터 디렉터리, 공개 키 업데이트, 휴대폰 패키지 이름 및 바인딩 저장 형식；Android 원래 출판 서명을 유지하십시오. 다음 기록은 이번 제품 테스트, 출시 및 구성, 적용 범위 업그레이드를 구별합니다. 이전 섹션은 원본 버전으로 유지됩니다.。

| 범위 | 현재 증거 |
| --- | --- |
| 인터페이스와 비즈니스 | 사용자가 계정을 테스트했습니다./모델 인터페이스, 초안 복구 및 파일 위치와 관련된 기능 소스 코드 사양과 기능 계약은 별도로 검토됩니다. 프론트엔드 완성 745 통해、1 조건부 건너뛰기; 업데이터 32 통해、1 조건부 건너뛰기; 공유 리소스 이동 29 통해，iOS 의지/소스 패키지 경계 6 통해 |
| macOS 로컬 머신 | arm64 Test 실제 설치 및 제공 8788 페이지; 계정/모델, 초안, 파일 위치 지정 및 제목은 타겟팅 확인을 통해 반환됩니다. 공식적인 8787 게이트웨이, 원래 구성 및 바인딩은 변경되지 않고 유지됩니다. |
| Windows 로컬 머신 | `4f3793d` Test 설치 및 시작, 계정/모델 인터페이스와 동결 게이트웨이가 검증되었습니다. 모델 디렉터리 격리 루프백 승인이 처음으로 확인되었습니다. 1 두 번째 업스트림 읽기, 캐시 0 횟수, 수동 새로 고침 및 보존 실패 디렉터리。17 보호된 파일、3 원본과의 바인딩 세션 DSH 프로세스는 변경되지 않습니다. 유료 모델이 호출되지 않았습니다. |
| SSH CLI | 이번 라운드는 실제로 Linux SSH 실행측과 Mac/Windows 네이티브 CLI 모델 쿼리에서 원래 실행 환경, 격리 구성 및 루프백 업스트림 검증을 통해 캐시 및 ID 격리를 수행합니다. 서버 자체 네트워크는 여전히 실제 업스트림 연결 가능성을 결정합니다. ～ 아니다 88server 프록시 추가 |
| v2.1.0 오래된 데이터 | 태그 사용 v2.1.0 인증 및 페어링 구현은 격리 데이터를 생성합니다. 새로운 구현은 구성 및 데스크탑 기본 설정 바이트를 읽습니다.、Cookie 네임스페이스, 신뢰할 수 있는 모바일 세션, 릴레이 ID 및 바인딩 증명이 보존됩니다. |
| 실제 이전 버전 데스크탑 오버레이 업그레이드 | 공식 사용 v2.1.0 macOS arm64 App 네이티브와 함께 CI 생성됨 2.1.1 ZIP，격리 디렉터리에서 실제 교체를 완료합니다. 주입 교체가 실패한 후 이전 것을 복원하십시오. App。두 단계 모두에서 게이트웨이, 데스크탑, 알림 및 구독 구성은 바이트 단위로 유지되며 원본 스캔 코드는 휴대폰에서 신뢰됩니다. Cookie 아직 인증받았습니다. 매일 교체되지 않음 App 또는 데이터 |
| 크로스 플랫폼 완성 CI | [응시자 정확한 제출 테스트](https://github.com/try2love/codex-mobile-bridge/actions/runs/39105761941)모두 합격：Windows / Ubuntu Python 3.9、3.13，macOS Python 3.13，프론트엔드, 업데이터, 모바일 검사 |
| macOS arm64 / Intel x64 | [기본 패키징 작업 흐름](https://github.com/try2love/codex-mobile-bridge/actions/runs/39105759061)통해 DMG/ZIP、서명 무결성、App 시작, 인증, 알림, 페어링 및 실제 업데이트 컨트롤러 확인; 성공적인 업데이트와 실패한 롤백 모두 구성과 원래의 신뢰할 수 있는 휴대폰 세션을 유지합니다. |
| Windows x64 | 동일한 기본 워크플로가 통과됩니다. NSIS/ZIP、설치 후 GUI、QR코드, 연속단말기, 게이트웨이인증、HTTPS、페어링, 알림 및 업데이트 컨트롤러 확인; 업데이트 및 오류 복구는 구성 및 원래의 신뢰할 수 있는 전화 세션을 유지합니다. |
| Linux x64 / ARM64 | 동일한 기본 워크플로가 완료되었습니다. deb/AppImage；두 가지 아키텍처 deb 설치 및 AppImage 포장 풀기 시작 확인 통과。Linux 아직 실험적 지원, 설치 패키지를 사용한 수동 업그레이드 |
| Android 오버레이 설치 | 공식적인 v2.1.0/build32 APK 격리 상태 Android 35 시뮬레이터에 로그인한 후 다음과 같이 직접 덮어씁니다. 2.1.1/build33；서명 인증서, 최초 설치 시간, 저장된 컴퓨터 및 신뢰할 수 있는 동일한 영구 세션이 모두 유지되므로 다시 시작할 때 다시 로그인할 필요가 없습니다. |
| iOS 빌드 및 오버레이 설치 | [네이티브 iOS 짓다](https://github.com/try2love/codex-mobile-bridge/actions/runs/39104303887)서명되지 않은 것을 통해 IPA 및 Xcode 소스코드 패키지 검사. 존재하다 iOS 18.2 시뮬레이터에서는 v2.1.0 태그 편집 build32 그리고 직접 커버하려면 격리 게이트웨이에 로그인하세요. build33 그 다음에는 컴퓨터 목록, 현재 컴퓨터、Cookie 네임스페이스 및 동일한 영구 로그인 세션이 유지됩니다. 처음 시작할 때 다시 로그인할 필요가 없습니다. |

네이티브 빌드 후보는 다음과 같습니다. `7155ff1`；나중에 데스크탑 제품이 다음과 같이 추가되었습니다. Windows 계정 파일 교체를 검색하고 승인 설비 및 문서를 수정합니다.。iOS/Android 빌드 입력은 여전히 ​​​​와 동일합니다 `792b048` 일관된. 공식적인 레이블 지정 작업 흐름은 다음을 사용하여 데스크탑을 재설계합니다. iOS 최종 완성을 위해 릴리스된 자산 CI、전체 자산 세트, 매니페스트 서명 업데이트, 크기/임계값으로 업로드한 후 해시 및 다운로드 검토。

이번 라운드에서는 수락 픽스처의 문제가 해결되었습니다. Windows 기본 인코딩, 명령줄 길이、PID/경로 가정 및 백그라운드 스레드에 대한 글로벌 클록 시뮬레이션 간섭 원래의 행동 주장은 그대로 유지되고 통과된 제품 검사는 통과되지 않았습니다. 공식 레이블 초기 빌드 추가 캡처 Windows 구성을 복원할 때 `os.replace` / WinError 5；삭제가 허용되지 않는 핸들이 열린 상태로 격리된 실제 머신이 다시 나타난 후 보충 자료는 Windows 5/32/33 가장 긴 오류 2 몇 초 후에 다시 시도하세요. 임시 점거가 해제된 후 회복이 성공적입니다. 계속 점유한 후에도 여전히 오류가 발생하고 원본 파일이 완료되고 임시 파일이 지워집니다. 원래의 복구 어설션과 예외 진단은 유지되고 수정된 레이블이 완전히 다시 실행됩니다. CI。일상적인 루틴을 바꾸지 않고 격리 디렉터리, 테스트 계정 및 바인딩을 사용하여 업그레이드를 재정의합니다. App 또는 구성. 위의 증거는 모든 운영 체제 버전, 실제 유료 액세스 또는 다른 것과 동일하지 않습니다. iPhone 서명 확인。iOS IPA 여전히 자신을 서명하고 동일한 서명 ID를 사용해야 합니다. Bundle ID 오버레이 설치。

---

<a id="v210-platform-status"></a>

# v2.1.0 공식 출시 승인（2026-10-16）

릴리스 라벨은 다음 위치에 고정되어 있습니다. `582beb52b46c0c584da468197083dd2cafa30361`，버전은 다음과 같이 통일됩니다. `2.1.0`，Android/iOS 빌드번호는 32。데스크탑 appId、설치 이름, 데이터 디렉터리 위치, 휴대폰 패키지 이름, 바인딩 저장소 키 및 업데이트 공개 키는 변경되지 않습니다.；Android 원래 출판 서명을 유지하십시오. 아래 표는 정식발급 확인내역입니다. 이후의 이전 섹션은 기록에 따라 제출되고 유지됩니다.。

| 범위 | 이번 증거공개 |
| --- | --- |
| 소스코드 및 모바일 단말 검사 | [정확한 라벨 테스트](https://github.com/try2love/codex-mobile-bridge/actions/runs/38888357130)：Windows / Ubuntu 의 Python 3.9、3.13，macOS Python 3.13，프런트엔드, 업데이터, 모바일 리소스/업데이트 확인을 통과했습니다. 이전 로컬 백엔드 1760 종 시앙 1715 통해、45 조건부 건너뛰기; 프런트 엔드 664 종 시앙 663 통해、1 플랫폼 건너뛰기, 그룹핑이 반복되지 않고 누적됩니다. |
| macOS arm64 / Intel x64 | [공식 릴리스 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/38888357147)해당 네이티브 러너에서 완료됨 DMG/ZIP、서명 무결성, 패키지 App 시작, 게이트웨이 인증, 알림、HTTPS、페어링 및 인터페이스 제어 확인; 업데이트 성공 및 롤백 실패 후에도 구성 바이트 및 원래 신뢰할 수 있는 휴대폰 세션 인증이 유지됩니다. |
| Windows x64 | 동일한 게시 워크플로가 완료되었습니다. NSIS/ZIP、설치 후 GUI、QR 코드, 네이티브/HTTP 단말기, 게이트웨이 인증, 알림、HTTPS 그리고 페어링 확인; 업데이트 성공, 실패한 롤백 및 이전 작업 디렉터리 복구 확인 모두 구성 및 원래 신뢰할 수 있는 휴대폰 세션을 유지합니다. |
| Linux x64 / ARM64 | 동일한 릴리스 워크플로가 각 아키텍처를 완성합니다. deb/AppImage；네이티브 러너에서 deb 설치하다、AppImage 포장 풀기 시작 및 포장 게이트웨이 검사 통과。Linux 아직 실험적 지원, 설치 패키지를 사용한 수동 업그레이드 |
| 실제 이전 버전 데스크탑 오버레이 업그레이드 | 격리 상태 macOS arm64 환경에서는 공식을 사용하십시오. v2.0.3 Release 이전 버전을 다운로드하여 확인하세요. App，마치다 2.0.3 → 2.1.0 실제 교체; 또 다른 주입된 교체가 실패한 후로 롤백 2.0.3。두 경우 모두 게이트웨이, 데스크톱, 알림 및 알림 구독 구성이 바이트 단위로 유지되며 원본 스캔 코드로 생성된 신뢰할 수 있는 휴대폰 Cookie 아직 인증받았습니다. 매일 교체되지 않음 App 또는 데이터 |
| 오래된 데이터 호환 | v2.0.3 및 v2.1.0-preview.1 오래된 인증/페어링 구현은 각각 격리 구성과 신뢰할 수 있는 전화 세션을 생성합니다. 현재 구현을 읽은 후 구성、Cookie 네임스페이스, 신뢰할 수 있는 세션, 릴레이 장치 ID 및 바인딩 인증서 확인이 통과되었습니다. |
| Android | 공식적인 APK ～을 위한 2.1.0/build32，v2/v3 서명 및 자원 확인이 통과되었으며 서명 인증서는 다음과 같습니다. v2.0.3 같은; 격리 상태 Android 35 시뮬레이터 내에서 게시됨 preview.1/build31 설치 덮어쓰기, 컴퓨터 저장, 첫 설치 시간 및 동일한 신뢰할 수 있는 게이트웨이 세션, 로그인하기 위해 QR 코드를 다시 스캔할 필요 없음 |
| iOS | 동일한 공식 출시 워크플로가 완료되었습니다. 2.1.0/build32 서명되지 않은 IPA 및 Xcode 소스 코드 패키지 구성, 리소스 및 버전 확인 ～에 iOS 18.2 시뮬레이터에서 공식을 사용하십시오 preview.1 소스코드 컴파일 build31 그리고 격리 게이트웨이에 로그인하여 다음과 같이 직접 덮어씁니다. build32 이후에는 컴퓨터 목록, 현재 컴퓨터 및 원래의 신뢰할 수 있는 영구 세션이 유지되며 처음 열 때 다시 로그인할 필요가 없습니다.。IPA 사용자는 여전히 스스로 서명해야 합니다. |
| 자산 게시 | 15 첨부 파일의 출처는 다음과 같습니다. GitHub Release 읽고 확인하세요：13 각 플랫폼에 설치/소스 코드 패키지, 서명 업데이트 목록 및 SHA256SUMS；14 항목 페이로드 체크섬 일치, 데스크톱 업데이트 매니페스트 Ed25519 서명, 패킷 크기 및 해시 확인이 통과되었습니다. |

이 라운드가 수정되었습니다. Windows 테스트 픽스처는 중국어 소스 파일을 읽고 쓸 때 및 응답을 브리징할 때 기본 인코딩을 사용합니다. 명시적으로 사용하세요. UTF-8，결과적으로 제품 동작이 변경되지 않았습니다. 독립 최종 제출 macOS 첫 번째 테스트는 이전 버전에서 이루어졌습니다. DSH 설비의 큰 그림 `time.monotonic` 시뮬레이션 값이 소진되면 실패합니다. 첫 번째 기록은 유지되고 동일한 제출 및 어설션이 새 주자에서 전달됩니다. macOS 패키지 무결성 검사와 로컬 방향 검사도 통과했습니다. 해당 픽스처에 대한 모든 타이밍 장애를 수정한 것으로 재테스트 결과를 특성화하지 마십시오.。

CI 적용 범위 업그레이드 확인을 통해 격리 구성, 합성 세션 및 테스트 바인딩을 사용합니다. 머리말 Windows/Linux 네이티브 CLI 그리고 사용자 휴대폰의 실제 측정 증거는 현재 버전에 따라 아래에 기록됩니다. 에뮬레이터 설치가 임의적이라는 의미는 아닙니다. iPhone 서명 도구 또는 모든 업스트림 CLI 버전。Android 먼저 제거하는 대신 설치를 덮어써야 합니다.；iOS 동일한 서명 ID를 사용해야 하며 Bundle ID 애플리케이션 데이터를 유지하기 위해 설치 덮어쓰기。

---

## v2.1.0-preview.1 릴리스 승인（2026-10-15）

미리보기 라벨은 다음으로 고정되어 있습니다. `195d0a3949068009300e7cf8dce13a52568750b7`，버전은 `2.1.0-preview.1`，Android/iOS 빌드번호는 31。독립적인 미리보기 분기를 사용하여 릴리스；GitHub `main` 및 v2.0.3 안정 버전은 그대로 유지됩니다.。

| 범위 | 이번 증거공개 |
| --- | --- |
| 소스코드 및 모바일 단말 검사 | [정확한 라벨 테스트](https://github.com/try2love/codex-mobile-bridge/actions/runs/38602320392)：Windows / Ubuntu 의 Python 3.9、3.13，macOS Python 3.13，및 데스크톱 프런트엔드, 업데이터, 모바일 리소스/업데이트 확인 통과 |
| 데스크탑 설치 패키지 | [릴리스 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/38602320477)：macOS arm64/x64、Windows x64、Linux x64/ARM64 해당 워크플로의 빌드 및 패키지 실행 검사가 통과됩니다.；Linux 수표에는 다음이 포함되어 있습니다. deb 설치 및 AppImage 포장을 풀고 시작하세요 |
| iOS | 동일한 게시 워크플로가 완료되었습니다. iPhone 서명되지 않은 IPA 및 Xcode 소스 패키지 구성, 리소스 및 버전 확인；IPA 사용자 자신의 서명이 필요합니다 |
| Android | APK 버전, 빌드 번호、v2/v3 서명 및 SHA-256 확인이 통과되었습니다. 인증서와 v2.0.3 마찬가지로 재정의 설치 ID를 유지합니다. 후속 제출에서는 문서와 승인 스크립트만 변경됩니다.，Android 변경되지 않은 빌드 입력 |
| 자산 게시 | 전체 다운로드 및 검토 15 자산：13 각 플랫폼에 설치/소스 코드 패키지, 서명 업데이트 매니페스트 및 SHA256SUMS；14 항목 페이로드 체크섬 일치, 데스크톱 업데이트 매니페스트 Ed25519 서명 및 패키지 크기/해시 일치 |
| 출시 채널 | GitHub 로 표시됨 prerelease，다음으로 설정되지 않음 Latest；v2.0.3 메타데이터, 자산 및 Latest 상태는 변경되지 않고 유지되며 원격 main 아직 `25867f7` |

CI 분리된 데이터 및 합성 게이트웨이 콘텐츠 사용；Windows/Linux 네이티브 CLI 전체 답변, 권한、Goal、승인 및 콜드 복구에 대한 실제 기계 증거는 아래의 사전 설치 패키지 승인을 참조하십시오. 두 가지 유형의 증거는 별도로 기록되며 결합되지 않습니다. CI 모든 실제 계정, 업스트림 버전 또는 사용자 네트워크에 대한 호환성 약속을 포함하도록 확장된 설비。

이 릴리스 확인은 크로스 플랫폼 테스트 픽스처의 경로도 수정합니다.、UTF-8 오류 메시지 계약 및 교체 Windows GUI 수락 스크립트 루프백 HTTP 피하기 위해 읽기 모드 Node 24.21 내장 Undici 연결이 어설션을 종료합니다. 방향성 재발 검사에 의해 거부된 잘림이 있는 대규모 응답 전체 읽기, 최종 Windows 포장과정은 동일합니다 GUI、인증, 알림、HTTPS、페어링 및 업데이트 롤백 확인。

Windows Python 3.13 첫 번째 라운드에서 불법 Origin 업로드 거부 확인 중 1회 발생함 WinError 10053；새 실행자가 동일한 커밋과 원래 어설션을 다시 확인한 후에만 통과됩니다. 첫 번째 실패에 대한 기록을 유지하고 재테스트 통과가 일시적인 연결 중단의 근본 원인을 찾거나 복구한 것으로 설명하지 마십시오.。

다음은 당시 제출된 기록을 바탕으로 한 역사적 준비 및 실제 기계 승인이며, 본 섹션의 최종 출시 결과는 다루지 않습니다.。

---

## v2.1.0 통합 기준선 및 사전 시퀀스 실제 기계 승인（2026-10-14，역사）

이 섹션은 다음과 병합된 제품 코드를 기록합니다. `b5d1e57` 당시의 실제 기계 합격은 물론, 이전에도 Windows/Linux Test 설치 패키지 및 CLI 행렬。v2.0.4 스테이지 파일 읽기 CLI 포함된 작업 v2.1.0；다음 표와 후속 이전 섹션은 당시 제출물, 결과 및 경계를 유지하며 최종 릴리스 상태는 위와 같습니다. `v2.1.0 공식 출시 승인` 승리할 것이다. 원래의 v2.0.3 풀어 주다 CI 이번 라운드 통과의 증거로 사용되지 않음。

| 플랫폼 / 길 | 당시 실제 측정된 범위 | 당시의 경계 기록 |
| --- | --- | --- |
| macOS Apple Silicon | 머리말 arm64 Test 패키지 구축, 서명 무결성, 기본 실행 및 CLI/Web 공동 디버깅；Codex 0.162.1、Claude Code 2.1.287 | 결정적인 `b5d1e57` 아직 다시 작성되지 않았습니다. Mac 패키지; 공증되지 않은 현지 서명; 네이티브로 변환하지 마세요 CLI 모든 일일 계정으로 고정/구성 호환성 증거 |
| Intel Mac | 기존 유지 x64 목표 수립 및 구현 공유 | 이번 라운드에는 새로운 추가 사항이 없습니다. Intel 기본 실행 또는 최종 후보 빌드 승인 |
| Windows 10 x64 | `b895720` NSIS Test 설치하다/업데이트됨; 수락됨 GUI 의 APP/asar 바이트 일관성; 설치됨 worker 의 16 개 CLI HTTP 복구 및 모델을 포함한 모든 검사를 통과했습니다./권한、Goal、승인 및 재시작 기록 | Windows 11 테스트되지 않았습니다. 없음 Windows ARM 가방；ZIP 독립적으로 시작되지 않음；Test 서명되지 않았습니다. 공식 버전 업그레이드에는 허용되지 않습니다./제거 |
| Ubuntu 22.04.5 x64（실험적） | `9f34ee0` deb Test 설치하다、GNOME GUI 및 16 개 CLI HTTP 모든 검사를 통과했습니다. 공식 버전을 유지하세요 | AppImage 빌드만/정적 검증; 다른 배포판과 Linux ARM64 테스트되지 않음；Claude Desktop 자동 연결은 지원되지 않습니다. |
| 현실 Linux SSH | Codex 액세스, 콜드 복구, 새로 생성, 전송, 권한 및 Goal；Claude Code 복원, 신규, 모델/권한、Skill、업로드, 승인 거부, 중단 및 작성자 보호 | 기본 버전, 서버 및 격리 구성만 나열됩니다. 모두를 대표하진 않는다 SSH 환경；App 인수하다 SSH 채팅은 아직 지원되지 않습니다. Goal；다른 사용자가 접근할 수 없음 A/B/C 원래의 결함은 재발하지 않습니다. |
| Android | 사전 테스트 APK 짓다/서명 및 시뮬레이터 파일 읽기, 진단 다운로드 등과 같은 지정된 프로세스가 통과됩니다. 새로운 CLI 공유 사용 Web | 최종 병합 후 다시 빌드하지 않음/휴대폰 패키지를 설치합니다. 이번 설치 패키지 승인에는 실제 전화기가 포함되지 않습니다. 기본 두 손가락 제스처가 안정적인 주입 확인을 완료하지 못했습니다. |
| iOS | 머리말 iOS 18.2 Simulator 전체 빌드/설치하다/시작 및 파일 읽기 확인 서명되지 않은 IPA 기록을 세우다 | 최종 합병 후 재배열되지 않음. 물리적인 것과 같지 않다 iPhone 아니면 결국 WebView 진단 내보내기가 통과되었습니다. 네이티브 패스트 슬라이딩/실제 컴퓨터에서 두 손가락 제스처를 다시 테스트해야 합니다.，IPA 직접 서명해야 함 |
| Web 기존과 HTTPS 입구 | 서문 중국어 및 영어 좁은 와이드스크린 및 격리 HTTP/TLS、바인딩 복구, 보안 거부 확인；macOS 실제 고정 출입구 감지가 통과됩니다. 감지에 성공하면 이전 오류를 덮어씁니다. | 같지 않음 Windows/Linux 실제 공용 네트워크 프록시 또는 휴대폰 셀룰러 채팅/전체 파일 링크; 에이전트의 현재 제한, 버퍼링 및 시간 초과를 실제로 확인해야 합니다. |

macOS 머리말 Claude 기본 프로세스에는 `CLAUDE.md` 격리 확인 상속 합성 요청 및 루프백 모델 증거가 실제 유료 업스트림 또는 OAuth 로그인 승인。

Windows/Linux 네이티브 CLI 및 API 구성 전환 및 오류 롤백은 로컬 시뮬레이션 서비스를 사용하여 엔드포인트, 모델, 권한, 기록 및 도구 효과를 확인합니다. 실제 유료 모델이 사용되지 않으며 데스크톱 계정 종료가 완료되지 않습니다./다시 시작하다“동시에 이 기계에 적용하십시오 CLI”전체 크로스 플랫폼 실제 테스트。SSH 서버 자체 구성은 항상 유지됩니다. 테스트 버전은 Windows Codex `0.162.0-alpha.17.2` / Claude Code `2.1.168`，Linux Codex `0.160.0` / Claude Code `2.1.287`；모든 업스트림 버전으로 출시할 수 없음。

Windows 최종 패키지에는 다음이 포함됩니다. `9f34ee0` 상태 읽기 수정 및 2개 항목 Windows 독점 복원；Ubuntu 검증된 패키지는 `9f34ee0`，아무 원인도 작용하지 않습니다. Windows 빌드를 반복하기 위한 후속 수정 사항입니다. 병합된 제품 소스 코드와 Windows 후보 소스 코드는 일관되며 승인 장치는 다음과 동일합니다. `4c4b7cc` 일관된; 병합 후 지시 검사 24 항목이 통과됨、1 개 Windows 단독점검 Mac 건너뛰기, 경로 확인이 이미 true입니다. Windows 통과하다. 그룹화된 테스트는 중복되어 독립적인 총계에 합산되지 않습니다.。

**미리보기 준비：**릴리스 버전이 다음으로 통합되었습니다. `2.1.0-preview.1`，Android/iOS 빌드번호는 31；Android 원본 서명을 유지하세요. 각 플랫폼에 대한 릴리스 빌드, 서명 목록 및 전체 자산 확인은 미리보기 태그 워크플로를 통해 완료됩니다. 위 표의 `2.0.3` Test 메타데이터는 제작 전 실기 승인 제품에 속하며, 안정 버전 다운로드는 그대로 유지됩니다. v2.0.3。

---

## v2.1.0 Windows/Linux Test 설치 패키지 승인（2026-10-14，지역 후보）

먼저 로컬 소스 코드를 사용하세요 `104d11c` 짓다 Windows x64 NSIS/ZIP 및 Linux x64 deb/AppImage，다시 `9f34ee0` 수정된 클라이언트 상태 읽기；Windows 최종 후보는 후속 기본 기록 및 역사적 경로 복구를 포함하는 후보입니다. `b895720`，Ubuntu 합격 후보자는 `9f34ee0`。빌드 메타데이터는 여전히 `2.0.3`。Test 독립적인 패키지 이름, 설치 경로 및 앱 ID를 사용하십시오. 빌드 복사본에서만 조정 Windows AUMID/로그인 시작 항목 이름、Linux 공식 버전과의 충돌을 피하기 위해 자동 시작 파일 이름입니다. 형식적이지 않은 v2.1.0 게시되었으나 푸시되지 않음 GitHub。

| 범위 | 확인됨 | 아직 확인 또는 제한되지 않음 |
| --- | --- | --- |
| Windows 10 x64 설치 및 GUI | 일반 데스크톱 사용자는 첫 번째 단계를 완료합니다. NSIS 설치 및 `9f34ee0` Test 가방 GUI 수락; 기본 시작 및 중지, 인증, 정적 리소스, 중국어 데이터 경로, 언어 메모리 및 창 닫기 및 다시 열기, 영어를 통과했습니다. 1100px/820px 측면 유출이 없습니다. 결정적인 `b895720` NSIS 업데이트가 통과 및 설치되었습니다. APP、asar、worker 해시 일치 후보；APP 및 asar 허용된 것과 동일한 바이트가 사용됩니다. worker 업데이트; 공식 버전 2.0.2 당시의 파일, 등록정보, 7가지 프로세스는 그대로 유지됩니다. | 최종 업데이트에서는 기록만 다시 확인하고 CLI HTTP，반복되지 않음 GUI 작동하다。Test 패키지가 서명되지 않았습니다.；ZIP 독립적으로 시작되지 않고 구축 및 검증되었습니다. 대체하지 않습니다 Windows 11、ARM64、공식 버전 업그레이드/제거 또는 실제 전화 승인 |
| Ubuntu 22.04.5 x64 설치 및 GUI | `9f34ee0` 독립적인 deb 재설치 성공, 설치됨 worker/asar 후보 패키지와 일치합니다. 공식 버전은 다음과 일치합니다. Test 파일 경로에는 교차점이 없습니다. 진실 GNOME 데스크탑 전체 내장 worker 시작 및 중지, 인증, 정적 리소스, 언어 메모리 및 창 다시 열기, 클라이언트 페이지가 정상적으로 로드됩니다. 영어 1100px/820px 수평 오버플로 없음 | AppImage 독립적으로 시작되지 않은 빌드 및 정적 검증이 완료되었습니다. 다른 배포판 또는 ARM64 |
| Ubuntu 게이트웨이 설치됨 CLI HTTP 링크 | 네이티브 Codex 0.160.0、Claude Code 2.1.287：종료 후 세션 목록/기록, 명시적 복구, 모델 및 권한 전환, 다음 차례에 대한 실제 모델, 완전한 응답、Codex Goal 설정/분명한、Claude 도구 거부/권한, 해당 파일 효과 및 게이트웨이 다시 시작 후 기록이 모두 전달됩니다. 인증 및 CSRF 테스트 실행 시 거부, 종료 및 통과 | `9f34ee0` 의 `d3104d` 실행: 루프백 시뮬레이션 API；3 이류 Codex、6 이류 Claude 모델 요청，13 외부 CONNECT 가로채기；59 이류 HTTP 요청, 세 가지 클라이언트 상태 GET ～을 위한 7/2/2 ms。실제 유료 액세스, 실제 전화 또는 업스트림 버전을 나타내지 않습니다. |
| Windows 게이트웨이 설치됨 CLI HTTP 링크 | `b895720` 의 `3bd284` 모두를 통과하다 16 항목 확인: 인증/CSRF、2종 CLI 기록 닫기, 명시적 복구, 모델 및 권한, 전체 답변、Codex Goal 설정/분명한、Claude 도구 거부/허용, 재시작 후 기록 및 자체 런타임 종료. 토종의 Codex 0.162.0-alpha.17.2、Claude Code 2.1.168；93 이류 HTTP 요청, 클라이언트 상태 GET 최고 16 ms；공식 버전의 7가지 프로세스, 파일 및 등록 정보는 변경되지 않습니다.，Test 프로세스 종료 | 일반 데스크톱 사용자 환경, 루프백 시뮬레이션 API；3 이류 Codex、6 이류 Claude 모델 요청，12 외부 CONNECT 차단됨, 거부된 고정물 없음. 실제 유료 액세스, 실제 전화 또는 업스트림 버전을 나타내지 않습니다. |

후속 소스 코드 후보 `9f34ee0` 클라이언트 상태 변경 GET 스냅샷 표시 및 백그라운드 새로고침으로 변경，Web 에서 `pending` 이 기간 동안 기존 목록과 알 수 없는 작업 결과 플래그가 유지됩니다. 쓰기 작업은 실시간으로 계속 확인됩니다. 루트 검토 통과 119 개 Python、35 개 Web 직접 테스트; 개정 Ubuntu 설치 패키지가 위 동의를 완료했습니다.，Windows 이전 상태 읽기 시간 초과가 설치 패키지에서 제거되었습니다.。Windows 후속 후보 `2c15108` 확인된 경우에만 PID 존재하지 않는 경우 알려진 누락된 시작 ID 허용 Claude 기록; 활성 프로세스, 불확실한 쿼리, 불법 기록은 계속 차단되며 기록은 삭제되지 않습니다. 수리해야 함 57 개 Claude 지정 회귀를 통과한 후 설치 패키지의 원래 문제 회귀와 런타임 종료를 모두 통과했습니다. 후보자 `b895720` 다시 수정 Windows 일반 경로와 확장 경로의 동등한 디렉토리 확인. 실제 Windows 4번의 회귀를 통과했으며 원래 실패한 세션은 읽기 전용으로 복원되었으며 SQLite、WAL、JSONL 해시는 변경되지 않습니다. 최종 설치 패키지도 원본 기록 회귀를 통과하고 재시작 이력 검증을 완료했습니다. 수락 스크립트 프레스 Web 의 10 초 단위의 단일 읽기 기간은 요청 시간을 기록하고, 기록 백그라운드 로드는 제한된 읽기 전용 대기를 사용합니다.，HTTP 오류가 즉시 실패하고 쓰기 작업이 다시 실행되지 않습니다.。

이번 라운드 CLI 기본 프로그램, 격리된 구성 및 루프백 시뮬레이션을 사용하여 테스트 API，유료 모델을 호출하거나 일일 계정을 수정하지 마십시오。Linux 재테스트를 통해 최신 사용자 뉴스에 대한 테스트 스크립트의 응답이 수정되었습니다. CLI 소스 식별자 및 모델 별칭 확장 처리는 설치된 제품 코드를 변경하지 않습니다. 설치 패키지, 스크린샷 및 로그는 로컬 및 승인된 장치 테스트 디렉터리에만 저장되며 창고에 제출되지 않습니다. 다음 섹션에 녹음됨“확인되지 않음 GUI 설치 패키지”이 단계의 역사적 경계입니다. 이 섹션은 위에서 완료된 프로젝트만 보완합니다.。

## v2.1.0 Windows/Linux CLI 적응（2026-10-14，지역 후보）

이번 라운드는 로컬에서 시작됩니다. main `33d1bbc` 독립적인 지점을 만들고 실제 지점을 사용하십시오. Windows 10 x64、Linux x64 서버와 Ubuntu 22.04.5 VMware 게스트 머신 승인. 다음 결과는 나열된 기본 버전 및 경로에만 적용되며 모든 플랫폼의 공식 릴리스와 동일하지 않습니다. 그들은 밀리지 않았습니다. GitHub。

| 범위 | 확인됨 | 아직 확인 또는 제한되지 않음 |
| --- | --- | --- |
| Linux Codex CLI | 네이티브 0.160.0 진실 SSH 수동적 기록, 명시적 액세스, 새로 생성, 전송 및 권한 확인을 완료합니다.、Goal 설정/지우고 그만둬 daemon 냉각 후 회복; 원본을 유지하다 ID/provider/cwd | 격리 사용 CODEX_HOME 모든 버전이 아닌 루프백 가짜 모델、ARM64 아니면 실제 유료인증을 받거나 |
| Linux Claude Code | Ubuntu x64 네이티브 2.1.287 진실 SSH 완전한 콜드 복구, 신규 생성, 전송, 모델/권한、Skill、파일 업로드, 승인 거부, 중단 및 재개 토종의/SSH 프로세스 확인은 활성 작성자를 거부하고 종료됩니다. PID 재사용 가능하고 구별 가능 | 네이티브 CLI 구성 및 거짓 Key，실제 유료 계정은 인증되지 않았으며 완료되었습니다. Linux 데스크탑 설치 패키지；Claude Desktop Linux 자동 연결은 아직 지원되지 않습니다. |
| Windows Claude Code | 네이티브 2.1.168 이미 설치됨 npm `.cmd` 입구가 생성되고 2회에 걸친 완전답변, 종료 후 복구 및 복원, 권한 부여가 이루어집니다./모델/인터럽트 제어; 이 도구는 쓰기를 거부하고 지정된 파일의 쓰기만 허용합니다. 이 시간은 정확히 일치합니다. tool_result 그리고 최종 답변; 반복 승인 거부, 기본 기록, 구성、cwd、모델 및 프로세스 종료 통과；CP936 중국 역사는 평범하다 | 루프백 시뮬레이션 사용 API；확인되지 않은 실제 유료계좌, 실물전화, 완료 Windows GUI 설치 패키지 또는 기타 버전 등록 형식 알 수 없는 형식이 계속 복구를 거부합니다. |
| 두 가지 플랫폼 API 계정 전환 | Codex 및 Claude 별도로 확인 A/B 엔드포인트, 가짜 자격 증명 및 모델 주입 B 검증 실패 후 복구 A 후속 기본 요청을 통해 파일을 작성하고 확인했습니다. A 효과적인; 성공적으로 전환 B 및 작업/알 수 없는 상태로 인해 스위치가 통과하지 못함 | 일일 계정을 변경하지 마십시오. 테스트되지 않은 사실 OAuth 로그인, 유료 모델 또는 데스크톱 App 종료/전체 동기화 링크 다시 시작。Windows Codex 설치하여 사용 MSIX 동일한 바이트 내에서 네이티브 프로그램의 격리된 복사본 |
| Windows Codex daemon | 네이티브 0.162.0-alpha.17.2 일반 사용자 단말에서는 원래 세션 연결을 완료하고 라운드를 전송한 후 권한을 적용하고 새 세션을 생성합니다. CLI 채팅、Goal 설정/지우고 그만둬 daemon 냉각 후 회복; 원래의 ID/provider/cwd 일관성을 유지하세요；3 모든 모델 요청은 테스트를 위해 루프백 인터페이스로 이동합니다. daemon 중지됨 | 설치하여 사용 MSIX 설치 증명만 아닌 바이트 복사본과 격리된 호스팅 디렉터리를 사용하여 프로그램 MSIX 매일 가지고 CLI 호스팅 디렉터리；10 관련되지 않은 외부 연결이 차단되었습니다. 확인되지 않은 실제 유료 계정、Windows GUI 패키지 또는 모든 업스트림 버전 설치 |
| 고정 항목 피드백 | 먼저 실패하고 성공하고 다시 실패하고 폴링합니다./언어 전환, 주소 편집, 인스턴스 변경, 동시 결과 삭제 65 데스크톱 방향 테스트를 통과했습니다. 성공적인 결과는 참가 카드에 보관됩니다. | 사용자 교체 없이 노드 및 셀룰러 네트워크의 엔드투엔드 테스트 |
| macOS Test 패키지 배송 | 소스 코드 `0f3af7f` 짓다 arm64 Test App；심층적이고 엄격한 서명, 실제 격리 인터페이스 및 내장 worker 통과하다; 바꾸다 8788 LAN 로그인 후, 세션 목록、CLI 구성 및 5 항목 공유 자원 요약은 일관성이 있습니다. 실제 고정 HTTPS 입구 감지 통과 | 원래 구성, 비밀번호 및 바인딩 데이터 디렉토리를 유지하십시오. 공식적인 8787 프로세스와 인스턴스는 변경되지 않고 그대로 유지됩니다. 이전 테스트 패키지는 청소를 위해 닫혀 있습니다. 공증되지 않은 현지 서명이 아직 사용 중입니다. 2.0.3 메타데이터 구축 휴대폰 셀룰러 네트워크의 전체 채팅 링크가 사용자 테스트를 기다리고 있습니다. |

소스코드 직접반환, 계좌번호/Codex/자원 확인 128 항목이 통과되었습니다. 결정적인 Claude/의지/계좌 확인 83 개、Codex app-server 조사하다 5 항목이 통과되었습니다. 데스크탑 포털 65 항목이 통과되었습니다. 그룹에는 교차가 있으므로 총 독립 테스트 수에 합산되지 않습니다. 다시 채우다 Windows 콜드 복구 수리 후，CLI/app-server 정위 55 항목이 통과되었습니다. 토종의 Windows Claude 의 21 정확한 승인 요청, 기본 기록, 구성 및 디렉터리는 물론 테스트 프로세스 및 수신 포트 폐쇄를 포함하여 결과 확인이 통과되었습니다.。

기본 테스트는 전용 임시 디렉터리, 합성 세션 및 기본 모의를 사용합니다. API。Ubuntu Claude 공식 바이너리 2.1.287 Linux x64 공식 목록에 따라 다운로드하고 확인하세요. SHA-256 그러면 승인된 디렉터리에서만 실행됩니다. 테스트가 시스템에 설치되어 있지 않습니다. PATH、유료 모델을 호출하거나 일일 인증을 수정하세요. 테스트 로그 및 운영 환경 정보는 로컬에 저장됩니다. `.tmp/cross-platform-cli-20261014/`，커밋하지 마십시오. 소스 코드 고정 장치는 다음 위치에 있습니다. `tests/acceptance/`。공식적인 Windows/Linux 설치 패키지, 기본 GUI、ARM64 모바일 장치는 여전히 그에 따라 검사되고 승인되어야 합니다.。

## v2.1.0 네트워크 진입 및 바인딩 보안（2026-10-14，지역 후보）

이번 라운드는 로컬에서 시작됩니다. main `bbfe6d4` 지점 구현 및 통합. 원래의 v2.0.4 후보 콘텐츠 병합 v2.1.0 공개될 범위; 아래 이력 기록은 현재 버전 이름과 검증 조건을 유지합니다. 공개 버전은 아직 v2.0.3，이 라운드는 푸시, 태그 지정 또는 게시되지 않았습니다. 공식 다중 플랫폼 빌드가 실행되지 않았습니다.。

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 연결 인터페이스 | 현실 Electron 렌더러는 기본적으로 연결 모드를 확장합니다. 기존 침투 기본 양식만 필요 HTTPS 주소와 기본 도메인 이름은 Enter 키를 눌러 저장하고 프로토콜을 완료할 수도 있습니다. 접힌 상태를 유지하기 위해 실제 포트 대상을 복사하고 새로 고치고 언어로 전환할 수 있습니다. 오래된 NAS 프리미엄 포지션 및 업스트림 예약 | 독립된 데이터 디렉토리, 실제 터널 시작 없음; 중국어와 영어 820/1100 픽셀이 수평으로 오버플로되지 않습니다. |
| 외부 HTTPS | external 등록만 가능 publicUrl，닫도록 허용 LAN 로컬 웹페이지에 대한 액세스 고정 주소, 페어링, 알림, 출입 감지를 위한 기존 경로 공유 | 사용자 관리 침투、DNS、설치되지 않았거나 호스팅되지 않은 인증서 frpc；임의의 하위 경로는 지원되지 않습니다. |
| 접근 보안 | 신뢰할 수 있는 인증서, 잘못된 업스트림, 인증서 거부, 리디렉션 거부, 정확함 Host/Origin、CSRF、Secure/HttpOnly/SameSite Cookie 둘 다 확인되었습니다. 두 구성 항목은 교차할 수 없습니다. Origin | 공공의 instanceId 라우팅만 확인하고 자격 증명 마이그레이션을 승인하지 않습니다. 시스템 신뢰 저장소를 수정하지 않습니다. |
| HTTP 연결 재사용 | 패키징 승인이 소켓 닫기에 대한 거부 응답을 찾았지만 닫기 헤더가 전송되지 않았습니다. 이제 마감일에 보냈습니다 Connection: close，원래 오류 상태를 유지하십시오. 같은 HTTP 클라이언트 403 이후에는 정상적으로 공용출입, 인증관련 요청이 가능합니다. 41 항목 회귀 통과 | 알 수 없는 쓰기를 재시도하지 말고, 입력 제한을 완화하지 마세요. |
| 바인딩 복구 | 격리 TLS 실제 게이트웨이 서비스가 다시 시작된 후 에이전트의 스캔 코드 신뢰 바인딩이 복원됩니다.，Cookie 이름은 안정적입니다. 종료 및 취소 후에는 무효화됩니다. 네이티브 소스 코드 확인은 주소별로 유지 및 복원됩니다. HMAC 교차 주소 증명 | 미운영 법인 Android/iPhone 시스템 스토리지; 새로운 교차 포털 복구 프로토콜이 추가되지 않습니다. |
| 프록시 데이터 흐름 | 19 아이템 네이티브 TLS 에이전트 확인을 통과했습니다. 로그인됨 SSE 상태 이벤트 통과；358400 바이트 결합 파일 길이 및 SHA-256 일관된 | 에이전트 고정 장치는 다음을 읽습니다. SSE 이벤트; 장기 스트림, 재연결, 실제 터미널 또는 공용 네트워크 노드가 확인되지 않음 |
| 소스코드 반환 | 후방 source-only 흔한 1674 개：1645 통해、29 조건부 건너뛰기; 전체 프런트엔드의 첫 번째 라운드 633 종 시앙 632 통해、1 건너뛰기, 소켓 제한 2 픽스처 세트가 다시 실행되도록 허용되었습니다. 프런트 엔드는 이후에 영향을 받았습니다. 75 항목이 통과됨 | 교체할 수 없습니다 Windows、Linux 또는 다른 아키텍처 기본 수용 |
| 도움말 페이지 | 중국어 및 영어 이중 언어 추가 external 가이드，7 연결 선택이 패널과 일치합니다. 중국인 1100px、영어 390px 브라우저에 수평 오버플로가 없습니다. | 온라인 웹사이트는 아직 업데이트되지 않았습니다. 지역 가이드와 코드는 동일한 배치로 컴파일됩니다. |
| macOS 테스트 패키지 | main `4cc839b` 엮다 arm64 Test App，깊고 엄격한 서명, 현실의 고립 UI 내장 worker 합격; 포장이 진행되면 닫힙니다. LAN 지역 웹페이지가 등록되어 공개되었습니다. Host 로그인、Secure Cookie、Origin/CSRF 연결 재사용과 거부된 연결이 모두 통과됩니다. | 공증되지 않은 현지 서명 사용된 2.0.3 공식적으로 메타데이터 구축 v2.1.0 버전 전환 및 멀티 플랫폼 빌드는 아직 수행되지 않았습니다. |
| 8788 배달하다 | 새로운 Test App 보관된 테스트 데이터를 사용하여 켜기 LAN；LAN 로그인、CLI 패시브 히스토리, 소스 필터링、CLI 구성 읽기 및 11 채택된 공유 자원 요약 공식적인 8787 의 PID 인스턴스와 변함없이 유지 | 사용자의 원래 세션에는 메시지가 전송되지 않습니다. 공개 침투 주소와 휴대폰 셀룰러 네트워크는 여전히 사용자가 테스트해야 합니다. |

이번 라운드의 로그、TLS 설비 및 스크린샷은 로컬에 저장됩니다. `.tmp/network-entry-20261014/`，제출하지 마세요 Git。모바일 셀룰러 네트워크와 구체적인 침투 서비스는 이후의 실제 테스트를 통해 여전히 확인되고 있습니다. 진입 감지에 성공했다고 해서 채팅, 단말기, 대용량 파일 등 공용망 링크 전체가 승인된 것은 아닙니다.。

읽기 전용으로 확인됨 [issue #35](https://github.com/try2love/codex-mobile-bridge/issues/35)：해당 팁은 다음에서 제공됩니다. Host 공용 출입구를 등록하지 않고 포트 매핑만 하는 시나리오와 일치하는 허용 목록 확인이 생성됩니다. 이 사용자의 실제 요청 헤더는 표시되지 않으므로 프록시 재작성을 배제할 수 없습니다. Host 또는 포트가 손실되었습니다. 구성 가이드에서는 두 가지 이유를 모두 다루며 보안 확인이 꺼지지 않았으며 GitHub 댓글을 달거나 닫기 issue。

## v2.1.0 머리말 CLI 인터페이스 피드백을 통한 보충 녹음（2026-10-14）

`bbfe6d4` 제공자별 통합 기여 CLI 계정 패널, 모델 목록 엔드포인트 탐지、Claude 로컬 머신/SSH 새로운 CLI 세션, 실제 재고 발생을 기준으로 유형 필터링, 날짜 위 유형 라벨、Codex/Claude 목록 정렬、Claude 상황별 링, 카드 입력 재설정, 다운로드 임계값 위치 조정 등이 가능합니다. 현재 네트워크 변경 라운드를 완료하기 전에 사실을 기록하고 이전 테스트를 이번 라운드의 새로운 증거로 간주하지 마십시오.。

선주문 확인 범위 320px 중국어와 영어、390px 휴대폰 케이스 레이아웃 및 1440px Web；알려진 용량과 알 수 없는 용량이 있는 컨텍스트 링、32px 작업 표시줄 정렬 및 세부정보가 전달되었습니다. 네이티브를 분리 Claude Code 로컬 및 루프백 SSH 구성 확인/폴더/합성 인증 상속, 새로운 네이티브 session id、첫 번째 메시지는 한 번 전송됩니다.、JSONL 역사적 및 상황별 사용법 원격이 아닌 기본 가짜 모델 인터페이스를 사용합니다. Linux 또는 수락을 요청하기 위해 비용을 지불합니다. 토종의 SSH 작동하다、Skill、권한, 업로드, 승인 및 중단의 확인 범위에 대한 자세한 내용은 해당 구현 노트를 참조하세요.。

---

## SSH CLI Goal、권한 및 Claude Code 실행할 수 있음（2026-10-14，v2.0.4 출시 예정）

이 섹션은 다음에 대한 다음 섹션을 업데이트합니다. CLI 권한 및 SSH Goal 제한。Goal 명시적으로 연결된 개방형 및 기본 프로토콜 지원 SSH CLI；원격으로 Codex App 진행된 세션은 동일하게 유지됩니다. owner，다른 런타임을 열지 마십시오.。CLI 현재 실행 연결을 기준으로 권한을 처리하며, 채팅 버튼은 다음과 같이 축약됩니다.“전체 액세스”，확인 프롬프트는 완전한 의미를 유지합니다.。

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 소스코드 반환 | 후방 1574 개：1545 통해、29 건너뛰다; 프런트 엔드 615 개：614 통해、1 뛰어넘어라. 최종 권한 창 Anti-Chaining 수정 후 백엔드 방향 90 항목, 프런트엔드 방향 32 항목이 통과됨 | 첫 번째 제한된 실행에 대해 격리를 바인딩할 수 없습니다. socket，그런 다음 로컬 통신이 통과할 수 있는 환경에서 다시 실행하세요. 건너뛴 항목은 통과로 간주되지 않습니다. |
| 네이티브 CLI 및 SSH | Codex CLI 0.162.1 일시적인 후에 OpenSSH 채널 완성 네이티브 Goal 생성, 일시 중지, 수정, 재개, 지우기 및 연결 해제 권한 상태 및 후속 모델 요청은 선택된 권한을 반영합니다.，Goal 생성 및 재연결 후 복원도 새 권한을 따릅니다. | SSH 교체되지 않은 기본 격리 환경을 대상으로 함 Linux 원격 실제 기계; 모델 서비스는 로컬 사전 설정 응답만 반환하며 외부 추론 비용은 없습니다. |
| 권한 경계 | 이 기계와 SSH CLI 같은 것을 읽으세요 daemon 전략; 낙관적이지 않다 UI 성공적으로 구원받은 척하십시오. 세션, 연결 모드 또는 연결 상태가 변경된 후 이전 권한 창이 닫히고 서버는 일치하지 않는 런타임을 거부합니다. | 원본 유지 provider、인증、cwd 및 owner；알 수 없는 쓰기 결과는 다시 전송되지 않습니다. 사용자의 원래 채팅은 수정되지 않습니다. |
| 웹페이지 | 전체 액세스 토글 및 확인을 통한 실제 페이지 완료 요청 승인 중국어, 영어 390 px 수평 오버플로 없음，Goal 입장이 가능하며 중국어 버튼이 표시됩니다“전체 액세스” | 이번 라운드 공유 Web 백엔드 업데이트에서는 휴대폰의 원래 쉘이 다시 작성되지 않았습니다. 휴대폰 장치의 수동 테스트는 사용자의 몫입니다. |
| Claude Code 연구 | 2.1.287 독립하여 HOME、가짜 Key 루프백 가짜 서비스에 따른 완전한 콜드 복구, 다중 라운드 스트리밍, 모델 전환, 권한 전환, 중단 및 도구 승인 거부; 거부된 명령은 실행되지 않습니다. | 프로덕션 인터페이스에 연결되지 않았습니다. 실제 인증, 일반 프로젝트 구성 상속 및 활성 터미널 인수는 확인되지 않았습니다. 세부정보 보기 [타당성 확인](docs/claude-code-feasibility.md) |
| macOS 테스트 패키지 및 배송 | 현지의 main `5c15d2b` 엮다 arm64 Test App，중첩된 서명, 격리된 실제 부팅 및 내장 worker 수락이 통과되었습니다.；8788 LAN 로그인, 원본 CLI 역사와 현재를 저장하세요 Desktop owner、권한 및 기타 능력과 6 리소스 요약이 승인됨 | 공증되지 않은 로컬 서명, 빌드 버전은 여전히 2.0.3；테스트 바인딩 데이터 보존, 공식 8787 의 PID 인스턴스도 아니고 |

이번 라운드의 모든 독립 분기가 로컬로 병합되었습니다. main，푸시 금지 GitHub。브라우저 수용 공간, 종합 세션 프로세스 및 임시 SSH 제공하다/열쇠가 닫혀 있거나 청소되어 있습니다.。Windows/Linux 기본 실제 머신 및 외부 SSH 아직 실제 테스트에 서버가 추가되지 않았습니다。

## CLI 모델、Skill、계획을 세우다 Goal（2026-10-14，v2.0.4 출시 예정）

마지막 라운드에만 공개 CLI 기본 채팅 작업, 모델、Skill 모드는 여전히 소스 제한으로 인해 차단됩니다. 이번 라운드에서는 실제 실행 프로세스에 따라 필요한 기능을 개방하고 원본을 유지합니다. owner、공급자, 인증 및 작업 디렉토리。

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 라우팅 및 기능 | App 연속적인 CLI 기존 사용 owner；네이티브 CLI 디렉토리, 설정、Skill、계획과 지역 Goal 같은 것을 사용하세요 daemon；연결되지 않은 경우 디렉토리 읽기가 활성화되지 않으며 연결이 끊긴 경우에도 유지됩니다. Skill 초안 | 열리지 않음 CLI 권한 설정 및 편집/분기, 이름 변경 및 사이드 채팅；SSH Goal 여전히 비활성화됨 |
| 기본 프로토콜 | 격리 macOS CLI 0.162.1 실제 검증 모델/effort 설정、Skill 입력하다、plan/default 둥글고, Goal 생성, 일시 중지, 수정, 재개, 지우기; 계획 이전 Goal 사용 default，수정된 대상이 기본 실행 요청에 도달함 | 모델 Responses 이 서비스는 외부 추론 비용 없이 기본적으로만 시뮬레이션됩니다. 외부 모델 출력의 품질이나 다른 플랫폼에서의 검증을 기반으로 한 주장은 이루어지지 않습니다. |
| 실제 웹페이지 | 모델을 수정하려면 브라우저를 클릭하고 선택하세요. Skill、보내고 완료할 계획 Goal 작업 패스; 모델/effort/Skill 모의 서비스에 인수 도착；390 px 영어 페이지에는 수평 오버플로가 없으며 권한은 여전히 ​​비활성화되어 있습니다. | 이번 공유 인터페이스 및 백엔드 수정으로 인해 휴대폰의 기본 셸은 다시 작성되지 않았으며 장치의 수동 테스트는 사용자에게 맡겨졌습니다. |
| 반품 | 후방 source-only 1565 개：1503 통해、62 건너뛰다; 프런트 엔드 613 개：612 통해、1 건너뛰다; 마지막 Goal 복구를 활성화한 후 관련 백엔드 116 아이템과 프론트엔드 24 항목이 통과됨 | 첫 번째 백엔드 실행에서는 두 항목을 재현합니다. Desktop catalog 반품 및 수리 체계 Python 부족 Paramiko，결국 신규 설치 없이 기존의 완전한 의존성 환경을 그대로 사용하게 되었습니다. |
| 로컬 테스트 패키지 | macOS arm64 동결 빌드, 독립형 Test App 패키징, 심층적이고 엄격한 서명 검증 및 실제 시작 패스 격리 | 실시되지 않음 Windows/Linux/SSH 기본 플랫폼 수용; 없음 GitHub 업로드 |
| 8788 배달하다 | LAN 로그인, 원본 CLI 소스 세션 저장 기록과 기존 비교 Desktop owner、4가지 제어 기능, 진단 및 6 채택된 공유 자원 요약 공식적인 8787 프로세스와 인스턴스는 변경되지 않고 유지됩니다. | 사용자의 원래 세션을 읽기 전용으로 확인하세요. 테스트 바인딩 데이터 상속, 이전 테스트 App 나가서 청소하세요 |

Goal 일시 중지해도 현재 복구가 중단되지는 않습니다. 기본 복구는 즉시 실행을 계속할 수 있으며 승인이 보장되지 않습니다.“유휴 상태로 돌아 가기”실수로 제작됨 Goal 성공조건. 빈 모델 설정, 재연결 상태 손실 및 연결 끊김에 대한 성공적인 응답에서 오탐지를 발견하고 수정했습니다. Goal 버튼이 다시 활성화되고 계획 모드가 Goal 상속 문제. 사용자의 원래 세션에서는 테스트 메시지를 보내지 않았거나 설정을 수정하지 않았습니다.。Windows、Linux 와는 다르다 SSH 환경의 기본 상호 작용은 아직 테스트되지 않았습니다. 푸시되지 않은 로컬 수정만 가능 GitHub。

## CLI 연결 복구가 수행되었습니다.（2026-10-14，v2.0.4 출시 예정）

네이티브 마지막 라운드 warm/cold 테스트 대상이 아님“CLI 작성자: Codex App 계속하다”세션이 작동 중임을 증명하기에는 세션이 충분하지 않습니다. 이번 수정 라운드의 출처는 실행 소유권과 혼동됩니다. 검증된 기존 수정 사항을 따르는 것이 우선순위입니다. App owner，없음 owner 언제 명시적으로 유지 CLI 다시 덮다。

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 오류 보고 세션 | 진정한 네이티브 읽기 전용 owner 쿼리가 성공했습니다. 토종의 daemon 같은 ID 뒤로 notLoaded。대략. 복원 후 0.11 원본에 연결하는 데 몇 초 App owner，CLI 소스 태그, 전송 가능 상태 및 저장 내역 보존，native attach 0이다 | 사용자의 원래 세션으로 테스트 메시지가 전송되지 않거나 원래 데이터베이스가 수정됩니다. |
| 네이티브 writer | 격리 CLI 0.162.1 두 번째 런타임 복구가 다시 나타납니다. active-writer 거부됨; 원래 보유자는 정상적으로 다시 접근할 수 있습니다 | 모델 호출 없음, 복사 없음 auth/config；모든 테스트 프로세스가 삭제되었습니다. |
| CLI-only | 실제로는 Desktop IPC 사용 가능하지만 해당 테스트 세션이 없습니다. owner 쿼리 시간 초과가 지난 후 명시적인 기본 콜드 복구가 수행되는 경우 | 아이템 사용 .tmp 테스트 이력 모델 호출이 없습니다. 시험 daemon 닫은 |
| 라우팅 및 반환 | 기존의 App owner 대상 보내기、cwd/provider/host 확인, 양방향 지연 이벤트, 동시 연결, 연결 끊김 및 페이징 기록 회귀가 통과되었습니다. 백엔드 source-only 1549 개：1487 통해、62 건너뛰다; 프런트 엔드 611 최종 항목 610 통해、1 뛰어넘다 | 처음으로 프런트 엔드에 두 개의 개체가 있습니다. loopback 샌드박스 제한으로 재실행이 개별적으로 전달될 수 있습니다. 건너뛰는 것은 합격으로 간주되지 않습니다. |
| 로컬 빌드 | macOS arm64 Test App 빌드 동결, 패키징, 심층적이고 엄격한 서명 검증, 실제 시작과 내장 분리 worker 다음을 통해 로드 중 | 이 백엔드 복구로 인해 기본 휴대폰 셸을 다시 작성할 필요가 없습니다.；Windows/Linux/SSH 기본 플랫폼에는 실제 기계 수용이 추가되지 않았습니다. |
| 8788 포장 및 수용 | 새로운 테스트 패키지 실제 LAN 로그인, 사용자 출처 CLI 와의 채팅 기록 Desktop owner 연결, 연결 진단 및 5 채택된 공유 자원 요약；8787 PID 인스턴스와 변함없이 유지 | 테스트 바인딩 데이터는 유지됩니다. 이전 테스트 패키지가 종료되고 정리되며 테스트 메시지가 사용자의 원래 세션으로 전송되지 않습니다. |

로컬 수정 및 병합만 가능, 푸시 없음 GitHub。CLI 소스 모델/권한, 대상, 편집 등의 작업은 이전 제한 사항을 그대로 유지합니다. 규약 writer 잠금은 기본 런타임에 의해 관리됩니다. 이번 라운드에는 잠금이 해제되지 않으며 기존 보유자는 닫히지 않습니다. 세부정보 보기 [CLI 액세스 지침](docs/codex-cli.md) 및 [라우팅 결정](.agents/notes/implemented/bug-fix/2026-10-14-cli-existing-owner.md)。

---

## CLI 터미널을 닫고 계속하세요（2026-10-14，v2.0.4 출시 예정）

이 섹션을 다음 섹션으로 업데이트하세요.“이미 운영 환경에 액세스할 수 있음”제한사항: 명시적“대화 계속하기”이제 언로드된 채팅을 재개하고 필요한 경우 동일한 채팅을 시작할 수 있습니다. CODEX_HOME 기본 호스팅을 설치했습니다. daemon。자동으로 설치되지 않습니다 CLI 또는 일일 프로젝트의 신뢰 설정을 변경하세요.。

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 현실 CLI | macOS CLI 0.162.1，현실 TUI 격리된 채팅을 만드세요. 원래 터미널이 종료되고 제거 후 채팅이 성공적으로 복원됩니다.；daemon 중지 후 콜드 스타트 ​​복구가 성공했습니다. 같은 ID 보내기, 스트리밍 응답, 중복 방지 제출 및 provider/model/cwd 계속 통과하세요. 이벤트 완료 후 사용자 메시지 보존에 대한 수정 사항도 true로 전달되었습니다. CLI 재테스트; 다시 열다 TUI 두 개의 게이트웨이 응답이 있음을 알 수 있습니다. daemon PID 끊임없는 | 사용자의 원래 채팅은 확인을 위해 읽기 전용이며 테스트 메시지가 전송되지 않습니다. 신뢰 및 자격 증명 사본은 프로젝트에만 사용됩니다. .tmp 격리 구성 |
| Web | 현실 HTTP 페이지 클릭“대화 계속하기”콜드 스타트 ​​성공, 전송 후 수신됨 CLI_WEB_RESUME_OK；읽을 수 있는 진단 요약, 설정에서 내보내기 복사 및 트리거 | 기본 요청은 느리게 응답한 다음 자동 재전송 없이 자체적으로 완료됩니다. 수락은 지연 보장으로 간주되지 않습니다. |
| 반품 | 후방 source-only 1537 개：1475 통해、62 건너뛰다; 최종 검토 후 CLI/제공하다/SSH/프로토콜 방향 43 항목이 통과되었습니다. 완전한 프런트 엔드 611 개：610 통해、1 뛰어넘다 | 건너뛰는 것은 포함되지 않습니다. 고정 장치의 통과로 인해 플랫폼 경계가 사라지지 않습니다. |
| 기본 진단 다운로드 | Android Java 및 iOS Swift Foundation 실제 HTTP 정확한 소스를 포함하여 다운로드 테스트 통과/경로 확인 및 동적 부분 보고서는 재개가 금지됩니다. 릴레이 이중 컴퓨터 격리 및 인증 통과；Android 시뮬레이터 실제 App 로그인하고 진단을 확인한 후 내보내기를 클릭하고 완료하세요. 346 B JSON 다음을 통해 다운로드 | iOS 이번 라운드에서는 시뮬레이터의 설치 및 시작만 완료되고 Foundation 재테스트되지 않은 공동 디버깅 다운로드 WebView 클릭수 내보내기 시스템 공유가 허용되지 않습니다/패널 저장 |
| 짓다 | macOS arm64 Test App 컴파일, 중첩된 서명, 실제 실행 및 내장 worker 통해；Android APK 짓다/징후、iOS 시뮬레이터 완성 빌드/설치하다/시작하다、iOS 서명되지 않은 IPA 빌드 패스 | Test 공증되지 않은 현지 서명；IPA 직접 서명하고 설치해야 합니다. 아직 사용 중 2.0.3 게시되지 않은 빌드 메타데이터 v2.0.4 |
| 8788 측정된 입구 | 다시 시작한 후에도 원래 테스트 바인딩 데이터를 유지합니다. LAN 로그인, 사용자 출처 CLI 채팅 패시브 이력, 진단 대상 상태 및 5 공유 리소스 요약이 확인 및 통과되었습니다. | 공식적인 8787 PID 인스턴스와 변함없이 유지；Windows/Linux 그리고 어떤 SSH 호스트의 콜드 복구가 실제 시스템에서 아직 승인되지 않았습니다. |

SSH proxy 에서 PATH 없음 CLI 선택한 호스팅 프로그램을 사용할 때 shell 고정 장치 테스트를 통과했습니다. 이는 원격 실제 기계 테스트를 대체하지 않습니다. 자세한 동작 및 제한 사항은 다음을 참조하세요. [CLI 액세스 지침](docs/codex-cli.md)。이번 라운드는 푸시가 아닌 로컬 병합만 가능합니다. GitHub。

---

## Codex CLI 현지 승인에 액세스（2026-10-14，v2.0.4 출시 예정）

| 범위 | 확인됨 | 경계 |
| --- | --- | --- |
| 이미 CLI 역사 | 사용자가 제공한 로컬 세션은 다음과 같습니다. SessionStore 검색 및 읽기 전용；CLI 마크, 늙었어 schema 하위 작업을 제외하고 회귀를 통과했습니다. | 이 사용자 세션에 테스트 메시지가 전송되지 않았습니다. |
| 기본 운영 환경 | macOS Codex CLI 0.162.1 격리 TUI 세션: 수동 읽기는 기본 연결, 명시적 액세스, 전송, 스트리밍 응답 및 반복 제출 보호 패스를 설정하지 않습니다. 공급자, 모델、cwd 일관성을 유지하세요 | 테스트 디렉터리 신뢰는 사용자에 의해 명시적으로 승인되며 격리된 경우에만 보관됩니다. CODEX_HOME；일일 신뢰 설정이 변경되지 않았습니다. |
| 브라우저 | 현실 HTTP 게이트웨이 중국어/영어 인터페이스；390px 수평 오버플로가 없습니다. 읽기 전용/구별, 전송, 중지, 진단 및 다운로드에 대한 연결 기능이 통과되었습니다. 공식 원주민 thread/read 최종 작업이 다음과 같은지 확인합니다. interrupted | 승인 및 질문 카드 번호 ID、프로토콜에 따른 알 수 없는 결과 및 동시 재전송 방지/서비스 설비 확인, 모든 실제 주장이 주장되는 것은 아닙니다. MCP 모든 승인은 공동으로 검토되었습니다. |
| SSH | 현재 도달 가능한 서버 읽기 가능 세션 소스 수와 이미 사용 가능한 읽기 전용 연결이 구성되어 있습니다. daemon、로드된 세션 나열 | 원격 작업이 전송되지 않았습니다. 다른 사용자 A/B/C 연결할 수 없으며 특정 결함의 재현 또는 수리 확인을 주장할 수 없습니다. |
| 반품 | Python 전체 1528 개，26 건너뛰기, 실패 없음；Desktop/Web 전체 609 개，608 통해、1 뛰어넘어라. 최종 연결 읽기 스레드가 수정된 후，29 모든 기본 프로토콜 및 서비스 통합 방향 테스트를 통과했습니다. | 기본 플랫폼 제한은 여전히 ​​현재 버전을 기반으로 합니다. macOS 상황에 따라 달라질 수 있습니다. 대체 없음 Windows/Linux 실제 기계 수용 |
| macOS Test App | arm64 Test App 재패키지, 중첩된 서명, true App 시작 및 내장 worker 통해 | 공증되지 않은 현지 테스트 서명 버전은 여전히 ​​​​후보 코드를 사용합니다 2.0.3 게시되지 않은 메타데이터 v2.0.4 |
| 최종 시험 입장 | 독립적인 Test App 에서 8788 LAN 액세스를 활성화합니다. 실제 로그인, 원본 CLI 세션 목록, 수동 기록 읽기, 진단 대상 상태 모두 통과；5 공유 인터페이스 리소스는 소스 코드 요약과 일치합니다. | 공식적인 8787 게이트웨이는 원래 프로세스와 인스턴스를 유지합니다. 읽기 전용 확인은 사용자의 원래 세션에 메시지를 보내지 않습니다. |
| 휴대폰 App | 이번에는 CLI 게이트웨이 및 공유에 변경사항이 적용됩니다. Web，수정되지 않은 Android/iOS 네이티브 코드; 브라우저 좁은 화면 상호 작용이 확인되었습니다. | 이번에는 iOS Simulator UI 컨트롤이 응답하지 않고 입력되지 않습니다. App、완료되지 않음 WebView 재검사; 합격으로 간주되지 않음。Android 이번 라운드에서는 재승인이 없으며 사용자는 기존 테스트를 사용해야 합니다. App 실제 측정 |

기존의 daemon 다음을 사용하여 업스트림에 대한 명시적 액세스 `thread/resume`。이 인터페이스에는 원자가 없습니다. loaded-only 조건에 따라 제거 작업과 확인 작업이 동시에 수행되면 동일한 세션을 초기 복원할 수 있습니다. 사전 확인을 절대적인 것으로 설명하지 마십시오. owner 보장하다. 전체 기능 제한 사항은 다음을 참조하세요. [CLI 액세스 지침](docs/codex-cli.md)。이번 라운드에는 밀리지 않았습니다. GitHub。

---

## v2.0.4 로컬 최적화 수용（2026-10-13，출시 예정）

범위는 v2.0.3 다음 이후의 파일 디렉터리를 반환합니다.、Claude 수동 할당량, 소스 코드 읽기、PDF/HTML 미리보기 및 후속 파일 헤더, 전체 화면 및 PDF 도면 최적화. 최종 코드는 로컬입니다. main `077d9c2`，PDF 연속 그리기는 다음과 같이 고정됩니다. `a91842a`。사용자는 이번 테스트가 통과되었음을 확인했습니다. 현재 설치 패키지 버전은 아직입니다. 2.0.3；v2.0.4 출시 예정인 문서 버전이며 아직 통합 구축, 푸시, 태그 지정 또는 출시되지 않았습니다.。

| 범위 | 인증 완료 | 경계 |
| --- | --- | --- |
| 자동반환 | 결정적인 Node 603 개：602 통해、1 건너뛰기, 실패 없음；PDF 정위 20/20。4개의 통합 백엔드 source-only 반품 1495 개：1466 통해、29 건너뛰기, 이후에는 실패 없음 PDF 변경되지 않은 백엔드 수정 | source-only 기본 플랫폼 픽스처는 실행되지 않습니다. 건너뛴 항목은 패스로 간주되지 않습니다. |
| 디렉토리 반환 | 합성 디렉토리 `src/lib → src → 뿌리 → 채팅`，Codex 상단 버튼, 공유 반환, 빠른 반환 및 지연 응답 보호 재정의；iOS 시뮬레이터는 단계별로 돌아옵니다. | 모든 시스템 역사적 제스처가 다루어졌다고 주장되지는 않습니다. |
| Claude 몫 | 수동적 읽기가 해독되지 않았거나 인터넷에 연결되지 않았는지, 명시적 쿼리가 새로 고쳐졌는지, 실패하고 인식되지 않은 응답이 성공적인 스냅샷과 원래 시간을 유지하는지 확인하십시오. 중국어, 영어 자격 합격 | 시뮬레이션된 데이터를 사용합니다. 사용자 계정 할당량 인터페이스는 실제로 호출되지 않습니다. 이는 모든 키체인 문제가 해결되었음을 의미하지 않습니다. |
| 소스 코드 및 레이아웃 | 320/390px 중국어 및 영어 파일 헤더 및 소스 코드 강조 표시/줄 번호, 긴 줄 바꿈, 알 수 없는 언어 및 한도 초과 성능 저하; 중국인、CRLF、NBSP 복사한 원문과 동일 | 읽기 전용 소스 코드 보기; 이번 라운드에서는 터미널 색상이나 커서가 변경되지 않았습니다. |
| PDF 전체 화면으로 | Chromium 중국어 텍스트 레이어 확인, 스캔 페이지, 손상됨/오버런, 혼합 페이지 너비, 탭 왕복 및 전체 화면 위치 터치 에뮬레이션 핀치 줌 100%→200%，페이지의 전체 비율이 유지됩니다. 1 | 처음으로 열거나 그려지지 않은 페이지로 이동할 때 여전히 로드해야 합니다. 스캔한 사본은 그렇지 않습니다. OCR |
| PDF 스플래시 화면 수정 | 그리기 지연, 이전 작업 취소, 텍스트 레이어를 원래 비율로 복원, 인접 페이지 재사용, 예산 제출로 돌아가기 등이 차례로 통과되었습니다. 프런트 데스크 Chromium 에서 6 타임스 CPU 속도 제한에 따른 빠른 스케일링: 수정 전 짧은 샘플링 4 프레임 내 2 수리 후 프레임에 눈에 띄는 캔버스가 없습니다. 7 프레임에는 공백 또는 검은색 캔버스가 관찰되지 않습니다. 결국 인접한 페이지는 재사용된 원본으로 반환됩니다. canvas | 짧은 샘플은 렌더링 순서를 확인하며 프레임 속도 벤치마크 또는 문서에 대한 깜박임 없음 보장으로 사용되지 않습니다. 단일 독자가 캔버스를 완성합니다. 12 MP、추가 도면 약. 4 MP，모든 메모리 용량이 제한되는 것은 아닙니다. |
| HTML 격리 | 인라인 상호작용/애니메이션, 소스 코드 전환, 전체 화면 상태 및 라벨 반환 다시 로드 패스；cookie、storage、상위 페이지 및 호스트 브리지에 대한 액세스가 차단되고 네트워크, 양식 및 최상위 점프 검사가 합성 대상에 도달하지 않습니다. | 자체 포함된 파일만 해당됩니다. 외부 리소스 및 백엔드 종속성은 지원되지 않습니다. |
| Android | 시험 APK 빌드 및 서명 확인이 통과되었습니다. 시뮬레이터 믹싱 PDF 한 손가락 슬라이딩, 전체 화면, 라벨 왕복 위치 및 HTML 재마운트 통과 | 시뮬레이터가 기본 두 손가락 삽입을 완료하지 않았습니다. 비공식 출시 APK 수락 |
| iOS | Xcode 16.2 + iOS 18.2 Simulator 전체 빌드, 설치 및 실행 처음으로 연결하다/재연결, 소스코드 줄 바꿈, 중국어 및 혼합 크기 PDF、HTML 격리, 전체 화면, 크기 제한 및 디렉터리 반환 패스. 스플래시 화면 수정 후 다시 테스트 PDF 표시 및 전체 화면 | 이번 라운드에는 새로운 물리학이 설치되지 않았습니다. iPhone；에뮬레이터 자동화는 기본 빠른 스와이프 또는 두 손가락 제스처를 안정적으로 검증하지 않습니다. 전체 사용자 확인은 모델별 및 제스처별 매트릭스로 확장되지 않습니다. |
| macOS 테스트 패키지 | arm64 시험 App 아키텍처, 중첩된 서명, 내장 런타임、HTTPS 실제 격리 시작을 통과했습니다. 업데이트된 테스트 게이트웨이 리소스는 최종 소스 코드와 일치하며 구성은 유지됩니다. | 공증되지 않은 현지 테스트 서명 공식적으로 게이트웨이를 실행하고 원래 프로세스와 인스턴스를 유지합니다. |

정식 출시에 앞서 버전을 통일하고 완성해야 합니다. Windows x64、macOS arm64/x64、Linux x64/arm64、Android 및 iOS 해당 릴리스 빌드 및 서명/완전성과 적합성의 수용. 아래 재사용 불가 v2.0.3 CI 결과는 이번 공식 구성이 통과되었다는 증거로 사용됩니다.。

---

## v2.0.3 공식 버전 확인（2026-10-13）

이 섹션의 기록 v2.0.3 사용자 수용, 소스 코드 회귀 및 네이티브 플랫폼 구축 결과. 데스크탑、Android、iOS 버전은 다음과 같이 통일됩니다. 2.0.3，Android/iOS 빌드번호는 30。다음 표는 공식 빌드 확인을 통해 최적화 중 사용자 승인을 보여줍니다.。

| 범위 | 인증 완료 | 경계 |
| --- | --- | --- |
| 채팅 목록, 검색 및 설정 | 로컬 프런트엔드 완전 반환 560 개：559 통해、1 건너뛰다; 전체 백엔드 반환 1488 개：26 건너뛰면 실패가 없습니다. 브라우저는 중국어와 영어, 클라이언트 3개, 휴대폰 가로 및 세로 화면, 태블릿 너비 및 310px 사이드바; 후속 설정 행은 320px、390px 아래에는 클리핑이나 겹침이 없습니다. | 이는 최종 릴리스 빌드에 대한 전체 플랫폼 승인이 아닌 최적화 기간 동안의 단계적 반환입니다. 브라우저 크기 시뮬레이션은 실제 태블릿과 병풍을 모두 다룰 수는 없습니다. |
| 목록 복구 및 워크벤치 | 풀다운 새로 고침, 오류 프롬프트 복구, 검색 필터 유지, 수평 및 수직 화면 초안 및 스크롤 위치, 도구 탭을 닫은 후 화면 분할 상태 확인 | 제어된 브라우저 고정 장치 및 방향성 회귀 사용 |
| 로그인 및 장치 바인딩 | 진정한 원주민 HTTP 세션 확인 Cookie 격리；Android/iOS 기본 자격 증명 확인 장치가 통과되었습니다. 패키징 게이트웨이 스캔 코드, 일회성 상환, 영구 바인딩, 재시작 복구 및 취소가 통과되었습니다. | 모든 시스템 정리, 키체인 예외 또는 장치 마이그레이션 시나리오가 실제 장치에서 다루어졌다는 의미는 아닙니다. |
| 제3자 통지 | 채널 읽기, 저장, 라우팅 테스트, 만료된 요청 격리 및 공유 릴레이 권한 회귀를 통과했습니다. | 제어된 네이티브로 모의 응답 사용 HTTP；그에 따라 주장되지 않음 Bark、ntfy、PushPlus 모두 실제 모바일 배경으로 제공됩니다 |
| macOS Claude 연결 | 드디어 수리됐다 78 항목의 지정 회귀가 통과되고 격리 편집기의 전체 입력 및 예외 입력 검사가 통과됩니다. 그런 다음 사용자는 테스트 게이트웨이에 대한 실제 연결이 통과하는지 확인합니다. | 실제 연결 확인은 이번 라운드에서 옵니다 macOS 시험; 모두에게 추정하지 마세요 Claude 버전、Windows 또는 잠금 화면 콜드 스타트 |
| macOS 시험 App | Apple Silicon 테스트 패키지 아키텍처, 서명 무결성, 내장 런타임、HTTPS 격리 확인을 통과한 스타트업 | 로컬 테스트 서명을 사용하며 공증은 수행되지 않습니다. 패키지의 공식 릴리스를 나타내지 않거나 Intel 네이티브 검증 완료 |
| Android 고쳐 쓰다 | 인앱 다운로드, 크기/SHA-256 검증, 설치 권한 이전, 프로세스 종료 후 다운로드된 패키지 복구, 회귀 후 내보내기 및 재시도 실패 및 Android 시뮬레이터 검증; 컴퓨터 지원 다운로드 및 명시적 다운로드 방법 선택 완료 격리 테스트, 사용자 확인 Android 베타 버전 사용 가능 | 설치 연습에서는 제어된 LAN 업데이트 소스를 사용합니다. 사용자별 네트워크를 대체하지 않습니다. GitHub 공식 자산 검증 다운로드 |
| iOS 시험 App | 마치다 Swift 확인, 서명 및 공유된 리소스는 사용자의 연결에 확인 및 설치됩니다. iPhone 실제 테스트를 위해 | 장비 설치가 모두 같지는 않습니다. iOS 기능이 승인되었습니다. 공식 배포에는 여전히 사용자의 서명이 필요합니다. |

### 공식 빌드 승인

- [소스 코드 CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/38368945783) 모두 통과되었습니다. 모든 환경이 실행됩니다. 1489 백엔드 테스트：Windows Python 3.9/3.13 각각 건너뛰기 37 개，Ubuntu Python 3.9/3.13 각각 건너뛰기 35 개，macOS Python 3.13 뛰어넘다 33 품목; 아무도 실패하지 않았습니다. 건너뛰기 항목은 플랫폼 조건 또는 선택적 환경 제한 사항입니다.。
- Desktop/Web 반품：560 개，559 통해、1 아이템 플랫폼 조건을 건너뛰었습니다. 업데이터 회귀：32 개，31 통해、1 아이템 플랫폼 조건을 건너뛰었습니다.。Android/iOS 버전 분석, 모바일 다운로드 및 설치 복구, 네이티브 바인딩 선택 및 iOS 바인딩 복구 고정구 패스。
- [데스크탑 네이티브 CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/38368989555) 의 Windows x64、macOS arm64/x64、Linux x64/arm64 5개 과제 모두 통과。
- Windows：생성하다 Setup EXE 및 ZIP，팩 App 시작, 계속 터미널、HTTPS、알림, 로그인, 스캔 코드 페어링, 업데이트 성공/롤백과 진실 UI 업데이트 핸드오버가 통과되었습니다. 토종의 Claude 제어 장치가 통과되고 일반 연결이 사용됩니다. v2.0.2 길; 이것은 모두와 동일하지 않습니다 Windows/Claude 버전에 대한 실제 계정 연결 또는 설치 프로그램 테스트를 완료하세요.。
- macOS：Apple Silicon 및 Intel 모두 해당 아키텍처에 고유합니다. runner 짓다；DMG/ZIP 압축 풀기, 아키텍처, 서명 무결성, 내장 런타임、HTTPS、시작, 알림, 로그인, 페어링 및 업데이트 링크 확인을 통과했습니다. 다음으로 서명됨 ad-hoc，공증되지 않음；Intel 결과는 다음으로 인한 것이 아닙니다. Rosetta 바꾸다。
- Linux：x64/ARM64 의 Debian 패키지 설치, 아키텍처/버전, 패키징 런타임、HTTPS、알림, 로그인, 매칭 및 AppImage 포장 풀기 시작 확인 통과。Linux 아직 실험적인 지원，Claude 자동 초기화는 아직 지원되지 않습니다.。
- Android：2.0.3 / versionCode 30 의 APK 세워짐，v2/v3 서명 확인이 통과되었으며 서명 인증서는 다음과 같습니다. v2.0.2 풀어 주다 APK 일관된; 오버레이 설치에 필요한 애플리케이션 식별 및 서명 유지。
- [iOS 네이티브 CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/38368994811) 통과하다. 다운로드 후 확인 IPA 주인 App、두 확장 모두 2.0.3 / build 30，식별 및 리소스가 정확하며 서명이나 설명 파일이 포함되어 있지 않습니다.；Xcode 소스 코드 ZIP 후보자 제출 내용과 일치합니다. 설치에는 여전히 사용자 서명이 필요합니다.。
- [v2.0.3 태그 빌딩](https://github.com/try2love/codex-mobile-bridge/actions/runs/38371899527) 5가지 데스크톱 기본 목표 iOS 공식 배포 문서 생성을 위해 모두 전달됨。
- [릴리스 파일 무결성 CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/38375594938) 두 개의 완전한 다운로드 Release 초안, 모두 확인 15 파일과 14 항목 콘텐츠 파일 SHA-256；검증 목록을 업데이트한 후 다시 다운로드하면 검증이 통과됩니다.。Android 로컬에서 서명이 확인된 파일 APK 일관된；Windows x64、macOS arm64/x64 매니페스트 서명, 패키지 크기 및 해시 패스 업데이트 v2.0.2 업그레이드 확인. 이 기계는 작은 보고서와 검토 파일만 검색합니다. ID、크기, 개요 및 승인된 릴리스 노트가 초안과 일치합니다.。

이력검증기록은 다음과 같이 보관되며, 다음과 같이 이용되지 않습니다. v2.0.3 신규 합격 결과。

---

## v1.4.0 출시 후보 점검（2026-10-06）

- 사용자가 수락했습니다. Preview 공식 출시가 승인되었습니다. 예약된 PR #11 원래 커밋 기록 및 Preview 임시 호환성 수정。
- 로컬 완료 Python 전부 473 개：467 통해、6 개 Windows 조건부 건너뛰기；Desktop/Web 144 승인된 품목; 업데이트된 패키지 15 통해、1 개 Windows 조건부 건너뛰기。
- 확인되지 않은 전송은 명시적인 무시, 기록 보존을 지원하여 동일한 메시지의 자동 재전송을 방지합니다. 계정전환 차단 동기화가 해제되었습니다。HTTP 작업을 수행하려면 로그인, 동일한 소스 및 CSRF 확인되지 않은 기록만 처리할 수 있는 확인 명시적인 제공자는 기록을 보내기 전에 기록 확인을 거부합니다.。
- 빈 주소 입력란에 포커스가 맞춰지면 접기 화살표가 증가하여 제공됩니다. HTTPS 접두사. 최종 크로스 플랫폼 빌드, 서명 목록 및 온라인 자산 확인은 릴리스 워크플로에 의해 완료되고 로컬 Preview 검증 내역。

## v1.4.0-beta.3 인터페이스 검증（2026-10-06，널리 알려지지 않은）

- 회귀 Skill 설명 컷: 기존 카드 수정 74px，테스트 내용 필수 196px。적응형 높이 복원, 고정 높이 가상 목록 제거, 디렉터리 캐시 유지, 검색 및 페이징, 실제 스크롤 위치에 따라 후속 페이지 로드。
- 390px 휴대폰의 실제 측정된 너비에 대한 전체 설명을 볼 수 있습니다. 콘텐츠가 많을수록 카드 높이가 늘어나고 페이지가 가로로 넘치지 않습니다. 스크린샷이 확인되었습니다. 브라우저가 이전 버전을 계속 사용하지 않도록 스타일 및 스크립트 리소스 식별자를 업데이트하세요. CSS。
- Desktop/Web 반품 143 전체 설명, 실제 스크롤 페이지 매김, 검색 및 선택 상태를 포함하여 전달된 항목。
- 격리 Electron 확인 및 통과: LAN, 로컬 시스템 및 4개의 외부 네트워크 연결을 접을 수 있습니다. 기존 구성은 기본적으로 축소되고 새 구성은 확장되며 다시 그려도 상태는 유지됩니다. 접힌 온라인 가이드는 클릭 가능하며, 확인 오류는 자동으로 확장되어 배치됩니다.。
- beta.3 macOS arm64 DMG/ZIP 생성되었습니다. 팩 App 접기, 안내 및 격리 시작 중지 패스；DMG 아키텍처, 심층 서명, 내장 게이트웨이 및 TLS 확인이 통과되었습니다. 공증되지 않았으며 다른 플랫폼이 구축되지 않았습니다.。
- 현재 설치되어 있음 App 실제 게이트웨이는 교체되지 않습니다. 아니요 GitHub 온라인으로 푸시 또는 게시。

## v1.4.0-beta.2 직접 수리 확인（2026-10-06，널리 알려지지 않은）

- 일반 설치 재현 Skill 디렉토리를 차단한 기호 링크와 만료된 계정 전환 기록이 실수로 원래 공급자의 전송을 차단했습니다. 수리 전 실패, 수리 후 합격。
- 기본 읽기 전용 디렉터리의 실제 테스트：71 개인 Skill，디렉토리 오류 없음, 링크 유형 Skill 선택 과목; 첫 약속 0.172 초, 메모리 캐시는 약입니다. 0.0002 초, 디스크 캐시는 약입니다. 0.0006 두번째. 이는 성능을 보장하는 것이 아니라 현지 측정입니다. 테스트 캐시는 프로젝트 임시 디렉터리에 있습니다.。
- 디렉터리, 계정, 채팅 IPC 그리고 원주민 Fast 정위 Python 반품：125 개，123 통해、2 개 Windows 조건부 건너뛰기。Desktop/Web：142 항목이 통과됨。
- 기본 디렉터리에 있는 외부 경로와 심볼릭 링크가 확인되었으며, 끊어진 링크가 다른 항목을 차단하지 않으며, 로드 후 링크 대상 변경이 거부되고, 원래 세션 공급자와 IPC owner；로드 오류로 인해 대기 상태가 종료되고 다시 시도할 수 있습니다.。
- 격리 Electron 각 연결 계획 옆에 있는 중국어, 영어 가이드 링크와 실제 클릭수를 테스트하고 확인합니다. URL，인터페이스 스크린샷을 확인했습니다. 온라인 튜토리얼 HTTP 200，5개의 대상 챕터가 모두 존재합니다.。
- macOS arm64 DMG/ZIP 생성됨；DMG 압축 풀기 아키텍처, 심층 서명, 내장 게이트웨이 및 TLS 검사를 통과했습니다. 포장된 App 격리 시작 및 중지, 온라인 안내, 구성 포지셔닝 및 자격 증명 확인 통과。
- 교체하지 않고 설치됨 App，실제 게이트웨이가 다시 시작되지 않았으며 테스트 메시지가 실제 채팅으로 전송되지 않았습니다. 실제 휴대폰 배송 및 수락은 여전히 ​​사용자를 기다리고 있습니다. 다른 플랫폼은 아직 구축되지 않았습니다. 이번에는 밀지 마세요 GitHub 또는 온라인 웹사이트를 업데이트하세요.。

## v1.4.0-beta.1 로컬 통합 검증（2026-10-06，널리 알려지지 않은）

- 출처: 현지 v1.3.3 후속 변경 사항 및 PR #11 의 cdcd28cf0 완성; 일반 사용자 유지 SSH、결정된 Cloudflare、자격 증명 관리, 로그인 보호 및 기본 Fast。사용자 정의 API 기존 공급업체 카탈로그 읽기 전략을 계속 사용합니다.。
- 추가 및 전달됨: 전체 원격 helper 구축된 독립적인 모델 인터페이스 Fast 기능, 현재 수준 및 기본 공급업체 권한 경계、Skill 실제 타겟 검증, 페이징 중 새로운 선택, 업데이트 중지 요청 및 원본 연결 PID 종료 확인。
- Python：완전한 키트 467 개，457 통해、10 건너뛰다; 그중에서 4 개 SSH 기존 패키징 종속성 환경을 사용하여 테스트를 모두 통과했으며 나머지는 6 항목에만 적용됩니다 Windows。총 461 항목이 통과됨。
- Desktop/Web：141 항목이 통과되었습니다. 고쳐 쓰다 Node 전부：15 항목이 통과됨，1 개 Windows 조건부 건너뛰기。
- 현지의 macOS arm64 DMG、ZIP 생성됨。DMG 실제로 스키마를 통해 압축을 푼 후、App 심층 서명, 내장 게이트웨이 서명 및 인증서 확인; 서명은 ad-hoc，공증되지 않음。
- 팩 App 내장된 스타트-스톱을 통해 격리된 데이터 사용 cloudflared、기본 항목 알림, 필드 위치 지정、5 두 번째 프롬프트 및 자격 증명 보존 확인 지속적인 로그인, 재시작, 장치 해지를 통한 패키지 게이트웨이、IP 금지, 화이트리스트 및 데스크톱 복구 확인。
- 이 후보자는 실제 생활에서 테스트되지 않았습니다. Cloudflare/SSH 입구와 iOS 실제 장치의 전체 링크; 지어지지 않은 Windows、Intel Mac 또는 Linux 가방. 사용자는 입장하기 전에 현지 승인이 필요합니다. v1.4.0 정식 출시。
- 푸시 코드 없음, 원격 끝 병합 PR、풀어 주다 Release 또는 교체 Applications 에 존재 App。

---

## PR #11 저자 제공 v1.3.4 검증 기록（이력 참조, 비네이티브 통합 승인）

- Quick Tunnel：들어오지 못하게 하다 Cloudflare API 도메인 이름 오인；cloudflared 아직도 재시도를 기다리고 있습니다. connecting，더 이상 조기에 실패하거나 살아남은 프로세스를 다시 시작하지 않습니다. Smoke는 실제 패킷에서 터널을 통과하여 로컬 머신과 외부 네트워크를 통과합니다. HTTP 모두는 200。
- 업데이트 링크: 공식적인 직접 연결이 우선시되며 제한된 이미지는 보호됩니다. 서명과 패키지 해시는 완화되지 않습니다. 확인 버튼은 즉시 사용 중 상태로 전환되고, 업데이트 도우미는 확인을 중지하고 시작 출력을 유지하기 위해 자체 게이트웨이를 다시 시도합니다./오류를 제어하고 업데이트 결과 로그를 유지합니다. 로컬 머신 Bark 테스트 요청은 장치 회피를 위해 더 이상 시스템 프록시를 거치지 않습니다. Key 에이전트에 유출됨。
- 이미지 미리보기: 기본 세션 렌더링 가능 모델 Markdown 로컬 이미지 및 런타임 `ImageView` 증거; 모델 Markdown 아직은 제한적 workspace/visualizations，오직 `ImageView` 데스크톱 스크린샷 예외를 허용합니다. 호환 가능 `ImageView` / `imageView`，빈 텍스트는 공간을 차지하지 않으며 경로는 세션 전체에 노출되지 않습니다. 로그인 및 이미지 유형 확인이 여전히 필요합니다.。
- 모델 카탈로그: 관습 provider 읽기 런타임 우선순위 지정 `model/list`，기본 디렉터리가 없는 경우에만 대체 OpenAI-compatible `/models`；디렉토리는 현재를 전달 effort，모바일 버전을 로드할 수 있습니다. 3 개인 GLM 모델 low–ultra 강도가 높으며 자격 증명을 다른 엔드포인트로 전달하지 않습니다.。
- 독립적 로딩: 세션에 들어갈 때 `catalog?kind=models` 및 `catalog?kind=skills` 병렬 요청은 별도로 캐시됩니다. 모델 읽기는 그렇지 않습니다. Skill 스캔이 차단되었습니다。Skill 기본 200 바, 최대 500 기사 페이징, 검색 200ms debounce，가상 목록은 대략적인 것만 렌더링합니다. 30 술집; 반복적으로 열고 같은 것을 기다립니다 pending 요청, 반복적으로 트리거하지 않음 runtime。
- Skill 일관성: 사용자 설치 Skill 권한 있는 디렉터리는 다음과 같습니다. `~/.codex/skills`，심볼릭 링크 이스케이프 `~/.codex` 다음과 같은 경우에는 트리거되지 않습니다. runtime 스캐닝；SQLite ～에 따르면 `CODEX_HOME + cwd` 버킷，WAL/0600/원자적 쓰기，5000 디렉토리 페이징 및 검색 패스. 보내기 전에 경로 경계와 파일 크기를 확인하세요.、mtime 및 SHA-256，잘못된 선택은 자동 전송을 허용하지 않습니다. 원격 SSH 원격 호스트에서 읽고 확인하십시오. 원격을 두지 마십시오. metadata 로컬 머신에 쓰기。
- 경주 및 스크롤: 검색 또는 명시적 새로 고침이 증가합니다. Skill 생성 요청 및 스크롤 위치 재설정 지연 append 반환 시 쿼리가 변경된 경우 해당 쿼리는 삭제되며 새 검색 결과를 덮어쓰지 않습니다.。
- 최종 반환：Python 425 항목이 통과됨、6 아이템 플랫폼 조건을 건너뛰었습니다.；Desktop/Web Node 140 항목이 통과되었습니다. 포함하고 main 알림 모니터링 추가/에너지 최적화 및 적용 범위가 결합된 완전한 제품군 Windows/POSIX 이미지 경로 정규화。
- macOS arm64 v1.3.4 패키지는 깊고 엄격한 서명, 아키텍처, 내장 런타임 및 공용 네트워크를 전달합니다. HTTPS 그리고 포장 App 시작 연기 검사 격리。

---


# 기록 확인

## v1.3.3 출시 준비（2026-10-05）

- 알림 구독은 작업이 끝난 후 해제됩니다. 승인 보류 상태로 유지되며 실시간 이벤트에 의해 새로운 실행이 트리거됩니다. 30 두 번째 메타데이터 델타 확인이 발견되었습니다. 독립적인 지속성 완료 알림은 재시도하며 연결 ​​끊김 복구, 재활성화, 먼저 유휴 상태, 완료 등의 경계를 다룹니다.。
- Python 전액 409 개：405 통해、4 아이템 플랫폼 조건을 건너뛰고 특별 아이템이 알림을 받습니다. 39 항목이 통과되었습니다. 데스크탑/Web 131 항목이 통과되었습니다. 업데이터 13 항목이 통과됨、1 개 Windows 조건을 건너뛰었습니다. 공식 5개 아키텍처 패키지는 여전히 레이블 릴리스 워크플로를 통해 재테스트, 구축 및 검증되고 있습니다.。
- 독립적인 macOS arm64 시험 App 실제 시작, 패키지 내 작업자 프로세스 응답, 동일한 스냅샷 다시 그리기 불가, 서명 검증이 완료되었습니다. 테스트 인스턴스가 종료된 후 원래 공식 App 게이트웨이 상태 확인이 정상입니다.。
- 동일한 게이트웨이 30 읽기 전용 상태 쿼리: 독립 프로세스 CPU 2.1389 초, 재사용 프로세스 CPU 0.2727 초, 감소 87.3%。전체 머신이나 전체가 아닌 쿼리 경로만 나타냅니다. App 에너지 소비 감소; 재측정되지 않음 12 시간당 전력 표시기。
- 기본 창 제목 오버레이 및 중복 언어 설정에 대한 자동 회귀가 있습니다. 사용자가 가끔 보고하는 타이틀 깜박임은 아직 장기간 사용이 확인되지 않았습니다.。

## v1.3.2 출시 준비: 게이트웨이 시작 및 포털 알림

- 기본적으로 꺼진 독립 스위치, 선택적 게이트웨이 이름, 현재 진입 테스트 및 사전 업데이트 구성 프롬프트. 채팅 구독과 관계없이 활성화된 알림 채널을 재사용합니다. 주소가 변경되지 않은 경우에도 게이트웨이가 재전송을 시작할 때마다; 동일한 실행 내에서 동일한 목록이 중복 제거됩니다. 사용자가 임시 터널 및 LAN 실제 알림을 수락하고 릴리스를 승인했습니다. v1.3.2；유지하다 v1.3.1 공식 실행 인스턴스는 변경되지 않고 유지됩니다.。
- 알림 롤업 지원 LAN、NAS / 이미 세대 반대 고정 도메인 이름과 자체 서버를 보유하고 있습니다.（SSH 전달이 설정된 후） 및 임시 HTTPS；네트워크 카드 선택을 따르고 항목 및 루프백 주소를 닫는 것을 포함하지 마십시오. 포털 재발급 업데이트는 추후 준비될 예정입니다. 고정 도메인 이름은 사용자가 배포하며 로컬 시스템의 상태 및 전달 상태는 원격 끝을 증명하지 않습니다. HTTPS 도달 가능。
- Python 398 용어 회귀：394 통해、4 아이템 플랫폼 건너뛰기; 데스크탑/웹페이지 Node 128 항목이 통과되었습니다. 동일한 주소의 재시작 및 재전송 확인, 고정 주소 및 LAN 요약, 네트워크 카드 및 입구 스위치 필터링, 지연된 준비 업데이트, 각 채널의 독립적인 재시도 및 중지 유지에 대한 검증이 추가되었습니다./종료 후 전송 및 수동 테스트 적용을 억제합니다.。
- 새로운 macOS arm64 테스트 패키지가 서명 확인을 통과했습니다. 패키지에서 실행할 때 로컬 시스템과 결합됩니다. HTTP 수신자 확인 6 알림: 임시 포털 첫 시작, 동일 사이트 다시 시작, 주소 변경, 수동 테스트, 고정 도메인 이름 및 LAN 요약이 두 번 시작될 때 전송됩니다. 고정된 도메인 이름 배포만 시뮬레이션합니다. 새로운 테스트 App 시작되었습니다. 실제 임시 터널이 준비되었습니다.，ntfy 및 Bark 모두 이 출시 알림을 수락합니다. 게이트웨이의 공식 버전은 계속 실행됩니다.。
- 이전 버전 독립적 App 현실의 Cloudflare 임시 터널과 ntfy / Bark 테스트가 통과되었다는 알림이 사용자에 의해 확인되었습니다. 의미하지 않는다 PushPlus 또는 개인 서버의 실제 배포가 승인되었습니다.。

## v1.3.1 출시 준비（2026-10-04）

- 사용자가 임시를 완료했습니다. App LAN 웹페이지로 테스트하고 명시적으로 통합 승인 PR #8、풀어 주다 v1.3.1；포함하다 Goal 라이프 사이클, 계획 수정, 알림 기본 설정, 기록 읽기 및 휴대폰 레이아웃 최적화. 원저자의 제출물 유지，README 릴리스 노트에 대한 명확한 귀속。
- 최종 로컬 Python 전액 385 개：381 통해、4 아이템 플랫폼 조건을 건너뛰었습니다. 데스크탑/Web 127 항목이 통과되었습니다. 업데이터 13 항목이 통과됨、1 개 Windows 조건부 건너뛰기。Node 기존 종속성이 재사용되고 새 소프트웨어가 설치되지 않았는지 확인하십시오.。
- 320px 및 390px 휴대폰의 너비를 확인하고 전송 열을 가로 오버플로 없이 한 줄로 유지합니다.；320px 하단 대상 조작 버튼은 같은 행에 있습니다. 임시 패키지 완료 macOS arm64 구축, 서명검증 및 실제 LAN 자원검증。
- 이중 언어 릴리스 노트、README 그리고 공식 웹사이트 다운로드 입구가 다음과 같이 업데이트되었습니다. 1.3.1，과거 영상과 스크린샷에는 계속해서 주석이 추가됩니다. v1.3.0。Native Five Architecture에서 공식 출시 CI 서명 업데이트 매니페스트 재구축 및 생성。
- 로컬 시뮬레이션 및 사용자 수용은 대표하지 않습니다. Windows/Ubuntu 실제 기계、SSH Goal 아니면 전부 Codex 런타임 확인됨；Linux 실험적으로 유지하세요，Goal 제어는 로컬 시스템만 지원합니다.。

## v1.3.0 정식 출시（2026-10-03）

- 사용자 승인 후 라벨 `v1.3.0` 가리키다 `9d798f12c8f9001e2a6c39638c8ed5e0bd3b78e4`，Ubuntu 통합 및 계정 기능이 함께 정식 버전에 들어갔습니다.。[5개 건축물 구축 사전점검](https://github.com/try2love/codex-mobile-bridge/actions/runs/37123464691)、[공식 서명 릴리스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37124047542)및[공식 라벨 테스트 매트릭스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37124047365)모두 성공。
- Apple Silicon、Intel Mac 및 Windows x64 네이티브 runner 설치 패키지 확인、GUI/게이트웨이 시작, 장치 관리 로그인, 알림, QR 코드 로그인 및 업그레이드/실패 시 롤백。Ubuntu 22.04 x64 및 ARM64 네이티브 runner 검증 DEB 설치하다、AppImage 포장을 풀고 시작하세요、TLS、로그인, 알림 및 언어 지속성; 본 Linux GUI 스크린샷. 패키지에는 5가지 아키텍처가 포함되어 있습니다. API 계정 추가, 게이트웨이 재시작 후 읽기, 키 비노출 및 삭제 확인, 실제 계정이나 모델 추론을 사용하지 않음。
- [v1.3.0 Release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v1.3.0)이미 게시되었으며 최신 공식 버전입니다.，12 완벽한 액세서리。10 설치/업데이트 패키지 GitHub SHA-256 메타데이터가 확인 파일과 일치합니다. 원래 클라이언트 공개 키는 6개의 이전 버전에서 3개의 대상으로 총 업데이트 선택을 확인하는 데 사용됩니다. 18 그룹이 통과했습니다. 모든 대형 패키지는 이 시스템에서 반복적으로 다운로드되지 않습니다. 네이티브 패키지에서 실행 중인지 확인하는 방법은 위에서 나온 것입니다. CI。
- 이중 언어 공식 웹사이트에는 여러 계정, 업스트림 모델 및 Ubuntu 입구 다운로드, 유지 v1.2.0 동영상의 버전 주석입니다. 실제 브라우저 320/390/768/1280 너비 아래의 중국어 및 영어 레이아웃을 확인하세요. 5개의 다운로드 입구가 모두 다음을 가리킵니다. 1.3.0，수평 오버플로가 없습니다. 데스크톱 영어와 모바일 중국어 스크린샷을 봤습니다.。
- Linux 실험적인 주석으로 남아 있으며, 인앱 업데이트는 계속해서만 지원됩니다. Mac/Windows。현실 Codex 데스크톱 버전 IPC、Windows/Ubuntu 계정 전환、Wayland/FUSE 사용자의 실제 업스트림은 다음과 같은 방법으로만 격리될 수 없습니다. CI 모두 합격한 것으로 추정됩니다。Mac 아직 ad-hoc 서명되었지만 공증되지 않음，Windows 인증서 서명 없음。

## v1.3.0 출시 준비（2026-10-03）

- 사용자가 로컬 환경을 완료하고 게시를 명시적으로 승인했습니다. v1.3.0。여러 계정이 포함되어 있습니다./API 관리, 업스트림 모델 카탈로그, 할당량 표시 및 타이밍、computer use 공인된 수리 및 Ubuntu x64/ARM64 통합。
- 게시하기 전에 로컬 Python 전액 320 종 시앙 316 통해、4 아이템 플랫폼 조건을 건너뛰었습니다. 데스크탑/Web Node 115 항목이 통과되었습니다. 업데이터 13 항목이 통과됨、1 개 Windows 조건을 건너뛰었습니다. 5개 아키텍처 공유 로그인 승인 스크립트를 입력하기 위한 패키지 내 계정 지속성 검사가 추가되었습니다.。
- Ubuntu 통합 제출 `e5f1596` 네이티브 5개 아키텍처[데스크탑 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/37111811063)및[테스트 매트릭스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37111811019)합격；v1.3.0 완전한 제출은 여전히 ​​이러한 검사를 다시 통과해야 합니다. 토종의 CI 특정을 대체하지 않습니다 Codex 데스크톱 버전의 현실 IPC 시험。
- 버전과 lockfile 업데이트됨 1.3.0；이중 언어 릴리스 노트, 다운로드 링크 및 계정/Linux 문서 동기화 사용。Linux 계속해서 실험적인 인앱 업데이트로 표시됩니다. Mac arm64/x64 및 Windows x64；공개 키는 기존 게시 ID를 상속합니다.。

## 웹 채팅 업스트림 모델 디렉터리（2026-10-03，아직 출시되지 않은 국내 평가판）

- `scripts/smoke-api-catalog.py` 독립적으로 사용 Codex 디렉토리, 소설 Key 및 루프백 시뮬레이션 업스트림 재발: 업스트림이 두 개만 있습니다. Gemini 모델, 이전 세션 디렉터리가 여전히 공식을 반환합니다. GPT 시리즈. 복구 후 기본 유효 구성을 사용하여 인증된 구성을 쿼리합니다. `/v1/models`，이 2개만 돌려주세요 Gemini ID；실제 업스트림이나 모델 추론을 호출하지 않습니다.。
- 모델 디렉터리는 채팅 공급자, 작업 디렉터리 및 실행 호스트에서 읽으며 캐시는 공급자를 구분합니다. 공식 계정은 기본 디렉터리를 유지합니다.；API 쿼리 실패 시 반환되지 않음 GPT，오류를 표시하고 수동 입력을 유지합니다. 기존 모델이 목록에 없으면 선택하여 적용해야 합니다. 디렉터리를 읽어도 세션 모델은 변경되지 않습니다.。SSH 다음을 사용하여 주입된 모델 쿼리 TLS 소스 파일은 패키징으로 동기화됩니다.。
- Python 전액 319 종 시앙 315 통해、4 플랫폼 확인을 건너뛰었습니다. 나중에 추가된 원본 owner 애플리케이션 Gemini 모델은 특수 테스트를 통과하여 메시지를 트리거하지 않고도 누락된 추론 강도 메타데이터를 계속 적용할 수 있음을 확인했습니다.。Node 115 웹 페이지 옵션, 이전 모델 프롬프트, 애플리케이션 요청 및 쿼리 실패 경로를 포함하는 전달된 항목。
- macOS arm64 로컬 테스트 패키지 재구성, 무결성 서명, 격리 GUI 패키지의 작업자 프로세스는 다음을 통해 시작됩니다. 패키지 내 Web 및 SSH 디렉터리 종속성은 최종 소스 코드와 바이트 단위로 일관됩니다. 증거는 `.tmp/account-switching/catalog-*.log`。
- 이번 라운드의 범위는 다음과 같습니다. Bridge 웹 채팅 모델 선택기, 공식 수정 없음 Codex 데스크탑 애플리케이션. 실제 계정을 사용하지 않고 사용자를 다시 시작하세요. Codex、설치, 커밋, 푸시 또는 게시를 대체합니다. 사용자 정의 공급자에 대한 모델 목록 및 Responses 호환성 및 Windows/Ubuntu 실제 기계는 아직 사용자 승인을 기다리고 있습니다.。

## API 라우팅, 할당량 레이아웃 및 computer use（2026-10-03，아직 출시되지 않은 국내 평가판）

- 참조하다 Cockpit 1.3.65 인증 및 구성 협업 모드, 스위치 API 네이티브도 쓰세요 `auth_mode=apikey` 인증、Responses 공급자와 `openai_base_url`，기존 강제 로그인 방식 충돌 현상을 수정했습니다. 현재 런타임 중에는 내장 항목을 덮어쓰는 것이 금지되어 있습니다. `model_providers.openai`，따라서 지원되는 최상위 주소 구성을 사용하십시오. 공식 계정으로 돌아갈 때 재정의를 지우고 기록 데이터베이스를 수정하지 마십시오.。
- `scripts/smoke-accounts-routing.py` 데스크탑 내장 사용 Codex 0.160.0、독립 데이터 디렉토리, 가상 키 및 루프백 HTTP 모의 서비스 및 네이티브 검증 API 로그인 상태, 새로운 기본값/명백한 openai 채팅 및 이전 복원 openai 채팅 및 실제 요청이 모두 지정된 항목에 도달했습니다. `/v1/responses` 그리고 올바른 것을 가지고 다니세요 Bearer。외부 HTTP(S) 로컬 프록시에 의해 연결이 차단되었습니다. 실제 모델 요청이 전송되지 않았습니다.。
- 양쪽 끝의 현재 액세스는 맨 위에 있습니다. 재설정 카드 번호는 이름 옆에, 한도는 계정 정보 영역과 조작 버튼 위에 있습니다. 웹페이지의 사이드바에는 통일된 고정 입구가 있으며, 이는 액세스 유형에 따라 표시됩니다.“계좌번호 및 할당량”또는“API 연결”。데스크탑 문제 피드백 및 코드 기여 포털을 제거했습니다.。
- 처음으로 계정 패널을 열면 공식 할당량이 자동으로 쿼리됩니다. 이후 패널이 표시되면 5분마다 업데이트되며 수동으로 클릭할 수 있습니다.“잔액보기”지금 쿼리하고 5분 타이머를 재설정하세요. 숨다/쿼리를 중지하려면 페이지를 닫으세요. 패널이 표시되지 않을 때 목록 또는 창 포커스 업데이트는 첫 번째 할당량 쿼리를 트리거하지 않습니다. 백그라운드에서는 공유된 5분 캐시를 자동으로 요청하고 재설정 후 수동 쿼리 및 할당량 읽기는 캐시를 우회합니다.。
- 로컬 데스크톱과 비교 computer use 카드와 네이티브 MCP elicitation 프로토콜, 웹 페이지는 사용자가 선택한 것을 전달합니다. `_meta.persist=session/always`；백엔드는 실시간 요청에 대해 범위를 확인하고, 만료된 요청, 지원되지 않는 범위를 거부하고, 지속적인 승인을 통해 작업을 거부하며, 일반 형식 동반 메타데이터를 제공합니다. 데스크탑 및 웹 페이지와 동의어인 세 가지 옵션을 유지하고 확장하지 마십시오.“이번에는 허용됨”의미。
- Python 전액 312 종 시앙 308 통해、4 아이템 플랫폼 조건을 건너뛰었습니다. 데스크탑/Web Node 113 항목이 통과되었으며, 첫 번째 자동 쿼리, 수동 쿼리 재설정 타이밍 및 페이지 숨김 일시 중지를 확인하기 위해 새로운 가상 시계 테스트가 추가되었습니다. 격리 Electron 데스크탑 상호작용、390px 중국어 및 영어 웹 페이지 레이아웃, 고정된 입구 위치 및 암시적 할당량 쿼리가 전달되지 않음, 스크린샷이 확인되었습니다.。
- 현지의 macOS arm64 테스트 패키지가 빌드되고 서명되었습니다.、GUI 시작 및 패키지 내 게이트웨이 확인 기존 설치를 대체하지 않고 로그인하지 않음/실제 계정을 전환하고 사용자를 다시 시작하세요 Codex、카드 재설정, 제출, 푸시 또는 게시에 지출합니다. 제3자 실제 API、현실 computer use 지속적인 승인, 공식 계정 전환 및 Windows/Ubuntu 실제 머신은 아직 사용자 승인을 기다리고 있습니다. 증거는 `.tmp/account-switching/optimized-*.log` 및 `routing-after.log`。


## 계정전환 복구 및 컴팩트 한도（2026-10-03，아직 출시되지 않은 국내 평가판）

- LAN으로 돌아가기 HTTP 부족 `crypto.randomUUID()` 전환 요청이 발행되지 않은 경우 증가 `getRandomValues` 묻다 ID 문제 해결 및 눈에 보이는 오류 데스크탑 IPC 외부 호출 래퍼를 제거하는 중 오류가 발생했습니다.。
- 연결 끊김, 연결 오류로 인한 핸드오버 차단 등의 이전 작동 상태 회귀 idle 상태에 확인 요청이 누락되었습니다. 이제 연결된 작업으로만 실행됩니다./상태 및 대기열 확인/알 수 없는 전송은 차단되고 특정 채팅이 표시됩니다. 실제 활성 작업은 여전히 ​​전환을 방해합니다. 사용자는 여전히 모든 데스크톱 작업의 종료를 확인해야 하며 강제 우회가 추가되지 않습니다.。
- 원래의 유효 구성과 공식 계정 식별에 따라 실제 현재 액세스가 비활성화됩니다. 저장된 계정을 일치시킨 후에는 전환, 편집, 삭제가 비활성화됩니다. 격리 패키지의 게이트웨이는 실제 측정 및 가져오기 후에 식별됩니다. API，외부에서 구성을 수정한 후 마크업 업데이트. 시작할 필요가 없습니다. Bridge 한 번 전환해 보세요。
- 공식 계정 목록에는 할당량 진행률 표시줄과 재설정 카드 수가 표시됩니다. 저장된 모든 액세스는 모델 목록을 볼 수 있습니다. 백그라운드에서는 계정 개인 자격 증명을 사용하여 둔감화 결과를 쿼리하고 캐시합니다. 현재 공식 계정은 현재 유효한 인증을 우선으로 합니다.；API 공식 할당량을 읽지 않습니다. 세부정보 추가 HTTP 경로 예약 로그인、CSRF 정확한 필드 제한。
- 데스크탑“계정 및 한도”에 병합하다“계정 및 액세스”，할당량 목록은 간결하게 표시되며 현재 계정의 전체 복구 시간 및 카드 재설정 작업은 접혀서 유지됩니다.。Electron 실제 창은 합성 데이터 스크린샷을 완성하며, 현재 버튼은 비활성화되고 수평 오버플로 검사는 수행되지 않습니다. 실제 재설정 카드는 소모되지 않습니다.。
- Python 전액 307 종 시앙 303 통해、4 아이템 조건이 생략되었습니다. 데스크탑/Web Node 109 항목이 통과되었습니다. 격리 Electron 추가, 삭제, 수정, 스캔 및 가져오기, 모델 쿼리 통과；macOS arm64 로컬 패키지 시작, 패키지 게이트웨이 모델 쿼리 및 현재 액세스 식별이 통과되었습니다.。
- 수정되지 않은 실제 로그인, 현재 다시 시작 Codex 또는 모델 추론을 보내십시오. 실제 휴대폰 전환, 공식 계정 A/B、실제금액/모델 권한 및 Windows/Ubuntu 수명주기는 여전히 사용자의 승인에 달려 있습니다. 업데이트가 제출, 푸시 또는 게시되지 않았습니다.。

## 기본 구성 가져오기 및 업스트림 모델 비교（2026-10-03，아직 출시되지 않은 국내 평가판）

- 데스크탑에 현재 추가/지정하다 Codex 기본 파일의 공식 자격 증명을 식별하기 위한 디렉터리 스캐닝、API Key、`model_providers` 및 `profiles`；현재 구성을 수정하거나 자동으로 전환하지 않고 선택 후 가져옵니다. 가져오기 전에 소스 구성이 변경되지 않았는지 확인하고 가져오기를 반복하여 중복 항목을 제거하세요. 시스템 자격 증명 데이터베이스, 환경 변수 누락, 비 Responses 프로토콜 및 추가 인증 매개변수에는 명확한 경계가 있습니다.。
- 사용자 정의 API 수동 양식 추가 `GET /models` 쿼리 및 모델 선택은 새로 채워진 키, 액세스한 저장된 키, 후보 검색을 위한 백엔드 자격 증명을 지원합니다. 반환 값에는 모델만 포함됩니다. ID；리디렉션 거부, 응답 크기 제한 및 대기 요청, 네트워크/권한/형식 오류가 있는 경우 업스트림 텍스트는 반환되지 않으며 수동 채우기가 예약됩니다. 비동기 결과는 변경된 내용을 다시 채우지 않습니다. API 형태。
- Python 전액 298 개：294 통해、4 아이템 플랫폼 조건을 건너뛰었습니다. 데스크탑/Web Node 105 항목이 통과되었습니다. 다음으로 파일의 공식 자격 증명을 덮어씁니다. profiles 가져오기, 중복 제거, 소스 구성 변경, 누락된 키、HTTP Bearer、빈 목록, 리디렉션, 마스킹 오류 및 데스크톱별 라우팅 경계。
- 현실 Codex 런타임 시 격리 디렉터리에서 공급자 구성을 검색할 수 있는지, 키는 백엔드에서만 읽고 사용되는지, 원래 구성은 변경되지 않은 상태로 유지되는지 확인하세요.。Electron 실제 측정된 워크스루의 로컬 시뮬레이션 업스트림을 스캔, 선택 및 쿼리하고 모델을 선택한 다음 기존 모델과 함께 가져옵니다. API 키가 비어 있을 때 쿼리합니다. 실제 계정이 로그인되어 있지 않거나 추론이 호출되지 않습니다. 첫 번째 UI 고정 장치에 필요한 기본 공급자가 없습니다. `name`，픽스처 완성 후 합격。
- macOS arm64 로컬 테스트 패키지가 재구축되었으며 무결성 서명 확인을 통과했습니다. 패키지의 게이트웨이는 스캔, 가져오기, 모델 쿼리 및 삭제를 완료하기 위해 테스트되었으며 소스 구성은 바이트 단위로 유지됩니다. 테스트 게이트웨이와 시뮬레이션된 업스트림이 모두 중지됩니다.。
- 아직 업데이트가 출시되지 않았습니다. 실제 계정 및 사용자 업스트림의 가용성、Windows/Ubuntu 실제 기계 동작은 사용자의 승인에 따라 달라질 수 있습니다. 이번 라운드에서는 사용자의 실제 인증 디렉터리를 스캔하거나 자격 증명을 실제 업스트림으로 보내지 않았습니다.。

## 여러 계정 및 API 스위치（2026-10-03，아직 출시되지 않은 국내 평가판）

- Ubuntu 지점이 로컬로 병합되었습니다. `main`（`e5f1596`），계정 기능은 `feature/account-switching` 개발. 버전은 아직이네요 `1.2.2`，푸시되지 않음, 라벨 생성, 게시됨 Release 또는 공식 웹사이트를 업데이트하세요. 실제 테스트와 사용자의 명시적인 승인 후에만 출시될 수 있습니다.。
- 데스크톱 개인 제어 채널만 계정을 추가, 수정, 삭제하고 공식 로그인을 시작할 수 있습니다. 웹 페이지는 감도 줄이기 목록을 읽고 저장된 액세스를 전환할 수만 있습니다. 로그인 및 동일한 출처를 유지하도록 요청 전환、CSRF、정확한 필드와 반복 요청은 제한되며 비밀번호가 없는 웹페이지로의 전환은 금지됩니다. 자격 증명은 추가로 암호화된 저장소가 아닌 권한이 보호된 기본 파일에 저장됩니다.。
- 전환 전 차단 활성화/보류 중인 작업 및 대기열/알 수 없는 결과 메시지, 채팅 작성 및 백그라운드 전송을 일시 중지합니다. 출구 공식 GUI 구성을 교체한 후/인증 후 검증 시작，Bridge 게이트웨이는 계속 작동합니다. 구성 업데이트, 토큰 보존, 장애 롤백, 중단 복구, 복구 중 할당량 작업 상호 제외, 원래 기록이 변경되지 않고 오래됨 provider 보호하다。
- Python 전액 289 개：285 통해、4 아이템 플랫폼 조건을 건너뜁니다. 최종회복 상호 배제 조정 후, 계정 특별 18 재시험을 통과했습니다. 데스크탑/웹페이지 Node 101 항목이 통과되었습니다. 업데이터 13 항목이 통과됨、1 개 Windows 확인을 건너뛰었습니다.。
- 현실 Codex 런타임은 격리 디렉터리에서 수행됩니다. API provider 구성 작성, 삭제 및 관련 없는 설정은 유지됩니다. 실제 계정이 로그인되어 있지 않거나 모델 요청이 전송되었습니다.。Electron 소스 코드 인터페이스로 합성 완료 API 추가, 이름 바꾸기, 삭제, 키 숨기기 및 중국어 및 영어 스크린샷 확인。Ego Browser 중국어와 영어를 확인하세요 320/390/768/1280 레이아웃, 확인 요청, 전환 중에는 작업이 비활성화되며 웹 페이지에는 자격 증명 입력 제어가 없습니다.。
- 현지의 macOS arm64 테스트 패키지는 내장 게이트웨이 구성을 완료합니다.、ad-hoc 무결성 서명 검증, 격리 GUI 활성화는 물론 게이트웨이 활성화 및 계정 추가, 삭제, 수정 및 패키지 체크인도 가능합니다. 교체하지 않고 설치됨 App；사용되지 않음 Apple Developer ID 서명 또는 공증。
- 실제 공식 계정 A/B 전환, 실제 사용자 정의 API 묻다、Fast/몫/전환 후 카드 동작을 재설정하고 Windows/Ubuntu 실제 기계 프로세스가 종료되고 시작되지만 여전히 사용자 승인을 기다리고 있습니다. 기존의 CI 구성 및 시뮬레이션 테스트는 이러한 실제 테스트를 대체할 수 없습니다. 사용, 보관 및 복구 경계 참조 [계정 및 액세스](docs/account-switching.md)。

## Ubuntu 개발 브랜치 적응（2026-10-03，아직 게시되지 않음）

- 기반으로 `0872436` 새로운 `codex/ubuntu-support`。사용자 제공 Ubuntu 22.04 x64 / ChatGPT `26.930.31730` 설치정보: 런처 `/usr/lib/chatgpt/codex-launcher`、실행 시간 `/usr/lib/chatgpt/resources/codex`、`codex://` 협회 `chatgpt.desktop`。이는 설치 레이아웃을 확인하는 것일 뿐이며 이를 나타내지는 않습니다. IPC 연결됨。
- Windows 호스트 실행 데스크탑 Node 시험 89 아이템, 업데이터 14 항목이 모두 통과되었습니다. 플랫폼 관련 Python 시험 34 종 시앙 32 통해、2 아이템 플랫폼 확인을 건너뛰었습니다. 새로운 Linux 특별한 8 종 시앙 7 통해、POSIX 권한/심볼릭 링크 검사를 건너뛰었습니다.。Cloudflare 두 아키텍처 모두 실제 바이너리를 다운로드하고 실행하지 않고 합성 바이너리 확인 확인, 권한 및 설치 경로를 사용합니다. Linux 프로그램。
- 1차 전액 Python 반품 267 개：260 통해、5 뛰어넘다、2 개인 HTTP 거부 경로 발생 Windows `ConnectionResetError / WinError 10054`。이번에 바꿔보세요 Python 모듈로 교체됨 `origin/main` 원본 텍스트 이후에 두 가지 테스트를 반복합니다（메모리 로드만 가능, 작업 공간은 변경되지 않음）. 25 바퀴, 전체 50 반복되는 6 두 번째 유사한 오류는 메인 브랜치에도 불안정한 동작이 존재하는 것으로 확인되었습니다. 이 적응 수정 사항에 모두 녹색이거나 혼합된 것으로 잘못 보고되지 않았습니다.。
- 추가됨 Ubuntu 22.04 x64 / ARM64 네이티브 빌드 매트릭스、`.deb` 설치 및 AppImage 시작 확인, 스키마 압축 풀기/버전 액세스 제어 및 격리 GUI/인증/통지하다/스캔 코드/TLS 제품을 확인하고 스크린샷을 찍어보세요. 작업 흐름 YAML、스크립트 구문 및 diff 백지 수표가 통과되었습니다. 아직 실행하도록 푸시되지 않았습니다. CI，생성 및 승인되지 않음 Linux 설치 패키지。
- 가상 머신에 직접 로그인하지 않았으며 실제 데스크톱을 확인하지 않았습니다. IPC、실제 대화 상호 작용、VMware 모바일 링크 또는 ARM64 실제 기계. 실제 채팅을 운영하지 않거나, 인증이나 방화벽을 수정하는 행위。Linux 인앱 업데이트는 당분간 활성화되지 않으며 창을 숨기기 위해 트레이에 의존하지 않습니다. 사용 및 허용 범위를 확인하세요. [Linux 문서](docs/linux.md)。

## v1.2.1 메시지 작업 및 릴리스 승인（2026-10-03）

- 웹페이지가 새로 추가되어 완성되었습니다. Markdown/코드 복사, 최근 사용자 메시지의 기본 편집 재전송, 기록 메시지 편집 후 분기, 완료된 라운드별 분기 및 소스 세션 반환. 메시지 위치와 콘텐츠 버전은 백그라운드에서 확인되고 작업 의도는 유지되며 확인되지 않은 요청은 자동으로 재생되지 않습니다. 분기가 성공적으로 생성되었지만 활성화에 실패하면 편집 초안이 유지됩니다.。
- 로컬 머신 Codex 패키지 정적 확인 `thread-follower-edit-last-user-turn` v2（SSH 사용 v3），유하라 owner 편집장. 브랜치는 원래 실행 호스트의 수명이 짧은 런타임을 사용하여 모델과 모델을 명시적으로 유지합니다. provider，필요하다 `lastTurnId` 및 `deferGoalContinuation` 능력; 이 보조 런타임으로 전송되지 않습니다. `turn/start`。
- 고립의 현실 Codex 런타임은 로컬 가상 공급자와 두 라운드의 합성 기록을 사용하여 고정 소수점 분기를 완료하고 첫 번째 라운드만 유지하며 원본 레코드는 바이트 단위로 변경되지 않습니다. 실제 인증이나 모델 요청은 전송되지 않습니다. 네이티브 편집기에 의해 시작됨、SSH 라우팅 및 오류 경로 채택 fixture 검증, 답변은 실제 사용자 세션에서 재생성되지 않습니다.。
- Python 전액 236 종 시앙 232 통해、4 다음을 포함하여 아이템 플랫폼 확인을 건너뛰었습니다. HTTP 입증/CSRF/원산지 확인 및 메시지 운용 13 시험. 기능 사전 확인이 확실히 실패하면 업그레이드할 수 있습니다. Codex 나중에 동일한 분기 요청이 다시 시도되며 확인되지 않은 실제 작업은 여전히 ​​재생되지 않습니다. 데스크탑/웹페이지 Node 79 긴 텍스트 청킹, 버전 변경, 전환 취소, 알 수 없는 결과 중복 제거 및 편집 초안 복구를 다루는 항목이 통과되었습니다. 업데이터 13 항목이 통과됨、1 개 Windows 특별 점검을 건너뛰었습니다.。
- Ego Browser 격리 상태 HTTP 게이트웨이가 실제로 복사를 완료합니다. 18,641 캐릭터 답장、5,600 문자 코드, 자동 복사가 불가능한 경우 모든 텍스트 선택, 최신 뉴스 다시 게시, 기록 편집 분기, 처음 두 라운드만 유지하고 소스로 돌아가는 일반 분기. 원래 세션 기록 편집 위치는 변경되지 않습니다.；390px 편집하다/지점 스크린샷을 봤습니다, 중국어와 영어 320/390/768/1280 레이아웃에 가로 오버플로가 없습니다. 클립보드에 대한 자동 쓰기는 제어된 수신기를 사용하여 원본 텍스트를 확인하고 수동 확인은 실제 텍스트를 통과합니다. DOM 체크를 선택하세요。
- 동일한 브라우저를 통해 12 개 Markdown 렌더 체크、18 아이템 타임라인 확인 11 아이템 표시 분류 확인; 공식 웹사이트의 새로운 콘텐츠와 세 가지 카테고리의 다운로드 주소가 중국어와 영어로 전달됩니다. 320/390/768/1280 레이아웃 확인。
- 사전 구축된 첫 번째 라운드 Intel Mac 테스트 스크립트가 시작 창을 읽을 때 나타납니다. `Execution context was destroyed`，업그레이드가 아직 시작되지 않았습니다. 공식 조립 라인은 동일한 플랫폼에서 완전한 재검사를 통과했습니다. 이제 테스트는 시간 제한 준비 폴링을 통해 초기 페이지 컨텍스트 전환을 처리합니다. 1라운드 공식 Windows 업그레이드 확인이 나타납니다 `gateway.stop` 의 `WinError 5`，접근 제어로 인해 릴리스가 차단되었습니다. Stop Record를 먼저 삭제한 후 양 당사자가 Stop 파일을 정리하기 위해 경쟁하는 Handover 결함을 Fault 주입 회귀를 통해 재현하고 수정했습니다. 게이트웨이는 먼저 요청을 정리한 다음 중지를 확인합니다. 확인을 받은 요청자는 더 이상 해당 확인을 삭제할 수 없습니다. 토종의 Windows 설치패키지 재점검 결과는 이후 기록을 참고하시기 바랍니다.。
- 커밋 수정 `fda4df9aa416b8961e1ccccbcec187ba9e5f1214` 의[공식 서명 릴리스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37060857447)및[라벨 테스트 매트릭스의 5개 그룹](https://github.com/try2love/codex-mobile-bridge/actions/runs/37060857297)모두 합격。Apple Silicon、Intel Mac 및 Windows x64 네이티브 runner 모든 패키지 프로그램, 설치, 알림, 로그인, 코드스캐닝, 업그레이드 복구 승인이 완료되었습니다.。Windows 로그는 확실히 확인합니다 `legacy-cwd`、`success`、`rollback` 세 가지 시나리오가 통과되었으며 네 가지 구성이 바이트 단위로 유지됩니다.。
- [v1.2.1 Release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v1.2.1)최신 공식 버전으로 게시 및 표시됨，8 액세서리를 완성하세요. 여섯 팩 GitHub SHA-256 및 `SHA256SUMS.txt` 일관된; 삼 ZIP 크기와 다이제스트가 서명 목록과 일치합니다. ～에 의해 App 기존 공개키 검증 1.2.0、1.1.0、1.0.0、beta.7 선택 및 서명을 총 3가지 플랫폼으로 업데이트합니다. 12 그룹이 통과했습니다. 이 컴퓨터에서는 모든 대규모 설치 패키지를 다시 다운로드하지 않았습니다. 패키지의 실행 증거는 위에서 언급한 네이티브에서 비롯됩니다. CI。
- [공식 웹사이트 배포](https://github.com/try2love/codex-mobile-bridge/actions/runs/37062046126)성공, 공개 HTML 의 SHA-256 소스 코드와 일치합니다. 실제 브라우저 검증 새로운 기능 중국어, 영어 3가지 v1.2.1 입구 다운로드 및 320px 측면 유출이 없습니다. 세 가지 설치 패키지가 통과되었습니다. GitHub 충수 API 의 HEAD 반품요청 HTTP 200，콘텐츠 크기가 출판 기록과 일치합니다. 토종의 curl/Node 패키지에 직접 액세스 CDN 등장 TLS 실패하거나 시간이 초과되면 공식 첨부 인터페이스를 사용하여 확인을 완료하세요.。
- 버전과 lockfile 업데이트됨 `1.2.1`，이중 언어 지침은 다운로드한 문서와 동기화됩니다. 공식 웹사이트는 표시된 버전을 유지합니다 v1.2.0 시연하고 추가하세요. v1.2.1 메시지 작업. 달리는 로컬 App、사용자의 실제 전화에서 재검증되지 않은 게이트웨이, 구성 또는 실제 모델 세션。Mac 아직 ad-hoc 서명했지만 받지 못함 Apple 공증，Windows 인증서 서명이 없습니다. 업데이트 목록은 기존 서명 ID를 상속합니다.。

## v1.2.0 정식 출시 및 공식 홈페이지 업데이트（2026-10-03）

- 버전 번호 및 lockfile 다음과 같이 통일 `1.2.0`，다음과 같은 입증된 작업 모드, 대상 표시줄 및 긴 모델 표시, 알림 모니터링 관리, 다중 첨부, 세션 상태 식별 및 통합 Fast 설정; 이중 언어 릴리스 노트와 다운로드한 문서가 동시에 업데이트됩니다.。
- 출시 전 로컬 완료 Python 공산주의로 돌아가다 221 개：217 통해、4 항목 기존 환경 확인을 건너뛰었습니다. 데스크탑/웹페이지 Node 75 모든 항목이 통과되었습니다. 업데이터 Node 흔한 14 개：13 통해、1 플랫폼 조건을 건너뜁니다. 버전 일관성, 새로운 리소스 참조 및 Git diff 백지 수표 통과。
- [시험판 데스크탑 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/37052529242)、[공식 서명 릴리스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37053611646)및[버전 라벨 테스트 매트릭스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37053610860)모두 통과되었습니다. 공식적인 절차는 다음과 같습니다. Apple Silicon Mac、Intel Mac 및 Windows x64 네이티브 runner 패키지 내 런타임을 완료하려면 시스템을 다시 빌드하세요.、Mac DMG/ZIP 설치하다、App 시작, 알림, 장치 로그인, QR 코드 스캔 및 업그레이드/실패 롤백 수락。
- 첫 번째 라운드 Windows Python 3.13 알림 모니터링 테스트의 임시 디렉터리 정리 시간 `WinError 32`，로그는 테스트 픽스처가 닫히지 않았음을 확인합니다. SQLite 연결; 연결 컨텍스트는 트랜잭션만 관리합니다. 기존 테스트 모드에 따라 사용 `contextlib.closing` 명시적으로 핸들을 놓습니다.，5 품목 모니터링 지시 테스트 및 Windows runner 재검사 통과。
- 수리 후 제출 `427080b` 의[5개 그룹 Python 테스트 매트릭스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37052529284)모두 통과, 보장됨 Windows/Ubuntu 의 Python 3.9、3.13 및 macOS Python 3.13。
- [v1.2.0 Release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v1.2.0)최신 공식 버전으로 게시 및 표시, 소스 제출 `bf17c666d7e8e80468027a3c1c05c9b6bf7370e3`。8 모든 첨부 파일이 완료되었습니다. 공개 업데이트 목록 및 확인 파일을 다운로드하여 사용하세요. App 기존 공개키 검증 1.1.0、1.0.0、beta.7 세 가지 대상 모두에 대한 버전 필터링 및 서명, 총 9 그룹이 통과했습니다. 여섯 팩 GitHub SHA-256 확인 파일과 일치하는 세 가지 ZIP 다이제스트의 크기도 서명 매니페스트와 일치합니다. 이 컴퓨터는 모든 대규모 설치 패키지를 다시 다운로드하지 않았으며 패키지의 실행 승인은 위에서 나온 것입니다. CI。
- 공식 홈페이지와 데모가 다음으로 변경되었습니다. v1.2.0 기능 설명, 다운로드는 공식적으로 출시된 세 가지 설치 패키지를 가리킵니다. 중국어와 영어 320/390/768/1280 너비가 가로로 넘치지 않습니다. 언어 메모리, 링크, 확대/축소 이미지 및 키보드 탐색 패스。128.667 두 번째 동영상에는 다음이 포함되어 있습니다. 9 장헤거 23 중국어 및 영어 자막, 중간 부분/마지막 챕터 재생 및 언어 전환이 통과되었습니다. 최종 프레임 추출 및 표지를 통해 이전 버전 미리보기 표시가 없음을 확인했습니다. 버전 쿼리 매개변수를 사용하여 비디오, 표지 및 자막 업데이트 브라우저 캐시。
- 달리는 로컬 App、게이트웨이, 구성 또는 실제 모델 세션이나 사용자의 Windows、Intel Mac 아니면 실제 휴대폰 하드웨어에서 다시 테스트해 보세요.。Mac 아직 ad-hoc 서명했지만 받지 못함 Apple 공증，Windows 인증서 서명이 없습니다. 업데이트 매니페스트 서명은 기존 ID를 사용합니다.。

## v1.1.0 정식 출시 및 공식 홈페이지 업데이트（2026-10-02）

- 버전 번호 및 lockfile 다음과 같이 통일 `1.1.0`，중국어 및 영어 출시 지침 및 사용 문서에는 모바일 단말기의 컴팩트한 레이아웃, 입력 영역 축소, 콘텐츠 표시 스위치 및 테마가 포함됩니다./글꼴 크기 설정 및 Windows 디렉토리 점유율 수정을 업데이트합니다. 예약하다 Intel Mac DMG、Apple Silicon DMG、Windows Setup.exe 세 개로 ZIP 패키지 업데이트。
- 현지의 Python 공산주의로 돌아가다 182 개：177 처음으로 통과된 항목、4 아이템 플랫폼 조건을 건너뛰었습니다. 기존 발견 CSP 새로운 추가 사항이 누락된 테스트 스크립트 목록 `presentation.js`，목록을 업데이트한 후 방향 재테스트를 통과했습니다. 프런트 엔드/데스크탑 Node 52 항목 통과됨, 업데이트 프로그램 Node 13 항목이 통과됨、1 개 Windows 단독 검사를 건너뛰고 세션 열기 회귀를 통과했습니다. 프런트 엔드의 실제 브라우저 승인은 다음과 같습니다.。
- [시험판 데스크탑 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/37022194960)、[공식 서명 릴리스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37023188508) 및[버전 라벨 테스트 매트릭스](https://github.com/try2love/codex-mobile-bridge/actions/runs/37023187660)모두 통과되었습니다. 공식 프로세스는 세 가지 기본 원칙을 기반으로 합니다. runner 패키지 내 런타임을 완료하려면 시스템을 다시 빌드하세요.、Mac DMG/ZIP 설치하다、App 장치 시작, 알림, 로그인, QR 코드 스캔 및 실시간 업그레이드/실패 롤백 수락。
- [v1.1.0 Release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v1.1.0) 최신 공식 버전으로 게시 및 표시, 소스 제출 `b88e895c6c2327293aa10cecc2a85b055d055ded`。8 첨부 파일이 완료되었습니다. 공개 업데이트 목록 및 검증파일을 다운로드 받은 후 이용하세요. App 내부 공개 키는 세 가지 업데이트 대상을 모두 확인하고 확인합니다. 1.0.0 / beta.7 버전 심사 및 검증 승인 1.1.0。여섯 팩 GitHub SHA-256 확인 파일과 일치하는 세 가지 ZIP 크기와 요약도 서명 목록과 일치하며 설치 패키지 다운로드 항목 3개가 실제로 반환됩니다. HTTP 200。이 컴퓨터는 모든 대규모 설치 패키지를 다시 다운로드하지 않았으며 패키지의 실행 승인은 위에서 나온 것입니다. CI。
- [상품 페이지 배포](https://github.com/try2love/codex-mobile-bridge/actions/runs/37024449314)성공. 공식 웹사이트 업데이트 버전 번호, 세 가지 플랫폼 다운로드、Windows 이전 버전에는 업그레이드 지침과 4개의 새 버전 휴대폰 스크린샷이 포함되어 있으며 새로운 디스플레이 설정 소개가 포함되어 있습니다. 실제 웹 구성 요소 및 합성 데모 데이터의 사진 현지의 1280px、390px 및 320px 미리보기에는 가로 오버플로우가 없으며, 이미지 확대가 가능합니다. 브라우저 접속 공공 공식 웹사이트，HTML 모두와 함께 8 사진 SHA-256 소스코드와 일치。

## 대화 내용 표시 설정（2026-10-02，현지 재판）

- 웹페이지“디스플레이 설정”독립적인 사고 요약 및 실행 프로세스 스위치가 추가되었습니다. 둘 다 기본적으로 활성화되어 있으며 브라우저의 로컬 설정을 사용하여 저장됩니다. 실행 프로세스에는 도구, 명령, 파일 변경 및 태그가 포함됩니다. `commentary` 진행 노트; 사용자 메시지, 최종 응답, 표시되지 않은 단계가 있는 이전 응답, 오류 및 보류 중인 확인 카드가 계속 표시됩니다.。
- 스위치는 기존 기록 및 실시간 신규 추가에 즉시 적용됩니다./교체된 기록 숨겨진 콘텐츠는 새로운 콘텐츠 프롬프트를 트리거하지 않습니다. 숨겨진 기록을 건너뛰려면 위치를 스크롤하세요. 필터링한 후에는 기록 응답을 계속해서 채우고 다시 표시할 때 확장된 상태를 유지할 수 있습니다.。
- 52 항목 프런트 엔드/데스크탑 Node 수표 통과；Ego Browser 의 18 항목에 기존 타임라인 체크섬이 있습니다. 11 항목에 새 카테고리 추가/스트리밍/내역 확인이 통과되었습니다. 실제 설정 인터페이스 검증 독립 전환, 새로 고침 및 저장, 응답할 카드 보존, 중국어 및 영어 및 기본값으로 복원；390px 휴대폰、320px 좁은 화면、1280px 컴퓨터 인터페이스에는 수평 오버플로가 없습니다. 격리된 샘플 데이터를 사용하면 실제 모델 요청이 전송되지 않습니다.。
- 로컬을 대체하기 위해 서명, 검증 및 백업 완료 macOS arm64 App，실제 게이트웨이 HTML、타임라인 및 디스플레이 설정 스크립트/스타일은 소스 코드와 바이트 단위로 일관됩니다. 예약하다 LAN 8787、원본 인증 및 로그인 세션, 알림 구성 및 팔로우 채팅, 모든 외부 네트워크 연결이 닫힙니다. 업로드되지 않음 GitHub 또는 공개적으로 게시됩니다. 휴대폰 하드웨어의 효과는 계속 시도하는 사용자의 몫입니다.。

## 휴대폰 대화 레이아웃, 입력 영역 축소 및 모양 설정（2026-10-02，현지 재판）

- 모바일 대화 세부정보브랜드 숨기기/언어 상단 표시줄, 한 줄 탐색으로 압축된 제목. 전체 제목, 프로젝트 경로, 실행 중인 장치 및 모델 공급자가 공개 가능한 채팅 세부정보로 이동되었습니다. 모델, 알림 및 Skill 입력 영역 도구 모음에 남아 있습니다.。
- 툴바 수동 닫기 추가/버튼을 확장하면 하단 입력창, 전송 방법, 전송이 숨겨집니다./중지 버튼 및 선택됨 Skill 태그; 초안 및 Skill 유지를 선택하면 도구 입력 및 보류 중인 카드를 계속 사용할 수 있습니다. 메시지가 성공적으로 전송되면 자동으로 축소되지 않습니다. 메시지가 실패하면 확장된 입력 영역에 오류가 표시됩니다. 입력란은 내용에 따라 증가하며, 상한선은 160px。
- 웹페이지에 밝은 색상 추가/어두운/시스템, 기본 및 사용자 지정 강조 색상, 본문 텍스트를 따릅니다. 14–20px、암호 11–17px、세 가지 수준의 읽기 간격 및 기본값 복원. 설정은 브라우저 소스에 따라 저장되며 조정 내용은 즉시 적용됩니다. 사용자 정의 색상은 버튼 텍스트 색상을 자동으로 선택하고 링크 텍스트 대비를 조정합니다.。
- Ego Browser 동일한 격리 예시로 채팅、390×844 뷰포트 비교: 이전 메시지 영역 521px，새 버전이 확장되었습니다. 639px，닫다 735px，약 61.7%、75.7%、87.1%；입력 영역의 새 버전은 다음에서 시작됩니다. 152px 다음으로 축소 56px。실제 웹페이지 스크린샷은 다음 위치에 저장됩니다. `.tmp/mobile-refresh/`，샘플 대화를 사용하세요. 실제 대화는 전송되지 않습니다. Codex 정보。
- 브라우저 확인 초안 접기 및 유지, 읽은 위치 유지, 전송 실패 시 초안 유지, 일반 전송은 자동으로 접히지 않음, 접은 후 3개의 도구 입구, 채팅 세부정보, 확인해야 할 카드, 새로 고침 유지 설정, 시스템 테마 변경 및 기본값으로 복원。320×568 영어로/큰 글꼴 크기 및 목록、390×460 짧은 뷰포트、1280×900 어떤 컴퓨터 레이아웃에서도 페이지의 가로 오버플로가 없습니다. 짧은 뷰포트 전송 버튼은 여전히 ​​페이지 내에 있습니다.。
- 52 항목 프런트 엔드/데스크탑 Node 확인, 세션 공개 회귀 및 true HTTP 추가된 정적 리소스 확인이 통과되었습니다.；HTML ID 고유하며 스크립트와 스타일 모두 해당 경로가 있습니다.，Git diff 백지 수표 통과。
- 사용자가 확인한 로컬 macOS arm64 App 내장된 게이트웨이를 사용하여 백업, 교체 및 다시 시작하기 전에 무결성 서명을 확인하세요. 새 인스턴스가 실제를 통과했습니다. HTTP 새로운 내용을 포함하여 바이트 단위로 소스 코드와 일치하는 페이지, 스크립트 및 스타일을 제공합니다. `presentation.js` 및 `presentation.css`；LAN 8787、기존 로그인 세션, 인증, 알림 구성, 팔로우 채팅은 변경되지 않고 모든 외부 네트워크 연결이 종료됩니다. 세션에 로그인되지 않았습니다./계정 인터페이스 반환 401，오래된 터널 Host 뒤로 403，LAN 인증 상태 인터페이스 반환 200。
- 이번 라운드에는 밀리지 않았습니다. GitHub 아니면 대중에게 공개되거나; 기본 제어 창이 다시 열리지 않았으며 휴대폰 하드웨어와 실제 소프트 키보드 효과가 사용자의 시도를 기다리고 있습니다.。

## Windows 디렉토리 직업 수정 업데이트（2026-10-02，소스코드는 동기화되었으며 아직 공개되지 않았습니다.）

- beta.7 게시됨 1.0.0 독립형 업데이터를 시작할 때 작업 디렉터리가 지정되지 않았습니다. 설치 디렉터리에서 이전 방식의 업데이트 프로그램을 실행하는 격리된 테스트，Windows 실제 수익 `WinError 32`，이전 설치 디렉터리가 다음 위치로 이동되는 것을 방지합니다. `previous`。원래 포장 테스트는 창고 디렉토리에서 시작되었으며 이 조건은 다루지 않았습니다.。
- 커밋 수정 `e0bed28` 업데이트 프로그램이 설치 디렉터리의 상위 디렉터리에서 시작되도록 합니다. 이 디렉터리는 후속 작업을 방지하기 위해 설치 디렉터리와 트랜잭션 디렉터리 외부에 있습니다. App/게이트웨이 상속이 대체되거나 정리될 디렉터리입니다. 실제 메인 프로세스 설치 인계 테스트는 수리 전 실패, 수리 후 합격。
- [데스크탑 구축 및 테스트](https://github.com/try2love/codex-mobile-bridge/actions/runs/37006940725) 의 Windows、Intel Mac 및 Apple Silicon Mac 모두 합격。Windows 업데이터 14 검사가 통과되었습니다. 실제 패키징 프로그램은 기존 방식의 디렉토리 점유, 정상 업그레이드 완료, 오류 롤백 완료를 순차적으로 재현했다. 세 가지 시나리오 모두에서 게이트웨이가 복원되었으며 네 가지 구성이 바이트 단위로 유지되었습니다. 2종 Mac 업그레이드 및 롤백 확인을 통과했습니다.。
- [크로스 플랫폼 Python 행렬](https://github.com/try2love/codex-mobile-bridge/actions/runs/37006940792) 모두 통과되었습니다. 로컬 추가 패스 49 항목 프런트 엔드/데스크탑 검사、13 아이템 업데이트 확인（1 개 Windows 전용체크 생략） 및 10 개 Python 거래 확인 업데이트。
- 증거는 검역 테스트와 GitHub 네이티브 runner，사용자가 직접 확인되지 않음 Windows 컴퓨터에서 프로세스를 점유하고 있습니다. 수정사항이 업데이트되지 않았습니다. v1.0.0 라벨 또는 공공 설치 패키지; 영향을 받는 이전 클라이언트는 자체 업데이트 프로그램을 사용합니다. 첫 번째 업그레이드의 경우 게이트웨이를 중지하고 종료한 후 대상 버전을 사용할 수 있습니다. Setup.exe 설치 덮어쓰기, 자세한 내용은 업데이트 설명서를 참조하세요.。

## v1.0.0 정식 출시（2026-10-02）

- 버전 번호 및 lockfile 다음과 같이 통일 `1.0.0`，릴리스 노트, 이중 언어 README 및 제품 페이지에는 Intel Mac x64 DMG、Apple Silicon arm64 DMG、Windows x64 Setup.exe；세 가지 아키텍처가 남아 있습니다. ZIP 패키지 업데이트。
- 로컬 완료 Python 전체적으로 테스트됨 181 개：177 통해，4 개 Windows 전용 수표 건너뛰기; 프런트엔드/데스크탑 Node 49 항목 및 업데이트 프로그램 Node 12 항목이 통과되었습니다. 세 가지 설치 패키지 항목, 버전 일관성 및 Git diff 백지 수표 통과。
- [버전 라벨 테스트](https://github.com/try2love/codex-mobile-bridge/actions/runs/37004590211) 의 Windows/Ubuntu Python 3.9、3.13 및 macOS Python 3.13 모든 매트릭스가 통과됨；[공식 출시 과정](https://github.com/try2love/codex-mobile-bridge/actions/runs/37004590655) 의 Intel Mac x64、Apple Silicon arm64、Windows x64 다음을 포함한 모든 빌드 및 패키징 프로그램 검사를 통과했습니다. Mac DMG/ZIP 설치, 실제 App 시작, 알림, 장치 로그인, QR 코드 스캔 및 업그레이드/장애 복구。
- [v1.0.0](https://github.com/try2love/codex-mobile-bridge/releases/tag/v1.0.0) 최신 공식 버전으로 대중에게 공개되었으며, 소스 제출 `6e0c2191e73c09fda6d531883a49e4f6da72df73`。8 완벽한 액세서리；6 설치/업데이트 패키지 GitHub SHA-256 공개 검증 파일과 일치하도록 세 가지 플랫폼의 업데이트된 목록은 기존 공개 키 검증 서명을 통과했으며 파일 이름, 크기 및 해시가 일치합니다. 두 인분 README 3가지 유형의 설치 패키지 입구가 공식 웹사이트와 동기화됩니다.。
- 원격 플랫폼 검증은 다음에서 비롯됩니다. GitHub 네이티브 runner，사용자의 컴퓨터에 다시 설치되지 않음 Intel Mac、Windows 또는 실제 휴대폰에서 다시 확인하세요. 실제 재설정 카드 소비의 경우 시뮬레이션된 경로 확인만 수행됩니다.。Mac ～을 위한 ad-hoc 서명했지만 받지 못함 Apple 공증，Windows 인증서 서명이 없습니다. 이 공개 릴리스는 로컬 평가판 설치를 대체하거나 LAN 구성을 변경하지 않습니다.。

## 계정 로딩 및 API 상태（2026-10-02，현지 재판）

- 이전 인터페이스에는 첫 번째 읽기 중에는 상태 프롬프트가 없으며 읽기 실패 후 항목을 숨기고 폴링을 위해 1분 동안 기다립니다. 결함 주입은 이러한 복구 격차를 재현합니다. 실제 계좌에 대한 읽기 전용 확인에는 대략 시간이 걸립니다. 2.8 초만에 성공했습니다. 이전 로그에는 당시 휴대폰의 계정 응답이 기록되지 않았습니다. 작업이 지연되었는지 또는 실패했는지 확인하는 것은 불가능합니다.。
- 로그인 상태 읽기 프롬프트가 첫 화면에 즉시 표시됩니다. 공식 계정이 성공하면 할당량 입구가 자동으로 표시됩니다. 실패 후, 2 두번째、4 몇 초 후에 자동으로 다시 시도합니다. 지속적인 장애가 발생할 경우 일시적으로 사용할 수 없는 상태입니다. 종료하면 재시도 및 이전 결과가 지워지고, 다시 로그인해도 이전 미해결 요청으로 인해 더 이상 차단되지 않습니다. 자동 재시도는 읽기 전용이며 재설정 카드를 소모하지 않습니다.。
- 백엔드는 명확한 공식 계정을 반환합니다.、API、로그인되지 않았거나 유형을 알 수 없음；API Key、맞춤형 제공업체 및 profile 덮어쓰기는 여전히 공식 잔액 읽기 및 재설정 카드 사용을 금지합니다. 모바일 버전은 클릭할 수 없는 일반 텍스트로 표시됩니다.“API 연결”，로그인하지 않았거나 읽지 못한 경우 독립적인 프롬프트가 있으며 중국어와 영어를 지원합니다.。
- 49 개 Node 프런트 엔드/데스크탑 검사、34 개 Python 계정/HTTP 확인이 통과되었습니다. 내장된 브라우저는 실제 프런트 엔드 및 격리 인터페이스를 로드하여 지연된 응답과 최초 시도를 확인합니다. 409 다음 이후 자동 복원、API 로그인되지 않은 일반 텍스트 및 320px 영어 레이아웃; 테스트에서는 채팅 목록 새로고침을 클릭하지 않았고, 실제 채팅을 실행하지 않았으며, 리셋 카드를 소모하지 않았습니다.。
- 재구축 및 서명 확인됨 arm64 App，백업으로 로컬 설치 교체 및 다시 시작 LAN 8787 서비스; 설치 버전 페이지 리소스가 소스 코드와 일치하며, 실제 공식 계정의 읽기 전용 쿼리에 성공했습니다. 5번의 로그인/연결/관련 구성 파일이 바이트 단위로 일관되고 외부 네트워크 연결이 종료되었음을 알립니다. 사용자의 요구에 따라 화면은 잠긴 상태로 유지되며 데스크톱 제어 창은 다시 열리지 않습니다. 푸시되거나 공개적으로 공개되지 않습니다.。

## 모바일 상단 표시줄 및 스크롤 공간（2026-10-02，현지 재판）

- 아이콘, 이름 및 언어 선택이 전역 상단 표시줄에 병합되었습니다. 중복된 브랜드 표시줄이 제거되고 비어 있습니다. 새로 고침이 채팅 제목 행으로 이동되고 보관 모드와 표시 모드가 같은 행에 있으며 계정 입구가 하단 열에 병합됩니다. 페이지는 나머지 뷰포트에 따라 목록과 채팅 높이를 할당하고 휴대폰 입력 상자는 기본적으로 두 줄로 설정됩니다.。
- 내장된 브라우저는 격리된 정적 채팅 샘플을 사용하여 실제 채팅 내용을 확인합니다. HTML/CSS：390×844 다음 목록 스크롤 영역은 다음에서 시작됩니다. 446.7px（52.9%）증가하다 604.5px（71.6%），메시지 영역 506.5px 증가하다 520.7px。목록의 페이지를 넘긴 후 scrollTop ～을 위한 584.5px，페이지 자체가 남아 있습니다. 0，하단 막대는 뷰포트 하단에 유지됩니다.。
- 조사하다 320×568 중국어 및 영어 목록, 메시지 및 로그인 페이지, 1100×760 데스크탑 레이아웃; 수평 페이지 오버플로가 없으며 긴 로그인 페이지를 독립적으로 스크롤할 수 있습니다. 독창적인 요소 ID 중복 없이 모두 보관，13 품목 계정/알림 인터페이스 반환이 전달되었습니다. 실제 휴대폰 소프트 키보드, 브라우저 주소 표시줄, 기기 보안 영역을 시뮬레이션하지 않으며, 실제 채팅도 실행하지 않습니다.。
- 재구축 및 서명 확인 arm64 beta.8 App，백업 후 로컬 설치를 교체하고 다시 시작하십시오. LAN 8787 게이트웨이. 실제 HTTP 반환 HTML、CSS 소스 코드와 바이트 단위로 일관성을 유지하세요. 인증, 기존 로그인, 알림 및 주의 구성 파일은 바이트 단위로 변경되지 않고 유지됩니다.，Cloudflare 모든 외부 네트워크 연결이 닫힙니다.。Mac 잠금 화면은 데스크탑 제어 창이 다시 열리는 것을 방지합니다. 게이트웨이는 독립적으로 실행되며 모바일 페이지를 사용할 수 있습니다. 이번 라운드에서 푸시되거나 공개되지 않았습니다.。

## 공식 계정 기능 로컬 설치 및 LAN 전환（2026-10-02）

- 재구축 arm64 내장 게이트웨이 beta.8 App，패키지 계정 인터페이스, 스타일 및 개인정보 보호를 확인하세요. IPC 소스코드와 일치, 무결성 서명 확인 통과 후 교체 `.local/apps/Codex Mobile Bridge.app`。오래된 App 원래 구성으로 저장 `.tmp/account-install/`，이번 라운드에 출시되지 않은 버전。
- 이전 게이트웨이와 해당 게이트웨이를 중지하세요. Cloudflare 모든 외부 네트워크 연결을 비활성화하고 추가 정보를 지웁니다. HTTPS 소스, 원래 포트 포함 8787 LAN 서비스를 시작합니다. 계정 비밀번호, 기존 로그인, 알림 구성 및 팔로우 채팅은 일관됩니다. LAN접속은 정상, 로그인되지 않은 계정/채팅 인터페이스 반환 401，오래된 엑스트라넷 Host 뒤로 403。
- 새 설치 패키지의 개인 계정 인터페이스에서 실제 공식 계정 한도를 읽고 카드를 재설정했지만 카드가 소모되지 않았습니다.。App 프로세스가 시작되었습니다. 설치 후 기본 창 검토가 발생했습니다. Mac 잠금 화면, 더 이상 작동하지 않습니다. 이전 소스 코드 버전의 실제 창 검증은 다음 섹션을 참조하세요.。

## 공식 계정 한도 및 카드 재설정（2026-10-02，소스코드 검증）

- 컴퓨터 제어판은 모바일 웹페이지와 계정 패널을 공유합니다. 데스크탑의 내장 런타임과 동일한 런타임을 사용합니다. Codex 데이터 디렉터리는 계정 번호, 유효 구성 및 할당량을 읽습니다. 공식적인 ChatGPT 로그인하고 기본 공급자를 사용할 때 표시됩니다.；API Key、타사 공급자, 구성 profile 무시하고 로그인하지 않은 상태 숨김。
- 15 아이템 계정 백엔드 테스트、44 아이템 데스크탑/통지하다/계정 Node 시험、50 대화와 HTTP 회귀 테스트를 통과했습니다. 누락된 할당량, 다중 한도 창, 누락된 카드 재설정 세부정보, 권한 폐쇄, 계정 전환, 만료된 카드, 동시 반복 요청, 불확실한 결과 후 지속적인 재시도 및 로그인을 다룹니다./CSRF/상동성 보호。
- 실제 실행 Electron 제어판 390px 휴대폰 뷰포트에서는 현재 공식 계정 한도와 카드 재설정을 읽기 전용으로 성공적으로 확인할 수 있습니다. 스크린샷을 찍을 때 수평 오버플로가 없습니다. 인증이 꺼지면 데스크톱 재설정 버튼이 비활성화되고 테스트 게이트웨이가 중지됩니다.。
- 소비 경로 활용 시뮬레이션 RPC 실제 재설정 카드, 수정된 로그인 또는 데스크탑 인증이 사용되지 않았는지 확인하십시오. 현재 실행 중인 설치가 대체되지 않았습니다. 이 항목은 다시 포장되거나 푸시되거나 공개적으로 출시되지 않았습니다.。Windows 및 Intel 설치 패키지가 이 기능을 다시 수락하지 않았습니다.。

## beta.8：Intel Mac 이중 아키텍처 DMG（2026-10-02，로컬 후보 버전）

- 별도로 구축 macOS arm64 및 x64 완전한 Electron App 내장 Python 게이트웨이, 해당 생성 DMG/ZIP。DMG 포함하다 Applications 지름길; 둘 DMG 둘 다 실제로는 읽기 전용으로 마운트되고 복사됩니다. App 이미지를 제거한 다음 설치 복사본을 확인하십시오.。
- 네 가지 배포 패키지 모두 스키마 메타데이터를 전달합니다.、Electron/게이트웨이 바이너리 아키텍처, 무결성 서명 및 내장 런타임 HTTPS 확인하다; 확인하다 arm64 App ～처럼 x64 확인 시 예상대로 거부되었습니다. 사인은 아직 ad-hoc，아니요 Developer ID 또는 Apple 공증。
- Apple Silicon 이 머신에서 실행 arm64，이미 Rosetta 달리다 x64。양쪽 끝에서 실제 App 인터페이스, 내장 worker、로그인 지속, 로그인 취소、IP 규칙과 시뮬레이션 Bark/ntfy 알림이 모두 통과되었습니다. 양쪽 끝의 실제 업그레이드가 성공했고 인위적인 설치 실패의 롤백이 통과되었으며 구성 파일이 바이트 단위로 일관되게 유지되었습니다. 실제 채팅을 운영하지 않거나 모바일 알림을 보내지 않습니다.。
- 36 아이템 데스크탑/통지하다 Node 시험、12 아이템 업데이터 Node 테스트가 통과되었습니다. 서명 목록 회귀 적용 범위가 추가되었습니다. Mac arm64、Mac x64、Windows x64 각각에 맞는 것을 선택하세요. ZIP，부족함을 거부하고 Intel ZIP 불완전한 출시. 릴리스 확인 파일에는 다음이 포함됩니다. DMG。
- Desktop builds 구성된 `macos-15`（arm64）、`macos-15-intel`（x64）및 Windows x64 세 가지 목표, 각각 독립적인 제품을 업로드합니다. 확인 스크립트에 하드 코딩된 코드를 수정하세요. arm64 길. 이 라운드는 아직 원격 엔드를 실행하지 않았습니다. CI，네이티브가 아님 Intel 하드웨어 또는 Windows 재테스트；Rosetta 결과는 원본과 동일하지 않습니다. Intel 실제 기계 검증. 아직 푸시되거나 게시되지 않았습니다. beta.8，공개 다운로드는 그대로 유지됩니다. beta.7。

## beta.7：GitHub 쿼리 수정 업데이트（2026-10-02，게시됨）

- 진실로 GitHub Releases API 오래된 업데이터 재현 HTTP 415，응답에는 버전 목록이 허용되지 않는다고 명확하게 명시되어 있습니다. `application/octet-stream`。원래 요청이 아직 존재합니다. 58 현재 한도를 제외한 할당량。
- 대신 버전 목록 `application/vnd.github+json`，자산 다운로드에는 여전히 바이너리 요청 헤더가 사용됩니다. 새로운 요청 형식이 반환됩니다.，Node 업데이터 11 항목이 통과되었습니다. 현실 API 반환 HTTP 200；사용 App 같은 Electron 네트워크 전송 및 서명 확인을 위해서는 다음을 누르세요. Mac arm64 / Windows x64 대중에게 공개된 플랫폼 beta.6。명령줄 Node 직접 연결 GitHub 도메인 이름 다운로드 시간이 초과되어 연결할 수 없습니다. App 시스템 에이전트 전송 결과가 혼합되어 있습니다.。
- beta.5 / beta.6 이전 클라이언트는 수정된 버전을 수동으로 설치해야 합니다.。beta.6 설치 패키지 및 기능 검증은 여전히 ​​유효합니다. 게시된 태그 및 자산은 변경되지 않고 유지됩니다.。
- [beta.7 서명 공개 프로세스](https://github.com/try2love/codex-mobile-bridge/actions/runs/36972301731) 의 Mac / Windows 빌드 및 모든 패키징 검사를 통과했습니다. 공공 자산이 완전하고, 이중 플랫폼 목록 서명이 검증 파일과 일치합니다. 수정된 버전이 실제 통과되었습니다. Electron 전송 읽기 및 인식 beta.7。

## beta.6：휴대폰 알림, 로그인 유효기간 및 기기 관리（2026-10-02，게시됨）

- macOS 및 Windows 공유하다 Bark / ntfy 독립적인 알림 채널 다음 채팅마다 성공적인 완료를 알리도록 선택할 수 있으며, 이는 기본적으로 꺼져 있습니다. 현실 iPhone 영수증 확인됨 Bark 테스트 알림 자동 검사는 격리된 기본 서비스에만 전송됩니다.。
- 구성 가능한 로그인 유효 기간, 영구 로그인 기록, 컴퓨터 로그인 장치 목록, 로그인 취소 및 IP 하얀색/블랙리스트. 기록은 브라우저 로그인을 나타내며 하드웨어는 사용되지 않습니다. MAC；IP 금지 조치는 이 주소를 공유하는 장치에 영향을 미칩니다. 방문 시 제한된 시간이 연장되지 않습니다.，0 서버 만료 시간이 없습니다. 브라우저 정리 Cookie、로그아웃하고 도메인 이름을 변경하려면 다시 로그인해야 합니다.。
- Python 흔한 165 개：161 통해，4 개 Windows 전담점검 Mac 뛰어넘어라. 데스크탑/휴대폰 Node 36 항목 통과됨, 업데이트 프로그램 Node 10 항목이 통과되었습니다. 만료 경계 재정의, 재시작 시 지속, 인증 구성 변경 무효화, 지속성 취소、IP 우선순위, 위조 전달 헤더 거부 및 기본 관리 채널。
- PyInstaller 패키지 런타임이 로그인, 다시 시작, 취소, 금지 후 재로그인 거부, 규칙 복구, 허용 목록, 수정 유효 기간 만료 등 격리 종단 간 검사를 통과했습니다.；Bark / ntfy 현실의 HTTP 요청 형식, 키 숨기기 및 독립적인 오류 처리가 통과되었습니다. 전송된 모델 요청이나 실시간 채팅 작업이 없습니다.。
- macOS 후보자 App 무결성 서명, 실제 인터페이스 시작, 장치 규칙 저장 및 측면 오버플로 검사 통과 없음。
- [Python CI](https://github.com/try2love/codex-mobile-bridge/actions/runs/36970735722) 의 Windows/Ubuntu Python 3.9、3.13 및 macOS 3.13 모든 매트릭스가 통과됨；[Desktop builds](https://github.com/try2love/codex-mobile-bridge/actions/runs/36970735741) 의 Mac 및 Windows 모두 합격。Windows 실제 포장을 확인하세요 App 로그인 유효기간 및 기기 페이지 저장 IP 규칙 저장 및 이중 언어 레이아웃 두 플랫폼 모두 패키지 알림, 영구 로그인, 금지 후 로그인 거부 및 업데이트를 실행합니다./회복 확인。
- [서명 공개 프로세스](https://github.com/try2love/codex-mobile-bridge/actions/runs/36971300975) 제출하다 `cd39fa2098031d0be62ff95441fa30e8f5c1e7da` 듀얼 플랫폼 빌드를 완료하고 다시 확인하세요. 2026-10-02 풀어 주다 [v0.2.0-beta.6](https://github.com/try2love/codex-mobile-bridge/releases/tag/v0.2.0-beta.6)：macOS arm64 ZIP、Windows x64 설치하다 EXE / ZIP、SHA256SUMS 및 서명 업데이트 목록 완료。
- Windows 증거는 다음에서 나옵니다. GitHub Windows runner 사용자가 아닌 실제 패키저를 사용하여 Windows 컴퓨터나 실제 전화에서 엔드투엔드 상호작용을 재현해 보세요. 새로운 장치 규칙 테스트는 사용자의 실행 중인 게이트웨이 설정을 변경하지 않고 격리된 데이터를 사용합니다.。

## 자동 연결을 클릭했는데 누락되었습니다. WAL 수리 읽기（2026-10-02，널리 알려지지 않은）

- 01:00–01:02 게이트웨이 예외는 다음과 같습니다. SQLite `unable to open database file`；macOS 시스템 로그에는 프로세스가 누락된 항목을 열 수 없다는 사실이 정확하게 기록되어 있습니다. `state_5.sqlite-wal`。기존의 WAL/SHM 에 생성되었습니다 01:02:13。단 하나의 후보 세션 데이터베이스만 있고, 잘못된 데이터베이스 선택에 대한 증거는 발견되지 않았습니다.。
- 이 기계에서 SQLite 3.43.2 격리, 있다 checkpoint 데이터베이스에서 연결 없이 사용된 테스트를 삭제합니다. WAL/SHM 그 후 읽기 전용 쿼리에서는 동일한 예외가 안정적으로 다시 나타났습니다. 보조 파일을 설정한 후 쓰기 연결이 복구되었습니다. 실제 데이터베이스는 삭제되지 않습니다.、checkpoint 또는 수리 작업. 다음 사용자와 새 채팅 만들기 WAL 재구축 시간이 일치하지만 원래 어떤 프로세스가 이를 정리했는지는 확실하지 않습니다. WAL。
- WAL 누락된 경우 전달된 파일 ID 및 크기 읽기、mtime/ctime 및 WAL 수표의 개인 사본은 없습니다. 동시 변경 사항은 복사본을 삭제합니다. 이미 WAL 원래 읽기 전용 연결에서 계속 읽고 있으면 후속 제출에 대한 확인이 표시됩니다. 오류 프롬프트를 다시 시도할 수 있으며 로컬 읽기 실패로 인해 다른 호스트 목록이 차단되지 않습니다.。
- 점진적 기록 읽기 및 로그인을 시작하는 동안 모바일 세션을 엽니다./CSRF 검증된 네이티브 owner 활성화. 첫 번째 읽기에서 일시적인 오류가 발생하면 자동으로 다시 시도됩니다. 세션을 전환하면 이전 요청이 취소되고 지연 오류가 무시됩니다. 폴링 및 알림 듣기는 계속해서 구독 전용이며 채팅을 독립적으로 활성화하지 않습니다.。
- Python 전액 121 종 시앙 117 항목이 통과됨、4 아이템 플랫폼을 건너뛰었습니다. 이후에 추가된 목록 오류 격리 및 HTTP 오류 메시지는 두 번의 방향 확인이 통과되었음을 나타냅니다.。5 데이터베이스 테스트에는 변경되지 않은 원본 파일과 최신 파일이 포함되어 있습니다. WAL 복제 시 표시 및 동시 쓰기 커밋이 거부되었습니다.。Node 데스크탑 22 항목이 통과됨。
- 실제 브라우저는 원본을 점진적으로 읽습니다. 18 항목, 이중 언어 11 아이템, 신규 자동 연결 8 확인하다；390px 모바일 뷰포트에 수평 오버플로가 없으며 스크린샷을 확인하세요. 실제 패키징 런타임도 격리 데이터베이스를 사용하여 누락된 항목을 전달합니다. WAL 시나리오, 원본 마스터 파일 해시는 변경되지 않고 소스가 생성되지 않습니다. WAL/SHM。
- 현지의 App 재구축, 서명 확인, 백업 교체 및 재시작 게이트웨이, 4개의 구성 파일 해시、LAN 8787 포트와 알림 초점은 둘 다 동일하게 유지됩니다. 설치된 웹 페이지는 테스트를 거쳤으며 기존 공동 디버깅 채팅을 클릭하면 자동으로 연결됩니다. 약 1.1 초 단위로 첫 번째 배치 표시 20 기록, 모델 요청 없음, 승인 응답 또는 알림이 전송되었습니다.。
- 이번에는 게시되거나 푸시되지 않았습니다. GitHub；Windows 실제 기계와 실제 휴대폰 하드웨어는 다시 테스트되지 않았습니다. 일시적인 Cloudflare 컴퓨터가 다시 시작되면 주소가 변경됩니다. App 현재 전시는 우선할 것입니다。

## 로컬 콜드 세션 읽기 및 주문형 연결 수정（2026-10-02，널리 알려지지 않은）

- 초기 버전, 데스크탑 이전 버전 및 현재 소스 코드는 동일합니다. Codex App 콜드 세션이 환경에서 재현됩니다. owner / 스냅샷 대기에 실패했습니다. 문제를 탓할 수는 없다 App 팩. 현재의 적응 환경은 Codex App `26.928.31416`、실행 시간 `0.159.2`。
- 읽기는 백그라운드 구독만 전송하며 첫 번째 짧은 대기 후 지연된 스냅샷을 계속 수신합니다. 쓰기 작업 및 명시적“계속하려면 연결하세요”데스크톱 딥링크만 활성화됩니다. 연결 실패는 제출 기록이나 모델 요청을 생성하지 않습니다. 감기 추가 owner、지연된 스냅샷, 탐색 없는 읽기 작업, 기존 owner 탐색 없음, 명시적 활성화、SSH provider 상속, 실패하면 보내지 않음, 다시 연결하고 로그인/CSRF 및 페이지 매김 기록 보존 회귀。
- Python 흔한 116 개，112 항목이 통과됨、4 아이템 플랫폼 관련 건너뛰기；Node 데스크탑 22 항목이 통과됨。JavaScript 문법、Git diff 백지 수표와 Mac 패키지 무결성 서명이 전달되었습니다.。
- 실제 모바일 웹페이지는 격리된 로컬 게이트웨이와 언로드된 로컬 및 SSH 역사; 딸깍 하는 소리“계속하려면 연결하세요”，로컬 공동 디버깅 채팅 약속 4.1 이미 사용 가능한 스냅샷 및 대기 중인 응답 카드를 몇 초 만에 복원 SSH 이야기하다 7.6 몇 초 안에 연결이 성공합니다. 실제 모델 요청, 승인 응답 또는 알림이 전송되지 않습니다.。390px 가로 오버플로가 없는지 너비 확인。
- 로컬 긴 채팅의 데스크톱 페이징 스냅샷에는 최신 정보만 있습니다. 10 바퀴; 수리 후 저장된 45 바퀴, 네이티브 patch 상태는 기록 병합으로 덮어쓰여지지 않았습니다. 전체 스냅샷은 대체를 보존하기 위해 여전히 프레젠테이션 레이어를 포함합니다./의미 체계 삭제。
- 이전 테스트 채팅 데스크톱 로그는 명확하게 보고합니다. `Model provider ... not found`，채팅 자체가 안되네요 resume。변경하지 않고 provider；이러한 데스크탑 구성 오류는 여전히 원래 구성으로 복원되어야 하며 성공적인 자동 연결로 간주될 수 없습니다.。
- 현지의 App 내장 게이트웨이가 다시 설치되어 4개의 구성 파일이 유지됩니다. SHA-256、두 개의 알림이 따르고 원본 LAN 포트; 실제 LAN 홈페이지 인증 인터페이스 반환 200、로그인되지 않은 세션 인터페이스가 반환됩니다. 401。패키징 게이트웨이에 로그인한 후 로컬 머신의 기록을 읽습니다. 0.02 두번째、SSH 역사 약. 0.72 초（로컬 네트워크 샘플링, 휴대폰의 종단 간 시간 소비를 나타내지 않음） 이번 라운드 Mac 잠금 화면, 기본 제어판에 새로운 시각적 수용 기능이 없습니다.；Windows 실제 기계, 휴대폰 하드웨어 및 공용 네트워크 액세스는 다시 테스트되지 않았습니다. 푸시되지 않음 GitHub。

## 릴리스 패키지 HTTPS 루트 인증서 복구（2026-10-01）

- ～에서 GitHub 다운로드됨 beta.3 사용 Python 3.13 / OpenSSL 3，기본 CA 경로는 빌드 머신의 Python 설치 디렉터리가 사용자 컴퓨터에 존재하지 않습니다. 패키지에 루트 인증서가 없습니다. 격리 디렉터리는 원본 패키지를 호출합니다. `check-entry`，안정적인 재생산 `CERTIFICATE_VERIFY_FAILED`；동일한 하위 프로세스에 대해 지정된 경우에만 유효합니다. CA 파일을 전달할 수 있으며 근본 원인이 확인됩니다.。
- 패키지 종속성이 수정되었습니다. `certifi==2026.7.22`，명시적으로 수집됨 Mozilla 루트 인증서 및 라이센스. QR코드 사전체크, 고정출입구 감지 및 ntfy 인증서 재사용 및 호스트 이름 확인 TLS context；시스템을 유지하고 명시적으로 CA 구성. 소스 코드 작업은 여전히 ​​표준 라이브러리에만 의존합니다.。
- 실제 루프백이 추가되었습니다. TLS 테스트: 고정된 런타임 및 기본값 시뮬레이션 CA 사용할 수 없는 경우 신뢰할 수 있는 인증서가 전달되었는지, 도메인 이름이 잘못되었거나 알 수 없는지 확인하세요. CA 거부, 포장 인증서 누락 거부、ntfy 신뢰할 수 있는 동일한 소스를 사용하세요.。108 개 Python 검사중 104 항목이 통과됨、4 아이템 플랫폼 관련 건너뛰기；22 개 Node 수표 통과。
- 새로운 `scripts/verify-https.py`：격리 디렉터리에 실행 프로그램을 실제로 패키징하여 공용 네트워크를 확인 TLS、알려지지 않은 CA 거부, 사용자 정의 CA 도메인 이름과 일치합니다. 로그인 자격 증명을 생성하거나 알림을 보내지 않습니다. 이전 다운로드 패키지가 공용 네트워크에 있습니다. TLS 단계 실패, 로컬 복구 런타임 통과；Mac ZIP 감압 검증 및 Windows 이 검사는 빌드 시스템 인증서에만 의존하지 않도록 패키징 검증에 추가됩니다.。
- 기본 수리 ZIP 무결성 서명 및 패키지 HTTPS 확인이 통과되었습니다. 실제 런타임을 사용하여 현재 런타임을 비교합니다. Cloudflare 포털은 단기 코드 스캔 자격 증명을 생성하고 즉시 취소합니다. 토종의 App 확장 후 QR 코드와 카운트다운을 표시한 다음 축소하고 취소할 수 있습니다. 데스크탑 콘솔 전후에 4개의 구성 파일을 변경합니다. SHA-256、게이트웨이 PID、8787 포트, 연결 주소 및 두 가지 알림 문제는 동일하게 유지됩니다. 실제 알림이 전송되지 않거나 사용자를 대신하여 휴대폰 스캔이 완료됩니다.。
- 커밋 수정 `e2a97d3` 의 [크로스 플랫폼 Python 조사하다](https://github.com/try2love/codex-mobile-bridge/actions/runs/36884346124)및 [Mac / Windows 데스크탑 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/36884346072)양쪽 끝의 실제 패키징 런타임을 포함하여 모두 통과되었습니다. HTTPS 조사하다. 별도로 다운로드 GitHub CI 생성됨 Mac 가방（Python 3.13），이 컴퓨터의 서명, 인증서 격리 시나리오 및 현재 상황을 다시 확인하세요. Cloudflare 코드를 스캔하여 생성하고 모두 통과했으며 테스트 자격 증명이 취소되었습니다.。Windows 결론은 다음과 같습니다. CI，엔터티에 없음 Windows 컴퓨터 테스트。

## Cloudflare 최초 구성 및 원클릭 설치（2026-10-01）

- 새로운 중국어 및 영어 튜토리얼, 공식 포털, 원클릭 설치, 기존 프로그램 감지, 종속성 점프 누락, 자동 경로 채우기 및 저장되지 않은 프롬프트가 데스크탑에 추가됩니다. 임시 터널 연결 상태는 게이트웨이 상태와 무관하며 터널 로그는 실행 로그에 들어갑니다.。
- 설치 요청은 로컬 데스크톱에서만 옵니다. IPC。다운로드 제한됨 Cloudflare 공식적인 GitHub 릴리스와 그 HTTPS 자산 도메인 이름, 홉별 확인, 계정이 전송되지 않음 Cookie；사용 Release SHA-256 검증이 통과된 후에만 버전 감지를 검증하고 수행하십시오. 게이트웨이 데이터 디렉터리에 설치되며 기존의 다른 프로그램을 다루거나 시스템을 수정하지 않습니다. PATH 또는 시스템 서비스를 설치하십시오.。
- Mac 실제 테스트를 통과했습니다 Electron 네트워크 스택 다운로드 공식 `cloudflared 2026.9.3` arm64 패키지, 공식 요약을 확인하고 실행 `--version`；공용 네트워크 터널은 시작되지 않으며 테스트 파일은 격리 디렉터리에 저장됩니다.。
- 105 개 Python 테스트 중 101 항목이 통과됨、4 아이템 플랫폼 관련 건너뛰기；22 개 Node 검증에 실패하면 실행되지 않는 것을 포함하여 테스트가 통과되고, 비공식 점프가 거부되고, 보관된 일반 프로그램 파일만 읽히고, 기존 프로그램 및 구성이 유지되고, 설치 후 양식 초안이 유지됩니다.。
- 실제 Electron 창 확인 입구, 자동 경로 채우기, 작은 빨간색 점, 기타 구성 초안 유지, 중국어 및 영어 전환 및 820px 창의 수평 오버플로 없음。Windows 다운로드 파일명과 설치과정을 시뮬레이션하여 다루고 있으며, 실제와 같습니다. Windows 이번 라운드에서는 공식 다운로드 및 휴대폰 공용 네트워크 액세스가 테스트되지 않았습니다.。

## macOS 패키지 서명 복구 다운로드（2026-10-01）

- 사용자가 다운로드함 `v0.2.0-beta.1` Mac ZIP 및 GitHub Release SHA-256 완전히 일관됨，ZIP 내부 CRC 모두 통과되었습니다. 다시 압축을 푼 후 `codesign --verify --deep --strict` 및 `spctl --assess` 모두 보고됨 `code has no resources but signature indicates they must be present`。다운로드 및 전송 손상이 아닌 퍼블리싱 패키지 서명 문제인 것으로 확인되었습니다.。
- 원본 빌드 명시적 설정 `mac.identity: null`，최종 패키지 서명을 건너뜁니다. 대신에 `"-"` 생성하다 ad-hoc 무결성 서명. 그것은 제공하지 않습니다 Developer ID 신원 신뢰 또는 Apple 공증은 다운로드 후 브라우저를 처음 열 때 사용자가 수동으로 허용해야 할 수도 있습니다.。
- 새로운 `scripts/verify-macos.py`，실제에 ZIP 패키지, 중첩 코드, 내장 런타임을 다시 풀고 확인하세요. 오래된 Release 안정성 실패, 로컬 `beta.2` 빌드 패스。
- 새로운 `scripts/smoke-macos.cjs`，실제 시작 포장 App，렌더러와 내장 여부 확인 worker 데이터 디렉터리 초기화 및 격리、Node 격리 및 게이트웨이는 중지된 상태로 유지됩니다. 로컬 검사가 통과되었습니다. 실제 채팅이 연결되지 않았거나 공식 게이트웨이가 시작되었거나 알림이 전송되지 않았습니다. 두 수표가 모두 추가됩니다. macOS CI。
- 18 개 Node 데스크톱 테스트를 통과했습니다. 새 버전 패키지에는 통합 휴대폰 및 프로그래밍 기호 아이콘이 포함되어 있습니다.；README、영어 설명 및 소개 페이지 첫 번째 시작 단계 추가。Windows 기존 설치 및 운영 검증은 다음과 같이 계속됩니다. Windows CI 구현하다。

## 접이식 스캔 코드 로그인 및 시험판 버전（2026-10-01）

- 통합 지점의 각 입구에 대해 독립적인 접이식 코드 스캔 영역 구현: 확장 및 생성, 새로 고침 및 교체, 축소 및 취소、5 분 만료, 단일 사용, 소스 바인딩, 다시 시작 실패; 수동 비밀번호 로그인 및 12 시간별 웹 로그인은 원래 규칙을 유지합니다. 발급은 기본 제어 채널에서만 제공됩니다.。
- Mac 현지의 103 개 Python 검사중 99 항목이 통과됨、4 아이템 플랫폼 관련 건너뛰기；18 개 Node 확인이 통과되었습니다. 동시 스캔 코드 성공 1회, 오류 소스 거부, 재생 포함/만료됨/취소、HTTPS Cookie、개인 제어 파일 정리, 고정 항목 인스턴스 검증 및 신뢰성 PNG 디코딩。
- `npm run test:pairing` 실제 게이트웨이와 격리 Chromium 390px 모바일 페이지 인증 자동 로그인 및 삭제 URL 조각화, 동일한 페이지의 코드 다시 스캔, 반복되는 코드 스캔 거부, 비밀번호 롤백, 축소 및 취소, 확장된 상태를 유지하기 위한 이중 언어 및 폴링, 수평 오버플로 없음. 실제 모델 요청이 전송되지 않거나 ntfy 통지하다。
- 휴대폰 카메라 하드웨어、iOS Safari、모바일 셀룰러 네트워크 및 사용자 소유의 고정 도메인 이름/NAS 코드 스캔 경로는 테스트되지 않았습니다. 자동 브라우저 테스트는 이러한 환경을 수용하는 것과 동일하지 않습니다. 버전이 서명되지 않은 시험판 빌드입니다.。

## Mac / Windows 통합 기준선（2026-10-01）

- `integration/desktop-cross-platform` 기반으로 Windows 나뭇가지 `d293fe1`；이 커밋에는 이미 데스크톱이 포함되어 있습니다./모바일 지점 `339324b`，통해 Git 상위 관계는 양쪽의 변경 사항이 완전히 통합되어 충돌하는 콘텐츠를 병합할 필요가 없음을 확인합니다. 예약하다 Windows 쟁반、NSIS 설치 패키지、ZIP、언어적 기억과 휴대폰 그리고 Mac 병렬 연결 기능。
- 에서 Mac 다음에서 통합 코드를 다시 실행하세요.：96 개 Python 검사중 92 항목이 통과됨、4 플랫폼 관련 점검을 건너뛰었습니다.，17 개 Node 데스크톱 테스트 통과；Mac App 로컬 빌드가 완료되고 내장된 런타임은 격리된 데이터 디렉터리와 포트를 사용하여 시작, 이중 언어 웹 페이지 리소스 검사 및 중지를 완료합니다.。
- Windows 원래 분기와 동일한 코드 기준선 [크로스 플랫폼 Python 조사하다](https://github.com/try2love/codex-mobile-bridge/actions/runs/36856184998)및 [Mac / Windows 데스크탑 빌드](https://github.com/try2love/codex-mobile-bridge/actions/runs/36856185018)이미 들어와 있어요 GitHub 성공。Windows 워크플로에는 실제 포장이 포함됩니다. App 시작 및 중지, 트레이 복구 및 휴대폰 이중 언어 확인; 설치, 업그레이드, 제거 또는 실제 공용 네트워크 링크 승인과 동일하지 않음。
- 이번 라운드에서는 코드와 빌드 항목만 통합합니다. 현재 사용되는 게이트웨이 구성 및 LAN 포트는 수정되지 않았습니다. 베이스라인이 통합되었을 때의 상태입니다. 후속 스캔 코드 로그인 및 릴리스 승인에 대해서는 이 문서의 상단을 참조하세요.。

## Windows 최신 데스크톱 분기 동기화（2026-10-01）

- 멀리 떨어져있을 것이다 `feature/desktop-ntfy` ～에서 `b00b503` 도착하다 `339324b` 네 가지 제출물은 `codex/windows-desktop-app`：휴대폰의 새 채팅, 고정 도메인 이름 배포 마법사, 병렬 연결, 데스크톱/모바일 이중 언어 및 최신 로그가 먼저 표시됩니다. 예약하다 Windows 트레이, 설치 패키지、ZIP 오래된 언어 환경 설정。
- Windows 새로운 채팅 보조 런타임을 생성할 때 숨겨진 콘솔을 사용하십시오. `codex://` 등록된 핸들러를 통해 링크가 열렸습니다. 합성 런타임 및 시뮬레이션 URL handler 확인이 통과되었으나 실제 채팅이 생성되지 않았거나 테스트를 위해 모델 요청이 전송되지 않았습니다.。
- Python：96 종 시앙 94 항목이 통과됨、2 건너뛴 항목（심볼릭 링크 권한）、POSIX 네트워크 카드 열거）. 데스크탑 Node：17 항목이 통과되었습니다. 휴대폰 `runI18nTests()` 실제로는 Chromium 페이지 실행 11 메시지 초안, 질문 답변 및 제출된 상태 유지를 포함하여 확인이 통과되었으며 언어 전환 시 요청이 전송되지 않습니다. 만 사용 Node 이 파일을 로드하는 것은 브라우저 테스트를 수행하는 것으로 간주되지 않습니다.。
- 재구축 PyInstaller 내장 게이트웨이、Windows NSIS 및 ZIP。실제 포장 App 중국어로/세 가지 연결 항목 표시, 저장 및 비활성화, 서버 및 비활성화를 확인합니다. NAS 구성 및 ZIP 생성, 루프백 주소만 시작 및 중지, 비로그인 보호, 휴대폰 로컬 리소스, 이중 언어 전환, 언어 메모리 다시 시작 및 트레이 복구. 테스트 서비스를 시작하기 전에 모든 가상 외부 네트워크 연결을 비활성화합니다. 연결 없음 예 SSH 또는 NAS 주소。
- 5개의 영어 페이지가 있습니다. 820×640 수평 오버플로가 없는지 확인하고 홈페이지, 네트워크 및 알림의 스크린샷을 수동으로 검토했습니다. 언어입구는 우측 상단에 통일되어 있고, 데스크톱과 모바일 언어는 독립적으로 저장되며, 원격 번역표는 공유됩니다.，Windows 트레이 전용 사본만 유지됩니다.。
- 테스트에서는 격리된 디렉터리를 사용했으며 사용자의 원래 배포를 마이그레이션하거나 시작하지 않았습니다. 실제 외부 네트워크、SSH 왕복 여행、NAS 세대 반대, 모바일 셀룰러 네트워크, 새로운 리얼 채팅, 설치/치받이/제거는 아직 테스트되지 않았습니다. 빌드가 서명되지 않았습니다. 이 분기는 푸시되지 않으며 로컬 결과에 따라 리모컨을 요청할 수 없습니다. CI 합격。

## Windows 데스크탑 App（2026-10-01）

- 데스크탑 중국어 간체 추가됨/영어 전환 및 선호 지속성。14 개 Node 테스트가 통과되었습니다. 실제 포장 App 중국어와 영어 간의 왕복 전환이 저장되지 않은 테마, 상태 및 버튼 번역을 유지하고, 종료 및 다시 시작을 완료하고, 영어를 복원하고, 원래의 시작-중지 및 트레이 프로세스가 여전히 통과하는지 확인하십시오. 다음으로 끝나는 영어 페이지 5개 820×640 CSS 수평 오버플로가 없는지 픽셀을 확인하고 로컬 테스트 스크린샷을 보관하세요. 실행 로그의 원본 텍스트를 유지합니다. 이는 모바일 웹페이지가 이중 언어로 되어 있다는 의미는 아닙니다.。

- 나뭇가지 `codex/windows-desktop-app` 원격 기반 `feature/desktop-ntfy` 의 `b00b503`；원래 명령줄 배포를 대체하거나 원래 채팅 데이터를 수정하지 않고 독립적인 작업 디렉터리에서 개발되었습니다.。
- 환경：Windows 10 build 19045 x64、Node.js 24、Electron 44.5.1、electron-builder 26.15.3、CPython 3.9.13、PyInstaller 6.20.0。
- 기본적으로 구축됨 NSIS 현재 사용자 설치 패키지 `Codex-Mobile-Bridge-0.2.0-Windows-x64-Setup.exe` 그리고 완료 ZIP 압축을 푼 버전입니다. 사용되지 않음 Windows 서명 인증서; 설치, 업그레이드 및 제거 프로세스는 아직 테스트되지 않았습니다.。Windows 11、ARM64 그리고 이 지점 Mac 실제 머신이 확인되지 않음。
- `npm run test:windows-app` 실제에 `win-unpacked` App 검증 통과: 중국어 및 우주 데이터 경로, PATH 제거하다 Python/Node 내장 런타임을 사용한 후 렌더러에 액세스할 수 없습니다. Node require、원클릭 시작 및 중지, 런타임 중 네트워크 필드 잠금, 로그인 없이 채팅 인터페이스 401、페이지와 Markdown/수식 자원 200、알림 구성이 저장되었으며 닫힌 상태로 유지됩니다.。
- 동일한 수표를 사용합니다. Windows 기본 종료 메시지는 게이트웨이가 트레이로 복귀된 후에도 여전히 온라인 상태인지 확인합니다. 두 번째 시작에서는 원래 창을 복원한 다음 해당 창에서 정상적으로 게이트웨이를 중지합니다. 연결, 알림 및 실행 구성 페이지를 스크린샷으로 확인했으며 가로 오버플로가 없습니다. 테스트에서는 격리 디렉터리와 포트를 사용합니다. 테스트가 완료되면 게이트웨이 테스트를 중지하고 테스트를 종료합니다. App。
- 자동 시작 GUI 사용할 수 없습니다 `windowsHide:true`，그렇지 않으면 Windows 닫을 수 있는 메인창은 노출되지 않습니다. 백그라운드 게이트웨이는 여전히 숨겨진 콘솔을 사용합니다. 창을 숨길 때 Chromium 디버깅 포트는 정지되어 게이트웨이 생존 신호로 사용되지 않을 수 있습니다. 복구 후에는 원래 디버깅 연결 확인 창이 유지되고 재사용됩니다.。
- `npm run test:desktop`：11 항목이 전달되고 새 트레이가 추가됩니다. URL 우선순위, 반복 작업 보호, 중지 실패 시 종료 없음, 컨트롤러에서만 종료 및 리소스 정리 확인。Python 전액 반환：70 종 시앙 68 항목이 통과됨、2 건너뛴 항목（심볼릭 링크 권한）、POSIX 네트워크 카드 열거）. 재테스트 중에 인증 테스트가 발생했습니다. WinError 10054；단일 항목과 전체 재검사 모두 통과했으며, 안정적이고 재현 가능한 문제로 자리매김하지 않았습니다.。
- 현재 테스트 작업이나 릴리스가 실제 채팅으로 전송되지 않았습니다. ntfy 뉴스이며 실제 휴대폰과 공용 네트워크를 다시 받아들이지 않았습니다. HTTPS 또는 SSH 링크. 원래의 Windows 명령줄 외부 네트워크 확인은 아래 기록을 참조하세요. 이 버전을 대체할 수 없습니다. App 실제 외부 네트워크 수용。
- Windows 패키징 워크플로가 실제 패키지에 추가되었습니다. App 연기 점검; 이 분기는 아직 푸시되지 않았으며 로컬 시스템에 따라 원격으로 요청할 수 없습니다. CI 합격。
## 병렬 연결 및 중국어 및 영어 인터페이스（2026-10-01）

- 연결 구성이 독립 항목으로 변경되었습니다. 임시 LAN인 LAN을 지원합니다. Cloudflare 포털 및 다중 고정 서버 / NAS 동시에 입구가 활성화됩니다. 이전 단일 항목 구성은 읽을 때 마이그레이션되며 저장하기 전에 원본 파일을 덮어쓰지 않습니다. 추가의 HTTPS 주소 보충 용도, 조건 및 자동 허용 목록 설명。
- Mac 전체 Python 반품 95 개：92 항목이 통과됨，3 개 Windows 독점 테스트 건너뛰기；9 개 Node 데스크톱 검사를 통과했습니다. 다중 입력 저장에 대한 적용 범위가 추가되었습니다./폐기, 포트 충돌, 이전 구성 마이그레이션, 소스 관리 허용, 로그 역순 및 다중 라인 스태킹, 2개 SSH 전달 및 임시 터널은 동시에 실행되며 터널 대기는 서비스를 차단하지 않으며 종료 및 프로세스 생성이 완료되면 정리가 발생합니다.。
- 현실 Electron 렌더러 연결 격리 Python worker，세 개의 연결 항목이 저장되었는지 확인、ZIP 내보내기, 전제 조건 감지, 저장되지 않은 빨간색 점, 양방향 언어 전환 및 820 픽셀 창의 수평 오버플로가 없습니다. 중국어 및 영어 네트워크 페이지의 스크린샷과 영어 알림 튜토리얼을 확인했습니다. 실제 연결이 없습니다. SSH 서버 또는 알림 보내기。
- 모바일 브라우저 390×844 영문로그인, 채팅목록, 승인카드, 메시지입력 확인、Markdown 그리고 공식。11 초안, 선택한 항목, 사용자 정의 답변, 무료 답변 및 텍스트 보존을 포함하는 항목의 이중 언어 회귀가 통과되었습니다. 제출된 승인은 언어를 전환한 후에도 비활성화된 상태로 유지됩니다. 언어를 전환하면 네트워크 요청이 전송되지 않습니다. 영어 모드 18 텀 프로그레시브 로딩 회귀가 통과되었습니다. 브라우저 확인 스크립트는 다음과 같습니다. `tests/browser/i18n.browser.js` 및 `tests/browser/timeline.browser.js`，합성 채팅의 사용은 휴대폰 하드웨어의 실제 테스트를 나타내지 않습니다.。
- 중국어와 영어 README、아키텍처 설명 및 내보내기 ZIP 영어 배포 지침이 완료되었습니다. 로그는 소스별로 표시되며 각 소스의 최신 기록이 맨 위에 표시되며 오류 스택의 내부 순서가 유지됩니다. 원본 로그와 채팅 내용은 번역되지 않습니다.。
- Mac App 현지 포장이 완료되었습니다. 패키지에는 데스크톱 언어 및 연결 구성 리소스가 존재하며, 독립 포트를 갖춘 패키징 게이트웨이는 모바일 페이지 및 언어 리소스를 제공할 수 있습니다. 이번 자동 확인 라운드 동안 Mac 설치가 완료되지 않은 후 화면을 잠그고 기본 창을 시각적으로 검토하세요. 실제 서버/NAS 공용 네트워크 병렬 링크 및 Windows 새 인터페이스는 해당 환경에서 여전히 승인되어야 합니다.。

## 고정 항목 구성 마법사（2026-10-01，현지 검증）

- 나만의 서버 추가 SSH 왕복 여행、NAS / Docker 참가 양식; 실제 구성 생성 ZIP 및 배포 Agent 텍스트 및 고정 소스는 자동으로 관리되며, 알림은 자동으로 선택되어 수정될 수 있습니다. URL。원래 LAN 포트는 자동으로 변경되지 않습니다.。
- 90 개 Python 돌아오는 중 87 항목이 통과됨，3 개 Windows 독점 테스트 건너뛰기；9 개 Node 데스크톱 테스트를 통과했습니다. 신규 커버리지 구성 마이그레이션, 소스 관리, 동작 중 진입 금지, 입력 거부, 알림 주소 우선순위、SSH 상태/백오프 및 정지, 고정된 입구 인스턴스 검증。
- 독립적인 데이터 디렉터리로 실제 실행 Electron 렌더러 Python worker：서버를 저장하세요 NAS 구성, 저장되지 않은 빨간색 점, 내보내기 ZIP、시작되지 않았을 때 모든 거부 테스트가 통과되었습니다.；1100 픽셀 창 스크린샷 확인됨，820 수평 오버플로가 없는 픽셀 최소 너비입니다. 실제 서버로 전송되지 않음 SSH 연결됨, 알림이 전송되지 않음。
- Mac App 패키지되어 원래 위치에 설치되었습니다. 게이트웨이는 원본에 있습니다 8787 포트 작동 재개, LAN `/api/auth` ～을 위한 200 새 인스턴스 ID를 포함합니다.。`config.json`、`desktop.json`、`notifications.json`、`notification-watches.json` 이전과 이후 SHA-256 그대로, 계속 2 팔로우하고 채팅하세요. 설치 후 기본 창에서는 새로운 연결 방법 선택기, 계정 비밀번호 모드 및 원래 포트를 확인합니다.。
- 생성된 두 가지 유형 Compose 파일이 통과됨 `docker compose config -q`。현재 실제 서버가 없습니다/NAS/도메인 이름 구성，Docker daemon 실행되지 않음, 실행되지 않음 Caddy/Nginx 컨테이너, 인증서 발급 또는 셀룰러 네트워크의 엔드투엔드 수용。SSH 전달은 시뮬레이션 테스트일 뿐입니다.；Windows 새 마법사는 아직 실제 머신에서 검증되지 않았습니다.。


## NAS 입장 및 새 채팅（2026-10-01）

- 다음 사용자와 새 채팅 만들기 NAS 문서가 푸시되었습니다. `feature/desktop-ntfy`，제출하다 `d7cb302`；GitHub Python 확인하고 Mac/Windows 패키징 통과, 메인 브랜치가 병합되지 않음。
- 이전 일괄 알림 튜토리얼, 저장되지 않은 빨간 점, 출시된 시작 상태가 다음과 같이 수정되었습니다. `b00b503`，GitHub Python 테스트 및 Mac/Windows 데스크탑 빌드가 모두 통과되었습니다. 사용자가 휴대폰 수신을 확인합니다. ntfy 알림, 해당 채팅에 들어가려면 클릭하세요.。
- Mac 79 개 Python 돌아오는 중 76 항목이 통과됨、3 개 Windows 단독검사 생략；7 개 Node 데스크탑 반품이 통과되었습니다. 새 적용 범위 로그인 추가/CSRF、허용된 항목만 저장되었으며, 다시 시작한 후 생성이 중복 제거 및 복원되고, 결과를 알 수 없으며 다시 전송되지 않으며, 데스크톱이 열리지 않으면 그대로 유지됩니다. ID、원격 호스트는 매개변수와 격리되어 있으며 빈 채팅으로 생성된 보조 프로세스는 모델 라운드를 호출하지 않습니다.。
- 사용자 승인 Mac 로컬 빈채팅이 생성된 후 원본에서 App 개방적이고 정통 IPC 로 확인됨 `connected=true`、`idle`、0 휠 메시지；provider 로컬 구성을 상속합니다. 첫 번째 지속성 프로브에서 남겨진 복구할 수 없는 빈 레코드가 통과되었습니다. App 보관, 수정 및 확인되었습니다. 테스트되지 않은 모델 작업。
- 390×844 모바일 뷰포트에서 새 팝업 창 확인, 기본/SSH 프로젝트 선택, 실패 프롬프트, 재사용 요청 재시도 ID、성공하면 채팅이 자동으로 열립니다. 수평 오버플로가 없습니다. 브라우저 상호작용은 독립된 시뮬레이션 서버를 사용하며, 실제 빈 채팅 인수는 별도로 검증됩니다.。
- Docker Compose 네이티브를 통해 구성 `docker compose config`；HTTP 회귀 검증 공용 네트워크 Host/Origin、Secure Cookie 그리고 구성되지 않았습니다 Host 거부하다. 현재의 Docker daemon 달리지 않아, 달리지 않아 Nginx 컨테이너, 둘 다 NAS、공개 도메인 이름 또는 휴대폰 셀룰러 네트워크 실제 테스트 튜토리얼 전달이 사용자와 동일하지 않음 NAS 배포됨。
- 현지의 Mac App 업데이트됨; 원래 구성으로 다시 시작한 후에도 여전히 지속됩니다. 8787 서비스 제공, 계정 비밀번호, 네트워크 설정、ntfy 구성 및 2 프로필 해시는 팔로워 채팅 전체에서 일관됩니다. 생산 주소의 새 페이지와 프로젝트 인터페이스가 확인되었습니다. 프로젝트 인터페이스에 로그인되지 않았습니다. 401，로그인 후 열람 가능 20 프로젝트（포함 5 개인 SSH 프로젝트）. 공용망 입구는 변경되지 않았습니다.。
- Windows 새롭고 진짜 SSH 실제 머신에서는 새로운 생성이 확인되지 않았습니다. 빈 채팅 지속성과 딥링크 탈취는 여전히 실제 연습에 의존합니다. Codex App/런타임 버전。

## 데스크탑 App 및 ntfy 실험적 검증（2026-10-01）

- 알림 페이지에는 최초 액세스 단계, 무작위 주제 생성, 테스트 프롬프트 및 문제 해결이 추가됩니다. 저장되지 않은 상태는 사이드바와 저장 표시줄에 빨간색 점으로 표시됩니다.。Mac 기본 창에서는 별도의 임시 구성을 사용하여 수정 사항을 확인하고, 페이지 전체에 유지하고, 저장 성공 시 지우고, 실패 시 유지하고, 다시 변경 시 지우고, 튜토리얼 레이아웃을 확인합니다. 자동 확인은 공개 주제에 테스트 알림을 보내지 않습니다. 이후 사용자는 실제 전화가 성공적으로 수신되었음을 확인합니다. ntfy 알림을 클릭하면 해당 채팅이 바로 열립니다. 실제 피드백은 휴대폰 시스템을 지정하지 않으며 대표하지 않습니다. iOS 및 Android 모두 하나씩 테스트되었습니다.。
- 시작 프롬프트 표시줄이 멈춰 있는 문제 수정“게이트웨이 시작”문제: 프롬프트가 준비, 중지, 포트 점유 및 시작 시간 초과로 업데이트되고 새로 저장된 결과를 덮어쓰지 않습니다.。7 개 Node 수표 통과；Mac 독립 포트가 시작된 후 기본 창 확인 프롬프트가 자동으로 다음으로 변경됩니다.“게이트웨이가 작동 중입니다.”，페이지 전체에서 일관됨。
- 독립적인 `feature/desktop-ntfy` 나뭇가지; 공식 LAN 서비스는 실험적 테스트를 통해 대체되지 않았으며 그대로 유지됩니다. 8787 항만운영。
- macOS 현지의 70 개 Python 검사중 67 항목이 통과됨、3 개 Windows 단독검사 생략；3 개 Node 컨트롤러 검사 통과。
- 원래 구성 및 비밀번호 보존을 포함하는 새로운 검사가 추가되었습니다.、Token 인터페이스로 복귀 불가, 작동 중 네트워크 구성 잠금, 독립적인 매개변수 전송, 반복적인 시작 다중화, 알림 인증 및 CSRF、웹 페이지 액세스가 없을 때 계속 주의를 기울이십시오. 중복 제거 요청 및 중복 제거 재시작, 병합, 재시도 실패, 처리된 요청은 재시도되지 않음, 비동기식 질문 및 기본 HTTP 푸시 형식。
- 현실 Electron 독립형 테스트 디렉터리의 창/포트 완료: 게이트웨이 시작, 구성 저장, 네트워크 필드 잠금, 알림 페이지 전환, 게이트웨이 중지 및 창 스크린샷 확인. 렌더링된 페이지에 액세스할 수 없습니다. Node require。
- Mac arm64 `.app` 세워짐; 패키지에 Python 게이트웨이 실행 파일은 구성 읽기, 시작, 반복적인 시작 재사용, 알림 기능 식별 및 협업 중지를 완료하기 위해 소스 코드 디렉터리 외부의 독립적인 프로세스로 사용됩니다.。
- ntfy 기본적으로 꺼져 있습니다. 사용자가 수신기를 구성하지 않았습니다. 푸시 검증은 기본 가장만 사용합니다. HTTP 일반인이 이용할 수 없는 서비스 ntfy 주제는 실제 직업 정보를 보냅니다. 이를 근거로 주장할 수는 없다. iPhone/Android 잠금화면 실제 영수증 통과。
- Windows portable 및 Mac ZIP 빌드되어 업로드되었습니다. [Desktop prototype Actions](https://github.com/try2love/codex-mobile-bridge/actions/runs/36817237101)，해당 코드 제출 `de58b19`；[크로스 플랫폼 Python 조사하다](https://github.com/try2love/codex-mobile-bridge/actions/runs/36817236968)또한 통과。Windows 데스크탑 GUI 여전히 실제 기계 승인이 필요합니다.。
- 현재 App 실시되지 않음 Developer ID/Windows 인증서 서명 및 Mac 공증되어 실험용 빌드로 제공됩니다. 데스크톱 모델 인증, 원본 App 데이터베이스 및 실행 owner 수정되지 않음。
- 패키징 명령은 필요하지 않은 자동 게시를 명시적으로 끕니다. Release Token。긴 폴링 테스트는 요청 스레드가 정리를 완료하고 지연된 정리의 지정 반복이 통과될 때까지 기다립니다.；POSIX 호스트 이름을 방지하기 위해 네트워크 카드의 읽기 우선 열거 구성 DNS 차단, 회귀 테스트 포함。


## 프로그레시브 로딩 검증（2026-10-01）

- 기본 첫 번째 배치 20 기사 및 배경 보충 자료 100 술집; 위에서 10 사전 페치를 더 일찍 제거 100 조각. 항목 수별 페이지 및 약. 192 KiB 메시지 본문 예산 페이징, 로그 텍스트 기준 16000 세그먼트의 문자 읽기。
- 백엔드는 커서와 증분 프로젝션을 사용합니다. 원래 세션 상태와 실행 경로는 변경되지 않습니다. 컴퓨터의 첫 번째 콜드 판독은 여전히 ​​원본을 읽어야 합니다. rollout/데스크탑 스냅샷, 페이징은 휴대폰 전송 및 렌더링을 최적화하고 데스크탑 저장 형식을 변경하지 않습니다.。
- macOS：54 개 Python 테스트 중 51 항목이 통과됨，3 개 Windows 독점 테스트를 건너뛰었습니다. 새로운 검사에는 페이징 연속성, 메시지 추가, 스트리밍 적용 범위, 전체 텍스트 읽기 및 커서 무효화가 포함됩니다./세션 간 격리, 인증 및 현실적인 시뮬레이션 IPC 메타데이터。
- 브라우저：18 첫 번째 화면을 포함하여 프로그레시브 로딩 상호작용 검사를 통과했습니다./백그라운드 완료, 동시 중복 제거, 앵커 위로 스크롤, 기록을 읽을 때 새 메시지 프롬프트, 전환 취소, 이전 응답 삭제, 재시도 실패, 기록 종료 및 주문형 텍스트입니다. 기존의 12 개 Markdown、11 수식 확인이 계속 통과됩니다.。
- 390×844 브라우저는 긴 채팅과 공식 채팅을 측정했습니다. 수식 대화 표시 9 공식, 여기서 2 수식이 모든 곳에 표시되며 페이지가 가로로 넘치지 않습니다. 이 확인은 데스크톱 브라우저의 휴대폰 크기를 사용하며 실제 휴대폰 하드웨어 승인을 대체하지 않습니다.。
- 원래 LAN `http://10.21.229.139:8787/` 변경되지 않은 상태로 유지됩니다. 원래 계정 비밀번호 구성 해시는 변경되지 않았습니다. 다시 시작한 후 로그인 및 첫 번째 배치 확인 20 기사, 다시 읽어보세요 80 조항 및 고유성 새로운 프로세스 6 몇 초 안에 준비됨。
- 새로운 임시 HTTPS 포털은 실제 네트워크 요청으로 로그인, 페이지 매김, 연결 상태를 확인합니다. 웜 캐시 읽기：20 계약 3.2 KB / 0.55 초, 추가 80 조약 9.2 KB / 0.64 초; 콘텐츠 및 네트워크 변경이 결과에 영향을 미칠 수 있음。
- 이번에는 실제 작업 채팅으로 테스트 작업이 전송되지 않았거나 모델 또는 권한 부여 정책이 변경되었습니다.。Windows 프로그레시브 인터페이스 실제 기계와 실제 휴대폰 셀룰러 네트워크는 아직 검증되지 않았습니다. 보내다/승인은 기존 경로를 따르고 기존 경로를 전달합니다. IPC 반품。


검증환경：macOS、Python 3.9，데스크탑 내장 Codex 실행 시간 `0.158.0-alpha.2.1`。첫 번째 오픈소스 버전의 검증 범위는 다음과 같습니다. 다른 사람 App 버전을 다시 검증해야 합니다.。

이 파일에는 결과와 경계만 기록되며 실제 채팅 내용은 포함되지 않습니다. ID、개인 경로, 호스트 별칭, 계정 자격 증명 또는 채팅 스크린샷。

## 실제 환경 검증

| 조사하다 | 결과 |
| --- | --- |
| App 기본 세션 읽기 | 받다 owner 구독 후 스냅샷 및 실시간 patches |
| 대화로 보내기 | 비공개 테스트 채팅은 웹 메시지를 수신하고 예상 마크업을 반환합니다. |
| 사용자 정의 provider | 기존 사용 provider；모델명 인증을 휴대폰에 복사하지 마세요. |
| 휴대폰 질문 카드 | 답변이 성공적으로 입력되었습니다. App 채팅, 어시스턴트가 예상 결과를 반환함 |
| 모델 전환 | 테스트 채팅의 모델과 추론 강도를 일시적으로 변경합니다. 두 설정 모두 스냅샷으로 확인한 후 원래 값으로 복원됩니다. |
| Skill | 휴대폰 선택이 설치되었습니다 Skill，App 네이티브 수신 Skill 첨부 및 예상 결과 반환 |
| SSH 기록 및 실시간 동기화 | 기존 원격 채팅은 올바른 호스트, 작업 디렉터리 및 모델을 반환합니다.、provider 그리고 역사; 같은 owner 전체 기록 요청이 성공했습니다. |
| 현지의/SSH 폴더 | 해당 호스트의 모델과 설치된 모델을 각각 읽어보세요. Skill |
| 목록 상호작용 | 최근 상호작용 정렬, 프로젝트 집계, 확장/축소 및 호스트 태그는 브라우저에서 확인됩니다. |
| HTTPS 터널 | 채팅복귀 접속을 위해 로그인 없이 실제 공중망 진입 401；로그인 성공，Cookie 가져오다 Secure；SSH 스냅샷 및 긴 폴링은 올바른 결과를 반환합니다. |
| 휴대폰 크기 인터페이스 | 390×844 CSS 픽셀 단위로 채팅 및 모델 설정 확인、Skill 및 프로젝트 목록, 스크린샷은 수동으로 검토되었습니다. |

확인을 위해 수정된 실제 업무 채팅이 없습니다. provider、권한 정책 또는 원본 데이터베이스. 모델 Skill 쓰기 작업은 전용 테스트 채팅에서만 발생합니다.。

## 자동화된 테스트

Warehouse의 루트 디렉터리에서 실행：

```sh
python3 -B -m unittest discover -s tests -v
```

현재 다음을 포함합니다 **42 테스트**。합성 세션을 사용하고 네이티브를 시뮬레이션합니다. IPC 그리고 임시 원주민 HTTP 서비스는 실제 모델을 호출하지 않으며 사용자의 채팅을 읽지 않습니다.。Windows 실제 기본 명명된 파이프를 시뮬레이션된 데스크톱 서비스로 사용；macOS/Linux 사용 Unix socket。Windows 실행 가능 `python -B -m unittest discover -s tests -v`。

씌우다：

- 동일한 세션 라우팅、provider 중복 메시지의 상속, 중복 제거 및 알 수 없는 결과의 재생 방지。
- 증가 revision 불일치 복구, 기록 정규화 및 배열 patch。
- 대기열 철수 및 유휴 시간 예약。
- 명령 승인, 만료된 요청 거부, 사용자 문제 및 App 비동기식 질문 형식。
- 모델 설정、Skill 기본 입력 및 잘못된 경로 식별이 거부됩니다.。
- SSH hostId 프레임 버전, 모델 및 승인 대상, 호스트 간 스냅샷으로부터 격리됨。
- 프로젝트 소유권, 최근 상호 작용 정렬, 호스트 간 병합 페이징 및 연결할 수 없는 호스트 프롬프트。
- 로그인/로그아웃 또는 로그인하지 않음. 거부、CSRF、Host/Origin 확인, 명시적인 비밀번호 없음。
- HTTPS Cookie、긴 폴링 및 파일 경로 범위。
- 아무것도 제공하지 않습니다 RPC 또는 개인 구성 다운로드 인터페이스。
- 이전 버전/소스가 비어 있습니다. App 채팅, 하위 상담원 및 CLI 소스는 여전히 제외됩니다.。
- 질문의 자유로운 입력 `options: null` 표시되고 동일한 위치로 지시될 수 있습니다. owner 답장 제출。
- owner 응답이 지연되면 기록을 먼저 표시하고 반복되는 백그라운드 연결을 피하세요. 읽기 전용 시간 초과는 작업이 제출되었음을 선언하지 않습니다.。
- 아니요 UTF-8 리디렉션된 환경에서 중국어 도움말, 시작 로그 및 정상적인 중지；HTTP 역방향에 의존하지 않고 시작 DNS。

## 2026-09-30 문제 회귀

- 제어 App 세션 메타데이터는 오래된 소스 필터링으로 인해 채팅이 누락되었음을 확인합니다. 프로젝트에서 누락된 두 개의 채팅이 복원되어 표시되며, 소스가 비어 있는 오래된 데스크톱 기록도 호환성에 포함됩니다.。
- 실제 역사 속 자유입력문제를 답이 없는 상태로 복원, 재현 `NoneType` 순회 예외; 동일한 구조의 컴포지션 사용 IPC 카드 커버리지 수리 및 복구 경로。
- 언로드된 로컬/SSH 채팅은 원래 약속을 기다리고 있었습니다. 7 두번째/8.7 기록으로 돌아가는 데 몇 초가 걸립니다. 수리된 기계 HTTP 샘플에서는 두 개의 로컬 채팅 기록이 대략적으로 반환되었습니다. 0.01–0.16 몇 초, 또 하나 SSH 이야기하다 0.76 두번째. 이 데이터는 과거 가독성 시간을 측정한 것이며 콜드챗이 실시간으로 실행되었다는 의미는 아닙니다. owner，공용 네트워크나 기타 환경에서는 동일한 대기 시간이 보장되지 않습니다.。

## 검증 경계

### Markdown、공식 및 대규모 응답 수정（2026-10-01）

- macOS 지역 회귀：45 개 Python 테스트 중 42 항목이 통과됨，3 개 Windows 독점 테스트 건너뛰기。
- 브라우저 확인：12 개 Markdown 및 11 수식 검사가 통과되고 적용 범위 코드는 그대로 유지되어 위험합니다. HTML/TeX、좁은 화면에서 파일 링크, 스트리밍 조각, 표, 수식 스크롤。
- 390px 브라우저 테스트 실제 채팅: 마지막 답변에서 9 수식이 올바르게 표시되고 이 기기에서 제공하는 모든 글꼴이 성공적으로 로드됩니다.。
- 진짜 임시 HTTPS 입장 : 복원 전 약속 6 MB 채팅 응답이 잘렸습니다. 활성화됨 gzip 환승 후 약. 1.63 MB，이 전체 판독값은 대략입니다. 3.6 두번째. 이 결과는 다른 네트워크에 대해 동일한 지연 시간을 보장하지 않습니다.。
- 브라우저 샘플은 다음 위치에 있습니다. `tests/browser/markdown.browser.js` 및 `tests/browser/math.browser.js`，게이트웨이 페이지가 로드된 개발자 콘솔에서 실행할 수 있습니다. 이 프런트 엔드 검사는 연결되어 있지 않습니다 GitHub Actions。

### Windows 적응 검증（2026-09-30）

환경：Windows 10 build 19045、CPython/Anaconda 3.9.13、Codex App `26.928.1915.0`、데스크탑 내장 런타임 `0.159.0`。

실제 머신 읽기 전용 확인：

- 연결 `\\.\pipe\codex-ipc`，완전한 네이티브 `initialize` 악수。
- 원래 데스크톱 세션 데이터베이스를 읽고 통과합니다. owner 연결된 실제 세션의 스냅샷을 얻으려면 구독하세요.。
- 데스크탑 런타임을 자동으로 검색하고 모델 디렉토리를 읽고 설치합니다. Skill 폴더。
- 검증 Windows 스타트업 입구는 다음과 같습니다. `py` 통역사가 구성되지 않은 경우로 대체 PATH ～에 `python`。
- 독립적인 백그라운드 인스턴스 패스 HTTP 확인: 홈 페이지 200、로그인되지 않은 세션 인터페이스 401、계정과 비밀번호로 로그인 200、로그인하면 목록을 읽을 수 있고 원래 데스크톱 세션 스냅샷이 연결됩니다.。
- 공식 사용 `cloudflared 2026.9.3` Windows amd64 프로그램（SHA-256 출판 요약과 일치） `--lan --tunnel` 설립하다 HTTP/2 일시적인 HTTPS 입구. 공개 도메인 이름 확인 통과: 홈페이지 200、비밀번호 로그인 및 Secure Cookie、로그인되지 않은 세션 인터페이스 401、로그인 후 세션 목록, 원본 데스크톱 스냅샷, 긴 폴링 인터페이스 200。근거리 통신망 IP 인증 상태 인터페이스도 반환됩니다. 200。

이 기계의 완전한 테스트 결과：`Ran 40 tests`，`OK (skipped=1)`，지금 바로 39 항목이 통과됨、1 심볼릭 링크 권한이 누락되어 항목을 건너뛰었습니다. 또한 프런트 엔드를 통해 JavaScript 문법 확인 Git diff 백지 수표. 이 장치는 테스트 중에 한 번 나타났습니다. HTTP 연결이 중단되었습니다.（WinError 10053），개별 항목과 전체 재테스트를 모두 통과했지만 안정적으로 재현되지 않았습니다.。

자동 테스트 추가: 대형 Unicode IPC 프레임, 재연결, 차단 해제된 읽기, 엔드포인트 누락、Windows 가장 긴 접두사와 일치하는 경로 케이스, 원격 경로 케이스 분리、UTF-8 역사와 구성, 중국어로/공간 디렉터리, 실제 하위 프로세스 시작/로그인되지 않음 401/일반 중지, 이전 인스턴스 중지 토큰 거부, 일괄 입력 및 해석기 롤백。

Windows 현재 사용자가 심볼릭 링크를 생성하는 것이 허용되지 않으면 심볼릭 링크 이스케이프 테스트만 건너뜁니다. 디렉터리 외부의 일반 파일 거부 테스트는 계속 실행됩니다.。CI 구성된 Windows、macOS、Linux，～에 Windows/Linux 씌우다 Python 3.9 및 3.13；～ 위에 Windows 실제 기계 승인에는 다른 플랫폼이 포함되지 않습니다. 현재 CI 결과 보기 [GitHub Actions](https://github.com/try2love/codex-mobile-bridge/actions/workflows/tests.yml)。

실제 업무 채팅에 테스트 메시지를 보내거나 모델, 권한을 변경하지 않았습니다. 전송, 승인, 보충 및 대기열은 서비스 검증을 시뮬레이션하기 위해 명명된 파이프를 사용합니다.。Windows 현실 SSH 휴대폰 하드웨어/셀룰러 네트워크 액세스는 아직 테스트되지 않았습니다. 외부 네트워크 HTTPS 공개 도메인 이름에 로컬로 액세스하여 검사가 완료되며 모바일 네트워크 승인을 대체할 수 없습니다.。macOS 의 기존 확인 기록은 다음과 동일하지 않습니다. Windows 링크가 통과되었습니다。

### 다른 국경

- 현실 SSH 테스트 시작 작업이나 수동 승인에는 워크챗이 사용되지 않습니다. 해당 라우팅 및 승인 라우팅 사용 시뮬레이션 IPC 검증。
- 진정한 명령/파일/임시 권한 승인 변경 실패 auto-review 강제 트리거 전략; 시뮬레이션 통과는 모든 실제 승인 유형이 검증된 것과 동일시될 수 없습니다.。
- 보충 실행 및 대기열 예약을 위한 자동화된 테스트가 있습니다. 각 조합에 대해 실제 모델 요청이 추가되지 않았습니다.。
- 실제 전화 하드웨어, 셀룰러 네트워크, 공식 계정 로그인 및 모든 사용자 정의가 완벽하지는 않습니다. provider。
- 실제 테스트 환경의 프록시 경로는 일단 터널 도메인 이름을 닫았습니다. TLS 연결, 직접 연결 및 다른 호스트는 괜찮습니다. 네트워크 경로가 수신 도달 가능성에 영향을 미칠 수 있음。
- 클라우드 채팅은 아직 지원되지 않습니다.、SSH 파일 다운로드 및 일부 특별 요청. 콜드 채팅 기록을 읽으려면 데스크톱을 전환할 필요가 없습니다. 실제 작동 중에 원본을 읽을 수 있습니다. App 로드되었지만 원본 App 자체 구성 오류로 인해 여전히 복구가 불가능함。

## 2026-10-02：App 업데이트 기간（beta.5 게시하기 전에 확인하세요）

- Node：데스크탑 및 업데이터 합계 34 버전 순서 및 서명 변조를 포함하여 항목이 통과되었습니다./잘못된 키, 플랫폼 불일치, 손상/잘린 다운로드, 소스 제한, 중복 설치, 초안 필터링, 재시도 실패, 저장되지 않은 구성으로 인해 설치가 불가능함。
- Python：전액 133 개，129 통해、4 기존 환경 조건은 건너뜁니다. 새로운 업데이터가 추가되었습니다 10 아이템 재정의 압축 해제 경로/링크, 실제 디렉토리 교체, 상위 프로세스가 종료되지 않음, 게이트웨이 인스턴스 변경, 애플리케이션/게이트웨이 기동 실패 복구 및 정지 상태 유지。
- macOS arm64：실제 구축 ad-hoc 징후 App/ZIP。에서 `.tmp/update-smoke-*` 패키징하여 디렉터리를 격리합니다. App、복사된 기본 제공 런타임 및 임시 포트는 새 실행 파일을 훼손한 후 일반 설치 및 롤백을 수행합니다. 두 링크 모두 게이트웨이를 복원합니다.，`config.json`、`desktop.json`、`notifications.json`、`notification-watches.json` 바이트는 변경되지 않고 그대로 유지됩니다. 업데이트된 페이지에는 가로 오버플로가 없으며 스크린샷을 확인했습니다.。
- 통합 테스트 Release 네트워크 응답은 메모리 내 테스트 서명 목록을 사용합니다. 설치 패키지는 실제 빌드입니다. ZIP。실제 교체 여부를 확인하는 테스트/게시되거나 다운로드되지 않은 거래 다시 시작 GitHub 인터넷의 공식 새 버전은 원격 게시 링크가 활성화되었음을 의미하지 않습니다.。
- 릴리스 서명 스크립트는 로컬 보호 개인 키로 서명되었으며 App 두 플랫폼 매니페스트에 대한 내부 공개 키 확인 두 가지 워크플로우 YAML 구문 분석 가능. 개인 키가 제출되지 않았습니다. 암호화되어 출시 전 인증을 받아 창고로 저장됩니다. Actions Secret。
- Windows x64 및 macOS arm64 포장의 App 모두 합격 GitHub Actions 실제 업그레이드, 장애 롤백 및 구성 유지 테스트. 실제가 아닌 합성 게이트웨이 데이터를 사용하여 실행됩니다. Codex 채팅 메시지 보내기。

### 교차 플랫폼 게시 기준점

- [데스크탑 빌드 및 업그레이드 롤백 승인](https://github.com/try2love/codex-mobile-bridge/actions/runs/36906401249)：Mac 및 Windows 데스크톱을 포함하여 모두 통과됨 Node 서명 테스트 및 업데이트/테스트 다운로드、PyInstaller/Electron 포장된, 진짜 App 시작하다、HTTPS 신뢰 확인, QR 코드 확인, 업데이트 및 롤백。
- [Python 회귀 검사](https://github.com/try2love/codex-mobile-bridge/actions/runs/36906401361)：Windows/Linux Python 3.9 및 3.13、macOS Python 3.13 모두 합격。
- 출시 전 수정됨 Windows ZIP 경로 정규화는 테스트 차이를 유발하고 원래 경로를 거부합니다. ZIP 독자가 이름을 재정의합니다. 빌드 메타데이터에서 명시적으로 사용됨 UTF-8，피하다 Windows 기본 인코딩은 중국어를 읽습니다. package.json 실패하다。

### 게시됨 beta.5

- [서명 게시 작업 과정](https://github.com/try2love/codex-mobile-bridge/actions/runs/36907311316) 통과: 버전 및 서명 ID 확인, 두 플랫폼 재구축 및 승인 반복, 매니페스트 생성, 초안 업로드 및 게시。
- [v0.2.0-beta.5 Release](https://github.com/try2love/codex-mobile-bridge/releases/tag/v0.2.0-beta.5) 이는 다음을 포함하는 공개 시험판 버전입니다. macOS arm64 ZIP、Windows x64 Setup/ZIP、`bridge-update.json` 및 `SHA256SUMS.txt`。
- ～에서 Release 업데이트 매니페스트 및 확인 파일을 다운로드하세요. App 내장 공개키 서명 ​​검증에 성공했습니다. 서명 버전, 파일 이름, 길이 및 SHA-256，및 GitHub 업로드된 세 개의 설치 패키지에 대해 계산된 다이제스트 및 확인 파일은 일관됩니다. 이 수표는 다음을 사용합니다. GitHub 모든 대용량 파일을 로컬로 다시 다운로드하지 않고 자산 요약 최종 설치 패키지 시작 및 업그레이드/이 릴리스 워크플로에 의해 롤백 승인이 완료되었습니다.。

## 2026-10-02：웹페이지가 계획 및 목표 모드를 엽니다.

- Python 전액 198 개，194 통해、4 기존 환경 조건은 건너뜁니다. 새로운 모드 테스트가 추가되었습니다 16 항목이 원본을 덮어씁니다. owner/SSH 라우팅, 모델 및 추론 강도 상속, 대기열 모드, 계획 실행/수정, 만료된 요청 거부, 멱등성 재시도, 기본 대상 확인 및 확인되지 않은 상태. 대상 확인 기록이 유지된 후 데스크탑에서 완료된 대상을 지우면 보류 중인 이전 요청이 다시 표시되지 않습니다. 마지막 수정 후 다시 실행 16 아이템 모드 테스트 통과。
- Node 모드, 알림, 계정 입력 방향 테스트 14 항목이 통과되었습니다. 완전한 데스크탑 제품군 57 종 시앙 56 통과했습니다. 이 작업공간에는 QR 코드 테스트가 설치되지 않았습니다. `qrcode` 종속성으로 인해 실행할 수 없습니다. 패키지가 완전히 통과된 것으로 기록되지 않았습니다.。
- 브라우저 합성 상호작용 16 작업 모드 입력 매개변수를 포함하는 전달된 항목、SSH 호스트 라우팅, 실패 보존 초안, 재시도 플래그, 계획 실행/수정, 반복 클릭 및 중국어 및 영어 상태。390×844 뷰포트는 모드 항목, 일정 카드 및 대상 상태를 확인합니다. 이것은 전화 하드웨어나 셀룰러 네트워크 승인이 아닙니다.。
- 사용자의 명시적인 승인이 있는 경우, 사용자가 이미“Codex 모바일 네트워크 연결 조정”고정 태그 테스트를 위한 채팅. 기본 계획 모드가 완료되면 웹 페이지에 계획 카드가 표시됩니다. 다시 전환하려면 실행을 클릭하세요. `default`，대기 중인 카드를 지우고 답장하세요. `MOBILE_PLAN_MODE_OK`。
- 동일한 테스트 채팅의 웹 페이지에서 대상 모드를 선택한 후 기본 대상 상태 기록이 다음과 같이 확인됩니다. `complete`，objective 제출된 내용과 일치하여 회신 `MOBILE_GOAL_MODE_OK`。웹페이지 디스플레이“목표 달성”，Token 복용량 1213。테스트에서는 기본 대상 관리 도구만 허용되며 파일 작업이나 외부 액세스는 요청하지 않습니다.。
- 실제 테스트 환경은 macOS、Codex 데스크탑 26.928.31416（12553），원래 대화 유지 `gpt-6-sol` / `openai`。목표는 원본을 통해 기본 채팅 요청을 활성화하는 것입니다. `create_goal`，두 번째는 사용되지 않습니다. agent 또는 데스크톱 데이터를 직접 수정하세요. 도구를 사용할 수 없는 경우 확인되지 않은 것으로만 표시되며 메시지 전달은 성공적인 대상 시작으로 간주되지 않습니다.。
- 진정한 전송은 독립적인 사용을 사용합니다. loopback 미리보기 게이트웨이. 진실을 향하지 않고 SSH 워크챗은 공식 게이트웨이 구성, 설치 패키지 또는 릴리스 버전을 수정하지 않고 작업을 보냅니다. 대상 일시 중지, 재개 및 예산 관리를 위해 새로운 웹 페이지별 컨트롤이 추가되지 않습니다.。

### 로컬 설치 승인

- 그런 다음 사용자는 로컬 설치를 승인합니다. 이미 잠긴 빌드 종속성 버전을 재사용한 후 전체 데스크톱 Node 시험 57 위에서 언급한 모든 항목이 통과되었습니다. `qrcode` 누락이 해결되었습니다.。
- 재구축 macOS arm64 게이트웨이와 App，로컬 서명을 확인하고 원본으로 설치 `.local/apps/Codex Mobile Bridge.app`，이전 패키지는 커밋 무시 상태로 유지됩니다. `.tmp/modes/` 아래에. 공개적으로 게시되지 않음。
- 기존 8787 게이트웨이가 중지되고 새 설치 패키지에서 복원되었으며, 인스턴스 ID가 변경되었습니다. LAN 접속 성공, 새 버전 `index.html`、`app.js`、`modes.js`、`i18n.js`、`presentation.css` 의 HTTP 응답은 바이트 단위로 소스 코드와 일치하며 로그인하지 않은 경우에도 채팅 인터페이스가 계속 반환됩니다. 401。데스크톱 제어판이 시작되었습니다.。
- `config.json`、`desktop.json`、`notifications.json`、`notification-watches.json` 설치 전과 설치 후 SHA-256 일관된. 설치 과정에서 새 모델 테스트 메시지가 추가되지 않았습니다.。

## 2026-10-03：센드바 컴팩트 레이아웃

- 작업 모드 드롭다운 상자가 전송 방법과 전송 버튼 사이로 이동되고 독립 모드 행이 제거됩니다. 모드 설명은 호버 프롬프트 및 접근성 설명으로 유지됩니다.。
- 320/390 픽셀, 중국어 및 영어, 유휴/CCP를 실행 8 모든 레이아웃은 동일한 행을 유지하고 올바른 순서로 되어 있으며 가로 오버플로가 없습니다. 휴대폰 크기 스크린샷을 봤습니다. 모드 및 디스플레이 방향 테스트 8 항목이 통과됨。
- 다시 패키징하여 원래 위치에 설치 App，8787 게이트웨이가 작동을 재개합니다. 정적 리소스 응답의 새 버전은 소스 코드와 일치하며 4가지 구성 요약은 변경되지 않은 상태로 유지됩니다. 모델 테스트 메시지가 전송되거나 공개되지 않습니다.。

### 타겟바 숨김 및 긴 모델명

- 대상 표시줄은 숨김을 지원하며 다음에 의해 제어됩니다.“목표 진행”회복; 좁은 화면에는 대상 아이콘을 사용하십시오. 브라우저는 채팅, 호스트 및 특정 대상별로 현재 탭의 숨겨진 상태를 저장합니다. 새로 고침 및 상태 업데이트는 숨겨진 상태로 유지되며 기본적으로 새 대상이 표시됩니다. 숨기기 및 복원은 백엔드를 호출하거나 대상 상태를 변경하지 않습니다.。
- 모델 버튼은 이름과 추론 강도를 분리합니다. 긴 이름은 생략하고 추론 강도는 그대로 유지됩니다. 전체 텍스트를 보려면 마우스를 가져가세요. 원본 모델 설정 패널에 전체 모델이 추가됩니다. ID，줄 바꿈으로 읽을 수 있음。
- 풀 데스크탑 Node 시험 59 항목이 통과되고 브라우저가 상호 작용을 합성합니다. 22 항목이 통과됨。320/390/900 픽셀, 중국어 및 영어, 유휴/CCP를 실행 12 레이아웃 검사를 통과했습니다. 또한 실제 전체 페이지 새로 고침이 숨겨진 상태로 유지되고 새 대상이 기본적으로 표시되며 모델 패널이 그대로 유지되는지 확인했습니다. ID。대상 표시줄, 재개 버튼, 좁은 화면 길이 모형 및 전체 보기 ID 패널 스크린샷。
- macOS arm64 새 패키지는 서명 확인을 완료하고 원래 로컬 설치를 대체합니다. 8787 게이트웨이 및 데스크탑 패널이 복원되었습니다. 정적 리소스 응답은 소스 코드와 일치하며 로그인, 네트워크, 알림 및 구성 요약 따르기는 변경되지 않습니다. 새로운 실제 모델 요청이나 공개 릴리스가 없습니다.。

### 데스크탑 관리 세션 알림 모니터링

- 데스크탑“모바일 알림 → 이미 채팅을 팔로우하고 있습니다.”세션 제목, 장치, 디렉터리 및 ID，알림을 완료하고 모니터링을 삭제하기 위한 즉각적인 전환을 지원합니다. 새로운 입구는 여전히 휴대폰에서만 가능합니다. 실행 중인 수정 사항은 기존 비공개 기본 제어 채널을 통해 동일한 알림 관리자로 전달됩니다. 중지된 상태에서는 원격 채팅을 연결하거나 활성화하지 않고도 저장된 모니터링을 수정할 수 있습니다.。
- Python 알림, 데스크탑, 모니터링 관리, 페어링 및 인증 지향 테스트 58 참가 통과, 전체 데스크톱 Node 시험 64 항목이 통과되었습니다. 적용 범위는 호스트 지역에 따라 다릅니다. ID 세션, 새 모니터링을 추가할 수 없음, 오프라인 관리, 실시간 기준 완료, 실패한 재시도 취소, 삭제 및 검색 동시성, 만료된 새로 고침, 반복 클릭, 실패 롤백 및 데이터 디렉터리 전환。
- 독립 데이터 디렉토리에서는 True Electron 개인을 통한 창 IPC 선택한 장치에 대해서만 제목 읽기 확인, 배치 전환, 모니터링 및 세션 삭제 SQLite 파일은 변경되지 않고 저장되지 않은 초안 설정과 빈 목록 프롬프트가 그대로 유지됩니다. 중국어와 영어로 1100/820 픽셀 창에 가로 오버플로가 없으며 스크린샷을 확인했습니다. 실시간 채팅이나 모바일 푸시 테스트로 모델 요청이 전송되지 않습니다.。
- 구축 및 설치 macOS arm64 App，기존 패키지는 보관되어 있습니다. `.tmp/watch-management/`。새로운 패키지 8 데스크탑 소스 파일은 소스 코드와 일치합니다. 원본 8787 게이트웨이와 데스크탑 제어판이 백업되어 실행 중입니다. 로그인, 실행 및 알림 구성 요약은 변경되지 않습니다. 5 막대 모니터링을 위한 세션, 호스트 및 완료 알림 스위치는 변경되지 않습니다. 제목과 디렉토리는 정상적인 캐시 보충을 허용합니다. 근거리 통신망 `/api/auth` 액세스 가능, 로그인하지 않아도 세션 인터페이스가 계속 반환됩니다. 401。

### 다중 첨부 파일 업로드 및 세션 실행 ID

- 다중 선택, 제거, 실패 재시도 및 채팅 초안을 지원하는 웹 페이지 전송 방법의 왼쪽에 첨부 파일 항목이 추가되었습니다. 각 항목에는 최대값이 있습니다. 10 개인, 독신 20 MiB、총 100 MiB。일반 파일은 원래 경로와 함께 원래 세션으로 전달됩니다.，PNG/JPEG/GIF/WebP 네이티브로 이동 `localImage` 입력하다. 원격 액세서리는 기존을 사용합니다. SSH 별칭은 원격 개인 디렉터리에 속합니다. 원본 owner、호스트 및 모델 설정。
- 목록의 녹색 점은 실행 중임을 나타내고, 파란색 점은 정상적으로 완료되어 조회되지 않았음을 나타내며, 주황색 점은 실패했음을 나타냅니다./중지됨, 실행 중인 것으로 알려졌지만 회색 점으로 연결이 끊어졌습니다. 완료 표시를 지우려면 채팅을 엽니다. 새로 고침 및 유지, 첫 번째 기록은 일괄적으로 읽지 않은 것으로 표시되지 않습니다. 디스플레이 설정을 끌 수 있습니다. 검색된 세션 목록을 수동적으로만 구독하고 데스크탑을 자동으로 탐색하지 않으며 목록에 대한 전체 기록을 로드하지 않습니다. 연결된 세션과 콜드 세션을 모두 포함하여 채팅 진입 후 기록 로딩에서 구독 재시도 간격이 지연되는 문제를 수정했습니다.。
- Python 정위 103 참가 통과, 전체 데스크톱 Node 71 항목이 통과되었습니다. 바이너리 업로드 인증 재정의/CSRF、호스트별 파일 크기 및 경로 제약 조건/세션 격리, 동기화 ID 업로드 재시도、send/queue/steer、대상의 원본 텍스트는 유지되며, 전송 결과를 알 수 없는 경우, 상태 변경, 오프라인, 읽지 않은 기준선 및 채팅 진입 후 내역 로딩 시 재생이 발생하지 않습니다. 시뮬레이션을 이용한 원격 업로드 SSH 스크립트 및 경로 라우팅 확인。
- 원시를 통한 독립형 게이트웨이의 실제 브라우저 HTTP 두 개의 파일을 업로드하세요. 전송실패시 본문 및 첨부파일을 보관 후 동일하게 제출 ID 성공적으로 재시도한 후 초안을 삭제하세요. 시뮬레이션된 두 호스트의 초안이 격리되어 별도로 제거되고, 녹색 점이 파란색으로 바뀌고, 전체 페이지가 새로 고쳐지고, 스위치가 저장되고 채팅에 들어가 삭제되는지 확인하세요. 장애를 입히다 `crypto.randomUUID` 추후 업로드가 가능하며, 재사용은 정상적으로 지원됩니다. HTTP 페이지의 기존 `getRandomValues` UUID 성취하다（[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)）。
- 320/390/900 픽셀, 중국어 및 영어, 유휴/CCP를 실행 12 두 레이아웃 모두 가로 오버플로가 없고 하단 컨트롤이 중앙에 있으며 대상을 숨긴 후 복원 버튼을 포함합니다. 첨부파일 및 목록 상태를 확인했습니다.、320 Pixel English 실행 및 디스플레이 설정 스크린샷 임시 기록은 다음 위치에 있습니다. `.tmp/uploads-activity/`。
- 이번 라운드에서는 실제 모델 요청, 모바일 푸시 또는 실제 모델이 전송되지 않았습니다. SSH 파일 업로드; 기본 프로토콜은 다음에 의해 격리됩니다. IPC fixture 검증, 모델은 실제로 첨부 파일, 실제 휴대폰 파일 선택기를 읽고 Windows 실제 기계는 아직 사용자가 시험해 보기를 기다리고 있습니다. 업로드 사본은 게이트웨이에 남아 있습니다./원격 데이터 디렉터리는 현재 자동으로 정리되지 않습니다.。
- 제작, 서명 확인 및 설치 macOS arm64 현지의 App；이전 패키지는 다음 위치에 백업됩니다. `.tmp/uploads-activity/previous-app-20261003-015127.app`。원래 포트 8787 복구, 새로운 런타임 PID 37240、데스크탑 패널 PID 37257。8 웹 페이지 리소스는 소스 코드와 일치하며 로그인합니다./달리다/알림 구성 요약 및 5 막대 모니터링을 위한 호스트, 세션 및 완료 스위치는 변경되지 않습니다. LAN 인터페이스에 액세스할 수 있지만 세션 인터페이스는 여전히 401；도구가 반환된 후 프로세스와 인터페이스가 여전히 정상인지 독립적으로 확인합니다. 격리된 테스트 브라우저 및 미리보기 서비스는 종료되었으며 공개적으로 제출되거나 게시되지 않았습니다.。

### 공식 로그인 Fast 모델

- 모델 패널은 채팅이 위치한 호스트의 공식 로그인 및 모델을 기반으로 합니다. serviceTiers、작업 공간 제한 표시 Fast 스위치. 저장하기 전에 새로 고침하는 기능 제공된 모델을 사용하여 활성화 wire ID，명시적 전송 끄기 `default`。스위치가 작동되지 않으면 속도 필드가 생략되고 원래 속도 기어가 유지됩니다.。
- 원본으로 설정 owner 의 `thread-follower-update-thread-settings` 다음 설정을 작성하고 계정을 유지합니다、provider、작업 디렉토리 및 권한 웹 페이지 읽기는 사실입니다 `latestThreadSettings.serviceTier`，데스크탑 상태 변경사항을 수신합니다. 추가 모델 작업이나 전역 구성이 작성되지 않았습니다.。
- Python 방향 회귀 100 항목, 완전한 데스크탑 Node 시험 75 항목이 통과되었습니다. 로그인 및 서비스 제공자 제한, 모델 및 작업 공간 제한, 레거시 런타임 저하, 명시적인 표준 속도, 작동하지 않을 때 보존을 재정의합니다. Ultrafast、원격 라우팅、HTTP 유형 확인, 기본 거부 및 상태 확인。
- 머신이 실제로 실행 중일 때 읽기 전용 쿼리는 다음을 얻습니다. 8 모델과 Fast 능력; 현재 공식 로그인 가능，wire ID ～을 위한 `priority`。브라우저는 격리된 로컬을 사용합니다./원격 IPC fixture，확인 켜기 및 끄기, 전체 페이지 새로 고침 및 다시 읽기, 데스크톱에 대한 외부 변경 사항 동기화, 저장 실패 시 선택 항목 유지, 권한 취소, 원격 계정 격리, 작업 중 다음 설정, 반복 제출 및 채팅 경쟁 상태 전환。
- 320/390/900 픽셀 중국어 및 영어 6 이 레이아웃에는 가로 오버플로가 없습니다. 본 390 픽셀 중국어와 320 중국어와 영어로 된 픽셀 스크린샷. 테스트 증거는 다음 위치에 있습니다. `.tmp/fast-mode/`。
- 변함없는 리얼채팅 Fast 설정, 실제 유료 모델 작업이 실행되지 않습니다. 실제 속도 및 할당량 소비, 실제 SSH Fast 요청하고 Windows 실제 머신이 확인되지 않음。
- macOS arm64 로컬 패키지 빌드 및 서명 확인이 통과되어 제자리에 설치되었습니다. 오래된 패키지가 백업되었습니다. `.tmp/fast-mode/previous-app-20261003-021529.app`。기존 8787 게이트웨이 PID 57374、패널 PID 57404，LAN 접속 가능；9 웹페이지 리소스 및 원격 주입용 catalog.py 소스 코드와 일치합니다. 구성 요약、5 모니터링은 유지되며 로그인하지 않은 경우 세션 인터페이스가 반환됩니다. 401；도구가 반환된 후 독립적인 생존 확인이 통과됩니다. 격리 브라우저 및 미리 보기는 닫혀 있으며 공개적으로 커밋되거나 게시되지 않습니다.。


## PR #8 현지 개정 승인（2026-10-04，널리 알려지지 않은）

- 격리 fixture 두 번의 연속 일시 정지를 커버합니다./복구, 동일한 이름으로 재구성한 후 종료, 알 수 없는 쓰기가 재생되지 않음、sent 다시 시작 및 재개, 대기열 시작 일시 중지 및 취소, 기본 읽기 실패는 전달되지 않음, 일시 중지 유지 및 수정 후 예산 유지, 오래된 웹 페이지 작업 거부 및 언어 전환 재시도。
- 첨부 파일에는 순수 데스크톱 이미지 미리보기 로고가 포함되어 있습니다./읽을 때 경로 제거 및 업로드 디렉토리 심볼릭 링크 거부가 이스케이프됩니다.。
- 현재 설치된 데스크탑 Codex 독립 실행형을 사용하는 런타임 CODEX_HOME 검증 get/set/clear、개정하다 objective、현황 및 예산 모델이 전송되지 않았습니다 turn，기존 채팅이 운영되지 않습니다。
- 실제 데스크탑 owner 지속적인 실행, 모바일 운영、provider/승인 귀속 및 크로스 플랫폼 설치 승인에는 여전히 수동 확인이 필요합니다. 절연 테스트는 완전한 실제 기계 승인과 동일시될 수 없습니다. 이 개정판은 로컬에서만 테스트되었으며 푸시되거나 게시되지 않았습니다.。

이번 검증：Python 풀 세트 375 통과된 항목（포함 4 아이템 플랫폼 조건은 생략됨）, 마지막으로 추가된 항목 Goal/HTTP/RPC 정위 21 항목이 통과되었습니다. 데스크탑/프런트 엔드 124 항목이 통과되었습니다. 합성된 웹페이지에서는 휴대폰 크기에 맞춰 일시정지, 편집저장, 연속 재개, 종료를 확인하였습니다.。macOS arm64 일시적인 App 내장된 서명 무결성, 웹 페이지 소스 코드 일관성 및 패키지 내 독립 디렉터리 snapshot 확인됨; 창 자동 읽기 시간 초과, 수락을 위해 실제 채팅 연결이 사용자에게 제출됩니다.。


### PR8 사용자 수용 피드백 최적화（2026-10-04，현지 승인 보류 중）

- 전체 Python 반품 383 개，379 통해、4 항목 플랫폼에 따라 건너뛰었습니다. 나중에 추가된 콜드 세션 Goal 테스트 일시중지，13 개 Goal 수명주기 회귀가 통과되었습니다. 빠르게 기록을 저장하세요 owner 스냅샷 동시 2 항목 회귀 통과。Node 데스크탑/웹페이지 테스트 127 실행버튼으로 무시할 수 없는 계획댓글, 최근정렬, 독립공지선택 등 합격항목。
- 합성 2,000 라운드 로빈 40.5 MB 의 rollout：전체 읽기 및 timeline 투영 약. 128 ms；최근에 20 라운드 로빈 4.6 ms，캐시는 대략 읽습니다. 0.9 ms。주입 500 ms 역사가 기다립니다 Goal 서스펜션 장치, 약. 512 ms 아래로 0.6 ms，그리고 네이티브 상태가 확인되어 통과됩니다. 이 결과는 실제 네트워크를 나타내지 않습니다.、SSH 또는 기존 채팅의 엔드투엔드 대기 시간。
- ego-browser 에서 390×844 실제 웹 리소스 확인 및 격리 HTTP/가짜 데스크탑 IPC：v1.3 홈 페이지 그룹화 및 보관 확인란; 세 가지 전송 방법과 세 가지 작업 모드; 홈 페이지 바로가기 항목은 숨겨진 후에도 설정에서 열 수 있습니다. 전역 및 단일 세션 알림이 저장됩니다. 계획 주석은 실행 버튼을 비활성화하고 수정 버튼을 강조 표시한 다음 수정된 경로에 따라 보냅니다. 오래된 대화는 즉시 최근 목록의 맨 위에 표시됩니다. 수평 오버플로가 없는 휴대폰 스크린샷。
- 임시 테스트 App 대신에 18788 게이트웨이가 중지되었습니다. 공식적인 8787 게이트웨이는 계속 작동합니다. 새로운 arm64 임시 패키지는 다음 승인 단계에만 사용되며 정식 설치를 위해 푸시, 병합 또는 교체되지 않습니다.。
- 실제 모델 세션이나 다른 작업으로 전송된 작업이 없습니다. PushPlus/Bark/ntfy 알림을 보냅니다. 현실 Goal 일정연동, 진짜 옛날 대화경험, 원격 SSH 휴대폰 알림이 포함된 실제 영수증은 아직 사용자 승인을 기다리고 있습니다.。


## Local connection setup preview — 2026-10-05

Local implementation based on v1.3.3, not published. New configurations enable address notifications; saved opt-outs remain unchanged. Desktop builds include a locked, SHA-256-verified cloudflared binary for each target architecture. New profiles support SSH host/user/port, password/private-key/agent authentication, host-key confirmation, Ubuntu/Debian Caddy deployment, and remotely managed Cloudflare tunnels. Existing OpenSSH aliases remain supported.

Validation:
- Python suite: 417 tests run, 4 skipped; later affected-path regression: 54 tests passed.
- Desktop suite: 131 tests passed.
- Loopback Paramiko server: unknown-host rejection before password authentication, explicit trust, changed-key rejection before authentication, encrypted private-key authentication, actual bytes over loopback reverse forwarding, and shutdown.
- Native-vault adapter: isolated mock checks for credential separation, errors without plaintext fallback, and secrets excluded from ordinary configuration. The user's real system credential store was not modified.
- Named-tunnel runner: token absent from command arguments/status files, passed only in the child environment; provider output is not persisted. No real Cloudflare account or tunnel was used.
- Real source and packaged Electron windows: clean-data defaults, bundled executable/version detection, SSH fields, fixed-domain form, Chinese/English rendering, private IPC, and isolated gateway start/stop. Screenshots inspected under `.tmp/`.
- Final affected-path checks after export/vault adjustments: 41 Python tests and 44 desktop tests passed. Packaged Paramiko/cryptography completed an actual loopback SSH host-key exchange before authentication.
- Apple Silicon package: native executable architecture, deep ad-hoc signature integrity, cloudflared execution, bundled HTTPS roots and rejection of untrusted certificates. No notarization claim.

One-click deployment is implemented, with shell syntax checking and local tests of configuration guards/result semantics. It has not been exercised against a real Ubuntu/Debian server or a live DNS/certificate authority deployment. Windows, Linux and Intel Mac build paths were updated but not executed in this local run. End-to-end phone access, OS credential-store permission prompts and actual fixed Cloudflare reconnection require user-environment validation. No GitHub push, release or existing-install replacement was performed.

## Local preview feedback fixes — 2026-10-06

- Reproduced the reported SSH-password error with an enabled Cloudflare profile whose default `sshAuth` was `password`. Startup now checks SSH passwords only for server profiles. Regressions cover Cloudflare alone, disabled/deleted SSH profiles, and saved-password SSH preflight followed by mixed-profile startup.
- Validation returns a field and connection ID over private IPC. The renderer switches tabs, opens enclosing details, scrolls and focuses the exact field. Short-lived results use a dismissible fixed toast with a 10-second progress bar; gateway status stays persistent. SSH preflight results remain in the relevant card alongside current tunnel status.
- Saved connection and notification credentials remain masked, with a reveal button. They are read through an authorized private IPC call, excluded from ordinary snapshots, and unchanged displayed secrets are not resubmitted to a new notification destination. Session-only credentials survive renderer reload and clear actions empty the fields. New gateway login passwords remain in the current renderer session; legacy one-way password hashes cannot be recovered after restart. The existing initial-login file remains readable when present.
- SSH key selection requests `showHiddenFiles` and defaults to the user's `.ssh` directory, per current Electron documentation. The native dialog options were verified through the real IPC handler with a stubbed dialog; no personal private key was read.
- Verification: 57 affected Python tests passed; 131 desktop tests passed; real source Electron workflow verified focus, progress duration, manual dismissal, expiry, masked/revealed credential retention, renderer reload, clear actions and Cloudflare-only launch. Loopback SSH authentication used a synthetic password with a mocked native vault and preflight command output; no real server configuration was changed.
- The rebuilt macOS arm64 preview passed actual packaged UI/IPC validation, retained-token and Cloudflare-only start/stop tests, bundled cloudflared version checks, architecture/signature checks and HTTPS trust checks. A no-op local connector was used for enabled-tunnel launch tests; these are not evidence of live Cloudflare connectivity.
- Final DMG: 165,393,840 bytes. Local artifact: `dist/local-preview/Codex-Mobile-Bridge-1.3.3-macOS-arm64.dmg`. No GitHub push, publication, installation replacement, DNS change or real native-vault write. Real Cloudflare/phone access and remote deployment remain unverified.

## Fixed-domain onboarding and runtime settings — 2026-10-06 (local)

- The user confirmed their Cloudflare fixed tunnel is now accessible. This is user-reported live acceptance of that route, not a new end-to-end network test performed in this change.
- Added a complete domain-to-phone guide in `docs/fixed-domain.md`, a six-step expandable App guide and a bilingual product-site Cloudflare route. The instructions cover registrar nameservers, Active status, the connector token, the local HTTP route, DNS creation and separate desktop/mobile-data verification.
- Clarified that ordinary SSH users can maintain a high-port loopback reverse tunnel; root/sudo is required only for the existing system-level HTTPS installation. No changes were made to existing servers, SSH accounts, DNS or active tunnels.
- Runtime settings now lead with startup/data controls and the bundled Cloudflare status. Custom paths, IPC overrides and installer/repair actions remain available in collapsed advanced sections. Removed the fixed-entry label that incorrectly implied every fixed domain needs server deployment.
- Validation: 44 existing desktop tests passed; real Electron UI with an isolated data directory checked collapsed/reachable repair controls, six guide steps and English translations. Chinese runtime/guide screenshots inspected. The local product page was checked in ego-browser: the new route switches correctly, all six steps render, English translation is complete, and there is no horizontal overflow at the tested desktop viewport. No real token or remote server was used for these UI checks.
- Built a separate macOS arm64 preview at `dist/domain-guide-preview/mac-arm64/Codex Mobile Bridge Preview.app`. Ad-hoc signature verification passed; packaged UI files match the updated source. An isolated packaged launch verified the guide, collapsed advanced controls and bundled cloudflared 2026.9.3 execution without starting a gateway. No GitHub push or website publication was performed.

## Local SSH setup with manual administrator steps (2026-10-06)

- Replaced automatic server installation with three stages: manual server preparation, SSH sign-in check, and connection plus fixed-entry verification. Removed sudo controls and the remote installation implementation; both desktop IPC and backend reject the former deployment action before opening an SSH connection.
- SSH inspection authenticates and resolves DNS locally without executing remote commands. Successful sign-in explicitly leaves forwarding permissions and HTTPS access unverified. Existing saved SSH settings remain usable; obsolete per-connection sudo settings are discarded when saved.
- Added `docs/server-ssh.md` and updated the App, product page, READMEs, and generated references. Server setup copy instructs the user to perform administrative commands manually; it no longer requests automated Agent deployment. Public examples use `try2love` and the explicitly illustrative domain.
- Validation: 47 Python tests passed for connection setup, desktop settings and fixed entries; 44 desktop Node tests passed. Isolated loopback SSH tests exercised authentication and real byte forwarding. Tests cover removed-action rejection, sign-in without remote commands, configuration migration and manual export instructions.
- Rebuilt the local macOS arm64 preview, verified its signature and packaged UI/source consistency, and launched it with isolated temporary data. Verified Chinese/English setup steps, absence of sudo/deploy controls, rejection by both packaged IPC and backend, and manual export text. Inspected the Chinese screenshot. No real server or public HTTPS deployment was tested in this change; the test App did not start a gateway.
- No GitHub push or publication was performed.

## Local login security and setup usability (2026-10-06)

- Web sign-in now defaults to a seven-day remembered login using an HttpOnly cookie, without storing the plaintext password. Unchecking it uses a browser-session cookie; the existing standard server lifetime and QR lifetime remain available. Remembered expiry is absolute and does not slide on refresh.
- Five consecutive failed passwords from the same canonical client IP cause a durable automatic block and revoke that IP's sessions. Counts survive restart; successful sign-in resets the count. Concurrent requests cannot hash more than five guesses before blocking. The web UI shows remaining attempts and blocked state; only private desktop device management can unblock/reset. Existing trusted-proxy address handling is retained and tested against direct header spoofing.
- Security alerts use the existing enabled phone channels, with a default-on independent switch, delivery deduplication and retry. Notification tests use mocked senders; no real phone notification was sent during this verification.
- Reproduced a saved disabled SSH profile's check button remaining disabled, with no pending edits or busy operation. Removed the enablement requirement for inspection in both renderer and backend, while keeping connection startup disabled. Added a clipboard-only, read-only server inspection prompt, including current non-secret settings and explicit no-sudo/no-mutation instructions.
- Fixed the missing exact PushPlus English translation and changed dismissible desktop feedback/progress to five seconds. Added the product-page Cloudflare walkthrough link and local deep-link handling; the online site remains unpublished.
- Tests: 97 targeted Python tests plus 29 existing HTTP/pairing regressions passed; 44 desktop Node tests passed. Real isolated desktop UI checks covered disabled-profile inspection, prompt copying (mocked clipboard), English PushPlus text, dismiss/expiry timing and the website target (mocked external opening).
- Real isolated mobile-page and desktop-window checks passed for remaining counts, blocked reload, desktop unblock, seven-day cookie, restart persistence, unchecked session cookie and narrow-screen overflow. Repeated against the packaged gateway runtime. Screenshots inspected for the blocked phone view and desktop unblock controls. No real Codex chat, remote server, DNS setting or production gateway was changed.
- Updated the local macOS arm64 preview; no commit, push, Release or website publication.


## Local v2 preview integration of PRs #15 and #16 — 2026-10-07

- Base: `29bb1c5` (`2.0.0-preview.1`), local branch `local/pr15-16-preview`. No version bump, commit, push, remote merge or publication.
- PR #15 by `qybgh`, source `f1e9aa298e18c3a63f7791e3b99f657ed66f7390`: adapted controller handoff and packaged UI regression. Only a matching helper-ready token permits immediate `app.exit(0)`; a pending snapshot no longer blocks exit. The unconditional two-second exit was omitted. Missing/malformed/wrong-token readiness, slow readiness and helper failures have controller tests. The packaged test increments preview versions correctly, uses project-local temporary files, and defaults to a local gateway; real Quick Tunnel testing is opt-in with `--quick-tunnel`.
- PR #16 by `702165405`, model discovery contribution from `5154bd2`: adopted `models/slug` responses and hidden-model filtering while preserving OpenAI `data/id` and array responses. Both formats produce the same public catalog. Web, Android and iOS share that gateway/catalog and web interface, so no native UI, mobile package, credential store, update source or notification behavior was changed.
- The independent Compose client and its background session polling were not imported. APK self-installation and credential storage changes remain deferred because they require a separate cross-platform design and device acceptance. This is selective local integration, not a claim that all of PR #16 is merged. Preserve the upstream author attribution when creating the eventual commits/PR.
- Before fixing, controller regressions reproduced stalled-snapshot and non-immediate-exit behavior; upstream `models/slug` tests failed. After fixing: updater suite 24 passed, one Windows-only skip; catalog suite 21 passed; native effective-config/loopback model discovery passed for both upstream formats without real credentials or inference.
- Real packaged macOS arm64 UI update handoff passed with the gateway stopped and with the local gateway running: install button -> helper ready -> old controller self-exit -> bundle replacement -> new version acknowledgement; gateway running state was restored. Synthetic candidate version: `2.0.0-preview.2`. No real Cloudflare tunnel was started.
- Java and Swift URL tests each passed 28 checks; both native release-selection suites passed. Shared UI/clipboard checks: 55 passed, one existing text-equality failure caused by clipboard-script indentation. Its test and both native sources are byte-identical to the base commit; all seven clipboard behavior checks passed. Android/iOS real-device interaction and Windows packaged handoff were not run locally.
- Manual-test package: `dist/pr15-16-preview/mac-arm64/Codex Mobile Bridge PR Preview.app`, with separate bundle identity and project-local data under `.tmp/pr15-16-integration/user-data`. Existing phone apps can connect to this gateway without reinstalling. Detailed build/test logs and selective-integration artifacts remain under `.tmp/pr15-16-integration/` and are not committed.
- Final manual-test bundle passed ad-hoc signature verification and packaged controller/model-parser source matching. The separate App was launched, its gateway reported running on port 8793, and the local health endpoint returned HTTP 200. Existing Android/iOS apps were not reinstalled; manual device acceptance remains pending.

## v2.0.0-preview.2 release preparation — 2026-10-07

- User accepted the targeted automated verification in place of manual regression and authorized publication. The integration commits credit qybgh and 702165405 with GitHub-linked co-author trailers; the release notes link both contributors and describe the partial scope of PR #16.
- Desktop, Android and iOS release identifiers are synchronized to 2.0.0-preview.2; Android and iOS build numbers advance from 20 to 21. Native client behavior is unchanged.
- Post-bump updater and native release-selection tests passed. Android APK signature verification and unsigned iOS Release compilation passed; final multi-platform builds and publication use the existing signed release workflow.
