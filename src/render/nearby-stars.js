const NEAR_VIEW={lyPerAU:1/63241.077,extent:4.5,gridExtent:9,departureExtent:18,detailPixels:8};
function neighbourhoodExtent(radius=game.state.s.radius){const u=game.state.s,scale=Math.log10(Math.max(1,radius)),galaxy=smoothStep((scale-3)/1.4)*(1-smoothStep((scale-5)/.8));return Math.max(NEAR_VIEW.extent,radius*(u.automatic?1.8-.7*galaxy:1.12));}
let stellarCameraOwner=null,stellarCameraExtent=NEAR_VIEW.extent,stellarCameraAt=0;
function smoothStellarCamera(now){
 const u=game.state.s,target=neighbourhoodExtent()*Math.exp(Math.log(1.05/1.8)*smoothStep(u.transportProgress));
 if(stellarCameraOwner!==u){stellarCameraOwner=u;stellarCameraExtent=target;stellarCameraAt=now;}
 const dt=Math.min(.15,Math.max(0,(now-stellarCameraAt)/1000));stellarCameraAt=now;
 const distance=Math.log(target/stellarCameraExtent),next=Math.abs(distance)<1e-7?target:stellarCameraExtent*Math.exp(distance*(-Math.expm1(-dt/.65)));
 if(next===stellarCameraExtent)return false;stellarCameraExtent=next;viewDirty=true;return true;
}
function stellarViewExtent(){if(stellarCameraOwner!==game.state.s)smoothStellarCamera(performance.now());return stellarCameraExtent;}
let nearGridVisible=true,departureSolarScene=null,departureSunColor=null;
let departureStars=null,departureStarSeed=null;
let nearGuideOwner=null,nearGuideStars=[];
function nearGuideIndex(stars){if(nearGuideOwner!==stars){nearGuideOwner=stars;nearGuideStars=stars.map(star=>({star,r2:star.x*star.x+star.y*star.y})).sort((a,b)=>a.r2-b.r2);}return nearGuideStars;}
function captureDepartureSolar(){
 const p=game.state.p;if(!p)return null;
 return {coilProgress:solarCoilProgress(),planet:{earth:p.earth,worlds:{...p.worlds},worldMining:p.worldMining},active:solarCloudProgress()*SOLAR_VIEW.units,beltCapacity:solarBeltCapacity(),asteroids:solarAsteroidPoints(),irradiation:Object.fromEntries(['earth','mercury','venus','mars','others','sun'].map(key=>[key,key==='sun'?0:solarIrradiation(key)]))};
}
function neighbourhoodCamera(extent=NEAR_VIEW.extent,journey=1){
 const c=prepareSolarCamera(1),base=Math.min(vw*.40,vh*.47),targetScale=base/extent*NEAR_VIEW.lyPerAU,startScale=c.scale,amount=smoothStep(journey),bend=Math.sin(Math.PI*amount);
 c.scale=startScale*Math.exp(Math.log(targetScale/startScale)*amount);c.focal+=(base*5-c.focal)*amount;c.distance=c.focal/c.scale;c.eyeZ=c.distance;
 c.screenX=vw*(.5+.025*bend);c.screenY=vh*(.49-.02*bend);
 const yaw=.55-viewYaw+.13*bend,pitch=.38+viewPitch+.06*bend;c.ca=Math.cos(yaw);c.sa=Math.sin(yaw);c.ce=Math.cos(pitch);c.se=Math.sin(pitch);
 c.sunPixels=c.sunRadius*c.scale;c.x=c.screenX;c.y=c.screenY;c.sunVisible=true;
 c.starExtent=base/c.scale*NEAR_VIEW.lyPerAU;return c;
}
function neighbourPoint(x,y,z){return solarProject(x/NEAR_VIEW.lyPerAU,y/NEAR_VIEW.lyPerAU,z/NEAR_VIEW.lyPerAU);}
function neighbourLine(a,b,alpha,color=null){
 if(!a.visible||!b.visible)return;
 if(Math.max(a.px,b.px)<0||Math.min(a.px,b.px)>vw||Math.max(a.py,b.py)<0||Math.min(a.py,b.py)>vh)return;
 if(color){const inherited=vctx.globalAlpha;vctx.globalAlpha=inherited*alpha;vctx.strokeStyle=color;vctx.beginPath();vctx.moveTo(a.px,a.py);vctx.lineTo(b.px,b.py);vctx.stroke();vctx.globalAlpha=inherited;}else line(a.px,a.py,b.px,b.py,alpha);
}
function neighbourGuide(star,point,grid,luminosity){
 const foot={...neighbourPoint(star.x,star.y,0)};let tip=point;
 if(!tip.visible&&foot.visible){const c=solarCamera,depth=c.eyeZ-c.distance*2e-6,t=(depth-foot.z)/(tip.z-foot.z);tip={...neighbourPoint(star.x,star.y,star.z*t)};}
 neighbourLine(tip,foot,grid*(.055+.075*luminosity));if(foot.visible)dot(foot.px-.5,foot.py-.5,.15*grid,1);
}
function drawNeighbourhood(extent=NEAR_VIEW.extent,journey=1,solarScene=null,showFlights=true){
 const camera=neighbourhoodCamera(extent,journey),visibleExtent=camera.starExtent,gridExtent=visibleExtent*Math.max(1,NEAR_VIEW.gridExtent/extent),starRange=camera.distance*NEAR_VIEW.lyPerAU,grid=nearGridVisible?smoothStep(Math.log10(Math.max(.01,visibleExtent)/.15)/1.2):0;
 const inherited=vctx.globalAlpha;
 if(grid>0){
  const ringUnit=10**Math.floor(Math.log10(gridExtent)),spacing=gridExtent/ringUnit<2?ringUnit/4:gridExtent/ringUnit<5?ringUnit/2:ringUnit;
  for(let radius=spacing;radius<=gridExtent*1.01;radius+=spacing){
   let previous=null;for(let j=0;j<=96;j++){let angle=j*Math.PI/48,point={...neighbourPoint(Math.cos(angle)*radius,Math.sin(angle)*radius,0)};if(previous)neighbourLine(previous,point,.11*grid);previous=point;}
  }
  const centre={...neighbourPoint(0,0,0)};
  for(let j=0;j<12;j++){let angle=j*Math.PI/6;neighbourLine(centre,{...neighbourPoint(Math.cos(angle)*gridExtent,Math.sin(angle)*gridExtent,0)},.07*grid);}
 }
 const u=game.state.s;if(!u&&departureStarSeed!==game.state.seed){departureStars=StellarSpace.catalogue(game.state.seed);departureStarSeed=game.state.seed;}const stars=u?.stars||departureStars,systems=new Map((u?.systems||[]).map(s=>[s.target,s]));
 if(grid)for(const {star,r2}of nearGuideIndex(stars)){
  if(r2>gridExtent*gridExtent)break;if(star.r<=starRange)continue;
  const luminosity=clamp(Math.log10(1+star.luminosity*20)/1.5,0,1);neighbourGuide(star,{...neighbourPoint(star.x,star.y,star.z)},grid,luminosity);
 }
 for(let i=0;i<stars.length;i++){
  const star=stars[i];if(star.r>starRange)break;
  const q={...neighbourPoint(star.x,star.y,star.z)},visible=q.visible&&q.px>=-8&&q.px<=vw+8&&q.py>=-8&&q.py<=vh+8,guide=grid&&star.x*star.x+star.y*star.y<=gridExtent*gridExtent;if(!visible&&!guide)continue;
  const luminosity=clamp(Math.log10(1+star.luminosity*20)/1.5,0,1);if(guide)neighbourGuide(star,q,grid,luminosity);if(!visible)continue;
  const proximity=clamp(visibleExtent/star.r,0,3),brightness=(.34+.62*luminosity)*(.65+.35*Math.min(1,proximity)**.85)*smoothStep(clamp((1-star.r/starRange)/.08,0,1));
  // 恒星系统小于一个像素后，仅用一个点代表。
  const size=1.65+Math.sqrt(luminosity)*.9*Math.min(1,proximity)**.75,system=systems.get(star.id),covered=system?clamp(system.power/(star.luminosity*game.C.sunPower),0,1):0,red=system||u?.coarse&&star.r<=u.radius;
  dot(q.px-size/2,q.py-size/2,brightness,size,red?'rgba('+(220-covered*80)+',7,13,'+Math.max(.45,brightness)+')':null);
 }
 const flights=showFlights&&game.state.stage===3&&!screenTransition&&journey===1;
 if(flights&&u&&!u.automatic){const centre={...neighbourPoint(0,0,0)};vctx.save();for(const f of u.flights.slice(0,100)){if(!(f.distance>0))continue;let star=u.stars[f.target],part=f.distance/star.r,p={...neighbourPoint(star.x*part,star.y*part,star.z*part)};neighbourLine(centre,p,.5,'rgb(215,205,173)');}vctx.restore();}
 if(flights&&u)for(const f of u.fades){let age=u.years-f.at,fade=Math.exp(-age/.65);if(fade<.002)continue;const star=u.stars[f.target],part=f.distance/star.r;vctx.save();neighbourLine({...neighbourPoint(0,0,0)},{...neighbourPoint(star.x*part,star.y*part,star.z*part)},fade*.5,'rgb(215,205,173)');vctx.restore();}
 const detail=solarScene?smoothStep((camera.scale*SOLAR_VIEW.outer*2-2)/NEAR_VIEW.detailPixels):0;
 const tintAmount=smoothStep(journey/.65),sunRGB=visualRGB.split(',').map((n,i)=>Math.round(Number(n)*(1-tintAmount)+[140,7,13][i]*tintAmount)).join(',');
 if(detail>0){departureSunColor=sunRGB;try{drawSolar(detail,1,camera,solarScene);}finally{departureSunColor=null;}}
 const sunAlpha=1-detail;if(sunAlpha>0)dot(camera.x-1,camera.y-1,.92*sunAlpha,2,'rgb('+sunRGB+')');
 vctx.globalAlpha=inherited;
}
function toggleNearGrid(){if(game.state.stage!==3||game.state.s.radius>=1600)return false;nearGridVisible=!nearGridVisible;drawViz();return true;}
