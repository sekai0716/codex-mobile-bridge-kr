async function runToolImageTests(imageId){
  await BridgeFeatures.load('chat');
  const checks=[],frame=()=>new Promise(requestAnimationFrame);
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const until=async(fn,label)=>{const end=performance.now()+4000;while(!fn()){if(performance.now()>end)throw Error(label);await frame();}};
  const root=document.createElement('section'),container=document.createElement('div');
  root.style.cssText='position:fixed;inset:0;overflow:auto;z-index:20;background:var(--bg)';
  root.append(container);document.body.append(root);
  const elements={viewport:root,container,older:document.createElement('button'),newer:document.createElement('button')};
  const session='/api/sessions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/';
  let sequence=0,detailCalls=0;
  const calls=new Map(),bodies=new Map(),detailBody=JSON.stringify({code:'await capture()',title:'Save preview'})+'\n\n'+JSON.stringify({content:[{type:'image',preview:imageId}]});
  const timeline=new ChatTimeline({elements,url:action=>session+action+'?host=local',
    renderMeta(){},renderText:(node,text)=>node.textContent=text,status(){},request:async url=>{
      const key=new URL(url,location.href).searchParams.get('key').split('.').pop();
      detailCalls++;return {key,version:calls.get(key).version,offset:0,text:bodies.get(key)??detailBody,next:null};
    }});
  const images=[{type:'toolImage',desktopId:imageId,name:'Screenshot.png'}];
  const saved={key:'saved',order:0,version:'1',turnId:'turn',role:'activity',kind:'storedToolEvent',title:'cua_repl · js',
    computerUse:{title:'Save preview'},text:'preview',truncated:true,attachments:images};
  const linux={...saved,key:'linux',order:1,kind:'mcpToolCall',title:'computer_use_linux · click',computerUse:{action:'click'}};
  const wrapped={...saved,key:'wrapped',order:2,kind:'dynamicToolCall',title:'functions.exec',computerUse:{action:'screenshot'}};
  const other={...saved,key:'other',order:3,title:'other · image',computerUse:undefined};
  const user={...saved,key:'user',order:4,role:'user',kind:'userMessage',computerUse:undefined,truncated:false,attachments:[{...images[0],type:'image'}]};
  const apply=(rows,reset=false)=>{
    rows.forEach(row=>calls.set(row.key,row));
    timeline.apply({epoch:'images',sequence:++sequence,rows,hasMore:false,meta:{requests:[]},files:[]},reset);
  };
  const node=key=>timeline.nodes.get(key).node,inner=key=>node(key).querySelector('details.activity');
  const summary=key=>node(key).firstElementChild;
  const originalLanguage=BridgeI18n.language();
  try{
    apply([saved,linux,{...wrapped,computerUse:undefined,attachments:[],status:'inProgress'},other,user],true);
    apply([{...wrapped,version:'2',status:'completed'}]);
    for(const [key,label] of [['saved','컴퓨터 사용 · Save preview'],['linux','컴퓨터 사용 · 클릭 후 화면 확인'],['wrapped','컴퓨터 사용 · 화면 캡처']]){
      check(node(key).matches('details.computer-use:not([open])')&&!inner(key).open,key+' has two closed disclosures');
      check(summary(key).textContent===label,key+' has the correct task caption');
      check(!node(key).querySelector('.timeline-attachments'),key+' defers its own gallery');
    }
    check(node('other').tagName==='DIV'&&!!node('other').querySelector('img'),'Other tools keep their inline gallery');
    check(!!node('user').querySelector('img'),'User uploads remain inline');
    summary('saved').click();
    await until(()=>node('saved').querySelector('img')?.naturalWidth,'saved screenshot did not load');
    const img=node('saved').querySelector('img');
    check(!inner('saved').open&&inner('saved').firstElementChild.textContent==='cua_repl · js','First expansion keeps the original command closed');
    check(img.closest('details')===node('saved')&&img.getBoundingClientRect().height>0,'Screenshot is visible with one click');
    check(detailCalls===0&&!node('linux').open&&!node('wrapped').open,'Opening one call leaves the other calls and full text untouched');
    check(img.src.includes('/desktop-images/'+imageId)&&new URL(img.src).searchParams.get('host')==='local','Image uses the host-scoped gateway URL');
    node('saved').querySelector('[data-image-preview]').click();
    const dialog=document.getElementById('image-preview-dialog');
    await until(()=>dialog?.open&&dialog.querySelector('img')?.naturalWidth,'zoom viewer did not open');
    check(dialog.open,'Existing zoom viewer opens the screenshot');dialog.close();
    inner('saved').firstElementChild.click();
    await until(()=>inner('saved').querySelector('pre').textContent===detailBody,'command details did not load');
    check(detailCalls===1,'Only the nested disclosure loads arguments and result');
    summary('saved').click();
    apply([{...saved,version:'2'}]);await frame();
    check(!node('saved').open&&inner('saved').open&&detailCalls===1,'Refresh preserves a closed outer row with previously opened command');
    summary('saved').click();
    await until(()=>detailCalls===2&&node('saved').querySelector('img')?.naturalWidth,'reopening did not restore updated contents');
    check(node('saved').querySelectorAll('img').length===1,'Reopening restores exactly one preview');
    summary('wrapped').click();
    await until(()=>node('wrapped').querySelector('img')?.naturalWidth,'wrapped screenshot did not load');
    check(inner('wrapped').firstElementChild.textContent==='functions.exec'&&!inner('wrapped').open,'Live Linux wrapper reveals its original tool and screenshot');
    for(const [lang,prefix,action] of [['en','Computer use','Capture screen'],['zh','使用电脑','截取屏幕'],['ko','컴퓨터 사용','화면 캡처']]){
      BridgeI18n.setLanguage(lang);timeline.relabel();
      check(summary('saved').textContent===prefix+' · Save preview'&&summary('wrapped').textContent===prefix+' · '+action,lang+' localizes actions and keeps original task titles');
      check(node('saved').open&&inner('saved').open&&!inner('wrapped').open,lang+' preserves both disclosure levels independently');
    }
    timeline.setVisibility({showProcess:false});check(node('saved').hidden,'Hide process hides the whole call');
    timeline.setVisibility({showProcess:true,showToolImages:false});
    await frame();check(!node('saved').hidden&&!node('saved').querySelector('img')&&!!node('user').querySelector('img'),'Screenshot preference leaves user images visible');
    check(node('saved').open&&inner('saved').open,'Preferences retain both open disclosures');
    apply([{...wrapped,version:'3'}]);await frame();
    check(node('wrapped').open&&!inner('wrapped').open&&!node('wrapped').querySelector('img'),'Live replacement retains image preference and disclosure choices');
    timeline.setVisibility({showToolImages:true});
    await until(()=>node('wrapped').querySelector('img')?.naturalWidth,'enabling previews did not restore the screenshot');
    check(node('wrapped').querySelectorAll('img').length===1,'Re-enabling previews restores each once');
    const textCalls=[
      ['inspect','cua_repl · js','Studio 창을 복원해 장치 상태 확인','undefined'],
      ['finish','cua_repl · js','Confirmed print continued at layer 187','Completion summary received.'],
      ['failure','cua_repl · js','기준판의 저장 플러시 수치 복원','point is over another window'],
      ['node-text','node_repl · js','Check the paused dialog','window ready']
    ];
    const first=detailCalls;
    apply(textCalls.map(([key,tool,title,output],index)=>{
      const args=key==='finish'?{completion_summary:title}:{title,code:'await inspect()'};
      const body=[args,{content:[{type:'text',text:output}]},{automaticApprovalReviews:[{status:'approved'}]}];
      bodies.set(key,body.map(value=>JSON.stringify(value)).join('\n\n'));
      return {...saved,key,order:10+index,title:tool,computerUse:{title},attachments:[],status:key==='failure'?'failed':'completed',
        approvalReview:{status:'approved'},kind:index%2?'storedToolEvent':'mcpToolCall'};
    }));
    for(const [key,,title] of textCalls){
      check(node(key).matches('details.activity:not([open])')&&!inner(key)&&node(key).parentElement===container,key+' is a standalone single disclosure');
      check(summary(key).textContent==='컴퓨터 사용 · '+title+(key==='failure'?'ㆍ실행 실패':''),key+' keeps the task caption and original outcome');
      check(!node(key).querySelector('.timeline-attachments'),key+' has no gallery');
    }
    check(detailCalls===first,'Text-only rows do not load their body while collapsed');
    for(const [key] of textCalls){
      summary(key).click();
      await until(()=>node(key).querySelector('pre').textContent===bodies.get(key),key+' body was not reached in one click');
      check(node(key).querySelector('pre').getBoundingClientRect().height>0,key+' shows input, output and review on the first click');
    }
    check(detailCalls===first+textCalls.length,'Each text-only click loads only that call');
    const title='Looking above the main nozzle temperature',secondId='d'.repeat(64);
    const mixed={...saved,key:'mixed',order:14,kind:'mcpToolCall',title:'node_repl · js',computerUse:{title},attachments:[]};
    apply([{...mixed,status:'inProgress'}]);
    check(!inner('mixed')&&summary('mixed').textContent.startsWith('컴퓨터 사용 · '+title),'A running titled call is shown before output arrives');
    bodies.set('mixed',JSON.stringify({code:'await scrollStudio(654,393,-380);',title})+'\n\n'+JSON.stringify({content:[
      {type:'text',text:'225 fields, focus: filament settings'},{type:'image',preview:imageId},{type:'image',preview:secondId}]}));
    apply([{...mixed,version:'2',status:'completed',attachments:[
      {...images[0],name:'Image 1.jpg'},{...images[0],desktopId:secondId,name:'Image 2.jpg'}]}]);
    check(!node('mixed').open&&!inner('mixed').open&&!node('mixed').querySelector('img'),'Two arriving images stay collapsed by default');
    summary('mixed').scrollIntoView({block:'center'});await frame();
    summary('mixed').click();
    await until(()=>node('mixed').querySelectorAll('img').length===2,'both mixed-result images did not appear');
    const pictures=[...node('mixed').querySelectorAll('img')];
    for(const img of pictures){img.scrollIntoView({block:'center'});await until(()=>img.naturalWidth,'a visible mixed-result image did not load');}
    check(pictures.every((img,index)=>img.closest('details')===node('mixed')&&img.src.includes([imageId,secondId][index])),'Both photos appear in source order outside the raw record');
    check(!inner('mixed').open&&inner('mixed').firstElementChild.textContent==='node_repl · js'&&detailCalls===first+textCalls.length,'Mixed text and commands stay inside the closed raw record');
    inner('mixed').firstElementChild.click();
    await until(()=>inner('mixed').querySelector('pre').textContent===bodies.get('mixed'),'mixed raw record did not load');
    apply([{...mixed,key:'unavailable',order:15,computerUse:{title,imageUnavailable:true}}]);
    summary('unavailable').click();
    await until(()=>node('unavailable').querySelector('.timeline-attachments'),'missing image notice did not appear');
    check(!inner('unavailable').open&&!node('unavailable').querySelector('img')&&node('unavailable').textContent.includes('이미지 미리보기'),'An image block without available bytes keeps its disclosure without fetching an unverified image');
    BridgeI18n.setLanguage('en');timeline.relabel();
    check(summary('failure').textContent.startsWith('Computer use · '+textCalls[2][2])&&node('failure').open,'Relabeling preserves the single open disclosure');
    timeline.setVisibility({showProcess:false});check(node('failure').hidden&&node('mixed').hidden,'Process visibility applies to both layouts');
    return checks;
  }finally{timeline.dispose();root.remove();BridgeI18n.setLanguage(originalLanguage);}
}
