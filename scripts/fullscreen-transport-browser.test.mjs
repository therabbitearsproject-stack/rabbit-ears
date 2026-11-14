import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
async function fullApp(){
 const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)){res.writeHead(403);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await page.addInitScript(()=>{localStorage.setItem('re_welcomed','true');window.qaMedia={load:0,play:0};HTMLMediaElement.prototype.load=function(){qaMedia.load++;};HTMLMediaElement.prototype.play=function(){qaMedia.play++;return Promise.resolve();};});
 const url='http://127.0.0.1:'+server.address().port+'/#tv';await page.goto(url);await page.waitForFunction(()=>window.REUI&&document.getElementById('openSettings'));await page.waitForTimeout(500);
 return {page,context,url,async close(){await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}

test('fullscreen reuses every themed transport, hides on idle and restores the same controls without reloading video',{skip:!chromium},async()=>{
 const f=await fullApp();try{const {page}=f;await page.waitForSelector('.tv-transport .watch-dock',{state:'attached'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{REUI.openChannel(0);window.qaTransport=document.querySelector('.tv-transport');window.qaVideo=document.getElementById('vid');document.querySelector('.tv-transport .watch-dock').hidden=false;document.getElementById('screen').requestFullscreen=()=>Promise.reject(new Error('Fallback fixture'));});
 const before=await page.evaluate(()=>({...qaMedia}));
 for(const [width,height] of [[1440,1000],[800,600],[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  for(const skin of ['retro','theatre','stadium','modern','cozy','metal','ivory','pixel','gutter']){
   await page.evaluate(s=>document.body.dataset.skin=s,skin);
   const normal=await page.locator('#pause').evaluate(n=>({bg:getComputedStyle(n).backgroundImage,border:getComputedStyle(n).borderRadius}));
   await page.locator('#full').click();
   assert.equal(await page.locator('.fullscreen-controls>.tv-transport').count(),1);await page.evaluate(()=>{const d=document.querySelector('.tv-transport .watch-dock');if(d)d.hidden=false;});
   assert.equal(await page.evaluate(()=>document.querySelector('.fullscreen-controls>.tv-transport')===qaTransport&&document.getElementById('vid')===qaVideo),true);
   assert.deepEqual(await page.locator('#pause').evaluate(n=>({bg:getComputedStyle(n).backgroundImage,border:getComputedStyle(n).borderRadius})),normal);
   assert.equal(await page.locator('#full').getAttribute('aria-label'),'Exit fullscreen');
   const bank=await page.locator('.tv-transport').boundingBox();assert.ok(bank.x>=0&&bank.x+bank.width<=width+1,skin+' bank fits '+width+' '+JSON.stringify(bank));
   assert.equal(await page.locator('#mute').isVisible(),true);
   await page.locator('#full').click();
   assert.equal(await page.locator('.player-pack>.tv-transport').count(),1);
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#full').click();await page.waitForTimeout(3400);
 assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('controls-idle')),true);
 assert.equal(await page.locator('.fullscreen-controls').evaluate(n=>getComputedStyle(n).opacity),'0');
 await page.mouse.move(400,300);await page.waitForTimeout(300);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('controls-idle')),false);
 assert.deepEqual(await page.evaluate(()=>({...qaMedia})),before);await page.evaluate(()=>document.querySelector('.tv-transport .watch-dock').hidden=false);await page.screenshot({path:'design-history/fullscreen-transport-desktop.png'});await page.locator('#mute').click();await page.locator('#tv-volume-popup').waitFor({state:'visible'});await page.waitForTimeout(3300);assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('controls-idle')),false);
 await page.locator('#tv-volume-popup .volume-mute').click();await page.locator('#full').click();
 assert.equal(await page.evaluate(()=>qaMedia.load),before.load);assert.deepEqual(errors,[]);
 }finally{await f.close();}
});

test('native fullscreen moves and restores the original transport on browser exit',{skip:!chromium},async()=>{
 const f=await fullApp();try{const {page}=f;await page.evaluate(()=>REUI.openChannel(0));await page.locator('#full').click();
 await page.waitForFunction(()=>document.fullscreenElement===document.getElementById('screen'));
 assert.equal(await page.locator('.fullscreen-controls>.tv-transport').count(),1);
 await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.body.classList.contains('player-fullscreen'));
 assert.equal(await page.locator('.player-pack>.tv-transport').count(),1);assert.equal(await page.locator('#full').getAttribute('aria-label'),'Fullscreen');
 }finally{await f.close();}
});
