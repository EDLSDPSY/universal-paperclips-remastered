const TRANSITION_SOUND={attack:.2,release:.35};
function createTransitionSound(context,output){
 const buffers=new Map(),voices=new Set();
 function bufferFor(kind,duration){
  const key=kind+':'+duration;if(buffers.has(key))return buffers.get(key);
  const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),data=buffer.getChannelData(0);
  let seed=834721,low=0,band=0,phase=0;
  for(let i=0;i<data.length;i++){
   const t=i/rate,u=t/duration;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const noise=(seed>>>0)/2147483648-1;
   low+=.045*(noise-low);band+=.5*(noise-band);
   const attack=Math.min(1,t/.008),release=Math.min(1,(duration-t)/.025);
   if(kind==='fracture'){
    const beat=Math.floor(u*14),pulse=.35+.65*Math.sin((beat+3)*23.17)**2,rough=.55+.45*Math.sin(t*2*Math.PI*(74+beat*13))**2;
    phase+=2*Math.PI*(1850-1150*u)/rate;
    data[i]=attack*release*(.19*(band-low)*pulse*rough+.018*Math.sin(phase)*(1-u)+.05*low);
   }else{
    phase=2*Math.PI*100*t;
    const swell=Math.sin(Math.min(1,t/TRANSITION_SOUND.attack)*Math.PI/2)**2,tail=Math.sin(Math.min(1,(duration-t)/TRANSITION_SOUND.release)*Math.PI/2)**2;
    const hum=.3*Math.sin(phase)+.5*Math.sin(phase*2)+.4*Math.sin(phase*4)+.16*Math.sin(phase*6)+.06*Math.sin(phase*12);
    data[i]=.055*swell*tail*(hum+.16*(band-low));
   }
  }
  buffers.set(key,buffer);return buffer;
 }
 function play(owner,kind,duration){
  const node=context.createBufferSource(),gain=context.createGain(),voice={owner,node,gain};node.buffer=bufferFor(kind,duration);node.connect(gain);gain.connect(output);voices.add(voice);
  node.onended=()=>{node.disconnect();gain.disconnect();voices.delete(voice);};node.start();return voice;
 }
 function stop(owner){for(const v of voices)if(owner===undefined||v.owner===owner){v.gain.gain.setTargetAtTime(0,context.currentTime,.003);v.node.stop(context.currentTime+.012);}}
 return {play,stop};
}
