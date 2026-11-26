 const STELLAR=Object.freeze({fusionLoss:.007,capture:.75,blackHoleWkg:5,companions:.02,nuclearWkg:1,computeEquivalentWkg:62,liftingJkg:1.9e11,kilonovaJkg:1e12,commissionYears:1e5,nucleonKg:1.67e-27,maxCohorts:128});
 function engineeringInit(remaining){
  const u=S.s,light=remaining*50/51,heavy=remaining/51,propellant=Math.min(u.lightKg,u.industry*SPACE.propellantRatio);
  u.engineering={origin:u.origin+remaining,cohorts:[{count:1,light,heavy,initialLight:light,blackHole:0,ejecta:0,clips:S.clipsKg,propellant,collectedLight:u.lightKg-propellant,devices:u.industry+S.clipsKg,luminosity:u.originPower/STELLAR.capture,covered:true,at:0,radius:0}],propellantTotal:propellant,kilonovaShare:0,collapseShare:.2,mapProgress:0,harvestProgress:0,effectiveCopies:probeCopies(),launchEstimate:0,maturePower:u.originPower,computeSupply:1,workJ:0,energyJ:0};
 }
 function equipmentSpecific(){return SPACE.specificPower*(1+.12*designResponse(S.s.design.industry));}
 function prepareKilonova(){S.s.engineering.commissionStart=S.s.years;}
 function commissionKilonova(){S.s.engineering.kilonovaShare=.5;}
 function kilonovaCommissioning(seconds=0){
  const u=S.s,start=u.engineering.commissionStart;if(start===undefined)return 1;
  const x=Math.max(0,(u.years-start)/STELLAR.commissionYears),h=seconds/(C.year*C.day*STELLAR.commissionYears);if(x>=1)return 1;
  if(!(h>0))return x*x*(3-2*x);if(x+h<=1)return x*x*(3-2*x)+3*x*(1-x)*h+(1-2*x)*h*h-.5*h*h*h;
  const tail=1-x;return 1-tail*tail*tail*(1-.5*tail)/h;
 }
 function spaceComputeEquivalentPower(storage=false){const u=S.s;return Math.max(0,u.industry+(storage?S.clipsKg:0)-u.wreck)*Math.max(STELLAR.computeEquivalentWkg,u.originPower/Math.max(1,u.originIndustry+u.originClips));}
 function spaceComputeRating(){return spaceComputeEquivalentPower()*surfaceComputeShare()/computingSpecificEnergy()*C.researchShare*(has('language')?benefit('language','算力倍数'):1)*(has('learning')?benefit('learning','算力倍数'):1);}
 function computeBaseload(){return spaceComputeRating()*1.380649e-23*(has('cold')?1:10)*Math.LN2;}
 function engineeringRemaining(){return S.s.engineering.cohorts.reduce((n,r)=>n+r.light+r.heavy+(r.ejecta||0),0);}
 function engineeringInventory(){const e=S.s.engineering,light=e.cohorts.reduce((n,r)=>n+r.light,0),heavy=e.cohorts.reduce((n,r)=>n+r.heavy+(r.ejecta||0),0),moving=0;return {light,heavy,moving,remaining:light+heavy,metalFraction:light+heavy>0?heavy/(light+heavy):0};}
 function engineeringBlackHoles(){return S.s.engineering.cohorts.reduce((n,r)=>n+r.blackHole,0);}
 function engineeringMatter(r){return r.light+r.heavy+(r.ejecta||0)+(r.collectedLight||0);}
 function engineeringHasRawLight(r){return r.light>Math.max(1,r.initialLight)*1e-13;}
 function engineeringRegister(count,mass,luminosity,seed,radius,at=S.s.years,span=0){
  if(!(mass>0))return;const u=S.s,e=u.engineering,blackHole=mass*SPACE.blackHoleFraction,normal=mass-blackHole,light=normal*50/51;
  const total=e.cohorts.reduce((n,r)=>n+Math.max(0,r.devices-(r.clips||0)),0),moved=Math.min(seed,total);for(const r of e.cohorts)r.devices-=moved*Math.max(0,r.devices-(r.clips||0))/Math.max(1,total);
  const row={count,light,heavy:normal/51,initialLight:light,blackHole,ejecta:0,clips:0,propellant:0,collectedLight:0,devices:moved,luminosity,power:0,covered:false,at,radius,span,newborn:span>0,fluid:span>0,metallicity:1/51};e.cohorts.push(row);e.origin+=mass;u.blackHoleKg+=blackHole;
  if(!span)engineeringCompact();
 }
 function engineeringCompact(time=S.s.years){currentCompact(time);}
 function engineeringSyncStock(){
  const u=S.s,rows=u.engineering.cohorts,available=S.clipsKg+u.drifterStock.clips,industry=Math.max(0,u.industry-u.wreck-u.probe)+Math.max(0,u.drifterStock.industry-u.drifterStock.probe),totalDevices=rows.reduce((n,r)=>n+r.devices,0);let products=rows.reduce((n,r)=>n+(r.clips||0),0);
  if(products===0&&available>0){for(const r of rows)r.clips=available*r.devices/Math.max(1,totalDevices);products=available;}
  const industrial=rows.reduce((n,r)=>n+Math.max(0,r.devices-(r.clips||0)),0);for(const r of rows){const devices=Math.max(0,r.devices-(r.clips||0));r.clips=products>0?(r.clips||0)*available/products:0;r.devices=r.clips+(industrial>0?devices*industry/industrial:0);}
  u.engineering.propellantTotal=rows.reduce((n,r)=>n+(r.propellant||0),0);
 }
 function engineeringStock(key,amount,reserve=0,source=null){
  if(!(amount>0))return 0;
  const u=S.s,b=u.drifterStock,ownKey=key==='light'?'lightKg':key==='clips'?null:'industry',own=key==='clips'?S.clipsKg:u[ownKey],enemy=b[key],held=key==='light'?Math.min(own,Math.max(reserve,(S.s.engineering.propellantTotal||0)*own/Math.max(1,own+enemy))):0,ownFree=key==='industry'?Math.max(0,own-u.probe-u.wreck-(u.recoverySeedKg||0)):own-held,enemyFree=key==='industry'?Math.max(0,enemy-b.probe):enemy,total=ownFree+enemyFree,taken=Math.max(0,Math.min(amount,total,source?(source.collectedLight||0):Infinity)),fraction=total>0?ownFree/total:0;
  if(key==='light'){if(source)source.collectedLight=stockRemainder(source.collectedLight,taken);else{const rows=u.engineering.cohorts,sum=rows.reduce((n,r)=>n+(r.collectedLight||0),0);if(sum>0)for(const r of rows)r.collectedLight=stockRemainder(r.collectedLight||0,taken*(r.collectedLight||0)/sum);}}
  if(key==='clips'){S.clipsKg=stockRemainder(own,taken*fraction);if(taken*fraction>0)clipFlow=true;}else u[ownKey]=held+stockRemainder(own-held,taken*fraction);b[key]=stockRemainder(enemy,taken*(1-fraction));return taken;
 }
 function engineeringProduct(r,light,heavy,clips=heavy*clipFraction()/(1+clipFraction())){
  const u=S.s,share=productiveShare(),devices=heavy-clips;
  r.collectedLight=(r.collectedLight||0)+light;r.clips=(r.clips||0)+clips;r.devices+=heavy;u.industry+=devices*share;addClipMass(clips*share);u.lightKg+=light*share;u.drifterStock.industry+=devices*(1-share);u.drifterStock.clips+=clips*(1-share);u.drifterStock.light+=light*(1-share);u.gathered+=light+heavy;u.stepClipKg+=clips*share;u.harvestedEquipment+=devices;u.harvestedClips+=clips;
 }
 function engineeringExtract(r,mass){const total=r.light+r.heavy+(r.ejecta||0),take=Math.max(0,Math.min(total,mass)),fraction=total>0?take/total:0,light=(r.light)*fraction,heavy=take-light;for(const key of ['light','heavy','ejecta'])if(r[key])r[key]=stockRemainder(r[key],r[key]*fraction);return {light,heavy,mass:take};}
 function engineeringFuel(r,mass,reserve,deviceLimit=0,products=true){
  const u=S.s;let left=mass,taken=engineeringExtract(r,left).mass;left-=taken;
  if(left>0){const free=u.lightKg>0?Math.max(0,1-reserve/u.lightKg)*(u.lightKg+u.drifterStock.light):u.drifterStock.light,light=engineeringStock('light',Math.min(left,free),reserve,r);taken+=light;left-=light;}
  function removeEquipment(mass,clips=false){const rows=u.engineering.cohorts;if(clips){const total=rows.reduce((n,row)=>n+(row.clips||0),0);for(const row of rows){const taken=mass*(row.clips||0)/Math.max(1,total);row.clips=stockRemainder(row.clips||0,taken);row.devices=stockRemainder(row.devices,taken);if(taken>0)delete row.response;}return;}
   const total=rows.reduce((n,row)=>n+Math.max(0,row.devices-(row.clips||0)),0),local=Math.min(Math.max(0,r.devices-(r.clips||0)),mass);r.devices=stockRemainder(r.devices,local);mass-=local;if(mass>0)for(const row of rows){const taken=mass*Math.max(0,row.devices-(row.clips||0))/Math.max(1,total-local);row.devices=stockRemainder(row.devices,taken);if(taken>0)delete row.response;}
  }
  if(left>0&&products){const clips=engineeringStock('clips',left);removeEquipment(clips,true);taken+=clips;left-=clips;}
  if(left>0&&deviceLimit>0&&(r.collectedLight||0)+S.clipsKg+u.drifterStock.clips===0){const seed=u.recoverySeedKg||0,working=u.industry+S.clipsKg+u.drifterStock.industry+u.drifterStock.clips,available=Math.max(0,u.industry-u.probe-u.wreck-seed)+Math.max(0,u.drifterStock.industry-u.drifterStock.probe),devices=engineeringStock('industry',Math.min(left,available,deviceLimit,Math.max(0,r.devices-seed*r.devices/Math.max(1,working))));removeEquipment(devices);taken+=devices;}
  if(taken>0)delete r.response;return taken;
 }
 function engineeringStorageSpecific(changes=null){
  if(!has('whiteDwarfStorage'))return SPACE.storageSpecific;
  if(!has('compactStorage'))return 1e12;
  const rows=S.s.engineering.cohorts;let working=0,capacity=0;
  // 已经运到轨道上的物质不会稀释天体中的黑洞比例。
  for(let i=0;i<rows.length;i++){const r=rows[i],devices=Math.max(0,r.devices-(changes?changes[i*3+2]:0)),hole=r.blackHole+(changes?changes[i*3]:0),matter=Math.max(0,r.light+r.heavy+(r.ejecta||0)-(changes?changes[i*3+1]:0)),fraction=hole>0?hole/(hole+matter):0;working+=devices;capacity+=devices*(1e12+(1e15-1e12)*fraction);}
  return working>0?capacity/working:1e12;
 }
 let storagePlanOwner=null,storagePlanRevealed=-1,storagePlanCompleted=-1,storagePlanTasks=-1,storagePlanned=0;
 function engineeringStorageCapacity(potential=false,connect=true){
  const u=S.s,own=Math.max(0,u.industry+S.clipsKg-u.wreck-u.probe),rows=u.engineering.cohorts;let mass=0,active=0,total=0;
  for(const r of rows){const matter=r.light+r.heavy+(r.ejecta||0),fraction=r.blackHole>0?r.blackHole/(r.blackHole+matter):0,specific=has('compactStorage')?1e12+(1e15-1e12)*fraction:has('whiteDwarfStorage')?1e12:SPACE.storageSpecific,capacity=r.devices*specific;mass+=r.devices;total+=capacity;if(!r.core)active+=capacity;}
  if(!has('whiteDwarfStorage')){const origin=u.originIndustry+u.originClips,capacity=u.originCapacity+Math.max(0,mass-origin)*SPACE.storageSpecific;active=total>0?capacity*active/total:0;total=capacity;}
  const share=own/Math.max(1,mass);total*=share;active*=share;
  if(potential)return total;
  if(storagePlanOwner!==u.engineering||storagePlanRevealed!==S.revealed.length||storagePlanCompleted!==S.completed.length||storagePlanTasks!==S.tasks.length){storagePlanOwner=u.engineering;storagePlanRevealed=S.revealed.length;storagePlanCompleted=S.completed.length;storagePlanTasks=S.tasks.length;storagePlanned=0;for(const id of S.revealed){const d=q(id);if(d?.stage===3&&!has(id)&&!S.tasks.some(t=>t.id===id))storagePlanned=Math.max(storagePlanned,d.cost.electricity||0);}}
  let planned=storagePlanned;
  if(u.completedMap&&(u.massEnergy||has('gravityRecovery')))planned=Math.max(planned,spaceRecoveryProject()?.cost.electricity||0);
  const e=u.engineering;if(connect){const newlyPlanned=planned>(e.storagePlan||0)?planned:0;e.storagePlan=Math.max(e.storagePlan||0,planned);e.connectedCapacity=Math.max(e.connectedCapacity||0,Math.max(u.charge,newlyPlanned)/Math.max(1e-30,share));}
  return Math.max(active,Math.min(total,(e.connectedCapacity||0)*share));
 }
 function engineeringSet(key,value){if(S.stage!==3||!has('kilonova')||!['kilonovaShare','collapseShare'].includes(key)||!Number.isFinite(value)||value<0||value>1)return false;S.s.engineering[key]=value;S.revision++;return true;}
 function accretionEfficiency(){for(const id of ['gravityPower','penroseMirror','diskPolarization','spinUp'])if(has(id))return benefit(id,'质能转换效率');return SPACE.accretionEfficiency;}
 function capturedFusionMass(loss,electricity){return has('neutrinoCapture')?Math.max(0,loss-electricity/(C.c*C.c)):0;}
 function captureFusion(r,loss,electricity){const mass=capturedFusionMass(loss,electricity);r.blackHole+=mass;S.s.blackHoleKg+=mass;S.s.fusionLostKg-=mass;}
 function engineeringBuildDemand(seconds){
  const u=S.s,pD=equipmentSpecific(),years=seconds/(C.year*C.day),growth=probeGrowth()*Math.LN2;
  return u.engineering.cohorts.reduce((n,r)=>n+(r.covered?0:Math.min(r.heavy,Math.max(0,r.luminosity*STELLAR.capture/pD-r.devices),r.devices*Math.expm1(Math.min(60,years*growth)))*SPACE.constructionEnergy*productiveShare()),0);
 }
 function engineeringBudget(energy,room=spaceCapacity()-S.s.charge,normal=energy){
  const u=S.s,e=u.engineering,need=Math.max(0,room)+(e.launchWantedJ||0)+(u.acceleration?.remaining||0),channel=Math.min(normal*u.storageTarget,need),computing=Math.min(Math.max(0,energy-channel),e.baseJ||0),front=Math.min(Math.max(0,energy-channel-computing),e.frontWantedJ||0),transport=Math.min(Math.max(0,energy-channel-computing-front),e.transportDueJ||0);
  return {channel,computing,front,transport,work:Math.max(0,energy-channel-computing-front-transport)};
 }
 function engineeringRequiredEnergy(work,maximum,room=spaceCapacity()-S.s.charge){
  const u=S.s,e=u.engineering,base=(e.baseJ||0)+(e.frontWantedJ||0)+(e.transportDueJ||0)+work,need=Math.max(0,room)+(e.launchWantedJ||0)+(u.acceleration?.remaining||0),share=u.storageTarget;
  return Math.min(maximum,share<1?Math.min(base/(1-share),base+need):base+need);
 }
 function engineeringOpenBudget(seconds,feedJ=0){
  const u=S.s,e=u.engineering,b=engineeringBudget(e.energyJ,spaceCapacity()-u.charge,e.normalJ??e.energyJ);e.channelJ=b.channel;e.workJ=Math.max(0,e.energyJ-b.channel-b.computing-feedJ);e.computeSupply=Math.min(1,b.computing/Math.max(1e-30,computeBaseload()*seconds));u.last.computingPower=b.computing/seconds;
 }
 function engineeringBuild(seconds){
  const u=S.s,e=u.engineering,pD=equipmentSpecific(),years=seconds/(C.year*C.day),growth=probeGrowth()*Math.LN2,share=productiveShare();
  for(const r of e.cohorts)if(!r.covered){const target=r.luminosity*STELLAR.capture/pD,wanted=Math.min(r.heavy,Math.max(0,target-r.devices),r.devices*Math.expm1(Math.min(60,years*growth))),local=u.radius<1e6?r.power*seconds:Infinity,heavy=Math.min(wanted,e.workJ/Math.max(1e-30,SPACE.constructionEnergy*share),local/Math.max(1e-30,SPACE.constructionEnergy*share));r.heavy=stockRemainder(r.heavy,heavy);engineeringProduct(r,0,heavy);r.workDevices=(r.workDevices||0)+heavy*SPACE.constructionEnergy/(pD*seconds);const paid=heavy*SPACE.constructionEnergy*share;e.workJ-=paid;u.stepBuildJ+=paid;if(r.devices>=target*(1-1e-10))r.covered=true;}
 }
 function engineeringPayTransport(seconds=0){
  const u=S.s,e=u.engineering,paid=Math.min(e.transportDueJ||0,e.workJ);u.transportEnergyRemaining=stockRemainder(u.transportEnergyRemaining,paid);e.transportDueJ=stockRemainder(e.transportDueJ||0,paid);e.workJ-=paid;u.stepTransportJ+=paid;
  if(!(seconds>0&&e.transportDueJ>0&&u.completedMap))return;const share=productiveShare(),eff=accretionEfficiency(),unit=eff*C.c*C.c,pD=equipmentSpecific(),rows=[...e.cohorts].sort((a,b)=>engineeringMatter(a)/Math.max(1,a.devices)-engineeringMatter(b)/Math.max(1,b.devices));
  for(const r of rows){if(!(e.transportDueJ>0))break;const capacity=Math.min(Math.max(0,r.devices*pD-(r.power||0)/Math.max(1e-30,share)),r.blackHole*STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions)),wanted=Math.min(e.transportDueJ/Math.max(1e-30,share),capacity*seconds)/unit,fuel=engineeringFuel(r,wanted,0,wanted),energy=fuel*unit*share;r.blackHole+=fuel*(1-eff);u.blackHoleKg+=fuel*(1-eff);u.radiationKg+=fuel*eff;u.accretionJ+=fuel*unit;r.power=(r.power||0)+energy/seconds;u.transportEnergyRemaining=stockRemainder(u.transportEnergyRemaining,energy);e.transportDueJ=stockRemainder(e.transportDueJ,energy);u.stepTransportJ+=energy;e.energyJ+=energy;u.last.power+=energy/seconds;u.last.accretionPower+=energy/seconds;if(u.last.instantPower){u.last.instantPower.power+=energy/seconds;u.last.instantPower.accretionPower+=energy/seconds;}u.nominalPower+=energy/seconds/Math.max(1e-30,share);}
 }
 function recoverSpaceWreck(){
  const u=S.s;if(S.stage!==3||!u?.salvage)return;if(u.completedMap)for(const r of u.engineering.cohorts)if(r.depositedEjecta){delete r.depositedEjecta;delete r.response;}if(!(u.wreck>0))return;
  const e=u.engineering,settled=e.cohorts.filter(r=>r.covered),idle=settled.filter(r=>engineeringMatter(r)<=r.devices*1e-12),r=(idle.length?idle:settled.length?settled:e.cohorts).reduce((best,r)=>!best||(idle.length?r.devices>best.devices:r.at<best.at)?r:best,null),mass=Math.min(u.wreck,u.industry);if(!r)return;
  u.wreck=stockRemainder(u.wreck,mass);u.industry=stockRemainder(u.industry,mass);const recovery=currentRecoveryRegion(r,mass);recovery.ejecta=(recovery.ejecta||0)+mass;if(r.response&&!u.completedMap){r.depositedEjecta=(r.depositedEjecta||0)+mass;if(r.depositedEjecta>r.devices*1e-12){delete r.depositedEjecta;delete r.response;}}else delete r.response;if(engineeringRemaining()>e.origin*1e-12)u.completedHarvest=false;
 }
 function massEnergyExhausted(){const u=S.s;return S.stage===3&&u.completedMap&&u.engineering.cohorts.every(r=>engineeringMatter(r)<STELLAR.nucleonKg||r.devices<STELLAR.nucleonKg);}
 function massEnergyTargets(){
  const project=spaceRecoveryProject();return {ops:project?.cost.ops||0,electricity:project?.cost.electricity||0};
 }
 function spaceRecoveryProject(){
  const u=S.s,heavy=Math.max(0,u.industry+S.clipsKg-u.wreck),capacity=operationsCapacity(),storage=engineeringStorageCapacity(true),unit=accretionEfficiency()*C.c*C.c;
  let best=null,minimum=Infinity;for(const d of spaceProjects){if(['massEnergy','gravityRecovery'].includes(d.id)||has(d.id)||S.tasks.some(t=>t.id===d.id)||!d.requires.every(has))continue;const mass=Math.max((d.cost.ops||0)/Math.max(1e-30,capacity),(d.cost.electricity||0)/Math.max(1e-30,storage))*heavy+(d.cost.clips||0)+(d.cost.electricity||0)/unit;if(mass<minimum){minimum=mass;best=d;}}return best;
 }
 function massEnergyNeeded(){
  if(!massEnergyExhausted())return false;const u=S.s,target=massEnergyTargets();return !u.massEnergy&&(target.ops>S.ops||target.electricity>u.charge)&&S.clipsKg+Math.max(0,u.industry-u.probe-u.wreck)>0;
 }
 function engineeringMassEnergy(seconds){
  const u=S.s,e=u.engineering;if(!u.massEnergy||!massEnergyExhausted()){u.massEnergyRun=null;return;}
  const target=massEnergyTargets(),ops=Math.max(0,Math.min(target.ops,operationsCapacity())-S.ops-computeRate()*seconds),charge=Math.max(0,Math.min(target.electricity,spaceCapacity())-u.charge-(e.channelJ||0));
  if(!(ops>0||charge>0)){u.massEnergyRun=null;return;}
  const speed=speedMax(),horizon=speed*30*C.day,rating=spaceComputeRating()*researchComputeScale(),opJ=computeBaseload()/Math.max(1e-30,rating);let run=u.massEnergyRun;
  if(!run||run.ops!==target.ops||run.electricity!==target.electricity||run.speed!==speed||ops>0&&run.computeRate===0||charge>0&&run.chargePower===0)run=u.massEnergyRun={...target,speed,chargePower:charge/horizon,computeRate:Math.min(rating,ops/horizon)};
  const attainable=Math.min(target.ops,operationsCapacity());if(run.capacity!==attainable){run.capacity=attainable;run.computeRate=Math.min(rating,ops/horizon);}
  const chargeJ=Math.min(charge,run.chargePower*seconds),computeJ=Math.min(ops,run.computeRate*seconds,Math.max(0,rating-computeRate())*seconds)*opJ,wanted=chargeJ+computeJ,share=productiveShare(),eff=accretionEfficiency(),fuelJ=eff*C.c*C.c,pD=equipmentSpecific();let supplied=0;
  // 按最大流速预留约半分钟的需求，实际能缓存多少由硬件的容量和吞吐量决定。
  for(const r of e.cohorts){if(!(wanted>supplied))break;const capacity=Math.min(Math.max(0,r.devices*pD-(r.power||0)/Math.max(1e-30,share)),r.blackHole*STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions)),request=Math.min((wanted-supplied)/Math.max(1e-30,share),capacity*seconds)/fuelJ,fuel=engineeringFuel(r,request,0,request),energy=fuel*fuelJ*share;r.blackHole+=fuel*(1-eff);u.blackHoleKg+=fuel*(1-eff);u.radiationKg+=fuel*eff;u.accretionJ+=fuel*fuelJ;r.power=(r.power||0)+energy/seconds;supplied+=energy;}
  const fraction=wanted>0?Math.min(1,supplied/wanted):0;e.channelJ=(e.channelJ||0)+chargeJ*fraction;e.massComputeShare=computeJ*fraction/Math.max(1e-30,computeBaseload()*seconds);e.energyJ+=supplied;u.last.computingPower=(u.last.computingPower||0)+computeJ*fraction/seconds;u.last.power+=supplied/seconds;u.last.accretionPower+=supplied/seconds;if(u.last.instantPower){u.last.instantPower.power+=supplied/seconds;u.last.instantPower.accretionPower+=supplied/seconds;}u.nominalPower+=supplied/seconds/Math.max(1e-30,share);
 }
 function gravitationalRecoveryPlan(){
  const u=S.s,e=u.engineering,heavy=Math.max(0,u.industry+S.clipsKg-u.wreck),share=productiveShare(),project=spaceRecoveryProject(),projects=project?[project]:[];
  let ops=0,peak=0,energy=0,work=0,clips=0;for(const d of projects){ops=Math.max(ops,d.cost.ops||0);peak=Math.max(peak,d.cost.electricity||0);energy+=d.cost.electricity||0;work+=d.cost.ops||0;clips+=d.cost.clips||0;}
  const transport=has('transport')?0:S.tasks.some(t=>t.id==='transport')?u.transportEnergyRemaining:Math.max(0,e.origin-u.radiationKg-u.fusionLostKg)*SPACE.transportEnergy;
  energy+=transport+(u.acceleration?.remaining||0)+Math.max(0,work-S.ops)*computeBaseload()/Math.max(1e-30,spaceComputeRating()*researchComputeScale());
  const fuel=Math.max(0,energy-u.charge)/(accretionEfficiency()*C.c*C.c),capital=Math.max(ops*heavy/Math.max(1e-30,operationsCapacity()),peak*heavy/Math.max(1e-30,engineeringStorageCapacity(true)),clips);
  let future=u.wreck+u.lightKg*(1-STELLAR.fusionLoss);for(const r of e.cohorts)future+=share*(r.heavy+(r.ejecta||0)+(r.light)*(1-STELLAR.fusionLoss));
  return {capital,required:capital+clips+fuel,shortage:Math.max(0,capital+clips+fuel-heavy-future,clips-S.clipsKg-future),fuel:clips+fuel};
 }
 function gravitationalRecoveryNeeded(){
  if(S.stage!==3||!S.s.completedMap||has('gravityRecovery'))return false;const u=S.s,plan=gravitationalRecoveryPlan();return u.blackHoleKg>0&&u.industry>u.probe+u.wreck&&plan.shortage>Math.max(1,plan.required)*1e-12;
 }
 function protectRecoverySeed(){
  const u=S.s;if(!(u.recoverySeedKg>0)&&u.completedMap&&(has('gravityRecovery')||gravitationalRecoveryNeeded()))u.recoverySeedKg=Math.max(0,u.industry-u.probe-u.wreck)*.01;
 }
 function engineeringGravitationalRecovery(seconds){
  const u=S.s,e=u.engineering;if(!has('gravityRecovery')||!u.completedMap)return;const plan=gravitationalRecoveryPlan();if(!(plan.shortage>Math.max(1,plan.required)*1e-12))return;
  const share=productiveShare(),eff=benefit('gravityRecovery','物质回收率'),specific=benefit('gravityRecovery','回收比功率W每kg'),unit=C.c*C.c+SPACE.constructionEnergy,rate=specific/unit,working=Math.max(0,u.industry+S.clipsKg-u.wreck)+u.drifterStock.industry+u.drifterStock.clips,free=Math.max(0,u.industry-u.probe-u.wreck)+Math.max(0,u.drifterStock.industry-u.drifterStock.probe),pD=equipmentSpecific(),oldRating=spaceComputeRating(),normal=oldRating*Math.min(e.computeSupply,1-u.storageTarget),extra=oldRating*(e.massComputeShare||0);let left=plan.shortage/Math.max(1e-30,share),made=0;
  // 先造够回收所需的设备，再交付燃料。刚造好的设备也能继续回收。
  for(const r of e.cohorts){
   if(!(left>0))break;const collectors=Math.max(0,r.devices*free/Math.max(1,working)-(r.power||0)/Math.max(1e-30,share)/pD-(r.workDevices||0));if(!(collectors>0&&r.blackHole>0))continue;
   const capital=Math.min(left,Math.max(0,plan.capital-u.industry-S.clipsKg+u.wreck)/Math.max(1e-30,share)),buildTime=Math.log1p(capital/collectors)/rate,devices=collectors*Math.expm1(Math.min(rate*seconds,Math.log1p(capital/collectors))),time=Math.max(0,seconds-buildTime),potential=devices+(collectors+devices)*rate*time,mass=Math.min(left,r.blackHole*eff,potential),clips=stockRemainder(mass,Math.min(mass,devices)),taken=mass/eff;
   r.blackHole=stockRemainder(r.blackHole,taken);u.blackHoleKg=stockRemainder(u.blackHoleKg,taken);u.radiationKg+=taken-mass;engineeringProduct(r,0,mass,clips);left=stockRemainder(left,mass);made+=mass;
  }
  // 本步按已经支付的电量结算运算，刚建好的设备从下一步开始贡献算力。
  if(!(made>0))return;const energy=made*unit*share,power=energy/seconds,rating=spaceComputeRating();e.computeSupply=normal/Math.max(1e-30,rating);e.massComputeShare=extra/Math.max(1e-30,rating);e.energyJ+=energy;u.stepBuildJ+=made*SPACE.constructionEnergy*share;u.last.power+=power;u.last.gravitationalPower=power;if(u.last.instantPower){u.last.instantPower.power+=power;u.last.instantPower.gravitationalPower=power;}u.nominalPower+=power/Math.max(1e-30,share);u.recoveredKg=(u.recoveredKg||0)+made*share;
 }
 function engineeringStandby(seconds,work=0){
  const u=S.s,e=u.engineering,share=productiveShare(),eff=accretionEfficiency(),fuelJ=eff*C.c*C.c,pD=equipmentSpecific(),budget=engineeringBudget(e.energyJ,spaceCapacity()-u.charge,e.normalJ),front=e.cohorts.reduce((n,r)=>n+(!r.covered?r.devices:0),0);let supplied=0;
  for(const r of e.cohorts){const weight=r.stepBaseWeight||0,essential=((e.baseJ||0)+(e.transportDueJ||0))*weight+(e.frontWantedJ||0)*(!r.covered?r.devices/Math.max(1,front):0),normal=(r.power||0)*seconds,channel=e.normalJ>0?budget.channel*normal/e.normalJ:0,need=Math.min(essential,stockRemainder(essential+(work>0?r.stepWorkJ||0:0),Math.max(0,normal-channel)));if(!(need>0))continue;
   const capacity=has('accretion')?Math.min(Math.max(0,r.devices*pD-r.power/Math.max(1e-30,share)),r.blackHole*STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions)):0,request=Math.min(need/Math.max(1e-30,share),capacity*seconds)/fuelJ,fuel=engineeringFuel(r,request,0,request),energy=fuel*fuelJ*share;r.blackHole+=fuel*(1-eff);u.blackHoleKg+=fuel*(1-eff);u.radiationKg+=fuel*eff;u.accretionJ+=fuel*fuelJ;r.power+=energy/seconds;e.energyJ+=energy;supplied+=energy;
  }
  return supplied;
 }
 function engineeringSources(seconds){
  engineeringSyncStock();S.s.last.instantPower=null;
  const u=S.s,e=u.engineering,pD=equipmentSpecific(),q=STELLAR.fusionLoss*C.c*C.c,share=productiveShare(),eff=accretionEfficiency(),fuelJ=eff*C.c*C.c,actual=Math.max(0,u.industry+S.clipsKg-u.wreck-u.probe)+Math.max(0,u.drifterStock.industry+u.drifterStock.clips-u.drifterStock.probe),total=e.cohorts.reduce((n,r)=>n+r.devices,0);
  let star=0,nuclear=0,accretion=0,feedJ=0,industrial=0;
  for(const r of e.cohorts){
   r.workDevices=0;r.devices*=actual/Math.max(1,total);r.stepBaseWeight=r.devices/Math.max(1,actual);r.stepWorkJ=0;const fused=r.light*(-Math.expm1(-r.luminosity*seconds/(Math.max(1,r.initialLight)*q))),stellar=Math.min(r.devices*pD,fused*q*STELLAR.capture/seconds);r.light=stockRemainder(r.light,fused);r.heavy+=fused*(1-STELLAR.fusionLoss);u.fusionLostKg+=fused*STELLAR.fusionLoss;captureFusion(r,fused*STELLAR.fusionLoss,stellar*seconds);
   const idle=Math.max(0,r.devices-stellar/pD),need=has('nucleosynthesis')?idle*STELLAR.nuclearWkg*seconds/(q*STELLAR.capture):0,available=r.collectedLight||0,synth=engineeringStock('light',Math.min(need,available),0,r),power=synth*q*STELLAR.capture/seconds;
   if(synth){engineeringProduct(r,0,synth*(1-STELLAR.fusionLoss));u.fusionLostKg+=synth*STELLAR.fusionLoss;u.nuclearMetal+=synth*(1-STELLAR.fusionLoss);u.fusionJ+=power*seconds;captureFusion(r,synth*STELLAR.fusionLoss,power*seconds);}
   r.power=(stellar+power)*share;star+=stellar;nuclear+=power;
   if(!r.covered&&r.devices*pD>=r.luminosity*STELLAR.capture*(1-1e-10))r.covered=true;
   if(r.covered)industrial+=Math.min(r.light+r.heavy+(r.ejecta||0),r.devices*pD*seconds/STELLAR.liftingJkg)*STELLAR.liftingJkg;
  }
  let holeCapacity=0;for(const r of e.cohorts)if(r.light+r.heavy+(r.ejecta||0)+(has('kilonova')?r.collectedLight||0:0)>0)holeCapacity+=Math.min(Math.max(0,r.devices*pD-r.power/Math.max(1e-30,share)),r.blackHole*STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions));
  const fixed=(star+nuclear)*seconds*share,maximum=fixed+holeCapacity*seconds*share,target=engineeringRequiredEnergy(industrial*share,maximum);let demand=stockRemainder(target,fixed);
  for(const r of e.cohorts){if(!(r.light+r.heavy+(r.ejecta||0)+(has('kilonova')?r.collectedLight||0:0)>0))continue;const capacity=has('accretion')?Math.min(Math.max(0,r.devices*pD-r.power/Math.max(1e-30,share)),r.blackHole*STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions)):0,request=Math.min(demand/Math.max(1e-30,share),capacity*seconds)/fuelJ,fuel=engineeringFuel(r,request,0,0,false),power=fuel*fuelJ/seconds;r.blackHole+=fuel*(1-eff);u.blackHoleKg+=fuel*(1-eff);u.radiationKg+=fuel*eff;u.accretionJ+=fuel*fuelJ;r.power+=power*share;accretion+=power;demand=stockRemainder(demand,power*seconds*share);}
  e.normalJ=(star+nuclear+accretion)*seconds*share;e.energyJ=e.normalJ;const backup=engineeringStandby(seconds)/seconds,power=e.energyJ/seconds;e.maturePower=e.cohorts.reduce((n,r)=>n+(r.covered?r.power:0),0);u.nominalPower=power/Math.max(1e-30,share);Object.assign(u.last,{power,stellarPower:star*share,nuclearPower:nuclear*share,accretionPower:accretion*share+backup,dischargePower:0});engineeringOpenBudget(seconds,feedJ);
 }

 function engineeringProduction(seconds){
  const u=S.s,e=u.engineering,pD=equipmentSpecific(),years=seconds/(C.year*C.day),share=productiveShare();
  engineeringBuild(seconds);engineeringPayTransport();engineeringCompact();
  const mature=e.cohorts.filter(r=>r.covered),demand=r=>r.light+r.heavy+(r.ejecta||0)+(r.collectedLight||0),weight=mature.reduce((n,r)=>n+demand(r),0),initial=e.workJ;
  for(const r of mature){
   let budget=Math.min(e.workJ,initial*demand(r)/Math.max(1,weight)),usedDevices=0;
   const mass=Math.min(budget/Math.max(1e-30,share)/STELLAR.liftingJkg,Math.max(0,r.devices-usedDevices)*pD*seconds/STELLAR.liftingJkg),input=engineeringExtract(r,mass),spent=input.mass*STELLAR.liftingJkg*share;engineeringProduct(r,input.light,input.heavy);r.workDevices=(r.workDevices||0)+usedDevices+input.mass*STELLAR.liftingJkg/(pD*seconds);e.workJ=Math.max(0,e.workJ-spent);u.stepBuildJ+=spent;
  }
  engineeringCompact();
 }


