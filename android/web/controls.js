const mobile={index:0,position:0,visibleMask:1,pagerWidth:0,pagerScrolled:false,touch:null,touchActive:false,inputType:'touch',notices:new Map(),pending:new Set(),readyProjects:new Set(),noticeMotion:null,stage:0,viewTap:null,battleTap:null,titleTap:null,clickUntil:0,refreshAll:false,rendering:false,deferred:new Map(),elementPages:new WeakMap(),intersections:new WeakMap(),visualSizes:new WeakMap(),observed:new WeakSet(),battlePaint:false};
function mobileRequestRender(){if(!mobile.inputRender)mobile.inputRender=requestAnimationFrame(()=>{mobile.inputRender=0;render();});}
function mobileRenderDensity(){
 if(settings.renderScale==='device')return devicePixelRatio||1;
 if(['1','.75','.5'].includes(settings.renderScale))return Number(settings.renderScale);
 const size=parseFloat(getComputedStyle(document.body).fontSize);
 return Math.min(devicePixelRatio||1,Math.max(12/size,Math.min(1280,innerWidth)/innerWidth));
}
function mobileUsesHardwareScreen(){return mobile.hardwareAvailable&&settings.renderScale==='device'&&['auto','native'].includes(settings.renderer);}
function mobileApplyScreenFilter(){
 $('crtGlass').style.filter=settings.bloom||settings.curve||settings.rgb?'':'none';
 mobileSyncScreen();
}
function mobileSyncScreen(){
 if(!mobile.hardwareAvailable)return;
 const enabled=mobileUsesHardwareScreen(),key=[enabled,innerWidth,innerHeight,settings.bloom,settings.curve,settings.rgb,game.state.stage===4].join(':');
 mobile.hardware=enabled;
 const halo=$('glassLight'),parent=enabled?$('crtGlass'):document.body;if(halo.parentElement!==parent)parent.append(halo);
 $('crtGlass').style.willChange=enabled?'auto':'';if(enabled){$('crtGlass').style.filter='none';screenWarpData=null;}
 if(key!==mobile.hardwareKey){mobile.hardwareKey=key;window.AndroidGame.configureScreen(enabled,innerWidth,settings.bloom,settings.curve,settings.rgb,game.state.stage===4);}
}
function mobilePageVisible(index){return !!(mobile.visibleMask&(1<<index));}
function mobileElementPage(el){let index=mobile.elementPages.get(el);if(index===undefined){index=mobile.pages.indexOf(el.closest('.column'));mobile.elementPages.set(el,index);}return index;}
function mobileElementVisible(el,index=mobileElementPage(el)){return !!el&&(index<0||mobilePageVisible(index))&&mobile.intersections.get(el)!==false;}
function mobileBattleSize(canvas,visible,defaultWidth=0,defaultHeight=0){
 const measured=mobile.visualSizes.get(canvas);
 if(measured)return measured;
 if(!visible)return {width:canvas.width,height:canvas.height};
 return {width:Math.round(canvas.clientWidth||defaultWidth),height:Math.round(canvas.clientHeight||defaultHeight)};
}

function mobileDrawEnding(ctx,canvas,width,height){
 ctx.save();
 ctx.translate(width,0);
 ctx.scale(-1,1);
 if(height>width){
  ctx.translate(width,0);
  ctx.rotate(Math.PI/2);
  ctx.drawImage(canvas,0,0,height,width);
 }else ctx.drawImage(canvas,0,0,width,height);
 ctx.restore();
}
function mobilePanel(base,index){let last=-Infinity;return function(...args){const now=performance.now();if(mobile.refreshAll||game.state.stage===4||screenTransition||mobilePageVisible(index)||now-last>=250){last=now;return base(...args);}};}
function mobileObserveVisuals(){
 for(const id of ['view','battleCanvas','battleYomi','investmentChart']){const el=$(id);if(el&&!mobile.observed.has(el)){mobile.observed.add(el);mobile.visualObservers[mobileElementPage(el)].observe(el);mobile.visualResizer.observe(el);}}
}
function mobileTrackMilestones(){
 const s=game.state,cleanup=s.stage>1||s.tasks.some(t=>t.id==='release'&&t.remaining<t.total),solar=game.has('dyson'),attack=(s.s?.battleCount||0)>0;
 const previous=mobile.milestones;
 if(previous?.owner!==s){
  mobile.milestones={owner:s,cleanup,solar,attack};mobile.sceneFocus=null;mobile.sceneAttention=null;mobile.solarWaiting=false;
  dysonView={state:s.stage===2&&solar,start:visualTime-SOLAR_VIEW.zoomSeconds};return;
 }
 if(!previous.cleanup&&cleanup&&s.stage===1)mobile.sceneFocus={stage:1};
 if(!previous.solar&&solar&&s.stage===2){mobile.sceneFocus={stage:2};mobile.solarWaiting=true;}
 if(!previous.attack&&attack&&s.stage===3)mobile.sceneFocus={stage:3};
 previous.cleanup=cleanup;previous.solar=solar;previous.attack=attack;
}
function mobileFocusScene(blocked){
 const focus=mobile.sceneFocus;if(!focus){if(mobile.sceneAttention&&(mobile.position!==1||mobile.pages[1].scrollTop>.75))mobile.sceneAttention=null;return;}
 if(focus.stage!==game.state.stage){mobile.sceneFocus=null;mobile.solarWaiting=false;return;}
 if(blocked||screenTransition||mobile.stage!==focus.stage)return;
 if(!focus.started){
  focus.started=true;mobile.sceneAttention={target:focus.stage===3?'battleExtras':null};mobileCancelGestures();mobile.noticeMotion=null;
  mobileGo(1,'smooth');mobile.pages[1].scrollTo({top:0,behavior:'smooth'});
 }
 if(mobile.position===1&&mobile.pages[1].scrollTop<.75){
  mobile.sceneFocus=null;
  if(mobile.solarWaiting){mobile.solarWaiting=false;dysonView={state:true,start:settings.motion?visualTime:visualTime-SOLAR_VIEW.zoomSeconds};}
  viewDirty=true;mobile.battlePaint=true;
 }
}
function mobileUpdateSolarView(){
 const target=game.state.stage===2&&game.has('dyson');
 if(mobile.solarWaiting&&target)dysonView={state:true,start:visualTime};
 else if(dysonView.state!==target)dysonView={state:target,start:dysonView.state===false&&target&&settings.motion?visualTime:visualTime-SOLAR_VIEW.zoomSeconds};
}
function mobileAdvanceVisuals(blocked){
 if(mobile.pagerScrolled)mobileScroll();
 mobileTrackMilestones();mobileFocusScene(blocked);mobileUpdateFinal();
 if(mobile.notices.has(mobile.index))mobileShowNotice();
 if(mobile.notices.size&&screenRenderer?.mode!=='browser'){const now=performance.now();if(now-(mobile.noticePaintAt||0)>=50){mobile.noticePaintAt=now;for(const index of mobile.notices.keys())screenRenderer.controlChanged(mobile.tabs[index]);}}
 if(blocked)return;
 const s=game.state;
 if(s.stage<=2)mobileUpdateSolarView();
 if(s.stage===3){
  stellarViewExtent();const u=s.s;if(galaxyFlightView.owner!==u)galaxyFlightView={owner:u,active:u.intergalactic,start:visualTime-.8};
  if(u.intergalactic&&!galaxyFlightView.active){galaxyFlightView.active=true;galaxyFlightView.start=visualTime;}
 }
}
function mobileSnapshotCanvases(ctx,density=1){
 for(const c of $('crtGlass').querySelectorAll('canvas:not(#glassLight)')){
  if(c.id==='spaceTransition'||c.dataset.projectIcon||!c.width||!c.height||!mobileElementVisible(c))continue;
  const r=c.getBoundingClientRect();if(!r.width||!r.height)continue;
  ctx.save();ctx.globalAlpha=Number(getComputedStyle(c).opacity);
  for(let parent=c.parentElement;parent&&parent.id!=='crtGlass';parent=parent.parentElement){const style=getComputedStyle(parent);if([style.overflowX,style.overflowY].some(v=>['auto','scroll','hidden','clip'].includes(v))){const b=parent.getBoundingClientRect();ctx.beginPath();ctx.rect(b.left*density,b.top*density,parent.clientWidth*density,parent.clientHeight*density);ctx.clip();}}
  ctx.drawImage(c,r.left*density,r.top*density,r.width*density,r.height*density);ctx.restore();
 }
}
function mobileControl(el){let control=el?.closest('button,input,select,textarea,a,summary,label');if(control?.matches('label'))control=control.control||control.querySelector('input');return control;}
function mobilePointerDown(e){
 mobile.inputType='touch';mobile.clickUntil=0;clearTimeout(mobile.helpTimer);clearTimeout(mobile.helpHideTimer);hideHelp();clearHitHover();if(!e.isPrimary){e.preventDefault();e.stopImmediatePropagation();mobileCancelGestures(true);return true;}
 const {el,p}=mappedTarget(e);if(!el?.closest('#crtGlass')||el.closest('[data-cleanup]'))return true;
 const tools=document.querySelector('.top-tools');
 if(tools.classList.contains('end-tools-hidden')){
  const inside=!!el.closest('.top-tools'),revealed=mobile.toolsRevealed;
  mobile.toolsRevealed=inside;
  if(inside&&!revealed){mobile.clickUntil=performance.now()+700;e.preventDefault();e.stopImmediatePropagation();return true;}
 }
 const control=mobileControl(el);if(control?.matches(':disabled'))return true;
 if(control?.matches('input[type=range]')){
  e.preventDefault();e.stopImmediatePropagation();
  mobile.touch={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,control,range:true};return true;
 }
 const kind=el===$('view')?'view':el===$('battleCanvas')?'battle':el.closest('#battleTitle')?'battleTitle':null;
 if(kind){
  e.preventDefault();e.stopImmediatePropagation();const owner=kind==='battleTitle'?$('battleTitle'):el;
  pointerRoute={kind,id:e.pointerId,el:owner,x:p.x,y:p.y,moved:false,pointerType:'touch',automatic:false,started:performance.now()};
  if(kind==='view'){clearTimeout(mobile.viewTimer);Object.assign(pointerRoute,{yaw:viewTargetYaw=viewYaw,pitch:viewTargetPitch=viewPitch});owner.classList.add('dragging');}
  if(kind==='battle')steerBattle(p);
  owner.setPointerCapture(e.pointerId);return true;
 }
 const actionable=control?.matches('button,select,a,summary,input[type=checkbox],input[type=radio],input[type=file]');
 mobile.touch={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,control:actionable?control:null};
 if(actionable){e.preventDefault();e.stopImmediatePropagation();showPress(control);beginHold(control);}
 else if(control&&control!==e.target){e.preventDefault();control.focus({preventScroll:true});}
 if(!control&&el.closest('[data-help]'))mobile.helpTimer=setTimeout(()=>{if(mobile.touch?.id===e.pointerId&&!mobile.touch.moved){showHelp(el,p);mobile.helpUntil=performance.now()+2400;mobile.helpHideTimer=setTimeout(hideHelp,2400);}},500);
 return true;
}
function mobileNativeClick(e){
 if(!e.isTrusted||!(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents||!e.pointerType&&mobile.inputType==='touch'&&performance.now()<mobile.clickUntil))return false;
 if(performance.now()<mobile.clickUntil||mobileControl(e.target)?.matches('button,select,a,summary,input[type=range],input[type=checkbox],input[type=radio],input[type=file]')){e.preventDefault();e.stopImmediatePropagation();}
 return true;
}
function mobileMoveRoute(e,p){if(pointerRoute?.pointerType==='touch')pointerRoute.moved||=Math.hypot(p.x-pointerRoute.x,p.y-pointerRoute.y)>10;}
function mobileBeginRange(e,control){
 control.focus({preventScroll:true});
 pointerRoute={kind:'range',id:e.pointerId,el:control,rect:control.getBoundingClientRect(),thumb:Number.parseFloat(getComputedStyle(control).getPropertyValue('--range-thumb-width'))||8,...(control.id==='speed'?{timeScale:speedBounds()}:{})};
}
function mobileMoveTouch(e){
 const touch=mobile.touch;if(!touch||touch.id!==e.pointerId||touch.moved)return;
 const dx=e.clientX-touch.x,dy=e.clientY-touch.y;if(Math.hypot(dx,dy)<=10)return;
 touch.moved=true;holding=null;const control=touch.control;
 if(control){pressedControls.delete(control);control.removeAttribute('data-pressed');}
 // 等手指移动后再判断方向。上下拖动交给页面滚动，滑条值先保持原样。
 if(touch.range&&Math.abs(dx)>=Math.abs(dy)){
  mobile.touch=null;mobileBeginRange(e,control);control.setPointerCapture(e.pointerId);
  e.preventDefault();e.stopImmediatePropagation();updateRangeAt(control,screenInputPoint(e.clientX,e.clientY));
 }
}
function mobileFinishRoute(e,route,p,el){
 if(!['view','battle','battleTitle'].includes(route.kind))return false;
 e.preventDefault();e.stopImmediatePropagation();clearPointerRoute();clearHitHover();
 const tapped=!route.moved&&(el===route.el||route.el.contains(el)),now=e.timeStamp;
 const pair=last=>last&&now-last.at<330&&Math.hypot(p.x-last.x,p.y-last.y)<24;
 if(route.kind==='view'){
  if(!tapped||game.state.stage===1&&performance.now()-route.started>300){clearTimeout(mobile.viewTimer);mobile.viewTap=null;return true;}
  if(pair(mobile.viewTap)){clearTimeout(mobile.viewTimer);mobile.viewTap=null;resetView();}
  else{clearTimeout(mobile.viewTimer);mobile.viewTap={at:now,x:p.x,y:p.y};mobile.viewTimer=setTimeout(()=>{mobile.viewTap=null;toggleViewDetail(p);},330);}
 }else if(route.kind==='battle'){
  const serial=game.state.s.engagement?.serial;
  if(tapped&&pair(mobile.battleTap)&&mobile.battleTap.serial===serial){game.commandBattle(null,null);mobile.battleTap=null;}
  else mobile.battleTap=tapped?{at:now,x:p.x,y:p.y,serial}:null;
 }else{
  if(tapped&&pair(mobile.titleTap)){accrueSimulationTime();game.state.speed=clamp(game.speedMax()/10,game.speedMin(),game.speedMax());dirtySave=true;renderClock();mobile.titleTap=null;}
  else mobile.titleTap=tapped?{at:now,x:p.x,y:p.y}:null;
 }
 return true;
}
function mobileFinishTouch(e,cancel=false){
 const touch=mobile.touch;if(!touch||touch.id!==e.pointerId)return;const repeated=holding?.control===touch.control&&holding.repeated;clearTimeout(mobile.helpTimer);mobile.touch=null;holding=null;
 const control=touch.control;if(!control)return;
 pressedControls.delete(control);control.removeAttribute('data-pressed');
 if(cancel||touch.moved||!control.isConnected||control.disabled||mobileControl(mappedTarget(e).el)!==control)return;
 mobile.clickUntil=performance.now()+700;
 e.preventDefault();e.stopImmediatePropagation();
 if(touch.range){mobileBeginRange(e,control);updateRangeAt(control,mappedTarget(e).p);clearPointerRoute();}
 else if(control.matches('select'))openSelectMenu(control);else if(!repeated){showPress(control);control.click();}
}
function mobileCancelGestures(keepTouches=false){
 if(keepTouches!==true)mobile.touchActive=false;
 clearPointerRoute();holding=null;mobile.touch=null;clearTimeout(mobile.viewTimer);clearTimeout(mobile.helpTimer);clearTimeout(mobile.helpHideTimer);hideHelp();mobile.viewTap=mobile.battleTap=mobile.titleTap=null;
 for(const control of pressedControls.keys())control.removeAttribute('data-pressed');pressedControls.clear();clearHitHover();
}
function mobileReleaseNotice(el){if(mobile.pending.delete(el)){el.style.removeProperty('visibility');contentFlickers.delete(el);}}
function mobileClearNoticeTab(index){mobile.notices.delete(index);mobile.tabs[index].removeAttribute('data-new');if(mobile.noticeMotion?.index===index)mobile.noticeMotion=null;}
function mobileResetNotices(){
 for(const el of mobile.pending)mobileReleaseNotice(el);
 for(const index of mobile.notices.keys())mobileClearNoticeTab(index);
 mobile.readyProjects.clear();
}
function mobileNotice(el,now=performance.now(),key=el?.id,reveal=true){
 const index=mobile.pages.indexOf(el?.closest('.column'));if(index<0)return;
 let list=mobile.notices.get(index);if(!list)mobile.notices.set(index,list=[]);
 let entry=list.find(entry=>entry.el===el);if(entry)entry.reveal||=reveal;else list.push(entry={el,key,id:el.id,card:el.dataset.projectCard,reveal});
 if(entry.reveal){mobile.pending.add(el);contentFlickers.set(el,Infinity);if(el.style.visibility!=='hidden')el.style.visibility='hidden';}
 mobile.tabs[index].setAttribute('data-new','');
}
function mobileNoticeReadyProjects(now,initialized){
 for(const el of document.querySelectorAll('[data-project-card].ready')){
  const key=game.state.stage+':'+el.dataset.projectCard;if(mobile.readyProjects.has(key))continue;
  mobile.readyProjects.add(key);if(initialized)mobileNotice(el,now,'ready:'+key,false);
 }
}
function mobileRefreshNotices(){
 for(const [index,list]of mobile.notices){
  for(let i=list.length-1;i>=0;i--){const entry=list[i];let el=entry.el;
   if(!el.isConnected){mobileReleaseNotice(el);el=entry.id?$(entry.id):entry.card?mobile.pages[index].querySelector('[data-project-card="'+CSS.escape(entry.card)+'"]'):null;}
   // 切换阶段后，隐藏的控件可能还留在 DOM 里。弹窗只是暂时盖住页面，这时保留提醒。
   const inert=el?.closest('[inert]');
   if(!el||el.closest('.column')!==mobile.pages[index]||el.closest('.hidden,[hidden],.end-gone')||inert&&mobile.pages[index].contains(inert)||!entry.reveal&&!el.classList.contains('ready')){
    mobileReleaseNotice(entry.el);list.splice(i,1);continue;
   }
   entry.el=el;if(entry.reveal){if(!mobile.pending.has(el)){mobile.pending.add(el);contentFlickers.set(el,Infinity);}if(el.style.visibility!=='hidden')el.style.visibility='hidden';}
  }
  if(!list.length)mobileClearNoticeTab(index);
 }
}
function mobileShowNotice(){
 const index=mobile.index;
 if(index===1&&mobile.sceneFocus||mobile.position!==index||mobile.touch||mobile.touchActive||pointerRoute||modalType||modalMotion||screenTransition){mobile.noticeMotion=null;return;}
 mobileRefreshNotices();const list=mobile.notices.get(index);if(!list)return;
 const now=performance.now(),page=mobile.pages[index],p=page.getBoundingClientRect(),height=page.clientHeight,batch=[];
 const attention=index===1?mobile.sceneAttention:null;let bottom=-Infinity;
 for(let i=list.length-1;i>=0;i--){
  const entry=list[i],r=entry.reveal?entry.el.getBoundingClientRect():null;
  if(!r?.width||!r.height){mobileReleaseNotice(entry.el);list.splice(i,1);continue;}
  if(!attention||entry.id===attention.target||r.top>=p.top&&r.bottom<=p.top+height){batch.push(entry);bottom=Math.max(bottom,r.bottom);}
 }
 if(!list.length){mobileClearNoticeTab(index);return;}
 if(!batch.length)return;
 if(!attention){
  const scrollTop=page.scrollTop,top=clamp(scrollTop+bottom-p.top-height,0,Math.max(0,page.scrollHeight-height)),motion=mobile.noticeMotion;
  if(!motion||Math.abs(motion.top-top)>1){mobile.noticeMotion={index,top};if(Math.abs(scrollTop-top)>1){page.scrollTo({top,behavior:settings.motion?'smooth':'instant'});return;}}
  if(Math.abs(scrollTop-top)>1)return;
 }
 for(const entry of batch){const {el}=entry;mobileReleaseNotice(el);el.style.opacity='1';contentFlickers.set(el,now);}
 if(batch.length===list.length)list.length=0;else for(const entry of batch)list.splice(list.indexOf(entry),1);
 mobile.noticeMotion=null;
 if(!list.length)mobileClearNoticeTab(index);
}
function mobilePaintTabGlow(ctx,r,color,scale){
 if(!r.width)return;ctx.save();ctx.fillStyle=color;
 for(const [blur,alpha]of [[6,.8],[14,.45]]){ctx.shadowColor='rgba('+visualRGB+','+alpha+')';ctx.shadowBlur=blur*scale;ctx.fillRect(r.left,r.top,r.width,r.height);}
 ctx.restore();
}
function mobileSelect(index){
 if(mobile.selectionInitialized&&mobile.index===index)return;mobile.selectionInitialized=true;
 mobile.index=index;mobile.noticeMotion=null;
 for(let i=0;i<mobile.tabs.length;i++){
  const selected=i===index;mobile.tabs[i].setAttribute('aria-selected',String(selected));mobile.tabs[i].tabIndex=selected?0:-1;
 }
}
function mobileScroll(){
 mobile.pagerScrolled=false;
 const left=mobile.pager.scrollLeft,width=mobile.pagerWidth||1,position=clamp(left/width,0,2),index=Math.round(position),previous=mobile.visibleMask;
 const next=Math.abs(left-index*width)<=1?index:position;
 if(next===mobile.position&&mobile.selectionInitialized)return;
 mobile.position=next;mobile.visibleMask=1<<Math.floor(next)|1<<Math.ceil(next);mobileSelect(index);
 mobile.lines.forEach((line,i)=>{const lo=clamp(next-i,0,1),hi=clamp(next+1-i,0,1);line.style.transform=`translateX(${lo*100}%) scaleX(${hi-lo})`;line.style.visibility=hi>lo?'visible':'hidden';});
 const entering=mobile.visibleMask&~previous;
 if(entering&2){viewDirty=true;mobile.battlePaint=true;}
 if(previous&2&&!mobilePageVisible(1)){clearTimeout(mobile.viewTimer);mobile.viewTap=null;}
 if(entering&&screenRenderer&&!mobile.rendering)render();
}
function mobileGo(index,behavior=settings.motion?'smooth':'instant'){
 mobile.pager.scrollTo({left:index*mobile.pagerWidth,behavior});if(behavior!=='smooth')mobileScroll();
}
function mobilePlaceConsole(){
 const final=mobile.final,parent=final?mobile.journalHome:mobile.console;
 if($('journal').parentElement!==parent){const journal=$('journal');parent.prepend(journal);if(final){resetJournalScroll();journal.scrollTop=Math.max(0,journal.scrollHeight-journal.clientHeight);}}
}
function mobileFullyVisible(el){const index=mobileElementPage(el);return index<0||mobile.position===index;}
function mobileCleanupPending(){return cleanupUI?.some(row=>row.el.isConnected&&!row.done);}
function mobileExitTime(el,start,now){return Number.isFinite(start)?start:now;}
function mobileUpdateFinal(){
 const final=game.state.stage===4&&game.state.dismantle>=11&&endingExitQueue.size===0;
 if(mobile.final===final)return;mobile.final=final;document.body.classList.toggle('mobile-final',final);mobilePlaceConsole();
 if(final){mobileGo(0,'instant');requestAnimationFrame(()=>{const journal=$('journal');resetJournalScroll();journal.scrollTop=Math.max(0,journal.scrollHeight-journal.clientHeight);});}
}
function mobileHelp(){
 const near=game.state.stage===3&&game.state.s.radius<1600;
 const tips={view:(copyLocalized('android.drag-to-rotate-double-tap-to-reset'))+(near?(copyLocalized('android.tap-to-toggle-the-grid')):''),battleTitle:copyLocalized('android.tap-or-drag-the-battle-view-to-command')};
 for(const [id,text]of Object.entries(tips)){const el=$(id);if(el&&el.dataset.help!==text)el.dataset.help=text;}
}
function initializeMobileInterface(){
 mobile.hardwareAvailable=!!window.AndroidGame?.hardwareScreenAvailable?.();
 let prefs=null;try{prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'null');}catch{}
 if(prefs?.mobileProfile!==2){for(const key of ['vignette','curve','motion'])settings[key]=true;settings.ambient=false;}
 settings.mobileProfile=2;
 mobile.pager=document.querySelector('.layout');mobile.pages=[...mobile.pager.children];
 mobile.visualObservers=mobile.pages.map(page=>new IntersectionObserver(entries=>{for(const entry of entries){const visible=entry.isIntersecting&&entry.intersectionRect.width>0&&entry.intersectionRect.height>0,was=mobile.intersections.get(entry.target);mobile.intersections.set(entry.target,visible);if(visible&&!was){if(entry.target.id==='view')viewDirty=true;else if(entry.target.id==='battleCanvas')mobile.battlePaint=true;}}},{root:page}));
 mobile.visualResizer=new ResizeObserver(entries=>{for(const entry of entries){const {width,height}=entry.contentRect;mobile.visualSizes.set(entry.target,{width:Math.round(width),height:Math.round(height)});if(entry.target.id==='view'&&width>0&&height>0&&(Math.abs(width-vw)>.01||Math.abs(height-vh)>.01))resizeViz();}});
 mobile.journalHome=$('journal').parentElement;mobile.console=document.createElement('section');mobile.console.className='journal mobile-console';
 mobile.console.setAttribute('aria-label',copy('android.news-console'));mobile.pages[2].prepend(mobile.console);mobilePlaceConsole();
 const nav=document.createElement('nav');nav.className='mobile-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label',copy('android.pages'));
 mobile.tabs=mobile.pages.map((page,index)=>{
  const button=document.createElement('button');button.id='mobileTab'+index;button.setAttribute('role','tab');button.setAttribute('aria-controls','mobilePage'+index);
  const track=document.createElement('span');track.className='mobile-tab-track';track.setAttribute('aria-hidden','true');const line=document.createElement('span');line.className='mobile-tab-progress';const unread=document.createElement('span');unread.className='mobile-tab-unread';track.append(line,unread);button.append(track);
  page.id=page.id||'mobilePage'+index;button.setAttribute('aria-controls',page.id);page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',button.id);
  button.addEventListener('click',()=>mobileGo(index));
  button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;mobileGo(next);mobile.tabs[next].focus({preventScroll:true});});
  nav.append(button);return button;
 });
 $('gameArea').before(nav);mobile.lines=mobile.tabs.map(tab=>tab.querySelector('.mobile-tab-progress'));
 mobile.pagerWidth=mobile.pager.getBoundingClientRect().width;mobileScroll();
 new ResizeObserver(([entry])=>{mobile.pagerWidth=entry.contentRect.width;mobile.pagerScrolled=true;}).observe(mobile.pager);
 const baseInputPoint=screenInputPoint;screenInputPoint=function(x,y){if(!mobile.hardware)return baseInputPoint(x,y);if(!settings.curve)return {x,y};const u=x/innerWidth*2-1,v=y/innerHeight*2-1,r=u*u+v*v;return {x:x+innerWidth*.011*u*r,y:y+innerHeight*.011*v*r};};
 document.addEventListener('input',e=>{if(pointerRoute?.kind==='range'&&pointerRoute.el===e.target){mobile.rangeInput=true;queueMicrotask(()=>{mobile.rangeInput=false;});}},true);
 const baseSpace=renderSpace;renderSpace=function(){if(mobile.rangeInput){mobileRequestRender();return;}baseSpace();};
 const baseTarget=mappedTarget;mappedTarget=function(event){
  const hit=baseTarget(event);
  for(const range of hit.el?.querySelectorAll('input[type=range]:not(:disabled)')||[]){const r=range.getBoundingClientRect();if(hit.p.x>=r.left&&hit.p.x<r.right&&hit.p.y>=r.top&&hit.p.y<r.bottom){hit.el=range;break;}}
  if(modalType||modalMotion||screenTransition)return hit;const r=nav.getBoundingClientRect();if(hit.p.y>=r.top&&hit.p.y<r.bottom&&hit.p.x>=r.left&&hit.p.x<r.right){for(const tab of mobile.tabs){const b=tab.getBoundingClientRect();if(hit.p.x>=b.left&&hit.p.x<b.right){hit.el=tab;break;}}}return hit;
 };
 mobile.pager.addEventListener('scroll',()=>{mobile.pagerScrolled=true;},{passive:true});
 window.addEventListener('resize',()=>{mobileCancelGestures();mobileSyncScreen();const index=document.body.classList.contains('final-hand')?0:mobile.index;requestAnimationFrame(()=>{mobile.pagerWidth=mobile.pager.getBoundingClientRect().width;mobileGo(index,'instant');});});
 document.addEventListener('pointermove',mobileMoveTouch);
 document.addEventListener('pointerup',e=>mobileFinishTouch(e),true);document.addEventListener('pointercancel',e=>mobileFinishTouch(e,true),true);
 // 开始原生滚动时，WebView 会取消 pointer 事件。自动滚到提醒位置要等手指真的松开。
 for(const event of ['touchstart','touchend','touchcancel'])window.addEventListener(event,e=>{mobile.touchActive=e.touches.length>0;},{capture:true,passive:true});
 document.addEventListener('lostpointercapture',e=>{if(pointerRoute?.id===e.pointerId&&pointerRoute.el===e.target){clearPointerRoute();clearHitHover();}});
 window.addEventListener('blur',mobileCancelGestures);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)screenRenderer?.invalidate(true);});
 const baseRender=render,baseSettings=applySettings,baseDraw=drawViz,baseRebuild=rebuildLayout,baseLanguage=setLanguage,baseClock=renderClock,baseReset=resetView,baseHTML=setHTML,baseBackground=drawBackground,baseBattle=drawBattle,baseChart=drawInvestmentChart,baseTournament=tickTournamentHighlights;
 const noticeValues=new Set(['autonomyCost','probeHazardEstimate','blackHoleMatter']);
 setHTML=function(id,value){
  const el=$(id);if(el&&mobile.rendering&&!mobile.refreshAll&&game.state.stage<4&&!noticeValues.has(id)){
   const index=mobileElementPage(el);
   if(index>=0&&!mobilePageVisible(index)&&!/<\/?(?!span\b|sup\b|small\b|b\b|i\b|wbr\b|br\b|em\b|strong\b)[a-z]|\bid\s*=/i.test(String(value))){mobile.deferred.set(el,{id,value,index});return;}
  }
  if(el)mobile.deferred.delete(el);baseHTML(id,value);
 };
 renderHumanControls=mobilePanel(renderHumanControls,0);renderPlanetControls=mobilePanel(renderPlanetControls,0);renderPlanetStatus=mobilePanel(renderPlanetStatus,2);renderSpaceControls=mobilePanel(renderSpaceControls,0);renderSpaceEngineering=mobilePanel(renderSpaceEngineering,0);renderProbeStatistics=mobilePanel(renderProbeStatistics,1);renderSpaceBattle=mobilePanel(renderSpaceBattle,1);
 renderHardware=mobilePanel(renderHardware,1);renderProjects=mobilePanel(renderProjects,2);renderJournal=mobilePanel(renderJournal,2);renderStrategy=mobilePanel(renderStrategy,1);renderIndustry=mobilePanel(renderIndustry,2);updateVizLabels=mobilePanel(updateVizLabels,1);
 drawInvestmentChart=function(){const el=$('investmentChart');if(el&&mobileElementVisible(el,0))baseChart();};
 tickTournamentHighlights=function(now){if(mobilePageVisible(1))baseTournament(now);};
 drawBackground=function(){if(!settings.ambient&&mobile.ambientCleared)return;mobile.ambientCleared=!settings.ambient;baseBackground();};
 drawBattle=function(){mobile.battlePaint=false;baseBattle();};
 fieldNotes=function(){
  const state=game.state;
  const rows=[
   [copyLocalized('android.swipe-left-right'),copyLocalized('android.switch-pages-from-text-or-empty-space')],
   [copyLocalized('android.tap-a-thin-bar'),copyLocalized('android.open-its-page')],
   [copyLocalized('android.drag-the-main-view'),copyLocalized('android.rotate')],
   [copyLocalized('android.double-tap-the-main-view'),copyLocalized('android.reset-the-view')]
  ];
  if(state.stage===3&&state.s.radius<1600)rows.push([copyLocalized('android.tap-the-main-view'),copyLocalized('android.toggle-the-nearby-star-grid')]);
  if(state.stage===3&&state.s.war)rows.push([copyLocalized('android.tap-or-drag-the-battle-view'),copyLocalized('android.command-the-fleet')],
   [copyLocalized('android.double-tap-the-battle-view'),copyLocalized('android.resume-autonomous-combat')],
   [copyLocalized('android.double-tap-the-battle-title'),copyLocalized('android.use-command-speed')]);
  rows.push([copyLocalized('android.hold-make-launch'),copyLocalized('android.repeat-the-action')],
   [copyLocalized('android.drag-a-slider'),copyLocalized('android.adjust-its-value')],
   [copyLocalized('android.tap-pause'),copyLocalized('android.pause-resume')]);
  if(state.stage===1)rows.push([copyLocalized('android.hold-price-purchase-buttons'),copyLocalized('android.repeat-price-changes-or-purchases-including-10-100')]);
  if(state.stage===3)rows.push([copyLocalized('android.hold-probe-attribute'),copyLocalized('android.keep-assigning-or-removing-points')]);
  rows.push([copyLocalized('android.hold-an-annotated-label'),copyLocalized('android.show-its-explanation')]);
  return '<table class="keyboard-guide">'+rows.map(([a,b])=>'<tr><td>'+escapeHTML(a)+'</td><td>'+escapeHTML(b)+'</td></tr>').join('')+'</table>';
 };
 renderClock=function(){baseClock();const text=settings.lang==='en'?(game.state.paused?copy('android.resume'):copy('android.pause')):(game.state.paused?copy('copy.continue'):copy('copy.pause'));if($('pause').dataset.help!==text)$('pause').dataset.help=text;};
 resetView=function(){clearTimeout(mobile.viewTimer);mobile.viewTap=mobile.battleTap=mobile.titleTap=null;baseReset();};
 setLanguage=function(lang){textMarkupCache=new WeakMap();baseLanguage(lang);};
 rebuildLayout=function(){
  if(mobile.stage&&mobile.stage!==game.state.stage)mobileResetNotices();
  mobileCancelGestures();mobile.toolsRevealed=false;mobile.deferred.clear();mobile.elementPages=new WeakMap();for(const observer of mobile.visualObservers)observer.disconnect();mobile.visualResizer.disconnect();mobile.observed=new WeakSet();mobile.intersections=new WeakMap();mobile.visualSizes=new WeakMap();$('battleExtras')?.remove();baseRebuild();mobileSyncScreen();const battle=$('battleExtras');if(battle)$('centralControls').before(battle);mobilePlaceConsole();mobileObserveVisuals();
 };
 renderClipCount=function(){const value=game.clipCount();setHTML('clipCount',wholeClipNumber().replaceAll(',',',<wbr>')+(value>=1e15?'<small class="count-scientific">'+scientificNumber(value,3)+'</small>':''));};
 render=function(){
  if(mobile.rangeInput){mobileRequestRender();return;}if(mobile.inputRender){cancelAnimationFrame(mobile.inputRender);mobile.inputRender=0;}
  mobileTrackMilestones();mobile.rendering=true;mobile.refreshAll=lastStage!==game.state.stage||!!screenTransition;
  try{
   for(const [el,entry]of mobile.deferred){if(!el.isConnected){mobile.deferred.delete(el);continue;}if(mobilePageVisible(entry.index)){mobile.deferred.delete(el);baseHTML(entry.id,entry.value);}}
   baseRender();
  }finally{mobile.refreshAll=false;mobile.rendering=false;}
  mobileRefreshNotices();mobileObserveVisuals();mobileHelp();const stage=game.state.stage,english=settings.lang==='en';
  const labels=[english?[copy('android.production'),copy('android.resources'),copy('android.probes'),copy('android.dismantle')][stage-1]:[copy('copy.production'),copy('android.text'),copy('copy.probe'),copy('copy.dismantle')][stage-1],copyLocalized('android.view-compute'),copyLocalized('android.projects')];
  mobile.tabs.forEach((tab,i)=>{const text=(i+1)+' / '+labels[i];if(tab.getAttribute('aria-label')!==text)tab.setAttribute('aria-label',text);});
  if(mobile.stage!==stage){mobile.stage=stage;mobileGo(0,'instant');}
  mobileUpdateFinal();
  if((mobile.final||document.body.classList.contains('final-hand'))&&mobile.index!==0)mobileGo(0,'instant');
 };
 const baseBloomSetting=updateBloomSetting;
 updateBloomSetting=function(){baseBloomSetting();mobileApplyScreenFilter();};
 applySettings=function(){
  baseSettings();mobile.battlePaint=true;mobileApplyScreenFilter();
  document.documentElement.style.setProperty('--mobile-image-rendering',settings.interpolation==='linear'?'auto':'pixelated');
  BH_ENDING_CONFIG.params.fps=settings.quality==='low'?10:15;
  for(const renderer of [endingBackground?.ascii,endingBackground?.dots])if(renderer)renderer.params.fps=BH_ENDING_CONFIG.params.fps;
 };
 drawViz=function(){mobileTrackMilestones();mobileUpdateSolarView();if(mobileElementVisible($('view'),1)||screenTransition||pendingDeparture)baseDraw();};
 const baseExport=exportSave;
 exportSave=function(){if(window.AndroidGame?.exportSave)window.AndroidGame.exportSave(game.serialize());else baseExport();};
 if(window.AndroidGame){
  const baseModal=renderModal;renderModal=function(){baseModal();if(modalType==='save'){
   const p=$('modalContent').querySelector('p');if(p)p.textContent=copyLocalized('android.save.storage-notice');
  }};
 }
 window.MobilePaperclips={go:mobileGo,get page(){return mobile.index;},back(){if(selectMenu){closeSelectMenu();return true;}if(modalType){if(modalType!=='negotiation')closeModal();return true;}if(mobile.index){mobileGo(0);return true;}return false;},save(){music.background(true);mobileCancelGestures();flushSimulationTime();save();},resume(){music.background(false);pendingPhysicsReal=pendingPhysicsDays=0;lastSimulationTime=lastFrame=battleLastTime=performance.now();mobileCancelGestures();mobileScroll();screenRenderer?.invalidate(true);}};
}
