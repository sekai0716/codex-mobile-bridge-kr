'use strict';
const {dictionary,translateEnglish}=require('../../web/shared/i18n.js');
// Only native-shell messages live here; all shared UI text comes from web/shared/i18n.js.
const english={...dictionary,
  "상태 불러오는 중":'Loading status','제어판 열기':'Open control panel',
  "게이트웨이 실행 중":'Gateway running',"게이트웨이가 중지되었습니다.":'Gateway stopped',
  "전화 URL 열기":'Open phone URL',"전화 복사 URL":'Copy phone URL',
  '게이트웨이를 중지하고 종료합니다.':'Stop gateway and quit',
  "제어판 종료(게이트웨이 계속 실행)":'Quit control panel (keep gateway running)',
  "게이트웨이 작업 실패":'Gateway action failed'
};
function normalize(value){return typeof value==='string'&&/^en(?:-|$)/i.test(value)?'en':'ko-KR';}
function translate(text,language){
  const source=String(text).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
  return normalize(language)==='en'?(english[source]??translateEnglish(source)):source;
}
module.exports={normalize,translate,english};
