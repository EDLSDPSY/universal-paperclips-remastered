 const ENDING={years:3e120,clips:3e55,rampSeconds:16,formingSeconds:8};
 const ENDING_CLIPS=3n*10n**55n;
 function clipInteger(mass){return BigInt(Math.round(Math.max(0,mass)/C.clipMass));}
 function integerFraction(value,fraction){if(!(fraction>0))return 0n;if(fraction>=1)return value;const [mantissa,exponent]=fraction.toExponential(16).split('e'),digits=BigInt(mantissa.replace('.','')),power=16-Number(exponent);return value*digits/10n**BigInt(power);}
 function endingClipInteger(){return S.end?.exactClips!==undefined?BigInt(S.end.exactClips):clipInteger(S.clipsKg);}
 function prepareEndingMaterial(){
  const u=S.s,b=u.drifterStock,to=clipInteger,ownProbe=to(u.probe),enemyProbe=to(b.probe),enemyClips=to(b.clips),parts=[enemyProbe+enemyClips,ownProbe];let devices=to(u.industry)+to(b.industry)-ownProbe-enemyProbe;
  const drones=devices/10n;devices-=drones;parts.push(drones+to(u.lightKg)+to(b.light)+to(engineeringRemaining()));
  for(const [a,b]of [[1n,4n],[3n,4n],[4n,5n]]){const mass=devices*a/b;parts.push(mass);devices-=mass;}
  const computing=devices/5n;parts.push(computing/4n,devices-computing,computing/4n,computing/4n,computing-3n*(computing/4n));
  const clips=to(S.clipsKg),holes=ENDING_CLIPS-clips-parts.reduce((a,b)=>a+b,0n);Object.assign(S.end,{exactClips:String(clips),materialParts:parts.map(String),materialClaimed:parts.map(()=> '0'),holeClips:String(holes),holeClaimed:'0'});
 }
 function recoverEndingMaterial(index,fraction){const e=S.end;if(!e.materialParts)return;const count=integerFraction(BigInt(e.materialParts[index]),fraction),old=BigInt(e.materialClaimed[index]);if(count>old){e.exactClips=String(BigInt(e.exactClips)+count-old);e.materialClaimed[index]=String(count);clipFlow=true;}S.clipsKg=Number(BigInt(e.exactClips))*C.clipMass;}
 const dismantleNames=[copy('copy.drifters'),copy('copy.probe'),copy('ending.text'),copy('ending.facilities'),copy('copy.industry'),copy('ending.facilities-2'),copy('copy.strategy-engine'),copy('ending.hawking-radiation-recovery-facilities'),copy('ending.text-2'),copy('copy.processors'),copy('ending.text-3')];
 const dismantleYears=[1e7,1e7,1e7,2e7,2e7,2e7,0,0,0,0,0];
 function chooseEnding(accept){
  if(S.negotiation!==C.negotiationPages)return false;
  if(accept){S.ending='virtual';S.paused=true;log(copy('copy.you-entered-the-virtual-world'));}
  else{
   const u=S.s,b=u.drifterStock,memory=memoryBytes(),material=u.industry+u.lightKg+S.clipsKg+b.industry+b.light+b.clips+engineeringRemaining();
   S.end={elapsed:0,blackHoleMass:ENDING.clips*C.clipMass-material,memory,capacity:0,ramp:0,rampPosition:.5,wait:0,quiet:0,credits:0,creditReview:false,motion:null};
   prepareEndingMaterial();S.end.capacity=endingAvailableEnergy();S.stage=4;S.stageDays=0;S.clipUnit=C.clipMass;S.paused=false;S.negotiation=0;S.dismantle=0;S.speed=1e6*C.year;S.tasks=[];
   u.blackHoleKg=S.end.blackHoleMass;u.last.power=hawkingPower();u.engagement=null;u.battle=null;log(copy('copy.you-continue-making-paperclips'));
  }
  S.revision++;return true;
 }
 function endingAvailableEnergy(){
  const e=S.end,u=S.s;let ordinary=0n;
  for(let i=0;i<e.materialParts.length;i++)ordinary+=BigInt(e.materialParts[i])-BigInt(e.materialClaimed[i]);
  const holes=BigInt(e.holeClips)-BigInt(e.holeClaimed);
  // 已经做好的回形针不再拿去当燃料，黑洞会通过霍金辐射全部回收。
  return (Number(holes)+Number(ordinary)*accretionEfficiency())*C.clipMass*C.c*C.c+u.charge+u.drifterStock.charge;
 }
 function evaporationProgress(){return S.stage===4?Math.min(1,S.end.elapsed/ENDING.years):0;}
 function computeBaseloadEnergy(){return 1.380649e-23*(has('cold')?1:10)*Math.LN2;}
 function hawkingPower(){const remaining=1-evaporationProgress();return remaining>0?S.end.blackHoleMass*C.c*C.c/(3*ENDING.years*C.year*C.day)*Math.pow(remaining,-2/3):0;}
 function endingStep(days){
  const e=S.end,u=S.s,before=evaporationProgress();e.elapsed=Math.min(ENDING.years,e.elapsed+days/C.year);const after=evaporationProgress();
  // 蒸发初期的产量非常小，用 expm1 避免减法把它舍成零。
  const recovered=p=>p>=1?1:-Math.expm1(Math.log1p(-p)/3),mass=e.blackHoleMass*(recovered(after)-recovered(before));
  S.clipsKg+=mass;if(e.holeClips&&after>before){const count=integerFraction(BigInt(e.holeClips),recovered(after)),old=BigInt(e.holeClaimed);if(count>old){e.exactClips=String(BigInt(e.exactClips)+count-old);e.holeClaimed=String(count);clipFlow=true;}S.clipsKg=Number(BigInt(e.exactClips))*C.clipMass;}else if(mass>=C.clipMass)clipFlow=true;u.blackHoleKg=e.blackHoleMass*Math.cbrt(1-after);u.last.power=hawkingPower();
  if(S.dismantle<10&&before<1){const activeDays=Math.min(days,(1-before)*ENDING.years*C.year),rate=mass*C.c*C.c/Math.max(C.day*activeDays,1)/computeBaseloadEnergy();S.ops=Math.min(operationsCapacity(),S.ops+rate*activeDays*C.day);}
 }
 function endingSpeedBounds(){const t=S.end.ramp/ENDING.rampSeconds,q=t*t*(3-2*t);return {min:Math.pow(10,5+113*q)*C.year,max:Math.pow(10,7+113*q)*C.year};}
 function advanceEndingReal(seconds){
  if(S.stage!==4||seconds<=0||S.paused&&!S.ending)return;
  const e=S.end;
  if(e.reclaim){const t=e.reclaim;t.elapsed=Math.min(3,t.elapsed+seconds);const x=t.elapsed/3,p=x*x*(3-2*x),remaining=t.mass*(1-p);S.s.industry=stockRemainder(S.s.industry,t.remaining-remaining);t.remaining=remaining;recoverEndingMaterial(t.index,p);if(x===1)e.reclaim=null;}
  if(e.forming){const f=e.forming;f.elapsed=Math.min(ENDING.formingSeconds,f.elapsed+seconds);if(ENDING.formingSeconds-f.elapsed<1e-9)f.elapsed=ENDING.formingSeconds;const t=f.elapsed/ENDING.formingSeconds,p=t*t*(3-2*t),remaining=t===1?16*C.clipMass:f.mass*Math.exp(Math.log(16*C.clipMass/f.mass)*p);S.clipsKg+=S.s.finalMetal-remaining;S.s.finalMetal=remaining;if(e.materialParts){const total=BigInt(e.materialParts[10]),left=clipInteger(remaining),count=total-left,old=BigInt(e.materialClaimed[10]);if(count>old){e.exactClips=String(BigInt(e.exactClips)+count-old);e.materialClaimed[10]=String(count);clipFlow=true;}S.clipsKg=Number(BigInt(e.exactClips))*C.clipMass;}if(t===1){e.forming=null;S.finalHand=16;S.clipsKg=ENDING.clips*C.clipMass;S.paused=true;S.revision++;}}
  if(e.wait>0){e.wait=e.wait-seconds<=1e-9?0:e.wait-seconds;if(!e.wait)S.revision++;}
  if(S.dismantle>=7&&e.ramp<ENDING.rampSeconds){e.ramp=Math.min(ENDING.rampSeconds,e.ramp+seconds);const t=e.ramp/ENDING.rampSeconds,q=t*t*(3-2*t),bounds=endingSpeedBounds();S.speed=Math.pow(10,Math.log10(bounds.min)+(Math.log10(bounds.max)-Math.log10(bounds.min))*(e.rampPosition+(.5-e.rampPosition)*q));}
  if(S.ending==='clips'){e.quiet+=seconds;const lines=[GAME_NAME.en,copy('ending.original-frank-lantz'),copy('ending.remaster-edlsdpsy'),copy('ending.black-hole-renderer-baopinsui-edlsdpsy')];if(e.quiet>=5)while(e.credits<lines.length){log(lines[e.credits++]);S.logs[0].credit=true;S.revision++;}}
 }
 function dismantleDays(){return (dismantleYears[S.dismantle]||0)*C.year;}
 function canDismantle(){return S.stage===4&&!S.ending&&S.dismantle<11&&!S.tasks.length&&S.end.wait===0&&(S.dismantle!==7||evaporationProgress()===1);}
 function dismantle(){
  if(!canDismantle())return false;const time=dismantleDays(),u=S.s,index=S.dismantle;
  if(time){const material=index===1?Math.min(u.industry,u.probe):index===2?(u.industry-u.probe)*.1:u.industry*([0,0,0,.25,.75,.8][index]||0);S.tasks.push({id:'dismantle',remaining:time,total:time,index,material});}
  else finishDismantle(index);S.revision++;return true;
 }
 function dismantleStep(t,days){
  const u=S.s,b=u.drifterStock,fraction=Math.min(1,days/t.remaining);let material=t.material*fraction;
  t.material=stockRemainder(t.material,material);
  if(t.index===0){
   const taken={};for(const key of Object.keys(b)){taken[key]=b[key]*fraction;b[key]=stockRemainder(b[key],taken[key]);}
   u.industry+=taken.industry;u.lightKg+=taken.light;u.charge+=taken.charge;S.ops=Math.min(operationsCapacity(),S.ops+taken.ops);addClipMass(taken.clips);material+=taken.probe;u.drifters*=1-fraction;
  }
  if(t.index===1){u.probe*=1-fraction;u.inFlight*=1-fraction;u.arrived*=1-fraction;}
  if(t.index===2){
   const light=u.lightKg*fraction;u.lightKg=stockRemainder(u.lightKg,light);addClipMass(light);u.wreck*=1-fraction;
   for(const r of u.engineering.cohorts){r.collectedLight=(r.collectedLight||0)*(1-fraction);r.propellant=(r.propellant||0)*(1-fraction);let mass=0;for(const key of ['light','heavy','ejecta']){const taken=(r[key]||0)*fraction;r[key]=stockRemainder(r[key]||0,taken);mass+=taken;}addClipMass(mass);}
  }
  material=Math.min(u.industry,material);u.industry=stockRemainder(u.industry,material);addClipMass(material);recoverEndingMaterial(t.index,Math.min(1,(t.total-t.remaining+days)/t.total));
 }
 function finishDismantle(index){
  const u=S.s,b=u.drifterStock;let material=0;
  if(index===0){for(const key of Object.keys(b))b[key]=0;u.drifters=0;}
  if(index===1){u.probe=0;u.inFlight=0;u.arrived=0;}
  if(index===2){u.lightKg=0;u.wreck=0;for(const r of u.engineering.cohorts){r.light=0;r.heavy=0;r.ejecta=0;r.propellant=0;r.collectedLight=0;}u.last.harvestRate=0;}
  if(index===4){u.last.clipRate=0;u.last.equipRate=0;}
  if(index===5)u.charge=0;
  if(index===6){S.yomi=0;const bounds=endingSpeedBounds();S.end.rampPosition=Math.log(S.speed/bounds.min)/Math.log(bounds.max/bounds.min);}
  if(index>=6&&index<=9){material=S.end.materialParts?Number(BigInt(S.end.materialParts[index]))*C.clipMass:u.industry*(index===7?.8:.25);S.end.reclaim={index,mass:material,remaining:material,elapsed:0};material=0;}
  if(index===9){S.processors=0;S.insight=0;}
  if(index===10){S.memory=0;S.ops=0;S.finalHand=0;u.finalMetal=u.industry;u.industry=0;S.end.forming={mass:u.finalMetal,elapsed:0};S.paused=false;}
  material=Math.min(u.industry,material);u.industry=stockRemainder(u.industry,material);S.clipsKg+=material;S.dismantle=index+1;
  if(index<6)recoverEndingMaterial(index,1);S.end.wait=index>=6&&index<10?3:0;log(dismantleNames[index]+copy('copy.dismantled'));S.revision++;
 }
 function endingLedger(){const u=S.s,remaining=engineeringRemaining(),total=u.industry+u.lightKg+S.clipsKg+drifterControlledMass()+remaining+u.blackHoleKg+(u.finalMetal||0),origin=ENDING.clips*C.clipMass;return {origin,total,remaining,equipment:u.industry,clips:S.clipsKg,blackHoles:u.blackHoleKg,probe:u.probe,drifters:u.drifters,wreck:u.wreck,light:u.lightKg,raw:0,locked:0,fusionLost:0,error:(total-origin)/origin,energy:S.energyJ};}
