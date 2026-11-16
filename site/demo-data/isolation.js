'use strict';
// In-memory stores keep the public demo separate from every real gateway session.
for(const key of ['localStorage','sessionStorage']){
 const data=new Map();Object.defineProperty(window,key,{value:{getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear()}});
}
localStorage.setItem('bridge-language',new URLSearchParams(location.search).get('lang')==='en'?'en':'ko');
localStorage.setItem('bridge-appearance',JSON.stringify({theme:'light'}));
window.demoText=(ko,en)=>localStorage.getItem('bridge-language')==='en'?en:ko;
window.demoNotice=()=>alert(demoText('이것은 샘플 데이터 데모입니다. 이 작업은 컴퓨터를 연결하거나 실제 구성을 수정하지 않습니다.。','This sample-data demo does not connect to a computer or change real settings.'));
// Fail closed: unknown API calls must never reach the network.
window.fetch=async()=>new Response(JSON.stringify({error:demoText('이 작업은 데모에서 사용할 수 없습니다。','This operation is not available in the demo.')}),{status:400});
window.EventSource=class{close(){}};
XMLHttpRequest.prototype.open=function(){throw Error(demoText('데모에서는 실제 파일을 업로드하지 않습니다.。','The demo does not upload real files.'));};
document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a||!a.href||a.getAttribute('href')==='codexbridge://home')return;event.preventDefault();demoNotice();},true);
