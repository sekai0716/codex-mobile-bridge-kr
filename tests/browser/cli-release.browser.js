// Production shared release panel with protocol-shaped synthetic receipts only.
async function runCliReleaseChecks({keepOpen=false}={}){
 const checks=[],calls=[],t=BridgeI18n.t,check=(ok,label)=>{window.__cliReleaseCheck=label;if(!ok)throw Error(label);checks.push(label);},frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const until=async fn=>{const end=performance.now()+3000;while(!fn()){if(performance.now()>end)throw Error('CLI release fixture timeout');await frame();}};
 let client='codex',identity='fixture-auth',finishForce;
 const codex=(key,host,scope)=>({key,provider:'codex',host,sessionId:'native-'+key,title:'Conversation '+key,location:host,scopeKey:host+'|'+scope,scopeLabel:host+' · /fixture/'+scope,sharedHome:true,canForce:true});
 const claude=(key,profile)=>({key,provider:'claude',host:'local',sessionId:'native-'+key,title:'Claude '+key,location:'Local Claude',canForce:true,...(profile?{configurationKey:profile,configurationLabel:'Claude · /fixture/'+profile}:{})});
 const rows=[codex('a','local','home-a'),codex('b','local','home-a'),codex('other','local','home-b'),codex('ssh','ssh:server','home-a'),codex('wsl','wsl:ubuntu','home-a'),claude('c1','profile-a'),claude('c2','profile-a'),claude('c3','profile-b'),claude('u1'),claude('u2')];
 const old=codex('old','local','old-home'),operations=Array.from({length:40},(_,i)=>({id:'old-'+i,mode:'wait',results:[{...old,status:'released'}]}));operations.push({id:'unconfirmed',mode:'wait',results:[{...codex('unknown','local','unknown-home'),status:'unknown'}]});
 const data={connections:rows,operations};
 const panel=new CliConnectionsPanel({translate:t,identity:()=>identity,currentClient:()=>client,notify(){},request:async(url,body)=>{
  check(url==='/api/cli-connections','shared endpoint');if(!body)return data;calls.push(body);
  if(body.mode==='scopePreview'){
   const selected=body.all?rows.filter(row=>row.scopeKey===body.scopeKey):rows.filter(row=>body.connections.includes(row.key));
   return {scopeKey:body.scopeKey,scopeLabel:'Local · /fixture/home-a',generation:'scope-generation',connections:selected.map(row=>row.key),impact:rows.filter(row=>row.scopeKey===body.scopeKey&&row.host===selected[0].host).map(row=>({sessionId:row.sessionId,connectionKey:row.key})),canRelease:true,canForce:true};
  }
  if(body.mode==='forcePreview')return {scopeLabel:'Claude · /fixture/profile-a',generation:'claude-process',impact:[{sessionId:'native-c1'}],canForce:true};
  if(body.mode==='scopeCancel'){const job=operations.find(job=>job.id===body.id);job.results.forEach(row=>Object.assign(row,{status:'cancelled',canCancel:false}));return job;}
  if(body.mode==='scopeForce')return new Promise(resolve=>finishForce=resolve);
  const job={...body,results:rows.filter(row=>body.connections.includes(row.key)).map(row=>({...row,status:body.mode==='scopeWait'?'waiting':body.mode==='check'?'unknown':'released',canCancel:body.mode==='scopeWait'}))};operations.push(job);return job;
 }});
 const group=(kind,label)=>panel.groups.find(value=>value.kind===kind&&(value.label.includes(label)||value.scopeKey===label));
 const section=value=>[...panel.dialog.querySelectorAll('.cli-release-group')].find(node=>node.dataset.cliGroup===value.key);
 const find=(label,root=panel.dialog)=>[...root.querySelectorAll('button')].find(button=>button.textContent===t(label));
 const click=async(label,root)=>{const button=find(label,root);check(!!button&&!button.disabled,'available '+label);button.click();await frame();};
 const fits=label=>{const rect=panel.dialog.getBoundingClientRect();check(rect.left>=-1&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1,label+' fits viewport');for(const button of panel.dialog.querySelectorAll('.sm-confirm-actions button'))check(button.scrollWidth<=button.clientWidth+1,label+' button text fits');};
 try{
  panel.open();await until(()=>panel.rows?.length);
  check(panel.rows.every(row=>row.provider==='codex'),'current Agent excludes Claude');check(panel.groups.filter(value=>value.runtime==='local').length===3&&panel.groups.some(value=>value.runtime==='ssh')&&panel.groups.some(value=>value.runtime==='wsl'),'local SSH WSL and actual homes stay separate');
  const history=panel.dialog.querySelector('.cli-release-history');check(!history.open&&history.querySelectorAll('p').length===0,'history is collapsed and rendered lazily');history.open=true;await frame();check(history.querySelectorAll('p').length===41&&history.textContent.includes('old-0'),'all old receipts remain available');history.open=false;
  const unknown=[...panel.dialog.querySelectorAll('.cli-release-row')].find(node=>node.dataset.cliConnection==='unknown');check(unknown.querySelectorAll('button').length===1&&unknown.querySelector('button').textContent===t('결과 확인'),'unknown receipt offers check only');
  let home=group('shared','home-a'),input=section(home).querySelector('[data-cli-connection="a"] input');input.click();await frame();await click('선택한 연결 해제…',section(group('shared','home-a')));await until(()=>panel.confirmation);
  check(calls.at(-1).mode==='scopePreview'&&calls.at(-1).connections.join()==='a','single selection previews its exact key');check(panel.dialog.textContent.includes('native-b'),'single selection shows the additional home writer impact');fits('scope confirmation');await click('사이');check(!calls.some(body=>body.mode==='scopeWait'),'Back from preview never releases');
  await click('이 구성의 모든 연결을 해제합니다…',section(group('shared','home-a')));await until(()=>panel.confirmation);check(calls.at(-1).all===true&&calls.at(-1).scopeKey==='local|home-a','all applies to one actual home');await click('풀어 주다');await until(()=>panel.rows.find(row=>row.key==='a')?.status==='waiting');
  const released=calls.find(body=>body.mode==='scopeWait');check(released.connections.join()==='a,b'&&released.generation==='scope-generation','confirmation keeps preview keys and generation');check(!released.connections.includes('ssh')&&!released.connections.includes('other'),'all excludes SSH and other local homes');await click('이 범위의 대기 취소',section(group('shared','home-a')));await until(()=>panel.rows.find(row=>row.key==='a')?.status==='cancelled');check(calls.at(-1).mode==='scopeCancel'&&calls.at(-1).id===released.id,'cancellation binds its backend job');
  await click('이 범위를 강제 해제합니다…',section(group('shared','home-a')));await until(()=>panel.confirmation);check(panel.dialog.textContent.includes(t('이로 인해 실행 중이거나 확인되지 않은 작업이 중단됩니다. 범위에는 나열되지 않은 세션이 포함될 수 있습니다. 채팅 기록은 보존됩니다.')),'force explicitly states full task impact');await click('강제해제');await until(()=>finishForce);check(!find('닫기').disabled&&!find('사이').disabled,'pending native release keeps Close and Back usable');await click('사이');panel.close();finishForce({id:'old-force',results:[{...rows[0],status:'unknown'}]});await frame();check(!panel.dialog,'late force result cannot reopen a dismissed dialog');
  client='claude';panel.open();await until(()=>panel.provider==='claude'&&panel.rows?.some(row=>row.provider==='claude'));check(panel.rows.every(row=>row.provider==='claude'),'current Claude excludes Codex');check(panel.groups.filter(value=>value.kind==='configuration').length===2&&panel.groups.filter(value=>value.kind==='connection').length===2,'trusted profile metadata groups but missing metadata stays independent');
  await click('이 구성의 모든 연결을 해제합니다…',section(group('configuration','profile-a')));check(panel.confirmation.mode==='wait'&&panel.dialog.textContent.includes(t('현재 대기 취소는 지원되지 않습니다. 패널을 닫아도 제출된 릴리스는 취소되지 않습니다.')),'Claude uses ordinary per-process release and discloses no scope cancellation');await click('풀어 주다');await until(()=>calls.some(body=>body.mode==='wait'));check(calls.find(body=>body.mode==='wait').connections.join()==='c1,c2','Claude batch includes only exact same-profile keys');
  const count=calls.length;identity='changed-auth';await panel.submitLegacy('check',['c1']);check(calls.length===count,'changed authenticated gateway cannot dispatch');
  if(keepOpen){identity='fixture-auth';client='codex';panel.open();await until(()=>panel.rows?.some(row=>row.provider==='codex'));window.__cliReleasePreview={panel,cleanup:()=>panel.close()};}
  return {passed:checks.length,width:innerWidth,language:BridgeI18n.language(),requests:calls.length,modelRequests:0};
 }finally{if(!keepOpen)panel.close();}
}
