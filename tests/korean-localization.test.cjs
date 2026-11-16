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
