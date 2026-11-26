'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const temporary=require('./temporary-directory.cjs');
const {prepareRelease,standalonePage}=require('./build.cjs');
const {gameName,escapeHTML,message}=require('./messages.cjs');

const root=path.resolve(__dirname,'..');
const android=path.join(root,'android');
const dist=path.join(root,'dist');
const exe=name=>name+(process.platform==='win32'?'.exe':'');
const jdkTool=name=>process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',exe(name)):exe(name);

function run(command,args,{cwd=root,env=process.env}={}){
 const result=spawnSync(command,args,{cwd,env,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${path.basename(command)} 退出码为 ${result.status}`);
}

function files(directory,extension){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?files(file,extension):entry.name.endsWith(extension)?[file]:[];
 });
}

function sdk(){
 const sdkRoot=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'';
 const platform=process.env.PAPERCLIPS_ANDROID_PLATFORM||path.join(sdkRoot,'platforms','android-35','android.jar');
 const tools=process.env.PAPERCLIPS_ANDROID_BUILD_TOOLS||path.join(sdkRoot,'build-tools','35.0.0');
 assert(fs.existsSync(platform)&&fs.existsSync(path.join(tools,exe('aapt2'))),'Android SDK 缺少 platform 35 或 build-tools 35.0.0。');
 return {platform,tools};
}

function signing(){
 const keystore=process.env.PAPERCLIPS_KEYSTORE;
 const password=process.env.PAPERCLIPS_SIGN_PASSWORD;
 assert(keystore&&fs.existsSync(keystore)&&password,'请设置 PAPERCLIPS_KEYSTORE 和 PAPERCLIPS_SIGN_PASSWORD。');
 return {keystore:path.resolve(keystore),alias:process.env.PAPERCLIPS_KEY_ALIAS||'paperclips'};
}

function writeTextResources(res){
 const names=['save-exported','save-export-failed','exit-prompt','keep-playing','exit'];
 for(const [language,qualifier] of [['en','values'],['zh','values-zh']]){
  const directory=path.join(res,qualifier);
  const prefix=language==='zh'?'@string/app_name':gameName.slug;
  const strings=[['app_name',gameName[language]],['save_file_prefix',prefix],
   ...names.map(name=>[name.replaceAll('-','_'),message('android.native.'+name,language)])];
  fs.mkdirSync(directory,{recursive:true});
  const xml=strings.map(([key,value])=>` <string name="${key}">${escapeHTML(value.replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('"','\\"'))}</string>`);
  fs.writeFileSync(path.join(directory,'strings.xml'),['<?xml version="1.0" encoding="utf-8"?>','<resources>',...xml,'</resources>',''].join('\n'));
 }
}

async function main(){
 const {platform,tools}=sdk();
 const {keystore,alias}=signing();
 const html=standalonePage(await prepareRelease(true),true);
 const temp=temporary();
 const cwd=temp.directory,at=name=>path.join(cwd,name);
 const java=jdkTool('java'),aapt2=path.join(tools,exe('aapt2')),zipalign=path.join(tools,exe('zipalign'));
 const signTool=path.join(tools,'lib','apksigner.jar');
 try{
  for(const dir of ['classes','dex','assets','generated'])fs.mkdirSync(at(dir));
  fs.cpSync(path.join(android,'res'),at('res'),{recursive:true});
  writeTextResources(at('res'));
  fs.copyFileSync(path.join(android,'AndroidManifest.xml'),at('AndroidManifest.xml'));
  fs.copyFileSync(platform,at('android.jar'));
  fs.copyFileSync(path.join(android,'shaders','optics.agsl'),at('assets/optics.agsl'));
  fs.writeFileSync(at('assets/index.html'),html);

  // aapt2 在 Windows 上用相对路径打开文件，以兼容包含中文的工作目录。
  run(aapt2,['compile','--dir','res','-o','resources.zip'],{cwd});
  run(aapt2,['link','-o','unsigned.apk','-I','android.jar','--manifest','AndroidManifest.xml','--java','generated','resources.zip'],{cwd});
  run(jdkTool('javac'),['-encoding','UTF-8','-source','8','-target','8','-bootclasspath',
   platform+path.delimiter+path.join(tools,'core-lambda-stubs.jar'),'-d','classes',
   ...files(path.join(android,'java'),'.java'),...files(at('generated'),'.java')],{cwd});
  run(java,['-cp',path.join(tools,'lib','d8.jar'),'com.android.tools.r8.D8','--lib','android.jar','--min-api','26',
   '--output','dex',...files(at('classes'),'.class')],{cwd});
  const python=process.env.PAPERCLIPS_PYTHON||'python';
  run(python,[path.join(__dirname,'android','append-assets.py'),'unsigned.apk'],{cwd});
  run(zipalign,['-f','-P','16','4','unsigned.apk','aligned.apk'],{cwd});
  run(java,['-jar',signTool,'sign','--ks',keystore,'--ks-key-alias',alias,
   '--ks-pass','env:PAPERCLIPS_SIGN_PASSWORD','--out','signed.apk','aligned.apk'],{cwd});
  run(java,['-jar',signTool,'verify','--verbose','signed.apk'],{cwd});
  run(zipalign,['-c','-P','16','4','signed.apk'],{cwd});

  const file=gameName.slug+'.apk';
  fs.mkdirSync(dist,{recursive:true});
  fs.copyFileSync(at('signed.apk'),path.join(dist,file));
  console.log('已生成 dist/'+file);
 }finally{temp.remove();}
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
