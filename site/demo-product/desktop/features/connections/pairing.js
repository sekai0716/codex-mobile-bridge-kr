'use strict';
const qrEntries=new Map();
let qrPolling=false;
function pairingLabel(tag,text,cls=''){
  const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;
}
function appendPairing(card,url,running){
  let entry=qrEntries.get(url);
  if(!entry){
    const node=document.createElement('details');node.className='qr-entry';
    const summary=pairingLabel('summary',''),body=document.createElement('div'),image=document.createElement('img');
    image.width=image.height=320;image.hidden=true;
    const status=pairingLabel('p','','qr-status'),error=pairingLabel('p','','error'),hint=pairingLabel('p','','hint'),privacy=pairingLabel('p','','hint'),refresh=pairingLabel('button','','primary');
    status.setAttribute('role','status');error.setAttribute('role','alert');refresh.type='button';
    body.className='qr-body';body.append(image,status,error,hint,privacy,refresh);node.append(summary,body);
    entry={url,node,summary,image,status,error,hint,privacy,refresh,grant:null,generation:0,busy:false,running};qrEntries.set(url,entry);
    summary.onclick=event=>{if(!entry.running)event.preventDefault();};
    node.ontoggle=()=>{if(node.open&&entry.running)refreshPairing(entry);else clearPairing(entry);};
    refresh.onclick=()=>refreshPairing(entry);
  }
  entry.running=running;
  if(!running&&entry.node.open)entry.node.open=false;
  entry.summary.setAttribute('aria-disabled',String(!running));card.append(entry.node);renderPairingEntry(entry);
}
function renderPairingEntry(entry){
  const {grant}=entry;
  const remaining=grant?Math.max(0,Math.ceil(grant.expires-Date.now()/1000)):0;
  const state=grant?.state==='active'&&!remaining?'expired':grant?.state;
  const active=entry.node.open&&state==='active';
  entry.summary.textContent=t("스캔하여 로그인")+(entry.running?'':t("· 게이트웨이가 중지되었습니다."));
  entry.image.alt=t("스캔하여 로그인");entry.image.hidden=!active;
  if(active&&entry.image.src!==grant.image)entry.image.src=grant.image;
  if(!active)entry.image.removeAttribute('src');
  entry.status.textContent=entry.busy?t("연결을 확인하고 QR 코드를 생성하는 중…"):state==='used'?t("휴대폰이 로그인되었습니다. 이 QR 코드는 더 이상 유효하지 않습니다."):state==='expired'?t("QR 코드가 만료되었습니다. 새로고침하세요."):active?t("만료 날짜:")+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0'):'';
  entry.error.textContent=t(entry.errorMessage||'');entry.error.hidden=!entry.errorMessage;
  entry.hint.textContent=t("스캔을 사용하여 모바일 앱에 연결하여 게이트웨이 비밀번호 없이 로그인하거나 휴대폰 카메라로 스캔하여 브라우저에서 엽니다. 휴대전화가 이 주소에 접속할 수 있어야 합니다.");
  entry.privacy.textContent=t("5분간 유효하며 1회 사용 가능합니다. 이 코드가 있으면 누구나 로그인할 수 있습니다. 비공개로 유지하세요. 축소하거나 새로 고치면 취소됩니다. 모바일 앱은 로그인된 장치에서 로그아웃하거나 취소할 때까지 로그인 상태를 유지합니다. 브라우저는 구성된 세션 기간을 따릅니다.");
  entry.refresh.textContent=t('QR 코드 새로 고침');entry.refresh.disabled=entry.busy||!entry.running;
}
function renderPairing(){for(const entry of qrEntries.values())renderPairingEntry(entry);}
function refreshPairing(entry){
  const generation=++entry.generation;
  const preceding=entry.grant;entry.busy=true;entry.grant=null;entry.errorMessage='';renderPairingEntry(entry);
  // Rapid collapse/reopen must not let an older probe revoke a newer code.
  const previous=entry.task||Promise.resolve();
  entry.task=(async()=>{
    await previous;
    if(generation!==entry.generation)return;
    try{
      if(preceding)await api.pairing({action:'revoke',id:preceding.id});
      const grant=await api.pairing({action:'create',url:entry.url});
      if(generation!==entry.generation){await api.pairing({action:'revoke',id:grant.id});return;}
      entry.grant=grant;
    }catch(error){if(generation===entry.generation)entry.errorMessage=error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{if(generation===entry.generation){entry.busy=false;renderPairingEntry(entry);}}
  })();
  return entry.task;
}
function clearPairing(entry){
  const grant=entry.grant;entry.generation++;entry.grant=null;entry.busy=false;
  entry.image.removeAttribute('src');entry.image.hidden=true;
  if(grant)api.pairing({action:'revoke',id:grant.id}).catch(()=>{});
}
function resetPairing(){for(const entry of qrEntries.values()){clearPairing(entry);entry.node.open=false;}qrEntries.clear();}
setInterval(renderPairing,1000);
setInterval(()=>{
  const entries=[...qrEntries.values()].filter(e=>e.node.open&&e.grant?.state==='active'&&e.grant.expires>Date.now()/1000);
  if(qrPolling||!entries.length)return;
  const grants=entries.map(e=>e.grant);qrPolling=true;
  api.pairing({action:'status',ids:grants.map(g=>g.id)}).then(value=>{
    entries.forEach((entry,i)=>{if(entry.grant===grants[i])entry.grant.state=value.states[grants[i].id]||'expired';});
  }).catch(()=>entries.forEach((entry,i)=>{if(entry.grant===grants[i])entry.grant.state='expired';})).finally(()=>{qrPolling=false;renderPairing();});
},3000);
