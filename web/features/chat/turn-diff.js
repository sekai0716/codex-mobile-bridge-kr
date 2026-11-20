'use strict';

// 청크 경계에서 긴 줄이 잘려도 같은 코드 줄에 이어 붙이고 줄 번호는 한 번만 센다.
function appendTurnDiff(view, cursor, text, next, review) {
  const fragment=document.createDocumentFragment(), lines=text.split('\n');
  for(const [index,part] of lines.entries()){
    const last=index===lines.length-1;
    if(last&&!part)break;
    if(!cursor.partial){
      const line=document.createElement('div'),number=document.createElement('span'),code=document.createElement('code');
      line.className='wb-diff-line meta';number.className='wb-diff-number';number.setAttribute('aria-hidden','true');
      line.append(number,code);fragment.append(line);cursor.partial={line,number,code};
    }
    const {line,number,code}=cursor.partial;
    code.append(document.createTextNode(part));
    if(!last||next===null){
      const value=code.textContent;
      const hunk=value.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      let type='meta',location='';
      if(hunk){cursor.old=Number(hunk[1]);cursor.new=Number(hunk[2]);cursor.hunk=true;type='hunk';}
      else if(value.startsWith('diff --git ')){cursor.hunk=false;cursor.headers=true;}
      else if(!cursor.hunk&&(value.startsWith('--- ')||value.startsWith('+++ '))){cursor.headers=true;}
      else if(cursor.hunk||!cursor.headers){
        if(value.startsWith('+')){type='added';if(cursor.hunk)location=cursor.new++;}
        else if(value.startsWith('-')){type='removed';if(cursor.hunk)location=cursor.old++;}
        else if(cursor.hunk&&value.startsWith(' ')){type='context';cursor.old++;location=cursor.new++;}
      }
      line.className='wb-diff-line '+type;number.textContent=location;
      if(location&&review){
        const button=document.createElement('button');button.type='button';button.className='wb-diff-number';
        button.textContent=location;button.setAttribute('aria-label',timelineText('Comment on line')+' '+location);
        button.onclick=()=>review({line:location,side:type==='removed'?'old':'new',text:value});
        number.replaceWith(button);
      }
      cursor.partial=null;
    }
  }
  view.append(fragment);
}

// 한 파일이면 카드 자체를 펼쳐 diff를 읽고, 여러 파일이면 선택한 파일만 읽는다.
function renderTurnDiffFile(timeline,row,file,index,card){
  const item=document.createElement('li'),single=row.fileSummary.files.length===1;
  const disclosure=single?card:document.createElement('details');
  const heading=document.createElement(single?'div':'summary'),path=document.createElement('span'),counts=document.createElement('span');
  item.className='turn-diff-file';heading.className='turn-diff-heading';path.className='edited-files-path';path.textContent=file.path;
  heading.append(path);
  if(!single){
    counts.className='edited-files-stats';
    for(const [kind,text] of [['added','+'+file.added],['removed','−'+file.removed]]){
      const count=document.createElement('span');count.className='edited-files-'+kind;count.textContent=text;counts.append(count);
    }
    heading.append(counts);item.append(disclosure);
  }
  const body=single?item:disclosure;body.append(heading);
  const uiButton=(label,action)=>{
    const button=document.createElement('button');button.type='button';button.className='plain turn-diff-action';
    button.dataset.i18n=label;button.textContent=timelineText(label);button.onclick=action;return button;
  };
  if(timeline.onFile)body.append(uiButton('Open file',()=>timeline.onFile(file.path)));
  if(!file.hasDiff){
    const empty=document.createElement('p');empty.className='muted';empty.dataset.i18n='No diff available';
    empty.textContent=timelineText(empty.dataset.i18n);body.append(empty);return item;
  }
  const view=document.createElement('div');view.className='turn-diff-lines';view.tabIndex=0;
  const notice=document.createElement('span');notice.className='muted';notice.setAttribute('role','status');
  const more=uiButton('Load more diff',()=>load());more.hidden=true;body.append(view,notice,more);
  let offset=0,loading=false,failed=false;const cursor={};
  const load=async()=>{
    if(loading||offset===null||timeline.abort.signal.aborted||!disclosure.open)return;
    loading=true;more.disabled=true;notice.textContent=timelineText('로드 중…');
    try{
      const data=await timeline.read('detail',{key:timeline.epoch+'.'+row.key,version:row.version,file:index,offset});
      if(timeline.abort.signal.aborted||!card.isConnected||timeline.rows.get(row.key)?.row.version!==row.version)return;
      if(data.key!==row.key||data.version!==row.version||data.fileIndex!==index||data.offset!==offset||
         typeof data.text!=='string'||(data.next!==null&&(!Number.isInteger(data.next)||data.next<=offset)))
        throw Error(timelineText('메시지가 변경되었습니다. 다시 열어보세요.'));
      const review=timeline.onReviewLine&&((selection)=>timeline.onReviewLine({...selection,path:file.path,revision:timelineText('Recorded edit')+' · '+(row.turnId||row.key)+' · '+row.version}));
      appendTurnDiff(view,cursor,data.text,data.next,review);offset=data.next;failed=false;
      notice.textContent='';more.hidden=offset===null;more.dataset.i18n='Load more diff';
    }catch(error){
      if(timeline.abort.signal.aborted)return;
      failed=true;notice.textContent=error.message;more.hidden=false;more.dataset.i18n='다시 시도';
    }finally{loading=false;more.disabled=false;more.textContent=timelineText(more.dataset.i18n);}
  };
  disclosure.addEventListener('toggle',()=>{if(disclosure.open&&(offset===0||failed))load();});
  return item;
}
