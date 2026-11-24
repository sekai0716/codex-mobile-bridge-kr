'use strict';

// The directory owns child creation. Each reading pane uses its own native
// session URL, timeline and draft without replacing the parent controller.
class SideChatPanel {
  constructor(workbench, session, tab) {
    Object.assign(this, {workbench, session, tab});
    this.creationId = uuid();
    this.temporaryCreationId = uuid();
    const n = (...args) => workbench.node(...args);
    this.toolbar = n('div', 'wb-toolbar');
    this.createButton = workbench.button('새로운 보조 채팅', () => this.create());
    this.temporaryButton = workbench.button('새 임시 사이드 채팅 만들기', () => this.create(true));
    this.refreshButton = workbench.button('↻', () => this.load(), '새로고침');
    this.toolbar.append(this.createButton, this.temporaryButton, this.refreshButton);
    this.help = n('p', 'wb-status', '보조 채팅은 네이티브 Codex 앱 구현을 사용합니다. 임시 보조 채팅은 종료되거나 게이트웨이가 다시 시작될 때 지워집니다.');
    this.status = n('p', 'wb-status'); this.status.setAttribute('role', 'status');
    this.createError = n('p','wb-status error');this.createError.setAttribute('role','alert');this.createError.hidden=true;
    this.list = n('div', 'wb-agents-list');
    tab.body.append(this.toolbar, this.help, this.status, this.createError, this.list);
    this.load();
  }
  url() { return this.workbench.endpoint(this.session, 'side-chat') + '&view=native'; }
  relabel() { this.paint(); }
  async load({refresh = false} = {}) {
    if (this.disposed || (this.loading && !refresh)) return;
    // 생성·종료 전 목록이 늦게 도착하더라도 변경 뒤의 목록을 덮지 않는다.
    this.controller?.abort();
    const controller = this.controller = new AbortController(); this.loading = true;
    this.refreshButton.disabled = true; this.status.textContent = BridgeI18n.t('채팅 로드 중…');
    try {
      const result = await this.workbench.request(this.url(), undefined, controller.signal);
      if (controller.signal.aborted) return;
      this.chats = result.chats || [];
      this.syncTabTitles();
      this.paint();
    } catch (error) {
      if (!this.disposed && !controller.signal.aborted) this.status.textContent = BridgeI18n.t(error.message);
    } finally {
      if (this.controller === controller) {
        this.loading = false;
        this.refreshButton.disabled = false;
      }
    }
  }
  syncTabTitles() {
    // 생성 응답에 제목이 없어도 같은 채팅 ID의 실제 목록 제목을 반영한다.
    const titles = new Map(this.chats.map(chat => [chat.id, chat.title]));
    let changed = false;
    for (const tab of this.session.files) {
      if (!tab.chatId) continue;
      const title = titles.get(tab.chatId);
      if (typeof title !== 'string' || !title || tab.name === title) continue;
      tab.name = title;
      changed = true;
    }
    if (changed && this.workbench.current === this.session) this.workbench.paintTabs(this.session);
  }
  paint() {
    if (this.disposed || !this.chats) return;
    const n = (...args) => this.workbench.node(...args), scroll = this.list.scrollTop;
    this.list.replaceChildren(); this.status.textContent = '';
    for (const chat of this.chats) {
      const row = n('div', 'wb-agent-card wb-side-chat-row'), title = chat.title || '이름없는 채팅';
      const open = this.workbench.button('', () => this.open(chat), title);
      open.append(this.workbench.raw(n('strong', '', title)));
      if (chat.archived) open.append(n('small', '', '보관됨'));
      const more = chat.temporary ? this.workbench.button('완료', () => this.end(chat), '일상적인 채팅 종료') :
        this.workbench.button('⋯', () => this.workbench.openSessionMenu?.(chat, more), '채팅 메뉴');
      row.append(open, more); this.list.append(row);
    }
    if (!this.chats.length) this.list.append(n('p', 'wb-empty', '이 채팅에는 아직 보조 채팅이 없습니다.'));
    this.list.scrollTop = scroll;
  }
  open(chat) {
    if(this.disposed||this.workbench.current!==this.session||chat.host&&chat.host!==this.session.host)return;
    if(!chat.id||chat.id===this.session.id||chat.parentId&&chat.parentId!==this.session.id||chat.attachedParentId&&chat.attachedParentId!==this.session.id)return;
    const tab=this.workbench.sideChatTab(this.session,chat);
    return this.workbench.select(tab.id);
  }
  async create(temporary = false) {
    if (this.disposed || this.creating) return;
    this.creating = true; this.createButton.disabled = this.temporaryButton.disabled = true;
    this.createError.hidden=true;this.createError.textContent='';
    this.status.textContent = BridgeI18n.t('보조 채팅 생성 중…');
    try {
      const key = temporary ? 'temporaryCreationId' : 'creationId';
      const result = await this.workbench.request(this.url(), {action: temporary ? 'create-temporary' : 'create', creationId: this[key]});
      if(!result?.id||result.id===this.session.id||result.host&&result.host!==this.session.host||result.parentId&&result.parentId!==this.session.id)
        throw Error('The side chat creation result is unknown. Refresh the side chat list to check.');
      this[key] = uuid();
      if (this.disposed) return;
      const listed=this.chats?.find(chat=>chat.id===result.id);
      const opening=this.workbench.isVisible(this.session,this.tab)?this.open({...listed,...result}):null;
      await Promise.all([this.load({refresh:true}),opening]);
    } catch (error) {
      if (!this.disposed) {
        this.status.textContent='';
        const message = error instanceof TypeError && !error.status
          ? 'The side chat creation result is unknown. Refresh the side chat list to check.' : error.message;
        this.createError.replaceChildren(this.workbench.node('span', '', message));
        this.createError.hidden=false;
      }
    } finally {
      this.creating = false; this.createButton.disabled = this.temporaryButton.disabled = false;
    }
  }
  async end(chat) {
    if (this.creating || this.ending || !confirm(BridgeI18n.t('이 임시 보조 채팅을 종료하고 내용을 지우시겠습니까? 주 채팅에는 영향을 주지 않습니다.'))) return;
    const cleanup = this.workbench.temporaryCleanup?.(chat.id, chat.host || this.session.host);
    this.ending = true;
    try {
      await this.workbench.request(this.url(), {action: 'close', id: chat.id});
      try {
        if (this.workbench.current === this.session) await this.workbench.close('child:' + chat.id);
      } finally { cleanup?.(); }
      await this.load({refresh:true});
    } catch (error) { if (!this.disposed) this.status.textContent = BridgeI18n.t(error.message); }
    finally { this.ending = false; }
  }
  // Closing a view never sends stop/archive/delete and never destroys history.
  dispose() { this.disposed = true; this.controller?.abort(); }
}

class SideChatView {
  constructor(workbench,session,tab){
    Object.assign(this,{workbench,session,tab});
    this.child={id:tab.chatId,host:session.host,provider:session.provider};
    const n=(...args)=>workbench.node(...args);
    this.header=n('div','wb-side-head');
    this.connection=n('small','muted');this.connection.setAttribute('role','status');
    this.full=workbench.button('Open full chat',()=>workbench.openChat(tab.chatId,session.host,session));
    this.reconnect=workbench.button('다시 연결',()=>this.activate());this.reconnect.hidden=true;
    this.header.append(this.connection,this.reconnect,this.full);
    this.viewport=n('div','wb-side-messages');this.messages=n('div','wb-child-messages');
    this.older=workbench.button('이전 내용 불러오기',()=>{});this.newer=workbench.button('새로운 콘텐츠 ↓',()=>{});
    this.older.hidden=this.newer.hidden=true;this.viewport.append(this.older,this.messages,this.newer);
    this.form=n('form','wb-agent-compose');this.input=n('textarea');this.input.rows=2;this.input.maxLength=100000;
    this.input.setAttribute('aria-label',BridgeI18n.t('사이드 채팅'));this.input.placeholder=BridgeI18n.t('메시지를 입력하세요');
    this.send=n('button','primary','보내기');this.send.type='submit';
    this.feedback=n('small','wb-agent-feedback');this.feedback.setAttribute('role','status');
    this.form.append(this.input,this.send,this.feedback);tab.body.append(this.header,this.viewport,this.form);
    this.input.oninput=()=>{if(this.draft)this.draft.text=this.input.value;this.updateComposer();};
    this.form.onsubmit=event=>{event.preventDefault();this.submit();};
    this.messages.addEventListener('bridge-compose-quote',async event=>{
      const draft=this.draft;if(!draft||!this.visible||typeof event.detail?.getText!=='function')return;
      try{const text=await event.detail.getText();if(this.visible&&this.draft===draft&&typeof text==='string')this.addText(text.split('\n').map(line=>'> '+line).join('\n'));}catch(error){this.feedback.textContent=BridgeI18n.t(error.message);}
    });
    this.messages.addEventListener('bridge-compose-prompt',event=>{if(typeof event.detail?.text==='string')this.addText(event.detail.text);});
    this.updateComposer();
  }
  addText(text){
    if(!this.visible||!this.draft||!text)return;
    this.input.value+=(this.input.value?'\n\n':'')+text;this.input.oninput();this.input.focus();
  }
  url(action){return this.workbench.endpoint(this.child,action);}
  setVisible(visible){
    if(this.disposed||visible===this.visible)return;
    this.visible=visible;
    this.updateComposer();
    if(!visible||this.timeline)return;
    this.messages.replaceChildren();this.connection.textContent=BridgeI18n.t('채팅 로드 중…');
    this.triedActivation=false;
    const timeline=this.timeline=new ChatTimeline({
      url:action=>this.url(action),request:(...args)=>this.workbench.request(...args),
      elements:{viewport:this.viewport,container:this.messages,older:this.older,newer:this.newer},
      active:()=>this.visible&&!document.hidden,canEdit:()=>false,
      renderMeta:view=>this.renderState(view),status:text=>{this.connection.textContent=BridgeI18n.t(text);},
      renderText:(node,text,files,fullText)=>renderMarkdown(node,text,files,file=>timeline.fileUrl(file),{fullText})
    });
    timeline.start();
  }
  renderState(view){
    if(view.id!==this.child.id){this.view=null;this.connection.textContent=BridgeI18n.t('The side chat could not be confirmed.');this.updateComposer();return;}
    this.view=view;this.access=sessionAccess(view.access);
    const drafts=this.session.childDrafts??=new Map(),key=JSON.stringify([this.child.id,view.draftAccountIdentity||'']);
    if(!drafts.has(key))drafts.set(key,{text:''});
    const draft=drafts.get(key);if(this.draft!==draft){this.draft=draft;this.input.value=draft.text;}
    const receipt=draft.pending&&view.submissions?.find(row=>row.id===draft.pending.id);
    if(receipt&&['accepted','queued','cancelled','ignored','rejected'].includes(receipt.status)){
      if(['accepted','queued'].includes(receipt.status)&&draft.text===draft.pending.text){draft.text='';this.input.value='';}
      draft.pending=null;draft.notice=receipt.status==='queued'?'현재 작업을 기다리는 중':'';
    }
    this.connection.textContent=BridgeI18n.t(view.error||(view.requests?.length?'확인 대기 중':view.connected?view.status==='active'?'실행 중':'연결됨':'연결 끊김'));
    this.reconnect.hidden=!!(view.connected||view.activating||view.archived||this.tab.archived||this.tab.temporary||!this.access.canReconnect);
    if(!this.reconnect.hidden&&!this.triedActivation&&this.access.source==='desktop')this.activate();
    this.updateComposer();
  }
  async activate(){
    if(!this.visible||this.reconnect.disabled||this.reconnect.hidden)return;
    this.triedActivation=true;this.reconnect.disabled=true;const timeline=this.timeline;
    try{await this.workbench.request(this.url('reconnect'),{activate:true},timeline.abort.signal);}
    catch(error){if(this.timeline===timeline)this.connection.textContent=BridgeI18n.t(error.message);}
    finally{this.reconnect.disabled=false;}
  }
  updateComposer(){
    const draft=this.draft;
    this.input.disabled=!this.visible||!draft;
    this.send.disabled=this.input.disabled||!this.view?.connected||this.view.loadingHistory||this.view.activating||
      this.view.archived||this.tab.archived||!this.access?.canSend||
      !!this.view?.requests?.length||!!draft?.sending||!draft?.text.trim();
    this.feedback.textContent=BridgeI18n.t(draft?.notice||'');
  }
  async submit(){
    if(this.send.disabled||!this.visible)return;
    const draft=this.draft,text=draft.text;
    if(draft.pending&&draft.pending.text!==text){draft.notice='Confirm the previous message in the full chat before sending another.';this.updateComposer();return;}
    const body=draft.pending??={id:uuid(),text,mode:this.view.status==='active'?'queue':'send',uiLocale:BridgeI18n.locale()};
    draft.sending=true;draft.notice='';this.updateComposer();
    try{
      const receipt=await this.workbench.request(this.url('send'),body);
      if(['accepted','queued'].includes(receipt.status)){
        draft.pending=null;draft.notice=receipt.status==='queued'?'현재 작업을 기다리는 중':'';
        if(draft.text===text){draft.text='';if(this.draft===draft)this.input.value='';}
      }else draft.notice=receipt.message||'Confirm the previous message in the full chat before sending another.';
    }catch(error){draft.notice=error.message;if(error.status===400&&error.code==='send_not_submitted')draft.pending=null;}
    finally{draft.sending=false;if(this.draft===draft)this.updateComposer();}
  }
  relabel(){this.timeline?.relabel();if(this.view)this.renderState(this.view);}
  dispose(){this.setVisible(false);this.timeline?.dispose();this.timeline=null;this.disposed=true;}
}
