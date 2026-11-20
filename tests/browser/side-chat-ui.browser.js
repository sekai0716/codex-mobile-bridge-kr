// The native child and its independent panel share the same scoped session API.
async function runSideChatTests(){
 const wb=window.BridgeWorkbench,checks=[],check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,10));}throw Error('Native side directory did not settle');};
 const originals={request:wb.request,openChat:wb.openChat,menu:wb.openSessionMenu,confirm:window.confirm,cleanup:wb.temporaryCleanup};
 const calls=[],opened=[],menus=[],parent='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',child='11111111-2222-3333-4444-555555555555';
 let failCreation=true,temporary=false;
 const temporaryId='22222222-3333-4444-5555-666666666666';
 try{
  wb.open(parent,'local');
  wb.openChat=(id,host)=>opened.push({id,host});
  wb.openSessionMenu=(chat)=>menus.push(chat);
  const childWrites=[];let seq=0;
  wb.request=async(url,body,signal)=>{
   const path=new URL(url,location.href),parts=path.pathname.split('/'),id=parts.at(-2),action=parts.at(-1);
   if([child,temporaryId].includes(id)){
    check(path.searchParams.get('host')==='local','Child uses its original host');
    if(action==='send'){childWrites.push({chat:id,...body});return {id:body.id,status:'accepted'};}
    if(action==='changes')await new Promise(resolve=>{const timer=setTimeout(resolve,40);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
    const meta={id,host:'local',connected:true,requests:[],status:'idle',title:'child conversation',access:{canSend:true}};
    const rows=[{key:'child-row',order:1,turnId:'t',role:'assistant',kind:'agentMessage',text:'child live message',version:'one'}];
    if(action==='changes')rows.push({key:'child-reply',order:2,turnId:'t',role:'assistant',kind:'agentMessage',text:'child streamed reply',version:'two'});
    return {meta,sequence:++seq,epoch:'child-epoch',rows,files:[],hasMore:false};
   }
   check(url.includes('/'+parent+'/side-chat?host=local&view=native'),'Directory requests retain exact parent and host');
   calls.push({url,body});
   if(body?.action==='create-temporary'){temporary=true;return{id:temporaryId,host:'local',temporary:true,parentId:parent};}
   if(body?.action==='close'){check(body.id===temporaryId,'Ending is scoped to the temporary child');temporary=false;wb.current=null;return{closed:true};}
   if(body){if(failCreation){failCreation=false;throw Error('Response lost');}return{id:child,host:'local',parentId:parent};}
   return{parentId:parent,chats:[...(temporary?[{id:temporaryId,host:'local',title:'임시 사이드 채팅',temporary:true}]:[]),{id:child,host:'local',title:'네이티브 사이드 채팅',attachedParentId:parent,archived:false},{id:'archived-child',host:'local',title:'보관된 사이드 채팅',archived:true}]};
  };
  document.querySelector('#message').value='parent draft';
  wb.sideChat();let panel=wb.current.files.find(t=>t.id==='sidechat').sideChat;
  await wait(()=>panel.chats);
  check(wb.current.chatId===parent&&wb.current.splitTab==='sidechat'&&(!wb.canSplit()||wb.splitMode),'The directory opens beside the parent as soon as Side chat is selected');
  check(panel.list.querySelectorAll('.wb-side-chat-row').length===2,'Native active and archived children remain discoverable');
  check(!panel.tab.body.querySelector('textarea,form'),'Directory does not maintain a duplicate chat stack');
  panel.list.querySelector('button').click();
  const childTab=wb.current.files.find(t=>t.chatId===child);await wait(()=>childTab.childView?.view);
  check(opened.length===0&&wb.current.chatId===parent&&wb.current.id===parent,'Selecting a child preserves the original parent controller');
  check(wb.current.splitTab===childTab.id&&(!wb.canSplit()||wb.splitMode)&&wb.panel.contains(childTab.body),'A child is mounted on the right when wide and in the selected tab when narrow');
  if(innerWidth>1000){
   const left=document.querySelector('#timeline').getBoundingClientRect(),right=childTab.body.getBoundingClientRect();
   check(wb.splitMode&&left.width>0&&right.width>0&&left.right<=right.left+2,'Desktop keeps the original parent visibly to the left of the child');
  }else check(!wb.splitMode&&wb.isFileVisible,'Narrow screens show the child as an independent tab');
  check(childTab.body.textContent.includes('child live message'),'Native child timeline renders its messages');
  await wait(()=>childTab.body.textContent.includes('child streamed reply'));
  let view=childTab.childView;view.input.value='only for child';view.input.oninput();await view.submit();
  check(childWrites.length===1&&childWrites[0].chat===child&&childWrites[0].text==='only for child'&&document.querySelector('#message').value==='parent draft','Only the native child receives the message and the parent draft survives');
  check(wb.tabs.querySelector('[data-tab="child:'+child+'"] [role=tab]').textContent==='네이티브 사이드 채팅','The child has its own named tab before timeline navigation completes');
  if(!wb.canSplit()){
   await wb.close(childTab.id);
   check(!wb.isFileVisible&&wb.current.active==='chat'&&!opened.length,'Closing the active child returns to the same parent on a small screen');
  }
  panel.list.querySelector('[aria-label="채팅 메뉴"]').click();
  check(menus[0].id===child&&menus[0].attachedParentId===parent,'Child lifecycle uses the shared native session menu');
  wb.select('sidechat');await panel.create();
  check(!panel.createError.hidden&&panel.createError.textContent.includes('Response lost')&&wb.current.active==='sidechat'&&wb.current.chatId===parent,'Creation failure remains in the directory without changing either conversation');
  await panel.create();
  const writes=calls.filter(call=>call.body);
  check(writes.length===2&&writes[0].body.creationId===writes[1].body.creationId,'Unknown create response retries the same durable operation identity');
  check(writes.every(call=>call.body.action==='create'),'No hidden send, stop, archive or delete mutation');
  check(wb.current.active==='child:'+child&&!opened.length,'Creation selects the returned native child in its own pane');
  const beforeClose=calls.length;
  await wb.close('sidechat');
  check(calls.length===beforeClose,'Closing the directory sends no lifecycle mutation');
  check(document.querySelector('#message').value==='parent draft','Closing the view preserves parent draft');
  wb.sideChat();panel=wb.current.files.find(t=>t.id==='sidechat').sideChat;await wait(()=>panel.chats);
  check(panel.chats[0].id===child,'Reopening discovers the same persistent child');
  await wb.close('sidechat');
  await wb.close('child:'+child);
  check(wb.current.id===parent&&wb.current.chatId===parent&&!opened.length,'Closing the child does not navigate the parent or destroy its draft');
  check(calls.filter(call=>call.body).length===2,'Leaving a child never stops or destroys its history');
  wb.open(parent,'local');wb.sideChat();await wait(()=>wb.current.files.find(t=>t.id==='sidechat').sideChat.chats);
  panel=wb.current.files.find(t=>t.id==='sidechat').sideChat;
  await panel.create(true);
  check(wb.current.active==='child:'+temporaryId&&wb.current.chatId===parent,'Temporary child also opens in an independent pane');
  check(!!wb.tabs.querySelector('[data-tab="child:'+temporaryId+'"]'),'A temporary side chat also gets its own tab immediately');
  check(!!panel.list.querySelector('[aria-label="일상적인 채팅 종료"]'),'Temporary lifecycle is explicit');
  window.confirm=()=>true;
  let cleaned=false;
  wb.temporaryCleanup=(id,host)=>{check(id===temporaryId&&host==='local','Cleanup captures original identity before close');return()=>{cleaned=true;};};
  await panel.end(panel.chats.find(chat=>chat.temporary));
  check(cleaned,'Successful close cleans the original scope even after leaving the workspace');
  wb.open(parent,'local');wb.select('sidechat');
  check(!panel.chats.some(chat=>chat.temporary),'Ending removes only the temporary entry');
  check(calls.filter(call=>call.body?.action==='close').length===1,'Ending is submitted exactly once');
  return{checks,passed:checks.length};
 }finally{wb.request=originals.request;wb.openChat=originals.openChat;wb.openSessionMenu=originals.menu;window.confirm=originals.confirm;wb.temporaryCleanup=originals.cleanup;}
}
