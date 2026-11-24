'use strict';
// Shared presentation only; callers retain their own permission/confirmation flow.
function permissionIcon(preset){
  const names={ask:'permissions',default:'permissions','auto-review':'permission-review','full-access':'permission-full',
    bypassPermissions:'permission-full',acceptEdits:'edit',plan:'plan',desktop:'permission-desktop',
    'mobile-ask':'permission-mobile','auto-allow':'permission-full',build:'permissions',guarded:'permission-review',yolo:'permission-full'};
  return ComposerIcons.create(Object.hasOwn(names,preset)?names[preset]:'permission-custom');
}

function permissionOption(button,preset,label,help,selected){
  button.className='permission-option';button.type='button';
  button.setAttribute('aria-pressed',String(selected));
  const svg=permissionIcon(preset);
  const copy=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small');
  title.textContent=BridgeI18n.t(label);description.textContent=BridgeI18n.t(help);copy.append(title,description);
  const check=document.createElement('span');check.className='permission-check';if(selected)check.append(ComposerIcons.create('check'));check.setAttribute('aria-hidden','true');
  button.append(svg,copy,check);return button;
}

// All clients and side chats share native context usage and last-prompt semantics.
class ContextUsageControl {
  constructor({onCompact}={}){
    this.onCompact=onCompact;this.button=document.createElement('button');this.button.type='button';this.button.className='tool-button context-usage';this.button.hidden=true;
    this.ring=document.createElement('span');this.ring.className='context-usage-ring';this.ring.setAttribute('aria-hidden','true');this.button.append(this.ring);
    this.button.onclick=()=>this.open();
  }
  update(state){
    if(!state||state.id!==this.state?.id){this.dialog?.remove();this.dialog=null;}
    this.state=state;
    if(this.compactButton){
      const disabled=!state?.connected||state?.capabilities?.compact!==true||!!state?.busy;
      if(this.compactButton.disabled!==disabled)this.compactButton.disabled=disabled;
    }
    if(this.button.hidden!==!state)this.button.hidden=!state;
    const usage=state?.contextUsage;
    const known=usage?.measurement!=='lastPrompt'&&Number.isFinite(usage?.usedTokens)&&usage.usedTokens>=0&&Number.isFinite(usage.contextWindow)&&usage.contextWindow>0;
    const percent=known?Math.round(usage.usedTokens/usage.contextWindow*100):null;
    const ringPercent=known?Math.min(percent,100)+'%':'0%';
    if(this.ringPercent!==ringPercent){
      this.ring.style.setProperty('--context-percent',ringPercent);
      this.ringPercent=ringPercent;
    }
    if(this.ring.classList.contains('unknown')===known)this.ring.classList.toggle('unknown',!known);
    const label=BridgeI18n.t('上下文使用量')+' · '+(known?percent+'%':BridgeI18n.t('暂未提供'));
    if(this.button.title!==label){
      this.button.title=label;
      this.button.setAttribute('aria-label',label);
    }
  }
  open(){
    if(!this.state)return;this.dialog?.remove();const dialog=this.dialog=document.createElement('dialog');dialog.className='picker';
    const title=document.createElement('h2');title.textContent=BridgeI18n.t('上下文使用量');
    const close=document.createElement('button');close.type='button';close.className='icon-button';close.append(ComposerIcons.create('close'));close.setAttribute('aria-label',BridgeI18n.t('关闭'));close.onclick=()=>dialog.close();const head=document.createElement('div');head.className='picker-head';head.append(title,close);dialog.append(head);
    const line=(label,value)=>{const p=document.createElement('p');p.textContent=BridgeI18n.t(label)+(value===undefined?'':' · '+value);dialog.append(p);};
    const usage=this.state.contextUsage,previous=this.state.lastPromptContextUsage,number=value=>Number.isFinite(value)&&value>=0?value.toLocaleString(BridgeI18n.locale()):BridgeI18n.t('사용할 수 없음');
    if(!usage)line(this.state.contextUsageStatus==='unsupported'?'이 클라이언트 또는 세션 모드는 컨텍스트 사용법을 노출하지 않습니다.':this.state.contextUsageStatus==='unavailable'?'이 세션에서는 아직 컨텍스트 사용을 사용할 수 없습니다. 사용 가능한 경우 자동으로 업데이트됩니다.':'이 클라이언트는 이 세션에 대한 컨텍스트 사용을 제공하지 않았습니다.');
    else {
      line(usage.measurement==='lastPrompt'?'최신 모델 입력':'사용된 토큰',number(usage.usedTokens));line('컨텍스트 용량',number(usage.contextWindow));
      if(usage.measurement!=='lastPrompt'&&usage.contextWindow>0&&Number.isFinite(usage.usedTokens)&&usage.usedTokens>=0)line('사용된 컨텍스트',(usage.usedTokens/usage.contextWindow*100).toFixed(1)+'%');
      if(usage.model)line('모델',usage.model);
      if(Number.isFinite(usage.autoCompactThresholdTokens))line('자동 압축 임계값',number(usage.autoCompactThresholdTokens));
      if(Number.isFinite(usage.pressureTokens)&&usage.pressureTokens!==usage.usedTokens)line('확인된 컨텍스트 토큰',number(usage.pressureTokens));
      for(const [key,label] of [['inputTokens','최근 입력 토큰'],['cacheReadTokens','캐시 읽기 토큰'],['cacheWriteTokens','캐시 쓰기 토큰']])if(Number.isFinite(usage.cache?.[key]))line(label,number(usage.cache[key]));
      if(usage.compacted)line('최근 압축 후 측정되었습니다.');
      if(usage.measurement==='lastPrompt')line('최신 요청 입력 및 캐시된 토큰 보내지 않은 콘텐츠는 포함되지 않습니다.');
      if(usage.estimated)line('아직 전송되지 않은 콘텐츠에 대한 클라이언트 추정치를 포함합니다.');
      if(usage.cached||!this.state.connected)line('캐시된 데이터. 연결이 재개되면 업데이트됩니다.');
    }
    if(previous&&!usage){line('최신 모델 입력',number(previous.usedTokens));line('최신 요청 입력 및 캐시된 토큰 보내지 않은 콘텐츠는 포함되지 않습니다.');}
    if(this.onCompact&&this.state.capabilities?.compact===true){
      const stateId=this.state.id,button=this.compactButton=document.createElement('button');button.type='button';button.textContent=BridgeI18n.t('컴팩트한 컨텍스트');button.disabled=!this.state.connected||!!this.state.busy;
      button.onclick=async()=>{if(button.disabled||stateId!==this.state?.id)return;button.disabled=true;try{if(await this.onCompact())dialog.close();}finally{if(dialog.open&&stateId===this.state?.id)button.disabled=!this.state.connected||this.state.capabilities?.compact!==true||!!this.state.busy;}};
      dialog.append(button);
    }
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
  }
  dispose(){this.dialog?.remove();this.button.remove();}
}

// Linux Desktop and native CLI capability picker; other sessions keep their existing flow.
async function permissionPicker(dialog,{load,save,isCurrent,onSaved,nativeCli=false}){
  const t=BridgeI18n.t,options=document.createElement('div'),status=document.createElement('p'),refresh=document.createElement('button');
  status.className='muted';status.setAttribute('role','status');refresh.type='button';refresh.textContent=t('새로고침');
  dialog.append(options,status,refresh);
  let busy=false,revision=0,buttons=[];
  const valid=()=>dialog.open&&isCurrent();
  const setBusy=value=>{busy=value;refresh.disabled=value;for(const [button,available] of buttons)button.disabled=value||!available;};
  const labels={ask:['승인 요청','추가 권한이 필요할 때 물어보세요.'],'auto-review':['승인해 주세요','Codex는 추가 권한이 필요한 작업을 검토합니다.'],'full-access':['전체 액세스','개별 승인 없이 작업 공간 및 네트워크 외부의 파일에 대한 액세스를 허용합니다.']};
  const unknown=nativeCli?'CLI 권한 기능을 확인할 수 없습니다. CLI 런타임 및 정책을 확인한 후 새로 고치세요.':'권한 기능을 확인할 수 없습니다. 데스크탑 설정을 확인한 후 이 패널을 다시 여십시오.';
  const reload=async()=>{
    if(busy||!valid())return;
    const version=++revision;options.replaceChildren();buttons=[];setBusy(true);status.textContent=t('읽기 권한 옵션…');
    try{
      const result=await load();if(version!==revision||!valid())return;
      options.replaceChildren();buttons=[];
      for(const option of result.options||[]){
        const preset=option.preset;if(!Object.hasOwn(labels,preset))continue;
        const [label,help]=labels[preset],available=option.available===true;
        const button=permissionOption(document.createElement('button'),preset,label,available?help:option.reason||unknown,result.current===preset);
        buttons.push([button,available]);button.disabled=!available;
        button.onclick=async()=>{
          if(busy||!available||!valid())return;
          if(preset==='full-access'&&!confirm(t('이 채팅에 컴퓨터 파일 및 네트워크에 대한 전체 액세스를 허용하시겠습니까? 신뢰하는 작업에 대해서만 활성화하세요.')))return;
          setBusy(true);status.textContent='';
          try{
            const response=await save(preset);if(!valid())return;
            if(response.confirmed===true){onSaved(response);dialog.close();}
            else status.textContent=t(nativeCli?'권한이 제출되었습니다. CLI 런타임 확인을 기다리는 중입니다.':'권한이 제출되었습니다. 데스크톱 확인을 기다리는 중입니다.');
          }catch(e){if(valid())status.textContent=t(e.message);}
          finally{setBusy(false);}
        };options.append(button);
      }
      status.textContent=buttons.length?'':t(unknown);
    }catch(e){if(valid())status.textContent=t(e.message);}
    finally{setBusy(false);}
  };
  refresh.onclick=reload;dialog.addEventListener('close',()=>{revision++;});
  await reload();
}
