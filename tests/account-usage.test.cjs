'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {loadLanguagePacks}=require('./helpers/language-packs.cjs');
function fixture(read){
  const node=tag=>({tag,hidden:false,children:[],setAttribute(name,value){this[name]=value;},append(...values){this.children.push(...values);},replaceChildren(...values){this.children=values;},remove(){this.removed=true;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});
  const context=vm.createContext({module:{exports:{}},document:{createElement:node,body:node('body')},BridgeI18n:loadLanguagePacks(),Date,Intl});
  vm.runInContext(fs.readFileSync('web/features/chat/account-usage.js','utf8'),context);
  return new context.module.exports.AccountUsageControl({read});
}
const tick=()=>new Promise(setImmediate);
const scope=identity=>({host:'local',provider:'openai',identity});
const limits=(remaining=0)=>({visible:true,limits:[{id:'codex',name:'Codex',windows:[{windowDurationMins:300,remainingPercent:remaining,resetsAt:1800000000},{windowDurationMins:10080,remainingPercent:75}]}]});

test('remaining quota preserves zero, uses the cached read and opens read-only reset details',async()=>{
  const calls=[],ui=fixture(async(s,force)=>{calls.push({s,force});return limits();});ui.update(scope('first'));await tick();
  assert.equal(ui.button.textContent,'0%·75%');assert.match(ui.button.title,/5시간|5 시간/);assert.match(ui.button.title,/주간/);assert.match(ui.button.title,/남/);
  for(let i=0;i<5;i++)ui.update(scope('first'));await tick();assert.equal(calls.length,1);assert.equal(calls[0].force,false);
  ui.open();const all=n=>[n,...n.children.flatMap(all)];assert.ok(all(ui.dialog).some(n=>n.textContent?.startsWith('재설정 시간:')));
  assert.equal(all(ui.dialog).filter(n=>n.tag==='button').length,2);await ui.refresh(true);assert.equal(calls[1].force,true);
});
test('an old account response is discarded after identity, host or eligibility changes',async()=>{
  const pending=[],ui=fixture(()=>new Promise(resolve=>pending.push(resolve)));
  ui.update(scope('old'));ui.update(scope('new'));pending[1](limits(20));await tick();pending[0](limits(99));await tick();assert.match(ui.button.textContent,/20%/);assert.doesNotMatch(ui.button.textContent,/99%/);
  ui.update({...scope('new'),host:'codex:other'});ui.update(null);pending[2](limits(77));await tick();assert.equal(ui.button.hidden,true);assert.equal(ui.value,undefined);
});
test('unavailable and ambiguous quota windows are not presented as another bucket or zero percent',async()=>{
  const ui=fixture(async()=>({visible:true,limits:[{id:'other1',windows:[{remainingPercent:12}]},{id:'other2',windows:[{remainingPercent:99}]}]}));ui.update(scope('first'));await tick();assert.match(ui.button.textContent,/—/);assert.doesNotMatch(ui.button.textContent,/12|99/);
  const fail=fixture(async()=>{throw Error('Unavailable');});fail.update(scope('first'));await tick();assert.match(fail.button.textContent,/—/);assert.doesNotMatch(fail.button.textContent,/0%/);
});
test('accounts with only a weekly limit never show a missing five-hour limit as zero',async()=>{
  for(const windows of [
    [{windowDurationMins:10080,remainingPercent:48}],
    [{windowDurationMins:300,remainingPercent:null},{windowDurationMins:10080,remainingPercent:48}],
  ]){
    const ui=fixture(async()=>({visible:true,limits:[{id:'codex',windows}]}));ui.update(scope('weekly'));await tick();
    assert.equal(ui.button.textContent,'주간 48%');assert.doesNotMatch(ui.button.title,/5시간|5 시간|0%/);
  }
});
