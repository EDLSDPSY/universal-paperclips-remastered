let battleSimulation=null,battleSpeedScale=1,battlePrevious=new Float64Array(0),battleOwner=null,battleYomiRows=[];
const battleCanvasSizes=new WeakMap(),battleResizeObserver=new ResizeObserver(entries=>{for(const e of entries)battleCanvasSizes.set(e.target,{width:Math.round(e.contentRect.width),height:Math.round(e.contentRect.height)});});
function battleCanvasSize(c){let size=battleCanvasSizes.get(c);if(!size){size={width:Math.round(c.clientWidth),height:Math.round(c.clientHeight)};battleCanvasSizes.set(c,size);battleResizeObserver.observe(c);}return size;}
function battlePresentationReady(){return !game.state.s.engagement&&(!battleSimulation||battleSimulation.done)&&battleSparks.length===0;}
function drawBattleYomi(real){
 const c=$('battleYomi');if(!c)return;const visible=!ANDROID_BUILD||mobileElementVisible(c,1),{width,height}=ANDROID_BUILD?mobileBattleSize(c,visible):battleCanvasSize(c);if(visible&&(c.width!==width||c.height!==height)){c.width=width;c.height=height;}const ctx=c.getContext('2d');
 for(const amount of game.takeBattleResults())battleYomiRows.push({amount,y:height});if(battleYomiRows.length>3)battleYomiRows.splice(0,battleYomiRows.length-3);
 for(let i=0;i<battleYomiRows.length;i++){const row=battleYomiRows[i],target=height-12-(battleYomiRows.length-1-i)*25;row.y+=(target-row.y)*(-Math.expm1(-real/.16));}
 if(!visible)return;const format=[settings.lang,settings.numberUnits,settings.scientificAt].join(':'),key=[width,height,settings.theme,format,...battleYomiRows.map(row=>row.amount+':'+Math.round(row.y))].join('|');if(c._yomiKey===key)return;c._yomiKey=key;
 ctx.clearRect(0,0,width,height);ctx.font='14px "Paperclip Terminal", monospace';ctx.textAlign='right';
 for(let i=0;i<battleYomiRows.length;i++){const row=battleYomiRows[i],opacity=1-(battleYomiRows.length-1-i)*.25;ctx.fillStyle=tint(opacity);if(row.format!==format){row.format=format;row.text=(row.amount<0?'-':'+')+stripNumberMarkup(countNumber(Math.abs(row.amount)))+' '+localText(copy('copy.yomi'));}ctx.fillText(row.text,width-8,Math.round(row.y));}markCanvasPaint(c);
}
function steerBattle(p){const c=$('battleCanvas');if(!c)return;const r=c.getBoundingClientRect();game.commandBattle((p.x-r.left)/r.width*CombatSpace.width,(p.y-r.top)/r.height*CombatSpace.height,true);}
function rememberBattlePositions(simulation){
 const particles=simulation.particles;if(battlePrevious.length!==particles.length*2)battlePrevious=new Float64Array(particles.length*2);for(let i=0;i<particles.length;i++){battlePrevious[i*2]=particles[i].x;battlePrevious[i*2+1]=particles[i].y;}
}
function drawBattle(){
 if(game.state.stage!==3)return;
 const u=game.state.s,c=$('battleCanvas');if(!c||!u)return;
 if(battleOwner!==u){battleResizeObserver.disconnect();battleOwner=u;battleVisual=null;battleSimulation=null;battleSparks=[];battleYomiRows=[];battleLastTime=performance.now();}
 game.setBattlePresenter(battlePresentationReady);
 const visible=!ANDROID_BUILD||mobileElementVisible(c,1),size=ANDROID_BUILD?mobileBattleSize(c,visible,300,125):battleCanvasSize(c);const width=ANDROID_BUILD?size.width:size.width||300,height=ANDROID_BUILD?size.height:size.height||125;if(visible&&(c.width!==width||c.height!==height)){c.width=width;c.height=height;}const ctx=c.getContext('2d');
 const b=u.engagement;if(b&&b.serial!==battleVisual){battleYomiRows=[];battleSnapshot=b;battleVisual=b.serial;battleSimulation=b.simulation;battleParticles=battleSimulation.particles;rememberBattlePositions(battleSimulation);battleSparks=[];battleLastTime=performance.now();battleSpeedScale=CombatSpace.animationRate(game.effectiveSpeed()/game.speedMax());setHTML('battleCurrent',escapeHTML(b.nameParts.map(localText).join(settings.lang==='en'?' ':'')+b.ordinal));}
 const now=performance.now(),real=Math.min(.15,Math.max(0,(now-battleLastTime)/1000)),target=CombatSpace.animationRate(game.effectiveSpeed()/game.speedMax());battleLastTime=now;battleSpeedScale+=(target-battleSpeedScale)*(-Math.expm1(-real/.3));const dt=game.state.paused?0:settings.motion?real*battleSpeedScale:120;
 const oldEvents=battleSimulation?.events.length||0;if(b)battleSimulation=game.stepBattlePresentation(dt,rememberBattlePositions,16);
 if(battleSimulation)for(let i=oldEvents;i<battleSimulation.events.length;i++){const e=battleSimulation.events[i];for(let n=0;n<4;n++)battleSparks.push({x:e.x,y:e.y,vx:Math.cos(n*Math.PI/2+e.time)*20,vy:Math.sin(n*Math.PI/2+e.time)*20,life:.55});}
 let kept=0;for(const p of battleSparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life>0)battleSparks[kept++]=p;}battleSparks.length=kept;if(kept>100)battleSparks.splice(0,kept-100);
 const outcome=battleSimulation?.combatEnded;setHTML('battleResult',outcome?localText(battleSimulation.draw?copy('copy.withdrawal'):battleSimulation.win?copy('copy.victory'):copy('copy.defeat')):'');setHTML('battleRatio',outcome?localText(copy('copy.loss-ratio'))+' '+(battleSnapshot.lostEnemy>0?decimalNumber(battleSnapshot.lostOwn/battleSnapshot.lostEnemy,2)+' : 1':(battleSnapshot.lostOwn>0?'1':'0')+' : 0'):'');
 drawBattleYomi(real);if(!visible){c._battleSettled=null;return;}const settled=!b&&!battleSparks.length,key=width+':'+height+':'+settings.theme+':'+battleVisual;if(settled&&c._battleSettled===key)return;c._battleSettled=settled?key:null;markCanvasPaint(c);ctx.clearRect(0,0,width,height);if(!battleSimulation)return;
 const fraction=b?clamp((b.remainder||0)*30,0,1):1;
 for(let i=0;i<battleSimulation.particles.length;i++){const p=battleSimulation.particles[i];if(p.alive&&p.x>-8&&p.x<308&&p.y>-8&&p.y<CombatSpace.height+8){ctx.fillStyle=p.side?'rgba(210,35,40,'+(.35+.35*p.hp/p.maxHp)+')':tint(.4+.35*p.hp/p.maxHp);const x=Math.round((battlePrevious[i*2]+(p.x-battlePrevious[i*2])*fraction)*width/CombatSpace.width),y=Math.round((battlePrevious[i*2+1]+(p.y-battlePrevious[i*2+1])*fraction)*height/CombatSpace.height);if(p.side){ctx.fillRect(x-2,y,5,1);ctx.fillRect(x,y-2,1,5);}else ctx.fillRect(x-1,y-1,3,3);}}
 for(const p of battleSparks){ctx.fillStyle=tint(p.life/.55*.8);ctx.fillRect(Math.round(p.x*width/CombatSpace.width),Math.round(p.y*height/CombatSpace.height),2,2);}

}
