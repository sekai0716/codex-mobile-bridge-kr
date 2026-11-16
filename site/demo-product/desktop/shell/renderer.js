'use strict';
const $=id=>document.getElementById(id),api=window.bridgeDesktop,t=BridgeI18n.t;
let connectionDraft=[],savedConnections='[]',lanDraft=[],savedLan='[]';
let snapshot,dirty=false,loading=false,startingUntil=0,activeTab='overview',savedFields={},feedbackKind='',lastFeedback;
const busyActions=new Set();
let saving=false,startPending=false,stopPending=false,cloudflaredBusy=false,cloudflaredResult=null,cloudflaredProgress=null;
const titles={'desktop-sessions':'데스크톱 세션',harness:"Harness 공식 웹사이트",overview:t('개요'),network:t('네트워크 접속'),devices:t("로그인 및 기기"),notifications:t("알림"),advanced:t("앱 및 유지 관리"),accounts:t("클라이언트 및 연결"),account:t("계정 및 사용량"),updates:t("앱 업데이트"),logs:t("런타임 로그")};
const accountPanel=new AccountPanel({root:$('account-content'),button:$('account-button'),read:refresh=>api.account({action:'read',refresh}),consume:value=>api.account({action:'consume',...value}),onConsumed:()=>{const id=accountsPanel?.value?.activeId;if(id)accountsPanel.perform({action:'details',id,section:'usage',refresh:true});},onHidden:()=>{$('account-details').open=false;},visible:()=>activeTab==='accounts'&&!document.hidden&&$('account-details').open});
const watchPanel=new WatchPanel({root:$('watches'),change:value=>api.notificationWatches(value)});
const harnessPanel=typeof HarnessPanel==='undefined'?null:new HarnessPanel({root:$('harness-panel'),api,t,feedback});
const desktopConnections=typeof DesktopConnectionsPanel==='undefined'?null:new DesktopConnectionsPanel({root:$('desktop-connections'),api,feedback});
function fields(){return [...$('settings').querySelectorAll('input,textarea,select')].filter(node=>!node.closest('#watches')&&!node.closest('#connections')&&!node.closest('#lan-addresses')&&!node.closest('#file-transfer-settings')&&node.id!=='connection-kind');}
function fieldValues(){return Object.fromEntries(fields().map(node=>[node.id,node.type==='checkbox'?node.checked:node.value]));}
function updateDirty(){
  const changed=new Set();
  for(const node of fields())if((node.type==='checkbox'?node.checked:node.value)!==savedFields[node.id])changed.add(moduleName(node.closest('[data-panel]').dataset.panel));
  if(JSON.stringify(connectionDraft)!==savedConnections||JSON.stringify(lanDraft)!==savedLan)changed.add('network');
  dirty=changed.size>0;
  for(const button of document.querySelectorAll('[data-tab]')){
    const unsaved=changed.has(button.dataset.tab);
    button.dataset.dirty=String(unsaved);
    button.setAttribute('aria-label',t(titles[button.dataset.tab])+(unsaved?t(", 저장되지 않은 변경사항"):''));
  }
  document.querySelectorAll('#connections input,#connections select,[data-remove-connection]').forEach(node=>node.disabled=!!snapshot?.runtime.running||busyActions.size>0);
  $('save').disabled=saving||busyActions.size>0;
  $('dirty-dot').hidden=!dirty;
  $('dirty-label').textContent=dirty?t("저장되지 않은 변경사항"):t("설정이 저장되었습니다.");
  $('save-bar').hidden=!dirty;
  document.querySelectorAll('[data-connection-action]').forEach(button=>button.disabled=dirty||busyActions.size>0||(!['inspect','diagnostics','credentials','clearCredentials','tailscaleInspect','tailscaleAuthorize'].includes(button.dataset.connectionAction)&&!connectionDraft.find(c=>c.id===button.dataset.connection)?.enabled));
}
let toastTimer;
function dismissToast(){clearTimeout(toastTimer);$('toast').hidden=true;}
function feedback(text,error=false,kind=''){
  lastFeedback=[text,error,kind];text=t(text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));
  if(kind==='gateway'){
    feedbackKind=kind;$('error').hidden=!error;$('feedback').hidden=error;
    const target=$(error?'error':'feedback');if(target.textContent!==text)target.textContent=text;return;
  }
  clearTimeout(toastTimer);$('toast').hidden=false;$('toast').classList.toggle('is-error',error);
  $('toast-message').textContent=text;$('toast-message').setAttribute('role',error?'alert':'status');
  $('toast-close').setAttribute('aria-label',t("알림 닫기"));
  $('toast-progress').getAnimations().forEach(animation=>animation.cancel());
  $('toast-progress').animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:5000,fill:'forwards'});
  toastTimer=setTimeout(dismissToast,5000);
}
$('toast-close').onclick=dismissToast;
function focusField(node){
  if(!node)return;
  const panel=node.closest('[data-panel]');if(panel)tab(panel.dataset.panel);
  for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  document.querySelectorAll('[aria-invalid="true"]').forEach(item=>item.removeAttribute('aria-invalid'));
  node.setAttribute('aria-invalid','true');node.scrollIntoView({block:'center',behavior:'instant'});node.focus({preventScroll:true});
  node.addEventListener('input',()=>node.removeAttribute('aria-invalid'),{once:true});
}
function unwrapValidation(value){if(value?.validationError)throw Object.assign(Error(value.validationError.message),{validation:value.validationError});return value;}
function showError(error){
  const location=error.validation;
  if(location)focusField($(location.connectionId?'connection-'+location.connectionId+'-'+location.field:location.field));
  feedback(error.message,true);
}

function moduleName(name){return ({account:'accounts','desktop-sessions':'accounts',harness:'accounts',updates:'advanced',logs:'advanced'})[name]||name;}
function tab(name){const requested=name;name=moduleName(name);activeTab=name;
  if(name==='accounts'){desktopConnections?.refresh();desktopConnections?.refreshClients();harnessPanel?.refresh();accountsPanel?.refresh();}
  document.querySelectorAll('[data-panel]').forEach(node=>node.hidden=moduleName(node.dataset.panel)!==name);
  document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('active',node.dataset.tab===name));
  window.GatewayLayout?.tab(name);$('page-title').textContent=t(titles[name]);if(snapshot)updateDirty();if(name==='advanced')loadLogs();if(name==='devices')loadDevices();if(snapshot)renderUpdate();
  if(['desktop-sessions','harness'].includes(requested))document.querySelectorAll('[data-panel="'+requested+'"] > details').forEach(node=>node.open=true);
}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>tab(button.dataset.tab));
document.querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>tab(button.dataset.jump));
$('settings').oninput=$('settings').onchange=()=>{if(snapshot){updateDirty();}};
function renderLan(){
  const rows=[...(snapshot?.networkInterfaces||[])];
  for(const address of lanDraft)if(!rows.some(row=>row.address===address))rows.push({address,name:t('현재는 이용할 수 없습니다')});
  $('lan-addresses').replaceChildren();
  const selected=$('lan-scope').value==='selected';
  for(const row of rows){
    const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');
    label.className='check lan-address';box.type='checkbox';box.dataset.lanAddress=row.address;
    box.checked=!selected||lanDraft.includes(row.address);
    box.disabled=!!snapshot?.runtime.running||!$('lan').checked||!selected;
    text.textContent=row.name+' · '+row.address;
    box.onchange=()=>{lanDraft=box.checked?[...lanDraft,row.address]:lanDraft.filter(address=>address!==row.address);updateDirty();};
    label.append(box,text);$('lan-addresses').append(label);
  }
  if(!rows.length){const note=document.createElement('p');note.className='hint';note.textContent=t("LAN IPv4 주소를 찾을 수 없습니다.");$('lan-addresses').append(note);}
  $('lan-scope').disabled=!!snapshot?.runtime.running||!$('lan').checked;
}
$('lan').onchange=()=>{renderLan();updateDirty();};
$('lan-scope').onchange=()=>{renderLan();updateDirty();};
function input(id,value){$(id).value=value??'';}
function renderGatewayActions(){
  const running=!!snapshot?.runtime.running,starting=startPending||Date.now()<startingUntil;
  for(const id of ['start','clients-start']){const button=$(id);if(button){button.disabled=!snapshot||running||starting||stopPending||cloudflaredBusy;button.setAttribute('aria-busy',String(startPending));}}
  for(const id of ['stop','clients-stop']){const button=$(id);if(button){button.disabled=!running||startPending||stopPending;button.setAttribute('aria-busy',String(stopPending));}}
  if(snapshot)window.GatewayLayout?.update(snapshot,{starting,stopping:stopPending});
}
function render(value,watchRevision=watchPanel.revision){
  if(snapshot&&(snapshot.runtime.instanceId!==value.runtime.instanceId||snapshot.dataDir!==value.dataDir))resetPairing();
  if(snapshot&&snapshot.dataDir!==value.dataDir){resetSecretFields();harnessPanel?.clear();if(activeTab==='accounts')harnessPanel?.refresh();watchPanel.clear();watchRevision=watchPanel.revision;devicesState=null;devicesDirty=false;$('device-list').replaceChildren();$('auto-blocks').replaceChildren();}
  if(snapshot&&(snapshot.runtime.instanceId!==value.runtime.instanceId||snapshot.dataDir!==value.dataDir))accountPanel.clear();
  snapshot=value;const running=value.runtime.running;
  if(running||value.runtime.portOccupied)startingUntil=0;
  const starting=Date.now()<startingUntil;
  if(feedbackKind==='gateway'){
    if(running)feedback(t("게이트웨이가 실행 중입니다."),false,'gateway');
    else if(value.runtime.portOccupied)feedback(t("다른 게이트웨이가 이 포트를 사용하고 있습니다. 런타임 설정을 확인하세요."),true,'gateway');
    else if(starting)feedback(t("게이트웨이 시작 중"),false,'gateway');
    else if(startingUntil)feedback(t("게이트웨이 시작 시간이 초과되었습니다. 런타임 로그를 확인하세요."),true,'gateway');
    else feedback(t('게이트웨이가 중지되었습니다.'),false,'gateway');
  }
  $('status').textContent=running?t("실행 중"):starting?t('시작'):value.runtime.portOccupied?t("사용 중인 포트"):t("중지됨");
  $('status').classList.toggle('running',running);$('sidebar-status').textContent=$('status').textContent;
  renderGatewayActions();
  $('login-summary').textContent=value.auth.mode==='none'?t("비밀번호 없는 액세스"):t("사용자 이름:")+value.auth.username;
  $('credentials').disabled=!value.credentialsAvailable;
  const notificationsEnabled=value.notifications.enabled||value.notifications.barkEnabled||value.notifications.pushplusEnabled;
  const addressReady=value.notifications.addressEnabled&&notificationsEnabled;
  const addressHint=!value.notifications.addressEnabled?t("입장 알림이 꺼져 있습니다. 게이트웨이 시작 및 주소 변경 사항은 귀하에게 전송되지 않습니다."):!notificationsEnabled?t("하나 이상의 알림 채널을 활성화하고 테스트를 보냅니다."):t("입장 알림이 켜져 있습니다. 주소는 게이트웨이 시작 시마다 전송되며 항목이 변경되면 업데이트됩니다. 먼저 휴대폰에서 테스트 배송을 확인하세요.");
  const addressRecords=Object.values(value.addressNotificationStatus?.deliveries||{});
  const addressFailed=addressRecords.some(record=>record.error);
  const securityFailed=Object.values(value.securityNotificationStatus||{}).some(row=>Object.values(row).some(delivery=>delivery?.error));
  $('security-notification-state').textContent=securityFailed?t("차단 알림이 실패했습니다. 자동으로 다시 시도됩니다."):!notificationsEnabled?t("하나 이상의 알림 채널을 활성화하고 테스트를 보냅니다."):'';
  $('address-notification-state').textContent=addressHint+(addressReady&&addressFailed?' '+t("일부 항목 알림이 실패하여 다시 시도됩니다."):'');
  $('update-address-state').hidden=!value.preferences.tunnel;
  $('update-address-state').textContent=addressHint;
  $('notification-summary').textContent=notificationsEnabled?t("활성화됨 ·")+value.watches.length+t("채팅을 시청했습니다"):t("꺼짐");
  $('notification-state').textContent=value.runtime.running&&!value.runtime.supportsNotifications?t("이 게이트웨이 버전은 이전 버전입니다. 알림 지원을 활성화하려면 다시 시작하세요."):t(value.notificationStatus.error)||t("시청 중인 채팅은 전화 페이지가 닫힌 후에도 계속 알림을 보냅니다.");
  for(const [channel,id] of [['ntfy','notification-detail'],['bark','bark-detail'],['pushplus','pushplus-detail']]){
    const status=value.notificationStatus[channel]||(channel==='ntfy'?value.notificationStatus:{});
    $(id).textContent=t(status.error)||(status.lastSent?t("마지막으로 보낸 날짜:")+new Date(status.lastSent*1000).toLocaleString(BridgeI18n.locale()):t("아직 전송된 알림이 없습니다."));
  }
  $('notification-readiness').textContent=!notificationsEnabled?t("알림이 꺼져 있습니다. 설정을 입력하고 저장한 후 테스트 알림을 보냅니다."):!running?t("게이트웨이가 중지되었습니다. 지금 전화 배송을 테스트할 수 있습니다. 채팅 알림을 실행하려면 게이트웨이가 필요합니다."):!value.runtime.supportsNotifications?t("이 게이트웨이 버전은 알림을 지원하지 않습니다. 개요에서 중지했다가 다시 시작한 다음 전화 페이지를 새로 고치세요."):t("게이트웨이가 준비되었습니다. 전화 채팅에서 알림을 열고 채팅 알림을 활성화한 후 저장하세요.");
  $('data-dir').textContent=value.dataDir;
  $('addresses').replaceChildren();
  for(const url of value.urls){const card=document.createElement('div');card.className='address';const text=document.createElement('div'),label=document.createElement('small'),address=document.createElement('strong');const fixed=(value.preferences.connections||[]).some(c=>c.enabled&&url===c.publicUrl+'/');label.textContent=(fixed?t("HTTPS 수정 · 항목 확인"):url.startsWith('https:')?t("임시 HTTPS"):url.includes('127.0.0.1')?t('이 컴퓨터'):t("LAN"))+(running?'':t("· 게이트웨이가 중지되었습니다."));address.textContent=url;text.append(label,address);card.append(text);for(const [name,action] of [[t('복사'),()=>api.copy(url)],[t("열기"),()=>api.open(url)]]){const button=document.createElement('button');button.textContent=name;button.onclick=()=>action().catch(e=>feedback(e.message,true));card.append(button);}if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))appendPairing(card,url,running);$('addresses').append(card);}
  watchPanel.render(value,watchRevision);
  if(!dirty){
    const p=value.preferences,n=value.notifications;
    for(const [id,key] of [['port','port'],['cloudflared','cloudflared'],['codex-home','codexHome'],['ipc-path','ipcPath'],['codex-bin','codexBin']])input(id,p[key]);
    $('auto-start').checked=p.autoStart;$('lan').checked=p.lan;
    $('local-access').checked=p.localAccess!==false;input('lan-scope',p.lanAddresses==null?'all':'selected');
    lanDraft=p.lanAddresses==null?(value.networkInterfaces||[]).map(row=>row.address):[...p.lanAddresses];savedLan=JSON.stringify(lanDraft);
    if(!document.activeElement?.closest('#connections')||JSON.stringify(p.connections||[])!==savedConnections){connectionDraft=JSON.parse(JSON.stringify(p.connections||[]));savedConnections=JSON.stringify(connectionDraft);renderConnections();}
    const fixed=connectionDraft.filter(c=>c.enabled).map(c=>c.publicUrl);
    input('origins',value.origins.filter(o=>!fixed.includes(o)).join('\n'));input('auth-mode',value.auth.mode);input('session-hours',value.auth.sessionHours??12);input('username',value.auth.username);
    $('mobile-enabled').checked=!!n.mobileEnabled;$('mobile-app-links').checked=!!n.mobileAppLinks;
    $('ntfy-enabled').checked=n.enabled;input('ntfy-server',n.server);input('ntfy-topic',n.topic);input('click-base',n.clickBase);$('include-title').checked=n.includeTitle;
    $('bark-enabled').checked=!!n.barkEnabled;input('bark-server',n.barkServer||'https://api.day.app');
    $('pushplus-enabled').checked=!!n.pushplusEnabled;
    $('security-enabled').checked=n.securityEnabled!==false;$('address-enabled').checked=!!n.addressEnabled;input('address-name',n.addressName||'');
    savedFields=fieldValues();
  }
  $('ntfy-token').placeholder=value.notifications.hasToken?t("저장되었습니다. 보관하려면 비워두세요. 서버를 변경하면 삭제됩니다."):t("서버에 인증이 필요한 경우 토큰을 입력하세요.");
  $('bark-key').placeholder=value.notifications.hasBarkKey?t("저장되었습니다. 보관하려면 비워두세요. 서버를 변경하면 삭제됩니다."):t("Bark 앱에서 장치 키를 입력하세요.");
  $('pushplus-token').placeholder=value.notifications.hasPushplusToken?t("저장되었습니다. 유지하려면 비워 두세요."):t("PushPlus 토큰을 입력하세요");
  updateDirty();
  $('network-lock').hidden=!running;
  for(const id of ['lan','local-access','port','connection-kind','add-connection','origins','cloudflared','codex-home','ipc-path','codex-bin'])$(id).disabled=running;
  document.querySelectorAll('[data-connection-field],[data-remove-connection]').forEach(node=>node.disabled=running);
  for(const node of document.querySelectorAll('[data-connection-status]'))node.textContent=t([connectionSetupState.get(node.dataset.connectionStatus),value.externalStatus?.[node.dataset.connectionStatus]?.message].filter(Boolean).map(t).join(' ')||(!running?t(connectionDraft.find(c=>c.id===node.dataset.connectionStatus)?.accessMode==='tailscale'?"연결 설정을 저장한 다음 Tailscale를 감지합니다.":"게이트웨이가 중지되었습니다. 먼저 설정을 저장하고 ZIP 배포를 내보낼 수 있습니다."):t("게이트웨이가 실행 중입니다. 확인을 클릭하여 수정된 항목을 확인합니다.")));
  document.querySelectorAll('[data-pick]').forEach(button=>button.disabled=running);
  renderLan();
  renderCloudflared();
  renderUpdate();
  loadSavedSecrets();
}
let renderedSnapshot='',renderedDirty=false,renderedRevision=-1;
async function refresh(){if(loading||document.hidden)return;loading=true;try{const revision=watchPanel.revision,value=await api.snapshot(),signature=JSON.stringify(value);if(signature!==renderedSnapshot||renderedDirty!==dirty||renderedRevision!==revision||startingUntil){render(value,revision);renderedSnapshot=signature;renderedDirty=dirty;renderedRevision=revision;}}catch(e){feedback(e.message,true);}finally{loading=false;}}
function collect(){return {preferences:{autoStart:$('auto-start').checked,port:Number($('port').value),lan:$('lan').checked,lanAddresses:$('lan-scope').value==='all'?null:[...lanDraft],localAccess:$('local-access').checked,connections:connectionDraft,cloudflared:$('cloudflared').value.trim(),codexHome:$('codex-home').value.trim(),ipcPath:$('ipc-path').value.trim(),codexBin:$('codex-bin').value.trim()},auth:{sessionHours:Number($('session-hours').value),mode:$('auth-mode').value,username:$('username').value.trim(),password:submittedSecret('password')},origins:$('origins').value.split('\n').map(s=>s.trim()).filter(Boolean),notifications:{mobileEnabled:$('mobile-enabled').checked,mobileAppLinks:$('mobile-app-links').checked,securityEnabled:$('security-enabled').checked,addressEnabled:$('address-enabled').checked,addressName:$('address-name').value.trim(),pushplusEnabled:$('pushplus-enabled').checked,pushplusToken:submittedSecret('pushplus-token'),clearPushplusToken:$('clear-pushplus-token').checked,enabled:$('ntfy-enabled').checked,server:$('ntfy-server').value.trim(),topic:$('ntfy-topic').value.trim(),token:submittedSecret('ntfy-token'),clearToken:$('clear-token').checked,barkEnabled:$('bark-enabled').checked,barkServer:$('bark-server').value.trim(),barkKey:submittedSecret('bark-key'),clearBarkKey:$('clear-bark-key').checked,clickBase:$('click-base').value.trim(),includeTitle:$('include-title').checked}};}
$('settings').onsubmit=async event=>{
  event.preventDefault();if(saving||busyActions.size)return;const invalid=[...$('settings').querySelectorAll('input,textarea,select')].find(node=>!node.closest('#file-transfer-settings')&&!node.disabled&&!node.validity.valid&&(!node.closest('.connection-card')||connectionDraft.find(row=>row.id===node.closest('.connection-card').dataset.connectionId)?.enabled));if(invalid){focusField(invalid);feedback(invalid.validationMessage,true);return;}saving=true;$('save').disabled=true;const submitted=fieldValues(),submittedConnections=JSON.stringify(connectionDraft),submittedLan=JSON.stringify(lanDraft);
  try{
    const value=unwrapValidation(await api.save(collect()));savedFields={...submitted};savedConnections=submittedConnections;savedLan=submittedLan;
    // Edits made while saving must remain visibly unsaved.
    for(const id of ['password','ntfy-token','bark-key','pushplus-token'])savedSecretValues.set(id,submitted[id]);
    for(const id of ['clear-token','clear-bark-key','clear-pushplus-token']){if($(id).checked===submitted[id])$(id).checked=false;savedFields[id]=false;}
    await saveAllConnectionCredentials();
    updateDirty();render(value);await loadSavedSecrets(true);
    feedback(dirty?t("제출된 설정이 저장되었습니다. 새로운 수정사항이 아직 저장되지 않았습니다."):t("설정이 저장되었습니다. 게이트웨이는 알림 변경 사항을 자동으로 읽습니다. 로그인 변경 사항은 다음 시작 시 적용됩니다."));
  }catch(e){showError(e);}finally{saving=false;updateDirty();}
};
async function startGateway(){if(cloudflaredBusy||startPending||stopPending||snapshot?.runtime.running||Date.now()<startingUntil)return;if(dirty){feedback(t("게이트웨이를 시작하기 전에 설정을 저장하십시오."),true);return;}startPending=true;renderGatewayActions();try{if(snapshot?.preferences.tunnel){try{await api.checkCloudflared(snapshot.preferences.cloudflared);}catch(error){tab('network');$('cloudflared-repair').open=true;throw error;}}await saveAllConnectionCredentials(true);const result=unwrapValidation(await api.start());startingUntil=result.started?Date.now()+70000:0;feedback(result.message,false,'gateway');await refresh();}catch(e){startingUntil=0;showError(e);}finally{startPending=false;renderGatewayActions();}}
async function stopGateway(){if(startPending||stopPending||!snapshot?.runtime.running)return;stopPending=true;renderGatewayActions();try{feedback((await api.stop()).message,false,'gateway');startingUntil=0;await refresh();}catch(e){feedback(e.message,true);}finally{stopPending=false;renderGatewayActions();}}
for(const id of ['start','clients-start'])if($(id))$(id).onclick=startGateway;
for(const id of ['stop','clients-stop'])if($(id))$(id).onclick=stopGateway;
for(const [id,channel] of [['test-notification','ntfy'],['test-bark','bark'],['test-pushplus','pushplus'],['test-address','address']])$(id).onclick=async()=>{if(dirty){feedback(t("테스트 알림을 보내기 전에 알림 설정을 저장하세요."),true);return;}$(id).disabled=true;try{feedback((await api.testNotification({channel})).message);}catch(e){feedback(e.message,true);}finally{$(id).disabled=false;}};
$('ntfy-help').onclick=()=>api.open('ntfy-help').catch(e=>feedback(e.message,true));
$('bark-help').onclick=()=>api.open('bark-help').catch(e=>feedback(e.message,true));
for(const id of ['project-home'])$(id).onclick=()=>api.open(id).catch(e=>feedback(e.message,true));
for(const id of ['pushplus-home','pushplus-verify','pushplus-limits'])$(id).onclick=()=>api.open(id).catch(e=>feedback(e.message,true));
$('generate-topic').onclick=()=>{input('ntfy-topic','codex-'+crypto.randomUUID().replaceAll('-',''));updateDirty();};
$('credentials').onclick=()=>api.open('credentials').catch(e=>feedback(e.message,true));
$('open-data').onclick=()=>api.open('data').catch(e=>feedback(e.message,true));
$('choose-data').onclick=async()=>{try{if(await api.choose('data')){dirty=false;await refresh();feedback(t("게이트웨이 디렉터리가 변경되었습니다. 이전 게이트웨이 프로세스가 아직 실행 중입니다."));}}catch(e){feedback(e.message,true);}};
for(const button of document.querySelectorAll('[data-pick]'))button.onclick=async()=>{try{const selected=await api.choose(button.dataset.kind);if(selected){input(button.dataset.pick,selected);updateDirty();}}catch(e){feedback(e.message,true);}};
function quickTunnelMessage(){
  if(snapshot?.quickTunnel?.message&&snapshot.runtime.running)return t(snapshot.quickTunnel.message);
  return snapshot?.cloudflared?.available?t("프로그램을 찾았습니다. 설정을 저장하고 게이트웨이를 시작하여 임시 HTTPS를 연결합니다."):t("cloudflared를 찾을 수 없습니다. 먼저 설치 및 설정을 완료하세요.");
}
function renderCloudflared(){
  const current=$('cloudflared').value.trim(),verified=cloudflaredResult?.path===current?cloudflaredResult:null;
  $('cloudflared-state').textContent=verified?verified.version:current===snapshot?.cloudflared?.path&&snapshot?.cloudflared?.available?t("Cloudflare 구성요소가 발견되었습니다. 추가 설치가 필요하지 않습니다. 진단을 실행하려면 고급 설정을 확장하세요."):t("Cloudflare 구성요소를 찾을 수 없습니다. 경로를 확인하거나 설치를 복구하려면 고급 설정을 확장하세요.");
  const progress=cloudflaredProgress||snapshot?.cloudflaredInstall;
  $('cloudflared-progress').hidden=!progress?.message;
  $('cloudflared-progress').textContent=progress?.message?t(progress.message)+(progress.total?' '+Math.floor(100*progress.received/progress.total)+'%':''):'';
  $('install-cloudflared').disabled=cloudflaredBusy||!!snapshot?.runtime.running;
  $('check-cloudflared').disabled=cloudflaredBusy;
  $('choose-data').disabled=cloudflaredBusy;
  const enabled=connectionDraft.some(c=>c.enabled&&c.accessMode==='quick');
  $('quick-tunnel-state').hidden=!enabled;$('quick-setup').hidden=!enabled;
  $('quick-tunnel-state').textContent=quickTunnelMessage();
  document.querySelectorAll('[data-quick-status]').forEach(node=>node.textContent=quickTunnelMessage());
  renderGatewayActions();
}
async function setupCloudflared(install){
  if(cloudflaredBusy)return;
  cloudflaredBusy=true;cloudflaredProgress={message:install?"공식 Cloudflare 릴리스를 가져오는 중…":"cloudflared 확인 중…"};renderCloudflared();
  try{
    // Only fill this field. Other unsaved settings, passwords and tokens remain in the form.
    cloudflaredProgress=null;
    const result=install?await api.installCloudflared():await api.checkCloudflared($('cloudflared').value.trim());
    cloudflaredResult=result;input('cloudflared',result.path);updateDirty();
    cloudflaredProgress={message:install?"cloudflared가 설치되고 확인되었습니다. 게이트웨이를 시작하기 전에 설정을 저장하십시오.":"cloudflared 검사가 통과되었습니다. 경로가 변경된 경우 설정을 저장합니다."};
    feedback(cloudflaredProgress.message);
  }catch(error){cloudflaredProgress={message:error.message};feedback(error.message,true);}
  finally{cloudflaredBusy=false;renderCloudflared();await refresh();}
}
$('install-cloudflared').onclick=()=>setupCloudflared(true);
$('check-cloudflared').onclick=()=>setupCloudflared(false);
$('cloudflare-help').onclick=()=>api.open('cloudflare-help').catch(error=>feedback(error.message,true));
$('quick-setup').onclick=()=>{tab('network');$('cloudflared-repair').open=true;};
$('cloudflared').oninput=()=>{renderCloudflared();updateDirty();};
async function loadLogs(){try{$('log-output').textContent=(await api.logs()).text||t("아직 런타임 로그가 없습니다.");$('log-output').scrollTop=0;}catch(e){feedback(e.message,true);}}
$('refresh-logs').onclick=loadLogs;
for(const id of ['password','ntfy-token','bark-key','pushplus-token'])secretControl($(id));
api.language().then(applyLanguage).catch(error=>feedback(error.message,true)).then(()=>refresh()).then(()=>desktopConnections?.scan()).then(()=>{if(snapshot?.preferences.autoStart&&!snapshot.updateManaged&&!snapshot.runtime.running&&!snapshot.runtime.portOccupied)$('start').click();});
let refreshTimer=setInterval(refresh,3000);
document.addEventListener('visibilitychange',()=>{clearInterval(refreshTimer);refreshTimer=null;if(!document.hidden){refresh();refreshTimer=setInterval(refresh,3000);}});

function applyLanguage(value){
  BridgeI18n.setLanguage(value==='en'?'en':'ko');BridgeI18n.apply();accountPanel.render();if(typeof accountsPanel!=="undefined")accountsPanel?.render();
  $('language').value=BridgeI18n.language();
  document.title=t("Codex 모바일 Bridge");
  if(snapshot){const pending=dirty;dirty=true;render(snapshot);dirty=pending;renderConnections();updateDirty();}
  if(lastFeedback)feedback(...lastFeedback);
  tab(activeTab);
  renderPairing();if(devicesState)renderDevices(devicesState);
}
$('language').value=BridgeI18n.language();
$('language').onchange=async()=>{
  $('language').disabled=true;
  try{applyLanguage(await api.setLanguage($('language').value==='en'?'en':'ko-KR'));}
  catch(error){$('language').value=BridgeI18n.language();feedback(error.message,true);}
  finally{$('language').disabled=false;}
};
BridgeI18n.apply();
$('add-connection').onclick=addConnection;
$('connection-kind').onchange=()=>setupGuide($('connection-guide'),$('connection-kind').value);

const updateMessages={idle:"새 버전을 확인하세요.",checking:'업데이트 확인 중…',current:"사용 가능한 최신 버전이 있습니다.",available:"업데이트를 사용할 수 있습니다.",downloading:'업데이트 다운로드 중…',preparing:'업데이트 확인 및 준비 중…',restarting:"앱을 다시 시작하는 중…",unsupported:"이 시스템이나 이 실행 모드에서는 인앱 업데이트를 사용할 수 없습니다. 릴리스 페이지에서 새 버전을 다운로드하세요."};
let updateBusy=false;
function renderUpdate(){
  const value=snapshot?.update;if(!value)return;
  const busy=['downloading','preparing','restarting'].includes(value.state)||updateBusy;
  $('update-version').textContent=t("현재 버전:")+value.current+(value.version?' → '+value.version:'');
  $('update-state').textContent=value.message?t(value.message):t(updateMessages[value.state]||'');
  $('update-badge').hidden=value.state!=='available';
  $('update-banner').hidden=value.state!=='available'||activeTab==='advanced';
  $('update-banner').textContent=t("업데이트가 가능합니다. 세부정보 보기:")+(value.version||'');
  $('check-update').disabled=busy||value.state==='checking'||value.state==='unsupported';
  $('install-update').hidden=!value.version||['current','unsupported'].includes(value.state);
  $('install-update').disabled=busy||value.state==='checking';
  $('update-notes').hidden=!value.notes;$('update-notes').textContent=value.notes||'';
  $('update-progress').hidden=value.state!=='downloading';
  $('update-progress').value=value.total?100*value.received/value.total:0;
  let result=snapshot.updateResult;
  // A successful record describes the app that was installed at that time.
  // Manual app replacement preserves this data file, so an old success cannot
  // claim that the newly deployed binary is still that older release.
  if(result?.state==='updated'&&result.version!==value.current)result=null;
  $('update-result').hidden=!result;
  $('update-result').textContent=result?(result.state==='updated'?t("업데이트됨")+result.version:result.recovered?t("마지막 업데이트가 실패했습니다. 이전 버전이 복원되었습니다.")+' '+t(result.message):t("복구를 완료할 수 없습니다. 데이터 폴더의 Desktop-update.log를 참조하세요.")):'';
  if(busy){
    $('settings').inert=true;
    for(const id of ['start','stop','choose-data','install-cloudflared'])$(id).disabled=true;
  }else $('settings').inert=false;
}
$('check-update').onclick=async()=>{
  if(updateBusy)return;
  updateBusy=true;renderUpdate();
  try{await api.checkUpdate();await refresh();}
  catch(error){feedback(error.message,true);}
  finally{updateBusy=false;renderUpdate();}
};
$('install-update').onclick=async()=>{
  if(updateBusy)return;
  if(dirty||devicesDirty){feedback("앱을 업데이트하기 전에 설정을 저장하세요.",true);return;}
  if(cloudflaredBusy||startPending||$('save').disabled||busyActions.size){feedback("업데이트하기 전에 현재 작업이 완료될 때까지 기다리십시오.",true);return;}
  updateBusy=true;renderUpdate();
  try{await api.installUpdate();await refresh();}catch(error){feedback(error.message,true);}
  finally{updateBusy=false;renderUpdate();}
};
$('update-releases').onclick=()=>api.open('releases').catch(error=>feedback(error.message,true));

let devicesState=null,devicesDirty=false,devicesBusy=false;
function devicePolicy(){
  const lines=id=>$(id).value.split('\n').map(value=>value.trim()).filter(Boolean);
  return {allowlistEnabled:$('allowlist-enabled').checked,allowlist:lines('ip-allowlist'),blocklist:lines('ip-blocklist'),trustedProxies:lines('trusted-proxies')};
}
function renderDevices(value){
  devicesState=value;
  if(!devicesDirty){
    $('allowlist-enabled').checked=value.policy.allowlistEnabled;
    for(const [id,key] of [['ip-allowlist','allowlist'],['ip-blocklist','blocklist'],['trusted-proxies','trustedProxies']])input(id,value.policy[key].join('\n'));
  }
  $('auto-blocks').replaceChildren();
  if(!value.autoBlocks?.length)$('auto-blocks').textContent=t("자동으로 차단된 IP가 없습니다.");
  for(const block of value.autoBlocks||[]){
    const row=document.createElement('div');row.className='device-row';
    const text=document.createElement('p');text.textContent=block.ip+' · '+new Date(block.blockedAt*1000).toLocaleString(BridgeI18n.locale());
    const button=document.createElement('button');button.type='button';button.textContent=t("차단 해제 및 시도 재설정");button.disabled=devicesBusy;
    button.onclick=()=>{if(devicesDirty){feedback(t("먼저 IP 규칙을 저장하세요."),true);return;}return changeDevices({action:'unblock',ip:block.ip});};row.append(text,button);$('auto-blocks').append(row);
  }
  $('device-list').replaceChildren();
  if(!value.sessions.length)$('device-list').textContent=t("활성 로그인 기록이 없습니다.");
  const date=value=>new Date(value*1000).toLocaleString(BridgeI18n.locale());
  for(const session of value.sessions){
    const row=document.createElement('div');row.className='device-row';
    const address=document.createElement('strong');address.textContent=session.ip;
    const browser=document.createElement('p');browser.textContent=(session.trustedDevice?t("연결된 전화")+' · ':'')+(session.userAgent||t('알 수 없는 브라우저'));
    const detail=document.createElement('p');detail.className='hint';
    detail.textContent=t(session.source==='proxy'?"프록시 IP(클라이언트 주소를 사용할 수 없음)":session.source==='forwarded'?"신뢰할 수 있는 프록시에 의해 전달됨":"직접 연결")+' · '+t("로그인:")+date(session.created)+' · '+t("마지막으로 본 시간:")+date(session.lastSeen)+' · '+t("만료:")+(session.expires?date(session.expires):t("자동 만료 없음"));
    const actions=document.createElement('div');actions.className='actions';
    for(const [label,action] of [['로그인 취소','revoke'],["이 IP 차단",'block'],['허용 목록에 추가','allow']]){
      const button=document.createElement('button');button.type='button';button.textContent=t(action==='revoke'&&session.trustedDevice?"전화 연결 해제":label);button.disabled=devicesBusy;
      button.onclick=()=>{
        if(action==='allow'){
          input('ip-allowlist',[...new Set([...devicePolicy().allowlist,session.ip])].join('\n'));
          devicesDirty=true;$('device-feedback').textContent=t("허용 목록 변경사항이 저장되지 않았습니다.");return;
        }
        if(devicesDirty){feedback(t("먼저 IP 규칙을 저장하세요."),true);return;}
        return changeDevices({action,id:session.id});
      };
      actions.append(button);
    }
    row.append(address,browser,detail,actions);$('device-list').append(row);
  }
}
async function loadDevices(){
  if(devicesBusy)return;
  devicesBusy=true;$('refresh-devices').disabled=true;$('device-policy').inert=true;
  try{renderDevices(await api.devices({action:'list'}));}
  catch(error){feedback(error.message,true);}
  finally{devicesBusy=false;$('refresh-devices').disabled=false;$('device-policy').inert=false;$('save-device-policy').disabled=!devicesState;if(devicesState)renderDevices(devicesState);}
}
async function changeDevices(payload){
  if(devicesBusy)return;
  devicesBusy=true;busyActions.add('devices');$('device-policy').inert=true;$('refresh-devices').disabled=true;
  if(devicesState)renderDevices(devicesState);
  try{
    const value=await api.devices(payload);
    devicesDirty=false;renderDevices(value);
    $('device-feedback').textContent=t(payload.action==='save'?"IP 규칙이 저장되고 적용되었습니다.":payload.action==='block'?"IP가 차단되고 관련 로그인이 취소되었습니다.":payload.action==='unblock'?"IP가 차단 해제되고 남은 시도가 재설정되었습니다.":"로그인이 취소되었습니다.");
  }catch(error){feedback(error.message,true);}
  finally{devicesBusy=false;busyActions.delete('devices');$('device-policy').inert=false;$('refresh-devices').disabled=false;if(devicesState)renderDevices(devicesState);}
}
$('refresh-devices').onclick=loadDevices;
$('device-policy').oninput=$('device-policy').onchange=()=>{devicesDirty=true;$('device-feedback').textContent=t("IP 규칙에 저장되지 않은 변경사항이 있습니다.");};
$('device-policy').onsubmit=event=>{event.preventDefault();return changeDevices({action:'save',policy:devicePolicy()});};

const accountsPanel=typeof AccountsPanel==='undefined'?null:new AccountsPanel({root:$('accounts-content'),desktop:true,read:()=>api.accounts({action:'list'}),request:value=>api.accounts(value),onReset:async()=>{$('account-details').open=true;await accountPanel.refresh();$('account-content').querySelector('.account-cards')?.scrollIntoView({block:'nearest'});},onChanged:()=>accountPanel.clear(),onUpdate:value=>{desktopConnections?.renderAccount(value);accountPanel.schedule();$('account-button').hidden=value.current?.kind!=='chatgpt';if($('account-button').hidden)$('account-details').open=false;}});

$('account-details').ontoggle=()=>{if($('account-details').open)accountPanel.refresh();};

if(accountsPanel){accountsPanel.current.after($('account-details'));}
