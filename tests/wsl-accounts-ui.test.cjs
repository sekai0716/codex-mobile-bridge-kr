'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.value='';this.dataset={};this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}remove(){}focus(){}
}
const source=fs.readFileSync('web/features/accounts/wsl-accounts.js','utf8');
function panel({read=async entry=>snapshot(entry),request=async()=>({}),desktop=false,onSwitched,provider='codex'}={}){const ctx={document:{createElement:tag=>new Node(tag),addEventListener(){},removeEventListener(){}},BridgeI18n:{t:key=>key,locale:()=> 'en'},Date};vm.createContext(ctx);vm.runInContext(source+'\nthis.Panel=WslAccountsPanel',ctx);return new ctx.Panel({root:new Node('div'),provider,read,request,desktop,onSwitched});}
function snapshot(entry){return{provider:'codex',entry,identity:'identity-'+entry,target:{distribution:'Ubuntu',user:'user',configDir:'/home/user/.codex'},available:true,blockers:[],capabilities:{save:true,import:true,switch:true,models:true},accounts:[{id:'saved',kind:'api',name:'Saved'}]};}
function all(node){return[node,...node.children.flatMap(child=>child instanceof Node?all(child):[])];}
test('a late previous-environment snapshot cannot overwrite the selected scope',async()=>{let resolve;const p=panel({read:entry=>entry==='old'?new Promise(done=>resolve=done):Promise.resolve(snapshot(entry))});const old=p.select('old');await p.select('new');resolve(snapshot('old'));await old;assert.equal(p.entry,'new');assert.equal(p.value.entry,'new');});
test('clear invalidates pending mutation and clears API fields',async()=>{let resolve;const sent=[];const p=panel({desktop:true,request:value=>{sent.push(value);return new Promise(done=>resolve=done);}});await p.select('old');p.key.value='secret';const pending=p.perform('save-api',{apiKey:p.key.value});assert.equal(p.key.value,'');p.select('new');resolve(snapshot('old'));await pending;assert.equal(p.entry,'new');assert.equal(p.value.entry,'new');assert.equal(sent[0].apiKey,'');});
test('authenticated web exposes credential enrollment alongside saved switches and models',async()=>{const p=panel();await p.select('wsl');const nodes=all(p.root);assert.equal(nodes.some(node=>node.tagName==='input'),true);assert.equal(nodes.some(node=>node.textContent==='이 계정으로 전환'),true);assert.equal(nodes.some(node=>node.textContent==='업스트림 모델 나열'),true);});
test('models are queried only by explicit action and retain timestamp cache',async()=>{const calls=[];const p=panel({request:async value=>{calls.push({...value});return{models:[{id:'model-a'}],cache:{state:'fresh',updatedAt:100}};}});await p.select('wsl');assert.equal(calls.length,0);await p.perform('models',{id:'saved'});p.render();assert.equal(calls.length,1);assert.equal(calls[0].entry,'wsl');assert.equal(Object.hasOwn(calls[0],'expectedIdentity'),false);assert.equal(p.models.get('saved').cache.updatedAt,100);});
test('unavailable environment cannot mutate and mismatched snapshot is rejected',async()=>{let writes=0;const p=panel({read:async entry=>({...snapshot(entry),available:false}),request:async()=>{writes++;}});await p.select('wsl');await p.perform('switch',{id:'saved'});assert.equal(writes,0);const mismatch=panel({read:async()=>snapshot('other')});await mismatch.select('wsl');assert.equal(mismatch.value,null);assert.match(mismatch.error,/WSL 계정 결과가 선택한 환경과 일치하지 않습니다\./);});
test('desktop import explicitly lists public sources and binds selected identity',async()=>{const calls=[];const p=panel({desktop:true,request:async value=>{calls.push({...value});return value.action==='import-sources'?{sources:[{id:'source-a',name:'Office API',source:'Desktop',sourceIdentity:'source-digest'}]}:snapshot('wsl');}});await p.select('wsl');assert.equal(calls.length,0);await p.perform('import-sources');assert.equal(p.sources[0].sourceIdentity,'source-digest');const select=all(p.root).find(node=>node.tagName==='select'&&node.children.some(option=>option.value==='source-a'));assert.ok(select);select.value='source-a';const form=all(p.root).find(node=>node.tagName==='form'&&node.children.some(child=>child.children?.includes(select)));assert.ok(form);form.onsubmit({preventDefault(){}});await Promise.resolve();assert.equal(calls.at(-1).action,'import-api');assert.equal(calls.at(-1).sourceId,'source-a');assert.equal(calls.at(-1).sourceIdentity,'source-digest');});
test('native snapshot is restored by switch and never renamed or deleted',async()=>{const p=panel({desktop:true,read:async entry=>({...snapshot(entry),accounts:[{id:'native',kind:'native',name:'Original login'}]})});await p.select('wsl');const texts=all(p.root).map(node=>node.textContent);assert.equal(texts.includes('이름 바꾸기'),false);assert.equal(texts.includes('삭제'),false);assert.equal(texts.includes('현재 네이티브 액세스 저장'),false);assert.equal(texts.includes('이 계정으로 전환'),true);});
test('model requests match the strict public HTTP schema while switches bind identity',async()=>{const calls=[];const allowed=new Set(['provider','entry','action','id','refresh']);const p=panel({request:async value=>{if(value.action==='models'){for(const key of Object.keys(value))assert.ok(allowed.has(key),'unexpected public models field '+key);calls.push({...value});return{provider:'codex',entry:'wsl',models:[]};}assert.equal(value.expectedIdentity,'identity-wsl');calls.push({...value});return snapshot('wsl');}});await p.select('wsl');await p.perform('models',{id:'saved',refresh:true});assert.deepEqual(Object.keys(calls[0]).sort(),['action','entry','id','provider','refresh']);await p.perform('switch',{id:'saved'});assert.equal(calls[1].expectedIdentity,'identity-wsl');});
test('native access explains original CLI models without an unsupported model action',async()=>{const p=panel({read:async entry=>({...snapshot(entry),accounts:[{id:'native',kind:'native',name:'Original login'}]})});await p.select('wsl');const nodes=all(p.root);assert.equal(nodes.some(node=>node.tagName==='button'&&node.textContent==='업스트림 모델 나열'),false);assert.ok(nodes.some(node=>node.textContent==='원본 CLI에서 네이티브 로그인 모델을 확인하세요. 기존 채팅은 모델을 유지합니다.'));});
test('model details preserve upstream names and reported efforts without inventing missing levels',async()=>{const p=panel({request:async()=>({models:[{id:'model-id',name:'Reasoning Model',efforts:['low',{id:'high',name:'High'}]},{id:'unknown-effort'}],cache:{updatedAt:100,state:'fresh'}})});await p.select('wsl');await p.perform('models',{id:'saved'});const nodes=all(p.root);assert.ok(nodes.some(node=>node.tagName==='li'&&node.textContent==='Reasoning Model · model-id'));assert.ok(nodes.some(node=>node.tagName==='small'&&node.textContent==='추론 강도: low / High'));assert.ok(nodes.some(node=>node.tagName==='small'&&node.textContent==='추론 강도: 업스트림에서 보고되지 않음'));assert.ok(nodes.some(node=>node.tagName==='small'&&node.textContent.startsWith('업데이트 날짜:')));});
test('environment heading and concise status keep safety blockers visible',async()=>{const p=panel({read:async entry=>({...snapshot(entry),activeVerified:false,sharedWithDesktop:false,verification:{status:'pending'},blockers:['Finish active tasks first']})});await p.select('wsl');const nodes=all(p.root),texts=nodes.map(node=>node.textContent);assert.equal(nodes.find(node=>node.tagName==='h3').textContent,'WSL · Codex CLI');assert.ok(texts.includes('Ubuntu · user · /home/user/.codex'));assert.equal(texts.filter(text=>text==='로그인 유효성이 확인되지 않았습니다.').length,1);assert.equal(texts.includes('WSL 구성이 로드되었습니다. 로그인 유효성은 확인에 따라 달라집니다.'),false);assert.ok(texts.includes('Finish active tasks first'));assert.ok(nodes.find(node=>node.textContent==='이 계정으로 전환').disabled);assert.ok(texts.some(text=>text?.includes('확인 상태: pending')&&text.includes('이 WSL 구성은 로컬 액세스와 별개입니다.')));});

test('empty desktop profiles expose add form despite switch-only blockers',async()=>{const p=panel({desktop:true,read:async entry=>({...snapshot(entry),accounts:[],blockers:['Custom routing'],capabilities:{save:true,import:true,capture:false,switch:false,models:true}})});await p.select('wsl');const nodes=all(p.root);assert.ok(nodes.find(node=>node.tagName==='details'&&node.children.some(c=>c.textContent==='WSL API 액세스 추가')).open);assert.ok(nodes.some(node=>node.textContent==='API 액세스 저장'));assert.equal(nodes.some(node=>node.textContent==='현재 네이티브 액세스 저장'),false);assert.ok(nodes.some(node=>node.textContent==='추가하거나 가져오면 현재 계정을 전환하지 않고도 프로필이 저장됩니다.'));});

test('exact native recovery capability does not permit switching other saved APIs',async()=>{
  const calls=[];const p=panel({read:async entry=>({...snapshot(entry),blockers:['Ambiguous legacy provider'],capabilities:{switch:false,restore:true},accounts:[{id:'native',kind:'native',name:'Original'},{id:'saved',kind:'api',name:'Saved'}]}),request:async value=>{calls.push({...value});return snapshot('wsl');}});
  await p.select('wsl');const switches=all(p.root).filter(node=>node.tagName==='button'&&node.textContent==='이 계정으로 전환');
  assert.equal(switches.length,1);assert.equal(switches[0].disabled,false);switches[0].onclick();
  await all(p.root).find(node=>node.textContent==='스위치 확인').onclick();
  assert.equal(calls.length,1);assert.equal(calls[0].id,'native');assert.equal(calls[0].expectedIdentity,'identity-wsl');
});

test('additional native credentials explain restoration without blocking a saved API switch',async()=>{
  const notice='이 프로필은 추가 자격 증명을 사용합니다. 첫 번째 스위치는 나중에 복원할 수 있도록 전체를 보존합니다.';
  const p=panel({desktop:true,read:async entry=>({...snapshot(entry),captureNotice:notice,capabilities:{save:true,import:true,capture:false,switch:true,models:true}})});
  await p.select('wsl');const nodes=all(p.root);
  assert.ok(nodes.some(node=>node.textContent===notice));
  assert.equal(nodes.some(node=>node.textContent==='현재 네이티브 액세스 저장'),false);
  assert.equal(nodes.find(node=>node.textContent==='이 계정으로 전환').disabled,false);
  assert.ok(nodes.some(node=>node.textContent==='API 액세스 저장'));
});

test('web empty profiles retain add and explicit import actions despite switch blockers',async()=>{const p=panel({read:async entry=>({...snapshot(entry),accounts:[],blockers:['Finish active tasks'],capabilities:{save:true,import:true,capture:false,switch:false}})});await p.select('wsl');const texts=all(p.root).map(node=>node.textContent);assert.ok(texts.includes('API 액세스 저장'));assert.ok(texts.includes('이 컴퓨터에서 API 액세스 가져오기'));assert.ok(texts.includes('추가하거나 가져오면 현재 계정을 전환하지 않고도 프로필이 저장됩니다.'));assert.ok(texts.includes('Ubuntu · user · /home/user/.codex'));});

test('web active profiles allow rename while editing and deleting only inactive profiles',async()=>{
  const p=panel({read:async entry=>({...snapshot(entry),activeId:'current',accounts:[{id:'current',kind:'api',name:'Current',active:true},{id:'saved',kind:'api',name:'Saved'}]})});await p.select('wsl');
  const cards=all(p.root).filter(node=>node.tagName==='section'),labels=card=>all(card).filter(node=>node.tagName==='button').map(node=>node.textContent);
  assert.equal(labels(cards[0]).includes('편집'),false);assert.equal(labels(cards[0]).includes('삭제'),false);assert.ok(labels(cards[0]).includes('이름 바꾸기'));
  assert.ok(labels(cards[1]).includes('편집'));assert.ok(labels(cards[1]).includes('삭제'));
});
test('passwordless capabilities hide all WSL credential management actions',async()=>{
  const p=panel({read:async entry=>({...snapshot(entry),capabilities:{save:false,import:false,capture:false,switch:false,restore:false,models:true}})});await p.select('wsl');
  const nodes=all(p.root),texts=nodes.map(node=>node.textContent);assert.equal(nodes.some(node=>node.tagName==='input'),false);
  for(const label of ['편집','삭제','이름 바꾸기','API 액세스 저장','현재 네이티브 액세스 저장','이 컴퓨터에서 API 액세스 가져오기','이 계정으로 전환'])assert.equal(texts.includes(label),false);
  assert.ok(texts.includes('업스트림 모델 나열'));
});
test('web explicitly imports a selected public source identity without exposing its key',async()=>{
  const calls=[];const p=panel({request:async value=>{calls.push({...value});return value.action==='import-sources'?{sources:[{id:'local-api',name:'Office',sourceIdentity:'public-source-digest'}]}:snapshot('wsl');}});await p.select('wsl');
  assert.equal(calls.length,0);await p.perform('import-sources');
  const select=all(p.root).find(node=>node.tagName==='select'&&node.children.some(option=>option.value==='local-api'));select.value='local-api';
  const form=all(p.root).find(node=>node.tagName==='form'&&node.children.some(child=>child.children?.includes(select)));form.onsubmit({preventDefault(){}});await Promise.resolve();
  assert.equal(calls.at(-1).action,'import-api');assert.equal(calls.at(-1).sourceId,'local-api');assert.equal(calls.at(-1).sourceIdentity,'public-source-digest');assert.equal(calls.at(-1).apiKey,undefined);
});
test('web edits an inactive API without reading back a saved key',async()=>{
  const p=panel();await p.select('wsl');all(p.root).find(node=>node.textContent==='편집').onclick();
  assert.equal(p.key.type,'password');assert.equal(p.key.value,'');assert.equal(p.key.required,false);assert.equal(p.key.placeholder,'기존 키를 유지하려면 비워 두세요.');
});

test('fresh idle-release attempts remain explicit and available despite runtime blockers',async()=>{
  const calls=[];const p=panel({read:async entry=>({...snapshot(entry),blockers:['Native process remains running'],configurationBlockers:[],runtimeBlockers:['Native process remains running'],capabilities:{switch:false,restore:false,attemptSwitch:true,attemptRestore:true},accounts:[{id:'native',kind:'native',name:'Original'},{id:'saved',kind:'api',name:'Saved'}]}),request:async value=>{calls.push({...value});return snapshot('wsl');}});
  await p.select('wsl');const attempts=all(p.root).filter(node=>node.tagName==='button'&&node.textContent==='확인하고 전환하세요');assert.equal(attempts.length,2);assert.ok(attempts.every(node=>!node.disabled));
  assert.equal(calls.length,0);attempts[1].onclick();assert.equal(calls.length,0);
  const confirmation=all(p.root).find(node=>node.className==='wsl-account-confirm');assert.ok(all(confirmation).some(node=>node.textContent==='선택한 WSL 구성 디렉터리의 작업, 승인 및 확인되지 않은 전송이 확인됩니다. 공유 서비스는 모든 것이 유휴 상태인 경우에만 정상적으로 다시 시작됩니다. 원래 터미널 연결을 다시 연결해야 할 수도 있습니다. 어떤 프로세스도 강제로 종료되지 않습니다.'));
  await all(confirmation).find(node=>node.tagName==='button'&&node.textContent==='확인하고 전환하세요').onclick();assert.equal(calls.length,1);assert.equal(calls[0].action,'switch');assert.equal(calls[0].id,'saved');assert.equal(calls[0].expectedIdentity,'identity-wsl');
});
test('restore attempt capability does not enable a different saved API',async()=>{
  const p=panel({read:async entry=>({...snapshot(entry),blockers:['Native process remains running'],capabilities:{switch:false,restore:false,attemptSwitch:false,attemptRestore:true},accounts:[{id:'native',kind:'native',name:'Original'},{id:'saved',kind:'api',name:'Saved'}]})});await p.select('wsl');
  const actions=all(p.root).filter(node=>node.tagName==='button'&&node.textContent==='확인하고 전환하세요');assert.equal(actions.length,1);assert.equal(actions[0].disabled,false);
});

test('draft continuity callbacks require a verified switch or completed prior transaction result',async()=>{
  const continued=[],payload={...snapshot('wsl'),draftContinuations:[{id:'sid',previousAccountIdentity:'old',accountIdentity:'new'}]};
  const p=panel({onSwitched:value=>continued.push(value),request:async value=>value.action==='switch'?{...payload,continuationPending:true,continuationError:'Refresh continuity'}:payload});await p.select('wsl');assert.equal(continued.length,0);
  await p.perform('models',{id:'saved'});assert.equal(continued.length,0);await p.perform('switch',{id:'saved'});assert.equal(continued.length,0);assert.equal(p.error,'Refresh continuity');
  p.read=async()=>payload;await p.refresh();assert.equal(continued.length,1);
});

test('refresh keeps an unfinished continuation warning visible without migrating drafts',async()=>{
 let migrated=0;const p=panel({read:async entry=>({...snapshot(entry),continuationPending:true,continuationError:'Continuity still unverified'}),onSwitched:()=>migrated++});await p.select('wsl');assert.equal(p.error,'Continuity still unverified');await p.refresh();assert.equal(p.error,'Continuity still unverified');assert.equal(migrated,0);
});

test('Codex restart confirmation is distinct from releasing a Claude gateway executor',async()=>{
  const p=panel({read:async entry=>({...snapshot(entry),restartRequired:true,capabilities:{switch:true}})});await p.select('wsl');all(p.root).find(node=>node.textContent==='이 계정으로 전환').onclick();const box=all(p.root).find(node=>node.className==='wsl-account-confirm');assert.ok(all(box).some(node=>node.textContent?.includes('원래 터미널 연결을 다시 연결해야 할 수도 있습니다. 어떤 프로세스도 강제로 종료되지 않습니다.')));assert.equal(all(box).some(node=>node.textContent?.includes('이 게이트웨이의 유휴 실행자')),false);assert.ok(all(box).some(node=>node.tagName==='button'&&node.textContent==='확인하고 전환하세요'));
});

test('Claude attempt confirmation retains its exact gateway-executor wording',async()=>{
 const p=panel({provider:'claude',read:async entry=>({...snapshot(entry),provider:'claude',capabilities:{switch:false,attemptSwitch:true},blockers:['Own idle executor remains']})});await p.select('wsl');all(p.root).find(node=>node.textContent==='확인하고 전환하세요').onclick();const box=all(p.root).find(node=>node.className==='wsl-account-confirm');assert.ok(all(box).some(node=>node.textContent==='먼저 이 게이트웨이의 유휴 실행기를 릴리스합니다. 외부 CLI 프로세스 또는 확인되지 않은 작업으로 인해 여전히 전환이 차단될 수 있습니다.'));assert.equal(all(box).some(node=>node.textContent?.includes('공유 서비스를 정상적으로 다시 시작')),false);
});

test('applied Codex configuration exposes explicit service recovery instead of repeating the switch',async()=>{
 const calls=[],p=panel({read:async entry=>({...snapshot(entry),restartPending:true,restartError:'Service recovery pending',capabilities:{switch:true,recoverRestart:true}}),request:async value=>{calls.push({...value});return snapshot('wsl');}});await p.select('wsl');assert.equal(p.error,'Service recovery pending');assert.equal(all(p.root).some(node=>node.textContent==='이 계정으로 전환'),false);
 all(p.root).find(node=>node.textContent==='공유 서비스 확인 및 복구').onclick();assert.equal(calls.length,0);await all(p.root).find(node=>node.textContent==='서비스 복구 확인').onclick();assert.equal(calls.length,1);assert.equal(calls[0].action,'recover-restart');assert.equal(calls[0].expectedIdentity,'identity-wsl');assert.equal(calls[0].id,undefined);assert.equal(calls[0].apiKey,undefined);
});

test('Codex restartPending never signals completed continuity before explicit recovery succeeds',async()=>{
 let continued=0;const calls=[],p=panel({onSwitched:()=>continued++,request:async value=>{calls.push({...value});return value.action==='switch'?{...snapshot('wsl'),restartPending:true,restartError:'Applied; recovery pending',capabilities:{recoverRestart:true}}:snapshot('wsl');}});await p.select('wsl');await p.perform('switch',{id:'saved'});assert.equal(continued,0);assert.equal(p.error,'Applied; recovery pending');assert.equal(p.value.restartPending,true);await p.perform('recover-restart');assert.equal(continued,1);assert.deepEqual(calls.map(value=>value.action),['switch','recover-restart']);
});

test('stopped WSL starts only through the explicit selected-environment button',async()=>{
 const calls=[],p=panel({read:async entry=>({...snapshot(entry),available:false,capabilities:{connect:true}}),request:async value=>{calls.push({...value});return snapshot(value.entry);}});
 await p.select('stopped');await p.refresh();assert.equal(calls.length,0);
 await p.perform('switch',{id:'saved'});assert.equal(calls.length,0);
 const connect=all(p.root).find(node=>node.textContent==='WSL 시작 및 연결');assert.ok(connect);assert.equal(connect.disabled,false);
 await connect.onclick();assert.equal(calls.length,1);assert.deepEqual(calls[0],{provider:'codex',entry:'stopped',action:'connect'});assert.equal(p.value.available,true);
 assert.equal(all(p.root).some(node=>node.textContent==='WSL 시작 및 연결'),false);
});
