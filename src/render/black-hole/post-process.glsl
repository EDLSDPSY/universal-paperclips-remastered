#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D u_scene;
uniform sampler2D u_glyphs;
uniform sampler2D u_scanMask;
uniform vec3 u_scanAxis;
uniform vec2 u_resolution;
uniform vec2 u_traceSize;
uniform vec2 u_gridSize;
uniform float u_visibility;
uniform vec3 u_ink;
/*__PARAMS__*/
vec3 fetchScene(vec2 uv){vec4 c=texture(u_scene,uv);return c.rgb*c.a*32.0;}
vec3 tone(vec3 c){
 c*=exp2(u_exposure);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,u_saturation);
 if(u_tone<.5)c=1.0-exp(-c);else if(u_tone<1.5)c=c/(1.0+c);else c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.0,1.0);
 c=max(c-vec3(u_black),vec3(0.0));c=pow(c,vec3(u_contrast));
 float v=dot(c,vec3(.2126,.7152,.0722));c*=mix(u_dark,u_light,smoothstep(.05,.85,v));
 if(u_palette>.5){vec3 ink=u_palette<1.5?u_ink:u_palette<2.5?vec3(.35,1.0,.54):u_palette<3.5?vec3(.52,.79,1.0):vec3(.85,.88,.83);c=ink*dot(c,vec3(.2126,.7152,.0722));}
 return clamp(c,0.0,1.0)*u_background;
}
float displayLuminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void main(){
 vec2 uv=gl_FragCoord.xy/u_resolution;
 vec2 grid=uv*u_gridSize,cell=floor(grid),f=fract(grid),at=(cell+.5)/u_gridSize;
 vec3 color=tone(fetchScene(at));float asciiPeak=0.0,asciiMean=0.0;vec2 moment=vec2(0.0);vec3 covariance=vec3(0.0);float weights=0.0;
 if(u_style>1.5&&u_style<2.5){
  vec3 average=vec3(0.0),peakColor=vec3(0.0);float samples=round(u_asciiSamples);
  for(int y=0;y<4;y++)for(int x=0;x<4;x++){
   if(float(x)>=samples||float(y)>=samples)continue;
   vec2 pos=(vec2(x,y)+.5)/samples,delta=pos-.5;
   vec3 c=tone(fetchScene((cell+pos)/u_gridSize));float lum=displayLuminance(c);
   average+=c;asciiMean+=lum;if(lum>asciiPeak){asciiPeak=lum;peakColor=c;}
   float w=lum*lum;weights+=w;moment+=delta*w;covariance+=vec3(delta.x*delta.x,delta.x*delta.y,delta.y*delta.y)*w;
  }
  average/=samples*samples;asciiMean/=samples*samples;color=mix(average,peakColor,u_asciiPreserve);
 }
 if(u_bloom>0.0){vec3 glow=vec3(0);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec3 c=tone(fetchScene(at+vec2(x,y)/u_traceSize));glow+=max(c-.3,vec3(0.0));}color+=glow*(u_bloom/9.0);}
 float lum=displayLuminance(color);
 if(u_style<.5){float inset=u_gap*.5;float mask=step(inset,f.x)*step(inset,f.y)*step(f.x,1.0-inset)*step(f.y,1.0-inset);color*=mask;color=floor(color*u_levels+.5)/u_levels;}
 else if(u_style<1.5){float r=u_dotRadius*mix(.35,1.0,sqrt(lum));float dist=length((f-.5)*vec2(1.0,u_gridSize.x/u_gridSize.y*u_resolution.y/u_resolution.x));color*=1.0-smoothstep(r-.06,r+.02,dist);}
 else if(u_style<2.5){
  float index=floor(clamp(pow(lum,u_asciiGamma)*15.0,0.0,15.0));
  if(asciiPeak>.012&&u_asciiPreserve>0.0)index=max(index,1.0);
  if(u_asciiLines>.5&&u_asciiSamples>1.5&&asciiPeak>max(.045,asciiMean*2.2)){
   vec2 center=moment/max(weights,1e-6);vec3 cov=covariance/max(weights,1e-6)-vec3(center.x*center.x,center.x*center.y,center.y*center.y);
   float angle=.5*atan(2.0*cov.y,cov.x-cov.z),orientation=mod(floor(angle/(3.14159265*.25)+.5)+4.0,4.0);index=16.0+orientation;
  }
  vec2 guv=vec2((index+f.x)/20.0,1.0-f.y);float glyph=texture(u_glyphs,guv).r;color=mix(color,(u_palette>.5&&u_palette<1.5?u_ink:u_ink)*lum,u_asciiInk)*glyph*u_asciiGain;
 }
 color*=1.0-texture(u_scanMask,vec2(.5,dot(uv,u_scanAxis.xy)+u_scanAxis.z)).a;
 vec3 base=u_theme<.5?vec3(16,12,5):u_theme<1.5?vec3(8,14,4):u_theme<2.5?vec3(5,13,18):u_theme<3.5?vec3(12,12,9):u_theme<4.5?vec3(4,14,13):u_theme<5.5?vec3(17,7,18):vec3(19,5,7);
 fragColor=vec4(clamp(color*u_visibility+base*(u_fxBase*u_baseTint/255.0),0.0,1.0),1.0);
}
