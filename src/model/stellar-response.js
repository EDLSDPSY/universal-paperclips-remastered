 // L 和 H 是原始恒星，E 是碰撞产物，F 是采集到的轻元素。设备总量 D 包含成品 C。
 // 活跃区的原料逐渐用完时，把相应比例的设备和黑洞转入内部储备。
 const responseSize=30,responseCumulative=[4,5,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29],responsePhysical=[0,1,2,3,6,7,8],responseFields=['light','heavy','ejecta','clips',null,null,'collectedLight','devices','blackHole'];
 const currentSteps=new WeakMap(),currentStartupWindows=new Map(),currentAllIndices=Array.from({length:responseSize},(_,i)=>i);
 let responseKernel=null;
 function responseContext(){const p={pD:equipmentSpecific(),fuel:launchQuote().fuel*probeCopies()*equipmentSpecific()/(SPACE.meanLuminosity*C.sunPower*STELLAR.capture),growth:probeGrowth()*Math.LN2/(C.year*C.day),charge:S.s.storageTarget,k:has('kilonova')?S.s.engineering.kilonovaShare:0,b:S.s.engineering.collapseShare,n:has('nucleosynthesis'),a:has('accretion'),hole:STELLAR.blackHoleWkg*(has('blackHoleTowing')?1:STELLAR.companions),eff:accretionEfficiency(),capture:has('neutrinoCapture'),commissionStart:S.s.engineering.commissionStart,clip:clipFraction()/(1+clipFraction()),seed:S.s.recoverySeedKg||0,compute:Math.max(STELLAR.computeEquivalentWkg,S.s.originPower/Math.max(1,S.s.originIndustry+S.s.originClips))*surfaceComputeShare()/computingSpecificEnergy()*C.researchShare*(has('language')?benefit('language','算力倍数'):1)*(has('learning')?benefit('learning','算力倍数'):1)*1.380649e-23*(has('cold')?1:10)*Math.LN2};p.key=JSON.stringify(Object.values(p));return p;}
 function responseConfig(r,context){return {...context,...responseCommission(context),lum:r.luminosity/Math.max(1,r.initialLight),target:r.luminosity*STELLAR.capture/context.pD/(r.unit||Math.max(STELLAR.nucleonKg,engineeringMatter(r)+r.devices+r.blackHole)),covered:r.covered,retire:!!r.fluid&&!r.core,core:!!r.core,massFloor:STELLAR.nucleonKg/(r.unit||Math.max(STELLAR.nucleonKg,engineeringMatter(r)+r.devices+r.blackHole)),minimumD:context.seed*Math.max(0,r.devices-(r.clips||0))/Math.max(1,S.s.industry+S.s.drifterStock.industry-S.s.wreck)/(r.unit||Math.max(STELLAR.nucleonKg,engineeringMatter(r)+r.devices+r.blackHole)),fuel:context.fuel};}
 function responseCommission(context,offset=0){return context.commissionStart!==undefined&&S.s.years<context.commissionStart+STELLAR.commissionYears?{commissionOffset:(S.s.years-context.commissionStart)/STELLAR.commissionYears+offset}:{};}
 function responseCommissionFraction(p,age){if(p.commissionOffset===undefined)return 1;const x=p.commissionOffset+age/STELLAR.commissionYears;return x<=0?0:x>=1?1:x*x*(3-2*x);}
 function responseKernelContext(p){
  if(responseKernel===null){
   const env={abort(){throw Error('恒星方程内核执行失败');}};let api;
   if(STELLAR_RESPONSE_MODULE)try{api=new WebAssembly.Instance(STELLAR_RESPONSE_MODULE,{env}).exports;}catch(error){console.warn('恒星方程 WebAssembly 初始化失败，改用 JavaScript。',error);}
   api??=createStellarResponseJS(env);
   responseKernel={api,views:Array.from({length:8},(_,i)=>new Float64Array(api.memory.buffer,api.pointer(i),i===1?22:responseSize)),parameters:new WeakMap(),p:null};
  }
  const n=responseKernel;if(n.p!==p){let values=n.parameters.get(p);if(!values){values=Float64Array.of(p.pD,p.fuel,p.growth,p.charge,p.k,p.b,+p.n,+p.a,p.hole,p.eff,+p.capture,p.clip,p.compute,p.lum,p.target,+p.covered,p.minimumD||0,p.commissionOffset||0,+(p.commissionOffset!==undefined),1e-4,+p.retire,+p.core);n.parameters.set(p,values);}n.views[1].set(values);if(p.source)n.views[7].set(p.source);else n.views[7].fill(0);n.api.configure();n.p=p;}return n;
 }
 function responseKernelStep(v,p,age,h){const n=responseKernelContext(p);n.views[0].set(v);const error=p.stiff?(p.commissionOffset===undefined?n.api.exponentialStep(age,h):n.api.step(age,h)):n.api.explicitStep(age,h);return {error,h:p.stiff&&p.commissionOffset===undefined?n.api.exponentialDuration():h,out:n.views[2],f:n.views[4],endRate:n.views[5]};}
 function currentState(r){const scale=r.unit||(r.unit=Math.max(STELLAR.nucleonKg,engineeringMatter(r)+r.devices+r.blackHole)),v=new Float64Array(responseSize);for(let i=0;i<9;i++)if(responseFields[i])v[i]=(r[responseFields[i]]||0)/scale;return {scale,v};}
 function currentIntegrate(initial,p,duration,hint=duration,onStep=null){p={...p,stiff:duration*p.pD*(C.year*C.day)/STELLAR.liftingJkg>.9};const v=Float64Array.from(initial),totals=new Float64Array(responseSize);let age=0,h=Math.min(duration,hint),attempts=0;
  while(age<duration){if(p.retire&&v[0]+v[1]+v[2]+v[6]<(p.massFloor||0)){v[27]+=v[7];v[28]+=v[3];v[29]+=v[8];v[3]=v[7]=v[8]=0;}if(!p.source?.some(x=>x>0)&&v[0]+v[1]+v[2]+v[6]+v[7]+v[8]<(p.massFloor||0)){break;}if(++attempts>5000)throw Error('恒星演化未能收敛');
   if(!p.covered&&v[7]>=p.target*(1-1e-10))p={...p,covered:true};
   if(!p.covered&&v[7]>0&&p.target-v[7]<v[1]){const unit=SPACE.constructionEnergy+p.fuel*STELLAR.liftingJkg,growth=Math.min(p.growth,(1-p.charge)*(p.pD-p.compute)/unit)*(C.year*C.day);if(growth>0){const build=Math.log(p.target/v[7])/growth,dt=Math.min(build,duration-age),oldD=v[7],gain=dt===build?p.target-oldD:oldD*Math.expm1(growth*dt),Dtime=gain/growth;
    v[0]=stockRemainder(v[0],gain*p.fuel);v[1]=stockRemainder(v[1],gain);v[7]+=gain;v[3]+=gain*p.clip;v[18]+=gain;v[24]+=gain*p.fuel;v[17]+=p.pD*Dtime*(C.year*C.day)/(C.c*C.c);v[5]+=p.compute*(1-p.charge)*((1-p.clip)*Dtime+(p.clip*oldD-(v[3]-gain*p.clip))*dt)*(C.year*C.day)/(C.c*C.c);v[21]+=unit*gain/(C.c*C.c);age+=dt;if(dt===build)p={...p,covered:true};continue;}}
   for(const i of responseCumulative){totals[i]+=v[i];v[i]=0;}const preferred=2**(Math.round(Math.log2(h)*2)*.5);h=Math.min(preferred,duration-age);const n=responseKernelStep(v,p,age,h),limited=n.h<h*.999;h=n.h;let motion=0;for(let i=0;i<responseSize;i++)motion=Math.max(motion,Math.abs(n.f[i]));if(motion*(duration-age)<(p.massFloor||0)){break;}if(n.error<0||n.error>1){h*=n.error<0?.4:Math.max(.1,.8/Math.cbrt(n.error));continue;}if(onStep){const out=Float64Array.from(n.out),f=Float64Array.from(n.f),g=Float64Array.from(n.endRate),dense=currentDense(v,out,f,g,p,age,h);if(dense.error>1){h*=Math.max(.1,.8/Math.cbrt(dense.error));continue;}onStep(age,age+h,v,out,f,g,dense.coefficients,totals);v.set(out);}else v.set(n.out);age+=h;h=age>=duration?Math.max(preferred,h):limited?Math.min(preferred,duration-age):h*Math.min(4,n.error>0?.85/Math.cbrt(n.error):4);
  }for(const i of responseCumulative)v[i]+=totals[i];return {value:v,p,h,attempts};
 }
 function currentAdvance(r,context,years){if(r.newborn)return flowConstruction(r,context,years);const {scale,v}=currentState(r),cached=currentSteps.get(r);let p;if(cached&&cached.p.commissionOffset===undefined&&cached.context===context.key&&cached.p.covered===r.covered&&!context.seed&&Math.abs(cached.lum-r.luminosity/Math.max(1,r.initialLight))<=Math.abs(cached.lum)*1e-14&&Math.abs(cached.target-r.luminosity*STELLAR.capture/context.pD/scale)<=Math.abs(cached.target)*1e-14)p=cached.p;else {p=responseConfig(r,context);p.target=r.luminosity*STELLAR.capture/context.pD/scale;}
  if(cached&&cached.time===S.s.years&&cached.years===years&&cached.context===context.key&&cached.scale===scale){let match=true;for(const i of [0,1,2,3,6,7,8])if(Math.abs(v[i]-cached.initial[i])>Math.max(1e-100,v[i],cached.initial[i])*1e-12){match=false;break;}if(match){currentCorrect(v,cached.initial,cached.value);cached.initial.set(v);return cached;}}
  const result=currentBootstrap(v,p,years,context)||currentIntegrate(v,p,years,years),m={...result,initial:v,scale,years,time:S.s.years,context:context.key,lum:p.lum,target:p.target};currentSteps.set(r,m);return m;
 }
 function currentRate(m,out){if(m.sourceRate){out.set(m.sourceRate);return;}if(m.children){out.fill(0);const context=responseContext();for(const r of m.children){const {scale,v}=currentState(r),p=responseConfig(r,context),n=responseKernelContext(p);n.views[0].set(v);n.api.evaluateRates(m.years);for(let i=0;i<responseSize;i++)out[i]+=n.views[4][i]*scale/m.scale;}return;}const n=responseKernelContext(m.p);n.views[0].set(m.value);n.api.evaluateRates(m.years);out.set(n.views[4]);}
 function responseEnergy(seconds){const context=responseContext(),years=seconds/(C.year*C.day),rows=S.s.engineering.cohorts.map(r=>({...r})),prepared=flowPrepare(context,years,rows);let energy=0;for(const r of rows){const m=prepared.get(r)||currentAdvance(r,context,years),v=m.value;energy+=m.scale*(v[17]+v[14]*m.p.eff+v[11]*STELLAR.fusionLoss*STELLAR.capture)*C.c*C.c;}return energy*productiveShare();}
 function prepareSpaceSimulation(){}
 function currentTransitionInit(){const u=S.s,e=u.engineering;if(!u.automatic||e.continuousFlow)return;e.continuousFlow=true;const active=u.years<(u.model?.at||0)+(u.model?.blendYears||20);for(const r of e.cohorts){delete r.response;delete r.depositedEjecta;if(active){r.discreteWeight=1;r.fluid=false;}}}
 function currentCompact(time=S.s.years){
  if(!S.s.automatic)return;currentTransitionInit();
  const groups=new Map(),kept=[],keys=['unit','count','light','heavy','ejecta','clips','propellant','initialLight','blackHole','devices','luminosity','collectedLight'],scaled=[...keys,'workDevices','power','stepWorkJ','instantNormalPower','instantWorkPower','stepBaseWeight'],rows=[],progress=clamp((time-(S.s.model?.at||0))/(S.s.model?.blendYears||20),0,1),remaining=1-progress*progress*(3-2*progress);
  for(const r of S.s.engineering.cohorts){
   if(r.discreteWeight>0){if(!r.unit)currentState(r);
    const ratio=Math.min(1,remaining/r.discreteWeight),moved=1-ratio;
    if(moved>0){const part={...r};delete part.discreteWeight;for(const k of scaled){part[k]=(r[k]||0)*moved;r[k]=(r[k]||0)*ratio;}rows.push(part);currentSteps.delete(r);}
    r.discreteWeight=remaining;if(remaining>0)kept.push(r);
   }else rows.push(r);
  }
  for(const r of rows){
   if(!r.unit)currentState(r);delete r.response;delete r.depositedEjecta;
   const target=r.luminosity*STELLAR.capture/equipmentSpecific(),progress=Math.max(-48,Math.min(0,Math.log(Math.max(1e-100,r.devices/Math.max(1e-100,target))))),key=r.core?'core':r.covered?'active':'build:'+Math.floor(progress/4);
   const fluid=!r.core;if(r.fluid!==fluid){r.fluid=fluid;currentSteps.delete(r);}const a=groups.get(key);if(!a){groups.set(key,r);continue;}
   const stellar=a.light*a.luminosity/Math.max(1,a.initialLight)+r.light*r.luminosity/Math.max(1,r.initialLight),count=a.count+r.count;a.at=(a.at*a.count+r.at*r.count)/count;a.radius=(a.radius*a.count+r.radius*r.count)/count;
   for(const k of keys)a[k]=(a[k]||0)+(r[k]||0);if(a.covered)a.luminosity=a.light>0?stellar*a.initialLight/a.light:0;currentSteps.delete(a);
  }
  S.s.engineering.cohorts=[...kept,...groups.values()];
 }
 function currentCore(devices,clips,blackHole){return {core:true,covered:true,at:S.s.years,span:0,radius:S.s.radius,count:1,unit:Math.max(STELLAR.nucleonKg,devices+blackHole),devices,clips,blackHole,light:0,heavy:0,ejecta:0,collectedLight:0,initialLight:0,luminosity:0,propellant:0,workDevices:0,power:0};}
 function currentRecoveryRegion(r,mass){
  if(!r.core)return r;
  const devices=Math.min(mass,Math.max(0,r.devices-r.clips-(S.s.recoverySeedKg||0))),blackHole=Math.min(r.blackHole,devices*equipmentSpecific()/STELLAR.blackHoleWkg),row=currentCore(devices,0,blackHole);
  r.devices-=devices;r.blackHole-=blackHole;row.core=false;row.fluid=true;S.s.engineering.cohorts.push(row);currentSteps.delete(r);return row;
 }
 function currentBootstrap(initial,p,years,context){
  if(p.covered||p.commissionOffset!==undefined||!(initial[7]>0)||!(p.target>initial[7]))return null;
  const growth=Math.min(p.growth,(1-p.charge)*(p.pD-p.compute)/(SPACE.constructionEnergy+p.fuel*STELLAR.liftingJkg))*(C.year*C.day),build=growth>0?Math.log(p.target/initial[7])/growth:Infinity;
  if(!(years>build)||p.target-initial[7]>=initial[1])return null;
  const prefix=currentIntegrate(initial,p,build),state=Float64Array.from(prefix.value),options={...prefix.p,covered:true};
  for(const i of responseCumulative)state[i]=0;
  const duration=years-build,width=STELLAR.liftingJkg/(p.pD*C.year*C.day),begin=Math.floor(duration/width)*width;
  const key=context.key+':'+begin+':'+JSON.stringify([...state.slice(0,9),p.lum,p.target,+p.retire].map(x=>+x.toPrecision(10)));
  let curve=currentStartupWindows.get(key);
  if(!curve){
   const first=currentIntegrate(state,options,begin).value;
   curve={initial:state,p:options,options,build:0,times:[begin],states:[first],curves:[],h:width,context:context.key};
   currentCurveExtend(curve,begin+width);currentStartupWindows.set(key,curve);
   if(currentStartupWindows.size>32)currentStartupWindows.delete(currentStartupWindows.keys().next().value);
   
  }
  const value=currentCurveValue(curve,duration,true);currentCorrect(state,curve.initial,value);
  for(const i of responseCumulative)value[i]+=prefix.value[i];
  return {value,p:options,h:width,attempts:0};
 }
 function flowChild(r,value,weight){
  const child={...r,covered:true,span:0,unit:r.unit*weight,fluid:true};delete child.newborn;
  for(const k of ['count','initialLight','luminosity'])child[k]=(r[k]||0)*weight;
  for(let i=0;i<9;i++)if(responseFields[i])child[responseFields[i]]=value[i]*child.unit;
  child.propellant=((r.propellant||0)+value[24]*r.unit)*weight;child.power=0;return child;
 }
 function flowConstruction(r,context,years){
  const {scale,v}=currentState(r),p=responseConfig(r,context),growth=Math.min(p.growth,(1-p.charge)*(p.pD-p.compute)/(SPACE.constructionEnergy+p.fuel*STELLAR.liftingJkg))*(C.year*C.day),build=growth>0&&v[7]>0?Math.max(0,Math.log(p.target/v[7])/growth):Infinity;
  if(!(build<years)||p.target-v[7]>=v[1])return r.newborn?(growth>0?currentConstructionSource(r,context,years,p,growth):currentSourceQuadrature(r,context,years)):currentAdvance(r,context,years);
  const prefix=currentIntegrate(v,p,build),value=new Float64Array(responseSize),children=[],sourceRate=new Float64Array(responseSize);
  if(!r.newborn)return {...prefix,initial:v,scale,years,children,sourceRate,incoming:{row:flowChild(r,prefix.value,1),at:build,span:0}};
  const young=build/years,mature=1-young;
  if(young>0){const part={...r,unit:scale*young};for(const k of ['count','light','heavy','ejecta','clips','propellant','initialLight','blackHole','devices','luminosity','collectedLight'])part[k]=(r[k]||0)*young;
   const q=currentConstructionSource(part,context,build,p,growth);children.push(...q.children);for(let i=0;i<responseSize;i++){value[i]=q.value[i]*young;sourceRate[i]=q.sourceRate[i]*young;}}
  for(let i=0;i<responseSize;i++)value[i]+=prefix.value[i]*mature;
  return {initial:v,value,p,scale,years,children,sourceRate,incoming:{row:flowChild(r,prefix.value,mature),at:build,span:years-build}};
 }
 function flowPrepare(context,years,rows=S.s.engineering.cohorts){
  const prepared=new Map(),incoming=[];
  for(const r of rows){if(r.discreteWeight>0||r.core||r.covered&&!r.newborn)continue;const m=flowConstruction(r,context,years);prepared.set(r,m);if(m.incoming)incoming.push(m.incoming);}
  if(!incoming.length)return prepared;
  let r=rows.find(r=>r.covered&&r.fluid&&!r.core&&!r.discreteWeight&&!r.newborn);
  if(!r){r=currentCore(0,0,0);r.core=false;r.fluid=true;rows.push(r);}
  const scale=r.unit+incoming.reduce((n,q)=>n+q.row.unit,0),v=new Float64Array(responseSize);for(let i=0;i<9;i++)if(responseFields[i])v[i]=(r[responseFields[i]]||0)/scale;
  let light=r.light,stellar=r.light*r.luminosity/Math.max(1,r.initialLight),incomingB=0;
  for(const q of incoming){const c=q.row;light+=c.light;stellar+=c.light*c.luminosity/Math.max(1,c.initialLight);r.initialLight+=c.initialLight;r.count+=c.count;r.propellant=(r.propellant||0)+(c.propellant||0);incomingB+=c.blackHole;}
  r.luminosity=light>0?stellar*r.initialLight/light:0;r.unit=scale;
  const p=responseConfig(r,context),initial=Float64Array.from(v),events=[0,...incoming.map(q=>q.at),years].sort((a,b)=>a-b);let state=v,options=p;
  for(let j=0;j<events.length-1;j++){
   const at=events[j];if(j>0&&at===events[j-1])continue;
   for(const q of incoming)if(q.span===0&&q.at===at)for(let i=0;i<9;i++)if(responseFields[i])state[i]+=(q.row[responseFields[i]]||0)/scale;
   let next=j+1;while(next<events.length&&events[next]===at)next++;if(next===events.length)break;const until=events[next],source=new Float64Array(responseSize);
   for(const q of incoming)if(q.span>0&&q.at<=at)for(let i=0;i<9;i++)if(responseFields[i])source[i]+=(q.row[responseFields[i]]||0)/(q.span*scale);
   const result=currentIntegrate(state,{...p,source,...responseCommission(context,at/STELLAR.commissionYears)},until-at);state=result.value;options=result.p;
  }
  prepared.set(r,{initial,value:state,p:options,scale,years,incomingB});currentSteps.delete(r);return prepared;
 }
 function currentConstructionSource(r,context,years,p,growth){
  const result=currentSourceQuadrature(r,context,years),v=result.initial,z=growth*years,gain=v[7]*(Math.abs(z)<1e-3?z*(.5+z*(1/6+z/24)):Math.expm1(z)/z-1),deviceTime=gain/growth,oldGain=result.value[7]-v[7],ratio=oldGain>0?gain/oldGain:1;
  for(const c of result.children){const base=v[7]*c.unit,delta=(c.devices-base)*(ratio-1);c.devices+=delta;c.clips+=delta*p.clip;c.heavy-=delta;c.light-=delta*p.fuel;c.propellant+=delta*p.fuel;}
  const mean=Float64Array.from(v),year=C.year*C.day,cc=C.c*C.c,unit=SPACE.constructionEnergy+p.fuel*STELLAR.liftingJkg;
  mean[0]-=gain*p.fuel;mean[1]-=gain;mean[3]+=gain*p.clip;mean[7]+=gain;mean[18]=gain;mean[24]=gain*p.fuel;mean[17]=p.pD*deviceTime*year/cc;mean[5]=p.compute*(1-p.charge)*((1-p.clip)*deviceTime+(p.clip*v[7]-v[3])*years*.5)*year/cc;mean[21]=unit*gain/cc;
  result.value=mean;const rate=result.sourceRate=new Float64Array(responseSize);rate[17]=p.pD*mean[7]*year/cc;rate[5]=p.compute*(1-p.charge)*(mean[7]-mean[3])*year/cc;rate[18]=growth*mean[7];rate[24]=rate[18]*p.fuel;rate[21]=unit*rate[18]/cc;
  return result;
 }
 function currentSourceQuadrature(r,context,years){
  const {scale,v}=currentState(r),p=responseConfig(r,context),commission=responseCommissionFraction(p,years*.5);p.target=r.luminosity*STELLAR.capture/context.pD/scale;p.k*=commission;delete p.commissionOffset;
  const growth=Math.min(p.growth,(1-p.charge)*(p.pD-p.compute)/(SPACE.constructionEnergy+p.fuel*STELLAR.liftingJkg))*(C.year*C.day),build=growth>0&&v[7]>0?Math.max(0,Math.log(p.target/v[7])/growth):Infinity,endBuild=Math.min(years,build),bounds=[0];
  if(endBuild>0){const count=Number.isFinite(build)?Math.max(1,Math.ceil(endBuild*growth/8)):1;for(let i=1;i<=count;i++)bounds.push(endBuild*i/count);}
  if(years>build){const tau=STELLAR.liftingJkg/(p.pD*(C.year*C.day));let end=Math.min(years,build+tau);while(end<years){bounds.push(end);end=Math.min(years,build+(end-build)*2);}bounds.push(years);}
  const value=new Float64Array(responseSize),children=[];let state=v,previous=0,options=p,h=years;
  for(let j=1;j<bounds.length;j++){const half=(bounds[j]-bounds[j-1])*.5,mid=(bounds[j]+bounds[j-1])*.5;for(const [x,w]of [[-.7745966692414834,5/9],[0,8/9],[.7745966692414834,5/9]]){
   const age=mid+x*half,weight=w*half/years,result=currentIntegrate(state,options,age-previous,h);state=result.value;options=result.p;h=result.h;previous=age;for(let i=0;i<responseSize;i++)value[i]+=state[i]*weight;
   const child={...r,at:S.s.years+years-age,covered:options.covered,span:0,unit:scale*weight};delete child.newborn;for(const key of ['count','initialLight','luminosity'])child[key]*=weight;for(let i=0;i<9;i++)if(responseFields[i])child[responseFields[i]]=state[i]*scale*weight;child.propellant=((r.propellant||0)+state[24]*scale)*weight;child.power=0;children.push(child);
  }}
  return {initial:v,value,p,scale,years,children,context:context.key};
 }
 function responseCurve(a,b,fa,fb,h){
  const curve=new Float64Array(responseSize*3);let blend=1;
  function positive(value,line){if(value<0)blend=Math.min(blend,line/(line-value));}
  for(let i=0;i<responseSize;i++){const d=b[i]-a[i],u=h*fa[i],v=h*fb[i];curve[i*3]=u;curve[i*3+1]=3*d-2*u-v;curve[i*3+2]=-2*d+u+v;if(responsePhysical.includes(i)){positive(a[i]+u/3,a[i]+d/3);positive(b[i]-v/3,a[i]+d*2/3);}}
  for(const i of responseCumulative){const d=b[i]-a[i],u=h*fa[i],v=h*fb[i];positive(u/3,d/3);positive(d-(u+v)/3,d/3);positive(v/3,d/3);}
  for(const x of [1/3,2/3]){const sign=x===1/3?1:-1,v=(x===1/3?a:b),f=(x===1/3?fa:fb),line=(a[7]-a[3])*(1-x)+(b[7]-b[3])*x;positive(v[7]-v[3]+sign*h*(f[7]-f[3])/3,line);}
  if(blend<1)for(let i=0;i<responseSize;i++){const d=b[i]-a[i];curve[i*3]=d+(curve[i*3]-d)*blend;curve[i*3+1]*=blend;curve[i*3+2]*=blend;}return curve;
 }
 function currentCurveExtend(curve,age){if(age<=curve.times.at(-1))return;const begin=curve.times.at(-1),duration=age-begin,result=currentIntegrate(curve.states.at(-1),curve.options,duration,curve.h,(a,b,v,w,f,g,coefficients,prefix)=>{curve.curves.push(coefficients);curve.times.push(begin+b);const value=Float64Array.from(w);for(const i of responseCumulative)value[i]+=prefix[i];curve.states.push(value);});curve.h=result.h;}
 function currentCurveIndex(curve,age){let lo=0,hi=curve.times.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(curve.times[mid]<=age)lo=mid;else hi=mid;}return lo;}
 function currentCurveValue(curve,age,full=false){if(age<=curve.build)return currentIntegrate(curve.initial,curve.p,age).value;currentCurveExtend(curve,age);const j=currentCurveIndex(curve,age),a=curve.times[j],b=curve.times[j+1],x=(age-a)/(b-a),z=1-x,v=curve.states[j],w=curve.states[j+1],c=curve.curves[j],out=new Float64Array(responseSize);for(const i of full?currentAllIndices:responsePhysical){const k=i*3,p=Math.max(0,v[i]+c[k]/3),q=Math.max(0,w[i]-(c[k]+2*c[k+1]+3*c[k+2])/3);out[i]=z*z*z*v[i]+3*z*x*(z*p+x*q)+x*x*x*w[i];}return out;}
 function currentCorrect(value,before,after){let balance=0,index=0;for(const i of responsePhysical){const old=after[i],next=before[i]>0?old*(value[i]/before[i]):old;after[i]=next;if(i!==3){balance+=value[i]-before[i]-(next-old);if(after[i]>after[index])index=i;}}if(after[27]>after[index])index=27;if(after[29]>after[index])index=29;after[index]+=balance;}
 function currentDense(v,w,f,g,p,age,h){const coefficients=responseCurve(v,w,f,g,h),n=responseKernelContext(p),state=n.views[0];let error=0;for(const x of [.25,.75]){for(let i=0;i<responseSize;i++){const k=i*3;state[i]=Math.max(0,v[i]+x*(coefficients[k]+x*(coefficients[k+1]+x*coefficients[k+2])));}n.api.evaluateRates(age+x*h);for(const i of responsePhysical){const k=i*3,derivative=coefficients[k]+x*(2*coefficients[k+1]+3*x*coefficients[k+2]),residual=derivative-h*n.views[4][i];error=Math.max(error,Math.abs(residual)/Math.max(1e-30,Math.max(v[7],w[7])*1e-14,Math.abs(v[i]),Math.abs(w[i]))/1e-5);}}return {error,coefficients};}
 function currentBookkeep(light,heavy){const u=S.s,b=u.drifterStock,share=productiveShare(),clip=heavy*clipFraction()/(1+clipFraction()),device=heavy-clip,ownHeld=u.probe+(u.recoverySeedKg||0),enemyHeld=b.probe;const partition=(own,enemy,gain)=>own+enemy+gain>0?(own+gain*share)/(own+enemy+gain):share,lf=partition(u.lightKg,b.light,light),cf=partition(S.clipsKg,b.clips,clip),df=partition(Math.max(0,u.industry-u.wreck-ownHeld),Math.max(0,b.industry-enemyHeld),device);let L=0,Cc=0,I=0;for(const r of u.engineering.cohorts){L+=(r.collectedLight||0)+(r.propellant||0);Cc+=r.clips||0;I+=Math.max(0,r.devices-(r.clips||0));}const free=Math.max(0,I-(u.recoverySeedKg||0));u.lightKg=L*lf;b.light=L*(1-lf);S.clipsKg=Cc*cf;b.clips=Cc*(1-cf);u.industry=free*df+ownHeld+u.wreck;b.industry=free*(1-df)+enemyHeld;u.gathered+=light+heavy;u.stepClipKg+=clip*share;u.harvestedEquipment+=device;u.harvestedClips+=clip;if(clip>0)clipFlow=true;}
 function engineeringContinuum(seconds){
  engineeringSyncStock();const u=S.s,e=u.engineering,share=productiveShare(),end=u.years+seconds/(C.year*C.day),actual=Math.max(0,u.industry+S.clipsKg-u.wreck-u.probe)+Math.max(0,u.drifterStock.industry+u.drifterStock.clips-u.drifterStock.probe),total=e.cohorts.reduce((n,r)=>n+r.devices,0);let star=0,acc=0,nuc=0,spent=0,standby=0,computed=0,metalRate=0,holeRate=0,instantBackup=0,normalAcc=0,normalInstant=0,instant=[0,0,0];let gainedLight=0,gainedHeavy=0,spentLight=0,spentClips=0,spentDevices=0,newHoles=0,radiated=0,fusionLost=0,newMetal=0;const context=responseContext(),prepared=flowPrepare(context,seconds/(C.year*C.day));const d=new Float64Array(responseSize),rate=new Float64Array(responseSize);
  let retiredD=0,retiredC=0,retiredB=0;const nextRows=[];for(const r of e.cohorts){r.stepBaseWeight=r.devices/Math.max(1,actual);const m=prepared.get(r)||currentAdvance(r,context,seconds/(C.year*C.day)),a=m.initial,v=m.value,fields=Array(9);for(let i=0;i<responseSize;i++)d[i]=(v[i]-a[i])*m.scale;for(const i of responseCumulative)d[i]=Math.max(0,d[i]);for(let i=0;i<9;i++)fields[i]=v[i]*m.scale;retiredD+=d[27];retiredC+=d[28];retiredB+=d[29];const q=STELLAR.fusionLoss*C.c*C.c,starJ=d[17]*C.c*C.c,accNormalJ=d[14]*m.p.eff*C.c*C.c,accJ=(d[14]+d[4])*m.p.eff*C.c*C.c,nucJ=d[11]*q*STELLAR.capture;
   for(let i=0;i<6;i++)if(responseFields[i])r[responseFields[i]]=fields[i];r.ejecta+=r.depositedEjecta||0;r.propellant=(r.propellant||0)+d[24];e.propellantTotal+=d[24];gainedLight+=d[9]+d[24];gainedHeavy+=d[10]+d[18]+d[11]*(1-STELLAR.fusionLoss);spentLight+=d[11]+d[12]+d[19];spentClips+=d[25];spentDevices+=d[26];r.collectedLight=fields[6];r.clips=fields[3];r.devices=fields[7];const bh=fields[8]-r.blackHole;r.blackHole=fields[8];newHoles+=bh-(m.incomingB||0);radiated+=(d[14]+d[4])*m.p.eff;fusionLost+=d[15]+d[16]+d[11]*STELLAR.fusionLoss-d[20];newMetal+=d[11]*(1-STELLAR.fusionLoss)+d[23];star+=starJ;acc+=accJ;normalAcc+=accNormalJ;nuc+=nucJ;spent+=d[21]*C.c*C.c;standby+=d[4]*m.p.eff*C.c*C.c;computed+=d[5]*C.c*C.c;
   r.stepWorkJ=d[21]*C.c*C.c*share;rate.fill(0);currentRate(m,rate);r.instantNormalPower=(rate[17]+rate[14]*m.p.eff+rate[11]*STELLAR.fusionLoss*STELLAR.capture)*C.c*C.c*m.scale*share/(C.year*C.day);normalInstant+=r.instantNormalPower;r.instantWorkPower=rate[21]*C.c*C.c*m.scale*share/(C.year*C.day);instantBackup+=rate[4]*m.p.eff*C.c*C.c*m.scale*share/(C.year*C.day);metalRate+=rate[23]*m.scale/(C.year*C.day);holeRate+=rate[22]*m.scale/(C.year*C.day);
   instant[0]+=rate[17]*C.c*C.c*m.scale/(C.year*C.day);instant[1]+=(rate[14]+rate[4])*m.p.eff*C.c*C.c*m.scale/(C.year*C.day);instant[2]+=rate[11]*q*STELLAR.capture*m.scale/(C.year*C.day);r.workDevices=rate[21]*C.c*C.c*m.scale/(C.year*C.day*equipmentSpecific());r.power=(starJ+accJ+nucJ)*share/seconds;nextRows.push(...(m.children||[r]));r.covered=r.covered||r.devices>=r.luminosity*STELLAR.capture/equipmentSpecific()*(1-1e-8);
  }
  if(retiredD+retiredB>0)nextRows.push(currentCore(retiredD,retiredC,retiredB));newHoles+=retiredB;e.cohorts=nextRows;currentBookkeep(gainedLight,gainedHeavy);u.blackHoleKg+=newHoles;u.radiationKg+=radiated;u.fusionLostKg+=fusionLost;u.nuclearMetal+=newMetal;u.fusionJ+=nuc;u.accretionJ+=acc;
  e.frontWantedJ=0;e.normalJ=(star+normalAcc+nuc)*share;e.energyJ=(star+acc+nuc)*share;e.baseJ=computed*share;engineeringOpenBudget(seconds);e.workJ=Math.max(0,e.workJ-spent*share);u.stepBuildJ+=spent*share;Object.assign(u.last,{power:e.energyJ/seconds,stellarPower:star*share/seconds,accretionPower:acc*share/seconds,nuclearPower:nuc*share/seconds,dischargePower:0});instant=instant.map(x=>x*share);e.lastNormalPower=normalInstant;u.last.instantPower={power:instant.reduce((a,b)=>a+b,0),stellarPower:instant[0],accretionPower:instant[1],nuclearPower:instant[2],gravitationalPower:0};u.nominalPower=e.energyJ/seconds/Math.max(1e-30,share);u.last.kilonovaMetalRate=metalRate;u.last.kilonovaBlackHoleRate=holeRate;engineeringPayTransport(seconds);engineeringCompact(end);
 }
