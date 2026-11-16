'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const i18n=require('../web/shared/i18n.js'),desktop=require('../desktop/shared/i18n.js');
test('English operation failures and dynamic channel feedback are translated',()=>{
 i18n.setLanguage('en');
 for(const source of ['먼저 연결 설정을 저장하세요.','계정이 더 이상 존재하지 않습니다. 목록을 새로 고칩니다.','계정 ID가 변경되었습니다.','데스크톱 앱의 Codex 런타임을 찾을 수 없습니다.','저장된 계정에 다시 로그인하세요.','PushPlus 테스트가 실패했습니다. 서비스 주소, 인증, 네트워크를 확인하세요.','일부 채널에서 전송하지 못했습니다.：ntfy, pushplus；다른 채널에서 수신 여부를 휴대폰에서 확인해주세요.。']){
  assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/);assert.doesNotMatch(i18n.t("Error invoking remote method 'bridge:accounts': Error: "+source),/[\u4e00-\u9fff]/);assert.doesNotMatch(desktop.translate("Error invoking remote method 'bridge:accounts': Error: "+source,'en'),/[\u4e00-\u9fff]/);
 }
 assert.equal(i18n.t('사용자의 중국어 채팅 제목'),'사용자의 중국어 채팅 제목');
 i18n.setLanguage('ko');assert.equal(i18n.t('계정 ID가 변경되었습니다.'),'계정 ID가 변경되었습니다.');
});
test('macOS quit receipts translate without dropping diagnostic codes',()=>{
 const messages=['클라이언트 프로세스가 변경되었습니다. 종료하기 전에 다시 한번 확인해 보세요(quit: changed).','macOS 종료 결과를 알 수 없습니다. 클라이언트 상태를 확인하세요. 프로세스가 강제로 중지되지 않았습니다(quit: timeout).','macOS 종료 요청을 보낼 수 없습니다. 시스템 환경을 확인하세요(quit: unavailable).','macOS 종료 요청이 실패했습니다. 클라이언트 상태를 확인하세요.（quit: native-error; code: -1）','클라이언트가 종료 요청을 거부했습니다. 프롬프트를 확인하세요. 프로세스가 강제로 중지되지 않았습니다(quit: rejected).','macOS 종료 결과를 확인할 수 없습니다. 클라이언트 상태를 확인하세요(quit: invalid-response).'];
 i18n.setLanguage('en');for(const source of messages){assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/);assert.match(i18n.t(source),/quit: /);assert.equal(desktop.translate(source,'en'),i18n.t(source));}i18n.setLanguage('ko');
});

test('background force quit choices, risks and progress translate for desktop and mobile',()=>{
 const messages=['정상적으로 데스크톱 앱 종료','백그라운드에서 강제 종료','앱 프로세스를 종료합니다. 저장하지 않은 콘텐츠는 손실될 수 있으며 작업이 중단될 수 있습니다. 이는 컴퓨터가 잠겨 있는 동안에도 작동합니다.','백그라운드에서 강제 종료 중…','백그라운드 강제 종료 재시도','백그라운드 강제 종료 요청이 잘못되었습니다.','이 시스템은 Windows 앱 강제 종료를 지원하지 않습니다.','데스크톱 앱 구성을 사용할 수 없습니다. 다시 스캔하세요.','앱 프로세스가 변경되었거나 확인할 수 없어 강제 종료가 중지되었습니다. 다시 시도하기 전에 다시 스캔하세요.','선택한 앱이 게이트웨이 또는 해당 앱을 실행한 프로세스와 겹치므로 강제 종료할 수 없습니다.','모든 앱 프로세스를 종료할 수 있는 것은 아닙니다. 다시 시도하기 전에 컴퓨터에서 권한을 확인하거나 문제를 해결하세요.','앱이 강제 종료되기를 기다리는 중 시간이 초과되었습니다. 다시 스캔하고 컴퓨터에서 앱을 확인하세요.'];
 i18n.setLanguage('en');for(const source of messages){assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/,source);assert.equal(desktop.translate(source,'en'),i18n.t(source));}i18n.setLanguage('ko');
});

test('macOS background connection recovery and explicit foreground initialization are translated accurately',()=>{
 const messages=['컴퓨터에 설치하고 로그인합니다. 접근을 비활성화할 때 데스크톱 앱을 유지할지, 종료할지 선택하세요. macOS에서 Claude는 백그라운드에서 시작되어 기존 연결을 복원하려고 시도합니다. 초기화 연결은 확인 후에만 포그라운드를 사용합니다. Windows는 먼저 백그라운드 초기화를 시도합니다.','연결할 앱을 선택하세요. macOS에서 Claude는 백그라운드에서 시작되어 기존 연결을 복원하려고 시도합니다. 초기화 연결은 확인 후에만 포그라운드를 사용합니다. Windows는 먼저 백그라운드 초기화를 시도합니다.','Claude가 기존 연결을 복원할 수 없습니다. 연결 초기화를 선택합니다. 초기화에서는 전경 창을 사용합니다. 컴퓨터 바탕화면을 대화형으로 유지하세요.','선택된. 게이트웨이가 시작되면 Claude가 백그라운드에서 열리고 기존 연결 복원을 시도합니다. 초기화가 필요한지 묻는 메시지가 표시됩니다.'];
 i18n.setLanguage('en');for(const source of messages){assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/,source);assert.equal(desktop.translate(source,'en'),i18n.t(source));assert.match(i18n.t(source),/restore an existing connection/);}
 assert.match(i18n.t(messages[0]),/foreground only after confirmation/);assert.match(i18n.t(messages[0]),/Windows attempts background initialization first/);i18n.setLanguage('ko');
});


test('close choices and exit failures translate without implying that disabling ends tasks',()=>{
 const messages=["이 Claude 데스크톱 버전은 백그라운드 종료를 지원하지 않습니다. Claude 메뉴 또는 컴퓨터의 시스템 트레이에서 종료를 선택하거나 ”전화 액세스만 비활성화”를 선택하십시오.","정상적으로 종료하기 전에 Harness 연결을 업데이트하세요. 컴퓨터에서 Harness를 종료한 후 다시 연결하세요.","Harness가 종료되지 않았습니다. 컴퓨터에서 프롬프트 종료를 처리하고 다시 시도하세요. 강제 종료된 프로세스가 없습니다.","모든 앱 작업이 종료되었는지 확인할 수 없습니다. 데스크톱 앱을 계속 실행하려면 ’전화 액세스만 비활성화’를 선택하거나, 컴퓨터에서 앱을 종료하고 다시 시도하세요.","클라이언트가 연결되어 있지 않아 작업 상태를 확인할 수 없습니다. ’전화 액세스만 비활성화’를 선택하거나 컴퓨터에서 앱을 종료하고 다시 시도하세요.","액세스를 비활성화하는 중…"];
 i18n.setLanguage('en');for(const source of messages){assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/,source);assert.equal(desktop.translate(source,'en'),i18n.t(source));}
 assert.match(i18n.t('데스크톱 앱과 현재 작업을 계속 실행하세요.'),/tasks running/);i18n.setLanguage('ko');
});


test('native app quit prompts and results translate in both desktop and mobile',()=>{
 const messages=["Claude의 네이티브 메뉴를 통해 종료합니다. 메뉴가 잠시 나타날 수 있습니다. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요.","컴퓨터에 설치하고 로그인합니다. 액세스를 비활성화할 때 데스크톱 앱을 계속 실행할지 아니면 종료할지 선택하세요. Claude를 종료하면 네이티브 메뉴가 잠시 열립니다. 처음 연결하기 전에 컴퓨터에서 Claude를 초기화하세요.","이 종료 작업은 Claude 데스크톱에서만 사용할 수 있습니다.","Claude 프로세스가 변경되었습니다. 종료하기 전에 다시 확인하세요.","Claude 작업을 처리하거나 컴퓨터에 프롬프트를 저장한 후 다시 시도하세요.","Claude가 종료되지 않았습니다. 작업을 처리하거나 컴퓨터에 프롬프트를 저장한 후 다시 시도하세요.","Claude 종료 요청이 취소되었습니다.","Claude의 네이티브 종료 메뉴를 찾을 수 없습니다. 컴퓨터에서 메뉴를 확인하고 다시 시도하세요.","둘 이상의 Claude 종료 메뉴가 발견되었습니다. 컴퓨터를 확인하고 다시 시도하세요.","Claude 기본 프로세스가 변경되었습니다. 종료 요청이 중지되었습니다.","초점이 Claude에서 멀어졌습니다. 종료 요청이 중지되었습니다. 다시 시도해 보세요.","Claude에는 보류 중인 네이티브 대화 상자가 있습니다. 컴퓨터에서 확인하거나 취소하세요.","Claude가 정상적으로 종료됩니다.","Claude가 컴퓨터에서 종료 확인을 기다리고 있습니다. 직접 확인하거나 취소하세요.","정상적인 Claude 종료가 요청되었습니다. 저장 및 종료가 완료되기를 기다리는 중입니다.","Claude 네이티브 종료 구성요소가 누락되었습니다. 게이트웨이 앱을 다시 빌드하거나 다시 설치하세요.","Claude 네이티브 종료 구성요소를 시작할 수 없습니다. 게이트웨이 설치를 확인하세요.","Claude 네이티브 종료 요청 시간이 초과되었습니다. 컴퓨터에서 종료 상태를 확인하세요.","Claude 네이티브 종료 구성 요소가 유효한 상태를 반환하지 않았습니다. 컴퓨터에서 종료 상태를 확인하세요.","이 종료 작업은 Harness 데스크톱에서만 사용할 수 있습니다.","이 Harness 버전에는 검증 가능한 백그라운드 종료 방법이 없습니다. 데스크톱 앱을 업데이트하고 다시 시도하세요.","실행 중인 Harness 인스턴스의 데이터 디렉터리를 확인할 수 없습니다. 다시 스캔하고 다시 시도하세요.","일반적인 Harness 종료 요청이 완료되지 않았습니다. 잠시 후 다시 시도하세요.","Harness가 일반 종료 요청을 거부했습니다. 컴퓨터를 확인하고 다시 시도하세요."];
 i18n.setLanguage('en');for(const source of messages){assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/,source);assert.equal(desktop.translate(source,'en'),i18n.t(source));}i18n.setLanguage('ko');
});
