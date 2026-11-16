// The official installer and this bundle use the same host.mjs source.
import {mkdir,readFile,writeFile,rename,lstat,realpath} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {apply as attach,inject as services} from './host.mjs';
const packageDirectory=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(join(packageDirectory,'package.json'),'utf8'));
const plugin={name:manifest.name,version:manifest.version,...manifest.dshBridge};

export const inject=[...services,'profileContext'];
async function privateFile(path){
  const info=await lstat(path);
  if(!info.isFile()||typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)))throw Error('Bridge 액세스 파일 권한이 안전하지 않습니다');
  return JSON.parse(await readFile(path,'utf8'));
}
async function save(path,value){
  const temp=path+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});
  await rename(temp,path);
}
export async function apply(ctx){
  const profile=ctx.profileContext;
  if(!profile?.name||!profile?.dir||!profile?.home)throw Error('이 Harness 코어 누락 profileContext，바인딩할 수 없습니다.');
  const profileDirectory=await realpath(profile.dir),home=await realpath(profile.home);
  const directory=join(profileDirectory,'codex-mobile-bridge');
  try{await mkdir(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
  await start(ctx,{directory,profileDirectory,home,profile:profile.name});
}
async function start(ctx,identity){
  const {directory}=identity,info=await lstat(directory);
  if(!info.isDirectory()||typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)))throw Error('Bridge 액세스 디렉터리 권한이 안전하지 않습니다.');
  const endpoint=join(directory,'endpoint.json'),configPath=join(directory,'connection.json');
  let previous;
  try{previous=await privateFile(endpoint);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous){
    if(!Number.isSafeInteger(previous.pid)||previous.pid<=0)throw Error('Bridge 잘못된 액세스 프로세스 ID');
    try{process.kill(previous.pid,0);throw Error('이 파일은 이미 존재합니다. Bridge 접속, 먼저 서신을 종료해 주세요 Harness 예');}catch(error){if(error.code!=='ESRCH')throw error;}
  }
  let connection;
  try{connection=await privateFile(configPath);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!connection){
    connection={token:randomBytes(32).toString('hex'),endpoint,instanceId:randomUUID()};
    await save(configPath,connection);
  }
  if(typeof connection.token!=='string'||connection.token.length!==64||connection.endpoint!==endpoint||typeof connection.instanceId!=='string')throw Error('Bridge 액세스 구성 불일치');
  const binding={protocol:1,...identity,instanceId:connection.instanceId,packageDirectory,plugin};
  await save(join(directory,'binding.json'),binding);
  await attach(ctx,{configPath,plugin});
}
