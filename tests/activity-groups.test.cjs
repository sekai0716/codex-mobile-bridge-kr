'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('web/features/chat/activity.js','utf8'),context);
const group=rows=>{context.rows=rows;return JSON.parse(vm.runInContext('JSON.stringify(groupChatActivityRows(rows))',context));};
const tool=(key,kind='commandExecution',extra={})=>({key,role:'activity',kind,turnId:'turn-a',...extra});
const shape=rows=>group(rows).map(unit=>[unit.kind,unit.rows.map(row=>row.key)]);
test('activity grouping follows native kinds, turn and transcript boundaries rather than translated titles',()=>{
  assert.deepEqual(shape([
    {key:'progress',role:'assistant',phase:'commentary'},tool('cmd'),tool('reason','reasoning'),tool('patch','fileChange'),tool('search','webSearch'),
    {key:'next-progress',role:'assistant',phase:'commentary'},tool('cmd2'),tool('tool','mcpToolCall'),
    tool('turn-b','commandExecution',{turnId:'turn-b'}),tool('turn-b2','dynamicToolCall',{turnId:'turn-b'}),{key:'reply',role:'assistant'},
  ]),[
    ['standalone',['progress']],['group',['cmd','patch','search']],['standalone',['next-progress']],['group',['cmd2','tool']],['group',['turn-b','turn-b2']],['standalone',['reply']],
  ]);
  assert.deepEqual(shape([tool('a','commandExecution',{title:'任意のタイトル'}),tool('b','fileChange',{title:'Other title'})]),[['group',['a','b']]]);
  assert.deepEqual(shape([tool('a','unknown',{title:'명령을 실행함'}),tool('b','unknown',{title:'명령을 실행함'})]),[['standalone',['a']],['standalone',['b']]]);
});
test('images, approvals, errors and unknown activities remain separate and split adjacent groups',()=>{
  for(const boundary of [tool('image','imageView'),tool('tool-image','mcpToolCall',{attachments:[{type:'toolImage'}]}),
    tool('denied','automaticApprovalReview',{status:'denied'}),tool('declined','commandExecution',{status:'declined'}),
    tool('permission','permissionRequest'),{key:'error',role:'error'},tool('other','futureTool')]){
    assert.deepEqual(shape([tool('before'),boundary,tool('after')]),[['standalone',['before']],['standalone',[boundary.key]],['standalone',['after']]],boundary.key);
  }
  assert.deepEqual(shape([tool('a'),tool('review','automaticApprovalReview',{status:'inProgress'}),tool('b')]),[['group',['a','review','b']]]);
  assert.deepEqual(shape([tool('a'),{key:'summary',role:'fileChanges',kind:'fileChanges',turnId:'turn-a'}]),[['group',['a','summary']]]);
  assert.deepEqual(shape([]),[]);
});
test('command labels retain the literal first line and never substitute output for an empty command',()=>{
  const first=vm.runInContext('chatCommandFirstLine',context);
  for(const [text,expected] of [["printf '<b>literal</b>'\nprintf second","printf '<b>literal</b>'"],['  git status --short\r\noutput','git status --short'],['\n\noutput',''],['python3\u2028second','python3'],['',''],[null,'']])assert.equal(first(tool('cmd','commandExecution',{text})),expected);
  assert.equal(first(tool('tool','mcpToolCall',{text:'not a shell command'})),'');
});
