'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const messages=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/data/messages.json'),'utf8'));
const jsString=text=>JSON.stringify(text).replaceAll('<','\\u003c');
const escapeHTML=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function message(id,language='zh'){
 const value=Object.hasOwn(messages,id)&&messages[id][language];
 assert(typeof value==='string','缺少文案 '+id+' / '+language);
 return value;
}

function htmlMessages(html){
 return html.replace(/\{\{([a-z][\w.-]*)\}\}/g,(_,id)=>escapeHTML(message(id)));
}

function scriptMessages(source){
 const literals=source.replace(/\b(copy|copyLocalized)\('([a-z][\w.-]*)'\)/g,(_,call,id)=>{
  const chinese=jsString(message(id));
  return call==='copy'?chinese:`(settings.lang==='en'?${jsString(message(id,'en'))}:${chinese})`;
 });
 return literals.replace(/\{\{([a-z][\w.-]*)\}\}/g,(_,id)=>jsString(escapeHTML(message(id))).slice(1,-1));
}

function translationSource(){
 const english=Object.create(null),formats=[];
 for(const [id,entry] of Object.entries(messages)){
  const zh=message(id),en=message(id,'en');
  if(entry.format){
   const keys=text=>new Set(text.match(/%[1-9]\d*/g));
   const variables=keys(zh);
   assert(variables.size>0,'格式文案缺少占位符 '+id);
   assert.deepEqual(keys(en),variables,'中英文占位符不同 '+id);
   const parts=zh.split(/(%[1-9]\d*)/),order=[];
   assert(parts.some((part,i)=>i%2===0&&part.length),'格式文案需要固定文字 '+id);
   const pattern=parts.map((part,i)=>{
    if(i%2){order.push(part);return '(.+?)';}
    return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   }).join('');
   formats.push(['^'+pattern+'$',en,order]);
   continue;
  }
  if(entry.direct||entry.lookup===false||!zh.trim()||zh===en)continue;
  const key=zh;
  assert(!Object.hasOwn(english,key)||english[key]===en,'同一句中文有两个英文版本 '+key);
  english[key]=en;
 }
 return 'const EN='+JSON.stringify(english).replaceAll('<','\\u003c')+';\n'+
  'const EN_FORMATS='+JSON.stringify(formats).replaceAll('<','\\u003c')+'.map(([pattern,text,order])=>[new RegExp(pattern),text,order]);\n';
}

const gameName={zh:message('game.title'),en:message('game.title','en'),slug:require('../package.json').name};

module.exports={gameName,message,escapeHTML,htmlMessages,scriptMessages,translationSource};
