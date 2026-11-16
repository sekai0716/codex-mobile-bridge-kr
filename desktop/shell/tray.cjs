'use strict';

function primaryUrl(urls=[]){
  const usable=urls.filter(url=>{
    try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password;}
    catch{return false;}
  });
  return usable.find(url=>url.startsWith('https:'))||usable.find(url=>!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))||usable[0];
}

function createTray({Tray,Menu,icon,show,worker,open,copy,quit,onError,t=text=>text,setTimer=setTimeout,clearTimer=clearTimeout}){
  const tray=new Tray(icon);
  let snapshot,busy=false,refreshing=false,disposed=false,rendered,timer,revision=0;
  async function action(callback){
    if(busy||disposed)return;
    busy=true;render();
    try{await callback();}
    catch(error){onError(error);}
    finally{busy=false;await refresh();}
  }
  function render(){
    if(disposed)return;
    const running=Boolean(snapshot?.running),url=snapshot?.url;
    const status=!snapshot?'상태 불러오는 중':running?'게이트웨이 실행 중':snapshot.portOccupied?'사용 중인 포트':'게이트웨이 중지됨';
    const signature=JSON.stringify([running,url,status,busy]);
    if(signature===rendered)return;
    rendered=signature;
    tray.setToolTip(t('Codex 모바일 Bridge')+' · '+t(status));
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'제어판 열기',click:show},
      {label:status,enabled:false},
      {type:'separator'},
      {label:'휴대폰 접속 주소 열기',enabled:Boolean(url)&&!busy,click:()=>action(()=>open(url))},
      {label:'휴대폰 접속 주소 복사',enabled:Boolean(url)&&!busy,click:()=>action(()=>copy(url))},
      {type:'separator'},
      {label:'게이트웨이 중지 후 종료',enabled:running&&!busy,click:()=>action(async()=>{await worker('stop');quit();})},
      {label:'제어판 종료(게이트웨이 유지)',enabled:!busy,click:quit},
    ].map(item=>item.label?{...item,label:t(item.label)}:item)));
  }
  function observe(value){
    if(disposed)return;
    revision++;
    snapshot=value&&{running:value.runtime.running,portOccupied:value.runtime.portOccupied,
      url:value.runtime.running?primaryUrl(value.urls):null};
    render();
    if(timer!==undefined)clearTimer(timer);
    timer=setTimer(refresh,5000);
  }
  async function refresh(){
    if(refreshing||disposed)return;
    refreshing=true;
    const before=revision;
    try{const value=await worker('snapshot');if(before===revision)observe(value);}
    catch{if(before===revision)observe(undefined);}
    finally{refreshing=false;}
  }
  tray.on('double-click',show);
  render();
  refresh();
  return {refresh,observe,relabel(){rendered=undefined;render();},dispose(){disposed=true;if(timer!==undefined)clearTimer(timer);tray.destroy();}};
}

module.exports={createTray,primaryUrl};
