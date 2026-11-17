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
