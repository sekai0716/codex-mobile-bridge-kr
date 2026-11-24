'use strict';
const {test,expect}=require('@playwright/test');

test.use({locale:'ko-KR'});

test.beforeEach(async({context,request,baseURL})=>{
 await context.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 expect(await(await request.get('/__fixture_health')).json()).toEqual({fixture:'cmb-browser-regression'});
});
test('merged controls send queue and steer through the real submit handler and stop without clearing a draft', async ({
  page,
}) => {
  await page.goto('/?case=success');
  await expect(page.locator('#bootstrap-status')).toBeHidden();
  await page.waitForFunction(() => typeof DesktopSessionsView === 'function');
  await page.evaluate(async () => {
    BridgeI18n.setLanguage('zh');
    const root = document.createElement('div');
    root.id = 'merged-live';
    root.className = 'app';
    root.style.cssText = 'position:fixed;inset:0;background:var(--page);z-index:10';
    document.body.append(root);
    const fixture = (window.mergedLive = { writes: [], status: 'active' });
    const detail = () => ({
      connected: true,
      session: {
        id: 'merged-test',
        title: '合并按钮验证',
        backend: 'code',
        status: fixture.status,
        capabilities: {
          send: true,
          queue: true,
          steer: true,
          stop: true,
          attachments: true,
          projectReferences: true,
        },
      },
      messages: [],
    });
    const view = (fixture.view = new DesktopSessionsView({
      root,
      select: document.createElement('select'),
      notify() {},
      onSelect() {},
      csrf: () => '',
      onUnauthorized() {},
      request: async (url, body) => {
        if (body) {
          fixture.writes.push({ url, body });
          if (url.includes('/stop')) fixture.status = 'idle';
          return { status: url.includes('/send') && body.mode === 'queue' ? 'queued' : 'accepted' };
        }
        if (url.includes('/detail')) return detail();
        if (url.includes('/workspace')) return { entries: [], total: 0, project: '/fixture' };
        return { sessions: [detail().session] };
      },
    }));
    await view.choose('claude');
    await view.open('merged-test');
    clearTimeout(view.timer);
  });
  const root = page.locator('#merged-live .ds-composer'),
    input = root.locator('textarea'),
    send = root.locator('button[type=submit]'),
    caret = root.locator('.composer-submit-caret'),
    menu = page.locator('.composer-submit-menu[open]');
  await expect(root.locator('.composer-submit-stop')).toBeVisible();
  await expect(caret).toBeHidden();
  await input.fill('完成后执行');
  await expect(send).toContainText('排队');
  await send.click();
  await expect.poll(() => page.evaluate(() => mergedLive.writes.length)).toBe(1);
  expect(await page.evaluate(() => mergedLive.writes[0].body.mode)).toBe('queue');
  await expect(input).toHaveValue('');
  await input.fill('补充当前任务');
  await caret.click();
  await menu.locator('[data-send-mode=steer]').click();
  expect(await page.evaluate(() => mergedLive.writes.length)).toBe(1);
  await send.click();
  await expect.poll(() => page.evaluate(() => mergedLive.writes.length)).toBe(2);
  expect(await page.evaluate(() => mergedLive.writes[1].body.mode)).toBe('steer');
  await expect(input).toHaveValue('');
  await input.fill('停止后继续保留');
  await caret.click();
  await menu.locator('.composer-submit-menu-stop').click();
  await expect.poll(() => page.evaluate(() => mergedLive.writes.length)).toBe(3);
  expect(await page.evaluate(() => mergedLive.writes[2].url)).toContain('/stop');
  await expect(input).toHaveValue('停止后继续保留');
  await expect(caret).toBeHidden();
  await expect(send).toContainText('发送');
  await send.click();
  await expect.poll(() => page.evaluate(() => mergedLive.writes.length)).toBe(4);
  expect(await page.evaluate(() => mergedLive.writes[3].body.mode)).toBe('send');
  expect(await page.evaluate(() => mergedLive.view.toolbar.preferences.value.followUpMode)).toBe(
    'steer',
  );
  await page.evaluate(() => {
    const v = mergedLive.view;
    mergedLive.status = 'active';
    v.state.status = 'active';
    v.input.value = '';
    v.attachments.rows = [
      { id: 'reference-test', reference: { path: 'README.md' }, name: 'README.md' },
    ];
    v.updateComposer();
  });
  await expect(caret).toBeVisible();
  await expect(root.locator('.composer-submit-stop')).toBeHidden();
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.attachments.rows = [];
    v.quotes.quotes = [{ text: '只有引用', source: 'assistant' }];
    v.quotes.render();
    v.updateComposer();
  });
  await expect(caret).toBeVisible();
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.quotes.quotes = [];
    v.quotes.render();
    v.updateComposer();
  });
  await expect(caret).toBeHidden();
  await expect(root.locator('.composer-submit-stop')).toBeVisible();
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.input.value = '操作期间保留的草稿';
    v.busy = true;
    v.updateComposer();
  });
  await expect(send).toBeDisabled();
  await expect(send).not.toContainText('正在发送');
  await expect(caret).toBeDisabled();
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.busy = false;
    v.state.capabilities.sendModes = { send: false, queue: false, steer: true };
    v.toolbar.preferences.update({ followUpMode: 'queue' });
    v.updateComposer();
  });
  await expect(send).toContainText('引导');
  expect(await page.evaluate(() => mergedLive.view.mode.value)).toBe('steer');
  expect(await page.evaluate(() => mergedLive.view.toolbar.preferences.value.followUpMode)).toBe('queue');
  await expect(send).toBeEnabled();
  await caret.click();
  await expect(menu.locator('[data-send-mode=queue]')).toBeDisabled();
  await expect(menu.locator('[data-send-mode=steer]')).toBeEnabled();
  expect(
    await page.evaluate(
      () => mergedLive.view.mode.options[0].disabled && mergedLive.view.mode.options[1].disabled,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.state.status = 'idle';
    v.updateComposer();
    v.form.requestSubmit();
  });
  await expect(send).toHaveText('发送');
  await expect(send).toBeDisabled();
  expect(await page.evaluate(() => mergedLive.writes.length)).toBe(4);
  await expect(input).toHaveValue('操作期间保留的草稿');
  await page.evaluate(() => {
    const v = mergedLive.view;
    v.state.status = 'active';
    v.state.capabilities.sendModes = { send: true, queue: true, steer: true };
    v.updateComposer();
  });
  await expect(send).toHaveText('排队');
  expect(await page.evaluate(() => mergedLive.view.mode.value)).toBe('queue');
  await page.evaluate(() => {
    const v=mergedLive.view;
    v.input.value='';v.state.status='idle';v.state.capabilities.stop=true;v.freshDetail=false;
    v.pendingWrites.add({scope:v.writeScope(),action:'send'});v.busy=true;v.stopping=false;v.updateComposer();
  });
  await expect(root.locator('.composer-submit-stop')).toBeVisible({timeout:3000});
  await expect(root.locator('.composer-submit-stop')).toBeEnabled({timeout:3000});
  await page.evaluate(()=>{
    const v=mergedLive.view;v.pendingWrites.clear();v.busy=false;v.freshDetail=true;v.state.status='active';v.stopping=true;v.updateComposer();
  });
  await expect(root.locator('.composer-submit-stop')).toBeDisabled();

});
for(const [provider,backend] of [['claude','code'],['claude','cowork'],['deepseek','desktop']])test(`${provider} ${backend} has immediate, scoped send feedback`,async({page},testInfo)=>{
 await page.goto('/?case=success');await expect(page.locator('#bootstrap-status')).toBeHidden();await page.waitForFunction(()=>typeof DesktopSessionsView==='function');
 await page.evaluate(async({provider,backend})=>{
  await BridgeFeatures.load('chat');document.getElementById('login').hidden=true;
  const root=document.createElement('div');root.className='app';root.id='send-feedback-root';root.style.cssText='position:fixed;inset:0;background:var(--page);z-index:10';document.body.append(root);
  const select=document.createElement('select');['codex','claude','deepseek'].forEach(id=>select.add(new Option(id,id)));
  const fixture=window.sendFeedbackFixture={writes:[],notices:[],finish:null};
  fixture.detail={session:{id:'feedback-test',title:'대화형 인증 보내기',backend,status:'idle',capabilities:{send:true,attachments:true,projectReferences:true}},messages:[{id:'reply',role:'assistant',text:'테스트 메시지를 보낼 수 있습니다。'}],connected:true};
  const view=fixture.view=new DesktopSessionsView({root,select,notify:text=>fixture.notices.push(text),onSelect(){},csrf:()=>'',onUnauthorized(){},request:async(url,body)=>{
   if(body){fixture.writes.push(body);return new Promise(resolve=>fixture.finish=resolve);}
   if(url.includes('/detail'))return fixture.detail;if(url.includes('/workspace'))return {entries:[],total:0,project:'/fixture'};
   return {sessions:[fixture.detail.session]};
  }});
  // 백그라운드 조회도 같은 최신 네이티브 상태를 읽도록 응답 원본을 함께 바꾼다.
  fixture.publish=detail=>{fixture.detail=detail;view.applyDetail(detail);};
  await view.choose(provider);await view.open('feedback-test');clearTimeout(view.timer);
 },{provider,backend});
 const composer=page.locator('#send-feedback-root .ds-composer'),input=composer.locator('textarea'),send=composer.locator('button[type=submit]'),feedback=composer.locator('.ds-send-feedback');
 const message='이 메시지의 전송 상태를 확인하고 아직 어떤 작업도 수행하지 마세요.',nextDraft='다음 초안';
 await input.fill(message);await send.click();
 await expect(feedback).toBeVisible();await expect(feedback.getByRole('status')).toHaveText('전송 중…');await expect(feedback.locator('p')).toHaveText(message);await expect(send).toBeDisabled();
 expect(await page.evaluate(()=>sendFeedbackFixture.notices)).toEqual([]);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await expect(feedback).toBeInViewport();
  expect(await feedback.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`${provider}-${backend}-${theme}-sending.png`)});
 }
 await input.fill(nextDraft);
 await page.evaluate(()=>sendFeedbackFixture.finish({status:'accepted'}));
 await expect(feedback).toBeHidden();await expect(input).toHaveValue(nextDraft);
 await expect.poll(()=>page.evaluate(()=>sendFeedbackFixture.notices)).toEqual(['채팅으로 보냈습니다']);
 await send.click();await expect(feedback).toBeVisible();
 await page.evaluate(()=>sendFeedbackFixture.finish({status:'unknown',message:'확인을 위해 결과 보내기'}));
 await expect(feedback).toBeHidden();await expect(input).toHaveValue(nextDraft);await expect(composer.locator('.error')).toContainText('확인을 위해 결과 보내기');
 expect(await page.evaluate(()=>sendFeedbackFixture.writes.length)).toBe(2);
 expect(await page.evaluate(()=>sendFeedbackFixture.notices.filter(value=>value==='채팅으로 보냈습니다').length)).toBe(1);
 // A successful submission is distinct from ongoing native work. The indicator
 // remains in the real chat timeline and never reuses the send acknowledgement.
 await page.evaluate(()=>{const f=sendFeedbackFixture,v=f.view;f.publish({connected:true,session:{...v.state,status:'active',requests:[]},messages:v.historyMessages});});
 const progress=page.locator('#send-feedback-root .ds-messages .working');
 await expect(progress).toBeVisible();await expect(progress).toContainText('생각 중');
 expect(await progress.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
 await page.screenshot({path:testInfo.outputPath(`${provider}-${backend}-native-working.png`)});
 await page.evaluate(()=>sendFeedbackFixture.view.staleDetail());
 await expect(progress).toContainText('실행 상태를 일시적으로 사용할 수 없습니다.');
 await page.evaluate(()=>{const f=sendFeedbackFixture,v=f.view;f.publish({connected:true,session:{...v.state,status:'idle',requests:[]},messages:v.historyMessages});});
 await expect(progress).toBeHidden();
 const imageId='a'.repeat(64),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XcAAAAASUVORK5CYII=','base64');
 await page.route('**/api/desktop-sessions/*/images/*',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
 await page.evaluate(imageId=>{const f=sendFeedbackFixture;f.publish({connected:true,session:f.view.state,messages:[{id:'history-image',role:'user',text:'',attachments:[{type:'image',name:'photo.png',desktopId:imageId}]}]});},imageId);
 const image=page.locator('#send-feedback-root .attachment-image');await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate(node=>node.naturalWidth)).toBe(1);
 await image.click();await expect(page.locator('#image-preview-dialog')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath(`${provider}-${backend}-history-image.png`)});
 await page.keyboard.press('Escape');await expect(page.locator('#image-preview-dialog')).toBeHidden();
 await page.evaluate(()=>{const f=sendFeedbackFixture;document.documentElement.dataset.showProcess='true';f.publish({connected:true,session:f.view.state,messages:[{id:'context',role:'activity',kind:'context',title:'上下文',text:'项目说明与自动注入内容'}]});});
 const context=page.locator('#send-feedback-root .activity');await expect(context.locator('pre')).toBeHidden();
 await expect(context.locator('summary')).toBeVisible();await context.locator('summary').click();await expect(context.locator('pre')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath(`${provider}-${backend}-context-expanded.png`)});
 await page.evaluate(()=>{const v=sendFeedbackFixture.view;v.workbench.request=async()=>({name:'photo.png',path:'images/photo.png',absolutePath:'/fixture/images/photo.png',size:4,kind:'file'});BridgeFileActions.menu(v.workbench,v.workbench.current,{name:'photo.png',path:'images/photo.png',kind:'file'});});
 await page.getByRole('button',{name:'메시지 내 참조',exact:true}).click();await expect(input).toBeVisible();await expect(input).toHaveValue(nextDraft);await expect(page.locator('#send-feedback-root .attachment-chip')).toContainText('photo.png');
 expect(await page.evaluate(()=>sendFeedbackFixture.writes.length)).toBe(2);
 await page.screenshot({path:testInfo.outputPath(`${provider}-${backend}-project-reference.png`)});
 if(provider==='claude'&&backend==='code'){
  await page.evaluate(()=>{
   window.BridgeUploadSource=()=>true;
   const f=sendFeedbackFixture,v=f.view;
   f.publish({...f.detail,session:{...v.state,cwd:'/fixture'},messages:v.historyMessages});
   v.workbench.request=async()=>({project:'/fixture',entries:Array.from({length:60},(_,i)=>({name:`file-${i}.txt`,path:`file-${i}.txt`,kind:'file',size:10})),nextOffset:null});
  });
  await composer.locator('.attach-button').click();
  await expect(page.locator('.attachment-menu button')).toHaveCount(4);
  await expect(page.locator('.attachment-menu').getByRole('button',{name:'Skill',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'사진 또는 비디오 촬영',exact:true})).toHaveCount(0);
  // Opening the sheet by touch/pointer must not paint a keyboard focus ring
  // on Photos; keyboard navigation still reaches every action.
  expect(await page.locator('.attachment-menu').evaluate(node=>document.activeElement===node)).toBe(true);
  await page.keyboard.press(process.platform==='darwin'&&testInfo.project.name.startsWith('webkit')?'Alt+Tab':'Tab');
  await expect(page.getByRole('button',{name:'사진 라이브러리',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.attachment-menu')).toHaveCount(0);
  await composer.locator('.attach-button').click();
  await page.screenshot({path:testInfo.outputPath('attachment-menu-chat.png')});
  await page.getByRole('button',{name:'호스트 프로젝트 파일 참조',exact:true}).click();
  const picker=page.locator('.host-file-picker'),list=picker.locator('.wb-file-list'),search=picker.getByRole('searchbox');
  await expect(list.locator('.wb-file')).toHaveCount(60);
  const before=await search.boundingBox();
  await list.locator('.wb-file').first().hover();await page.mouse.wheel(0,450);
  await expect.poll(()=>list.evaluate(node=>node.scrollTop)).toBeGreaterThan(100);
  expect((await search.boundingBox()).y).toBe(before.y);
  expect(await picker.evaluate(node=>node.scrollTop)).toBe(0);
  await page.screenshot({path:testInfo.outputPath('host-file-picker-scrolled-chat.png')});
  await page.keyboard.press('Escape');
 }
 await page.evaluate(()=>sendFeedbackFixture.view.clear());
});
