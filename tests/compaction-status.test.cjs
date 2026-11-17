'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const i18n=require('../web/shared/i18n'),context=vm.createContext({BridgeI18n:i18n});
vm.runInContext(fs.readFileSync('web/features/chat/activity.js','utf8'),context);
const label=vm.runInContext('chatActivityLabel',context);
const compact=fields=>({kind:'contextCompaction',role:'activity',...fields});
test('native compaction source and completed determine the label independently of the turn',()=>{
  const before=i18n.language();i18n.setLanguage('ko');
  try{
    assert.equal(label(compact({source:'automatic',completed:false})),'컨텍스트 자동 압축 중');
    assert.equal(label(compact({source:'manual',completed:false})),'컨텍스트 압축 중');
    assert.equal(label(compact({source:'automatic',completed:false,turnStatus:'completed',status:'completed'})),'컨텍스트 자동 압축 중');
    for(const source of ['automatic','manual'])assert.equal(label(compact({source,completed:true,turnStatus:'inProgress'})),'컨텍스트 압축됨');
    assert.equal(label(compact({kind:'autoContextCompaction',source:'manual',completed:false})),'컨텍스트 압축 중');
  }finally{i18n.setLanguage(before);}
});
test('legacy compaction records and explicit failure or interruption retain their states',()=>{
  const before=i18n.language();i18n.setLanguage('ko');
  try{
    assert.equal(label(compact({status:'inProgress'})),'컨텍스트 압축 중');
    assert.equal(label(compact({kind:'autoContextCompaction',status:'inProgress'})),'컨텍스트 자동 압축 중');
    assert.equal(label(compact({turnStatus:'completed'})),'컨텍스트 압축됨');
    assert.equal(label(compact({source:'automatic',completed:'true'})),'컨텍스트 자동 압축');
    assert.equal(label(compact({source:'automatic',completed:false,status:'failed'})),'압축 실패');
    assert.equal(label(compact({source:'manual',completed:false,status:'interrupted'})),'압축 중지됨');
  }finally{i18n.setLanguage(before);}
});
test('native compaction state labels follow Korean, English and Chinese packs',()=>{
  const before=i18n.language();
  try{for(const [lang,active,done]of [['ko','컨텍스트 자동 압축 중','컨텍스트 압축됨'],['en','Automatically compacting context','Context compacted'],['zh','正在自动压缩上下文','上下文已压缩']]){
    i18n.setLanguage(lang);
    assert.equal(label(compact({source:'automatic',completed:false})),active);
    assert.equal(label(compact({source:'automatic',completed:true})),done);
  }}finally{i18n.setLanguage(before);}
});
