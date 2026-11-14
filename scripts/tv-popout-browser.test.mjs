import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

async function fixture(mode){
 const server=createServer(async(req,res)=>{
  if(req.url==='/fixture.mp4'){
   const bytes=await readFile(new URL('../assets/trek-bumpers/vulcan-salute.mp4',import.meta.url));res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');
   const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
   if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):bytes.length-1,bytes.length-1);res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(bytes.subarray(start,end+1));}
   else{res.setHeader('Content-Length',bytes.length);res.end(bytes);}return;
  }
  if(req.url==='/assets/tv-popout.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('../assets/tv-popout.js',import.meta.url)));return;}
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><title>TV fixture</title><style>body[data-skin="gutter"]{--qa-accent:rgb(217,250,50)}.screen{width:400px;height:225px;background:black}</style></head><body data-skin="pixel" data-tv-page="channel"><main><div id="before"></div><div id="tvView"><div class="cabinet"><div id="screen" class="screen"><video id="vid"></video><canvas id="snow"></canvas></div></div><div class="remote"><button id="mute">Mute</button><button id="cc">CC</button><button id="full">Full screen</button></div><section class="now"><h2 id="title">The original show</h2><span id="meta">Fixture station</span></section><section class="guide"></section></div><div id="after"></div></main><script>
 window.captionUI={closeMenu(){}};window.originalTV=document.getElementById('tvView');window.originalVideo=document.getElementById('vid');window.loads=0;window.plays=0;originalVideo.currentTime=42;originalVideo.volume=.37;originalVideo.load=()=>loads++;originalVideo.play=()=>plays++;
 const $=id=>document.getElementById(id)||window.RETVPopout?.document?.getElementById(id);
 document.getElementById('mute').onclick=()=>{$('vid').muted=!$('vid').muted;};document.getElementById('cc').onclick=()=>{$('cc').setAttribute('aria-pressed',$('cc').getAttribute('aria-pressed')!=='true');};
 window.realOpen=window.open.bind(window);window.openCalls=0;
 window.open=(...args)=>{openCalls++;return realOpen(...args);};
 ${mode==='native'?'':`Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:${mode==='mock'?' {requestWindow:async()=>realOpen("about:blank","_blank","width=720,height=650")}':mode==='denied'?' {requestWindow:async()=>{throw new DOMException("Denied fixture","NotAllowedError")}}':'undefined'}});`}
 </script><script src="/assets/tv-popout.js"></script></body></html>`);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 const context=await browser.newContext((mode.startsWith('mobile')||mode==='phone-real')?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{});
 if(mode.startsWith('mobile'))await context.addInitScript(mode=>{
  window.pipRequests=0;window.pipExits=0;let pip=null,presentation='inline';
  Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get:()=>mode==='mobile-unready'?0:4});
  Object.defineProperty(document,'pictureInPictureElement',{configurable:true,get:()=>pip});
  Object.defineProperty(document,'pictureInPictureEnabled',{configurable:true,value:mode!=='mobile-unsupported'});
  HTMLVideoElement.prototype.requestPictureInPicture=async function(){pipRequests++;if(mode==='mobile-denied')throw Error('Picture-in-picture denied');pip=this;this.dispatchEvent(new Event('enterpictureinpicture'));return {};};
  document.exitPictureInPicture=async()=>{pipExits++;const old=pip;pip=null;old?.dispatchEvent(new Event('leavepictureinpicture'));};
  if(mode==='mobile-webkit'){
   HTMLVideoElement.prototype.webkitSupportsPresentationMode=mode=>mode==='picture-in-picture';
   Object.defineProperty(HTMLVideoElement.prototype,'webkitPresentationMode',{configurable:true,get:()=>presentation});
   HTMLVideoElement.prototype.webkitSetPresentationMode=function(mode){mode==='inline'?pipExits++:pipRequests++;presentation=mode;this.dispatchEvent(new Event('webkitpresentationmodechanged'));};
  }
 },mode);
 const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/#ch97');
 return {page,context,async close(){await browser.close();await new Promise(r=>server.close(r));}};
}

for(const mode of ['mock','fallback'])test(`TV popout ${mode} path retains original media, interactive controls, theme and reversible placement`,{skip:!chromium},async()=>{
 const f=await fixture(mode);try{
  const {page,context}=f;await page.locator('#popoutTv').waitFor();
  const popupEvent=context.waitForEvent('page');await page.locator('#popoutTv').click();const popup=await popupEvent;
  await page.waitForFunction(()=>window.RETVPopout?.active);
  await popup.locator('#vid').waitFor();
  assert.deepEqual(await page.evaluate(()=>({same:RETVPopout.document.getElementById('vid')===originalVideo,sameTV:RETVPopout.document.getElementById('tvView')===originalTV,inMain:document.contains(originalTV),time:originalVideo.currentTime,volume:originalVideo.volume,loads,plays})),{same:true,sameTV:true,inMain:false,time:42,volume:.37,loads:0,plays:0});
  assert.equal(await popup.locator('body').evaluate(el=>el.classList.contains('tv-popout-window')),true);
  await popup.locator('#mute').click();assert.equal(await page.evaluate(()=>originalVideo.muted),true);
  await popup.locator('#cc').click();assert.equal(await popup.locator('#cc').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>document.body.dataset.skin='gutter');await popup.waitForFunction(()=>document.body.dataset.skin==='gutter');
  assert.equal(await popup.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--qa-accent').trim()),'rgb(217,250,50)');
  await popup.close();await page.waitForFunction(()=>!RETVPopout.active&&document.contains(originalTV));
  assert.deepEqual(await page.evaluate(()=>({same:document.getElementById('vid')===originalVideo,previous:originalTV.previousElementSibling.previousElementSibling.id,next:originalTV.nextElementSibling.id,time:originalVideo.currentTime,loads,plays})),{same:true,previous:'before',next:'after',time:42,loads:0,plays:0});
  await page.locator('#mute').click();assert.equal(await page.evaluate(()=>originalVideo.muted),false);
  const again=context.waitForEvent('page');await page.locator('#popoutTv').click();const second=await again;await second.locator('#vid').waitFor();
  await page.locator('.tv-popout-placeholder button').click();await page.waitForFunction(()=>!RETVPopout.active&&document.contains(originalTV));
  assert.equal(await page.evaluate(()=>loads+plays),0);
 }finally{await f.close();}
});

for(const mode of ['fallback','native'])test(`real playing MP4 retains and advances transport across ${mode} popout and return`,{skip:!chromium},async t=>{
 const f=await fixture(mode);try{
  const {page}=f;
  if(mode==='native'&&!await page.evaluate(()=>typeof window.documentPictureInPicture?.requestWindow==='function')){t.skip('Native Document Picture-in-Picture unavailable in this browser.');return;}
  await page.evaluate(async()=>{
   delete originalVideo.play;delete originalVideo.load;window.mediaEvents=[];for(const type of ['emptied','loadedmetadata','loadeddata','seeking','seeked','pause','play'])originalVideo.addEventListener(type,()=>mediaEvents.push({type,time:originalVideo.currentTime,ready:originalVideo.readyState,floating:!!window.RETVPopout?.active}));originalVideo.muted=true;originalVideo.src='/fixture.mp4';
   await new Promise((resolve,reject)=>{originalVideo.onloadedmetadata=resolve;originalVideo.onerror=reject;});
   originalVideo.currentTime=2;await originalVideo.play();
  });
  await page.waitForFunction(()=>!originalVideo.paused&&originalVideo.currentTime>2.3);
  const before=await page.evaluate(()=>originalVideo.currentTime);await page.locator('#popoutTv').click();
  await page.waitForFunction(position=>RETVPopout.active&&!originalVideo.paused&&originalVideo.currentTime>position+.2,before,{timeout:2000});
  const during=await page.evaluate(()=>({time:originalVideo.currentTime,same:RETVPopout.document.getElementById('vid')===originalVideo,src:originalVideo.getAttribute('src')}));
  assert.equal(during.same,true);assert.equal(during.src,'/fixture.mp4');assert.ok(during.time<before+3,'adoption must not jump to another part of the program');
  await page.locator('.tv-popout-placeholder button').click();
  await page.waitForFunction(position=>!RETVPopout.active&&document.contains(originalVideo)&&!originalVideo.paused&&originalVideo.currentTime>position+.2,during.time,{timeout:2000});
  const after=await page.evaluate(()=>originalVideo.currentTime);assert.ok(after<during.time+3,'return must preserve the current program position');
  // A deliberately paused real source must remain paused through both adoptions.
  await page.evaluate(()=>originalVideo.pause());const paused=await page.evaluate(()=>originalVideo.currentTime);
  await page.locator('#popoutTv').click();await page.waitForFunction(()=>RETVPopout.active&&originalVideo.readyState>0);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>originalVideo.paused),true);const pausedFloating=await page.evaluate(()=>originalVideo.currentTime);assert.ok(Math.abs(pausedFloating-paused)<.5,`paused popout changed ${paused} to ${pausedFloating}: ${JSON.stringify(await page.evaluate(()=>mediaEvents))}`);
  await page.locator('.tv-popout-placeholder button').click();await page.waitForFunction(()=>!RETVPopout.active&&originalVideo.readyState>0);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>originalVideo.paused),true);const pausedReturned=await page.evaluate(()=>originalVideo.currentTime);assert.ok(Math.abs(pausedReturned-paused)<.5,`paused return changed ${paused} to ${pausedReturned}`);
 }finally{await f.close();}
});

test('denied native popout retains the TV and shows an actionable error without opening a fallback',{skip:!chromium},async()=>{
 const f=await fixture('denied');try{
  await f.page.locator('#popoutTv').click();await f.page.waitForFunction(()=>document.querySelector('.tv-popout-placeholder')?.textContent.includes('Denied fixture'));
  assert.deepEqual(await f.page.evaluate(()=>({active:RETVPopout.active,same:document.getElementById('vid')===originalVideo,time:originalVideo.currentTime,openCalls,loads,plays})),{active:false,same:true,time:42,openCalls:0,loads:0,plays:0});
  await f.page.locator('.tv-popout-placeholder button').click();assert.equal(await f.page.locator('.tv-popout-placeholder').isVisible(),false);
 }finally{await f.close();}
});

test('native Chrome Document Picture-in-Picture preserves TV identity when the browser exposes it',{skip:!chromium},async t=>{
 const f=await fixture('native');try{
  const {page}=f;const supported=await page.evaluate(()=>typeof window.documentPictureInPicture?.requestWindow==='function');
  if(!supported){t.skip('This Chrome build does not expose Document Picture-in-Picture; real-window lifecycle paths are covered separately.');return;}
  await page.locator('#popoutTv').click();await page.waitForFunction(()=>RETVPopout.active);
  const result=await page.evaluate(()=>({native:documentPictureInPicture.window===RETVPopout.document.defaultView,same:RETVPopout.document.getElementById('vid')===originalVideo,loads,plays}));
  assert.deepEqual(result,{native:true,same:true,loads:0,plays:0});
  await page.evaluate(()=>RETVPopout.close());await page.waitForFunction(()=>!RETVPopout.active&&document.contains(originalTV));
 }finally{await f.close();}
});

for(const mode of ['mobile-standard','mobile-webkit'])test(mode+' uses native video PiP, survives backgrounding and returns without moving or restarting the TV',{skip:!chromium},async()=>{
 const f=await fixture(mode);try{const {page}=f;await page.locator('#popoutTv').click();await page.waitForFunction(()=>RETVPopout.active);
 assert.deepEqual(await page.evaluate(()=>({same:document.getElementById('vid')===originalVideo,tv:document.contains(originalTV),requests:pipRequests,openCalls,loads,plays,time:originalVideo.currentTime})),{same:true,tv:true,requests:1,openCalls:0,loads:0,plays:0,time:42});
 assert.equal(await page.locator('#popoutTv').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#full').isDisabled(),true);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>RETVPopout.active),true);
 await page.locator('.tv-popout-placeholder button').click();await page.waitForFunction(()=>!RETVPopout.active);
 assert.equal(await page.evaluate(()=>pipExits),1);assert.equal(await page.locator('#full').isDisabled(),false);assert.equal(await page.locator('.tv-popout-placeholder').isVisible(),false);
 await page.locator('#popoutTv').click();await page.waitForFunction(()=>RETVPopout.active);await page.locator('#popoutTv').click();await page.waitForFunction(()=>!RETVPopout.active);
 assert.deepEqual(await page.evaluate(()=>({requests:pipRequests,exits:pipExits,openCalls,loads,plays,time:originalVideo.currentTime})),{requests:2,exits:2,openCalls:0,loads:0,plays:0,time:42});
 }finally{await f.close();}
});
for(const mode of ['mobile-denied','mobile-unsupported','mobile-unready'])test(mode+' gives a usable message and never opens a browser tab',{skip:!chromium},async()=>{
 const f=await fixture(mode);try{const {page}=f;await page.locator('#popoutTv').click();await page.locator('.tv-popout-placeholder').waitFor({state:'visible'});
 assert.deepEqual(await page.evaluate(()=>({active:RETVPopout.active,same:document.getElementById('vid')===originalVideo,openCalls,loads,plays})),{active:false,same:true,openCalls:0,loads:0,plays:0});
 const message=await page.locator('.tv-popout-placeholder p').textContent();assert.match(message,mode==='mobile-unready'?/Start the TV/:mode==='mobile-unsupported'?/cannot open a floating/:/denied/);
 }finally{await f.close();}
});

test('native video PiP keeps a real playing source in the original mobile page',{skip:!chromium},async t=>{
 const f=await fixture('phone-real');try{const {page}=f;if(!await page.evaluate(()=>document.pictureInPictureEnabled&&typeof originalVideo.requestPictureInPicture==='function')){t.skip('Browser has no native video PiP');return;}
 await page.evaluate(async()=>{delete originalVideo.play;delete originalVideo.load;originalVideo.muted=true;originalVideo.src='/fixture.mp4';await new Promise((resolve,reject)=>{originalVideo.onloadedmetadata=resolve;originalVideo.onerror=reject;});originalVideo.currentTime=2;await originalVideo.play();});
 await page.waitForFunction(()=>originalVideo.currentTime>2.2);const before=await page.evaluate(()=>originalVideo.currentTime);await page.locator('#popoutTv').click();
 await page.waitForFunction(()=>RETVPopout.active||!document.querySelector('.tv-popout-placeholder').hidden);
 if(!await page.evaluate(()=>RETVPopout.active)){t.skip('Native video PiP refused by this browser environment: '+await page.locator('.tv-popout-placeholder p').textContent());return;}
 assert.equal(await page.evaluate(()=>document.pictureInPictureElement===originalVideo&&document.contains(originalTV)&&openCalls===0),true);
 await page.waitForFunction(position=>originalVideo.currentTime>position+.2,before);await page.evaluate(()=>document.exitPictureInPicture());await page.waitForFunction(()=>!RETVPopout.active);
 assert.equal(await page.locator('#full').isDisabled(),false);assert.equal(await page.evaluate(()=>originalVideo.paused),false);
 }finally{await f.close();}
});
