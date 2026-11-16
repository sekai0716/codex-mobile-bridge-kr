'use strict';
class CliAccessPanel {
  constructor({root,provider,read,request,formOnly=false,onChanged=()=>{}}){
    if(!['codex','claude'].includes(provider))throw Error('Invalid CLI provider');
    Object.assign(this,{root,provider,read,request,formOnly,onChanged});this.value=null;this.busy=false;this.generation=0;this.draftRevision=0;this.apiResults=new Map();this.switchRequests=new Map();
    this.build();
  }
  t(key){return BridgeI18n.t(key);}
  node(tag,key,className=''){
    const node=document.createElement(tag);node.className=className;
    if(key){node.dataset.i18n=key;node.textContent=this.t(key);}
    return node;
  }
  button(key,action){const button=this.node('button',key);button.type='button';button.onclick=action;return button;}
  field(key,type='text'){
    const label=this.node('label'),input=document.createElement('input');input.type=type;
    label.append(this.node('span',key),input);return {label,input};
  }
  build(){
    this.root.classList.add('cli-access-panel');this.root.replaceChildren();
    const heading=this.node('h2',this.provider==='codex'?'Codex CLI 액세스':'Claude Code CLI 액세스'),refresh=this.button('새로고침',()=>this.refresh());
    this.status=this.node('p',null,'account-muted');this.status.setAttribute('role','status');
    this.error=this.node('p',null,'error');this.error.setAttribute('role','alert');
    this.rows=this.node('div',null,'cli-access-rows');
    this.name=this.field('이름');this.baseUrl=this.field('API URL','url');this.model=this.field('모델 ID');this.key=this.field('API 키','password');this.key.input.autocomplete='new-password';
    this.scheme=this.node('select');for(const [id,name] of [['x-api-key','x-api-key'],['bearer','Bearer']]){const option=this.node('option');option.value=id;option.textContent=name;this.scheme.append(option);}
    this.schemeRow=this.node('label');this.schemeRow.append(this.node('span','인증방법'),this.scheme);
    this.form=this.node('form',null,'cli-access-form');this.form.onsubmit=event=>{event.preventDefault();const provider=this.provider;this.perform(this.editKind==='rename'?{provider,action:'rename',id:this.editId,name:this.name.input.value}:{provider,action:'saveApi',id:this.editId||undefined,name:this.name.input.value,baseUrl:this.baseUrl.input.value,model:this.model.input.value,apiKey:this.key.input.value,authScheme:provider==='claude'?this.scheme.value:undefined});};
    this.save=this.node('button','API 액세스 저장');this.save.type='submit';
    this.cancel=this.button('변경 취소',()=>this.resetForm());this.cancel.hidden=true;
    const modelHint=this.node('p','모델 끝점을 사용할 수 없는 경우 모델 ID를 수동으로 입력합니다.','account-muted');modelHint.classList.add('cli-access-model-hint');
    for(const field of [this.baseUrl.label,this.key.label,this.schemeRow])field.classList.add('cli-access-full-row');
    this.save.classList.add('primary');
    const actions=this.node('div',null,'cli-access-form-actions');actions.append(this.cancel,this.save);
    if(this.formOnly&&this.provider==='codex'){
      this.root.classList.add('codex-api-editor');
      this.name.input.placeholder=this.t('예: 내 API');
      this.key.input.placeholder=this.t('API 키를 입력하세요');
      this.model.input.placeholder=this.t('모델을 가져오거나 ID를 입력하세요.');
      ApiAccessEditor.mount(this,{connectionFields:[this.name.label,this.baseUrl.label,this.key.label],actions});
      this.cancel.hidden=false;this.cancel.textContent=this.t('취소');this.cancel.onclick=()=>{this.resetForm();if(this.root.parentNode?.tagName==='DETAILS')this.root.parentNode.open=false;};
      this.baseUrl.input.placeholder='https://api.example.com/v1';
      this.baseUrl.input.oninput=this.key.input.oninput=()=>this.clearDraftModels();
    }else this.form.append(this.name.label,this.model.label,modelHint,this.baseUrl.label,this.key.label,this.schemeRow,actions);
    this.native=this.button('현재 네이티브 액세스 저장',()=>this.perform({provider:this.provider,action:'importCurrent',name:this.t('로컬 네이티브 액세스')}));
    this.root.append(...(this.formOnly?[this.status,this.error,this.form]:[heading,refresh,this.status,this.error,this.rows,this.form,this.native]));
    this.onLanguage=()=>this.render();document.addEventListener('bridge-language',this.onLanguage);
  }
  setBusy(busy){
    this.busy=busy;
    this.root.querySelectorAll('button,input,select').forEach(control=>{control.disabled=busy;});
    if(this.fetchModels){this.fetchModels.disabled=busy||!!this.draftLoading;this.save.disabled=busy||!!this.draftLoading;}
  }
  modelSelection(selected){return ApiAccessEditor.selection(this,selected);}
  clearDraftModels(){return ApiAccessEditor.clear(this);}
  discoverModels(){return ApiAccessEditor.discover(this);}
  clear(){
    this.generation++;
    this.clearDraftModels();
    this.value=null;
    this.apiResults.clear();
    this.setBusy(false);
    this.form.reset();
    this.key.input.value='';
    this.editId=null;this.editKind=null;this.cancel.hidden=!this.modelSelect;
    this.status.textContent='';this.error.textContent='';
    this.render();
  }
  dispose(){this.clear();document.removeEventListener('bridge-language',this.onLanguage);}
  resetForm(){this.clearDraftModels();this.editId=null;this.editKind=null;this.form.reset();this.key.input.value='';this.cancel.hidden=!this.modelSelect;this.render();}
  async refresh(){
    if(this.busy)return;
    const generation=++this.generation;
    this.setBusy(true);this.status.textContent=this.t('로드 중…');this.error.textContent='';
    try{const value=await this.read();if(generation===this.generation){this.value=value;const receipt=value?.codex?.switch;if(['complete','failed','restored'].includes(receipt?.phase))this.switchRequests.delete(receipt.targetId);for(const row of value?.[this.provider]?.accounts||[])if(!row.modelCatalogIdentity)this.apiResults.delete(row.id);this.render();}}
    catch(error){if(generation===this.generation){this.error.textContent=this.t(error.message);this.status.textContent='';}}
    finally{if(generation===this.generation)this.setBusy(false);}
  }
  async perform(value){
    if(this.busy)return;
    const generation=++this.generation;
    this.setBusy(true);this.error.textContent='';this.status.textContent=this.t('절약…');
    try{const result=await this.request(value);if(generation===this.generation){this.value=result;const receipt=result?.codex?.switch;if(['complete','failed','restored'].includes(receipt?.phase))this.switchRequests.delete(receipt.targetId);this.apiResults.clear();this.resetForm();this.onChanged();}}
    catch(error){if(generation===this.generation){this.error.textContent=this.t(error.message);this.status.textContent='';}}
    finally{if(value.apiKey)value.apiKey='';if(generation===this.generation)this.setBusy(false);}
  }
  async probe(row,action,refresh=false){
    if(this.busy)return;
    const generation=++this.generation;
    const scope=JSON.stringify([row.id,row.baseUrl,row.model,row.modelCatalogIdentity||'']),saved=this.apiResults.get(row.id),previous=row.modelCatalogIdentity&&saved?.scope===scope?saved:null;this.setBusy(true);this.error.textContent='';this.apiResults.set(row.id,action==='models'&&previous?.models?{...previous,loading:true}:{scope,message:this.t('모델 엔드포인트 확인 중…')});this.render();
    try{
      const result=await this.request({provider:this.provider,action,id:row.id,...(refresh?{refresh:true}:{})});
      if(generation!==this.generation)return;
      if(result.probe?.id!==row.id||result.probe?.provider!==this.provider||result.probe?.status!=='reachable'||result.probe?.scope!=='models')throw Error('모델 엔드포인트가 다른 액세스에 대한 결과를 반환했습니다.');
      const current=result[this.provider]?.accounts?.find(account=>account.id===row.id);
      if(current&&JSON.stringify([current.id,current.baseUrl,current.model,current.modelCatalogIdentity||''])!==scope)throw Error('모델 엔드포인트가 다른 액세스에 대한 결과를 반환했습니다.');
      if(action==='models'&&!Array.isArray(result.probe.models))throw Error('공급자가 지원되지 않는 모델 목록을 반환했습니다. 모델 ID를 수동으로 입력하세요.');
      if(action==='models'&&row.modelCatalogIdentity&&result.probe.cache?.identity!==row.modelCatalogIdentity)throw Error('모델 엔드포인트가 다른 액세스에 대한 결과를 반환했습니다.');
      this.value=result;
      this.apiResults.set(row.id,action==='models'?{scope,models:result.probe.models,cache:result.probe.cache,...(result.probe.modelError?{error:this.t(result.probe.modelError)}:{})}:{scope,message:this.t('모델 엔드포인트가 연결되었습니다. 채팅 요청이 전송되지 않았습니다.')});
      this.render();
    }catch(error){if(generation===this.generation){this.apiResults.set(row.id,action==='models'&&previous?.models?{...previous,error:this.t(error.message)}:{scope,error:this.t(error.message)});this.render();}}
    finally{if(generation===this.generation)this.setBusy(false);}
  }
  render(){
    const provider=this.provider,data=this.value?.[provider];
    if(this.modelSelect){this.name.input.placeholder=this.t('예: 내 API');this.key.input.placeholder=this.t(this.editId?'기존 키를 유지하려면 비워 두세요.':'API 키를 입력하세요');this.model.input.placeholder=this.t('모델을 가져오거나 ID를 입력하세요.');}
    this.schemeRow.hidden=provider!=='claude'||this.editKind==='rename';for(const field of [this.baseUrl,this.model,this.key])field.label.hidden=this.editKind==='rename';this.save.textContent=this.t(this.editKind==='rename'?'이름 저장':'API 액세스 저장');this.rows.replaceChildren();
    if(!data){this.status.textContent='';return;}
    this.status.textContent=provider==='codex'?(this.formOnly?'':this.t('Codex CLI는 이 컴퓨터의 액세스 구성을 데스크톱과 공유합니다.')):this.t('Claude Code CLI는 선택된 구성 디렉터리를 사용합니다.');
    if(provider==='claude'&&data.verification?.status==='configured')this.status.textContent+=' '+this.t((data.accounts||[]).find(row=>row.id===data.activeId)?.kind==='api'?'API 구성이 로컬로 확인되었습니다. 키가 공급자를 통해 검증되지 않았습니다.':'네이티브 구성이 확인되었습니다.');
    if(data.cliSwitch?.phase==='pending')this.rows.append(this.node('p','액세스 전환 중…','account-muted'));
    if(data.cliSwitch?.phase==='failed'){const error=this.node('p',null,'error');error.textContent=this.t(data.cliSwitch.error);this.rows.append(error);}
    if(this.formOnly){
      const results=[...this.apiResults.entries()].map(([id,result])=>{
        const name=data.accounts?.find(row=>row.id===id)?.name||id;
        return name+': '+(result.error||result.message||(result.models||[]).join(' · '));
      });
      if(results.length)this.status.textContent=results.join('\n');
      return;
    }
    for(const row of data.accounts||[]){
      const card=this.node('section',null,'cli-access-row'),title=this.node('strong');title.textContent=row.name;
      const detail=this.node('small');detail.textContent=[row.kind==='api'?this.t('API 연결'):this.t('네이티브 로그인'),row.baseUrl,row.model].filter(Boolean).join(' · ');
      const actions=this.node('div',null,'cli-access-actions');
      if(row.id===data.activeId){actions.append(this.node('span','현재 계정'),this.button('이름 바꾸기',()=>this.edit(provider,row,true)));}
      else{
        const switchButton=this.button('이 계정으로 전환',()=>this.switchTo(provider,row.id,data));actions.append(switchButton);
        const edit=this.button(row.kind==='api'?'편집':'이름 바꾸기',()=>this.edit(provider,row,row.kind!=='api'));actions.append(edit);
        const remove=this.button('삭제',()=>this.perform({provider,action:'delete',id:row.id}));actions.append(remove);
      }
      if(row.kind==='api'){
        actions.append(this.button('업스트림 모델 나열',()=>this.probe(row,'models')),this.button('테스트 모델 엔드포인트',()=>this.probe(row,'test')));
        const scope=JSON.stringify([row.id,row.baseUrl,row.model,row.modelCatalogIdentity||'']),saved=this.apiResults.get(row.id),result=saved?.scope===scope&&(!saved.models||!row.modelCatalogIdentity||saved.cache?.identity===row.modelCatalogIdentity)?saved:null,feedback=this.node('div',null,'cli-access-probe');
        if(result?.models){actions.append(this.button('모델 새로 고침',()=>this.probe(row,'models',true)));feedback.textContent=this.t('반환된 모델 엔드포인트:')+result.models.join(' · ')+' — '+this.t('모델 목록만 확인했습니다. 채팅 요청이 전송되지 않았습니다.');const updated=result.cache?.updatedAt;if(Number.isFinite(updated)&&updated>0){const stamp=this.node('small',null,'account-muted');stamp.textContent=this.t('업데이트 날짜:')+new Date(updated*1000).toLocaleString(BridgeI18n.locale());feedback.append(stamp);}if(result.error){const error=this.node('small',null,'error');error.textContent=result.error;feedback.append(error);}}
        else if(result?.error){feedback.classList.add('error');feedback.textContent=result.error;}
        else if(result?.message)feedback.textContent=result.message;
        card.append(title,detail,actions,feedback);
      }else card.append(title,detail,actions);
      this.rows.append(card);
    }
    if(this.busy)this.setBusy(true);
  }
  edit(provider,row,rename=false){
    this.clearDraftModels();
    this.editId=row.id;this.editKind=rename?'rename':'api';this.name.input.value=row.name;
    this.baseUrl.input.value=row.baseUrl||'';this.model.input.value=row.model||'';
    this.scheme.value=row.authScheme||'x-api-key';this.key.input.value='';this.cancel.hidden=false;this.render();
    if(this.root.parentNode?.tagName==='DETAILS')this.root.parentNode.open=true;
    this.name.input.focus();
  }
  requestId(){
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  switchTo(provider,id,data){
    if(provider==='codex'&&data.sharedWithDesktop){
      const confirm=this.node('div',null,'cli-access-confirm');
      confirm.append(this.node('p','이 액세스는 이 컴퓨터에도 사용됩니다. Codex CLI。전환하면 공유 인증이 동기화됩니다. 필요할 때만 다시 시작 Codex Desktop。'));
      const tasks=this.field('모든 작업이 종료되었으며 다른 클라이언트가 시작한 작업은 전환이 완료될 때까지 일시 중지되었습니다.','checkbox'),restart=this.field('필요한 경우 Codex 데스크톱을 다시 시작하도록 허용','checkbox');
      const submit=this.button('스위치 확인',()=>{
        if(!tasks.input.checked||!restart.input.checked)return;
        if(!this.switchRequests.has(id))this.switchRequests.set(id,this.requestId());
        confirm.remove();this.perform({provider,action:'switch',id,requestId:this.switchRequests.get(id),confirmed:true,tasksConfirmed:true,desktopRestartConfirmed:true});
      });
      const cancel=this.button('취소',()=>confirm.remove());
      confirm.append(tasks.label,restart.label,submit,cancel);this.rows.prepend(confirm);
      return;
    }
    this.perform({provider,action:'switch',id,confirmed:true});
  }
}
CliAccessPanel.editorId=0;
