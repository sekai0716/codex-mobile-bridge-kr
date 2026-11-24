// Run only in an isolated page with production SessionMenu and its styles loaded.
async function runSessionMenuBrowserChecks(){
  const check=(value,message)=>{if(!value)throw Error(message);};
  const anchor=document.createElement('button');anchor.textContent='Synthetic session';document.body.append(anchor);
  const calls=[],notices=[],menu=new SessionMenu({translate:BridgeI18n.t,notify:text=>notices.push(text)});
  const context=()=>({title:'합성 세션',subtitle:'Codex · fixture',pinned:false,nativeOrganization:true,sessionId:'synthetic-session',
    details:[['대화 ID','synthetic-session',true],['작업 디렉토리','D:\\Synthetic\\Project',true]],
    pin:value=>calls.push(['pin',value]),rename:title=>calls.push(['rename',title]),
    organization:change=>{if(change)calls.push(['organization',change]);return Promise.resolve({projectId:'project-a',sectionId:null,projects:[{id:'project-a',name:'현재 프로젝트'},{id:'project-b',name:'대상 프로젝트'}],sections:[{id:'section-b',name:'대상 파티션'}],status:'confirmed'});},
    archive:()=>calls.push(['archive']),link:'codex://threads/synthetic',isCurrent:()=>true});
  window.BridgeClipboard={copyWithFeedback:(get,button)=>{check(!button.disabled,'clipboard must receive an enabled trusted-click target');calls.push(['copy',get()]);return Promise.resolve(true);}};
  const click=async label=>{const button=[...menu.box.querySelectorAll('button')].find(node=>node.textContent===label);check(button,'missing action: '+label);button.click();await new Promise(resolve=>setTimeout(resolve,0));};
  try{
    menu.show(context(),{element:anchor,x:innerWidth-1,y:innerHeight-1});
    check(!menu.box.textContent.includes('세션 ID 복사'),'native deep link is the primary copy action');
    check(menu.box.querySelector('.message-copy'),'copy is marked before the first click capture');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    check(getComputedStyle(menu.box).animationName===(reduced?'none':innerWidth<=640?'sm-sheet-in':'sm-menu-in'),'menu uses the expected motion preference');
    await Promise.all(menu.box.getAnimations().map(animation=>animation.finished.catch(()=>{})));
    let rect=menu.box.getBoundingClientRect();check(rect.left>=-1&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1,'menu must fit the viewport: '+JSON.stringify({left:rect.left,right:rect.right,bottom:rect.bottom,width:innerWidth,height:innerHeight}));
    check(!menu.box.textContent.includes('완료되면 알림'),'notification action is excluded');
    await click('딥링크 복사');check(calls.at(-1)[1]==='codex://threads/synthetic','link copy preserves identity');
    menu.show({...context(),link:null},{element:anchor});await click('세션 ID 복사');check(calls.at(-1)[1]==='synthetic-session','other clients copy native session ID directly');
    await click('프로젝트 목록');check(menu.box.querySelector('[aria-pressed=true]').textContent.includes('현재 프로젝트'),'native selection is marked');
    await click('대상 프로젝트');check(calls.at(-1)[1].targetId==='project-b'&&calls.at(-1)[1].expectedId==='project-a','native project move preserves prior identity');
    menu.show(context(),{element:anchor});await click('섹션');await click('대상 파티션');check(calls.at(-1)[1].kind==='section','native section uses the shared menu');
    menu.show(context(),{element:anchor});
    await click('채팅 고정');check(calls.at(-1)[1]===true&&menu.box.textContent.includes('고정 해제'),'pin updates immediately');
    menu.box.querySelector('[aria-label="채팅 이름 바꾸기"]').click();
    const input=menu.box.querySelector('input');input.value='<b>새 이름</b>';menu.box.querySelector('form').requestSubmit();await new Promise(resolve=>setTimeout(resolve,0));
    check(menu.box.querySelector('strong').textContent==='<b>새 이름</b>'&&!menu.box.querySelector('b'),'rename uses text, preserves title and escapes markup');
    await click('채팅 세부정보');const copy=menu.box.querySelector('[aria-label="복사 대화 ID"]');check(copy,'ID copy remains available in details');copy.click();await new Promise(resolve=>setTimeout(resolve,0));check(calls.at(-1)[1]==='synthetic-session','ID copy retains original ID');await click('채팅 메뉴로 돌아가기');
    await click('중지하고 보관처리하세요…');check(calls.every(row=>row[0]!=='archive'),'archive requires confirmation');const buttons=[...menu.box.querySelectorAll('.sm-confirm-actions button')];check(buttons.map(b=>b.textContent).join(',')==='보관 확인,취소','confirmation stays left of cancel');check(Math.abs(buttons[0].getBoundingClientRect().width-buttons[1].getBoundingClientRect().width)<1&&buttons[0].className===buttons[1].className,'confirmation buttons have equal style and size');await click('취소');check(calls.every(row=>row[0]!=='archive'),'cancel never archives');
    await click('중지하고 보관처리하세요…');await click('보관 확인');check(calls.filter(row=>row[0]==='archive').length===1,'archive dispatches exactly once');
    menu.show({...context(),archived:true},{element:anchor});await click('채팅 복원');check(calls.filter(row=>row[0]==='archive').length===2,'restore dispatches directly');
    const deletion={id:'root',scope:['root','side'],sessions:[{id:'side',title:'네이티브 사이드 채팅'},{id:'root',title:'메인 채팅'}],subagentCount:1};
    const deleteContext={...context(),deletion:async snapshot=>{if(snapshot)calls.push(['delete',snapshot]);return deletion;}};
    menu.show(deleteContext,{element:anchor});await click('영구적으로 삭제…');
    check(menu.box.textContent.includes('네이티브 사이드 채팅')&&document.activeElement.textContent==='취소','delete shows native scope and defaults to cancel');
    await click('취소');check(!calls.some(row=>row[0]==='delete'),'cancel never deletes');
    await click('영구적으로 삭제…');await click('영구 삭제');check(calls.filter(row=>row[0]==='delete').length===1&&calls.at(-1)[1]===deletion,'delete dispatches precisely the confirmed scope once');
    const retrySnapshot={...deletion,retry:['previous-delete']};
    menu.show({...deleteContext,deletion:async snapshot=>{if(snapshot)calls.push(['retryDelete',snapshot]);return retrySnapshot;}},{element:anchor});await click('영구적으로 삭제…');
    check(menu.box.textContent.includes('이전 삭제가 확인되지 않았습니다.')&&[...menu.box.querySelectorAll('button')].find(b=>b.textContent==='영구 삭제').disabled,'unconfirmed deletion needs explicit re-confirmation');
    const retryCheck=menu.box.querySelector('input[type=checkbox]');retryCheck.checked=true;retryCheck.dispatchEvent(new Event('change'));
    await click('영구 삭제');check(calls.filter(row=>row[0]==='retryDelete').length===1&&calls.at(-1)[1]===retrySnapshot,'reconfirmation submits exact old receipt and current scope');
    let deletionLoaded;menu.show({...deleteContext,deletion:()=>new Promise(done=>{deletionLoaded=done;})},{element:anchor});await click('영구적으로 삭제…');await click('채팅 메뉴로 돌아가기');deletionLoaded(deletion);await new Promise(done=>setTimeout(done,0));check(!menu.box.querySelector('.sm-confirm-actions'),'late scope does not replace a returned menu');
    const before=calls.length;menu.show({...context(),isCurrent:()=>false},{element:anchor});await click('채팅 고정');check(calls.length===before&&menu.box.querySelector('[role="alert"]'),'stale authentication blocks write');
    let resolve;menu.show({...context(),organization:()=>new Promise(done=>{resolve=done;})},{element:anchor});await click('프로젝트 목록');await click('채팅 메뉴로 돌아가기');resolve({projects:[],sections:[]});await new Promise(done=>setTimeout(done,0));check(!menu.box.querySelector('[aria-pressed]'),'late native list never paints another view');
    menu.show({...context(),organization:()=>Promise.reject(Error('native unavailable'))},{element:anchor});await click('섹션');check(menu.box.querySelector('[role="alert"]').textContent==='native unavailable','native read error is visible');
    const priorBackCalls=calls.length;
    for(const view of ['details','rename','project','section','archive']){
      menu.show(context(),{element:anchor});menu.render(view);const box=menu.box;
      box.dispatchEvent(new Event('cancel',{cancelable:true}));
      check(menu.box===box&&menu.view==='main','native back and Escape return '+view+' to the main menu');
      check(calls.length===priorBackCalls,'back never submits a child page');
    }
    let completeWrite;menu.show({...context(),archive:()=>{calls.push(['pending-archive']);return new Promise(done=>{completeWrite=done;});}},{element:anchor});
    await click('중지하고 보관처리하세요…');await click('보관 확인');menu.box.dispatchEvent(new Event('cancel',{cancelable:true}));
    check(menu.view==='main'&&menu.busy,'returning does not cancel an already sent request');
    await click('중지하고 보관처리하세요…');await click('보관 확인');check(calls.filter(row=>row[0]==='pending-archive').length===1,'returning cannot submit the pending request twice');
    completeWrite();await new Promise(done=>setTimeout(done,0));check(!menu.box,'the original request still completes');
    const localContext={...context(),renameScope:'bridge',organizationScope:'bridge',organization:change=>{if(change)calls.push(['local-organization',change]);return Promise.resolve({projectId:null,sectionId:null,projects:[{id:'local-p',title:'지역 프로젝트'}],sections:[],scope:'bridge',status:'confirmed'});}};
    menu.show(localContext,{element:anchor});menu.render('rename');check(menu.box.textContent.includes('Bridge에만 적용됩니다.'),'local rename is labelled');
    menu.back();await click('프로젝트 목록');check(menu.box.textContent.includes('Bridge에만 적용됩니다.')&&menu.box.textContent.includes('지역 프로젝트'),'local project scope and title are visible');
    menu.box.querySelector('input').value='새 프로젝트';menu.box.querySelector('form').requestSubmit();await new Promise(done=>setTimeout(done,0));
    check(calls.at(-1)[1].kind==='create-project'&&calls.at(-1)[1].title==='새 프로젝트'&&calls.at(-1)[1].id,'create project submits one named request');
    menu.show({...context(),organization:()=>Promise.resolve({projectId:null,sectionId:null,projects:[],sections:[],scope:'native',sectionScope:'bridge'})},{element:anchor});await click('프로젝트 목록');check(!menu.box.querySelector('input'),'native projects have no Bridge creation form');
    menu.back();await click('섹션');check(menu.box.querySelector('[aria-label="새 섹션 이름"]')&&menu.box.textContent.includes('Bridge에만 적용됩니다.'),'mixed native project and local section retain their scopes');
    if(innerWidth<=640){
      const gesture=(target,dx,dy,end='pointerup')=>{
        target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:7,button:0,clientX:100,clientY:100}));
        target.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',pointerId:7,clientX:100+dx,clientY:100+dy}));
        target.dispatchEvent(new PointerEvent(end,{bubbles:true,pointerType:'touch',pointerId:7,clientX:100+dx,clientY:100+dy}));
      };
      menu.show(context(),{element:anchor});menu.render('details');let box=menu.box;
      gesture(box.querySelector('.sm-details'),0,150);check(menu.box===box&&!box.classList.contains('sm-returning'),'content scrolling never drags the sheet');
      gesture(box.querySelector('.sm-handle'),100,20);check(menu.box===box,'horizontal gestures never dismiss');
      gesture(box.querySelector('.sm-handle'),0,24);check(menu.box===box&&box.classList.contains('sm-returning'),'short drag returns to its position');
      await new Promise(done=>setTimeout(done,220));check(getComputedStyle(box).transform==='none'&&getComputedStyle(box).animationName==='none','spring back does not replay the entrance animation');
      gesture(box.querySelector('.sm-handle'),0,150,'pointercancel');check(menu.box===box,'interrupted gesture never dismisses');
      await new Promise(done=>setTimeout(done,220));
      gesture(box.querySelector('.sm-handle'),0,150);check(!menu.box,'a downward drag dismisses child pages without submitting');
      menu.show(context(),{element:anchor});gesture(menu.box.querySelector('.sm-name strong'),0,150);check(!menu.box,'the main title also supports downward dismissal');
    }
    menu.close();let navigated=0;anchor.addEventListener('click',()=>navigated++);menu.bind(anchor,context);
    anchor.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',button:0,clientX:1,clientY:1}));
    anchor.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',clientX:30,clientY:1}));
    await new Promise(resolve=>setTimeout(resolve,600));check(!menu.box,'scroll movement cancels long press');
    anchor.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',button:0,clientX:1,clientY:1}));
    await new Promise(resolve=>setTimeout(resolve,600));check(menu.box?.open,'stationary long press opens menu');anchor.click();check(navigated===0,'long press consumes the navigation click');
    const exiting=menu.box;exiting.dispatchEvent(new Event('cancel',{cancelable:true}));
    check(!menu.box,'cancel releases the active menu immediately');
    check(reduced?!exiting.isConnected:exiting.open&&exiting.inert&&exiting.classList.contains('sm-closing'),'cancel respects motion preference and blocks actions during exit');
    await new Promise(resolve=>setTimeout(resolve,300));check(!exiting.isConnected,'exit removes its modal and backdrop');
    menu.show(context(),{element:anchor});menu.close();menu.show(context(),{element:anchor});const replacement=menu.box;
    await new Promise(resolve=>setTimeout(resolve,300));check(menu.box===replacement&&replacement.open,'old exit completion never closes a replacement menu');
    return {passed:1,width:innerWidth,calls:calls.length};
  }finally{menu.close({immediate:true});anchor.remove();}
}
