'use strict';
const {test,expect}=require('@playwright/test');
const {readFileSync}=require('node:fs');
const path=require('node:path');

test('native side chat creation keeps the same request after an uncertain response',async({page,context,baseURL})=>{
 const parent='12345678-1234-4234-9234-123456789010',creations=[];
 await context.route('**/*',route=>new URL(route.request().url()).origin===baseURL?route.continue():route.abort());
 await page.route(url=>url.pathname==='/api/sessions/'+parent+'/side-chat',route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{parentId:parent,chats:[]}});
   creations.push(route.request().postDataJSON());
   return route.fulfill({status:409,json:{code:'side_chat_creation_unknown',
     error:'The side chat creation result is unknown. Refresh the side chat list to check.'}});
 });
 await page.goto('/?case=session-menu');
 await page.waitForFunction(()=>document.getElementById('bootstrap-status')?.hidden);
 await page.evaluate(async parent=>{
   await BridgeFeatures.load('chat');BridgeI18n.setLanguage('ko');
   document.getElementById('chat').hidden=false;document.getElementById('welcome').hidden=true;
   document.getElementById('app').classList.add('chat-open');
   BridgeWorkbench.open(parent,'local');BridgeWorkbench.sideChat();
 },parent);
 const panel=page.locator('.workbench-panel'),create=panel.locator('.wb-toolbar button').first();
 await create.click();
 const alert=panel.getByRole('alert');
 await expect(alert).toContainText('생성 결과를 확인하지 못했습니다');
 await page.evaluate(()=>BridgeI18n.setLanguage('en'));
 await expect(alert).toContainText('creation result is unknown');
 await create.click();
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
