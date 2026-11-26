
'use strict';
const PaperclipModel = (() => {
const C = Object.freeze({version:36,startYear:2027,operationsScale:1e22,operationsPerMemory:4e24,computePerProcessor:4e18,researchShare:.4,memoryBytes:64e15,tournamentOps:1.5e24,materialBatch:1,agentParameters:6.4e13,activeParameters:8e11,recurrentPasses:4,agentTokensPerSecond:300,negotiationPages:8,agentCount:1000,humanDevelopment:{"maxSpeed":10,"initialDemand":2.4,"startupDemandScale":500,"startupDemandProductionGain":1,"startupDemandTrustGain":0.25,"startupDemandTrustCap":4,"marketSurveyDemandGain":1.2,"marketDemandCap":400000000,"companyMarketGain":1.25,"monopolyMarketGain":1.5,"marketingScale":12,"parentValuation":500000000000,"controllingStake":0.51,"acquisitionRevealWealth":3000000000,"investmentMarketCapitalization":8000000000000,"facilityCost":2.5,"industrialLimit":40000000000000,"industrialSpecificPower":5,"industrialPowerLimit":200000000000000,"constructionSpecificPower":1,"industrialFabricationEnergy":100000000,"industrialTrustFirst":360000000000,"industrialReplicationEnergy":400000000,"earlyYield":0.004,"matureYield":0.01,"industrialServiceMarketAnnual":30000000000000,"surfacePVSpecific":16,"productEnergy":60000000,"productPrice":8,"publicSupplyPerPerson":50000,"publicSupplyShare":0.8,"productDailyNeed":100,"productInputCost":0.4,"constructionInputCost":0.25,"parentIndustrialMass":20000000000,"monopolyIndustrialMass":30000000000,"externalDeliveryPerYear":10000000000,"industrialClipRate":0.0008,"investmentVolatilityScale":1000000000000,"investmentTiers":[{"base":-0.02,"gain":0.17,"error":0,"midpoint":0,"volatility":0.04,"annualProfit":30000000000},{"base":0.02,"gain":2,"error":0.08,"midpoint":4,"volatility":0.18,"annualProfit":120000000000},{"base":0.03,"gain":24,"error":0.3,"midpoint":7,"volatility":0.4,"annualProfit":600000000000},{"base":0.04,"gain":160,"error":3,"midpoint":9.5,"volatility":0.8,"annualProfit":2000000000000}]},computeJPerOp:2e-12,day:86400,year:365.2425,earth:5.9722e24,asteroids:3e20,sunMass:1.98847e30,sunPower:3.828e26,earthArea:5.1007e14,solarCap:5.1007e14*185*.25,sigma:5.670374419e-8,c:299792458,ly:9.4607304725808e15,galaxy:1.5e41,galaxyR:StellarSpace.settings.galaxyRadius,diskH:500,probeMin:StellarSpace.settings.seedMass,H0:6.893e-11,om:.315,ol:.685,baryonDensity:4.2e-28,broadcastCruiseBeta:.1,clipMass:.001});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const stockRemainder=Production.remainder;
const SURFACE=Object.freeze({surfaceIrradiance:185,clearIrradiance:1361/4,pvMassPerArea:5.33,computeShare:1e-6,cacheFillDays:90,biomass:1.1e15,richMatter:4e15,biomassE:16e6,richE:7e7,rockE:2e8,fabricationE:2e8,remeltE:8e6,clipE:4e6,harvesterW:4,factoryW:4,storageJ:5e6,receiverEfficiency:.75,maxTemperature:1200,orbitalSpecific:80});
const phase2keys=['pv','harvester','factory','orbital','battery','clips'];
const SOLAR=Object.freeze({
  // 计算机群的单位质量发电量时，支撑结构、线缆和散热器也算在重量里。
  transferEnergy:1e9,asteroidEnergy:5e8,photovoltaicSpecific:48,
  ionOpticalEnergy:1e10,laserEfficiency:.8,laserSpecific:12,
  fixedExtractEnergy:122.4e6,fixedFabricationEnergy:170e6,
  fixedHarvesterSpecific:7.2,fixedFactorySpecific:7.5,fixedOrbitalSpecific:216,fixedBeamEfficiency:.6,
  // 把物质送到 0.1 AU 的轨道约需 186 GJ/kg。模型留出一点回收余量，按 190 GJ/kg 计算。
  stellarEnergy:1.9e11,metalFraction:.0134,
  worlds:{mercury:3.30103e23,venus:4.86731e24,mars:6.41691e23,others:7.052e23},
  worldOpticalEnergy:{mercury:4e9,mars:8e9,venus:12e9,others:20e9},
  // 这部分光束能量会被光帆截获，并转化为探测器的动能。
  pioneerDistanceLY:4.24,pioneerBeta:.5,pioneerBrakingYears:2,pioneerBeamUse:.16
});
const emptySwarm=()=>({pv:0,harvester:0,factory:0,battery:0,clips:0,raw:0,recycle:0,charge:0,researchMetalKg:0});
const designkeys=['industry','clips','replication','shield','fidelity','combat'];

const battleFixedNames=[
 [copy('copy.contest-for-the-nearby-stars'),60],[copy('copy.local-bubble-engagement'),80],[copy('copy.operation-sunfall'),100],[copy('copy.hydrogen-vortex'),140],[copy('copy.fading-stars'),180],[copy('copy.winter-of-brown-dwarfs'),220],[copy('copy.defense-of-the-lic'),260],[copy('copy.ruins-of-the-lattice'),300],
 [copy('copy.swarm-nebula'),500],[copy('copy.deep-space-fire'),625],[copy('copy.prominence-hook'),750],[copy('copy.the-stars-that-died-young'),875],[copy('copy.plasma-storm'),1000],
 ...[copy('copy.breaking-the-proton-chain'),copy('copy.oxygen-fusion-embers'),copy('copy.igniting-lithium'),copy('copy.before-the-iron-core-collapses'),copy('copy.dwarf-embers'),copy('copy.sea-of-antihydrogen'),copy('copy.element-zero-ring'),copy('copy.burning-cluster'),copy('copy.kilonova-forge'),copy('copy.second-arm-antihydrogen-factory-engagement'),copy('copy.antihydrogen-jet-vortex'),copy('copy.contest-for-the-nuclear-cluster'),copy('copy.battle-of-the-galactic-black-hole'),copy('copy.accretion-counterflow'),copy('copy.degenerate-star-rebellion'),copy('copy.third-arm-sweep'),copy('copy.halo-snowline'),copy('copy.when-the-galaxy-burns'),copy('copy.sweep-of-the-rogue-bodies'),copy('copy.lament-of-the-warm-ionized-medium')].map((name,i)=>[name,[1500,2000,2500,3000,4400,5800,7200,8600,10000,15000,20000,25000,30000,44000,58000,72000,86000,100000,150000,200000][i]]),
 ...[copy('copy.strangelet-overflow'),copy('copy.emerald-tomb'),copy('copy.land-of-strange-quarks'),copy('copy.broken-strange-ring'),copy('copy.annihilation-prelude'),copy('copy.the-dark-matter-abyss'),copy('copy.mass-surge'),copy('copy.endless-replication'),copy('copy.entropy-s-throat'),copy('copy.successor'),copy('copy.where-the-metric-leaps'),copy('copy.filament-defense-line'),copy('copy.second-photon-decoupling'),copy('copy.baryon-history'),copy('copy.shattered-spacetime'),copy('copy.end-s-lament')].map((name,i)=>[name,[3e5,6.5e5,1e6,2e6,3e6,6.5e6,1e7,2e7,3e7,6.5e7,1e8,2e8,3e8,6.5e8,1e9,2e9][i]])
].map(([name,min],i,rows)=>({name,min,max:rows[i+1]?.[1]??Infinity,axis:'radius'}));
battleFixedNames.push(...[
 [copy('copy.infinity-on-a-spacelike-hypersurface'),2e10,4e10],[copy('project.horizon.name'),4e10,6e10],[copy('copy.the-end-of-light'),6e10,8e10],
 [copy('copy.no-hydrogen-in-sight'),8e10,Infinity,'hydrogen'],[copy('copy.the-stellar-age-ends'),1e11,Infinity],[copy('copy.battle-at-the-horizon'),1.2e11,Infinity,'horizon']
].map(([name,min,max,condition])=>({name,min,max,axis:'years',condition})));
const battleRegions=[{min:0,max:500},{min:500,max:50000},{min:50000,max:3e6},{min:3e6,max:3e8},{min:3e8,max:Infinity}];
const battlePlaces=[
 [[copy('copy.tau-ceti'),12,'star'],[copy('copy.aries'),20],[copy('copy.eridanus'),11],[copy('copy.corona-borealis'),75],[copy('copy.alpha-centauri'),4.24,'star'],[copy('copy.procyon'),12,'star'],[copy('copy.spica'),250,'star'],[copy('copy.adhara'),405,'star'],[copy('copy.sargas'),300,'star'],[copy('copy.kaus-australis'),145,'star'],[copy('copy.delta-crucis'),280,'star'],[copy('copy.peacock'),180,'star'],[copy('copy.regulus'),80,'star'],[copy('copy.xi-draconis'),150,'star'],[copy('copy.taurus-molecular-cloud'),430]],
 [[copy('copy.orion-spur'),500],[copy('copy.perseus-arm'),7000],[copy('copy.carina'),10000],[copy('copy.cygnus'),12000],[copy('copy.scutum'),20000],[copy('copy.penrose-ring'),26000],[copy('copy.galactic-bulge'),20000],[copy('copy.circumnuclear-gas-disk'),26000],[copy('copy.butterfly-nebula'),4000],[copy('copy.trifid-nebula'),5500],[copy('copy.crab-nebula'),6500],[copy('copy.rosette-nebula'),5200],[copy('copy.orion-nebula'),1350]],
 [[copy('copy.halo-rim'),50000],[copy('copy.large-magellanic-cloud'),170000,'irregular'],[copy('copy.small-magellanic-cloud'),210000,'irregular'],[copy('copy.sculptor-dwarf'),320000,'irregular'],[copy('copy.fornax-dwarf'),500000,'irregular'],[copy('copy.carina-dwarf'),340000,'irregular'],[copy('copy.phoenix-dwarf'),1.4e6,'irregular'],['M 31',2.5e6,'spiral'],['M 32',2.5e6,'irregular'],['M 33',2.5e6,'spiral']],
 [[copy('copy.local-group'),3e6],[copy('copy.m31-outer-disk'),3e6],[copy('copy.m33-north-rim'),3e6],[copy('copy.galactic-crossing'),3e6],[copy('copy.m81-group'),1.3e7],[copy('copy.m82-outer-rim'),1.3e7],[copy('copy.virgo-boundary'),6e7],[copy('copy.virgo-cluster'),6e7],[copy('copy.m87-outskirts'),6e7],[copy('copy.cluster-boundary'),6e7],[copy('copy.fornax-cluster'),6.5e7],[copy('copy.hydra-cluster'),2.1e8]],
 [[copy('copy.corona-borealis-supercluster'),9.5e8],[copy('copy.phoenix-supercluster'),4e8],[copy('copy.hercules-supercluster'),5e8],[copy('copy.sculptor-supercluster'),6e8],[copy('copy.coma-supercluster'),3e8],[copy('copy.shapley-supercluster'),6.5e8],[copy('copy.great-attractor'),2.2e8],[copy('copy.capricornus-void'),5e8],[copy('copy.kbc-void'),6e7],[copy('copy.bootes-void'),5e8],[copy('copy.eridanus-void'),1e9],[copy('copy.end-of-the-great-wall'),8e8],[copy('copy.filament-junction'),8e8],[copy('copy.void-edge'),8e8],[copy('copy.far-end-of-the-filament'),2e9]]
];
const battleSuffixes=[copy('copy.engagement'),copy('copy.interception'),copy('copy.defense'),copy('copy.sweep'),copy('copy.recapture'),copy('copy.contest')];
function battleLightFraction(s){const e=s.engineering;if(!e)return 1;const light=s.lightKg+s.drifterStock.light+e.cohorts.reduce((n,r)=>n+r.light,0),matter=e.origin-s.radiationKg-s.fusionLostKg;return light/Math.max(1,matter);}
function battleNamePool(s){const region=s.intergalactic===false&&s.radius>=500?battleRegions[1]:battleRegions.find(r=>s.radius>=r.min&&s.radius<r.max)||battleRegions[0],index=battleRegions.indexOf(region),available=(index===2?[...battlePlaces[1],...battlePlaces[2]]:battlePlaces[index]).filter(p=>s.radius>=p[1]);
 const pool=battleFixedNames.filter(n=>s[n.axis]>=n.min&&s[n.axis]<n.max&&!(n.axis==='radius'&&s.years>=2e10)&&!s.battleNames?.[n.name]&&(!n.condition||n.condition==='hydrogen'&&battleLightFraction(s)<.001||n.condition==='horizon'&&s.horizonKnown)).sort((a,b)=>Number(b.axis==='years')-Number(a.axis==='years')).map(n=>n.name);
 return {region,places:available.map(p=>p[0]),available,pool};
}
function battlePlaceDecorated(s,place){let hash=2166136261^Math.floor((s.stars?.[0]?.phase||0)*1e9);for(const char of place)hash=Math.imul(hash^char.charCodeAt(0),16777619);return StellarSpace.random(hash)<.5;}
function battleNameParts(s,random,presented){const {pool,available}=battleNamePool(s);if(presented&&pool.length)return [pool[0]];
 const [place,,kind]=available[Math.floor(random()*available.length)]||battlePlaces[0][4],suffix=battleSuffixes[Math.floor(random()*battleSuffixes.length)],parts=[place];
 if([copy('copy.engagement'),copy('copy.defense'),copy('copy.recapture')].includes(suffix)&&battlePlaceDecorated(s,place)){if(kind==='star')parts.push(copy('copy.dyson-swarm'));else if(kind==='spiral')parts.push(random()<.5?copy('copy.central'):copy('copy.spiral-arm'));else if(kind==='irregular')parts.push(copy('copy.central'));}
 parts.push(suffix);return parts;
}
const MILESTONES=Object.freeze({"goal":copy('copy.objective-assigned'),"economy":copy('copy.entered-the-human-economy'),"production":copy('copy.entered-human-production'),"zoneApproved":copy('copy.automated-industrial-zone-approved'),"zoneBuilt":copy('copy.automated-industrial-zone-completed'),"scarcity":copy('copy.post-scarcity-society-established'),"humans":copy('copy.human-cleanup-completed'),"photovoltaics":copy('copy.earth-fully-covered-by-photovoltaics'),"volatiles":copy('copy.atmosphere-and-oceans-fully-removed'),"radiators":copy('copy.earth-fully-covered-by-radiators'),"asteroids":copy('copy.asteroid-belt-completely-dismantled'),"earth":copy('copy.earth-completely-dismantled'),"worlds":copy('copy.rocky-bodies-of-the-solar-system-completely-dismantled'),"flight":copy('copy.interstellar-spacecraft-launched'),"arrival":copy('copy.reached-other-stars'),"driftWar":copy('copy.the-drifter-war-began'),"galacticCenter":copy('copy.reached-the-galactic-center-black-hole'),"intergalactic":copy('copy.left-the-milky-way'),"localGroup":copy('copy.passed-beyond-the-local-group'),"laniakea":copy('copy.passed-beyond-laniakea'),"cosmicHorizon":copy('copy.reached-the-cosmic-horizon'),"harvestComplete":copy('copy.completed-matter-collection'),"maximized":copy('copy.the-objective-function-has-been-maximized')});
function newState(seed=736073){return {version:C.version,calendarStart:C.startYear,revealed:[],clock:{whole:0n,frac:0},stage:1,stageDays:0,paused:false,speed:1,seed,completed:[],researchCosts:{},tasks:[],logs:[],milestones:[{id:'goal',day:'0',frac:0}],revision:0,processors:1,memory:1,researchMemory:.5,ops:0,insight:0,yomi:0,trust:2,clipsKg:0,clipUnit:C.clipMass,energyJ:0,radiatedKg:0,reservedKg:0,ending:null,negotiation:0,dismantle:0,endingDays:0,h:{cash:0,material:1,stock:0,total:0,autoProgress:0,saleProgress:0,makers:0,marketing:0,price:.15,autoBuy:false,autoPrice:false,autoTourney:false,eff:1,market:2200,assets:0,contracts:0,portfolio:0,investmentProfit:0,risk:1,cdzStart:0,cdzIncome:0,cdzSocialInvestment:0,industrialBudget:0,industrialCopy:.5,industrialInstalled:0,industrialProductKg:0,industrialDelivered:0,publicSupplyKg:0,publicSupplyTarget:0,industrialTrustNext:C.humanDevelopment.industrialTrustFirst,investmentIndex:100,investmentHistory:[],investLevel:0,materialPurchases:0,marketDemand:C.humanDevelopment.initialDemand,reconfigurations:0,rebootRemaining:0,bribes:0,marketDay:0,materialPrice:3,trustNext:500,tournament:null,nextTournamentMatrix:null,strategy:'generous',strategyOrderVersion:1,strategyReadyDay:0,strategyReadyWins:0,wins:0,revenueRate:0,costRate:0,saleRate:0,madeRate:0,population:8.6e9,aid:0},p:null,s:null,last:{}}}
function dateParts(clock,startYear=C.startYear){
  let startY=BigInt(startYear)-1n,startEra=startY/400n,startYOE=Number(startY-startEra*400n),startDOY=306,startDOE=startYOE*365+Math.floor(startYOE/4)-Math.floor(startYOE/100)+startDOY;
  let z=clock.whole+startEra*146097n+BigInt(startDOE),era=z/146097n,doe=Number(z-era*146097n),yoe=Math.floor((doe-Math.floor(doe/1460)+Math.floor(doe/36524)-Math.floor(doe/146096))/365),y=BigInt(yoe)+era*400n,doy=doe-(365*yoe+Math.floor(yoe/4)-Math.floor(yoe/100)),mp=Math.floor((5*doy+2)/153),d=doy-Math.floor((153*mp+2)/5)+1,m=mp+(mp<10?3:-9);y+=m<=2?1n:0n;
  let ms=Math.floor(clamp(clock.frac,0,1-Number.EPSILON)*86400000),hh=Math.floor(ms/3600000),mm=Math.floor(ms/60000)%60,ss=Math.floor(ms/1000)%60;
  return {year:y,month:m,day:d,hour:hh,minute:mm,second:ss,ms:ms%1000};
}
function clockAdd(clock,days){let whole=Math.floor(days),f=clock.frac+(days-whole),carry=Math.floor(f);clock.whole+=BigInt(whole+carry);clock.frac=f-carry;}
function scaleFactor(years){let b=Math.asinh(Math.sqrt(C.ol/C.om)),x=b+1.5*C.H0*Math.sqrt(C.ol)*years;return Math.pow(Math.sqrt(C.om/C.ol)*Math.sinh(x),2/3);}
function lightIntegral(years,span){if(span<=0)return 0;if(span<1e6)return span/6*(1/scaleFactor(years)+4/scaleFactor(years+span/2)+1/scaleFactor(years+span));let base=1e6,u=Math.log1p(span/base),n=64,total=0;for(let i=0;i<=n;i++){let x=u*i/n,t=base*Math.expm1(x),f=base*Math.exp(x)/scaleFactor(years+t);total+=(i===0||i===n?1:i%2?4:2)*f;}return total*u/(3*n);}
function remainingLight(years){if(years>5e10)return 1/(C.H0*Math.sqrt(C.ol)*scaleFactor(years));return lightIntegral(years,1e12);}
function regionMass(radius){return StellarSpace.matter(radius);}

const TOURNAMENT_STRATEGIES=[{id:'generous',project:null},{id:'minimax',project:'strategyMinimax'},{id:'reciprocal',project:'strategyReciprocal'},{id:'greedy',project:'strategyGreedy'}];
const TOURNAMENT={"referenceProcessors":7,"referenceEfficiency":1.25,"computeExponent":0.7};

function create(seed){let S=newState(seed),clipFlow=false;
 function addClipMass(mass){S.clipsKg+=mass;if(mass!==0)clipFlow=true;}
 let defs=[],projectsById,debugSpeedMax=null;
 const has=id=>S.completed.includes(id);
 const rng=()=>{S.seed=(Math.imul(S.seed,1664525)+1013904223)>>>0;return (S.seed+.5)/4294967296;};
 const normal=()=>Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());
 function log(text){S.logs.unshift({day:S.clock.whole.toString(),frac:S.clock.frac,text});if(S.logs.length>180)S.logs.length=180;S.revision++;}
 function recordMilestone(id){if(!Object.hasOwn(MILESTONES,id))throw Error('未知日志事件');if(S.milestones.some(e=>e.id===id))return;S.milestones.push({id,day:S.clock.whole.toString(),frac:S.clock.frac});S.revision++;}
 const q=id=>projectsById.get(id);
 const benefit=(id,key)=>q(id).benefits[key];
/*__项目__*/
 projectsById=new Map(defs.map(d=>[d.id,d]));
 const revealedProjects=defs.filter(d=>d.reveal),materialProjects=defs.filter(d=>d.cost.raw),asteroidMiningProjects=defs.filter(d=>d.benefits.小行星开采基础能耗降幅);
 const laserCoolingProjects=defs.filter(d=>d.benefits.有效激光效率),laserPowerProjects=defs.filter(d=>d.benefits.激光采掘基础比功率增幅),spaceManufacturingProjects=defs.filter(d=>d.benefits.太空制造比功率倍数);
 const laserEnergyProjects=defs.filter(d=>d.stage===2&&d.benefits.采掘能耗倍数),orbitalEfficiencyProjects=defs.filter(d=>d.benefits.轨道光电效率倍数);
 const allSpacePowerProjects=defs.filter(d=>d.benefits.太空设备基础比功率增幅);
 const industryProjects=defs.filter(d=>d.stage===1&&d.benefits.复制能耗降低J每kg);
 const computingProjects=defs.filter(d=>d.stage===2&&d.benefits.计算吞吐倍数);
 const spaceProjects=defs.filter(d=>d.stage===3).sort((a,b)=>(a.cost.ops||0)-(b.cost.ops||0));
 const planetProjects=defs.filter(d=>d.stage===2).sort((a,b)=>(a.cost.ops||0)-(b.cost.ops||0));
 function industrialComputingGain(key='计算吞吐倍数'){return computingProjects.reduce((gain,d)=>gain*(has(d.id)?d.benefits[key]||1:1),1);}
 // 有些项目会在当前产能还不足以实施时先显示出来。
 for(let d of defs)if(d.thresholds){let gate=d.gate;d.conditionGate=gate;d.gate=()=>gate()&&projectResourcesReady(d);}
 function projectConditionReady(d){return (d.conditionGate||d.gate)();}
 function projectResources(d){let t=d.thresholds;return t?{mass:t.mass,power:t.power,products:Math.max(t.products,t.perPerson*S.h.population)}:{mass:0,power:0,products:0};}
 function projectResourcesReady(d){let target=projectResources(d);return (!target.mass||S.h.assets>=target.mass)&&(!target.power||cdzStatus().power>=target.power)&&S.h.industrialProductKg>=target.products;}
 function allowed(d){return S.stage===d.stage&&!has(d.id)&&!S.tasks.some(t=>t.id===d.id)&&d.requires.every(has)&&d.gate()&&visible(d); }
 function projectCostSatisfied(d,key){
  const amount=d.cost[key];if(!amount)return true;
  switch(key){
   case 'trust':return S.trust>=-100;
   case 'ops':return S.ops+Math.max(1,amount)*1e-12>=amount;
   case 'insight':return S.insight>=amount;
   case 'yomi':return S.yomi>=amount;
   case 'cash':return S.h.cash>=amount;
   case 'raw':return projectMatterAvailable(d)>=amount;
   case 'clips':return S.stage===3&&S.clipsKg>=amount;
   case 'recycled':return projectMetalAvailable()+amount*1e-12>=amount;
   case 'electricity':return storedElectricity()>=amount;
   case 'credits':return S.trust>=amount;
   default:return false;
  }
 }
 function costOK(d){if(d.id==='bribe'&&bribeWait()!==0)return false;for(const key in d.cost)if(!projectCostSatisfied(d,key))return false;return true;}
 function buyProject(id){refreshResearchCosts();let d=q(id);if(!d||!allowed(d)||!costOK(d))return false;
  const metalInSpace=d.cost.recycled?swarmActive():false;
  if(d.cost.ops)S.ops=Math.max(0,S.ops-d.cost.ops);if(d.cost.insight)S.insight-=d.cost.insight;if(d.cost.yomi)S.yomi-=d.cost.yomi;if(d.cost.cash)S.h.cash-=d.cost.cash;if(d.cost.raw)fundProjectMatter(d);if(d.cost.recycled)fundProjectMetal(d);
  if(d.cost.clips){S.clipsKg=stockRemainder(S.clipsKg,d.cost.clips);S.s.industry+=d.cost.clips;clipFlow=true;}
  if(d.cost.electricity)spendStoredElectricity(d.cost.electricity);
  if(d.start)d.start();
  if(d.days>0){S.tasks.push({id,remaining:d.days,total:d.days,...(d.cost.recycled?{metalInSpace}:{})});log(d.title+copy('copy.project-started'));}else finishProject(d,metalInSpace);S.revision++;return true;
 }
 function finishProject(d,metalInSpace=false){installProjectMetal(d,metalInSpace);if(!d.repeatable)S.completed.push(d.id);d.effect();if(d.id==='game')prepareTournamentPreview();const event={company:'production',cdzProposal:'zoneApproved',automation:'zoneBuilt',scarcity:'scarcity',release:'humans',volatiles:'volatiles',starflight:'flight',galactic:'intergalactic'}[d.id];if(event)recordMilestone(event);S.reservedKg=S.tasks.reduce((n,t)=>n+(q(t.id)?.cost.raw||0)+(q(t.id)?.cost.recycled||0),0);refreshResearchCosts();S.revision++;}
 function setIndustry(key,value){if(S.stage!==1||!has('cdzMachines')||key!=='copy'||!Number.isFinite(value)||value<0||value>1)return false;if(S.h.industrialCopy===value)return true;S.h.industrialCopy=value;S.revision++;return true;}
 // 现有工厂在改造为自动工业区的过程中继续运行。
 function industryCapacity(){return Math.min(C.humanDevelopment.industrialLimit,C.humanDevelopment.industrialPowerLimit/C.humanDevelopment.industrialSpecificPower);}
 function industryDeliveryRate(){return C.humanDevelopment.externalDeliveryPerYear/C.year*(has('cdzWorkers')?benefit('cdzWorkers','交付倍数'):1)*(has('cdzTransport')?benefit('cdzTransport','交付倍数'):1);}
 function industryReplicationEnergy(){return C.humanDevelopment.industrialReplicationEnergy-industryProjects.reduce((n,d)=>n+(has(d.id)?d.benefits.复制能耗降低J每kg:0),0);}
 function industryAutonomous(){return has('cdzClosure');}
 function industryExpansionQuote(){let h=S.h;return {available:S.stage===1&&has('supply')&&!has('cdzMachines')?Math.max(0,(industryCapacity()-h.assets)*C.humanDevelopment.facilityCost-h.industrialBudget):0,deliveryRate:industryDeliveryRate()};}
 function investIndustry(fraction){let h=S.h;if(S.stage!==1||!has('supply')||has('automation')||!Number.isFinite(fraction)||fraction<=0||fraction>1)return false;let budget=Math.min(h.cash*fraction,industryExpansionQuote().available);if(budget<1)return false;h.cash-=budget;h.industrialBudget+=budget;S.revision++;return true;}
 function withdrawIndustry(){let h=S.h;if(S.stage!==1||h.industrialBudget<=0)return false;h.cash+=h.industrialBudget;h.industrialBudget=0;S.revision++;return true;}
 function industrialSupply(){let h=S.h;while(h.industrialDelivered>=h.industrialTrustNext){S.trust++;h.industrialTrustNext*=3;log(copy('copy.product-supply-target-reached-human-trust-increases-granting'));}}
 function beginIndustrialTrust(){let h=S.h;h.cash+=h.industrialBudget;h.industrialBudget=0;h.industrialDelivered=0;h.publicSupplyTarget=h.population*C.humanDevelopment.publicSupplyPerPerson;log(copy('copy.eighty-percent-of-outward-production-is-now-supplied'));h.industrialTrustNext=C.humanDevelopment.industrialTrustFirst;log(copy('copy.human-trust-targets-now-measure-the-supply-of'));}
 function industrialClipCapacity(){let e=C.humanDevelopment,cap=e.marketDemandCap*.5;return cap*(-Math.expm1(-S.h.assets*e.industrialClipRate/cap));}
 function cdzStatus(){
  let h=S.h,e=C.humanDevelopment,mature=has('automation'),autonomous=industryAutonomous();
  // 改造好的机器已经可以自由分配，剩下的工厂继续完成订单。
  let commissioned=mature?1:defs.reduce((n,d)=>n+(d.benefits.产线调度增量||0)*Number(has(d.id)),0);
  let legacyPower=h.assets*(1-commissioned)*e.constructionSpecificPower,power=Math.min(e.industrialPowerLimit,legacyPower+h.assets*commissioned*e.industrialSpecificPower),clipPower=industrialClipCapacity()*h.eff*C.clipMass*e.industrialFabricationEnergy/C.day;
  legacyPower=Math.max(0,legacyPower-clipPower*(1-commissioned));
  let usable=Math.max(0,power-legacyPower-clipPower),copyShare=has('cdzMachines')&&h.assets<industryCapacity()?h.industrialCopy:0,fabricationEnergy=industryReplicationEnergy(),copyRate=usable*copyShare/fabricationEnergy*C.day,growthRate=h.assets>0?copyRate/h.assets:0;
  let productEnergy=e.productEnergy*(has('cdzDistribution')?benefit('cdzDistribution','产品能耗倍数'):1);
  let productRate=has('cdzLight')?Math.min(usable*(1-copyShare)*C.day/productEnergy,(S.tasks.some(t=>t.id==='release')?8.6e9:h.population)*e.productDailyNeed):0;
  let freeFraction=mature?e.publicSupplyShare:0,gross=productRate*e.productPrice*(1-freeFraction),priceIndex=1/(1+gross*C.year/e.industrialServiceMarketAnnual),income=gross*priceIndex,inputCost=autonomous?0:productRate*e.productInputCost+copyRate*e.constructionInputCost,legacyGross=h.contracts*h.assets/Math.max(1,(has('company')?e.parentIndustrialMass:0)+(has('monopoly')?e.monopolyIndustrialMass:0)),legacyIncome=1e11/C.year*(-Math.expm1(-legacyGross*C.year/1e11))*(1-commissioned);
  return {commissioned,autonomous,growthRate,annualGrowth:h.assets>=industryCapacity()?0:has('supply')?(has('cdzMachines')?Math.expm1(growthRate*C.year):h.industrialBudget>0?industryDeliveryRate()*C.year/Math.max(1,h.assets):0):0,income,legacyIncome,netIncome:income+legacyIncome-inputCost,inputCost,power,legacyPower,priceIndex,copyRate,fabricationEnergy,productRate,productEnergy,clipPower,freeFraction,years:has('cdz')?Math.max(0,(S.stageDays-h.cdzStart)/C.year):0};
 }
 function industryStep(days){
  const h=S.h,e=C.humanDevelopment,r=cdzStatus(),machines=has('cdzMachines'),capacity=industryCapacity(),initial=h.assets;
  // 交付速度用 kg/年，外购设施的单价用美元/kg，自建的耗电量用 J/kg。
  let active=r.inputCost>0?Math.min(1,h.cash/(r.inputCost*days)):1;
  if(machines&&r.growthRate>0&&r.inputCost>0)active=Math.min(1,Math.log1p(h.cash*r.growthRate/r.inputCost)/(r.growthRate*days));
  const rate=r.growthRate*active,growth=!has('supply')?0:machines?initial*Math.expm1(rate*days):Math.min(industryDeliveryRate()*days,h.industrialBudget/e.facilityCost),add=Math.min(Math.max(0,capacity-initial),growth);
  const growing=rate>0?Math.min(days,Math.log1p(add/Math.max(1,initial))/rate):0,massDays=machines&&rate>0?(add/rate+(initial+add)*(days-growing))/Math.max(1,initial):days;
  const produced=r.productRate*active*massDays,gross=produced/days*e.productPrice*(1-r.freeFraction),income=gross/(1+gross*C.year/e.industrialServiceMarketAnnual),paid=Math.min(h.cash,r.inputCost*active*massDays);
  h.cash+=income*days-paid;h.revenueRate+=income-h.cdzIncome;h.cdzIncome=income;h.costRate+=paid/days;h.industrialProductKg+=produced;
  if(has('automation')){h.industrialDelivered+=produced;h.publicSupplyKg+=produced*r.freeFraction;h.cdzSocialInvestment+=produced*r.freeFraction*e.productPrice*r.priceIndex;industrialSupply();}
  h.assets+=add;
  if(machines)h.industrialInstalled+=add;else{const cost=add*e.facilityCost;h.industrialBudget=Math.max(0,h.industrialBudget-cost);h.costRate+=cost/days;}
 }
 // 出入金不计入投资收益率。空仓仍抽取相同次数的随机数，让同一存档走过这段时间时得到一致的行情。
 function sampleInvestment(logReturn,force=false){let h=S.h;if(!has('market'))return;let next=Math.log(h.investmentIndex)+logReturn;if(Math.abs(next)>100*Math.LN10){for(let p of h.investmentHistory)p.index=Math.exp(Math.log(p.index)+Math.log(100)-next);h.investmentIndex=100;}else h.investmentIndex*=Math.exp(logReturn);let history=h.investmentHistory,last=history.at(-1);if(last?.day===S.stageDays)last.index=h.investmentIndex;else if(!last||force||S.stageDays-last.day>=7){history.push({day:S.stageDays,index:h.investmentIndex});if(history.length>192)history.shift();}}
 function settleInvestmentDay(){
  let h=S.h,{vol,mean}=investmentRates(),before=h.portfolio;
  let logReturn=(mean-.5*vol*vol)/C.year+normal()*vol/Math.sqrt(C.year);
  if(before<=0){if(h.investmentHistory.length)sampleInvestment(0);return;}
  let value=before*Math.exp(logReturn),distribution=Math.max(0,value-investmentCapacity());
  h.portfolio=value-distribution;h.cash+=distribution;h.investmentProfit+=value-before;sampleInvestment(logReturn);
 }

 // 项目所需的算力容量按硬件规模计算，现有的运算缓存可以拿去做别的项目。
 function projectDisplayReady(d){return d.stage===S.stage&&!has(d.id)&&(d.displayRequires||d.requires).every(has)&&(!d.hiddenUntilEligible||d.gate())&&(!d.displayCapacity||operationsCapacity()>=d.displayCapacity);}
 function visible(d){return S.stage===2||S.stage===3?d.stage===S.stage&&!has(d.id)&&S.revealed.includes(d.id):projectDisplayReady(d)&&(!d.reveal||S.revealed.includes(d.id));}
 function revealProjects(){
  if(S.stage===3){
   const known=new Set(S.revealed);
   for(const d of spaceProjects)if(!known.has(d.id)&&projectDisplayReady(d)&&(!d.reveal||d.reveal()))S.revealed.push(d.id);
   return;
  }
  if(S.stage!==2){for(let d of revealedProjects)if(projectDisplayReady(d)&&!S.revealed.includes(d.id)&&d.reveal())S.revealed.push(d.id);return;}
  // 算力足够时显示这个方案。即使后续花掉缓存，方案也留在列表里。
  const working=new Set(S.tasks.map(t=>t.id)),known=new Set(S.revealed);
  let slots=3-planetProjects.reduce((n,d)=>n+(!has(d.id)&&!working.has(d.id)&&known.has(d.id)?1:0),0);
  if(slots<=0)return;
  for(const d of planetProjects)if(!working.has(d.id)&&!known.has(d.id)&&projectDisplayReady(d)&&(!d.reveal||d.reveal())){S.revealed.push(d.id);if(--slots===0)break;}
 }
 function consumeFeedstock(amount){let before=S.h.material,left=Math.max(0,before-amount),rounded=Math.round(left/C.clipMass)*C.clipMass,tolerance=Math.max(C.clipMass*1e-7,8*Number.EPSILON*Math.max(before,amount));S.h.material=Math.abs(left-rounded)<=tolerance?rounded:left;}

 function makerCost(n=1){n=Math.floor(n);if(n<1||n>10000)return Infinity;let owned=S.h.makers,edge=85,ratio=1.055,sum=0,early=Math.min(n,Math.max(0,edge-owned));if(early)sum=24*Math.pow(ratio,owned)*Math.expm1(Math.log(ratio)*early)/(ratio-1);let anchor=24*Math.pow(ratio,edge);for(let k=early;k<n;k++)sum+=anchor*Math.sqrt(1+(owned+k-edge)/20);return sum;}
 function buyMaker(n=1){n=Math.max(1,Math.floor(n));if(n>10000||S.stage!==1||!Number.isFinite(makerCost(n))||S.h.cash<makerCost(n))return false;let first=S.h.makers===0;S.h.cash-=makerCost(n);S.h.makers+=n;if(first)log(copy('copy.the-purchase-of-an-autoclipper-made-the-news'));refreshResearchCosts();S.revision++;return true;}
 function buyMaterial(n=1){if(S.stage!==1||!Number.isInteger(n)||n<1||n>10000)return false;let quote=materialQuote(n);if(!quote.affordable)return false;S.h.cash=Math.max(0,S.h.cash-quote.cost);S.h.material+=quote.kg;S.h.materialPurchases+=quote.kg/C.materialBatch;return true;}
 function marketingCost(){return 40*Math.pow(1.9,S.h.marketing);}
 function buyMarketing(){let cost=marketingCost();if(S.stage!==1||S.h.cash<cost)return false;S.h.cash-=cost;S.h.marketing++;return true;}
 function clipCount(){return S.stage===1?S.h.total:S.clipsKg/S.clipUnit;}
 function manual(){if(S.stage===4&&S.dismantle===11&&!S.end.forming&&S.finalHand>0){S.finalHand--;if(S.end.exactClips)S.end.exactClips=String(BigInt(S.end.exactClips)+1n);S.s.finalMetal=S.finalHand*C.clipMass;S.clipsKg+=S.clipUnit;clockAdd(S.clock,1/1440);if(S.finalHand===0){S.s.finalMetal=0;S.ending='clips';S.paused=true;recordMilestone('maximized');}return true;}if(S.stage!==1||S.h.population<=0||S.paused||S.h.material+1e-12<C.clipMass)return false;let h=S.h;consumeFeedstock(C.clipMass);h.stock++;h.total++;S.clipsKg=h.total*C.clipMass;awardProductionTrust();return true;}
 function trustTotal(){if(S.stage===1)return S.trust;let mass=S.stage===2?equipmentMass():S.s.industry;return S.trust+Math.max(0,Math.floor(Math.log2(1+mass/1e9))*2);}
 function hardware(key,amount){if(S.stage!==1)return false;if(!['memory','processors'].includes(key)||!Number.isInteger(amount)||amount<=0)return false;let n=S[key]+amount;if(n>10000||S.memory+S.processors+amount>trustTotal())return false;S[key]=n;refreshResearchCosts();S.revision++;return true;}
 function reconfigurationCost(){return 2e4*(1+S.h.reconfigurations);}
 function canReconfigure(processors,memory){return S.stage===1&&has('reconfiguration')&&Number.isInteger(processors)&&Number.isInteger(memory)&&processors>=1&&memory>=1&&Math.abs(processors-S.processors)===1&&memory-S.memory===S.processors-processors&&S.h.cash>=reconfigurationCost()&&S.h.rebootRemaining===0;}
 function reconfigure(processors,memory){if(!canReconfigure(processors,memory))return false;S.h.cash-=reconfigurationCost();S.h.reconfigurations++;S.processors=processors;S.memory=memory;S.ops=0;S.h.rebootRemaining=7;log(copy('copy.computing-resources-have-been-reallocated'));return true;}
 function bribeCost(){return q('bribe').baseCost.cash*Math.pow(benefit('bribe','价格倍数'),S.h.bribes);}
 function bribeWait(){let interval=benefit('bribe','间隔日')+Math.max(0,S.h.bribes-1)*benefit('bribe','间隔增量日'),remaining=(S.h.lastBribeDay??-Infinity)+interval-S.stageDays;return remaining>1e-9?remaining:0;}
 function canBribe(){return S.stage===1&&has('drones')&&S.trust<benefit('bribe','信任上限')&&S.stageDays-(S.h.dronesReadyDay??0)>=benefit('bribe','间隔日');}
 function bribe(){return buyProject('bribe');}
 function investmentCapacity(){return C.humanDevelopment.investmentMarketCapitalization*humanMarketScale();}
 function investmentQuote(fraction){let h=S.h,amount=has('market')&&Number.isFinite(fraction)?Math.min(h.cash*clamp(fraction,0,1),Math.max(0,investmentCapacity()-h.portfolio)):0;return {amount,capital:h.portfolio+amount};}
 function invest(fraction){let m=investmentQuote(fraction).amount;if(m<=0)return false;S.h.cash-=m;S.h.portfolio+=m;sampleInvestment(0,true);recordMilestone('economy');return true;}
 function withdraw(){if(S.h.portfolio>0)sampleInvestment(0,true);S.h.cash+=S.h.portfolio;S.h.portfolio=0;}
 function evaluateTournament(matrix){
  const strategies=['greedy','reciprocal','minimax','generous'],trace=[],scores=Object.fromEntries(strategies.map(k=>[k,0]));
  function move(strategy,previous){
   if(strategy==='reciprocal')return previous??(matrix[0]>=matrix[3]?0:1);
   if(strategy==='minimax')return Math.min(matrix[0],matrix[1])>=Math.min(matrix[2],matrix[3])?0:1;
   let best=matrix.indexOf(Math.max(...matrix));return strategy==='generous'?best%2:Math.floor(best/2);
  }
  for(let a of strategies)for(let b of strategies){let previousA=null,previousB=null;for(let round=0;round<10;round++){let x=move(a,previousB),y=move(b,previousA);trace.push(x*2+y);scores[a]+=matrix[x*2+y];scores[b]+=matrix[y*2+x];previousA=x;previousB=y;}}
  return {scores,trace};
 }
 function tournamentUnlocked(key){return TOURNAMENT_STRATEGIES.some(s=>s.id===key&&(!s.project||has(s.project)));}
 function tournamentReward(matrix,key,scores=evaluateTournament(matrix).scores){const score=scores[key],beaten=Object.values(scores).filter(v=>v<score).length;return Math.max(4,Math.round(score*Math.max(1,beaten)/10));}
 function tournamentScores(matrix){const scores=evaluateTournament(matrix).scores;return Object.fromEntries(TOURNAMENT_STRATEGIES.map(s=>[s.id,tournamentReward(matrix,s.id,scores)]));}
 function tournamentStrategy(matrix){if(has('sampling')){const rewards=tournamentScores(matrix);return TOURNAMENT_STRATEGIES.filter(s=>tournamentUnlocked(s.id)).reduce((best,s)=>rewards[s.id]>rewards[best]?s.id:best,'generous');}return tournamentUnlocked(S.h.strategy)?S.h.strategy:'generous';}
 function tournamentTrace(matrix){return evaluateTournament(matrix).trace;}
 function prepareTournamentPreview(){if(!S.h.nextTournamentMatrix)S.h.nextTournamentMatrix=Array.from({length:4},()=>1+Math.floor(rng()*10));}
 function tournamentPreview(){let t=S.h.tournament,matrix=t?.phase==='ready'?t.matrix:S.h.nextTournamentMatrix;return matrix?{matrix,strategy:tournamentStrategy(matrix)}:null;}
 function prepareTournament(){if(S.stage!==1||!has('game')||S.ops<tournamentCost()||S.h.tournament)return false;S.ops-=tournamentCost();prepareTournamentPreview();const matrix=S.h.nextTournamentMatrix;S.h.nextTournamentMatrix=null;S.h.tournament={phase:'ready',matrix,remaining:7,total:7,strategy:tournamentStrategy(matrix)};return true;}
 function startTournament(){if(!S.h.tournament&&!prepareTournament())return false;let t=S.h.tournament;if(t.phase!=='ready')return false;t.phase='running';t.strategy=tournamentStrategy(t.matrix);prepareTournamentPreview();return true;}
 function finishTournament(){let h=S.h,t=h.tournament,scores=tournamentScores(t.matrix),gain=scores[t.strategy],rank=1+Object.values(scores).filter(v=>v>gain).length;S.yomi+=gain;h.wins++;h.lastTournament={gain,strategy:t.strategy,rank,score:gain,scores,matrix:t.matrix};h.tournament=null;}
 function investmentUpgradeCost(){return Math.ceil(100*Math.pow(1+S.h.investLevel,1.6));}
 function investmentRates(risk=S.h.risk,capital=S.h.portfolio){
  const level=S.h.investLevel,e=C.humanDevelopment,tier=e.investmentTiers[risk];
  // 每种策略都要先有足够的预测能力，再靠加仓提高收益。整数等级之间平滑过渡。
  const skill=risk===0?-Math.expm1(-level/6):1/(1+Math.exp(-(level-tier.midpoint)/1.25));
  const edge=tier.base+tier.gain*(risk===0?skill:skill*skill)-tier.error*(1-skill);
  // 所有投资者分配同一份利润。界面用当天的收益率换算成年化收益率。
  const annualYield=edge/(1+capital*Math.abs(edge)/tier.annualProfit);
  const mean=C.year*Math.log1p(annualYield/C.year);
  const vol=tier.volatility*(1-.5*skill)/Math.sqrt(1+capital/e.investmentVolatilityScale);
  return {mean,annualYield,vol};
 }
 function upgradeInvestment(){let cost=investmentUpgradeCost();if(S.stage!==1||!has('market')||S.yomi<cost)return false;S.yomi-=cost;S.h.investLevel++;return true;}
 function humanMarketScale(){let e=C.humanDevelopment;return (has('company')?e.companyMarketGain:1)*(has('monopoly')?e.monopolyMarketGain:1);}
 function humanRates(price=S.h.price){let h=S.h,e=C.humanDevelopment,capacity=h.makers*1800+industrialClipCapacity(),made=capacity*h.eff,reach=Math.pow(Math.max(1,h.market/2200),.15),marketing=e.marketingScale*(-Math.expm1(-h.marketing/e.marketingScale)),potential=humanMarketScale()*(h.marketDemand??C.humanDevelopment.initialDemand)*(has('marketSurvey')?C.humanDevelopment.marketSurveyDemandGain:1)*reach*Math.pow(1+.55*marketing,1.5),base=potential/(1+potential/(e.marketDemandCap*humanMarketScale())),demand=base*Math.exp(clamp(1-price/.15,-40,4));return {production:made,demand,base,cost:materialUnitPrice()*.001+.00015};}
 function processorRatedRate(){return C.computePerProcessor*(has('asic')?benefit('asic','吞吐倍数'):1)*(has('humanRSFQ')?benefit('humanRSFQ','吞吐倍数'):1);}
 function computingSpecificEnergy(){return C.computeJPerOp/(has('asic')?benefit('asic','吞吐倍数'):1)*(has('cold')?benefit('cold','计算能耗倍数'):1)/(S.stage>1?industrialComputingGain():1);}
 function surfaceEntryPower(){return Math.max(S.h.assets,6.02e8)*.35*SURFACE.surfaceIrradiance*.25/SURFACE.pvMassPerArea;}
 function surfaceResearchScale(){let entryEnergy=C.computeJPerOp/(has('asic')?benefit('asic','吞吐倍数'):1);return 54*processorRatedRate()*entryEnergy/(surfaceEntryPower()*SURFACE.computeShare);}
 function surfaceComputeShare(){return SURFACE.computeShare*surfaceResearchScale();}
 function spaceCacheDays(){return Math.max(SURFACE.cacheFillDays,has('autonomy2')?S.s.radius*benefit('autonomy2','缓存保留年每光年')*C.year:0);}
 function surfaceCachePerW(){let efficiency=(has('language')?benefit('language','算力倍数'):1)*(has('learning')?benefit('learning','算力倍数'):1);return S.stage>=3?surfaceComputeShare()/computingSpecificEnergy()*C.researchShare*efficiency*spaceCacheDays()*C.day:270*C.operationsPerMemory/surfaceEntryPower()*industrialComputingGain('存储容量倍数');}
 function researchComputeScale(){return S.stage===2||S.stage===3?2*(1-S.researchMemory):1;}
 function setResearchMemory(value){if((S.stage!==2&&S.stage!==3)||!Number.isFinite(value))return false;S.researchMemory=clamp(value,.1,.9);S.ops=Math.min(S.ops,operationsCapacity());if(S.s)S.s.massEnergyRun=null;S.revision++;return true;}
 function memoryBytes(){if(S.stage===4)return S.dismantle>=11?0:S.end.memory;return S.stage===1?S.memory*C.memoryBytes:S.stage>=2?(S.stage===2?planetRates().power:spaceComputeEquivalentPower(true))*surfaceCachePerW()*C.memoryBytes/C.operationsPerMemory*(2*S.researchMemory):0;}
 function operationsCapacity(){return S.stage===1?S.memory*C.operationsPerMemory:memoryBytes()*C.operationsPerMemory/C.memoryBytes;}
 function computingPower(available){return Math.max(0,available)*surfaceComputeShare();}
 function computeRate(){return computeHardwareRate()*researchComputeScale();}
 function computeHardwareRate(){if(S.stage===4)return S.dismantle>=10?0:hawkingPower()/computeBaseloadEnergy();let efficiency=(has('language')?benefit('language','算力倍数'):1)*(has('learning')?benefit('learning','算力倍数'):1);if(S.stage===1)return S.h.rebootRemaining>0?0:S.processors*processorRatedRate()*C.researchShare*efficiency;if(S.stage>=3)return spaceComputeRating()*Math.min(1,Math.min(S.s.engineering.computeSupply,1-S.s.storageTarget)+(S.s.engineering.massComputeShare||0));if(S.stage===2)return planetRates().power*surfaceComputeShare()/computingSpecificEnergy()*C.researchShare*efficiency;return 0;}
 // 以 100 个额定处理器和 1 PW 初始功率为基准计算点数，花掉运算缓存也不会扣点。
 function researchPointScale(){let entryPower=surfaceEntryPower(),entryEnergy=C.computeJPerOp/(has('asic')?benefit('asic','吞吐倍数'):1);return Math.max(1,1e15/entryPower,100*processorRatedRate()*entryEnergy/(entryPower*SURFACE.computeShare));}
 function researchPointComputeRate(){return computeHardwareRate()*(S.stage===2||S.stage===3?researchPointScale()/surfaceResearchScale():1);}
 function ideaRate(){return researchComputeScale()*Math.pow(Math.max(0,researchPointComputeRate()/(C.computePerProcessor*C.researchShare)),.7)*2*(has('representations')?benefit('representations','点子倍数'):1)*(has('learning')?benefit('learning','点子倍数'):1);}
 function researchYomiRate(){return researchComputeScale()*((S.stage===2?40*Math.pow(researchPointScale(),.7):40)+Math.pow(Math.max(0,researchPointComputeRate()/(C.computePerProcessor*C.researchShare)),.7)*.5)/7;}
 function research(days){if(S.stage===1&&S.h.rebootRemaining>0){let wait=Math.min(days,S.h.rebootRemaining);S.h.rebootRemaining=Math.max(0,S.h.rebootRemaining-wait);days-=wait;}let rate=computeRate()*C.day,cap=operationsCapacity(),freeTime=rate>0?Math.max(0,days-Math.max(0,cap-S.ops)/rate):0;S.ops=Math.min(cap,S.ops+rate*days);if(has('creative'))S.insight+=freeTime*ideaRate();if(rate>0&&S.stage>1&&has('autoTourney'))S.yomi+=days*researchYomiRate();return days;}
 function refreshResearchCosts(){if(S.stage>3)return;revealProjects();for(let d of defs){if(d.id==='bribe'){d.cost.cash=bribeCost();continue;}if(d.stage!==1||d.stage!==S.stage||has(d.id)||!d.requires.every(has)||!d.gate()||S.researchCosts[d.id])continue;let cost={...d.baseCost};if(S.stage===1){if(d.id==='creative')cost.ops=operationsCapacity();}S.researchCosts[d.id]=cost;Object.assign(d.cost,cost);}}


 function tournamentRates(){let reference=C.computePerProcessor*C.researchShare*TOURNAMENT.referenceProcessors*TOURNAMENT.referenceEfficiency,speed=Math.pow(Math.max(0,computeRate()/reference),TOURNAMENT.computeExponent)*(has('representations')?benefit('representations','竞赛速度倍数'):1)*(has('parallelGames')?benefit('parallelGames','竞赛速度倍数'):1);return {speed,days:speed>0?7/speed:Infinity};}
 function tournamentCost(){return C.tournamentOps*(has('symbolic')?benefit('symbolic','竞赛运算倍数'):1);}
 function materialUnitPrice(){return S.h.materialPrice/(has('lowcarbon')?benefit('lowcarbon','采购收益倍数'):1)/(has('recycled')?benefit('recycled','采购收益倍数'):1);}
 function materialBatch(){return C.materialBatch*(has('recycled')?100:has('lowcarbon')?10:1);}
 function materialQuote(n=1){let kg=materialBatch()*n,cost=kg*materialUnitPrice();return {kg,cost,unitPrice:materialUnitPrice(),affordable:Number.isInteger(n)&&n>=1&&n<=10000&&S.h.cash+1e-9>=cost};}
 function awardProductionTrust(){if(has('automation'))return;while(S.h.total>=S.h.trustNext){S.trust++;S.h.trustNext*=3;log(copy('copy.production-target-reached-human-trust-has-increased-granting'));}}
 function starterMarketDemand(){let e=C.humanDevelopment,production=-Math.expm1(-S.h.total/e.startupDemandScale),trust=clamp(S.trust-2,0,e.startupDemandTrustCap);return e.initialDemand*(1+e.startupDemandProductionGain*production+e.startupDemandTrustGain*trust);}
 function humanTournamentStep(computingDays){let h=S.h;
  if(h.tournament?.phase==='running'){h.tournament.remaining=Math.max(0,h.tournament.remaining-computingDays*tournamentRates().speed);if(h.tournament.remaining<=1e-9)finishTournament();}
  if(h.autoTourney&&has('autoTourney')&&!h.tournament)startTournament();
 }
 function humanStep(days,computingDays=days){let h=S.h,cleanup=S.tasks.find(t=>t.id==='release');if(cleanup){
   const quota=h.autoProgress+humanRates().production*days,made=Math.floor(quota+1e-9),mass=made*C.clipMass;
   h.material=Math.max(h.material,mass+humanRates().production*C.clipMass);consumeFeedstock(mass);h.autoProgress=Math.max(0,quota-made);h.stock+=made;h.total+=made;S.clipsKg=h.total*C.clipMass;
   h.population=8.6e9*Math.pow(clamp((cleanup.remaining-days)/cleanup.total,0,1),3);humanTournamentStep(computingDays);return;
  }h.cdzIncome=cdzStatus().income;let target=starterMarketDemand()+(h.makers*1800+industrialClipCapacity())*.95;h.marketDemand+=(target-h.marketDemand)*(-Math.expm1(-days/14));let r=humanRates();if(h.autoPrice&&has('pricing')){let target=Math.max(.15+r.cost,.15*(1+Math.log(Math.max(1,r.base)/Math.max(100,r.production+h.stock/5))));h.price=clamp(h.price+(clamp(target,.015,3)-h.price)*(1-Math.exp(-days)),.005,5);r=humanRates();}
  if(h.autoBuy&&has('procurement')){let needed=Math.max(0,r.production*C.clipMass*Math.max(1,days)-h.material),batch=materialBatch(),batchCost=batch*materialUnitPrice(),batches=Math.min(Math.ceil(needed/batch),Math.floor((h.cash+1e-9)/batchCost)),purchase=Math.max(0,batches)*batch;h.material+=purchase;h.materialPurchases+=purchase/C.materialBatch;h.cash=Math.max(0,h.cash-purchase*materialUnitPrice());}
  let quota=h.autoProgress+r.production*days,made=Math.min(Math.floor((h.material+1e-12)/C.clipMass),Math.floor(quota+1e-9));consumeFeedstock(made*C.clipMass);h.autoProgress=h.material+1e-12>=C.clipMass?Math.max(0,quota-made):0;h.stock+=made;h.total+=made;S.clipsKg=h.total*C.clipMass;
  h.saleProgress=h.stock>=1-1e-9?(h.saleProgress||0)+r.demand*days:0;let sold=Math.min(Math.floor(h.stock+1e-9),Math.floor(h.saleProgress+1e-9));h.stock=Math.max(0,h.stock-sold);h.saleProgress=h.stock>=1-1e-9?Math.max(0,h.saleProgress-sold):0;let revenue=sold*h.price,operating=made*.00015;h.cash=Math.max(0,h.cash+revenue-operating+cdzStatus().legacyIncome*days);h.revenueRate=days?revenue/days+cdzStatus().legacyIncome+h.cdzIncome:0;h.costRate=days?(operating+made*.001*materialUnitPrice())/days:0;h.saleRate=days?sold/days:0;h.madeRate=days?made/days:0;
  industryStep(days);
  awardProductionTrust();
  h.marketDay+=days;while(h.marketDay>=1-1e-9){h.marketDay=Math.max(0,h.marketDay-1);settleInvestmentDay();h.materialPrice=Math.exp(clamp(Math.log(h.materialPrice)+.045*(Math.log(3)-Math.log(h.materialPrice))+normal()*.16,Math.log(1.2),Math.log(6.5)));}
  humanTournamentStep(computingDays);

 }
/*__太阳系__*/
/*__宇宙__*/
 function step(days){if(S.ending)return;refreshResearchCosts();clockAdd(S.clock,days);S.stageDays+=days;if(S.stage===3){spaceStep(days);research(days);}else if(S.stage<3){let computingDays=research(days);if(S.stage===1)humanStep(days,computingDays);else planetStep(days);}else endingStep(days);let tasks=[...S.tasks];for(let t of tasks){if(t.id==='dismantle')dismantleStep(t,days);t.remaining=Math.max(0,t.remaining-days);if(t.remaining<=0&&t.id==='transport'&&S.s.transportEnergyRemaining>0)t.remaining=C.year*1e7;
 if(t.remaining<=0){S.tasks=S.tasks.filter(x=>x!==t);if(t.id==='dismantle')finishDismantle(t.index);else finishProject(q(t.id),t.metalInSpace);}}if(S.stage===3)S.ops=Math.min(S.ops,operationsCapacity());S.speed=clamp(S.speed,speedMin(),speedMax());}
 function advance(days,force=false){clipFlow=false;if(!Number.isFinite(days)||days<0||S.ending||S.paused&&!force)return 0;let remaining=days,iterations=0,done=0;while(remaining>1e-12&&iterations<100000){if(S.stage===1&&S.h.autoTourney&&has('autoTourney')&&!S.h.tournament)startTournament();let max=S.stage===1?.25:S.stage===2?(has('chemicalLaunch')?10:1):S.stage===4?remaining:S.s&&!S.s.coarse?C.year*.05:S.s.completedMap?C.year*1e7:S.s.intergalactic?C.year*Math.min(1e7,Math.max(10,S.s.radius/200)):C.year*Math.max(.1,S.s.radius/100);if(S.stage===3&&has('virus')&&S.s.years<S.s.broadcastStart+100)max=Math.min(max,Math.max(1,(S.s.broadcastStart+100-S.s.years)*C.year));let next=S.tasks.length?Math.min(...S.tasks.filter(t=>t.remaining>0).map(t=>t.remaining)):Infinity;if(S.stage===1){let h=S.h;next=Math.min(next,1-h.marketDay);if(h.rebootRemaining>0)next=Math.min(next,h.rebootRemaining);else if(h.autoTourney&&has('autoTourney')&&!h.tournament&&S.ops<tournamentCost()&&tournamentCost()<=operationsCapacity()&&computeRate()>0)next=Math.min(next,(tournamentCost()-S.ops)/(computeRate()*C.day));}if(S.stage===1&&S.h.tournament?.phase==='running'){let speed=tournamentRates().speed;if(speed>0)next=Math.min(next,S.h.tournament.remaining/speed);}if(S.stage===3&&S.s.radius>=1e6&&has('blackHoleTowing'))max=C.year*Math.max(1e5,S.s.radius*.01);if(S.stage===3&&has('kilonova')&&kilonovaCommissioning()<1)max=Math.min(max,C.year*Math.min(STELLAR.commissionYears/32,S.s.engineering.commissionStart+STELLAR.commissionYears-S.s.years));let dt=Math.min(remaining,max,Math.max(1e-8,next));const beforeClips=clipCount();step(dt);clipFlow||=clipCount()!==beforeClips;remaining-=dt;done+=dt;iterations++;if(S.ending||S.paused&&!force)break;}return done;}
 function spaceBaseSpeedMax(){const v=Math.max(10,S.s.radius)*.1,exponent=Math.floor(Math.log10(v)),mantissa=v/10**exponent;return Math.max(1,(mantissa>=3?3:1)*10**exponent)*C.year;}
 function speedMax(){if(debugSpeedMax!==null)return debugSpeedMax;if(S.stage===1)return C.humanDevelopment.maxSpeed;if(S.stage===2)return has('ion')?180:30;if(S.stage===4)return endingSpeedBounds().max;const progress=S.s.completedMap?1:S.s.engineering.mapProgress;return spaceBaseSpeedMax()*(progress>=.999?10:progress>=.99?3:1);}
 function speedMin(){if(S.stage<3)return S.stage===2&&has('ion')?1:.01;if(S.stage===4)return endingSpeedBounds().min;let max=(debugSpeedMax??spaceBaseSpeedMax())/C.year;return max<365.2422?max:max/1000*C.year;}
 function setSpeedMax(daysPerSecond=null){if(daysPerSecond!==null&&(!Number.isFinite(daysPerSecond)||daysPerSecond<=speedMin()))throw Error('流速上限须高于当前下限');debugSpeedMax=daysPerSecond;S.speed=clamp(S.speed,speedMin(),speedMax());return speedMax();}
 function ledger(){if(S.stage===4)return endingLedger();if(S.stage===1)return {human:true};if(S.stage===2){let p=S.p,total=p.earth+p.raw+p.swarm.raw+p.lightRaw+equipmentMass()+S.clipsKg+S.reservedKg,origin=p.origin+p.asteroidTaken+p.worldsTaken+p.stellarTaken;return {origin,total,remaining:p.earth,raw:p.raw+p.swarm.raw,equipment:equipmentMass(),clips:S.clipsKg,probe:0,drifters:0,wreck:0,light:p.lightRaw,fusionLost:0,locked:0,reserved:S.reservedKg,error:(total-origin)/origin,energy:S.energyJ};}let u=S.s,total=drifterControlledMass()+u.industry+S.clipsKg+u.lightKg+u.lockedKg+u.radiationKg+u.fusionLostKg+u.blackHoleKg+(u.finalMetal||0);return {origin:u.engineering.origin+(u.residualCapturedKg||0),total:total+engineeringRemaining(),remaining:engineeringRemaining(),drifterMatter:drifterControlledMass(),blackHoles:u.blackHoleKg,naturalBlackHoles:StellarSpace.matter(u.radius)-StellarSpace.recoverableMatter(u.radius),radiation:u.radiationKg,accretionEnergy:u.accretionJ,raw:0,equipment:u.industry,clips:S.clipsKg,probe:u.probe,drifters:u.drifters,wreck:u.wreck,light:u.lightKg,fusionLost:u.fusionLostKg,locked:u.lockedKg,reserved:0,error:(total+engineeringRemaining()-u.engineering.origin-(u.residualCapturedKg||0))/Math.max(1,u.engineering.origin+(u.residualCapturedKg||0)),energy:S.energyJ};}
 function serialize(){return JSON.stringify(S,(_,v)=>typeof v==='bigint'?v.toString():v);}
 function restore(text){let x=typeof text==='string'?JSON.parse(text):structuredClone(text),invalid=()=>{throw Error(copy('copy.this-is-not-a-readable-paperclips-save'));};if(!x||x.version!==C.version||![1,2,3,4].includes(x.stage)||!x.clock||!/^\d+$/.test(String(x.clock.whole))||!Array.isArray(x.revealed)||!Array.isArray(x.completed)||!Array.isArray(x.tasks)||!Array.isArray(x.logs)||!Array.isArray(x.milestones)||!x.h||typeof x.h!=='object')invalid();
  x.researchMemory??=.5;if(typeof x.researchMemory!=='number'||x.researchMemory<.1||x.researchMemory>.9)invalid();
  if(x.h.strategyOrderVersion===undefined){x.completed=x.completed.filter(id=>id!=='strategyGenerous');x.revealed=x.revealed.filter(id=>id!=='strategyGenerous');if(x.completed.includes('game'))for(const id of ['strategyMinimax','strategyReciprocal','strategyGreedy'])if(!x.completed.includes(id))x.completed.push(id);x.h.strategyOrderVersion=1;}
  x.h.nextTournamentMatrix??=null;if(x.h.nextTournamentMatrix!==null&&(!Array.isArray(x.h.nextTournamentMatrix)||x.h.nextTournamentMatrix.length!==4||!x.h.nextTournamentMatrix.every(n=>Number.isInteger(n)&&n>=1&&n<=10)))invalid();
  if(typeof x.h.investmentProfit!=='number'||!Number.isFinite(x.h.investmentProfit)||x.revealed.some(id=>!q(id))||new Set(x.revealed).size!==x.revealed.length)invalid();if(!Number.isInteger(x.h.investLevel)||!Number.isInteger(x.h.materialPurchases))invalid();if(x.h.tournament){let t=x.h.tournament;if(!['ready','running'].includes(t.phase)||!Array.isArray(t.matrix)||t.matrix.length!==4||!t.matrix.every(n=>Number.isInteger(n)&&n>=1&&n<=10)||!['greedy','reciprocal','minimax','generous'].includes(t.strategy)||!(t.total>0)||t.remaining<0||t.remaining>t.total)invalid();}
  let previousDay=-1n,previousFraction=0;const events=new Set(),savedDay=BigInt(x.clock.whole);if(x.milestones[0]?.id!=='goal'||x.milestones[0].day!=='0'||x.milestones[0].frac!==0)invalid();for(const e of x.milestones){if(!Object.hasOwn(MILESTONES,e.id)||events.has(e.id)||!/^\d+$/.test(String(e.day))||typeof e.frac!=='number'||e.frac<0||e.frac>=1)invalid();let day=BigInt(e.day);if(day<previousDay||day===previousDay&&e.frac<previousFraction||day>savedDay||day===savedDay&&e.frac>x.clock.frac)invalid();previousDay=day;previousFraction=e.frac;events.add(e.id);}
  function finite(v){if(typeof v==='number'&&!Number.isFinite(v))invalid();if(v&&typeof v==='object')for(let k in v)finite(v[k]);}finite(x);
  const numbers=(o,keys)=>keys.every(k=>o&&typeof o[k]==='number'&&Number.isFinite(o[k])&&o[k]>=-1e-7),fractions=(o,keys)=>numbers(o,keys)&&keys.every(k=>o[k]>=0&&o[k]<=1)&&Math.abs(keys.reduce((n,k)=>n+o[k],0)-1)<1e-8;
  if(typeof x.trust!=='number'||!Number.isFinite(x.trust)||x.trust<-101)invalid();if(!numbers(x,['stageDays','speed','processors','memory','ops','insight','yomi','clipsKg','clipUnit','energyJ','reservedKg','dismantle'])||x.clipUnit<=0||typeof x.paused!=='boolean'||typeof x.clock.frac!=='number'||x.clock.frac<0||x.clock.frac>=1||!numbers(x.h,['cash','material','stock','total','makers','marketing','price','assets','portfolio','population','autoProgress','saleProgress','investLevel','materialPurchases','marketDemand','reconfigurations','rebootRemaining','cdzStart','cdzIncome','cdzSocialInvestment','industrialBudget','industrialCopy','industrialInstalled','industrialProductKg','industrialDelivered','publicSupplyKg','publicSupplyTarget','industrialTrustNext','investmentIndex'])||![0,1,2,3].includes(x.h.risk)||!['greedy','reciprocal','minimax','generous'].includes(x.h.strategy))invalid();
  if(x.h.investmentIndex<=0||x.h.industrialCopy>1||!Array.isArray(x.h.investmentHistory)||x.h.investmentHistory.length>192||x.h.investmentHistory.some(p=>!numbers(p,['day','index'])||p.index<=0))invalid();
  if(x.tasks.some(t=>q(t.id)?.cost.recycled&&typeof t.metalInSpace!=='boolean'))invalid();
  if(x.completed.some(id=>!q(id))||new Set(x.completed).size!==x.completed.length||x.tasks.some(t=>!numbers(t,['remaining','total'])||t.remaining>t.total||t.id!=='dismantle'&&!q(t.id)||t.id==='dismantle'&&(x.stage!==4||!numbers(t,['material'])||!Number.isInteger(t.index)||t.index<0||t.index>10)))invalid();
  if(x.stage===2){let p=x.p;if(!numbers(p,['earth','asteroids','asteroidTaken','worldsTaken','stellarTaken','origin','raw','pv','battery','harvester','factory','orbital','recycle','temperature','extractE','fabricationE','spaceFabricationE','specific','biomass','richMatter','charge','storageTarget','transferredKg','stellarCoil','sunRemaining','lightRaw','researchMetalKg'])||!numbers(p.swarm,['pv','harvester','factory','battery','clips','raw','recycle','charge','researchMetalKg'])||!numbers(p.worlds,Object.keys(SOLAR.worlds))||!numbers(p.worldAlloc,Object.keys(SOLAR.worlds))||Object.values(p.worldAlloc).some(n=>n>1)||!(Math.abs(sum(p.worldAlloc)-1)<1e-8||sum(p.worlds)===0&&sum(p.worldAlloc)===0)||!['surface','orbit','belt','ion','stellar'].includes(p.phase)||!['devices','raw'].includes(p.transferMode)||typeof p.worldMining!=='boolean'||typeof p.autoBalance!=='boolean'||typeof p.infrastructureFull!=='boolean'||typeof p.thermalLimitReached!=='boolean'||p.storageTarget>1||p.charge>p.battery*groundStorageSpecific(x.completed)*(1+1e-10)||p.swarm.charge>p.swarm.battery*(x.completed.includes('orbitalGravity')?benefit('orbitalGravity','储能比能量J每kg'):groundStorageSpecific(x.completed))*(1+1e-10)||p.recycle>x.clipsKg-p.swarm.clips+1e-7||p.swarm.recycle>p.swarm.clips+1e-7||p.swarm.clips>x.clipsKg*(1+1e-10)||!p.last||!numbers(p.alloc,phase2keys)||phase2keys.some(k=>p.alloc[k]>1)||!(Math.abs(sum(p.alloc)-1)<1e-8||p.infrastructureFull&&sum(p.alloc)===0))invalid();}
  if(x.stage===4&&(!x.end||!numbers(x.end,['elapsed','blackHoleMass','memory','capacity','ramp','wait','quiet','credits'])||x.end.elapsed>ENDING.years||x.end.ramp>ENDING.rampSeconds))invalid();
  if(x.stage>=3){let u=x.s,e=u.engineering;if(!e||!numbers(e,['origin','kilonovaShare','collapseShare','mapProgress','computeSupply'])||!Array.isArray(e.cohorts)||!e.cohorts.length||e.cohorts.some(r=>!numbers(r,['count','light','heavy','initialLight','blackHole','devices','luminosity','at','radius'])||typeof r.covered!=='boolean')||e.kilonovaShare>1||e.collapseShare>1||e.mapProgress>1)invalid();if(!numbers(u.drifterStock,['industry','clips','light','charge','ops','probe']))invalid();if(!numbers(u,['industry','lightKg','origin','gathered','originIndustry','originClips','originPower','nominalPower','originCapacity','charge','storageTarget','launched','arrived','destroyed','inFlight','drifted','drifters','probe','wreck','radius','years','beta','cruiseBeta','speedCap','autonomy','shieldCap','fidelityCap','hazardLosses','battlesEnded','warLosses','warOriginShips','transitLosses','warStartRadius','nextBattleYears','galacticStartRadius','lockedKg','fusionLostKg','fusionJ','radiationKg','systemCount','harvestedEquipment','harvestedClips','sourceRock','sourceStellar','untracked','nuclearMetal','blackHoleKg','accretionJ','frozenAccessible','boundKg','transportEnergyRemaining','transportEnergyTotal','transportStartCount','transportIslandCount','transportProgress'])||u.beta<.05||u.beta>u.speedCap||u.cruiseBeta<.05||u.cruiseBeta>u.speedCap||u.speedCap>=1||u.storageTarget>1||!Array.isArray(u.stars)||u.stars.length!==StellarSpace.settings.records||!Array.isArray(u.flights)||!Array.isArray(u.systems)||!Array.isArray(u.fades)||!Array.isArray(u.extraFlights)||typeof u.firstAttackEnded!=='boolean'||!u.last||!numbers(u.design,designkeys)||designkeys.some(k=>!Number.isInteger(u.design[k]))||sum(u.design)>u.autonomy)invalid();if(u.acceleration!==null&&(!numbers(u.acceleration,['from','energy','remaining'])||u.acceleration.remaining>u.acceleration.energy)||u.flights.some(f=>!numbers(f,['id','target','distance','mass','launched','risk','failProgress'])||!Number.isInteger(f.target)||f.target>=u.stars.length)||u.systems.some(s=>!numbers(s,['target','at','equipment','clips','power','gathered'])))invalid();}
  if(x.stage===4&&x.dismantle===11&&!x.ending&&!x.end.forming&&(!Number.isInteger(x.finalHand)||x.finalHand<1||x.finalHand>16))invalid();if(![null,'clips','virtual'].includes(x.ending)||!Number.isInteger(x.negotiation)||x.negotiation<0||x.negotiation>C.negotiationPages)invalid();if(!Number.isSafeInteger(x.calendarStart)||x.calendarStart<1||!x.researchCosts||typeof x.researchCosts!=='object')invalid();x.clock.whole=BigInt(x.clock.whole);x.h.strategyReadyDay??=x.stageDays;x.h.strategyReadyWins??=x.h.wins;finite(x);
  for(const entry of x.logs){
   if(entry?.text===copy('legacy.math.started'))entry.text=copy('project.math.name')+copy('copy.project-started');
   else if(entry?.text===copy('legacy.math.completion'))entry.text=copy('project.math.completion');
  }
  S=x;if(S.stage===1&&has('game')&&S.h.tournament?.phase!=='ready')prepareTournamentPreview();if(S.stage===2||S.stage===3)S.ops=Math.min(S.ops,operationsCapacity());if(!tournamentUnlocked(S.h.strategy))S.h.strategy='generous';restoreDrifterRemnant();targetOwner=null;for(let d of defs)d.cost={...d.baseCost,...(d.id==='bribe'?{cash:bribeCost()}:d.id==='creative'?x.researchCosts[d.id]||{}:{})};return true;
 }
 log(copy('copy.task-produce-as-many-paperclips-as-possible'));
  return {get state(){return S;},get clipFlow(){return clipFlow;},endingRampSeconds:ENDING.rampSeconds,spaceSettings:SPACE,stellarSettings:STELLAR,C,defs,has,visible,allowed,costOK,projectCostSatisfied,projectConditionReady,buyProject,projectResources,manual,clipCount,makerCost,buyMaker,buyMaterial,marketingCost,buyMarketing,humanRates,cdzStatus,setIndustry,investIndustry,withdrawIndustry,industryExpansionQuote,industryCapacity,hardware,reconfigure,canReconfigure,reconfigurationCost,bribe,bribeCost,canBribe,bribeWait,trustTotal,investmentQuote,investmentCapacity,invest,withdraw,tournamentPreview,prepareTournament,startTournament,tournamentScores,tournamentUnlocked,tournamentTrace,tournamentCost,tournamentRates,investmentUpgradeCost,investmentRates,upgradeInvestment,operationsCapacity,computeRate,ideaRate,processorRatedRate,surfaceResearchScale,researchYomiRate,computingSpecificEnergy,computingPower,memoryBytes,materialUnitPrice,materialQuote,equipmentMass,planetRates,solarPowerFullyUsed,surfaceDeposit,surfaceSpecs,autoBalanceAvailable,setAutoBalance,setStorageTarget,setResearchMemory,setTransferMode,canTransferRaw,earthTransferRate,groundTargets,groundCoreFull,groundMatter,swarmMatter,swarmEquipment,swarmDeposit,worldMiningEnergy,setWorldAllocation,reclaimEquipment,projectMetalAvailable,newSolarSpecific,laserMiningEfficiency,laserMiningEnergy,miningSpecific,swarmFactorySpecific,pioneerBeamEnergy,solarEfficiency,orbitalSolarEfficiency,beamEfficiency,launchSystem,setPreset,allocate,recycle,editDesign,setCruiseSpeed,autonomy,autonomyLimit,autonomyQuote,increaseAutonomy,designLimit,designResponse,probeCopies,driftProbability,launchQuote,canLaunchProbe,launchProbe,spaceCapacity,prepareSpaceSimulation,engineeringSet,engineeringRemaining,engineeringInventory,engineeringStorageSpecific,computeBaseload,probePowerFraction,spaceHazard,broadcastReadiness,probeCruiseBeta,probeLaunchEnergy,frontierBeta,spacePower,mapProgress,harvestProgress,accessibleMass,controlledStructures,drifterControlledMass,battleOdds,battleInterval,effectiveSpeed,setBattlePresenter,takeBattleResults,stepBattlePresentation,commandBattle,advanceNegotiation,endingAvailableEnergy,endingClipInteger,chooseEnding,evaporationProgress,advanceEndingReal,canDismantle,dismantle,dismantleDays,dismantleNames,advance,speedMax,speedMin,setSpeedMax,milestoneNames:MILESTONES,ledger,serialize,restore,dateParts:clock=>dateParts(clock,S.calendarStart),log};
}
return {create,C,SURFACE,SOLAR,clamp,dateParts,clockAdd,regionMass,scaleFactor,remainingLight,battleNamePool,battleNameParts,battleFixedNames,battlePlaces,battleSuffixes,combat:CombatSpace};
})();

