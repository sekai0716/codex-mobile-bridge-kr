# Agent Note: Intel macOS 냉동 프로그램 OpenSSL 격리

Status: implemented

## 문제

네이티브 Intel macOS CI 릴리스 서명 통신 설비를 시작하지 못했습니다.：cryptography 의 Rust 확장 요구 `SSL_get0_group_name`，냉동 패키지에 `libssl.3.dylib` 이 기호는 제공되지 않습니다. 설치 로그가 표시됩니다. cryptography 50.0.2 소스에서 빌드하고 동적으로 연결 Homebrew OpenSSL；PyInstaller 이름을 딴 컬렉션 Python SSL 라이브러리가 호환되지 않습니다. 성공적인 소스 코드 테스트는 정지된 프로그램이 실행될 수 있음을 입증하지 않습니다.。

## 결정

Desktop builds 오직 에서만 Intel macOS 작업이 일반 종속성을 설치하기 전에 다음을 사용하십시오. `OPENSSL_STATIC=1` 소스에서 빌드 cryptography 50.0.2，설치를 비활성화하고 wheel 은닉처. 재사용 실행기가 이미 존재합니다. OpenSSL/Rust；사용자 시스템은 변경되지 않습니다. 이후의 공식 패키징 및 ID 고정 장치 릴리스에서는 동일한 종속성 환경을 사용합니다. 다른 플랫폼에서는 원래 설치 경로를 유지합니다.。

## 대안

아직 반품 가능 Intel wheel 이전 버전의 은 소스 빌드를 피할 수 있지만 이전 암호화 종속성에 고정되므로 사용되지 않습니다. 고정된 패키지의 공유를 수동으로 교체 libssl 바뀔 수도 있다 Python SSL 더 큰 영향을 미치고 사용되지 않는 기타 확장 종속성.。

## 영향

Intel 빌드에는 소스 코드 컴파일 시간이 필요합니다. 정적 연결은 다중을 방지합니다 OpenSSL 동적 라이브러리 간에 동일한 이름이 충돌합니다. 여기의 명시적 버전은 종속성 유지 관리와 함께 업데이트되어야 합니다. 네이티브 릴리스 인증, 실제 동결된 프로그램 통신 및 업그레이드 핸드오버、DMG/ZIP 수표는 유지되며 인증 수표는 축소되지 않습니다. 합격 결과는 개정된 내용을 바탕으로 합니다. Intel CI 대상。

## 에 따라

[업스트림 설치 지침](https://cryptography.io/en/latest/installation/#building-cryptography-on-macos) 정적 구축 방법 제공；[49.0.0 변경 내역](https://cryptography.io/en/latest/changelog/#v49-0-0) 설명은 더 이상 게시되지 않습니다. Intel macOS wheel。실패 후보 Desktop builds 42472339912 의 Intel 작업。
