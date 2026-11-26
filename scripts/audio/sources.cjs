const fs=require('node:fs');
const path=require('node:path');

const musicDir=path.resolve(__dirname,'../../../bgm');
const playlist=path.join(musicDir,'曲目.cjs');

function musicFiles(){
 if(!fs.existsSync(playlist))return [];
 return fs.readdirSync(musicDir,{withFileTypes:true})
  .filter(item=>!item.isDirectory()&&/\.(mid|midi|mp3|xm|it|mod|s3m)$/i.test(item.name)).map(item=>item.name);
}

module.exports={musicDir,playlist,musicFiles};
