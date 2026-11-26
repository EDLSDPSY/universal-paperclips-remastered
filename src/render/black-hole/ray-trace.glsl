#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform vec3 u_camera;
uniform mat3 u_basis;
uniform sampler2D u_noise;
uniform float u_time;
uniform float u_isco;
uniform sampler2D u_clipPhases;
uniform float u_noiseClock;
uniform float u_clipClock;
uniform float u_aspect;
/*__PARAMS__*/
const float PI=3.141592653589793;

// 采用外向 Kerr–Schild 坐标，y 是自旋轴。长度单位为初始质量对应的 GM₀/c²，光线向过去追踪。
struct Geo { float r; float f; vec3 l; vec3 dr; vec3 df; float inv; };
struct Ray { vec3 x; vec3 p; float t; };
float radiusAt(vec3 x,float a){float b=dot(x,x)-a*a;return sqrt(max(1e-12,.5*(b+sqrt(b*b+4.0*a*a*x.y*x.y))));}
float radius(vec3 x){return radiusAt(x,u_spin*u_mass);}
float materialRadius(vec3 x){return radiusAt(x,u_spin);}
float innerRadius(){return u_inner*u_mass;}
float outerBound(){return sqrt(u_outer*u_outer+u_spin*u_spin);}
Geo geometry(vec3 x){
 Geo g;if(u_mass==0.0){float r=max(length(x),1e-6);return Geo(r,0.0,vec3(0),x/r,vec3(0),1.0/(r*r));}float a=u_spin*u_mass,a2=a*a;
 g.r=radius(x);float r=g.r,r2=r*r,D=2.0*r2-dot(x,x)+a2,mu=x.y/r,sigma=r2+a2*mu*mu;
 g.inv=1.0/(r2+a2);g.dr=vec3(x.x*r2,x.y*(r2+a2),x.z*r2)/(r*D);
 g.l=vec3(-r*x.x-a*x.z,-x.y*(r2+a2)/r,-r*x.z+a*x.x)*g.inv;
 g.f=2.0*u_mass*r/sigma;
 float fr=g.f*(3.0/r-4.0*r/sigma);
 g.df=fr*g.dr;g.df.y-=g.f*2.0*a2*mu/(r*sigma);return g;
}
Ray derivative(Ray s,float pt,Geo g){
 if(u_mass==0.0)return Ray(s.p,vec3(0),-pt);
 float a=u_spin*u_mass,r=g.r,w=dot(g.l,s.p)-pt;
 float radial=s.p.x*s.x.x+s.p.z*s.x.z,angular=s.p.z*s.x.x-s.p.x*s.x.z;
 float factor=-radial*g.inv-2.0*r*g.inv*g.inv*(-r*radial+a*angular)+s.p.y*s.x.y/(r*r);
 vec3 gradient=vec3((-r*s.p.x+a*s.p.z)*g.inv,-s.p.y/r,(-a*s.p.x-r*s.p.z)*g.inv)+factor*g.dr;
 return Ray(s.p-g.f*w*g.l,.5*w*w*g.df+g.f*w*gradient,-pt+g.f*w);
}
Ray offsetRay(Ray s,Ray d,float h){return Ray(s.x+h*d.x,s.p+h*d.p,s.t+h*d.t);}
Ray rk4(Ray s,float pt,float h,Ray k1){
 Ray s2=offsetRay(s,k1,h*.5),k2=derivative(s2,pt,geometry(s2.x));
 Ray s3=offsetRay(s,k2,h*.5),k3=derivative(s3,pt,geometry(s3.x));
 Ray s4=offsetRay(s,k3,h),k4=derivative(s4,pt,geometry(s4.x));
 return Ray(s.x+h*(k1.x+2.0*k2.x+2.0*k3.x+k4.x)/6.0,s.p+h*(k1.p+2.0*k2.p+2.0*k3.p+k4.p)/6.0,s.t+h*(k1.t+2.0*k2.t+2.0*k3.t+k4.t)/6.0);
}
float heightAt(float r){return mix(u_heightInner,u_heightOuter,clamp((r-u_inner)/(u_outer-u_inner),0.0,1.0));}
float omega(float r){float w=sqrt(u_mass);return w/(r*sqrt(r)+u_spin*u_mass*w);}

// 用径向势判断光线会落入视界，还是能在不穿过吸积盘的情况下逃逸。
vec3 invariants(Ray s,Geo g,float pt){
 if(u_mass==0.0)return vec3(0);float a=u_spin*u_mass;
 vec3 axes=vec3(sqrt(g.r*g.r+a*a),g.r,sqrt(g.r*g.r+a*a));
 vec3 n=s.x/axes,J=cross(n,s.p*axes);float E=-pt,L=J.y,Q=dot(J.xz,J.xz)-a*a*E*E*n.y*n.y;
 float l=L/(E*u_mass),q=Q/(E*E*u_mass*u_mass);return vec3(l,q,q+(l-u_spin)*(l-u_spin));
}
vec3 potentialCoeffs(vec3 c){float a=u_spin;return vec3(2.0*a*(a-c.x)-c.z,2.0*c.z,-a*a*c.y);}
float potential(float u,vec3 c){return 1.0+u*u*(c.x+u*(c.y+u*c.z));}
float lowerPotential(float lo,float hi,vec3 c){
 float d=hi-lo,f=potential(lo,c),d1=d*lo*(2.0*c.x+lo*(3.0*c.y+4.0*c.z*lo));
 float d2=d*d*(c.x+lo*(3.0*c.y+6.0*c.z*lo)),d3=d*d*d*(c.y+4.0*c.z*lo);
 return min(min(f,potential(hi,c)),min(f+.25*d1,min(f+.5*d1+d2/6.0,f+.75*d1+.5*d2+.25*d3)));
}
bool captured(float r,float dr,vec3 c,float horizon){
 if(dr>=0.0)return false;vec3 v=potentialCoeffs(c);float p=v.x*.5;
 if(p>=0.0)return true;float t=sqrt(-p/3.0),z=-c.z/(4.0*t*t*t);
 if(z<=-1.0)return true;float rm=2.0*t*cos(acos(clamp(z,-1.0,1.0))/3.0);
 if(rm<=horizon||r<rm*.999)return true;
 return potential(1.0/rm,v)>1e-4;
}
bool escaped(Ray s,Geo g,Ray d,float pt,vec3 c){
 float dr=dot(g.dr,d.x),r=g.r;if(dr<=0.0||r<4.1*u_mass)return false;
 vec3 v=potentialCoeffs(c);float fmin=lowerPotential(0.0,u_mass/r,v);if(fmin<=1e-4)return false;
 if(r>outerBound()*1.002)return true;
 float mu=s.x.y/r,sgn=sign(mu),cone=max(u_heightInner/max(innerRadius(),1e-8),u_heightOuter/u_outer)*1.015+.001;
 if(abs(mu)<=cone)return false;
 float tau=u_mass*(1.0/r-1.0/outerBound())*inversesqrt(fmin),sigma=r*r+u_spin*u_spin*u_mass*u_mass*mu*mu;
 float vmu=sgn*sigma*(d.x.y-mu*dr)/(r*abs(pt)*max(u_mass,1e-8));
 float acceleration=abs(c.y+c.x*c.x)+u_spin*u_spin;
 return min(abs(mu),abs(mu)+vmu*tau-.5*acceleration*tau*tau)>cone;
}

// 用查找表生成壳层噪声，并让外盘过渡到自相似的扰动。
vec2 noiseRadius(float r){
 float begin=u_noiseBegin,end=max(begin+.01,u_noiseEnd);if(r<=begin)return vec2(r,1.0);
 float k=1.0+.5*log(r/begin),t=smoothstep(begin,end,r);return mix(vec2(r,1.0),vec2(begin*k*k,begin/r),t);
}
vec2 sampleNoise(vec2 p,float shell,float scale,float spinLimit,float time){
 float r=shell/scale,spinR=min(r,spinLimit);
 p.x+=scale*16.0*ceil(524288.0/(r*r*r+1.0))*time;
 p.x*=round(1.0+spinR*u_noiseSpiral);
 vec2 ip=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return textureLod(u_noise,((ip+vec2(11.0,5.0)*shell)+f)/16.0+1.0/32.0,0.0).rg;
}
vec2 shellNoise(vec3 p,float time,float scale,float spinLimit){
 p*=scale;float shell=floor(p.x);return mix(sampleNoise(p.yz,shell,scale,spinLimit,time),sampleNoise(p.yz,shell+1.0,scale,spinLimit,time),fract(p.x));
}
float turbulence(vec3 x,float r,float path,float time){
 vec2 nr=noiseRadius(r*.5);float factor=1.25+.8*u_spin,nr0=max(.01,factor*nr.x);
 float rr=.75*sqrt(nr0)*u_noiseR,beta=inversesqrt(max(1e-4,2.0*(nr0-1.0)));
 float theta=atan(x.x,x.z)*(8.0/PI)+beta*(1.0+.02*u_noiseTwist-u_noiseShear*nr0);
 vec3 p=vec3(rr,theta,x.y*.5*u_noiseV*nr.y),sum=vec3(0.0);float scale=1.0,amp=1.0;
 float cap=.75*u_noiseR*sqrt(factor*u_noiseBegin)*(1.0+.5*log(u_noiseEnd/u_noiseBegin));
 float spinLimit=r*.5<=u_noiseBegin?1e20:cap;
 float footprint=path*tan(radians(u_fov)*.5)/u_resolution.y*.5*nr.y;
 for(int i=0;i<5;i++){
  if(float(i)>=u_octaves)break;
  float w=footprint*scale*(i==0?.05:1.0),K=u_noiseLOD>.5?1.0-smoothstep(.5,1.0,w):1.0;
  if(K<.001){sum.z+=amp;scale*=3.0;amp*=u_octaveGain;continue;}
  sum+=amp*vec3(shellNoise(p,-time*u_noiseSpeed*.000001,scale,spinLimit)*K,1.0);
  p+=sum.xyx*vec3(u_distortionX,u_distortionY,u_distortionZ)/scale;scale*=3.0;amp*=u_octaveGain;
 }
 return 3.0*mix(1.0,pow(max(sum.x/max(sum.z,.001),0.0),u_noisePower),u_noiseContrast);
}

// 回形针是跟着壳层转动的发光面片。距离越远，整枚回形针一起淡出。
vec4 clipRandom(ivec3 id){
 uint seed=uint(id.x)*1597334677u^uint(id.y)*3812015801u^uint(id.z)*2798796415u^uint(u_clipSeed)*747796405u;
 uvec4 h=seed^uvec4(2246822519u,3266489917u,668265263u,374761393u);
 h=(h^(h>>16u))*2246822519u;h=(h^(h>>13u))*3266489917u;h^=h>>16u;
 return vec4(h>>8u)*(1.0/16777216.0);
}
float squared(vec2 p){return dot(p,p);}
float clipShapeSquared(vec2 p){
 float d=squared(vec2(p.x+.16,p.y-clamp(p.y,-.25,.23)));
 d=min(d,squared(vec2(p.x-.16,p.y-clamp(p.y,-.25,.23))));
 d=min(d,squared(vec2(p.x+.07,p.y-clamp(p.y,-.08,.20))));
 d=min(d,squared(vec2(p.x-.07,p.y-clamp(p.y,-.25,.20))));
 d=min(d,squared(vec2(length(p-vec2(0.0,.23))-.16,min(p.y-.23,0.0))));
 d=min(d,squared(vec2(length(p-vec2(-.045,-.25))-.115,max(p.y+.25,0.0))));
 d=min(d,squared(vec2(length(p-vec2(0.0,.20))-.07,min(p.y-.20,0.0))));return d;
}
float clipOrbitalAngle(float angle,float r,float delay){int ring=int(floor(r/u_clipSpacing));float phase=texelFetch(u_clipPhases,ivec2(ring,0),0).r;return angle-phase-omega(r)*delay*u_speedScale*u_motion*u_clipOrbitScale;}
void clipRotate(inout vec3 p,inout vec3 d,ivec3 id,float time){
 vec4 turn=clipRandom(id+ivec3(217,619,137)),spin=clipRandom(id+ivec3(853,439,1021));
 // 用均匀四元数给面片选初始姿势，再独立采样自转轴。
 float a=2.0*PI*turn.y,b=2.0*PI*turn.z;
 vec4 q=vec4(sqrt(1.0-turn.x)*vec2(sin(a),cos(a)),sqrt(turn.x)*vec2(sin(b),cos(b)));
 float y=2.0*spin.x-1.0,phi=2.0*PI*spin.y,horizontal=sqrt(1.0-y*y);
 vec3 axis=vec3(horizontal*cos(phi),y,horizontal*sin(phi));
 float angle=time*u_tumble*(turn.w-.5),cs=cos(angle),sn=sin(angle);
 p=p*cs-cross(axis,p)*sn+axis*dot(axis,p)*(1.0-cs);
 d=d*cs-cross(axis,d)*sn+axis*dot(axis,d)*(1.0-cs);
 p+=2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);
 d+=2.0*cross(q.xyz,cross(q.xyz,d)+q.w*d);
}
// 在每段 RK4 光路上与整个面片求交。只用盘边界筛选面片中心，穿过的长度不影响覆盖率。
float clipSegment(vec3 x,float r,vec3 segment,float footprint){
 float cell=u_clipSpacing,reach=.4*min(u_clipSize,.7*cell)*(1.0+u_clipSizeSpread)+u_clipWire+footprint;
 if(abs(x.y)-abs(segment.y)*.5>max(u_heightInner,u_heightOuter)+reach)return 0.0;
 float lengthS=length(segment),halfS=lengthS*.5,azimuth=atan(x.x,x.z);
 vec3 radial=normalize(vec3(x.x,0,x.z)),tangent=vec3(radial.z,0,-radial.x);
 vec3 direction=vec3(dot(segment,radial),segment.y,dot(segment,tangent))/lengthS;
 vec3 extent=abs(direction)*halfS+vec3(.43*u_clipScatter*cell+reach);float coverageMax=0.0;
 int first=max(0,int(ceil((r-extent.x)/cell-.5))),last=int(floor((r+extent.x)/cell-.5));
 for(int ri=first;ri<=last;ri++){
  float rc=(float(ri)+.5)*cell,count=max(8.0,floor(2.0*PI*rc/cell)),sector=2.0*PI/count,arc=sector*rc;
  float orbitalAngle=clipOrbitalAngle(azimuth,rc,0.0),yOffset=(clipRandom(ivec3(ri,-317,0)).x-.5)*u_clipScatter;
  float y=x.y/cell-yOffset;int bottom=int(ceil(y-extent.y/cell)),top=int(floor(y+extent.y/cell));
  for(int yi=bottom;yi<=top;yi++){
   float phase=clipRandom(ivec3(ri,yi,-991)).x*2.0*PI*u_clipScatter,angle=(orbitalAngle-phase)/sector;
   float span=(abs(direction.z)*halfS+reach)/arc+.43*u_clipScatter;
   int left=int(ceil(angle-.5-span)),right=int(floor(angle-.5+span));
   for(int ai=left;ai<=right;ai++){
    ivec3 id=ivec3(ri,yi,((ai%int(count))+int(count))%int(count));vec4 random=clipRandom(id);if(random.w<.15*u_clipScatter)continue;
    float size=min(u_clipSize,.7*min(cell,arc))*mix(1.0-u_clipSizeSpread,1.0+u_clipSizeSpread,random.w);
    vec3 offset=(random.xyz-.5)*vec3(cell,cell,arc)*(.86*u_clipScatter);
    float centerR=rc+offset.x,centerY=(float(yi)+yOffset)*cell+offset.y;
    if(centerR<=innerRadius()||centerR>=u_outer||abs(centerY)>heightAt(centerR))continue;
    float phi=azimuth-(angle-float(ai)-.5)*sector+offset.z/rc;
    float rho=sqrt((centerR*centerR+u_spin*u_spin)*(1.0-centerY*centerY/(centerR*centerR)));
    vec3 axisR=vec3(sin(phi),0,cos(phi)),axisT=vec3(axisR.z,0,-axisR.x),center=axisR*rho+vec3(0,centerY,0);
    float distanceToCamera=length(center-u_camera);
    float fade=pow(1.0-smoothstep(u_clipFade*u_clipFadeStart,u_clipFade,distanceToCamera),u_clipFadePower);
    if(fade==0.0)continue;
    vec3 delta=x-center,p=vec3(dot(delta,axisR),delta.y,dot(delta,axisT));
    vec3 direction=vec3(dot(segment,axisR),segment.y,dot(segment,axisT))/lengthS;
    float closest=clamp(-dot(p,direction),-halfS,halfS),bound=.4*size+u_clipWire+footprint;
    if(dot(p+direction*closest,p+direction*closest)>bound*bound)continue;
    vec3 d=direction;clipRotate(p,d,id,u_clipClock);
    if(d.y==0.0)continue;float hit=-p.y/d.y;if(hit < -halfS || hit >= halfS)continue;
    vec3 at=p+d*hit;float distance=sqrt(clipShapeSquared(at.xz/size))*size;
    float coverage=1.0-smoothstep(u_clipWire-footprint*.5,u_clipWire+footprint*.75,distance);
    coverageMax=max(coverageMax,coverage*fade*u_clipOpacity);

   }
  }
 }
 return coverageMax;
}
float temperature(float r){
 float ri=max(innerRadius(),max(u_isco,3.0*u_mass)),peak=1.44*ri,horizon=u_mass*(1.0+sqrt(1.0-u_spin*u_spin));
 if(r<peak&&innerRadius()<max(u_isco,3.0*u_mass))return u_temperature*smoothstep(horizon,peak,r);
 if(r<ri)return 0.0;return u_temperature*pow(peak/r,.75)*pow(1.0-sqrt(ri/r),.3)*1.7113;
}
vec3 blackbody(float T){T=clamp(T,500.0,100000.0);float t=(T-6500.0)/(6500.0*T*2.2);vec3 c=exp(vec3(20553.9304,26346.3675,33014.5739)*t);return c/max(c.r,max(c.g,c.b));}
void volume(Ray s,Geo g,float pt,float obs,float h,float path,float ring,inout vec3 color,inout vec3 trans){
 float r=materialRadius(s.x),H=heightAt(r),z=abs(s.x.y)/H;if(g.r<=innerRadius()||r>=u_outer||z>=1.0)return;
 float density=(1.0-smoothstep(0.0,1.0,z))*smoothstep(innerRadius(),max(innerRadius()*1.2,1e-8),g.r)*(1.0-smoothstep(0.0,u_outer*.95,r));
 float delay=s.t*u_retardation;float time=u_noiseClock+delay*u_speedScale*u_motion*sqrt(u_mass);
 float noise=turbulence(s.x,r,path,time),radial=(r-u_inner)/(u_outer-u_inner);
 float thick=clamp(12.5*(u_heightOuter/u_outer-.08),0.0,1.0);
 float localDensity=pow(r*.5,-1.3)*smoothstep(innerRadius(),max(innerRadius()*1.2,1e-8),g.r)*mix(1.0,exp(u_verticalDensity*z),thick)*exp(u_edgeDensity*radial);
 float sigma=u_density*density*localDensity*pow(max(noise,0.0),u_noiseOpacity);
 float om=omega(max(g.r,u_isco));vec3 v=vec3(s.x.z,0.0,-s.x.x)*om;
 float lv=1.0+dot(g.l,v),norm=1.0-dot(v,v)-g.f*lv*lv;
 float emit=abs((pt+dot(s.p,v))*inversesqrt(max(norm,.01))),shift=obs/emit;
 float ringWeight=clamp(.3*ring-.1,0.0,1.0);
 float T=temperature(g.r)*mix(1.0,noise,u_tempNoise)*min(1.0,exp(-u_edgeCooling*radial));
 float visual=T*pow(shift*(1.0+u_ringBlue*ringWeight),u_shiftColor);
 float bright=pow(max(T/u_temperature,1e-6),u_tempIntensity)*pow(min(shift,u_shiftMax),u_shiftIntensity)*clamp((T*pow(shift,u_shiftColor)-473.0)/1527.0,0.0,1.0);
 bright*=min(1.0,exp(-u_edgeDarkening*(radial-1.0/3.0)*1.5))*(1.0+u_ringBoost*ringWeight);
 bright*=mix(1.0,noise,clamp(4.0*(u_heightInner*.5-.25),0.0,1.0)*u_noiseContrast);
 bright*=mix(1.0,max(0.0,.1*clamp(20.0-80.0*radial,1.0,1.0+u_verticalBoost*19.0)+.9*exp(u_verticalBoost*z)*pow(max(z,.001),u_verticalBoost)),thick);
 float ds=h*emit;vec3 extinction=vec3(1.0,1.0+2.0*u_reddening,1.0+5.0*u_reddening),absorb=1.0-exp(-sigma*ds*extinction);
 vec3 source=pow(blackbody(visual),vec3(u_colorPower))*bright*u_emission;
 if(u_illumination>0.0){
  float rg=r*.5,outer=u_outer*.5,innerScale=36.0*(outer/50.0)*(outer/50.0);
  float innerWeight=clamp((rg-1.0)/min(7.5,innerScale),0.0,1.0)*clamp((rg-1.0)/min(4.0,innerScale),0.0,1.0);
  float gradient=0.0;
  if(u_shadowContrast>0.0&&rg>12.0){float nr=r+2.0*u_shadowLength;vec3 projected=s.x*vec3(nr/r,1.0,nr/r);float other=turbulence(projected,nr,path,time);gradient=smoothstep(12.0,30.0,rg)*(other-noise)/(noise*u_shadowLength+.0001);}
  float illum=u_illumination*innerWeight*pow(min(shift,u_shiftMax),u_shiftIntensity)/(1.0+rg*rg*.01);
  illum*=exp(-u_illumRadial*max(0.0,(radial-1.0/3.0)*1.5))*mix(1.0,exp(u_illumVertical*z),thick)*(1.0+clamp(u_shadowContrast*gradient,-1.0,1.0));
  vec3 illumination=blackbody(u_temperature*u_illumTemperature)*illum;
  source+=illumination*sigma;
 }
 color+=trans*absorb*source;trans*=1.0-absorb;
}
void main(){
 vec2 uv=(2.0*gl_FragCoord.xy/u_resolution-1.0)*vec2(u_aspect,1.0);
 vec3 dir=normalize(u_basis*vec3(uv*tan(radians(u_fov)*.5),1.0));
 Geo g=geometry(u_camera);float ld=dot(g.l,dir);
 float kt=-(1.0+g.f*ld*ld)/(sqrt(1.0-g.f+g.f*ld*ld)+g.f*ld);
 float lk=ld+kt,pt=-kt+g.f*lk;
 Ray s=Ray(u_camera,dir+g.f*lk*g.l,0.0);
 float obs=pt*inversesqrt(1.0-g.f),horizon=u_mass*(1.0+sqrt(1.0-u_spin*u_spin));
 vec3 cons=invariants(s,g,pt),color=vec3(0.0),trans=vec3(1.0);float clipCoverage=0.0,path=0.0,ring=0.0,error=0.0,reason=0.0,steps=0.0;
 for(int i=0;i<1400;i++){
  steps=float(i);if(float(i)>=u_steps){reason=4.0;break;}
  Ray d=derivative(s,pt,g);float dr=dot(g.dr,d.x),speed=length(d.x),r=g.r;
  if(u_mass>0.0&&r<horizon*1.001){reason=1.0;break;}
  bool clipsPending=u_clips>.5&&path<u_clipFade+.4*u_clipSize*(1.0+u_clipSizeSpread)+u_clipWire;
  if(!clipsPending&&u_mass>0.0&&u_culling>.5&&r<innerRadius()*.997&&captured(r/u_mass,dr,cons,horizon/u_mass)){reason=1.0;break;}
  if(!clipsPending&&u_culling>.5&&escaped(s,g,d,pt,cons)){reason=2.0;break;}
  if(r>max(200.0,u_outer*3.0)&&dr>0.0){reason=2.0;break;}
  if(max(trans.r,max(trans.g,trans.b))<u_transCutoff&&!clipsPending){reason=3.0;break;}
  float curve=length(d.p)/max(length(s.p),.001);
  float h=u_mass>0.0?min(u_stepScale*max(.025*u_mass,r-horizon*.8)/max(speed,.001),sqrt(u_stepScale*.03*u_mass/max(curve,1e-6*u_mass))):4.0/max(speed,.001);
  h=min(h,4.0/max(speed,.001));
  float diskR=materialRadius(s.x),H=heightAt(diskR),gap=max(abs(s.x.y)-H,0.0);
  if(r>innerRadius()*.9&&diskR<u_outer*1.1){
   h=min(h,(gap+H*.3)/(abs(d.x.y)+.08*speed));
   if(gap<H*.3)h=min(h,u_volumeStep/max(speed,.001));
  }
  h=max(h,.0001*max(u_mass,1e-6));
  Ray next=rk4(s,pt,h,d);Geo ng=geometry(next.x);
  float dl=length(next.x-s.x),rd=(ng.r-r)/max(dl,1e-8);
  if(u_mass>0.0&&r<u_mass*(3.2+2.0*pow(u_spin,.666666))){
   float rot=clamp(1.0+u_ringRotation*dot(s.x-next.x,vec3(next.x.z,0.0,-next.x.x))/max(dl*length(next.x.xz),1e-8)*u_spin,0.0,2.0);
   ring+=dl/max(.5*(r+ng.r),.01)/(1.0+1000.0*rd*rd)*rot*clamp(11.0-10.0*(u_spin*u_spin),0.0,2.0);
  }
  Ray mid=Ray((s.x+next.x)*.5,(s.p+next.p)*.5,(s.t+next.t)*.5);
  if(min(diskR,materialRadius(next.x))<u_outer&&max(r,ng.r)>innerRadius()&&min(abs(s.x.y),abs(next.x.y))<max(H,heightAt(materialRadius(next.x)))+dl)volume(mid,geometry(mid.x),pt,obs,h,path+dl*.5,ring,color,trans);
  if(clipsPending){float footprint=max(.002,(path+dl*.5)*tan(radians(u_fov)*.5)/u_resolution.y);clipCoverage=max(clipCoverage,clipSegment(mid.x,materialRadius(mid.x),next.x-s.x,footprint));}
  if(clipCoverage>=1.0)break;
  float w=dot(ng.l,next.p)-pt,residual=abs(dot(next.p,next.p)-pt*pt-ng.f*w*w)/max(pt*pt,1e-8);error=max(error,residual);
  path+=dl;s=next;g=ng;
 }
 color=mix(color,vec3(u_clipBrightness),clipCoverage);
 if(u_debug>.5&&u_debug<1.5)color=vec3(steps/u_steps,steps/u_steps*.35,0.0);
 if(u_debug>1.5&&u_debug<2.5)color=reason<1.5?vec3(.08):reason<2.5?vec3(.0,.25,.5):reason<3.5?vec3(.15,.5,.15):vec3(1.0,0.0,.5);
 if(u_debug>2.5&&u_debug<3.5)color=vec3(clamp(error*10000.0,0.0,1.0),clamp(error*100.0,0.0,1.0),0.0);
 // RGBM 保留亮度范围，无需浮点帧缓冲扩展。
 color=max(color,vec3(0.0));float m=clamp(ceil(max(color.r,max(color.g,color.b))/32.0*255.0)/255.0,1.0/255.0,1.0);fragColor=vec4(clamp(color/(32.0*m),0.0,1.0),m);
}
