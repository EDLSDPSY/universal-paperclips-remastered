'use strict';
const fs=require('node:fs');

// 从末尾往前找最后一处有声的采样，只裁掉尾部静音。
module.exports=function audibleDuration(file,{thresholdDb=-90,keep=.15,min=.5}={}){
 const rate=44100,frames=fs.statSync(file).size/8,original=frames/rate,threshold=10**(thresholdDb/20);
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(8192*8);
 try{
  for(let end=frames;end>0;){
   const start=Math.max(0,end-8192),count=end-start;fs.readSync(fd,buffer,0,count*8,start*8);
   const pcm=new Float32Array(buffer.buffer,buffer.byteOffset,count*2);
   for(let i=count-1;i>=0;i--)if(Math.abs(pcm[2*i])>threshold||Math.abs(pcm[2*i+1])>threshold){
    const last=(start+i+1)/rate;return original-last>=min?Math.min(original,last+keep):original;
   }
   end=start;
  }
  return Math.min(original,keep);
 }finally{fs.closeSync(fd);}
};
