import {MusicRenderer,prepare} from './renderer.mjs';
const ready=prepare();
class MusicProcessor extends AudioWorkletProcessor {
 constructor(){super();this.renderer=new MusicRenderer(sampleRate);this.active=false;this.alive=true;this.port.onmessage=async({data:d})=>{
  try{
   if(d.cmd==='load'){await ready;this.renderer.load(d.data,d.type,d.bank,d.loop);this.active=false;this.port.postMessage({cmd:'loaded'});}
   if(d.cmd==='start'){this.startAt=d.at;this.active=true;}
   if(d.cmd==='seek')this.renderer.seek(d.time);
   if(d.cmd==='pause')this.active=!d.value;
   if(d.cmd==='stop'){this.active=false;this.alive=false;this.renderer.dispose();}
  }catch(e){this.port.postMessage({cmd:'error',message:e.message});}
 };}
 process(inputs,outputs){if(this.active&&currentTime>=this.startAt){const [l,r]=outputs[0];this.renderer.render(l,r);}return this.alive;}
}
registerProcessor('paperclips-music',MusicProcessor);
