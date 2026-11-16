"""Launch the discovered Harness desktop against its existing user data."""
import sys
import time
from pathlib import Path

from bridge.clients.desktop_app import DesktopApp, process_inventory
from bridge.platforms import desktop as native_desktop

def launch_deepseek(descriptor, restart=False):
    """Never replace a running desktop during an automatic scan.

    Restart is a separate explicit desktop action. ``DesktopApp.stop`` waits for
    the exact GUI process to exit gracefully and never force-kills a process.
    Codex and Claude are deliberately outside this helper's scope.
    """
    if descriptor.get('id') != 'deepseek' or not descriptor.get('installed'):
        raise ValueError("DeepSeek Harness 데스크톱 앱을 찾을 수 없습니다.")
    if descriptor.get('nativeProfile'):
        if restart:
            raise ValueError('다시 열기 전에 먼저 작업을 확인하고 이 독립적인 구성을 정상적으로 종료하십시오.')
        from bridge.clients.profile_process import launch_profile
        return launch_profile(descriptor)
    executable, home = descriptor.get('executable'), descriptor.get('dataDirectory')
    if not executable or not home or not Path(executable).is_file() or (Path(home).exists() and not Path(home).is_dir()):
        raise ValueError("DeepSeek Harness 앱 또는 데이터 디렉터리를 사용할 수 없습니다. 다시 스캔하세요.")
    app = DesktopApp(executable, home)
    running = bool(inspect_client(descriptor)['running'])
    if running:
        state = inspect_client(descriptor)
        running = state['running']
        if running and not state['mainPids']:
            raise ValueError("남은 Harness 백그라운드 프로세스가 발견되었으며 해당 작업을 확인할 수 없습니다. 컴퓨터에서 Harness를 종료한 후 다시 시도하십시오.")
        if state['unknown']:
            raise ValueError("여러 개의 또는 인식할 수 없는 Harness 인스턴스가 발견되었습니다. 다시 시도하기 전에 컴퓨터에서 확인하세요.")
    if running and not restart:
        return {'running': True, 'launched': False, 'restarted': False,
                'restartRequired': bool(descriptor.get('restartRequired'))}
    if running:
        stop_client(descriptor, state=state)
    working = app.home
    if sys.platform == 'darwin':
        if not any(p.suffix == '.app' for p in app.executable.parents):
            raise ValueError("DeepSeek Harness 실행 파일은 앱 번들 내에 있어야 합니다.")
    else:
        # Harness initializes its own profile; launch from an existing ancestor.
        working = next((p for p in [app.home, *app.home.parents] if p.is_dir()), Path.home())
    options = {'new_instance': True} if descriptor.get('excludeProfiles') else {}
    native_desktop(sys.platform).start(app.executable, working, {'DSH_HOME': str(app.home)}, **options)
    # GUI startup is asynchronous. Report observed process state, not a claim that
    # the adapter has connected or upstream authentication has succeeded.
    deadline = time.monotonic() + 2
    while not inspect_client(descriptor)['running']:
        if time.monotonic() >= deadline:
            return {'running': False, 'launched': True, 'restarted': running, 'restartRequired': False}
        time.sleep(.1)
    return {'running': True, 'launched': True, 'restarted': running, 'restartRequired': False}


def _app(descriptor):
    if descriptor.get('id') not in ('codex', 'claude', 'deepseek', 'zcode') or not descriptor.get('installed'):
        raise ValueError("구성된 데스크톱 앱을 찾을 수 없습니다. 다시 스캔하세요.")
    executable, home = descriptor.get('executable'), descriptor.get('dataDirectory')
    if not executable or not home or not Path(executable).is_file():
        raise ValueError("데스크톱 앱 또는 해당 데이터 디렉터리를 사용할 수 없습니다. 다시 스캔하세요.")
    return DesktopApp(executable, home)


def _commands(app, pids):
    """Read command metadata only for same-user, exact-executable processes."""
    if not pids:
        return {}
    return native_desktop(sys.platform).commands(pids)


def inspect_client(descriptor):
    app = _app(descriptor)
    pids = app.processes()
    commands = _commands(app, pids)
    return _process_state(descriptor, app, pids, commands)


def inspect_clients(descriptors):
    """Batch display state only; no snapshot is retained for a later operation."""
    apps = {}
    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            continue
        try:
            app = _app(descriptor)
        except (ValueError, OSError):
            continue
        apps[descriptor['id']] = (descriptor, app)
    if not apps:
        return {}
    inventory = process_inventory(app.executable for _, app in apps.values())
    return {provider: _process_state(descriptor, app, **inventory[app.executable])
            for provider, (descriptor, app) in apps.items()}


def _process_state(descriptor, app, pids, commands):
    import re
    from bridge.clients.profile_process import scope_processes
    pids, commands = scope_processes(descriptor, pids, commands)
    main, hosts = [], []
    unknown = any(not commands.get(pid) for pid in pids)
    for pid, command in commands.items():
        if (descriptor['id'] == 'deepseek' and sys.platform == 'win32' and
                re.search(r'(?:^|\s)--type(?:=|\s+)utility(?:$|\s)', command) and
                re.search(r'(?:^|\s)--utility-sub-type(?:=|\s+)node\.mojom\.NodeService(?:$|\s)', command)):
            # New DSH releases run the Host in Electron's Node utility process.
            # Its profile is passed over IPC, not on the command line. This is
            # only a candidate: quit still requires one Host, matching endpoint
            # PID and a complete idle snapshot from the selected profile.
            hosts.append(pid)
            continue
        if re.search(r'(?:^|\s)--type(?:=|\s)', command):
            continue  # Electron renderer/GPU/utility child, closed by its owner.
        if descriptor['id'] == 'deepseek' and '@deepseek-ai' in command and 'dsh-desktop-host' in command:
            profile = str(app.home/'profiles/desktop')
            # ps keeps spaces in arguments; require the whole expected path and
            # a path boundary rather than a substring of another user's profile.
            flags = re.IGNORECASE if sys.platform == 'win32' else 0
            if re.search(r'(?:^|[\s\"])'+re.escape(profile)+r'(?:$|[\s\"])', command, flags):
                hosts.append(pid)
            else:
                unknown = True
        elif (descriptor['id'] == 'zcode' and re.search(r'(?:^|\s)--(?:user-data-dir|profile)(?:[=\s]|$)', command)
              or '--expose-internals' in command or '--eval' in command or ' --run' in command):
            unknown = True
        else:
            main.append(pid)
    if sys.platform in ('linux', 'win32') and descriptor['id'] == 'zcode':
        if sys.platform == 'win32':
            from bridge.platforms.windows.zcode_pipe import main_processes
        else:
            from bridge.platforms.linux.zcode_pipe import main_processes
        main, ambiguous = main_processes(app.executable, main, commands)
        unknown = unknown or ambiguous
    if len(main) > 1 or len(hosts) > 1:
        unknown = True
    return {'running': bool(pids), 'pids': pids, 'mainPids': main,
            'runtimePids': hosts, 'unknown': unknown}


def stop_client(descriptor, *, state):
    if sys.platform == 'win32' and descriptor.get('id') == 'claude':
        return stop_claude(descriptor, state=state)
    # Revalidate process identities immediately before sending native quit.
    current = inspect_client(descriptor)
    if current['unknown'] or set(current['pids']) - set(state['pids']):
        raise ValueError("앱 프로세스가 변경되어 작업 상태를 확인할 수 없습니다. 닫기 전에 다시 확인하세요.")
    from bridge.clients.profile_process import require_owned
    require_owned(descriptor, current)
    app = _app(descriptor)
    app.stop(runtime_pids=current['runtimePids'], gui_pids=current['mainPids'], provider=descriptor.get('id'),
             selected_pids=current['pids'])


def force_stop_client(descriptor, *, state):
    """Explicit interruption; task evidence is bypassed, identity checks are not."""
    if descriptor.get('nativeProfile') or descriptor.get('excludeProfiles'):
        raise ValueError('다중 구성 클라이언트는 아직 독립 강제 종료를 확인하지 않았습니다. 일반 종료를 사용하십시오.')
    if sys.platform == 'win32':
        from bridge.platforms.windows.force_exit import force_stop_client as force
        return force(descriptor, state=state)
    import re
    from bridge.platforms.posix.force_exit import force_stop, CHANGED
    app = _app(descriptor)
    current = inspect_client(descriptor)
    if set(current['pids']) != set(state['pids']) or len(current['mainPids']) > 1:
        raise ValueError(CHANGED)
    commands = _commands(app, current['pids'])
    if set(commands) != set(current['pids']):
        raise ValueError(CHANGED)
    # Do not reuse the first inventory's profile classification. The command
    # passed to the native binder must itself still name this exact profile.
    classified = _process_state(descriptor, app, current['pids'], commands)
    if len(classified['mainPids']) > 1 or descriptor['id'] == 'zcode' and classified['unknown']:
        raise ValueError(CHANGED)
    for pid, command in commands.items():
        prefix = str(app.executable)
        if descriptor['id'] == 'zcode' and sys.platform == 'linux' and len(classified['mainPids']) == 1:
            # The main and host title replace argv; the classification above verified
            # the native worker's parent. The force binder pins every exact PID below.
            from bridge.platforms.linux.zcode_pipe import worker_title
            if pid in classified['mainPids'] and command == 'ZCode' or worker_title(command):
                continue
        if descriptor['id'] == 'zcode' and sys.platform == 'darwin' and command == app.executable.name:
            # Launch Services may expose just "ZCode" as argv[0]. The native
            # binder below independently verifies image, UID, birth and command.
            continue
        if command != prefix and not command.startswith(prefix + ' '):
            raise ValueError(CHANGED)
        arguments = command[len(prefix):]
        if re.search(r'(?:^|\s)(?:--(?:eval|print|run|user-data-dir|profile)|-[ep])(?:[=\s]|$)', arguments):
            raise ValueError(CHANGED)
        if '--expose-internals' in arguments:
            # Harness's packaged native Host is eligible only for this profile.
            if (descriptor['id'] != 'deepseek' or pid not in classified['runtimePids'] or
                    '/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js' not in arguments):
                raise ValueError(CHANGED)
        elif descriptor['id'] == 'deepseek' and 'dsh-desktop-host' in arguments and pid not in classified['runtimePids']:
            raise ValueError(CHANGED)
    force_stop(app.executable, commands)


def stop_claude(descriptor, *, state):
    """Invoke Claude's normal menu once, then observe its asynchronous cleanup."""
    from bridge.clients.claude.setup import native_action
    if descriptor.get('id') != 'claude':
        raise ValueError("이 종료 작업은 Claude 데스크톱에서만 사용할 수 있습니다.")
    changed = "Claude 프로세스가 변경되었습니다. 종료하기 전에 다시 확인하세요."
    current = inspect_client(descriptor)
    if not current['running']:
        return
    if (current.get('unknown') or set(current['pids']) - set(state['pids']) or
            len(current.get('mainPids', [])) != 1 or current['mainPids'] != state.get('mainPids')):
        raise ValueError(changed)
    app = _app(descriptor)
    from bridge.clients.profile_process import require_owned
    require_owned(descriptor, current)
    # The connection monitor's cancellation file must not cancel native quit.
    result = native_action('quit', pid=current['mainPids'][0], executable=str(app.executable))
    if result.get('quitState') not in ('submitted', 'exited'):
        raise ValueError(result.get('reason') or "Claude 작업을 처리하거나 컴퓨터에 프롬프트를 저장한 후 다시 시도하세요.")
    deadline = time.monotonic() + 75
    while remaining := inspect_client(descriptor)['pids']:
        if set(remaining) - set(current['pids']):
            raise ValueError(changed)
        if time.monotonic() >= deadline:
            raise ValueError("Claude가 종료되지 않았습니다. 작업을 처리하거나 컴퓨터에 프롬프트를 저장한 후 다시 시도하세요.")
        time.sleep(.25)


def stop_deepseek(descriptor, adapter, *, state):
    """Request DSH's native teardown; closing its window only hides the app."""
    import json
    from bridge.clients.deepseek.adapter import LIFECYCLE_REVISIONS
    if descriptor.get('id') != 'deepseek':
        raise ValueError("이 종료 작업은 Harness 데스크톱에서만 사용할 수 있습니다.")
    changed = "Harness 프로세스가 변경되었습니다. 종료하기 전에 다시 확인하세요."

    def verify():
        current = inspect_client(descriptor)
        if (current.get('unknown') or set(current['pids']) - set(state['pids']) or
                len(current.get('runtimePids', [])) != 1 or
                current['runtimePids'] != state.get('runtimePids')):
            raise ValueError(changed)
        return current

    current = verify()
    from bridge.clients.profile_process import require_owned
    require_owned(descriptor, current)
    status = adapter.call('status')
    if status.get('connected') is not True:
        raise ValueError("Harness 데스크탑이 연결되어 있지 않아 종료 상태를 확인할 수 없습니다.")
    try:
        endpoint = json.loads((adapter.directory/'endpoint.json').read_bytes())
        if (endpoint['pid'] != current['runtimePids'][0] or
                not isinstance(endpoint['generation'], str) or not endpoint['generation']):
            raise ValueError(changed)
    except (OSError, ValueError, KeyError, TypeError):
        raise ValueError(changed) from None
    app = _app(descriptor)
    command = None
    if status.get('nativeQuit') is not True:
        from bridge.platforms.windows.dsh_quit import installer_quit_command, send_installer_quit
        command = installer_quit_command(app, current, _commands(app, current['pids']))
        runtime = adapter.call('lifecycle')
        rows = runtime.get('sessions')
        if (runtime.get('bridgeRevision') not in LIFECYCLE_REVISIONS or runtime.get('complete') is not True or
                not isinstance(rows, list) or any(not isinstance(row, dict) or
                    row.get('runtimeKnown') is not True or row.get('status') not in ('idle', 'stopped', 'completed') or
                    row.get('requests') for row in rows)):
            raise ValueError("작업이 실행 중이거나 승인 대기 중이거나 상태를 알 수 없습니다. 종료하기 전에 컴퓨터를 확인하십시오.")
        try:
            if json.loads((adapter.directory/'endpoint.json').read_bytes()) != endpoint:
                raise ValueError(changed)
        except (OSError, ValueError):
            raise ValueError(changed) from None
    current = verify()
    if command is not None:
        send_installer_quit(command)
    else:
        result = adapter.call('quit', body={'expectedPid': endpoint['pid'],
                                          'expectedGeneration': endpoint['generation']})
        if (result.get('status') != 'accepted' or result.get('pid') != endpoint['pid'] or
                result.get('generation') != endpoint['generation']):
            raise ValueError("Harness가 종료 요청을 승인하지 않았습니다. 컴퓨터를 확인하고 다시 시도하세요.")
    deadline = time.monotonic() + 25
    while remaining := inspect_client(descriptor)['pids']:
        if set(remaining) - set(current['pids']):
            raise ValueError(changed)
        if time.monotonic() >= deadline:
            raise ValueError("Harness가 종료되지 않았습니다. 컴퓨터에서 프롬프트 종료를 처리하고 다시 시도하세요. 강제 종료된 프로세스가 없습니다.")
        time.sleep(.25)


def launch_client(descriptor, *, allow_native_relaunch=False):
    if descriptor.get('nativeProfile'):
        from bridge.clients.profile_process import launch_profile
        return launch_profile(descriptor, allow_native_relaunch=allow_native_relaunch)
    if descriptor.get('id') == 'deepseek':
        return launch_deepseek(descriptor)
    app = _app(descriptor)
    if inspect_client(descriptor)['running']:
        return {'running': True, 'launched': False}
    if descriptor['id'] == 'codex':
        app.start()
    elif descriptor['id'] == 'zcode':
        from bridge.clients.zcode.installation import launch
        launch(app.executable, app.home, debug_port=descriptor.get('debugFallbackPort'))
    else:
        # Claude owns its native profile selection, including third-party login.
        from bridge.clients.claude.setup import running_app
        if descriptor.get('excludeProfiles'):
            profile_running_app(descriptor)
        else:
            running_app(str(app.executable), str(app.home))
    deadline = time.monotonic() + 3
    while not inspect_client(descriptor)['running']:
        if time.monotonic() >= deadline:
            return {'running': False, 'launched': True}
        time.sleep(.1)
    return {'running': True, 'launched': True}


def profile_running_app(descriptor, restart=False, cancelled=None, allow_launch=True, *, allow_native_relaunch=False):
    """Reuse Claude initialization against one selected native main process."""
    from bridge.clients.profile_process import require_owned, launch_profile
    state = inspect_client(descriptor)
    if cancelled is not None and cancelled.is_set():
        raise ValueError("Claude 연결이 취소되었습니다.")
    if restart:
        raise ValueError('다시 연결하기 전에 먼저 작업을 확인하고 정상적으로 구성을 종료하십시오.')
    require_owned(descriptor, state, allow_native_relaunch=allow_native_relaunch, cancelled=cancelled)
    if not state['running']:
        if not allow_launch:
            raise ValueError('먼저 이것을 활성화해 주세요 Claude 구성 및 다시 연결')
        if descriptor.get('nativeProfile'):
            launch_profile(descriptor, cancelled=cancelled)
        else:
            app = _app(descriptor)
            # An independent instance may already be open. Launch Services must
            # start the default rather than activating that other instance.
            native_desktop(sys.platform).start(app.executable, app.home, {}, new_instance=True)
        deadline = time.monotonic()+20
        while not (state := inspect_client(descriptor))['running']:
            if cancelled is not None and cancelled.is_set():
                raise ValueError("Claude 연결이 취소되었습니다.")
            if time.monotonic() >= deadline:
                raise ValueError('Claude 아직 시작되지 않았습니다. 나중에 다시 시도해 주세요.')
            time.sleep(.2)
    if state.get('unknown') or len(state.get('mainPids', [])) != 1:
        raise ValueError('이를 확인할 수 없습니다 Claude 구성된 유일한 기본 프로세스')
    require_owned(descriptor, state)
    return state['mainPids'][0]
