'use strict';
// One file-choice flow for browser, Android and iOS; downloads still use the host's manager.
window.BridgeFileActions = (() => {
  const workbenches=new WeakMap(),t=text=>BridgeI18n.t(text);
  const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function dialog(title){const box=node('dialog',undefined,'picker'),head=node('div',undefined,'picker-head'),close=node('button','×','icon-button');close.type='button';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>box.close();head.append(node('h2',title),close);box.append(head);box.addEventListener('close',()=>box.remove());document.body.append(box);return box;}
  function download(box,url,name){const link=node('a',t('이 장치에 다운로드'),'wb-download');link.href=url;link.download=name;link.dataset.directDownload='true';link.onclick=()=>setTimeout(()=>box.close(),0);box.append(link);return link;}
  function attach(anchor,upload,reference){
    const box=node('dialog',undefined,'attachment-menu');box.setAttribute('aria-label',t('첨부파일 추가'));
    document.body.append(box);box.addEventListener('close',()=>box.remove());
    const uploads=!upload?[]:window.BridgeUploadSource?[['사진 라이브러리',()=>upload('photos')],['파일 선택',()=>upload('files')]]:[['이 기기에서 업로드',upload]];
    for(const [label,action] of [...uploads,['호스트 프로젝트 파일 참조',reference]]){
      const button=node('button',t(label),'plain');button.type='button';button.onclick=()=>{box.close();action();};box.append(button);
    }
    box.addEventListener('click',event=>{if(event.target===box)box.close();});
    box.showModal();box.focus();
    const rect=anchor.getBoundingClientRect(),bounds=box.getBoundingClientRect(),viewport=window.visualViewport;
    const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth;
    box.style.left=Math.max(left+8,Math.min(rect.left,left+width-bounds.width-8))+'px';
    box.style.top=Math.max(top+8,rect.top-bounds.height-8)+'px';
  }
  function pickReference(workbench){
    const session=workbench.current,input=workbench.composer;
    if(!session||!input||input.disabled||input.readOnly)return;
    const box=dialog(t('호스트 프로젝트 파일 참조')),toolbar=node('div',undefined,'wb-toolbar'),up=node('button',t('조상'),'plain'),folder=node('button',t('이 폴더를 참조하세요'),'plain'),location=node('p','','wb-path'),form=node('form',undefined,'wb-search'),search=node('input'),submit=node('button',t('찾다'),'plain'),status=node('p','','muted'),list=node('div',undefined,'wb-file-list'),more=node('button',t('더 로드하기'),'plain');
    box.classList.add('host-file-picker');
    up.type=folder.type=more.type='button';search.type='search';search.placeholder=t('이 디렉토리 검색');search.setAttribute('aria-label',t('이 디렉토리 검색'));submit.type='submit';form.append(search,submit);toolbar.append(up,folder);box.append(location,toolbar,form,status,list);list.append(more);
    let path='',ticket=0,busy=false,next=null;
    const current=()=>box.open&&session===workbench.current&&!input.disabled&&!input.readOnly;
    const controls=()=>{up.disabled=busy||!path;folder.disabled=busy||!path;more.disabled=busy;submit.disabled=busy;};
    async function select(entry){
      if(busy||!current())return;busy=true;controls();
      try{const info=await workbench.request(workbench.url(session,'info',entry.path,'project'));
        if(current()&&workbench.referenceFile(session,info)){box.close();workbench.notify(t('초안에 추가되었으나 전송되지 않음'));}
      }catch(error){if(current())status.textContent=t(error.message);}
      finally{busy=false;controls();}
    }
    async function navigate(target,append=false){
      if(busy||!current())return;
      const generation=++ticket;busy=true;path=target;controls();status.textContent=t('디렉터리 로드 중…');if(!append){list.replaceChildren(more);list.scrollTop=0;}
      try{
        const result=await workbench.request(workbench.url(session,'',path,'project')+'&hidden=false&search='+encodeURIComponent(search.value||'')+'&offset='+(append?next:0));
        if(!current()||generation!==ticket)return;
        location.textContent=result.project+(path?' / '+path:'');status.textContent=result.entries.length?'':t('이 디렉터리에 일치하는 파일이 없습니다.');
        for(const entry of result.entries){
          const row=node('button',undefined,'wb-file');row.type='button';row.disabled=entry.kind==='blocked';row.dataset.path=entry.path;
          row.append(workbench.fileIcon(entry),node('span',entry.name,'wb-file-name'),node('span',entry.kind==='directory'?t('접는 사람'):workbench.size(entry.size||0),'wb-file-meta'));
          row.onclick=()=>{if(entry.kind==='directory'){search.value='';navigate(entry.path);}else select(entry);};list.insertBefore(row,more);
        }
        next=result.nextOffset;more.hidden=next===null;
      }catch(error){if(current())status.textContent=t(error.message);}
      finally{busy=false;controls();}
    }
    up.onclick=()=>{search.value='';navigate(path.split('/').slice(0,-1).join('/'));};folder.onclick=()=>select({path});more.onclick=()=>navigate(path,true);form.onsubmit=event=>{event.preventDefault();navigate(path);};
    box.addEventListener('close',()=>ticket++);box.showModal();navigate('');
  }
  function menu(workbench,session,entry){
    if(session!==workbench.current)return;
    const box=dialog(entry.name),url=workbench.url(session,'download',entry.path)+'&explicit=1'+(entry.kind==='directory'?'&archive=1':'');
    download(box,url,entry.name+(entry.kind==='directory'?'.zip':''));
    const copy=node('button',t('절대 경로 복사'),'plain message-copy');copy.type='button';
    copy.onclick=()=>BridgeClipboard.copyWithFeedback(async()=>{
      const info=await workbench.request(workbench.url(session,'info',entry.path));
      if(session!==workbench.current||!box.open)throw Error(t('복사하지 못했습니다. 다시 시도해 주세요.'));
      if(typeof info.absolutePath!=='string')throw Error(t('복사하지 못했습니다. 다시 시도해 주세요.'));
      return info.absolutePath;
    },copy,workbench.notify);box.append(copy);
    if(workbench.composer&&entry.projectPath!==null){
      const quote=node('button',t('메시지 내 참조'),'plain');quote.type='button';quote.disabled=workbench.composer.disabled||workbench.composer.readOnly;
      quote.onclick=async()=>{
        quote.disabled=true;
        try{const info=await workbench.request(workbench.url(session,'info',entry.path));
          if(session!==workbench.current||!box.open)return;
          if(workbench.referenceFile(session,info)){box.close();workbench.notify(t('초안에 추가되었으나 전송되지 않음'));}
        }catch(error){if(box.open&&session===workbench.current)workbench.notify(t(error.message));}
        finally{quote.disabled=workbench.composer.disabled||workbench.composer.readOnly;}
      };box.append(quote);
    }
    if(entry.kind==='directory')box.append(node('p',t('폴더는 ZIP로 준비됩니다. 준비되면 전체 크기가 나타납니다.'),'muted'));
    box.showModal();
  }
  function bindRow(row,workbench,session,entry){
    if(entry.kind==='blocked')return;
    let timer=null,start=null,suppress=false;
    const clear=()=>{clearTimeout(timer);timer=null;};
    row.addEventListener('contextmenu',e=>{e.preventDefault();clear();if(!suppress)menu(workbench,session,entry);});
    row.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.button>0)return;start={x:e.clientX,y:e.clientY};suppress=false;clear();timer=setTimeout(()=>{timer=null;if(!row.isConnected)return;suppress=true;menu(workbench,session,entry);},550);});
    row.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)clear();});
    for(const event of ['pointerup','pointercancel','pointerleave'])row.addEventListener(event,clear);
    row.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
    row.addEventListener('keydown',e=>{if(e.key==='F10'&&e.shiftKey){e.preventDefault();menu(workbench,session,entry);}});
  }
  async function choose(anchor,workbench){
    const session=workbench.current;if(!session)return;
    const box=dialog(anchor.textContent.trim()||t('파일')),status=node('p',t('파일 로드 중…'),'muted');box.append(status);box.showModal();
    try{
      const url=new URL(anchor.href,location.href);url.searchParams.set('info','1');
      const info=await workbench.request(url.pathname+url.search);
      if(!box.open||session!==workbench.current)return box.close();
      status.textContent=info.name+(info.kind==='directory'?'':' · '+workbench.size(info.size));
      const locate=node('button',t('파일에서 찾기'),'plain');locate.type='button';locate.disabled=!info.locatable||!info.path;
      locate.onclick=()=>{box.close();workbench.locate(session,info.path).catch(error=>workbench.notify(t(error.message)));};box.append(locate);
      const start=Number(anchor.dataset.sourceLine),end=Number(anchor.dataset.sourceEnd||anchor.dataset.sourceLine);
      if(info.kind!=='directory'&&info.locatable&&info.path&&Number.isInteger(start)&&start>=1&&start<=1000000&&Number.isInteger(end)&&end>=start&&end<=1000000){
        const source=node('button',t('코드 위치 보기'),'plain');source.type='button';source.onclick=()=>{box.close();workbench.openSourceLocation(session,info.path,start,end).catch(error=>workbench.notify(t(error.message)));};box.append(source);
      }
      if(info.kind!=='directory'){
        if(info.locatable&&info.path){const preview=node('button',t('미리보기 파일'),'plain');preview.type='button';preview.onclick=()=>{box.close();workbench.preview(session,info).catch(error=>workbench.notify(t(error.message)));};box.append(preview);}
        if(info.size<=info.clickDownloadMiB*1024*1024)download(box,anchor.href,info.name);
        else box.append(node('p',t('이 파일은 클릭하여 다운로드할 수 있는 한도를 초과합니다. 파일에서 찾은 다음 길게 눌러 다운로드하세요.'),'muted'));
      }
      if(locate.disabled)box.append(node('p',t('이 파일은 작업 공간 채팅 외부에 있으며 이 파일 탭에서 찾을 수 없습니다.'),'muted'));
    }catch(error){status.textContent=t(error.message);status.className='error';}
  }
  document.addEventListener('click',event=>{
    const unavailable=event.target.closest?.('[data-unavailable-file]');
    if(unavailable){const workbench=workbenches.get(unavailable.closest('.chat'));if(workbench){event.preventDefault();workbench.notify(t('파일이 현재 프로젝트 외부에 있거나 더 이상 사용할 수 없습니다.'));}return;}
    const anchor=event.target.closest?.('a[href]');
    if(!anchor||event.defaultPrevented||event.button!==0||anchor.dataset.directDownload||anchor.hasAttribute('data-image-preview')||typeof BridgeDownload==='undefined'||!BridgeDownload.eligible(anchor.href,location.href))return;
    const chat=anchor.closest('.chat'),workbench=chat&&workbenches.get(chat);if(!workbench)return;
    event.preventDefault();event.stopImmediatePropagation();choose(anchor,workbench);
  },true);
  function mountSettings(container,request,{ready=()=>document.getElementById('app')?.hidden===false}={}){
    if(!container)return;
    const field=node('fieldset',undefined,'appearance-section'),legend=node('legend',t('파일 전송')),label=node('label'),input=node('input'),save=node('button',t('클릭 다운로드 제한 저장'),'plain'),message=node('p','','muted');
    legend.dataset.i18n='파일 전송';input.type='number';input.min='1';input.max='1048576';input.step='1';input.required=true;save.type='button';save.dataset.i18n='클릭 다운로드 제한 저장';
    const caption=node('span',t('클릭하여 다운로드 한도(MiB)'));caption.dataset.i18n='클릭하여 다운로드 한도(MiB)';label.append(caption,input);
    const hint=node('p',t('더 큰 파일은 찾기만 제공합니다. 파일 탭에서 길게 누르거나 마우스 오른쪽 버튼을 클릭하여 다운로드하는 경우는 제외됩니다.'),'muted');hint.dataset.i18n='더 큰 파일은 찾기만 제공합니다. 파일 탭에서 길게 누르거나 마우스 오른쪽 버튼을 클릭하여 다운로드하는 경우는 제외됩니다.';field.append(legend,label,hint,save,message);container.append(field);
    let dirty=false,loading=false;input.oninput=e=>{e.stopPropagation();dirty=true;};input.onchange=e=>e.stopPropagation();
    const read=async()=>{if(dirty||loading||document.hidden||container.hidden||('open' in container&&!container.open)||!ready())return;loading=true;try{const value=await request();if(!dirty){input.value=value.clickDownloadMiB;message.textContent='';}}catch(e){message.textContent=t(e.message);}finally{loading=false;}};
    save.onclick=async()=>{if(!input.reportValidity())return;save.disabled=true;const value=Number(input.value);try{await request({clickDownloadMiB:value});if(Number(input.value)===value)dirty=false;message.textContent=t('저장되었습니다. 즉시 적용됩니다.');}catch(e){message.textContent=t(e.message);}finally{save.disabled=false;}};
    // Fetch on reveal/focus, not on a timer. Every download reads the latest server policy.
    new MutationObserver(()=>{if(!container.hidden&&(!('open' in container)||container.open))read();}).observe(container,{attributes:true,attributeFilter:['hidden','open']});
    window.addEventListener('focus',read);document.addEventListener('bridge-authenticated',read);return field;
  }
  return {register:(chat,workbench)=>workbenches.set(chat,workbench),bindRow,menu,mountSettings,attach,pickReference};
})();
