// 这段代码放在游戏模型内部，和项目及存档共用同一个状态。
function swarmActive(){return has('dyson');}
function swarmEquipment(){let u=S.p.swarm;return u.pv+u.harvester+u.factory+u.battery+u.researchMetalKg;}
function groundMatter(){let p=S.p;return p.pv+p.orbital+p.harvester+p.factory+p.battery+p.raw+p.researchMetalKg+Math.max(0,S.clipsKg-p.swarm.clips);}
function swarmMatter(){let p=S.p,u=p.swarm;return swarmEquipment()+u.raw+u.clips+p.stellarCoil+p.lightRaw;}
function equipmentMass(){let p=S.p;return p?p.pv+p.orbital+p.harvester+p.factory+p.battery+p.researchMetalKg+swarmEquipment()+p.stellarCoil:0;}

function beginEarth(){
  S.stage=2;S.stageDays=0;S.speed=Math.min(S.speed,10);
  let mass=Math.max(S.h.assets,6.02e8),seed={pv:mass*.35,battery:mass*.02,harvester:mass*.28,factory:mass*.35,orbital:0,raw:2e8};
  S.clipsKg=Math.min(S.clipsKg,C.earth-sum(seed));
  S.p={...seed,phase:'surface',earth:C.earth-sum(seed)-S.clipsKg,asteroids:C.asteroids,asteroidTaken:0,origin:C.earth,
    extractE:SURFACE.rockE,fabricationE:SURFACE.fabricationE,spaceFabricationE:SOLAR.fixedFabricationEnergy,
    specific:SURFACE.orbitalSpecific,temperature:500,biomass:SURFACE.biomass,richMatter:SURFACE.richMatter,
    charge:seed.battery*SURFACE.storageJ*.5,swarm:emptySwarm(),autoBalance:false,storageTarget:.5,
    thermalLimitReached:false,infrastructureFull:false,recycle:0,researchMetalKg:0,transferMode:'devices',transferredKg:0,
    worlds:{...SOLAR.worlds},worldAlloc:{mercury:.25,venus:.25,mars:.25,others:.25},worldsTaken:0,worldMining:false,stellarCoil:0,sunRemaining:C.sunMass,stellarTaken:0,lightRaw:0,
    alloc:{pv:.32,harvester:.28,factory:.34,orbital:0,battery:.01,clips:.05},preset:'growth',
    spentJ:0,last:{}};
  refreshResearchCosts();log(copy('copy.all-of-earth-s-resources-are-now-available'));
}
function solarEfficiency(){return has('pete')?benefit('pete','光电效率'):has('tandemPV')?benefit('tandemPV','光电效率'):.25;}
function orbitalSolarEfficiency(){if(has('selectiveFilm'))return benefit('selectiveFilm','光电效率');let efficiency=solarEfficiency();for(const d of orbitalEfficiencyProjects)if(has(d.id))efficiency*=d.benefits.轨道光电效率倍数;return efficiency;}
function beamEfficiency(){return has('coldLaser')?benefit('coldLaser','输电效率'):has('phasedLaser')?benefit('phasedLaser','输电效率'):has('lowLossLaser')?benefit('lowLossLaser','输电效率'):.42;}
function surfaceIrradiance(){return has('cloudClearing')?SURFACE.clearIrradiance:SURFACE.surfaceIrradiance;}
function surfaceDeposit(){
  let p=S.p,kind=p.biomass>0?'biomass':p.richMatter>0?'rich':'rock';
  let base=kind==='biomass'?SURFACE.biomassE:kind==='rich'?SURFACE.richE:SURFACE.rockE;
  return {kind,remaining:kind==='biomass'?p.biomass:kind==='rich'?p.richMatter:p.earth,energy:base*p.extractE/SURFACE.rockE};
}
function groundStorageSpecific(completed=S.completed){for(let id of ['carbonSMES','roomSMES','storageFlywheel'])if(completed.includes(id))return benefit(id,'储能比能量J每kg');return SURFACE.storageJ;}
function swarmStorageSpecific(){return has('orbitalGravity')?benefit('orbitalGravity','储能比能量J每kg'):groundStorageSpecific();}
function surfaceSpecs(){let cooling=(has('twoPhaseCooling')?benefit('twoPhaseCooling','比功率倍数'):1)*(has('ceramics')?benefit('ceramics','比功率倍数'):1);return {harvester:SURFACE.harvesterW*cooling*(has('groundAutomation')?benefit('groundAutomation','采集比功率倍数'):1),factory:SURFACE.factoryW*cooling*(has('parallelAssembly')?benefit('parallelAssembly','制造比功率倍数'):1),storageJ:groundStorageSpecific()};}
function thermalCapacity(temperature){return .9*C.sigma*C.earthArea*(temperature**4-290**4);}
function groundTargets(){
  let surface=C.earthArea*SURFACE.clearIrradiance*.45,thermal=thermalCapacity(SURFACE.maxTemperature);
  let power=surface+(thermal-surface)*SURFACE.receiverEfficiency,rate=power/(SOLAR.fixedExtractEnergy+SOLAR.fixedFabricationEnergy);
  return {power,thermal,pv:C.earthArea*SURFACE.pvMassPerArea,
    orbital:(power-surface)/(SOLAR.fixedOrbitalSpecific*SOLAR.fixedBeamEfficiency),
    harvester:rate*SOLAR.fixedExtractEnergy/SOLAR.fixedHarvesterSpecific,
    factory:rate*SOLAR.fixedFabricationEnergy/SOLAR.fixedFactorySpecific};
}
function groundAtLimit(key){let p=S.p;return ['pv','orbital','harvester','factory'].includes(key)&&p[key]>=groundTargets()[key]*(1-1e-12);}
function groundCoreFull(){return has('chemicalLaunch')&&['orbital','harvester','factory'].every(groundAtLimit);}
function launchSystem(){let id=['massdriver','orbitalRing','skyhook','launchLoop','microwaveLaunch','nuclearLaunch','chemicalLaunch'].find(has);return id&&!has('ion')?{id,energy:swarmActive()?SOLAR.transferEnergy:benefit(id,'发射能耗J每kg')}:{id:null,energy:0};}
// 激光效率已经包含冷却用电，算发电需求时不用再加一次。
function laserMiningEfficiency(){let efficiency=SOLAR.laserEfficiency;for(const d of laserCoolingProjects)if(has(d.id))efficiency=Math.min(efficiency,d.benefits.有效激光效率);return efficiency;}
function laserMiningEnergy(){let energy=SOLAR.ionOpticalEnergy/laserMiningEfficiency();for(const d of laserEnergyProjects)if(has(d.id))energy*=d.benefits.采掘能耗倍数;return energy;}
function worldMiningEnergy(key){return SOLAR.worldOpticalEnergy[key]/SOLAR.ionOpticalEnergy*laserMiningEnergy();}
function normalizeWorldAllocation(){
  let p=S.p,keys=Object.keys(p.worlds).filter(k=>p.worlds[k]>0),weight=keys.reduce((n,k)=>n+p.worldAlloc[k],0);
  for(let k in p.worlds)p.worldAlloc[k]=p.worlds[k]>0?(weight>0?p.worldAlloc[k]/weight:1/keys.length):0;
}
function setWorldAllocation(key,value){
  let p=S.p;if(!p||!p.worldMining||has('starLifting')||!(p.worlds[key]>0)||!Number.isFinite(value))return false;
  normalizeWorldAllocation();value=clamp(value,0,1);let other=Object.keys(p.worlds).filter(k=>k!==key&&p.worlds[k]>0),weight=other.reduce((n,k)=>n+p.worldAlloc[k],0);
  if(!other.length)value=1;
  for(let k of other)p.worldAlloc[k]=weight>0?p.worldAlloc[k]*(1-value)/weight:(1-value)/other.length;
  p.worldAlloc[key]=value;S.revision++;return true;
}
// 每开采完一个目标，就按剩余天体的组成继续分配能量。
function worldMiningSegment(){
  let p=S.p,flow=0,first=Infinity,weights={};
  for(let k in p.worlds){let perJ=p.worlds[k]>0?p.worldAlloc[k]/worldMiningEnergy(k):0;weights[k]=perJ;flow+=perJ;if(perJ>0)first=Math.min(first,p.worlds[k]/perJ);}
  return {kind:'worlds',remaining:sum(p.worlds),energy:flow>0?1/flow:laserMiningEnergy(),segmentLimit:flow>0?first*flow:0,weights};
}
function spaceSpecificGain(){return 1+allSpacePowerProjects.reduce((gain,d)=>gain+(has(d.id)?d.benefits.太空设备基础比功率增幅:0),0);}
function miningSpecific(){if(!has('ion'))return SOLAR.fixedHarvesterSpecific;return SOLAR.laserSpecific*(1+laserPowerProjects.reduce((n,d)=>n+(has(d.id)?d.benefits.激光采掘基础比功率增幅:0),0))*spaceSpecificGain();}
function swarmFactorySpecific(){let multiplier=1;for(const d of spaceManufacturingProjects)if(has(d.id))multiplier*=d.benefits.太空制造比功率倍数;return SOLAR.fixedFactorySpecific*multiplier*spaceSpecificGain();}
function swarmDeposit(){
  let p=S.p;
  if(!has('ion')){let energy=SOLAR.asteroidEnergy;for(let d of asteroidMiningProjects)if(has(d.id))energy-=SOLAR.asteroidEnergy*d.benefits.小行星开采基础能耗降幅;return {kind:'asteroids',remaining:has('asteroids')?p.asteroids:0,energy};}
  if(p.earth>0)return {kind:'earth',remaining:p.earth,energy:laserMiningEnergy()};
  let other=sum(p.worlds);if(p.worldMining&&other>0)return worldMiningSegment();
  if(has('starLifting'))return {kind:'star',remaining:Math.max(0,C.sunMass*SOLAR.metalFraction-(p.stellarTaken-p.lightRaw)),energy:has('stellarSeparation')?benefit('stellarSeparation','重元素提取比能耗J每kg'):SOLAR.stellarEnergy/SOLAR.metalFraction};
  return {kind:'none',remaining:0,energy:laserMiningEnergy()};
}
function newSolarSpecific(){return SOLAR.photovoltaicSpecific*orbitalSolarEfficiency()/.45*spaceSpecificGain();}
function swarmPotential(){
  let optical=S.p.swarm.pv*newSolarSpecific()/orbitalSolarEfficiency();
  return {optical,power:Math.min(C.sunPower,optical)*orbitalSolarEfficiency(),coverage:clamp(optical/C.sunPower,0,1)};
}
function planetRates(){
  let p=S.p;if(!p)return {};
  let gain=solarEfficiency()/.25,pvLimit=C.earthArea*SURFACE.pvMassPerArea,thermalCap=thermalCapacity(p.temperature),thermalTarget=thermalCapacity(SURFACE.maxTemperature);
  let surfacePotential=Math.min(C.earthArea*surfaceIrradiance()*solarEfficiency(),p.pv*surfaceIrradiance()*solarEfficiency()/SURFACE.pvMassPerArea);
  let surfaceSolar=has('ion')?0:surfacePotential,orbitalGeneration=p.orbital*p.specific*gain;
  let potential=has('chemicalLaunch')&&!has('ion')?Math.min(orbitalGeneration*beamEfficiency(),Math.max(0,thermalCap-surfaceSolar)*SURFACE.receiverEfficiency):0;
  let beamed=has('receivers')?potential:0,receiverHeat=beamed*(1/SURFACE.receiverEfficiency-1);
  let groundPower=has('ion')?0:Math.min(surfaceSolar+beamed,Math.max(0,thermalCap-receiverHeat));
  if(swarmActive()&&!has('ion'))groundPower=groundTargets().power;
  let space=swarmPotential(),spacePower=swarmActive()?space.power:0,beamInput=beamed/Math.max(1e-12,beamEfficiency());
  let groundStorage=p.battery*groundStorageSpecific(),orbitalStorage=p.swarm.battery*swarmStorageSpecific(),power=groundPower+spacePower;
  return {surfaceSolar,surfacePotential,pvLimit,groundStorage,orbitalStorage,storage:groundStorage+orbitalStorage,
    thermalCap,thermalTarget,radCap:thermalCap,spacePower:swarmActive()?spacePower:orbitalGeneration,groundPower,power,
    computingPower:computingPower(power),freeSpacePower:spacePower,beamInput,beamPotential:potential,beamed,receiverHeat,
    beamLoss:beamInput-beamed,beamEfficiency:beamEfficiency(),coverage:clamp(p.pv/pvLimit,0,1),solarCoverage:space.coverage,
    kardashev:(Math.log10(Math.max(1,power))-6)/10};
}
function groundRecipeEnergy(key,recycled=false){return recycled?SURFACE.remeltE:key==='clips'?SURFACE.clipE:S.p.fabricationE;}
function solarPowerFullyUsed(){
  if(S.stage!==2||!swarmActive())return false;
  const r=planetRates(),p=S.p,u=p.swarm,deposit=swarmDeposit(),feed=u.raw>rawProjectReserve(true)||u.recycle>0||deposit.remaining>0;
  const manufacturing=feed&&phase2keys.some(k=>p.alloc[k]>0&&k!=='pv'&&(k!=='orbital'||r.solarCoverage<1))?u.factory*swarmFactorySpecific():0;
  const harvesting=deposit.remaining>0&&(manufacturing>0||rawProjectReserve(true,true)>u.raw)?u.harvester*miningSpecific():0;
  const overhead=feed?r.freeSpacePower*(surfaceComputeShare()+(S.tasks.length ? .02 : 0)):0;
  // 刚暂停回收时，用电读数可能还没更新。发射前还要看回收设备是否仍在使用。
  return r.solarCoverage>=1&&(p.last.spacePowerUsed||0)>=r.freeSpacePower*.99&&manufacturing+harvesting+overhead>=r.freeSpacePower*.99;
}
function spaceRecipeEnergy(key,recycled=false){return recycled?SURFACE.remeltE:key==='clips'?SURFACE.clipE:S.p.spaceFabricationE;}
function productiveKeys(){return swarmActive()?['orbital','harvester','factory']:has('chemicalLaunch')?['orbital','harvester','factory']:['pv','harvester','factory'];}
function stopSurfaceExpansion(){
  let p=S.p;if(swarmActive())return;
  let locked=phase2keys.filter(k=>k==='pv'&&(has('chemicalLaunch')||groundAtLimit('pv'))||k==='orbital'&&(!has('chemicalLaunch')||groundAtLimit(k))||['harvester','factory'].includes(k)&&groundAtLimit(k));
  let released=locked.reduce((n,k)=>n+p.alloc[k],0);for(let k of locked)p.alloc[k]=0;
  if(groundCoreFull()){if(!p.infrastructureFull){for(let k of phase2keys)p.alloc[k]=0;p.infrastructureFull=true;log(copy('copy.surface-industry-completed'));}else{let weight=p.alloc.battery+p.alloc.clips;if(weight>0){p.alloc.battery/=weight;p.alloc.clips/=weight;}}return;}
  let keys=productiveKeys().filter(k=>!locked.includes(k)),weight=keys.reduce((n,k)=>n+p.alloc[k],0);
  if(released>0&&keys.length){if(weight>0)for(let k of keys)p.alloc[k]+=released*p.alloc[k]/weight;else for(let k of keys)p.alloc[k]+=released/keys.length;}
}
function openOrbitalGeneration(){S.p.phase='orbit';stopSurfaceExpansion();let a=S.p.alloc,share=a.harvester+a.factory+a.orbital,target=Math.min(.1,share),pair=a.harvester+a.factory;if(pair>0){a.harvester*=Math.max(0,share-target)/pair;a.factory=Math.max(0,share-target-a.harvester);}else a.factory=Math.max(0,share-target);a.orbital=target;}
function setPreset(name){
  if(!S.p||!['growth','production','orbital','ion'].includes(name)||name==='orbital'&&!has('chemicalLaunch')||name==='ion'&&!has('ion'))return false;
  let p=S.p,production=name==='production';
  p.alloc=swarmActive()?{pv:0,orbital:production?.12:.118,harvester:production?.2:.486,factory:production?.23:.381,battery:.01,clips:production?.44:.005}:
    has('chemicalLaunch')?{pv:0,orbital:production?.449:.799,harvester:.03,factory:.07,battery:.001,clips:production?.45:.1}:
    production?{pv:.22,harvester:.15,factory:.17,orbital:0,battery:.01,clips:.45}:{pv:.32,harvester:.28,factory:.34,orbital:0,battery:.01,clips:.05};
  stopSurfaceExpansion();p.preset=name;return true;
}
function allocate(key,value){
  let p=S.p;if(!p||!phase2keys.includes(key)||!Number.isFinite(value)||key==='pv'&&(swarmActive()||has('chemicalLaunch')||groundAtLimit('pv'))||key==='orbital'&&!has('chemicalLaunch')||!swarmActive()&&['orbital','harvester','factory'].includes(key)&&groundAtLimit(key))return false;
  value=clamp(value,0,.98);let old=phase2keys.reduce((n,k)=>n+(k===key?0:p.alloc[k]),0),left=1-value;
  for(let k of phase2keys)if(k!==key)p.alloc[k]=old>1e-12?p.alloc[k]*left/old:0;
  if(old<=1e-12){let fallback=productiveKeys().find(k=>k!==key&&(swarmActive()||!groundAtLimit(k)))||(key==='clips'?'battery':'clips');p.alloc[fallback]=left;}
  p.alloc[key]=value;p.preset='custom';stopSurfaceExpansion();return true;
}
function autoBalanceAvailable(){return S.stage===2&&has('autoBalance')&&(!swarmActive()||has('logisticsBalance'));}
function setAutoBalance(enabled){if(!autoBalanceAvailable())return false;S.p.autoBalance=!!enabled;return true;}
function setStorageTarget(value){if((S.stage!==3&&!autoBalanceAvailable())||!Number.isFinite(value)||value<0||value>1)return false;(S.stage===3?S.s:S.p).storageTarget=value;return true;}
function canTransferRaw(){return S.stage===2&&swarmActive()&&!has('ion')&&S.p.swarm.pv>0&&S.p.swarm.factory>0;}
function setTransferMode(mode){if(S.stage!==2||!swarmActive()||has('ion')||!['devices','raw'].includes(mode)||mode==='raw'&&!canTransferRaw())return false;if(S.p.transferMode!==mode){S.p.transferMode=mode;S.revision++;}return true;}
function earthTransferRate(){
  let p=S.p;if(!swarmActive()||has('ion')||p.earth<=0)return 0;
  if(p.transferMode==='devices'&&phase2keys.every(k=>k==='pv'||p.alloc[k]===0))return 0;
  return groundTargets().power/earthTransferEnergy();
}
function earthTransferEnergy(){let a=S.p.alloc,weight=phase2keys.reduce((n,k)=>n+(k==='pv'?0:a[k]),0);return SOLAR.fixedExtractEnergy+SOLAR.transferEnergy+(S.p.transferMode==='devices'&&weight>0?phase2keys.reduce((n,k)=>n+(k==='pv'?0:a[k]*(k==='clips'?SURFACE.clipE:SOLAR.fixedFabricationEnergy)),0)/weight:0);}
function beginSwarm(){
  let p=S.p;p.phase='belt';p.infrastructureFull=true;p.autoBalance=false;setPreset('growth');
  log(copy('copy.surface-industry-begins-shipping-machines-to-the-asteroid'));
}
function beginIonMining(){
  let p=S.p,u=p.swarm,groundClips=Math.max(0,S.clipsKg-u.clips);
  p.earth+=p.pv+p.harvester+p.factory+p.battery+p.raw+p.researchMetalKg+groundClips;
  S.clipsKg-=groundClips;u.pv+=p.orbital;
  for(let key of ['pv','harvester','factory','battery','orbital','raw','charge','recycle','researchMetalKg'])p[key]=0;
  p.phase='ion';S.ops=Math.min(S.ops,operationsCapacity());log(copy('copy.laser-mining-apparatus-begins-operating'));
}
function recycle(fraction){
  if(S.stage!==2||!Number.isFinite(fraction))return false;
  let unit=swarmActive()?S.p.swarm:S.p,clips=swarmActive()?unit.clips:S.clipsKg;
  unit.recycle=Math.min(clips,unit.recycle+Math.max(0,clips-unit.recycle)*clamp(fraction,0,1));return true;
}
function storageCorrection(power,overhead,charge,capacity,capacityRate,seconds,controlled){return controlled?clamp((capacity*S.p.storageTarget-charge)/(benefit('autoBalance','调节时间日')*C.day)+capacityRate*S.p.storageTarget/C.day,-charge/seconds,Math.max(0,power-overhead)):0;}
function settleStorage(charge,capacity,generation,work,correction,seconds,controlled){let goal=capacity*(controlled?S.p.storageTarget:1),discharge=Math.max(0,work-generation);if(controlled&&correction<0)discharge=Math.max(discharge,Math.min(work,-correction*seconds,Math.max(0,charge-goal)));let stored=Math.min(Math.max(0,generation-work),Math.max(0,goal-charge));return {charge:clamp(charge+stored-discharge,0,capacity),stored,discharge};}

function balanceSurface(days,r){
  let p=S.p;if(!p.autoBalance||!has('autoBalance')||swarmActive()||groundCoreFull())return;
  let a=p.alloc,spec=surfaceSpecs(),orbital=has('chemicalLaunch'),generation=orbital?'orbital':'pv';
  let generating=(orbital?has('receivers'):r.coverage<1-1e-12)&&!groundAtLimit(generation);
  let keys=(generating?[generation,'harvester','factory']:['harvester','factory']).filter(k=>!groundAtLimit(k)),share=keys.reduce((n,k)=>n+a[k],0);if(share<=0)return;
  let avg=phase2keys.reduce((v,k)=>v+a[k]*groundRecipeEnergy(k),0),mine=surfaceDeposit().energy,launch=a.orbital*launchSystem().energy;
  let equipmentShare=1-a.clips,fleet=p.harvester+p.factory+(generating?p[generation]:0),recycleShare=clamp(recyclableFeedstock(false)/Math.max(1,fleet/Math.max(1e-12,equipmentShare)),0,1);
  let recycleEnergy=equipmentShare>0?phase2keys.filter(k=>k!=='clips').reduce((v,k)=>v+a[k]*groundRecipeEnergy(k,true),0)/equipmentShare:avg;
  avg=avg*(1-recycleShare)+recycleEnergy*recycleShare;mine*=1-recycleShare;
  let overhead=surfaceComputeShare()+(S.tasks.length?.02:0),throughput=Math.max(Number.MIN_VALUE,Math.min(p.harvester*spec.harvester/Math.max(1,mine),p.factory*spec.factory/Math.max(1,avg)));
  let restore=clamp((r.groundStorage*p.storageTarget-p.charge)/(benefit('autoBalance','调节时间日')*C.day*throughput),-(mine+avg+launch)*.8,(mine+avg+launch)*4);
  let demand=Math.max(1,mine+avg+launch+a.battery*spec.storageJ*p.storageTarget+restore),target={harvester:mine/spec.harvester,factory:avg/spec.factory};
  if(generating){let specific=orbital?p.specific*solarEfficiency()/.25*beamEfficiency():surfaceIrradiance()*solarEfficiency()/SURFACE.pvMassPerArea,coefficient=demand/(specific*(1-overhead)),base=orbital?r.surfaceSolar/specific:0,rate=(2*fleet+base)/(sum(target)+coefficient);if(coefficient*rate<=base)rate=2*fleet/Math.max(1,sum(target));for(let k in target)target[k]*=rate;target[generation]=Math.max(0,coefficient*rate-base);}
  else{let total=sum(target);for(let k in target)target[k]*=2*fleet/Math.max(1,total);}
  for(let k of keys){let need=Math.max(0,target[k]-p[k]),remaining=Math.max(0,groundTargets()[k]-p[k]);target[k]=need>=remaining?Math.sqrt(remaining*Math.max(remaining,fleet)):need;}
  let weight=keys.reduce((n,k)=>n+target[k],0);if(weight<=0){for(let k of keys)target[k]=k===generation?0:1;weight=keys.reduce((n,k)=>n+target[k],0);}
  if(weight<=0)return;let alpha=-Math.expm1(-days/benefit('autoBalance','调节时间日'));for(let k of keys)a[k]+=(target[k]*share/weight-a[k])*alpha;
}
function balanceSwarm(days,r){
  let p=S.p,u=p.swarm;if(!p.autoBalance||!autoBalanceAvailable())return;
  let deposit=swarmDeposit(),incoming=p.transferMode==='raw'?earthTransferRate():0;
  if(deposit.remaining===0&&incoming===0&&u.raw===0&&u.recycle===0)return;
  let keys=['orbital','harvester','factory'],share=keys.reduce((n,k)=>n+p.alloc[k],0);if(share<=0)return;
  let fabrication=phase2keys.reduce((n,k)=>n+p.alloc[k]*spaceRecipeEnergy(k),0),mine=deposit.remaining>0?deposit.energy:0;
  let response=benefit('autoBalance','调节时间日')*C.day;
  let rawInput=incoming+Math.max(0,u.raw-rawProjectReserve(true))/response,harvestW=miningSpecific(),factoryW=swarmFactorySpecific();
  let fleet=u.pv+u.harvester+u.factory,coefficient=mine/harvestW+fabrication/factoryW;
  let storageWork=p.alloc.battery*swarmStorageSpecific()*p.storageTarget;
  let q=newSolarSpecific()*(1-surfaceComputeShare()-(S.tasks.length?.02:0));
  // 电力充裕后应尽快少造电站。如果按机群翻倍的时间来调整，效率升级后还可能白造好几年。
  // 给新建储能设备充电属于持续负载。给已有设备补电是临时需求，预留的原料也不算待加工的原料。
  let output=Math.max(0,Math.min(u.factory*factoryW/fabrication,
    (mine>0?u.harvester*harvestW/mine:0)+rawInput,
    (r.freeSpacePower*(1-surfaceComputeShare()-(S.tasks.length?.02:0))+rawInput*mine)/(mine+fabrication+storageWork)));
  let nextFleet=fleet+output*response*share;
  let local=Math.max(0,(nextFleet-fabrication*rawInput/factoryW-fabrication*rawInput/q)/(coefficient+(mine+fabrication+storageWork)/q));
  let photovoltaic=(local*(mine+fabrication+storageWork)+fabrication*rawInput)/q;
  let lightLimited=r.solarCoverage>=1-1e-12;
  if(lightLimited||photovoltaic<=u.pv){local=Math.max(0,(nextFleet-u.pv-fabrication*rawInput/factoryW)/Math.max(1,coefficient));photovoltaic=u.pv;}
  let target={harvester:deposit.remaining>0?Math.max(0,local*mine/harvestW-u.harvester):0,factory:Math.max(0,(local+rawInput)*fabrication/factoryW-u.factory),orbital:lightLimited?0:Math.max(0,photovoltaic-u.pv)};
  if(lightLimited&&sum(target)<=0){target.harvester=mine/harvestW;target.factory=fabrication/factoryW;}
  let weight=sum(target);if(weight<=0)return;
  let alpha=-Math.expm1(-days/benefit('autoBalance','调节时间日'));for(let k of keys)p.alloc[k]+=(target[k]*share/weight-p.alloc[k])*alpha;
}
function takeGroundDeposit(amount,kind){
  let p=S.p;
  p.earth=stockRemainder(p.earth,amount);
  if(kind==='biomass'||kind==='rich'){let key=kind==='biomass'?'biomass':'richMatter';p[key]=stockRemainder(p[key],amount);if(p[key]===0)log(kind==='biomass'?copy('copy.all-human-made-objects-and-biomass-have-been'):copy('copy.concentrated-feedstocks-are-exhausted-mining-shifts-to-low'));}
}
function takeSwarmDeposit(amount,kind){
  let p=S.p;
  if(kind==='asteroids'){p.asteroids=stockRemainder(p.asteroids,amount);p.asteroidTaken+=amount;if(p.asteroids===0){recordMilestone('asteroids');log(copy('copy.accessible-asteroids-exhausted'));}}
  else if(kind==='earth')p.earth=stockRemainder(p.earth,amount);
  else if(kind==='worlds'){let segment=worldMiningSegment(),taken=Production.distribute(amount,segment.weights,p.worlds);for(let k in p.worlds)p.worlds[k]=stockRemainder(p.worlds[k],taken.amounts[k]);p.worldsTaken+=taken.mass;normalizeWorldAllocation();if(sum(p.worlds)===0)recordMilestone('worlds');}
  else if(kind==='star'){let removed=has('stellarSeparation')?amount:amount/SOLAR.metalFraction;p.sunRemaining=stockRemainder(p.sunRemaining,removed);p.stellarTaken+=removed;p.lightRaw+=removed-amount;}
}
function applyProduction(plan,inSpace,recycled,reserve=0){
  let p=S.p,u=inSpace?p.swarm:p;
  for(let key of phase2keys){let amount=plan.output[key]||0;if(key==='clips'){addClipMass(amount);if(inSpace)u.clips+=amount;}else if(key==='orbital'&&inSpace){u.pv+=amount;}else u[key]+=amount;}
  if(recycled){u.recycle=stockRemainder(u.recycle,plan.stockUsed);S.clipsKg=Math.max(0,S.clipsKg-plan.stockUsed);if(plan.stockUsed>0)clipFlow=true;if(inSpace)u.clips=Math.max(0,u.clips-plan.stockUsed);}
  else{let protectedRaw=Math.min(u.raw,reserve);u.raw=protectedRaw+stockRemainder(Math.max(0,u.raw-protectedRaw),plan.stockUsed);}
}
function groundProduction(days,r){
  let p=S.p,sec=days*C.day,spec=surfaceSpecs(),controlled=p.autoBalance&&has('autoBalance'),targets=groundTargets();
  let overhead=groundCoreFull()?0:r.computingPower+(S.tasks.length?r.power*.02:0);
  let correction=storageCorrection(r.groundPower,overhead,p.charge,r.groundStorage,(p.last.groundBatteryRate||0)*spec.storageJ,sec,controlled);
  let supply=Math.min(Math.max(0,r.thermalCap-r.receiverHeat),Math.max(0,controlled?r.groundPower-correction:r.groundPower+p.charge/sec));
  let energy=Math.max(0,(supply-overhead)*sec),work=p.factory*spec.factory*sec,harvestWork=p.harvester*spec.harvester*sec;
  let limits={pv:Math.max(0,targets.pv-p.pv),orbital:has('chemicalLaunch')?Math.max(0,targets.orbital-p.orbital):0,harvester:Math.max(0,targets.harvester-p.harvester),factory:Math.max(0,targets.factory-p.factory)};
  if(has('chemicalLaunch'))limits.pv=0;
  let totals={mine:0,built:0,clips:0,recycled:0,rawUsed:0,launched:0,launchJ:0,workJ:0,battery:0};
  let reserve=rawProjectReserve(false);
  function run(recycled){
    let allocation={...p.alloc};if(recycled)allocation.clips=0;
    for(let iteration=0;iteration<4&&energy>0&&work>0;iteration++){
      let deposit=surfaceDeposit(),recipe=Object.fromEntries(phase2keys.map(k=>[k,groundRecipeEnergy(k,recycled)]));
      let plan=Production.batch({allocation,limits,recipe,extra:{orbital:launchSystem().energy},stock:recycled?recyclableFeedstock(false):Math.max(0,p.raw-reserve),mineEnergy:deposit.energy,mineLimit:recycled?0:Math.min(deposit.remaining,harvestWork/deposit.energy),electricity:energy,work,stopAt:has('chemicalLaunch')&&!groundCoreFull()?['orbital','harvester','factory']:[]});
      if(plan.built===0)break;
      applyProduction(plan,false,recycled,reserve);if(plan.mined>0)takeGroundDeposit(plan.mined,deposit.kind);
      totals.mine+=plan.mined;totals.built+=plan.built;totals.clips+=plan.output.clips||0;totals.recycled+=recycled?plan.stockUsed:0;totals.rawUsed+=recycled?0:plan.stockUsed+plan.mined;totals.launched+=plan.output.orbital||0;totals.launchJ+=plan.extraJ;totals.workJ+=plan.mineJ+plan.fabricationJ+plan.extraJ;totals.battery+=plan.output.battery||0;
      for(let key in limits)limits[key]=Math.max(0,targets[key]-p[key]);if(has('chemicalLaunch'))limits.pv=0;
      energy=plan.electricity;work=plan.work;harvestWork=Math.max(0,harvestWork-plan.mineJ);
      if(recycled||deposit.remaining>plan.mined||groundCoreFull())break;
    }
  }
  run(true);run(false);
  let used=totals.workJ+Math.min(overhead*sec,Math.max(0,supply*sec-totals.workJ));
  let storage=settleStorage(p.charge,p.battery*spec.storageJ,r.groundPower*sec,used,correction,sec,controlled);p.charge=storage.charge;
  stopSurfaceExpansion();
  return {...totals,used,stored:storage.stored,discharged:storage.discharge,correction,reserve,harvestCapacity:p.harvester*spec.harvester/surfaceDeposit().energy,manufacturingCapacity:p.factory*spec.factory/Math.max(1,phase2keys.reduce((n,k)=>n+p.alloc[k]*groundRecipeEnergy(k),0))};
}
function transferFromEarth(days){
  let p=S.p,sec=days*C.day,amount=Math.min(p.earth,earthTransferRate()*sec);
  if(!(amount>0))return {mass:0,energy:0,launchJ:0,battery:0,clips:0};
  p.earth=stockRemainder(p.earth,amount);p.transferredKg+=amount;
  let battery=0,clips=0;
  if(p.transferMode==='raw')p.swarm.raw+=amount;
  else{let allocation={...p.alloc,pv:0},parts=Production.distribute(amount,allocation);for(const key of phase2keys){let mass=parts.amounts[key];if(key==='clips'){p.swarm.clips+=mass;addClipMass(mass);clips=mass;}else if(key==='orbital')p.swarm.pv+=mass;else p.swarm[key]+=mass;}battery=parts.amounts.battery;}
  return {mass:amount,energy:amount*earthTransferEnergy(),launchJ:amount*SOLAR.transferEnergy,battery,clips};
}
function swarmProduction(days,r){
  let p=S.p,u=p.swarm,sec=days*C.day,controlled=p.autoBalance&&autoBalanceAvailable(),deposit=swarmDeposit();
  let hasInputs=deposit.remaining>0||u.raw>0||u.recycle>0;
  let overhead=hasInputs?r.freeSpacePower*surfaceComputeShare()+(S.tasks.length?r.freeSpacePower*.02:0):0;
  let correction=storageCorrection(r.freeSpacePower,overhead,u.charge,r.orbitalStorage,(p.last.orbitalBatteryRate||0)*swarmStorageSpecific(),sec,controlled);
  let supply=Math.max(0,controlled?r.freeSpacePower-correction:r.freeSpacePower+u.charge/sec);
  let energy=Math.max(0,(supply-overhead)*sec),work=u.factory*swarmFactorySpecific()*sec,harvestWork=u.harvester*miningSpecific()*sec;
  let totals={mine:0,built:0,clips:0,recycled:0,rawUsed:0,workJ:0,battery:0,miningJ:{}};let reserve=rawProjectReserve(true);
  function recordMining(joules,source){
    if(source.kind==='earth')totals.miningJ.earth=(totals.miningJ.earth||0)+joules;
    else if(source.kind==='star')totals.miningJ.star=(totals.miningJ.star||0)+joules;
    else if(source.kind==='worlds')for(const key in p.worlds)totals.miningJ[key]=(totals.miningJ[key]||0)+joules*p.worldAlloc[key];
  }
  function run(recycled){
    let allocation={...p.alloc,pv:0};if(recycled)allocation.clips=0;
    let recipe=Object.fromEntries(phase2keys.map(k=>[k,spaceRecipeEnergy(k,recycled)]));
    for(let iteration=0;iteration<Object.keys(p.worlds).length+2&&energy>0&&work>0;iteration++){
      deposit=swarmDeposit();let plan=Production.batch({allocation,recipe,stock:recycled?recyclableFeedstock(true):Math.max(0,u.raw-reserve),mineEnergy:deposit.energy,mineLimit:recycled?0:Math.min(deposit.remaining,deposit.segmentLimit??Infinity,harvestWork/deposit.energy),electricity:energy,work});
      if(!(plan.built>0))break;
      applyProduction(plan,true,recycled,reserve);if(plan.mined>0){recordMining(plan.mineJ,deposit);takeSwarmDeposit(plan.mined,deposit.kind);}
      totals.mine+=plan.mined;totals.built+=plan.built;totals.clips+=plan.output.clips||0;totals.recycled+=recycled?plan.stockUsed:0;totals.rawUsed+=recycled?0:plan.stockUsed+plan.mined;totals.workJ+=plan.mineJ+plan.fabricationJ;totals.battery+=plan.output.battery||0;
      energy=plan.electricity;work=plan.work;harvestWork=Math.max(0,harvestWork-plan.mineJ);
      if(recycled||deposit.kind!=='worlds'||plan.mined<(deposit.segmentLimit??Infinity)*(1-1e-12))break;
    }
  }
  let meltReserve=Math.min(Math.max(0,rawProjectReserve(true)-u.raw),recyclableFeedstock(true),energy/SURFACE.remeltE,work/SURFACE.remeltE);
  if(meltReserve>0){let spent=meltReserve*SURFACE.remeltE;u.recycle=stockRemainder(u.recycle,meltReserve);u.clips=stockRemainder(u.clips,meltReserve);S.clipsKg=stockRemainder(S.clipsKg,meltReserve);if(meltReserve>0)clipFlow=true;u.raw+=meltReserve;energy=Math.max(0,energy-spent);work=Math.max(0,work-spent);totals.recycled+=meltReserve;totals.workJ+=spent;}
  run(true);
  // 开采后可以直接把原料留给建设项目。开采和供电仍用同一份预算。
  deposit=swarmDeposit();let reservedMine=Math.min(Math.max(0,rawProjectReserve(true,true)-u.raw),deposit.remaining,deposit.segmentLimit??Infinity,harvestWork/deposit.energy,energy/deposit.energy);
  if(reservedMine>0){let spent=reservedMine*deposit.energy;recordMining(spent,deposit);takeSwarmDeposit(reservedMine,deposit.kind);u.raw+=reservedMine;energy=Math.max(0,energy-spent);harvestWork=Math.max(0,harvestWork-spent);totals.mine+=reservedMine;totals.workJ+=spent;deposit=swarmDeposit();}
  run(false);
  let used=totals.workJ+Math.min(overhead*sec,Math.max(0,supply*sec-totals.workJ));
  let store=settleStorage(u.charge,u.battery*swarmStorageSpecific(),r.freeSpacePower*sec,used,correction,sec,controlled);u.charge=store.charge;
  return {...totals,used,stored:store.stored,discharged:store.discharge,correction,reserve,harvestCapacity:u.harvester*miningSpecific()/deposit.energy,manufacturingCapacity:u.factory*swarmFactorySpecific()/Math.max(1,phase2keys.reduce((n,k)=>n+p.alloc[k]*spaceRecipeEnergy(k),0))};
}
function planetStep(days){
  let p=S.p,sec=days*C.day;stopSurfaceExpansion();let r=planetRates();
  if(swarmActive())balanceSwarm(days,r);else balanceSurface(days,r);
  let transfer=swarmActive()?transferFromEarth(days):{mass:0,energy:0,launchJ:0};
  let flow=swarmActive()?swarmProduction(days,r):groundProduction(days,r);
  normalizeRecycleStock(swarmActive());
  let groundUsed=swarmActive()?transfer.energy:flow.used,spaceUsed=swarmActive()?flow.used:0;
  let groundStored=0;
  if(swarmActive()&&!has('ion')){let store=settleStorage(p.charge,r.groundStorage,r.groundPower*sec,groundUsed,0,sec,false);p.charge=store.charge;groundStored=store.stored;}
  let used=groundUsed+spaceUsed;p.spentJ+=used;S.energyJ+=used;
  let heat=groundUsed/sec+(groundUsed>0?r.receiverHeat:0);
  p.last={...r,mineRate:(flow.mine+transfer.mass)/days,localMineRate:flow.mine/days,transferRate:transfer.mass/days,
    buildRate:(flow.built+(p.transferMode==='devices'?transfer.mass:0))/days,localBuildRate:flow.built/days,
    rawUsedRate:flow.rawUsed/days,clipRate:(flow.clips+(transfer.clips||0))/days,equipRate:(flow.built-flow.clips+(p.transferMode==='devices'?transfer.mass-(transfer.clips||0):0))/days,
    spaceBuildRate:swarmActive()?flow.built/days:0,groundBatteryRate:swarmActive()?0:flow.battery/days,orbitalBatteryRate:swarmActive()?(flow.battery+(transfer.battery||0))/days:0,
    recycleRate:flow.recycled/days,powerUsed:used/sec,groundPowerUsed:groundUsed/sec,spacePowerUsed:spaceUsed/sec,
    miningPower:Object.fromEntries(Object.entries(flow.miningJ||{}).map(([key,joules])=>[key,joules/sec*(key==='star'?1:laserMiningEfficiency())])),
    launchPower:(transfer.launchJ+(flow.launchJ||0))/sec,launchRate:swarmActive()?transfer.mass/days:flow.launched/days,
    chargeRate:(flow.stored+groundStored-flow.discharged)/sec,chargeInput:(flow.stored+groundStored)/sec,dischargePower:flow.discharged/sec,storageLoss:0,reserve:flow.reserve,
    harvestCapacity:flow.harvestCapacity,manufacturingCapacity:flow.manufacturingCapacity,heat,
    thermalOccupancy:groundIndustrialHeat(planetRates()),
    bottleneck:flow.manufacturingCapacity<flow.harvestCapacity+(p.transferMode==='raw'?earthTransferRate():0)?copy('copy.manufacturing-capacity'):swarmActive()?swarmDeposit().remaining===0&&p.swarm.raw===0?copy('copy.material'):copy('copy.collection-capacity'):r.groundPower+r.receiverHeat>=r.thermalCap*.99?(p.temperature<SURFACE.maxTemperature?copy('copy.radiator-temperature'):copy('copy.surface-heat-rejection')):copy('copy.power-generation-2')};
  if(groundCoreFull()&&p.temperature>=SURFACE.maxTemperature&&beamEfficiency()>=SOLAR.fixedBeamEfficiency&&!p.thermalLimitReached){p.thermalLimitReached=true;recordMilestone('radiators');log(copy('copy.surface-heat-rejection-has-reached-its-limit'));}
  if(!p.surfaceCovered&&planetRates().coverage>=1-1e-12){p.surfaceCovered=true;stopSurfaceExpansion();recordMilestone('photovoltaics');log(copy('copy.photovoltaics-now-cover-the-entire-surface'));}
  if(p.earth===0&&!p.earthAnnounced){p.earthAnnounced=true;recordMilestone('earth');log(copy('copy.earth-has-been-completely-dismantled'));}
  revealProjects();
}

// 按装机额定值计算持续工业负载，设备闲置时也保留这部分容量。
function groundIndustrialHeat(r){
  if(has('ion'))return 0;
  let p=S.p,spec=surfaceSpecs(),extraction=surfaceDeposit().energy,energy=extraction+p.fabricationE;
  let load=Math.min(r.groundPower,p.harvester*spec.harvester/extraction*energy,p.factory*spec.factory/p.fabricationE*energy);
  return r.groundPower>0?load*(1+r.receiverHeat/r.groundPower):0;
}

function rawAvailable(){return S.stage===2?(swarmActive()?S.p.swarm.raw:S.p.raw):0;}
function reclaimEquipment(fraction=.01,scope='all'){
  if(!Number.isFinite(fraction)||fraction<=0||S.stage!==2||!['all','battery'].includes(scope))return false;
  const inSpace=swarmActive();let u=inSpace?S.p.swarm:S.p;fraction=clamp(fraction,0,.1);let mass=0;
  for(const key of scope==='battery'?['battery']:inSpace?['pv','harvester','factory','battery']:['pv','orbital','harvester','factory','battery']){let amount=u[key]*fraction;u[key]-=amount;mass+=amount;}
  if(!(mass>0))return false;u.raw+=mass;let charge=Math.min(u.charge,u.battery*(inSpace?swarmStorageSpecific():groundStorageSpecific())),released=u.charge-charge;u.charge=charge;S.p.spentJ+=released;S.energyJ+=released;S.revision++;return true;
}
function projectMetalAvailable(){return S.stage===2?(swarmActive()?S.p.swarm.clips:S.clipsKg):0;}
function normalizeRecycleStock(inSpace){
  let p=S.p,u=inSpace?p.swarm:p,clips=inSpace?u.clips:S.clipsKg;
  if(u.recycle<=Math.max(Number.MIN_VALUE,clips*Number.EPSILON*8))u.recycle=0;
  return u;
}
function recyclableFeedstock(inSpace){return normalizeRecycleStock(inSpace).recycle;}
function fundProjectMetal(d){
  const inSpace=swarmActive(),u=inSpace?S.p.swarm:S.p,cost=d.cost.recycled,remaining=stockRemainder(projectMetalAvailable(),cost);
  S.clipsKg=stockRemainder(S.clipsKg,cost);if(inSpace)u.clips=remaining;
  // 先用尚未安排重熔的回形针，重熔队列里的回形针也仍属于库存。
  u.recycle=Math.min(u.recycle,remaining);normalizeRecycleStock(inSpace);S.reservedKg+=cost;
}
function installProjectMetal(d,inSpace){if(!d.cost.recycled)return;if(!inSpace&&has('ion'))S.p.earth+=d.cost.recycled;else(inSpace?S.p.swarm:S.p).researchMetalKg+=d.cost.recycled;}
function rawProjectReserve(inSpace,collect=false){if(inSpace!==swarmActive())return 0;return Math.max(0,...materialProjects.filter(d=>visible(d)&&d.requires.every(has)&&(!collect||!d.benefits.仅保留已有原料)).map(d=>d.cost.raw));}
function dismantlingCapacity(){let p=S.p,u=p.swarm,weights=p.alloc;return (weights.orbital>0?u.pv:0)+(weights.harvester>0?u.harvester:0)+(weights.factory>0?u.factory:0)+(weights.battery>0?u.battery:0);}
function projectMatterAvailable(d){return rawAvailable()+(S.stage===2&&d.benefits.允许拆解设备?dismantlingCapacity():0);}
function fundProjectMatter(d){
  let p=S.p,u=swarmActive()?p.swarm:p,cost=d.cost.raw||0,raw=Math.min(u.raw,cost);u.raw=stockRemainder(u.raw,raw);let missing=cost-raw;
  if(missing>0){
    let weights={pv:p.alloc.orbital,harvester:p.alloc.harvester,factory:p.alloc.factory,battery:p.alloc.battery},limits={pv:u.pv,harvester:u.harvester,factory:u.factory,battery:u.battery},parts=Production.distribute(missing,weights,limits);
    
    if(parts.mass<missing*(1-1e-12))throw Error('工程物质不足');
    for(let k in parts.amounts)u[k]=stockRemainder(u[k],parts.amounts[k]);
    u.charge=Math.min(u.charge,u.battery*swarmStorageSpecific());
  }
  S.reservedKg+=cost;
}
function storedElectricity(){return S.stage===2?S.p.charge+S.p.swarm.charge:S.s?S.s.charge:0;}
function spendStoredElectricity(amount){if(S.stage>=3){S.s.charge=stockRemainder(S.s.charge,amount);S.energyJ+=amount;return;}let p=S.p,u=p.swarm,total=p.charge+u.charge;if(total>0){const ground=amount*(p.charge/total),orbital=amount*(u.charge/total);p.charge=stockRemainder(p.charge,ground);u.charge=stockRemainder(u.charge,orbital);}p.spentJ+=amount;S.energyJ+=amount;}
function pioneerBeamEnergy(){let beta=SOLAR.pioneerBeta,gamma=1/Math.sqrt(1-beta*beta);return q('starflight').cost.raw*C.c*C.c*(gamma*(1+beta)-1)/(2*laserMiningEfficiency()*SOLAR.pioneerBeamUse);}
