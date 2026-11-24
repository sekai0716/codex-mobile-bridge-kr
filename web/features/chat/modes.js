'use strict';

// Keep the native selects as the source of values, labels and availability.
// A desktop menu can open above the composer even at the bottom of the window.
function installComposerModeMenu(){
  const desktop=()=>document.documentElement.hasAttribute('data-chat-width')&&!BridgeLayout.isCompactViewport();
  const menu=document.createElement('div');
  menu.id='composer-mode-options';menu.className='composer-mode-options';menu.setAttribute('role','listbox');
  let select,stamp;
  const observer=new MutationObserver(()=>{if(select)render();});
  function close(focus=false){
    if(!select)return;
    const trigger=select;select=null;observer.disconnect();menu.remove();
    trigger.removeAttribute('aria-expanded');trigger.removeAttribute('aria-controls');
    if(focus)trigger.focus({preventScroll:true});
  }
  function position(){
    if(!select)return;
    const rect=select.getBoundingClientRect();
    if(!desktop()||!rect.height||select.disabled){close();return;}
    menu.style.maxHeight=Math.max(1,rect.top-12)+'px';
    menu.style.minWidth=Math.min(innerWidth-16,rect.width)+'px';
    menu.style.bottom=Math.max(4,innerHeight-rect.top+4)+'px';
    menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-8-menu.offsetWidth))+'px';
  }
  function render(){
    if(select.disabled||select.hidden){close();return;}
    const options=Array.from(select.options).filter(option=>!option.hidden);
    const next=JSON.stringify(options.map(option=>[option.value,option.label,option.disabled,option.selected]));
    if(stamp===next)return;
    const previous=document.activeElement?.dataset.value;
    stamp=next;menu.replaceChildren();
    for(const option of options){
      const item=document.createElement('button');item.type='button';item.tabIndex=-1;
      item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
      item.dataset.value=option.value;item.disabled=option.disabled;item.textContent=option.label;
      item.onclick=()=>{
        if(!select||select.disabled||option.disabled||option.hidden||!select.contains(option))return;
        const trigger=select,changed=trigger.value!==option.value;
        trigger.value=option.value;close(true);
        if(changed){trigger.dispatchEvent(new Event('input',{bubbles:true}));trigger.dispatchEvent(new Event('change',{bubbles:true}));}
      };
      menu.append(item);
    }
    position();
    const enabled=Array.from(menu.querySelectorAll('button:enabled'));
    (enabled.find(item=>item.dataset.value===previous)||enabled.find(item=>item.getAttribute('aria-selected')==='true')||enabled[0])?.focus({preventScroll:true});
  }
  function open(trigger){
    if(trigger===select){close(true);return;}
    close();select=trigger;stamp=null;
    menu.setAttribute('aria-label',trigger.getAttribute('aria-label')||trigger.title);
    trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','true');
    document.body.append(menu);render();
    if(select)observer.observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','label','selected']});
  }
  const isTrigger=target=>target.matches?.('.compose-bottom > select')&&!target.disabled&&desktop();
  document.addEventListener('pointerdown',event=>{
    if(event.button===0&&isTrigger(event.target)){
      event.preventDefault();open(event.target);
    }else if(select&&!menu.contains(event.target))close();
  });
  document.addEventListener('mousedown',event=>{if(event.button===0&&isTrigger(event.target))event.preventDefault();});
  document.addEventListener('click',event=>{
    if(!isTrigger(event.target))return;
    event.preventDefault();
    if(event.detail===0)open(event.target);
  });
  document.addEventListener('keydown',event=>{
    if(isTrigger(event.target)&&['ArrowDown','ArrowUp',' ','Enter','F4'].includes(event.key)){
      event.preventDefault();open(event.target);return;
    }
    if(!select||!menu.contains(event.target))return;
    if(event.key==='Escape'){event.preventDefault();close(true);return;}
    if(event.key==='Tab'){close(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const enabled=Array.from(menu.querySelectorAll('button:enabled')),index=enabled.indexOf(event.target);
    const target=event.key==='Home'?0:event.key==='End'?enabled.length-1:index+(event.key==='ArrowDown'?1:-1);
    enabled[Math.max(0,Math.min(enabled.length-1,target))]?.focus();
  });
  document.addEventListener('focusin',event=>{if(select&&event.target!==select&&!menu.contains(event.target))close();});
  window.addEventListener('resize',position);
  window.addEventListener('scroll',event=>{if(select&&!menu.contains(event.target))position();},true);
}
if(typeof window!=='undefined'&&window.PointerEvent&&typeof MutationObserver==='function')installComposerModeMenu();

// 화면의 기본 동작만 상태에 따라 바꾸고, 서버에는 기존 전송 모드만 보낸다.
function resolveComposerSendMode(selection,view,queueAllowed=true) {
  if(selection!=='auto')return selection;
  return view?.status==='active'?(queueAllowed?'queue':null):'send';
}

// 전송 방식은 원래 선택 위치에 표시하고 기본값만 실행 상태에 맞춰 해석한다.
class ComposerSendModes {
  constructor({select,send,isDisabled}) {Object.assign(this,{select,send,isDisabled});}
  value(view){
    const caps=view?.access?.runtime==='wsl'||view?.endpointId?.startsWith('wsl:')?view.capabilities||{}:{};
    return resolveComposerSendMode(this.select.value,view,caps.queue!==false);
  }
  render(view,busy=false) {
    const t=BridgeI18n.t,mode=this.value(view);
    const label=t(mode==='queue'?'완료 후 보내기':mode==='steer'?'현재 작업에 바로 보내기':mode===null?'이 연결은 대기열을 지원하지 않습니다.':'메시지 보내기');
    this.send.title=label;this.send.setAttribute('aria-label',label);this.send.dataset.sendMode=mode||'unavailable';
    this.send.disabled=this.isDisabled()||mode===null;
    this.select.title=label;
  }
}

class WorkModes {
  constructor({select,hint,goalRoot,goalToggle,storage=sessionStorage,onCancel,onStatus,onEdit,newId=()=>crypto.randomUUID()}) {
    this.select=select;this.hint=hint;this.goalRoot=goalRoot;this.goalToggle=goalToggle;this.storage=storage;this.onCancel=onCancel;this.onStatus=onStatus;this.onEdit=onEdit;this.newId=newId;this.sending=false;this.editing=false;this.editText="";
    this.key=null;this.selection=null;this.view=null;this.cancelBusy=false;this.statusBusy=null;this.actionError='';
    select.onchange=()=>{this.selection=select.value;this.storage.setItem('work-mode:'+this.key,this.selection);this.actionError='';this.render();};
    goalToggle.onclick=()=>{this.storage.removeItem('hidden-goal:'+this.key);this.render();this.goalRoot.querySelector('.goal-close')?.focus();};
  }
  open(key) {
    this.key=key;const saved=this.storage.getItem('work-mode:'+key);
    this.selection=['default','plan','goal'].includes(saved)?saved:null;
    this.view=null;this.cancelBusy=false;this.statusBusy=null;this.sending=false;this.editing=false;this.editText='';this.actionError='';this.render();
  }
  value(sendMode) {return sendMode==='steer'?null:this.select.value;}
  submitted(key,mode) {
    if(mode!=='goal')return;
    this.storage.setItem('work-mode:'+key,'default');
    if(key===this.key){this.selection='default';this.cancelBusy=false;this.statusBusy=null;this.actionError='';this.render();}
  }
  async action(kind,fields,run) {
    if(this.busy())return;
    const key=this.key,storageKey='goal-action:'+key;
    const goal=this.view?.goal;
    const expected=goal?Object.fromEntries(['objective','status','createdAt','createdAtMs','goalId','revision'].filter(k=>goal[k]!=null).map(k=>[k,goal[k]])):{};
    const fingerprint=JSON.stringify({kind,fields,expected});
    let pending;try{pending=JSON.parse(this.storage.getItem(storageKey));}catch{}
    if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,payload:{id:this.newId(),...fields,expected,uiLocale:BridgeI18n.locale()}};
    this.storage.setItem(storageKey,JSON.stringify(pending));
    this.cancelBusy=kind==='cancel';this.statusBusy=kind==='cancel'?null:kind;this.actionError='';this.render();
    try{await run(pending.payload);this.storage.removeItem(storageKey);if(this.key===key)this.editing=false;}
    catch(error){if(this.key===key)this.actionError=BridgeI18n.t(error.message||'목표 작업이 실패했습니다. 다시 시도해 보세요.');}
    finally{if(this.key===key){this.cancelBusy=false;this.statusBusy=null;this.render();}}
  }
  cancel(){return this.action('cancel',{},payload=>this.onCancel(payload));}
  setStatus(status){return this.action(status,{status},payload=>this.onStatus(payload));}
  saveEdit(){return this.action('edit',{objective:this.editText.trim()},payload=>this.onEdit(payload));}
  busy(){return !!(this.sending||this.cancelBusy||this.statusBusy);}
  render(view=this.view,sendMode=this.sendMode,sending=this.sending) {
    this.view=view;this.sendMode=sendMode;this.sending=!!sending;
    const busy=this.busy();
    const caps=view?.capabilities,t=BridgeI18n.t,goalSupported=typeof caps?.goal==='boolean'?caps.goal:!!view&&(view.host==='local'
      ?view.goalRuntimeAvailable!==false&&view.access?.canUseGoal!==false
      :view.goalRuntimeAvailable===true&&view.access?.canUseGoal===true);
    const goalUnavailableReason=caps?.goal===false?'현재 클라이언트는 기본 대상 모드를 제공하지 않습니다.':view?.host!=='local'&&view?.access?.runtime==='desktop'?'SSH 호스트에서는 목표 모드를 아직 사용할 수 없습니다.':view?.access?.source==='cli'?'이 Codex 채팅에서는 목표 모드를 사용할 수 없습니다.':view?.host!=='local'?'SSH 호스트에서는 목표 모드를 아직 사용할 수 없습니다.':'데스크톱 Codex 런타임이 없습니다.';
    this.select.value=this.selection||(view?.collaborationMode==='plan'?'plan':'default');
    const pendingCapabilities=view?.readOnly===true||view?.connectionState==='detached'||view?.runtimeKnown===false;
    if(!goalSupported&&!(pendingCapabilities&&view?.composerCapabilities?.goal===true)&&this.select.value==='goal')this.select.value='default';
    const planOption=this.select.querySelector('[value=plan]');if(planOption)planOption.disabled=caps?.plan===false;
    if(caps?.plan===false&&!(pendingCapabilities&&view?.composerCapabilities?.plan===true)&&this.select.value==='plan')this.select.value='default';
    this.select.disabled=!view||view.loadingHistory||view.activating||busy||sendMode==='steer';
    const goalOption=this.select.querySelector('[value=goal]');
    goalOption.disabled=!goalSupported||!!(view?.status==='active'||(view?.goal&&view.goal.status!=='complete')||['pending','unknown'].includes(view?.goalSubmission?.status));
    goalOption.title=t(goalSupported?'':goalUnavailableReason);
    this.hint.textContent=t(sendMode==='steer'?'추가 입력으로 현재 모드 유지':this.select.value==='plan'?'먼저 토론하고 계획하세요. 확인 후 시행합니다.':this.select.value==='goal'?(goalSupported?'완료, 일시 중지 또는 취소될 때까지 목표를 향해 계속 노력하세요.':goalUnavailableReason):'');
    this.hint.hidden=!this.hint.textContent;
    this.select.title=this.hint.textContent;
    this.onRender?.();
    const goal=view?.goal,request=view?.goalSubmission;
    const renderStamp=JSON.stringify([goal,request,caps,goalSupported,this.key,BridgeI18n.locale(),busy,this.statusBusy,this.cancelBusy,this.editing,this.actionError,this.storage.getItem('hidden-goal:'+this.key)]);
    if(this.goalRenderStamp===renderStamp)return;this.goalRenderStamp=renderStamp;
    const goalIdentity=request?JSON.stringify(['request',request.id]):goal?JSON.stringify(['goal',goal.createdAt,goal.objective]):null;
    const dismissed=!!goalIdentity&&this.storage.getItem('hidden-goal:'+this.key)===goalIdentity;
    this.goalToggle.hidden=!(goal||request);
    const expanded=this.goalRoot.firstElementChild?.open||false;
    this.goalRoot.replaceChildren();this.goalRoot.hidden=!goalIdentity||dismissed;
    const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
    const button=(text,cls,onclick,disabled)=>{const el=node('button',text,cls);el.type='button';el.disabled=!!disabled;el.onclick=onclick;return el;};
    if(goal){
      const labels={active:'목표 활성',paused:'목표가 일시중지됨',blocked:'목표에 주의가 필요함',usageLimited:'목표 사용량 한도 도달',budgetLimited:'목표가 예산 한도에 도달했습니다.',complete:'목표 완료'};
      const details=document.createElement('details');details.open=expanded;
      details.append(node('summary',t(labels[goal.status]||'목표 상태')));
      details.append(node('p',goal.objective));
      if(Number.isFinite(goal.tokensUsed))details.append(node('p',t('사용된 토큰:')+goal.tokensUsed.toLocaleString()+(Number.isFinite(goal.tokenBudget)?' / '+goal.tokenBudget.toLocaleString():''),'muted'));
      this.goalRoot.append(details);
    }
    if(request){
      const labels={pending:'네이티브 목표 시작 중…',unknown:'목표 전달이 확인되지 않았습니다. 대화를 확인하세요.',unconfirmed:'대상이 열려 있는지 확인되지 않았습니다. 새로고침하거나 확인하세요. Codex。'};
      this.goalRoot.append(node('p',t(labels[request.status]||labels.unknown),'goal-pending'));
    }
    if(this.actionError)this.goalRoot.append(node('p',this.actionError,'error'));
    if(goal&&goalSupported){
      const actions=node('div','','goal-actions');
      this.goalRoot.append(actions);
      if(caps?.goalPause!==false&&['active','blocked','usageLimited','budgetLimited'].includes(goal.status)){
        actions.append(button(this.statusBusy==='paused'?t('목표 일시중지 중…'):t('목표 일시중지'),'goal-status secondary',()=>this.setStatus('paused'),this.busy()));
      }
      if(goal.status==='paused'||caps?.goalResume===true){
        actions.append(button(this.statusBusy==='active'?t('목표 재개 중…'):t('목표 재개'),'goal-status primary',()=>this.setStatus('active'),this.busy()));
      }
      if(goal.status==='paused'&&caps?.goalEdit!==false)actions.append(button(t('목표 수정'),'goal-edit secondary',()=>{this.editing=true;this.editText=goal.objective;this.render();this.goalRoot.querySelector('.goal-editor')?.focus();},this.busy()));
      actions.append(button(this.cancelBusy?t('목표 삭제 중…'):t('명확한 목표'),'goal-cancel secondary',()=>this.cancel(),this.busy()));
      this.goalRoot.append(node('p',t(caps?.goalPauseStops?'대상을 일시 중지하면 현재 대상 작업이 중지됩니다.。':'목표를 일시중지하거나 지워도 현재 응답은 중단되지 않습니다. 중지하려면 중지를 사용하세요.'),'muted'));
      if(goal.status==='active')this.goalRoot.append(node('p',t('목표를 편집하기 전에 일시중지하세요.'),'muted'));
      if(this.editing&&goal.status==='paused'){
        const input=node('textarea','', 'goal-editor');input.value=this.editText;input.maxLength=4000;input.rows=3;input.disabled=this.busy();input.setAttribute('aria-label',t('목표 목표'));input.oninput=()=>{this.editText=input.value;};
        this.goalRoot.append(input,node('p',t(typeof caps?.goal==='boolean'?'저장 후 일시중지 유지。':'목표를 변경하면 사용량이 재설정됩니다. 저장된 목표는 일시중지 상태로 유지됩니다.'),'muted'));
        this.goalRoot.append(button(t('목표 저장'),'goal-save primary',()=>this.saveEdit(),this.busy()),button(t('변경사항 취소'),'secondary',()=>{this.editing=false;this.render();},this.busy()));
      }
    }
    if(goalIdentity){
      const close=node('button','×','goal-close');close.type='button';close.title=t('목표 패널 숨기기');close.setAttribute('aria-label',close.title);
      close.onclick=()=>{this.storage.setItem('hidden-goal:'+this.key,goalIdentity);this.render();this.goalToggle.focus();};
      this.goalRoot.append(close);
    }
  }
}

if(typeof module!=='undefined')module.exports={WorkModes,ComposerSendModes,resolveComposerSendMode};
