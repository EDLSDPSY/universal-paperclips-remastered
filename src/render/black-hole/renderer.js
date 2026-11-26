// 先用低分辨率追踪 Kerr–Newman 光路，再把结果放大到全屏。回形针和发光气体都沿这些光路采样。
const BH_DEFAULTS={"fxCRT":1,"fxNoise":1,"fxRGB":1,"fxBloom":1,"fxCurve":1,"fxVignette":1,"fxBase":1,"fxGlass":1,"theme":0,"grain":0.022,"dispersion":1,"phosphor":1,"baseTint":1,"glass":0.5,"colorPower":1.5,"illumination":0.18,"illumTemperature":0.7,"illumRadial":0,"illumVertical":0,"shadowContrast":0.8,"shadowLength":1,"spin":0.998,"inner":4.2,"outer":80,"heightInner":0.4,"heightOuter":0.75,"temperature":11000,"density":100,"emission":1.6,"reddening":0.6,"tempIntensity":1,"shiftColor":3,"shiftIntensity":2.5,"shiftMax":1.25,"tempNoise":0.2,"edgeDarkening":4,"edgeCooling":1,"edgeDensity":2.4,"verticalDensity":-1,"verticalBoost":1.5,"ringBoost":10,"ringBlue":0.25,"ringRotation":0,"noiseR":2.4,"noiseV":2,"noiseSpiral":1.1,"noiseTwist":860,"noiseShear":0.08,"noiseContrast":1,"noisePower":5,"noiseOpacity":1.5,"octaves":3,"octaveGain":0.8,"distortionX":0,"distortionY":0,"distortionZ":1,"noiseBegin":36,"noiseEnd":72,"noiseSpeed":1,"noiseLOD":1,"motion":1,"retardation":1,"clips":1,"clipSpacing":0.5,"clipScatter":1,"clipSizeSpread":0,"clipSeed":3258,"clipSize":0.2,"clipWire":0.005,"clipOpacity":1,"clipBrightness":0.5,"clipFade":24,"clipFadeStart":0,"clipFadePower":1,"tumble":0,"stepScale":0.4,"volumeStep":1,"steps":1200,"culling":1,"transCutoff":0.003,"debug":0,"fov":30,"cameraX":11.763228241610198,"cameraY":0.652457633858101,"cameraZ":39.90173490013885,"yaw":-0.3140004272460926,"pitch":-0.046000213623047084,"roll":0.23630000000001775,"flySpeed":2.7067056647322514,"style":1,"pixelSize":7,"dotSize":5,"asciiSize":5,"rawSize":4,"gap":0,"levels":12,"dotRadius":0.32,"asciiSamples":2,"asciiPreserve":0,"asciiLines":1,"asciiGamma":0.4,"asciiGain":1.6,"asciiInk":0,"exposure":1,"contrast":0.9,"saturation":0.65,"palette":1,"tone":0,"black":0,"dark":0.8,"light":1,"background":0.7,"bloom":1,"curve":0.022,"scanlines":1,"vignette":1,"uiOpacity":0.78,"fps":15,"paused":0,"mass":1,"speedScale":2,"clipOrbitScale":0.25,"evapSpeed":1};
const BH_DEFAULT_TIME=80.17289999999545;
const BH_PRESETS={
 '低像素色块':{style:0,pixelSize:9,palette:1,contrast:1.05,exposure:1.1,gap:0,levels:12,background:.7,bloom:.14},
 '荧光点阵':{style:1,dotSize:5,palette:2,exposure:1.7,contrast:.9,dotRadius:.38,background:.85,bloom:.28},
 '终端 ASCII':{style:2,asciiSize:9,palette:1,exposure:1.5,asciiGamma:.65,asciiGain:2.4,background:.9,bloom:0},
 '冷色终末':{style:0,pixelSize:5,palette:3,exposure:1.0,contrast:1.15,gap:.1,levels:16,background:.8,bloom:.1},
 '黑体参考':{style:3,rawSize:3,palette:0,saturation:1,exposure:.5,contrast:1,background:1,bloom:0}
};
const BH_POST_KEYS=new Set(['fxCRT','fxNoise','fxRGB','fxBloom','fxCurve','fxVignette','fxBase','fxGlass','theme','grain','dispersion','phosphor','baseTint','glass','asciiSamples','asciiPreserve','asciiLines','style','pixelSize','dotSize','asciiSize','rawSize','gap','levels','dotRadius','asciiGamma','asciiGain','asciiInk','exposure','contrast','saturation','palette','tone','black','dark','light','background','bloom','curve','scanlines','vignette','uiOpacity','fps','paused','flySpeed','evapSpeed','speedScale','clipOrbitScale','motion']);
class BlackHoleRenderer{
 constructor(canvas,params={},options={}){
  this.canvas=canvas;this.options=options;this.screenInk=[1,.57,.12];this.params={...BH_DEFAULTS,...params};this.normalize();this.diskISCO=this.isco();this.time=BH_DEFAULT_TIME;this.frames=0;this.traceDirty=true;this.postDirty=true;this.lastTrace=-Infinity;this.pendingQueries=[];this.gpuMS=null;
  const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  if(!gl)throw Error(copyLocalized('renderer.webgl2-chrome-edge'));
  this.timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const live=new Set(['mass','paused','evapSpeed']);
  const vert='#version 300 es\nprecision highp float;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}';
  const vertex=gl.createShader(gl.VERTEX_SHADER);gl.shaderSource(vertex,vert);gl.compileShader(vertex);this.parallel=options.deferCompile?gl.getExtension('KHR_parallel_shader_compile'):null;
  this.programs={};for(const [name,source]of Object.entries(BH_SHADERS)){
   const used=new Set(source.match(/\bu_\w+/g)),declarations=Object.keys(BH_DEFAULTS).filter(k=>used.has('u_'+k)).map(k=>options.specialize&&!live.has(k)?'#define u_'+k+' ('+(Number.isInteger(this.params[k])?this.params[k]+'.0':this.params[k])+')':'uniform float u_'+k+';').join('\n');
   let fragment=source.replace('/*__PARAMS__*/',declarations);
   if(options.specialize){const literal=v=>Number.isInteger(v)?v+'.0':String(v);fragment=fragment.replace('uniform vec3 u_camera;','const vec3 u_camera=vec3('+[this.params.cameraX,this.params.cameraY,this.params.cameraZ].map(literal).join(',')+');').replace('uniform mat3 u_basis;','const mat3 u_basis=mat3('+this.basis().map(literal).join(',')+');');}
   const program=gl.createProgram(),shader=gl.createShader(gl.FRAGMENT_SHADER);gl.shaderSource(shader,fragment);gl.compileShader(shader);gl.attachShader(program,vertex);gl.attachShader(program,shader);gl.linkProgram(program);gl.deleteShader(shader);this.programs[name]={program,uniforms:{}};
  }
  gl.deleteShader(vertex);if(!options.deferCompile)this.finishCompilation();
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  this.scene=gl.createTexture();this.fbo=gl.createFramebuffer();this.scanTexture=gl.createTexture();this.screenMask=null;this.scanImage=undefined;
  this.phaseTexture=gl.createTexture();this.phaseTextureSize=0;
  this.noise=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.noise);let seed=19690531;const bytes=new Uint8Array(16*16*2);for(let i=0;i<bytes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed>>>24;}
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RG8,16,16,0,gl.RG,gl.UNSIGNED_BYTE,bytes);this.textureParams(gl.LINEAR,gl.REPEAT);
  this.glyphs=gl.createTexture();const atlas=document.createElement('canvas');atlas.width=20*16;atlas.height=24;const ctx=atlas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,atlas.width,atlas.height);ctx.fillStyle='#fff';ctx.font='bold 20px monospace';ctx.textAlign='center';ctx.textBaseline='middle';[...' .,:;irsXA253hMH@-/|\\'].forEach((c,i)=>ctx.fillText(c,i*16+8,12));gl.bindTexture(gl.TEXTURE_2D,this.glyphs);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);this.textureParams(gl.NEAREST,gl.CLAMP_TO_EDGE);
  this.lost=false;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onError?.(copyLocalized('renderer.webgl-load-auto'));});
 }
 finishCompilation(){if(this.compiled)return;const gl=this.gl;for(const [name,p]of Object.entries(this.programs)){if(!gl.getProgramParameter(p.program,gl.LINK_STATUS))throw Error(name+': '+gl.getProgramInfoLog(p.program));for(let i=0;i<gl.getProgramParameter(p.program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p.program,i);p.uniforms[u.name]=gl.getUniformLocation(p.program,u.name);}}this.compiled=true;}
 async compile(){this.gl.flush();if(this.parallel)while(!this.disposed&&Object.values(this.programs).some(p=>!this.gl.getProgramParameter(p.program,this.parallel.COMPLETION_STATUS_KHR)))await new Promise(requestAnimationFrame);if(this.disposed)return false;this.finishCompilation();return true;}
 textureParams(filter,wrap){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,wrap);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,wrap);}
 normalize(){
  const p=this.params;for(const k of Object.keys(BH_DEFAULTS))if(!Number.isFinite(p[k]))p[k]=BH_DEFAULTS[k];
  p.spin=Math.max(0,Math.min(.998,p.spin));p.mass=Math.max(0,Math.min(2,p.mass));
  p.outer=Math.max(p.inner+1,p.outer);
  p.heightInner=Math.max(.03,p.heightInner);p.heightOuter=Math.max(.03,p.heightOuter);p.noiseBegin=Math.max(1,p.noiseBegin);p.noiseEnd=Math.max(p.noiseBegin+1,p.noiseEnd);
  p.steps=Math.round(Math.max(64,Math.min(1399,p.steps)));p.clipSize=Math.max(.05,Math.min(p.clipSpacing*.7,p.clipSize));p.clipWire=Math.max(.005,Math.min(p.clipSize*.06,p.clipWire));
  p.fov=Math.max(15,Math.min(120,p.fov));p.fps=Math.max(1,Math.min(120,p.fps));
 }
 set(changes){if('mass' in changes)this.evaporation=null;Object.assign(this.params,changes);this.normalize();if(['spin','mass'].some(k=>k in changes))this.diskISCO=this.isco();this.traceDirty||=Object.keys(changes).some(k=>!BH_POST_KEYS.has(k));this.postDirty=true;}
 basis(){const p=this.params,cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),cr=Math.cos(p.roll),sr=Math.sin(p.roll);const f=[sy*cp,sp,-cy*cp],r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];return [r[0]*cr+u[0]*sr,r[1]*cr+u[1]*sr,r[2]*cr+u[2]*sr,u[0]*cr-r[0]*sr,u[1]*cr-r[1]*sr,u[2]*cr-r[2]*sr,...f];}
 isco(){const a=this.params.spin,z1=1+Math.cbrt(1-a*a)*(Math.cbrt(1+a)+Math.cbrt(1-a)),z2=Math.sqrt(3*a*a+z1*z1);return this.params.mass*(3+z2-Math.sqrt((3-z1)*(3+z1+2*z2)));}
 get time(){return this._time||0;}
 set time(value){this._time=value;this.resetMotion(value);}
 orbitRate(r,mass=this.params.mass){const w=Math.sqrt(mass);return w/(r*Math.sqrt(r)+this.params.spin*mass*w);}
 resetMotion(time=0){const p=this.params;this.motionKey=[p.clipSpacing,p.outer,p.spin].join(':');this.clipPhases=new Float64Array(Math.ceil(p.outer*1.2/p.clipSpacing)+4);for(let i=0;i<this.clipPhases.length;i++)this.clipPhases[i]=this.orbitRate((i+.5)*p.clipSpacing)*time*p.motion;this.noiseClock=time*p.motion;this.clipClock=time*p.motion;this.phaseDirty=true;}
 exportMotion(){return {noiseClock:this.noiseClock,clipClock:this.clipClock,phases:Array.from(this.clipPhases),evaporation:this.evaporation||null};}
 importMotion(state){if(!state)return;this.noiseClock=state.noiseClock;this.clipClock=state.clipClock;if(state.phases?.length===this.clipPhases.length)this.clipPhases.set(state.phases);this.evaporation=state.evaporation||null;this.phaseDirty=true;}
 startEvaporation(duration=30){this.evaporation={elapsed:0,duration,initialMass:this.params.mass,complete:false};}
 get visibility(){const e=this.evaporation;return e?Math.max(0,1-e.elapsed/e.duration):1;}
 advance(delta){
  const p=this.params;if(p.paused||delta<=0||this.evaporation?.complete)return;let dt=delta,m0=p.mass,m1=m0,mid=m0;
  const e=this.evaporation;if(e&&!e.complete){dt=Math.min(delta*p.evapSpeed,e.duration-e.elapsed);const massAt=t=>e.initialMass*Math.cbrt(Math.max(0,1-t/e.duration));m0=massAt(e.elapsed);mid=massAt(e.elapsed+dt*.5);e.elapsed=Math.min(e.duration,e.elapsed+dt);m1=massAt(e.elapsed);e.complete=e.elapsed>=e.duration;p.mass=m1;this.diskISCO=this.isco();}
  if(this.motionKey!==[p.clipSpacing,p.outer,p.spin].join(':'))this.resetMotion(this.time);
  const clock=dt*p.speedScale*p.motion;this._time+=dt;this.noiseClock+=clock*(Math.sqrt(m0)+4*Math.sqrt(mid)+Math.sqrt(m1))/6;this.clipClock+=clock*p.clipOrbitScale;
  for(let i=0;i<this.clipPhases.length;i++){const r=(i+.5)*p.clipSpacing;this.clipPhases[i]+=clock*p.clipOrbitScale*(this.orbitRate(r,m0)+4*this.orbitRate(r,mid)+this.orbitRate(r,m1))/6;}
  this.phaseDirty=true;if(e)this.postDirty=true;
 }
 uploadPhases(){const g=this.gl;if(this.motionKey!==[this.params.clipSpacing,this.params.outer,this.params.spin].join(':'))this.resetMotion(this.time);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,this.phaseTexture);if(!this.phaseDirty)return;const data=Float32Array.from(this.clipPhases,v=>v%(Math.PI*2));if(this.phaseTextureSize!==data.length){g.texImage2D(g.TEXTURE_2D,0,g.R32F,data.length,1,0,g.RED,g.FLOAT,data);this.textureParams(g.NEAREST,g.CLAMP_TO_EDGE);this.phaseTextureSize=data.length;}else g.texSubImage2D(g.TEXTURE_2D,0,0,0,data.length,1,g.RED,g.FLOAT,data);this.phaseDirty=false;}
 resize(){const p=this.params,mobileSize=ANDROID_BUILD?Math.round(Math.max(innerWidth,innerHeight)*Math.min(1,mobileRenderDensity())):0,w=Math.max(1,ANDROID_BUILD?mobileSize:innerWidth),h=Math.max(1,ANDROID_BUILD?mobileSize:innerHeight),size=p.style<.5?p.pixelSize:p.style<1.5?p.dotSize:p.style<2.5?p.asciiSize:p.rawSize;
  const ascii=p.style>1.5&&p.style<2.5,samples=ascii?Math.round(p.asciiSamples):1;
  this.gridWidth=Math.max(16,Math.min(Math.floor(1024/samples),Math.ceil(w/Math.max(1,size))));this.gridHeight=Math.max(12,Math.min(Math.floor(1024/samples),Math.ceil(h/(Math.max(1,size)*(ascii?1.7:1)))));
  const tw=this.gridWidth*samples,th=this.gridHeight*samples;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.postDirty=true;}
  if(this.width===tw&&this.height===th)return;this.width=tw;this.height=th;this.lastTrace=-Infinity;const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.scene);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,tw,th,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.textureParams(gl.NEAREST,gl.CLAMP_TO_EDGE);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.scene,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('帧缓冲不完整');gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.traceDirty=true;
 }
 bind(name){const gl=this.gl,{program,uniforms:u}=this.programs[name];gl.useProgram(program);for(const k of Object.keys(BH_DEFAULTS))if(u['u_'+k])gl.uniform1f(u['u_'+k],this.params[k]);return u;}
 draw(now,delta=0,force=false){
  if(this.lost||this.disposed||!this.compiled)return;const gl=this.gl,p=this.params;
  this.advance(delta);
  if(this.evaporation?.complete)return false;this.resize();
  let traced=false;const due=now-this.lastTrace>=1000/p.fps-.2;
  if(force||(this.traceDirty||!p.paused)&&due){
   this.uploadPhases();const u=this.bind('trace');gl.uniform1i(u.u_clipPhases,2);gl.uniform1f(u.u_noiseClock,this.noiseClock);gl.uniform1f(u.u_clipClock,this.clipClock);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,this.width,this.height);gl.uniform2f(u.u_resolution,this.width,this.height);gl.uniform3f(u.u_camera,p.cameraX,p.cameraY,p.cameraZ);gl.uniformMatrix3fv(u.u_basis,false,this.basis());gl.uniform1f(u.u_time,this.time);gl.uniform1f(u.u_isco,this.diskISCO);gl.uniform1f(u.u_aspect,this.canvas.width/this.canvas.height);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.noise);gl.uniform1i(u.u_noise,0);
   let query;if(this.timer&&this.pendingQueries.length<4){query=gl.createQuery();gl.beginQuery(this.timer.TIME_ELAPSED_EXT,query);}gl.drawArrays(gl.TRIANGLES,0,3);if(query){gl.endQuery(this.timer.TIME_ELAPSED_EXT);this.pendingQueries.push(query);}this.lastTrace=now;this.frames++;this.traceDirty=false;this.postDirty=true;traced=true;
  }
  if(this.postDirty||force){const u=this.bind('post');gl.uniform3fv(u.u_ink,this.screenInk);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.scanTexture);if(this.scanImage!==this.screenMask){this.scanImage=this.screenMask;if(this.screenMask)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.screenMask);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));this.textureParams(gl.LINEAR,gl.CLAMP_TO_EDGE);}gl.uniform1i(u.u_scanMask,3);const rotated=(this.canvas.width>this.canvas.height)!==(innerWidth>innerHeight);gl.uniform3f(u.u_scanAxis,rotated?1:0,rotated?0:-1,rotated?0:1);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.uniform1f(u.u_visibility,this.visibility);gl.uniform2f(u.u_resolution,this.canvas.width,this.canvas.height);gl.uniform2f(u.u_traceSize,this.width,this.height);gl.uniform2f(u.u_gridSize,this.gridWidth,this.gridHeight);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.scene);gl.uniform1i(u.u_scene,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.glyphs);gl.uniform1i(u.u_glyphs,1);gl.drawArrays(gl.TRIANGLES,0,3);this.postDirty=false;}
  if(this.timer){const disjoint=gl.getParameter(this.timer.GPU_DISJOINT_EXT);while(this.pendingQueries.length&&gl.getQueryParameter(this.pendingQueries[0],gl.QUERY_RESULT_AVAILABLE)){const q=this.pendingQueries.shift(),ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;if(!disjoint)this.gpuMS=this.gpuMS===null?ms:this.gpuMS*.8+ms*.2;gl.deleteQuery(q);}}
  return traced;
 }
 readTrace(){const g=this.gl,bytes=new Uint8Array(this.width*this.height*4);g.bindFramebuffer(g.FRAMEBUFFER,this.fbo);g.readPixels(0,0,this.width,this.height,g.RGBA,g.UNSIGNED_BYTE,bytes);g.bindFramebuffer(g.FRAMEBUFFER,null);return bytes;}
 dispose(){this.disposed=true;const g=this.gl;for(const p of Object.values(this.programs))g.deleteProgram(p.program);for(const t of [this.scene,this.noise,this.glyphs,this.phaseTexture,this.scanTexture])g.deleteTexture(t);for(const q of this.pendingQueries)g.deleteQuery(q);g.deleteFramebuffer(this.fbo);g.deleteVertexArray(this.vao);}
}
