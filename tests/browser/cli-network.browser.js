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
  menu.show(context,{element:anchor});await Promise.all(menu.box.getAnimations().map(animation=>animation.finished.catch(()=>{})));await click('CLI 네트워크 확인');await until(()=>menu.cliNetwork.data);check(menu.view==='cli-network'&&menu.box.textContent.includes('Native configuration changed'),'inspection result stays in visible panel');
  await click('작업 완료 후 복구…');check(calls.length===1,'opening recovery confirmation makes no write');await click('다시 덮다');await until(()=>menu.cliNetwork.data?.state==='waiting');check(calls[1].confirmed===true&&calls[1].generation==='wait-generation','default recovery binds preview generation');check(!!find('취소 대기')&&!!find('작업 결과 확인'),'waiting offers status and cancellation');fits('waiting');
  await click('취소 대기');await until(()=>menu.cliNetwork.data?.state==='cancelled');check(calls.at(-1).action==='cancel'&&calls.at(-1).operationId==='wait-operation','cancel uses the exact backend operation');check(menu.box.textContent.includes('Cancellation confirmed by backend'),'cancellation is shown after backend confirmation');
  phase='force';await click('네트워크를 다시 확인하세요.');await until(()=>menu.cliNetwork.data?.message==='Native task state unknown');await click('강제 복구 범위 검토…');await until(()=>menu.cliNetwork.confirmation);
  check(menu.box.textContent.includes('/fixture/.codex')&&menu.box.textContent.includes('native-original')&&menu.box.textContent.includes('native-other'),'force confirmation shows exact home and known session scope');check(menu.box.textContent.includes(t('이는 나열되지 않은 세션을 포함하여 이 구성에서 실행 중이거나 확인되지 않은 작업을 중단합니다. 저장된 채팅 기록은 보존됩니다.')),'force confirmation states unlisted task impact');fits('force confirmation');check(calls.every(body=>body?.action!=='force'),'preview never dispatches force');
  await click('강제 회복');check(calls.at(-1).action==='force'&&calls.at(-1).generation==='force-generation'&&calls.at(-1).operationId===null&&!!calls.at(-1).requestId,'force uses only the fresh preview and new request ID');check(!find('닫기').disabled&&!find('채팅 메뉴로 돌아가기').disabled,'pending force keeps Close and Back enabled');await click('채팅 메뉴로 돌아가기');finishForce({notice:'Late force receipt'});await frame();check(menu.view==='main'&&!menu.box.textContent.includes('Late force receipt'),'late force receipt cannot replace the menu after Back');
  phase='reconnect';await click('CLI 네트워크 확인');await until(()=>menu.cliNetwork.data?.action==='reconnect');await click('저장된 상태에서 다시 연결…');check(menu.box.textContent.includes(t('이전 이력서 접수는 미확인 상태로 남아있습니다. 이전 공급자 설정이나 메시지는 재생되지 않습니다.')),'reconnect preserves unknown original receipt');await click('다시 연결');await until(()=>menu.cliNetwork.data?.status==='unknown');check(calls.at(-1).action==='reconnect'&&calls.at(-1).generation==='saved-generation'&&!('operationId' in calls.at(-1)),'reconnect sends the exact saved-state contract');
  menu.close({immediate:true});phase='slow';menu.show(context,{element:anchor});await click('CLI 네트워크 확인');check(!!finishRead&&!find('닫기').disabled,'slow initial read keeps Close enabled');await click('닫기');finishRead({message:'Late dismissed read'});await frame();check(!menu.box,'late initial read cannot reopen the panel');
  if(keepOpen){phase='waiting';menu.show(context,{element:anchor});await click('CLI 네트워크 확인');await until(()=>menu.cliNetwork.data);await click('작업 완료 후 복구…');await click('다시 덮다');await until(()=>menu.cliNetwork.data?.state==='waiting');window.__cliNetworkPreview={menu,cleanup:()=>{menu.close({immediate:true});anchor.remove();}};}
  return {checks:checks.length,width:innerWidth,language:BridgeI18n.language(),requests:calls.length,forceRequests:calls.filter(body=>body?.action==='force').length,modelRequests:0};
 }finally{if(!keepOpen){menu.close({immediate:true});anchor.remove();}}
}
