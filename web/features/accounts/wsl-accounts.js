'use strict';
// WSL credentials and account state are scoped to a registered environment.
class WslAccountsPanel {
  constructor({root,provider,read,request,desktop=false,onSwitched}){
    Object.assign(this,{root,provider,read,request,desktop,onSwitched});this.entry='';this.generation=0;this.value=null;this.models=new Map();this.busy=false;
    root.classList.add('wsl-accounts-panel');this.onLanguage=()=>this.render();document.addEventListener('bridge-language',this.onLanguage);this.render();
  }
  t(key){return BridgeI18n.t(key);}
  node(tag,text='',className=''){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
  button(key,action){const node=this.node('button',this.t(key));node.type='button';node.onclick=action;node.disabled=this.busy;return node;}
  clear(){this.generation++;this.value=null;this.models.clear();this.busy=false;this.entry='';this.error='';this.editRow=null;this.sources=null;if(this.key)this.key.value='';this.render();}
  dispose(){this.clear();document.removeEventListener('bridge-language',this.onLanguage);}
  select(entry){this.clear();this.entry=entry||'';this.root.hidden=!this.entry;if(this.entry)return this.refresh();}
  async refresh(){if(!this.entry||this.busy)return;const generation=++this.generation,entry=this.entry;this.busy=true;this.error='';this.render();try{const value=await this.read(entry);if(generation!==this.generation)return;if(value.entry!==entry||value.provider!==this.provider)throw Error('WSL 계정 결과가 선택한 환경과 일치하지 않습니다.');if(value.restartPending)this.error=value.restartError||'계정 구성이 적용되었으나 공유 서비스가 복구되지 않았습니다. 확인하고 복구하세요. 계정 전환을 반복하지 마십시오.';else if(value.continuationPending)this.error=value.continuationError||'계정 구성이 전환되었지만 아직 채팅 연속성이 확인되지 않았습니다. 확인하려면 새로고침하세요. 스위치를 다시 제출하지 마십시오.';else if(Array.isArray(value.draftContinuations))this.onSwitched?.(value);this.value=value;}catch(error){if(generation===this.generation)this.error=error.message;}finally{if(generation===this.generation){this.busy=false;this.render();}}}
  async perform(action,fields={}){
    if(this.busy||!this.entry||(!this.value?.available&&!(action==='connect'&&this.value?.capabilities?.connect)))return;
    const generation=++this.generation,entry=this.entry,payload={provider:this.provider,entry,action,...(['switch','recover-restart'].includes(action)?{expectedIdentity:this.value.identity}:{}),...fields};this.busy=true;this.error='';if(this.key)this.key.value='';this.render();
    try{const result=await this.request(payload);if(generation!==this.generation)return;
      if(result.entry&&result.entry!==entry||result.provider&&result.provider!==this.provider)throw Error('WSL 계정 결과가 선택한 환경과 일치하지 않습니다.');
      if(action==='switch'||action==='recover-restart'){if(result.restartPending)this.error=result.restartError||'계정 구성이 적용되었으나 공유 서비스가 복구되지 않았습니다. 확인하고 복구하세요. 계정 전환을 반복하지 마십시오.';else if(result.continuationPending)this.error=result.continuationError||'계정 구성이 전환되었지만 아직 채팅 연속성이 확인되지 않았습니다. 확인하려면 새로고침하세요. 스위치를 다시 제출하지 마십시오.';else this.onSwitched?.(result);}
      if(action==='models'){this.models.set(fields.id,result);}
      else if(action==='import-sources'){this.sources=result.sources||[];}
      else if(Array.isArray(result.accounts)){this.value=result;this.models.clear();this.editRow=null;}
      else {this.busy=false;await this.refresh();}
    }catch(error){if(generation===this.generation)this.error=error.message;}
    finally{payload.apiKey='';if(generation===this.generation){this.busy=false;this.render();}}
  }
  field(form,key,type='text',value=''){const label=this.node('label'),input=this.node('input');input.type=type;input.value=value;input.disabled=this.busy;label.append(this.node('span',this.t(key)),input);form.append(label);return input;}
  render(){
    const root=this.root,data=this.value;root.replaceChildren();if(!this.entry)return;
    const identity=data?.target||{},heading='WSL · '+(this.provider==='claude'?'Claude Code':'Codex CLI');
    const head=this.node('div','','wsl-account-heading');head.append(this.node('h3',heading||this.t('WSL 계정 및 액세스')),this.button('새로고침',()=>this.refresh()));root.append(head);
    if(this.error){const error=this.node('p',this.t(this.error),'error');error.setAttribute('role','alert');root.append(error);}
    if(!data){root.append(this.node('p',this.t(this.busy?'로드 중…':'WSL 환경 선택'),'account-muted'));return;}
    root.append(this.node('small',[identity.distribution,identity.user,identity.configDir].filter(Boolean).join(' · ')||this.entry,'wsl-account-target account-muted'));
    const statusKey=!data.available?'WSL 환경을 사용할 수 없습니다. 배포를 시작한 다음 새로 고칩니다.':data.activeVerified===false?'로그인 유효성이 확인되지 않았습니다.':'WSL 구성이 로드되었습니다. 로그인 유효성은 확인에 따라 달라집니다.';
    const status=this.node('p',this.t(statusKey),'account-muted wsl-account-status');status.setAttribute('role','status');root.append(status);
    if(!data.available&&data.capabilities?.connect)root.append(this.button('WSL 시작 및 연결',()=>this.perform('connect')));
    if(this.provider==='codex'&&data.restartPending){const recovery=this.node('div','','wsl-account-confirm');recovery.append(this.node('p',this.t('계정 구성이 이미 적용되었습니다. 이 작업은 공유 서비스와 원래 채팅만 복구합니다. 계정을 다시 전환하지 않습니다.')));if(data.capabilities?.recoverRestart){const button=this.button('공유 서비스 확인 및 복구',()=>this.confirmRestart());button.disabled=this.busy||!data.available;recovery.append(button);}root.append(recovery);}
    const notes=[];
    if(data.verification)notes.push(this.t('확인 상태')+': '+this.t(data.verification.status||data.verification));
    if(data.sharedWithDesktop===false)notes.push(this.t('이 WSL 구성은 로컬 액세스와 별개입니다.'));
    if(data.sharedWithDesktop||data.shared)notes.push(this.t('이 구성 디렉터리는 다른 액세스와 공유됩니다.'));
    if(notes.length)root.append(this.node('p',notes.join(' '),'account-muted wsl-account-notes'));
    if(data.captureNotice)root.append(this.node('p',this.t(data.captureNotice),'account-muted'));
    if((data.blockers||[]).length){const notice=this.node('details','','wsl-account-limits');notice.append(this.node('summary',this.t('현재 전환을 사용할 수 없습니다.')));for(const reason of data.blockers)notice.append(this.node('p',this.t(typeof reason==='string'?reason:reason.message||reason.code),'account-muted'));root.append(notice);}
    if(!(data.accounts||[]).length){root.append(this.node('p',this.t('저장된 WSL 프로필이 없습니다.'),'accounts-current'));root.append(this.node('p',this.t('추가하거나 가져오면 현재 계정을 전환하지 않고도 프로필이 저장됩니다.'),'account-muted'));}
    const blocked=!data.available||(data.blockers||[]).length>0;
    if((data.accounts||[]).length)root.append(this.node('h4',this.t('저장된 WSL 프로필'),'wsl-account-list-title'));
    for(const row of data.accounts||[]){
      const card=this.node('section','','wsl-account-row'),actions=this.node('div','','wsl-account-actions');card.append(this.node('strong',row.id==='native'?this.t(row.name):row.name||row.id),this.node('small',[this.t(row.kind==='api'?'API 연결':'네이티브 로그인'),row.baseUrl,row.model].filter(Boolean).join(' · ')));
      if(row.id===data.activeId||row.active)actions.append(this.node('span',this.t('현재 계정')));
      else {const native=row.id==='native',attempt=!!(native?data.capabilities?.attemptRestore:data.capabilities?.attemptSwitch),canSwitch=data.capabilities?.switch||(native&&data.capabilities?.restore)||attempt;if(canSwitch&&!data.restartPending){const button=this.button(attempt?'확인하고 전환하세요':'이 계정으로 전환',()=>this.confirmSwitch(row,attempt));button.disabled=this.busy||!data.available||(blocked&&!attempt&&!(native&&data.capabilities?.restore));actions.append(button);}}
      if(row.kind==='api'&&data.capabilities?.models){const button=this.button('업스트림 모델 나열',()=>this.perform('models',{id:row.id}));button.disabled=this.busy||!data.available;actions.append(button);}
      if(data.capabilities?.save&&data.available&&row.id!=='native'){const active=row.id===data.activeId||row.active;if(!active)actions.append(this.button('편집',()=>{this.editRow=row;this.render();}));actions.append(this.button('이름 바꾸기',()=>this.editName(row)));if(!active)actions.append(this.button('삭제',()=>this.confirmDelete(row)));}
      card.append(actions);if(row.kind!=='api')card.append(this.node('p',this.t('원본 CLI에서 네이티브 로그인 모델을 확인하세요. 기존 채팅은 모델을 유지합니다.'),'account-muted'));
      const result=this.models.get(row.id);if(result){const output=this.node('div','','wsl-account-models');const list=this.node('ul');for(const model of result.models||[]){const id=typeof model==='string'?model:model.id,name=typeof model==='string'?model:model.name||model.id,item=this.node('li',name+(name!==id?' · '+id:'')),efforts=typeof model==='object'?model.efforts:null;item.append(this.node('small',this.t('추론 강도')+': '+(Array.isArray(efforts)&&efforts.length?efforts.map(effort=>this.t(typeof effort==='string'?effort:effort.name||effort.id)).join(' / '):this.t('업스트림에서 보고되지 않음'))));list.append(item);}output.append(list);if(!(result.models||[]).length)output.append(this.node('p',this.t(result.modelError||'반환된 모델 목록이 없습니다.')));if(result.cache?.updatedAt)output.append(this.node('small',this.t('업데이트 날짜:')+new Date(result.cache.updatedAt*1000).toLocaleString(BridgeI18n.locale())));if(result.cache?.state)output.append(this.node('small',this.t('캐시 상태')+': '+result.cache.state));output.append(this.button('모델 새로 고침',()=>this.perform('models',{id:row.id,refresh:true})));card.append(output);}
      root.append(card);
    }
    if(data.capabilities?.save&&data.available){this.renderEditor(root);if(data.capabilities?.capture!==false&&!(data.accounts||[]).some(row=>row.id==='native')){const actions=this.node('div','','wsl-account-actions');actions.append(this.button('현재 네이티브 액세스 저장',()=>this.perform('import-current',{})));root.append(actions);}}
    if(data.loginGuidance){const help=this.node('details','','wsl-account-help');help.append(this.node('summary',this.t('공식 로그인')),this.node('p',this.t(data.loginGuidance),'account-muted'));root.append(help);}
  }
  confirmSwitch(row,attempt=false){const box=this.node('div','','wsl-account-confirm'),restart=this.provider==='codex'&&(attempt||this.value?.restartRequired);box.append(this.node('p',this.t(restart?'선택한 WSL 구성 디렉터리의 작업, 승인 및 확인되지 않은 전송이 확인됩니다. 공유 서비스는 모든 것이 유휴 상태인 경우에만 정상적으로 다시 시작됩니다. 원래 터미널 연결을 다시 연결해야 할 수도 있습니다. 어떤 프로세스도 강제로 종료되지 않습니다.':attempt?'먼저 이 게이트웨이의 유휴 실행기를 릴리스합니다. 외부 CLI 프로세스 또는 확인되지 않은 작업으로 인해 여전히 전환이 차단될 수 있습니다.':'이 WSL 환경에서 향후 요청을 전환합니다. 먼저 실행 중인 작업을 완료하세요.')),this.button(attempt||restart?'확인하고 전환하세요':'스위치 확인',()=>this.perform('switch',{id:row.id})),this.button('취소',()=>box.remove()));this.root.prepend(box);}
  confirmRestart(){const box=this.node('div','','wsl-account-confirm');box.append(this.node('p',this.t('선택한 WSL 공유 서비스 및 원래 채팅을 정상적으로 복구하기 전에 적용된 계정 구성을 확인합니다. 계정 전환은 반복되지 않으며 프로세스가 강제 종료되지 않습니다.')),this.button('서비스 복구 확인',()=>this.perform('recover-restart')),this.button('취소',()=>box.remove()));this.root.prepend(box);}
  confirmDelete(row){const box=this.node('div','','wsl-account-confirm');box.append(this.node('p',this.t('저장된 액세스 권한을 삭제하시겠습니까?')+' '+row.name),this.button('삭제',()=>this.perform('delete',{id:row.id})),this.button('취소',()=>box.remove()));this.root.prepend(box);}
  editName(row){const form=this.node('form','','wsl-account-editor'),name=this.field(form,'이름','text',row.name);const save=this.node('button',this.t('이름 저장'));save.type='submit';save.disabled=this.busy;form.append(save,this.button('취소',()=>form.remove()));form.onsubmit=event=>{event.preventDefault();this.perform('rename',{id:row.id,name:name.value});};this.root.prepend(form);name.focus();}
  renderEditor(root){
    const editing=this.editRow,details=this.node('details'),summary=this.node('summary',this.t(editing?'WSL API 액세스 수정':'WSL API 액세스 추가')),form=this.node('form','','wsl-account-editor');details.open=!!editing||!(this.value.accounts||[]).length;details.append(summary,form);
    const name=this.field(form,'이름','text',editing?.name||''),baseUrl=this.field(form,'API URL','url',editing?.baseUrl||''),model=this.field(form,'모델 ID','text',editing?.model||'');this.key=this.field(form,'API 키','password');this.key.autocomplete='new-password';this.key.required=!editing;this.key.placeholder=this.t(editing?'기존 키를 유지하려면 비워 두세요.':'');for(const input of [name,baseUrl,model])input.required=true;const key=this.key;
    const scheme=this.node('select');for(const value of ['x-api-key','bearer']){const option=this.node('option',value);option.value=value;scheme.append(option);}scheme.value=editing?.authScheme||'x-api-key';if(this.provider==='claude'){const label=this.node('label');label.append(this.node('span',this.t('인증방법')),scheme);form.append(label);}
    const save=this.node('button',this.t('API 액세스 저장'));save.type='submit';save.disabled=this.busy;form.append(save);if(editing)form.append(this.button('변경 취소',()=>{this.editRow=null;this.render();}));form.onsubmit=event=>{event.preventDefault();this.perform('save-api',{...(editing?{id:editing.id}:{}),name:name.value,baseUrl:baseUrl.value,model:model.value,apiKey:key.value,authScheme:scheme.value});};root.append(details);
    if(this.value.capabilities?.import){
      const imports=this.node('div','','wsl-account-import');imports.append(this.button('이 컴퓨터에서 API 액세스 가져오기',()=>this.perform('import-sources')),this.node('p',this.t('가져온 localhost, 127.0.0.1 및 ::1 주소는 선택한 WSL 환경을 참조합니다. 주소는 변경되지 않고 유지됩니다.'),'account-muted'));root.append(imports);
      if(this.sources){const importForm=this.node('form','','wsl-account-editor'),label=this.node('label'),source=this.node('select');label.append(this.node('span',this.t('이 컴퓨터에 저장된 API 액세스를 선택하세요.')),source);for(const row of this.sources){const option=this.node('option',[row.name,row.source].filter(Boolean).join(' · '));option.value=row.id;source.append(option);}const submit=this.node('button',this.t('선택한 API 액세스 가져오기'));submit.type='submit';submit.disabled=this.busy||!this.sources.length;importForm.append(label,submit);if(!this.sources.length)importForm.append(this.node('p',this.t('가져올 수 있는 저장된 API 액세스 권한이 없습니다.'),'account-muted'));importForm.onsubmit=event=>{event.preventDefault();const selected=this.sources.find(row=>row.id===source.value);if(selected)this.perform('import-api',{sourceId:selected.id,sourceIdentity:selected.sourceIdentity});};root.append(importForm);}
    }
  }
}
