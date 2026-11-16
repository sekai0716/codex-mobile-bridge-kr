// Synthetic presentation data only. No credentials or native account operations.
(()=>{
const usage=(a,b,n)=>({status:'ready',checkedAt:Date.now()/1000,limits:[{name:'Codex',windows:[{windowDurationMins:300,remainingPercent:a},{windowDurationMins:10080,remainingPercent:b}]}],resetCredits:{availableCount:n,credits:null}});
const data={accounts:[{id:'official',name:'직장 계정',kind:'chatgpt',email:'work@example.com',planType:'Plus',details:{usage:usage(82,64,3)}},{id:'backup',name:'백업 계정',kind:'chatgpt',email:'demo@example.com',planType:'Plus',details:{usage:usage(46,71,1)}},{id:'api',name:'개발하다 API',kind:'api',baseUrl:'https://api.example.com/v1',model:'gemini-2.5-pro'}],current:{status:'ready',kind:'chatgpt',id:'official',name:'직장 계정'},activeId:'official',switch:{phase:'idle'},canSwitch:true,codexHome:'/Users/try2love/.codex'};
window.fixtureAccounts=data;
window.fixtureAccountRequest=async value=>{
 if(!['list','details','models','scan','switch'].includes(value.action))throw Error(demoText('이 작업은 데모에서는 활성화되지 않습니다. 실제 데이터를 수정하지 않습니다。','This operation is unavailable in the demo; real data is never changed.'));
 if(value.action==='models')return {...structuredClone(data),models:['gemini-2.5-flash','gemini-2.5-pro']};
 if(value.action==='details'&&value.section==='models'){const row=data.accounts.find(r=>r.id===value.id);row.details||={};row.details.models={status:'ready',models:(row.kind==='api'?['gemini-2.5-flash','gemini-2.5-pro']:['gpt-6.1-sol','gpt-6-astra']).map(id=>({id,name:id}))};}
 if(value.action==='scan')data.discovery={candidates:[{id:'source-api',kind:'api',name:'로컬 머신 API 설정',baseUrl:'https://api.example.com/v1',model:'gemini-2.5-pro',source:'/Users/try2love/.codex'}],warnings:[]};
 if(value.action==='switch'){const row=data.accounts.find(r=>r.id===value.id);data.current={status:'ready',kind:row.kind,id:row.id,name:row.name};data.activeId=row.id;}
 return structuredClone(data);
};
window.fixtureUsage=()=>({visible:true,accountKey:'example',email:'work@example.com',planType:'Plus',...usage(82,64,3),canReset:false,updatedAt:Date.now()/1000});
})();
