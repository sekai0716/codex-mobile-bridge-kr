'use strict';

class GitPanel {
  constructor(workbench, session, tab) {
    this.workbench = workbench; this.session = session; this.tab = tab; this.mode = 'changes'; this.historyLimit = 40; this.windowStates = {};
    this.repository = null;
    this.node = (...args) => workbench.node(...args);
    this.button = (...args) => workbench.button(...args);
  }
  url(operation, path = '') {
    return this.workbench.url(this.session, operation, path) + '&repository=' + encodeURIComponent(this.repository ?? '');
  }
  dispose() { this.floating?.destroy(); this.floating = null; this.tab.controller?.abort(); this.diffController?.abort(); this.historyDiffController?.abort(); }
  async load() {
    this.dispose(); const controller = this.tab.controller = new AbortController();
    const head = this.node('div', 'wb-git-head'), title = this.node('div', 'wb-git-heading');
    title.append(this.node('strong', '', 'Git'), this.node('span', '', BridgeI18n.t('프로젝트 변경')));
    const refresh = this.button(BridgeI18n.t('새로고침'), () => this.load(), BridgeI18n.t('Git 상태 새로 고침'));
    head.append(title, refresh);
    const status = this.node('p', 'wb-status', BridgeI18n.t('Git 상태 로드 중…')); status.setAttribute('role', 'status');
    this.tab.body.replaceChildren(head, status);
    try {
      // 채팅의 cwd와 Git 체크아웃 선택을 분리하고, 모든 조회에 선택값을 전달한다.
      const discovered = await this.workbench.request(this.workbench.url(this.session, 'git-repositories'), undefined, controller.signal);
      if (controller.signal.aborted) return;
      const repositories = discovered.repositories;
      if (!repositories.length) { status.textContent = BridgeI18n.t('No Git repository was found in this project.'); return; }
      if (!repositories.some(row => row.path === this.repository)) { this.repository = repositories[0].path; this.selected = this.selectedCommit = null; this.windowStates = {}; }
      const picker = this.node('select', 'wb-git-repository'); picker.setAttribute('aria-label', BridgeI18n.t('Git repository'));
      for (const row of repositories) {
        const label = repositories.some(other => other !== row && other.name === row.name) ? row.root : row.name;
        const option = this.workbench.raw(this.node('option', '', label)); option.value = row.path; option.title = row.root; picker.append(option);
      }
      picker.value = this.repository; this.repositoryRoot = picker.title = repositories.find(row => row.path === this.repository).root;
      picker.onchange = () => { this.repository = picker.value; this.selected = this.selectedCommit = null; this.windowStates = {}; this.load(); };
      this.tab.body.append(picker);
      const result = await this.workbench.request(this.url('git-status'), undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.available) { status.textContent = result.message; return; }
      this.state = result;
      const branch = result.branch === '(detached)' ? BridgeI18n.t('분리된 HEAD ·') + result.commit.slice(0, 8) : result.branch;
      title.replaceChildren(this.node('strong', '', branch || 'Git'), this.node('span', '', result.project + ' · ' + (this.session.host === 'local' ? BridgeI18n.t('이 컴퓨터') : 'SSH')));
      title.firstChild.title = branch;
      const notes = [];
      if (result.operation) notes.push(result.operation === 'merge' ? BridgeI18n.t('병합 진행 중: 충돌 해결, 스테이징 및 커밋 또는 병합 중단') : BridgeI18n.t('리베이스 또는 체리픽이 진행 중입니다. 컴퓨터에서 완료하세요.'));
      if (result.commit === '(initial)') notes.push(BridgeI18n.t('아직 커밋이 없습니다.'));
      if (result.scope !== '.') notes.push(BridgeI18n.t('차이점은 현재 프로젝트 디렉토리로 제한됩니다.'));
      if (result.upstream) notes.push(result.upstream + (result.ahead === null ? '' : BridgeI18n.t('· 앞으로') + result.ahead + BridgeI18n.t('/ 뒤에') + result.behind) + BridgeI18n.t('(현지 기록)'));
      status.textContent = notes.join(' · '); status.hidden = !notes.length;
      const modes = this.node('div', 'wb-git-modes');
      for (const [key, label] of [['changes', BridgeI18n.t('변경 사항')], ['history', BridgeI18n.t('기록')], ['branches', BridgeI18n.t('지점')]]) {
        const button = this.button(label, () => { this.mode = key; this.load(); }); button.dataset.gitMode=key; button.setAttribute('aria-pressed', String(this.mode === key)); modes.append(button);
      }
      this.tab.body.append(modes);
      if (this.actionError) this.tab.body.append(this.node('p', 'wb-status error', this.actionError));
      if (this.mode === 'history') { await this.history(controller); return; }
      if (this.mode === 'branches') { await this.branches(controller); return; }
      const actions = this.node('div', 'wb-git-actions');
      const stage = this.button(BridgeI18n.t('모두 스테이지'), () => this.execute({action:'stage-all'}).catch(()=>{}));
      const unstage = this.button(BridgeI18n.t('모두 언스테이징'), () => this.execute({action:'unstage-all'}).catch(()=>{}));
      const staged = result.entries.filter(e => !e.untracked && !e.conflict && e.index !== '.');
      stage.disabled = !result.entries.some(e => e.untracked || e.conflict || e.worktree !== '.'); unstage.disabled = !staged.length;
      const commit = this.button((result.operation === 'merge' ? BridgeI18n.t('병합 완료') : BridgeI18n.t('저지르다')) + (staged.length ? ' · ' + staged.length : ''), () => this.commitDialog()); commit.className = 'primary';
      commit.disabled = (!staged.length && result.operation !== 'merge') || result.scope !== '.' || result.entries.some(e => e.conflict) || result.branch === '(detached)';
      actions.append(stage, unstage, commit);
      if (result.operation === 'merge') actions.append(this.button(BridgeI18n.t('병합 중단'), () => this.confirm(BridgeI18n.t('이 병합을 중단하세요'), BridgeI18n.t('병합 전 상태를 복원합니다. 이 병합으로 인한 충돌 해결은 삭제됩니다.'), {action:'abort-merge'}, BridgeI18n.t('병합 중단'))));
      this.tab.body.append(actions);
      const layout = this.node('div', 'wb-git-layout'); this.list = this.node('div', 'wb-git-list'); this.list.setAttribute("data-i18n-aria-label",'Git 변경 파일');this.list.setAttribute('aria-label', BridgeI18n.t('Git 변경 파일'));
      this.layoutHost = layout; layout.classList.add('wb-float-host');
      layout.append(this.list); this.tab.body.append(layout);
      const groups = [['conflict', BridgeI18n.t('갈등'), e => e.conflict], ['unstaged', BridgeI18n.t('무단계'), e => !e.conflict && !e.untracked && e.worktree !== '.'], ['staged', BridgeI18n.t('일부러 꾸민'), e => !e.conflict && !e.untracked && e.index !== '.'], ['untracked', BridgeI18n.t('추적되지 않음'), e => e.untracked]];
      let restored;
      for (const [section, name, filter] of groups) {
        const entries = result.entries.filter(filter); if (!entries.length) continue;
        const group = this.node('section', 'wb-git-group'); group.append(this.node('h3', '', name + ' · ' + entries.length));
        for (const entry of entries) {
          const row = this.button('', () => this.show(entry, section, row), entry.path); row.className = 'wb-git-file'; row.dataset.section = section; row.dataset.path = entry.path;
          const code = section === 'conflict' ? 'U' : section === 'untracked' ? '?' : entry[section === 'staged' ? 'index' : 'worktree'];
          const labels = {M: BridgeI18n.t('편집'), A: BridgeI18n.t('추가됨'), D: BridgeI18n.t('삭제'), R: BridgeI18n.t('이름 바꾸기'), C: BridgeI18n.t('복사'), T: BridgeI18n.t('유형이 변경됨'), U: BridgeI18n.t('갈등'), '?': BridgeI18n.t('새 파일')};
          const badge = this.node('span', 'wb-git-badge', code); badge.dataset.change = code; badge.title = labels[code] || code; badge.setAttribute('aria-label', badge.title);
          const paths = this.node('span', 'wb-git-path'); paths.append(this.workbench.raw(this.node('strong', '', entry.path)));
          if (entry.oldPath) paths.append(this.node('small', '', BridgeI18n.t('원래 경로:') + entry.oldPath));
          row.append(badge, paths);
          const rowGroup = this.node('div', 'wb-git-row'), action = this.button(section === 'staged' ? '−' : '＋', () => this.execute({action:section === 'staged' ? 'unstage' : 'stage', path:entry.path}).catch(()=>{}), (section === 'staged' ? BridgeI18n.t('언스테이지') : BridgeI18n.t('단계')) + entry.path);
          action.className = 'wb-git-row-action'; action.disabled = !!entry.submodule; rowGroup.append(row, action); group.append(rowGroup);
          if (this.selected === section + ':' + entry.path) restored = [entry, section, row];
        }
        this.list.append(group);
      }
      if (!result.entries.length) {
        layout.replaceChildren(this.node('div', 'wb-git-clean', BridgeI18n.t('이 프로젝트에는 커밋되지 않은 변경사항이 없습니다.')));
        this.selected = null;
      } else if (restored) this.show(...restored);
    } catch (error) { if (!controller.signal.aborted) { status.hidden = false; status.textContent=BridgeI18n.t(error.message); status.classList.add('error'); } }
  }
  openDetail(title) {
    this.floating?.destroy();
    this.detail = this.node('div', 'wb-git-detail');
    this.floating = new FloatingPanel({host:this.tab.body, content:this.detail, title,
      state:this.windowStates[this.mode] ||= {}, node:this.node, button:this.button,
      close:() => {
        this.diffController?.abort(); this.historyDiffController?.abort();
        this.selected = this.selectedCommit = null; this.floating = null;
        for (const row of this.layoutHost.querySelectorAll('.selected')) { row.classList.remove('selected'); row.setAttribute('aria-pressed', 'false'); }
      }});
  }
  async show(entry, section, row) {
    this.diffController?.abort(); const controller = this.diffController = new AbortController();
    this.selected = section + ':' + entry.path;
    for (const button of this.list.querySelectorAll('.wb-git-file')) { button.classList.toggle('selected', button === row); button.setAttribute('aria-pressed', String(button === row)); }
    this.openDetail(entry.path);
    const header = this.node('div', 'wb-git-diff-head');
    const labels = {staged: BridgeI18n.t('단계적 · HEAD → 색인'), unstaged: BridgeI18n.t('Unstaged · Index → ​​작업 트리'), untracked: BridgeI18n.t('추적되지 않음 · 새 파일'), conflict: BridgeI18n.t('충돌 · 작업 트리 내용')};
    header.append(this.workbench.raw(this.node('strong', '', entry.path)), this.node('small', '', labels[section]));
    const content = this.node('div', 'wb-git-diff'); content.setAttribute('tabindex', '0'); content.setAttribute("data-i18n-aria-label",'파일 차이');content.setAttribute('aria-label', BridgeI18n.t('파일 차이'));
    content.append(this.node('p', 'wb-status', BridgeI18n.t('차이점 로드 중…'))); this.detail.replaceChildren(header, content);
    try {
      const result = await this.workbench.request(this.url('git-diff', entry.path) + '&section=' + section, undefined, controller.signal);
      if (controller.signal.aborted) return;
      this.renderDiff(result, content, header);
    } catch (error) { if (!controller.signal.aborted) content.replaceChildren(this.node('p', 'wb-status error', error.message), this.button(BridgeI18n.t('다시 시도'), () => this.show(entry, section, row))); }
  }
  renderDiff(result, content, header, revision = '') {
      content.replaceChildren();
      const repository = this.repository, root = this.repositoryRoot;
      const target = {id:this.session.chatId || this.session.id, host:this.session.host, provider:this.session.provider || 'codex'};
      const canReview = target.provider === 'codex' && this.workbench.reviewLine;
      const source = revision || [BridgeI18n.t(result.section === 'staged' ? 'Staged changes' : 'Working tree'), (result.version || this.state.version || '').slice(0,12)].join(' · ');
      const numberCell = (number,side,text) => {
        if (number && canReview) {
          const path = side === 'old' && result.oldPath || result.path;
          const cell = this.button(String(number), () => this.workbench.reviewLine({repository:root,path,side,line:number,text,revision:source},target));
          cell.className = 'wb-diff-number'; cell.setAttribute('aria-label', BridgeI18n.t('Comment on line') + ' ' + number + ' · ' + BridgeI18n.t(side === 'old' ? 'Before change' : 'After change'));
          return cell;
        }
        const cell = this.node('span','wb-diff-number',number); cell.setAttribute('aria-hidden','true'); return cell;
      };
      if (!revision && !result.hunks?.some(Boolean)) header.append(this.node('small','',BridgeI18n.t('Partial changes are unavailable for this diff.')));
      const messages = {binary: BridgeI18n.t('바이너리 또는 UTF-8이 아닌 파일에는 텍스트 비교를 사용할 수 없습니다.'), large: BridgeI18n.t('파일이 차이점 미리보기 제한을 초과했습니다. 컴퓨터에서 확인하세요.'), submodule: BridgeI18n.t('컴퓨터에서 이 하위 모듈 내부의 변경 사항을 확인하세요.')};
      if (messages[result.kind]) { content.append(this.node('p', 'wb-status', messages[result.kind])); return; }
      if (result.kind === 'conflict') { const pre = this.node('pre', 'wb-git-conflict', result.text); content.append(pre); return; }
      if (!result.text) { content.append(this.node('p', 'wb-status', BridgeI18n.t('텍스트 차이가 없습니다. 이는 권한 변경, 이름 바꾸기 또는 빈 파일일 수 있습니다.'))); return; }
      const lines = result.text.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
      const blocks = result.hunks ? result.text.split(/(?=^@@ )/m).slice(1) : [];
      let oldLine = 0, newLine = 0, added = 0, removed = 0, inHunk = false, block = -1;
      const fragment = document.createDocumentFragment();
      for (const text of lines) {
        const hunk = text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        const line = this.node('div', 'wb-diff-line'); let old = '', next = '';
        if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); inHunk = true; line.classList.add('hunk'); }
        else if (inHunk && text.startsWith('+')) { next = newLine++; added++; line.classList.add('added'); }
        else if (inHunk && text.startsWith('-')) { old = oldLine++; removed++; line.classList.add('removed'); }
        else if (inHunk && text.startsWith(' ')) { old = oldLine++; next = newLine++; }
        else line.classList.add('meta');
        line.append(numberCell(old,'old',text), numberCell(next,'new',text), this.workbench.raw(this.node('code', '', text))); fragment.append(line);
        if (!hunk || revision) continue;
        const index = ++block, token = result.hunks?.[index];
        if (token === null) fragment.append(this.node('small','wb-status',BridgeI18n.t('This block matches another change and cannot be applied separately.')));
        if (!token || !result.version) continue;
        const actions = this.node('div','wb-git-actions wb-hunk-actions');
        const run = action => this.execute({action,path:result.path,hunk:token},result.version,repository);
        if (result.section === 'staged') actions.append(this.button(BridgeI18n.t('Unstage change block'), () => run('unstage-hunk').catch(()=>{})));
        else {
          actions.append(this.button(BridgeI18n.t('Stage change block'), () => run('stage-hunk').catch(()=>{})));
          const label = BridgeI18n.t('Discard change block');
          if (result.canDiscardHunk) actions.append(this.button(label, () => this.dialog(BridgeI18n.t('Discard this change block?'), BridgeI18n.t('Only the displayed changes will be discarded.'), label, () => run('discard-hunk'), [this.workbench.raw(this.node('pre','wb-hunk-preview',blocks[index]))])));
          else actions.append(this.node('small','',BridgeI18n.t('Partial discard is unavailable for this file’s line endings.')));
        }
        fragment.append(actions);
      }
      content.append(fragment); header.append(this.node('span', 'wb-diff-summary', '+' + added + ' / −' + removed));
  }

  async execute(params, version = this.state.version, repository = this.repository) {
    if (this.busy) return;
    this.busy = true; this.actionError = '';
    for (const button of this.tab.body.querySelectorAll('button,select')) button.disabled = true;
    try {
      const result = await this.workbench.request(this.workbench.url(this.session, 'git-action'), {...params, version, repository});
      this.workbench.notify(BridgeI18n.t(result.message));
      if (result.outcome !== 'success') this.actionError = result.message;
      return result;
    } catch (error) { this.actionError = error.message; throw error; }
    finally { this.busy = false; if (this.session.files?.includes(this.tab)) await this.load(); }
  }
  dialog(title, description, label, action, fields = []) {
    const dialog = this.node('dialog', 'picker wb-git-dialog'), form = this.node('form');
    const head = this.node('div', 'picker-head'), close = this.button('×', () => dialog.close(), BridgeI18n.t('닫기'));
    head.append(this.node('h2', '', title), close);
    const error = this.node('p', 'error'); error.setAttribute('role', 'alert');
    const submit = this.node('button', 'primary', label); submit.type = 'submit';
    form.append(head, this.node('p', 'muted', description), ...fields, error, submit); dialog.append(form);
    let pending = false;
    dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
    dialog.addEventListener('close', () => dialog.remove());
    form.onsubmit = async event => {
      event.preventDefault(); if (pending) return; pending = true; submit.disabled = close.disabled = true; error.textContent = BridgeI18n.t('일하고 있는…');
      try { await action(); dialog.close(); }
      catch (failure) { error.textContent=BridgeI18n.t(failure.message); }
      finally { pending = false; submit.disabled = close.disabled = false; }
    };
    document.body.append(dialog); dialog.showModal(); return dialog;
  }
  confirm(title, description, params, label) {
    const version = this.state.version, repository = this.repository;
    this.dialog(title, description, label, () => this.execute(params, version, repository));
  }
  commitDialog() {
    const version = this.state.version, repository = this.repository, list = this.node('ul', 'wb-commit-files');
    for (const entry of this.state.entries.filter(e => !e.untracked && e.index !== '.')) list.append(this.node('li', '', entry.path));
    if (!list.children.length && this.state.operation === 'merge') list.append(this.node('li', '', BridgeI18n.t('파일이 변경되지 않습니다. 이 커밋은 분기 병합을 기록합니다.')));
    const message = this.node('textarea'); message.required = true; message.rows = 4; message.setAttribute("data-i18n-placeholder",'커밋 메시지');message.placeholder = BridgeI18n.t('커밋 메시지'); message.setAttribute("data-i18n-aria-label",'커밋 메시지');message.setAttribute('aria-label', BridgeI18n.t('커밋 메시지'));
    this.dialog(BridgeI18n.t('헌신하다') + this.state.branch, BridgeI18n.t('아래의 단계적 변경사항만 커밋하세요. 단계적이지 않은 변경 사항이 남아 있습니다. 컴퓨터의 Git ID, 서명 및 후크를 사용합니다.'), BridgeI18n.t('커밋 확인'), () => this.execute({action:'commit', message:message.value}, version, repository), [list, message]);
  }
  graph(commit, lanes) {
    let lane = lanes.indexOf(commit.id), incoming = lane >= 0;
    if (lane < 0) { lane = lanes.length; lanes.push(commit.id); }
    const before = [...lanes]; lanes.splice(lane, 1);
    for (const [index, parent] of commit.parents.entries()) if (!lanes.includes(parent)) lanes.splice(index === 0 ? Math.min(lane, lanes.length) : lanes.length, 0, parent);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), width = Math.max(before.length, lanes.length, 1) * 16 + 8;
    svg.setAttribute('viewBox', '0 0 ' + width + ' 76'); svg.setAttribute('width', width); svg.setAttribute('height', '76'); svg.setAttribute('class', 'wb-history-graph'); svg.setAttribute('aria-hidden', 'true');
    const x = column => 12 + column * 16;
    const line = (start, from, end, to, color) => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M' + x(start) + ' ' + from + ' C' + x(start) + ' ' + ((from+to)/2) + ' ' + x(end) + ' ' + ((from+to)/2) + ' ' + x(end) + ' ' + to); p.setAttribute('class', 'wb-graph-lane lane-' + color % 5); svg.append(p); };
    before.forEach((id, index) => { if (id !== commit.id) line(index, 0, lanes.indexOf(id), 76, index); });
    if (incoming) line(lane, 0, lane, 30, lane);
    for (const parent of commit.parents) line(lane, 30, lanes.indexOf(parent), 76, lane);
    const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', x(lane)); dot.setAttribute('cy', '30'); dot.setAttribute('r', commit.parents.length > 1 ? '5' : '4'); dot.setAttribute('class', 'wb-graph-dot lane-' + lane % 5); svg.append(dot);
    return svg;
  }
  async history(controller) {
    const toolbar = this.node('div', 'wb-history-toolbar'), scope = this.node('select'); scope.setAttribute("data-i18n-aria-label",'역사 범위');scope.setAttribute('aria-label', BridgeI18n.t('역사 범위'));
    for (const [value, label] of [['all',BridgeI18n.t('모든 브랜치 및 태그')],['current',BridgeI18n.t('현재 지점')]]) { const option = this.node('option', '', label); option.value = value; scope.append(option); }
    scope.value = this.historyRef || 'all'; scope.onchange = () => { this.historyRef = scope.value; this.historyLimit = 40; this.load(); };
    toolbar.append(scope, this.node('span', 'muted', BridgeI18n.t('로컬 커밋 기록')));
    const layout = this.historyLayout = this.node('div', 'wb-git-layout wb-history-layout'), list = this.node('div', 'wb-git-list wb-history-list');
    this.layoutHost = layout; layout.classList.add('wb-float-host'); layout.append(list);
    list.append(this.node('p', 'wb-status', BridgeI18n.t('기록 로드 중…'))); this.tab.body.append(toolbar, layout);
    const result = await this.workbench.request(this.url('git-history') + '&limit=' + this.historyLimit + '&ref=' + scope.value, undefined, controller.signal);
    if (controller.signal.aborted) return;
    list.replaceChildren(); const lanes = [];
    for (const commit of result.commits) {
      const row = this.button('', () => this.showCommit(commit), commit.subject || commit.id.slice(0, 8)); row.className = 'wb-history-row'; row.dataset.commit = commit.id;
      const text = this.node('span', 'wb-history-text'); text.append(this.workbench.raw(this.node('strong', '', commit.subject || BridgeI18n.t('(커밋 대상 없음)'))), this.node('small', '', commit.id.slice(0, 8) + ' · ' + commit.author + ' · ' + commit.date.slice(0, 10)));
      if (commit.refs) text.append(this.workbench.raw(this.node('span', 'wb-history-refs', commit.refs)));
      row.append(this.graph(commit, lanes), text); list.append(row);
    }
    if (!result.commits.length) list.append(this.node('p', 'wb-status', BridgeI18n.t('아직 커밋 내역이 없습니다.')));
    if (result.hasMore && this.historyLimit < 1000) list.append(this.button(BridgeI18n.t('이전 커밋 로드'), () => { this.historyLimit += 40; this.load(); }));
    else if (result.hasMore) list.append(this.node('p', 'wb-status', BridgeI18n.t('최근 1,000개의 커밋 표시')));
    if (this.selectedCommit) { const selected = result.commits.find(c => c.id === this.selectedCommit); if (selected) this.showCommit(selected); }
  }
  async showCommit(commit) {
    this.diffController?.abort(); this.historyDiffController?.abort(); const controller = this.diffController = new AbortController();
    this.selectedCommit = commit.id; this.openDetail(BridgeI18n.t('저지르다 ·') + commit.id.slice(0, 8));
    for (const row of this.tab.body.querySelectorAll('.wb-history-row')) { row.classList.toggle('selected', row.dataset.commit === commit.id); row.setAttribute('aria-pressed', String(row.dataset.commit === commit.id)); }
    this.detail.replaceChildren(this.node('p', 'wb-status', BridgeI18n.t('커밋 로드 중…')));
    try {
      const result = await this.workbench.request(this.url('git-commit') + '&revision=' + commit.id, undefined, controller.signal);
      if (controller.signal.aborted) return;
      const info = this.node('details', 'wb-commit-info'), summary = this.node('summary', '', result.message.split('\n')[0] || commit.id.slice(0, 8));
      info.append(summary, this.workbench.raw(this.node('p', '', result.message)), this.node('small', '', result.author + ' · ' + result.date), this.node('code', '', result.id));
      const parents = this.node('div', 'wb-commit-parents');
      for (const parent of result.parents) parents.append(this.button(BridgeI18n.t('상위 커밋') + parent.slice(0, 8), () => this.showCommit({id:parent})));
      info.append(parents);
      const picker = this.node('select', 'wb-history-file'); picker.setAttribute("data-i18n-aria-label",'이 커밋의 파일');picker.setAttribute('aria-label', BridgeI18n.t('이 커밋의 파일'));
      for (const entry of result.entries) { const option = this.node('option', '', entry.change + ' · ' + entry.path); option.value = entry.path; picker.append(option); }
      const label = this.node('p', 'wb-status', result.entries.length + BridgeI18n.t('개 파일') + (result.parents.length > 1 ? BridgeI18n.t('· 첫 번째 부모와 비교') : ''));
      const diffArea = this.node('div', 'wb-history-diff-area');
      picker.onchange = () => this.showHistoricalDiff(commit.id, picker.value, diffArea);
      this.detail.replaceChildren(info, label);
      if (result.entries.length) { this.detail.append(picker, diffArea); picker.onchange(); }
      else this.detail.append(this.node('p', 'wb-empty', BridgeI18n.t('이 커밋에 대해 이 프로젝트에 변경사항이 없습니다.')));
    } catch (error) { if (!controller.signal.aborted) this.detail.replaceChildren(this.node('p', 'wb-status error', error.message)); }
  }
  async showHistoricalDiff(revision, path, area) {
    this.historyDiffController?.abort(); const controller = this.historyDiffController = new AbortController();
    const header = this.node('div', 'wb-git-diff-head'), content = this.node('div', 'wb-git-diff'); content.tabIndex = 0;
    content.append(this.node('p', 'wb-status', BridgeI18n.t('차이점 로드 중…'))); area.replaceChildren(header, content);
    try {
      const result = await this.workbench.request(this.url('git-history-diff', path) + '&revision=' + revision, undefined, controller.signal);
      if (!controller.signal.aborted) this.renderDiff(result, content, header, revision);
    } catch (error) { if (!controller.signal.aborted) content.replaceChildren(this.node('p', 'wb-status error', error.message)); }
  }
  async branches(controller) {
    const toolbar = this.node('div', 'wb-git-actions'), create = this.button(BridgeI18n.t('지점 만들기'), () => {
      const name = this.node('input'); name.required = true; name.setAttribute("data-i18n-placeholder",'예를 들어 기능/신작');name.placeholder = BridgeI18n.t('예를 들어 기능/신작'); name.setAttribute("data-i18n-aria-label",'새 지점 이름');name.setAttribute('aria-label', BridgeI18n.t('새 지점 이름'));
      const version = this.state.version, repository = this.repository;
      this.dialog(BridgeI18n.t('분기 생성 및 전환'), BridgeI18n.t('새 분기는 현재 커밋에서 시작됩니다.'), BridgeI18n.t('생성 및 전환'), () => this.execute({action:'create-branch', branch:name.value.trim()}, version, repository), [name]);
    });
    create.disabled = this.state.scope !== '.' || !!this.state.operation; toolbar.append(create); this.tab.body.append(toolbar);
    const list = this.node('div', 'wb-branch-list'); list.append(this.node('p', 'wb-status', BridgeI18n.t('지점 로드 중…'))); this.tab.body.append(list);
    const result = await this.workbench.request(this.url('git-branches'), undefined, controller.signal);
    if (controller.signal.aborted) return;
    list.replaceChildren();
    for (const branch of result.branches) {
      const card = this.node('div', 'wb-branch-card'), name = this.node('div');
      name.append(this.workbench.raw(this.node('strong', '', branch.name)), this.node('small', '', (branch.current ? BridgeI18n.t('현재 지점 ·') : '') + branch.id.slice(0, 8) + (branch.upstream ? ' · ' + branch.upstream : '')));
      const actions = this.node('div', 'wb-git-actions');
      if (!branch.current) {
        const change = this.button(BridgeI18n.t('스위치'), () => this.confirm(BridgeI18n.t('지점 전환'), BridgeI18n.t('에서') + this.state.branch + BridgeI18n.t('로 전환하다') + branch.name + BridgeI18n.t('. 작업 파일이 대상 분기로 업데이트됩니다.'), {action:'switch-branch', branch:branch.name}, BridgeI18n.t('스위치 확인')));
        const merge = this.button(BridgeI18n.t('현재 분기에 병합'), () => this.confirm(BridgeI18n.t('분기 병합'), BridgeI18n.t('병합') + branch.name + BridgeI18n.t('~ 안으로') + this.state.branch + BridgeI18n.t('. 이로 인해 병합 커밋이 생성되거나 충돌 해결이 필요할 수 있습니다.'), {action:'merge', branch:branch.name}, BridgeI18n.t('병합 시작')));
        change.disabled = merge.disabled = this.state.scope !== '.' || !!this.state.operation; actions.append(change, merge);
      }
      card.append(name, actions); list.append(card);
    }
    if (!result.branches.length) list.append(this.node('p', 'wb-status', BridgeI18n.t('첫 번째 커밋 후에 브랜치가 나타납니다.')));
    if (this.state.entries.length) list.prepend(this.node('p', 'wb-status', BridgeI18n.t('전환하거나 병합하기 전에 컴퓨터에 커밋되지 않은 변경 사항을 커밋하거나 저장하세요.')));
  }

}
