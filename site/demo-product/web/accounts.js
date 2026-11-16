/* Shared account selector; enrollment controls exist only in the desktop host. */
class AccountsPanel {
  constructor({root,read,request,desktop=false,toolbar=null,onChanged=()=>{},onUpdate=()=>{},onReset=null}){
    Object.assign(this,{root,read,request,desktop,toolbar,onChanged,onUpdate,onReset});this.value=null;this.busy=false;this.timer=null;this.generation=0;this.operationError=false;this.expandedModels=new Set();
    this.build();
  }
  text(value){return typeof BridgeI18n==='undefined'?value:BridgeI18n.t(value);}
  node(tag,text,className){const n=document.createElement(tag);if(text!==undefined){n.textContent=this.text(text);if(typeof BridgeI18n!=='undefined'&&Object.hasOwn(BridgeI18n.dictionary,text))n.setAttribute('data-i18n',text);}if(className)n.className=className;return n;}
  button(text,fn){const n=this.node('button',text);n.type='button';n.onclick=fn;return n;}
  field(label,type='text'){const wrap=this.node('label'),input=document.createElement('input');input.type=type;wrap.append(this.node('span',label),input);return {wrap,input};}
  build(){
    this.root.replaceChildren();this.root.classList.add('accounts-panel');
    const header=this.toolbar||this.node('div',undefined,'accounts-toolbar');
    if(this.desktop)header.append(this.node('h2',"저장된 연결"));
    this.refreshButton=this.button('새로 고치다',()=>this.refresh());this.refreshButton.className='accounts-refresh';header.append(this.refreshButton);if(!this.toolbar)this.root.append(header);
    this.root.append(this.node('p',"전환하면 이 컴퓨터에서 Codex가 다시 시작됩니다. 모바일 게이트웨이는 온라인 상태를 유지합니다.",'account-muted'));
    this.status=this.node('p',undefined,'account-muted');this.status.setAttribute('role','status');
    this.error=this.node('p',undefined,'error');this.error.setAttribute('role','alert');
    this.rows=this.node('div',undefined,'accounts-list');
    this.currentReset=this.button("재설정 크레딧 보기 및 사용",()=>this.onReset?.());this.currentReset.hidden=true;
    this.current=this.node('p',undefined,'accounts-current');this.blocked=this.node('div',undefined,'account-muted');this.root.append(this.current,this.status,this.error,this.currentReset,this.blocked,this.rows);
    this.management=this.node('div',undefined,'accounts-management');this.root.append(this.management);
    this.tools=this.node('details');this.tools.append(this.node('summary',"미리 알림 및 Codex 데스크탑 업데이트"));
    this.reminders=this.node('div');this.updates=this.node('section');this.tools.append(this.reminders,this.updates);this.management.append(this.tools);
    if(!this.desktop){this.root.append(this.node('p',"데스크톱 앱에서 계정을 추가, 편집, 제거하세요.",'account-muted'));return;}
    const scanDetails=this.node('details');scanDetails.append(this.node('summary','로컬 구성 스캔'));
    this.scanSource=this.field("Codex 구성 디렉터리");this.scanSource.input.placeholder=this.text("현재 Codex 데이터 디렉터리를 사용하려면 비워 두세요.");
    this.scanButton=this.button('스캔 구성',()=>this.perform({action:'scan',source:this.scanSource.input.value}));
    this.scanRows=this.node('div');scanDetails.append(this.scanSource.wrap,this.scanButton,this.scanRows);this.management.append(scanDetails);
    this.renameForm=this.node('form');this.renameForm.hidden=true;this.renameName=this.field('이름');this.renameName.input.maxLength=80;this.renameName.input.required=true;
    this.renameSave=this.node('button','이름 저장');this.renameSave.type='submit';
    this.renameForm.append(this.renameName.wrap,this.renameSave,this.button('편집 취소',()=>{this.renameForm.hidden=true;}));
    this.renameForm.onsubmit=async event=>{event.preventDefault();if(await this.perform({action:'rename',id:this.renameId,name:this.renameName.input.value}))this.renameForm.hidden=true;};
    this.root.append(this.renameForm);
    const details=this.node('details');details.append(this.node('summary',"계정 추가 또는 API"));
    this.form=this.node('form');this.name=this.field('이름');this.name.input.maxLength=80;this.name.input.required=true;
    this.kind=document.createElement('select');this.kind.setAttribute('aria-label',this.text("제공자 유형"));
    for(const [value,label] of [['chatgpt',"공식 ChatGPT 계정"],['api','사용자 정의 API']]){const option=this.node('option',label);option.value=value;this.kind.append(option);}
    this.url=this.field("API URL");this.url.input.placeholder='https://api.example.com/v1';
    this.key=this.field('API Key','password');this.key.input.autocomplete='new-password';this.key.input.maxLength=8192;
    this.model=this.field('기본 모델');this.model.input.maxLength=200;
    this.modelOptions=this.node('select');this.modelOptions.setAttribute('aria-label',this.text("공급자 모델"));this.modelOptions.hidden=true;
    this.modelOptions.onchange=()=>{if(this.modelOptions.value)this.model.input.value=this.modelOptions.value;};
    this.modelsButton=this.button("공급자 모델 가져오기",async()=>{
      const context=()=>JSON.stringify([this.importId,this.editId,this.kind.value,this.url.input.value,this.key.input.value]),started=context();
      const payload=this.importId?{action:'models',candidateId:this.importId}:{action:'models',id:this.editId,baseUrl:this.url.input.value,apiKey:this.key.input.value};
      if(await this.perform(payload)){if(started!==context())return;this.modelOptions.replaceChildren(this.node('option',"모델을 선택하세요"));
        this.modelOptions.children[0].value='';for(const id of this.value.models||[]){const option=this.node('option');option.textContent=id;option.value=id;this.modelOptions.append(option);}
        this.modelOptions.hidden=false;this.modelMessage.textContent=this.text("목록에는 응답 API를 지원하지 않는 모델이 포함될 수 있습니다. 호환되는 채팅 모델을 선택하세요.");}
    });
    this.modelMessage=this.node('p',undefined,'account-muted');
    const clearModels=()=>{this.modelOptions.replaceChildren();this.modelOptions.hidden=true;this.modelMessage.textContent='';};
    this.url.input.oninput=clearModels;this.key.input.oninput=clearModels;this.clearModels=clearModels;
    const fields=()=>{this.modelsButton.hidden=this.kind.value!=='api';if(this.kind.value!=='api')clearModels();for(const field of [this.url,this.key,this.model])field.wrap.hidden=this.kind.value!=='api';};this.kind.onchange=fields;fields();
    this.submit=this.node('button',"계속");this.submit.type='submit';
    this.cancelEdit=this.button('편집 취소',()=>{this.resetForm();fields();});
    this.form.append(this.name.wrap,this.kind,this.url.wrap,this.key.wrap,this.model.wrap,this.modelsButton,this.modelOptions,this.modelMessage,this.submit,this.cancelEdit);
    this.form.onsubmit=async event=>{
      event.preventDefault();const payload={name:this.name.input.value};
      if(this.importId)Object.assign(payload,{action:'import',candidateId:this.importId,model:this.model.input.value});
      else if(this.kind.value==='api')Object.assign(payload,{action:'addApi',id:this.editId,baseUrl:this.url.input.value,apiKey:this.key.input.value,model:this.model.input.value});
      else Object.assign(payload,{action:'login',replaceId:this.editId});
      if(await this.perform(payload)){this.resetForm();fields();}
    };
    details.append(this.form,this.node('p',"자격 증명은 이 컴퓨터의 개인 디렉터리에 유지됩니다. 사용자 정의 API는 API 응답을 지원해야 합니다.",'account-muted'));
    this.loginBox=this.node('div');details.append(this.loginBox);this.management.append(details);this.addDetails=details;
    const settings=this.node('details');settings.append(this.node('summary',"데스크탑 애플리케이션 및 복구"));
    this.executable=this.field("데스크탑 실행 파일");this.executable.input.placeholder=this.text(".app 번들 또는 데스크톱 실행 파일 선택");
    this.scanDesktop=this.button("데스크톱 앱 검색",()=>this.perform({action:'scanDesktop'}));
    settings.append(this.executable.wrap,this.scanDesktop,this.button("응용 프로그램 경로 저장",()=>this.perform({action:'configure',desktopExecutable:this.executable.input.value})));
    this.recover=this.button("이전 계정 복원",()=>{if(window.confirm(this.text("이전 계정을 복원하고 Codex를 다시 시작하시겠습니까?")))this.perform({action:'recover',confirmed:true});});
    settings.append(this.recover);this.management.append(settings);
  }
  resetForm(){this.editId=null;this.importId=null;this.form.reset();this.key.input.value='';this.kind.disabled=false;this.url.input.disabled=false;this.key.input.disabled=false;this.clearModels();}
  importCandidate(row){
    if(row.kind==='chatgpt'){this.perform({action:'import',candidateId:row.id});return;}
    this.resetForm();this.importId=row.id;this.addDetails.open=true;this.name.input.value=row.name;this.kind.value='api';this.kind.disabled=true;this.kind.onchange();
    this.url.input.value=row.baseUrl;this.model.input.value=row.model||'';this.url.input.disabled=true;this.key.input.disabled=true;this.model.input.focus();
  }
  async perform(payload){
    if(this.busy)return false;clearTimeout(this.timer);this.generation++;this.loading=false;this.busy=true;this.operationError=false;this.error.textContent='';this.render();const generation=this.generation;
    try{const value=await this.request(payload);if(generation===this.generation){this.accept(value);return true;}return false;}
    catch(error){if(generation===this.generation){this.operationError=true;this.error.textContent=this.text(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}return false;}
    finally{if(generation===this.generation){this.busy=false;this.render();this.timer=setTimeout(()=>this.refresh(),2000);}}
  }
  async refresh(){
    clearTimeout(this.timer);if(this.loading||this.busy)return;this.loading=true;const generation=this.generation;
    try{const value=await this.read();if(generation===this.generation){if(!this.operationError)this.error.textContent='';this.accept(value);await this.loadUsage(generation);}}
    catch(error){if(generation===this.generation)this.error.textContent=this.text(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}
    finally{if(generation===this.generation){this.loading=false;this.render();this.timer=setTimeout(()=>{const dialog=this.root.closest('dialog');if(!this.root.closest('[hidden]')&&!document.hidden&&(!dialog||dialog.open))this.refresh();},2000);}}
  }
  visible(){const dialog=this.root.closest('dialog');return !this.root.closest('[hidden]')&&!document.hidden&&(!dialog||dialog.open);}
  async loadUsage(generation){
    if(!this.visible())return;
    if(!['idle','complete','restored','failed'].includes(this.value?.switch?.phase||'idle'))return;
    for(const row of this.value?.accounts||[]){
      const usage=row.details?.usage;
      if(row.kind!=='chatgpt'||usage?.status==='loading'||(usage&&Date.now()/1000-(usage.checkedAt||0)<300))continue;
      if(generation!==this.generation||this.busy)return;
      const value=await this.request({action:'details',id:row.id,section:'usage'});
      if(generation===this.generation&&!this.busy)this.accept(value);
    }
  }
  relative(minutes){const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return [days?days+this.text("날"):'',hours?hours+this.text("시간"):'',rest?rest+this.text("분"):''].filter(Boolean).join(' ');}
  resetTime(stamp){const minutes=Math.ceil((stamp*1000-Date.now())/60000);return (minutes>0?this.relative(minutes)+this.text("재설정될 때까지"):this.text('새로고침을 기다리는 중'))+' · '+new Date(stamp*1000).toLocaleString(BridgeI18n.locale());}
  accountUsage(card,row){
    if(row.kind==='chatgpt'){
      const usage=row.details?.usage,box=this.node('div',undefined,'accounts-usage');
      if(usage?.status==='loading'&&!usage.limits)box.append(this.node('span',"확인 중…",'account-query'));
      else if(!usage)box.append(this.node('span',"사용량 로드 중…",'account-muted'));
      else if(usage.status==='error')box.append(this.node('span',usage.error,'account-muted'));
      if(usage?.limits){
        for(const bucket of usage.limits||[])for(const window of bucket.windows||[]){
          const line=this.node('div',undefined,'accounts-window'),minutes=window.windowDurationMins;
          const label=minutes?minutes%1440===0?minutes/1440+this.text("날"):minutes%60===0?minutes/60+this.text("시간"):minutes+this.text("분"):this.text("사용량 창");
          line.append(this.node('span',bucket.name+' · '+label),this.node('strong',window.remainingPercent==null?this.text("사용할 수 없음"):this.text("남은")+Math.round(window.remainingPercent*10)/10+'%'));
          if(window.remainingPercent!=null){const progress=this.node('progress');progress.max=100;progress.value=window.remainingPercent;progress.setAttribute('aria-label',this.text("남은 할당량"));line.append(progress);}
          if(window.resetsAt){const reset=this.node('small',undefined,'account-reset-time');reset.textContent=this.resetTime(window.resetsAt);line.append(reset);}box.append(line);
        }
        if(!usage.limits?.length)box.append(this.node('span',"아직 사용량 한도를 확인할 수 없습니다.",'account-muted'));
        for(const bucket of usage.limits||[])if(bucket.credits){const credit=bucket.credits;box.append(this.node('p',bucket.name+' · Credits: '+(credit.unlimited?this.text('제한 없는'):credit.balance??this.text("사용할 수 없음")),'account-muted'));}
        const period=usage.subscription?.periodEndsAt,online=usage.subscription?.source==='online';
        if(Number.isFinite(period)&&(online||period>Date.now()/1000))box.append(this.node('p',this.text(online?"구독 기간 종료일:":"로그인 기록의 구독 날짜(실시간 아님):")+new Date(period*1000).toLocaleString(BridgeI18n.locale()),'account-subscription'));
        else box.append(this.node('p',this.text("구독 종료 날짜가 확인되지 않았습니다."),'account-subscription'));
        if(usage.subscription?.error)box.append(this.node('p',this.text(usage.subscription.error),'account-muted'));
        box.append(this.node('p',this.text(online?"온라인에서 검색된 날짜입니다. 갱신 및 청구 상태는 ChatGPT 구독 페이지를 확인하세요.":"로그인 기록이 오래되었을 수 있습니다. ChatGPT 구독 페이지를 참조하세요."),'account-muted'));
        if(usage.updatedAt)box.append(this.node('small',this.text("업데이트 날짜:")+new Date(usage.updatedAt*1000).toLocaleString(BridgeI18n.locale())+(usage.status==='loading'?' · '+this.text("확인 중…"):''),'account-updated'));
        if(usage.status==='error')box.append(this.node('small',"마지막 결과를 표시합니다. 데이터가 업데이트되지 않았습니다",'account-muted'));
        const expiry=usage.resetCredits?.credits?.filter(c=>c.status==='available'&&c.resetType==='codexRateLimits'&&typeof c.expiresAt==='number'&&c.expiresAt>Date.now()/1000).map(c=>c.expiresAt).sort((a,b)=>a-b)[0];
        if(expiry)box.append(this.node('small',this.text("다음 재설정 크레딧 만료일:")+new Date(expiry*1000).toLocaleString(BridgeI18n.locale()),'account-muted'));
      }
      const refresh=this.button("남은 할당량 보기",()=>this.perform({action:'details',id:row.id,section:'usage',refresh:true}));refresh.disabled=this.busy||usage?.status==='loading';box.append(refresh);card.append(box);
    }
  }
  async openReset(row){
    if(this.resetDialog?.open)return;
    const dialog=this.node('dialog',undefined,'picker account-reset-dialog'),heading=this.node('h2',this.text("재설정 사용")+' · '+row.name);
    const close=this.button('닫기',()=>dialog.close()),content=this.node('div'),button=this.node('button');
    const header=this.node('div',undefined,'picker-head');header.append(heading,close);dialog.append(header,content);
    const panel=new AccountPanel({root:content,button,
      read:refresh=>this.request({action:'account',id:row.id,operation:'read',refresh}),
      consume:value=>this.request({action:'account',id:row.id,operation:'consume',...value}),
      onConsumed:()=>this.perform({action:'details',id:row.id,section:'usage',refresh:true}),
      visible:()=>dialog.open&&this.visible()});
    this.resetDialog=dialog;this.resetPanel=panel;this.resetAccountId=row.id;
    dialog.onclose=()=>{panel.clear();dialog.remove();this.resetDialog=null;this.resetPanel=null;this.resetAccountId=null;};
    document.body.append(dialog);dialog.showModal();await panel.refresh();
  }
  accountModels(card,row){
    const models=row.details?.models,opened=this.expandedModels.has(row.id);
    const show=this.button(opened?"모델 숨기기":'사용 가능한 모델 보기',()=>{if(opened){this.expandedModels.delete(row.id);this.render();}else{this.expandedModels.add(row.id);this.perform({action:'details',id:row.id,section:'models'});}});show.disabled=this.busy;card.append(show);
    if(opened){const box=this.node('div',undefined,'accounts-models');
      if(!models||models.status==='loading')box.append(this.node('p',"모델 로드 중…"));
      else if(models.status==='error'){box.append(this.node('p',models.error));box.append(this.button("다시 시도",()=>this.perform({action:'details',id:row.id,section:'models',refresh:true})));}
      else if(!models.models?.length)box.append(this.node('p',"사용 가능한 모델이 없습니다."));
      else for(const model of models.models){const line=this.node('div');line.textContent=model.name===model.id?model.id:model.name+' · '+model.id;box.append(line);}card.append(box);
    }
  }
  accept(value){const old=this.value;if(!this.desktop&&old?.canSwitch===false&&value.canSwitch===undefined)value={...value,canSwitch:false};this.value=value;if(old&&(old.activeId!==value.activeId||old.current?.kind!==value.current?.kind||old.current?.name!==value.current?.name||old.switch?.phase!==value.switch?.phase))this.onChanged(value);this.onUpdate(value);this.render();}
  clear(){this.resetDialog?.close();clearTimeout(this.timer);this.generation++;this.value=null;this.loading=false;this.busy=false;this.operationError=false;this.error.textContent='';this.rows.replaceChildren();}
  requestId(){
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  async choose(row){
    if(!window.confirm(this.text("여기에 표시되지 않은 작업을 포함하여 모든 데스크톱 작업이 종료되었는지 확인합니다. 액세스를 전환하고 Codex 데스크톱을 다시 시작하시겠습니까?")+'\n'+row.name))return;
    try{await this.perform({action:'switch',id:row.id,requestId:this.requestId(),confirmed:true,tasksConfirmed:true});this.refresh();}
    catch(error){this.operationError=true;this.error.textContent=this.text("전환 요청을 생성할 수 없습니다. 새로고침하고 다시 시도하세요.");}
  }
  renderTools(){
    const value=this.value;if(!value)return;
    this.reminders.replaceChildren();
    this.reminders.append(this.node('p',"미리 알림은 컴퓨터에 구성된 Bark, ntfy 또는 PushPlus를 사용합니다. 컴퓨터와 게이트웨이를 계속 실행하세요.",'account-muted'));
    const labels={lowQuota:"할당량이 10% 이하일 때 알림",quotaReset:"할당량 복구 확인 후 알림",resetExpiry:"재설정 크레딧이 만료되기 24시간 전에 알림",subscriptionExpiry:"구독 기간이 종료되기 7일, 3일, 1일 전에 알림을 받으세요.",desktopUpdate:"새로운 Codex 데스크탑 릴리스에 대해 알림"};
    for(const [key,label] of Object.entries(labels)){
      const wrap=this.node('label',undefined,'account-reminder'),input=document.createElement('input');input.type='checkbox';input.checked=!!value.reminders?.[key];input.disabled=this.busy;
      input.onchange=()=>this.perform({action:'reminders',preferences:{[key]:input.checked}});wrap.append(input,this.node('span',label));this.reminders.append(wrap);
    }
    if(value.reminderError)this.reminders.append(this.node('p',value.reminderError,'error'));
    const update=value.desktopUpdate||{state:'idle'},labelsUpdate={idle:'아직 확인되지 않음',checking:"공식 업데이트 채널 확인 중…",available:"공식 채널에 새 버전이 게시되었습니다.",checked:"이 검사에는 최신 공개 버전이 없습니다.",unsupported:"컴퓨터에서 확인하세요",error:'업데이트 확인 실패',requesting:"네이티브 업데이트 프로그램을 여는 중…",needsDesktop:"컴퓨터에서 확인을 기다리는 중"};
    this.updates.replaceChildren(this.node('h3',"Codex 데스크탑 업데이트"),this.node('p',update.failureReason?"업데이트 프로그램을 열 수 없습니다.":labelsUpdate[update.state]||update.state));
    this.updates.append(this.node('p',"원격으로 새 버전을 확인할 수 있습니다. 다운로드 및 설치에는 여전히 컴퓨터에서 확인이 필요합니다.",'account-muted'));
    if(update.currentVersion)this.updates.append(this.node('p',this.text("현재 버전:")+update.currentVersion+(update.targetVersion?' → '+update.targetVersion:''),'account-muted'));
    if(update.installation?.state==='verified'){const installed=this.node('p',undefined,'account-muted');installed.textContent=this.text("설치된 데스크톱 버전이 업데이트된 것으로 확인되었습니다.")+' · '+update.installation.previousBuild+' → '+update.installation.currentBuild;this.updates.append(installed);}
    if(update.message)this.updates.append(this.node('p',update.message,'account-muted'));
    if(update.checkedAt)this.updates.append(this.node('small',this.text("확인 장소:")+new Date(update.checkedAt*1000).toLocaleString(BridgeI18n.locale()),'account-muted'));
    const checking=['checking','requesting'].includes(update.state),denied=!this.desktop&&value.canSwitch===false;
    const check=this.button("새로운 Codex 버전 확인",()=>this.perform({action:'checkDesktopUpdate'}));check.disabled=this.busy||checking||denied;this.updates.append(check);
    if(update.canRequest&&update.currentBuild){const request=this.button("컴퓨터에서 업데이터를 엽니다.",()=>{
      if(window.confirm(this.text("여기에 표시되지 않는 작업을 포함하여 모든 데스크톱 작업이 완료되었는지 확인하고 컴퓨터에서 Codex의 업데이트 확인을 여시겠습니까? Codex는 업데이트 확인, 다운로드 및 설치를 처리합니다.")))
        this.perform({action:'requestDesktopUpdate',requestId:this.requestId(),currentBuild:update.currentBuild,confirmed:true,tasksConfirmed:true});
    });request.disabled=this.busy||checking||denied;this.updates.append(request);}
  }
  render(){
    const value=this.value;if(!value)return;
    const phase=value.switch?.phase||'idle',labels={idle:"저장된 계정을 선택하세요",preparing:'계정 준비 중',stopping:"Codex 종료",applying:"계정 설정 적용 중",starting:"Codex 시작 중",verifying:'계정 및 데스크톱 연결 확인 중',complete:"계정이 전환됨",restoring:"이전 계정 복원 중",restored:"이전 계정이 복원되었습니다.",failed:'전환이 완료되지 않았습니다.',interrupted:"데스크톱 앱에서 이전 계정 복원"};
    const switching=!['idle','complete','restored','failed'].includes(phase);
    if(this.resetDialog?.open&&(switching||!value.accounts.some(row=>row.id===this.resetAccountId)))this.resetDialog.close();
    this.status.textContent=this.text(labels[phase]||phase)+(value.switch?.error?' · '+this.text(value.switch.error):'');
    this.status.hidden=phase==='idle'&&value.current?.status==='ready';
    const current=value.current;this.current.textContent=this.text("현재 연결:")+(current?.status==='ready'?(current.kind==='signedOut'?this.text("Codex가 로그아웃했습니다."):current.name+(current.id?'':this.text("(이 목록에는 저장되지 않음)"))):this.text(current?.status==='checking'?"식별 중…":"아직 확인되지 않음"));
    this.currentReset.hidden=!this.onReset||current?.kind!=='chatgpt'||!!value.activeId;this.currentReset.disabled=this.busy||switching;
    this.blocked.replaceChildren();for(const row of value.blockers||[]){const line=this.node('p');line.textContent=this.text(({approval:"확인 필요",running:"실행 중",queued:'대기열',unknown:"알 수 없는 결과 보내기"})[row.reason]||"실행 중")+' · '+row.title;if(row.reason==='unknown'&&row.submissionId){
      const ignore=this.button("무시하다",()=>{if(window.confirm(this.text("무시하면 확인되지 않은 기록만 무시됩니다. 메시지를 철회하거나 다시 보내지는 않습니다. 먼저 채팅 기록을 확인하세요.")))return this.perform({action:'ignoreSubmission',threadId:row.id,submissionId:row.submissionId,host:row.host||'local'});});
      ignore.disabled=this.busy||switching;line.append(ignore);
    }this.blocked.append(line);}
    this.refreshButton.disabled=this.loading;this.rows.replaceChildren();this.renderTools();
    if(!value.accounts.length)this.rows.append(this.node('p',"저장된 계정이 없습니다. 데스크탑 앱에서 ChatGPT 계정 또는 사용자 정의 API를 추가하세요."));
    for(const row of [...value.accounts].sort((a,b)=>Number(b.id===value.activeId)-Number(a.id===value.activeId))){
      const card=this.node('section',undefined,'account-bucket'),active=value.activeId===row.id;
      if(active)card.classList.add('is-current');
      const actions=this.node('div',undefined,'accounts-actions');
      const identity=this.node('div',undefined,'accounts-identity'),name=this.node('div',undefined,'accounts-name');
      const heading=this.node('h3');heading.textContent=row.name;const title=this.node('div',undefined,'accounts-name-heading');title.append(heading);
      if(row.kind==='chatgpt'){
        if(row.details?.usage?.planType||row.planType)title.append(this.node('span',row.details?.usage?.planType||row.planType,'accounts-plan'));
        const usage=row.details?.usage;
        const count=usage?.resetCredits?.availableCount;
        if(this.onReset){
          const reset=this.button("재설정 사용",()=>this.openReset(row));reset.classList.add('accounts-reset');reset.disabled=this.busy||switching;
          reset.setAttribute('aria-label',this.text("선택한 계정의 재설정 크레딧 보기 및 사용"));title.append(reset);
        }
        if(usage?.resetCredits)title.append(this.node('span',this.text("사용량 재설정")+' · '+(count??this.text("사용할 수 없음")),'accounts-credit'));
      }
      name.append(title,this.node('p',row.kind==='chatgpt'?(row.email||this.text("공식 ChatGPT 계정")):(row.baseUrl+' · '+row.model),'account-muted'));
      identity.append(name);this.accountUsage(identity,row);card.append(identity);
      const choose=this.button(active?"당좌 계정":"이 계정으로 전환하세요",()=>this.choose(row));choose.disabled=this.busy||switching||active||(!this.desktop&&value.canSwitch===false);actions.append(choose);
      if(this.desktop){
        const edit=this.button(row.kind==='chatgpt'?"다시 로그인":"편집하다",()=>{this.resetForm();this.editId=row.id;this.addDetails.open=true;this.name.input.value=row.name;this.kind.value=row.kind;this.kind.disabled=true;this.kind.onchange();this.url.input.value=row.baseUrl||'';this.model.input.value=row.model||'';this.key.input.value='';this.name.input.focus();});
        edit.hidden=active;edit.disabled=this.busy||switching||active;
        const rename=this.button('이름 바꾸기',()=>{this.renameId=row.id;this.renameName.input.value=row.name;this.renameForm.hidden=false;this.renameName.input.focus();});rename.disabled=this.busy||switching;
        const remove=this.button('삭제',()=>{if(window.confirm(this.text("저장된 계정을 삭제하시겠습니까?")+'\n'+row.name))this.perform({action:'delete',id:row.id});});remove.hidden=active;remove.disabled=this.busy||switching||active;
        actions.append(edit,rename,remove);
      }
      this.accountModels(actions,row);card.append(actions);this.rows.append(card);
    }
    if(!this.desktop&&value.canSwitch===false)this.rows.append(this.node('p',"인증 없이는 계정 전환이 불가능합니다. 데스크톱 앱을 사용하세요."));
    if(this.desktop){
      this.scanDesktop.disabled=this.busy||switching;this.renameSave.disabled=this.busy||switching;this.scanButton.disabled=this.busy||switching;this.modelsButton.disabled=this.busy||switching;
      this.scanSource.input.placeholder=value.codexHome||this.text("현재 Codex 데이터 디렉터리를 사용하려면 비워 두세요.");this.scanRows.replaceChildren();
      if(value.discovery){const scan=value.discovery;const source=this.node('p',undefined,'account-muted');source.textContent=scan.source||'';this.scanRows.append(source);
        if(scan.notice)this.scanRows.append(this.node('p',scan.notice,'account-muted'));
        if(!scan.candidates.length)this.scanRows.append(this.node('p',"저장된 계정 또는 API 구성을 찾을 수 없습니다."));
        for(const row of scan.candidates){const card=this.node('section',undefined,'account-bucket'),heading=this.node('h3');heading.textContent=row.name;
          const detail=this.node('p',undefined,'account-muted');detail.textContent=row.email||[row.baseUrl,row.model].filter(Boolean).join(' · ');card.append(heading,detail);
          if(row.reason)card.append(this.node('p',row.reason,'account-muted'));
          const button=this.button(row.imported?'수입됨':row.kind==='api'?'선택 및 가져오기':'계정 가져오기',()=>this.importCandidate(row));button.disabled=this.busy||switching||row.imported||!row.canImport;
          card.append(button);this.scanRows.append(card);}
      }
      if(document.activeElement!==this.executable.input&&!this.executable.input.value)this.executable.input.value=value.desktopExecutable||'';
      this.recover.disabled=this.busy||phase!=='interrupted';this.submit.disabled=this.busy||switching||['starting','waiting'].includes(value.enrollment?.phase);
      this.loginBox.replaceChildren();const login=value.enrollment;
      if(login){
        this.loginBox.append(this.node('p',({starting:'로그인 준비 중',waiting:"이 컴퓨터의 브라우저에서 공식 로그인을 완료하세요.",complete:"계정이 추가됨",failed:"로그인이 완료되지 않았습니다. 다시 시도해 주세요."})[login.phase]||''));
        if(login.phase==='waiting'&&login.authUrl){this.loginBox.append(this.button('공식 로그인 열기',()=>this.perform({action:'openLogin'})));}
        if(['starting','waiting'].includes(login.phase))this.loginBox.append(this.button('로그인 취소',()=>this.perform({action:'cancelLogin'})));
      }
    }
  }
}
