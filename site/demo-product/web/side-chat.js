'use strict';

// A shared, gateway-owned ephemeral fork. Disposing a view never ends the chat.
class SideChatPanel {
  constructor(workbench, session, tab) {
    Object.assign(this, {workbench, session, tab});this.creationId=uuid();
    const n=(...args)=>workbench.node(...args),b=(...args)=>workbench.button(...args);
    this.selectedSkills=new Map();
    this.head=n('div','wb-side-head');
    this.createButton=b(BridgeI18n.t("보조 채팅 생성"),()=>this.create());this.createButton.className='primary';
    this.stopButton=b(BridgeI18n.t("■ 정지"),()=>this.action('stop'));this.stopButton.hidden=true;
    this.endButton=b(BridgeI18n.t('채팅 종료'),async()=>{if(await this.end())this.load();});this.endButton.hidden=true;
    this.modelButton=b(BridgeI18n.t("모델과 추론"),()=>this.modelSettings());
    this.skillsButton=b('Skill',()=>this.skills());this.skillsButton.className='tool-button';
    this.permissionsButton=b(BridgeI18n.t('권한'),()=>this.permissions());this.permissionsButton.className='tool-button';this.contextUsage=new ContextUsageControl();
    this.head.append(n('span','wb-side-caption',BridgeI18n.t("임시 보조 채팅")),this.endButton);
    this.landing=n('div','wb-side-landing');
    this.help=n('p','wb-side-help',BridgeI18n.t("이 채팅의 맥락을 사용하여 질문을 탐색하세요. 여기서는 기본 채팅의 작업이 계속되지 않습니다."));
    this.landing.append(n('div','wb-side-symbol','⑂'),n('h2','',BridgeI18n.t("보조 채팅 시작")),this.help,n('p','muted',BridgeI18n.t("다양한 기기에서 계속하세요. 채팅을 종료하거나 게이트웨이를 다시 시작하면 내용이 지워집니다.")),this.createButton);
    this.status=n('p','wb-status');this.status.setAttribute('role','status');
    this.messages=n('div','wb-side-messages');this.messages.setAttribute('data-i18n-aria-label',"보조 채팅 메시지");this.messages.setAttribute('aria-label',BridgeI18n.t("보조 채팅 메시지"));
    this.approvals=n('div','wb-side-approvals');this.queued=n('div','wb-side-queue');
    this.form=n('form','composer wb-side-composer');this.form.hidden=true;
    this.input=n('textarea');this.input.rows=1;this.input.maxLength=20000;this.input.setAttribute('data-i18n-placeholder','이 채팅을 계속하세요…');this.input.placeholder=BridgeI18n.t('이 채팅을 계속하세요…');this.input.setAttribute('data-i18n-aria-label',"보조 채팅 입력");this.input.setAttribute('aria-label',BridgeI18n.t("보조 채팅 입력"));
    this.sendButton=n('button','primary',BridgeI18n.t("보내기 ↑"));this.sendButton.type='submit';this.sendButton.disabled=true;
    const tools=n('div','composer-tools'),bottom=n('div','compose-bottom'),actions=n('div','compose-actions');
    this.modelButton.className='tool-button wb-side-model';
    this.toggle=b('',()=>this.collapse(!this.collapsed),BridgeI18n.t("작곡가 숨기기"));this.toggle.className='composer-toggle';this.toggle.setAttribute('aria-expanded','true');this.toggle.append(document.querySelector('#composer-toggle svg').cloneNode(true));
    this.stopButton.className='stop';tools.append(this.modelButton,this.skillsButton,this.permissionsButton,this.contextUsage.button,this.toggle);
    this.composerBody=n('div','wb-side-composer-body');this.skillPills=n('div','skill-pills');
    this.attachmentList=n('div','attachment-list');this.fileInput=n('input');this.fileInput.type='file';this.fileInput.multiple=true;this.fileInput.hidden=true;
    this.attachButton=b('',()=>{},BridgeI18n.t("파일 또는 이미지 첨부"));this.attachButton.className='attach-button';
    this.attachButton.append(document.querySelector('#attach-button svg').cloneNode(true));
    const select=(label,rows)=>{const control=n('select');control.dataset.i18nAriaLabel=label;control.setAttribute('aria-label',BridgeI18n.t(label));for(const [value,text] of rows){const option=n('option','',BridgeI18n.t(text));option.value=value;control.append(option);}return control;};
    this.sendMode=select("배달 모드",[['send',"메시지 보내기"],['queue','완료되면 보내기'],['steer',"현재 작업 조종"]]);
    this.workMode=select('작업 모드',[['default',"기본 모드"],['plan','계획 모드']]);
    this.sendMode.onchange=()=>this.controls();this.workMode.onchange=()=>{this.modeSelected=true;this.controls();};
    actions.append(this.stopButton,this.sendButton);bottom.append(this.attachButton,this.fileInput,this.sendMode,this.workMode,actions);
    this.composerBody.append(this.skillPills,this.attachmentList,this.input,bottom);this.form.append(tools,this.composerBody);
    this.attachments=new ChatAttachments({root:this.attachmentList,button:this.attachButton,input:this.fileInput,paste:this.input,drop:this.form,
      onChange:()=>this.controls(),preview:(key,id)=>this.uploadUrl(key,id,'preview'),
      upload:(key,id,file)=>this.uploadFile(this.uploadUrl(key,id)+'&name='+encodeURIComponent(file.name),file),
      thumbnail:async(key,id,file)=>{const thumb=await this.attachments.thumbnailBlob(file);return this.uploadFile(this.uploadUrl(key,id,'thumb')+'&width='+thumb.width+'&height='+thumb.height,thumb.data);}});
    this.form.onsubmit=e=>{e.preventDefault();this.send();};
    this.input.oninput=()=>{this.resizeInput();this.controls();};
    tab.body.append(this.head,this.landing,this.status,this.messages,this.approvals,this.queued,this.form);this.controls();this.load();this.schedule();
  }
  resizeInput(){this.input.style.height='auto';this.input.style.height=Math.min(160,Math.max(48,this.input.scrollHeight))+'px';}
  collapse(value){this.collapsed=value;this.composerBody.hidden=value;this.form.classList.toggle('is-collapsed',value);this.toggle.setAttribute('aria-expanded',String(!value));const label=value?"작곡가 표시":"작곡가 숨기기";this.toggle.dataset.i18nTitle=label;this.toggle.dataset.i18nAriaLabel=label;this.toggle.title=BridgeI18n.t(label);this.toggle.setAttribute('aria-label',BridgeI18n.t(label));if(!value)this.resizeInput();}
  uploadUrl(child,id,operation=''){
    const path='/api/sessions/'+this.session.id+'/uploads'+(operation?'/'+encodeURIComponent(id)+'/'+operation:'')+'?host='+encodeURIComponent(this.session.host)+'&side='+encodeURIComponent(child)+(operation?'':'&id='+encodeURIComponent(id));
    return window.BridgeRelayURL?.(path)||path;
  }
  async uploadFile(url,file){
    const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type||'application/octet-stream','X-CSRF-Token':this.workbench.csrf()},body:file});
    const result=await response.json();if(!response.ok){if(response.status===401)this.workbench.onUnauthorized();const error=Error(result.error||BridgeI18n.t('업로드 실패'));error.status=response.status;throw error;}return result;
  }
  relabel(){
    this.input.setAttribute('data-i18n-placeholder','이 채팅을 계속하세요…');this.input.placeholder=BridgeI18n.t('이 채팅을 계속하세요…');
    this.input.setAttribute("data-i18n-aria-label","보조 채팅 입력");this.input.setAttribute('aria-label',BridgeI18n.t("보조 채팅 입력"));
    this.messages.setAttribute("data-i18n-aria-label","보조 채팅 메시지");this.messages.setAttribute('aria-label',BridgeI18n.t("보조 채팅 메시지"));
    if(this.state)this.apply(this.state);
  }
  url(){return '/api/sessions/'+this.session.id+'/side-chat?host='+encodeURIComponent(this.session.host);}
  request(body){return this.workbench.request(this.url(),body);}
  controls(){
    const created=!!this.state?.id,active=this.state?.status==='active',locked=!!this.busy||!!this.pending||!this.state?.connected;
    this.form.hidden=!created;this.landing.hidden=created;this.head.hidden=!created;this.messages.hidden=!created;this.queued.hidden=!created;
    if(this.attachments&&this.attachments.locked!==locked)this.attachments.setLocked(locked);
    for(const button of [this.modelButton,this.skillsButton,this.permissionsButton])button.disabled=locked;
    this.sendMode.disabled=locked;this.workMode.disabled=locked||this.sendMode.value==='steer';
    this.sendMode.querySelector('[value=steer]').disabled=!active;
    if(!active&&this.sendMode.value==='steer')this.sendMode.value='send';
    this.workMode.disabled=locked||this.sendMode.value==='steer';
    this.workMode.title=BridgeI18n.t(this.sendMode.value==='steer'?"추가 입력으로 현재 모드 유지":this.workMode.value==='plan'?"먼저 토론하고 계획하세요. 확인 후 시행합니다.":'');
    this.sendButton.disabled=locked||((active||!!this.state?.requests?.length)&&this.sendMode.value==='send')||(!!this.state?.requests?.length&&this.sendMode.value==='steer')||(!this.input.value.trim()&&!this.attachments?.ids().length)||!this.attachments?.ready();
    this.createButton.disabled=!!this.busy;
    this.stopButton.hidden=!created||!active;this.stopButton.disabled=!!this.busy;
    this.endButton.hidden=!created;this.endButton.disabled=!!this.busy;
    this.status.hidden=!this.status.textContent;
  }
  skillChips(){
    this.skillsButton.textContent='Skill'+(this.selectedSkills.size?' ('+this.selectedSkills.size+')':'');this.skillPills.replaceChildren();
    for(const [id,skill] of this.selectedSkills){const pill=this.workbench.raw(this.workbench.button((skill.displayName||skill.name)+' ×',()=>{this.selectedSkills.delete(id);this.skillChips();}));pill.className='skill-pill';this.skillPills.append(pill);}
  }
  dialog(title){
    const n=(...a)=>this.workbench.node(...a),dialog=n('dialog','picker'),head=n('div','picker-head');
    head.append(n('h2','',BridgeI18n.t(title)),this.workbench.button('×',()=>dialog.close(),BridgeI18n.t('닫기')));dialog.append(head);
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();return dialog;
  }
  async skills(){
    const child=this.state.id,n=(...a)=>this.workbench.node(...a),b=(...a)=>this.workbench.button(...a),dialog=this.dialog("기술을 선택하세요");
    const search=n('input'),list=n('div','skill-list'),error=n('p','error'),actions=n('div','picker-actions');search.type='search';search.placeholder=BridgeI18n.t("설치된 스킬 검색");search.dataset.i18nPlaceholder="설치된 스킬 검색";search.setAttribute('aria-label',search.placeholder);search.dataset.i18nAriaLabel="설치된 스킬 검색";
    let revision=0,offset=0,total=0,loading=false,timer;
    const load=async(refresh=false,append=false)=>{
      const ticket=++revision;loading=true;more.disabled=true;error.textContent='';if(!append){offset=0;list.replaceChildren(n('p','muted',BridgeI18n.t("설치된 스킬 로드 중…")));}
      try{
        const result=await this.request({action:'skills',id:child,query:search.value,offset,refresh,selected:[...this.selectedSkills.keys()]});
        if(ticket!==revision||!dialog.open||this.state?.id!==child)return;
        if(!append)list.replaceChildren();total=result.total||0;
        for(const skill of result.skills||[]){const label=n('label','skill-option'),input=n('input'),text=n('span');input.type='checkbox';input.checked=this.selectedSkills.has(skill.id);text.append(this.workbench.raw(n('strong','',skill.displayName||skill.name)),this.workbench.raw(n('small','',skill.description||'')));input.onchange=()=>{if(input.checked&&this.selectedSkills.size>=8){input.checked=false;error.textContent=BridgeI18n.t("최대 8개 스킬 선택");return;}if(input.checked)this.selectedSkills.set(skill.id,skill);else this.selectedSkills.delete(skill.id);this.skillChips();};label.append(input,text);list.append(label);}
        offset+=(result.skills||[]).length;more.hidden=offset>=total;error.textContent=(result.errors||[]).map(BridgeI18n.t).join('\n');
        if(!list.children.length)list.append(n('p','muted',BridgeI18n.t("일치하는 기술이 없습니다.")));
      }catch(e){if(ticket===revision){error.textContent=BridgeI18n.t(e.message);if(!append)list.replaceChildren();}}
      finally{if(ticket===revision){loading=false;more.disabled=false;}}
    };
    const more=b(BridgeI18n.t("더 로드하기"),()=>{if(!loading)load(false,true);});more.hidden=true;
    actions.append(b(BridgeI18n.t('새로 고치다'),()=>load(true)),b(BridgeI18n.t("완료"),()=>dialog.close()));
    dialog.append(n('p','muted',BridgeI18n.t("선택한 스킬은 다음 메시지와 함께 전송됩니다. 최대 8개까지 선택하세요.")),search,list,more,error,actions);
    search.oninput=()=>{revision++;clearTimeout(timer);timer=setTimeout(()=>load(),200);};dialog.addEventListener('close',()=>{revision++;clearTimeout(timer);});await load();
  }
  permissions(){
    const child=this.state.id,n=(...a)=>this.workbench.node(...a),dialog=this.dialog("채팅 권한"),error=n('p','error');
    dialog.append(n('p','muted',BridgeI18n.t("다음 턴부터 이 보조 채팅에만 적용됩니다.")));
    if(this.state.linuxPermissionChecks===true){
      permissionPicker(dialog,{load:()=>this.request({action:'linux-permission-options',id:child}),
        save:async preset=>({confirmed:true,state:await this.request({action:'permissions',id:child,preset,confirmed:preset==='full-access'})}),
        isCurrent:()=>!this.disposed&&this.state?.id===child&&this.state.connected===true,onSaved:result=>this.apply(result.state)});
      return;
    }
    for(const [preset,label,help] of [['ask','승인 요청',"추가 권한이 필요할 때 물어보세요."],['auto-review',"승인해 주세요","Codex는 추가 권한이 필요한 작업을 검토합니다."],['full-access','전체 액세스',"개별 승인 없이 작업 공간 및 네트워크 외부의 파일에 대한 액세스를 허용합니다."]]){
      const button=this.workbench.button('',async()=>{
        if(preset==='full-access'&&!confirm(BridgeI18n.t("이 채팅에 컴퓨터 파일 및 네트워크에 대한 전체 액세스를 허용하시겠습니까? 신뢰하는 작업에 대해서만 활성화하세요.")))return;
        dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{const state=await this.request({action:'permissions',id:child,preset,confirmed:preset==='full-access'});if(this.state?.id===child)this.apply(state);dialog.close();}
        catch(e){error.textContent=BridgeI18n.t(e.message);}finally{dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
      },BridgeI18n.t(label));permissionOption(button,preset,label,help,this.state.permissionMode===preset);dialog.append(button);
    }dialog.append(error);
  }
  async modelSettings(){
    const child=this.state.id,n=(...args)=>this.workbench.node(...args),b=(...args)=>this.workbench.button(...args);
    try{
      const catalog=await this.request({action:'catalog',id:child});
      if(this.disposed||this.state.id!==child)return;
      const dialog=n('dialog','picker'),head=n('div','picker-head'),model=n('select'),custom=n('input'),effort=n('select'),status=n('p','error');
      head.append(n('h2','',BridgeI18n.t("보조 채팅 설정")),b('×',()=>dialog.close(),BridgeI18n.t('닫기')));
      const modelLabel=n('label','',BridgeI18n.t('모델')),effortLabel=n('label','',BridgeI18n.t("추론 강도"));
      for(const row of catalog.models||[])model.append(new Option(row.name||row.id,row.id));
      const manual=new Option(BridgeI18n.t("커스텀 모델…"),'__custom__');manual.dataset.i18n="커스텀 모델…";model.append(manual);
      model.value=[...model.options].some(o=>o.value===catalog.currentModel)?catalog.currentModel:'__custom__';custom.value=catalog.currentModel||'';
      custom.setAttribute("data-i18n-aria-label",'모델 ID');custom.setAttribute('aria-label',BridgeI18n.t('모델 ID'));
      const fill=()=>{custom.hidden=model.value!=='__custom__';const known=catalog.models?.find(m=>m.id===model.value);const values=known?.efforts?.length?known.efforts:['none','minimal','low','medium','high','xhigh','max','ultra'];effort.replaceChildren(...values.map(value=>new Option(value,value)));effort.value=values.includes(catalog.currentEffort)?catalog.currentEffort:known?.defaultEffort||values[0];};
      model.onchange=fill;fill();modelLabel.append(model,custom);effortLabel.append(effort);
      const save=b(BridgeI18n.t('저장'),async()=>{save.disabled=true;try{const state=await this.request({action:'settings',id:child,model:model.value==='__custom__'?custom.value.trim():model.value,effort:effort.value});this.apply(state);dialog.close();}catch(e){status.textContent=BridgeI18n.t(e.message);}finally{save.disabled=false;}});
      dialog.append(head,n('p','muted',BridgeI18n.t("다음 턴부터 이 보조 채팅에만 적용됩니다.")),modelLabel,effortLabel,status,save);
      document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
    }catch(e){this.status.textContent=BridgeI18n.t(e.message);}
  }
  async load(){try{this.apply(await this.request());}catch(e){if(!this.disposed){this.status.textContent=BridgeI18n.t(e.message);if(this.state)this.state.connected=false;this.controls();}}}
  async create(){
    if(this.busy)return;this.busy=true;this.controls();this.status.textContent=BridgeI18n.t("임시 보조 채팅 생성 중…");
    try{this.apply(await this.request({action:'create',creationId:this.creationId}));}
    catch(e){if(!this.disposed)this.status.textContent=BridgeI18n.t(e.message);}
    finally{this.busy=false;this.controls();}
  }
  apply(state){
    if(this.disposed)return;
    if(this.state?.id&&this.state.id!==state.id){this.pending=null;this.creationId=uuid();this.input.value='';this.attachments.clear(this.attachments.key,this.attachments.ids());this.attachments.reset();this.selectedSkills.clear();this.skillChips();this.modeSelected=false;this.workMode.value='default';}
    this.state=state;this.contextUsage.update(state);
    if(state.id&&this.attachments.key!==state.id)this.attachments.open(state.id);
    if(state.id){this.modelButton.textContent=[state.model,state.effort].filter(Boolean).join(' · ')||BridgeI18n.t("모델과 추론");delete this.modelButton.dataset.i18n;}
    if(!this.modeSelected)this.workMode.value=state.collaborationMode==='plan'?'plan':'default';
    const permission={'ask':'승인 요청','auto-review':"승인해 주세요",'full-access':'전체 액세스'}[state.permissionMode]||'권한';this.permissionsButton.textContent=BridgeI18n.t(permission);this.permissionsButton.dataset.i18n=permission;
    this.tab.body.classList.toggle('has-side-chat',!!state.id);
    if(this.pending&&state.submissions?.some(s=>s.id===this.pending.submissionId&&['accepted','queued'].includes(s.status))){
      if(this.input.value===this.pending.text)this.input.value='';this.attachments.clear(state.id,this.pending.attachments);this.pending=null;this.selectedSkills.clear();this.skillChips();this.resizeInput();
    }
    this.status.textContent=state.error||(!state.id?'':this.pending?BridgeI18n.t("확인되지 않은 상태로 보냅니다. 다시 보내기 전에 메시지를 확인하세요."):state.requests?.length?BridgeI18n.t("요청에 주의가 필요합니다."):state.status==='active'?BridgeI18n.t("응답 중…"):BridgeI18n.t('연결됨'));
    const stamp=JSON.stringify([state.id,state.connected,state.turns]);
    if(stamp!==this.stamp){
      this.stamp=stamp;const scroll=this.messages.scrollTop,follow=this.messages.scrollHeight-this.messages.clientHeight-scroll<60;this.messages.replaceChildren();
      for(const turn of state.turns||[]){for(const message of turn.messages||[]){
        const card=this.workbench.node('article','wb-side-message '+message.role);
        if(message.role==='user'||message.role==='assistant'){
          card.append(this.workbench.node('small','',message.role==='user'?BridgeI18n.t("사용자"):'Codex'));
          const text=this.workbench.node('div','message-body');renderMarkdown(text,message.text||'');card.append(text);
          if(message.attachments?.length){const list=this.workbench.node('div','attachment-list');for(const file of message.attachments){
            const chip=this.workbench.node('div','attachment-chip');if(file.image){const image=this.workbench.node('img','attachment-thumb');image.src=this.uploadUrl(state.id,file.id,'preview');image.alt=file.name;image.dataset.imagePreview=image.src+'&variant=original';image.dataset.imageName=file.name;image.tabIndex=0;image.setAttribute('role','button');chip.append(image);}
            chip.append(this.workbench.raw(this.workbench.node('strong','',file.name)));list.append(chip);
          }card.append(list);}
        }else{
          const details=this.workbench.node('details');details.append(this.workbench.node('summary','',message.title||message.kind||BridgeI18n.t('도구 활동')),this.workbench.node('pre','',message.output||message.text||''));card.append(details);
        }
        this.messages.append(card);
      }if(turn.error)this.messages.append(this.workbench.node('p','error',BridgeI18n.t("응답이 불완전합니다. 모델 연결을 확인하세요.")));}
      if(!this.messages.children.length)this.messages.append(this.workbench.node('p','wb-empty',state.connected?BridgeI18n.t("컨텍스트가 준비되었습니다. 별도의 토론을 시작하십시오."):BridgeI18n.t("질문하려면 보조 채팅을 만드세요.")));
      this.messages.scrollTop=follow?this.messages.scrollHeight:scroll;
    }
    this.renderApprovals(state.requests||[]);this.renderQueue(state.submissions||[]);this.controls();
  }
  renderQueue(rows){
    const stamp=JSON.stringify(rows);if(stamp===this.queueStamp)return;this.queueStamp=stamp;this.queued.replaceChildren();
    for(const row of rows.filter(r=>['queued','failed','unknown'].includes(r.status))){
      const card=this.workbench.node('div','queue-card');card.append(this.workbench.node('strong','',BridgeI18n.t(row.status==='queued'?'완료되면 보내기':row.status==='failed'?'전송 실패':"알 수 없는 결과 보내기")),this.workbench.raw(this.workbench.node('p','',row.text)));
      if(row.error)card.append(this.workbench.node('p','error',BridgeI18n.t(row.error)));
      if(row.status==='queued')card.append(this.workbench.button(BridgeI18n.t('취소'),()=>this.action('cancel-queued',{submissionId:row.id})));
      this.queued.append(card);
    }
  }
  renderApprovals(requests){
    const stamp=JSON.stringify(requests);if(stamp===this.approvalStamp)return;this.approvalStamp=stamp;this.approvals.replaceChildren();
    const n=(...args)=>this.workbench.node(...args);
    for(const request of requests){
      const card=n('form','wb-side-approval'),p=request.params||{},method=request.method,controls={};
      card.append(n('strong','',BridgeI18n.t("귀하의 확인이 필요합니다")));
      if(!request.supported){card.append(n('p','',p.message));this.approvals.append(card);continue;}
      for(const key of ['reason','command','cwd','message'])if(p[key])card.append(n(key==='command'?'pre':'p','',p[key]));
      if(p.changes)card.append(n('pre','',p.changes.map(c=>c.path+'\n'+(c.diff||'')).join('\n')));
      if(p.permissions)card.append(n('pre','',JSON.stringify(p.permissions,null,2)));
      const isInput=method.includes('requestUserInput'),isMcp=method==='mcpServer/elicitation/request';
      if(isInput)for(const q of p.questions||[]){
        const label=n('label','',q.question||q.header||q.id),input=n('textarea');input.rows=2;input.required=true;
        if(q.options?.length){const select=n('select');select.append(new Option(BridgeI18n.t("답변을 선택하거나 직접 작성하세요."),''));for(const option of q.options)select.append(new Option(option.label,option.label));select.onchange=()=>{input.value=select.value;};label.append(select);}
        label.append(input);card.append(label);controls[q.id]=()=>input.value;
      }
      if(isMcp)for(const [key,field] of Object.entries(p.requestedSchema?.properties||{})){
        const label=n('label','',field.title||key);let input;
        if(field.enum){input=n('select');input.append(new Option(BridgeI18n.t("선택하다…"),''));for(const value of field.enum)input.append(new Option(String(value),String(value)));}
        else{input=n('input');input.type=field.type==='boolean'?'checkbox':['number','integer'].includes(field.type)?'number':'text';if(input.type==='number')input.step=field.type==='integer'?'1':'any';}
        input.required=(p.requestedSchema.required||[]).includes(key)&&input.type!=='checkbox';label.append(input);card.append(label);
        controls[key]=()=>input.type==='checkbox'?input.checked:input.value===''?undefined:['number','integer'].includes(field.type)?Number(input.value):input.value;
      }
      const actions=n('div','wb-side-head'),error=n('p','error');
      const respond=async response=>{
        card.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{this.apply(await this.request({action:'respond',id:this.state.id,requestId:request.id,response}));}
        catch(e){error.textContent=BridgeI18n.t(e.message);card.querySelectorAll('button').forEach(b=>b.disabled=false);}
      };
      const available=p.availableDecisions||['accept','decline'];
      const yes=n('button','',''+(isInput?BridgeI18n.t('답장 제출'):BridgeI18n.t("한 번만 허용")));yes.type='submit';if(isInput||isMcp||available.includes('accept'))actions.append(yes);
      if(!isInput&&available.includes('decline'))actions.append(this.workbench.button(BridgeI18n.t('거부'),()=>respond(isMcp?{action:'decline'}:{decision:'decline'})));
      card.onsubmit=e=>{e.preventDefault();if(isInput){const answers={};for(const [key,get] of Object.entries(controls)){const value=get();if(!value.trim()){error.textContent=BridgeI18n.t("모든 질문에 답변해 주세요.");return;}answers[key]=[value];}respond({answers});}
        else if(isMcp){const content={};for(const [key,get] of Object.entries(controls)){const value=get();if(value!==undefined)content[key]=value;}respond({action:'accept',content});}
        else respond({decision:'accept'});};
      card.append(actions,error);this.approvals.append(card);
    }
  }
  schedule(){
    clearTimeout(this.timer);if(this.disposed)return;
    this.timer=setTimeout(async()=>{try{if(!this.busy&&this.workbench.isVisible(this.session,this.tab)&&!document.hidden)await this.load();}finally{this.schedule();}},1200);
  }
  async send(){
    if(this.sendButton.disabled)return;
    this.busy=true;const text=this.input.value;this.pending={text,submissionId:uuid(),attachments:this.attachments.ids(),skills:[...this.selectedSkills.keys()],mode:this.sendMode.value,workMode:this.sendMode.value==='steer'?null:this.workMode.value};const attachmentIds=this.pending.attachments;this.controls();this.status.textContent=BridgeI18n.t('배상…');
    try{const result=await this.request({action:'send',id:this.state.id,...this.pending});if(this.disposed)return;
      if(['accepted','queued'].includes(result.status)){this.attachments.clear(this.state.id,attachmentIds);this.pending=null;if(this.input.value===text)this.input.value='';this.selectedSkills.clear();this.skillChips();this.resizeInput();await this.load();}
      else this.status.textContent=BridgeI18n.t("확인되지 않은 상태로 보냅니다. 다시 보내기 전에 메시지를 확인하세요.");
    }catch(e){if(!this.disposed){if([400,401,403,404].includes(e.status))this.pending=null;this.status.textContent=BridgeI18n.t(e.message);}}
    finally{this.busy=false;this.controls();}
  }
  async action(action,fields={}){if(this.busy)return;this.busy=true;this.controls();try{this.apply(await this.request({action,id:this.state.id,...fields}));}catch(e){this.status.textContent=BridgeI18n.t(e.message);}finally{this.busy=false;this.controls();}}
  async end(){
    if(this.busy)return false;if(!this.state?.id)return true;
    if(!confirm(BridgeI18n.t("이 보조 채팅을 종료하시겠습니까? 응답이 중지되고 모든 장치에서 임시 콘텐츠가 삭제됩니다.")))return false;
    this.busy=true;this.controls();
    try{await this.request({action:'close',id:this.state.id});this.apply({id:null,connected:false,turns:[],requests:[]});return true;}
    catch(e){this.status.textContent=BridgeI18n.t(e.message);return false;}
    finally{this.busy=false;this.controls();}
  }
  dispose(){this.contextUsage.dispose();this.disposed=true;clearTimeout(this.timer);this.input.value='';this.attachments.reset();this.messages.replaceChildren();}
}
