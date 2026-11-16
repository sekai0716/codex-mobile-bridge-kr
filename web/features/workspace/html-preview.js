'use strict';
const BridgeHtmlPreview=(()=>{
  const maxBytes=512*1024;
  function create({text,onEscape}){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>maxBytes)throw Error('HTML 미리보기 콘텐츠가 텍스트 크기 제한을 초과합니다.');
    const element=document.createElement('div');element.className='html-preview-frame';
    const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
    frame.setAttribute('title',typeof BridgeI18n==='undefined'?'HTML 미리보기':BridgeI18n.t('HTML 미리보기'));frame.setAttribute('data-i18n-title','HTML 미리보기');
    frame.src=(window.BridgeRelayBase||'')+'/html-preview-shell';element.append(frame);
    let disposed=false,ready=null;
    const cleanup=()=>{window.removeEventListener('message',receive);clearTimeout(timer);};
    const fail=()=>{cleanup();if(disposed)return;frame.remove();const notice=document.createElement('p');notice.textContent=typeof BridgeI18n==='undefined'?'HTML 미리보기를 로드할 수 없습니다. 소스를 보거나 파일을 다운로드하세요.':BridgeI18n.t('HTML 미리보기를 로드할 수 없습니다. 소스를 보거나 파일을 다운로드하세요.');notice.setAttribute('data-i18n','HTML 미리보기를 로드할 수 없습니다. 소스를 보거나 파일을 다운로드하세요.');element.append(notice);};
    const receive=event=>{
      if(disposed||event.source!==frame.contentWindow||event.origin!=='null')return;
      if(ready&&event.data?.type==='bridge-html-preview-escape'&&event.data.instance===ready){onEscape?.();return;}
      if(event.data?.type!=='bridge-html-preview-ready'||typeof event.data.instance!=='string'||!/^[a-f0-9]{32}$/.test(event.data.instance)||event.data.instance===ready)return;
      // A detached workbench tab reloads its iframe when shown again. Send the
      // same bounded source once per shell document, never once per tab lifetime.
      ready=event.data.instance;clearTimeout(timer);
      try{frame.contentWindow.postMessage({type:'bridge-html-preview-content',instance:ready,text},'*');}catch{fail();}
    };
    window.addEventListener('message',receive);
    const timer=setTimeout(fail,10000);
    return {element,dispose(){if(disposed)return;disposed=true;cleanup();frame.remove();}};
  }
  return {create};
})();
if(typeof module!=='undefined')module.exports=BridgeHtmlPreview;
