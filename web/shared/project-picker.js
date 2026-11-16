'use strict';
// A directory choice is scoped to the environment that opened this dialog.
window.BridgeProjectPicker=(()=>{
  let selection=null,data=null,busy=false,generation=0;
  const node=id=>document.getElementById('folder-picker'+(id?'-'+id:'')),t=value=>BridgeI18n.t(value);
  function controls(){
    node('').querySelectorAll('button,input,select').forEach(item=>item.disabled=busy);
    node('up').disabled=busy||!data?.parent;
    node('select').disabled=busy||!data;
  }
  async function navigate(path=null,name=null){
    if(busy||!selection)return;
    if(selection.isCurrent?.()===false){node('').close();return;}
    const ticket=generation,active=selection;busy=true;controls();node('error').textContent='';
    try{
      const value=await active.request({path,hidden:node('hidden').checked,name,identity:name?data?.identity:null});
      if(ticket!==generation||!node('').open||active.isCurrent?.()===false)return;
      data=value;active.onChange?.(value);node('location').textContent=value.path;
      node('roots').replaceChildren(new Option(t('드라이브 및 파일 시스템'),''),...(value.roots||[]).map(root=>new Option(root.name,root.path)));
      node('list').replaceChildren();
      for(const directory of value.directories||[]){
        const button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span');
        button.type='button';button.className='folder-picker-item';icon.className='project-folder-icon';icon.setAttribute('aria-hidden','true');label.textContent=directory.name;button.append(icon,label);button.onclick=()=>navigate(directory.path);node('list').append(button);
      }
      if(!value.directories?.length){const empty=document.createElement('p');empty.className='muted folder-picker-empty';empty.textContent=t('여기에는 하위 디렉터리가 없습니다.');node('list').append(empty);}
      if(name){node('name').value='';node('new-folder').open=false;}
    }catch(error){if(ticket===generation)node('error').textContent=t(error.message);}
    finally{if(ticket===generation){busy=false;controls();}}
  }
  function choose(options){
    if(busy)return;
    selection=options;data=null;generation++;node('name').value='';node('hidden').checked=false;node('new-folder').open=false;node('list').replaceChildren();node('location').textContent=t('디렉터리 로드 중…');node('environment').textContent=options.environment||'';node('error').textContent='';
    node('').showModal();return navigate(options.path||null);
  }
  function initialize(){
    if(!node(''))return;
    node('home').onclick=()=>navigate(data?.home||null);
    node('up').onclick=()=>data?.parent&&navigate(data.parent);
    node('roots').onchange=()=>node('roots').value&&navigate(node('roots').value);
    node('hidden').onchange=()=>navigate(data?.path||null);
    node('create').onclick=()=>{const name=node('name').value.trim();if(!name){node('error').textContent=t('새 폴더 이름을 입력하세요.');return;}if(data)return navigate(data.path,name);};
    node('name').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();node('create').onclick();}};
    node('select').onclick=()=>{if(!data||busy||selection?.isCurrent?.()===false)return;const chosen=data,callback=selection.onSelect;node('').close();callback(chosen);};
    node('').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    node('').addEventListener('close',()=>{generation++;selection=null;data=null;busy=false;});
  }
  initialize();
  function confirmTrust({path,environment,isCurrent}){
    return new Promise(resolve=>{
      const box=document.createElement('dialog');box.className='picker';
      const add=(tag,text,cls='')=>{const element=document.createElement(tag);element.className=cls;element.textContent=text;box.append(element);return element;};
      add('h2',t('이 작업 공간을 믿으십니까?'));add('p',environment||'','muted');add('p',path);
      add('p',t('이 디렉터리와 원본 클라이언트가 식별한 작업 공간을 신뢰하면 프로젝트 구성을 로드할 수 있습니다. 소스를 알고 있는 프로젝트만 신뢰하세요.'));
      const actions=add('div','','project-picker-actions');let confirmed=false;
      for(const [label,accept] of [['신뢰 확인',true],['취소',false]]){const button=document.createElement('button');button.type='button';button.textContent=t(label);button.onclick=()=>{confirmed=accept&&isCurrent()!==false;box.close();};actions.append(button);}
      box.addEventListener('close',()=>{box.remove();resolve(confirmed);},{once:true});document.body.append(box);box.showModal();
    });
  }
  return {choose,confirmTrust};
})();
