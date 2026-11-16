// Run on the isolated workbench fixture; never against a real user's chat.
async function runWorkbenchSettingsTests(){
 const wb=window.BridgeWorkbench,checks=[],old=BridgeI18n.language();
 const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 const change=value=>{$('phone-language').value=value;$('phone-language').onchange();};
 change('ko');wb.sideChat();const panel=wb.current.files.find(t=>t.id==='sidechat').sideChat;await panel.load();if(!panel.state.id)await panel.create();
 panel.input.value='측면 초안 유지';
 const body=()=>[...$('messages').querySelectorAll('.message-body')].map(n=>n.innerHTML).join('');const content=body(),parentModel=state.model;
 await panel.modelSettings();let dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
 const selectors=dialog.querySelectorAll('select');selectors[0].value='__custom__';selectors[0].dispatchEvent(new Event('change'));dialog.querySelector('input').value='custom-model-draft';
 change('en');
 check(dialog.querySelectorAll('select').length===2,'Changing language preserves model controls');
 check(dialog.querySelector('input').value==='custom-model-draft','Custom model draft survives language change');
 check(panel.input.value==='측면 초안 유지','Side chat draft survives');
 check(body()===content,'Main chat contents survive');
 check(dialog.textContent.includes('Side chat settings'),'Side model dialog switches to English');dialog.close();
 wb.newTab();dialog=document.querySelector('.wb-new-tab');check(!/[\u4e00-\u9fff]/.test(dialog.textContent),'Every New tab choice is English');dialog.close();
 check($('send-mode').selectedOptions[0].textContent==='Send message'&&$('work-mode').options[0].textContent==='Default mode','Send and work mode labels are English');
 const raw=wb.raw(wb.node('span','','파일')),code=wb.node('code','','파일');panel.tab.body.append(raw,code);wb.relabel();check(raw.textContent==='파일'&&code.textContent==='파일','Data resembling a UI label is not translated');raw.remove();code.remove();
 const child=panel.state.id;panel.apply(await panel.request({action:'settings',id:child,model:'fixture-new',effort:'high'}));
 check(panel.state.effort==='high'&&panel.state.model==='fixture-new'&&state.model===parentModel,'Side settings do not alter the parent');
 change('ko');wb.select('chat');wb.select('sidechat');check(wb.tabs.textContent.includes('보조 채팅'),'Tab labels follow language after switching tabs');
 change(old);return [...checks,...await runWorkbenchFileLanguageTests(wb)];
}

async function runWorkbenchFileLanguageTests(wb=window.BridgeWorkbench){
 const checks=[],oldLanguage=BridgeI18n.language(),oldSession=wb.current,oldRequest=wb.request;
 const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 let total=1,session;
 try {
  BridgeI18n.setLanguage('ko');
  wb.request=async()=>({project:'파일',total,entries:total?[{name:'숨겨진 파일',path:'숨겨진 파일',kind:'file',size:10}]:[],nextOffset:null});
  wb.open('__file_language_fixture__','local');session=wb.current;
  const tab={id:'files',name:'파일',body:wb.node('div','wb-browser')};session.files.push(tab);
  await wb.directory(session,tab,'');wb.select('files');
  for(const language of ['en','ko','en']) {
   BridgeI18n.setLanguage(language);wb.relabel();
   check(tab.body.querySelector('label').textContent===(language==='en'?'Hidden files':'숨겨진 파일'),'Hidden files follows '+language);
   check(tab.status.textContent===(language==='en'?'1 items · Local project':'1 개 · 컴퓨터의 프로젝트'),'Directory count follows '+language);
   check(tab.body.querySelector('.wb-path').title===(language==='en'?'This chat’s project directory':'현재 채팅의 프로젝트 디렉토리'),'Project tooltip follows '+language);
   check(tab.body.querySelector('.wb-path').textContent==='파일'&&tab.body.querySelector('.wb-file').title==='숨겨진 파일'&&tab.body.querySelector('.wb-file-name').textContent==='숨겨진 파일','User project and file labels stay unchanged in '+language);
  }
  await wb.directory(session,tab,'찾다');
  for(const language of ['ko','en']) {
   BridgeI18n.setLanguage(language);wb.relabel();
   check(tab.body.querySelector('.wb-path').textContent==='파일 / 찾다'&&tab.body.querySelector('.wb-path').title==='찾다','User directory and tooltip stay unchanged in '+language);
  }
  session.host='fixture-ssh';await wb.directory(session,tab,'');
  BridgeI18n.setLanguage('ko');wb.relabel();check(tab.status.textContent==='1 개 · SSH 프로젝트','SSH directory summary switches to Chinese');
  BridgeI18n.setLanguage('en');wb.relabel();check(tab.status.textContent==='1 items · SSH project','SSH directory summary switches to English');
  total=0;await wb.directory(session,tab,'');
  BridgeI18n.setLanguage('ko');wb.relabel();check(tab.status.textContent==='현재 디렉터리에 일치하는 파일이 없습니다.','Empty directory switches to Chinese');
  BridgeI18n.setLanguage('en');wb.relabel();check(tab.status.textContent==='No matching files in this directory','Empty directory switches to English');
  return checks;
 } finally {
  wb.request=oldRequest;if(session)wb.sessions.delete(session.key);wb.current=oldSession;
  BridgeI18n.setLanguage(oldLanguage);wb.paint();wb.relabel();
 }
}
