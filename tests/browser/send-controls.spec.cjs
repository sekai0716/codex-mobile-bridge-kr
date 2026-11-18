'use strict';
const {test,expect}=require('@playwright/test');

// 실제 페이지와 전송 콜백을 사용하되 모든 채팅 읽기·쓰기는 메모리에서 끝낸다.
async function prepare(page){
  await page.goto('/?case=session-menu');
  await expect(page.locator('#bootstrap-status')).toBeHidden();
  await page.waitForFunction(()=>typeof openChat==='function');
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
      if(path.pathname.endsWith('/changes'))return new Promise((resolve,reject)=>{
        const cancel=()=>reject(new DOMException('aborted','AbortError'));
        options.signal.addEventListener('abort',cancel,{once:true});
        fixture.publish=page=>{options.signal.removeEventListener('abort',cancel);fixture.publish=null;resolve(response(page));};
      });
      if(path.pathname.endsWith('/subagents'))return response({agents:[]});
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

test('live subagent tabs appear without refresh and address only the selected child',async({page})=>{
  await prepare(page);
  await page.locator('#message').fill('부모 초안');
  await page.waitForFunction(()=>sendControlsFixture.publish&&workbench.current.agentDirectories?.size);
  await page.evaluate(()=>{
    const f=sendControlsFixture,original=window.fetch;
    const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    f.children=ids;f.directory=ids.map(id=>({id,parentId:f.meta.id,nickname:'Ada',title:'fixture',path:''}));
    f.agentWrites=[];f.detailReads=[];f.liveText='진행 기록';
    window.fetch=async(url,options={})=>{
      const path=new URL(url,location.origin),reply=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
      if(!path.pathname.includes('/subagents'))return original(url,options);
      const target=path.searchParams.get('id');
      if(path.pathname.endsWith('/send')){
        const body=JSON.parse(options.body);f.agentWrites.push({path:path.pathname,target,body});
        return reply({id:body.id,status:'accepted'});
      }
      if(!target)return reply({agents:f.directory});
      f.detailReads.push(target);
      return reply({id:target,live:true,control:{generation:'owner-1',canSend:true,status:'active',activeTurnId:'current-'+target},
        historyComplete:true,turns:[{id:'turn',messages:[{id:'m',role:'assistant',text:target+' '+f.liveText}]}]});
    };
    f.extraRows=ids.map((id,i)=>({key:'child-'+id,kind:'subAgentCreated',role:'activity',agent:{id,nickname:'',taskName:'task'+i},order:3+i,version:'v1'}));
    f.meta.status='active';f.publish({...f.page(),sequence:2});
  });
  const buttons=page.getByRole('button',{name:'Ada 에이전트 생성됨',exact:true});
  const tabs=page.getByRole('tab',{name:'Ada',exact:true}),main=page.getByRole('tab',{name:'채팅',exact:true});
  await expect(tabs).toHaveCount(2);await expect(buttons).toHaveCount(2);
  await expect(main).toHaveAttribute('aria-selected','true');await expect(page.locator('#message')).toBeFocused();
  expect(await page.evaluate(()=>sendControlsFixture.detailReads)).toEqual([]);
  for(const n of [0,1]){
    if(n===0)await buttons.first().click();else await tabs.nth(1).click();
    const id=await page.evaluate(n=>sendControlsFixture.children[n],n),view=page.locator('.wb-agent-view');
    await expect(tabs.nth(n)).toHaveAttribute('aria-selected','true');
    await expect(page.locator('.wb-float')).toHaveCount(0);
    await expect(view.locator('.message-body')).toContainText(id);
    if(n===0)await view.getByRole('textbox').fill('첫 번째 에이전트 초안');
    if(n===1){
      await view.getByRole('textbox').fill('자식에게만 전송');
      await page.evaluate(()=>sendControlsFixture.liveText='추가된 실시간 응답');
      await expect(view.locator('.message-body')).toContainText('추가된 실시간 응답');
      await expect(view.getByRole('textbox')).toHaveValue('자식에게만 전송');
      await view.getByRole('button',{name:'보내기',exact:true}).click();await expect(view.getByRole('textbox')).toHaveValue('');
      const [sent]=await page.evaluate(()=>sendControlsFixture.agentWrites);
      expect(sent.target).toBe(id);expect(sent.body.expectedTurnId).toBe('current-'+id);
      expect(sent.path).toBe('/api/sessions/11111111-1111-4111-8111-111111111111/subagents/send');
    }
    await main.click();
  }
  await expect(page.locator('#message')).toHaveValue('부모 초안');
  await tabs.first().click();await expect(page.locator('.wb-agent-compose textarea')).toHaveValue('첫 번째 에이전트 초안');
  await page.locator('.wb-tab.selected').getByRole('button',{name:'닫기'}).click();
  await page.evaluate(()=>{
    const f=sendControlsFixture;f.directory.push({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',parentId:f.meta.id,nickname:'Grace'});
  });
  await expect(page.getByRole('tab',{name:'Grace'})).toBeVisible({timeout:12000});
  await expect(tabs).toHaveCount(1);await expect(main).toHaveAttribute('aria-selected','true');
  await buttons.first().click();await expect(tabs).toHaveCount(2);
  await expect(page.locator('.wb-agent-compose textarea')).toHaveValue('첫 번째 에이전트 초안');
  await main.click();await expect(page.locator('#message')).toHaveValue('부모 초안');
});

test('side chats use individual tabs and still discover agents from the parent chat',async({page})=>{
  await prepare(page);
  await page.waitForFunction(()=>workbench.current.agentDirectories?.size);
  await page.evaluate(()=>{
    const f=sendControlsFixture,original=window.fetch;
    const parent=f.meta.id,host='local',reply=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
    const one={id:'10000000-0000-4000-8000-000000000001',title:'자료 확인',attachedParentId:parent,host};
    const two={id:'10000000-0000-4000-8000-000000000002',title:'일정 확인',attachedParentId:parent,host};
    f.sides=[one];f.rootAgents=[];
    window.fetch=async(url,options={})=>{
      const path=new URL(url,location.origin),id=path.pathname.split('/')[3];
      if(path.pathname.endsWith('/side-chat')){
        if(options.body){f.sides.push(two);return reply({id:two.id,host,parentId:parent});}
        return reply({parentId:parent,chats:f.sides});
      }
      if(path.pathname.endsWith('/subagents'))return reply({agents:id===parent?f.rootAgents:[]});
      const child=f.sides.find(chat=>chat.id===id);
      if(child&&path.pathname.endsWith('/timeline')){
        const attachedParent={id:parent,host,available:true};
        return reply({...f.page(),rows:[],meta:{...f.meta,...child,attachedParent}});
      }
      return original(url,options);
    };
  });
  const input=page.locator('#message'),main=page.getByRole('tab',{name:'채팅',exact:true});
  await input.fill('부모 초안');
  await page.locator('#chat .wb-add').click();
  await page.locator('.wb-new-tab').getByRole('button',{name:'사이드 채팅',exact:true}).click();
  await expect(page.locator('.wb-side-chat-row')).toHaveCount(1);
  await page.evaluate(()=>sendControlsFixture.rootAgents.push({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',parentId:sendControlsFixture.meta.id,nickname:'Eve'}));
  await page.getByRole('button',{name:'자료 확인',exact:true}).click();
  const first=page.getByRole('tab',{name:'자료 확인',exact:true});
  await expect(first).toHaveAttribute('aria-selected','true');await expect(page.locator('#chat-title')).toHaveText('자료 확인');await input.fill('사이드 초안');
  await expect(page.getByRole('tab',{name:'Eve',exact:true})).toBeVisible();
  await expect(first).toHaveAttribute('aria-selected','true');
  await page.locator('.wb-tab[data-tab=sidechat] [role=tab]').click();
  await page.locator('.wb-side-content .wb-toolbar button').first().click();
  await expect(page.getByRole('tab',{name:'일정 확인',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#chat-title')).toHaveText('일정 확인');
  await expect(input).toHaveValue('');await first.click();await expect(input).toHaveValue('사이드 초안');
  await main.click();await expect(input).toHaveValue('부모 초안');await expect(page.locator('.wb-float')).toHaveCount(0);
});

test('completed edit card wraps the selected file diff and keeps its original line numbers',async({page})=>{
  await prepare(page);
  const removedLine = '-\tconst url = "https://example.test/' + 'a'.repeat(160) + '";';
  await page.evaluate(removedLine=>{
    const f=sendControlsFixture,original=window.fetch;f.patchReads=[];
    window.fetch=async(url,options)=>{
      const path=new URL(url,location.origin);if(!path.searchParams.has('file'))return original(url,options);
      const file=Number(path.searchParams.get('file')),offset=Number(path.searchParams.get('offset'));
      const first='@@ -3 +8,2 @@\n'+removedLine+'\n+새',data={fileIndex:file,key:'footer',version:'patch',offset,
        text:offset?' 줄\n+<b>literal</b>\n':first,next:offset?null:[...first].length};
      f.patchReads.push({file,offset});return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
    };
    const files=['src/one.js','src/two.js','a','b'].map(path=>({path,added:2,removed:1,hasDiff:true}));
    f.extraRows=[{key:'footer',order:4,turnId:'t',role:'fileChanges',kind:'fileChanges',version:'patch',fileSummary:{count:4,added:8,removed:4,basis:'recorded',files}}];
    chatTimeline.apply(f.page(),true);
  },removedLine);
  const card=page.locator('.edited-files-card');await card.locator(':scope > summary').click();
  expect(await page.evaluate(()=>sendControlsFixture.patchReads.length)).toBe(0);
  await expect(card.getByText('파일 1개 더 보기')).toBeVisible();await card.getByText('파일 1개 더 보기').click();
  const file=card.locator('.turn-diff-file').nth(1);await file.locator('summary').click();
  expect(await file.locator('.removed code').textContent()).toBe(removedLine);
  await expect(file.locator('.removed .wb-diff-number')).toHaveText('3');
  await file.getByRole('button',{name:'변경 내용 더 보기'}).click();
  await expect(file.locator('.added code')).toHaveText(['+새 줄','+<b>literal</b>']);
  await expect(file.locator('.added .wb-diff-number')).toHaveText(['8','9']);
  await expect(file.getByRole('button',{name:'파일 열기'})).toBeVisible();
  expect(await page.evaluate(()=>sendControlsFixture.patchReads.map(x=>x.file))).toEqual([1,1]);
  expect(await card.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);

  const diff = file.locator('.turn-diff-lines');
  const visualLines = [];
  for (const viewport of [{width:320,height:740}, {width:844,height:390}, {width:1280,height:900}]) {
    await page.setViewportSize(viewport);
    const layout = await diff.evaluate(view => {
      const range = document.createRange();
      range.selectNodeContents(view.querySelector('.removed code'));
      const tops = Array.from(range.getClientRects(), rect => rect.top);
      return {fits: view.scrollWidth <= view.clientWidth + 1, lines: new Set(tops).size};
    });
    expect(layout.fits).toBe(true);
    visualLines.push(layout.lines);
  }
  expect(visualLines[0]).toBeGreaterThan(visualLines[2]);
  await expect(file.locator('.removed .wb-diff-number')).toHaveText('3');
});
test.afterEach(async({page})=>{await page.evaluate(()=>chatTimeline?.dispose()).catch(()=>{});});

test('desktop chat width is a saved maximum for the current pane', async ({page}) => {
  await page.setViewportSize({width:3840,height:1000});
  await prepare(page);
  await page.evaluate(()=>{
    const fixture=sendControlsFixture;
    const path='/fixture/width.html', file={id:'a'.repeat(64),name:'width.html',reference:path,references:[path],visualization:true};
    const marker='\ue200visualize\ue202'+JSON.stringify({path,mode:'wide',title:'Width fixture'})+'\ue201';
    fixture.extraRows=[
      {key:'visual',order:3,role:'assistant',kind:'agentMessage',text:marker,version:1},
      {key:'footer',order:4,role:'fileChanges',kind:'fileChanges',version:1,fileSummary:{count:1,added:1,removed:0,basis:'recorded',files:[{path:'file.txt',added:1,removed:0,hasDiff:false}]}}
    ];
    chatTimeline.apply({...fixture.page(),files:[file]},true);
  });
  await expect(page.locator('#messages .visualize-card')).toBeVisible();
  await page.locator('#message').fill('작성 중인 초안');
  const selector=page.locator('#appearance-chat-width');
  async function choose(value) {
    await page.locator('[data-open-appearance]:visible').first().click();
    await selector.selectOption(value);
    await page.locator('#appearance-dialog button[data-close].primary').click();
  }
  async function checkWidth(cap) {
    const sizes=await page.evaluate(()=>{
      const width=selector=>document.querySelector(selector).getBoundingClientRect().width;
      return {pane:width('#chat .wb-main-pane'),content:[
        width('#messages'),width('#messages .visualize-card'),width('#messages .edited-files-card'),width('#composer')
      ]};
    });
    expect(sizes.pane).toBeGreaterThan(0);
    const expected=Math.min(cap,sizes.pane);
    for (const actual of sizes.content) expect(Math.abs(actual-expected)).toBeLessThanOrEqual(2);
  }
  await expect(selector).toHaveValue('normal');
  await checkWidth(1040);
  for (const [value,cap] of [['narrow',760],['wide',1320],['full',Infinity],['normal',1040]]) {
    await choose(value);
    await checkWidth(cap);
  }
  await page.setViewportSize({width:1200,height:900});
  await checkWidth(1040);
  await page.setViewportSize({width:2240,height:900});
  await page.evaluate(()=>{const wb=window.BridgeWorkbench;wb.files();wb.split('files');wb.setRatio(.4);});
  await expect(page.locator('#chat')).toHaveClass(/wb-split/);
  await checkWidth(1040);
  await page.evaluate(()=>window.BridgeWorkbench.setRatio(.7));
  await checkWidth(1040);
  await choose('wide');
  await checkWidth(1320);
  await expect(page.locator('#message')).toHaveValue('작성 중인 초안');
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.chatWidth==='wide');
  await expect(selector).toHaveValue('wide');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.getElementById('appearance-dialog').showModal());
  await expect(page.locator('#appearance-dialog')).toBeVisible();
  await expect(page.locator('#chat-width-setting')).toBeHidden();
  await page.setViewportSize({width:1800,height:900});
  await expect(page.locator('#chat-width-setting')).toBeVisible();
  await page.evaluate(()=>document.documentElement.classList.add('bridge-mobile'));
  await expect(page.locator('#chat-width-setting')).toBeHidden();
});

for (const theme of ['dark','light']) {
  test('dragged text quote button has readable contrast in '+theme+' mode', async ({page}, testInfo) => {
    await page.emulateMedia({colorScheme:theme});
    await prepare(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    const text = 'Selection for a quote';
    await page.evaluate(text => {
      const fixture = sendControlsFixture;
      fixture.extraRows = [{key:'quote-target',order:3,role:'assistant',kind:'agentMessage',text,version:1}];
      chatTimeline.apply(fixture.page(),true);
    },text);
    const message = page.locator('#messages .message-body').getByText(text,{exact:true});
    await message.scrollIntoViewIfNeeded();
    const box = await message.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const {left,right,top,height} = range.getBoundingClientRect();
      return {left,right,y:top+height/2};
    });
    await page.mouse.move(box.left+1,box.y);
    await page.mouse.down();
    await page.mouse.move(box.right-1,box.y,{steps:10});
    await page.mouse.up();
    const button = page.locator('#composer .composer-quote-selection');
    await expect(button).toBeVisible();
    const contrast = await button.evaluate(element => {
      const luminance = rgb => {
        const [r,g,b] = rgb.match(/\d+/g).map(Number).map(channel => channel/255)
          .map(value => value<=0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4);
        return 0.2126*r + 0.7152*g + 0.0722*b;
      };
      const {color,backgroundColor} = getComputedStyle(element);
      const fg = luminance(color), bg = luminance(backgroundColor);
      return (Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);
    });
    await testInfo.attach('contrast',{body:contrast.toFixed(2),contentType:'text/plain'});
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await button.click();
    await expect(page.locator('#composer .composer-quote summary')).toHaveText(text);
  });
}

test('desktop composer mode menus fit above compact controls and keep keyboard selection',async({page},testInfo)=>{
  await page.setViewportSize({width:2350,height:460});await prepare(page);
  await page.locator('[data-open-appearance]:visible').first().click();
  await page.locator('#appearance-chat-width').selectOption('full');
  await page.locator('#appearance-dialog button[data-close].primary').click();
  const send=page.locator('#send-mode'),work=page.locator('#work-mode'),menu=page.locator('#composer-mode-options');
  const fields=[send,work];
  for(const field of fields){
    const box=await field.boundingBox();expect(box.width).toBeLessThan(180);
    await field.click();await expect(menu).toBeVisible();
    const popup=await menu.boundingBox();expect(popup.y).toBeGreaterThanOrEqual(0);
    expect(popup.y+popup.height).toBeLessThanOrEqual(box.y);expect(popup.x+popup.width).toBeLessThanOrEqual(2350);
    await expect(menu.getByRole('option').last()).toBeInViewport();
    await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(field).toBeFocused();
  }
  await send.click();await expect(menu.getByRole('option').last()).toBeDisabled();await page.locator('#message').click();
  await expect(menu).toHaveCount(0);
  await work.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(work).toHaveValue('plan');
  await page.evaluate(()=>sendControlsFixture.update('active'));
  await send.click();await menu.getByRole('option').last().click();await expect(send).toHaveValue('steer');
  await expect(work).toBeDisabled();
  const corners=page.locator('#composer .composer-tools .tool-button:visible');
  expect(await corners.count()).toBeGreaterThanOrEqual(5);
  expect(await corners.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).borderRadius==='9px'))).toBe(true);
  await expect(page.locator('#composer .context-usage-ring')).toHaveCSS('border-radius','50%');
  await send.click();await testInfo.attach('desktop-modes',{body:await page.screenshot(),contentType:'image/png'});
  await page.setViewportSize({width:390,height:844});await expect(menu).toHaveCount(0);
  expect(await send.evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(40);
});

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
