 const SPACE=StellarSpace.settings;
 const frontierMilestones=[[SPACE.solarRadius,'galacticCenter'],[1e7,'localGroup'],[5e8,'laniakea']];
 function recordFrontierMilestones(previous){for(const [distance,id] of frontierMilestones)if(previous<distance&&S.s.radius>=distance)recordMilestone(id);}
 let targetHeap=[],targetOwner=null,battlePresenter=null,battleResults=[],battleResultOwner=null;
 function heapPush(id){let i=targetHeap.length;targetHeap.push(id);while(i){let p=(i-1)>>1;if(targetHeap[p]<=id)break;targetHeap[i]=targetHeap[p];i=p;}targetHeap[i]=id;}
 function heapPop(){const id=targetHeap[0],last=targetHeap.pop();if(targetHeap.length){let i=0;while(i*2+1<targetHeap.length){let j=i*2+1;if(j+1<targetHeap.length&&targetHeap[j+1]<targetHeap[j])j++;if(targetHeap[j]>=last)break;targetHeap[i]=targetHeap[j];i=j;}targetHeap[i]=last;}return id;}
 function prepareTargets(){let u=S.s;if(targetOwner===u)return;targetOwner=u;targetHeap=[];const occupied=new Set([...u.flights.map(f=>f.target),...u.systems.map(s=>s.target)]);for(let i=0;i<u.stars.length;i++)if(!occupied.has(i))heapPush(i);}
 function probeGrowth(){return 1+.7*(-Math.expm1(-S.s.design.industry/2));}
 function clipFraction(){return SPACE.clipShare*(-Math.expm1(-S.s.design.clips/SPACE.clipScale));}
 function designResponse(points){const knee=SPACE.designKnee;return points<=knee?points:knee+knee*Math.log1p((points-knee)/knee);}
 function probeCopies(){return 10**S.s.design.replication;}
 function autonomy(){return S.s.autonomy;}
 function autonomyLimit(){const id=['autonomy1'].find(has),limit=id?benefit(id,'自主性上限'):SPACE.initialAutonomy;return limit||Infinity;}
 function autonomyQuote(){return SPACE.autonomyCost*SPACE.autonomyCostRatio**(S.s.autonomy-SPACE.initialAutonomy)*20**Math.max(0,S.s.autonomy-13);}
 function increaseAutonomy(){if(S.stage!==3||S.s.completedMap||autonomy()>=autonomyLimit()||S.yomi<autonomyQuote())return false;S.yomi-=autonomyQuote();S.s.autonomy++;S.revision++;return true;}
 function designLimit(key){const u=S.s;return key==='replication'&&!u.automatic?0:key==='shield'?(has('shield')?autonomy():u.shieldCap):key==='fidelity'?(has('diverseRedundancy')?autonomy():u.fidelityCap):key==='combat'&&!has('combat')?0:autonomy();}
 function editDesign(key,delta){let u=S.s;if(!u||!designkeys.includes(key)||!Number.isInteger(delta)||Math.abs(delta)!==1||u.completedMap)return false;const next=u.design[key]+delta,used=sum(u.design);if(next<0||next>designLimit(key)||used+delta>autonomy())return false;u.design[key]=next;if(key==='combat'&&next>0)u.namedBattles=true;S.revision++;return true;}
 function setCruiseSpeed(beta){let u=S.s;if(!u||!Number.isFinite(beta)||beta<.05||beta>u.speedCap||broadcastReadiness())return false;if(beta===u.beta)return true;const energy=u.inFlight*probeAverageMass()*(1+SPACE.propellantRatio)*Math.max(0,probeLaunchEnergy(beta)-probeLaunchEnergy(u.cruiseBeta))*(has('activeDefense')?1.2:1),paid=Math.min(u.charge,energy);u.charge=stockRemainder(u.charge,paid);S.energyJ+=paid;u.beta=beta;if(energy>paid)u.acceleration={from:u.cruiseBeta,energy,remaining:energy-paid};else{u.cruiseBeta=beta;u.acceleration=null;}S.revision++;return true;}
 function beginSpace(){
  const p=S.p,r=planetRates(),heavy=equipmentMass()+p.raw+p.swarm.raw+S.reservedKg+S.clipsKg,pioneerDry=q('starflight').cost.raw/(1+SPACE.propellantRatio),pioneerFuel=pioneerDry*SPACE.propellantRatio,industry=heavy-S.clipsKg-pioneerFuel,charge=p.charge+p.swarm.charge,capacity=r.groundStorage+r.orbitalStorage,power=r.power;
  S.stage=3;S.stageDays=0;
  S.s={industry,lightKg:heavy*50,origin:heavy*51,gathered:heavy*51,originIndustry:industry,originClips:S.clipsKg,originPower:power,nominalPower:power,originCapacity:capacity,charge,storageTarget:.05,
   stars:StellarSpace.catalogue(S.seed),systems:[],flights:[],fades:[],systemCount:0,harvestedEquipment:0,harvestedClips:0,sourceRock:0,sourceStellar:0,untracked:0,extraFlights:[],launched:SPACE.initialShips,arrived:0,destroyed:0,inFlight:SPACE.initialShips,drifted:0,drifters:0,probe:pioneerDry,wreck:0,hazardLostKg:0,hazardLosses:0,initialRemaining:SPACE.initialShips,
   radius:0,hasFrontier:false,years:0,speedCap:SOLAR.pioneerBeta,beta:SOLAR.pioneerBeta,cruiseBeta:SOLAR.pioneerBeta,acceleration:null,autonomy:SPACE.initialAutonomy,shieldCap:1,fidelityCap:0,design:{industry:2,clips:2,replication:0,shield:1,fidelity:0,combat:0},
   automatic:false,coarse:false,model:null,accretion:false,nuclear:false,harvestGain:1,tactics:1,salvage:0,massEnergy:false,massEnergyRun:null,recoverySeedKg:0,recoveredKg:0,drifterStock:{industry:0,clips:0,light:0,charge:0,ops:0,probe:0},
   driftSeen:false,war:false,battleCalibration:true,intergalactic:false,horizonKnown:false,completedMap:false,completedHarvest:false,frozenAccessible:0,battleClock:0,battleCount:0,wins:0,battlesEnded:0,firstAttackEnded:false,warLosses:0,warOriginShips:0,transitLosses:0,warStartRadius:0,namedBattles:false,battle:null,engagement:null,pendingBattle:false,nextBattleYears:0,galacticStartRadius:0,battleNames:{},
   lockedKg:pioneerFuel,fusionLostKg:0,fusionJ:0,radiationKg:0,nuclearMetal:0,blackHoleKg:0,accretionJ:0,boundKg:0,transportEnergyRemaining:0,transportEnergyTotal:0,transportStartCount:0,transportIslandCount:0,transportProgress:0,residualCapturedKg:0,broadcastStart:0,last:{power,powerAverage:power,powerUsed:0,equipRate:0,clipRate:0,harvestRate:0},energyFraction:1,stepClipKg:0,stepBuildJ:0,stepChargeJ:0};
  const u=S.s;for(let i=0;i<SPACE.initialShips;i++)u.flights.push({id:i+1,target:i,distance:0,mass:pioneerDry/SPACE.initialShips,launched:0,initial:true,failAt:.35+5.5*(i+.25+rng()*.5)/SPACE.initialShips,risk:0,failProgress:0,tested:false});
  engineeringInit(Math.max(0,C.sunMass-u.origin));S.p=null;S.reservedKg=0;S.speed=clamp(S.speed,speedMin(),speedMax());targetOwner=null;refreshResearchCosts();log(copy('copy.ten-probes-leave-the-solar-system'));
 }
 function probeCruiseBeta(){return broadcastReadiness()?C.broadcastCruiseBeta:S.s.cruiseBeta;}
 function broadcastReadiness(){return has('virus')&&S.s.years-S.s.broadcastStart>=100?1:0;}
 function probeLaunchEnergy(beta=broadcastReadiness()?C.broadcastCruiseBeta:S.s.beta){const flight=q('starflight'),base=1/Math.sqrt(1-SOLAR.pioneerBeta**2)-1;return (flight.cost.electricity/flight.cost.raw-SPACE.probeManufacturingEnergy/(1+SPACE.propellantRatio))*(1/Math.sqrt(1-beta*beta)-1)/base;}
 function probeMass(){return q('starflight').cost.raw/(SPACE.initialShips*(1+SPACE.propellantRatio))*autonomy()/SPACE.initialAutonomy;}
 function probeAverageMass(){const u=S.s;const live=u.arrived+u.inFlight;return live>0?u.probe/live:0;}
 function launchQuote(){const mass=probeMass(),fuel=mass*SPACE.propellantRatio,total=mass+fuel,energy=total*probeLaunchEnergy()*(has('activeDefense')?1.2:1)+mass*SPACE.probeManufacturingEnergy;return {mass,energy,fuel,total};}
 function launchMaterialCapacity(q=launchQuote()){const u=S.s,free=Math.max(0,u.industry-u.probe-u.wreck);return Math.max(0,Math.min(free/q.mass,u.lightKg/q.fuel));}
 function spendLaunchFuel(mass){const u=S.s,rows=u.engineering.cohorts,total=rows.reduce((n,r)=>n+(r.propellant||0),0),reserved=Math.min(mass,total);if(total>0)for(const r of rows)r.propellant=stockRemainder(r.propellant||0,reserved*(r.propellant||0)/total);const remainder=mass-reserved,free=rows.reduce((n,r)=>n+(r.collectedLight||0),0);if(remainder>0&&free>0)for(const r of rows)r.collectedLight=stockRemainder(r.collectedLight||0,remainder*(r.collectedLight||0)/free);u.engineering.propellantTotal=stockRemainder(total,reserved);u.lightKg=stockRemainder(u.lightKg,mass);u.lockedKg+=mass;}
 function canLaunchProbe(){let u=S.s;if(!u||S.stage!==3||u.automatic||u.completedMap||S.ending)return false;prepareTargets();const q=launchQuote();return (u.coarse||targetHeap.length>0)&&launchMaterialCapacity(q)>=1&&u.charge>=q.energy;}
 function launchProbe(){if(!canLaunchProbe())return false;let u=S.s,id=u.flights.length>=100||targetHeap.length===0?null:heapPop(),q=launchQuote();u.charge=stockRemainder(u.charge,q.energy);spendLaunchFuel(q.fuel);S.energyJ+=q.energy;u.probe+=q.mass;u.launched++;u.inFlight++;if(id===null){u.untracked++;const lost=rng()<spaceHazard(),distance=u.stars[targetHeap[0]]?.r||u.radius+flightRange()*.5,at=Math.ceil((u.years+distance/u.cruiseBeta*(lost?.18+.68*(rng()+rng())/2:1))*4)/4,group=u.extraFlights.find(f=>f.at===at&&f.lost===lost);if(group){group.count++;group.mass+=q.mass;}else u.extraFlights.push({at,lost,count:1,mass:q.mass});}if(id!==null)u.flights.push({id:u.launched,target:id,distance:0,mass:q.mass,launched:u.years,initial:false,risk:rng(),failProgress:.18+.68*(rng()+rng())/2,tested:false});S.revision++;return true;}
 function productiveShare(){const u=S.s,own=Math.max(0,u.industry-u.probe-u.wreck),enemy=Math.max(0,u.drifterStock.industry-u.drifterStock.probe);return own+enemy>0?own/(own+enemy):1;}
 function spaceCapacity(){if(S.stage===4)return S.dismantle>=6?0:S.end.capacity;return engineeringStorageCapacity();}
 function controlBuffers(){const u=S.s,b=u.drifterStock,own=Math.max(0,u.industry+S.clipsKg-u.wreck),enemy=b.industry+b.clips,ops=operationsCapacity(),charge=engineeringStorageCapacity(false,false);return {share:productiveShare(),mass:{own,enemy},ops:{own:ops,enemy:own>0?ops*enemy/own:0,a:S.ops,b:b.ops},charge:{own:Math.max(u.charge,charge),enemy:Math.max(b.charge,own>0?charge*enemy/own:0),a:u.charge,b:b.charge}};}
 function settleControlBuffers(before,transfer=true){const u=S.s,b=u.drifterStock,after=controlBuffers();for(const key of ['ops','charge']){const old=before[key],now=after[key],oldCapacity=key==='charge'?before.mass:old,newCapacity=key==='charge'?after.mass:now,ownKeep=oldCapacity.own>0?Math.min(1,newCapacity.own/oldCapacity.own):1,enemyKeep=oldCapacity.enemy>0?Math.min(1,newCapacity.enemy/oldCapacity.enemy):1,a=old.a*ownKeep+(transfer?old.b*(1-enemyKeep):0),enemy=old.b*enemyKeep+(transfer?old.a*(1-ownKeep):0);if(key==='ops'){S.ops=Math.min(now.own,a);b.ops=Math.min(now.enemy,enemy);}else{u.charge=a;b.charge=enemy;}}const ratio=productiveShare()/Math.max(1e-30,before.share);for(const key of ['power','stellarPower','accretionPower','nuclearPower','gravitationalPower']){if(u.last[key]!==undefined)u.last[key]*=ratio;if(u.last.instantPower?.[key]!==undefined)u.last.instantPower[key]*=ratio;}}
 function transferDriftAssets(fraction,before=null){shiftControl(fraction,1,before);}
 function transferDrift(count,live,mass=null){
  if(!(count>0))return;const u=S.s,b=u.drifterStock,fraction=live>0?Math.min(1,count/live):0,before=controlBuffers(),probe=Math.min(u.probe,mass??u.probe*fraction);
  u.probe=stockRemainder(u.probe,probe);b.probe+=probe;u.industry=stockRemainder(u.industry,probe);b.industry+=probe;u.drifted+=count;u.drifters+=count;
  if(u.war)transferDriftAssets(fraction,before);else settleControlBuffers(before);
 }
 function shiftControl(ownFraction,enemyKeep,before=null){
  const u=S.s,b=u.drifterStock,old=before||controlBuffers(),own=Math.max(0,u.industry-u.probe-u.wreck),enemy=Math.max(0,b.industry-b.probe),reserve=Math.min(own,u.originIndustry),kept=reserve+(own-reserve)*(1-ownFraction),fraction=own>0?kept/own:1;
  u.industry=u.probe+u.wreck+kept+enemy*(1-enemyKeep);b.industry=b.probe+enemy*enemyKeep+(own-kept);
  for(const [key,source]of [['light','lightKg'],['clips',null]]){const a=source?u[source]:S.clipsKg,e=b[key],remaining=a*fraction+e*(1-enemyKeep);b[key]=e*enemyKeep+a*(1-fraction);if(source)u[source]=remaining;else S.clipsKg=remaining;}
  settleControlBuffers(old);
 }
 function spacePower(){if(S.stage===4)return hawkingPower();return S.s?Math.max(0,S.s.last.instantPower?.power??S.s.last.power??S.s.originPower):0;}
 function frontierBeta(){return S.s?.hasFrontier?Math.max(S.s.cruiseBeta,broadcastReadiness())*(S.s.automatic&&!broadcastReadiness()?frontierSupply():1):0;}
 function spaceHazard(){const points=S.s.design.shield,after=has('survey');if(!after)return points===0?1:.975;return points===0?.99:points<=5?[.99,.8,.6,.4,.25,.1][points]:.1*2**(5-points);}
 function driftProbability(){const u=S.s;if(!has('autonomy1'))return 0;const points=sum(u.design),autonomyRisk=.2+.4*Math.max(0,points-5)/(points+25),verification=1/(1+.4*u.design.fidelity+.18*u.design.fidelity**3),onset=.02+.98*(-Math.expm1(-u.systemCount/1000));return (.01+(autonomyRisk-.01)*verification)*onset;}
 function restoreDrifterRemnant(){
  if(S.stage!==3||!(S.s.battleCount>0||S.s.battlesEnded>0))return;const u=S.s,b=u.drifterStock;if(u.drifters>=1&&b.probe>0)return;
  if(!(b.probe>0)){const buffers=controlBuffers(),desired=probeAverageMass()||SPACE.seedMass,local=Math.min(b.industry,desired),free=Math.max(0,u.industry-u.probe),taken=Math.min(free,desired-local),clips=Math.min(S.clipsKg,Math.max(0,desired-local-taken));b.probe=local+taken+clips;b.industry+=taken+clips;u.industry-=taken;u.wreck=Math.max(0,u.wreck-taken);S.clipsKg-=clips;settleControlBuffers(buffers);}
  if(b.probe>0)u.drifters=Math.max(1,u.drifters);
 }
 function noticeDrift(){const u=S.s;if(!u.driftSeen&&u.drifters>0){u.driftSeen=true;log(copy('copy.contact-with-one-subagent-has-been-lost'));S.revision++;}}
 function expectedFlights(radius=S.s.model?.front||S.s.radius,copies=S.s.engineering.effectiveCopies){const u=S.s;if(!u.intergalactic&&radius>=C.galaxyR)return 0;const width=Math.max(.01,Math.min(flightRange()*.5,radius*.05)),inner=Math.max(u.intergalactic&&radius>=C.galaxyR?C.galaxyR:0,radius-width),outer=u.intergalactic?radius+width:Math.min(C.galaxyR,radius+width),density=(StellarSpace.systems(outer)-StellarSpace.systems(inner))/Math.max(.01,outer-inner);return Math.max(0,density*flightRange()*.5*copies);}

 function flightFlow(initial,target,rate,years,tau){
  if(!(years>0))return {remaining:initial,sent:0,supply:target>0?Math.min(1,initial/target):1};
  if(!(target>0))return {remaining:initial*Math.exp(-years/tau),sent:0,supply:1};
  rate=Math.max(0,rate);let left=years,current=initial,sent=0,covered=0;
  function capped(h){const x=h/tau,decay=-Math.expm1(-x),mean=x>0?decay/x:1,steady=rate*tau;covered+=h*Math.min(1,(current*mean+steady*(1-mean))/target);current=current*(1-decay)+steady*decay;sent+=rate*h;left-=h;}
  if(current>target){
   if(rate>=target/tau){const x=left/tau;sent+=target/tau*left;covered+=left;current=target+(current-target)*Math.exp(-x);left=0;}
   else {const steady=rate*tau,hit=tau*Math.log((current-steady)/(target-steady)),h=Math.min(left,hit);sent+=rate*h;covered+=h;current=steady+(current-steady)*Math.exp(-h/tau);left-=h;}
  }
  if(left>0){
   const threshold=2*target-rate*tau;
   if(rate<target/tau)capped(left);
   else {
    if(current<threshold){const steady=rate*tau,hit=tau*Math.log((steady-current)/(steady-threshold));capped(Math.min(left,hit));}
    if(left>0){const x=2*left/tau,decay=-Math.expm1(-x),mean=x>0?decay/x:1;covered+=left*(1+(current/target-1)*mean);sent+=target/tau*left+(target-current)*decay*.5;current=target+(current-target)*Math.exp(-x);left=0;}
   }
  }
  return {remaining:Math.max(0,current),sent:Math.max(0,sent),supply:clamp(covered/years,0,1)};
 }
 function probePowerFraction(){
  const u=S.s;if(!u.automatic||u.completedMap||!u.intergalactic&&u.radius>=C.galaxyR)return 0;const power=spacePower();if(!(power>0))return 0;
  const radius=u.model.front,copies=u.engineering.effectiveCopies,tau=meanFlightYears(),target=expectedFlights(radius,copies),dr=Math.max(.01,radius*1e-4),speed=frontierBeta()/scaleFactor(u.years),growth=Math.max(0,(expectedFlights(radius+dr,copies)-expectedFlights(Math.max(0,radius-dr),copies))/(2*dr))*speed,rate=target/tau+growth+Math.max(0,target-u.inFlight)/tau;
  return rate*launchQuote().energy/(C.year*C.day*power);
 }
 function flightPlan(years,energy,chargingPower=(S.s.engineering.lastNormalPower??S.s.originPower)*S.s.storageTarget){
  const u=S.s,seconds=years*C.year*C.day,beta=Math.max(.05,u.cruiseBeta,broadcastReadiness()),limit=u.intergalactic?Infinity:C.galaxyR,r=u.model.front,distance=u.completedMap?0:Math.min(beta*lightIntegral(u.years,years),Math.max(0,limit-r)),quote=launchQuote(),budget=Math.max(0,energy),capacity=Math.max(0,Math.min(budget/quote.energy,launchMaterialCapacity(quote))),rate=capacity/years,tau=meanFlightYears(),start=expectedFlights(r,1),end=expectedFlights(r+distance,1),need=start/tau+Math.max(0,end-start)/years,copies=Math.max(1,Math.min(probeCopies(),need>0?rate/need:probeCopies()));
  let travel=distance,flow;for(let i=0;i<2;i++){const target=u.completedMap?0:expectedFlights(r+travel*.5,copies);flow=flightFlow(u.inFlight,target,rate,years,tau);travel=distance*flow.supply;}
  return {...flow,travel,copies,energy:flow.sent*quote.energy,quote};
 }
 function frontierSupply(){return Math.min(1,S.s.inFlight/Math.max(1,expectedFlights()));}
 function flightRange(){const r=S.s.radius;if(!S.s.intergalactic||r<C.galaxyR)return SPACE.flightRange;const width=Math.max(100,r*.001),a=Math.max(C.galaxyR,r-width),b=r+width,density=(StellarSpace.systems(b)-StellarSpace.systems(a))/(4*Math.PI/3*(b*b*b-a*a*a));return density>0?Math.max(SPACE.flightRange,2/Math.cbrt(density)):Math.max(SPACE.flightRange,StellarSpace.nearestGalaxyRadius-C.galaxyR);}
 function meanFlightYears(){return flightRange()/(2*Math.max(.05,probeCruiseBeta()));}
 function lostFlight(f,drift=false){const u=S.s;u.inFlight--;if(f.initial)u.initialRemaining--;if(drift){transferDrift(1,u.launched-u.destroyed-u.drifted,f.mass);}else{const buffers=controlBuffers();u.destroyed++;u.hazardLosses++;u.wreck+=f.mass;u.hazardLostKg+=f.mass;u.probe=stockRemainder(u.probe,f.mass);settleControlBuffers(buffers,false);}u.fades.push({target:f.target,distance:f.distance,at:u.years});if(u.fades.length>100)u.fades.shift();prepareTargets();heapPush(f.target);if(f.initial)log(copy('copy.probe-1-has-been-destroyed').replace('%1',f.id));S.revision++;}
 function flightStep(years){
  const u=S.s,end=u.years+years;prepareTargets();
  for(let i=u.flights.length-1;i>=0;i--){let f=u.flights[i],star=u.stars[f.target],beta=f.initial?SOLAR.pioneerBeta:u.cruiseBeta;let distance=Math.min(star.r,f.distance+beta*years),arrival=u.years+(star.r-f.distance)/beta,failed=f.initial&&end>=f.failAt;
   if(!f.initial&&!f.tested&&distance>=star.r*f.failProgress){f.tested=true;failed=f.risk<spaceHazard();if(failed)distance=star.r*f.failProgress;}
   f.distance=distance;
   if(failed){if(f.initial)f.distance=SOLAR.pioneerBeta*f.failAt;u.flights.splice(i,1);lostFlight(f);continue;}
   if(!f.initial&&distance>=star.r&&has('autonomy1')&&(!u.driftSeen||rng()<driftProbability())){u.flights.splice(i,1);lostFlight(f,true);noticeDrift();continue;}
   if(distance>=star.r){u.flights.splice(i,1);u.inFlight--;u.arrived++;u.systemCount++;u.systems.push({target:f.target,at:arrival,equipment:f.mass,clips:0,power:f.mass*SPACE.specificPower,gathered:0});engineeringRegister(1,star.mass,star.luminosity*C.sunPower,f.mass,star.r,arrival);u.fades.push({target:f.target,distance:star.r,at:arrival});if(u.fades.length>100)u.fades.shift();u.radius=Math.max(u.radius,star.r);u.hasFrontier=true;if(u.arrived===1){recordMilestone('arrival');log(copy('copy.probe-1-has-arrived').replace('%1',f.id));}S.revision++;}
  }
 }
 function exactStep(years){
  const u=S.s,end=u.years+years;flightStep(years);for(let i=u.extraFlights.length-1;i>=0;i--){const f=u.extraFlights[i];if(f.at>end)continue;u.extraFlights.splice(i,1);u.inFlight-=f.count;u.untracked-=f.count;if(f.lost){const buffers=controlBuffers();u.destroyed+=f.count;u.hazardLosses+=f.count;u.hazardLostKg+=f.mass;u.probe=stockRemainder(u.probe,f.mass);u.wreck+=f.mass;settleControlBuffers(buffers,false);}else{const expected=f.count*driftProbability(),drift=Math.min(f.count,Math.floor(expected)+Number(rng()<expected%1));u.arrived+=f.count-drift;transferDrift(drift,u.launched-u.destroyed-u.drifted,f.mass*drift/f.count);noticeDrift();}}let power=u.originPower;
  if(u.systemCount>=SPACE.threshold&&!u.coarse)beginCoarse();
 }
 function settleFlights(years,sent=0,remaining=null){const u=S.s,travel=meanFlightYears(),x=years/travel,completed=u.inFlight*(-Math.expm1(-x))+sent*(x>1e-6?1-(-Math.expm1(-x))/x:x*.5),finished=Math.max(0,Math.min(u.inFlight+sent,remaining===null?completed:u.inFlight+sent-remaining));u.launched+=sent;u.probe+=sent*probeMass();const buffers=controlBuffers(),live=u.arrived+u.inFlight+sent,mass=live>0?u.probe/live:0,lost=finished*spaceHazard(),drift=(finished-lost)*driftProbability();u.inFlight=Math.max(0,u.inFlight+sent-finished);u.destroyed+=lost;u.hazardLosses+=lost;u.arrived+=finished-lost-drift;u.wreck+=lost*mass;u.hazardLostKg+=lost*mass;u.probe=stockRemainder(u.probe,lost*mass);settleControlBuffers(buffers,false);transferDrift(drift,u.arrived+u.inFlight+drift);}
 function beginCoarse(){const u=S.s;u.coarse=true;u.model={radius:u.radius,front:u.radius,displayStart:u.radius,at:u.years,blendYears:20,transition:0};S.revision++;}
 function automaticPlanning(){const u=S.s;beginCoarse();u.automatic=true;u.fades.push(...u.flights.slice(0,100).map(f=>({target:f.target,distance:f.distance,at:u.years})));u.fades=u.fades.slice(-100);u.untracked=0;u.extraFlights=[];u.flights=[];targetOwner=null;log(copy('copy.subagents-begin-choosing-their-own-destinations'));}
 function coarseStep(years,plan){
  const u=S.s,e=u.engineering,m=u.model,seconds=years*C.year*C.day,old=m.front;
  e.effectiveCopies=plan.copies;e.launchEstimate=u.last.power>0?plan.energy/(seconds*u.last.power):0;
  m.front+=plan.travel;const previousRadius=u.radius;u.radius=Math.max(u.radius,m.front);recordFrontierMilestones(previousRadius);m.radius=m.front;m.transition=clamp((u.years+years-m.at)/m.blendYears,0,1);
  const newStars=Math.max(0,StellarSpace.systems(m.front)-StellarSpace.systems(old));
  spendLaunchFuel(plan.sent*plan.quote.fuel);u.last.launchPower+=plan.energy/seconds;settleFlights(years,plan.sent,plan.remaining);
  if(newStars>0){const mass=Math.max(0,StellarSpace.matter(m.front)-StellarSpace.matter(old)),success=e.effectiveCopies*(1-spaceHazard())*(1-driftProbability());engineeringRegister(newStars,mass,newStars*SPACE.meanLuminosity*C.sunPower,Math.min(u.probe,newStars*plan.quote.mass*Math.max(.01,success)),(old+m.front)*.5,u.years+years*.5,years);u.systemCount+=newStars;}return plan.energy;
 }

 function chargeDrifterReserves(seconds){
  const u=S.s,b=u.drifterStock;if(!(u.drifters>0))return;const share=productiveShare(),power=u.nominalPower*(1-share),capacity=controlBuffers();
  // 双方沿用同一个生产模型，并按实际分到的产能充电。
  const charging=Math.min(Math.max(0,capacity.charge.enemy-b.charge),power*seconds,u.stepChargeJ*(1-share)/Math.max(1e-30,share));b.charge=Math.min(capacity.charge.enemy,b.charge+charging);
 }
 function drifterReserves(years){const u=S.s,b=u.drifterStock;if(!(u.drifters>0))return;const seconds=years*C.year*C.day;b.ops=Math.min(controlBuffers().ops.enemy,b.ops+computeRate()*seconds*b.industry/Math.max(1,u.industry-u.wreck));}
 function spaceStep(days){
  const u=S.s,e=u.engineering,years=days/C.year,seconds=days*C.day,beforeHeavy=u.industry,beforeGathered=u.gathered;u.stepBuildJ=0;u.stepClipKg=0;u.stepChargeJ=0;u.stepArrivalJ=0;u.stepTransportJ=0;u.accelerationJ=0;u.last.launchPower=0;u.last.gravitationalPower=0;e.massComputeShare=0;
  if(u.completedMap)for(const r of e.cohorts)if(r.propellant>0){r.collectedLight=(r.collectedLight||0)+r.propellant;r.propellant=0;delete r.response;}recoverSpaceWreck();protectRecoverySeed();let storedSpent=0;
  if(u.acceleration){const paid=Math.min(u.charge,u.acceleration.remaining);u.charge=stockRemainder(u.charge,paid);u.acceleration.remaining=stockRemainder(u.acceleration.remaining,paid);u.accelerationJ+=paid;storedSpent+=paid;}
  const task=S.tasks.find(t=>t.id==='transport'),remainingSeconds=task?Math.max(seconds,task.remaining*C.day):seconds,transportDue=task?Math.min(u.transportEnergyRemaining,u.transportEnergyRemaining*seconds/remainingSeconds):0,transportStored=Math.min(u.charge,transportDue);u.charge=stockRemainder(u.charge,transportStored);u.transportEnergyRemaining=stockRemainder(u.transportEnergyRemaining,transportStored);u.stepTransportJ+=transportStored;storedSpent+=transportStored;
  e.stepSeconds=seconds;e.baseJ=computeBaseload()*seconds*(1-u.storageTarget);e.frontWantedJ=u.automatic?0:engineeringBuildDemand(seconds);e.transportDueJ=transportDue-transportStored;e.launchWantedJ=u.automatic?flightPlan(years,Number.MAX_VALUE).energy:0;
  if(u.automatic){engineeringSyncStock();currentCompact();const estimate=u.charge>=e.launchWantedJ?0:responseEnergy(seconds);u.responseFlow=flightPlan(years,u.charge+estimate*u.storageTarget,estimate*u.storageTarget/seconds);coarseStep(years,u.responseFlow);}else exactStep(years);
  if(u.automatic)engineeringContinuum(seconds);else{engineeringSources(seconds);engineeringProduction(seconds);}engineeringMassEnergy(seconds);engineeringGravitationalRecovery(seconds);
  let channel=e.channelJ||0;if(u.acceleration){const a=u.acceleration,paid=Math.min(a.remaining,channel);a.remaining=stockRemainder(a.remaining,paid);channel-=paid;u.accelerationJ+=paid;const initial=1/Math.sqrt(1-a.from*a.from),target=1/Math.sqrt(1-u.beta*u.beta),gamma=initial+(target-initial)*(1-a.remaining/a.energy);u.cruiseBeta=Math.sqrt(Math.max(0,1-1/(gamma*gamma)));if(a.remaining===0){u.cruiseBeta=u.beta;u.acceleration=null;}}
  const capacity=spaceCapacity(),plan=u.responseFlow||null,launched=plan?.energy||0,accepted=Math.min(channel,Math.max(0,capacity-u.charge)+launched);u.charge=Math.min(capacity,stockRemainder(u.charge+accepted,launched));u.stepChargeJ=accepted;chargeDrifterReserves(seconds);delete u.responseFlow;e.workJ+=Math.max(0,channel-accepted);e.energyJ+=storedSpent+Math.max(0,launched-accepted);u.years+=years;
  if(task)u.transportProgress=Math.max(u.transportProgress,Math.min(1-u.transportEnergyRemaining/Math.max(1,u.transportEnergyTotal),(task.total-task.remaining+days)/task.total));if(has('transport'))u.transportProgress=1;captureTransportMatter();recoverSpaceWreck();
  const power=u.last.power,used=e.energyJ-e.workJ;S.energyJ+=Math.max(0,used);u.energyFraction=e.energyJ>0?used/e.energyJ:0;
  noticeDrift();if(u.driftSeen&&!u.war&&u.systemCount>=2000&&u.drifters>0){u.war=true;recordMilestone('driftWar');transferDriftAssets(u.drifters/Math.max(1,u.launched-u.destroyed));u.nextBattleYears=battleInterval();u.battleClock=u.nextBattleYears;log(copy('copy.the-missing-subagents-are-making-something-else'));S.revision++;}
  drifterReserves(years);if(u.war){advanceCombat(years);if(u.pendingBattle&&battlePresenter?.()){u.pendingBattle=false;battle();}u.battleClock+=years;const interval=u.nextBattleYears||battleInterval();if(u.battleClock>=interval){const count=Math.floor(u.battleClock/interval);u.battleClock%=interval;battle(Math.min(count,10000));u.nextBattleYears=battleInterval()*(.85+.3*rng());advanceCombat(u.battleClock);}}
  if(u.horizonKnown&&u.intergalactic&&!u.completedMap&&mapRemainingDistance()<mapDistanceTolerance(u.radius)){u.completedMap=true;recordMilestone('cosmicHorizon');u.frozenAccessible=e.origin;log(copy('copy.the-star-map-is-complete'));S.revision++;}
  recoverSpaceWreck();if(u.completedMap&&!u.completedHarvest&&engineeringRemaining()<=e.origin*1e-12){u.completedHarvest=true;recordMilestone('harvestComplete');log(copy('copy.all-harvestable-matter-has-been-collected'));S.revision++;}
  if(has('transport')&&u.completedHarvest&&u.transportEnergyRemaining===0&&!S.negotiation){S.negotiation=1;S.paused=true;log(copy('copy.a-message-from-the-drifters'));}
  recoverSpaceWreck();u.last={...u.last,powerAverage:e.energyJ/seconds,powerUsed:used/seconds,chargingPower:u.stepChargeJ/seconds,accelerationPower:u.accelerationJ/seconds,transportPower:u.stepTransportJ/seconds,constructionPower:u.stepBuildJ/seconds,harvestRate:(u.gathered-beforeGathered)/days,equipRate:(u.industry-beforeHeavy)/days,clipRate:u.stepClipKg/days,frontSpeed:frontierBeta()/scaleFactor(u.years)};
  mapProgress();
 }

 function betaForMap(){return Math.max(S.s.cruiseBeta,broadcastReadiness());}
 const mapRadiusTolerance=1e-4;
 function mapDistanceTolerance(radius){return Math.max(1,radius)*mapRadiusTolerance;}
 function mapRemainingDistance(){return betaForMap()*remainingLight(S.s.years);}
 function accessibleMass(){const u=S.s;return u.completedMap?u.frozenAccessible:StellarSpace.recoverableMatter(u.radius+mapRemainingDistance());}
 function harvestProgress(){
  const u=S.s;if(!u?.hasFrontier||!u.horizonKnown||!u.intergalactic||u.completedMap)return mapProgress();
  // 把完成条件所对应的体积显示为 100%，使探索率一直增长到结束。
  const reachable=u.radius+mapRemainingDistance(),goal=reachable-mapDistanceTolerance(reachable/(1+mapRadiusTolerance));
  const accessible=StellarSpace.recoverableMatter(reachable);
  return Math.min(1-Number.EPSILON,updateMapProgress(u,accessible)*(accessible/StellarSpace.recoverableMatter(goal)));
 }
 function drifterControlledMass(){const b=S.s.drifterStock;return b.industry+b.clips+b.light;}
 function updateMapProgress(u,accessible){const e=u.engineering;e.mapProgress=Math.max(e.mapProgress,Math.min(1-Number.EPSILON,StellarSpace.recoverableMatter(u.radius)/Math.max(1,accessible)));return e.mapProgress;}
 function mapProgress(){const u=S.s;if(!u?.hasFrontier)return 0;return u.completedMap?1:updateMapProgress(u,accessibleMass());}
 function controlledStructures(){const u=S.s;if(u.radius<=C.galaxyR)return {kind:copy('copy.controlled-stars'),count:1+u.systemCount,estimated:u.coarse};const galaxies=StellarSpace.galaxies(u.radius),count=u.transportStartCount>0?Math.exp(Math.log(Math.max(1,u.transportStartCount))*(1-u.transportProgress)+Math.log(u.transportIslandCount)*u.transportProgress):galaxies;return {kind:has('transport')?copy('copy.islands'):copy('copy.controlled-galaxies'),count,estimated:true};}
 function captureTransportMatter(){const u=S.s;if(!has('residualCapture')||!u.boundKg)return;const p=u.transportProgress,target=u.engineering.origin*benefit('residualCapture','暗物质与重子质量比')*benefit('residualCapture','沿途捕获比例')*p*p*(3-2*p),added=Math.max(0,target-(u.residualCapturedKg||0)),rows=u.engineering.cohorts,total=rows.reduce((n,r)=>n+r.blackHole,0),devices=rows.reduce((n,r)=>n+r.devices,0);for(const r of rows)r.blackHole+=added*(total>0?r.blackHole/total:r.devices/Math.max(1,devices));u.residualCapturedKg=(u.residualCapturedKg||0)+added;u.blackHoleKg+=added;}
 function beginTransport(){const u=S.s;u.boundKg=u.engineering.origin-u.radiationKg-u.fusionLostKg;u.transportEnergyTotal=u.boundKg*SPACE.transportEnergy;u.transportEnergyRemaining=u.transportEnergyTotal;u.transportStartCount=StellarSpace.galaxies(u.radius);u.transportIslandCount=Math.min(u.transportStartCount,Math.max(1,Math.round(12*(u.radius/8.7e8)**3)));}
 function battleOdds(){const u=S.s,attack=SPACE.drifterCombat*u.design.combat/4*Math.min(1,u.design.combat/4)**1.2*u.tactics,defense=SPACE.drifterCombat*(1+.65*Math.max(0,u.autonomy-10)/10);return attack*attack/(attack*attack+defense*defense);}
 function effectiveSpeed(){const u=S.s;return S.stage===3&&u.battleCalibration!==false&&u.engagement&&!u.engagement.simulation.done?Math.min(S.speed,clamp(speedMax()/10,speedMin(),speedMax())):S.speed;}
 function battleInterval(){return Math.max(1,speedMax()/C.year)*7.8/CombatSpace.tempo;}
 function heldForces(){const e=S.s.engagement;return e&&!e.settled?{own:Math.max(0,e.own-e.lostOwn),enemy:Math.max(0,e.enemy-e.lostEnemy)}:{own:0,enemy:0};}
 function combatLoss(own,enemy){
  const u=S.s,buffers=controlBuffers(),b=u.drifterStock,enemyCount=u.drifters,kept=enemyCount>0?Math.max(Math.min(1,enemyCount),enemyCount-enemy):0,keptMass=enemyCount>0?b.probe*(kept/enemyCount):0,live=u.arrived+u.inFlight,ownShips=Math.min(u.probe,own*probeAverageMass()),enemyShips=Math.max(0,b.probe-keptMass);enemy=enemyCount-kept;
  const transit=u.automatic?Math.min(u.inFlight,live>0?own*u.inFlight/live:0):0;u.inFlight-=transit;u.arrived=stockRemainder(u.arrived,Math.max(0,own-transit));u.transitLosses+=transit;
  u.destroyed+=own;u.warLosses+=own;u.drifters=kept;u.probe=stockRemainder(u.probe,ownShips);b.industry=Math.max(0,b.industry-b.probe)+keptMass;b.probe=keptMass;u.industry+=enemyShips;u.wreck+=ownShips+enemyShips;settleControlBuffers(buffers,false);return enemy;
 }
 function battleYomi(b){if(!has('tactics'))return 0;const participation=b.yomiInvolvement??1,scale=3*researchYomiRate()*C.year*battleInterval()*participation*(b.count||1),own=b.lostOwn/Math.max(1,b.own),enemy=b.lostEnemy/Math.max(1,b.enemy),quality=clamp((enemy+.05)/(own+.05),.25,3);return b.draw?0:scale*(b.win?quality:-.5/quality);}
 function finishBattle(b){
  if(b.settled)return;const u=S.s,live=u.arrived+u.inFlight;
  if(!b.draw)shiftControl(b.win?0:Math.min(1,b.lostOwn/Math.max(1,live+b.lostOwn)),b.win?u.drifters/Math.max(1,u.drifters+b.lostEnemy):1);
  b.settled=true;u.wins+=Number(b.win);u.battlesEnded++;if(!u.engagement||u.engagement.serial===b.serial)u.firstAttackEnded=true;const yomi=Math.max(-S.yomi,battleYomi(b));S.yomi+=yomi;b.yomi=yomi;
  if(has('tactics')){if(battleResultOwner!==u){battleResultOwner=u;battleResults=[];}const count=b.count||1;for(let i=0;i<Math.min(3,count);i++)battleResults.push(yomi/count);battleResults=battleResults.slice(-3);}S.revision++;
 }
 function applyBattleEvents(b,events){const u=S.s;let own=0,enemy=0;for(const e of events){if(e.side)enemy+=b.enemy/b.particlesEnemy;else own+=b.own/b.particlesOwn;}const held=u.engagement?.serial===b.serial?{own:0,enemy:0}:heldForces();own=Math.min(own,Math.max(0,u.arrived+(u.automatic?u.inFlight:0)-held.own));enemy=Math.min(enemy,Math.max(0,u.drifters-held.enemy));enemy=combatLoss(own,enemy);b.lostOwn+=own;b.lostEnemy+=enemy;}
 function advanceCombat(years,finish=false){const u=S.s,b=u.battle;if(!b||u.engagement?.serial===b.serial)return;b.age+=years;if(b.settled)return;const time=finish?Infinity:b.age/b.years*b.duration,start=b.next;while(b.next<b.events.length&&b.events[b.next].time<=time)b.next++;applyBattleEvents(b,b.events.slice(start,b.next));if(b.next===b.events.length&&(finish||time>=b.duration))finishBattle(b);S.revision++;}
 function setBattlePresenter(presenter){battlePresenter=presenter;}
 function takeBattleResults(){const results=battleResultOwner===S.s?battleResults:[];battleResults=[];return results;}
 function commandBattle(x,y,held=false){const b=S.s?.engagement;return !!b&&CombatSpace.command(b.simulation,x,y,held);}
 function stepBattlePresentation(dt,beforeStep=null,maxSteps=Infinity){const u=S.s,b=u?.engagement;if(!b)return null;const simulation=b.simulation,start=simulation.events.length;b.remainder=(b.remainder||0)+dt;let steps=0;while(b.remainder>=1/30&&!simulation.done&&steps++<maxSteps){if(beforeStep)beforeStep(simulation);CombatSpace.step(simulation,1/30);b.remainder-=1/30;}if(!b.settled){applyBattleEvents(b,simulation.events.slice(start));if(simulation.combatEnded){b.win=simulation.win;b.draw=simulation.draw;b.duration=simulation.combatTime;b.years=Math.max(1,speedMax()/C.year)*b.duration/CombatSpace.maxAnimationRate;b.events=simulation.events;finishBattle(b);}}if(simulation.done)u.engagement=null;return simulation;}
 function roman(value){let out='';for(const [n,t]of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]){const count=Math.floor(value/n);out+=t.repeat(count);value-=n*count;}return out;}
 function battleForces(own,enemy,share,roll){const minor=Math.min(own,enemy);if(minor<=0)return {own:0,enemy:0};const major=Math.max(own,enemy),base=minor*share,multiplier=1+((major/minor)**.75-1)*roll;return {own:own>enemy?Math.min(own,base*multiplier):base,enemy:enemy>own?Math.min(enemy,base*multiplier):base};}
 function battle(repeats=1){
  const u=S.s;if(u.drifters<=(u.battleCount>0||u.battlesEnded>0?1:0)||u.drifterStock.probe<=0||u.probe<=0){u.pendingBattle=false;return;}if(battlePresenter&&(u.engagement||!battlePresenter())){u.pendingBattle=true;if(repeats<=1)return;repeats--;}advanceCombat(0,true);let held=heldForces(),live=u.arrived+u.inFlight,arrived=Math.max(0,live-(u.automatic?0:u.inFlight)-held.own),enemyAvailable=Math.max(0,u.drifters-(u.battleCount>0||u.battlesEnded>0?1:0)-held.enemy);if(enemyAvailable<1||arrived<1)return;
  if(u.battleCount===0){u.warOriginShips=live;u.warStartRadius=u.radius;}
  const chance=battleOdds(),seed=Math.floor(rng()*4294967296),shield=designResponse(u.design.shield),maturity=clamp((u.radius/u.warStartRadius-1)/1.5,0,1),share=(.08+.92*maturity)*(rng()<.25?1:.3+.5*rng()),involvement=rng();
  const presented=!!battlePresenter?.()&&!u.engagement;let simulation=null;
  function outcome(){if(!presented)return CombatSpace.resolve(seed,chance,ratio,shield);simulation=CombatSpace.create(seed,chance,ratio,shield);return {own:simulation.own,enemy:simulation.enemy,events:simulation.events,win:false,draw:false,duration:0};}
  let forces=battleForces(arrived,enemyAvailable,share,involvement),ratio=forces.own/forces.enemy,result=repeats>1?CombatSpace.resolve(seed,chance,ratio,shield):outcome();
  if(repeats>1){const own=arrived*(-Math.expm1(-(repeats-1)*forces.own/arrived*result.ownRate)),enemy=enemyAvailable*(-Math.expm1(-(repeats-1)*forces.enemy/enemyAvailable*result.enemyRate)),batch={yomiInvolvement:Math.sqrt(forces.own/arrived*forces.enemy/enemyAvailable),own:arrived,enemy:enemyAvailable,lostOwn:own,lostEnemy:enemy,win:result.win,draw:result.draw,settled:false,count:repeats-1};batch.lostEnemy=combatLoss(own,enemy);finishBattle(batch);u.wins+=Math.round((repeats-2)*chance);u.battlesEnded+=repeats-2;
   held=heldForces();const remaining=Math.max(0,u.arrived+(u.automatic?u.inFlight:0)-held.own),enemies=Math.max(0,u.drifters-(u.battleCount>0||u.battlesEnded>0?1:0)-held.enemy);forces=battleForces(remaining,enemies,share,involvement);if(forces.own<1||forces.enemy<1)return;ratio=forces.own/forces.enemy;result=outcome();
  }
  const ownForce=forces.own,enemyForce=forces.enemy;
  u.battleCount+=repeats;let name,nameParts,ordinal;
  if(!u.namedBattles){nameParts=[copy('copy.drifter-attack')];ordinal=' '+String(u.battleCount).padStart(2,'0');name=nameParts[0]+ordinal;}
  else{nameParts=battleNameParts(u,rng,presented);const base=nameParts.join('');u.battleNames[base]=(u.battleNames[base]||0)+1;ordinal=nameParts.length===1?'':'·'+roman(u.battleNames[base]);name=base+ordinal;}
  u.battle={yomiInvolvement:Math.sqrt(ownForce/arrived*enemyForce/enemyAvailable),name,nameParts,ordinal,win:result.win,draw:result.draw,odds:chance,shield,own:ownForce,enemy:enemyForce,serial:u.battleCount,seed,ratio,particlesOwn:result.own,particlesEnemy:result.enemy,events:result.events,duration:result.duration,years:Math.max(1,speedMax()/C.year)*result.duration/CombatSpace.maxAnimationRate,age:0,next:0,lostOwn:0,lostEnemy:0,settled:false};
  if(presented){u.engagement=u.battle;u.engagement.simulation=simulation;}
  S.revision++;
 }

 function advanceNegotiation(){if(S.negotiation>=1&&S.negotiation<C.negotiationPages){S.negotiation++;S.revision++;return true;}return false;}

