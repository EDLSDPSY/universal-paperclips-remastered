import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import sources from './sources.cjs';
const require=createRequire(import.meta.url);
const ffmpeg=process.env.PAPERCLIPS_FFMPEG||require('ffmpeg-static');
const temporary=require('../temporary-directory.cjs');
const {MusicRenderer,prepare,BasicMIDI,SoundBankLoader}=await import('./renderer.mjs');
export {BasicMIDI,SoundBankLoader};
const root=path.resolve(import.meta.dirname,'../..');
export const {musicDir}=sources;
export const cache=process.env.PAPERCLIPS_AUDIO_CACHE||path.join(root,'.cache','audio');
export const buffer=file=>Uint8Array.from(fs.readFileSync(file)).buffer;
export function runAudio(args){
 const result=spawnSync(ffmpeg,['-hide_banner','-nostdin','-y',...args],{encoding:'utf8',maxBuffer:4e6,windowsHide:true});
 if(result.error)throw result.error;if(result.status!==0)throw Error(result.stderr);return result.stderr;
}
// 一次只把一首曲目解码到临时文件里，用完就删。
export async function withRenderedTrack(track,bankData,consume){
 const temp=temporary(),raw=path.join(temp.directory,'audio.f32'),file=path.join(musicDir,track.file);
 const type=/\.mp3$/i.test(track.file)?'mp3':/\.midi?$/i.test(track.file)?'midi':'module';
 let duration,loop=null,renderer;
 try{
  if(type==='mp3'){
   runAudio(['-i',file,'-f','f32le','-ac','2','-ar','44100',raw]);duration=fs.statSync(raw).size/8/44100;
  }else{
   const m=await prepare();renderer=new MusicRenderer();duration=renderer.load(buffer(file),type,bankData,track.loop!==false);
   if(type==='module'){
    const restart=m._openmpt_module_get_restart_order(renderer.mod,0),start=m._openmpt_module_get_time_at_position(renderer.mod,restart,0);
    if(track.loop!==false)loop={start:Math.max(0,start),end:duration};else duration+=1;
   }else duration+=track.tail??5;
   const fd=fs.openSync(raw,'w'),chunk=new Float32Array(16384*2),left=new Float32Array(128),right=new Float32Array(128);
   try{
    const frames=Math.ceil(duration*44100);let at=0;
    while(at<frames){
     const count=Math.min(16384,frames-at);chunk.fill(0);
     for(let i=0;i<count;i+=128){left.fill(0);right.fill(0);renderer.render(left,right);for(let j=0;j<Math.min(128,count-i);j++){chunk[(i+j)*2]=left[j];chunk[(i+j)*2+1]=right[j];}}
     fs.writeSync(fd,Buffer.from(chunk.buffer,0,count*8));at+=count;
    }
   }finally{fs.closeSync(fd);}
  }
  return await consume({raw,type,duration,loop});
 }finally{try{renderer?.dispose();}finally{temp.remove();}}
}
