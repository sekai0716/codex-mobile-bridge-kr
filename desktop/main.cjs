'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,clipboard,Tray,Menu,net,nativeImage}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {runWorker,workerFor,createSnapshotWorker,createManagementWorker}=require('./shared/controller.cjs');
const {pairingImage}=require('./features/connections/qr.cjs');
const {createTray}=require('./shell/tray.cjs');
const {normalize,translate}=require('./shared/i18n.js');
const {publishLanguage}=require('./shared/gateway-language.cjs');
const cloudflared=require('./features/connections/cloudflared.cjs');
const {Updater,allowedMirrorUrl,activeUpdateHandoff}=require('./features/updates/updater.cjs');
const {relaunchMacUpdate,restoreMacUpdate}=require('./features/updates/mac-handoff.cjs');
relaunchMacUpdate({app,process});
const {createLoginStartup,restoreDevelopmentEnvironment}=require('./login-startup.cjs');
restoreDevelopmentEnvironment(app);
const loginStartup=createLoginStartup(app);
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {interfaces}=require('./features/connections/network.cjs');
let language='en';
const t=(text,selected=language)=>translate(text,selected);
const root=path.resolve(__dirname,'..');
// An explicit data directory also keeps test caches inside the project.
if(process.env.CMB_DATA_DIR)app.setPath('userData',path.join(path.resolve(process.env.CMB_DATA_DIR),'desktop-runtime'));
let window,dataDir,tray,quitting=false,snapshotPending,lastSnapshot,updateQuitting=false;
let installPending,installStatus={},updater,workerWrites=0,officialRemote;
const snapshotWorker=createSnapshotWorker();
const managementWorker=createManagementWorker();
let connectionSecrets={},setupPending=false;
const entry=pathToFileURL(path.join(__dirname,'index.html')).href;
function releaseTray(){officialRemote?.dispose();snapshotWorker.close();managementWorker.close();quitting=true;tray?.dispose();tray=null;}
function officialService(){
  if(!officialRemote){
    const {OfficialRemote}=require('./features/zcode-official/controller.cjs');
    officialRemote=new OfficialRemote({electron:require('electron'),profile:dataDir,
      localServiceWorker:workerFor({packaged:app.isPackaged,resources:process.resourcesPath,root,dataDir}),rendererPath:app.isPackaged?
      path.join(process.resourcesPath,'gateway/_internal/bridge/clients/zcode/renderer.mjs'):path.join(root,'bridge/clients/zcode/renderer.mjs')});
  }
  return officialRemote;
}
function restoreOfficialService(){
  // Saved pairings can be selected from the phone before the desktop panel is opened.
  if(!fs.existsSync(path.join(dataDir,'zcode-official-auth.enc')))return;
  const service=officialService();
  service.start({standby:true}).catch(()=>{service.serviceAvailable=false;service.reason='공식 원격접속 서비스를 이용하실 수 없습니다.';});
}
function updateTarget(){return process.platform==='darwin'?path.resolve(process.execPath,'../../..'):path.dirname(process.execPath);}
let handoff=null;
function currentHandoff(){return activeUpdateHandoff(process.env,updateTarget(),app.getVersion(),process.pid);}
function loadDataDir(){
  handoff=currentHandoff();
  if(handoff)return handoff.dataDir;
  // Rollback explicitly launches the previous GUI without a transaction/token.
  if(!process.env.CMB_UPDATE_TRANSACTION&&!process.env.CMB_UPDATE_TOKEN&&process.env.CMB_UPDATE_DATA_DIR)
    return path.resolve(process.env.CMB_UPDATE_DATA_DIR);
  if(process.env.CMB_DATA_DIR)return path.resolve(process.env.CMB_DATA_DIR);
  const saved=path.join(app.getPath('userData'),'bridge-location.json');
  if(fs.existsSync(saved))return JSON.parse(fs.readFileSync(saved,'utf8')).dataDir;
  const local=path.join(process.resourcesPath,'bridge-data-dir.txt');
  if(app.isPackaged&&fs.existsSync(local))return fs.readFileSync(local,'utf8').trim();
  return app.isPackaged?path.join(app.getPath('userData'),'gateway'):path.join(root,'.local');
}
function authorize(event){
  if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!==entry)throw Error('이 UI 소스는 허용되지 않습니다.');
}
function updateResult(){try{return JSON.parse(fs.readFileSync(path.join(dataDir,'desktop-update-result.json'),'utf8'));}catch{return null;}}
function updateManaged(){
  if(handoff){
    const current=currentHandoff();
    if(!current||current.transaction!==handoff.transaction||current.token!==handoff.token||current.dataDir!==handoff.dataDir){
      handoff=null;
      delete process.env.CMB_UPDATE_LAUNCHER_PID;
    }
  }
  return !!handoff;
}
function worker(action,payload){
  if(action==='snapshot'&&updateQuitting)return Promise.resolve({...lastSnapshot,update:updater.status()});
  if(setupPending&&['save','start','stop'].includes(action))return Promise.reject(Error('서버 작업이 완료될 때까지 기다려 주세요.。'));
  if(action==='start')payload={...payload,connectionSecrets};
  const writes=(action==='cli-access'&&payload?.action!=='list')||(action==='network-adaptation'&&payload?.action!=='status')||(['harness','desktop-sessions'].includes(action)&&!['status','clients','detect'].includes(payload?.action))||['server-setup','connection-credentials','save','start','stop','devices','notification-watches','webhook-endpoint', 'transfer-settings'].includes(action);
  if(writes&&updater?.busy)return Promise.reject(Error('앱이 업데이트 중입니다. 기다리세요.'));
  if(writes)workerWrites++;
  if(action==='snapshot'&&snapshotPending)return snapshotPending;
  const options=workerFor({packaged:app.isPackaged,resources:process.resourcesPath,root,dataDir});
  const result=(action==='snapshot'&&!updater?.busy?snapshotWorker.read(options):['accounts','account','cli-access','desktop-sessions','start','stop','save'].includes(action)?managementWorker.call(options,action,payload):runWorker(options,action,payload)).then(value=>['snapshot','save'].includes(action)?{...value,networkInterfaces:value.networkInterfaces??interfaces(),cloudflaredInstall:installStatus,update:updater?.status(),updateResult:updateResult(),updateManaged:updateManaged(),loginStartup:loginStartup.status()}:value).finally(()=>{if(writes)workerWrites--;});
  if(action==='snapshot')snapshotPending=result.then(value=>{lastSnapshot=value;return value;}).finally(()=>{snapshotPending=null;});
  return action==='snapshot'?snapshotPending:result;
}
async function installUpdate(candidate){
  snapshotWorker.close();managementWorker.close();
  const target=updateTarget();
  const token=randomUUID();
  const prepared=await worker('update-prepare',{archive:candidate.archive,sha256:candidate.asset.sha256,version:candidate.version,
    platform:process.platform,arch:process.arch,target,parentPid:process.pid,token});
  // Preserve selected data location even when an old local bundle carried it inside Resources.
  fs.mkdirSync(app.getPath('userData'),{recursive:true});
  fs.writeFileSync(path.join(app.getPath('userData'),'bridge-location.json'),JSON.stringify({dataDir}),{mode:0o600});
  const log=fs.openSync(path.join(dataDir,'desktop-update.log'),'a',0o600);
  // A Windows process locks its cwd. Use a stable directory outside both the
  // installation being replaced and the transaction cleaned up on a later update.
  const child=spawn(prepared.helper,['update-apply','--data-dir',dataDir,'--plan',prepared.plan],{
    cwd:path.dirname(target),detached:true,windowsHide:true,stdio:['ignore',log,log],env:{...process.env,PYINSTALLER_RESET_ENVIRONMENT:'1'}});
  fs.closeSync(log);
  try{fs.writeFileSync(path.join(path.dirname(prepared.plan),'helper.json'),JSON.stringify({pid:child.pid}),{mode:0o600});}catch{}
  let spawnError;child.on('error',error=>{spawnError=error;});child.unref();
  const ready=path.join(path.dirname(prepared.plan),'ready.json'),end=Date.now()+15000;
  while(Date.now()<end){
    if(spawnError)throw spawnError;
    if(child.exitCode!==null)throw Error('앱 업데이터를 시작할 수 없습니다.');
    let readyToken;
    try{readyToken=JSON.parse(fs.readFileSync(ready,'utf8')).token;}catch{}
    if(readyToken===token){
      updateQuitting=true;snapshotPending?.catch(()=>{});snapshotWorker.close();
      // The verified helper owns gateway shutdown and the bundle swap. Do not
      // let a pending snapshot or cancellable quit hook block the handoff.
      app.exit(0);
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('앱 업데이터를 시작할 수 없습니다.');
}
function setupUpdater(){
  updater=new Updater({current:app.getVersion(),key:fs.readFileSync(path.join(__dirname,'features/updates/update-public-key.pem')),
    fetch:cloudflared.electronFetch(net,allowedMirrorUrl),directory:path.join(app.getPath('userData'),'updates'),
    // 한국어 포크 전용 서명 키와 배포 절차가 준비되기 전에는 원본 업데이트를 설치하지 않는다.
    skipFile:path.join(app.getPath('userData'),'skipped-update.json'),supported:false,
    preflight:process.platform==='win32'?()=>worker('update-preflight',{target:updateTarget()}):undefined,install:installUpdate});
  setTimeout(()=>updater.check(),5000).unref();
  setInterval(()=>updater.check(),6*60*60*1000).unref();
}
function showWindow(){
  if(!window)createWindow();
  if(window.isMinimized())window.restore();
  window.show();window.focus();
}
function register(){
  ipcMain.handle('bridge:check-update',event=>{authorize(event);return updater.check({manual:true});});
  ipcMain.handle('bridge:skip-update',event=>{authorize(event);return updater.skip();});
  ipcMain.handle('bridge:install-update',event=>{
    authorize(event);
    if(installPending||workerWrites||setupPending||updateManaged())throw Error('업데이트하기 전에 현재 작업이 완료될 때까지 기다리십시오.');
    return updater.install();
  });
  ipcMain.handle('bridge:language',event=>{authorize(event);return language;});
  ipcMain.handle('bridge:set-language',(event,value)=>{
    authorize(event);
    if(!['ko-KR','en','zh-CN'].includes(value))throw Error('Unsupported language');
    const directory=app.getPath('userData');fs.mkdirSync(directory,{recursive:true});
    publishLanguage(dataDir,value);
    fs.writeFileSync(path.join(directory,'language.json'),JSON.stringify({language:value}));
    language=value;const title=t('Codex 모바일 Bridge');if(window.getTitle()!==title)window.setTitle(title);tray?.relabel();return language;
  });
  for(const action of ['snapshot','save','start','stop','logs','test-notification','webhook-endpoint','network-adaptation','check-entry','tailscale-setup','devices','account', 'accounts', 'cli-access', 'harness', 'desktop-sessions','notification-watches', 'transfer-settings'])ipcMain.handle('bridge:'+action,async(event,payload)=>{
    authorize(event);
    if(action==='desktop-sessions'&&payload?.action?.startsWith('zcode-official-')){
      if(updater?.busy)throw Error('앱이 업데이트 중입니다. 기다리세요.');
      const service=officialService();
      await service.start();
      if(service!==officialRemote||service.disposed)throw Error('게이트웨이 데이터 디렉토리가 변경되었습니다. 관리 페이지를 다시 열어주세요。');
      if(payload.action==='zcode-official-state')return service.status();
      if(payload.action==='zcode-official-save')return service.save(payload.link);
      if(payload.action==='zcode-official-login')return service.login(payload.link);
      if(payload.action==='zcode-official-connect'){
        if(service.localLink(payload.link).url!==service.targetLink())throw Error('원격 제어 링크가 변경되었습니다. 먼저 연결 구성을 저장하세요.。');
        await worker('desktop-sessions',{action:'toggle-client',provider:'zcode',enabled:true,connectionMode:'official-remote'});
      }else if(payload.action==='zcode-official-disconnect'){
        await service.disconnect();
      }else if(payload.action==='zcode-official-forget'){
        return service.forget();
      }else if(payload.action==='zcode-official-local'){
        await service.disconnect();
        await worker('desktop-sessions',{action:'zcode-official',enabled:false});
      }else throw Error('공식 리모컨 작동 여부는 알 수 없음');
      return service.status();
    }
    if(action==='accounts'){
      if(updater?.busy&&payload?.action!=='list')throw Error('앱이 업데이트 중입니다. 기다리세요.');
      if(payload?.action==='openLogin'){
        const value=await worker('accounts',{action:'list',...(payload.entry?{entry:payload.entry}:{})}),url=new URL(value.enrollment?.authUrl||'');
        if(value.enrollment?.phase!=='waiting'||url.protocol!=='https:'||!['auth.openai.com','chatgpt.com','auth0.openai.com'].includes(url.hostname))throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        await shell.openExternal(url.href);return value;
      }
    }
    if(action==='desktop-sessions'&&payload?.action==='copy-claude-workspace'){const value=await worker(action,{action:'status'});clipboard.writeText(value.claudeWorkspace);return {copied:true};}
    if(action==='desktop-sessions'&&payload?.action==='prepare-claude'){const value=await worker(action,payload);clipboard.writeText(value.script);delete value.script;return value;}
    if(action==='save'&&payload?.loginStartup!==undefined){
      loginStartup.validate(payload.loginStartup);
      if(payload.loginStartup)payload={...payload,preferences:{...payload.preferences,autoStart:true}};
    }
    try{
      const value=await worker(action,payload);
      if(action==='save'&&payload?.loginStartup!==undefined){loginStartup.set(payload.loginStartup);value.loginStartup=loginStartup.status();}
      if(action==='snapshot')tray?.observe(value);
      return value;
    }catch(error){if(error.validation)return {validationError:{message:error.message,...error.validation}};throw error;}
  });
  ipcMain.handle('bridge:tailscale-authorize',async(event,value)=>{
    authorize(event);
    const current=await worker('snapshot');
    if(!current.preferences.connections.some(c=>c.id===value?.id&&c.accessMode==='tailscale'))throw Error('Tailscale 연결을 선택합니다.');
    const address=current.externalStatus?.[value.id]?.authUrl||(await worker('tailscale-setup',{id:value.id})).authUrl;
    let url;try{url=new URL(address);}catch{throw Error('Tailscale 클라이언트를 사용하여 로그인합니다. 항목을 시작한 후 추가 승인이 여기에 표시됩니다.');}
    if(url.protocol!=='https:'||url.hostname!=='login.tailscale.com'||url.username||url.password||(url.port&&url.port!=='443'))throw Error('Tailscale 인증이 잘못되었습니다. URL. 다시 감지합니다.');
    await shell.openExternal(url.href);return {message:'Tailscale 인증 페이지가 열렸습니다.'};
  });
  ipcMain.handle('bridge:read-credentials',async(event,value={})=>{
    authorize(event);
    if(value.id&&connectionSecrets[value.id])return {...connectionSecrets[value.id]};
    return worker('read-credentials',value);
  });
  ipcMain.handle('bridge:connection-credentials',async(event,value)=>{
    authorize(event);
    if(updater?.busy)throw Error('앱이 업데이트 중입니다. 기다리세요.');
    const current=await worker('snapshot');
    if(!current.preferences.connections.some(c=>c.id===value?.id))throw Error('먼저 연결 설정을 저장하세요.');
    const secret=value.secrets;
    if(!secret||typeof secret!=='object'||Object.keys(secret).some(key=>!['password','passphrase','tunnelToken','clear'].includes(key)))throw Error('연결 자격 증명 형식이 잘못되었습니다.');
    for(const [key,text] of Object.entries(secret))if(key!=='clear'&&(typeof text!=='string'||text.length>16384||text.includes('\0')))throw Error('연결 자격 증명 형식이 잘못되었습니다.');
    if(secret.clear){await worker('connection-credentials',{id:value.id,secrets:{clear:true}});delete connectionSecrets[value.id];}
    else if(value.remember){await worker('connection-credentials',{id:value.id,secrets:secret});delete connectionSecrets[value.id];}
    else connectionSecrets[value.id]={...connectionSecrets[value.id],...secret};
    return {message:value.remember?'시스템 자격 증명 저장소에 저장된 연결 자격 증명입니다.':'연결 자격 증명은 이 앱 세션 동안에만 메모리에 보관됩니다.'};
  });
  ipcMain.handle('bridge:copy-server-diagnostics',async(event,value)=>{
    authorize(event);const result=await worker('server-setup',{id:value.id,action:'diagnostics',language:value.language});
    clipboard.writeText(result.prompt);return {message:t('Read-only server inspection prompt copied.',value.language)};
  });
  ipcMain.handle('bridge:server-setup',async(event,value)=>{
    authorize(event);
    if(!['host','trust','inspect'].includes(value?.action))throw Error('이 앱은 SSH 연결 확인만 지원합니다. 서버 소프트웨어 및 권한을 수동으로 구성합니다.');
    if(updater?.busy)throw Error('앱이 업데이트 중입니다. 기다리세요.');
    if(setupPending)throw Error('서버 작업이 완료될 때까지 기다려 주세요.。');
    setupPending=true;
    try{
    if(value.action==='trust'){
      const current=await worker('server-setup',{id:value.id,action:'host'});
      if(current.fingerprint!==value.fingerprint)throw Error('호스트 지문이 변경되었습니다. 다시 확인하세요.。');
      const result=await dialog.showMessageBox(window,{type:'warning',buttons:[t('취소'),t('이 서버를 신뢰하세요')],defaultId:0,cancelId:0,
        message:t(current.changed?'서버 호스트 지문이 변경되었습니다.':'이 서버에 대한 첫 번째 연결'),
        detail:current.host+':'+current.port+'\n'+current.fingerprint+'\n'+t('서버 관리자나 서버 콘솔을 통해 이 지문을 확인하세요.')});
      if(result.response!==1)return {cancelled:true,message:t('호스트 지문이 저장되지 않았습니다.')};
    }
    return await worker('server-setup',{id:value.id,action:value.action,fingerprint:value.fingerprint,secrets:connectionSecrets[value.id]});
    }finally{setupPending=false;}
  });
  ipcMain.handle('bridge:install-cloudflared',async event=>{
    authorize(event);if(updater.busy)throw Error('앱이 업데이트 중입니다. 기다리세요.');if(installPending)return installPending;
    installPending=(async()=>{
      if((await worker('snapshot')).runtime.running)throw Error('cloudflared를 설치하기 전에 게이트웨이를 중지하십시오.');
      return cloudflared.install({dataDir,fetch:cloudflared.electronFetch(net),onProgress:value=>{installStatus=value;}});
    })().catch(error=>{installStatus={state:'error',message:error.message};throw error;}).finally(()=>{installPending=null;});
    return installPending;
  });
  ipcMain.handle('bridge:check-cloudflared',async(event,value)=>{
    authorize(event);const snapshot=await worker('snapshot');
    const executable=typeof value==='string'&&value.trim()?value.trim():snapshot.preferences.cloudflared;
    if(!executable||!path.isAbsolute(executable))throw Error('cloudflared를 찾을 수 없습니다. 다운로드 및 설치를 클릭하거나 다운로드한 실행 파일을 선택합니다.');
    return {path:executable,version:await cloudflared.probe(executable)};
  });
  ipcMain.handle('bridge:pairing',async(event,payload)=>{
    authorize(event);
    const grant=await worker('pairing',payload);
    if(payload.action!=='create')return grant;
    try{return await pairingImage(grant);}
    catch(error){await worker('pairing',{action:'revoke',id:grant.id});throw error;}
  });
  ipcMain.handle('bridge:export-deployment',async(event,payload)=>{
    authorize(event);
    const result=await dialog.showSaveDialog(window,{defaultPath:'Codex-deployment.zip',filters:[{name:t('Deployment ZIP',payload?.language),extensions:['zip']}]});
    if(result.canceled)return null;
    const bundle=await worker('export-deployment',payload);
    fs.copyFileSync(bundle.path,result.filePath);
    return {message:t('Deployment ZIP exported: {path}',payload?.language).replace('{path}',result.filePath)};
  });
  ipcMain.handle('bridge:copy-deployment',async(event,payload)=>{
    authorize(event);const bundle=await worker('deployment',payload);
    const english=normalize(payload?.language)!=='ko-KR',selected=payload?.language;
    const manual=bundle.accessMode==='server';
    const intro=t(manual?'Manual setup reference. Review the configuration; administrative commands must be run by the user.':'Deploy Codex Mobile Bridge using the configuration below. Check existing services first; do not overwrite existing sites.',selected);
    const text=intro+'\n\n'+Object.entries(bundle.files).filter(([name])=>name!==(english?'배포 지침.md':'DEPLOYMENT_EN.md')).map(([name,content])=>'--- '+name+' ---\n'+content).join('\n');
    clipboard.writeText(text);return {message:t(manual?'Manual setup reference copied. Administrative steps must be performed by the user.':'Deployment instructions and configuration copied. Paste them into your server or NAS Agent.',selected)};
  });
  ipcMain.handle('bridge:choose',async(event,kind)=>{
    authorize(event);
    if(!['folder','file','data','ssh-key'].includes(kind))throw Error('알 수 없는 경로 유형');
    const result=await dialog.showOpenDialog(window,kind==='ssh-key'?{defaultPath:path.join(app.getPath('home'),'.ssh'),properties:['openFile','showHiddenFiles']}:{properties:[kind==='file'?'openFile':'openDirectory']});
    if(result.canceled)return null;
    const selected=result.filePaths[0];
    if(kind==='data'){
      if(workerWrites)throw Error('현재 작업이 완료될 때까지 기다립니다.');
      if(updater.busy)throw Error('앱이 업데이트 중입니다. 기다리세요.');
      if(installPending)throw Error('cloudflared를 설치하는 중입니다. 데이터 디렉터리를 변경하기 전에 기다리십시오.');
      if(setupPending)throw Error('서버 작업이 완료될 때까지 기다려 주세요.。');
      installStatus={};connectionSecrets={};
      const changed=selected!==dataDir;
      if(changed){officialRemote?.dispose();officialRemote=null;}
      publishLanguage(selected,language);dataDir=selected;fs.mkdirSync(app.getPath('userData'),{recursive:true});
      fs.writeFileSync(path.join(app.getPath('userData'),'bridge-location.json'),JSON.stringify({dataDir}),{mode:0o600});
      if(changed)restoreOfficialService();
    }
    return selected;
  });
  ipcMain.handle('bridge:open',async(event,target)=>{
    authorize(event);
    if(target==='releases')return shell.openExternal('https://github.com/sekai0716/codex-mobile-bridge-kr/releases');
    if(target==='project-home')return shell.openExternal('https://github.com/sekai0716/codex-mobile-bridge-kr');
    if(target==='project-issues')return shell.openExternal('https://github.com/sekai0716/codex-mobile-bridge-kr/issues');
    if(target==='project-pulls')return shell.openExternal('https://github.com/sekai0716/codex-mobile-bridge-kr/pulls');
    if(target==='credentials'){
      // 기존 데이터 디렉터리의 파일명은 표시 문구와 달리 그대로 읽을 수 있어야 한다.
      const candidates=['첫 로그인.txt','\u9996\u6b21\u767b\u5f55.txt'].map(name=>path.join(dataDir,name));
      const initial=candidates.find(file=>{try{return fs.statSync(file).isFile();}catch{return false;}});
      return shell.openPath(initial||candidates[0]);
    }
    if(target==='data')return shell.openPath(dataDir);
    if(target==='tailscale-help'||target==='setup-tailscale')return shell.openExternal('https://tailscale.com/docs/how-to/quickstart');
    if(target==='cloudflare-dashboard')return shell.openExternal('https://one.dash.cloudflare.com/');
    // 업스트림 안내서는 한국어가 없어 지원되는 영문판을 연다.
    if(['setup-lan','setup-quick','setup-cloudflare','setup-server','setup-nas','setup-external'].includes(target))return shell.openExternal('https://try2love.github.io/codex-mobile-bridge/setup.html?lang=en#'+target.slice(6));
    if(target==='cloudflare-domain-help')return shell.openExternal('https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/');
    if(target==='server-https-help')return shell.openExternal('https://caddyserver.com/docs/running');
    if(target==='server-ssh-help')return shell.openExternal('https://man.openbsd.org/sshd_config#AllowTcpForwarding');
    if(target==='cloudflare-help')return shell.openExternal('https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/');
    if(target==='ntfy-help')return shell.openExternal('https://docs.ntfy.sh/subscribe/phone/');
    if(target==='bark-help')return shell.openExternal('https://bark.day.app/#/tutorial');
    if(target==='pushplus-home')return shell.openExternal('https://www.pushplus.plus/uc-profile.html');
    if(target==='pushplus-verify')return shell.openExternal('https://www.pushplus.plus/center/real-auth?source=push');
    if(target==='pushplus-limits')return shell.openExternal('https://www.pushplus.plus/doc/guide/use.html');
    const snapshot=await worker('snapshot');
    if(target==='harness'){
      const state=await worker('harness',{action:'status'});
      if(!state.running||!snapshot.urls.length)throw Error('게이트웨이 및 Harness를 먼저 시작하십시오.');
      return shell.openExternal(new URL('/harness/',snapshot.urls[0]).href);
    }
    if(!snapshot.urls.includes(target)||!/^https?:\/\//.test(target))throw Error('사용할 수 없는 주소입니다');
    await shell.openExternal(target);
  });
  ipcMain.handle('bridge:copy',async(event,target)=>{
    authorize(event);const snapshot=await worker('snapshot');
    const localPort=typeof target==='string'?/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(target):null;
    const localTarget=localPort&&Number(localPort[1])<=65535;
    if(!snapshot.urls.includes(target)&&!localTarget)throw Error('사용할 수 없는 주소입니다');
    clipboard.writeText(target);
  });
}
async function acknowledgeUpdate(){
  if(!updateManaged())return;
  try{
    if(process.platform==='darwin')await restoreMacUpdate({handoff,env:process.env,pid:process.pid,worker,stillManaged:updateManaged});
    await worker('snapshot');
    if(updateManaged()&&handoff.dataDir===dataDir)
      fs.writeFileSync(path.join(handoff.transaction,'ack.json'),JSON.stringify({token:handoff.token,version:app.getVersion(),dataDir}),{mode:0o600,flag:'wx'});
  }catch{} // Missing acknowledgement makes the independent helper restore the old app.
}
function createWindow(hidden=false){
  window=new BrowserWindow({show:!hidden,width:1100,height:850,minWidth:820,minHeight:640,title:t('Codex 모바일 Bridge'),icon:path.join(__dirname,'assets/icon.png'),backgroundColor:'#f6f7f9',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  // The native title is owned by the main process, including locale changes.
  window.on('page-title-updated',event=>event.preventDefault());
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.once('did-finish-load',acknowledgeUpdate);
  window.loadFile(path.join(__dirname,'index.html'));
  window.on('close',event=>{if(tray&&!quitting){event.preventDefault();window.hide();}});
  window.on('closed',()=>{window=null;});
  return window;
}
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',(_event,argv)=>{if(!loginStartup.hidden(argv))showWindow();});
  app.whenReady().then(async()=>{
    language=normalize(app.getLocale());
    try{language=normalize(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'language.json'),'utf8')).language);}catch{}
    dataDir=loadDataDir();publishLanguage(dataDir,language);
    setupUpdater();register();
    if(process.platform==='win32')app.setAppUserModelId('io.github.try2love.codexmobilebridge');
    if(['win32','darwin'].includes(process.platform)){
      const icon=process.platform==='darwin'?nativeImage.createFromPath(path.join(__dirname,'assets/trayTemplate.png')):path.join(__dirname,'assets/icon.ico');
      if(process.platform==='darwin')icon.setTemplateImage(true);
      tray=createTray({Tray,Menu,icon,show:showWindow,worker,t,
        open:url=>shell.openExternal(url),copy:url=>clipboard.writeText(url),quit:()=>app.quit(),
        onError:error=>{showWindow();dialog.showErrorBox(t('게이트웨이 작업 실패'),t(error.message));}});
    }
    createWindow(!!tray&&loginStartup.hidden(process.argv,true));
    restoreOfficialService();
  });
  app.on('before-quit',releaseTray);
  app.on('activate',showWindow);
  // Closing the controller leaves the gateway running for the phone.
  app.on('window-all-closed',()=>app.quit());
}
