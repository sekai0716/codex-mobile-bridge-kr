(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const base = '/relay/admin/';
  let csrf = '';
  let relayOrigin = '';
  let revokeId = '';

  function status(message = '', error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
  }
  function clearInvitation() {
    $('invitation-text').value = '';
    $('invitation-result').hidden = true;
  }
  function signedOut() {
    csrf = '';
    relayOrigin = '';
    $('dashboard').hidden = true;
    $('logout').hidden = true;
    $('login-panel').hidden = false;
    $('admin-key').value = '';
    $('devices').replaceChildren();
    $('invitations').replaceChildren();
    $('revoke-dialog').close();
    revokeId = '';
    clearInvitation();
  }
  async function api(path, body) {
    let response;
    try {
      response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      });
    } catch {
      throw new Error(body === undefined ? '릴레이에 연결할 수 없습니다. 네트워크를 확인하고 새로고침하세요.。' : '연결이 중단되었으며 작업 결과를 확인해야 합니다. 먼저 상태를 새로 고치고 다시 제출하지 마세요.。');
    }
    if (response.status === 401) signedOut();
    if (!response.ok) {
      const value = await response.json().catch(() => ({}));
      throw new Error(response.status === 429 ? '요청이 너무 자주 발생합니다. 나중에 다시 시도해 주세요.。' : value.error || '요청이 실패했습니다. 새로고침한 후 다시 시도해 주세요.。');
    }
    return response.json();
  }
  async function run(button, action) {
    button.disabled = true;
    status();
    try { await action(); } catch (error) { status(error.message, true); }
    finally { button.disabled = false; }
  }
  const date = (seconds) => new Date(seconds * 1000).toLocaleString();
  function cell(row, text) {
    const td = document.createElement('td');
    td.textContent = text;
    td.title = text;
    row.append(td);
    return td;
  }
  function badge(row, text, online = false) {
    const span = document.createElement('span');
    span.className = online ? 'badge online' : 'badge';
    span.textContent = text;
    cell(row, '').append(span);
  }
  async function refresh() {
    const data = await api('overview');
    relayOrigin = data.origin;
    $('origin').textContent = data.origin;
    $('online-count').textContent = data.devices.filter((d) => d.online).length;
    $('device-count').textContent = data.devices.filter((d) => !d.revoked).length;
    $('invite-count').textContent = data.invitations.filter((i) => !i.used && i.expires > data.now).length;
    $('devices').replaceChildren();
    for (const device of data.devices) {
      const row = document.createElement('tr');
      cell(row, device.name); cell(row, device.owner);
      badge(row, device.revoked ? '취소됨' : device.online ? '온라인' : '오프라인', device.online);
      cell(row, date(device.created));
      const action = cell(row, device.revoked ? '—' : '');
      if (!device.revoked) {
        const button = document.createElement('button');
        button.className = 'danger'; button.textContent = '취소';
        button.setAttribute('aria-label', '취소 ' + device.name);
        button.addEventListener('click', () => {
          revokeId = device.id;
          $('revoke-description').textContent = `취소“${device.name}”（${device.owner}）모든 전화에 대한 액세스？`;
          $('revoke-dialog').showModal();
        });
        action.append(button);
      }
      $('devices').append(row);
    }
    $('devices-empty').hidden = data.devices.length > 0;
    $('devices-table').hidden = !data.devices.length;
    $('invitations').replaceChildren();
    for (const invitation of data.invitations) {
      const row = document.createElement('tr');
      cell(row, invitation.owner);
      badge(row, invitation.used ? '이미 사용됨' : invitation.expires <= data.now ? '만료됨' : '사용 가능');
      cell(row, date(invitation.expires));
      $('invitations').append(row);
    }
    $('invitations-empty').hidden = data.invitations.length > 0;
    $('invitations-table').hidden = !data.invitations.length;
    $('updated').textContent = '상태 업데이트 날짜 ' + date(data.now);
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    $('logout').hidden = false;
  }
  $('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      const key = $('admin-key').value.trim();
      $('admin-key').value = '';
      const result = await api('login', { key });
      csrf = result.csrf;
      await refresh();
    });
  });
  $('invite-form').addEventListener('submit', (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      const owner = $('owner').value.trim();
      if (!owner) throw new Error('사용자 비고를 작성해주세요。');
      if (!$('invitation-result').hidden) throw new Error('현재 초대 코드를 먼저 저장한 후 닫고 지워서 다음 초대 코드를 생성하세요.。');
      const hours = Number($('hours').value);
      const result = await api('invite', { owner, hours });
      $('invitation-text').value = `릴레이 주소：${relayOrigin}\n초대코드：${result.invitation}\n유효기간：${hours} 시간（한 대의 컴퓨터만 등록할 수 있습니다.）\n컴퓨터 클라이언트에서“공유 트렁크”위의 주소와 초대코드를 입력하세요。`;
      $('invitation-result').hidden = false;
      await refresh();
    });
  });
  $('copy').addEventListener('click', () => run($('copy'), async () => {
    try {
      await navigator.clipboard.writeText($('invitation-text').value);
      status('접속 정보가 복사되었습니다. 해당 사용자에게 비공개로 보내주세요.。');
    } catch {
      $('invitation-text').focus(); $('invitation-text').select();
      status('선택한 접속 정보를 복사해 주세요。');
    }
  }));
  $('dismiss-invitation').addEventListener('click', clearInvitation);
  $('refresh').addEventListener('click', () => run($('refresh'), refresh));
  $('cancel-revoke').addEventListener('click', () => $('revoke-dialog').close());
  $('confirm-revoke').addEventListener('click', () => run($('confirm-revoke'), async () => {
    await api('revoke', { deviceId: revokeId });
    $('revoke-dialog').close();
    await refresh();
    status('기기 및 전화 승인이 취소되었습니다.。');
  }));
  $('logout').addEventListener('click', () => run($('logout'), async () => {
    await api('logout', {});
    signedOut();
    status('관리 배경 종료。');
  }));
  // Clear visible secrets when navigating away, including pages retained in bfcache.
  window.addEventListener('pagehide', signedOut);
  async function restore() {
    try {
      const session = await api('session');
      if (session.authenticated) { csrf = session.csrf; await refresh(); }
      else if (!session.configured) $('login-help').textContent = '아직 관리키가 설정되지 않았습니다. 먼저 서버 터미널에서 실행해주세요 admin-token 명령, 자세한 내용은 배포 설명서를 참조하세요.。';
    } catch (error) { status(error.message, true); }
  }
  window.addEventListener('pageshow', (event) => { if (event.persisted) restore(); });
  restore();
})();
