import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('Arabic preference honestly identifies English fallback, then hot-published Arabic renders without restarting video',{skip:!chromium},async()=>{
 const original='WEBVTT\n\n00:00:00.000 --> 00:00:50.000\nOriginal English dialogue.\n';
 const arabic='WEBVTT\n\n00:00:00.000 --> 00:00:50.000\nهذا نص عربي للاختبار.\n';
 const identity={archiveId:'ST9_mp4',video:'ST9_mp4/ST9174.DS9-s02e02.The.Circle.ia.mp4',duration:2729.9};
 const originalHash=sha(original),arabicHash=sha(arabic),file='translated-'+arabicHash+'.vtt';
 let translations=[],translationRequests=0;
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage();
  await page.route('https://captions.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/caption-index.json')return route.fulfill({json:{schemaVersion:1,records:[{...identity,sub:'English.srt',sourcePath:'/subs/found.vtt',sha256:originalHash,captionMetadata:{kind:'provided',language:'en'}}]}});
   if(url.pathname==='/caption-translations.json'){translationRequests++;return route.fulfill({json:{schemaVersion:1,records:translations}});}
   if(url.pathname==='/subs/found.vtt')return route.fulfill({contentType:'text/vtt',body:original});
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="screen" style="width:640px;height:480px"><video id="video" muted style="width:640px;height:480px"></video><button id="cc">CC</button><button data-remote="cc"></button></div>'});
   return route.fulfill({status:404,body:'Unexpected fixture request'});
  });
  await page.route('https://raw.githubusercontent.com/**',route=>route.fulfill({contentType:'text/vtt',headers:{'Access-Control-Allow-Origin':'*'},body:arabic}));
  await page.goto('https://captions.test/');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/captions.js',import.meta.url))});
  await page.evaluate(async identity=>{
   const video=document.getElementById('video'),canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
   canvas.getContext('2d').fillRect(0,0,640,480);video.srcObject=canvas.captureStream(2);await video.play();
   window.originalVideo=video;window.loads=window.plays=window.pauses=0;
   video.load=()=>loads++;video.play=()=>{plays++;return Promise.resolve();};video.pause=()=>pauses++;
   const saved=new Map([['re_caption_style','yellow'],['re_caption_language','ar']]);
   window.ui=RabbitCaptions.create({video,screen:document.getElementById('screen'),button:document.getElementById('cc'),store:{get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>saved.set(k,v)},source:()=>'/subs/not-the-index-source.vtt'});
   ui.setMedia({id:'episode',archiveId:identity.archiveId,file:identity.video,dur:identity.duration,sub:''});
   await ui.refreshIndex();
  },identity);
  await page.waitForFunction(()=>document.querySelector('.caption-text')?.textContent==='Original English dialogue.');
  const fallback=await page.evaluate(()=>({requested:video.dataset.captionRequestedLanguage,actual:video.dataset.captionActualLanguage,state:video.dataset.captionTranslation,
   source:video.querySelector('track').dataset.captionSource,title:document.getElementById('cc').title,remote:document.querySelector('[data-remote="cc"]').getAttribute('aria-label'),notice:document.querySelector('.caption-translation-status').textContent,time:video.currentTime}));
  assert.deepEqual([fallback.requested,fallback.actual,fallback.state],['ar','en','pending']);
  assert.ok(fallback.source.includes('/subs/found.vtt?v='+originalHash));
  assert.match(fallback.title,/Arabic translation is not ready; showing English captions/);
  assert.match(fallback.remote,/Arabic translation is not ready; showing English captions/);
  assert.match(fallback.notice,/Arabic translation is not ready; showing English captions/);
  await page.evaluate(()=>ui.applyPreferences({re_caption_style:'none'}));
  assert.match(await page.locator('#cc').getAttribute('title'),/English captions available/);
  await page.evaluate(()=>ui.applyPreferences({re_caption_style:'yellow'}));
  await page.evaluate(()=>ui.applyPreferences({re_caption_language:'en'}));
  const beforeLanguageChange=translationRequests;
  translations=[{...identity,language:'ar',sourceLanguage:'en',sourceSha256:originalHash,file,sha256:arabicHash}];
  // Simulate the user returning after the short refresh debounce, not the five-
  // minute polling timer. Only changing language must discover the new track.
  await page.evaluate(async()=>{
   const now=Date.now;Date.now=()=>now()+11000;
   try{await ui.applyPreferences({re_caption_language:'ar'});}finally{Date.now=now;}
  });
  assert.equal(translationRequests,beforeLanguageChange+1);
  await page.waitForFunction(()=>document.querySelector('.caption-text')?.textContent==='هذا نص عربي للاختبار.');
  const translated=await page.evaluate(()=>({requested:video.dataset.captionRequestedLanguage,actual:video.dataset.captionActualLanguage,state:video.dataset.captionTranslation,
   language:video.querySelector('track').srclang,label:video.querySelector('track').label,dir:document.querySelector('.caption-layer').dir,color:document.querySelector('.caption-layer').dataset.color,
   noticeHidden:document.querySelector('.caption-translation-status').hidden,title:document.getElementById('cc').title,same:video===originalVideo,time:video.currentTime,loads,plays,pauses}));
  assert.deepEqual([translated.requested,translated.actual,translated.state,translated.language,translated.dir],['ar','ar','saved','ar','rtl']);
  assert.equal(translated.label,'Arabic (auto-translated from English)');assert.equal(translated.color,'yellow');
  assert.equal(translated.noticeHidden,true);assert.equal(translated.title,'Caption options (C)');
  assert.equal(translated.same,true);assert.ok(translated.time>=fallback.time);assert.equal(translated.loads+translated.plays+translated.pauses,0);
  const beforeTaps=translationRequests;
  await page.evaluate(async()=>{
   await ui.applyPreferences({re_caption_language:'fr'});
   ui.toggleMenu();ui.closeMenu(false);ui.toggleMenu();ui.closeMenu(false);
   await ui.applyPreferences({re_caption_language:'ar'});
  });
  assert.equal(translationRequests,beforeTaps,'Repeated language and pending-menu taps share the short refresh debounce');
  await page.evaluate(()=>ui.setMedia({id:'burned',burnedCaptions:true}));
  assert.equal(await page.locator('#cc').getAttribute('title'),'Captions are embedded in this show');
  assert.equal(await page.evaluate(()=>video.dataset.captionTranslation),'embedded');
  assert.equal(await page.evaluate(()=>video.dataset.captionActualLanguage),'');
 }finally{await browser.close();}
});
