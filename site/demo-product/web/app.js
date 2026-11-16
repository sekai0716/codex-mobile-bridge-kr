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
let currentHost='local', listRows=[], listGeneration=0;
let chatTimeline=null;
const submittedRequestIds=new Set();
const sessionActivity=new SessionActivity();
const recentInteractions=new Map();
function bumpRecency(id,host,at=Date.now()){
  const key=chatKey(id,host);recentInteractions.set(key,Math.max(at,recentInteractions.get(key)||0));
  const row=listRows.find(row=>row.id===id&&row.host===host);
  if(row&&at>row.recency){row.recency=at;listRows.sort((a,b)=>b.recency-a.recency);renderList();}
}
let activityBusy=false;
const fastModeControl=new FastModeControl({root:$('fast-mode-control'),input:$('fast-mode-enabled'),status:$('fast-mode-status')});
let modelRequest=0,modelTarget=null,modelSaving=false;
async function goalAction(action,payload) {
  const id=currentId,host=currentHost;
  const result=await api(sessionUrl(id,'goal/'+action,host),payload);
  if(!result.confirmed)throw Error("골 결과는 미확인입니다. 목표 상태를 확인하세요.");
  if(currentId===id&&currentHost===host){state={...state,goal:action==='cancel'?null:(result.result?.goal||result.result)};workModes.render(state,$('send-mode').value,false);}
  toast(action==='cancel'?"목표가 지워졌습니다.":action==='edit'?"목표가 업데이트되고 일시중지되었습니다.":payload.status==='paused'?"목표가 일시중지됨":"목표 재개");
}
const workModes=new WorkModes({select:$('work-mode'),hint:$('mode-hint'),goalRoot:$('goal-state'),goalToggle:$('goal-toggle'),newId:uuid,
  onCancel:payload=>goalAction('cancel',payload),onStatus:payload=>goalAction('status',payload),onEdit:payload=>goalAction('edit',payload)});
const accountPanel=new AccountPanel({root:$('account-content'),button:$('account-button'),read:refresh=>api('/api/account'+(refresh?'':'?cached=1')),consume:body=>api('/api/account/reset',body),onConsumed:()=>{const id=accountsPanel?.value?.activeId;if(id)accountsPanel.perform({action:'details',id,section:'usage',refresh:true});},onHidden:()=>{$('account-details').open=false;},visible:()=>!$('app').hidden&&!document.hidden&&$('accounts-dialog').open&&$('account-details').open});
$('account-details').ontoggle=()=>{if($('account-details').open)accountPanel.refresh();};
window.addEventListener('focus',()=>{if(!$('app').hidden)accountsPanel?.refresh();});
function chatKey(id=currentId,host=currentHost){return host+'|'+id;}
function sessionUrl(id,action='',host=currentHost){const path='/api/sessions/'+id+(action?'/'+action:'')+'?host='+encodeURIComponent(host);return window.BridgeRelayURL?.(path)||path;}
function hostUrl(path,host=currentHost){const value=/^\/api\/sessions\/[0-9a-f-]{36}/.test(path)&&!/[?&]host=/.test(path)?path+(path.includes('?')?'&':'?')+'host='+encodeURIComponent(host):path;return window.BridgeRelayURL?.(value)||value;}
let listLoading=0;
let modelCatalogGeneration=0;let catalogData={models:null,skills:null};let catalogResults={models:null,skills:null};let catalogTasks={models:null,skills:null};let selectedSkills=new Set(),invalidSkills=new Set(),skillIndex=new Map(),skillTotal=0,skillPages=[],skillQuery={q:'',offset:0,limit:200},skillSearchTimer,skillRequest=0;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function toast(text){text=t(text);$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4200);}
async function api(path,body,signal){const options={signal,credentials:'same-origin',cache:'no-store',headers:{}};if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':csrf};options.body=JSON.stringify(body);}const response=await fetch(hostUrl(path),options);const data=await response.json();if(!response.ok){if(response.status===401)showLogin();throw Object.assign(Error(data.error||t('요청 실패')),{loginStatus:data.loginStatus,status:response.status});}return data;}
const workbench=window.BridgeWorkbench=new Workbench({chat:$('chat'),request:api,csrf:()=>csrf,notify:toast,onUnauthorized:()=>showLogin(),openChat});
const desktopSessions=new DesktopSessionsView({root:$('app'),select:$('desktop-backend'),request:api,notify:toast,csrf:()=>csrf,onUnauthorized:()=>showLogin(),onSelect:provider=>{
  if(provider!=='codex'){saveDraft();chatTimeline?.dispose();chatTimeline=null;currentId=null;state=null;workbench.reset();$('chat').hidden=true;$('welcome').hidden=false;$('app').classList.remove('chat-open');history.replaceState(null,'',location.pathname);}
  else if(clientNavigation.provider==='codex'&&!$('app').hidden)loadList(true).catch(error=>toast(error.message));
}});
const clientNavigation=new ClientNavigation({view:desktopSessions,request:api,notify:toast});
desktopSessions.onListEnter=()=>{clientNavigation.listReadDone=false;clientNavigation.listVisit=(clientNavigation.listVisit||0)+1;if(clientNavigation.provider!=='codex')desktopSessions.refresh();};
desktopSessions.onListReady=(provider,value)=>clientNavigation.acknowledgeList(provider,value);
async function uploadAttachment(key,id,file){const separator=key.indexOf('|'),host=key.slice(0,separator),thread=key.slice(separator+1);const response=await fetch(sessionUrl(thread,'uploads',host)+'&id='+encodeURIComponent(id)+'&name='+encodeURIComponent(file.name),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf},body:file});const result=await response.json();if(!response.ok){if(response.status===401)showLogin();const error=Error(result.error||t("첨부파일 업로드에 실패했습니다. 다시 시도해 보세요."));error.retryable=response.status>=500||response.status===429;throw error;}return result;}
async function uploadAttachmentWithRetry(key,id,file){if(window.BridgeSharedRelay)return uploadAttachment(key,id,file);let last;for(let attempt=0;attempt<3;attempt++){try{return await uploadAttachment(key,id,file);}catch(error){last=error;if(error.name==='AbortError'||error.retryable===false||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));}}if(last instanceof TypeError)last.message=t("첨부파일 업로드가 중단되었습니다. 다시 시도해 보세요.");throw last;}
const attachments=new ChatAttachments({root:$('attachment-list'),button:$('attach-button'),input:$('attachment-input'),paste:$('message'),drop:$('composer'),preview:(key,id)=>{const at=key.indexOf('|'),host=key.slice(0,at),thread=key.slice(at+1);return hostUrl(sessionUrl(thread,'uploads/'+encodeURIComponent(id)+'/preview',host));},onChange:()=>{if(currentId)$('send').disabled=sending||!attachments.ready()||!state||state.loadingHistory||state.activating;},thumbnail:async(key,id,file)=>{
  const separator=key.indexOf('|'),host=key.slice(0,separator),thread=key.slice(separator+1);
  const image=await attachments.thumbnailBlob(file);
  const response=await fetch(sessionUrl(thread,'uploads/'+encodeURIComponent(id)+'/thumb',host)+'&width='+image.width+'&height='+image.height,{method:'POST',credentials:'same-origin',headers:{'Content-Type':image.mime,'X-CSRF-Token':csrf},body:image.data});
  const result=await response.json();if(!response.ok){if(response.status===401)showLogin();throw Error(result.error||t("썸네일 업로드 실패"));}return result;
},upload:uploadAttachmentWithRetry});
function visibleChat(){return currentId&&!workbench.isFileVisible&&!document.hidden&&$('app').classList.contains('chat-open')?chatKey():null;}
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
  $('login-attempts').textContent=loginStatus.blocked?t("이 IP는 차단되었습니다. 데스크톱 게이트웨이 앱의 로그인 장치에서 차단을 해제하세요."):t("남은 시도 횟수:")+loginStatus.attemptsRemaining+'/'+loginStatus.attemptLimit+t("; 5회 연속 실패하면 이 IP가 차단됩니다.");
  $('login-button').disabled=loginStatus.blocked;
}
function showLogin(passwordless=false,status){window.BridgeDownloads?.clear();$('mobile-binding-status').hidden=true;if(window.BridgeSharedRelay){location.replace((window.BridgeRelayBase||'')+'/relay/');return;}desktopSessions.clear();workbench.reset();if(typeof accountsPanel!=='undefined')accountsPanel?.clear();accountPanel.clear();chatTimeline?.dispose();chatTimeline=null;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('app').hidden=true;$('login').hidden=false;$('credentials').hidden=passwordless;$('noauth').hidden=!passwordless;$('username').required=!passwordless;$('password').required=!passwordless;$('password').value='';$('remember-login').parentElement.hidden=passwordless||BridgeHost.isNativeApp();$('login-attempts').hidden=passwordless;renderLoginStatus(status);$('bootstrap-status').hidden=true;window.BridgeBootstrap?.ready();}
async function start(pairingToken=null){
  window.BridgeBootstrap?.waitingForAuth();
  const auth=await api('/api/auth');
  if(['en','ko'].includes(auth.uiLanguage)){$('phone-language').value=auth.uiLanguage;$('phone-language').onchange();}
  if(pairingToken!==null){
    try{window.BridgeBootstrap?.pairingSubmitted();const result=await api('/api/pair',{token:pairingToken});csrf=result.csrf;await enter();return;}
    catch(error){
      if(auth.authenticated){csrf=auth.csrf;await enter();toast(error.message);}
      else{showLogin(auth.passwordless,auth.loginStatus);$('login-error').textContent=t(error.message);}
      return;
    }finally{pairingToken=null;}
  }
  if(!auth.authenticated){showLogin(auth.passwordless,auth.loginStatus);return;}csrf=auth.csrf;await enter();
}
async function refreshComputer(){
  $('connected-computer').dataset.deviceName=location.host;
  $('computer-name').textContent=location.host;$('connected-computer').title=location.host;
  try{const auth=await api('/api/auth');if(!auth.authenticated||$('app').hidden)return;
    const binding=$('mobile-binding-status');binding.hidden=!auth.trustedDevice;binding.setAttribute('data-i18n',"이 전화는 연결되어 있습니다. 데스크톱 게이트웨이의 로그인된 장치에서 연결을 해제하세요.");binding.textContent=t("이 전화는 연결되어 있습니다. 데스크톱 게이트웨이의 로그인된 장치에서 연결을 해제하세요.");
    const name=auth.computer?.name||location.host;$('connected-computer').dataset.deviceName=name;$('computer-name').textContent=name;
    $('connected-computer').title=[name,auth.computer?.platform,location.host].filter(Boolean).join(' · ');
  }catch{/* Older or temporarily unavailable gateways keep the connected address. */}
  finally{document.dispatchEvent(new Event('bridge-computer'));}
}
async function openHarness(){
  try{const state=await api('/api/harness');if(state.running)location.assign('/harness/');else toast("데스크톱 앱에서 DeepSeek Harness를 시작하세요.");}
  catch(error){toast(error.message);}
}
$('harness-open').onclick=openHarness;
async function enter(){desktopSessions.onListEnter();const chatLink=location.hash;$('desktop-backend').hidden=false;if(/(?:^|[?&])open=harness(?:&|$)/.test(location.search||'')){history.replaceState(null,'','/');await openHarness();}refreshComputer();$('login').hidden=true;$('app').hidden=false;$('bootstrap-status').hidden=true;window.BridgeBootstrap?.ready();document.dispatchEvent(new Event('bridge-authenticated'));await clientNavigation.refresh();accountsPanel?.refresh();const list=clientNavigation.provider==='codex'?loadList(true).catch(e=>toast(e.message)):Promise.resolve();await clientNavigation.openChatLink(chatLink,openChat);await list;}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();if(loginStatus.blocked)return;$('login-button').disabled=true;$('login-error').textContent='';try{const result=await api('/api/login',{username:$('username').value,password:$('password').value,remember:$('remember-login').checked});renderLoginStatus({attemptsRemaining:5,attemptLimit:5,blocked:false});csrf=result.csrf;$('password').value='';await enter();}catch(error){$('login-error').textContent=t(error.message);renderLoginStatus(error.loginStatus);}finally{$('login-button').disabled=loginStatus.blocked;}});
$('logout').onclick=async()=>{await api('/api/logout',{});csrf='';state=null;currentId=null;$('messages').replaceChildren();$('approvals').replaceChildren();$('queued').replaceChildren();$('sessions').replaceChildren();$('message').value='';sessionStorage.clear();attachments.reset();sessionActivity.clear();recentInteractions.clear();showLogin();};
function dateText(value){if(!value)return '';return new Date(value*1000).toLocaleDateString(BridgeI18n.locale(),{month:'numeric',day:'numeric'});}
$('list-mode').value=localStorage.getItem('list-mode')||'recent';
$('list-mode').onchange=()=>{localStorage.setItem('list-mode',$('list-mode').value);renderList();};
function renderList(){
  $('sessions').replaceChildren();
  const grouped=$('list-mode').value==='project', groups=new Map();
  for(const chat of listRows){
    let parent=$('sessions');
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
    const meta=el('small');meta.append(el('span','',chat.projectName+' · '+(chat.host==='local'?t('이 컴퓨터'):chat.hostLabel)),el('time','',dateText(chat.recency/1000)));
    button.append(meta);button.onclick=()=>openChat(chat.id,chat.host).catch(e=>toast(e.message));parent.append(button);
  }
  if(!listRows.length)$('sessions').append(el('p','muted',t("채팅을 찾을 수 없습니다.")));renderActivity();
}
async function loadList(reset=false){
  const generation=++listGeneration,offset=reset?0:listOffset;
  listQuery=$('search').value;
  let result;listLoading++;
  try{result=await api('/api/sessions?q='+encodeURIComponent(listQuery)+'&offset='+offset+'&archived='+$('archived').checked);}
  finally{listLoading--;}
  if(generation!==listGeneration)return;
  const rows=new Map((reset?[]:listRows).map(row=>[chatKey(row.id,row.host),row]));
  for(const row of result.sessions){const key=chatKey(row.id,row.host);row.recency=Math.max(row.recency,recentInteractions.get(key)||0);rows.set(key,row);}
  listRows=[...rows.values()];listRows.sort((a,b)=>b.recency-a.recency);
  listOffset=offset+result.sessions.length;$('more').hidden=result.sessions.length<100;
  $('host-errors').textContent=(result.unavailableHosts||[]).map(h=>h.label+'：'+h.error).join('\n');
  $('host-errors').hidden=!(result.unavailableHosts||[]).length;renderList();refreshActivity();clientNavigation.acknowledgeList('codex',result);
}
$('search').oninput=()=>{clearTimeout(loadList.timer);loadList.timer=setTimeout(()=>loadList(true).catch(e=>toast(e.message)),300);};$('refresh').onclick=()=>loadList(true).catch(e=>toast(e.message));$('more').onclick=()=>loadList().catch(e=>toast(e.message));
$('archived').onchange=()=>loadList(true).catch(e=>toast(e.message));
const listSync=window.BridgeListSync=new ListSync({root:$('sessions'),status:$('list-sync'),refresh:()=>loadList(true),visible:()=>!$('app').hidden&&$('sidebar').getBoundingClientRect().width>0,ready:()=>!listLoading&&document.activeElement!==$('search')});
const contextUsageControl=new ContextUsageControl();$('permissions-button').after(contextUsageControl.button);
let newChatProjects=[],creatingChat=false,approvalBusy=0;
$('new-chat-title').value=t('새 채팅');
$('new-chat-title').oninput=()=>{$('new-chat-title').dataset.edited='true';};
$('new-chat').onclick=async()=>{
  $('new-chat-error').textContent='';$('new-chat-submit').disabled=true;
  $('new-chat-project').replaceChildren();$('new-chat-path').textContent=t("데스크톱 프로젝트 로드 중…");
  $('new-chat-dialog').showModal();
  try{
    newChatProjects=(await api('/api/projects')).projects;
    $('new-chat-project').append(new Option(t("프로젝트 없음"),'local|independent'));
    for(const project of newChatProjects)$('new-chat-project').append(new Option(project.name+' · '+(project.host==='local'?t('이 컴퓨터'):project.hostLabel),project.key));
    const selected=listRows.find(row=>row.id===currentId&&row.host===currentHost)?.projectKey;
    if(newChatProjects.some(p=>p.key===selected))$('new-chat-project').value=selected;
    $('new-chat-project').onchange();
    $('new-chat-submit').disabled=false;
  }catch(e){$('new-chat-error').textContent=t(e.message);$('new-chat-path').textContent='';}
};
$('new-chat-project').onchange=()=>{$('new-chat-path').textContent=$('new-chat-project').value==='local|independent'?t('이 컴퓨터에서 독립적인 채팅을 만드세요'):newChatProjects.find(p=>p.key===$('new-chat-project').value)?.cwd||'';};
$('new-chat-dialog').addEventListener('cancel',event=>{if(creatingChat)event.preventDefault();});
$('new-chat-form').onsubmit=async event=>{
  event.preventDefault();if(creatingChat)return;
  const project=$('new-chat-project').value,title=$('new-chat-title').value.trim();
  if(!project||!title){$('new-chat-error').textContent=t("프로젝트 또는 프로젝트 없음을 선택하고 채팅 이름을 입력하세요.");return;}
  let attempt;
  try{attempt=JSON.parse(sessionStorage.getItem('new-chat-attempt')||'null');}catch{}
  if(!attempt||attempt.project!==project||attempt.title!==title)attempt={id:uuid(),project,title};
  sessionStorage.setItem('new-chat-attempt',JSON.stringify(attempt));
  creatingChat=true;setLanguageBusy();$('new-chat-error').textContent='';$('new-chat-submit').textContent=t("만드는 중…");
  $('new-chat-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=true);
  document.querySelector('[data-close="new-chat-dialog"]').disabled=true;
  try{
    const result=await api('/api/sessions',attempt);
    sessionStorage.removeItem('new-chat-attempt');$('new-chat-dialog').close();
    $('search').value='';$('archived').value='false';
    loadList(true).catch(e=>toast(e.message));toast(result.message);
    await openChat(result.id,result.host);
  }catch(e){
    if($('new-chat-dialog').open)$('new-chat-error').textContent=t(e.message)+t("; 결과가 불확실한 경우 중복 채팅을 피하기 위해 다시 시도하기 전에 목록을 새로 고치십시오.");
    else toast(t("채팅이 생성되었지만 아직 연결되지 않았습니다.")+t(e.message));
  }finally{
    creatingChat=false;setLanguageBusy();$('new-chat-submit').textContent=t('생성 및 열기');
    $('new-chat-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);
    document.querySelector('[data-close="new-chat-dialog"]').disabled=false;
  }
};
const messageActions=new MessageActions({request:api,openChat,refresh:()=>loadList(true).catch(e=>toast(e.message)),uuid,notify:toast,busy:value=>{approvalBusy+=value?1:-1;setLanguageBusy();}});
document.addEventListener('bridge-message-error',event=>toast(event.detail));
$('fork-source').onclick=()=>{const source=state?.forkedFrom;if(source){$('chat-details-dialog').close();openChat(source.id,source.host).catch(e=>toast(e.message));}};
function saveDraft(){if(currentId)sessionStorage.setItem('draft:'+chatKey(),$('message').value);}
$('message').oninput=saveDraft;
async function openChat(id,host="local"){if(messageActions.pending&&messageActions.dialog.open)return;messageActions.dialog.close();workbench.open(id,host);saveDraft();chatTimeline?.dispose();currentId=id;currentHost=host;state=null;contextUsageControl.update(null);workModes.open(chatKey(id,host));attachments.open(chatKey(id,host));modelCatalogGeneration++;catalogData={models:null,skills:null};catalogResults={models:null,skills:null};catalogTasks={models:null,skills:null};skillIndex=new Map();skillTotal=0;skillPages=[];skillQuery={q:'',offset:0,limit:200};invalidSkills=new Set();skillRequest++;modelRequest++;modelTarget=null;fastModeControl.reset();$('model-dialog').close();notificationState={available:false,watching:false,notifyOnCompletion:false};notificationRequest++;$('notify-dialog').close();$('rename-dialog').close();$('chat-details-dialog').close();$('notify-button').disabled=true;$('notify-button').textContent=t("알림");try{selectedSkills=new Set(JSON.parse(sessionStorage.getItem('skills:'+chatKey(id,host))||'[]'));}catch{selectedSkills=new Set();}renderSkillPills();approvalStamp='';submittedRequestIds.clear();$('messages').replaceChildren();$('approvals').replaceChildren();$('queued').replaceChildren();$('message').value=sessionStorage.getItem('draft:'+chatKey(id,host))||'';$('send-error').textContent='';$('chat-title').textContent=t('연결 중…');$('chat-meta').textContent='';$('status').textContent=t('연결 중');$('welcome').hidden=true;$('chat').hidden=false;$('app').classList.add('chat-open');$('send').disabled=true;history.replaceState(null,'','#'+id+'~'+encodeURIComponent(host));document.querySelectorAll('.session').forEach(n=>n.classList.toggle('selected',n.dataset.id===id&&n.dataset.host===host));const timeline=chatTimeline=new ChatTimeline({url:action=>sessionUrl(id,action,host),request:api,renderMeta:renderState,renderText:(node,text,files,fullText)=>renderMarkdown(node,text,files,file=>sessionUrl(id,'files/'+file.id,host),{fullText}),onAction:(action,row,timeline)=>{const pendingKey='fork-edit:'+host+'|'+id;let pending;try{pending=JSON.parse(sessionStorage.getItem(pendingKey));}catch{}if(pending&&pending.sourceTurnId===row.turnId&&action==='edit'){sessionStorage.setItem('message-edit:'+timeline.url('message-action')+':'+row.key,pending.text);sessionStorage.removeItem(pendingKey);}return messageActions.open(action,row,timeline);},status:text=>{$('status').textContent=t(text);}});
  window.BridgePresentation?.openChat();
  startCatalog();
  const reading=timeline.start();
  // Opening a chat activates its original owner while saved history paints.
  api(sessionUrl(id,'reconnect',host),{activate:true},timeline.abort.signal).catch(error=>{if(!timeline.abort.signal.aborted)toast(error.message);});
  await reading;
  if(!timeline.abort.signal.aborted)loadNotificationState(id,host);
}
let notificationState={available:false,watching:false,notifyOnCompletion:false},notificationRequest=0;
function renderNotificationState(){$('notify-button').textContent=t(notificationState.watching?"알림 켜짐":"알림");}
async function loadNotificationState(id=currentId,host=currentHost){
  const request=++notificationRequest;
  $('notify-button').disabled=true;
  try{const result=await api(sessionUrl(id,'notifications',host));if(request!==notificationRequest||id!==currentId||host!==currentHost)return;notificationState=result;renderNotificationState();return true;}
  catch(e){if(request===notificationRequest&&id===currentId&&host===currentHost){$('notify-error').textContent=t(e.message);notificationState={...notificationState,error:e.message};}return false;}
  finally{if(request===notificationRequest&&id===currentId&&host===currentHost)$('notify-button').disabled=false;}
}
$('notify-button').onclick=async()=>{
  const key=chatKey();
  $('notify-error').textContent='';$('notify-dialog').showModal();
  for(const id of ['notify-enabled','notify-completion','notify-save'])$(id).disabled=true;
  const loaded=await loadNotificationState();
  if(!$('notify-dialog').open||key!==chatKey()||!loaded)return;
  $('notify-enabled').value=notificationState.requests||'inherit';
  $('notify-completion').value=notificationState.completion||'inherit';
  for(const id of ['notify-enabled','notify-completion','notify-save'])$(id).disabled=false;
  $('notify-channel-status').textContent=t(notificationState.available?"알림 채널 활성화됨":"구성된 알림 채널이 없습니다. 설정에서 PushPlus를 설정하거나 데스크톱 앱에서 Bark 또는 ntfy를 설정하세요.");
};
$('notify-form').onsubmit=async event=>{
  event.preventDefault();
  const id=currentId,host=currentHost,request=++notificationRequest;
  const body={requests:$('notify-enabled').value,completion:$('notify-completion').value};
  $('notify-button').disabled=true;$('notify-save').disabled=true;$('notify-error').textContent='';
  try{
    const result=await api(sessionUrl(id,'notifications',host),body);
    if(request!==notificationRequest||id!==currentId||host!==currentHost)return;
    notificationState=result;renderNotificationState();$('notify-dialog').close();toast("채팅 알림 설정이 저장되었습니다.");
  }catch(e){if(request===notificationRequest&&id===currentId&&host===currentHost)$('notify-error').textContent=t(e.message);}
  finally{if(request===notificationRequest&&id===currentId&&host===currentHost){$('notify-button').disabled=false;$('notify-save').disabled=false;}}
};
let notificationDefaultsRequest=0;
window.loadNotificationDefaults=async()=>{
  if(window.BridgeSharedRelay)return;
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
$('back').onclick=()=>{desktopSessions.onListEnter();workbench.rememberScroll();workbench.stopThumbnails();$('app').classList.remove('chat-open');history.replaceState(null,'',location.pathname);loadList(true).catch(e=>toast(e.message));};
function renderState(view){contextUsageControl.update(view);state=view;$('permissions-button').textContent=t({'ask':'승인 요청','auto-review':"승인해 주세요",'full-access':'전체 액세스'}[view.permissionMode]||'권한');$('permissions-button').disabled=!view.connected;$('fork-source').hidden=!view.forkedFrom;$('fork-source').textContent=view.forkedFrom?t("소스 채팅:")+view.forkedFrom.title:'';if($('model-dialog').open&&modelTarget===chatKey())fastModeControl.sync(view);if(visibleChat()){sessionActivity.read(chatKey());renderActivity();}$('execution-host').textContent=t("실행 중")+(view.host==='local'?t('컴퓨터'):view.hostLabel||t("SSH 호스트"))+t(' 달리다');$('chat-title').textContent=view.loadingHistory?t("채팅 로드 중…"):view.title;$('chat-meta').textContent=(view.host==='local'?t('이 컴퓨터'):view.hostLabel||t("SSH 호스트"))+' · '+(view.cwd||t('컴퓨터에서 채팅'));$('model-name').textContent=view.model||t('모델');$('model-current').textContent=view.model?t("현재 모델:")+view.model:'';$('model-current').hidden=!view.model;$('model-effort').textContent=view.effort?'· '+view.effort:'';$('model-effort').hidden=!view.effort;$('model-button').title=[view.model||t('모델'),view.effort].filter(Boolean).join(' · ');$('provider').textContent=[view.model,view.provider].filter(Boolean).join(' · ');$('status').textContent=!view.connected?(view.loadingHistory?t("로딩 내역"):view.activating?t('데스크톱 채팅 로드 중…'):view.connecting?t('데스크톱에 연결 중'):t("기록")):view.requests.length?t('응답을 기다리는 중'):view.status==='active'?t("실행 중"):t('연결됨');$('status').classList.toggle('offline',!view.connected);$('notice').hidden=view.connected;$('notice-text').textContent=view.activating?t("자동으로 연결; 컴퓨터의 Codex에서 채팅이 열릴 수 있습니다."):view.connecting?t("데스크탑에 연결 중입니다. 그동안 저장된 기록을 읽을 수 있습니다."):t(view.connectionError)||t("아직 연결되지 않았습니다. 기록을 읽거나 다시 연결할 수 있습니다.");$('history').hidden=view.historyComplete||!view.connected;$('working').hidden=view.status!=='active';$('stop').hidden=view.status!=='active'||!view.connected;$('send').disabled=view.loadingHistory||view.activating||sending||!attachments.ready();$('send-mode').querySelector('[value=steer]').disabled=view.status!=='active';if(view.status!=='active'&&$('send-mode').value==='steer')$('send-mode').value='send';workModes.render(view,$('send-mode').value,sending);renderApprovals(view.requests);renderQueue(view.submissions||[]);}
$('send-mode').onchange=()=>workModes.render(state,$('send-mode').value,sending);
function jsonPretty(value){return typeof value==='string'?value:JSON.stringify(value,null,2);}
function renderApprovals(requests){const stamp=JSON.stringify(requests);if(stamp===approvalStamp)return;approvalStamp=stamp;$('approvals').replaceChildren();for(const request of requests){if(request.supported&&request.params?.computerUse){$('approvals').append(renderComputerApproval(request));continue;}if(request.method==='item/plan/requestImplementation'&&request.supported){$('approvals').append(renderPlanApproval(request));continue;}const card=el('section','approval');card.dataset.request=String(request.id);const params=request.params||{}, method=request.method;const heading=method.includes('requestUserInput')?t("Codex에는 귀하의 답변이 필요합니다"):method.includes('fileChange')?t("파일 변경을 허용하시겠습니까?"):method.includes('commandExecution')?t("이 명령을 허용하시겠습니까?"):method.includes('permissions')?t("이번 차례에 권한을 허용하시겠습니까?"):t("확인 대기 중");card.append(el('h3','',heading));const controls={};if(!request.supported){card.append(el('p','',params.message||t("데스크톱 앱에서 이 요청을 처리하세요.")));$('approvals').append(card);continue;}if(params.reason)card.append(el('p','',params.reason));if(params.command)card.append(el('pre','',jsonPretty(params.command)));if(params.cwd)card.append(el('p','muted',params.cwd));for(const key of ['changes','grantRoot','permissions','networkApprovalContext'])if(params[key])card.append(el('pre','',jsonPretty(params[key])));const form=el('form');if(method.includes('requestUserInput')){for(const question of params.questions||[]){const label=el('label','',question.question||question.header||question.id);if(question.options?.length){const select=el('select');select.append(new Option(t("선택하다…"),''));for(const option of question.options)select.append(new Option(option.label+(option.description?' — '+option.description:''),option.label));select.append(new Option(t("답장을 직접 작성하세요."),'__custom__'));label.append(select);const custom=el('textarea');custom.rows=2;custom.hidden=true;custom.placeholder=t('답장을 입력하세요');select.onchange=()=>custom.hidden=select.value!=='__custom__';label.append(custom);controls[question.id]=()=>select.value==='__custom__'?custom.value:select.value;}else{const input=el('textarea');input.rows=2;input.required=true;label.append(input);controls[question.id]=()=>input.value;}form.append(label);}}else if(method==='mcpServer/elicitation/request'){if(params.message)form.append(el('p','',params.message));const schema=params.requestedSchema||{};for(const [key,field] of Object.entries(schema.properties||{})){const label=el('label','',field.title||key);let input;if(field.enum){input=el('select');input.append(new Option(t("선택하다…"),''));for(const [i,value] of field.enum.entries())input.append(new Option(field.enumNames?.[i]||String(value),String(value)));}else{input=el('input');input.type=field.type==='boolean'?'checkbox':['number','integer'].includes(field.type)?'number':'text';if(input.type==='number')input.step=field.type==='integer'?'1':'any';}input.required=(schema.required||[]).includes(key)&&input.type!=='checkbox';if(field.description)label.append(el('p','muted',field.description));label.append(input);form.append(label);controls[key]=()=>input.type==='checkbox'?input.checked:input.value===''?undefined:['number','integer'].includes(field.type)?Number(input.value):input.value;}}const actions=el('div','actions'),error=el('p','error');async function submit(response){const id=currentId,host=currentHost;approvalBusy++;setLanguageBusy();const buttons=card.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);error.textContent='';try{await api(sessionUrl(id,'respond',host),{requestId:request.id,response});submittedRequestIds.add(request.id);bumpRecency(id,host);toast("답장을 보냈습니다");card.append(el('p','muted',t("전송된. 데스크톱 확인을 기다리는 중…")));}catch(e){error.textContent=t(e.message);buttons.forEach(b=>b.disabled=false);}finally{approvalBusy--;setLanguageBusy();}}const isInput=method.includes('requestUserInput'),isMcp=method==='mcpServer/elicitation/request';const yes=el('button','primary',isInput?t('답장 제출'):t("한 번만 허용"));yes.type='submit';const available=params.availableDecisions;const canAccept=!available||available.includes('accept');if(isInput||isMcp||canAccept)actions.append(yes);if(!isInput){const no=el('button','secondary',t('거부'));no.type='button';no.onclick=()=>submit(isMcp?{action:'decline'}:{decision:'decline'});if(!available||available.includes('decline'))actions.append(no);if(method.includes('commandExecution')||method.includes('fileChange')||isMcp){const cancel=el('button','secondary',t('취소'));cancel.type='button';cancel.onclick=()=>submit(isMcp?{action:'cancel'}:{decision:'cancel'});if(!available||available.includes('cancel'))actions.append(cancel);}}form.onsubmit=event=>{event.preventDefault();if(isInput){const answers={};for(const [key,get] of Object.entries(controls)){const value=get();if(!value.trim()){error.textContent=t('모든 질문에 답변해 주세요.');return;}answers[key]=[value];}submit({answers});}else if(isMcp){const content={};for(const [key,get] of Object.entries(controls)){const value=get();if(value!==undefined)content[key]=value;}submit({action:'accept',content});}else submit({decision:'accept'});};form.append(actions,error);card.append(form);if(submittedRequestIds.has(request.id)){card.querySelectorAll('button').forEach(button=>button.disabled=true);card.append(el('p','muted',t("전송된. 데스크톱 확인을 기다리는 중…")));}$('approvals').append(card);}}
function renderComputerApproval(request){
  const id=currentId,host=currentHost,card=el('section','approval'),computer=request.params.computerUse;
  card.dataset.request=String(request.id);card.append(el('h3','',t("컴퓨터 앱 액세스를 허용하시겠습니까?")),el('p','',computer.app));
  if(request.params.message)card.append(el('p','',request.params.message));
  const actions=el('div','actions'),error=el('p','error');card.append(actions,error);
  let busy=submittedRequestIds.has(request.id);
  async function submit(response){
    if(busy)return;busy=true;approvalBusy++;setLanguageBusy();actions.querySelectorAll('button').forEach(b=>b.disabled=true);error.textContent='';
    try{await api(sessionUrl(id,'respond',host),{requestId:request.id,response});bumpRecency(id,host);if(id===currentId&&host===currentHost)submittedRequestIds.add(request.id);card.append(el('p','muted',t("전송된. 데스크톱 확인을 기다리는 중…")));}
    catch(e){error.textContent=t(e.message);busy=false;actions.querySelectorAll('button').forEach(b=>b.disabled=false);}
    finally{approvalBusy--;setLanguageBusy();}
  }
  function choice(label,response,primary=false){const button=el('button',primary?'primary':'secondary',t(label));button.type='button';button.disabled=busy;button.onclick=()=>submit(response);actions.append(button);}
  if(computer.persistModes.includes('always'))choice("항상 허용",{action:'accept',persist:'always'});
  choice('거부',{action:'decline'});
  if(computer.persistModes.includes('session'))choice("이 대화를 허용하세요",{action:'accept',persist:'session'},true);
  else choice("한 번만 허용",{action:'accept'},true);
  return card;
}
function renderPlanApproval(request){
  const id=currentId,host=currentHost,key=chatKey(id,host),card=el('section','approval plan-approval');
  card.dataset.request=String(request.id);card.append(el('h3','',t("계획 준비됨")));
  const details=el('details'),summary=el('summary','',t('계획 보기')),content=el('div','plan-content');
  renderMarkdown(content,request.params.planContent||'',[],()=>null);details.append(summary,content);card.append(details);
  const label=el('label','',t("요청된 변경사항(선택사항)")),input=el('textarea');input.rows=2;input.maxLength=20000;label.append(input);card.append(label);
  const actions=el('div','actions'),yes=el('button','primary',t("현재 계획을 실행")),revise=el('button','secondary',t("피드백을 활용하여 계획 수정")),error=el('p','error');
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
    if(action==='revise'&&!input.value.trim()){error.textContent=t("요청된 변경사항을 입력하세요.");return;}
    const response=action==='implement'?{action}:{action,text:input.value};
    busy=true;approvalBusy++;setLanguageBusy();yes.disabled=revise.disabled=true;error.textContent='';
    try{
      const result=await api(sessionUrl(id,'respond',host),{requestId:request.id,response});
      if(currentId!==id||currentHost!==host)return;
      bumpRecency(id,host);submittedRequestIds.add(request.id);
      if(result.status==='unknown'){error.textContent=t("배송은 미확인입니다. 다른 조치를 취하기 전에 대화를 확인하세요.");return;}
      workModes.selection=action==='implement'?'default':'plan';sessionStorage.setItem('work-mode:'+key,workModes.selection);workModes.render();
      card.append(el('p','muted',t("전송된. 데스크톱 확인을 기다리는 중…")));
    }catch(e){if(currentId===id&&currentHost===host){error.textContent=t(e.message);busy=false;updateActions();}}
    finally{approvalBusy--;setLanguageBusy();}
  }
  yes.onclick=()=>submit('implement');revise.onclick=()=>submit('revise');return card;
}
async function ignoreSubmission(value){
  const result=await api('/api/accounts/ignore-submission',value);
  const key='pending:'+chatKey(value.threadId,value.host);
  try{if(JSON.parse(sessionStorage.getItem(key))?.id===value.submissionId)sessionStorage.removeItem(key);}catch{}
  if(currentId===value.threadId&&currentHost===value.host&&state){state.submissions=(state.submissions||[]).filter(row=>row.id!==value.submissionId);renderQueue(state.submissions);}
  return result;
}
function renderQueue(rows){
  $('queued').replaceChildren();
  const target=currentId,host=currentHost;
  for(const row of rows){
    const card=el('div','queue-card'),reply=row.text.startsWith('<send_user_message_question_reply>');
    card.append(el('strong','',row.status==='queued'?t("현재 작업을 기다리는 중"):t("배송이 확인되지 않았습니다.")),el('p','',reply?t('질문 답변'):row.text));
    if(row.attachments?.length)card.append(el('small','muted',t("부착:")+row.attachments.join('、')));
    if(row.status==='queued'){
      const cancel=el('button','plain',t("대기 중인 메시지 철회"));
      cancel.onclick=async()=>{try{await api(sessionUrl(target,'queue',host),{id:row.id});toast("대기 중인 메시지가 철회됨");}catch(e){toast(e.message);}};card.append(cancel);
    }else{
      card.append(el('p','muted',t("채팅 기록을 확인하세요. 게이트웨이는 이 메시지를 자동으로 다시 보내지 않습니다.")));
      const ignore=el('button','plain',t("무시하다"));
      ignore.onclick=async()=>{
        if(!window.confirm(t("무시하면 확인되지 않은 기록만 무시됩니다. 메시지를 철회하거나 다시 보내지는 않습니다. 먼저 채팅 기록을 확인하세요.")))return;
        ignore.disabled=true;
        try{accountsPanel?.accept(await ignoreSubmission({threadId:target,submissionId:row.id,host}));toast('확인되지 않은 기록은 무시됩니다.');}
        catch(e){ignore.disabled=false;toast(e.message);}
      };if(!window.BridgeSharedRelay)card.append(ignore);
    }
    $('queued').append(card);
  }
}
function uuid(){const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
$('composer').onsubmit=async event=>{event.preventDefault();if(sending||!currentId)return;const text=$('message').value;if(!attachments.ready()){toast("첨부파일 업로드가 완료될 때까지 기다리세요.");return;}const attachmentIds=attachments.ids();if(!text.trim()&&!attachmentIds.length)return;const mode=$('send-mode').value,workMode=workModes.value(mode);if(workMode==='goal'&&attachmentIds.length){$('send-error').textContent=t("목표 모드는 아직 첨부 파일을 지원하지 않습니다.");return;}if(invalidSkills.size){$('send-error').textContent=t("선택한 스킬을 사용할 수 없습니다. 새로고침하고 다시 선택하세요.");return;}const skills=[...selectedSkills].sort();const key='pending:'+chatKey();let pending;try{pending=JSON.parse(sessionStorage.getItem(key));}catch{}if(!pending||pending.text!==text||pending.mode!==mode||pending.workMode!==workMode||JSON.stringify(pending.skills||[])!==JSON.stringify(skills)||JSON.stringify(pending.attachments||[])!==JSON.stringify(attachmentIds))pending={id:uuid(),text,mode,skills,workMode,attachments:attachmentIds,uiLocale:BridgeI18n.locale()};sessionStorage.setItem(key,JSON.stringify(pending));sending=true;attachments.setLocked(true);workModes.render(state,mode,true);$('send').disabled=true;$('send-error').textContent='';const target=currentId,targetHost=currentHost;try{const result=await api(sessionUrl(target,'send',targetHost),pending);if(result.status==='ignored')throw Error(t("이 확인되지 않은 기록은 무시되었습니다. 다시 보내기 전에 메시지를 새로 고치고 편집하세요."));if(result.status==='unknown')throw Error(t("메시지가 전달되었을 수 있습니다. 채팅 기록을 확인하세요. 다시 클릭하면 두 번 제출되지 않습니다."));bumpRecency(target,targetHost);sessionStorage.removeItem(key);workModes.submitted(chatKey(target,targetHost),workMode);attachments.clear(chatKey(target,targetHost),attachmentIds);sessionStorage.removeItem('draft:'+chatKey(target,targetHost));if(currentId===target&&currentHost===targetHost){$('message').value='';selectedSkills.clear();renderSkillPills();window.BridgePresentation?.resizeMessage();}toast(workMode==='goal'?(result.activation?.status==='queued'?t("목표가 생성되었습니다. 대기 시작"):result.activation?t("목표가 생성되었습니다. 시작 중…"):t("목표 요청이 제출되었습니다. 데스크톱 확인 대기 중")):result.status==='queued'?t("전송 대기열에 추가됨"):t("채팅으로 보냈습니다"));}catch(error){if(currentId===target&&currentHost===targetHost){$('send-error').textContent=t(error.message);window.BridgePresentation?.showError();}}finally{sending=false;attachments.setLocked(false);workModes.render(state,$('send-mode').value,false);$('send').disabled=!state||state.loadingHistory||state.activating||!attachments.ready();}};
$('message').onkeydown=event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();$('composer').requestSubmit();}};
$('stop').onclick=async()=>{try{await api('/api/sessions/'+currentId+'/stop',{});toast('중지 요청됨');}catch(e){toast(e.message);}};
$('history').onclick=async()=>{$('history').disabled=true;try{await api('/api/sessions/'+currentId+'/history',{});}catch(e){toast(e.message);}finally{$('history').disabled=false;}};
$('reconnect').onclick=async()=>{const id=currentId,host=currentHost;$('reconnect').disabled=true;try{await api(sessionUrl(id,'reconnect',host),{activate:true});}catch(e){toast(e.message);}finally{$('reconnect').disabled=false;}};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
async function loadCatalogKind(kind,refresh=false){
  if(kind!=='models')throw Error(t("알 수 없는 카탈로그 유형"));
  if(refresh)modelCatalogGeneration++;
  const target=currentId,targetHost=currentHost,generation=modelCatalogGeneration;
  if(!refresh&&catalogResults[kind])return catalogResults[kind];
  if(!refresh&&catalogTasks[kind])return catalogTasks[kind];
  const request=api('/api/sessions/'+target+'/catalog?kind='+kind+(refresh?'&refresh=true':'')).then(value=>{
    if(currentId!==target||currentHost!==targetHost||generation!==modelCatalogGeneration)throw Error(t("활성 채팅이 변경되었습니다."));
    const payload=value?.[kind]??value?.data??value;
    if(!Array.isArray(payload)){
      const actual=payload===null?'null':typeof payload;
      throw Error(t("잘못된 모델 카탈로그 응답")+' ('+kind+': '+actual+')');
    }
    catalogData[kind]=payload.map(row=>typeof row==='string'?{id:row,name:row}:row).filter(row=>row&&(row.id||row.model));
    const result={...value,kind,[kind]:catalogData[kind]};
    catalogResults[kind]=result;
    return result;
  }).finally(()=>{if(catalogTasks[kind]===request)catalogTasks[kind]=null;});
  catalogTasks[kind]=request;
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
    if(!Array.isArray(value?.skills))throw Error(t("잘못된 모델 카탈로그 응답")+' (skills: '+(value?.skills===null?'null':typeof value?.skills)+')');
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
  node.textContent=state==='stale'?t("캐시된 스킬을 보여줍니다. 백그라운드에서 새로 고쳐집니다."):state==='legacy'?t("이전에 캐시된 스킬을 표시합니다. 백그라운드에서 새로 고쳐집니다."):'';
}
function startCatalog(){
  loadCatalogKind('models').catch(()=>{});
  resetSkillCatalog();loadSkills().catch(()=>{});
}
function resetModelCatalog(){
  modelCatalogGeneration++;catalogData.models=null;catalogResults.models=null;catalogTasks.models=null;
  modelRequest++;modelTarget=null;fastModeControl.reset();$('model-dialog').close();
}
function renderEfforts(){
  const id=$('model-select').value,models=Array.isArray(catalogData?.models)?catalogData.models:[];
  const model=models.find(m=>m.id===(id==='__custom__'?$('custom-model').value.trim():id));
  $('custom-model-label').hidden=id!=='__custom__';$('custom-model').required=id==='__custom__';
  const options=model?.efforts?.length?model.efforts:catalogResults.models?.modelSource==='api'?['none','minimal','low','medium','high','xhigh','max','ultra']:[];
  $('effort-select').replaceChildren(...options.map(value=>new Option(value,value)));
  $('effort-select').value=options.includes(state?.effort)?state.effort:options.includes(model?.defaultEffort)?model.defaultEffort:options[0]||'';
  $('effort-select').disabled=!options.length;
  $('model-description').textContent=!options.length?t("이 모델에 대한 추론 기능을 로드할 수 없습니다. 모델 설정을 다시 엽니다."):model?.description||t("API 서비스는 사용자 정의 모델을 지원해야 합니다.");
  fastModeControl.select(id);$('model-save').disabled=!state?.connected||!id||!options.length;
}
$('model-button').onclick=async()=>{
  if(modelSaving)return;
  $('model-refresh').disabled=true;
  const request=++modelRequest,target=chatKey();modelTarget=target;fastModeControl.reset();
  $('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);
  $('model-error').textContent='';$('model-select').replaceChildren(new Option(t("모델 로드 중…"),''));$('model-save').disabled=true;$('model-dialog').showModal();
  try{
    const catalog=await loadCatalogKind('models',true);
    if(request!==modelRequest||target!==chatKey())return;
    $('model-select').replaceChildren(...(catalog.modelSource==='api'?[new Option(t("업스트림 모델 선택"),'')]:[]),...(Array.isArray(catalog.models)?catalog.models:[]).map(m=>new Option(m.name,m.id)),new Option(t("커스텀 모델…"),'__custom__'));
    const current=state?.model||catalog.currentModel,models=Array.isArray(catalog.models)?catalog.models:[],known=models.some(m=>m.id===current);$('model-select').value=known?current:catalog.modelSource==='api'&&models.length?'':'__custom__';$('custom-model').value=current||'';
    $('model-error').textContent=catalog.modelError?t(catalog.modelError):catalog.modelSource==='api'&&!known&&models.length?t("현재 채팅 모델이 업스트림 목록에 없습니다. 사용 가능한 모델을 선택하고 적용하세요."):'';
    $('model-access').textContent=(catalog.modelAccessName?t("현재 연결:")+catalog.modelAccessName:t("채팅 액세스:")+(state?.provider||''));
    catalog.kind='models';
    fastModeControl.open(catalog,state,$('model-select').value);renderEfforts();
  }catch(e){if(request===modelRequest&&target===chatKey())$('model-error').textContent=t(e.message);}
  finally{if(request===modelRequest)$('model-refresh').disabled=false;}
};
$('model-refresh').onclick=()=>$('model-button').onclick();
$('model-select').onchange=renderEfforts;
$('custom-model').oninput=renderEfforts;
$('model-form').onsubmit=async event=>{
  event.preventDefault();if(modelSaving||modelTarget!==chatKey()||$('model-save').disabled)return;
  const request=modelRequest,target=currentId,host=currentHost;
  const model=$('model-select').value==='__custom__'?$('custom-model').value.trim():$('model-select').value;
  const body={model,effort:$('effort-select').value,...fastModeControl.payload()};
  modelSaving=true;fastModeControl.setBusy(true);$('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=true);$('model-save').disabled=true;$('model-error').textContent='';
  try{
    const result=await api(sessionUrl(target,'settings',host),body);
    if(request===modelRequest&&chatKey(target,host)===chatKey()){$('model-dialog').close();toast(result.confirmed?t('데스크톱 모델 설정이 동기화되었습니다.'):t("데스크톱이 설정을 수락했습니다. 동기화를 기다리는 중"));}
  }catch(e){if(request===modelRequest&&chatKey(target,host)===chatKey())$('model-error').textContent=t(e.message);}
  finally{modelSaving=false;if(request===modelRequest){$('model-form').querySelectorAll('input,select,button').forEach(n=>n.disabled=false);fastModeControl.setBusy(false);renderEfforts();}}
};
function renderSkillPills(){
  $('skill-count').textContent=selectedSkills.size?'('+selectedSkills.size+')':'';
  $('skill-pills').replaceChildren();
  for(const id of selectedSkills){
    const skill=skillIndex.get(id),invalid=invalidSkills.has(id);
    const pill=el('button','skill-pill'+(invalid?' invalid':''),(skill?.displayName||(invalid?t("사용할 수 없는 스킬"):t("선택한 스킬")))+' ×');
    pill.type='button';pill.onclick=()=>{selectedSkills.delete(id);invalidSkills.delete(id);renderSkillPills();renderSkills();};
    $('skill-pills').append(pill);
  }
  if(currentId)sessionStorage.setItem('skills:'+chatKey(),JSON.stringify([...selectedSkills]));
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
      if(input.checked&&selectedSkills.size>=8){input.checked=false;toast("최대 8개 스킬 선택");return;}
      if(input.checked){selectedSkills.add(skill.id);invalidSkills.delete(skill.id);}else selectedSkills.delete(skill.id);
      renderSkillPills();
    };
    const content=el('span');content.append(el('strong','',skill.displayName),el('small','',skill.description));
    label.append(input,content);list.append(label);
  }
  if(!visible.length)list.append(el('p','muted',t("일치하는 기술이 없습니다.")));
}
async function openSkills(refresh=false){
  if(!currentId)return;$('skills-error').textContent='';if(!$('skills-dialog').open)$('skills-dialog').showModal();
  if(catalogData.skills?.length)renderSkills();
  else $('skill-list').textContent=t("설치된 스킬 로드 중…");
  try{await loadSkills({refresh});renderSkills();renderSkillPills();}
  catch(e){
    if(catalogData.skills?.length)renderSkills();
    else $('skill-list').textContent=t("스킬을 로드할 수 없습니다. 다시 시도하려면 새로 고침을 클릭하세요.");
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
function startFromLink(token){return start(token).catch(()=>{if(window.BridgeBootstrap?.failed())return;showLogin();$('login-error').textContent=t("게이트웨이에 연결할 수 없습니다. 연결을 확인하고 다시 로드하세요.");});}
startFromLink(initialPairingToken);initialPairingToken=null;
window.addEventListener('hashchange',()=>{const token=takePairingToken();if(token!==null)startFromLink(token);else if(!$('app').hidden)clientNavigation.openChatLink(location.hash,openChat).catch(error=>toast(error.message));});
function setLanguageBusy(){$('phone-language').disabled=!!(approvalBusy||creatingChat);$('appearance-language').disabled=$('phone-language').disabled;}
$('phone-language').value=BridgeI18n.language();
$('phone-language').onchange=()=>{
  if(approvalBusy||creatingChat)return;
  const replies=[...$('approvals').querySelectorAll('input,textarea,select')].map(node=>({value:node.value,checked:node.checked}));
  BridgeI18n.setLanguage($('phone-language').value);BridgeI18n.apply();accountPanel.render();if(typeof accountsPanel!=="undefined")accountsPanel?.render();renderList();
  if(!$('new-chat-title').dataset.edited)$('new-chat-title').value=t('새 채팅');
  renderLoginStatus();
  for(const id of ['login-error','send-error','model-error','skills-error','new-chat-error','notify-error','rename-error','pushplus-error','toast'])$(id).textContent=t($(id).textContent);
  for(const option of $('new-chat-project').options){const project=newChatProjects.find(p=>p.key===option.value);if(project)option.textContent=project.name+' · '+(project.host==='local'?t('이 컴퓨터'):project.hostLabel);}
  if($('model-select').querySelector('[value=__custom__]'))$('model-select').querySelector('[value=__custom__]').textContent=t("커스텀 모델…");
  if(state){approvalStamp='';renderState(state);[...$('approvals').querySelectorAll('input,textarea,select')].forEach((node,i)=>{if(replies[i]){node.value=replies[i].value;node.checked=replies[i].checked;if(node.tagName==='SELECT')node.dispatchEvent(new Event('change'));}});}
  $('notify-button').textContent=t(notificationState.watching?"알림 켜짐":"알림");
  if(chatTimeline)chatTimeline.relabel();messageActions.relabel();
  window.BridgePresentation?.relabel();workbench.relabel();attachments.render();renderActivity();
  renderSkillPills();if(catalogData)renderSkills();
};
BridgeI18n.apply();

let renameTarget=null,renameBusy=false;
$('rename-chat').onclick=()=>{
  if(!currentId||renameBusy)return;
  renameTarget={id:currentId,host:currentHost};
  $('rename-title').value=state?.title||$('chat-title').textContent;
  $('rename-error').textContent='';$('chat-details-dialog').close();$('rename-dialog').showModal();
};
$('rename-form').onsubmit=async event=>{
  event.preventDefault();if(renameBusy||!renameTarget)return;
  const target=renameTarget,title=$('rename-title').value.trim();
  if(!title)return;
  renameBusy=true;$('rename-save').disabled=true;$('rename-error').textContent='';
  try{
    const result=await api(sessionUrl(target.id,'rename',target.host),{title});
    if(currentId===target.id&&currentHost===target.host){
      if(state)state.title=result.title;
      $('chat-title').textContent=result.title;$('details-title').textContent=result.title;
    }
    $('rename-dialog').close();toast("채팅 이름이 변경되었습니다.");
    await loadList(true);
  }catch(error){$('rename-error').textContent=t(error.message);}
  finally{renameBusy=false;$('rename-save').disabled=false;}
};
let pushplusBusy=false;
function renderPushplus(config){
  $('pushplus-enabled').checked=!!config.pushplusEnabled;
  $('pushplus-token').value='';$('pushplus-clear').checked=false;
  $('pushplus-token').placeholder=t(config.hasPushplusToken?"저장되었습니다. 유지하려면 비워 두세요.":"PushPlus 토큰을 입력하세요");
}
$('pushplus-settings').onclick=async()=>{
  if(pushplusBusy)return;pushplusBusy=true;$('pushplus-settings').disabled=true;
  try{renderPushplus(await api('/api/notifications/pushplus'));$('pushplus-error').textContent='';$('pushplus-dialog').showModal();}
  catch(error){toast(error.message);}
  finally{pushplusBusy=false;$('pushplus-settings').disabled=false;}
};
async function pushplusAction(test){
  if(pushplusBusy)return;pushplusBusy=true;
  for(const id of ['pushplus-save','pushplus-test','pushplus-enabled','pushplus-token','pushplus-clear'])$(id).disabled=true;
  $('pushplus-error').textContent='';
  try{
    if(test){
      await api('/api/notifications/pushplus/test',{});toast("PushPlus가 테스트 알림을 수락했습니다. 휴대전화를 확인하세요.");
    }else{
      renderPushplus(await api('/api/notifications/pushplus',{pushplusEnabled:$('pushplus-enabled').checked,pushplusToken:$('pushplus-token').value.trim(),clearPushplusToken:$('pushplus-clear').checked}));
      toast("PushPlus 설정이 저장되었습니다.");if(currentId)await loadNotificationState(currentId,currentHost);
    }
  }catch(error){$('pushplus-error').textContent=t(error.message);}
  finally{pushplusBusy=false;for(const id of ['pushplus-save','pushplus-test','pushplus-enabled','pushplus-token','pushplus-clear'])$(id).disabled=false;}
}
$('pushplus-form').onsubmit=event=>{event.preventDefault();return pushplusAction(false);};
$('pushplus-test').onclick=()=>pushplusAction(true);

const accountsPanel=window.BridgeSharedRelay||typeof AccountsPanel==='undefined'?null:new AccountsPanel({root:$('accounts-content'),toolbar:$('accounts-heading'),read:()=>api('/api/accounts'),request:({action,...value})=>action==='ignoreSubmission'?ignoreSubmission(value):api(action==='account'?'/api/accounts/account':action==='details'?'/api/accounts/details':action==='reminders'?'/api/accounts/reminders':action==='checkDesktopUpdate'||action==='requestDesktopUpdate'?'/api/accounts/desktop-update':'/api/accounts/switch',action==='checkDesktopUpdate'||action==='requestDesktopUpdate'?{action,...value}:value),onReset:async()=>{$('account-details').open=true;await accountPanel.refresh();$('account-content').querySelector('.account-cards')?.scrollIntoView({block:'nearest'});},onChanged:()=>{accountPanel.clear();resetModelCatalog();},onUpdate:value=>{accountPanel.schedule();const official=value.current?.kind==='chatgpt';$('account-button').hidden=!official;if(!official)$('account-details').open=false;const label="계정";$('accounts-button').setAttribute('data-i18n',label);$('accounts-button').textContent=t(label);}});
function openCurrentAccounts(){
  const provider=clientNavigation.provider;
  if(!provider)return false;
  if(provider==='codex'){
    if(!accountsPanel)return false;
    $('accounts-dialog').showModal();accountsPanel.refresh();return true;
  }
  const name=clientNavigation.clients.find(row=>row.id===provider)?.name||provider;
  const dialog=desktopSessions.dialog("계정 및 연결"),content=el('div','provider-account');
  dialog.append(el('h3','',name),content);
  const panel=new DesktopClientAccountsPanel({root:content,provider,
    read:()=>api('/api/desktop-sessions/'+provider+'/accounts'),
    request:value=>api('/api/desktop-sessions/'+provider+'/accounts',value),
    readModels:()=>api('/api/desktop-sessions/'+provider+'/account'),
    onChanged:(value,previous)=>desktopSessions.accountChanged(provider,previous,value)
  });
  dialog.addEventListener('close',()=>panel.dispose());dialog.showModal();panel.resume();
  return true;
}
$('accounts-button').onclick=openCurrentAccounts;
window.BridgeNavigation={
  accounts:openCurrentAccounts,
  back(){
    const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(dialog){dialog.close();return true;}
    if(clientNavigation.provider!=='codex'){
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
  const id=currentId,host=currentHost,dialog=el('dialog','picker'),head=el('div','picker-head');
  head.append(el('h2','',t("채팅 권한")));const close=el('button','icon-button','×');close.type='button';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>dialog.close();head.append(close);dialog.append(head,el('p','muted',t("저장 후 다음 턴부터 적용")));
  if(state.linuxPermissionChecks===true){
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
    permissionPicker(dialog,{load:()=>api(sessionUrl(id,'permissions',host)),
      save:preset=>api(sessionUrl(id,'permissions',host),{preset,confirmed:preset==='full-access'}),
      isCurrent:()=>currentId===id&&currentHost===host&&state?.connected===true,onSaved:()=>toast('권한이 업데이트되었습니다.')});
    return;
  }
  const error=el('p','error');
  for(const [preset,label,help] of [['ask','승인 요청',"추가 권한이 필요할 때 물어보세요."],['auto-review',"승인해 주세요","Codex는 추가 권한이 필요한 작업을 검토합니다."],['full-access','전체 액세스',"개별 승인 없이 작업 공간 및 네트워크 외부의 파일에 대한 액세스를 허용합니다."]]){
    const button=permissionOption(el('button'),preset,label,help,state.permissionMode===preset);
    button.onclick=async()=>{
      if(preset==='full-access'&&!confirm(t("이 채팅에 컴퓨터 파일 및 네트워크에 대한 전체 액세스를 허용하시겠습니까? 신뢰하는 작업에 대해서만 활성화하세요.")))return;
      dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{const result=await api(sessionUrl(id,'permissions',host),{preset,confirmed:preset==='full-access'});if(result.confirmed){dialog.close();toast('권한이 업데이트되었습니다.');}else error.textContent=t("권한이 제출되었습니다. 데스크톱 확인을 기다리는 중입니다.");}
      catch(e){error.textContent=t(e.message);}finally{dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };dialog.append(button);
  }
  dialog.append(error);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
};

if(accountsPanel){accountsPanel.current.after($('account-details'));}

window.BridgeFileActions?.mountSettings($('appearance-dialog'),value=>api('/api/file-transfer',value));
