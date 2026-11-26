'use strict';
const MusicRules={
 snapshot(game){
  const s=game.state,done=id=>game.has(id),started=id=>done(id)||s.tasks.some(t=>t.id===id),u=s.s,p=s.p;
  const heat=s.stage===2?(p.last.thermalOccupancy??p.last.heat??0)/game.planetRates().thermalTarget:0;
  return {stage:s.stage,total:s.h.total,makers:s.h.makers,population:s.h.population,
   personal:started('personalData'),industry:done('cdzProposal'),closure:started('cdzClosure'),automation:done('automation'),abundanceEnd:s.h.publicSupplyTarget>0&&s.h.publicSupplyKg>=s.h.publicSupplyTarget||done('carbon'),control:started('control'),
   compute:['memristor','photonicCompute','nsquid'].every(done),heat,thermalFull:!!p?.thermalLimitReached,earth:p?p.earth/game.C.earth:1,
   starflight:started('starflight'),systems:1+(u?.systemCount||0),arrived:(u?.arrived||0)>0,combat:started('combat'),battle:(u?.battleCount||0)>0||(u?.battlesEnded||0)>0,
   explored:s.stage>=3?game.mapProgress():0,dismantle:s.dismantle,ending:s.ending};
 },
 intros:[
  {id:'humanIntro',stage:1,fresh:s=>s.total<5000&&s.makers===0},
  {id:'earthIntro',stage:2,fresh:s=>!s.compute,ready:v=>!v.transition},
  {id:'spaceIntro',stage:3,fresh:s=>!s.arrived,ready:v=>v.spaceReady!==false},
  {id:'drifterIntro',stage:3,fresh:s=>s.battle&&!s.combat,event:(s,p)=>s.battle&&!p.battle},
  {id:'endingIntro',stage:4,fresh:s=>s.dismantle<=6,ready:v=>v.endingReady}
 ],
 periods:[
  {id:'business',stage:1,tracks:['business1','business2'],active:s=>!s.personal},
  {id:'industry',stage:1,tracks:['industry1'],active:s=>s.industry&&!s.closure},
  {id:'abundance',stage:1,tracks:['abundance1','abundance2'],latchEnd:false,active:s=>s.automation&&!s.abundanceEnd},
  {id:'release',stage:1,tracks:['release1'],active:s=>s.control&&s.population>0},
  {id:'surface',stage:2,tracks:['surface1'],active:s=>s.heat<.2&&!s.thermalFull},
  {id:'interplanetary',stage:2,tracks:['interplanetary1','interplanetary2'],active:s=>s.thermalFull&&s.earth>.999},
  {id:'planet',stage:2,tracks:['planet1'],active:s=>s.earth<=.995&&s.earth>0},
  {id:'earlySpace',stage:3,tracks:['earlySpace1'],active:s=>s.systems<1500&&!s.battle},
  {id:'war',stage:3,tracks:['war1','war3','war2'],active:s=>s.combat&&s.explored<.0001},
  {id:'lateSpace',stage:3,tracks:['lateSpace1'],active:s=>s.explored>=.001&&s.explored<.9}
 ],
 forces:[
  s=>s.stage===1&&s.population===0,
  s=>s.stage===2&&s.starflight,
  s=>s.stage===3&&s.systems>=1800&&!s.battle,
  s=>s.stage===3&&s.explored>=1
 ]
};
class MusicDirector {
 constructor(config,backend,random=Math.random){this.config=config;this.backend=backend;this.random=random;this.tracks=new Map(config.tracks.map(t=>[t.id,t]));this.owner=null;this.serial=0;this.current=null;this.pending=null;this.order={};this.played=new Set();this.queue=[];this.nextAt=0;}
 reset(owner,s,now){this.cancel(0);this.owner=owner;this.previous=s;this.order={...(owner.state?.music?.order||{})};this.played.clear();this.queue=[];this.nextAt=now;this.closed=new Set(owner.state?.music?.closed||[]);
  // 项目和累计产量已经写进存档，可以用它们判断这一段音乐是否结束。
  for(const period of MusicRules.periods)if(period.latchEnd===false)this.closed.delete(period.id);
  for(const intro of MusicRules.intros)if(intro.stage===s.stage&&intro.fresh(s))this.queue.push(intro);
  // 已经遭遇漂变者时，读档只重播战役开场。
  if(this.queue.some(i=>i.id==='drifterIntro'))this.queue=this.queue.filter(i=>i.id!=='spaceIntro');
 }
 cancel(fade=this.config.fade){this.serial++;if(this.pending?.handle)this.backend.stop(this.pending.handle,0);this.pending=null;if(this.current){this.backend.stop(this.current.handle,fade);this.current=null;}}
 canPlay(id){const t=this.tracks.get(id);return !!t&&(!t.once||!this.played.has(id));}
 enqueue(intro){if(!this.canPlay(intro.id))return;this.cancel();this.queue=[intro];}
 period(s){return MusicRules.periods.find(p=>p.stage===s.stage&&!this.closed.has(p.id)&&p.active(s));}
 async choose(id,period,intro,now){
  const track=this.tracks.get(id),ticket=++this.serial;
  if(!this.canPlay(id))return;
  const pending=this.pending={ticket,track,period,intro,due:now+(track.delay??this.config.delay),handle:null};
  try{const handle=await this.backend.prepare(track);if(this.pending!==pending){this.backend.stop(handle,0);return;}pending.handle=handle;}
  catch(error){if(this.pending!==pending)return;this.pending=null;this.nextAt=this.backend.now()+this.config.gap;this.backend.error(error);}
 }
 tick(owner,s,view={}){
  const now=this.backend.now();if(this.owner!==owner)this.reset(owner,s,now);const prev=this.previous;
  for(const p of MusicRules.periods)if(p.latchEnd!==false&&p.stage===s.stage&&!p.active(s)&&p.active(prev)&&prev.stage===s.stage)this.closed.add(p.id);
  if(s.stage!==prev.stage){const intro=MusicRules.intros.find(i=>i.stage===s.stage&&!i.event);if(intro)this.enqueue(intro);else this.cancel();}
  for(const intro of MusicRules.intros)if(intro.stage===s.stage&&intro.event?.(s,prev))this.enqueue(intro);
  const held=MusicRules.forces.some(test=>test(s));if(held&&!MusicRules.forces.some(test=>test(prev)))this.cancel();
  this.previous=s;
  if(s.ending==='virtual'){this.cancel();this.queue=[];return;}
  let period=this.period(s);
  if(this.pending?.period&&this.pending.period!==period)this.cancel(0);
  if(this.current){const c=this.current,elapsed=this.backend.elapsed(c.handle);
   if(c.track.loop&&c.period!==period&&!Number.isFinite(c.end)){
    const {start,end}=c.track.loop,length=end-start;c.end=elapsed<end?end:end+Math.ceil((elapsed-end)/length)*length;this.backend.end(c.handle,c.end,this.config.fade);
   }
   if(elapsed>=c.end||this.backend.ended(c.handle)){
    this.backend.stop(c.handle,0);this.current=null;this.nextAt=now+this.config.gap;
   }
  }
  if(this.pending?.handle&&now>=this.pending.due&&this.backend.enabled()){
   const p=this.pending;this.pending=null;const t=p.track;
   const end=t.loop?(!t.once&&p.period?.tracks.filter(id=>this.tracks.has(id)).length===1?Infinity:t.loop.end+(t.loop.end-t.loop.start)*((t.cycles??2)-1)):t.duration;
   this.backend.start(p.handle,t.gain);this.current={...p,end};this.backend.end(p.handle,end,t.loop?this.config.fade:(t.endFade??0));
   this.played.add(t.id);if(p.period)this.order[p.period.id]=Math.max(this.order[p.period.id]||0,p.period.tracks.filter(id=>this.tracks.has(id)).indexOf(t.id)+1);
  }
  if(owner.state)owner.state.music={order:this.order,closed:[...this.closed]};
  if(this.current||this.pending||!this.backend.enabled())return;
  if(this.queue.length){const intro=this.queue[0];if(intro.ready&&!intro.ready(view))return;this.queue.shift();this.choose(intro.id,null,intro,now);return;}
  if(held||view.transition||now<this.nextAt||!period)return;
  const ids=period.tracks.filter(id=>this.tracks.has(id)),available=ids.filter(id=>this.canPlay(id));if(!available.length)return;const index=this.order[period.id]||0,id=ids.slice(index).find(id=>this.canPlay(id))??available[Math.floor(this.random()*available.length)];this.choose(id,period,null,now);
 }
}
if(typeof module!=='undefined')module.exports={MusicRules,MusicDirector};
