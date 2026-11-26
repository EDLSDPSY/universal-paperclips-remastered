'use strict';
// __MUSIC_ASSETS__
const music=(()=>{
 let context,master,effects,workletReady,bankData,lastTick=-Infinity,hidden=false,pausedAt=null,pausedTime=0,activated=settings.musicVolume===0;
 const handles=new Set(),assets=createMusicAssetLoader();
 const unpack=text=>assets.load(text,true);
 // 音乐按现实时间安排曲目和间隔，释放音频设备也会记住这条时间线。
 const now=()=>((pausedAt??performance.now())-pausedTime)/1000;
 function init(){if(context)return context;context=new AudioContext({latencyHint:'playback'});master=context.createGain();master.connect(context.destination);effects=createTransitionSound(context,master);setVolume();return context;}
 function synthReady(ctx){
  if(!workletReady)workletReady=(async()=>{const data=await unpack(MUSIC_ASSETS.engine),blob=new Blob([data],{type:'text/javascript'});
   // 从磁盘打开 HTML 时，AudioWorklet 用 data URL 读取内嵌的播放器。
   const local=location.protocol==='file:',url=local?await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);}):URL.createObjectURL(blob);
   try{if(ctx.state!=='closed')await ctx.audioWorklet.addModule(url);}finally{if(!local)URL.revokeObjectURL(url);}
  })();
  return workletReady;
 }
 function setVolume(){if(master)master.gain.setTargetAtTime(settings.musicVolume??.5,context.currentTime,.03);}
 function fadeValue(h,time=now()){return time<h.fadeStart?1:h.endAt<=h.fadeStart?0:h.fadeFrom*Math.max(0,(h.endAt-time)/(h.endAt-h.fadeStart));}
 function scheduleGain(h){
  const a=h.audio;if(!a?.started)return;const at=context.currentTime,time=now(),gain=a.gain.gain;
  gain.cancelScheduledValues(at);gain.setValueAtTime(h.track.gain*fadeValue(h,time),at);
  if(Number.isFinite(h.endAt)){const end=at+Math.max(0,h.endAt-time),start=at+Math.max(0,h.fadeStart-time);if(start>at)gain.setValueAtTime(h.track.gain,start);if(start<end)gain.linearRampToValueAtTime(0,end);else gain.setValueAtTime(0,end);}
 }
 function playSound(h){
  const a=h.audio;if(!a?.ready||a.started||h.startAt===null||h.done)return;
  const elapsed=backend.elapsed(h);let position=elapsed;const loop=h.track.loop;
  if(loop&&position>=loop.end)position=loop.start+(position-loop.end)%(loop.end-loop.start);
  if(!loop&&position>=h.track.duration)return;
  a.started=true;a.offset=position;
  if(a.buffer){if(position>=a.buffer.duration)return;a.node=context.createBufferSource();a.node.buffer=a.buffer;a.node.connect(a.gain);a.node.start(0,position);}
  else{if(position>0)a.node.port.postMessage({cmd:'seek',time:position});a.node.port.postMessage({cmd:'start',at:context.currentTime});}
  scheduleGain(h);
 }
 function unload(h){const a=h.audio;h.audio=null;if(!a)return;a.cancelLoad?.();if(a.node?.port)a.node.port.postMessage({cmd:'stop'});else if(a.node){try{a.node.stop();}catch{}}a.node?.disconnect();a.gain.disconnect();a.buffer=null;}
 async function attach(h){
  if(h.audio||h.done||!(settings.musicVolume>0))return;
  const ctx=init(),a=h.audio={gain:ctx.createGain(),ready:false,started:false,node:null,buffer:null};a.gain.gain.value=0;a.gain.connect(master);
  const valid=()=>h.audio===a&&context===ctx&&!h.done;
  try{
   const data=await assets.load(MUSIC_ASSETS.data[h.track.id],h.track.type!=='mp3');if(!valid())return;
   if(h.track.type==='mp3'){const buffer=await ctx.decodeAudioData(data);if(!valid())return;a.buffer=buffer;}
   else{
    const [,bank]=await Promise.all([synthReady(ctx),h.track.type==='midi'?(bankData??=unpack(MUSIC_ASSETS.bank)):null]);if(!valid())return;
    a.node=new AudioWorkletNode(ctx,'paperclips-music',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});a.node.connect(a.gain);
    await new Promise((resolve,reject)=>{a.cancelLoad=resolve;a.node.onprocessorerror=()=>reject(Error('音乐线程启动失败'));a.node.port.onmessage=({data:d})=>{if(d.cmd==='loaded')resolve();if(d.cmd==='error')reject(Error(d.message));};a.node.port.postMessage({cmd:'load',type:h.track.type,data,loop:!!h.track.loop,bank});});a.cancelLoad=null;if(!valid())return;
   }
   a.ready=true;playSound(h);
  }catch(e){if(valid()){unload(h);backend.error(e);}}
 }
 const backend={
  now,enabled:()=>activated&&!hidden,error:e=>console.error('BGM:',e),
  async prepare(track){const h={track,startAt:null,endAt:Infinity,fadeStart:Infinity,fadeFrom:1,done:false,audio:null};handles.add(h);if(settings.musicVolume>0)attach(h);return h;},
  start(h){h.startAt=now();playSound(h);},elapsed:h=>h.startAt===null?0:Math.max(0,now()-h.startAt),ended:h=>h.done,
  end(h,seconds,fade){if(!Number.isFinite(seconds))return;h.endAt=h.startAt+seconds;h.fadeStart=Math.max(h.startAt,h.endAt-fade);h.fadeFrom=1;scheduleGain(h);},
  stop(h,fade){if(!h||h.done)return;if(fade>0&&h.startAt!==null){h.fadeFrom=fadeValue(h);h.fadeStart=now();h.endAt=h.fadeStart+fade;scheduleGain(h);}else dispose(h);}
 };
 function dispose(h){unload(h);h.done=true;handles.delete(h);}
 const director=MUSIC_ASSETS?new MusicDirector(MUSIC_ASSETS,backend):null;
 function tick(force=false){
  if(!director)return;
  const time=performance.now();if(!force&&time-lastTick<50)return;lastTick=time;
  for(const h of handles)if(now()>=h.endAt)dispose(h);
  director.tick(game,MusicRules.snapshot(game),{transition:!!screenTransition||lastStage!==game.state.stage,spaceReady:lastStage===game.state.stage,endingReady:endingBackground?.owner===game&&!!endingBackground.ready&&(!screenTransition||screenTransition.kind==='ending'&&screenTransition.reopening)});
 }
 async function unlock(){
  if(!(settings.musicVolume>0)){activated=true;return;}if(context?.state==='running'){activated=true;return;}let ctx;
  try{ctx=init();if(!hidden){await ctx.resume();if(ctx===context){activated=true;for(const h of handles)attach(h);tick(true);}}}catch(e){if(ctx===context&&settings.musicVolume>0)backend.error(e);}
 }
 function background(value){
  if(value===hidden)return;hidden=value;if(value)pausedAt=performance.now();else{pausedTime+=performance.now()-pausedAt;pausedAt=null;}
  if(!context)return;if(value)context.suspend();else context.resume().catch(backend.error);
 }
 function volumeLabel(){return settings.musicVolume>0?Math.round(settings.musicVolume*100)+'%':copy('music.off');}
 function configure(){
  const label=$('musicVolumeValue');if(label)label.textContent=volumeLabel();
  if(!(settings.musicVolume>0)){activated=true;for(const h of handles)unload(h);assets.close(Error('音乐已静音'));const old=context;context=null;master=null;effects=null;bankData=null;workletReady=null;old?.close();}
  else{setVolume();unlock();}
 }
 function html(){
  const label=MUSIC_ASSETS?copy('copy.music'):copy('copy.sound-effects');
  const volume=MUSIC_ASSETS?copy('copy.music-volume'):copy('copy.sound-effects-volume');
  return '<section class="music-settings"><div class="readout"><h3>'+label+'</h3><b id="musicVolumeValue">'+volumeLabel()+'</b></div><input id="musicVolume" aria-label="'+volume+'" type="range" min="0" max="1" step=".01" value="'+(settings.musicVolume??.5)+'"></section>';
 }
 document.addEventListener('visibilitychange',()=>background(document.hidden));
 document.addEventListener('input',e=>{if(e.target.id==='musicVolume'){settings.musicVolume=Number(e.target.value);configure();try{localStorage.setItem(PREF_KEY,JSON.stringify(settings));}catch{}}});
 return {tick,html,configure,background,unlock,prepare(){if(settings.musicVolume>0)try{init();}catch(e){backend.error(e);}},effect(owner,kind,duration){if(context?.state==='running'&&!hidden&&settings.musicVolume>0)effects.play(owner,kind,duration);},stopEffects(owner){effects?.stop(owner);},get director(){return director;},get context(){return context;}};
})();
