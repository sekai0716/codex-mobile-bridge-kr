'use strict';
class HarnessPanel {
  constructor({root,api,t,feedback}) {
    this.root=root;this.api=api;this.t=t;this.feedback=feedback;this.dirty=false;this.busy=false;this.generation=0;
    root.querySelector('form').addEventListener('input',()=>{this.dirty=true;});
    root.querySelector('form').onsubmit=event=>{event.preventDefault();this.action('save');};
    root.querySelectorAll('[data-harness-action]').forEach(button=>button.onclick=()=>this.action(button.dataset.harnessAction));
    root.querySelectorAll('[data-harness-choose]').forEach(button=>button.onclick=async()=>{
      try{const key=button.dataset.harnessChoose,path=await api.choose(key==='executable'?'file':'folder');if(path){root.querySelector('[name='+key+']').value=path;this.dirty=true;}}catch(error){feedback(error.message,true);}
    });
  }
  render(value) {
    this.value=value;
    if(!this.dirty)for(const [key,text] of Object.entries(value.config))this.root.querySelector('[name='+key+']').value=text;
    const states={stopped:"Harness가 중지되었습니다.",starting:"Harness 시작 중",running:"Harness 실행 중",failed:"Harness를 시작하지 못했습니다."};
    this.root.querySelector('[data-harness-state]').textContent=this.t(states[value.state]||states.failed);
    this.root.querySelector('pre').textContent=value.logs.join('\n')||this.t('아직 로그가 없습니다.');
    this.buttons();
  }
  buttons() {
    for(const button of this.root.querySelectorAll('button'))button.disabled=this.busy;
    const running=this.value?.running||this.value?.state==='starting';
    this.root.querySelectorAll('input,[data-harness-choose],button[type=submit]').forEach(node=>node.disabled=this.busy||running);
    this.root.querySelector('[data-harness-action=start]').disabled=this.busy||running;
    this.root.querySelector('[data-harness-action=stop]').disabled=this.busy||!running;
    this.root.querySelector('[data-harness-action=open]').disabled=this.busy||!this.value?.running;
    this.root.querySelector('[data-harness-action=detect]').disabled=this.busy||running;
  }
  clear() {this.generation++;this.dirty=false;this.value=null;for(const input of this.root.querySelectorAll('input[name]'))input.value='';this.buttons();}
  async refresh() {
    if(this.busy)return;const generation=this.generation;
    try{const value=await this.api.harness({action:'status'});if(generation===this.generation)this.render(value);}
    catch(error){if(generation===this.generation)this.feedback(error.message,true);}
  }
  async action(action) {
    if(this.busy)return;
    this.busy=true;this.buttons();
    try {
      if(action==='open'){await this.api.open('harness');return;}
      if(action==='start'&&this.dirty)throw Error("먼저 Harness 구성을 저장하세요.");
      const config=Object.fromEntries([...this.root.querySelectorAll('input[name]')].map(input=>[input.name,input.value.trim()]));
      const value=await this.api.harness({action,...(action==='save'?{config}:{})});
      if(action==='save')this.dirty=false;
      this.render(value);
      if(action==='detect'){
        if(value.detected){this.root.querySelector('[name=executable]').value=value.detected;this.dirty=true;}
        else this.feedback(this.t("Harness를 찾을 수 없습니다. 설치된 실행 파일을 선택하십시오."),true);
      }
    }catch(error){this.feedback(error.message,true);}
    finally{this.busy=false;this.buttons();}
  }
}
if(typeof module!=='undefined')module.exports={HarnessPanel};
