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
  // 펼친 묶음에서는 머리글과 개별 행을 기준으로 삼아 내부에 기록이
  // 추가되어도 사용자가 읽던 명령의 위치를 유지한다.
  const nodes=[...container.children].flatMap(node=>node.hidden?[]:node.dataset.activityGroup==='true'&&node.open
    ?[node.firstElementChild,...node.lastElementChild.children]:[node]);
  for(const node of nodes){
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
function chatActivityDetails(node){
  return node?.tagName==='DETAILS'&&!node.classList?.contains('computer-use')?node:node?.querySelector('details.activity');
}
function captureChatActivityState(node){
  const details=chatActivityDetails(node);
  if(!details)return null;
  const body=details.querySelector('.activity-body');
  const state={open:details.open,top:body?.scrollTop||0,left:body?.scrollLeft||0};
  if(details!==node&&node.tagName==='DETAILS')state.outerOpen=node.open;
  return state;
}
function restoreChatActivityState(node,state){
  if(!state)return;
  const details=chatActivityDetails(node);
  if(!details)return;
  if(details!==node&&node.tagName==='DETAILS')node.open=state.outerOpen??state.open;
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
// 원본 종류와 turn 경계로만 묶는다. 번역된 제목이나 명령 내용으로
// 종류를 추측하지 않으며, 이미지와 확인이 필요한 항목은 독립 행이다.
function chatActivityGroupKind(row){
  if(!['activity','fileChanges'].includes(row.role)||row.attachments?.length||['denied','declined'].includes(row.status)||row.approvalReview?.status==='denied')return null;
  // 컴퓨터 사용은 첨부 유무와 관계없이 호출 제목에서 바로 열 수 있어야 한다.
  if(row.fileSummary||row.computerUse)return null;
  if(row.role==='fileChanges')return 'files';
  switch(row.kind){
    case 'commandExecution':return 'commands';
    case 'fileChange':case 'FileChange':case 'fileChanges':return 'files';
    case 'webSearch':return 'web';
    case 'mcpToolCall':case 'dynamicToolCall':case 'storedToolEvent':return 'tools';
    default:return null;
  }
}
function groupChatActivityRows(rows){
  const units=[];let pending=[];
  const flush=()=>{if(pending.length){units.push({kind:pending.length>1?'group':'standalone',rows:pending});pending=[];}};
  for(const row of rows){
    if(row.kind==='reasoning'||row.kind==='automaticApprovalReview'&&(row.reviewLinked||row.approvalReview?.status==='approved'))continue;
    if(!chatActivityGroupKind(row)){flush();units.push({kind:'standalone',rows:[row]});continue;}
    if(pending.length&&pending[0].turnId!==row.turnId)flush();
    pending.push(row);
  }
  flush();return units;
}
function chatCommandFirstLine(row){
  return row.kind==='commandExecution'&&typeof row.text==='string'?row.text.split(/[\r\n\u2028\u2029]/,1)[0].trim():'';
}
// 묶음은 표시만 담당한다. 각 행의 노드·상세 조회·읽기 상태는 기존
// 타임라인에 남기고, 과거 페이지가 앞에 붙어도 같은 묶음을 재사용한다.
class ChatActivityGroups {
  constructor(onDisclosure=()=>{}){this.onDisclosure=onDisclosure;this.groups=new Map();this.members=new Map();this.previous=new Map();this.serial=0;}
  clear(){this.groups.clear();this.members.clear();this.previous.clear();}
  anchorNode(key){const group=this.groups.get(key);return group&&!group.node.hidden?group.summary:null;}
  rows(key){return this.groups.get(key)?.rows;}
  sync(container,entries){
    const byKey=new Map(entries.map(entry=>[entry.row.key,entry])),reading=new Map();
    for(const {row,node} of entries)reading.set(node,captureChatActivityState(this.previous.get(row.key)||node));
    const groups=new Map(),members=new Map(),nodes=[];
    for(const unit of groupChatActivityRows(entries.map(entry=>entry.row))){
      const items=unit.rows.map(row=>byKey.get(row.key));
      if(unit.kind==='standalone'){nodes.push(items[0].node);continue;}
      let group=unit.rows.map(row=>this.members.get(row.key)).find(group=>group&&!groups.has(group.node.dataset.key));
      if(!group){
        const node=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
        node.className='activity-group timeline-row';node.dataset.activityGroup='true';
        // 나중에 설명이 끼어 묶음이 나뉘어도 기존 묶음과 키가 겹치지 않는다.
        node.dataset.key='activity-group:'+unit.rows[0].key+':'+(++this.serial);
        summary.dataset.key=node.dataset.key;body.className='activity-group-items';
        const label=document.createElement('span'),count=document.createElement('small');label.className='activity-group-label';count.className='activity-group-count';
        summary.append(label,count);node.append(summary,body);
        // 이미 개별 출력을 읽던 중 묶음이 생기면 그 내용을 숨기지 않는다.
        node.open=items.some(({row,node})=>this.members.get(row.key)?.node.open??reading.get(node)?.open);
        summary.addEventListener('click',()=>this.onDisclosure(summary));
        // 접힌 동안 바뀐 출력은 목록을 다시 펼쳐 실제로 드러날 때 읽는다.
        node.addEventListener('toggle',()=>{if(node.open&&node.isConnected)for(const child of body.children)child.ontoggle?.();});
        group={node,summary,body,label,count};
      }
      group.rows=unit.rows;groups.set(group.node.dataset.key,group);
      for(const {row} of items)members.set(row.key,group);
      const visible=items.filter(({node})=>!node.hidden),labels={commands:'Ran commands',files:'Edited files',web:'Searched the web',tools:'Tool activity',review:'Automatic approval review'};
      const types=[...new Set(visible.map(({row})=>chatActivityGroupKind(row)))];
      const active=visible.some(({row})=>row.status==='inProgress');
      const reviewing=visible.some(({row})=>row.approvalReview?.status==='inProgress');
      const text=types.map(kind=>BridgeI18n.t(labels[kind])).join(' · ')+(reviewing?'ㆍ'+BridgeI18n.t('Auto-review in progress'):active?BridgeI18n.t('· 진행중'):'');
      if(group.label.textContent!==text)group.label.textContent=text;
      group.summary.title=text;group.count.textContent=String(visible.length);
      group.count.title=BridgeI18n.t('{count} activities').replace('{count}',visible.length);
      group.summary.setAttribute('aria-label',text+' · '+group.count.title);
      group.node.hidden=!visible.length;
      syncChatMessageNodes(group.body,items.map(({node})=>node));nodes.push(group.node);
    }
    // 묶음 안 명령은 첫 줄만 보여 주고, 전체 명령/출력은 기존 개별
    // details를 펼칠 때 읽는다. 빈 첫 줄을 출력 내용으로 대체하지 않는다.
    for(const {row,node} of entries){
      if(row.kind!=='commandExecution')continue;
      const heading=node.firstElementChild,nested=members.has(row.key),first=chatCommandFirstLine(row);
      node.classList.toggle('grouped-command',nested);
      const command=first&&(nested||row.approvalReview)?first:'';
      const text=command?command+chatActivityStateSuffix(row):chatActivityLabel(row);
      if(heading.textContent!==text)heading.textContent=text;
      decorateChatActivity(node,row,heading,command);
    }
    syncChatMessageNodes(container,nodes);
    // 분할·병합 중 다른 컨테이너로 옮긴 행도 새 레이아웃에서 복원한다.
    for(const [node,state] of reading)restoreChatActivityState(node,state);
    this.groups=groups;this.members=members;this.previous=new Map(entries.map(({row,node})=>[row.key,node]));
  }
}
// All chat surfaces render native task evidence through this shared indicator.
// 일반 텍스트 상태줄에서는 굵게 구분자만 지운 뒤 마지막 유효 줄을 선택한다.
function chatLastNonEmptyLine(value){return typeof value==='string'?value.split(/[\r\n\u2028\u2029]+/).map(line=>line.replaceAll('**','').trim()).filter(Boolean).at(-1)||'':'';}
function chatLatestReasoning(messages=[]){
  for(let index=messages.length-1;index>=0;index--){const message=messages[index];if(message.role==='user')break;if(message.role==='reasoning'||message.kind==='reasoning'){const line=chatLastNonEmptyLine(message.text);if(line)return line;}}
  return '';
}
const chatReviewLabels={inProgress:'Auto-review in progress',denied:'Auto-review denied',aborted:'Auto-review stopped',timedOut:'Auto-review timed out',unknown:'Review status unavailable'};
const chatExecutionLabels={running:'Tool running',succeeded:'Tool succeeded',completed:'Tool completed',failed:'Tool failed',interrupted:'Tool interrupted',declined:'Tool declined'};
const chatToolKinds=new Set(['commandExecution','fileChange','FileChange','mcpToolCall','dynamicToolCall','storedToolEvent']);
// 검토 통과는 실행 성공의 증거가 아니다. 실행 중/실패/중단은 원본
// 도구 상태로 판단하고, 성공 표시는 종료 코드 0 또는 명시적 success만 쓴다.
function chatToolExecutionState(row){
  if(!chatToolKinds.has(row.kind))return '';
  if(['declined','denied'].includes(row.status))return 'declined';
  if(['interrupted','cancelled'].includes(row.status))return 'interrupted';
  if(row.status==='failed'||row.success===false||Number.isInteger(row.exitCode)&&row.exitCode!==0)return 'failed';
  if(row.status==='inProgress')return 'running';
  if(row.exitCode===0||row.success===true)return 'succeeded';
  return row.status==='completed'?'completed':'';
}
function chatActivityStateSuffix(row){
  const review=row.approvalReview?.status,result=chatToolExecutionState(row),labels=[];
  if(review&&review!=='approved')labels.push(BridgeI18n.t(chatReviewLabels[review]||chatReviewLabels.unknown));
  if(!['inProgress','denied'].includes(review)&&['running','failed','interrupted','declined'].includes(result))labels.push(BridgeI18n.t(chatExecutionLabels[result]));
  return labels.length?'ㆍ'+labels.join('ㆍ'):'';
}
function decorateChatActivity(node,row,heading,command=''){
  const result=chatToolExecutionState(row),label=result&&!(row.approvalReview?.status==='inProgress'&&result==='running')?BridgeI18n.t(chatExecutionLabels[result]):'';
  node.dataset.execution=result;node.dataset.review=row.approvalReview?.status||'';
  // 긴 명령은 본문 부분만 줄여서 검토·실패 상태가 말줄임에 가려지지 않게 한다.
  if(chatToolKinds.has(row.kind)||row.kind==='automaticApprovalReview'){
    const caption=command||chatActivityCaption(row),suffix=chatActivityStateSuffix(row),signature=JSON.stringify([caption,suffix]);
    node.classList.add('tool-state');node.classList.toggle('command-caption',!!command);
    if(heading.dataset.caption!==signature||!heading.firstElementChild?.classList.contains('activity-caption')){
      const text=document.createElement('span'),state=document.createElement('span');text.className='activity-caption';state.className='activity-state';
      text.textContent=caption;state.textContent=suffix;state.hidden=!suffix;heading.replaceChildren(text,state);heading.dataset.caption=signature;
    }
  }
  heading.title=[command,label].filter(Boolean).join(' · ');
  heading.setAttribute('aria-label',heading.textContent+(['succeeded','completed'].includes(result)?' · '+label:''));
}
function chatActivityCaption(row){
  if(row.kind==='automaticApprovalReview')return typeof row.reviewActionLabel==='string'&&row.reviewActionLabel.trim()?row.reviewActionLabel.split(/[\r\n]/,1)[0]:BridgeI18n.t('Tool request');
  if(['mcpToolCall','dynamicToolCall','storedToolEvent'].includes(row.kind)&&typeof row.title==='string')return row.title;
  return BridgeI18n.t(row.title||row.kind||row.type);
}
function chatActivityLabel(row){
  const t=BridgeI18n.t,kind=row.kind||row.type;
  if(kind!=='contextCompaction'&&kind!=='autoContextCompaction'){
    if(kind==='automaticApprovalReview')return chatActivityCaption(row)+chatActivityStateSuffix(row);
    return chatActivityCaption(row)+(chatToolKinds.has(kind)?chatActivityStateSuffix(row):row.status==='inProgress'?t('· 진행중'):'');
  }
  // 실제 source와 완료 플래그를 우선한다. 예전 기록에만 종류·status를 사용하며
  // completed:false를 turn의 완료만으로 압축 완료로 표시하지 않는다.
  const auto=row.source==='automatic'||row.source!=='manual'&&kind==='autoContextCompaction';
  let status=row.status||(row.turnStatus==='completed'?'completed':null);
  if(typeof row.completed==='boolean'&&!['failed','interrupted'].includes(row.status))status=row.completed?'completed':'inProgress';
  const key=status==='inProgress'?(auto?'Automatically compacting context':'Compacting context'):status==='completed'?'Context compacted':status==='failed'?'Context compaction failed':status==='interrupted'?'Context compaction interrupted':auto?'Automatic context compaction':'Context compaction';
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
