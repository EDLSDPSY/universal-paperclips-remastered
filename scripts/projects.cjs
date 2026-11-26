'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {gameName,message,scriptMessages}=require('./messages.cjs');
const costKeys=['cash','ops','insight','yomi','raw','recycled','clips','trust','credits','electricity'];
const iconKeys=['clip','chip','factory','human','chart','star','mine','solar','storage','cooling','rocket','orbit','beam','cloud','shield','accretion','towing','whiteDwarf','compactOrbit','nucleus','collapse','merger','stellarEngine','impact','analysis','radiation'];
function validateCosts(cost,label){
 assert(cost&&typeof cost==='object'&&!Array.isArray(cost),label+' 费用应为对象');
 for(const [key,value]of Object.entries(cost)){assert(costKeys.includes(key),label+' 未知费用 '+key);assert(typeof value==='number'&&Number.isFinite(value)&&value>=0,label+' 费用错误 '+key);}
}
function compileProjects(data){
 const entries=Object.entries(data.项目);assert(entries.length>0,'缺少项目配置');const ids=new Set(entries.map(([id])=>id)),out=[];
 const json=x=>JSON.stringify(x).replaceAll('<','\\u003c');
 function code(value,label){assert(typeof value==='string','缺少函数：'+label);const source=scriptMessages(value);new vm.Script('const fn=('+source+');');return '('+source+')';}
 for(const [id,p]of entries){
  assert([1,2,3].includes(p.阶段),id+' 阶段错误');assert(Number.isFinite(p.工期日)&&p.工期日>=0,id+' 工期错误');
  assert(p.前置.every(x=>ids.has(x)&&x!==id),id+' 前置不存在');
  if(p.展示前置!==undefined)assert(Array.isArray(p.展示前置)&&p.展示前置.every(x=>p.前置.includes(x)),id+' 展示前置须为执行前置的一部分');
  validateCosts(p.费用,id);
  assert(!p.费用.clips||p.阶段===3,id+' 回形针高纯金属仅适用于宇宙阶段');
  assert(!p.费用.recycled||p.阶段===2,id+' 高纯金属仅适用于工业阶段');
  if(p.图标!==undefined)assert(iconKeys.includes(p.图标),id+' 未知图标 '+p.图标);
  for(const v of Object.values(p.持续参数||{}))assert(typeof v==='number'&&Number.isFinite(v),id+' 收益参数错误');
  if(p.持续参数?.展示缓存ops!==undefined)assert(p.持续参数.展示缓存ops>=0,id+' 展示缓存不可为负');
  assert(p.持续参数?.科研缓存占比===undefined,id+' 请在费用.ops 中设置固定运算费用，不再使用科研缓存占比');
  let props={id,stage:p.阶段,title:message(p.名称),desc:message(p.说明),cost:p.费用,baseCost:p.费用,requires:p.前置,days:p.工期日,gateText:p.条件说明?message(p.条件说明):'',hiddenUntilEligible:p.条件达成才展示,repeatable:p.可重复,benefits:p.持续参数||{}};
  if(p.展示前置!==undefined)props.displayRequires=p.展示前置;
  if(p.图标!==undefined)props.icon=p.图标;
  if(p.持续参数?.展示缓存ops!==undefined)props.displayCapacity=p.持续参数.展示缓存ops;
  if(p.门槛){
   assert(p.阶段===1,id+' 工业门槛仅适用于人类阶段');
   for(const [key,value]of Object.entries(p.门槛)){assert(['设施质量kg','工业供能W','累计产品kg','人均累计产品kg'].includes(key),id+' 未知门槛 '+key);assert(Number.isFinite(value)&&value>=0,id+' 门槛错误 '+key);}
   props.thresholds={mass:p.门槛.设施质量kg||0,power:p.门槛.工业供能W||0,products:p.门槛.累计产品kg||0,perPerson:p.门槛.人均累计产品kg||0};
  }
  let fields=Object.entries(props).map(([k,v])=>k+':'+json(v));
  for(const [field,key]of [['gate','执行条件'],['effect','完成效果'],['reveal','展示条件'],['start','开始效果']])if(p[key])fields.push(field+':'+code(p[key],id+'/'+key));
  out.push(' defs.push({'+fields.join(',')+'});');
 }
 const active=new Set(),done=new Set();function visit(id){assert(!active.has(id),'项目依赖环：'+id);if(done.has(id))return;active.add(id);for(const parent of data.项目[id].前置)visit(parent);active.delete(id);done.add(id);}for(const id of ids)visit(id);
 return out.join('\n');
}
function compileModel(data,root=path.resolve(__dirname,'..')){
 const read=name=>scriptMessages(fs.readFileSync(path.join(root,'src','model',name),'utf8').replace(/\r\n/g,'\n')).trim();
 let source=read('game.js');
 for(const [marker,content]of [['/*__项目__*/',compileProjects(data)],['/*__太阳系__*/',read('solar-system.js')],['/*__宇宙__*/',read('universe.js')+'\n'+read('stellar-engineering.js')+'\n'+read('stellar-response.js')+'\n'+read('ending.js')]]){
  assert(source.split(marker).length===2,'模型插入位置错误：'+marker);source=source.replace(marker,()=>content);
 }
 return ['const GAME_NAME=Object.freeze('+JSON.stringify(gameName).replaceAll('<','\\u003c')+');',
  read('production.js'),read('stellar-region.js'),read('combat.js'),source].join('\n\n');
}
module.exports={compileProjects,compileModel,validateCosts};
