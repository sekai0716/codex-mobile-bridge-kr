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
function chatTurnCompletionLabel(turn){
  const t=source=>typeof BridgeI18n==='undefined'?source:BridgeI18n.t(source);
  if(turn.status==='interrupted')return t('已停止');
  if(turn.status==='failed')return t('运行失败');
  if(turn.status!=='completed')return '';
  const start=chatMessageDate(turn.start),end=chatMessageDate(turn.end);
  if(!start||!end||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)return t('已完成');
  const seconds=Math.floor((end-start)/1000),minutes=Math.floor(seconds/60);
  return t(minutes?'已完成，用时 {minutes} 分钟 {seconds} 秒':'已完成，用时 {seconds} 秒')
    .replace('{minutes}',minutes).replace('{seconds}',seconds%60);
}
// Use native turn and answer identities. Missing evidence keeps the flat rows visible.
function chatTurnProcessRow(row){
  return !row.fileSummary&&(row.role==='activity'||row.role==='reasoning'||
    row.role==='assistant'&&row.phase==='commentary');
}
function chatNodesWithTurnCompletions(container,nodes,rows){
  const turns=new Map(),nodeByKey=new Map(nodes.map(node=>[node.dataset.key,node])),managed=new Set();
  for(const [index,row] of rows.entries()){
    const key=String(row.key??row.id??index);
    if(row.turnId===undefined||row.turnId===null||row.turnId==='history'||row.turnCompletionKnown===false)continue;
    const id=String(row.turnId),turn=turns.get(id)||{id,rows:[]};
    turn.last=key;turn.rows.push({row,key,index});
    if(row.turnStatus)turn.status=row.turnStatus;
    if(row.turnStartedAt!==undefined)turn.start=row.turnStartedAt;
    if(row.turnCompletedAt!==undefined)turn.end=row.turnCompletedAt;
    if(row.role==='assistant'&&(row.phase==='final_answer'||row.forkable===true&&row.phase!=='commentary')){
      turn.answerKey=key;turn.answerIndex=index;
    }
    turns.set(id,turn);
  }
  const existing=new Map([...container.children].filter(node=>node.classList?.contains('chat-turn-completion')).map(node=>[node.dataset.key,node]));
  const before=new Map(),after=new Map();
  for(const turn of turns.values()){
    const process=turn.rows.filter(({row,index})=>chatTurnProcessRow(row)&&
      (turn.answerIndex===undefined||index<turn.answerIndex));
    const label=turn.status==='inProgress'&&process.length
      ?(typeof BridgeI18n==='undefined'?'正在思考与执行…':BridgeI18n.t('正在思考与执行…'))
      :chatTurnCompletionLabel(turn);
    if(!label)continue;
    const key='turn-completion:'+turn.id,foldable=turn.status==='completed'&&!!turn.answerKey&&process.length>0;
    const control=existing.get(key)||document.createElement('button');
    control.type='button';control.className='chat-turn-completion';control.dataset.key=key;control.__chatTurn=turn;
    if(control.__chatAnswer!==turn.answerKey||turn.status==='inProgress')control.__chatProcessOpen=undefined;
    control.__chatAnswer=turn.answerKey;
    const processNodes=process.map(({key})=>nodeByKey.get(key)).filter(Boolean);
    for(const node of processNodes)managed.add(node);
    const selected=document.getSelection?.();
    const reading=selected&&!selected.isCollapsed&&processNodes.some(node=>node.contains(selected.anchorNode));
    if(reading)control.__chatProcessOpen=true;
    const update=()=>{
      const open=!foldable||control.__chatProcessOpen===true;
      for(const node of processNodes)node.classList.toggle('chat-process-collapsed',!open);
      control.disabled=!foldable;
      if(foldable)control.setAttribute('aria-expanded',String(open));else control.removeAttribute('aria-expanded');
      const text=label+(foldable?(open?' ▴':' ▾'):'');
      if(control.textContent!==text)control.textContent=text;
    };
    control.onclick=()=>{control.__chatProcessOpen=control.__chatProcessOpen!==true;update();};
    update();
    if(process.length)before.set(process[0].key,control);else after.set(turn.last,control);
  }
  for(const node of nodes)if(!managed.has(node))node.classList?.remove('chat-process-collapsed');
  const result=[];
  for(const node of nodes){
    if(before.has(node.dataset.key))result.push(before.get(node.dataset.key));
    result.push(node);
    if(after.has(node.dataset.key))result.push(after.get(node.dataset.key));
  }
  return result;
}
function chatFollowsLatest(viewport){
  return viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<110;
}
function chatShouldSlideHistory(count,following){
  return following&&count>240&&document.getSelection?.()?.isCollapsed!==false;
}
function captureChatScrollAnchor(viewport,container,accept=()=>true){
  const top=viewport.getBoundingClientRect().top;
  let anchor=null;
  for(const node of container.children){
    if(node.hidden||node.dataset.key===undefined||node.classList?.contains('chat-turn-completion')||!accept(node))continue;
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
  if(state.open)details.__loadActivityBody?.();
  const body=details.querySelector('.activity-body');
  if(body){body.scrollTop=state.top;body.scrollLeft=state.left;}
}
// Desktop adapters already delivered bounded native pages. Reuse that text
// only when the reader opens the activity; do not build hidden output bodies.
function deferChatActivityBody(details,body,text){
  details.__loadActivityBody=()=>{if(body.textContent!==text)body.textContent=text;};
  details.addEventListener('toggle',()=>{if(details.open)details.__loadActivityBody();});
}
function renderChatFileSummary(content,row,onFile){
  const translate=source=>typeof BridgeI18n==='undefined'?source:BridgeI18n.t(source),heading=content.children[0];
      content.classList.add('edited-files-card');
      heading.replaceChildren();
      const label=document.createElement('span');label.className='edited-files-label';label.textContent=translate('已编辑 {count} 个文件').replace('{count}',row.fileSummary.count);
      const stats=document.createElement('span');stats.className='edited-files-stats';
      const added=document.createElement('span');added.className='edited-files-added';added.textContent='+'+row.fileSummary.added;
      const removed=document.createElement('span');removed.className='edited-files-removed';removed.textContent='−'+row.fileSummary.removed;
      stats.append(added,removed);heading.append(label);
      if(row.fileSummary.basis==='recorded'){
        const basis=document.createElement('small');basis.className='edited-files-basis';basis.textContent=translate('累计修改');heading.append(basis);
      }
      heading.append(stats);
      const list=document.createElement('ul');list.className='edited-files-list';
      for(const file of row.fileSummary.files){
        const item=document.createElement('li'),path=document.createElement(onFile?'button':'span'),counts=document.createElement('span');
        if(onFile){path.type='button';path.onclick=()=>onFile(file.path);}
        path.textContent=file.path;path.className='edited-files-path';counts.textContent='+'+file.added+' −'+file.removed;counts.className='edited-files-stats';item.append(path,counts);list.append(item);
        if(onFile)path.classList.add('plain');
      }
      content.append(list);
}
// Classification is presentation-only: a user supplement stays a user message.
function chatActivityKind(row){
  if(row.fileSummary||row.role==='fileChanges')return '';
  if(row.role==='user')return row.interaction==='response'?'tool':'';
  if(row.role==='reasoning'||row.kind==='reasoning')return 'reasoning';
  return row.role==='activity'?'tool':'';
}
function chatPlainActivityLabel(row){
  const t=source=>typeof BridgeI18n==='undefined'?source:BridgeI18n.t(source);
  if(row.interaction==='response')return t('已回答问题');
  const text=(row.text||'').split('\n')[0];
  if(row.activityFiles?.length)return t('已编辑')+' '+row.activityFiles.map(file=>file.path).join('、');
  if(row.kind==='commandExecution'&&text)return t('已运行')+' '+text;
  if(['fileChange','FileChange'].includes(row.kind)&&text)return t('已编辑')+' '+text;
  return t(row.title||(row.kind==='reasoning'||row.role==='reasoning'?'思考摘要':'执行过程'));
}
function renderChatActivityLabel(heading,row){
  heading.replaceChildren();
  const label=document.createElement('span');label.className='chat-activity-text';
  label.textContent=chatActivityLabel(row);label.title=label.textContent;
  if(row.activityFiles?.length){
    label.replaceChildren(typeof BridgeI18n==='undefined'?'已编辑 ':BridgeI18n.t('已编辑')+' ');
    for(const [index,file] of row.activityFiles.entries()){
      if(index)label.append('、');
      const path=document.createElement('span');path.className='chat-activity-file';path.textContent=file.path;label.append(path);
    }
    const stats=document.createElement('span');stats.className='chat-activity-stats';
    stats.textContent='+'+row.activityFiles.reduce((sum,file)=>sum+file.added,0)+' −'+row.activityFiles.reduce((sum,file)=>sum+file.removed,0);
    heading.append(label,stats);
  }else heading.append(label);
}
// One history gesture backfills bounded native rows until ordinary dialogue appears.
// Native pages stay bounded; collect before rendering once, preserving a manual
// continuation after four pages or a transport failure.
async function readChatHistoryBatch(read,before,{known=new Set(),current=()=>true}={}){
  const pages=[],seen=new Set();let cursor=before;
  for(let count=0;count<4;count++){
    let page;
    try{page=await read(cursor);}catch(error){return current()?{pages,error}:{pages:[],cancelled:true};}
    if(!current())return {pages:[],cancelled:true};
    if(page.reset||pages.length&&page.epoch!==pages[0].epoch)return {pages:[],reset:page};
    if(page.hasMore&&(!page.rows.length||page.before===cursor||seen.has(page.before)))return {pages,stalled:true};
    pages.push(page);seen.add(page.before);
    if(!page.hasMore||page.rows.some(row=>!known.has(row.key??row.id)&&!chatActivityKind(row)))break;
    cursor=page.before;
  }
  return {pages};
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
  if(row.role==='activity'&&['imageView','ImageView'].includes(row.kind))return 'images';
  if(!['activity','fileChanges'].includes(row.role)||row.attachments?.length||['denied','declined'].includes(row.status)||row.approvalReview?.status==='denied')return null;
  // 컴퓨터 사용은 첨부 유무와 관계없이 호출 제목에서 바로 열 수 있어야 한다.
  if(row.fileSummary||row.computerUse||row.activityCard)return null;
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
    if(pending.length&&(pending[0].turnId!==row.turnId||(chatActivityGroupKind(pending[0])==='images')!==(chatActivityGroupKind(row)==='images')))flush();
    pending.push(row);
  }
  flush();return units;
}
function chatCommandFirstLine(row){
  return row.kind==='commandExecution'&&typeof row.text==='string'?row.text.split(/[\r\n\u2028\u2029]/,1)[0].trim():'';
}
const chatCommandLabels={
  command:'Ran commands',read:'Read files',listFiles:'Listed directory contents',
  readSkill:'Read skills',search:'Searched workspace files'
};
function chatCommandActivityTypes(row){
  const actions=Array.isArray(row.commandActions)?row.commandActions.filter(action=>Object.hasOwn(chatCommandLabels,action)):[];
  return actions.length?actions:['command'];
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
      const visible=items.filter(({node})=>!node.hidden),labels={...chatCommandLabels,files:'Edited files',web:'Searched the web',tools:'Tool activity',images:'Viewed images',review:'Automatic approval review'};
      const types=[...new Set(visible.flatMap(({row})=>{
        const kind=chatActivityGroupKind(row);
        return kind==='commands'?chatCommandActivityTypes(row):[kind];
      }))];
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
  if(row.activityCard)return BridgeI18n.t(row.title);
  if(row.kind==='commandExecution'&&row.commandActions?.length)
    return chatCommandActivityTypes(row).map(action=>BridgeI18n.t(chatCommandLabels[action])).join(' · ');
  if(row.kind==='automaticApprovalReview')return typeof row.reviewActionLabel==='string'&&row.reviewActionLabel.trim()?row.reviewActionLabel.split(/[\r\n]/,1)[0]:BridgeI18n.t('Tool request');
  if(['mcpToolCall','dynamicToolCall','storedToolEvent'].includes(row.kind)&&typeof row.title==='string')return row.title;
  return BridgeI18n.t(row.title||row.kind||row.type);
}
// Each tool reports the outcome of its own call. In particular, a finished wait may have no agent update.
const collabActions={
  spawnAgent:['Agent creation','Creating agent','Agent creation call finished'],
  sendInput:['Request delivery','Sending request','Request delivered'],
  sendMessage:['Message delivery','Sending message','Message delivered'],
  followupTask:['Follow-up request','Sending follow-up request','Follow-up request delivered'],
  wait:['Response wait','Waiting for response','Response wait ended'],
  resumeAgent:['Agent resumption','Resuming agent','Agent resumed'],
  closeAgent:['Agent closure','Closing agent','Agent closed'],
  interruptAgent:['Agent interruption','Requesting interruption','Interruption requested'],
  listAgents:['Agent lookup','Listing agents','Agent list retrieved']
};
const collabAgentStates={
  pendingInit:'Agent initializing',running:'Agent task running',interrupted:'Agent task interrupted',
  completed:'Agent task completed',errored:'Agent task failed',shutdown:'Agent shut down',notFound:'Agent not found'
};
function chatCollabLabel(row,agentNames){
  const t=BridgeI18n.t,tool=row.collab?.tool,targets=row.collab?.targets||[];
  if(row.spawnedAgents?.length)return t('Subagent created');
  const [action,progress,done]=Object.hasOwn(collabActions,tool)?collabActions[tool]:['Agent operation','Agent operation in progress','Agent operation finished'];
  let label=t(action);
  switch(row.status){
    case 'inProgress':label=t(progress);break;
    case 'completed':label=t(done);break;
    case 'failed':label=t('{action} failed').replace('{action}',()=>t(action));break;
    case 'interrupted':label=t('{action} interrupted').replace('{action}',()=>t(action));break;
  }
  if(!targets.length)return label;
  const names=targets.map(target=>target.nickname||agentNames?.get(target.id)||t('Agent {id}').replace('{id}',()=>target.id.slice(-8)));
  const template=['sendInput','sendMessage','followupTask'].includes(tool)?'To {targets} · {action}':tool==='wait'?'From {targets} · {action}':'{targets} · {action}';
  const values={targets:names.join(', '),action:label};
  label=t(template).replace(/\{(targets|action)\}/g,(_,field)=>values[field]);
  const states=[];
  for(const [index,target] of targets.entries()){
    if(!Object.hasOwn(collabAgentStates,target.status))continue;
    const state=t(collabAgentStates[target.status]);
    states.push(targets.length===1?state:names[index]+' · '+state);
  }
  return states.length?label+' · '+t('Last reported state ({states})').replace('{states}',()=>states.join(', ')):label;
}
function chatActivityLabel(row,agentNames){
  const t=BridgeI18n.t,kind=row.kind||row.type;
  if(kind==='collabAgentToolCall')return chatCollabLabel(row,agentNames);
  if(row.interaction==='response'||row.activityFiles?.length||!kind)
    return chatPlainActivityLabel(row);
  if(kind!=='contextCompaction'&&kind!=='autoContextCompaction'){
    if(['userInputResponse','permissionRequest','mcpServerElicitation'].includes(kind)&&typeof row.completed==='boolean')
      return chatActivityCaption(row)+' · '+t(row.completed?'Request completed':'Awaiting response');
    if(kind==='error'&&row.title==='Reconnecting to model'){
      const attempt=/^Reconnecting(?:…|\.{3})?\s+(\d+\s*\/\s*\d+)/i.exec(row.text||'');
      return chatActivityCaption(row)+(attempt?' · '+attempt[1]:'');
    }
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
