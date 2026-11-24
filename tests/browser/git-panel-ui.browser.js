// 실제 패널·스타일과 메모리 응답으로 저장소별 조회와 지연 응답 경계를 확인한다.
async function runGitRepositorySelectionChecks(){
  await BridgeFeatures.load('chat');
  const checks=[],check=(value,label)=>{if(!value)throw Error(label);checks.push(label);},frame=()=>new Promise(requestAnimationFrame);
  const until=async fn=>{const end=performance.now()+4000;while(!fn()){if(performance.now()>end)throw Error('Git panel did not settle');await frame();}};
  const root=document.createElement('div');root.id='git-repository-fixture';root.style.cssText='position:fixed;inset:16px;z-index:30;background:var(--page);max-width:900px;margin:auto';document.body.append(root);
  const body=document.createElement('div');body.className='wb-git';root.append(body);
  const base=window.BridgeWorkbench,session={id:'fixture',host:'local',cwd:'/workspace',files:[]},tab={body};session.files.push(tab);
  const calls=[],repositories=[{path:'repo-a',name:'repo-a',root:'/workspace/repo-a'},{path:'repo-b',name:'repo-b',root:'/workspace/repo-b'}];let empty=false,hold=false,finishDiff;
  const entry={path:'literal <file>.txt',index:'M',worktree:'M',untracked:false,conflict:false};
  const diff=repo=>({kind:'diff',path:entry.path,text:'--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+Changed in '+repo+'\n'});
  const wb={node:base.node.bind(base),button:base.button.bind(base),raw:base.raw.bind(base),notify(){},url:(s,operation,path='')=>'/synthetic/'+operation+'?path='+encodeURIComponent(path),request:async(url,params,signal)=>{
    const parsed=new URL(url,location.origin),action=parsed.pathname.split('/').at(-1),repository=params?.repository??parsed.searchParams.get('repository');calls.push({action,repository,params,signal});
    if(action==='git-repositories')return {
      repositories:empty?[]:session.cwd==='/workspace'?repositories:[{path:'repo-c',name:'repo-c',root:'/moved/repo-c'}],
      project:session.cwd
    };
    if(action==='git-status')return {available:true,project:repository,branch:'main',commit:'1'.repeat(40),scope:'.',entries:[entry],version:'version-'+repository};
    if(action==='git-diff'){if(hold){hold=false;return new Promise(resolve=>finishDiff=resolve);}return {...diff(repository),section:parsed.searchParams.get('section'),hunks:['1'.repeat(64)],canDiscardHunk:true,version:'version-'+repository};}
    if(action==='git-history')return {commits:[{id:(repository==='repo-a'?'a':'b').repeat(40),subject:'Changes in '+repository,author:'Fixture',date:'2026-11-17T00:00:00Z',parents:[]}],hasMore:false};
    if(action==='git-commit')return {id:parsed.searchParams.get('revision'),message:'Commit in '+repository,author:'Fixture',date:'2026-11-17T00:00:00Z',parents:[],entries:[{change:'M',path:entry.path}]};
    if(action==='git-history-diff')return diff(repository);
    if(action==='git-branches')return {branches:[{name:'main',id:'1'.repeat(40),current:true}]};
    if(action==='git-action')return {outcome:'success',message:'Synthetic action recorded'};
    throw Error('Unexpected Git fixture action '+action);
  }};
  const composer=document.createElement('div'),input=document.createElement('textarea');
  root.append(composer);composer.append(input);let scope='fixture',changes=0;
  const quotes=new ComposerQuotes({messages:root,input,container:composer,scope:()=>({provider:'codex',session:scope}),onChange:()=>changes++,translate:key=>BridgeI18n.t(key)});
  wb.reviewLine=(review,target)=>{check(target.id==='fixture'&&target.host==='local','review keeps its chat identity');quotes.reviewLine(review);};
  const panel=new GitPanel(wb,session,tab);const language=BridgeI18n.language();
  try{
    await panel.load();
    const picker=()=>body.querySelector('.wb-git-repository');
    check(picker().options.length===2&&picker().value==='repo-a'&&panel.state.project==='repo-a','initial Git selection resolves the first available checkout inside the chat workspace');
    check(session.cwd==='/workspace'&&calls.find(call=>call.action==='git-status').repository==='repo-a','Git selection routes status without changing the chat cwd');
    check(body.querySelector('.wb-git-path strong').textContent===entry.path&&!body.querySelector('.wb-git-path file'),'file names remain literal text');
    const row=body.querySelector('.wb-git-file[data-section=unstaged]');hold=true;const old=panel.show(entry,'unstaged',row);await until(()=>finishDiff);
    picker().value='repo-b';picker().onchange();await until(()=>panel.state.project==='repo-b'&&body.querySelector('.wb-git-file'));
    check(calls.filter(call=>call.action==='git-repositories').length===1
      &&calls.filter(call=>call.action==='git-status').map(call=>call.repository).join(',')==='repo-a,repo-b',
    'switching repositories reuses discovery and reads fresh status for the selected checkout');
    await panel.show(entry,'unstaged',body.querySelector('.wb-git-file[data-section=unstaged]'));finishDiff(diff('stale-repo-a'));await old;
    check(body.textContent.includes('Changed in repo-b')&&!body.textContent.includes('stale-repo-a'),'late diffs from the previous checkout cannot replace the current selection');
    body.querySelector('.wb-hunk-actions button:last-child').click();
    let dialog=document.querySelector('.wb-git-dialog');
    check(dialog.querySelector('.wb-hunk-preview').textContent.includes('+Changed in repo-b')&&!calls.some(call=>call.action==='git-action'),'discard previews the exact displayed block without writing');dialog.close();
    await until(()=>!document.querySelector('.wb-git-dialog'));body.querySelector('.wb-hunk-actions button:first-child').click();
    await until(()=>!panel.busy&&body.querySelector('.wb-hunk-actions'));
    const staged=calls.find(call=>call.params?.action==='stage-hunk');
    check(staged.params.path===entry.path&&staged.params.hunk==='1'.repeat(64)&&staged.params.version==='version-repo-b'&&staged.params.repository==='repo-b','stage submits only the selected path, token, repository and reviewed version');
    const beforeHistory=calls.length;
    body.querySelector('[data-git-mode=history]').click();await until(()=>body.querySelector('.wb-history-row'));
    const historyReads=calls.slice(beforeHistory);
    check(historyReads.map(call=>call.action).join(',')==='git-status,git-history'
      &&historyReads.every(call=>call.repository==='repo-b'),'history reads fresh data without rediscovering repositories');
    body.querySelector('.wb-history-row').click();await until(()=>body.querySelector('.wb-history-diff-area .wb-diff-summary'));
    check(body.textContent.includes('Commit in repo-b')&&body.textContent.includes('Changed in repo-b'),'commit history, details and historical diff all use the selected checkout');
    check(!body.querySelector('.wb-hunk-actions'),'commit history exposes no worktree mutation controls');
    body.querySelector('.removed button.wb-diff-number').click();dialog=document.querySelector('.diff-review-dialog');
    dialog.querySelector('textarea').value='Keep this behavior';dialog.querySelector('form').requestSubmit();
    check(changes===1&&quotes.quotes[0].text.includes('/workspace/repo-b/'+entry.path+':1')&&quotes.quotes[0].text.includes('b'.repeat(40))&&quotes.quotes[0].text.includes('-old')&&quotes.quotes[0].text.includes('Keep this behavior'),'a historic line and revision are captured in its chat draft');
    await until(()=>!document.querySelector('.diff-review-dialog'));
    const recorded=document.createElement('div'),cursor={};root.append(recorded);
    const review=row=>quotes.reviewLine({...row,repository:'/workspace',path:'past.txt',revision:'recorded-turn'});
    appendTurnDiff(recorded,cursor,'@@ -2',5,review);appendTurnDiff(recorded,cursor,' +8,2 @@\n-old\n+long',25,review);
    check(recorded.querySelectorAll('button').length===1,'split hunk headers are parsed and incomplete lines cannot be reviewed');
    appendTurnDiff(recorded,cursor,' line\n+last\n',null,review);recorded.querySelector('.added button').click();
    dialog=document.querySelector('.diff-review-dialog');dialog.querySelector('textarea').value='past note';dialog.querySelector('form').requestSubmit();
    check(changes===2&&quotes.quotes[1].text.includes('past.txt:8')&&quotes.quotes[1].text.includes('+long line')&&quotes.quotes[1].text.includes('recorded-turn'),'recorded turn comments preserve complete lines across chunk boundaries');
    await until(()=>!document.querySelector('.diff-review-dialog'));
    recorded.querySelector('button').click();dialog=document.querySelector('.diff-review-dialog');
    dialog.querySelector('textarea').value='wrong scope';scope='another';dialog.querySelector('form').requestSubmit();
    check(changes===2,'switching chat while reviewing drops the stale submission');recorded.remove();composer.remove();
    check(calls.filter(call=>['git-history','git-commit','git-history-diff'].includes(call.action)).every(call=>call.repository==='repo-b'),'every historical read carries the repository parameter');
    body.querySelector('[data-git-mode=changes]').click();await until(()=>body.querySelector('.wb-git-file'));
    panel.confirm('Selected checkout','Synthetic confirmation',{action:'stage',path:entry.path},'Confirm');
    panel.repository='repo-a';document.querySelector('.wb-git-dialog form').requestSubmit();
    await until(()=>!document.querySelector('.wb-git-dialog')&&!panel.busy);
    const write=calls.find(call=>call.params?.action==='stage');
    check(write.params.repository==='repo-b'&&write.params.version==='version-repo-b','a confirmation retains its original repository and version if selection changes');
    for(const [lang,label]of [['ko','Git 저장소'],['en','Git repository'],['zh','Git 仓库']]){
      BridgeI18n.setLanguage(lang);await panel.load();check(picker().getAttribute('aria-label')===label&&picker().value==='repo-a','repository picker follows '+lang+' without changing the selection');
    }
    empty=true;
    const discoveries=calls.filter(call=>call.action==='git-repositories').length;
    body.querySelector('.wb-git-head button').click();await until(()=>!picker()&&body.querySelector('.wb-status').textContent===BridgeI18n.t('No Git repository was found in this project.'));
    check(calls.filter(call=>call.action==='git-repositories').length===discoveries+1,'manual refresh rediscovers removed repositories and clears stale actions');
    empty=false;BridgeI18n.setLanguage('ko');await panel.load();
    body.querySelector('[data-git-mode=history]').click();await until(()=>body.querySelector('.wb-history-row'));body.querySelector('.wb-history-row').click();await until(()=>body.querySelector('.wb-diff-summary'));
    check(root.scrollWidth<=root.clientWidth+1&&picker().getBoundingClientRect().width<=root.clientWidth,'repository selection and history fit the viewport');
    session.cwd='/moved';
    const beforeMove=calls.length;
    body.querySelector('[data-git-mode=changes]').click();
    await until(()=>panel.state.project==='repo-c'&&body.querySelector('.wb-git-file'));
    check(picker().value==='repo-c'&&calls[beforeMove].action==='git-repositories','changing the chat directory invalidates repository discovery');
    return {width:innerWidth,passed:checks.length,checks};
  }finally{BridgeI18n.setLanguage(language);panel.dispose();}
}

// Run in the isolated Git fixture after opening its Git panel.
async function runGitPanelTests() {
  const workbench = window.BridgeWorkbench, session = workbench.current, tab = session.files.find(t => t.id === 'git'), checks = [];
  const check = (value, label) => { if (!value) throw Error(label); checks.push(label); };
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 20)); } throw Error('Git fixture did not settle'); };
  const row = (section, path) => [...tab.body.querySelectorAll('.wb-git-file')].find(n => n.dataset.section === section && n.dataset.path === path);
  check(!!row('staged', 'src/app.py') && !!row('unstaged', 'src/app.py'), 'Same file has separate staged and unstaged entries');
  row('staged', 'src/app.py').click(); await wait(() => tab.body.querySelector('.wb-diff-summary'));
  check(tab.body.querySelector('.wb-git-diff').textContent.includes('Hello, mobile') && !tab.body.querySelector('.wb-git-diff').textContent.includes('Hello, workbench'), 'Staged selection compares HEAD with the index');
  row('unstaged', 'src/app.py').click(); await wait(() => tab.body.querySelector('.wb-diff-summary'));
  check(tab.body.querySelector('.wb-git-diff').textContent.includes('Hello, workbench'), 'Unstaged selection shows working tree changes');
  check(tab.body.querySelector('.wb-diff-line.added .wb-diff-number:nth-child(2)').textContent !== '', 'Added lines display new line numbers');
  row('untracked', 'new-image.png').click(); await wait(() => tab.body.textContent.includes('바이너리'));
  check(!!tab.body.querySelector('.wb-git-diff'), 'Binary files keep the panel and show an explanation');
  row('staged', 'notes-renamed.txt').click(); await wait(() => tab.body.textContent.includes('텍스트 차이 없음'));
  check(tab.body.textContent.includes('원래 경로：notes.txt'), 'Renames show original path even without text changes');
  const input = document.getElementById('message'); workbench.select('chat'); await frames();
  input.value = 'Git review draft'; input.dispatchEvent(new Event('input'));
  const timeline = document.getElementById('timeline'); timeline.scrollTop = 80; await frames(); const position = timeline.scrollTop;
  workbench.select('git'); await frames(); workbench.select('chat'); await frames();
  check(input.value === 'Git review draft' && Math.abs(timeline.scrollTop - position) < 2, 'Git tab round trip preserves draft and reading position');
  workbench.select('git'); document.getElementById('back').click();
  check(!document.getElementById('app').classList.contains('chat-open'), 'Header back from Git returns directly to chat list');
  document.getElementById('app').classList.add('chat-open'); workbench.select('git');
  workbench.open(session.id, 'other-host'); check(!workbench.current.files.some(t => t.id === 'git'), 'Git tabs remain isolated by host'); workbench.open(session.id, session.host);
  await tab.git.load(); check(tab.body.querySelector('.wb-git-file.selected')?.dataset.path === 'notes-renamed.txt', 'Refresh restores the selected file when it is still changed');
  await wait(() => tab.body.textContent.includes('텍스트 차이 없음'));
  // Detached test panel covers delayed response races and text-only rendering.
  const body = document.createElement('div'), fakeTab = {body}, pending = [];
  const fake = new GitPanel({node: workbench.node.bind(workbench), button: workbench.button.bind(workbench), url:()=>'/fixture', request:()=>new Promise(resolve=>pending.push(resolve))}, session, fakeTab);
  const load = fake.load(); pending.shift()({available:true,branch:'test',commit:'abc',project:'fixture',scope:'.',entries:[{path:'a.txt',index:'M',worktree:'.'},{path:'b.txt',index:'M',worktree:'.'}]}); await load;
  const buttons = body.querySelectorAll('.wb-git-file'); buttons[0].click(); buttons[1].click();
  pending[1]({kind:'diff',text:'--- b.txt\n+++ b.txt\n@@ -1 +1 @@\n-old\n+<img src=x onerror=alert(1)>\n'}); await frames();
  pending[0]({kind:'diff',text:'stale response'}); await frames();
  check(body.textContent.includes('<img src=x') && !body.textContent.includes('stale response'), 'Late diff response cannot overwrite newer selection');
  check(!body.querySelector('img'), 'File content is rendered as text, never HTML');
  const clean = fake.load(); pending[2]({available:true,branch:'test',commit:'abc',project:'fixture',scope:'.',entries:[]}); await clean;
  check(body.textContent.includes('커밋되지 않음'), 'Clean repository has an explicit empty state');
  fake.dispose();
  return checks;
}
