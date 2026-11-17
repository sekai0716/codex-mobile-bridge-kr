# 원본 압축 출처와 완료 상태 표시

## 원인과 기준

설치된 공식 데스크톱 앱 26.1111.21308은 `contextCompaction` 항목의 `source`와 불리언 `completed`로 수동·자동 압축과 완료를 구분한다.
진행 이벤트에는 `completed: false`, 완료 이벤트에는 `completed: true`를 저장하며 출처는 `manual` 또는 `automatic`이다.
Bridge는 이 값을 타임라인 메타데이터에 전달하지 않고 별도 `autoContextCompaction` 종류와 `status`, turn 완료 상태로 표시하여 실제 항목의 출처·완료를 반영하지 못했다.

## 변경

압축 항목의 허용된 `source`와 불리언 `completed`를 정규화 모델과 타임라인 행으로 전달한다.
값만 바뀌어도 행 버전을 갱신한다. `false`와 누락된 값을 구분하고 문자열·숫자를 완료로 변환하지 않는다.
기존 상세 본문은 유지한다.

- `source: automatic`, `completed: false`: `컨텍스트 자동 압축 중`
- `source: manual`, `completed: false`: `컨텍스트 압축 중`
- `completed: true`: 출처에 관계없이 `컨텍스트 압축됨`

진행 중인 turn에서도 완료 플래그가 참이면 압축 완료로 표시하며, turn이 완료되어도 플래그가 거짓이면 압축 완료로 추정하지 않는다.
명시적인 압축 실패·중단 상태는 보존한다. 메타데이터가 없는 이전 기록에는 기존 종류·상태 기반 처리를 사용한다.
한국어 문구를 수정하고 영어·중국어 언어팩은 유지한다.
원본 앱이나 세션의 owner/provider/auth/cwd, 전송·승인·실제 압축 실행은 변경하지 않는다.

## 검증과 적용 범위

`test_compaction_status.py`는 모델부터 타임라인까지의 전달, 거짓·누락·잘못된 값, 메타데이터만 바뀌는 실시간 갱신을 확인한다.
`compaction-status.test.cjs`는 자동·수동·완료 상태, turn 상태와의 우선순위, 이전 기록, 실패·중단과 세 언어 문구를 확인한다.
브라우저 회귀 검사는 실제 웹 리소스에서 같은 행의 진행→완료와 언어 전환, 상세 선조회가 없는 동작을 확인한다.
브라우저 픽스처는 실제 Android WebView 조작 검증과 구분한다.

Python 게이트웨이와 공통 웹을 갱신한다. Android·iOS 네이티브 소스 변경이나 APK 재빌드는 필요하지 않다.
