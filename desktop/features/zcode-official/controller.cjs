'use strict';
const fs=require('node:fs'),path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {ORIGIN,parseLink}=require('./link.cjs');
const {serveLocal}=require('../../shared/local-service.cjs');
const ACTIONS=new Set(['application','projects','target','account','quota','lifecycle','attach','detach','list','create','detail','history','receipt','tasks','stop-task','catalog','send','stop','respond','settings','access','work-mode','goal','compact','fork','edit-message','rename']);
const failure=message=>Object.assign(Error(message),{publicMessage:message});
class OfficialRemote {
  constructor({electron,profile,rendererPath,localServiceWorker}){
    this.electron=electron;this.profile=profile;this.rendererPath=rendererPath;this.localServiceWorker=localServiceWorker;this.serviceAvailable=false;
    this.authFile=path.join(profile,'zcode-official-auth.enc');this.settingsFile=path.join(profile,'zcode-official.json');
    this.link='';this.reason='다음으로 로그인하세요. ZCode 기존 App 같은 공식 계정。';
    this.generation=0;this.authGeneration=0;this.runtime=null;this.loginWindow=null;this.auth=null;
    this.secureStorageAvailable=null;this.storageCheck=null;this.restorePending=null;this.storageTimeoutMs=12000;this.disposed=false;
  }
  config(){try{return JSON.parse(fs.readFileSync(path.join(this.profile,'desktop-sessions/settings.json'),'utf8'));}catch{return {};}}
  localLink(value){
    const parsed=parseLink(value),config=this.config();
    const home=config.discovered?.zcode?.dataDirectory||config.zcodePrototype?.dataDirectory||path.join(os.homedir(),'.zcode/v2');
    let mid;try{mid=JSON.parse(fs.readFileSync(path.join(home,'telemetry-state.json'),'utf8')).deviceMid;}catch{}
    if(!mid||mid!==parsed.mid)throw failure('이 실험은 이 컴퓨터에만 연결됩니다. ZCode，원본을 이용해주세요 App 공식 원격 제어 링크。');
    return parsed;
  }
  targetLink(){return this.link||this.auth?.link||'';}
  status(){const config=this.config(),available=this.serviceAvailable&&this.stopServer?.alive?.()!==false;return {configured:!!this.auth&&!!this.targetLink(),connected:available&&!!this.runtime,owner:available&&this.runtime?this.owner:null,available,secureStorageAvailable:this.secureStorageAvailable,
    secureStoragePending:!!this.storageCheck,restoring:!!this.restorePending,loginDeferred:this.loginDeferred===true,loginSaved:fs.existsSync(this.authFile),
    accountName:this.auth?.name||'',provider:this.auth?.provider||'',reason:this.reason,
    link:this.targetLink(),selected:config.zcodeConnectionMode==='official-remote'||!config.zcodeConnectionMode&&config.zcodeOfficialRemote===true};}
  storageBackendAllowed(){return process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(this.electron.safeStorage.getSelectedStorageBackend?.());}
  waitStorage(task){let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('시스템 보안 저장소가 준비되지 않았습니다. 시스템 키링을 잠금 해제하고 다시 시도하세요.')),this.storageTimeoutMs);})]).finally(()=>clearTimeout(timer));}
  async secure(){
    const storage=this.electron.safeStorage;
    if(!this.storageBackendAllowed()||typeof storage.isAsyncEncryptionAvailable!=='function'||typeof storage.encryptStringAsync!=='function'||typeof storage.decryptStringAsync!=='function'){
      this.secureStorageAvailable=false;return false;
    }
    if(!this.storageCheck){
      const task=Promise.resolve().then(()=>storage.isAsyncEncryptionAvailable()).then(value=>{
        const available=value===true&&this.storageBackendAllowed();
        if(!this.disposed)this.secureStorageAvailable=available;
        return available;
      },()=>{if(!this.disposed)this.secureStorageAvailable=false;return false;});
      this.storageCheck=task;task.finally(()=>{if(this.storageCheck===task)this.storageCheck=null;});
    }
    try{return await this.waitStorage(this.storageCheck);}
    catch(error){this.secureStorageAvailable=false;throw error;}
  }
  encrypted(data){
    if(!Buffer.isBuffer(data)||!data.length||process.platform==='linux'&&data.subarray(0,3).toString()!=='v11'){this.secureStorageAvailable=false;throw failure('시스템 보안 저장소를 사용할 수 없습니다. 아직 공식 로그인을 저장할 수 없습니다.');}
    return data;
  }
  fileIdentity(file){try{const stat=fs.statSync(file);return [stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');}catch(error){if(error.code==='ENOENT')return null;throw error;}}
  authCurrent(generation,authIdentity,settingsIdentity){try{return !this.disposed&&this.authGeneration===generation&&this.fileIdentity(this.authFile)===authIdentity&&this.fileIdentity(this.settingsFile)===settingsIdentity;}catch{return false;}}
  restore(){
    if(this.disposed)return Promise.resolve(false);
    if(this.restorePending)return this.restorePending;
    try{if(fs.existsSync(this.settingsFile))this.link=this.localLink(JSON.parse(fs.readFileSync(this.settingsFile,'utf8')).link).url;}catch{this.reason='공식 원격제어 링크를 읽을 수 없습니다. 로컬 링크를 다시 저장해 주세요.。';}
    let authIdentity,settingsIdentity;const generation=this.authGeneration;
    try{authIdentity=this.fileIdentity(this.authFile);settingsIdentity=this.fileIdentity(this.settingsFile);}
    catch{this.reason='공식 로그인 정보를 읽을 수 없습니다. 다시 로그인해 주세요.。';return Promise.resolve(false);}
    if(authIdentity===null)return Promise.resolve(false);
    const task=(async()=>{
      try{
        this.reason='저장된 공식 로그인을 복원하는 중…';
        const encrypted=this.encrypted(fs.readFileSync(this.authFile));
        if(!await this.secure())throw failure('시스템 보안 저장소를 사용할 수 없습니다. 저장된 공식 로그인은 아직 복원할 수 없습니다.');
        if(!this.authCurrent(generation,authIdentity,settingsIdentity))return false;
        const decrypted=await this.waitStorage(this.electron.safeStorage.decryptStringAsync(encrypted));
        if(!this.authCurrent(generation,authIdentity,settingsIdentity))return false;
        const auth=JSON.parse(decrypted.result);
        if(!auth||typeof auth.jwt!=='string'||!auth.jwt||auth.jwt.length>16384||/\s/.test(auth.jwt)||!['zai','bigmodel'].includes(auth.provider))throw Error('Invalid saved login');
        const link=this.localLink(auth.link).url;
        if(!this.link)this.writeLink(link);
        this.auth=auth;this.reason='공식 로그인 정보가 저장되어 공식리모콘에 접속이 가능합니다.。';return true;
      }catch(error){if(this.authCurrent(generation,authIdentity,settingsIdentity)){this.auth=null;this.reason=error.publicMessage||'공식 로그인 정보를 읽을 수 없습니다. 다시 로그인해 주세요.。';}return false;}
    })();
    this.restorePending=task;const settled=()=>{if(this.restorePending===task)this.restorePending=null;};task.then(settled,settled);return task;
  }
  save(link){
    const parsed=this.localLink(link);
    if((this.runtime||this.connecting||this.loginWindow)&&parsed.url!==this.targetLink())throw failure('연결 구성을 수정하기 전에 공식 리모컨을 연결 해제하고 로그인 창을 닫으십시오.。');
    if(parsed.url!==this.targetLink())this.authGeneration++;
    this.writeLink(parsed.url);return this.status();
  }
  writeLink(link){
    fs.writeFileSync(this.settingsFile+'.tmp',JSON.stringify({link}),{mode:0o600});
    fs.renameSync(this.settingsFile+'.tmp',this.settingsFile);this.link=link;
  }
  async start({standby=false}={}){
    if(this.disposed)return false;
    if(!this.serviceAvailable||this.stopServer?.alive?.()===false){
      if(!this.startPending)this.startPending=this.startServer().finally(()=>{this.startPending=null;});
      if(!await this.startPending)return false;
    }
    const config=this.config();
    if(!standby||config.enabled?.zcode&&(config.zcodeConnectionMode==='official-remote'||!config.zcodeConnectionMode&&config.zcodeOfficialRemote)){
      this.restoreOnDemand();
    }
    return true;
  }
  restoreOnDemand(){
    if(this.loginDeferred){this.loginDeferred=false;void this.restore();}
  }
  async startServer(){
    this.stopServer?.();this.serviceAvailable=false;
    try{const stop=await serveLocal(this.profile,'zcode-official',request=>this.handle(request),{worker:this.localServiceWorker});if(this.disposed){stop();return false;}this.stopServer=stop;this.serviceAvailable=true;this.loginDeferred=true;return true;}
    catch{this.reason='로컬 제어 인터페이스를 일시적으로 사용할 수 없습니다. 다시 시도하십시오. 다른 게이트웨이 기능은 영향을 받지 않습니다.。';return false;}
  }
  async disconnect(){
    this.generation++;this.connectAbort?.abort();this.runtime?.dispose();this.runtime=null;this.owner=null;this.environment=null;
    this.reason='공식 리모컨 연결이 끊어졌다가 다시 연결 가능。';return this.status();
  }
  async connect({waitForDevice=false}={}){
    if(this.runtime)return this.owner;
    if(this.connecting)return this.connecting;
    const expectedGeneration=this.generation,expectedAuthGeneration=this.authGeneration;
    this.restoreOnDemand();
    if(this.restorePending)await this.restorePending;
    if(expectedGeneration!==this.generation||expectedAuthGeneration!==this.authGeneration)throw failure('이 연결이 취소되었습니다.');
    if(this.disposed)throw failure('공식 원격접속 서비스가 종료되었습니다.');
    if(this.runtime)return this.owner;
    if(this.connecting)return this.connecting;
    if(!this.auth)throw failure('먼저 게이트웨이로 이동해주세요. ZCode 관리페이지 로그인 공식리모컨。');
    const link=this.localLink(this.targetLink()).url;
    const generation=this.generation;
    const connectAbort=this.connectAbort=new AbortController();
    const task=(async()=>{
      this.reason='연결 중 ZCode 공식 리모콘…';
      const {createRelay}=await import('./runtime.mjs');
      let runtime;
      try{
        runtime=await createRelay({jwt:this.auth.jwt,link,waitForDevice,signal:connectAbort.signal,onState:state=>{
          if(this.runtime!==runtime)return;
          if(state.connected===false){this.reason=state.reason||'공식리모컨 연결이 끊어졌습니다. 다시 연결해 주세요.。';this.runtime=null;this.owner=null;this.environment=null;}
        }});
        if(generation!==this.generation){runtime.dispose();throw failure('이 연결이 취소되었습니다.');}
        this.runtime=runtime;this.owner={epoch:randomUUID(),device:parseLink(link).sid};
        this.environment={services:runtime.services,contexts:[],state:runtime.state,storage:runtime.storage,
          acquireWorkspace:runtime.acquireWorkspace,clientMode:'web-remote-replayable'};
        this.reason='공식 리모콘에 연결됨';return this.owner;
      }catch(error){runtime?.dispose();if(generation!==this.generation)throw failure('이 연결이 취소되었습니다.');this.reason=({
        'auth-required':'공식 인증이 만료되었습니다. 데스크톱 게이트웨이에 다시 로그인하세요.',
        'device-offline':'ZCode 공식 리모컨이 아직 온라인 상태가 아닙니다. 원본 앱에서 웹 원격 제어가 활성화되어 있는지 확인하세요.',
        'device-not-owned':'공식계정과 원격링크가 일치하지 않습니다. 데스크탑 게이트웨이의 설정을 확인하십시오.',
        'terminal-replaced':'공식 리모콘에 연결된 또 다른 터미널입니다. 다시 연결하기 전에 확인하세요.',
        'connection-timeout':'ZCode 공식 리모컨을 기다리는 동안 시간이 초과되었습니다. 나중에 다시 연결해 보세요.'
      })[error.code]||'공식 리모컨 연결에 실패했습니다. 원본을 확인해주세요. App 원격 제어 스위치, 계정 및 네트워크。';throw failure(this.reason);}
    })();
    this.connecting=task;
    try{return await task;}finally{if(this.connecting===task){this.connecting=null;this.connectAbort=null;}}
  }
  async handle(message){
    if(message?.command==='status')return this.status();
    if(message?.command==='connect')return this.connect({waitForDevice:message.waitForDevice===true});
    if(message?.command==='disconnect')return this.disconnect();
    if(message?.command!=='call'||!ACTIONS.has(message.request?.action))throw failure('지원되지 않는 공식 원격 제어 작업。');
    const request=message.request;
    if(!this.runtime||JSON.stringify(request.expectedProcess)!==JSON.stringify(this.owner))throw failure('공식 원격제어 연결이 변경되었습니다. 세션에 다시 접속해주세요.。');
    if(!Number.isFinite(request.expiresAt)||request.expiresAt<=Date.now()||request.expiresAt>Date.now()+180000)throw failure('이 요청은 만료되었습니다. 원래 작업 결과를 확인하세요.。');
    const {nativeRequest}=await import(pathToFileURL(this.rendererPath));
    let timer;
    try{return await Promise.race([nativeRequest(request,this.environment),new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('공식 원격 제어 수신 시간이 초과되었습니다. 원래 작업 결과를 확인하세요. 자동으로 재전송되지 않습니다.。')),request.expiresAt-Date.now());})]);}
    finally{clearTimeout(timer);}
  }
  async login(link){
    if(this.disposed)throw failure('공식 원격접속 서비스가 종료되었습니다.');
    const parsed=this.localLink(link);
    const loginGeneration=this.loginWindow?this.authGeneration:++this.authGeneration;
    if(!await this.secure())throw failure('시스템 보안 저장소를 사용할 수 없습니다. 아직 공식 로그인을 저장할 수 없습니다.');
    if(this.disposed||loginGeneration!==this.authGeneration)throw failure('이 로그인이 취소되었습니다.');
    if(this.loginWindow){this.loginWindow.show();this.loginWindow.focus();return this.status();}
    if(!this.auth&&fs.existsSync(this.authFile)){
      if(this.restorePending)await this.restorePending;
      if(this.disposed||loginGeneration!==this.authGeneration)throw failure('이 로그인이 취소되었습니다.');
      await this.restore();
      if(this.disposed||loginGeneration!==this.authGeneration)throw failure('이 로그인이 취소되었습니다.');
      if(this.auth)return this.status();
      if(!await this.secure())throw failure('시스템 보안 저장소를 사용할 수 없습니다. 아직 공식 로그인을 저장할 수 없습니다.');
      if(this.disposed||loginGeneration!==this.authGeneration)throw failure('이 로그인이 취소되었습니다.');
    }
    await this.disconnect();
    this.save(parsed.url);
    const {BrowserWindow,session}=this.electron;
    const browserSession=session.fromPartition('zcode-official-login-'+randomUUID());
    browserSession.setPermissionRequestHandler((_w,_p,done)=>done(false));browserSession.setPermissionCheckHandler(()=>false);
    const win=new BrowserWindow({width:1000,height:760,title:'ZCode 공식 원격제어 로그인',webPreferences:{session:browserSession,nodeIntegration:false,contextIsolation:true,sandbox:true}});
    this.loginWindow=win;
    const generation=this.authGeneration,authIdentity=this.fileIdentity(this.authFile),settingsIdentity=this.fileIdentity(this.settingsFile);
    const allowed=new Set([ORIGIN,'https://chat.z.ai','https://bigmodel.cn','https://open.bigmodel.cn','https://accounts.google.com','https://github.com']);
    const allow=url=>{try{return allowed.has(new URL(url).origin);}catch{return false;}};
    win.webContents.on('will-navigate',(event,url)=>{if(!allow(url))event.preventDefault();});
    win.webContents.on('will-redirect',(event,url)=>{if(!allow(url))event.preventDefault();});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    let capturing=false,encrypting=null;
    const capture=async()=>{
      if(capturing||encrypting||win.isDestroyed())return;
      let url;try{url=new URL(win.webContents.getURL());}catch{return;}
      if(url.origin!==ORIGIN||url.pathname!=='/remote/v4')return;
      capturing=true;
      try{
        const data=await win.webContents.executeJavaScript(`(()=>{const provider=localStorage.getItem('oauth:active_provider');const jwt=localStorage.getItem('zcodejwttoken');if(!jwt||!['zai','bigmodel'].includes(provider))return null;const user=JSON.parse(localStorage.getItem('oauth:'+provider+':user_info')||'{}');return {jwt,provider,name:user.name||user.displayName||''};})()`);
        if(!data||this.loginWindow!==win||win.isDestroyed()||!this.authCurrent(generation,authIdentity,settingsIdentity))return;
        if(typeof data.jwt!=='string'||data.jwt.length>16384||/\s/.test(data.jwt))throw Error('Invalid token');
        // Close the official web terminal before the gateway claims its own terminal.
        const auth={...data,link:parsed.url};
        const task=Promise.resolve().then(()=>this.electron.safeStorage.encryptStringAsync(JSON.stringify(auth)));
        encrypting=task;const settled=()=>{if(encrypting===task)encrypting=null;};task.then(settled,settled);
        const encrypted=this.encrypted(await this.waitStorage(task));
        if(this.loginWindow!==win||win.isDestroyed()||!this.authCurrent(generation,authIdentity,settingsIdentity)||this.targetLink()!==parsed.url)return;
        fs.writeFileSync(this.authFile+'.tmp',encrypted,{mode:0o600});fs.renameSync(this.authFile+'.tmp',this.authFile);
        this.auth=auth;this.reason='공식 로그인이 저장되었습니다. 클릭“공식 리모컨에 연결”계속하다。';
        clearInterval(timer);this.loginWindow=null;win.destroy();
      }catch(error){if(this.loginWindow===win&&!win.isDestroyed()&&this.authCurrent(generation,authIdentity,settingsIdentity))this.reason=error.publicMessage||'공식 로그인이 저장되지 않았습니다. 계정을 확인하거나 다시 로그인하세요.。';}
      finally{capturing=false;}
    };
    const timer=setInterval(capture,1200);timer.unref();
    win.on('closed',()=>{clearInterval(timer);if(this.loginWindow===win){this.loginWindow=null;this.authGeneration++;}});
    win.webContents.on('did-finish-load',capture);
    await win.loadURL(parsed.url);return this.status();
  }
  async forget(){this.authGeneration++;this.loginWindow?.destroy();this.loginWindow=null;await this.disconnect();this.auth=null;try{fs.unlinkSync(this.authFile);}catch(error){if(error.code!=='ENOENT')throw error;}return this.status();}
  dispose(){this.disposed=true;this.authGeneration++;this.serviceAvailable=false;this.disconnect();this.loginWindow?.destroy();this.stopServer?.();}
}
module.exports={OfficialRemote};
