const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const i18n=require('../web/shared/i18n.js');
test('all declared mobile HTML labels have English translations',()=>{
 const html=fs.readFileSync(__dirname+'/../web/index.html','utf8');
 for(const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g))assert.ok(Object.hasOwn(i18n.dictionary,m[1]),m[1]);
});
test('workbench literal translation keys are covered',()=>{
 for(const f of ['features/workspace/workbench','features/workspace/git-panel','features/workspace/side-chat','features/workspace/terminal-panel','features/workspace/floating-panel','features/workspace/agents-panel','features/chat/list-sync'])
  for(const m of fs.readFileSync(__dirname+'/../web/'+f+'.js','utf8').matchAll(/BridgeI18n.t\('([^']*[\u4e00-\u9fff][^']*)'\)/g)){
   const key=vm.runInNewContext(m[0].slice('BridgeI18n.t('.length,-1));
   assert.ok(Object.hasOwn(i18n.dictionary,key),f+': '+key);
  }
});
test('client readiness errors and live notices translate in both desktop and web',()=>{
 const desktop=require('../desktop/shared/i18n.js');
 for(const source of ['게이트웨이를 시작하여 연결을 확인하세요.','Codex를 설치하고 컴퓨터에 계정 또는 API를 구성하세요.','데스크톱 클라이언트에서 계정 또는 API를 구성합니다. 이전 플러그인을 다시 설치하세요','클라이언트를 사용할 수 없습니다. 컴퓨터의 연결을 확인하세요.']){
   i18n.setLanguage('en');assert.doesNotMatch(i18n.t(source),/[\u4e00-\u9fff]/,source);
   assert.equal(desktop.translate("Error invoking remote method 'bridge:desktop-sessions': Error: "+source,'en'),i18n.t(source));
 }
 i18n.setLanguage('ko');
});
test('desktop module markup has translations, including dynamically inserted controls',()=>{
 for(const file of ['desktop/index.html','desktop/shell/layout.js'])
  for(const m of fs.readFileSync(__dirname+'/../'+file,'utf8').matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g))assert.ok(Object.hasOwn(i18n.dictionary,m[1]),file+': '+m[1]);
});
