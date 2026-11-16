'use strict';
class DesktopConnectionsPanel {
  constructor({root,api,feedback}) {
    Object.assign(this,{root,api,feedback,clientsRevision:0,statusRevision:0});
    this.deepseekHome=root.querySelector('[data-deepseek-home]');
    const refresh=document.getElementById('refresh-clients');if(refresh)refresh.onclick=()=>this.scan(true);
    setInterval(()=>this.pollClients(),15000);setInterval(()=>this.pollClients(true),2000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.pollClients();});
    root.querySelectorAll('[data-desktop-action]').forEach(button=>button.onclick=()=>button.dataset.desktopAction==='scan'?this.scan(true):this.action(button.dataset.desktopAction));
    root.querySelector('[data-desktop-choose]').onclick=async()=>{try{const path=await api.choose('folder');if(path)this.deepseekHome.value=path;}catch(error){feedback(error.message,true);}};
    document.addEventListener('bridge-language',()=>{this.renderClients();this.renderScan();});
    this.accountPanels={};
    if(typeof DesktopClientAccountsPanel!=='undefined')for(const provider of ['claude','deepseek']){
      const article=root.querySelector('[data-client-config="'+provider+'"]');if(!article)continue;
      const content=document.createElement('div');article.querySelector('.client-auto-setup').after(content);
      this.accountPanels[provider]=new DesktopClientAccountsPanel({root:content,provider,desktop:true,
        read:()=>api.desktopSessions({action:'accounts',provider,operation:'list'}),
        request:({action,...value})=>api.desktopSessions({action:'accounts',provider,operation:action,...value}),
        readModels:()=>api.desktopSessions({action:'account',provider}),
        visible:()=>!document.hidden&&!document.getElementById('clients-page').hidden&&(!document.getElementById('clients-page').classList.contains('configuration-open')||!article.classList.contains('client-config-hidden')),
        onUpdate:value=>this.renderClientAccount(provider,value),onChanged:()=>this.refreshClients(true)});
    }
    document.addEventListener('bridge-client-config',()=>this.resumeAccounts());
  }
  renderDetails(){
    const value=this.connectionValue;
    for(const provider of ['deepseek','claude']){
      const client=this.clients?.find(client=>client.id===provider),backend=value?.backends?.[provider],node=this.root.querySelector('[data-desktop-status='+provider+']');
      const reason=(client?this.connection(client).reason:'')||this.statusError||backend?.reason||(backend?(backend.connected?"데스크톱에 연결됨":"연결되지 않음"):"연결 확인 중…");
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
      if(client?.backgroundRunning){const reconnect=document.createElement('button');reconnect.type='button';reconnect.textContent=BridgeI18n.t("복구 및 다시 연결");reconnect.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();reconnect.onclick=()=>this.recoverDeepseek(true);actions.append(reconnect);}
      if(client?.running){const quit=document.createElement('button');quit.type='button';quit.textContent=BridgeI18n.t("완전히 종료");quit.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();quit.onclick=()=>this.recoverDeepseek(false);actions.append(quit);}
    }
  }
  async refresh(){
    const revision=++this.statusRevision;
    try{
      const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'status'}),{timeout:this.statusTimeout??10000,uncertain:false,message:"클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요."});if(revision!==this.statusRevision)return;
      this.connectionValue=value;this.statusError='';if(document.activeElement!==this.deepseekHome)this.deepseekHome.value=value.deepseekHome||'';
      this.renderDetails();
    }catch(error){if(revision!==this.statusRevision)return;this.statusError=error.message;this.scanMessage=error.message;this.scanError=true;this.renderScan();this.renderDetails();}
  }
  async refreshClients(refresh=false){
    const root=document.getElementById('client-overview');if(!root||this.scanning||this.choosingClient||(this.busy&&!refresh))return;
    if(this.clientsLoading){await this.clientsLoading;if(refresh)return this.refreshClients(true);return;}
    const revision=this.clientsRevision;
    const pending=(async()=>{
      try{const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'clients',refresh}),{timeout:this.statusTimeout??10000,uncertain:false,message:"클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요."});if(revision!==this.clientsRevision)return;ClientLifecycle.reconcile(this.operationFailures,value.clients);this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.windowsSession=value.windowsSession??this.windowsSession;this.renderClients();this.renderScan();}
      catch(error){if(revision!==this.clientsRevision)return;this.scanMessage=error.message;this.scanError=true;this.renderScan();}
    })();
    this.clientsLoading=pending;try{await pending;}finally{if(this.clientsLoading===pending)this.clientsLoading=null;this.renderClients();}
  }
  connection(client){return ClientLifecycle.connection({...client,pendingEnable:this.gatewayRunning!==false&&this.pendingClient?.id===client.id&&this.pendingClient.enabled});}
  hasUncertain(){return [...(this.operationFailures?.values()||[])].some(value=>value.uncertain);}
  retryOperation(id){const failure=this.operationFailures?.get(id);if(!failure||this.hasUncertain())return;if(typeof failure.recoveryRestart==='boolean')return this.recoverDeepseek(failure.recoveryRestart);if(failure.desktopAction)return this.action(failure.desktopAction);return failure.action==='initialize'?this.action('connect-claude'):this.toggleClient(id,failure.action==='enable');}
  pollClients(fast=false){
    if(document.hidden||document.getElementById('clients-page').hidden||this.hasUncertain()||(fast&&!this.clients?.some(client=>this.connection(client).waiting)))return;
    return this.refreshClients();
  }
  async scan(manual=false){
    if(this.scanning||this.busy||this.choosingClient)return;this.scanning=true;this.clientsRevision++;this.statusRevision++;this.scanMessage="로컬 클라이언트 검색 중…";this.scanError=false;this.renderScan();
    try{const value=await this.api.desktopSessions({action:'scan',setup:false});if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.renderClients();}this.scanMessage="스캔이 완료되었습니다. 연결 상태는 아래와 같습니다.";}
    catch(error){this.scanMessage=error.message;this.scanError=true;if(manual)this.feedback(error.message,true);}
    finally{this.scanning=false;this.renderScan();await this.refreshClients(true);await this.refresh();}
    await this.showClaudeSetup(true);
  }
  async showClaudeSetup(automatic=false){
    const client=this.clients?.find(row=>row.id==='claude');
    if(this.claudeSetupOpen||this.busy||this.scanning||this.choosingClient||this.hasUncertain()||!client?.installed||client.setupStatus==='unsupported')return;
    const workspace=this.connectionValue?.claudeWorkspace;if(!workspace)return;
    const key='claude:setup-guide:'+workspace;
    if(automatic&&(client.connected||this.claudeSetupOffered||localStorage.getItem(key)==='seen'))return;
    this.claudeSetupOpen=true;this.claudeSetupOffered=true;this.choosingClient='claude';this.renderClients();this.renderScan();
    const release=()=>{this.claudeSetupOpen=false;this.choosingClient=null;this.renderClients();this.renderScan();};
    try{
      let value=await this.api.desktopSessions({action:'claude-prerequisites'});
      if(!value.supported){release();return;}
      const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined){n.dataset.i18n=text;n.textContent=BridgeI18n.t(text);}return n;};
      const dialog=node('dialog');dialog.className='client-disable-dialog';
      const title=node('h2',"Claude 연결 설정");title.id='claude-setup-title';dialog.setAttribute('aria-labelledby',title.id);
      const intro=node('p',"처음 사용하기 전에 다음 단계를 완료하세요. 접근성과 폴더 신뢰는 별도의 권한입니다. 게이트웨이는 폴더 신뢰를 부여하지 않습니다.");
      const permission=node('p'),developer=node('p'),trust=node('p'),reason=node('p');reason.setAttribute('role','status');
      const path=node('p');path.textContent=value.workspace;path.className='mono';
      const actions=node('div');actions.className='client-disable-options';
      const authorize=node('button',"접근성 액세스 확인 및 요청"),copy=node('button',"연결 폴더 복사"),check=node('button',"다시 확인"),start=node('button','연결 초기화'),close=node('button','나중에 설정하세요');
      let busy=false,closed=false,initialize=false;
      const render=()=>{
        permission.hidden=value.platform!=='darwin';authorize.hidden=value.platform!=='darwin';
        permission.textContent=BridgeI18n.t(value.accessibility?.setupState==='ready'?"접근성: 부여됨":"접근성: Claude가 아닌 이 게이트웨이 앱에 대한 액세스 권한을 부여하세요.");
        developer.textContent=BridgeI18n.t(value.developerMode?'개발자 모드: 활성화됨':"개발자 모드: Claude에서 확인");
        trust.textContent=BridgeI18n.t(value.connected?"폴더 신뢰: 현재 연결로 확인됨":"폴더 신뢰: Claude Code에서 아래 폴더를 선택하고 신뢰하는지 확인하세요. 그런 다음 연결 초기화를 클릭합니다.");
        for(const button of [authorize,copy,check,start])button.disabled=busy;
        authorize.disabled=busy||value.accessibility?.setupState==='ready';
        start.disabled=busy||!value.gatewayRunning||value.connected||(value.platform==='darwin'&&value.accessibility?.setupState!=='ready');
        reason.textContent=BridgeI18n.t(!value.gatewayRunning?"이제 권한을 설정할 수 있습니다. 연결을 초기화하기 전에 게이트웨이를 시작하십시오.":value.accessibility?.reason||'');
      };
      const refresh=async requestPermission=>{
        if(busy||closed)return;busy=true;render();
        try{const result=await this.api.desktopSessions({action:'claude-prerequisites',requestPermission});if(!closed)value=result;}
        catch(error){if(!closed)this.feedback(error.message,true);}
        finally{busy=false;if(!closed)render();}
      };
      authorize.onclick=()=>refresh(true);check.onclick=()=>refresh(false);
      copy.onclick=async()=>{try{await this.api.desktopSessions({action:'copy-claude-workspace'});if(!closed)reason.textContent=BridgeI18n.t("연결 폴더가 복사되었습니다.");}catch(error){if(!closed)this.feedback(error.message,true);}};
      start.onclick=()=>{initialize=true;dialog.close();};close.onclick=()=>dialog.close();
      dialog.addEventListener('close',()=>{closed=true;localStorage.setItem(key,'seen');dialog.remove();release();if(initialize)this.action('connect-claude');},{once:true});
      for(const button of [authorize,copy,check,start,close])button.type='button';
      actions.append(authorize,copy,check,start,close);dialog.append(title,intro,permission,developer,trust,path,reason,actions);document.body.append(dialog);render();dialog.showModal();close.focus();
    }catch(error){release();this.feedback(error.message,true);}
  }
  renderScan(){
    const node=document.getElementById('client-scan-status');if(node){node.textContent=BridgeI18n.t(this.scanMessage||"연결할 앱을 선택하세요. macOS에서 Claude는 백그라운드에서 시작되어 기존 연결을 복원하려고 시도합니다. 초기화 연결은 확인 후에만 포그라운드를 사용합니다. Windows는 먼저 백그라운드 초기화를 시도합니다.")+' '+BridgeI18n.t(ClientLifecycle.sessionNotice(this.windowsSession));node.classList.toggle('error',!!this.scanError);}
    const button=document.getElementById('refresh-clients');if(button){button.disabled=!!this.scanning||!!this.busy||!!this.choosingClient;button.textContent=BridgeI18n.t(this.scanning?'스캐닝…':'다시 스캔');}
    this.root.querySelectorAll('[data-desktop-action]').forEach(button=>button.disabled=!!this.scanning||!!this.busy||!!this.choosingClient||(button.dataset.desktopAction!=='scan'&&this.hasUncertain()));
  }
  async toggleClient(id,enabled){
    const client=this.clients?.find(row=>row.id===id);
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain()||!client||(enabled&&!(client.selectable??client.configured)))return;
    let quitDesktop=false;
    if(!enabled&&this.gatewayRunning!==false){
      this.choosingClient=id;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
      try{quitDesktop=await ClientLifecycle.chooseDisable(client);}
      finally{this.choosingClient=null;this.renderClients();this.renderScan();}
      if(quitDesktop===null)return;
    }
    const forceDesktop=quitDesktop==='force';quitDesktop=quitDesktop===true||forceDesktop;
    const before=this.clients;
    this.operationFailures??=new Map();this.operationFailures.delete(id);
    this.busy=true;this.pendingClient={id,enabled,quitDesktop,forceDesktop};this.clientsRevision++;this.statusRevision++;
    this.clients=this.clients.map(client=>client.id===id?{...client,enabled}:client);
    this.renderClients();this.renderScan();
    try{const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'toggle-client',provider:id,enabled,...(!enabled?{quitDesktop}:{}),...(forceDesktop?{forceDesktop:true,forceConfirmed:true}:{})}),{timeout:this.lifecycleTimeout??45000});if(value.clients)this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;this.windowsSession=value.windowsSession??this.windowsSession;}
    catch(error){this.operationFailures.set(id,ClientLifecycle.failure(enabled?'enable':forceDesktop?'force':quitDesktop?'quit':'disable',error,'desktop'));this.clients=before;this.feedback(error.message,true);}
    finally{this.busy=false;this.pendingClient=null;this.renderClients();this.renderScan();await this.refreshClients(true);}
  }
  renderClients(){
    this.renderDetails();
    const root=document.getElementById('client-overview'),t=BridgeI18n.t;if(!root||!this.clients)return;
    const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=t(text);return n;};
    const table=node('table',undefined,'connection-table'),head=node('thead'),tr=node('tr'),body=node('tbody');
    for(const title of ['고객',"앱 제어","연결","계정/남은 사용량",'관리하다'])tr.append(node('th',title));head.append(tr);table.append(head,body);
    for(const client of this.clients){
      const row=node('tr'),identity=node('td'),name=node('div',undefined,'connection-name'),logo=node('span',undefined,'client-logo');
      const img=node('img');img.src='../web/client-icons/'+client.id+'.png';img.alt='';logo.append(img);
      const label=node('div');label.append(node('strong',client.name),node('small',({codex:'Codex Desktop',claude:'Claude Desktop',deepseek:'DeepSeek Harness'})[client.id]));name.append(logo,label);identity.append(name);
      const access=node('td'),toggle=node('input');toggle.type='checkbox';toggle.className='client-toggle';toggle.checked=client.enabled;toggle.disabled=(!client.enabled&&!(client.selectable??client.configured))||this.scanning||this.busy||!!this.choosingClient;toggle.setAttribute('aria-label',t("할 수 있게 하다")+' '+client.name);toggle.title=t(client.reason);toggle.onchange=()=>this.toggleClient(client.id,toggle.checked);access.append(toggle,node('small',this.pendingClient?.id===client.id?(this.gatewayRunning===false?"저장 중…":this.pendingClient.enabled?(client.id==='claude'?'연결 중…':"앱을 여는 중…"):this.pendingClient.forceDesktop?"백그라운드에서 강제 종료 중…":this.pendingClient.quitDesktop?"앱을 종료하는 중…":"액세스를 비활성화하는 중…"):client.setupStatus==='unsupported'?"없는":client.enabled?(this.gatewayRunning===false?"게이트웨이로 시작":"사용 중"):!client.installed&&!client.configured?"설정 필요":"사용 안 함"));
      toggle.disabled=toggle.disabled||this.hasUncertain();const state=this.connection(client),failure=this.operationFailures?.get(client.id),status=node('td'),stateLabel=node('span',state.label,state.waiting?'state-pending client-connection-waiting':client.connected?'state-ready':state.error?'state-error':state.action?'state-pending':'');stateLabel.setAttribute('role','status');stateLabel.setAttribute('aria-busy',String(state.waiting));status.append(stateLabel,node('small',failure?ClientLifecycle.failureMessage(failure):state.reason));
      const account=node('td');account.dataset.clientAccount=client.id;
      if(client.id!=='codex')account.append(node('span',client.configured?"구성됨":"설정 필요"),node('small',client.id==='claude'?"Claude에서 계정 관리":"Harness의 계정 / API 관리"));
      const actions=node('td'),buttons=node('div',undefined,'connection-actions'),manage=node('button',client.setupStatus==='unsupported'?"세부정보 보기":client.configured?'관리하다':"구성");
      if(failure){const retry=node('button',failure.uncertain?"상태 새로고침":ClientLifecycle.retryLabel(failure.action),'primary');retry.type='button';retry.disabled=this.busy||this.scanning||!!this.choosingClient||!!this.clientsLoading||(!failure.uncertain&&this.hasUncertain());retry.onclick=()=>failure.uncertain?this.refreshClients(true):this.retryOperation(client.id);buttons.append(retry);}
      if(!failure&&state.retryable&&this.gatewayRunning!==false){const retry=node('button','연결 재시도','primary');retry.type='button';retry.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();retry.onclick=()=>this.toggleClient(client.id,true);buttons.append(retry);}
      if(!failure&&client.id==='deepseek'&&client.backgroundRunning&&(!client.mainRunning||['restart-required','failed'].includes(client.setupStatus))){
        const recover=node('button',"복구 및 다시 연결",'primary');recover.type='button';recover.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();recover.onclick=()=>this.recoverDeepseek(true);buttons.append(recover);
      }else if(!failure&&this.gatewayRunning!==false&&client.id==='deepseek'&&['restart-required','needs-first-launch'].includes(client.setupStatus)){
        const restart=client.setupStatus==='restart-required',connect=node('button',restart?"다시 시작 및 연결":"열기 및 연결",'primary');connect.type='button';connect.disabled=!!this.busy||!!this.scanning||!!this.choosingClient||this.hasUncertain();connect.onclick=()=>this.action(restart?'restart-deepseek':'connect-deepseek');buttons.append(connect);manage.textContent=t('관리하다');manage.className='connection-secondary';
      }
      if(!failure&&this.gatewayRunning!==false&&client.id==='claude'&&client.installed&&!client.connected&&client.setupStatus!=='unsupported'){
        const restart=client.setupStatus==='restart-required',pending=state.waiting;
        const connect=node('button',pending?'연결 취소':restart?"다시 시작 및 연결":client.setupStatus==='needs-trust'?"Claude 연결 설정":client.setupStatus==='needs-permission'?'승인 및 연결':['needs-developer-mode','needs-trust','needs-unlock','needs-desktop','needs-retry'].includes(client.setupStatus)?'초기화 재시도':'연결 초기화',pending?'':'primary');
        connect.type='button';connect.disabled=!!this.busy||!!this.scanning||!!this.choosingClient||this.hasUncertain();connect.onclick=()=>this.action(pending?'cancel-claude':restart?'restart-claude':client.setupStatus==='needs-trust'?'setup-claude':'connect-claude');buttons.append(connect);manage.textContent=t("세부정보 보기");manage.className='connection-secondary';
      }
      if(client.id==='claude'&&!client.connected&&client.canConfirmQuit){
        const quit=node('button',"Claude 종료…");quit.type='button';quit.disabled=!!this.busy||!!this.scanning;quit.onclick=()=>this.quitClaude();buttons.append(quit);
      }
      if(!client.enabled&&client.running&&this.gatewayRunning!==false){const quit=node('button',"데스크톱 앱 닫기…");quit.type='button';quit.disabled=this.busy||this.scanning||!!this.choosingClient||this.hasUncertain();quit.onclick=()=>this.toggleClient(client.id,false);buttons.append(quit);}
      manage.type='button';manage.onclick=()=>window.GatewayLayout.selectClient(client.id);buttons.append(manage);actions.append(buttons);row.append(identity,access,status,account,actions);body.append(row);
    }
    root.replaceChildren(table);this.renderAccount(this.accountValue);
    for(const [provider,panel] of Object.entries(this.accountPanels)){this.renderClientAccount(provider,panel.value);}
    this.resumeAccounts();
  }
  resumeAccounts(){for(const panel of Object.values(this.accountPanels))panel.resume();}
  renderClientAccount(provider,value){
    const cell=document.querySelector('[data-client-account="'+provider+'"]');if(!cell||!value)return;
    const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=BridgeI18n.t(text);return n;};
    const activeIds=new Set(value.activeIds||[value.activeId]),accounts=value.accounts.filter(row=>activeIds.has(row.id));cell.replaceChildren();
    if(!accounts.length)cell.append(node('span',value.current?.name||value.current?.label||"아직 확인되지 않음"));
    for(const row of accounts){
      cell.append(node('span',row.name));const usage=row.usage||row.quota;
      for(const bucket of usage?.limits||[])for(const window of bucket.windows||[]){cell.append(node('small',bucket.name+' · '+(window.remainingPercent==null?BridgeI18n.t("사용할 수 없음"):BridgeI18n.t("남은")+Math.round(window.remainingPercent)+'%')));if(Number.isFinite(window.remainingPercent)){const bar=node('progress','');bar.max=100;bar.value=window.remainingPercent;cell.append(bar);}}
      for(const wallet of usage?.balance?.wallets||[])cell.append(node('small',BridgeI18n.t('계좌잔고')+' · '+wallet.currency+' '+wallet.remaining));
      if(row.kind!=='api'||usage?.balance){const refresh=node('button',"남은 할당량 보기");refresh.type='button';refresh.className='quota-link';refresh.disabled=this.accountPanels[provider].busy||this.accountPanels[provider].loading;refresh.onclick=async()=>{refresh.disabled=true;await this.accountPanels[provider].perform({action:'details',id:row.id,refresh:true});this.renderClientAccount(provider,this.accountPanels[provider].value);};cell.append(refresh);}
    }
  }
  renderAccount(value){
    if(value)this.accountValue=value;else value=this.accountValue;
    const cell=document.querySelector('[data-client-account="codex"]');if(!cell)return;cell.replaceChildren();const t=BridgeI18n.t,name=document.createElement('span');name.textContent=value?.current?.name||t("아직 확인되지 않음");cell.append(name);
    const row=value?.accounts?.find(row=>row.id===value.activeId);if(row?.kind!=='chatgpt')return;
    const usage=row.details?.usage;if(usage?.status==='ready'){const credits=document.createElement('small');credits.textContent=t("사용량 재설정")+' · '+(usage.resetCredits?.availableCount??t("사용할 수 없음"));cell.append(credits);}for(const bucket of usage?.limits||[])for(const window of bucket.windows||[]){const note=document.createElement('small');note.textContent=bucket.name+' · '+(window.remainingPercent==null?t("사용할 수 없음"):t("남은")+Math.round(window.remainingPercent)+'%');cell.append(note);if(window.remainingPercent!=null){const bar=document.createElement('progress');bar.max=100;bar.value=window.remainingPercent;cell.append(bar);}}
    const refresh=document.createElement('button');refresh.type='button';refresh.className='quota-link';refresh.textContent=t("남은 할당량 보기");refresh.disabled=usage?.status==='loading';refresh.onclick=async()=>{refresh.disabled=true;try{this.renderAccount(await this.api.accounts({action:'details',id:row.id,section:'usage',refresh:true}));}catch(error){this.feedback(error.message,true);refresh.disabled=false;}};cell.append(refresh);
  }
  async recoverDeepseek(restart){
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain())return;this.busy=true;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();let attempted=false;
    try{
      const preview=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'deepseek-recovery-preview',restart}),{timeout:this.statusTimeout??10000,uncertain:false,message:"클라이언트 상태를 제때 읽을 수 없습니다. 다시 새로고침해 보세요."});
      if(preview.busy)throw Error(preview.message||"DSH에는 아직 실행 중인 작업이 있거나 승인이 보류 중입니다. 먼저 컴퓨터에서 완료하세요.");
      if(!preview.canRecover)throw Error(preview.message||"DSH는 현재 상태에서는 안전하게 복구할 수 없습니다. 컴퓨터에서 확인하고 다시 스캔하세요.");
      const t=BridgeI18n.t,prompt=[t(restart?"그러면 DSH 및 해당 백그라운드 프로세스가 종료되고 연결이 업데이트된 다음 다시 열립니다.":"그러면 DSH 및 해당 백그라운드 프로세스가 완전히 종료됩니다."),t("데스크탑 프로세스:")+(preview.guiCount||0)+' · '+t("백그라운드 프로세스:")+(preview.backgroundCount||0),preview.requiresUnknownConfirmation?t("일부 백그라운드 프로세스의 작업 상태를 확인할 수 없습니다. 계속하면 작업을 확인하고 완료했으며 작업을 저장했음을 확인하게 됩니다."):t("작업 내용을 저장했는지 확인하세요.")].join('\n\n');
      if(!window.confirm(prompt))return;
      attempted=true;this.operationFailures??=new Map();this.operationFailures.delete('deepseek');
      const value=await ClientLifecycle.request(()=>this.api.desktopSessions({action:'deepseek-recovery-confirm',token:preview.token,confirmed:true,...(preview.requiresUnknownConfirmation?{acknowledgeUnknown:true}:{})}),{timeout:this.lifecycleTimeout??45000});
      if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;}this.feedback(restart?(value.clients?.find(row=>row.id==='deepseek')?.connected?"DSH가 다시 연결됨":"Harness가 연결되기를 기다리는 중"):"DSH 완전히 종료");
    }catch(error){if(attempted)this.operationFailures.set('deepseek',{...ClientLifecycle.failure('recover',error,'desktop'),recoveryRestart:restart});this.feedback(error.message,true);}
    finally{this.busy=false;this.renderClients();this.renderScan();await this.refreshClients(true);await this.refresh();}
  }
  async quitClaude(){
    if(this.busy||this.scanning)return;this.busy=true;this.clientsRevision++;this.statusRevision++;this.renderClients();this.renderScan();
    try{
      const preview=await this.api.desktopSessions({action:'claude-quit-preview'}),t=BridgeI18n.t;
      if(!preview.canQuit)throw Error(t(preview.busy?"작업이 실행 중이거나 확인 대기 중입니다. 앱을 닫거나 다시 시작하기 전에 완료하세요.":"Claude 프로세스를 확인할 수 없습니다. 컴퓨터를 확인하고 다시 시도해 보세요."));
      const prompt=t(preview.requiresUnknownConfirmation?"Claude 작업 상태를 확인할 수 없습니다. 종료하면 실행 중인 작업이 중단될 수 있습니다. Claude를 확인하고 작업 내용을 저장했는지 확인하세요.":"Claude 데스크톱 앱이 종료됩니다. 작업 내용을 저장했는지 확인하세요.")+'\n\n'+t("Claude Desktop을 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 정말 그만두시겠어요?");
      if(!window.confirm(prompt))return;
      const value=await this.api.desktopSessions({action:'claude-quit-confirm',token:preview.token,confirmed:true,...(preview.requiresUnknownConfirmation?{acknowledgeUnknown:true}:{})});
      if(value.clients){this.clients=value.clients;this.gatewayRunning=value.gatewayRunning??this.gatewayRunning;}this.feedback("Claude가 종료되었습니다");
    }catch(error){this.feedback(error.message,true);}
    finally{this.busy=false;this.renderClients();this.renderScan();await this.refreshClients(true);await this.refresh();}
  }
  async action(action){
    if(this.busy||this.scanning||this.choosingClient||this.hasUncertain())return;
    if(action==='setup-claude')return this.showClaudeSetup();
    if(action==='restart-deepseek'&&!window.confirm(BridgeI18n.t("Harness를 다시 시작하면 현재 세션의 연결이 끊어집니다. 모든 작업을 완료하고 다시 시작을 확인하기 전에 Harness에 작업을 저장하세요.")))return;
    if(action==='restart-claude'&&!window.confirm(BridgeI18n.t("Claude를 다시 시작하면 현재 세션의 연결이 끊어집니다. 모든 작업을 완료하고 다시 시작을 확인하기 전에 작업 내용을 저장하세요.")))return;
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
      if(['connect-deepseek','restart-deepseek'].includes(action))this.feedback("Harness가 연결되기를 기다리는 중");
      rescan=action==='connect-deepseek'||action==='install-deepseek';
      await this.refreshClients(true);await this.refresh();
    }catch(error){if(provider)this.operationFailures.set(provider,{...ClientLifecycle.failure(operation,error,'desktop'),desktopAction:action});this.feedback(error.message,true);}
    finally{this.busy=false;buttons.forEach(button=>button.disabled=false);this.renderClients();this.renderScan();if(provider&&this.operationFailures.has(provider))await this.refreshClients(true);}
    if(rescan)await this.scan();
  }
}

if(typeof module!=='undefined')module.exports={DesktopConnectionsPanel};
