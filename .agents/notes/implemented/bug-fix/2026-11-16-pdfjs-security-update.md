# PDF.js 6.5.438 적용

## 배포본

저장소에 포함된 PDF.js 5.6.205를 공식 `pdfjs-dist@6.5.438` 배포본으로 교체했다. 기존 legacy 빌드 대신 일반 브라우저 빌드를 사용한다. 오래된 브라우저 지원은 이번 변경의 요구사항에 포함되지 않는다.

- [공식 릴리스](https://github.com/mozilla/pdf.js/releases/tag/v6.5.438)
- [공식 보안 공지: 수정 버전 6.2.108](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)
- 배포 파일: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.5.438.tgz`
- npm integrity: `sha512-vg8Pw1x+AFKy4AMDvhuWl5cOYV8d698UoEANoFFhc79hqXDnZQqnOXoxw3HG907WHOg1JYOvLhP756boddFxpA==`

본체·worker·CMap·기본 글꼴·라이선스를 같은 배포본에서 가져왔다. SHA-512로 압축 파일을 확인했고 공급자 파일은 원본 바이트를 유지한다. 샌드박스와 전체 viewer는 추가하지 않는다.

두 로드 URL의 버전 태그를 함께 갱신했다. 공개 경로는 유지하며 서버가 각 파일 내용에 맞는 캐시 해시를 붙인다.

## 검증

2026-11-16 공식 npm advisory bulk API에 `{"pdfjs-dist":["6.5.438"]}`를 조회한 결과 해당 버전의 알려진 취약점은 0건이었다. 이 결과는 조회 시점의 공개 보안 데이터에 한정한다.

PDF 미리보기의 기존 동작 검사 20개가 통과했다. 새 브라우저 회귀 검사는 실제 배포 리소스로 합성 PDF를 열어 worker 생성, 선택 가능한 텍스트, 캔버스 픽셀, 종료 후 정리를 확인한다. 로컬 Chrome의 1280px·390px 화면에서 두 검사가 통과했다.

이번 작업에서 WebKit과 실제 휴대폰 WebView는 실행하지 않았다.
