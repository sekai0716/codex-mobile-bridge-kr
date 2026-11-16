'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(desktop=false){
  function node(tag){return {tag,textContent:'',value:'',hidden:false,disabled:false,scrollTop:0,children:[],attributes:{},classList:{add(){}},
    append(...children){for(const child of children){child.remove();child.parent=this;child.parentNode=this;this.children.push(child);}},insertBefore(child,before){child.remove();const index=before?this.children.indexOf(before):-1;child.parent=this;child.parentNode=this;this.children.splice(index<0?this.children.length:index,0,child);},replaceChildren(...children){for(const child of [...this.children])child.remove();this.append(...children);if(this.className==='accounts-models')this.scrollTop=0;},setAttribute(k,v){this.attributes[k]=v;},closest(){return null;},reset(){},get isConnected(){for(let parent=this;parent;parent=parent.parent)if(parent===root)return true;return false;},focus(){context.document.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;this.parentNode=null;}}};}
  const root=node('div'),requests=[],prompts=[],listeners=new Map();let confirmed=true,value={accounts:[{id:'a',name:'API <script>',kind:'api',baseUrl:'https://example.test/v1',model:'model'}],activeId:null,switch:{phase:'idle'},canSwitch:true},configHidden=false,ancestorHidden=false;
  root.closest=selector=>selector==='[hidden],.client-config-hidden'&&(configHidden||ancestorHidden)?root:null;
  let request=async()=>structuredClone(value),read=async()=>structuredClone(value),readCalls=0,timers=[],now=Date.now();
  class Clock extends Date{static now(){return now;}}
  const context=vm.createContext({document:{createElement:node,body:node('body'),hidden:false,activeElement:null,addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn])},root,Date:Clock,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cancelled=true;},localStorage:{getItem(){return null;},setItem(){}},window:{confirm:message=>{prompts.push(message);return confirmed;},prompt:()=>null}});
  for(const f of ['web/shared/i18n.js','web/features/accounts/account.js','web/features/accounts/api-editor.js','web/features/accounts/accounts.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
  const Class=vm.runInContext('AccountsPanel',context),panel=new Class({root,desktop,read:force=>{readCalls++;return read(force);},request:v=>{requests.push(v);return request(v);}});
  const all=(n=root)=>[n,...n.children.flatMap(all)];
  return {panel,root,requests,prompts,all,timers,readCalls:()=>readCalls,focus:node=>context.document.activeElement=node,blur:()=>context.document.activeElement=context.document.body,active:()=>context.document.activeElement,now:()=>now,advance:ms=>now+=ms,hidden:value=>{context.document.hidden=value;for(const fn of listeners.get('visibilitychange')||[])fn();},configHidden:value=>{configHidden=value;for(const fn of listeners.get('bridge-client-config')||[])fn();},ancestorHidden:value=>{ancestorHidden=value;},fireTimer:async ms=>{const timer=timers.find(row=>!row.cancelled&&row.ms===ms);assert.ok(timer,`expected ${ms}ms timer`);timer.cancelled=true;await timer.fn();},noRandomUUID:()=>{context.crypto={getRandomValues:bytes=>require("node:crypto").randomFillSync(bytes)};},text:()=>all().map(n=>n.textContent).join('\n'),setValue:v=>value=v,value:()=>value,setRequest:v=>request=v,setRead:v=>read=v,confirm:v=>confirmed=v,
    language:()=>{vm.runInContext("BridgeI18n.setLanguage('en')",context);panel.render();}};
}
test('native login card survives an empty saved list without enrollment or switching actions',async()=>{
 const ui=fixture(),login={id:'current-login',kind:'chatgpt',name:'ChatGPT',email:'current@example.test',transient:true,details:{usage:{status:'ready',checkedAt:ui.now()/1000,limits:[],resetCredits:{availableCount:2}}}};
 ui.panel.onReset=()=>{};
 ui.setValue({...ui.value(),accounts:[],loginAccount:login,current:{status:'ready',kind:'api',name:'API · custom'}});
 await ui.panel.refresh();
 assert.match(ui.text(),/current@example.test/);assert.match(ui.text(),/로그인됨/);assert.match(ui.text(),/2개 사용 가능/);
 assert.equal(ui.all().filter(n=>n.tag==='section'&&n.className==='account-bucket').length,1);
 assert.equal(ui.all().some(n=>['이 계정으로 전환','삭제','편집'].includes(n.textContent)),false);
 assert.ok(ui.all().find(n=>n.tag==='button'&&n.textContent==='재설정 사용'));
 const modelsButton=ui.all().find(n=>n.textContent==='사용 가능한 모델 보기');assert.equal(modelsButton.parent.className,'accounts-card-footer');
 ui.panel.accept({...ui.value(),accounts:[{...login,transient:false}],loginAccount:{...login,transient:false}});
 assert.equal(ui.all().filter(n=>n.tag==='section'&&n.className==='account-bucket').length,1);
});

test('web exposes saved account selection without enrollment or credential inputs',async()=>{
 const ui=fixture();await ui.panel.refresh();assert.equal(ui.all().some(n=>n.tag==='input'&&n.type!=='checkbox'),false);assert.match(ui.text(),/API <script>/);assert.equal(ui.all().some(n=>n.tag==='script'),false);
 ui.confirm(false);await ui.panel.choose(ui.value().accounts[0]);assert.equal(ui.requests.length,0);
 ui.confirm(true);await ui.panel.choose(ui.value().accounts[0]);assert.deepEqual(Object.keys(ui.requests[0]).sort(),['action','confirmed','id','requestId','syncLocalCli','tasksConfirmed']);
 assert.equal(ui.requests[0].tasksConfirmed,true);assert.match(ui.prompts[0],/모든 작업\(이 웹 페이지에 표시되지 않는 작업 포함\)이 끝났는지 확인하고 공유 Codex 접속 설정을 전환하시겠습니까\? 전환이 끝나기 전까지 다른 클라이언트에서 작업을 시작하지 마세요\. 필요한 경우에만 데스크톱 런타임을 정상 종료 후 다시 시작합니다\./);
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} retries the selected offline SSH host from accounts`,async()=>{
 const ui=fixture(desktop);ui.setValue({...ui.value(),sshHosts:[{host:'remote:one',label:'Offline server',state:'offline',nextRetryAt:ui.now()/1000+60}]});await ui.panel.refresh();
 assert.match(ui.text(),/SSH 연결 목록/);assert.match(ui.text(),/다음 자동 재시도:/);
 await ui.all().find(n=>n.textContent==='SSH 연결 재시도').onclick();
 assert.deepEqual({...ui.requests[0]},{action:'retrySsh',host:'remote:one'});
 ui.panel.accept({...ui.value(),sshHosts:[{host:'remote:one',label:'Offline server',state:'checking'}]});
 assert.equal(ui.all().find(n=>n.textContent==='SSH 연결 재시도').disabled,true);
 ui.panel.clear();assert.equal(ui.panel.sshHosts.hidden,true);assert.equal(ui.panel.sshHosts.children.length,0);
});
test('Codex switch always requests CLI verification without an opt-in checkbox',async()=>{
 const ui=fixture();await ui.panel.refresh();
 assert.match(ui.text(),/Codex 데스크톱 및 CLI는 이 컴퓨터에 대한 액세스를 공유합니다\. 전환하면 Desktop이 실행 중일 때 다시 시작됩니다\./);
 assert.equal(ui.all().some(n=>n.textContent==='로컬 CLI에도 적용'),false);
 await ui.panel.choose(ui.value().accounts[0]);assert.equal(ui.requests[0].syncLocalCli,true);
});


for(const desktop of [false,true])test(`${desktop?'desktop':'web'} merges imported login and keeps other official accounts and API cards separate`,async()=>{
 const ui=fixture(desktop),usage={status:'ready',checkedAt:ui.now()/1000,limits:[{name:'Codex',windows:[{remainingPercent:75,windowDurationMins:300}]}],resetCredits:{availableCount:2}};
 const login={id:'one',kind:'chatgpt',name:'My login',email:'same@example.test',accountKey:'a'.repeat(64),details:{usage}};
 const other={id:'two',kind:'chatgpt',name:'Other workspace',email:login.email,details:{usage}};
 const api={id:'api',kind:'api',name:'Current API',baseUrl:'https://fixture.test/v1',model:'routed'};
 ui.panel.onReset=()=>{};
 ui.panel.accept({...ui.value(),accounts:[other,api,login],loginAccount:login,activeId:api.id,current:{kind:'api',id:api.id,status:'ready',name:api.name}});
 const cards=ui.panel.rows.children.filter(n=>n.className==='account-bucket');
 assert.equal(cards.length,3);assert.equal(ui.all(cards[0]).find(n=>n.tag==='h3').textContent,login.name);
 assert.equal(ui.all().filter(n=>n.textContent==='로그인됨').length,1);
 assert.equal(ui.all().filter(n=>n.textContent==='현재 계정').length,1);
 assert.equal(ui.all().filter(n=>n.tag==='progress').length,2);
 assert.equal(ui.all().filter(n=>n.tag==='button'&&n.textContent==='재설정 사용').length,2);
 const transient={...login,id:'current-login',transient:true};
 ui.panel.accept({...ui.value(),accounts:[],activeId:null,loginAccount:transient});
 assert.equal(ui.panel.rows.children.filter(n=>n.className==='account-bucket').length,1);
 assert.equal(ui.all().some(n=>['이 계정으로 전환','현재 계정'].includes(n.textContent)),false);
});
test('passwordless web disables switching and explains the desktop alternative',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),canSwitch:false});await ui.panel.refresh();
 assert.equal(ui.all().find(n=>n.textContent==='이 계정으로 전환').disabled,true);assert.match(ui.text(),/인증 없이는 계정 전환이 불가능합니다\. 데스크톱 앱을 사용하세요\./);
});
for(const desktop of [false,true])test(`${desktop?'desktop':'web'} explicitly initializes the shared native connection`,async()=>{
 const ui=fixture(desktop);ui.setValue({...ui.value(),desktopRuntime:{supported:true,configured:false}});await ui.panel.refresh();
 assert.equal(ui.panel.desktopRuntime.hidden,false);assert.equal(ui.panel.initializeRuntime.disabled,false);
 ui.confirm(false);await ui.panel.initializeRuntime.onclick();assert.equal(ui.requests.length,0);
 ui.confirm(true);await ui.panel.initializeRuntime.onclick();assert.deepEqual({...ui.requests[0]},{action:'initializeDesktopRuntime',requestId:'11111111-1111-4111-8111-111111111111',confirmed:true,tasksConfirmed:true});
 ui.panel.accept({...ui.value(),desktopRuntime:{supported:true,configured:true},switch:{phase:'verifying',operation:'desktopRuntime'}});
 assert.equal(ui.panel.initializeRuntime.disabled,true);assert.match(ui.panel.status.textContent,/네이티브 연결 확인 중/);
 ui.panel.accept({...ui.value(),desktopRuntime:{supported:true,configured:true},switch:{phase:'failed',operation:'desktopRuntime',error:'test failure'}});
 assert.equal(ui.panel.initializeRuntime.disabled,false);assert.equal(ui.panel.initializeRuntime.textContent,'다시 연결 준비');assert.match(ui.panel.status.textContent,/네이티브 연결 초기화를 완료하지 못했습니다\./);
 ui.panel.accept({...ui.value(),scope:'profile'});assert.equal(ui.panel.desktopRuntime.hidden,true);
 ui.panel.clear();assert.equal(ui.panel.desktopRuntime.hidden,true);
});
test('native initialization remains unavailable for passwordless remote access',async()=>{
 const ui=fixture();ui.panel.accept({...ui.value(),canSwitch:false,desktopRuntime:{supported:true,configured:false}});assert.equal(ui.panel.initializeRuntime.disabled,true);
 ui.panel.accept({...ui.value(),desktopRuntime:{supported:false}});assert.equal(ui.panel.desktopRuntime.hidden,true);
});
test('automatic native preparation stays passive and offers unknown-task recovery',()=>{
 const ui=fixture();ui.panel.accept({...ui.value(),desktopRuntime:{supported:true,preparation:{state:'checking'}}});
 assert.match(ui.panel.runtimeStatus.textContent,/자동 확인/);assert.equal(ui.requests.length,0);
 ui.panel.accept({...ui.value(),desktopRuntime:{supported:true,preparation:{state:'waiting',taskStateUnavailable:true}}});
 assert.match(ui.panel.runtimeStatus.textContent,/데스크톱이 사용 가능해지면 자동으로 준비합니다\. 기존 채팅은 계속 사용할 수 있습니다/);assert.equal(ui.panel.forceInitializeRuntime.hidden,false);
 ui.panel.accept({...ui.value(),desktopRuntime:{supported:true,configured:true,preparation:{state:'ready'}}});
 assert.match(ui.panel.runtimeStatus.textContent,/기본 사이드 채팅 연결이 준비되었습니다\./);assert.equal(ui.panel.forceInitializeRuntime.hidden,true);
 assert.equal(ui.requests.length,0);
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} offers a confirmed retry only for unavailable native task state`,async()=>{
 const ui=fixture(desktop),state={...ui.value(),desktopRuntime:{supported:true},switch:{phase:'failed',operation:'desktopRuntime',taskStateUnavailable:true}};
 ui.panel.accept(state);assert.equal(ui.panel.forceInitializeRuntime.hidden,false);assert.equal(ui.panel.forceInitializeRuntime.disabled,false);
 ui.confirm(false);await ui.panel.forceInitializeRuntime.onclick();assert.equal(ui.requests.length,0);
 ui.confirm(true);await ui.panel.forceInitializeRuntime.onclick();assert.equal(ui.requests[0].acknowledgeUnavailable,true);assert.match(ui.prompts[0],/일부 작업 상태를 확인하지 못했습니다\. 계속하면 Codex 앱이 정상 종료 후 재시작되며, 해당 작업이나 대기 중인 승인이 중단될 수 있습니다\. 채팅 기록은 보존되며 나중에 이어갈 수 있습니다\. 계속하시겠습니까\?/);
 ui.panel.accept({...state,switch:{phase:'failed',operation:'desktopRuntime',error:'known busy'}});assert.equal(ui.panel.forceInitializeRuntime.hidden,true);
 ui.panel.accept({...state,switch:{...state.switch,phase:'verifying'}});assert.equal(ui.panel.forceInitializeRuntime.hidden,true);
 if(!desktop){ui.panel.accept({...state,canSwitch:false});assert.equal(ui.panel.forceInitializeRuntime.disabled,true);}
 ui.panel.accept({...state,management:{external:true}});assert.equal(ui.panel.forceInitializeRuntime.disabled,true);
});

test('external Magpie management disables configuration replacement on both surfaces',async()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop);ui.setValue({...ui.value(),management:{mode:'auto',external:true,reason:'의존하다 Magpie 관리하다'}});await ui.panel.refresh();
  assert.equal(ui.all().find(n=>n.textContent==='이 계정으로 전환').disabled,true);assert.match(ui.text(),/의존하다 Magpie 관리/);
  if(desktop){assert.equal(ui.panel.recover.disabled,true);assert.equal(ui.panel.managementMode.value,'auto');}
 }
});
test('switch phases disable repeat actions and recovery only exists on desktop',async()=>{
 const ui=fixture(true);ui.setValue({...ui.value(),switch:{phase:'verifying'}});await ui.panel.refresh();
 assert.equal(ui.all().find(n=>n.textContent==='이 계정으로 전환').disabled,true);assert.equal(ui.panel.submit.disabled,true);assert.equal(ui.panel.recover.disabled,true);
 ui.setValue({...ui.value(),switch:{phase:'interrupted'}});await ui.panel.refresh();assert.equal(ui.panel.recover.disabled,false);
});
test('desktop masks API keys and never prepopulates a saved key',async()=>{
 const ui=fixture(true);await ui.panel.refresh();assert.equal(ui.panel.key.input.type,'password');
 ui.all().find(n=>n.textContent==='편집').onclick();assert.equal(ui.panel.key.input.value,'');assert.equal(ui.panel.url.input.value,'https://example.test/v1');
});
test('official login is opened by trusted desktop IPC, not arbitrary browser navigation',async()=>{
 const ui=fixture(true);ui.setValue({...ui.value(),enrollment:{phase:'waiting',authUrl:'https://auth.openai.com/authorize?fixture=1'}});await ui.panel.refresh();
 assert.equal(ui.all().some(n=>n.tag==='a'),false);await ui.all().find(n=>n.textContent==='공식 로그인 열기').onclick();assert.equal(ui.requests[0].action,'openLogin');
});
test('desktop renames through an inline form without unsupported native prompts',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.all().find(n=>n.textContent==='이름 바꾸기').onclick();
 assert.equal(ui.panel.renameForm.hidden,false);assert.equal(ui.panel.renameName.input.value,'API <script>');
 ui.panel.renameName.input.value='New name';await ui.panel.renameForm.onsubmit({preventDefault(){}});
 assert.equal(ui.requests[0].action,'rename');assert.equal(ui.requests[0].name,'New name');assert.equal(ui.panel.renameForm.hidden,true);
});
test('late response cannot refill the account selector after logout',async()=>{
 const ui=fixture();let finish;ui.setRead(()=>new Promise(r=>finish=r));const p=ui.panel.refresh();ui.panel.clear();finish(ui.value());await p;assert.equal(ui.panel.value,null);assert.equal(ui.panel.rows.children.length,0);
});
test('English dynamic states retain account names',async()=>{
 const ui=fixture();await ui.panel.refresh();ui.language();assert.match(ui.text(),/Choose a saved account/);assert.match(ui.text(),/API <script>/);
});
test('a read started before an account mutation cannot resurrect a deleted row',async()=>{
 const ui=fixture(true);await ui.panel.refresh();let finish;
 ui.setRead(()=>new Promise(r=>finish=r));const stale=ui.panel.refresh();
 ui.setRequest(async()=>({...ui.value(),accounts:[]}));await ui.panel.perform({action:'delete',id:'a'});
 finish(ui.value());await stale;assert.equal(ui.panel.value.accounts.length,0);
});
test('desktop scanner imports official logins without displaying credentials',async()=>{
 const ui=fixture(true);ui.setValue({...ui.value(),discovery:{source:'/fixture/home',candidates:[{id:'official',kind:'chatgpt',name:'Local login',canImport:true}]}});await ui.panel.refresh();
 await ui.all().find(n=>n.textContent==='계정 가져오기').onclick();assert.equal(ui.requests[0].action,'import');assert.equal(ui.requests[0].candidateId,'official');
 assert.equal(ui.requests[0].apiKey,undefined);
});
test('scanned APIs fetch models using opaque candidate IDs and import the selected model',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.panel.importCandidate({id:'candidate',kind:'api',name:'Local API',baseUrl:'https://example.test/v1',model:''});
 assert.equal(ui.panel.key.input.disabled,true);assert.equal(ui.panel.key.input.value,'');
 ui.setRequest(async()=>({...ui.value(),models:['model-one','model-two']}));await ui.panel.modelsButton.onclick();
 assert.equal(ui.requests[0].candidateId,'candidate');assert.equal(ui.requests[0].apiKey,undefined);assert.equal(ui.panel.modelOptions.hidden,false);assert.equal(ui.panel.model.input.value,'model-one');
 ui.panel.modelOptions.value='model-two';ui.panel.modelOptions.onchange();await ui.panel.form.onsubmit({preventDefault(){}});
 assert.equal(ui.requests[1].action,'import');assert.equal(ui.requests[1].model,'model-two');assert.equal(ui.requests[1].candidateId,'candidate');
});
test('scan then save reuses candidate import and never changes the active configuration directory',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.panel.scanSource.input.value='/fixture/.codex-custom';
 assert.equal(ui.panel.saveScanButton.disabled,true);
 ui.setRequest(async request=>({...ui.value(),discovery:{source:'/fixture/.codex-custom',candidates:[{id:'official',kind:'chatgpt',name:'Login',canImport:true,imported:request.action==='import'}]}}));
 await ui.panel.scanButton.onclick();assert.equal(ui.panel.saveScanButton.disabled,false);await ui.panel.saveScanButton.onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(ui.requests)),[{action:'scan',source:'/fixture/.codex-custom'},{action:'import',candidateId:'official'}]);assert.equal(ui.panel.saveScanButton.disabled,true);
 ui.panel.scanSource.input.value='/fixture/other';ui.panel.scanSource.input.oninput();assert.equal(ui.panel.saveScanButton.disabled,true);
});
test('multiple scan results require selection and API save keeps existing model validation',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.setRequest(async()=>({...ui.value(),discovery:{candidates:[{id:'one',kind:'chatgpt',name:'Login',canImport:true},{id:'two',kind:'api',name:'API',baseUrl:'https://fixture.test/v1',canImport:true}]}}));
 await ui.panel.scanButton.onclick();assert.equal(ui.panel.saveScanButton.disabled,true);assert.equal(ui.panel.scanChoice.hidden,false);
 ui.panel.scanChoice.value='two';ui.panel.scanChoice.onchange();assert.equal(ui.panel.saveScanButton.disabled,false);await ui.panel.saveScanButton.onclick();
 assert.equal(ui.requests.length,1);assert.equal(ui.panel.importId,'two');assert.equal(ui.panel.addDetails.open,true);assert.equal(ui.panel.key.input.disabled,true);assert.equal(ui.panel.model.input.value,'');
 ui.panel.clear();assert.equal(ui.panel.scanSelection,'');
});
test('a delayed model response does not refill a changed API form',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.panel.kind.value='api';ui.panel.url.input.value='https://first.test/v1';ui.panel.key.input.value='fixture-key';
 let finish;ui.setRequest(()=>new Promise(r=>finish=r));const pending=ui.panel.modelsButton.onclick();ui.panel.url.input.value='https://second.test/v1';ui.panel.url.input.oninput();
 finish({...ui.value(),models:['old-provider-model']});await pending;assert.equal(ui.panel.modelOptions.hidden,true);
});
test('model-fetch errors remain visible after status refresh and manual entry stays available',async()=>{
 const ui=fixture(true);await ui.panel.refresh();ui.panel.kind.value='api';ui.panel.kind.onchange();ui.setRequest(async()=>{throw Error('액세스가 거부되었습니다. API 키 및 모델 목록 권한을 확인하세요.');});
 await ui.panel.modelsButton.onclick();await ui.panel.refresh();assert.match(ui.panel.error.textContent,/액세스가 거부되었습니다\. API 키 및 모델 목록 권한을 확인하세요\./);assert.equal(ui.panel.model.wrap.hidden,false);
});
test('LAN HTTP switching works without crypto.randomUUID and reports failures',async()=>{
 const ui=fixture();await ui.panel.refresh();ui.noRandomUUID();
 ui.setRequest(async()=>{throw Error("Error invoking remote method 'bridge:accounts': Error: task blocked");});
 await ui.panel.choose(ui.value().accounts[0]);assert.equal(ui.requests.length,1);assert.match(ui.requests[0].requestId,/^[0-9a-f-]{36}$/);
 assert.equal(ui.panel.error.textContent,'task blocked');
});
test('actual current account is named and cannot be selected again',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),activeId:'a',current:{status:'ready',id:'a',kind:'api',name:'Imported current'}});await ui.panel.refresh();
 assert.match(ui.panel.current.textContent,/Imported current/);assert.equal(ui.all().find(n=>n.textContent==='현재 계정').disabled,true);
});
test('official rows show compact quota and reset count, while API rows only offer models',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),accounts:[...ui.value().accounts,{id:'official',kind:'chatgpt',name:'Official',details:{usage:{status:'ready',checkedAt:Date.now()/1000,limits:[{name:'Codex',windows:[{remainingPercent:75,windowDurationMins:300}]}],resetCredits:{availableCount:2}},models:{status:'ready',models:[{id:'model-1',name:'Model one'}]}}}]});
 await ui.panel.refresh();assert.match(ui.text(),/남은75%/);assert.match(ui.text(),/사용량 재설정 · 2/);assert.equal(ui.all().filter(n=>n.tag==='progress').length,1);
 assert.equal(ui.all().filter(n=>n.textContent==='사용 가능한 모델 보기').length,2);
 ui.panel.expandedModels.add('official');ui.panel.render();assert.match(ui.text(),/Model one · model-1/);
});
test('blockers show the concrete running or pending chat instead of a generic warning',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),blockers:[{reason:'approval',title:'Review fixture'}]});await ui.panel.refresh();assert.match(ui.text(),/Review fixture/);
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} automatically loads initial quota and restarts five minutes after a manual query`,async()=>{
 const ui=fixture(desktop),official={id:'official',kind:'chatgpt',name:'Official'};
 ui.setValue({...ui.value(),activeId:'official',accounts:[...ui.value().accounts,official]});
 ui.setRequest(async()=>{official.details={usage:{status:'ready',checkedAt:ui.now()/1000,limits:[]}};return structuredClone(ui.value());});
 ui.ancestorHidden(true);
 await ui.panel.refresh();assert.equal(ui.requests.length,0);
 ui.ancestorHidden(false);await ui.panel.refresh();assert.equal(ui.requests.length,1);
 assert.equal(ui.requests[0].section,'usage');assert.equal(ui.requests[0].id,'official');
 assert.equal(ui.all(ui.panel.rows.children[0]).find(n=>n.tag==='h3').textContent,'Official');
 assert.equal(ui.all(ui.panel.rows.children[0]).find(n=>n.textContent==='현재 계정').disabled,true);
 ui.advance(120000);await ui.panel.refresh();assert.equal(ui.requests.length,1);
 await ui.all().find(n=>n.attributes['aria-label']==='남은 사용 한도 보기').onclick();assert.equal(ui.requests.length,2);assert.equal(ui.requests[1].refresh,true);
 ui.advance(180000);await ui.panel.refresh();assert.equal(ui.requests.length,2,'old five-minute deadline is cancelled');
 ui.advance(119000);await ui.panel.refresh();assert.equal(ui.requests.length,2);
 ui.advance(2000);ui.hidden(true);await ui.panel.refresh();assert.equal(ui.requests.length,2);
 ui.hidden(false);await ui.panel.refresh();assert.equal(ui.requests.length,3);
 await ui.panel.refresh();assert.equal(ui.requests.length,3,'status polling does not repeat the quota query');
});
test('quota and reset count precede account switching',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),accounts:[{id:'official',kind:'chatgpt',name:'Official',details:{usage:{status:'ready',checkedAt:Date.now()/1000,limits:[],resetCredits:{availableCount:2}}}}]});
 await ui.panel.refresh();const nodes=ui.all(ui.panel.rows.children[0]);
 assert.ok(nodes.findIndex(n=>n.textContent==='카드 재설정 · 2 장케커')<nodes.findIndex(n=>n.textContent==='이 계정으로 전환'));
 const refresh=nodes.find(n=>n.attributes['aria-label']==='남은 사용 한도 보기');assert.equal(refresh.textContent,'');assert.match(refresh.innerHTML,/<svg[^>]*viewBox="0 0 24 24"/);assert.equal(refresh.parent.className,'accounts-usage-controls');assert.equal(refresh.parent.parent,nodes.find(n=>n.className==='accounts-card-footer'));assert.ok(!nodes.some(n=>n.textContent==='새로고침 사용 한도'));
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} groups reset count, next usable expiry and the selected account action`,()=>{
 const ui=fixture(desktop);ui.panel.onReset=()=>{};let chosen;ui.panel.openReset=row=>chosen=row.id;
 const now=ui.now()/1000,expiry=now+86400,card=(id,expiresAt,extra={})=>({id,expiresAt,status:'available',resetType:'codexRateLimits',...extra});
 const official={id:'official',kind:'chatgpt',name:'Official',email:'official@test',details:{usage:{status:'ready',updatedAt:now,limits:[],subscription:{periodEndsAt:now+86400,source:'online'},resetCredits:{availableCount:2,credits:[card('later',expiry+86400),card('expired',now-1),card('other',now+10,{resetType:'other'}),card('used',now+20,{status:'used'}),card('next',expiry)]}}}};
 ui.panel.accept({...ui.value(),accounts:[...ui.value().accounts,official]});
 const nodes=ui.all(ui.panel.rows.children[1]),group=nodes.find(n=>n.className==='accounts-reset-summary'),grouped=ui.all(group);
 assert.match(grouped.map(n=>n.textContent).join('\n'),/사용량 재설정 · 2개 사용 가능/);
 const time=grouped.find(n=>n.tag==='time');assert.equal(time.dateTime,new Date(expiry*1000).toISOString());assert.equal(time.title,new Date(expiry*1000).toLocaleString('ko-KR'));
 const use=grouped.find(n=>n.tag==='button');assert.equal(use.parent,group);use.onclick();assert.equal(chosen,'official');assert.equal(ui.requests.length,0);
 assert.equal(ui.all(ui.panel.rows.children[0]).some(n=>n.className==='accounts-reset-summary'),false);
 const note=nodes.find(n=>n.className==='account-muted account-subscription-note'),info=nodes.find(n=>n.attributes['aria-label']==='구독 날짜에 대해');assert.equal(note.hidden,true);info.onclick();assert.equal(note.hidden,false);assert.equal(info.attributes['aria-expanded'],'true');
 assert.equal(info.parent.parent.className,'accounts-name');assert.equal(info.textContent,'구독 기간 종료'+new Date(expiry*1000).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}));assert.ok(info.title.includes(new Date(expiry*1000).toLocaleString('ko-KR')));assert.ok(!nodes.some(n=>n.textContent==='ⓘ'));
 ui.panel.render();assert.equal(ui.all().find(n=>n.className==='account-muted account-subscription-note').hidden,false);
 const updated=nodes.find(n=>n.className==='account-updated account-muted'),refresh=nodes.find(n=>n.attributes['aria-label']==='남은 사용 한도 보기');assert.equal(updated.textContent,'업데이트됨 '+new Date(now*1000).toLocaleString('ko-KR',{hour:'2-digit',minute:'2-digit'}));assert.equal(updated.parent,refresh.parent);assert.equal(updated.parent.parent.className,'accounts-card-footer');assert.equal(updated.parent.children.at(-1),refresh);assert.equal(updated.title,new Date(now*1000).toLocaleString('ko-KR'));
 ui.language();assert.match(ui.text(),/Usage resets · 2 available/);assert.match(ui.text(),/Subscription period ends:/);
});

test('official credits retain zero and unlimited balances and omit missing values',()=>{
 const ui=fixture();ui.panel.accept({...ui.value(),accounts:[{id:'official',kind:'chatgpt',name:'Official',details:{usage:{status:'ready',limits:[{name:'Missing',credits:{balance:null}},{name:'Empty',credits:{balance:' '}},{name:'Zero',credits:{balance:0}},{name:'Paid',credits:{balance:'12.5'}},{name:'Unlimited',credits:{unlimited:true}}]}}}]});
 assert.doesNotMatch(ui.text(),/Missing · Credits:|Empty · Credits:/);assert.match(ui.text(),/Zero · Credits: 0/);assert.match(ui.text(),/Paid · Credits: 12.5/);assert.match(ui.text(),/Unlimited · Credits: 제한 없는/);
});
test('viewed quotas refresh at five minutes only while the account page is visible',async()=>{
 const ui=fixture();const official={id:'official',kind:'chatgpt',name:'Official',details:{usage:{status:'ready',checkedAt:Date.now()/1000-299,limits:[]}}};
 ui.setValue({...ui.value(),accounts:[official]});await ui.panel.refresh();assert.equal(ui.requests.length,0);
 official.details.usage.checkedAt=Date.now()/1000-301;
 ui.root.closest=selector=>selector==='dialog'?{open:false}:null;await ui.panel.refresh();assert.equal(ui.requests.length,0);
 ui.root.closest=selector=>selector==='[hidden],.client-config-hidden'?{}:null;await ui.panel.refresh();assert.equal(ui.requests.length,0);
 ui.root.closest=()=>null;
 ui.setRequest(async()=>{official.details.usage.checkedAt=Date.now()/1000;return structuredClone(ui.value());});
 await ui.panel.refresh();assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].section,'usage');assert.equal(ui.requests[0].refresh,undefined);
 await ui.all().find(n=>n.attributes['aria-label']==='남은 사용 한도 보기').onclick();assert.equal(ui.requests.length,2);assert.equal(ui.requests[1].refresh,true);
});

test('desktop Codex configuration stops polling while hidden and resumes on return',async()=>{
 const ui=fixture(true);await ui.panel.refresh();assert.ok(ui.timers.some(row=>row.ms===300000&&!row.cancelled));
 ui.configHidden(true);assert.equal(ui.panel.visible(),false);assert.equal(ui.timers.some(row=>!row.cancelled),false);
 const before=ui.readCalls();ui.configHidden(false);await new Promise(setImmediate);
 assert.equal(ui.readCalls(),before+1);assert.ok(ui.timers.some(row=>row.ms===300000&&!row.cancelled));
});

test('leaving during a quota batch drops its response and skips later accounts',async()=>{
 const ui=fixture(true),rows=['first','second'].map(id=>({id,kind:'chatgpt',name:id}));
 ui.setValue({...ui.value(),accounts:rows});let finish;
 ui.setRequest(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=ui.panel.refresh();await new Promise(setImmediate);assert.equal(ui.requests.length,1);
 ui.configHidden(true);finish({...ui.value(),accounts:rows.map(row=>({...row,details:{usage:{status:'ready',checkedAt:ui.now()/1000,limits:[]}}}))});
 await pending;assert.equal(ui.requests.length,1);assert.equal(ui.panel.value.accounts[0].details,undefined);
 assert.equal(ui.timers.some(row=>!row.cancelled),false);
});

test('an old quota response is ignored across hide and return, then a new visit reloads',async()=>{
 const ui=fixture(true),row={id:'one',kind:'chatgpt',name:'one'};ui.setValue({...ui.value(),accounts:[row]});let finish;
 ui.setRequest(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=ui.panel.refresh();await new Promise(setImmediate);ui.configHidden(true);ui.configHidden(false);
 ui.setRequest(async()=>({...ui.value(),accounts:[{...row,details:{usage:{status:'ready',checkedAt:ui.now()/1000,limits:[]}}}]}));
 finish({...ui.value(),accounts:[{...row,name:'stale'}]});await pending;await new Promise(setImmediate);
 assert.equal(ui.requests.length,2);assert.equal(ui.panel.value.accounts[0].name,'one');
});

test('a list read from a previous visit cannot replace the reopened account snapshot',async()=>{
 const ui=fixture(true);await ui.panel.refresh();let finish,changes=0;ui.panel.onChanged=()=>changes++;
 ui.setRead(()=>new Promise(resolve=>{finish=resolve;}));const old=ui.panel.refresh();
 ui.configHidden(true);ui.configHidden(false);
 ui.setRead(async()=>({...ui.value(),activeId:'fresh'}));
 finish({...ui.value(),activeId:'stale'});await old;await new Promise(setImmediate);
 assert.equal(ui.panel.value.activeId,'fresh');assert.equal(changes,1);
});

test('a hidden passive account read can update identity without querying quota',async()=>{
 const ui=fixture(true),official={id:'official',kind:'chatgpt',name:'Official'};
 ui.configHidden(true);ui.setValue({...ui.value(),activeId:'official',accounts:[official]});
 await ui.panel.refresh();assert.equal(ui.panel.value.activeId,'official');
 assert.equal(ui.requests.length,0);assert.equal(ui.timers.some(row=>!row.cancelled),false);
});

test('returning during an account write refreshes the panel after the write settles',async()=>{
 const ui=fixture(true);await ui.panel.refresh();let finish;
 ui.setRequest(()=>new Promise(resolve=>{finish=resolve;}));const pending=ui.panel.perform({action:'rename',id:'a',name:'new'});
 ui.configHidden(true);ui.configHidden(false);const before=ui.readCalls();
 const updated={...ui.value(),accounts:[{...ui.value().accounts[0],name:'new'}]};ui.setValue(updated);finish(updated);await pending;await new Promise(setImmediate);
 assert.equal(ui.readCalls(),before+1);assert.equal(ui.panel.value.accounts[0].name,'new');
});

test('first account read failure stays visible and retries after ten seconds',async()=>{
 const ui=fixture();ui.setRead(async()=>{throw Error('offline');});await ui.panel.refresh();
 assert.match(ui.panel.error.textContent,/offline/);assert.equal(ui.panel.value,null);
 assert.ok(ui.timers.some(row=>row.ms===10000&&!row.cancelled));
 ui.setRead(async()=>structuredClone(ui.value()));await ui.fireTimer(10000);
 assert.equal(ui.readCalls(),2);assert.ok(ui.panel.value);assert.equal(ui.panel.error.textContent,'');
});


test('desktop and web can ignore only the selected unknown submission',async()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop);ui.setValue({...ui.value(),blockers:[{reason:'unknown',title:'Chat',id:'thread',submissionId:'message',host:'local'},{reason:'running',title:'Busy',id:'busy'}]});
  await ui.panel.refresh();assert.equal(ui.all().filter(n=>n.textContent==='무시').length,1);
  ui.confirm(false);await ui.all().find(n=>n.textContent==='무시').onclick();assert.equal(ui.requests.length,0);
  ui.confirm(true);await ui.all().find(n=>n.textContent==='무시').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.requests[0])),{action:'ignoreSubmission',threadId:'thread',submissionId:'message',host:'local'});
 }
});

test('loading and failed refresh retain percentages, cards and the last successful time',()=>{
 const ui=fixture();const usage={status:'ready',updatedAt:1900000000,limits:[{name:'Codex',windows:[{remainingPercent:75,windowDurationMins:300,resetsAt:2000000000}]}],resetCredits:{availableCount:2}};
 for(const status of ['ready','loading','error']){ui.panel.accept({...ui.value(),accounts:[{id:'official',kind:'chatgpt',name:'Official',details:{usage:{...usage,status,error:status==='error'?'쿼리 실패':undefined}}}]});
 assert.match(ui.text(),/남은75%/);assert.match(ui.text(),/사용량 재설정 · 2/);assert.match(ui.all().find(n=>n.className==='account-updated account-muted').textContent,/업데이트/);assert.match(ui.text(),/재설정될 때까지|새로고침을 기다리는 중/);
 if(status==='loading')assert.match(ui.text(),/확인 중…/);if(status==='error')assert.match(ui.text(),/마지막 결과를 표시합니다\. 데이터가 업데이트되지 않았습니다/);}
 ui.panel.accept({...ui.value(),accounts:[{id:'other',kind:'chatgpt',name:'Different',details:{usage:{status:'loading'}}}]});assert.doesNotMatch(ui.text(),/남은75%|사용량 재설정 · 2/);
});
test('saved official card has a direct reset entry and API cards have no subscription quota',()=>{
 const ui=fixture();let chosen;ui.panel.openReset=row=>chosen=row.id;
 ui.panel.accept({...ui.value(),activeId:'official',accounts:[{id:'official',kind:'chatgpt',name:'Official',details:{usage:{status:'ready',limits:[],resetCredits:{availableCount:2}}}}]});
 ui.all().find(n=>n.tag==='button'&&n.textContent==='재설정 사용'&&!n.hidden).onclick();assert.equal(chosen,'official');
});

test('active official account exposes reset entry before quota details load',()=>{
 const ui=fixture();let chosen;ui.panel.openReset=row=>chosen=row.id;
 ui.panel.accept({...ui.value(),activeId:'official',current:{kind:'chatgpt',status:'ready',id:'official'},accounts:[{id:'official',kind:'chatgpt',name:'Official'}]});
 const reset=ui.all().find(n=>n.tag==='button'&&n.textContent==='재설정 사용'&&!n.hidden);assert.ok(reset);reset.onclick();assert.equal(chosen,'official');
});


test('both saved-account views treat stale subscription claims as unknown',()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop);
  const accounts=[1790147934,1788250708].map((periodEndsAt,i)=>({id:'official-'+i,kind:'chatgpt',name:'Account '+i,details:{usage:{status:'ready',checkedAt:ui.now()/1000,updatedAt:ui.now()/1000,limits:[],subscription:{periodEndsAt,source:'login'}}}}));
  ui.panel.accept({...ui.value(),accounts});
  assert.equal(ui.all().filter(n=>n.textContent==='구독 종료 날짜가 확인되지 않았습니다.').length,2);
  assert.doesNotMatch(ui.text(),/현재 구독 기간|기록 날짜 도달|다음 이후에 종료/);
  accounts[0].details.usage.subscription.periodEndsAt=ui.now()/1000+86400;ui.panel.render();
  assert.match(ui.text(),/로그인 기록의 구독 날짜\(실시간 아님\):/);assert.match(ui.text(),/로그인 기록이 오래되었을 수 있습니다\. ChatGPT 구독 페이지를 참조하세요\./);
  ui.language();assert.match(ui.text(),/Subscription date in login record \(not live\):/);
  ui.advance(86401000);ui.panel.render();assert.equal(ui.all().filter(n=>n.textContent==='Subscription end date is unconfirmed').length,2);
 }
});

test('every saved official account opens its own reset dialog without switching',async()=>{
 const ui=fixture();
 const saved={...ui.value(),activeId:'api',current:{kind:'api',status:'ready'},accounts:[...ui.value().accounts,{id:'one',kind:'chatgpt',name:'One'},{id:'two',kind:'chatgpt',name:'Two'}]};
 ui.panel.accept(saved);
 assert.equal(ui.all().filter(n=>n.textContent==='재설정 사용').length,2);
 ui.setRequest(async value=>value.action==='account'?{visible:true,email:value.id+'@test',accountKey:'a'.repeat(64),limits:[],canReset:true,resetCredits:{availableCount:0,credits:[]}}:saved);
 await ui.panel.openReset(saved.accounts[2]);
 assert.equal(ui.requests[0].action,'account');assert.equal(ui.requests[0].id,'two');assert.equal(ui.requests[0].operation,'read');
 assert.equal(ui.panel.resetPanel.value.email,'two@test');assert.ok(ui.panel.resetDialog.open);
 assert.equal(ui.panel.resetPanel.resetOnly,true);const dialogText=ui.all(ui.panel.resetDialog).map(n=>n.textContent).join('\n');assert.doesNotMatch(dialogText,/신청|몫|업데이트 날짜/);
 assert.equal(ui.requests.some(r=>r.action==='switch'),false);
 ui.panel.resetDialog.close();assert.equal(ui.panel.resetPanel,null);
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} reset inventory appears immediately and use waits for the account read`,async()=>{
 const ui=fixture(desktop);ui.panel.onReset=()=>{};
 const cards={availableCount:2,credits:[{id:'credit',title:'Cached reset',status:'available',resetType:'codexRateLimits',expiresAt:null}]};
 const row={id:'official',kind:'chatgpt',name:'Official',email:'saved@test',details:{usage:{status:'ready',resetCredits:cards}}};
 ui.panel.accept({...ui.value(),accounts:[row]});let resolveRead;
 ui.setRequest(()=>new Promise(resolve=>resolveRead=resolve));const opening=ui.panel.openReset(row),panel=ui.panel.resetPanel;
 const text=()=>ui.all(ui.panel.resetDialog).map(n=>n.textContent).join('\n');
 assert.match(text(),/Cached reset/);assert.match(text(),/사용 가능:2/);assert.match(text(),/확인 중…/);assert.doesNotMatch(text(),/이 계정에서는 크레딧 재설정을 사용할 수 없습니다\. 새로고침하고 다시 시도하세요\./);
 assert.equal(panel.loading,true);assert.equal(panel.canRedeem('credit'),false);await panel.redeem('credit');assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].refresh,false);
 resolveRead({visible:true,email:'saved@test',accountKey:'a'.repeat(64),limits:[],canReset:true,resetCredits:cards});await opening;
 assert.equal(panel.loading,false);assert.equal(panel.canRedeem('credit'),true);assert.doesNotMatch(text(),/확인 중…/);
 ui.panel.resetDialog.close();
});

test('first reset load shows progress and a closed dialog cannot be repopulated by a late read',async()=>{
 const ui=fixture(),row={id:'official',kind:'chatgpt',name:'Official'};ui.panel.onReset=()=>{};ui.panel.accept({...ui.value(),accounts:[row]});
 let resolveRead;ui.setRequest(()=>new Promise(resolve=>resolveRead=resolve));const opening=ui.panel.openReset(row),panel=ui.panel.resetPanel;
 const nodes=ui.all(ui.panel.resetDialog);assert.ok(nodes.some(n=>n.textContent==='확인 중…'&&n.attributes.role==='status'));
 ui.panel.resetDialog.close();resolveRead({visible:true,email:'saved@test',accountKey:'a'.repeat(64),limits:[],canReset:true,resetCredits:{availableCount:0,credits:[]}});await opening;
 assert.equal(ui.panel.resetPanel,null);assert.equal(panel.value,null);assert.equal(panel.root.children.length,0);
});

test('desktop updates distinguish remote version checks from computer-side installation',async()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop);ui.setValue({...ui.value(),desktopUpdate:{state:'available',canRequest:true,currentBuild:'1',currentVersion:'1',targetVersion:'2'}});await ui.panel.refresh();
  assert.match(ui.text(),/원격으로 새 버전을 확인할 수 있습니다\. 다운로드 및 설치에는 여전히 컴퓨터에서 확인이 필요합니다\./);
  await ui.all().find(n=>n.textContent==='새로운 Codex 버전 확인').onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.requests)),[{action:'checkDesktopUpdate'}]);assert.equal(ui.prompts.length,0);
  ui.confirm(false);await ui.all().find(n=>n.textContent==='컴퓨터에서 업데이터를 엽니다.').onclick();assert.equal(ui.requests.length,1);
  ui.confirm(true);await ui.all().find(n=>n.textContent==='컴퓨터에서 업데이터를 엽니다.').onclick();assert.equal(ui.requests[1].action,'requestDesktopUpdate');assert.equal(ui.requests[1].tasksConfirmed,true);
  ui.language();assert.match(ui.text(),/installing still require confirmation on the computer/);
 }
});


test('native update completion is shown only after the installed build is verified',async()=>{
 const ui=fixture();ui.setValue({...ui.value(),desktopUpdate:{state:'needsDesktop',installation:{state:'pending',previousBuild:'100',currentBuild:'101'}}});await ui.panel.refresh();assert.doesNotMatch(ui.text(),/설치된 데스크톱 버전이 업데이트된 것으로 확인되었습니다\./);
 ui.setValue({...ui.value(),desktopUpdate:{state:'checked',installation:{state:'verified',previousBuild:'100',currentBuild:'101'}}});await ui.panel.refresh();assert.match(ui.text(),/설치된 데스크톱 버전이 업데이트된 것으로 확인되었습니다\. · 100 → 101/);
 ui.language();assert.match(ui.text(),/verified as updated · 100 → 101/);
});

for(const desktop of [false,true])test(`${desktop?'desktop':'web'} hides successful switch status and preserves progress and errors`,async()=>{
 const ui=fixture(desktop);
 for(const phase of ['complete','restored']){
  ui.setValue({...ui.value(),switch:{phase}});await ui.panel.refresh();assert.equal(ui.panel.status.hidden,true);
  ui.setValue({...ui.value(),switch:{phase,error:'Review required'}});await ui.panel.refresh();assert.equal(ui.panel.status.hidden,false);assert.match(ui.panel.status.textContent,/Review required/);
 }
 for(const phase of ['preparing','verifying','failed','interrupted']){
  ui.setValue({...ui.value(),switch:{phase}});await ui.panel.refresh();assert.equal(ui.panel.status.hidden,false);
 }
});

test('account models retain cached names and efforts when explicit refresh fails',async()=>{
 const ui=fixture(),account={...ui.value().accounts[0],details:{models:{status:'error',error:'Refresh failed',cache:{updatedAt:1000},models:[{id:'route/model',name:'Concrete model',efforts:['low','high']}]}}};
 ui.setValue({...ui.value(),accounts:[account]});ui.panel.expandedModels.add(account.id);await ui.panel.refresh();assert.match(ui.text(),/Concrete model/);assert.match(ui.text(),/low.*high/);assert.match(ui.text(),/Refresh failed/);
 await ui.all().find(node=>node.tag==='button'&&node.textContent==='모델 새로 고침').onclick();assert.equal(ui.requests.at(-1).refresh,true);assert.equal(ui.requests.at(-1).section,'models');
});

test('idle account reads do not poll every two seconds; pending account work does',async()=>{
 const ui=fixture(true),delay=()=>ui.timers[ui.panel.timer-1]?.ms;
 await ui.panel.refresh();assert.equal(delay(),300000);const idle=ui.timers[ui.panel.timer-1];assert.equal(ui.readCalls(),1);
 ui.advance(2000);assert.equal(ui.readCalls(),1);
 ui.setValue({...ui.value(),enrollment:{phase:'waiting'}});await idle.fn();assert.equal(ui.readCalls(),2);assert.equal(delay(),2000);
 const pending=ui.timers[ui.panel.timer-1];ui.setValue({...ui.value(),enrollment:{phase:'complete'}});await pending.fn();assert.equal(ui.readCalls(),3);assert.equal(delay(),300000);
 ui.setValue({...ui.value(),enrollment:{phase:'complete'},switch:{phase:'verifying'}});await ui.panel.refresh();assert.equal(delay(),2000);
 ui.setValue({...ui.value(),switch:{phase:'idle'},accounts:[{...ui.value().accounts[0],details:{models:{status:'loading'}}}]});await ui.panel.refresh();assert.equal(delay(),2000);
 ui.setValue({...ui.value(),accounts:[{...ui.value().accounts[0],details:{models:{status:'ready',models:[]}}}]});await ui.panel.refresh();assert.notEqual(delay(),2000);
 ui.setValue({...ui.value(),switch:{phase:'interrupted'}});await ui.panel.refresh();assert.equal(delay(),300000);
});

test('Codex model scroller survives status reads and model timestamp changes',async()=>{
 const ui=fixture(),row={...ui.value().accounts[0],details:{models:{status:'ready',cache:{updatedAt:1000},models:[{id:'model-a'},{id:'model-b'}]}}};
 ui.setValue({...ui.value(),accounts:[row]});ui.panel.expandedModels.add(row.id);await ui.panel.refresh();
 const box=ui.all().find(node=>node.className==='accounts-models'),card=box.parent;box.scrollTop=74;
 ui.setValue({...ui.value(),switch:{phase:'verifying'},accounts:[{...row,details:{models:{...row.details.models,cache:{updatedAt:2000}}}}]});await ui.panel.refresh();
 assert.equal(ui.all().find(node=>node.className==='accounts-models'),box);assert.equal(box.parent,card);assert.equal(box.scrollTop,74);assert.match(ui.text(),/model-b/);
 let finish;ui.setRequest(()=>new Promise(resolve=>finish=resolve));ui.focus(box.refresh);const pending=box.refresh.onclick();ui.blur();finish(ui.value());await pending;assert.equal(ui.active(),box.refresh);
 ui.setValue({...ui.value(),accounts:[{...row,accountKey:'new-profile'}],switch:{phase:'idle'}});await ui.panel.refresh();
 assert.notEqual(ui.all().find(node=>node.className==='accounts-models'),box);
});

test('one inventory delegates API edit and probes to the editor before reminders',async()=>{
 const ui=fixture(),details=ui.panel.node('details'),calls=[];
 ui.panel.attachApiAccess({edit:(...args)=>calls.push(args),probe:(...args)=>calls.push(args)},details);
 await ui.panel.refresh();assert.ok(ui.panel.management.children.indexOf(details)<ui.panel.management.children.indexOf(ui.panel.tools));
 ui.all().find(node=>node.textContent==='편집').onclick();assert.equal(details.open,true);assert.equal(calls[0][0],'codex');
 ui.all().find(node=>node.textContent==='테스트 모델 엔드포인트').onclick();assert.equal(details.open,true);assert.equal(calls[1][1],'test');
 assert.equal(ui.all().filter(node=>node.className==='account-bucket').length,1);
});

test('desktop API edit opens the outer editor even with a nested article and respects switch locks',async()=>{
 const ui=fixture(true),details=ui.panel.node('details'),article=ui.panel.node('article'),root=ui.panel.node('div'),calls=[];article.append(root);details.append(article);
 ui.panel.attachApiAccess({root,edit:()=>calls.push('edit'),probe:()=>{}},details);await ui.panel.refresh();
 const edits=()=>ui.all().filter(node=>node.textContent==='편집'&&!node.hidden);assert.equal(edits().length,1);edits()[0].onclick();assert.equal(details.open,true);assert.deepEqual(calls,['edit']);
 ui.setValue({...ui.value(),switch:{phase:'applying'}});await ui.panel.refresh();assert.equal(edits()[0].disabled,true);assert.equal(ui.all().find(node=>node.textContent==='테스트 모델 엔드포인트').disabled,true);
});

test('reset outlook follows the shared feature switch on web and desktop',()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop),base=ui.value(),forecast={state:'ready',source:'https://codex-reset.com/',probabilities:{h24:25,h48:50},updatedAt:ui.now()/1000};
  ui.panel.accept({...base,resetDynamicEnabled:false,globalReset:null});assert.equal(ui.panel.globalReset.hidden,true);
  ui.panel.accept({...base,resetDynamicEnabled:true,globalReset:forecast});assert.equal(ui.panel.globalReset.hidden,false);assert.match(ui.text(),/24시간 이내\n25%/);
  ui.panel.accept({...base,resetDynamicEnabled:false,globalReset:null});assert.equal(ui.panel.globalReset.hidden,true);
 }
});

test('manual reset refresh tracks async completion and cooldown',async()=>{
 const ui=fixture(),base=ui.value(),stamp=ui.now()/1000;
 const value=(refresh)=>({...base,resetDynamicEnabled:true,globalReset:{state:'ready',source:'https://codex-reset.com/',updatedAt:stamp,probabilities:{},refresh}});
 const initial={instanceId:'one',id:1,checking:false,cooldownUntil:0};ui.panel.accept(value(initial));
 let forceArg;ui.setRead(async force=>{forceArg=force;return value({...initial,id:2,checking:true});});
 await ui.panel.refreshGlobalReset();assert.equal(forceArg,true);assert.equal(ui.panel.globalResetRefreshIntent.id,2);
 assert.ok(ui.timers.some(t=>!t.cancelled&&t.ms===2000));
 ui.setRead(async()=>value({...initial,id:2,checking:false,changed:true}));await ui.fireTimer(2000);
 assert.equal(ui.panel.globalResetRefreshIntent,null);assert.match(ui.text(),/업데이트됨/);
 ui.setRead(async()=>value({...initial,id:2,cooldownUntil:stamp+30}));await ui.panel.refreshGlobalReset();
 assert.match(ui.text(),/30초 후에 다시 새로고침/);
});

test('reset outlook switches at local midnight and prioritizes announcements',async()=>{
 const ui=fixture(),base=ui.value(),now=ui.now(),midnight=new Date(now);midnight.setHours(24,0,0,0);
 const forecast={state:'ready',source:'https://codex-reset.com/',lastResetAt:now/1000,updatedAt:now/1000,probabilities:{h24:49,h48:74}};
 ui.panel.accept({...base,resetDynamicEnabled:true,globalReset:forecast});
 assert.match(ui.text(),/오늘의 전체 한도 초기화/);assert.doesNotMatch(ui.text(),/24시간 이내|아직 공식적인 발표는 없습니다/);assert.match(ui.text(),/출처: codex-reset\.com ↗/);
 const delay=midnight.getTime()-now;ui.advance(delay);await ui.fireTimer(delay);
 assert.match(ui.text(),/최근 전체 한도 초기화 · 어제/);assert.match(ui.text(),/24시간 이내\n49%/);
 ui.panel.accept({...base,resetDynamicEnabled:true,globalReset:{...forecast,officialSignal:{summary:'공식 발표'}}});
 assert.match(ui.text(),/최근 전체 한도 초기화/);assert.match(ui.text(),/공식 발표/);assert.doesNotMatch(ui.text(),/24시간 이내/);
 ui.panel.accept({...base,resetDynamicEnabled:true,globalReset:{...forecast,state:'error',stale:true}});
 assert.match(ui.text(),/최근 전체 한도 초기화/);assert.match(ui.text(),/데이터 지연 · 업데이트 대기 중/);assert.doesNotMatch(ui.text(),/24시간 이내/);
});

test('reset relative time omits duplicate date while account timestamps retain dates',()=>{
 const ui=fixture(),now=new Date(ui.now()),yesterday=new Date(now);yesterday.setDate(now.getDate()-1);const stamp=yesterday.getTime()/1000;
 const relative=ui.panel.globalTime(stamp),account=ui.panel.shortTime(stamp,true);
 assert.match(relative,/^어제/);assert.doesNotMatch(relative,/월|일/);assert.match(account,/월/);
});

test('reset outlook follows current connection and its status on both hosts',()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop),nodes=ui.root.children;
  assert.ok(nodes.indexOf(ui.panel.managementNotice)<nodes.indexOf(ui.panel.current));
  assert.ok(nodes.indexOf(ui.panel.current)<nodes.indexOf(ui.panel.globalReset));
  assert.ok(nodes.indexOf(ui.panel.blocked)<nodes.indexOf(ui.panel.globalReset));
  assert.ok(nodes.indexOf(ui.panel.globalReset)<nodes.indexOf(ui.panel.rows));
 }
});

test('account actions and model control share one footer on both hosts',async()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop);await ui.panel.refresh();
  const choose=ui.all().find(n=>n.textContent==='이 계정으로 전환'),models=ui.all().find(n=>n.textContent==='사용 가능한 모델 보기');
  assert.equal(choose.parent,models.parent);assert.equal(models.parent.className,'accounts-card-footer');
 }
});


test('unknown API auth exposes only a same-request read-only verification on web and desktop',async()=>{
 for(const desktop of [false,true]){
  const ui=fixture(desktop),requestId='22222222-2222-4222-8222-222222222222';
  ui.setValue({...ui.value(),accounts:[...ui.value().accounts,{id:'other',kind:'api',name:'Other'}],
    switch:{phase:'authUnknown',operation:'cliAuth',targetId:'a',requestId,error:'계정 동기화 결과가 확인 대기 중입니다.'}});
  await ui.panel.refresh();
  const verify=ui.all().find(n=>n.tag==='button'&&n.textContent==='계정 동기화 확인');
  assert.ok(verify);assert.equal(verify.disabled,false);
  assert.equal(ui.all().find(n=>n.tag==='button'&&n.textContent==='이 계정으로 전환').disabled,true);
  ui.confirm(false);await verify.onclick();
  assert.equal(ui.prompts.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.requests[0])),{action:'switch',id:'a',requestId,confirmed:true,tasksConfirmed:true});
 }
});


test('shared account confirmation keeps other clients quiet until synchronization completes',async()=>{
 const ui=fixture();await ui.panel.refresh();await ui.panel.choose(ui.value().accounts[0]);
 assert.match(ui.prompts[0],/모든 작업\(이 웹 페이지에 표시되지 않는 작업 포함\)이 끝났는지 확인하고 공유 Codex 접속 설정을 전환하시겠습니까\? 전환이 끝나기 전까지 다른 클라이언트에서 작업을 시작하지 마세요\. 필요한 경우에만 데스크톱 런타임을 정상 종료 후 다시 시작합니다\./);
 assert.match(ui.prompts[0],/모든 작업\(이 웹 페이지에 표시되지 않는 작업 포함\)이 끝났는지 확인하고 공유 Codex 접속 설정을 전환하시겠습니까\? 전환이 끝나기 전까지 다른 클라이언트에서 작업을 시작하지 마세요\. 필요한 경우에만 데스크톱 런타임을 정상 종료 후 다시 시작합니다\./);
});
