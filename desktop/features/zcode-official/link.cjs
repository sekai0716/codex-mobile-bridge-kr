'use strict';
const ORIGIN='https://zcode.z.ai';
function parseLink(value){
  let url;try{url=new URL(value);}catch{throw Error('붙여넣어주세요 ZCode 기존 App 공식 원격 제어 링크。');}
  if(url.origin!==ORIGIN||url.pathname!=='/remote/v4'||url.username||url.password||url.hash||
    [...url.searchParams.keys()].some(key=>!['sid','mid','name','app_version'].includes(key)||url.searchParams.getAll(key).length!==1))
    throw Error('이용해주세요 ZCode 기존 App 공식 원격 제어 링크 제공。');
  const sid=url.searchParams.get('sid'),mid=url.searchParams.get('mid');
  if([sid,mid].some(value=>!value||value.trim()!==value||Buffer.byteLength(value)>128))throw Error('공식 원격 제어 링크에 장치 정보가 부족합니다.。');
  return {url:url.href,sid,mid};
}
module.exports={ORIGIN,parseLink};
