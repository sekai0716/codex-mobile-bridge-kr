# 데스크탑 게이트웨이 인터페이스

`main.cjs`、`preload.cjs` 및 `index.html` 그대로 남아 Electron 입구. 기본 프로세스는 기본 창을 관리하고 IPC，사전 로드 스크립트는 기존 격리 경계를 유지합니다. 페이지 스크립트 통과 `window.bridgeDesktop` 콜 게이트웨이。

| 폴더 | 책임과 입장 |
| --- | --- |
| `shell/` | `renderer.js` 바인딩 설정 및 상태，`layout.js` 조직 페이지 모듈; 스타일과 트레이 동작은 동일한 애플리케이션 셸에 속합니다.。 |
| `features/accounts/` | 미리보기 환경에서 기존 계정을 가져옵니다. 계정 인터페이스 재사용 `web/features/accounts/`。 |
| `features/clients/` | 기본 클라이언트 검색, 액세스 설정 및 Harness 공식적인 Web 입구。 |
| `features/connections/` | 네트워크 인터페이스, 액세스 포털、Cloudflare、공유 릴레이 및 휴대폰 페어링。 |
| `features/notifications/` | 세션 알림 구독 관리。 |
| `features/updates/` | 업데이트를 다운로드, 확인 및 설치합니다. 신뢰할 수 있는 공개 키는 업데이트 프로그램을 통해 유지됩니다.。 |
| `shared/` | Python 컨트롤러 통신, 언어 동기화, 기본 번역 및 민감한 현장 구성 요소。 |
| `assets/` | 데스크탑 아이콘。 |

`index.html` 상대 파일 경로를 사용하고 직접 참조 Web 번역 및 계정 모듈. 공유 리소스를 추가할 때 루트도 확인하세요. `package.json` 의 `build.files`；이동하다 CommonJS 모듈, 업데이트 `main.cjs` 참고 자료 및 해당 테스트 픽스처。

`npm run test:desktop` 자동 검색 `tests/` 및 `mobile/tests/` 모두 다운로드 Node 테스트, 확인 페이지, 컨트롤러 및 리소스 참조；`npm run test:updater` 업데이트 프로그램과 프로세스 핸드오프를 독립적으로 확인할 수 있습니다. 플랫폼 구축 방법 보기 `docs/linux.md` 루트로 문서 작성。
