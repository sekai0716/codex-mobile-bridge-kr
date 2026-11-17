'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(language='ko'){
 const document={};
 function element(tag){
  const listeners={};return {tag,children:[],dataset:{},attributes:{},open:false,_text:'',
   get textContent(){return this._text+this.children.map(child=>child.textContent).join('');},set textContent(value){this._text=value;},
   append(...children){for(const child of children){child.parent=this;this.children.push(child);}},replaceChildren(...children){this.children=[];this.append(...children);},
   setAttribute(key,value){this.attributes[key]=value;},addEventListener(type,handler){listeners[type]=handler;},
   emit(type,event={}){listeners[type]?.(event);},showModal(){this.open=true;},close(){this.open=false;this.emit('close');},
   remove(){this.parent.children=this.parent.children.filter(child=>child!==this);},focus(){document.activeElement=this;}
  };
 }
 document.createElement=element;document.body=element('body');
 const context=vm.createContext({document,setTimeout,clearTimeout,AbortController,localStorage:{getItem:()=>language,setItem(){}}});
 for(const file of ['web/shared/locales/en.js','web/shared/locales/ko-KR.js','web/shared/locales/zh-CN.js','web/shared/locales/legacy.js','web/shared/i18n.js','web/features/clients/client-lifecycle.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 return {context,document,choose:client=>vm.runInContext('ClientLifecycle',context).chooseDisable(client),initialize:client=>vm.runInContext('ClientLifecycle',context).chooseInitialize(client),dialog:()=>document.body.children[0]};
}
test('WSL clients distinguish a stopped environment, a pending CLI connection and unknown status',()=>{
 const lifecycle=require('../web/features/clients/client-lifecycle.js');
 for(const kind of ['wsl-cli','wsl-claude-cli']){
  const client={kind,enabled:true,installed:true,setupStatus:'ready',connected:false};
  assert.equal(lifecycle.connection({...client,distributionRunning:false,running:false}).label,'WSL가 중지되었습니다.');
  assert.equal(lifecycle.connection({...client,distributionRunning:true,running:true}).label,'WSL가 실행 중입니다. 연결 대기 중');
  const unknown=lifecycle.connection({...client,distributionRunning:null,running:null});
  assert.equal(unknown.label,'WSL 상태가 확인되지 않았습니다.');assert.match(unknown.reason,/새로고침/);assert.equal(unknown.error,false);
  assert.equal(lifecycle.connection({...client,distributionRunning:null,connected:true}).label,'연결됨');
 }
 assert.equal(lifecycle.connection({installed:true,running:false}).label,'앱이 실행되지 않음');
});
test('a real close dialog presents three distinct choices and defaults focus to cancel',async()=>{
 for(const expected of [false,true,null]){
  const ui=fixture(),result=ui.choose({id:'deepseek',name:'DSH'}),dialog=ui.dialog();
  const buttons=dialog.children.at(-1).children;assert.equal(dialog.tag,'dialog');assert.equal(dialog.open,true);assert.equal(buttons.length,3);
  assert.match(buttons[0].textContent,/전화 액세스만 비활성화.*데스크톱 앱과 현재 작업을 계속 실행/);assert.match(buttons[1].textContent,/정상적으로 데스크톱 앱 종료.*모든 작업이 완료되고 대기 중인 승인이 없는 경우에만/);assert.equal(buttons[2].textContent,'취소');
  assert.equal(ui.document.activeElement,buttons[2]);assert.equal(dialog.attributes['aria-labelledby'],dialog.children[0].id);
  buttons[expected===null?2:expected?1:0].onclick();assert.equal(await result,expected);assert.equal(ui.document.body.children.length,0);
 }
});
test('manual DSH binding only offers disabling access and cancellation',async()=>{
 const ui=fixture(),pending=ui.choose({id:'deepseek',name:'DSH',bindingMode:'manual',canForceQuit:false});
 const buttons=ui.dialog().children.at(-1).children;
 assert.equal(buttons.length,2);assert.match(buttons[0].textContent,/전화 액세스만 비활성화/);
 assert.equal(ui.document.activeElement,buttons[1]);buttons[0].onclick();assert.equal(await pending,false);
});

test('manual plugin controls use selected local paths and cancellation submits nothing',async()=>{
 const ui=fixture();vm.runInContext(fs.readFileSync('desktop/features/clients/desktop-sessions.js','utf8'),ui.context);
 const Panel=vm.runInContext('DesktopConnectionsPanel',ui.context),controller=Object.create(Panel.prototype),calls=[],messages=[];
 let selected='/local/plugin',confirmed=true;ui.context.window={confirm:()=>confirmed};
 Object.assign(controller,{clientsRevision:0,statusRevision:0,renderClients(){},renderScan(){},refreshClients:async()=>{},refresh:async()=>{},feedback:(...args)=>messages.push(args),api:{choose:async kind=>{calls.push(kind);return selected;},desktopSessions:async value=>{calls.push(JSON.parse(JSON.stringify(value)));return {bound:true,profile:'web',home:'/local/home',instanceId:'fixture',plugin:{version:'0.2.0'}};}}});
 await controller.manualDeepseek('bind-deepseek-plugin');assert.deepEqual(calls,['file',{action:'preview-deepseek-plugin',file:'/local/plugin'},{action:'bind-deepseek-plugin',file:'/local/plugin',instanceId:'fixture'}]);
 calls.length=0;confirmed=false;await controller.manualDeepseek('bind-deepseek-plugin');assert.deepEqual(calls,['file',{action:'preview-deepseek-plugin',file:'/local/plugin'}]);
 calls.length=0;selected=null;await controller.manualDeepseek('export-deepseek-plugin');assert.deepEqual(calls,['folder']);assert.equal(controller.busy,false);
});

test('background force quit requires an explicit capability and fresh choice with a translated warning',async()=>{
 for(const language of ['ko','en'])for(const id of ['codex','claude','deepseek']){
  const ui=fixture(language),client={id,name:id,canForceQuit:true};
  for(const expected of ['force',null]){
   const result=ui.choose(client),dialog=ui.dialog(),buttons=dialog.children.at(-1).children;
   assert.equal(buttons.length,4);assert.equal(ui.document.activeElement,buttons[3]);
   assert.equal(buttons[2].dataset.quitDesktop,'true');assert.equal(buttons[2].dataset.forceDesktop,'true');
   assert.match(buttons[1].textContent,language==='en'?/Quit the desktop app normally/:/정상적으로 데스크톱 앱 종료/);
   if(id==='codex')assert.match(buttons[1].textContent,language==='en'?/Codex's native menu.*all tasks finish.*unavailable.*locked.*confirmation on your computer/:/모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 Codex의 네이티브 메뉴를 통해 정상적으로 종료하십시오\. 컴퓨터가 잠겨 있는 동안에는 이 기능을 사용하지 못할 수도 있습니다\. 컴퓨터에서 종료 확인을 처리합니다\./);
   assert.match(buttons[2].textContent,language==='en'?/Force quit App.*Unsaved content may be lost.*tasks may be interrupted.*locked/:/앱 강제 종료.*저장하지 않은 콘텐츠는 손실될 수 있으며 작업이 중단될 수 있습니다.*컴퓨터가 잠겨 있는 동안에도 작동/);
   if(language==='en')assert.doesNotMatch(dialog.textContent,/[\u4e00-\u9fff]/);
   if(expected==='force'){buttons[2].onclick();await Promise.resolve();const confirm=ui.dialog(),actions=confirm.children.at(-1).children;assert.notEqual(confirm,dialog);assert.match(confirm.textContent,language==='en'?/Running sessions may be interrupted.*unsaved content/:/실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다/);assert.equal(ui.document.activeElement,actions[1]);actions[0].onclick();}else dialog.emit('cancel',{preventDefault(){}});
   assert.equal(await result,expected);
  }
 }
 for(const canForceQuit of [undefined,false,'true',1]){
  const ui=fixture(),result=ui.choose({id:'claude',canForceQuit}),dialog=ui.dialog();
  assert.equal(dialog.children.at(-1).children.length,3);assert.doesNotMatch(dialog.textContent,/백그라운드에서 강제 종료/);dialog.close();assert.equal(await result,null);
 }
});

test('the second force confirmation can be cancelled without submitting the exit choice',async()=>{
 const ui=fixture(),result=ui.choose({id:'deepseek',canForceQuit:true});
 ui.dialog().children.at(-1).children[2].onclick();await Promise.resolve();
 ui.dialog().emit('cancel',{preventDefault(){}});assert.equal(await result,null);assert.equal(ui.document.body.children.length,0);
});

test('Claude normal and force exits require one translated unlock warning before desktop or Web mutations',async()=>{
 for(const surface of ['desktop','web'])for(const language of ['ko','en'])for(const force of [false,true])for(const choice of ['confirm','cancel','escape','close']){
  const ui=fixture(language),file=surface==='desktop'?'desktop/features/clients/desktop-sessions.js':'web/features/clients/client-navigation.js';
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ui.context);
  const Class=vm.runInContext(surface==='desktop'?'DesktopConnectionsPanel':'ClientNavigation',ui.context),controller=Object.create(Class.prototype),client={id:'claude',name:'Claude Desktop',enabled:true,running:true,canForceQuit:true},calls=[];
  Object.assign(controller,{clients:[client],clientsRevision:0,statusRevision:0,revision:0,pending:new Set(),provider:'claude',renderClients(){},renderScan(){},paint(){},refreshClients:async()=>{},applyClients(value){this.clients=value.clients;},api:{desktopSessions:async body=>{calls.push(body);return {clients:[{...client,enabled:false,running:false}]};}},request:async(url,body)=>{calls.push(body);return {clients:[{...client,enabled:false,running:false}]};}});
  const pending=surface==='desktop'?controller.toggleClient('claude',false):controller.toggle('claude',false),first=ui.dialog();
  first.children.at(-1).children[force?2:1].onclick();await Promise.resolve();
  const confirm=ui.dialog(),buttons=confirm.children.at(-1).children;
  assert.notEqual(confirm,first);assert.equal(ui.document.body.children.length,1);assert.equal(calls.length,0);assert.equal(client.enabled,true);assert.equal(ui.document.activeElement,buttons[1]);
  assert.match(confirm.textContent,language==='en'?/After restarting.*initializing its connection requires the computer to be unlocked/:/다시 시작.*연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다./);
  if(force)assert.match(confirm.textContent,language==='en'?/Running sessions may be interrupted and unsaved content may be lost/:/그러면 Claude 데스크톱이 즉시 중지됩니다\. 실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다\. 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다\. 강제로 종료하시겠습니까\?/);
  if(language==='en')assert.doesNotMatch(confirm.textContent,/[\u4e00-\u9fff]/);
  if(choice==='escape')confirm.emit('cancel',{preventDefault(){}});else if(choice==='close')confirm.close();else buttons[choice==='confirm'?0:1].onclick();
  await pending;assert.equal(ui.document.body.children.length,0);assert.equal(calls.length,choice==='confirm'?1:0);
  if(choice==='confirm')assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{...(surface==='desktop'?{action:'toggle-client'}:{}),provider:'claude',enabled:false,quitDesktop:true,...(force?{forceDesktop:true,forceConfirmed:true}:{})});
 }
});

test('disabling only Claude phone access does not ask for an unlock or desktop exit confirmation',async()=>{
 for(const language of ['ko','en']){
  const ui=fixture(language),result=ui.choose({id:'claude',name:'Claude',canForceQuit:true});
  ui.dialog().children.at(-1).children[0].onclick();assert.equal(await result,false);assert.equal(ui.document.body.children.length,0);
 }
});

test('an uncertain force quit needs a stopped app as well as disabled access before it is complete',()=>{
 const lifecycle=require('../web/features/clients/client-lifecycle.js');assert.equal(lifecycle.retryLabel('force'),'백그라운드 강제 종료 재시도');
 for(const running of [true,false]){
  const failures=new Map([['claude',{action:'force',uncertain:true}]]);
  lifecycle.reconcile(failures,[{id:'claude',enabled:false,running}]);
  assert.equal(failures.has('claude'),running);if(running)assert.equal(failures.get('claude').uncertain,false);
 }
});

test('ZCode initialization uses only private pipes and keeps restart consent separate',async()=>{
 for(const surface of ['desktop','web'])for(const scenario of ['cancel','cold','restart','keep-running']){
  const ui=fixture('en'),desktop=surface==='desktop',file=desktop?'desktop/features/clients/desktop-sessions.js':'web/features/clients/client-navigation.js';
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ui.context);
  const Controller=vm.runInContext(desktop?'DesktopConnectionsPanel':'ClientNavigation',ui.context),panel=Object.create(Controller.prototype),writes=[];
  const client={id:'zcode',name:'ZCode',enabled:true,installed:true,configured:true,running:scenario!=='cold',confirmTaskState:true,
    setupStatus:'needs-initialization',canInitializeDesktop:true,pipeSupported:true,compatibilitySupported:true};
  const save=async body=>{writes.push(JSON.parse(JSON.stringify(body)));return {clients:[client]};};
  Object.assign(panel,{clients:[client],clientsRevision:0,statusRevision:0,revision:0,pending:new Set(),provider:'zcode',
    renderClients(){},renderScan(){},paint(){},refreshClients:async()=>{},applyClients(){},api:{desktopSessions:save},request:(url,body)=>save(body)});
  const result=desktop?panel.toggleClient('zcode',true,{initializeDesktop:true}):panel.initialize('zcode');
  const first=ui.dialog();assert.ok(first);assert.match(first.textContent,/private local pipe/);assert.doesNotMatch(first.textContent,/17742|compatibility|Claude|[하나-이]/);assert.equal(writes.length,0);
  assert.equal(first.children.at(-1).children.length,2);first.children.at(-1).children[scenario==='cancel'?1:0].onclick();await Promise.resolve();
  if(['restart','keep-running'].includes(scenario)){
   const second=ui.dialog();assert.match(second.textContent,/Some tasks could not be checked/);assert.equal(writes.length,0);
   second.children.at(-1).children[scenario==='restart'?0:1].onclick();
  }
  await result;
  assert.deepEqual(writes,['cold','restart'].includes(scenario)?[{...(desktop?{action:'toggle-client'}:{}),provider:'zcode',enabled:true,initializeDesktop:true,connectionMode:'private-pipe',...(scenario==='restart'?{acknowledgeUnavailable:true}:{})}]:[]);
 }
 const lifecycle=require('../web/features/clients/client-lifecycle.js');
 assert.equal(lifecycle.connection({id:'zcode',canInitializeDesktop:true,compatibilitySupported:true}).canInitialize,false);
 const ready={id:'zcode',pipeSupported:true,pipeReady:true,enabled:true,canInitializeDesktop:true,retryable:true};
 assert.equal(lifecycle.connection(ready).canInitialize,false);assert.equal(lifecycle.connection(ready).label,'연결됨');assert.equal(lifecycle.connection(ready).retryable,false);
 const failed=new Map([['zcode',{action:'initialize',uncertain:true,connectionMode:'private-pipe'}]]);lifecycle.reconcile(failed,[ready]);assert.equal(failed.size,0);
});

test('shared inline connection methods show both options and never open another chooser',()=>{
 for(const language of ['ko','en']){
  const ui=fixture(language),lifecycle=vm.runInContext('ClientLifecycle',ui.context),root=ui.document.createElement('div'),selected=[];
  const client={id:'zcode',name:'ZCode',connected:true,connectionMode:'private-pipe',connectionModes:[{id:'private-pipe',label:'로컬 연결',configured:true,available:true},{id:'official-remote',label:'공식 원격 연결',configured:true,available:true},{id:'future',label:'Other',configured:false,available:true}]};
  const methods=lifecycle.mountConnectionModes(root);methods.update(client,{select:mode=>selected.push(mode)});const buttons=root.children[0].children[1].children;
  assert.equal(buttons.length,3);assert.equal(buttons[0].attributes['aria-pressed'],'true');assert.equal(buttons[0].disabled,true);assert.equal(buttons[2].disabled,true);buttons[2].onclick();assert.equal(selected.length,0);buttons[1].onclick();assert.deepEqual(selected,['official-remote']);assert.equal(ui.document.body.children.length,0);
  methods.update({...client,connectionMode:'official-remote'},{select:mode=>selected.push(mode)});assert.equal(root.children[0].children[1].children[0],buttons[0]);assert.equal(buttons[1].attributes['aria-pressed'],'true');
  if(language==='en')assert.doesNotMatch(root.textContent,/[하나-이]/);
 }
});

test('desktop and remote mode selection submit the same explicit connectionMode without restarting the app',async()=>{
 for(const surface of ['desktop','web'])for(const choice of ['official-remote',null]){
  const ui=fixture(),desktop=surface==='desktop';vm.runInContext(fs.readFileSync(desktop?'desktop/features/clients/desktop-sessions.js':'web/features/clients/client-navigation.js','utf8'),ui.context);
  const Controller=vm.runInContext(desktop?'DesktopConnectionsPanel':'ClientNavigation',ui.context),panel=Object.create(Controller.prototype),calls=[];
  const client={id:'zcode',name:'ZCode',enabled:true,configured:true,running:true,connectionMode:'private-pipe',connectionModes:[{id:'private-pipe',label:'로컬 연결',configured:true,available:true},{id:'official-remote',label:'공식 원격 연결',configured:true,available:true}]};
  const save=async body=>{calls.push(JSON.parse(JSON.stringify(body)));return {clients:[{...client,connectionMode:body.connectionMode}]};};
  Object.assign(panel,{clients:[client],clientsRevision:0,statusRevision:0,revision:0,pending:new Set(),provider:'zcode',renderClients(){},renderScan(){},paint(){},notify(){},refreshClients:async()=>{},applyClients(data){this.clients=data.clients;},api:{desktopSessions:save},request:(url,body)=>save(body)});
  const result=panel.selectConnectionMode('zcode','official-remote'),dialog=ui.dialog(),buttons=dialog.children.at(-1).children;assert.equal(calls.length,0);assert.match(dialog.textContent,/앱 연결 방법을 전환하시겠습니까\?/);assert.match(dialog.textContent,/이렇게 하면 데스크톱 앱을 종료하거나 다시 시작하지 않고도 앱이 연결되는 방식이 전환됩니다\. 완료되지 않은 작업을 먼저 해결하세요\./);buttons[choice?0:1].onclick();await result;
  assert.deepEqual(calls,choice?[{...(desktop?{action:'toggle-client'}:{}),provider:'zcode',enabled:true,connectionMode:'official-remote'}]:[]);
 }
});

test('ready session access does not show retry and unknown switches reconcile only the selected mode',()=>{
 const lifecycle=require('../web/features/clients/client-lifecycle.js'),client={id:'zcode',enabled:true,running:true,setupStatus:'session-access',retryable:true,connectionMode:'official-remote',connectionModes:[{id:'official-remote',label:'공식 원격 연결'}]};
 assert.equal(lifecycle.connection(client).label,'연결됨');assert.equal(lifecycle.connection(client).modeLabel,'공식 원격 연결');assert.equal(lifecycle.connection(client).retryable,false);
 for(const connectionMode of ['official-remote','private-pipe']){
  const failures=new Map([['zcode',{action:'enable',uncertain:true,connectionMode}]]);lifecycle.reconcile(failures,[client]);assert.equal(failures.has('zcode'),connectionMode!=='official-remote');
 }
});

test('initialization distinguishes background attempts from interactive foreground setup and defaults to cancel',async()=>{
 for(const language of ['ko','en'])for(const accepted of [false,true])for(const initializationMode of ['background','foreground']){
  const ui=fixture(language),result=ui.initialize({id:'claude',name:'Claude',initializationMode}),dialog=ui.dialog(),buttons=dialog.children.at(-1).children;
  const pattern=initializationMode==='background'?(language==='en'?/Windows.*background initialization.*keyboard focus.*foreground setup/:/Windows.*백그라운드 초기화.*키보드 포커스.*전경 설정/):(language==='en'?/Claude and its developer tools.*keyboard focus.*screen saver or lock screen/:/Claude.*개발자 도구.*키보드 포커스.*화면 보호기나 잠금 화면/);
  assert.equal(buttons.length,2);assert.equal(ui.document.activeElement,buttons[1]);assert.match(dialog.textContent,pattern);if(language==='en')assert.doesNotMatch(dialog.textContent,/[\u4e00-\u9fff]/);
  buttons[accepted?0:1].onclick();assert.equal(await result,accepted);
 }
 for(const escape of [false,true]){const ui=fixture(),result=ui.initialize({id:'claude'}),dialog=ui.dialog();if(escape)dialog.emit('cancel',{preventDefault(){}});else dialog.close();assert.equal(await result,false);}
});

test('connection labels distinguish startup, required action, failure and actual connectivity',()=>{
 const {connection}=require('../web/features/clients/client-lifecycle.js'),base={enabled:true,configured:true,installed:true,connected:false};
 for(const running of [false,true])for(const configured of [false,true]){
  assert.equal(connection({...base,running,configured,connectionState:'starting'}).label,'앱을 시작하는 중…');assert.equal(connection({...base,running,configured,connectionState:'connecting'}).label,'연결 중입니다. 잠시 기다려 주세요…');
 }
 for(const [setupStatus,label] of [['needs-initialization','연결 초기화 필요'],['needs-permission','권한이 필요합니다'],['failed','연결 실패'],['history-only','로컬 기록(읽기 전용)']])assert.equal(connection({...base,running:false,setupStatus}).label,label);
 assert.equal(connection({...base,connected:true,connectionState:'connecting'}).label,'연결됨');assert.equal(connection({...base,connected:true,connectionState:'connecting'}).waiting,false);
 assert.equal(connection({...base,connectionState:'timeout',retryable:true}).retryable,true);assert.equal(connection({...base,connectionState:'connecting',retryable:true}).retryable,false);
 assert.equal(connection({...base,setupStatus:'recovery-required',connectionState:'connecting',backgroundRunning:true,mainRunning:false}).label,'백그라운드에서 실행 중입니다. 데스크톱이 닫혔습니다.');
 assert.equal(connection({...base,pendingEnable:true,reason:'수동으로 연결해주세요 Claude'}).reason,'클라이언트가 연결되기를 기다리고 있습니다. 준비되면 채팅이 자동으로 나타납니다.');
 const restarting=connection({...base,pendingEnable:true,setupStatus:'failed',connectionState:'error'});
 assert.equal(restarting.label,'앱을 시작하는 중…');assert.equal(restarting.error,false);
 for(const setupStatus of ['needs-initialization','needs-retry','needs-developer-mode','needs-trust','needs-permission','failed'])assert.equal(connection({...base,id:'claude',setupStatus}).canInitialize,true);
 const prepared={...base,id:'claude',setupStatus:'needs-initialization',reconnectSupported:true,canReconnect:true};
 assert.equal(connection(prepared).canReconnect,true);assert.equal(connection(prepared).canInitialize,true);
 assert.equal(connection({...prepared,connectionState:'connecting'}).canReconnect,false);
 assert.equal(connection({...prepared,setupStatus:'owner-conflict'}).canReconnect,true);
 assert.equal(connection({...prepared,canReconnect:false}).canReconnect,false);
 for(const client of [{...base,id:'deepseek',setupStatus:'needs-initialization'},{...base,id:'claude',connected:true,setupStatus:'needs-initialization'},{...base,id:'claude',connectionState:'connecting',setupStatus:'needs-initialization'},{...base,id:'claude',setupStatus:'unsupported'}])assert.equal(connection(client).canInitialize,false);
 assert.equal(connection({...base,setupStatus:'restart-required',retryable:true}).retryable,false);
});

test('lock and desktop-unavailable states stop waiting without disconnecting an existing client',()=>{
 const {connection,sessionNotice}=require('../web/features/clients/client-lifecycle.js');
 for(const [setupStatus,label] of [['needs-unlock','컴퓨터가 잠겼습니다.'],['needs-desktop','컴퓨터 데스크톱을 사용할 수 없음']]){
  const client={id:'claude',enabled:true,installed:true,connected:false,initializationMode:'background',setupStatus,connectionState:'needs-initialization',reason:'Windows가 잠겨 있습니다. 컴퓨터를 잠금 해제한 다음 연결 초기화를 다시 시도하십시오.'};const state=connection(client);
  assert.equal(state.label,label);assert.equal(state.waiting,false);assert.equal(state.canInitialize,true);assert.equal(connection({...client,connected:true}).label,'연결됨');assert.equal(connection({...client,connected:true}).canInitialize,false);
 }
 assert.match(sessionNotice({state:'locked',interactive:false}),/컴퓨터가 잠겨 있습니다\. 백그라운드 서비스는 계속 실행됩니다\. 데스크톱 상호 작용이 필요한 작업을 다시 시도하기 전에 잠금을 해제하세요\./);assert.equal(sessionNotice({state:'unlocked',interactive:true}),'');
});

test('macOS foreground setup keeps explicit desktop waits active until it can resume',()=>{
 const {connection}=require('../web/features/clients/client-lifecycle.js');
 for(const [setupStatus,label] of [['needs-screen-saver','화면 보호기가 끝날 때까지 기다리는 중'],['needs-unlock','잠금 해제를 기다리는 중'],['needs-desktop','데스크탑을 기다리고 있어요']]){
  const client={id:'claude',enabled:true,installed:true,connected:false,initializationMode:'foreground',connectionState:'connecting',setupStatus},state=connection(client);
  assert.equal(state.label,label);assert.equal(state.waiting,true);assert.equal(state.canInitialize,false);assert.equal(state.retryable,false);
  assert.equal(connection({...client,connected:true}).label,'연결됨');
 }
});

test('bounded lifecycle requests abort only their wait and ignore a late result',async()=>{
 const lifecycle=require('../web/features/clients/client-lifecycle.js');let finish,signal;
 const pending=lifecycle.request(value=>{signal=value;return new Promise(resolve=>finish=resolve);},{timeout:5});await assert.rejects(pending,error=>error.uncertain===true&&/결과가 확인되지/.test(error.message));assert.equal(signal.aborted,true);finish('late');await Promise.resolve();await assert.rejects(pending,/작업 결과가 확인되지 않았습니다\. 다시 시도하기 전에 상태를 새로고침하세요\./);
 for(const status of [400,401,409,423])assert.equal(lifecycle.failure('quit',Object.assign(Error('rejected'),{status})).uncertain,false);
 for(const error of [Error('offline'),new SyntaxError('bad response'),Object.assign(Error('server'),{status:500})])assert.equal(lifecycle.failure('quit',error).uncertain,true);
 assert.equal(lifecycle.failure('quit',Error('로컬 작업 시간이 초과되었습니다. 결과를 확인하려면 상태를 새로고침하세요.'),'desktop').uncertain,true);
});
test('Escape and other dialog close events always cancel the desktop exit choice',async()=>{
 for(const escape of [true,false]){
  const ui=fixture(),result=ui.choose({id:'deepseek',name:'DSH'}),dialog=ui.dialog();let prevented=false;
  if(escape)dialog.emit('cancel',{preventDefault(){prevented=true;}});else dialog.close();
  assert.equal(await result,null);assert.equal(prevented,escape);assert.equal(ui.document.body.children.length,0);
 }
});
test('the shared close dialog is fully translated in English and preserves client names',async()=>{
 const ui=fixture('en'),result=ui.choose({id:'claude',name:'Claude Test'}),dialog=ui.dialog();assert.doesNotMatch(dialog.textContent,/[\u4e00-\u9fff]/);assert.match(dialog.textContent,/Claude Test/);assert.match(dialog.textContent,/Disable phone access only/);assert.match(dialog.textContent,/Quit the desktop app normally/);dialog.close();await result;
});
test('both UIs load the shared dialog and desktop packages include it',()=>{
 const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 for(const file of ['web/index.html','desktop/index.html'])assert.match(read(file),/<script[^>]+client-lifecycle\.js/);
 assert.ok(JSON.parse(read('package.json')).build.files.includes('web/features/clients/client-lifecycle.js'));
 assert.match(read('bridge/api/assets.py'),/"\/client-lifecycle\.js"/);
});


test('Claude explains its native quit menu while other clients retain the idle requirement',async()=>{
 for(const language of ['ko','en'])for(const id of ['claude','deepseek','codex']){
  const ui=fixture(language),result=ui.choose({id,name:id}),dialog=ui.dialog(),buttons=dialog.children.at(-1).children,note=buttons[1].children[1].textContent;
  assert.equal(buttons.length,3);assert.doesNotMatch(dialog.textContent,/강제 종료|Force quit/i);
  if(id==='claude'){
   assert.match(note,language==='en'?/Quit normally through Claude's native menu/:/(?:Claude의 네이티브 메뉴를 통해 정상적으로 종료합니다\. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요\. 다음에 Claude를 활성화하면 게이트웨이가 다시 연결을 시도합니다\.|모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 Codex의 네이티브 메뉴를 통해 정상적으로 종료하십시오\. 컴퓨터가 잠겨 있는 동안에는 이 기능을 사용하지 못할 수도 있습니다\. 컴퓨터에서 종료 확인을 처리합니다\.)/);assert.doesNotMatch(note,/may appear briefly|잠깐 나타나다/);
   assert.match(note,language==='en'?/task or save confirmation on your computer/:/Claude의 네이티브 메뉴를 통해 정상적으로 종료합니다\. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요\. 다음에 Claude를 활성화하면 게이트웨이가 다시 연결을 시도합니다\./);
   assert.match(note,language==='en'?/next time.*reconnect/:/Claude의 네이티브 메뉴를 통해 정상적으로 종료합니다\. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요\. 다음에 Claude를 활성화하면 게이트웨이가 다시 연결을 시도합니다\./);
   assert.doesNotMatch(note,/only after all tasks finish|모든 작업이 끝나면/i);
  }else assert.equal(note,language==='en'?'Quit only after all tasks finish and no approvals are pending.':'모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 종료하십시오.');
  if(language==='en')assert.doesNotMatch(dialog.textContent,/[\u4e00-\u9fff]/);
  dialog.close();assert.equal(await result,null);
 }
});


function toggleFixture(ui,surface,client,calls){
  const file=surface==='desktop'?'desktop/features/clients/desktop-sessions.js':'web/features/clients/client-navigation.js';
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ui.context);
  const Class=vm.runInContext(surface==='desktop'?'DesktopConnectionsPanel':'ClientNavigation',ui.context),controller=Object.create(Class.prototype);
  Object.assign(controller,{clients:[client],clientsRevision:0,statusRevision:0,revision:0,pending:new Set(),provider:client.id,renderClients(){},renderScan(){},paint(){},refreshClients:async()=>{},applyClients(value){this.clients=value.clients;},api:{desktopSessions:async body=>{calls.push(body);return {clients:[{...client,enabled:false,running:false}]};}},request:async(url,body)=>{calls.push(body);return {clients:[{...client,enabled:false,running:false}]};}});
  return surface==='desktop'?controller.toggleClient(client.id,false):controller.toggle(client.id,false);
}

test('failed Codex rebuild exposes a cancellable normal-exit risk confirmation on both surfaces',async()=>{
 for(const surface of ['web','desktop'])for(const language of ['ko','en'])for(const accepted of [false,true]){
  const ui=fixture(language),client={id:'codex',name:'Codex',enabled:true,running:true,desktopRestartRecommended:true},calls=[];
  const pending=toggleFixture(ui,surface,client,calls);
  ui.dialog().children.at(-1).children[1].onclick();await Promise.resolve();
  const confirmation=ui.dialog(),buttons=confirmation.children.at(-1).children;
  assert.equal(calls.length,0);assert.equal(ui.document.activeElement,buttons[1]);
  assert.match(confirmation.textContent,language==='ko'?/연결 재구축에 실패하여 일부 작업을 확인하지 못할 수 있습니다\. 정상적인 종료는 해당 작업을 방해할 수 있습니다\. 알려진 활성 작업은 여전히 ​​종료를 차단합니다\. 이 위험을 확인한 다음 종료된 후 Codex를 수동으로 시작하십시오\./:/Normal exit may interrupt.*known active tasks will still block exit/);
  if(language==='en')assert.doesNotMatch(confirmation.textContent,/[\u4e00-\u9fff]/);
  buttons[accepted?0:1].onclick();await pending;
  assert.equal(calls.length,accepted?1:0);
  if(accepted){assert.equal(calls[0].quitDesktop,true);assert.equal(calls[0].acknowledgeUnavailable,true);assert.equal(calls[0].forceDesktop,undefined);}
 }
});


test('ZCode phone disconnect, unknown-state quit and force are independent choices on both surfaces',async()=>{
 for(const surface of ['desktop','web'])for(const selection of ['disconnect','cancel','quit','force']){
  const ui=fixture('en'),client={id:'zcode',name:'ZCode',enabled:true,running:true,canForceQuit:true,confirmTaskState:true};
  const calls=[],pending=toggleFixture(ui,surface,client,calls);
  ui.dialog().children.at(-1).children[selection==='disconnect'?0:selection==='force'?2:1].onclick();await Promise.resolve();
  if(selection!=='disconnect'){
   const confirm=ui.dialog(),buttons=confirm.children.at(-1).children;
   assert.equal(calls.length,0);assert.equal(ui.document.activeElement,buttons[1]);
   assert.match(confirm.textContent,selection==='force'?/Force quit/i:/running task or pending approval/i);
   buttons[selection==='cancel'?1:0].onclick();
  }
  await pending;assert.equal(calls.length,selection==='cancel'?0:1);
  if(calls.length){assert.equal(calls[0].quitDesktop,selection!=='disconnect');assert.equal(!!calls[0].acknowledgeUnavailable,selection==='quit');assert.equal(!!calls[0].forceConfirmed,selection==='force');}
 }
});


test('Antigravity shares desktop identity and only disables phone access',async()=>{
 const ui=fixture();ui.context.URLSearchParams=URLSearchParams;const identity=vm.runInContext('ClientIdentity',ui.context);
 assert.equal(identity.desktop('antigravity'),true);
 assert.equal(identity.path('antigravity','detail','scoped'),'/api/desktop-sessions/antigravity/detail?sessionId=scoped');
 const result=ui.choose({id:'antigravity',name:'Antigravity',canQuitDesktop:false,canForceQuit:false});
 const buttons=ui.dialog().children.at(-1).children;
 assert.equal(buttons.length,2);assert.doesNotMatch(ui.dialog().textContent,/정상적으로 데스크톱 앱 종료|앱 강제 종료/);
 buttons[0].onclick();assert.equal(await result,false);
});
