let interfaceRects=new WeakMap(),interfaceLayout=new WeakMap(),interfaceStyles=new WeakMap(),interfaceText=new WeakMap(),interfacePseudo=new WeakMap(),interfaceMetrics=new Map(),interfaceEdits=new WeakMap(),interfaceColors=null;
const interfaceStyleKeys=['font','fontStyle','fontWeight','fontSize','fontFamily','letterSpacing','lineHeight','color','display','visibility','opacity','backgroundColor','backgroundImage','borderLeftColor','textAlign','overflowX','overflowY','whiteSpace','listStyleType','textOverflow','paddingLeft','paddingRight','paddingTop','content','position','left','top','width','height','--range-track-height','--range-track-step','--range-thumb-width','--range-thumb-height'];
const interfaceStyleFlags=[['bar','.bar,.stack'],['solidRule','.solid-rule,.project.after-task'],
 ['rule','.rule:not(#industrialReadout>.solid-rule)'],['speedTick','.speed-ticks i'],['playSymbol','.play-symbol'],['button','button']];
if(ANDROID_BUILD)interfaceStyleFlags.push(['mobileTab','.mobile-tab-progress']);
function interfaceStyle(el,pseudo=null){let raw=getComputedStyle(el,pseudo),result={};for(let key of interfaceStyleKeys)result[key]=key.startsWith('--')?raw.getPropertyValue(key):raw[key];if(!pseudo){if(el.id==='toast')result.stroke=Number.parseFloat(raw.webkitTextStrokeWidth)||0;for(let [key,selector]of interfaceStyleFlags)result[key]=el.matches(selector);}return result;}
function invalidateInterface(scope,styles=true){
 if(!scope){interfaceColors=null;interfaceRects=new WeakMap();interfaceLayout=new WeakMap();interfaceStyles=new WeakMap();interfaceText=new WeakMap();interfacePseudo=new WeakMap();return;}
 for(let el of [scope,...scope.querySelectorAll('*')]){interfaceRects.delete(el);if(styles){interfaceStyles.delete(el);interfacePseudo.delete(el);}for(let child of el.childNodes)if(child.nodeType===3)interfaceText.delete(child);}
}
// 滚动只改变位置，字体、换行和样式保持不变。
function invalidateInterfacePositions(scope){for(let el of [scope,...scope.querySelectorAll('*')])interfaceRects.delete(el);}
function interfacePalette(){if(!interfaceColors){const style=getComputedStyle(document.documentElement);interfaceColors={ink:style.getPropertyValue('--ink'),faint:style.getPropertyValue('--faint'),bright:style.getPropertyValue('--bright'),rgb:style.getPropertyValue('--rgb').trim()};}return interfaceColors;}
function paintInterface(ctx,width,height,regions=null,layer='all',clipRegions=true){
 const scale=width/innerWidth,root=$('crtGlass'),colors=interfacePalette();let count=0,speedTrack=null;
 // 清除范围和裁剪范围都对齐到整像素，局部重绘才不会在边缘留下碎屑。
 ctx.save();if(regions&&clipRegions){regions=regions.map(r=>{let x=Math.floor(r.x*scale),y=Math.floor(r.y*scale),right=Math.ceil((r.x+r.width)*scale),bottom=Math.ceil((r.y+r.height)*scale);return {x:x/scale,y:y/scale,width:(right-x)/scale,height:(bottom-y)/scale};});ctx.beginPath();for(let r of regions)ctx.rect(Math.round(r.x*scale),Math.round(r.y*scale),Math.round(r.width*scale),Math.round(r.height*scale));ctx.clip();}ctx.clearRect(0,0,width,height);ctx.scale(scale,scale);
 const font=style=>style.font||[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
 const box=el=>{let cached=interfaceRects.get(el);if(!cached){cached=el.getBoundingClientRect();interfaceRects.set(el,cached);interfaceLayout.set(el,cached);}return cached;};
 const css=el=>{let cached=interfaceStyles.get(el);if(!cached){cached=interfaceStyle(el);interfaceStyles.set(el,cached);}return cached;};
 function text(value,x,top,style,height){
  if(!value)return;ctx.font=font(style);ctx.fillStyle=style.color;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;let key=ctx.font,metrics=interfaceMetrics.get(key);if(!metrics){metrics=ctx.measureText('Mg');interfaceMetrics.set(key,metrics);}let ascent=metrics.fontBoundingBoxAscent??Number.parseFloat(style.fontSize)*.8,descent=metrics.fontBoundingBoxDescent??Number.parseFloat(style.fontSize)*.2;
  const baseline=top+(height-ascent-descent)/2+ascent;if(style.stroke){ctx.strokeStyle=style.color;ctx.lineWidth=style.stroke;ctx.strokeText(value,x,baseline);}ctx.fillText(value,x,baseline);count++;
 }
 function textNode(node,style){
  let value=node.textContent;if(!value.trim())return;let anchor=node.parentElement;while(css(anchor).display==='contents'&&anchor.parentElement)anchor=anchor.parentElement;let origin=box(anchor),left=origin.left,top=origin.top,scrollLeft=anchor.scrollLeft||0,scrollTop=anchor.scrollTop||0,cached=interfaceText.get(node);
  if(cached&&cached.value===value){let dx=left-cached.left+cached.scrollLeft-scrollLeft,dy=top-cached.top+cached.scrollTop-scrollTop;for(let line of cached.lines)text(line.text,line.x+dx,line.y+dy,style,line.height);return;}
  const cache=lines=>interfaceText.set(node,{value,lines,left,top,scrollLeft,scrollTop});
  let range=document.createRange();range.selectNodeContents(node);let rects=[...range.getClientRects()];if(!rects.length)return;
  if(rects.length===1){let r=rects[0],drawn=style.whiteSpace.startsWith('pre')?value:value.replace(/\s+/g,' ');if(style.textOverflow==='ellipsis'&&r.width>node.parentElement.clientWidth){let available=node.parentElement.clientWidth;ctx.font=font(style);while(drawn.length&&ctx.measureText(drawn+'…').width>available)drawn=drawn.slice(0,-1);drawn+='…';}cache([{text:drawn,x:r.left,y:r.top,height:r.height}]);text(drawn,r.left,r.top,style,r.height);return;}
  let lines=[],line=null;
  if(!/\s{2}|[\t\r\n]/.test(value)){
   const character=i=>{range.setStart(node,i);range.setEnd(node,i+1);return range.getBoundingClientRect();};let begin=0;
   while(begin<value.length){let first=character(begin);if(!first.width||!first.height){begin++;continue;}let low=begin+1,high=value.length;while(low<high){let middle=(low+high)>>1;if(character(middle).top>first.top+1)high=middle;else low=middle+1;}let end=low,last=end;while(last>begin&&!character(last-1).width)last--;lines.push({x:first.left,y:first.top,height:first.height,text:value.slice(begin,last).replace(/\s+/g,' ')});begin=end;}
   for(let line of lines)text(line.text,line.x,line.y,style,line.height);cache(lines);return;
  }
  for(let i=0;i<value.length;i++){range.setStart(node,i);range.setEnd(node,i+1);let r=range.getBoundingClientRect();if(!r.width||!r.height)continue;if(!line||Math.abs(line.y-r.top)>1){line={x:r.left,y:r.top,height:r.height,text:''};lines.push(line);}line.text+=value[i];}
  for(let line of lines){line.text=style.whiteSpace.startsWith('pre')?line.text:line.text.replace(/\s+/g,' ');text(line.text,line.x,line.y,style,line.height);}cache(lines);
 }
 function pseudo(el,name,r,style){
  let cached=interfacePseudo.get(el);if(!cached){cached={};interfacePseudo.set(el,cached);}let ps=cached[name]||(cached[name]=interfaceStyle(el,name)),content=ps.content;if(content==='none'||content==='normal'||ps.display==='none')return;let value;try{value=JSON.parse(content);}catch{value=content.replace(/^['"]|['"]$/g,'');}
  let absolute=ps.position==='absolute',left=r.left+(Number.parseFloat(ps.left)||0),top=r.top+(Number.parseFloat(ps.top)||0),pw=Number.parseFloat(ps.width)||r.width,ph=Number.parseFloat(ps.height)||Number.parseFloat(ps.lineHeight)||r.height;
  if(content==='""'&&ps.backgroundImage!=='none'){
   ctx.fillStyle='rgba('+colors.rgb+',.33)';for(let x=0;x<pw;x+=8)ctx.fillRect(left+x,top,Math.min(4,pw-x),ph);return;
  }
  if(!value)return;
  const literalButton=style.button&&el.childNodes.length===1&&el.firstChild.nodeType===3,key=literalButton?[r.left,r.top,r.width,r.height,value,el.textContent].join(':'):null,position=cached[name+'Position'];
  if(key&&position?.key===key){for(let line of position.lines)text(line.text,line.x,line.y,ps,line.height);return;}
  if(style.button){
   let first=el.firstChild,last=el.lastChild,range=document.createRange();let anchor=null;
   if(name==='::before'&&first?.nodeType===3){range.selectNodeContents(first);anchor=range.getBoundingClientRect();ctx.font=font(ps);left=anchor.left-ctx.measureText(value).width;top=anchor.top;ph=anchor.height;}
   else if(name==='::after'&&last){range.selectNodeContents(last);anchor=range.getBoundingClientRect();left=anchor.right;top=anchor.top;ph=anchor.height;}
   else{ctx.font=font(ps);let label=el.textContent,full=value+label+value;left=r.left+(r.width-ctx.measureText(full).width)/2;if(name==='::after')left+=ctx.measureText(value+label).width;top=r.top;ph=r.height;}
  }else if(!absolute){let child=[...el.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());if(child){let range=document.createRange();range.selectNodeContents(child);let rect=range.getBoundingClientRect();ctx.font=font(ps);left=rect.left-ctx.measureText(value).width;top=rect.top;ph=rect.height;}}
  const lines=value.split('\n').map((value,i)=>({text:value,x:left,y:top+i*(Number.parseFloat(ps.lineHeight)||ph),height:ph}));for(let line of lines)text(line.text,line.x,line.y,ps,line.height);if(key)cached[name+'Position']={key,lines};
 }
 function walk(el,clip=null){if(ANDROID_BUILD){const page=mobile.pages.indexOf(el);if(page>=0&&!mobilePageVisible(page))return;}
  const clockPart=el.parentElement?.id==='timeDock'&&el.matches('.clock-display,.speed-control,.speed-readout');if(layer==='base'&&clockPart||layer==='clock'&&(el.id==='speedTicks'||el.id==='speed'))return;
  let structuralStyle=css(el);if(structuralStyle.display==='none'||structuralStyle.visibility==='hidden')return;
  if(structuralStyle.display==='contents'||el.id==='modalRoot'){ctx.save();ctx.globalAlpha*=Number(structuralStyle.opacity);for(let child of el.children)walk(child,clip);ctx.restore();return;}
  let style=structuralStyle,r=box(el);const padding=ANDROID_BUILD&&regions&&el.closest('.mobile-tabs')?24:0;if(!r.width&&!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth||clip&&(r.right<=clip.left||r.left>=clip.right||r.bottom<=clip.top||r.top>=clip.bottom)||el.tagName==='CANVAS'&&!el.dataset.projectIcon||regions&&!regions.some(a=>r.right+padding>a.x&&r.left-padding<a.x+a.width&&r.bottom>a.y&&r.top<a.y+a.height))return;
  ctx.save();if(el!==root&&!(layer==='clock'&&clockPart))ctx.globalAlpha*=Number(style.opacity);if(el.tagName==='CANVAS'&&el.dataset.projectIcon){ctx.drawImage(el,r.left,r.top,r.width,r.height);ctx.restore();return;}
  if(ANDROID_BUILD&&style.mobileTab)mobilePaintTabGlow(ctx,r,style.backgroundColor,scale);if(style.bar){ctx.beginPath();for(let x=0;x<r.width;x+=7)ctx.rect(r.left+x,r.top,4,r.height);ctx.clip();}
  if(el!==root&&!(layer==='modal'&&el.id==='modalBackdrop')&&!(el.tagName==='INPUT'&&el.type==='checkbox')&&style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent'){ctx.fillStyle=style.backgroundColor;ctx.fillRect(r.left,r.top,r.width,r.height);}
  if(style.solidRule){ctx.fillStyle=style.color;ctx.fillRect(r.left,r.top,r.width,1);}if(style.rule){for(let x=0;x<r.width;x+=5){ctx.fillStyle='rgba('+visualRGB+','+(.18*Math.max(0,1-x/(r.width*.7)))+')';ctx.fillRect(r.left+x,r.top,2,r.height);}}
  if(style.speedTick){let slider=$('speed'),fraction=slider.dataset.actualFill!==undefined?clamp(Number(slider.dataset.actualFill)/100,0,1):(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min)),track=speedTrack||(speedTrack=slider.getBoundingClientRect());ctx.fillStyle=colors.faint;ctx.fillRect(r.left,r.top,r.width,r.height);ctx.fillStyle=colors.ink;ctx.fillRect(r.left,r.top,clamp(track.left+track.width*fraction-r.left,0,r.width),r.height);}
  if(style.playSymbol){ctx.fillStyle=style.borderLeftColor;ctx.beginPath();ctx.moveTo(r.left,r.top);ctx.lineTo(r.right,r.top+r.height/2);ctx.lineTo(r.left,r.bottom);ctx.fill();}
  let input=el.tagName==='INPUT',select=el.tagName==='SELECT';
  if(input&&el.type==='range'){
   const trackHeight=Number.parseFloat(style['--range-track-height'])||6,trackStep=Number.parseFloat(style['--range-track-step']),thumbWidth=Number.parseFloat(style['--range-thumb-width'])||8,thumbHeight=Number.parseFloat(style['--range-thumb-height'])||16;
   let value=(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min)),x=r.left+value*(r.width-thumbWidth),y=r.top+r.height/2,ink=colors.ink,faint=colors.faint;
   let fill=el.dataset.actualFill!==undefined?clamp(Number(el.dataset.actualFill)/100,0,1):value;
   if(el.id!=='speed'){if(trackStep===0){ctx.fillStyle=faint;ctx.fillRect(r.left,y-trackHeight/2,r.width,trackHeight);ctx.fillStyle=ink;ctx.fillRect(r.left,y-trackHeight/2,r.width*fill,trackHeight);}else for(let n=0;n<r.width;n+=trackStep||8){const block=Math.min(5,r.width-n);ctx.fillStyle=faint;ctx.fillRect(r.left+n,y-trackHeight/2,block,trackHeight);ctx.fillStyle=ink;ctx.fillRect(r.left+n,y-trackHeight/2,clamp(r.width*fill-n,0,block),trackHeight);}}
   ctx.fillStyle=colors.bright;ctx.fillRect(x,y-thumbHeight/2,thumbWidth,thumbHeight);
  }else if(input&&el.type==='checkbox'){
   if(el.checked){ctx.fillStyle=colors.ink;ctx.fillRect(r.left,r.top,r.width,r.height);}else{ctx.fillStyle=colors.faint;for(let x=0;x<r.width;x+=4)ctx.fillRect(r.left+x,r.top,2,r.height);}
  }else if(el.tagName==='TEXTAREA'){
   ctx.beginPath();ctx.rect(r.left,r.top,r.width,r.height);ctx.clip();let pl=Number.parseFloat(style.paddingLeft)||0,pr=Number.parseFloat(style.paddingRight)||0,pt=Number.parseFloat(style.paddingTop)||0,lineHeight=Number.parseFloat(style.lineHeight)||Number.parseFloat(style.fontSize)*1.5;ctx.font=font(style);let charWidths=new Map(),lines=[],line='',used=0,begin=0;
   let cached=interfaceEdits.get(el),layoutKey=[ctx.font,r.width,pl,pr].join(':');if(cached&&cached.key===layoutKey&&cached.value===el.value)lines=cached.lines;else{for(let i=0;i<el.value.length;i++){let ch=el.value[i],size=charWidths.get(ch);if(size===undefined){size=ctx.measureText(ch).width;charWidths.set(ch,size);}if(ch==='\n'||used+size>r.width-pl-pr&&line){lines.push({text:line,begin,end:i});line='';used=0;begin=ch==='\n'?i+1:i;if(ch==='\n')continue;}line+=ch;used+=size;}lines.push({text:line,begin,end:el.value.length});interfaceEdits.set(el,{key:layoutKey,value:el.value,lines});}
   for(let i=0;i<lines.length;i++){let top=r.top+pt+i*lineHeight-el.scrollTop;if(top+lineHeight<r.top||top>r.bottom)continue;let line=lines[i];if(el.selectionEnd>el.selectionStart){let a=Math.max(line.begin,el.selectionStart),b=Math.min(line.end,el.selectionEnd);if(b>a){ctx.fillStyle='rgba('+visualRGB+',.25)';ctx.fillRect(r.left+pl+ctx.measureText(line.text.slice(0,a-line.begin)).width,top,ctx.measureText(line.text.slice(a-line.begin,b-line.begin)).width,lineHeight);}}text(line.text,r.left+pl,top,style,lineHeight);if(document.activeElement===el&&el.selectionStart===el.selectionEnd&&el.selectionStart>=line.begin&&el.selectionStart<=line.end){ctx.fillStyle=style.color;ctx.fillRect(r.left+pl+ctx.measureText(line.text.slice(0,el.selectionStart-line.begin)).width,top,1,lineHeight);}}
  }else if(input||select){
   ctx.beginPath();ctx.rect(r.left,r.top,r.width,r.height);ctx.clip();
   let value=select?el.selectedOptions[0]?.textContent:el.value,pl=Number.parseFloat(style.paddingLeft)||0,pr=Number.parseFloat(style.paddingRight)||0;ctx.font=font(style);let measure=ctx.measureText(value||'').width,x=style.textAlign==='center'?r.left+(r.width-measure)/2:style.textAlign==='right'?r.right-pr-measure:r.left+pl;
   text(value,x,r.top,style,r.height);
   if(select)text('v',r.right-12,r.top,style,r.height);
   if(input&&document.activeElement===el){let start=el.selectionStart??value.length,end=el.selectionEnd??start;if(end>start){ctx.fillStyle='rgba('+visualRGB+',.25)';ctx.fillRect(x+ctx.measureText(value.slice(0,start)).width,r.top,ctx.measureText(value.slice(start,end)).width,r.height);}else{ctx.fillStyle=style.color;ctx.fillRect(x+ctx.measureText(value.slice(0,start)).width,r.top+2,1,r.height-4);}}
  }else if(!['STYLE','SCRIPT','OPTION'].includes(el.tagName)){
   if(['hidden','clip','scroll','auto'].includes(style.overflowX)||['hidden','clip','scroll','auto'].includes(style.overflowY)){
    clip=clip?{left:Math.max(clip.left,r.left),right:Math.min(clip.right,r.right),top:Math.max(clip.top,r.top),bottom:Math.min(clip.bottom,r.bottom)}:r;
    ctx.beginPath();ctx.rect(r.left,r.top,r.width,r.height);ctx.clip();
   }
   if(el.tagName==='SUMMARY'&&style.display==='list-item'&&style.listStyleType!=='none'){ctx.fillStyle=style.color;ctx.beginPath();let x=r.left+2,y=r.top+r.height/2;if(el.parentElement.open){ctx.moveTo(x,y-3);ctx.lineTo(x+7,y-3);ctx.lineTo(x+3.5,y+2);}else{ctx.moveTo(x,y-4);ctx.lineTo(x,y+3);ctx.lineTo(x+6,y);}ctx.fill();}
   pseudo(el,'::before',r,style);for(let child of el.childNodes){if(el.tagName==='DETAILS'&&!el.open&&child.nodeName!=='SUMMARY')continue;if(child.nodeType===1)walk(child,clip);else if(child.nodeType===3)textNode(child,style);}pseudo(el,'::after',r,style);
  }
  ctx.restore();
 }
 if(layer==='clock'){const dock=$('timeDock');if(css(dock).display!=='none'&&css(dock).visibility!=='hidden')for(const child of dock.children)if(child.matches('.clock-display,.speed-control,.speed-readout'))walk(child);}else for(let child of root.children)if(!['scanlines','grain','glassLight','vignette'].includes(child.id)&&(layer==='all'||(child.id==='modalRoot')===(layer==='modal')))walk(child);
 ctx.restore();return count;
}

function sampleScreenWarp(u,v,out){
 const x=clamp(u*64-.5,0,63),y=clamp(v*64-.5,0,63),ix=x|0,iy=y|0,tx=x-ix,ty=y-iy;
 const left=ix*4,right=Math.min(63,ix+1)*4,top=iy*256,bottom=Math.min(63,iy+1)*256;
 for(let c=0;c<2;c++){
  const a=screenWarpData[top+left+c]*(1-tx)+screenWarpData[top+right+c]*tx;
  const b=screenWarpData[bottom+left+c]*(1-tx)+screenWarpData[bottom+right+c]*tx;
  out[c]=(a*(1-ty)+b*ty)/255-.5;
 }
 return out;
}
function createCPUPhosphor(width,height,cssWidth,cssHeight){
 const tightCut=typeof screenBloomProfile==='undefined'?.02:screenBloomProfile.tightCut,wideCut=typeof screenBloomProfile==='undefined'?.006:screenBloomProfile.wideCut;const tightGain=typeof screenBloomProfile==='undefined'?.55:screenBloomProfile.tightGain,wideGain=typeof screenBloomProfile==='undefined'?1.6:screenBloomProfile.wideGain,wideRadius=typeof screenBloomProfile==='undefined'?5:screenBloomProfile.radius;const size=width*height;let linearMemory=null,wasmSingle=null,wasmReduce=null,wasmFinish=null,wasmWarp=null,wasmDiff=null,wasmWarpTiles=null,wasmFinishTiles=null,cursor=0;if(typeof CPU_GAUSSIAN_MODULE!=='undefined'&&CPU_GAUSSIAN_MODULE)try{linearMemory=new WebAssembly.Memory({initial:Math.ceil((size*94+(width+height)*72+4096)/65536)});let instance=new WebAssembly.Instance(CPU_GAUSSIAN_MODULE,{env:{memory:linearMemory}});wasmSingle=instance.exports.blurSingleTiles;wasmReduce=instance.exports.reduce4;wasmFinish=instance.exports.finish;wasmWarp=instance.exports.warp;wasmDiff=instance.exports.diff;wasmWarpTiles=instance.exports.warpTiles;wasmFinishTiles=instance.exports.finishTiles;instance.exports.cutoffs(tightCut,wideCut,tightGain,wideGain);}catch{linearMemory=null;}
 function allocate(Type,count){if(!linearMemory)return new Type(count);cursor=Math.ceil(cursor/8)*8;let view=new Type(linearMemory.buffer,cursor,count);cursor+=view.byteLength;return view;}
 const tilesX=Math.ceil(width/8),tilesY=Math.ceil(height/8),tileCount=tilesX*tilesY,stride=width*4,out=allocate(Uint8ClampedArray,size*4),core=allocate(Float32Array,size*3),previous=wasmDiff?allocate(Uint32Array,size):new Uint32Array(size),warp=allocate(Uint8ClampedArray,size*4),tightH=allocate(Uint8ClampedArray,size*4),tightV=allocate(Uint8ClampedArray,size*4),wideV=allocate(Uint8ClampedArray,size*4),warpIndex=allocate(Uint32Array,size),warpX=allocate(Float32Array,size),warpY=allocate(Float32Array,size),kernelSource=wasmWarp?allocate(Uint32Array,size):null,inputImage=wasmDiff?new ImageData(new Uint8ClampedArray(kernelSource.buffer,kernelSource.byteOffset,size*4),width,height):null,fringeIndex=allocate(Uint32Array,size*3),fringeX=allocate(Uint16Array,size*3),fringeY=allocate(Uint16Array,size*3),dirty=wasmDiff?allocate(Uint8Array,tileCount):new Uint8Array(tileCount),tileBounds=[],edgeSamples=new Map(),result=new ImageData(out,width,height),density=width/cssWidth;let first=true;
 const batchMask=linearMemory?allocate(Uint8Array,tileCount):null,batchChanged=linearMemory?allocate(Uint8Array,tileCount):null,coreMask=allocate(Uint8Array,tileCount);
 const warpOffset=[0,0];
 // 玻璃外面是黑的，靠近边缘的一个像素留给抗锯齿。
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let q=sampleScreenWarp((x+.5)/width,(y+.5)/height,warpOffset),i=y*width+x,rawX=x+(settings.curve?q[0]*screenMapScale*density:0),rawY=y+(settings.curve?q[1]*screenMapScale*density:0),sx=clamp(rawX,0,width-1),sy=clamp(rawY,0,height-1),ix=Math.min(width-2,sx|0),iy=Math.min(height-2,sy|0);warpIndex[i]=(iy*width+ix)*4;warpX[i]=sx-ix;warpY[i]=sy-iy;let coverage=settings.curve?clamp(Math.min(rawX+.5,width-.5-rawX,rawY+.5,height-.5-rawY),0,1):1;if(coverage<1){let t=(y>>3)*tilesX+(x>>3),edges=edgeSamples.get(t);if(!edges)edgeSamples.set(t,edges=[]);edges.push(i*4,coverage);}for(let c=0;c<3;c++){let split=Number(settings.rgb)/1.05*(c===0?1:c===2?-1:0),fx=clamp(x+split*(1.05-1.6*q[0])*density,0,width-1),fy=clamp(y-split*1.6*q[1]*density,0,height-1),jx=Math.min(width-2,fx|0),jy=Math.min(height-2,fy|0),at=i*3+c;fringeIndex[at]=(jy*width+jx)*4+c;fringeX[at]=Math.round((fx-jx)*65535);fringeY[at]=Math.round((fy-jy)*65535);}}
 for(let ty=0;ty<tilesY;ty++)for(let tx=0;tx<tilesX;tx++){let x0=tx*8,y0=ty*8,x1=Math.min(width,x0+8),y1=Math.min(height,y0+8),loX=width,loY=height,hiX=0,hiY=0;for(let y of [y0,y1-1])for(let x of [x0,x1-1]){let i=warpIndex[y*width+x]>>>2,sx=i%width,sy=(i/width)|0;loX=Math.min(loX,sx);hiX=Math.max(hiX,sx);loY=Math.min(loY,sy);hiY=Math.max(hiY,sy);}tileBounds.push({x0,y0,x1,y1,loX:clamp(((loX-2)/8)|0,0,tilesX-1),hiX:clamp(((hiX+2)/8)|0,0,tilesX-1),loY:clamp(((loY-2)/8)|0,0,tilesY-1),hiY:clamp(((hiY+2)/8)|0,0,tilesY-1)});}
 function kernel(radius){let a=allocate(Float64Array,9);for(let i=0;i<9;i++)a[i]=Math.exp(-.5*i*i/(radius*radius));let sum=a[0]+2*a.slice(1).reduce((s,x)=>s+x,0),last=8;for(let i=0;i<9;i++)a[i]/=sum;while(last>0&&a[last]<1e-7)last--;return {a,last};}
 const tight=kernel(Math.max(.3,.65*density)),horizontalMinus=allocate(Uint32Array,width*9),horizontalPlus=allocate(Uint32Array,width*9),verticalMinus=allocate(Uint32Array,height*9),verticalPlus=allocate(Uint32Array,height*9);for(let x=0;x<width;x++)for(let k=0;k<=8;k++){horizontalMinus[x*9+k]=Math.max(0,x-k)*4;horizontalPlus[x*9+k]=Math.min(width-1,x+k)*4;}for(let y=0;y<height;y++)for(let k=0;k<=8;k++){verticalMinus[y*9+k]=Math.max(0,y-k)*stride;verticalPlus[y*9+k]=Math.min(height-1,y+k)*stride;}
 const lowWidth=Math.ceil(width/4),lowHeight=Math.ceil(height/4),lowCols=Math.ceil(lowWidth/8),lowRows=Math.ceil(lowHeight/8),lowCount=lowCols*lowRows,lowSize=lowWidth*lowHeight,lowSource=allocate(Uint8ClampedArray,lowSize*4),lowHorizontal=allocate(Uint8ClampedArray,lowSize*4),lowVertical=allocate(Uint8ClampedArray,lowSize*4),lowKernel=kernel(wideRadius*density/4),lowMask=allocate(Uint8Array,lowCount),lowChanged=allocate(Uint8Array,lowCount),lowIndex=allocate(Uint32Array,size),lowX=allocate(Float32Array,size),lowY=allocate(Float32Array,size),lowMinusX=allocate(Uint32Array,lowWidth*9),lowPlusX=allocate(Uint32Array,lowWidth*9),lowMinusY=allocate(Uint32Array,lowHeight*9),lowPlusY=allocate(Uint32Array,lowHeight*9);
 for(let x=0;x<lowWidth;x++)for(let k=0;k<=8;k++){lowMinusX[x*9+k]=Math.max(0,x-k)*4;lowPlusX[x*9+k]=Math.min(lowWidth-1,x+k)*4;}for(let y=0;y<lowHeight;y++)for(let k=0;k<=8;k++){lowMinusY[y*9+k]=Math.max(0,y-k)*lowWidth*4;lowPlusY[y*9+k]=Math.min(lowHeight-1,y+k)*lowWidth*4;}
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const fx=clamp((x+.5)/4-.5,0,lowWidth-1),fy=clamp((y+.5)/4-.5,0,lowHeight-1),ix=Math.min(lowWidth-2,fx|0),iy=Math.min(lowHeight-2,fy|0),i=y*width+x;lowIndex[i]=(iy*lowWidth+ix)*4;lowX[i]=fx-ix;lowY[i]=fy-iy;}

 function grow(mask,dx,dy){let target=new Uint8Array(tileCount);for(let t=0;t<tileCount;t++)if(mask[t]){let tx=t%tilesX,ty=(t/tilesX)|0;for(let y=Math.max(0,ty-dy);y<=Math.min(tilesY-1,ty+dy);y++)for(let x=Math.max(0,tx-dx);x<=Math.min(tilesX-1,tx+dx);x++)target[y*tilesX+x]=1;}return target;}
 function sample(plane,j,fx,fy){let a=plane[j]+(plane[j+4]-plane[j])*fx,b=plane[j+stride]+(plane[j+stride+4]-plane[j+stride])*fx;return a+(b-a)*fy;}
 // 先平均采样再做宽模糊。结果跨帧保留，只重算有变化的图块。
 function lowGrow(mask,dx,dy){const out=new Uint8Array(lowCount);for(let t=0;t<lowCount;t++)if(mask[t]){const tx=t%lowCols,ty=(t/lowCols)|0;for(let y=Math.max(0,ty-dy);y<=Math.min(lowRows-1,ty+dy);y++)for(let x=Math.max(0,tx-dx);x<=Math.min(lowCols-1,tx+dx);x++)out[y*lowCols+x]=1;}return out;}
 function blurPlane(source,target,mask,vertical,pw,ph,cols,kernel,minus,plus,maskMemory,changedMemory){
  if(wasmSingle){maskMemory.set(mask);changedMemory.fill(0);wasmSingle(source.byteOffset,target.byteOffset,kernel.a.byteOffset,minus.byteOffset,plus.byteOffset,kernel.last,Number(vertical),maskMemory.byteOffset,changedMemory.byteOffset,pw,ph);return changedMemory.slice();}
  const changed=new Uint8Array(mask.length);for(let t=0;t<mask.length;t++)if(mask[t]){const x0=t%cols*8,y0=((t/cols)|0)*8;for(let y=y0;y<Math.min(ph,y0+8);y++)for(let x=x0;x<Math.min(pw,x0+8);x++){const at=(y*pw+x)*4,position=(vertical?y:x)*9,base=vertical?x*4:y*pw*4;for(let c=0;c<3;c++){let sum=source[at+c]*kernel.a[0];for(let k=1;k<=kernel.last;k++)sum+=(source[base+minus[position+k]+c]+source[base+plus[position+k]+c])*kernel.a[k];const old=target[at+c];target[at+c]=sum;if(old!==target[at+c])changed[t]=1;}target[at+3]=255;}}return changed;
 }
 function lowBlur(source,target,mask,vertical){return blurPlane(source,target,mask,vertical,lowWidth,lowHeight,lowCols,lowKernel,vertical?lowMinusY:lowMinusX,vertical?lowPlusY:lowPlusX,lowMask,lowChanged);}
 function broadGlow(mask){const reduced=new Uint8Array(lowCount);for(let t=0;t<tileCount;t++)if(mask[t])reduced[((t/tilesX)>>2)*lowCols+((t%tilesX)>>2)]=1;
  lowMask.set(reduced);if(wasmReduce)wasmReduce(warp.byteOffset,lowSource.byteOffset,lowMask.byteOffset,width,height);else for(let y=0;y<lowHeight;y++)for(let x=0;x<lowWidth;x++)if(reduced[(y>>3)*lowCols+(x>>3)]){let at=(y*lowWidth+x)*4;for(let c=0;c<4;c++){let sum=0;for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)sum+=warp[(Math.min(height-1,y*4+dy)*width+Math.min(width-1,x*4+dx))*4+c];lowSource[at+c]=sum/16;}}
  const changedH=lowBlur(lowSource,lowHorizontal,lowGrow(reduced,1,0),false),changedV=lowBlur(lowHorizontal,lowVertical,lowGrow(changedH,0,1),true),full=new Uint8Array(tileCount);
  for(let t=0;t<lowCount;t++)if(changedV[t]){const tx=(t%lowCols)*4,ty=((t/lowCols)|0)*4;for(let y=Math.max(0,ty-1);y<Math.min(tilesY,ty+5);y++)for(let x=Math.max(0,tx-1);x<Math.min(tilesX,tx+5);x++)full[y*tilesX+x]=1;}
  if(wasmWarpTiles){batchMask.set(full);batchChanged.fill(0);wasmWarpTiles(lowVertical.byteOffset,wideV.byteOffset,lowIndex.byteOffset,lowX.byteOffset,lowY.byteOffset,lowWidth*4,batchMask.byteOffset,batchChanged.byteOffset,width,height,Number(first));return batchChanged.slice();}
  for(let t=0;t<tileCount;t++)if(full[t]){const tile=tileBounds[t];for(let y=tile.y0;y<tile.y1;y++)for(let x=tile.x0;x<tile.x1;x++){const i=y*width+x,j=lowIndex[i],fx=lowX[i],fy=lowY[i],at=i*4;for(let c=0;c<3;c++){const a=lowVertical[j+c]+(lowVertical[j+c+4]-lowVertical[j+c])*fx,b=lowVertical[j+c+lowWidth*4]+(lowVertical[j+c+lowWidth*4+4]-lowVertical[j+c+lowWidth*4])*fx;wideV[at+c]=a+(b-a)*fy;}wideV[at+3]=255;}}return full;
 }

 function blurTight(source,target,mask,vertical){return blurPlane(source,target,mask,vertical,width,height,tilesX,tight,vertical?verticalMinus:horizontalMinus,vertical?verticalPlus:horizontalPlus,batchMask,batchChanged);}
 function paint(image,options,regions=null){let start=performance.now(),source=image.data,packed=new Uint32Array(source.buffer,source.byteOffset,size),changed=0;dirty.fill(0);for(let r of regions||[{x:0,y:0,width,height}]){if(wasmDiff){if(source!==inputImage.data)for(let y=r.y;y<r.y+r.height;y++){let at=y*width+r.x;kernelSource.set(packed.subarray(at,at+r.width),at);}changed+=wasmDiff(kernelSource.byteOffset,previous.byteOffset,dirty.byteOffset,tilesX,width,r.x,r.x+r.width,r.y,r.y+r.height,Number(first));}else for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){let i=y*width+x;if(first||packed[i]!==previous[i]){dirty[(y>>3)*tilesX+(x>>3)]=1;previous[i]=packed[i];if(kernelSource)kernelSource[i]=packed[i];changed++;}}}let diffMS=performance.now()-start;if(!changed)return {image:result,changed:0,tiles:0,diffMS,warpMS:0,bloomMS:0,pixelMS:0};
  start=performance.now();let warpDirty=new Uint8Array(tileCount);for(let t=0;t<tileCount;t++){let tile=tileBounds[t],needed=first;for(let y=tile.loY;y<=tile.hiY&&!needed;y++)for(let x=tile.loX;x<=tile.hiX;x++)if(dirty[y*tilesX+x]){needed=true;break;}if(needed)warpDirty[t]=1;}
  if(wasmWarpTiles){batchMask.set(warpDirty);batchChanged.fill(0);wasmWarpTiles(kernelSource.byteOffset,warp.byteOffset,warpIndex.byteOffset,warpX.byteOffset,warpY.byteOffset,stride,batchMask.byteOffset,batchChanged.byteOffset,width,height,Number(first));}
  for(let t=0;t<tileCount;t++)if(warpDirty[t]){let tile=tileBounds[t];if(wasmWarpTiles)warpDirty[t]=batchChanged[t];else if(wasmWarp){let changed=wasmWarp(kernelSource.byteOffset,warp.byteOffset,warpIndex.byteOffset,warpX.byteOffset,warpY.byteOffset,stride,width,tile.x0,tile.x1,tile.y0,tile.y1);warpDirty[t]=first||changed?1:0;}else for(let y=tile.y0;y<tile.y1;y++)for(let x=tile.x0;x<tile.x1;x++){let i=y*width+x,j=warpIndex[i],fx=warpX[i],fy=warpY[i],at=i*4;for(let c=0;c<3;c++)warp[at+c]=sample(source,j+c,fx,fy);warp[at+3]=255;}let edges=edgeSamples.get(t);if(edges)for(let k=0;k<edges.length;k+=2){let at=edges[k],coverage=edges[k+1];for(let c=0;c<3;c++)warp[at+c]*=coverage;warp[at+3]=Math.round(255*coverage);}}
  let warpMS=performance.now()-start;start=performance.now();let glowDirty=warpDirty,narrowDirty=warpDirty;if(options.bloom){let hMask=grow(warpDirty,1,0),changedH=blurTight(warp,tightH,hMask,false),vMask=grow(changedH,0,1),changedV=blurTight(tightH,tightV,vMask,true),wideChanged=broadGlow(warpDirty);glowDirty=new Uint8Array(tileCount);narrowDirty=new Uint8Array(tileCount);for(let t=0;t<tileCount;t++){narrowDirty[t]=warpDirty[t]||changedV[t];glowDirty[t]=narrowDirty[t]||wideChanged[t];}}let bloomMS=performance.now()-start;start=performance.now();let finalMask=options.rgb?grow(glowDirty,1,1):glowDirty,painted=0;
  coreMask.set(options.rgb?grow(narrowDirty,1,1):narrowDirty);
  if(wasmFinishTiles){batchMask.set(finalMask);wasmFinishTiles(out.byteOffset,warp.byteOffset,tightV.byteOffset,wideV.byteOffset,fringeIndex.byteOffset,fringeX.byteOffset,fringeY.byteOffset,stride,Number(options.bloom),batchMask.byteOffset,width,height,core.byteOffset,coreMask.byteOffset);}
  for(let t=0;t<tileCount;t++)if(finalMask[t]){painted++;let tile=tileBounds[t];if(wasmFinishTiles)continue;if(wasmFinish){wasmFinish(out.byteOffset,warp.byteOffset,tightV.byteOffset,wideV.byteOffset,fringeIndex.byteOffset,fringeX.byteOffset,fringeY.byteOffset,stride,width,Number(options.bloom),tile.x0,tile.x1,tile.y0,tile.y1,core.byteOffset,coreMask[t]);continue;}for(let y=tile.y0;y<tile.y1;y++)for(let x=tile.x0;x<tile.x1;x++){let at=(y*width+x)*4,position=(y*width+x)*3;for(let c=0;c<3;c++){let i=position+c,j=fringeIndex[i],fx=fringeX[i]/65535,fy=fringeY[i]/65535,color=core[position+c];if(coreMask[t]){color=sample(warp,j,fx,fy)/255;if(options.bloom){const a=Math.max(0,sample(tightV,j,fx,fy)/255*tightGain-tightCut*warp[at+3]/255)*Number(options.bloom);color=1-(1-color)*(1-a);}core[position+c]=color;color=core[position+c];}if(options.bloom){const b=Math.max(0,wideV[at+c]/255*wideGain-wideCut*warp[at+3]/255)*Number(options.bloom);color=1-(1-color)*(1-b);}out[at+c]=color*255;}out[at+3]=255;}}
  const outputRegions=[];let previousRuns=new Map();for(let y=0;y<tilesY;y++){let currentRuns=new Map();for(let x=0;x<tilesX;){if(!finalMask[y*tilesX+x]){x++;continue;}let left=x;while(x<tilesX&&finalMask[y*tilesX+x])x++;let key=left+':'+x,r=previousRuns.get(key);if(r)r.height=Math.min(height-r.y,r.height+8);else{r={x:left*8,y:y*8,width:Math.min(width-left*8,(x-left)*8),height:Math.min(8,height-y*8)};outputRegions.push(r);}currentRuns.set(key,r);}previousRuns=currentRuns;}
  first=false;return {image:result,changed,tiles:painted,regions:outputRegions,diffMS,warpMS,bloomMS,pixelMS:performance.now()-start};
 }
 return {paint,inputImage,backend:wasmSingle?'wasm':'js',invalidate(){first=true;}};
}

// 瞬时屏幕故障，切片参数沿用作者自己的火炬船模拟器。
const TRANSITION_FX={errorSeconds:.48,rows:40,ticks:14,collapse:.18,pinch:.10,black:.65,openLine:.07,openScreen:.20,settle:.28};
const transitionEnds=(()=>{let t=0;return ['errorSeconds','collapse','pinch','black','openLine','openScreen','settle'].map(k=>t+=TRANSITION_FX[k]);})();
let screenTransition=null;
function paintDisplayHalo(ctx,width,height){
 if(!screenBackdrop?.halo||$('glassLight').style.display==='none')return;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(screenBackdrop.halo,0,0,width,height);ctx.restore();
}
function transitionBackdrop(width,height){
 const copy=screenRenderer?.backdropSnapshot();if(copy)return copy;
 const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
 ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);if(screenBackdrop){if(settings.crt)ctx.drawImage(screenBackdrop.scan,0,0,width,height);paintDisplayHalo(ctx,width,height);return c;}
 ctx.save();ctx.translate(width*.5,height*.48);ctx.scale(width*.55,height*.52);const glow=ctx.createRadialGradient(0,0,0,0,0,1.4);for(const [at,alpha]of [[0,.035],[.25,.022],[.65/1.4,.009],[.9/1.4,.003],[1.15/1.4,.0005],[1,0]])glow.addColorStop(at,'rgba('+visualRGB+','+alpha+')');ctx.fillStyle=glow;ctx.fillRect(-1.4,-1.4,2.8,2.8);ctx.restore();return c;
}
function createTransitionErrorGPU(image,base){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});if(!gl)return null;
 const resources=[];let lost=false;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});
 const dispose=()=>{for(const [type,resource]of resources)gl['delete'+type](resource);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();canvas.width=canvas.height=0;};
 try{
 const shader=(type,source)=>{const s=gl.createShader(type);resources.push(['Shader',s]);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 function program(vertex,fragment){const p=gl.createProgram();resources.push(['Program',p]);gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision highp float;'+fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 // 背景不动，只移动发光层。扫描带和辉光矩形各用一次绘制调用。
 const vertex='attribute vec2 p;attribute vec4 rect,delta;varying vec2 uv;varying vec4 b,shift;void main(){uv=p;b=rect;shift=delta;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}';
 const main=program(vertex,`varying vec2 uv;varying vec4 b,shift;uniform sampler2D picture,base;uniform vec2 pixels;uniform float strength;
 vec3 emission(vec2 p){p=fract(p);return max(vec3(0.),texture2D(picture,p).rgb-texture2D(base,p).rgb);}
 void main(){vec3 original=texture2D(picture,uv).rgb;vec4 d=shift*strength;
 vec2 edge=min(uv-b.xy,b.xy+b.zw-uv)/pixels;float cover=clamp(min(edge.x,edge.y)+.5,0.,1.);
 if(cover<=0.){gl_FragColor=vec4(original,1.);return;}
 vec2 q=uv-d.xy;vec3 center=emission(q),red=emission(q-d.zw),blue=emission(q+d.zw);
 vec3 light=mix(vec3(red.r,center.g,blue.b),center,.15);
 gl_FragColor=vec4(mix(original,texture2D(base,uv).rgb+light,cover),1.);}`);
 const spark=program('attribute vec2 p,local,halfSize;attribute float alpha;varying vec2 q,h;varying float a,y;uniform vec2 extent;void main(){q=local;h=halfSize;a=alpha;y=p.y*extent.y;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}',`varying vec2 q,h;varying float a,y;uniform vec3 ink;uniform float bloom,split,scan,period,pixel;
 float light(vec2 p){vec2 delta=abs(p)-h;float d=length(max(delta,0.))+min(max(delta.x,delta.y),0.);return clamp(.5-d/pixel,0.,1.)+.28*bloom*exp(-.5*max(0.,d)*max(0.,d)/10.24);}
 void main(){float raster=1.-scan*.11*(1.-cos(y/period*6.2831853));vec3 c=ink*a*raster*vec3(light(q+vec2(split,0.)),light(q),light(q-vec2(split,0.)));gl_FragColor=vec4(c,1.);}`);
 const vertices=gl.createBuffer(),attributes=new Set();resources.push(['Buffer',vertices]);
 function attribute(p,name,size,stride,offset){const at=gl.getAttribLocation(p,name);attributes.add(at);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,stride,offset);}
 const uniforms=p=>new Proxy({}, {get:(o,key)=>o[key]??(o[key]=gl.getUniformLocation(p,key))}),u=uniforms(main),s=uniforms(spark);
 for(const [i,source]of [image,base].entries()){const tex=gl.createTexture();resources.push(['Texture',tex]);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
 gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(main);gl.uniform1i(u.picture,0);gl.uniform1i(u.base,1);gl.uniform2f(u.pixels,1/canvas.width,1/canvas.height);
 const bands=new Float32Array(160),shifts=new Float32Array(160),strips=new Float32Array(40*6*10);let lastTick=-1,sparks;
 const ambient=$('ambient'),r=ambient.getBoundingClientRect(),cols=ambient.width,rows=ambient.height,stepX=r.width/cols,stepY=r.height/rows;
 return {canvas,get lost(){return lost;},paint(tick,strength){
  gl.disable(gl.BLEND);gl.useProgram(main);gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
  if(tick!==lastTick){
   for(let row=0;row<40;row++){const seed=row+tick*43,sign=transitionHash(seed+31)<.5?-1:1;bands.set([(transitionHash(seed+3)*1.15-.15),row/40,transitionHash(seed)<.2?0:.32+.64*transitionHash(seed+5),(.6+.4*transitionHash(seed+7))/40],row*4);shifts.set([(transitionHash(seed+13)*2-1)*.20,(transitionHash(seed+19)*2-1)*.085,(4+22*transitionHash(seed+23))*sign/innerWidth,(transitionHash(seed+29)*2-1)*3*sign/innerHeight],row*4);}
   let offset=0;for(let row=0;row<40;row++)for(const [x,y]of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]){strips.set([x,(row+y)/40,...bands.subarray(row*4,row*4+4),...shifts.subarray(row*4,row*4+4)],offset);offset+=10;}
   const values=[];
   for(let i=0;i<18;i++){const seed=3001+tick*79+i*17,x=r.left+(2+Math.floor(transitionHash(seed)*(cols-4)))*stepX,y=r.top+(2+Math.floor(transitionHash(seed+1)*(rows-4)))*stepY;
    const radius=Math.hypot((x+stepX*.5-innerWidth*.5)/(innerWidth*.5),(y+stepY*.5-innerHeight*.49)/(innerHeight*.5))/Math.SQRT2,v=radius<=.44?0:radius<=.72?(radius-.44)/.28*.10:radius<=.92?.10+(radius-.72)/.20*.54:Math.min(1,.64+(radius-.92)/.20*.36),a=(.35+.45*transitionHash(seed+2))*(settings.vignette?1-v:1),pad=settings.bloom?12:2;
    for(const [tx,ty]of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]){const lx=tx*(stepX/2+pad),ly=ty*(stepY/2+pad),p=screenVisualPoint(x+stepX/2+lx,y+stepY/2+ly);values.push(p.x/innerWidth,p.y/innerHeight,lx,ly,stepX/2,stepY/2,a);}
   }sparks=new Float32Array(values);lastTick=tick;
  }
  gl.bufferData(gl.ARRAY_BUFFER,strips,gl.STREAM_DRAW);attribute(main,'p',2,40,0);attribute(main,'rect',4,40,8);attribute(main,'delta',4,40,24);gl.uniform1f(u.strength,strength);gl.drawArrays(gl.TRIANGLES,0,240);
  gl.useProgram(spark);gl.bufferData(gl.ARRAY_BUFFER,sparks,gl.STREAM_DRAW);for(const [name,size,offset]of [['p',2,0],['local',2,8],['halfSize',2,16],['alpha',1,24]])attribute(spark,name,size,28,offset);
  gl.uniform2f(s.extent,innerWidth,innerHeight);gl.uniform3fv(s.ink,visualRGB.split(',').map(n=>Number(n)/255));gl.uniform1f(s.bloom,Number(settings.bloom));gl.uniform1f(s.split,Number(settings.rgb));gl.uniform1f(s.scan,settings.crt?1:0);gl.uniform1f(s.period,Math.max(1,settings.crt));gl.uniform1f(s.pixel,innerWidth/canvas.width);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);gl.drawArrays(gl.TRIANGLES,0,sparks.length/7);
  for(const i of attributes)gl.disableVertexAttribArray(i);
 },dispose};
 }catch(error){dispose();throw error;}
}

function transitionSnapshot(){if(ANDROID_BUILD)invalidateInterface();
 let copy=screenRenderer?.snapshot();if(copy)return copy;
 const c=document.createElement('canvas');c.width=Math.round(innerWidth*(devicePixelRatio||1));c.height=Math.round(innerHeight*(devicePixelRatio||1));let ctx=c.getContext('2d'),scale=c.width/innerWidth;
 const base=transitionBackdrop(c.width,c.height);ctx.drawImage(base,0,0);base.width=base.height=0;
 if(ANDROID_BUILD)mobileSnapshotCanvases(ctx,scale);else for(let canvas of $('crtGlass').querySelectorAll('canvas:not(#glassLight)')){let r=canvas.getBoundingClientRect();if(canvas.width&&canvas.height&&r.width){ctx.globalAlpha=Number(getComputedStyle(canvas).opacity);ctx.drawImage(canvas,r.left*scale,r.top*scale,r.width*scale,r.height*scale);}}
 ctx.globalAlpha=1;const ui=document.createElement('canvas');ui.width=c.width;ui.height=c.height;paintInterface(ui.getContext('2d'),c.width,c.height);ctx.drawImage(ui,0,0);return c;
}
function transitionBeam(source){
 // 沿纵向逐级缩小，直到整列光积累到一行。
 let reduced=source,temporary=[];
 while(reduced.height>1){let c=document.createElement('canvas');c.width=source.width;c.height=Math.max(1,Math.ceil(reduced.height/2));c.getContext('2d').drawImage(reduced,0,0,c.width,c.height);temporary.push(c);reduced=c;}
 let row=reduced.getContext('2d').getImageData(0,0,source.width,1).data,unit=source.width/innerWidth,beam=document.createElement('canvas');beam.width=source.width;beam.height=Math.ceil(64*unit)|1;
 const ctx=beam.getContext('2d'),data=ctx.createImageData(beam.width,beam.height),colors=new Float32Array(beam.width*3),mean=[0,0,0];
 for(let x=0;x<beam.width;x++){
  const rgb=[Math.max(0,row[x*4]-2)*18,Math.max(0,row[x*4+1]-3)*18,Math.max(0,row[x*4+2]-2)*18],scale=Math.min(1,240/Math.max(1,...rgb));
  for(let k=0;k<3;k++){colors[x*3+k]=rgb[k]*scale;mean[k]+=rgb[k]*scale/beam.width;}
 }
 for(let y=0;y<beam.height;y++){let d=(y-(beam.height-1)/2)/unit,alpha=.74*Math.exp(-d*d/2.4)+.16*Math.exp(-d*d/98)+.07*Math.exp(-d*d/512);for(let x=0;x<beam.width;x++){let i=(y*beam.width+x)*4;data.data[i]=colors[x*3];data.data[i+1]=colors[x*3+1];data.data[i+2]=colors[x*3+2];data.data[i+3]=Math.round(alpha*255);}}
 ctx.putImageData(data,0,0);for(let c of temporary)c.width=c.height=0;
 let spot=document.createElement('canvas');spot.width=spot.height=Math.ceil(64*unit)|1;const sx=spot.getContext('2d'),r=spot.width/2,g=sx.createRadialGradient(r,r,0,r,r,r),color=mean.map(Math.round).join(',');g.addColorStop(0,'rgba('+color+',.8)');g.addColorStop(.15,'rgba('+color+',.35)');g.addColorStop(1,'rgba('+color+',0)');sx.fillStyle=g;sx.fillRect(0,0,spot.width,spot.height);
 return {beam,spot};
}
function releaseTransitionImage(t,keepBeam=false){t.errorGPU?.dispose();t.errorGPU=null;for(let c of [t.image,t.base,t.emission,...(t.channels||[])])if(c)c.width=c.height=0;t.image=t.base=t.emission=null;t.channels=null;if(!keepBeam){for(let c of [t.beam,t.spot])if(c)c.width=c.height=0;t.beam=t.spot=null;}}
function cancelScreenTransition(stopSound=true){if(!screenTransition)return;let t=screenTransition;if(stopSound)music.stopEffects(t);screenTransition=null;screenRenderer?.presentation(null);if(t.kind==='space'){for(let c of [t.targetImage,t.layer,t.mask])if(c)c.width=c.height=0;departureSolarScene=null;}releaseTransitionImage(t);t.canvas.remove();$('crtGlass').inert=false;pendingPhysicsReal=0;pendingPhysicsDays=0;lastSimulationTime=performance.now();}
function startScreenTransition(){
 try{let image=transitionSnapshot(),canvas=document.createElement('canvas');canvas.id='screenTransition';canvas.setAttribute('aria-hidden','true');canvas.width=image.width;canvas.height=image.height;document.body.append(canvas);screenTransition={owner:game,image,base:transitionBackdrop(image.width,image.height),...transitionBeam(image),canvas,ctx:canvas.getContext('2d',{alpha:false}),elapsed:0,last:performance.now(),painted:-Infinity,prepared:false,reopening:false};const t=screenTransition;try{t.errorGPU=createTransitionErrorGPU(image,t.base);}catch(error){console.warn('Transition GPU:',error);}
 if(t.errorGPU){t.errorGPU.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1001;pointer-events:none';document.body.append(t.errorGPU.canvas);}
 else prepareTransitionLight(t);
 clearPointerRoute();clearHitHover();$('crtGlass').inert=true;music.effect(t,'fracture',TRANSITION_FX.errorSeconds);paintScreenTransition(t,0);}catch(e){console.error('Screen transition:',e);cancelScreenTransition();}
}
function previewTransition(){if(screenTransition)return false;flushSimulationTime();startScreenTransition();if(!screenTransition)return false;screenTransition.prepared=true;screenRenderer?.invalidate();return true;}
function transitionHash(n){let x=(n>>>0)+1;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))&0x00ffffff)/16777216;}
function prepareTransitionLight(t){
 const light=document.createElement('canvas');light.width=t.image.width;light.height=t.image.height;const ctx=light.getContext('2d',{willReadFrequently:true});ctx.drawImage(t.image,0,0);
 const pixels=ctx.getImageData(0,0,light.width,light.height),base=t.base.getContext('2d').getImageData(0,0,light.width,light.height).data;
 for(let i=0;i<pixels.data.length;i+=4)for(let k=0;k<3;k++)pixels.data[i+k]=Math.max(0,pixels.data[i+k]-base[i+k]);ctx.putImageData(pixels,0,0);t.emission=light;t.channels=splitColorChannels(light);
}
function paintTransitionPixels(t,tick){
 const ctx=t.ctx,unit=t.canvas.width/innerWidth,ambient=$('ambient'),r=ambient.getBoundingClientRect(),cols=ambient.width,rows=ambient.height,stepX=r.width/cols,stepY=r.height/rows,period=Math.max(6,8/(devicePixelRatio||1)),rgb=visualRGB.split(',').map(Number);
 const quad=(points,dx=0)=>{ctx.beginPath();ctx.moveTo(points[0].x*unit+dx,points[0].y*unit);for(let p of points.slice(1))ctx.lineTo(p.x*unit+dx,p.y*unit);ctx.closePath();ctx.fill();};
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<18;i++){
  let seed=3001+tick*79+i*17,col=2+Math.floor(transitionHash(seed)*(cols-4)),row=2+Math.floor(transitionHash(seed+1)*(rows-4)),x=r.left+col*stepX,y=r.top+row*stepY,points=[[x,y],[x+stepX,y],[x+stepX,y+stepY],[x,y+stepY]].map(([a,b])=>screenVisualPoint(a,b)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
  let radius=Math.hypot((x+stepX*.5-innerWidth*.5)/(innerWidth*.5),(y+stepY*.5-innerHeight*.49)/(innerHeight*.5))/Math.SQRT2,vignette=radius<=.44?0:radius<=.72?(radius-.44)/.28*.10:radius<=.92?.10+(radius-.72)/.20*.54:Math.min(1,.64+(radius-.92)/.20*.36),alpha=(.35+.45*transitionHash(seed+2))*(settings.vignette?1-vignette:1);
  const ink=channels=>{let gradient=ctx.createLinearGradient(0,top*unit,0,bottom*unit),n=Math.max(2,Math.ceil((bottom-top)*unit));for(let j=0;j<=n;j++){let fy=top+(bottom-top)*j/n,wave=(1+Math.cos(fy/period*Math.PI*2))/2,scan=settings.crt?1-(1-wave)*.22:1;gradient.addColorStop(j/n,'rgba('+channels.join(',')+','+(alpha*scan)+')');}return gradient;};
  if(settings.bloom){ctx.shadowColor='rgba('+visualRGB+','+(alpha*.28*Number(settings.bloom))+')';ctx.shadowBlur=(settings.quality==='low'?1.6:3.2)*unit;}
  if(settings.rgb){ctx.fillStyle=ink([rgb[0],0,0]);quad(points,-Number(settings.rgb)*unit);ctx.fillStyle=ink([0,0,rgb[2]]);quad(points,Number(settings.rgb)*unit);}
  ctx.fillStyle=ink(rgb);quad(points);ctx.shadowBlur=0;
 }
 ctx.restore();
}
function paintTransitionError(t,u){
 if(t.errorGPU?.lost){t.errorGPU.dispose();t.errorGPU=null;prepareTransitionLight(t);}
 let ctx=t.ctx,w=t.canvas.width,h=t.canvas.height,unit=w/innerWidth,tick=Math.floor(u*TRANSITION_FX.ticks),strength=(.9+.3*transitionHash(tick+701))*(1-.18*u*u),band=h/TRANSITION_FX.rows;if(t.errorGPU){t.errorGPU.paint(tick,strength);return;}ctx.drawImage(t.image,0,0);
 const shifted=(image,dx,dy,clip)=>{for(let x of [dx,dx+(dx>0?-w:w)])for(let y of [dy,dy+(dy>0?-h:h)])if(x+w>clip.x&&x<clip.x+clip.width&&y+h>clip.y&&y<clip.y+clip.height)ctx.drawImage(image,x,y);};
 for(let row=0;row<TRANSITION_FX.rows;row++){
  const seed=row+tick*43;if(transitionHash(seed)<.2)continue;
  let x=(transitionHash(seed+3)*1.15-.15)*w,width=(.32+.64*transitionHash(seed+5))*w,y=row*band,height=(.6+.4*transitionHash(seed+7))*band,dx=(transitionHash(seed+13)*2-1)*.20*w*strength,dy=(transitionHash(seed+19)*2-1)*.085*h*strength;
  let sign=transitionHash(seed+31)<.5?-1:1,sx=(4+22*transitionHash(seed+23))*strength*sign*unit,sy=(transitionHash(seed+29)*2-1)*3*strength*sign*unit;
  const clip={x:Math.max(0,x),y:Math.max(0,y),width:Math.min(w,x+width)-Math.max(0,x),height:Math.min(h,y+height)-Math.max(0,y)};
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.drawImage(t.base,0,0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.85;shifted(t.channels[1],dx,dy,clip);shifted(t.channels[0],dx+sx,dy+sy,clip);shifted(t.channels[2],dx-sx,dy-sy,clip);ctx.globalAlpha=.15;shifted(t.emission,dx,dy,clip);ctx.restore();
 }
 paintTransitionPixels(t,tick);
}
function paintScreenTransition(t,time){
 let ctx=t.ctx,w=t.canvas.width,h=t.canvas.height,unit=w/innerWidth,e=transitionEnds;if(time<e[0]&&t.errorGPU){t.canvas.dataset.phase='fracture';paintTransitionError(t,time/e[0]);return;}if(t.errorGPU){t.errorGPU.dispose();t.errorGPU=null;}ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#020302';ctx.fillRect(0,0,w,h);
 const glow=(width,alpha=1)=>{if(!t.beam||width<=0||alpha<=0)return;ctx.globalAlpha=alpha;ctx.drawImage(t.beam,(w-width)/2,(h-t.beam.height)/2,width,t.beam.height);if(width<60*unit){ctx.globalAlpha=alpha*(1-width/(60*unit));ctx.drawImage(t.spot,(w-t.spot.width)/2,(h-t.spot.height)/2);}ctx.globalAlpha=1;};
 // 横向偏转在收成细光束和铺满屏幕时都降为零，避免两端突然晃动。
 const picture=(height,jitter=0,alpha=1,wave=0)=>{if(!t.image||height<=0)return;let x=Math.sin(time*83)*jitter*7*unit,top=(h-height)/2+Math.sin(time*57)*jitter*2*unit;ctx.globalAlpha=alpha;
  if(wave<=0)ctx.drawImage(t.image,x,top,w,height);
  else{let bands=Math.max(1,Math.min(128,Math.ceil(height/(4*unit)))),sourceStep=t.image.height/bands,destStep=height/bands;for(let i=0;i<bands;i++){let v=(i+.5)/bands,dx=wave*unit*(22*Math.sin(v*9+time*18)+9*Math.sin(v*21-time*11));ctx.drawImage(t.image,0,i*sourceStep,t.image.width,sourceStep,x+dx,top+i*destStep,w,destStep+.5);}}
  ctx.globalAlpha=1;};
 if(time<e[0]){t.canvas.dataset.phase='fracture';paintTransitionError(t,time/e[0]);}
 else if(time<e[1]){t.canvas.dataset.phase='vertical-collapse';let u=(time-e[0])/TRANSITION_FX.collapse;picture(Math.max(2*unit,h*(1-u)**3),.65*Math.sin(Math.PI*u),1,Math.sin(Math.PI*u));glow(w,u**3);}
 else if(time<e[2]){t.canvas.dataset.phase='horizontal-collapse';let u=(time-e[1])/TRANSITION_FX.pinch;glow(Math.max(2*unit,w*(1-u)**2));}
 else if(time<e[3]){t.canvas.dataset.phase='black';glow(2*unit,Math.max(0,1-(time-e[2])/.13));}
 else if(time<e[4]){t.canvas.dataset.phase='horizontal-return';let u=(time-e[3])/TRANSITION_FX.openLine;glow(Math.max(2*unit,w*(1-(1-u)**3)));}
 else if(time<e[5]){t.canvas.dataset.phase='vertical-return';let u=(time-e[4])/TRANSITION_FX.openScreen;picture(h*(1-(1-u)**3),1.25*(1-u),1,Math.sin(Math.PI*u));glow(w,(1-u)**2*.7);}
 else{t.canvas.dataset.phase='settling';let u=Math.min(1,(time-e[5])/TRANSITION_FX.settle);picture(h,.28*(1-u)**3);t.canvas.style.opacity=String(1-Math.max(0,(u-.7)/.3));}
}
function tickScreenTransition(now){
 if(screenTransition?.kind==='space'){tickDepartureTransition(now);return;}if(screenTransition?.kind==='ending'){tickEndingTransition(now);return;}
 let t=screenTransition;if(!t)return;if(t.owner!==game){cancelScreenTransition();return;}let delta=Math.max(0,(now-t.last)/1000);t.last=now;if(document.hidden)return;t.elapsed+=Math.min(delta,.1);
 if(t.elapsed>=transitionEnds[1]&&!t.reopening&&t.image)releaseTransitionImage(t,true);
 if(t.elapsed>=transitionEnds[3]&&!t.reopening){if(screenRenderer?.pending){t.elapsed=transitionEnds[3];return;}presentReopening(t,departureInterfaceSnapshot());}
 if(t.elapsed>=transitionEnds[6]){cancelScreenTransition(false);render();return;}
 if(now-t.painted>=1000/60){paintScreenTransition(t,t.elapsed);if(t.raw){t.canvas.style.opacity='1';markCanvasPaint(t.canvas);screenRenderer?.tick(now);}t.painted=now;}
}
for(let type of ['pointerdown','pointerup','pointermove','click','keydown','keyup','wheel'])window.addEventListener(type,e=>{if(screenTransition||startupCurtain.isConnected){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});

let screenRenderer=null;
document.fonts.addEventListener?.('loadingdone',()=>{countFitKey='';screenRenderer?.invalidate(true);});
// 动画画布用原像素记录变化区域，合成时再和 DOM 的变化一起算需要重绘的范围。
function canvasPixelAreas(previous,current,width,height){
 const side=8,cols=Math.ceil(width/side),rows=Math.ceil(height/side),mask=new Uint8Array(cols*rows),areas=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(previous[y*width+x]!==current[y*width+x])mask[(y>>3)*cols+(x>>3)]=1;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;){if(!mask[y*cols+x]){x++;continue;}let start=x;while(x<cols&&mask[y*cols+x])x++;areas.push({x:start*side,y:y*side,width:Math.min(width-start*side,(x-start)*side),height:Math.min(side,height-y*side)});}
 return areas;
}

function createScreenRenderer(){
 let output=document.createElement('canvas'),raw=document.createElement('canvas');const clockMotion=document.createElement('canvas'),clockMotionCtx=clockMotion.getContext('2d',{willReadFrequently:true});const clockUI=document.createElement('canvas'),clockCtx=clockUI.getContext('2d',{willReadFrequently:true});let clockGeometry=null,clockSignature='',clockMotionSignature='';const ui=document.createElement('canvas'),modalUI=document.createElement('canvas');let backdropKey='';let modalBounds=null,modalReady=false;const modalCtx=modalUI.getContext('2d',{willReadFrequently:true});output.id='screenOutput';output.setAttribute('aria-hidden','true');document.body.append(output);
 let rawCtx=raw.getContext('2d',{alpha:false}),presentation=null,presentationSerial=-1,presentationEffects=-1,cpu=null,cpuKey='',cpuContext=null,cpuPixels=null,cpuFirst=true,fullInterface=true,interfaceAreas=[],sourceAreas=[],canvasSerials=new WeakMap(),canvasRasters=new WeakMap();const uiCtx=ui.getContext('2d',{willReadFrequently:true});
 let cachedOnCPU=null,uiImage,uiImageCtx,clockImage,clockImageCtx,backdrop,backdropCtx;
 function cacheBitmapLayers(onCPU){
  if(cachedOnCPU===onCPU)return;
  // 软件合成要读回像素，把缓存放在 CPU 上可以省掉每帧从 GPU 读取的时间。
  const options={willReadFrequently:onCPU};cachedOnCPU=onCPU;
  uiImage=document.createElement('canvas');uiImageCtx=uiImage.getContext('2d',options);
  clockImage=document.createElement('canvas');clockImageCtx=clockImage.getContext('2d',options);
  backdrop=document.createElement('canvas');backdropCtx=backdrop.getContext('2d',options);backdropKey='';
 }
 let gl=null,mode='browser',ready=false,busy=false,lost=false,contextCanvas=null,dirty=true,css='',effects=null,effectsDirty=true,effectsRevision=0,w=0,h=0,ww=0,hh=0,lastCapture=-Infinity,lastPaint=-Infinity,epoch=0,stats={captures:0,presents:0,paintMS:0,snapshotMS:0,uploadMS:0,gpuMS:[],errors:[]},textures=[],buffers=[],programs={},queries=[],timer=null,presentTimes=[];
 function flatten(rules){let text='';for(let r of rules){if(r.type===4){if(matchMedia(r.conditionText).matches)text+=flatten(r.cssRules);}else text+=r.cssText+'\n';}return text;}
 function viewportCSS(text){return text.replace(/url\([^)]*\)|(-?[\d.]+)(vh|vw)\b/g,(whole,n,unit)=>n===undefined?whole:Number(n)*(unit==='vh'?hh:ww)/100+'px');}
 function dimensions(){cacheBitmapLayers(ANDROID_BUILD||mode==='cpu');ww=innerWidth;hh=innerHeight;let ratio=ww/hh,fontSize=parseFloat(getComputedStyle(document.body).fontSize),automatic=Math.min(devicePixelRatio||1,Math.max(12/fontSize,Math.min(1280,ww)/ww)),density=settings.renderer==='native'||settings.renderScale==='device'?(devicePixelRatio||1):['1','.75','.5'].includes(settings.renderScale)?Number(settings.renderScale):automatic;w=Math.round(ww*density);h=Math.round(w/ratio);raw.width=ui.width=uiImage.width=modalUI.width=clockUI.width=clockImage.width=output.width=w;raw.height=ui.height=uiImage.height=modalUI.height=clockUI.height=clockImage.height=output.height=h;clockGeometry=null;clockSignature='';clockMotionSignature='';cpuPixels=null;cpuFirst=true;fullInterface=true;modalReady=false;sourceAreas=[];interfaceAreas=[];canvasSerials=new WeakMap();canvasRasters=new WeakMap();css=viewportCSS([...document.styleSheets].map(x=>flatten(x.cssRules)).join('\n'));dirty=true;ready=false;}
 function updateInterpolation(){output.style.imageRendering=settings.interpolation==='linear'?'auto':'pixelated';}
 function fail(e){stats.errors.push(String(e));stats.errors=stats.errors.slice(-3);mode='browser';observeInterface();ready=false;document.body.classList.remove('bitmap-screen');output.style.display='none';}
 function automaticBackend(){return ['native','auto'].includes(settings.renderer);}
 function configure(override=null){epoch++;busy=false;for(let c of uploadCanvases.values())c.width=c.height=0;uploadCanvases.clear();let requested=override||settings.renderer||'native';if(['native','auto'].includes(requested))requested=ANDROID_BUILD&&settings.renderScale==='device'?'browser':'pixel';if(mode===requested&&lost)return;lost=false;if(mode!==requested){gl?.getExtension('WEBGL_lose_context')?.loseContext();gl=null;timer=null;queries=[];textures=[];buffers=[];programs={};output.remove();output=document.createElement('canvas');output.id='screenOutput';output.setAttribute('aria-hidden','true');document.body.append(output);raw=document.createElement('canvas');rawCtx=raw.getContext('2d',{alpha:false,willReadFrequently:requested==='cpu'});}mode=requested;observeInterface();updateInterpolation();document.body.classList.remove('bitmap-screen');output.style.display='none';if(mode==='browser'){ready=false;cpu=null;cpuPixels=null;return;}try{dimensions();if(mode==='pixel'){initGPU();let debug=gl.getExtension('WEBGL_debug_renderer_info'),renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';if(automaticBackend()&&/swiftshader|llvmpipe|software/i.test(renderer))return configure('cpu');}else cpuContext=output.getContext('2d',{alpha:false});lastCapture=-Infinity;invalidate(true);}catch(e){if(automaticBackend()&&requested==='pixel')configure('cpu');else fail(e);}}
 function area(el){let r=el.getBoundingClientRect();return {x:r.left-3,y:r.top-3,width:r.width+6,height:r.height+6};}
 function canvasBounds(c){let r=interfaceRects.get(c);if(!r){r=c.getBoundingClientRect();interfaceRects.set(c,r);interfaceLayout.set(c,r);}return r;}
 function invalidate(force=false){dirty=true;if(force){fullInterface=true;cpuFirst=true;css='';effectsDirty=true;effectsRevision++;lastCapture=-Infinity;invalidateInterface();if(mode==='cpu'&&w){let key=[w,h,ww,hh,screenMapScale,settings.curve,settings.rgb,typeof screenBloomProfile==='undefined'?'':screenBloomProfile.wideCut].join(':');if(!cpu||key!==cpuKey){cpu=createCPUPhosphor(w,h,ww,hh);cpuKey=key;}else cpu.invalidate();if(cpu.inputImage)cpuPixels=cpu.inputImage;else if(!cpuPixels)cpuPixels=new ImageData(w,h);}else{cpu=null;cpuKey='';cpuPixels=null;}if(gl&&textures[6]){gl.bindTexture(gl.TEXTURE_2D,textures[6]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,screenWarpData);}}}
 const pendingScopes=new Map(),interfaceInvalidations=new Map(),pendingScrolls=new Set();
 function queueInterfaceInvalidation(scope,styles){interfaceInvalidations.set(scope,styles||interfaceInvalidations.get(scope)||false);}
 function flushInterfaceInvalidations(){
  // 同一面板里的文字常常一起变化。合并这些更新后，每个子树只需要清一次缓存。
  for(const [scope,styles]of interfaceInvalidations){let covered=false;for(let parent=scope.parentElement;parent;parent=parent.parentElement)if(interfaceInvalidations.has(parent)&&(interfaceInvalidations.get(parent)||!styles)){covered=true;break;}if(!covered)invalidateInterface(scope,styles);}
  interfaceInvalidations.clear();
 }
 function queueScope(el,structural=false,styles=true){if(ANDROID_BUILD){if(mode==='browser'||!el?.isConnected)return;el=el.closest('.mobile-tabs')||el;}if(mode==='browser'||!el?.isConnected||el.id==='speed'||el.closest('#speedTicks'))return;dirty=true;let flags=pendingScopes.get(el);if(flags){flags[0]||=structural;flags[1]||=styles;}else pendingScopes.set(el,[structural,styles]);}
 // 字形缓存可以失效，但还要记住上一次绘制的位置，才能擦掉原来的内容。
 function scopeChanged(el,structural=false,styles=true){if(ANDROID_BUILD&&el.matches('.mobile-tabs')){const r=el.getBoundingClientRect();interfaceAreas.push({x:r.left-24,y:r.top-24,width:r.width+48,height:r.height+48});invalidateInterface(el);return;}
  if(mode==='browser'){fullInterface=true;return;}let root=$('crtGlass'),scope=structural?el.parentElement:el,old,r;
  // 浮层独立定位，变化时不用让相邻元素重新布局。
  if(!structural&&el.parentElement===root&&['absolute','fixed'].includes(getComputedStyle(el).position)){old=interfaceLayout.get(el);r=el.getBoundingClientRect();for(const box of [old,r])if(box?.width&&box.height)interfaceAreas.push({x:box.left-3,y:box.top-3,width:box.width+6,height:box.height+6});queueInterfaceInvalidation(el,styles);return;}
  while(scope&&scope!==root){let style=interfaceStyles.get(scope)||getComputedStyle(scope);old=interfaceLayout.get(scope);r=scope.getBoundingClientRect();if(style.display!=='contents'&&old&&['left','top','width','height'].every(key=>Math.abs(old[key]-r[key])<.001))break;scope=scope.parentElement;}
  if(!scope||scope===root){fullInterface=true;interfaceInvalidations.clear();invalidateInterface();return;}
  interfaceAreas.push({x:old.left-3,y:old.top-3,width:old.width+6,height:old.height+6},{x:r.left-3,y:r.top-3,width:r.width+6,height:r.height+6});const styleScope=structural?el.parentElement:el;if(scope===styleScope)queueInterfaceInvalidation(scope,styles||structural);else{queueInterfaceInvalidation(scope,false);if(styles||structural)queueInterfaceInvalidation(styleScope,true);}
 }
 function flushScopes(){recordChanges(observer.takeRecords?.()||[]);if(fullInterface){if(pendingScopes.size)invalidateInterface();pendingScopes.clear();return false;}const clockOnly=pendingScopes.size>0&&[...pendingScopes.keys()].every(el=>el.closest('.clock-display,.speed-control,.speed-readout')?.parentElement?.id==='timeDock');let roots=new Set();for(let [el,flags]of pendingScopes){if(!el.isConnected)continue;let root=el;for(let parent=el.parentElement;parent;parent=parent.parentElement){let parentFlags=pendingScopes.get(parent);if(parentFlags){parentFlags[0]||=flags[0];parentFlags[1]||=flags[1];root=parent;}}roots.add(root);}for(let el of roots){scopeChanged(el,...pendingScopes.get(el));if(fullInterface)break;}flushInterfaceInvalidations();pendingScopes.clear();return clockOnly&&!fullInterface;}
 function flushScrolls(){
  for(const el of pendingScrolls){
   if(!el.isConnected)continue;
   let covered=false;for(let parent=el.parentElement;parent;parent=parent.parentElement)if(pendingScrolls.has(parent)){covered=true;break;}if(covered)continue;
   if(!fullInterface){const old=interfaceRects.get(el);if(old)interfaceAreas.push({x:old.left-3,y:old.top-3,width:old.width+6,height:old.height+6});interfaceAreas.push(area(el));}
   invalidateInterfacePositions(el);
  }
  pendingScrolls.clear();
 }
 function recordChanges(entries){if(mode==='browser')return;for(let e of entries){let el=e.target.nodeType===1?e.target:e.target.parentElement;if(!el||!el.isConnected||el.tagName==='CANVAS'||e.type==='attributes'&&(e.oldValue===el.getAttribute(e.attributeName)||e.attributeName.startsWith('aria-')&&!['aria-pressed','aria-selected'].includes(e.attributeName)||['title','tabindex','data-help'].includes(e.attributeName)))continue;
  if(e.type==='attributes'&&e.attributeName==='style'){const withoutOpacity=text=>(text||'').replace(/(?:^|;)\s*opacity\s*:[^;]*(?:;|$)/g,'').trim();if(withoutOpacity(e.oldValue)===withoutOpacity(el.getAttribute('style'))){const style=interfaceStyles.get(el);if(style)style.opacity=el.style.opacity||getComputedStyle(el).opacity;interfaceAreas.push(area(el));dirty=true;continue;}}
  let children=e.type==='childList'&&[...e.addedNodes,...e.removedNodes].some(n=>n.nodeType===1),structural=e.type==='attributes'&&e.attributeName==='hidden',styles=e.type==='characterData'?!e.oldValue?.length||!e.target.textContent.length:e.type!=='childList'||children||![...e.addedNodes].some(n=>n.textContent.length)||![...e.removedNodes].some(n=>n.textContent.length);queueScope(el,structural,styles);}}
 const observer=new MutationObserver(recordChanges);
 function observeInterface(){
  observer.disconnect();pendingScopes.clear();pendingScrolls.clear();
  if(mode!=='browser')observer.observe($('crtGlass'),{subtree:true,childList:true,characterData:true,characterDataOldValue:true,attributes:true,attributeOldValue:true});
 }
 const bodyClasses=value=>(value||'').split(/\s+/).filter(x=>x&&x!=='bitmap-screen').sort().join(' ');new MutationObserver(entries=>{if(entries.some(e=>bodyClasses(e.oldValue)!==bodyClasses(document.body.className)))invalidate(true);}).observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
 for(let event of ['input','change','select','keyup','scroll','pointerover','pointerout','focusin','focusout','toggle'])document.addEventListener(event,e=>{
  if(mode==='browser'||!e.target.closest?.('#crtGlass'))return;
  if(event==='pointerover'||event==='pointerout'){const control=e.target.closest('button');if(settings.curve||!control||control.contains(e.relatedTarget))return;queueScope(control);return;}
  if((event==='focusin'||event==='focusout')&&!e.target.matches('button,input,select,textarea,a,summary'))return;
  if(event==='scroll'){pendingScrolls.add(e.target);dirty=true;}else queueScope(e.target,event==='toggle');
 },true);
 window.addEventListener('resize',()=>{if(mode!=='browser')configure();});
 async function capture(now){
  busy=true;dirty=false;lastCapture=now;let generation=epoch,revision=effectsRevision,nextEffects=effects,begin=performance.now();
  try{
   if(!css)css=viewportCSS([...document.styleSheets].map(x=>flatten(x.cssRules)).join('\n'));
   if(document.fonts.status!=='loaded')await document.fonts.ready;if(generation!==epoch)return;
   if(effectsDirty){
    let clone=document.createElement('div');clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml');clone.className=document.body.className.replace('bitmap-screen','');clone.style.cssText=document.documentElement.style.cssText+';width:'+ww+'px;height:'+hh+'px;position:relative';let style=document.createElement('style');style.textContent=css.replace(/@font-face\s*\{[^}]*\}/g,'').replaceAll('body.','div.')+'\n#crtGlass{filter:none!important;opacity:1!important;background:transparent!important;border-radius:0!important}';clone.append(style);for(let id of ['grain','vignette'])clone.append($(id).cloneNode(true));
    let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+ww+' '+hh+'"><foreignObject width="'+ww+'" height="'+hh+'">'+new XMLSerializer().serializeToString(clone)+'</foreignObject></svg>',next=new Image();next.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await next.decode();if(generation!==epoch||revision!==effectsRevision)return;nextEffects=document.createElement('canvas');nextEffects.width=w;nextEffects.height=h;nextEffects.getContext('2d',{willReadFrequently:true}).drawImage(next,0,0,w,h);
   }
   if(generation!==epoch||revision!==effectsRevision)return;const scrolled=pendingScrolls.size>0;flushScrolls();const clockOnly=flushScopes()&&!scrolled;let regions=fullInterface?null:interfaceAreas;if(regions){let scale=w/ww;regions=mergeAreas(regions).map(r=>({x:r.x/scale,y:r.y/scale,width:r.width/scale,height:r.height/scale}));}fullInterface=false;interfaceAreas=[];
   paintInterface(clockCtx,w,h,null,'clock');
   const dock=$('timeDock'),slider=$('speed'),tick=$('speedTicks'),style=interfaceStyle(slider),visible=getComputedStyle(dock).display!=='none';clockGeometry=visible?{dock:dock.getBoundingClientRect(),slider:slider.getBoundingClientRect(),ticks:tick.getBoundingClientRect(),thumbWidth:parseFloat(style['--range-thumb-width'])||8,thumbHeight:parseFloat(style['--range-thumb-height'])||16}:null;if(clockGeometry){const r=clockGeometry.dock,scale=w/ww,x=Math.floor(r.left*scale),y=Math.floor(r.top*scale),width=Math.ceil(r.right*scale)-x,height=Math.ceil(r.bottom*scale)-y;if(clockImage.width!==width||clockImage.height!==height){clockImage.width=width;clockImage.height=height;}clockImageCtx.globalCompositeOperation='copy';clockImageCtx.drawImage(clockUI,x,y,width,height,0,0,width,height);clockGeometry.x=x;clockGeometry.y=y;}
   if(!clockOnly){
    stats.textRuns=paintInterface(uiCtx,w,h,regions,'base',false)+paintInterface(modalCtx,w,h,null,'modal');
    copyInterfaceBitmap(regions);
    const panel=$('modalRoot')?.querySelector('.modal');
    modalBounds=panel?panel.getBoundingClientRect():null;
    modalReady=!!panel;
    stats.readoutMS=performance.now()-begin;
   }
   effects=nextEffects;effectsDirty=false;sourceAreas.push(...(regions||[{x:0,y:0,width:ww,height:hh}]));stats.captures++;stats.snapshotMS=performance.now()-begin;ready=true;
  }catch(e){if(generation===epoch)fail(e);}finally{if(generation===epoch)busy=false;}
 }
 function copyInterfaceBitmap(regions){
  const scale=w/ww;
  uiImageCtx.save();
  if(ANDROID_BUILD){
   // WebView 有时会清掉更新区外的像素。先清指定区域，再把该处的新画面叠上去。
   uiImageCtx.globalCompositeOperation='source-over';
   if(regions){
    for(const r of regions){
     const x=Math.round(r.x*scale),y=Math.round(r.y*scale),width=Math.round(r.width*scale),height=Math.round(r.height*scale);
     uiImageCtx.clearRect(x,y,width,height);
     uiImageCtx.drawImage(ui,x,y,width,height,x,y,width,height);
    }
   }else{
    uiImageCtx.clearRect(0,0,w,h);
    uiImageCtx.drawImage(ui,0,0);
   }
  }else{
   if(regions){
    uiImageCtx.beginPath();
    for(const r of regions)uiImageCtx.rect(Math.round(r.x*scale),Math.round(r.y*scale),Math.round(r.width*scale),Math.round(r.height*scale));
    uiImageCtx.clip();
   }
   uiImageCtx.globalCompositeOperation='copy';
   if(mode==='pixel'&&regions&&regions.reduce((area,r)=>area+r.width*r.height,0)<ww*hh*.6){
    for(const r of regions){
     const x=Math.round(r.x*scale),y=Math.round(r.y*scale),width=Math.round(r.width*scale),height=Math.round(r.height*scale);
     uiImageCtx.putImageData(uiCtx.getImageData(x,y,width,height),x,y);
    }
   }else uiImageCtx.drawImage(ui,0,0);
  }
  uiImageCtx.restore();
 }
 function mergeAreas(areas){let cols=Math.ceil(w/32),rows=Math.ceil(h/32),mask=new Uint8Array(cols*rows),scale=w/ww;for(let a of areas){let x0=clamp(Math.floor(a.x*scale/32),0,cols-1),y0=clamp(Math.floor(a.y*scale/32),0,rows-1),x1=clamp(Math.floor((a.x+a.width)*scale/32),0,cols-1),y1=clamp(Math.floor((a.y+a.height)*scale/32),0,rows-1);for(let y=y0;y<=y1;y++)mask.fill(1,y*cols+x0,y*cols+x1+1);}let rectangles=[],previous=new Map();for(let y=0;y<rows;y++){let current=new Map();for(let x=0;x<cols;){if(!mask[y*cols+x]){x++;continue;}let start=x;while(x<cols&&mask[y*cols+x])x++;let key=start+':'+x,r=previous.get(key);if(r){r.height=Math.min(h-r.y,r.height+32);}else{r={x:start*32,y:y*32,width:Math.min(w-start*32,(x-start)*32),height:Math.min(32,h-y*32)};rectangles.push(r);}current.set(key,r);}previous=current;}return rectangles;}
 // Chrome 缩放画布时，裁剪区变化会挪动最近邻采样的位置。先缩放，再裁剪。
 function rasterCanvas(c){
  let r=canvasBounds(c),scale=w/ww,x=r.left*scale,y=r.top*scale,cw=r.width*scale,ch=r.height*scale,left=Math.floor(x),top=Math.floor(y),width=Math.max(1,Math.ceil(x+cw)-left),height=Math.max(1,Math.ceil(y+ch)-top),opacity=Number(interfaceStyles.get(c)?.opacity??getComputedStyle(c).opacity),serial=canvasPaintSerial.get(c)||0,key=[x,y,cw,ch,c.width,c.height,opacity].join(':'),entry=canvasRasters.get(c);
  if(!entry){let canvas=document.createElement('canvas');entry={canvas,ctx:canvas.getContext('2d',{alpha:true,willReadFrequently:mode==='cpu'}),key:'',serial:-1,left,top};canvasRasters.set(c,entry);}
  if(entry.key!==key){sourceAreas.push({x:entry.left/scale,y:entry.top/scale,width:entry.canvas.width/scale,height:entry.canvas.height/scale},{x:left/scale,y:top/scale,width:width/scale,height:height/scale});entry.canvas.width=width;entry.canvas.height=height;}
  entry.damage=null;
  if(entry.key!==key||entry.serial!==serial){
   let source=c;
   // 软件模式只放大有像素变化的区域，小画布上的动画就不用每帧重画整个放大图。
   if(mode==='cpu'&&!entry.diffBlocked)try{
    const ctx=c.getContext('2d'),image=ctx.getImageData(0,0,c.width,c.height),pixels=new Uint32Array(image.data.buffer,image.data.byteOffset,c.width*c.height);
    if(entry.key===key&&entry.pixels?.length===pixels.length){const sx=r.width/c.width,sy=r.height/c.height;entry.damage=canvasPixelAreas(entry.pixels,pixels,c.width,c.height).map(a=>({x:r.left+a.x*sx-1,y:r.top+a.y*sy-1,width:a.width*sx+2,height:a.height*sy+2}));}
    entry.pixels=pixels;
    if(!ctx.getContextAttributes?.().willReadFrequently){
     // 直接用刚读回的像素，省一次从 2D 纹理读取的操作。
     source=entry.cpuSource??=document.createElement('canvas');
     if(source.width!==c.width||source.height!==c.height){source.width=c.width;source.height=c.height;}
     source.getContext('2d',{willReadFrequently:true}).putImageData(image,0,0);
    }
   }catch{source=c;entry.diffBlocked=true;entry.pixels=entry.cpuSource=null;}
   entry.ctx.clearRect(0,0,width,height);entry.ctx.globalAlpha=opacity;entry.ctx.imageSmoothingEnabled=false;entry.ctx.drawImage(source,x-left,y-top,cw,ch);Object.assign(entry,{key,serial,left,top});
  }
  return entry;
 }
 function clockOpacity(){let opacity=timeAttentionOpacity;for(let el=$('timeDock');el&&el.id!=='crtGlass';el=el.parentElement){let style=interfaceStyles.get(el);if(!style){style=interfaceStyle(el);interfaceStyles.set(el,style);}opacity*=Number(el.style.opacity||style.opacity);}return opacity;}
 function clockDamage(){
  const slider=$('speed'),signature=[clockGeometry!==null,speedTickLayout?.key,slider.value,slider.dataset.actualFill,clockOpacity()].join(':');if(signature===clockSignature)return;clockSignature=signature;if(clockGeometry){const r=clockGeometry.dock;sourceAreas.push({x:r.left-3,y:r.top-3,width:r.width+6,height:r.height+6});}
 }
 function paintClock(target){
  if(!clockGeometry||clockOpacity()===0)return;const scale=w/ww,g=clockGeometry,slider=$('speed'),fraction=clamp(Number(slider.dataset.actualFill??Number(slider.value)/10)/100,0,1),value=(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min)),colors=interfacePalette(),opacity=clockOpacity();
  target.save();target.globalAlpha=opacity;target.drawImage(clockImage,g.x,g.y);target.restore();const signature=[clockSignature,opacity,slider.value,slider.dataset.actualFill,speedTickLayout?.key,w,g.y,g.slider.left,g.slider.top,g.slider.width,g.slider.height,g.ticks.left,g.ticks.top,g.ticks.height,g.thumbWidth,g.thumbHeight,colors.ink,colors.faint,colors.bright].join(':');if(signature===clockMotionSignature){target.drawImage(clockMotion,0,g.y);return;}clockMotionSignature=signature;if(clockMotion.width!==w||clockMotion.height!==clockImage.height){clockMotion.width=w;clockMotion.height=clockImage.height;}const ctx=clockMotionCtx;ctx.clearRect(0,0,clockMotion.width,clockMotion.height);ctx.save();ctx.translate(0,-g.y);ctx.scale(scale,scale);ctx.globalAlpha=opacity;
  if(speedTickLayout)for(const lit of [false,true]){ctx.fillStyle=lit?colors.ink:colors.faint;for(const tick of speedTickLayout.ticks){const x=g.ticks.left+Math.floor(tick.x*64)/64-2,height=tick.kind==='minor'?4:12,y=g.ticks.top+g.ticks.height/2-height/2;ctx.fillRect(x,y,lit?clamp(g.slider.left+g.slider.width*fraction-x,0,4):4,height);}}
  ctx.fillStyle=colors.bright;ctx.fillRect(g.slider.left+value*(g.slider.width-g.thumbWidth),g.slider.top+g.slider.height/2-g.thumbHeight/2,g.thumbWidth,g.thumbHeight);ctx.restore();target.drawImage(clockMotion,0,g.y);
 }
 function paintBackdrop(){
  if(!settings.crt||!screenBackdrop)return;const layers=screenBackdrop,key=[layers.key,w,h].join(':');
  if(key!==backdropKey){backdropKey=key;if(backdrop.width!==w||backdrop.height!==h){backdrop.width=w;backdrop.height=h;}backdropCtx.clearRect(0,0,w,h);backdropCtx.drawImage(layers.scan,0,0,w,h);}
  rawCtx.drawImage(backdrop,0,0);
 }
 function compose(usePresentation=true,forceFull=false,includeEffects=true){
  if(usePresentation&&presentation){
   const serial=canvasPaintSerial.get(presentation)||0;if(!cpuFirst&&!forceFull&&serial===presentationSerial&&effectsRevision===presentationEffects)return [];
   presentationSerial=serial;presentationEffects=effectsRevision;rawCtx.save();rawCtx.setTransform(1,0,0,1,0,0);rawCtx.drawImage(presentation,0,0,w,h);paintBackdrop();if(effects)rawCtx.drawImage(effects,0,0,w,h);rawCtx.restore();return [{x:0,y:0,width:w,height:h}];
  }
  if(presentation)presentationSerial=-1;
  clockDamage();let canvases=[...$('crtGlass').querySelectorAll('canvas')].filter(c=>c!==presentation&&c.width&&c.height&&(!ANDROID_BUILD||mobileElementVisible(c))&&canvasBounds(c).width),rasters=canvases.map(rasterCanvas),regions=null,scale=w/ww;
  if(modalPresentation.changed){sourceAreas.push({x:0,y:0,width:ww,height:hh});modalPresentation.changed=false;}
  for(let i=0;i<canvases.length;i++){let c=canvases[i],serial=canvasPaintSerial.get(c)||0;if(canvasSerials.get(c)!==serial){let damage=rasters[i].damage,bounds=canvasPaintAreas.get(c),r=canvasBounds(c);if(damage)sourceAreas.push(...damage);else if(bounds){for(let a of bounds)sourceAreas.push({x:r.left+a.x,y:r.top+a.y,width:a.width,height:a.height});}else sourceAreas.push({x:r.left-3,y:r.top-3,width:r.width+6,height:r.height+6});canvasPaintAreas.delete(c);canvasSerials.set(c,serial);}}regions=cpuFirst||forceFull?[{x:0,y:0,width:w,height:h}]:mergeAreas(sourceAreas);sourceAreas=[];if(!regions.length)return regions;
  // 移动端上传整张纹理，界面缓存仍按有变化的区域绘制。
  if(ANDROID_BUILD&&mode==='pixel')regions=[{x:0,y:0,width:w,height:h}];
  rawCtx.save();rawCtx.beginPath();for(let r of regions)rawCtx.rect(r.x,r.y,r.width,r.height);rawCtx.clip();
  rawCtx.fillStyle='#000';rawCtx.fillRect(0,0,w,h);
  for(let i=0;i<canvases.length;i++){let c=canvases[i],r=rasters[i];rawCtx.save();for(let parent=c.parentElement;parent&&parent.id!=='crtGlass';parent=parent.parentElement){let style=interfaceStyles.get(parent);if(!style){style=interfaceStyle(parent);interfaceStyles.set(parent,style);}if([style.overflowX,style.overflowY].some(v=>['auto','scroll','hidden','clip'].includes(v))){let bounds=interfaceRects.get(parent)||parent.getBoundingClientRect();rawCtx.beginPath();rawCtx.rect(bounds.left*scale,bounds.top*scale,parent.clientWidth*scale,parent.clientHeight*scale);rawCtx.clip();}}rawCtx.imageSmoothingEnabled=false;rawCtx.drawImage(r.canvas,r.left,r.top);rawCtx.restore();}
  rawCtx.drawImage(uiImage,0,0);paintClock(rawCtx);
  if(modalPresentation.shade>0){rawCtx.fillStyle='rgba(0,0,0,'+(.83*modalPresentation.shade)+')';rawCtx.fillRect(0,0,w,h);}
  if(modalBounds&&modalPresentation.reveal>0){let edge=modalPresentation.reveal>=1?h:(modalBounds.top+modalBounds.height*modalPresentation.reveal)*scale;rawCtx.save();rawCtx.beginPath();rawCtx.rect(0,0,w,Math.ceil(edge));rawCtx.clip();rawCtx.drawImage(modalUI,0,0);rawCtx.restore();if(modalPresentation.reveal<1){rawCtx.fillStyle='rgba('+visualRGB+',.28)';rawCtx.fillRect(modalBounds.left*scale,edge-2*scale,modalBounds.width*scale,2*scale);}}
  if(includeEffects){paintBackdrop();if(effects)rawCtx.drawImage(effects,0,0,w,h);}
  rawCtx.restore();return regions;
 }
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.0)*.5;gl_Position=vec4(p,0.,1.);}';
 function program(source){let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision highp float;varying vec2 uv;'+source));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 function texture(tw=w,th=h,type=gl.UNSIGNED_BYTE){let t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tw,th,0,gl.RGBA,type,null);return t;}
 function initGPU(){
  if(!gl){gl=output.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');if(contextCanvas!==output){contextCanvas=output;output.addEventListener('webglcontextlost',e=>{e.preventDefault();if(e.target!==output||mode!=='pixel')return;lost=true;ready=false;epoch++;busy=false;document.body.classList.remove('bitmap-screen');output.style.display='none';});output.addEventListener('webglcontextrestored',e=>{if(e.target!==output||mode!=='pixel')return;lost=false;gl=null;timer=null;queries=[];textures=[];buffers=[];programs={};shaderViewport='';configure();});}const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   programs.warp=program('uniform sampler2D src;uniform sampler2D warpMap;uniform vec2 extent;uniform vec2 edgeExtent;uniform float bendScale;void main(){vec2 q=texture2D(warpMap,vec2(uv.x,1.-uv.y)).rg-.5;vec2 at=uv+vec2(q.x,-q.y)*bendScale/extent;float coverage=bendScale>0.?clamp(min(min(at.x*edgeExtent.x,(1.-at.x)*edgeExtent.x),min(at.y*edgeExtent.y,(1.-at.y)*edgeExtent.y)),0.,1.):1.;gl_FragColor=vec4(texture2D(src,vec2(at.x,1.-at.y)).rgb*coverage,coverage);}');
   // 窄卷积核最外侧的一对采样，在 8 位颜色里连一级亮度也加不到。
   const blurSource='uniform sampler2D src;uniform vec2 stepUV;uniform float centerWeight;uniform vec4 weights;uniform vec4 offsets;void main(){vec4 c=texture2D(src,uv)*centerWeight;c+=(texture2D(src,uv+stepUV*offsets.x)+texture2D(src,uv-stepUV*offsets.x))*weights.x;c+=(texture2D(src,uv+stepUV*offsets.y)+texture2D(src,uv-stepUV*offsets.y))*weights.y;c+=(texture2D(src,uv+stepUV*offsets.z)+texture2D(src,uv-stepUV*offsets.z))*weights.z;c+=(texture2D(src,uv+stepUV*offsets.w)+texture2D(src,uv-stepUV*offsets.w))*weights.w;gl_FragColor=c;}';programs.blur=program(blurSource);programs.reduce=program('uniform sampler2D src;uniform vec2 sourceSize;void main(){vec2 d=1./sourceSize;gl_FragColor=(texture2D(src,uv+vec2(-1.,-1.)*d)+texture2D(src,uv+vec2(1.,-1.)*d)+texture2D(src,uv+vec2(-1.,1.)*d)+texture2D(src,uv+vec2(1.,1.)*d))*.25;}');programs.blurTight=program(blurSource.replace('c+=(texture2D(src,uv+stepUV*offsets.z)+texture2D(src,uv-stepUV*offsets.z))*weights.z;c+=(texture2D(src,uv+stepUV*offsets.w)+texture2D(src,uv-stepUV*offsets.w))*weights.w;',''));
   programs.finish=program('uniform sampler2D src;uniform sampler2D tight;uniform sampler2D wide;uniform sampler2D warpMap;uniform vec2 extent;uniform float bloom;uniform float split;uniform vec4 emission;vec3 lit(vec2 q,float coverage){vec3 c=texture2D(src,q).rgb;vec3 a=max(vec3(0.),texture2D(tight,q).rgb*emission.x-emission.y*coverage)*bloom;return 1.-(1.-c)*(1.-a);}void main(){vec2 q=texture2D(warpMap,vec2(uv.x,1.-uv.y)).rg-.5;vec2 fringe=vec2(1.05-1.6*q.x,1.6*q.y)/extent;float coverage=texture2D(src,uv).a;vec3 center=lit(uv,coverage),r=lit(uv+fringe*split,coverage),b=lit(uv-fringe*split,coverage);vec3 halo=max(vec3(0.),texture2D(wide,uv).rgb*emission.z-emission.w*coverage)*bloom;vec3 color=1.-(1.-vec3(r.r,center.g,b.b))*(1.-halo);float d=dot(mod(floor(gl_FragCoord.xy),2.),vec2(.5,.25))-.375;gl_FragColor=vec4(color+d/255.,1.);}');
   timer=gl.getExtension('EXT_disjoint_timer_query');
  }
  for(let t of textures)gl.deleteTexture(t);for(let f of buffers)gl.deleteFramebuffer(f);textures=[];buffers=[];
  const half=gl.getExtension('OES_texture_half_float'),wideType=half&&gl.getExtension('OES_texture_half_float_linear')&&gl.getExtension('EXT_color_buffer_half_float')?half.HALF_FLOAT_OES:gl.UNSIGNED_BYTE;for(let i=0;i<6;i++){textures.push(i===4||i===5?texture(Math.ceil(w/4),Math.ceil(h/4),wideType):texture());if(i){let f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textures[i],0);buffers[i]=f;}}
  textures.push(texture(64,64));gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,screenWarpData);textures.push(texture(Math.ceil(w/4),Math.ceil(h/4),wideType));buffers[7]=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,buffers[7]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textures[7],0);stats.wideFloat=wideType!==gl.UNSIGNED_BYTE;
 }
 const programLocations=new WeakMap();let shaderViewport='';
 function draw(p,target,sources,uniforms,regions=null){let cached=programLocations.get(p);if(!cached){cached={attribute:gl.getAttribLocation(p,'p'),uniforms:new Map(),values:new Map()};programLocations.set(p,cached);gl.enableVertexAttribArray(cached.attribute);gl.vertexAttribPointer(cached.attribute,2,gl.FLOAT,false,0,0);}const location=name=>{if(!cached.uniforms.has(name))cached.uniforms.set(name,gl.getUniformLocation(p,name));return cached.uniforms.get(name);};gl.bindFramebuffer(gl.FRAMEBUFFER,target?buffers[target]:null);const tw=(target===4||target===5||target===7)?Math.ceil(w/4):w,th=(target===4||target===5||target===7)?Math.ceil(h/4):h;if(shaderViewport!==tw+':'+th){gl.viewport(0,0,tw,th);shaderViewport=tw+':'+th;}gl.useProgram(p);sources.forEach(([name,n],i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[n]);if(cached.values.get(name)!==i){gl.uniform1i(location(name),i);cached.values.set(name,i);}});for(let [key,value]of Object.entries(uniforms)){const previous=cached.values.get(key);if(Array.isArray(value)?Array.isArray(previous)&&value.length===previous.length&&value.every((n,i)=>n===previous[i]):previous===value)continue;cached.values.set(key,Array.isArray(value)?value.slice():value);let at=location(key);if(Array.isArray(value))value.length===2?gl.uniform2fv(at,value):value.length===4?gl.uniform4fv(at,value):gl.uniform3fv(at,value);else gl.uniform1f(at,value);}if(regions){gl.enable(gl.SCISSOR_TEST);for(let r of regions){const x=Math.floor(r.x*tw/w),y=Math.floor(r.y*th/h),right=Math.ceil((r.x+r.width)*tw/w),bottom=Math.ceil((r.y+r.height)*th/h);gl.scissor(x,th-bottom,right-x,bottom-y);gl.drawArrays(gl.TRIANGLES,0,6);}}else{gl.disable(gl.SCISSOR_TEST);gl.drawArrays(gl.TRIANGLES,0,6);}}
 const gaussianCache=new Map();function gaussian(radius){if(gaussianCache.has(radius))return gaussianCache.get(radius);let a=Array.from({length:9},(_,i)=>Math.exp(-.5*i*i/(radius*radius))),sum=a[0]+2*a.slice(1).reduce((s,x)=>s+x,0),weights=[],offsets=[];for(let i=1;i<9;i+=2){let pair=a[i]+a[i+1];weights.push(pair/sum);offsets.push(i+a[i+1]/pair);}let result={centerWeight:a[0]/sum,weights,offsets};gaussianCache.set(radius,result);return result;}
 const uploadCanvases=new Map();
 // 帧缓冲保留上次画面。局部更新前，按曲屏变形和模糊的采样范围扩展边界。
 function gpuAreas(regions,padX=0,padY=padX){
  if(!regions)return null;let list=mergeAreas(regions.map(r=>({x:(r.x-padX)*ww/w,y:(r.y-padY)*ww/w,width:(r.width+2*padX)*ww/w,height:(r.height+2*padY)*ww/w})));
  if(list.length>16){const bands=Array(16),height=Math.ceil(h/16/32)*32;for(let r of list){for(let i=Math.floor(r.y/height);i<=Math.min(15,Math.floor((r.y+r.height-1)/height));i++){let top=Math.max(r.y,i*height),bottom=Math.min(r.y+r.height,(i+1)*height),old=bands[i];if(!old)bands[i]={x:r.x,y:top,width:r.width,height:bottom-top};else{let x=Math.min(old.x,r.x),y=Math.min(old.y,top);Object.assign(old,{x,y,width:Math.max(old.x+old.width,r.x+r.width)-x,height:Math.max(old.y+old.height,bottom)-y});}}}list=bands.filter(Boolean);}
  return list.reduce((n,r)=>n+r.width*r.height,0)>=w*h*.85?null:list;
 }
 function gpuPaint(regions=null){
  if(regions&&!regions.length)return;
  let begin=performance.now(),uploads=gpuAreas(regions);if(uploads&&uploads.reduce((n,r)=>n+r.width*r.height,0)>=w*h*.35)uploads=null;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[0]);let pixels=uploads?.reduce((n,r)=>n+r.width*r.height,0)??w*h;
  if(uploads){for(let r of uploads){let key=r.width+':'+r.height,c=uploadCanvases.get(key);if(!c){c=document.createElement('canvas');c.width=r.width;c.height=r.height;if(uploadCanvases.size>=8){let first=uploadCanvases.keys().next().value,old=uploadCanvases.get(first);old.width=old.height=0;uploadCanvases.delete(first);}uploadCanvases.set(key,c);}c.getContext('2d',{alpha:false}).drawImage(raw,r.x,r.y,r.width,r.height,0,0,r.width,r.height);gl.texSubImage2D(gl.TEXTURE_2D,0,r.x,r.y,gl.RGBA,gl.UNSIGNED_BYTE,c);}}
  else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,raw);
  stats.uploadPixels=pixels;cpuFirst=false;stats.uploadMS=performance.now()-begin;
  let query;if(timer&&stats.gpuMS.length+queries.length<8){query=timer.createQueryEXT();timer.beginQueryEXT(timer.TIME_ELAPSED_EXT,query);}
  const density=w/ww,warp=gpuAreas(regions,Math.ceil((settings.curve?screenMapScale*.5*density:0)+2)),horizontal=gpuAreas(warp,9,0),blurred=gpuAreas(horizontal,0,9);
  draw(programs.warp,1,[['src',0],['warpMap',6]],{extent:[ww,hh],bendScale:settings.curve?screenMapScale:0,edgeExtent:[w,h]},warp);
  if(settings.bloom){let tight=gaussian(Math.max(.3,.65*density)),wide=gaussian(screenBloomProfile.radius*density/4),tightProgram=.65*density<=1.4?programs.blurTight:programs.blur;draw(tightProgram,2,[['src',1]],{stepUV:[1/w,0],...tight},horizontal);draw(tightProgram,3,[['src',2]],{stepUV:[0,1/h],...tight},blurred);const reduced=gpuAreas(warp,2,2),wideH=gpuAreas(reduced,36,0),wideV=gpuAreas(wideH,0,36);draw(programs.reduce,7,[['src',1]],{sourceSize:[w,h]},reduced);draw(programs.blur,4,[['src',7]],{stepUV:[1/Math.ceil(w/4),0],...wide},wideH);draw(programs.blur,5,[['src',4]],{stepUV:[0,1/Math.ceil(h/4)],...wide},wideV);}
  // 浏览器呈现画面后可能丢弃默认帧缓冲。
  draw(programs.finish,0,[['src',1],['tight',3],['wide',5],['warpMap',6]],{extent:[ww,hh],bloom:Number(settings.bloom),split:Number(settings.rgb)/1.05,emission:[screenBloomProfile.tightGain,screenBloomProfile.tightCut,screenBloomProfile.wideGain,screenBloomProfile.wideCut]});
  if(query){timer.endQueryEXT(timer.TIME_ELAPSED_EXT);queries.push(query);}if(timer&&queries.length&&!gl.getParameter(timer.GPU_DISJOINT_EXT))for(let i=queries.length-1;i>=0;i--)if(timer.getQueryObjectEXT(queries[i],timer.QUERY_RESULT_AVAILABLE_EXT)){stats.gpuMS.push(timer.getQueryObjectEXT(queries[i],timer.QUERY_RESULT_EXT)/1e6);timer.deleteQueryEXT(queries[i]);queries.splice(i,1);}
 }
 function cpuPaint(regions){if(!regions.length)return;let readStart=performance.now();for(let r of regions){let pixels=rawCtx.getImageData(r.x,r.y,r.width,r.height);for(let y=0;y<r.height;y++)cpuPixels.data.set(pixels.data.subarray(y*r.width*4,(y+1)*r.width*4),((r.y+y)*w+r.x)*4);}stats.readbackMS=performance.now()-readStart;let processed=cpu.paint(cpuPixels,settings,cpuFirst?null:regions);cpuFirst=false;let submit=performance.now();if(processed.changed){for(let r of processed.regions||[{x:0,y:0,width:w,height:h}])cpuContext.putImageData(processed.image,0,0,r.x,r.y,r.width,r.height);}stats.submitMS=performance.now()-submit;stats.submitPixels=processed.regions?.reduce((n,r)=>n+r.width*r.height,0)??(processed.changed?w*h:0);stats.changedPixels=processed.changed;stats.changedTiles=processed.tiles;stats.diffMS=processed.diffMS;stats.warpMS=processed.warpMS;stats.bloomMS=processed.bloomMS;stats.pixelMS=processed.pixelMS;stats.cpuBackend=cpu.backend;stats.readPixels=regions.reduce((n,r)=>n+r.width*r.height,0);}
 function frameRate(now){if(mode==='browser'||!ready)return null;while(presentTimes.length>2&&presentTimes[0]<now-1200)presentTimes.shift();let elapsed=presentTimes.at(-1)-presentTimes[0];return elapsed>0?(presentTimes.length-1)*1000/elapsed:0;}
 function tick(now){if(mode==='browser'||lost||document.hidden)return;
  // 滚动需要更频繁地重画，但两次绘制之间要留出时间处理输入。
  const captureInterval=pendingScrolls.size?Math.min(32,Math.max(1000/UI_CONFIG.maxFPS,2*(stats.snapshotMS+stats.paintMS))):32;
  if(dirty&&!busy&&now-lastCapture+.1>=captureInterval)capture(now);
  if(!ready||mode==='cpu'&&UI_CONFIG.cpuRenderFPS<UI_CONFIG.maxFPS&&now-lastPaint+.1<1000/UI_CONFIG.cpuRenderFPS)return;let begin=performance.now();try{let regions=compose();if(!regions.length)return;mode==='pixel'?gpuPaint(regions):cpuPaint(regions);document.body.classList.add('bitmap-screen');output.style.display='block';stats.paintMS=performance.now()-begin;lastPaint=now;stats.presents++;presentTimes.push(now);if(presentTimes.length>250)presentTimes.shift();}catch(e){fail(e);}}
 function copyDisplay(){const copy=document.createElement('canvas');copy.width=w;copy.height=h;const ctx=copy.getContext('2d');ctx.drawImage(output,0,0);paintDisplayHalo(ctx,w,h);return copy;}
 function backdropSnapshot(){if(!ready||mode==='browser')return null;rawCtx.fillStyle='#000';rawCtx.fillRect(0,0,w,h);paintBackdrop();if(effects)rawCtx.drawImage(effects,0,0,w,h);cpuFirst=true;mode==='pixel'?gpuPaint():cpuPaint([{x:0,y:0,width:w,height:h}]);cpuFirst=true;return copyDisplay();}
 return {presentation(source){presentation=source;presentationSerial=-1;cpuFirst=true;if(!source)invalidate(true);},backdropSnapshot,sourceSnapshot(){if(!ready||mode==='browser')return null;compose(false,true,false);let copy=document.createElement('canvas');copy.width=w;copy.height=h;copy.getContext('2d').drawImage(raw,0,0);return copy;},snapshot(){if(!ready||mode==='browser')return null;let regions=compose();mode==='pixel'?gpuPaint():cpuPaint(regions);return copyDisplay();},configure,invalidate,redrawEffects(){cpuFirst=true;cpu?.invalidate();},updateInterpolation,controlChanged:queueScope,tick,frameRate,get mode(){return mode;},
  get modalReady(){return modalReady;},
  get pending(){return mode!=='browser'&&(busy||dirty);},
  get presents(){return stats.presents;},
  get readoutMS(){return stats.readoutMS;},
  get width(){return w;},
  get status(){return {...stats,mode,ready,modalReady,pending:this.pending,width:w,height:h};}};
}

const startupCurtain=$('loadingCurtain');
let nextFrameAt=0,startupPending=true;
function frame(now){
 if(!startupPending)music.tick();
 if(now+.1<nextFrameAt){requestAnimationFrame(frame);return;}const period=1000/Math.max(1,UI_CONFIG.maxFPS);nextFrameAt=Math.max(nextFrameAt+period,now-period+1);
 if(startupPending){
  lastSimulationTime=lastFrame=now;pendingPhysicsReal=pendingPhysicsDays=0;
  if(game.state.stage===4&&!game.state.ending){const background=createEndingBackground();if(!background.ready){prepareEndingBackground(background);requestAnimationFrame(frame);return;}}
  screenRenderer.tick(now);
  if(!document.hidden&&(screenRenderer.mode==='browser'||screenRenderer.presents>0&&!screenRenderer.pending)){
   startupPending=false;
   startupCurtain.animate([{opacity:1},{opacity:0}],{duration:700,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>startupCurtain.remove());
  }
  requestAnimationFrame(frame);return;
 }
 if(pendingDeparture&&!(ANDROID_BUILD&&pendingDeparture.kind==='human'&&mobileCleanupPending())&&!game.state.paused&&!modalType&&!modalMotion&&!document.hidden&&now>=pendingDeparture.readyAt&&!screenRenderer?.pending){if(pendingDeparture.kind!=='human')departureFinalImage=departureInterfaceSnapshot();const remaining=pendingDeparture.days;pendingDeparture=null;game.advance(remaining);render();}
 let real=Math.max(0,(now-lastFrame)/1000);lastFrame=now;accrueSimulationTime(now);if(screenTransition){if(screenRenderer?.pending)screenRenderer.tick(now);tickScreenTransition(now);pendingPhysicsReal=0;pendingPhysicsDays=0;requestAnimationFrame(frame);return;}tickModalMotion(now);let blocked=document.hidden||modalType!==null||modalMotion!==null,s=game.state;
 if(!blocked&&!s.paused&&!s.ending){
  if(pendingPhysicsReal+.0001>=1/UI_CONFIG.maxPhysicsFPS){
   consumeSimulationTime();
  }
  visualTime+=settings.motion?real:0;rotationTime+=settings.motion?real*rotationScale(game.effectiveSpeed()):0;
 }else{pendingPhysicsReal=0;pendingPhysicsDays=0;battleLastTime=now;}
 tickHold(now,blocked);
 if(!blocked){smoothView(real);if(s.stage===3)smoothStellarCamera(now);}if(ANDROID_BUILD)mobileAdvanceVisuals(blocked);tickCleanupUI();tickEndingUI(now,real,blocked);tickProjectFolds(now);tickTaskArrows(now);tickContentFlickers(now);tickColorPulses();tickPressFeedback(now);tickJournalScroll(now);
 if(!document.hidden&&!s.ending){renderClock();lastClock=now;updateProduction(real,now);}updateFPS(now);
 if(now-lastBackground>250&&!document.hidden&&!blocked&&!s.paused&&settings.motion){backgroundTime+=.25;drawBackground();lastBackground=now;}
 const readoutInterval=s.stage>=3?Math.max(1000/UI_CONFIG.textFPS,Math.min(100,(screenRenderer?.readoutMS||0)*3)):1000/UI_CONFIG.textFPS;
 if(now-lastRender+.1>=readoutInterval&&!document.hidden&&(!s.paused&&!blocked||lastStage!==s.stage||s.revision!==lastRevision)){render();lastRender=now;}
 let interval=1000/(settings.quality==='low'?UI_CONFIG.lowVisualFPS:screenRenderer?.mode==='cpu'?UI_CONFIG.cpuRenderFPS:UI_CONFIG.maxFPS);
 if((interval<=1000/UI_CONFIG.maxFPS||now-lastViz+.1>=interval)&&!document.hidden&&!s.ending){if(!s.paused&&!blocked||lastStage!==s.stage||viewDirty&&!blocked){drawViz();viewDirty=false;}lastViz=now;}
 if(!document.hidden&&!s.ending&&!blocked&&(!s.paused||ANDROID_BUILD&&mobile.battlePaint))drawBattle();
 if(saveNotice&&now>saveNotice.until){saveNotice=null;lastJournal=-1;renderJournal();}
 if(now-lastSave>10000&&!document.hidden){if(dirtySave)save();lastSave=now;}
 if(toastUntil&&now>toastUntil){$('toast').classList.add('hidden');toastUntil=0;}
 screenRenderer?.tick(now);requestAnimationFrame(frame);
}

async function startInterface(){
 // 音频设备首次启动有时会等驱动，趁加载幕还在时先初始化。
 music.prepare();
 await document.fonts.load('16px "Paperclip Terminal"');await document.fonts.ready;
 updateDocumentLanguage();translateRegion(document.body);translateRegion($('crtGlass'));applySettings();render();screenRenderer=createScreenRenderer();screenRenderer.configure();requestAnimationFrame(frame);
 drawViz();drawBackground();
}
