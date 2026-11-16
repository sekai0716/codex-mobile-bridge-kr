'use strict';

// 모델 창과 바로가기 버튼이 같은 계정·모델의 Fast 지원 여부와 속도를 읽는다.
function fastModeState(catalog,view,model){
  const available=catalog?.fastMode?.allowed===true&&view?.provider===(catalog.fastMode.provider||'openai')&&!!model?.fastTier;
  if(!available)return {available:false,fast:false,other:false};
  const tier=view&&'serviceTier' in view?view.serviceTier:'currentServiceTier' in catalog?catalog.currentServiceTier:catalog.fastMode?.defaultServiceTier??model.defaultServiceTier;
  const fast=['fast','priority',model.fastTier].includes(tier);
  return {available:true,fast,other:tier!=null&&!['default','standard'].includes(tier)&&!fast};
}

class FastModeControl {
  constructor({root,input}){
    Object.assign(this,{root,input});this.reset();
    input.onchange=()=>{this.dirty=true;this.render();};
  }
  reset(){this.catalog=null;this.view=null;this.model=null;this.dirty=false;this.busy=false;this.render();}
  open(catalog,view,model){this.catalog=catalog;this.view=view;this.select(model);}
  select(model){this.model=Array.isArray(this.catalog?.models)?this.catalog.models.find(m=>m.id===model):null;this.dirty=false;this.render();}
  sync(view){this.view=view;this.render();}
  setBusy(value){this.busy=value;this.render();}
  available(){return fastModeState(this.catalog,this.view,this.model).available;}
  payload(){return this.available()&&this.dirty?{fastMode:this.input.checked}:{};}
  render(){
    this.root.hidden=!this.available();this.input.disabled=this.busy||!this.view?.connected;
    if(this.root.hidden)return;
    const {fast,other}=fastModeState(this.catalog,this.view,this.model);
    if(!this.dirty){this.input.checked=fast;this.input.indeterminate=other;}
    else this.input.indeterminate=false;
  }
}

// 현재 대화의 속도를 즉시 전환하되, 적용 확인 전에는 다음 클릭을 보류한다.
class FastModeToggle {
  constructor({button,onChange,onError}){
    Object.assign(this,{button,onChange,onError});this.key='';this.pending=null;this.awaiting=null;
    button.type='button';button.id='fast-mode-toggle';button.className='tool-button fast-mode-toggle';
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-13h-7z"/></svg>';
    button.onclick=()=>this.toggle();this.sync({});
  }
  sync({catalog=null,view=null,key='',canChange=false,blocked=false}){
    Object.assign(this,{catalog,view,key,canChange,blocked});
    this.model=catalog?.models?.find(model=>model.id===view?.model);
    // 이전 대화의 늦은 응답과 확인 중인 속도를 새 모델·계정에 적용하지 않는다.
    if(this.awaiting&&(this.awaiting.key!==key||view?.serviceTier===this.awaiting.tier))this.awaiting=null;
    this.render();
  }
  render(){
    const {available,fast,other}=fastModeState(this.catalog,this.view,this.model),t=BridgeI18n.t;
    this.button.hidden=!this.view;
    this.button.disabled=!available||!this.view?.connected||!this.canChange||this.blocked||!!this.pending||!!this.awaiting;
    const label=t(this.pending?'빠른 모드 변경 중…':this.awaiting?'빠른 모드 동기화 대기 중…':!this.catalog?'빠른 모드 확인 중…':!available?'이 모델에서는 빠른 모드를 사용할 수 없습니다.':other?'빠른 모드 · 다른 속도 설정 사용 중':fast?'빠른 모드 켜짐':'빠른 모드 꺼짐');
    this.button.title=label;this.button.setAttribute('aria-label',label);
    this.button.setAttribute('aria-pressed',other?'mixed':String(fast));
    this.button.setAttribute('aria-busy',String(!!this.pending||!!this.awaiting));
  }
  async toggle(){
    if(this.button.disabled)return;
    const {fast}=fastModeState(this.catalog,this.view,this.model);
    const target={key:this.key,model:this.view.model,effort:this.view.effort,fastMode:!fast};
    this.pending=target;this.render();
    try{
      const result=await this.onChange(target);
      // 수락 응답만 받은 경우 실제 세션의 동일 속도가 관찰될 때 잠금을 해제한다.
      if(this.key===target.key&&result?.serviceTier!==undefined&&this.view?.serviceTier!==result.serviceTier)this.awaiting={key:target.key,tier:result.serviceTier};
    }catch(error){if(this.key===target.key)this.onError(error);}
    finally{this.pending=null;this.render();}
  }
}
if(typeof module!=='undefined')module.exports={FastModeControl,FastModeToggle};
