'use strict';
const connectionSecretDraft=new Map();
const connectionSetupState=new Map();
const connectionExpanded=new Map();
function connectionLabel(mode){return t({quick:"임시 HTTPS · Cloudflare",cloudflare:"고정 도메인 · Cloudflare 터널",server:"고정도메인 · 자체 서버 + SSH",nas:"고정 도메인 · NAS / 역방향 프록시 / Docker",tailscale:"고정 HTTPS · Tailscale"}[mode]);}
function setupGuide(link,mode){
  link.className='setup-guide';link.textContent=t("온라인 가이드");
  link.href=mode==='tailscale'?'https://tailscale.com/docs/how-to/quickstart':'https://try2love.github.io/codex-mobile-bridge/setup.html?lang='+(BridgeI18n.language()==='en'?'en':'ko')+'#'+mode;
  link.onclick=event=>{event.preventDefault();api.open('setup-'+mode).catch(e=>feedback(e.message,true));};
}
async function saveConnectionCredentials(id){
  const draft=connectionSecretDraft.get(id);
  if(!draft||!draft.changed||!Object.values(draft.secrets).some(Boolean))return;
  const submitted=JSON.stringify(draft.secrets);
  await api.connectionCredentials({id,remember:draft.remember,secrets:{...draft.secrets}});
  if(JSON.stringify(draft.secrets)===submitted)draft.changed=false;
}
async function saveAllConnectionCredentials(enabledOnly=false){
  for(const row of connectionDraft)if(!enabledOnly||row.enabled)await saveConnectionCredentials(row.id);
}
function renderConnections(){
  for(const link of document.querySelectorAll('[data-setup-guide]'))setupGuide(link,link.dataset.setupGuide);
  setupGuide($('connection-guide'),$('connection-kind').value);
  for(const card of $('connections').querySelectorAll('details.connection-card'))connectionExpanded.set(card.dataset.connectionId,card.open);
  $('connections').replaceChildren();
  if(!connectionDraft.length){const empty=document.createElement('p');empty.className='hint';empty.textContent=t("아직 외부 연결이 없습니다. LAN 액세스는 독립적으로 작동합니다.");$('connections').append(empty);}
  for(const row of connectionDraft){
    const container=document.createElement('details');container.className='connection-card';container.dataset.connectionId=row.id;container.open=connectionExpanded.get(row.id)===true;
    const card=document.createElement('div');card.className='connection-body';
    const head=document.createElement('summary');head.className='section-head';
    const heading=document.createElement('h3');heading.textContent=connectionLabel(row.accessMode);
    const title=document.createElement('div');title.className='connection-title';
    const guideLink=document.createElement('a');setupGuide(guideLink,row.accessMode);title.append(heading,guideLink);
    const remove=document.createElement('button');remove.type='button';remove.textContent=t('삭제');remove.dataset.removeConnection=row.id;remove.disabled=!!snapshot?.runtime.running;
    remove.onclick=()=>{connectionDraft=connectionDraft.filter(c=>c.id!==row.id);connectionSecretDraft.delete(row.id);connectionExpanded.delete(row.id);renderConnections();updateDirty();};head.append(title,remove);container.append(head,card);
    function field(key,label,type='text',placeholder='',parent=card){
      const wrap=document.createElement('label'),text=document.createElement('span'),node=document.createElement('input');text.textContent=t(label);node.type=type;node.dataset.connectionField=key;
      node.id='connection-'+row.id+'-'+key;node.placeholder=t(placeholder);node.disabled=!!snapshot?.runtime.running||busyActions.size>0;
      if(type==='checkbox'){wrap.className='check';node.checked=row[key];}else node.value=row[key]??'';
      if(type==='number'){node.min=key==='sshPort'?1:1024;node.max=65535;}
      if(key==='name')node.maxLength=100;
      if(key==='publicUrl'){node.onfocus=()=>{if(!node.value)node.value='https://';};node.onblur=()=>{if(node.value==='https://'){node.value='';row[key]='';updateDirty();}};}
      node.oninput=()=>{connectionSetupState.delete(row.id);row[key]=type==='checkbox'?node.checked:type==='number'?Number(node.value):node.value;updateDirty();};
      node.onchange=()=>{node.oninput();if(key==='enabled')renderConnections();};
      if(type==='checkbox')wrap.append(node,text);else wrap.append(text,node);parent.append(wrap);return node;
    }
    function note(text,parent=card){const node=document.createElement('p');node.className='hint';node.textContent=t(text);parent.append(node);return node;}
    function action(label,method,callback){
      const button=document.createElement('button');button.type='button';button.textContent=t(label);button.dataset.connectionAction=method;button.dataset.connection=row.id;button.dataset.key=row.id+':'+method;
      button.onclick=async()=>{
        const key=button.dataset.key;if(dirty||busyActions.size)return;busyActions.add(key);updateDirty();
        try{if(!['clearCredentials','diagnostics'].includes(method))await saveConnectionCredentials(row.id);const result=await callback();if(result?.message)feedback(result.message);}
        catch(e){showError(e);connectionSetupState.set(row.id,e.message);}
        finally{busyActions.delete(key);renderConnections();updateDirty();}
      };return button;
    }
    function secretFields(keys){
      let draft=connectionSecretDraft.get(row.id);
      if(!draft){draft={remember:true,secrets:{},changed:false,revision:0};connectionSecretDraft.set(row.id,draft);}
      for(const [key,label] of keys){
        const wrap=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input');text.textContent=t(label);input.type='password';input.autocomplete='new-password';input.dataset.connectionSecret=key;
        input.id='connection-'+row.id+'-'+key;input.value=draft.secrets[key]||'';input.placeholder=t("구성되지 않음");input.disabled=!!snapshot?.runtime.running;
        input.oninput=()=>{draft.secrets[key]=input.value;draft.changed=true;draft.revision++;};wrap.append(text,input);card.append(wrap);secretControl(input);
      }
      const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');label.className='check';check.type='checkbox';check.checked=draft.remember;
      text.textContent=t("자동 재연결을 위해 시스템 자격 증명 저장소에 저장");check.onchange=()=>{draft.remember=check.checked;draft.changed=true;draft.revision++;};label.append(check,text);card.append(label);
      if(!draft.loaded&&snapshot?.preferences.connections.some(c=>c.id===row.id)){
        draft.loaded=true;const revision=draft.revision;
        api.readCredentials({id:row.id}).then(values=>{if(connectionSecretDraft.get(row.id)!==draft||draft.changed||draft.revision!==revision)return;draft.secrets=values;for(const [key] of keys){const input=$('connection-'+row.id+'-'+key);if(input)input.value=values[key]||'';}}).catch(error=>{draft.loaded=false;feedback(error.message,true);});
      }
      note("선택 해제하면 새 자격 증명은 이 앱 세션 동안에만 지속됩니다. 이전에 저장된 자격 증명은 아래에서 삭제할 수 있습니다.");
      const actions=document.createElement('div');actions.className='actions';
      actions.append(action('연결 자격 증명 저장','credentials',async()=>({message:t("연결 자격 증명이 저장되었습니다.")})),action('저장된 자격 증명 지우기','clearCredentials',async()=>{const result=await api.connectionCredentials({id:row.id,secrets:{clear:true}});draft.secrets={};draft.changed=false;draft.revision++;return result;}));card.append(actions);
    }
    field('enabled',"이 연결을 활성화합니다",'checkbox');field('name','연결 이름','text',"선택사항(예: 홈 NAS");
    if(row.accessMode==='quick'){
      note(snapshot?.cloudflared?.available?"Cloudflare가 준비되었습니다. 임시 HTTPS 주소를 얻으려면 게이트웨이를 저장하고 시작하십시오.":"이 소스 환경에서는 Cloudflare를 사용할 수 없습니다. 런타임 설정에서 설치하세요.");
      const status=note(quickTunnelMessage());status.dataset.quickStatus='true';
      note("계정이나 도메인이 필요하지 않습니다. 터널이 다시 생성되면 주소가 변경됩니다. 전화 알림에서 항목 알림을 구성합니다.");
    }else if(row.accessMode==='tailscale'){
      note("서버가 필요하지 않습니다. 공식 Tailscale 클라이언트에 로그인하고 고정 주소를 감지 및 저장한 후 게이트웨이를 시작하세요.");
      note("Tailscale 공용 전달 또는 릴레이 연결은 중국 본토 외부의 서버를 사용할 수 있습니다. 중국 본토에서 직접 액세스하는 경우 속도가 느리거나 시간 초과될 수 있습니다. 안정적인 프록시 경로가 도움이 될 수 있습니다. 실제 성능은 네트워크에 따라 다릅니다.");
      for(const [key,label,values] of [
        ['tailscaleMode','접근 범위',[['funnel',"공개 액세스 · 유입경로"],['serve',"사설망 · 서비스"]]],
        ['tailscalePort','HTTPS 포트',[[443,"443(기본값)"],[8443,'8443'],[10000,'10000']]]
      ]){
        const wrap=document.createElement('label'),text=document.createElement('span'),select=document.createElement('select');text.textContent=t(label);select.dataset.connectionField=key;
        for(const [value,label] of values){const option=document.createElement('option');option.value=value;option.textContent=t(label);select.append(option);}
        select.value=row[key]??(key==='tailscaleMode'?'funnel':443);select.disabled=!!snapshot?.runtime.running;
        select.onchange=()=>{row[key]=key==='tailscalePort'?Number(select.value):select.value;if(key==='tailscalePort'){row.publicUrl='';row.tailscaleNodeId='';}connectionSetupState.delete(row.id);renderConnections();updateDirty();};
        wrap.append(text,select);card.append(wrap);
      }
      note(row.tailscaleMode==='serve'?"동일한 Tailscale 네트워크에 연결된 휴대폰이나 브라우저만 이 항목에 액세스할 수 있습니다.":"휴대폰과 일반 브라우저에는 Tailscale가 필요하지 않습니다. 게이트웨이 로그인이 필요합니다. 처음 사용하려면 HTTPS 및 유입 경로 승인이 필요할 수 있습니다.");
      const address=field('publicUrl',"고정 액세스 URL",'text',"자동으로 감지됨");address.readOnly=true;address.onfocus=null;address.onblur=null;
      note("주소는 Tailscale 장치와 이름이 유지되는 동안 다시 시작해도 유지됩니다. 성능은 경로에 따라 다릅니다. 모바일 데이터로 인증하세요.");
      if(row.tailscaleMode!=='serve')note("공용 DNS는 처음 사용 후 전파되는 데 최대 10분이 걸릴 수 있습니다.");
      const actions=document.createElement('div');actions.className='actions';
      const help=document.createElement('button');help.type='button';help.textContent=t("설치 및 로그인 안내");help.onclick=()=>api.open('tailscale-help').catch(showError);actions.append(help);
      actions.append(action("Tailscale를 감지하고 URL를 읽습니다.",'tailscaleInspect',async()=>{
        const result=await api.tailscaleSetup({id:row.id});connectionSetupState.set(row.id,result.message);
        if(result.state==='ready'){
          if(snapshot?.runtime.running&&(row.publicUrl!==result.url||row.tailscaleNodeId!==result.nodeId))throw Error(t("Tailscale 주소를 업데이트하기 전에 게이트웨이를 중지하십시오."));
          row.publicUrl=result.url;row.tailscaleNodeId=result.nodeId;
        }
        return result;
      }));
      actions.append(action("Tailscale 인증 계속",'tailscaleAuthorize',()=>api.tailscaleAuthorize({id:row.id})));
      actions.append(action("고정 항목 확인",'checkEntry',()=>api.checkEntry({id:row.id})));card.append(actions);
      const status=note([connectionSetupState.get(row.id),snapshot?.externalStatus?.[row.id]?.message].filter(Boolean).map(t).join(' ')||"연결 설정을 저장한 다음 Tailscale를 감지합니다.");status.dataset.connectionStatus=row.id;
      note("항목은 게이트웨이 뒤에 옵니다. 이를 중지해도 Tailscale에서 로그아웃되거나 다른 서비스가 수정되지 않습니다.");
    }else{
      const publicAddress=field('publicUrl',row.accessMode==='server'?"휴대폰 접속 주소(선택 사항)":"전화 접속 URL",'text',row.accessMode==='server'?"공개 서버 IP를 사용하려면 비워두세요.":'https://codex.try2love.com');
      if(row.accessMode==='server'){
        publicAddress.onfocus=null;
        note("도메인의 경우 DNS 레코드가 공용 IP 서버를 가리키도록 하고 HTTPS 인증서와 역방향 프록시를 구성합니다. https://bridge.example.com.와 같이 전체 URL를 입력하세요.");
        note("저장 시 https://server-public-IP를 입력하려면 공백으로 남겨두세요. SSH 서버 주소 또는 별칭 HostName은 공개 IP여야 합니다. 서버에는 여전히 IP 및 역방향 프록시와 일치하는 신뢰할 수 있는 HTTPS 인증서가 필요합니다. SSH만으로는 충분하지 않습니다.");
      }
      note("사용자 이름 try2love 및 도메인 try2love.com은 구성 예입니다. 이를 자신의 설정으로 바꾸십시오. URL 예제는 라이브 데모 사이트가 아닙니다.");
      if(row.accessMode==='cloudflare'){
        note("서버 없이 도메인을 사용하세요. Cloudflare 터널을 생성하고 공개 호스트 이름을 구성한 후 여기에 토큰을 입력하세요.");
        note("Cloudflare 터널 트래픽은 중국 본토 외부의 서버를 통과할 수 있습니다. 중국 본토에서 직접 액세스하는 경우 속도가 느리거나 시간 초과될 수 있습니다. 안정적인 프록시 경로가 도움이 될 수 있습니다. 실제 성능은 네트워크에 따라 다릅니다.");
        const guide=document.createElement('details'),summary=document.createElement('summary');guide.className='guide-more';summary.textContent=t("최초 설정: 도메인에서 전화 액세스까지");guide.append(summary);
        const steps=document.createElement('ol');steps.className='setup-steps';
        for(const text of ["try2love.com과 같은 루트 도메인을 Cloudflare에 추가하고 할당된 두 개의 네임서버(NS) 주소를 복사합니다.","도메인 등록 기관에서 네임서버를 이 두 개의 NS 주소로 바꾸세요. Cloudflare가 활성으로 표시될 때까지 기다립니다. 등록기관을 통해 계속 갱신하고 기존 웹사이트와 이메일 DNS 기록을 보존하세요.","터널 아래에 Cloudflared 터널을 생성하고 설치 명령에서 터널 토큰을 복사하세요. 명령이나 API 키가 아닌 토큰만 입력하십시오. 앱에는 커넥터가 포함되어 있습니다. 별도의 서비스 설치가 필요하지 않습니다.","이 카드에 https://codex.try2love.com와 토큰을 입력하고 활성화하고 저장한 다음 게이트웨이를 시작하세요. 커넥터가 Cloudflare에 연결되어 있는지 확인하세요.","터널 경로 아래에 게시된 애플리케이션(공용 호스트 이름)(하위 도메인 코덱스, 도메인, 경로 없음)을 추가합니다. HTTP를 선택하고 아래의 로컬 게이트웨이 주소를 사용하세요. 저장하면 DNS 레코드가 생성됩니다.","고정된 항목 확인을 선택한 다음 휴대폰 Wi-Fi를 끄고 로그인을 확인하고 모바일 데이터를 통해 채팅하세요. 건강한 터널만으로는 페이지가 작동한다는 것을 증명할 수 없습니다. 컴퓨터 Codex 및 게이트웨이를 온라인 상태로 유지합니다."]){const li=document.createElement('li');li.textContent=t(text);steps.append(li);}guide.append(steps);
        note("도메인을 찾을 수 없음: NS, 활성 상태 및 DNS 캐시를 확인하세요. 오류 1033: 토큰과 터널 연결을 확인하세요. 오류 502: 로컬 게이트웨이, HTTP 서비스 유형 및 포트를 확인하세요.",guide);card.append(guide);
        note("Cloudflare 경로의 서비스 주소(HTTP):");
        const upstream=document.createElement('p');upstream.className='mono';upstream.textContent='http://localhost:'+($('port').value||8787);card.append(upstream);
        secretFields([['tunnelToken','Cloudflare Tunnel Token']]);
        note("터널 토큰은 기존 터널을 실행합니다. DNS 레코드를 생성하거나 Cloudflare 계정을 변경하지 않습니다. 이 컴퓨터와 게이트웨이를 온라인 상태로 유지하세요.");
        const links=document.createElement('div');links.className='actions';card.append(links);
        for(const [label,target] of [["Cloudflare 대시보드 열기",'cloudflare-dashboard'],["고정 터널 설정 가이드",'cloudflare-domain-help']]){const button=document.createElement('button');button.type='button';button.textContent=t(label);button.onclick=()=>api.open(target).catch(e=>feedback(e.message,true));links.append(button);}
      }else if(row.accessMode==='server'){
        const wrap=document.createElement('label'),text=document.createElement('span'),select=document.createElement('select');text.textContent=t("SSH 인증");select.dataset.connectionField='sshAuth';select.id='connection-'+row.id+'-sshAuth';
        for(const [value,label] of [['password',"사용자 이름 및 비밀번호"],['key',"로컬 SSH 개인 키"],['agent',"로컬 SSH 에이전트"],['config',"기존 SSH 별칭/구성"]]){const option=document.createElement('option');option.value=value;option.textContent=t(label);select.append(option);}
        select.value=row.sshAuth||'config';select.disabled=!!snapshot?.runtime.running;select.onchange=()=>{connectionSetupState.delete(row.id);row.sshAuth=select.value;renderConnections();updateDirty();};wrap.append(text,select);card.append(wrap);
        if(select.value==='config')field('sshTarget',"서버 SSH 대상",'text',"기존 SSH 별칭 또는 try2love@server.try2love.com");
        else{
          const fields=document.createElement('div');fields.className='two fields';card.append(fields);
          field('sshHost','서버 주소','text','203.0.113.10',fields);field('sshUser','SSH 사용자 이름','text','try2love',fields);field('sshPort','SSH 포트','number','',fields);
          if(select.value==='key'){
            const key=field('sshKeyPath','로컬 개인 키 파일');const pick=document.createElement('button');pick.type='button';pick.textContent=t("개인 키 선택");pick.disabled=!!snapshot?.runtime.running;
            pick.onclick=async()=>{try{const value=await api.choose('ssh-key');if(value){connectionSetupState.delete(row.id);row.sshKeyPath=value;key.value=value;updateDirty();}}catch(e){feedback(e.message,true);}};card.append(pick);
            secretFields([['passphrase',"개인 키 암호(선택 사항)"]]);
          }
          if(select.value==='password')secretFields([['password','SSH 비밀번호']]);
        }
        const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t("고급 서버 설정");advanced.append(summary);card.append(advanced);
        field('sshRemotePort','서버 루프백 포트','number','',advanced);
        note("SSH 포트는 서버에 연결됩니다. 루프백 포트는 역방향 프록시에서만 사용되며 일반적으로 변경할 필요가 없습니다.",advanced);
        const guide=document.createElement('details'),guideTitle=document.createElement('summary');guide.className='guide-more';guide.open=true;guideTitle.textContent=t("1. 수동으로 서버 준비(최초 설정)");guide.append(guideTitle);
        note("사용자 또는 서버 관리자는 터미널에서 서비스를 수동으로 설치하고 방화벽 및 SSH 권한을 구성해야 합니다. 앱은 sudo 비밀번호를 허용하지 않거나 서버 설치 명령을 실행하지 않습니다.",guide);
        const steps=document.createElement('ol');steps.className='setup-steps';
        for(const text of ["도메인의 경우 DNS가 공용 IP 서버를 가리키도록 합니다. IP에 직접 액세스하려면 신뢰할 수 있는 IP 인증서를 프로비저닝하세요. 둘 다 HTTPS 역방향 프록시, 방화벽 및 보안 그룹 규칙이 필요합니다.","원격 전달 권한이 있는 일반 SSH 사용자를 준비합니다. GatewayPorts no를 유지하고 루프백 포트를 공개적으로 노출하지 마십시오.","HTTPS 역방향 프록시를 수동으로 구성하거나 기존 사이트를 사용하십시오. 아래 업스트림 주소를 사용하고 공개 호스트 헤더를 유지하세요. 기존 사이트를 그대로 유지합니다."]){const li=document.createElement('li');li.textContent=t(text);steps.append(li);}guide.append(steps);
        note("서버 HTTPS 프록시 업스트림(서버 루프백에만 해당):",guide);
        const upstream=document.createElement('p');upstream.className='mono';upstream.textContent='http://127.0.0.1:'+row.sshRemotePort;guide.append(upstream);
        const links=document.createElement('div');links.className='actions';guide.append(links);
        for(const [label,target] of [["HTTPS 서비스 설정 참조",'server-https-help'],['SSH 전달 권한 참조','server-ssh-help']]){const button=document.createElement('button');button.type='button';button.textContent=t(label);button.onclick=()=>api.open(target).catch(e=>feedback(e.message,true));links.append(button);}
        links.append(action("복사 서버 검사 프롬프트",'diagnostics',()=>api.copyServerDiagnostics({id:row.id,language:BridgeI18n.language()})));
        card.append(guide);
        note("2. 위의 설정을 저장한 후 SSH 로그인을 확인하세요. 성공하면 전달이나 공개 액세스가 아닌 인증만 확인됩니다.");
        const actions=document.createElement('div');actions.className='actions';
        async function checkHost(){
          const host=await api.serverSetup({id:row.id,action:'host'});
          if(!host.trusted){const result=await api.serverSetup({id:row.id,action:'trust',fingerprint:host.fingerprint});if(result.cancelled)throw Error(t("호스트 지문이 저장되지 않았습니다."));}
        }
        actions.append(action("SSH 로그인 확인",'inspect',async()=>{await checkHost();const result=await api.serverSetup({id:row.id,action:'inspect'});connectionSetupState.set(row.id,result.message+(result.dnsReady?'':' '+t("도메인이 아직 확인되지 않았습니다. 먼저 DNS 레코드를 추가하세요.")));return result;}));
        card.append(actions);
        note("3. 수동 설정 후 연결을 시작하고 고정 항목 확인을 선택합니다. 마지막으로 로그인을 확인하고 전화 모바일 데이터를 통해 채팅하세요.");
        const connectActions=document.createElement('div');connectActions.className='actions';
        connectActions.append(action("SSH 연결 시작",'connect',async()=>{
          await checkHost();unwrapValidation(await api.start());await refresh();
          return {message:t("게이트웨이가 시작되었습니다. SSH가 연결 중입니다. 상태를 검토한 다음 수정된 항목을 확인하세요. 게이트웨이를 시작하면 활성화된 다른 연결도 시작됩니다.")};
        }));card.append(connectActions);
      }else{
        field('proxyUpstream',"NAS에서 연결할 수 있는 컴퓨터 주소",'text','http://192.168.1.10:'+($('port').value||8787));
        note("게이트웨이 포트를 사용하여 NAS에서 연결할 수 있는 컴퓨터의 HTTP 주소를 입력합니다. LAN 액세스를 활성화합니다. 네트워크가 서로 연결할 수 없는 경우 먼저 경로를 설정하거나 SSH 서버 연결을 사용하십시오.");
      }
      const actions=document.createElement('div');actions.className='actions';
      if(row.accessMode!=='cloudflare')for(const [label,method] of [[row.accessMode==='server'?"수동 설정 참조 내보내기…":"배포 내보내기 ZIP…",'exportDeployment'],[row.accessMode==='server'?"수동 설정 지침 복사":"배포 에이전트용 사본",'copyDeployment']])actions.append(action(label,method,()=>api[method]({id:row.id,language:BridgeI18n.language()})));
      actions.append(action("고정 항목 확인",'checkEntry',()=>api.checkEntry({id:row.id})));card.append(actions);
      const status=note([connectionSetupState.get(row.id),snapshot?.externalStatus?.[row.id]?.message].filter(Boolean).map(t).join(' ')||"이 항목을 확인하려면 구성을 저장하세요.");status.dataset.connectionStatus=row.id;
    }
    $('connections').append(container);
  }
  BridgeI18n.apply();
}
function addConnection(){
  if(snapshot?.runtime.running)return;
  connectionDraft.push({id:crypto.randomUUID(),name:'',enabled:true,accessMode:$('connection-kind').value,publicUrl:'',sshTarget:'',sshRemotePort:18787,proxyUpstream:'',sshAuth:'password',sshHost:'',sshUser:'',sshPort:22,sshKeyPath:'',tailscaleMode:'funnel',tailscalePort:443,tailscaleNodeId:''});
  connectionExpanded.set(connectionDraft[connectionDraft.length-1].id,true);
  renderConnections();updateDirty();
}
