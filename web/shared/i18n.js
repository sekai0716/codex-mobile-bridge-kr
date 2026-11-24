'use strict';
// 문구는 언어팩에서 읽는다. 이 모듈은 등록된 UI 키의 선택과 표시만 담당한다.
const BridgeI18n=(()=>{
  const packs=typeof module!=='undefined'&&module.exports&&typeof require==='function'?{
    en:require('./locales/en.js'),'ko-KR':require('./locales/ko-KR.js'),
    'zh-CN':require('./locales/zh-CN.js'),legacy:require('./locales/legacy.js')
  }:globalThis.BridgeLanguagePacks;
  for(const name of ['en','ko-KR','zh-CN','legacy'])if(!packs?.[name])throw Error('Missing UI language pack: '+name);
  const en=packs.en,aliases=packs.legacy,translations={en,ko:packs['ko-KR'],zh:packs['zh-CN']};
  const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
  function normalizeLanguage(value,fallback='ko'){
    const language=typeof value==='string'?value.toLowerCase().replaceAll('_','-'):'';
    return /^ko(?:-|$)/.test(language)?'ko':/^zh(?:-|$)/.test(language)?'zh':/^en(?:-|$)/.test(language)?'en':fallback;
  }
  const systemLanguage=typeof document!=='undefined'&&typeof navigator!=='undefined'&&navigator.language?normalizeLanguage(navigator.language,'en'):'ko';
  let lang=systemLanguage;
  try{const stored=localStorage.getItem('bridge-language');if(stored)lang=normalizeLanguage(stored,systemLanguage);}catch{}
  // 기존 한국어 호출 키와 표시 문구도 인식해 이전 화면·캐시와의 호환성을 유지한다.
  const legacyEnglish=Object.fromEntries(Object.entries(aliases).map(([source,key])=>[source,en[key]]));
  const byText=Object.create(null),legacyByText=Object.create(null);
  for(const [name,table]of Object.entries(translations))for(const[key,value]of Object.entries(table)){
    if(typeof value==='string'&&!own(byText,value))byText[value]=key;
    if(name==='en'&&!own(legacyEnglish,key)&&!/[^\x00-\x7f]/.test(key))legacyEnglish[key]=value;
  }
  for(const[source,key]of Object.entries(aliases))for(const table of Object.values(translations)){
    const value=table[key];if(typeof value==='string'&&!own(legacyByText,value))legacyByText[value]=source;
  }
  function keyFor(source){return own(aliases,source)?aliases[source]:own(en,source)?source:own(byText,source)?byText[source]:undefined;}
  function format(key,language,values){
    let text=translations[language][key]??en[key]??key;
    for(const[name,value]of Object.entries(values))text=text.replaceAll('{'+name+'}',String(value));
    return text;
  }
  function dynamic(source,language){
    let match=/^macOS 종료 요청이 실패했습니다\. 클라이언트 상태를 확인하세요\.（quit: native-error; code: (-?\d+)）$/.exec(source)||/^macOS 退出请求失败，请检查客户端状态（quit: native-error; code: (-?\d+)）$/.exec(source);
    if(match)return format('The macOS quit request failed. Check the client status (quit: native-error; code: {code}).',language,{code:match[1]});
    match=/^파일이 초과되었습니다. (\d+) MB 다운로드 제한$/.exec(source)||/^文件超过 (\d+) MB 下载限制$/.exec(source);
    if(match)return format('The file exceeds the {size} MiB click-to-download limit.',language,{size:match[1]});
    match=/^일부 채널에서 전송하지 못했습니다.：(.+)；다른 채널에서 수신 여부를 휴대폰에서 확인해주세요.。$/.exec(source)||/^部分通道发送失败：(.+)；请在手机确认其他通道是否收到。$/.exec(source);
    if(match)return format('Some channels failed: {channels}. Check your phone for messages from the other channels.',language,{channels:match[1]});
    match=/^(Feishu|DingTalk|飞书|钉钉)(?:는|가)? ?(?:알림을 수락하지 않았습니다\.|未接受通知)（(-?\d+)：([^）]+)）$/.exec(source);
    if(match)return format('{provider} did not accept the notification ({code}: {reason}).',language,{provider:({'飞书':'Feishu','钉钉':'DingTalk'})[match[1]]||match[1],code:match[2],reason:translateTo(match[3],language)});
    match=/^(Feishu|DingTalk|Discord|Telegram|飞书|钉钉)\s*(응답 형식이 잘못되었습니다\.|알림이 수락되지 않았습니다\. 주소와 네트워크를 확인하세요\.|알림이 수락되지 않음（HTTP (\d+)）|响应格式不正确|未接受通知，请检查地址和网络|未接受通知（HTTP (\d+)）)$/.exec(source);
    if(match){const provider=({'飞书':'Feishu','钉钉':'DingTalk'})[match[1]]||match[1],http=match[3]||match[4];return format(http?'{provider} did not accept the notification (HTTP {code}).':/^(?:응답|响应)/.test(match[2])?'Invalid response from {provider}.':'{provider} did not accept the notification. Check the endpoint and network.',language,{provider,code:http});}
    match=/^当前 Antigravity 原生环境暂未提供 \/(\S+) (指令|模式)$/.exec(source);
    if(match)return format(match[2]==='模式'?'当前 Antigravity 原生环境暂未提供 /{name} 模式':'当前 Antigravity 原生环境暂未提供 /{name} 指令',language,{name:match[1]});
    return source;
  }
  function translateTo(value,language){
    if(typeof value!=='string'||value==='')return value;
    language=normalizeLanguage(language,lang);
    const text=value.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
    const key=keyFor(text);return key===undefined?dynamic(text,language):(translations[language][key]??en[key]??text);
  }
  function t(source){return translateTo(source,lang);}
  function apply(root=document){
    document.documentElement.lang=lang==='ko'?'ko-KR':lang==='zh'?'zh-CN':'en';
    root.querySelectorAll('[data-i18n]').forEach(node=>{const value=t(node.dataset.i18n);if(node.children?.length){const text=[...node.childNodes].find(n=>n.nodeType===3);if(text)text.textContent=value;}else node.textContent=value;});
    for(const attr of ['placeholder','aria-label','title'])root.querySelectorAll('[data-i18n-'+attr+']').forEach(node=>node.setAttribute(attr,t(node.getAttribute('data-i18n-'+attr))));
    document.querySelectorAll('[data-language]').forEach(node=>node.value=lang);
  }
  function setLanguage(value){
    lang=normalizeLanguage(value,systemLanguage);try{localStorage.setItem('bridge-language',lang);}catch{}
    if(typeof document!=='undefined'&&typeof CustomEvent!=='undefined')document.dispatchEvent(new CustomEvent('bridge-language',{detail:lang}));
  }
  function source(text){return own(aliases,text)||own(en,text)?text:own(legacyByText,text)?legacyByText[text]:keyFor(text);}
  return {t,translateTo,translateEnglish:text=>translateTo(text,'en'),translateKorean:text=>translateTo(text,'ko'),normalizeLanguage,
    apply,setLanguage,source,language:()=>lang,locale:()=>lang==='en'?'en-US':lang==='zh'?'zh-CN':'ko-KR',
    dictionary:{...legacyEnglish,...en},canonicalDictionary:en,packs:translations};
})();
if(typeof module!=='undefined')module.exports=BridgeI18n;
