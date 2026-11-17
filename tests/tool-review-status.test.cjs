'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const i18n=require('../web/shared/i18n'),context=vm.createContext({BridgeI18n:i18n});
vm.runInContext(fs.readFileSync('web/features/chat/activity.js','utf8'),context);
const label=vm.runInContext('chatActivityLabel',context),execution=vm.runInContext('chatToolExecutionState',context),group=vm.runInContext('chatActivityGroupKind',context);
const tool=fields=>({role:'activity',kind:'commandExecution',title:'명령을 실행하다',...fields});
test('review badges show progress and denial while approved actions retain only the tool caption',()=>{
  for(const [status,expected]of [['inProgress','명령을 실행함ㆍ자동 검토 중'],['approved','명령을 실행함'],['denied','명령을 실행함ㆍ거부됨'],['aborted','명령을 실행함ㆍ검토 중단됨'],['timedOut','명령을 실행함ㆍ검토 시간 초과']])assert.equal(label(tool({approvalReview:{status}})),expected);
  assert.equal(group(tool({status:'inProgress',approvalReview:{status:'denied'}})),null,'denied tools are not hidden in a collapsed group');
  assert.equal(label({kind:'automaticApprovalReview',reviewActionLabel:"printf '원문'",approvalReview:{status:'denied'}}),"printf '원문'ㆍ거부됨");
});
test('execution evidence is distinct from review approval including nonzero exits and missing evidence',()=>{
  for(const [fields,result,expected]of [
    [{approvalReview:{status:'approved'}},'','명령을 실행함'],
    [{status:'inProgress',approvalReview:{status:'approved'}},'running','명령을 실행함ㆍ실행 중'],
    [{status:'completed',exitCode:0},'succeeded','명령을 실행함'],
    [{status:'completed',exitCode:2,approvalReview:{status:'approved'}},'failed','명령을 실행함ㆍ실행 실패'],
    [{status:'completed'},'completed','명령을 실행함'],
    [{status:'interrupted'},'interrupted','명령을 실행함ㆍ중지됨'],
    [{status:'declined',approvalReview:{status:'denied'}},'declined','명령을 실행함ㆍ거부됨'],
  ]){assert.equal(execution(tool(fields)),result);assert.equal(label(tool(fields)),expected);}
  assert.equal(execution({kind:'dynamicToolCall',status:'completed',success:false}),'failed');
  assert.equal(execution({kind:'mcpToolCall',status:'completed',success:true}),'succeeded');
});
test('status labels follow all language packs and preserve literal fallback action names',()=>{
  const before=i18n.language();
  try{for(const [lang,word]of [['ko','거부됨'],['en','Denied'],['zh','已拒绝']]){
    i18n.setLanguage(lang);assert.equal(label({kind:'automaticApprovalReview',reviewActionLabel:'literal command',approvalReview:{status:'denied'}}),'literal commandㆍ'+word);
    assert.equal(label({kind:'mcpToolCall',title:'파일',approvalReview:{status:'denied'}}),'파일ㆍ'+word);
  }}finally{i18n.setLanguage(before);}
});
