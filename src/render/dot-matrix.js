const SceneBatch=(()=>{
 let canvas=null,gl=null,quad=null,stream=null,earthBuffer=null,feedback=null,plain=null,earth=null,flareTexture=null,flareSource=null,failed=false,active=false;
 let vertices=new Float32Array(4096*12),used=0,start=0,width=0,height=0,density=1,commands=[],previous=[],previousUsed=0;
 const colors=new Map();let earthCount=0;
 const vertex=`#version 300 es
 precision highp float;
 layout(location=0) in vec2 corner;layout(location=1) in vec4 rect;layout(location=2) in vec4 color;layout(location=3) in vec4 shape;
 uniform vec2 screen;out vec4 bounds;out vec4 tint;flat out vec4 form;
 void main(){bounds=rect;form=shape;tint=color;vec2 p=mix(floor(rect.xy-1.),ceil(rect.xy+rect.zw+1.),corner);gl_Position=vec4(p.x/screen.x*2.-1.,1.-p.y/screen.y*2.,0.,1.);}`;
 const fragment=`#version 300 es
 precision highp float;
 uniform vec2 screen;uniform sampler2D flare;in vec4 bounds;in vec4 tint;flat in vec4 form;out vec4 result;
 void main(){vec2 p=vec2(gl_FragCoord.x,screen.y-gl_FragCoord.y),lo=p-.5,hi=p+.5;float a=1.;vec3 rgb=tint.rgb;
 if(form.x<.5){vec2 coverage=max(vec2(0.),min(hi,bounds.xy+bounds.zw)-max(lo,bounds.xy));a=coverage.x*coverage.y;}
 else if(form.x<1.5){vec2 centre=bounds.xy+bounds.zw*.5;float radius=bounds.z*.5,d=length(p-centre);a=clamp(radius+.5-d,0.,1.);rgb*=mix(1.,.62,clamp((d/radius-.7)/.3,0.,1.));}
 else if(form.x<2.5){vec2 uv=(p-bounds.xy)/bounds.zw;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;result=texture(flare,uv)*tint.a;return;}
 else{vec2 d=form.yz,from=bounds.xy+max(vec2(0.),-d)+(bounds.zw-abs(d))*.5,q=p-from;float lengthD=length(d);vec2 tangent=d/max(lengthD,1.e-8);float along=dot(q,tangent),across=abs(q.x*tangent.y-q.y*tangent.x);a=clamp(min(along+.5,lengthD-along+.5),0.,1.)*clamp(form.w*.5+.5-across,0.,1.);}
 result=vec4(rgb*tint.a*a,tint.a*a);}`;
 const earthVertex=`#version 300 es
 precision highp float;
 layout(location=0) in vec2 corner;layout(location=1) in vec4 point;layout(location=2) in vec4 terrain;layout(location=3) in vec2 light;
 uniform vec2 screen;uniform vec4 camera;uniform vec4 pose;uniform vec4 state;uniform vec4 industry;uniform vec4 city;uniform vec4 power;uniform vec3 palette[7];uniform float inherited;uniform float sunY;uniform float daylight;
 out vec4 bounds;out vec4 tint;flat out vec4 form;out vec4 captured;
 float unit(float t){t=clamp(t,0.,1.);return t*t*(3.-2.*t);}
 void main(){float xx=point.x*pose.x+point.z*pose.y,zz=point.z*pose.x-point.x*pose.y,yy=point.y*pose.z-zz*pose.w,depth=point.y*pose.w+zz*pose.z;vec2 q=vec2(xx,yy);
 bool human=state.x>.5,land=point.w>.5,dayNight=human&&daylight>.5;float dry=human||land?0.:unit((power.z*1.14-terrain.x)/.14),ground=human||land?1.:.45+.55*dry;
 float day=unit((point.x*power.y+point.y*sunY+point.z*power.w+.06)/.12);
 float face=.3+.7*depth,natural=human?(dayNight?(land?.10+.15*depth+day*(.18+.52*depth):.05+.18*depth+day*(.10+.18*depth)):(land?.28+.67*depth:.05+.18*depth)):.28+.67*depth,brightness=mix(natural,.16+.35*depth,state.y),size=land?1.8:1.05+.75*dry;int kind=0;
 if(human&&terrain.w>.08){float development=land?city.x:city.y,spread=land?mix(terrain.z,terrain.w,development):terrain.w*development,born=land?unit((.5+.5*development-terrain.y)*8.):development,live=clamp((city.z-light.x)*city.w,0.,1.)*born*(dayNight?1.-day:1.);
  if(live>0.&&spread>.08){float l=spread*(.65+.75*development)*(dayNight?1.:(.65+.35*clamp(.6-q.x*.8,0.,1.)));brightness=mix(brightness,max(brightness,l),live);size=mix(size,1.7+spread*(.65+development*.85),live);kind=1;}}
 if(!human){if(state.z>.5){brightness=(.18+.4*terrain.y)*face;kind=terrain.y<.15?3:5;size=1.4;}
  else if(terrain.y>1.-industry.y&&industry.y>0.){brightness=(.22+.6*industry.z)*face;kind=3;size=1.7;}
  else if(terrain.y<industry.w){brightness=.48*face;kind=4;size=1.7;}
  else if(terrain.y<industry.x){brightness=.62*face;kind=2;size=1.7;}
  else if(state.y>.01){kind=5;size=1.35;}brightness*=ground;}
 float a=floor(clamp(brightness*power.x,0.,1.)*255.+.5)/255.*inherited;if(depth<-.02||(state.w>1.5&&mod(light.y,2.)>.5))a=0.;
 vec2 xy=floor(vec2(camera.x+q.x*camera.z,camera.y-q.y*camera.z)+.5);bounds=vec4(xy*camera.w,vec2(size*camera.w));tint=vec4(palette[kind]/255.,a);form=vec4(0.);captured=vec4(xy/vec2(screen/camera.w),a,size);
 vec2 p=mix(floor(bounds.xy-1.),ceil(bounds.xy+bounds.zw+1.),corner);gl_Position=vec4(p.x/screen.x*2.-1.,1.-p.y/screen.y*2.,0.,1.);}`;
 function program(vs,fs,tf=false){const p=gl.createProgram();for(const [type,source]of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}if(tf)gl.transformFeedbackVaryings(p,['captured'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return {p,uniforms:new Map()};}
 function uniform(p,name,...value){let loc=p.uniforms.get(name);if(loc===undefined){loc=gl.getUniformLocation(p.p,name);p.uniforms.set(name,loc);}if(value.length===1&&Array.isArray(value[0]))gl.uniform3fv(loc,value[0]);else gl['uniform'+value.length+'f'](loc,...value);}
 function initialize(){
  if(!canvas){canvas=document.createElement('canvas');canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;gl=null;viewDirty=true;});canvas.addEventListener('webglcontextrestored',()=>{failed=false;gl=null;viewDirty=true;});}
  gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL2 unavailable');gl.disable(gl.DITHER);plain=program(vertex,fragment);earth=program(earthVertex,fragment,true);
  quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);stream=gl.createBuffer();feedback=gl.createBuffer();
  const data=new Float32Array(sphere.length*10);sphere.forEach((p,i)=>data.set([p.x,p.y,p.z,+p.land,p.latitude,p.n,p.city,p.citySpread,p.lightThreshold||0,i],i*10));earthCount=sphere.length;earthBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,earthBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  flareTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,flareTexture);for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,param,gl.CLAMP_TO_EDGE);for(const param of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,param,gl.LINEAR);flareSource=null;
 }
 function color(value){let c=colors.get(value);if(!c){c=(value.match(/[\d.]+/g)||[]).map(Number);c=[c[0]/255,c[1]/255,c[2]/255,c[3]??1];colors.set(value,c);if(colors.size>4096)colors.clear();}return c;}
 function add(x,y,w,h,r,g,b,a,kind=0,dx=0,dy=0,lineWidth=0){if(used+12>vertices.length){const next=new Float32Array(vertices.length*2);next.set(vertices);vertices=next;}vertices[used++]=x*density;vertices[used++]=y*density;vertices[used++]=w*density;vertices[used++]=h*density;vertices[used++]=r;vertices[used++]=g;vertices[used++]=b;vertices[used++]=a;vertices[used++]=kind;vertices[used++]=dx*density;vertices[used++]=dy*density;vertices[used++]=lineWidth*density;}
 function point(x,y,a,size,value){const c=color(value||tint(a));add(Math.round(x),Math.round(y),size,size,c[0],c[1],c[2],c[3]*vctx.globalAlpha);}
 function flush(){if(used>start){commands.push({start,count:(used-start)/12});start=used;}}
 function begin(w,h,scale){active=false;if(failed||screenRenderer?.mode==='cpu'||planeMatrix)return false;try{if(!gl)initialize();if(gl.isContextLost())return false;}catch(error){failed=true;console.warn('Scene batch:',error);return false;}width=w;height=h;density=scale;used=start=0;commands=[];active=true;return true;}
 function earthState(config){flush();commands.push({earth:config});}
 function attributes(earthPass,offset=0){gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(0,0);gl.bindBuffer(gl.ARRAY_BUFFER,earthPass?earthBuffer:stream);for(let i=1;i<=3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,earthPass&&i===3?2:4,gl.FLOAT,false,earthPass?40:48,offset+(i-1)*16);gl.vertexAttribDivisor(i,1);}}
 function earthUniforms(c){gl.useProgram(earth.p);uniform(earth,'screen',width*density,height*density);uniform(earth,'camera',c.cx,c.cy,c.radius,density);uniform(earth,'pose',Math.cos(c.angle),Math.sin(c.angle),Math.cos(c.pitch),Math.sin(c.pitch));uniform(earth,'state',+c.state.human,c.state.erosion,+c.ion,c.dense);uniform(earth,'industry',c.state.coverage,c.state.radiators,c.state.heat||0,c.state.receiver||0);uniform(earth,'city',c.state.development,c.state.seaCities,c.state.lights||0,cityLightOrder.length);uniform(earth,'power',c.alpha,c.sun.x,c.state.sealing||0,c.sun.z);uniform(earth,'sunY',c.sun.y);uniform(earth,'daylight',+!!c.state.daylight);uniform(earth,'inherited',c.inherited);uniform(earth,'palette',c.palette);}
 function end(target){
  if(!active)return false;flush();active=false;const w=Math.round(width*density),h=Math.round(height*density);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.bindBuffer(gl.ARRAY_BUFFER,stream);gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,used),gl.STREAM_DRAW);
  for(const c of commands){if(c.earth){earthUniforms(c.earth);attributes(true);gl.drawArraysInstanced(gl.TRIANGLES,0,6,earthCount);}else{gl.useProgram(plain.p);uniform(plain,'screen',w,h);attributes(false,c.start*4);gl.drawArraysInstanced(gl.TRIANGLES,0,6,c.count);}}
  target.save();target.setTransform(1,0,0,1,0,0);target.globalAlpha=1;target.drawImage(canvas,0,0);target.restore();previous=commands;previousUsed=used;return true;
 }
 function capture(){
  if(!gl||gl.isContextLost())return [];const points=[];
  for(const c of previous){if(!c.earth){for(let k=c.start;k<c.start+c.count*12;k+=12)if(vertices[k+8]===0)points.push({x:vertices[k]/(width*density),y:vertices[k+1]/(height*density),a:vertices[k+7],size:vertices[k+2]/density});continue;}
   earthUniforms(c.earth);attributes(true);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,feedback);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,earthCount*6*16,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,feedback);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.TRIANGLES);gl.drawArraysInstanced(gl.TRIANGLES,0,6,earthCount);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);const data=new Float32Array(earthCount*6*4);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,data);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);for(let i=0;i<data.length;i+=24)if(data[i+2]>0&&data[i]>=-4/width&&data[i]<=1+4/width&&data[i+1]>=-4/height&&data[i+1]<=1+4/height)points.push({x:data[i],y:data[i+1],a:data[i+2],size:data[i+3]});
  }return points;
 }
 return {begin,end,capture,point,get active(){return active;},get available(){return !failed;},get status(){return {active,failed,instances:previousUsed/12,earth:previous.some(c=>c.earth),draws:previous.length};},earth(config){if(!active||capturePoints)return false;config.inherited=vctx.globalAlpha;config.palette=[visualRGB.split(',').map(Number),...['city','pv','heat','receiver','rock','asteroid'].map(k=>color(surfacePalettes[k][255]).slice(0,3).map(v=>v*255))].flat();earthState(config);return true;},line(x1,y1,x2,y2,a){const dx=x2-x1,dy=y2-y1,l=vctx.lineWidth,pad=l*.5+1,c=color(tint(a));add(Math.min(x1,x2)-pad,Math.min(y1,y2)-pad,Math.abs(dx)+2*pad,Math.abs(dy)+2*pad,c[0],c[1],c[2],c[3]*vctx.globalAlpha,3,dx,dy,l);},body(cx,cy,radius,alpha){const c=(departureSunColor||visualRGB).split(',').map(Number);add(cx-radius,cy-radius,radius*2,radius*2,c[0]/255,c[1]/255,c[2]/255,alpha*vctx.globalAlpha,1);},flare(cx,cy,radius,alpha){const source=irradiationTexture();if(source!==flareSource){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,flareTexture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);flareSource=source;}add(cx-radius,cy-radius,radius*2,radius*2,1,1,1,alpha*vctx.globalAlpha,2);}};
})();
