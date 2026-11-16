// Run only in an isolated gateway browser page; no real chat requests are sent.
function runI18nTests(){
  const checks=[];const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
  const previous=BridgeI18n.language(),originalState=state,originalDraft=$('message').value;
  const originalWorkbench=workbench.current,originalCatalogStarted=catalogStarted;
  const messageContent=()=>[...$('messages').querySelectorAll('.message-body')].map(n=>n.innerHTML).join('');
  const content=messageContent(),originalFetch=window.fetch;let requests=0;
  const fixture={host:'local',connected:true,status:'idle',historyComplete:true,title:'중국어 채팅 콘텐츠',cwd:'/test',requests:[{id:'i18n-question',supported:true,method:'item/tool/requestUserInput',params:{questions:[{id:'choice',question:'원래의 질문은 남아있다',options:[{label:'원래 옵션 유지'}]},{id:'text',question:'원래 자유 입력 질문'}]}}]};
  const change=language=>{$('phone-language').value=language;$('phone-language').dispatchEvent(new Event('change'));};
  let fixtureWorkbench;
  try{
    // Match an opened chat without loading real model/Skill catalogs.
    workbench.open('i18n-fixture','local');fixtureWorkbench=workbench.current;catalogStarted=true;
    window.fetch=()=>{requests++;throw Error('Language change must not send a request');};
    renderState(fixture);
    const select=$('approvals').querySelector('select');select.value='__custom__';select.dispatchEvent(new Event('change'));
    const fields=$('approvals').querySelectorAll('textarea');fields[0].value='맞춤 입력 유지';fields[1].value='자유로운 입력 유지';$('message').value='메시지 초안 보관';
    change('en');
    check($('approvals').querySelector('h3').textContent==='Codex needs your reply','Approval controls switch to English');
    check($('approvals').querySelector('select').value==='__custom__','Custom selection survives');
    check(!$('approvals').querySelector('textarea').hidden,'Custom answer stays visible');
    check([...$('approvals').querySelectorAll('textarea')].map(n=>n.value).join('|')==='맞춤 입력 유지|자유로운 입력 유지','Both answers survive');
    check($('chat-title').textContent==='중국어 채팅 콘텐츠'&&$('approvals').textContent.includes('원래의 질문은 남아있다'),'Chat title and question are not translated');
    check($('message').value==='메시지 초안 보관','Message draft survives');
    check(messageContent()===content,'Markdown and formulas are not rerendered');
    submittedRequestIds.add('i18n-question');change('ko');
    check(BridgeI18n.t('')==='', 'Empty UI text stays empty');
    check($('approvals').querySelector('h3').textContent==='Codex 당신의 답장이 필요해요','Controls switch back to Chinese');
    check($('approvals').querySelector('button').disabled,'Submitted approval stays disabled after language change');
    check(requests===0,'Switching languages sends no requests');
  }finally{
    window.fetch=originalFetch;submittedRequestIds.delete('i18n-question');change(previous);$('message').value=originalDraft;
    state=originalState;catalogStarted=originalCatalogStarted;
    if(fixtureWorkbench)workbench.sessions.delete(fixtureWorkbench.key);
    workbench.current=originalWorkbench;workbench.paint();approvalStamp='';
    if(originalState)renderState(originalState);else $('approvals').replaceChildren();
  }
  return {passed:checks.length,checks};
}
