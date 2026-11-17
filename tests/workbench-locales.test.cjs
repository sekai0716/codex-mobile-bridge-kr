'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadLanguagePacks}=require('./helpers/language-packs.cjs');
test('relabel retains Chinese UI keys through repeated language changes and preserves changed user text',()=>{
  const title={dataset:{i18n:'설정'},children:[],textContent:'설정'},file={dataset:{i18n:'단말기'},children:[],textContent:'user-file.txt'};
  const root=nodes=>({querySelectorAll:selector=>selector==='[data-i18n]'?nodes.filter(n=>n.dataset.i18n!==undefined):[]});
  const dialog=root([title,file]),empty=root([]),document={documentElement:{},querySelectorAll:selector=>selector==='.picker'?[dialog]:[]};
  const ui=loadLanguagePacks({document}),context=vm.createContext({BridgeI18n:ui,document,window:{}});
  vm.runInContext(fs.readFileSync('web/features/workspace/workbench.js','utf8'),context);
  const wb=Object.create(vm.runInContext('Workbench',context).prototype);Object.assign(wb,{strip:empty,panel:empty,sessions:new Map()});
  // 처음 재표시할 때 직접 바뀐 파일명은 번역 대상에서 빠져야 한다.
  wb.relabel();assert.equal(file.dataset.i18n,undefined);assert.equal(file.textContent,'user-file.txt');
  for(const [language,expected] of [['zh','设置'],['ko','설정'],['en','Settings'],['zh','设置'],['ko','설정']]){
    ui.setLanguage(language);ui.apply(dialog);wb.relabel();
    assert.equal(title.textContent,expected);assert.equal(title.dataset.i18n,'설정');assert.equal(file.textContent,'user-file.txt');
  }
});
