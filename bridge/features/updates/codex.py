"""Observe the installed Desktop's public channel and hand off to its native updater.

Never reuse Bridge update packages, disable vendor policies, or infer Store eligibility
from a public manifest. Installation prompts remain owned by the original application.
"""
import copy
import json
import os
import platform
import re
import subprocess
import sys
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import Request, build_opener

from bridge.clients.desktop_app import DesktopApp
from bridge.platforms.electron import package_manifest
from bridge.features.notifications.channels import NoRedirect, read_json, write_json
from bridge.features.auth.tls import client_context
from urllib.request import HTTPSHandler


SPARKLE = '{http://www.andymatuschak.org/xml-namespaces/sparkle}'
CHANNELS = {'prod':'codex-app-prod', 'public-beta':'codex-app-beta'}
STORE_PRODUCTS = {'prod':'9PLM9XGG6VKS', 'public-beta':'9N8CJ4W95TBZ'}

# Use the target PID, not its display name. The first menu is often the Apple
# menu; inspect the target application's top-level menus for its update action.
MAC_UPDATE_SCRIPT = '''on run argv
with timeout of 180 seconds
tell application "System Events"
  set targetPid to item 1 of argv as integer
  if not (exists (first application process whose unix id is targetPid)) then error "BRIDGE_UPDATE_PROCESS_MISSING"
  tell (first application process whose unix id is targetPid)
    set frontmost to true
    repeat 30 times
      if exists menu bar 1 then
      repeat with heading in menu bar items of menu bar 1
        set choices to {}
        try
          set choices to every menu item of menu 1 of heading whose name contains "Check for Updates"
          if (count of choices) is 0 then set choices to every menu item of menu 1 of heading whose name contains "업데이트 확인"
          if (count of choices) is 0 then set choices to every menu item of menu 1 of heading whose name contains "업데이트 확인"
        on error errorText number errorNumber
          if errorNumber is not -1719 and errorNumber is not -1728 then error errorText number errorNumber
        end try
        if (count of choices) > 0 then
          if not (enabled of item 1 of choices) then error "BRIDGE_UPDATE_MENU_DISABLED"
          click item 1 of choices
          return "opened"
        end if
      end repeat
      end if
      delay 0.2
    end repeat
    error "BRIDGE_UPDATE_MENU_MISSING"
  end tell
end tell
end timeout
end run'''

UPDATE_FAILURE_MESSAGES = {
    'automationPermission':"시스템 설정 > 개인 정보 보호 및 보안 > 자동화에서 게이트웨이가 시스템 이벤트를 제어하도록 허용한 후 다시 시도하십시오.",
    'accessibilityPermission':"시스템 설정 > 개인 정보 보호 및 보안 > 접근성에서 게이트웨이를 허용한 후 다시 시도하세요. 이미 활성화된 경우 게이트웨이를 종료했다가 다시 엽니다.",
    'timeout':"시스템 권한 또는 업데이트 메뉴를 기다리는 동안 시간이 초과되었습니다. 컴퓨터에서 권한 설정을 완료하고 잠금을 해제한 후 다시 시도하세요.",
    'menuUnavailable':"Codex 업데이트 확인 메뉴를 찾을 수 없습니다. Codex 데스크탑에서 업데이트를 수동으로 확인하세요.",
    'menuDisabled':"Codex 업데이트 확인 메뉴가 일시적으로 비활성화됩니다. 데스크톱 앱이 준비될 때까지 기다린 후 다시 시도하세요.",
    'desktopUnavailable':"단일 Codex 데스크톱 프로세스를 식별할 수 없습니다. 선택한 데스크톱 앱을 연 다음 다시 시도하세요.",
    'handoffFailed':"Codex 업데이트 메뉴를 사용할 수 없습니다. 컴퓨터를 잠금 해제하고 다시 시도하거나 Codex 데스크탑에서 수동으로 업데이트를 확인하세요.",
}


def update_failure(error):
    # AppleScript stderr may contain local paths: classify it, never expose it.
    if isinstance(error, subprocess.TimeoutExpired):
        return 'timeout'
    raw = str(getattr(error, 'stderr', '') or '')
    if '(-1743)' in raw:
        return 'automationPermission'
    if '(-25211)' in raw or 'not allowed assistive access' in raw.lower() or '보조 액세스가 허용되지 않습니다.' in raw or '보조 액세스가 허용되지 않습니다.' in raw:
        return 'accessibilityPermission'
    if '(-1712)' in raw:
        return 'timeout'
    for marker, reason in [('MENU_MISSING','menuUnavailable'), ('MENU_DISABLED','menuDisabled'), ('PROCESS_MISSING','desktopUnavailable')]:
        if 'BRIDGE_UPDATE_'+marker in raw:
            return reason
    return 'desktopUnavailable' if str(error) == 'desktopUnavailable' else 'handoffFailed'


def version(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d+(?:\.\d+)*', value):
        raise ValueError("업데이트 버전 형식을 인식할 수 없습니다.")
    parts = [int(n) for n in value.split('.')]
    while len(parts) > 1 and parts[-1] == 0:
        parts.pop()
    return tuple(parts)


def package_metadata(archive):
    raw = package_manifest(archive)
    return {k:raw.get(k) for k in ('version', 'codexBuildFlavor', 'codexBuildNumber', 'codexSparkleFeedUrl')}


def installed(executable):
    app = Path(executable)
    if sys.platform == 'darwin':
        import plistlib
        bundle = next((p for p in app.parents if p.suffix == '.app'), None)
        if bundle is None:
            raise ValueError("Codex 데스크탑 설치 유형이 인식되지 않습니다.")
        info = plistlib.loads((bundle/'Contents/Info.plist').read_bytes())
        if info.get('CFBundleIdentifier') != 'com.openai.codex':
            raise ValueError("선택한 프로그램은 공식 Codex 데스크톱 앱이 아닙니다.")
        metadata = package_metadata(bundle/'Contents/Resources/app.asar')
        return {**metadata, 'version':info['CFBundleShortVersionString'], 'build':info['CFBundleVersion'], 'bundle':str(bundle)}
    archive = app.parent/'resources/app.asar'
    metadata = package_metadata(archive)
    result = {**metadata, 'build':str(metadata['codexBuildNumber']), 'bundle':None}
    if sys.platform == 'win32' and metadata['codexBuildFlavor'] in STORE_PRODUCTS:
        manifest = next((p/'AppxManifest.xml' for p in list(app.parents)[:4] if (p/'AppxManifest.xml').is_file()), None)
        if manifest:
            identity = next((n for n in ET.parse(manifest).getroot() if n.tag.rsplit('}', 1)[-1] == 'Identity'), None)
            if identity is not None:
                result.update(build=identity.attrib['Version'], packageIdentity=identity.attrib['Name'],
                              storeProductId=STORE_PRODUCTS[metadata['codexBuildFlavor']])
    return result


def appcast(raw, current, system_version):
    root = ET.fromstring(raw)
    candidates = []
    for item in root.findall('./channel/item'):
        enclosure = item.find('enclosure')
        if enclosure is None or enclosure.get(SPARKLE+'os', 'macos') != 'macos':
            continue
        build = item.findtext(SPARKLE+'version') or enclosure.get(SPARKLE+'version')
        if not build or item.findtext(SPARKLE+'channel') or enclosure.get(SPARKLE+'deltaFrom'):
            continue
        minimum = item.findtext(SPARKLE+'minimumSystemVersion')
        maximum = item.findtext(SPARKLE+'maximumSystemVersion')
        minimum_update = item.findtext(SPARKLE+'minimumUpdateVersion')
        if minimum and version(system_version) < version(minimum) or maximum and version(system_version) > version(maximum):
            continue
        if minimum_update and version(current) < version(minimum_update):
            continue
        if version(build) > version(current):
            candidates.append({'targetBuild':build, 'targetVersion':item.findtext(SPARKLE+'shortVersionString') or enclosure.get(SPARKLE+'shortVersionString') or build})
    return max(candidates, key=lambda row:version(row['targetBuild'])) if candidates else None


class DesktopUpdates:
    def __init__(self, manager):
        self.manager = manager
        self.lock = threading.RLock()
        self.value = {'state':'idle', 'canRequest':False, 'canInstall':False}
        self.attempts_path = manager.root/'desktop-update-requests.json'
        self.requests = read_json(self.attempts_path, {})
        self.pending_path = manager.root/'desktop-update-pending.json'
        self.pending = read_json(self.pending_path, {})
        self.verified_executable = None
        self.checked_at = 0
        self.worker = None

    def status(self):
        with self.lock:
            # Requesting the native updater is distinct from installing an update.
            return copy.deepcopy({**self.value, 'canInstall':False})

    def executable(self):
        return self.manager.index.get('desktopExecutable') or DesktopApp.discover(self.manager.runtime)

    def check(self, background=False):
        with self.lock:
            if self.value['state'] in ('checking', 'requesting') or background and time.time()-self.checked_at < 21600:
                return
            self.checked_at = time.time()
            self.value = {**self.value, 'state':'checking', 'canRequest':False, 'error':None}
            self.worker = threading.Thread(target=self._check, daemon=True)
            self.worker.start()

    def _check(self):
        result = {'state':'unsupported', 'canRequest':False, 'canInstall':False, 'checkedAt':time.time(),
                  'updateMethod':'unavailable'}
        meta = {}
        try:
            executable = self.executable()
            meta = installed(executable)
            channel = CHANNELS.get(meta['codexBuildFlavor'])
            result.update(currentVersion=meta['version'], currentBuild=meta['build'], channel=meta['codexBuildFlavor'])
            with self.lock:
                # The updater runs outside this gateway. Only a newer installed
                # build at the same selected executable proves a version change.
                # A different account-selected installation cannot settle it.
                pending = self.pending
                selected = os.path.normcase(str(Path(executable).resolve()))
                if (self.verified_executable == selected and
                        self.value.get('installation', {}).get('currentBuild') == meta['build']):
                    result['installation'] = copy.deepcopy(self.value['installation'])
                if (isinstance(pending, dict) and pending.get('executable') == selected
                        and version(meta['build']) > version(pending.get('build'))):
                    result['installation'] = {'state':'verified', 'previousBuild':pending['build'],
                                              'currentBuild':meta['build'], 'verifiedAt':time.time()}
                    write_json(self.pending_path, {})
                    self.pending = {}
                    self.verified_executable = selected
            if sys.platform == 'win32' and meta.get('storeProductId') and channel:
                url = 'https://persistent.oaistatic.com/'+channel+'/windows-store-update.json'
                manifest = json.loads(self.fetch(url))
                if manifest.get('storeProductId') != meta['storeProductId'] or manifest.get('packageIdentity') != meta['packageIdentity']:
                    raise ValueError("업데이트 매니페스트가 설치된 앱과 일치하지 않습니다.")
                build = manifest['buildVersion']
                newer = version(build) > version(meta['build'])
                result.update(state='available' if newer else 'checked', canRequest=True, updateMethod='store-handoff',
                              message="Microsoft Store는 이 장치에 대한 업데이트 자격을 결정합니다. 설치를 위해서는 컴퓨터에 대한 조치가 필요할 수 있습니다.")
                if newer:
                    result.update(targetBuild=build, targetVersion=build)
            elif sys.platform != 'darwin':
                result['message'] = "이 설치에 대한 업데이트는 컴퓨터나 시스템 저장소에서 확인하세요."
            elif not channel:
                result['message'] = "이 릴리스 채널은 Codex Desktop에서 확인해야 합니다."
            else:
                url = 'https://persistent.oaistatic.com/'+channel+'/appcast.xml'
                if meta['codexSparkleFeedUrl'] != url:
                    raise ValueError("데스크톱 업데이트 채널이 변경되었습니다. 앱 자체 업데이터를 사용하세요.")
                raw = self.fetch(url)
                candidate = appcast(raw, meta['build'], platform.mac_ver()[0])
                result.update(state='available' if candidate else 'checked', canRequest=True, updateMethod='native-handoff',
                              message="네이티브 Codex 업데이트 프로그램은 자격, 단계적 롤아웃 및 업데이트 정책을 결정합니다.")
                if candidate:
                    result.update(candidate)
        except Exception:
            result.update(state='error', message='공식 업데이트 채널을 읽을 수 없습니다. 나중에 다시 시도하거나 컴퓨터에서 확인하세요.',
                          canRequest=bool(meta.get('bundle') or meta.get('storeProductId')))
            if meta.get('bundle') and sys.platform == 'darwin':
                result['updateMethod'] = 'native-handoff'
            elif meta.get('storeProductId') and sys.platform == 'win32':
                result['updateMethod'] = 'store-handoff'
        with self.lock:
            self.value = result

    @staticmethod
    def fetch(url):
        opener = build_opener(NoRedirect(), HTTPSHandler(context=client_context()))
        with opener.open(Request(url, headers={'User-Agent':'Codex-Mobile-Bridge'}), timeout=20) as response:
            raw = response.read(2*1024*1024+1)
        if len(raw) > 2*1024*1024:
            raise ValueError("업데이트 매니페스트가 너무 큽니다.")
        return raw

    def request(self, value):
        if set(value) != {'requestId', 'confirmed', 'tasksConfirmed', 'currentBuild'} or value['confirmed'] is not True or value['tasksConfirmed'] is not True:
            raise ValueError("모든 데스크톱 작업이 완료되었는지 확인하고 앱 자체 업데이터가 열리도록 허용합니다.")
        request_id = value['requestId']
        if not isinstance(request_id, str) or str(uuid.UUID(request_id)) != request_id:
            raise ValueError("잘못된 업데이트 요청 ID.")
        with self.manager.gate, self.manager.lock, self.lock:
            if request_id in self.requests:
                if self.requests[request_id] != value['currentBuild']:
                    raise ValueError('동일한 요청을 다른 버전에 사용할 수 없습니다.')
                return
            self.manager.check_ready()
            self.manager.idle()
            meta = installed(self.executable())
            if (sys.platform not in ('darwin', 'win32') or not self.value.get('canRequest')
                    or sys.platform == 'win32' and not meta.get('storeProductId') or meta['build'] != value['currentBuild']):
                raise ValueError("버전 또는 업데이트 기능이 변경되었습니다. 다시 확인하세요.")
            self.requests[request_id] = meta['build']
            write_json(self.attempts_path, self.requests)
            pending = {'build':meta['build'], 'executable':os.path.normcase(str(Path(self.executable()).resolve()))}
            write_json(self.pending_path, pending)
            self.pending = pending
            self.value.pop('installation', None)
            self.value.update(state='requesting', canRequest=False)
            self.value.pop('failureReason', None)
            self.worker = threading.Thread(target=self._request, args=(meta,), daemon=True)
            self.worker.start()

    def _request(self, meta):
        # The vendor owns the install prompt and policy; never click an arbitrary dialog.
        failure = None
        try:
            if sys.platform == 'win32':
                if meta.get('storeProductId') not in STORE_PRODUCTS.values():
                    raise ValueError("잘못된 스토어 제품 ID.")
                os.startfile('ms-windows-store://pdp/?PRODUCTID='+meta['storeProductId'])
                message = "Microsoft Store 앱 페이지를 요청했습니다. 컴퓨터에서 업데이트를 확인하고 확인하세요."
            else:
                processes = DesktopApp(self.executable(), self.manager.home).processes()
                if len(processes) != 1:
                    raise ValueError('desktopUnavailable')
                result = subprocess.run(['osascript', '-e', MAC_UPDATE_SCRIPT, str(processes[0])], check=True, timeout=180,
                                        capture_output=True, text=True)
                if result.stdout.strip() != 'opened':
                    raise ValueError('handoffFailed')
                message = "네이티브 업데이트 프로그램이 열렸습니다. 컴퓨터에 설치를 확인하십시오. 업데이트가 아직 완료되지 않았습니다."
        except Exception as error:
            failure = update_failure(error)
            message = ("시스템 저장소를 열 수 없습니다. 컴퓨터에서 업데이트를 확인하세요." if sys.platform == 'win32' else UPDATE_FAILURE_MESSAGES[failure])
        with self.lock:
            self.value.update(state='needsDesktop', canRequest=bool(failure), message=message, failureReason=failure)
