'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,clipboard,Tray,Menu,net,nativeImage,nativeTheme}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {runWorker,workerFor,createSnapshotWorker,createManagementWorker}=require('./shared/controller.cjs');
const {pairingImage}=require('./features/connections/qr.cjs');
const {createTray}=require('./shell/tray.cjs');
const {createIconTheme}=require('./shell/icons.cjs');
const {normalize,translate}=require('./shared/i18n.js');
const {publishLanguage}=require('./shared/gateway-language.cjs');
const cloudflared=require('./features/connections/cloudflared.cjs');
const {Updater,allowedMirrorUrl,allowedCatalogueUrl,activeUpdateHandoff}=require('./features/updates/updater.cjs');
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
const iconTheme=createIconTheme({app,nativeTheme,nativeImage,platform:process.platform,assetsDir:path.join(__dirname,'assets'),getWindow:()=>window,getTray:()=>tray});
let installPending,installStatus={},updater,workerWrites=0,officialRemote,updateConfirmation=false,updateStarting=false,cacheDeleting=false,startupCleanup=Promise.resolve();
const snapshotWorker=createSnapshotWorker();
const managementWorker=createManagementWorker();
let connectionSecrets={},setupPending=false;
const entry=pathToFileURL(path.join(__dirname,'index.html')).href;
function releaseTray(){iconTheme.dispose();officialRemote?.dispose();snapshotWorker.close();managementWorker.close();quitting=true;tray?.dispose();tray=null;}
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
function readSavedDataDir(file){
  try{
    const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
    const candidate=parsed?.dataDir;
    // Whitespace may be part of an existing directory name; validate without rewriting it.
    if(typeof candidate==='string'&&candidate.trim())return candidate;
    throw Error('缺少有效的 dataDir 字段');
  }catch(error){
    throw Error(`无法恢复已保存的数据目录，请检查或恢复 ${file}：${error.message}`);
  }
}
function saveDataDir(targetDir){
  const userDir=app.getPath('userData');
  fs.mkdirSync(userDir,{recursive:true});
  const file=path.join(userDir,'bridge-location.json');
  const payload=JSON.stringify({dataDir:targetDir});
  // 先写同目录临时文件再原子重命名，避免写入中途进程退出留下损坏的 JSON
  const temporary=`${file}.${process.pid||'tmp'}.tmp`;
  try{
    fs.writeFileSync(temporary,payload,{mode:0o600});
    fs.renameSync(temporary,file);
  }catch(error){
    try{fs.unlinkSync?.(temporary);}catch{}
    throw error;
  }
}
function loadDataDir(){
  handoff=currentHandoff();
  if(handoff)return handoff.dataDir;
  // Rollback explicitly launches the previous GUI without a transaction/token.
  if(!process.env.CMB_UPDATE_TRANSACTION&&!process.env.CMB_UPDATE_TOKEN&&process.env.CMB_UPDATE_DATA_DIR)
    return path.resolve(process.env.CMB_UPDATE_DATA_DIR);
  if(process.env.CMB_DATA_DIR)return path.resolve(process.env.CMB_DATA_DIR);
  const saved=path.join(app.getPath('userData'),'bridge-location.json');
  if(fs.existsSync(saved)){
    const configured=readSavedDataDir(saved);
    if(configured)return configured;
  }
  const local=path.join(process.resourcesPath,'bridge-data-dir.txt');
  if(app.isPackaged&&fs.existsSync(local)){
    try{
      const configured=fs.readFileSync(local,'utf8').trim();
      if(configured)return configured;
    }catch(error){
      if(error?.code!=='ENOENT'&&typeof console!=='undefined')console?.warn?.('无法读取随包数据目录配置，将回退默认目录：',error);
    }
  }
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
  if(process.platform==='linux'||candidate.manualInstall){
    await worker('update-backup',{target:updateTarget(),version:candidate.version,transition:candidate.transition,...(candidate.manualInstall?{manualInstall:true}:{})});
    if(candidate.manualRelease){await shell.openExternal(candidate.releasePage);return {state:'manual-release'};}
    // Preserve the configured data location before an external installer replaces
    // the bundle; opening an installer is not proof that installation completed.
    saveDataDir(dataDir);
    if(/\.(AppImage|zip)$/.test(candidate.asset.name)){
      shell.showItemInFolder(candidate.archive);return {state:'downloaded'};
    }
    const error=await shell.openPath(candidate.archive);
    if(error){shell.showItemInFolder(candidate.archive);return {state:'downloaded'};}
    return {state:'installer-handoff'};
  }
  snapshotWorker.close();managementWorker.close();
  const target=updateTarget();
  const token=randomUUID();
  const prepared=await worker('update-prepare',{archive:candidate.archive,sha256:candidate.asset.sha256,version:candidate.version,
    platform:process.platform,arch:process.arch,target,parentPid:process.pid,token,transition:candidate.transition});
  // Preserve selected data location even when an old local bundle carried it inside Resources.
  saveDataDir(dataDir);
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
  const updateDirectory=path.join(app.getPath('userData'),'updates');
  const updateTools=require('./features/updates/updater.cjs');
  startupCleanup.catch(()=>{});
  // Remove incomplete downloads left by a crash. Complete verified packages
  // remain available until the user explicitly deletes them.
  updater=new Updater({current:app.getVersion(),key:fs.readFileSync(path.join(__dirname,'features/updates/update-public-key.pem')),
    fetch:cloudflared.electronFetch(net,allowedMirrorUrl),directory:updateDirectory,
    catalogueFetch:cloudflared.electronFetch(net,allowedCatalogueUrl),
    skipFile:path.join(app.getPath('userData'),'skipped-update.json'),format:process.platform==='linux'?(process.env.APPIMAGE?'AppImage':'deb'):'zip',
    supported:app.isPackaged&&require(path.join(root,'package.json')).name==='codex-mobile-bridge-desktop'&&['darwin','win32','linux'].includes(process.platform),
    preflight:process.platform==='win32'?async()=>{
      await startupCleanup;
      await updateTools.cleanDownloadStaging(updateDirectory);
      await worker('update-preflight',{target:updateTarget()});
    }:undefined,install:installUpdate});
  startupCleanup=updateTools.cleanDownloadStaging(updateDirectory);
  startupCleanup.catch(()=>{});
  setTimeout(()=>updater.check(),5000).unref();
  setInterval(()=>updater.check(),6*60*60*1000).unref();
}
function showWindow(){
  if(!window)createWindow();
  if(window.isMinimized())window.restore();
  window.show();window.focus();
}
function register(){
  ipcMain.handle('bridge:check-update',(event,payload)=>{authorize(event);return updater.check({manual:true,channel:payload?.channel});});
  ipcMain.handle('bridge:skip-update',event=>{authorize(event);return updater.skip();});
  ipcMain.handle('bridge:update-versions',async(event,payload)=>{
    authorize(event);
    if(payload?.action==='list')return updater.listVersions();
    if(payload?.action!=='select')throw Error('更新版本请求无效。');
    if(updater.busy||updateStarting||updateConfirmation||cacheDeleting||updateManaged())throw Error('请等待当前操作完成后再更新。');
    return updater.selectVersion(payload.id);
  });
  ipcMain.handle('bridge:download-update',async(event,payload)=>{
    authorize(event);
    if(updater.busy||updateStarting||updateConfirmation||cacheDeleting||updateManaged())throw Error('请等待当前操作完成后再更新。');
    const candidateId=payload?.candidateId;
    if(!candidateId||updater.status().candidateId!==candidateId)throw Error('请先检查更新。');
    updateStarting=true;
    try{
      await startupCleanup;
      return await updater.download({candidateId});
    }finally{updateStarting=false;}
  });
  ipcMain.handle('bridge:update-cache',async(event,payload)=>{
    authorize(event);
    const inUse=()=>updater.busy||updateStarting||updateConfirmation||updateManaged();
    const listing=()=>updater.cacheStatus({inUse:inUse()||cacheDeleting});
    if(payload?.action==='list')return listing();
    if(payload?.action!=='delete')throw Error('更新缓存请求无效。');
    if(inUse()||cacheDeleting)throw Error('请等待应用更新完成后再删除缓存。');
    cacheDeleting=true;
    try{
      await startupCleanup;
      if(inUse())throw Error('请等待应用更新完成后再删除缓存。');
      const selection=updater.cacheSelection(payload.ids),size=selection.files.reduce((total,file)=>total+file.entry.size,0);
      const answer=await dialog.showMessageBox(window,{type:'warning',title:t('更新下载缓存'),message:t('确认删除所选缓存？'),
        detail:t('将删除 {count} 个更新包，释放 {size}。').replace('{count}',String(selection.files.length)).replace('{size}',`${(size/1024/1024).toFixed(2)} MB`),
        buttons:[t('取消'),t('删除所选缓存')],defaultId:0,cancelId:0,noLink:true});
      if(answer.response!==1)return {...updater.cacheStatus({inUse:inUse()}),cancelled:true};
      if(inUse())throw Error('请等待应用更新完成后再删除缓存。');
      const deleted=updater.deleteCache(selection);
      return {...updater.cacheStatus(),deleted};
    }finally{cacheDeleting=false;}
  });
  ipcMain.handle('bridge:install-update',async(event,payload)=>{
    authorize(event);
    const blocked=()=>installPending||workerWrites||setupPending||cacheDeleting||updateManaged();
    if(blocked()||updateConfirmation||updateStarting)throw Error('请等待当前操作完成后再更新。');
    const value=updater.status(),candidateId=payload?.candidateId;
    if(!candidateId||value.candidateId!==candidateId)throw Error('请先检查更新。');
    updateStarting=true;
    try{
      if(value.requiresConfirmation){
        updateConfirmation=true;
        const choosing=value.intent==='switch-version',manual=process.platform==='linux'||value.manualInstall;
        const answer=await dialog.showMessageBox(window,{type:'warning',title:t('应用更新'),
          message:t(choosing?'确认切换到所选版本？':value.intent==='return-stable'?'确认返回稳定版？':'确认安装预览版？'),
          detail:`${value.current} → ${value.version}${value.assetName?'\n'+value.assetName:''}\n\n${t(choosing?(manual?'安装包校验后会备份网关配置，并交由系统安装器或你手动完成替换。旧版可能无法识别较新的配置功能；安装完成前，当前版本继续运行。':'切换版本会备份网关配置、替换当前应用并重启，继续使用现有资料。预览版可能存在未解决的问题。'):manual?(value.manualRelease?'此版本缺少签名的 Linux 更新包信息，将打开官方发布页供你手动下载。':'下载通过签名与摘要校验后，由系统安装器或你手动完成替换。安装完成前，当前版本继续运行。'):value.intent==='return-stable'?'返回稳定版会替换当前应用并重启。已保存的配置和登录会保留。':'预览版可能存在未解决的问题。安装会替换当前应用并重启。')}`,
          buttons:[t('取消'),t(choosing?(manual?'下载并打开安装包':'切换版本并重启'):manual?(value.manualRelease?'打开官方发布页':'下载所选版本'):value.intent==='return-stable'?'返回稳定版并重启':'安装预览版并重启')],defaultId:0,cancelId:0,noLink:true});
        if(answer.response!==1)return updater.status();
        if(blocked())throw Error('请等待当前操作完成后再更新。');
        await startupCleanup;
        if(blocked())throw Error('请等待当前操作完成后再更新。');
        return await updater.install({candidateId,confirmed:true});
      }
      await startupCleanup;
      if(blocked())throw Error('请等待当前操作完成后再更新。');
      return await updater.install({candidateId});
    }finally{updateConfirmation=false;updateStarting=false;}
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
      if(payload.action==='zcode-official-browser-login')return service.login(payload.link,{external:true});
      if(payload.action==='zcode-official-login-receipt')return service.completeLoginReceipt(payload.receipt);
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
    const english=normalize(payload?.language)!=='zh-CN',selected=payload?.language;
    const manual=bundle.accessMode==='server';
    const intro=t(manual?'Manual setup reference. Review the configuration; administrative commands must be run by the user.':'Deploy Codex Mobile Bridge using the configuration below. Check existing services first; do not overwrite existing sites.',selected);
    const text=intro+'\n\n'+Object.entries(bundle.files).filter(([name])=>name!==(english?'部署说明.md':'DEPLOYMENT_EN.md')).map(([name,content])=>'--- '+name+' ---\n'+content).join('\n');
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
      publishLanguage(selected,language);dataDir=selected;saveDataDir(dataDir);
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
    if(updateManaged()&&handoff.dataDir===dataDir){
      fs.writeFileSync(path.join(handoff.transaction,'ack.json'),JSON.stringify({token:handoff.token,version:app.getVersion(),dataDir}),{mode:0o600,flag:'wx'});
    }
  }catch{} // Missing acknowledgement makes the independent helper restore the old app.
}
function createWindow(hidden=false){
  window=new BrowserWindow({show:!hidden,width:1100,height:850,minWidth:820,minHeight:640,title:t('Codex 手机网关'),icon:iconTheme.windowIcon(),backgroundColor:'#f6f7f9',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
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
let startupReady=false;
if(!app.requestSingleInstanceLock())app.quit();
else{
  // 仅在启动初始化完成且未进入退出流程时显示窗口，防止未就绪或启动失败时拉起半残界面
  app.on('second-instance',(_event,argv)=>{if(startupReady&&!quitting&&!loginStartup.hidden(argv))showWindow();});
  // 单元测试替身只实现 app.whenReady().then(...) 而未提供 .catch()，因此必须在 async 回调内部 try/catch 兜底；
  // 一旦启动关键路径抛错，显式弹窗并清理退出，避免单实例锁被无窗口僵尸进程长期占用
  app.whenReady().then(async()=>{
    try{
      language=normalize(app.getLocale());
      try{language=normalize(JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'language.json'),'utf8')).language);}catch{}
      dataDir=loadDataDir();publishLanguage(dataDir,language);
      setupUpdater();register();
      if(process.platform==='win32')app.setAppUserModelId('io.github.try2love.codexmobilebridge');
      if(['win32','darwin'].includes(process.platform)){
        tray=createTray({Tray,Menu,icon:iconTheme.trayIcon(),show:showWindow,worker,t,
          open:url=>shell.openExternal(url),copy:url=>clipboard.writeText(url),quit:()=>app.quit(),
          onError:error=>{showWindow();dialog.showErrorBox(t('网关操作未完成'),t(error.message));}});
      }
      startupReady=true;
      createWindow(!!tray&&loginStartup.hidden(process.argv,true));
      iconTheme.start();
      restoreOfficialService();
    }catch(error){
      startupReady=false;
      if(typeof console!=='undefined')console?.error?.(error);
      try{dialog?.showErrorBox?.(t('网关操作未完成'),t(error?.message||String(error)));}catch{}
      releaseTray();
      app.quit?.();
    }
  });
  app.on('before-quit',releaseTray);
  app.on('activate',()=>{if(startupReady&&!quitting)showWindow();});
  // Closing the controller leaves the gateway running for the phone.
  app.on('window-all-closed',()=>app.quit());
}
