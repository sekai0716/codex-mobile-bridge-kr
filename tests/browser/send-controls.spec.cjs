'use strict';
const {test,expect}=require('@playwright/test');

// 실제 페이지와 전송 콜백을 사용하되 모든 채팅 읽기·쓰기는 메모리에서 끝낸다.
async function prepare(page){
  await page.goto('/?case=session-menu');
  await expect(page.locator('#bootstrap-status')).toBeHidden();
  await page.evaluate(async()=>{
    await BridgeFeatures.load('chat');
    const id='11111111-1111-4111-8111-111111111111',original=window.fetch;
    const fixture=window.sendControlsFixture={writes:[],settingsWrites:[],queueWrites:[],details:[],reply:'accepted'};
    fixture.meta={id,title:'전송·추론 표시 검증',host:'local',provider:'openai',draftAccountIdentity:'c'.repeat(64),permissionMode:'auto-review',connected:true,loadingHistory:false,historyComplete:true,status:'idle',model:'fixture',effort:'high',serviceTier:'default',requests:[],submissions:[],collaborationMode:'default'};
    fixture.reason={key:'reason',order:1,role:'activity',kind:'reasoning',title:'추론 요약',text:'추론 요약의 앞부분',truncated:true,version:1};
    fixture.page=()=>({sequence:1,epoch:'fixture',hasMore:false,before:null,files:[],meta:fixture.meta,rows:[fixture.reason,{key:'tool',order:2,role:'activity',kind:'commandExecution',title:'명령 실행',text:'명령 출력',truncated:false,version:1}]});
    const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    window.fetch=async(url,options={})=>{
      const path=new URL(url,location.origin);
      if(path.pathname.endsWith('/timeline'))return response(fixture.page());
      if(path.pathname.endsWith('/changes'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
      if(path.pathname.endsWith('/detail')){fixture.details.push(path.search);return response({version:Number(path.searchParams.get('version')),offset:0,text:'추론 요약 전체 내용',next:null,files:[]});}
      if(path.pathname.endsWith('/send')){const body=JSON.parse(options.body);fixture.writes.push(body);return response({status:fixture.reply});}
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

test('reasoning default expansion can be switched off, persisted and switched on',async({page})=>{
  await prepare(page);
  const reason=page.locator('#messages [data-key=reason]'),toggle=page.locator('#appearance-expand-reasoning');
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());
  await expect(toggle).toBeChecked();await toggle.uncheck();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bridge-appearance')).expandReasoning)).toBe(false);
  await page.evaluate(()=>document.getElementById('appearance-dialog').close());
  await expect(reason).not.toHaveAttribute('open','');
  await prepare(page);await expect(reason).not.toHaveAttribute('open','');
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());
  await expect(toggle).not.toBeChecked();await toggle.check();
  await page.evaluate(()=>document.getElementById('appearance-dialog').close());
  await expect(reason).toHaveAttribute('open','');
  await reason.locator('summary').click();
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());
  await toggle.uncheck();await toggle.check();
  await page.evaluate(()=>document.getElementById('appearance-dialog').close());
  await expect(reason).not.toHaveAttribute('open','');
});

test('reasoning starts expanded, preserves manual collapse and bounds detail loading',async({page})=>{
  await prepare(page);
  const reason=page.locator('#messages [data-key=reason]'),tool=page.locator('#messages [data-key=tool]');
  await expect(reason).toHaveAttribute('open','');await expect(tool).not.toHaveAttribute('open','');
  await expect(reason.locator('pre')).toHaveText('추론 요약 전체 내용');
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(1);
  await reason.locator('summary').click();await expect(reason).not.toHaveAttribute('open','');
  await page.evaluate(()=>{
    const f=sendControlsFixture;f.reason={...f.reason,text:'갱신된 요약 앞부분',version:2};
    chatTimeline.apply({...f.page(),sequence:2});
  });
  await expect(reason).not.toHaveAttribute('open','');
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(1);
  await reason.locator('summary').click();await expect(reason.locator('pre')).toHaveText('추론 요약 전체 내용');
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(2);
  await page.evaluate(()=>{
    const f=sendControlsFixture;chatTimeline.setVisibility({showReasoning:false});
    chatTimeline.apply({...f.page(),sequence:3,rows:[{...f.reason,key:'hidden-reason',order:3}]});
  });
  await expect(page.locator('#messages [data-key=hidden-reason]')).toBeHidden();
  // 숨겨진 추론이나 잘리지 않은 요약은 기본 펼침만으로 상세 요청을 늘리지 않는다.
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(2);
  await page.evaluate(()=>{
    const f=sendControlsFixture;chatTimeline.setVisibility({showReasoning:true});
    chatTimeline.apply({...f.page(),sequence:4,rows:[{...f.reason,key:'short-reason',order:4,truncated:false,text:'짧은 요약'}]});
  });
  await expect(page.locator('#messages [data-key=short-reason]')).toHaveAttribute('open','');
  expect(await page.evaluate(()=>sendControlsFixture.details.length)).toBe(2);
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
