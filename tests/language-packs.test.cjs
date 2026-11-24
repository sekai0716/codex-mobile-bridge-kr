'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadLanguagePacks}=require('./helpers/language-packs.cjs');

test('Chinese, English and Korean packs keep the same registered UI message set',()=>{
  const ui=loadLanguagePacks(),keys=Object.keys(ui.canonicalDictionary);
  assert.ok(keys.length>=3903);
  for(const locale of ['en','ko','zh'])assert.deepEqual(Object.keys(ui.packs[locale]).sort(),keys.slice().sort());
  for(const [locale,expected]of [['en','Side chat'],['ko','사이드 채팅'],['zh','侧边聊天']]){
    ui.setLanguage(locale);assert.equal(ui.t('보조 채팅'),expected);
    assert.equal(ui.t('constructor'),'constructor');assert.equal(ui.t('__proto__'),'__proto__');assert.equal(ui.t(''),'');
    for(const value of ['사용자가 정한 보조 채팅 제목','echo "보조 채팅"','/tmp/단말기.txt','用户自己的聊天标题'])assert.equal(ui.t(value),value);
  }
});

test('saved Chinese aliases and Korean selections remain explicit across reloads',()=>{
  for(const [saved,expected]of [['zh','zh'],['zh-CN','zh'],['ko','ko'],['ko-KR','ko'],['en','en']]){
    let written;const ui=loadLanguagePacks({localStorage:{getItem:()=>saved,setItem:(key,value)=>written=[key,value]}});
    assert.equal(ui.language(),expected);ui.setLanguage(saved);assert.deepEqual(written,['bridge-language',expected]);
  }
});

test('English and original Chinese inputs resolve through the Korean pack',()=>{
  const ui=loadLanguagePacks();ui.setLanguage('ko');
  assert.equal(ui.t('思考摘要'),'추론 요약');assert.equal(ui.t('Side chat'),'사이드 채팅');
  assert.equal(ui.t('이 채팅 이어가기…'),'메시지를 입력하세요');
  ui.setLanguage('zh');assert.equal(ui.t('Message…'),'输入消息…');
  ui.setLanguage('en');assert.equal(ui.t('이 채팅 이어가기…'),'Message…');
});

test('desktop connection errors from the gateway use the selected language',()=>{
  const ui=loadLanguagePacks();
  const missingConnection='桌面 App 未连接，请打开 Codex App。';
  const messages=[
    "原生桌面连接身份无法核验，请在账号管理中检查连接状态。",
    "桌面读取超时；尚未取得实时会话状态。",
    "桌面 App 未连接，请打开 Codex App。",
    "原生桌面连接在握手期间已变化。",
    "消息过大",
    "桌面连接已断开",
    "桌面连接已断开；请检查会话后再决定是否重发。",
    "桌面请求未完成",
    "桌面响应超时；操作可能已提交，请查看会话后再决定是否重发。",
    "桌面 IPC 帧长度不兼容",
  ];
  for(const source of messages){
    assert.match(ui.translateTo(source,'ko'),/[가-힣]/u,source);
    assert.doesNotMatch(ui.translateTo(source,'ko'),/\p{Unified_Ideograph}/u,source);
    assert.match(ui.translateTo(source,'en'),/^[\x20-\x7e]+$/,source);
    assert.equal(ui.translateTo(source,'zh'),source);
  }
  assert.equal(ui.translateTo(missingConnection,'ko'),'Codex 데스크톱 앱에 연결할 수 없습니다. PC에서 Codex를 열어 주세요.');
  assert.equal(ui.translateTo(missingConnection,'en'),'Unable to connect to the Codex desktop app. Open Codex on your computer.');
});
