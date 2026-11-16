'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');
const start=source.indexOf("ipcMain.handle('bridge:open',async(event,target)=>{"),end=source.indexOf('\n  });',start);
assert.ok(start>=0&&end>start,'실제 데스크톱 IPC 핸들러를 검사해야 합니다.');
const handlerSource=source.slice(start,end+'\n  });'.length);
const names=['첫 로그인.txt','\u9996\u6b21\u767b\u5f55.txt'];

function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cmb-credentials-paths-')),opened=[];let handler,authorized=0;
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  vm.runInNewContext(handlerSource,{path,dataDir:directory,fs:{statSync(file){assert.equal(path.dirname(file),directory);return fs.statSync(file);}},
    ipcMain:{handle(name,value){assert.equal(name,'bridge:open');handler=value;}},authorize(){authorized++;},shell:{openPath(file){opened.push(file);return '';}}});
  return {files:names.map(name=>path.join(directory,name)),opened,open:async()=>{await handler({},'credentials');assert.equal(authorized,1);return opened[0];}};
}

test('initial credentials open the existing legacy basename',async t=>{
  const f=fixture(t);fs.writeFileSync(f.files[1],'synthetic legacy credentials');
  assert.equal(await f.open(),f.files[1]);
});

test('new Korean credentials take priority when both regular files exist',async t=>{
  const f=fixture(t);for(const file of f.files)fs.writeFileSync(file,'synthetic credentials');
  assert.equal(await f.open(),f.files[0]);
});

test('a directory with the new basename does not hide a legacy regular file',async t=>{
  const f=fixture(t);fs.mkdirSync(f.files[0]);fs.writeFileSync(f.files[1],'synthetic legacy credentials');
  assert.equal(await f.open(),f.files[1]);
});

test('missing credentials retain the new-file default path',async t=>{
  const f=fixture(t);assert.equal(await f.open(),f.files[0]);
});
