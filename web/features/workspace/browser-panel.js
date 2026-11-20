'use strict';

class BrowserPanel {
  constructor(wb, session, tab) {
    this.workbench = wb;
    this.url = wb.endpoint(session, 'browser');
    this.zoom = 1;
    this.epoch = 0;
    const label = key => BridgeI18n.t(key);
    const button = (name, fn) => wb.button(label(name), fn, label(name));
    this.start = button('Share a browser window', () => this.action('start'));
    this.stop = button('End sharing', () => this.end());
    this.control = button('Take control', () => this.action(this.controlling ? 'release' : 'take'));
    this.fit = button('Fit to pane', () => { this.zoom = this.zoom === 0 ? 1 : 0; this.resize(); });
    this.up = wb.button('↑', () => this.scrollPage(-4), label('Scroll the shared page up'));
    this.down = wb.button('↓', () => this.scrollPage(4), label('Scroll the shared page down'));
    const smaller = button('Zoom out', () => this.changeZoom(-.25));
    const larger = button('Zoom in', () => this.changeZoom(.25));
    const head = wb.node('div', 'wb-browser-actions');
    head.append(this.start, this.stop, this.control, smaller, larger, this.fit, this.up, this.down);
    this.status = wb.node('p', 'wb-status', label('Move the Codex browser tab to a new window on the PC first.'));
    this.status.setAttribute('role','status');
    this.stage = wb.node('div','wb-browser-stage');
    this.picture = wb.node('img');
    this.picture.alt = label('Shared browser page');
    this.picture.draggable = false;
    this.picture.addEventListener('click', event => this.point(event, 'click'));
    this.picture.addEventListener('wheel', event => {
      if (this.controlling && !event.ctrlKey && !event.shiftKey && event.deltaY) {
        event.preventDefault();
        this.point(event, 'scroll', {delta:Math.sign(event.deltaY) * Math.min(6, Math.ceil(Math.abs(event.deltaY)/80))});
      }
    }, {passive:false});
    this.stage.append(this.picture);
    const distance = touches => Math.hypot(touches[0].clientX-touches[1].clientX, touches[0].clientY-touches[1].clientY);
    this.stage.addEventListener('touchstart', event => {
      if (event.touches.length !== 2 || !this.width) return;
      const rect = this.picture.getBoundingClientRect();
      const cx = (event.touches[0].clientX+event.touches[1].clientX)/2;
      const cy = (event.touches[0].clientY+event.touches[1].clientY)/2;
      this.pinch = {distance:distance(event.touches), zoom:rect.width/this.width,
        x:(cx-rect.left)/rect.width, y:(cy-rect.top)/rect.height};
      event.preventDefault();
    }, {passive:false});
    this.stage.addEventListener('touchmove', event => {
      if (!this.pinch || event.touches.length !== 2) return;
      event.preventDefault();
      this.zoom = Math.max(.25, Math.min(3, this.pinch.zoom*distance(event.touches)/Math.max(1,this.pinch.distance)));
      this.resize();
      const pane = this.stage.getBoundingClientRect(), rect = this.picture.getBoundingClientRect();
      this.stage.scrollLeft = this.pinch.x*rect.width-(event.touches[0].clientX+event.touches[1].clientX)/2+pane.left;
      this.stage.scrollTop = this.pinch.y*rect.height-(event.touches[0].clientY+event.touches[1].clientY)/2+pane.top;
    }, {passive:false});
    for (const type of ['touchend','touchcancel']) this.stage.addEventListener(type, () => { this.pinch=null; });
    this.text = wb.node('input');
    this.text.type = 'text';
    this.text.maxLength = 4096;
    this.text.setAttribute('aria-label',label('Text for the focused browser field'));
    this.text.placeholder = label('Text for the focused browser field');
    this.form = wb.node('form','wb-browser-actions');
    const submit = button('Insert text', () => {});
    submit.type = 'submit';
    this.form.append(this.text, submit);
    this.form.onsubmit = event => {
      event.preventDefault();
      if (this.text.value && this.frame) this.action('text', {text:this.text.value, frame:this.frame});
    };
    tab.body.append(head, this.status, this.stage, this.form);
    this.visibility = () => { if (document.hidden) this.end(); };
    document.addEventListener('visibilitychange', this.visibility);
    this.paint();
  }
  paint() {
    this.start.hidden = Boolean(this.connected || this.pending);
    this.stop.hidden = !this.start.hidden;
    this.control.hidden = !this.connected;
    this.control.disabled = !this.controlling && !this.canControl;
    this.control.textContent = BridgeI18n.t(this.controlling ? 'Return control to Codex' : 'Take control');
    this.control.setAttribute('aria-label', this.control.textContent);
    this.form.hidden = !this.controlling;
    this.up.hidden = this.down.hidden = !this.controlling;
    this.stage.hidden = !this.connected;
  }
  resize() {
    this.picture.style.width = this.zoom ? (this.width || 0) * this.zoom + 'px' : '100%';
    this.fit.setAttribute('aria-pressed', String(!this.zoom));
  }
  changeZoom(delta) {
    this.zoom = Math.max(.25, Math.min(3, (this.zoom || this.stage.clientWidth / (this.width || 1)) + delta));
    this.resize();
  }
  point(event, op, extra={}) {
    if (!this.controlling || !this.frame) return;
    const rect = this.picture.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.action(op, {frame:this.frame, x:(event.clientX-rect.left)/rect.width, y:(event.clientY-rect.top)/rect.height, ...extra});
  }
  scrollPage(delta) {
    const pane = this.stage.getBoundingClientRect(), image = this.picture.getBoundingClientRect();
    this.point({clientX:(Math.max(pane.left,image.left)+Math.min(pane.right,image.right))/2,
      clientY:(Math.max(pane.top,image.top)+Math.min(pane.bottom,image.bottom))/2}, 'scroll', {delta});
  }
  schedule() {
    clearTimeout(this.timer);
    if (this.visible && (this.connected || this.pending))
      this.timer = setTimeout(() => this.action(this.pending ? 'status' : 'frame'), this.pending ? 750 : 900);
  }
  async action(op, data={}) {
    if (this.busy || !this.visible) return;
    const epoch = this.epoch;
    const abort = this.abort = new AbortController();
    this.busy = true;
    clearTimeout(this.timer);
    if (op === 'start') {
      this.pending = true;
      this.clientId = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2,'0')).join('');
    }
    const clientId = this.clientId;
    try {
      const result = await this.workbench.request(this.url, {op, clientId, ...data}, op === 'start' ? undefined : abort.signal);
      if (epoch !== this.epoch) {
        if (op === 'start') this.workbench.request(this.url,{op:'end',clientId}).catch(()=>{});
        return;
      }
      this.pending = Boolean(result.pending);
      if ('active' in result) this.connected = result.active;
      if ('control' in result) this.controlling = result.control;
      if ('canControl' in result) this.canControl = result.canControl;
      if (result.jpeg) {
        // Publish pixels and their input nonce together, after decoding is complete.
        const next = new Image();
        next.src = 'data:image/jpeg;base64,'+result.jpeg;
        await next.decode();
        if (epoch !== this.epoch) return;
        this.picture.src = next.src;
        this.frame = result.frame;
        this.width = result.width;
        this.resize();
      } else this.frame = null;
      if (op === 'text' && result.applied) this.text.value = '';
      if (result.inputUnavailable) this.workbench.notify(BridgeI18n.t('Select an editable field in the shared page.'));
      if (result.inputUnconfirmed) this.workbench.notify(BridgeI18n.t('Check the field before entering the text again.'));
      this.status.textContent = BridgeI18n.t(this.pending ? 'Select the window on the PC.' : result.stale ? 'Page changed. Try again on the new frame.' :
        this.controlling ? 'You control this page.' : this.connected ? 'Viewing the shared browser page.' : 'Browser sharing ended.');
    } catch (error) {
      if (epoch === this.epoch && !abort.signal.aborted) {
        this.end();
        this.status.textContent = BridgeI18n.t(error.message);
      }
    } finally {
      if (epoch === this.epoch) { this.busy = false; this.paint(); this.schedule(); }
    }
  }
  end() {
    this.epoch++;
    this.abort?.abort();
    clearTimeout(this.timer);
    if (this.connected || this.pending) this.workbench.request(this.url, {op:'end', clientId:this.clientId}).catch(()=>{});
    this.busy = this.connected = this.controlling = this.pending = false;
    this.frame = null;
    this.picture.removeAttribute('src');
    this.text.value = '';
    this.status.textContent = BridgeI18n.t('Browser sharing ended.');
    this.paint();
  }
  setVisible(visible) { this.visible = visible; if (!visible) this.end(); }
  dispose() { this.setVisible(false); document.removeEventListener('visibilitychange', this.visibility); }
}
