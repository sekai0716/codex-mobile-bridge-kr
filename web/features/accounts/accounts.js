/* Shared account selector; enrollment controls exist only in the desktop host. */
function resetCardState(value, now){
  const stale=!!value.stale||value.state==='error';
  const resetToday=!!value.lastResetAt&&new Date(value.lastResetAt*1000).toDateString()===now.toDateString();
  const status=stale?'delayed':['idle','loading'].includes(value.state)?'loading':value.officialSignal?'signal':'quiet';
  return {stale,resetToday,status,showAnnouncement:!stale&&!!value.officialSignal,
    showForecast:!stale&&value.state==='ready'&&!resetToday&&!value.officialSignal};
}
class AccountsPanel {
  constructor({root,read,request,desktop=false,configurationPlaceholder='',toolbar=null,onChanged=()=>{},onUpdate=()=>{}}){
    Object.assign(this,{root,read,request,desktop,configurationPlaceholder,toolbar,onChanged,onUpdate});this.value=null;this.busy=false;this.timer=null;this.generation=0;this.visit=0;this.readFailed=false;this.resumePending=false;this.operationError=false;this.expandedModels=new Set();this.modelBoxes=new Map();this.expandedSubscriptions=new Set();
    this.build();
    this.lastVisible=this.visible();
    document.addEventListener('visibilitychange',()=>this.resume());
    if(this.desktop)document.addEventListener('bridge-client-config',()=>this.resume());
    this.root.closest('dialog')?.addEventListener('close',()=>this.resume());
  }
  attachApiAccess(panel,details){
    this.cliAccess=panel;this.apiDetails=details;this.management.insertBefore(details,this.tools);
  }
  text(value){return typeof BridgeI18n==='undefined'?value:BridgeI18n.t(value);}
  node(tag,text,className){const n=document.createElement(tag);if(text!==undefined){n.textContent=this.text(text);if(typeof BridgeI18n!=='undefined'&&Object.hasOwn(BridgeI18n.dictionary,text))n.setAttribute('data-i18n',text);}if(className)n.className=className;return n;}
  button(text,fn){const n=this.node('button',text);n.type='button';n.onclick=fn;return n;}
  field(label,type='text'){const wrap=this.node('label'),input=document.createElement('input');input.type=type;wrap.append(this.node('span',label),input);return {wrap,input};}
  build(){
    this.root.replaceChildren();this.root.classList.add('accounts-panel');
    const header=this.toolbar||this.node('div',undefined,'accounts-toolbar');
    if(this.desktop)header.append(this.node('h2','저장된 연결'));
    this.refreshButton=this.button('새로고침',()=>this.refresh());this.refreshButton.className='accounts-refresh';header.append(this.refreshButton);if(!this.toolbar)this.root.append(header);
    this.switchHint=this.node('p','Codex 데스크톱 및 CLI는 이 컴퓨터에 대한 액세스를 공유합니다. 전환하면 Desktop이 실행 중일 때 다시 시작됩니다.','account-muted');this.root.append(this.switchHint);
    this.status=this.node('p',undefined,'account-muted');this.status.setAttribute('role','status');
    this.managementNotice=this.node('p',undefined,'account-muted');this.root.append(this.managementNotice);
    if(this.desktop){
      const label=this.node('label','연결 구성 관리');this.managementMode=document.createElement('select');
      for(const [value,text] of [['auto','자동 감지'],['external','Magpie 또는 다른 도구로 관리']]){const option=this.node('option',text);option.value=value;this.managementMode.append(option);}
      this.managementMode.onchange=()=>this.perform({action:'management',mode:this.managementMode.value});label.append(this.managementMode);this.root.append(label);
    }
    this.error=this.node('p',undefined,'error');this.error.setAttribute('role','alert');
    this.globalReset=this.node('section',undefined,'accounts-global-reset');this.globalReset.hidden=true;
    this.rows=this.node('div',undefined,'accounts-list');
    this.currentReset=this.button('재설정 크레딧 보기 및 사용',()=>this.onReset?.());this.currentReset.hidden=true;
    this.current=this.node('p',undefined,'accounts-current');this.blocked=this.node('div',undefined,'account-muted');this.root.append(this.current,this.status,this.error,this.currentReset,this.blocked,this.globalReset,this.rows);
    this.management=ApiAccessEditor.management(this.root,this.node.bind(this));
    this.sshHosts=this.node('section');this.sshHosts.hidden=true;this.root.append(this.sshHosts);
    this.tools=this.node('details');this.toolsTitle=this.node('summary');this.tools.append(this.toolsTitle);
    this.reminders=this.node('div');this.updates=this.node('section');this.tools.append(this.reminders,this.updates);this.management.append(this.tools);
    this.desktopRuntime=this.node('section');this.desktopRuntime.hidden=true;
    this.runtimeStatus=this.node('p',undefined,'account-muted');
    this.initializeRuntime=this.button('연결 초기화',()=>{if(window.confirm(this.text('Codex 데스크톱의 모든 작업이 끝났는지 확인한 뒤 네이티브 연결을 초기화하시겠습니까? 실행 중인 앱은 정상 종료 후 재시작됩니다. 계정과 채팅 기록은 보존됩니다.')))return this.perform({action:'initializeDesktopRuntime',requestId:this.requestId(),confirmed:true,tasksConfirmed:true});});
    this.forceInitializeRuntime=this.button('그래도 초기화를 계속하세요',()=>{if(window.confirm(this.text('일부 작업 상태를 확인하지 못했습니다. 계속하면 Codex 앱이 정상 종료 후 재시작되며, 해당 작업이나 대기 중인 승인이 중단될 수 있습니다. 채팅 기록은 보존되며 나중에 이어갈 수 있습니다. 계속하시겠습니까?')))return this.perform({action:'initializeDesktopRuntime',requestId:this.requestId(),confirmed:true,tasksConfirmed:true,acknowledgeUnavailable:true});});this.forceInitializeRuntime.hidden=true;
    this.desktopRuntime.append(this.node('h3','Codex 네이티브 채팅 연결'),this.runtimeStatus,this.initializeRuntime,this.forceInitializeRuntime);this.tools.append(this.desktopRuntime);
    if(!this.desktop){this.root.append(this.node('p','컴퓨터에서 공식 계정에 로그인하세요.','account-muted'));return;}
    const scanDetails=this.node('details');scanDetails.append(this.node('summary','로컬 구성 스캔'));
    this.scanSource=this.field('Codex 구성 디렉터리');this.scanSource.input.placeholder=this.configurationPlaceholder||this.text('현재 Codex 데이터 디렉터리를 사용하려면 비워 두세요.');
    this.scanSource.input.oninput=()=>{this.scannedSource=null;this.scanSelection='';this.render();};
    this.scanChoice=document.createElement('select');this.scanChoice.setAttribute('aria-label',this.text('저장할 구성을 선택하세요.'));this.scanChoice.hidden=true;
    this.scanChoice.onchange=()=>{this.scanSelection=this.scanChoice.value;this.render();};
    this.scanButton=this.button('구성 검색',async()=>{const source=this.scanSource.input.value;if(await this.perform({action:'scan',source})){this.scannedSource=source;const rows=this.scanCandidates();this.scanSelection=rows.length===1?rows[0].id:'';this.render();}});
    this.saveScanButton=this.button('설정 저장',()=>{const row=this.scanCandidates().find(value=>value.id===this.scanSelection);if(row)return this.importCandidate(row);});
    const scanActions=this.node('div',undefined,'account-actions');scanActions.append(this.scanButton,this.saveScanButton);
    this.scanRows=this.node('div');scanDetails.append(this.scanSource.wrap,this.scanChoice,scanActions,this.scanRows);this.management.append(scanDetails);
    this.renameForm=this.node('form');this.renameForm.hidden=true;this.renameName=this.field('이름');this.renameName.input.maxLength=80;this.renameName.input.required=true;
    this.renameSave=this.node('button','이름 저장');this.renameSave.type='submit';
    this.renameForm.append(this.renameName.wrap,this.renameSave,this.button('변경 취소',()=>{this.renameForm.hidden=true;}));
    this.renameForm.onsubmit=async event=>{event.preventDefault();if(await this.perform({action:'rename',id:this.renameId,name:this.renameName.input.value}))this.renameForm.hidden=true;};
    this.root.append(this.renameForm);
    const details=this.node('details');details.append(this.node('summary','계정 추가 또는 API'));
    this.form=this.node('form');this.name=this.field('이름');this.name.input.maxLength=80;this.name.input.required=true;
    this.kind=document.createElement('select');this.kind.setAttribute('aria-label',this.text('제공자 유형'));
    for(const [value,label] of [['chatgpt','공식 ChatGPT 계정'],['api','사용자 정의 API']]){const option=this.node('option',label);option.value=value;this.kind.append(option);}
    this.url=this.field('API URL');this.url.input.placeholder='https://api.example.com/v1';
    this.key=this.field('API 키','password');this.key.input.autocomplete='new-password';this.key.input.maxLength=8192;
    this.model=this.field('기본 모델');this.model.input.maxLength=200;
    this.modelOptions=this.node('select');this.modelOptions.setAttribute('aria-label',this.text('공급자 모델'));this.modelOptions.hidden=true;
    this.modelOptions.onchange=()=>{if(this.modelOptions.value)this.model.input.value=this.modelOptions.value;};
    this.modelsButton=this.button('공급자 모델 가져오기',()=>ApiAccessEditor.discover(this.apiEditor));
    this.modelMessage=this.node('p',undefined,'account-muted');
    this.submit=this.node('button','계속하다');this.submit.type='submit';
    const panel=this,asField=value=>({label:value.wrap,input:value.input});
    this.apiEditor={t:this.text.bind(this),node:this.node.bind(this),get busy(){return panel.busy;},draftRevision:0,draftModelMode:'legacy',draftManualToggle:false,
      model:asField(this.model),baseUrl:asField(this.url),key:asField(this.key),save:this.submit,modelSelect:this.modelOptions,modelCaption:this.model.wrap,modelFeedback:this.modelMessage,fetchModels:this.modelsButton,manualModel:this.button('수동으로 입력',()=>{}),request:payload=>this.request(payload),
      draftModelContext:()=>JSON.stringify([this.generation,this.importId,this.editId,this.kind.value,this.url.input.value,this.key.input.value]),
      draftModelRequest:()=>this.importId?{action:'models',candidateId:this.importId}:{action:'models',id:this.editId,baseUrl:this.url.input.value,apiKey:this.key.input.value},
      onDraftStart:()=>{this.operationError=false;this.error.textContent='';},onDraftError:error=>{this.operationError=true;this.error.textContent=this.text(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));},
      draftModelSuccess:'목록에는 응답 API를 지원하지 않는 모델이 포함될 수 있습니다. 호환되는 채팅 모델을 선택하세요.'};
    const clearModels=()=>ApiAccessEditor.clear(this.apiEditor);
    this.url.input.oninput=clearModels;this.key.input.oninput=clearModels;this.clearModels=clearModels;
    const fields=()=>{this.modelsButton.hidden=this.kind.value!=='api';if(this.kind.value!=='api')clearModels();for(const field of [this.url,this.key,this.model])field.wrap.hidden=this.kind.value!=='api';};this.kind.onchange=fields;fields();
    this.cancelEdit=this.button('변경 취소',()=>{this.resetForm();fields();});
    this.form.append(this.name.wrap,this.kind,this.url.wrap,this.key.wrap,this.model.wrap,this.modelsButton,this.modelOptions,this.modelMessage,this.submit,this.cancelEdit);
    this.form.onsubmit=async event=>{
      event.preventDefault();const payload={name:this.name.input.value};
      if(this.importId)Object.assign(payload,{action:'import',candidateId:this.importId,model:this.model.input.value});
      else if(this.kind.value==='api')Object.assign(payload,{action:'addApi',id:this.editId,baseUrl:this.url.input.value,apiKey:this.key.input.value,model:this.model.input.value});
      else Object.assign(payload,{action:'login',replaceId:this.editId});
      if(await this.perform(payload)){this.resetForm();fields();}
    };
    details.append(this.form,this.node('p','자격 증명은 이 컴퓨터의 개인 디렉터리에 유지됩니다. 사용자 정의 API는 API 응답을 지원해야 합니다.','account-muted'));
    this.loginBox=this.node('div');details.append(this.loginBox);this.management.append(details);this.addDetails=details;
    const settings=this.node('details');settings.append(this.node('summary','데스크탑 애플리케이션 및 복구'));
    this.executable=this.field('데스크탑 실행 파일');this.executable.input.placeholder=this.text('.app 번들 또는 데스크톱 실행 파일 선택');
    this.scanDesktop=this.button('데스크톱 앱 검색',()=>this.perform({action:'scanDesktop'}));
    this.desktopSettings=settings;settings.append(this.executable.wrap,this.scanDesktop,this.button('응용 프로그램 경로 저장',()=>this.perform({action:'configure',desktopExecutable:this.executable.input.value})));
    this.recover=this.button('이전 계정 복원',()=>{if(window.confirm(this.text('이전 계정을 복원하고 Codex를 다시 시작하시겠습니까?')))this.perform({action:'recover',confirmed:true});});
    settings.append(this.recover);this.management.append(settings);
  }
  resetForm(){this.editId=null;this.importId=null;this.form.reset();this.key.input.value='';this.kind.disabled=false;this.url.input.disabled=false;this.key.input.disabled=false;this.clearModels();}
  scanCandidates(){return this.scannedSource===this.scanSource.input.value?(this.value?.discovery?.candidates||[]).filter(row=>row.canImport&&!row.imported):[];}
  importCandidate(row){
    if(row.kind==='chatgpt')return this.perform({action:'import',candidateId:row.id});
    this.resetForm();this.importId=row.id;this.addDetails.open=true;this.name.input.value=row.name;this.kind.value='api';this.kind.disabled=true;this.kind.onchange();
    this.url.input.value=row.baseUrl;this.model.input.value=row.model||'';this.url.input.disabled=true;this.key.input.disabled=true;this.model.input.focus();
  }
  async perform(payload){
    if(this.busy)return false;const focused=[...this.modelBoxes.values()].find(box=>box.refresh===document.activeElement);clearTimeout(this.timer);this.generation++;this.loading=false;this.busy=true;this.operationError=false;this.error.textContent='';this.render();const generation=this.generation;
    try{const value=await this.request(payload);if(generation===this.generation){this.accept(value);return true;}return false;}
    catch(error){if(generation===this.generation){this.operationError=true;this.error.textContent=this.text(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}return false;}
    finally{if(generation===this.generation){this.busy=false;this.render();if(this.resumePending&&this.visible()){this.resumePending=false;this.refresh();}else this.schedule();if(focused?.refresh.isConnected&&(document.activeElement===document.body||document.activeElement===focused.refresh)&&!focused.touching)focused.refresh.focus({preventScroll:true});}}
  }
  async refresh(forceReset=false){
    if(this.visible()!==this.lastVisible)return this.resume();
    clearTimeout(this.timer);if(this.loading||this.busy)return;this.loading=true;const generation=this.generation,visit=this.visit;
    try{const value=await this.read(forceReset);if(generation===this.generation&&visit===this.visit){this.readFailed=false;if(forceReset)this.finishGlobalResetRefresh(value.globalReset,true);if(!this.operationError)this.error.textContent='';this.accept(value);await this.loadUsage(generation);}}
    catch(error){if(generation===this.generation&&visit===this.visit){this.readFailed=true;if(this.globalResetRefreshIntent){this.globalResetRefreshIntent=null;this.notify(this.text('연결에 실패했습니다. 나중에 다시 시도해 주세요'));}this.error.textContent=this.text(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}}
    finally{if(generation===this.generation){this.loading=false;this.render();if(this.resumePending&&this.visible()){this.resumePending=false;this.refresh();}else this.schedule();}}
  }
  schedule(){
    clearTimeout(this.timer);this.timer=null;if(!this.visible())return;
    const value=this.value;if(!value&&!this.readFailed)return;
    const phase=value?.switch?.phase||'idle',enrollment=value?.enrollment?.phase,update=value?.desktopUpdate?.state;
    const pending=value?.sshHosts?.some(host=>host.state==='checking')||!['idle','complete','restored','failed','interrupted'].includes(phase)||['starting','waiting'].includes(enrollment)||['checking','requesting','needsDesktop'].includes(update)||value?.current?.status==='checking'||['idle','loading'].includes(value?.globalReset?.state)||value?.globalReset?.refresh?.checking||this.globalResetRefreshIntent||this.accountRows().some(row=>row.details?.usage?.status==='loading'||row.details?.models?.status==='loading');
    const sshRetry=Math.min(300000,...(value?.sshHosts||[]).filter(host=>host.state==='offline'&&host.nextRetryAt).map(host=>Math.max(5000,host.nextRetryAt*1000-Date.now()+1000)));
    this.timer=setTimeout(()=>{if(this.visible())return this.refresh();},this.readFailed?10000:pending?2000:sshRetry);
  }
  visible(){const dialog=this.root.closest('dialog');return !this.root.closest('[hidden],.client-config-hidden')&&!document.hidden&&(!dialog||dialog.open);}
  resume(){
    const visible=this.visible();if(visible===this.lastVisible)return;
    this.lastVisible=visible;this.visit++;clearTimeout(this.timer);this.timer=null;
    if(!visible){this.resumePending=false;this.globalResetRefreshIntent=null;clearTimeout(this.resetMidnightTimer);this.resetMidnightTimer=null;}
    if(visible){if(this.loading||this.busy)this.resumePending=true;else return this.refresh();}
  }
  accountRows(){const login=this.value?.loginAccount,rows=this.value?.accounts||[];return login?[login,...rows.filter(row=>row.id!==login.id)]:rows;}
  async loadUsage(generation){
    if(!this.visible())return;
    if(!['idle','complete','restored','failed'].includes(this.value?.switch?.phase||'idle'))return;
    const visit=this.visit,current=()=>generation===this.generation&&!this.busy&&visit===this.visit&&this.visible();
    for(const row of this.accountRows()){
      if(!current())return;
      const usage=row.details?.usage;
      if(row.kind!=='chatgpt'||usage?.status==='loading'||(usage&&Date.now()/1000-(usage.checkedAt||0)<300))continue;
      const value=await this.request({action:'details',id:row.id,section:'usage'});
      if(!current())return;
      this.accept(value);
    }
  }
  relative(minutes){const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return [days?days+this.text('일'):'',hours?hours+this.text('시간'):'',rest?rest+this.text('분'):''].filter(Boolean).join(' ');}
  resetTime(stamp){const minutes=Math.ceil((stamp*1000-Date.now())/60000);return (minutes>0?this.relative(minutes)+this.text('재설정될 때까지'):this.text('새로고침을 기다리는 중'))+' · '+new Date(stamp*1000).toLocaleString(BridgeI18n.locale());}
  shortTime(stamp,timeOnly=false){
    const date=new Date(stamp*1000),now=new Date(Date.now()),options={hour:'2-digit',minute:'2-digit'};
    if(!timeOnly||date.toDateString()!==now.toDateString())Object.assign(options,{month:'short',day:'numeric',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
    return date.toLocaleString(BridgeI18n.locale(),options);
  }
  accountUsage(card,row){
    if(row.kind==='chatgpt'){
      const usage=row.details?.usage,box=this.node('div',undefined,'accounts-usage');
      if(usage?.status==='loading'&&!usage.limits)box.append(this.node('span','확인 중…','account-query'));
      else if(!usage)box.append(this.node('span','사용량 불러오는 중…','account-muted'));
      else if(usage.status==='error')box.append(this.node('span',usage.error,'account-muted'));
      if(usage?.limits){
        for(const bucket of usage.limits||[])for(const window of bucket.windows||[]){
          const line=this.node('div',undefined,'accounts-window'),minutes=window.windowDurationMins;
          const label=minutes?minutes%1440===0?minutes/1440+this.text('일'):minutes%60===0?minutes/60+this.text('시간'):minutes+this.text('분'):this.text('사용량 창');
          line.append(this.node('span',bucket.name+' · '+label),this.node('strong',window.remainingPercent==null?this.text('사용할 수 없음'):this.text('남은')+Math.round(window.remainingPercent*10)/10+'%'));
          if(window.remainingPercent!=null){const progress=this.node('progress');progress.max=100;progress.value=window.remainingPercent;progress.setAttribute('aria-label',this.text('남은 할당량'));line.append(progress);}
          if(window.resetsAt){const reset=this.node('small',undefined,'account-reset-time');reset.textContent=this.resetTime(window.resetsAt);line.append(reset);}box.append(line);
        }
        if(!usage.limits?.length)box.append(this.node('span','아직 사용량 한도를 확인할 수 없습니다.','account-muted'));
        for(const bucket of usage.limits||[])if(bucket.credits){const credit=bucket.credits;if(credit.unlimited||credit.balance!=null&&String(credit.balance).trim()!=='')box.append(this.node('p',bucket.name+' · Credits: '+(credit.unlimited?this.text('제한 없는'):credit.balance),'account-muted'));}
        if(usage.status==='error')box.append(this.node('small','마지막 결과를 표시합니다. 데이터가 업데이트되지 않았습니다','account-muted'));
      }
      card.append(box);
    }
  }
  accountSubscription(card,row){
    const usage=row.details?.usage;if(!usage?.limits)return;
    const period=usage.subscription?.periodEndsAt,online=usage.subscription?.source==='online',hasDate=Number.isFinite(period)&&(online||period>Date.now()/1000);
    const date=hasDate?new Date(period*1000):null,fullDate=date?.toLocaleString(BridgeI18n.locale());
    const shortDate=date?.toLocaleDateString(BridgeI18n.locale(),{month:'short',day:'numeric',...(date.getFullYear()!==new Date(Date.now()).getFullYear()?{year:'numeric'}:{})});
    const label=hasDate?this.text(online?'구독 기간 종료':'로그인 기록의 구독 날짜(실시간 아님):')+shortDate:this.text('구독 종료 날짜가 확인되지 않았습니다.');
    const source=this.text(online?'온라인에서 검색된 날짜입니다. 갱신 및 청구 상태는 ChatGPT 구독 페이지를 확인하세요.':'로그인 기록이 오래되었을 수 있습니다. ChatGPT 구독 페이지를 참조하세요.');
    const note=this.node('p',(hasDate?this.text(online?'구독 기간 종료:':'로그인 기록의 구독 날짜(실시간 아님):')+fullDate+' · ':'')+source,'account-muted account-subscription-note');note.hidden=!this.expandedSubscriptions.has(row.id);
    const info=this.button(label,()=>{note.hidden=!note.hidden;if(note.hidden)this.expandedSubscriptions.delete(row.id);else this.expandedSubscriptions.add(row.id);info.setAttribute('aria-expanded',String(!note.hidden));});
    info.className='account-subscription-info';info.title=note.textContent;info.setAttribute('aria-label',this.text('구독 날짜에 대해'));info.setAttribute('aria-expanded',String(!note.hidden));
    const subscription=this.node('div',undefined,'account-subscription');subscription.append(info);card.append(subscription,note);
    if(usage.subscription?.error)card.append(this.node('p',usage.subscription.error,'account-muted'));
  }
  accountReset(card,row,switching){
    const credits=row.details?.usage?.resetCredits;
    const summary=this.node('div',undefined,'accounts-reset-summary'),info=this.node('div',undefined,'accounts-reset-info'),count=credits?.availableCount;
    info.append(this.node('div',this.text('사용량 재설정')+' · '+(count==null?this.text('사용할 수 없음'):count+this.text('개 사용 가능')),'accounts-reset-count'));
    const expiry=credits?.credits?.filter(c=>c.status==='available'&&c.resetType==='codexRateLimits'&&Number.isFinite(c.expiresAt)&&c.expiresAt>Date.now()/1000).map(c=>c.expiresAt).sort((a,b)=>a-b)[0];
    if(expiry){const time=this.node('time',this.shortTime(expiry));time.title=new Date(expiry*1000).toLocaleString(BridgeI18n.locale());time.dateTime=new Date(expiry*1000).toISOString();const line=this.node('div',undefined,'accounts-reset-expiry account-muted');line.append(this.node('span','다음 만료:'),time);info.append(line);}
    else if(count>0)info.append(this.node('div','만료 기간이 제공되지 않음','accounts-reset-expiry account-muted'));
    summary.append(info);
    const reset=this.button('재설정 사용',()=>this.openReset(row));reset.className='accounts-reset';reset.disabled=this.busy||switching;reset.setAttribute('aria-label',this.text('선택한 계정의 재설정 크레딧 보기 및 사용'));summary.append(reset);
    card.append(summary);
  }
  async openReset(row){
    if(this.resetDialog?.open)return;
    const dialog=this.node('dialog',undefined,'picker account-reset-dialog'),heading=this.node('h2',this.text('사용량 재설정')+' · '+row.name);
    const close=this.button('닫기',()=>dialog.close()),content=this.node('div'),button=this.node('button');
    const header=this.node('div',undefined,'picker-head');header.append(heading,close);dialog.append(header,content);
    const panel=new AccountPanel({root:content,button,resetOnly:true,
      read:refresh=>this.request({action:'account',id:row.id,operation:'read',refresh}),
      consume:value=>this.request({action:'account',id:row.id,operation:'consume',...value}),
      onConsumed:()=>this.perform({action:'details',id:row.id,section:'usage',refresh:true}),
      visible:()=>dialog.open&&this.visible()});
    this.resetDialog=dialog;this.resetPanel=panel;this.resetAccountId=row.id;this.resetAccountKey=row.accountKey;
    dialog.onclose=()=>{panel.clear();dialog.remove();this.resetDialog=null;this.resetPanel=null;this.resetAccountId=null;this.resetAccountKey=null;};
    document.body.append(dialog);dialog.showModal();
    const usage=row.details?.usage;
    // List snapshots display inventory; the account read supplies the identity required to use it.
    if(usage?.resetCredits)panel.accept({visible:true,email:row.email,limits:[],resetCredits:usage.resetCredits,updatedAt:usage.updatedAt,canReset:false});
    await panel.refresh(false);
  }
  accountActions(card,row,footer){
    const models=row.details?.models,opened=this.expandedModels.has(row.id);
    {const show=this.button(opened?'모델 숨기기':'사용 가능한 모델 보기',()=>{if(opened){this.expandedModels.delete(row.id);this.render();}else{this.expandedModels.add(row.id);this.perform({action:'details',id:row.id,section:'models'});}});show.disabled=this.busy;footer.append(show);}
    if(opened){const identity=row.accountKey||JSON.stringify([row.kind,row.baseUrl,row.model,row.email]);let box=this.modelBoxes.get(row.id);
      if(box?.identity!==identity){this.modelBoxes.delete(row.id);box=null;}
      if(!box){box=this.node('div',undefined,'accounts-models');box.identity=identity;box.ontouchstart=()=>{box.touching=true;};box.ontouchend=box.ontouchcancel=()=>{box.touching=false;};box.controls=this.node('div',undefined,'accounts-model-controls');box.refresh=this.button('모델 새로 고침',()=>this.perform({action:'details',id:row.id,section:'models',refresh:true}));box.updated=this.node('small',undefined,'account-muted');box.content=this.node('div');box.controls.append(box.refresh,box.updated);box.append(box.controls,box.content);this.modelBoxes.set(row.id,box);}
      box.refresh.disabled=this.busy||models?.status==='loading';
      const updated=models?.cache?.updatedAt;box.updated.hidden=!(Number.isFinite(updated)&&updated>0);box.updated.textContent=box.updated.hidden?'':this.text('업데이트 날짜:')+this.shortTime(updated);
      const key=JSON.stringify([models?.status,models?.error,models?.models,BridgeI18n.locale()]);
      if(box.modelKey!==key){box.modelKey=key;box.content.replaceChildren();
        if((!models||models.status==='loading')&&!models?.models?.length)box.content.append(this.node('p','모델 로드 중…'));
        if(models?.status==='error')box.content.append(this.node('p',models.error,'error'));
        if(models?.models?.length)for(const model of models.models){const line=this.node('div');line.textContent=!model.name||model.name===model.id?model.id:model.name+' · '+model.id;if(model.efforts?.length)line.append(this.node('small',' · '+model.efforts.map(effort=>this.text(effort)).join(' / '),'account-muted'));box.content.append(line);}
        else if(models?.status==='ready')box.content.append(this.node('p','사용 가능한 모델이 없습니다.'));
      }if(!box.parentNode)card.append(box);
    }
  }
  accountUsageControls(row){
    const controls=this.node('div',undefined,'accounts-usage-controls'),usage=row.details?.usage;
    const refresh=this.button('',()=>this.perform({action:'details',id:row.id,section:'usage',refresh:true}));refresh.className='accounts-usage-refresh';
    refresh.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8M20 3v5h-5"/></svg>';
    refresh.title=this.text('남은 할당량 보기');refresh.setAttribute('aria-label',refresh.title);
    refresh.disabled=this.busy||usage?.status==='loading';
    if(usage?.updatedAt){const updated=this.node('small',this.text('업데이트됨 {time}').replace('{time}',this.shortTime(usage.updatedAt,true))+(usage.status==='loading'?' · '+this.text('확인 중…'):''),'account-updated account-muted');updated.title=new Date(usage.updatedAt*1000).toLocaleString(BridgeI18n.locale());controls.append(updated);}
    controls.append(refresh);return controls;
  }
  accept(value){const old=this.value;if(!this.desktop&&old?.canSwitch===false&&value.canSwitch===undefined)value={...value,canSwitch:false};this.value=value;if(!value.resetDynamicEnabled)this.globalResetRefreshIntent=null;this.finishGlobalResetRefresh(value.globalReset);if(old&&(old.activeId!==value.activeId||old.current?.kind!==value.current?.kind||old.current?.name!==value.current?.name||old.switch?.phase!==value.switch?.phase))this.onChanged(value);this.onUpdate(value);this.render();}
  clear(){clearTimeout(this.resetMidnightTimer);this.resetMidnightTimer=null;this.globalResetRefreshIntent=null;this.globalResetMessage='';this.globalResetKey=null;this.globalReset.hidden=true;this.resetDialog?.close();clearTimeout(this.timer);this.generation++;this.clearModels?.();this.value=null;this.scannedSource=null;this.scanSelection='';this.loading=false;this.busy=false;this.readFailed=false;this.resumePending=false;this.operationError=false;this.modelBoxes.clear();this.error.textContent='';this.rows.replaceChildren();this.sshHosts.replaceChildren();this.sshHosts.hidden=true;this.desktopRuntime.hidden=true;}
  requestId(){
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  async choose(row){
    const receipt=this.value?.switch;
    if(receipt?.operation==='cliAuth'&&receipt.phase==='authUnknown'&&receipt.targetId===row.id){
      await this.perform({action:'switch',id:row.id,requestId:receipt.requestId,confirmed:true,tasksConfirmed:true});this.refresh();return;
    }
    if(!window.confirm(this.text(this.value?.scope==='profile'?'이 구성의 모든 작업(다른 클라이언트의 작업 포함)이 끝났는지 확인하고 공유 Codex 계정을 동기화하시겠습니까? 전환이 끝나기 전까지 다른 클라이언트에서 작업을 시작하지 마세요. 필요한 경우에만 유휴 공유 서비스를 정상 종료합니다.':'모든 작업(이 웹 페이지에 표시되지 않는 작업 포함)이 끝났는지 확인하고 공유 Codex 접속 설정을 전환하시겠습니까? 전환이 끝나기 전까지 다른 클라이언트에서 작업을 시작하지 마세요. 필요한 경우에만 데스크톱 런타임을 정상 종료 후 다시 시작합니다.')+'\n'+row.name))return;
    try{await this.perform({action:'switch',id:row.id,requestId:this.requestId(),confirmed:true,tasksConfirmed:true,
      syncLocalCli:true});this.refresh();}
    catch(error){this.operationError=true;this.error.textContent=this.text('전환 요청을 생성할 수 없습니다. 새로고침하고 다시 시도하세요.');}
  }
  renderTools(){
    const value=this.value;if(!value)return;
    this.reminders.replaceChildren();
    this.reminders.append(this.node('p','미리 알림은 컴퓨터에 구성된 Bark, ntfy 또는 PushPlus를 사용합니다. 컴퓨터와 게이트웨이를 계속 실행하세요.','account-muted'));
    const labels={globalReset:'Outlook 알림 재설정',lowQuota:'할당량이 10% 이하일 때 알림',quotaReset:'할당량 복구 확인 후 알림',resetExpiry:'재설정 크레딧이 만료되기 24시간 전에 알림',subscriptionExpiry:'구독 기간이 종료되기 7일, 3일, 1일 전에 알림을 받으세요.',desktopUpdate:'새로운 Codex 데스크탑 릴리스에 대해 알림'};
    for(const [key,label] of Object.entries(labels)){if(value.scope==='profile'&&key==='desktopUpdate')continue;
      const wrap=this.node('label',undefined,'account-reminder'),input=document.createElement('input');input.type='checkbox';input.checked=!!value.reminders?.[key];input.disabled=this.busy;
      input.onchange=()=>this.perform({action:'reminders',preferences:{[key]:input.checked}});wrap.append(input,this.node('span',label));this.reminders.append(wrap);
    }
    if(value.reminderError)this.reminders.append(this.node('p',value.reminderError,'error'));
    const update=value.desktopUpdate||{state:'idle'},labelsUpdate={idle:'확인 안 함',checking:'공식 업데이트 채널 확인 중…',available:'공식 채널에 새 버전이 게시되었습니다.',checked:'이 검사에는 최신 공개 버전이 없습니다.',unsupported:'컴퓨터에서 확인하세요',error:'업데이트 확인 실패',requesting:'네이티브 업데이트 프로그램을 여는 중…',needsDesktop:'컴퓨터에서 확인을 기다리는 중'};
    this.updates.replaceChildren(this.node('h3','Codex 데스크탑 업데이트'),this.node('p',update.failureReason?'업데이트 프로그램을 열 수 없습니다.':labelsUpdate[update.state]||update.state));
    this.updates.append(this.node('p','원격으로 새 버전을 확인할 수 있습니다. 다운로드 및 설치에는 여전히 컴퓨터에서 확인이 필요합니다.','account-muted'));
    if(update.currentVersion)this.updates.append(this.node('p',this.text('현재 버전:')+update.currentVersion+(update.targetVersion?' → '+update.targetVersion:''),'account-muted'));
    if(update.installation?.state==='verified'){const installed=this.node('p',undefined,'account-muted');installed.textContent=this.text('설치된 데스크톱 버전이 업데이트된 것으로 확인되었습니다.')+' · '+update.installation.previousBuild+' → '+update.installation.currentBuild;this.updates.append(installed);}
    if(update.message)this.updates.append(this.node('p',update.message,'account-muted'));
    if(update.checkedAt)this.updates.append(this.node('small',this.text('확인 장소:')+new Date(update.checkedAt*1000).toLocaleString(BridgeI18n.locale()),'account-muted'));
    const checking=['checking','requesting'].includes(update.state),denied=!this.desktop&&(value.canManageDesktop??value.canSwitch)===false;
    const check=this.button('새로운 Codex 버전 확인',()=>this.perform({action:'checkDesktopUpdate'}));check.disabled=this.busy||checking||denied;this.updates.append(check);
    if(update.canRequest&&update.currentBuild){const request=this.button('컴퓨터에서 업데이터를 엽니다.',()=>{
      if(window.confirm(this.text('여기에 표시되지 않는 작업을 포함하여 모든 데스크톱 작업이 완료되었는지 확인하고 컴퓨터에서 Codex의 업데이트 확인을 여시겠습니까? Codex는 업데이트 확인, 다운로드 및 설치를 처리합니다.')))
        this.perform({action:'requestDesktopUpdate',requestId:this.requestId(),currentBuild:update.currentBuild,confirmed:true,tasksConfirmed:true});
    });request.disabled=this.busy||checking||denied;this.updates.append(request);}
  }
  reconcileRows(cards){
    const previous=new Map([...this.rows.children].filter(card=>card.accountRowId).map(card=>[card.accountRowId,card]));
    const next=cards.map(card=>{
      const old=previous.get(card.accountRowId);if(!old)return card;
      const box=this.modelBoxes.get(card.accountRowId),keep=box?.parentNode===old?box:null;
      for(const child of [...old.children])if(child!==keep)child.remove();
      for(const child of [...card.children])old.insertBefore(child,keep);
      if(keep&&!this.expandedModels.has(card.accountRowId))keep.remove();
      old.className=card.className;return old;
    });
    for(const child of [...this.rows.children])if(!next.includes(child))child.remove();
    next.forEach((card,index)=>{if(this.rows.children[index]!==card)this.rows.insertBefore(card,this.rows.children[index]||null);});
    const identities=new Map(this.accountRows().map(row=>[row.id,row.accountKey||JSON.stringify([row.kind,row.baseUrl,row.model,row.email])]));
    for(const [id,box] of this.modelBoxes)if(identities.get(id)!==box.identity)this.modelBoxes.delete(id);
  }
  refreshIcon(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66L20 8M20 3v5h-5"/></svg>';}
  notify(message){this.globalResetMessage=message;this.globalResetKey=null;this.renderGlobalReset();}
  refreshGlobalReset(){
    if(this.busy||this.loading||this.globalResetRefreshIntent||this.value?.globalReset?.refresh?.checking)return;
    this.globalResetMessage='';this.globalResetRefreshIntent={baseline:this.value?.globalReset?.refresh?.id||0,id:null,instanceId:this.value?.globalReset?.refresh?.instanceId};
    this.globalResetKey=null;this.renderGlobalReset();return this.refresh(true);
  }
  finishGlobalResetRefresh(value,acknowledged=false){
    const intent=this.globalResetRefreshIntent;if(!intent||(!acknowledged&&intent.id===null))return;
    const refresh=value?.refresh,now=Date.now()/1000;
    if(refresh?.instanceId&&intent.instanceId&&refresh.instanceId!==intent.instanceId){
      this.globalResetRefreshIntent=null;if(this.visible())this.notify(this.text('게이트웨이가 다시 연결되었습니다. 다시 새로고침해 주세요'));return;
    }
    if(acknowledged&&refresh?.instanceId)intent.instanceId=refresh.instanceId;
    if(!acknowledged&&(!refresh||refresh.id<intent.id))return;
    if(refresh?.checking){if(acknowledged)intent.id=refresh.id;return;}
    let message;
    if(refresh&&(refresh.id>intent.baseline||(intent.id!==null&&refresh.id>=intent.id))&&value.state==='ready'){
      message=this.text(refresh.changed?'업데이트됨':'확인됨; 새로운 업데이트 없음');
    }else if(refresh?.retryAt>now){
      message=this.text('일시적으로 사용할 수 없습니다. {minutes}분 후에 다시 시도하세요.').replace('{minutes}',Math.ceil((refresh.retryAt-now)/60));
    }else if(refresh?.cooldownUntil>now){
      message=this.text('최근에 확인했습니다. {seconds}초 후에 다시 새로고침').replace('{seconds}',Math.ceil(refresh.cooldownUntil-now));
    }else message=this.text(refresh?'확인에 실패했습니다. 나중에 다시 시도해 주세요':'캐시된 상태가 로드됨');
    this.globalResetRefreshIntent=null;if(this.visible())this.notify(message);
  }


  renderGlobalReset(){
    const value=this.value?.globalReset;
    this.globalReset.hidden=!this.value?.resetDynamicEnabled;if(this.globalReset.hidden||!value){clearTimeout(this.resetMidnightTimer);this.resetMidnightTimer=null;return;}
    const key=JSON.stringify([value,this.value.reminders,this.busy,this.loading,!!this.refreshingGlobalReset||!!this.globalResetRefreshIntent,BridgeI18n.language(),Math.floor(Date.now()/60000)]);
    if(key===this.globalResetKey)return;this.globalResetKey=key;
    this.globalReset.replaceChildren();
    const header=this.node('div',undefined,'accounts-global-heading');
    const reminderEnabled=!!(this.value.reminders?.globalReset||this.value.reminders?.globalResetSignal);
    const reminder=this.button('',()=>this.perform({action:'reminders',preferences:{globalReset:!reminderEnabled,globalResetSignal:!reminderEnabled}}));
    reminder.className='accounts-global-reminder';reminder.disabled=this.busy;reminder.title=this.text(reminderEnabled?'업데이트 알림 재설정 비활성화':'업데이트 알림 재설정 활성화');reminder.setAttribute('aria-label',reminder.title);reminder.setAttribute('aria-pressed',String(reminderEnabled));reminder.setAttribute('data-enabled',String(reminderEnabled));
    reminder.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path class="accounts-global-bell" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>';
    reminder.append(this.node('span',reminderEnabled?'알림 켜짐':'알림 꺼짐'));
    header.append(this.node('h3','티보 리셋 전망'),reminder);this.globalReset.append(header,this.node('p','제3자 통계 및 예측은 참고용입니다. 실제 할당량은 계정 카드를 확인하세요.','account-muted'));
    const today=new Date(Date.now()),now=today.getTime()/1000;
    const {stale,resetToday,status,showAnnouncement,showForecast}=resetCardState(value,today);
    clearTimeout(this.resetMidnightTimer);this.resetMidnightTimer=null;
    if(resetToday&&this.visible()){
      const midnight=new Date(today);midnight.setHours(24,0,0,0);
      this.resetMidnightTimer=setTimeout(()=>{this.resetMidnightTimer=null;this.globalResetKey=null;this.renderGlobalReset();},midnight.getTime()-today.getTime());
    }
    if(value.lastResetAt){
      const label=resetToday?'오늘 글로벌 리셋':'마지막 전역 재설정';
      const time=resetToday?this.shortTime(value.lastResetAt,true):this.globalTime(value.lastResetAt);
      const last=this.node('p',this.text(label)+' · '+time,'accounts-global-state');
      last.setAttribute('data-state',resetToday&&!stale?'confirmed':'quiet');this.globalReset.append(last);
    }
    let text='',tone='quiet';
    if(status==='delayed'){text=value.updatedAt?'데이터 지연 · 업데이트 대기 중':'일시적으로 업데이트 재설정을 사용할 수 없습니다.';tone='delayed';}
    else if(status==='loading')text='전망 재설정 로드 중…';
    else if(status==='signal'){
      const end=value.officialSignal.endsAt;
      text=this.text('공식 발표')+' · '+(end>now?this.globalTime(end)+this.text('기한 재설정'):this.text(end?'재설정 완료 대기 중':'곧 재설정 예정'));tone='signal';
    }
    if(text){const state=this.node('p',text,'accounts-global-state');state.setAttribute('data-state',tone);state.setAttribute('role','status');this.globalReset.append(state);}
    if(showAnnouncement)this.renderGlobalAnnouncement(value.officialSignal);
    if(showForecast){
      const odds=value.probabilities||{},row=this.node('div',undefined,'accounts-global-odds');
      for(const [key,label] of [['h24','24시간 이내'],['h48','48시간 이내']])if(Number.isFinite(odds[key])){
        const item=this.node('span');item.append(this.node('span',label),this.node('strong',odds[key]+'%'));row.append(item);
      }
      if(row.children.length){this.globalReset.append(row);const confidence={low:'낮은 신뢰도',medium:'중간 신뢰도',high:'높은 신뢰도'}[value.confidence];this.globalReset.append(this.node('p',this.text('예상 재설정 확률')+(confidence?' · '+this.text(confidence):''),'accounts-global-confidence'));}
    }
    if(this.globalResetMessage){const feedback=this.node('p',this.globalResetMessage,'accounts-global-feedback');feedback.setAttribute('role','status');this.globalReset.append(feedback);}
    const footer=this.node('div',undefined,'accounts-global-source'),source=this.node('a','출처: codex-reset.com ↗');source.href='https://codex-reset.com/zh/';source.target='_blank';source.rel='noopener noreferrer';
    const actions=this.node('div',undefined,'accounts-global-footer-actions');
    if(value.updatedAt){const updated=this.node('span',this.text('업데이트: ')+this.shortTime(value.updatedAt,true));if(value.checkedAt)updated.title=this.text('마지막 확인')+this.shortTime(value.checkedAt);actions.append(updated);}
    const refresh=this.button('',()=>this.refreshGlobalReset());refresh.className='accounts-global-refresh';refresh.title=this.text('재설정 업데이트 새로 고침');refresh.setAttribute('aria-label',refresh.title);
    const refreshing=!!this.refreshingGlobalReset||!!this.globalResetRefreshIntent||!!value.refresh?.checking||value.state==='loading';refresh.disabled=this.busy||this.loading||refreshing;refresh.setAttribute('aria-busy',String(refreshing));
    refresh.innerHTML=this.refreshIcon();
    actions.append(refresh);footer.append(source,actions);this.globalReset.append(footer);
  }
  renderGlobalAnnouncement(signal){
    const original=signal.text||signal.summary,translation=signal.text&&signal.translation?.locale==='ko'&&typeof signal.translation.text==='string'?signal.translation.text:null;
    const language=BridgeI18n.language(),key=JSON.stringify([signal.at,signal.url,original,translation,language]);
    if(this.globalAnnouncementKey!==key){this.globalAnnouncementKey=key;this.globalAnnouncementExpanded=false;this.globalAnnouncementOriginal=language!=='ko';}
    const translated=!!translation&&!this.globalAnnouncementOriginal,content=translated?translation:original;
    if(!content&&!signal.url)return;
    const section=this.node('div',undefined,'accounts-global-announcement');
    if(content){
      const meta=this.node('div',undefined,'accounts-global-announcement-meta');meta.append(this.node('span',translated?'기계 번역':signal.text?'원본 게시물':'소스 요약'));
      if(signal.at)meta.append(this.node('span',this.text('게시됨')+this.globalTime(signal.at)));section.append(meta);
      const body=this.node('p',undefined,'accounts-global-announcement-text');body.textContent=content;body.setAttribute('data-expanded',String(!!this.globalAnnouncementExpanded));section.append(body);
      const toggle=this.button(this.globalAnnouncementExpanded?'텍스트 접기':'텍스트 확장',()=>{
        this.globalAnnouncementExpanded=!this.globalAnnouncementExpanded;body.setAttribute('data-expanded',String(this.globalAnnouncementExpanded));
        toggle.textContent=this.text(this.globalAnnouncementExpanded?'텍스트 접기':'텍스트 확장');toggle.setAttribute('aria-expanded',String(this.globalAnnouncementExpanded));
      });toggle.className='accounts-global-expand';toggle.setAttribute('aria-expanded',String(!!this.globalAnnouncementExpanded));
      toggle.hidden=content.length<=120&&!content.includes('\n');section.append(toggle);
      window.requestAnimationFrame?.(()=>{if(body.isConnected&&!this.globalAnnouncementExpanded)toggle.hidden=body.scrollHeight<=body.clientHeight+1;});
    }
    if(translation){
      const languageToggle=this.button(translated?'원본 보기':'번역 보기',()=>{
        this.globalAnnouncementOriginal=!this.globalAnnouncementOriginal;this.globalAnnouncementExpanded=false;this.globalResetKey=null;this.renderGlobalReset();
      });languageToggle.className='accounts-global-language';section.append(languageToggle);
    }
    if(signal.url){
      try{const url=new URL(signal.url);if(url.protocol==='https:'&&['x.com','twitter.com'].includes(url.hostname)){
        const link=this.node('a','원본 게시물 보기 ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';section.append(link);
      }}catch{}
    }
    this.globalReset.append(section);
  }
  globalTime(stamp){
    const date=new Date(stamp*1000),today=new Date(Date.now()),yesterday=new Date(Date.now());yesterday.setDate(today.getDate()-1);
    const prefix=date.toDateString()===today.toDateString()?this.text('오늘'):date.toDateString()===yesterday.toDateString()?this.text('어제'):'';
    return prefix+(prefix?date.toLocaleString(BridgeI18n.locale(),{hour:'2-digit',minute:'2-digit'}):this.shortTime(stamp));
  }
  renderSshHosts(){
    const hosts=this.value?.sshHosts||[];this.sshHosts.hidden=!hosts.length;this.sshHosts.replaceChildren();
    if(!hosts.length)return;
    this.sshHosts.append(this.node('h3','SSH 연결 목록'));
    for(const host of hosts){
      const row=this.node('div',undefined,'account-bucket'),name=this.node('strong');name.textContent=host.label;
      const status=this.node('p',undefined,'account-muted'),labels={online:'도달 가능',offline:'연결할 수 없음',checking:'연결을 다시 시도하는 중…',unknown:'확인 안 함'};
      status.textContent=this.text(labels[host.state]||labels.unknown);
      if(host.state==='offline'&&host.nextRetryAt)status.textContent+=' · '+this.text('다음 자동 재시도:')+this.shortTime(host.nextRetryAt,true);
      const retry=this.button('SSH 연결 재시도',()=>this.perform({action:'retrySsh',host:host.host}));retry.disabled=this.busy||host.state==='checking';
      row.append(name,status,retry);this.sshHosts.append(row);
    }
  }
  render(){
    const value=this.value;if(!value)return;
    this.renderGlobalReset();
    this.renderSshHosts();
    const external=value.management?.external===true;
    this.switchHint.hidden=external;
    this.switchHint.textContent=this.text(value.scope==='profile'?'이 구성의 계정 및 기본값 Codex 독립형; 스위치는 이 구성에만 영향을 미칩니다.。':'Codex 데스크톱 및 CLI는 이 컴퓨터에 대한 액세스를 공유합니다. 전환하면 Desktop이 실행 중일 때 다시 시작됩니다.');
    this.toolsTitle.textContent=this.text(value.scope==='profile'?'계정 알림':'미리 알림 및 Codex 데스크탑 업데이트');
    this.updates.hidden=value.scope==='profile';
    if(this.desktopSettings)this.desktopSettings.hidden=value.scope==='profile';
    if(this.recover)this.recover.hidden=value.scope==='profile';
    this.tools.hidden=value.scope==='wsl';
    this.managementNotice.textContent=[value.scopeLabel,value.scope==='profile'?value.codexHome:'',this.text(value.management?.reason||'')].filter(Boolean).join(' · ');this.managementNotice.hidden=!external&&value.scope!=='profile';
    if(this.managementMode){this.managementMode.value=value.management?.mode||'auto';this.managementMode.disabled=this.busy;}
    const phase=value.switch?.phase||'idle',labels={idle:'저장된 계정을 선택하세요',preparing:'계정 준비 중',stopping:'Codex 종료',applying:'계정 설정 적용 중',starting:'Codex 시작 중',verifying:'계정 및 데스크톱 연결 확인 중',authUnknown:'계정 동기화 결과가 확인 대기 중입니다.',complete:'계정이 전환됨',restoring:'이전 계정 복원 중',restored:'이전 계정이 복원되었습니다.',failed:'전환이 완료되지 않았습니다.',interrupted:'데스크톱 앱에서 이전 계정 복원'};
    const switching=!['idle','complete','restored','failed'].includes(phase);
    const runtime=value.desktopRuntime||{};this.desktopRuntime.hidden=runtime.supported!==true||value.scope==='profile';
    const preparation=runtime.preparation||{};
    this.runtimeStatus.textContent=this.text(runtime.error||({ready:'기본 사이드 채팅 연결이 준비되었습니다.',checking:'기본 사이드 채팅 연결 자동 확인',preparing:'기본 사이드 채팅 연결을 자동으로 준비하는 중',waiting:'데스크톱이 사용 가능해지면 자동으로 준비합니다. 기존 채팅은 계속 사용할 수 있습니다',failed:'자동 준비가 완료되지 않았습니다. 연결을 다시 준비하십시오.'}[preparation.state])||(runtime.configured?'네이티브 연결 설정을 저장했습니다. 게이트웨이에서 앱을 시작할 때 적용됩니다.':'게이트웨이가 시작되면 기본 사이드 채팅 연결이 자동으로 준비됩니다.。'))+(preparation.reason?' · '+this.text(preparation.reason):'');
    this.initializeRuntime.textContent=this.text('다시 연결 준비');
    this.initializeRuntime.disabled=this.busy||switching||external||(!this.desktop&&value.canSwitch===false);
    this.forceInitializeRuntime.hidden=!(value.switch?.operation==='desktopRuntime'&&phase==='failed'&&value.switch?.taskStateUnavailable===true||preparation.state==='waiting'&&preparation.taskStateUnavailable===true);
    this.forceInitializeRuntime.disabled=this.initializeRuntime.disabled;
    const resetAccount=this.accountRows().find(row=>row.id===this.resetAccountId);
    if(this.resetDialog?.open&&(switching||!resetAccount||this.resetAccountKey&&this.resetAccountKey!==resetAccount.accountKey))this.resetDialog.close();
    this.status.textContent=this.text(labels[phase]||phase)+(value.switch?.error?' · '+this.text(value.switch.error):'');
    if(value.switch?.operation==='desktopRuntime'){
      const runtimeLabels={preparing:'네이티브 연결 준비 중',applying:'네이티브 연결 설정 저장 중',verifying:'네이티브 연결 확인 중',complete:'네이티브 연결 초기화 완료',failed:'네이티브 연결 초기화를 완료하지 못했습니다.'};
      this.status.textContent=this.text(runtimeLabels[phase]||labels[phase]||phase)+(value.switch.error?' · '+this.text(value.switch.error):'');
    }
    if(value.switch?.cliSync?.status==='verified')this.status.textContent+=' · '+this.text('로컬 CLI가 확인되었습니다.');
    else if(value.switch?.cliSync?.status==='failed')this.status.textContent+=' · '+this.text('데스크탑 전환; 로컬 CLI 확인 실패:')+this.text(value.switch.cliSync.error||'연결 상태 확인');
    else if(value.switch?.cliSync?.status==='shared-config-unverified')this.status.textContent+=' · '+this.text('공유 구성이 변경되었습니다. 로컬 CLI가 확인되지 않았습니다.');
    this.status.hidden=!value.switch?.error&&(['complete','restored'].includes(phase)||(phase==='idle'&&value.current?.status==='ready'));
    const current=value.current;this.current.textContent=this.text('현재 연결: ')+(current?.status==='ready'?(current.kind==='signedOut'?this.text('Codex가 로그아웃했습니다.'):current.name+(current.id||current.kind==='external'?'':this.text('(이 목록에는 저장되지 않음)'))):this.text(current?.status==='checking'?'식별 중…':'아직 식별되지 않음'));
    this.currentReset.hidden=!this.onReset||current?.kind!=='chatgpt'||!!value.activeId;this.currentReset.disabled=this.busy||switching;
    this.blocked.replaceChildren();for(const row of value.blockers||[]){const line=this.node('p');line.textContent=this.text(({approval:'확인 필요',running:'실행 중',queued:'대기열',unknown:'알 수 없는 결과 보내기'})[row.reason]||'실행 중')+' · '+row.title;if(row.reason==='unknown'&&row.submissionId){
      const ignore=this.button('무시하다',()=>{if(window.confirm(this.text('무시하면 확인되지 않은 기록만 무시됩니다. 메시지를 철회하거나 다시 보내지는 않습니다. 먼저 채팅 기록을 확인하세요.')))return this.perform({action:'ignoreSubmission',threadId:row.id,submissionId:row.submissionId,host:row.host||'local'});});
      ignore.disabled=this.busy||switching;line.append(ignore);
    }this.blocked.append(line);}
    this.refreshButton.disabled=this.loading;this.renderTools();const cards=[];
    if(!this.accountRows().length&&!external)cards.push(this.node('p','저장된 계정이 없습니다. 데스크탑 앱에서 ChatGPT 계정 또는 사용자 정의 API를 추가하세요.'));
    for(const row of [...this.accountRows()].sort((a,b)=>Number(b.id===value.loginAccount?.id)-Number(a.id===value.loginAccount?.id)||Number(b.id===value.activeId)-Number(a.id===value.activeId))){
      const card=this.node('section',undefined,'account-bucket'),active=value.activeId===row.id;card.accountRowId=row.id;
      if(active)card.classList.add('is-current');
      const actions=this.node('div',undefined,'accounts-card-footer');
      const identity=this.node('div',undefined,'accounts-identity'),name=this.node('div',undefined,'accounts-name');
      const heading=this.node('h3');heading.textContent=row.name;const title=this.node('div',undefined,'accounts-name-heading');title.append(heading);
      if(row.id===value.loginAccount?.id)title.append(this.node('span','로그인됨','accounts-plan'));
      if(row.kind==='chatgpt'){
        identity.classList.add('accounts-official');
        if(row.details?.usage?.planType||row.planType)title.append(this.node('span',row.details?.usage?.planType||row.planType,'accounts-plan'));
      }
      name.append(title,this.node('p',row.kind==='chatgpt'?(row.email||this.text('공식 ChatGPT 계정')):(row.baseUrl+' · '+row.model),'account-muted'));
      if(row.kind==='chatgpt')this.accountSubscription(name,row);
      identity.append(name);this.accountUsage(identity,row);card.append(identity);
      if(row.kind==='chatgpt')this.accountReset(card,row,switching);
      if(!row.transient){const verifyAuth=value.switch?.operation==='cliAuth'&&phase==='authUnknown'&&value.switch.targetId===row.id;const choose=this.button(verifyAuth?'계정 동기화 확인':active?'현재 계정':'이 계정으로 전환',()=>this.choose(row));choose.disabled=this.busy||switching&&!verifyAuth||active||external||(!this.desktop&&value.canSwitch===false);actions.append(choose);}

      if(this.cliAccess&&row.kind==='api'&&!row.transient){
        if(!active){const edit=this.button('편집',()=>{this.apiDetails.open=true;this.cliAccess.edit('codex',row);});edit.disabled=this.busy||switching||this.cliAccess.busy;actions.append(edit);}
        for(const [label,action] of [['업스트림 모델 나열','models'],['테스트 모델 엔드포인트','test']]){const probe=this.button(label,()=>{this.apiDetails.open=true;return this.cliAccess.probe(row,action);});probe.disabled=this.busy||switching||this.cliAccess.busy;actions.append(probe);}
      }
      if(this.desktop&&!row.transient){
        const edit=this.button(row.kind==='chatgpt'?'다시 로그인':'편집',()=>{this.resetForm();this.editId=row.id;this.addDetails.open=true;this.name.input.value=row.name;this.kind.value=row.kind;this.kind.disabled=true;this.kind.onchange();this.url.input.value=row.baseUrl||'';this.model.input.value=row.model||'';this.key.input.value='';this.name.input.focus();});
        edit.hidden=active||row.kind==='api'&&!!this.cliAccess;edit.disabled=this.busy||switching||active;
        const rename=this.button('이름 바꾸기',()=>{this.renameId=row.id;this.renameName.input.value=row.name;this.renameForm.hidden=false;this.renameName.input.focus();});rename.disabled=this.busy||switching;
        const remove=this.button('삭제',()=>{if(window.confirm(this.text('저장된 계정을 삭제하시겠습니까?')+'\n'+row.name))this.perform({action:'delete',id:row.id});});remove.hidden=active;remove.disabled=this.busy||switching||active;
        actions.append(edit,rename,remove);
      }
      card.append(actions);this.accountActions(card,row,actions);if(row.kind==='chatgpt')actions.append(this.accountUsageControls(row));cards.push(card);
    }
    if(!this.desktop&&value.canSwitch===false&&!external)cards.push(this.node('p','인증 없이는 계정 전환이 불가능합니다. 데스크톱 앱을 사용하세요.'));
    this.reconcileRows(cards);
    if(this.desktop){
      this.scanDesktop.disabled=this.busy||switching;this.renameSave.disabled=this.busy||switching;this.scanButton.disabled=this.busy||switching;this.modelsButton.disabled=this.busy||switching||!!this.apiEditor?.draftLoading;this.submit.disabled=this.busy||switching||!!this.apiEditor?.draftLoading;
      const candidates=this.scanCandidates();this.scanChoice.replaceChildren();this.scanChoice.hidden=candidates.length<2;
      const choose=this.node('option','저장할 구성을 선택하세요.');choose.value='';this.scanChoice.append(choose);
      for(const row of candidates){const option=this.node('option');option.value=row.id;option.textContent=row.name;this.scanChoice.append(option);}this.scanChoice.value=this.scanSelection||'';
      this.saveScanButton.disabled=this.busy||switching||!candidates.some(row=>row.id===this.scanSelection);
      this.scanSource.input.placeholder=value.codexHome||this.configurationPlaceholder||this.text('현재 Codex 데이터 디렉터리를 사용하려면 비워 두세요.');this.scanRows.replaceChildren();
      if(value.discovery){const scan=value.discovery;const source=this.node('p',undefined,'account-muted');source.textContent=scan.source||'';this.scanRows.append(source);
        if(scan.notice)this.scanRows.append(this.node('p',scan.notice,'account-muted'));
        if(!scan.candidates.length)this.scanRows.append(this.node('p','저장된 계정 또는 API 구성을 찾을 수 없습니다.'));
        for(const row of scan.candidates){const card=this.node('section',undefined,'account-bucket'),heading=this.node('h3');heading.textContent=row.name;
          const detail=this.node('p',undefined,'account-muted');detail.textContent=row.email||[row.baseUrl,row.model].filter(Boolean).join(' · ');card.append(heading,detail);
          if(row.reason)card.append(this.node('p',row.reason,'account-muted'));
          const button=this.button(row.imported?'수입됨':row.kind==='api'?'선택 및 가져오기':'계정 가져오기',()=>this.importCandidate(row));button.disabled=this.busy||switching||row.imported||!row.canImport;
          card.append(button);this.scanRows.append(card);}
      }
      if(document.activeElement!==this.executable.input&&!this.executable.input.value)this.executable.input.value=value.desktopExecutable||'';
      this.recover.disabled=this.busy||external||phase!=='interrupted';this.submit.disabled=this.busy||switching||['starting','waiting'].includes(value.enrollment?.phase);
      this.loginBox.replaceChildren();const login=value.enrollment;
      if(login){
        this.loginBox.append(this.node('p',({starting:'로그인 준비 중',waiting:'이 컴퓨터의 브라우저에서 공식 로그인을 완료하세요.',complete:'계정이 추가됨',failed:'로그인이 완료되지 않았습니다. 다시 시도해 주세요.'})[login.phase]||''));
        if(login.phase==='waiting'&&login.authUrl){this.loginBox.append(this.button('공식 로그인 열기',()=>this.perform({action:'openLogin'})));}
        if(['starting','waiting'].includes(login.phase))this.loginBox.append(this.button('로그인 취소',()=>this.perform({action:'cancelLogin'})));
      }
    }
  }
}
