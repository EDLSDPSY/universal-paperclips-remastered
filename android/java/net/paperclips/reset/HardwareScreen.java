package net.paperclips.reset;

import android.content.res.AssetManager;
import android.graphics.BlendMode;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.RenderEffect;
import android.graphics.RuntimeShader;
import android.graphics.Shader;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

final class HardwareScreen {
 private final View view;
 private final RuntimeShader optics;
 private boolean enabled,curve,ending;
 private float bloom,rgb;
 private float cssWidth=1;

 HardwareScreen(View view,AssetManager assets) throws IOException {
  this.view=view;
  optics=new RuntimeShader(read(assets,"optics.agsl"));
  view.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{if(r-l!=or-ol||b-t!=ob-ot)apply();});
 }
 private static String read(AssetManager assets,String name) throws IOException {
  try(InputStream in=assets.open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))>=0)out.write(bytes,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);
  }
 }
 void configure(boolean enabled,float cssWidth,float bloom,boolean curve,float rgb,boolean ending){
  this.enabled=enabled;this.cssWidth=cssWidth;this.bloom=bloom;this.curve=curve;this.rgb=rgb;this.ending=ending;apply();
 }
 private static RenderEffect transfer(RenderEffect input,float gain,float offset){
  return RenderEffect.createColorFilterEffect(new ColorMatrixColorFilter(new float[]{gain,0,0,0,offset*255,0,gain,0,0,offset*255,0,0,gain,0,offset*255,0,0,0,1,0}),input);
 }
 // Android 在滤波前将模糊半径换算为 Skia 的标准差。
 private static float radius(float sigma){return Math.max(0.01f,(sigma-0.5f)/0.57735f);}
 private void apply(){
  if(!enabled||bloom==0&&!curve&&rgb==0){view.setRenderEffect(null);return;}
  int width=view.getWidth(),height=view.getHeight();if(width==0||height==0||cssWidth<=0)return;
  float density=width/cssWidth;
  RenderEffect original=RenderEffect.createOffsetEffect(0,0),result=original;
  if(bloom>0){
   float tightRadius=radius(.65f*density),wideRadius=radius(5f*density);
   RenderEffect tight=RenderEffect.createBlurEffect(tightRadius,tightRadius,Shader.TileMode.DECAL);
   RenderEffect wide=RenderEffect.createBlurEffect(wideRadius,wideRadius,Shader.TileMode.DECAL);
   RenderEffect edge=RenderEffect.createBlendModeEffect(transfer(wide,1.6f*bloom,0),original,BlendMode.DST_OUT);
   RenderEffect outer=RenderEffect.createBlendModeEffect(transfer(wide,1.6f*bloom,-(ending?.02f:.006f)*bloom),edge,BlendMode.SCREEN);
   RenderEffect glow=RenderEffect.createBlendModeEffect(transfer(tight,.55f*bloom,-.02f*bloom),outer,BlendMode.SCREEN);
   result=RenderEffect.createBlendModeEffect(original,glow,BlendMode.SCREEN);
  }
  if(curve||rgb>0){
   optics.setFloatUniform("extent",width,height);optics.setFloatUniform("density",density);
   optics.setFloatUniform("bend",curve?.011f:0f);optics.setFloatUniform("offset",rgb);
   RenderEffect screen=RenderEffect.createRuntimeShaderEffect(optics,"source");
   result=bloom>0?RenderEffect.createChainEffect(screen,result):screen;
  }
  view.setRenderEffect(result);
 }
}
