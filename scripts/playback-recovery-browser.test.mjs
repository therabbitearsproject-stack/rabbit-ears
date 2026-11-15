import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {siteCode} from './tv-feed.mjs';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

test('real mobile page recovers an unsupported file in place and stops after alternate failure',{skip:!chromium},async()=>{
 const root=path.resolve('.'),html=await readFile('index.html','utf8'),catalog=JSON.parse(await readFile('catalog.json','utf8'));
 const site=siteCode({html,catalog,commercialTiming:await readFile('commercial-timing.js','utf8'),mediaCompatibility:await readFile('media-compatibility.js','utf8')});
 const ch=site.BUILT_IN.find(c=>c.no===97),[slot]=await site.lineup(ch,Date.now()/1000,1),fixed=(slot.v0+60)*1000;
 const source=slot.m.file,alternate=source.replace(/(?:\.ia)?\.mp4$/i,'.ia.mp4');assert.notEqual(source,alternate);
 const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
 const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();let metadataReady=false;
  const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',async r=>{
   const url=r.request().url();
   if(url.includes('/assets/playback-copies.json'))return r.fulfill({json:{copies:{}}});
   if(url.startsWith('https://archive.org/metadata/'))return metadataReady?r.fulfill({json:{files:[{name:source,length:slot.m.dur,source:'original'},{name:alternate,original:source,length:slot.m.dur,source:'derivative',format:'h.264 IA'}]}}):r.abort();
   return url.startsWith(origin)?r.continue():r.abort();
  });
  await page.addInitScript(({fixed,dur})=>{
   Date.now=()=>fixed;localStorage.setItem('re_welcomed','true');window.qaLoads=[];
   HTMLMediaElement.prototype.load=function(){qaLoads.push(this.src);};HTMLMediaElement.prototype.pause=function(){};
   HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
   Object.defineProperty(HTMLMediaElement.prototype,'duration',{get(){return dur;}});
  },{fixed,dur:slot.m.dur});
  await page.goto(origin+'/#ch97');await page.waitForFunction(()=>qaLoads.length>0);
  metadataReady=true;
  await page.evaluate(()=>{const v=document.getElementById('vid');Object.defineProperty(v,'error',{configurable:true,value:{code:4}});v.dispatchEvent(new Event('error'));});
  await page.waitForFunction(()=>qaLoads.length===2);
  const recovered=await page.evaluate(()=>({src:document.getElementById('vid').src,media:activeSegment.media,position:currentSegment().position,program:playing.m.id,status:document.getElementById('playbackStatus').textContent}));
  assert.equal(decodeURIComponent(recovered.src.split('/').slice(5).join('/')),alternate);
  assert.equal(recovered.media.video,source);assert.equal(recovered.media.id,slot.m.id);assert.equal(recovered.program,slot.m.id);assert.equal(Math.round(recovered.position),60);
  await page.evaluate(()=>document.getElementById('vid').dispatchEvent(new Event('error')));
  await page.waitForFunction(()=>!document.querySelector('#playbackStatus button').hidden);
  assert.equal(await page.evaluate(()=>qaLoads.length),2);assert.match(await page.locator('#playbackStatus').innerText(),/No compatible copy/);
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
