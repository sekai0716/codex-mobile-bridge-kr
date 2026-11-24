'use strict';
// Preserve the existing forms and handlers while presenting each module as a compact overview.
(() => {
  const $=id=>document.getElementById(id),t=BridgeI18n.t;
  const text=(tag,key,cls='')=>{const n=document.createElement(tag);n.className=cls;n.dataset.i18n=key;n.textContent=t(key);return n;};
  const module=name=>{const n=document.createElement('section');n.dataset.panel=name;n.hidden=true;$('settings').insertBefore(n,$('save-bar'));return n;};
  const paths={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',accounts:'M3 4h18v13H3z M8 21h8 M12 17v4',network:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',devices:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z M8 12l3 3 5-6',notifications:'M4 4h16v13H9l-5 4z',advanced:'M4 7h16 M4 17h16 M8 4v6 M16 14v6'};
  document.querySelector('.brand').innerHTML='<img src="assets/icon.png" data-icon-light="assets/icon.png" data-icon-dark="assets/icon-dark.png" alt=""><span>Bridge<small>DESKTOP GATEWAY</small></span>';
  document.querySelector('.sidebar-caption').remove();
  for(const [index,button] of [...document.querySelectorAll('aside [data-tab]')].entries()){
    if([0,2,5].includes(index))button.before(text('div',index===0?'작업 공간':index===2?'액세스 및 알림':'애플리케이션','nav-group'));
    const label=button.dataset.i18n;if(label){button.removeAttribute('data-i18n');button.replaceChildren(text('span',label));}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[button.dataset.tab]);svg.append(path);button.prepend(svg);
  }
  const descriptions={overview:'게이트웨이 상태 및 사용 가능한 액세스 링크.',accounts:'클라이언트 연결, 계정 및 작업 공간을 관리합니다.',network:'로컬, LAN 및 원격 액세스를 구성합니다.',devices:'로그인, 신뢰할 수 있는 장치 및 액세스 보호를 관리하세요.',notifications:'전달 채널, 경고 및 링크를 구성합니다.',advanced:'애플리케이션 기본 설정, 업데이트 및 진단.'};
  const description=text('p',descriptions.overview,'module-description');document.querySelector('main > header').after(description);
  module('devices').append($('auth-mode').closest('article'));
  module('network').append($('cloudflare-setup'));
  const codexPaths=module('accounts');codexPaths.append($('codex-home').closest('article'));codexPaths.dataset.clientConfig='codex';
  const accounts=$('accounts-content').closest('section');accounts.dataset.clientConfig='codex';
  const back=text('button','클라이언트로 돌아가기','client-config-back');back.type='button';accounts.before(back);back.hidden=true;
  const native=$('desktop-connections');for(const [index,article] of [...native.querySelectorAll(':scope > article')].entries())article.dataset.clientConfig=index===0?'deepseek':'claude';
  $('harness-panel').dataset.clientConfig='deepseek';
  // Secondary access mode and advanced paths remain available inside the selected client.
  function compact(article,label){const details=document.createElement('details');details.className='module-setting';const heading=article.querySelector('h2,h3,summary');const summary=text('summary',label||heading?.dataset.i18n||heading?.textContent||'설정');article.before(details);details.append(summary,article);return details;}
  compact($('harness-panel').querySelector('article'),'공식 웹');
  const clients=document.createElement('section');clients.dataset.panel='accounts';clients.id='clients-page';clients.hidden=true;
  clients.innerHTML='<div class="gateway-banner"><span class="gateway-indicator" aria-hidden="true">●</span><div><strong data-gateway-status></strong><small data-i18n="활성화된 앱은 웹과 모바일에서 공유됩니다.">활성화된 앱은 웹과 모바일에서 공유됩니다.</small></div><div class="actions"><button type="button" class="primary" data-open-workbench data-i18n="작업 공간 열기 ↗">작업 공간 열기 ↗</button><button type="button" id="clients-start" data-i18n="게이트웨이 시작" disabled>게이트웨이 시작</button><button type="button" id="clients-stop" data-i18n="중지" disabled>중지</button></div></div><div class="section-head"><h2 data-i18n="로컬 클라이언트">로컬 클라이언트</h2><div class="actions"><button type="button" id="add-client" data-i18n="클라이언트 추가">클라이언트 추가</button><button type="button" id="refresh-clients" data-i18n="다시 스캔">다시 스캔</button></div></div><p id="client-scan-status" class="client-scan-status" role="status"></p><div id="client-overview"></div><p class="hint" data-i18n="로컬 앱을 자동으로 검색하고 기존 로그인 또는 API 설정을 재사용합니다. 앱 설치 후 다시 스캔하세요.">로컬 앱을 자동으로 검색하고 기존 로그인 또는 API 설정을 재사용합니다. 앱 설치 후 다시 스캔하세요.</p><div class="client-notes"><article><h3 data-i18n="작업 공간 목록">작업 공간 목록</h3><p data-i18n="각 클라이언트에는 자체 프로젝트와 채팅이 있습니다. 새 채팅은 현재 클라이언트의 프로젝트 설정을 사용합니다.">각 클라이언트에는 자체 프로젝트와 채팅이 있습니다. 새 채팅은 현재 클라이언트의 프로젝트 설정을 사용합니다.</p></article></div>';
  $('settings').before(clients);clients.after(back);
  const claudeArticle=native.querySelectorAll(':scope > article')[1],claudeCli=document.createElement('details');claudeCli.className='account-compact';
  claudeCli.append(text('summary','Claude Code CLI 액세스'));const claudeCliRoot=document.createElement('div');claudeCliRoot.id='cli-access-claude-content';claudeCli.append(claudeCliRoot);claudeArticle.append(claudeCli);
  let client=null;const clientPages=new Map();
  function hasClient(id){return id?.startsWith('codex:')||!!document.querySelector('[data-client-config="'+id+'"]');}
  function clientPage(id){
    if(id==='codex'||id?.startsWith('codex:'))return accounts;
    if(clientPages.has(id))return clientPages.get(id);
    const page=module('accounts');page.dataset.clientConfig=id;page.classList.add('client-config-hidden');page.hidden=$('clients-page').hidden;clientPages.set(id,page);return page;
  }
  function forgetClient(id){const page=clientPages.get(id);if(page){page.remove();clientPages.delete(id);}if(client===id)selectClient(null);}
  function selectClient(id){client=id;const section=id?.startsWith('codex:')?'codex':id;native.classList.toggle('client-config-hidden',!['claude','deepseek'].includes(id));back.hidden=!id;clients.classList.toggle('configuration-open',!!id);document.querySelectorAll('[data-client-config]').forEach(n=>n.classList.toggle('client-config-hidden',n.dataset.clientConfig!==section));codexPaths.classList.toggle('client-config-hidden',section!=='codex'||!!id?.startsWith('codex:'));(id?back:clients).scrollIntoView({block:'start'});document.dispatchEvent(new CustomEvent('bridge-client-config',{detail:id}));}
  back.onclick=()=>selectClient(null);selectClient(null);
  // Keep connection setup and device controls visible; secondary settings stay compact.
  for(const name of ['network','devices','notifications'])for(const article of document.querySelectorAll('[data-panel="'+name+'"] > article'))compact(article).open=name==='devices'||name==='network'&&article.contains($('connections'));
  const notificationPage=document.querySelector('[data-panel="notifications"]');
  const groups=[['배송 채널',['bark-enabled','ntfy-enabled','pushplus-enabled','webhook-enabled','mobile-enabled']],['알림 이벤트',['security-enabled','address-enabled','watches']],['콘텐츠 및 링크',['click-base']],['도움말 및 테스트',[]]];
  for(const [title,ids] of groups){const group=document.createElement('div');group.className='module-group';group.append(text('h2',title));notificationPage.append(group);for(const id of ids){const setting=$(id)?.closest('.module-setting');if(setting){group.append(setting);if(title==='배송 채널'){const status=document.createElement('span');status.className='module-status';status.dataset.notificationStatus=id;setting.querySelector(':scope > summary')?.append(status);}}}if(!ids.length)for(const setting of notificationPage.querySelectorAll(':scope > .module-setting'))group.append(setting);}
  const maintenance=document.querySelector('[data-panel="advanced"]');const maintenanceTabs=document.createElement('div');maintenanceTabs.className='maintenance-tabs';
  for(const [key,label] of [['general','일반적인'],['updates','업데이트'],['logs','로그 및 진단']]){const b=text('button',label);b.type='button';b.onclick=()=>maintenanceTab(key);b.dataset.maintenanceTab=key;maintenanceTabs.append(b);}maintenance.before(maintenanceTabs);
  function maintenanceTab(key){maintenance.hidden=key!=='general';for(const name of ['updates','logs'])document.querySelector('[data-panel="'+name+'"]').hidden=name!==key;maintenanceTabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.maintenanceTab===key));}
  const hero=document.querySelector('.hero');hero.classList.add('gateway-banner');hero.querySelector('.hero-icon').textContent='●';hero.querySelector('h2').replaceChildren(text('span','게이트웨이 상태'));hero.querySelector('p').replaceChildren(text('span','웹이나 모바일에서 데스크톱 채팅을 계속하세요.'));
  const open=text('button','작업 공간 열기 ↗','primary');open.type='button';open.dataset.openWorkbench='';hero.querySelector('.actions').prepend(open);$('start').classList.remove('primary');
  const overview=document.querySelector('[data-panel="overview"]');overview.querySelector('[data-jump="accounts"]').remove();
  const addresses=$('addresses');addresses.classList.add('address-summary');const entrances=document.createElement('article');entrances.className='entrances';addresses.previousElementSibling.before(entrances);entrances.append(addresses.previousElementSibling,addresses,$('quick-tunnel-state'),$('quick-setup'));
  const footer=document.createElement('div');footer.className='entrance-footer';const network=text('button','네트워크 액세스 관리 →');network.type='button';network.dataset.jump='network';footer.append(network);entrances.append(footer);
  let state;
  document.querySelectorAll('[data-open-workbench]').forEach(b=>b.onclick=()=>{const url=state?.urls?.find(url=>url.startsWith('https:'))||state?.urls?.[0];if(url)window.bridgeDesktop.open(url);});
  window.GatewayLayout={selectClient,hasClient,clientPage,forgetClient,tab(name,{section='general'}={}){description.dataset.i18n=descriptions[name];description.textContent=t(descriptions[name]);back.hidden=name!=='accounts'||!client;maintenanceTabs.hidden=name!=='advanced';if(name==='advanced')maintenanceTab(['updates','logs'].includes(section)?section:'general');},update(value,{starting=false,stopping=false}={}){state=value;document.querySelectorAll('[data-gateway-status]').forEach(n=>n.textContent=t(stopping?'게이트웨이 중지 중':starting?'게이트웨이 시작 중':value.runtime.running?'게이트웨이 실행 중':'게이트웨이 중지됨'));document.querySelectorAll('[data-open-workbench]').forEach(b=>b.disabled=!value.runtime.running||!value.urls?.length);}};
})();
