# markdown-it

- 고정 버전：15.0.3（MIT，보다 `markdown-it.LICENSE`）
- 상류：https://github.com/markdown-it/markdown-it
- 배포 패키지：https://registry.npmjs.org/markdown-it/-/markdown-it-15.0.3.tgz
- 파일：`dist/browser/markdown-it.umd.min.js`，그대로 저장 `markdown-it.min.js`
- SHA-256：`758061fd114ea825a7864ad8a4aeffa4ab97233b1ff9924f51e9bb635c0776f2`
- 원본 배포본 SHA-256: `391f2aa638e75e6c7859d0a5c5650ef0956722a45998f17e05b83bc655778e1e`. 파일 끝에 개행 1개를 추가했으며 나머지 바이트는 원본과 같습니다.

브라우저는 게이트웨이에서 기본적으로 로드되므로 필요하지 않습니다. CDN 또는 프런트엔드 빌드 단계. 업그레이드 시 버전, 라이선스, 검증값을 동시에 업데이트하고 실행하세요. `tests/browser/markdown.browser.js` 브라우저 확인。

## KaTeX

- 고정 버전：0.18.9（MIT，보다 `katex/LICENSE`）
- 상류：https://github.com/KaTeX/KaTeX
- 배포 패키지：https://registry.npmjs.org/katex/-/katex-0.18.9.tgz
- 패키지 무결성：`sha512-8ad9RyoKsb/g8/yLFE+KAlP+DhbCTRUNi/V9XGsxn0R+trJJltNwzcDNo0q/DEkOy5fQUQTAQyCXCYSE+OakTQ==`
- `katex/katex.min.js` SHA-256：`155f6c2d673c5912e3b48f45d8830eaad18ae1953915939ceb648ea8b9c3e7e2`

## markdown-it-texmath

- 고정 버전：1.0.0（MIT，보다 `texmath.LICENSE`）
- 상류：https://github.com/goessner/markdown-it-texmath
- 배포 패키지：https://registry.npmjs.org/markdown-it-texmath/-/markdown-it-texmath-1.0.0.tgz
- 패키지 무결성：`sha512-4hhkiX8/gus+6e53PLCUmUrsa6ZWGgJW2XCW6O0ASvZUiezIK900ZicinTDtG3kAO2kon7oUA/ReWmpW2FByxg==`
- `texmath.js` SHA-256：`926e075a1745e1019813b8418b90183feea0c7b3782c85dceb4f246da999edc6`

KaTeX 스크립트, 스타일 및 글꼴은 그대로 저장됩니다. `katex/`；texmath 그대로 저장 `texmath.js`。모든 리소스는 기본 게이트웨이에서 제공되며 런타임 시 액세스되지 않습니다. CDN。수식 업그레이드 후 실행 `tests/browser/math.browser.js`，코드 격리, 위험 확인 TeX、스트리밍 입력 및 좁은 화면 수식 스크롤。

## PrismJS

- 고정 버전：1.30.0（MIT，보다 `prism/LICENSE`）。
- 파일：`prism/source-view.min.js`，포함하다 core、markup、CSS、C-like、JavaScript、Python、TypeScript、JSX、TSX、JSON、YAML、TOML、Bash、PowerShell、Batch。
- 소스 코드 판독기에서만 단어 요소 인터페이스를 호출하고 자동 전체 페이지 강조 표시가 활성화되지 않습니다. 언어를 알 수 없거나 강조표시 예산이 초과된 경우 원본 텍스트가 표시됩니다. 세부정보 보기[소스 코드 규칙](../../.agents/notes/implemented/feature/2026-10-13-source-code-view.md)。

## PDF.js

- 고정 버전：5.6.205（Apache-2.0，보다 `pdfjs/LICENSE`）。
- 파일：legacy `pdfjs/pdf.min.mjs`、동일한 버전 `pdfjs/pdf.worker.min.mjs`、`pdfjs/cmaps/` 및 `pdfjs/standard_fonts/`。
- CMap 표준 글꼴과 별도로 라이센스를 디렉토리에 보관하십시오. 모든 리소스는 게이트웨이와 함께 배포되며 사용되지 않습니다. CDN。모듈 worker 동시에 업데이트되어야 하며 중국어, 스캔 페이지, 혼합 페이지 크기, 텍스트 선택 및 휴대폰을 확인해야 합니다. WebView 호환성. 세부정보 보기[PDF/HTML 합의](../../.agents/notes/implemented/feature/2026-10-13-pdf-html-preview-and-source-mode.md)。
