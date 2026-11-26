'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const zlib=require('node:zlib');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {encode,source:decoder}=require('./binary.cjs');
const {compileModel}=require('./projects.cjs');
const {gameName,escapeHTML,htmlMessages,scriptMessages,translationSource}=require('./messages.cjs');
const {compileGeometry}=require('./geometry.cjs');
const {musicDir,musicFiles}=require('./audio/sources.cjs');
const temporary=require('./temporary-directory.cjs');

const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const androidWeb=path.join(root,'android','web');
const python=process.env.PAPERCLIPS_PYTHON||'python';
const read=file=>fs.readFileSync(path.join(root,'src',file),'utf8').replace(/\r\n/g,'\n');
const readScript=file=>scriptMessages(read(file));
const join=(...parts)=>parts.map(part=>part.trim()).filter(Boolean).join('\n\n');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const gzip=data=>zlib.gzipSync(data,{level:9});
const hash=data=>createHash('sha256').update(data).digest('hex').slice(0,16);

function write(file,data){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,data);
}

function replace(source,marker,content){
 assert.equal(source.split(marker).length,2,'应当恰好出现一次 '+marker);
 return source.replace(marker,()=>content);
}

function packWasm(code){
 return code.replace(/Uint8Array\.from\(atob\('([A-Za-z0-9+/=]+)'\),c=>c\.charCodeAt\(0\)\)/g,(original,base64)=>{
  const packed=`decodeBinary(${json(encode(Buffer.from(base64,'base64')))})`;
  return packed.length<original.length?packed:original;
 });
}

async function audioAssets(){
 const available=musicFiles();
 if(!available.length)return null;
 const {prepareMusic}=await import('./audio/prepare.mjs');
 const {cache}=await import('./audio/offline.mjs');
 const {tracks,signature,tailSilence,targetLUFS,...config}=await prepareMusic({available});
 const volumeFile=path.join(musicDir,'音量.json');
 const volumes=fs.existsSync(volumeFile)?JSON.parse(fs.readFileSync(volumeFile,'utf8')):{};
 const engine=fs.readFileSync(path.join(cache,'播放器.js.gz'));
 const bank=gzip(fs.readFileSync(path.join(cache,'音源.sf2')));
 const data={};
 const metadata=tracks.map(({file,processed,lufs,peak,...track})=>{
  const raw=fs.readFileSync(processed?path.join(cache,track.id+'.mp3'):path.join(musicDir,file));
  data[track.id]=track.type==='mp3'?raw:gzip(raw);
  return {...track,gain:volumes[track.id]??track.gain};
 });
 return {config:{...config,tracks:metadata},data,engine,bank};
}

function inlineAudio(audio){
 if(!audio)return 'const MUSIC_ASSETS=null;';
 const {config,data,engine,bank}=audio;
 return 'const MUSIC_ASSETS='+json({...config,
  data:Object.fromEntries(Object.entries(data).map(([id,bytes])=>[id,encode(bytes)])),
  engine:encode(engine),bank:encode(bank)
 })+';';
}

function externalAudio(directory,audio){
 if(!audio)return 'const MUSIC_ASSETS=null;';
 const {config,data,engine,bank}=audio;
 const emit=(name,bytes,extension='bin')=>{
  const file=`${name}.${hash(bytes)}.${extension}`;
  write(path.join(directory,file),bytes);
  return file;
 };
 const tracks=Object.fromEntries(config.tracks.map(({id,type})=>{
  assert.match(id,/^[a-zA-Z0-9_]+$/);
  const name=id.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replaceAll('_','-').toLowerCase();
  return [id,emit('tracks/'+name,data[id],type==='mp3'?'mp3':'bin')];
 }));
 write(path.join(directory,'player-licenses.txt'),read('audio/player-licenses.txt'));
 const assets={...config,data:tracks,engine:emit('player',engine),bank:emit('instruments',bank)};
 return `const MUSIC_ASSETS={...${json(assets)},base:new URL('./audio/',import.meta.url)};`;
}

function interfaceCode(copy,audio,{includeAudioLicenses=false,android=false}={}){
 const ui=replace(replace(readScript('ui/interface.js'),'/*__战役__*/',readScript('render/battle.js').trim()),'/*__文案__*/',copy);
 const music=replace(readScript('audio/music.js'),'// __MUSIC_ASSETS__',audio);
 const license=includeAudioLicenses?'/*\n'+read('audio/player-licenses.txt').replaceAll('*/','* /')+'\n*/':'';
 const controls=android?scriptMessages(fs.readFileSync(path.join(androidWeb,'controls.js'),'utf8')):'';
 return join(ui,...[
  'render/dot-matrix.js','render/nearby-stars.js','ui/universe.js',
  'render/cosmic-filaments.js','render/star-grid.js','render/cosmic-particles.js',
  'render/distant-web.js','render/universe.js','render/stellar-samples.js',
  'render/departure.js','render/black-hole/handoff.js','render/black-hole/renderer.js',
  'ui/ending.js'
 ].map(readScript),license,readScript('audio/music-director.js'),readScript('audio/sound-effects.js'),
 readScript('audio/asset-loader.js'),music,readScript('render/screen.js'),controls,readScript('ui/start.js'),readScript('ui/debug-console.js'));
}

function fontSubset(source){
 const temp=temporary();
 try{
  const input=path.join(temp.directory,'game.txt'),output=path.join(temp.directory,'terminal.woff2');
  fs.writeFileSync(input,source);
  run(python,[path.join(__dirname,'fonts','subset.py'),input,output]);
  return fs.readFileSync(output);
 }finally{temp.remove();}
}

function run(command,args,cwd=root){
 const result=spawnSync(command,args,{cwd,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${path.basename(command)} 退出码为 ${result.status}`);
}

function standalonePage({template,css,model,scene,ui,font},android=false){
 if(android){
  template=replace(template,'width=device-width,initial-scale=1','width=device-width,initial-scale=1,viewport-fit=cover');
  css=join(css,fs.readFileSync(path.join(androidWeb,'styles.css'),'utf8'));
 }
 const fontLoad=`document.fonts.add(new FontFace('Paperclip Terminal',decodeBinary(${json(encode(font))}),{display:'swap'}));`;
 const script=join('(()=>{\n\'use strict\';',`const ANDROID_BUILD=${android};`,decoder,model,fontLoad,scene,ui,'})();');
 new vm.Script(script);
 assert(!/<\/script/i.test(script),'脚本中含有 HTML 结束标签');
 const html=replace(replace(template,'/*__样式__*/',css),'<!-- game-scripts -->',`<script>\n${script}\n</script>`);
 assert(!/<script[^>]*\bsrc\s*=|<link[^>]*\bhref\s*=|url\(\s*['"]?https?:/i.test(html),'单文件 HTML 仍引用外部资源');
 return html;
}

function web(template,css,model,scene,ui,font){
 const directory=path.join(dist,'web'),assets=path.join(directory,'assets');
 const codec=join(decoder,'export {decodeBinary,BINARY_DECODER_SOURCE};');
 const codecFile=`binary.${hash(codec)}.js`;
 const modelExports='GAME_NAME,PaperclipModel,StellarSpace,CombatSpace,STELLAR_CULL_MODULE,CPU_GAUSSIAN_MODULE';
 const modelModule=join(`import {decodeBinary} from './${codecFile}';`,model,`export {${modelExports}};`);
 const modelFile=`model.${hash(modelModule)}.js`;
 const sceneFile=`scene.${hash(scene)}.js`;
 const sceneExports=[...scene.matchAll(/^export const (\w+)/gm)].map(match=>match[1]).join(',');
 const imports=[
  `import {decodeBinary,BINARY_DECODER_SOURCE} from './${codecFile}';`,
  `import {${modelExports}} from './${modelFile}';`,
  `import {${sceneExports}} from './${sceneFile}';`
 ];
 const app=join(imports.join('\n'),'const ANDROID_BUILD=false;',ui);
 const appFile=`game.${hash(app)}.js`,fontFile=`terminal.${hash(font)}.woff2`;
 css=`@font-face{font-family:"Paperclip Terminal";src:url("${fontFile}") format("woff2");font-display:swap}\n${css}`;
 const cssFile=`game.${hash(css)}.css`;
 const scripts=[[codecFile,codec],[modelFile,modelModule],[sceneFile,scene],[appFile,app]];
 for(const [file,data] of [...scripts,[fontFile,font],[cssFile,css]])write(path.join(assets,file),data);
 const head=[`<link rel="stylesheet" href="./assets/${cssFile}">`,
  ...scripts.slice(0,-1).map(([file])=>`<link rel="modulepreload" href="./assets/${file}">`)];
 const html=replace(replace(template,'<style>/*__样式__*/</style>',head.join('\n')),'<!-- game-scripts -->',
  `<script type="module" src="./assets/${appFile}"></script>`);
 assert(Buffer.byteLength(html)<=1_000_000,'页游 index.html 超过 1 MB');
 write(path.join(directory,'index.html'),html);
 for(const [file] of scripts)run(process.execPath,['--check',path.join(assets,file)]);
 run(python,['-m','zipfile','-c',path.join(dist,gameName.slug+'-web.zip'),'index.html','assets'],directory);
}

async function prepareRelease(android=false){
 const data=JSON.parse(read('data/projects.json'));
 const copy=translationSource();
 const model=packWasm(join(read('kernels/compiled.js'),compileModel(data)));
 const scene=join(...['data/cosmic-web.js','data/distant-web.js'].map(file=>compileGeometry(path.join(root,'src',file))),
  'const BH_SHADERS='+json({trace:read('render/black-hole/ray-trace.glsl'),post:read('render/black-hole/post-process.glsl')})+';');
 const template=replace(htmlMessages(read('web/index.html')),'<!-- game-title -->',escapeHTML(gameName.en));
 const css=replace(read('web/game.css'),'/*__字体__*/','/*\n'+read('fonts/OFL.txt')+'\n*/');
 const audio=await audioAssets();
 const ui=packWasm(interfaceCode(copy,inlineAudio(audio),{includeAudioLicenses:!!audio,android}));
 const font=fontSubset(join(template,css,model,scene,ui));
 return {template,css,model,scene,ui,font,copy,audio};
}

async function main(){
 const release=await prepareRelease();
 write(path.join(dist,gameName.slug+'.html'),standalonePage(release));

 const directory=path.join(dist,'web');
 // 每次用当前源码生成完整的网站，防止旧文件混入上传包。
 assert.equal(path.relative(dist,directory),'web');
 fs.rmSync(directory,{recursive:true,force:true});
 const {template,css,model,scene,font,copy,audio}=release;
 const webAudio=externalAudio(path.join(directory,'assets','audio'),audio);
 web(template,css,model,scene.replace(/^const /gm,'export const '),packWasm(interfaceCode(copy,webAudio)),font);
 console.log('已生成单文件 HTML，以及带有 index.html 的页游目录和 ZIP。');
}

module.exports={prepareRelease,standalonePage};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
