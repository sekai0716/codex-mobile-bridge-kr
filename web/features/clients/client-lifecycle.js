'use strict';
// One identity for navigation, drafts and operations; family only selects a protocol.
const ClientIdentity=(()=>{
  const entry=id=>typeof id==='string'&&/^(claude|deepseek):[0-9a-f]{32}$/.test(id);
  const family=id=>entry(id)?id.split(':')[0]:typeof id==='string'&&/^wsl-claude:[0-9a-f]{32}$/.test(id)?'claude':typeof id==='string'&&/^(codex|wsl):[0-9a-f]{32}$/.test(id)?'codex':id;
  const desktop=id=>entry(id)||['claude','deepseek','zcode','antigravity'].includes(id);
  function path(id,action,sessionId=null,extra={}){
    if(!desktop(id))throw Error('알 수 없는 클라이언트 액세스');
    const query=new URLSearchParams(extra);
    if(sessionId)query.set('sessionId',sessionId);
    if(entry(id))query.set('entry',id);
    return '/api/desktop-sessions/'+family(id)+'/'+action+(query.toString()?'?'+query:'');
  }
  return {entry,family,desktop,path};
})();
const ClientLifecycle=(()=>{
  let sequence=0;
  function connectionModes(client){return Array.isArray(client?.connectionModes)?client.connectionModes.filter(mode=>typeof mode?.id==='string'&&mode.id&&typeof mode.label==='string'):[];}
  function connectionModeLabel(client){return connectionModes(client).find(mode=>mode.id===client.connectionMode)?.label||'';}
  function connection(client={}){
    const stage=client.connectionState,setup=client.setupStatus;
    const waiting=['starting','connecting'].includes(stage)||(!stage&&['starting','connecting'].includes(setup))||
      (client.initializationMode!=='background'&&['needs-screen-saver','needs-unlock','needs-desktop'].includes(setup));
    const background=client.backgroundRunning&&client.mainRunning===false,ready=client.connected===true||setup==='session-access'||client.pipeReady===true;
    let label,reason=client.reason||'',pending=false,action=false;
    if(setup==='recovery-required'||(background&&!waiting&&!client.pendingEnable))label=background?'백그라운드에서 실행 중입니다. 데스크톱이 닫혔습니다.':'연결 복구 필요';
    else if(ready)label='연결됨';
    else if(client.pendingEnable){const wsl=['wsl-cli','wsl-claude-cli'].includes(client.kind);label=wsl?'연결 중입니다. 잠시 기다려 주세요…':'앱을 시작하는 중…';reason=wsl?'WSL를 시작하고 연결 설정을 읽는 중입니다.':'클라이언트가 연결되기를 기다리고 있습니다. 준비되면 채팅이 자동으로 나타납니다.';pending=true;}
    else if(waiting){label=({'needs-screen-saver':'화면 보호기가 끝날 때까지 기다리는 중','needs-unlock':'잠금 해제를 기다리는 중','needs-desktop':'데스크탑을 기다리고 있어요'})[setup]||
      (stage==='starting'?'앱을 시작하는 중…':'연결 중입니다. 잠시 기다려 주세요…');pending=true;}
    else{
      label=({'needs-unlock':'컴퓨터가 잠겼습니다.','needs-desktop':'컴퓨터 데스크톱을 사용할 수 없음'})[setup]||({'error':'연결 실패','timeout':'연결 시간이 초과되었습니다.','needs-initialization':'연결 초기화 필요'})[stage]
        ||({'history-only':'로컬 기록(읽기 전용)','unsupported':'자동 액세스를 사용할 수 없습니다.','needs-initialization':'연결 초기화 필요','needs-first-launch':'초기 설정 필요','restart-required':'다시 시작해야 함','needs-permission':'권한이 필요합니다','needs-developer-mode':'개발자 모드 확인 필요','needs-trust':'디렉터리 신뢰가 필요함','owner-conflict':'다른 게이트웨이에서 사용하는 연결','cancelled':'연결이 취소되었습니다.','failed':'연결 실패','needs-retry':'연결 실패'})[setup];
      action=!!label;
      if(['wsl-cli','wsl-claude-cli'].includes(client.kind)){
        label=label||(client.distributionRunning===false?'WSL가 중지되었습니다.':client.distributionRunning===true?'WSL가 실행 중입니다. 연결 대기 중':'WSL 상태가 확인되지 않았습니다.');
        if(client.distributionRunning==null)reason='WSL 상태를 확인할 수 없습니다. 새로고침하고 다시 시도하세요.';
      }else label=label||(client.installed===false?(client.cliAvailable?'CLI 사용 가능':'설치되지 않음'):client.running===true?'앱 실행 중; 연결되지 않음':client.running===false?'앱이 실행되지 않음':'연결되지 않음');
    }
    const canStartDesktop=client.id==='claude'&&client.canStartDesktop===true&&!client.connected&&!pending;
    const canReconnect=client.id==='claude'&&client.canReconnect===true&&client.reconnectSupported===true&&!client.connected&&!pending&&!['recovery-required','restart-required'].includes(setup);
    const pipe=client.id==='zcode'&&client.pipeSupported===true;
    const canInitialize=client.id==='zcode'
      ?pipe&&client.canInitializeDesktop===true&&client.installed!==false&&!ready&&!pending
      :client.id==='claude'&&!canStartDesktop&&client.enabled&&client.installed!==false&&!client.connected&&!pending&&(['needs-initialization','needs-retry','needs-developer-mode','needs-trust','needs-permission','needs-unlock','needs-desktop','cancelled','failed'].includes(setup)||stage==='needs-initialization'||client.canInitializeDesktop===true&&!canReconnect);
    const initializeLabel=canReconnect?'연결 다시 초기화':'연결 초기화';
    const retryable=client.retryable===true&&client.enabled&&!ready&&!pending&&!canInitialize&&!canReconnect&&!canStartDesktop&&!['recovery-required','restart-required'].includes(setup);
    const canConnectWsl=['wsl-cli','wsl-claude-cli'].includes(client.kind)&&client.enabled===true&&!ready&&!pending&&client.distributionRunning!==true;
    return {label,modeLabel:connectionModeLabel(client),reason,ready,waiting:pending,action:action||setup==='recovery-required',retryable:!!retryable,canReconnect:!!canReconnect,canInitialize:!!canInitialize,initializeLabel,canStartDesktop:!!canStartDesktop,canConnectWsl,error:!pending&&!ready&&(['error','timeout'].includes(stage)||setup==='failed')};
  }
  function connectWsl(client,operation,options){
    if(!connection(client).canConnectWsl)return Promise.resolve();
    const payload={provider:client.kind==='wsl-claude-cli'?'claude':'codex',entry:client.id,action:'connect'};
    return request(signal=>operation(payload,signal),options);
  }
  function request(operation,{timeout=45000,uncertain=true,message='작업 결과가 확인되지 않았습니다. 다시 시도하기 전에 상태를 새로고침하세요.'}={}){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;let timer;
    return new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{reject(Object.assign(Error(message),{uncertain}));controller?.abort();},timeout);
      try{Promise.resolve(operation(controller?.signal)).then(resolve,reject);}catch(error){reject(error);}
    }).finally(()=>clearTimeout(timer));
  }
  function failure(action,error,transport='web'){
    const uncertain=!!error.uncertain||(transport==='web'?!(error.status>=400&&error.status<500):/로컬 작업 시간이 초과되었습니다.|로컬 관리 프로세스가 종료되었습니다.|현지 관리가 종료되었습니다\./.test(error.message));
    return {action,message:error.message,uncertain};
  }
  function failureMessage(value){return value.uncertain?'작업 결과가 확인되지 않았습니다. 다시 시도하기 전에 상태를 새로고침하세요.':value.message;}
  function retryLabel(action){return ({enable:'다시 시작해 보세요.',quit:'종료 다시 시도',force:'백그라운드 강제 종료 재시도',disable:'비활성화 다시 시도',initialize:'초기화 재시도','connect-wsl':'WSL 시작 및 연결'})[action]||'재시도 작업';}
  function reconcile(failures,clients){
    for(const [id,value] of failures||[]){
      if(!value.uncertain)continue;const client=clients.find(row=>row.id===id);
      if(value.action==='connect-wsl'){
        if(client?.distributionRunning===true)failures.delete(id);
        else if(client?.distributionRunning===false)failures.set(id,{...value,uncertain:false,message:'WSL가 중지되었습니다.'});
        continue; // Unknown WSL status cannot authorize another start attempt.
      }
      const ready=client&&(client.connected||client.setupStatus==='session-access');
      const initialized=id==='zcode'?value.connectionMode==='private-pipe'&&(client?.pipeReady===true||ready&&client.pipeSupported===true):client&&(client.connected||connection(client).waiting);
      const completed=client&&(['quit','force'].includes(value.action)?client.enabled===false&&client.running===false:value.action==='disable'?client.enabled===false:value.action==='initialize'?initialized:value.action==='enable'?(!value.connectionMode||client.connectionMode===value.connectionMode)&&client.enabled&&(client.running||client.connected||connection(client).waiting):false);
      if(completed)failures.delete(id);else failures.set(id,{...value,uncertain:false,message:client?.reason||'상태가 새로 고쳐졌습니다. 이전 작업을 다시 시도할 수 있습니다.'});
    }
  }
  function sessionNotice(session){return session?.state==='locked'?'컴퓨터가 잠겨 있습니다. 백그라운드 서비스는 계속 실행됩니다. 데스크톱 상호 작용이 필요한 작업을 다시 시도하기 전에 잠금을 해제하세요.':session&&session.interactive!==true?'대화형 데스크탑을 사용할 수 없습니다. 백그라운드 서비스는 계속 실행됩니다. 데스크탑을 복원한 후 다시 시도하십시오.':'';}
  async function chooseInitialize(client){
    const mode=client.id==='zcode'&&client.pipeSupported===true?'private-pipe':'';
    if(client.id==='zcode'&&!mode)return false;
    let accepted=await initializeDialog(client,mode);
    if(!accepted)return false;
    if(mode&&client.running&&client.confirmTaskState){
      accepted=await confirmQuit(client,false,true);
      if(!accepted)return false;
    }
    return mode==='private-pipe'?{connectionMode:mode,acknowledgeUnavailable:accepted==='recovery'}:accepted;
  }
  function initializationFields(choice){
    if(!choice)return {};
    return {initializeDesktop:true,...(choice.connectionMode==='private-pipe'?{connectionMode:'private-pipe'}:{}),
      ...(choice==='recovery'||choice.acknowledgeUnavailable===true?{acknowledgeUnavailable:true}:{})};
  }
  function initializeDialog(client,mode){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2','연결 초기화');
      const description=node('p',mode==='private-pipe'?'게이트웨이는 로컬 전용 파이프로 ZCode에 연결합니다. 컴퓨터가 잠겨 있어도 기존 채팅을 이어갈 수 있습니다.'
        :client.initializationMode==='background'?'Windows에서는 백그라운드 초기화가 먼저 시도되며 키보드 포커스가 필요하지 않습니다. 개발자 도구가 잠시 나타날 수 있습니다. 사용할 수 없는 경우 데스크탑이 대화형일 때만 전경 설정이 시도됩니다.'
        :'Claude 및 해당 개발자 도구가 컴퓨터에서 열리고 키보드 포커스를 사용하여 연결을 완료합니다. 화면 보호기나 잠금 화면이 나타나면 바탕 화면으로 돌아가서 계속하세요.');
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-initialize-'+(++sequence);title.id=id+'-title';description.id=id+'-description';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=false;
      const finish=value=>{choice=value;dialog.close();};
      const start=node('button','초기화 시작'),cancel=node('button','취소');start.type=cancel.type='button';start.onclick=()=>finish(true);cancel.onclick=()=>finish(false);actions.append(start);
      actions.append(cancel);dialog.append(title,identity,description);
      if(mode&&client.running)dialog.append(node('p','게이트웨이가 실행 중인 ZCode 앱에 연결할 수 없는 경우 정상적으로 ZCode를 종료하고 다시 시작하려고 시도합니다. 감지된 활성 작업으로 인해 다시 시작되지 않습니다.'));
      dialog.append(actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  function mountConnectionModes(root){
    const field=document.createElement('fieldset'),title=document.createElement('legend'),options=document.createElement('div'),note=document.createElement('p');
    field.className='client-connection-methods';title.textContent=BridgeI18n.t('사이');options.className='client-connection-options';note.className='account-muted';note.setAttribute('role','status');field.append(title,options,note);root.append(field);
    const buttons=new Map();let current,onSelect,order='';
    return {element:field,update(client,{disabled=false,select}={}){
      current=client;onSelect=select;const modes=connectionModes(client),next=modes.map(mode=>mode.id).join('|');field.hidden=modes.length<2;title.textContent=BridgeI18n.t('사이');
      for(const mode of modes){
        let button=buttons.get(mode.id);if(!button){button=document.createElement('button');button.type='button';button.dataset.connectionMode=mode.id;button.onclick=()=>{if(!button.disabled)onSelect?.(mode.id);};buttons.set(mode.id,button);}
        const selected=mode.id===current.connectionMode;button.textContent=BridgeI18n.t(mode.label);button.setAttribute('aria-pressed',String(selected));button.disabled=disabled||mode.available===false||mode.configured!==true||selected&&connection(current).ready;button.title=BridgeI18n.t(mode.reason||mode.description||'');
      }
      if(order!==next){options.replaceChildren(...modes.map(mode=>buttons.get(mode.id)));order=next;}
      const selected=modes.find(mode=>mode.id===client?.connectionMode),messages=[selected?.description,...modes.filter(mode=>mode.available===false||mode.configured!==true).map(mode=>mode.reason||'먼저 데스크탑 게이트웨이에서 이 연결 방법을 구성하십시오.')].filter(Boolean);
      note.textContent=[...new Set(messages)].map(value=>BridgeI18n.t(value)).join(' ');note.hidden=!note.textContent;
    }};
  }
  function confirmConnectionMode(client,mode){
    const choice=connectionModes(client).find(value=>value.id===mode&&value.available!==false&&value.configured===true);
    if(!choice)return Promise.resolve(false);if(mode===client.connectionMode)return Promise.resolve(true);
    return new Promise(resolve=>{
      const node=(tag,text)=>{const value=document.createElement(tag);value.textContent=BridgeI18n.t(text);return value;},dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const title=node('h2','앱 연결 방법을 전환하시겠습니까?'),identity=node('p',client.name||client.id),target=node('p','다음으로 전환');target.textContent+='：'+BridgeI18n.t(choice.label);
      const description=node('p','이렇게 하면 데스크톱 앱을 종료하거나 다시 시작하지 않고도 앱이 연결되는 방식이 전환됩니다. 완료되지 않은 작업을 먼저 해결하세요.');
      const id='client-mode-confirm-'+(++sequence);title.id=id;description.id=id+'-description';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let accepted=false;const finish=value=>{accepted=value;dialog.close();};
      const confirm=node('button','스위치 확인'),cancel=node('button','취소');confirm.type=cancel.type='button';confirm.onclick=()=>finish(true);cancel.onclick=()=>finish(false);actions.append(confirm,cancel);dialog.append(title,identity,target,description);if(choice.description)dialog.append(node('p',choice.description));dialog.append(actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  async function chooseDisable(client){
    const choice=await new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2','전화 액세스 비활성화'),description=node('p','컴퓨터에서도 앱을 종료할지 여부를 선택합니다.');
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-disable-'+(++sequence);title.id=id+'-title';description.id=id+'-description';
      dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=null;
      const finish=value=>{choice=value;dialog.close();};
      const options=[
        ['전화 액세스만 비활성화','데스크톱 앱과 현재 작업을 계속 실행하세요.',false],
        ['정상적으로 데스크톱 앱 종료',client.confirmTaskState?'앱의 네이티브 작업 사용을 종료합니다. 확인되지 않은 작업에는 확인이 필요합니다.':client.id==='claude'?'Claude의 네이티브 메뉴를 통해 정상적으로 종료합니다. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요. 다음에 Claude를 활성화하면 게이트웨이가 다시 연결을 시도합니다.':client.id==='codex'&&client.canForceQuit===true?'모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 Codex의 네이티브 메뉴를 통해 정상적으로 종료하십시오. 컴퓨터가 잠겨 있는 동안에는 이 기능을 사용하지 못할 수도 있습니다. 컴퓨터에서 종료 확인을 처리합니다.':'모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 종료하십시오.',true]
      ];
      if(client.bindingMode==='manual'||client.canQuitDesktop===false)options.splice(1);
      if(client.canForceQuit===true)options.push(['앱 강제 종료','앱 프로세스를 종료합니다. 저장하지 않은 콘텐츠는 손실될 수 있으며 작업이 중단될 수 있습니다. 이는 컴퓨터가 잠겨 있는 동안에도 작동합니다.','force']);
      for(const [label,note,value] of options){
        const button=document.createElement('button');button.type='button';button.dataset.quitDesktop=String(value!==false);
        if(value==='force')button.dataset.forceDesktop='true';
        button.append(node('strong',label),node('small',note));button.onclick=()=>finish(value);actions.append(button);
      }
      const cancel=node('button','취소');cancel.type='button';cancel.onclick=()=>finish(null);actions.append(cancel);
      dialog.append(title,identity,description,actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
      dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});
      document.body.append(dialog);dialog.showModal();cancel.focus();
    });
    return choice==='force'?chooseForce(client):choice===true&&(client.confirmTaskState||client.id==='claude'||client.id==='codex'&&client.desktopRestartRecommended===true)?confirmQuit(client,false):choice;
  }
  function chooseForce(client){
    if(client.canForceQuit!==true)return Promise.resolve(null);
    return confirmQuit(client,true);
  }
  function confirmQuit(client,force,restart=false){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2',restart?'ZCode를 다시 시작하시겠습니까?':force?'강제 종료 확인':client.confirmTaskState?'정상 종료 확인':client.id==='codex'?'Codex 복구 종료 확인':'Claude Desktop 종료 확인'),description=node('p',restart?'일부 작업을 확인할 수 없습니다. ZCode를 다시 시작하면 해당 작업이 중단되거나 승인이 보류될 수 있습니다. 계속하다?':!force&&client.confirmTaskState?'일부 작업을 확인할 수 없습니다. 종료하면 실행 중인 작업이 중단되거나 승인이 보류될 수 있습니다. 계속하다?':!force&&client.id==='codex'?'연결 재구축에 실패하여 일부 작업을 확인하지 못할 수 있습니다. 정상적인 종료는 해당 작업을 방해할 수 있습니다. 알려진 활성 작업은 여전히 ​​종료를 차단합니다. 이 위험을 확인한 다음 종료된 후 Codex를 수동으로 시작하십시오.':client.id==='claude'
        ?force?'그러면 Claude 데스크톱이 즉시 중지됩니다. 실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다. 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 강제로 종료하시겠습니까?':'Claude Desktop을 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 정말 그만두시겠어요?'
        :'그러면 데스크톱 앱이 즉시 중지됩니다. 실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다. 계속하려면 확인하세요.');
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-quit-confirm-'+(++sequence);title.id=id+'-title';description.id=id+'-description';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=null;
      const finish=value=>{choice=value;dialog.close();};
      const confirm=node('button',restart?'다시 시작 확인':force?'지금 강제 종료':'지금 그만두세요'),cancel=node('button','취소');confirm.type=cancel.type='button';if(force)confirm.className='client-force-confirm';confirm.onclick=()=>finish(force?'force':client.confirmTaskState||client.id==='codex'?'recovery':true);cancel.onclick=()=>finish(null);actions.append(confirm,cancel);dialog.append(title,identity,description,actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  return {chooseDisable,chooseForce,chooseInitialize,mountConnectionModes,confirmConnectionMode,connectionModes,connectionModeLabel,initializationFields,connection,connectWsl,request,failure,failureMessage,retryLabel,reconcile,sessionNotice};
})();
if(typeof module!=='undefined')module.exports={...ClientLifecycle,ClientIdentity};
