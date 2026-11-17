// Real renderers and layout, synthetic messages only; no native client is used.
async function runChatReadingStateChecks(){
  await BridgeFeatures.load('chat');
  const checks=[],frame=()=>new Promise(requestAnimationFrame);
  const check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
  const longText=Array.from({length:140},(_,i)=>'Reading line '+i+' — keep this position.').join('\n');
  for(const provider of ['deepseek','claude','codex']){
    const root=document.createElement('div');root.className='app';
    root.style.cssText='position:fixed;inset:0;background:var(--bg);z-index:20';document.body.append(root);
    let view,timeline,sequence=0,current=[];
    const row=(id,order,role='assistant',text=longText)=>({id,order,role,text,version:'v1'});
    let rows=[row('before',0),row('thought',1,'reasoning'),row('tool',2,'activity'),row('after',3)];
    const detail=messages=>({connected:true,session:{id:'reading',title:'Reading fixture',status:'idle',capabilities:{}},messages,files:[]});
    let apply,getNode,viewport,container;
    if(provider==='codex'){
      viewport=document.createElement('div');viewport.style.cssText='height:100%;overflow:auto';container=document.createElement('div');viewport.append(container);root.append(viewport);
      const older=document.createElement('button'),newer=document.createElement('button');root.append(older,newer);
      timeline=new ChatTimeline({url:action=>'/synthetic/'+action+'?',elements:{viewport,container,older,newer},
        renderMeta(){},renderText:(node,text)=>node.textContent=text,status(){},request:async url=>{
          const key=new URL(url,location.origin).searchParams.get('key').split('.').at(-1),message=current.find(row=>row.id===key);
          return {key,version:message.version,text:message.text,next:null,offset:0};
        }});
      apply=(messages,reset=false)=>{current=messages;timeline.apply({epoch:'reading',sequence:++sequence,meta:{requests:[]},files:[],hasMore:false,
        rows:messages.map(message=>({...message,key:message.id,role:message.role==='reasoning'?'activity':message.role,kind:message.role}))},reset);};
      getNode=id=>timeline.nodes.get(id).node;apply(rows,true);
    }else{
      const select=document.createElement('select');for(const id of ['codex','claude','deepseek'])select.add(new Option(id,id));
      view=new DesktopSessionsView({root,select,notify(){},onSelect(){},csrf:()=>'',onUnauthorized(){},request:async(url,body)=>{
        if(body)throw Error('Unexpected write');
        if(url.includes('/detail'))return detail(rows);
        if(url.includes('/workspace'))return {entries:[],total:0,project:'/synthetic'};
        return {sessions:[detail(rows).session]};
      }});
      await view.choose(provider);await view.open('reading');clearTimeout(view.timer);
      apply=messages=>view.applyDetail(detail(messages));getNode=id=>view.messageNodes.get(id).node;
      viewport=container=view.messages;
    }
    try{
      check(!getNode('thought').isConnected||getNode('thought').hidden,provider+' reasoning is absent from the visible timeline');
      const positions={tool:330};
      for(const id of Object.keys(positions))getNode(id).open=true;
      await frame();await frame();
      for(const [id,top] of Object.entries(positions)){
        const body=getNode(id).querySelector('.activity-body');body.scrollTop=top;
        check(body.scrollTop===top,provider+' '+id+' is independently scrollable');
      }
      viewport.scrollTop=140;await frame();
      const outerTop=viewport.scrollTop,original=getNode('tool');
      const mutations=[];const observer=new MutationObserver(records=>mutations.push(...records));observer.observe(container,{childList:true});
      for(let i=0;i<3;i++)apply(rows);
      await frame();observer.disconnect();
      check(!mutations.length,provider+' unchanged refresh does not detach any message');
      check(getNode('tool')===original,provider+' unchanged message identity is stable');
      check(Math.abs(viewport.scrollTop-outerTop)<2,provider+' unchanged refresh retains outer reading position');
      const retained=label=>{for(const [id,top] of Object.entries(positions)){
        const node=getNode(id);check(node.open&&node.querySelector('.activity-body').scrollTop===top,provider+' '+label+' retains '+id+' expansion and inner position');
      }};
      retained('unchanged refresh');
      rows=[...rows,row('newer',4)];apply(rows);await frame();retained('appending a reply');
      rows=[row('older',-1),...rows];apply(rows);await frame();retained('prepending history');
      rows=rows.map(message=>message.id==='tool'?{...message,order:.5}:message).sort((a,b)=>a.order-b.order);
      apply(rows);await frame();await frame();retained('reordering rows');
      if(view){rows=rows.filter(message=>message.id!=='before');apply(rows);await frame();retained('removing a different row');}
      rows=rows.map(message=>message.id==='tool'?{...message,text:message.text+'\nNew activity line',version:'v2'}:message);
      apply(rows);await frame();await frame();retained('growing an expanded activity');
      check(getNode('tool').textContent.includes('New activity line'),provider+' updated activity is rendered');
      if(view){
        view.applyDetail({...detail(rows),files:[{id:'new-file',path:'example.md',reference:'example.md'}]});
      }else{
        rows=rows.map(message=>message.id==='tool'?{...message,status:'completed'}:message);apply(rows);
      }
      await frame();await frame();retained('metadata refresh');
      rows=rows.map(message=>message.id==='tool'?{...message,text:'Short activity',version:'v3'}:message);
      apply(rows);await frame();await frame();
      check(getNode('tool').open&&getNode('tool').querySelector('.activity-body').scrollTop===0,provider+' shrinking activity clamps to its actual range');
      if(view){view.prepareChat('different-chat');apply(rows);}else apply(rows,true);
      await frame();check(!getNode('tool').open&&getNode('tool').querySelector('.activity-body').scrollTop===0,provider+' new conversation does not inherit expansion or scroll');
    }finally{view?.clear();timeline?.dispose();root.remove();}
  }
  return {width:innerWidth,passed:checks.length,checks};
}

// 원본 ID 연결 메타데이터를 사용하는 실제 타임라인에서 표시 전환을 검사한다.
async function runToolReviewStatusChecks(){
  await BridgeFeatures.load('chat');
  const checks=[],check=(value,label)=>{if(!value)throw Error(label);checks.push(label);},frame=()=>new Promise(requestAnimationFrame);
  const until=async fn=>{const end=performance.now()+3000;while(!fn()){if(performance.now()>end)throw Error('Review fixture did not settle');await frame();}};
  const root=document.createElement('div');root.id='tool-review-fixture';root.style.cssText='position:fixed;inset:16px;z-index:30;background:var(--page);padding:8px;overflow:auto;box-sizing:border-box';document.body.append(root);
  const viewport=document.createElement('div'),container=document.createElement('div'),older=document.createElement('button'),newer=document.createElement('button');viewport.style.cssText='height:100%;max-width:760px;margin:auto;overflow:auto';viewport.append(container);root.append(viewport,older,newer);
  const command='git status --short '+('long-argument '.repeat(30));let sequence=0,reads=0,writes=0;
  let current={key:'tool-a',order:1,turnId:'turn-a',kind:'commandExecution',role:'activity',title:'명령을 실행하다',text:command,truncated:true,status:'inProgress',version:'v1',approvalReview:{id:'review-a',status:'inProgress'}};
  const review={key:'review-a',order:2,turnId:'turn-a',kind:'automaticApprovalReview',role:'activity',reviewLinked:true,approvalReview:{id:'review-a',status:'inProgress'},version:'v1',text:'review rationale'};
  const companion={key:'tool-b',order:3,turnId:'turn-a',kind:'mcpToolCall',role:'activity',title:'functions.read',text:'{}',status:'completed',success:true,version:'v1'};
  const timeline=new ChatTimeline({url:action=>'/review-fixture/'+action+'?',elements:{viewport,container,older,newer},renderMeta(){},renderText:(node,text)=>node.textContent=text,status(){},request:async(url,body)=>{
    if(body!==undefined){writes++;throw Error('Unexpected write');}if(!url.includes('/detail'))throw Error('Unexpected read');reads++;
    return {version:current.version,offset:0,next:null,text:current.text+'\n\n{"automaticApprovalReviews":[{"status":"denied","rationale":"Requires explicit authorization"}]}',files:[]};
  }});
  const node=()=>timeline.nodes.get('tool-a').node,heading=()=>node().firstElementChild;
  const apply=()=>{const reset=sequence===0;timeline.apply({epoch:'review-ui',sequence:++sequence,rows:[
    {key:'progress',order:0,role:'assistant',kind:'agentMessage',phase:'commentary',text:'검토 중인 도구와 실행 결과를 확인하고 있습니다.',version:'v1'},current,{...review,approvalReview:current.approvalReview},companion,
  ],meta:{requests:[]},files:[],hasMore:false},reset);};
  const language=BridgeI18n.language();
  try{
    BridgeI18n.setLanguage('ko');apply();await frame();
    const group=container.querySelector('.activity-group');group.firstElementChild.click();await frame();await frame();
    check(!container.querySelector('[data-key="review-a"]')&&heading().querySelector('.activity-state').textContent==='ㆍ자동 검토 중','review progress is attached to its tool without a duplicate timeline row');
    check(reads===0&&writes===0,'rendering a review or opening its group does not fetch output or approve an action');
    root.style.width='320px';await frame();
    const caption=heading().querySelector('.activity-caption'),badge=heading().querySelector('.activity-state');
    check(caption.scrollWidth>caption.clientWidth&&badge.getBoundingClientRect().right<=heading().getBoundingClientRect().right+1&&badge.getBoundingClientRect().width>20,'a long command truncates its caption while leaving review status visible at 320px');
    check(heading().getBoundingClientRect().height<=31,'tool and review status remain on one line');root.style.width='';
    current={...current,status:undefined,version:'v2',approvalReview:{id:'review-a',status:'approved'}};apply();await frame();
    check(heading().querySelector('.activity-state').hidden&&!heading().textContent.includes('자동 검토'),'approval removes the review badge and retains the tool caption');
    check(node().dataset.execution==='','review approval does not invent execution success');
    current={...current,status:'inProgress',version:'v3'};apply();await frame();check(heading().textContent.endsWith('ㆍ실행 중'),'actual execution progress appears independently after approval');
    current={...current,status:'completed',exitCode:0,version:'v4'};apply();await frame();
    check(node().dataset.execution==='succeeded'&&heading().querySelector('.activity-state').hidden&&heading().getAttribute('aria-label').includes('실행 완료'),'exit code zero shows successful execution without an approval label');
    current={...current,exitCode:2,version:'v5'};apply();await frame();check(heading().textContent.endsWith('ㆍ실행 실패')&&node().dataset.execution==='failed','an approved command can still fail during execution');
    current={...current,status:'declined',exitCode:null,version:'v6',approvalReview:{id:'review-a',status:'denied'}};apply();await frame();
    check(node().parentNode===container&&heading().textContent.endsWith('ㆍ거부됨'),'denial remains visible on the real tool outside collapsed groups');
    heading().click();await until(()=>reads===1&&node().querySelector('.activity-body').textContent.includes('Requires explicit authorization'));
    check(!container.querySelector('[data-key="review-a"]')&&reads===1&&writes===0,'denial reason is available through the existing paged detail read without an approval write');
    for(const [lang,label]of [['en','Denied'],['zh','已拒绝'],['ko','거부됨']]){
      BridgeI18n.setLanguage(lang);timeline.relabel();check(heading().querySelector('.activity-state').textContent==='ㆍ'+label&&heading().querySelector('.activity-caption').textContent===command.trim(),'review badge follows '+lang+' while literal command text is retained');
    }
    current={...current,status:'interrupted',version:'v7',approvalReview:{id:'review-a',status:'aborted'}};apply();await frame();check(heading().textContent.includes('검토 중단됨')&&heading().textContent.includes('중지됨'),'interrupted review and tool execution are distinguished');
    current={...current,status:undefined,version:'v8',approvalReview:{id:'review-a',status:'timedOut'}};apply();await frame();check(heading().textContent.endsWith('ㆍ검토 시간 초과'),'a review timeout is not presented as approval or execution success');
    current={...current,status:'declined',version:'v9',approvalReview:{id:'review-a',status:'denied'}};apply();await frame();
    return {width:innerWidth,passed:checks.length,checks};
  }finally{BridgeI18n.setLanguage(language);timeline.dispose();}
}

// 실제 타임라인·CSS를 사용하고 명령 실행 없이 메모리의 상세 응답만 읽는다.
async function runChatActivityGroupChecks(){
  await BridgeFeatures.load('chat');
  const checks=[],frame=()=>new Promise(requestAnimationFrame),check=(value,label)=>{if(!value)throw Error(label);checks.push(label);};
  const until=async fn=>{const end=performance.now()+3000;while(!fn()){if(performance.now()>end)throw Error('Timed out waiting for activity details');await frame();}};
  const root=document.createElement('div');root.id='activity-group-fixture';root.style.cssText='position:fixed;inset:0;z-index:30;background:var(--page);padding:16px;box-sizing:border-box';document.body.append(root);
  const viewport=document.createElement('div');viewport.style.cssText='height:100%;max-width:760px;margin:auto;overflow:auto;overflow-anchor:none';
  const container=document.createElement('div'),older=document.createElement('button'),newer=document.createElement('button');viewport.append(container);root.append(viewport,older,newer);
  let sequence=0,rows=[],reads=[];
  const source=(key,order,kind='commandExecution',text='python3 -B scripts/check-boundaries.py',extra={})=>({key,order,kind,role:'activity',title:kind==='commandExecution'?'명령을 실행하다':kind==='fileChange'?'파일 변경':kind,turnId:'turn-a',version:'v1',text,...extra});
  rows=[
    source('progress',0,'agentMessage','언어 설정과 도구줄을 확인하고 있습니다.',{role:'assistant',phase:'commentary'}),
    source('cmd1',1,'commandExecution','git status --short\nprintf second-line',{truncated:true}),
    source('cmd2',2,'commandExecution','npm test -- '+('long-command-argument '.repeat(20)),{truncated:true}),
    source('patch',3,'fileChange','web/features/chat/timeline.js\n+ grouped activity'),
    source('web',4,'webSearch','{"query":"activity grouping"}'),
    source('next-progress',5,'agentMessage','수정을 적용했고 모바일 화면을 확인하고 있습니다.',{role:'assistant',phase:'commentary'}),
    source('single',6),source('image',7,'imageView','Image preview'),source('cmd3',8),
    source('cmd4',9,'commandExecution',"printf '<img src=x onerror=alert(1)>'\nprintf second"),
    source('denied',10,'automaticApprovalReview','A request was declined',{status:'denied'}),
    source('error',11,'error','Synthetic system error',{role:'error'}),
    source('other-turn',12,'commandExecution','git diff --stat',{turnId:'turn-b'}),
    source('final',13,'agentMessage','실행 기록을 확인했습니다.',{role:'assistant',phase:'final_answer',turnId:'turn-b'}),
  ];
  const timeline=new ChatTimeline({url:action=>'/synthetic/'+action+'?',elements:{viewport,container,older,newer},
    renderMeta(){},renderText:(node,text)=>node.textContent=text,status(){},request:async(url,body)=>{
      if(body!==undefined)throw Error('Unexpected write');const path=new URL(url,location.origin);if(!path.pathname.endsWith('/detail'))throw Error('Unexpected read');
      const key=path.searchParams.get('key').slice('groups.'.length),row=rows.find(row=>row.key===key);reads.push(key);
      return {version:row.version,offset:0,text:row.text+'\n\n'+Array.from({length:200},(_,i)=>'Output line '+i).join('\n'),next:null,files:[]};
    }});
  const apply=(items=rows,reset=false,history=false)=>timeline.apply({epoch:'groups',sequence:++sequence,rows:items,meta:{requests:[{id:'pending'}]},files:[],hasMore:false},reset,history);
  const groups=()=>[...container.querySelectorAll(':scope > .activity-group')],node=key=>timeline.nodes.get(key).node;
  const language=BridgeI18n.language();
  try{
    BridgeI18n.setLanguage('ko');apply(rows,true);await frame();await frame();
    const group=groups()[0],summary=group.firstElementChild;
    check(groups().length===2&&!groups().some(group=>group.open),'activity runs are grouped and initially collapsed');
    check(summary.textContent==='명령을 실행함 · 파일 변경 · 웹 검색4','mixed activity header summarizes kinds once');
    check(node('progress').parentNode===container&&node('next-progress').parentNode===container&&node('final').parentNode===container,'commentary and final text remain outside activity groups');
    for(const key of ['single','image','denied','error','other-turn'])check(node(key).parentNode===container,key+' is an independent boundary');
    check(timeline.pendingRequests&&reads.length===0,'approval metadata remains available without eagerly loading activity output');
    summary.click();await frame();await frame();
    check(group.open&&reads.length===0,'opening a group shows rows without fetching their output');
    check(node('cmd1').firstElementChild.textContent==='git status --short','nested command shows only its first line');
    check(node('cmd4').firstElementChild.textContent==="printf '<img src=x onerror=alert(1)>'"&&!node('cmd4').firstElementChild.querySelector('img'),'command labels remain literal and cannot inject HTML');
    check([...group.lastElementChild.children].map(n=>n.dataset.key).join(',')==='cmd1,cmd2,patch,web','mixed activity preserves source order');
    node('cmd1').firstElementChild.click();await until(()=>reads.length===1&&node('cmd1').querySelector('.activity-body').textContent.includes('Output line 199'));
    let body=node('cmd1').querySelector('.activity-body');body.scrollTop=230;
    const original=node('cmd1');
    check(body.scrollTop===230&&node('cmd1').textContent.includes('printf second-line'),'individual expansion loads the full command and scrollable output');
    const mutations=[],observer=new MutationObserver(records=>mutations.push(...records));observer.observe(container,{childList:true});apply();apply();await frame();observer.disconnect();
    check(!mutations.length&&groups()[0]===group&&node('cmd1')===original,'unchanged refresh keeps group and row nodes attached');
    check(node('cmd1').open&&body.scrollTop===230&&reads.length===1,'refresh preserves inner reading position without duplicate detail requests');
    const updated={...rows.find(row=>row.key==='cmd2'),status:'inProgress'};rows=rows.map(row=>row.key===updated.key?updated:row);apply([updated]);await frame();
    check(groups()[0]===group&&group.open&&summary.textContent.includes('진행 중'),'live status updates keep the group open and report active work');
    check(node('cmd1').open&&body.scrollTop===230&&reads.length===1,'updating another activity preserves the expanded command');
    const earlier=source('earlier',.5,'commandExecution','git diff --check');rows.push(earlier);apply([earlier],false,true);await frame();
    check(groups()[0]===group&&group.open&&group.lastElementChild.firstElementChild===node('earlier'),'history extends the existing group instead of replacing it');
    check(node('cmd1').open&&body.scrollTop===230,'history extension preserves inner output scrolling');
    summary.click();await frame();
    const freshCommand={...rows.find(row=>row.key==='cmd1'),version:'v2',text:'git status --short\nprintf updated-second-line'};
    rows=rows.map(row=>row.key===freshCommand.key?freshCommand:row);apply([freshCommand]);await frame();await frame();
    check(!group.open&&node('cmd1').open&&reads.length===1,'a collapsed group keeps individual disclosure state without fetching changed hidden output');
    summary.click();await until(()=>reads.length===2&&node('cmd1').querySelector('.activity-body').textContent.includes('updated-second-line'));
    body=node('cmd1').querySelector('.activity-body');body.scrollTop=230;
    check(group.open&&node('cmd1').open&&reads.length===2,'revealing an already expanded command reads its latest output once');
    node('cmd1').open=false;await frame();
    viewport.scrollTop+=node('cmd2').getBoundingClientRect().top-viewport.getBoundingClientRect().top+2;timeline.following=false;
    const anchor=timeline.capture(),anchorNode=timeline.nodes.get(anchor.key)?.node||timeline.activityGroups.anchorNode(anchor.key);
    const offset=anchorNode.getBoundingClientRect().top-viewport.getBoundingClientRect().top;
    const backfill=source('backfill',.25,'commandExecution','git log -1');rows.push(backfill);apply([backfill],false,true);await frame();
    check(Math.abs(anchorNode.getBoundingClientRect().top-viewport.getBoundingClientRect().top-offset)<2,'prepending inside a group retains the visible row and pixel offset');
    timeline.setVisibility({showProcess:false});await frame();check(groups().every(group=>group.hidden)&&!node('final').hidden&&!node('error').hidden,'activity filter hides groups while replies and errors remain visible');
    timeline.setVisibility({showProcess:true});await frame();check(!group.hidden&&group.open,'restoring activity retains group expansion');
    for(const [lang,label]of [['en','Ran commands'],['zh','已运行命令'],['ko','명령을 실행함']]){
      BridgeI18n.setLanguage(lang);timeline.relabel();
      check(summary.textContent.startsWith(label)&&node('cmd1').firstElementChild.textContent==='git status --short'&&group.open,'language '+lang+' updates group labels without translating commands or closing them');
    }
    root.style.width='320px';viewport.scrollTop=0;await frame();
    const heading=node('cmd2').firstElementChild,rect=heading.getBoundingClientRect();
    const commandCaption=heading.querySelector('.activity-caption');
    check(getComputedStyle(heading).whiteSpace==='nowrap'&&rect.height<=31&&commandCaption.scrollWidth>commandCaption.clientWidth,'long command labels stay on one truncated line at 320px');
    check(container.scrollWidth<=container.clientWidth+1,'activity groups do not overflow the narrow conversation');
    // 기존 묶음의 첫 키보다 앞에 기록이 붙은 뒤 설명이 중간에 나타나도
    // 두 묶음의 키와 펼침 상태가 서로 섞이지 않아야 한다.
    apply([source('late-commentary',.75,'agentMessage','이 구간의 검사 결과를 정리하고 있습니다.',{role:'assistant',phase:'commentary'})]);await frame();
    check(groups().length===3&&new Set(groups().map(group=>group.dataset.key)).size===3,'splitting an extended group keeps unique stable group keys');
    check(node('cmd1').parentNode.parentNode.open&&node('late-commentary').parentNode===container,'a late commentary splits activity without hiding the previously expanded list');
    check(container.querySelectorAll('[data-key="cmd1"]').length===1,'group splitting never duplicates a command');
    root.style.width='';apply(rows,true);await frame();check(groups().every(group=>!group.open)&&!node('cmd1').open,'a new timeline does not inherit disclosure state from the previous one');
    groups()[0].firstElementChild.click();await frame();viewport.scrollTop=0;
    return {width:innerWidth,passed:checks.length,checks};
  }finally{BridgeI18n.setLanguage(language);timeline.dispose();}
}
