'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture({accounts=false}={}){
  function node(tag){const value={tag,textContent:'',value:'',hidden:false,disabled:false,children:[],dataset:{},attributes:{},className:'',append(...children){for(const child of children){child.parent=this;this.children.push(child);}},insertBefore(child,before){if(child===before)return child;child.remove();const index=before?this.children.indexOf(before):-1;this.children.splice(index<0?this.children.length:index,0,child);child.parent=this;return child;},replaceChildren(...children){this.children=[];this.append(...children);},after(...children){const at=this.parent.children.indexOf(this)+1;for(const child of children)child.parent=this.parent;this.parent.children.splice(at,0,...children);},setAttribute(k,v){this.attributes[k]=v;},matches(selector){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));const attribute=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);if(attribute){const actual=this.attributes[attribute[1]]??this.dataset[attribute[1].replace(/^data-/,'').replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())];return attribute[2]===undefined?actual!==undefined:actual===attribute[2];}return this.tag===selector;},querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},closest(){return null;}};const events={};Object.assign(value,{addEventListener(type,fn){events[type]=fn;},showModal(){this.open=true;},close(){this.open=false;events.close?.();},remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);},focus(){}});value.classList={toggle(){},add(...names){value.className+=' '+names.join(' ');},contains:name=>value.className.split(' ').includes(name)};return value;}
  const nodes=Object.fromEntries(['client-overview','client-scan-status','refresh-clients','clients-page'].map(id=>[id,node('div')]));
  const input=node('input'),workspace=node('pre'),claudeHome=node('pre'),claudeData=node('div'),statuses={deepseek:node('p'),claude:node('p')},choose=node('button'),scan=node('button');scan.dataset.desktopAction='scan';claudeData.hidden=true;for(const status of Object.values(statuses))status.dataset.i18n='연결 확인 중…';
  const articles={};if(accounts)for(const provider of ['deepseek','claude']){const article=node('article'),automatic=node('div');automatic.className='client-auto-setup';article.append(automatic);if(provider==='deepseek'){const details=node('details'),label=node('label');label.append(input);details.append(label);article.append(details);}articles[provider]=article;}
  const root={hidden:false,querySelector(selector){const provider=selector.includes('deepseek')?'deepseek':'claude';if(selector.includes('.client-auto-setup'))return articles[provider]?.querySelector('.client-auto-setup')||null;if(selector.startsWith('[data-client-config='))return articles[provider]||null;if(selector==='input')return accounts?articles.deepseek.querySelector('input'):input;if(selector==='[data-deepseek-home]')return input;if(selector==='[data-desktop-choose]')return choose;if(selector==='[data-claude-workspace]')return workspace;if(selector==='[data-claude-home]')return claudeHome;if(selector==='[data-claude-data]')return claudeData;return statuses[provider];},querySelectorAll(selector){if(selector==='[data-desktop-status]')return Object.values(statuses);if(selector.includes('data-desktop-action'))return [scan];return Object.values(articles).flatMap(article=>article.querySelectorAll(selector));}};
  const calls=[],errors=[],prompts=[],choices=[],initializations=[];let closeChoice=true,finishChoice,initializeChoice=true,finishInitialize,chosen='',confirmed=true,handler=async body=>body.action==='status'?{backends:{},deepseekHome:'/fixture'}:body.action==='accounts'?{accounts:[]}:{clients:[]};
  const listeners={},timers=[],storage=new Map(),pages=new Map(),selected=[];
  const layout={hasClient:id=>['codex','claude','deepseek'].includes(id)||id.startsWith('codex:')||pages.has(id),clientPage(id){if(pages.has(id))return pages.get(id);const page=node('section');pages.set(id,page);return page;},forgetClient(id){pages.delete(id);this.selectClient(null);},selectClient(id){selected.push(id);listeners['bridge-client-config']?.({detail:id});}};
  const context=vm.createContext({crypto:require('node:crypto').webcrypto,ClientLifecycle:{...require('../web/features/clients/client-lifecycle.js'),chooseDisable(client){choices.push(client.id);return closeChoice==='pending'?new Promise(resolve=>finishChoice=resolve):closeChoice;}},CustomEvent:class{constructor(type){this.type=type;}},document:{body:node('body'),documentElement:{},getElementById:id=>nodes[id],createElement:node,querySelector:()=>null,querySelectorAll:selector=>selector==='[data-i18n]'?Object.values(statuses):[],hidden:false,addEventListener(type,fn){listeners[type]=fn;},removeEventListener(type,fn){if(listeners[type]===fn)delete listeners[type];},dispatchEvent(event){listeners[event.type]?.(event);}},setInterval(fn,ms){timers.push({fn,ms});return timers.length;},clearInterval(id){if(id)timers[id-1]=null;},setTimeout(){},clearTimeout(){},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},window:{confirm:message=>{prompts.push(message);return confirmed;},GatewayLayout:layout}});
  context.ClientLifecycle.chooseInitialize=client=>{initializations.push(client.id);return initializeChoice==='pending'?new Promise(resolve=>finishInitialize=resolve):initializeChoice;};
  for(const file of ['web/shared/i18n.js','web/shared/creation-model-picker.js','web/features/accounts/wsl-accounts.js',...(accounts?['web/features/accounts/api-editor.js','web/features/accounts/client-accounts.js']:[]),'desktop/features/clients/desktop-sessions.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  context.ClientLifecycle.mountConnectionModes=vm.runInContext('(function(){'+fs.readFileSync('web/features/clients/client-lifecycle.js','utf8')+';return ClientLifecycle.mountConnectionModes;})()',context);context.ClientLifecycle.confirmConnectionMode=async()=>confirmed;
  const Class=vm.runInContext('DesktopConnectionsPanel',context),panel=new Class({root,api:{choose:async()=>chosen,cliAccess:body=>{calls.push(body);return handler(body);},desktopSessions:body=>{calls.push(body);return handler(body);}},feedback:message=>errors.push(message)});
  const all=n=>[n,...n.children.flatMap(all)];
  return {panel,nodes,timers,calls,errors,scan,pages,selected,storage,prompts,choices,initializations,setInitializeChoice:value=>initializeChoice=value,decideInitialize:value=>finishInitialize(value),setChoice:value=>closeChoice=value,decide:value=>finishChoice(value),statuses,workspace,claudeHome,claudeData,input,choose,root,document:context.document,setChosen:value=>chosen=value,poll:async()=>{panel.syncPolling();await timers.find(Boolean)?.fn();},apply:()=>vm.runInContext('BridgeI18n.apply()',context),confirm:value=>confirmed=value,setHandler:fn=>handler=fn,all:()=>all(nodes['client-overview']),text:()=>all(nodes['client-overview']).map(n=>n.textContent).join('\n'),english:()=>vm.runInContext("BridgeI18n.setLanguage('en')",context)};
}

test('Antigravity management edits only the selected source session without claiming accounts support',async()=>{
  const ui=fixture(),client={id:'antigravity',name:'Antigravity',enabled:true,installed:true,capabilities:{accounts:false,management:true}};ui.panel.clients=[client];
  const sources=['app','cli','ide'].map(id=>({id,name:id.toUpperCase(),historyAvailable:true,connected:id==='cli',sessions:[{id:id+'-session',title:id,model:'',permissionMode:'desktop'}]}));
  ui.setHandler(async body=>body.operation==='catalog'?{models:[{id:'cli-model',name:'CLI Model'}],cache:{identity:'cli-account'},capabilities:{models:true}}:{enabled:true,surfaces:sources,plugin:{active:true},permissionOptions:[{value:'desktop',label:'PC 처리'},{value:'mobile-ask',label:'모바일 앱 승인'}]});
  await ui.panel.manageClient(client);await new Promise(setImmediate);const root=ui.pages.get('antigravity').querySelector('[data-antigravity-management]');assert.ok(root);
  const [source,session,model,effort,permission]=root.querySelectorAll('select'),buttons=root.querySelectorAll('button');
  assert.equal(source.value,'app');assert.equal(session.value,'app-session');assert.equal(model.disabled,true);assert.equal(permission.disabled,false);
  source.value='cli';await source.onchange();assert.equal(session.value,'cli-session');await buttons.find(b=>b.textContent==='모델 새로 고침').onclick();
  assert.equal(ui.calls.at(-1).surface,'cli');assert.equal(ui.calls.at(-1).sessionId,'cli-session');model.value='cli-model';model.onchange();
  assert.equal(buttons.find(b=>b.textContent==='애플리케이션 모델').disabled,false);
  source.value='ide';source.onchange();assert.equal(model.value,'');assert.equal(buttons.find(b=>b.textContent==='애플리케이션 모델').disabled,true);
  assert.equal(ui.calls.some(body=>body.action==='accounts'),false);
});

test('Antigravity management failures block stale configuration until an explicit reload',async()=>{
  const ui=fixture(),client={id:'antigravity',name:'Antigravity',capabilities:{management:true}};ui.panel.clients=[client];
  ui.setHandler(async()=>{throw Error('구성 읽기 실패');});await ui.panel.manageClient(client);await new Promise(setImmediate);
  const root=ui.pages.get('antigravity').querySelector('[data-antigravity-management]');assert.equal(root.querySelector('[role="alert"]').textContent,'구성 읽기 실패');
  assert.equal(root.querySelectorAll('button').find(b=>b.textContent==='애플리케이션 모델').disabled,true);
  assert.equal(root.querySelectorAll('button').find(b=>b.textContent==='신청 승인 방법').disabled,true);
});

test('first Claude setup guides both permissions without launching, trusting or copying the connector',async()=>{
  const ui=fixture(),workspace='/Users/fixture/로컬 텍스트/아이디어/claude';
  ui.panel.clients=[{id:'claude',installed:true,enabled:true,connected:false}];ui.panel.connectionValue={claudeWorkspace:workspace};
  let granted=false;
  ui.setHandler(async body=>body.action==='claude-prerequisites'?{supported:true,platform:'darwin',workspace,gatewayRunning:false,accessibility:{setupState:(granted||=body.requestPermission===true)?'ready':'needs-permission'}}:{copied:true});
  await ui.panel.showClaudeSetup(true);const dialog=ui.document.body.children[0],buttons=dialog.children.at(-1).children;
  assert.equal(dialog.open,true);assert.equal(dialog.children[5].textContent,workspace);assert.equal(buttons[3].disabled,true);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls)),[{action:'claude-prerequisites'}]);
  await ui.panel.showClaudeSetup(true);assert.equal(ui.document.body.children.length,1);
  await buttons[0].onclick();assert.equal(ui.calls.at(-1).requestPermission,true);assert.match(dialog.children[2].textContent,/접근성: 부여됨/);assert.equal(buttons[3].disabled,true,'public gateway must still be started explicitly');
  await buttons[1].onclick();assert.equal(ui.calls.at(-1).action,'copy-claude-workspace');
  buttons[4].onclick();assert.equal(ui.document.body.children.length,0);assert.equal(ui.panel.choosingClient,null);
  await ui.panel.showClaudeSetup(true);assert.equal(ui.document.body.children.length,0);
  assert.equal(ui.storage.get('claude:setup-guide:'+workspace),'seen');
  await ui.panel.showClaudeSetup();assert.equal(ui.document.body.children.length,1,'manual entry remains available');
  assert.ok(ui.calls.every(call=>['claude-prerequisites','copy-claude-workspace'].includes(call.action)));
});

test('English Claude preparation stays translated and initialization keeps the foreground confirmation',async()=>{
  const ui=fixture();ui.english();ui.panel.clients=[{id:'claude',installed:true,connected:false}];ui.panel.connectionValue={claudeWorkspace:'/fixture'};
  ui.setHandler(async()=>({supported:true,platform:'win32',workspace:'/fixture',gatewayRunning:true,developerMode:true,accessibility:{setupState:'not-required'}}));
  await ui.panel.showClaudeSetup();const dialog=ui.document.body.children[0],buttons=dialog.children.at(-1).children;
  assert.equal(buttons[0].hidden,true);assert.equal(buttons[3].disabled,false);
  for(const child of [...dialog.children,...buttons])assert.doesNotMatch(child.textContent,/[\u4e00-\u9fff]/);
  ui.setInitializeChoice(false);buttons[3].onclick();await Promise.resolve();
  assert.deepEqual(ui.initializations,['claude']);assert.equal(ui.calls.some(call=>call.action==='connect-claude'),false);
});

test('connected and unsupported Claude do not interrupt startup with a setup dialog',async()=>{
  for(const extra of [{connected:true},{installed:false},{setupStatus:'unsupported'}]){
    const ui=fixture();ui.panel.clients=[{id:'claude',installed:true,...extra}];ui.panel.connectionValue={claudeWorkspace:'/fixture'};
    await ui.panel.showClaudeSetup(true);assert.equal(ui.calls.length,0);assert.equal(ui.document.body.children.length,0);
  }
});

test('DSH directory refresh targets its field after real account forms are inserted',async()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'../desktop/index.html'),'utf8'),/<input[^>]*data-deepseek-home/);
  const ui=fixture({accounts:true}),name=ui.panel.ensureAccountPanel('deepseek').nameInput;
  const apiName=ui.panel.accountPanels.deepseek.editName.input;assert.equal(ui.root.querySelector('input'),apiName,'an account editor still precedes the advanced directory');apiName.value='API draft';
  name.value='Saved access';await ui.panel.refresh();assert.equal(ui.input.value,'/fixture');assert.equal(name.value,'Saved access');assert.equal(apiName.value,'API draft');
  ui.input.value='/editing';ui.document.activeElement=ui.input;await ui.panel.refresh();assert.equal(ui.input.value,'/editing');
});

test('desktop progress overrides stale process and configuration snapshots and allows an explicit retry',async()=>{
 const ui=fixture(),client={id:'deepseek',name:'DSH',enabled:true,installed:true,selectable:true,configured:true,running:false,connected:false,connectionState:'connecting',reason:'Harness가 시작되었습니다. 데스크톱 연결을 기다리는 중입니다.'};ui.panel.clients=[client];ui.panel.renderClients();
 assert.match(ui.text(),/연결 중입니다\. 잠시 기다려 주세요…/);assert.doesNotMatch(ui.text(),/앱이 실행되지 않음/);assert.equal(ui.all().find(node=>node.attributes.role==='status').attributes['aria-busy'],'true');
 ui.english();assert.doesNotMatch(ui.text(),/[\u4e00-\u9fff]/);assert.match(ui.text(),/Connecting, please wait/);
 Object.assign(client,{connectionState:'timeout',retryable:true,reason:'Harness 연결 시간이 초과되었습니다. 데스크톱 앱을 확인한 후 다시 시도하세요.'});ui.panel.renderClients();assert.match(ui.text(),/Connection timed out/);
 ui.setHandler(async()=>({clients:[{...client,connectionState:'connecting',retryable:false}]}));await ui.all().find(node=>node.textContent==='Retry connection').onclick();assert.equal(ui.calls[0].action,'toggle-client');assert.equal(ui.calls[0].enabled,true);assert.equal(ui.calls[0].provider,'deepseek');
});

test('desktop fast polling is limited to visible startup states and deduplicates active reads',async()=>{
 const ui=fixture();ui.panel.clients=[{id:'deepseek',enabled:true,connectionState:'connecting'}];let finish;ui.setHandler(()=>new Promise(resolve=>finish=resolve));const pending=ui.panel.pollClients(true);const duplicate=ui.panel.pollClients(true);assert.equal(ui.calls.length,1);
 finish({clients:[{id:'deepseek',enabled:true,connectionState:'connected',connected:true}]});await Promise.all([pending,duplicate]);await ui.panel.pollClients(true);assert.equal(ui.calls.length,1);
 ui.panel.clients[0].connectionState='starting';ui.panel.clients[0].connected=false;ui.document.hidden=true;await ui.panel.pollClients(true);assert.equal(ui.calls.length,1);ui.document.hidden=false;ui.nodes['clients-page'].hidden=true;await ui.panel.pollClients(true);assert.equal(ui.calls.length,1);
});

test('DSH directory picker and plugin actions never use the account name field',async()=>{
  const ui=fixture({accounts:true}),name=ui.panel.ensureAccountPanel('deepseek').nameInput;name.value='Saved access';
  const selected='F:\\Harness 데이터\\profile';ui.setChosen(selected);await ui.choose.onclick();
  assert.equal(ui.input.value,selected);assert.equal(name.value,'Saved access');
  for(const action of ['install-deepseek','remove-deepseek']){ui.input.value=' '+selected+' ';await ui.panel.action(action);assert.equal(ui.calls.find(call=>call.action===action).home,selected);assert.equal(name.value,'Saved access');}
});
test('scan discovers clients without connecting apps and ignores duplicate scans',async()=>{
  const ui=fixture();let finish;
  ui.setHandler(body=>body.action==='scan'?new Promise(resolve=>finish=resolve):Promise.resolve(body.action==='status'?{backends:{}}:{clients:[]}));
  const pending=ui.panel.scan();await ui.panel.scan();assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].action,'scan');assert.equal(ui.calls[0].setup,false);assert.ok(ui.nodes['refresh-clients'].disabled);
  finish({clients:[]});await pending;assert.equal(ui.nodes['refresh-clients'].disabled,false);assert.deepEqual(ui.calls.map(c=>c.action),['scan','status']);
});
test('Claude unknown-state quit is a separate explicitly confirmed desktop action',async()=>{
  const ui=fixture(),client={id:'claude',name:'Claude',installed:true,configured:true,connected:false,enabled:true,running:true,canConfirmQuit:true,reason:'연결이 끊어졌습니다'};
  ui.panel.clients=[client];ui.panel.renderClients();
  ui.setHandler(async body=>body.action==='claude-quit-preview'?{token:'fixture-preview',canQuit:true,requiresUnknownConfirmation:true}:body.action==='status'?{backends:{}}:{clients:[client]});
  ui.confirm(false);await ui.all().find(n=>n.textContent==='Claude 종료…').onclick();
  assert.ok(ui.prompts[0].includes('작업이 중단될 수 있습니다'));assert.match(ui.prompts[0],/Claude Desktop을 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다\. 정말 그만두시겠어요\?/);assert.equal(ui.calls.some(c=>c.action==='claude-quit-confirm'),false);assert.equal(client.enabled,true);
  ui.confirm(true);await ui.all().find(n=>n.textContent==='Claude 종료…').onclick();
  const value=ui.calls.find(c=>c.action==='claude-quit-confirm');assert.equal(value.token,'fixture-preview');assert.equal(value.confirmed,true);assert.equal(value.acknowledgeUnknown,true);
  assert.equal(ui.calls.some(c=>['toggle-client','restart-claude','connect-claude'].includes(c.action)),false);
});
test('the separate desktop Claude quit confirmation includes the unlock warning in English',async()=>{
  for(const requiresUnknownConfirmation of [false,true]){
    const ui=fixture(),client={id:'claude',name:'Claude',installed:true,connected:false,enabled:true,running:true,canConfirmQuit:true};ui.english();ui.panel.clients=[client];ui.panel.renderClients();
    ui.setHandler(async body=>body.action==='claude-quit-preview'?{token:'fixture-preview',canQuit:true,requiresUnknownConfirmation}:body.action==='status'?{backends:{}}:{clients:[client]});ui.confirm(false);await ui.panel.quitClaude();
    assert.equal(ui.prompts.length,1);assert.match(ui.prompts[0],/After restarting Claude Desktop.*computer to be unlocked/);assert.doesNotMatch(ui.prompts[0],/[\u4e00-\u9fff]/);assert.equal(ui.calls.some(c=>c.action==='claude-quit-confirm'),false);
    if(requiresUnknownConfirmation)assert.match(ui.prompts[0],/interrupt/i);
  }
});
test('Claude known busy tasks never receive the unknown-state quit confirmation',async()=>{
  const ui=fixture();ui.panel.clients=[{id:'claude',name:'Claude',installed:true,connected:false,enabled:true,running:true,canConfirmQuit:true}];ui.panel.renderClients();
  ui.setHandler(async body=>body.action==='claude-quit-preview'?{token:'fixture-preview',canQuit:false,busy:true}:body.action==='status'?{backends:{}}:{clients:ui.panel.clients});
  await ui.all().find(n=>n.textContent==='Claude 종료…').onclick();assert.equal(ui.prompts.length,0);assert.equal(ui.calls.some(c=>c.action==='claude-quit-confirm'),false);assert.ok(ui.errors.some(x=>x.includes('작업이 실행 중')));
});
test('Claude desktop blockers retain their own labels and allow cancelling pending connection',async()=>{
  for(const [setupStatus,label] of [['needs-screen-saver','화면 보호기가 끝날 때까지 기다리는 중'],['needs-unlock','잠금 해제를 기다리는 중'],['needs-desktop','데스크톱을 기다리고 있어요']])for(const running of [true,false]){
    const ui=fixture(),client={id:'claude',name:'Claude',installed:true,configured:true,connected:false,enabled:true,running,setupStatus,reason:'waiting reason'};ui.panel.clients=[client];ui.panel.renderClients();
    assert.match(ui.text(),new RegExp(label));ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.all().find(n=>n.textContent==='연결 취소').onclick();assert.equal(ui.calls[0].action,'cancel-claude');
  }
});
test('installed but unsupported Claude is never shown as connected or switchable; original icons remain',()=>{
  const ui=fixture();ui.english();ui.panel.clients=[{id:'claude',name:'Claude',installed:true,configured:false,connected:false,enabled:false,setupStatus:'unsupported',reason:'이 Claude 데스크톱 버전은 자동 액세스를 제한하므로 아직 연결할 수 없습니다.'}];ui.panel.renderClients();
  assert.match(ui.text(),/Automatic access unavailable/);assert.doesNotMatch(ui.text(),/[\u4e00-\u9fff]/);assert.match(ui.text(),/restricts automatic access/);assert.ok(ui.all().find(n=>n.tag==='input').disabled);assert.equal(ui.all().find(n=>n.tag==='img').src,'../web/client-icons/claude.png');
});
test('an offline read failure preserves established configuration instead of inventing unconfigured rows',async()=>{
  const ui=fixture(),clients=[{id:'codex',name:'Codex',configured:true,connected:false,enabled:true,reason:'연결 준비됨'}];ui.panel.clients=clients;ui.panel.renderClients();ui.setHandler(async()=>{throw Error('read unavailable');});await ui.panel.refreshClients();
  assert.equal(ui.panel.clients,clients);assert.match(ui.text(),/Codex/);assert.match(ui.nodes['client-scan-status'].textContent,/read unavailable/);
});
test('failed automatic scan reports failure, then can recover through the same rescan control',async()=>{
  const ui=fixture();ui.setHandler(async body=>{if(body.action==='scan')throw Error('setup failed');return body.action==='status'?{backends:{}}:{clients:[]};});await ui.panel.scan(true);
  assert.deepEqual(ui.errors,['setup failed']);assert.equal(ui.nodes['refresh-clients'].disabled,false);assert.match(ui.nodes['client-scan-status'].textContent,/setup failed/);
  ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[]});await ui.nodes['refresh-clients'].onclick();assert.equal(ui.panel.scanError,false);assert.match(ui.nodes['client-scan-status'].textContent,/스캔이 완료되었습니다\. 연결 상태는 아래와 같습니다\./);
});

test('DSH restart button requires explicit confirmation and never starts the public gateway',async()=>{
  const ui=fixture(),clients=[{id:'deepseek',name:'DSH',installed:true,configured:false,connected:false,enabled:false,setupStatus:'restart-required',reason:'현재 작업을 완료하고 Harness를 다시 시작하여 연결하세요.'}];
  ui.panel.clients=clients;ui.panel.renderClients();ui.confirm(false);await ui.all().find(n=>n.textContent==='다시 시작 및 연결').onclick();assert.equal(ui.calls.length,0);assert.equal(ui.prompts.length,1);
  ui.confirm(true);ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients});await ui.all().find(n=>n.textContent==='다시 시작 및 연결').onclick();assert.equal(ui.calls[0].action,'restart-deepseek');assert.equal(ui.calls.some(c=>c.action==='start'),false);assert.ok(ui.errors.includes('Harness가 연결되기를 기다리는 중'));
});
test('DSH first-open action triggers a follow-up scan and uses no manual directory',async()=>{
  const ui=fixture(),clients=[{id:'deepseek',name:'DSH',installed:true,configured:false,connected:false,enabled:false,setupStatus:'needs-first-launch',reason:'Harness를 열고 초기 설정을 마친 후 다시 스캔하세요.'}];
  ui.panel.clients=clients;ui.panel.renderClients();ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients});await ui.all().find(n=>n.textContent==='열기 및 연결').onclick();
  assert.equal(ui.calls[0].action,'connect-deepseek');assert.equal(ui.calls[0].home,undefined);assert.equal(ui.calls.some(c=>c.action==='scan'&&c.setup===false),true);
});

test('Claude setup exposes native permission and developer confirmation without enabling an unverified connection',async()=>{
  const ui=fixture();ui.english();const client={id:'claude',name:'Claude',installed:true,configured:false,connected:false,enabled:false,setupStatus:'needs-permission',reason:'Claude 커넥터가 시스템 설정에서 접근성을 사용하도록 허용합니다. 권한이 부여된 후에 연결이 계속됩니다.'};
  ui.panel.clients=[client];ui.panel.renderClients();
  assert.match(ui.text(),/Permission required/);assert.doesNotMatch(ui.text(),/[\u4e00-\u9fff]/);assert.equal(ui.all().find(n=>n.tag==='input').disabled,true);
  ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.all().find(n=>n.textContent==='Authorize & connect').onclick();assert.equal(ui.calls[0].action,'connect-claude');
  client.setupStatus='needs-developer-mode';client.reason='계속 연결하려면 Claude의 개발자 모드 프롬프트를 확인하세요.';ui.panel.renderClients();
  assert.match(ui.text(),/Developer mode confirmation required/);assert.doesNotMatch(ui.text(),/[\u4e00-\u9fff]/);
  await ui.all().find(n=>n.textContent==='Retry initialization').onclick();assert.ok(ui.calls.some(c=>c.action==='connect-claude'));
  client.setupStatus='connecting';ui.panel.renderClients();await ui.all().find(n=>n.textContent==='Cancel connection').onclick();assert.ok(ui.calls.some(c=>c.action==='cancel-claude'));
});

test('Claude connection recovery waits for an explicit initialization click and explains foreground use',async()=>{
  const ui=fixture();const client={id:'claude',name:'Claude',installed:true,configured:true,connected:false,running:false,enabled:true,setupStatus:'needs-initialization',reason:'Claude가 기존 연결을 복원할 수 없습니다. 연결 초기화를 선택합니다. 초기화에서는 전경 창을 사용합니다. 컴퓨터 바탕화면을 대화형으로 유지하세요.'};
  ui.panel.clients=[client];ui.panel.renderClients();ui.panel.renderScan();
  assert.match(ui.text(),/연결 초기화 필요/);assert.match(ui.text(),/Claude가 기존 연결을 복원할 수 없습니다\. 연결 초기화를 선택합니다\. 초기화에서는 전경 창을 사용합니다\. 컴퓨터 바탕화면을 대화형으로 유지하세요\./);assert.doesNotMatch(ui.text(),/연결 실패/);
  ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.poll();
  assert.equal(ui.calls.some(call=>call.action==='connect-claude'),false);
  await ui.all().find(node=>node.tag==='button'&&node.textContent==='연결 초기화').onclick();assert.ok(ui.calls.some(call=>call.action==='connect-claude'));assert.deepEqual(ui.initializations,['claude']);
  ui.english();assert.match(ui.text(),/Connection initialization required/);assert.match(ui.text(),/Initialization uses the foreground window/);assert.doesNotMatch(ui.text(),/[\u4e00-\u9fff]/);
});

test('desktop ZCode access switch stays separate from private-pipe initialization',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',configured:true,installed:true,enabled:false,canInitializeDesktop:true,pipeSupported:true,initializationMode:'private-pipe'};
 ui.panel.clients=[client];ui.panel.renderClients();ui.setHandler(async()=>({clients:[{...client,enabled:true}]}));
 await ui.panel.toggleClient('zcode',true);
 const writes=()=>ui.calls.filter(call=>call.action==='toggle-client');
 assert.equal(writes().length,1);assert.equal(writes()[0].initializeDesktop,undefined);assert.deepEqual(ui.initializations,[]);
 ui.setInitializeChoice(false);await ui.all().find(node=>node.tag==='button'&&node.textContent==='연결 초기화').onclick();
 assert.equal(writes().length,1);assert.deepEqual(ui.initializations,['zcode']);
 ui.panel.operationFailures=new Map([['zcode',{action:'initialize',uncertain:false}]]);ui.setInitializeChoice(true);
 await ui.panel.retryOperation('zcode');assert.equal(writes().at(-1).initializeDesktop,true);assert.equal(writes().at(-1).provider,'zcode');
});

test('failed ZCode enable keeps initialization reachable and retry requests consent',async()=>{
 for(const uncertain of [false,true]){
  const ui=fixture(),client={id:'zcode',name:'ZCode',configured:true,installed:true,enabled:true,canInitializeDesktop:true,pipeSupported:true,connectionMode:'private-pipe',setupStatus:'needs-initialization'};
  ui.panel.clients=[client];ui.panel.operationFailures=new Map([['zcode',{action:'enable',uncertain,message:'Initialize local connection first',connectionMode:'private-pipe'}]]);
  ui.setHandler(async()=>({clients:[client]}));ui.panel.renderClients();
  const initialize=ui.all().find(node=>node.tag==='button'&&node.textContent==='연결 초기화');
  assert.equal(!!initialize,!uncertain);
  if(uncertain){await ui.panel.retryOperation('zcode');assert.equal(ui.initializations.length,0);assert.equal(ui.calls.length,0);continue;}
  ui.setInitializeChoice(false);await ui.panel.retryOperation('zcode');assert.deepEqual(ui.initializations,['zcode']);assert.equal(ui.calls.length,0);
  ui.setInitializeChoice({connectionMode:'private-pipe'});await initialize.onclick();
  const writes=ui.calls.filter(call=>call.action==='toggle-client');assert.equal(writes.length,1);assert.equal(writes[0].initializeDesktop,true);assert.equal(writes[0].connectionMode,'private-pipe');
 }
});

test('retrying an official ZCode connection preserves its transport without local initialization',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',configured:true,installed:true,enabled:true,canInitializeDesktop:true,pipeSupported:true,connectionMode:'private-pipe'};
 ui.panel.clients=[client];ui.panel.operationFailures=new Map([['zcode',{action:'enable',uncertain:false,connectionMode:'official-remote'}]]);
 ui.setHandler(async()=>({clients:[client]}));await ui.panel.retryOperation('zcode');
 const writes=ui.calls.filter(call=>call.action==='toggle-client');assert.equal(writes.length,1);assert.equal(writes[0].connectionMode,'official-remote');assert.equal(writes[0].initializeDesktop,undefined);assert.equal(ui.initializations.length,0);
});

test('desktop enabling and retrying Claude never submit initialization intent',async()=>{
  const ui=fixture(),client={id:'claude',name:'Claude',enabled:false,installed:true,configured:true,initializationMode:'foreground',setupStatus:'needs-initialization',connected:false};ui.panel.clients=[client];
  ui.setHandler(async()=>({clients:[{...client,enabled:true}]}));await ui.panel.toggleClient('claude',true);
  ui.panel.operationFailures=new Map([['claude',{action:'enable',uncertain:false,message:'retry'}]]);await ui.panel.retryOperation('claude');
  const writes=ui.calls.filter(call=>call.action==='toggle-client');assert.equal(writes.length,2);assert.ok(writes.every(call=>call.enabled&&!Object.hasOwn(call,'initializeDesktop')));assert.equal(ui.calls.some(call=>call.action==='connect-claude'),false);assert.equal(ui.initializations.length,0);
});

test('desktop Claude initialization and restart require a confirmed initialization choice',async()=>{
  for(const action of ['connect-claude','restart-claude'])for(const accepted of [false,true]){
    const ui=fixture(),client={id:'claude',name:'Claude',enabled:true,installed:true,configured:true,initializationMode:'foreground',setupStatus:'needs-initialization'};ui.panel.clients=[client];ui.setInitializeChoice(accepted);
    ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.panel.action(action);
    assert.deepEqual(ui.initializations,['claude']);assert.equal(ui.calls.filter(call=>call.action===action).length,accepted?1:0);if(!accepted)assert.equal(ui.calls.length,0);
  }
});

test('desktop pending initialization choice blocks duplicate actions and stale status reads',async()=>{
  const ui=fixture(),client={id:'claude',name:'Claude',enabled:true,installed:true,configured:true,initializationMode:'foreground',setupStatus:'needs-initialization'};ui.panel.clients=[client];ui.setInitializeChoice('pending');let finishRead;
  ui.setHandler(()=>new Promise(resolve=>finishRead=resolve));const reading=ui.panel.refreshClients(),initializing=ui.panel.action('connect-claude');
  await ui.panel.action('connect-claude');await ui.panel.toggleClient('claude',true);await ui.panel.scan();await ui.panel.refreshClients();assert.equal(ui.calls.length,1);assert.equal(ui.initializations.length,1);
  finishRead({clients:[]});await reading;assert.equal(ui.panel.clients.length,1);ui.decideInitialize(false);await initializing;assert.equal(ui.calls.length,1);assert.equal(ui.panel.choosingClient,null);
});

test('Claude restart requires confirmation and connected clients no longer offer setup actions',async()=>{
  const ui=fixture(),client={id:'claude',name:'Claude',installed:true,configured:false,connected:false,enabled:false,setupStatus:'restart-required',reason:'Claude 콘솔을 찾을 수 없습니다. 현재 작업을 완료한 다음 Claude를 다시 시작하고 다시 연결하세요.'};
  ui.panel.clients=[client];ui.panel.renderClients();ui.confirm(false);await ui.all().find(n=>n.textContent==='다시 시작 및 연결').onclick();assert.equal(ui.calls.length,0);
  ui.confirm(true);ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.all().find(n=>n.textContent==='다시 시작 및 연결').onclick();assert.equal(ui.calls[0].action,'restart-claude');
  Object.assign(client,{configured:true,connected:true,enabled:true,setupStatus:'connected',reason:'데스크톱 연결 가능'});ui.panel.renderClients();assert.equal(ui.all().find(n=>n.tag==='input').disabled,false);assert.ok(!ui.all().some(n=>n.tag==='button'&&/연결|연결/.test(n.textContent)));
});

const clientState=reason=>({id:'claude',name:'Claude',installed:true,configured:false,connected:false,enabled:false,setupStatus:'failed',reason});
test('periodic client refresh keeps list and open detail status on the same snapshot',async()=>{
  const ui=fixture();ui.panel.clients=[clientState('대기 중 Claude 연결')];ui.panel.renderClients();await ui.panel.refresh();
  ui.setHandler(async()=>({clients:[clientState('Claude에서 연결 확인이 없습니다. 로그인 및 디렉터리 신뢰를 확인한 후 다시 시도하세요.')]}));await ui.poll();
  assert.match(ui.text(),/Claude에서 연결 확인이 없습니다\. 로그인 및 디렉터리 신뢰를 확인한 후 다시 시도하세요\./);assert.equal(ui.statuses.claude.textContent,'Claude에서 연결 확인이 없습니다. 로그인 및 디렉터리 신뢰를 확인한 후 다시 시도하세요.');
});
test('concurrent status and client reads converge regardless of completion order',async()=>{
  for(const statusFirst of [true,false]){
    const ui=fixture();ui.panel.clients=[clientState('이전 연결 상태')];ui.panel.renderClients();let status,clients;
    ui.setHandler(body=>new Promise(resolve=>{if(body.action==='status')status=resolve;else clients=resolve;}));
    const readingStatus=ui.panel.refresh(),readingClients=ui.panel.refreshClients();
    if(statusFirst){status({backends:{claude:{connected:false}},claudeWorkspace:'/bridge/claude'});await readingStatus;clients({clients:[clientState('새로운 연결 결과')]});await readingClients;}
    else{clients({clients:[clientState('새로운 연결 결과')]});await readingClients;status({backends:{claude:{connected:false}},claudeWorkspace:'/bridge/claude'});await readingStatus;}
    assert.match(ui.text(),/새로운 연결 결과/);assert.equal(ui.statuses.claude.textContent,'새로운 연결 결과');
  }
});
test('late pre-scan client read cannot replace the scan result',async()=>{
  const ui=fixture(),current=clientState('스캔된 연결 결과');let finishOld,clientReads=0;
  ui.setHandler(body=>body.action==='clients'?++clientReads===1?new Promise(resolve=>finishOld=resolve):Promise.resolve({clients:[current]}):Promise.resolve(body.action==='status'?{backends:{}}:{clients:[current]}));
  const reading=ui.panel.refreshClients(),scanning=ui.panel.scan();await Promise.resolve();finishOld({clients:[clientState('스캔 전 이전 결과')]});await Promise.all([reading,scanning]);
  assert.match(ui.text(),/스캔된 연결 결과/);assert.doesNotMatch(ui.text(),/스캔 전 이전 결과/);assert.equal(ui.statuses.claude.textContent,current.reason);
});
test('changing language preserves the latest detail state through the global translation pass',()=>{
  const ui=fixture();ui.panel.clients=[clientState('Claude에서 연결 확인이 없습니다. 로그인 및 디렉터리 신뢰를 확인한 후 다시 시도하세요.')];ui.panel.renderClients();ui.english();ui.apply();
  assert.match(ui.statuses.claude.textContent,/No connection confirmation/);assert.doesNotMatch(ui.statuses.claude.textContent,/Checking|[\u4e00-\u9fff]/);
});
test('Claude diagnostics distinguish gateway communication and detected client data directories',async()=>{
  const ui=fixture();ui.setHandler(async()=>({backends:{claude:{connected:false,dataHome:'/actual/Claude'}},claudeWorkspace:'/bridge/desktop-sessions/claude'}));await ui.panel.refresh();
  assert.equal(ui.workspace.textContent,'/bridge/desktop-sessions/claude');assert.equal(ui.claudeHome.textContent,'/actual/Claude');assert.equal(ui.claudeData.hidden,false);
  ui.setHandler(async()=>({backends:{claude:{connected:false}},claudeWorkspace:'/bridge/desktop-sessions/claude'}));await ui.panel.refresh();assert.equal(ui.claudeData.hidden,true);assert.equal(ui.claudeHome.textContent,'');
  const html=fs.readFileSync(path.join(__dirname,'../desktop/index.html'),'utf8');assert.match(html,/data-i18n="게이트웨이 통신 디렉토리"/);assert.match(html,/data-i18n="Claude 데이터 디렉토리"/);
});
test('older status response cannot restore a stale diagnostic directory',async()=>{
  const ui=fixture(),pending=[];ui.setHandler(()=>new Promise(resolve=>pending.push(resolve)));const old=ui.panel.refresh(),latest=ui.panel.refresh();
  pending[1]({backends:{},claudeWorkspace:'/new/claude'});await latest;pending[0]({backends:{},claudeWorkspace:'/old/claude'});await old;assert.equal(ui.workspace.textContent,'/new/claude');
});
test('process quit starts after a choice, excludes duplicates and rolls back a refused quit',async()=>{
  const ui=fixture(),client={id:'claude',name:'Claude',configured:true,enabled:true,connected:true,reason:'데스크톱 연결 가능'};let reject;
  ui.panel.clients=[client];ui.setHandler(body=>body.action==='toggle-client'?new Promise((_,failed)=>reject=failed):Promise.resolve({clients:[client]}));
  const pending=ui.panel.toggleClient('claude',false);await Promise.resolve();
  assert.equal(ui.panel.clients[0].enabled,false);assert.match(ui.text(),/앱을 종료하는 중…/);assert.ok(ui.all().find(n=>n.tag==='input').disabled);
  await ui.panel.toggleClient('claude',true);await ui.panel.scan();assert.equal(ui.calls.length,1);
  reject(Error('실행 중이거나 확인을 기다리는 작업이 있습니다.'));await pending;
  assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.panel.busy,false);assert.equal(ui.all().find(n=>n.tag==='input').disabled,false);assert.deepEqual(ui.errors,['실행 중이거나 확인을 기다리는 작업이 있습니다.']);
});

test('desktop uncertain quit remains blocked after a failed read, then permits a confirmed retry',async()=>{
 const ui=fixture(),client={id:'claude',name:'Claude',enabled:true,configured:true,installed:true,connected:true,running:true};ui.panel.clients=[client];ui.panel.lifecycleTimeout=5;let finish,readable=false;
 ui.setHandler(body=>body.action==='toggle-client'?new Promise(resolve=>finish=resolve):readable?Promise.resolve({clients:[client]}):Promise.reject(Error('status offline')));
 await ui.panel.toggleClient('claude',false);assert.equal(ui.panel.busy,false);assert.equal(ui.panel.hasUncertain(),true);assert.equal(ui.panel.clients[0].connected,true);assert.match(ui.text(),/작업 결과가 확인되지 않았습니다\. 다시 시도하기 전에 상태를 새로고침하세요\./);assert.ok(ui.all().some(node=>node.textContent==='상태 새로고침'));const count=ui.calls.length;
 await ui.panel.retryOperation('claude');await ui.panel.pollClients();assert.equal(ui.calls.length,count);await ui.panel.refreshClients(true);assert.equal(ui.panel.hasUncertain(),true);
 readable=true;await ui.panel.refreshClients(true);assert.equal(ui.panel.hasUncertain(),false);finish({clients:[{...client,enabled:false,connected:false,running:false}]});await Promise.resolve();await Promise.resolve();assert.equal(ui.panel.clients[0].connected,true);
 ui.setChoice(null);await ui.all().find(node=>node.textContent==='종료 다시 시도').onclick();assert.equal(ui.choices.length,2);assert.equal(ui.calls.filter(call=>call.action==='toggle-client').length,1);
});

test('desktop lock status provides an explicit initialization retry while keeping existing connections usable',()=>{
 const ui=fixture();ui.panel.windowsSession={state:'locked',interactive:false};ui.panel.clients=[{id:'claude',name:'Claude',enabled:true,installed:true,configured:true,connected:false,initializationMode:'background',setupStatus:'needs-unlock',connectionState:'needs-initialization'}];ui.panel.renderClients();ui.panel.renderScan();assert.match(ui.text(),/컴퓨터가 잠겼습니다\./);assert.match(ui.nodes['client-scan-status'].textContent,/컴퓨터가 잠겨 있습니다\. 백그라운드 서비스는 계속 실행됩니다\. 데스크톱 상호 작용이 필요한 작업을 다시 시도하기 전에 잠금을 해제하세요\./);assert.ok(ui.all().some(node=>node.textContent==='초기화 재시도'));
 ui.panel.clients[0].connected=true;ui.panel.renderClients();assert.equal(ui.all().find(node=>node.attributes.role==='status').textContent,'연결됨');ui.panel.windowsSession={state:'unlocked',interactive:true};ui.panel.renderClients();assert.equal(ui.calls.length,0);
});

test('desktop restart, cancel and plugin timeouts require reconciliation and retry the original action',async()=>{
 for(const action of ['restart-deepseek','cancel-claude','install-deepseek','remove-deepseek']){
  const ui=fixture(),id=action.endsWith('-claude')?'claude':'deepseek',client={id,name:id,enabled:true,installed:true,configured:true,running:true,connected:true};ui.panel.clients=[client];ui.panel.lifecycleTimeout=5;let finish,readable=false;
  ui.setHandler(body=>body.action===action?new Promise(resolve=>finish=resolve):readable?Promise.resolve(body.action==='status'?{backends:{}}:{clients:[client]}):Promise.reject(Error('status offline')));
  await ui.panel.action(action);assert.equal(ui.panel.hasUncertain(),true,action);assert.equal(ui.panel.operationFailures.get(id).desktopAction,action);const count=ui.calls.length;
  await ui.panel.action(action);await ui.panel.recoverDeepseek(true);await ui.panel.retryOperation(id);assert.equal(ui.calls.length,count);assert.equal(ui.panel.clients[0].connected,true);
  readable=true;await ui.panel.refreshClients(true);assert.equal(ui.panel.hasUncertain(),false);assert.ok(ui.panel.operationFailures.has(id),'an already-running client does not prove the operation succeeded');
  finish({clients:[{...client,connected:false}]});await Promise.resolve();await Promise.resolve();assert.equal(ui.panel.clients[0].connected,true);
  if(action==='restart-deepseek'){ui.confirm(false);await ui.panel.retryOperation(id);assert.equal(ui.calls.filter(row=>row.action===action).length,1);ui.confirm(true);}
  ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client]});await ui.panel.retryOperation(id);assert.equal(ui.calls.filter(row=>row.action===action).length,2);assert.equal(ui.calls.filter(row=>row.action==='toggle-client').length,0);
 }
});

test('timed-out DSH recovery requires a fresh preview and confirmation before retry',async()=>{
 const ui=fixture(),client={id:'deepseek',name:'DSH',enabled:true,installed:true,configured:true,running:true,connected:true};ui.panel.clients=[client];ui.panel.lifecycleTimeout=5;let finish,readable=false,previews=0;
 ui.setHandler(body=>body.action==='deepseek-recovery-preview'?Promise.resolve({token:'preview-'+(++previews),canRecover:true}):body.action==='deepseek-recovery-confirm'?new Promise(resolve=>finish=resolve):readable?Promise.resolve(body.action==='status'?{backends:{}}:{clients:[client]}):Promise.reject(Error('status offline')));
 await ui.panel.recoverDeepseek(true);assert.equal(ui.panel.hasUncertain(),true);const count=ui.calls.length;await ui.panel.retryOperation('deepseek');assert.equal(ui.calls.length,count);
 readable=true;await ui.panel.refreshClients(true);assert.equal(ui.panel.hasUncertain(),false);finish({clients:[{...client,connected:false}]});await Promise.resolve();await Promise.resolve();assert.equal(ui.panel.clients[0].connected,true);
 ui.confirm(false);await ui.panel.retryOperation('deepseek');assert.equal(previews,2);assert.equal(ui.calls.filter(row=>row.action==='deepseek-recovery-confirm').length,1);
 ui.confirm(true);ui.setHandler(async body=>body.action==='deepseek-recovery-preview'?{token:'fresh-preview',canRecover:true}:body.action==='status'?{backends:{}}:{clients:[client]});await ui.panel.retryOperation('deepseek');const confirms=ui.calls.filter(row=>row.action==='deepseek-recovery-confirm');assert.equal(confirms.length,2);assert.equal(confirms[1].token,'fresh-preview');assert.equal(ui.prompts.length,3);
});

test('DSH recovery preview timeout never submits a mutation or marks its outcome unknown',async()=>{
 const ui=fixture();ui.panel.clients=[];ui.panel.statusTimeout=5;ui.setHandler(body=>body.action==='deepseek-recovery-preview'?new Promise(()=>{}):Promise.resolve(body.action==='status'?{backends:{}}:{clients:[]}));await ui.panel.recoverDeepseek(true);assert.equal(ui.panel.hasUncertain(),false);assert.equal(ui.panel.busy,false);assert.equal(ui.calls.filter(row=>row.action==='deepseek-recovery-confirm').length,0);assert.equal(ui.prompts.length,0);
});

test('DSH recovery uses a preview token and explicit acknowledgment for unknown background tasks',async()=>{
 const ui=fixture();ui.english();const clients=[{id:'deepseek',name:'DSH',enabled:true,configured:true,connected:false,running:true,mainRunning:false,backgroundRunning:true,reason:'앱이 구성되었으며 열 준비가 되었습니다.'}];ui.panel.clients=clients;
 ui.setHandler(async body=>body.action==='deepseek-recovery-preview'?{token:'review-token',canRecover:true,busy:false,requiresUnknownConfirmation:true,guiCount:0,backgroundCount:2}:body.action==='status'?{backends:{}}:{clients});
 await ui.panel.recoverDeepseek(true);const actions=ui.calls.filter(row=>row.action.startsWith('deepseek-recovery'));assert.equal(actions.length,2);assert.equal(actions[0].restart,true);assert.equal(actions[1].token,'review-token');assert.equal(actions[1].acknowledgeUnknown,true);assert.equal(actions[1].confirmed,true);assert.equal(actions[1].pid,undefined);assert.match(ui.prompts[0],/could not be verified/);assert.doesNotMatch(ui.prompts[0],/[\u4e00-\u9fff]/);assert.ok(!ui.errors.includes('DSH가 다시 연결됨'));
});
test('busy DSH tasks prevent recovery and cancelling the preview never quits a client',async()=>{
 for(const busy of [true,false]){
  const ui=fixture();ui.panel.clients=[];ui.confirm(false);ui.setHandler(async body=>body.action==='deepseek-recovery-preview'?{token:'cancel',canRecover:!busy,busy,guiCount:1,backgroundCount:1}:body.action==='status'?{backends:{}}:{clients:[]});
  await ui.panel.recoverDeepseek(false);assert.equal(ui.calls.filter(row=>row.action==='deepseek-recovery-confirm').length,0);assert.equal(ui.prompts.length,busy?0:1);assert.equal(ui.panel.busy,false);
 }
});
test('background-only Harness exposes recovery instead of the legacy restart path',()=>{
 const ui=fixture();ui.panel.clients=[{id:'deepseek',name:'DSH',installed:true,configured:true,enabled:true,connected:true,running:true,mainRunning:false,backgroundRunning:true,setupStatus:'restart-required',reason:'연결 준비됨'}];ui.panel.renderClients();assert.match(ui.text(),/백그라운드에서 실행 중입니다\. 데스크톱이 닫혔습니다\./);assert.ok(ui.all().some(row=>row.tag==='button'&&row.textContent==='복구 및 다시 연결'));assert.ok(!ui.all().some(row=>row.tag==='button'&&row.textContent==='다시 시작 및 연결'));
});


test('desktop close choices pass explicit quit intent and distinguish pending status',async()=>{
 for(const choice of [false,true,'force']){
  const quitDesktop=choice!==false,forceDesktop=choice==='force';
  const ui=fixture();ui.setChoice(choice);const client={id:'claude',name:'Claude',enabled:true,configured:true,running:true,connected:true,canForceQuit:true};ui.panel.clients=[client];ui.panel.gatewayRunning=true;let finish;
  const result={...client,enabled:false,running:!quitDesktop,connected:false};
  ui.setHandler(body=>body.action==='toggle-client'?new Promise(resolve=>finish=resolve):Promise.resolve({clients:[result]}));
  const pending=ui.panel.toggleClient('claude',false);assert.equal(ui.panel.clients[0].enabled,true);await Promise.resolve();
  assert.equal(ui.calls[0].quitDesktop,quitDesktop);assert.equal(Object.hasOwn(ui.calls[0],'forceDesktop'),forceDesktop);if(forceDesktop)assert.equal(ui.calls[0].forceDesktop,true);
  assert.match(ui.text(),forceDesktop?/백그라운드에서 강제 종료 중…/:quitDesktop?/앱을 종료하는 중…/:/액세스를 비활성화하는 중…/);
  finish({clients:[result]});await pending;assert.equal(ui.panel.clients[0].running,!quitDesktop);assert.equal(ui.panel.clients[0].enabled,false);
 }
});
test('a desktop force quit retry requires a new choice and can fall back to normal quit',async()=>{
 const ui=fixture(),client={id:'claude',name:'Claude',enabled:true,configured:true,running:true,canForceQuit:true};ui.panel.clients=[client];ui.setChoice('force');
 ui.setHandler(async body=>{if(body.action==='toggle-client')throw Error('rejected');return {clients:[client]};});await ui.panel.toggleClient('claude',false);
 assert.equal(ui.panel.operationFailures.get('claude').action,'force');assert.equal(ui.panel.clients[0].enabled,true);
 ui.setChoice(null);await ui.panel.retryOperation('claude');assert.equal(ui.choices.length,2);assert.equal(ui.calls.filter(call=>call.action==='toggle-client').length,1);
 ui.setChoice(true);ui.setHandler(async()=>({clients:[{...client,enabled:false,running:false}]}));await ui.panel.retryOperation('claude');
 const calls=ui.calls.filter(call=>call.action==='toggle-client');assert.equal(ui.choices.length,3);assert.equal(calls.length,2);assert.equal(calls[1].quitDesktop,true);assert.equal(Object.hasOwn(calls[1],'forceDesktop'),false);
});
test('cancelling the desktop close choice restores the checkbox without any API request',async()=>{
 const ui=fixture();ui.setChoice(null);ui.panel.clients=[{id:'claude',name:'Claude',enabled:true,configured:true}];ui.panel.renderClients();
 const checkbox=ui.all().find(node=>node.tag==='input');checkbox.checked=false;await checkbox.onchange();
 assert.equal(ui.calls.length,0);assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.all().find(node=>node.tag==='input').checked,true);assert.equal(ui.panel.choosingClient,null);
});
test('desktop close choice blocks duplicate lifecycle actions and stale client reads',async()=>{
 const ui=fixture();ui.setChoice('pending');ui.panel.clients=[{id:'claude',name:'Claude',enabled:true,configured:true}];let finishRead;
 ui.setHandler(()=>new Promise(resolve=>finishRead=resolve));const read=ui.panel.refreshClients(),pending=ui.panel.toggleClient('claude',false);
 await ui.panel.toggleClient('claude',false);await ui.panel.scan();await ui.panel.action('connect-claude');assert.equal(ui.choices.length,1);assert.equal(ui.calls.length,1);
 finishRead({clients:[]});await read;assert.equal(ui.panel.clients.length,1);ui.decide(null);await pending;assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.calls.length,1);
});
test('desktop can disable an enabled client after discovery becomes unavailable',async()=>{
 const ui=fixture();ui.setChoice(false);const client={id:'claude',name:'Claude',enabled:true,configured:false,selectable:false,installed:false};ui.panel.clients=[client];ui.panel.renderClients();
 assert.equal(!!ui.all().find(node=>node.tag==='input').disabled,false);
 ui.setHandler(async()=>({clients:[{...client,enabled:false}]}));await ui.panel.toggleClient('claude',false);assert.equal(ui.calls[0].quitDesktop,false);assert.equal(ui.panel.clients[0].enabled,false);
 const count=ui.calls.length;await ui.panel.toggleClient('claude',true);assert.equal(ui.calls.length,count);
});
test('desktop only-disable failure restores enabled state and the running app',async()=>{
 const ui=fixture();ui.setChoice(false);const client={id:'claude',name:'Claude',enabled:true,configured:true,running:true};ui.panel.clients=[client];
 ui.setHandler(async body=>{if(body.action==='toggle-client')throw Error('cannot save');return {clients:[client]};});await ui.panel.toggleClient('claude',false);
 assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.panel.clients[0].running,true);assert.deepEqual(ui.errors,['cannot save']);
});
test('desktop stopped-gateway switches save preferences without a quit choice',async()=>{
 const ui=fixture(),client={id:'claude',name:'Claude',enabled:true,configured:true};ui.panel.clients=[client];ui.panel.gatewayRunning=false;
 ui.setHandler(async body=>({clients:body.action==='toggle-client'?[{...client,enabled:body.enabled}]:ui.panel.clients}));
 await ui.panel.toggleClient('claude',false);assert.equal(ui.choices.length,0);assert.equal(ui.calls[0].quitDesktop,false);
 await ui.panel.toggleClient('claude',true);const enable=ui.calls.find(call=>call.action==='toggle-client'&&call.enabled);assert.equal(Object.hasOwn(enable,'quitDesktop'),false);
 assert.equal(ui.calls.some(call=>Object.hasOwn(call,'forceDesktop')),false);
});

test('desktop offers force only inside close choices and retains a disabled running app exit',async()=>{
 for(const id of ['codex','claude','deepseek']){
  const ui=fixture(),client={id,name:id,enabled:true,configured:true,installed:true,running:true,connected:true,canForceQuit:true};ui.panel.clients=[client];ui.panel.gatewayRunning=true;ui.panel.renderClients();
  assert.equal(ui.all().some(node=>node.textContent==='앱 강제 종료'),false);assert.equal(ui.all().some(node=>node.textContent==='데스크톱 앱 닫기…'),false);
  Object.assign(client,{enabled:false,configured:false,selectable:false,connected:false});ui.panel.renderClients();
  const close=ui.all().find(node=>node.textContent==='데스크톱 앱 닫기…');assert.ok(close);assert.equal(!!close.disabled,false);assert.equal(!!ui.all().find(node=>node.tag==='input').disabled,true);
  ui.setChoice(null);await close.onclick();assert.deepEqual(ui.choices,[id]);assert.equal(ui.calls.length,0);
  ui.english();assert.ok(ui.all().some(node=>node.textContent==='Close desktop app…'));assert.equal(ui.all().some(node=>node.textContent==='Force quit App'),false);
  ui.setChoice('force');ui.setHandler(async()=>({clients:[{...client,running:false}]}));await close.onclick();const body=ui.calls.find(call=>call.action==='toggle-client');
  assert.equal(body.enabled,false);assert.equal(body.quitDesktop,true);assert.equal(body.forceDesktop,true);assert.equal(body.forceConfirmed,true);assert.equal(ui.all().some(node=>node.textContent==='Close desktop app…'),false);
  ui.panel.clients=[{...client,running:true}];ui.panel.gatewayRunning=false;ui.panel.renderClients();assert.equal(ui.all().some(node=>node.textContent==='Close desktop app…'),false);
 }
});

function codexEntries({native=true,wsl=true,nativeSelectable=true}={}){
 const entry='wsl:'+'c'.repeat(32);
 return {id:'codex',name:'Codex',enabled:native||wsl,configured:true,selectable:true,installed:true,running:wsl,connected:wsl,desktopEnabled:native,entries:[
  {id:'desktop',kind:'desktop',name:'Codex',enabled:native,configured:nativeSelectable,selectable:nativeSelectable,installed:nativeSelectable,running:false,connected:false,canQuitDesktop:false},
  {id:entry,kind:'wsl-cli',icon:'codex',name:'WSL Codex · Ubuntu',enabled:wsl,configured:true,selectable:true,installed:true,running:wsl,connected:wsl,canQuitDesktop:false}
 ]};
}
test('desktop client management keeps native and WSL rows without redundant provider headings',()=>{
 const ui=fixture();ui.panel.clients=[codexEntries()];ui.panel.renderClients();
 const rows=ui.all().filter(node=>node.tag==='tr'),group=rows.find(row=>row.children[0]?.attributes.scope==='rowgroup');assert.equal(group,undefined);assert.ok(ui.all().some(node=>node.tag==='strong'&&node.textContent==='Codex'));assert.ok(ui.all().some(node=>node.tag==='strong'&&node.textContent==='WSL Codex · Ubuntu'));
 const entries=rows.filter(row=>row.dataset.clientParent==='codex');assert.deepEqual(entries.map(row=>row.dataset.clientId),['codex','wsl:'+'c'.repeat(32)]);
 assert.equal(ui.all().filter(node=>node.tag==='input'&&node.className==='client-toggle').length,2);assert.equal(ui.all().some(node=>node.textContent==='데스크톱 앱 닫기…'),false);
});
test('desktop native Codex disable preserves WSL-only availability while the write is pending',async()=>{
 const ui=fixture();ui.panel.clients=[codexEntries()];ui.panel.refreshClients=async()=>{};let finish;ui.setHandler(()=>new Promise(resolve=>finish=resolve));
 const disabling=ui.panel.toggleClient('codex',false);assert.equal(ui.choices.length,0);assert.equal(ui.panel.clients[0].desktopEnabled,false);assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.panel.clients[0].entries[1].enabled,true);
 assert.equal(ui.calls[0].provider,'codex');assert.equal(ui.calls[0].enabled,false);finish({clients:ui.panel.clients});await disabling;
});
test('desktop WSL disable only changes its own environment and skips native quit choices',async()=>{
 const ui=fixture();ui.panel.clients=[codexEntries()];ui.panel.refreshClients=async()=>{};const id=ui.panel.clients[0].entries[1].id;
 ui.setHandler(async()=>({clients:ui.panel.clients}));await ui.panel.toggleClient(id,false);
 assert.equal(ui.choices.length,0);assert.equal(ui.calls[0].provider,id);assert.equal(ui.calls[0].quitDesktop,false);assert.equal(ui.panel.clients[0].entries[1].enabled,false);assert.equal(ui.panel.clients[0].desktopEnabled,true);assert.equal(ui.panel.clients[0].enabled,true);
});
test('desktop aggregate WSL readiness cannot enable an unavailable native Codex entry',async()=>{
 const ui=fixture();ui.panel.clients=[codexEntries({native:false,nativeSelectable:false})];ui.panel.renderClients();
 assert.equal(ui.all().some(row=>row.dataset.clientId==='codex'),false);assert.ok(ui.all().some(row=>row.dataset.clientId?.startsWith('wsl:')));await ui.panel.toggleClient('codex',true);assert.equal(ui.calls.length,0);
});
test('desktop reconciliation checks native quit against the native entry while WSL stays connected',async()=>{
 const ui=fixture(),client=codexEntries({native:false});ui.panel.clients=[client];ui.panel.operationFailures=new Map([['codex',{action:'quit',uncertain:true,message:'pending'}]]);
 ui.setHandler(async()=>({clients:[client]}));await ui.panel.refreshClients();assert.equal(ui.panel.operationFailures.has('codex'),false);assert.equal(ui.panel.clients[0].enabled,true);assert.equal(ui.panel.clients[0].connected,true);
});

test('desktop WSL Manage buttons mount the real account panel for the exact provider and entry',async()=>{
 for(const [provider,kind,prefix] of [['codex','wsl-cli','wsl:'],['claude','wsl-claude-cli','wsl-claude:']]){
  const ui=fixture(),entry=prefix+'a'.repeat(32),client={id:entry,kind,name:'Fixture WSL',configured:true,enabled:true,installed:true,canQuitDesktop:false};ui.panel.clients=[client];
  ui.setHandler(async value=>{assert.equal(value.action,'wslAccounts');assert.equal(value.provider,provider);assert.equal(value.entry,entry);return{provider,entry,identity:'fixture',available:true,target:{distribution:'Fixture',user:'tester',configDir:'/home/tester/.config'},accounts:[],blockers:['External CLI remains running'],capabilities:{save:true,import:true,capture:false,switch:false}};});
  ui.panel.renderClients();assert.ok(ui.text().includes('이 게이트웨이에서 WSL 계정 및 API를 관리하세요.'));const button=ui.all().find(node=>node.tag==='button'&&node.textContent==='관리');const panel=await button.onclick();await new Promise(resolve=>setImmediate(resolve));
  const page=ui.pages.get(entry),account=ui.panel.managementPages.get(entry).panel;
  assert.ok(page);assert.equal(ui.selected.at(-1),entry);assert.equal(ui.document.body.children.length,0);assert.equal(page.children[0].children[0].textContent,'Fixture WSL');const labels=page.querySelectorAll('button').map(node=>node.textContent);assert.ok(labels.includes('API 액세스 저장'));assert.ok(labels.includes('이 컴퓨터에서 API 액세스 가져오기'));assert.equal(labels.includes('스위치 확인'),false);assert.equal(account.entry,entry);
  await button.onclick();assert.equal(ui.pages.size,1,'reuse the management page');
 }
});

test('desktop list starts only the selected enabled WSL through the existing account action',async(t)=>{
 for(const [provider,kind,prefix] of [['codex','wsl-cli','wsl:'],['claude','wsl-claude-cli','wsl-claude:']]){
  const ui=fixture(),client={id:prefix+'b'.repeat(32),kind,name:'WSL fixture',enabled:true,configured:true,installed:true,distributionRunning:false,connected:false};
  ui.panel.clients=[client];ui.panel.gatewayRunning=true;let finish,refreshes=0;t.after(()=>finish?.({}));
  ui.setHandler(()=>new Promise(resolve=>finish=resolve));ui.panel.refreshClients=async()=>{refreshes++;};ui.panel.renderClients();
  const button=ui.all().find(n=>n.tag==='button'&&n.textContent==='WSL 시작 및 연결');assert.ok(button);
  const pending=button.onclick();await ui.panel.connectWsl(client.id);
  assert.equal(ui.calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(ui.calls[0])),{action:'wslAccounts',provider,entry:client.id,operation:'connect'});
  assert.equal(ui.all().find(n=>n.tag==='button'&&n.textContent==='연결 중입니다. 잠시 기다려 주세요…').disabled,true);
  finish({provider,entry:client.id,available:true});await pending;
  assert.equal(refreshes,1);assert.equal(client.connected,false,'starting WSL does not prove a CLI connection');assert.equal(client.enabled,true);
  for(const change of [{enabled:false},{distributionRunning:true},{connected:true}]){
   ui.panel.clients=[{...client,...change}];ui.panel.renderClients();assert.equal(ui.all().some(n=>n.tag==='button'&&n.textContent==='WSL 시작 및 연결'),false);
  }
  ui.panel.clients=[client];ui.panel.gatewayRunning=false;await ui.panel.connectWsl(client.id);assert.equal(ui.calls.length,1);
 }
});
test('desktop WSL resource is optional and remains in the package',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../desktop/index.html'),'utf8');assert.ok(html.includes('../web/features/accounts/account.css'));assert.equal(html.includes('src="../web/features/accounts/wsl-accounts.js"'),false);assert.ok(fs.existsSync(path.join(__dirname,'../web/features/accounts/wsl-accounts.js')));
});

test('Codex overview shows unsaved native login quota and refreshes that exact login',async()=>{
 const ui=fixture();ui.document.querySelector=selector=>ui.all().find(node=>node.matches(selector))||null;
 ui.panel.clients=[{id:'codex',name:'Codex',enabled:true,configured:true}];ui.panel.renderClients();
 const login={id:'native-login',kind:'chatgpt',name:'fixture@example.invalid',details:{usage:{status:'ready',resetCredits:{availableCount:2},limits:[{name:'5h',windows:[{remainingPercent:75}]}]}}};
 const value={activeId:null,accounts:[],loginAccount:login,current:{name:login.name}};
 ui.panel.renderAccount(value);assert.match(ui.text(),/75%/);assert.match(ui.text(),/사용량 재설정 · 2/);assert.equal(ui.all().find(node=>node.tag==='progress').value,75);
 const calls=[];ui.panel.api.accounts=async request=>{calls.push(request);return value;};await ui.all().find(node=>node.textContent==='남은 사용 한도 보기').onclick();assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'details',id:'native-login',section:'usage',refresh:true}]);
 ui.panel.renderAccount({accounts:[{...login,id:'another'}],activeId:null,current:{name:'Unknown'}});assert.doesNotMatch(ui.text(),/75%|사용량 재설정/);
});

test('absent unconfigured clients do not occupy the list, but offline configured bindings remain',async()=>{
 const ui=fixture();
 ui.panel.clients=[{id:'codex',name:'Codex',installed:true},{id:'claude',name:'Claude',installed:false,configured:false,enabled:false},{id:'deepseek',name:'DSH',bindingMode:'manual',connected:false}];
 ui.panel.renderClients();assert.match(ui.text(),/Codex/);assert.doesNotMatch(ui.text(),/Claude/);assert.match(ui.text(),/DSH/);
 ui.panel.clients=[{id:'claude',name:'Claude',configured:true,installed:false}];ui.panel.renderClients();assert.match(ui.text(),/Claude/);
 ui.panel.clients=[];ui.panel.renderClients();assert.match(ui.text(),/클라이언트를 찾을 수 없습니다\. 클라이언트를 추가하거나 다시 검사하세요\./);
 ui.setHandler(async()=>({capabilities:[{family:'codex',kind:'codex-local',supported:true},{family:'claude',kind:'desktop-profile',supported:true},{family:'deepseek',kind:'desktop-profile',supported:true},{family:'zcode',supported:false,reason:'기본 연결만'}]}));
 await ui.panel.addClient();const dialog=ui.document.body.children[0],buttons=dialog.children[1].children;
 assert.equal(dialog.open,true);assert.deepEqual(buttons.map(button=>button.textContent),['Codex','Claude','DSH','ZCode · 기본 연결만','Antigravity','취소']);assert.equal(buttons[3].disabled,true);assert.equal(buttons[4].disabled,true);buttons[3].onclick();assert.equal(dialog.open,true);await buttons[2].onclick();assert.notEqual(ui.document.body.children[0],dialog);assert.match(ui.document.body.children[0].querySelector('h2').textContent,/DSH/);assert.equal(ui.selected.length,0,'adding never opens the default account page');
});

test('ZCode uses its own logo and shared next-level management page',async()=>{
  const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,connected:true,enabled:true,
    canQuitDesktop:false,description:'연결 ZCode 네이티브 채팅',accountNotice:'에서 ZCode 중간 관리 모델 및 계정',configurationNotice:'기본 테스트 채팅에만 액세스'};
  ui.panel.clients=[client];ui.panel.renderClients();
  assert.ok(ui.all().some(node=>node.tag==='img'&&node.src==='../web/client-icons/zcode.png'));
  assert.match(ui.text(),/연결 ZCode 네이티브 채팅/);assert.match(ui.text(),/에서 ZCode 중간 관리 모델 및 계정/);
  assert.doesNotMatch(ui.text(),/Harness의 계정 \/ API 관리/);
  await ui.all().find(node=>node.tag==='button'&&node.textContent==='관리').onclick();
  assert.equal(ui.selected.at(-1),'zcode');assert.ok(ui.pages.get('zcode'));assert.equal(ui.document.body.children.length,0);assert.deepEqual(ui.calls.map(value=>value.action),['zcode-official-state']);
});

test('ZCode management removes the compatibility port even from legacy descriptors',async()=>{
 for(const capability of [{},{compatibilitySupported:false},{compatibilitySupported:true,compatibilityLaunch:true}]){
  const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,...capability};
  ui.panel.clients=[client];await ui.panel.manageClient(client);
  assert.equal(ui.pages.get('zcode').querySelector('[data-zcode-compatibility]'),null);
  assert.deepEqual(ui.calls.map(value=>value.action),['zcode-official-state']);
 }
});

const connectionModes=[{id:'private-pipe',label:'로컬 연결',description:'게이트웨이로 시작됨 App。',configured:true,available:true},{id:'official-remote',label:'공식 원격 연결',description:'원본을 사용하세요 App 같은 공식 계정。',configured:true,available:true}];
test('ZCode management shares its mode picker and refreshes official state only on opening or explicit actions',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,connectionMode:'private-pipe',connectionModes};ui.panel.clients=[client];
 const state={configured:true,connected:false,selected:false,accountName:'Fixture account',provider:'z.ai',link:'https://zcode.z.ai/pair?fixture=one'};
 ui.setHandler(async request=>request.action==='clients'?{clients:[client]}:{...state});await ui.panel.manageClient(client);
 const page=ui.pages.get('zcode'),section=page.querySelector('[data-zcode-official]'),text=()=>section.querySelectorAll('p').map(node=>node.textContent).join('\n'),modes=page.querySelector('[data-client-connection-modes]');
 const guide=section.querySelector('[data-zcode-official-guide]');assert.equal(guide.open,false);assert.equal(guide.querySelectorAll('li').length,7);guide.open=true;
 assert.equal(section.className,'accounts-panel');assert.equal(modes.querySelector('[data-connection-mode="private-pipe"]').attributes['aria-pressed'],'true');assert.match(text(),/이 컴퓨터에서 ZCode와 동일한 공식 계정을 사용하고 원래 앱에서 웹 원격 제어를 활성화하십시오\. 채팅 데이터는 ZCode의 공식 릴레이를 통해 전달됩니다\./);assert.match(text(),/이 컴퓨터에서 ZCode와 동일한 공식 계정을 사용하고 원래 앱에서 웹 원격 제어를 활성화하십시오\. 채팅 데이터는 ZCode의 공식 릴레이를 통해 전달됩니다\./);assert.match(text(),/Fixture account/);
 assert.equal(page.querySelector('[data-zcode-compatibility]'),null);assert.deepEqual(ui.calls.map(value=>value.action),['zcode-official-state']);
 await ui.poll();assert.equal(ui.calls.filter(value=>value.action==='zcode-official-state').length,1);
 await ui.panel.manageClient(client);assert.equal(ui.pages.size,1);assert.equal(ui.calls.filter(value=>value.action==='zcode-official-state').length,2);
 const input=section.querySelector('input');input.value='https://zcode.z.ai/pair?fixture=edited';input.oninput();
 client.connectionMode='official-remote';ui.panel.renderClients();assert.equal(modes.querySelector('[data-connection-mode="official-remote"]').attributes['aria-pressed'],'true');
 await section.querySelectorAll('button').find(button=>button.textContent==='상태 새로고침').onclick();
 assert.equal(guide.open,true,'A status refresh preserves the user-opened instructions');
 assert.equal(input.value,'https://zcode.z.ai/pair?fixture=edited');assert.match(text(),/연결 설정에 저장되지 않은 변경 사항이 있습니다\./);assert.equal(section.querySelector('[data-official-action="connect"]').disabled,true);
});

test('official settings save independently and connect through the shared client mode action',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,connectionMode:'private-pipe',connectionModes};ui.panel.clients=[client];
 const state={configured:false,connected:false,selected:false,link:''};
 ui.setHandler(async request=>{if(request.action==='clients')return {clients:[client]};if(request.action==='zcode-official-save')state.link=request.link;if(request.action==='zcode-official-login')Object.assign(state,{configured:true,accountName:'Signed in'});if(request.action==='toggle-client'){Object.assign(state,{connected:true,selected:true});client.connectionMode=request.connectionMode;return {clients:[client]};}if(request.action==='zcode-official-disconnect')state.connected=false;if(request.action==='zcode-official-forget')Object.assign(state,{configured:false,connected:false,selected:false});return {...state};});
 await ui.panel.manageClient(client);const section=ui.pages.get('zcode').querySelector('[data-zcode-official]'),input=section.querySelector('input'),button=action=>section.querySelector('[data-official-action="'+action+'"]');
 const guide=section.querySelector('[data-zcode-official-guide]');assert.equal(guide.open,true);guide.open=false;
 assert.equal(button('login').disabled,true);assert.equal(button('connect').disabled,true);assert.equal(button('local'),null);
 input.value='https://zcode.z.ai/pair?fixture=selected';input.oninput();assert.equal(button('login').disabled,true);
 await button('save').onclick();assert.equal(state.configured,false);assert.equal(button('login').disabled,false);assert.equal(button('save').disabled,true);
 assert.equal(guide.open,false,'Saving does not reopen instructions the user collapsed');
 await button('login').onclick();assert.equal(button('connect').disabled,false);await button('connect').onclick();assert.equal(button('disconnect').disabled,false);
 assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.filter(value=>['zcode-official-save','zcode-official-login','toggle-client'].includes(value.action)))),[{action:'zcode-official-save',link:input.value},{action:'zcode-official-login',link:input.value},{action:'toggle-client',provider:'zcode',enabled:true,connectionMode:'official-remote'}]);
 await button('disconnect').onclick();assert.equal(state.selected,true);assert.equal(state.configured,true);
 const count=ui.calls.length;ui.confirm(false);await button('forget').onclick();assert.equal(ui.calls.length,count);assert.match(ui.prompts.at(-1),/게이트웨이의 저장된 공식 로그인을 제거하고 공식 원격 연결을 끊으시겠습니까\? 저장된 링크, 원래 ZCode 앱의 계정 및 작업은 유지됩니다\./);
 ui.confirm(true);await button('forget').onclick();assert.equal(state.configured,false);assert.equal(input.value,state.link);assert.ok(state.link);
});

test('official actions block overlap and reread state after a failed save without losing the draft',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,connectionMode:'private-pipe',connectionModes};ui.panel.clients=[client];let finish;
 const state={configured:true,connected:false,selected:false,link:'https://zcode.z.ai/pair?fixture=one'};
 ui.setHandler(request=>request.action==='clients'?Promise.resolve({clients:[client]}):request.action==='zcode-official-save'?new Promise((resolve,reject)=>finish=reject):Promise.resolve({...state}));
 await ui.panel.manageClient(client);const page=ui.pages.get('zcode'),section=page.querySelector('[data-zcode-official]'),input=section.querySelector('input'),save=section.querySelector('[data-official-action="save"]'),connect=section.querySelector('[data-official-action="connect"]');
 input.value='https://zcode.z.ai/pair?fixture=edited';input.oninput();const pending=save.onclick();await save.onclick();assert.equal(save.disabled,true);assert.equal(connect.disabled,true);assert.equal(ui.calls.filter(value=>value.action==='zcode-official-save').length,1);
 finish(Error('settings temporarily unavailable'));await pending;assert.equal(input.value,'https://zcode.z.ai/pair?fixture=edited');assert.ok(ui.errors.includes('settings temporarily unavailable'));assert.equal(ui.panel.busy,false);assert.equal(connect.disabled,true);assert.equal(save.disabled,false);
 ui.setHandler(async()=>{throw Error('state unavailable');});await ui.panel.zcodeOfficial.refresh();assert.equal(connect.disabled,true);assert.equal(save.disabled,true);assert.match(section.querySelectorAll('p').map(node=>node.textContent).join('\n'),/state unavailable/);
});

test('shared independent profile form scans, picks and manually saves the selected family without starting it',async()=>{
 for(const [family,label,kind,prefix] of [['codex','Codex','codex-local','codex:'],['claude','Claude','desktop-profile','claude-profile:'],['deepseek','DSH','desktop-profile','deepseek-profile:']]){
  const ui=fixture(),profile={id:prefix+'a'.repeat(32),family,kind,home:'/fixture/profile',label:'Independent',name:'Independent',configured:true};
  ui.setHandler(async body=>body.action==='client-profiles'?body.operation==='save'?{instance:{...profile,home:body.home,label:body.label,name:body.label},instances:[profile]}:{capabilities:[{family,kind,supported:true}],candidates:[profile,{family:'other',kind,home:'/wrong',label:'Wrong'}]}:{clients:[profile]});
  if(family==='codex')await ui.panel.codexProfile();else await ui.panel.clientProfile(family);
  const dialog=ui.document.body.children[0],form=dialog.querySelector('form'),inputs=form.querySelectorAll('input'),button=text=>form.querySelectorAll('button').find(b=>b.textContent===text);
  assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].operation,'list');assert.equal(form.querySelector('.error').textContent,'');
  assert.ok(button('설정 저장'));assert.equal(form.querySelectorAll('label')[1].textContent,label+' 구성 디렉터리');
  await button('구성 검색').onclick();assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.at(-1))),{action:'client-profiles',operation:'scan',family,kind});assert.equal(button('/wrong'),undefined);
  button(profile.home).onclick();assert.equal(inputs[1].value,profile.home);
  ui.setChosen('/fixture/chosen');await button('폴더 선택').onclick();assert.equal(inputs[1].value,'/fixture/chosen');
  inputs[1].value='/fixture/manual';inputs[0].value='Manual profile';await form.onsubmit({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.find(c=>c.operation==='save'))),{action:'client-profiles',operation:'save',family,kind,home:'/fixture/manual',label:'Manual profile'});
  assert.ok(!ui.calls.some(c=>['initialize','resume','start','toggle-client'].includes(c.action)));
  assert.equal(dialog.open,false);assert.ok(ui.errors.includes(label+' 클라이언트가 저장되었습니다.'));assert.equal(ui.selected.at(-1),profile.id);
 }
});

test('independent native management reuses account controls and scopes every account request to the entry',async()=>{
 for(const family of ['claude','deepseek']){
  const ui=fixture({accounts:true}),entry=family+'-profile:'+'b'.repeat(32),client={id:entry,family,kind:'desktop-profile',name:'Independent '+family,configured:true,capabilities:{accounts:true}};
  ui.setHandler(async()=>({accounts:[],activeIds:[],capabilities:{},models:[]}));
  await ui.panel.manageClient(client);const account=ui.panel.accountPanels[entry];assert.ok(account);assert.equal(account.provider,family);assert.equal(ui.selected.at(-1),entry);assert.ok(ui.pages.get(entry));
  ui.calls.length=0;await account.read();await account.request({action:'models-draft',entry:'other',provider:'other',baseUrl:'https://fixture.invalid'});await account.readModels(true);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls)),[{action:'accounts',provider:family,entry,operation:'list'},{action:'accounts',provider:family,entry,operation:'models-draft',baseUrl:'https://fixture.invalid'},{action:'account',provider:family,entry,refresh:true}]);
  await ui.panel.manageClient(client);assert.equal(ui.pages.size,1);assert.equal(ui.panel.accountPanels[entry],account);
 }
});

test('independent client removal confirms scope and does not quit or erase native data',async()=>{
 for(const family of ['codex','claude','deepseek']){
  const ui=fixture(),id=family+':'+'b'.repeat(32),client={id,family,kind:family==='codex'?'codex-local':'desktop-profile',name:'Independent',enabled:true,configured:true};ui.panel.clients=[client];
  ui.setHandler(async body=>body.action==='clients'?{clients:[]}:{removed:id});
  await ui.panel.manageClient(client);const control=ui.panel.removalControls.get(id);assert.ok(control);const remove=control.querySelector('button');
  await remove.onclick();assert.equal(ui.calls.length,0);assert.match(ui.errors.at(-1),/구성을 제거하기 전에 이 클라이언트에 대한 모바일 액세스를 비활성화하십시오\./);
  client.enabled=false;ui.confirm(false);await remove.onclick();assert.equal(ui.calls.length,0);assert.match(ui.prompts.at(-1),/이 클라이언트 구성을 삭제하시겠습니까\? 해당 애플리케이션, 계정, 채팅 및 구성 파일은 보존됩니다\./);
  ui.confirm(true);await remove.onclick();assert.deepEqual(JSON.parse(JSON.stringify(ui.calls[0])),{action:'client-profiles',operation:'remove',family,entry:id,confirmed:true});
  assert.equal(ui.panel.removalControls.has(id),false);assert.equal(ui.selected.at(-1),null);assert.ok(!ui.calls.some(row=>['stop','quit','initialize'].includes(row.action)));
 }
 const ui=fixture();await ui.panel.manageClient({id:'codex',name:'Codex'});assert.equal(ui.panel.removalControls.size,0);
});

test('failed removal preserves the independent management page for retry',async()=>{
 const ui=fixture(),id='deepseek:'+'d'.repeat(32),client={id,family:'deepseek',kind:'desktop-profile',name:'Independent',enabled:false};ui.panel.clients=[client];
 ui.setHandler(async()=>{throw Error('Pending operation');});await ui.panel.manageClient(client);const control=ui.panel.removalControls.get(id);
 await control.querySelector('button').onclick();assert.equal(ui.panel.removalControls.get(id),control);assert.equal(control.querySelector('button').disabled,false);assert.equal(ui.selected.at(-1),id);
});

test('profile errors retain the form and unsupported capabilities never open a default page',async()=>{
 const ui=fixture();ui.setHandler(async()=>({capabilities:[{family:'claude',kind:'desktop-profile',supported:false,reason:'Unsupported on this host'}]}));
 await ui.panel.clientProfile('claude');assert.equal(ui.document.body.children.length,0);assert.equal(ui.selected.length,0);assert.ok(ui.errors.includes('Unsupported on this host'));
 ui.setHandler(async body=>{if(body.operation==='save')throw Error('Configuration directory is already used');return {capabilities:[{family:'claude',kind:'desktop-profile',supported:true}]};});
 await ui.panel.clientProfile('claude');const dialog=ui.document.body.children[0],form=dialog.querySelector('form');form.querySelectorAll('input')[1].value='/duplicate';await form.onsubmit({preventDefault(){}});
 assert.equal(dialog.open,true);assert.match(form.querySelector('.error').textContent,/already used/);assert.equal(ui.selected.length,0);
});


test('saved installation inventory loads first and only missing inventory or manual rescan discovers clients',async()=>{
 const ui=fixture();let inventory=true;
 ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[],inventoryAvailable:inventory});
 await ui.panel.loadClients();await ui.panel.loadClients();
 assert.equal(ui.calls.filter(body=>body.action==='scan').length,0);
 inventory=false;await ui.panel.loadClients();
 assert.equal(ui.calls.filter(body=>body.action==='scan').length,1);
 assert.equal(ui.calls.find(body=>body.action==='scan').inventoryOnly,true);
 inventory=true;await ui.panel.loadClients();await ui.panel.scan(true);
 assert.equal(ui.calls.filter(body=>body.action==='scan').at(-1).inventoryOnly,false);
});

test('partial WSL inventory keeps discovered clients and its error until an explicit successful rescan',async()=>{
 const ui=fixture(),client={id:'wsl:'+'a'.repeat(32),kind:'wsl-cli',name:'WSL Codex',installed:true,configured:true,enabled:false};let errors=[{distribution:'Ubuntu',error:'Claude Code inventory unavailable'}];
 ui.setHandler(async body=>body.action==='status'?{backends:{}}:{clients:[client],inventoryAvailable:true,errors});
 await ui.panel.scan();assert.equal(ui.panel.scanError,true);assert.match(ui.nodes['client-scan-status'].textContent,/Ubuntu.*Claude Code inventory unavailable/);assert.equal(ui.panel.clients[0].id,client.id);assert.equal(ui.panel.clients[0].enabled,false);
 await ui.panel.refreshClients();assert.equal(ui.panel.scanError,true);assert.match(ui.nodes['client-scan-status'].textContent,/inventory unavailable/);
 errors=[];await ui.panel.scan(true);assert.equal(ui.panel.scanError,false);assert.doesNotMatch(ui.nodes['client-scan-status'].textContent,/inventory unavailable/);assert.equal(ui.panel.clients[0].id,client.id);
});

test('Antigravity App IDE and CLI paths use the shared default-application form',async()=>{
 for(const english of [false,true]){
  const ui=fixture();if(english)ui.english();const capability={family:'antigravity',kind:'default-application',supported:true};
  const client={id:'antigravity',name:'Antigravity',installed:true,enabled:false};let selected;
  ui.panel.manageClient=async value=>{selected=value.id;};
  ui.setHandler(async body=>body.action==='client-profiles'?body.operation==='save'?{entry:'antigravity',instance:client}:{capabilities:[capability]}:{clients:[client]});
  await ui.panel.addClient();await ui.document.body.children[0].querySelectorAll('button').find(button=>button.textContent==='Antigravity').onclick();
  const dialog=ui.document.body.children[0],form=dialog.querySelector('form');
  assert.equal(form.querySelectorAll('input').length,1);
  assert.match(form.querySelector('.hint').textContent,english?/Antigravity App.*IDE.*agy/:/Antigravity 앱.*IDE.*agy/);
  if(english)assert.doesNotMatch(form.querySelector('.hint').textContent,/[\u4e00-\u9fff]/);
  form.querySelector('input').value='/user/.gemini/bin/agy';await form.onsubmit({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls.find(body=>body.operation==='save'))),{action:'client-profiles',operation:'save',family:'antigravity',kind:'default-application',application:'/user/.gemini/bin/agy'});
  assert.equal(selected,'antigravity');
 }
});

test('missing ZCode can be added through the shared client form without creating an independent profile',async()=>{
 for(const english of [false,true]){
  const ui=fixture();if(english)ui.english();const chosen=[];
  const capability={family:'zcode',kind:'default-application',supported:true};
  const client={id:'zcode',name:'ZCode',installed:true,configured:false,enabled:false};
  ui.setHandler(async body=>body.action==='client-profiles'?body.operation==='save'?{entry:'zcode',instance:client}:{capabilities:[capability]}:body.action==='clients'?{clients:[client]}:{});
  ui.panel.api.choose=async kind=>{chosen.push(kind);return 'F:\\Portable Apps\\ZCode\\ZCode.exe';};
  await ui.panel.addClient();let dialog=ui.document.body.children[0];
  assert.equal(dialog.querySelector('h2').textContent,english?'Add client':'클라이언트 추가');
  const zcode=dialog.querySelectorAll('button').find(button=>button.textContent==='ZCode');assert.equal(zcode.disabled,false);await zcode.onclick();
  dialog=ui.document.body.children[0];const form=dialog.querySelector('form'),inputs=form.querySelectorAll('input');
  assert.equal(inputs.length,1,'Default ZCode has an installation path, not a second home or account');
  await form.querySelectorAll('button').find(button=>button.textContent===(english?'Choose application':'애플리케이션 선택')).onclick();
  assert.deepEqual(chosen,['file']);assert.match(inputs[0].value,/Portable Apps/);
  inputs[0].value='/custom/ZCode.AppImage';await form.onsubmit({preventDefault(){}});
  const saved=JSON.parse(JSON.stringify(ui.calls.find(call=>call.operation==='save')));
  assert.deepEqual(saved,{action:'client-profiles',operation:'save',family:'zcode',kind:'default-application',application:'/custom/ZCode.AppImage'});
  assert.equal(ui.selected.at(-1),'zcode');assert.equal(dialog.open,false);
  assert.ok(!ui.calls.some(call=>['toggle-client','connect-claude','zcode-official-login'].includes(call.action)));
 }
});

test('already present ZCode is not offered as a duplicate client',async()=>{
 const ui=fixture();ui.setHandler(async()=>({capabilities:[{family:'zcode',kind:'default-application',supported:false,reason:'ZCode는 이미 사용 가능합니다. 기존 관리 페이지를 사용하세요.'}]}));
 await ui.panel.addClient();const button=ui.document.body.children[0].querySelectorAll('button').find(node=>node.textContent.startsWith('ZCode'));
 assert.equal(button.textContent,'ZCode · 이미 추가됨');assert.equal(button.disabled,true);button.onclick();assert.equal(ui.calls.length,1);
});

test('official login can explicitly retry unavailable storage without status polling probing it',async()=>{
 const ui=fixture(),client={id:'zcode',name:'ZCode',installed:true,configured:true,connectionModes};ui.panel.clients=[client];
 const state={configured:false,available:true,secureStorageAvailable:false,link:'https://zcode.z.ai/pair?fixture=storage'};let attempts=0;
 ui.setHandler(async request=>{
  if(request.action==='clients')return {clients:[client]};
  if(request.action==='zcode-official-login'){attempts++;if(attempts===1)throw Error('Keyring locked');state.secureStorageAvailable=true;state.configured=true;}
  return {...state};
 });
 await ui.panel.manageClient(client);const login=ui.pages.get('zcode').querySelector('[data-official-action="login"]');
 assert.equal(login.disabled,false);await login.onclick();assert.equal(attempts,1);assert.equal(login.disabled,false);
 await ui.poll();assert.equal(attempts,1,'Background status never starts another login/storage operation');
 await login.onclick();assert.equal(attempts,2);assert.equal(state.configured,true);
});

test('Codex alone creates no other account editors or account reads; invisible lists stop their timer',async()=>{
  const ui=fixture({accounts:true});
  ui.panel.clients=[{id:'codex',enabled:true},{id:'claude',enabled:true,nativeEnabled:false},{id:'deepseek',enabled:false}];
  ui.panel.renderClients();
  assert.deepEqual(Object.keys(ui.panel.accountPanels),[]);assert.equal(ui.calls.length,0);
  assert.deepEqual(ui.timers.filter(Boolean).map(timer=>timer.ms),[15000]);
  ui.nodes['clients-page'].hidden=true;ui.panel.syncPolling();
  assert.equal(ui.timers.filter(Boolean).length,0);
  ui.nodes['clients-page'].hidden=false;ui.panel.clients[2].enabled=true;ui.panel.renderClients();
  assert.deepEqual(Object.keys(ui.panel.accountPanels),['deepseek']);assert.ok(ui.calls.some(call=>call.provider==='deepseek'));
  assert.ok(!ui.calls.some(call=>call.provider==='claude'));
});

test('DSH missing connector repair previews paths and requires the explicit repair acknowledgement',async()=>{
 const ui=fixture();ui.english();ui.panel.clients=[];
 ui.setHandler(async body=>body.action==='deepseek-recovery-preview'?{token:'repair-token',canRecover:true,configurationRepair:true,oldDirectory:'F:/old/desktop-sessions/deepseek',newDirectory:'F:/gateway/desktop-sessions/deepseek'}:body.action==='status'?{backends:{}}:{clients:[]});
 await ui.panel.recoverDeepseek(true);
 const confirmation=ui.calls.find(row=>row.action==='deepseek-recovery-confirm');
 assert.equal(confirmation.confirmConfigurationRepair,true);assert.equal(confirmation.token,'repair-token');assert.equal(confirmation.acknowledgeUnknown,undefined);
 assert.match(ui.prompts[0],/backed up/);assert.match(ui.prompts[0],/F:\/old/);assert.match(ui.prompts[0],/F:\/gateway/);assert.doesNotMatch(ui.prompts[0],/[\u4e00-\u9fff]/);
 const cancelled=fixture();cancelled.panel.clients=[];cancelled.confirm(false);cancelled.setHandler(async body=>body.action==='deepseek-recovery-preview'?{token:'cancel',canRecover:true,configurationRepair:true,oldDirectory:'old',newDirectory:'new'}:body.action==='status'?{backends:{}}:{clients:[]});
 await cancelled.panel.recoverDeepseek(true);assert.equal(cancelled.calls.some(row=>row.action==='deepseek-recovery-confirm'),false);
});


test('Antigravity management keeps exact manual model after catalog refresh failure',async()=>{
 const ui=fixture(),client={id:'antigravity',name:'Antigravity',enabled:true,capabilities:{management:true}};ui.panel.clients=[client];let fail=false;
 const state={enabled:true,surfaces:[{id:'app',name:'APP',connected:true,historyAvailable:true,sessions:[{id:'chat',model:'original'}]}],permissionOptions:[]};
 ui.setHandler(async body=>{if(body.operation==='settings')return {status:'accepted'};if(body.operation!=='catalog')return state;if(fail)throw Error('temporary directory failure');return {models:[{id:'original'}],cache:{identity:'verified-account',updatedAt:100},capabilities:{models:true,effort:false,manualModels:true}};});
 await ui.panel.manageClient(client);await new Promise(setImmediate);const root=ui.pages.get('antigravity').querySelector('[data-antigravity-management]'),model=root.querySelector('[aria-label="모델"]'),manual=root.querySelector('[aria-label="모델 직접 입력"]');
 model.value='__manual__';model.onchange();manual.value='MODEL_EXPLICIT_525';manual.oninput();fail=true;await root.querySelectorAll('button').find(b=>b.textContent==='모델 새로 고침').onclick();
 await root.querySelectorAll('button').find(b=>b.textContent==='다시 불러오기').onclick();assert.equal(manual.value,'MODEL_EXPLICIT_525');assert.equal(manual.disabled,false);assert.equal(root.querySelector('.project-picker-models').querySelector('.error').textContent,'');
 await root.querySelectorAll('button').find(b=>b.textContent==='애플리케이션 모델').onclick();const write=ui.calls.find(body=>body.operation==='settings');assert.equal(write.model,'MODEL_EXPLICIT_525');assert.equal(write.manualModel,true);assert.equal(write.modelCatalogIdentity,'verified-account');
});

test('Antigravity cached source keeps manual entry when its next directory read fails',async()=>{
 const ui=fixture(),client={id:'antigravity',name:'Antigravity',enabled:true,capabilities:{management:true}};ui.panel.clients=[client];let fail=false;
 const state={enabled:true,surfaces:['app','ide'].map(id=>({id,name:id,connected:true,historyAvailable:true,sessions:[{id:id+'-chat',model:'original'}]})),permissionOptions:[]};
 ui.setHandler(async body=>{if(body.operation!=='catalog')return state;if(fail)throw Error('offline');return {models:[{id:'original'}],cache:{identity:body.surface,updatedAt:100},capabilities:{models:true,manualModels:true,effort:false}};});
 await ui.panel.manageClient(client);await new Promise(setImmediate);const root=ui.pages.get('antigravity').querySelector('[data-antigravity-management]'),source=root.querySelector('[aria-label="세션 소스"]'),model=root.querySelector('[aria-label="모델"]');
 source.value='ide';await source.onchange();fail=true;source.value='app';await source.onchange();assert.ok(model.children.some(row=>row.value==='__manual__'));model.value='__manual__';model.onchange();const manual=root.querySelector('[aria-label="모델 직접 입력"]');assert.equal(manual.disabled,false);assert.equal(manual.hidden,false);assert.equal(root.querySelector('[aria-label="추론 강도"]').parent.hidden,true);
});
