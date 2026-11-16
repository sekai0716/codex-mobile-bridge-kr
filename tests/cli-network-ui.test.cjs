'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.parent=null;this._text='';this.dataset={};this.attributes={};this.disabled=false;this.open=false;this.style={setProperty(){},removeProperty(){}};this.className='';this.events={};this.classList={add:(...names)=>this.className+=' '+names.join(' '),remove:(...names)=>this.className=this.className.split(' ').filter(name=>!names.includes(name)).join(' '),contains:name=>this.className.split(' ').includes(name)};}
  set textContent(value){this._text=String(value??'');this.children=[];}get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}replaceChildren(...nodes){this.children.forEach(node=>node.parent=null);this.children=[];this._text='';this.append(...nodes);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  get isConnected(){return !!this.parent;}setAttribute(key,value){this.attributes[key]=value;}addEventListener(name,fn){this.events[name]=fn;}removeEventListener(){}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}focus(){}getBoundingClientRect(){return {left:0,bottom:0};}
  querySelectorAll(selector){const match=node=>selector.split(',').some(part=>part.trim().startsWith('.')?node.className.includes(part.trim().slice(1).split(':')[0]):node.tag===part.trim());return this.children.flatMap(node=>[...(match(node)?[node]:[]),...node.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 }
 const body=new Node('body'),calls=[],timers=new Map();let timerId=0,ids=0,current=true,handler=async()=>({canRecover:false,message:'Healthy'});
 const context=vm.createContext({document:{body,hidden:false,createElement:tag=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),addEventListener(){}},window:{addEventListener(){},matchMedia:()=>({matches:true})},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('web/features/chat/session-menu.js','utf8'),context);const Menu=vm.runInContext('SessionMenu',context),menu=new Menu({newId:()=>`00000000-0000-4000-8000-${String(++ids).padStart(12,'0')}`});
 const session={title:'Local CLI',pin(){},isCurrent:()=>current,cliNetwork:body=>{calls.push(body===undefined?undefined:JSON.parse(JSON.stringify(body)));return handler(body);}};
 const open=()=>menu.show(session,{}),find=label=>menu.box?.querySelectorAll('button').find(button=>button.textContent===label||button.attributes['aria-label']===label),click=label=>{const button=find(label);assert.ok(button,'Missing '+label);assert.equal(button.disabled,false,label+' must be enabled');return button.onclick();};
 open();return {menu,calls,timers,open,find,click,session,setHandler:fn=>handler=fn,invalidate:()=>current=false,text:()=>menu.box?.textContent||'',settle:()=>new Promise(setImmediate)};
}
test('CLI network inspection stays in its panel and waits or cancels only after explicit actions',async()=>{
 const ui=fixture();ui.setHandler(async body=>!body?{canRecover:true,willWait:true,generation:'preview',message:'Proxy changed'}:body.action==='cancel'?{state:'cancelled',operationId:'wait-op',message:'Cancelled by backend',canCancel:false}:{state:'waiting',operationId:'wait-op',message:'Native task pending',canCancel:true});
 await ui.click('CLI 네트워크 확인');assert.match(ui.text(),/Proxy changed/);assert.equal(ui.calls.length,1);await ui.click('작업 완료 후 복구…');assert.equal(ui.calls.length,1);await ui.click('결과로 돌아가기');assert.equal(ui.calls.length,1);
 await ui.click('작업 완료 후 복구…');await ui.click('다시 덮다');assert.deepEqual(ui.calls[1],{confirmed:true,generation:'preview'});assert.match(ui.text(),/Native task pending/);assert.ok([...ui.timers.values()].some(timer=>timer.ms===5000));
 await ui.click('작업 결과 확인');assert.deepEqual(ui.calls[2],{action:'status',operationId:'wait-op'});await ui.click('취소 대기');assert.deepEqual(ui.calls[3],{action:'cancel',operationId:'wait-op'});assert.match(ui.text(),/Cancelled by backend/);assert.equal(ui.find('취소 대기'),undefined);assert.equal(ui.timers.size,0);
});
test('CLI force binds full preview scope and generation and never dispatches from inspection or cancel',async()=>{
 const ui=fixture();let previews=0,finish;
 ui.setHandler(async body=>!body?{canRecover:false,message:'Task state unknown'}:body.action==='forcePreview'?{canForce:true,generation:'scope-'+ ++previews,operationId:null,scopeLabel:'Local · /fixture/.codex',impact:[{sessionId:'original'},{sessionId:'other'}],message:'Shared native service'}:new Promise(resolve=>finish=resolve));
 await ui.click('CLI 네트워크 확인');await ui.click('강제 복구 범위 검토…');assert.equal(ui.calls.length,2);assert.match(ui.text(),/\/fixture\/\.codex/);assert.match(ui.text(),/original/);assert.match(ui.text(),/other/);assert.match(ui.text(),/이는 나열되지 않은 세션을 포함하여 이 구성에서 실행 중이거나 확인되지 않은 작업을 중단합니다\. 저장된 채팅 기록은 보존됩니다\./);await ui.click('결과로 돌아가기');assert.equal(ui.calls.length,2);
 await ui.click('강제 복구 범위 검토…');const confirm=ui.find('강제 회복'),pending=confirm.onclick();confirm.onclick();assert.equal(ui.calls.length,4);assert.deepEqual(ui.calls[3],{action:'force',confirmed:true,generation:'scope-2',operationId:null,requestId:'00000000-0000-4000-8000-000000000001'});assert.equal(ui.find('닫기').disabled,false);assert.equal(ui.find('채팅 메뉴로 돌아가기').disabled,false);
 finish({status:'unknown',operationId:ui.calls[3].requestId,notice:'Unconfirmed native receipt'});await pending;assert.match(ui.text(),/Unconfirmed native receipt/);assert.ok(ui.find('작업 결과 확인'));assert.equal(ui.timers.size,0);
});
test('CLI reconnect uses the saved-state preview and a new explicit request without old settings or messages',async()=>{
 const ui=fixture();ui.setHandler(async body=>!body?{canRecover:true,action:'reconnect',generation:'saved-generation',message:'Previous resume unknown'}:{status:'recovered',connected:true,notice:'Connected from saved state'});
 await ui.click('CLI 네트워크 확인');await ui.click('저장된 상태에서 다시 연결…');assert.equal(ui.calls.length,1);assert.match(ui.text(),/이전 이력서 접수는 미확인 상태로 남아있습니다\. 이전 공급자 설정이나 메시지는 재생되지 않습니다\./);await ui.click('다시 연결');assert.deepEqual(ui.calls[1],{action:'reconnect',confirmed:true,generation:'saved-generation',requestId:'00000000-0000-4000-8000-000000000001'});assert.match(ui.text(),/Connected from saved state/);
});
test('immediate CLI recovery displays the backend connected result without implying unconfirmed success',async()=>{
 for(const connected of [true,false]){
  const ui=fixture();ui.setHandler(async body=>!body?{canRecover:true,generation:'immediate'}:{connected});await ui.click('CLI 네트워크 확인');await ui.click('CLI 연결 복구…');await ui.click('다시 덮다');assert.deepEqual(ui.calls[1],{confirmed:true,generation:'immediate'});
  if(connected)assert.match(ui.text(),/CLI 연결이 복원되었습니다\./);else{assert.match(ui.text(),/CLI 연결이 확인되지 않았습니다\. 원래 채팅을 계속하거나 다시 확인하세요\./);assert.doesNotMatch(ui.text(),/CLI 연결이 복원되었습니다\./);}assert.equal(ui.calls.length,2);
 }
});
test('pending CLI reads and writes keep close and Back enabled and late replies cannot replace another view',async()=>{
 const ui=fixture();let finish;ui.setHandler(()=>new Promise(resolve=>finish=resolve));const pending=ui.click('CLI 네트워크 확인');assert.equal(ui.find('닫기').disabled,false);await ui.click('채팅 메뉴로 돌아가기');assert.equal(ui.menu.view,'main');finish({canRecover:true,message:'Late old network'});await pending;assert.doesNotMatch(ui.text(),/Late old network/);
 const second=ui.click('CLI 네트워크 확인');ui.click('닫기');assert.equal(ui.menu.box,null);finish({message:'Late dismissed network'});await second;assert.equal(ui.menu.box,null);assert.equal(ui.calls.length,2);
 const writing=fixture();let finishWrite;writing.setHandler(async body=>!body?{message:'Current'}:body.action==='forcePreview'?{canForce:true,generation:'exact-generation',operationId:'wait',scopeLabel:'Local home',impact:[{sessionId:'original'}]}:new Promise(resolve=>finishWrite=resolve));
 await writing.click('CLI 네트워크 확인');await writing.click('강제 복구 범위 검토…');const force=writing.click('강제 회복');await writing.click('채팅 메뉴로 돌아가기');writing.menu.show({title:'Another session',pin(){},cliNetwork:async()=>({message:'New current result'})},{});await writing.click('CLI 네트워크 확인');finishWrite({notice:'Late force receipt'});await force;assert.match(writing.text(),/New current result/);assert.doesNotMatch(writing.text(),/Late force receipt/);assert.equal(writing.calls.filter(body=>body?.action==='force').length,1);assert.equal(writing.calls.some(body=>body?.action==='cancel'),false);
});
test('unknown force transport keeps its original operation ID for status checks and never retries the write',async()=>{
 const ui=fixture();ui.setHandler(async body=>!body?{message:'Unknown tasks'}:body.action==='forcePreview'?{canForce:true,generation:'force-generation',operationId:'old-wait',scopeLabel:'Local · home',impact:[{sessionId:'native'}]}:body.action==='force'?Promise.reject(Error('Transport lost')):{state:'unknown',message:'Native receipt still unknown',operationId:body.operationId});
 await ui.click('CLI 네트워크 확인');await ui.click('강제 복구 범위 검토…');await ui.click('강제 회복');assert.match(ui.text(),/요청 결과가 확인되지 않았습니다\. 자동으로 재시도하지 않습니다\. 작업 결과를 확인하거나 네트워크를 다시 확인하십시오\./);await ui.click('작업 결과 확인');assert.deepEqual(ui.calls.at(-1),{action:'status',operationId:'00000000-0000-4000-8000-000000000001'});assert.equal(ui.calls.filter(body=>body?.action==='force').length,1);
});
test('failed cancellation and unsupported force preview remain truthful and stale identity cannot dispatch',async()=>{
 const ui=fixture();ui.setHandler(async body=>!body?{state:'waiting',operationId:'wait',canCancel:true,message:'Still waiting'}:body.action==='cancel'?Promise.reject(Error('Cancellation not accepted')):{canForce:false,message:'Native process identity unavailable'});
 await ui.click('CLI 네트워크 확인');await ui.click('취소 대기');assert.match(ui.text(),/Cancellation not accepted/);assert.doesNotMatch(ui.text(),/대기 취소됨/);await ui.click('강제 복구 범위 검토…');assert.match(ui.text(),/Native process identity unavailable/);assert.equal(ui.find('강제 회복'),undefined);const count=ui.calls.length;ui.invalidate();await ui.click('네트워크를 다시 확인하세요.');assert.equal(ui.calls.length,count);
});
