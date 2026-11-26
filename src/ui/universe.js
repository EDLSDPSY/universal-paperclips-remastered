function powerSourcesHTML(){return '<div id="powerSources" class="resource-pair power-sources hidden">'+[copy('copy.stars'),copy('copy.fusion-plants'),copy('copy.accretion'),copy('copy.hawking-radiation'),copy('project.gravity-recovery.name')].map((name,i)=>readout(name,'<span id="powerSource'+i+'"></span>')).join('')+'</div>';}
function renderPowerSources(){
 const el=$('powerSources');if(!el)return;const s=game.state,u=s.s,flow=u.last.instantPower||u.last,power=game.spacePower(),nuclear=s.stage===3?(flow.nuclearPower||0):0,accretion=s.stage===3?(flow.accretionPower||0):0;
 const recovery=s.stage===3?(flow.gravitationalPower||0):0,values=s.stage===4?[0,0,0,power,0]:[flow.stellarPower??Math.max(0,power-nuclear-accretion-recovery),nuclear,accretion,0,recovery];
 el.classList.toggle('hidden',s.stage===3&&!game.has('nucleosynthesis')&&!game.has('gravityRecovery'));values.forEach((value,i)=>setHTML('powerSource'+i,decimalPercent(power>0?value/power:0,4)));$('powerSource4').closest('.readout').classList.toggle('hidden',s.stage!==3||!game.has('gravityRecovery'));
}
function spaceResourcesHTML(){
 return section(copy('copy.power-and-matter'),'',readout(copy('copy.power'),'<span id="power" class="power-summary"></span>')+powerSourcesHTML()+readout(copy('copy.available-energy'),'<span id="storedEnergy"></span>')+"<div id=\"storageTargetControl\" class=\"readout storage-target\"><span id=\"storagePowerLabel\" data-help=\"{{copy.choose-how-much-power-goes-to-charging}}\">{{copy.power-for-energy-storage}}</span><input id=\"storageTarget\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" aria-label=\"{{copy.power-for-energy-storage}}\"><span id=\"storageTargetValue\"></span></div><div class=\"space-unmined resource-pair\">"+readout("<span data-help=\"{{copy.stellar-matter-within-your-reach-awaiting-extraction-and}}\">{{copy.unprocessed}}</span>","<span><span id=\"unminedMatter\"></span> (<span>{{copy.metals}}</span> <span id=\"unminedMetalFraction\"></span>)</span>")+readout(copy('copy.black-holes'),'<span id="blackHoleMatter"></span>')+'</div><div class="space-inventory">'+readout(copy('copy.harvested-matter'),'<span id="gatheredMatter"></span>')+readout(copy('copy.machines'),'<span id="equipmentMatter"></span>')+readout(copy('copy.light-elements-2'),'<span id="lightMatter"></span>')+readout(copy('copy.paperclip-reserves'),'<span id="spaceClips"></span>')+'</div>');
}
function probeDesignHTML(){return section(copy('copy.probe-design'),"<span>{{copy.estimated-power-consumption}}</span> <b id=\"probePowerEstimate\"></b>",readout(copy('copy.autonomy'),'<div class="probe-points"><span id="autonomy"></span><small id="autonomyCost" class="trust-unused"></small>'+action('autonomy-up','+','tiny')+'</div>')+"<div class=\"allocation design\" id=\"cruiseControl\"><span class=\"allocation-top\">{{copy.cruise-speed}}</span><input id=\"betaInput\" type=\"range\" min=\"5\" max=\"50\" step=\"1\" aria-label=\"{{copy.cruise-speed}}\"><b id=\"cruiseBeta\"></b></div>"+'<div class="probe-design-grid">'+[['industry','clips','replication'],['shield','fidelity','combat']].map(keys=>'<div>'+keys.map(k=>{const label=designLabels[k];return '<div class="readout probe-design-row'+(['combat','fidelity'].includes(k)?' hidden':'')+'" id="probe-design-'+k+'"><span>'+label+'</span><div class="probe-points">'+action('design-down-'+k,'-','tiny')+'<b id="design-'+k+'"></b>'+action('design-up-'+k,'+','tiny')+'</div></div>';}).join('')+'</div>').join('')+'</div>');}
function probeStatisticsHTML(){
 const row=(label,id,area,rowId='')=>readout(label,'<span id="'+id+'"></span>','probe-'+area).replace('<div ','<div'+(rowId?' id="'+rowId+'"':'')+' ');
 return section(copy('copy.probe'),'','<div id="probeStatistics" class="probe-statistics">'+row(copy('copy.launched'),'probesLaunched','launched')+row(copy('copy.available-2'),'probesAvailable','available')+row(copy('copy.in-flight'),'probesFlying','flying')+row(copy('copy.arrived'),'probesArrived','arrived')+row("<span id=\"probeDriftLabel\">{{copy.missing}}</span>",'probesDrifted','drift','probeDriftRow')+row("<span id=\"probeDestroyedLabel\">{{copy.destroyed}}</span>",'probesDestroyed','destroyed')+row(copy('copy.destroyed-enemy'),'probesEnemyDestroyed','enemy','probeEnemyDestroyedRow')+row(copy('copy.drifter-control'),'drifterMatter','controlled','drifterControlRow')+row(copy('copy.wreckage'),'wreckMass','wreck')+'</div>');
}
function probeBalanceHTML(){return "<div id=\"probeBalance\" class=\"hidden\" aria-label=\"{{universe.probe-2}}\"><i></i><i></i></div>";}
function renderProbeBalance(){
 const u=game.state.s,el=$('probeBalance');if(!el)return;
 const visible=u.battleCount>0;el.classList.toggle('hidden',!visible);if(!visible)return;
 const own=u.arrived+u.inFlight,total=own+u.drifters,width=(total>0?Math.round(own/total*1000)/10:0)+'%';
 if(el.firstElementChild.style.width!==width)el.firstElementChild.style.width=width;
}
function stellarEngineeringHTML(){
 const controls=['kilonovaShare','collapseShare'].map((key,i)=>'<div class="allocation"><span class="allocation-top" data-help="'+(i?copy('copy.fraction-of-mass-that-becomes-black-holes-the'):copy('copy.choose-the-share-of-equipment-assigned-to-kilonova'))+'">'+(i?copy('copy.black-holes-from-kilonovae'):copy('copy.equipment-for-kilonova-furnaces'))+'</span><input data-engineering="'+key+'" type="range" min="0" max="100" step="1"><b id="'+key+'Value"></b><span class="engineering-output"><span>'+(i?copy('copy.black-hole-production'):copy('copy.heavy-element-synthesis'))+'</span> <span id="'+key+'Output"></span></span></div>').join('');
 return '<div id="stellarEngineering" class="hidden">'+section(copy('copy.stellar-engineering'),'','<div class="resource-pair engineering-controls">'+controls+'</div>')+'</div>';
}
function spaceLayout(){return spaceResourcesHTML()+probeDesignHTML()+'<div class="probe-estimates resource-pair">'+readout(copy('copy.estimated-accident-losses'),'<span id="probeHazardEstimate"></span>')+'<div id="probeDriftEstimateRow">'+readout(copy('copy.estimated-drift-rate'),'<span id="probeDriftEstimate"></span>')+'</div></div>'+stellarEngineeringHTML();}
function decimalPercent(fraction,digits=3){if(!(fraction>0))return '0%';if(fraction>=1)return (100).toFixed(Math.max(0,digits-3))+'%';const p=fraction*100,places=Math.max(0,digits-1-Math.floor(Math.log10(p))),text=p.toFixed(Math.min(100,places));return (Number(text)>=100?(100-10**(2-digits)).toFixed(Math.max(0,digits-2)):text)+'%';}
function blackHoleDisplayMass(mass){
 const solar=game.C.sunMass,m=mass/solar;if(m<5)return 0;if(m>=10000)return mass;
 const node=n=>5+7*n+2*Math.sin(n*2.399963229728653),index=Math.max(0,Math.floor((m-5)/7));let n=index;if(node(n)>m)n--;else if(node(n+1)<=m)n++;
 const discrete=node(n)*solar,blend=smoothStep((m-1000)/9000);return discrete+(mass-discrete)*blend;
}
let spaceReadoutOwner=null,spaceReadoutSample=null,spaceReadoutYear=0;
function spaceReadouts(){
 const s=game.state,u=s.s,current={power:game.spacePower(),radius:u.radius,light:u.lightKg,equipment:u.industry,clips:s.clipsKg};
 if(spaceReadoutOwner!==u){spaceReadoutOwner=u;spaceReadoutSample=current;spaceReadoutYear=u.years;}
 if(!u.coarse){spaceReadoutSample=current;spaceReadoutYear=u.years;return current;}
 const interval=1/Math.cbrt(StellarSpace.settings.density)/Math.max(100,u.systemCount)/Math.max(.05,game.frontierBeta());
 if(u.years-spaceReadoutYear>=interval||u.years<spaceReadoutYear){spaceReadoutSample=current;spaceReadoutYear=u.years;}
 const blend=smoothStep(u.model.transition),display={};for(const key of Object.keys(current))display[key]=spaceReadoutSample[key]+(current[key]-spaceReadoutSample[key])*blend;
 return display;
}
function renderSpace(){renderSpaceControls();renderSpaceEngineering();renderProbeStatistics();renderSpaceBattle();}
function renderSpaceControls(){
 renderPowerSources();
 const s=game.state,u=s.s,d=spaceReadouts(),matter=d.equipment+d.clips+d.light,inventory=game.engineeringInventory();
 const unmined=inventory.remaining<=u.engineering.origin*Number.EPSILON*8?0:displayMass(inventory.remaining);setHTML('unminedMatter',kg(unmined));setHTML('unminedMetalFraction',unmined===0?'-':decimalNumber(inventory.metalFraction*100,1)+'%');setHTML('blackHoleMatter',kg(blackHoleDisplayMass(u.blackHoleKg)));$('blackHoleMatter').closest('.readout').classList.toggle('hidden',u.blackHoleKg<5*game.C.sunMass);
 setHTML('probePowerEstimate',decimalPercent(game.probePowerFraction()));setHTML('probeHazardEstimate',decimalPercent(game.spaceHazard()));$('probeHazardEstimate').closest('.readout').classList.toggle('hidden',!game.has('survey'));document.querySelector('.probe-estimates').classList.toggle('hidden',!game.has('survey')&&!u.war);$('probeDriftEstimateRow').classList.toggle('hidden',!u.war);setHTML('probeDriftEstimate',decimalPercent(game.driftProbability()));
 setHTML('power','<span>'+wattNumber(d.power)+' <span class="kardashev">(K'+((Math.log10(Math.max(1,d.power))-6)/10).toFixed(2)+')</span></span>');setHTML('gatheredMatter',kg(matter));
 const storedFraction=game.spaceCapacity()>0?u.charge/game.spaceCapacity():0;setHTML('lightMatter',kg(d.light));setHTML('equipmentMatter',kg(d.equipment));setHTML('spaceClips',kg(d.clips));setHTML('storedEnergy',siNumber(u.charge,'J')+' ('+(storedFraction*100).toFixed(1)+'%)');syncInput('storageTarget',u.storageTarget*100);const boost=!!u.acceleration,active=boost?(u.last.accelerationPower||0):(u.last.chargingPower||0),fraction=active>0?u.storageTarget:0;setHTML('storagePowerLabel',boost?copy('copy.fleet-acceleration'):copy('copy.power-for-energy-storage'));$('storageTarget').setAttribute('aria-label',localText(boost?copy('copy.fleet-acceleration'):copy('copy.power-for-energy-storage')));$('storageTarget').dataset.actualFill=String(storedFraction*100);styleRange($('storageTarget'));setHTML('storageTargetValue',(fraction*100).toFixed(0)+'%');
 setHTML('autonomyCost',game.has('autonomy1')&&game.autonomy()<game.autonomyLimit()?countNumber(game.autonomyQuote())+copy('interface.yomi'):'');const used=Object.values(u.design).reduce((a,b)=>a+b,0);setHTML('autonomy',countNumber(game.autonomy())+' <small class="trust-unused">('+countNumber(game.autonomy()-used)+')</small>');$('autonomy').dataset.help=localText(copy('copy.unassigned-points'))+': '+countNumber(game.autonomy()-used);disableAction('autonomy-up',u.completedMap||game.autonomy()>=game.autonomyLimit()||s.yomi<game.autonomyQuote());document.querySelector('[data-action="autonomy-up"]').classList.toggle('hidden',!game.has('autonomy1'));document.querySelector('[data-action="autonomy-up"]').dataset.help=stripNumberMarkup(countNumber(game.autonomyQuote()))+' '+localText(copy('copy.yomi'));for(const k of Object.keys(designLabels)){setHTML('design-'+k,countNumber(u.design[k]));disableAction('design-down-'+k,u.design[k]===0);disableAction('design-up-'+k,used>=game.autonomy()||u.design[k]>=game.designLimit(k));}for(const k of ['combat','fidelity'])$('probe-design-'+k).classList.toggle('hidden',k==='fidelity'?!u.firstAttackEnded:!game.has(k));
 $('cruiseControl').classList.toggle('hidden',!!game.broadcastReadiness());$('betaInput').max=u.speedCap*100;syncInput('betaInput',u.beta*100);setHTML('cruiseBeta',u.cruiseBeta.toFixed(2)+'c'+(u.acceleration?' → '+u.beta.toFixed(2)+'c':''));disableAction('launchProbe',!game.canLaunchProbe());if(u.automatic&&$('manualControl').childNodes.length)setHTML('manualControl','');
 if(!u.automatic){const q=game.launchQuote();$('manualControl').dataset.help=localText(copy('copy.equipment-committed'))+' '+stripNumberMarkup(kg(q.mass))+' · '+localText(copy('copy.light-elements-2'))+' '+stripNumberMarkup(kg(q.fuel))+' · '+localText(copy('copy.electricity-storage'))+' '+stripNumberMarkup(siNumber(q.energy,'J'));}else delete $('manualControl').dataset.help;
}
function renderSpaceEngineering(){const s=game.state,u=s.s;$('stellarEngineering').classList.toggle('hidden',!game.has('kilonova'));const kilonovaAvailable=u.lightKg+u.drifterStock.light>0||u.engineering.cohorts.some(r=>r.covered&&r.light+r.heavy>0);for(const key of ['kilonovaShare','collapseShare']){const el=document.querySelector('[data-engineering="'+key+'"]');el.closest('.allocation').classList.toggle('hidden',!game.has('kilonova'));el.disabled=!kilonovaAvailable;el.value=u.engineering[key]*100;styleRange(el);setHTML(key+'Value',decimalNumber(u.engineering[key]*100,0)+'%');setHTML(key+'Output',kg((u.last[key==='collapseShare'?'kilonovaBlackHoleRate':'kilonovaMetalRate']||0)*game.C.year*game.C.day).replace('</span>',localText(copy('copy.year-2'))+'</span>'));}
}
function renderProbeStatistics(){const u=game.state.s;renderProbeBalance();
 const statistics=$('probeStatistics');statistics.classList.toggle('missing',u.driftSeen&&!u.war);statistics.classList.toggle('war',u.war);
 for(const [id,key]of [['probesLaunched','launched'],['probesArrived','arrived'],['probesFlying','inFlight'],['probesDrifted','drifters'],['probesDestroyed','destroyed']])setHTML(id,countNumber(u[key]));if(u.war)setHTML('probesDestroyed',countNumber(u.destroyed)+' <small>('+localText(copy('project.combat.name'))+' '+countNumber(u.warLosses)+')</small>');setHTML('probesAvailable',countNumber(u.inFlight+u.arrived));setHTML('probesEnemyDestroyed',countNumber(Math.max(0,u.drifted-u.drifters)));setHTML('probeDestroyedLabel',u.war?copy('copy.destroyed-ours'):copy('copy.destroyed'));setHTML('drifterMatter',kg(game.drifterControlledMass()));setHTML('wreckMass',kg(u.wreck));setHTML('probeDriftLabel',u.war?copy('copy.drifted'):copy('copy.missing'));
}
function renderSpaceBattle(){const u=game.state.s;
 game.setBattlePresenter(battlePresentationReady);if(u.war){const exists=$('battleCanvas');setCheckedHTML('battleExtras',section("<span id=\"battleTitle\" data-help=\"{{copy.click-or-drag-to-command-concentrate-your-forces}}\">{{copy.battles}}</span>","<label class=\"check\"><input id=\"battleCalibration\" type=\"checkbox\"><span>{{copy.time-calibration}}</span></label>","<div class=\"battle-frame\"><canvas id=\"battleCanvas\" aria-label=\"{{copy.battle-visualization}}\"></canvas><canvas id=\"battleYomi\" aria-label=\"{{copy.yomi}}\"></canvas><div class=\"battle-result\" id=\"battleResult\"></div><div class=\"battle-ratio\" id=\"battleRatio\"></div><div class=\"battle-current\" id=\"battleCurrent\"></div></div>"));$('battleCalibration').checked=u.battleCalibration!==false;if(!exists)drawBattle();}
}
function updateSpaceVizCoordinate(radius=spaceReadouts().radius){const u=game.state.s;setHTML('vizCoord',localText(copy('copy.expansion-boundary'))+': '+(u.hasFrontier?plain(radius,3)+'ly':'-'));drawCosmicScale();}
function drawCosmicScale(){
 const c=$('cosmicScale'),width=Math.round(c.clientWidth),height=22;if(!width)return;
 const u=game.state.s,position=clamp(1+Math.log10(Math.max(Number.MIN_VALUE,u.radius)/OBSERVABLE_RADIUS)/10,0,1),x=Math.round(4+(width-8)*position),key=[width,x,u.hasFrontier,visualRGB].join(':');
 if(c._scaleKey===key)return;c._scaleKey=key;c.width=width;c.height=height;
 const ctx=c.getContext('2d'),left=4.5,right=width-4.5,y=14.5;ctx.strokeStyle=tint(.6);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.moveTo(left,y-4);ctx.lineTo(left,y+4);
 // 五段各跨 100 倍。每段的两端画大刻度。
 for(let section=0;section<5;section++){
  const end=left+(right-left)*(section+1)/5;ctx.moveTo(end,y-4);ctx.lineTo(end,y+4);
  for(let tick=1;tick<=5;tick++){const at=left+(right-left)*(section+tick/6)/5;ctx.moveTo(at,y-2);ctx.lineTo(at,y+2);}
 }
 ctx.stroke();if(u.hasFrontier){ctx.fillStyle=tint(1);ctx.beginPath();ctx.moveTo(x-3,5);ctx.lineTo(x+3,5);ctx.lineTo(x,11);ctx.closePath();ctx.fill();}markCanvasPaint(c);
}
function updateSpaceVizLabels(){
 const u=game.state.s,d=spaceReadouts(),cosmic=u.intergalactic&&u.radius>3e5,controlled=game.controlledStructures(),count=controlled.estimated?'~'+countNumber(controlled.count):decimalNumber(Math.floor(controlled.count),0);
 setHTML('vizCode',cosmic?u.radius>3e7?copy('viz.cosmic-web'):copy('viz.local-group'):u.radius<250?u.hasFrontier?copy('viz.local-stars'):copy('viz.departure'):copy('viz.milky-way'));
 setHTML('vizMode',u.radius<100?copy('viz.stellar-neighbourhood'):u.gathered/game.C.galaxy>.5?copy('viz.expansion-mode'):copy('viz.expansion-front'));
 updateSpaceVizCoordinate(d.radius);setHTML('vizScale','');
 setHTML('vizCaption',localText(controlled.kind)+(settings.lang==='en'?': ':'：')+count);setHTML('vizState','<b>'+decimalPercent(game.harvestProgress(),4)+'</b> '+localText(copy('copy.universe-explored')));setHTML('topCode',copy('viz.universe-object'));
}

document.addEventListener('input',e=>{if(e.target.dataset.engineering){game.engineeringSet(e.target.dataset.engineering,Number(e.target.value)/100);queueRender();}});
