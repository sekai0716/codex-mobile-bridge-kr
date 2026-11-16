// Development-only bridge to the existing renderer service. Never starts a CLI.
// Kept as a self-contained function so CDP can execute it without altering app.asar.
export async function nativeRequest(request, environment) {
  // The official relay supplies the same native services and lease store. The
  // trusted runtime passes this argument; request data cannot select a transport.
  if (environment && environment.clientMode !== 'web-remote-replayable')
    throw Error('Unsupported ZCode service environment');
  const window = environment ? environment.state : globalThis.window;
  const localStorage = environment ? environment.storage : globalThis.localStorage;
  const acquireWorkspace = environment ? environment.acquireWorkspace : window?.__codexMobileZCodeAcquireWorkspace;
  const checkDeadline = () => {
    if (Date.now() >= request.expiresAt) throw Error('ZCode request expired; outcome may be unknown');
  };
  checkDeadline();
  const key = '__codexMobileZCodePrototypeV1';
  const findServices = () => {
    if (environment) return { services: environment.services, contexts: environment.contexts || [] };
    const stack = [...document.querySelectorAll('#root,#app')].flatMap(el =>
      Object.keys(el).filter(k => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$')).map(k => el[k]));
    const seen = new Set(), found = new Set(), contexts = new Set();
    let registryAnchor;
    while (stack.length && seen.size < 20000) {
      const f = stack.pop();
      if (!f || seen.has(f)) continue;
      seen.add(f); stack.push(f.child, f.sibling, f.alternate);
      // The service provider is mounted on the home screen too. Its module holds
      // the same native workspace registry; no open conversation is required.
      if (!registryAnchor && f.memoizedProps?.services?.zcodeAgentService && typeof f.type === 'function') registryAnchor = f.type;
      for (const value of [f.memoizedProps?.value, f.memoizedProps?.services]) {
        if (value?.layer?.acquire && value?.layer?.entries?.has('conversation/' + (request.anchorSessionId || request.sessionId))) contexts.add(value);
        const services = value?.zcodeAgentService ? value : value?.services;
        if (services?.zcodeAgentService) found.add(services);
      }
    }
    if (!found.size && request.action === 'application') return { services: null };
    if (found.size !== 1) throw Error('Original ZCode service accessor is unavailable or ambiguous');
    return { services: [...found][0], contexts: [...contexts], registryAnchor };
  };
  const { services, contexts, registryAnchor } = findServices();
  if (!services) return { ready: false, stage: 'services' };
  const agent = services.zcodeAgentService;
  const handshake = async () => {
    if (!['helloConversationV4', 'getWorkspaceRuntimeIdentity', 'sendConversationCommandV4',
          'queryConversationCommandsV4'].every(name => typeof agent[name] === 'function'))
      throw Error('ZCode 기존 App 세션 서비스 인터페이스 누락');
    const hello = await agent.helloConversationV4();
    if (hello == null && request.action === 'application') return null;
    if (hello?.protocolVersion !== 3 || hello.clientMode !== (environment ? 'web-remote-replayable' : 'desktop-continuous') ||
        typeof hello.connectionId !== 'string' || !hello.connectionId)
      throw Error('ZCode 기존 App 세션 서비스 프로토콜이 호환되지 않습니다');
    return hello;
  };
  const hasModels = typeof services.modelSelectionService?.getView === 'function';
  const hasSkills = typeof agent.getSkillReferenceCatalog === 'function';
  const hasAttachments = ['attachmentBeginV4', 'attachmentChunkV4', 'attachmentCommitV4', 'attachmentAbortV4']
    .every(name => typeof agent[name] === 'function');
  if (request.action === 'application') {
    const check = async stage => {
      if (!await handshake()) return { ready: false, stage: 'handshake' };
      stage?.('projects');
      if (typeof services.projectService?.readTree !== 'function') throw Error('ZCode 기존 App 프로젝트 세션 서비스 인터페이스 누락');
      const tree = await services.projectService.readTree({});
      if (tree == null) return { ready: false, stage: 'projects' };
      if (!Array.isArray(tree.tasks)) throw Error('ZCode 기존 App 프로젝트 세션 서비스 프로토콜이 호환되지 않습니다');
      const canCreate = typeof services.projectService.prepareSession === 'function' &&
        typeof services.projectService.readProjects === 'function' && hasModels;
      return { ready: true, ...(canCreate ? { canCreate: true } : {}) };
    };
    const id = request.body?.startupId;
    if (!id) return check();
    const slot = key + 'Startup';
    let job = window[slot];
    if (!job || job.id !== id || job.agent !== agent) {
      if (job) clearTimeout(job.timer);
      job = window[slot] = { id, agent };
      const stage = value => {
        if (window[slot] !== job) throw Error('ZCode 기본 시작 관찰이 만료되었습니다.');
        job.stage = value;
        clearTimeout(job.timer);
        job.timer = setTimeout(() => { if (window[slot] === job) delete window[slot]; }, 180000);
      };
      stage('handshake');
      job.work = check(stage).then(reply => { job.reply = reply; }, error => { job.error = error; });
    }
    // A slow original hello/tree read continues after this short CDP visit.
    // A later observation joins it without replaying either native operation.
    let timer;
    try {
      await Promise.race([job.work, new Promise(resolve => { timer = setTimeout(resolve, 80); })]);
    } finally { clearTimeout(timer); }
    if (window[slot] !== job) throw Error('ZCode 기본 시작 관찰이 만료되었습니다.');
    if (!job.reply && !job.error) return { ready: false, stage: job.stage };
    delete window[slot]; clearTimeout(job.timer);
    if (job.error) throw job.error;
    return job.reply;
  }
  if (request.action === 'registry-probe') return typeof acquireWorkspace === 'function' ||
    contexts.find(context => !context.layer.disposed)?.layer.acquire || registryAnchor;
  const targetTask = tree => {
    const rows = tree.tasks.filter(row => row.taskId === request.sessionId && !row.deleted &&
      !row.archived && (!row.hostId || row.hostId === 'local'));
    if (rows.length !== 1) throw Error('기존 App 고유한 로컬 세션을 찾을 수 없습니다. 목록을 새로 고치십시오.');
    return rows[0];
  };
  const listTasks = (tree, snapshotFor) => ({ sessions: tree.tasks.filter(row => !row.deleted && (!row.hostId || row.hostId === 'local'))
    .map(row => {
      const snapshot = snapshotFor?.(row.taskId);
      const nativeRename = !row.archived && typeof services.zcodeTaskService?.renameTask === 'function';
      return snapshot ? { snapshot, title: row.title, cwd: row.workspacePath, nativeRename } : { id: row.taskId, title: row.title, nativeRename,
        cwd: row.workspacePath, model: row.model, effort: row.thoughtLevel, updatedAt: row.updatedAt, archived: row.archived };
    }) });
  if (request.action === 'rename') {
    const title = request.body?.title;
    if (typeof title !== 'string' || !title.trim() || [...title.trim()].length > 120 || /[\u0000-\u001f\u007f]/u.test(title))
      throw Error('제목 1–120 단어, 제어 문자를 포함할 수 없습니다.');
    if (typeof services.zcodeTaskService?.renameTask !== 'function')
      return { notSent: true, message: '기존 App 확인된 기본 이름 바꾸기 인터페이스가 제공되지 않습니다.' };
    const before = targetTask(await services.projectService.readTree({}));
    if (before.workspacePath !== request.workspace)
      return { notSent: true, message: '원래 세션 작업 디렉터리가 변경되었으며 이름 변경이 수행되지 않았습니다.' };
    checkDeadline();
    const renamed = await services.zcodeTaskService.renameTask({ taskId: request.sessionId,
      workspacePath: request.workspace, title: title.trim() });
    // The native task service reconciles CLI facts into its durable task index.
    // Do not rename only a live conversation projection or acquire the chat.
    const after = targetTask(await services.projectService.readTree({}));
    if (renamed?.taskId !== request.sessionId || renamed.workspacePath !== before.workspacePath ||
        renamed.title !== title.trim() || after.title !== title.trim() || after.workspacePath !== before.workspacePath)
      throw Error('이름 변경 결과를 확인해야 합니다. 원래 클라이언트를 확인하세요. 중복 제출은 되지 않습니다');
    return { status: 'confirmed', scope: 'native', result: { id: request.sessionId, title: title.trim() } };
  }
  if (['projects', 'target'].includes(request.action) || request.action === 'list' && !request.sessionId) {
    const tree = await services.projectService.readTree({});
    if (request.action === 'list') return listTasks(tree);
    if (request.action === 'target') {
      const task = targetTask(tree);
      return { workspace: task.workspacePath, ...(task.title ? { title: task.title } : {}) };
    }
    return { projects: tree.projects.filter(row => !row.deleted && row.hostId === 'local' && row.roots.some(root => root.isPrimary))
      .map(row => ({ key: row.id, name: row.name, cwd: row.roots.find(root => root.isPrimary).rootPath, surface: 'desktop', host: 'local' })) };
  }
  const account = async () => {
    const provider = await services.oauthService.getActiveProvider();
    const raw = provider ? await services.credentialService.load('oauth:' + provider + ':user_info') : null;
    const profile = raw ? JSON.parse(raw) : {};
    const subject = profile.id || profile.user_id || profile.sub || profile.customerNumber || profile.email;
    const digest = subject ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([provider, subject]))) : null;
    return { identity: digest ? [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') : '',
      provider, name: profile.name || profile.displayName || profile.email || 'ZCode', email: profile.email || '' };
  };
  const models = async (knownView) => {
    if (!hasModels) throw Error('ZCode 기존 App 제공된 모델 디렉터리가 없습니다.');
    const view = knownView || await services.modelSelectionService.getView();
    return view.providers.flatMap(provider => provider.models.filter(model => model.config.enabled !== false).map(model => ({
      id: provider.providerId + '/' + model.modelId, name: model.modelId + ' · ' + provider.providerName,
      provider: provider.providerId, model: model.modelId,
      efforts: model.config.optionSpecs?.reasoningLevel?.values || [],
      defaultEffort: model.config.optionSpecs?.reasoningLevel?.values?.at(-1) || '',
    })));
  };
  if (request.action === 'account') {
    const view = await services.modelSelectionService.getView(), selection = view.preferredSelection;
    return { account: await account(), models: await models(view), capabilities: { models: true },
      ...(selection?.providerId && selection?.modelId ? { currentModel: selection.providerId+'/'+selection.modelId,
        currentEffort: selection.options?.reasoningLevel || '' } : {}) };
  }
  if (request.action === 'quota') {
    const body = request.body || {};
    if (Object.keys(body).some(key => key !== 'refresh') ||
        body.refresh !== undefined && typeof body.refresh !== 'boolean')
      throw Error('ZCode 할당량 쿼리 매개변수가 잘못되었습니다.');
    const current = await account();
    if (!current.identity || !['zai', 'bigmodel'].includes(current.provider))
      throw Error('먼저 부탁드립니다 ZCode 기존 App 공식 계정에 로그인');
    if (typeof services.providerSettingsService?.getView !== 'function' ||
        typeof services.usageStatsService?.getEntitlementSnapshot !== 'function')
      throw Error('ZCode 기존 App 할당량 쿼리 인터페이스가 제공되지 않습니다.');
    const providerId = 'account:' + current.provider + '-start-plan';
    const view = await services.providerSettingsService.getView();
    const selected = view?.providers?.find(row => row.providerId === providerId);
    const access = selected?.effectiveConfig?.access;
    if (access?.type !== 'zhipu-account' || access.accountType !== current.provider ||
        access.mode !== 'start-plan' || typeof access.entitled !== 'boolean')
      throw Error('기존 App 현재 계좌가 아직 확인되지 않았습니다. Start Plan 연결');
    checkDeadline();
    const snapshot = await services.usageStatsService.getEntitlementSnapshot({
      preferredProviderId: providerId,
      accountAccess: { type: access.type, accountType: access.accountType, mode: access.mode, entitled: access.entitled },
      allowDisabledPreferredProvider: true, requirePreferredProvider: true, allowEnvApiKey: false,
      ...(body.refresh ? { invalidateBalanceCache: true } : {}),
    });
    const after = await account();
    if (after.identity !== current.identity || after.provider !== current.provider)
      throw Error('ZCode 로그인이 변경됩니다. 나중에 다시 시도해 주세요.');
    checkDeadline();
    return { account: after, quota: snapshot };
  }
  if (request.action === 'lifecycle') {
    const busySnapshot = snapshot => snapshot.queue.items.length || snapshot.pendingInteractions.length ||
      snapshot.control.activeWorks.length || snapshot.pendingCommands?.length || snapshot.backgroundWorks?.length;
    // A live lease can prove work even when the full runtime inventory is
    // unavailable (for example after restarting only the gateway).
    const leased = window[key]?.sessions ? [...window[key].sessions.values()] : window[key] ? [window[key]] : [];
    for (const state of leased) {
      const live = state.lease.store.getState();
      if (live?.status === 'live' && busySnapshot(live.snapshot))
        return { complete: false, sessions: [{ id: live.snapshot.sessionId, status: 'active', runtimeKnown: true }] };
    }
    const tree = await services.projectService.readTree({ includeDeleted: true, includeDeletedTasks: true });
    const tasks = [...tree.tasks, ...tree.deletedTasks];
    // Refuse remote ownership and incomplete/large inventories. This check runs only
    // immediately before an explicit account transaction, never on a polling timer.
    if (tasks.length > 100 || tasks.some(task => task.hostId && task.hostId !== 'local'))
      return { complete: false, sessions: [] };
    const runtimes = await agent.collectLocalRuntimeChildProcesses();
    const expected = request.expectedRuntime;
    if (!expected || runtimes.length !== 1 || runtimes[0].pid !== expected.processId)
      return { complete: false, sessions: [] };
    const bound = window[key]?.sessions?.get(request.sessionId) || window[key];
    const loaded = bound?.lease.store.getState();
    if (loaded?.status !== 'live' || loaded.snapshot.sessionId !== request.sessionId)
      return { complete: false, sessions: [] };
    const current = loaded.snapshot;
    if (busySnapshot(current))
      return { complete: true, sessions: [{ id: request.sessionId, status: 'active', runtimeKnown: true }] };
    const sessions = [];
    for (const state of window[key]?.sessions?.values() || [bound]) {
      const live = state?.lease.store.getState();
      if (live?.status !== 'live' || JSON.stringify(state.binding.runtime) !== JSON.stringify(expected))
        return { complete: false, sessions };
      const snapshot = live.snapshot;
      sessions.push({ id: snapshot.sessionId, status: busySnapshot(snapshot) ? 'active' : 'idle', runtimeKnown: true });
    }
    for (const workspacePath of new Set([request.workspace, ...tasks.map(task => task.workspacePath)])) {
      checkDeadline();
      const native = await agent.listSessions({ workspacePath, runtimePolicy: 'existing-only', limit: 201 });
      if (native.length > 200) return { complete: false, sessions };
      for (const row of native) {
        const value = await agent.readSession({ workspacePath, sessionId: row.sessionId, runtimePolicy: 'existing-only', messageLimit: 1 });
        const busy = value.runtime.pendingRequestIds.length || value.projection.status !== 'idle' ||
          value.projection.pendingPermissions.length || value.projection.activeToolCalls.length || value.projection.backgroundJobs.length;
        const known = sessions.find(item => item.id === row.sessionId);
        if (known) { if (busy) known.status = 'active'; }
        else sessions.push({ id: row.sessionId, status: busy ? 'active' : 'idle', runtimeKnown: true });
      }
    }
    const again = await services.projectService.readTree({ includeDeleted: true, includeDeletedTasks: true });
    const stable = JSON.stringify(tree) === JSON.stringify(again);
    const still = await agent.collectLocalRuntimeChildProcesses();
    return { complete: stable && still.length === 1 && still[0].pid === expected.processId &&
      tasks.every(task => sessions.some(row => row.id === task.taskId)) &&
      sessions.every(row => {
        const state = window[key]?.sessions?.get(row.id) || (row.id === request.sessionId ? bound : null);
        const live = state?.lease.store.getState();
        if (live?.status !== 'live' || JSON.stringify(state.binding.runtime) !== JSON.stringify(expected)) return false;
        const snapshot = live.snapshot;
        if (busySnapshot(snapshot)) row.status = 'active';
        return true;
      }), sessions };
  }
  const target = { workspacePath: request.workspace, sessionId: request.sessionId };
  const read = () => agent.readSession({ ...target, runtimePolicy: 'existing-only', messageLimit: 100 });
  const clientIdentity = async (initialize = false) => {
    const hello = await handshake();
    const storageKey = 'zcode-v4-client-id:v1';
    let clientId = localStorage.getItem(storageKey);
    if (!clientId && initialize) {
      localStorage.setItem(storageKey, 'client-' + crypto.randomUUID());
      clientId = localStorage.getItem(storageKey);
    }
    if (!clientId)
      throw Error('Unsupported original ZCode connection');
    return { clientId, connectionId: hello.connectionId };
  };
  const identity = async (workspacePath = request.workspace, sessionId = request.sessionId) => {
    const client = await clientIdentity();
    const runtime = await agent.getWorkspaceRuntimeIdentity({ workspacePath, sessionId, runtimePolicy: 'existing-only' });
    if (!runtime?.identity || runtime.workspaceKey !== workspacePath)
      throw Error('Original workspace runtime is unavailable');
    return { ...client, runtime };
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Upgrade the original single-session lease without dropping the desktop's store.
  if (window[key] && !window[key].sessions) window[key].sessions = new Map([[window[key].sessionId, window[key]]]);
  const states = window[key]?.sessions || new Map();
  if (request.action === 'attach') {
    const sid = request.sessionId, workspace = request.workspace;
    const ticket = request.body?.resumeId, observing = request.body?.observe === true;
    const restores = window[key + 'Restores'] ||= new Map();
    let job = restores.get(sid);
    if (job && (job.ticket !== ticket || job.workspace !== workspace))
      throw Error('이 채팅에는 다른 연결이 있습니다. 완료될 때까지 기다려 주세요.');
    const previous = states.get(sid);
    const verifyTarget = async () => {
      if (targetTask(await services.projectService.readTree({})).workspacePath !== workspace)
        throw Error('기존 App 세션 또는 프로젝트가 변경되었습니다. 목록을 새로고침하세요.');
    };
    if (!job) {
      if (observing && previous?.ticket !== ticket) throw Error('연결이 만료되었습니다. 다시 연결해 주세요.');
      await verifyTarget();
      const loaded = previous?.lease.store.getState();
      if (loaded?.status === 'live' && loaded.snapshot?.sessionId === sid) {
        const current = await identity();
        if (same(previous.binding, current)) return { binding: current, subscriptionId: loaded.subscriptionId };
      }
      if (observing) throw Error('기존 App 연결이 변경되었습니다. 다시 시도해 주세요.');
    }
    const client = ticket ? await clientIdentity() : null;
    checkDeadline();
    // Native acquire starts restoring the original workspace even from the home screen.
    if (!job) {
      if (restores.has(sid)) throw Error('이 채팅은 계속됩니다. 상태를 새로고침해 주세요.');
      if (ticket && restores.size >= 16) throw Error('진행 중인 채팅이 많습니다. 나중에 다시 시도해 주세요.');
      const workspaceLease = acquireWorkspace?.({ workspacePath: workspace }, agent);
      const existing = contexts.find(context => context.layer.entries.has('conversation/' + sid));
      const layer = workspaceLease?.layer || existing?.layer ||
        (window[key]?.binding?.runtime?.workspaceKey === workspace ? window[key].layer : null);
      let lease;
      try {
        if (!layer || layer.disposed) throw Error('ZCode 기본 연결 입구를 사용할 수 없습니다. 애플리케이션 관리에서 접근 권한을 복원하세요.');
        lease = layer.acquire(sid);
        if (lease.store.getState().status === 'error') void lease.store.retry();
      } catch (error) { lease?.release(); workspaceLease?.release(); throw error; }
      job = { workspace, ticket, client, workspaceLease, layer, lease, progress: 0 };
      if (ticket) {
        const now = Date.now();
        job.lastSeen = job.lastChange = now;
        restores.set(sid, job);
        // Polls keep ownership alive; only actual native changes extend a stalled restore.
        // Two slow status requests and their backoff can span more than three minutes.
        job.until = () => Math.min(job.lastSeen + 300000, job.lastChange + 180000);
        job.track = () => {
          const state = lease.store.getState();
          const stamp = JSON.stringify([state.status, state.subscriptionId, state.snapshot?.seq, state.snapshot?.revision]);
          if (stamp !== job.stamp) { job.stamp = stamp; job.progress++; job.lastChange = Date.now(); }
        };
        job.finish = keep => {
          if (restores.get(sid) !== job) return;
          restores.delete(sid); clearTimeout(job.timer); job.unsubscribe?.();
          if (!keep) { lease.release(); workspaceLease?.release(); }
        };
        const expire = () => {
          const left = job.until() - Date.now();
          if (left <= 0) job.finish(false);
          else job.timer = setTimeout(expire, left);
        };
        try { job.track(); job.unsubscribe = lease.store.subscribe?.(job.track); expire(); }
        catch (error) { job.finish(false); throw error; }
      }
    }
    const { lease, workspaceLease, layer } = job, store = lease.store;
    try {
      if (ticket) {
        if (restores.get(sid) !== job || Date.now() >= job.until() || !same(job.client, client))
          throw Error('기존 App 연결 또는 연결에 실패했습니다. 다시 연결해 주세요.');
        job.lastSeen = Date.now(); job.track();
        const value = store.getState();
        if (['error','closed'].includes(value.status)) throw Error(value.lastError || 'ZCode 기본 채팅 복구 실패');
        if (value.status !== 'live' || !value.subscriptionId) return { status: 'pending', stage: 'restoring', progress: job.progress };
        await verifyTarget();
      } else if (store.getState().status !== 'live') await new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); off(); error ? reject(error) : resolve(); };
        const inspect = () => {
          const value = store.getState();
          if (value.status === 'live') finish();
          else if (['error','closed'].includes(value.status)) finish(Error(value.lastError || 'ZCode 기본 채팅 복구 실패'));
        };
        const timer = setTimeout(() => finish(Error('ZCode 기본 채팅 복구 시간이 초과되었습니다. 다시 연결하세요.')), Math.max(1, request.expiresAt - Date.now() - 250));
        const off = store.subscribe(inspect);
        inspect();
      });
      checkDeadline();
      const current = await identity();
      const value = store.getState();
      if (value.status !== 'live' || value.snapshot?.sessionId !== sid ||
          ticket && (restores.get(sid) !== job || current.clientId !== client.clientId || current.connectionId !== client.connectionId))
        throw Error('기존 App 세션이나 연결이 변경되었습니다. 다시 시도해 주세요.');
      checkDeadline();
      previous?.lease.release(); previous?.workspaceLease?.release();
      const sessions = window[key]?.sessions || states;
      const state = { binding: current, sessionId: sid, lease, layer, workspaceLease, sessions, ticket };
      sessions.set(sid, state); window[key] = state;
      job.finish?.(true);
      return { binding: current, subscriptionId: value.subscriptionId };
    } catch (error) {
      if (ticket) job.finish(false);
      else { lease.release(); workspaceLease?.release(); }
      throw error;
    }
  }
  const create = async (current, anchor) => {
    checkDeadline();
    // Match the native composer: firstInput persists the session and its input in one admission.
    // A bare draft is not a durable chat and cannot receive native goal/rename commands yet.
    const body = request.body;
    if (typeof body.firstMessage !== 'string' || !body.firstMessage.trim() || body.firstMessage.length > 100000)
      throw Error('첫 번째 메시지를 입력하세요.');
    const sid = 'sess_' + body.id;
    let workspacePath = request.workspace, projectId = null;
    if (body.directoryProject || body.projectKey && body.projectKey !== request.workspace) {
      if (typeof acquireWorkspace !== 'function' ||
          typeof services.projectService?.prepareSession !== 'function' ||
          typeof services.projectService[body.directoryProject ? 'saveProject' : 'readProjects'] !== 'function')
        throw Error('ZCode 기본 다중 프로젝트 연결은 아직 사용할 수 없습니다.');
      const project = body.directoryProject ? await services.projectService.saveProject({ hostId: 'local',
        roots: [body.directoryProject.cwd], reuseExistingRoot: true }) :
        (await services.projectService.readProjects({ hostId: 'local' })).find(row => row.id === body.projectKey && !row.deleted);
      if (!project || project.hostId !== 'local') throw Error('원래 프로젝트가 변경되었습니다. 다시 선택하세요.');
      const prepared = await services.projectService.prepareSession({ projectId: project.id, hostId: 'local' });
      const expected = body.directoryProject?.cwd || project.roots.find(root => root.isPrimary)?.rootPath;
      if (prepared.workspacePath !== expected || prepared.projectId !== project.id || prepared.workspaceIdentity)
        throw Error('원래 프로젝트 디렉터리가 변경되었습니다. 다시 선택하세요.');
      workspacePath = prepared.workspacePath; projectId = prepared.projectId;
    }
    let view;
    try { view = await services.modelSelectionService.getView(); } catch (error) { if (body.model === undefined) throw error; }
    const previous = anchor?.lease.store.getState();
    if (anchor && (previous.status !== 'live' || previous.snapshot?.sessionId !== request.sessionId))
      throw Error('ZCode 기본 세션 연결이 아직 준비되지 않았습니다.');
    let selection;
    if (body.model !== undefined) {
      const slash = typeof body.model === 'string' ? body.model.indexOf('/') : -1;
      if (slash < 1 || slash === body.model.length-1 || /[\s\x00-\x1f\x7f]/.test(body.model)) throw Error('원본을 선택해주세요 App 완전한 provider/model 심벌 마크');
      selection = { providerId: body.model.slice(0, slash), modelId: body.model.slice(slash + 1),
                    options: { reasoningLevel: body.effort } };
    } else if (previous) {
      const config = previous.snapshot.config;
      selection = { providerId: config.provider, modelId: config.model, options: { reasoningLevel: config.thought } };
    } else {
      // Use the original composer's project-scoped recent choice, then its Host recommendation.
      const recentKey = 'zcode-composer-recent:v2:' + JSON.stringify(['desktop', 'local', projectId]);
      let recent;
      try { recent = JSON.parse(localStorage.getItem(recentKey) || 'null'); } catch { /* No valid preference. */ }
      selection = recent?.modelSelection || view.preferredSelection;
    }
    const model = view?.providers.find(p => p.providerId === selection?.providerId)?.models.find(m => m.modelId === selection.modelId);
    const levels = model?.config.optionSpecs?.reasoningLevel?.values || [];
    const thought = selection?.options?.reasoningLevel || levels.at(-1) || '';
    if ((!model && body.model === undefined) || model?.config.enabled === false ||
        levels.length && !levels.includes(thought) || thought && !/^[A-Za-z0-9_-]{1,64}$/.test(thought))
      throw Error('먼저 부탁드립니다 ZCode 효과적인 모델을 선택하고 깊이 생각해 보세요.');
    if (!same(anchor ? await identity() : await clientIdentity(), current)) throw Error('ZCode owner changed before create');
    checkDeadline();
    const ack = await agent.sendConversationCommandV4({ workspacePath, projectId,
      envelope: { commandId: body.id, clientId: current.clientId, sessionId: null, type: 'createSession',
        payload: { sessionId: sid, workspaceId: workspacePath,
          config: { provider: selection.providerId, model: selection.modelId, thought, mode: 'build' },
          firstInput: { text: body.firstMessage, modelSelection: { providerId: selection.providerId, modelId: selection.modelId, options: { reasoningLevel: thought } }, mode: 'build', planEnabled: false } }, issuedAt: Date.now() } });
    if (ack.status !== 'accepted' || ack.result?.sessionId !== sid)
      return { status: ack.status === 'accepted' ? 'unknown' : ack.status, message: ack.message || '네이티브 생성 결과를 확인해야 합니다. 확인하세요. ZCode 세션 목록; 자동 재시도 없음', nativeAck: ack };
    let notice, binding, workspaceLease;
    try {
      binding = await identity(workspacePath, sid);
      workspaceLease = acquireWorkspace?.({ workspacePath }, agent);
      const layer = workspaceLease?.layer || (workspacePath === request.workspace ? anchor?.layer : null);
      if (!layer || layer.disposed) throw Error('기본 세션이 생성되었습니다. 세션 계속을 클릭하여 액세스를 완료하세요.');
      const lease = layer.acquire(sid);
      const created = { binding, sessionId: sid, lease, layer, workspaceLease, sessions: states };
      states.set(sid, created);
      if (!window[key]) window[key] = created;
    } catch (error) { workspaceLease?.release(); binding = undefined; notice = String(error.message || error); }
    return { status: 'accepted', result: { id: sid }, workspace: workspacePath, binding,
      ...(notice ? { message: notice } : {}) };
  };
  if (request.action === 'create' && !request.sessionId) {
    if (!request.body?.projectKey) throw Error('선택해주세요 ZCode 프로젝트');
    return create(await clientIdentity(true), null);
  }
  const current = await identity();
  if (request.binding && !same(current, request.binding)) throw Error('ZCode owner changed; explicit reattach required');
  if (request.action === 'list') {
    const tree = await services.projectService.readTree({});
    return listTasks(tree, id => {
      const state = states.get(id), value = state?.lease.store.getState();
      return value?.status === 'live' && state.binding.clientId === current.clientId &&
        state.binding.connectionId === current.connectionId ? value.snapshot : null;
    });
  }
  const history = request.action === 'history' || request.action === 'detail' &&
    (!states.has(request.sessionId) || !same(states.get(request.sessionId).binding, current)) ? await read() : null;
  if (history && (history.session?.sessionId !== request.sessionId || history.session?.workspace?.workspacePath !== request.workspace))
    throw Error('Native session workspace changed');
  const state = states.get(request.sessionId);
  if (request.action === 'receipt') {
    return agent.queryConversationCommandsV4({ workspacePath: request.workspace,
      commands: [{ sessionId: request.sessionId, commandId: request.commandId }] });
  }
  if (request.action === 'history') {
    return { binding: current, session: history.session, runtime: history.runtime,
      projection: history.projection, messages: history.messages.filter(m =>
        m.info?.semantics?.uiVisibility === 'visible' ||
        (!m.info?.synthetic && m.info?.visibility !== 'model-only' && m.info?.semantics?.uiVisibility !== 'hidden')) };
  }
  if (request.action === 'detail' && (!state || !same(state.binding, current))) return { detached: true, history };
  if (!state || state.sessionId !== request.sessionId || !same(state.binding, current))
    throw Error('Prototype subscription is detached; explicitly attach again');
  if (request.action === 'detach') {
    state.lease.release();
    state.workspaceLease?.release();
    states.delete(request.sessionId);
    if (window[key] === state) { delete window[key]; const remaining = states.values().next().value; if (remaining) window[key] = remaining; }
    return { detached: true };
  }
  const projection = state.lease.store.getState();
  if (!projection.snapshot || projection.status !== 'live')
    throw Error('ZCode 기본 세션 연결이 아직 준비되지 않았습니다. App 확인하고 다시 연결하세요');
  const before = projection.snapshot;
  if (before.sessionId !== request.sessionId) throw Error('Wrong native snapshot');
  if (request.action === 'create') return create(current, state);
  if (request.action === 'detail') {
    const hasAccount = typeof services.oauthService?.getActiveProvider === 'function' &&
      typeof services.credentialService?.load === 'function';
    return { binding: current, snapshot: before, ...(hasAccount ? { account: await account() } : {}),
      capabilities: { rename: typeof services.zcodeTaskService?.renameTask === 'function', models: true, effort: true, manualModels: true, manualEffort: true, create: hasModels, skills: hasSkills,
        attachments: hasAttachments, uploadFiles: hasAttachments, projectReferences: hasAttachments } };
  }
  if (request.action === 'tasks') return { tasks: (before.backgroundWorks || []).map(work => ({
    id: work.workId, title: work.title, kind: work.kind, status: work.status,
    cancellable: work.cancellable === true && work.status === 'running',
  })) };
  const body = request.body || {};
  const skills = async () => {
    if (!hasSkills) throw Error('ZCode 기존 App 제공되지 않음 Skill 폴더');
    const catalog = await agent.getSkillReferenceCatalog({ ...target, runtimePolicy: 'existing-only' });
    if (catalog.authority !== 'session') throw Error('ZCode 대화 Skill 디렉터리가 아직 준비되지 않았습니다.');
    return catalog.skills.filter(skill => skill.enabled).map(skill => ({
      id: skill.id, name: skill.name, description: skill.description, path: skill.path, selectable: true,
    }));
  };
  if (request.action === 'catalog') {
    const value = { capabilities: { models: true, effort: true, manualModels: true, manualEffort: true, skills: hasSkills },
      currentModel: before.config.provider + '/' + before.config.model, currentEffort: before.config.thought };
    if (hasModels && body.section !== 'skills') value.models = await models();
    if (hasSkills && body.section !== 'models') value.skills = await skills();
    return value;
  }
  let type, payload;
  if (request.action === 'send') {
    const mode = body.mode || 'send', routing = before.inputRouting?.mode;
    const allowed = { send: routing === 'startNow' && !before.control.activeWorks.length && !before.queue.items.length,
      queue: ['startNow', 'enqueue', 'guide', 'choice'].includes(routing),
      steer: before.control.activeWorks.length > 0 && ['enqueue', 'guide'].includes(routing) };
    if (!allowed[mode] || before.pendingInteractions.length)
      throw Error('Native session is busy or awaiting input');
    type = 'sendText'; payload = { text: body.text, requestedDelivery: { send: 'startNow', queue: 'queue', steer: 'guide' }[mode] };
    if (body.plugins?.length) {
      const catalog = await skills();
      const selected = body.plugins.map(id => catalog.find(skill => skill.id === id));
      if (selected.some(skill => !skill)) throw Error('선택된 Skill 변경되었습니다. 다시 선택해 주세요.');
      // Same native mention representation as ZCode's composer; no copied skill body.
      const label = text => text.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
      const destination = text => text.replaceAll('\\', '\\\\').replaceAll('>', '\\>');
      payload.text = selected.map(skill => '[' + label('$' + skill.name) + '](' + destination(skill.path) + ')').join('\n') + '\n\n' + body.text;
    }
    const attachments = [];
    if (body.files?.length && !hasAttachments) throw Error('ZCode 기존 App 완전한 첨부 파일 업로드 인터페이스가 제공되지 않습니다.');
    for (const file of body.files || []) {
      checkDeadline();
      const uploadId = crypto.randomUUID();
      const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const totalChunks = Math.ceil(bytes.length / (256 * 1024));
      try {
        await agent.attachmentBeginV4({ ...target, uploadId, fileName: file.name,
          mime: file.mime, totalBytes: bytes.length, totalChunks, checksum: 'sha256:' + digest });
        for (let index = 0; index < totalChunks; index++) {
          checkDeadline();
          const chunk = bytes.subarray(index * 256 * 1024, (index + 1) * 256 * 1024);
          let binary = '';
          for (let offset = 0; offset < chunk.length; offset += 8192)
            binary += String.fromCharCode(...chunk.subarray(offset, offset + 8192));
          await agent.attachmentChunkV4({ ...target, uploadId, chunkIndex: index, dataBase64: btoa(binary) });
        }
        checkDeadline();
        const committed = await agent.attachmentCommitV4({ ...target, uploadId });
        attachments.push({ ref: committed.ref, fileName: file.name, mime: file.mime, bytes: bytes.length });
      } catch (error) {
        // No message has been sent yet. Abort only this staging upload; never replay a send.
        await agent.attachmentAbortV4({ ...target, uploadId }).catch(() => {});
        throw error;
      }
    }
    if (attachments.length) payload.attachments = attachments;
  } else if (request.action === 'fork' || request.action === 'edit-message') {
    const edit = request.action === 'edit-message', target = body.target;
    const row = before.rows.window.find(row => row.rowId === target?.rowId && row.entityId === target?.entityId);
    if (target?.logEpoch !== before.logEpoch || !row || row.kind !== (edit ? 'userInput' : 'assistantText') ||
        row.actions?.[edit ? 'canEdit' : 'canFork'] !== true) throw Error('메시지가 변경되었거나 이 작업이 지원되지 않습니다. 새로고침한 후 다시 선택하세요.');
    if (edit && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 100000)) throw Error('입력해주세요 1–100000 단어 메시지');
    type = edit ? 'editUserQuery' : 'forkAssistant';
    payload = { target: { rowId: row.rowId, entityId: row.entityId }, ...(edit ? {
      newText: body.text, workspaceMode: 'preserve', ...(row.attachments?.length ? { attachments: row.attachments } : {}),
    } : {}) };
  } else if (request.action === 'compact') {
    if (before.availability?.compact?.allowed !== true || before.control.activeWorks.length ||
        before.pendingInteractions.length || before.queue.items.length) throw Error('컨텍스트를 압축하기 전에 현재 작업과 대기열이 끝날 때까지 기다리십시오.');
    type = 'compact'; payload = {};
  } else if (request.action === 'stop-task') {
    const work = before.backgroundWorks?.find(work => work.workId === body.taskId);
    if (!work || work.status !== 'running' || work.cancellable !== true) throw Error('백그라운드 작업이 종료되었거나 독립적인 중지가 지원되지 않습니다.');
    type = 'cancelBackgroundWork'; payload = { workId: work.workId };
  } else if (request.action === 'access') {
    if (!['build','guarded','yolo'].includes(before.config.mode) || !['build','guarded','yolo'].includes(body.mode) ||
        (body.mode === 'yolo' && body.confirmed !== true)) throw Error('이 권한 스위치를 확인해 주세요.');
    if (before.config.mode === body.mode) return { status: 'accepted' };
    if (before.control.activeWorks.length || before.pendingInteractions.length || before.queue.items.length || before.config.planEnabled)
      throw Error('현재 작업을 종료하고 먼저 계획 모드를 종료하십시오.');
    type = 'switchCollaborationMode'; payload = { mode: body.mode };
  } else if (request.action === 'work-mode') {
    if (!['default', 'plan'].includes(body.mode)) throw Error('잘못된 작업 모드');
    const planning = before.config.planEnabled || before.config.mode === 'plan';
    if (planning === (body.mode === 'plan')) return { status: 'accepted' };
    if (before.control.activeWorks.length || before.pendingInteractions.length || before.queue.items.length)
      throw Error('모드를 전환하기 전에 현재 작업이 끝날 때까지 기다리십시오.');
    type = 'switchCollaborationMode';
    payload = { mode: body.mode === 'plan' ? 'plan' : (['guarded','yolo'].includes(before.config.mode) ? before.config.mode : 'build') };
  } else if (request.action === 'goal') {
    if (!['set', 'pause', 'resume', 'clear'].includes(body.operation)) throw Error('잘못된 대상 작업');
    if (body.operation !== 'set' && (!before.goal || body.expected?.goalId !== before.goal.targetId ||
        body.expected?.objective !== before.goal.objective)) throw Error('대상이 변경되었습니다. 새로고침 후 진행해주세요.');
    if (['set', 'resume'].includes(body.operation) && (before.control.activeWorks.length || before.pendingInteractions.length ||
        before.queue.items.length || before.config.planEnabled || before.config.mode === 'plan'))
      throw Error('대상을 열기 전에 현재 작업을 종료하고 계획 모드를 종료하십시오.');
    if (body.operation === 'set') {
      if (before.goal && before.goal.status !== 'verified') throw Error('먼저 현재 대상을 닫으세요.');
      type = 'sendGoalCommand'; payload = { text: body.objective };
    } else if (body.operation === 'clear') {
      // Use the App's structured native goal operation; never send a slash prompt.
      if (!same(await identity(), current)) throw Error('ZCode owner changed before dispatch');
      const latest = await read();
      if (latest.session.target?.targetId !== before.goal.targetId) throw Error('대상이 변경되었습니다. 새로고침 후 진행해주세요.');
      checkDeadline();
      await services.zcodeTaskService.goalSession({ taskId: request.sessionId, workspacePath: request.workspace,
        inputId: body.id, action: 'clear', expectedRevision: latest.runtime.stateRevision });
      return { status: 'accepted' };
    } else { type = body.operation === 'pause' ? 'pauseGoal' : 'resumeGoal'; payload = {}; }
  } else if (request.action === 'settings') {
    if (before.control.activeWorks.length || before.pendingInteractions.length || before.queue.items.length)
      throw Error('모델을 전환하기 전에 현재 작업이 끝날 때까지 기다리십시오.');
    const slash = typeof body.model === 'string' ? body.model.indexOf('/') : -1;
    if (slash < 1 || slash === body.model.length-1 || /[\s\x00-\x1f\x7f]/.test(body.model))
      throw Error('원본을 선택해주세요 App 완전한 provider/model 심벌 마크');
    let rows = [];
    try { rows = await models(); } catch { /* Discovery failure does not replace an explicit native selection. */ }
    const row = rows.find(model => model.id === body.model);
    if (body.effort && (!/^[A-Za-z0-9_-]{1,64}$/.test(body.effort) || row?.efforts.length && !row.efforts.includes(body.effort)))
      throw Error('원본을 선택해주세요 App 현재 제공되는 사고의 깊이');
    type = 'switchModelConfig'; payload = { provider: body.model.slice(0, slash), model: body.model.slice(slash+1), thought: body.effort || '' };
  } else if (request.action === 'stop') {
    if (!body.executionId || !before.control.canStop ||
        !before.control.activeWorks.some(w => w.foregroundExecutionId === body.executionId))
      throw Error('Observed native execution has ended or changed');
    type = 'stop'; payload = { expectedForegroundExecutionId: body.executionId };
  } else if (request.action === 'respond') {
    const interaction = before.pendingInteractions.find(p => p.interactionId === body.interactionId);
    if (!interaction) throw Error('Native interaction has ended or changed');
    if (interaction.kind === 'permission' &&
        !interaction.payload.options.some(o => o.optionId === body.answer?.optionId))
      throw Error('Choose an offered native permission option');
    if (!['permission', 'userInput'].includes(interaction.kind)) throw Error('Unsupported native interaction');
    type = 'resolveInteraction'; payload = { interactionId: body.interactionId,
      answer: interaction.kind === 'permission' ? { optionId: body.answer.optionId } : body.answer };
  } else throw Error('Unsupported prototype operation');
  if (!same(await identity(), current)) throw Error('ZCode owner changed before dispatch');
  checkDeadline();
  const ack = await agent.sendConversationCommandV4({ workspacePath: request.workspace,
    envelope: { commandId: body.id, clientId: current.clientId, sessionId: request.sessionId,
      ...(['switchModelConfig', 'switchCollaborationMode', 'pauseGoal', 'resumeGoal', 'forkAssistant', 'editUserQuery'].includes(type) ? { baseRevision: before.revision, baseLogEpoch: before.logEpoch } : {}),
      type, payload, issuedAt: Date.now() } });
  if (type === 'forkAssistant' && ack.status === 'accepted' && ack.result?.sessionId) {
    const sid = ack.result.sessionId;
    // Explicit fork adopts only its returned child, through the existing native layer.
    const workspaceLease = acquireWorkspace?.({ workspacePath: request.workspace }, agent);
    try {
      const layer = workspaceLease?.layer || state.layer, lease = layer.acquire(sid);
      states.set(sid, { binding: current, sessionId: sid, lease, layer, workspaceLease, sessions: states });
    } catch { workspaceLease?.release(); } // Fork remains accepted; explicit resume can restore its view.
  }
  return ack;
}
