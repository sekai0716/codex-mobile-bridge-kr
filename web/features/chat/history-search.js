'use strict';

class ThreadLookup {
  constructor({scope, request, jump, t}) {
    Object.assign(this, {scope, request, jump, t});
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'picker message-management';
    this.dialog.setAttribute('aria-labelledby', 'thread-lookup-title');
    document.body.append(this.dialog);
    this.dialog.addEventListener('close', () => { this.controller?.abort(); clearInterval(this.timer); });
    const refreshQueue = () => this.refreshQueue();
    document.addEventListener('visibilitychange', refreshQueue);
    window.addEventListener('focus', refreshQueue);
  }
  node(tag, value, cls) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (cls) node.className = cls;
    return node;
  }
  button(label, callback) {
    const button = this.node('button', this.t(label), 'plain');
    button.type = 'button'; button.onclick = callback; return button;
  }
  current() { return this.dialog.open && this.target.key === this.scope()?.key; }
  open(mode) {
    const target = this.scope();
    if (!target) return;
    clearInterval(this.timer);
    this.controller?.abort(); this.busy = false; this.target = target; this.mode = mode;
    const head = this.node('div', undefined, 'picker-head'), title = this.node('h2', this.t(mode === 'search' ? 'Find in chat' : 'Codex queue'));
    title.id = 'thread-lookup-title'; head.append(title, this.button('닫기', () => this.dialog.close()));
    this.status = this.node('p', '', 'message-management-status'); this.status.setAttribute('role','status');
    this.list = this.node('div', undefined, 'message-management-content');
    this.dialog.replaceChildren(head);
    if (mode === 'search') {
      const form = this.node('form', undefined, 'wb-search'), input = this.node('input');
      input.type = 'search'; input.maxLength = 256; input.setAttribute('aria-label', this.t('Find in chat'));
      const submit = this.node('button', this.t('검색')); submit.type = 'submit';
      input.oninput = () => { this.controller?.abort(); this.busy = false; this.list.replaceChildren(); this.status.textContent = ''; };
      form.onsubmit = event => { event.preventDefault(); if(input.value.trim()) { this.term = input.value.trim(); this.search(); } };
      form.append(input, submit); this.dialog.append(form); this.input = input;
    }
    this.dialog.append(this.status, this.list);
    if (!this.dialog.open) this.dialog.showModal();
    if (mode === 'search') this.input.focus(); else this.queue();
    this.timer = setInterval(() => {
      if (!this.current()) this.dialog.close();
      else if (this.mode === 'queue' && !document.hidden) this.queue();
    }, 3000);
  }
  async read(action, body, consume) {
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    this.busy = true;
    try {
      const data = await this.request(this.target, action, body, controller.signal);
      if (!controller.signal.aborted && this.current()) consume(data);
    } catch (error) {
      if (!controller.signal.aborted && this.current()) this.status.textContent = this.t(error.message);
    } finally { if (this.controller === controller) this.busy = false; }
  }
  async search(cursor = null) {
    if (!cursor) this.list.replaceChildren();
    this.status.textContent = this.t('검색');
    await this.read('history-search', {term:this.term, account:this.target.account, cursor}, page => {
      this.list.querySelector('.lookup-more')?.remove();
      this.status.textContent = this.t(({native:'Original chat history', index:'Saved chat history', loaded:'Currently loaded messages'})[page.source]);
      for (const row of page.data) {
        const entry = this.node('p'), button = this.button('', () => this.message(row));
        button.textContent = row.snippet; entry.append(button); this.list.append(entry);
      }
      if (page.cursor) {
        const more = this.button('More results', () => { if(!this.busy) this.search(page.cursor); });
        more.classList.add('lookup-more'); this.list.append(more);
      } else if (!this.list.children.length) this.list.append(this.node('p', this.t('No matching messages.')));
    });
  }
  async message(row, offset = 0) {
    const locate = !offset && this.jump(row);
    if (locate) { this.dialog.close(); requestAnimationFrame(locate); return; }
    await this.read('history-search', {term:this.term, account:this.target.account, cursor:row.cursor, target:[row.turnId,row.itemId], offset}, page => {
      if (!offset) {
        this.list.replaceChildren(this.button('Search results', () => this.search()), this.node('p', page.data.role === 'user' ? this.t('사용자') : 'Codex'));
        this.messageBody = this.node('div', '', 'message-management-text'); this.list.append(this.messageBody);
      }
      this.messageBody.append(document.createTextNode(page.data.text));
      this.list.querySelector('.lookup-more')?.remove();
      if(page.data.next !== null) {
        const more = this.button('계속 읽기', () => { if (!this.busy) this.message(row, page.data.next); });
        more.classList.add('lookup-more'); this.list.append(more);
      }
    });
  }
  async queue() {
    if (this.mode !== 'queue' || this.busy || !this.current()) return;
    if (this.queueWatch?.key === this.target.key) return this.queueWatch.read();
    await this.read('original-queue', undefined, data => {
      if (this.queueWatch?.key !== this.target.key) this.paintQueue(data);
    });
  }
  paintQueue(data) {
    const rows = data.rows || [];
    this.status.textContent = this.t(data.available ? 'Manage these queued messages in Codex.' : 'The original queue is unavailable on this connection.');
    const signature = JSON.stringify([data.available,rows]);
    if (this.signature === signature && this.list.children.length) return;
    this.signature = signature; this.list.replaceChildren();
    for (const row of rows) {
      const entry = this.node('article', undefined, 'message-management-row'); entry.dataset.id = row.id;
      const copy = this.node('div', undefined, 'message-management-copy');
      copy.append(this.node('div', row.text, 'message-management-text'));
      if (row.attachments.length) copy.append(this.node('small', row.attachments.join(' · ')));
      entry.append(copy); this.list.append(entry);
    }
    if (data.available && !rows.length) this.list.append(this.node('p', this.t('대기 중인 메시지 없음')));
  }
  paintQueueCount(container, rows) {
    container.querySelector('.native-queue-count')?.remove();
    if (!rows.length) return;
    const button = this.button('Codex queue', () => this.open('queue'));
    button.classList.add('native-queue-count');
    button.textContent += ' · ' + rows.length;
    container.prepend(button);
  }
  refreshQueue() {
    this.queueWatch?.refresh();
  }
  watch(view, container) {
    const target = this.scope(), previous = this.queueWatch;
    if (!view?.connected || !target) {
      previous?.stop();
      this.queueWatch = null;
      this.paintQueueCount(container, []);
      return;
    }
    const revision = view.queueRevision || 0;
    const sameScope = previous?.key === target.key;
    const rows = sameScope ? previous.rows : [];
    this.paintQueueCount(container, rows);
    if (sameScope && revision === previous.revision && view.status === previous.status) {
      previous.container = container;
      return;
    }
    previous?.stop();
    let timer, pending;
    const current = () => this.queueWatch === watch && this.scope()?.key === watch.key;
    const stop = () => {
      clearTimeout(timer);
      pending?.abort();
      pending = null;
    };
    const read = async () => {
      if (!current() || document.hidden || pending) return;
      clearTimeout(timer);
      const controller = pending = new AbortController();
      const valid = () => current() && !controller.signal.aborted;
      const dialogOpen = () => this.mode === 'queue' && this.current();
      try {
        const data = await this.request(target, 'original-queue', undefined, controller.signal);
        if (!valid()) return;
        watch.rows = data.rows || [];
        this.paintQueueCount(watch.container, watch.rows);
        if (dialogOpen()) this.paintQueue(data);
      } catch (error) {
        if (valid() && dialogOpen()) this.status.textContent = this.t(error.message);
      } finally {
        if (pending === controller) {
          pending = null;
          // Desktop follower connections may not receive app-server-specific notifications.
          if (valid() && !document.hidden && (watch.status === 'active' || watch.rows.length)) {
            timer = setTimeout(read, 10000);
          }
        }
      }
    };
    const refresh = () => {
      stop();
      if (current() && !document.hidden) timer = setTimeout(read, 125);
    };
    const watch = this.queueWatch = {key:target.key, revision, status:view.status, container, rows, read, stop, refresh};
    refresh();
  }
}
