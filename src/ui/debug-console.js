(()=>{
 const state=()=>game.state,resources={};
 function refresh(){state().revision++;dirtySave=true;render();}
 function stage(...stages){if(!stages.includes(state().stage))throw new Error(copyLocalized('debug-console.text'));}
 function stockField(key,value){
  const u=state().s,e=u.engineering,delta=value-u[key];u[key]=value;
  if(e){e.origin+=delta;u.gathered+=delta;if(key==='lightKg'){
   const rows=e.cohorts,total=rows.reduce((n,r)=>n+(r.collectedLight||0),0),stock=value+u.drifterStock.light;
   if(total>0)for(const r of rows)r.collectedLight=(r.collectedLight||0)*stock/total;else if(rows.length)rows[0].collectedLight=stock;
  }}
 }
 function setClips(value){
  const s=state(),delta=value-s.clipsKg;
  if(s.stage===1){s.h.total=value/s.clipUnit;s.h.stock=Math.max(0,s.h.stock+delta/s.clipUnit);}
  if(s.stage===2){const p=s.p,ratio=s.clipsKg>0?Math.min(1,p.swarm.clips/s.clipsKg):Number(game.has('dyson'));p.swarm.clips=value*ratio;p.recycle=Math.min(p.recycle,value-p.swarm.clips);p.swarm.recycle=Math.min(p.swarm.recycle,p.swarm.clips);}
  if(s.stage===3){const u=s.s,e=u.engineering,rows=e.cohorts,total=rows.reduce((n,r)=>n+r.devices,0);e.origin+=delta;u.gathered+=delta;
   if(delta>=0){const row=rows.find(r=>r.covered)||rows[0];if(row)row.devices+=delta;}
   else if(total>0)for(const r of rows)r.devices*=Math.max(0,1+delta/total);
  }
  if(s.stage===4&&s.end?.exactClips!==undefined)s.end.exactClips=String(BigInt(Math.round(value/s.clipUnit)));
  s.clipsKg=value;
 }
 function bind(name,get,set,integer=false){
  const descriptor={enumerable:true,get,set(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||integer&&!Number.isInteger(value))throw new TypeError(name+copy('debug-console.text-2')+(integer?copy('debug-console.text-3'):copy('debug-console.text-4'))+'。');set(value);refresh();}};
  Object.defineProperty(resources,name,descriptor);
 }
 for(const key of ['yomi','ops','insight'])bind(key,()=>state()[key],value=>state()[key]=value);
 for(const key of ['trust','processors','memory'])bind(key,()=>state()[key],value=>{stage(1);if(key!=='trust'&&value<1)throw new RangeError(key+copy('debug-console.1'));state()[key]=value;},true);
 for(const key of ['cash','makers','marketing'])bind(key,()=>state().h[key],value=>{stage(1);state().h[key]=value;},key!=='cash');
 bind('clips',()=>game.clipCount(),value=>setClips(value*state().clipUnit));
 bind('clipsKg',()=>state().clipsKg,setClips);
 bind('raw',()=>{const s=state();return s.stage===1?s.h.material:s.stage===2?(game.has('dyson')?s.p.swarm:s.p).raw:s.stage===4?s.s.finalMetal||0:0;},value=>{
  const s=state();stage(1,2,4);if(s.stage===1)s.h.material=value;else if(s.stage===2)(game.has('dyson')?s.p.swarm:s.p).raw=value;else s.s.finalMetal=value;
 });
 bind('lightKg',()=>state().s?.lightKg||0,value=>{stage(3);stockField('lightKg',value);});
 bind('energy',()=>{const s=state();return s.stage===2?s.p.charge+s.p.swarm.charge:s.s?.charge||0;},value=>{
  stage(2,3,4);const s=state();if(s.stage!==2){s.s.charge=value;return;}const p=s.p,total=p.charge+p.swarm.charge,ratio=total>0?p.charge/total:Number(!game.has('dyson'));p.charge=value*ratio;p.swarm.charge=value*(1-ratio);
 });
 paperclips.resources=resources;
})();
