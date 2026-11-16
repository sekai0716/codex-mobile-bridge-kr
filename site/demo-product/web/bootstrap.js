'use strict';
// Keep this small and independent: even i18n or the main app may fail to load.
(function () {
  var root = document.getElementById('bootstrap-status');
  var title = document.getElementById('bootstrap-title');
  var message = document.getElementById('bootstrap-message');
  var retry = document.getElementById('bootstrap-retry');
  var originalUrl = location.href;
  var originalPairing = location.hash.indexOf('#pair=') === 0;
  var complete = false, timer = null, phase = 'loading';
  var english = false;
  try { english = localStorage.getItem('bridge-language') === 'en'; } catch (_) {}
  if (/(?:^|[?&])lang=en(?:&|$)/.test(location.search)) english = true;
  function text(ko, en) { return english ? en : ko; }
  function fail(kind) {
    if (complete) return false;
    clearTimeout(timer);
    root.hidden = false;
    root.setAttribute('aria-busy', 'false');
    title.textContent = text('워크벤치가 아직 로드되지 않았습니다.', 'The workspace has not finished loading');
    message.textContent = phase === 'pairing'
      ? text('페어링 요청 결과는 아직 확인되지 않았습니다. 다시 로드하여 연결 상태를 확인할 수 있습니다. 아직 로그인하지 않은 경우 새 페어링 코드를 다시 스캔하세요.。', 'The pairing result is not confirmed. Reload to check the connection; if you are still signed out, scan a new pairing code.')
      : kind === 'script'
      ? text('일부 페이지 구성 요소를 시작하지 못했습니다. 새로고침하세요. 그래도 실패하면 네트워크를 확인하거나 브라우저를 업데이트하세요.。', 'Some page components could not start. Reload the page; if it still fails, check your connection or update your browser.')
      : phase === 'auth'
        ? text('게이트웨이가 응답할 때까지 기다리는 데 오랜 시간이 걸립니다. 네트워크와 컴퓨터 게이트웨이를 확인하고 다시 로드하세요.。', 'The gateway is taking longer to respond. Check your connection and computer gateway, then reload.')
        : text('페이지 리소스를 로드하는 데 시간이 오래 걸립니다. 네트워크를 확인하고 새로고침하세요.。', 'Page resources are taking longer to load. Check your connection, then reload.');
    return true;
  }
  function waitingForAuth() {
    if (complete) return;
    phase = 'auth';
    clearTimeout(timer);
    timer = setTimeout(function () { fail('timeout'); }, 12000);
  }
  function onError(event) {
    if ((event.target && event.target.tagName === 'SCRIPT') || event.target === window) fail('script');
  }
  function onRejection() { fail('script'); }
  function pairingSubmitted() {
    phase = 'pairing';
    // Once the write may have reached the server, a reload must not replay it.
    originalUrl = null;
    originalPairing = false;
  }
  function ready() {
    if (complete) return;
    complete = true;
    originalUrl = null;
    clearTimeout(timer);
    root.hidden = true;
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
  }
  title.textContent = text('워크벤치에 연결 중…', 'Connecting to your workspace…');
  message.textContent = text('첫 번째 로드에는 약간의 시간이 걸릴 수 있습니다. 오랫동안 응답이 없으면 페이지를 다시 로드할 수 있습니다.。', 'The first load may take a moment. Reload the page if it stops responding.');
  retry.textContent = text("새로고침", 'Reload');
  retry.disabled = false;
  retry.onclick = function () {
    // app.js removes a pairing fragment before network access. Restore it only
    // for an explicit retry during startup, without changing a newer chat URL.
    if (!complete && originalPairing && !location.hash) history.replaceState(null, '', originalUrl);
    location.reload();
  };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  timer = setTimeout(function () { fail('timeout'); }, 12000);
  window.BridgeBootstrap = {waitingForAuth: waitingForAuth, pairingSubmitted: pairingSubmitted,
    failed: function () { return fail('connection'); }, ready: ready};
})();
