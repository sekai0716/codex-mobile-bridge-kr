'use strict';
// 계정 화면과 같은 읽기 전용 API·5분 캐시를 사용한다. 채팅/계정이 바뀐 응답은 버린다.
class AccountUsageControl {
  constructor({read}={}){
    this.read=read;this.generation=0;this.checkedAt=0;this.cache=new Map();
    this.button=document.createElement('button');this.button.type='button';this.button.className='tool-button account-usage';this.button.hidden=true;
    this.button.onclick=()=>this.open();
  }
  update(scope){
    const key=scope?JSON.stringify([scope.host,scope.provider,scope.identity]):'';
    if(key!==this.key){this.generation++;this.key=key;this.scope=scope;this.dialog?.remove();this.dialog=null;this.loading=false;const cached=this.cache.get(key);this.value=cached?.value;this.checkedAt=cached?.checkedAt||0;this.error='';}
    this.scope=scope;this.button.hidden=!scope;
    if(!scope)return;
    this.paint();if(!this.loading&&Date.now()-this.checkedAt>=300000)this.refresh(false);
  }
  async refresh(force){
    if(!this.scope||this.loading)return;
    const generation=this.generation,scope=this.scope,key=this.key;this.loading=true;this.paint();
    try{
      const value=await this.read(scope,force);
      if(generation!==this.generation||key!==this.key)return;
      this.value=value;this.error='';this.checkedAt=Date.now();this.cache.set(key,{value,checkedAt:this.checkedAt});
      // 식별자가 다른 계정의 수치가 다음 상태에 잠깐 섞이지 않도록 다른 캐시는 해제한다.
      for(const cachedKey of this.cache.keys())if(cachedKey!==key)this.cache.delete(cachedKey);
    }catch(error){if(generation===this.generation){this.value=null;this.error=error.message;this.checkedAt=Date.now();}}
    finally{if(generation===this.generation){this.loading=false;this.paint();this.renderDetails();}}
  }
  duration(minutes){
    const t=BridgeI18n.t;
    if(minutes===10080)return t('Weekly');
    const [count,key]=minutes%1440===0?[minutes/1440,'{count} days']:minutes%60===0?[minutes/60,'{count} hours']:[minutes,'{count} minutes'];
    return Number.isFinite(count)&&count>0?t(key).replace('{count}',count):t('사용량 창');
  }
  paint(){
    const t=BridgeI18n.t,limits=this.value?.visible?this.value.limits||[]:[];
    const bucket=limits.find(row=>row.id==='codex')||(limits.length===1?limits[0]:null);
    const windows=(bucket?.windows||[]).filter(row=>Number.isFinite(row.remainingPercent));
    // 도구줄은 작게 유지한다. 한도 하나는 기간을 표시하고 두 개는 수치만 나란히 둔다.
    // 각 기간의 전체 이름은 접근성 설명과 클릭해서 여는 상세창에서 제공한다.
    const shown=windows.slice(0,2);
    this.button.textContent=shown.length?(shown.length===1?this.duration(shown[0].windowDurationMins)+' ':'')+shown.map(row=>Math.round(row.remainingPercent)+'%').join('·'):'—';
    this.button.title=t(this.loading?'Checking account limits…':this.error?'Account limits unavailable':'Remaining account limits');
    if(windows.length)this.button.title+=' · '+windows.map(row=>this.duration(row.windowDurationMins)+' '+t('{percent}% remaining').replace('{percent}',Math.round(row.remainingPercent))).join(' · ');
    this.button.setAttribute('aria-label',this.button.title);
  }
  node(tag,text,cls=''){const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  open(){
    if(!this.scope)return;this.dialog?.remove();const t=BridgeI18n.t,dialog=this.dialog=this.node('dialog',undefined,'picker account-usage-dialog');
    const head=this.node('div',undefined,'picker-head'),close=this.node('button','×','icon-button');close.type='button';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>dialog.close();head.append(this.node('h2',t('Account usage limits')),close);
    this.details=this.node('div');dialog.append(head,this.details);document.body.append(dialog);dialog.addEventListener('close',()=>{if(this.dialog===dialog){this.dialog=null;this.details=null;}dialog.remove();},{once:true});
    this.renderDetails();dialog.showModal();
  }
  renderDetails(){
    if(!this.details||!this.dialog)return;const t=BridgeI18n.t;this.details.replaceChildren();
    const refresh=this.node('button',t('Refresh usage limits'));refresh.type='button';refresh.disabled=this.loading;refresh.onclick=()=>this.refresh(true);this.details.append(refresh);
    if(this.loading)this.details.append(this.node('p',t('Checking account limits…'),'muted'));
    if(this.error||this.value?.error)this.details.append(this.node('p',t(this.error||this.value.error),'error'));
    const limits=this.value?.visible?this.value.limits||[]:[];
    if(!limits.length&&!this.loading)this.details.append(this.node('p',t('No usage limits are available for this account.'),'muted'));
    for(const bucket of limits){const section=this.node('section',undefined,'account-quota');section.append(this.node('h3',bucket.name));for(const row of bucket.windows||[]){
      const line=this.node('p');line.textContent=this.duration(row.windowDurationMins)+' · '+(Number.isFinite(row.remainingPercent)?t('{percent}% remaining').replace('{percent}',Math.round(row.remainingPercent)):t('사용할 수 없음'));section.append(line);
      if(Number.isFinite(row.resetsAt)){const stamp=new Intl.DateTimeFormat(BridgeI18n.locale(),{dateStyle:'short',timeStyle:'short'}).format(new Date(row.resetsAt*1000));section.append(this.node('p',t('재설정 시간:')+' '+stamp,'muted'));}
    }this.details.append(section);}
    if(this.checkedAt)this.details.append(this.node('p',t('Last checked: {time}').replace('{time}',new Date(this.checkedAt).toLocaleTimeString(BridgeI18n.locale())),'muted'));
  }
  relabel(){this.paint();this.renderDetails();}
}
if(typeof module!=='undefined')module.exports={AccountUsageControl};
