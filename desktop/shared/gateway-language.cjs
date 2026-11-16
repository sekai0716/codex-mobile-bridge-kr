'use strict';
const fs=require('node:fs'),path=require('node:path');
function publishLanguage(dataDir,language){
  if(!['en','ko-KR'].includes(language))throw Error('Unsupported language');
  fs.mkdirSync(dataDir,{recursive:true});
  const file=path.join(dataDir,'ui-language.json'),temporary=file+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify({language:language==='en'?'en':'ko'}),{mode:0o600});
  fs.renameSync(temporary,file);
}
module.exports={publishLanguage};
