'use strict';
const {test,expect}=require('@playwright/test');
const {readFileSync}=require('node:fs');
const path=require('node:path');

test('a failed side chat preflight opens the existing connection settings without restarting',async({page,context,baseURL})=>{
 const parent='12345678-1234-4234-9234-123456789010';
 const setupMessage='No side chat was created. Bridge needs a shared connection to the running Codex desktop. A desktop started with standard input/output cannot share that connection. After all desktop tasks finish, open connection setup in Accounts.';
 const unknownMessage='The side chat creation result is unknown. Refresh the side chat list to check.';
 const creations=[],accountWrites=[];
 await context.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.route(url=>url.pathname==='/api/accounts',route=>route.fulfill({json:{
   accounts:[],activeIds:[],desktopRuntime:{supported:true,configured:true,preparation:{state:'failed'}}}}));
 await page.route(url=>url.pathname==='/api/accounts/desktop-runtime',route=>{accountWrites.push(route.request().method());return route.fulfill({json:{}});});
 await page.route(url=>url.pathname==='/api/sessions/'+parent+'/side-chat',route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{parentId:parent,chats:[]}});
   creations.push(route.request().postDataJSON());
   return route.fulfill({status:409,json:creations.length===1?{code:'side_chat_setup_required',error:setupMessage}
     :{code:'side_chat_creation_unknown',error:unknownMessage}});
 });
 await page.goto('/?case=session-menu');
 await page.waitForFunction(()=>document.getElementById('bootstrap-status')?.hidden);
 await page.evaluate(async parent=>{
   await BridgeFeatures.load('chat');BridgeI18n.setLanguage('ko');
   document.getElementById('chat').hidden=false;document.getElementById('welcome').hidden=true;
   document.getElementById('app').classList.add('chat-open');
   BridgeWorkbench.open(parent,'local');BridgeWorkbench.sideChat();
 },parent);
 const panel=page.locator('.workbench-panel');
 const create=panel.locator('.wb-toolbar button').first();
 await create.click();
 const alert=panel.getByRole('alert');
 await expect(alert).toContainText('표준 입출력(stdio)');
 for(const [language,detail,label] of [['en','standard input/output','Open connection setup'],['zh','标准输入输出','打开连接设置'],['ko','표준 입출력','연결 준비 열기']]){
   await page.evaluate(lang=>BridgeI18n.setLanguage(lang),language);
   await expect(alert).toContainText(detail);
   await expect(alert.getByRole('button',{name:label})).toBeVisible();
 }
 await alert.getByRole('button',{name:'연결 준비 열기'}).click();
 const dialog=page.locator('#accounts-dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('h3:focus')).toBeVisible();
 await expect(dialog.locator('h3:focus')).toContainText('Codex');
 await expect(dialog.getByRole('button',{name:'연결 다시 준비'})).toBeVisible();
 expect(accountWrites).toEqual([]);
 await page.evaluate(()=>document.getElementById('accounts-dialog').close());
 await create.click();
 await expect(alert).toContainText('생성 결과를 확인하지 못했습니다');
 await expect(alert.getByRole('button')).toHaveCount(0);
 expect(creations).toHaveLength(2);expect(creations[1]).toEqual(creations[0]);
});

test('native attached chats use standard identity, navigation and lifecycle',async({page,context,baseURL},testInfo)=>{
 await context.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.goto('/?case=success');
 await page.waitForFunction(()=>document.getElementById('bootstrap-status')?.hidden);
 await page.evaluate(async()=>{
  await BridgeFeatures.load('chat');
  document.getElementById('app').hidden=false;document.getElementById('chat').hidden=false;
  document.getElementById('login').hidden=true;document.getElementById('sessions').hidden=true;
  document.getElementById('app').classList.add('chat-open');document.getElementById('welcome').hidden=true;
  document.getElementById('chat-title').textContent='네이티브 학부모 채팅';BridgeI18n.setLanguage('ko');
 });
 await page.evaluate(readFileSync(path.join(__dirname,'side-chat-ui.browser.js'),'utf8'));
 const result=await page.evaluate(()=>runSideChatTests());
 expect(result.passed).toBeGreaterThanOrEqual(14);
 await expect(page.locator('.wb-side-chat-row')).toHaveCount(2);
 await expect(page.locator('.wb-side-chat-row').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await testInfo.attach('native-side-directory',{body:await page.screenshot(),contentType:'image/png'});
});
