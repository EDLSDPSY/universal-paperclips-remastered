import openMPT from 'chiptune3/libopenmpt.worklet.js';
import {BasicMIDI,SoundBankLoader,SpessaSynthProcessor,SpessaSynthSequencer,SpessaLog} from 'spessasynth_core';
export {BasicMIDI,SoundBankLoader};
SpessaLog.setLogLevel(false,false,false);
let library;
export async function prepare(){return library ||= await openMPT();}
export class MusicRenderer {
 constructor(rate=44100){this.rate=rate;this.elapsed=0;}
 load(data,type,bank,loop=true){
  this.dispose();this.elapsed=0;this.type=type;
  if(type==='midi'){
   this.synth=new SpessaSynthProcessor(this.rate);this.synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bank),'gm');
   this.seq=new SpessaSynthSequencer(this.synth);this.seq.skipToFirstNoteOn=false;this.seq.loopCount=0;
   this.seq.loadNewSongList([BasicMIDI.fromArrayBuffer(data)]);this.seq.play();this.duration=this.seq.duration;
  }else{
   const m=library,p=m._malloc(data.byteLength);m.HEAPU8.set(new Uint8Array(data),p);
   this.mod=m._openmpt_module_create_from_memory(p,data.byteLength,0,0,0);m._free(p);
   if(!this.mod)throw Error('无法解析模块音乐');
   this.left=m._malloc(128*4);this.right=m._malloc(128*4);
   m._openmpt_module_set_repeat_count(this.mod,loop?-1:0);m._openmpt_module_set_render_param(this.mod,2,100);
   this.duration=m._openmpt_module_get_duration_seconds(this.mod);
  }
  return this.duration;
 }
 render(left,right){
  if(this.seq){this.seq.processTick();this.synth.process(left,right);}
  else if(this.mod){const m=library,n=m._openmpt_module_read_float_stereo(this.mod,this.rate,left.length,this.left,this.right);left.set(m.HEAPF32.subarray(this.left/4,this.left/4+n));right.set(m.HEAPF32.subarray(this.right/4,this.right/4+n));}
  this.elapsed+=left.length/this.rate;
 }
 seek(seconds){if(this.seq)this.seq.currentTime=seconds;else library._openmpt_module_set_position_seconds(this.mod,seconds);this.elapsed=seconds;}
 dispose(){if(this.mod){library._openmpt_module_destroy(this.mod);library._free(this.left);library._free(this.right);this.mod=0;}this.seq=null;this.synth=null;}
}
