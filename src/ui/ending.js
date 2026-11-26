// 来自作者自己的黑洞渲染项目（baopinsui & EDLSDPSY）。
let endingBackground=null,endingUIOwner=null,endingUIStage=-1,endingExitQueue=new Map(),endingToolsHover=false,endingLayoutDirty=true;
window.addEventListener('resize',()=>{const b=endingBackground;if(b?.ready&&!b.finished){const now=performance.now();paintEndingBackground(now,0,true);b.last=now;}});
function disposeEndingBackground(){if(!endingBackground)return;const b=endingBackground;endingBackground=null;for(const r of [b.ascii,b.dots])r?.dispose();b.canvas.remove();$('viewport').style.removeProperty('opacity');}
function endingInk(rgb){return settings.theme==='amber'?[1,.57,.12]:rgb.map(n=>n/255);}
function createEndingBackground(){
 if(endingBackground?.owner===game)return endingBackground;
 disposeEndingBackground();const canvas=document.createElement('canvas');canvas.id='blackHoleBackground';canvas.setAttribute('aria-hidden','true');$('crtGlass').prepend(canvas);$('viewport').style.opacity=String(BH_ENDING_CONFIG.params.uiOpacity);
 return endingBackground={owner:game,canvas,ctx:canvas.getContext('2d',{alpha:false}),ink:endingInk(visualRGB.split(',').map(Number)),ascii:null,dots:null,ready:false,preparing:false,last:performance.now(),painted:-Infinity,blend:1};
}
async function prepareEndingBackground(b){
 if(b.preparing||b.ready)return;if(game.evaporationProgress()===1){b.ready=true;paintEndingBackground(performance.now(),0,true);return;}b.preparing=true;
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,0))));
 if(endingBackground!==b)return;
 for(const [key,style]of (ANDROID_BUILD&&screenTransition?.kind!=='ending'?[['dots',1]]:[['ascii',2],['dots',1]])){const renderer=new BlackHoleRenderer(document.createElement('canvas'),{...BH_ENDING_CONFIG.params,fxBase:0,style},{specialize:true,deferCompile:true});renderer.screenInk=b.ink;renderer.time=BH_ENDING_CONFIG.time;if(game.state.end.motion){renderer.time=game.state.end.motion.time;renderer.importMotion(game.state.end.motion.state);}b[key]=renderer;}
 const renderers=[b.ascii,b.dots].filter(Boolean);await Promise.all(renderers.map(r=>r.compile()));if(endingBackground!==b)return;
 for(const renderer of renderers){renderer.draw(performance.now(),0,true);renderer.gl.flush();}for(const renderer of renderers)renderer.gl.finish();
 b.ready=true;b.last=performance.now();paintEndingBackground(b.last,0,true);
}
function refreshEndingColor(rgb){const b=endingBackground,ink=endingInk(rgb);if(!b||b.ink.every((n,i)=>n===ink[i]))return;b.ink=ink;for(const r of [b.ascii,b.dots])if(r){r.screenInk=ink;r.postDirty=true;}if(b.ready){b.painted=-Infinity;b.finished=false;paintEndingBackground(performance.now(),0,false,true);}}
function endingMotionRate(){const min=game.speedMin(),max=game.speedMax(),position=clamp(Math.log(game.state.speed/min)/Math.log(max/min),0,1);return Math.pow(3,2*position-1);}
function paintEndingBackground(now,delta,force=false,postOnly=false){
 const b=endingBackground;if(!b?.ready||b.finished)return;
 const progress=game.evaporationProgress(),mass=Math.cbrt(1-progress),motionDelta=delta*endingMotionRate();
 if(!force&&now-b.painted<1000/BH_ENDING_CONFIG.params.fps-.2)return;
 const w=innerWidth,h=innerHeight;if(b.canvas.width!==w||b.canvas.height!==h){b.canvas.width=w;b.canvas.height=h;}
 const ctx=b.ctx;ctx.globalAlpha=1;ctx.fillStyle='rgb('+b.ink.map(n=>(2+2*mass)*n).join(',')+')';ctx.fillRect(0,0,w,h);
 if(progress<1){
  // 底色单独淡出。吸积盘和背景回形针共用一次发光叠加。
  ctx.globalCompositeOperation='lighter';
  for(const [renderer,alpha]of [[b.dots,b.blend],[b.ascii,1-b.blend]]){
   if(!renderer)continue;
   renderer.evaporation=null;renderer.params.mass=mass;renderer.diskISCO=renderer.isco();renderer.advance(motionDelta);if(alpha<=0)continue;
   renderer.evaporation={elapsed:1-mass,duration:1,initialMass:1,complete:false};renderer.screenMask=settings.crt?screenBackdrop.dark:null;renderer.postDirty=true;const paused=renderer.params.paused;if(postOnly)renderer.params.paused=1;renderer.draw(now,0,force);renderer.params.paused=paused;
   ctx.globalAlpha=alpha;if(ANDROID_BUILD)mobileDrawEnding(ctx,renderer.canvas,w,h);else ctx.drawImage(renderer.canvas,0,0,w,h);
  }
  ctx.globalCompositeOperation='source-over';const renderer=b.blend<.5?b.ascii:b.dots;game.state.end.motion={time:renderer.time,state:renderer.exportMotion()};
 }
 if(progress===1){for(const renderer of [b.ascii,b.dots])renderer?.dispose();b.ascii=b.dots=null;b.finished=true;}ctx.globalAlpha=1;markCanvasPaint(b.canvas);b.painted=now;
}
function startEndingTransition(){startScreenTransition();if(!screenTransition)return;screenTransition.kind='ending';createEndingBackground().blend=0;$('viewport').style.opacity='0';}
function presentReopening(t,image){
 releaseTransitionImage(t);t.image=image;Object.assign(t,transitionBeam(image));t.reopening=true;t.raw=true;
 $('crtGlass').append(t.canvas);t.canvas.classList.add('crt-transition');screenRenderer?.presentation(t.canvas);music.effect(t,'power',TRANSITION_FX.openLine+TRANSITION_FX.openScreen+TRANSITION_FX.settle+TRANSITION_SOUND.release);
}
function tickEndingTransition(now){
 const t=screenTransition;if(!t||t.owner!==game){cancelScreenTransition();return;}const b=endingBackground,delta=Math.max(0,(now-t.last)/1000);t.last=now;if(document.hidden)return;
 const cold=transitionEnds[2]+.13;t.elapsed+=Math.min(delta,.1);
 if(t.elapsed>=cold&&!b.ready){t.elapsed=cold;paintScreenTransition(t,t.elapsed);prepareEndingBackground(b);return;}
 if(t.elapsed>=transitionEnds[1]&&!t.reopening&&t.image)releaseTransitionImage(t,true);
 if(t.elapsed>=transitionEnds[3]&&!t.reopening){const image=document.createElement('canvas');image.width=b.canvas.width;image.height=b.canvas.height;image.getContext('2d').drawImage(b.canvas,0,0);presentReopening(t,image);}
 if(t.elapsed<transitionEnds[6]){paintScreenTransition(t,t.elapsed);t.canvas.style.opacity='1';markCanvasPaint(t.canvas);screenRenderer?.tick(now);return;}
 if(!t.opened){t.opened=true;b.last=now;screenRenderer?.presentation(null);t.canvas.remove();}
 const time=t.elapsed-transitionEnds[6],config=BH_ENDING_CONFIG,blend=smoothStep(clamp((time-config.asciiHold)/config.styleFade,0,1));b.blend=blend;
 const age=now-b.last;if(age>=1000/config.params.fps-.2){if(b.blend===1&&b.ascii){b.ascii.dispose();b.ascii=null;}paintEndingBackground(now,age/1000);b.last=now;}
 const show=time-config.asciiHold-config.styleFade-config.dotHold;$('viewport').style.opacity=show<0?'0':String(BH_ENDING_CONFIG.params.uiOpacity*contentFlickerOpacity(show*1000));
 screenRenderer?.tick(now);
 if(show>=1.35){$('viewport').style.opacity=String(BH_ENDING_CONFIG.params.uiOpacity);cancelScreenTransition();render();}
}
function endingRow(label,id,until){return readout(label,'<span id="'+id+'"></span>').replace('<div ','<div data-end-until="'+until+'" ');}
function retireEndingElement(el){endingLayoutDirty=true;el.classList.add(el.classList.contains('top-tools')?'end-tools-hidden':'end-gone');el.style.removeProperty('opacity');}
function endingLayout(){return section(copy('copy.power-and-matter'),'',endingRow(copy('copy.power'),'endPower',4)+'<div data-end-until="4">'+powerSourcesHTML()+'</div>'+endingRow(copy('copy.available-energy'),'endCharge',6)+'<div class="space-unmined">'+endingRow("<span data-help=\"{{copy.stellar-matter-within-your-reach-awaiting-extraction-and}}\">{{copy.unprocessed}}</span>",'endUnmined',3)+'</div><div class="space-inventory">'+endingRow(copy('copy.harvested-matter'),'endGathered',8)+endingRow(copy('copy.machines'),'endEquipment',8)+endingRow(copy('copy.light-elements-2'),'endLight',3)+endingRow(copy('copy.paperclip-reserves'),'endClips',8)+'</div>'+endingRow(copy('copy.collection-rate'),'endHarvest',3)+endingRow(copy('ending.fabrication'),'endProduction',5))+section(copy('copy.probe-design'),'',endingRow(copy('copy.autonomy'),'endAutonomy',2)+endingRow(copy('copy.cruise-speed'),'endCruise',2)+Object.entries(designLabels).filter(([key])=>key!=='combat'||game.has('combat')).map(([key,label])=>endingRow(label,'endDesign-'+key,2)).join(''));}
function initializeEndingUI(){
 endingUIOwner=game;endingUIStage=game.state.dismantle;endingExitQueue.clear();
 for(const el of document.querySelectorAll('[data-end-until]')){el.classList.remove('end-gone','end-tools-hidden');el.style.removeProperty('opacity');}
 setHTML('manualControl',action('manual',copy('copy.make-a-paperclip'),'manual')+'<span id="finalMetal" class="hidden"></span>');
 const until=(selector,n)=>{const el=document.querySelector(selector);if(el)el.dataset.endUntil=n;};
 until('#probeStatistics .probe-drift',1);until('#probeStatistics .probe-controlled',1);until('#probeStatistics .probe-enemy',1);
 for(const row of document.querySelectorAll('#probeStatistics .readout'))if(!row.dataset.endUntil)row.dataset.endUntil=2;
 until('#computingRate',10);until('#industrialYomi',7);until('#insight',10);until('#storageCapacity',11);until('#ops',11);
 for(const id of ['computingRate','industrialYomi','insight','storageCapacity','ops']){const el=$(id);if(el){const row=el.closest('.readout');row.dataset.endUntil=el.dataset.endUntil;delete el.dataset.endUntil;}}
 until('.top-tools',9);until('#opsBar',11);$('opsBar').parentElement.dataset.endUntil=11;delete $('opsBar').dataset.endUntil;
 $('projects').parentElement.querySelector('.section-head').dataset.endUntil=11;
 $('timeDock').dataset.endUntil=9;
 for(const el of document.querySelectorAll('[data-end-until]'))if(game.state.dismantle>=Number(el.dataset.endUntil))retireEndingElement(el);
}
function queueEndingExit(){
 const s=game.state;if(endingUIOwner!==game)initializeEndingUI();if(endingUIStage===s.dismantle)return;
 let delay=0;const now=performance.now();for(const el of document.querySelectorAll('[data-end-until]'))if(s.dismantle>=Number(el.dataset.endUntil)&&!el.classList.contains('end-gone')&&!el.classList.contains('end-tools-hidden')&&!endingExitQueue.has(el)){endingExitQueue.set(el,now+delay);delay+=180;}
 endingUIStage=s.dismantle;
}
function reviewEndingCredits(journal){
 const s=game.state;if(s.ending!=='clips'||!s.end.credits||s.end.creditReview)return false;
 s.end.creditReview=true;journal.querySelector('.ending-credit-space')?.remove();resetJournalScroll();journal.scrollTop=Math.max(0,journal.scrollHeight-journal.clientHeight);dirtySave=true;return true;
}
function tickEndingCredits(){
 const e=game.state.end;if(!e.credits||e.creditReview)return;
 const journal=$('journal'),first=journal.querySelector('[data-ending-credit]');if(!first)return;
 let space=journal.querySelector('.ending-credit-space');if(!space){space=document.createElement('div');space.className='ending-credit-space';space.setAttribute('aria-hidden','true');journal.append(space);}
 const height=journal.clientHeight+'px';if(space.style.height!==height)space.style.height=height;
 const start=first.getBoundingClientRect().top-journal.getBoundingClientRect().top+journal.scrollTop-journal.clientHeight;
 resetJournalScroll();journal.scrollTop=Math.max(0,start+(e.quiet-5)*journalLineHeight(journal)/3.5);
}
function tickEndingUI(now,real,blocked){
 const s=game.state,dock=$('timeDock');if(s.stage!==4){timeAttentionOpacity=1;if(screenRenderer?.mode==='browser')dock.style.removeProperty('--time-attention-opacity');if(endingBackground)disposeEndingBackground();return;}
 if(blocked||s.paused){if(endingBackground)endingBackground.last=now;}if(!blocked){game.advanceEndingReal(real);if(!s.ending){const b=createEndingBackground();if(!b.ready)prepareEndingBackground(b);else if(!s.paused&&!b.finished&&now-b.last>=1000/BH_ENDING_CONFIG.params.fps-.2){paintEndingBackground(now,settings.motion?(now-b.last)/1000:0);b.last=now;}}}
 const ramp=s.end.ramp,span=game.endingRampSeconds,envelope=smoothStep(clamp(ramp/.8,0,1))*smoothStep(clamp((span-ramp)/1.5,0,1)),attention=1-.52*envelope*Math.sin(Math.PI*ramp/2.4)**2;timeAttentionOpacity=attention;if(screenRenderer?.mode==='browser')dock.style.setProperty('--time-attention-opacity',String(attention));
 for(let [el,start]of endingExitQueue){start=elementExitTime(el,start,now);endingExitQueue.set(el,start);if(now>=start&&tickElementExit(el,now-start,retireEndingElement))endingExitQueue.delete(el);}
 const tools=document.querySelector('.top-tools');if(tools.classList.contains('end-tools-hidden')){const target=(ANDROID_BUILD?mobile.toolsRevealed:endingToolsHover)?1:0,current=Number(tools.style.opacity)||0,next=current+(target-current)*(-Math.expm1(-real/.12)),opacity=String(Math.abs(target-next)<.002?target:next);if(tools.style.opacity!==opacity)tools.style.opacity=opacity;}
 if(endingLayoutDirty){endingLayoutDirty=false;for(const root of [$('management'),$('centralControls')])for(const section of root.querySelectorAll('.section,.space-unmined,.space-inventory,.resource-pair')){const rows=[...section.querySelectorAll('[data-end-until]')];if(rows.length&&rows.every(el=>el.classList.contains('end-gone')))section.style.display='none';}
 if(s.dismantle>=10&&$('computingRate')?.closest('.readout').classList.contains('end-gone'))$('storageCapacity').closest('.resource-pair').classList.add('end-memory-only');}
 if(s.ending==='clips'){const t=s.end.quiet-3;$('manualControl').style.opacity=t<0?'1':t>=1.35?'0':String(contentFlickerOpacity((1.35-t)*1000)*(1-t/1.35));if(t>=1.35)$('manualControl').style.visibility='hidden';renderJournal();tickEndingCredits();}
}
function endingValue(id,value){const el=$(id),row=el?.closest('[data-end-until]');if(!row||game.state.dismantle<Number(row.dataset.endUntil))setHTML(id,value);}
function renderDismantle(){
 const s=game.state,u=s.s;queueEndingExit();
 renderPowerSources();endingValue('endPower',wattNumber(game.spacePower()));endingValue('endCharge',siNumber(game.endingAvailableEnergy(),'J')+' ('+(game.spaceCapacity()>0?game.endingAvailableEnergy()/game.spaceCapacity()*100:0).toFixed(1)+'%)');endingValue('endUnmined',kg(game.engineeringRemaining()));endingValue('endGathered',kg(u.industry+u.lightKg+s.clipsKg));endingValue('endEquipment',kg(u.industry));endingValue('endLight',kg(u.lightKg));endingValue('endClips',kg(s.clipsKg));endingValue('endHarvest',massPerYear(u.last.harvestRate));endingValue('endProduction',massPerYear(u.last.clipRate));
 const statistics=$('probeStatistics');statistics.classList.toggle('war',u.war);for(const [id,key]of [['probesLaunched','launched'],['probesArrived','arrived'],['probesFlying','inFlight'],['probesDrifted','drifters'],['probesDestroyed','destroyed']])endingValue(id,countNumber(u[key]));endingValue('probesDestroyed',countNumber(u.destroyed)+' <small>('+localText(copy('project.combat.name'))+' '+countNumber(u.warLosses)+')</small>');endingValue('probesAvailable',countNumber(u.inFlight+u.arrived));endingValue('probesEnemyDestroyed',countNumber(Math.max(0,u.drifted-u.drifters)));endingValue('probeDestroyedLabel',copy('copy.destroyed-ours'));endingValue('probeDriftLabel',copy('copy.drifted'));endingValue('drifterMatter',kg(game.drifterControlledMass()));endingValue('wreckMass',kg(u.wreck));
 endingValue('endAutonomy',countNumber(game.autonomy()));endingValue('endCruise',u.cruiseBeta.toFixed(2)+'c');for(const [key,value]of Object.entries(u.design))endingValue('endDesign-'+key,countNumber(value));endingValue('computingRate',computeNumber(game.computeRate()));endingValue('storageCapacity',storageNumber(game.operationsCapacity()));endingValue('ops',storageNumber(s.ops));endingValue('opsPercent','('+Math.min(100,s.ops/Math.max(1,game.operationsCapacity())*100).toFixed(1)+'%)');if(s.dismantle<11)$('opsBar').style.width=clamp(s.ops/Math.max(1,game.operationsCapacity()),0,1)*100+'%';endingValue('insight',countNumber(s.insight));endingValue('industrialYomi',countNumber(s.yomi));if(game.evaporationProgress()===1)endingValue('computingRate','-');
 disableAction('manual',s.dismantle<11||!!s.end.forming||!s.finalHand);$('finalMetal').classList.toggle('hidden',s.dismantle<11);if(s.dismantle>=11)setHTML('finalMetal',localText(copy('copy.material'))+'：'+(s.end.forming?(u.finalMetal>=1?scientificNumber(u.finalMetal,4)+' kg':decimalNumber(u.finalMetal*1000,1)+localText(copy('copy.g'))):(s.finalHand?String(s.finalHand):'0.0')+localText(copy('copy.g'))));
 $('production').style.visibility='hidden';
}
function endingProjectsHTML(){
 const s=game.state,p=game.evaporationProgress(),t=s.tasks.find(t=>t.id==='dismantle');let html='';
 if(s.dismantle<8)html="<article class=\"project task\" data-project-card=\"hawking\"><div class=\"project-title\">{{copy.hawking-radiation-recovery}}</div><div class=\"project-desc\">{{copy.recover-the-mass-energy-released-by-evaporating-black}}</div><div class=\"progress-label\"><span>"+(p*100).toFixed(1)+'%</span><span>'+duration((1-p)*3e120*game.C.year)+'</span></div><div class="bar"><i style="width:'+p*100+'%"></i></div></article>';
 if(s.dismantle>=11||s.end.wait>0||s.dismantle===7&&p<1)return html;
 const title=s.dismantle===10?copy('copy.disassemble-memory'):copy('copy.dismantle')+game.dismantleNames[s.dismantle],desc=[copy('copy.dismantle-the-drifters-probes-take-over-their-remaining'),copy('copy.dismantle-all-remaining-probes'),copy('copy.dismantle-all-drones-and-associated-facilities'),copy('copy.dismantle-the-power-generation-facilities'),copy('copy.convert-industrial-facilities-into-paperclips'),copy('copy.dismantle-the-energy-storage-facilities'),copy('copy.dismantle-computing-units-to-recover-trace-amounts-of'),copy('copy.recover-the-remaining-facilities'),copy('copy.dismantle-the-sensors'),copy('copy.dismantle-processors-to-recover-minute-amounts-of-material'),copy('copy.dismantle-memory-to-recover-minute-amounts-of-material')][s.dismantle];
 return html+'<article class="project'+(t?' task':' ready')+'" data-project-card="dismantle-'+s.dismantle+'"><div class="project-title">'+title+'</div><div class="project-desc">'+desc+'</div><div class="project-bottom"><span class="cost">'+(t?localText(copy('copy.remaining'))+' '+duration(t.remaining):game.dismantleDays()?localText(copy('copy.duration'))+' '+duration(game.dismantleDays()):'')+'</span><button data-action="dismantle" '+(game.canDismantle()?'':'disabled')+'>'+localText(t?copy('copy.dismantling'):copy('copy.dismantle'))+'</button></div>'+(t?'<div class="bar"><i style="width:'+100*(1-t.remaining/t.total)+'%"></i></div>':'')+'</article>';
}
