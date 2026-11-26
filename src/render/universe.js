const galacticParticles=[];
function stellarNormal(seed){return Math.sqrt(-2*Math.log(Math.max(1e-8,seeded(seed))))*Math.cos(seeded(seed+2)*Math.PI*2);}
function stellarLight(value){return Math.min(1,1.4*Math.max(0,value)**.9);}
function galacticArmSpread(r){return .15+.18*r/50000;}
for(let i=0;i<6000;i++){
 const seed=41700+i*13,type=seeded(seed),spur=type<.13,r=spur?18000+15000*seeded(seed+1):type<.8?Math.min(53999,-Math.log(Math.max(.001,seeded(seed+1)*seeded(seed+2)))*9500):type<.92?Math.abs(stellarNormal(seed+1))*2300:6000+seeded(seed+1)**.6*48000;
 let angle=seeded(seed+3)*Math.PI*2,z;
 if(type<.8){const arm=i%4;angle=spur?Math.log(r/StellarSpace.settings.solarRadius)/Math.tan(.25)+.025+stellarNormal(seed+4)*.12:arm*Math.PI/2+Math.log(Math.max(5500,r)/5500)/Math.tan(.3)+stellarNormal(seed+4)*galacticArmSpread(r);if(!spur&&seeded(seed+8)<.2)angle=seeded(seed+3)*Math.PI*2;z=stellarNormal(seed+5)*(140+340*r/50000);if(r<5500)angle=.45+(arm%2)*Math.PI+stellarNormal(seed+4)*.22;}
 else if(type<.92)z=stellarNormal(seed+5)*1800;
 else z=stellarNormal(seed+5)*r*.4;
 const x=r*Math.cos(angle),y=r*Math.sin(angle),distance=Math.hypot(x-StellarSpace.settings.solarRadius,y,z),edge=1-smoothStep((distance-StellarSpace.settings.galaxyRadius+12000)/12000),radial=1-smoothStep((r-44000)/10000);
 galacticParticles.push({x,y,z,brightness:(type<.8?.3+.5*seeded(seed+6):type<.92?.25+.5*seeded(seed+6):.08+.18*seeded(seed+6))*edge*(type<.8?radial:1),type,size:1+.7*seeded(seed+7)});
}
const stellarProjection={yaw:NaN,pitch:NaN},stellarPoint={},stellarRedColors=Array.from({length:256},(_,r)=>'rgb('+r+',7,13)'),stellarDrawQueue=[],stellarDrawPool=[];
let stellarCollecting=false;
const sortStellarDepth=(()=>{
 let capacity=0,depths=null,words=null,first=null,second=null,exactDepths=null,lastOrder=null,lastCount=0,ordered=[];const counts=new Uint32Array(256),offsets=new Uint32Array(256);
 return points=>{const n=points.length;if(n<2)return;if(n>capacity){capacity=2**Math.ceil(Math.log2(n));depths=new Float32Array(capacity);words=new Uint32Array(depths.buffer);first=new Uint32Array(capacity);second=new Uint32Array(capacity);exactDepths=new Float64Array(capacity);lastOrder=new Uint32Array(capacity);lastCount=0;ordered=new Array(capacity);}
  let same=n===lastCount;for(let i=0;same&&i<n;i++)same=exactDepths[i]===(points[i].depth||0);if(same){for(let i=0;i<n;i++)ordered[i]=points[lastOrder[i]];for(let i=0;i<n;i++)points[i]=ordered[i];return;}
  lastCount=n;for(let i=0;i<n;i++){exactDepths[i]=points[i].depth||0;depths[i]=exactDepths[i];first[i]=i;const hi=words[i];if(!(hi&0x80000000))words[i]=hi^0x7fffffff;}
  let input=first,output=second;for(let pass=0;pass<4;pass++){const shift=pass*8;counts.fill(0);for(let i=0;i<n;i++)counts[words[input[i]]>>>shift&255]++;let sum=0;for(let i=0;i<256;i++){offsets[i]=sum;sum+=counts[i];}for(let i=0;i<n;i++){const id=input[i];output[offsets[words[id]>>>shift&255]++]=id;}const temp=input;input=output;output=temp;}
  // 量化后深度相同的点按提交顺序绘制。
  lastOrder.set(input.subarray(0,n));for(let i=0;i<n;i++)ordered[i]=points[input[i]];for(let i=0;i<n;i++)points[i]=ordered[i];
 };
})();
function prepareStellarProjection(){const c=stellarProjection;if(c.yaw!==viewYaw||c.pitch!==viewPitch){c.yaw=viewYaw;c.pitch=viewPitch;c.ca=Math.cos(.55-viewYaw);c.sa=-Math.sin(.55-viewYaw);c.ce=Math.cos(.38+viewPitch);c.se=-Math.sin(.38+viewPitch);}return c;}
function universeProject(x,y,z,extent,centreX=StellarSpace.settings.solarRadius,out={}){
 const c=prepareStellarProjection();
 x-=centreX;const xx=x*c.ca-y*c.sa,yy=x*c.sa+y*c.ca,screenY=yy*c.se-z*c.ce,depth=yy*c.ce+z*c.se,distance=extent*5,focal=Math.min(vw*.4,vh*.47)*5,perspective=focal/(distance+depth);
 const px=vw*.5+xx*perspective,py=vh*.49+screenY*perspective;out.x=px;out.y=py;out.depth=depth;out.visible=distance+depth>extent*.2&&px>-8&&px<vw+8&&py>-8&&py<vh+8;return out;
}
function universeDot(p,extent,alpha=1,centreX=StellarSpace.settings.solarRadius,developed=0,size=p.size||1.2,batchAlpha=null,projection=null){
 const q=projection||universeProject(p.x,p.y,p.z,extent,centreX,stellarPoint),brightness=clamp(p.brightness*alpha*(game.state.s?.transportProgress?transportSourceOpacity(stellarDistance(p.x,p.y,p.z)):1),0,1);if(!q.visible||brightness<.003)return;
 const inherited=batchAlpha??vctx.globalAlpha;
 if(stellarCollecting){const i=stellarDrawQueue.length,d=stellarDrawPool[i]||(stellarDrawPool[i]={});d.fieldDistance=-1;d.x=q.x;d.y=q.y;d.depth=q.depth;d.brightness=inherited*brightness;d.size=size;d.developed=developed;stellarDrawQueue.push(d);return;}
 vctx.globalAlpha=inherited;if(developed){vctx.globalAlpha*=brightness;dot(q.x-size/2,q.y-size/2,1,size,stellarRedColors[Math.round(220-developed*80)]);}else dot(q.x-size/2,q.y-size/2,brightness,size);vctx.globalAlpha=inherited;
}
function flushStellarPoints(){
 const inherited=vctx.globalAlpha;sortStellarDepth(stellarDrawQueue);let style=null,opacity=NaN;
 if(stellarDrawQueue.length>600&&!planeMatrix&&(!capturePoints&&StellarPixels.accelerated&&screenRenderer?.mode!=='cpu'||stellarDrawQueue.every(p=>!p.line&&(p.size===1||p.size===1.1||p.size===1.2||p.size===2.1)))){
  if(capturePoints)for(const d of stellarDrawQueue){const i=scenePointCount++,stored=scenePoints[i]||(scenePoints[i]={});stored.x=(d.x-d.size/2)/vw;stored.y=(d.y-d.size/2)/vh;stored.a=d.brightness;stored.size=d.size;}
  if(StellarPixels.draw(stellarDrawQueue,vctx,vw,vh,vscale,visualRGB.split(',').map(Number),inherited)){stellarDrawQueue.length=0;return;}
 }
 StellarPixels.resolve(stellarDrawQueue);
 for(const d of stellarDrawQueue){if(d.line){vctx.globalAlpha=d.alpha;vctx.strokeStyle='rgb(215,205,173)';vctx.beginPath();vctx.moveTo(d.x,d.y);vctx.lineTo(d.toX,d.toY);vctx.stroke();opacity=NaN;continue;}const x=d.x-d.size/2,y=d.y-d.size/2,alpha=d.developed?d.brightness:inherited,a=d.developed?1:d.brightness/Math.max(1e-20,inherited),color=d.developed?stellarRedColors[Math.round(220-d.developed*80)]:null;
  if(planeMatrix){vctx.globalAlpha=alpha;dot(x,y,a,d.size,color);continue;}if(x<-4||x>vw+4||y<-4||y>vh+4)continue;
  if(capturePoints){const i=scenePointCount++,stored=scenePoints[i]||(scenePoints[i]={});stored.x=x/vw;stored.y=y/vh;stored.a=a*alpha;stored.size=d.size;}
  const next=color||tint(a);if(next!==style){vctx.fillStyle=next;style=next;}if(alpha!==opacity){vctx.globalAlpha=alpha;opacity=alpha;}vctx.fillRect(Math.round(x),Math.round(y),d.size,d.size);
 }
 vctx.globalAlpha=inherited;stellarDrawQueue.length=0;
}
function stellarDistance(x,y,z){x-=StellarSpace.settings.solarRadius;return Math.sqrt(x*x+y*y+z*z);}
function stellarNearFade(distance,depth,extent,radius){
 if(depth>=0)return 0;const eye=5*extent,sphere=Math.min(radius,eye*.85),forward=eye+depth;if(!(sphere>0&&forward>extent*.2))return 0;
 // 内侧圆锥在球体投影轮廓内留出柔和边缘。
 const cone=Math.max(0,distance*distance-depth*depth)*(eye*eye-sphere*sphere)/(forward*forward*sphere*sphere);
 return smoothStep(-depth/(sphere*.6))*(1-smoothStep((cone-.25)/.56));
}
function stellarEdgeFade(distance,radius,start,near){const from=start+(.97-start)*near;return 1-smoothStep((distance/radius-from)/(1-from));}
function stellarDepthFade(depth,extent,near){const fog=Math.exp(-.5*(depth/(extent*.85))**2);return fog+(1-fog)*near*.85;}
function stellarCoverageModel(){const u=game.state.s;return {radius:u.radius,beta:Math.max(.05,game.frontierBeta()),cover:Math.log2(StellarSpace.settings.meanLuminosity*game.C.sunPower/(game.launchQuote().mass*game.probeCopies()*StellarSpace.settings.specificPower))/(1+.7*(-Math.expm1(-u.design.industry/2)))};}
function stellarCoverage(distance,model=stellarCoverageModel()){if(distance>model.radius)return 0;const age=(model.radius-distance)/model.beta;return .05+.95*clamp(age/Math.max(1,model.cover),0,1);}
function galaxyDensity(x,y,z){
 const r=Math.hypot(x,y),angle=Math.atan2(y,x),phase=angle-Math.log(Math.max(5500,r)/5500)/Math.tan(.3),armAngle=Math.atan2(Math.sin(phase*4),Math.cos(phase*4))/4,arm=Math.exp(-.5*(armAngle/galacticArmSpread(r))**2),spurPhase=angle-Math.log(Math.max(1,r)/StellarSpace.settings.solarRadius)/Math.tan(.25)-.025,spurAngle=Math.atan2(Math.sin(spurPhase),Math.cos(spurPhase)),spur=Math.exp(-.5*(spurAngle/.12)**2)*Math.exp(-(((r-StellarSpace.settings.solarRadius)/8500)**4)),height=140+340*r/50000;
 return ((.2+.8*arm+.8*spur)*(.8*Math.exp(-.5*(z/height)**2)+.2*Math.exp(-.5*(z/(1500+900*r/50000))**2))*Math.exp((StellarSpace.settings.solarRadius-r)/16000)*(1-smoothStep((r-44000)/10000))+.12*Math.exp(-.5*(r*r+z*z)/5000**2));
}
const stellarCellCache=new Map(),cosmicCellCache=new Map(),COSMIC_WEB_UNIT=CosmicWeb.unit,OBSERVABLE_RADIUS=46.5e9;
function spatialSeed(x,y,z,salt=0){return (Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^salt)>>>0;}
function cosmicAnchor(ix,iy,iz,size){
 const level=Math.round(Math.log2(size));let x=0,y=0,z=0,seed=0;
 for(let l=36;l>=level;l--){const s=2**l,k=2**(l-level),a=Math.floor(ix/k),b=Math.floor(iy/k),c=Math.floor(iz/k);if(l<36&&x>=a*s&&x<(a+1)*s&&y>=b*s&&y<(b+1)*s&&z>=c*s&&z<(c+1)*s)continue;seed=spatialSeed(a,b,c,l*7919);x=(a+StellarSpace.random(seed))*s;y=(b+StellarSpace.random(seed+1))*s;z=(c+StellarSpace.random(seed+2))*s;}
 return {x,y,z,seed};
}
function cosmicDensity(x,y,z,size=0){return .12*Math.exp(.8*CosmicWeb.field(x/COSMIC_WEB_UNIT,y/COSMIC_WEB_UNIT,z/COSMIC_WEB_UNIT,false,size/COSMIC_WEB_UNIT*.3).value);}
function stellarBoxVisible(x,y,z,radius,extent){const q=universeProject(x,y,z,extent,StellarSpace.settings.solarRadius,stellarPoint),depth=extent*5+q.depth;if(depth<=radius)return true;const focal=Math.min(vw*.4,vh*.47)*5,dx=(focal+Math.abs(q.x-vw*.5))*radius/(depth-radius),dy=(focal+Math.abs(q.y-vh*.49))*radius/(depth-radius);return q.x+dx>=-8&&q.x-dx<=vw+8&&q.y+dy>=-8&&q.y-dy<=vh+8;}
const cosmicCloudPoint={},cosmicProjectionCache=new WeakMap(),cosmicGroupBounds=new WeakMap();
function cosmicBounds(g){let b=cosmicGroupBounds.get(g);if(!b){b={radius:(g.size*1.5+.5)*COSMIC_WEB_UNIT,distance:Math.hypot(g.x,g.y,g.z)*COSMIC_WEB_UNIT,x:g.x*COSMIC_WEB_UNIT+StellarSpace.settings.solarRadius,y:g.y*COSMIC_WEB_UNIT,z:g.z*COSMIC_WEB_UNIT};cosmicGroupBounds.set(g,b);}return b;}
const cosmicGroupView={yaw:NaN,pitch:NaN,extent:0,groups:[]};
function cosmicVisibleGroups(extent){
 const cache=cosmicGroupView;if(cache.yaw===viewYaw&&cache.pitch===viewPitch&&cache.width===vw&&cache.height===vh&&extent>=cache.extent*.9&&extent<=cache.extent*1.1)return cache.groups;
 cache.yaw=viewYaw;cache.pitch=viewPitch;cache.width=vw;cache.height=vh;cache.extent=extent;cache.groups=[];
 for(const g of CosmicWeb.groups){const b=cosmicBounds(g),radius=b.radius,d=b.distance;if(d>extent*6.1+radius||d>CosmicWeb.extent+radius)continue;
  const q=universeProject(b.x,b.y,b.z,extent,StellarSpace.settings.solarRadius,stellarPoint);if(q.depth>extent*2.8+radius||q.depth+radius<-extent*4.8||!stellarBoxVisible(b.x,b.y,b.z,radius+extent*.2,extent))continue;cache.groups.push(g);
 }return cache.groups;
}
function cosmicProjection(points,count){
 let cached=cosmicProjectionCache.get(points);if(!cached){cached={data:new Float64Array(0),count:0,rotated:0,yaw:NaN,pitch:NaN};cosmicProjectionCache.set(points,cached);}
 if(cached.data.length<count*7){const data=new Float64Array(Math.min(points.length/5,Math.max(count,Math.ceil(cached.data.length/7*1.5)))*7);data.set(cached.data);cached.data=data;}
 const data=cached.data,c=stellarProjection;
 for(let i=cached.count;i<count;i++){const j=i*5,k=i*7,x=points[j]-StellarSpace.settings.solarRadius,y=points[j+1],z=points[j+2],d=Math.sqrt(x*x+y*y+z*z);data[k+3]=d;data[k+4]=1-smoothStep((d/CosmicWeb.extent-.75)/.25);data[k+5]=1-smoothStep((d/OBSERVABLE_RADIUS-.65)/.35);data[k+6]=Math.log(points[j+3]*data[k+4]*data[k+5]);}
 cached.count=Math.max(cached.count,count);if(cached.yaw!==viewYaw||cached.pitch!==viewPitch){cached.yaw=viewYaw;cached.pitch=viewPitch;cached.rotated=0;}
 for(let i=cached.rotated;i<count;i++){const j=i*5,k=i*7,x=points[j]-StellarSpace.settings.solarRadius,y=points[j+1],z=points[j+2],xx=x*c.ca-y*c.sa,yy=x*c.sa+y*c.ca;data[k]=xx;data[k+1]=yy*c.se-z*c.ce;data[k+2]=yy*c.ce+z*c.se;}
 cached.rotated=Math.max(cached.rotated,count);return data;
}
function drawResolvedCosmicWeb(extent,alpha,coverage){
 const inherited=vctx.globalAlpha,u=game.state.s,reachable=u.horizonKnown?u.radius+game.frontierBeta()*PaperclipModel.remainingLight(u.years):Infinity,range=extent*5.5,candidates=[];
 for(const g of cosmicVisibleGroups(extent)){const b=cosmicBounds(g),radius=b.radius,d=b.distance;if(d>range+radius||!stellarBoxVisible(b.x,b.y,b.z,radius,extent))continue;const q=universeProject(b.x,b.y,b.z,extent,StellarSpace.settings.solarRadius,stellarPoint);if(q.depth>extent*2.5+radius||q.depth+radius<-extent*4.8)continue;candidates.push(g);}
 const focal=Math.min(vw*.4,vh*.47),volume=vw*vh/focal**2*Math.sqrt(2*Math.PI)*.85*extent**3,box=(2*CosmicWeb.extent)**3,total=CosmicWeb.pointCount*volume/(volume+box),fraction=Math.min(1,8000/Math.max(1,total)*Math.min(1,(CosmicWeb.extent/(extent*2))**2));
 const frameFocal=Math.min(vw*.4,vh*.47)*5,distance=extent*5,sphere=Math.min(CosmicWeb.extent,range,OBSERVABLE_RADIUS,distance*.85),coneNumerator=distance*distance-sphere*sphere,sphereSquared=sphere*sphere,depthScale=sphere*.6,fogScale=extent*.85,logThreshold=Math.log(alpha/.003),fogSquared=2*(extent*.85)**2,accelerated=!capturePoints&&!planeMatrix&&screenRenderer?.mode!=='cpu'&&StellarPixels.accelerated;
 StellarPixels.fieldFrame={extent,alpha,inherited,fraction,reachable,radius:coverage.radius,dissolve:transportDissolve()};
 if(accelerated&&StellarCull.available&&StellarCull.draw(candidates,fraction,coverage,extent,alpha,coneNumerator,sphereSquared,fogSquared,logThreshold))return;
 for(const g of candidates){const points=CosmicWeb.particles(g);let lo=0,hi=points.length/5;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid*5+4]<fraction)lo=mid+1;else hi=mid;}const data=cosmicProjection(points,lo);
  for(let i=0;i<lo;i++){const j=i*5,k=i*7,depth=data[k+2];if(distance+depth<=extent*.2)continue;const perspective=frameFocal/(distance+depth),x=vw*.5+data[k]*perspective,y=vh*.49+data[k+1]*perspective;if(x<=-8||x>=vw+8||y<=-8||y>=vh+8)continue;
   const d=data[k+3];if(accelerated){if(alpha*points[j+3]<.003)continue;const forward=distance+depth,nearPossible=depth<0&&Math.max(0,d*d-depth*depth)*coneNumerator<.81*forward*forward*sphereSquared;if(!nearPossible&&depth*depth>fogSquared*(logThreshold+data[k+6]))continue;const n=stellarDrawQueue.length,p=stellarDrawPool[n]||(stellarDrawPool[n]={});p.x=x;p.y=y;p.depth=depth;p.size=1.1;p.developed=stellarCoverage(d,coverage);p.fieldDistance=d;p.fieldBrightness=points[j+3];p.fieldRank=points[j+4];p.brightness=0;stellarDrawQueue.push(p);continue;}
   const forward=distance+depth,near=depth>=0?0:smoothStep(-depth/depthScale)*(1-smoothStep(((Math.max(0,d*d-depth*depth)*coneNumerator/(forward*forward*sphereSquared))-.25)/.56)),selection=smoothStep((fraction-points[j+4])/(fraction*.1)),baseFog=Math.exp(-.5*(depth/fogScale)**2),fog=baseFog+(1-baseFog)*near*.85;if(alpha*selection*fog*points[j+3]<.003)continue;const bound=(d>reachable?.18:1)*(near?stellarEdgeFade(d,OBSERVABLE_RADIUS,.65,near):data[k+5]),brightness=clamp(points[j+3]*(alpha*selection*fog*(near?stellarEdgeFade(d,CosmicWeb.extent,.75,near):data[k+4])*bound),0,1);if(brightness<.003)continue;
   const n=stellarDrawQueue.length,p=stellarDrawPool[n]||(stellarDrawPool[n]={});p.fieldDistance=-1;p.x=x;p.y=y;p.depth=depth;p.brightness=inherited*brightness*transportSourceOpacity(d);p.size=1.1;p.developed=stellarCoverage(d,coverage);stellarDrawQueue.push(p);
  }
 }
}
function spatialCell(ix,iy,iz,size,cosmic){
 const levels=cosmic?cosmicCellCache:stellarCellCache;let cache=levels.get(size);if(!cache){if(levels.size>=3)levels.delete(levels.keys().next().value);cache=new Map();levels.set(size,cache);}const key=ix+','+iy+','+iz;let p=cache.get(key);if(p)return p;
 const seed=spatialSeed(ix,iy,iz,Math.round(Math.log2(size))*7919),samples=4;let weight=0,x=0,y=0,z=0;
 for(let i=0;i<samples;i++){const sx=(ix+seeded(seed+i*3))*size,sy=(iy+seeded(seed+i*3+1))*size,sz=(iz+seeded(seed+i*3+2))*size,d=cosmic?cosmicDensity(sx,sy,sz,size):galaxyDensity(sx+StellarSpace.settings.solarRadius,sy,sz);weight+=d;if(!cosmic&&StellarSpace.random(seed+311+i)<d/Math.max(1e-20,weight)){x=sx;y=sy;z=sz;}}
 if(cosmic){const anchor=cosmicAnchor(ix,iy,iz,size);x=anchor.x;y=anchor.y;z=anchor.z;}
 p={x:StellarSpace.settings.solarRadius+(cosmic?x:weight?x:(ix+.5)*size),y:cosmic?y:weight?y:(iy+.5)*size,z:cosmic?z:weight?z:(iz+.5)*size,density:weight/samples,brightness:cosmic?.28+.32*seeded(seed+100):stellarLight(.28+.32*seeded(seed+100)),seed};
 cache.set(key,p);return p;
}
function cosmicLocalWeight(p){return 1-smoothStep((stellarDistance(p.x,p.y,p.z)/CosmicWeb.extent-.75)/.25);}
const spatialLodCache=[{key:'',cells:[]},{key:'',cells:[]}];
function buildSpatialLayout(size,n,cosmic){const cells=[];
 const annotate=p=>{if(p.distance===undefined){p.distance=stellarDistance(p.x,p.y,p.z);p.amount=cosmic?Math.sqrt(Math.min(1,p.density*3)):stellarLight(Math.min(1,p.density));}return p;};
 for(let ix=-n;ix<n;ix++)for(let iy=-n;iy<n;iy++)for(let iz=-n;iz<n;iz++){const p=annotate(spatialCell(ix,iy,iz,size,cosmic));if(p.density<.012)continue;const children=[];for(let i=0;i<8;i++)children.push(annotate(spatialCell(ix*2+(i&1),iy*2+((i>>1)&1),iz*2+(i>>2),size/2,cosmic)));cells.push({ix,iy,iz,p,children});}return cells;
}
function spatialLayout(size,n,cosmic){const ready=StellarLayouts.get(size,cosmic);if(ready&&n<=10)return ready;const cache=spatialLodCache[cosmic?1:0],key=size+':'+n;if(cache.key!==key){cache.key=key;cache.cells=buildSpatialLayout(size,n,cosmic);}return cache.cells;}
const spatialRenderPoint={},spatialRenderChild={};
function readSpatialPoint(data,k,out){out.x=data[k];out.y=data[k+1];out.z=data[k+2];out.density=data[k+3];out.brightness=data[k+4];out.seed=data[k+5];out.distance=data[k+6];out.amount=data[k+7];return out;}
const spatialViewCandidates=new WeakMap();
function spatialVisibleRows(layout,size,extent){
 let cached=spatialViewCandidates.get(layout);if(cached&&cached.width===vw&&cached.height===vh&&Math.abs(cached.yaw-viewYaw)<.07&&Math.abs(cached.pitch-viewPitch)<.07&&extent>cached.extent*.9&&extent<cached.extent*1.1)return cached.rows;
 const rows=[],packed=layout instanceof Float64Array,count=packed?layout.length/75:layout.length;
 for(let row=0;row<count;row++){const k=row*75,cell=packed?null:layout[row],x=((packed?layout[k]:cell.ix)+.5)*size,y=((packed?layout[k+1]:cell.iy)+.5)*size,z=((packed?layout[k+2]:cell.iz)+.5)*size,radius=size*.866026+Math.hypot(x,y,z)*.15+extent*.65;if(stellarBoxVisible(StellarSpace.settings.solarRadius+x,y,z,radius,extent))rows.push(row);}
 spatialViewCandidates.set(layout,{width:vw,height:vh,yaw:viewYaw,pitch:viewPitch,extent,rows});return rows;
}
function drawSpatialStars(extent,alpha,cosmic,coverage,localResolved=0){
 const lodExtent=cosmic?extent/Math.sqrt(1+(extent/(OBSERVABLE_RADIUS/6))**2):extent,level=Math.log2(Math.max(cosmic?1e6:4,lodExtent*(cosmic?.7:.3))),size=2**Math.ceil(level),mix=smoothStep(Math.ceil(level)-level),range=cosmic?Math.min(6*extent,OBSERVABLE_RADIUS):2.8*extent,n=Math.ceil(range/size),inherited=vctx.globalAlpha,u=game.state.s,reachable=u.horizonKnown?Math.min(OBSERVABLE_RADIUS,u.radius+game.frontierBeta()*PaperclipModel.remainingLight(u.years)):Infinity;
 const layout=spatialLayout(size,n,cosmic),packed=layout instanceof Float64Array,count=packed?layout.length/75:layout.length;
 for(const row of spatialVisibleRows(layout,size,extent)){const k=row*75,cell=packed?null:layout[row],ix=packed?layout[k]:cell.ix,iy=packed?layout[k+1]:cell.iy,iz=packed?layout[k+2]:cell.iz;if(ix<-n||ix>=n||iy<-n||iy>=n||iz<-n||iz>=n)continue;
  if(cosmic&&Math.hypot(Math.max(0,Math.abs(ix+.5)-.5),Math.max(0,Math.abs(iy+.5)-.5),Math.max(0,Math.abs(iz+.5)-.5))*size>range)continue;
  if(!stellarBoxVisible(StellarSpace.settings.solarRadius+(ix+.5)*size,(iy+.5)*size,(iz+.5)*size,size*.866026,extent))continue;
  const p=packed?readSpatialPoint(layout,k+3,spatialRenderPoint):cell.p;
  const distance=p.distance,edge=1-smoothStep((distance/range-.75)/.25);if(!edge||p.density<.012)continue;
  const density=p.amount,boundary=cosmic?(distance>reachable?.18:1)*(1-smoothStep((distance/OBSERVABLE_RADIUS-.65)/.35)):1;
  if(mix<.999)universeDot(p,extent,alpha*(1-mix)*edge*density*boundary*(1-localResolved*cosmicLocalWeight(p)),StellarSpace.settings.solarRadius,stellarCoverage(distance,coverage),cosmic?1.2:2.1,inherited);
  if(mix>.001)for(let i=0;i<8;i++){
   const q=packed?readSpatialPoint(layout,k+11+i*8,spatialRenderChild):cell.children[i],d=q.distance,fade=1-smoothStep((d/range-.75)/.25),amount=q.amount,bound=cosmic?(d>reachable?.18:1)*(1-smoothStep((d/OBSERVABLE_RADIUS-.65)/.35)):1;
   universeDot(q,extent,alpha*mix*fade*amount*bound*(1-localResolved*cosmicLocalWeight(q)),StellarSpace.settings.solarRadius,stellarCoverage(d,coverage),cosmic?1.2:2.1,inherited);
  }
 }
}
const stellarDiskCache=new Map();
function diskCell(ix,iy,size){const key=size+':'+ix+','+iy;let points=stellarDiskCache.get(key);if(points)return points;points=[];
 for(let i=0;i<14;i++){const seed=spatialSeed(ix,iy,i,Math.round(Math.log2(size))*7919),x=StellarSpace.settings.solarRadius+(ix+seeded(seed))*size,y=(iy+seeded(seed+1))*size,r=Math.hypot(x,y),z=stellarNormal(seed+2)*(140+340*r/50000),density=galaxyDensity(x,y,0);if(seeded(seed+4)>Math.min(1,density))continue;points.push({x,y,z,brightness:stellarLight(.25+.5*seeded(seed+5))});}
 if(stellarDiskCache.size>3000)stellarDiskCache.clear();stellarDiskCache.set(key,points);return points;
}
function drawLocalDisk(extent,alpha,coverage){const level=Math.log2(extent*.6),size=2**Math.ceil(level),mix=smoothStep(Math.ceil(level)-level),range=extent*2.8,n=Math.ceil(range/size),inherited=vctx.globalAlpha;
 for(let x=-n;x<n;x++)for(let y=-n;y<n;y++)for(let i=0;i<5;i++){const child=i>0,s=child?size/2:size,ix=child?x*2+((i-1)&1):x,iy=child?y*2+((i-1)>>1):y,weight=child?mix:1-mix;if(weight<.001)continue;for(const p of diskCell(ix,iy,s)){const distance=stellarDistance(p.x,p.y,p.z),edge=1-smoothStep((distance/range-.75)/.25);universeDot(p,extent,alpha*weight*edge,StellarSpace.settings.solarRadius,stellarCoverage(distance,coverage),2.1,inherited);}}
}
function drawUniformStars(extent,alpha,_centre,coverage=stellarCoverageModel()){const disk=smoothStep((Math.log10(extent)-2.65)/.6);if(disk<1)drawSpatialStars(extent,alpha*(1-disk),false,coverage);if(disk>0)drawLocalDisk(extent,alpha*disk,coverage);}
let galaxyFlightView={owner:null,active:false,start:0};
function drawGalaxyFlights(extent){
 const u=game.state.s;if(galaxyFlightView.owner!==u)galaxyFlightView={owner:u,active:u.intergalactic,start:visualTime-.8};
 if(u.intergalactic&&!galaxyFlightView.active){galaxyFlightView.active=true;galaxyFlightView.start=visualTime;}
 if(!u.intergalactic)return;const alpha=.38*smoothStep((visualTime-galaxyFlightView.start)/.8)*(1-smoothStep((Math.log10(extent)-6.45)/.85));if(alpha<.001)return;
 const centre=universeProject(StellarSpace.settings.solarRadius,0,0,extent),inherited=vctx.globalAlpha;vctx.globalAlpha=inherited*alpha;vctx.strokeStyle='rgb(215,205,173)';vctx.beginPath();
 for(const g of StellarSpace.nearbyGalaxies.slice(1,17)){const x=g.x-StellarSpace.settings.solarRadius,d=Math.hypot(x,g.y,g.z),start=Math.min(d*.95,u.galacticStartRadius),t=clamp((u.radius-start)/Math.max(1,d-start),0,1),ratio=Math.min(1,u.radius/d)*smoothStep(t),q=universeProject(StellarSpace.settings.solarRadius+x*ratio,g.y*ratio,g.z*ratio,extent);if(!q.visible)continue;
  if(stellarCollecting){const n=Math.max(1,Math.ceil(Math.hypot(q.x-centre.x,q.y-centre.y)/4)),distance=extent*5;for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n,m=(a+b)/2;stellarDrawQueue.push({line:true,x:centre.x+(q.x-centre.x)*a,y:centre.y+(q.y-centre.y)*a,toX:centre.x+(q.x-centre.x)*b,toY:centre.y+(q.y-centre.y)*b,depth:1/((1-m)/(distance+centre.depth)+m/(distance+q.depth))-distance,alpha:inherited*alpha});}}
  else{vctx.moveTo(centre.x,centre.y);vctx.lineTo(q.x,q.y);}
 }
 vctx.stroke();vctx.globalAlpha=inherited;
}
function drawStellarUniverse(){
 const coverage=stellarCoverageModel(),extent=stellarViewExtent(),nearBlend=smoothStep((Math.log10(extent)-1.08)/.4),diskBlend=smoothStep((Math.log10(extent)-3.55)/.75),webBlend=smoothStep((Math.log10(extent)-4.8)/.75),inherited=vctx.globalAlpha;
 StellarPixels.fieldFrame=null;StellarPixels.output=null;StellarPixels.directTarget=!capturePoints&&extent>1e6&&Math.log10(extent/1.7)<=7.35&&vctx===sceneContext?vctx:null;StellarLayouts.prepare(extent);
 if(nearBlend<1){vctx.globalAlpha=inherited*(1-nearBlend);drawNeighbourhood(extent);vctx.globalAlpha=inherited;}
 if(extent>1e6)CosmicParticles.prepare();
 stellarCollecting=true;
 try{
  drawGalaxyFlights(extent);
  if(nearBlend>0&&diskBlend<1)drawUniformStars(extent,nearBlend*(1-diskBlend),StellarSpace.settings.solarRadius,coverage);
  if(diskBlend>0)drawVolumeGalaxy(StellarSpace.nearbyGalaxies[0],extent,diskBlend,coverage,1);
  drawTransportIslands(extent);
  if(webBlend>0)drawVolumeCosmos(extent,webBlend,coverage);
 }finally{stellarCollecting=false;vctx.globalAlpha=inherited;flushStellarPoints();CosmicLines.flushForeground();}
}
const galaxyVolumeSamples=new WeakMap();
function drawVolumeGalaxy(galaxy,extent,alpha,model=stellarCoverageModel(),detail=0){
 const pixels=galaxy.r/extent*Math.min(vw*.4,vh*.47),volume=smoothStep((pixels-.25)/1.5),distance=stellarDistance(galaxy.x,galaxy.y,galaxy.z),t=clamp((game.state.s.radius-distance+galaxy.r)/(2*galaxy.r),0,1),coverage=t*t*(3-2*t),inherited=vctx.globalAlpha;
 if(volume<1)universeDot({...galaxy,brightness:.98*(pixels/(pixels+.1))**.65},extent,alpha*(1-volume),StellarSpace.settings.solarRadius,coverage,1,inherited);
 if(volume<=0)return;
 let samples=galaxyVolumeSamples.get(galaxy);if(!samples){const ca=Math.cos(galaxy.angle),sa=Math.sin(galaxy.angle),scale=galaxy.r/StellarSpace.settings.diskRadius;samples=galacticParticles.map(p=>{const y=p.y*ca-p.z*sa,z=p.y*sa+p.z*ca,point={x:galaxy.x+p.x*scale,y:galaxy.y+y*scale,z:galaxy.z+z*scale,brightness:p.brightness,size:p.size};point.distance=stellarDistance(point.x,point.y,point.z);return point;});galaxyVolumeSamples.set(galaxy,samples);}
 let projected=samples.projected;const stride=detail?1:8;if(!projected||projected.yaw!==viewYaw||projected.pitch!==viewPitch||projected.stride!==stride){const data=projected?.data||new Float64Array(samples.length*3),c=stellarProjection;universeProject(galaxy.x,galaxy.y,galaxy.z,extent);for(let i=0;i<samples.length;i+=stride){const p=samples[i],x=p.x-StellarSpace.settings.solarRadius,xx=x*c.ca-p.y*c.sa,yy=x*c.sa+p.y*c.ca;data[i*3]=xx;data[i*3+1]=yy*c.se-p.z*c.ce;data[i*3+2]=yy*c.ce+p.z*c.se;}projected=samples.projected={yaw:viewYaw,pitch:viewPitch,stride,data};}
 const dotScale=(pixels/(pixels+3))**.7,focal=Math.min(vw*.4,vh*.47)*5,eye=extent*5,gain=alpha*volume,q=stellarPoint;for(let i=0;i<samples.length;i+=stride){const p=samples[i],k=i*3,depth=projected.data[k+2],perspective=focal/(eye+depth);q.x=vw*.5+projected.data[k]*perspective;q.y=vh*.49+projected.data[k+1]*perspective;q.depth=depth;q.visible=eye+depth>extent*.2&&q.x>-8&&q.x<vw+8&&q.y>-8&&q.y<vh+8;universeDot(p,extent,gain,StellarSpace.settings.solarRadius,stellarCoverage(p.distance,model),p.size*dotScale,inherited,q);}
}
function drawVolumeCosmos(extent,alpha=1,coverage=stellarCoverageModel()){
 for(const g of StellarSpace.nearbyGalaxies.slice(1))drawVolumeGalaxy(g,extent,alpha,coverage);
 const cosmicAlpha=smoothStep((Math.log10(extent)-5.5)/.8),pixels=COSMIC_WEB_UNIT*.35/extent*Math.min(vw*.4,vh*.47),resolved=smoothStep((Math.log10(extent)-6.6)/.65)*smoothStep((pixels-.5)/4),distant=smoothStep((Math.log10(extent/1.7)-7.35)/.6),fine=resolved*(1-distant);
 if(cosmicAlpha>0&&resolved<1&&distant<1)drawSpatialStars(extent,alpha*cosmicAlpha*(1-distant),true,coverage,resolved);if(distant>0)drawDistantCosmicWeb(extent,alpha*distant,coverage,fine);if(fine>0)drawResolvedCosmicWeb(extent,alpha*fine,coverage);
}

function transportDissolve(){return smoothStep((game.state.s?.transportProgress||0)/.08);}
function transportSourceOpacity(distance){const u=game.state.s;return u?.transportProgress&&distance<=u.radius?1-transportDissolve():1;}
let transportCloud={owner:null,points:null};
function drawTransportIslands(extent){
 const u=game.state.s;if(!(u.transportProgress>0))return;
 if(transportCloud.owner!==u)transportCloud={owner:u,points:null};
 if(!transportCloud.points){const source=CosmicLines.transportSample(u.radius);if(!source)return;const centres=[{x:StellarSpace.settings.solarRadius,y:0,z:0,scale:.42}];
  for(const [radius,count,width]of [[.48,3,.27],[.76,8,.16],[.94,20,.10]])for(let i=0;i<count;i++){const z=1-2*(i+.5)/count,angle=i*2.3999632297+radius*13,ring=Math.sqrt(1-z*z);centres.push({x:StellarSpace.settings.solarRadius+u.radius*radius*ring*Math.cos(angle),y:u.radius*radius*ring*Math.sin(angle),z:u.radius*radius*z,scale:width});}
  transportCloud.points=source.map((p,i)=>{let best=centres[0],score=Infinity;for(const c of centres){const d=((p.x-c.x)**2+(p.y-c.y)**2+(p.z-c.z)**2)/(c.scale*c.scale);if(d<score){score=d;best=c;}}const size=u.radius*best.scale*.055;return {...p,toX:best.x+stellarNormal(i*17+1)*size,toY:best.y+stellarNormal(i*17+3)*size,toZ:best.z+stellarNormal(i*17+5)*size,phase:seeded(i*31)*6.28};});
 }
 const progress=smoothStep(u.transportProgress),alpha=transportDissolve(),scatter=Math.sin(Math.PI*progress)*u.radius*.008;
 for(const p of transportCloud.points){let x=p.x+(p.toX-p.x)*progress+Math.sin(p.phase)*scatter,y=p.y+(p.toY-p.y)*progress+Math.cos(p.phase)*scatter,z=p.z+(p.toZ-p.z)*progress;const distance=Math.hypot(x-StellarSpace.settings.solarRadius,y,z);if(distance>u.radius){const scale=u.radius/distance;x=StellarSpace.settings.solarRadius+(x-StellarSpace.settings.solarRadius)*scale;y*=scale;z*=scale;}const q=universeProject(x,y,z,extent,StellarSpace.settings.solarRadius,stellarPoint);if(!q.visible)continue;const i=stellarDrawQueue.length,d=stellarDrawPool[i]||(stellarDrawPool[i]={});Object.assign(d,{fieldDistance:-1,x:q.x,y:q.y,depth:q.depth,brightness:Math.min(.85,(.25+p.brightness)*alpha),size:1.1,developed:1});stellarDrawQueue.push(d);}
}
