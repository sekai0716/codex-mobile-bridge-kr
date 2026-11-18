'use strict';

class AgentsPanel {
  constructor(workbench,session,tab,parentId=session.id){Object.assign(this,{workbench,session,tab,parentId});this.node=(...a)=>workbench.node(...a);this.button=(...a)=>workbench.button(...a);this.windowState={};this.drafts=new Map();this.load();}
  url(id='',send=false){return this.session.provider?ClientIdentity.path(this.session.provider,'tasks',this.session.id):'/api/sessions/'+this.parentId+'/subagents'+(send?'/send':'')+'?host='+encodeURIComponent(this.session.host)+(id?'&id='+encodeURIComponent(id)+(send?'':'&live=1'):'');}
  async load(){
    this.controller?.abort();const controller=this.controller=new AbortController();
    if(!this.list){
      const head=this.node('div','wb-git-head');head.append(this.node('strong','',BridgeI18n.t('하위 에이전트')),this.button(BridgeI18n.t('새로고침'),()=>this.load()));
      this.status=this.node('p','wb-status','');this.status.setAttribute('role','status');this.list=this.node('div','wb-agents-list');
      this.tab.body.append(head,this.status,this.list);
    }
    try{
      const result=await this.workbench.request(this.url(),undefined,controller.signal);if(controller.signal.aborted)return;
      if(Array.isArray(result.tasks)){this.renderTasks(result.tasks);return;}
      this.status.textContent=BridgeI18n.t('이 채팅에서 파생된 작업 · 저장된 기록')+(result.limited?BridgeI18n.t('· 처음 128개 항목 표시'):'');
      const stamp=JSON.stringify(result);if(stamp!==this.stamp){
        this.stamp=stamp;const scroll=this.list.scrollTop;this.list.replaceChildren();
        const children=new Map();for(const agent of result.agents){if(!children.has(agent.parentId))children.set(agent.parentId,[]);children.get(agent.parentId).push(agent);}
        const draw=(parent,depth)=>{for(const agent of children.get(parent)||[]){
          const row=this.button('',()=>this.show(agent),agent.title);row.className='wb-agent-card';row.style.paddingLeft=(12+Math.min(depth,6)*16)+'px';row.dataset.agent=agent.id;
          row.append(this.workbench.raw(this.node('strong','',agent.nickname||agent.title)),this.workbench.raw(this.node('span','',agent.title)),this.node('small','',[agent.role,agent.path,agent.archived?BridgeI18n.t('보관됨'):BridgeI18n.t('저장됨'),agent.id.slice(0,8)].filter(Boolean).join(' · ')));
          this.list.append(row);draw(agent.id,depth+1);
        }};draw(this.parentId,0);
        if(!result.agents.length)this.list.append(this.node('p','wb-empty',BridgeI18n.t('이 채팅에 대해 저장된 하위 상담원 작업이 아직 없습니다.')));this.list.scrollTop=scroll;
      }
    }catch(e){if(!controller.signal.aborted)this.status.textContent=BridgeI18n.t(e.message);}
    finally{clearTimeout(this.timer);if(!this.disposed)this.timer=setTimeout(()=>{if(this.workbench.isVisible(this.session,this.tab)&&!document.hidden)this.load();else this.schedule();},10000);}
  }
  schedule(){clearTimeout(this.timer);if(!this.disposed)this.timer=setTimeout(()=>{if(this.workbench.isVisible(this.session,this.tab)&&!document.hidden)this.load();else this.schedule();},10000);}
  renderTasks(tasks){
    this.status.textContent=BridgeI18n.t('이 채팅의 백그라운드 작업');const stamp=JSON.stringify(tasks);if(stamp===this.stamp)return;this.stamp=stamp;
    const scroll=this.list.scrollTop;this.list.replaceChildren();
    const labels={running:'실행 중',stopping:'멎는',completed:'완전한',resultPending:'결과 보류 중',failed:'실패하다',cancelled:'취소됨',killed:'중지됨',idle:'게으른',unknown:'알 수 없는 상태'};
    for(const task of tasks){
      const row=this.node('div','wb-agent-card');row.append(this.node('strong','',task.title),this.node('small','',BridgeI18n.t(labels[task.status]||'알 수 없는 상태')));
      if(task.cancellable&&this.workbench.stopTask){const stop=this.button(BridgeI18n.t('이 작업을 중지하세요'),async()=>{
        if(this.stopping||this.disposed)return;this.stopping=true;stop.disabled=true;
        try{const result=await this.workbench.stopTask(this.session,task.id);if(result)this.workbench.notify(BridgeI18n.t('중지 요청이 제출되었습니다.'));}
        finally{this.stopping=false;this.stamp=null;if(!this.disposed)this.load();}
      });row.append(stop);}this.list.append(row);
    }
    if(!tasks.length)this.list.append(this.node('p','wb-empty',BridgeI18n.t('이 채팅에는 백그라운드 작업이 없습니다.')));this.list.scrollTop=scroll;
  }
  show(agent){
    this.window?.destroy();this.detailController?.abort();clearTimeout(this.detailTimer);this.selected=agent;this.detailStamp=null;this.control=null;
    this.detail=this.node('div','wb-agent-detail');this.detail.textContent=BridgeI18n.t('작업 기록 로드 중…');
    const view=this.node('div','wb-agent-view'),form=this.node('form','wb-agent-compose');
    let draft=this.drafts.get(agent.id);
    if(!draft){draft={text:''};this.drafts.set(agent.id,draft);}
    this.input=this.node('textarea');this.input.rows=1;this.input.maxLength=100000;this.input.value=draft.text;
    this.input.placeholder=BridgeI18n.t('Message this agent');this.input.dataset.i18nPlaceholder='Message this agent';
    this.input.setAttribute('aria-label',this.input.placeholder);this.input.dataset.i18nAriaLabel='Message this agent';
    this.send=this.node('button','',BridgeI18n.t('보내기'));this.send.type='submit';this.send.disabled=true;
    this.feedback=this.node('small','wb-agent-feedback',draft.notice||'');this.feedback.setAttribute('role','status');
    this.input.oninput=()=>{draft.text=this.input.value;this.updateComposer();};
    form.onsubmit=event=>{event.preventDefault();this.sendMessage(agent,draft);};
    form.append(this.input,this.send,this.feedback);view.append(this.detail,form);
    this.window=new FloatingPanel({host:this.tab.body,content:view,title:agent.nickname||agent.title,state:this.windowState,node:this.node,button:this.button,close:()=>{clearTimeout(this.detailTimer);this.detailController?.abort();this.selected=null;this.window=null;}});this.readDetail();
  }
  updateComposer(){
    if(!this.selected)return;
    const draft=this.drafts.get(this.selected.id);
    this.input.disabled=!this.control?.canSend;this.send.disabled=this.input.disabled||!draft.text.trim()||!!draft.sending;
    this.feedback.textContent=BridgeI18n.t(draft.notice||'');
  }
  async sendMessage(agent,draft){
    if(this.selected!==agent||this.send.disabled||!this.control?.canSend||draft.sending)return;
    // 네트워크 결과가 불분명하면 같은 원문과 영수증으로만 다시 확인한다.
    const body=draft.request?.text===draft.text?draft.request:{id:uuid(),text:draft.text,generation:this.control.generation,expectedTurnId:this.control.activeTurnId};
    draft.request=body;draft.sending=true;draft.notice='';this.updateComposer();
    try{
      const reply=await this.workbench.request(this.url(agent.id,true),body);
      if(reply.id===body.id&&reply.status==='accepted'){
        if(draft.text===body.text)draft.text='';
        draft.request=null;
      }else if(reply.status==='rejected'){
        draft.notice='Agent message declined';draft.request=null;
      }else draft.notice='Agent message delivery unknown';
    }catch(error){
      draft.notice=error.message||'Agent message delivery unknown';
      if(error.status>=400&&error.status<500)draft.request=null;
    }finally{
      draft.sending=false;
      if(this.selected?.id===agent.id&&!this.disposed){this.input.value=draft.text;this.updateComposer();this.readDetail();}
    }
  }
  scheduleDetail(){
    clearTimeout(this.detailTimer);
    if(!this.selected||this.disposed)return;
    const delay=this.control?.status==='active'?1000:this.control?3000:8000;
    this.detailTimer=setTimeout(()=>{
      if(this.workbench.isVisible(this.session,this.tab)&&!document.hidden)this.readDetail();else this.scheduleDetail();
    },delay);
  }
  async readDetail(){
    this.detailController?.abort();const controller=this.detailController=new AbortController(),agent=this.selected;
    try{
      const result=await this.workbench.request(this.url(agent.id),undefined,controller.signal);if(controller.signal.aborted)return;
      if(result.id!==agent.id)throw Error(BridgeI18n.t('하위 에이전트의 원본 연결을 확인할 수 없습니다.'));
      this.control=result.live?result.control:null;this.updateComposer();
      const stamp=JSON.stringify(result);if(stamp===this.detailStamp)return;this.detailStamp=stamp;
      const scroll=this.detail.scrollTop,follow=this.detail.scrollHeight-this.detail.clientHeight-scroll<60;this.detail.replaceChildren();
      const latest=result.turns.at(-1),labels={inProgress:BridgeI18n.t('마지막 녹화: 실행 중(라이브 아님)'),completed:BridgeI18n.t('마지막 녹화: 완료'),interrupted:BridgeI18n.t('마지막 녹화: 중단됨'),failed:BridgeI18n.t('마지막 기록: 실패')};
      const status=result.live?(this.control.status==='active'?'Agent working live':'Agent connected'):labels[latest?.status]||'기록된 작업 상태가 없습니다.';
      this.detail.append(this.node('p','wb-status',BridgeI18n.t(status)));
      if(!result.historyComplete)this.detail.append(this.node('p','wb-status',BridgeI18n.t(result.live?'Showing recent agent activity':'최근 10개 턴만 표시합니다.')));
      for(const turn of result.turns)for(const message of turn.messages){
        const body=this.node('div','wb-agent-message');
        if(message.role==='assistant'||message.role==='user'){
          body.append(this.node('small','',message.role==='user'?BridgeI18n.t('태스크 입력'):BridgeI18n.t('응답')));const text=this.node('div','message-body');renderMarkdown(text,message.text||'',[],()=> '');body.append(text);
          const actions=this.node('div','message-actions'),copy=this.button(BridgeI18n.t('복사'),()=>window.BridgeClipboard?.copy(()=>message.text||'',copy));copy.className='plain message-copy';
          const quote=this.button(BridgeI18n.t('인용'),()=>{if(this.selected===agent&&this.workbench.current===this.session)this.workbench.quoteMessage?.(message.text||'','agent:'+agent.id+':'+turn.id+':'+message.id,{id:this.parentId,host:this.session.host,provider:this.session.provider||'codex'});});quote.className='plain message-quote';quote.disabled=!this.workbench.quoteMessage;
          actions.append(copy,quote);renderChatMessageTime(actions,message.timestamp);body.append(actions);
        }else{
          const details=this.node('details');details.append(this.node('summary','',message.name||message.kind||BridgeI18n.t('도구 기록')),this.node('pre','',message.output||message.text||''));body.append(details);
        }
        this.detail.append(body);
      }
      if(!result.turns.length)this.detail.append(this.node('p','wb-empty',BridgeI18n.t('이 작업은 아직 채팅 기록에 저장되지 않았습니다.')));
      this.detail.scrollTop=follow?this.detail.scrollHeight:scroll;
    }catch(e){if(!controller.signal.aborted){this.control=null;this.detailStamp=null;this.updateComposer();this.detail.textContent=BridgeI18n.t(e.message);}}
    finally{if(!controller.signal.aborted)this.scheduleDetail();}
  }
  dispose(){this.disposed=true;clearTimeout(this.timer);clearTimeout(this.detailTimer);this.controller?.abort();this.detailController?.abort();this.window?.destroy();}
}
