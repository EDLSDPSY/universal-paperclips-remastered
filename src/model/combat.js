'use strict';
const CombatSpace=(()=>{
 const tempo=3,maxAnimationRate=3*tempo,timeout=45,width=300,height=125,heldCommands=new WeakSet();
 function random(seed){let n=Math.imul(seed^0x6c8e9cf5,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
 function create(seed,chance,ratio=1,shield=1){
  const r=()=>random(seed++),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-8,r())))*Math.cos(r()*Math.PI*2),base=10+Math.floor(r()**2*22),spread=r()<.08?1.1:.35,own=Math.max(2,Math.min(64,Math.round(base*Math.exp(normal()*spread)*ratio**.0625))),enemy=Math.max(2,Math.min(64,Math.round(base*Math.exp(normal()*spread)/ratio**.0625))),angle=r()*Math.PI*2,particles=[];
  for(let side=0;side<2;side++){
   const a=angle+side*Math.PI,dx=Math.cos(a),dy=Math.sin(a),length=Math.min((width/2-5)/Math.max(.001,Math.abs(dx)),(height/2-5)/Math.max(.001,Math.abs(dy))),centre=.55+r()*.18,wide=14+r()*20,tall=7+r()*6;
   for(let i=0;i<(side?enemy:own);i++){
    let x,y;for(let attempt=0;attempt<12;attempt++){x=width/2+dx*length*centre+normal()*wide;y=height/2+dy*length*centre+normal()*tall;if(x>3&&x<width-3&&y>3&&y<height-3)break;}
    const heading=a+Math.PI+normal()*.22,speed=28+r()*8,hp=side?4:2.2+.45*shield,phase=r()*Math.PI*2,offset=2+4*r();
    particles.push({side,x:Math.max(3,Math.min(width-3,x)),y:Math.max(3,Math.min(height-3,y)),vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,heading,hp,maxHp:hp,cooldown:0,alive:true,exitX:-dx,exitY:-dy,offsetX:Math.cos(phase)*offset,offsetY:Math.sin(phase)*offset,phase,pace:.65+.7*r(),target:-1,retarget:0,support:1});
   }
  }
  return {seed,attack:chance<=0?0:Math.sqrt(chance/Math.max(1e-12,1-chance)),particles,own,enemy,time:0,events:[],counts:[own,enemy],done:false,combatEnded:false,command:null,steered:false,draw:false};
 }
 function command(b,x,y,held=false){heldCommands.delete(b);if(b.combatEnded)return false;if(x===undefined)return true;if(x===null){b.command=null;return true;}b.command={x,y};if(held)heldCommands.add(b);b.steered=true;return true;}
 function finish(b,draw=false){b.combatEnded=true;b.combatTime=b.time;b.draw=draw;b.win=!draw&&b.counts[0]>0;}
 function step(b,dt){
  if(b.done)return;b.time+=dt;if(b.steered&&!b.combatEnded&&b.time>=timeout)finish(b,true);
  if(b.command&&!heldCommands.has(b)&&!b.combatEnded){let arrived=0;for(const p of b.particles)if(p.alive&&!p.side&&Math.hypot(p.x-Math.max(0,Math.min(width,b.command.x+p.offsetX)),p.y-Math.max(0,Math.min(height,b.command.y+p.offsetY)))<10)arrived++;if(arrived>=b.counts[0]*.85)b.command=null;}
  for(const p of b.particles)if(p.alive){
   p.cooldown=Math.max(0,p.cooldown-dt);let tx,ty,approach=1;
   if(b.combatEnded){tx=p.exitX*42;ty=p.exitY*42;}
   else if(p.side===0&&b.command){tx=b.command.x+p.offsetX-p.x;ty=b.command.y+p.offsetY-p.y;approach=Math.min(1,Math.hypot(tx,ty)/16);}
   else{
    p.retarget-=dt;let q=b.particles[p.target];
    if(!q?.alive||p.retarget<=0){let d=Infinity;p.target=-1;for(let i=0;i<b.particles.length;i++){const enemy=b.particles[i];if(!enemy.alive||enemy.side===p.side)continue;const v=((p.x-enemy.x)**2+(p.y-enemy.y)**2)*(1+.24*Math.sin(i*2.4+p.phase));if(v<d){d=v;p.target=i;}}q=b.particles[p.target];p.retarget=.4+.4*(1+Math.sin(p.phase));}
    const dx=q?q.x-p.x:p.vx,dy=q?q.y-p.y:p.vy,d=Math.hypot(dx,dy),spread=.75+.25*Math.min(1,d/25);
    tx=dx+Math.cos(b.time*.8+p.phase)*7*spread;ty=dy+Math.sin(b.time*.65+p.phase)*7*spread;approach=.25+.75*Math.min(1,d/20);
   }
   const a=Math.hypot(p.vx,p.vy)>1e-8?Math.atan2(p.vy,p.vx):p.heading,target=Math.atan2(ty,tx),difference=Math.atan2(Math.sin(target-a),Math.cos(target-a)),turn=Math.max(-dt*1.9,Math.min(dt*1.9,difference)),speed=Math.hypot(p.vx,p.vy)+(34*(p.side===0&&b.command?1.05:p.pace)*approach*(b.combatEnded||b.steered?1:Math.max(.08,1/(1+Math.max(0,b.time-15)/8)))-Math.hypot(p.vx,p.vy))*(-Math.expm1(-dt*2));
   p.heading=a+turn;p.vx=Math.cos(p.heading)*speed;p.vy=Math.sin(p.heading)*speed;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(!b.combatEnded){if(p.x<0){p.x=0;p.vx=Math.max(0,p.vx);}if(p.x>width){p.x=width;p.vx=Math.min(0,p.vx);}if(p.y<0){p.y=0;p.vy=Math.max(0,p.vy);}if(p.y>height){p.y=height;p.vy=Math.min(0,p.vy);}}
  }
  if(!b.combatEnded){
   // 每处战场只能调用附近的火力，同时开打的规模取决于兵力较少的一方。
   let supportReady=false;
   for(let i=0;i<b.particles.length&&!b.combatEnded;i++){const p=b.particles[i];if(!p.alive||p.cooldown>0)continue;for(let j=i+1;j<b.particles.length;j++){
    const q=b.particles[j];if(!q.alive||q.cooldown>0||p.side===q.side||(p.x-q.x)**2+(p.y-q.y)**2>36)continue;
    if(!supportReady){for(const p of b.particles)if(p.alive){p.support=1;for(const q of b.particles)if(q!==p&&q.alive&&q.side===p.side){const d=(p.x-q.x)**2+(p.y-q.y)**2;p.support+=Math.max(0,1-d/256);}}supportReady=true;}
    const own=p.side===0?p:q,enemy=p.side===1?p:q,jitter=.75+.5*random(b.seed++),front=Math.min(own.support,enemy.support);
    enemy.hp-=.9*b.attack*jitter*own.support/front;own.hp-=.9/jitter*enemy.support/front;p.cooldown=q.cooldown=.4;
    for(const hit of [own,enemy])if(hit.hp<=0){hit.alive=false;b.counts[hit.side]--;b.events.push({time:b.time,side:hit.side,x:hit.x,y:hit.y});}
    if(!b.counts[0]||!b.counts[1])finish(b);break;
   }}
  }
  if(b.combatEnded)b.done=b.particles.every(p=>!p.alive||p.x<-8||p.x>width+8||p.y<-8||p.y>height+8);
 }
 function resolve(seed,chance,ratio,shield=1){const b=create(seed,chance,ratio,shield);for(let i=0;i<9000&&!b.combatEnded;i++)step(b,1/30);if(!b.combatEnded)finish(b,true);return {seed,own:b.own,enemy:b.enemy,events:b.events,win:b.win,draw:b.draw,duration:b.combatTime,ownRate:1-b.counts[0]/b.own,enemyRate:1-b.counts[1]/b.enemy};}
 function animationRate(speedRatio){return Math.max(.65,Math.min(maxAnimationRate,maxAnimationRate*Math.max(0,speedRatio)**Math.log10(4)));}
 return {create,step,resolve,command,timeout,width,height,tempo,maxAnimationRate,animationRate};
})();
