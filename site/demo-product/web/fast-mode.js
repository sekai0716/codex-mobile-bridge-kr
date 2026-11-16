'use strict';
class FastModeControl {
  constructor({root,input,status}){
    Object.assign(this,{root,input,status});this.reset();
    input.onchange=()=>{this.dirty=true;this.render();};
  }
  reset(){this.catalog=null;this.view=null;this.model=null;this.dirty=false;this.busy=false;this.render();}
  open(catalog,view,model){this.catalog=catalog;this.view=view;this.select(model);}
  select(model){this.model=Array.isArray(this.catalog?.models)?this.catalog.models.find(m=>m.id===model):null;this.dirty=false;this.render();}
  sync(view){this.view=view;this.render();}
  setBusy(value){this.busy=value;this.render();}
  available(){return this.catalog?.fastMode?.allowed===true&&this.view?.provider==='openai'&&!!this.model?.fastTier;}
  payload(){return this.available()&&this.dirty?{fastMode:this.input.checked}:{};}
  render(){
    this.root.hidden=!this.available();this.input.disabled=this.busy||!this.view?.connected;
    if(this.root.hidden)return;
    const hasTier=this.view&&'serviceTier' in this.view;
    const tier=hasTier?this.view.serviceTier:'currentServiceTier' in this.catalog?this.catalog.currentServiceTier:this.catalog.fastMode?.defaultServiceTier??this.model?.defaultServiceTier;
    const fast=['fast','priority',this.model.fastTier].includes(tier),other=tier!=null&&!['default','standard'].includes(tier)&&!fast;
    if(!this.dirty){this.input.checked=fast;this.input.indeterminate=other;}
    else this.input.indeterminate=false;
    this.status.textContent=BridgeI18n.t(!this.view?.connected?"이 설정을 변경하려면 데스크톱에 연결하세요.":this.dirty?"저장 후 다음 턴부터 적용":other?"다른 속도 등급이 활성화되었습니다. 이를 전환하면 해당 설정이 대체됩니다.":fast?"빠른 속도가 켜져 있습니다":'표준 속도');
  }
}
if(typeof module!=='undefined')module.exports={FastModeControl};
