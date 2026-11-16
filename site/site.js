'use strict';
const repo='https://github.com/try2love/codex-mobile-bridge';
const video=document.getElementById('tour');
const languageButtons=[...document.querySelectorAll('[data-language]')];
let language='ko',chapters=[];
const translations=[...document.querySelectorAll('[data-en]')].map(node=>({node,ko:node.textContent,en:node.dataset.en}));
const attributes=['alt','aria-label','title'].flatMap(name=>[...document.querySelectorAll('[data-en-'+name+']')].map(node=>({node,name,ko:node.getAttribute(name),en:node.getAttribute('data-en-'+name)})));
function setTracks(){for(const track of video.textTracks)track.mode=track.language===language?'showing':'disabled';}
function renderChapters(){
  document.getElementById('chapters').replaceChildren(...chapters.map(chapter=>{
    const button=document.createElement('button'),time=document.createElement('time'),label=document.createElement('span');
    button.type='button';time.textContent=Math.floor(chapter.start/60)+':'+String(Math.floor(chapter.start%60)).padStart(2,'0');label.textContent=chapter[language];
    button.append(time,label);button.onclick=()=>{
      const seek=()=>{video.currentTime=chapter.start;video.play().catch(()=>{});};
      if(video.readyState>=1)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});video.load();}
      video.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
    };return button;
  }));
}
function setLanguage(value,persist=false){
  language=value==='en'?'en':'ko';document.documentElement.lang=language==='en'?'en':'ko-KR';
  for(const item of translations)item.node.textContent=item[language];
  for(const item of attributes)item.node.setAttribute(item.name,item[language]);
  languageButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===language)));
  document.querySelectorAll('[data-doc-link]').forEach(link=>link.href=language==='en'?repo+'/blob/main/README_EN.md':repo);
  document.querySelectorAll('[data-setup-link]').forEach(link=>{const url=new URL(link.href);url.searchParams.set('lang',language);link.href=url;});
  const title=language==='en'?'Codex Mobile Bridge | Your workspace, across screens':'Codex Mobile Bridge | 여러 기기에서 이어지는 작업 공간';
  const description=language==='en'?'An open-source, self-hosted workspace for Codex, Claude Desktop, DeepSeek Harness and ZCode across Web, Android and iOS. v2.2.0 adds multiple connection routes, native side chats and lower idle resource usage.':'웹, Android, iOS에서 Codex, Claude Desktop, DeepSeek Harness, ZCode를 사용할 수 있는 오픈 소스 자체 호스팅 작업 공간입니다. v2.2.0에는 여러 연결 경로, 네이티브 보조 채팅, 유휴 자원 사용량 개선이 포함됩니다.';
  document.title=title;document.querySelector('meta[name=description]').content=description;document.querySelector('meta[property="og:title"]').content=title;document.querySelector('meta[property="og:description"]').content=description;
  const canonical='https://try2love.github.io/codex-mobile-bridge/'+(language==='en'?'?lang=en':'');
  document.querySelector('link[rel=canonical]').href=canonical;document.querySelector('meta[property="og:url"]').content=canonical;
  setTracks();renderChapters();if(window.demoExperienceReady)refreshExperience();if(lightbox.open&&zoomSource)showImage(zoomSource);
  if(persist){try{localStorage.setItem('cmb-site-language',language);}catch{}const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);}
}
languageButtons.forEach(button=>button.onclick=()=>setLanguage(button.dataset.language,true));
const lightbox=document.getElementById('lightbox');let zoomSource=null;
function showImage(source){const image=document.getElementById('large-image');image.src=source.src;image.alt=source.alt;document.getElementById('image-caption').textContent=source.alt;}
document.querySelectorAll('[data-zoom]').forEach(button=>button.onclick=()=>{zoomSource=button.querySelector('img');showImage(zoomSource);lightbox.showModal();});
document.getElementById('close-lightbox').onclick=()=>lightbox.close();
lightbox.addEventListener('click',event=>{if(event.target===lightbox){const rect=lightbox.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)lightbox.close();}});
const routeButtons=[...document.querySelectorAll('[data-route]')];
function selectRoute(key,focus=false){routeButtons.forEach(button=>{const active=button.dataset.route===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.getElementById(button.getAttribute('aria-controls')).hidden=!active;if(active&&focus)button.focus();});}
routeButtons.forEach((button,i)=>{
  button.onclick=()=>selectRoute(button.dataset.route);
  button.onkeydown=event=>{let next;if(event.key==='ArrowRight')next=(i+1)%routeButtons.length;if(event.key==='ArrowLeft')next=(i+routeButtons.length-1)%routeButtons.length;if(event.key==='Home')next=0;if(event.key==='End')next=routeButtons.length-1;if(next!==undefined){event.preventDefault();selectRoute(routeButtons[next].dataset.route,true);}};
});
let initial=new URL(location.href).searchParams.get('lang');
if(!['ko','en'].includes(initial)){try{initial=localStorage.getItem('cmb-site-language');}catch{}if(!['ko','en'].includes(initial))initial='ko';}
setLanguage(initial);
video.addEventListener('loadedmetadata',setTracks);
fetch('./assets/tour-chapters.json?v=1.3.0').then(response=>{if(!response.ok)throw Error('Chapters unavailable');return response.json();}).then(value=>{chapters=value;renderChapters();}).catch(()=>{});

function openCloudflareGuide(){const route={'#cloudflare-guide':'cloudflare','#tailscale-guide':'tailscale'}[location.hash];if(route){selectRoute(route);document.getElementById(location.hash.slice(1)).scrollIntoView();}}
window.addEventListener('hashchange',openCloudflareGuide);openCloudflareGuide();

const demoFrame=document.getElementById('product-demo');
const deviceStage=document.getElementById('device-panel');
const deviceButtons=[...document.querySelectorAll('[data-device]')];
let demoPlatform='ios';
const experienceCopy={
 ios:{name:'iOS APP · V2.0.0',ko:['컴퓨터 목록에서 작업대로。','여러 대의 컴퓨터를 저장하고 언제든지 동일한 채팅에 참여하세요. 더 많은 메뉴를 열고 알림, 설정, 스마트 아일랜드 동작을 경험해 보세요.。',['채팅에 들어가려면 내 업무용 컴퓨터를 클릭하세요.','파일이나 사이드 채팅을 열려면 ＋를 클릭하세요.','더 열어서 스마트 아일랜드의 지침을 확인하세요'],'iOS 설치에는 본인이 서명해야 합니다. 스마트 아일랜드의 배경 상태가 뒤쳐질 수 있습니다.。'],en:['From your computers to your workspace.','Save several computers and pick up the same chat. Open More to explore notifications, settings and a Live Activity illustration.',['Choose My work computer and open a chat','Use + to open files or a side chat','Open More to preview a Live Activity'],'The iOS App requires your own signing. Background Live Activity state may be stale.']},
 android:{name:'ANDROID APP · V2.0.0',ko:['휴대용 릴레이, 보다 직접적인 작동。','QR 코드를 스캔하여 컴퓨터에 저장하고 휴대폰에서 채팅, 파일 관리, 변경 사항 검토를 계속하세요. 컴팩트한 인터페이스로 현재 작업을 위한 공간 확보。',['저장된 컴퓨터 선택','요청을 보내고 시뮬레이션된 응답을 확인하세요.','열려 있는 Git，저장하고 제출해 보세요'],'다음과 같이 시연됨 v2.0.0；v2.2.0 설정에서 켤 수 있습니다 Android 백그라운드 알림。'],en:['Pick up your work, wherever you are.','Scan and save computers, continue chats, manage files and review changes. A compact interface leaves room for the task.',['Choose a saved computer','Send an instruction and see a simulated reply','Open Git, then try staging and committing'],'This demo uses v2.0.0; v2.2.0 offers optional Android background notifications in settings.']},
 web:{name:'MOBILE WEB · V2.0.0',ko:['브라우저를 열고 작업 현장으로 이동。','설치할 필요가 없습니다 App。게이트웨이 접속 후 모바일 브라우저에서도 파일, 터미널 이용 가능、Git 측과 채팅。',['입력 상자에 직접 요구사항을 추가하세요.','모델 전환、Skill 권한이 있는','＋를 클릭하여 새 워크벤치 탭을 엽니다.'],'데모는 모바일 브라우저 레이아웃입니다. 실제 액세스에는 컴퓨터 게이트웨이에 대한 연결이 필요합니다。'],en:['Open a browser. Get back to work.','No App installation needed. Connect to your gateway to use files, a terminal, Git and side chats from a mobile browser.',['Add an instruction in the composer','Change model, Skills and permissions','Use + to open a workbench tab'],'This illustrates a mobile browser. Real use requires a reachable computer gateway.']},
 desktop:{name:'DESKTOP WEB · V2.0.0',ko:['대화를 나누면서 동시에 업무를 처리하세요.。','와이드스크린 왼쪽 및 오른쪽 분할 화면: 기본 채팅과 도구가 각각 한 열을 차지합니다. 사이드 채팅이나 터미널을 열고 중간 구분선을 드래그해 보세요.。',['기본 채팅을 왼쪽에 유지','오른쪽 파일 열기、Git 또는 터미널','두 열의 비율을 조정하려면 구분 막대를 드래그하세요.'],'좁은 화면은 자동으로 단일 열을 유지합니다.。'],en:['Keep the conversation beside the work.','Wide browsers split the main chat and tools into two panes. Open a side chat or terminal, then drag the divider.',['Keep the main chat on the left','Open files, Git or a terminal on the right','Drag the divider to resize the panes'],'Narrow screens stay in a single pane.']},
 gateway:{name:'DESKTOP GATEWAY APP · SIMULATION',ko:['컴퓨터 측 구성, 휴대폰 측 릴레이。','실제 컴퓨터 인터페이스를 따라 연결을 추가하고 구성을 저장하고 데모 게이트웨이를 시작하세요. QR코드, 네트워크 감지, 서버 구축 등 실제 구현 필요 App 에 사용。',['”네트워크 액세스”를 엽니다.」','연결 방법 추가 및 구성','저장 후 ’개요’로 돌아가서 시작하세요.'],'튜토리얼에 따라 고급 서버 구성을 직접 완료해야 합니다.；App 대신하여 실행되지 않음 sudo。'],en:['Set up on desktop. Pick up on mobile.','Use the actual desktop layout to add a connection, save settings and start a demo gateway. Pairing codes, network checks and deployment require the real App.',['Open Network access','Add and configure a connection','Save, then start from Overview'],'Advanced server preparation follows the guide; the App does not run sudo for you.']}
};
function refreshExperience(){
 const copy=experienceCopy[demoPlatform][language];
 document.getElementById('stage-title').textContent=copy[0];document.getElementById('stage-description').textContent=copy[1];document.getElementById('stage-steps').replaceChildren(...copy[2].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));document.getElementById('stage-boundary').textContent=copy[3];document.getElementById('device-name').textContent=experienceCopy[demoPlatform].name;
 demoFrame.title=language==='en'?'Bridge '+experienceCopy[demoPlatform].name+' interactive demo':'Bridge '+experienceCopy[demoPlatform].name+' 대화형 데모';
 const demoUrl=new URL(demoFrame.src,location.href);
 if(demoUrl.searchParams.get('lang')!==language){demoUrl.searchParams.set('lang',language);demoFrame.src=demoUrl.href;}else demoFrame.contentWindow?.postMessage({type:'bridge-demo-language',lang:language},'*');
}
window.demoExperienceReady=true;
function selectDevice(key,scene,focus=false){
 if(!experienceCopy[key])return;
 demoPlatform=key;deviceStage.dataset.platform=key;deviceStage.setAttribute('aria-labelledby','device-'+key);
 deviceButtons.forEach(b=>{const active=b.dataset.device===key;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});
 const url=new URL('./demo.html',location.href);url.searchParams.set('platform',key);url.searchParams.set('lang',language);if(scene)url.searchParams.set('scene',scene);else if(key==='desktop')url.searchParams.set('scene','files');
 demoFrame.src=url.href;refreshExperience();
}
deviceButtons.forEach((b,i)=>{b.onclick=()=>selectDevice(b.dataset.device);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%deviceButtons.length;if(e.key==='ArrowLeft')next=(i+deviceButtons.length-1)%deviceButtons.length;if(e.key==='Home')next=0;if(e.key==='End')next=deviceButtons.length-1;if(next!==undefined){e.preventDefault();selectDevice(deviceButtons[next].dataset.device,undefined,true);}};});
function showDemoScene(scene,scroll=false){if(scene==='split')selectDevice('desktop','side');else if(demoPlatform==='gateway')selectDevice('desktop',scene);else demoFrame.contentWindow?.postMessage({type:'bridge-demo-scene',scene},'*');if(scroll)document.getElementById('experience').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>showDemoScene(b.dataset.scene));
document.querySelectorAll('[data-demo-jump]').forEach(b=>b.onclick=()=>showDemoScene(b.dataset.demoJump,true));
demoFrame.onload=refreshExperience;
window.addEventListener('message',e=>{if(e.source!==demoFrame.contentWindow||e.origin!=='null'||e.data?.type!=='bridge-demo-handoff')return;selectDevice('ios','chat');});
selectDevice('ios');
