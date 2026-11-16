'use strict';
const base=/^\/d\/[a-f0-9]{32}(?=\/)/.exec(location.pathname)?.[0]||'';
const pairToken=new URLSearchParams(location.hash.slice(1)).get('pair');
history.replaceState(null,'',location.pathname);
const form=document.getElementById('pair-form'),statusText=document.getElementById('pair-status');
let claim=null;
async function request(path,value){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),credentials:'same-origin'});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
async function check(){
  if(!claim)return;
  try{const result=await request('/relay/claim-status',{claim});
    if(result.state==='approved'){claim=null;location.replace(base+'/');return;}
    if(result.state!=='pending'){claim=null;statusText.textContent='연결 요청이 거부되었거나 만료되었습니다. 컴퓨터에서 다시 페어링해 주세요.。';return;}
    statusText.textContent='컴퓨터 승인을 기다리는 중입니다. 컴퓨터에 표시된 휴대폰 이름을 확인하세요.。';setTimeout(check,2500);
  }catch(error){claim=null;statusText.textContent=error.message;}
}
form.hidden=!pairToken;
form.onsubmit=async event=>{event.preventDefault();form.querySelector('button').disabled=true;try{const result=await request('/relay/claim',{token:pairToken,name:document.getElementById('phone-name').value});claim=result.claim;await check();}catch(error){statusText.textContent=error.message;}};
fetch(base+'/api/auth',{credentials:'same-origin'}).then(r=>r.json()).then(value=>{document.getElementById('paired-link').hidden=!value.authenticated;}).catch(()=>{});

document.getElementById('paired-link').href=base+'/';
