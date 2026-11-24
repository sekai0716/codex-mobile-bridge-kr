'use strict';
// Capture once and remove the bearer fragment before any API request or chat routing.
function takePairingToken(){
  if(!location.hash.startsWith('#pair='))return null;
  const token=location.hash.slice(6);
  history.replaceState(null,'',location.pathname+location.search);
  return token;
}
let initialPairingToken=takePairingToken();
const $ = id => document.getElementById(id),t=BridgeI18n.t;
let csrf='', currentId=null, state=null, listOffset=0, listQuery='', approvalStamp='', sending=false;
let claudeCliAccessPanel=null;
let currentHost='local', listRows=[], listGeneration=0, listHasMore=false, listArchived=false, listSource='all', availableSources=[], listRenderStamp='';
let listComplete=false, listReadFinished=false, listIdentity='', listFilterKey='';
const composerDrafts=typeof ComposerDrafts==='function'?new ComposerDrafts():null;
let codexQuotes=null;
let draftGateway='',codexDraftScope=null,codexDraftTouched=false,restoringComposer=false,codexActiveAccountId,codexAccountRevision=0;const codexProvisionalDrafts=new Map();
let listHostIds=[];
let sourceFilterStamp='';
let chatTimeline=null;
const dismissedHostFaults=new Map();
const submittedRequestIds=new Set();
const sessionActivity=new SessionActivity();
const recentInteractions=new Map();
function bumpRecency(id,host,at=Date.now()){
  const key=chatKey(id,host);recentInteractions.set(key,Math.max(at,recentInteractions.get(key)||0));
  const row=listRows.find(row=>row.id===id&&row.host===host);
  if(row&&at>row.recency){row.recency=at;listRows.sort((a,b)=>b.recency-a.recency);renderList();}
}
let activityBusy=false;
const fastModeControl=new FastModeControl({root:$('fast-mode-control'),input:$('fast-mode-enabled')});
let modelRequest=0,modelTarget=null,modelSaving=false,modelScope='',modelIdentityInvalid=false,modelSelectionRevision=0;
function modelScopeKey(){return JSON.stringify([listIdentity,currentId,currentHost,state?.provider,state?.modelCatalogIdentity||'']);}
async function goalAction(action,payload) {
  const id=currentId,host=currentHost;
  const result=await api(sessionUrl(id,'goal/'+action,host),payload);
  if(!result.confirmed)throw Error('목표 결과 미확인. 목표 상태를 확인하세요.');
  if(currentId===id&&currentHost===host){state={...state,goal:action==='cancel'?null:(result.result?.goal||result.result)};workModes.render(state,$('send-mode').value,false);}
  toast(action==='cancel'?'목표가 지워졌습니다.':action==='edit'?'목표가 업데이트되고 일시중지되었습니다.':payload.status==='paused'?'목표가 일시중지됨':'목표가 재개되었습니다.');
}
const workModes=new WorkModes({select:$('work-mode'),hint:$('mode-hint'),goalRoot:$('goal-state'),goalToggle:$('goal-toggle'),newId:uuid,
  onCancel:payload=>goalAction('cancel',payload),onStatus:payload=>goalAction('status',payload),onEdit:payload=>goalAction('edit',payload)});
const sendModes=new ComposerSendModes({select:$('send-mode'),send:$('send'),
  isDisabled:()=>sending||!composerCanSend()||!attachments.ready()});
document.addEventListener('bridge-language',()=>sendModes.render(state,sending));
window.addEventListener('focus',()=>{if(!$('app').hidden)accountsPanel?.refresh();});
function chatKey(id=currentId,host=currentHost){return host+'|'+id;}
function sessionUrl(id,action='',host=currentHost){const path='/api/sessions/'+id+(action?'/'+action:'')+'?host='+encodeURIComponent(host);return window.BridgeRelayURL?.(path)||path;}
function hostUrl(path,host=currentHost){const value=/^\/api\/sessions\/[0-9a-f-]{36}/.test(path)&&!/[?&]host=/.test(path)?path+(path.includes('?')?'&':'?')+'host='+encodeURIComponent(host):path;return window.BridgeRelayURL?.(value)||value;}
let listLoading=0;
let modelCatalogGeneration=0;const modelCatalogs=new Map();let catalogData={models:null,skills:null};let catalogResults={models:null,skills:null};let catalogTasks={models:null,skills:null};let selectedSkills=new Set(),invalidSkills=new Set(),skillIndex=new Map(),skillTotal=0,skillPages=[],skillQuery={q:'',offset:0,limit:200},skillSearchTimer,skillRequest=0;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function toast(text){
  const original=$('toast'),dialog=[...document.querySelectorAll('dialog[open]')].filter(node=>!node.inert).at(-1);
  clearTimeout(toast.timer);if(toast.active&&toast.active!==original)toast.active.remove();original.hidden=true;
  const node=dialog?document.createElement('div'):original;
  if(dialog){node.className=original.className;node.setAttribute('role','status');dialog.append(node);}
  node.textContent=t(text);node.hidden=false;toast.active=node;
  toast.timer=setTimeout(()=>{if(node===original)node.hidden=true;else node.remove();},4200);
}
function renderHostErrors(hosts){
  const root=$('host-errors'),gateway=(window.BridgeRelayBase||location.origin||'')+'|';
  const active=new Set(hosts.map(host=>gateway+(host.host||host.label)));
  for(const key of dismissedHostFaults.keys())if(key.startsWith(gateway)&&!active.has(key))dismissedHostFaults.delete(key);
  root.replaceChildren();
  for(const host of hosts){
    const key=gateway+(host.host||host.label),fault=String(host.error||'');
    if(dismissedHostFaults.get(key)===fault)continue;
    const row=el('div','host-error-row');row.append(el('span','',host.label+'：'+fault));
    const retry=el('button','plain',t('다시 시도'));retry.type='button';
    retry.onclick=()=>listSync.update(true);row.append(retry);
    const close=el('button','plain','×');close.type='button';close.setAttribute('aria-label',t('연결 오류 닫기'));
    close.onclick=()=>{dismissedHostFaults.set(key,fault);row.remove();root.hidden=!root.childElementCount;};
    row.append(close);root.append(row);
  }
  root.hidden=!root.childElementCount;
}
function clearListSnapshot(){
  browserNavigation.invalidate();
  for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('codex-list-v1:')||key?.startsWith('desktop-list-v1:'))sessionStorage.removeItem(key);}
  for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('codex-list-v1:')||key?.startsWith('desktop-list-v1:'))localStorage.removeItem(key);}
  listIdentity='';listFilterKey='';listHostIds=[];listRows=[];listOffset=0;listHasMore=false;listComplete=false;listReadFinished=false;availableSources=[];listRenderStamp='';listGeneration++;
}
function authLost(){hideWebhookUrl();clearListSnapshot();if(!$('app').hidden)document.dispatchEvent(new Event('bridge-auth-lost'));showLogin();}
async function api(path,body,signal,authCurrent){const options={signal,credentials:'same-origin',cache:'no-store',headers:{}};if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':csrf};options.body=JSON.stringify(body);}let response;try{response=await fetch(hostUrl(path),options);}catch(error){if(!signal?.aborted&&error.name!=='AbortError')window.BridgeMobileHandoff?.unreachable();throw error;}if([502,503,504,522,523,524,530].includes(response.status))window.BridgeMobileHandoff?.unreachable();let data;try{data=await response.json();}catch(error){throw Object.assign(error,{status:response.status});}if(!response.ok){if(response.status===401&&(!authCurrent||authCurrent()))authLost();throw Object.assign(Error(data.error||t('요청 실패')),{loginStatus:data.loginStatus,status:response.status,code:data.code});}return data;}
const workbench=window.BridgeWorkbench=new Workbench({chat:$('chat'),request:api,csrf:()=>csrf,notify:toast,onUnauthorized:authLost,openChat,composer:$('message'),onReference:()=>window.BridgePresentation?.openChat()});
async function sendSessionPin(identity,body,token){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{return await api(identity.provider==='codex'?sessionUrl(identity.id,'pin',identity.host):ClientIdentity.path(identity.provider,'pin'),identity.provider==='codex'?body:{...body,sessionId:identity.id},controller.signal,()=>sessionPins.current(token));}finally{clearTimeout(timer);}
}
const sessionPins=new LocalSessionPins({newId:uuid,send:sendSessionPin,onChange:()=>{listRenderStamp='';renderList();desktopSessions.listStamp='';desktopSessions.renderList();if(listFilterKey)saveListSnapshot(listFilterKey);desktopSessions.rememberView();}});
function pinRow(row,provider='codex'){const identity={provider,id:row.id,host:row.host||'local'};return {...row,bridgePinned:sessionPins.value(identity,row.bridgePinned),pinPending:sessionPins.pending(identity)};}
const desktopSessions=new DesktopSessionsView({root:$('app'),pinPreferences:sessionPins,onSessionMenu:(button,row,provider)=>bindSessionMenu(button,row,provider),onOpenSessionMenu:(row,provider,button)=>getSessionMenu().show(sessionMenuContext(row,provider),{element:button}),select:$('desktop-backend'),request:api,notify:toast,csrf:()=>csrf,onUnauthorized:authLost,onSelect:provider=>{
  sharedSessionMenu?.close();if(provider!=='codex'){saveDraft();chatTimeline?.dispose();chatTimeline=null;currentId=null;state=null;workbench.reset();$('chat').hidden=true;$('welcome').hidden=false;$('app').classList.remove('chat-open');if(!browserNavigation.enabled())history.replaceState(null,'',location.pathname);}
}});
const clientNavigation=new ClientNavigation({view:desktopSessions,request:api,notify:toast});
const browserNavigation=new BrowserNavigation({
  read:()=>isCodexClient(clientNavigation.provider)?($('app').classList.contains('chat-open')&&currentId?{provider:'codex',id:currentId,host:currentHost}:null):(desktopSessions.isChatOpen?{provider:desktopSessions.provider,id:desktopSessions.sid,host:'local'}:null),
  restore:async(route,isCurrent=()=>true)=>{
    if($('app').hidden)return;
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    if(!route){if(!isCodexClient(clientNavigation.provider))desktopSessions.backToList();else if($('app').classList.contains('chat-open'))$('back').click();return;}
    const auth=await api('/api/auth');
    if(!isCurrent())return;
    if(!auth.authenticated||$('app').hidden){history.replaceState(browserNavigation.entry(null),'',browserNavigation.url(null));return;}
    if(listIdentity&&listAuthIdentity(auth)!==listIdentity){browserNavigation.invalidate();return;}
    const entry=route.provider==='codex'?(isCodexEntry(route.host)?route.host:'codex'):route.provider;
    if(!clientNavigation.managementClients().some(client=>client.id===entry&&client.enabled)){
      toast('활성화된 앱이 없습니다. 시작하려면 앱 관리를 여세요.');history.replaceState(browserNavigation.entry(browserNavigation.read()),'',browserNavigation.url(browserNavigation.read()));return;
    }
    await clientNavigation.choose(entry,{activate:false});
    if(!isCurrent())return;
    if(route.provider==='codex')await openChat(route.id,route.host);
    else await desktopSessions.open(route.id);
  },onError:error=>toast(error.message)
});
browserNavigation.paused=true;
desktopSessions.onNavigation=()=>browserNavigation.sync();
desktopSessions.onHistoryInvalidated=()=>browserNavigation.invalidate();

let codexAccountEntry='desktop',preferredWslEntry=clientNavigation.initialHost||'',selectedCodexEntry=clientNavigation.initialHost?.startsWith('codex:')?clientNavigation.initialHost:null;
currentHost=clientNavigation.initialHost||currentHost;
function codexEntries(){return [...(clientNavigation.clients.find(row=>row.id==='codex')?.entries||[]),...clientNavigation.clients.filter(row=>row.kind==='codex-local')];}
function wslEntries(){return clientNavigation.wslSupported===true?codexEntries().filter(row=>row.kind==='wsl-cli'&&row.enabled):[];}
function accountUrl(path){return codexAccountEntry==='desktop'?path:path+(path.includes('?')?'&':'?')+'entry='+encodeURIComponent(codexAccountEntry);}
function refreshEntryAccounts(){
  const entries=codexEntries();
  codexAccountEntry=isCodexEntry(currentHost)&&entries.some(row=>row.id===currentHost)?currentHost:'desktop';
  accountsPanel?.clear();if($('accounts-dialog').open){renderAccountEntries();refreshSelectedAccounts();}
}
clientNavigation.onApplicationChange=(previous,provider,{host,loadList:readList=true}={})=>{
  if(provider==='codex')selectedCodexEntry=host?.startsWith('codex:')?host:null;
  if(host?.startsWith('codex:')){preferredWslEntry=host;listSource='all';}
  if(host?.startsWith('wsl:')){preferredWslEntry=host;listSource='wsl';localStorage.setItem('codex-source-filter',listSource);}
  listGeneration++;saveDraft();if(host==='local'||isCodexEntry(host))currentHost=host;listRows=[];availableSources=[];listOffset=0;listHasMore=true;listComplete=false;listReadFinished=false;listFilterKey='';listRenderStamp='';sourceFilterStamp='';
  $('sessions').replaceChildren();$('host-errors').hidden=true;chatTimeline?.dispose();chatTimeline=null;currentId=null;state=null;workbench.reset();$('chat').hidden=true;$('welcome').hidden=false;$('app').classList.remove('chat-open');if(!browserNavigation.enabled())history.replaceState(null,'',location.pathname);browserNavigation.sync();
  $('new-chat').hidden=false;refreshEntryAccounts();renderSourceFilter();
  if(provider==='codex'&&readList&&!$('app').hidden)return loadList(true).catch(e=>toast(e.message));
};
clientNavigation.onClientStates=clients=>{
  const previousSource=listSource;renderSourceFilter();
  if(previousSource!==listSource&&clientNavigation.provider==='codex'&&!$('app').hidden)loadList(true).catch(error=>toast(error.message));
  if(!currentId||clientNavigation.provider!=='codex')return;
  const codex=clients.find(row=>row.id==='codex'),entry=isCodexEntry(currentHost)?codexEntries().find(row=>row.id===currentHost):codex?.entries?.find(row=>row.id==='desktop')||codex;
  if(!entry?.enabled)clientNavigation.onApplicationChange('codex','codex');
};
desktopSessions.onListEnter=()=>{clientNavigation.listReadDone=false;clientNavigation.listVisit=(clientNavigation.listVisit||0)+1;if(!isCodexClient(clientNavigation.provider))desktopSessions.refresh();};
desktopSessions.onListReady=(provider,value)=>{clientNavigation.acknowledgeList(provider,value);window.BridgeFeatures?.prefetchChat();};
async function uploadAttachment(key,id,file){const separator=key.indexOf('|'),host=key.slice(0,separator),thread=key.slice(separator+1);const response=await fetch(sessionUrl(thread,'uploads',host)+'&id='+encodeURIComponent(id)+'&name='+encodeURIComponent(file.name),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:file});const result=await response.json();if(!response.ok){if(response.status===401)authLost();const error=Error(result.error||t('첨부파일 업로드에 실패했습니다. 다시 시도해 보세요.'));error.retryable=response.status>=500||response.status===429;throw error;}return result;}
async function uploadAttachmentWithRetry(key,id,file){if(window.BridgeSharedRelay)return uploadAttachment(key,id,file);let last;for(let attempt=0;attempt<3;attempt++){try{return await uploadAttachment(key,id,file);}catch(error){last=error;if(error.name==='AbortError'||error.retryable===false||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));}}if(last instanceof TypeError)last.message=t('첨부파일 업로드가 중단되었습니다. 다시 시도해 보세요.');throw last;}
const attachments=new ChatAttachments({root:$('attachment-list'),button:$('attach-button'),input:$('attachment-input'),chooseReference:()=>window.BridgeFileActions.pickReference(workbench),paste:$('message'),drop:$('composer'),preview:(key,id)=>{const at=key.indexOf('|'),host=key.slice(0,at),thread=key.slice(at+1);return hostUrl(sessionUrl(thread,'uploads/'+encodeURIComponent(id)+'/preview',host));},onChange:()=>{if(currentId)$('send').disabled=sending||!composerCanSend()||!attachments.ready();},thumbnail:async(key,id,file)=>{
  const separator=key.indexOf('|'),host=key.slice(0,separator),thread=key.slice(separator+1);
  const image=await attachments.thumbnailBlob(file);
  const response=await fetch(sessionUrl(thread,'uploads/'+encodeURIComponent(id)+'/thumb',host)+'&width='+image.width+'&height='+image.height,{method:'POST',credentials:'same-origin',headers:{'Content-Type':image.mime,'X-CSRF-Token':csrf},body:image.data});
  const result=await response.json();if(!response.ok){if(response.status===401)authLost();throw Error(result.error||t('썸네일 업로드 실패'));}return result;
},upload:uploadAttachmentWithRetry});
workbench.attachReference=info=>attachments.addReference(info);
function visibleChat(){return currentId&&!workbench.isFileVisible&&!document.hidden&&$('app').classList.contains('chat-open')?chatKey():null;}
function reportVisibleChat(){
  if(document.hidden||$('app').hidden)return;
  const codex=isCodexClient(clientNavigation.provider);
  if(codex?(!visibleChat()||!chatTimeline||chatTimeline.cached||!chatTimeline.meta||chatTimeline.meta.loadingHistory):(!desktopSessions.visibleActivity()||!desktopSessions.state))return;
  document.dispatchEvent(new CustomEvent('bridge-chat-visible',{detail:{threadId:codex?currentId:desktopSessions.sid,host:codex?currentHost:'desktop:'+desktopSessions.provider}}));
}
desktopSessions.onDetailReady=reportVisibleChat;
window.addEventListener('focus',reportVisibleChat);
document.addEventListener('visibilitychange',reportVisibleChat);
function renderActivity(){for(const button of $('sessions').querySelectorAll('.session')){
  button.querySelector('.session-indicator')?.remove();const indicator=sessionActivity.indicator(chatKey(button.dataset.id,button.dataset.host));
  if(indicator){const dot=el('span','session-indicator '+indicator.kind);dot.title=t(indicator.label);dot.setAttribute('aria-label',t(indicator.label));button.querySelector('strong').prepend(dot);}
}}
async function refreshActivity(){
  if(activityBusy||$('app').hidden||document.hidden||!listRows.length)return;activityBusy=true;
  const hosts={};for(const row of listRows)(hosts[row.host]??=[]).push(row.id);
  try{const result=await api('/api/activity',{hosts});if(!$('app').hidden){sessionActivity.update(result.sessions,visibleChat());for(const row of result.sessions)if(row.recency)bumpRecency(row.id,row.host,row.recency);renderActivity();}}catch{}finally{activityBusy=false;}
}
setInterval(refreshActivity,5000);
window.addEventListener('focus',refreshActivity);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActivity();});
let loginStatus={attemptsRemaining:5,attemptLimit:5,blocked:false};
function renderLoginStatus(status=loginStatus){
  loginStatus=status||loginStatus;
  $('login-attempts').textContent=loginStatus.blocked?t('이 IP는 차단되었습니다. 데스크톱 게이트웨이 앱의 로그인 장치에서 차단을 해제하세요.'):t('남은 시도 횟수:')+loginStatus.attemptsRemaining+'/'+loginStatus.attemptLimit+t('; 5회 연속 실패하면 이 IP가 차단됩니다.');
  $('login-button').disabled=loginStatus.blocked;
}
document.addEventListener('bridge-language',()=>renderLoginStatus());
function clearCodexProvisionalDrafts(){codexProvisionalDrafts.clear();for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('draft:')||key?.startsWith('skills:'))sessionStorage.removeItem(key);}}
function clearQuoteComposer(){if(typeof codexQuotes!=='undefined')codexQuotes?.reset();}
function showLogin(passwordless=false,status){sessionPins.suspend();clearQuoteComposer();if(typeof ChatTimeline!=='undefined')ChatTimeline.clearCache?.();draftGateway='';codexDraftScope=null;clearCodexProvisionalDrafts();codexActiveAccountId=undefined;window.BridgeDownloads?.clear();$('mobile-binding-status').hidden=true;if(typeof codexCliAccessPanel!=='undefined')codexCliAccessPanel?.clear();claudeCliAccessPanel?.clear();if(window.BridgeSharedRelay){location.replace((window.BridgeRelayBase||'')+'/relay/');return;}desktopSessions.clear();clientNavigation.clear?.();modelCatalogGeneration++;modelCatalogs.clear();catalogData.models=null;catalogResults.models=null;catalogTasks.models=null;workbench.reset();if(typeof accountsPanel!=='undefined')accountsPanel?.clear();chatTimeline?.dispose();chatTimeline=null;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('app').hidden=true;$('login').hidden=false;$('credentials').hidden=passwordless;$('noauth').hidden=!passwordless;$('username').required=!passwordless;$('password').value='';$('remember-login').parentElement.hidden=passwordless||BridgeHost.isNativeApp();$('login-attempts').hidden=passwordless;renderLoginStatus(status);if(window.BridgeBootstrap)window.BridgeBootstrap.ready();else $('bootstrap-status').hidden=true;}
async function start(pairingToken=null){
  window.BridgeBootstrap?.waitingForAuth();
  const auth=window.BridgeBootstrap?.readAuth?await window.BridgeBootstrap.readAuth(signal=>api('/api/auth',undefined,signal)):await api('/api/auth');
  if(['en','ko','zh'].includes(auth.uiLanguage)){$('phone-language').value=auth.uiLanguage;$('phone-language').onchange();}
  if(pairingToken!==null){
    try{window.BridgeBootstrap?.pairingSubmitted();const result=await api('/api/pair',{token:pairingToken});csrf=result.csrf;await enter();return;}
    catch(error){
      if(auth.authenticated){csrf=auth.csrf;await enter(auth);toast(error.message);}
      else{showLogin(auth.passwordless,auth.loginStatus);$('login-error').textContent=t(error.message);}
      return;
    }finally{pairingToken=null;}
  }
  if(!auth.authenticated){clearListSnapshot();showLogin(auth.passwordless,auth.loginStatus);return;}csrf=auth.csrf;await enter(auth);
}
async function refreshComputer(){
  $('connected-computer').dataset.deviceName=location.host;
  $('computer-name').textContent=location.host;$('connected-computer').title=location.host;
  try{const auth=await api('/api/auth');if(!auth.authenticated||$('app').hidden)return;
    workbench.browserSharing=auth.browserSharing===true;
    const binding=$('mobile-binding-status');binding.hidden=!auth.trustedDevice;binding.setAttribute('data-i18n','이 전화는 연결되어 있습니다. 데스크톱 게이트웨이의 로그인된 장치에서 연결을 해제하세요.');binding.textContent=t('이 전화는 연결되어 있습니다. 데스크톱 게이트웨이의 로그인된 장치에서 연결을 해제하세요.');
    const name=auth.computer?.name||location.host;$('connected-computer').dataset.deviceName=name;$('computer-name').textContent=name;
    $('connected-computer').title=[name,auth.computer?.platform,location.host].filter(Boolean).join(' · ');
  }catch{/* Older or temporarily unavailable gateways keep the connected address. */}
  finally{document.dispatchEvent(new Event('bridge-computer'));}
}
async function openHarness(){
  try{const state=await api('/api/harness');if(state.running)location.assign('/harness/');else toast('데스크톱 앱에서 DeepSeek Harness를 시작하세요.');}
  catch(error){toast(error.message);}
}
$('harness-open').onclick=openHarness;
async function enter(authInfo){
  desktopSessions.onListEnter();const chatLink=location.hash;$('desktop-backend').hidden=false;
  if(/(?:^|[?&])open=harness(?:&|$)/.test(location.search||'')){history.replaceState(null,'','/');await openHarness();}
  const verified=authInfo?.authenticated?authInfo:await api('/api/auth');
  if(!verified.authenticated)throw Error(t('로그인 상태를 알 수 없음'));
  if(draftGateway&&draftGateway!==verified.draftIdentity){clearCodexProvisionalDrafts();if(typeof ChatTimeline!=='undefined')ChatTimeline.clearCache?.();}
  draftGateway=verified.draftIdentity||'';
  sessionPins.bind(draftGateway?JSON.stringify([window.BridgeRelayBase||location.origin,draftGateway]):'');
  desktopSessions.bindDraftGateway?.(draftGateway);
  listIdentity=await listAuthIdentity(verified);
  desktopSessions.bindListCache(listIdentity,window.BridgeRelayBase||location.host);
  restoreListSnapshot();
  const target=clientNavigation.chatTarget?.(chatLink),direct=!!target&&Array.isArray(verified.enabledClients);
  clientNavigation.enabledClients=Array.isArray(verified.enabledClients)?verified.enabledClients.slice():null;
  if(!direct&&desktopSessions.previewCachedList(clientNavigation.provider))clientNavigation.paint();
  $('login').hidden=true;$('app').hidden=false;if(window.BridgeBootstrap)window.BridgeBootstrap.ready();else $('bootstrap-status').hidden=true;document.dispatchEvent(new Event('bridge-authenticated'));
  const identity=listIdentity,session=csrf;
  const refresh=()=>{
    if($('app').hidden||listIdentity!==identity||csrf!==session)return Promise.resolve();
    refreshComputer();const clientsReady=clientNavigation.refresh();accountsPanel?.refresh();
    if(isCodexClient(clientNavigation.provider))loadList(true).catch(async e=>{await clientsReady.catch(()=>{});if(isCodexClient(clientNavigation.provider))toast(e.message);});
    return clientsReady;
  };
  if(direct){
    browserNavigation.paused=false;
    try{await clientNavigation.openChatLink(chatLink,openChat);}finally{setTimeout(refresh,0);}
    return;
  }
  await refresh();
  browserNavigation.paused=false;
  const restored=history.state?.bridgeNavigation===1&&history.state.scope===browserNavigation.scope&&history.state.route;
  if(restored&&restored.provider!=='codex'){browserNavigation.restoring=true;try{await browserNavigation.restore(restored);}finally{browserNavigation.restoring=false;}}
  else await clientNavigation.openChatLink(chatLink,openChat);
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();if(loginStatus.blocked)return;$('login-button').disabled=true;$('login-error').textContent='';try{const result=await api('/api/login',{username:$('username').value,password:$('password').value,remember:$('remember-login').checked});renderLoginStatus({attemptsRemaining:5,attemptLimit:5,blocked:false});csrf=result.csrf;$('password').value='';await enter();}catch(error){$('login-error').textContent=t(error.message);renderLoginStatus(error.loginStatus);}finally{$('login-button').disabled=loginStatus.blocked;}});
$('logout').onclick=async()=>{await api('/api/logout',{});hideWebhookUrl();document.dispatchEvent(new Event('bridge-logged-out'));csrf='';state=null;currentId=null;$('messages').replaceChildren();$('approvals').replaceChildren();$('queued').replaceChildren();$('sessions').replaceChildren();$('message').value='';sessionStorage.clear();clearListSnapshot();attachments.reset();sessionActivity.clear();recentInteractions.clear();showLogin();};
function dateText(value){if(!value)return '';return new Date(value*1000).toLocaleDateString(BridgeI18n.locale(),{month:'numeric',day:'numeric'});}
function listAuthIdentity(auth){return auth?.authenticated&&/^[0-9a-f]{64}$/.test(auth.listCacheIdentity||'')?auth.listCacheIdentity:'';}
function listSnapshotKey(filter){return listIdentity?'codex-list-v1:'+listIdentity+':'+filter:'';}
function currentListFilter(){
  const fields=[$('search').value,$('archived').checked,listSource,$('list-mode').value];
  if(selectedCodexEntry)fields.push(selectedCodexEntry);
  return JSON.stringify(fields);
}
function restoreListSnapshot(filter=currentListFilter()){
  const key=listSnapshotKey(filter);if(!key)return false;
  let saved,legacy=false;
  for(const storage of [localStorage,sessionStorage]){
    try{
      const snapshot=storage.getItem(key);if(!snapshot||snapshot.length>512*1024)continue;
      const value=JSON.parse(snapshot);
      if(!value||!Array.isArray(value.rows)||value.rows.length>200||!value.rows.every(row=>row&&typeof row.id==='string'&&typeof row.host==='string')||
          !Array.isArray(value.sources)||!value.sources.every(source=>typeof source==='string')||
          !Array.isArray(value.hosts)||!value.hosts.every(host=>typeof host==='string'))continue;
      saved=value;legacy=storage===sessionStorage;break;
    }catch{}
  }
  if(!saved)return false;
  listFilterKey=filter;listRows=saved.rows;availableSources=saved.sources;listHostIds=saved.hosts;
  listOffset=saved.rows.length;listHasMore=saved.hasMore===true;listComplete=false;listReadFinished=false;
  listQuery=$('search').value;listArchived=$('archived').checked;renderSourceFilter();renderList();if(legacy)saveListSnapshot(filter);return true;
}
function saveListSnapshot(filter){
  const key=listSnapshotKey(filter);if(!key)return;
  const rows=(JSON.parse(filter)[3]==='recent'?[...listRows].sort((a,b)=>Number(pinRow(b).bridgePinned)-Number(pinRow(a).bridgePinned)||(b.recency-a.recency)||b.id.localeCompare(a.id)):listRows).slice(0,200),snapshot=JSON.stringify({rows,sources:availableSources,hosts:listHostIds,offset:rows.length,hasMore:listHasMore||listRows.length>rows.length});
  if(snapshot.length>512*1024)return;
  try{
    localStorage.setItem(key,snapshot);sessionStorage.removeItem(key);
    const keys=[];for(let i=0;i<localStorage.length;i++){const item=localStorage.key(i);if(item?.startsWith('codex-list-v1:')&&item!==key)keys.push(item);}
    for(const old of keys.slice(0,-7))localStorage.removeItem(old);
  }catch{try{sessionStorage.setItem(key,snapshot);}catch{}}
}
$('list-mode').value=localStorage.getItem('list-mode')||'recent';
$('list-mode').onchange=()=>{localStorage.setItem('list-mode',$('list-mode').value);loadList(true).catch(e=>toast(e.message));};
listSource=clientNavigation.initialHost?.startsWith('wsl:')?'wsl':localStorage.getItem('codex-source-filter')||'all';
if(!['all','desktop','cli','ide','wsl'].includes(listSource))listSource='all';
$('source-filter').onchange=()=>{listSource=$('source-filter').value;localStorage.setItem('codex-source-filter',listSource);return loadList(true).catch(e=>toast(e.message));};
function renderSourceFilter(){
  $('source-filter-label').hidden=false;
  const wsl=clientNavigation.wslSupported===true,stamp=BridgeI18n.locale()+':'+wsl;
  if(clientNavigation.wslSupported===false&&listSource==='wsl'){listSource='all';localStorage.setItem('codex-source-filter',listSource);}
  if(stamp!==sourceFilterStamp){
    const options=[['all',t('전체')],['cli','CLI'],['ide','VS Code'],['desktop','APP'],...(wsl?[['wsl','WSL']]:[])];
    $('source-filter').replaceChildren(...options.map(([value,label])=>{const option=el('option','',label);option.value=value;return option;}));
    sourceFilterStamp=stamp;
  }
  if($('source-filter').value!==listSource)$('source-filter').value=listSource;
  return true;
}
if(typeof bindChatListToolbar==='function')bindChatListToolbar(document.querySelector('#sidebar .chat-list-toolbar'));
function sessionAccess(access){
  if(!access)return {source:'desktop',runtime:'desktop',canSend:true,canInterrupt:true,canApprove:true,canReconnect:true,canConfigure:true,canChangePermissions:true,canChangeModel:true,canSelectSkills:true,canUseModes:true,canUseGoal:true,canUseSideChat:true,canEditMessages:true,readOnly:false};
  const legacy=access.source==='desktop';
  const allowed=name=>(name==='canReconnect'||!access.readOnly)&&(access[name]===undefined?legacy:access[name]===true);
  const specific=name=>access[name]===undefined?allowed('canConfigure'):allowed(name);
  return {...access,source:access.source||'unknown',runtime:access.runtime||null,canSend:allowed('canSend'),canInterrupt:allowed('canInterrupt'),canApprove:allowed('canApprove'),canReconnect:allowed('canReconnect'),canConfigure:allowed('canConfigure'),canChangePermissions:specific('canChangePermissions'),canChangeModel:specific('canChangeModel'),canSelectSkills:specific('canSelectSkills'),canUseModes:allowed('canUseModes'),canUseGoal:allowed('canUseGoal'),canUseSideChat:allowed('canUseSideChat'),canEditMessages:allowed('canEditMessages'),readOnly:access.readOnly===true};
}
function currentAccess(){
  const access=sessionAccess(state?.access||listRows.find(row=>row.id===currentId&&row.host===currentHost)?.access);
  if(desktopConnectionBlock(state,chatTimeline?.reconnectFailure))return {...access,canSend:false,canChangeModel:false};
  return awaitingCreationSettings(state)?{...access,canSend:false}:access;
}
function sourceLabel(access){return access?.runtime==='wsl'?'WSL':access?.source==='cli'?'CLI':access?.source==='ide'?'VS Code':access?.source==='unknown'?t('기타 소스'):'APP';}
function renderList(){
  const displayedRows=listRows.map(row=>pinRow(row));
  const stamp=JSON.stringify([$('list-mode').value,currentId,currentHost,listHasMore,BridgeI18n.locale(),availableSources,listRows.length?null:[listComplete,listReadFinished],displayedRows.map(row=>[row.id,row.host,row.title,row.projectKey,row.projectName,row.hostLabel,row.recency,row.bridgePinned,row.pinPending,row.archived,row.access,row.orphanedSideChat])]);
  if(stamp===listRenderStamp&&$('sessions').children.length){renderActivity();return;}
  listRenderStamp=stamp;
  const scrollTop=$('sessions').scrollTop;
  $('sessions').replaceChildren();
  const grouped=$('list-mode').value==='project', groups=new Map();
  let pinSection=null;
  const unassigned=chat=>chat.projectKey===(chat.host||'local')+'|unassigned';
  const ordered=grouped?[...displayedRows].sort((a,b)=>Number(unassigned(a))-Number(unassigned(b))||(b.recency-a.recency)||b.id.localeCompare(a.id)):[...displayedRows].sort((a,b)=>Number(!!b.bridgePinned)-Number(!!a.bridgePinned)||(b.recency-a.recency)||b.id.localeCompare(a.id));
  const hasPins=!grouped&&ordered.some(chat=>chat.bridgePinned);
  for(const chat of ordered){
    let parent=$('sessions');
    if(hasPins&&pinSection!==!!chat.bridgePinned){pinSection=!!chat.bridgePinned;const label=el('h3','muted',t(pinSection?'고정된 채팅':'최근 채팅'));$('sessions').append(label);}
    if(grouped){
      if(!groups.has(chat.projectKey)){
        const details=el('details','project-group');
        details.open=localStorage.getItem('group:'+chat.projectKey)!=='closed';
        details.append(el('summary','',chat.projectName+' · '+(chat.host==='local'?t('이 컴퓨터'):chat.hostLabel)));
        details.ontoggle=()=>localStorage.setItem('group:'+chat.projectKey,details.open?'open':'closed');
        groups.set(chat.projectKey,details);$('sessions').append(details);
      }
      parent=groups.get(chat.projectKey);
    }
    const button=el('button','session'+(chat.id===currentId&&chat.host===currentHost?' selected':''));
    button.dataset.id=chat.id;button.dataset.host=chat.host;
    button.append(el('strong','',chat.title));
    button.append(el('span','session-source',sourceLabel(sessionAccess(chat.access))||t('기타 소스')));
    const meta=el('small');meta.append(el('span','',(chat.orphanedSideChat?t('보조 채팅(기본 채팅 사용 불가)')+' · ':'')+chat.projectName+' · '+(chat.host==='local'?t('이 컴퓨터'):chat.hostLabel)),el('time','',dateText(chat.recency/1000)));
    if(chat.pinPending)button.append(el('span','session-source',t('동기화 보류 중인 고정 환경설정')));
    button.append(meta);button.onclick=()=>openChat(chat.id,chat.host,null,null,true).catch(e=>toast(e.message));bindSessionMenu(button,chat);parent.append(button);
  }
  if(listHasMore){const more=el('button','plain',t('더 많은 채팅 로드'));more.id='sessions-more';more.type='button';more.onclick=()=>loadList().catch(error=>toast(error.message));$('sessions').append(more);}
  if(!listRows.length)$('sessions').append(el('p','muted',t(listComplete?'채팅을 찾을 수 없습니다.':listReadFinished?'없는':'로드 중…')));renderActivity();$('sessions').scrollTop=scrollTop;
}
let sharedSessionMenu;
function getSessionMenu(){return sharedSessionMenu||(sharedSessionMenu=new SessionMenu({translate:t,notify:toast,newId:uuid}));}
workbench.openSessionMenu=(chat,element)=>getSessionMenu().show(sessionMenuContext(chat),{element});
function bindSessionMenu(button,chat,provider='codex'){
  getSessionMenu().bind(button,()=>sessionMenuContext(chat,provider));
}
const cliConnectionsPanel=new CliConnectionsPanel({request:api,notify:toast,translate:t,
  identity:()=>csrf+'|'+listIdentity,currentClient:()=>clientNavigation.activeClient?.()||clientNavigation.provider,newId:uuid});
$('cli-connections-button').onclick=()=>{ $('appearance-dialog').close();cliConnectionsPanel.open(); };
function sessionMenuContext(chat,provider='codex'){
  const identity={provider,id:chat.id,host:chat.host||'local',runtime:chat.access?.runtime||chat.runtime};
  const scope=listIdentity,token=csrf,isCurrent=()=>!!scope&&scope===listIdentity&&token===csrf;
  const current=()=>provider==='codex'?clientNavigation.provider==='codex'&&currentId===chat.id&&currentHost===identity.host:
    desktopSessions.provider===provider&&desktopSessions.sid===chat.id;
  const detail=current()?(provider==='codex'?state:desktopSessions.state):null;
  const view={...chat,...detail},access=sessionAccess(view.access),caps=view.capabilities||{},nativeId=view.nativeId||(ClientIdentity.family(provider)==='claude'?null:chat.id);
  if (view.temporary) return {title:view.title, subtitle:t('임시 보조 채팅'), isCurrent,
    source:{title:view.attachedParent?.title||t('메인 채팅'),open:()=>openChat(view.parentId,identity.host)}};
  const ensure=async()=>{
    if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
    if(!current()){
      await clientNavigation.choose(provider,{activate:false});
      if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
      if(provider==='codex')await openChat(chat.id,identity.host);else await desktopSessions.open(chat.id);
    }
    if(!isCurrent()||!current())throw Error('채팅이 바뀌었습니다. 채팅 메뉴를 다시 엽니다.');
  };
  const context={title:view.title,subtitle:[clientNavigation.clients.find(client=>client.id===provider)?.name||provider,view.hostLabel||t('이 컴퓨터')].join(' · '),
    isCurrent,sessionId:nativeId,pinned:sessionPins.value(identity,chat.bridgePinned),archived:!!view.archived,
    pin:pinned=>{sessionPins.set(identity,pinned);toast(t('이 기기에 저장되었습니다. 동기화 대기 중'));},
    link:provider==='codex'?window.BridgeSessionLinks.text(identity):null,
    nativeOrganization:true,projectName:view.projectName,
    organizationScope:provider==='codex'||caps.organization===true?'native':'bridge',
    renameScope:provider==='codex'||caps.rename===true?'native':'bridge',
    organization:async change=>{
      if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
      const result=await api(provider==='codex'?sessionUrl(chat.id,'organization',identity.host):
        ClientIdentity.path(provider,'organization',change?null:chat.id),
        provider==='codex'||!change?change:{...change,sessionId:chat.id},undefined,isCurrent);
      if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
      if(change)(provider==='codex'?loadList(true):desktopSessions.refresh()).catch(error=>toast(t(error.message)));
      return result;
    },
    details:[['클라이언트',clientNavigation.clients.find(client=>client.id===provider)?.name||provider],['세션 ID',nativeId,true],
      ['실행 위치',view.hostLabel||t('이 컴퓨터')],['대화 유형',provider==='codex'?sourceLabel(view.access):(view.backend||view.runtime||'Desktop')],
      ['작업 디렉토리',view.cwd,true],['모델',[view.model,view.effort].filter(Boolean).join(' · ')],['공급자',view.provider],['프로젝트 목록',view.projectName]],
    notifications:async()=>{await ensure();if(provider==='codex')return openChatNotifications();return desktopSessions.notifications();},
    manage:async()=>{try{await ensure();await openMessageManagement();}catch(error){toast(t(error.message));}}};
  if(['cli','ide'].includes(access.source)||view.backend==='cli'||view.runtime==='wsl')context.releaseCli=()=>cliConnectionsPanel.open({provider,sessionId:chat.id,host:identity.host});
  if(provider==='codex' && ['cli','ide'].includes(access.source) && (identity.host==='local'||identity.host.startsWith('codex:'))){
    const selection=JSON.stringify([clientNavigation.provider,currentId,currentHost]);
    context.cliNetworkIsCurrent=()=>isCurrent()&&selection===JSON.stringify([clientNavigation.provider,currentId,currentHost]);
    context.cliNetwork=async body=>{
      if(!context.cliNetworkIsCurrent())throw Error('연결 또는 채팅이 변경되었습니다. 세션 메뉴를 다시 엽니다.');
      const result=await api(sessionUrl(chat.id,'cli-network',identity.host),body,undefined,context.cliNetworkIsCurrent);
      if(!context.cliNetworkIsCurrent())throw Error('연결 또는 채팅이 변경되었습니다. 세션 메뉴를 다시 엽니다.');
      return result;
    };
  }
  const renameIds=new Map();
  if(provider!=='codex'||access.canConfigure)context.rename=async title=>{
    if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
    if(!renameIds.has(title))renameIds.set(title,uuid());
    const result=await api(provider==='codex'?sessionUrl(chat.id,'rename',identity.host):ClientIdentity.path(provider,'rename'),
      provider==='codex'?{title}:{title,id:renameIds.get(title),sessionId:chat.id},undefined,isCurrent);
    if(provider!=='codex'&&result.status!=='confirmed')throw Error('이름 바꾸기에는 확인이 필요합니다. 원래 클라이언트를 확인하십시오. 다시 제출되지 않습니다.');
    if(!isCurrent())return;
    if(provider==='codex'){
      if(current()&&state){state.title=result.title;$('chat-title').textContent=result.title;}
      await loadList(true);
    }else{
      if(current()&&desktopSessions.state){desktopSessions.state.title=result.title;desktopSessions.title.textContent=result.title;}
      await desktopSessions.refresh();
    }
  };
  if(provider==='codex'&&access.canEditMessages||provider!=='codex'&&caps.fork===true)context.fork=async()=>{
    await ensure();
    if(provider==='codex'){
      if(!currentAccess().canEditMessages)throw Error('이 연결은 아직 채팅 분기를 활성화하지 않았습니다.');
      const timeline=chatTimeline,row=[...timeline.rows.values()].map(item=>item.row).filter(row=>row.forkable).sort((a,b)=>b.order-a.order)[0];
      if(!row)throw Error('채팅 기록을 기다린 후 분기를 지원하는 메시지를 선택하세요.');
      return messageActions.open('fork',row,timeline);
    }
    const message=[...(desktopSessions.lastMessages||[])].reverse().find(row=>row.forkMessageId);
    if(!message)throw Error('이 채팅에는 아직 분기할 수 있는 메시지가 없습니다.');
    return desktopSessions.fork(message.forkMessageId);
  };
  if (provider === 'codex' && threadLookup) {
    context.findMessages = async () => { await ensure(); threadLookup.open('search'); };
    context.originalQueue = async () => { await ensure(); threadLookup.open('queue'); };
  }
  const archiveId=uuid();
  if(provider==='codex'||caps[view.archived?'unarchive':'archive']===true)context.archive=async()=>{
    const body={archived:!view.archived,id:archiveId,...(!view.archived?{disconnect:true}:{})};
    const result=await api(provider==='codex'?sessionUrl(chat.id,'archive',identity.host):ClientIdentity.path(provider,'archive'),
      provider==='codex'?body:{...body,sessionId:chat.id},undefined,isCurrent);
    if(result.status!=='confirmed')throw Error(t('아카이브 결과가 확인되지 않았습니다. 원래 채팅을 확인하세요. 이 작업은 반복되지 않습니다.'));
    if(!isCurrent())return;
    if(!view.archived&&current()){
      if(provider==='codex')$('back').click();else desktopSessions.backToList();
    }
    if(provider==='codex')await loadList(true);else await desktopSessions.refresh();
  };
  if(provider==='codex'&&(identity.host==='local'||identity.host.startsWith('codex:'))){
    const url=sessionUrl(chat.id,'delete',identity.host);let deleteId=uuid();
    context.deletion=async snapshot=>{
      if(!isCurrent())throw Error('연결 또는 계정이 변경되었습니다. 채팅 메뉴를 다시 엽니다.');
      const result=await api(url,snapshot?{id:deleteId,scope:snapshot.scope,confirmed:true,...(snapshot.retry?{retry:snapshot.retry}:{})}:undefined,undefined,isCurrent);
      if(!snapshot&&result.retry?.includes(deleteId))deleteId=uuid();
      if(snapshot){
        if(result.status!=='confirmed')throw Error('삭제 결과를 확인해야 합니다. 중복 제출되지 않으니, 원본 클라이언트에서 확인하시기 바랍니다.');
        if(!isCurrent())return result;
        if(currentHost===identity.host&&result.scope.includes(currentId))$('back').click();
        await loadList(true);
      }
      return result;
    };
  }
  if(view.forkedFrom)context.source={title:view.forkedFrom.title,open:()=>openChat(view.forkedFrom.id,view.forkedFrom.host)};
  if(view.attachedParent?.available)context.source={title:view.attachedParent.title,open:()=>openChat(view.attachedParent.id,view.attachedParent.host)};
  return context;
}
window.openCodexSessionMenu=button=>{
  if(!currentId||!state)return;
  getSessionMenu().show(sessionMenuContext({...listRows.find(row=>row.id===currentId&&row.host===currentHost),...state,id:currentId,host:currentHost}),{element:button});
};
async function loadList(reset=false){
  if(!reset&&(listLoading||!listHasMore))return;
  const generation=++listGeneration,offset=reset?0:listOffset,pinRead=sessionPins.capture();
  const query=$('search').value,archived=$('archived').checked,source=listSource,mode=$('list-mode').value;
  const filter=currentListFilter();
  if(reset&&filter!==listFilterKey){
    if(!restoreListSnapshot(filter)){listRows=[];availableSources=[];listOffset=0;listHasMore=false;listHostIds=[];listFilterKey=filter;}
    $('sessions').scrollTop=0;
  }
  const targetCount=reset?Math.max(100,listRows.length):offset+100;
  listComplete=false;listReadFinished=false;renderList();listLoading++;if($('sessions-more'))$('sessions-more').disabled=true;
  const groups=new Map();for(const row of listRows)(groups.get(row.host)||groups.set(row.host,[]).get(row.host)).push(row);
  const sources=new Set(availableSources),freshSources=new Map(),errors=[];
  const publish=()=>{
    if(generation!==listGeneration)return [];
    const merged=[...groups.values()].flat().sort((a,b)=>(mode==='recent'?Number(pinRow(b).bridgePinned)-Number(pinRow(a).bridgePinned):0)||(b.recency-a.recency)||b.id.localeCompare(a.id)||b.host.localeCompare(a.host));
    listRows=merged.slice(0,targetCount);availableSources=[...sources].sort();renderList();
    if(freshSources.size){
      listOffset=listRows.length;listHasMore=merged.length>=targetCount;
      listQuery=query;listArchived=archived;listFilterKey=filter;
      saveListSnapshot(filter);
    }
    return merged;
  };
  const read=async host=>{
    const url='/api/sessions?scope=host&host='+encodeURIComponent(host)+'&q='+encodeURIComponent(query)+'&offset='+(targetCount-100)+'&archived='+archived+'&source='+source+'&order='+encodeURIComponent(mode);
    try{
      const result=await api(url);if(generation!==listGeneration)return null;
      if(host==='local'){
        listHostIds=result.remoteHosts||[];
        for(const known of groups.keys())if(known!=='local'&&!listHostIds.includes(known))groups.delete(known);
      }
      if(result.complete===false||result.unavailableHosts?.length)errors.push(...(result.unavailableHosts||[{host,label:host,error:t('없는')}]));
      else{
        for(const row of result.sessions){const key=chatKey(row.id,row.host);row.recency=Math.max(row.recency,recentInteractions.get(key)||0);}
        for(const row of result.sessions)sessionPins.observe({provider:'codex',host:row.host,id:row.id},row.bridgePinned,pinRead);
        const retained=mode==='recent'?(groups.get(host)||[]).filter(row=>sessionPins.pending({provider:'codex',host:row.host,id:row.id})&&pinRow(row).bridgePinned&&!result.sessions.some(fresh=>fresh.id===row.id)):[];
        groups.set(host,[...result.sessions,...retained]);freshSources.set(host,result.availableSources||[]);
        for(const item of result.availableSources||[])sources.add(item);
      }
      publish();return result;
    }catch(error){if(generation===listGeneration){errors.push({host,label:host,error:error.message});publish();}return null;}
  };
  try{
    const entry=selectedCodexEntry,local=await read(entry||'local');
    if(generation!==listGeneration)return;
    if(!entry)await Promise.all(listHostIds.map(read));
    if(generation!==listGeneration)return;
    const merged=publish();listReadFinished=true;listComplete=errors.length===0;
    if(listComplete){
      availableSources=[...new Set([...freshSources.values()].flat())].sort();
      listRows=merged.slice(0,targetCount);
      if(!renderSourceFilter()){loadList(true).catch(e=>toast(e.message));return;}
      saveListSnapshot(filter);clientNavigation.acknowledgeList('codex',{...local,unavailableHosts:[],complete:true});listSync.acknowledgeSuccess();
    }
    renderHostErrors(errors);renderList();refreshActivity();if(!errors.length)window.BridgeFeatures?.prefetchChat();
    return listComplete;
  }finally{listLoading--;if($('sessions-more'))$('sessions-more').disabled=false;}
}
function loadMoreSessions(){
  const root=$('sessions');
  if(document.hidden||$('app').hidden||!isCodexClient(clientNavigation.provider)||!root.clientHeight||listQuery!==$('search').value||listArchived!==$('archived').checked)return;
  if(root.scrollHeight-root.clientHeight-root.scrollTop<240)loadList().catch(e=>toast(e.message));
}
$('sessions').addEventListener('scroll',loadMoreSessions,{passive:true});
// Collapsed project groups may leave too little content for a scroll event.
$('sessions').addEventListener('wheel',event=>{if(event.deltaY>0)loadMoreSessions();},{passive:true});
let listTouch=null;
$('sessions').addEventListener('touchstart',event=>{listTouch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
$('sessions').addEventListener('touchmove',event=>{
  if(!listTouch)return;
  if(event.touches.length!==1){listTouch=null;return;}
  const dx=event.touches[0].clientX-listTouch.x,dy=listTouch.y-event.touches[0].clientY;
  if(Math.abs(dx)>Math.max(10,Math.abs(dy))){listTouch=null;return;}
  if(dy>40){listTouch=null;loadMoreSessions();}
},{passive:true});
$('sessions').addEventListener('touchend',()=>{listTouch=null;},{passive:true});
$('sessions').addEventListener('touchcancel',()=>{listTouch=null;},{passive:true});
$('search').oninput=()=>{clearTimeout(loadList.timer);loadList.timer=setTimeout(()=>loadList(true).catch(e=>toast(e.message)),300);};$('refresh').onclick=()=>loadList(true).catch(e=>toast(e.message));
let sessionDiagnosticsText='';
const diagnosticsPath='/api/sessions/diagnostics';
function diagnosticsSummary(value){
  const lines=[t('SSH 연결 진단')];
  for(const host of value.hosts||[]){
    const location=host.host==='local'?t('이 컴퓨터'):t('원격 컴퓨터')+' '+(String(host.host).match(/^remote-\d+$/)?.[0].slice(7)||'?'),status=host.status==='ok'?t('사용 가능'):t('없는');
    lines.push(location+' · '+status+' · '+t(host.phase==='ssh'?'SSH 연결 목록':host.phase==='store'?'읽은 역사':'세션 검색'));
    if(host.status==='ok'){
      const counts=host.counts||{};
      lines.push([['CLI',counts.cli],['Desktop',counts.desktop],[t('기타 소스'),counts.other],[t('보이는 채팅'),counts.visible],[t('보관됨'),counts.archived]].map(([name,count])=>name+': '+(Number.isInteger(count)?count:0)).join(' · '));
    }else if(host.reason)lines.push(t(host.reason==='remote_read_failed'?'원격 읽기 실패':'로컬 기록 읽기 실패'));
  }
  return lines.join('\n');
}
async function loadSessionDiagnostics(){
  const status=$('session-diagnostics-status'),summary=$('session-diagnostics-summary'),error=$('session-diagnostics-error');
  status.textContent=t('SSH 연결 진단 로드 중…');summary.textContent='';error.textContent='';sessionDiagnosticsText='';
  $('session-diagnostics-copy').disabled=true;
  try{
    const value=await api(diagnosticsPath);
    sessionDiagnosticsText=diagnosticsSummary(value);summary.textContent=sessionDiagnosticsText;
    status.textContent=t('진단이 업데이트되었습니다.');$('session-diagnostics-copy').disabled=false;
  }catch(e){status.textContent='';error.textContent=t(e.message);}
}
$('open-session-diagnostics').onclick=()=>{
  $('appearance-dialog').close();$('session-diagnostics-dialog').showModal();
  const exportLink=$('session-diagnostics-export');
  const nativeUnsupported=BridgeHost.isNativeApp()&&window.BridgeMobileCapabilities?.diagnosticsExport!==true;
  exportLink.hidden=nativeUnsupported;
  $('session-diagnostics-export-note').hidden=!nativeUnsupported;
  $('session-diagnostics-export-note').textContent=nativeUnsupported?t('이 앱 버전은 파일을 내보낼 수 없습니다. 요약을 복사하거나 앱을 업데이트하세요.'):'';
  loadSessionDiagnostics();
};
$('session-diagnostics-refresh').onclick=loadSessionDiagnostics;
$('session-diagnostics-copy').onclick=()=>window.BridgeClipboard.copyWithFeedback(()=>sessionDiagnosticsText,$('session-diagnostics-copy'),toast);
$('session-diagnostics-export').onclick=event=>{if(BridgeHost.isNativeApp()&&window.BridgeMobileCapabilities?.diagnosticsExport!==true){event.preventDefault();return;}event.currentTarget.href=window.BridgeRelayURL?.(diagnosticsPath)||diagnosticsPath;};
$('archived').onchange=()=>loadList(true).catch(e=>toast(e.message));
const listSync=window.BridgeListSync=new ListSync({root:$('sessions'),status:$('list-sync'),refresh:()=>loadList(true),visible:()=>!$('app').hidden&&$('sidebar').getBoundingClientRect().width>0,ready:()=>!listLoading&&document.activeElement!==$('search')});
function renderCodexProgress(view=state){if(!view)return;renderChatProgress($('working'),{agentName:'Codex',active:view.status==='active',waiting:!!view.requests.length,connected:!!view.connected,reasoningSummary:view.reasoningSummary,reasoningScope:JSON.stringify([currentHost,view.id,view.reasoningTurnId])});if(!view.connected&&view.status!=='active')$('working').hidden=true;}
document.addEventListener('bridge-appearance-change',()=>renderCodexProgress());
document.addEventListener('bridge-language',()=>renderCodexProgress());
const contextCompactions=new Map(),contextCompacting=new Set();
const contextUsageControl=new ContextUsageControl({onCompact:async()=>{
  const id=currentId,host=currentHost,key=chatKey(id,host);if(contextCompacting.has(key)||!state?.connected)return false;
  const requestId=contextCompactions.get(key)||uuid();contextCompactions.set(key,requestId);contextCompacting.add(key);contextUsageControl.update({...state,busy:true});
  try{const result=await api(sessionUrl(id,'compact',host),{id:requestId});if(result.status!=='accepted')throw Error(result.message||t('결과가 확인되지 않았습니다. 원래 데스크톱 채팅을 확인하세요'));contextCompactions.delete(key);toast(t('컨텍스트 압축이 제출되었습니다.'));return true;}
  catch(error){toast(error.message);return false;}
  finally{contextCompacting.delete(key);if(currentId===id&&currentHost===host)contextUsageControl.update(state);}
}});
function fastModeTargetKey(){return JSON.stringify([modelScopeKey(),state?.model,state?.effort]);}
// 현재 대화·계정에 속한 카탈로그만 번개 버튼의 지원 여부 판단에 사용한다.
function renderFastModeToggle(view=state){
  const result=catalogResults.models,catalog=result?._scope===modelScopeKey()?result:null;
  fastModeToggle.sync({catalog,view,key:fastModeTargetKey(),canChange:currentAccess().canChangeModel,blocked:modelSaving||awaitingCreationSettings(view)});
}
const fastModeToggle=new FastModeToggle({button:document.createElement('button'),onError:error=>toast(error.message),onChange:async target=>{
  if(target.key!==fastModeTargetKey()||!state?.connected||!currentAccess().canChangeModel||modelSaving||awaitingCreationSettings(state))throw Error(t('활성 채팅이 변경되었습니다.'));
  const id=currentId,host=currentHost;
  modelSaving=true;renderFastModeToggle();
  try{
    // 기존 설정 API의 필수 모델과 현재 추론 강도는 그대로 보내고 속도만 전환한다.
    const result=await api(sessionUrl(id,'settings',host),{model:target.model,...(target.effort?{effort:target.effort}:{}),fastMode:target.fastMode});
    if(target.key===fastModeTargetKey()){
      if(result.confirmed&&result.serviceTier!==undefined)state={...state,serviceTier:result.serviceTier};
      renderFastModeToggle();fastModeControl.sync(state);
      if(!result.confirmed)toast('데스크톱이 설정을 수락했습니다. 동기화를 기다리는 중');
    }
    return result;
  }finally{modelSaving=false;renderFastModeToggle();}
}});
const accountUsageControl=new AccountUsageControl({read:(scope,force)=>api('/api/account?cached='+(force?'0':'1')+'&entry='+encodeURIComponent(scope.host==='local'?'desktop':scope.host))});
const contextGroup=document.createElement('span');contextGroup.className='composer-context-group';contextGroup.append(fastModeToggle.button,contextUsageControl.button,accountUsageControl.button);$('permissions-button').after(contextGroup);
function renderAccountUsage(view=state){
  const available=view?.provider==='openai'&&(currentHost==='local'||currentHost.startsWith('codex:'));
  accountUsageControl.update(available?{host:currentHost,provider:view.provider,identity:JSON.stringify([listIdentity,view.draftAccountIdentity||view.modelCatalogIdentity||''])}:null);
}
document.addEventListener('bridge-language',()=>accountUsageControl.relabel());
document.addEventListener('bridge-language',()=>renderFastModeToggle());
let newChatProjects=[],newChatEnvironments=[],newChatCanBrowse=false,newChatEntry='desktop',newChatPreferredHost='local',creatingChat=false,approvalBusy=0;
const newChatUrl=path=>path+(isCodexEntry(newChatEntry)?'?entry='+encodeURIComponent(newChatEntry):'');
const independentProject=()=>newChatEntry.startsWith('wsl:')||newChatEntry.startsWith('codex:')?newChatEntry+'|independent':'local|independent';
let newChatRequest=0,newChatModelsEnabled=false,newChatModelPicker=null;
function updateNewChatSubmit(){const selected=$('new-chat-project').value;$('new-chat-submit').disabled=creatingChat||!selected||selected==='__directory__'&&!$('new-chat-directory-path').value||newChatModelsEnabled&&(!newChatModelPicker||!newChatModelPicker.valid());}
function syncNewChatModels(){
  if(!newChatModelsEnabled){if(newChatModelPicker){newChatModelPicker.dispose();newChatModelPicker.root.remove();newChatModelPicker=null;}return;}
  if(!newChatModelPicker){const root=el('section');$('new-chat-form').insertBefore(root,$('new-chat-title').parentElement);newChatModelPicker=new window.BridgeCreationModelPicker({root,cache:modelCatalogs,namespace:()=>[listIdentity,newChatEnvironment().host,'codex'],isCurrent:()=>$('new-chat-dialog').open,onChange:updateNewChatSubmit});}
  const project=$('new-chat-project').value,path=$('new-chat-directory-path').value,kind=$('new-chat-type').value==='wsl'?'cli':$('new-chat-type').value;
  if(!project||project==='__directory__'&&!path){newChatModelPicker.clear();return;}
  const query=new URLSearchParams({kind,...(project==='__directory__'?{path,host:$('new-chat-directory-host').value}:{project})});
  const base=newChatUrl('/api/projects/models'),scope=JSON.stringify([listIdentity,codexActiveAccountId,newChatEntry,query.toString()]);
  newChatModelPicker.load(scope,refresh=>api(base+(base.includes('?')?'&':'?')+query+(refresh?'&refresh=true':'')));
}
$('new-chat-dialog').addEventListener('close',()=>{newChatModelPicker?.dispose();newChatModelPicker?.root.remove();newChatModelPicker=null;newChatModelsEnabled=false;});
function newChatEnvironment(){return newChatEnvironments.find(row=>row.key===$('new-chat-entry').value)||{host:isCodexEntry(newChatEntry)?newChatEntry:'local',name:newChatEntry.startsWith('wsl:')?wslEntries().find(row=>row.id===newChatEntry)?.name:t('이 컴퓨터')};}
function renderNewChatProjects(){
  const kind=$('new-chat-type').value,wsl=kind==='wsl',environment=newChatEnvironment(),host=environment.host;
  $('new-chat-project').disabled=false;
  $('new-chat-directory-host').replaceChildren(new Option(environment.name||environment.hostLabel||host,host));
  $('new-chat-directory').hidden=true;$('new-chat-directory-path').value='';
  const projects=newChatProjects.filter(row=>(wsl||(row.type||'desktop')===kind)&&row.host===host);
  $('new-chat-project').replaceChildren();
  if(wsl||newChatEntry.startsWith('codex:')||kind==='desktop'&&host==='local')$('new-chat-project').append(new Option(t('프로젝트 없음'),independentProject()));
  if(newChatCanBrowse)$('new-chat-project').append(new Option(t('다른 폴더를 선택하세요…'),'__directory__'));
  $('new-chat-directory-browse').hidden=!newChatCanBrowse;$('new-chat-directory-browse').disabled=false;
  for(const project of projects)$('new-chat-project').append(new Option(project.name,project.key));
  const selected=listRows.find(row=>row.id===currentId&&row.host===currentHost)?.projectKey;
  if(projects.some(row=>row.key===selected))$('new-chat-project').value=selected;
  else if(projects.length&&!wsl)$('new-chat-project').value=projects[0].key;
  $('new-chat-project').onchange();
  if(!wsl&&!newChatEnvironments.length){$('new-chat-directory-browse').hidden=true;$('new-chat-project').replaceChildren();$('new-chat-submit').disabled=true;}
}
async function loadSelectedNewChatProjects(){
  const generation=++newChatRequest,host=newChatEnvironment().host;
  renderNewChatProjects();
  if($('new-chat-type').value!=='cli'||host==='local'||newChatEntry.startsWith('codex:'))return;
  $('new-chat-submit').disabled=true;$('new-chat-directory-browse').disabled=true;$('new-chat-project').disabled=true;
  $('new-chat-path').textContent=t('데스크톱 프로젝트 로드 중…');$('new-chat-error').textContent='';
  try{
    const value=await api('/api/projects?host='+encodeURIComponent(host));
    if(generation!==newChatRequest||!$('new-chat-dialog').open)return;
    newChatProjects=newChatProjects.filter(row=>row.host!==host).concat(value.projects||[]);
    renderNewChatProjects();
  }catch(error){if(generation===newChatRequest&&$('new-chat-dialog').open){renderNewChatProjects();$('new-chat-error').textContent=t(error.message);}}
}
async function loadNewChatProjects(){
  const generation=++newChatRequest,kind=$('new-chat-type').value,wsl=kind==='wsl';
  newChatEntry=wsl?$('new-chat-entry').value:currentHost.startsWith('codex:')?currentHost:'desktop';
  const entry=newChatEntry;
  $('new-chat-description').textContent=wsl?'Codex · WSL':kind==='cli'?'Codex CLI':'Codex App';
  $('new-chat-error').textContent='';$('new-chat-submit').disabled=true;$('new-chat-directory-browse').disabled=true;
  $('new-chat-project').replaceChildren();$('new-chat-path').textContent=t('데스크톱 프로젝트 로드 중…');
  $('new-chat-location-summary').textContent=t('데스크톱 프로젝트 로드 중…');$('new-chat-location').hidden=false;
  $('new-chat-submit').textContent=t(wsl||kind==='cli'?'채팅 만들기':'생성 및 열기');
  if(wsl&&!entry)return;
  if(wsl){newChatProjects=[];newChatEnvironments=[];newChatCanBrowse=true;$('new-chat-entry-label').hidden=false;renderNewChatProjects();}
  try{
    const value=await api(newChatUrl('/api/projects'));
    if(generation!==newChatRequest||entry!==newChatEntry||!$('new-chat-dialog').open)return;
    newChatModelsEnabled=value.createModels===true;newChatProjects=value.projects||[];newChatCanBrowse=wsl||kind==='desktop'||Array.isArray(value.environments);
    if(!wsl){
      const environments=Array.isArray(value.environments)?value.environments.filter(row=>(row.type||row.surface)===kind):[];
      if(!Array.isArray(value.environments)){const hosts=new Map([['local',t('이 컴퓨터')]]);for(const row of newChatProjects)hosts.set(row.host,row.host==='local'?t('이 컴퓨터'):row.hostLabel||row.host);for(const [host,name] of hosts)environments.push({key:kind+'|'+host,host,name});}
      newChatEnvironments=environments;const previous=$('new-chat-entry').value;
      $('new-chat-entry').replaceChildren(...environments.map(row=>new Option(row.host==='local'?(row.name||row.hostLabel||t('이 컴퓨터')).replace('이 컴퓨터',t('이 컴퓨터')):row.name||row.hostLabel,row.key)));
      const selected=environments.find(row=>row.key===previous)||environments.find(row=>row.host===newChatPreferredHost);
      if(selected)$('new-chat-entry').value=selected.key;
      $('new-chat-entry-label').hidden=environments.length<2;
    }
    renderNewChatProjects();
    if(!wsl&&kind==='cli'&&newChatEnvironment().host!=='local')await loadSelectedNewChatProjects();
  }catch(error){if(generation===newChatRequest){$('new-chat-error').textContent=t(error.message);$('new-chat-path').textContent='';}}
}
$('new-chat').onclick=async()=>{
  const entries=wslEntries(),native=codexEntries().find(row=>row.id==='desktop'),type=$('new-chat-type');
  const wslOption=[...type.options].find(option=>option.value==='wsl');
  if(clientNavigation.wslSupported!==true)wslOption?.remove();
  else if(!wslOption)type.append(new Option('WSL','wsl'));
  for(const option of type.options)option.disabled=option.value==='wsl'?!entries.length:native?.enabled===false;
  $('new-chat-entry').replaceChildren(...entries.map(row=>new Option(row.name||row.label,row.id)));
  const preferred=currentHost.startsWith('wsl:')?currentHost:preferredWslEntry;
  if(entries.some(row=>row.id===preferred))$('new-chat-entry').value=preferred;
  newChatPreferredHost=currentHost;newChatEnvironments=[];
  type.disabled=currentHost.startsWith('codex:');
  type.value=currentHost.startsWith('codex:')?'cli':native?.enabled===false&&entries.length?'wsl':listSource==='wsl'&&entries.length?'wsl':listSource==='cli'?'cli':listSource==='all'&&currentHost.startsWith('wsl:')&&entries.length?'wsl':'desktop';
  $('new-chat-dialog').showModal();await loadNewChatProjects();
};
$('new-chat-type').onchange=()=>{
  if($('new-chat-type').value==='wsl'){$('new-chat-entry').replaceChildren(...wslEntries().map(row=>new Option(row.name||row.label,row.id)));if(wslEntries().some(row=>row.id===preferredWslEntry))$('new-chat-entry').value=preferredWslEntry;}
  return loadNewChatProjects();
};
$('new-chat-entry').onchange=()=>{if($('new-chat-type').value==='wsl'){preferredWslEntry=$('new-chat-entry').value;return loadNewChatProjects();}return loadSelectedNewChatProjects();};
$('new-chat-project').onchange=()=>{
  const value=$('new-chat-project').value,custom=value==='__directory__',path=custom?$('new-chat-directory-path').value:newChatProjects.find(row=>row.key===value)?.cwd||'';
  $('new-chat-directory').hidden=!custom;$('new-chat-directory-path').required=custom;
  $('new-chat-path').textContent=path;
  $('new-chat-location').hidden=!path;
  $('new-chat-location-summary').textContent=path.split(/[\\/]/).filter(Boolean).slice(-2).join(' / ')||path;
  $('new-chat-location').open=false;
  const browseLabel=$('new-chat-directory-browse').querySelector('[data-i18n]');browseLabel.dataset.i18n=path?'폴더 변경':'디렉토리 선택';browseLabel.textContent=t(browseLabel.dataset.i18n);
  syncNewChatModels();updateNewChatSubmit();
};
let folderPickerData=null;
$('new-chat-directory-host').onchange=()=>{$('new-chat-directory-path').value='';$('new-chat-project').onchange();};
$('new-chat-directory-browse').onclick=async()=>{
  if(!newChatCanBrowse)return;
  const request=newChatRequest,entry=newChatEntry,host=$('new-chat-directory-host').value,url=newChatUrl('/api/projects/browse');
  folderPickerData=null;
  return window.BridgeProjectPicker.choose({environment:host==='local'?(newChatEnvironment().name||'이 컴퓨터').replace('이 컴퓨터',t('이 컴퓨터')):newChatEnvironment().name,path:$('new-chat-directory-path').value||newChatProjects.find(row=>row.key===$('new-chat-project').value)?.cwd||null,
    request:body=>api(url,{host,...body}),isCurrent:()=>request===newChatRequest&&entry===newChatEntry&&$('new-chat-dialog').open,
    onChange:value=>folderPickerData=value,onSelect:value=>{$('new-chat-project').value='__directory__';$('new-chat-directory-path').value=value.path;$('new-chat-project').onchange();}});
};
$('new-chat-dialog').addEventListener('cancel',event=>{if(creatingChat)event.preventDefault();});
$('new-chat-form').onsubmit=async event=>{
  event.preventDefault();if(creatingChat||!$('new-chat-dialog').open)return;
  const project=$('new-chat-project').value,title=$('new-chat-title').value.trim(),kind=newChatEntry.startsWith('wsl:')?'wsl':newChatEntry.startsWith('codex:')?'cli':$('new-chat-type').value;
  const directory=project==='__directory__'?{path:$('new-chat-directory-path').value.trim(),createDirectory:false,host:$('new-chat-directory-host').value,...(kind==='cli'?{kind:'cli'}:{})}:null;
  if(directory&&!directory.path){$('new-chat-error').textContent=t('전체 프로젝트 디렉터리를 입력하세요.');return;}
  if(newChatModelsEnabled&&(!newChatModelPicker||!newChatModelPicker.valid()))return;
  const modelOptions=newChatModelsEnabled?newChatModelPicker.selection():{};
  const selection=directory?JSON.stringify(directory):project;
  if(!project){$('new-chat-error').textContent=t('프로젝트를 선택하거나 프로젝트 없음을 선택하세요.');return;}
  let attempt;
  try{attempt=JSON.parse(sessionStorage.getItem('new-chat-attempt')||'null');}catch{}
  const attemptKind=kind==='wsl'?undefined:kind;
  const host=newChatEnvironment().host,account=codexActiveAccountId,gateway=listIdentity,provider=clientNavigation.provider,token=csrf;
  const scope=JSON.stringify([gateway,host,modelOptions.modelCatalogIdentity||account||null]);
  const navigation=chatOpenGeneration,originHost=currentHost,accountRevision=codexAccountRevision;
  const request=++newChatRequest;
  const stillCurrent=()=>request===newChatRequest&&csrf===token&&listIdentity===gateway&&codexAccountRevision===accountRevision&&
    (account===undefined||codexActiveAccountId===account)&&
    clientNavigation.provider===provider&&currentHost===originHost&&chatOpenGeneration===navigation&&$('new-chat-dialog').open;
  if(!attempt||(attempt.scope&&attempt.scope!==scope)||attempt.selection!==selection||attempt.title!==title||attempt.entry!==newChatEntry||attempt.kind!==attemptKind||JSON.stringify(window.BridgeCreationModelPicker?.intent(attempt.modelOptions||{})||attempt.modelOptions||{})!==JSON.stringify(window.BridgeCreationModelPicker?.intent(modelOptions)||modelOptions))attempt={id:uuid(),scope,selection,project,title,entry:newChatEntry,modelOptions,...(attemptKind?{kind:attemptKind}:{})};
  attempt.scope=scope;attempt.modelOptions=modelOptions;sessionStorage.setItem('new-chat-attempt',JSON.stringify(attempt));
  creatingChat=true;newChatModelPicker?.setBusy(true);setLanguageBusy();$('new-chat-error').textContent='';$('new-chat-submit').textContent=t('만드는 중…');
  $('new-chat-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=true);
  document.querySelector('[data-close="new-chat-dialog"]').disabled=true;
  try{
    if(directory&&attempt.project==='__directory__'){const registered=await api(newChatUrl('/api/projects'),directory,undefined,stillCurrent);if(!stillCurrent())return;attempt.project=registered.project.key;sessionStorage.setItem('new-chat-attempt',JSON.stringify(attempt));}
    if(kind==='desktop'&&attempt.project!=='local|independent'){
      const trust=await api('/api/projects/trust',{key:attempt.project,confirmed:false},undefined,stillCurrent);
      if(!stillCurrent())return;
      if(trust.required){
        const accepted=await BridgeProjectPicker.confirmTrust({path:trust.path,environment:trust.environment,isCurrent:stillCurrent});
        if(!accepted||!stillCurrent())return;
        await api('/api/projects/trust',{key:attempt.project,confirmed:true,confirmation:trust.confirmation},undefined,stillCurrent);
      }
    }
    if(!stillCurrent())return;
    const result=await api(newChatUrl('/api/sessions'),{id:attempt.id,project:attempt.project,title:attempt.title,...attempt.modelOptions,...(attempt.kind?{kind:attempt.kind}:{})},undefined,stillCurrent);
    if(!stillCurrent())return;
    if(typeof result.id!=='string'||!result.id||result.host!==host)throw Error('생성된 채팅을 확인할 수 없습니다.');
    sessionStorage.removeItem('new-chat-attempt');$('new-chat-dialog').close();
    $('search').value='';$('archived').value='false';
    const opening=openChat(result.id,host,null,{...result,kind,title:attempt.title});
    loadList(true).catch(e=>toast(e.message));if(result.message)toast(result.message);
    opening.catch(error=>{if(currentId===result.id&&currentHost===host)toast(error.message);});
  }catch(e){
    if($('new-chat-dialog').open&&!stillCurrent())return;
    if($('new-chat-dialog').open)$('new-chat-error').textContent=t(e.message)+t('; 결과가 불확실한 경우 중복 채팅을 피하기 위해 다시 시도하기 전에 목록을 새로 고치십시오.');
    else toast(t('채팅이 생성되었지만 아직 연결되지 않았습니다.')+t(e.message));
  }finally{
    creatingChat=false;setLanguageBusy();$('new-chat-submit').textContent=t(kind==='desktop'?'생성 및 열기':'채팅 만들기');
    $('new-chat-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);
    const selected=$('new-chat-project').value;
    newChatModelPicker?.setBusy(false);updateNewChatSubmit();
    document.querySelector('[data-close="new-chat-dialog"]').disabled=false;
  }
};
const messageActions=new MessageActions({request:api,openChat,refresh:()=>loadList(true).catch(e=>toast(e.message)),uuid,notify:toast,busy:value=>{approvalBusy+=value?1:-1;setLanguageBusy();}});
desktopSessions.messageActions=messageActions;
document.addEventListener('bridge-message-error',event=>toast(event.detail));
function messageManagementTarget(){
  if(clientNavigation.provider!=='codex'){
    return desktopSessions.sid&&desktopSessions.draftScope?{scope:desktopSessions.draftScope,drafts:desktopSessions.composerDrafts,uuid}:null;
  }
  return currentId&&codexDraftScope?{scope:codexDraftScope,drafts:composerDrafts,temporary:sessionStorage,temporaryKey:'pending:'+chatKey(),
    url:sessionUrl(currentId,'message-management',currentHost),sendUrl:sessionUrl(currentId,'send',currentHost),uuid}:null;
}
const threadLookup = typeof ThreadLookup === 'function' ? new ThreadLookup({
  t,
  scope:() => {
    if (clientNavigation.provider !== 'codex' || !currentId || !codexDraftScope?.account) return null;
    return {id:currentId, host:currentHost, account:codexDraftScope.account,
      key:JSON.stringify([draftGateway,currentHost,currentId,codexDraftScope.account])};
  },
  request:(target, action, body, signal) => {
    const url = sessionUrl(target.id, action, target.host) + (action === 'original-queue' ? '&account=' + encodeURIComponent(target.account) : '');
    return api(url, body, signal, () => threadLookup.scope()?.key === target.key);
  },
  jump:hit => {
    const row = [...(chatTimeline?.rows.values() || [])].find(item => item.turnId === hit.turnId && item.itemId === hit.itemId);
    const node = row && chatTimeline.nodes.get(row.key)?.node;
    if (!node?.isConnected) return false;
    return () => {
      node.scrollIntoView({block:'center'});
      node.animate?.([{outline:'2px solid var(--accent)'},{outline:'2px solid transparent'}], {duration:1400});
    };
  }
}) : null;
workbench.temporaryCleanup=(id,host)=>{
  const scope={gateway:draftGateway,provider:'codex',account:'temporary:'+id,host,session:id};
  const cacheKey=JSON.stringify([listIdentity,host,id]),key=chatKey(id,host);
  return ()=>{
    for(const kind of ['draft','pending','pending-v2','queue-editor'])composerDrafts?.remove(composerDrafts.key(scope,kind));
    ChatTimeline.clearCache(cacheKey);
    if(draftGateway!==scope.gateway)return;
    codexProvisionalDrafts.delete(key);composerDrafts?.temporaryPending.delete('pending:'+key);
    for(const prefix of ['draft:','skills:','pending:'])sessionStorage.removeItem(prefix+key);
  };
};
function messageManagementChanged(recovery){
  if(currentId&&clientNavigation.provider==='codex'){
    const cleared=recovery?.clearedDraft;
    if(cleared&&composerDrafts.key(cleared.scope)===composerDrafts.key(codexDraftScope)&&!composerDrafts.load(codexDraftScope)&&
       $('message').value===cleared.draft.text&&JSON.stringify(codexQuotes?.quotes||[])===JSON.stringify(cleared.draft.quotes||[])){
      restoringComposer=true;$('message').value='';codexQuotes?.reset();selectedSkills.clear();renderSkillPills();restoringComposer=false;
      const references=cleared.body.references||[],ids=[...(cleared.body.attachments||[]),...attachments.rows.filter(row=>row.reference&&references.some(ref=>JSON.stringify(ref)===JSON.stringify(row.reference))).map(row=>row.id)];
      attachments.clear(chatKey(),ids);workModes.submitted(chatKey(),cleared.body.workMode);
      codexProvisionalDrafts.delete(chatKey());try{sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());}catch{}
      window.BridgePresentation?.resizeMessage();
    }
    if(recovery?.resolved?.some(row=>['accepted','queued'].includes(row.status))&&!composerDrafts.pendingSend(codexDraftScope))$('send-error').textContent='';
    renderQueue(state?.submissions||[]);
    if(!composerDrafts.pendingSend(codexDraftScope)&&$('send-error').textContent===t('이전 전송이 아직 확인되지 않았습니다. 채팅 기록을 확인하거나 확인되지 않은 기록을 먼저 해결하세요.'))$('send-error').textContent='';
  }
}
const messageManagement=typeof MessageManagementBinding==='function'?new MessageManagementBinding({target:messageManagementTarget,request:api,notify:toast,translate:t,
  beforeOpen:()=>{document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());},onChanged:messageManagementChanged}):null;
function openMessageManagement(editId){if(!messageManagementTarget()){toast('채팅을 열고 계정이 확인될 때까지 기다립니다.');return;}return messageManagement?.open(typeof editId==='string'?editId:undefined);}
$('open-message-management').onclick=openMessageManagement;
desktopSessions.onManageMessages=openMessageManagement;

codexQuotes=typeof ComposerQuotes==='function'?new ComposerQuotes({messages:$('messages'),input:$('message'),container:$('message').parentElement,scope:()=>desktopSessions.provider==='codex'&&currentId&&codexDraftScope?.gateway===draftGateway&&codexDraftScope?.session===currentId&&codexDraftScope?.host===currentHost?codexDraftScope:null,onChange:()=>{codexDraftTouched=true;saveDraft();},onError:text=>{$('send-error').textContent=text;},onPrompt:text=>{const input=$('message'),start=input.selectionStart,end=input.selectionEnd;input.value+=(input.value?'\n\n':'')+text;input.setSelectionRange(start,end);input.oninput();window.BridgePresentation?.resizeMessage();},translate:t}):null;
workbench.quoteMessage=(text,source,target)=>{if(target.provider==='codex'&&target.id===currentId&&target.host===currentHost&&desktopSessions.provider==='codex')codexQuotes?.add(text,source);};
workbench.reviewLine=(review,target)=>{
  if(target.provider!=='codex'||target.id!==currentId||target.host!==currentHost||desktopSessions.provider!=='codex')return;
  if(!codexQuotes?.reviewLine(review))toast(t('The chat draft is unavailable.'));
};

function imageComposerTarget(){
  if($('app').hidden||!$('app').classList.contains('chat-open'))return null;
  const codex=isCodexClient(clientNavigation.provider),view=desktopSessions;
  const quotes=codex?codexQuotes:view.quotes,panel=codex?attachments:view.attachments,workspace=codex?workbench:view.workbench;
  const id=codex?currentId:view.sid,provider=codex?'codex':view.provider,host=codex?currentHost:'local';
  if(!id||!quotes?.available()||!panel||panel.locked)return null;
  const key=codex?chatKey(id,host):JSON.stringify([provider,id]);
  if(panel.key!==key||!workspace?.current||(workspace.current.chatId||workspace.current.id)!==id||workspace.current.host!==host||(workspace.current.provider||'codex')!==provider)return null;
  if(codex){if(view.provider!=='codex'||$('chat').hidden||sending||!state||state.loadingHistory||state.activating||!currentAccess().canSend)return null;}
  else if(clientNavigation.provider!==provider||view.container.hidden||view.conversation.hidden||view.busy||!view.canMutate()||view.state?.capabilities?.attachments!==true)return null;
  return {provider,id,host,key,panel,workspace,scope:quotes.identity()};
}
function composerImageSource(value,target,capture=false){
  if(!value||!target)return null;
  if(value.context){
    const context=value.context;
    if(context.provider!==target.provider||context.id!==target.id||context.host!==target.host)return null;
    if(capture&&!value.url)return true;
    return value.composerScope===target.scope&&window.BridgeImageViewer.isRegisteredSource(value)&&/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.url)?value.url:null;
  }
  let url;try{url=new URL(value.url,location.href);}catch{return null;}
  if(url.origin!==location.origin||url.username||url.password||url.hash)return null;
  const path=window.BridgeRelayPath?.(url.pathname)??url.pathname;
  const codex=/^\/api\/sessions\/([0-9a-f-]{36})\/(uploads\/[0-9a-f-]{36}\/preview|desktop-images\/[a-f0-9]{64}|files\/[a-f0-9]{64})$/.exec(path);
  const desktop=/^\/api\/desktop-sessions\/(claude|deepseek|zcode|antigravity)\/(uploads\/[0-9a-f-]{36}\/preview|images\/[a-f0-9]{64})$/.exec(path);
  const identityKey=codex?'host':'sessionId',identity=codex?target.host:target.id;
  if(codex?target.provider!=='codex'||codex[1]!==target.id:!desktop||desktop[1]!==target.provider)return null;
  if(url.searchParams.getAll(identityKey).length!==1||url.searchParams.get(identityKey)!==identity)return null;
  const variants=url.searchParams.getAll('variant');
  if(variants.length>1||variants.some(value=>!['thumb','original'].includes(value))||!(codex?codex[2]:desktop[2]).startsWith('uploads/')&&variants.length)return null;
  if([...url.searchParams.keys()].some(key=>key!==identityKey&&key!=='variant'))return null;
  return url.href;
}
window.BridgeImageViewer?.configureComposer({
  scope:()=>imageComposerTarget()?.scope??null,
  canReuse:value=>!!composerImageSource(value,imageComposerTarget(),true),
  async add(value,scope){
    const target=imageComposerTarget(),source=composerImageSource(value,target);
    if(!source||scope!==target.scope)return false;
    const response=await fetch(source,{credentials:'same-origin',redirect:'error'});
    if(!response.ok||response.redirected)throw Error(t('첨부파일 업로드에 실패했습니다. 다시 시도해 보세요.'));
    if(Number(response.headers.get('Content-Length'))>20*1024*1024)throw Error(t('각 첨부 파일은 1바이트에서 20MB 사이여야 합니다.'));
    const blob=await response.blob();
    if(!/^image\/(?:png|jpeg|gif|webp)$/.test(blob.type))throw Error(t('이 앱은 이미지 첨부를 허용합니다. 다른 파일에는 파일 전송을 사용하십시오.'));
    if(!blob.size||blob.size>20*1024*1024)throw Error(t('각 첨부 파일은 1바이트에서 20MB 사이여야 합니다.'));
    const current=imageComposerTarget();
    if(!current||current.scope!==scope||current.panel!==target.panel||current.key!==target.key||!composerImageSource(value,current))return false;
    const file=new File([blob],value.name||t('이미지 첨부'),{type:blob.type}),count=current.panel.rows.length;
    current.panel.add([file]);
    if(current.panel.rows.length===count){if(current.panel.error)throw Error(t(current.panel.error));return false;}
    current.workspace.select('chat');
    if(current.provider==='codex')window.BridgePresentation?.openChat();else desktopSessions.collapseComposer(false);
    return true;
  }
});

function saveDraft(){
  if(!currentId||restoringComposer)return null;
  const fields={quotes:codexQuotes?.quotes.map(quote=>({...quote}))||[],text:$('message').value,selectionStart:$('message').selectionStart,selectionEnd:$('message').selectionEnd,sendMode:$('send-mode').value,workMode:workModes.selection||$('work-mode').value,skills:[...selectedSkills]};
  if(!codexDraftScope||!composerDrafts){if(draftGateway&&composerDrafts){if(codexDraftTouched)codexProvisionalDrafts.set(chatKey(),{gateway:draftGateway,account:'',...fields});}else sessionStorage.setItem('draft:'+chatKey(),fields.text);return null;}
  const saved=composerDrafts.save(codexDraftScope,fields);
  if(saved){codexProvisionalDrafts.delete(chatKey());sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());}
  else{codexProvisionalDrafts.set(chatKey(),{gateway:draftGateway,account:codexDraftScope.account,...fields});sessionStorage.setItem('draft:'+chatKey(),fields.text);}
  return saved;
}
function bindCodexDraft(view){
  const account=view?.draftAccountIdentity||'';
  if(!account&&codexDraftScope){saveDraft();sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());codexDraftScope=null;codexDraftTouched=false;codexQuotes?.reset();$('message').value='';selectedSkills.clear();renderSkillPills();return;}
  if(!draftGateway||!account||!currentId||!composerDrafts)return;
  const scope={gateway:draftGateway,provider:'codex',account,host:currentHost,session:currentId};
  const continuation=view?.draftContinuation;
  if(/^wsl:[0-9a-f]{32}$/.test(currentHost)&&view?.id===currentId&&view.host===currentHost&&
     continuation?.id===currentId&&continuation.entry===currentHost&&continuation.accountIdentity===account&&
     /^[a-f0-9]{64}$/.test(account)&&Array.isArray(continuation.previousAccountIdentities)&&continuation.previousAccountIdentities.length<=32){
    if(codexDraftScope&&codexDraftScope.account!==account)saveDraft();
    const options={temporary:sessionStorage,temporaryKey:'pending:'+chatKey()};
    if(!composerDrafts.pendingRecords(scope,options).length)for(const previousAccount of [...continuation.previousAccountIdentities].reverse()){
      if(!/^[a-f0-9]{64}$/.test(previousAccount)||previousAccount===account)continue;
      const previous={...scope,account:previousAccount},draft=composerDrafts.load(previous);
      if(!draft||!(draft.text||draft.quotes?.length)||composerDrafts.pendingRecords(previous,options).length)continue;
      if(composerDrafts.continueAccount(previous,scope))break;
    }
  }
  if(composerDrafts.key(scope)===composerDrafts.key(codexDraftScope))return;
  const switching=!!codexDraftScope;
  if(switching){saveDraft();sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());let oldPending;try{oldPending=JSON.parse(sessionStorage.getItem('pending:'+chatKey()));}catch{}if(!oldPending?.account)sessionStorage.removeItem('pending:'+chatKey());}
  codexDraftScope=scope;
  const pending=codexProvisionalDrafts.get(chatKey());
  if(pending&&(pending.gateway!==draftGateway||pending.account&&pending.account!==account)){codexProvisionalDrafts.delete(chatKey());sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());}
  const provisional=codexProvisionalDrafts.get(chatKey());
  const promoted=provisional&&composerDrafts.save(scope,provisional);
  if(promoted){codexProvisionalDrafts.delete(chatKey());sessionStorage.removeItem('draft:'+chatKey());sessionStorage.removeItem('skills:'+chatKey());}
  const stored=composerDrafts.load(scope);
  const legacy=(stored||provisional||window.BridgeSharedRelay)?null:composerDrafts.migrate(scope,sessionStorage,{text:'draft:'+chatKey(),skills:'skills:'+chatKey()});
  const draft=promoted||provisional||stored||legacy;
  if(draft&&(switching||!codexDraftTouched)){
    restoringComposer=true;
    $('message').value=draft.text;codexQuotes?.restore(draft.quotes);
    $('message').setSelectionRange(draft.selectionStart,draft.selectionEnd);
    // 이전의 즉시/대기 선택은 새 기본 동작으로 옮기고 명시적인 조종 선택은 보존한다.
    $('send-mode').value=draft.sendMode==='steer'?'steer':'auto';
    workModes.selection=draft.workMode;workModes.render(state,$('send-mode').value,sending);
    selectedSkills=new Set(draft.skills);renderSkillPills();
    restoringComposer=false;
    window.BridgePresentation?.resizeMessage();
  }else if(switching||!codexDraftTouched){codexQuotes?.reset();$('message').value='';$('send-mode').value='auto';workModes.selection=null;workModes.render(state,'auto',sending);selectedSkills.clear();renderSkillPills();}
  if(codexDraftTouched&&!switching)saveDraft();
  codexDraftTouched=false;
  messageManagement?.reconcile();
}
$('message').oninput=()=>{codexDraftTouched=true;saveDraft();};
$('message').addEventListener('keyup',saveDraft);
$('message').addEventListener('click',saveDraft);
$('work-mode').addEventListener('change',()=>{codexDraftTouched=true;saveDraft();});

let catalogStarted=false;
let chatOpenGeneration=0;
async function openChat(id,host="local",sideWorkspace=null,created=null,selected=false){
  sharedSessionMenu?.close();
  if(messageActions.pending&&messageActions.dialog.open)return;
  const openGeneration=++chatOpenGeneration,routeProvider=clientNavigation.provider;
  if(currentId===id&&currentHost===host&&chatTimeline&&!chatTimeline.abort.signal.aborted){
    workbench.select(workbench.current?.chatId===workbench.current?.id?'chat':'child:'+id);$('app').classList.add('chat-open');window.BridgePresentation?.openChat();browserNavigation.sync();reportVisibleChat();return;
  }
  let route, routeAccess;
  const fresh=created?.id===id&&created.host===host&&!sideWorkspace;
  const known=listRows.find(row=>row.id===id&&row.host===host);
  try {
    route=fresh?{rootId:id,cwd:known?.cwd}:known&&!known.attachedParentId&&!sideWorkspace?{rootId:id,cwd:known.cwd}:await workbench.resolveChat(id,host,async target=>{const meta=(await api(sessionUrl(target,'timeline',host)+'&limit=1')).meta;if(target===id)routeAccess=meta.access;return meta;});
    // A just-created child can reach the timeline before its attached-parent metadata.
    if(sideWorkspace===workbench.current&&sideWorkspace?.host===host&&route.rootId===id&&sideWorkspace.files.some(tab=>tab.chatId===id))
      route={...route,rootId:sideWorkspace.id,cwd:sideWorkspace.cwd};
  }
  catch(error) {if(openGeneration===chatOpenGeneration)toast(t(error.message));return;}
  if(openGeneration!==chatOpenGeneration||clientNavigation.provider!==routeProvider)return;
  messageActions.dialog.close();workbench.open(id,host,route);saveDraft();chatTimeline?.dispose();codexQuotes?.reset();currentId=id;currentHost=host;refreshEntryAccounts();codexDraftScope=null;codexDraftTouched=false;state=null;catalogStarted=false;workbench.current.access=sessionAccess(listRows.find(row=>row.id===id&&row.host===host)?.access);contextUsageControl.update(null);accountUsageControl.update(null);renderFastModeToggle();workModes.open(chatKey(id,host));$('send-mode').value='auto';attachments.open(chatKey(id,host));modelCatalogGeneration++;catalogData={models:null,skills:null};catalogResults={models:null,skills:null};catalogTasks={models:null,skills:null};skillIndex=new Map();skillTotal=0;skillPages=[];skillQuery={q:'',offset:0,limit:200};invalidSkills=new Set();skillRequest++;modelRequest++;modelTarget=null;fastModeControl.reset();$('model-dialog').close();notificationState={available:false,watching:false,notifyOnCompletion:false};notificationRequest++;$('notify-dialog').close();try{selectedSkills=new Set(JSON.parse(!draftGateway?sessionStorage.getItem('skills:'+chatKey(id,host))||'[]':'[]'));}catch{selectedSkills=new Set();}renderSkillPills();approvalStamp='';submittedRequestIds.clear();$('messages').replaceChildren();$('approvals').replaceChildren();$('queued').replaceChildren();$('message').value=!draftGateway?sessionStorage.getItem('draft:'+chatKey(id,host))||'':'';$('send-error').textContent='';$('chat-title').textContent=t('연결 중…');$('status').textContent=t('연결 중');$('welcome').hidden=true;$('chat').hidden=false;$('app').classList.add('chat-open');$('send').disabled=true;if(!browserNavigation.sync({provider:'codex',id,host}))history.replaceState(null,'','#'+id+'~'+encodeURIComponent(host));document.querySelectorAll('.session').forEach(n=>n.classList.toggle('selected',n.dataset.id===id&&n.dataset.host===host));const opening=workbench.current;
  $('notice').hidden=true;$('notice-text').textContent='';$('reconnect').disabled=true;$('reconnect-manager').hidden=true;
  if(fresh){$('message').disabled=false;if(created.title)$('chat-title').textContent=created.title;}
  renderModelSummary(fresh?created:{});
  $('model-button').disabled=true;
try{if(window.BridgeFeatures)await window.BridgeFeatures.load('chat');}catch(error){if(openGeneration===chatOpenGeneration&&workbench.current===opening&&$('app').classList.contains('chat-open')){$('status').textContent=t('연결 실패');$('send-error').textContent=t(error.message);}return;}
if(openGeneration!==chatOpenGeneration||workbench.current!==opening||currentId!==id||currentHost!==host||!$('app').classList.contains('chat-open'))return;
const timeline=chatTimeline=new ChatTimeline({cacheKey:listIdentity?JSON.stringify([listIdentity,host,id]):'',url:action=>sessionUrl(id,action,host),request:api,renderMeta:renderState,onReady:reportVisibleChat,onFile:async path=>{const session=workbench.current;if(currentId!==id||currentHost!==host||!session||(session.chatId||session.id)!==id||session.host!==host)return;try{const childRelative=timelineFilePath(path,state?.cwd),relative=timelineFilePath(state.cwd.replace(/[\\/]$/,'')+'/'+childRelative,session.cwd||state.cwd);await workbench.request(workbench.url(session,'info',relative));if(workbench.current!==session||currentId!==id||currentHost!==host)return;await workbench.locate(session,relative);}catch(error){if(workbench.current===session)toast(t(error.message));}},canEdit:()=>currentAccess().canEditMessages,renderText:(node,text,files,fullText)=>renderMarkdown(node,text,files,file=>timeline.fileUrl(file),{fullText}),onAction:(action,row,timeline)=>{if(!currentAccess().canEditMessages)return;const pendingKey='fork-edit:'+host+'|'+id;let pending;try{pending=JSON.parse(sessionStorage.getItem(pendingKey));}catch{}if(pending&&pending.sourceTurnId===row.turnId&&action==='edit'){sessionStorage.setItem('message-edit:'+timeline.url('message-action')+':'+row.key,pending.text);sessionStorage.removeItem(pendingKey);}return messageActions.open(action,row,timeline);},status:text=>{$('status').textContent=t(text);}});
  timeline.onReviewLine=review=>{
    if(chatTimeline===timeline&&!timeline.abort.signal.aborted)
      workbench.reviewLine({...review,repository:timeline.meta?.cwd||opening.cwd},{provider:'codex',id,host});
  };
  timeline.onAgent=agent=>{
    if(currentId===id&&currentHost===host&&workbench.current===opening&&!timeline.abort.signal.aborted&&!state?.temporary)
      workbench.agents(agent,id);
  };
  const agentTabScope=()=>currentId===id&&currentHost===host&&workbench.current===opening&&!timeline.abort.signal.aborted;
  timeline.agentTabsVisible=()=>agentTabScope()&&$('app').classList.contains('chat-open');
  timeline.onAgentTabs=(agents,directory)=>{
    if(agentTabScope()&&!state?.temporary)
      workbench.updateAgentTabs(id,agents,directory);
  };
  if(id!==opening.id)timeline.readWorkspaceAgents=async()=>{
    const directory=await api(sessionUrl(opening.id,'subagents',host),undefined,timeline.abort.signal);
    if(agentTabScope()&&Array.isArray(directory.agents))workbench.updateAgentTabs(opening.id,directory.agents,directory);
  };
  $('reconnect').disabled=false;
  window.BridgePresentation?.openChat();
  // A verified create response can authorize the first send before history has loaded.
  if(fresh&&created.meta?.id===id&&created.meta.host===host){
    renderState({title:created.title||t('연결 중…'),status:'notLoaded',loadingHistory:true,connected:false,
      requests:[],submissions:[],...created.meta});
  }
  const reading=timeline.start();
  const openingAccess=sessionAccess(known?.access||routeAccess);
  if((!fresh||created.kind==='desktop')&&openingAccess.source==='desktop'&&openingAccess.canReconnect)reconnectChat(id,host,timeline,false,host==='local'&&(fresh||selected));
  await reading;
  if(!timeline.abort.signal.aborted&&workbench.current?.chatScroll?.has(id))$('timeline').scrollTop=workbench.current.chatScroll.get(id);
  if(!timeline.abort.signal.aborted){scheduleCatalog();loadNotificationState(id,host);}
}
let notificationState={available:false,watching:false,notifyOnCompletion:false},notificationRequest=0;
async function loadNotificationState(id=currentId,host=currentHost){
  const request=++notificationRequest;
  try{const result=await api(sessionUrl(id,'notifications',host));if(request!==notificationRequest||id!==currentId||host!==currentHost)return;notificationState=result;return true;}
  catch(e){if(request===notificationRequest&&id===currentId&&host===currentHost){$('notify-error').textContent=t(e.message);notificationState={...notificationState,error:e.message};}return false;}
}
async function openChatNotifications(){
  const key=chatKey();
  $('notify-error').textContent='';$('notify-dialog').showModal();
  for(const id of ['notify-enabled','notify-completion','notify-save'])$(id).disabled=true;
  const loaded=await loadNotificationState();
  if(!$('notify-dialog').open||key!==chatKey()||!loaded)return;
  $('notify-enabled').value=notificationState.requests||'inherit';
  $('notify-completion').value=notificationState.completion||'inherit';
  for(const id of ['notify-enabled','notify-completion','notify-save'])$(id).disabled=false;
  $('notify-channel-status').textContent=t(notificationState.available?'알림 채널 활성화됨':'구성된 알림 채널이 없습니다. 타사 알림에서 설정하세요.');
}
$('notify-form').onsubmit=async event=>{
  event.preventDefault();
  const id=currentId,host=currentHost,request=++notificationRequest;
  const body={requests:$('notify-enabled').value,completion:$('notify-completion').value};
  $('notify-save').disabled=true;$('notify-error').textContent='';
  try{
    const result=await api(sessionUrl(id,'notifications',host),body);
    if(request!==notificationRequest||id!==currentId||host!==currentHost)return;
    notificationState=result;$('notify-dialog').close();toast('채팅 알림 설정이 저장되었습니다.');
  }catch(e){if(request===notificationRequest&&id===currentId&&host===currentHost)$('notify-error').textContent=t(e.message);}
  finally{if(request===notificationRequest&&id===currentId&&host===currentHost){$('notify-save').disabled=false;}}
};
async function loadResetDynamicSetting(){
  const input=$('appearance-reset-dynamic');input.disabled=true;
  try{const value=await api('/api/accounts');input.checked=!!value.resetDynamicEnabled;input.disabled=false;}
  catch(error){$('reset-dynamic-error').textContent=t(error.message);}
}
$('appearance-reset-dynamic').onchange=async event=>{
  const input=event.target;input.disabled=true;$('reset-dynamic-error').textContent='';
  try{const value=await api('/api/accounts/reset-dynamic',{enabled:input.checked});input.checked=value.resetDynamicEnabled;accountsPanel?.accept(value);if(value.resetDynamicEnabled&&accountsPanel?.visible())accountsPanel.refresh();}
  catch(error){$('reset-dynamic-error').textContent=t(error.message);await loadResetDynamicSetting();}
  finally{input.disabled=false;}
};
let notificationDefaultsRequest=0;
window.loadNotificationDefaults=async()=>{
  if(window.BridgeSharedRelay){$('appearance-reset-dynamic').closest('fieldset').hidden=true;return;}
  loadResetDynamicSetting();
  const request=++notificationDefaultsRequest;
  for(const id of ['notification-requests','notification-completions'])$(id).disabled=true;
  $('notification-settings-error').textContent='';
  if($('app').hidden)return;
  try{
    const result=await api('/api/notifications/defaults');if(request!==notificationDefaultsRequest)return;
    $('notification-requests').checked=result.requests;$('notification-completions').checked=result.completion;
    for(const id of ['notification-requests','notification-completions'])$(id).disabled=false;
  }catch(error){$('notification-settings-error').textContent=t(error.message);}
};
async function saveNotificationDefaults(){
  const body={requests:$('notification-requests').checked,completion:$('notification-completions').checked};
  for(const id of ['notification-requests','notification-completions'])$(id).disabled=true;
  try{await api('/api/notifications/defaults',body);if(currentId)await loadNotificationState();}
  catch(error){await window.loadNotificationDefaults();$('notification-settings-error').textContent=t(error.message);return;}
  await window.loadNotificationDefaults();
}
$('notification-requests').onchange=$('notification-completions').onchange=saveNotificationDefaults;
$('back').onclick=()=>{saveDraft();workbench.cancelLocate();desktopSessions.onListEnter();workbench.rememberScroll();workbench.stopThumbnails();$('app').classList.remove('chat-open');if(!browserNavigation.sync(null))history.replaceState(null,'',location.pathname);loadList(true).catch(e=>toast(e.message));};
function applyEntryCapabilities(view){
  const caps=view?.access?.runtime==='wsl'||view?.endpointId?.startsWith('wsl:')?view.capabilities||{}:{};
  for(const [id,capability] of [['permissions-button','permissions'],['skills-button','skills']])$(id).hidden=caps[capability]===false;
  const queue=$('send-mode').querySelector('[value=queue]');if(queue)queue.disabled=caps.queue===false;
  if(caps.queue===false&&$('send-mode').value==='queue')$('send-mode').value='auto';
  if(caps.skills===false){selectedSkills.clear();invalidSkills.clear();renderSkillPills();}
  if(caps.plan===false){workModes.selection='default';$('work-mode').value='default';}
  $('work-mode').hidden=caps.plan===false;
}
function awaitingCreationSettings(view){
  return ['pending','unknown'].includes(view?.creationSettings?.status);
}
function connectOnFirstSend(view){
  const access=view?.access;
  return view?.creationSettings?.canConnectOnSend===true&&currentHost==='local'&&view.host===currentHost&&view.id===currentId&&
    access?.source==='desktop'&&access.readOnly===false&&access.canSend===true&&!view.readOnlyReason&&
    !view.attachedParent&&!view.temporary&&!view.archived&&view.status!=='active'&&!view.requests?.length;
}
function desktopConnectionBlock(view,failure){
  if(view?.connected!==false||currentHost!=='local'||(view.access?.source&&view.access.source!=='desktop')||connectOnFirstSend(view))return null;
  return [failure,view.connectionError].find(message=>
    message==='The Codex desktop shared connection is not ready. After all desktop tasks finish, close the desktop app normally and check connection setup in Accounts.'||
    message==='The Codex desktop is connected to a different account or workspace. Select the same account in Bridge and the desktop app.')||null;
}
function composerCanSend(){
  return !!state&&(connectOnFirstSend(state)||(!state.loadingHistory&&!state.activating&&currentAccess().canSend));
}
function renderModelSummary(view){
  const pending=awaitingCreationSettings(view);
  const settings=pending||view.creationSettings?.status==='applied'?view.creationSettings:view;
  const model=settings.model&&settings.model!=='__custom__'?settings.model:t('모델');
  const label=pending?t(settings.status==='unknown'?'설정 확인 필요':'적용 대기'):'';
  const detail=[settings.effort,label].filter(Boolean).join(' · ');
  $('model-name').textContent=model;
  $('model-effort').textContent=detail?'· '+detail:'';$('model-effort').hidden=!detail;
  $('model-button').title=[model,detail].filter(Boolean).join(' · ');
}
function renderState(view){
  const recovered=!state?.connected&&view.connected;
  const accountChanged=state?.draftAccountIdentity&&view.draftAccountIdentity!==state.draftAccountIdentity;
  applyEntryCapabilities(view);
  contextUsageControl.update({...view,busy:contextCompacting.has(chatKey(currentId,currentHost))});state=view;renderAccountUsage(view);if(typeof bindCodexDraft==='function')bindCodexDraft(view);renderFastModeToggle(view);
  if(typeof messageManagement!=='undefined')messageManagement?.reconcile();
  if(typeof document!=='undefined')for(const dialog of document.querySelectorAll('dialog[data-permission-runtime]')){
    if(!view.connected||dialog.dataset.permissionThread!==currentId||dialog.dataset.permissionHost!==currentHost||
       dialog.dataset.permissionRuntime!==(view.access?.runtime||'desktop'))dialog.close();
  }
  const applying=awaitingCreationSettings(view),firstSend=connectOnFirstSend(view);
  if(chatTimeline&&(accountChanged||view.connected&&(recovered||!applying))){
    chatTimeline.reconnectFailure=null;chatTimeline.reconnectAttempt=null;
  }
  const reconnectFailure=chatTimeline?.reconnectFailure;
  const connectionBlock=desktopConnectionBlock(view,reconnectFailure);
  const access=sessionAccess(view.access),limited=!!view.access;
  $('permissions-button').textContent=t({'ask':'승인 요청','auto-review':'승인해 주세요','full-access':'전체 액세스'}[view.permissionMode]||'권한');
  $('permissions-button').disabled=!view.connected||!access.canChangePermissions;
  if($('model-dialog').open&&modelTarget===chatKey())fastModeControl.sync(view);
  if(visibleChat()){sessionActivity.read(chatKey());renderActivity();}
  $('chat-title').textContent=view.loadingHistory?t('채팅 로드 중…'):view.title;
  renderModelSummary(view);
  $('status').textContent=!view.connected?(firstSend?t('데스크톱에 연결 중'):view.loadingHistory?t('로딩 내역'):view.activating?t('대화를 재개하는 중…'):access.source==='cli'?t('저장된 기록'):view.connecting?t('데스크톱에 연결 중'):t('저장된 기록')):view.requests.length?t('귀하의 답변을 기다리고 있습니다'):view.status==='active'?t('실행 중'):t('연결됨');
  $('status').classList.toggle('offline',!view.connected);
  const restart=!connectionBlock&&view.desktopRestartRecommended&&currentHost==='local'&&access.source==='desktop'&&access.canReconnect&&
    !view.connected&&!view.connecting&&!view.activating&&!applying&&!firstSend;
  $('notice').hidden=view.connected&&!applying&&!firstSend;
  let notice=connectionBlock||reconnectFailure;
  if(!notice){
    if(firstSend)notice='선택한 모델로 새 채팅을 준비하고 있습니다.';
    else if(applying)notice=view.creationSettings.status==='unknown'?'Confirm the new chat model before sending. Reconnect or choose a model.':'요청한 모델 설정의 적용을 기다리고 있습니다.';
    else if(view.readOnlyReason)notice=view.readOnlyReason;
    else if(access.source==='cli')notice=view.connectionError||(access.canReconnect?'먼저 채팅 기록을 읽어보세요. 원래 CLI 세션에 계속 연결하거나 재개합니다.':access.reason||'CLI 채팅 기록을 사용할 수 있습니다. 지금은 이 채팅을 계속할 수 없습니다.');
    else if(limited&&!access.canReconnect)notice=access.reason||'저장된 이력을 보실 수 있습니다. 이 소스에는 원격 제어를 사용할 수 없습니다.';
    else if(view.connectionError==='Could not reconnect this chat to Codex. Try reconnecting this chat again.')notice=view.connectionError;
    else if(restart)notice='원래 데스크톱 세션의 연결이 여전히 끊어졌습니다. 다시 재구축해 보세요. 실패하면 Codex를 다시 시작하기 전에 앱 관리에서 작업을 검토하세요.';
    else if(view.activating)notice='자동으로 연결; 컴퓨터의 Codex에서 채팅이 열릴 수 있습니다.';
    else if(view.connecting)notice='데스크탑에 연결 중입니다. 그동안 저장된 기록을 읽을 수 있습니다.';
    else if(view.rebuildRecommended)notice='데스크톱 연결을 더 이상 사용할 수 없습니다. 연결을 다시 구축하십시오. 채팅 기록과 초안은 보관됩니다.';
    else notice=view.connectionError||'아직 연결되지 않았습니다. 기록을 읽거나 다시 연결할 수 있습니다.';
  }
  $('notice-text').textContent=t(notice);
  $('reconnect').hidden=(firstSend&&!reconnectFailure)||limited&&!access.canReconnect;
  $('reconnect').disabled=!!chatTimeline?.reconnectAttempt;
  $('reconnect').textContent=t(access.source==='cli'?'계속 채팅':!connectionBlock&&!applying&&(view.rebuildRecommended||restart)?'연결 재구축':'다시 연결');
  $('reconnect-manager').hidden=!restart;
  $('history').hidden=view.historyComplete||!view.connected;
  renderCodexProgress(view);$('stop').hidden=view.status!=='active'||!view.connected||!access.canInterrupt;
  $('send').disabled=sending||!composerCanSend()||!attachments.ready();
  $('message').disabled=limited&&!access.canSend;
  $('attach-button').disabled=limited&&!access.canSend;
  $('model-button').disabled=!!connectionBlock||limited&&!access.canChangeModel;
  if(connectionBlock&&$('model-dialog').open)$('model-dialog').close();
  $('skills-button').disabled=limited&&!access.canSelectSkills;
  if(access.canChangeModel||access.canSelectSkills)scheduleCatalog();
  $('send-mode').disabled=firstSend||limited&&!access.canSend;
  if(firstSend)$('send-mode').value='auto';
  $('send-mode').querySelector('[value=steer]').disabled=view.status!=='active'||!access.canSend;
  if((view.status!=='active'||!access.canSend)&&$('send-mode').value==='steer')$('send-mode').value='auto';
  sendModes.render(view,sending);
  const modesView=limited&&!access.canUseGoal?{...view,goalRuntimeAvailable:false}:view;
  workModes.render(modesView,$('send-mode').value,sending);
  $('work-mode').disabled=firstSend||limited&&!access.canUseModes;
  if(firstSend||limited&&!access.canUseModes)$('work-mode').value='default';
  workbench.current.access=access;
  // Parent workspace identity is resolved before opening the native child route.
  chatTimeline?.refreshActions();
  renderApprovals(access.canApprove?view.requests:[]);renderQueue(view.submissions||[]);
  if(typeof composerCommands!=='undefined')composerCommands.refresh();
}
$('send-mode').onchange=()=>{codexDraftTouched=true;sendModes.render(state,sending);workModes.render(state,$('send-mode').value,sending);saveDraft();};
function jsonPretty(value){return typeof value==='string'?value:JSON.stringify(value,null,2);}
function renderApprovals(requests){
  const stamp=JSON.stringify([BridgeI18n.language(),requests]);if(stamp===approvalStamp)return;
  approvalStamp=stamp;
  const container=$('approvals'),previous=new Map([...container.children].map(card=>[card.dataset.request,card])),kept=new Set();
  for(const [index,request] of requests.entries()){
    const old=previous.get(String(request.id)),key=JSON.stringify([BridgeI18n.language(),request]);let card;
    if(old?.requestStamp===key)card=old;
    else if(request.supported&&request.method==='bridge/requestUserInputAsync')card=renderAsyncApproval(request,old);
    else if(request.supported&&request.params?.computerUse)card=renderComputerApproval(request);
    else if(request.supported&&request.method==='item/plan/requestImplementation')card=renderPlanApproval(request);
    else card=renderNativeRequest(request);
    card.approvalRequest=request;card.requestStamp=key;kept.add(card);
    const before=container.children[index];if(before!==card)container.insertBefore(card,before||null);
  }
  for(const card of [...container.children])if(!kept.has(card))card.remove();
}
function renderNativeRequest(request){
  const card=el('section','approval'),error=el('p','error'),actions=el('div','actions'),form=el('form');
  card.dataset.request=String(request.id);error.setAttribute('role','alert');
  const id=currentId,host=currentHost,params=request.params||{},method=request.method;
  const input=method.includes('requestUserInput'),picker=method==='item/tool/requestOptionPicker',mcp=method==='mcpServer/elicitation/request';
  const permissions=method==='item/permissions/requestApproval',command=method==='item/commandExecution/requestApproval',files=method==='item/fileChange/requestApproval';
  const heading=input||picker?'Codex에는 귀하의 답변이 필요합니다':files?'파일 변경을 허용하시겠습니까?':command?'이 명령을 허용하시겠습니까?':permissions?'Permission request':'확인 대기 중';
  card.append(el('h3','',t(heading)));
  if(!request.supported){card.append(el('p','',params.message||t('데스크톱 앱에서 이 요청을 처리하세요.')));return card;}
  if(params.reason)card.append(el('p','',params.reason));
  if(params.command)card.append(el('pre','',jsonPretty(params.command)));
  if(params.cwd)card.append(el('p','muted',params.cwd));
  for(const [key,label] of Object.entries({changes:'변경 사항',grantRoot:'Permission target',permissions:'Permission request',additionalPermissions:'Additional permissions',networkApprovalContext:'Network access',proposedExecpolicyAmendment:'Proposed command rule',proposedNetworkPolicyAmendments:'Proposed network rules',commandActions:'Command actions',environmentId:'Environment'})){
    if(params[key]!=null){card.append(el('strong','',t(label)),el('pre','',jsonPretty(params[key])));}
  }
  const until=params.expiresAtMs??params.deadlineAtMs;
  if(Number.isFinite(until))card.append(el('p','muted',t('Expires')+' · '+new Date(until).toLocaleString()));
  if(params.message)form.append(el('p','',params.message));
  const controls=new Map();
  const receiptKey=request.snapshot?request.id+'.'+request.snapshot:request.id;
  let locked=submittedRequestIds.has(receiptKey);
  const disable=()=>form.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=locked);
  async function submit(response){
    if(locked||currentId!==id||currentHost!==host||!card.isConnected)return;
    if(Number.isFinite(until)&&Date.now()>=until){error.textContent=t('This request changed or expired. Review the latest request.');return;}
    locked=true;disable();error.textContent='';approvalBusy++;setLanguageBusy();
    try{
      const reviewed=request.snapshot?{...response,reviewedRequest:request.snapshot}:response;
      const receipt=await api(sessionUrl(id,'respond',host),{requestId:request.id,response:reviewed});
      if(receipt?.status==='unknown')throw Error(receipt.message||'This response may have reached the owner. Check the original conversation.');
      if(currentId!==id||currentHost!==host)return;
      submittedRequestIds.add(receiptKey);bumpRecency(id,host);toast('답장을 보냈습니다');
      card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
    }catch(failure){
      if(currentId!==id||currentHost!==host)return;
      error.textContent=t(failure.message);
      // A response may have reached the owner even when the receipt was lost.
      // The fresh projection (or the original app) determines what is pending.
      try{
        const fresh=await api(sessionUrl(id,'',host));
        if(currentId===id&&currentHost===host&&Array.isArray(fresh.requests)){
          renderApprovals(fresh.requests);
          if(failure.status===400&&card.isConnected&&fresh.requests.some(row=>row.id===request.id&&row.snapshot===request.snapshot)
              && !['This request changed or expired. Review the latest request.','This response was already submitted. Check the original conversation.'].includes(failure.message)){
            locked=false;disable();
          }
        }
      }catch{}
    }finally{approvalBusy--;setLanguageBusy();}
  }
  function action(label,handler,primary=false){
    const button=el('button',primary?'primary':'secondary',label);button.type='button';button.onclick=handler;actions.append(button);return button;
  }
  function submitForm(label,read){
    const button=el('button','primary',label);button.type='submit';actions.append(button);
    form.onsubmit=event=>{event.preventDefault();try{submit(read());}catch(failure){error.textContent=t(failure.message);}};
  }
  if(input){
    for(const question of params.questions||[]){
      const label=el('label','',question.question||question.header||question.id),text=el('textarea');text.rows=2;
      if(question.options?.length){
        const select=el('select');select.required=true;select.append(new Option(t('선택하다…'),''));
        for(const [index,option] of question.options.entries())select.append(new Option(option.label+(option.description?' — '+option.description:''),String(index)));
        select.append(new Option(t('답장을 직접 작성하세요.'),'custom'));text.hidden=true;text.placeholder=t('답장을 입력하세요');
        select.onchange=()=>{text.hidden=select.value!=='custom';text.required=!text.hidden;};label.append(select,text);
        controls.set(question.id,()=>select.value==='custom'?text.value:question.options[Number(select.value)].label);
      }else{text.required=true;label.append(text);controls.set(question.id,()=>text.value);}
      form.append(label);
    }
    submitForm(t('답장 제출'),()=>{
      const answers={};for(const [key,read] of controls){const value=read().trim();if(!value)throw Error('각 질문에 답변해 주세요.');Object.defineProperty(answers,key,{value:[value],enumerable:true});}
      return {answers};
    });
  }else if(picker){
    const group=el('fieldset');group.append(el('legend','',params.question));
    const nodes=(params.options||[]).map(option=>{
      const line=el('label'),field=el('input');field.type=params.allowMultiple?'checkbox':'radio';field.name='option';
      line.append(field,document.createTextNode(option.label));if(option.description)line.append(el('small','muted',option.description));group.append(line);return {field,option};
    });
    const free=el('textarea');free.rows=2;free.placeholder=t('답장을 직접 작성하세요.');free.setAttribute('aria-label',free.placeholder);group.append(free);form.append(group);
    const read=kind=>({action:kind,selectedOptions:nodes.filter(row=>row.field.checked).map(row=>row.option.label),freeformAnswer:free.value.trim()||null});
    submitForm(params.submitLabel||t('답장 제출'),()=>{const value=read('submit');if(!value.selectedOptions.length&&!value.freeformAnswer)throw Error('각 질문에 답변해 주세요.');return value;});
    action(params.skipLabel||t('건너뛰기'),()=>submit(read('skip')));action(t('취소'),()=>submit({action:'dismiss',selectedOptions:[],freeformAnswer:null}));
  }else if(mcp){
    const schema=params.requestedSchema||{};
    for(const [key,field] of Object.entries(schema.properties||{})){
      const label=el('label','',field.title||key),multiple=field.type==='array',items=multiple?field.items:field,required=(schema.required||[]).includes(key);
      let control,read;
      if(items.enum){
        control=el('select');control.multiple=multiple;if(!multiple)control.append(new Option(t('선택하다…'),''));
        for(const [index,value] of items.enum.entries())control.append(new Option(items.enumNames?.[index]||String(value),String(index)));
        read=()=>{const values=[...control.selectedOptions].filter(node=>node.value!=='').map(node=>items.enum[Number(node.value)]);return multiple?(values.length||required?values:undefined):values[0];};
      }else if(multiple){
        control=el('textarea');control.rows=2;control.placeholder='["a", "b"]';
        read=()=>{if(!control.value.trim())return required?[]:undefined;try{const value=JSON.parse(control.value);if(Array.isArray(value))return value;}catch{}throw Error('Enter an array of values.');};
      }else if(field.type==='boolean'){
        control=el('select');control.append(new Option(t('선택하다…'),''),new Option('true','true'),new Option('false','false'));read=()=>control.value===''?undefined:control.value==='true';
      }else{
        control=el('input');control.type=['number','integer'].includes(field.type)?'number':'text';if(control.type==='number')control.step=field.type==='integer'?'1':'any';
        read=()=>control.value===''?undefined:control.type==='number'?Number(control.value):control.value;
      }
      control.required=required&&!multiple;if(field.description)label.append(el('p','muted',field.description));label.append(control);form.append(label);controls.set(key,read);
    }
    submitForm(t('한 번만 허용'),()=>({action:'accept',content:Object.fromEntries([...controls].map(([key,read])=>[key,read()]).filter(([,value])=>value!==undefined))}));
    for(const [kind,label] of [['decline','거부'],['cancel','취소']])action(t(label),()=>submit({action:kind}));
  }else if(permissions){
    action(t('Allow for this turn'),()=>submit({decision:'accept',scope:'turn'}),true);
    if(request.snapshot)action(t('Allow for this session'),()=>submit({decision:'accept',scope:'session'}));
    action(t('거부'),()=>submit({decision:'decline'}));
  }else if(command||files){
    const names={accept:'한 번만 허용',acceptForSession:'Allow for this session',decline:'거부',cancel:'취소'};
    for(const choice of params.availableDecisions??['accept','decline','cancel']){
      if(typeof choice==='string'&&Object.hasOwn(names,choice))action(t(names[choice]),()=>submit({decision:choice}),choice==='accept');
      else if(choice&&typeof choice==='object'){
        const label=choice.acceptWithExecpolicyAmendment?'Apply command rule':choice.applyNetworkPolicyAmendment?'Apply network rule':null;
        if(label)action(t(label)+' · '+JSON.stringify(Object.values(choice)[0]),()=>submit({decision:choice}));
      }
    }
  }
  form.append(actions,error);card.append(form);disable();
  if(locked)card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
  return card;
}

function renderAsyncApproval(request, previous){
  const id=currentId,host=currentHost,card=el('section','approval'),form=el('form'),error=el('p','error');
  card.dataset.request=String(request.id);card.append(el('h3','',t('Codex에는 귀하의 답변이 필요합니다')));
  const controls={},fields=new Map([...(previous?.querySelectorAll('[data-question]')||[])].map(node=>[node.dataset.question,node]));
  let busy=submittedRequestIds.has(request.id);
  function setBusy(value){busy=value;form.querySelectorAll('button,input,select,textarea').forEach(node=>node.disabled=value);}
  async function submit(response){
    if(busy)return;
    setBusy(true);error.textContent='';approvalBusy++;setLanguageBusy();
    try{
      const result=await api(sessionUrl(id,'respond',host),{requestId:request.id,response});
      if(id!==currentId||host!==currentHost)return;
      if(response.action==='skip'){
        if(result.status!=='skipped')throw Error('건너뛰기를 확인할 수 없습니다. 새로고침하고 다시 시도하세요.');
        // A late receipt must not replace newer SSE state or another card's result.
        const remaining=[...$('approvals').children].flatMap(node=>{
          const current=node.approvalRequest;if(!current)return [];
          if(current.id!==request.id)return [current];
          const questions=current.params.questions.filter(question=>question.id!==response.questionId);
          return questions.length?[{...current,params:{...current.params,questions}}]:[];
        });
        renderApprovals(remaining);toast('원격 액세스를 건너뛰었습니다.');
      }else{
        submittedRequestIds.add(request.id);bumpRecency(id,host);toast('답장을 보냈습니다');
        card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
      }
    }catch(e){
      if(id===currentId&&host===currentHost){error.textContent=t(e.message);setBusy(false);}
    }finally{approvalBusy--;setLanguageBusy();}
  }
  for(const question of request.params.questions){
    let field=fields.get(question.id);
    if(!field){
      field=el('div');field.dataset.question=question.id;
      const label=el('label','',question.question||question.header||question.id);
      if(question.options?.length){
        const select=el('select');select.append(new Option(t('선택하다…'),''));
        for(const option of question.options)select.append(new Option(option.label+(option.description?' — '+option.description:''),option.label));
        select.append(new Option(t('답장을 직접 작성하세요.'),'__custom__'));label.append(select);
        const custom=el('textarea');custom.rows=2;custom.hidden=true;custom.placeholder=t('답장을 입력하세요');
        select.onchange=()=>custom.hidden=select.value!=='__custom__';label.append(custom);
        field.answer=()=>select.value==='__custom__'?custom.value:select.value;
      }else{
        const input=el('textarea');input.rows=2;input.required=true;label.append(input);field.answer=()=>input.value;
      }
      const actions=el('div','actions'),skip=el('button','secondary',t('건너뛰다'));skip.type='button';skip.dataset.action='skip-question';
      actions.append(skip);field.append(label,actions);
    }
    field.querySelector('button[type="submit"]')?.remove();
    const select=field.querySelector('select');
    if(select){select.options[0].textContent=t('선택하다…');select.options[select.options.length-1].textContent=t('답장을 직접 작성하세요.');field.querySelector('textarea').placeholder=t('답장을 입력하세요');}
    field.querySelector('[data-action="skip-question"]').textContent=t('건너뛰다');
    field.querySelector('[data-action="skip-question"]').onclick=()=>submit({action:'skip',questionId:question.id});
    controls[question.id]=field.answer;form.append(field);
  }
  const singleQuestion=request.params.questions.length===1;
  const actions=singleQuestion?form.querySelector('[data-question] .actions'):el('div','actions'),send=el('button','primary',t('답장 제출'));send.type='submit';actions.append(send);
  form.onsubmit=event=>{
    event.preventDefault();const answers={};
    for(const [key,get] of Object.entries(controls)){
      const value=get();if(!value.trim()){error.textContent=t('각 질문에 답변해 주세요.');return;}answers[key]=[value];
    }
    submit({answers});
  };
  if(!singleQuestion)form.append(actions);
  form.append(error);card.append(form);setBusy(busy);
  if(busy)card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
  return card;
}

function renderComputerApproval(request){
  const id=currentId,host=currentHost,card=el('section','approval'),computer=request.params.computerUse;
  card.dataset.request=String(request.id);card.append(el('h3','',t('컴퓨터 앱 액세스를 허용하시겠습니까?')),el('p','',computer.app));
  if(request.params.message)card.append(el('p','',request.params.message));
  const actions=el('div','actions'),error=el('p','error');card.append(actions,error);
  const receiptKey=request.snapshot?request.id+'.'+request.snapshot:request.id;
  let busy=submittedRequestIds.has(receiptKey);
  async function submit(response){
    if(busy)return;busy=true;approvalBusy++;setLanguageBusy();actions.querySelectorAll('button').forEach(b=>b.disabled=true);error.textContent='';
    try{
      const receipt=await api(sessionUrl(id,'respond',host),{requestId:request.id,response:request.snapshot?{...response,reviewedRequest:request.snapshot}:response});
      if(receipt?.status==='unknown')throw Error(receipt.message||'This response may have reached the owner. Check the original conversation.');
      bumpRecency(id,host);if(id===currentId&&host===currentHost)submittedRequestIds.add(receiptKey);
      card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
    }catch(failure){
      error.textContent=t(failure.message);
      if(id===currentId&&host===currentHost){
        try{const fresh=await api(sessionUrl(id,'',host));if(id===currentId&&host===currentHost&&Array.isArray(fresh.requests))renderApprovals(fresh.requests);}catch{}
      }
    }
    finally{approvalBusy--;setLanguageBusy();}
  }
  function choice(label,response,primary=false){const button=el('button',primary?'primary':'secondary',t(label));button.type='button';button.disabled=busy;button.onclick=()=>submit(response);actions.append(button);}
  if(computer.persistModes.includes('always'))choice('항상 허용',{action:'accept',persist:'always'});
  choice('거부',{action:'decline'});
  if(computer.persistModes.includes('session'))choice('이 대화를 허용하세요',{action:'accept',persist:'session'},true);
  else choice('한 번만 허용',{action:'accept'},true);
  return card;
}
function renderPlanApproval(request){
  const id=currentId,host=currentHost,key=chatKey(id,host),card=el('section','approval plan-approval');
  card.dataset.request=String(request.id);card.append(el('h3','',t('계획 준비됨')));
  const details=el('details'),summary=el('summary','',t('계획 보기')),content=el('div','plan-content');
  renderMarkdown(content,request.params.planContent||'',[],()=>null);details.append(summary,content);card.append(details);
  const label=el('label','',t('요청된 변경사항(선택사항)')),input=el('textarea');input.rows=2;input.maxLength=20000;label.append(input);card.append(label);
  const actions=el('div','actions'),yes=el('button','primary',t('현재 계획을 실행')),revise=el('button','secondary',t('피드백을 활용하여 계획 수정')),error=el('p','error');
  yes.type=revise.type='button';actions.append(yes,revise);card.append(actions,error);
  let busy=submittedRequestIds.has(request.id);
  function updateActions(){
    const hasFeedback=!!input.value.trim();
    yes.disabled=busy||hasFeedback;revise.disabled=busy||!hasFeedback;
    yes.className=hasFeedback?'secondary':'primary';revise.className=hasFeedback?'primary':'secondary';
  }
  input.oninput=updateActions;updateActions();
  async function submit(action){
    if(busy)return;
    if(action==='implement'&&input.value.trim()){updateActions();return;}
    if(action==='revise'&&!input.value.trim()){error.textContent=t('요청된 변경사항을 입력하세요.');return;}
    const response=action==='implement'?{action}:{action,text:input.value};
    busy=true;approvalBusy++;setLanguageBusy();yes.disabled=revise.disabled=true;error.textContent='';
    try{
      const result=await api(sessionUrl(id,'respond',host),{requestId:request.id,response});
      if(currentId!==id||currentHost!==host)return;
      bumpRecency(id,host);submittedRequestIds.add(request.id);
      if(result.status==='unknown'){error.textContent=t('배송은 미확인입니다. 다른 조치를 취하기 전에 대화를 확인하세요.');return;}
      workModes.selection=action==='implement'?'default':'plan';sessionStorage.setItem('work-mode:'+key,workModes.selection);workModes.render();
      card.append(el('p','muted',t('전송된. 데스크톱 확인을 기다리는 중…')));
    }catch(e){if(currentId===id&&currentHost===host){error.textContent=t(e.message);busy=false;updateActions();}}
    finally{approvalBusy--;setLanguageBusy();}
  }
  yes.onclick=()=>submit('implement');revise.onclick=()=>submit('revise');return card;
}
async function ignoreSubmission(value){
  const scope=currentId===value.threadId&&currentHost===value.host?codexDraftScope:null;
  const result=await api('/api/accounts/ignore-submission',value);
  const key='pending:'+chatKey(value.threadId,value.host);
  try{if(JSON.parse(sessionStorage.getItem(key))?.id===value.submissionId)sessionStorage.removeItem(key);}catch{}
  if(composerDrafts.temporaryPending.get(key)?.id===value.submissionId)composerDrafts.temporaryPending.delete(key);
  if(scope)await composerDrafts.settleSend(scope,value.submissionId,null,'ignore');
  if(currentId===value.threadId&&currentHost===value.host&&state){state.submissions=(state.submissions||[]).filter(row=>row.id!==value.submissionId);renderQueue(state.submissions);}
  return result;
}
const queuedSends=new Set();
function renderQueue(rows){
  $('queued').replaceChildren();
  threadLookup?.watch(state, $('queued'));
  const pending=codexDraftScope&&composerDrafts?.pendingRecords(codexDraftScope,{temporary:sessionStorage,temporaryKey:'pending:'+chatKey()})||[];
  if(rows.length||pending.length){const manage=el('button','plain',t('메시지 관리'));manage.type='button';manage.onclick=openMessageManagement;$('queued').append(manage);}
  const target=currentId,host=currentHost,account=codexDraftScope?.account;
  for(const row of rows){
    const card=el('div','queue-card'),reply=row.text.startsWith('<send_user_message_question_reply>');
    card.append(el('strong','',row.status==='queued'?t('현재 작업을 기다리는 중'):t('배송이 확인되지 않았습니다.')),el('p','',reply?t('질문 답변'):row.text));
    if(row.attachments?.length)card.append(el('small','muted',t('부착:')+row.attachments.join('、')));
    if(row.status==='queued'){
      const key=JSON.stringify([target,host,account,row.id]);
      if(row.canSendNow&&row.version){
        const now=el('button','plain',t('지금 보내기'));now.type='button';
        now.disabled=queuedSends.has(key)||!account||!currentAccess().canSend;
        now.onclick=async()=>{
          if(now.disabled||!account||!currentAccess().canSend||queuedSends.has(key)||currentId!==target||currentHost!==host||codexDraftScope?.account!==account)return;
          queuedSends.add(key);now.disabled=true;
          try{
            const result=await api(sessionUrl(target,'queue-send',host),{id:row.id,version:row.version,expectedAccount:account});
            if(currentId===target&&currentHost===host&&codexDraftScope?.account===account){
              if(result.status==='accepted'||result.status==='cancelled'){
                state={...state,submissions:(state?.submissions||[]).filter(item=>item.id!==row.id)};
                renderQueue(state.submissions);
              }
              toast(result.status==='accepted'?'대기 메시지를 보냈습니다.':result.status==='cancelled'?'대기 중인 메시지가 철회됨':'전송 결과가 확인되지 않았습니다. 대화 기록을 확인하세요.');
            }
          }catch(error){if(currentId===target&&currentHost===host)toast(error.message);}
          finally{queuedSends.delete(key);if(now.isConnected)now.disabled=!currentAccess().canSend;}
        };
        card.append(now);
      }
      const edit=el('button','plain',t('다시 편집'));edit.type='button';
      edit.disabled=!account||!currentAccess().canSend||queuedSends.has(key);
      edit.onclick=()=>{if(edit.disabled||currentId!==target||currentHost!==host||codexDraftScope?.account!==account)return;return openMessageManagement(row.id);};card.append(edit);
    }else{
      card.append(el('p','muted',t('채팅 기록을 확인하세요. 게이트웨이는 이 메시지를 자동으로 다시 보내지 않습니다.')));
      const ignore=el('button','plain',t('무시하다'));
      ignore.onclick=async()=>{
        if(state?.temporary)return openMessageManagement();
        if(!window.confirm(t('무시하면 확인되지 않은 기록만 무시됩니다. 메시지를 철회하거나 다시 보내지는 않습니다. 먼저 채팅 기록을 확인하세요.')))return;
        ignore.disabled=true;
        try{accountsPanel?.accept(await ignoreSubmission({threadId:target,submissionId:row.id,host}));toast('확인되지 않은 기록은 무시됩니다.');}
        catch(e){ignore.disabled=false;toast(e.message);}
      };if(!window.BridgeSharedRelay)card.append(ignore);
    }
    $('queued').append(card);
  }
}
function uuid(){const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
$('composer').onsubmit=async event=>{
  event.preventDefault();
  if(sending||!currentId||!composerCanSend())return;
  const rawText=$('message').value,submittedQuotes=JSON.stringify(codexQuotes?.quotes||[]),text=codexQuotes?codexQuotes.serialize(rawText):rawText;
  if(text.length>100000){$('send-error').textContent=t('따옴표를 포함한 메시지가 100,000자를 초과합니다. 보내기 전에 짧게 하세요.');return;}
  if(!attachments.ready()){toast('첨부파일 업로드가 완료될 때까지 기다리세요.');return;}
  const attachmentIds=attachments.ids(),references=attachments.references(),submittedAttachmentIds=attachments.rows.map(row=>row.id);if(!text.trim()&&!submittedAttachmentIds.length)return;
  const mode=sendModes.value(state),workMode=workModes.value(mode);
  if(connectOnFirstSend(state)&&(mode!=='send'||workMode!=='default'))return;
  if(!mode){$('send-error').textContent=t('이 연결은 대기열을 지원하지 않습니다.');return;}
  if(workMode==='goal'&&submittedAttachmentIds.length){$('send-error').textContent=t('목표 모드는 아직 첨부 파일을 지원하지 않습니다.');return;}
  if(invalidSkills.size){$('send-error').textContent=t('선택한 스킬을 사용할 수 없습니다. 새로고침하고 다시 선택하세요.');return;}
  const skills=[...selectedSkills].sort(),scope=codexDraftScope;
  const body={text,mode,skills,workMode,attachments:attachmentIds,uiLocale:BridgeI18n.locale()};if(references.length)body.references=references;
  const revision=saveDraft()?.revision,submittedProvisional=codexProvisionalDrafts.get(chatKey());
  const submittedKey=chatKey(),legacyKey='pending:'+submittedKey;let legacy=composerDrafts.temporaryPending.get(legacyKey);try{legacy=JSON.parse(sessionStorage.getItem(legacyKey))||legacy;}catch{}
  const matchingLegacy=legacy?.id&&legacy.gateway===draftGateway&&legacy.target===submittedKey&&(!legacy.account||legacy.account===scope?.account);
  const sameLegacy=matchingLegacy&&['text','mode','workMode','skills','attachments','references','uiLocale'].every(field=>JSON.stringify(legacy[field])===JSON.stringify(body[field]));
  const attempt=uuid(),target=currentId,targetHost=currentHost;
  let pending,usedDurable=false;
  sending=true;
  try{
    if(matchingLegacy&&legacy.text===body.text&&!sameLegacy){$('send-error').textContent=t('이전 전송이 아직 확인되지 않았습니다. 채팅 기록을 확인하거나 확인되지 않은 기록을 먼저 해결하세요.');renderQueue(state?.submissions||[]);messageManagement?.reconcile();return;}
    if(scope&&composerDrafts){pending=await composerDrafts.beginSend(scope,body,sameLegacy?legacy.id:uuid(),attempt,!!sameLegacy);usedDurable=!!pending;if(!pending&&composerDrafts.pendingSend(scope)){pending={blocked:true};}if(usedDurable&&sameLegacy&&!pending.blocked){composerDrafts.temporaryPending.delete(legacyKey);try{sessionStorage.removeItem(legacyKey);}catch{}}}
    if(pending?.blocked){$('send-error').textContent=t('이전 전송이 아직 확인되지 않았습니다. 채팅 기록을 확인하거나 확인되지 않은 기록을 먼저 해결하세요.');renderQueue(state?.submissions||[]);messageManagement?.reconcile();return;}
    if(!pending){pending=sameLegacy?legacy:{id:uuid(),gateway:draftGateway,target:submittedKey,account:scope?.account||'',...body};
      pending={...pending,attempts:[...(sameLegacy&&Array.isArray(legacy.attempts)?legacy.attempts:[]),attempt],untracked:!!(sameLegacy&&(legacy.untracked||!Array.isArray(legacy.attempts)))};composerDrafts.temporaryPending.set(legacyKey,pending);try{sessionStorage.setItem(legacyKey,JSON.stringify(pending));}catch{} }
    attachments.setLocked(true);workModes.render(state,mode,true);sendModes.render(state,true);$('send').disabled=true;$('send-error').textContent='';
    const result=await api(sessionUrl(target,'send',targetHost),{...body,id:pending.id});
    if(result.status==='ignored')throw Error(t('이 확인되지 않은 기록은 무시되었습니다. 다시 보내기 전에 메시지를 새로 고치고 편집하세요.'));
    if(result.status==='unknown')throw Error(t('메시지가 전달되었을 수 있습니다. 채팅 기록을 확인하세요. 다시 클릭하면 두 번 제출되지 않습니다.'));
    if(result.queueOwner==='native'&&currentId===target&&currentHost===targetHost&&
        scope?.account===codexDraftScope?.account&&scope?.gateway===draftGateway)threadLookup?.refreshQueue();
    bumpRecency(target,targetHost);
    const sameRevision=usedDurable?composerDrafts.load(scope)?.revision===revision:$('message').value===rawText&&JSON.stringify(codexQuotes?.quotes||[])===submittedQuotes;
    let confirmed=usedDurable?await composerDrafts.settleSend(scope,pending.id,attempt,'confirm',revision):false;
    if(!usedDurable){let saved=composerDrafts.temporaryPending.get(legacyKey);try{saved=JSON.parse(sessionStorage.getItem(legacyKey))||saved;}catch{}confirmed=saved?.id===pending.id&&saved.attempts?.includes(attempt);if(confirmed){composerDrafts.temporaryPending.delete(legacyKey);try{sessionStorage.removeItem(legacyKey);}catch{}}}
    if(confirmed&&submittedProvisional&&JSON.stringify(codexProvisionalDrafts.get(chatKey(target,targetHost)))===JSON.stringify(submittedProvisional)){codexProvisionalDrafts.delete(chatKey(target,targetHost));try{sessionStorage.removeItem('draft:'+chatKey(target,targetHost));sessionStorage.removeItem('skills:'+chatKey(target,targetHost));}catch{}}
    if(confirmed)attachments.clear(chatKey(target,targetHost),submittedAttachmentIds);
    if(confirmed&&sameRevision&&$('message').value===rawText&&JSON.stringify(codexQuotes?.quotes||[])===submittedQuotes){
      if(!usedDurable)try{sessionStorage.removeItem('draft:'+chatKey(target,targetHost));}catch{}
      workModes.submitted(chatKey(target,targetHost),workMode);
      if(currentId===target&&currentHost===targetHost&&composerDrafts.key(codexDraftScope)===composerDrafts.key(scope)){
        restoringComposer=true;$('message').value='';codexQuotes?.reset();selectedSkills.clear();renderSkillPills();restoringComposer=false;
        window.BridgePresentation?.resizeMessage();
      }
    }
    toast(workMode==='goal'?(result.activation?.status==='queued'?t('목표가 생성되었습니다. 대기 시작'):result.activation?t('목표가 생성되었습니다. 시작 중…'):t('목표 요청이 제출되었습니다. 데스크톱 확인 대기 중')):result.status==='queued'?t('전송 대기열에 추가됨'):t('채팅으로 보냈습니다'));
  }catch(error){
    // Only an explicit pre-submission rejection permits changing this request.
    // Unknown delivery and network failures retain their original pending ID.
    if(error.status===400&&error.code==='send_not_submitted'){
      if(usedDurable)await composerDrafts.settleSend(scope,pending.id,attempt,'reject');
      else {let saved=composerDrafts.temporaryPending.get(legacyKey);try{saved=JSON.parse(sessionStorage.getItem(legacyKey))||saved;}catch{}if(saved?.id===pending.id&&saved.attempts?.includes(attempt)){saved.attempts=saved.attempts.filter(value=>value!==attempt);if(!saved.untracked&&!saved.attempts.length){composerDrafts.temporaryPending.delete(legacyKey);try{sessionStorage.removeItem(legacyKey);}catch{}}else{composerDrafts.temporaryPending.set(legacyKey,saved);try{sessionStorage.setItem(legacyKey,JSON.stringify(saved));}catch{}}}}
    }
    if(currentId===target&&currentHost===targetHost){$('send-error').textContent=t(error.message);window.BridgePresentation?.showError();}
    if(error.code!=='send_not_submitted'&&currentId===target&&currentHost===targetHost)await messageManagement?.reconcile();
  }
  finally{sending=false;attachments.setLocked(false);workModes.render(state,$('send-mode').value,false);$('send').disabled=!composerCanSend()||!attachments.ready();sendModes.render(state,false);}
};
$('message').onkeydown=event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();$('composer').requestSubmit();}};
function chatCommandActions(chat,provider,button){
  if(!chat?.id)return [];
  const context=sessionMenuContext(chat,provider);
  return ComposerCommands.session(context,view=>getSessionMenu().show(context,{element:button},view));
}
const composerCommands=new ComposerCommands({input:$('message'),
  scope:()=>currentId&&desktopSessions.provider==='codex'&&!$('chat').hidden?JSON.stringify([listIdentity,currentHost,currentId,codexActiveAccountId]):null,
  actions:()=>[...ComposerCommands.controls({model:$('model-button'),skills:$('skills-button'),permissions:$('permissions-button'),context:contextUsageControl,workMode:$('work-mode')}),
    ...chatCommandActions({...state,id:currentId,host:currentHost},'codex',$('message')),
    {id:'new',label:'새 채팅',enabled:!$('new-chat').disabled,run:()=>$('new-chat').click()},
    {id:'side',label:'보조 채팅',enabled:!!state&&currentAccess().canUseSideChat,run:()=>workbench.sideChat()}],onError:toast});
desktopSessions.commandActions=()=>[...chatCommandActions({...desktopSessions.state,id:desktopSessions.sid},desktopSessions.provider,desktopSessions.input),
  {id:'new',label:'새 채팅',enabled:!$('new-chat').disabled,run:()=>$('new-chat').click()}];

$('stop').onclick=async()=>{if(!currentAccess().canInterrupt)return;try{await api(sessionUrl(currentId,'stop'),{});toast('중지 요청됨');}catch(e){toast(e.message);}};
$('history').onclick=async()=>{$('history').disabled=true;try{await api('/api/sessions/'+currentId+'/history',{});}catch(e){toast(e.message);}finally{$('history').disabled=false;}};
$('reconnect').onclick=async()=>{
  const access=currentAccess();if(!access.canReconnect||$('reconnect').disabled||!chatTimeline)return;
  const rebuild=!awaitingCreationSettings(state)&&(state?.rebuildRecommended||!$('reconnect-manager').hidden);
  await reconnectChat(currentId,currentHost,chatTimeline,rebuild,currentHost==='local'&&(connectOnFirstSend(state)||awaitingCreationSettings(state)));
};
async function reconnectChat(id,host,timeline,rebuild,prepareCreation=false){
  if(timeline.reconnectAttempt)return;
  const attempt=timeline.reconnectAttempt={};
  const current=()=>chatTimeline===timeline&&!timeline.abort.signal.aborted&&id===currentId&&host===currentHost;
  $('reconnect').disabled=true;
  try{await api(sessionUrl(id,'reconnect',host),{activate:true,...(prepareCreation?{prepareCreation:true}:{}),...(rebuild?{rebuild:true}:{})},timeline.abort.signal,current);}
  catch(error){
    if(!current()||timeline.reconnectAttempt!==attempt||state?.connected&&!awaitingCreationSettings(state))return;
    timeline.reconnectFailure=error.message;
    if(state)renderState(state);
  }finally{
    if(timeline.reconnectAttempt===attempt)timeline.reconnectAttempt=null;
    if(current())$('reconnect').disabled=!!timeline.reconnectAttempt;
  }
}
$('reconnect-manager').onclick=()=>clientNavigation.openManager();
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
async function loadCatalogKind(kind,refresh=false){
  if(kind!=='models')throw Error(t('알 수 없는 카탈로그 유형'));
  if(refresh)modelCatalogGeneration++;
  const target=currentId,targetHost=currentHost,provider=state?.provider,generation=modelCatalogGeneration;
  const accountIdentity=state?.modelCatalogIdentity||'',gatewayIdentity=listIdentity;
  const identity=JSON.stringify([gatewayIdentity,target,targetHost,provider,accountIdentity]);
  if(!refresh&&catalogTasks[kind]?.identity===identity)return catalogTasks[kind];
  const request=api('/api/sessions/'+target+'/catalog?kind='+kind+(refresh?'&refresh=true':'')).then(value=>{
    if(currentId!==target||currentHost!==targetHost||state?.provider!==provider||(state?.modelCatalogIdentity||'')!==accountIdentity||listIdentity!==gatewayIdentity||generation!==modelCatalogGeneration)throw Error(t('활성 채팅이 변경되었습니다.'));
    if(accountIdentity&&value?.cache?.identity!==accountIdentity)throw Object.assign(Error(t('계정이 변경되었습니다. 모델 설정을 다시 엽니다.')),{code:'model_identity_changed'});
    const payload=value?.[kind]??value?.data??value;
    if(!Array.isArray(payload)){
      const actual=payload===null?'null':typeof payload;
      throw Error(t('잘못된 모델 카탈로그 응답')+' ('+kind+': '+actual+')');
    }
    catalogData[kind]=payload.map(row=>{
      if(typeof row==='string')return {id:row,name:row};
      const id=row?.id||row?.model;
      return typeof id==='string'&&id?{...row,id,name:row.name||row.displayName||id}:null;
    }).filter(Boolean);
    const result={...value,kind,[kind]:catalogData[kind],_scope:identity};
    catalogResults[kind]=result;
    if(accountIdentity&&value?.cache?.identity===accountIdentity){Object.assign(result,window.BridgeModelCatalogCache.write(modelCatalogs,[gatewayIdentity,targetHost,'codex'],result));catalogData[kind]=result[kind];}
    renderFastModeToggle();
    return result;
  }).finally(()=>{if(catalogTasks[kind]===request)catalogTasks[kind]=null;});
  request.identity=identity;catalogTasks[kind]=request;
  return request;
}
function resetSkillCatalog(){
  clearTimeout(skillSearchTimer);$('skill-search').value='';$('skill-list').scrollTop=0;skillRequest++;
  catalogData.skills=[];catalogResults.skills=null;catalogTasks.skills=null;
  skillIndex=new Map();skillTotal=0;skillPages=[];skillQuery={q:'',offset:0,limit:200};invalidSkills=new Set();
}
async function loadSkills({refresh=false,append=false}={}){
  const target=currentId,targetHost=currentHost;
  const query={...skillQuery};
  if(!refresh&&!append&&catalogResults.skills)return catalogResults.skills;
  if(!refresh&&!append&&catalogTasks.skills)return catalogTasks.skills;
  if(refresh){
    skillRequest++;catalogTasks.skills=null;catalogResults.skills=null;skillPages=[];skillQuery.offset=0;invalidSkills=new Set();
    $('skill-list').scrollTop=0;
  }
  query.offset=refresh?0:skillQuery.offset;
  const generation=skillRequest;
  const requestKey=chatKey(target,targetHost)+'|'+query.q+'|'+query.offset;
  if(!append&&catalogTasks.skills?.key===requestKey&&catalogTasks.skills?.generation===generation)return catalogTasks.skills;
  const ids=[...selectedSkills].slice(0,8);
  const path='/api/sessions/'+target+'/catalog?kind=skills&q='+encodeURIComponent(query.q)+'&limit='+query.limit+'&offset='+query.offset+(refresh?'&refresh=true':'')+ids.map(id=>'&id='+encodeURIComponent(id)).join('');
  const request=api(path).then(value=>{
    if(currentId!==target||currentHost!==targetHost||generation!==skillRequest)return value;
    const rows=Array.isArray(value?.skills)?value.skills:[];
    if(!Array.isArray(value?.skills))throw Error(t('잘못된 모델 카탈로그 응답')+' (skills: '+(value?.skills===null?'null':typeof value?.skills)+')');
    if(refresh||!append)skillPages=[];
    const existing=refresh||!append?new Set():new Set(skillPages.map(row=>row.id));
    for(const row of rows){if(!existing.has(row.id)){skillPages.push(row);existing.add(row.id);}}
    catalogData.skills=skillPages;
    for(const row of [...rows,...(Array.isArray(value.selectedSkills)?value.selectedSkills:[])])if(row?.id)skillIndex.set(row.id,row);
    skillTotal=Math.max(0,Number(value.total)||0);
    skillQuery.offset=skillPages.length;
    catalogResults.skills=value;
    const valid=new Set((Array.isArray(value.selectedSkills)?value.selectedSkills:[]).map(row=>row.id));
    const checked=new Set(ids);
    invalidSkills=new Set([...selectedSkills].filter(id=>checked.has(id)?!valid.has(id):invalidSkills.has(id)));
    renderSkillPills();renderSkills();renderSkillCache(value);$('skills-error').textContent=[...(value.errors||[]),value.refreshError].filter(Boolean).join('\n');
    return value;
  }).finally(()=>{
    if(catalogTasks.skills===request&&generation===skillRequest)catalogTasks.skills=null;
  });
  request.key=requestKey;request.generation=generation;catalogTasks.skills=request;
  return request;
}
function renderSkillCache(value){
  const node=$('skills-cache');if(!node)return;
  const state=value?.cache?.state;
  node.textContent=state==='stale'?t('캐시된 스킬을 보여줍니다. 백그라운드에서 새로 고쳐집니다.'):state==='legacy'?t('이전에 캐시된 스킬을 표시합니다. 백그라운드에서 새로 고쳐집니다.'):'';
}
function scheduleCatalog(){
  const access=currentAccess();if(state?.loadingHistory||catalogStarted||!currentId||!(access.canChangeModel||access.canSelectSkills))return;
  catalogStarted=true;const timeline=chatTimeline,generation=chatOpenGeneration,catalogGeneration=modelCatalogGeneration;
  // Run after the current timeline render, and discard work for a replaced chat/account.
  setTimeout(()=>{if(generation===chatOpenGeneration&&catalogGeneration===modelCatalogGeneration&&timeline===chatTimeline&&!timeline?.abort.signal.aborted)startCatalog();},0);
}
function startCatalog(){
  loadCatalogKind('models').catch(()=>{});
  resetSkillCatalog();loadSkills().catch(()=>{});
}
function resetModelCatalog(){
  modelCatalogGeneration++;catalogData.models=null;catalogResults.models=null;catalogTasks.models=null;
  modelRequest++;modelTarget=null;fastModeControl.reset();$('model-dialog').close();
}
function updateModelScrollHint(){
  const list=$('model-options');
  $('model-list-field').classList.toggle('has-more',list.scrollHeight-list.clientHeight-list.scrollTop>1);
}
$('model-options').addEventListener('scroll',updateModelScrollHint,{passive:true});
if(typeof ResizeObserver!=='undefined')new ResizeObserver(updateModelScrollHint).observe($('model-options'));
function renderModelChoices(){
  const list=$('model-options');list.replaceChildren();
  const models=Array.isArray(catalogData?.models)?catalogData.models:[],byId=new Map(models.map(model=>[model.id,model]));
  for(const option of $('model-select').children){
    if(!option.value)continue;
    const row=el('label','model-choice'),input=el('input'),name=el('span','model-choice-name'),check=el('span','model-choice-check','✓');
    input.type='radio';input.name='model-choice';input.value=option.value;input.checked=option.value===$('model-select').value;input.disabled=modelSaving;
    const baseId=option.value.split('/').at(-1),base=byId.get(baseId),routed=option.value.includes('/')&&!!base;
    name.textContent=option.textContent.includes('\ufffd')?(base?.name?.includes('\ufffd')?baseId:base?.name||baseId):option.textContent;
    row.title=option.value==='__custom__'?name.textContent:option.value;
    check.setAttribute('aria-hidden','true');
    input.onchange=()=>{if(!input.checked)return;$('model-select').value=input.value;modelSelectionRevision++;renderEfforts();};
    row.append(input,name);
    if(routed)row.append(el('small','model-choice-badge',t('라우팅됨')));
    row.append(check);list.append(row);
  }
  const selected=list.querySelector('input:checked')?.closest('label');
  if(selected)list.scrollTop=selected.offsetTop-(list.clientHeight-selected.clientHeight)/2;
  updateModelScrollHint();
}
function renderEffortChoices(){
  const list=$('effort-options');list.replaceChildren();
  const names={none:'없음',minimal:'최소',low:'낮음',medium:'중간',high:'높음',xhigh:'매우 높음',max:'Max',ultra:'Ultra'};
  const count=$('effort-select').children.length;
  list.style.setProperty('--effort-columns',count<=4?Math.max(1,count):count<=6?3:4);
  for(const option of $('effort-select').children){
    const row=el('label','effort-choice'),input=el('input'),name=el('span','',t(names[option.value]||option.value));
    input.type='radio';input.name='effort-choice';input.value=option.value;input.checked=option.value===$('effort-select').value;input.disabled=modelSaving||$('effort-select').disabled;
    input.onchange=()=>{if(input.checked){$('effort-select').value=input.value;modelSelectionRevision++;}};
    row.append(input,name);list.append(row);
  }
}
function renderEfforts({effort=state?.effort,keepFast=false}={}){
  const id=$('model-select').value,models=Array.isArray(catalogData?.models)?catalogData.models:[];
  const model=models.find(m=>m.id===(id==='__custom__'?$('custom-model').value.trim():id));
  for(const input of $('model-options').querySelectorAll('input'))input.checked=input.value===id;
  $('custom-model-label').hidden=id!=='__custom__';$('custom-model').required=id==='__custom__';
  const options=model?.efforts?.length?model.efforts:['none','minimal','low','medium','high','xhigh','max','ultra'];
  $('effort-select').replaceChildren(...(!model?.efforts?.length?[new Option(t('네이티브 기본값 사용'),'')]:[]),...options.map(value=>new Option(value,value)));
  $('effort-select').value=options.includes(effort)?effort:options.includes(model?.defaultEffort)?model.defaultEffort:model?.efforts?.length?options[0]:'';
  $('effort-select').disabled=!options.length;
  renderEffortChoices();
  if(!keepFast)fastModeControl.select(id);$('model-save').disabled=modelIdentityInvalid||modelScope!==modelScopeKey()||!state?.connected||!id||(id==='__custom__'&&!$('custom-model').value.trim());
}
async function openModelDialog(forceRefresh=false){
  if(modelSaving)return;
  $('model-refresh').disabled=true;
  const draft=()=>({manual:$('model-select').value==='__custom__',model:$('model-select').value==='__custom__'?$('custom-model').value:$('model-select').value,effort:$('effort-select').value}),previous=forceRefresh?draft():null,selectionRevision=modelSelectionRevision;
  const request=++modelRequest,target=chatKey();modelTarget=target;modelIdentityInvalid=modelIdentityInvalid&&modelScope===modelScopeKey();modelScope=modelScopeKey();fastModeControl.reset();
  $('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);
  const identity=state?.modelCatalogIdentity||'',scope=JSON.stringify([listIdentity,currentId,currentHost,state?.provider,identity]),cached=window.BridgeModelCatalogCache.read(modelCatalogs,[listIdentity,currentHost,'codex'],identity)||(catalogResults.models?._scope===scope?catalogResults.models:null);
  const active=()=>request===modelRequest&&target===chatKey()&&scope===JSON.stringify([listIdentity,currentId,currentHost,state?.provider,state?.modelCatalogIdentity||'']);
  const showCatalog=catalog=>{
    const retained=modelSelectionRevision!==selectionRevision?draft():previous;
    catalogData.models=catalog.models;catalogResults.models={...catalog,_scope:scope};renderFastModeToggle();
    const models=Array.isArray(catalog.models)?catalog.models:[],apiCatalog=catalog.modelSource==='api';
    const requested=awaitingCreationSettings(state)?state.creationSettings:null;
    const current=retained?retained.model:requested?.model||state?.model||catalog.currentModel||'';
    const known=!!current&&models.some(row=>row.id===current);
    $('model-select').replaceChildren(new Option(t(apiCatalog?'업스트림 모델 선택':'모델을 선택하세요'),''),
      ...models.map(row=>new Option(row.name||row.id,row.id)),new Option(t('커스텀 모델…'),'__custom__'));
    const manual=retained?.manual||(current&&current!=='__custom__'&&(!!retained||!apiCatalog||!models.length));
    $('model-select').value=known?current:manual?'__custom__':'';
    $('custom-model').value=current==='__custom__'?'':current;
    $('model-error').textContent=apiCatalog&&current&&!known&&models.length?t('현재 채팅 모델이 업스트림 목록에 없습니다. 사용 가능한 모델을 선택하고 적용하세요.'):'';
    const updated=catalog.cache?.updatedAt;$('model-updated').textContent=[catalog.modelError?t(catalog.modelError):'',Number.isFinite(updated)&&updated>0?t('업데이트 날짜:')+new Date(updated*1000).toLocaleString(BridgeI18n.locale()):''].filter(Boolean).join(' · ');
    renderModelChoices();fastModeControl.open(catalog,state,$('model-select').value);renderEfforts({effort:retained?retained.effort:requested?.effort||state?.effort});
  };
  $('model-error').textContent='';if(cached?.models?.length)showCatalog(cached);else{$('model-updated').textContent='';$('model-select').replaceChildren(new Option(t('모델 로드 중…'),''));$('model-options').textContent=t('모델 로드 중…');$('effort-options').replaceChildren();$('model-save').disabled=true;}if(!$('model-dialog').open)$('model-dialog').showModal();
  try{
    const catalog=await loadCatalogKind('models',forceRefresh);
    if(!active()){if(request===modelRequest)$('model-dialog').close();return;}
    modelIdentityInvalid=false;showCatalog(catalog);
  }catch(e){if(active()){
    if(e.code==='model_identity_changed'||modelIdentityInvalid){modelIdentityInvalid=true;$('model-error').textContent=t(e.message);$('model-updated').textContent='';$('model-save').disabled=true;return;}
    if(!cached?.models?.length)showCatalog({models:[],fastMode:{allowed:false}});
    $('model-updated').textContent=t(e.message)+' · '+t('모델을 수동으로 채울 수 있습니다.');
  }}
  finally{if(request===modelRequest)$('model-refresh').disabled=false;}
}
$('model-button').onclick=()=>openModelDialog();
$('model-refresh').onclick=()=>openModelDialog(true);
$('model-select').onchange=()=>{modelSelectionRevision++;renderEfforts();};
$('custom-model').oninput=()=>{modelSelectionRevision++;renderEfforts();};
$('effort-select').onchange=()=>{modelSelectionRevision++;};
$('model-form').onsubmit=async event=>{
  event.preventDefault();if(modelSaving||modelIdentityInvalid||modelScope!==modelScopeKey()||modelTarget!==chatKey()||$('model-save').disabled)return;
  const request=modelRequest,target=currentId,host=currentHost;
  const model=$('model-select').value==='__custom__'?$('custom-model').value.trim():$('model-select').value;
  const body={model,...($('effort-select').value?{effort:$('effort-select').value}:{}),...fastModeControl.payload()};
  modelSaving=true;renderFastModeToggle();fastModeControl.setBusy(true);$('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=true);$('model-save').disabled=true;$('model-error').textContent='';
  try{
    const result=await api(sessionUrl(target,'settings',host),body);
    if(request===modelRequest&&chatKey(target,host)===chatKey()){$('model-dialog').close();toast(result.confirmed?t('데스크톱 모델 설정이 동기화되었습니다.'):t('데스크톱이 설정을 수락했습니다. 동기화를 기다리는 중'));}
  }catch(e){if(request===modelRequest&&chatKey(target,host)===chatKey())$('model-error').textContent=t(e.message);}
  finally{modelSaving=false;renderFastModeToggle();if(request===modelRequest){$('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);fastModeControl.setBusy(false);renderEfforts({effort:body.effort,keepFast:true});}}
};
function renderSkillPills(){
  $('skill-count').textContent=selectedSkills.size?'('+selectedSkills.size+')':'';
  $('skill-pills').replaceChildren();
  for(const id of selectedSkills){
    const skill=skillIndex.get(id),invalid=invalidSkills.has(id);
    const pill=el('button','skill-pill'+(invalid?' invalid':''),(skill?.displayName||(invalid?t('사용할 수 없는 스킬'):t('선택한 스킬')))+' ×');
    pill.type='button';pill.onclick=()=>{codexDraftTouched=true;selectedSkills.delete(id);invalidSkills.delete(id);renderSkillPills();renderSkills();};
    $('skill-pills').append(pill);
  }
  if(codexDraftScope||codexDraftTouched&&draftGateway)saveDraft();else if(currentId&&!draftGateway)sessionStorage.setItem('skills:'+chatKey(),JSON.stringify([...selectedSkills]));
}
function renderSkills(){
  const list=$('skill-list'),rows=Array.isArray(catalogData?.skills)?catalogData.skills:[];
  const search=$('skill-search').value.toLocaleLowerCase();
  const visible=search===skillQuery.q.toLocaleLowerCase()?rows:rows.filter(skill=>[skill.name,skill.displayName,skill.description].join(' ').toLocaleLowerCase().includes(search));
  list.replaceChildren();
  for(const skill of visible){
    const label=el('label','skill-option');
    const input=el('input');input.type='checkbox';input.value=skill.id;input.checked=selectedSkills.has(skill.id);
    input.onchange=()=>{
      if(input.checked&&selectedSkills.size>=8){input.checked=false;toast('최대 8개 스킬 선택');return;}
      codexDraftTouched=true;if(input.checked){selectedSkills.add(skill.id);invalidSkills.delete(skill.id);}else selectedSkills.delete(skill.id);
      renderSkillPills();
    };
    const content=el('span');content.append(el('strong','',skill.displayName),el('small','',skill.description));
    label.append(input,content);list.append(label);
  }
  if(!visible.length)list.append(el('p','muted',t('일치하는 기술이 없습니다.')));
}
async function openSkills(refresh=false){
  if(!currentId)return;$('skills-error').textContent='';if(!$('skills-dialog').open)$('skills-dialog').showModal();
  if(catalogData.skills?.length)renderSkills();
  else $('skill-list').textContent=t('설치된 스킬 로드 중…');
  try{await loadSkills({refresh});renderSkills();renderSkillPills();}
  catch(e){
    if(catalogData.skills?.length)renderSkills();
    else $('skill-list').textContent=t('스킬을 로드할 수 없습니다. 다시 시도하려면 새로 고침을 클릭하세요.');
    $('skills-error').textContent=t(e.message);renderSkillPills();
  }
}
function skillScroll(){
  const list=$('skill-list');
  if(skillTotal>skillPages.length&&list.scrollHeight-list.clientHeight-list.scrollTop<240&&!catalogTasks.skills)loadSkills({append:true}).catch(e=>toast(e.message));
}
$('skills-button').onclick=()=>openSkills();$('skills-refresh').onclick=()=>openSkills(true);
$('skill-list').onscroll=skillScroll;
$('skill-search').oninput=()=>{clearTimeout(skillSearchTimer);skillSearchTimer=setTimeout(()=>{skillRequest++;skillQuery.q=$('skill-search').value;skillQuery.offset=0;skillPages=[];catalogData.skills=[];catalogResults.skills=null;catalogTasks.skills=null;$('skill-list').scrollTop=0;renderSkills();loadSkills().catch(e=>{$('skills-error').textContent=t(e.message);});},200);};
window.addEventListener('pagehide',saveDraft);
function startFromLink(token){return start(token).catch(error=>{if(error.startupCancelled)return;if(window.BridgeBootstrap?.failed())return;showLogin();$('login-error').textContent=t('게이트웨이에 연결할 수 없습니다. 연결을 확인하고 다시 로드하세요.');});}
startFromLink(initialPairingToken);initialPairingToken=null;
window.BridgeOpenChatLink=hash=>{
  if($('app').hidden||!csrf||typeof hash!=='string'||!clientNavigation.chatTarget(hash))return false;
  clientNavigation.openChatLink(hash,openChat).catch(error=>toast(error.message));return true;
};
window.addEventListener('hashchange',()=>{const token=takePairingToken();if(token!==null)startFromLink(token);else if(!$('app').hidden&&(!browserNavigation.enabled()||history.state?.bridgeNavigation!==1))clientNavigation.openChatLink(location.hash,openChat).catch(error=>toast(error.message));});
function setLanguageBusy(){$('phone-language').disabled=!!(approvalBusy||creatingChat);$('appearance-language').disabled=$('phone-language').disabled;}
$('phone-language').value=BridgeI18n.language();
$('phone-language').onchange=()=>{
  if(approvalBusy||creatingChat)return;
  const replies=[...$('approvals').querySelectorAll('input,textarea,select')].map(node=>({value:node.value,checked:node.checked}));
  BridgeI18n.setLanguage($('phone-language').value);BridgeI18n.apply();if(typeof accountsPanel!=="undefined")accountsPanel?.render();renderSourceFilter();renderList();
  $('new-chat-help').textContent=t($('new-chat-type').value==='cli'?'여기에서 채팅을 생성하려면 기존 CLI 프로젝트 폴더를 선택하세요.':'기존 프로젝트를 선택하거나 프로젝트 없음을 선택하여 독립적인 채팅을 만듭니다. 데스크톱 앱에서 이 채팅이 열립니다.');
  $('new-chat-submit').textContent=t($('new-chat-type').value==='desktop'?'생성 및 열기':'채팅 만들기');
  for(const id of ['login-error','send-error','model-error','skills-error','new-chat-error','notify-error','pushplus-error','toast'])$(id).textContent=t($(id).textContent);
  for(const option of $('new-chat-project').options){const project=newChatProjects.find(p=>p.key===option.value);option.textContent=project?project.name:t(option.value==='__directory__'?'다른 폴더를 선택하세요…':'프로젝트 없음');}
  for(const option of $('new-chat-entry').options){const environment=newChatEnvironments.find(row=>row.key===option.value);if(environment?.host==='local')option.textContent=(environment.name||environment.hostLabel||'이 컴퓨터').replace('이 컴퓨터',t('이 컴퓨터'));}
  if($('model-select').querySelector('[value=__custom__]'))$('model-select').querySelector('[value=__custom__]').textContent=t('커스텀 모델…');
  if($('model-dialog').open){renderModelChoices();renderEffortChoices();}
  if(state){approvalStamp='';renderState(state);[...$('approvals').querySelectorAll('input,textarea,select')].forEach((node,i)=>{if(replies[i]){node.value=replies[i].value;node.checked=replies[i].checked;if(node.tagName==='SELECT')node.dispatchEvent(new Event('change'));}});}
  if(chatTimeline)chatTimeline.relabel();messageActions.relabel();
  window.BridgePresentation?.relabel();workbench.relabel();attachments.render();renderActivity();
  renderSkillPills();if(catalogData)renderSkills();
};
BridgeI18n.apply();

let notificationChannelBusy=false,selectedNotificationChannel='',notificationListRequest=0,notificationCommonLoaded=false;
const defaultWebhookBodyTemplate=JSON.stringify({event:'{{event}}',title:'{{title}}',body:'{{body}}',session_name:'{{session_name}}',url:'{{url}}'},null,2);
let savedWebhookFields=null,webhookTemplates={},webhookResolvedProvider='generic',revealedWebhookUrl='',webhookRevealRequest=0;
let webhookConfig={},selectedWebhookId='legacy',creatingWebhook=false;
function webhookRows(){return webhookConfig.webhookEndpoints||[{...webhookConfig,webhookId:'legacy',webhookName:t('기본 웹훅')}];}
function currentWebhook(){return webhookRows().find(row=>row.webhookId===selectedWebhookId)||{};}
function renderWebhookList(){
  $('webhook-endpoint-list').replaceChildren();
  const rows=[...webhookRows()];if(!rows.some(row=>row.webhookId==='legacy'))rows.unshift({webhookId:'legacy',webhookName:t('기본 웹훅')});
  $('webhook-endpoints').hidden=!(webhookConfig.webhookEndpoints||rows).length;
  for(const row of rows){const button=document.createElement('button');button.type='button';button.className='plain';button.dataset.webhookId=row.webhookId;button.setAttribute('aria-current',String(!creatingWebhook&&selectedWebhookId===row.webhookId));button.textContent=[row.webhookName||t('기본 웹훅'),row.webhookUrlDisplay||'',t(row.webhookEnabled?'사용':'사용 안 함')].filter(Boolean).join(' · ');button.onclick=()=>selectWebhook(row.webhookId);$('webhook-endpoint-list').append(button);}
  $('webhook-delete').hidden=creatingWebhook||!webhookRows().some(row=>row.webhookId===selectedWebhookId);
}
function selectWebhook(id){if(notificationChannelBusy)return;if(webhookDirty()){$('webhook-error').textContent=t('먼저 현재 변경 사항을 저장하거나 취소하세요.');return;}selectedWebhookId=id;creatingWebhook=false;renderWebhookChannel(currentWebhook());renderWebhookList();$('webhook-error').textContent='';}
function webhookUrlDraft(){return $('webhook-url').value===revealedWebhookUrl?'':$('webhook-url').value.trim();}
function selectedWebhookTemplate(){return webhookTemplates[$('webhook-provider').value==='auto'?webhookResolvedProvider:$('webhook-provider').value]||webhookTemplates.generic||defaultWebhookBodyTemplate;}
function switchWebhookTemplate(){const current=$('webhook-body-template').value;if(!current.trim()||(current===defaultWebhookBodyTemplate||Object.values(webhookTemplates).includes(current)))$('webhook-body-template').value=selectedWebhookTemplate();}
function hideWebhookUrl(){webhookRevealRequest++;if(revealedWebhookUrl&&$('webhook-url').value===revealedWebhookUrl)$('webhook-url').value='';revealedWebhookUrl='';$('webhook-url').type='password';$('webhook-url-eye').textContent=t('주소 표시');$('webhook-url-eye').setAttribute('aria-label',t('주소 표시'));}
async function toggleWebhookUrl(){
  if($('webhook-url').type==='text'){hideWebhookUrl();return;}
  if($('webhook-url').value||!savedWebhookHasUrl){$('webhook-url').type='text';$('webhook-url-eye').textContent=t('주소 숨기기');$('webhook-url-eye').setAttribute('aria-label',t('주소 숨기기'));return;}
  const request=++webhookRevealRequest,before=$('webhook-url').value,host=currentHost,chat=currentId,token=csrf;
  const id=selectedWebhookId;try{const result=await api('/api/notifications/channels/webhook/url',{webhookId:id});if(request!==webhookRevealRequest||selectedWebhookId!==id||!$('webhook-dialog').open||$('webhook-url').value!==before||currentHost!==host||currentId!==chat||csrf!==token)return;revealedWebhookUrl=result.webhookUrl||'';$('webhook-url').value=revealedWebhookUrl;$('webhook-url').type='text';$('webhook-url-eye').textContent=t('주소 숨기기');$('webhook-url-eye').setAttribute('aria-label',t('주소 숨기기'));}catch(error){$('webhook-error').textContent=t(error.message);}
}
let savedWebhookHasUrl=false;
function webhookFields(){return {webhookName:$('webhook-name').value.trim(),webhookEnabled:$('webhook-enabled').checked,webhookProvider:$('webhook-provider').value,webhookSignEnabled:$('webhook-sign-enabled').checked,webhookBodyTemplate:$('webhook-body-template').value,clearWebhookUrl:$('webhook-clear-url').checked,clearWebhookHeaders:$('webhook-clear-headers').checked,clearWebhookSignSecret:$('webhook-clear-sign-secret').checked};}
function webhookDirty(){return creatingWebhook||!savedWebhookFields||JSON.stringify(webhookFields())!==JSON.stringify(savedWebhookFields)||!!(webhookUrlDraft()||$('webhook-headers').value||$('webhook-sign-secret').value);}
function webhookProviderHint(config){const provider=$('webhook-provider').value;return t(({auto:config.webhookResolvedProvider==='feishu'?'Feishu 주소가 감지되었습니다. 기본 템플릿은 자동으로 Feishu 형식을 사용합니다.':'해당 주소에서 서비스를 감지하고 기본 템플릿을 사용합니다.',generic:'편집 가능한 JSON 본문이 있는 사용자 정의 HTTPS 웹훅입니다.',feishu:'Feishu 봇 엔드포인트: open.feishu.cn/open-apis/bot/v2/hook/… 서명은 선택 사항입니다.',dingtalk:'DingTalk 봇 엔드포인트: oapi.dingtalk.com/robot/send?access_token=… 서명은 선택 사항입니다.',discord:'Discord 엔드포인트: discord.com/api/webhooks/… 콘텐츠 제한은 2,000자입니다.',telegram:'Telegram 엔드포인트: api.telegram.org/bot…/sendMessage. JSON에 chat_id를 입력하세요. 텍스트 제한은 4,096자입니다.'})[provider]||'');}
function renderWebhookChannel(config){
  hideWebhookUrl();webhookTemplates=config.webhookTemplates||webhookTemplates;webhookResolvedProvider=config.webhookResolvedProvider||'generic';savedWebhookHasUrl=!!config.hasWebhookUrl;
  $('webhook-name').value=config.webhookName|| (selectedWebhookId==='legacy'?t('기본 웹훅'):'');$('webhook-name').disabled=selectedWebhookId==='legacy'&&!creatingWebhook;
  $('webhook-enabled').checked=!!config.webhookEnabled;
  $('webhook-provider').value=config.webhookProvider||'auto';$('webhook-sign-enabled').checked=!!config.webhookSignEnabled;
  $('webhook-url').value='';$('webhook-headers').value='';$('webhook-sign-secret').value='';
  $('webhook-clear-url').checked=false;$('webhook-clear-headers').checked=false;$('webhook-clear-sign-secret').checked=false;
  $('webhook-body-template').value=config.webhookBodyTemplate||defaultWebhookBodyTemplate;
  $('webhook-url-saved').textContent=config.hasWebhookUrl?t('저장된 주소: ')+(config.webhookUrlDisplay||''):t('저장된 엔드포인트가 없습니다.');
  $('webhook-url').placeholder=t(config.hasWebhookUrl?'저장되어 있습니다. 유지하려면 비워 두세요.':'HTTPS 주소를 입력하세요');
  $('webhook-headers-saved').textContent=t(config.hasWebhookHeaders?'헤더가 저장되었습니다. 보관하려면 비워 두세요.':'저장된 헤더가 없습니다.');
  $('webhook-sign-saved').textContent=t(config.hasWebhookSignSecret?'서명 비밀이 저장되었습니다. 보관하려면 비워두세요.':'서명 비밀번호가 저장되지 않았습니다.');
  $('webhook-provider-hint').textContent=webhookProviderHint(config);
  savedWebhookFields=webhookFields();
}
function webhookHeaders(){
  const raw=$('webhook-headers').value.trim();if(!raw)return {};
  let value;try{value=JSON.parse(raw);}catch{throw Error(t('헤더는 유효한 JSON 개체여야 합니다.'));}
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.entries(value).some(([key,item])=>!key||typeof item!=='string'))throw Error(t('헤더는 문자열 키와 값이 있는 JSON 개체여야 합니다.'));
  return value;
}
async function webhookAction(test){
  if(notificationChannelBusy)return;
  if(test&&webhookDirty()){$('webhook-error').textContent=t('테스트 알림을 보내기 전에 알림 설정을 저장하세요.');return;}
  if(!test){try{webhookHeaders();}catch(error){$('webhook-error').textContent=error.message;return;}}
  notificationChannelBusy=true;for(const id of ['webhook-save','webhook-test','webhook-delete'])$(id).disabled=true;$('webhook-error').textContent='';
  const identity=[currentHost,currentId,csrf,selectedWebhookId,creatingWebhook];
  const stillHere=()=>$('webhook-dialog').open&&currentHost===identity[0]&&currentId===identity[1]&&csrf===identity[2]&&selectedWebhookId===identity[3]&&creatingWebhook===identity[4];
  try{
    const url='/api/notifications/channels/webhook';
    if(test){const result=await api(url+'/test',{webhookId:selectedWebhookId});toast(result.message||'웹훅이 테스트 요청을 수락했습니다. 수신 서비스를 확인하세요.');}
    else{
      const submittedFields=webhookFields(),submittedUrl=$('webhook-url').value,submittedHeaders=$('webhook-headers').value,submittedSecret=$('webhook-sign-secret').value;
      const body={action:'upsert',...(creatingWebhook?{}:{webhookId:selectedWebhookId}),...submittedFields,webhookUrl:webhookUrlDraft(),webhookHeaders:webhookHeaders(),webhookSignSecret:submittedSecret};
      const saved=await api(url+'/endpoints',body);
      if(!stillHere())return;
      const unchanged=JSON.stringify(webhookFields())===JSON.stringify(submittedFields)&&$('webhook-url').value===submittedUrl&&$('webhook-headers').value===submittedHeaders&&$('webhook-sign-secret').value===submittedSecret;
      webhookConfig=saved;selectedWebhookId=saved.selectedWebhookId||selectedWebhookId;creatingWebhook=false;
      savedWebhookFields=submittedFields;
      if(unchanged)renderWebhookChannel(currentWebhook());renderWebhookList();
      toast('웹훅 설정이 저장되었습니다.');if(currentId)await loadNotificationState(currentId,currentHost);
    }
  }catch(error){if(stillHere())$('webhook-error').textContent=t(error.message);}
  finally{notificationChannelBusy=false;for(const id of ['webhook-save','webhook-test','webhook-delete'])$(id).disabled=false;}
}
$('webhook-add').onclick=()=>{if(notificationChannelBusy)return;if(webhookDirty()){$('webhook-error').textContent=t('먼저 현재 변경 사항을 저장하거나 취소하세요.');return;}creatingWebhook=true;selectedWebhookId='';renderWebhookChannel({webhookProvider:'auto',webhookBodyTemplate:webhookTemplates.generic,webhookTemplates});renderWebhookList();$('webhook-name').focus();};
$('webhook-cancel').onclick=()=>{if(notificationChannelBusy)return;creatingWebhook=false;selectedWebhookId=webhookRows().some(row=>row.webhookId===selectedWebhookId)?selectedWebhookId:(webhookRows()[0]?.webhookId||'legacy');renderWebhookChannel(currentWebhook());renderWebhookList();$('webhook-error').textContent='';};
$('webhook-delete').onclick=async()=>{if(notificationChannelBusy||!confirm(t('이 웹훅 구성을 삭제하시겠습니까?')))return;notificationChannelBusy=true;const id=selectedWebhookId,host=currentHost,chat=currentId,token=csrf;try{const saved=await api('/api/notifications/channels/webhook/endpoints',{action:'delete',webhookId:id});if(!$('webhook-dialog').open||selectedWebhookId!==id||currentHost!==host||currentId!==chat||csrf!==token)return;webhookConfig=saved;selectedWebhookId=saved.selectedWebhookId||'legacy';creatingWebhook=false;renderWebhookChannel(currentWebhook());renderWebhookList();toast('웹훅 구성이 삭제되었습니다.');}catch(error){if($('webhook-dialog').open&&selectedWebhookId===id)$('webhook-error').textContent=t(error.message);}finally{notificationChannelBusy=false;}};
$('webhook-form').onsubmit=event=>{event.preventDefault();return webhookAction(false);};
$('webhook-test').onclick=()=>webhookAction(true);
$('webhook-provider').onchange=()=>{$('webhook-provider-hint').textContent=webhookProviderHint({webhookResolvedProvider});switchWebhookTemplate();};
$('webhook-use-template').onclick=()=>{$('webhook-body-template').value=selectedWebhookTemplate();};
$('webhook-url-eye').onclick=toggleWebhookUrl;
$('webhook-url').addEventListener('input',()=>{if(revealedWebhookUrl&&$('webhook-url').value!==revealedWebhookUrl)revealedWebhookUrl='';webhookRevealRequest++;});
$('webhook-dialog').addEventListener('close',()=>{hideWebhookUrl();savedWebhookFields=null;});
$('webhook-back').onclick=()=>{$('webhook-dialog').close();$('pushplus-settings').onclick();};
const notificationChannelDetails={
  bark:{name:'Bark',enabled:'barkEnabled',server:'barkServer',secret:'barkKey',hasSecret:'hasBarkKey',clear:'clearBarkKey',secretLabel:'장치 키',help:'iPhone의 Bark에서 장치 키를 받고 서버 URL에 들어갑니다.'},
  ntfy:{name:'ntfy',enabled:'enabled',server:'server',secret:'token',hasSecret:'hasToken',clear:'clearToken',secretLabel:'Token',help:'Android의 ntfy에서 동일한 서버 및 주제를 구독합니다. 공개 주제는 토큰을 비워 둘 수 있습니다.'},
  pushplus:{name:'PushPlus',enabled:'pushplusEnabled',secret:'pushplusToken',hasSecret:'hasPushplusToken',clear:'clearPushplusToken',secretLabel:'Token',help:'WeChat을 통해 PushPlus 토큰을 받으세요. 테스트 알림을 보내기 전에 저장하세요.'}
};
function renderNotificationChannel(config){
  const channel=notificationChannelDetails[selectedNotificationChannel];
  $('pushplus-heading').textContent=channel.name;
  $('notification-channel-help').textContent=t(channel.help);
  $('pushplus-help').hidden=selectedNotificationChannel!=='pushplus';
  $('notification-channel-enable-label').textContent=t('사용 '+channel.name);
  $('pushplus-enabled').checked=!!config[channel.enabled];
  $('notification-server-row').hidden=!channel.server;
  $('notification-topic-row').hidden=selectedNotificationChannel!=='ntfy';
  if(channel.server){
    $('notification-server-label').textContent=t(channel.name+' 서비스 주소');
    $('notification-server').value=config[channel.server]||'';
  }
  if(selectedNotificationChannel==='ntfy')$('notification-topic').value=config.topic||'';
  $('notification-secret-label').textContent=channel.secretLabel;
  $('notification-clear-label').textContent=t('저장된 내용 지우기 '+channel.secretLabel);
  $('pushplus-token').value='';$('pushplus-clear').checked=false;
  $('pushplus-token').placeholder=t(config[channel.hasSecret]?'저장되어 있습니다. 유지하려면 비워 두세요.':'채우다 '+channel.name+' '+channel.secretLabel);
}
function renderNotificationCommon(config){
  for(const id of ['security-enabled','address-enabled','include-title'])$('notification-'+id).checked=!!config[{'security-enabled':'securityEnabled','address-enabled':'addressEnabled','include-title':'includeTitle'}[id]];
  $('notification-address-name').value=config.addressName||'';
  $('notification-click-base').value=config.clickBase||'';
}
function notificationCommonControls(enabled){
  for(const id of ['security-enabled','address-enabled','address-name','include-title','click-base','common-save'])$('notification-'+id).disabled=!enabled;
}
async function loadNotificationCommon(request){
  notificationCommonLoaded=false;notificationCommonControls(false);
  $('notification-common-retry').hidden=true;$('notification-common-error').textContent='';
  try{
    const config=await api('/api/notifications/channels/common');
    if(request!==notificationListRequest||!$('notification-channels-dialog').open)return;
    renderNotificationCommon(config);notificationCommonLoaded=true;notificationCommonControls(true);
  }catch(error){
    if(request!==notificationListRequest||!$('notification-channels-dialog').open)return;
    $('notification-common-error').textContent=t(error.message);$('notification-common-retry').hidden=false;
  }
}
async function loadNotificationChannelStatuses(request){
  const names=[...Object.keys(notificationChannelDetails),'webhook'];
  for(const name of names)$('notification-status-'+name).textContent=t('로드 중');
  const responses=await Promise.allSettled(names.map(name=>api('/api/notifications/channels/'+name)));
  if(request!==notificationListRequest||!$('notification-channels-dialog').open)return;
  for(const [index,name] of names.entries()){
    const result=responses[index],channel=notificationChannelDetails[name];
    const rows=name==='webhook'?(result.value?.webhookEndpoints||[result.value]):[];
    const configured=result.status==='fulfilled'&&(name==='webhook'?rows.some(row=>row?.hasWebhookUrl):name==='ntfy'?!!result.value.topic:!!result.value[channel.hasSecret]);
    const enabled=name==='webhook'?rows.some(row=>row?.webhookEnabled):result.value?.[channel.enabled];
    const status=result.status==='rejected'?'로드할 수 없습니다.':configured?(enabled?'켜짐':'꺼짐'):'구성되지 않음';
    $('notification-status-'+name).textContent=t(status);
  }
}
$('pushplus-settings').onclick=async()=>{
  if(notificationChannelBusy)return;
  const request=++notificationListRequest;
  $('notification-channels-dialog').showModal();
  await Promise.all([loadNotificationCommon(request),loadNotificationChannelStatuses(request)]);
};
$('notification-channels-dialog').addEventListener('close',()=>{notificationListRequest++;notificationCommonLoaded=false;notificationCommonControls(false);});
$('notification-common-retry').onclick=()=>loadNotificationCommon(notificationListRequest);
for(const button of document.querySelectorAll('[data-notification-channel]'))button.onclick=async()=>{
  if(notificationChannelBusy)return;
  const channel=button.dataset.notificationChannel;
  const request=notificationListRequest;
  notificationChannelBusy=true;button.disabled=true;
  try{
    const config=await api('/api/notifications/channels/'+channel);
    if(request!==notificationListRequest||!$('notification-channels-dialog').open)return;
    if(channel==='webhook'){
      webhookConfig=config;webhookTemplates=config.webhookTemplates||webhookTemplates;selectedWebhookId=config.webhookEndpoints?.[0]?.webhookId||'legacy';creatingWebhook=false;renderWebhookChannel(currentWebhook());renderWebhookList();$('webhook-error').textContent='';$('notification-channels-dialog').close();$('webhook-dialog').showModal();return;
    }
    selectedNotificationChannel=channel;
    renderNotificationChannel(config);
    $('pushplus-error').textContent='';
    $('notification-channels-dialog').close();
    $('pushplus-dialog').showModal();
  }catch(error){if(request===notificationListRequest&&$('notification-channels-dialog').open)$('notification-common-error').textContent=t(error.message);}
  finally{notificationChannelBusy=false;button.disabled=false;}
};
$('notification-channel-back').onclick=()=>{$('pushplus-dialog').close();$('pushplus-settings').onclick();};
$('notification-common-save').onclick=async()=>{
  if(notificationChannelBusy||!notificationCommonLoaded||!$('notification-channels-dialog').open)return;
  notificationChannelBusy=true;$('notification-common-save').disabled=true;$('notification-common-error').textContent='';
  const request=notificationListRequest;
  try{
    const config=await api('/api/notifications/channels/common',{
      securityEnabled:$('notification-security-enabled').checked,
      addressEnabled:$('notification-address-enabled').checked,
      addressName:$('notification-address-name').value.trim(),
      includeTitle:$('notification-include-title').checked,
      clickBase:$('notification-click-base').value.trim()
    });
    if(request===notificationListRequest&&$('notification-channels-dialog').open){renderNotificationCommon(config);toast('일반 알림 설정이 저장되었습니다.');}
  }catch(error){if(request===notificationListRequest&&$('notification-channels-dialog').open)$('notification-common-error').textContent=t(error.message);}
  finally{notificationChannelBusy=false;if(request===notificationListRequest&&notificationCommonLoaded)notificationCommonControls(true);}
};
async function notificationChannelAction(test){
  if(notificationChannelBusy||!selectedNotificationChannel)return;
  notificationChannelBusy=true;
  const ids=['pushplus-save','pushplus-test','pushplus-enabled','notification-server','notification-topic','pushplus-token','pushplus-clear'];
  for(const id of ids)$(id).disabled=true;
  $('pushplus-error').textContent='';
  const channel=notificationChannelDetails[selectedNotificationChannel];
  try{
    const url='/api/notifications/channels/'+selectedNotificationChannel;
    if(test){
      await api(url+'/test',{});
      toast(channel.name+' 테스트 알림이 승인되었습니다. 휴대폰에서 수신을 확인해 주세요.');
    }else{
      const body={[channel.enabled]:$('pushplus-enabled').checked,[channel.secret]:$('pushplus-token').value.trim(),[channel.clear]:$('pushplus-clear').checked};
      if(channel.server)body[channel.server]=$('notification-server').value.trim();
      if(selectedNotificationChannel==='ntfy')body.topic=$('notification-topic').value.trim();
      renderNotificationChannel(await api(url,body));
      toast(channel.name+' 구성이 저장되었습니다.');
      if(currentId)await loadNotificationState(currentId,currentHost);
    }
  }catch(error){$('pushplus-error').textContent=t(error.message);}
  finally{notificationChannelBusy=false;for(const id of ids)$(id).disabled=false;}
}
$('pushplus-form').onsubmit=event=>{event.preventDefault();return notificationChannelAction(false);};
$('pushplus-test').onclick=()=>notificationChannelAction(true);

const codexCliRoot=el('div');
const codexCliDetails=el('details'),codexCliSummary=el('summary','',t('새로운 Codex API 액세스'));codexCliSummary.dataset.i18n='새로운 Codex API 액세스';codexCliDetails.append(codexCliSummary,codexCliRoot);$('accounts-dialog').append(codexCliDetails);
const codexCliAccessPanel=typeof CliAccessPanel==='undefined'?null:new CliAccessPanel({root:codexCliRoot,provider:'codex',formOnly:true,onChanged:()=>accountsPanel?.refresh(),read:()=>api('/api/cli-access'),request:value=>api('/api/cli-access',value)});
let codexWslRoot=null,codexWslAccounts=null,accountEntryControls=null,accountEntrySelect=null;
async function loadWslAccounts(){
  if(clientNavigation.wslSupported!==true)return false;
  await window.BridgeFeatures.load('wsl');
  return clientNavigation.wslSupported===true;
}
async function refreshSelectedAccounts(){
  if(codexAccountEntry==='desktop'||codexAccountEntry.startsWith('codex:')){codexWslAccounts?.clear();accountsPanel?.refresh();if(codexAccountEntry==='desktop')codexCliAccessPanel?.refresh();return;}
  const entry=codexAccountEntry;
  try{
    if(!await loadWslAccounts()||!$('accounts-dialog').open||codexAccountEntry!==entry)return;
    if(!codexWslAccounts)codexWslAccounts=new WslAccountsPanel({root:codexWslRoot,provider:'codex',read:entry=>api('/api/wsl-accounts?provider=codex&entry='+encodeURIComponent(entry)),request:value=>api('/api/wsl-accounts',value)});
    codexWslAccounts.select(entry);
  }catch(error){if($('accounts-dialog').open&&codexAccountEntry===entry)toast(error.message);}
}
$('accounts-dialog').addEventListener('close',()=>{codexCliAccessPanel?.clear();codexWslAccounts?.clear();});
function renderAccountEntries(){
  const independent=codexAccountEntry.startsWith('codex:'),entries=codexEntries().filter(row=>row.enabled&&(independent?row.id===codexAccountEntry:clientNavigation.wslSupported===true&&row.kind==='wsl-cli'));
  if(entries.length&&!accountEntryControls){
    accountEntryControls=el('div','accounts-runtime-controls');const label=el('label','',t('런타임 환경'));accountEntrySelect=el('select');accountEntrySelect.setAttribute('aria-label',t('런타임 환경'));label.append(accountEntrySelect);accountEntryControls.append(label);$('accounts-heading').closest('.picker-head').after(accountEntryControls);
    codexWslRoot=el('div');$('accounts-dialog').append(codexWslRoot);
    accountEntrySelect.onchange=()=>{codexAccountEntry=accountEntrySelect.value;accountsPanel?.clear();renderAccountEntries();refreshSelectedAccounts();};
  }
  if(codexAccountEntry!=='desktop'&&!entries.some(row=>row.id===codexAccountEntry))codexAccountEntry='desktop';
  if(accountEntrySelect){accountEntrySelect.replaceChildren(new Option(t('이 컴퓨터'),'desktop'),...entries.map(row=>new Option(row.name||row.label,row.id)));accountEntrySelect.value=codexAccountEntry;accountEntryControls.hidden=independent||!entries.length;}
  codexCliDetails.hidden=codexAccountEntry!=='desktop';$('accounts-content').hidden=codexAccountEntry.startsWith('wsl:');if(codexWslRoot)codexWslRoot.hidden=!codexAccountEntry.startsWith('wsl:');if(typeof accountsPanel!=='undefined'&&accountsPanel)accountsPanel.refreshButton.hidden=codexAccountEntry.startsWith('wsl:');
  if(codexCliDetails.hidden)codexCliAccessPanel?.clear();
}

const accountsPanel=window.BridgeSharedRelay||typeof AccountsPanel==='undefined'?null:new AccountsPanel({root:$('accounts-content'),toolbar:$('accounts-heading'),read:force=>api(accountUrl('/api/accounts'+(accountsPanel?.visible()&&accountsPanel?.value?.resetDynamicEnabled?'?resetForecast='+(force?'refresh':'1'):''))),request:({action,...value})=>action==='ignoreSubmission'?ignoreSubmission(value):api(accountUrl(['initializeDesktopRuntime','deferDesktopRuntime','cancelDeferredDesktopRuntime'].includes(action)?'/api/accounts/desktop-runtime':action==='retrySsh'?'/api/accounts/ssh-retry':action==='account'?'/api/accounts/account':action==='details'?'/api/accounts/details':action==='reminders'?'/api/accounts/reminders':action==='checkDesktopUpdate'||action==='requestDesktopUpdate'?'/api/accounts/desktop-update':'/api/accounts/switch'),['checkDesktopUpdate','requestDesktopUpdate','deferDesktopRuntime','cancelDeferredDesktopRuntime'].includes(action)?{action,...value}:value),onChanged:value=>{if(codexActiveAccountId!==undefined&&codexActiveAccountId!==value.activeId){codexAccountRevision++;browserNavigation.invalidate();if(typeof ChatTimeline!=='undefined')ChatTimeline.clearCache?.();clearCodexProvisionalDrafts();clearQuoteComposer();codexDraftScope=null;codexDraftTouched=false;}resetModelCatalog();},onUpdate:value=>{codexActiveAccountId=value.activeId;const label='계정';$('accounts-button').setAttribute('data-i18n',label);$('accounts-button').textContent=t(label);}});
accountsPanel?.attachApiAccess(codexCliAccessPanel,codexCliDetails);
function openCurrentAccounts(){
  const activeProvider=clientNavigation.provider,provider=ClientIdentity.family(activeProvider),entry=ClientIdentity.entry(activeProvider)?activeProvider:provider;
  if(!provider)return false;
  if(isCodexClient(provider)){
    if(!accountsPanel)return false;
    refreshEntryAccounts();renderAccountEntries();$('accounts-dialog').showModal();refreshSelectedAccounts();return true;
  }
  const name=clientNavigation.clients.find(row=>row.id===activeProvider)?.name||provider;
  const dialog=desktopSessions.dialog('계정 및 연결'),content=el('div','provider-account');
  const head=dialog.querySelector('.picker-head'),title=head.querySelector('h2'),toolbar=el('div','accounts-dialog-heading');
  title.classList.add('dialog-content-start');title.tabIndex=-1;title.autofocus=true;title.replaceWith(toolbar);toolbar.append(title);
  dialog.append(el('p','account-muted',name),content);
  const panel=new DesktopClientAccountsPanel({root:content,provider,toolbar,
    read:()=>api(ClientIdentity.path(entry,'accounts')),
    request:value=>api(ClientIdentity.path(entry,'accounts'),value),
    readModels:async(refresh=false)=>{const namespace=[desktopSessions.listCacheIdentity,desktopSessions.listCacheHost||'local',entry],value=await api(ClientIdentity.path(entry,'account',null,refresh?{refresh:'true'}:{}));return {...value,...window.BridgeModelCatalogCache.write(desktopSessions.modelCatalogs,namespace,value)};},
    onChanged:(value,previous)=>desktopSessions.accountChanged(entry,previous,value)
  });
  const unbindConnection=clientNavigation.bindAccountManagement(panel,entry);
  let claudeWslAccounts=null,selectClaudeAccounts=null;
  if(provider==='claude'&&!ClientIdentity.entry(entry)&&typeof CliAccessPanel!=='undefined'){
    const details=el('details','account-compact'),root=el('div'),summary=el('summary','',t('Claude Code CLI 액세스'));summary.dataset.i18n='Claude Code CLI 액세스';details.append(summary,root);dialog.append(details);
    claudeCliAccessPanel=new CliAccessPanel({root,provider:'claude',read:()=>api('/api/cli-access'),request:value=>api('/api/cli-access',value)});
    const initializeWsl=async()=>{
    if(!await loadWslAccounts()||!dialog.open)return;
    const selectorControls=el('div','accounts-runtime-controls'),selectorLabel=el('label','',t('런타임 환경')),selector=el('select'),wslRoot=el('div');selector.setAttribute('aria-label',t('런타임 환경'));selectorLabel.append(selector);selectorControls.append(selectorLabel);head.after(selectorControls);dialog.append(wslRoot);
    claudeWslAccounts=new WslAccountsPanel({root:wslRoot,provider:'claude',onSwitched:value=>desktopSessions.continueWslAccountDrafts(value),read:entry=>api('/api/wsl-accounts?provider=claude&entry='+encodeURIComponent(entry)),request:value=>api('/api/wsl-accounts',value)});
    const entries=clientNavigation.clients.find(row=>row.id==='claude')?.entries||[];
    const targets=entries.filter(row=>row.id?.startsWith('wsl-claude:'));
    selector.append(new Option(t('이 컴퓨터'),'local'),...targets.map(row=>new Option(row.name||row.label||row.id,row.id)));selectorControls.hidden=!targets.length;
    const select=()=>{const local=selector.value==='local';content.hidden=!local;details.hidden=!local;panel.refreshButton.hidden=!local;if(local){claudeWslAccounts.clear();panel.resume();claudeCliAccessPanel.refresh();}else{panel.generation++;panel.modelsRevision++;clearTimeout(panel.timer);panel.loading=false;panel.busy=false;claudeCliAccessPanel.clear();claudeWslAccounts.select(selector.value);}};
    selector.onchange=select;const activeEntry=desktopSessions.isChatOpen&&desktopSessions.state?.runtime==='wsl'?desktopSessions.state.host:activeProvider;if(targets.some(row=>row.id===activeEntry))selector.value=activeEntry;select();
    };
    selectClaudeAccounts=()=>{if(clientNavigation.wslSupported===true)initializeWsl().catch(error=>{if(dialog.open)toast(error.message);});else{panel.resume();claudeCliAccessPanel.refresh();}};
  }
  dialog.addEventListener('close',()=>{unbindConnection();panel.dispose();claudeWslAccounts?.dispose();claudeCliAccessPanel?.dispose();claudeCliAccessPanel=null;});dialog.showModal();if(selectClaudeAccounts)selectClaudeAccounts();else panel.resume();
  return true;
}
$('accounts-button').onclick=openCurrentAccounts;
if(accountsPanel)workbench.openDesktopConnection=()=>{
  if(currentHost==='local'&&isCodexClient(clientNavigation.provider)&&openCurrentAccounts())
    accountsPanel.showDesktopConnection();
};
window.BridgeNavigation={
  accounts:openCurrentAccounts,
  back(){
    const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(dialog){dialog.close();return true;}
    if(!isCodexClient(clientNavigation.provider)){
      if(desktopSessions.workbench?.back())return true;
      return desktopSessions.backToList();
    }
    if(workbench.back())return true;
    if($('app').classList.contains('chat-open')){$('back').click();return true;}
    return false;
  }
};

$('permissions-button').onclick=()=>{
  if(!currentId||!state?.connected)return;
  const id=currentId,host=currentHost,runtime=state.access?.runtime||'desktop',dialog=el('dialog','picker'),head=el('div','picker-head');
  dialog.dataset.permissionThread=id;dialog.dataset.permissionHost=host;dialog.dataset.permissionRuntime=runtime;
  const isCurrent=()=>{
    const current=dialog.open&&currentId===id&&currentHost===host&&state?.connected===true&&
      (state.access?.runtime||'desktop')===runtime;
    if(!current&&dialog.open)dialog.close();
    return current;
  };
  head.append(el('h2','',t('채팅 권한')));const close=el('button','icon-button','×');close.type='button';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>dialog.close();head.append(close);dialog.append(head,el('p','muted',t('저장 후 다음 턴부터 적용')));
  if(state.linuxPermissionChecks===true||state.access?.runtime==='cli'){
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
    permissionPicker(dialog,{nativeCli:runtime==='cli',load:()=>api(sessionUrl(id,'permissions',host)),
      save:preset=>api(sessionUrl(id,'permissions',host),{preset,confirmed:preset==='full-access',expectedRuntime:runtime}),
      isCurrent,onSaved:()=>toast('권한이 업데이트되었습니다.')});
    return;
  }
  const error=el('p','error');
  for(const [preset,label,help] of [['ask','승인 요청','추가 권한이 필요할 때 물어보세요.'],['auto-review','승인해 주세요','Codex는 추가 권한이 필요한 작업을 검토합니다.'],['full-access','전체 액세스','개별 승인 없이 작업 공간 및 네트워크 외부의 파일에 대한 액세스를 허용합니다.']]){
    const button=permissionOption(el('button'),preset,label,help,state.permissionMode===preset);
    button.onclick=async()=>{
      if(!isCurrent())return;
      if(preset==='full-access'&&!confirm(t('이 채팅에 컴퓨터 파일 및 네트워크에 대한 전체 액세스를 허용하시겠습니까? 신뢰하는 작업에 대해서만 활성화하세요.')))return;
      dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{const result=await api(sessionUrl(id,'permissions',host),{preset,confirmed:preset==='full-access',expectedRuntime:runtime});if(!isCurrent())return;if(result.confirmed){dialog.close();toast('권한이 업데이트되었습니다.');}else error.textContent=t('권한이 제출되었습니다. 데스크톱 확인을 기다리는 중입니다.');}
      catch(e){if(isCurrent())error.textContent=t(e.message);}finally{dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };dialog.append(button);
  }
  dialog.append(error);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
};


const fileTransferSettings=window.BridgeFileActions?.mountSettings($('appearance-dialog'),value=>api('/api/file-transfer',value));
if(fileTransferSettings)$('appearance-dialog').querySelector('.settings-action-row')?.after(fileTransferSettings);
