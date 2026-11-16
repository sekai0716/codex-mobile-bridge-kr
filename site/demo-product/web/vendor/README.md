# markdown-it

- 고정 버전：15.0.2（MIT，보다 `markdown-it.LICENSE`）
- 상류：https://github.com/markdown-it/markdown-it
- 배포 패키지：https://registry.npmjs.org/markdown-it/-/markdown-it-15.0.2.tgz
- 파일：`dist/browser/markdown-it.umd.min.js`，그대로 저장 `markdown-it.min.js`
- SHA-256：`635972b985228e8af9f0143647c68616b7a3bb09f6946e7e4a52e43dcf5e7be5`

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
