'use strict';
// Native clocks are epoch milliseconds or ISO instants with an explicit zone.
// Missing historical evidence stays missing; never substitute receipt/wall time.
function chatMessageDate(value){
  if(typeof value==='number'&&Number.isFinite(value)&&value>0)return new Date(value);
  if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value))return new Date(value);
  return null;
}
function renderChatMessageTime(container,value,now=new Date()){
  const date=chatMessageDate(value);if(!date||!Number.isFinite(date.getTime()))return;
  const locale=typeof BridgeI18n==='undefined'?'ko-KR':BridgeI18n.locale();
  const clock=[date.getHours(),date.getMinutes()].map(n=>String(n).padStart(2,'0')).join(':');
  const sameYear=date.getFullYear()===now.getFullYear(),sameDay=sameYear&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate();
  const prefix=sameDay?'':new Intl.DateTimeFormat(locale,{...(sameYear?{}:{year:'numeric'}),month:'numeric',day:'numeric'}).format(date)+' ';
  const time=document.createElement('time');time.className='message-time';time.dateTime=date.toISOString();time.textContent=prefix+clock;
  time.title=new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(date);
  time.setAttribute('aria-label',time.title);container.append(time);
}
function chatFollowsLatest(viewport){
  return viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<110;
}
function captureChatScrollAnchor(viewport,container,accept=()=>true){
  const top=viewport.getBoundingClientRect().top;
  let anchor=null;
  for(const node of container.children){
    if(node.hidden||node.dataset.key===undefined||!accept(node))continue;
    const rect=node.getBoundingClientRect();
    anchor={key:node.dataset.key,offset:rect.top-top};
    if(rect.bottom>top)break;
  }
  return anchor;
}
function restoreChatScrollAnchor(viewport,node,anchor){
  if(!node||node.hidden||!anchor)return false;
  viewport.scrollTop+=node.getBoundingClientRect().top-viewport.getBoundingClientRect().top-anchor.offset;
  return true;
}
function captureChatActivityState(node){
  const details=node?.tagName==='DETAILS'?node:node?.querySelector('details.activity');
  if(!details)return null;
  const body=details.querySelector('.activity-body');
  return {open:details.open,top:body?.scrollTop||0,left:body?.scrollLeft||0};
}
function restoreChatActivityState(node,state){
  if(!state)return;
  const details=node.tagName==='DETAILS'?node:node.querySelector('details.activity');
  if(!details)return;
  details.open=state.open;
  const body=details.querySelector('.activity-body');
  if(body){body.scrollTop=state.top;body.scrollLeft=state.left;}
}
// Stable row keys are local to this conversation container. Do not detach
// unchanged rows: even reattaching the same node resets nested scroll areas.
function syncChatMessageNodes(container,nodes){
  const previous=new Map([...container.children].filter(node=>node.dataset.key!==undefined).map(node=>[node.dataset.key,node]));
  const reading=new Map(),wanted=new Set(nodes);
  for(const node of nodes){
    const old=previous.get(node.dataset.key);
    if(old&&old!==node)reading.set(node,captureChatActivityState(old));
  }
  for(const node of [...container.children])if(!wanted.has(node))node.remove();
  let position=container.firstChild;
  for(const node of nodes){
    if(node===position)position=position.nextSibling;
    else{
      if(!reading.has(node))reading.set(node,captureChatActivityState(node));
      container.insertBefore(node,position);
    }
  }
  // Restore only changed/moved rows, after their new layout exists. Browsers
  // clamp offsets naturally when an updated activity becomes shorter.
  for(const [node,state] of reading)restoreChatActivityState(node,state);
}
// All chat surfaces render native task evidence through this shared indicator.
function chatLastNonEmptyLine(value){return typeof value==='string'?value.split(/[\r\n\u2028\u2029]+/).map(line=>line.trim()).filter(Boolean).at(-1)||'':'';}
function chatLatestReasoning(messages=[]){
  for(let index=messages.length-1;index>=0;index--){const message=messages[index];if(message.role==='user')break;if(message.role==='reasoning'||message.kind==='reasoning'){const line=chatLastNonEmptyLine(message.text);if(line)return line;}}
  return '';
}
function chatActivityLabel(row){
  const t=BridgeI18n.t,kind=row.kind||row.type,auto=kind==='autoContextCompaction';
  if(kind!=='contextCompaction'&&!auto)return t(row.title||kind)+(row.status==='inProgress'?t('· 진행중'):'');
  const status=row.status||(row.turnStatus==='completed'?'completed':null);
  const key=status==='inProgress'?(auto?'Automatically compacting context':'Compacting context'):status==='completed'?(auto?'Context automatically compacted':'Context compacted'):status==='failed'?'Context compaction failed':status==='interrupted'?'Context compaction interrupted':auto?'Automatic context compaction':'Context compaction';
  return t(key);
}
function renderChatProgress(node,{agentName='',active=false,waiting=false,blocked=false,connected=true,fresh=true,reasoningSummary='',reasoningScope=''}={}){
  const state=!connected||!fresh?'unknown':waiting?'waiting':active?'working':blocked?'blocked':'idle';
  const text={unknown:'실행 상태를 일시적으로 사용할 수 없습니다.',waiting:'귀하의 확인을 기다리고 있습니다',blocked:'작업이 차단되었습니다. 공지를 확인해주세요.',working:'Thinking',idle:''}[state];
  node.hidden=state==='idle';node.dataset.state=state;node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  node.classList.add('chat-progress');
  if(node._reasoningScope!==reasoningScope||!active||!connected||!fresh){node._reasoningLine='';node._reasoningScope=reasoningScope;}
  const incoming=chatLastNonEmptyLine(reasoningSummary);if(incoming&&active&&connected&&fresh)node._reasoningLine=incoming;
  const summary=state==='working'&&document.documentElement?.dataset?.showReasoning!=='false'?node._reasoningLine||'':'';
  const key=JSON.stringify([state,agentName,summary,BridgeI18n.language()]);if(node.dataset.progress===key)return state;node.dataset.progress=key;
  node.replaceChildren();if(state==='working'){const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');node.append(dot);}
  const label=document.createElement('span');label.className='chat-progress-label';label.textContent=[agentName,BridgeI18n.t(text)].filter(Boolean).join(' ');node.append(label);
  if(summary){const line=document.createElement('span');line.className='chat-progress-summary';line.textContent='ㆍ'+summary;line.title=summary;node.append(line);}
  return state;
}
class SessionActivity {
  constructor({storage=localStorage,key='bridge-session-activity'}={}){this.storage=storage;this.key=key;try{this.rows=JSON.parse(storage.getItem(key)||'{}');}catch{this.rows={};}}
  id(row){return row.host+'|'+row.id;}
  save(){try{this.storage.setItem(this.key,JSON.stringify(this.rows));}catch{}}
  update(rows,visible=null){
    for(const row of rows){
      const key=this.id(row),previous=this.rows[key],terminal=['completed','failed','interrupted'].includes(row.turnStatus);
      if(!row.connected){if(previous)previous.offline=true;continue;}
      const token=terminal&&row.turnId?row.turnId+':'+row.turnStatus:previous?.token||null;
      const pending=token&&previous&&(previous.turnKnown||previous.token||previous.status==='active')&&(token!==previous.token||previous.pending)?token:null;
      this.rows[key]={status:row.status,turnId:row.turnId||previous?.turnId,turnStatus:row.turnStatus||previous?.turnStatus,turnKnown:!!row.turnStatus||previous?.turnKnown||false,token,pending:visible===key?null:pending,offline:false};
    }
    this.save();
  }
  read(key){if(this.rows[key]){this.rows[key].pending=null;this.save();}}
  indicator(key){
    const row=this.rows[key];if(!row)return null;
    if(row.offline)return {kind:'unknown',label:'실행 상태를 일시적으로 사용할 수 없습니다.'};
    if(row.status==='active')return {kind:row.offline?'unknown':'running',label:row.offline?'실행 상태를 일시적으로 사용할 수 없습니다.':'실행 중'};
    if(row.pending)return {kind:row.turnStatus==='completed'?'completed':'ended',label:row.turnStatus==='completed'?'완료됨, 읽지 않음':row.turnStatus==='failed'?'실행 실패, 읽지 않음':'중지됨, 읽지 않음'};
    return null;
  }
  clear(){this.rows={};this.storage.removeItem(this.key);}
}
if(typeof module!=='undefined')module.exports={SessionActivity};
