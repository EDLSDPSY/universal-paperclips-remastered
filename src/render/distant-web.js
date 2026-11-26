// 视线上距中心最近的点将外部区域分成前后两个壳层。
function cosmicShellSide(x,y,z,depth,extent,radius){const r2=x*x+y*y+z*z;return r2>radius*radius&&r2+5*extent*depth<0?1:-1;}
function cosmicShellCuts(a,b,extent,radius){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,aa=dx*dx+dy*dy+dz*dz,bb=2*(a.x*dx+a.y*dy+a.z*dz),cc=a.x*a.x+a.y*a.y+a.z*a.z,cuts=[0,1];
 if(aa>0)for(const [linear,constant]of [[bb,cc-radius*radius],[bb+5*extent*(b.depth-a.depth),cc+5*extent*a.depth]]){const d=linear*linear-4*aa*constant;if(d<0)continue;const root=Math.sqrt(d);for(const t of [(-linear-root)/(2*aa),(-linear+root)/(2*aa)])if(t>0&&t<1)cuts.push(t);}
 return cuts.sort((a,b)=>a-b);
}
const CosmicBounds=(()=>{
 let instance=null,used=0,disabled=!STELLAR_CULL_MODULE;const cache=new WeakMap(),selections=new WeakMap(),gathers=new WeakMap();
 function allocate(bytes){const at=used;used+=Math.ceil(bytes/8)*8;const memory=instance.memory;if(used>memory.buffer.byteLength)memory.grow(Math.ceil((used-memory.buffer.byteLength)/65536));return at;}
 function packed(array){let p=cache.get(array);if(!p){p={at:allocate(array.byteLength),out:0};new Uint8Array(instance.memory.buffer,p.at,array.byteLength).set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));cache.set(array,p);}return p;}
 function select(boxes,count,extent,limit){
  let selected=selections.get(boxes);if(!selected){selected={data:new Uint32Array(boxes.length/7),count:0,at:0};selections.set(boxes,selected);}
  const {ca,sa,ce,se}=prepareStellarProjection(),focal=Math.min(vw*.4,vh*.47)*5;
  if(!disabled)try{
   if(!instance)instance=new WebAssembly.Instance(STELLAR_CULL_MODULE).exports;const p=packed(boxes);if(!p.out)p.out=allocate(boxes.length/7*4);
   const n=instance.boxes(p.at,count,p.out,ca,sa,ce,se,extent,vw,vh,focal,limit);selected.data.set(new Uint32Array(instance.memory.buffer,p.out,n));selected.count=n;selected.at=p.out;return selected;
  }catch(error){disabled=true;console.warn('Cosmic culling:',error);}
  const eye=5*extent;let n=0;
  for(let i=0;i<count;i++){
   const k=i*7,x=boxes[k],y=boxes[k+1],z=boxes[k+2],padding=(boxes[k+6]+extent)*.04,hx=boxes[k+3]+padding,hy=boxes[k+4]+padding,hz=boxes[k+5]+padding,depth=(x*sa+y*ca)*ce+z*se,reach=Math.abs(sa*ce)*hx+Math.abs(ca*ce)*hy+Math.abs(se)*hz;
   if(depth-reach>=limit||depth+reach< -4.8*extent)continue;
   const px=x*ca-y*sa,py=(x*sa+y*ca)*se-z*ce,rx=Math.abs(ca)*hx+Math.abs(sa)*hy,ry=Math.abs(sa*se)*hx+Math.abs(ca*se)*hy+Math.abs(ce)*hz,far=eye+depth+reach;
   if((Math.abs(px)-rx)*focal>(vw*.5+2)*far||(Math.abs(py)-ry)*focal>(vh*.51+2)*far)continue;selected.data[n++]=i;
  }
  selected.count=n;return selected;
 }
 function indices(selected){return selected.data.subarray(0,selected.count);}
 function gather(selected,index,n){
  if(!disabled)try{const ids=packed(index.cellIds),offsets=packed(index.cellOffsets);if(!ids.mask){ids.mask=allocate(Math.ceil(n/32)*4);ids.gathered=allocate(n*4);}const count=instance.gather(selected.at,selected.count,offsets.at,ids.at,ids.mask,ids.gathered,Math.ceil(n/32));return new Uint32Array(instance.memory.buffer,ids.gathered,count);}catch(error){disabled=true;console.warn('Cosmic indices:',error);}
  let data=gathers.get(index);if(!data){data={mask:new Uint32Array(Math.ceil(n/32)),ids:new Uint32Array(n)};gathers.set(index,data);}data.mask.fill(0);
  for(const b of indices(selected)){const start=index.cellOffsets[b*2],end=start+index.cellOffsets[b*2+1];for(let j=start;j<end;j++){const id=index.cellIds[j];data.mask[id>>>5]|=1<<(id&31);}}
  let count=0;for(let w=0;w<data.mask.length;w++){let bits=data.mask[w];while(bits){const bit=bits&-bits;data.ids[count++]=w*32+31-Math.clz32(bit);bits^=bit;}}return data.ids.subarray(0,count);
 }
 return {select,indices,gather,get accelerated(){return !disabled;}};
})();
function cosmicViewChanged(view,extent){return !view||view.width!==vw||view.height!==vh||Math.abs(view.yaw-viewYaw)+Math.abs(view.pitch-viewPitch)>.015||Math.abs(extent/view.extent-1)>.005;}
function cosmicViewKey(extent){return {yaw:viewYaw,pitch:viewPitch,extent,width:vw,height:vh};}
const CosmicLines=(()=>{
 let filamentCount=0,web=null,segments=null,canvas=null,gl=null,program=null,buffer=null,particleBuffer=null,particleVertices=null,vertices=null,anchor=null,geometryTexture=null,textureSize=null,instance=null,stepBuffer=null,failed=false,locations={};
 let radialIndex=null,visibleIds=null,visibleCount=0,drawOffset=0,lastBin=-1,elementBuffer=null,indexExtension=null;
 let allSegments=null,lineByRadius=null,lineBoxes=null;
 let foreground=null,particleSelection=null,lineSelection=null,particleDrawCount=0,lineUploadDirty=true,lost=false,cpuWork={lines:0,particles:0};
 function drawParticleBlocks(extent){
  const n=particleVertices.length/4,focal=Math.min(vw*.4,vh*.47)*5,eye=5*extent/web.unit,limit=.12*focal/.9-eye;
  if(!indexExtension){particleDrawCount=n;gl.drawArrays(gl.POINTS,0,n);return;}
  if(cosmicViewChanged(particleSelection,extent)){
   const selected=CosmicBounds.select(radialIndex.boxes,radialIndex.boxes.length/7,extent/web.unit,limit),indices=CosmicBounds.gather(selected,radialIndex,n);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.DYNAMIC_DRAW);particleDrawCount=indices.length;particleSelection=cosmicViewKey(extent);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer);gl.drawElements(gl.POINTS,particleDrawCount,gl.UNSIGNED_INT,0);
 }
 const steps=8,cpuLines=8000,cpuParticles=12000;
 function geometry(){if(web)return web;web=createCosmicWeb(COSMIC_FAR_GEOMETRY);segments=[];const particles=[],random=StellarSpace.random,normal=s=>Math.sqrt(-2*Math.log(Math.max(1e-9,random(s))))*Math.cos(2*Math.PI*random(s+1));
  let root=0,score=-Infinity;for(let i=0;i<web.nodes.length/4;i++){const p=web.warp({x:web.nodes[i*4],y:web.nodes[i*4+1],z:web.nodes[i*4+2]}),d=Math.hypot(p.x,p.y,p.z);if(d>3)continue;let density=web.nodes[i*4+3];for(const j of web.neighbors[i])density+=web.nodes[j*4+3]*Math.exp(-Math.hypot(web.nodes[j*4]-web.nodes[i*4],web.nodes[j*4+1]-web.nodes[i*4+1],web.nodes[j*4+2]-web.nodes[i*4+2])/.8);if(density>score){score=density;root=i;anchor=p;}}
  const sample=web.sample;web.sample=(c,t)=>{const p=sample(c,t);return {x:p.x-anchor.x,y:p.y-anchor.y,z:p.z-anchor.z};};
  for(let id=0;id<web.edges.length/3;id++){const c=web.curve(id);if(!c.length)continue;const points=[],width=.02+.03*Math.min(2,Math.sqrt(c.strength)),count=Math.max(4,Math.min(48,Math.ceil(c.length*32)));
   for(let j=0;j<=steps;j++){const p=web.sample(c,j/steps);points.push(p.x,p.y,p.z);}
   for(let j=0;j<count;j++){const t=(j+.5)/count,p=web.sample(c,t),extra=1+9*(1-smoothStep(Math.hypot(p.x,p.y,p.z)/.75));for(let k=0;k<Math.ceil(extra);k++){const s=id*619+j*113+k*17+73397;if(k>extra-1&&random(s+8)>extra-k)continue;const q=web.sample(c,(j+(k+.5)/extra)/count);particles.push(q.x+width*normal(s),q.y+width*normal(s+2),q.z+width*normal(s+4),Math.min(.9,(.2+.5*random(s+6))*(.3+.7*c.strength)));}}
   segments.push({points,strength:c.strength,centre:web.sample(c,.5),index:segments.length});
  }
  filamentCount=particles.length/4;
  for(let id=0;id<web.nodes.length/4;id++){if(id===root)continue;const p=web.warp({x:web.nodes[id*4],y:web.nodes[id*4+1],z:web.nodes[id*4+2]}),strength=web.nodes[id*4+3],width=.25+.2*Math.min(2,Math.sqrt(strength)),seed=id*197+19171,count=Math.ceil((8+Math.floor(12*strength))*(1+9*(1-smoothStep(Math.hypot(p.x-anchor.x,p.y-anchor.y,p.z-anchor.z)/.75))));for(let i=0;i<count;i++){const s=seed+i*19;particles.push(p.x-anchor.x+width*normal(s),p.y-anchor.y+width*normal(s+2),p.z-anchor.z+width*normal(s+4),(.25+.5*random(s+6))*Math.min(1.3,.3+strength*.5));}}
  const localScale=CosmicWeb.unit/web.unit;for(const g of CosmicWeb.groups){const points=CosmicWeb.particles(g);for(let i=0;i<points.length;i+=5){if(points[i+4]>.02)break;const x=(points[i]-StellarSpace.settings.solarRadius)/CosmicWeb.unit,y=points[i+1]/CosmicWeb.unit,z=points[i+2]/CosmicWeb.unit,d=Math.hypot(x,y,z)*CosmicWeb.unit,edge=1-smoothStep((d/CosmicWeb.extent-.75)/.25);if(edge)particles.push(x*localScale,y*localScale,z*localScale,-points[i+3]*edge);}}
  particleVertices=new Float32Array(particles);radialIndex=indexCosmicParticles(particleVertices);return web;
 }
 function selectParticles(extent){const bin=Math.min(radialIndex.offsets.length-1,Math.ceil(5.5*extent/web.unit/.025)+1);if(bin!==lastBin){lastBin=bin;const count=radialIndex.offsets[bin],ranges=radialIndex.ranges;let lo=0,hi=ranges.length/2-1;while(lo<hi){const mid=(lo+hi)>>>1;if(ranges[mid*2]<count)lo=mid+1;else hi=mid;}visibleCount=count?ranges[lo*2]:0;drawOffset=ranges[lo*2+1];visibleIds=visibleCount===particleVertices.length/4?null:radialIndex.ordered.subarray(drawOffset,drawOffset+visibleCount);}return visibleCount;}
 function init(){
  if(!canvas){canvas=document.createElement('canvas');canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;SceneTimers.reset(gl);viewDirty=true;});canvas.addEventListener('webglcontextrestored',()=>{lost=false;failed=false;gl=null;particleSelection=null;lineUploadDirty=true;viewDirty=true;});}
  gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');particleSelection=null;lineUploadDirty=true;
  indexExtension=gl.getExtension('OES_element_index_uint');elementBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elementBuffer);lastBin=-1;instance=gl.getExtension('ANGLE_instanced_arrays');if(!instance||!gl.getExtension('OES_texture_float')||!gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS))throw Error('Vertex textures unavailable');
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,`precision highp float;attribute vec4 point;attribute float segment;attribute float step;uniform sampler2D geometry;uniform vec2 geometrySize;uniform vec4 rotation;uniform vec2 screen;uniform float extent;uniform vec3 primitive;uniform vec4 view;uniform float shell;varying vec3 world;varying float density;varying float depth;varying float lineMix;
  void main(){vec4 p=point;if(primitive.x>.5){float id=segment*9.+step;p=texture2D(geometry,(vec2(mod(id,geometrySize.x),floor(id/geometrySize.x))+.5)/geometrySize);}world=p.xyz;density=p.w;float x=p.x*rotation.x-p.y*rotation.y;float y=p.x*rotation.y+p.y*rotation.x;float sy=y*rotation.w-p.z*rotation.z;depth=y*rotation.z+p.z*rotation.w;float distance=5.0*extent+depth;float focal=min(screen.x*.4,screen.y*.47)*5.0;float perspective=focal/max(distance,.2*extent);density=p.w<0.?-p.w*smoothstep(.5,2.,view.w*perspective):p.w;lineMix=1.-smoothstep(.9,1.4,primitive.z*perspective);gl_PointSize=1.1*primitive.y;gl_Position=vec4(2.0*x*perspective/screen.x,.02-2.0*sy*perspective/screen.y,0.,1.);if(shell!=0.)gl_Position*=max(distance,.2*extent);if(distance<.2*extent)density=0.;}`));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`precision highp float;uniform vec3 tint;uniform float transportFade;uniform float shell;uniform vec4 region;uniform vec4 view;uniform vec3 primitive;varying vec3 world;varying float density;varying float depth;varying float lineMix;
  float nearFade(float r,float z,float radius){if(z>=0.)return 0.;float eye=5.*view.y,sphere=min(radius,eye*.85),forward=eye+z;if(sphere<=0.||forward<=view.y*.2)return 0.;float cone=max(0.,r*r-z*z)*(eye*eye-sphere*sphere)/(forward*forward*sphere*sphere);return smoothstep(0.,sphere*.6,-z)*(1.-smoothstep(.25,.81,cone));}
  float edgeFade(float r,float radius,float start,float near){float from=mix(start,.97,near);return 1.-smoothstep(radius*from,radius,r);}
  void main(){float r=length(world);bool front=r>region.x&&dot(world,world)+5.*view.y*depth<0.;if(shell<-.5&&front||shell>.5&&!front)discard;float near=nearFade(r,depth,min(view.y*5.5,region.w)),fineNear=nearFade(r,depth,min(region.z,min(view.y*5.5,region.w)));float local=edgeFade(r,region.z,.75,fineNear),fog=exp(-.5*pow(depth/(view.y*.85),2.));float alpha=view.x*density*mix(fog,1.,near*.85)*(1.-view.z*local)*edgeFade(r,region.w,.65,near);alpha*=edgeFade(r,view.y*5.5,4.5/5.5,near);if(r>region.y)alpha*=.18;if(r<=region.x)alpha*=1.-transportFade;alpha*=primitive.x>.5?lineMix:1.-lineMix;alpha=min(.95,alpha*(1.+1.5*(1.-smoothstep(0.,.75,r))));if(primitive.x>.5){float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);alpha*=.4+.6*grain;}vec3 color=r<=region.x?vec3(140.,7.,13.)/255.:tint;if(alpha<.002)discard;gl_FragColor=vec4(color*alpha,alpha);}`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));buffer=gl.createBuffer();particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,particleVertices,gl.STATIC_DRAW);for(const key of ['rotation','screen','extent','tint','region','view','primitive','geometry','geometrySize','transportFade','shell'])locations[key]=gl.getUniformLocation(program,key);for(const key of ['point','segment','step'])locations[key]=gl.getAttribLocation(program,key);
  allSegments=allSegments||segments;const w=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE)),h=Math.ceil(allSegments.length*(steps+1)/w),data=new Float32Array(w*h*4);for(const s of allSegments)for(let j=0;j<=steps;j++){const n=(s.index*(steps+1)+j)*4;data[n]=s.points[j*3];data[n+1]=s.points[j*3+1];data[n+2]=s.points[j*3+2];const t=j/steps,junction=1+.8*(1-smoothStep(Math.min(t,1-t)/.25));data[n+3]=Math.min(.65,(.045+.14*s.strength)*junction);}textureSize=[w,h];geometryTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,geometryTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.FLOAT,data);
  const indices=new Float32Array(steps*2);for(let i=0;i<steps;i++){indices[i*2]=i;indices[i*2+1]=i+1;}stepBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,stepBuffer);gl.bufferData(gl.ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 }
 function order(extent){
  if(!lineByRadius){allSegments=allSegments||segments;for(const s of allSegments){let minimum=Infinity;for(let i=0;i<steps;i++){const k=i*3,x=s.points[k],y=s.points[k+1],z=s.points[k+2],dx=s.points[k+3]-x,dy=s.points[k+4]-y,dz=s.points[k+5]-z,d=dx*dx+dy*dy+dz*dz,t=d?clamp(-(x*dx+y*dy+z*dz)/d,0,1):0;minimum=Math.min(minimum,Math.hypot(x+dx*t,y+dy*t,z+dz*t));}s.minimum=minimum;let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;for(let k=0;k<s.points.length;k+=3){x0=Math.min(x0,s.points[k]);x1=Math.max(x1,s.points[k]);y0=Math.min(y0,s.points[k+1]);y1=Math.max(y1,s.points[k+1]);z0=Math.min(z0,s.points[k+2]);z1=Math.max(z1,s.points[k+2]);}s.box=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,(x1-x0)/2+1e-5,(y1-y0)/2+1e-5,(z1-z0)/2+1e-5,Math.hypot((x0+x1)/2,(y0+y1)/2,(z0+z1)/2)];}lineByRadius=allSegments.slice().sort((a,b)=>a.minimum-b.minimum);lineBoxes=new Float32Array(lineByRadius.length*7);for(let i=0;i<lineByRadius.length;i++)lineBoxes.set(lineByRadius[i].box,i*7);}
  if(cosmicViewChanged(lineSelection,extent)){
   const bin=Math.ceil(Math.min(5.5*extent,OBSERVABLE_RADIUS)/web.unit/.025)+1;let lo=0,hi=lineByRadius.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(lineByRadius[mid].minimum<=bin*.025*1.01)lo=mid+1;else hi=mid;}
   const selected=CosmicBounds.select(lineBoxes,lo,extent/web.unit,Infinity);segments=Array.from(CosmicBounds.indices(selected),i=>lineByRadius[i]);
   const {ca,sa,ce,se}=prepareStellarProjection();
   for(const s of segments)s.depth=(s.centre.x*sa+s.centre.y*ca)*ce+s.centre.z*se;sortStellarDepth(segments);
   if(!vertices||vertices.length<segments.length)vertices=new Float32Array(segments.length);for(let i=0;i<segments.length;i++)vertices[i]=segments[i].index;
   lineSelection=cosmicViewKey(extent);lineUploadDirty=true;
  }
  if(gl&&!lost&&!failed&&screenRenderer?.mode!=='cpu'&&lineUploadDirty){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,segments.length),gl.DYNAMIC_DRAW);lineUploadDirty=false;}
 }
 function queueShellPaths(extent,coverage,shell,amount,paths){
  const unit=web.unit,eye=5*extent;
  for(let i=0,stride=Math.max(1,Math.ceil(segments.length/cpuLines));i<segments.length;i+=stride){const s=segments[i];let a=null;for(let j=0;j<=steps;j+=2){
   const x=s.points[j*3]*unit,y=s.points[j*3+1]*unit,z=s.points[j*3+2]*unit,q=universeProject(StellarSpace.settings.solarRadius+x,y,z,extent),b={x,y,z,depth:q.depth};
   if(a&&eye+a.depth>extent*.2&&eye+b.depth>extent*.2){const cuts=cosmicShellCuts(a,b,extent,coverage.radius);
    for(let k=1;k<cuts.length;k++){const lo=cuts[k-1],hi=cuts[k],t=(lo+hi)/2,mx=a.x+(x-a.x)*t,my=a.y+(y-a.y)*t,mz=a.z+(z-a.z)*t,depth=a.depth+(b.depth-a.depth)*t;if(cosmicShellSide(mx,my,mz,depth,extent,coverage.radius)!==shell)continue;
     const opacity=amount(mx/unit,my/unit,mz/unit,depth)*Math.min(.45,.045+.14*s.strength)*.7;if(opacity<.008)continue;
     const red=Math.hypot(mx,my,mz)<=coverage.radius,path=paths[(red?8:0)+Math.min(7,Math.floor(opacity*16))],p=universeProject(StellarSpace.settings.solarRadius+a.x+(x-a.x)*lo,a.y+(y-a.y)*lo,a.z+(z-a.z)*lo,extent),r=universeProject(StellarSpace.settings.solarRadius+a.x+(x-a.x)*hi,a.y+(y-a.y)*hi,a.z+(z-a.z)*hi,extent);path.moveTo(p.x,p.y);path.lineTo(r.x,r.y);
    }
   }a=b;
  }}
 }
 // CPU 只采样固定数量的粒子，纤维的骨架一直绘制。
 function cpu(extent,alpha,coverage,resolved,shell=0){
  const inherited=vctx.globalAlpha,paths=Array.from({length:16},()=>new Path2D()),unit=web.unit,u=game.state.s,reachable=u.horizonKnown?u.radius+game.frontierBeta()*PaperclipModel.remainingLight(u.years):Infinity;cpuWork={lines:Math.ceil(segments.length/Math.max(1,Math.ceil(segments.length/cpuLines))),particles:0};
  const amount=(x,y,z,depth)=>{const d=Math.hypot(x,y,z)*unit,near=stellarNearFade(d,depth,extent,Math.min(extent*5.5,OBSERVABLE_RADIUS)),fineNear=stellarNearFade(d,depth,extent,Math.min(CosmicWeb.extent,extent*5.5,OBSERVABLE_RADIUS)),local=stellarEdgeFade(d,CosmicWeb.extent,.75,fineNear);return transportSourceOpacity(d)*alpha*stellarDepthFade(depth,extent,near)*(1-resolved*local)*stellarEdgeFade(d,OBSERVABLE_RADIUS,.65,near)*stellarEdgeFade(d,extent*5.5,4.5/5.5,near)*(d>reachable?.18:1)*(1+1.5*(1-smoothStep(d/(unit*.75))));};
  if(shell)queueShellPaths(extent,coverage,shell,amount,paths);
  else for(let si=0,stride=Math.max(1,Math.ceil(segments.length/cpuLines));si<segments.length;si+=stride){const s=segments[si],c=s.centre,d=Math.hypot(c.x,c.y,c.z)*unit,q=universeProject(StellarSpace.settings.solarRadius+c.x*unit,c.y*unit,c.z*unit,extent);if(q.depth>2.5*extent||q.depth< -4.8*extent)continue;const a=amount(c.x,c.y,c.z,q.depth)*Math.min(.45,.045+.14*s.strength)*.7;if(a<.008)continue;const red=d<=coverage.radius,index=(red?8:0)+Math.min(7,Math.floor(a*16)),path=paths[index];let p=null;for(let i=0;i<=steps;i+=2){const v=universeProject(StellarSpace.settings.solarRadius+s.points[i*3]*unit,s.points[i*3+1]*unit,s.points[i*3+2]*unit,extent);if(v.depth> -4.8*extent){if(p)path.lineTo(v.x,v.y);else path.moveTo(v.x,v.y);p=v;}else p=null;}}
  vctx.lineWidth=.65;for(let i=0;i<16;i++){vctx.globalAlpha=inherited*((i%8+.5)/16);vctx.strokeStyle=i>=8?'rgb(140,7,13)':'rgb('+visualRGB+')';vctx.stroke(paths[i]);}vctx.globalAlpha=inherited;
  const nearest=Math.max(.2*extent/unit,5*extent/unit-OBSERVABLE_RADIUS/unit);if(.12*Math.min(vw*.4,vh*.47)*5/nearest<=.9)return;
  selectParticles(extent);const stride=Math.max(1,Math.ceil(visibleCount/cpuParticles));cpuWork.particles=Math.ceil(visibleCount/stride);for(let pi=0;pi<visibleCount;pi+=stride){const i=(visibleIds?visibleIds[pi]:pi)*4,x=particleVertices[i],y=particleVertices[i+1],z=particleVertices[i+2],q=universeProject(StellarSpace.settings.solarRadius+x*unit,y*unit,z*unit,extent,StellarSpace.settings.solarRadius,stellarPoint);if(!q.visible||q.depth>2.5*extent)continue;if(shell&&cosmicShellSide(x*unit,y*unit,z*unit,q.depth,extent,coverage.radius)!==shell)continue;const mix=smoothStep((.12*unit*Math.min(vw*.4,vh*.47)*5/(extent*5+q.depth)-.9)/.5);if(!mix)continue;const source=particleVertices[i+3],detail=source<0?smoothStep((CosmicWeb.unit*.025*Math.min(vw*.4,vh*.47)*5/(extent*5+q.depth)-.5)/1.5):1,brightness=amount(x,y,z,q.depth)*mix*Math.abs(source)*detail;if(brightness<.003)continue;const n=stellarDrawQueue.length,p=stellarDrawPool[n]||(stellarDrawPool[n]={});p.fieldDistance=-1;p.x=q.x;p.y=q.y;p.depth=q.depth;p.size=1.1;p.brightness=inherited*brightness;p.developed=stellarCoverage(Math.hypot(x,y,z)*unit,coverage);stellarDrawQueue.push(p);}
 }
 function draw(extent,alpha,coverage,resolved,layer=0){
  if(!web&&!CosmicParticles.failed){CosmicParticles.prepare();return;}
  geometry();const shell=game.state.s.transportProgress>0?(layer||-1):0;if(shell===-1)foreground=[extent,alpha,coverage,resolved,1];if(!failed&&!lost&&screenRenderer?.mode!=='cpu')try{
   if(!gl)init();order(extent);const w=Math.round(vw*vscale),h=Math.round(vh*vscale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}SceneTimers.begin(gl);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform1f(locations.shell,shell);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   const unit=web.unit,u=game.state.s,reachable=u.horizonKnown?u.radius+game.frontierBeta()*PaperclipModel.remainingLight(u.years):1e15,rotation=prepareStellarProjection();
   gl.uniform1f(locations.transportFade,transportDissolve());gl.uniform4f(locations.rotation,rotation.ca,rotation.sa,rotation.ce,rotation.se);gl.uniform2f(locations.screen,vw,vh);gl.uniform1f(locations.extent,extent/unit);gl.uniform3fv(locations.tint,visualRGB.split(',').map(n=>Number(n)/255));gl.uniform4f(locations.region,u.radius/unit,reachable/unit,CosmicWeb.extent/unit,OBSERVABLE_RADIUS/unit);gl.uniform4f(locations.view,alpha*vctx.globalAlpha,extent/unit,resolved,CosmicWeb.unit*.025/unit);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,geometryTexture);gl.uniform1i(locations.geometry,0);gl.uniform2fv(locations.geometrySize,textureSize);gl.disableVertexAttribArray(locations.point);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(locations.segment);gl.vertexAttribPointer(locations.segment,1,gl.FLOAT,false,0,0);instance.vertexAttribDivisorANGLE(locations.segment,1);gl.bindBuffer(gl.ARRAY_BUFFER,stepBuffer);gl.enableVertexAttribArray(locations.step);gl.vertexAttribPointer(locations.step,1,gl.FLOAT,false,0,0);gl.uniform3f(locations.primitive,1,vscale,.12);instance.drawArraysInstancedANGLE(gl.LINES,0,steps*2,segments.length);
   gl.disableVertexAttribArray(locations.segment);gl.disableVertexAttribArray(locations.step);instance.vertexAttribDivisorANGLE(locations.segment,0);gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);gl.enableVertexAttribArray(locations.point);gl.vertexAttribPointer(locations.point,4,gl.FLOAT,false,0,0);const nearest=Math.max(.2*extent/unit,5*extent/unit-OBSERVABLE_RADIUS/unit),width=.12*Math.min(vw*.4,vh*.47)*5/nearest;if(width>.9){gl.uniform3f(locations.primitive,0,vscale,.12);drawParticleBlocks(extent);}
   SceneTimers.end(gl);vctx.save();vctx.globalAlpha=1;vctx.drawImage(canvas,0,0,vw,vh);vctx.restore();return;
  }catch(error){failed=true;console.error('Cosmic lines:',error);}order(extent);cpu(extent,alpha,coverage,resolved,shell);
 }
 function acceptMesh(mesh){web={unit:COSMIC_FAR_GEOMETRY.unit};const centres=new Float32Array(mesh.centres),lines=new Float32Array(mesh.lines);particleVertices=new Float32Array(mesh.particles);filamentCount=mesh.filaments;radialIndex={ids:new Uint32Array(mesh.ids),offsets:new Uint32Array(mesh.offsets),ordered:new Uint32Array(mesh.ordered),ranges:new Uint32Array(mesh.ranges),cellIds:new Uint32Array(mesh.cellIds),cellOffsets:new Uint32Array(mesh.cellOffsets),boxes:new Float32Array(mesh.boxes)};lastBin=-1;segments=Array.from({length:centres.length/4},(_,i)=>({index:i,centre:{x:centres[i*4],y:centres[i*4+1],z:centres[i*4+2]},strength:centres[i*4+3],points:lines.subarray(i*(steps+1)*3,(i+1)*(steps+1)*3)}));}
 function transportSample(radius){if(!particleVertices)return null;const unit=web.unit,result=[],eligible=[],r2=(radius/unit)**2;for(let k=0;k<particleVertices.length;k+=4)if(particleVertices[k]**2+particleVertices[k+1]**2+particleVertices[k+2]**2<=r2)eligible.push(k);const stride=Math.max(1,eligible.length/10000);for(let i=0;i<eligible.length;i+=stride){const k=eligible[Math.floor(i)];result.push({x:particleVertices[k]*unit+StellarSpace.settings.solarRadius,y:particleVertices[k+1]*unit,z:particleVertices[k+2]*unit,brightness:Math.abs(particleVertices[k+3])});}return result;}
 return {draw,flushForeground(){if(foreground){const args=foreground;foreground=null;draw(...args);flushStellarPoints();}},geometry,acceptMesh,transportSample,get ready(){return !!web;},get gpuMS(){return SceneTimers.mean(gl);},get gpu(){return !!gl&&!failed&&!lost;},get particleCount(){return particleVertices?.length/4||0;},get selectedParticles(){return particleDrawCount;},get selectedLines(){return segments?.length||0;},get cpuWork(){return {...cpuWork};}};
})();
function drawDistantCosmicWeb(extent,alpha,coverage,resolved){CosmicLines.draw(extent,alpha,coverage,resolved);}
