'use strict';
const actionText=source=>typeof BridgeI18n==='undefined'?source:BridgeI18n.t(source);
// Native identities only: Bridge endpoint digests are not Desktop host IDs.
window.BridgeSessionLinks={
  text({provider,id,host='local',runtime}={}){
    if(typeof id!=='string'||!id.trim())return null;
    if(provider==='deepseek')return id;
    if(provider!=='codex'||runtime==='wsl'||typeof host!=='string'||!host||host.startsWith('wsl:'))return null;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
    return 'codex://threads/'+id+(host==='local'?'':'?hostId='+encodeURIComponent(host));
  }
};
window.BridgeClipboard=(()=>{
  function modernCopy(value){
    try{
      let pending;
      if(typeof value==='string'&&navigator.clipboard?.writeText)pending=navigator.clipboard.writeText(value);
      else if(value?.then&&navigator.clipboard?.write&&typeof ClipboardItem==='function'){
        // Reserve the write during the click, before full-message retrieval awaits
        // the network. WebKit requires this user gesture even for already-read text.
        const data=Promise.resolve(value).then(text=>{
          if(typeof text!=='string')throw Error(actionText('복사하지 못했습니다. 다시 시도해 주세요.'));
          return new Blob([text],{type:'text/plain'});
        });
        data.catch(()=>{}); // The constructor/write may reject before consuming data.
        pending=navigator.clipboard.write([new ClipboardItem({'text/plain':data})]);
      }else return null;
      return Promise.resolve(pending).then(()=>true,()=>false);
    }catch{return null;}
  }
  function selectionCopy(text,button){
    if(!document.execCommand)return false;
    const active=document.activeElement,selection=document.getSelection?.(),ranges=[];
    for(let i=0;i<(selection?.rangeCount||0);i++)ranges.push(selection.getRangeAt(i).cloneRange());
    const start=active?.selectionStart,end=active?.selectionEnd,direction=active?.selectionDirection;
    const input=document.createElement('textarea');input.value=text;input.readOnly=true;input.tabIndex=-1;
    input.className='clipboard-selection';
    // A textarea outside an open modal is inert, so keep it in the same layer.
    (button.closest('dialog[open]')||document.body).append(input);
    try{input.focus({preventScroll:true});input.select();input.setSelectionRange(0,text.length);return document.execCommand('copy')===true;}
    catch{return false;}
    finally{
      input.remove();
      if(active?.isConnected)active.focus({preventScroll:true});
      if(typeof start==='number')active.setSelectionRange(start,end,direction);
      if(selection){selection.removeAllRanges();for(const range of ranges)selection.addRange(range);}
    }
  }
  return {
    async copyWithFeedback(getText,button,notify){
      if(button.disabled)return;
      let reported=false,requested=false,failed=false;
      const acknowledged=()=>{if(!reported){reported=true;notify?.(actionText('복사됨'));}};
      const failure=()=>{failed=true;};document.addEventListener('bridge-message-error',failure);
      try{
        const copied=await window.BridgeClipboard.copy(()=>{requested=true;return getText();},button,acknowledged);
        // Published shells ignore extra arguments and set this label only after
        // native acknowledgement. A prior success label alone is not an ack.
        if(copied===true||requested&&!failed&&button.textContent===actionText('복사됨'))acknowledged();
      }finally{document.removeEventListener('bridge-message-error',failure);}
    },
    async copy(getText,button,onCopied){
      if(button.disabled)return;
      const label=button.textContent;button.disabled=true;button.textContent=actionText('로드 중…');
      try{
        const value=getText();
        let pending=modernCopy(value),selectionTried=false;
        if(pending===null&&typeof value==='string'){pending=selectionCopy(value,button);selectionTried=true;}
        const text=await value;
        if(typeof text!=='string')throw Error(actionText('복사하지 못했습니다. 다시 시도해 주세요.'));
        if(pending===null)pending=modernCopy(text);
        const copied=(await pending)||(!selectionTried&&selectionCopy(text,button));
        const done=()=>{
          button.textContent=actionText('복사됨');onCopied?.();
          setTimeout(()=>{button.textContent=label;},1500);
        };
        if(copied){done();return true;}
        else{
          const dialog=document.createElement('dialog');dialog.className='picker copy-dialog';
          const heading=document.createElement('h2');heading.textContent=actionText('텍스트 복사');
          const help=document.createElement('p');help.className='muted';help.textContent=actionText('귀하의 브라우저가 자동 복사를 차단했습니다. 텍스트를 선택하고 시스템 복사 작업이나 키보드 단축키를 사용합니다.');
          const input=document.createElement('textarea');input.readOnly=true;input.value=text;input.setAttribute('aria-label',actionText('텍스트 복사'));
          const actions=document.createElement('div');actions.className='copy-dialog-actions';
          const retry=document.createElement('button');retry.type='button';retry.className='primary';retry.textContent=actionText('복사');
          retry.onclick=async()=>{
            retry.disabled=true;
            try{
              const pending=modernCopy(text);
              const copied=pending===null?selectionCopy(text,retry):(await pending)||selectionCopy(text,retry);
              if(copied){dialog.close();done();}else{input.focus();input.select();}
            }
            finally{retry.disabled=false;}
          };
          const close=document.createElement('button');close.type='button';close.textContent=actionText('완료');close.onclick=()=>dialog.close();
          actions.append(retry,close);dialog.append(heading,help,input,actions);document.body.append(dialog);
          dialog.onclose=()=>{dialog.remove();button.focus({preventScroll:true});};dialog.showModal();input.focus();input.select();input.setSelectionRange(0,text.length);
          button.textContent=label;
        }
      }catch(error){button.textContent=label;document.dispatchEvent(new CustomEvent('bridge-message-error',{detail:error.message}));}
      finally{button.disabled=false;}
    }
  };
})();

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
  async open(action,row,timeline,handlers={}){
    if(this.pending)return;
    const target=this.target={action,row:{...row},timeline,handlers,url:timeline.url('message-action')};
    this.error.textContent='';this.input.value='';this.input.hidden=action==='fork';this.input.required=action!=='fork';
    this.title.textContent=actionText(action==='fork'?'여기에서 분기':action==='edit'?'수정하고 다시 보내기':'새 지점에서 편집');
    this.submit.textContent=this.title.textContent;
    this.description.textContent=actionText(action==='edit'?'이 메시지를 바꾸고 새 응답을 생성하세요. 이전에 실행한 파일 변경 사항과 명령은 그대로 유지됩니다.':action==='fork'?'이번 차례까지 기록을 유지하고 다음 메시지를 기다리세요. 두 채팅 모두 동일한 작업 디렉터리를 공유합니다.':'원래 채팅을 유지하고 새 분기에서 편집 내용을 사용하여 이번 턴을 다시 생성하세요. 두 채팅 모두 작업 디렉터리를 공유합니다.');
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
    const {action,row,timeline,url,handlers={}}=target;
    const request=handlers.request||this.request,refresh=handlers.refresh||this.refresh,openChat=handlers.openChat||this.openChat;
    if(timeline.abort.signal.aborted){this.error.textContent=actionText('채팅이 바뀌었습니다. 메시지를 다시 선택하세요.');return;}
    const text=action==='fork'?null:this.input.value;
    const key='message-action-attempt:'+url+':'+row.key;
    let attempt;try{attempt=JSON.parse(sessionStorage.getItem(key));}catch{}
    const identity={action,key:timeline.epoch+'.'+row.key,version:row.version,text};
    if(!attempt||Object.keys(identity).some(k=>attempt[k]!==identity[k]))attempt={id:this.uuid(),...identity};
    sessionStorage.setItem(key,JSON.stringify(attempt));
    this.pending=true;this.busy(true);this.error.textContent='';this.submit.textContent=actionText('제출 중…');
    this.dialog.querySelectorAll('button,textarea').forEach(n=>n.disabled=true);
    try{
      const result=await request(url,attempt);
      if(timeline.abort.signal.aborted)return;
      if(result.status==='unknown'){
        this.error.textContent=actionText('결과는 확인되지 않았습니다. 먼저 채팅 기록을 확인하세요. 다시 제출하면 작업이 반복되지 않습니다.');
        if(result.id!==result.source.id)this.error.textContent+=' '+actionText('브랜치가 생성되었으며 채팅 목록에서 사용할 수 있습니다.');
        refresh();return;
      }
      sessionStorage.removeItem(key);sessionStorage.removeItem(this.draftKey());
      this.dialog.close();this.target=null;
      if(action!=='edit'){
        refresh();
        if(result.draft!==null&&result.draft!==undefined){
          // The fork exists but desktop activation failed before the edit. Keep
          // the replacement as an edit draft; never append it as a normal turn.
          const pending={sourceTurnId:result.source.turnId,text:result.draft};
          sessionStorage.setItem('fork-edit:'+result.host+'|'+result.id,JSON.stringify(pending));
          this.notify('분기가 생성되었지만 편집 내용이 전송되지 않았습니다. 계속하려면 마지막 메시지를 연결하고 편집하세요.');
        }else this.notify(action==='fork'?'지점이 생성되었습니다.':'새 지점에서 재전송');
        await openChat(result.id,result.host);
      }else this.notify('메시지 재전송');
    }catch(error){if(this.dialog.open)this.error.textContent=actionText(error.message);else this.notify(error.message);}
    finally{
      this.pending=false;this.busy(false);this.dialog.querySelectorAll('button,textarea').forEach(n=>n.disabled=false);
      this.submit.textContent=actionText(action==='fork'?'여기에서 분기':action==='edit'?'수정하고 다시 보내기':'새 지점에서 편집');
    }
  }
}
