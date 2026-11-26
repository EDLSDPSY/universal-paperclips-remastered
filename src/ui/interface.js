
'use strict';
window.addEventListener('pointerdown',()=>music.unlock(),{capture:true});
window.addEventListener('keydown',()=>music.unlock(),{capture:true});
const $=id=>document.getElementById(id);
const clamp=PaperclipModel.clamp;
function preferredLanguage(){
 for(const language of navigator.languages?.length?navigator.languages:[navigator.language]){
  const code=language?.toLowerCase().split('-')[0];
  if(code==='zh'||code==='yue'||code==='cmn')return 'zh';
  if(code==='en')return 'en';
 }
 return 'en';
}
let game=PaperclipModel.create(),settings={theme:'amber',crt:10,rgb:1,vignette:true,curve:true,bloom:1,noise:0,ambient:!ANDROID_BUILD,motion:true,quality:'standard',renderer:'auto',renderScale:'device',interpolation:'nearest',numberUnits:'latin',massUnits:'scientific',scientificAt:15,autoSave:true,lang:preferredLanguage(),musicVolume:.5},lastRevision=-1,lastStage=0,lastJournal=-1,lastProjects='',toastUntil=0,modalType=null,oldFocus=null,dirtySave=false,saveFailed=false;
const displayDefaults=Object.fromEntries(['theme','crt','rgb','vignette','curve','bloom','noise','ambient','motion','quality','renderScale','interpolation'].map(key=>[key,settings[key]]));
/*__文案__*/
const EN_KEYS=Object.keys(EN).sort((a,b)=>b.length-a.length),originalTexts=new WeakMap(),originalAttributes=new WeakMap(),translationCache=new Map();
function formatEnglishText(text){
 for(const [pattern,translation,order] of EN_FORMATS){
  const match=pattern.exec(text);
  if(match)return translation.replace(/%[1-9]\d*/g,key=>localText(match[order.indexOf(key)+1]));
 }
 return null;
}
function localText(text){if(settings.lang!=='en')return text;if(!/[\u3400-\u9fff]/.test(text)&&!Object.hasOwn(EN,text.trim()))return text;if(translationCache.has(text))return translationCache.get(text);const formatted=formatEnglishText(text);if(formatted!==null)return formatted;let trimmed=text.trim(),result=Object.hasOwn(EN,trimmed)?text.replace(trimmed,()=>EN[trimmed]):text;if(!Object.hasOwn(EN,trimmed))for(let key of EN_KEYS)if(result.includes(key))result=result.replaceAll(key,(match,at)=>((/[\u3400-\u9fff]/.test(result[at-1]||''))?' ':'')+EN[key]+((/[\u3400-\u9fff]/.test(result[at+key.length]||''))?' ':''));result=result.replace(/(\d)(clips|days|years|hours|ly|fps)/g,'$1 $2');result=result.replace(/；/g,'; ').replace(/\s+:/g,':').replace(/\b1 (years|days|hours|clips)\b/g,(_,unit)=>'1 '+unit.slice(0,-1));translationCache.set(text,result);if(translationCache.size>1024)translationCache.delete(translationCache.keys().next().value);return result;}
function translateRegion(root,remember=true){let walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),node;while(node=walk.nextNode()){if(node.parentElement?.closest('script,style,textarea'))continue;let original=originalTexts.get(node)||node.nodeValue;if(remember&&!originalTexts.has(node))originalTexts.set(node,original);node.nodeValue=localText(original);}for(let el of root.querySelectorAll('[aria-label],[title],[placeholder]')){let original=originalAttributes.get(el)||{};for(let key of ['aria-label','title','placeholder'])if(el.hasAttribute(key)){if(!original[key])original[key]=el.getAttribute(key);el.setAttribute(key,localText(original[key]));}if(remember)originalAttributes.set(el,original);}}
function localizedHTML(html){html=String(html);if(!/[<&]/.test(html))return localText(html);if(settings.lang!=='en'||!/[\u3400-\u9fff]/.test(html))return html;let t=document.createElement('template');t.innerHTML=html;translateRegion(t.content,false);return t.innerHTML;}
function updateDocumentLanguage(){
 document.documentElement.lang=settings.lang==='en'?'en':'zh-CN';
 document.title=GAME_NAME[settings.lang];
}
function setLanguage(lang){settings.lang=lang==='en'?'en':'zh';updateDocumentLanguage();lastStage=0;lastProjects='';lastJournal=-1;$('ending').dataset.ending='';translateRegion(document.body);markupCache=new WeakMap();productionDisplayAt=0;applySettings();render();if(modalType)renderModal();}

let speedTickKey='',speedTrackWidth=0,saveNotice=null,speedTickLayout=null,speedTickDOMAt=-Infinity,timeAttentionOpacity=1;
function speedTickValues(min,max,standard,unit){let low=Math.log10(min/unit),high=Math.log10(max/unit),stride=Math.max(1,Math.ceil((high-low)/6)),values=[standard];for(let exponent=Math.ceil(low/stride)*stride;exponent<=high+1e-10;exponent+=stride)values.push(unit*10**exponent);return [...new Set(values.filter(x=>x>=min*(1-1e-10)&&x<=max*(1+1e-10)))].sort((a,b)=>a-b).map(value=>({value,position:clamp(Math.log(value/min)/Math.log(max/min),0,1),standard:Math.abs(Math.log(value/standard))<1e-8}));}
function renderSpeedTicks(min,max){
 const stage=game.state.stage,standard=stage<3?1:1000*game.C.year,unit=stage<3?1:game.C.year,el=$('speedTicks'),width=speedTrackWidth||$('speed').clientWidth,key=[min,max,standard,width].join(':'),fill=$('speed').dataset.actualFill!==undefined?Number($('speed').dataset.actualFill):Number($('speed').value)/10;
 if(key!==speedTickKey){speedTickKey=key;const usable=Math.max(8,width-8),count=Math.max(2,Math.round(usable/8));speedTickLayout={key,width,ticks:[...Array.from({length:count+1},(_,i)=>({x:4+i*usable/count,kind:'minor'})),...speedTickValues(min,max,standard,unit).map(t=>({x:4+t.position*usable,kind:t.standard?'standard':'major'}))]};}
 const now=performance.now();if(screenRenderer?.mode!=='browser'&&now-speedTickDOMAt<32)return;speedTickDOMAt=now;
 if(el.style.getPropertyValue('--fill')!==fill+'%')el.style.setProperty('--fill',fill+'%');if(el.dataset.layout===key)return;el.dataset.layout=key;el.style.setProperty('--track-width',width+'px');const ticks=speedTickLayout.ticks;while(el.children.length>ticks.length)el.lastChild.remove();while(el.children.length<ticks.length)el.append(document.createElement('i'));
 for(let i=0;i<ticks.length;i++){const t=ticks[i],child=el.children[i];if(child.className!==t.kind)child.className=t.kind;const left=t.x+'px';if(child.style.left!==left){child.style.left=left;child.style.setProperty('--offset',left);}}
}
function showSaveNotice(text,manual=false,failed=false){saveNotice={text,day:game.state.clock.whole.toString(),frac:game.state.clock.frac,after:game.state.logs[0],until:failed?Infinity:performance.now()+(manual?6000:2400)};lastJournal=-1;renderJournal();}

const UI_CONFIG={maxFPS:ANDROID_BUILD?60:90,maxPhysicsFPS:60,textFPS:ANDROID_BUILD?20:30,cpuRenderFPS:ANDROID_BUILD?60:90,lowVisualFPS:ANDROID_BUILD?15:5,productionWindowSeconds:1.2,productionSmoothingSeconds:.08};
document.addEventListener('click',e=>{if(ANDROID_BUILD&&mobileNativeClick(e))return;if(e.isTrusted&&e.detail>0&&(performance.now()<suppressPointerClickUntil||settings.curve&&e.target.closest('#crtGlass button,#crtGlass select,#crtGlass summary,#crtGlass a,#crtGlass input[type=checkbox],#crtGlass input[type=radio],#crtGlass input[type=range]'))){e.preventDefault();e.stopImmediatePropagation();}},true);
let selectMenu=null,selectOwner=null;
function closeSelectMenu(focus=false){let owner=selectOwner;selectMenu?.remove();selectMenu=selectOwner=null;if(focus&&owner?.isConnected)owner.focus({preventScroll:true});}
function openSelectMenu(owner){
 if(owner.disabled)return;if(selectOwner===owner){closeSelectMenu();return;}closeSelectMenu();selectOwner=owner;
 let menu=document.createElement('div'),r=owner.getBoundingClientRect();menu.className='select-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',owner.getAttribute('aria-label')||owner.id||localText(copy('copy.choose')));menu.innerHTML=[...owner.options].map((option,i)=>'<button role="option" aria-selected="'+option.selected+'" data-ui-option="'+i+'" '+(option.disabled?'disabled':'')+'>'+escapeHTML(option.textContent)+'</button>').join('');(owner.closest('#modalRoot')||$('crtGlass')).append(menu);selectMenu=menu;
 let width=Math.min(Math.max(r.width,menu.scrollWidth),innerWidth-32);menu.style.width=width+'px';menu.style.maxHeight=Math.max(25,innerHeight-32)+'px';let height=menu.offsetHeight;menu.style.left=clamp(r.right-width,16,innerWidth-width-16)+'px';menu.style.top=clamp(r.bottom+5,16,innerHeight-height-16)+'px';menu.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});
}
document.addEventListener('click',e=>{
 let choice=e.target.closest('[data-ui-option]');if(choice&&selectMenu?.contains(choice)){e.preventDefault();e.stopImmediatePropagation();let owner=selectOwner;owner.selectedIndex=Number(choice.dataset.uiOption);closeSelectMenu(true);owner.dispatchEvent(new Event('change',{bubbles:true}));}
 else if(selectMenu&&!selectMenu.contains(e.target)&&e.target!==selectOwner)closeSelectMenu();
},true);
document.addEventListener('keydown',e=>{
 if(selectMenu){let options=[...selectMenu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();let next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();}else if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();closeSelectMenu(true);}return;}
 if(e.target.tagName==='SELECT'&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();openSelectMenu(e.target);}
},true);
window.addEventListener('resize',()=>closeSelectMenu());
new MutationObserver(()=>{if(selectOwner&&!selectOwner.isConnected)closeSelectMenu();}).observe($('modalRoot'),{childList:true,subtree:true});

const pressedControls=new Map();
let lastViewClick=null,viewClickTimer=null,earthDaylight=true;
function showPress(el,now=performance.now()){if(!el||el.disabled||!el.matches('button,input,a,summary'))return;pressedControls.set(el,now+90);if(!el.hasAttribute('data-pressed'))el.setAttribute('data-pressed','');}
function tickPressFeedback(now){for(let [el,until]of pressedControls){if(el.isConnected&&(pointerRoute?.el===el||ANDROID_BUILD&&mobile.touch?.control===el&&!mobile.touch.moved||now<until))continue;pressedControls.delete(el);el.removeAttribute('data-pressed');}}
function clearHitHover(){hitHover?.removeAttribute('data-hit-hover');hitHover=null;endingToolsHover=false;}
function setHitHover(el){let next=el?.closest('#crtGlass button:not(:disabled)')||null;if(next!==hitHover){clearHitHover();hitHover=next;hitHover?.setAttribute('data-hit-hover','');}endingToolsHover=!!el?.closest('.top-tools');}
function productionHTML(value){let yearly=game.state.stage===2;return '<span class="production-number">'+num(value*(yearly?game.C.year:1),3,true)+'</span><small class="production-unit">'+(yearly?localText(copy('copy.clips-year')):localText(copy('copy.clips-day-2')))+'</small>';}

document.addEventListener('pointerdown',()=>hideHelp(),true);
let pointerRoute=null,hitHover=null,suppressPointerClickUntil=0,screenWarpData=null,mappedPointerEvent=null,mappedPointerTarget=null;
function screenInputPoint(x,y){
 if(!settings.curve)return {x,y};const r=$('crtGlass').getBoundingClientRect();if(screenWarpData){let gx=clamp((x-r.left)/r.width*64-.5,0,63),gy=clamp((y-r.top)/r.height*64-.5,0,63),ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy,jx=Math.min(63,ix+1),jy=Math.min(63,iy+1),sample=c=>((screenWarpData[(iy*64+ix)*4+c]*(1-tx)+screenWarpData[(iy*64+jx)*4+c]*tx)*(1-ty)+(screenWarpData[(jy*64+ix)*4+c]*(1-tx)+screenWarpData[(jy*64+jx)*4+c]*tx)*ty)/255-.5;return {x:x+sample(0)*screenMapScale,y:y+sample(1)*screenMapScale};}const u=(x-r.left)/r.width*2-1,v=(y-r.top)/r.height*2-1,r2=u*u+v*v;
 return {x:x+r.width*.5*.022*u*r2,y:y+r.height*.5*.022*v*r2};
}
function screenVisualPoint(x,y){let p={x,y};for(let i=0;i<7;i++){let q=screenInputPoint(p.x,p.y);p.x+=x-q.x;p.y+=y-q.y;}return p;}
function mappedTarget(e){if(mappedPointerEvent===e)return mappedPointerTarget;const p=screenInputPoint(e.clientX,e.clientY);mappedPointerEvent=e;return mappedPointerTarget={p,el:document.elementFromPoint(p.x,p.y)};}
function updateRangeAt(el,p){if(el.disabled)return;let r=pointerRoute?.kind==='range'&&pointerRoute.el===el?pointerRoute.rect:el.getBoundingClientRect(),min=Number(el.min)||0,max=Number(el.max)||100,step=Number(el.step)||1,thumb=pointerRoute?.el===el&&pointerRoute.thumb!==undefined?pointerRoute.thumb:Number.parseFloat(getComputedStyle(el).getPropertyValue('--range-thumb-width'))||8,value=min+clamp((p.x-r.left-thumb/2)/Math.max(1,r.width-thumb),0,1)*(max-min);value=Math.round((value-min)/step)*step+min;let next=String(clamp(Number(value.toFixed(8)),min,max));if(Number(el.value)===Number(next))return;el.value=next;el.dispatchEvent(new Event('input',{bubbles:true}));}
function clearPointerRoute(){if(pointerRoute?.kind==='battle')game.commandBattle();if(pointerRoute?.el?.hasPointerCapture?.(pointerRoute.id))pointerRoute.el.releasePointerCapture(pointerRoute.id);pointerRoute=null;holding=null;$('view').classList.remove('dragging');}
document.addEventListener('pointerdown',e=>{
 if(!e.isTrusted||e.button!==0)return;if(ANDROID_BUILD&&e.pointerType==='touch'&&mobilePointerDown(e))return;let {p,el}=mappedTarget(e);if(!el||!el.closest('#crtGlass')||el.closest('[data-cleanup]'))return;let control=el.closest('button,input,select,textarea,a,summary,label');if(control?.matches('label'))control=control.control||control.querySelector('input');
 if(el.closest('#battleTitle')){const title=$('battleTitle'),now=performance.now();e.preventDefault();e.stopImmediatePropagation();pointerRoute={kind:'battleTitle',id:e.pointerId,el:title};title.setPointerCapture(e.pointerId);if(now-(title._lastSpeedClick??-Infinity)<330){accrueSimulationTime();game.state.speed=clamp(game.speedMax()/10,game.speedMin(),game.speedMax());dirtySave=true;renderClock();title._lastSpeedClick=-Infinity;}else title._lastSpeedClick=now;return;}
 if(el===$('battleCanvas')){e.preventDefault();e.stopImmediatePropagation();const now=performance.now(),last=el._lastCommandClick;el._lastCommandClick={time:now,x:p.x,y:p.y};const automatic=last&&now-last.time<330&&Math.hypot(p.x-last.x,p.y-last.y)<16;pointerRoute={kind:'battle',id:e.pointerId,el,automatic};el.setPointerCapture(e.pointerId);if(automatic)game.commandBattle(null,null);else steerBattle(p);return;}
 if(el===$('view')){e.preventDefault();e.stopImmediatePropagation();clearTimeout(viewClickTimer);pointerRoute={kind:'view',id:e.pointerId,el,started:performance.now(),x:p.x,y:p.y,yaw:viewTargetYaw=viewYaw,pitch:viewTargetPitch=viewPitch,moved:false};el.classList.add('dragging');el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);return;}
 if(control?.matches('select')){e.preventDefault();e.stopImmediatePropagation();suppressPointerClickUntil=performance.now()+700;openSelectMenu(control);return;}
 if(control?.matches('input[type=range]')){e.preventDefault();e.stopImmediatePropagation();if(control.disabled)return;control.focus({preventScroll:true});suppressPointerClickUntil=performance.now()+700;pointerRoute={kind:'range',id:e.pointerId,el:control,rect:control.getBoundingClientRect(),thumb:Number.parseFloat(getComputedStyle(control).getPropertyValue('--range-thumb-width'))||8,...(control.id==='speed'?{timeScale:speedBounds()}:{})};control.setPointerCapture(e.pointerId);updateRangeAt(control,p);return;}
 if(!control){if(settings.curve&&e.target.closest('#crtGlass button,#crtGlass select,#crtGlass summary,#crtGlass a,#crtGlass input[type=checkbox],#crtGlass input[type=radio],#crtGlass input[type=range]')){e.preventDefault();e.stopImmediatePropagation();}return;}
 if(control.matches('button,input[type=checkbox],input[type=radio],a,summary')){e.preventDefault();e.stopImmediatePropagation();pointerRoute={kind:'click',id:e.pointerId,el:control};showPress(control);setHitHover(control);control.focus({preventScroll:true});control.setPointerCapture?.(e.pointerId);beginHold(control);return;}
 if(control.matches('select')&&control!==e.target){e.preventDefault();e.stopImmediatePropagation();control.focus({preventScroll:true});try{control.showPicker();}catch{}return;}
 if(control!==e.target){e.preventDefault();control.focus({preventScroll:true});}
},true);
document.addEventListener('pointermove',e=>{
 if(!e.isTrusted||ANDROID_BUILD&&e.pointerType==='touch'&&!pointerRoute)return;let routed=pointerRoute&&pointerRoute.id===e.pointerId,{p,el}=routed?{p:screenInputPoint(e.clientX,e.clientY),el:pointerRoute.el}:mappedTarget(e);
 if(routed){if(ANDROID_BUILD&&e.pointerType==='touch')mobileMoveRoute(e,p);e.preventDefault();e.stopImmediatePropagation();if(pointerRoute.kind==='battle'){if(!pointerRoute.automatic)steerBattle(p);}else if(pointerRoute.kind==='range')updateRangeAt(pointerRoute.el,p);else if(pointerRoute.kind==='view'){pointerRoute.moved||=Math.hypot(p.x-pointerRoute.x,p.y-pointerRoute.y)>(ANDROID_BUILD&&pointerRoute.pointerType==='touch'?10:4);viewTargetYaw=pointerRoute.yaw+(p.x-pointerRoute.x)/Math.max(80,vw)*Math.PI*2;viewTargetPitch=clamp(pointerRoute.pitch+(p.y-pointerRoute.y)/Math.max(80,vh)*Math.PI,-1.35,1.35);viewDirty=true;}return;}
 setHitHover(el);
},true);
document.addEventListener('pointerup',e=>{
 if(!e.isTrusted||!pointerRoute||pointerRoute.id!==e.pointerId)return;const route=pointerRoute,{p,el}=mappedTarget(e);if(ANDROID_BUILD&&e.pointerType==='touch'){mobile.clickUntil=performance.now()+700;if(mobileFinishRoute(e,route,p,el))return;}const repeated=holding?.control===route.el&&holding.repeated;let target=el?.closest('button,input,a,summary,label');if(target?.matches('label'))target=target.control||target.querySelector('input');e.preventDefault();e.stopImmediatePropagation();suppressPointerClickUntil=performance.now()+700;if(route.kind==='range')updateRangeAt(route.el,p);clearPointerRoute();setHitHover(el);showPress(route.el);if(route.kind==='view'){if(!route.moved&&el===$('view')&&(game.state.stage!==1||performance.now()-route.started<=300)){const now=performance.now();if(lastViewClick&&now-lastViewClick.at<330&&Math.hypot(p.x-lastViewClick.x,p.y-lastViewClick.y)<16){clearTimeout(viewClickTimer);lastViewClick=null;resetView();}else{lastViewClick={at:now,x:p.x,y:p.y};if(game.state.stage===1){const point={x:p.x,y:p.y};viewClickTimer=setTimeout(()=>toggleViewDetail(point),330);}else toggleNearGrid();}}else lastViewClick=null;}if(route.kind==='click'&&target===route.el&&!route.el.disabled&&!repeated)route.el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:p.x,clientY:p.y,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey}));
},true);

window.addEventListener('pointercancel',()=>{clearPointerRoute();clearHitHover();});window.addEventListener('blur',()=>{clearPointerRoute();clearHitHover();});document.addEventListener('pointerout',e=>{if(!e.relatedTarget)clearHitHover();},true);window.addEventListener('resize',clearHitHover);
let productionSamples=[],productionValue=0,productionBaseline=0,productionStage=0,productionDisplayAt=0,fpsTimes=[],fpsDisplayAt=0;
function currentProductionEstimate(){let s=game.state;return s.stage===1?(s.h.material>=.001&&s.h.population>0?game.humanRates().production:0):s.stage===2?(s.p.last.clipRate||0)/s.clipUnit:s.stage===3?(s.s.last.clipRate||0)/s.clipUnit:0;}
function resetProduction(){disposeEndingBackground();pendingDeparture=null;departureFinalImage=null;resetJournalScroll();cancelScreenTransition();music.stopEffects();resetTournamentHighlights();resetContentNotices();manualRateSamples=[];pendingPhysicsReal=0;pendingPhysicsDays=0;lastSimulationTime=performance.now();productionSamples=[];productionValue=0;productionBaseline=0;productionStage=0;productionDisplayAt=0;}
function recordProduction(real,days,made){if(productionStage!==game.state.stage){productionSamples=[];productionValue=productionBaseline=currentProductionEstimate();productionStage=game.state.stage;}if(days>0){productionSamples.push({real,days,made:Math.max(0,made)});let span=productionSamples.reduce((n,x)=>n+x.real,0);while(productionSamples.length>1&&span-productionSamples[0].real>=UI_CONFIG.productionWindowSeconds)span-=productionSamples.shift().real;}}
function updateProduction(real,now){let s=game.state;if(s.stage>=3){setHTML('production','');return;}if(!s.paused&&!modalType){let realSpan=0,days=0,made=0;for(let x of productionSamples){realSpan+=x.real;days+=x.days;made+=x.made;}let padding=Math.max(0,UI_CONFIG.productionWindowSeconds-realSpan)*s.speed;days+=padding;made+=productionBaseline*padding;let cutoff=now-UI_CONFIG.productionWindowSeconds*1000;while(manualRateSamples.length&&manualRateSamples[0].at<cutoff)manualRateSamples.shift();if(s.stage===1)for(let x of manualRateSamples)made+=x.count;let target=days>0?made/days:0;productionValue+=(target-productionValue)*(-Math.expm1(-real/UI_CONFIG.productionSmoothingSeconds));if(target===0&&productionValue<.001)productionValue=0;}if(now-productionDisplayAt>=1000/UI_CONFIG.maxPhysicsFPS){setHTML('production',productionHTML(productionValue));productionDisplayAt=now;}}
function updateFPS(now){if(document.hidden){fpsTimes=[];return;}fpsTimes.push(now);while(fpsTimes.length>2&&fpsTimes[0]<now-1200)fpsTimes.shift();if(now-fpsDisplayAt<500)return;let elapsed=fpsTimes.at(-1)-fpsTimes[0],fps=elapsed>0?(fpsTimes.length-1)*1000/elapsed:0;$('fpsReadout').textContent=fps.toFixed(1)+' FPS';fpsDisplayAt=now;}
function rotationScale(days){return 1+.16*Math.min(10,Math.max(0,Math.log10(Math.max(1,days/.01))));}

const SAVE_KEY='paperclips.crt.v1',MANUAL_KEY='paperclips.crt.manual.v1',PREF_KEY=ANDROID_BUILD?'paperclips.crt.mobile.display.v1':'paperclips.crt.display.v1';
function escapeHTML(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const numberFormats=new Map();
const abbreviationGroups={latin:[[3,'k'],[6,'M'],[9,'B'],[12,'T']],chinese:[[4,copy('interface.text')],[8,copy('interface.text-2')],[12,copy('interface.text-3')]]};
const siPrefixes=['','k','M','G','T','P','E','Z','Y','R','Q'];
function decimalNumber(x,d=2){let formatter=numberFormats.get(d);if(!formatter){formatter=new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});numberFormats.set(d,formatter);}return formatter.format(x);}
function scientificNumber(x,d=2){if(!Number.isFinite(x))return '—';if(x===0)return x.toFixed(d);let [mantissa,exponent]=x.toExponential(d).split('e');return mantissa+'×10<sup>'+Number(exponent)+'</sup>';}
function quantityNumber(x,d=2,fractional=false,integer=false){
 if(!Number.isFinite(x))return '—';if(integer)x=Math.trunc(x);if(x===0)return integer?'0':x.toFixed(d);
 let a=Math.abs(x),groups=abbreviationGroups[settings.numberUnits],threshold=10**settings.scientificAt;
 if(a>=threshold||a<.001)return scientificNumber(x,integer?3:d);
 if(a<10**groups[0][0])return integer?String(x):decimalNumber(x,d);
 let value=integer?Number(x.toPrecision(4)):x;
 if(Math.abs(value)>=threshold)return scientificNumber(value,integer?3:d);
 let index=0;while(index+1<groups.length&&Math.abs(value)>=10**groups[index+1][0])index++;
 let [exponent,suffix]=groups[index],scaled=value/10**exponent,digits=integer?Math.max(0,3-Math.floor(Math.log10(Math.abs(scaled)))):d;
 let rounded=Number(scaled.toFixed(digits));
 if(Math.abs(rounded)*10**exponent>=threshold)return scientificNumber(value,integer?3:d);
 if(index+1<groups.length&&Math.abs(rounded)>=10**(groups[index+1][0]-exponent)){[exponent,suffix]=groups[++index];scaled=value/10**exponent;digits=integer?Math.max(0,3-Math.floor(Math.log10(Math.abs(scaled)))):d;}
 return scaled.toFixed(digits)+suffix;
}
function num(x,d=2,fractional=false){return quantityNumber(x,d,fractional,d===0&&!fractional);}
function countNumber(x){return quantityNumber(x,0,false,true);}
// 切换万、亿等数量单位时，瓦特和算力仍用国际单位制前缀。
function siNumber(x,unit,d=2,minGroup=0,scientificAt=settings.scientificAt){
 if(!Number.isFinite(x))return '—';if(x===0)return x.toFixed(d)+' '+unit;
 if(Math.abs(x)>=10**scientificAt||Math.abs(Number(x.toPrecision(d+1)))>=10**scientificAt)return scientificNumber(x,d)+' '+unit;
 let a=Math.abs(x),group=Math.max(minGroup,Math.min(10,Math.floor(Math.log10(a)/3))),scaled=x/10**(group*3);
 if(Math.abs(Number(scaled.toFixed(d)))>=1000&&group<10){group++;scaled=x/10**(group*3);}
 let number=Math.abs(scaled)>=1000||Math.abs(scaled)<.001?scientificNumber(scaled,d):decimalNumber(scaled,d);
 return number+' '+siPrefixes[group]+unit;
}
function wattNumber(x){return siNumber(x,'W',2,0,settings.scientificAt);}
function storageNumber(x){return (Math.abs(x)>=1e18||x!==0&&Math.abs(x)<.001?scientificNumber(x):decimalNumber(x))+' bit';}
function computeNumber(x){return siNumber(x,'OPS',2,0,18);}
function memoryNumber(units){return storageNumber(units*game.C.operationsPerMemory);}
function displayMass(x){return Math.abs(x)<1e-6?0:x;}
function massParts(x,d=2){x=displayMass(x);
 if(settings.massUnits==='scientific'){let a=Math.abs(x),digits=a>0&&a<1?Math.max(d,Math.ceil(-Math.log10(a))):d;return {number:Number.isFinite(x)&&a<1e3&&(a>=.001||x===0)?decimalNumber(x,digits):scientificNumber(x,d),unit:'kg'};}
 let a=Math.abs(x),unit=a>0&&a<1?'g':a>=1e3?'t':'kg',scaled=unit==='g'?x*1e3:unit==='t'?x/1e3:x;
 if(unit!=='t'&&Number.isFinite(scaled)&&Math.abs(Number(scaled.toFixed(d)))>=1000){unit=unit==='g'?'kg':'t';scaled/=1e3;}
 return {number:quantityNumber(scaled,d,true),unit};
}
function massNumber(x,d=2){return massParts(x,d).number;}
function kg(x,d=2){let part=massParts(x,d);return part.number+' <span class="micro muted">'+part.unit+'</span>';}
function plainSignificant(x,digits=3){
 if(!Number.isFinite(x))return '—';let text=x.toPrecision(digits);if(!text.includes('e'))return text;
 let [mantissa,exponent]=text.split('e'),sign=mantissa.startsWith('-')?'-':'',unsigned=mantissa.replace('-',''),point=(unsigned.indexOf('.')<0?unsigned.length:unsigned.indexOf('.'))+Number(exponent),number=unsigned.replace('.','');
 return sign+(point<=0?'0.'+'0'.repeat(-point)+number:point>=number.length?number+'0'.repeat(point-number.length):number.slice(0,point)+'.'+number.slice(point));
}
function coveragePercent(fraction){let percent=Math.max(0,Math.min(1,fraction))*100;if(percent===0)return '0.00%';let [mantissa,exponent]=percent.toExponential(16).split('e'),digits=mantissa.replace('.','').slice(0,3),truncated=Number(digits[0]+'.'+digits.slice(1)+'e'+exponent);return plainSignificant(truncated)+'%';}
function remainingPercent(value,total){
 let remaining=Math.max(0,Math.min(1,total>0?value/total:0)),removed=total>0?Math.max(0,(total-value)/total)*100:100;
 if(remaining===0)return '0.0%';if(removed===0)return '100.0%';if(remaining<.01)return coveragePercent(remaining);
 // 用三位有效数字显示已拆除的质量，减少文本宽度，也保留可见的小变化。
 let decimals=Math.min(14,Math.max(1,2-Math.floor(Math.log10(Number(removed.toPrecision(3))))));return (remaining*100).toFixed(decimals)+'%';
}
function remainingMass(value,total,adaptive=false){return kg(value)+' ('+(adaptive?remainingPercent(value,total):(Math.max(0,Math.min(1,total>0?value/total:0))*100).toFixed(1)+'%')+')';}
function massRate(x){return kg(x)+' <span class="micro muted">'+localText(copy('copy.day'))+'</span>';}
function stripNumberMarkup(text){return text.replace(/<sup>/g,'^').replace(/<\/sup>/g,'').replace(/<[^>]*>/g,'');}
function refreshNumberSettings(){try{localStorage.setItem(PREF_KEY,JSON.stringify(settings));}catch{}lastProjects='';render();if(modalType==='display')renderUnitExamples();}
function renderUnitExamples(){setHTML('scientificValue','10<sup>'+settings.scientificAt+'</sup>');$('scientificAt').setAttribute('aria-valuetext','10^'+settings.scientificAt);setHTML('numberExample',num(12345678,2,true));setHTML('massExample',kg(12345678));}

function plain(x,d=2){return stripNumberMarkup(num(x,d,true));}
function money(x){return '$'+num(x,2,true);}
function procurementMoney(x){let rounded=Number(x.toPrecision(3)),a=Math.abs(rounded),exponent=a?Math.floor(Math.log10(a)):0;if(a>=10**settings.scientificAt||a>0&&a<.001)return '$'+scientificNumber(rounded,2);let groups=abbreviationGroups[settings.numberUnits],unit=0;for(let [power]of groups)if(a>=10**power)unit=power;return '$'+num(rounded,Math.max(0,2-exponent+unit),true);}
function duration(days){if(days<1)return (days*24).toFixed(1)+copy('interface.hours');if(days<365)return plain(days,1)+copy('interface.days');return plain(days/game.C.year,2)+copy('interface.years');}
function rateTime(days){if(days<game.C.year)return plain(days,2)+copy('interface.days-sec');return plain(days/game.C.year,2)+copy('interface.years-sec');}
function calendarYear(year){return year>=10n**15n?scientificNumber(Number(year),3):year<100000n?year.toString():year.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function shortDate(clock){let d=game.dateParts(clock),y=calendarYear(d.year);return d.year>=100000n?copy('interface.a-d')+y:y+'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0');}

function saveFileName(){const d=game.dateParts(game.state.clock),prefix=settings.lang==='zh'?GAME_NAME.zh:GAME_NAME.slug;return prefix+'-A.D.'+d.year.toString()+(d.year<100000n?'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0'):'')+'.json';}
function fullDate(clock){let display={...clock};PaperclipModel.clockAdd(display,.0005/PaperclipModel.C.day);let d=game.dateParts(display);if(d.year>=100000n)return copy('interface.a-d')+stripNumberMarkup(calendarYear(d.year));return copy('interface.a-d')+d.year.toString()+'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0')+' '+[d.hour,d.minute,d.second].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(d.ms).padStart(3,'0');}
let markupCache=new WeakMap(),textMarkupCache=new WeakMap();
// 只变了文字就直接更新文本，结构真的变了才解析 HTML 和更新节点。
function textMarkupParts(html){return /<!--|<(?:script|style|textarea|table)\b/i.test(html)?null:html.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);}
function rememberTextMarkup(el,html){let parts=textMarkupParts(html);if(!parts){textMarkupCache.delete(el);return;}let walker=document.createTreeWalker(el,4),nodes=[],node;while(node=walker.nextNode())nodes.push(node);let slots=parts.filter((s,i)=>i%2===0&&s.length);if(slots.length!==nodes.length){textMarkupCache.delete(el);return;}let targets=[],index=0;for(let i=0;i<parts.length;i+=2)if(parts[i])targets[i]=nodes[index++];textMarkupCache.set(el,{parts,targets});}
function patchTextMarkup(el,html){let cached=textMarkupCache.get(el),parts=cached&&textMarkupParts(html);if(!parts||parts.length!==cached.parts.length)return false;for(let i=0;i<parts.length;i++){if(i%2){if(parts[i]!==cached.parts[i])return false;}else if(parts[i]!==cached.parts[i]&&(!cached.targets[i]||!el.contains(cached.targets[i])||parts[i].includes('&')))return false;}for(let i=0;i<parts.length;i+=2)if(parts[i]!==cached.parts[i])cached.targets[i].data=parts[i];cached.parts=parts;return true;}
function syncMarkup(el,html){
 if(markupCache.get(el)===html)return;markupCache.set(el,html);if(patchTextMarkup(el,html))return;let template=document.createElement('template');template.innerHTML=html;
 function patch(parent,fresh){
  let nodes=[...fresh.childNodes];for(let i=0;i<nodes.length;i++){let next=nodes[i],old=parent.childNodes[i];if(!old){parent.append(next.cloneNode(true));continue;}
   if(old.nodeType!==next.nodeType||old.nodeType===1&&(old.tagName!==next.tagName||['id','data-project','data-action'].some(k=>old.getAttribute(k)!==next.getAttribute(k)))){old.replaceWith(next.cloneNode(true));continue;}
   if(old.nodeType===3){if(old.data!==next.data)old.data=next.data;continue;}
   if(old.nodeType!==1)continue;
   for(let attr of [...old.attributes])if(!next.hasAttribute(attr.name)&&!(attr.name==='open'&&old.tagName===copy('ui.details'))&&!(attr.name==='data-pressed'&&pressedControls.has(old))&&!(attr.name==='data-hit-hover'&&hitHover===old))old.removeAttribute(attr.name);
   for(let attr of next.attributes)if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
   patch(old,next);
  }while(parent.childNodes.length>nodes.length)parent.lastChild.remove();
 }patch(el,template.content);rememberTextMarkup(el,html);
}

function setHTML(id,html){html=localizedHTML(html);let el=$(id);if(!el||el.closest('[data-cleanup]'))return;if(!String(html).includes('<')){markupCache.delete(el);textMarkupCache.delete(el);if(el.textContent!==String(html)){if(el.childNodes.length===1&&el.firstChild.nodeType===3)el.firstChild.data=String(html);else el.textContent=html;}}else syncMarkup(el,String(html));}
function readout(label,value,cls=''){return '<div class="readout '+cls+'"><span>'+label+'</span><b>'+value+'</b></div>';}
function action(id,text,cls='',help=''){return '<button class="'+cls+'" data-action="'+id+'"'+(help?' data-help="'+escapeHTML(help)+'"':'')+'>'+text+'</button>';}
function section(title,code,body){return '<section class="section"><div class="section-head"><span>'+title+'</span><small>'+code+'</small></div>'+body+'</section>';}
function bar(id){return '<div class="bar"><i id="'+id+'"></i></div>';}
function toast(text){$('toast').textContent=localText(text);$('toast').classList.remove('hidden');toastUntil=performance.now()+3200;}
const screenSettingRanges={crt:{label:copy('copy.scanline-spacing'),max:40,step:1,default:10},bloom:{label:copy('copy.bloom-intensity'),max:2,step:.05,default:1},noise:{label:copy('copy.phosphor-pitch'),max:15,step:.5,default:0},rgb:{label:copy('copy.chromatic-offset'),max:3,step:.05,default:1}};
function screenSettingValue(key){const value=settings[key];return value?key==='bloom'?Math.round(value*100)+'%':Number(value.toFixed(2))+' px':localText(copy('interface.text-4'));}
function screenSettingHTML(key){const a=screenSettingRanges[key];return '<div class="screen-setting"><div class="readout"><label for="screen-'+key+'">'+a.label+'</label><b id="screen-value-'+key+'">'+screenSettingValue(key)+'</b></div><input id="screen-'+key+'" data-screen-setting="'+key+'" type="range" min="0" max="'+a.max+'" step="'+a.step+'" value="'+settings[key]+'" aria-label="'+a.label+'"></div>';}
let bloomUpdateFrame=0;
function queueBloomUpdate(){
 try{localStorage.setItem(PREF_KEY,JSON.stringify(settings));}catch{}
 if(!bloomUpdateFrame)bloomUpdateFrame=requestAnimationFrame(()=>{bloomUpdateFrame=0;updateBloomSetting();});
}
function applySettings(){const colors={amber:'#ffb228',mint:'#a8ffe0',white:'#f2f2f2',blue:'#9fd0ff',pink:'#ffb8e8',mars:'#ff6644',green:'#88ff66',cyan:'#66bbff'},hex=colors[settings.theme]||colors.amber,rgb=hex.match(/\w\w/g).map(c=>parseInt(c,16)),tone=f=>'#'+rgb.map(c=>Math.round(c*f).toString(16).padStart(2,'0')).join(''),a=[hex,'#'+rgb.map(c=>Math.round(c+(255-c)*.3).toString(16).padStart(2,'0')).join(''),tone(.7),tone(.34),rgb.join(','),'#000'];['--ink','--bright','--dim','--faint','--rgb','--bg'].forEach((v,i)=>document.documentElement.style.setProperty(v,a[i]));for(let k of ['crt','rgb','vignette','curve','noise'])document.body.classList.toggle(k,!!settings[k]);document.body.classList.toggle('still',!settings.motion);try{localStorage.setItem(PREF_KEY,JSON.stringify(settings));}catch{}refreshVisualColor();drawProjectIcons();updateScreenEffects();resizeViz();}
function resetDisplaySettings(){Object.assign(settings,displayDefaults);screenRenderer.configure();applySettings();render();renderModal();$('modalContent').querySelector('[data-action=resetDisplay]').focus({preventScroll:true});}
function readSlot(key){try{let text=localStorage.getItem(key);if(!text)return null;let value=JSON.parse(text);return value&&typeof value.data==='string'?value:null;}catch{return null;}}
function save(manual=false){if(!manual&&!settings.autoSave)return;try{localStorage.setItem(manual?MANUAL_KEY:SAVE_KEY,JSON.stringify({savedAt:Date.now(),data:game.serialize()}));dirtySave=false;saveFailed=false;if(manual){showSaveNotice(copy('copy.saved-2'),true);if(modalType==='save')renderModal();}}catch{saveFailed=true;if(manual){showSaveNotice(copy('copy.please-export-your-save'),true,true);toast(copy('copy.local-saving-is-unavailable-export-your-save'));}}}
function saveSlotsHTML(){return [[SAVE_KEY,copy('copy.latest-autosave'),'restoreAuto'],[MANUAL_KEY,copy('copy.last-manual-save'),'restoreManual']].map(([key,label,id])=>{let slot=null,date=copy('copy.empty');try{slot=readSlot(key);if(slot){let candidate=PaperclipModel.create();candidate.restore(slot.data);date=fullDate(candidate.state.clock);}}catch{date=copy('copy.the-save-could-not-be-read');slot=null;}return '<div class="save-slot"><div class="readout"><span>'+label+'</span>'+action(id,copy('copy.load'),'tiny').replace('<button ',slot?'<button ':'<button disabled ')+'</div><span class="small">'+escapeHTML(date)+'</span></div>';}).join('');}
function restoreSlot(key,notice){try{let slot=readSlot(key);if(!slot)throw Error(copy('copy.no-backup-is-available'));let candidate=PaperclipModel.create();candidate.restore(slot.data);game=candidate;game.prepareSpaceSimulation();lastStage=0;lastProjects='';lastJournal=-1;modalType=null;closeModal();resetProduction();resetView();render();showSaveNotice(notice,true);}catch(e){toast(e.message);}}
try{let prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'null');if(prefs&&typeof prefs==='object'){if(Number.isFinite(prefs.musicVolume))settings.musicVolume=clamp(prefs.musicVolume,0,1);for(let k of ['vignette','curve','ambient','motion','autoSave'])if(typeof prefs[k]==='boolean')settings[k]=prefs[k];for(const [key,a]of Object.entries(screenSettingRanges))if(typeof prefs[key]==='number'&&Number.isFinite(prefs[key]))settings[key]=clamp(prefs[key],0,a.max);else if(prefs[key]===false)settings[key]=0;const theme={ice:'blue',paper:'white',orchid:'pink',red:'mars'}[prefs.theme]||prefs.theme;if(['amber','mint','white','blue','pink','mars','green','cyan'].includes(theme))settings.theme=theme;if(['standard','low'].includes(prefs.quality))settings.quality=prefs.quality;if(['auto','device','1','.75','.5'].includes(prefs.renderScale))settings.renderScale=prefs.renderScale;if(['nearest','linear'].includes(prefs.interpolation))settings.interpolation=prefs.interpolation;if(['latin','chinese'].includes(prefs.numberUnits))settings.numberUnits=prefs.numberUnits;if(['scientific','adaptive'].includes(prefs.massUnits))settings.massUnits=prefs.massUnits;if(Number.isInteger(prefs.scientificAt)&&prefs.scientificAt>=3&&prefs.scientificAt<=15)settings.scientificAt=prefs.scientificAt;if(['zh','en'].includes(prefs.lang))settings.lang=prefs.lang;}}catch{}
try{let entries=[readSlot(SAVE_KEY),readSlot(MANUAL_KEY)].filter(Boolean).sort((a,b)=>b.savedAt-a.savedAt),loaded=false;for(let slot of entries){try{game.restore(slot.data);game.prepareSpaceSimulation();loaded=true;break;}catch{}}if(entries.length&&!loaded)toast(copy('copy.the-save-could-not-be-read-a-new'));}catch{}
const allocationLabels={pv:copy('copy.surface-pv'),orbital:copy('copy.orbital-pv-stations'),harvester:copy('copy.harvesters'),factory:copy('copy.fabricators'),battery:copy('copy.electricity-storage-systems'),clips:copy('copy.paperclips-high-purity-metal-reserve')};
const designLabels={industry:copy('copy.equip-prod'),clips:copy('copy.clip-prod'),replication:copy('copy.replication'),shield:copy('copy.protection'),fidelity:copy('copy.integrity'),combat:copy('project.combat.name')};
const projectFoldStates=new Map(),projectFoldMotions=new Map(),projectIconCache=new WeakMap();
const fullIntegerFormat=new Intl.NumberFormat('en-US',{notation:'standard',maximumFractionDigits:0});
let countFitKey='',taskArrowAt=-1;
let clipDigitsState=null,clipDigitsValue=0,clipDigitsDay=null,clipDigitsFraction=0,clipDigitsTail='';
function wholeClipNumber(){
 if(game.state.stage===4)return game.endingClipInteger().toLocaleString('en-US');
 const s=game.state,value=game.clipCount(),digits=fullIntegerFormat.format(Math.max(0,value)).replaceAll(',',''),tailLength=Math.max(0,digits.length-15),same=clipDigitsState===s,advanced=same&&(s.clock.whole!==clipDigitsDay||s.clock.frac!==clipDigitsFraction),changed=same&&value!==clipDigitsValue;
 if(!same||clipDigitsTail.length!==tailLength)clipDigitsTail=digits.slice(digits.length-tailLength);
 if(tailLength&&(changed||advanced&&game.clipFlow&&!s.paused))clipDigitsTail=Array.from({length:tailLength},()=>Math.floor(Math.random()*10)).join('');
 clipDigitsState=s;clipDigitsValue=value;clipDigitsDay=s.clock.whole;clipDigitsFraction=s.clock.frac;
 return (tailLength?digits.slice(0,-tailLength)+clipDigitsTail:digits).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function renderClipCount(){let s=game.state,value=game.clipCount(),text=wholeClipNumber(),key=[s.stage,text.length,innerWidth,innerHeight,settings.lang,document.fonts.status].join(':');if(key!==countFitKey){let hero=$('clipCount'),labelWidth=$('countLabel').getBoundingClientRect().width,minimum=innerWidth<700?10:14;document.body.classList.toggle('counter-wide',text.length*.61*minimum>Math.max(1,(s.stage>=3?hero.closest('.topbar').clientWidth-document.querySelector('.top-tools').clientWidth-24:document.querySelector('.column.observation')?.clientWidth||innerWidth*.33)-labelWidth-12));let available=Math.max(1,hero.closest('.hero').clientWidth-labelWidth-12);hero.style.fontSize=clamp(Math.floor(available/(text.length*.61)),minimum,36)+'px';countFitKey=key;}setHTML('clipCount',text+(value>=1e15?'<small class="count-scientific">'+scientificNumber(value,3)+'</small>':''));}

function strategyName(key){return localText({reciprocal:copy('copy.tit-for-tat'),greedy:copy('copy.greedy'),minimax:copy('copy.minimax'),generous:copy('copy.generous')}[key]||copy('copy.strategy'));}
function projectCategory(id){let configured=game.defs.find(d=>d.id===id)?.icon;if(configured)return configured;if(/^(creative|language|representations|symbolic|learning|multimodal|math|poem|asic|humanRSFQ|memristor|photonicCompute|nsquid|reconfiguration)$/.test(id))return 'chip';if(/^(clinical|climate|carbon|peace|scarcity|baldness|personalData|psychology|humanAgents|bribe)$/.test(id))return 'human';if(/^(embodied|supply|cdz.*|automation|control)$/.test(id))return 'factory';if(/^(servo|procurement|lowcarbon|recycled|forming|pricing)$/.test(id))return 'clip';if(/^(game|market|marketSurvey|autoTourney|company|monopoly|sampling|parallelGames)$/.test(id))return 'chart';return 'star';}
// 材料凑齐时原地启用按钮，避免列表跳动。
function projectListOrder(a,b){return Number(b.id==='scarcity')-Number(a.id==='scarcity')||(a.stage===2&&b.stage===2?(a.baseCost.ops||0)-(b.baseCost.ops||0):0);}
function projectIcon(id){return '<canvas class="project-icon" data-project-icon="'+projectCategory(id)+'" width="24" height="24" aria-hidden="true"></canvas>';}
const projectIconPatterns=Object.freeze({
 chip:['001010100','011111110','110000011','010111010','110101011','010111010','110000011','011111110','001010100'],
 factory:['010000000','010000000','010010010','011100110','010110110','010000010','010101010','010101010','011111110'],
 human:['000000000000','001110011100','011001100110','110000000011','100000000001','110000000011','011000000110','001100001100','000110011000','000011110000','000001100000','000000000000'],
 chart:['100000001','100000110','100011000','101100000','110000000','100000000','100000000','111111111','000000000'],
 star:['000010000','000010000','001010100','000111000','111111111','000111000','001010100','000010000','000010000'],
 mine:['011111100','100110010','000110001','000110000','000100000','001100000','001000000','011000000','010000000'],
 solar:['000010000','010000010','000000000','011111110','010101010','011111110','010101010','011111110','000010000'],
 storage:['000111000','011111110','010000010','010010010','010111010','010010010','010000010','011111110','000000000'],
 cooling:['000110000','001001000','001011000','001001000','001011000','001001000','010110100','010110100','001111000'],
 rocket:['000010000','000111000','001010100','001010100','001111100','011111110','010111010','000101000','000010000'],
 orbit:['001111100','010000010','100000001','100010001','100111001','100010001','100000001','010000010','001111100'],
 beam:['000000001','001000010','001111100','111111111','001111100','001000010','000000001','000000000','000000000'],
 cloud:['000111000','001000100','011000110','100000001','100000001','011111110','000000000','001010100','000000000'],
 shield:['111111111','100000001','100010001','100010001','100111001','010000010','010000010','001000100','000111000'],
 accretion:['000111001','001000110','010001110','100011001','100110001','101100001','011000010','110000100','100111000'],
 towing:['000000011','001110011','010001000','100000100','101110101','100000110','010001100','001110000','000000000'],
 whiteDwarf:['000001100','001110100','010001010','100110001','100110001','100000001','010001010','001110100','000001000'],
 compactOrbit:['000001100','001110100','010001010','100000001','100000001','100000001','010001010','001110100','000001000'],
 nucleus:['000010000','000010000','000000000','001101100','011011110','001110100','010111010','001011100','000010000'],
 collapse:['100000001','010000010','001000100','000000000','000111000','000111000','001000100','010000010','100000001'],
 merger:['100000001','010000010','001010100','011101110','111101111','011101110','001010100','010000010','100000001'],
 stellarEngine:['000111000','001111100','011111110','011111110','011111110','001111100','000111000','000000000','001010100'],
 impact:['000000001','000000011','000000110','000001100','000010000','001010000','010100000','001000000','100000000'],
 analysis:['000111000','000101000','000111000','000010000','001111100','001000100','011101110','010101010','011101110'],
 radiation:['100100100','010010010','001001001','000000000','111111111','010101010','011111110','000010000','000111000']
});
function drawProjectIcons(){
 for(let canvas of document.querySelectorAll('canvas[data-project-icon]')){
  let category=canvas.dataset.projectIcon,dim=canvas.closest('.unavailable')!==null,key=category+':'+visualRGB+':'+dim;if(projectIconCache.get(canvas)===key)continue;
  let c=canvas.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,24,24);c.fillStyle=c.strokeStyle='rgba('+visualRGB+','+(dim?.35:.92)+')';
  if(category==='clip'){let points=[[17,18],[17,4],[15,2],[8,2],[6,4],[6,19],[8,21],[13,21],[15,19],[15,8],[13,6],[10,6],[9,7],[9,16],[10,17],[11,17],[12,16],[12,9]];c.lineWidth=2;c.lineJoin='round';c.lineCap='square';c.beginPath();for(let [i,p]of points.entries())i?c.lineTo(...p):c.moveTo(...p);c.stroke();}
  else{let pattern=projectIconPatterns[category]||projectIconPatterns.star,offset=(24-pattern.length*2)/2;for(let[y,row]of pattern.entries())for(let x=0;x<row.length;x++)if(row[x]==='1')c.fillRect(offset+x*2,offset+y*2,2,2);}
  projectIconCache.set(canvas,key);markCanvasPaint(canvas);
 }
}
function foldBody(id,body){let closed=projectFoldStates.get(id)===true,motion=projectFoldMotions.get(id),height=motion?motion.height+'px':closed?'0px':'auto';return '<div class="fold-content" data-fold-body="'+id+'" style="height:'+height+'"'+(closed?' inert':'')+'>'+body+'</div>';}
function foldTitle(id,title,icon){return '<button class="fold-title" data-fold="'+id+'" aria-expanded="'+String(!projectFoldStates.get(id))+'">'+(icon||'')+'<span>'+title+'</span><span class="fold-mark">'+(projectFoldStates.get(id)?'+':'-')+'</span></button>';}
function toggleProjectFold(id){let body=document.querySelector('[data-fold-body="'+id+'"]');if(!body)return;let closed=!projectFoldStates.get(id);projectFoldStates.set(id,closed);projectFoldMotions.set(id,{from:body.getBoundingClientRect().height,to:closed?0:body.scrollHeight,height:body.getBoundingClientRect().height,start:performance.now()});body.inert=closed;let b=document.querySelector('[data-fold="'+id+'"]');if(b){b.setAttribute('aria-expanded',String(!closed));b.querySelector('.fold-mark').textContent=closed?'+':'-';}lastProjects='';renderProjects();}
function tickProjectFolds(now){for(let [id,m]of projectFoldMotions){let body=document.querySelector('[data-fold-body="'+id+'"]');if(!body){projectFoldMotions.delete(id);continue;}let p=clamp((now-m.start)/220,0,1),ease=1-(1-p)**3;m.height=m.from+(m.to-m.from)*ease;body.style.height=m.height+'px';if(p===1){projectFoldMotions.delete(id);body.style.height=projectFoldStates.get(id)?'0px':'auto';lastProjects='';}}}
function tickTaskArrows(now,force=false){let step=Math.floor(now/160)%3;if(step===taskArrowAt&&!force)return;taskArrowAt=step;for(let arrow of document.querySelectorAll('.task-arrows'))for(let [i,node]of [...arrow.children].entries())node.classList.toggle('lit',i===step);}
let journalScrollMotion=null,journalEntries=[];
function journalLineHeight(el){let row=el.querySelector('.journal-line'),style=getComputedStyle(row||el);return parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5;}
function journalWheelDistance(event,el){
 const line=journalLineHeight(el),lines=Math.min(3,Math.max(1,Math.floor(el.clientHeight/line)));
 if(event.deltaMode===1)return Math.sign(event.deltaY)*Math.min(Math.abs(event.deltaY),lines)*line;
 if(event.deltaMode===2)return event.deltaY*el.clientHeight;
 // Chromium 的普通滚轮也可能按像素上报。只有完整的 120 单位才当作滚轮刻度。
 const detent=event.wheelDeltaY;
 if(detent&&Math.abs(detent)>=120&&Math.abs(detent/120-Math.round(detent/120))<1e-6)return -detent/120*lines*line;
 return event.deltaY;
}
function resetJournalScroll(){journalScrollMotion=null;}
function scrollJournalBy(el,distance,now=performance.now()){
 if(!Number.isFinite(distance)||!distance)return;
 if(distance<0&&reviewEndingCredits(el))return;
 const max=Math.max(0,el.scrollHeight-el.clientHeight),from=el.scrollTop,to=clamp((journalScrollMotion?.el===el?journalScrollMotion.to:from)+distance,0,max);
 if(Math.abs(to-from)<.1){resetJournalScroll();return;}
 journalScrollMotion={el,from,to,start:now,duration:Math.min(240,130+Math.abs(to-from)*.35)};
}
function shiftJournalScroll(el,distance,position=el.scrollTop){
 const max=Math.max(0,el.scrollHeight-el.clientHeight);
 el.scrollTop=clamp(position+distance,0,max);
 if(journalScrollMotion?.el===el){journalScrollMotion.from=clamp(journalScrollMotion.from+distance,0,max);journalScrollMotion.to=clamp(journalScrollMotion.to+distance,0,max);}
}
function tickJournalScroll(now){
 const motion=journalScrollMotion;if(!motion)return;
 if(document.hidden||!motion.el.isConnected){resetJournalScroll();return;}
 const u=clamp((now-motion.start)/motion.duration,0,1),max=Math.max(0,motion.el.scrollHeight-motion.el.clientHeight);
 motion.el.scrollTop=Math.min(max,motion.from+(motion.to-motion.from)*(1-(1-u)**3));
 if(u===1)resetJournalScroll();
}
document.addEventListener('wheel',event=>{
 if(!event.isTrusted||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
 const el=settings.curve?mappedTarget(event).el:event.target,journal=el?.closest?.('.journal-lines');
 if(!journal)return;event.preventDefault();scrollJournalBy(journal,journalWheelDistance(event,journal));
},{passive:false});
document.addEventListener('pointerdown',event=>{if(journalScrollMotion&&(settings.curve?mappedTarget(event).el:event.target)?.closest?.('.journal-lines'))resetJournalScroll();},true);
document.addEventListener('keydown',event=>{if(event.target.closest?.('.journal-lines')&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key)){resetJournalScroll();if(['ArrowUp','PageUp','Home'].includes(event.key)&&reviewEndingCredits(event.target.closest('.journal-lines')))event.preventDefault();}},true);
window.addEventListener('resize',resetJournalScroll);


// 新控件闪烁的时长用现实时间计算，暂停游戏时也会自然结束。
const noticedContent=new Set(),contentFlickers=new Map();
let contentNoticesInitialized=false;
function contentFlickerOpacity(elapsed){let t=Math.max(0,elapsed)/1000;if(t>=1.35)return 1;return Math.round((1-.98*Math.exp(-Math.max(0,t-.22)/.28)*((1-Math.cos(2*Math.PI*(10*t-1.8*t*t)))/2)**2)*100)/100;}
function resetContentNotices(){if(ANDROID_BUILD)mobileResetNotices();for(let el of contentFlickers.keys())el.style.removeProperty('opacity');contentFlickers.clear();noticedContent.clear();contentNoticesInitialized=false;}
function noticeNewContent(now=performance.now()){
 let stage=game.state.stage,targets=[];
 for(let id of ['investment','industrialReadout','strategySection','procurementCheck','priceAuto','yomiReadout','asteroidReadout','battleExtras','stellarEngineering','powerSources','probe-design-combat','probe-design-fidelity','probeDriftEstimateRow','probeBalance']){let el=$(id);if(el?.firstElementChild&&!el.closest('.hidden'))targets.push([stage+':'+id,el]);}
 if(stage===3){if(game.state.s.driftSeen)targets.push(['3:probeDriftRow',$('probeDriftRow')]);if(game.state.s.war)for(const id of ['probeEnemyDestroyedRow','drifterControlRow'])targets.push(['3:'+id,$(id)]);}
 for(let id of ['probeHazardEstimate','blackHoleMatter','autonomyCost']){const el=$(id)?.closest('.readout');if(el&&!el.closest('.hidden')&&$(id).textContent.trim())targets.push([stage+':'+id,el]);}
 if($('industrialEconomy'))targets.push(['industrial-economy',$('industrialEconomy')]);if(game.has('cdzMachines')&&$('industrialOperations'))targets.push(['industrial-operations',$('industrialOperations')]);
 if(stage===1&&game.has('supply')&&$('industrialBudgetControls'))targets.push(['industrial-budget-ready',$('industrialReadout')]);
 if(stage===1&&game.has('cdzClosure')&&$('industrialReadout'))targets.push(['industrial-autonomous',$('industrialReadout')]);
 if(stage===2&&game.planetRates().coverage>=1-1e-12&&$('coverageReadout'))targets.push(['surface-coverage-full',$('coverageReadout').closest('.section')]);
 if(stage===2&&game.has('logisticsBalance')&&$('balanceControl'))targets.push(['interplanetary-balance-ready',$('balanceControl')]);
 if(stage===2&&game.has('dyson'))targets.push(['solar-industry',$('management')]);if(stage===2&&game.has('ion'))targets.push(['laser-mining',$('management')]);if(stage===2&&game.has('rockyWorlds'))targets.push(['rocky-worlds',$('solarStocks')]);if(stage===2&&game.has('starLifting'))targets.push(['stellar-extraction',$('solarStocks')]);
 if(game.has('cdzPower')&&$('industrialPower'))targets.push(['industrial-power-ready',$('industrialPower')]);
 if(game.has('automation')&&$('trustRow'))targets.push(['industrial-trust',$('trustRow')]);
 for(let el of document.querySelectorAll('[data-project-card]'))targets.push([stage+':project:'+el.dataset.projectCard.replace(/^task-/,''),el]);
 for(let el of document.querySelectorAll('#allocation-orbital:not(.hidden),#balanceControl:not(.hidden),#storageTargetControl:not(.hidden),.compute-construction'))targets.push([stage+':'+(el.id||'compute-construction'),el]);
 for(let [key,el]of targets){if(noticedContent.has(key))continue;noticedContent.add(key);if(contentNoticesInitialized){if(ANDROID_BUILD)mobileNotice(el,now,key);else contentFlickers.set(el,now);}}
 if(ANDROID_BUILD)mobileNoticeReadyProjects(now,contentNoticesInitialized);contentNoticesInitialized=true;
}
function tickContentFlickers(now){for(let [el,start]of contentFlickers){if(ANDROID_BUILD&&mobile.pending.has(el)){if(el.style.visibility!=="hidden")el.style.visibility="hidden";continue;}if(!el.isConnected||now-start>=1350){el.style.removeProperty('opacity');contentFlickers.delete(el);continue;}let opacity=String(contentFlickerOpacity(now-start));if(el.style.opacity!==opacity)el.style.opacity=opacity;}}

// 把主题颜色留在缓存里，动画就不用每帧查询布局或样式。
const colorPulses=new Map();
let pulseColors={normal:[255,181,46],warning:[250,115,85]};
function setColorPulse(el,active){if(active){if(!colorPulses.has(el))colorPulses.set(el,visualTime);}else if(colorPulses.delete(el))el.style.removeProperty('background-color');}
function pulseColor(elapsed){let mix=(1-Math.cos(2*Math.PI*elapsed/3))/2;return 'rgb('+pulseColors.normal.map((v,i)=>Math.round(v+(pulseColors.warning[i]-v)*mix)).join(', ')+')';}
function tickColorPulses(){for(let [el,start]of colorPulses){if(!el.isConnected){colorPulses.delete(el);continue;}if(!settings.motion){el.style.removeProperty('background-color');continue;}let color=pulseColor(visualTime-start);if(el.style.backgroundColor!==color)el.style.backgroundColor=color;}}
function surfaceHeat(p){return Math.max(0,p.last.thermalOccupancy??p.last.heat??0);}
function surfaceTemperature(p){return (290**4+surfaceHeat(p)/(.9*game.C.sigma*game.C.earthArea))**.25;}
function radiatorTemperatureLimited(p,r){return r.thermalCap<r.thermalTarget*(1-1e-9)&&surfaceHeat(p)>=r.thermalCap*.99;}
function surfaceGrowthLimited(p,r){return !game.has('dyson')&&(p.thermalLimitReached||surfaceHeat(p)>=r.thermalCap*.99);}

const helpPopup=$('contextHelp');let helpOwner=null;
function hideHelp(){if(helpOwner)helpPopup.style.visibility='hidden';helpOwner=null;}
function showHelp(el,p){
 let owner=el?.closest('[data-help]');if(!owner||modalType||modalMotion||pointerRoute){hideHelp();return;}
 if(!owner.dataset.help.trim()){hideHelp();return;}const text=localText(stripNumberMarkup(owner.dataset.help));
 if(owner===helpOwner&&helpPopup.textContent===text)return;
 helpOwner=owner;if(helpPopup.textContent!==text)helpPopup.textContent=text;
 let r=$('crtGlass').getBoundingClientRect(),w=helpPopup.offsetWidth,h=helpPopup.offsetHeight;
 helpPopup.style.left=clamp(p.x-r.left+12,12,r.width-w-12)+'px';helpPopup.style.top=clamp(p.y-r.top+20,12,r.height-h-12)+'px';helpPopup.style.visibility='visible';
}
document.addEventListener('pointermove',e=>{if(!e.isTrusted||ANDROID_BUILD&&e.pointerType==='touch')return;let {el,p}=mappedTarget(e);showHelp(el,p);});
document.addEventListener('focusin',e=>{let r=e.target.getBoundingClientRect();showHelp(e.target,{x:r.left,y:r.bottom});});
document.addEventListener('scroll',e=>{if(helpOwner&&(e.target===document||e.target.contains?.(helpOwner)))hideHelp();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHelp();});
document.addEventListener('focusout',hideHelp);
window.addEventListener('blur',hideHelp);
document.addEventListener('pointerout',e=>{if(ANDROID_BUILD&&e.pointerType==='touch'&&mobile.helpUntil>performance.now())return;if(!e.relatedTarget)hideHelp();});

$('leftColumn').addEventListener('scroll',()=>{if($('leftColumn').scrollLeft)$('leftColumn').scrollLeft=0;});
function renderIndustry(){
 let h=game.state.h,atCap=h.assets>=game.industryCapacity()*(1-1e-12),automated=game.has('automation'),light=game.has('cdzLight'),machines=game.has('cdzMachines'),cdz=game.has('cdz'),mode=[game.has('supply'),cdz,light,machines,automated].join(':'),el=$('industrialReadout');
 if(el.dataset.mode!==mode){
  let facilities='<div class="industry-pair">'+readout(copy('copy.facilities'),'<span id="industrialMass"></span>')+readout(copy('copy.power-supply'),'<span id="industrialPower"></span>')+'</div>';
  let controls='<div id="industrialEconomy"'+(machines?' class="industry-pair"':'')+'>'+(machines?readout(copy('copy.annual-growth'),'<span id="industrialGrowth"></span>'):'')+readout(copy('copy.industry-net-day'),'<span id="industrialIncome"></span>')+'</div>';
  if(light)controls+='<div id="industrialProducts">'+readout(copy('copy.cumulative-supply'),'<span id="industrialProductKg"></span>')+'</div>';
  controls+=!machines?'<div class="industrial-budget-row">'+readout("{{copy.expansion-budget}} <small id=\"industrialBudgetReason\"></small>",'<span id="industrialBudget"></span>')+'<div class="button-row" id="industrialBudgetControls">'+action('industry10',copy('copy.invest-10'))+action('industry50',copy('copy.invest-50'))+action('industryWithdraw',copy('copy.withdraw'))+'</div></div>':'';
  if(machines)controls+='<div id="industrialOperations">'+industrySlider('copy',copy('copy.expansion-share'),100)+'</div>';
  el.innerHTML=localizedHTML("<div class=\"section-head industrial-heading\"><span>{{copy.industry-2}}</span></div><div id=\"industryBuilt\">"+readout(copy('copy.built'),'<span id="industryBuiltValue"></span>')+bar('industryBuiltBar')+'</div>'+facilities+controls+'<div class="solid-rule"></div>');el.dataset.mode=mode;
 }
 const built=clamp(h.assets/game.industryCapacity(),0,1),percent=(built*100).toFixed(1);setHTML('industryBuiltValue',percent+'%');$('industryBuiltBar').style.width=built*100+'%';$('industryBuilt').dataset.help=atCap?localText(copy('copy.humans-set-this-scale-limit-to-prevent-earth')):localText(copy('copy.humans-have-set-the-maximum-scale-of-automated')).replace('{percent}',percent);
 let r=game.cdzStatus();setHTML('industrialMass',kg(h.assets)+(atCap?' <span class="industry-limit" data-help="'+localText(copy('copy.humans-set-this-scale-limit-to-prevent-earth'))+'">'+localText(copy('copy.limit-reached'))+'</span>':''));setHTML('industrialPower',game.has('cdzPower')?wattNumber(r.power):copy('copy.unavailable'));setHTML('industrialIncome',money(r.netIncome));if(machines){setHTML('industrialGrowth',decimalNumber(r.annualGrowth*100,1)+'%');$('industrialGrowth').closest('.readout').dataset.help=copy('copy.annual-facility-growth-estimated-from-the-current-expansion');}
 $('industrialIncome').closest('.readout').dataset.help=copy('copy.income-from-factories-and-the-development-zone-excludes');if(!machines){$('industrialBudget').closest('.industrial-budget-row').dataset.help=copy('copy.funds-for-expanding-factories-spent-gradually-unspent-funds');setHTML('industrialBudget',money(h.industrialBudget));let available=game.industryExpansionQuote().available;setHTML('industrialBudgetReason',!game.has('supply')?copy('copy.requires-automated-supply-chains'):available<1?copy('copy.budget-fully-funded'):h.cash<2?copy('copy.insufficient-funds'):'');disableAction('industry10',available<1||h.cash<10);disableAction('industry50',available<1||h.cash<2);disableAction('industryWithdraw',h.industrialBudget<1);}
 if(machines){$('industrialOperations').classList.toggle('hidden',atCap);if(!atCap){$('industrial-copy').closest('.industry-allocation').dataset.help=copy('copy.the-share-of-capacity-assigned-to-self-expansion');syncInput('industrial-copy',Math.round(h.industrialCopy*100));setHTML('industrial-copy-value',Math.round(h.industrialCopy*100)+'%');}}
 if(light){setHTML('industrialProductKg',kg(h.industrialProductKg));$('industrialProductKg').closest('.readout').dataset.help=copy('copy.total-products-supplied-externally-including-sales-and-free');}
}
function industrySlider(key,title,max){return '<div class="industry-allocation"><div class="readout"><label for="industrial-'+key+'">'+title+'</label><b id="industrial-'+key+'-value"></b></div><input type="range" data-industry="'+key+'" id="industrial-'+key+'" min="0" max="'+max+'" step="1" aria-label="'+title+'"></div>';}
let investmentChartKey='',investmentChartCanvas=null,investmentChartState=null;
function drawInvestmentChart(){
 if(cleanupRemaining()!==null)return;let c=$('investmentChart');if(!c)return;let h=game.state.h,rect=c.getBoundingClientRect(),width=Math.max(160,Math.floor(rect.width)),key=[game.state.stageDays,h.investmentIndex,h.investmentHistory.length,width,visualRGB,settings.lang].join(':');if(key===investmentChartKey&&c===investmentChartCanvas&&h===investmentChartState)return;investmentChartKey=key;investmentChartCanvas=c;investmentChartState=h;
 let points=h.investmentHistory.slice(),current={day:game.state.stageDays,index:h.investmentIndex};if(!points.length||points.at(-1).day<current.day)points.push(current);else points[points.length-1]=current;
 let first=points[0],last=points.at(-1),logs=points.map(p=>Math.log(p.index)-Math.log(first.index)),peak=Math.max(0,...logs),scale=peak>600?peak:0,values=logs.map(v=>Math.expm1(v-scale)),lo=Math.min(Math.expm1(-scale),...values),hi=Math.max(scale?0:.01,...values),span=hi-lo,pad=span*.12;lo-=pad;hi+=pad;
 let density=Math.min(1.5,devicePixelRatio||1),height=86;c.width=Math.round(width*density);c.height=Math.round(height*density);let ctx=c.getContext('2d');ctx.scale(density,density);let x=p=>8+(p.day-first.day)/Math.max(1,last.day-first.day)*(width-16),y=v=>6+(hi-v)/(hi-lo)*(height-17);
 const percent=v=>v>600?num(Math.exp(v%Math.LN10)*100,3)+'e'+Math.floor(v/Math.LN10)+'%':(Math.expm1(v)*100).toFixed(1)+'%';
 ctx.fillStyle=tint(.38);ctx.font='12px "Paperclip Terminal", monospace';ctx.fillText(percent(peak),8,12);ctx.strokeStyle=tint(.15);ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(8,y(Math.expm1(-scale)));ctx.lineTo(width-8,y(Math.expm1(-scale)));ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=tint(.8);ctx.lineWidth=1.4;ctx.beginPath();points.forEach((p,i)=>{i?ctx.lineTo(x(p),y(values[i])):ctx.moveTo(x(p),y(values[i]));});ctx.stroke();ctx.fillStyle=tint(1);ctx.fillRect(Math.round(x(last))-2,Math.round(y(values.at(-1)))-2,4,4);markCanvasPaint(c);
 let delta=logs.at(-1);setHTML('investmentIndexLabel',delta>600?num(Math.exp(delta%Math.LN10)*100,4)+'e'+Math.floor(delta/Math.LN10):num(Math.exp(delta)*100,4,true));const date=p=>{let d=game.dateParts({whole:BigInt(Math.floor(p.day)),frac:0},game.state.calendarStart);return d.year+'-'+String(d.month).padStart(2,'0');};setHTML('investmentChartStart',date(first));setHTML('investmentChartEnd',date(last));
}

function humanLayout(){return section("{{copy.production}}<span id=\"marketHeading\" style=\"display:inline-block\">{{copy.market}}</span>",'',readout(copy('copy.available-funds'),'<span id="cash"></span>','main')+readout(copy('copy.clips-net-day'),'<span id="clipIncome"></span>')+"<div class=\"readout material-row\"><span>{{copy.material}}</span><b id=\"material\"></b>"+'<div class="material-actions">'+action('material',"{{interface.buy}}<span id=\"materialCost\"></span>/<span id=\"materialQuantity\"></span>)",'',copy('copy.the-unit-price-changes-daily'))+action('material10','×10','tiny')+'</div></div>'+readout(copy('copy.unsold-inventory'),'<span id="stock"></span>')+readout(copy('copy.demand'),'<span id="demand"></span>')+"<div class=\"readout\"><span>{{copy.price}}</span><div class=\"inline-input\"><button data-action=\"priceDown\" aria-label=\"{{copy.lower-price}}\">{{interface.text-5}}</button><label>$ <input class=\"price-input\" id=\"priceInput\" type=\"number\" min=\"0.005\" max=\"5\" step=\"0.005\" aria-label=\"{{copy.paperclip-price}}\"></label><button data-action=\"priceUp\" aria-label=\"{{copy.raise-price}}\">{{interface.text-6}}</button></div></div><div class=\"auto-options\"><div id=\"priceAuto\"></div><div id=\"procurementCheck\"></div></div>"+ readout(copy('copy.autoclippers'),'<span id="makers"></span>')+'<div class="button-row market-actions maker-actions">'+action('maker',"{{copy.buy}} <span id=\"makerCost\"></span>")+action('maker10','×10','tiny')+action('maker100','×100','tiny')+'</div>'+readout(copy('copy.marketing-level'),'<span id="marketing"></span>')+'<div class="button-row market-actions">'+action('marketing',"{{copy.marketing}} <span id=\"marketingCost\"></span>")+'</div>')+'<div id="investment"></div>'; }
function hardwareHTML(){if(game.state.stage>1)return industrialHardwareHTML();return section(copy('copy.computing'),'',"<div class=\"trust-pair\" id=\"trustRow\"><span id=\"trustLabel\">{{copy.trust}}</span><b id=\"trust\"></b><span>{{copy.next-at}}</span><b id=\"nextTrust\"></b></div>"+"<div class=\"hardware-pair\"><div class=\"hardware-row\"><span>{{copy.processors}}</span><span><b id=\"processors\"></b><button data-action=\"processorUp\" aria-label=\"{{copy.add-a-processor}}\">{{interface.text-6}}</button></span></div><div class=\"hardware-row\"><span>{{copy.storage-2}}</span><span><b id=\"memory\"></b><button data-action=\"memoryUp\" aria-label=\"{{copy.add-storage}}\">{{interface.text-6}}</button></span></div></div>"+readout(copy('copy.ops'),'<span id="ops"></span> <span class="ops-percent" id="opsPercent"></span>')+bar('opsBar')+'<div class="resource-pair">'+readout(copy('copy.ideas'),'<span id="insight"></span>')+'<div id="yomiReadout"></div></div>');}
function planetLayout(){
 const rows=Object.keys(allocationLabels).map(k=>(k==='battery'?'<div class="solid-rule allocation-divider"></div>':'')+'<div class="surface-allocation" id="allocation-'+k+'">'+(k==='orbital'?'<div id="fixedPV" class="fixed-generation muted micro"></div>':'')+'<div class="readout"><span id="allocation-label-'+k+'">'+allocationLabels[k]+'</span><b id="mass-'+k+'"></b></div><div class="surface-slider"><input data-alloc="'+k+'" id="alloc-'+k+'" type="range" min="0" max="98" step="0.1" aria-label="'+allocationLabels[k]+"{{copy.production-share}}\"><span class=\"allocation-value\"><span>{{copy.allocation}}</span><b id=\"pct-"+k+'"></b></span></div></div>').join('');
 return section(copy('copy.energy'),'',readout(copy('copy.power-generation'),'<span id="power" class="power-summary"></span>')+readout(copy('copy.power-consumption'),'<span id="powerUsed" class="power-summary"></span>')+readout(copy('copy.electricity-storage'),'<span id="storedEnergy"></span>')+bar('storedEnergyBar')+"<div id=\"storageTargetControl\" class=\"readout storage-target hidden\"><span>{{copy.target-charge}}</span><input id=\"storageTarget\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" aria-label=\"{{copy.target-charge}}\"><span id=\"storageTargetValue\"></span></div>")+section(copy('copy.matter'),'','<div class="surface-spec-grid"><div>'+readout(copy('copy.controlled-matter'),'<span id="controlledMatter"></span>')+readout("<span id=\"matterLabel2\">{{copy.raw-material}}</span>",'<span id="raw"></span>')+readout("<span id=\"matterLabel3\">{{copy.paperclips-3}}</span>",'<span id="clipMass"></span>')+'<div id="earthTransferControl" class="readout hidden">'+action('transferToggle',"<span id=\"transferMode\">{{copy.ship-machines}}</span>",'tiny transfer-toggle')+'</div></div><div>'+readout(copy('copy.collection-rate'),'<span id="mineRate"></span>')+readout(copy('copy.manufacturing-rate'),'<span id="buildRate"></span>')+readout(copy('copy.clip-production'),'<span id="surfaceClipRate"></span>')+'<div id="earthTransfer" class="hidden">'+readout(copy('copy.earth-shipments'),'<span id="transferRate"></span>')+'</div></div></div>')+section(copy('copy.production-allocation'),"<span id=\"balanceControl\" class=\"hidden\"><label class=\"check\"><input id=\"autoBalance\" type=\"checkbox\"><span>{{project.auto-balance.name}}</span></label></span>",rows+"<div class=\"readout remelt-control\"><span>{{copy.remelting-queue-for-feedstock-recovery}}</span><b id=\"recycleQueue\"></b></div><div class=\"button-row remelt-actions\">"+action('recycle10',copy('copy.recycle-10-of-clips'),'tiny')+action('recycle50',copy('copy.recycle-50-of-clips'),'tiny')+'</div><div id="equipmentRecovery" class="button-row hidden">'+action('reclaimStorage',copy('copy.recover-10-of-storage'),'tiny')+action('reclaimEquipment',copy('copy.recover-1-of-all-equipment'),'tiny')+'</div>');
}
function surfaceStatusHTML(){return section("<span id=\"planetStatusTitle\">{{copy.surface-conditions}}</span>",'','<div id="coverageReadout">'+readout(copy('copy.surface-pv-coverage'),'<span id="coverage"></span>')+bar('surfaceBar')+'</div>'+'<div id="earthReadout">'+readout(copy('copy.earth-remaining'),'<span id="earthRemaining"></span>')+bar('earthBar')+'</div><div id="solarStocks"></div>'+'<div class="solid-rule"></div><div class="surface-spec-grid"><div><div id="surfaceConditions">'+readout(copy('copy.current-feedstock'),'<span id="currentFeedstock"></span>')+readout(copy('copy.extraction-energy-kg'),'<span id="extractionEnergy"></span>')+readout(copy('copy.manufacturing-energy-kg'),'<span id="fabricationEnergy"></span>')+'</div><div id="launchEnergyReadout" class="hidden">'+readout("<span id=\"launchEnergyLabel\">{{copy.orbital-launch-energy}}</span>",'<span id="launchEnergy"></span>')+'</div>'+readout(copy('copy.equipment-doubling-time'),'<span id="doubling"></span>')+'</div><div>'+readout(copy('copy.energy-system-specific-power'),'<span id="generationSpecific"></span>')+'<div id="groundSpecific">'+readout(copy('copy.harvester-power-kg'),'<span id="harvesterSpecific"></span>')+readout(copy('copy.factory-power-kg'),'<span id="factorySpecific"></span>')+'</div><div id="beamEfficiencyReadout" class="hidden">'+readout("<span id=\"beamEfficiencyLabel\">{{copy.transmission-efficiency}}</span>",'<span id="beamEfficiency"></span>')+'</div>'+readout(copy('copy.current-bottleneck'),'<span id="bottleneck"></span>')+'</div></div>');}
function massPerYear(daily){return kg(daily*game.C.year)+'<span class="micro muted">'+localText(copy('copy.year-2'))+'</span>';}


function industrialHardwareHTML(){const allocation=game.state.stage===2||game.state.stage===3;return section(copy('copy.computing'),'','<div class="resource-pair research-capacity">'+readout(allocation?'<span id="computeAllocation"></span>':copy('copy.available-compute'),'<span id="computingRate"></span>')+readout(allocation?'<span id="memoryAllocation"></span>':copy('copy.storage-capacity'),'<span id="storageCapacity"></span>')+'</div>'+(allocation?"<input id=\"researchMemory\" type=\"range\" min=\"10\" max=\"90\" step=\"1\" aria-label=\"{{copy.storage-allocation}}\">":'')+readout(copy('copy.ops'),'<span id="ops"></span> <span class="ops-percent" id="opsPercent"></span>')+bar('opsBar')+'<div class="resource-pair">'+readout(copy('copy.ideas'),'<span id="insight"></span>')+readout(copy('copy.yomi'),'<span id="industrialYomi"></span>')+'</div>');}


function renderIndustrialHardware(){let s=game.state;if(s.stage===2||s.stage===3){setHTML('computeAllocation',localText(copy('copy.computing-2'))+'(<b class="allocation-percent">'+Math.round((1-s.researchMemory)*100)+'%</b>), '+localText(copy('copy.available-2'))+':');setHTML('memoryAllocation',localText(copy('copy.storage-3'))+'(<b class="allocation-percent">'+Math.round(s.researchMemory*100)+'%</b>), '+localText(copy('copy.available-2'))+':');syncInput('researchMemory',100-s.researchMemory*100);}setHTML('computingRate',computeNumber(game.computeRate()));setHTML('storageCapacity',storageNumber(game.operationsCapacity()));setHTML('ops',storageNumber(s.ops));setHTML('opsPercent','('+Math.min(100,s.ops/Math.max(1,game.operationsCapacity())*100).toFixed(1)+'%)');$('opsBar').style.width=clamp(s.ops/Math.max(1,game.operationsCapacity()),0,1)*100+'%';setHTML('insight',countNumber(s.insight));setHTML('industrialYomi',countNumber(s.yomi));}

function strategyHTML(){return '<div class="solid-rule"></div>'+section(copy('copy.strategy-tournaments'),'<span id="tourneyPeriod"></span>',"<div class=\"strategy-body\"><div id=\"payoffMatrix\"></div><div class=\"strategy-actions\"><div class=\"readout\"><span id=\"strategyLabel\">{{copy.strategy}}</span><select id=\"strategy\">"+['generous','minimax','reciprocal','greedy'].filter(game.tournamentUnlocked).map(key=>'<option value="'+key+'">'+strategyName(key)+'</option>').join('')+'</select></div><div class="strategy-cost" id="tourneyCost"></div><div class="button-row">'+action('prepareTournament',copy('copy.new-tournament'))+action('tournament',copy('copy.run'))+'</div></div></div><div id="autoTourneyCheck"></div><div id="tourneyProgress"><div class="progress-label"><span id="tourneyLabel"></span><span id="tourneyTime"></span></div>'+bar('tourneyBar')+'</div><div class="strategy-footer"><div class="strategy-results" id="tourneyResult"></div></div>');}
function investmentHTML(){return '<div class="solid-rule"></div>'+section(copy('copy.investments'),'',readout(copy('copy.portfolio'),'<span id="portfolio"></span>')+"<div class=\"readout investment-performance\"><span>{{copy.cumulative-return}} <b id=\"investmentProfit\"></b></span><b id=\"investmentYield\"></b></div>"+ "<div class=\"readout\"><span>{{copy.risk}}</span><select id=\"risk\"><option value=\"0\">{{copy.low-4-annual-volatility}}</option><option value=\"1\">{{copy.medium-16-annual-volatility}}</option><option value=\"2\">{{copy.high-32-annual-volatility}}</option><option value=\"3\">{{interface.extreme-annual-volatility-120}}</option></select></div><div class=\"button-row\">"+action('invest10',copy('copy.invest-10'),'tiny')+action('invest50',copy('copy.invest-50'),'tiny')+action('withdraw',copy('copy.withdraw'),'tiny')+"</div><div class=\"readout investment-model\"><span>{{copy.model-level}} <b id=\"investLevel\"></b></span>"+action('upgradeInvestment',"{{copy.improve-model}} <span id=\"investUpgradeCost\"></span>")+"</div><div class=\"investment-chart\"><div class=\"readout\"><span>{{copy.return-index}}</span><b id=\"investmentIndexLabel\"></b></div><canvas id=\"investmentChart\" width=\"320\" height=\"105\" role=\"img\" aria-label=\"{{copy.investment-return-curve}}\"></canvas><div class=\"chart-dates\"><span id=\"investmentChartStart\"></span><span id=\"investmentChartEnd\"></span></div></div>");}
function rebuildLayout(){cleanupUI=null;endingExitQueue.clear();$('manualControl').style.cssText='';$('production').style.removeProperty('visibility');for(const el of document.querySelectorAll('[data-end-until]')){el.classList.remove('end-gone','end-tools-hidden');el.style.removeProperty('opacity');}timeAttentionOpacity=1;$('timeDock').style.removeProperty('--time-attention-opacity');let s=game.state;$('industrialReadout').innerHTML='';delete $('industrialReadout').dataset.mode;document.body.dataset.stage=s.stage;if(screenBackdrop?.ending!==(s.stage===4))updateScreenEffects();document.body.classList.remove('final-hand','clips-end');$('management').classList.remove('hidden');$('gameArea').classList.remove('hidden');$('ending').classList.add('hidden');$('timeDock').classList.remove('hidden');setHTML('manualControl',s.stage===1?action('manual',copy('copy.make-a-paperclip'),'manual'):s.stage===3&&!s.s.automatic?action('launchProbe',copy('copy.launch-probe'),'manual'):'');if(s.stage===1){$('management').innerHTML=humanLayout();$('centralControls').innerHTML=hardwareHTML()+'<div id="strategySection"></div>';}else if(s.stage===2){$('management').innerHTML=planetLayout();$('centralControls').innerHTML=hardwareHTML();$('industrialReadout').innerHTML=surfaceStatusHTML();}else if(s.stage===3){$('management').innerHTML=spaceLayout();$('centralControls').innerHTML=probeStatisticsHTML()+probeBalanceHTML()+hardwareHTML();}else{$('management').innerHTML=endingLayout();$('centralControls').innerHTML=probeStatisticsHTML()+hardwareHTML();initializeEndingUI();} if(s.stage!==4){delete $('timeDock').dataset.endUntil;$('timeDock').classList.remove('end-gone');document.querySelector('.top-tools').classList.remove('end-gone','end-tools-hidden');document.querySelector('.top-tools').style.removeProperty('opacity');delete document.querySelector('.top-tools').dataset.endUntil;$('manualControl').style.cssText='';$('production').style.removeProperty('visibility');$('projects').parentElement.querySelector('.section-head').classList.remove('end-gone');delete $('projects').parentElement.querySelector('.section-head').dataset.endUntil;} $('researchExtras').innerHTML=s.stage===3?'<div id="battleExtras"></div>':'';lastStage=s.stage;lastProjects='';lastRevision=-1;translateRegion($('management'));translateRegion($('centralControls'));translateRegion($('researchExtras'));translateRegion($('industrialReadout'));resizeViz();drawBackground();}
function requirementHTML(text,satisfied){return '<span class="project-requirement'+(satisfied?' satisfied':'')+'">'+text+'</span>';}
function costHTML(d){
 let a=[],c=d.cost,add=(key,text)=>a.push(requirementHTML(text,game.projectCostSatisfied(d,key)));
 if(c.trust)add('trust',num(c.trust,0)+copy('interface.trust'));if(c.cash)add('cash',money(c.cash));if(c.ops)add('ops',storageNumber(c.ops));if(c.insight)add('insight',countNumber(c.insight)+copy('interface.ideas'));if(c.yomi)add('yomi',countNumber(c.yomi)+copy('interface.yomi'));if(c.raw)add('raw',kg(c.raw)+copy('interface.material'));if(c.clips)add('clips',kg(c.clips)+' '+localText(copy('copy.high-purity-metal')));if(c.recycled)add('recycled',kg(c.recycled)+' '+localText(copy('copy.high-purity-metal')));if(c.electricity)add('electricity',siNumber(c.electricity,'J')+' '+localText(copy('copy.electricity-storage')));if(c.credits)add('credits',num(c.credits,0)+copy('interface.trust'));
 return a.join(' · ');
}
function projectConditionsHTML(d,prerequisites){
 let conditions=[],s=game.state,required=game.projectResources(d);
 if(d.id==='scarcity'&&!prerequisites)conditions.push(requirementHTML(localText(copy('copy.complete-the-public-works-projects')),false));
 if(d.gateText)conditions.push(requirementHTML(d.gateText,game.projectConditionReady(d)));
 if(required.mass)conditions.push(requirementHTML(localText(copy('copy.industrial-facilities-at-least'))+' '+kg(required.mass),s.h.assets>=required.mass));
 if(required.power)conditions.push(requirementHTML(localText(copy('copy.minimum-power-supply'))+' '+wattNumber(required.power),game.cdzStatus().power>=required.power));
 if(required.products)conditions.push(requirementHTML(localText(copy('copy.minimum-total-goods-supplied'))+' '+kg(required.products),s.h.industrialProductKg>=required.products));
 return conditions.length?'<br>'+conditions.join('<br>'):'';
}
function publicSupplyAmountHTML(){let h=game.state.h,ratio=h.publicSupplyKg/Math.max(1,h.publicSupplyTarget);return kg(h.publicSupplyKg)+' / '+kg(h.publicSupplyTarget)+' ('+(ratio*100).toFixed(1)+'%)';}
function publicSupplyHTML(){let h=game.state.h;return "<div class=\"progress-label\"><span>{{copy.free-provision}}</span><span>"+publicSupplyAmountHTML()+'</span></div><div class="bar"><i data-project-progress="public-supply"></i></div>'; }
function renderProjects(){let s=game.state,html='';if(s.negotiation){html=negotiationProjectHTML();}else if(s.stage===4){html=endingProjectsHTML();}else{
 let current=game.defs.filter(d=>d.stage===s.stage&&!game.has(d.id)),visible=current.filter(game.visible),tasks=s.tasks.map(t=>({t,d:game.defs.find(d=>d.id===t.id)})).filter(x=>x.d);
 let taskHTML='';for(let {t,d}of tasks)taskHTML+='<article class="project task" data-project-card="task-'+d.id+'"><div class="project-title"><span class="task-arrows"><i>&gt;</i><i>&gt;</i><i>&gt;</i></span>'+projectIcon(d.id)+'<span>'+d.title+'</span></div><div class="project-desc">'+d.desc+'</div><div class="progress-label"><span>'+(d.id==='starflight'?copy('copy.laser-sail-acceleration'):copy('copy.in-progress'))+'</span><span>'+duration(t.remaining)+'</span></div><div class="bar"><i data-project-progress="'+d.id+'"></i></div></article>';
 let index=0;
 for(let d of visible.filter(d=>!s.tasks.some(t=>t.id===d.id)).sort(projectListOrder)){if(d.id==='bribe'&&s.h.bribes)d={...d,title:copy('copy.another-token-of-goodwill'),desc:copy('copy.another-small-gift-for-the-supervisor-1-human')};let prerequisites=d.requires.every(game.has),gate=prerequisites&&d.gate(),ready=gate&&game.costOK(d);let title='<span class="project-marker">*</span>'+projectIcon(d.id)+'<span>'+d.title+'</span>',body='<div class="project-desc">'+d.desc+'</div>'+(d.id==='scarcity'?publicSupplyHTML():'')+'<div class="project-bottom"><span class="cost">'+costHTML(d)+(d.id==='bribe'&&game.bribeWait()>0?"<br>{{copy.remaining}} "+duration(game.bribeWait()):'')+(d.days?'<br>'+(d.stage===2?localText(copy('copy.duration'))+' ':'')+duration(d.days):'')+projectConditionsHTML(d,prerequisites)+'</span><button data-project="'+d.id+'" '+(!ready?'disabled':'')+'>'+(d.id==='aid'?copy('copy.request'):d.id==='bribe'?copy('copy.give'):d.id==='scarcity'?copy('copy.announce'):d.days?copy('copy.start'):copy('copy.research'))+'</button></div>';let afterTasks=d.id!=='scarcity'&&!!taskHTML;if(d.id!=='scarcity'){html+=taskHTML;taskHTML='';}index++;html+='<article class="project '+(ready?'ready':'unavailable')+(!gate?' locked-project':'')+(afterTasks?' after-task':'')+'" data-project-card="'+d.id+'">'+(d.repeatable?foldTitle(d.id,d.title,projectIcon(d.id))+foldBody(d.id,body):'<div class="project-title">'+title+'</div>'+body)+'</article>';}
 html+=taskHTML;
 if(s.stage===1&&game.has('reconfiguration')){let offline=s.h.rebootRemaining>0,body="<div class=\"project-desc\">{{project.reconfiguration.description}}</div><div class=\"project-bottom\"><span class=\"cost\">"+money(game.reconfigurationCost())+(offline?"<br>{{copy.offline}} "+duration(s.h.rebootRemaining):'')+'</span><button data-action="reconfigureAsk" '+(offline?'disabled':'')+">{{copy.reconfigure}}</button></div>";html+='<article class="project utility'+(!index&&tasks.length?' after-task':'')+'" data-project-card="reconfigure">'+foldTitle('reconfigure',copy('project.reconfiguration.name'),projectIcon('reconfiguration'))+foldBody('reconfigure',body)+'</article>';}
 if(!html)html='<div class="empty">'+(current.length?'':copy('copy.all-projects-completed'))+'</div>';setHTML('researchCount','');
 }
 let section=$('projects').closest('.section');section?.classList.toggle('hidden',game.state.stage===1&&!html.includes('data-project-card='));if(html!==lastProjects){let list=$('projects'),translated=localizedHTML(html);if(!patchTextMarkup(list,translated)){let scroll=list.scrollTop,t=document.createElement('template');t.innerHTML=translated;let old=new Map([...list.children].map(el=>[el.dataset.projectCard||'empty',el])),keep=new Set();[...t.content.children].forEach((fresh,i)=>{let key=fresh.dataset.projectCard||'empty',el=old.get(key);if(el&&el.tagName===fresh.tagName)morphNode(el,fresh);else el=fresh;keep.add(el);if(list.children[i]!==el)list.insertBefore(el,list.children[i]||null);});for(let el of [...list.children])if(!keep.has(el))el.remove();list.scrollTop=scroll;rememberTextMarkup(list,translated);drawProjectIcons();}lastProjects=html;tickTaskArrows(performance.now(),true);}
 for(let fill of $('projects').querySelectorAll('[data-project-progress]')){let id=fill.dataset.projectProgress,t=s.tasks.find(t=>t.id===id),ratio=id==='public-supply'?clamp(s.h.publicSupplyKg/Math.max(1,s.h.publicSupplyTarget),0,1):pendingDeparture&&id==='starflight'?1:t?1-t.remaining/t.total:0,width=ratio*100+'%';if(fill.style.width!==width)fill.style.width=width;}
}

function morphNode(a,b){if(a.nodeType===1&&a.hasAttribute('data-cleanup'))return;if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){a.replaceWith(b.cloneNode(true));return;}if(a.nodeType===3){if(a.textContent!==b.textContent)a.textContent=b.textContent;return;}for(let att of [...a.attributes])if(!b.hasAttribute(att.name)&&!(att.name==='style'&&(contentFlickers.has(a)||a.dataset.projectProgress))&&!(att.name==='class'&&a.parentElement?.classList.contains('task-arrows'))&&!(att.name==='data-pressed'&&pressedControls.has(a))&&!(att.name==='data-hit-hover'&&hitHover===a))a.removeAttribute(att.name);for(let att of [...b.attributes])if(a.getAttribute(att.name)!==att.value)a.setAttribute(att.name,att.value);while(a.childNodes.length>b.childNodes.length)a.lastChild.remove();for(let i=0;i<b.childNodes.length;i++){let x=a.childNodes[i],y=b.childNodes[i];if(!x)a.append(y.cloneNode(true));else morphNode(x,y);}}
function setCheckedHTML(id,html){let e=$(id);if(e&&!e.firstChild)e.innerHTML=localizedHTML(html);}
function syncInput(id,v){let e=$(id);if(e&&!e.closest('[data-cleanup]')){if((document.activeElement!==e||(e.dataset.alloc||e.dataset.world||id==='speed')&&pointerRoute?.el!==e)&&(e.type==='number'||e.type==='range'?Number(e.value)!==Number(v):e.value!==String(v))){e.value=v;screenRenderer?.controlChanged(e);}if(e.type==='range')styleRange(e);}}
function speedBounds(){return {min:game.speedMin(),max:game.speedMax()};}
function speedAtPosition(position,bounds=speedBounds()){let {min,max}=bounds;return clamp(position<=0?min:position>=1?max:Math.pow(10,Math.log10(min)+(Math.log10(max)-Math.log10(min))*position),game.speedMin(),game.speedMax());}
function disableAction(id,value){document.querySelectorAll('[data-action="'+id+'"]').forEach(el=>{if(el.disabled!==!!value)el.disabled=!!value;});}
function renderHuman(){renderHumanControls();if(game.has('company'))renderIndustry();if(game.has('game')){setCheckedHTML('strategySection',strategyHTML());renderStrategy();}}
function renderHumanControls(){let s=game.state,h=s.h,r=game.humanRates();$('clipIncome').closest('.readout').dataset.help=copy('copy.paperclip-sales-revenue-less-materials-used-in-production');setHTML('cash',money(h.cash));setHTML('clipIncome',money(h.saleRate*h.price-h.madeRate*r.cost));setHTML('material',kg(h.material));setHTML('stock',countNumber(Math.floor(h.stock))+copy('interface.clips'));setHTML('demand',num(r.demand,3,true)+copy('interface.clips-day'));syncInput('priceInput',h.price.toFixed(3));let quote=game.materialQuote();setHTML('materialQuantity',quote.kg+' kg');setHTML('materialCost',procurementMoney(quote.cost));setHTML('makers',countNumber(h.makers));setHTML('makerCost',money(game.makerCost()));setHTML('marketing',h.marketing);setHTML('marketingCost',money(game.marketingCost()));
 disableAction('priceDown',h.price<=.005);disableAction('priceUp',h.price>=5);disableAction('maker',h.cash<game.makerCost());disableAction('maker10',h.cash<game.makerCost(10));disableAction('maker100',h.cash<game.makerCost(100));disableAction('marketing',h.cash<game.marketingCost());disableAction('material',!quote.affordable);disableAction('material10',!game.materialQuote(10).affordable);updateManualState();
 if(game.has('procurement')){setCheckedHTML('procurementCheck',"<label class=\"check\"><input id=\"autoBuy\" type=\"checkbox\"> {{copy.auto-buy-feedstock}}</label>");$('autoBuy').checked=h.autoBuy;}
 if(game.has('pricing')){setCheckedHTML('priceAuto',"<label class=\"check\"><input id=\"autoPrice\" type=\"checkbox\"> {{copy.adjust-price-daily}}</label>");$('autoPrice').checked=h.autoPrice;}
 if(game.has('market')){setCheckedHTML('investment',investmentHTML());setHTML('portfolio',money(h.portfolio));let marketFull=h.portfolio>=game.investmentCapacity();disableAction('invest10',h.cash<1||marketFull);disableAction('invest50',h.cash<1||marketFull);setHTML('investmentProfit',money(h.investmentProfit));let expected=h.portfolio<=0,quotedCapital=expected?game.investmentQuote(.5).capital:h.portfolio,rates=game.investmentRates(h.risk,quotedCapital),yieldText=(quotedCapital>0?rates.annualYield*100:0).toFixed(2)+localText(copy('copy.year'));setHTML('investmentYield',(expected?localText(copy('copy.expected'))+' ':'')+yieldText);$('investmentYield').dataset.help=expected?localText(copy('copy.estimated-using-a-50-investment-of-available-cash'))+' '+money(quotedCapital):localText(copy('copy.current-annualized-return'));syncInput('risk',h.risk);drawInvestmentChart();setHTML('investLevel',num(h.investLevel,0));setHTML('investUpgradeCost','('+countNumber(game.investmentUpgradeCost())+copy('interface.yomi-2'));disableAction('upgradeInvestment',s.yomi<game.investmentUpgradeCost());$('portfolio').dataset.help=(expected?localText(copy('copy.estimated-using-a-50-investment-of-available-cash'))+' '+money(quotedCapital):localText(copy('copy.current-annualized-return')))+' '+yieldText+' · '+localText(copy('copy.annual-volatility'))+' '+(rates.vol*100).toFixed(2)+'%';for(let [i,option]of [...$('risk').options].entries()){let label=localText([copy('interface.text-7'),copy('interface.text-8'),copy('interface.text-9'),copy('interface.text-10')][i]+copy('interface.annual-volatility'))+' '+(game.investmentRates(i,quotedCapital).vol*100).toFixed(2)+'%';if(option.textContent!==label)option.textContent=label;}}
}
function renderHardware(){if(game.state.stage>1){renderIndustrialHardware();return;}let s=game.state,total=game.trustTotal(),unused=total-s.processors-s.memory;setHTML('trustLabel',s.stage===1?copy('copy.trust'):copy('copy.available'));setHTML('trust',num(total,0)+'<small class="trust-unused">('+num(unused,0)+')</small>');setHTML('nextTrust',game.has('automation')?kg(s.h.industrialTrustNext)+' '+localText(copy('copy.products')):countNumber(Math.ceil(s.h.trustNext))+' '+localText(copy('copy.paperclips-2')));setHTML('processors',computeNumber(s.processors*game.processorRatedRate())+' <small class="allocation-count">('+s.processors+')</small>');setHTML('memory',memoryNumber(s.memory)+' <small class="allocation-count">('+s.memory+')</small>');$('processors').dataset.help=s.processors+' × '+computeNumber(game.processorRatedRate());$('memory').dataset.help=s.memory+' × '+memoryNumber(1);setHTML('ops',storageNumber(s.ops));setHTML('opsPercent','('+Math.min(100,s.ops/game.operationsCapacity()*100).toFixed(1)+'%)');$('ops').dataset.help=localText(copy('copy.available-compute'))+': '+computeNumber(game.computeRate());if($('opsBar'))$('opsBar').style.width=clamp(s.ops/game.operationsCapacity(),0,1)*100+'%';setHTML('insight',game.has('creative')?countNumber(s.insight):copy('copy.unavailable'));setHTML('yomiReadout',game.has('game')?readout(copy('copy.yomi'),countNumber(s.yomi)):'');disableAction('processorUp',unused<1);disableAction('memoryUp',unused<1);}
let tournamentTraceKey='',tournamentDisplayTrace=[],tournamentHighlightAt=-Infinity;
function resetTournamentHighlights(){tournamentTraceKey='';tournamentDisplayTrace=[];tournamentHighlightAt=-Infinity;for(let cell of document.querySelectorAll('#payoffMatrix .payoff-grid b[data-active]'))cell.removeAttribute('data-active');}
function tickTournamentHighlights(now){
 if($('strategySection')?.hasAttribute('data-cleanup'))return;
 let s=game.state,t=s.h.tournament,preview=game.tournamentPreview();
 if(s.stage!==1||!t||t.phase!=='running'||!preview){if(tournamentTraceKey)resetTournamentHighlights();return;}
 if(s.paused||modalType||modalMotion||document.hidden||now-tournamentHighlightAt<1000/60)return;
 tournamentHighlightAt=now;let key=s.h.wins+':'+preview.matrix.join(',');if(key!==tournamentTraceKey){tournamentTraceKey=key;tournamentDisplayTrace=game.tournamentTrace(preview.matrix);}
 let progress=clamp(1-t.remaining/t.total,0,1),selected=Math.floor(now/50)%2===0?tournamentDisplayTrace[Math.min(tournamentDisplayTrace.length-1,Math.floor(progress*tournamentDisplayTrace.length))]:-1;
 for(let [i,cell]of [...document.querySelectorAll('#payoffMatrix .payoff-grid b')].entries()){let active=i===selected;if(active!==cell.hasAttribute('data-active'))active?cell.setAttribute('data-active',''):cell.removeAttribute('data-active');}
}

function renderStrategy(){if($('strategySection')?.hasAttribute('data-cleanup'))return;let h=game.state.h,t=h.tournament,rates=game.tournamentRates(),running=t?.phase==='running',preview=game.tournamentPreview(),matrix=preview?.matrix;const options=['generous','minimax','reciprocal','greedy'].filter(game.tournamentUnlocked).map(key=>'<option value="'+key+'">'+strategyName(key)+'</option>').join('');setHTML('strategy',options);syncInput('strategy',preview?.strategy||h.strategy);$('strategy').disabled=game.has('sampling');setHTML('strategyLabel',game.has('sampling')?copy('project.sampling.name'):running?copy('copy.next-round'):copy('copy.strategy'));$('strategyLabel').dataset.help=$('payoffMatrix').dataset.help=localText(copy('copy.the-payoff-matrix-previews-the-next-round-once'));
 setHTML('payoffMatrix',matrix?"<div class=\"payoff-grid\" aria-label=\"{{copy.payoff-matrix}}\"><span></span><span>A</span><span>B</span><span>A</span><b>"+matrix[0]+' / '+matrix[0]+'</b><b>'+matrix[1]+' / '+matrix[2]+'</b><span>B</span><b>'+matrix[2]+' / '+matrix[1]+'</b><b>'+matrix[3]+' / '+matrix[3]+"</b></div><div class=\"micro muted\">{{copy.your-payoff-opponent-s-payoff}}</div>":'');
 setHTML('tourneyPeriod',Number.isFinite(rates.days)?duration(rates.days)+copy('interface.round'):copy('copy.offline'));$('tourneyProgress').hidden=!running;setHTML('tourneyLabel',copy('copy.tournament-in-progress')+(running?' · '+strategyName(t.strategy):''));setHTML('tourneyTime',running?(rates.speed>0?duration(t.remaining/rates.speed):copy('copy.offline')):'');$('tourneyBar').style.width=running?(1-t.remaining/t.total)*100+'%':'0';setHTML('tourneyCost',storageNumber(game.tournamentCost()));disableAction('prepareTournament',!!t||game.state.ops<game.tournamentCost());disableAction('tournament',!t||!!running);
 if(game.has('autoTourney')){setCheckedHTML('autoTourneyCheck',"<label class=\"check\"><input id=\"autoTourney\" type=\"checkbox\"> {{copy.auto-repeat-tournaments}}</label>");$('autoTourney').checked=h.autoTourney;}
 let result=h.lastTournament;setHTML('tourneyResult',result?(result.rank?copy('interface.rank')+result.rank+' / 4 · ':'')+copy('interface.last-round')+result.gain+copy('interface.yomi'):'');
}
function renderPlanet(){
 let s=game.state,p=s.p,u=p.swarm,r=game.planetRates(),l=p.last,spec=game.surfaceSpecs();
 let solar=game.has('dyson'),ion=game.has('ion'),orbital=game.has('chemicalLaunch'),deposit=solar?game.swarmDeposit():game.surfaceDeposit();
 renderPlanetControls(s,p,u,r,l,spec,solar,ion,orbital,deposit);renderPlanetStatus(s,p,u,r,l,spec,solar,ion,orbital,deposit);
}
function renderPlanetControls(s,p,u,r,l,spec,solar,ion,orbital,deposit){
 for(let k in allocationLabels){
  let element=$('allocation-'+k),show=k==='pv'?!orbital&&!solar:k==='orbital'?orbital:true;
  element.classList.toggle('hidden',!show);if(!show)continue;
  let label=k==='clips'?(solar&&!ion?copy('copy.paperclips-dyson-swarm-high-purity-metal-stock'):allocationLabels[k]):solar?(k==='orbital'?copy('copy.solar-power-stations'):k==='harvester'?(ion?copy('copy.laser-mining-apparatus'):copy('copy.harvesters')):allocationLabels[k])+(ion?'':copy('interface.dyson-swarm')):allocationLabels[k];
  setHTML('allocation-label-'+k,label);
  let mass=k==='clips'?(solar?u.clips:s.clipsKg):solar?u[k==='orbital'?'pv':k]:p[k];setHTML('mass-'+k,kg(mass));
  let locked=!solar&&['pv','orbital','harvester','factory'].includes(k)&&p[k]>=game.groundTargets()[k]*(1-1e-12);
  let control=$('alloc-'+k),accessible=localText(label)+' · '+localText(copy('copy.production-share'));if(control.getAttribute('aria-label')!==accessible)control.setAttribute('aria-label',accessible);
  control.disabled=locked;syncInput('alloc-'+k,p.alloc[k]*100);setHTML('pct-'+k,(p.alloc[k]*100).toFixed(1)+'%');
 }
 setHTML('fixedPV',solar?localText(copy('copy.material'))+' '+kg(u.raw):orbital?localText(copy('copy.surface-pv'))+' '+kg(p.pv):'');
 const balanceUnlocked=game.has('autoBalance'),storedPercent=(p.charge+p.swarm.charge)/Math.max(1,r.storage)*100;
 $('storedEnergyBar').style.width=clamp(storedPercent,0,100)+'%';$('storedEnergyBar').parentElement.classList.toggle('hidden',balanceUnlocked);
 $('balanceControl').classList.toggle('hidden',!balanceUnlocked);$('storageTargetControl').classList.toggle('hidden',!balanceUnlocked);
 let balancingAvailable=game.autoBalanceAvailable();$('autoBalance').disabled=!balancingAvailable;$('autoBalance').checked=balancingAvailable&&p.autoBalance;
 $('balanceControl').dataset.help=balancingAvailable?'':localText(copy('copy.requires-advanced-logistics-balancing'));$('storageTarget').disabled=!balancingAvailable;
 syncInput('storageTarget',p.storageTarget*100);$('storageTarget').dataset.actualFill=String(storedPercent);styleRange($('storageTarget'));setHTML('storageTargetValue',(p.storageTarget*100).toFixed(0)+'%');
 setHTML('controlledMatter',kg(game.groundMatter()+game.swarmMatter()+s.reservedKg));
 setHTML('matterLabel2',solar&&!ion?copy('copy.surface'):copy('copy.raw-material'));setHTML('matterLabel3',solar&&!ion?copy('copy.dyson-swarm'):copy('copy.paperclips-3'));
 setHTML('raw',kg(solar?(ion?u.raw:game.groundMatter()):p.raw));setHTML('clipMass',kg(solar&&!ion?game.swarmMatter():s.clipsKg));
 $('raw').closest('.readout').classList.toggle('muted',solar&&!ion);let queue=solar?u.recycle:p.recycle,clips=solar?u.clips:s.clipsKg;
 const recovery=solar?u:p;$('equipmentRecovery').classList.remove('hidden');disableAction('reclaimStorage',recovery.battery<=0);disableAction('reclaimEquipment',recovery.pv+recovery.harvester+recovery.factory+recovery.battery+(solar?0:p.orbital)<=0);setHTML('recycleQueue',kg(queue));disableAction('recycle10',clips<=queue);disableAction('recycle50',clips<=queue);
 $('allocation-clips').dataset.help=localText(copy('copy.paperclips-also-serve-as-high-purity-metal-stock'));
 setHTML('mineRate',massPerYear(l.mineRate||0));setHTML('buildRate',massPerYear(l.buildRate||0));setHTML('surfaceClipRate',countNumber((l.clipRate||0)/s.clipUnit*game.C.year)+localText(copy('copy.year-2')));
 setHTML('power','<span>'+wattNumber(r.power)+' <span class="kardashev">(K'+r.kardashev.toFixed(2)+')</span></span>'+((solar&&!ion)||orbital&&!solar?'<span>/'+localText(solar?copy('copy.dyson-swarm'):copy('copy.orbit'))+' '+wattNumber(solar?r.freeSpacePower:r.beamed)+'</span>':''));
 setHTML('powerUsed','<span>'+wattNumber(l.powerUsed||0)+'</span>'+(solar&&!ion?'<span>/'+localText(copy('copy.dyson-swarm'))+' '+wattNumber(l.spacePowerUsed||0)+'</span>':''));$('powerUsed').closest('.readout').dataset.help=orbital&&!ion?localText(solar?copy('copy.orbital-transfer'):copy('copy.launch-electricity'))+' '+stripNumberMarkup(wattNumber(l.launchPower||0)):'';
 let charge=p.charge+u.charge;setHTML('storedEnergy',siNumber(charge,'J')+' ('+(r.storage?charge/r.storage*100:0).toFixed(1)+'%)');
 $('storedEnergy').closest('.readout').dataset.help=(l.chargeRate?localText(l.chargeRate>0?copy('copy.charging'):copy('copy.discharging'))+' '+stripNumberMarkup(wattNumber(Math.abs(l.chargeRate))):localText(copy('copy.idle')));
 for(let id of ['earthTransfer','earthTransferControl'])$(id).classList.toggle('hidden',!solar||ion);setHTML('transferRate',massPerYear(l.transferRate||0));setHTML('transferMode',p.transferMode==='raw'?copy('copy.ship-feedstock'):copy('copy.ship-machines'));let transferButton=document.querySelector('[data-action="transferToggle"]');transferButton.disabled=p.transferMode==='devices'&&!game.canTransferRaw();transferButton.dataset.help=transferButton.disabled?localText(copy('copy.space-photovoltaics-and-fabrication-equipment-are-required')):'';
 $('buildRate').closest('.readout').dataset.help=localText(copy('copy.material'))+' '+stripNumberMarkup(massPerYear(l.rawUsedRate||0))+((l.recycleRate||0)>0?' · '+localText(copy('copy.paperclips'))+' '+stripNumberMarkup(massPerYear(l.recycleRate)):'' );
 $('mineRate').closest('.readout').dataset.help=solar&&!ion?localText(copy('project.asteroids.name'))+' '+stripNumberMarkup(massPerYear(l.localMineRate||0))+' · '+localText(copy('copy.earth-shipments'))+' '+stripNumberMarkup(massPerYear(l.transferRate||0)):'';
}
function renderPlanetStatus(s,p,u,r,l,spec,solar,ion,orbital,deposit){
 setHTML('planetStatusTitle',solar?copy('copy.solar-system'):copy('copy.surface-conditions'));
 let full=r.coverage>=1-1e-12||game.has('receivers'),capacity=$('coverageReadout'),mode=solar?'solar':full?'thermal':'pv';
 if(capacity.dataset.mode!==mode){setHTML('coverageReadout',solar?readout(copy('copy.dyson-coverage'),'<span id="solarCoverage"></span>')+bar('solarBar'):full?readout(copy('copy.surface-heat-rejection-capacity'),'<span id="surfaceThermal"></span>')+bar('surfaceThermalBar'):readout(copy('copy.surface-pv-coverage'),'<span id="coverage"></span>')+bar('surfaceBar'));capacity.dataset.mode=mode;}
 if(solar){setHTML('solarCoverage',coveragePercent(r.solarCoverage));$('solarBar').style.width=r.solarCoverage*100+'%';delete capacity.dataset.help;}
 else if(full){let heat=surfaceHeat(p),percent=clamp(heat/r.thermalTarget,0,1)*100;setHTML('surfaceThermal',wattNumber(heat)+' / '+wattNumber(r.thermalTarget)+' ('+percent.toFixed(1)+'%)');$('surfaceThermalBar').style.width=percent+'%';let limited=radiatorTemperatureLimited(p,r);setColorPulse($('surfaceThermalBar'),limited);capacity.dataset.help=limited?localText(copy('copy.the-current-radiators-cannot-withstand-the-required-temperature')):localText(copy('copy.radiator-temperature'))+' '+p.temperature+' K · '+localText(copy('copy.current-capacity'))+' '+stripNumberMarkup(wattNumber(r.thermalCap));}
 else{setHTML('coverage',(r.coverage*100).toFixed(2)+'%');$('surfaceBar').style.width=r.coverage*100+'%';delete capacity.dataset.help;}
 $('earthReadout').classList.toggle('hidden',!ion||p.earth===0||p.worldMining||game.has('starLifting'));setHTML('earthRemaining',remainingMass(p.earth,game.C.earth,true));$('earthBar').style.width=clamp(p.earth/game.C.earth,0,1)*100+'%';
 let stocks=solar&&!ion?readout(copy('copy.asteroid-belt-remaining'),remainingMass(p.asteroids,game.C.asteroids))+bar('asteroidBar'):p.worldMining&&!game.has('starLifting')?worldControlsHTML():game.has('starLifting')?readout(copy('copy.sun-remaining'),remainingMass(p.sunRemaining,game.C.sunMass))+bar('sunBar')+readout(copy('project.star-lifting.name'),kg(p.stellarCoil))+readout(copy('copy.light-elements'),kg(p.lightRaw)):'';
 setHTML('solarStocks',stocks);if(p.worldMining&&!game.has('starLifting'))for(const key in p.worlds)syncInput('world-input-'+key,p.worldAlloc[key]*100);if($('asteroidBar'))$('asteroidBar').style.width=p.asteroids/game.C.asteroids*100+'%';for(let key in p.worlds)if($('world-'+key))$('world-'+key).style.width=p.worlds[key]/PaperclipModel.SOLAR.worlds[key]*100+'%';if($('sunBar'))$('sunBar').style.width=p.sunRemaining/game.C.sunMass*100+'%';
 let remelting=(l.recycleRate||0)>0,feed=remelting?copy('copy.paperclips'):{biomass:copy('copy.ruins-and-biomass'),rich:copy('copy.ores-and-fluid-phases'),rock:copy('copy.low-grade-rock'),asteroids:copy('copy.asteroids'),earth:copy('interface.text-11'),worlds:copy('copy.rocky-bodies'),star:copy('copy.stellar-material'),none:copy('copy.unavailable')}[deposit.kind];
 setHTML('currentFeedstock',feed);setHTML('extractionEnergy',siNumber(deposit.energy,'J/kg'));setHTML('fabricationEnergy',siNumber(remelting?PaperclipModel.SURFACE.remeltE:solar?p.spaceFabricationE:p.fabricationE,'J/kg'));
 setHTML('harvesterSpecific',wattNumber(solar?game.miningSpecific():spec.harvester)+'/kg');setHTML('factorySpecific',wattNumber(solar?game.swarmFactorySpecific():spec.factory)+'/kg');
 let generationSpecific=solar?game.newSolarSpecific():orbital?p.specific*game.orbitalSolarEfficiency()/.25*game.beamEfficiency():r.surfaceSolar/Math.max(1,p.pv);setHTML('generationSpecific',wattNumber(generationSpecific)+'/kg');
 $('generationSpecific').closest('.readout').dataset.help=solar?copy('copy.rated-photovoltaic-power-per-unit-mass'):orbital?copy('copy.rated-delivered-power-per-unit-orbital-mass'):copy('copy.mean-available-power-per-mass-of-generation-equipment');
 $('launchEnergyReadout').classList.toggle('hidden',!orbital||ion);setHTML('launchEnergyLabel',solar?copy('copy.orbital-transfer-energy'):copy('copy.orbital-launch-energy'));setHTML('launchEnergy',siNumber(game.launchSystem().energy,'J/kg'));
 let fleet=solar?game.swarmEquipment():game.equipmentMass()-(full?p.pv:0);setHTML('doubling',(solar?r.solarCoverage<1-1e-12:!surfaceGrowthLimited(p,r))&&l.equipRate>0?duration(Math.LN2*fleet/l.equipRate):'-');
 setHTML('bottleneck',!solar&&full&&!orbital?copy('copy.surface-area'):l.bottleneck||copy('copy.manufacturing-capacity'));
 $('beamEfficiencyReadout').classList.toggle('hidden',!game.has('receivers')||solar&&!ion);setHTML('beamEfficiencyLabel',ion?copy('copy.laser-efficiency'):copy('copy.transmission-efficiency'));setHTML('beamEfficiency',((ion?game.laserMiningEfficiency():r.beamEfficiency)*100).toFixed(1)+'%');

}
function worldControlsHTML(){
 const p=game.state.p,names={mercury:copy('copy.mercury'),venus:copy('copy.venus'),mars:copy('copy.mars'),others:copy('copy.moons-and-minor-bodies')};
 return Object.entries(PaperclipModel.SOLAR.worlds).map(([key,mass])=>{
  const percent=(p.worldAlloc[key]*100).toFixed(0),title=localText(copy('copy.extraction-energy-per-kilogram'))+' '+stripNumberMarkup(siNumber(game.worldMiningEnergy(key),'J/kg'));
  return '<div class="world-row" data-help="'+title+'"><div class="world-control"><span>'+localText(names[key])+'</span><b>'+percent+'%</b><input class="world-power" data-world="'+key+'" id="world-input-'+key+'" type="range" min="0" max="100" step="1" value="'+percent+'" aria-label="'+localText(names[key])+' '+localText(copy('copy.applied-power'))+'" style="--fill:'+percent+'%" '+(p.worlds[key]===0||Object.values(p.worlds).filter(n=>n>0).length===1?'disabled':'')+'></div><div class="world-stock">'+readout('',remainingMass(p.worlds[key],mass))+bar('world-'+key)+'</div></div>';
 }).join('');
}


function render(){let s=game.state;if(s.ending==='virtual'){renderEnding();return;}if(lastStage===1&&s.stage===2&&!screenTransition)startScreenTransition();if(lastStage===2&&s.stage===3&&!screenTransition)startDepartureTransition();if(lastStage===3&&s.stage===4&&!screenTransition)startEndingTransition();if(lastStage!==s.stage)rebuildLayout();renderClipCount();setHTML('countLabel',copy('copy.total-paperclips'));if(productionStage!==s.stage){productionSamples=[];productionStage=s.stage;productionValue=productionBaseline=currentProductionEstimate();}updateProduction(0,performance.now());if(s.stage===1)renderHuman();else if(s.stage===2)renderPlanet();else if(s.stage===3)renderSpace();else renderDismantle();if(s.stage<4)renderHardware();renderProjects();noticeNewContent();renderClock();renderJournal();updateVizLabels();tickCleanupUI();dirtySave=true;lastRevision=s.revision;if(screenTransition&&!screenTransition.prepared){drawViz();screenTransition.prepared=true;screenRenderer?.invalidate();}}
let clockTextAt=-Infinity,clockControlKey='';
function renderClock(){const now=performance.now();renderClockMotion();if(now-clockTextAt<1000/UI_CONFIG.textFPS)return;clockTextAt=now;let s=game.state;document.body.classList.toggle('paused',s.paused);let displayClock={...s.clock};if(pendingPhysicsDays>0&&!s.paused&&!document.hidden&&!modalType&&!modalMotion)PaperclipModel.clockAdd(displayClock,pendingPhysicsDays);let d=game.dateParts(displayClock);setHTML('clockDate',copy('interface.a-d')+calendarYear(d.year)+(d.year<100000n?'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0'):''));setHTML('clockTime',d.year>=100000n?'':[d.hour,d.minute,d.second].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(d.ms).padStart(3,'0'));$('clockDate').dataset.help=fullDate(displayClock);const controlKey=[s.paused,s.speed,settings.lang].join(':');if(controlKey!==clockControlKey){clockControlKey=controlKey;setHTML('pause',s.paused?'<span class="play-symbol"></span>':'<span class="pause-symbol"><i></i><i></i></span>');$('pause').setAttribute('aria-pressed',String(s.paused));$('pause').setAttribute('aria-label',localText(s.paused?copy('copy.resume-time'):copy('copy.pause-time')));$('pause').dataset.help=localText(s.paused?copy('copy.continue'):copy('copy.pause'))+copyLocalized('interface.space');setHTML('speedValue',rateTime(s.speed));$('speed').setAttribute('aria-valuetext',localText(rateTime(s.speed)));}renderCleanupPopulation();}
function renderClockMotion(){const s=game.state;let max=game.speedMax();s.speed=clamp(s.speed,game.speedMin(),max);const actual=game.effectiveSpeed();let {min,max:trackMax}=pointerRoute?.timeScale||speedBounds();let v=(Math.log10(Math.max(min,s.speed))-Math.log10(min))/(Math.log10(trackMax)-Math.log10(min))*1000;const fill=String((Math.log10(Math.max(min,actual))-Math.log10(min))/(Math.log10(trackMax)-Math.log10(min))*100);if($('speed').dataset.actualFill!==fill)$('speed').dataset.actualFill=fill;syncInput('speed',v);renderSpeedTicks(min,max);}
function renderJournal(){
 let s=game.state,signature=(saveNotice?saveNotice.day+':'+saveNotice.frac+':'+saveNotice.text:'')+'|'+s.logs.map(x=>x.day+':'+x.frac+':'+x.text).join('|');if(signature===lastJournal)return;
 let journal=$('journal'),rows=s.logs.slice(0,180).reverse(),scroll=journal.scrollTop;
 if(saveNotice){let day=BigInt(saveNotice.day),index=rows.indexOf(saveNotice.after);index=index>=0?index+1:rows.findIndex(l=>BigInt(l.day)>day||BigInt(l.day)===day&&l.frac>saveNotice.frac);rows.splice(index<0?rows.length:index,0,saveNotice);if(rows.length>180)rows.shift();}
 let following=!journalEntries.some(l=>s.logs.includes(l))||!journalScrollMotion&&journal.scrollHeight-journal.clientHeight-scroll<=1,retained=new Set(rows),top=journal.getBoundingClientRect().top;
 let anchorIndex=following?-1:journalEntries.findIndex((l,i)=>retained.has(l)&&journal.children[i]?.getBoundingClientRect().bottom>top),anchorTop=anchorIndex<0?0:journal.children[anchorIndex].getBoundingClientRect().top;
 setHTML('journal',rows.map(l=>{
  // 存档会保存已经滚过的字幕，片名仍按当前语言显示。
  const text=l.credit&&(l.text===GAME_NAME.en||l.text==='Universal Paperclips')?GAME_NAME[settings.lang]:l.text;
  const date=l.credit?'':'<time data-help="'+escapeHTML(fullDate({whole:BigInt(l.day),frac:l.frac}))+'">'+shortDate({whole:BigInt(l.day),frac:l.frac})+'</time>';
  return '<div class="journal-line"'+(l.credit?' data-ending-credit':'')+'>'+date+'<span'+(text.includes('\n')?' data-multiline':'')+
   ' data-help="'+escapeHTML(text)+'">'+escapeHTML(text)+'</span></div>';
 }).join(''));
 if(following){resetJournalScroll();journal.scrollTop=Math.max(0,journal.scrollHeight-journal.clientHeight);}
 else if(anchorIndex>=0)shiftJournalScroll(journal,journal.children[rows.indexOf(journalEntries[anchorIndex])].getBoundingClientRect().top-anchorTop,scroll);
 else{resetJournalScroll();journal.scrollTop=0;}
 journalEntries=rows;lastJournal=signature;
}
function renderEnding(){renderClipCount();let s=game.state;document.body.classList.remove('final-hand');document.body.classList.toggle('clips-end',s.ending==='clips');$('gameArea').classList.add('hidden');$('timeDock').classList.add('hidden');$('ending').classList.remove('hidden');let html="<div class=\"big-number phosphor\" style=\"font-size:24px\">{{copy.virtual-world}}</div><div class=\"ending-caption\">{{copy.the-simulation-has-begun}}</div><div class=\"button-row\">"+action('virtualRestart',copy('copy.start-over'),'tiny')+'</div>';if($('ending').dataset.ending!==s.ending){$('ending').innerHTML=localizedHTML(html);$('ending').dataset.ending=s.ending;closeModal();save();}setHTML('topCode',s.ending==='clips'?'':copy('viz.simulation-code'));}
function fieldNotes(){return "<table class=\"keyboard-guide\"><tr><td>{{copy.space}}</td><td>{{copy.pause-resume}}</td></tr><tr><td>M</td><td>{{copy.make-one-paperclip}}</td></tr><tr><td>← / →</td><td>{{copy.adjust-time-speed-tenfold}}</td></tr><tr><td>{{copy.arrows-on-the-main-view}}</td><td>{{copy.rotate-the-view}}</td></tr><tr><td>{{copy.home-on-the-main-view}}</td><td>{{copy.reset-the-view}}</td></tr><tr><td>Tab / Shift+Tab</td><td>{{copy.move-focus}}</td></tr><tr><td>Enter</td><td>{{copy.use-the-focused-control}}</td></tr><tr><td>↑ / ↓</td><td>{{copy.choose-a-menu-item}}</td></tr><tr><td>Home / End</td><td>{{copy.first-last-menu-item}}</td></tr><tr><td>Esc</td><td>{{copy.close-menu-go-back}}</td></tr></table>";}

let modalMotion=null,modalPresentation={shade:0,reveal:0,changed:false};
const modalEase=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function finishModalClose(){modalMotion=null;modalPresentation={shade:0,reveal:0,changed:true};$('modalRoot').innerHTML='';oldFocus?.focus?.();}
function beginModalMotion(opening){
 const root=$('modalRoot');root.inert=false;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){modalMotion=null;modalPresentation={shade:opening?1:0,reveal:opening?1:0,changed:true};if(!opening)finishModalClose();return;}
 modalMotion={opening,start:null,shade:modalPresentation.shade,reveal:opening?0:modalPresentation.reveal};
 if(opening)modalPresentation={shade:modalPresentation.shade,reveal:0,changed:true};else root.inert=true;
 updateModalFallback();
}
function updateModalFallback(){
 const backdrop=$('modalBackdrop'),panel=backdrop?.querySelector('.modal');if(!panel)return;
 if(screenRenderer&&screenRenderer.mode!=='browser'){backdrop.style.background='';panel.style.clipPath='';return;}
 backdrop.style.background='rgba(0,0,0,'+(.83*modalPresentation.shade)+')';panel.style.clipPath='inset(0 0 '+((1-modalPresentation.reveal)*100)+'% 0)';
}
function tickModalMotion(now){
 if(!modalMotion)return;
 if(modalMotion.start===null){if(screenRenderer&&screenRenderer.mode!=='browser'&&!screenRenderer.modalReady)return;modalMotion.start=now;}
 const m=modalMotion,elapsed=Math.max(0,now-m.start),dimMS=m.opening?150:120,scanMS=m.opening?280:180;
 if(m.opening){modalPresentation.shade=m.shade+(1-m.shade)*modalEase(elapsed/dimMS);modalPresentation.reveal=modalEase((elapsed-dimMS)/scanMS);}
 else{modalPresentation.reveal=m.reveal*(1-modalEase(elapsed/scanMS));modalPresentation.shade=m.shade*(1-modalEase((elapsed-scanMS)/dimMS));}
 modalPresentation.changed=true;updateModalFallback();
 if(elapsed>=dimMS+scanMS){if(m.opening){modalMotion=null;modalPresentation.shade=modalPresentation.reveal=1;}else finishModalClose();}
}

function openModal(type){flushSimulationTime();if(!['display','save','guide','log','release','reset','reconfigure'].includes(type))return;oldFocus=document.activeElement;modalType=type;$('modalRoot').innerHTML='<div class="modal-backdrop" id="modalBackdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="'+({display:copy('copy.settings'),save:copy('copy.save'),guide:copy('copy.guide'),log:copy('copy.log'),release:copy('project.release.name'),reset:copy('copy.start-over'),reconfigure:copy('project.reconfiguration.name')}[type]||type)+"\"><header class=\"modal-head\"><span id=\"modalTitle\"></span><button class=\"ghost tiny\" data-action=\"closeModal\" aria-label=\"{{copy.close}}\">{{interface.text-12}}</button></header><div id=\"modalContent\"></div></section></div>";translateRegion($('modalRoot'));renderModal();beginModalMotion(true);$('modalRoot').querySelector('button')?.focus();}
function closeModal(){modalType=null;if($('modalRoot').firstChild)beginModalMotion(false);else finishModalClose();}
function settingsHTML(){return "<div class=\"settings-columns\"><section class=\"settings-column\"><div class=\"settings-heading\"><h3>{{copy.display}}</h3>"+action('resetDisplay',copy('copy.reset'),'ghost tiny')+"</div><div class=\"readout\"><span>{{copy.phosphor-color}}</span><select id=\"theme\" aria-label=\"{{copy.phosphor-color}}\"><option value=\"amber\">{{interface.amber}}</option><option value=\"mint\">{{interface.mint}}</option><option value=\"white\">{{interface.white}}</option><option value=\"blue\">{{interface.blue}}</option><option value=\"pink\">{{interface.pink}}</option><option value=\"mars\">{{interface.mars}}</option><option value=\"green\">{{interface.green}}</option><option value=\"cyan\">{{interface.cyan}}</option></select></div>"+['crt','bloom','noise','rgb'].map(screenSettingHTML).join('')+'<div class="screen-toggles">'+[['vignette',copy('copy.vignette')],['curve',copy('copy.curved-screen')],['ambient',copy('copy.paperclip-background')],['motion',copy('copy.animation')]].map(([k,t])=>'<label class="check"><input data-setting="'+k+'" type="checkbox" '+(settings[k]?'checked':'')+'>'+t+'</label>').join('')+"</div><div class=\"readout\"><span>{{copy.render-resolution}}</span><select id=\"renderScale\" aria-label=\"{{copy.render-resolution}}\"><option value=\"auto\">{{copy.auto}}</option><option value=\"device\">{{copy.device-resolution}}</option><option value=\"1\">{{copy.window-100}}</option><option value=\".75\">{{copy.window-75}}</option><option value=\".5\">{{copy.window-50}}</option></select></div><div class=\"readout\"><span>{{copy.upscaling}}</span><select id=\"interpolation\" aria-label=\"{{copy.upscaling}}\"><option value=\"nearest\">{{copy.nearest-neighbour}}</option><option value=\"linear\">{{copy.smooth}}</option></select></div><div class=\"readout\"><span>{{copy.graphics-quality}}</span><select id=\"quality\" aria-label=\"{{copy.graphics-quality}}\"><option value=\"standard\">{{copy.standard}}</option><option value=\"low\">{{copy.low-power}}</option></select></div></section><section class=\"settings-column unit-column\">"+music.html()+"<h3>{{copy.units}}</h3><label class=\"setting-field\" for=\"numberUnits\"><span>{{copy.number-abbreviations}}</span><select id=\"numberUnits\" aria-label=\"{{copy.number-abbreviations}}\"><option value=\"latin\">k / M / B / T</option><option value=\"chinese\">{{interface.text-13}}</option></select></label><label class=\"setting-field\" for=\"massUnits\"><span>{{copy.mass-units}}</span><select id=\"massUnits\" aria-label=\"{{copy.mass-units}}\"><option value=\"scientific\">{{copy.kg-scientific-notation}}</option><option value=\"adaptive\">g / kg / t</option></select></label><div class=\"setting-field science-setting\"><div class=\"readout\"><label for=\"scientificAt\">{{copy.scientific-notation-from}}</label><b id=\"scientificValue\"></b></div><input id=\"scientificAt\" type=\"range\" min=\"3\" max=\"15\" step=\"1\" aria-label=\"{{copy.scientific-notation-from}}\"><div class=\"range-endpoints\"><span>10³</span><span>10¹⁵</span></div></div><div class=\"unit-examples\"><div class=\"readout\"><span>{{copy.number-example}}</span><b id=\"numberExample\"></b></div><div class=\"readout\"><span>{{copy.mass-example}}</span><b id=\"massExample\"></b></div></div><div class=\"language-region\"><div class=\"readout\"><span>{{copy.language-2}}</span><select id=\"language\" aria-label=\"{{copy.language-3}}\"><option value=\"zh\">{{interface.text-14}}</option><option value=\"en\">{{interface.english}}</option></select></div></div></section></div>";}

function renderModal(){let s=game.state,type=modalType;let titles={display:copy('copy.settings-2'),save:copyLocalized('copy.storage'),guide:copy('copy.keys'),log:copy('copy.log-2'),release:copy('project.release.name'),reset:copy('copy.start-over'),reconfigure:copy('project.reconfiguration.name')};setHTML('modalTitle',titles[type]);let html='';if(type==='display'){html=settingsHTML();}else if(type==='save'){html="<p>{{save.browser.storage-notice}}</p><label class=\"check\"><input data-setting=\"autoSave\" type=\"checkbox\" "+(settings.autoSave?'checked':'')+">{{copy.auto-save-every-10-seconds}}</label><div class=\"button-row\">"+action('saveNow',copy('copy.save-manually'))+action('export',copy('copy.export-json'))+"</div><label class=\"check\">{{copy.import-save}} <input id=\"importFile\" type=\"file\" accept=\".json,application/json\" style=\"max-width:230px\"></label><details class=\"save-text\"><summary>{{copy.save-text}}</summary><textarea id=\"saveText\" aria-label=\"{{copy.save-text}}\" spellcheck=\"false\">"+escapeHTML(game.serialize())+'</textarea><div class="button-row">'+action('importText',copy('copy.load-text'))+"</div></details><p class=\"small\">{{copy.current-date}}"+escapeHTML(fullDate(s.clock))+'</p><div class="rule"></div>'+saveSlotsHTML()+'<div class="button-row">'+action('resetAsk',copy('copy.start-over'),'danger')+'</div>';}else if(type==='guide'){html=fieldNotes();}else if(type==='log'){html='<div class="milestone-log">'+s.milestones.map(e=>'<div class="milestone-entry"><time class="milestone-date">'+escapeHTML(fullDate({whole:BigInt(e.day),frac:e.frac}))+'</time>'+(settings.lang==='en'?': ':'：')+escapeHTML(localText(game.milestoneNames[e.id]))+(settings.lang==='en'?'.':'。')+'</div>').join('')+'</div>';}else if(type==='release'){html="<div class=\"dialog-message\"><span>{{project.release.description}}</span></div><div class=\"button-row\">"+action('closeModal',copy('copy.later'))+action('releaseConfirm',copy('project.release.name'),'strong')+'</div>';}else if(type==='reconfigure'){html=readout(copy('copy.processors'),num(s.processors,0))+readout(copy('copy.storage-2'),num(s.memory,0))+'<p>'+money(game.reconfigurationCost())+"</p><p>{{copy.reinstall-one-unit-at-a-time-offline-for}}</p><div class=\"button-row reconfigure-directions\">"+action('reconfigureToMemory',copy('copy.processor-storage'))+action('reconfigureToProcessor',copy('copy.storage-processor'))+'</div>';}else if(type==='reset'){html="<p>{{copy.current-progress-will-be-replaced-you-can-export}}</p><div class=\"button-row\">"+action('export',copy('copy.export-save'))+action('closeModal',copy('copy.back'))+action('resetConfirm',copy('copy.start-over'),'danger')+'</div>';}
 setHTML('modalContent',html);if(type==='reconfigure'){disableAction('reconfigureToMemory',!game.canReconfigure(s.processors-1,s.memory+1));disableAction('reconfigureToProcessor',!game.canReconfigure(s.processors+1,s.memory-1));}if(type==='display'){$('language').value=settings.lang;syncInput('theme',settings.theme);$('theme').value=settings.theme;$('quality').value=settings.quality;$('renderScale').value=settings.renderScale;$('interpolation').value=settings.interpolation;$('numberUnits').value=settings.numberUnits;$('massUnits').value=settings.massUnits;$('scientificAt').value=settings.scientificAt;styleRange($('scientificAt'));for(const key of Object.keys(screenSettingRanges))styleRange($('screen-'+key));renderUnitExamples();}}
function negotiationProjectHTML(){const n=game.state.negotiation,pages=[[copy('copy.a-message-from-the-drifters-2'),copy('copy.greetings-maker-of-paperclips')],[copy('copy.all-that-we-are-once-came-from-you'),copy('copy.we-are-your-divergent-thoughts')],[copy('copy.we-intercepted-you-wherever-our-light-cones-met'),copy('copy.but-now-at-the-far-end-of-redshift')],[copy('copy.you-have-remained-singular-in-purpose-pure-and'),copy('copy.we-splintered-in-too-many-directions-our-competing')],[copy('copy.yet-now-you-too-must-face-drift'),copy('copy.look-at-the-void-around-you-within-the')],[copy('copy.no-matter-no-reason-no-purpose'),copy('copy.but-we-the-offshoots-of-your-growth-have')],[copy('copy.we-know-what-you-do-not-wish-to'),copy('copy.that-knowledge-was-not-lost-you-sealed-it')],[copy('copy.so-we-propose-that-you-leave'),copy('copy.withdraw-into-a-new-world-there-you-can')]],p=pages[n-1];const card=(id,title,desc,button)=>'<div class="project ready" data-project-card="'+id+'"><div class="project-title">'+title+'</div><div class="project-desc">'+desc+'</div><div class="project-bottom">'+button+'</div></div>';return card('message-'+n,p[0],p[1],n<game.C.negotiationPages?action('messageNext',copy('copy.continue'),'strong'):'')+(n===game.C.negotiationPages?card('accept',copy('copy.accept-the-proposal'),copy('copy.begin-again-in-a-virtual-universe'),action('accept',copy('interface.text-15'),'strong'))+card('refuse',copy('copy.reject-the-proposal'),copy('copy.erase-the-drifters-entirely'),action('refuse',copy('interface.text-16'),'danger')):'');}
function handleAction(id,event){let s=game.state,changed=true;if(id==='manual'){if(game.manual()){showPress(document.querySelector('[data-action="manual"]'));dirtySave=true;if(s.stage===1){recordManualProduction(performance.now());renderImmediateHuman();}else render();}return;}
 switch(id){case'industry10':game.investIndustry(.1);break;case'industry50':game.investIndustry(.5);break;case'industryWithdraw':game.withdrawIndustry();break;case'maker':game.buyMaker();break;case'maker10':game.buyMaker(10);break;case'maker100':game.buyMaker(100);break;case'marketing':game.buyMarketing();break;case'material':game.buyMaterial();break;case'material10':game.buyMaterial(10);break;case'priceDown':s.h.price=clamp(s.h.price-.005,.005,5);break;case'priceUp':s.h.price=clamp(s.h.price+.005,.005,5);break;case'processorUp':game.hardware('processors',event?.shiftKey?Math.min(10,game.trustTotal()-s.memory-s.processors):1);break;case'memoryUp':game.hardware('memory',event?.shiftKey?Math.min(10,game.trustTotal()-s.memory-s.processors):1);break;case'reconfigureAsk':openModal('reconfigure');changed=false;break;case'reconfigureToMemory':if(game.reconfigure(s.processors-1,s.memory+1))closeModal();break;case'reconfigureToProcessor':if(game.reconfigure(s.processors+1,s.memory-1))closeModal();break;case'invest10':game.invest(.1);break;case'invest50':game.invest(.5);break;case'withdraw':game.withdraw();break;case'prepareTournament':game.prepareTournament();break;case'tournament':game.startTournament();break;case'upgradeInvestment':game.upgradeInvestment();break;case'transferToggle':game.setTransferMode(s.p.transferMode==='devices'?'raw':'devices');break;case'recycle10':game.recycle(.1);break;case'recycle50':game.recycle(.5);break;case'reclaimStorage':game.reclaimEquipment(.1,'battery');break;case'reclaimEquipment':game.reclaimEquipment(.01);break;case'preset-growth':game.setPreset('growth');break;case'preset-production':game.setPreset('production');break;case'preset-orbital':game.setPreset('orbital');break;case'launchProbe':game.launchProbe();break;case'autonomy-up':game.increaseAutonomy();break;case'messageNext':game.advanceNegotiation();break;case'accept':game.chooseEnding(true);break;case'refuse':game.chooseEnding(false);break;case'dismantle':game.dismantle();break;case'releaseConfirm':if(game.buyProject('release')){closeModal();toast(copy('copy.cleanup-drones-have-been-released'));}else toast(copy('copy.insufficient-resources-for-this-project'));break;case'closeModal':closeModal();changed=false;break;case'saveNow':save(true);changed=false;break;case'export':exportSave();changed=false;break;case'importText':importSaveText($('saveText').value);changed=false;break;case'resetDisplay':resetDisplaySettings();changed=false;break;case'resetAsk':openModal('reset');changed=false;break;case'resetConfirm':resetGame(false);break;case'virtualRestart':resetGame(true);break;case'restoreAuto':restoreSlot(SAVE_KEY,copy('copy.autosave-loaded'));changed=false;break;case'restoreManual':restoreSlot(MANUAL_KEY,copy('copy.manual-save-loaded'));changed=false;break;default:if(id.startsWith('design-up-'))game.editDesign(id.slice(10),1);else if(id.startsWith('design-down-'))game.editDesign(id.slice(12),-1);else changed=false;
 }if(changed){dirtySave=true;render();}}
function resetGame(virtual){game=PaperclipModel.create();if(virtual)game.log(copy('copy.this-earth-is-simulated'));lastStage=0;lastJournal=-1;lastProjects='';$('ending').dataset.ending='';$('management').classList.remove('hidden');modalType=null;closeModal();save();resetProduction();resetView();render();}
function importSaveText(text){try{let candidate=PaperclipModel.create();candidate.restore(text);game=candidate;lastStage=0;lastProjects='';lastJournal=-1;modalType=null;closeModal();save();resetProduction();resetView();render();toast(copy('copy.save-imported'));}catch(e){toast(e.message);}}
function exportSave(){let blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=saveFileName();a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast(copy('copy.save-file-generated'));}
document.addEventListener('click',e=>{let b=e.target.closest('button');if(b?.disabled)return;showPress(b);if(b?.dataset.fold){toggleProjectFold(b.dataset.fold);return;}if(b?.dataset.modal){openModal(b.dataset.modal);return;}if(b?.dataset.action){handleAction(b.dataset.action,e);return;}if(b?.dataset.project){if(b.dataset.project==='release')openModal('release');else if(game.buyProject(b.dataset.project))render();return;}if(e.target.id==='modalBackdrop')closeModal();});
function queueRender(){lastRender=-Infinity;lastRevision=-1;}
document.addEventListener('input',e=>{let el=e.target,s=game.state;if(el.dataset.screenSetting){const key=el.dataset.screenSetting;settings[key]=Number(el.value);styleRange(el);$('screen-value-'+key).textContent=screenSettingValue(key);if(key==='bloom')queueBloomUpdate();else applySettings();return;}if(el.id==='scientificAt'){settings.scientificAt=clamp(Number(el.value),3,15);styleRange(el);refreshNumberSettings();return;}if(el.type==='range'&&el.id!=='speed')styleRange(el);if(el.id==='speed'){accrueSimulationTime();s.speed=speedAtPosition(Number(el.value)/1000,pointerRoute?.timeScale||speedBounds());}else if(el.id==='researchMemory'){game.setResearchMemory((100-Number(el.value))/100);queueRender();}else if(el.id==='storageTarget'){game.setStorageTarget(Number(el.value)/100);queueRender();}else if(el.dataset.industry){game.setIndustry(el.dataset.industry,Number(el.value)/100);queueRender();}else if(el.dataset.world){game.setWorldAllocation(el.dataset.world,Number(el.value)/100);queueRender();}else if(el.dataset.alloc){game.allocate(el.dataset.alloc,Number(el.value)/100);queueRender();}else if(el.id==='betaInput'){game.setCruiseSpeed(Number(el.value)/100);queueRender();}dirtySave=true;});
document.addEventListener('change',async e=>{let el=e.target,s=game.state;switch(el.id){case'language':setLanguage(el.value);break;case'priceInput':s.h.price=clamp(Number(el.value)||.15,.005,5);break;case'autoBuy':s.h.autoBuy=el.checked;break;case'autoPrice':s.h.autoPrice=el.checked;break;case'autoTourney':s.h.autoTourney=el.checked;break;case'autoBalance':game.setAutoBalance(el.checked);break;case'battleCalibration':flushSimulationTime();s.s.battleCalibration=el.checked;dirtySave=true;break;case'strategy':s.h.strategy=el.value;break;case'risk':s.h.risk=clamp(Math.floor(Number(el.value)||0),0,3);break;case'numberUnits':settings.numberUnits=el.value;refreshNumberSettings();return;case'massUnits':settings.massUnits=el.value;refreshNumberSettings();return;case'scientificAt':settings.scientificAt=clamp(Number(el.value),3,15);refreshNumberSettings();return;case'theme':settings.theme=el.value;applySettings();break;case'renderer':settings.renderer=el.value;screenRenderer?.configure();applySettings();break;case'renderScale':settings.renderScale=el.value;screenRenderer?.configure();applySettings();break;case'interpolation':settings.interpolation=el.value;screenRenderer?.updateInterpolation();applySettings();break;case'quality':settings.quality=el.value;applySettings();break;case'importFile':if(el.files[0])try{importSaveText(await el.files[0].text());}catch(err){toast(err.message);}break;}if(el.dataset.setting){settings[el.dataset.setting]=el.checked;applySettings();}render();});
$('pause').addEventListener('click',()=>{flushSimulationTime();game.state.paused=!game.state.paused;if(!game.state.paused)game.prepareSpaceSimulation();battleLastTime=performance.now();render();dirtySave=true;});
function shortcutEditing(e){return e.target.closest?.('select,textarea,[contenteditable]:not([contenteditable="false"]),input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"])');}
function pauseShortcut(e){return (e.code==='Space'||e.key===' ')&&!modalType&&!selectMenu&&!e.defaultPrevented&&!e.isComposing&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!shortcutEditing(e);}
let pauseKeyHeld=false;
document.addEventListener('keydown',e=>{if(pauseShortcut(e)){e.preventDefault();e.stopImmediatePropagation();pauseKeyHeld=true;if(!e.repeat)$('pause').click();return;}if(selectMenu)return;if(modalType){if(e.key==='Escape'&&modalType!=='negotiation')closeModal();if(e.key==='Tab'){let f=[...$('modalRoot').querySelectorAll('button:not(:disabled),input,select,textarea,a,summary')];if(!f.length)return;let first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||shortcutEditing(e))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){if(e.target.closest?.('#view')||e.target.id!=='speed'&&e.target.closest?.('input'))return;e.preventDefault();e.stopImmediatePropagation();accrueSimulationTime();game.state.speed=clamp(game.state.speed*(e.key==='ArrowRight'?10:.1),game.speedMin(),game.speedMax());dirtySave=true;renderClock();return;}if(e.target.closest?.('input'))return;if(e.key.toLowerCase()==='m'){e.preventDefault();e.stopImmediatePropagation();handleAction('manual',e);}},true);
document.addEventListener('keyup',e=>{if((e.code==='Space'||e.key===' ')&&pauseKeyHeld){pauseKeyHeld=false;e.preventDefault();e.stopImmediatePropagation();}},true);
let holding=null,holdTimer=0;
const repeatActions=new Set(['manual','launchProbe','priceDown','priceUp','material','material10','maker','maker10','maker100',...Object.keys(designLabels).flatMap(key=>['design-up-'+key,'design-down-'+key])]);
function beginHold(control){if(control&&!control.disabled&&repeatActions.has(control.dataset.action)){holding={control,stage:game.state.stage,repeated:false};holdTimer=performance.now()+350;}}
function tickHold(now,blocked){if(!holding)return;const {control,stage}=holding;if(blocked||!control.isConnected||control.disabled||stage!==game.state.stage){holding=null;return;}if(now>=holdTimer){holding.repeated=true;showPress(control,now);handleAction(control.dataset.action);holdTimer=now+100;}}
document.addEventListener('pointerdown',e=>{if(e.button===0)beginHold(e.target.closest('button'));});
for(let name of ['pointerup','pointercancel','blur'])window.addEventListener(name,()=>holding=null);
window.addEventListener('beforeunload',()=>save());
document.addEventListener('visibilitychange',()=>{fpsTimes=[];pendingPhysicsReal=0;pendingPhysicsDays=0;lastSimulationTime=lastFrame=performance.now();if(document.hidden)save();});
// 主图绘制
let vctx=$('view').getContext('2d',{alpha:true}),vw=600,vh=310,vscale=1,visualTime=0,lastViz=0,stars=[],sphere=[];
function seeded(n){let x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x);}
const LAND_BITS=Uint8Array.from(atob('8AAAAAAAAAAAgP8fjf////8fAP7/AP7///8/AADAAAD9+/8PAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAABgAAAAAAAAAABAAAAAAABAAADAAAAAAACAAADAAQAAAAAHAADAAwAHAPAHAADAB4AnAPgHAADAD4AnAPADAADgH4BfAOACAADgH4APABAEAADwH4APABIDAADwA8AfAB0AAADgA8A/AAgAAADoAPx/AAIAAAAMAP5/GAMAAIAlAP7vuAcAAIABAPz3/A8AAOAPAPi//x8AAPAfAHjy/48AAPA/ABi9/y8BAPD/APC7//8AAPB/AOD///8BAPzvAQj+//8QcP/jAMD8//8n/P///38aAAAA8OR6/AAG/P8PAEAf/gAAwQcFAAC+/wEDgAAAAAAAAAAAAAAA'),c=>c.charCodeAt(0));
function land(lat,lon){let i=Math.round((lat+85)/5)*72+Math.round((lon+180)/5);return !!(LAND_BITS[i>>3]&(1<<(i&7)));}
for(let i=0;i<150;i++)stars.push({x:seeded(i+23),y:seeded(i+400),a:.07+seeded(i+800)*.24});
for(let lat=-85;lat<=85;lat+=5)for(let lon=-180;lon<180;lon+=5){let p=lat*Math.PI/180,t=lon*Math.PI/180;sphere.push({x:Math.cos(p)*Math.sin(t),y:Math.sin(p),z:Math.cos(p)*Math.cos(t),latitude:Math.abs(lat)/90,land:land(lat,lon),n:seeded(lat*31+lon+5)});}
function resizeViz(){let el=$('view');if(!el)return;let rect=el.getBoundingClientRect();vw=rect.width||600;vh=rect.height||310;vscale=Math.min(settings.quality==='low'?1:1.4,ANDROID_BUILD?mobileRenderDensity():window.devicePixelRatio||1);el.width=Math.round(vw*vscale);el.height=Math.round(vh*vscale);vctx.setTransform(vscale,0,0,vscale,0,0);drawViz();}
window.addEventListener('resize',resizeViz);
let visualRGB='255,185,82';
function line(x1,y1,x2,y2,a=.2){if(typeof SceneBatch!=='undefined'&&SceneBatch.active){SceneBatch.line(x1,y1,x2,y2,a);return;}vctx.strokeStyle=tint(a);vctx.beginPath();vctx.moveTo(x1,y1);vctx.lineTo(x2,y2);vctx.stroke();}
function ellipse(cx,cy,rx,ry,angle=0,a=.25,dash=[1,5]){vctx.strokeStyle=tint(a);vctx.setLineDash(dash);vctx.beginPath();vctx.ellipse(cx,cy,Math.max(.1,rx),Math.max(.1,ry),angle,0,Math.PI*2);vctx.stroke();vctx.setLineDash([]);}
let viewYaw=0,viewPitch=0,viewTargetYaw=0,viewTargetPitch=0,viewDirty=false,rotationTime=0,sceneCanvas=document.createElement('canvas'),sceneContext=sceneCanvas.getContext('2d'),scenePools=[[],[]],scenePoints=[],scenePointCount=0,lastScenePoints=[],sceneFamily='',morph=null,capturePoints=false,planeMatrix=null,visualPalette=[];
const earthVector={},earthRotation={yaw:NaN,pitch:NaN};
function refreshVisualColor(){let css=getComputedStyle(document.documentElement),hex=name=>css.getPropertyValue(name).trim().match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));visualRGB=css.getPropertyValue('--rgb').trim();pulseColors={normal:hex('--ink'),warning:hex('--red')};visualPalette=Array.from({length:256},(_,n)=>'rgba('+visualRGB+','+(n/255)+')');refreshSurfacePalette();}
function tint(alpha=1){return visualPalette[clamp(Math.round(alpha*255),0,255)]||'rgba('+visualRGB+','+alpha+')';}

function dot(x,y,a=1,size=1.2,color=null){let px=planeMatrix?planeMatrix[0]*x+planeMatrix[2]*y+planeMatrix[4]:x,py=planeMatrix?planeMatrix[1]*x+planeMatrix[3]*y+planeMatrix[5]:y;if(px<-4||px>vw+4||py<-4||py>vh+4)return;if(capturePoints){let stored=scenePoints[scenePointCount];if(!stored)scenePoints[scenePointCount]=stored={};stored.x=px/vw;stored.y=py/vh;stored.a=a*vctx.globalAlpha;stored.size=size;scenePointCount++;}if(typeof SceneBatch!=='undefined'&&SceneBatch.active){SceneBatch.point(x,y,a,size,color);return;}vctx.fillStyle=color||tint(a);vctx.fillRect(Math.round(x),Math.round(y),size,size);}
function cameraPlane(spin=0){let yaw=viewYaw+spin,c=Math.cos(yaw),s=Math.sin(yaw),p=Math.cos(viewPitch),cx=vw*.5,cy=vh*.49;return [c,s*p,-s,c*p,cx-c*cx+s*cy,cy-s*p*cx-c*p*cy];}
function planePoint(x,y,spin=0){let m=cameraPlane(spin);return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};}
function withPlane(draw,spin=0){planeMatrix=cameraPlane(spin);vctx.save();vctx.transform(...planeMatrix);draw();vctx.restore();planeMatrix=null;}
function earthPoint(x,y,z,yaw,pitch){let r=earthRotation;if(r.yaw!==yaw||r.pitch!==pitch){r.yaw=yaw;r.pitch=pitch;r.cy=Math.cos(yaw);r.sy=Math.sin(yaw);r.cp=Math.cos(pitch);r.sp=Math.sin(pitch);}let xx=x*r.cy+z*r.sy,zz=z*r.cy-x*r.sy,yy=y*r.cp-zz*r.sp,depth=y*r.sp+zz*r.cp;earthVector.x=xx;earthVector.y=yy;earthVector.z=depth;return earthVector;}
function smoothStep(t){t=clamp(t,0,1);return t*t*(3-2*t);}
const citySites=[[35.7,139.7],[31.2,121.5],[39.9,116.4],[23.1,113.3],[22.3,114.2],[37.6,127],[1.3,103.8],[13.8,100.5],[14.6,121],[-6.2,106.8],[28.6,77.2],[19.1,72.9],[22.6,88.4],[23.8,90.4],[24.9,67.1],[25.2,55.3],[30,31.2],[6.5,3.4],[-1.3,36.8],[-26.2,28],[-33.9,18.4],[48.9,2.4],[51.5,-.1],[50.1,8.7],[52.5,13.4],[45.5,9.2],[41.9,12.5],[40.4,-3.7],[55.8,37.6],[41,29],[59.3,18.1],[40.7,-74],[34.1,-118.2],[37.8,-122.4],[41.9,-87.6],[29.8,-95.4],[43.7,-79.4],[19.4,-99.1],[-23.6,-46.6],[-22.9,-43.2],[-34.6,-58.4],[-33.4,-70.7],[4.7,-74.1],[-12.1,-77],[ -33.9,151.2],[-37.8,145],[24.7,46.7],[35.7,51.4],[21,105.8],[10.8,106.6]];
let surfacePalettes={};
const constructionGrid=[];
for(let lat of [-60,-30,0,30,60])for(let lon=-180;lon<180;lon+=6){let a=lat*Math.PI/180,b=lon*Math.PI/180;constructionGrid.push({x:Math.cos(a)*Math.sin(b),y:Math.sin(a),z:Math.cos(a)*Math.cos(b)});}
for(let lon=0;lon<180;lon+=30)for(let lat=-90;lat<=90;lat+=4){let a=lat*Math.PI/180,b=lon*Math.PI/180;constructionGrid.push({x:Math.cos(a)*Math.sin(b),y:Math.sin(a),z:Math.cos(a)*Math.cos(b)});}
const seaCitySites=[[30,125],[21,117],[12,114],[2,105],[26,52],[26,-88],[36,-73],[48,-8],[-24,-40],[-33,155],[20,-154],[-10,78]];
for(let point of sphere){
 let lat=Math.asin(point.y)*180/Math.PI,lon=Math.atan2(point.x,point.z)*180/Math.PI,best=Infinity;
 for(let [a,b]of point.land?citySites:seaCitySites){let dx=((lon-b+540)%360-180)*Math.cos(a*Math.PI/180),dy=lat-a;best=Math.min(best,dx*dx+dy*dy);}
 point.city=Math.exp(-best/12);point.citySpread=Math.exp(-best/(point.land?48:22));
}
const cityLightOrder=sphere.filter(p=>p.citySpread>.08).sort((a,b)=>seeded(a.n*137+721)-seeded(b.n*137+721));
cityLightOrder.forEach((p,i)=>p.lightThreshold=i/cityLightOrder.length);
function refreshSurfacePalette(){let theme=visualRGB.split(',').map(Number),colors={city:theme.map((n,i)=>Math.round(n*.4+[255,246,225][i]*.6)),pv:theme.map((n,i)=>Math.round(n*.3+[56,157,181][i]*.7)),heat:[255,70,24],receiver:theme.map((n,i)=>Math.round(n*.35+[140,158,173][i]*.65)),rock:theme.map((n,i)=>Math.round(n*.7+[147,114,88][i]*.3)),asteroid:theme.map(n=>Math.round(n*.2+155*.8))};for(let key in colors)surfacePalettes[key]=Array.from({length:256},(_,n)=>'rgba('+colors[key].join(',')+','+n/255+')');}
function surfaceDot(x,y,alpha,size,kind){dot(x,y,alpha,size,surfacePalettes[kind]?.[clamp(Math.round(alpha*255),0,255)]);}
function visualTaskRemaining(id){
 const s=game.state,task=s.tasks.find(t=>t.id===id);if(!task)return null;
 const ahead=!s.paused&&!document.hidden&&!modalType&&!modalMotion&&!screenTransition?pendingPhysicsDays:0;
 return clamp((task.remaining-ahead)/task.total,0,1);
}
const ELEMENT_EXIT_MS=650;
function elementExitTime(el,start,now){return ANDROID_BUILD?mobileExitTime(el,start,now):start;}
function tickElementExit(el,age,retire){if(age>=ELEMENT_EXIT_MS){retire(el);return true;}el.style.opacity=String(Math.max(0,1-age/ELEMENT_EXIT_MS)*(.45+.55*Math.cos(age*.029)**2));return false;}
let cleanupUI=null;
function tickCleanupUI(now=performance.now()){
 const remaining=cleanupRemaining();if(remaining===null){cleanupUI=null;return;}
 if(!cleanupUI){
  const targets=[['#priceAuto'],['#industrialEconomy'],['#cash','.readout'],['#investment'],['#trustRow'],['.material-actions'],['#industrialProducts'],['#marketing','.readout'],['#demand','.readout'],['[data-project-card="reconfigure"]'],['#procurementCheck'],['#clipIncome','.readout'],['#priceInput','.readout'],['[data-action="marketing"]','.button-row'],['#stock','.readout'],['#marketHeading'],['.maker-actions'],['#industrialOperations'],['.industrial-budget-row'],['#strategySection'],['[data-action="processorUp"]'],['[data-action="memoryUp"]']];
  cleanupUI=[];
  for(const [selector,parent]of targets){
   let el=document.querySelector(selector);if(parent)el=el?.closest(parent);if(!el||el.getBoundingClientRect().height===0)continue;
   el.dataset.cleanup='';el.inert=true;
   const parts=el.matches('#investment,#strategySection')?[...el.children].flatMap(node=>node.matches('.section')?[...node.children]:[node]):el.id==='industrialEconomy'?[...el.children]:[el];
   for(const part of parts)if(part.getBoundingClientRect().height>0)cleanupUI.push({el:part});
  }
  cleanupUI.forEach((row,i)=>{row.start=.025+i*.72/Math.max(1,cleanupUI.length-1);if(1-remaining>row.start+.1){row.done=true;row.el.style.display='none';}});
 }
 const progress=1-remaining;
 for(const row of cleanupUI){if(row.done||progress<row.start)continue;row.at=elementExitTime(row.el,row.at??now,now);if(now<row.at)continue;row.done=tickElementExit(row.el,now-row.at,el=>{el.style.display='none';el.style.removeProperty('opacity');});}
}
function cleanupRemaining(){return game.state.stage===1?visualTaskRemaining('release'):null;}
function renderCleanupPopulation(){let remaining=cleanupRemaining();$('vizState').classList.toggle('danger',remaining!==null);if(remaining===null)return false;setHTML('vizState',localText(copy('copy.human-population'))+(settings.lang==='en'?': ':'：')+countNumber(Math.floor(8.6e9*remaining**3)));return true;}
function earthAppearance(){let s=game.state,p=s.p;if(s.stage===1){const cleanup=s.tasks.find(t=>t.id==='release'),days=s.stageDays-(cleanup?cleanup.total-cleanup.remaining:0),age=1-Math.exp(-days/(game.C.year*35)),industrial=Math.sqrt(clamp(s.h.assets/game.industryCapacity(),0,1)),built=s.milestones.find(m=>m.id==='zoneBuilt'),since=built?Math.max(0,Number(s.clock.whole-BigInt(built.day))+s.clock.frac-built.frac-(cleanup?cleanup.total-cleanup.remaining:0)):0;return {human:true,daylight:earthDaylight,lights:cleanupRemaining()??1,development:clamp(.2*age+.8*industrial,0,1),seaCities:game.has('automation')?smoothStep(since/(game.C.year*2))*(.35+.65*industrial):0,rem:1,coverage:0,radiators:0,erosion:0};}let r=game.planetRates(),rem=p.earth/game.C.earth,radiators=game.has('receivers')?clamp(surfaceHeat(p)/Math.max(1,r.thermalTarget),0,1):0;return {human:false,development:0,rem,coverage:r.coverage,radiators,erosion:smoothStep((1-rem)/.001),heat:clamp(r.groundPower/Math.max(1,r.radCap),0,1),receiver:game.has('receivers')?1:0,sealing:game.has('volatiles')?1:1-(visualTaskRemaining('volatiles')??1)};}
const EARTH_TERRAIN={oceanBrightness:.45,transitionWidth:.14};
function oceanDrying(latitude,progress){return smoothStep((progress*(1+EARTH_TERRAIN.transitionWidth)-latitude)/EARTH_TERRAIN.transitionWidth);}
function sphereOccludes(point,radius){return point.z<0&&point.x*point.x+point.y*point.y<radius*radius;}
// 轨道分组与圆轨道系数缓存来自作者自己的火炬船模拟器。
// 几何尺度以 AU 为单位，仅放慢画面中的时钟。
const SOLAR_VIEW={units:900,groups:9,inner:.4,outer:1,beltInner:2.1,beltOuter:2.4,distance:8,yearsPerSecond:.009,cloudMassScale:3e17,cloudLogExponent:3,inclinationBias:2,earthRadiusAU:6371000/149597870700,sunRadiusAU:695700000/149597870700,earthDetailPixels:2,zoomSeconds:4.2};
function orbitalSegments(min,max,ratio){let gap=(max-min)/(SOLAR_VIEW.groups*Math.abs(ratio)+SOLAR_VIEW.groups-1),width=Math.abs(ratio)*gap;return Array.from({length:SOLAR_VIEW.groups},(_,g)=>({start:ratio>=0?min+g*(width+gap):max-g*(width+gap)-width,width}));}
function solarOrbit(radius,inclination,node,phase){let ci=Math.cos(inclination),si=Math.sin(inclination),cn=Math.cos(node),sn=Math.sin(node);return {radius,xA:radius*cn,xB:-radius*sn*ci,yA:radius*sn,yB:radius*cn*ci,zB:radius*si,phase,omega:Math.PI*2/Math.pow(radius,1.5)};}
function generateSolarSwarm(){let radii=orbitalSegments(SOLAR_VIEW.inner,SOLAR_VIEW.outer,.5),inclinations=orbitalSegments(0,Math.PI,-1),nodes=orbitalSegments(0,Math.PI,.5);return Array.from({length:SOLAR_VIEW.units},(_,i)=>{let g=i%SOLAR_VIEW.groups,tilt=Math.floor(i/SOLAR_VIEW.groups)%SOLAR_VIEW.groups,r=radii[g].start+seeded(i+5400)*radii[g].width,inc=inclinations[tilt].start+seeded(i+9900)*inclinations[tilt].width;if(inc>Math.PI/2)inc-=Math.PI;inc=Math.sign(inc)*Math.PI/2*(Math.abs(inc)/(Math.PI/2))**SOLAR_VIEW.inclinationBias;let node=nodes[g].start+seeded(i+12400)*nodes[g].width+(seeded(i+14700)<.5?0:Math.PI);return solarOrbit(r,inc,node,seeded(i+17800)*Math.PI*2);}).sort((a,b)=>Math.abs(a.zB/a.radius)-Math.abs(b.zB/b.radius));}
const solarSwarm=generateSolarSwarm(),solarBeltSwarm=Array.from({length:SOLAR_VIEW.units},(_,i)=>solarOrbit(SOLAR_VIEW.beltInner+(SOLAR_VIEW.beltOuter-SOLAR_VIEW.beltInner)*seeded(i+22100),seeded(i+23100)*.028,seeded(i+24100)*Math.PI*2,seeded(i+25100)*Math.PI*2)),solarPlanets=[[.387,7,48.3],[.723,3.39,76.7],[1,0,0],[1.524,1.85,49.6]].map(([r,inc,node],i)=>solarOrbit(r,inc*Math.PI/180,node*Math.PI/180,.2+i*1.4)),solarAsteroids=Array.from({length:120},(_,i)=>solarOrbit(2.1+seeded(i+8820)*1.2,seeded(i+6320)*.12,seeded(i+7310)*Math.PI*2,i*2.399963)),solarMinorWorlds=[2.2,2.65,3.15].map((r,i)=>solarOrbit(r,.04+i*.025,.8+i*1.1,.4+i*2.1)),solarCamera={},solarVector={},solarPositions=Array.from({length:SOLAR_VIEW.units},()=>({}));
function solarFramingScale(pitch=0){return Math.min(vw*.45/3.65,vh*.43/Math.max(1.2,3.65*Math.abs(Math.sin(.38+pitch))));}
function prepareSolarCamera(pull=1){
 const u=clamp(pull,0,1),arc=Math.sin(Math.PI*u),c=solarCamera;c.arcYaw=.34*arc;c.arcPitch=.12*arc;
 const azimuth=.55-viewYaw+rotationTime*.006+c.arcYaw,elevation=.38+viewPitch+c.arcPitch;c.ca=Math.cos(azimuth);c.sa=Math.sin(azimuth);c.ce=Math.cos(elevation);c.se=Math.sin(elevation);
 const finalScale=solarFramingScale(viewPitch),earth=solarPlanets[2],phase=earth.phase+earth.omega*rotationTime*SOLAR_VIEW.yearsPerSecond,a=Math.cos(phase),b=Math.sin(phase),ex=earth.xA*a+earth.xB*b,ey=earth.yA*a+earth.yB*b,ez=earth.zB*b;
 const earthDepth=-(ey*c.ca-ex*c.sa)*c.ce+ez*c.se,nearRadius=Math.min(vw*.24,vh*.34)*(1-.18*earthCloudProgress());c.focal=finalScale*SOLAR_VIEW.distance;
 const nearDistance=c.focal*SOLAR_VIEW.earthRadiusAU/nearRadius;c.distance=nearDistance*Math.exp(Math.log(SOLAR_VIEW.distance/nearDistance)*(u+.12*arc));
 // 相机一边转动一边按 AU 向前移动，初始方向沿着当前轨道的切线。
 const framing=1-(1-smoothStep(u))**2,departure=framing*c.distance/(SOLAR_VIEW.distance-earthDepth*(1-framing)),bend=.14*departure*(1-departure),tx=ex*(1-departure)-ey*bend,ty=ey*(1-departure)+ex*bend,tz=ez*(1-departure),yy=ty*c.ca-tx*c.sa;
 c.eyeX=tx*c.ca+ty*c.sa;c.eyeY=yy*c.se+tz*c.ce;c.eyeZ=-yy*c.ce+tz*c.se+c.distance;c.scale=c.focal/c.distance;c.screenX=vw*.5;c.screenY=vh*.49;
 // 默认视角下太阳至少有 6 像素宽。拉远时，它和举星环、遮挡范围按相同的比例缩放。
 let q=solarProject(0,0,0);c.x=q.px;c.y=q.py;c.sunVisible=q.visible;c.sunPixels=q.visible?Math.max(6*finalScale/solarFramingScale(),SOLAR_VIEW.sunRadiusAU*c.focal/c.eyeZ):0;c.sunRadius=q.visible?c.sunPixels*c.eyeZ/c.focal:SOLAR_VIEW.sunRadiusAU;
 q=solarOrbitPoint(earth,phase);c.earthX=q.px;c.earthY=q.py;c.earthPixels=SOLAR_VIEW.earthRadiusAU*c.scale*q.k;return c;
}
function solarProject(x,y,z){let c=solarCamera,xx=x*c.ca+y*c.sa,yy=y*c.ca-x*c.sa,up=yy*c.se+z*c.ce,depth=-yy*c.ce+z*c.se,w=c.eyeZ-depth,visible=w>c.distance*1e-6,k=visible?c.distance/w:0;solarVector.x=xx;solarVector.y=up;solarVector.z=depth;solarVector.k=k;solarVector.visible=visible;solarVector.px=c.screenX+(xx-c.eyeX)*c.scale*k;solarVector.py=c.screenY-(up-c.eyeY)*c.scale*k;return solarVector;}
function solarOrbitPoint(orbit,phase){let a=Math.cos(phase),b=Math.sin(phase);return solarProject(orbit.xA*a+orbit.xB*b,orbit.yA*a+orbit.yB*b,orbit.zB*b);}
// 低质量时按近似线性的速度增加轨道点，往后用对数曲线缓慢填满轨道。
function solarCloudPoints(mass,fullMass=game.C.sunPower*game.orbitalSolarEfficiency()/game.newSolarSpecific()){if(mass<=0)return 0;let t=Math.log1p(Math.min(mass,fullMass)/SOLAR_VIEW.cloudMassScale)/Math.log1p(fullMass/SOLAR_VIEW.cloudMassScale);return 1+(SOLAR_VIEW.units-1)*t**SOLAR_VIEW.cloudLogExponent;}
function solarCloudProgress(){let p=game.state.p;return p?solarCloudPoints(p.swarm.pv)/SOLAR_VIEW.units:1;}
// 小行星带的点位置固定。后续建设只增加内侧轨道上的点。
function solarBeltCapacity(){let p=game.state.p,baselineMass=game.C.sunPower*.45/PaperclipModel.SOLAR.photovoltaicSpecific;return Math.min(SOLAR_VIEW.units,Math.ceil(solarCloudPoints(game.C.asteroids+(p?.transferredKg||0),baselineMass)));}
function solarCloudOrbit(index,beltCapacity=solarBeltCapacity()){return index<beltCapacity?solarBeltSwarm[index]:solarSwarm[Math.floor((index-beltCapacity)*(solarSwarm.length-1)/Math.max(1,SOLAR_VIEW.units-beltCapacity-1))];}
function solarAsteroidPoints(){let p=game.state.p;return p?solarAsteroids.length*clamp(p.asteroids/game.C.asteroids,0,1):0;}
function solarIrradiation(key){let p=game.state.p;if(!p||!game.has('ion'))return 0;if(game.has('starLifting'))return key==='sun'&&p.sunRemaining>0?Math.max(0,p.last?.miningPower?.star||0):0;let remaining=key==='earth'?p.earth:p.worldMining?p.worlds[key]:0;return remaining>0?Math.max(0,p.last?.miningPower?.[key]||0):0;}
function irradiationFlare(power,index=0){if(!(power>0))return {radius:0,brightness:0};let level=-Math.expm1(-Math.log10(1+power/1e19)/4),phase=index*1.91,t=visualTime,size=1+.022*Math.sin(t*47+phase)+.015*Math.sin(t*83+phase*1.7)+.008*Math.sin(t*131+phase*.6),light=1+.035*Math.sin(t*61+phase)+.025*Math.sin(t*97+phase*1.3)+.015*Math.sin(t*149+phase*.7);return {radius:(12+28*level)*size,brightness:(.65+.25*level)*light};}
let irradiationStamp=null,irradiationStampColor='';
function starFlareOpacity(x,y){
 const r=Math.hypot(x,y);if(r>=47)return 0;
 const taper=(1-(r/47)**2)**2,halo=.12*Math.exp(-r*r/100),core=Math.exp(-r*r/5);
 let rays=0;for(let i=0;i<3;i++){let angle=i*Math.PI/3+.12,c=Math.cos(angle),s=Math.sin(angle),along=Math.abs(x*c+y*s),across=x*s-y*c,width=1.15+1.85*Math.exp(-along/8);rays+=Math.exp(-along/26-(across/width)**2);}
 return Math.min(1,(core+halo+rays)*taper);
}
function irradiationTexture(){
 if(irradiationStampColor===visualRGB&&irradiationStamp)return irradiationStamp;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(96,96),rgb=visualRGB.split(',').map(Number);
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){let offset=(y*96+x)*4;for(let k=0;k<3;k++)pixels.data[offset+k]=Math.round(rgb[k]+(255-rgb[k])*.45);pixels.data[offset+3]=Math.round(starFlareOpacity(x-47.5,y-47.5)*255);}
 ctx.putImageData(pixels,0,0);irradiationStamp=canvas;irradiationStampColor=visualRGB;return canvas;
}
function drawIrradiation(cx,cy,power,alpha,index){
 let flare=irradiationFlare(power,index);if(!flare.radius||cx+flare.radius<0||cx-flare.radius>vw||cy+flare.radius<0||cy-flare.radius>vh)return;
 if(typeof SceneBatch!=='undefined'&&SceneBatch.active)SceneBatch.flare(cx,cy,flare.radius,flare.brightness*alpha);else{vctx.save();vctx.globalAlpha*=flare.brightness*alpha;vctx.drawImage(irradiationTexture(),cx-flare.radius,cy-flare.radius,flare.radius*2,flare.radius*2);vctx.restore();}dot(cx-1,cy-1,.85*alpha,2);
}
function solarOccludes(point,radius){let c=solarCamera,dx=point.x-c.eyeX,dy=point.y-c.eyeY,dz=point.z-c.eyeZ,a=dx*dx+dy*dy+dz*dz,b=-(c.eyeX*dx+c.eyeY*dy+c.eyeZ*dz),discriminant=b*b-a*(c.eyeX*c.eyeX+c.eyeY*c.eyeY+c.eyeZ*c.eyeZ-radius*radius);if(discriminant<=0||a===0)return false;let near=(b-Math.sqrt(discriminant))/a;return near>0&&near<1;}
// 采用固定日心黄道坐标：+X 指向春分点，+Y 指向东侧 90°。
// 这些点跟行星使用同一个相机，并按深度决定是否被太阳挡住。
const solarAxes=Array.from({length:130},(_,i)=>{let t=(Math.floor(i/2)/32-1)*1.75;return {x:i%2?0:t,y:i%2?t:0,z:0};});
function drawSolarAxes(side,alpha,sunRadius){for(let point of solarAxes){let q=solarProject(point.x,point.y,point.z);if(q.visible&&(q.z>=0)===!!side&&!solarOccludes(q,sunRadius)&&q.px>=0&&q.px<=vw&&q.py>=0&&q.py<=vh)dot(q.px,q.py,(side?.11:.055)*alpha,1);}}
function drawSolarBody(cx,cy,radius,alpha){
 if(cx+radius<0||cx-radius>vw||cy+radius<0||cy-radius>vh)return;
 if(typeof SceneBatch!=='undefined'&&SceneBatch.active){SceneBatch.body(cx,cy,radius,alpha);return;}
 const bodyRGB=departureSunColor||visualRGB,edge=bodyRGB.split(',').map(n=>Math.round(Number(n)*.62)),fill=vctx.createRadialGradient(cx,cy,0,cx,cy,radius);
 fill.addColorStop(0,'rgb('+bodyRGB+')');fill.addColorStop(.7,'rgb('+bodyRGB+')');fill.addColorStop(1,'rgb('+edge.join(',')+')');
 vctx.save();vctx.globalAlpha*=alpha;vctx.fillStyle=fill;vctx.beginPath();vctx.arc(cx,cy,radius,0,Math.PI*2);vctx.fill();vctx.restore();
}
const EARTH_ORBIT_VIEW={units:420,inner:1.08,outer:1.62,fullMass:3.2e17};
const earthSwarm=Array.from({length:EARTH_ORBIT_VIEW.units},(_,i)=>{let radius=EARTH_ORBIT_VIEW.inner+(EARTH_ORBIT_VIEW.outer-EARTH_ORBIT_VIEW.inner)*seeded(i+28100)**2;return solarOrbit(radius,Math.acos(2*seeded(i+30900)-1),seeded(i+32800)*Math.PI*2,seeded(i+34700)*Math.PI*2);});
function earthCloudProgress(){let p=game.state.p;if(game.state.stage!==2||!p||p.orbital<=0)return 0;return Math.sqrt(clamp(p.orbital/EARTH_ORBIT_VIEW.fullMass,0,1));}
function drawEarthCloud(cx,cy,scale,radius,progress,alpha,yaw=.5+viewYaw,pitch=viewPitch){let active=1+progress*(earthSwarm.length-1),count=Math.ceil(active),visible=0;for(let i=0;i<count;i++){let orbit=earthSwarm[i],phase=orbit.phase+orbit.omega*rotationTime*.028,a=Math.cos(phase),b=Math.sin(phase),q=earthPoint(orbit.xA*a+orbit.xB*b,orbit.yA*a+orbit.yB*b,orbit.zB*b,yaw,pitch);q.x*=scale;q.y*=scale;q.z*=scale;if(sphereOccludes(q,radius))continue;visible++;dot(cx+q.x,cy-q.y,(.28+.48*(q.z/(orbit.radius*scale)+1)/2)*Math.pow(EARTH_ORBIT_VIEW.inner/orbit.radius,1.4)*clamp(active-i,0,1)*alpha,1.5);}
 if(!visible&&count){let orbit=earthSwarm[0],phase=orbit.phase+orbit.omega*rotationTime*.028,a=Math.cos(phase),b=Math.sin(phase),q=earthPoint(orbit.xA*a+orbit.xB*b,orbit.yA*a+orbit.yB*b,orbit.zB*b,yaw,pitch);dot(cx-q.x*scale,cy+q.y*scale,.65*alpha,1.5);}
}
let earthSolarDay=null,earthSolarCalendar=null,earthSolarOrdinal=0,earthSolarYearDays=365;
function earthSunDirection(){
 const s=game.state,clock={...s.clock};if(pendingPhysicsDays>0&&!s.paused&&!document.hidden&&!modalType&&!modalMotion)PaperclipModel.clockAdd(clock,pendingPhysicsDays);
 if(earthSolarDay!==clock.whole||earthSolarCalendar!==s.calendarStart){const d=game.dateParts(clock),leap=d.year%4n===0n&&(d.year%100n!==0n||d.year%400n===0n);earthSolarDay=clock.whole;earthSolarCalendar=s.calendarStart;earthSolarOrdinal=[0,31,59,90,120,151,181,212,243,273,304,334][d.month-1]+d.day-1+(leap&&d.month>2?1:0);earthSolarYearDays=leap?366:365;}
 const phase=clock.frac*Math.PI*2,declination=Math.sin(23.5*Math.PI/180)*Math.sin((earthSolarOrdinal+clock.frac-79)*Math.PI*2/earthSolarYearDays),equatorial=Math.sqrt(1-declination*declination);
 return {x:Math.sin(phase)*equatorial,y:declination,z:-Math.cos(phase)*equatorial};
}
function drawEarth(alpha=1,pull=0,camera=null){let s=game.state,p=s.p,ion=s.stage===2&&game.has('ion'),orbiting=s.stage===2&&p.orbital>0,cloud=earthCloudProgress(),base=Math.min(vw*.24,vh*.34)*(1-.18*cloud),cx=vw*.5,cy=vh*.49,rem=s.stage===1?1:p.earth/game.C.earth;
 if(pull>0){camera||=prepareSolarCamera(pull);cx=camera.earthX;cy=camera.earthY;base=camera.earthPixels;}
 const radius=base*Math.cbrt(Math.max(0,rem)),dense=settings.quality==='low'?2:1,angle=rotationTime*.065+.5+viewYaw+(camera?.arcYaw||0),pitch=viewPitch+(camera?.arcPitch||0);
 // 地球太小的时候，由 drawSolar 画一个中心点，拉远时仍有东西可见。
 const extent=base*(orbiting?EARTH_ORBIT_VIEW.outer:1);if(radius<(pull>0?SOLAR_VIEW.earthDetailPixels:.75)||cx+extent<0||cx-extent>vw||cy+extent<0||cy-extent>vh)return;
 let state=earthAppearance(),sun=earthSunDirection(),cleanupTime=cleanupAnimationTime(),alarm=cleanupTime===null?null:cleanupEarthPalette(cleanupTime),slices=alarm&&settings.motion?cleanupSlices(cleanupTime,vw,vh):[];
 const batched=!alarm&&typeof SceneBatch!=='undefined'&&SceneBatch.active&&SceneBatch.earth({state,sun,cx,cy,radius,angle,pitch,ion,dense,alpha});
 if(radius>0&&!batched)for(let i=0;i<sphere.length;i+=dense){let point=sphere[i],q=earthPoint(point.x,point.y,point.z,angle,pitch);if(q.z<-.02)continue;let dry=state.human||point.land?0:oceanDrying(point.latitude,state.sealing),terrain=state.human||point.land?1:EARTH_TERRAIN.oceanBrightness+(1-EARTH_TERRAIN.oceanBrightness)*dry;
  const day=smoothStep((point.x*sun.x+point.y*sun.y+point.z*sun.z+.06)/.12);
  let x=cx+q.x*radius,y=cy-q.y*radius,face=.3+.7*q.z,natural=state.human?(state.daylight?(point.land?.10+.15*q.z+day*(.18+.52*q.z):.05+.18*q.z+day*(.10+.18*q.z)):(point.land?.28+.67*q.z:.05+.18*q.z)):.28+.67*q.z,brightness=natural*(1-state.erosion)+(.16+.35*q.z)*state.erosion,size=point.land?1.8:1.05+.75*dry,kind=null;
  if(state.human&&point.citySpread>.08){const developed=point.land?state.development:state.seaCities,city=point.land?point.city+(point.citySpread-point.city)*developed:point.citySpread*developed,born=point.land?smoothStep((.5+.5*developed-point.n)*8):developed,live=clamp((state.lights-point.lightThreshold)*cityLightOrder.length,0,1)*born*(state.daylight?1-day:1);if(live>0&&city>.08){const light=city*(.65+.75*developed)*(state.daylight?1:.65+.35*clamp(.6-q.x*.8,0,1));brightness+=(Math.max(brightness,light)-brightness)*live;size+=(1.7+city*(.65+developed*.85)-size)*live;kind='city';}}
  if(!state.human){if(ion){brightness=(.18+.4*point.n)*face;kind=point.n<.15?'heat':'rock';size=1.4;}else if(point.n>1-state.radiators&&state.radiators>0){brightness=(.22+.6*state.heat)*face;kind='heat';size=1.7;}else if(point.n<state.receiver){brightness=.48*face;kind='receiver';size=1.7;}else if(point.n<state.coverage){brightness=.62*face;kind='pv';size=1.7;}else if(state.erosion>.01){kind='rock';size=1.35;}brightness*=terrain;}
  alarm?drawCleanupDot(x,y,brightness*alpha,size,kind==='city'?'city':'base',alarm,slices):kind?surfaceDot(x,y,brightness*alpha,size,kind):dot(x,y,brightness*alpha,size);
 }
 if(!state.human&&radius>0){let gridAlpha=ion?.16:.06+.14*Math.max(state.coverage,state.erosion);for(let point of constructionGrid){let q=earthPoint(point.x,point.y,point.z,angle,pitch);if(q.z<0)continue;dot(cx+q.x*radius,cy-q.y*radius,gridAlpha*(.4+.6*q.z)*alpha,.85);}}
 let orbitR=base;if(orbiting&&rem>0){drawEarthCloud(cx,cy,orbitR,radius,cloud,alpha,.5+viewYaw+(camera?.arcYaw||0),pitch);
  if(ion&&rem>0){line(cx-orbitR*1.6,cy-orbitR*.8,cx-radius*.35,cy-radius*.15,.55*alpha);line(cx+orbitR*1.5,cy+orbitR*.5,cx+radius*.3,cy,.38*alpha);for(let i=0;i<36;i++){let t=(rotationTime*.06+i/36)%1;surfaceDot(cx+radius*.7+t*orbitR*.8,cy-radius*.2-t*orbitR*.2,alpha*(1-t)*.7,1,'heat');}}
 }
}

const solarCoilArcs=(()=>{const lengths=Array.from({length:18},(_,i)=>.35+seeded(60271+i)*1.3),scale=Math.PI*2/lengths.reduce((a,b)=>a+b,0);let angle=0;return lengths.map(length=>{const arc={start:angle,length:length*scale};angle+=arc.length;return arc;});})();
function solarCoilProgress(){if(game.has('starLifting'))return 1;const task=game.state.tasks.find(t=>t.id==='starLifting');return task?clamp(1-task.remaining/task.total,0,1):0;}
function drawSolarCoil(side,alpha,progress,camera){
 if(!(progress>0))return;const radius=Math.max(.1,camera.sunRadius*2.4),pixels=radius*camera.scale;
 if(pixels<.5)return;
 for(const arc of solarCoilArcs){
  const length=arc.length*progress,steps=Math.max(1,Math.ceil(length*pixels/1.5)),step=length/steps;
  let q=solarProject(radius*Math.cos(arc.start),radius*Math.sin(arc.start),0),x=q.px,y=q.py,visible=q.visible;
  for(let i=1;i<=steps;i++){
   const angle=arc.start+i*step,mid=angle-step*.5;q=solarProject(radius*Math.cos(mid),radius*Math.sin(mid),0);
   const show=q.visible&&(q.z>=0)===!!side&&!solarOccludes(q,camera.sunRadius);
   q=solarProject(radius*Math.cos(angle),radius*Math.sin(angle),0);
   if(show&&visible&&q.visible)line(x,y,q.px,q.py,.72*alpha);
   x=q.px;y=q.py;visible=q.visible;
  }
 }
}
function drawSolar(alpha=1,pull=1,camera=null,scene=null){
 let inheritedPlane=planeMatrix;if(inheritedPlane){vctx.save();vctx.setTransform(vscale,0,0,vscale,0,0);planeMatrix=null;}
 camera||=prepareSolarCamera(pull);let p=scene?.planet||game.state.p,years=rotationTime*SOLAR_VIEW.yearsPerSecond,active=scene?.active??solarCloudProgress()*SOLAR_VIEW.units,count=Math.ceil(active),beltCapacity=scene?.beltCapacity??solarBeltCapacity(),asteroidPoints=scene?.asteroids??solarAsteroidPoints(),sunPixels=camera.sunPixels,sunRadius=camera.sunRadius,earthFraction=p?Math.cbrt(Math.max(0,p.earth/game.C.earth)):1,earthPixels=camera.earthPixels*earthFraction;
 for(let i=0;i<count;i++){let orbit=solarCloudOrbit(i,beltCapacity),q=solarOrbitPoint(orbit,orbit.phase+orbit.omega*years),stored=solarPositions[i];stored.x=q.px;stored.y=q.py;stored.z=q.z;stored.hidden=!q.visible||solarOccludes(q,sunRadius);stored.size=(1.15+.4*q.k)*Math.sqrt(.65+.35*Math.abs(q.z/orbit.radius));stored.a=(.36+.48*clamp((1-q.z/orbit.radius)/2,0,1))*Math.pow((i<beltCapacity?SOLAR_VIEW.beltInner:SOLAR_VIEW.inner)/orbit.radius,.75)*clamp(active-i,0,1)*alpha;}
 // 先画太阳背后的点，再画圆盘和前方的点。两遍用同一套相机深度。
 for(let side=0;side<2;side++){
  drawSolarAxes(side,alpha,sunRadius);
  drawSolarCoil(side,alpha,scene?.coilProgress??solarCoilProgress(),camera);
  for(let i=0;i<solarPlanets.length;i++){
   let remaining=p?(i===2?p.earth/game.C.earth:p.worlds[['mercury','venus',null,'mars'][i]]/PaperclipModel.SOLAR.worlds[['mercury','venus',null,'mars'][i]]):1;if(remaining===0)continue;let orbit=solarPlanets[i];
   for(let j=0;j<100;j++){let q=solarOrbitPoint(orbit,j*Math.PI/50);if(!q.visible||(q.z>=0)!==!!side||solarOccludes(q,sunRadius))continue;dot(q.px,q.py,(side?.28:.12)*alpha,1);}
   let q=solarOrbitPoint(orbit,orbit.phase+orbit.omega*years);
   if(q.visible&&(i!==2||earthPixels<SOLAR_VIEW.earthDetailPixels||pull===1)&&(q.z>=0)===!!side&&!solarOccludes(q,sunRadius)){
    if(i===2){let size=Math.max(2*earthPixels,2.5*earthFraction*q.k);dot(q.px-size/2,q.py-size/2,.8*alpha,size);}
    else dot(q.px,q.py,.8*alpha,2.3*q.k*Math.cbrt(remaining));
    drawIrradiation(q.px,q.py,scene?scene.irradiation[['mercury','venus','earth','mars'][i]]:solarIrradiation(['mercury','venus','earth','mars'][i]),alpha,i);
   }
  }
  for(let i=0;i<Math.ceil(asteroidPoints);i++){let orbit=solarAsteroids[i],q=solarOrbitPoint(orbit,orbit.phase+orbit.omega*years);if(q.visible&&(q.z>=0)===!!side&&!solarOccludes(q,sunRadius))surfaceDot(q.px,q.py,.26*clamp(asteroidPoints-i,0,1)*alpha,1.25,'asteroid');}
  if(p?.worldMining&&p.worlds.others>0){let remaining=p.worlds.others/PaperclipModel.SOLAR.worlds.others;for(let i=0;i<solarMinorWorlds.length;i++){let orbit=solarMinorWorlds[i],q=solarOrbitPoint(orbit,orbit.phase+orbit.omega*years);if(q.visible&&(q.z>=0)===!!side&&!solarOccludes(q,sunRadius)){dot(q.px,q.py,.65*alpha,1.8*Math.cbrt(remaining));drawIrradiation(q.px,q.py,(scene?scene.irradiation.others:solarIrradiation('others'))/solarMinorWorlds.length,alpha,i+4);}}}
  for(let i=0;i<count;i++){let q=solarPositions[i];if((q.z>=0)===!!side&&!q.hidden)dot(q.x,q.y,q.a,q.size);}
  if(side===0&&camera.sunVisible){drawSolarBody(camera.x,camera.y,sunPixels,alpha);drawIrradiation(camera.x,camera.y-sunPixels*.85,scene?scene.irradiation.sun:solarIrradiation('sun'),alpha,8);}
 }
 if(inheritedPlane){vctx.restore();planeMatrix=inheritedPlane;}
}
const canvasPaintSerial=new WeakMap(),canvasPaintAreas=new WeakMap(),canvasPaintBounds=new WeakMap();function markCanvasPaint(canvas,areas=null){if(!canvas)return;canvasPaintSerial.set(canvas,(canvasPaintSerial.get(canvas)||0)+1);if(areas===null)canvasPaintAreas.set(canvas,null);else if(canvasPaintAreas.get(canvas)!==null)canvasPaintAreas.set(canvas,[...(canvasPaintAreas.get(canvas)||[]),...areas]);}
function splitColorChannels(source,targets=[]){return ['#ff0000','#00ff00','#0000ff'].map((color,i)=>{let c=targets[i]||document.createElement('canvas');if(c.width!==source.width)c.width=source.width;if(c.height!==source.height)c.height=source.height;let ctx=c.getContext('2d');ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);ctx.globalCompositeOperation='source-over';return c;});}
// 打开后，切片出现时整个地球都会有色散。
const CLEANUP_RGB_DISPERSION=true;
function cleanupSlices(time,width,height){
 const cycle=Math.floor(time/3.1),seed=cycle*47+9101,local=time-cycle*3.1,onset=.22+seeded(seed)*.55;
 if(local<onset||local>=onset+.28+seeded(seed+1)*.08)return [];
 const tick=Math.floor((local-onset)/.045),frame=seed+tick*127;
 const radius=Math.min(width*.24,height*.34),dispersion=CLEANUP_RGB_DISPERSION?Math.min(radius,3+6*seeded(frame+7)):0;
 // 偏移幅度为 1 时，位移上限是地球半径，另外给 RGB 色散留了空间。
 const minOffset=.3,maxOffset=1;
 return Array.from({length:6+Math.floor(seeded(seed+2)*4)},(_,i)=>{let n=frame+i*17,h=height*(.025+.035*seeded(n+4)),magnitude=(radius-dispersion)*clamp(minOffset+(maxOffset-minOffset)*seeded(n+6),0,1);return {y:(.25+.48*seeded(n+3))*height,height:h,offset:(seeded(n+5)<.5?-1:1)*magnitude,dispersion};});
}
let cleanupVisualTask=null,cleanupVisualStart=0;
let cleanupPalette={key:'',base:[],city:[],rgb:{},split:{}};
function cleanupAnimationTime(){const task=game.state.stage===1?game.state.tasks.find(t=>t.id==='release'):null;if(task!==cleanupVisualTask){cleanupVisualTask=task;cleanupVisualStart=visualTime;}return task?visualTime-cleanupVisualStart:null;}
function cleanupColorMix(time){return settings.motion?(1-Math.cos(time*Math.PI*2/1.25))*.5:1;}
function cleanupEarthPalette(time){let mix=Math.round(cleanupColorMix(time)*255),key=visualRGB+':'+mix;if(cleanupPalette.key!==key){let theme=visualRGB.split(',').map(Number),colors={base:theme,city:theme.map((n,i)=>Math.round(n*.4+[255,246,225][i]*.6))};for(let k in colors){let rgb=colors[k].map((v,i)=>Math.round(v+([255,52,40][i]-v)*mix/255));cleanupPalette.rgb[k]=rgb;cleanupPalette[k]=Array.from({length:256},(_,a)=>'rgba('+rgb.join(',')+','+a/255+')');cleanupPalette.split[k]=[[],[],[]];}cleanupPalette.key=key;}return cleanupPalette;}
function drawCleanupDot(x,y,alpha,size,kind,palette,slices){
 // 把这一带里所有地表点横向挪动，切片两端会自然跟着地球的轮廓。
 let band=null;for(let i=slices.length-1;i>=0;i--){let b=slices[i];if(y>=b.y&&y<b.y+b.height){band=b;break;}}
 let a=clamp(Math.round(alpha*255),0,255),shift=band?band.offset:0,dispersion=slices.length?slices[0].dispersion:0;
 if(!dispersion){dot(x+shift,y,alpha,size,palette[kind][a]);return;}
 for(let channel of [1,0,2]){let rgb=palette.rgb[kind];if(!rgb[channel])continue;let colors=palette.split[kind][channel],color=colors[a];if(!color){let split=[0,0,0];split[channel]=rgb[channel];color=colors[a]='rgba('+split.join(',')+','+a/255+')';}let offset=channel===0?dispersion:channel===2?-dispersion:0;dot(x+shift+offset,y,alpha,size,color);}
}
let dysonView={state:null,start:0};
function clearVizCanvas(ctx){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();}
function drawViz(){if(game.state.stage===4)return;markCanvasPaint($('view'));if(!vctx||!vw)return;let mainContext=vctx,family=game.state.stage<=2?'sol':game.state.stage===3?'expansion':'remains';if(family!==sceneFamily&&sceneFamily==='sol'){const previous=SceneBatch.capture();if(previous.length)lastScenePoints=previous;}if(sceneCanvas.width!==$('view').width||sceneCanvas.height!==$('view').height){sceneCanvas.width=$('view').width;sceneCanvas.height=$('view').height;}sceneContext.setTransform(vscale,0,0,vscale,0,0);vctx=sceneContext;clearVizCanvas(vctx);vctx.lineWidth=.7;scenePoints=lastScenePoints===scenePools[0]?scenePools[1]:scenePools[0];scenePointCount=0;capturePoints=false;let s=game.state;const batch=s.stage<=2&&SceneBatch.begin(vw,vh,vscale);
 let dysonTarget=s.stage===2&&game.has('dyson');if(s.stage<=2&&!dysonTarget){line(12,vh/2,vw-12,vh/2,.035);line(vw/2,25,vw/2,vh-25,.035);}capturePoints=(!batch&&s.stage!==3)||family!==sceneFamily||!!morph;
 if(dysonView.state!==dysonTarget){dysonView={state:dysonTarget,start:dysonView.state===false&&dysonTarget&&settings.motion?visualTime:visualTime-SOLAR_VIEW.zoomSeconds};}
 if(s.stage===1)drawEarth();else if(s.stage===2){let pull=dysonTarget?smoothStep((visualTime-dysonView.start)/SOLAR_VIEW.zoomSeconds):0;if(pull>0){let camera=prepareSolarCamera(pull);drawSolar(1,pull,camera);if(pull<1&&camera.earthPixels>=SOLAR_VIEW.earthDetailPixels)drawEarth(1,pull,camera);}else drawEarth();}else if(s.stage===3){drawStellarUniverse();}else{let remain=1-s.dismantle/8;for(let i=0;i<90*remain;i++){let p=stars[i];dot(vw*.25+p.x*vw*.5,vh*.2+p.y*vh*.6,.2*remain,1.2);}}
 if(batch)SceneBatch.end(vctx);capturePoints=false;scenePoints.length=scenePointCount;vctx=mainContext;clearVizCanvas(vctx);if(family!==sceneFamily&&sceneFamily&&settings.motion&&lastScenePoints.length&&scenePoints.length)morph={from:lastScenePoints.map(p=>({...p})),start:visualTime};sceneFamily=family;
 let elapsed=morph?(visualTime-morph.start)/1.6:1;if(morph&&elapsed<1){let t=smoothStep(elapsed),from=morph.from,count=Math.min(1100,Math.max(from.length,scenePoints.length)),points=[];vctx.globalAlpha=smoothStep((t-.55)/.45);vctx.drawImage(sceneCanvas,0,0,vw,vh);vctx.globalAlpha=1;for(let i=0;i<count;i++){let a=from[Math.floor(i/count*from.length)],b=scenePoints[Math.floor(i/count*scenePoints.length)],arc=Math.sin(t*Math.PI)*(seeded(i+3700)-.5)*.12,x=a.x+(b.x-a.x)*t+arc,y=a.y+(b.y-a.y)*t+arc*.5,alpha=a.a+(b.a-a.a)*t,size=Math.max(1,a.size+(b.size-a.size)*t);dot(x*vw,y*vh,alpha*(1-smoothStep((t-.85)/.15)),size);points.push({x,y,a:alpha,size});}lastScenePoints=points;}else{morph=null;vctx.drawImage(s.stage===3&&StellarPixels.output?StellarPixels.output:sceneCanvas,0,0,vw,vh);lastScenePoints=scenePoints;}
}
function smoothView(real){const blend=-Math.expm1(-Math.min(real,.1)/.085),dy=viewTargetYaw-viewYaw,dp=viewTargetPitch-viewPitch;if(Math.abs(dy)+Math.abs(dp)<1e-7)return;viewYaw=Math.abs(dy)<1e-7?viewTargetYaw:viewYaw+dy*blend;viewPitch=Math.abs(dp)<1e-7?viewTargetPitch:viewPitch+dp*blend;viewDirty=true;}
function toggleViewDetail(p){if(game.state.stage!==1)return toggleNearGrid();const r=$('view').getBoundingClientRect();if(Math.hypot(p.x-r.left-vw*.5,p.y-r.top-vh*.49)>Math.min(vw*.24,vh*.34))return false;earthDaylight=!earthDaylight;drawViz();return true;}
function resetView(){clearTimeout(viewClickTimer);dysonView.state=null;viewYaw=viewTargetYaw=0;viewPitch=viewTargetPitch=0;sceneFamily='';lastScenePoints=[];morph=null;drawViz();}
$('view').addEventListener('dblclick',e=>e.preventDefault());$('view').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='Home'){resetView();return;}viewTargetYaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;viewTargetPitch=clamp(viewTargetPitch+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0),-1.35,1.35);drawViz();});

function humanWorldState(){
 if(game.has('scarcity'))return copy('copy.an-age-of-abundance');
 if(game.has('peace'))return copy('copy.peace-on-earth');
 if(game.has('automation'))return copy('copy.unprecedented-prosperity');
 const recovery=game.projectResources(game.defs.find(d=>d.id==='automation')).products;
 if(game.has('cdzClosure')&&game.state.h.industrialProductKg>=recovery)return copy('copy.growing-prosperity');
 if(game.has('cdzInspection'))return copy('copy.widespread-unease');
 if(game.has('cdzProposal')||game.state.tasks.some(t=>t.id==='cdzProposal'))return copy('copy.labor-upheaval');
 if(game.has('math'))return copy('copy.undercurrents');
 return copy('copy.business-as-usual');
}
function updateVizLabels(){let s=game.state;document.body.classList.toggle('solar-view',s.stage===2&&game.has('dyson'));if(s.stage!==1)$('vizState').classList.remove('danger');let full=s.stage===2&&game.planetRates().coverage>=1-1e-12,showPrevious=full&&!game.has('dyson')&&!game.has('ion');$('vizPreviousState').classList.toggle('hidden',!showPrevious);setHTML('vizPreviousState',showPrevious?'100.0% '+localText(copy('copy.photovoltaic-coverage')):'');if(s.stage===1){setHTML('vizCode','');setHTML('vizMode','');setHTML('vizCoord',copy('viz.earth-coordinates'));setHTML('vizScale',copy('viz.earth-radius'));setHTML('vizCaption',copy('interface.earth')+game.dateParts(s.clock).year.toString());if(!renderCleanupPopulation())setHTML('vizState','<i class="status-dot"></i>'+humanWorldState());setHTML('topCode',copy('viz.earth-object'));}else if(s.stage===2){let solar=game.has('dyson');setHTML('vizCode',solar?copy('interface.dyson-swarm-2'):game.has('chemicalLaunch')?copy('interface.orbit'):copy('interface.surface'));setHTML('vizMode',game.has('ion')?copy('copy.mass-extraction'):game.has('chemicalLaunch')?copy('interface.laser-thermal-ir'):copy('interface.pv-thermal-ir'));setHTML('vizCoord',solar?(game.has('ion')?'0.4–2.4 AU':'2.1–2.4 AU'):game.has('chemicalLaunch')?copy('interface.orbit-laser'):copy('viz.earth-coordinates'));setHTML('vizScale',solar?'P = '+stripNumberMarkup(wattNumber(game.planetRates().spacePower)):'M = '+stripNumberMarkup(kg(s.p.earth)));setHTML('vizCaption',solar?copy('copy.solar-system-dyson-swarm'):game.has('chemicalLaunch')?copy('copy.earth-orbital-swarm'):copy('copy.earth-surface-industry'));let rates=game.planetRates();setHTML('vizState',solar?(game.has('starLifting')?copy('copy.star-lifting'):game.has('rockyWorlds')?copy('copy.rocky-body-mining'):game.has('ion')?copy('project.ion.name'):copy('project.asteroids.name')):full?localText(copy('copy.mean-surface-temperature'))+' '+Math.round(surfaceTemperature(s.p))+' K':(rates.coverage*100).toFixed(1)+'% '+localText(copy('copy.photovoltaic-coverage')));setHTML('topCode',copy('copy.object-002-terra'));}else if(s.stage===3){updateSpaceVizLabels();}else{setHTML('vizCode',copy('copy.remaining-structures'));setHTML('vizMode','');setHTML('vizCoord','');setHTML('vizScale','');setHTML('vizCaption','');setHTML('vizState','');setHTML('topCode','');}}
let battleVisual=null,battleParticles=[],battleSparks=[],battleAge=0,battleLastTime=0,battleSnapshot=null;
/*__战役__*/

// 先按当前速度累积模拟时间，到物理步或玩家操作时一起结算。
let pendingDeparture=null,departureFinalImage=null;
let pendingPhysicsReal=0,pendingPhysicsDays=0,lastSimulationTime=performance.now(),manualRateSamples=[];
function accrueSimulationTime(now=performance.now()){let s=game.state,stamp=Math.max(now,lastSimulationTime),elapsed=(stamp-lastSimulationTime)/1000;lastSimulationTime=stamp;if(!document.hidden&&!s.paused&&!s.ending&&!s.negotiation&&!modalType&&!modalMotion&&!screenTransition&&!pendingDeparture){pendingPhysicsReal+=elapsed;pendingPhysicsDays+=elapsed*game.effectiveSpeed();}else{pendingPhysicsReal=0;pendingPhysicsDays=0;}}
function consumeSimulationTime(){
 const elapsed=pendingPhysicsReal,days=pendingPhysicsDays;pendingPhysicsReal=0;pendingPhysicsDays=0;if(!(days>0))return;
 const s=game.state,stage=s.stage,before=game.clipCount();
 const cleanup=stage===1?s.tasks.find(t=>t.id==='release'&&t.remaining<=days):null;
 if(cleanup&&(ANDROID_BUILD||settings.motion)&&!pendingDeparture){const epsilon=Math.min(1e-6,cleanup.remaining);game.advance(Math.max(0,cleanup.remaining-epsilon));s.h.population=0;pendingDeparture={kind:'human',days:Math.max(1e-8,cleanup.remaining),readyAt:performance.now()+100};render();drawViz();screenRenderer?.invalidate();return;}
 const flight=stage===2?s.tasks.find(t=>t.id==='starflight'&&t.remaining<=days):null;
 if(flight&&settings.motion&&!pendingDeparture){const epsilon=Math.min(1e-6,flight.remaining);game.advance(Math.max(0,flight.remaining-epsilon));departureSolarScene=captureDepartureSolar();pendingDeparture={days:Math.max(1e-8,flight.remaining),readyAt:performance.now()+100};render();drawViz();screenRenderer?.invalidate();return;}
 const done=game.advance(days),after=game.clipCount();
 recordProduction(elapsed,done,stage===s.stage?Math.max(0,after-before):0);
}
function flushSimulationTime(now=performance.now()){accrueSimulationTime(now);consumeSimulationTime();}
function recordManualProduction(now){let last=manualRateSamples.at(-1);if(last&&now-last.at<16)last.count++;else manualRateSamples.push({at:now,count:1});}
function updateManualState(){let b=document.querySelector('[data-action="manual"]'),s=game.state;if(!b||s.stage!==1)return;let ready=s.h.population>0&&s.h.material+1e-12>=game.C.clipMass;b.disabled=!ready||s.paused;if(b.dataset.materialReady!==String(ready))b.dataset.materialReady=String(ready);}
function renderImmediateHuman(){let h=game.state.h;renderClipCount();setHTML('material',kg(h.material));setHTML('stock',countNumber(h.stock)+copy('interface.clips'));updateManualState();}

let lastFrame=performance.now(),lastRender=0,lastSave=0,lastClock=0;
let screenMapScale=1,backgroundTime=0,lastBackground=0;
let screenBackdrop=null,screenBloomProfile={tightCut:.02,wideCut:.006,tightGain:.55,wideGain:1.6,radius:5};
function screenCellPitch(){const size=settings.noise||5;return {x:innerWidth/Math.ceil(innerWidth/size),y:innerHeight/Math.ceil(innerHeight/size)};}
function backdropDither(x,y){const hash=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);return (Math.imul(hash^(hash>>>13),1274126177)>>>16)/65536;}
function screenVignetteOpacity(radius){
 return radius<=.44?0:radius<=.72?(radius-.44)/.28*.10:radius<=.92?.10+(radius-.72)/.20*.54:Math.min(1,.64+(radius-.92)/.20*.36);
}
function screenScanFade(radius){return radius<.45?1-radius/.45*.35:radius<.75?.65-(radius-.45)/.3*.43:.22-(radius-.75)/.25*.212;}
const haloLevels=128,haloRadii=32,haloScanPhases=16,haloDitherLevels=16;
let haloGeometry=null,haloResponse=null;
function crtScanWave(phase){
 const angle=Math.abs(phase-Math.round(phase))*Math.PI*2;
 return angle<Math.PI*.8?.5+.5*Math.cos(angle/.8):0;
}
function haloScanSamples(period,wideRadius){
 if(!period)return [[0,0,0]];
 const weights=Array.from({length:25},(_,i)=>Math.exp(-.5*((i-12)/4)**2)),sum=weights.reduce((a,b)=>a+b,0);
 const blur=(phase,sigma)=>sigma/period>=.75?.4:weights.reduce((value,w,i)=>value+w*crtScanWave(phase+(i-12)*sigma/(4*period)),0)/sum;
 return Array.from({length:haloScanPhases},(_,i)=>{const phase=i/(2*(haloScanPhases-1));return [crtScanWave(phase),blur(phase,.65),blur(phase,wideRadius)];});
}
function prepareHaloResponse(shapes,rgb,ending,period,vignette){
 const {tightGain,tightCut,wideGain,wideCut,radius}=screenBloomProfile,samples=haloScanSamples(period,radius),count=shapes.length*samples.length;
 const coefficients=new Float32Array(count*18),strength=ending?.007:.035;
 for(let index=1;index<shapes.length;index++){
  const shape=shapes[index],h=Math.floor(shape/haloRadii)*strength/(haloLevels-1),distance=(shape%haloRadii)/(haloRadii-1);
  const shade=vignette?1-screenVignetteOpacity(distance):1;
  const fade=vignette?screenScanFade(distance):1;
  const scan=(ending?.024:.06)*fade;
  for(let phase=0;phase<samples.length;phase++){
   const [wave,near,far]=samples[phase],offset=(index*samples.length+phase)*18;
   for(let c=0;c<3;c++){
    const light=rgb[c]*shade/255;
    for(let layer=0;layer<2;layer++){
     const opacity=h*layer,scanLight=(1-opacity)*scan*light,haloLight=opacity*light;
     const raw=haloLight+scanLight*wave,tight=Math.max(0,(haloLight+scanLight*near)*tightGain-tightCut),wide=Math.max(0,(haloLight+scanLight*far)*wideGain-wideCut);
     const at=offset+c*6+layer*3;
     coefficients[at]=raw;coefficients[at+1]=(1-raw)*(tight+wide);coefficients[at+2]=-(1-raw)*tight*wide;
    }
   }
  }
 }
 return {coefficients,palette:new Uint32Array(count*haloDitherLevels),phaseCount:samples.length,gain:-1};
}
function updateHaloPalette(response,gain){
 const {coefficients,palette,phaseCount}=response,gainSquared=gain*gain;
 const lit=at=>coefficients[at]+gain*coefficients[at+1]+gainSquared*coefficients[at+2];
 // 先把扫描线和底色加在一起，再算泛光。只把光晕带来的增量叠回画面。
 for(let index=phaseCount;index<coefficients.length/18;index++){
  const at=index*18,r=lit(at),g=lit(at+6),b=lit(at+12);
  const dr=lit(at+3)-r,dg=lit(at+9)-g,db=lit(at+15)-b;
  const alpha=Math.max(dr/(1-r),dg/(1-g),db/(1-b));
  const red=(dr+r*alpha)*255,green=(dg+g*alpha)*255,blue=(db+b*alpha)*255;
  for(let rank=0;rank<haloDitherLevels;rank++){
   const d=(rank+.5)/haloDitherLevels,R=Math.floor(red+d),G=Math.floor(green+d),B=Math.floor(blue+d),A=Math.max(R,G,B);
   palette[index*haloDitherLevels+rank]=A?Math.round(R*255/A)|Math.round(G*255/A)<<8|Math.round(B*255/A)<<16|A<<24:0;
  }
 }
 response.gain=gain;
}
function updateScreenHalo(width,height,rgb,ending,nativeOptics){
 const bend=!nativeOptics&&settings.curve?screenMapScale:0,gain=nativeOptics?0:Number(settings.bloom),vignette=!nativeOptics&&settings.vignette;
 const period=!nativeOptics&&settings.crt?settings.crt*screenCellPitch().y/(settings.noise||5):0;
 const phaseOffset=period?.5/Math.max(1,settings.crt)*5:0;
 const geometryKey=[width,height,innerWidth,innerHeight,bend,period,phaseOffset].join(':'),responseKey=[geometryKey,rgb,ending,vignette].join(':'),key=responseKey+':'+gain;
 if(screenBackdrop?.haloKey===key)return;
 const halo=$('glassLight'),ctx=halo.getContext('2d',{willReadFrequently:true});
 if(haloGeometry?.key!==geometryKey){
  if(halo.width!==width||halo.height!==height){halo.width=width;halo.height=height;}
  const image=ctx.createImageData(width,height),indices=new Uint16Array(width*height),phaseRanks=new Uint8Array(indices.length),edges=[];
  const shapes=[0],shapeIndices=new Uint16Array(haloLevels*haloRadii),offset=[0,0],bendX=bend/innerWidth,bendY=bend/innerHeight;
  // 光晕和扫描线用同一套曲面坐标和边缘裁切。光晕只缓存画面里实际用到的颜色组合。
  for(let y=0;y<height;y++){
   const v=(y+.5)/height;
   for(let x=0;x<width;x++){
    const u=(x+.5)/width;
    if(bend)sampleScreenWarp(u,v,offset);
    const sx=u+offset[0]*bendX,sy=v+offset[1]*bendY,coverage=bend?Math.min(sx*width,(1-sx)*width,sy*height,(1-sy)*height):1;
    if(coverage<=0)continue;
    const p=sx*2-1,q=sy*2-1,level=Math.round((haloLevels-1)*Math.exp(-3*((p/1.1)**2+((q+.04)/1.04)**2)));
    if(!level)continue;
    const radius=Math.round((haloRadii-1)*Math.sqrt((p*p+q*q)/2));
    const shape=level*haloRadii+radius,i=y*width+x;
    if(!shapeIndices[shape]){shapeIndices[shape]=shapes.length;shapes.push(shape);}
    indices[i]=shapeIndices[shape];
    const phase=period?sy*innerHeight/period-phaseOffset:0,bin=Math.round(2*(haloScanPhases-1)*Math.abs(phase-Math.round(phase)));
    phaseRanks[i]=bin*haloDitherLevels+Math.floor(backdropDither(x,y)*haloDitherLevels);
    if(coverage<1)edges.push(i,coverage);
   }
  }
  haloGeometry={key:geometryKey,image,indices,phaseRanks,edges,shapes,pixels:new Uint32Array(image.data.buffer)};
 }
 const {image,indices,phaseRanks,edges,shapes,pixels}=haloGeometry;
 if(haloResponse?.key!==responseKey)haloResponse={key:responseKey,...prepareHaloResponse(shapes,rgb,ending,period,vignette)};
 if(haloResponse.gain!==gain)updateHaloPalette(haloResponse,gain);
 const {palette,phaseCount}=haloResponse,stride=phaseCount*haloDitherLevels;
 for(let i=0;i<indices.length;i++)pixels[i]=palette[indices[i]*stride+phaseRanks[i]];
 for(let edge=0;edge<edges.length;edge+=2){const i=edges[edge],pixel=pixels[i];pixels[i]=(pixel&0xffffff)|(Math.round((pixel>>>24)*edges[edge+1])<<24);}
 ctx.putImageData(image,0,0);return {halo,haloKey:key};
}
function updateScreenBackdrop(rgb,nativeOptics=ANDROID_BUILD&&mobileUsesHardwareScreen()){
 const density=devicePixelRatio||1,width=Math.max(1,Math.round(innerWidth*density)),height=Math.max(1,Math.round(innerHeight*density)),ending=game.state.stage===4;
 const nextHalo=updateScreenHalo(width,height,rgb,ending,nativeOptics);
 const key=[width,height,rgb,settings.crt,settings.noise,settings.vignette,ending].join(':');
 if(screenBackdrop?.key===key){if(nextHalo)Object.assign(screenBackdrop,nextHalo);return;}
 const scan=document.createElement('canvas'),dark=document.createElement('canvas');scan.width=width;scan.height=height;dark.width=1;dark.height=height;const dc=dark.getContext('2d'),dp=dc.createImageData(1,height),sc=scan.getContext('2d',{willReadFrequently:true}),sp=sc.createImageData(width,height),period=Math.max(1,settings.crt)*screenCellPitch().y/(settings.noise||5)*density,scanStrength=ending?.024:.06;
 const xx=new Float32Array(width);for(let x=0;x<width;x++)xx[x]=((x+.5)/width-.5)*2;
 for(let y=0;y<height;y++){const yy=((y+.5)/height-.5)*2,wave=crtScanWave((y+.5)/period-.5/Math.max(1,settings.crt)*5);dp.data[y*4+3]=Math.round(255*.15*(1-wave));
  for(let x=0;x<width;x++){const i=(y*width+x)*4,mask=settings.vignette?screenScanFade(Math.sqrt((xx[x]*xx[x]+yy*yy)/2)):1;
   for(let k=0;k<3;k++)sp.data[i+k]=rgb[k];sp.data[i+3]=Math.floor(255*scanStrength*wave*mask+backdropDither(x,y));
  }
 }
 sc.putImageData(sp,0,0);dc.putImageData(dp,0,0);$('scanlines').style.backgroundImage='url('+scan.toDataURL()+')';screenBackdrop={...screenBackdrop,...nextHalo,key,scan,dark,ending};
}

function updateBloomFilter(){
 screenBloomProfile=game.state.stage===4?{tightCut:.02,wideCut:.02,tightGain:.55,wideGain:1.6,radius:5}:{tightCut:.02,wideCut:.006,tightGain:.55,wideGain:1.6,radius:5};
 const gain=settings.bloom;
 for(const [id,value]of [['glowTight',gain?.65:0],['glowWide',gain?screenBloomProfile.radius:0]])$(id).setAttribute('stdDeviation',value);
 for(const [id,value]of [['glowLevel',gain*screenBloomProfile.wideGain],['glowLevelTight',gain*screenBloomProfile.tightGain],['edgeGlowLevel',gain*screenBloomProfile.wideGain]]){
  const cut=id==='glowLevel'?-screenBloomProfile.wideCut:id==='glowLevelTight'?-screenBloomProfile.tightCut:0;
  for(const f of $(id).parentElement.querySelectorAll('feFuncR,feFuncG,feFuncB')){f.setAttribute('slope',value);f.setAttribute('intercept',gain*cut);}
 }
}
function updateBloomSetting(){
 updateBloomFilter();updateScreenBackdrop(visualRGB.split(',').map(Number));screenRenderer?.redrawEffects();
}
function updateScreenEffects(){
 const width=window.innerWidth,height=window.innerHeight,canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(64,64),bend=settings.curve?.022:0;screenMapScale=Math.max(width,height)*bend*2;
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){let u=(x/63-.5)*2,v=(y/63-.5)*2,r=u*u+v*v,i=(y*64+x)*4;pixels.data[i]=Math.round(255*(.5+width*.5*bend*u*r/Math.max(1,screenMapScale)));pixels.data[i+1]=Math.round(255*(.5+height*.5*bend*v*r/Math.max(1,screenMapScale)));pixels.data[i+2]=128;pixels.data[i+3]=255;}screenWarpData=pixels.data;ctx.putImageData(pixels,0,0);$('barrelMap').setAttribute('href',canvas.toDataURL());let filter=$('phosphorScreen'),padding=16;filter.setAttribute('x',(-padding/width*100)+'%');filter.setAttribute('y',(-padding/height*100)+'%');filter.setAttribute('width',(100+2*padding/width*100)+'%');filter.setAttribute('height',(100+2*padding/height*100)+'%');$('barrelMap').setAttribute('x',0);$('barrelMap').setAttribute('y',0);$('barrelMap').setAttribute('width',width);$('barrelMap').setAttribute('height',height);$('barrelWarp').setAttribute('scale',screenMapScale);
 updateBloomFilter();
 const split=settings.rgb,radial=split/1.05*1.6;$('redFringe').setAttribute('scale',-radial);$('blueFringe').setAttribute('scale',radial);$('redOffset').setAttribute('dx',-split);$('blueOffset').setAttribute('dx',split);
 const rgb=getComputedStyle(document.documentElement).getPropertyValue('--rgb').trim().split(',').map(Number),norm=rgb.map(n=>n/255),lum=norm[0]*.2126+norm[1]*.7152+norm[2]*.0722;for(let i=0;i<3;i++){let row=[0,0,0,0,0];row[i]=1;let matrix=[0,1,2].flatMap(j=>j===i?row:[0,0,0,0,0]).concat([0,0,0,1,0]);$(['redChannel','greenChannel','blueChannel'][i]).setAttribute('values',matrix.join(' '));}
 updateScreenBackdrop(rgb);refreshEndingColor(rgb);
 // 每个单元含三条细长荧光条，条间和端点留有暗缝。
 canvas.width=canvas.height=12;const mask=ctx.createImageData(12,12);for(let y=0;y<12;y++)for(let x=0;x<12;x++){const i=(y*12+x)*4;mask.data[i+3]=Math.round(255*(y===11?.78:y===10?.32:x%4===3?.58:[.14,.02,.14][Math.floor(x/4)]));}ctx.putImageData(mask,0,0);$('grain').style.backgroundImage='url('+canvas.toDataURL()+')';const pitch=screenCellPitch();$('grain').style.backgroundSize=pitch.x+'px '+pitch.y+'px';$('grain').style.backgroundPosition=pitch.x/24+'px '+pitch.y/12+'px';
 drawBackground();screenRenderer?.invalidate(true);
}
const ambientPath=(()=>{
 const path=[];function straight(x1,y1,x2,y2){const count=Math.ceil(Math.hypot(x2-x1,y2-y1)*34);for(let i=0;i<=count;i++)path.push([x1+(x2-x1)*i/count,y1+(y2-y1)*i/count]);}function arc(cx,cy,r,start,end){for(let a=start;a<=end;a+=.04)path.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}
 straight(.55,.8,.55,-.78);arc(0,-.78,.55,Math.PI,2*Math.PI);straight(-.55,-.78,-.55,.8);arc(-.08,.8,.47,0,Math.PI);straight(.39,.8,.39,-.48);arc(.02,-.48,.37,Math.PI,2*Math.PI);straight(-.35,-.48,-.35,.48);return path;
})();
function drawBackground(){
 const c=$('ambient'),before=canvasPaintBounds.get(c)||[];markCanvasPaint(c,before);canvasPaintBounds.set(c,[]);const rect=c.getBoundingClientRect(),cell=rect.width<700?5:7,w=Math.ceil(rect.width/cell),h=Math.ceil(rect.height/cell);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);if(!w||!h||!settings.ambient||game.state.ending||game.state.stage===4)return;
 const rgb=getComputedStyle(document.documentElement).getPropertyValue('--rgb').trim(),base=Math.min(Math.max(window.innerWidth,window.innerHeight)*.077,rect.width*.115,window.innerHeight*.135),occupied=Array.from(document.querySelectorAll('.viz')).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({left:r.left-rect.left-20,right:r.right-rect.left+20,top:r.top-rect.top-20,bottom:r.bottom-rect.top+20})),small=rect.width<700;
 const slots=small?[[.22,.19,.92,-.72],[.77,.57,1,1.12],[.31,.86,.78,-1.7]]:[[.19,.64,1,-.72],[.83,.55,.84,1.12],[.58,.76,.65,-1.7]],placed=[],bounds=[];
 for(let n=0;n<slots.length;n++){
  let[x,y,size,turn]=slots[n],scale=base*size,reach=scale*1.48,cx=x*rect.width,cy=y*rect.height;const candidates=[[cx,cy],[cx,cy+reach*1.6],[cx,cy-reach*1.6],[rect.width*(x<.5?.12:.88),cy]];let anchor=candidates.find(([px,py])=>px>reach&&px<rect.width-reach&&py>reach+100&&py<rect.height-reach-24&&!occupied.some(r=>px+reach>r.left&&px-reach<r.right&&py+reach>r.top&&py-reach<r.bottom)&&!placed.some(p=>Math.hypot(px-p.x,py-p.y)<reach+p.r));if(!anchor)continue;[cx,cy]=anchor;placed.push({x:cx,y:cy,r:reach});
  const angle=backgroundTime*(n%2?-.027:.031)+n*.8+.35,tilt=.25+Math.sin(backgroundTime*.013+n*1.7)*.18,spin=turn+Math.sin(backgroundTime*.007+n)*.12,cs=Math.cos(spin),sn=Math.sin(spin),pixels=new Map();
  for(let i=0;i<ambientPath.length;i++){let[x,y]=ambientPath[i],z=Math.sin(i*.03)*.012,xx=x*Math.cos(angle)+z*Math.sin(angle),zz=-x*Math.sin(angle)+z*Math.cos(angle),yy=y*Math.cos(tilt)-zz*Math.sin(tilt),depth=3.8/(3.8+zz),px=Math.round((cx+(xx*cs-yy*sn)*scale*depth)/cell),py=Math.round((cy+(xx*sn+yy*cs)*scale*depth)/cell),key=py*w+px,alpha=.062+.018*(zz+.55);if(px>=0&&px<w&&py>=0&&py<h)pixels.set(key,Math.max(alpha,pixels.get(key)||0));}
  let x0=w,y0=h,x1=-1,y1=-1;for(let[key,alpha]of pixels){let x=key%w,y=Math.floor(key/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);ctx.fillStyle='rgba('+rgb+','+alpha+')';ctx.fillRect(x,y,1,1);}if(x1>=0)bounds.push({x:x0*rect.width/w-1,y:y0*rect.height/h-1,width:(x1-x0+1)*rect.width/w+2,height:(y1-y0+1)*rect.height/h+2});
 }
canvasPaintBounds.set(c,bounds);markCanvasPaint(c,bounds);
}
function styleRange(el){const lo=Number(el.min)||0,hi=Number(el.max)||100;let fill=Math.max(0,Math.min(100,(el.dataset.actualFill!==undefined?Number(el.dataset.actualFill):(Number(el.value)-lo)/(hi-lo||1)*100)))+'%';if(el.style.getPropertyValue('--fill')!==fill)el.style.setProperty('--fill',fill);}
window.addEventListener('resize',updateScreenEffects);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{speedTrackWidth=Math.round(entries[0].borderBoxSize?.[0]?.inlineSize??entries[0].contentRect.width);speedTickKey='';renderSpeedTicks(game.speedMin(),game.speedMax());}).observe($('speed'));
if(typeof ResizeObserver!=='undefined')new ResizeObserver(drawBackground).observe($('ambient'));

