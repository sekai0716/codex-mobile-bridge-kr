'use strict';
const {test,expect}=require('@playwright/test');

// 실제 페이지와 전송 콜백을 사용하되 모든 채팅 읽기·쓰기는 메모리에서 끝낸다.
async function prepare(page){
  await page.goto('/?case=session-menu');
  await expect(page.locator('#bootstrap-status')).toBeHidden();
  await page.evaluate(async()=>{
    await BridgeFeatures.load('chat');
    const id='11111111-1111-4111-8111-111111111111',original=window.fetch;
    const fixture=window.sendControlsFixture={writes:[],quotaReads:[],settingsWrites:[],queueWrites:[],uploadWrites:[],edits:[],managedQueue:[],details:[],reply:'accepted'};
    fixture.meta={id,title:'전송·추론 표시 검증',host:'local',provider:'openai',draftAccountIdentity:'c'.repeat(64),permissionMode:'auto-review',connected:true,loadingHistory:false,historyComplete:true,status:'idle',model:'fixture',effort:'high',serviceTier:'default',requests:[],submissions:[],collaborationMode:'default'};
    fixture.reason={key:'reason',order:1,role:'activity',kind:'reasoning',title:'추론 요약',text:'추론 요약의 앞부분',truncated:true,version:1};
    fixture.page=()=>({sequence:1,epoch:'fixture',hasMore:false,before:null,files:[],meta:fixture.meta,rows:[fixture.reason,{key:'tool',order:2,role:'activity',kind:'commandExecution',title:'명령을 실행하다',text:'명령 출력',truncated:false,version:1},...(fixture.extraRows||[])]});
    const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    window.fetch=async(url,options={})=>{
      const path=new URL(url,location.origin);
      if(path.pathname.endsWith('/timeline'))return response(fixture.page());
      if(path.pathname.endsWith('/changes'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
      if(path.pathname.endsWith('/detail')){fixture.details.push(path.search);return response({version:Number(path.searchParams.get('version')),offset:0,text:'추론 요약 전체 내용',next:null,files:[]});}
      if(path.pathname.endsWith('/send')){const body=JSON.parse(options.body);fixture.writes.push(body);return response({status:fixture.reply});}
      if(path.pathname.endsWith('/uploads')){
        const file=options.body,row={id:path.searchParams.get('id'),name:path.searchParams.get('name'),size:file.size,image:null};
        fixture.uploadWrites.push(row);return response(row);
      }
      if(path.pathname.endsWith('/message-management')){
        if(options.body){const body=JSON.parse(options.body);fixture.edits.push(body);if(body.action==='edit'){fixture.managedQueue=fixture.managedQueue.map(row=>row.id===body.id?{...row,text:body.text,editId:body.editId}:row);}}
        return response({version:'queue-version',draftAccountIdentity:fixture.meta.draftAccountIdentity,queue:fixture.managedQueue,unknown:[],receipts:[],capabilities:{edit:true,withdraw:true,reorder:true}});
      }
      if(path.pathname.endsWith('/queue-send')){
        const body=JSON.parse(options.body);fixture.queueWrites.push(body);
        const finish=()=>response({status:'accepted',id:body.id});
        return fixture.holdQueue?new Promise(resolve=>fixture.finishQueue=()=>resolve(finish())):finish();
      }
      if(path.pathname.endsWith('/catalog'))return response(path.searchParams.get('kind')==='models'?{models:[{id:'fixture',fastTier:'priority',efforts:['high']}],fastMode:{allowed:true,provider:'openai',defaultServiceTier:'default'}}:{skills:[],selectedSkills:[],total:0});
      if(path.pathname.endsWith('/settings')){
        const body=JSON.parse(options.body);fixture.settingsWrites.push(body);
        const finish=()=>{fixture.meta={...fixture.meta,serviceTier:body.fastMode?'priority':'default'};return response({applied:true,confirmed:true,serviceTier:fixture.meta.serviceTier});};
        return fixture.holdSettings?new Promise(resolve=>fixture.finishSettings=()=>resolve(finish())):finish();
      }
      if(path.pathname==='/api/account'){fixture.quotaReads.push(path.search);return response({visible:true,limits:[{id:'codex',name:'Codex',windows:fixture.quotaWindows||[{windowDurationMins:300,remainingPercent:0,resetsAt:1800000000},{windowDurationMins:10080,remainingPercent:75,resetsAt:1800500000}]}]});}
      if(path.pathname.endsWith('/notifications'))return response({available:false});
      return original(url,options);
    };
    fixture.update=(status,extra={})=>{fixture.meta={...fixture.meta,status,...extra};renderState(fixture.meta);};
    await openChat(id,'local');
  });
}

test.beforeEach(async({context,request,baseURL})=>{
  await context.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
  expect(await(await request.get('/__fixture_health')).json()).toEqual({fixture:'cmb-browser-regression'});
});
test.afterEach(async({page})=>{await page.evaluate(()=>chatTimeline?.dispose()).catch(()=>{});});

test('Codex send mode stays in its original position and sends idle, queues busy or steers',async({page},testInfo)=>{
  await prepare(page);
  const input=page.locator('#message'),send=page.locator('#send'),mode=page.locator('#send-mode');
  await expect(mode).toBeVisible();await expect(page.locator('#send-options')).toHaveCount(0);
  await expect(send).toHaveAttribute('aria-label','메시지 보내기');
  await input.fill('대기 중 일반 전송');await send.click();
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.writes.length)).toBe(1);
  expect(await page.evaluate(()=>sendControlsFixture.writes[0].mode)).toBe('send');
  await page.evaluate(()=>sendControlsFixture.update('active'));
  await expect(send).toHaveAttribute('aria-label','완료 후 보내기');await expect(page.locator('#stop')).toBeVisible();
  await input.fill('작업 후 대기열 전송');await send.click();
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.writes.length)).toBe(2);
  expect(await page.evaluate(()=>sendControlsFixture.writes[1].mode)).toBe('queue');
  await expect(input).toHaveValue('');
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    const choice=await mode.boundingBox(),work=await page.locator('#work-mode').boundingBox();
    expect(choice.x+choice.width).toBeLessThanOrEqual(work.x+1);expect(Math.abs(choice.y-work.y)).toBeLessThan(2);
    expect(await page.locator('#composer').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`send-menu-${width}.png`)});
  }
  await mode.selectOption('steer');
  await expect(send).toHaveAttribute('aria-label','현재 작업에 바로 보내기');
  await expect(page.locator('#work-mode')).toBeDisabled();
  await input.fill('현재 작업에 추가 지시');await send.click();
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.writes.length)).toBe(3);
  expect(await page.evaluate(()=>({mode:sendControlsFixture.writes[2].mode,workMode:sendControlsFixture.writes[2].workMode}))).toEqual({mode:'steer',workMode:null});
  await page.evaluate(()=>sendControlsFixture.update('idle'));await expect(mode).toBeVisible();await expect(mode).toHaveValue('auto');
  await expect(send).toHaveAttribute('aria-label','메시지 보내기');
  await page.evaluate(()=>sendControlsFixture.update('active',{endpointId:'wsl:fixture',access:{source:'cli',runtime:'wsl',canSend:true},capabilities:{queue:false}}));
  await expect(send).toBeDisabled();
  await mode.selectOption('steer');await expect(send).toBeEnabled();
  await page.evaluate(()=>sendControlsFixture.update('idle',{endpointId:undefined,access:undefined,capabilities:undefined}));
  await page.evaluate(()=>{sendControlsFixture.update('active');sendControlsFixture.reply='unknown';});
  await input.fill('결과 미확인 전송');await send.click();
  await expect(page.locator('#send-error')).not.toBeEmpty();await expect(input).toHaveValue('결과 미확인 전송');
  await page.evaluate(()=>sendControlsFixture.update('idle'));await send.click();
  expect(await page.evaluate(()=>sendControlsFixture.writes.length)).toBe(4);
  await expect(input).toHaveValue('결과 미확인 전송');
});

test('queued message exposes Send now and repeated clicks keep its ID and the current draft',async({page},testInfo)=>{
  await prepare(page);
  const id='22222222-2222-4222-8222-222222222222',version='a'.repeat(64);
  await page.evaluate(({id,version})=>{
    const f=sendControlsFixture;f.holdQueue=true;
    f.update('active',{submissions:[{id,version,text:'대기열에 이미 넣은 지시',status:'queued',canSendNow:true}]});
  },{id,version});
  await page.locator('#message').fill('보내지 않은 새 초안');
  const now=page.locator('#queued').getByRole('button',{name:'지금 보내기',exact:true});
  await expect(now).toBeVisible();await page.screenshot({path:testInfo.outputPath('queued-send-now.png')});
  await now.click();await expect(now).toBeDisabled();await now.dispatchEvent('click');
  expect(await page.evaluate(()=>sendControlsFixture.queueWrites)).toEqual([{id,version,expectedAccount:'c'.repeat(64)}]);
  await page.evaluate(()=>sendControlsFixture.finishQueue());
  await expect(now).toHaveCount(0);await expect(page.locator('#message')).toHaveValue('보내지 않은 새 초안');
  expect(await page.evaluate(()=>sendControlsFixture.writes.length)).toBe(0);
});

test('a real file over 20 MiB reaches upload and the original attachment ID reaches send',async({page})=>{
  await prepare(page);
  const size=21*1024*1024+3;
  await page.locator('#attachment-input').setInputFiles({name:'large-fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(size,120)});
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.uploadWrites.length)).toBe(1);
  const uploaded=await page.evaluate(()=>sendControlsFixture.uploadWrites[0]);
  expect(uploaded.size).toBe(size);expect(uploaded.name).toBe('large-fixture.bin');
  await expect(page.locator('#attachment-list')).toContainText('large-fixture.bin');
  await page.locator('#message').fill('첨부 확인');await expect(page.locator('#send')).toBeEnabled();await page.locator('#send').click();
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.writes.length)).toBe(1);
  expect(await page.evaluate(()=>sendControlsFixture.writes[0].attachments)).toEqual([uploaded.id]);
});

test('queue card opens its own editor and saving preserves order, attachment and composer draft',async({page})=>{
  await prepare(page);const id='33333333-3333-4333-8333-333333333333';
  await page.evaluate(id=>{
    const f=sendControlsFixture;f.managedQueue=[{id,text:'수정 전 대기 메시지',status:'queued',attachments:['original.txt']},{id:'44444444-4444-4444-8444-444444444444',text:'다음 메시지',status:'queued'}];
    f.update('active',{submissions:[{id,text:f.managedQueue[0].text,status:'queued',version:'a'.repeat(64),canSendNow:true}]});
  },id);
  await page.locator('#message').fill('지금 작성 중인 초안');
  const card=page.locator('#queued');await expect(card.getByRole('button',{name:'지금 보내기',exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:/철회/})).toHaveCount(0);await card.getByRole('button',{name:'다시 편집',exact:true}).click();
  const dialog=page.locator('.message-management');const editor=dialog.getByRole('textbox',{name:'대기 중인 메시지 편집'});
  await expect(editor).toHaveValue('수정 전 대기 메시지');await expect(page.locator('#message')).toHaveValue('지금 작성 중인 초안');
  await editor.fill('수정한 대기 메시지');await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(()=>sendControlsFixture.managedQueue.map(row=>({id:row.id,text:row.text,attachments:row.attachments})))).toEqual([{id,text:'수정한 대기 메시지',attachments:['original.txt']},{id:'44444444-4444-4444-8444-444444444444',text:'다음 메시지',attachments:undefined}]);
  const writes=await page.evaluate(()=>sendControlsFixture.edits);expect(writes).toHaveLength(1);expect(writes[0].id).toBe(id);expect(writes[0].action).toBe('edit');
  expect(await page.evaluate(()=>sendControlsFixture.writes.length+sendControlsFixture.queueWrites.length)).toBe(0);
  await expect(page.locator('#message')).toHaveValue('지금 작성 중인 초안');
});

test('native activity headings and permissions use requested Korean and switch back to English',async({page})=>{
  await prepare(page);await expect(page.locator('#permissions-button')).toHaveText('나 대신 승인');
  await page.evaluate(()=>{
    const label=workbench.node('span','','접는 사람');label.id='localized-folder-fixture';
    const name=workbench.raw(workbench.node('span','','접는 사람'));name.id='raw-filename-fixture';workbench.panel.append(label,name);
  });
  await expect(page.locator('#messages [data-key=tool] summary')).toHaveText('명령을 실행함');
  await page.evaluate(()=>{const f=sendControlsFixture;f.extraRows=[{key:'steer-event',order:3,role:'activity',kind:'steered',title:'steered',text:'unchanged tool output',version:1},{key:'approval-event',order:4,role:'activity',kind:'automaticApprovalReview',title:'automaticApprovalReview',text:'unchanged tool output',version:1}];chatTimeline.apply({...f.page(),sequence:2});f.update('active');});
  await expect(page.locator('#working')).toHaveText('Codex 생각 중');
  await expect(page.locator('#messages [data-key=steer-event] summary')).toHaveText('스티어링함');
  await expect(page.locator('#messages [data-key=approval-event] summary')).toHaveText('자동 검토 중');
  await page.evaluate(()=>{BridgeI18n.setLanguage('en');BridgeI18n.apply();chatTimeline.relabel();});
  await expect(page.locator('#messages [data-key=tool] summary')).toHaveText('Ran a command');
  await expect(page.locator('#messages [data-key=steer-event] summary')).toHaveText('Steered');
  await expect(page.locator('#localized-folder-fixture')).toHaveText('Folder');
  await expect(page.locator('#raw-filename-fixture')).toHaveText('접는 사람');
  await page.evaluate(()=>{BridgeI18n.setLanguage('ko');BridgeI18n.apply();chatTimeline.relabel();});
  await expect(page.locator('#messages [data-key=approval-event] summary')).toHaveText('자동 검토 중');
  await expect(page.locator('#localized-folder-fixture')).toHaveText('폴더');
  await expect(page.locator('#raw-filename-fixture')).toHaveText('접는 사람');
});

test('reasoning uses the last nonempty line beside Thinking and never renders timeline items',async({page},testInfo)=>{
  await prepare(page);
  const working=page.locator('#working');
  await expect(page.locator('#appearance-expand-reasoning')).toHaveCount(0);
  await expect(page.locator('#messages [data-key=reason]')).toHaveCount(0);
  await page.evaluate(()=>sendControlsFixture.update('active',{reasoningTurnId:'first',reasoningSummary:'첫 번째 줄\n**마지막 요약 한 줄**\n  '}));
  await expect(working).toHaveText('Codex 생각 중ㆍ마지막 요약 한 줄');
  await page.evaluate(()=>sendControlsFixture.update('active',{reasoningSummary:' \n'}));
  await expect(working).toHaveText('Codex 생각 중ㆍ마지막 요약 한 줄');
  await page.evaluate(()=>sendControlsFixture.update('active',{reasoningSummary:'**\n  '}));
  await expect(working).toHaveText('Codex 생각 중ㆍ마지막 요약 한 줄');
  await page.evaluate(()=>sendControlsFixture.update('active',{reasoningSummary:'한 줄로만 표시해야 하는 긴 요약입니다. '.repeat(40)}));
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    const summary=working.locator('.chat-progress-summary');
    expect(await summary.evaluate(n=>({nowrap:getComputedStyle(n).whiteSpace,overflow:getComputedStyle(n).textOverflow,lines:n.getBoundingClientRect().height/parseFloat(getComputedStyle(n).lineHeight)}))).toMatchObject({nowrap:'nowrap',overflow:'ellipsis'});
    expect(await summary.evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const tops=[...range.getClientRects()].map(r=>r.top);return Math.max(...tops)-Math.min(...tops);})).toBeLessThan(3);
    expect(await page.locator('#composer').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`reasoning-one-line-${width}.png`)});
  }
  await page.evaluate(()=>{const n=document.getElementById('appearance-reasoning');n.checked=false;n.onchange();});
  await expect(working).toHaveText('Codex 생각 중');
  await page.evaluate(()=>{const n=document.getElementById('appearance-reasoning');n.checked=true;n.onchange();sendControlsFixture.update('active',{reasoningTurnId:'second',reasoningSummary:''});});
  await expect(working).toHaveText('Codex 생각 중');
  await page.evaluate(()=>sendControlsFixture.update('idle'));await expect(working).toBeHidden();
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(0);
});

test('compaction states and locale selections work in Korean, English and Chinese',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{const f=sendControlsFixture;f.extraRows=[{key:'compact',order:3,role:'activity',kind:'contextCompaction',title:'contextCompaction',status:'completed',text:'',version:1},{key:'autocompact',order:4,role:'activity',kind:'autoContextCompaction',title:'autoContextCompaction',status:'inProgress',text:'',version:1}];chatTimeline.apply({...f.page(),sequence:2});});
  const languages=[['ko','컨텍스트 압축됨','컨텍스트 자동 압축 중','메시지를 입력하세요'],['en','Context compacted','Automatically compacting context','Message…'],['zh','上下文已压缩','正在自动压缩上下文','输入消息…']];
  for(const [language,compact,auto,placeholder]of languages){
    await page.evaluate(language=>{BridgeI18n.setLanguage(language);BridgeI18n.apply();chatTimeline.relabel();},language);
    await expect(page.locator('#messages [data-key=compact] summary')).toHaveText(compact);
    await expect(page.locator('#messages [data-key=autocompact] summary')).toHaveText(auto);
    await expect(page.locator('#message')).toHaveAttribute('placeholder',placeholder);
  }
  await page.route('**/api/auth',async route=>{const response=await route.fetch(),data=await response.json();data.uiLanguage=null;await route.fulfill({response,json:data});});
  await prepare(page);expect(await page.evaluate(()=>BridgeI18n.language())).toBe('zh');
  await page.evaluate(()=>{BridgeI18n.setLanguage('zh-CN');BridgeI18n.apply();});
  expect(await page.evaluate(()=>localStorage.getItem('bridge-language'))).toBe('zh');
  await expect(page.locator('#appearance-language')).toHaveValue('zh');
});

test('native compaction source and completed update the same activity before its turn ends',async({page},testInfo)=>{
  await prepare(page);
  await page.evaluate(()=>{
    const f=sendControlsFixture;
    f.extraRows=[{key:'native-compact',order:3,role:'activity',kind:'contextCompaction',title:'contextCompaction',source:'automatic',completed:false,turnStatus:'completed',text:'',version:1}];
    chatTimeline.apply({...f.page(),sequence:2});
    window.nativeCompactionKeys=[...chatTimeline.rows.keys()];
  });
  const heading=page.locator('#messages [data-key=native-compact] summary');
  await expect(heading).toHaveText('컨텍스트 자동 압축 중');
  await testInfo.attach('native-automatic-compaction',{body:await page.screenshot(),contentType:'image/png'});
  await page.evaluate(()=>{
    const f=sendControlsFixture;f.extraRows[0]={...f.extraRows[0],source:'manual',version:2};chatTimeline.apply({...f.page(),sequence:3});
  });
  await expect(heading).toHaveText('컨텍스트 압축 중');
  await page.evaluate(()=>{
    const f=sendControlsFixture;f.extraRows[0]={...f.extraRows[0],source:'automatic',completed:true,turnStatus:'inProgress',version:3};chatTimeline.apply({...f.page(),sequence:4});
  });
  for(const [lang,label]of [['ko','컨텍스트 압축됨'],['en','Context compacted'],['zh','上下文已压缩']]){
    await page.evaluate(lang=>{BridgeI18n.setLanguage(lang);chatTimeline.relabel();},lang);
    await expect(heading).toHaveText(label);
  }
  await page.evaluate(()=>{BridgeI18n.setLanguage('ko');chatTimeline.relabel();});
  await expect(heading).toHaveText('컨텍스트 압축됨');
  await expect(page.locator('#messages [data-key=native-compact]')).toHaveCount(1);
  expect(await page.evaluate(()=>[...chatTimeline.rows.keys()])).toEqual(await page.evaluate(()=>window.nativeCompactionKeys));
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(0);
  await testInfo.attach('native-completed-compaction',{body:await page.screenshot(),contentType:'image/png'});
});

test('account quota keeps all toolbar buttons on one row and exposes refresh and reset times',async({page},testInfo)=>{
  await prepare(page);const quota=page.locator('#composer .account-usage');
  await expect(quota).toContainText('0%');await expect(quota).toContainText('75%');
  for(const width of [320,390,430,1280]){
    await page.setViewportSize({width,height:844});
    const q=await quota.boundingBox(),c=await page.locator('#composer .context-usage').boundingBox();
    expect(q.x).toBeGreaterThanOrEqual(c.x+c.width);expect(Math.abs(q.y+q.height/2-c.y-c.height/2)).toBeLessThan(4);
    const controls=await page.locator('#composer .composer-tools').evaluate(node=>[...node.querySelectorAll('button')].filter(n=>!n.hidden&&n.getBoundingClientRect().width).map(n=>{const r=n.getBoundingClientRect();return {id:n.id,width:r.width,y:r.top+r.height/2};}));
    expect(Math.max(...controls.map(n=>n.y))-Math.min(...controls.map(n=>n.y))).toBeLessThan(4);
    for(const control of controls)expect(control.width,control.id+' remains usable').toBeGreaterThanOrEqual(24);
    expect(await page.locator('#composer').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`quota-${width}.png`)});
  }
  await page.evaluate(async()=>{sendControlsFixture.quotaWindows=[{windowDurationMins:10080,remainingPercent:75,resetsAt:1800500000}];await accountUsageControl.refresh(true);});
  await expect(quota).toHaveText('주간 75%');
  await page.setViewportSize({width:320,height:844});
  const weekly=await quota.boundingBox(),model=await page.locator('#model-button').boundingBox();
  expect(Math.abs(weekly.y+weekly.height/2-model.y-model.height/2)).toBeLessThan(4);
  expect(await page.locator('#composer').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('weekly-only-320.png')});
  for(const windows of [
    [{windowDurationMins:300,remainingPercent:100,resetsAt:1800000000},{windowDurationMins:10080,remainingPercent:100,resetsAt:1800500000}],
    [{windowDurationMins:10080,remainingPercent:100,resetsAt:1800500000}],
  ]){
    await page.evaluate(async windows=>{sendControlsFixture.quotaWindows=windows;await accountUsageControl.refresh(true);},windows);
    await expect(quota).toContainText('100%');
    const ys=await page.locator('#composer .composer-tools').evaluate(node=>[...node.querySelectorAll('button')].filter(n=>!n.hidden).map(n=>{const r=n.getBoundingClientRect();return r.top+r.height/2;}));
    expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(4);
    expect(await page.locator('#composer').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  }
  const initial=await page.evaluate(()=>sendControlsFixture.quotaReads.length);await quota.click();const dialog=page.locator('.account-usage-dialog');
  await expect(dialog).toContainText('재설정 시간:');await dialog.getByRole('button',{name:'사용 한도 새로고침'}).click();
  await expect.poll(()=>page.evaluate(()=>sendControlsFixture.quotaReads.length)).toBe(initial+1);
  expect(await page.evaluate(()=>sendControlsFixture.quotaReads.at(-1))).toContain('cached=0');
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();
  await page.evaluate(()=>{currentHost='wsl:fixture';sendControlsFixture.update('active');});await expect(quota).toBeHidden();
});

test('settings keep translation keys and edits when returning from Chinese to Korean or English',async({page})=>{
  await prepare(page);await page.locator('#message').fill('언어를 바꿔도 남길 초안');
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());
  const title=page.locator('#appearance-heading'),select=page.locator('#appearance-language');
  for(const [language,expected] of [['zh','设置'],['ko','설정'],['en','Settings'],['zh','设置'],['ko','설정']]){
    await select.selectOption(language);await expect(title).toHaveText(expected);await expect(title).toHaveAttribute('data-i18n','설정');
    expect(await page.evaluate(()=>BridgeI18n.language())).toBe(language);
    await expect(page.locator('#appearance-dialog [data-i18n="테마"]')).toHaveText({ko:'테마',en:'Theme',zh:'主题'}[language]);
  }
  await page.locator('#appearance-dialog .picker-head [data-close=appearance-dialog]').click();
  await expect(page.locator('#message')).toHaveValue('언어를 바꿔도 남길 초안');
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());await expect(title).toHaveText('설정');
});

test('Fast lightning toggles next to context without changing model, effort or drafts',async({page},testInfo)=>{
  await prepare(page);
  const fast=page.locator('#fast-mode-toggle'),input=page.locator('#message');
  await expect(fast).toBeEnabled();await expect(fast).toHaveAttribute('aria-pressed','false');
  await input.fill('전환 중에도 남겨 둘 초안');
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    const fastBox=await fast.boundingBox(),contextBox=await page.locator('#composer .context-usage').boundingBox();
    expect(fastBox.x+fastBox.width).toBeLessThanOrEqual(contextBox.x+1);
    expect(Math.abs(fastBox.y-contextBox.y)).toBeLessThan(4);
    expect(await page.locator('#composer').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`fast-toggle-${width}.png`)});
  }
  await page.evaluate(()=>{BridgeI18n.setLanguage('en');BridgeI18n.apply();});await expect(fast).toHaveAttribute('aria-label','Fast mode off');
  await page.evaluate(()=>{BridgeI18n.setLanguage('ko');BridgeI18n.apply();});
  await page.evaluate(()=>sendControlsFixture.holdSettings=true);await fast.click();
  await expect(fast).toBeDisabled();await fast.dispatchEvent('click');
  expect(await page.evaluate(()=>sendControlsFixture.settingsWrites)).toEqual([{model:'fixture',effort:'high',fastMode:true}]);
  await page.evaluate(()=>{sendControlsFixture.holdSettings=false;sendControlsFixture.finishSettings();});
  await expect(fast).toHaveAttribute('aria-pressed','true');await expect(fast).toBeEnabled();
  await fast.click();await expect(fast).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>sendControlsFixture.settingsWrites)).toEqual([{model:'fixture',effort:'high',fastMode:true},{model:'fixture',effort:'high',fastMode:false}]);
  await expect(input).toHaveValue('전환 중에도 남겨 둘 초안');
  expect(await page.evaluate(()=>sendControlsFixture.writes.length)).toBe(0);
  await page.evaluate(()=>sendControlsFixture.update('idle',{model:'unsupported-model'}));await expect(fast).toBeDisabled();
});
