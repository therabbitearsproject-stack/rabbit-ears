import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {siteCode} from './tv-feed.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

test('real stream resumes after a simulated outage without reload, preserving show, volume and theme',
 {skip:!chromium||!process.env.RABBIT_EARS_LIVE_RECOVERY,timeout:90000},async()=>{
 const root=path.resolve('.'),html=await readFile('index.html','utf8'),catalog=JSON.parse(await readFile('catalog.json','utf8'));
 const site=siteCode({html,catalog,commercialTiming:await readFile('commercial-timing.js','utf8'),mediaCompatibility:await readFile('media-compatibility.js','utf8')});
 const ch=site.BUILT_IN.find(c=>c.no===97),[slot]=await site.lineup(ch,Date.now()/1000,1),fixed=(slot.v0+60)*1000;
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
 const server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error('path');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let available=false,navigations=0,blocked=0;
  const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',route=>{
   const request=route.request(),url=request.url();
   if(url.includes('/assets/playback-copies.json'))return route.fulfill({json:{copies:{}}});
   if(url.startsWith('https://archive.org/metadata/'))return route.fulfill({json:{files:[]}});
   if(request.resourceType()==='media'&&new URL(url).hostname.endsWith('archive.org')){
    if(!available){blocked++;return route.abort('connectionfailed');}
    return route.continue();
   }
   return url.startsWith(origin)?route.continue():route.abort();
  });
  await context.addInitScript(fixed=>{Date.now=()=>fixed;localStorage.setItem('re_welcomed','true');},fixed);
  const page=await context.newPage();page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())navigations++;});
  await page.goto(origin+'/#ch97');
  await page.waitForFunction(()=>automaticPlaybackRecovery?.state().scheduled,{},{timeout:30000});
  const before=await page.evaluate(()=>({show:playing.m.id,theme:document.body.dataset.skin}));
  await page.evaluate(()=>{window.originalRecoveryVideo=document.getElementById('vid');originalRecoveryVideo.volume=.31;});
  assert.ok(blocked>0);
  available=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>{const v=document.getElementById('vid');return v.readyState>=3&&!v.paused&&v.currentTime>=59&&document.getElementById('snow').style.opacity==='0';},{},{timeout:45000});
  const after=await page.evaluate(()=>({same:document.getElementById('vid')===originalRecoveryVideo,show:playing.m.id,
   theme:document.body.dataset.skin,volume:originalRecoveryVideo.volume,time:originalRecoveryVideo.currentTime,
   attempts:automaticPlaybackRecovery.state().attempts,status:document.getElementById('playbackStatus').hidden}));
  assert.equal(after.same,true);assert.equal(after.show,before.show);assert.equal(after.theme,before.theme);
  assert.equal(after.volume,.31);assert.ok(after.time>=59&&after.time<90);assert.equal(after.attempts,0);
  assert.equal(after.status,true);assert.equal(navigations,1);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
