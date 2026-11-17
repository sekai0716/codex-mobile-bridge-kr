'use strict';
const {dictionary,translateTo,normalizeLanguage}=require('../../web/shared/i18n.js');
// Only native-shell messages live here; all shared UI text comes from web/shared/i18n.js.
const english={...dictionary,
  '상태 불러오는 중':'Loading status','제어판 열기':'Open control panel',
  '게이트웨이 실행 중':'Gateway running','게이트웨이 중지됨':'Gateway stopped',
  '휴대폰 접속 주소 열기':'Open phone URL','휴대폰 접속 주소 복사':'Copy phone URL',
  '게이트웨이 중지 후 종료':'Stop gateway and quit',
  '제어판 종료(게이트웨이 유지)':'Quit control panel (keep gateway running)',
  '게이트웨이 작업 실패':'Gateway action failed'
};
function normalize(value){const language=normalizeLanguage(value,'en');return language==='ko'?'ko-KR':language==='zh'?'zh-CN':'en';}
function translate(text,language){
  const source=String(text).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
  return translateTo(source,normalize(language));
}
module.exports={normalize,translate,english};
