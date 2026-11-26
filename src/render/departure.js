// 场景和界面经过同一套 CRT 合成后，再做转场。
const DEPARTURE_FX={scan:1.65,establish:.4,pull:8.6,hold:.5,returnScan:1.65};
const departureEnds=(()=>{let total=0;return Object.values(DEPARTURE_FX).map(seconds=>total+=seconds);})();
function departureInterfaceSnapshot(){if(ANDROID_BUILD)invalidateInterface();
 let image=screenRenderer?.sourceSnapshot();if(image)return image;
 const canvas=document.createElement('canvas');canvas.width=Math.round(innerWidth);canvas.height=Math.round(innerHeight);const ctx=canvas.getContext('2d');
 ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg');ctx.fillRect(0,0,canvas.width,canvas.height);
 if(ANDROID_BUILD)mobileSnapshotCanvases(ctx);else for(const c of $('crtGlass').querySelectorAll('canvas:not(#glassLight)')){if(c.id==='spaceTransition'||!c.width||!c.height)continue;const r=c.getBoundingClientRect();if(r.width)ctx.drawImage(c,r.left,r.top,r.width,r.height);}
 const ui=document.createElement('canvas');ui.width=canvas.width;ui.height=canvas.height;paintInterface(ui.getContext('2d'),canvas.width,canvas.height);ctx.drawImage(ui,0,0);return canvas;
}
function drawDepartureRegion(ctx,rect,density,journey,scene,extent=NEAR_VIEW.departureExtent){
 const saved={vctx,vw,vh,vscale,planeMatrix,capturePoints};
 ctx.save();
 try{vctx=ctx;vw=rect.width;vh=rect.height;vscale=density;planeMatrix=null;capturePoints=false;ctx.setTransform(density,0,0,density,rect.left*density,rect.top*density);ctx.beginPath();ctx.rect(0,0,vw,vh);ctx.clip();ctx.lineWidth=.7;drawNeighbourhood(extent,journey,scene,false);}
 finally{ctx.restore();({vctx,vw,vh,vscale,planeMatrix,capturePoints}=saved);}
}
// 三次快速刷新逐步显出画面，扫描边缘留一点余辉，避免切碎文字。
const DEPARTURE_REFRESH={passes:3,feather:.16,glow:.035};
function departureRefreshWeight(progress,row){
 const scan=clamp(progress,0,1)*DEPARTURE_REFRESH.passes,pass=Math.min(DEPARTURE_REFRESH.passes-1,Math.floor(scan)),fraction=scan-pass,f=DEPARTURE_REFRESH.feather,cursor=-f+fraction*(1+2*f);
 return (pass+smoothStep(clamp((cursor-row+f)/(2*f),0,1)))/DEPARTURE_REFRESH.passes;
}
function departureMask(t,progress){
 const ctx=t.maskCtx,w=t.canvas.width,h=t.canvas.height,pitch=Math.max(1,Math.round(t.density*2));
 ctx.clearRect(0,0,w,h);if(progress<=0)return;
 if(progress>=1){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);return;}
 for(let y=0;y<h;y+=pitch){
  const alpha=departureRefreshWeight(progress,y/h);if(!alpha)continue;
  ctx.fillStyle='rgba(255,255,255,'+alpha+')';ctx.fillRect(0,y,w,pitch);
 }
}
function paintDeparture(t){
 const time=t.elapsed,e=departureEnds,w=t.canvas.width,h=t.canvas.height,ctx=t.ctx,layer=t.layerCtx,full={left:0,top:0,width:innerWidth,height:innerHeight};
 let entering=time<e[0],returning=time>=e[3],scan=entering?clamp(time/e[0],0,1):returning?clamp((time-e[3])/DEPARTURE_FX.returnScan,0,1):1,journey=clamp((time-e[1])/DEPARTURE_FX.pull,0,1);
 t.canvas.dataset.phase=entering?'scan-to-scene':returning?'scan-to-interface':time<e[1]?'solar-system':time<e[2]?'solar-to-neighbours':'neighbourhood';
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 ctx.fillStyle=t.background;ctx.fillRect(0,0,w,h);
 if(entering)ctx.drawImage(t.image,0,0,w,h);
 else drawDepartureRegion(ctx,full,t.density,journey,t.solar);
 if(entering||returning){layer.setTransform(1,0,0,1,0,0);layer.globalCompositeOperation='source-over';layer.globalAlpha=1;layer.clearRect(0,0,w,h);layer.fillStyle=t.background;layer.fillRect(0,0,w,h);}
 if(entering)drawDepartureRegion(layer,full,t.density,journey,t.solar);
 else if(returning&&t.targetImage){
  layer.drawImage(t.targetImage,0,0,w,h);const rect=t.targetRect||t.viewRect;
  layer.fillRect(rect.left*t.density,rect.top*t.density,rect.width*t.density,rect.height*t.density);
  drawDepartureRegion(layer,rect,t.density,journey,t.solar,game.state.s?neighbourhoodExtent():NEAR_VIEW.extent);
 }
 if(entering||returning){
  departureMask(t,scan);layer.globalCompositeOperation='destination-in';layer.drawImage(t.mask,0,0);layer.globalCompositeOperation='source-over';ctx.drawImage(t.layer,0,0);
  const pitch=Math.max(1,Math.round(t.density*2)),f=DEPARTURE_REFRESH.feather,cursor=-f+(scan*DEPARTURE_REFRESH.passes%1)*(1+2*f),strength=DEPARTURE_REFRESH.glow*Math.sin(Math.PI*scan);
  for(let y=0;y<h;y+=pitch){
   const d=(y/h-cursor)/(f*.35),glow=strength*Math.exp(-d*d);if(glow<.001)continue;
   ctx.fillStyle='rgba('+visualRGB+','+glow+')';ctx.fillRect(0,y,w,pitch);
  }
 }
 markCanvasPaint(t.canvas);
}
function startDepartureTransition(){
 if(screenTransition)return false;
 if(!settings.motion){departureSolarScene=null;return false;}
 try{
  const image=departureFinalImage||departureInterfaceSnapshot(),canvas=document.createElement('canvas'),layer=document.createElement('canvas'),mask=document.createElement('canvas'),rect=$('view').getBoundingClientRect();departureFinalImage=null;
  for(const c of [canvas,layer,mask]){c.width=image.width;c.height=image.height;}
  canvas.id='spaceTransition';canvas.setAttribute('aria-hidden','true');$('crtGlass').append(canvas);
  screenTransition={kind:'space',owner:game,image,targetImage:null,canvas,ctx:canvas.getContext('2d',{alpha:false}),layer,layerCtx:layer.getContext('2d'),mask,maskCtx:mask.getContext('2d'),density:image.width/innerWidth,viewport:{width:innerWidth,height:innerHeight},viewRect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},solar:departureSolarScene,background:getComputedStyle(document.documentElement).getPropertyValue('--bg'),elapsed:0,last:performance.now(),painted:-Infinity,prepared:false};
  clearPointerRoute();clearHitHover();$('crtGlass').inert=true;paintDeparture(screenTransition);screenRenderer?.presentation(canvas);return true;
 }catch(error){console.error('Departure transition:',error);cancelScreenTransition();return false;}
}
function resizeDeparture(t){
 const density=screenRenderer?.mode==='browser'?1:(screenRenderer?.width||t.canvas.width)/innerWidth,width=Math.round(innerWidth*density),height=Math.round(innerHeight*density);
 if(width===t.canvas.width&&height===t.canvas.height&&innerWidth===t.viewport.width&&innerHeight===t.viewport.height)return;
 const sx=innerWidth/t.viewport.width,sy=innerHeight/t.viewport.height;
 t.viewRect={left:t.viewRect.left*sx,top:t.viewRect.top*sy,width:t.viewRect.width*sx,height:t.viewRect.height*sy};
 for(const c of [t.canvas,t.layer,t.mask]){c.width=width;c.height=height;}
 if(t.targetImage)t.targetImage.width=t.targetImage.height=0;
 t.targetImage=null;t.targetRect=null;t.density=density;t.viewport={width:innerWidth,height:innerHeight};t.painted=-Infinity;
}
function tickDepartureTransition(now){
 const t=screenTransition;if(t.owner!==game){cancelScreenTransition();return;}
 resizeDeparture(t);
 const delta=Math.max(0,(now-t.last)/1000);t.last=now;if(document.hidden)return;
 if(!t.targetImage&&t.prepared&&!screenRenderer?.pending){t.targetImage=departureInterfaceSnapshot();const r=$('view').getBoundingClientRect();t.targetRect={left:r.left,top:r.top,width:r.width,height:r.height};}
 t.elapsed=Math.min(t.elapsed+Math.min(delta,.1),t.targetImage?Infinity:departureEnds[3]);
 visualTime+=Math.min(delta,.1);rotationTime+=Math.min(delta,.1)*rotationScale(30);
 if(t.elapsed>=departureEnds[4]){cancelScreenTransition();render();drawViz();screenRenderer?.tick(now);return;}
 const fps=screenRenderer?.mode==='cpu'?Math.min(45,UI_CONFIG.cpuRenderFPS):60;
 if(now-t.painted+.1>=1000/fps){paintDeparture(t);t.painted=now;}
 screenRenderer?.tick(now);
}
function previewDeparture(){
 if(screenTransition||game.state.stage!==2||!game.has('dyson'))return false;
 flushSimulationTime();departureSolarScene=captureDepartureSolar();if(!startDepartureTransition())return false;
 // 预览拿当前界面当作转场终点，游戏状态无需推进。
 screenTransition.prepared=true;screenRenderer?.invalidate();return true;
}
