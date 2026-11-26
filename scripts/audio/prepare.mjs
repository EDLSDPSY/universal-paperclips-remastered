import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {musicDir,cache,buffer,BasicMIDI,SoundBankLoader,runAudio,withRenderedTrack} from './offline.mjs';
import sources from './sources.cjs';
const require=createRequire(import.meta.url),audibleDuration=require('./trim-silence.cjs');
const source=track=>path.join(musicDir,track.file),stamp=file=>{const stat=fs.statSync(file);return [stat.size,stat.mtimeMs];};
export async function prepareMusic({force=false,available=sources.musicFiles()}={}){
 const config=structuredClone(require(sources.playlist));
 fs.mkdirSync(cache,{recursive:true});
 const assigned=new Set();
 config.tracks=config.tracks.flatMap(track=>{const file=available.find(file=>file===track.file)||available.find(file=>path.parse(file).name===path.parse(track.file).name);if(!file){console.log('跳过已移除曲目:',track.id);return [];}assigned.add(file);return [{...track,file}];});
 for(const file of available.filter(file=>!assigned.has(file)))config.tracks.push({id:'extra_'+createHash('sha1').update(file).digest('hex').slice(0,10),file});
 const {build}=require('esbuild');
 const result=await build({entryPoints:[path.join(import.meta.dirname,'worklet.mjs')],bundle:true,format:'iife',minify:true,write:false,platform:'browser',target:'es2022',external:['node:*'],legalComments:'inline'});
 fs.writeFileSync(path.join(cache,'播放器.js.gz'),gzipSync(result.outputFiles[0].contents,{level:9}));
 const soundbankFile=process.env.PAPERCLIPS_SOUNDBANK||(process.env.SystemRoot&&path.join(process.env.SystemRoot,'System32','drivers','gm.dls'));
 const bankStamp=soundbankFile&&fs.existsSync(soundbankFile)?stamp(soundbankFile):null;
 const signature=JSON.stringify([7,config,config.tracks.map(track=>stamp(source(track))),bankStamp]);
 const metaPath=path.join(cache,'曲目.json'),bankPath=path.join(cache,'音源.sf2');
 const previous=fs.existsSync(metaPath)?JSON.parse(fs.readFileSync(metaPath)):null;
 if(!force&&previous?.signature===signature&&fs.existsSync(bankPath)&&previous.tracks.every(track=>!track.processed||fs.existsSync(path.join(cache,track.id+'.mp3')))){
  console.log('音乐预处理缓存有效');return previous;
 }
 if(!bankStamp)throw Error('请通过 PAPERCLIPS_SOUNDBANK 指定用于 MIDI 的 DLS 或 SF2 音源。');
 const bank=SoundBankLoader.fromArrayBuffer(buffer(soundbankFile)),used=new Map();
 for(const track of config.tracks.filter(track=>/\.midi?$/i.test(track.file))){
  const midi=BasicMIDI.fromArrayBuffer(buffer(source(track)));
  for(const [preset,keys] of midi.getUsedProgramsAndKeys(bank)){
   if(!used.has(preset))used.set(preset,new Map());const target=used.get(preset);
   for(const [key,velocities]of keys){if(!target.has(key))target.set(key,new Set());for(const velocity of velocities)target.get(key).add(velocity);}
  }
 }
 bank.trim(used);const bankData=bank.writeSF2();fs.writeFileSync(bankPath,Buffer.from(bankData));
 console.log('裁剪音源:',bankData.byteLength,'字节，',used.size,'种乐器');
 const tracks=[],previousSignature=previous?JSON.parse(previous.signature):null;
 for(const track of config.tracks){
  const oldIndex=previousSignature?.[1].tracks.findIndex(item=>item.id===track.id),oldSpec=oldIndex>=0?previousSignature[1].tracks[oldIndex]:null,old=previous?.tracks.find(item=>item.id===track.id);
  const sameBank=!/\.midi?$/i.test(track.file)||JSON.stringify(previousSignature?.[3])===JSON.stringify(bankStamp);
  const sameTail=JSON.stringify(previousSignature?.[1].tailSilence)===JSON.stringify(config.tailSilence);
  let measured;
  if(!force&&old&&sameBank&&sameTail&&oldSpec.tail===track.tail&&oldSpec.loop===track.loop&&JSON.stringify(previousSignature[2][oldIndex])===JSON.stringify(stamp(source(track)))&&(!old.processed||fs.existsSync(path.join(cache,track.id+'.mp3')))){
   measured={type:old.type,duration:old.duration,loop:old.loop,lufs:old.lufs,peak:old.peak,processed:old.processed??(old.type==='mp3'&&fs.statSync(source(track)).size*8/old.duration>145000)};
  }else measured=await withRenderedTrack(track,bankData,({raw,type,duration,loop})=>{
   const processed=type==='mp3'&&fs.statSync(source(track)).size*8/duration>145000;
   if(processed)runAudio(['-i',source(track),'-map_metadata','-1','-ar','44100','-ac','2','-c:a','libmp3lame','-q:a','4',path.join(cache,track.id+'.mp3')]);
   const log=runAudio(['-f','f32le','-ar','44100','-ac','2','-i',raw,'-af','loudnorm=I=-21:TP=-1:LRA=50:print_format=json','-f','null','-']);
   const measure=JSON.parse(log.slice(log.lastIndexOf('{')));
   if(!loop&&config.tailSilence!==false)duration=audibleDuration(raw,config.tailSilence);
   return {type,duration,loop,processed,lufs:Number(measure.input_i),peak:Number(measure.input_tp)};
  });
  const meta={...track,title:path.parse(track.file).name.trim(),...measured,gain:10**(Math.min(config.targetLUFS-measured.lufs,-1-measured.peak)/20)};tracks.push(meta);
  console.log(track.id,JSON.stringify({duration:+meta.duration.toFixed(3),loop:meta.loop,gain:+meta.gain.toFixed(4)}));
 }
 const metadata={signature,...config,tracks};fs.writeFileSync(metaPath,JSON.stringify(metadata,null,2));
 // 删掉当前曲目表里用不到的音频缓存。
 const retained=new Set(['曲目.json','音源.sf2','播放器.js.gz',...tracks.filter(track=>track.processed).map(track=>track.id+'.mp3')]);
 for(const file of fs.readdirSync(cache))if(!retained.has(file)&&/\.mp3$/.test(file))fs.unlinkSync(path.join(cache,file));
 return metadata;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)prepareMusic({force:process.argv.includes('--force')}).catch(error=>{console.error(error);process.exitCode=1;});
