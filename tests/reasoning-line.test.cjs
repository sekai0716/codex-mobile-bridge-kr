'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('web/features/chat/activity.js','utf8'),context);
const line=value=>{context.value=value;return vm.runInContext('chatLastNonEmptyLine(value)',context);};
test('reasoning status removes bold markers before choosing the last nonempty line',()=>{
  for(const [input,expected] of [
    ['**연결 상태 확인 중**','연결 상태 확인 중'],
    ['앞줄\n**마지막** 요약 **내용**\n  ','마지막 요약 내용'],
    ['**스트리밍 중','스트리밍 중'],
    ['유효한 요약\n**\n  ','유효한 요약'],
    ['**\n****\n ',''],
    ['파일 * 와 단일 * 기호','파일 * 와 단일 * 기호'],
    ['첫 줄\u2028**끝줄**\u2029','끝줄'],
    [null,''],[42,''],
  ])assert.equal(line(input),expected,String(input));
});
