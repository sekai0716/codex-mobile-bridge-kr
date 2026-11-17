'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/shared/i18n.js','utf8');
function i18n(){const context=vm.createContext({module:{exports:{}},localStorage:{getItem(){return null;},setItem(){}}});vm.runInContext(source,context);return context.module.exports;}

test('Korean is the default and English keeps each message meaning',()=>{
  const ui=i18n();assert.equal(ui.language(),'ko');assert.equal(ui.locale(),'ko-KR');
  const key=Object.keys(ui.dictionary).find(key=>ui.dictionary[key]==='Codex native chat connection');
  assert.equal(ui.t(key),'Codex 네이티브 채팅 연결');
  ui.setLanguage('en');assert.equal(ui.t(key),'Codex native chat connection');
  assert.equal(ui.t('사용자 입력: echo sample'),'사용자 입력: echo sample');
});

test('Korean dictionary keys cannot overwrite a different English message',()=>{
  const start=source.indexOf('const en={'),end=source.indexOf('\n};',start),seen=new Map();
  const rows=source.slice(start,end).matchAll(/^\s*("(?:\\.|[^"\\])*")\s*:\s*("(?:\\.|[^"\\])*")/gm);
  let count=0;for(const row of rows){const key=JSON.parse(row[1]),value=JSON.parse(row[2]);if(seen.has(key))assert.equal(value,seen.get(key),'서로 다른 메시지가 같은 한국어 키를 사용합니다: '+key);seen.set(key,value);count++;}
  assert.ok(count>3000,'전체 UI 사전이 검사되어야 합니다.');
});

test('phone help preserves long-term pairing separately from web sign-in expiry',()=>{
  const entries=Object.entries(i18n().dictionary);
  const auth=entries.find(([,en])=>en.startsWith('Standard web sign-in defaults'));
  assert.match(auth[0],/모바일 앱 로그인과 페어링.*로그아웃.*인증을 철회.*유지/);
  assert.match(auth[1],/Mobile app sign-ins and pairing remain trusted until you sign out or revoke the device/);
  assert.match(auth[1],/0 disables expiry for web sign-ins/);
  const qr=entries.find(([,en])=>en.startsWith('Valid for 5 minutes and one use.'));
  assert.match(qr[0],/모바일 앱은 로그아웃.*인증을 철회.*로그인 상태를 유지/);
  assert.match(qr[1],/The mobile app stays signed in until you sign out or revoke it/);
});

test('requested Korean labels keep original keys and English meanings',()=>{
 const ui=i18n(),labels={'명령을 실행하다':'명령을 실행함','승인해 주세요':'나 대신 승인','Codex 일하고 있는':'Codex 생각 중','Codex가 작동 중입니다…':'Codex 생각 중',steered:'스티어링함',automaticApprovalReview:'자동 검토 중','보조 채팅':'사이드 채팅','단말기':'터미널','상담원이 채팅 이름을 지정할 수 있도록 비워 두세요.':'비워 두면 에이전트가 채팅 이름을 자동으로 정합니다.'};
 for(const [key,value] of Object.entries(labels)){assert.equal(ui.t(key),value,key);assert.ok(ui.source(value),value);ui.setLanguage('en');assert.equal(ui.t(key),ui.dictionary[key]);ui.setLanguage('ko');}
 for(const value of ['echo "단말기"','user-supplied side chat text','file://project/보조 채팅.txt','constructor','__proto__'])assert.equal(ui.t(value),value);
});
test('every registered UI message uses consistent terms and preserves placeholders',()=>{
 const ui=i18n(),placeholders=text=>[...text.matchAll(/\{[A-Za-z][A-Za-z0-9_]*\}/g)].map(m=>m[0]).sort();let changed=0;
 for(const [key,english] of Object.entries(ui.dictionary)){
  const korean=ui.t(key);assert.equal(typeof korean,'string',key);assert.doesNotMatch(korean,/보조 채팅|단말기|데스크탑|배송|MODEL_PLACEHOLDER/);
  assert.deepEqual(placeholders(korean),placeholders(key),key);if(korean!==key)changed++;
  ui.setLanguage('en');assert.equal(ui.t(key),english,key);ui.setLanguage('ko');
 }
 assert.ok(changed>200,'공통 화면의 용어와 직역 표현이 함께 교정되어야 합니다.');
});
test('desktop messages share Korean presentation and stable operation text',()=>{
 const desktop=require('../desktop/shared/i18n.js');
 for(const [source,expected] of [['작곡가 숨기기','입력창 접기'],['승인해 주세요','나 대신 승인'],['저지르다','커밋']])assert.equal(desktop.translate(source,'ko'),expected);
 assert.equal(desktop.translate('승인해 주세요','en'),'Approve for me');
});
