'use strict';
class DesktopConnectionsPanel {
  constructor({root,api,feedback}) {
    Object.assign(this,{root,api,feedback,clientsRevision:0,statusRevision:0});
    this.deepseekHome=root.querySelector('[data-deepseek-home]');
    this.deepseekHome.placeholder=this.configurationExample('deepseek');
    const add=document.getElementById('add-client');if(add)add.onclick=()=>this.addClient();
    const refresh=document.getElementById('refresh-clients');if(refresh)refresh.onclick=()=>this.scan(true);
    document.addEventListener('visibilitychange',()=>{this.syncPolling();if(!document.hidden)this.pollClients();});
    root.querySelectorAll('[data-desktop-action]').forEach(button=>button.onclick=()=>button.dataset.desktopAction==='scan'?this.scan(true):this.action(button.dataset.desktopAction));
    root.querySelector('[data-desktop-choose]').onclick=async()=>{try{const path=await api.choose('folder');if(path)this.deepseekHome.value=path;}catch(error){feedback(error.message,true);}};
    document.addEventListener('bridge-language',()=>{this.renderClients();this.renderScan();});
    this.accountPanels={};this.managementPages=new Map();this.removalControls=new Map();
    document.addEventListener('bridge-client-config',event=>{for(const [id,control] of this.removalControls)control.hidden=id!==event.detail;this.ensureAccountPanel(event.detail);this.resumeAccounts();});
  }
  configurationExample(family){
    const windows=this.api.platform==='win32',home=windows?'C:\\Users\\username':this.api.platform==='darwin'?'/Users/username':'/home/username';
    if(family==='claude')return home+(windows?'\\AppData\\Roaming\\Claude':this.api.platform==='darwin'?'/Library/Application Support/Claude':'/.config/Claude');
    return home+(windows?'\\':'/')+(family==='codex'?'.codex':'.dsh');
  }
  ensureAccountPanel(provider){
    if(!['claude','deepseek'].includes(provider)||typeof DesktopClientAccountsPanel==='undefined')return;
    if(this.accountPanels[provider])return this.accountPanels[provider];
    const article=this.root.querySelector('[data-client-config="'+provider+'"]');if(!article)return;
    const content=document.createElement('div');article.querySelector('.client-auto-setup').after(content);
    this.accountPanels[provider]=new DesktopClientAccountsPanel({root:content,provider,desktop:true,
      read:()=>this.api.desktopSessions({action:'accounts',provider,operation:'list'}),
      request:({action,...value})=>this.api.desktopSessions({action:'accounts',provider,operation:action,...value}),
      readModels:(refresh=false)=>this.api.desktopSessions({action:'account',provider,refresh}),
      visible:()=>{
        const page=document.getElementById('clients-page'),client=this.clients?.find(row=>row.id===provider);
        return !document.hidden&&!page.hidden&&(page.classList.contains('configuration-open')
          ?!article.classList.contains('client-config-hidden'):!!(client?.nativeEnabled??client?.enabled));
      },
      onUpdate:value=>this.renderClientAccount(provider,value),onChanged:()=>this.refreshClients(true)});
    return this.accountPanels[provider];
  }
  renderDetails(){
    const value=this.connectionValue;
    const binding=this.root.querySelector('[data-deepseek-binding]');if(binding)binding.textContent=value?.deepseekBinding?.file||'';
    for(const provider of ['deepseek','claude']){
      const client=this.clients?.find(client=>client.id===provider),backend=value?.backends?.[provider],node=this.root.querySelector('[data-desktop-status='+provider+']');
      const reason=(client?this.connection(client).reason:'')||this.statusError||backend?.reason||(backend?(backend.connected?'데스크톱에 연결됨':'연결되지 않음'):'연결 확인 중…');
      node.dataset.i18n=reason;node.textContent=BridgeI18n.t(reason);
    }
    this.root.querySelector('[data-claude-workspace]').textContent=value?.claudeWorkspace||'';
    const home=value?.backends?.claude?.dataHome||'';
    this.root.querySelector('[data-claude-home]').textContent=home;
    this.root.querySelector('[data-claude-data]').hidden=!home;
    const container=this.root.querySelector('[data-client-config="deepseek"] .client-auto-setup');
    if(container){
      let actions=container.querySelector('.deepseek-recovery-actions');if(!actions){actions=document.createElement('div');actions.className='actions deepseek-recovery-actions';container.append(actions);}actions.replaceChildren();
      const client=this.clients?.find(row=>row.id==='deepseek');
      if(client?.backgroundRunning||client?.installed&&client.setupStatus==='failed'){const reconnect=document.createElement('button');reconnect.type='button';reconnect.textContent=BridgeI18n.t('복구 및 다시 연결');reconnect.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();reconnect.onclick=()=>this.recoverDeepseek(true);actions.append(reconnect);}
      if(client?.running){const quit=document.createElement('button');quit.type='button';quit.textContent=BridgeI18n.t('완전히 종료');quit.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();quit.onclick=()=>this.recoverDeepseek(false);actions.append(quit);}
    }
  }
  async refresh(){
    const revision=++this.statusRevision;
    try{
      const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'status'}),{timeout:this.statusTimeout??10000,uncertain:false,message:'클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요.'});if(revision!==this.statusRevision)return;
      this.connectionValue=value;this.statusError='';if(document.activeElement!==this.deepseekHome)this.deepseekHome.value=value.deepseekHome||'';
      this.renderDetails();
    }catch(error){if(revision!==this.statusRevision)return;this.statusError=error.message;this.scanMessage=error.message;this.scanError=true;this.renderScan();this.renderDetails();}
  }
  applyClientSnapshot(value){
    ClientLifecycle.reconcile(this.operationFailures,this.managementClients(value.clients));
    this.clients=value.clients;this.instanceError=value.instanceError||'';
    this.inventoryAvailable=value.inventoryAvailable??this.inventoryAvailable;
    this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.windowsSession=value.windowsSession??this.windowsSession;
  }
  async loadClients(){
    await this.refreshClients();
    if(this.inventoryAvailable===false)await this.scan();
  }
  async refreshClients(refresh=false){
    const root=document.getElementById('client-overview');if(!root||this.scanning||this.choosingClient||(this.busy&&!refresh))return;
    if(this.clientsLoading){await this.clientsLoading;if(refresh)return this.refreshClients(true);return;}
    const revision=this.clientsRevision;
    const pending=(async()=>{
      try{const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'clients',refresh}),{timeout:this.statusTimeout??10000,uncertain:false,message:'클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요.'});if(revision!==this.clientsRevision)return;this.applyClientSnapshot(value);this.renderClients();this.renderScan();}
      catch(error){if(revision!==this.clientsRevision)return;this.scanMessage=error.message;this.scanError=true;this.renderScan();}
    })();
    this.clientsLoading=pending;try{await pending;}finally{if(this.clientsLoading===pending)this.clientsLoading=null;this.renderClients();}
  }
  connection(client){return ClientLifecycle.connection({...client,pendingEnable:this.gatewayRunning!==false&&this.pendingClient?.id===client.id&&this.pendingClient.enabled});}
  managementClients(clients=this.clients||[]){return clients.flatMap(client=>client.id==='codex'&&client.entries?.length?client.entries.map(entry=>({...entry,id:entry.id==='desktop'?'codex':entry.id,parentId:'codex'})):client.id==='claude'&&client.entries?.length?[{...client,enabled:client.nativeEnabled??client.enabled,parentId:'claude'},...client.entries.map(entry=>({...entry,parentId:'claude'}))]:[client]);}
  withClientEnabled(id,enabled){return this.clients.map(client=>{if(client.id==='codex'&&client.entries?.length){const entries=client.entries.map(entry=>(entry.id==='desktop'?'codex':entry.id)===id?{...entry,enabled}:entry);return {...client,entries,desktopEnabled:entries.find(entry=>entry.id==='desktop')?.enabled,enabled:entries.some(entry=>entry.enabled)};}if(client.id==='claude'&&client.entries?.length){const entries=client.entries.map(entry=>entry.id===id?{...entry,enabled}:entry),nativeEnabled=client.id===id?enabled:client.nativeEnabled??client.enabled;return {...client,entries,nativeEnabled,enabled:nativeEnabled||entries.some(entry=>entry.enabled)};}return client.id===id?{...client,enabled}:client;});}
  hasUncertain(){return [...(this.operationFailures?.values()||[])].some(value=>value.uncertain);}
  retryOperation(id){
    const failure=this.operationFailures?.get(id);if(!failure||this.hasUncertain())return;
    if(failure.action==='connect-wsl')return this.connectWsl(id);
    if(typeof failure.recoveryRestart==='boolean')return this.recoverDeepseek(failure.recoveryRestart);
    if(failure.desktopAction)return this.action(failure.desktopAction);
    if(failure.action==='initialize')return id==='claude'?this.action('connect-claude'):this.toggleClient(id,true,{initializeDesktop:true});
    if(id==='zcode'&&failure.action==='enable'&&failure.connectionMode!=='official-remote'&&this.connection(this.managementClients().find(client=>client.id===id)).canInitialize)return this.toggleClient(id,true,{initializeDesktop:true});
    return this.toggleClient(id,failure.action==='enable',{connectionMode:failure.connectionMode});
  }
  syncPolling(){
    const visible=!document.hidden&&!document.getElementById('clients-page').hidden;
    const interval=visible?(this.managementClients().some(client=>this.connection(client).waiting)?2000:15000):0;
    if(interval===(this.pollInterval||0))return;
    clearInterval(this.pollTimer);this.pollInterval=interval;
    if(interval)this.pollTimer=setInterval(()=>this.pollClients(),interval);
  }
  pollClients(fast=false){
    if(document.hidden||document.getElementById('clients-page').hidden||this.hasUncertain()||(fast&&!this.managementClients().some(client=>this.connection(client).waiting)))return;
    return this.refreshClients();
  }
  async scan(manual=false){
    if(this.scanning||this.busy||this.choosingClient)return;this.scanning=true;this.clientsRevision++;this.statusRevision++;this.scanMessage='로컬 클라이언트 검색 중…';this.scanError=false;this.renderScan();
    let gotSnapshot=false;
    try{const value=await this.api.desktopSessions({action:'scan',setup:false,inventoryOnly:!manual});if(value.clients){this.applyClientSnapshot(value);gotSnapshot=true;}this.scanError=!!value.errors?.length;this.scanMessage=this.scanError?value.errors.map(row=>row.distribution+'：'+BridgeI18n.t(row.error)).join('\n'):'스캔이 완료되었습니다. 연결 상태는 아래와 같습니다.';}
    catch(error){this.scanMessage=error.message;this.scanError=true;if(manual)this.feedback(error.message,true);}
    finally{this.scanning=false;this.renderScan();if(gotSnapshot)this.renderClients();else await this.refreshClients(true);await this.refresh();}
    await this.showClaudeSetup(true);
  }
  async showClaudeSetup(automatic=false){
    const client=this.clients?.find(row=>row.id==='claude');
    if(this.claudeSetupOpen||this.busy||this.scanning||this.choosingClient||this.hasUncertain()||!client?.installed||client.setupStatus==='unsupported')return;
    const workspace=this.connectionValue?.claudeWorkspace;if(!workspace)return;
    const key='claude:setup-guide:'+workspace;
    if(automatic&&(!(client.nativeEnabled??client.enabled)||client.connected||this.claudeSetupOffered||localStorage.getItem(key)==='seen'))return;
    this.claudeSetupOpen=true;this.claudeSetupOffered=true;this.choosingClient='claude';this.renderClients();this.renderScan();
    const release=()=>{this.claudeSetupOpen=false;this.choosingClient=null;this.renderClients();this.renderScan();};
    try{
      let value=await this.api.desktopSessions({action:'claude-prerequisites'});
      if(!value.supported){release();return;}
      const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined){n.dataset.i18n=text;n.textContent=BridgeI18n.t(text);}return n;};
      const dialog=node('dialog');dialog.className='client-disable-dialog';
      const title=node('h2','Claude 연결 설정');title.id='claude-setup-title';dialog.setAttribute('aria-labelledby',title.id);
      const intro=node('p','처음 사용하기 전에 다음 단계를 완료하세요. 접근성과 폴더 신뢰는 별도의 권한입니다. 게이트웨이는 폴더 신뢰를 부여하지 않습니다.');
      const permission=node('p'),developer=node('p'),trust=node('p'),reason=node('p');reason.setAttribute('role','status');
      const path=node('p');path.textContent=value.workspace;path.className='mono';
      const actions=node('div');actions.className='client-disable-options';
      const authorize=node('button','접근성 액세스 확인 및 요청'),copy=node('button','연결 폴더 복사'),check=node('button','다시 확인하세요'),start=node('button','연결 초기화'),close=node('button','나중에 설정하세요');
      let busy=false,closed=false,initialize=false;
      const render=()=>{
        permission.hidden=value.platform!=='darwin';authorize.hidden=value.platform!=='darwin';
        permission.textContent=BridgeI18n.t(value.accessibility?.setupState==='ready'?'접근성: 부여됨':'접근성: Claude가 아닌 이 게이트웨이 앱에 대한 액세스 권한을 부여하세요.');
        developer.textContent=BridgeI18n.t(value.developerMode?'개발자 모드: 활성화됨':'개발자 모드: Claude에서 확인');
        trust.textContent=BridgeI18n.t(value.connected?'폴더 신뢰: 현재 연결로 확인됨':'폴더 신뢰: Claude Code에서 아래 폴더를 선택하고 신뢰하는지 확인하세요. 그런 다음 연결 초기화를 클릭합니다.');
        for(const button of [authorize,copy,check,start])button.disabled=busy;
        authorize.disabled=busy||value.accessibility?.setupState==='ready';
        start.disabled=busy||!value.gatewayRunning||value.connected||(value.platform==='darwin'&&value.accessibility?.setupState!=='ready');
        reason.textContent=BridgeI18n.t(!value.gatewayRunning?'이제 권한을 설정할 수 있습니다. 연결을 초기화하기 전에 게이트웨이를 시작하십시오.':value.accessibility?.reason||'');
      };
      const refresh=async requestPermission=>{
        if(busy||closed)return;busy=true;render();
        try{const result=await this.api.desktopSessions({action:'claude-prerequisites',requestPermission});if(!closed)value=result;}
        catch(error){if(!closed)this.feedback(error.message,true);}
        finally{busy=false;if(!closed)render();}
      };
      authorize.onclick=()=>refresh(true);check.onclick=()=>refresh(false);
      copy.onclick=async()=>{try{await this.api.desktopSessions({action:'copy-claude-workspace'});if(!closed)reason.textContent=BridgeI18n.t('연결 폴더가 복사되었습니다.');}catch(error){if(!closed)this.feedback(error.message,true);}};
      start.onclick=()=>{initialize=true;dialog.close();};close.onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{closed=true;localStorage.setItem(key,'seen');dialog.remove();release();if(initialize)this.action('connect-claude');},{once:true});
      for(const button of [authorize,copy,check,start,close])button.type='button';
      actions.append(authorize,copy,check,start,close);dialog.append(title,intro,permission,developer,trust,path,reason,actions);document.body.append(dialog);render();dialog.showModal();close.focus();
    }catch(error){release();this.feedback(error.message,true);}
  }
  renderScan(){
    const node=document.getElementById('client-scan-status');if(node){node.textContent=BridgeI18n.t(this.instanceError||this.scanMessage||(this.visibleClients().some(client=>client.id==='claude')?'연결할 앱을 선택하세요. macOS에서 Claude는 백그라운드에서 시작되어 기존 연결을 복원하려고 시도합니다. 초기화 연결은 확인 후에만 포그라운드를 사용합니다. Windows는 먼저 백그라운드 초기화를 시도합니다.':'기존 클라이언트를 선택하거나 클라이언트 추가를 선택하여 새 클라이언트를 구성합니다.'))+' '+BridgeI18n.t(ClientLifecycle.sessionNotice(this.windowsSession));node.classList.toggle('error',!!this.scanError||!!this.instanceError);}
    const button=document.getElementById('refresh-clients');if(button){button.disabled=!!this.scanning||!!this.busy||!!this.choosingClient;button.dataset.i18n=this.scanning?'스캐닝…':'다시 스캔';button.textContent=BridgeI18n.t(button.dataset.i18n);}
    this.root.querySelectorAll('[data-desktop-action]').forEach(button=>button.disabled=!!this.scanning||!!this.busy||!!this.choosingClient||(button.dataset.desktopAction!=='scan'&&this.hasUncertain()));
  }
  async toggleClient(id,enabled,{initializeDesktop=false,connectionMode}={}){
    const client=this.managementClients().find(row=>row.id===id);
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain()||!client||(enabled&&!(client.selectable??client.configured)))return;
    let choice;
    if(initializeDesktop&&(!enabled||this.gatewayRunning===false||!this.connection(client).canInitialize))return;
    if(initializeDesktop||(!enabled&&this.gatewayRunning!==false&&client.canQuitDesktop!==false)){
      this.choosingClient=id;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
      try{choice=await (initializeDesktop?ClientLifecycle.chooseInitialize(client):ClientLifecycle.chooseDisable(client));}
      finally{this.choosingClient=null;this.renderClients();this.renderScan();}
      if(choice===null||initializeDesktop&&!choice)return;
    }
    const intent={...ClientLifecycle.initializationFields(initializeDesktop&&choice),...(connectionMode?{connectionMode}:{})};
    const acknowledgeUnavailable=!enabled&&choice==='recovery',forceDesktop=choice==='force';
    const quitDesktop=!enabled&&(choice===true||forceDesktop||acknowledgeUnavailable);
    const before=this.clients;
    this.operationFailures??=new Map();this.operationFailures.delete(id);
    this.busy=true;this.pendingClient={id,enabled,quitDesktop,forceDesktop};this.clientsRevision++;this.statusRevision++;
    this.clients=this.withClientEnabled(id,enabled);
    this.renderClients();this.renderScan();
    try{const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'toggle-client',provider:id,enabled,...intent,...(!enabled?{quitDesktop}:{}),...(forceDesktop?{forceDesktop:true,forceConfirmed:true}:{}),...(acknowledgeUnavailable?{acknowledgeUnavailable:true}:{})}),{timeout:this.lifecycleTimeout??45000});if(value.clients)this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.windowsSession=value.windowsSession??this.windowsSession;}
    catch(error){this.operationFailures.set(id,{...ClientLifecycle.failure(initializeDesktop?'initialize':enabled?'enable':forceDesktop?'force':quitDesktop?'quit':'disable',error,'desktop'),connectionMode:intent.connectionMode});this.clients=before;this.feedback(error.message,true);}
    finally{this.busy=false;this.pendingClient=null;this.renderClients();this.renderScan();await this.refreshClients(true);}
  }
  async connectWsl(id){
    const client=this.managementClients().find(row=>row.id===id);
    if(!client||this.busy||this.scanning||this.choosingClient||this.hasUncertain()||this.gatewayRunning===false||!this.connection(client).canConnectWsl)return;
    this.operationFailures??=new Map();this.operationFailures.delete(id);
    this.busy=true;this.connectingWsl=id;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
    try{await ClientLifecycle.connectWsl(client,({action,...fields})=>this.api.cliAccess({action:'wslAccounts',...fields,operation:action}),{timeout:this.lifecycleTimeout??45000});}
    catch(error){this.operationFailures.set(id,ClientLifecycle.failure('connect-wsl',error,'desktop'));this.feedback(error.message,true);}
    finally{this.busy=false;this.connectingWsl=null;this.renderClients();this.renderScan();await this.refreshClients(true);}
  }
  async selectConnectionMode(id,mode){
    const client=this.managementClients().find(row=>row.id===id);
    if(!client||this.busy||this.scanning||this.choosingClient||this.hasUncertain())return;
    this.choosingClient=id;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();let accepted;
    try{accepted=await ClientLifecycle.confirmConnectionMode(client,mode);}finally{this.choosingClient=null;this.renderClients();this.renderScan();}
    if(accepted){await this.toggleClient(id,true,{connectionMode:mode});if(id==='zcode')await this.zcodeOfficial?.refresh();}
  }
  async addClient(){
    let value;try{value=await this.api.desktopSessions({action:'client-profiles',operation:'list'});}catch(error){this.feedback(error.message,true);return;}
    const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';dialog.setAttribute('aria-labelledby','client-add-title');
    const heading=document.createElement('h2');heading.id='client-add-title';heading.textContent=BridgeI18n.t('클라이언트 추가');dialog.append(heading);
    const actions=document.createElement('div');actions.className='actions';
    for(const [family,label] of [['codex','Codex'],['claude','Claude'],['deepseek','DSH'],['zcode','ZCode'],['antigravity','Antigravity']]){
      const capability=value.capabilities?.find(row=>row.family===family),button=document.createElement('button');button.type='button';button.textContent=label;
      button.disabled=capability?.supported!==true;button.title=BridgeI18n.t(capability?.reason||'');
      if(family==='zcode'&&button.disabled)button.textContent+=' · '+BridgeI18n.t(capability?.kind==='default-application'?'이미 추가됨':'기본 연결만');
      button.onclick=()=>{if(button.disabled)return;dialog.close();return this.clientProfile(family,capability);};actions.append(button);
    }
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent=BridgeI18n.t('취소');cancel.onclick=()=>dialog.close();actions.append(cancel);dialog.append(actions);
    dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();cancel.focus();
  }
  codexProfile(){return this.clientProfile('codex');}
  async clientProfile(family,capability){
    const label=({codex:'Codex',claude:'Claude',deepseek:'DSH',zcode:'ZCode',antigravity:'Antigravity'})[family];if(!label)return;
    try{if(!capability)capability=(await this.api.desktopSessions({action:'client-profiles',operation:'list'})).capabilities?.find(row=>row.family===family);}
    catch(error){this.feedback(error.message,true);return;}
    if(capability?.supported!==true){this.feedback(BridgeI18n.t(capability?.reason||'없는'),true);return;}
    const kind=capability.kind,application=kind==='default-application',t=BridgeI18n.t,dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
    const title=document.createElement('h2');title.textContent=t('Codex 클라이언트 추가').replace('Codex',label);
    const form=document.createElement('form'),nameLabel=document.createElement('label'),homeLabel=document.createElement('label');
    form.className='client-config-form';nameLabel.textContent=t('클라이언트 이름');homeLabel.textContent=application?t('적용경로'):t('Codex 구성 디렉터리').replace('Codex',label);
    const name=document.createElement('input'),home=document.createElement('input');name.required=true;name.maxLength=80;name.value=t('독립적인 Codex 구성').replace('Codex',label);home.required=true;home.placeholder=application?t('애플리케이션을 선택하거나 전체 경로를 입력하세요.'):this.configurationExample(family);nameLabel.append(name);homeLabel.append(home);
    const help=document.createElement('p');help.className='hint';help.textContent=application?(family==='antigravity'?t('설치된 Antigravity 앱, IDE 또는 공식 agy 프로그램을 선택하고 네이티브 계정과 채팅을 유지하세요.'):t('설치된 ZCode 애플리케이션을 선택한 다음 연결 방법을 선택하고 관리 페이지에서 활성화하세요.')):t('이 컴퓨터에서 독립적인 Codex 구성 디렉터리를 선택합니다. 해당 계정과 채팅은 기본 연결과 함께 유지됩니다.').replaceAll('Codex',label);
    const localHelp=help.textContent,wslSupported=this.api.platform==='win32'&&capability.wslSupported===true&&['codex','claude'].includes(family);
    const environmentLabel=document.createElement('label'),environment=document.createElement('select'),distributionLabel=document.createElement('label'),distribution=document.createElement('input'),userLabel=document.createElement('label'),user=document.createElement('input');
    environmentLabel.textContent=t('런타임 환경');for(const [value,text] of [['local','이 컴퓨터'],['wsl','WSL']]){const option=document.createElement('option');option.value=value;option.textContent=t(text);environment.append(option);}environment.value='local';environmentLabel.append(environment);
    distributionLabel.textContent=t('WSL 분포');distribution.required=true;distribution.maxLength=256;distribution.placeholder='Ubuntu-24.04';distributionLabel.append(distribution);
    userLabel.textContent=t('Linux 사용자');user.required=true;user.maxLength=256;user.placeholder='username';userLabel.append(user);
    const isWsl=()=>wslSupported&&environment.value==='wsl',drafts={local:'',wsl:''};let previousEnvironment='local';
    const actions=document.createElement('div');actions.className='actions';
    const choose=document.createElement('button'),scan=document.createElement('button'),save=document.createElement('button'),cancel=document.createElement('button');
    choose.type=scan.type=cancel.type='button';save.type='submit';choose.textContent=t(application?'애플리케이션 선택':'폴더 선택');scan.textContent=t('구성 검색');scan.hidden=application;save.textContent=t('설정 저장');cancel.textContent=t('닫기');
    const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');
    const candidates=document.createElement('div');candidates.className='client-config-candidates';let busy=false,closed=false;
    const updateEnvironment=()=>{const selected=isWsl();distributionLabel.hidden=userLabel.hidden=!selected;distribution.disabled=user.disabled=!selected||busy;environment.disabled=busy;choose.hidden=selected;scan.hidden=application||selected;if(wslSupported)homeLabel.firstChild.textContent=selected?t('Linux 구성 디렉터리'):t('Codex 구성 디렉터리').replace('Codex',label);home.placeholder=selected?'/home/'+(user.value.trim()||'username')+(family==='codex'?'/.codex':'/.claude'):application?t('애플리케이션을 선택하거나 전체 경로를 입력하세요.'):this.configurationExample(family);help.textContent=selected?t('실행 중인 WSL 배포, Linux 사용자 및 기존 구성 디렉터리를 입력합니다. 저장하면 디렉터리만 확인됩니다. 배포가 중지된 것으로 감지되면 먼저 배포를 시작하라는 메시지가 표시됩니다.'):localHelp;};
    environment.onchange=()=>{drafts[previousEnvironment]=home.value;previousEnvironment=environment.value;home.value=drafts[previousEnvironment]||'';candidates.replaceChildren();error.textContent='';updateEnvironment();};user.oninput=updateEnvironment;updateEnvironment();
    const run=async task=>{if(busy||closed)return;busy=true;error.textContent='';for(const b of [choose,scan,save])b.disabled=true;updateEnvironment();try{await task();}catch(e){if(!closed)error.textContent=t(e.message);}finally{busy=false;for(const b of [choose,scan,save])b.disabled=false;updateEnvironment();}};
    choose.onclick=()=>run(async()=>{const path=await this.api.choose(application?'file':'folder');if(path&&!closed)home.value=path;});
    scan.onclick=()=>run(async()=>{const value=await this.api.desktopSessions({action:'client-profiles',operation:'scan',family,kind});if(closed)return;candidates.replaceChildren();const rows=(value.candidates||[]).filter(row=>row.family===family&&row.kind===kind);if(!rows.length){candidates.textContent=t('새 구성 디렉터리를 찾을 수 없습니다. 폴더를 선택하거나 경로를 입력하세요.');return;}for(const row of rows){const button=document.createElement('button');button.type='button';button.textContent=row.home;button.onclick=()=>{home.value=row.home;name.value=row.label;};candidates.append(button);}});
    form.onsubmit=event=>{event.preventDefault();return run(async()=>{const value=await this.api.desktopSessions({action:'client-profiles',operation:'save',family,kind:isWsl()?'wsl-cli':kind,...(isWsl()?{distribution:distribution.value,user:user.value,home:home.value,label:name.value}:application?{application:home.value}:{home:home.value,label:name.value})});if(closed)return;dialog.close();await this.refreshClients(true);this.feedback(t('Codex 클라이언트가 저장되었습니다.').replace('Codex',label));if(value.instance?.id)await this.manageClient(this.managementClients().find(row=>row.id===value.instance.id)||value.instance);});};
    cancel.onclick=()=>dialog.close();actions.append(choose,scan,save,cancel);form.append(...(wslSupported?[environmentLabel]:[]),...(application?[]:[nameLabel]),...(wslSupported?[distributionLabel,userLabel]:[]),homeLabel,help,candidates,error,actions);dialog.append(title,form);dialog.addEventListener('close',()=>{closed=true;dialog.remove();});document.body.append(dialog);dialog.showModal();
    home.focus();
  }
  visibleClients(){
    return this.managementClients().filter(client=>client.installed||client.cliAvailable||client.configured||client.enabled||client.connected||client.running||client.kind==='desktop-profile'||client.bindingMode==='manual');
  }
  renderClients(){
    this.renderDetails();
    const root=document.getElementById('client-overview'),t=BridgeI18n.t;if(!root||!this.clients)return;
    const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=t(text);return n;};
    const table=node('table',undefined,'connection-table'),head=node('thead'),tr=node('tr'),body=node('tbody');
    for(const title of ['클라이언트','앱 제어','연결','계정/남은 사용량','관리'])tr.append(node('th',title));head.append(tr);table.append(head,body);
    for(const client of this.visibleClients()){
      const row=node('tr'),identity=node('td'),name=node('div',undefined,'connection-name'),logo=node('span',undefined,'client-logo');row.dataset.clientId=client.id;if(client.parentId)row.dataset.clientParent=client.parentId;
      const img=node('img');img.src='../web/client-icons/'+(client.icon||client.id)+'.png';img.alt='';logo.append(img);
      const label=node('div');label.append(node('strong',client.name),node('small',client.description|| (client.kind==='wsl-claude-cli'?'WSL Claude Code':client.kind==='wsl-cli'?'WSL Codex CLI':({codex:'Codex Desktop',claude:'Claude Desktop',deepseek:'DeepSeek Harness',antigravity:'Google Antigravity'})[client.id])));name.append(logo,label);identity.append(name);
      const access=node('td'),toggle=node('input');toggle.type='checkbox';toggle.className='client-toggle';toggle.checked=client.enabled;toggle.disabled=(!client.enabled&&!(client.selectable??client.configured))||this.scanning||this.busy||!!this.choosingClient;toggle.setAttribute('aria-label',t('할 수 있게 하다')+' '+client.name);toggle.title=t(client.reason);toggle.onchange=()=>this.toggleClient(client.id,toggle.checked);access.append(toggle,node('small',this.pendingClient?.id===client.id?(this.gatewayRunning===false?'절약…':this.pendingClient.enabled?(client.id==='claude'?'연결 중…':'앱을 여는 중…'):this.pendingClient.forceDesktop?'백그라운드에서 강제 종료 중…':this.pendingClient.quitDesktop?'앱을 종료하는 중…':'액세스를 비활성화하는 중…'):client.setupStatus==='unsupported'?'없는':client.enabled?(this.gatewayRunning===false?'게이트웨이로 시작':'사용'):!client.installed&&!client.configured?'설정 필요':'사용 안 함'));
      toggle.disabled=toggle.disabled||this.hasUncertain();const state=this.connection(client),failure=this.operationFailures?.get(client.id),status=node('td'),stateLabel=node('span',state.label,state.waiting?'state-pending client-connection-waiting':state.ready?'state-ready':state.error?'state-error':state.action?'state-pending':'');if(state.modeLabel)stateLabel.textContent+=' · '+BridgeI18n.t(state.modeLabel);stateLabel.setAttribute('role','status');stateLabel.setAttribute('aria-busy',String(state.waiting));status.append(stateLabel,node('small',failure?ClientLifecycle.failureMessage(failure):state.reason));
      const account=node('td');account.dataset.clientAccount=client.id;
      if(client.id!=='codex')account.append(node('span',client.configured?'구성됨':'설정 필요'),node('small',client.accountNotice|| (client.kind==='codex-local'?'독립적으로 계정을 관리하고 API':['wsl-cli','wsl-claude-cli'].includes(client.kind)?'이 게이트웨이에서 WSL 계정 및 API를 관리하세요.':'게이트웨이에서 계정 및 API를 관리하세요.')));
      const actions=node('td'),buttons=node('div',undefined,'connection-actions'),manage=node('button',client.setupStatus==='unsupported'?'세부정보 보기':client.configured?'관리':'구성');
      if(!failure&&(state.canConnectWsl||this.connectingWsl===client.id)&&this.gatewayRunning!==false){const connect=node('button',this.connectingWsl===client.id?'연결 중입니다. 잠시 기다려 주세요…':'WSL 시작 및 연결','primary');connect.type='button';connect.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();connect.onclick=()=>this.connectWsl(client.id);buttons.append(connect);}
      if(failure){const retry=node('button',failure.uncertain?'새로고침 상태':ClientLifecycle.retryLabel(failure.action),'primary');retry.type='button';retry.disabled=this.busy||this.scanning||!!this.choosingClient||!!this.clientsLoading||(!failure.uncertain&&this.hasUncertain());retry.onclick=()=>failure.uncertain?this.refreshClients(true):this.retryOperation(client.id);buttons.append(retry);}
      if(!failure&&state.retryable&&this.gatewayRunning!==false){const retry=node('button','연결 재시도','primary');retry.type='button';retry.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();retry.onclick=()=>this.toggleClient(client.id,true);buttons.append(retry);}
      if(!failure?.uncertain&&client.id==='zcode'&&state.canInitialize&&this.gatewayRunning!==false){
        const initialize=node('button',state.initializeLabel);initialize.type='button';initialize.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();initialize.onclick=()=>this.toggleClient(client.id,true,{initializeDesktop:true});buttons.append(initialize);
      }
      if(!failure&&client.id==='deepseek'&&client.backgroundRunning&&(!client.mainRunning||['restart-required','failed'].includes(client.setupStatus))){
        const recover=node('button','복구 및 다시 연결','primary');recover.type='button';recover.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();recover.onclick=()=>this.recoverDeepseek(true);buttons.append(recover);
      }else if(!failure&&this.gatewayRunning!==false&&client.id==='deepseek'&&['restart-required','needs-first-launch'].includes(client.setupStatus)){
        const restart=client.setupStatus==='restart-required',connect=node('button',restart?'다시 시작 및 연결':'열기 및 연결','primary');connect.type='button';connect.disabled=!!this.busy||!!this.scanning||!!this.choosingClient||this.hasUncertain();connect.onclick=()=>this.action(restart?'restart-deepseek':'connect-deepseek');buttons.append(connect);manage.textContent=t('관리');manage.className='connection-secondary';
      }
      if(!failure&&this.gatewayRunning!==false&&client.id==='claude'&&client.installed&&!client.connected&&client.setupStatus!=='unsupported'){
        const restart=client.setupStatus==='restart-required',pending=state.waiting;
        const connect=node('button',pending?'연결 취소':restart?'다시 시작 및 연결':client.setupStatus==='needs-trust'?'Claude 연결 설정':client.setupStatus==='needs-permission'?'승인 및 연결':['needs-developer-mode','needs-trust','needs-unlock','needs-desktop','needs-retry'].includes(client.setupStatus)?'초기화 재시도':'연결 초기화',pending?'':'primary');
        connect.type='button';connect.disabled=!!this.busy||!!this.scanning||!!this.choosingClient||this.hasUncertain();connect.onclick=()=>this.action(pending?'cancel-claude':restart?'restart-claude':client.setupStatus==='needs-trust'?'setup-claude':'connect-claude');buttons.append(connect);manage.textContent=t('세부정보 보기');manage.className='connection-secondary';
      }
      if(client.id==='claude'&&!client.connected&&client.canConfirmQuit){
        const quit=node('button','Claude 종료…');quit.type='button';quit.disabled=!!this.busy||!!this.scanning;quit.onclick=()=>this.quitClaude();buttons.append(quit);
      }
      if(!client.enabled&&client.running&&client.canQuitDesktop!==false&&this.gatewayRunning!==false){const quit=node('button','데스크톱 앱 닫기…');quit.type='button';quit.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();quit.onclick=()=>this.toggleClient(client.id,false);buttons.append(quit);}
      manage.type='button';manage.onclick=()=>this.manageClient(client);buttons.append(manage);actions.append(buttons);row.append(identity,access,status,account,actions);body.append(row);
    }
    root.replaceChildren(this.visibleClients().length?table:node('p','클라이언트를 찾을 수 없습니다. 클라이언트를 추가하거나 다시 검사하세요.','hint'));this.renderAccount(this.accountValue);
    for(const [provider,panel] of Object.entries(this.accountPanels)){this.renderClientAccount(provider,panel.value);}
    for(const [id,panel] of this.connectionModePanels||[])panel.render(this.managementClients().find(row=>row.id===id));
    this.resumeAccounts();this.onClientsRendered?.();this.syncPolling();
  }
  async manageClient(client){
    const layout=window.GatewayLayout,request=this.managementRequest=(this.managementRequest||0)+1;
    try{
      if(!layout.hasClient(client.id)){
        const wsl=['wsl-cli','wsl-claude-cli'].includes(client.kind);
        if(wsl&&typeof WslAccountsPanel==='undefined')await window.loadWslAccounts();
        if(request!==this.managementRequest)return;
        const page=layout.clientPage(client.id),article=document.createElement('article'),title=document.createElement('h2'),description=document.createElement('p'),notice=document.createElement('p'),content=document.createElement('div');
        title.textContent=client.name;description.textContent=BridgeI18n.t(client.description||'');notice.textContent=BridgeI18n.t(client.configurationNotice||'');notice.hidden=!client.configurationNotice;article.append(title,description,notice,content);page.append(article);
        if(ClientLifecycle.connectionModes(client).length>1)this.mountConnectionModes(article,content,client);
        if(client.id==='zcode')this.mountZcodeOfficial(article,content);
        if(wsl){
          const provider=client.kind==='wsl-claude-cli'?'claude':'codex',entry=client.id;
          const panel=new WslAccountsPanel({root:content,provider,desktop:true,
            read:selected=>this.api.cliAccess({action:'wslAccounts',provider,entry:selected,operation:'list'}),
            request:({action,provider:_provider,entry:_entry,...fields})=>this.api.cliAccess({action:'wslAccounts',provider,entry,operation:action,...fields})});
          this.managementPages.set(entry,{panel,open:()=>panel.select(entry)});
        }else if(client.capabilities?.accounts===true){
          const provider=client.family||client.id,entry=client.kind==='desktop-profile'?client.id:null,scope=entry?{entry}:{},panel=new DesktopClientAccountsPanel({root:content,provider,desktop:true,
            read:()=>this.api.desktopSessions({action:'accounts',provider,...scope,operation:'list'}),
            request:({action,provider:_provider,entry:_entry,...value})=>this.api.desktopSessions({action:'accounts',provider,...scope,operation:action,...value}),
            readModels:refresh=>this.api.desktopSessions({action:'account',provider,...scope,refresh}),
            visible:()=>!document.hidden&&!page.hidden&&!page.classList.contains('client-config-hidden'),
            onUpdate:value=>this.renderClientAccount(client.id,value),onChanged:()=>this.refreshClients(true)});
          this.accountPanels[client.id]=panel;this.managementPages.set(client.id,{panel,open:()=>panel.resume()});
        }
        if(client.id==='antigravity'&&client.capabilities?.management===true){
          const native=document.createElement('section'),accounts=this.managementPages.get(client.id);article.append(native);
          this.mountAntigravityManagement(native,client);
          const management=this.managementPages.get(client.id);
          if(accounts)this.managementPages.set(client.id,{panel:accounts.panel,open:()=>{accounts.open();return management.open();}});
        }
      }
      if(['codex-local','desktop-profile'].includes(client.kind))this.mountClientRemoval(layout.clientPage(client.id),client);
      layout.selectClient(client.id);this.managementPages.get(client.id)?.open();
      if(client.id==='zcode')await this.zcodeOfficial?.refresh();
    }catch(error){this.feedback(error.message,true);}
  }
  mountClientRemoval(page,client){
    if(this.removalControls.has(client.id))return;
    const section=document.createElement('article'),hint=document.createElement('p'),button=document.createElement('button');
    hint.className='hint';hint.dataset.i18n='이 클라이언트를 제거하면 게이트웨이에서만 등록이 취소됩니다. 해당 애플리케이션, 계정, 채팅 및 구성 파일은 보존됩니다.';hint.textContent=BridgeI18n.t(hint.dataset.i18n);
    button.type='button';button.dataset.i18n='이 클라이언트 구성 제거';button.textContent=BridgeI18n.t(button.dataset.i18n);button.onclick=()=>this.removeClient(client.id);
    section.dataset.removeClient=client.id;section.append(hint,button);page.append(section);this.removalControls.set(client.id,section);
  }
  async removeClient(id){
    if(this.busy||this.scanning||this.removingClient)return;
    const client=this.managementClients().find(row=>row.id===id);if(!client||!['codex-local','desktop-profile'].includes(client.kind))return;
    if(client.enabled){this.feedback(BridgeI18n.t('구성을 제거하기 전에 이 클라이언트에 대한 모바일 액세스를 비활성화하십시오.'),true);return;}
    if(!window.confirm(BridgeI18n.t('이 클라이언트 구성을 삭제하시겠습니까? 해당 애플리케이션, 계정, 채팅 및 구성 파일은 보존됩니다.')+'\n'+client.name))return;
    this.removingClient=id;const control=this.removalControls.get(id),button=control?.querySelector('button');if(button)button.disabled=true;
    try{
      await this.api.desktopSessions({action:'client-profiles',operation:'remove',family:client.family||'codex',entry:id,confirmed:true});
      this.accountPanels[id]?.dispose();delete this.accountPanels[id];this.managementPages.delete(id);control?.remove();this.removalControls.delete(id);
      window.GatewayLayout.forgetClient(id);await this.refreshClients(true);this.feedback(BridgeI18n.t('클라이언트 구성이 제거됨'));
    }catch(error){this.feedback(error.message,true);}
    finally{this.removingClient=null;if(button)button.disabled=false;}
  }
  mountConnectionModes(article,before,client){
    const section=document.createElement('section');section.className='accounts-panel';section.dataset.clientConnectionModes=client.id;article.insertBefore(section,before);
    const methods=ClientLifecycle.mountConnectionModes(section);
    const render=value=>methods.update(value,{disabled:this.busy||this.scanning||!!this.choosingClient||this.hasUncertain(),select:mode=>this.selectConnectionMode(client.id,mode)});
    this.connectionModePanels??=new Map();this.connectionModePanels.set(client.id,{render});render(client);
  }
  mountAntigravityManagement(root,client){
    const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=BridgeI18n.t(text);return n;};
    root.className='accounts-panel';root.dataset.antigravityManagement='';
    const heading=node('div',undefined,'accounts-toolbar'),refresh=node('button','다시 불러오기');refresh.type='button';heading.append(node('h3','모델과 채팅'),refresh);
    const status=node('p',undefined,'account-muted'),error=node('p',undefined,'error'),plugin=node('p',undefined,'account-muted');status.setAttribute('role','status');error.setAttribute('role','alert');
    const form=node('div',undefined,'cli-access-form'),field=(title,control)=>{const label=node('label');label.append(node('span',title),control);form.append(label);control.setAttribute('aria-label',BridgeI18n.t(title));};
    const source=node('select'),session=node('select'),permission=node('select'),modelRoot=node('div');field('세션 소스',source);field('채팅',session);form.append(modelRoot);field('승인방법',permission);
    const modelActions=node('div',undefined,'actions'),saveModel=node('button','애플리케이션 모델'),savePermission=node('button','신청 승인 방법');for(const b of [saveModel,savePermission])b.type='button';modelActions.append(saveModel,savePermission);
    const help=node('p','구성은 선택한 소스의 이 채팅에만 적용됩니다. 모델은 원래 클라이언트에서 가져옵니다. 승인을 위해서는 게이트웨이를 로드하기 위한 원래 세션이 필요합니다. Hook。계정 액세스는 위에서 관리됩니다.。','account-muted');root.append(heading,status,error,plugin,form,modelActions,help);
    let value=null,busy=false,stale=true,picker;
    const currentSource=()=>value?.surfaces?.find(row=>row.id===source.value),currentSession=()=>currentSource()?.sessions?.find(row=>row.id===session.value);
    const option=(label,id)=>{const n=node('option',label);n.value=id;return n;};
    const updateModel=()=>{saveModel.disabled=busy||stale||!value?.enabled||!currentSource()?.connected||!currentSession()||!picker?.valid()||picker.selection().model===currentSession()?.model;};
    picker=new window.BridgeCreationModelPicker({root:modelRoot,cache:new Map(),namespace:()=>[client.id,source.value],onChange:updateModel,fallbackCapabilities:{manualModels:true,manualEffort:false,effort:false}});
    picker.manualModel.placeholder=BridgeI18n.t('완전한 기본 모델 식별（예: MODEL_PLACEHOLDER_M525');
    const render=()=>{
      const origin=currentSource(),row=currentSession(),enabled=value?.enabled===true;
      status.textContent=BridgeI18n.t(busy?'읽기 구성…':origin?(origin.historyAvailable?'원주민 역사 사용 가능':'지역 기록을 찾을 수 없습니다.')+' · '+(origin.connected?'기본 서비스가 연결되었습니다':'기본 서비스가 연결되지 않았습니다'):'');
      plugin.textContent=BridgeI18n.t(value?.plugin?.active?'게이트웨이 Hook 활성화됨; 승인 및 대기열은 원래 세션이 로드된 후에 사용할 수 있습니다.。':value?.plugin?.enabled?'게이트웨이 Hook 이미 설치되어 있습니다. 액세스를 활성화한 후에 적용됩니다.。':'사용 Antigravity 접속 후 게이트웨이를 설치하고 활성화할 수 있습니다. Hook。');
      source.disabled=refresh.disabled=busy;session.disabled=busy||!origin?.sessions?.length;
      picker.setBusy(busy||stale||!enabled||!origin?.connected||!row);
      permission.disabled=busy||stale||!enabled||!row||value?.plugin?.active!==true;
      savePermission.disabled=permission.disabled||permission.value===row?.permissionMode;
      updateModel();
    };
    const selectSession=async()=>{const row=currentSession(),surface=source.value,sid=session.value;permission.replaceChildren(...(value?.permissionOptions||[]).map(o=>option(o.label,o.value)));permission.value=row?.permissionMode||'desktop';const same=picker.scope===JSON.stringify([surface,sid]);if(!same)picker.clear();render();if(!row||!value?.enabled||!currentSource()?.connected)return;
      await picker.load(JSON.stringify([surface,sid]),async refresh=>({...await this.api.desktopSessions({action:'antigravity-management',operation:'catalog',surface,sessionId:sid,refresh}),currentModel:row.model||''}),same);};
    const selectSource=async()=>{const rows=currentSource()?.sessions||[],previous=session.value;session.replaceChildren(...rows.map(row=>option(row.title||'새 채팅',row.id)));session.value=rows.some(row=>row.id===previous)?previous:rows[0]?.id||'';await selectSession();};
    const read=async()=>{value=await this.api.desktopSessions({action:'antigravity-management',operation:'list'});stale=false;const previous=source.value;source.replaceChildren(...(value.surfaces||[]).map(row=>option(row.name,row.id)));source.value=value.surfaces?.some(row=>row.id===previous)?previous:value.surfaces?.find(row=>row.historyAvailable)?.id||value.surfaces?.[0]?.id||'';};
    const run=async task=>{if(busy)return;busy=true;error.textContent='';render();let ok=false;try{await task();ok=true;}catch(e){stale=true;error.textContent=BridgeI18n.t(e.message);}finally{busy=false;render();}return ok;};
    const reload=async()=>{if(await run(read))await selectSource();};
    refresh.onclick=reload;source.onchange=selectSource;session.onchange=selectSession;permission.onchange=render;
    const save=async operation=>{const button=operation==='settings'?saveModel:savePermission;if(button.disabled)return;const choice=operation==='settings'?picker.selection():{mode:permission.value};if(await run(async()=>{const result=await this.api.desktopSessions({action:'antigravity-management',operation,surface:source.value,sessionId:session.value,id:crypto.randomUUID(),...choice});if(result.status!=='accepted')throw Error(result.message||'구성 결과를 확인해야 합니다. 다시 로드하세요.');await read();this.feedback(BridgeI18n.t('설정이 저장되었습니다.'));}))await selectSource();};
    saveModel.onclick=()=>save('settings');savePermission.onclick=()=>save('access');
    this.managementPages.set(client.id,{open:reload});render();
  }
  mountZcodeOfficial(article,before){
    const node=(tag,text,cls='')=>{const value=document.createElement(tag);value.className=cls;if(text!==undefined)value.textContent=BridgeI18n.t(text);return value;};
    const section=node('section',undefined,'accounts-panel'),heading=node('div',undefined,'account-heading');section.dataset.zcodeOfficial='';
    const title=node('h3','공식 원격 연결(실험적)'),refresh=node('button','새로고침 상태','accounts-refresh');heading.append(title,refresh);
    const help=node('p','이 컴퓨터에서 ZCode와 동일한 공식 계정을 사용하고 원래 앱에서 웹 원격 제어를 활성화하십시오. 채팅 데이터는 ZCode의 공식 릴레이를 통해 전달됩니다.','account-muted');
    const guide=node('details',undefined,'notification-guide guide-more');guide.dataset.zcodeOfficialGuide='';guide.open=true;
    const steps=node('ol',undefined,'setup-steps');
    for(const [title,description] of [
      ['ZCode를 시작하고 로그인하세요.','이 컴퓨터에서 ZCode를 열고 공식 계정에 로그인하세요. API 키는 이 로그인을 대체하지 않습니다.'],
      ['모바일 리모콘 열기','ZCode 좌측 하단의 모바일 리모콘을 열고 리모콘을 활성화한 후 이 컴퓨터의 연결 링크를 복사하세요.'],
      ['공식 원격 링크 저장','아래의 공식 원격 링크에 링크를 붙여넣은 후 연결 설정 저장을 클릭하세요.'],
      ['게이트웨이에서 동일한 계정으로 로그인하세요.','공식 계정에 로그인을 클릭하세요. 원본 앱과 동일한 공식 사이트 및 로그인 방법을 사용하고, 동일한 계정인지 확인하세요.'],
      ['공식 리모콘 연결','공식 리모컨 연결을 클릭하고 연결 방법을 확인하세요. 로그인만으로는 연결이 설정되지 않습니다.'],
      ['게이트웨이를 시작하고 휴대폰을 연결하세요','게이트웨이가 중지된 경우 개요에서 게이트웨이 시작을 클릭합니다. 실행 중인 경우 다시 시작할 필요가 없습니다. 그런 다음 모바일 앱이나 웹에서 이 게이트웨이에 연결하세요.'],
      ['연결 성공 확인','게이트웨이에 공식 원격 연결됨이 표시되어야 하며 왼쪽 하단에 있는 ZCode의 원격 제어 표시기가 녹색으로 바뀌어야 합니다. 노란색은 시작, 연결 또는 대기를 의미합니다. 빨간색은 오류를 나타냅니다.']
    ]){const item=node('li');item.append(node('strong',title),node('p',description));steps.append(item);}
    guide.append(node('summary','최초 연결 단계'),steps,node('p','원래 앱의 녹색 표시기는 연결된 다른 터미널을 반영할 수 있습니다. 또한 이 게이트웨이의 연결 상태를 확인하세요.','hint'));
    const status=node('p'),reason=node('p',undefined,'hint'),saved=node('p',undefined,'hint');status.setAttribute('role','status');reason.setAttribute('role','status');saved.setAttribute('role','status');
    const label=node('label'),link=node('input');link.type='url';link.autocomplete='off';link.spellcheck=false;link.maxLength=4096;link.placeholder=BridgeI18n.t('이 컴퓨터의 웹 원격 제어 링크를 붙여넣으세요.');label.append(node('span','공식 원격 링크'),link);
    const actions=node('div',undefined,'actions'),buttons={};
    for(const [action,text] of [['save','연결 설정 저장'],['login','공식 계정에 로그인'],['connect','공식 리모콘 연결'],['disconnect','공식 리모컨 연결 끊기'],['forget','저장된 공식 로그인 삭제']]){
      const button=node('button',text);button.type='button';button.dataset.officialAction=action;buttons[action]=button;actions.append(button);
    }
    refresh.type='button';section.append(heading,help,guide,status,reason,label,saved,actions);article.insertBefore(section,before);
    let busy=false,pendingAction='',loadedLink='',error='',guidePending=true;
    const panel=this.zcodeOfficial={value:null};
    const render=()=>{
      const value=panel.value,unavailable=!value,edited=link.value.trim()!==loadedLink;
      if(value&&guidePending){guide.open=!value.configured;guidePending=false;}
      status.textContent=value?[(value.configured?BridgeI18n.t('로그인됨')+(value.accountName?' · '+value.accountName:'')+(value.provider?' · '+value.provider:''):BridgeI18n.t('공식 계정에 로그인하지 않음')),
        BridgeI18n.t(value.connected?'공식 원격 연결됨':'공식 원격 연결이 끊어졌습니다.')].join('；'):'';
      reason.textContent=BridgeI18n.t(busy?({state:'상쾌한 상태…',save:'연결 설정 저장 중…',login:'공식 로그인을 여는 중…',connect:'공식 리모컨 연결 중…',disconnect:'공식 리모컨 연결을 끊는 중…',forget:'저장된 공식 로그인 삭제 중…'})[pendingAction]:error||value?.reason||'');reason.className=error?'error':'hint';
      saved.textContent=BridgeI18n.t(edited?'연결 설정에 저장되지 않은 변경사항이 있습니다.':loadedLink?'연결 설정이 저장되었습니다. 인증이 만료되면 다시 로그인하세요.':'이 컴퓨터의 공식 원격 링크를 저장한 다음 로그인하세요.');label.dataset.dirty=String(edited);
      link.disabled=busy;refresh.disabled=busy;for(const button of Object.values(buttons))button.disabled=busy||unavailable;
      buttons.save.disabled=busy||unavailable||!link.value.trim()||!edited;buttons.login.disabled=busy||unavailable||!loadedLink||edited;buttons.connect.disabled=busy||unavailable||!value?.configured||!loadedLink||edited||value?.connected===true;
      buttons.disconnect.disabled=busy||!value?.connected;buttons.forget.disabled=busy||!value?.configured;
    };
    const perform=async action=>{
      if(busy||this.busy||this.scanning||this.choosingClient)return;
      if(action!=='state'&&buttons[action].disabled)return;
      if(action==='connect')return this.selectConnectionMode('zcode','official-remote');
      if(action==='forget'&&!window.confirm(BridgeI18n.t('게이트웨이의 저장된 공식 로그인을 제거하고 공식 원격 연결을 끊으시겠습니까? 저장된 링크, 원래 ZCode 앱의 계정 및 작업은 유지됩니다.')))return;
      const edited=link.value!==loadedLink;busy=true;pendingAction=action;error='';this.busy=true;render();this.renderClients();this.renderScan();
      try{
        const value=await this.api.desktopSessions({action:'zcode-official-'+action,...(['save','login','connect'].includes(action)?{link:link.value.trim()}:{})});
        panel.value=value;if(!edited||['save','forget'].includes(action))link.value=value.link||'';loadedLink=value.link||'';
      }catch(failure){error=failure.message;this.feedback(error,true);panel.value=null;if(action!=='state')try{panel.value=await this.api.desktopSessions({action:'zcode-official-state'});}catch(_){}}
      finally{busy=false;this.busy=false;render();this.renderClients();this.renderScan();}
      if(!['state','login'].includes(action))await this.refreshClients(true);
    };
    for(const [action,button] of Object.entries(buttons))button.onclick=()=>perform(action);
    refresh.onclick=panel.refresh=()=>perform('state');link.oninput=render;render();
  }
  resumeAccounts(){
    if(!document.hidden&&!document.getElementById('clients-page').hidden)
      for(const client of this.clients||[])if(client.nativeEnabled??client.enabled)this.ensureAccountPanel(client.id);
    for(const panel of Object.values(this.accountPanels))panel.resume();
  }
  renderClientAccount(provider,value){
    const cell=document.querySelector('[data-client-account="'+provider+'"]');if(!cell||!value)return;
    const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=BridgeI18n.t(text);return n;};
    const activeIds=new Set(value.activeIds||[value.activeId]),accounts=value.accounts.filter(row=>activeIds.has(row.id));cell.replaceChildren();
    if(!accounts.length)cell.append(node('span',value.current?.name||value.current?.label||'아직 식별되지 않음'));
    for(const row of accounts){
      cell.append(node('span',row.name));const usage=row.usage||row.quota;
      for(const bucket of usage?.limits||[])for(const window of bucket.windows||[]){cell.append(node('small',bucket.name+' · '+(window.remainingPercent==null?BridgeI18n.t('사용할 수 없음'):BridgeI18n.t('남은')+Math.round(window.remainingPercent)+'%')));if(Number.isFinite(window.remainingPercent)){const bar=node('progress','');bar.max=100;bar.value=window.remainingPercent;cell.append(bar);}}
      for(const wallet of usage?.balance?.wallets||[])cell.append(node('small',BridgeI18n.t('계좌잔고')+' · '+wallet.currency+' '+wallet.remaining));
      if(value.capabilities?.quota!==false&&row.canReadQuota!==false&&(row.kind!=='api'||usage?.balance)){const refresh=node('button','남은 할당량 보기');refresh.type='button';refresh.className='quota-link';refresh.disabled=this.accountPanels[provider].busy||this.accountPanels[provider].loading;refresh.onclick=async()=>{refresh.disabled=true;await this.accountPanels[provider].perform({action:'details',id:row.id,refresh:true});this.renderClientAccount(provider,this.accountPanels[provider].value);};cell.append(refresh);}
    }
  }
  renderAccount(value){
    if(value)this.accountValue=value;else value=this.accountValue;
    const cell=document.querySelector('[data-client-account="codex"]');if(!cell)return;cell.replaceChildren();const t=BridgeI18n.t,name=document.createElement('span');name.textContent=value?.current?.name||t('아직 식별되지 않음');cell.append(name);
    const row=value?.loginAccount||value?.accounts?.find(row=>row.id===value.activeId);if(row?.kind!=='chatgpt')return;
    if(row.name&&row.name!==value?.current?.name){const login=document.createElement('small');login.textContent=t('로그인됨')+' · '+row.name;cell.append(login);}
    if(!row.details?.usage||row.details.usage.status==='loading'){const loading=document.createElement('small');loading.textContent=t('사용량 불러오는 중…');cell.append(loading);}
    else if(row.details.usage.status==='error'||!row.details.usage.limits?.length){const notice=document.createElement('small');notice.textContent=t(row.details.usage.error||'아직 사용량 한도를 확인할 수 없습니다.');cell.append(notice);}
    const usage=row.details?.usage;if(usage?.status==='ready'){const credits=document.createElement('small');credits.textContent=t('사용량 재설정')+' · '+(usage.resetCredits?.availableCount??t('사용할 수 없음'));cell.append(credits);}for(const bucket of usage?.limits||[])for(const window of bucket.windows||[]){const note=document.createElement('small');note.textContent=bucket.name+' · '+(window.remainingPercent==null?t('사용할 수 없음'):t('남은')+Math.round(window.remainingPercent)+'%');cell.append(note);if(window.remainingPercent!=null){const bar=document.createElement('progress');bar.max=100;bar.value=window.remainingPercent;cell.append(bar);}}
    const refresh=document.createElement('button');refresh.type='button';refresh.className='quota-link';refresh.textContent=t('남은 할당량 보기');refresh.disabled=usage?.status==='loading';refresh.onclick=async()=>{refresh.disabled=true;try{this.renderAccount(await this.api.accounts({action:'details',id:row.id,section:'usage',refresh:true}));}catch(error){this.feedback(error.message,true);refresh.disabled=false;}};cell.append(refresh);
  }
  async recoverDeepseek(restart){
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain())return;this.busy=true;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();let attempted=false;
    try{
      const preview=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'deepseek-recovery-preview',restart}),{timeout:this.statusTimeout??10000,uncertain:false,message:'클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요.'});
      if(preview.busy)throw Error(preview.message||'DSH에는 아직 실행 중인 작업이 있거나 승인이 보류 중입니다. 먼저 컴퓨터에서 완료하세요.');
      if(!preview.canRecover)throw Error(preview.message||'DSH는 현재 상태에서는 안전하게 복구할 수 없습니다. 컴퓨터에서 확인하고 다시 스캔하세요.');
      const t=BridgeI18n.t,prompt=preview.configurationRepair?[t('이전 연결 디렉터리가 없습니다. 전체 구성이 백업되고 손상된 게이트웨이 항목만 교체되며 DSH가 다시 열립니다.'),preview.oldDirectory+' → '+preview.newDirectory].join('\n\n'):[t(restart?'그러면 DSH 및 해당 백그라운드 프로세스가 종료되고 연결이 업데이트된 다음 다시 열립니다.':'그러면 DSH 및 해당 백그라운드 프로세스가 완전히 종료됩니다.'),t('데스크탑 프로세스:')+(preview.guiCount||0)+' · '+t('백그라운드 프로세스:')+(preview.backgroundCount||0),preview.requiresUnknownConfirmation?t('일부 백그라운드 프로세스의 작업 상태를 확인할 수 없습니다. 계속하면 작업을 확인하고 완료했으며 작업을 저장했음을 확인하게 됩니다.'):t('작업 내용을 저장했는지 확인하세요.')].join('\n\n');
      if(!window.confirm(prompt))return;
      attempted=true;this.operationFailures??=new Map();this.operationFailures.delete('deepseek');
      const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'deepseek-recovery-confirm',token:preview.token,confirmed:true,...(preview.configurationRepair?{confirmConfigurationRepair:true}:{}),...(preview.requiresUnknownConfirmation?{acknowledgeUnknown:true}:{})}),{timeout:this.lifecycleTimeout??45000});
      if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;}this.feedback(restart?(value.clients?.find(row=>row.id==='deepseek')?.connected?'DSH가 다시 연결됨':'Harness가 연결되기를 기다리는 중'):'DSH 완전히 종료');
    }catch(error){if(attempted)this.operationFailures.set('deepseek',{...ClientLifecycle.failure('recover',error,'desktop'),recoveryRestart:restart});this.feedback(error.message,true);}
    finally{this.busy=false;this.renderClients();this.renderScan();await this.refreshClients(true);await this.refresh();}
  }
  async quitClaude(){
    if(this.busy||this.scanning)return;this.busy=true;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
    try{
      const preview=await this.api.desktopSessions({action:'claude-quit-preview'}),t=BridgeI18n.t;
      if(!preview.canQuit)throw Error(t(preview.busy?'작업이 실행 중이거나 확인 대기 중입니다. 앱을 닫거나 다시 시작하기 전에 완료하세요.':'Claude 프로세스를 확인할 수 없습니다. 컴퓨터를 확인하고 다시 시도해 보세요.'));
      const prompt=t(preview.requiresUnknownConfirmation?'Claude 작업 상태를 확인할 수 없습니다. 종료하면 실행 중인 작업이 중단될 수 있습니다. Claude를 확인하고 작업 내용을 저장했는지 확인하세요.':'Claude 데스크톱 앱이 종료됩니다. 작업 내용을 저장했는지 확인하세요.')+'\n\n'+t('Claude Desktop을 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 정말 그만두시겠어요?');
      if(!window.confirm(prompt))return;
      const value=await this.api.desktopSessions({action:'claude-quit-confirm',token:preview.token,confirmed:true,...(preview.requiresUnknownConfirmation?{acknowledgeUnknown:true}:{})});
      if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;}this.feedback('Claude가 종료되었습니다');
    }catch(error){this.feedback(error.message,true);}
    finally{this.busy=false;this.renderClients();this.renderScan();await this.refreshClients(true);await this.refresh();}
  }
  async action(action){
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain())return;
    if(['export-deepseek-plugin','scan-deepseek-plugins','bind-deepseek-plugin','unbind-deepseek-plugin'].includes(action))return this.manualDeepseek(action);
    if(action==='setup-claude')return this.showClaudeSetup();
    if(action==='restart-deepseek'&&!window.confirm(BridgeI18n.t('Harness를 다시 시작하면 현재 세션의 연결이 끊어집니다. 모든 작업을 완료하고 다시 시작을 확인하기 전에 Harness에 작업을 저장하세요.')))return;
    if(action==='restart-claude'&&!window.confirm(BridgeI18n.t('Claude를 다시 시작하면 현재 세션의 연결이 끊어집니다. 모든 작업을 완료하고 다시 시작을 확인하기 전에 작업 내용을 저장하세요.')))return;
    if(['connect-claude','restart-claude'].includes(action)){
      const client=this.clients?.find(row=>row.id==='claude');if(!client)return;
      this.choosingClient='claude';this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();let confirmed=false;
      try{confirmed=await ClientLifecycle.chooseInitialize(client);}finally{this.choosingClient=null;this.renderClients();this.renderScan();}
      if(!confirmed)return;
    }
    const provider=action.endsWith('-claude')?'claude':action.endsWith('-deepseek')?'deepseek':null,operation=['connect-claude','restart-claude'].includes(action)?'initialize':action==='connect-deepseek'?'enable':action;this.operationFailures??=new Map();if(provider)this.operationFailures.delete(provider);
    this.busy=true;this.clientsRevision++;this.statusRevision++;const buttons=this.root.querySelectorAll('button');buttons.forEach(button=>button.disabled=true);this.renderClients();this.renderScan();let rescan=false;
    try{
      const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action,...(['install-deepseek','remove-deepseek'].includes(action)?{home:this.deepseekHome.value.trim()}:{})}),{timeout:this.lifecycleTimeout??45000});
      if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.renderClients();}
      if(['connect-deepseek','restart-deepseek'].includes(action))this.feedback('Harness가 연결되기를 기다리는 중');
      rescan=action==='connect-deepseek'||action==='install-deepseek';
      await this.refreshClients(true);await this.refresh();
    }catch(error){if(provider)this.operationFailures.set(provider,{...ClientLifecycle.failure(operation,error,'desktop'),desktopAction:action});this.feedback(error.message,true);}
    finally{this.busy=false;buttons.forEach(button=>button.disabled=false);this.renderClients();this.renderScan();if(provider&&this.operationFailures.has(provider))await this.refreshClients(true);}
    if(rescan)await this.scan();
  }
  renderPluginCandidates(candidates){
    const root=this.root.querySelector('[data-deepseek-candidates]');root.replaceChildren();
    if(!candidates.length){root.textContent=BridgeI18n.t('커넥터를 찾을 수 없습니다. 먼저 이 Harness 코어에 플러그인을 설치하고 로드하세요.');return;}
    for(const item of candidates){
      const row=document.createElement('p'),button=document.createElement('button'),path=document.createElement('small');
      button.type='button';button.textContent=BridgeI18n.t('프로필 바인딩:')+item.profile;
      button.onclick=()=>{if(!this.busy&&!this.scanning&&!this.hasUncertain())this.manualDeepseek('bind-deepseek-plugin',item.file);};
      path.textContent=item.file;row.append(button,path);root.append(row);
    }
  }
  async manualDeepseek(action,file){
    this.busy=true;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
    try{
      const payload={action};
      if(action==='scan-deepseek-plugins'){
        payload.home=await this.api.choose('folder');if(!payload.home)return;
      }else if(action==='export-deepseek-plugin'){
        payload.destination=await this.api.choose('folder');if(!payload.destination)return;
      }else if(action==='bind-deepseek-plugin'){
        payload.file=file||await this.api.choose('file');if(!payload.file)return;
        const preview=await this.api.desktopSessions({action:'preview-deepseek-plugin',file:payload.file});
        if(!window.confirm(BridgeI18n.t('이 Harness 프로필을 연결하시겠습니까?')+'\n'+preview.profile+'\n'+preview.home+'\n'+BridgeI18n.t('플러그인 버전:')+(preview.plugin?.version||BridgeI18n.t('유산'))+'\n'+BridgeI18n.t('원래 클라이언트를 종료하거나 변경하지 않고 이 게이트웨이만 바인딩합니다.')))return;
        payload.instanceId=preview.instanceId;
      }
      const value=await this.api.desktopSessions(payload);
      if(action==='scan-deepseek-plugins'){this.renderPluginCandidates(value.candidates||[]);return;}
      this.feedback(value.path?BridgeI18n.t('플러그인 패키지가 저장되었습니다:')+value.path+(value.tarPath?' · '+value.tarPath:''):BridgeI18n.t(value.bound?'경계. 계속하려면 DSH 액세스를 활성화하세요.':'수동 바인딩이 제거되었습니다.'));
    }catch(error){this.feedback(error.message,true);}
    finally{this.busy=false;await this.refreshClients(true);await this.refresh();this.renderClients();this.renderScan();}
  }
}

if(typeof module!=='undefined')module.exports={DesktopConnectionsPanel};
