'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const catalog=require('../shared/locales/messages.json');
test('native language sources preserve three complete packs and generated outputs',()=>{
  for(const platform of ['android','ios']){
    assert.ok(Object.keys(catalog[platform]).length>200);
    for(const [key,row] of Object.entries(catalog[platform])){
      assert.deepEqual(Object.keys(row).sort(),['en','ko','zh']);
      for(const value of Object.values(row))assert.equal(typeof value,'string',key);
      assert.doesNotMatch(row.ko,/보조 채팅|단말기|데스크탑/);
    }
  }
  const result=spawnSync(process.platform==='win32'?'python':'python3',['-B','scripts/generate-mobile-locales.py','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const project=fs.readFileSync(path.join(root,'mobile/ios/BridgePreview.xcodeproj/project.pbxproj'),'utf8');
  assert.match(project,/MobileLocaleData.swift in Sources/);assert.match(project,/MobileLocaleData.swift in Widget Sources/);
  const objectIds=Array.from(project.matchAll(/^\s*([A-F0-9]{24})(?: \/\*[^\n]*\*\/)? = \{\s*isa = /gm),match=>match[1]);
  assert.ok(objectIds.length>0);
  assert.equal(new Set(objectIds).size,objectIds.length,'Xcode object IDs must be unique');
});
test('Live Activity widget strings are translated by the iOS language catalog',()=>{
  const widget=fs.readFileSync(path.join(root,'mobile/ios/BridgeActivity/BridgeActivityWidget.swift'),'utf8');
  const keys=[...widget.matchAll(/context\.state\.text\(([^)]+)\)/g)]
    .flatMap(call=>Array.from(call[1].matchAll(/"([^"]+)"/g),match=>match[1]));
  assert.ok(keys.length>0);
  for(const key of keys) assert.ok(Object.hasOwn(catalog.ios,key),key);
});
test('Android locale table executes saved and OS languages without changing unknown user text',t=>{
  const java=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin','java'):'java',javac=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin','javac'):'javac';
  if(spawnSync(javac,['-version']).status!==0){t.skip('JDK required; covered by Android APK build');return;}
  fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});const folder=fs.mkdtempSync(path.join(root,'.tmp/native-locales-'));
  try{
    const source=path.join(root,'mobile/android/src/io/github/try2love/codexbridge/MobileLocaleData.java');
    fs.writeFileSync(path.join(folder,'LocaleProbe.java'),`package io.github.try2love.codexbridge;
import java.util.Locale;
public class LocaleProbe {
 public static void main(String[] args) {
  for(String language:new String[]{"ko-KR","en-US","zh-CN","zh-TW"}) {
   String expected=language.startsWith("ko")?"ko":language.startsWith("zh")?"zh":"en";
   if(!MobileLocaleData.normalize(language).equals(expected))throw new AssertionError(language);
   if(!MobileLocaleData.text("not a UI key: 사용자.txt",language).equals("not a UI key: 사용자.txt"))throw new AssertionError("user text");
  }
  Locale.setDefault(Locale.SIMPLIFIED_CHINESE);
  if(!MobileLocaleData.normalize(null).equals("zh"))throw new AssertionError("system locale");
  String key=MobileLocaleData.en.keySet().iterator().next();
  if(!MobileLocaleData.text(key,"zh").equals(MobileLocaleData.zh.get(key)))throw new AssertionError("Chinese table");
  if(!MobileLocaleData.text(key,"ko").equals(MobileLocaleData.ko.get(key)))throw new AssertionError("Korean table");
 }
}`);
    const compiled=spawnSync(javac,['-encoding','UTF-8','-d',folder,source,path.join(folder,'LocaleProbe.java')],{encoding:'utf8'});assert.equal(compiled.status,0,compiled.stderr);
    const executed=spawnSync(java,['-cp',folder,'io.github.try2love.codexbridge.LocaleProbe'],{encoding:'utf8'});assert.equal(executed.status,0,executed.stderr);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
