'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Run the actual phone handlers with an isolated DOM and notification API.
async function fixture({sessionStore=new Map(),localStore=new Map(),skipStartup=false}={}){
  const nodes=new Map(),saved=new Map(),writes=[],listRequests=[],acknowledgements=[];
  const webhookTemplates={generic:'{"event":"{{event}}"}',feishu:JSON.stringify({msg_type:'text',content:{text:'{{title}}\n{{body}}\n{{url}}'}}),dingtalk:'{"msgtype":"text"}',discord:'{"content":"{{body}}"}',telegram:'{"chat_id":"","text":"{{body}}"}'};
  const node=(tag='')=>({tagName:tag.toUpperCase(),ownerDocument:{addEventListener(){}},children:[],value:'',checked:false,disabled:false,hidden:false,open:false,textContent:'',dataset:{},options:[],style:{setProperty(k,v){this[k]=v;}},scrollTop:0,parentElement:{},listeners:{},
    setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},before(child){this.previousSibling=child;},closest(selector){return selector==='.picker-head'?this:null;},after(child){this.nextSibling=child;},getBoundingClientRect(){return {width:390,height:844};},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);},dispatchEvent(event){for(const listener of this.listeners[event.type]||[])listener(event);},replaceChildren(...values){this.children=values;},append(...values){this.children.push(...values);},querySelectorAll(){return [];},querySelector(){return {disabled:false};},
    showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent({type:'close'});}});
  const html=fs.readFileSync(path.join(__dirname,'../web/index.html'),'utf8');
  for(const match of html.matchAll(/\bid="([^"]+)"/g))nodes.set(match[1],node());
  const channelButtons=['bark','ntfy','pushplus','webhook'].map(channel=>Object.assign(node('button'),{dataset:{notificationChannel:channel}}));
  const localStorage={get length(){return localStore.size;},key(index){return [...localStore.keys()][index]??null;},getItem(key){return localStore.get(key)??null;},setItem(key,value){localStore.set(key,String(value));},removeItem(key){localStore.delete(key);}};
  const scopedStorage={get length(){return sessionStore.size;},key(index){return [...sessionStore.keys()][index]??null;},getItem(key){return sessionStore.get(key)??null;},setItem(key,value){sessionStore.set(key,String(value));},removeItem(key){sessionStore.delete(key);},clear(){sessionStore.clear();}};
  const archiveToggles=[];
  const archiveFilter={classList:{toggle:(name,enabled)=>archiveToggles.push([name,enabled])}};
  let nextPost,nextGet;
  const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
  let listResponse=()=>response({sessions:[],unavailableHosts:[]}),knownRows=[];
  const context=vm.createContext({CliConnectionsPanel:class{},SessionMenu:class{bind(){}close(){}},ClientNavigation:class{constructor(){this.provider="codex";this.clients=[];}async refresh(){}acknowledgeList(provider,value){acknowledgements.push({provider,value});}},DesktopSessionsView:class{bindListCache(){}previewCachedList(){return false;}clear(){}},Workbench:class{constructor(){this.current={};}async resolveChat(id){return {rootId:id};}open(){}reset(){}setThumbnails(){}relabel(){}},navigator:{userAgent:'test'},document:{addEventListener(){},documentElement:{classList:{contains(){return false;}}},getElementById:id=>nodes.get(id),querySelector:selector=>selector==='.archive-filter'?archiveFilter:{disabled:false},querySelectorAll:selector=>selector==='[data-notification-channel]'?channelButtons:[],createElement:node},
    renderMarkdown(){},window:{addEventListener(){}},localStorage,sessionStorage:scopedStorage,
    location:{hash:'',pathname:'/',search:''},history:{state:null,replaceState(state){this.state=state;},pushState(state){this.state=state;},back(){}},confirm:()=>true,setTimeout(){},clearTimeout(){},setInterval(){},
    ChatTimeline:class{constructor(){this.abort=new AbortController();}async start(){}dispose(){this.abort.abort();}relabel(){}refreshActions(){}},
    fetch:async(url,options={})=>{
      if(url.includes('/respond?')){writes.push({url,body:JSON.parse(options.body)});return response({status:'accepted'});}
      if(url==='/api/auth')return response({authenticated:false});
      if(url.includes('/reconnect'))return response({ok:true});
      if(url.startsWith('/api/sessions?')){
        listRequests.push(url);const result=await listResponse(url);
        if(!result.ok)return result;
        const data=await result.json(),offset=Number(new URL(url,'http://test').searchParams.get('offset')||0);
        // Older fixture pages modelled the aggregate endpoint. Adapt their continuation to the host prefix contract.
        if(offset&&data.complete===undefined&&!data.remoteHosts) data.sessions=[...knownRows,...data.sessions];
        knownRows=data.sessions;return response(data);
      }
      if(url==='/api/activity')return response({sessions:[]});
      if(url.startsWith('/api/notifications/channels/')||url.includes('/rename?')){
        if(options.method!=='POST'&&nextGet){const handle=nextGet;nextGet=null;return handle(url);}
        if(options.method==='POST'){
          const body=JSON.parse(options.body);writes.push({url,body});
          if(nextPost){const handle=nextPost;nextPost=null;return handle(body);}
          if(url.includes('/rename?'))return response({title:body.title});
          if(url.endsWith('/test'))return response({ok:true});
          if(url.endsWith('/common'))saved.set(url,body);
          else if(url.endsWith('/webhook/endpoints')){const key='/api/notifications/channels/webhook',previous=saved.get(key)||{},rows=previous.webhookEndpoints||[];if(body.action==='delete'){saved.set(key,{...previous,webhookEndpoints:rows.filter(row=>row.webhookId!==body.webhookId),selectedWebhookId:''});return response(saved.get(key));}const id=body.webhookId||'named-1',old=rows.find(row=>row.webhookId===id)||previous;const row={webhookId:id,webhookName:body.webhookName,webhookEnabled:body.webhookEnabled,webhookProvider:body.webhookProvider,webhookSignEnabled:body.webhookSignEnabled,hasWebhookSignSecret:!!body.webhookSignSecret||!body.clearWebhookSignSecret&&!!old.hasWebhookSignSecret,hasWebhookUrl:!!body.webhookUrl||!body.clearWebhookUrl&&!!old.hasWebhookUrl,webhookUrlDisplay:'https://example.test',hasWebhookHeaders:!!Object.keys(body.webhookHeaders).length||!body.clearWebhookHeaders&&!!old.hasWebhookHeaders,webhookBodyTemplate:body.webhookBodyTemplate,webhookTemplates};saved.set(key,{...previous,webhookEndpoints:[...rows.filter(item=>item.webhookId!==id),row],selectedWebhookId:id});return response(saved.get(key));}
          else {
            const secret=url.endsWith('/bark')?'barkKey':url.endsWith('/ntfy')?'token':'pushplusToken';
            const marker=url.endsWith('/bark')?'hasBarkKey':url.endsWith('/ntfy')?'hasToken':'hasPushplusToken';
            saved.set(url,{...body,[secret]:undefined,[marker]:!!body[secret]||!body['clear'+secret[0].toUpperCase()+secret.slice(1)]&&!!saved.get(url)?.[marker]});
          }
        }
        return response(saved.get(url)||{pushplusEnabled:false,hasPushplusToken:false,barkServer:'https://api.day.app',server:'https://ntfy.sh',webhookTemplates});
      }
      assert.match(url,/\/notifications\?/);
      if(options.method==='POST'){
        const body=JSON.parse(options.body);writes.push({url,body});
        if(nextPost){const handle=nextPost;nextPost=null;return handle(body);}
        saved.set(url,{available:true,watching:body.requests!=='off'||body.completion==='on',notifyOnCompletion:body.completion==='on',...body});
      }
      return response(saved.get(url)||{available:true,watching:false,notifyOnCompletion:false,requests:'inherit',completion:'inherit'});
    }});
  require('./fixtures/codex-entry-predicates.cjs')(context);
  for(const file of ['web/hosts/environment.js','web/hosts/browser-navigation.js','web/shared/locales/en.js','web/shared/locales/ko-KR.js','web/shared/locales/zh-CN.js','web/shared/locales/legacy.js','web/shared/i18n.js','web/features/chat/list-sync.js','web/features/accounts/account.js','web/features/chat/modes.js','web/features/chat/attachments.js','web/features/chat/activity.js','web/features/chat/fast-mode.js','web/features/chat/message-actions.js','web/features/chat/permissions.js','web/features/chat/account-usage.js','web/features/chat/composer-commands.js','web/shell/app.js']){
    let source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    if(skipStartup&&file==='web/shell/app.js')source=source.replace('startFromLink(initialPairingToken);initialPairingToken=null;','initialPairingToken=null;');
    vm.runInContext(source,context);
  }
  await new Promise(setImmediate);
  const run=code=>vm.runInContext(code,context);
  return {nodes,channelButtons,writes,saved,run,html,response,archiveToggles,listRequests,sessionStore,localStore,acknowledgements,setList:handle=>{listResponse=handle;},setPost:handle=>{nextPost=handle;},setGet:handle=>{nextGet=handle;},
    async open(id='11111111-1111-4111-8111-111111111111',host='local'){
      await run(`openChat(${JSON.stringify(id)},${JSON.stringify(host)})`);await new Promise(setImmediate);
    },
    save:()=>nodes.get('notify-form').onsubmit({preventDefault(){}}),
    settings:()=>vm.runInContext('openChatNotifications()',context)};
}

test('homepage retains the archive checkbox and automatic/steer mode labels',async()=>{
  const ui=await fixture();
  assert.match(ui.html, /id="archived" type="checkbox"/);
  for(const text of ['최근의','프로젝트','기본 전송','현재 작업 조종','기본 모드','계획 모드','목표 모드'])assert.ok(ui.html.includes(text));
});

test('request and completion choices are independent and persist',async()=>{
  const ui=await fixture();await ui.open();await ui.settings();
  assert.equal(ui.nodes.get('notify-completion').value,'inherit');
  ui.nodes.get('notify-enabled').value='off';ui.nodes.get('notify-completion').value='on';await ui.save();
  assert.deepEqual(ui.writes[0].body,{requests:'off',completion:'on'});
  assert.equal(ui.nodes.get('notify-dialog').open,false);
  await ui.open();await ui.settings();
  assert.equal(ui.nodes.get('notify-enabled').value,'off');assert.equal(ui.nodes.get('notify-completion').value,'on');
  ui.nodes.get('notify-enabled').value='inherit';ui.nodes.get('notify-completion').value='off';await ui.save();
  assert.deepEqual(ui.writes[1].body,{requests:'inherit',completion:'off'});
});

test('completion choices are isolated by chat and host; cancelling sends nothing',async()=>{
  const ui=await fixture();await ui.open();await ui.settings();
  ui.nodes.get('notify-enabled').value='on';ui.nodes.get('notify-completion').value='on';await ui.save();
  await ui.open(undefined,'remote:test');await ui.settings();
  assert.equal(ui.nodes.get('notify-completion').value,'inherit');
  ui.nodes.get('notify-enabled').value='on';await ui.save();
  assert.match(ui.writes[1].url,/host=remote%3Atest/);
  assert.equal(ui.writes[1].body.completion,'inherit');
  await ui.open('22222222-2222-4222-8222-222222222222');await ui.settings();
  assert.equal(ui.nodes.get('notify-enabled').value,'inherit');
  ui.nodes.get('notify-enabled').value='on';ui.nodes.get('notify-completion').value='on';ui.nodes.get('notify-dialog').close();
  await ui.settings();assert.equal(ui.nodes.get('notify-enabled').value,'inherit');assert.equal(ui.writes.length,2);
});

test('failed saves keep the dialog and draft choice for retry',async()=>{
  const ui=await fixture();await ui.open();await ui.settings();
  ui.nodes.get('notify-enabled').value='on';ui.nodes.get('notify-completion').value='on';
  ui.setPost(()=>ui.response({error:'Cannot save'},409));await ui.save();
  assert.equal(ui.nodes.get('notify-dialog').open,true);
  assert.equal(ui.nodes.get('notify-error').textContent,'Cannot save');
  assert.equal(ui.nodes.get('notify-save').disabled,false);
  assert.equal(ui.nodes.get('notify-completion').value,'on');
  await ui.save();assert.equal(ui.nodes.get('notify-dialog').open,false);
});

test('late save responses cannot change or close another chat notification dialog',async()=>{
  const ui=await fixture();await ui.open();await ui.settings();
  ui.nodes.get('notify-enabled').value='on';ui.nodes.get('notify-completion').value='on';
  let finish;ui.setPost(()=>new Promise(resolve=>{finish=resolve;}));const saving=ui.save();
  await ui.open('22222222-2222-4222-8222-222222222222','remote:test');
  assert.equal(ui.nodes.get('notify-dialog').open,false);await ui.settings();
  finish(ui.response({available:true,watching:true,notifyOnCompletion:true}));await saving;
  assert.equal(ui.nodes.get('notify-dialog').open,true);
  assert.equal(ui.nodes.get('notify-enabled').value,'inherit');
});

test('notification controls have English translations and language changes preserve choices',async()=>{
  const ui=await fixture();await ui.open();await ui.settings();
  ui.nodes.get('notify-enabled').value='on';ui.nodes.get('notify-completion').value='on';
  ui.nodes.get('phone-language').value='en';ui.nodes.get('phone-language').onchange();
  const dialog=ui.html.match(/<dialog id="notify-dialog"[\s\S]*?<\/dialog>/)[0];
  for(const [,text] of dialog.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)){
    assert.notEqual(ui.run(`BridgeI18n.t(${JSON.stringify(text)})`),text);
  }
  assert.equal(ui.nodes.get('notify-completion').value,'on');
  assert.equal(ui.writes.length,0);
});


test('third-party notification channels save independently, mask secrets and test the selected saved channel',async()=>{
  const ui=await fixture();await ui.open();
  await ui.nodes.get('pushplus-settings').onclick();
  assert.equal(ui.nodes.get('notification-channels-dialog').open,true);
  await ui.channelButtons[2].onclick();
  assert.equal(ui.nodes.get('pushplus-dialog').open,true);
  ui.nodes.get('pushplus-enabled').checked=true;ui.nodes.get('pushplus-token').value='secret';
  await ui.nodes.get('pushplus-form').onsubmit({preventDefault(){}});
  assert.deepEqual(ui.writes[0].body,{pushplusEnabled:true,pushplusToken:'secret',clearPushplusToken:false});
  assert.equal(ui.nodes.get('pushplus-token').value,'');
  assert.equal(ui.nodes.get('pushplus-token').placeholder,'저장되어 있습니다. 유지하려면 비워 두세요.');
  await ui.nodes.get('pushplus-test').onclick();assert.equal(ui.writes[1].url,'/api/notifications/channels/pushplus/test');
  ui.nodes.get('notification-channel-back').onclick();await ui.channelButtons[0].onclick();
  assert.equal(ui.nodes.get('notification-server').value,'https://api.day.app');
  ui.nodes.get('pushplus-enabled').checked=true;ui.nodes.get('pushplus-token').value='bark-secret';
  await ui.nodes.get('pushplus-form').onsubmit({preventDefault(){}});
  assert.deepEqual(ui.writes[2].body,{barkEnabled:true,barkKey:'bark-secret',clearBarkKey:false,barkServer:'https://api.day.app'});
  await ui.nodes.get('pushplus-test').onclick();assert.equal(ui.writes[3].url,'/api/notifications/channels/bark/test');
  ui.nodes.get('pushplus-token').value='retry-token';
  ui.setPost(()=>ui.response({error:'Network failure'},400));
  await ui.nodes.get('pushplus-form').onsubmit({preventDefault(){}});
  assert.equal(ui.nodes.get('pushplus-token').value,'retry-token');
  assert.equal(ui.nodes.get('pushplus-error').textContent,'Network failure');
});

test('Webhook form validates headers, redacts saved credentials, and tests saved settings',async()=>{
  const ui=await fixture();await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  assert.equal(ui.nodes.get('webhook-dialog').open,true);
  ui.nodes.get('webhook-enabled').checked=true;
  ui.nodes.get('webhook-url').value='https://example.test/hook?token=secret';
  ui.nodes.get('webhook-headers').value='{bad';
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes.length,0);assert.match(ui.nodes.get('webhook-error').textContent,/JSON/);
  ui.nodes.get('webhook-headers').value='{"Authorization":"Bearer secret"}';
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.deepEqual(ui.writes[0].body.webhookHeaders,{Authorization:'Bearer secret'});
  assert.equal(ui.writes[0].body.webhookUrl,'https://example.test/hook?token=secret');
  assert.equal(ui.nodes.get('webhook-url').value,'');assert.equal(ui.nodes.get('webhook-headers').value,'');
  assert.equal(ui.nodes.get('webhook-url-saved').textContent.includes('secret'),false);
  await ui.nodes.get('webhook-test').onclick();assert.equal(ui.writes[1].url,'/api/notifications/channels/webhook/test');
  assert.deepEqual(ui.writes[1].body,{webhookId:'legacy'});
  ui.nodes.get('webhook-clear-url').checked=true;ui.nodes.get('webhook-clear-headers').checked=true;
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes[2].body.clearWebhookUrl,true);assert.equal(ui.writes[2].body.clearWebhookHeaders,true);
  assert.equal(ui.nodes.get('webhook-clear-url').checked,false);
});

test('Webhook save failure retains unsaved endpoint and headers',async()=>{
  const ui=await fixture();await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  ui.nodes.get('webhook-url').value='https://example.test/hook';ui.nodes.get('webhook-headers').value='{"X-Key":"secret"}';
  ui.setPost(()=>ui.response({error:'Save failed'},400));
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.nodes.get('webhook-url').value,'https://example.test/hook');
  assert.equal(ui.nodes.get('webhook-headers').value,'{"X-Key":"secret"}');
  assert.equal(ui.nodes.get('webhook-error').textContent,'Save failed');
});

test('Feishu preset and signing secret require save before a Webhook test',async()=>{
  const ui=await fixture();await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  ui.nodes.get('webhook-provider').value='feishu';ui.nodes.get('webhook-sign-enabled').checked=true;
  ui.nodes.get('webhook-sign-secret').value='sample-secret';
  ui.nodes.get('webhook-use-template').onclick();
  await ui.nodes.get('webhook-test').onclick();
  assert.equal(ui.writes.length,0);assert.match(ui.nodes.get('webhook-error').textContent,/저장/);
  ui.setPost(()=>ui.response({error:'Save failed'},400));
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.nodes.get('webhook-sign-secret').value,'sample-secret');
  assert.equal(ui.nodes.get('webhook-sign-enabled').checked,true);
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes[1].body.webhookProvider,'feishu');
  assert.equal(ui.writes[1].body.webhookSignEnabled,true);
  assert.equal(ui.writes[1].body.webhookSignSecret,'sample-secret');
  assert.deepEqual(JSON.parse(ui.writes[1].body.webhookBodyTemplate),{msg_type:'text',content:{text:'{{title}}\n{{body}}\n{{url}}'}});
  assert.equal(ui.nodes.get('webhook-sign-secret').value,'');
  assert.equal(ui.nodes.get('webhook-sign-saved').textContent.includes('sample-secret'),false);
  ui.nodes.get('webhook-clear-sign-secret').checked=true;
  await ui.nodes.get('webhook-test').onclick();assert.equal(ui.writes.length,2);
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes[2].body.clearWebhookSignSecret,true);
  assert.equal(ui.nodes.get('webhook-clear-sign-secret').checked,false);
});

test('provider preset changes known templates but preserves custom JSON',async()=>{
  const ui=await fixture();await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  const provider=ui.nodes.get('webhook-provider'),body=ui.nodes.get('webhook-body-template');
  provider.value='discord';provider.onchange();assert.equal(body.value,'{"content":"{{body}}"}');
  body.value='{"custom":"{{event_id}}"}';provider.value='telegram';provider.onchange();
  assert.equal(body.value,'{"custom":"{{event_id}}"}');
  ui.nodes.get('webhook-use-template').onclick();assert.equal(body.value,'{"chat_id":"","text":"{{body}}"}');
});

test('empty multi-Webhook list retains server-provided preset templates',async()=>{
  const ui=await fixture(),templates={generic:'{"event":"{{event}}"}',discord:'{"content":"{{body}}"}'};
  ui.saved.set('/api/notifications/channels/webhook',{webhookEndpoints:[],webhookTemplates:templates});
  await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  assert.equal(ui.nodes.get('webhook-endpoints').hidden,true);
  ui.nodes.get('webhook-provider').value='discord';ui.nodes.get('webhook-provider').onchange();
  assert.equal(ui.nodes.get('webhook-body-template').value,templates.discord);
  ui.nodes.get('webhook-url').value='https://example.test/hook';await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.nodes.get('webhook-endpoints').hidden,false);
  assert.match(ui.html,/id="webhook-add" class="plain"/);
});

test('revealing a saved Webhook URL keeps the test clean and sends no URL update',async()=>{
  const ui=await fixture(),channel='/api/notifications/channels/webhook';
  ui.saved.set(channel,{webhookEnabled:true,hasWebhookUrl:true,webhookUrlDisplay:'https://example.test',webhookProvider:'generic',webhookBodyTemplate:'{"event":"{{event}}"}',webhookTemplates:{generic:'{"event":"{{event}}"}'}});
  await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  ui.setPost(()=>ui.response({webhookUrl:'https://example.test/hook?token=private'}));
  await ui.nodes.get('webhook-url-eye').onclick();
  assert.equal(ui.nodes.get('webhook-url').type,'text');
  assert.equal(ui.run('webhookDirty()'),false);
  await ui.nodes.get('webhook-test').onclick();assert.equal(ui.writes[1].url,channel+'/test');
  await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes[2].body.webhookUrl,'');
  assert.equal(ui.nodes.get('webhook-url').value,'');
});

test('late URL reveal cannot overwrite a newer Webhook draft',async()=>{
  const ui=await fixture(),channel='/api/notifications/channels/webhook';
  ui.saved.set(channel,{hasWebhookUrl:true,webhookUrlDisplay:'https://example.test',webhookTemplates:{generic:'{"event":"{{event}}"}'}});
  await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  let complete;ui.setPost(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=ui.nodes.get('webhook-url-eye').onclick();
  ui.nodes.get('webhook-url').value='https://other.test/hook';ui.nodes.get('webhook-url').dispatchEvent({type:'input'});
  complete(ui.response({webhookUrl:'https://example.test/hook?token=private'}));await pending;
  assert.equal(ui.nodes.get('webhook-url').value,'https://other.test/hook');
  assert.equal(ui.run('webhookDirty()'),true);
});

test('named Webhooks save, switch, test and delete by stable ID without exposing URLs',async()=>{
  const ui=await fixture(),channel='/api/notifications/channels/webhook',templates={generic:'{"event":"{{event}}"}'};
  ui.saved.set(channel,{webhookTemplates:templates,webhookEndpoints:[{webhookId:'legacy',webhookName:'Default Webhook',webhookEnabled:true,webhookProvider:'generic',webhookBodyTemplate:templates.generic,hasWebhookUrl:true,webhookUrlDisplay:'https://example.test',webhookTemplates:templates},{webhookId:'named-2',webhookName:'Ops',webhookProvider:'generic',webhookBodyTemplate:templates.generic,webhookTemplates:templates}]});
  await ui.nodes.get('pushplus-settings').onclick();await ui.channelButtons[3].onclick();
  const buttons=ui.nodes.get('webhook-endpoint-list').children;
  assert.equal(buttons.length,2);assert.equal(buttons[0].textContent.includes('token'),false);
  ui.nodes.get('webhook-name').value='Draft';buttons[1].onclick();assert.match(ui.nodes.get('webhook-error').textContent,/저장/);
  ui.nodes.get('webhook-cancel').onclick();buttons[1].onclick();assert.equal(ui.nodes.get('webhook-name').value,'Ops');
  ui.nodes.get('webhook-name').value='Ops alerts';await ui.nodes.get('webhook-form').onsubmit({preventDefault(){}});
  assert.equal(ui.writes[0].body.webhookId,'named-2');assert.equal(ui.writes[0].body.webhookName,'Ops alerts');
  await ui.nodes.get('webhook-test').onclick();assert.deepEqual(ui.writes[1].body,{webhookId:'named-2'});
  await ui.nodes.get('webhook-delete').onclick();assert.deepEqual(ui.writes[2].body,{action:'delete',webhookId:'named-2'});
});

test('Webhook form has English labels and narrow-screen scroll styling',async()=>{
  const ui=await fixture();
  ui.run("BridgeI18n.setLanguage('en')");
  const dialog=ui.html.match(/<dialog id="webhook-dialog"[\s\S]*?<\/dialog>/)[0];
  for(const [,label] of dialog.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g))assert.notEqual(ui.run(`BridgeI18n.t(${JSON.stringify(label)})`),label);
  const css=fs.readFileSync(path.join(__dirname,'../web/shell/content.css'),'utf8');
  assert.match(css,/#webhook-dialog\{[^}]*overflow-y:auto/);
  assert.match(css,/#webhook-dialog textarea\{[^}]*width:100%/);
  assert.match(dialog,/maxlength="4096"/);
  assert.match(dialog,/\{\{title\}\}/);
  for(const error of ['잘못된 웹훅 엔드포인트 URL.','웹훅 요청 헤더가 잘못되었습니다.','웹훅 JSON 본문 템플릿이 잘못되었습니다.','웹훅 템플릿에 알 수 없는 자리 표시자가 포함되어 있습니다.','Webhook을 활성화하기 전에 엔드포인트 URL를 입력하세요.','웹훅 테스트에 실패했습니다. 엔드포인트, 인증, 네트워크를 확인하세요.'])assert.notEqual(ui.run(`BridgeI18n.t(${JSON.stringify(error)})`),error);
  assert.equal(ui.run("BridgeI18n.t('Feishu는 알림을 수락하지 않았습니다.（19022：잘못된 서명 또는 시간）')"),'Feishu did not accept the notification (19022: Invalid signature or timestamp).');
  assert.equal(ui.run("BridgeI18n.t('DingTalk가 알림을 수락하지 않았습니다.（400101：액세스 토큰이 잘못되었습니다.）')"),'DingTalk did not accept the notification (400101: Invalid access token).');
  assert.equal(ui.run("BridgeI18n.t('Discord 알림이 수락되지 않음（HTTP 404）')"),'Discord did not accept the notification (HTTP 404).');
});

test('common notification controls save once outside provider detail',async()=>{
  const ui=await fixture();await ui.nodes.get('pushplus-settings').onclick();
  ui.nodes.get('notification-security-enabled').checked=true;
  ui.nodes.get('notification-address-enabled').checked=false;
  ui.nodes.get('notification-address-name').value='Home gateway';
  ui.nodes.get('notification-include-title').checked=true;
  ui.nodes.get('notification-click-base').value='https://bridge.example';
  await ui.nodes.get('notification-common-save').onclick();
  assert.deepEqual(ui.writes[0].body,{securityEnabled:true,addressEnabled:false,addressName:'Home gateway',includeTitle:true,clickBase:'https://bridge.example'});
  assert.equal(ui.nodes.get('notification-channels-dialog').open,true);
});

test('provider list reports configured and enabled states',async()=>{
  const ui=await fixture();
  ui.saved.set('/api/notifications/channels/bark',{barkEnabled:true,hasBarkKey:true});
  ui.saved.set('/api/notifications/channels/ntfy',{enabled:false,topic:'saved-topic'});
  ui.saved.set('/api/notifications/channels/webhook',{webhookEndpoints:[{webhookId:'named-1',webhookName:'Ops',hasWebhookUrl:true,webhookEnabled:true}]});
  await ui.nodes.get('pushplus-settings').onclick();
  assert.equal(ui.nodes.get('notification-status-bark').textContent,'켜짐');
  assert.equal(ui.nodes.get('notification-status-ntfy').textContent,'꺼짐');
  assert.equal(ui.nodes.get('notification-status-pushplus').textContent,'구성되지 않음');
  assert.equal(ui.nodes.get('notification-status-webhook').textContent,'켜짐');
});

test('common settings wait for a valid read and ignore late responses after close',async()=>{
  const ui=await fixture();let finish;
  ui.setGet(url=>url.endsWith('/common')?new Promise(resolve=>{finish=resolve;}):ui.response({}));
  const opening=ui.nodes.get('pushplus-settings').onclick();
  assert.equal(ui.nodes.get('notification-common-save').disabled,true);
  await ui.nodes.get('notification-common-save').onclick();
  assert.equal(ui.writes.length,0);
  ui.nodes.get('notification-channels-dialog').close();
  finish(ui.response({securityEnabled:false,addressEnabled:false,addressName:'old',includeTitle:false,clickBase:''}));
  await opening;
  assert.equal(ui.nodes.get('notification-common-save').disabled,true);
  ui.saved.set('/api/notifications/channels/common',{securityEnabled:true,addressEnabled:true,addressName:'new',includeTitle:true,clickBase:''});
  await ui.nodes.get('pushplus-settings').onclick();
  assert.equal(ui.nodes.get('notification-address-name').value,'new');
  assert.equal(ui.nodes.get('notification-common-save').disabled,false);
});

test('failed common read blocks save and permits explicit retry',async()=>{
  const ui=await fixture();
  ui.setGet(()=>ui.response({error:'Read failed'},500));
  await ui.nodes.get('pushplus-settings').onclick();
  assert.equal(ui.nodes.get('notification-common-save').disabled,true);
  assert.equal(ui.nodes.get('notification-common-retry').hidden,false);
  assert.equal(ui.nodes.get('notification-common-error').textContent,'Read failed');
  await ui.nodes.get('notification-common-save').onclick();
  assert.equal(ui.writes.length,0);
  await ui.nodes.get('notification-common-retry').onclick();
  assert.equal(ui.nodes.get('notification-common-save').disabled,false);
});

test('unconfigured channels still open chat policies instead of PushPlus',async()=>{
  const ui=await fixture();await ui.open();
  ui.saved.set('/api/sessions/11111111-1111-4111-8111-111111111111/notifications?host=local',{available:false,requests:'inherit',completion:'off'});
  await ui.settings();
  assert.equal(ui.nodes.get('notify-dialog').open,true);
  assert.equal(ui.nodes.get('pushplus-dialog').open,false);
});

test('plan feedback blocks execution and submits its text to revision',async()=>{
  const ui=await fixture();await ui.open();
  const card=ui.run("renderPlanApproval({id:'plan',params:{planContent:'Original'}})");
  const descendants=n=>[n,...(n.children||[]).flatMap(descendants)];
  const all=descendants(card),input=all.find(n=>n.tagName==='TEXTAREA'),buttons=all.filter(n=>n.tagName==='BUTTON');
  assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,true);
  input.value='Add recovery checks';input.oninput();
  assert.equal(buttons[0].disabled,true);assert.equal(buttons[1].className,'primary');
  await buttons[0].onclick();assert.equal(ui.writes.length,0);
  await buttons[1].onclick();assert.deepEqual(ui.writes[0].body,{requestId:'plan',response:{action:'revise',text:'Add recovery checks'}});
});

test('accepted interaction bumps recent order while merely rendering does not',async()=>{
  const ui=await fixture();
  ui.run("listRows=[{id:'new',host:'local',title:'New',recency:200},{id:'old',host:'local',title:'Old',recency:100}];renderList()");
  assert.equal(ui.run('listRows[0].id'),'new');
  ui.run("bumpRecency('old','local',300)");assert.equal(ui.run('listRows[0].id'),'old');
  ui.run("bumpRecency('old','local',150)");assert.equal(ui.run('listRows[0].recency'),300);
});

const sessionPage=(start,count)=>({sessions:Array.from({length:count},(_,i)=>({id:'chat-'+(start+i),host:'local',title:'Chat '+(start+i),projectKey:'project',projectName:'Project',recency:10000-start-i})),unavailableHosts:[]});

test('refresh retains unchanged chat nodes but renders title and selection updates',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');const first=root.children[0];
  await ui.run('loadList(true)');assert.equal(root.children[0],first);
  ui.run("listRows[0].title='Renamed';renderList()");assert.notEqual(root.children[0],first);assert.equal(root.children[0].children[0].textContent,'Renamed');
  ui.run("currentId='chat-0';renderList()");assert.match(root.children[0].className,/selected/);
  root.replaceChildren();ui.run('renderList()');assert.equal(root.children.filter(row=>row.dataset?.id).length,100);
});

test('chat list scroll loads one page at a time, preserves position and stops at the end',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:12000});
  const replace=root.replaceChildren;root.replaceChildren=function(...items){replace.apply(this,items);this.scrollTop=0;};
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');
  assert.equal(ui.nodes.has('more'),false);assert.equal(ui.listRequests.length,1);
  root.scrollTop=600;root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,1);
  let finish;ui.setList(()=>new Promise(resolve=>{finish=resolve;}));root.scrollTop=11500;
  for(let i=0;i<5;i++)root.dispatchEvent({type:'scroll'});
  assert.equal(ui.listRequests.length,2);assert.match(ui.listRequests[1],/offset=100/);
  finish(ui.response(sessionPage(100,20)));await new Promise(setImmediate);
  assert.equal(root.children.filter(row=>row.dataset?.id).length,120);assert.equal(root.scrollTop,11500);
  root.dispatchEvent({type:'scroll'});await new Promise(setImmediate);assert.equal(ui.listRequests.length,2);
});

test('failed continuation retains rows and retries the same page on a new scroll',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:12000});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');
  ui.setList(()=>ui.response({error:'Offline'},503));root.scrollTop=11500;root.dispatchEvent({type:'scroll'});await new Promise(setImmediate);
  assert.equal(root.children.filter(row=>row.dataset?.id).length,100);assert.equal(ui.nodes.get('toast').textContent,'');assert.match(ui.nodes.get('host-errors').children[0].children[0].textContent,/Offline/);assert.equal(ui.listRequests.length,2);
  ui.setList(()=>ui.response(sessionPage(100,10)));root.dispatchEvent({type:'scroll'});await new Promise(setImmediate);
  assert.equal(ui.listRequests[2],ui.listRequests[1]);assert.equal(root.children.filter(row=>row.dataset?.id).length,110);
});

test('failed refresh keeps the loaded page available for scroll continuation',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:12000});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');
  ui.setList(()=>ui.response({error:'Offline'},503));assert.equal(await ui.run('loadList(true)'),false);
  assert.equal(root.children.filter(row=>row.dataset?.id).length,100);
  ui.setList(()=>ui.response(sessionPage(100,20)));root.scrollTop=11500;root.dispatchEvent({type:'scroll'});await new Promise(setImmediate);
  assert.match(ui.listRequests[2]||'',/offset=100/);assert.equal(root.children.filter(row=>row.dataset?.id).length,120);
});

test('new filters start at the top, including a retry after their first request fails',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:12000});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');root.scrollTop=9000;
  await ui.run('loadList(true)');assert.equal(root.scrollTop,9000);
  ui.nodes.get('search').value='new';ui.setList(()=>ui.response({error:'Offline'},503));
  assert.equal(await ui.run('loadList(true)'),false);
  root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,3);
  ui.setList(()=>ui.response(sessionPage(200,20)));await ui.run('loadList(true)');assert.equal(root.scrollTop,0);
  root.scrollTop=1200;ui.nodes.get('archived').checked=true;await ui.run('loadList(true)');assert.equal(root.scrollTop,0);
});

test('horizontal, cancelled and multi-touch gestures do not load a page',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:200});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');
  for(const kind of ['horizontal','cancel','multi']){
    root.dispatchEvent({type:'touchstart',touches:[{clientX:20,clientY:100}]});
    if(kind==='horizontal')root.dispatchEvent({type:'touchmove',touches:[{clientX:220,clientY:50}]});
    if(kind==='cancel')root.dispatchEvent({type:'touchcancel',touches:[]});
    if(kind==='multi')root.dispatchEvent({type:'touchmove',touches:[{clientX:20,clientY:50},{clientX:40,clientY:50}]});
    root.dispatchEvent({type:'touchmove',touches:[{clientX:20,clientY:40}]});
    root.dispatchEvent({type:'touchend',touches:[]});
  }
  await new Promise(setImmediate);assert.equal(ui.listRequests.length,1);
});

test('changed search and archive conditions block old continuation and discard its late response',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:12000});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');root.scrollTop=11500;
  ui.nodes.get('search').value='new';root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,1);
  ui.nodes.get('search').value='';ui.nodes.get('archived').checked=true;root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,1);
  ui.nodes.get('archived').checked=false;
  let finish;ui.setList(()=>new Promise(resolve=>{finish=resolve;}));root.dispatchEvent({type:'scroll'});
  ui.nodes.get('search').value='new';ui.nodes.get('archived').checked=true;
  ui.setList(()=>ui.response(sessionPage(200,2)));await ui.run('loadList(true)');
  assert.match(ui.listRequests[2],/q=new&offset=0&archived=true/);
  finish(ui.response(sessionPage(100,100)));await new Promise(setImmediate);
  assert.equal(root.children.filter(row=>row.dataset?.id).length,2);assert.equal(root.children[0].dataset.id,'chat-200');
  root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,3);
});

test('downward gestures load more when collapsed projects cannot scroll, without loading while hidden',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  Object.assign(root,{clientHeight:400,scrollHeight:200});
  ui.setList(()=>ui.response(sessionPage(0,100)));await ui.run('loadList(true)');
  ui.nodes.get('app').hidden=true;root.dispatchEvent({type:'wheel',deltaY:100});assert.equal(ui.listRequests.length,1);
  ui.nodes.get('app').hidden=false;ui.run("clientNavigation.provider='claude'");root.dispatchEvent({type:'scroll'});assert.equal(ui.listRequests.length,1);
  ui.run("clientNavigation.provider='codex'");root.dispatchEvent({type:'wheel',deltaY:-100});assert.equal(ui.listRequests.length,1);
  ui.setList(()=>ui.response(sessionPage(100,100)));root.dispatchEvent({type:'wheel',deltaY:100});await new Promise(setImmediate);
  assert.equal(ui.listRequests.length,2);assert.equal(root.children.filter(row=>row.dataset?.id).length,200);
  ui.setList(()=>ui.response(sessionPage(200,1)));
  root.dispatchEvent({type:'touchstart',touches:[{clientY:100,clientX:20}]});
  root.dispatchEvent({type:'touchmove',touches:[{clientY:40,clientX:20}]});await new Promise(setImmediate);
  assert.equal(ui.listRequests.length,3);assert.match(ui.listRequests[2],/offset=200/);assert.equal(root.children.filter(row=>row.dataset?.id).length,201);
});

test('local and fast SSH chats paint while another host is still reading',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  const row=(id,host,recency)=>({id,host,title:id,projectKey:host,projectName:host,recency});
  let release;
  ui.setList(url=>{
    const host=new URL(url,'http://test').searchParams.get('host');
    if(host==='local')return ui.response({sessions:[row('local-chat','local',3)],remoteHosts:['remote-fast','remote-slow'],availableSources:['desktop'],unavailableHosts:[],complete:true,notificationRead:{streamId:'s',cursor:12}});
    if(host==='remote-fast')return ui.response({sessions:[row('fast-chat',host,2)],availableSources:['cli'],unavailableHosts:[],complete:true});
    return new Promise(resolve=>{release=()=>resolve(ui.response({sessions:[row('slow-chat',host,1)],availableSources:[],unavailableHosts:[],complete:true}));});
  });
  const pending=ui.run('loadList(true)');await new Promise(setImmediate);
  assert.deepEqual(root.children.map(child=>child.dataset.id),['local-chat','fast-chat']);
  assert.equal(ui.run('listOffset'),2);assert.equal(ui.run('listComplete'),false);assert.equal(ui.acknowledgements.length,0);
  release();await pending;
  assert.deepEqual(root.children.map(child=>child.dataset.id),['local-chat','fast-chat','slow-chat']);
  assert.equal(ui.run('listOffset'),3);assert.equal(ui.run('listComplete'),true);
  assert.equal(ui.acknowledgements.length,1);
});

test('cold local empty result remains loading until the remote result is known',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  let release;
  ui.setList(url=>new URL(url,'http://test').searchParams.get('host')==='local'
    ?ui.response({sessions:[],remoteHosts:['remote-slow'],availableSources:[],unavailableHosts:[],complete:true})
    :new Promise(resolve=>{release=()=>resolve(ui.response({sessions:[],availableSources:[],unavailableHosts:[],complete:true}));}));
  const pending=ui.run('loadList(true)');await new Promise(setImmediate);
  assert.equal(root.children[0].textContent,ui.run("t('로드 중…')"));assert.equal(ui.run('listComplete'),false);
  release();await pending;assert.equal(root.children[0].textContent,ui.run("t('채팅을 찾을 수 없습니다.')"));
});

test('refresh preserves all loaded pages and their scroll position',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  const all=sessionPage(0,151).sessions;
  ui.setList(url=>{
    const offset=Number(new URL(url,'http://test').searchParams.get('offset'));
    return ui.response({sessions:all.slice(0,offset+101),remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true});
  });
  await ui.run('loadList(true)');assert.equal(root.children.filter(child=>child.dataset.id).length,100);
  await ui.run('loadList()');assert.equal(root.children.filter(child=>child.dataset.id).length,151);
  root.scrollTop=3000;await ui.run('loadList(true)');
  assert.equal(root.children.filter(child=>child.dataset.id).length,151);assert.equal(root.scrollTop,3000);
  assert.match(ui.listRequests.at(-1),/offset=51/);
});

test('partial empty and failed remote never claim no chats or discard earlier rows',async()=>{
  const ui=await fixture(),root=ui.nodes.get('sessions');ui.nodes.get('app').hidden=false;
  const remote={id:'saved',host:'remote-a',title:'Saved',projectKey:'p',projectName:'P',recency:1};
  ui.setList(url=>new URL(url,'http://test').searchParams.get('host')==='local'
    ?ui.response({sessions:[],remoteHosts:['remote-a'],availableSources:[],unavailableHosts:[],complete:true})
    :ui.response({sessions:[remote],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await ui.run('loadList(true)');assert.equal(root.children[0].dataset.id,'saved');
  let release;
  ui.setList(url=>new URL(url,'http://test').searchParams.get('host')==='local'
    ?ui.response({sessions:[],remoteHosts:['remote-a'],availableSources:[],unavailableHosts:[],complete:true})
    :new Promise(resolve=>{release=()=>resolve(ui.response({sessions:[],availableSources:[],unavailableHosts:[{host:'remote-a',label:'Remote A',error:'Offline'}],complete:false}));}));
  const pending=ui.run('loadList(true)');await new Promise(setImmediate);
  assert.equal(root.children[0].dataset.id,'saved');assert.equal(ui.run('listComplete'),false);
  release();assert.equal(await pending,false);
  assert.equal(root.children[0].dataset.id,'saved');assert.equal(ui.run('listOffset'),1);
  assert.equal(ui.run('listComplete'),false);assert.equal(ui.acknowledgements.length,1);
});

test('refresh keeps a dismissed SSH fault dismissed while that host is pending',async()=>{
  const ui=await fixture(),root=ui.nodes.get('host-errors');ui.nodes.get('app').hidden=false;
  ui.run("dismissedHostFaults.set('|remote-a','Offline')");
  let release;
  ui.setList(url=>new URL(url,'http://test').searchParams.get('host')==='local'
    ?ui.response({sessions:[],remoteHosts:['remote-a'],availableSources:[],unavailableHosts:[],complete:true})
    :new Promise(resolve=>{release=()=>resolve(ui.response({sessions:[],availableSources:[],unavailableHosts:[{host:'remote-a',label:'Remote A',error:'Offline'}],complete:false}));}));
  const pending=ui.run('loadList(true)');await new Promise(setImmediate);
  assert.equal(ui.run("dismissedHostFaults.get('|remote-a')"),'Offline');
  release();assert.equal(await pending,false);
  assert.equal(root.hidden,true);assert.equal(ui.run("dismissedHostFaults.get('|remote-a')"),'Offline');
});

test('list snapshot is restored only after matching authenticated gateway and session',async()=>{
  const sessionStore=new Map(),localStore=new Map(),first=await fixture({sessionStore,localStore,skipStartup:true});first.nodes.get('app').hidden=false;
  first.run("listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'"+'a'.repeat(64)+"'})");
  first.setList(()=>first.response({sessions:[{id:'saved',host:'local',title:'Saved',projectKey:'p',projectName:'P',recency:1}],remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await first.run('loadList(true)');assert.equal(localStore.size,1);assert.deepEqual([...sessionStore.keys()],['bridge-browser-navigation']);
  const second=await fixture({sessionStore,localStore,skipStartup:true});assert.equal(second.run('restoreListSnapshot()'),false);
  second.run("listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'"+'b'.repeat(64)+"'})");
  assert.equal(second.run('restoreListSnapshot()'),false);
  second.run("listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'"+'a'.repeat(64)+"'})");
  assert.equal(second.run('listIdentity'),first.run('listIdentity'));
  assert.equal(second.run('currentListFilter()'),first.run('currentListFilter()'));
  assert.equal(second.run('restoreListSnapshot()'),true);assert.equal(second.nodes.get('sessions').children[0].dataset.id,'saved');
  second.run('clearListSnapshot()');assert.deepEqual([...sessionStore.keys()],['bridge-browser-navigation']);assert.equal([...localStore.keys()].some(key=>key.startsWith('codex-list-v1:')),false);
});

test('Codex list snapshot survives a new storage session and remains scoped to its authenticated computer',async()=>{
  const localStore=new Map(),a='a'.repeat(64),b='b'.repeat(64);
  const first=await fixture({localStore,skipStartup:true});first.nodes.get('app').hidden=false;
  first.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${a}'})`);
  first.setList(()=>first.response({sessions:[{id:'saved-a',host:'ssh:a',title:'Computer A',projectKey:'p',projectName:'P',recency:1}],remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await first.run('loadList(true)');
  const second=await fixture({localStore,skipStartup:true});
  assert.equal(second.run('restoreListSnapshot()'),false,'unknown identity cannot paint private rows');
  second.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${b}'})`);
  assert.equal(second.run('restoreListSnapshot()'),false,'computer B cannot paint A rows');
  second.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${a}'})`);
  assert.equal(second.run('restoreListSnapshot()'),true,'returning to A restores before a network read');
  assert.equal(second.nodes.get('sessions').children[0].dataset.id,'saved-a');
  assert.equal(second.listRequests.length,0);
});

test('independent Codex profiles restore only their own cached list',async()=>{
  const ui=await fixture({skipStartup:true}),a='codex:'+'a'.repeat(32),b='codex:'+'b'.repeat(32);
  ui.nodes.get('app').hidden=false;
  ui.run("listIdentity='"+'f'.repeat(64)+"';selectedCodexEntry='"+a+"'");
  ui.setList(()=>ui.response({sessions:[{id:'profile-chat',host:a,title:'Project A',projectKey:'p',projectName:'P',recency:1}],remoteHosts:[],availableSources:['ide'],unavailableHosts:[],complete:true}));
  await ui.run('loadList(true)');
  assert.equal(ui.run("selectedCodexEntry='"+b+"';restoreListSnapshot()"),false);
  assert.equal(ui.run('selectedCodexEntry=null;restoreListSnapshot()'),false);
  assert.equal(ui.run("selectedCodexEntry='"+a+"';restoreListSnapshot()"),true);
  assert.equal(ui.nodes.get('sessions').children[0].dataset.id,'profile-chat');
});

test('legacy Codex tab snapshot migrates after authenticated reentry',async()=>{
  const identity='a'.repeat(64),key=`codex-list-v1:${identity}:["",false,"all","recent"]`;
  const sessionStore=new Map([[key,JSON.stringify({rows:[{id:'legacy',host:'local',title:'Legacy',projectKey:'p',projectName:'P',recency:1}],sources:['desktop'],hosts:[],offset:1,hasMore:false})]]),localStore=new Map();
  const ui=await fixture({sessionStore,localStore,skipStartup:true});
  assert.equal(ui.run('restoreListSnapshot()'),false);
  ui.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${identity}'})`);
  assert.equal(ui.run('restoreListSnapshot()'),true);
  assert.equal(ui.nodes.get('sessions').children[0].dataset.id,'legacy');
  assert.equal(localStore.has(key),true);assert.equal(sessionStore.has(key),false);
});

test('oversized or malformed Codex snapshots cannot block authenticated list startup',async()=>{
  const identity='a'.repeat(64),key=`codex-list-v1:${identity}:["",false,"all","recent"]`;
  const valid={rows:[{id:'saved',host:'local',title:'Saved',projectKey:'p',projectName:'P',recency:1}],sources:['desktop'],hosts:[],offset:1,hasMore:false};
  const localStore=new Map([[key,JSON.stringify({...valid,rows:[{...valid.rows[0],title:'X'.repeat(600*1024)}]})]]);
  const sessionStore=new Map(),ui=await fixture({localStore,sessionStore,skipStartup:true});
  ui.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${identity}'})`);
  assert.equal(ui.run('restoreListSnapshot()'),false);
  localStore.set(key,JSON.stringify({...valid,rows:Array.from({length:201},(_,i)=>({...valid.rows[0],id:String(i)}))}));
  assert.equal(ui.run('restoreListSnapshot()'),false);
  localStore.set(key,'{broken');sessionStore.set(key,JSON.stringify(valid));
  assert.equal(ui.run('restoreListSnapshot()'),true);
  assert.equal(ui.nodes.get('sessions').children[0].dataset.id,'saved');
  assert.equal(sessionStore.has(key),false);
});

test('refreshes without any successful host retain the previous durable snapshot',async()=>{
  const localStore=new Map(),ui=await fixture({localStore,skipStartup:true});ui.nodes.get('app').hidden=false;
  ui.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${'a'.repeat(64)}'})`);
  ui.setList(()=>ui.response({sessions:[{id:'saved',host:'local',title:'Saved',projectKey:'p',projectName:'P',recency:1}],remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await ui.run('loadList(true)');const saved=[...localStore.values()][0];
  ui.setList(()=>ui.response({error:'offline'},503));assert.equal(await ui.run('loadList(true)'),false);
  assert.equal([...localStore.values()][0],saved);
  ui.setList(()=>ui.response({sessions:[],remoteHosts:[],availableSources:[],unavailableHosts:[{host:'local',error:'partial'}],complete:false}));
  assert.equal(await ui.run('loadList(true)'),false);assert.equal([...localStore.values()][0],saved);
});

test('HTTP 401 clears durable Codex snapshots while transient list failure does not',async()=>{
  const localStore=new Map(),ui=await fixture({localStore,skipStartup:true});ui.nodes.get('app').hidden=false;
  ui.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${'a'.repeat(64)}'})`);
  ui.setList(()=>ui.response({sessions:[{id:'saved',host:'local',title:'Saved',projectKey:'p',projectName:'P',recency:1}],remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await ui.run('loadList(true)');assert.equal([...localStore.keys()].some(key=>key.startsWith('codex-list-v1:')),true);
  ui.setList(()=>ui.response({error:'temporary'},503));assert.equal(await ui.run('loadList(true)'),false);
  assert.equal([...localStore.keys()].some(key=>key.startsWith('codex-list-v1:')),true);
  ui.setList(()=>ui.response({error:'login required'},401));await ui.run('loadList(true)');
  assert.equal([...localStore.keys()].some(key=>key.startsWith('codex-list-v1:')),false);
});

test('durable Codex list snapshots stay bounded across filters and oversized rows',async()=>{
  const localStore=new Map(),ui=await fixture({localStore,skipStartup:true});
  ui.run(`listIdentity=listAuthIdentity({authenticated:true,listCacheIdentity:'${'a'.repeat(64)}'})`);
  ui.run("listRows=[{id:'saved',host:'local',title:'Saved',recency:1}];availableSources=['desktop'];listHostIds=[];listOffset=1;listHasMore=false");
  for(let i=0;i<9;i++)ui.run(`saveListSnapshot(JSON.stringify(['filter-${i}','all','all','recent']))`);
  const keys=[...localStore.keys()].filter(key=>key.startsWith('codex-list-v1:'));
  assert.equal(keys.length,8);assert.equal(keys.some(key=>key.includes('filter-0')),false);
  ui.run("listRows=[{id:'huge',host:'local',title:'X'.repeat(600*1024),recency:1}]");
  ui.run("saveListSnapshot(JSON.stringify(['oversized','all','all','recent']))");
  assert.equal([...localStore.keys()].some(key=>key.includes('oversized')),false);
});

test('LAN HTTP list snapshots use the server identity without Web Crypto',async()=>{
  const ui=await fixture({skipStartup:true});
  assert.equal(ui.run("listAuthIdentity({authenticated:true,listCacheIdentity:'"+'c'.repeat(64)+"'})"),'c'.repeat(64));
  assert.equal(ui.run("listAuthIdentity({authenticated:false,listCacheIdentity:'"+'c'.repeat(64)+"'})"),'');
  assert.equal(ui.run("listAuthIdentity({authenticated:true,listCacheIdentity:'unsafe'})"),'');
});

test('logout cache cleanup removes desktop provider snapshots with Codex snapshots',async()=>{
  const sessionStore=new Map([['desktop-list-v1:secret:gateway:claude','private'],['codex-list-v1:secret:all','private'],['unrelated','keep']]);
  const localStore=new Map([['desktop-list-v1:secret:gateway:claude','private'],['desktop-list-v1:secret:gateway:deepseek','private'],['codex-list-v1:secret:all','private'],['unrelated','keep']]);
  const ui=await fixture({sessionStore,localStore,skipStartup:true});ui.run('clearListSnapshot()');
  assert.ok(sessionStore.get('bridge-browser-navigation'));
  assert.deepEqual([...sessionStore].filter(([key])=>key!=='bridge-browser-navigation'), [['unrelated','keep']]);
  assert.deepEqual([...localStore], [['unrelated','keep']]);
});


test('recent pins and project inventory have separate snapshots during offline fallback',async()=>{
  const ui=await fixture({skipStartup:true});ui.nodes.get('app').hidden=false;
  ui.run(`listIdentity='${'a'.repeat(64)}'`);
  const row=id=>({id,host:'local',title:id,projectKey:'p',projectName:'P',recency:1,bridgePinned:id==='old-pin'});
  ui.setList(url=>ui.response({sessions:[row(new URL(url,'http://fixture').searchParams.get('order')==='recent'?'old-pin':'recent-project')],remoteHosts:[],availableSources:['desktop'],unavailableHosts:[],complete:true}));
  await ui.run('loadList(true)');const recentFilter=ui.run('currentListFilter()');
  ui.nodes.get('list-mode').value='project';await ui.run('loadList(true)');const projectFilter=ui.run('currentListFilter()');
  assert.notEqual(recentFilter,projectFilter);assert.equal([...ui.localStore.keys()].filter(key=>key.startsWith('codex-list-v1:')).length,2);
  ui.setList(()=>{throw Error('offline');});
  ui.nodes.get('list-mode').value='recent';assert.equal(await ui.run('loadList(true)'),false);
  assert.equal(ui.run('listRows[0].id'),'old-pin');
  ui.nodes.get('list-mode').value='project';assert.equal(await ui.run('loadList(true)'),false);
  assert.equal(ui.run('listRows[0].id'),'recent-project');
});

test('a list generation keeps its captured mode for delayed remote host reads',async()=>{
  const ui=await fixture({skipStartup:true});ui.nodes.get('app').hidden=false;
  let resolveLocal;
  ui.setList(url=>new URL(url,'http://fixture').searchParams.get('host')==='local'?new Promise(resolve=>{resolveLocal=resolve;}):ui.response({sessions:[],availableSources:[],complete:true}));
  const pending=ui.run('loadList(true)');await new Promise(setImmediate);
  ui.nodes.get('list-mode').value='project';
  resolveLocal(ui.response({sessions:[],remoteHosts:['ssh:fixture'],availableSources:[],complete:true}));await pending;
  assert.equal(ui.listRequests.length,2);assert.ok(ui.listRequests.every(url=>new URL(url,'http://fixture').searchParams.get('order')==='recent'));
});
