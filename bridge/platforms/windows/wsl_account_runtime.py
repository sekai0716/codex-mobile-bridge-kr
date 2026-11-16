"""Verified WSL managed-daemon inspection and bounded graceful account handoff."""
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from bridge.platforms.windows import wsl
from bridge.resources import source_text


_RUNTIME_SOURCE = r'''
import hashlib,select,signal,time
root=Path(request['home']).resolve()
def inspect():
    rows=[]; blockers=[]; helpers=[]
    boot_id=Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    if not boot_id: raise ValueError('WSL 커널 부팅 코드를 확인할 수 없습니다.')
    unix={}
    for line in Path('/proc/net/unix').read_text().splitlines()[1:]:
        f=line.split()
        if len(f)==8 and f[3]=='00010000': unix[f[6]]=f[7]
    for p in Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            if p.stat().st_uid!=uid: continue
            args=(p/'cmdline').read_bytes().split(b'\0')
            if not any(Path(os.fsdecode(a)).name in ('codex','codex.js') or b'/@openai/codex/' in a for a in args[:3] if a): continue
            exe=os.readlink(p/'exe')
            env=dict(s.split(b'=',1) for s in (p/'environ').read_bytes().split(b'\0') if b'=' in s)
            selected=Path(os.fsdecode(env.get(b'CODEX_HOME',os.fsencode(Path(os.fsdecode(env.get(b'HOME',os.fsencode(home))))/'.codex'))))
            if not selected.is_absolute(): raise ValueError('WSL Codex 구성 디렉터리를 확인할 수 없습니다.')
            if selected.resolve()!=root: continue
            expected_helper=next((item for item in (request.get('daemon') or {}).get('updaters',[]) if item['pid']==int(p.name)),None)
            helper=codex_updater(p,exe,args,env,root,expected_helper)
            if helper:
                helpers.append(helper); continue
            if (not exe.startswith('/') or exe.startswith('/mnt/') or exe.endswith('.exe') or
                    Path(exe).name!='codex' or b'app-server' not in args or b'--managed-daemon' not in args):
                blockers.append('이 WSL 구성은 독립적으로 유지됩니다. Codex 클라이언트님께서는 먼저 원래 단말기에서 정상적으로 종료해 주시기 바랍니다.'); continue
            if any(a in (b'-c',b'--config',b'--profile',b'-p') for a in args):
                blockers.append('WSL 공유 서비스에는 시작 재정의가 포함되며 원래 설정을 유지할 수 없습니다.'); continue
            if any(env.get(name) for name in (b'OPENAI_API_KEY',b'OPENAI_BASE_URL',b'CODEX_API_KEY')):
                blockers.append('WSL 공유 서비스 환경 커버리지 인증은 원래 단말기에서 먼저 처리해 주세요'); continue
            sockets=[]
            for fd in (p/'fd').iterdir():
                try: target=os.readlink(fd)
                except FileNotFoundError: continue
                path=unix.get(target[8:-1]) if target.startswith('socket:[') else None
                if not path: continue
                sock=Path(path); st=sock.lstat(); parent=sock.parent.lstat()
                if (not stat.S_ISSOCK(st.st_mode) or st.st_uid!=uid or st.st_mode&0o077 or
                        sock.parent!=Path('/tmp/codex-daemon-'+str(uid)) or
                        not stat.S_ISDIR(parent.st_mode) or parent.st_uid!=uid or parent.st_mode&0o022):
                    raise ValueError('WSL 공유 서비스 소켓 소유권을 확인할 수 없습니다.')
                sockets.append({'socket':path,'socketDevice':st.st_dev,'socketInode':st.st_ino})
            if len(sockets)!=1: raise ValueError('WSL 공유 서비스 제어 채널을 고유하게 확인할 수 없습니다.')
            binary=Path(exe).stat()
            rows.append({'pid':int(p.name),'startTicks':(p/'stat').read_text().rsplit(')',1)[1].split()[19],'bootId':boot_id,
                         'executable':exe,'executableDevice':binary.st_dev,'executableInode':binary.st_ino,
                         'user':user,'uid':uid,'home':str(root),'cwd':os.readlink(p/'cwd'),
                         'commandIdentity':hashlib.sha256((p/'cmdline').read_bytes()).hexdigest(),**sockets[0]})
        except FileNotFoundError:
            if p.exists(): blockers.append('WSL Codex 읽는 동안 프로세스 ID가 변경되며 계정을 일시적으로 전환할 수 없습니다.')
        except ValueError as error:
            blockers.append(str(error))
        except OSError:
            blockers.append('완전히 확인할 수 없습니다. WSL Codex 프로세스 또는 제어 채널')
    if len(rows)>1: blockers.append('이 구성에는 여러 공유 서비스가 있으며 전체 소유권을 확인할 수 없습니다. 먼저 원래 단말기에서 처리해 주세요')
    for row in rows:
        row['updaters']=[item for item in helpers if (item['executableDevice'],item['executableInode'])==(row['executableDevice'],row['executableInode'])]
    if rows and any(not any(item in row['updaters'] for row in rows) for item in helpers):
        blockers.append('WSL 업데이트 프로그램이 공유 서비스의 기본 ID와 일치하지 않습니다.')
    return {'daemons':rows,'blockers':list(dict.fromkeys(blockers))}
action=request['action']
if action=='inspect':
    result=inspect()
elif action=='stop':
    expected=request['daemon']; found=inspect()
    if found['blockers'] or found['daemons']!=[expected]: raise ValueError('WSL 공유 서비스 ID 또는 작업 항목이 변경되었으며, 계정이 아직 전환되지 않았습니다.')
    if not hasattr(os,'pidfd_open') or not hasattr(signal,'pidfd_send_signal'): raise ValueError('이 WSL 커널은 안전한 프로세스 ID 종료를 지원하지 않습니다.')
    descriptor=os.pidfd_open(expected['pid'],0)
    try:
        found=inspect()
        if found['blockers'] or found['daemons']!=[expected]: raise ValueError('WSL 공유 서비스 ID가 변경되었으며 아직 계정이 전환되지 않았습니다.')
        signal.pidfd_send_signal(descriptor,signal.SIGTERM,None,0)
        signal_sent=True
        ready,_,_=select.select([descriptor],[],[],8)
        if not ready: raise ValueError('WSL 공유 서비스가 정상적으로 종료되지 않았습니다. 강제 종료되지 않았으며 계정이 전환되지 않았습니다.')
    finally: os.close(descriptor)
    found=inspect()
    if found['blockers'] or found['daemons']: raise ValueError('WSL 원래 서비스나 다른 클라이언트가 계속 실행 중이고 계정이 아직 전환되지 않았습니다.')
    result={'stopped':True}
elif action=='start':
    expected=request['daemon']; found=inspect()
    if expected.get('bootId')!=Path('/proc/sys/kernel/random/boot_id').read_text().strip():
        raise ValueError('WSL 커널 부팅 코드가 변경되었습니다. 원래 단말기에서 공유 서비스를 확인해주세요.')
    if found['blockers']: raise ValueError(found['blockers'][0])
    if found['daemons']:
        if request.get('terminationRequested') and any(all(row.get(key)==expected.get(key) for key in ('pid','startTicks','bootId')) for row in found['daemons']):
            raise ValueError('기존 WSL 공유 서비스가 정상적으로 종료되지 않았습니다. 종료 신호가 다시 전송되지 않습니다')
        if any(row['executable']!=expected['executable'] for row in found['daemons']): raise ValueError('WSL 공유 서비스 실행 파일이 변경되었습니다.')
    else:
        binary=Path(expected['executable']).stat()
        if (binary.st_dev,binary.st_ino)!=(expected['executableDevice'],expected['executableInode']): raise ValueError('기존 WSL Codex 프로그램 ID가 변경되었습니다.')
        environment=os.environ.copy(); environment['CODEX_HOME']=str(root)
        if any(environment.get(key) for key in ('OPENAI_API_KEY','OPENAI_BASE_URL','CODEX_API_KEY')): raise ValueError('WSL 환경보장인증, 공유서비스 미복원')
        completed=subprocess.run([expected['executable'],'app-server','daemon','start'],env=environment,
            cwd=expected['cwd'],capture_output=True,timeout=20)
        if completed.returncode: raise ValueError('기존 WSL 공유 서비스가 정상적으로 시작되지 않았습니다. 원래 단말기를 확인해주세요.')
        found=inspect()
    if found['blockers'] or len(found['daemons'])!=1: raise ValueError('WSL 공유 서비스가 시작된 후 소유권이 확인되지 않았습니다.')
    actual=found['daemons'][0]
    if (actual['executableDevice'],actual['executableInode'])!=(expected['executableDevice'],expected['executableInode']):
        raise ValueError('WSL 공유 서비스를 다시 시작한 후 네이티브 프로그램의 ID가 변경되었습니다.')
    result={'started':True,'daemon':found['daemons'][0]}
else: raise ValueError('WSL 잘못된 수명 주기 작업')
'''


def _source():
    return source_text('platforms/codex_process_identity.py')+'\n'+_RUNTIME_SOURCE


def _call(distribution, user, home, action, daemon=None, termination_requested=False):
    request = {'home': home, 'action': action, 'daemon': daemon, 'terminationRequested': termination_requested}
    source = 'import json,os,pwd,stat,subprocess\nfrom pathlib import Path\nuid=os.getuid(); user=pwd.getpwuid(uid).pw_name; home=Path.home()\n'
    source += 'request=' + repr(request) + '\nsignal_sent=False\n'
    source += 'try:\n exec(' + repr(_source()) + ')\n print(json.dumps({"ok":True,"value":result}))\nexcept Exception as error:\n print(json.dumps({"ok":False,"error":str(error),"signalSent":signal_sent}))\n'
    result = wsl.read(distribution, source, user, timeout=30, allow_start=False)
    if not isinstance(result, dict) or not result.get('ok'):
        if action == 'stop':
            raise HandoffError(result.get('error') if isinstance(result, dict) else 'WSL 종료 결과가 아직 확인되지 않았습니다.',
                               result.get('signalSent') if isinstance(result, dict) else None)
        raise ValueError(result.get('error') if isinstance(result, dict) else 'WSL 공유 서비스 상태를 확인할 수 없습니다.')
    return result['value']


class HandoffError(ValueError):
    def __init__(self, message, signal_sent=None):
        super().__init__(message)
        self.signal_sent = signal_sent


def inspect(distribution, user, home):
    return _call(distribution, user, home, 'inspect')


def stop(distribution, user, home, daemon):
    return _call(distribution, user, home, 'stop', daemon)


def start(distribution, user, home, daemon, termination_requested=False):
    return _call(distribution, user, home, 'start', daemon, termination_requested)


class OperationLock:
    """Hold Codex's native operation flock across stop and credential commit."""
    def __init__(self, distribution, user, home):
        self.distribution, self.user, self.home = distribution, user, home
        self.process = None

    def acquire(self):
        source = 'import os,sys,json,fcntl,stat\nfrom pathlib import Path\nroot=Path('+repr(self.home)+')/"app-server-daemon"\n'
        source += '''try:
 if root.is_symlink() or root.stat().st_uid!=os.getuid() or root.stat().st_mode&0o022: raise ValueError('WSL 기본 라이프사이클 잠금 디렉토리 소유권이 잘못되었습니다.')
 path=root/'daemon.lock'
 fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW)
 info=os.fstat(fd)
 if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o022: raise ValueError('WSL 기본 라이프사이클 잠금 소유권이 잘못되었습니다.')
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 print(json.dumps({'locked':True}),flush=True)
 sys.stdin.buffer.read()
except Exception:
 print(json.dumps({'locked':False}),flush=True)
'''
        command = wsl.command(self.distribution, self.user)
        self.process = subprocess.Popen(command+['-u', '-c', source], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **wsl._options())
        pool = ThreadPoolExecutor(max_workers=1)
        future = pool.submit(self.process.stdout.readline)
        try:
            result = json.loads(future.result(timeout=6))
            if result.get('locked') is not True:
                raise ValueError("또 다른 라이프사이클 작업은 원래 WSL 공유 서비스를 사용하는 것입니다. 잠시 후 다시 시도하세요.")
        except (OSError, ValueError, TimeoutError) as error:
            self.release()
            raise ValueError("원래 WSL 공유 서비스 라이프사이클 잠금을 획득할 수 없습니다. 계정이 전환되지 않았습니다.") from error
        finally:
            pool.shutdown(wait=False)

    def release(self):
        if self.process is not None:
            process, self.process = self.process, None
            process.stdin.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired as error:
                raise ValueError("WSL 수명 주기 잠금 해제가 확인되지 않았습니다.") from error
            finally:
                process.stdout.close()
