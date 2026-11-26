// 局部恒星的质量与能量流动，各项速率均以年为单位。
const responseSize:i32=30;
const cc:f64=299792458.0*299792458.0,year:f64=365.2425*86400.0,loss:f64=.007,cap:f64=.75,q:f64=loss*cc;
class Params {pD:f64=0;fuel:f64=0;growth:f64=0;charge:f64=0;k:f64=0;b:f64=0;n:bool=false;a:bool=false;hole:f64=0;eff:f64=0;capture:bool=false;clip:f64=0;compute:f64=0;lum:f64=0;target:f64=0;covered:bool=false;minimumD:f64=0;commissionOffset:f64=0;commission:bool=false;retire:bool=false;core:bool=false;tol:f64=2e-5;}
const p=new Params();const inflow=new Float64Array(30);
class Flows {st:f64=0;ap:f64=0;hole:f64=0;ml:f64=0;mh:f64=0;me:f64=0;ae:f64=0;al:f64=0;ah:f64=0;af:f64=0;np:f64=0;work:f64=0;margin:f64=0;}
const flowA=new Flows(),flowB=new Flows(),flowZ=new Flows(),flowFinal=new Flows(),flowZero=new Flows();
function copyFlow(a:Flows,b:Flows):void{b.st=a.st;b.ap=a.ap;b.hole=a.hole;b.ml=a.ml;b.mh=a.mh;b.me=a.me;b.ae=a.ae;b.al=a.al;b.ah=a.ah;b.af=a.af;b.np=a.np;b.work=a.work;b.margin=a.margin;}
let exactE:f64=NaN,exactF:f64=NaN;
let L:f64=0,H:f64=0,E:f64=0,F:f64=0,D:f64=0,B:f64=0,raw:f64=0,stellar:f64=0,alpha:f64=0,compute:f64=0,fuelJ:f64=0,K:f64=0,mineCapacity:f64=0,solveTargetX:f64=0;
function min3(a:f64,b:f64,c:f64):f64{return Math.min(Math.min(a,b),c);}
function stockRemainder(stock:f64,used:f64):f64{const left=Math.max(0,stock-used);return left<=Math.max(4.9406564584124654e-324,stock*2.220446049250313e-16*8)?0:left;}
function responseCommissionFraction(p:Params,age:f64):f64{if(!p.commission)return 1;const x=p.commissionOffset+age/100000;return x<=0?0:x>=1?1:x*x*(3-2*x);}
function evaluate(x:f64,ap:f64,out:Flows):void{
    const free=D-K*x,receiver=free*p.pD,st=Math.min(receiver,stellar),gas=ap/fuelJ,ae=Math.min(gas,E*p.pD/fuelJ),remainingGas=stockRemainder(gas,ae),ar=Math.min(remainingGas,raw*p.pD/fuelJ),af=Math.min(stockRemainder(remainingGas,ar),F*p.pD/fuelJ),me=Math.min(mineCapacity*x,E*p.pD/1.9e11),remainingMine=Math.min(stockRemainder(mineCapacity*x,me),raw*p.pD/1.9e11),ml=raw>0?remainingMine*L/raw:0,mh=raw>0?remainingMine*H/raw:0,mining=(ml+mh+me)*1.9e11,work=K*p.pD*x+mining,idle=Math.min(stockRemainder(free,mining/p.pD),stockRemainder(receiver,st+ap)/p.pD),np=p.n?Math.min(idle,F)*1.0:0,hole=p.a?min3(Math.max(0,receiver-st),B*p.hole,(raw+E+F)*p.pD):0;
    out.st=st;out.ap=ap;out.hole=hole;out.ml=ml;out.mh=mh;out.me=me;out.ae=ae;out.al=raw>0?ar*L/raw:0;out.ah=raw>0?ar*H/raw:0;out.af=af;out.np=np;out.work=work;out.margin=(st+ap+np)*alpha-work-compute;
}
const cuts=new Float64Array(8);
function budgetMargin(x:f64,source:f64):f64{
 const free=D-K*x,mine=Math.min((D-K)*x,raw+E),supply=Math.min(free*p.pD,source),np=p.n?Math.min(F,Math.max(0,free-Math.max(mine,source/p.pD))):0;
 return alpha*(supply+np)-(K*x+mine)*p.pD-compute;
}
function workFraction(source:f64):f64{
 if(alpha===0)return 0;
 const first=budgetMargin(0,source),last=budgetMargin(1,source);if(last>=0)return 1;if(first<=0)return 0;
 const a=source/p.pD,b=D-K;let n:i32=0;
 cuts[n++]=1;
 for(let i=0;i<6;i++){
  let x:f64=0;
  if(i===0)x=K>0?(D-a)/K:0;
  else if(i===1)x=b>0?(raw+E)/b:0;
  else if(i===2)x=b>0?a/b:0;
  else if(i===3)x=K>0?(D-a-F)/K:0;
  else if(i===4)x=D>0?1-F/D:0;
  else x=K>0?(D-raw-E-F)/K:0;
  if(x>0&&x<1){let j=n;while(j>0&&cuts[j-1]>x){cuts[j]=cuts[j-1];j--;}cuts[j]=x;n++;}
 }
 let lo:f64=0,f=first;for(let i=0;i<n;i++){const hi=cuts[i],g=hi===1?last:budgetMargin(hi,source);if(g<=0)return lo+(hi-lo)*f/(f-g);lo=hi;f=g;}return 1;
}
function dispatch(out:Flows):f64{
 const hole=p.a?Math.min(B*p.hole,(raw+E+F)*p.pD):0,source=stellar+hole,x=workFraction(source),free=D-K*x,receiver=free*p.pD,st=Math.min(receiver,stellar),mine=Math.min((D-K)*x,raw+E),work=(K*x+mine)*p.pD,capacity=Math.min(Math.max(0,receiver-st),hole);
 let ap:f64=0;
 if(alpha>0){const needed=(work+compute)/alpha-st,residual=Math.max(0,receiver-st),idle=p.n?Math.max(0,Math.min(F,free-mine)):0,ratio=p.n?1/p.pD:0,constant=needed-idle,threshold=residual-idle*p.pD;
 ap=Math.max(0,Math.min(capacity,constant<=threshold?constant:(needed-residual*ratio)/(1-ratio)));}else ap=capacity;
 evaluate(x,ap,out);return x;
}
function rates(v:Float64Array,age:f64,out:Float64Array):void{out.fill(0);L=v[0];H=v[1];E=v[2];F=v[6];D=v[7];B=v[8];raw=L+H;stellar=L*p.lum*cap;const fusion=L*p.lum/q;alpha=1-p.charge;compute=Math.max(0,D-v[3])*p.compute*alpha;fuelJ=p.eff*cc;  let star=Math.min(D*p.pD,stellar),construction:f64=0,mineL:f64=0,mineH:f64=0,mineE:f64=0,kRaw:f64=0,kStock:f64=0,nuclear:f64=0,accL:f64=0,accH:f64=0,accE:f64=0,accF:f64=0,workScale:f64=0;let computeFunded:bool=star*alpha>=compute;
  if(!p.covered&&D<p.target*(1-1e-10))construction=H>0?Math.min(D*p.growth,Math.max(0,star*alpha-compute)/(6.5e8+p.fuel*1.9e11)):0;
  else if(!p.core){
   const allocated=D*p.k*responseCommissionFraction(p,age),rawDevices=Math.min(allocated,raw),stockDevices=Math.min(F,stockRemainder(allocated,rawDevices)),unusedK=Math.min(allocated,raw+F),rawRate=rawDevices*p.pD/1e12,stockRate=stockDevices*p.pD/1e12,unusedCapacity=(D-unusedK)*p.pD/1.9e11;K=unusedK;mineCapacity=unusedCapacity;
   const z=flowFinal,x=dispatch(z);computeFunded=x>0;
   workScale=x;star=z.st;mineL=z.ml;mineH=z.mh;mineE=z.me;nuclear=z.np/(q*cap);kRaw=rawRate*x;kStock=stockRate*x;accL=z.al;accH=z.ah;accE=z.ae;accF=z.af;
  }
  const normal=(star+(accL+accH+accE+accF)*fuelJ+nuclear*q*cap),workPower=(kRaw+kStock)*1e12+(mineL+mineH+mineE+construction*p.fuel)*1.9e11+construction*6.5e8,capacity=p.a?Math.min(Math.max(0,D*p.pD-normal),Math.max(0,B*p.hole-(accL+accH+accE+accF)*fuelJ)):0,need=computeFunded?0:Math.min(compute,stockRemainder(compute+workPower,normal*alpha));let backup=Math.min(need,capacity)/fuelJ,deviceFuel:f64=0,clipFuel:f64=0,backupL:f64=0,backupH:f64=0,backupE:f64=0,backupF:f64=0;
  const rawBackup=Math.min(backup,raw*p.pD/fuelJ);if(raw>0){backupL=rawBackup*L/raw;backupH=rawBackup*H/raw;}let left=stockRemainder(backup,rawBackup);backupE=Math.min(left,E*p.pD/fuelJ);left=stockRemainder(left,backupE);backupF=Math.min(left,F*p.pD/fuelJ);left=stockRemainder(left,backupF);clipFuel=Math.min(left,v[3]*p.pD/fuelJ);left=stockRemainder(left,clipFuel);deviceFuel=Math.min(left,Math.max(0,D-v[3]-p.minimumD)*p.pD/fuelJ);backup=rawBackup+backupE+backupF+clipFuel+deviceFuel;
  const f=out,cn=p.capture?loss*(1-cap):0,cs=p.capture?Math.max(0,loss-star/Math.max(1e-300,cc*fusion)):0,kL=raw>0?kRaw*L/raw:0,kH=raw>0?kRaw*H/raw:0,output=(1-p.b)*(kL*(1-loss)+kH+kStock*(1-loss));
  const harvested=mineH+mineE,burned=accL+accH+accE+accF,synth=nuclear,kilo=kRaw+kStock;
  f[0]=-(mineL+kL+fusion+accL+backupL+construction*p.fuel);f[1]=fusion*(1-loss)-mineH-kH-construction-accH-backupH;f[2]=output-mineE-accE-backupE;f[6]=mineL-kStock-nuclear-accF-backupF;f[3]=(harvested+construction+synth*(1-loss))*p.clip-clipFuel;f[4]=backup;f[25]=clipFuel;f[26]=deviceFuel;f[5]=(computeFunded?compute:Math.min(compute,Math.max(0,normal*alpha+backup*fuelJ-workPower)))/cc;
  f[7]=harvested+construction+synth*(1-loss)-deviceFuel-clipFuel;f[8]=kilo*p.b+(burned+backup)*(1-p.eff)+fusion*cs+synth*cn;
  f[9]=mineL;f[10]=harvested;f[11]=synth;f[12]=kStock;f[13]=kRaw;f[14]=burned;f[15]=fusion*loss;f[16]=(1-p.b)*(kL+kStock)*loss;f[17]=star/cc;f[18]=construction;f[19]=accF+backupF;f[20]=fusion*cs+synth*cn;f[21]=(kilo*1e12+(mineL+harvested+construction*p.fuel)*1.9e11+construction*6.5e8)/cc;f[22]=kilo*p.b;f[23]=output;f[24]=construction*p.fuel;
  exactE=(p.b===1||p.k===0)&&E>0&&(mineE===0||mineE===E*p.pD/1.9e11)&&(accE===0||accE===E*p.pD/fuelJ)&&(backupE===0||backupE===E*p.pD/fuelJ)?f[2]/E*year:NaN;
  exactF=mineL===0&&inflow[6]===0&&(kStock===0||kStock===F*p.pD/1e12*workScale)&&(nuclear===0||nuclear===F/(q*cap))&&(accF===0||accF===F*p.pD/fuelJ)&&(backupF===0||backupF===F*p.pD/fuelJ)?(F>0?f[6]/F*year:0):NaN;
  if(p.retire&&p.covered&&raw+E+F>0){const hazard=Math.max(0,-f[0]-f[1]-f[2]-f[6])/(raw+E+F);f[27]=hazard*D;f[28]=hazard*v[3];f[29]=hazard*B;f[7]-=f[27];f[3]-=f[28];f[8]-=f[29];}
  for(let i=0;i<responseSize;i++)f[i]=f[i]*year+inflow[i];
}
const physical:StaticArray<i32>=[0,1,2,3,6,7,8];
const cumulative:StaticArray<i32>=[4,5,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29];
const input=new Float64Array(30),parameters=new Float64Array(22),out=new Float64Array(30),errorTerms=new Float64Array(30),baseRate=new Float64Array(30),endRate=new Float64Array(30),estimatedRate=new Float64Array(30),estimated=new Float64Array(30),tempV=new Float64Array(30),tempRate=new Float64Array(30),timeRate=new Float64Array(30),timeLeft=new Float64Array(30),timeRight=new Float64Array(30),stage=new Float64Array(30),stageRate=new Float64Array(30),rhs=new Float64Array(30),stages=new Float64Array(90),J=new Float64Array(210),A=new Float64Array(49),pivots=new Int32Array(7),solution=new Float64Array(7);
export function pointer(which:i32):usize{if(which===7)return inflow.dataStart;if(which===0)return input.dataStart;if(which===1)return parameters.dataStart;if(which===2)return out.dataStart;if(which===3)return errorTerms.dataStart;if(which===4)return baseRate.dataStart;if(which===5)return endRate.dataStart;return estimatedRate.dataStart;}
export function configure():void{p.pD=parameters[0];p.fuel=parameters[1];p.growth=parameters[2];p.charge=parameters[3];p.k=parameters[4];p.b=parameters[5];p.n=parameters[6]>0;p.a=parameters[7]>0;p.hole=parameters[8];p.eff=parameters[9];p.capture=parameters[10]>0;p.clip=parameters[11];p.compute=parameters[12];p.lum=parameters[13];p.target=parameters[14];p.covered=parameters[15]>0;p.minimumD=parameters[16];p.commissionOffset=parameters[17];p.commission=parameters[18]>0;p.tol=parameters[19];p.retire=parameters[20]>0;p.core=parameters[21]>0;}
export function evaluateRates(age:f64):void{rates(input,age,baseRate);}
function factor(h:f64,gamma:f64=.435866521508459):void{for(let i=0;i<7;i++){pivots[i]=i;for(let j=0;j<7;j++)A[i*7+j]=(i===j?1.0:0.0)-gamma*h*J[physical[i]*7+j];}for(let j=0;j<7;j++){let pivot=j;for(let i=j+1;i<7;i++)if(Math.abs(A[i*7+j])>Math.abs(A[pivot*7+j]))pivot=i;if(pivot!==j){for(let k=0;k<7;k++){const v=A[pivot*7+k];A[pivot*7+k]=A[j*7+k];A[j*7+k]=v;}const v=pivots[pivot];pivots[pivot]=pivots[j];pivots[j]=v;}for(let i=j+1;i<7;i++){A[i*7+j]/=A[j*7+j];for(let k=j+1;k<7;k++)A[i*7+k]-=A[i*7+j]*A[j*7+k];}}}
function solvePhysical():void{for(let i=0;i<7;i++)solution[i]=rhs[physical[pivots[i]]];for(let i=0;i<7;i++)for(let j=0;j<i;j++)solution[i]-=A[i*7+j]*solution[j];for(let i=6;i>=0;i--){for(let j=i+1;j<7;j++)solution[i]-=A[i*7+j]*solution[j];solution[i]/=A[i*7+i];}}
function rawTail(target:Float64Array,h:f64):void{if(!p.covered||inflow[0]!==0||inflow[1]!==0)return;if(input[0]+input[1]>input[7]*1e-18){let coupling:f64=0;for(let j=2;j<7;j++)coupling+=Math.abs(J[j]+J[7+j])*input[physical[j]];if(coupling>Math.abs(baseRate[0]+baseRate[1])*1e-10)return;}const eta=p.lum/q*year,removal=input[0]>0?Math.max(0,-baseRate[0]/input[0]-eta):input[1]>0?Math.max(0,-baseRate[1]/input[1]):0,decay=Math.exp(-removal*h);target[0]=input[0]*Math.exp(-(removal+eta)*h);target[1]=decay*(input[1]+(1-loss)*input[0]*-Math.expm1(-eta*h));}
export function step(age:f64,h:f64):f64{
 const gamma:f64=.435866521508459;rates(input,age,baseRate);jacobian(age);factor(h);timeRate.fill(0);
 if(p.commission){const x=p.commissionOffset+age/100000;if(x>0&&x<1){const dt=100000*min3(1e-4,x*.01,(1-x)*.01);rates(input,age-dt,timeLeft);rates(input,age+dt,timeRight);for(let i=0;i<30;i++)timeRate[i]=(timeRight[i]-timeLeft[i])/(2*dt);}}
 for(let n=0;n<3;n++){
  if(n===1){stage.set(input);for(let j=0;j<7;j++){const i=physical[j];stage[i]+=stages[i];}rawTail(stage,gamma*h);for(let j=0;j<7;j++){const i=physical[j];if(stage[i]<0)return -1;}if(stage[3]>stage[7])return -1;rates(stage,age+gamma*h,stageRate);}
  const rate=n===0?baseRate:stageRate,gs=n===0?gamma:n===1?.24291996454816804:2.185138002766406;
  for(let i=0;i<30;i++){rhs[i]=gamma*h*(rate[i]+h*gs*timeRate[i]);if(n===1)rhs[i]+=gamma*-1.0156171083877702*stages[i];else if(n===2){rhs[i]+=gamma*4.07599564525377*stages[i];rhs[i]+=gamma*9.207679429833079*stages[30+i];}}
  solvePhysical();for(let i=0;i<30;i++)for(let j=0;j<7;j++)rhs[i]+=gamma*h*J[i*7+j]*solution[j];for(let j=0;j<7;j++)rhs[physical[j]]=solution[j];for(let i=0;i<30;i++)stages[n*30+i]=rhs[i];
 }
 out.set(input);errorTerms.fill(0);for(let n=0;n<3;n++){const m=n===0?1.0:n===1?6.169794704382825:-.42772256543218573,e=n===0?.5:n===1?-2.907955871680547:.2235406989781157;for(let i=0;i<30;i++){out[i]+=m*stages[n*30+i];errorTerms[i]+=e*stages[n*30+i];}}
 rawTail(out,h);return validateStep(age,h);
}
function validateStep(age:f64,h:f64):f64{
 let scale:f64=0,error:f64=0;for(let j=0;j<7;j++){const i=physical[j];if(out[i]<0)return -1;scale=Math.max(scale,Math.abs(input[i]));const local=Math.abs(errorTerms[i])/min3Denominator(i,input[i],out[i])/p.tol;if(local>error)error=local;}if(out[3]>out[7])return -1;scale*=2.220446049250313e-16*16;for(let j=0;j<23;j++){const i=cumulative[j];if(out[i]<input[i]){if(input[i]-out[i]>scale)return -1;out[i]=input[i];}}
 const massError=projectMass(h);if(massError>1)return massError;if(out[3]>out[7])return -1;rates(out,age+h,endRate);estimated.set(out);for(let j=0;j<7;j++){const i=physical[j];estimated[i]=Math.max(0,estimated[i]-errorTerms[i]);}rates(estimated,age+h,estimatedRate);
 const energyScale=Math.max(Math.max(energy(baseRate),energy(endRate)),energy(estimatedRate)),materialScale=Math.max(Math.max(baseRate[22]+baseRate[23],endRate[22]+endRate[23]),estimatedRate[22]+estimatedRate[23]);
 for(let j=0;j<7;j++){const i=j===0?17:j===1?14:j===2?11:j===3?21:j===4?23:j===5?22:4,unit=i===14||i===4?p.eff:i===11?loss*cap:1.0,floor=i===23||i===22?materialScale:energyScale/unit,denominator=Math.max(Math.max(1e-30,floor*1e-8),Math.max(Math.max(Math.abs(baseRate[i]),Math.abs(endRate[i])),Math.abs(estimatedRate[i])));const local=Math.abs(endRate[i]-estimatedRate[i])/denominator/1e-3;if(local>error)error=local;}
 return error;
}
function min3Denominator(i:i32,a:f64,b:f64):f64{return Math.max(i===7?1e-18:1e-9,Math.max(Math.abs(a),Math.abs(b)));}
function energy(v:Float64Array):f64{return v[17]+(v[14]+v[4])*p.eff+v[11]*loss*cap;}

export function explicitStep(age:f64,h:f64):f64{
 rates(input,age,baseRate);stage.set(input);for(let j=0;j<7;j++){const i=physical[j];stage[i]+=h*.5*baseRate[i];if(stage[i]<0)return -1;}if(stage[3]>stage[7])return -1;
 rates(stage,age+h*.5,stageRate);stage.set(input);for(let j=0;j<7;j++){const i=physical[j];stage[i]+=h*.75*stageRate[i];if(stage[i]<0)return -1;}if(stage[3]>stage[7])return -1;
 rates(stage,age+h*.75,tempRate);for(let i=0;i<30;i++)out[i]=input[i]+h*(2.0/9*baseRate[i]+1.0/3*stageRate[i]+4.0/9*tempRate[i]);
 for(let j=0;j<7;j++)if(out[physical[j]]<0)return -1;if(out[3]>out[7])return -1;
 rates(out,age+h,endRate);for(let i=0;i<30;i++)errorTerms[i]=h*((2.0/9-7.0/24)*baseRate[i]+(1.0/3-.25)*stageRate[i]+(4.0/9-1.0/3)*tempRate[i]-.125*endRate[i]);return validateStep(age,h);
}
const exE=new Float64Array(49),exH=new Float64Array(49),exQ=new Float64Array(49),exA=new Float64Array(49),exB=new Float64Array(49),exT=new Float64Array(49),exU=new Float64Array(49),exV=new Float64Array(49),exF=new Float64Array(7),exG=new Float64Array(7),exDelta=new Float64Array(7);
function multiply(a:Float64Array,b:Float64Array,out:Float64Array):void{for(let i=0;i<7;i++)for(let j=0;j<7;j++){let value:f64=0;value=a[i*7+0]*b[0+j]+a[i*7+1]*b[7+j]+a[i*7+2]*b[14+j]+a[i*7+3]*b[21+j]+a[i*7+4]*b[28+j]+a[i*7+5]*b[35+j]+a[i*7+6]*b[42+j];out[i*7+j]=value;}}
const operatorLimit:i32=32,operatorMatrices=new Float64Array(32*210),operatorGeneration=new Int32Array(32),operatorUse=new Int32Array(32),exCacheGeneration=new Int32Array(2048),exCacheH=new Float64Array(2048),exCacheData=new Float64Array(2048*147);
let operatorCount:i32=0,operatorClock:i32=0,operatorChosen:i32=-1;
function chooseOperator():bool{operatorClock++;for(let order=0;order<operatorCount;order++){const k=order===0?(operatorChosen<0?0:operatorChosen):order<=operatorChosen?order-1:order;let match:bool=true;for(let i=0;i<210;i++)if(operatorMatrices[k*210+i]!==J[i]){match=false;break;}if(match){operatorChosen=k;operatorUse[k]=operatorClock;return true;}}return false;}
function saveOperator():void{let k=operatorCount;if(k<operatorLimit)operatorCount++;else {k=0;for(let j=1;j<operatorLimit;j++)if(operatorUse[j]<operatorUse[k])k=j;}operatorChosen=k;operatorUse[k]=operatorClock;operatorGeneration[k]++;memory.copy(operatorMatrices.dataStart+<usize>(k*210*8),J.dataStart,210*8);}
function exponentialSlot(h:f64):i32{return operatorChosen*64+(<i32>Math.round(Math.log2(h)*2)&63);}
function loadExponential(h:f64):bool{const k=exponentialSlot(h);if(exCacheGeneration[k]===operatorGeneration[operatorChosen]&&exCacheH[k]===h){const offset=exCacheData.dataStart+<usize>(k*147*8);memory.copy(exE.dataStart,offset,49*8);memory.copy(exH.dataStart,offset+49*8,49*8);memory.copy(exQ.dataStart,offset+98*8,49*8);return true;}return false;}
function saveExponential(h:f64):void{const k=exponentialSlot(h);exCacheGeneration[k]=operatorGeneration[operatorChosen];exCacheH[k]=h;const offset=exCacheData.dataStart+<usize>(k*147*8);memory.copy(offset,exE.dataStart,49*8);memory.copy(offset+49*8,exH.dataStart,49*8);memory.copy(offset+98*8,exQ.dataStart,49*8);}


export function exponentialStep(age:f64,h:f64):f64{
 rates(input,age,baseRate);jacobian(age);exponentialUsed=h;const fraction=input[0]+input[1]>0?input[0]/(input[0]+input[1]):0;if(inflow[0]+inflow[1]===0)for(let i=0;i<30;i++){const radial=J[i*7]*fraction+J[i*7+1]*(1-fraction);J[i*7]=J[i*7+1]=radial;}const inactiveRaw=p.covered&&inflow[0]+inflow[1]===0&&input[0]+input[1]<input[7]*1e-18;if(inactiveRaw){for(let i=0;i<30;i++){J[i*7]=J[i*7+1]=0;}for(let j=0;j<7;j++){J[j]=J[7+j]=J[9*7+j]=J[13*7+j]=J[15*7+j]=J[17*7+j]=0;}}const homogeneous=p.minimumD===0||baseRate[26]<(input[7]-input[3]-p.minimumD)*p.pD/(p.eff*cc)*year*(1-1e-12);if(homogeneous){let anchor:i32=0;for(let j=1;j<7;j++)if(input[physical[j]]>input[physical[anchor]])anchor=j;const denominator=input[physical[anchor]];if(denominator>0)for(let i=0;i<30;i++){if(inactiveRaw&&(i===0||i===1||i===9||i===13||i===15||i===17))continue;let predicted:f64=0;for(let j=0;j<7;j++)predicted+=J[i*7+j]*input[physical[j]];J[i*7+anchor]+=(baseRate[i]-inflow[i]-predicted)/denominator;}}
 const reused=chooseOperator();if(!reused)saveOperator();if(!loadExponential(h)){{let mass:f64=0;for(let i=0;i<7;i++)mass=Math.max(mass,input[physical[i]]);for(let i=0;i<7;i++)rankScale[i]=Math.max(1e-300,Math.max(input[physical[i]],mass*1e-12));let norm:f64=0;for(let i=0;i<7;i++){let row:f64=0;for(let j=0;j<7;j++)row+=Math.abs(J[physical[i]*7+j])*rankScale[j]/rankScale[i]*h;norm=Math.max(norm,row);}
 const squares:i32=<i32>Math.max(0,Math.ceil(Math.log2(Math.max(1e-100,norm/1.5)))),scale=h/Math.pow(2,squares);
 for(let i=0;i<7;i++)for(let j=0;j<7;j++)exA[i*7+j]=J[physical[i]*7+j]*rankScale[j]/rankScale[i]*scale;
 multiply(exA,exA,exB);multiply(exB,exA,exT);multiply(exB,exB,exU);multiply(exU,exA,exV);
 for(let i=0;i<7;i++)for(let j=0;j<7;j++){const k=i*7+j,one:f64=i===j?1:0,even=30240*one+3360*exB[k]+30*exU[k],odd=15120*exA[k]+420*exT[k]+exV[k];A[k]=even-odd;exE[k]=even+odd;exH[k]=30240*one+840*exB[k]+2*exU[k];exQ[k]=15120*one-2520*exA[k]+420*exB[k]-28*exT[k]+exU[k];}
 for(let i=0;i<7;i++)pivots[i]=i;
 for(let j=0;j<7;j++){let pivot=j;for(let i=j+1;i<7;i++)if(Math.abs(A[i*7+j])>Math.abs(A[pivot*7+j]))pivot=i;if(pivot!==j){for(let k=0;k<7;k++){const v=A[pivot*7+k];A[pivot*7+k]=A[j*7+k];A[j*7+k]=v;}const v=pivots[pivot];pivots[pivot]=pivots[j];pivots[j]=v;}for(let i=j+1;i<7;i++){A[i*7+j]/=A[j*7+j];for(let k=j+1;k<7;k++)A[i*7+k]-=A[i*7+j]*A[j*7+k];}}
 for(let m=0;m<3;m++){const matrix=m===0?exE:m===1?exH:exQ;for(let column=0;column<7;column++){for(let i=0;i<7;i++)solution[i]=matrix[pivots[i]*7+column];for(let i=0;i<7;i++)for(let j=0;j<i;j++)solution[i]-=A[i*7+j]*solution[j];for(let i=6;i>=0;i--){for(let j=i+1;j<7;j++)solution[i]-=A[i*7+j]*solution[j];solution[i]/=A[i*7+i];}for(let i=0;i<7;i++)matrix[i*7+column]=solution[i];}}
 for(let s=0;s<squares;s++){multiply(exE,exE,exT);multiply(exE,exH,exU);multiply(exH,exH,exV);for(let i=0;i<49;i++){exE[i]=exT[i];exH[i]=(exU[i]+exH[i])*.5;exQ[i]=exV[i]*.25+exQ[i]*.5;}}
 for(let i=0;i<7;i++)for(let j=0;j<7;j++){const ratio=rankScale[i]/rankScale[j],k=i*7+j;exE[k]*=ratio;exH[k]*=ratio;exQ[k]*=ratio;}
 }saveExponential(h);
}
 for(let i=0;i<7;i++){let a:f64=0,b:f64=0;for(let j=0;j<7;j++){a+=exH[i*7+j]*baseRate[physical[j]];b+=exQ[i*7+j]*baseRate[physical[j]];}exDelta[i]=h*a;exG[i]=h*h*b;}
 out.set(input);for(let i=0;i<30;i++){let change=h*baseRate[i];for(let j=0;j<7;j++)change+=J[i*7+j]*exG[j];out[i]+=change;}for(let j=0;j<7;j++){const i=physical[j];if(homogeneous){let value:f64=0;for(let k=0;k<7;k++)value+=exE[j*7+k]*input[physical[k]];for(let k=0;k<7;k++){value+=h*exH[j*7+k]*inflow[physical[k]];}out[i]=value;exDelta[j]=value-input[i];}else out[i]=input[i]+exDelta[j];}rawTail(out,h);if(isFinite(exactF))out[6]=input[6]*Math.exp(exactF*h);if(p.clip===0&&inflow[3]===0&&input[3]>0&&baseRate[25]===0){out[3]=input[3]*Math.exp(baseRate[3]/input[3]*h);out[28]=input[28]+input[3]*-Math.expm1(baseRate[3]/input[3]*h);}for(let key=0;key<2;key++){const j=key===0?2:4,i=physical[j],diagonal=J[i*7+j];if(diagonal<0&&input[i]>0){let coupling:f64=0;for(let k=0;k<7;k++)if(k!==j)coupling+=Math.abs(J[i*7+k])*input[physical[k]];if(coupling<=Math.abs(baseRate[i])*1e-12&&Math.abs(baseRate[i]-diagonal*input[i])<=Math.abs(baseRate[i])*1e-12)out[i]=input[i]*Math.exp(diagonal*h);}}for(let j=0;j<7;j++)exDelta[j]=out[physical[j]]-input[physical[j]];for(let j=0;j<7;j++){const i=physical[j];if(out[i]<0||!isFinite(out[i]))return -1;}if(out[3]>out[7])return -1;
 rates(out,age+h,endRate);for(let i=0;i<30;i++){let predicted=baseRate[i];for(let j=0;j<7;j++)predicted+=J[i*7+j]*exDelta[j];errorTerms[i]=h*(endRate[i]-predicted)/6;}for(let j=0;j<7;j++)exF[j]=errorTerms[physical[j]];for(let j=0;j<7;j++){let value:f64=0;for(let k=0;k<7;k++)value+=exH[j*7+k]*exF[k];errorTerms[physical[j]]=value;}return validateStep(age,h);
}

const jetData=new Float64Array(8192);
let jetNext:i32=0;
function jet(value:f64):i32{const a=jetNext;jetNext+=8;jetData[a]=value;jetData[a+1]=0;jetData[a+2]=0;jetData[a+3]=0;jetData[a+4]=0;jetData[a+5]=0;jetData[a+6]=0;jetData[a+7]=0;return a;}
function jv(a:i32):f64{return jetData[a];}
function ja(a:i32,b:i32):i32{const c=jetNext;jetNext+=8;jetData[c+0]=jetData[a+0]+jetData[b+0];jetData[c+1]=jetData[a+1]+jetData[b+1];jetData[c+2]=jetData[a+2]+jetData[b+2];jetData[c+3]=jetData[a+3]+jetData[b+3];jetData[c+4]=jetData[a+4]+jetData[b+4];jetData[c+5]=jetData[a+5]+jetData[b+5];jetData[c+6]=jetData[a+6]+jetData[b+6];jetData[c+7]=jetData[a+7]+jetData[b+7];return c;}
function js(a:i32,b:i32):i32{const c=jetNext;jetNext+=8;jetData[c+0]=jetData[a+0]-jetData[b+0];jetData[c+1]=jetData[a+1]-jetData[b+1];jetData[c+2]=jetData[a+2]-jetData[b+2];jetData[c+3]=jetData[a+3]-jetData[b+3];jetData[c+4]=jetData[a+4]-jetData[b+4];jetData[c+5]=jetData[a+5]-jetData[b+5];jetData[c+6]=jetData[a+6]-jetData[b+6];jetData[c+7]=jetData[a+7]-jetData[b+7];return c;}
function jk(a:i32,k:f64):i32{const c=jetNext;jetNext+=8;jetData[c+0]=jetData[a+0]*k;jetData[c+1]=jetData[a+1]*k;jetData[c+2]=jetData[a+2]*k;jetData[c+3]=jetData[a+3]*k;jetData[c+4]=jetData[a+4]*k;jetData[c+5]=jetData[a+5]*k;jetData[c+6]=jetData[a+6]*k;jetData[c+7]=jetData[a+7]*k;return c;}
function jm(a:i32,b:i32):i32{const c=jet(jv(a)*jv(b));jetData[c+1]=jetData[a+1]*jv(b)+jv(a)*jetData[b+1];jetData[c+2]=jetData[a+2]*jv(b)+jv(a)*jetData[b+2];jetData[c+3]=jetData[a+3]*jv(b)+jv(a)*jetData[b+3];jetData[c+4]=jetData[a+4]*jv(b)+jv(a)*jetData[b+4];jetData[c+5]=jetData[a+5]*jv(b)+jv(a)*jetData[b+5];jetData[c+6]=jetData[a+6]*jv(b)+jv(a)*jetData[b+6];jetData[c+7]=jetData[a+7]*jv(b)+jv(a)*jetData[b+7];return c;}
function jd(a:i32,b:i32):i32{const c=jet(jv(a)/jv(b));jetData[c+1]=(jetData[a+1]-jv(c)*jetData[b+1])/jv(b);jetData[c+2]=(jetData[a+2]-jv(c)*jetData[b+2])/jv(b);jetData[c+3]=(jetData[a+3]-jv(c)*jetData[b+3])/jv(b);jetData[c+4]=(jetData[a+4]-jv(c)*jetData[b+4])/jv(b);jetData[c+5]=(jetData[a+5]-jv(c)*jetData[b+5])/jv(b);jetData[c+6]=(jetData[a+6]-jv(c)*jetData[b+6])/jv(b);jetData[c+7]=(jetData[a+7]-jv(c)*jetData[b+7])/jv(b);return c;}
function jmin(a:i32,b:i32):i32{return smaller(a,b)?a:b;}
function jmax(a:i32,b:i32):i32{return smaller(a,b)?b:a;}
function jr(a:i32,b:i32):i32{return smaller(b,a)?js(a,b):0;}
function jo(index:i32,a:i32):void{J[index*7+0]=jetData[a+0+1]*year;J[index*7+1]=jetData[a+1+1]*year;J[index*7+2]=jetData[a+2+1]*year;J[index*7+3]=jetData[a+3+1]*year;J[index*7+4]=jetData[a+4+1]*year;J[index*7+5]=jetData[a+5+1]*year;J[index*7+6]=jetData[a+6+1]*year;}
function analyticalJacobian(age:f64):void{
 jetNext=0;jet(0);const l=jet(input[0]),h=jet(input[1]),e=jet(input[2]),c=jet(input[3]),f=jet(input[6]),d=jet(input[7]),b=jet(input[8]);
 jetData[l+1]=1;jetData[h+2]=1;jetData[e+3]=1;jetData[c+4]=1;jetData[f+5]=1;jetData[d+6]=1;jetData[b+7]=1;
 const r=ja(l,h),stars=jk(l,p.lum*cap),fusion=jk(l,p.lum/q),computing=jk(jmax(0,js(d,c)),p.compute*alpha),fuelEnergy=p.eff*cc;
 let star=jmin(jk(d,p.pD),stars),construction:i32=0,ml:i32=0,mh:i32=0,me:i32=0,kr:i32=0,kf:i32=0,nuclear:i32=0,al:i32=0,ah:i32=0,ae:i32=0,af:i32=0;
 let funded:bool=jv(star)*alpha>=jv(computing);
 if(!p.covered&&input[7]<p.target*(1-1e-10)){
  if(input[1]>0)construction=jmin(jk(d,p.growth),jk(jmax(0,js(jk(star,alpha),computing)),1/(6.5e8+p.fuel*1.9e11)));
 }else if(!p.core){
  const allocation=jk(d,p.k*responseCommissionFraction(p,age)),rawDevices=jmin(allocation,r),stockDevices=jmin(f,jr(allocation,rawDevices)),k=jmin(allocation,ja(r,f));
  K=jv(k);mineCapacity=(input[7]-K)*p.pD/1.9e11;
  const maxHole=p.a?jmin(jk(b,p.hole),jk(ja(ja(r,e),f),p.pD)):0,source=ja(stars,maxHole),xValue=workFraction(jv(source)),x=jet(xValue),ratio=jv(k)===jv(allocation)?jet(p.k*responseCommissionFraction(p,age)):jv(d)>0?jd(k,d):0,w=xValue===0?0:xValue===1?d:jet(xValue*jv(d));funded=xValue>0;
  if(xValue===0||xValue===1){const free=js(d,jm(ratio,w)),mined=jmin(jm(js(jet(1),ratio),w),ja(r,e)),supplied=jmin(jk(free,p.pD),source),idle=jmax(0,js(free,jmax(mined,jk(source,1/p.pD)))),np=p.n?jmin(f,idle):0,margin=js(js(jk(ja(supplied,np),alpha),jk(ja(jm(ratio,w),mined),p.pD)),computing);}
  if(xValue>0&&xValue<1){
   const free=js(d,jm(ratio,w)),mined=jmin(jm(js(jet(1),ratio),w),ja(r,e)),supplied=jmin(jk(free,p.pD),source),idle=jmax(0,js(free,jmax(mined,jk(source,1/p.pD)))),np=p.n?jmin(f,idle):0;
   const margin=js(js(jk(ja(supplied,np),alpha),jk(ja(jm(ratio,w),mined),p.pD)),computing);
   const freeX=-jv(ratio),minedX=(1-jv(ratio))*jv(w)<jv(r)+jv(e)?1-jv(ratio):0,supplyX=jv(free)*p.pD<jv(source)?freeX*p.pD:0;
   const idleX=p.n&&jv(idle)>0&&jv(idle)<jv(f)?freeX-(jv(mined)>jv(source)/p.pD?minedX:0):0,slope=alpha*(supplyX+idleX)-(jv(ratio)+minedX)*p.pD;
   for(let j=1;j<8;j++)jetData[w+j]=-jetData[margin+j]/slope;
  }
  const free=js(d,jm(ratio,w)),receiver=jk(free,p.pD);star=jmin(receiver,stars);
  const mine=jmin(jm(js(jet(1),ratio),w),ja(r,e)),work=jk(ja(jm(ratio,w),mine),p.pD),capacity=jmin(jmax(0,js(receiver,star)),maxHole);
  let ap:i32=0;
  if(alpha>0){
   const needed=js(jk(ja(work,computing),1/alpha),star),residual=jmax(0,js(receiver,star)),idle=p.n?jmax(0,jmin(f,js(free,mine))):0,constant=js(needed,idle),threshold=js(residual,jk(idle,p.pD)),ratio=p.n?1/p.pD:0;
   ap=jmax(0,jmin(capacity,jv(constant)<=jv(threshold)?constant:jk(js(needed,jk(residual,ratio)),1/(1-ratio))));
  }else ap=capacity;
  const gas=jk(ap,1/fuelEnergy);ae=jmin(gas,jk(e,p.pD/fuelEnergy));const ar=jmin(jr(gas,ae),jk(r,p.pD/fuelEnergy));af=jmin(jr(jr(gas,ae),ar),jk(f,p.pD/fuelEnergy));
  me=jmin(jk(jm(js(jet(1),ratio),w),p.pD/1.9e11),jk(e,p.pD/1.9e11));const rawMine=jmin(jr(jk(jm(js(jet(1),ratio),w),p.pD/1.9e11),me),jk(r,p.pD/1.9e11));
  if(jv(r)>0){const fraction=jd(l,r);ml=jm(rawMine,fraction);mh=js(rawMine,ml);al=jm(ar,fraction);ah=js(ar,al);}
  const mining=jk(ja(ja(ml,mh),me),1.9e11),idle=jmin(jr(free,jk(mining,1/p.pD)),jk(jr(receiver,ja(star,ap)),1/p.pD));
  nuclear=p.n?jk(jmin(idle,f),1/(q*cap)):0;const rawRatio=jv(rawDevices)===jv(allocation)?ratio:jv(d)>0?jd(rawDevices,d):0,stockRatio=jv(stockDevices)===jv(f)?(jv(d)>0?jd(f,d):0):js(ratio,rawRatio);kr=jk(jm(rawRatio,w),p.pD/1e12);kf=jk(jm(stockRatio,w),p.pD/1e12);
 }
 const burned=ja(ja(al,ah),ja(ae,af)),normal=ja(ja(star,jk(burned,fuelEnergy)),jk(nuclear,q*cap)),workPower=ja(jk(ja(kr,kf),1e12),ja(jk(ja(ja(ml,ja(mh,me)),jk(construction,p.fuel)),1.9e11),jk(construction,6.5e8)));
 let requested:i32=0,br:i32=0,bl:i32=0,bh:i32=0,be:i32=0,bf:i32=0,bc:i32=0,bd:i32=0,backup:i32=0;
 if(!funded){
 const capacity=p.a?jmin(jmax(0,js(jk(d,p.pD),normal)),jmax(0,js(jk(b,p.hole),jk(burned,fuelEnergy)))):0,need=funded?0:jmin(computing,jr(ja(computing,workPower),jk(normal,alpha)));
 requested=jk(jmin(need,capacity),1/fuelEnergy);br=jmin(requested,jk(r,p.pD/fuelEnergy));
 if(jv(r)>0){bl=jm(br,jd(l,r));bh=js(br,bl);}
 be=jmin(jr(requested,br),jk(e,p.pD/fuelEnergy));bf=jmin(jr(jr(requested,br),be),jk(f,p.pD/fuelEnergy));bc=jmin(jr(jr(jr(requested,br),be),bf),jk(c,p.pD/fuelEnergy));
 bd=jmin(jr(jr(jr(jr(requested,br),be),bf),bc),jk(jmax(0,js(js(d,c),jet(p.minimumD))),p.pD/fuelEnergy));backup=ja(ja(br,be),ja(bf,ja(bc,bd)));
 }
 const kl=jv(r)>0?jm(kr,jd(l,r)):0,kh=js(kr,kl),output=jk(ja(jk(ja(kl,kf),1-loss),kh),1-p.b),harvested=ja(mh,me),kilo=ja(kr,kf),starCapture=p.capture?jmax(0,js(jk(fusion,loss),jk(star,1/cc))):0,nuclearCapture=jk(nuclear,p.capture?loss*(1-cap):0);
 J.fill(0);
 jo(0,jk(ja(ja(ja(ml,kl),ja(fusion,al)),ja(bl,jk(construction,p.fuel))),-1));
 jo(1,js(jk(fusion,1-loss),ja(ja(mh,kh),ja(construction,ja(ah,bh)))));
 jo(2,js(output,ja(me,ja(ae,be))));
 jo(6,js(ml,ja(ja(kf,nuclear),ja(af,bf))));
 jo(3,js(jk(ja(ja(harvested,construction),jk(nuclear,1-loss)),p.clip),bc));
 jo(7,js(ja(ja(harvested,construction),jk(nuclear,1-loss)),ja(bd,bc)));
 jo(8,ja(ja(jk(kilo,p.b),jk(ja(burned,backup),1-p.eff)),ja(starCapture,nuclearCapture)));
 jo(4,backup);jo(25,bc);jo(26,bd);jo(5,jk(funded?computing:jmin(computing,jmax(0,js(ja(jk(normal,alpha),jk(backup,fuelEnergy)),workPower))),1/cc));
 jo(9,ml);jo(10,harvested);jo(11,nuclear);jo(12,kf);jo(13,kr);jo(14,burned);jo(15,jk(fusion,loss));jo(16,jk(ja(kl,kf),(1-p.b)*loss));jo(17,jk(star,1/cc));jo(18,construction);jo(19,ja(af,bf));jo(20,ja(starCapture,nuclearCapture));jo(21,jk(workPower,1/cc));jo(22,jk(kilo,p.b));jo(23,output);jo(24,jk(construction,p.fuel));
 if(p.retire&&p.covered&&jv(ja(ja(r,e),f))>0){
  const removed=ja(ja(harvested,construction),ja(nuclear,ja(burned,ja(ja(bl,bh),ja(be,bf))))),kLoss=jk(ja(kl,kf),(1-p.b)*loss),removedAll=ja(removed,ja(jk(kilo,p.b),ja(kLoss,jk(fusion,loss)))),hazard=jd(removedAll,ja(ja(r,e),f));
  const rd=jm(hazard,d),rc=jm(hazard,c),rb=jm(hazard,b);jo(27,rd);jo(28,rc);jo(29,rb);for(let j=0;j<7;j++){J[7*7+j]-=J[27*7+j];J[3*7+j]-=J[28*7+j];J[8*7+j]-=J[29*7+j];}
 }

}

function jacobian(age:f64):void{analyticalJacobian(age);if(isFinite(exactE)){for(let j=0;j<7;j++)J[2*7+j]=j===2?exactE:0;}}
export function testJacobian(age:f64):usize{rates(input,age,baseRate);analyticalJacobian(age);return J.dataStart;}

let exponentialUsed:f64=0;
export function exponentialDuration():f64{return exponentialUsed;}
function guardDirection(a:i32,b:i32):f64{let value:f64=0;for(let j=0;j<7;j++)value+=(jetData[a+j+1]-jetData[b+j+1])*baseRate[physical[j]];return value;}
function guardScale(a:i32,b:i32):f64{let scale=Math.max(Math.abs(jv(a)),Math.abs(jv(b))),sensitivity:f64=0;for(let j=0;j<7;j++)sensitivity+=Math.abs(jetData[a+j+1]-jetData[b+j+1])*Math.abs(input[physical[j]]);return Math.max(scale,sensitivity);}
function smaller(a:i32,b:i32):bool{const difference=jv(a)-jv(b),scale=guardScale(a,b);if(scale>0&&Math.abs(difference)<=scale*1e-10)return guardDirection(a,b)<0;return difference<0;}
const rankScale=new Float64Array(7);

function projectMass(h:f64):f64{
 let balance:f64=0,remainder:f64=0,largest:i32=0;
 for(let j=0;j<7;j++){const i=physical[j];if(i===3)continue;const term=input[i]-out[i]-remainder,next=balance+term;remainder=(next-balance)-term;balance=next;if(out[i]>out[largest])largest=i;}
 const energy=(out[14]-input[14]+out[4]-input[4])*p.eff+(out[15]-input[15])+(out[16]-input[16])+(out[11]-input[11])*loss-(out[20]-input[20])+(out[24]-input[24]);
 const supplied=(inflow[0]+inflow[1]+inflow[2]+inflow[6]+inflow[7]+inflow[8])*h;balance+=supplied;balance-=energy;balance-=(out[27]-input[27])+(out[29]-input[29]);
 if(out[27]>out[largest])largest=27;if(out[29]>out[largest])largest=29;
 const total=input[0]+input[1]+input[2]+input[6]+input[7]+input[8]+supplied,error=Math.abs(balance)/Math.max(1e-300,total)/p.tol;if(error<=1)out[largest]+=balance;return error;
}
