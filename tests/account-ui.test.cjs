'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function fixture(resetOnly=false){
  let now=Date.now(),timerId=0;const timers=new Map();
  class Clock extends Date{static now(){return now;}}
  function node(tag){return {tag,textContent:'',hidden:false,disabled:false,children:[],attributes:{},
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}},replaceChildren(...children){this.children=[];this.append(...children);},
    setAttribute(name,value){this.attributes[name]=value;},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}};}
  const body=node('body');
  function advance(ms){const end=now+ms;while(true){const item=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!item||item[1].at>end)break;now=item[1].at;timers.delete(item[0]);item[1].fn();}now=end;}
  const root=node('div'),button=node('button'),writes=[],prompts=[];
  let value={visible:true,accountKey:'a'.repeat(64),email:'test@example.test',planType:'pro',canReset:true,
    limits:[{name:'Codex',windows:[{remainingPercent:75,windowDurationMins:300,resetsAt:2000000000}]}],
    resetCredits:{availableCount:3,credits:[{id:'card-1',title:'Test reset',status:'available',resetType:'codexRateLimits',expiresAt:null}]},updatedAt:1900000000};
  let confirmed=true,consume=async()=>({outcome:'reset',account:{...value,resetCredits:{availableCount:2,credits:[]}}}),read=async()=>structuredClone(value),hidden=0;
  const context=vm.createContext({root,button,setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout(id){timers.delete(id);},document:{createElement:node,body},Date:Clock,performance:{now:()=>now},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
    window:{confirm:prompt=>{prompts.push(prompt);return confirmed;}},localStorage:{getItem(){return null;},setItem(){}},
    read:()=>read(),consume:body=>{writes.push(structuredClone(body));return consume(body);},onHidden:()=>hidden++,resetOnly});
  for(const file of ['web/shared/locales/en.js','web/shared/locales/ko-KR.js','web/shared/locales/zh-CN.js','web/shared/locales/legacy.js','web/shared/i18n.js','web/features/accounts/account.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  const panel=vm.runInContext('new AccountPanel({root,button,read,consume,onHidden,visible:()=>true,resetOnly})',context);
  const all=(n=root)=>[n,...n.children.flatMap(all)];
  const confirmButton=()=>body.children[0]?.children.at(-1).children[1];
  const confirmDialog=()=>{advance(5000);confirmButton()?.onclick();};
  const redeem=async(...args)=>{const result=panel.redeem(...args);if(body.children.length){if(confirmed)confirmDialog();else body.children[0].oncancel({preventDefault(){}});}await result;};
  return {panel,button,root,writes,prompts,all,body,advance,confirmButton,confirmDialog,redeem,text:()=>all().map(n=>n.textContent).join('\n'),
    value:()=>value,setValue:next=>value=next,setRead:next=>read=next,setConsume:next=>consume=next,
    confirm:next=>confirmed=next,language:()=>{vm.runInContext("BridgeI18n.setLanguage('en')",context);panel.render();}};
}

test('official account shows limits, authoritative card count and refresh stays usable',async()=>{
  const ui=fixture();await ui.panel.refresh();
  assert.equal(ui.button.hidden,false);assert.match(ui.text(),/75%/);assert.match(ui.text(),/사용 가능:3/);
  assert.equal(ui.all().find(n=>n.textContent==='남은 사용 한도 보기').disabled,false);
  assert.equal(ui.all().find(n=>n.tag==='progress').value,75);
  assert.equal(ui.panel.countdown(2523),'1일 18시간 3분');
  ui.language();assert.match(ui.text(),/Remaining 75%/);assert.match(ui.text(),/Shared account limits/);
});

test('reset-only view retains cards and confirmation while quota and subscription stay in the account card',async()=>{
 const ui=fixture(true);ui.setValue({...ui.value(),subscription:{source:'online',periodEndsAt:2000000000},limits:[{...ui.value().limits[0],credits:{balance:12}}]});await ui.panel.refresh();
 assert.match(ui.text(),/test@example.test/);assert.match(ui.text(),/사용 가능:3/);assert.match(ui.text(),/Test reset/);assert.match(ui.text(),/만료 기간이 제공되지 않음/);assert.equal(ui.all().find(n=>n.textContent==='초기화 정보 새로고침').disabled,false);
 assert.doesNotMatch(ui.text(),/공유 할당량|남은75%|Credits:|신청|업데이트 날짜/);assert.equal(ui.all().some(n=>n.tag==='progress'),false);
 const pending=ui.panel.redeem('card-1');assert.equal(ui.confirmButton().disabled,true);assert.equal(ui.writes.length,0);ui.confirmDialog();await pending;
 assert.equal(ui.writes.length,1);assert.equal(ui.writes[0].confirmed,true);assert.match(ui.text(),/사용 가능:2/);
 ui.language();assert.match(ui.text(),/Refresh resets/);assert.doesNotMatch(ui.text(),/Shared account limits|Subscription|Updated at:/);
});

test('reset-only view distinguishes an empty inventory from missing details and retains query errors',async()=>{
 const ui=fixture(true);ui.setValue({...ui.value(),resetCredits:{availableCount:0,credits:[]}});await ui.panel.refresh();assert.match(ui.text(),/사용량 재설정이 불가능합니다\./);
 ui.setValue({...ui.value(),resetCredits:null});await ui.panel.refresh();assert.match(ui.text(),/사용량 재설정 정보를 확인할 수 없습니다\./);assert.doesNotMatch(ui.text(),/사용량 재설정이 불가능합니다\./);
 ui.setRead(()=>{throw Error('unavailable');});await ui.panel.refresh();assert.match(ui.text(),/마지막 결과를 표시합니다\. 데이터가 업데이트되지 않았습니다/);assert.equal(ui.panel.value.canReset,false);
});

test('reset titles are localized in the list and confirmation while only the welcome message is removed',async()=>{
 for(const resetOnly of [false,true]){
  const ui=fixture(resetOnly),welcome="Thanks for using Codex! You've been granted one free rate limit reset.";
  const card={...ui.value().resetCredits.credits[0],title:'Full reset (Weekly + 5 hr)',description:welcome};
  ui.setValue({...ui.value(),resetCredits:{availableCount:1,credits:[card]}});await ui.panel.refresh();
  assert.match(ui.text(),/전체 재설정\(매주 \+ 5시간\)/);assert.doesNotMatch(ui.text(),/Full reset|Thanks for using Codex/);
  const pending=ui.panel.redeem('card-1');assert.match(ui.all(ui.body).map(n=>n.textContent).join('\n'),/전체 재설정\(매주 \+ 5시간\)/);
  ui.body.children[0].oncancel({preventDefault(){}});await pending;assert.equal(ui.writes.length,0);
  ui.setValue({...ui.value(),resetCredits:{availableCount:1,credits:[{...card,description:welcome+' Only resets Codex usage limits.'}]}});await ui.panel.refresh();
  assert.match(ui.text(),/Only resets Codex usage limits\./);assert.doesNotMatch(ui.text(),/Thanks for using Codex/);
  ui.language();assert.match(ui.text(),/Full reset \(Weekly \+ 5 hr\)/);assert.doesNotMatch(ui.text(),/Thanks for using Codex/);
 }
});

test('API login, failed auth check and logout clear all previous official data',async()=>{
  const ui=fixture();await ui.panel.refresh();
  ui.setValue({visible:false});await ui.panel.refresh();
  assert.equal(ui.button.hidden,true);assert.equal(ui.text(),'');
  ui.setRead(()=>{throw Error('unavailable');});await ui.panel.refresh();assert.equal(ui.button.hidden,true);
});

test('a delayed official-account response cannot reappear after logout',async()=>{
  const ui=fixture();let finish;ui.setRead(()=>new Promise(resolve=>finish=resolve));
  const refresh=ui.panel.refresh();ui.panel.clear();finish(ui.value());await refresh;
  assert.equal(ui.button.hidden,true);assert.equal(ui.text(),'');
});

test('signing in again starts a fresh read while an old request is still pending',async()=>{
  const ui=fixture();let finishOld,finishNew;
  ui.setRead(()=>new Promise(resolve=>finishOld=resolve));
  const old=ui.panel.refresh();ui.panel.clear();
  ui.setRead(()=>new Promise(resolve=>finishNew=resolve));
  const fresh=ui.panel.refresh();assert.equal(typeof finishNew,'function');
  finishOld(ui.value());await old;
  assert.equal(ui.button.hidden,true);assert.equal(ui.panel.loading,true);
  finishNew({...ui.value(),accountKey:'b'.repeat(64)});await fresh;
  assert.equal(ui.button.hidden,false);assert.equal(ui.panel.value.accountKey,'b'.repeat(64));
});

test('cancelling confirmation sends nothing; repeated click while pending sends once',async()=>{
  const ui=fixture();await ui.panel.refresh();ui.confirm(false);await ui.redeem('card-1');
  assert.equal(ui.writes.length,0);ui.confirm(true);
  let finish;ui.setConsume(()=>new Promise(resolve=>finish=resolve));
  const pending=ui.panel.redeem('card-1');await ui.panel.redeem('card-1');assert.equal(ui.writes.length,0);
  assert.match(ui.all(ui.body).map(n=>n.textContent).join(' '),/test@example.test.*Test reset/);
  assert.equal(ui.confirmButton().disabled,true);ui.confirmButton().onclick();assert.equal(ui.writes.length,0);
  ui.advance(4999);ui.confirmButton().onclick();assert.equal(ui.writes.length,0);
  ui.advance(1);ui.confirmButton().onclick();await Promise.resolve();assert.equal(ui.writes.length,1);
  await ui.panel.redeem('card-1');assert.equal(ui.writes.length,1);
  finish({outcome:'reset',account:{...ui.value(),resetCredits:{availableCount:2,credits:[]}}});await pending;
  assert.equal(ui.writes[0].confirmed,true);assert.match(ui.text(),/재설정이 사용되었습니다\. 사용량 한도가 새로고침되었습니다\./);assert.match(ui.text(),/사용 가능:2/);
});

test('uncertain reset retry keeps the backend persisted idempotency key',async()=>{
  const ui=fixture();await ui.panel.refresh();ui.setConsume(body=>{
    ui.setValue({...ui.value(),pendingReset:{requestId:body.requestId,accountKey:body.accountKey,creditId:body.creditId}});
    throw Error('connection lost');
  });
  await ui.redeem('card-1');assert.match(ui.text(),/동일한 요청을 다시 시도하세요\./);
  ui.setConsume(()=>({outcome:'alreadyRedeemed',account:{...ui.value(),pendingReset:null}}));
  await ui.redeem('card-1',true);
  assert.equal(ui.writes.length,2);assert.equal(ui.writes[0].requestId,ui.writes[1].requestId);
  assert.match(ui.text(),/이 재설정은 이미 완료되었습니다\. 사용량 한도가 새로고침되었습니다\./);
});

test('permission disabled, no cards and expired cards disable use without changing settings',async()=>{
  const ui=fixture();ui.setValue({...ui.value(),canReset:false});await ui.panel.refresh();
  assert.equal(ui.all().find(n=>n.textContent==='재설정 사용').disabled,true);
  await ui.redeem('card-1');assert.equal(ui.writes.length,0);
  ui.setValue({...ui.value(),canReset:true,resetCredits:{availableCount:0,credits:[]}});await ui.panel.refresh();
  assert.equal(ui.all().some(n=>n.textContent==='재설정 사용'),false);
});

test('missing count and windows show unavailable, never zero; count-only resets are supported',async()=>{
  const ui=fixture();ui.setValue({...ui.value(),limits:[{name:'Codex',windows:[{remainingPercent:null}]}],resetCredits:null});await ui.panel.refresh();
  assert.match(ui.text(),/사용할 수 없음/);assert.doesNotMatch(ui.text(),/0%|사용 가능:0/);
  ui.setValue({...ui.value(),resetCredits:{availableCount:2,credits:null}});await ui.panel.refresh();
  assert.ok(ui.all().some(n=>n.textContent==='한 번의 재설정을 사용하십시오.'));await ui.redeem(null);
  assert.equal(ui.writes[0].creditId,null);
});

test('account switching during a reset removes the old result and pending card',async()=>{
  const ui=fixture();await ui.panel.refresh();ui.setConsume(()=>({outcome:'reset',account:{...ui.value(),accountKey:'b'.repeat(64),email:'other@example.test'}}));
  await ui.redeem('card-1');assert.match(ui.text(),/other@example.test/);assert.doesNotMatch(ui.text(),/재설정이 사용되었습니다\. 사용량 한도가 새로고침되었습니다\./);
  assert.equal(ui.panel.pending,null);
});

test('refresh keeps the snapshot visible, blocks reset and retains it on query failure',async()=>{
 const ui=fixture();await ui.panel.refresh();let reject;ui.setRead(()=>new Promise((r,j)=>reject=j));const pending=ui.panel.refresh();
 assert.match(ui.text(),/확인 중…/);assert.match(ui.text(),/남은75%/);await ui.redeem('card-1');assert.equal(ui.writes.length,0);
 reject(Error('unavailable'));await pending;assert.match(ui.text(),/남은75%/);assert.match(ui.text(),/마지막 결과를 표시합니다\. 데이터가 업데이트되지 않았습니다/);assert.equal(ui.panel.value.canReset,false);
 ui.setRead(async()=>({...ui.value(),limits:[{name:'Codex',windows:[{remainingPercent:60}]}]}));await ui.panel.refresh();assert.match(ui.text(),/남은60%/);assert.doesNotMatch(ui.text(),/남은75%|마지막 결과 유지/);assert.equal(ui.panel.value.canReset,true);
});


test('expiry during the five-second confirmation prevents any consumption',async()=>{
  const ui=fixture();ui.setValue({...ui.value(),resetCredits:{availableCount:1,credits:[{...ui.value().resetCredits.credits[0],expiresAt:Date.now()/1000+3}]}});await ui.panel.refresh();
  const pending=ui.panel.redeem('card-1');ui.advance(5000);await pending;assert.equal(ui.writes.length,0);assert.equal(ui.body.children.length,0);
});
test('account change, permission loss and logout cancel an open confirmation',async()=>{
  for(const change of ['account','permission','logout']){
    const ui=fixture();await ui.panel.refresh();const pending=ui.panel.redeem('card-1');
    if(change==='logout')ui.panel.clear();else ui.panel.accept({...ui.value(),...(change==='account'?{accountKey:'b'.repeat(64)}:{canReset:false})});
    ui.advance(5000);await pending;assert.equal(ui.writes.length,0);assert.equal(ui.body.children.length,0);
  }
});
test('expired cards remain visible and cannot be redeemed, including direct invocation',async()=>{
  const ui=fixture();ui.setValue({...ui.value(),resetCredits:{availableCount:0,credits:[{...ui.value().resetCredits.credits[0],expiresAt:1}]}});await ui.panel.refresh();
  assert.ok(ui.all().find(n=>n.textContent==='만료됨')?.disabled);await ui.panel.redeem('card-1');assert.equal(ui.body.children.length,0);assert.equal(ui.writes.length,0);
});
test('an expired uncertain request can only retry its original idempotency key',async()=>{
  const ui=fixture();const pendingReset={requestId:'old-request',accountKey:ui.value().accountKey,creditId:'card-1'};
  ui.setValue({...ui.value(),pendingReset,resetCredits:{availableCount:0,credits:[{...ui.value().resetCredits.credits[0],expiresAt:1}]}});await ui.panel.refresh();
  await ui.redeem('card-1',true);assert.equal(ui.writes[0].requestId,'old-request');
});


test('login subscription dates never claim current expiry and old cached dates stay unknown',async()=>{
 const ui=fixture();
 for(const subscription of [null,{periodEndsAt:1790147934,source:'login'},{periodEndsAt:1788250708,source:'login'}]){
  ui.setValue({...ui.value(),subscription});await ui.panel.refresh();
  assert.match(ui.text(),/구독 종료 날짜가 확인되지 않았습니다\./);assert.doesNotMatch(ui.text(),/현재 구독 기간|기록 날짜 도달|다음 이후에 종료/);
 }
 ui.setValue({...ui.value(),subscription:{periodEndsAt:Date.now()/1000+86400,source:'login'}});await ui.panel.refresh();
 assert.match(ui.text(),/로그인 기록의 구독 날짜\(실시간 아님\):/);assert.match(ui.text(),/(?:온라인에서 검색된 날짜입니다\. 갱신 및 청구 상태는 ChatGPT 구독 페이지를 확인하세요\.|로그인 기록이 오래되었을 수 있습니다\. ChatGPT 구독 페이지를 참조하세요\.)/);
 assert.doesNotMatch(ui.text(),/현재 구독 기간|다음 이후에 종료/);
 ui.advance(86401000);ui.panel.render();assert.match(ui.text(),/구독 종료 날짜가 확인되지 않았습니다\./);
 ui.language();assert.match(ui.text(),/Subscription end date is unconfirmed/);assert.match(ui.text(),/ChatGPT subscription page/);
});


test('online subscription date is distinct from stale login and failure is not expiry',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),subscription:{periodEndsAt:2000000000,source:'online'}});await ui.panel.refresh();
 assert.match(ui.text(),/구독 기간 종료일:/);assert.doesNotMatch(ui.text(),/로그인 기록의 구독 날짜/);
 ui.setValue({...ui.value(),subscription:{periodEndsAt:null,source:'online',error:'구독 세부정보를 확인할 수 없습니다. 나중에 다시 새로고침하세요.'}});await ui.panel.refresh();
 assert.match(ui.text(),/구독 종료 날짜가 확인되지 않았습니다\./);assert.doesNotMatch(ui.text(),/만료됨/);ui.language();assert.match(ui.text(),/Subscription details are unavailable/);
});
