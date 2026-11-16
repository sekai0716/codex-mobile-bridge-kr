window.issue46Sample = '현재 초안을 먼저 확인하고 중국어와 기존 내용을 유지하세요.。\n\n::code-comment{title="[P2] 기존 초안 유지" body="입력 콘텐츠는 세션 전환 후 복원되어야 하며 자동으로 전송되어서는 안 됩니다.。" file="/fixture/example.js" start=3 end=5 priority=2}\n\n:codex-followup[보충 회귀 테스트]{prompt="초안에 보관된 회귀 테스트를 추가하되 계획을 먼저 보여주세요.。"}\n\n[리뷰 보기](codex://review?pr=https%3A%2F%2Fgithub.com%2Ftry2love%2Fcodex-mobile-bridge%2Fpull%2F64&path=web%2Fshell%2Fapp.js&line=3&side=right)\n\n```text\n:codex-followup[소스 코드는 다음과 같습니다.]{prompt="처형되어서는 안 된다"}\n```';
window.issue46Seed=()=>{
 const codex=isCodexClient(clientNavigation.provider),messages=codex?document.getElementById('messages'):desktopSessions.messages;
 const node=document.createElement('div');node.className='message assistant timeline-row';node.dataset.key='issue46-fixture';
 const body=document.createElement('div');body.className='message-body';
 renderMarkdown(body,issue46Sample,[{id:'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',name:'example.js',reference:'/fixture/example.js'}],()=>'/api/sessions/12345678-1234-4234-9234-123456789012/files/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff?host=local');
 node.append(body);messages.replaceChildren(node);return body;
};
/* Run only against the loopback synthetic navigation fixture, never a live gateway. */
window.checkOutputInteractions=async function(){
 const results=[],assert=(ok,label)=>{if(!ok)throw Error(label);results.push(label);};
 const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,40));}throw Error('Output fixture timed out');};
 const sid='12345678-1234-4234-9234-123456789012',wsl='wsl:'+'a'.repeat(32);
 const cases=[['codex',sid,'local'],['codex','12345678-1234-4234-9234-123456789014','local'],['codex','12345678-1234-4234-9234-123456789015','fixture-ssh'],['codex',sid,wsl],['claude','claude-fixture','local'],['deepseek','deepseek-fixture','local']];
 for(const [provider,id,host] of cases){
  await clientNavigation.choose(provider,{activate:false});
  if(provider==='codex')await openChat(id,host);else await desktopSessions.open(id);
  const input=provider==='codex'?document.getElementById('message'):desktopSessions.input;
  const quotes=provider==='codex'?codexQuotes:desktopSessions.quotes;
  await until(()=>quotes&&quotes.available());quotes.reset();
  const body=issue46Seed();input.value='원본 중국어 초안 '+provider;input.dispatchEvent(new Event('input',{bubbles:true}));
  const draft=input.value;
  assert(body.querySelectorAll('.output-code-comment').length===1,provider+'/'+host+' review card rendered');
  assert(body.querySelector('.output-code-comment').getBoundingClientRect().height>50,provider+'/'+host+' review card visibly laid out');
  assert(body.querySelector('code').textContent.includes(':codex-followup'),provider+'/'+host+' fenced example stays source');
  const follow=[...body.querySelectorAll('button')].find(n=>n.textContent==='보충 회귀 테스트');follow.click();
  assert(input.value.startsWith(draft)&&input.value.endsWith('초안에 보관된 회귀 테스트를 추가하되 계획을 먼저 보여주세요.。'),provider+'/'+host+' followup appends editable draft');
  if(provider==='deepseek'){assert(quotes.action.hidden&&!quotes.quotes.length,'deepseek selection quoting stays hidden');continue;}
  const text=body.querySelector('p').firstChild,range=document.createRange();range.setStart(text,0);range.setEnd(text,10);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
  assert(!quotes.action.hidden,provider+'/'+host+' selection offers quote');
  const before=input.value;quotes.action.dispatchEvent(new Event('pointerdown'));quotes.action.click();
  assert(quotes.quotes.length===1&&quotes.quotes[0].text===text.textContent.slice(0,10),provider+'/'+host+' selection added exactly');
  assert(input.value===before,provider+'/'+host+' quote preserves existing draft');
  assert(quotes.root.querySelector('details'),provider+'/'+host+' quote expands for inspection');
  const saved=JSON.stringify(quotes.quotes);
  selection.removeAllRanges();document.dispatchEvent(new Event('selectionchange'));
  if(provider==='codex'){await openChat(id===sid?'12345678-1234-4234-9234-123456789014':sid,host);await openChat(id,host);}
  else{desktopSessions.backToList();await desktopSessions.open(id);}
  await until(()=>JSON.stringify(quotes.quotes)===saved);
  assert(input.value===before,provider+'/'+host+' draft restores after navigation');
  assert(JSON.stringify(quotes.quotes)===saved,provider+'/'+host+' quote restores after navigation');
  quotes.root.querySelector('button[aria-label]').click();
  assert(!quotes.quotes.length&&input.value===before,provider+'/'+host+' removing quote preserves text');
  assert(document.documentElement.scrollWidth<=innerWidth,provider+'/'+host+' layout has no horizontal overflow');
 }
 return {passed:results.length,results};
};
