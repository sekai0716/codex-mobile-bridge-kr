'use strict';

class WatchPanel {
  constructor({root,change}){this.root=root;this.change=change;this.revision=0;this.busy=false;this.value=null;this.error='';}
  clear(){this.revision++;this.busy=false;this.value=null;this.error='';this.root.replaceChildren();}
  render(value,revision=this.revision){
    if(revision!==this.revision||this.busy)return;
    this.value=value;this.root.replaceChildren();
    const t=BridgeI18n.t,node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
    if(this.error){const error=node('p',t(this.error),'error');error.setAttribute('role','alert');this.root.append(error);}
    if(!value.watches.length){this.root.append(node('p',t("아직 본 채팅이 없습니다. 휴대폰에서 채팅을 열고 알림을 활성화하세요."),'hint'));return;}
    const enabled=value.notifications.enabled||value.notifications.barkEnabled;
    this.root.append(node('p',t(!value.runtime.running?"게이트웨이가 중지되었습니다. 모니터링이 시작되면 재개됩니다.":!enabled?"알림 채널이 비활성화되었습니다. 저장된 시계에서는 알림이 전송되지 않습니다.":"귀하의 확인이 필요한 요청이 있는지 채팅을 살펴보세요."),'hint'));
    for(const watch of value.watches){
      const row=node('section',null,'watch-row');row.dataset.id=watch.id;row.dataset.host=watch.host;
      const info=node('div',null,'watch-info');info.append(node('strong',watch.title||t("채팅 이름을 사용할 수 없습니다.")));
      info.append(node('small',[watch.host==='local'?t('이 컴퓨터'):watch.hostLabel||watch.host,watch.cwd].filter(Boolean).join(' · ')));
      info.append(node('small',watch.id,'watch-id'));
      const actions=node('div',null,'watch-actions'),label=node('label',null,'check'),input=node('input');input.type='checkbox';input.checked=!!watch.notifyOnCompletion;
      input.onchange=event=>{event.stopPropagation();this.submit(watch,{action:'update',notifyOnCompletion:input.checked});};
      label.append(input,node('span',t("실행이 완료되면 알림")));
      const remove=node('button',t("시계 제거"),'watch-remove');remove.type='button';remove.onclick=()=>this.submit(watch,{action:'remove'});
      actions.append(label,remove);row.append(info,actions);this.root.append(row);
    }
  }
  async submit(watch,action){
    if(this.busy)return;
    const revision=++this.revision;this.busy=true;this.error='';
    this.root.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    try{
      const result=await this.change({id:watch.id,host:watch.host,...action});
      if(revision===this.revision)this.value={...this.value,watches:result.watches};
    }catch(error){if(revision===this.revision)this.error=error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{if(revision===this.revision){this.busy=false;this.revision++;this.render(this.value);}}
  }
}

if(typeof module!=='undefined')module.exports={WatchPanel};
