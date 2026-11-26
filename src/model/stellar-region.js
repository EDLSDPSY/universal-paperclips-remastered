'use strict';
const StellarSpace=(()=>{
 const density=.004,halfThickness=300,solarMass=1.98847e30,solarPower=3.828e26,solarRadius=8178*3.26156,diskRadius=54000,galaxyRadius=solarRadius+diskRadius;
 const settings=Object.freeze({density,halfThickness,galaxyRadius,solarRadius,diskRadius,galaxyStars:4e11,meanGalaxyStars:1e9,combatBaseRate:.15,drifterCombat:1.583409492,initialAutonomy:5,autonomyCost:2e18,autonomyCostRatio:5,designKnee:6,clipShare:.35,clipScale:10,threshold:100,records:1024,seedMass:2e12,initialShips:10,propellantRatio:4,probeManufacturingEnergy:1e9,specificPower:50,storageSpecific:5e8,meanLuminosity:.25,meanMass:.5,metalRatio:50,developmentYears:1,flightRange:100,constructionEnergy:6.5e8,cosmicStellarFraction:.06,blackHoleFraction:.001,accretionEfficiency:.2,transportEnergy:2e13,finalClipCount:3e55});
 const nearbyGalaxies=[{x:0,y:0,z:0,r:diskRadius,angle:0,name:copy('copy.milky-way-2')},...[
  [100000,-120000,50000,7500,2.5,copy('stellar-region.text')],[-95000,-110000,-90000,4500,.5,copy('stellar-region.text-2')],
  [2200000,1200000,400000,65000,1.5,'M31'],[2100000,-1700000,700000,24000,.8,'M33'],
  [200000,90000,-160000,1600,1.1,copy('stellar-region.text-3')],[-170000,140000,100000,1100,.8,copy('stellar-region.text-4')],
  [390000,-220000,80000,1800,1.8,copy('stellar-region.text-5')],[-130000,-90000,150000,900,.4,copy('copy.carina')],
  [8900000,7400000,2000000,35000,2.1,'M81']
 ].map(([x,y,z,r,angle,name])=>({x:x+solarRadius,y,z,r,angle,name})),...[
  [152.5,37.4,32,900,copy('stellar-region.ii')],[358.1,69.6,66,1400,copy('stellar-region.i')],[86.4,34.7,76,1700,copy('stellar-region.text-6')],[105,44.8,76,1400,copy('stellar-region.text-7')],[243.5,42.3,86,2800,copy('stellar-region.text-8')],[159.4,54.4,97,1500,copy('stellar-region.i-2')],[28.7,36.9,132,1600,copy('stellar-region.text-9')]
 ].map(([l,b,kpc,r,name],i)=>{l*=Math.PI/180;b*=Math.PI/180;const d=kpc*3261.56;return {x:solarRadius-d*Math.cos(b)*Math.cos(l),y:d*Math.cos(b)*Math.sin(l),z:d*Math.sin(b),r,angle:i*.73,name};})];
 function random(seed){let n=Math.imul(seed^0x6c8e9cf5,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
 function catalogue(seed){
  const stars=[];
  for(let i=0;i<settings.records;i++){
   const k=seed+i*17,volume=(i+.35+.3*random(k))/(density*4*Math.PI/3),r=Math.max(4.24,Math.cbrt(volume)),z=2*random(k+1)-1,angle=random(k+2)*Math.PI*2,ring=Math.sqrt(1-z*z),m=.12+1.5*random(k+3)**2;
   stars.push({id:i,x:r*ring*Math.cos(angle),y:r*ring*Math.sin(angle),z:r*z,r,luminosity:Math.max(.003,m**3.5),mass:m*solarMass,phase:random(k+4)*Math.PI*2});
  }
  stars.sort((a,b)=>a.r-b.r);stars.forEach((s,i)=>s.id=i);return stars;
 }
 function diskVolume(r){return r<=halfThickness?4*Math.PI/3*r**3:2*Math.PI*halfThickness*(r*r-halfThickness*halfThickness/3);}
 const galaxyCDF=new Float64Array(257),rings=Array.from({length:512},(_,i)=>{const r=diskRadius*(i+.5)/512;return {r,weight:r*Math.exp(-r/9500)};}),ringWeight=rings.reduce((total,p)=>total+p.weight,0);
 for(let i=1;i<galaxyCDF.length;i++){
  const front=galaxyRadius*i/(galaxyCDF.length-1);let disk=0;
  for(const p of rings){const cos=(p.r*p.r+solarRadius*solarRadius-front*front)/(2*p.r*solarRadius),fraction=cos<=-1?1:cos>=1?0:Math.acos(cos)/Math.PI;disk+=p.weight*fraction;}
  const t=Math.max(0,Math.min(1,(front-solarRadius+6000)/12000)),bulge=t*t*(3-2*t),halo=front>=diskRadius+solarRadius?1:front<=diskRadius-solarRadius?(front/diskRadius)**3:(diskRadius+front-solarRadius)**2*(solarRadius**2+2*solarRadius*(front+diskRadius)-3*(front-diskRadius)**2)/(16*solarRadius*diskRadius**3);
  galaxyCDF[i]=.88*disk/ringWeight+.1*bulge+.02*halo;
 }
 galaxyCDF[galaxyCDF.length-1]=1;
 function stellarCount(r){
  r=Math.max(0,Math.min(r,galaxyRadius));const at=r/galaxyRadius*(galaxyCDF.length-1),i=Math.min(galaxyCDF.length-2,Math.floor(at)),fraction=galaxyCDF[i]+(galaxyCDF[i+1]-galaxyCDF[i])*(at-i),t=Math.max(0,Math.min(1,(r-1000)/7000)),blend=t*t*(3-2*t);
  return density*diskVolume(r)*(1-blend)+settings.galaxyStars*fraction*blend;
 }
 const nearestGalaxyRadius=Math.min(...nearbyGalaxies.slice(1).map(g=>Math.hypot(g.x-solarRadius,g.y,g.z)-g.r));
 const localGroupRadius=2.5e6-nearestGalaxyRadius,localGroupMass=2*settings.galaxyStars*solarMass*settings.meanMass;
 function matter(r){const disk=stellarCount(r)*solarMass*settings.meanMass,distance=Math.max(0,r-nearestGalaxyRadius),depth=distance*distance/(distance+5000),local=localGroupMass*depth/(localGroupRadius+depth),cosmic=4.2e-28*4*Math.PI/3*Math.max(0,r**3-nearestGalaxyRadius**3)*9.4607304725808e15**3;return solarMass+disk+local+cosmic;}
 function recoverableMatter(r){return solarMass+(matter(r)-solarMass)*(1-settings.blackHoleFraction);}
 function galaxies(r){const local=nearbyGalaxies.slice(1).filter(g=>r>=Math.hypot(g.x-solarRadius,g.y,g.z)-g.r).length,cosmic=4.2e-28*4*Math.PI/3*Math.max(0,r**3-galaxyRadius**3)*9.4607304725808e15**3,background=cosmic*settings.cosmicStellarFraction/(solarMass*settings.meanMass*settings.meanGalaxyStars);return 1+Math.max(local,background);}
 function systems(r){const galactic=stellarCount(r),cosmic=Math.max(0,matter(r)-solarMass-galactic*solarMass*settings.meanMass);return galactic+cosmic*settings.cosmicStellarFraction/(solarMass*settings.meanMass);}
 return {settings,nearbyGalaxies,nearestGalaxyRadius,random,catalogue,diskVolume,stellarCount,matter,recoverableMatter,galaxies,systems};
})();
