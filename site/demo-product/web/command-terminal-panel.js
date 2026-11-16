'use strict';

class CommandTerminalPanel {
  constructor(workbench, session, tab) {
    Object.assign(this, {workbench, session, tab}); this.disposed=false; this.cursor=0; this.output='';
    this.visibility=()=>{clearTimeout(this.timer);if(document.hidden)this.readController?.abort();else if(this.running){if(this.polling)this.resumeRead=true;else this.poll();}};
    document.addEventListener('visibilitychange',this.visibility);
    this.key='terminal:'+session.key;
    try { this.id=sessionStorage.getItem(this.key); } catch {}
    const n=(...args)=>workbench.node(...args), b=(...args)=>workbench.button(...args);
    const head=n('div','wb-terminal-head'); head.append(n('strong','',BridgeI18n.t("터미널")));
    this.stop=b(BridgeI18n.t("중지"),()=>this.cancel());this.stop.disabled=true;
    head.append(b(BridgeI18n.t("분명한"),()=>{this.output='';this.screen.textContent='';}),this.stop);
    this.location=n('p','wb-terminal-location',BridgeI18n.t("프로젝트 로드 중…"));
    this.status=n('p','wb-status');this.status.setAttribute('role','status');
    this.screen=n('pre','wb-terminal-output');this.screen.tabIndex=0;this.screen.setAttribute('aria-label',BridgeI18n.t('명령 출력'));
    this.form=n('form','wb-terminal-form');this.command=n('textarea');this.command.rows=1;this.command.placeholder=BridgeI18n.t('명령을 입력하세요…');this.command.setAttribute('aria-label',BridgeI18n.t('터미널 명령'));this.command.spellcheck=false;
    this.command.setAttribute('autocapitalize','off');this.command.setAttribute('autocorrect','off');
    this.prompt=n('span','wb-terminal-prompt','$');this.prompt.setAttribute('aria-hidden','true');
    this.run=n('button','',BridgeI18n.t('달리다 ↵'));this.run.type='submit';this.run.disabled=true;
    this.form.append(this.prompt,this.command,this.run);this.form.onsubmit=e=>{e.preventDefault();this.start();};
    this.command.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!BridgeHost.hasNativeLayout()&&!BridgeLayout.isCompactViewport(innerWidth)){e.preventDefault();this.form.requestSubmit();}};
    const help=n('details','wb-terminal-help');help.append(n('summary','',BridgeI18n.t("명령 터미널 · 도움말")),n('p','',BridgeI18n.t("각 명령은 현재 사용자의 권한으로 프로젝트 디렉터리에서 시작됩니다. 실행을 입력하십시오. Shift+Enter는 줄을 삽입합니다. 명령 모드에서는 대화형 프로그램이 지원되지 않습니다. 최대 실행 시간: 30분.")));
    tab.body.append(head,this.location,this.screen,this.form,this.status,help);
    this.load();
  }
  url(extra='') {return this.workbench.endpoint(this.session,'terminal')+extra;}
  async load() {
    try {
      const info=await this.workbench.request(this.url());if(this.disposed)return;
      this.location.textContent=(info.host==='local'?BridgeI18n.t('이 컴퓨터'):info.host)+' · '+info.cwd+' · '+info.shell;
      this.cwd=info.cwd;this.run.disabled=false;
      this.prompt.textContent=/cmd(?:\.exe)?$/i.test(info.shell)?'>':'$';
      if(this.id){this.running=true;this.run.disabled=true;await this.poll();}
    } catch(e){if(!this.disposed)this.status.textContent=e.message;}
  }
  remember(){try{if(this.id)sessionStorage.setItem(this.key,this.id);else sessionStorage.removeItem(this.key);}catch{}}
  async start() {
    const command=this.command.value.trim();if(!command||this.running||this.run.disabled)return;
    this.running=true;this.run.disabled=true;this.stop.disabled=true;this.id=uuid();this.remember();this.cursor=0;
    this.output='';this.commandText=this.prompt.textContent+' '+command+'\n';this.screen.textContent=this.commandText;this.status.textContent=BridgeI18n.t("시작 중…");
    try {
      const result=await this.workbench.request(this.url(),{action:'start',id:this.id,command});
      if(this.disposed)return;this.command.value='';this.apply(result);if(this.running)this.schedule();
    } catch(e){if(!this.disposed){this.status.textContent=e.message+BridgeI18n.t("· 상태 확인 중; 명령은 두 번 실행되지 않습니다.");this.schedule();}}
  }
  apply(result) {
    const follow=this.screen.scrollHeight-this.screen.clientHeight-this.screen.scrollTop<48;
    // Render output as text; strip terminal escape sequences, including OSC links.
    const text=result.output.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
    this.output=((result.reset?'':this.output)+text).slice(-262144);this.cursor=result.cursor;
    this.screen.textContent=(this.commandText||'')+this.output;if(follow)this.screen.scrollTop=this.screen.scrollHeight;
    this.running=result.running;this.run.disabled=this.running;this.stop.disabled=!this.running;
    this.status.textContent=(result.running?BridgeI18n.t("실행 중"):result.message||BridgeI18n.t("완료 · 종료 코드")+result.exitCode)+(result.truncated?BridgeI18n.t("· 최근 출력만"):'');
  }
  schedule(){clearTimeout(this.timer);if(!this.disposed&&!document.hidden&&!this.canceling)this.timer=setTimeout(()=>this.poll(),900);}
  async poll() {
    if(this.disposed||document.hidden||this.polling||!this.running||this.canceling)return;
    this.polling=true;clearTimeout(this.timer);const id=this.id,controller=this.readController=new AbortController();
    try {
      const result=await this.workbench.request(this.url('&id='+this.id+'&after='+this.cursor),undefined,controller.signal);
      if(this.disposed||controller.signal.aborted||this.id!==id)return;this.apply(result);
    } catch(e){
      if(this.disposed||controller.signal.aborted||this.id!==id)return;
      this.status.textContent=e.message;
      if(e.status===404){this.running=false;this.run.disabled=false;this.stop.disabled=true;this.id=null;this.remember();}
    } finally {
      this.polling=false;this.readController=null;
      const resume=this.resumeRead;this.resumeRead=false;
      if(resume&&!this.disposed&&!document.hidden&&!this.canceling)this.poll();else if(this.running)this.schedule();
    }
  }
  async cancel() {
    if(!this.id||this.canceling)return;this.canceling=true;this.stop.disabled=true;this.readController?.abort();clearTimeout(this.timer);
    try {const result=await this.workbench.request(this.url(),{action:'stop',id:this.id,after:this.cursor});if(!this.disposed)this.apply(result);}
    catch(e){if(!this.disposed){this.status.textContent=e.message;this.stop.disabled=false;}}
    finally{this.canceling=false;if(this.running)this.schedule();}
  }
  dispose(){this.disposed=true;document.removeEventListener('visibilitychange',this.visibility);this.readController?.abort();clearTimeout(this.timer);}
}
