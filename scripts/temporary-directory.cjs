'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
module.exports=function(){
 const parent=path.resolve(os.tmpdir()),directory=fs.mkdtempSync(path.join(parent,'paperclips-'));
 return {directory,remove(){
  const relative=path.relative(parent,directory);
  if(path.isAbsolute(relative)||relative.startsWith('..')||!relative.startsWith('paperclips-'))throw Error('临时目录超出预期范围');
  fs.rmSync(directory,{recursive:true,force:true});
 }};
};
