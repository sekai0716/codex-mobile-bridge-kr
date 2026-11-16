// Production shared menu, synthetic native receipts only. No client/model API.
async function runCliNetworkPanelChecks({keepOpen=false}={}){
 const checks=[],calls=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);},t=BridgeI18n.t;
 const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const until=async predicate=>{const end=performance.now()+3000;while(!predicate()){if(performance.now()>end)throw Error('CLI network fixture timeout');await frame();}};
 const anchor=document.createElement('button');anchor.textContent='Synthetic CLI';document.body.append(anchor);
 const menu=new SessionMenu({translate:t,newId:()=>crypto.randomUUID()});let phase='waiting',finishForce,finishRead;
 const context={title:'Synthetic CLI',subtitle:'Local fixture',pin(){},isCurrent:()=>true,cliNetwork:async body=>{
  calls.push(body);
  if(phase==='slow')return new Promise(resolve=>finishRead=resolve);
  if(body?.action==='forcePreview')return {canForce:true,generation:'force-generation',operationId:null,scopeLabel:'Local · /fixture/.codex',impact:[{sessionId:'native-original'},{sessionId:'native-other'}],message:'Verified shared service'};
  if(body?.action==='force')return new Promise(resolve=>finishForce=resolve);
  if(body?.action==='cancel')return {state:'cancelled',operationId:'wait-operation',message:'Cancellation confirmed by backend',canCancel:false};
  if(body?.action==='reconnect')return {status:'unknown',operationId:body.requestId,notice:'Previous resume receipt remains unknown'};
  if(phase==='reconnect')return {canRecover:true,action:'reconnect',generation:'saved-generation',message:'Reconnect current saved state'};
  if(body?.confirmed||body?.action==='status')return {state:'waiting',operationId:'wait-operation',message:'Waiting for native task',canCancel:true};
  return phase==='force'?{canRecover:false,message:'Native task state unknown'}:{canRecover:true,willWait:true,generation:'wait-generation',message:'Native configuration changed'};
 }};
 const find=label=>[...menu.box.querySelectorAll('button')].find(button=>button.textContent===t(label)||button.getAttribute('aria-label')===t(label));
 const click=async label=>{const button=find(label);check(!!button&&!button.disabled,'available action '+label);button.click();await frame();};
 const fits=label=>{const rect=menu.box.getBoundingClientRect();check(rect.left>=-1&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1,label+' fits viewport');for(const button of menu.box.querySelectorAll('.sm-confirm-actions button'))check(button.scrollWidth<=button.clientWidth+1,label+' confirmation text fits its button');};
 try{
  menu.show(context,{element:anchor});await Promise.all(menu.box.getAnimations().map(animation=>animation.finished.catch(()=>{})));await click('조사하다 CLI 회로망');await until(()=>menu.cliNetwork.data);check(menu.view==='cli-network'&&menu.box.textContent.includes('Native configuration changed'),'inspection result stays in visible panel');
  await click('작업이 끝날 때까지 기다렸다가 다시 시작하세요.…');check(calls.length===1,'opening recovery confirmation makes no write');await click('복구 확인');await until(()=>menu.cliNetwork.data?.state==='waiting');check(calls[1].confirmed===true&&calls[1].generation==='wait-generation','default recovery binds preview generation');check(!!find('대기 취소')&&!!find('작업 결과 확인'),'waiting offers status and cancellation');fits('waiting');
  await click('대기 취소');await until(()=>menu.cliNetwork.data?.state==='cancelled');check(calls.at(-1).action==='cancel'&&calls.at(-1).operationId==='wait-operation','cancel uses the exact backend operation');check(menu.box.textContent.includes('Cancellation confirmed by backend'),'cancellation is shown after backend confirmation');
  phase='force';await click('네트워크 재확인');await until(()=>menu.cliNetwork.data?.message==='Native task state unknown');await click('강제 복구 범위 확인…');await until(()=>menu.cliNetwork.confirmation);
  check(menu.box.textContent.includes('/fixture/.codex')&&menu.box.textContent.includes('native-original')&&menu.box.textContent.includes('native-other'),'force confirmation shows exact home and known session scope');check(menu.box.textContent.includes(t('이 구성에서 실행 중이거나 상태를 알 수 없는 작업은 중단되며, 목록에 없는 세션도 포함될 수 있습니다. 채팅 기록은 유지됩니다。')),'force confirmation states unlisted task impact');fits('force confirmation');check(calls.every(body=>body?.action!=='force'),'preview never dispatches force');
  await click('강제 회복 확인');check(calls.at(-1).action==='force'&&calls.at(-1).generation==='force-generation'&&calls.at(-1).operationId===null&&!!calls.at(-1).requestId,'force uses only the fresh preview and new request ID');check(!find('닫기').disabled&&!find('세션 메뉴로 돌아가기').disabled,'pending force keeps Close and Back enabled');await click('세션 메뉴로 돌아가기');finishForce({notice:'Late force receipt'});await frame();check(menu.view==='main'&&!menu.box.textContent.includes('Late force receipt'),'late force receipt cannot replace the menu after Back');
  phase='reconnect';await click('조사하다 CLI 회로망');await until(()=>menu.cliNetwork.data?.action==='reconnect');await click('현재 저장된 상태에서 다시 연결…');check(menu.box.textContent.includes(t('이전 연결 수신은 아직 알 수 없습니다. 이 작업은 이전 공급자 설정이나 메시지를 재생하지 않습니다.。')),'reconnect preserves unknown original receipt');await click('재연결 확인');await until(()=>menu.cliNetwork.data?.status==='unknown');check(calls.at(-1).action==='reconnect'&&calls.at(-1).generation==='saved-generation'&&!('operationId' in calls.at(-1)),'reconnect sends the exact saved-state contract');
  menu.close({immediate:true});phase='slow';menu.show(context,{element:anchor});await click('조사하다 CLI 회로망');check(!!finishRead&&!find('닫기').disabled,'slow initial read keeps Close enabled');await click('닫기');finishRead({message:'Late dismissed read'});await frame();check(!menu.box,'late initial read cannot reopen the panel');
  if(keepOpen){phase='waiting';menu.show(context,{element:anchor});await click('조사하다 CLI 회로망');await until(()=>menu.cliNetwork.data);await click('작업이 끝날 때까지 기다렸다가 다시 시작하세요.…');await click('복구 확인');await until(()=>menu.cliNetwork.data?.state==='waiting');window.__cliNetworkPreview={menu,cleanup:()=>{menu.close({immediate:true});anchor.remove();}};}
  return {checks:checks.length,width:innerWidth,language:BridgeI18n.language(),requests:calls.length,forceRequests:calls.filter(body=>body?.action==='force').length,modelRequests:0};
 }finally{if(!keepOpen){menu.close({immediate:true});anchor.remove();}}
}
