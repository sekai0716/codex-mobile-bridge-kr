'use strict';
const actionText=source=>typeof BridgeI18n==='undefined'?source:BridgeI18n.t(source);
window.BridgeClipboard={
  async copy(getText,button){
    if(button.disabled)return;
    const label=button.textContent;button.disabled=true;button.textContent=actionText("로드 중…");
    try{
      const text=await getText();
      try{
        if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        button.textContent=actionText('복사됨');
        setTimeout(()=>{button.textContent=label;},1500);
      }catch{
        const dialog=document.createElement('dialog');dialog.className='picker copy-dialog';
        const heading=document.createElement('h2');heading.textContent=actionText("텍스트 복사");
        const help=document.createElement('p');help.className='muted';help.textContent=actionText("귀하의 브라우저가 자동 복사를 차단했습니다. 텍스트를 선택하고 시스템 복사 작업이나 키보드 단축키를 사용합니다.");
        const input=document.createElement('textarea');input.readOnly=true;input.value=text;input.setAttribute('aria-label',actionText("텍스트 복사"));
        const close=document.createElement('button');close.className='primary';close.textContent=actionText("완료");close.onclick=()=>dialog.close();
        dialog.append(heading,help,input,close);document.body.append(dialog);
        dialog.onclose=()=>{dialog.remove();button.focus();};dialog.showModal();input.focus();input.select();input.setSelectionRange(0,text.length);
        button.textContent=label;
      }
    }catch(error){button.textContent=label;document.dispatchEvent(new CustomEvent('bridge-message-error',{detail:error.message}));}
    finally{button.disabled=false;}
  }
};

class MessageActions {
  constructor({request,openChat,refresh,uuid,notify,busy}){
    Object.assign(this,{request,openChat,refresh,uuid,notify,busy});
    this.dialog=document.getElementById('message-action-dialog');
    this.title=document.getElementById('message-action-heading');
    this.description=document.getElementById('message-action-description');
    this.input=document.getElementById('message-action-text');
    this.error=document.getElementById('message-action-error');
    this.submit=document.getElementById('message-action-submit');
    this.form=document.getElementById('message-action-form');
    this.form.onsubmit=event=>{event.preventDefault();this.send();};
    this.dialog.addEventListener('cancel',event=>{if(this.pending)event.preventDefault();});
    this.dialog.addEventListener('close',()=>{if(!this.pending)this.target=null;});
    this.input.oninput=()=>{if(this.target)sessionStorage.setItem(this.draftKey(),this.input.value);};
  }
  relabel(){if(!this.target)return;for(const node of [this.title,this.description,this.submit,this.error])node.textContent=actionText(node.textContent);}
  draftKey(){return 'message-edit:'+this.target.url+':'+this.target.row.key;}
  async open(action,row,timeline){
    if(this.pending)return;
    const target=this.target={action,row:{...row},timeline,url:timeline.url('message-action')};
    this.error.textContent='';this.input.value='';this.input.hidden=action==='fork';this.input.required=action!=='fork';
    this.title.textContent=actionText(action==='fork'?'여기에서 분기':action==='edit'?'수정하고 다시 보내기':"새 지점에서 편집");
    this.submit.textContent=this.title.textContent;
    this.description.textContent=actionText(action==='edit'?"이 메시지를 바꾸고 새 응답을 생성하세요. 이전에 실행한 파일 변경 사항과 명령은 그대로 유지됩니다.":action==='fork'?"이번 차례까지 기록을 유지하고 다음 메시지를 기다리세요. 두 채팅 모두 동일한 작업 디렉터리를 공유합니다.":"원래 채팅을 유지하고 새 분기에서 편집 내용을 사용하여 이번 턴을 다시 생성하세요. 두 채팅 모두 작업 디렉터리를 공유합니다.");
    this.submit.disabled=true;this.dialog.showModal();
    try{
      const text=action==='fork'?'':await timeline.fullText(row);
      if(this.target!==target||!this.dialog.open)return;
      this.input.value=sessionStorage.getItem(this.draftKey())??text;
      this.submit.disabled=false;if(action!=='fork')this.input.focus();
    }catch(error){if(this.target===target)this.error.textContent=actionText(error.message);}
  }
  async send(){
    const target=this.target;if(!target||this.pending)return;
    const {action,row,timeline,url}=target;
    if(timeline.abort.signal.aborted){this.error.textContent=actionText("채팅이 바뀌었습니다. 메시지를 다시 선택하세요.");return;}
    const text=action==='fork'?null:this.input.value;
    const key='message-action-attempt:'+url+':'+row.key;
    let attempt;try{attempt=JSON.parse(sessionStorage.getItem(key));}catch{}
    const identity={action,key:timeline.epoch+'.'+row.key,version:row.version,text};
    if(!attempt||Object.keys(identity).some(k=>attempt[k]!==identity[k]))attempt={id:this.uuid(),...identity};
    sessionStorage.setItem(key,JSON.stringify(attempt));
    this.pending=true;this.busy(true);this.error.textContent='';this.submit.textContent=actionText('제출 중…');
    this.dialog.querySelectorAll('button,textarea').forEach(n=>n.disabled=true);
    try{
      const result=await this.request(url,attempt);
      if(timeline.abort.signal.aborted)return;
      if(result.status==='unknown'){
        this.error.textContent=actionText("결과는 확인되지 않았습니다. 먼저 채팅 기록을 확인하세요. 다시 제출하면 작업이 반복되지 않습니다.");
        if(result.id!==result.source.id)this.error.textContent+=' '+actionText("브랜치가 생성되었으며 채팅 목록에서 사용할 수 있습니다.");
        this.refresh();return;
      }
      sessionStorage.removeItem(key);sessionStorage.removeItem(this.draftKey());
      this.dialog.close();this.target=null;
      if(action!=='edit'){
        this.refresh();
        if(result.draft!==null&&result.draft!==undefined){
          // The fork exists but desktop activation failed before the edit. Keep
          // the replacement as an edit draft; never append it as a normal turn.
          const pending={sourceTurnId:result.source.turnId,text:result.draft};
          sessionStorage.setItem('fork-edit:'+result.host+'|'+result.id,JSON.stringify(pending));
          this.notify("분기가 생성되었지만 편집 내용이 전송되지 않았습니다. 계속하려면 마지막 메시지를 연결하고 편집하세요.");
        }else this.notify(action==='fork'?'지점이 생성되었습니다.':"새 지점에서 재전송");
        await this.openChat(result.id,result.host);
      }else this.notify("메시지 재전송");
    }catch(error){if(this.dialog.open)this.error.textContent=actionText(error.message);else this.notify(error.message);}
    finally{
      this.pending=false;this.busy(false);this.dialog.querySelectorAll('button,textarea').forEach(n=>n.disabled=false);
      this.submit.textContent=actionText(action==='fork'?'여기에서 분기':action==='edit'?'수정하고 다시 보내기':"새 지점에서 편집");
    }
  }
}
