'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function loadLanguagePacks(extra={}){
  const context=vm.createContext({module:{exports:{}},localStorage:{getItem(){return null;},setItem(){}},...extra});
  for(const name of ['en','ko-KR','zh-CN','legacy'])vm.runInContext(fs.readFileSync(path.join(root,'web/shared/locales',name+'.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'web/shared/i18n.js'),'utf8'),context);
  return context.module.exports;
}
module.exports={loadLanguagePacks};
