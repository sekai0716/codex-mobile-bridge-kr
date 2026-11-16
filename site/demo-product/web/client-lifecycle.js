'use strict';
const ClientLifecycle=(()=>{
  let sequence=0;
  function connection(client={}){
    const stage=client.connectionState,setup=client.setupStatus;
    const waiting=['starting','connecting'].includes(stage)||(!stage&&['starting','connecting'].includes(setup))||
      (client.initializationMode!=='background'&&['needs-screen-saver','needs-unlock','needs-desktop'].includes(setup));
    const background=client.backgroundRunning&&client.mainRunning===false;
    let label,reason=client.reason||'',pending=false,action=false;
    if(setup==='recovery-required'||(background&&!waiting&&!client.pendingEnable))label=background?"백그라운드에서 실행 중입니다. 데스크톱이 닫혔습니다.":"연결 복구 필요";
    else if(client.connected)label='연결됨';
    else if(client.pendingEnable){label="앱을 시작하는 중…";reason="클라이언트가 연결되기를 기다리고 있습니다. 준비되면 채팅이 자동으로 나타납니다.";pending=true;}
    else if(waiting){label=({'needs-screen-saver':"화면 보호기가 끝날 때까지 기다리는 중",'needs-unlock':"잠금 해제를 기다리는 중",'needs-desktop':"데스크탑을 기다리고 있어요"})[setup]||
      (stage==='starting'?"앱을 시작하는 중…":"연결 중입니다. 잠시 기다려 주세요…");pending=true;}
    else{
      label=({'needs-unlock':"컴퓨터가 잠겼습니다.",'needs-desktop':"컴퓨터 데스크톱을 사용할 수 없음"})[setup]||({'error':'연결 실패','timeout':"연결 시간이 초과되었습니다.",'needs-initialization':"연결 초기화 필요"})[stage]
        ||({'unsupported':"자동 액세스를 사용할 수 없습니다.",'needs-initialization':"연결 초기화 필요",'needs-first-launch':"초기 설정 필요",'restart-required':"다시 시작해야 함",'needs-permission':"권한이 필요합니다",'needs-developer-mode':"개발자 모드 확인 필요",'needs-trust':"디렉터리 신뢰가 필요함",'cancelled':'연결이 취소되었습니다.','failed':'연결 실패','needs-retry':'연결 실패'})[setup];
      action=!!label;
      label=label||(client.installed===false?'설치되지 않음':client.running===true?"앱 실행 중; 연결되지 않음":client.running===false?"앱이 실행되지 않음":"연결되지 않음");
    }
    const canInitialize=client.id==='claude'&&client.enabled&&client.installed!==false&&!client.connected&&!pending&&(['needs-initialization','needs-retry','needs-developer-mode','needs-trust','needs-permission','needs-unlock','needs-desktop','cancelled','failed'].includes(setup)||stage==='needs-initialization');
    const retryable=client.retryable===true&&client.enabled&&!client.connected&&!pending&&!canInitialize&&!['recovery-required','restart-required'].includes(setup);
    return {label,reason,waiting:pending,action:action||setup==='recovery-required',retryable:!!retryable,canInitialize:!!canInitialize,error:!client.connected&&['error','timeout'].includes(stage)||!client.connected&&setup==='failed'};
  }
  function request(operation,{timeout=45000,uncertain=true,message="수술 결과는 알 수 없습니다. 다시 시도하기 전에 상태를 새로 고치세요."}={}){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;let timer;
    return new Promise((resolve,reject)=>{
      timer=setTimeout(()=>{reject(Object.assign(Error(message),{uncertain}));controller?.abort();},timeout);
      try{Promise.resolve(operation(controller?.signal)).then(resolve,reject);}catch(error){reject(error);}
    }).finally(()=>clearTimeout(timer));
  }
  function failure(action,error,transport='web'){
    const uncertain=!!error.uncertain||(transport==='web'?!(error.status>=400&&error.status<500):/로컬 작업 시간이 초과되었습니다.|로컬 관리 프로세스가 종료되었습니다.|로컬 관리가 사용 중지되었습니다./.test(error.message));
    return {action,message:error.message,uncertain};
  }
  function failureMessage(value){return value.uncertain?"수술 결과는 알 수 없습니다. 다시 시도하기 전에 상태를 새로 고치세요.":value.message;}
  function retryLabel(action){return ({enable:"다시 시작해 보세요.",quit:"종료 다시 시도",force:'백그라운드 강제 종료 재시도',disable:"비활성화 다시 시도",initialize:'초기화 재시도'})[action]||'재시도 작업';}
  function reconcile(failures,clients){
    for(const [id,value] of failures||[]){
      if(!value.uncertain)continue;const client=clients.find(row=>row.id===id);
      const completed=client&&(['quit','force'].includes(value.action)?client.enabled===false&&client.running===false:value.action==='disable'?client.enabled===false:value.action==='initialize'?client.connected||connection(client).waiting:value.action==='enable'?client.enabled&&(client.running||client.connected||connection(client).waiting):false);
      if(completed)failures.delete(id);else failures.set(id,{...value,uncertain:false,message:client?.reason||"상태가 새로 고쳐졌습니다. 이전 작업을 다시 시도할 수 있습니다."});
    }
  }
  function sessionNotice(session){return session?.state==='locked'?"컴퓨터가 잠겨 있습니다. 백그라운드 서비스는 계속 실행됩니다. 데스크톱 상호 작용이 필요한 작업을 다시 시도하기 전에 잠금을 해제하세요.":session&&session.interactive!==true?"대화형 데스크탑을 사용할 수 없습니다. 백그라운드 서비스는 계속 실행됩니다. 데스크탑을 복원한 후 다시 시도하십시오.":'';}
  function chooseInitialize(client){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2','연결 초기화'),description=node('p',client.initializationMode==='background'
        ?"Windows에서는 백그라운드 초기화가 먼저 시도되며 키보드 포커스가 필요하지 않습니다. 개발자 도구가 잠시 나타날 수 있습니다. 사용할 수 없는 경우 데스크탑이 대화형일 때만 전경 설정이 시도됩니다."
        :"Claude 및 해당 개발자 도구가 컴퓨터에서 열리고 키보드 포커스를 사용하여 연결을 완료합니다. 화면 보호기나 잠금 화면이 나타나면 바탕 화면으로 돌아가서 계속하세요.");
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-initialize-'+(++sequence);title.id=id+'-title';description.id=id+'-description';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=false;
      const finish=value=>{choice=value;dialog.close();};
      const start=node('button','초기화 시작'),cancel=node('button','취소');start.type=cancel.type='button';start.onclick=()=>finish(true);cancel.onclick=()=>finish(false);actions.append(start,cancel);dialog.append(title,identity,description,actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  async function chooseDisable(client){
    const choice=await new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2',"전화 액세스 비활성화"),description=node('p',"컴퓨터에서도 앱을 종료할지 여부를 선택합니다.");
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-disable-'+(++sequence);title.id=id+'-title';description.id=id+'-description';
      dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=null;
      const finish=value=>{choice=value;dialog.close();};
      const options=[
        ["전화 액세스만 비활성화","데스크톱 앱과 현재 작업을 계속 실행하세요.",false],
        ["정상적으로 데스크톱 앱 종료",client.id==='claude'?"Claude의 네이티브 메뉴를 통해 정상적으로 종료합니다. 작업을 처리하거나 확인 내용을 컴퓨터에 저장하세요. 다음에 Claude를 활성화하면 게이트웨이가 다시 연결을 시도합니다.":client.id==='codex'&&client.canForceQuit===true?"모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 Codex의 네이티브 메뉴를 통해 정상적으로 종료하십시오. 컴퓨터가 잠겨 있는 동안에는 이 기능을 사용하지 못할 수도 있습니다. 컴퓨터에서 종료 확인을 처리합니다.":"모든 작업이 완료되고 대기 중인 승인이 없는 경우에만 종료하십시오.",true]
      ];
      if(client.canForceQuit===true)options.push(["앱 강제 종료","앱 프로세스를 종료합니다. 저장하지 않은 콘텐츠는 손실될 수 있으며 작업이 중단될 수 있습니다. 이는 컴퓨터가 잠겨 있는 동안에도 작동합니다.",'force']);
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
    return choice==='force'?chooseForce(client):choice===true&&client.id==='claude'?confirmQuit(client,false):choice;
  }
  function chooseForce(client){
    if(client.canForceQuit!==true)return Promise.resolve(null);
    return confirmQuit(client,true);
  }
  function confirmQuit(client,force){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='client-disable-dialog';
      const node=(tag,text)=>{const element=document.createElement(tag);element.dataset.i18n=text;element.textContent=BridgeI18n.t(text);return element;};
      const title=node('h2',force?"지금 강제 종료":"Claude Desktop 종료 확인"),description=node('p',client.id==='claude'
        ?force?"그러면 Claude 데스크톱이 즉시 중지됩니다. 실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다. 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 강제로 종료하시겠습니까?":"Claude Desktop을 다시 시작한 후 연결을 초기화하려면 컴퓨터 잠금을 해제해야 합니다. 정말 그만두시겠어요?"
        :"그러면 데스크톱 앱이 즉시 중지됩니다. 실행 중인 세션이 중단될 수 있으며 저장하지 않은 콘텐츠가 손실될 수 있습니다. 계속하려면 확인하세요.");
      const identity=document.createElement('p');identity.textContent=client.name||client.id;
      const id='client-quit-confirm-'+(++sequence);title.id=id+'-title';description.id=id+'-description';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
      const actions=document.createElement('div');actions.className='client-disable-options';let choice=null;
      const finish=value=>{choice=value;dialog.close();};
      const confirm=node('button',force?"지금 강제 종료":"지금 그만두세요"),cancel=node('button','취소');confirm.type=cancel.type='button';if(force)confirm.className='client-force-confirm';confirm.onclick=()=>finish(force?'force':true);cancel.onclick=()=>finish(null);actions.append(confirm,cancel);dialog.append(title,identity,description,actions);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
    });
  }
  return {chooseDisable,chooseForce,chooseInitialize,connection,request,failure,failureMessage,retryLabel,reconcile,sessionNotice};
})();
if(typeof module!=='undefined')module.exports=ClientLifecycle;
