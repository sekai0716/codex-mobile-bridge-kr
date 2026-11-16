'use strict';
// Public examples are isolated from installed clients and contain no credentials.
window.demoClients=['codex','claude','deepseek'].map((id,i)=>({id,name:['Codex','Claude','DeepSeek Harness'][i],enabled:true,installed:true,configured:true,selectable:true,connected:true,running:true,setupStatus:'ready',reason:"데스크톱에 연결됨"}));
window.demoClientAccounts=provider=>({provider,activeId:provider+'-demo',accounts:[{id:provider+'-demo',name:provider==='claude'?'Claude · Personal':'Harness · Workspace',active:true,kind:provider==='claude'?'oauth':'official',configured:true,usage:provider==='claude'?{limits:[{name:'Claude',windows:[{windowDurationMins:300,remainingPercent:73}]}]}:{balance:{wallets:[{currency:'CNY',remaining:'128.50'}]}}}],supported:true,canAdd:true,canEdit:true,canDelete:true});
window.demoClientSessions=provider=>[0,1].map((i)=>({id:provider+'-demo-'+i,title:demoText(i?'출판 체크리스트 정리':'제품 홈페이지 최적화',i?'Review the release checklist':'Refine the product homepage'),cwd:'/projects/website',backend:provider==='claude'?(i?'cowork':'code'):'code',status:i?'active':'idle',updatedAt:1791644400000-i*600000,requests:[],model:provider==='claude'?'Claude Sonnet':'DeepSeek',effort:'high',permissionMode:'default',contextUsage:provider==='claude'&&i?null:{usedTokens:24800,contextWindow:200000},contextUsageStatus:provider==='claude'&&i?'unsupported':'available',capabilities:{send:true,stop:true,models:true,permissions:true,attachments:true}}));
window.demoClientMessages=new Map();
window.demoClientRequest=(provider,action,body={},sid)=>{
 const sessions=demoClientSessions(provider),session=sessions.find(s=>s.id===sid)||sessions[0];
 const key=provider+':'+session.id;
 if(!demoClientMessages.has(key))demoClientMessages.set(key,[{id:'user-demo',role:'user',text:demoText('홈페이지에 대한 최적화 제안을 정리하는 데 도움을 주세요.。','Review the homepage improvements.')},{id:'assistant-demo',role:'assistant',text:demoText('세 가지 핵심 사항이 정리되었습니다.：\n\n1. 명확한 탐색 및 콘텐츠 계층 구조 유지。\n2. 휴대폰과 넓은 화면에서 편안하게 독서하세요。\n3. 파일을 통해、Git 변경 사항을 확인하기 위한 터미널 태그。\n\n이것은 샘플 세션입니다. 계속해서 입력하여 크로스 디바이스 워크벤치를 경험할 수 있습니다.。','Three priorities are ready:\n\n1. Keep navigation and content hierarchy clear.\n2. Make reading comfortable on phones and wide screens.\n3. Review changes in Files, Git and Terminal tabs.\n\nThis is a sample chat. Send a message to explore the workbench.')}]);
 if(action==='list')return {sessions,connected:true};
 if(action==='detail')return {connected:true,session,capabilities:session.capabilities,messages:demoClientMessages.get(key)};
 if(action==='send'){demoClientMessages.get(key).push({id:'user-'+Date.now(),role:'user',text:body.text},{id:'assistant-'+Date.now(),role:'assistant',text:demoText('받다. 이것은 로컬 모의 응답이므로 모델이 호출되지 않습니다.。','Received. This simulated reply does not call a model.')});return {status:'accepted'};}
 if(action==='catalog'||action==='account')return {models:[{id:session.model,name:session.model,efforts:['low','medium','high']}],currentModel:session.model,currentEffort:'high',skills:[]};
 if(action==='accounts')return demoClientAccounts(provider);
 if(action==='access')return {mode:'default',options:[{value:'default',label:demoText('기본 권한','Default permissions')},{value:'acceptEdits',label:demoText('파일 편집 허용','Allow file edits')}]};
 if(action==='notifications')return {requests:true,completion:true,available:true};
 if(action==='projects')return {projects:[{id:'website',name:'website',cwd:'/projects/website'}],surfaces:provider==='claude'?['code','cowork']:['code']};
 throw Error(demoText('이 작업은 데모에서는 활성화되지 않습니다. 실제 데이터를 수정하지 않습니다。','This operation is unavailable in the demo; real data is never changed.'));
};
