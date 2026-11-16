'use strict';
// Shared presentation only; callers retain their own permission/confirmation flow.
function permissionOption(button,preset,label,help,selected){
  button.className='permission-option';button.type='button';
  button.setAttribute('aria-pressed',String(selected));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d','M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z'+(preset==='ask'?'M12 8v5m0 3h.01':preset==='auto-review'?'M8 12l3 3 5-6':'M13 7l-4 6h4l-2 4 5-6h-4l1-4'));
  svg.append(path);
  const copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small');
  title.textContent=BridgeI18n.t(label);description.textContent=BridgeI18n.t(help);copy.append(title,description);
  const check=document.createElement('span');check.className='permission-check';check.textContent=selected?'✓':'';check.setAttribute('aria-hidden','true');
  button.append(svg,copy,check);return button;
}

// Codex main and side chats use the same native token-usage presentation.
class ContextUsageControl {
  constructor(){
    this.button=document.createElement('button');this.button.type='button';this.button.className='tool-button context-usage';this.button.hidden=true;
    this.ring=document.createElement('span');this.ring.className='context-usage-ring';this.ring.setAttribute('aria-hidden','true');this.button.append(this.ring);
    this.button.onclick=()=>this.open();
  }
  update(state){
    if(!state||state.id!==this.state?.id){this.dialog?.remove();this.dialog=null;}
    this.state=state;this.button.hidden=!state;const usage=state?.contextUsage;
    const known=Number.isFinite(usage?.usedTokens)&&usage.usedTokens>=0&&Number.isFinite(usage.contextWindow)&&usage.contextWindow>0;
    const percent=known?Math.round(usage.usedTokens/usage.contextWindow*100):null;
    this.ring.style.setProperty('--context-percent',known?Math.min(percent,100)+'%':'0%');this.ring.classList.toggle('unknown',!known);
    this.button.title=BridgeI18n.t('컨텍스트 사용법')+' · '+(known?percent+'%':BridgeI18n.t("사용할 수 없음"));this.button.setAttribute('aria-label',this.button.title);
  }
  open(){
    if(!this.state)return;this.dialog?.remove();const dialog=this.dialog=document.createElement('dialog');dialog.className='picker';
    const title=document.createElement('h2');title.textContent=BridgeI18n.t('컨텍스트 사용법');
    const close=document.createElement('button');close.type='button';close.className='icon-button';close.textContent='×';close.setAttribute('aria-label',BridgeI18n.t('닫기'));close.onclick=()=>dialog.close();const head=document.createElement('div');head.className='picker-head';head.append(title,close);dialog.append(head);
    const line=(label,value)=>{const p=document.createElement('p');p.textContent=BridgeI18n.t(label)+(value===undefined?'':' · '+value);dialog.append(p);};
    const usage=this.state.contextUsage,number=value=>Number.isFinite(value)&&value>=0?value.toLocaleString(BridgeI18n.locale()):BridgeI18n.t("사용할 수 없음");
    if(!usage)line("이 클라이언트는 이 세션에 대한 컨텍스트 사용을 제공하지 않았습니다.");
    else {line("사용된 토큰",number(usage.usedTokens));line("컨텍스트 용량",number(usage.contextWindow));if(usage.contextWindow>0)line("사용된 컨텍스트",(usage.usedTokens/usage.contextWindow*100).toFixed(1)+'%');if(usage.cached||!this.state.connected)line("캐시된 데이터. 연결이 재개되면 업데이트됩니다.");}
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  }
  dispose(){this.dialog?.remove();this.button.remove();}
}

// Local Linux capability picker; other platforms keep their existing flow.
async function permissionPicker(dialog,{load,save,isCurrent,onSaved}){
  const t=BridgeI18n.t,options=document.createElement('div'),status=document.createElement('p'),refresh=document.createElement('button');
  status.className='muted';status.setAttribute('role','status');refresh.type='button';refresh.textContent=t('새로 고치다');
  dialog.append(options,status,refresh);
  let busy=false,revision=0,buttons=[];
  const valid=()=>dialog.open&&isCurrent();
  const setBusy=value=>{busy=value;refresh.disabled=value;for(const [button,available] of buttons)button.disabled=value||!available;};
  const labels={ask:['승인 요청',"추가 권한이 필요할 때 물어보세요."],'auto-review':["승인해 주세요","Codex는 추가 권한이 필요한 작업을 검토합니다."],'full-access':['전체 액세스',"개별 승인 없이 작업 공간 및 네트워크 외부의 파일에 대한 액세스를 허용합니다."]};
  const reload=async()=>{
    if(busy||!valid())return;
    const version=++revision;options.replaceChildren();buttons=[];setBusy(true);status.textContent=t('읽기 권한 옵션…');
    try{
      const result=await load();if(version!==revision||!valid())return;
      options.replaceChildren();buttons=[];
      for(const option of result.options||[]){
        const preset=option.preset;if(!Object.hasOwn(labels,preset))continue;
        const [label,help]=labels[preset],available=option.available===true;
        const button=permissionOption(document.createElement('button'),preset,label,available?help:option.reason||"권한 기능을 확인할 수 없습니다. 데스크탑 설정을 확인한 후 이 패널을 다시 여십시오.",result.current===preset);
        buttons.push([button,available]);button.disabled=!available;
        button.onclick=async()=>{
          if(busy||!available||!valid())return;
          if(preset==='full-access'&&!confirm(t("이 채팅에 컴퓨터 파일 및 네트워크에 대한 전체 액세스를 허용하시겠습니까? 신뢰하는 작업에 대해서만 활성화하세요.")))return;
          setBusy(true);status.textContent='';
          try{
            const response=await save(preset);if(!valid())return;
            if(response.confirmed===true){onSaved(response);dialog.close();}
            else status.textContent=t("권한이 제출되었습니다. 데스크톱 확인을 기다리는 중입니다.");
          }catch(e){if(valid())status.textContent=t(e.message);}
          finally{setBusy(false);}
        };options.append(button);
      }
      status.textContent=buttons.length?'':t("권한 기능을 확인할 수 없습니다. 데스크탑 설정을 확인한 후 이 패널을 다시 여십시오.");
    }catch(e){if(valid())status.textContent=t(e.message);}
    finally{setBusy(false);}
  };
  refresh.onclick=reload;dialog.addEventListener('close',()=>{revision++;});
  await reload();
}
