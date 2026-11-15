import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
async function fullApp(){
 const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)){res.writeHead(403);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await page.addInitScript(()=>{localStorage.setItem('re_welcomed','true');window.qaMedia={load:0,play:0};HTMLMediaElement.prototype.load=function(){qaMedia.load++;};HTMLMediaElement.prototype.play=function(){qaMedia.play++;return Promise.resolve();};});
 const url='http://127.0.0.1:'+server.address().port+'/#tv';await page.goto(url);await page.waitForFunction(()=>window.REUI&&document.getElementById('openSettings'));await page.waitForTimeout(500);
 return {page,context,url,async close(){await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
async function screenshot(page,name){if(process.env.RABBIT_EARS_SETTINGS_SCREENSHOTS){await mkdir(process.env.RABBIT_EARS_SETTINGS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.RABBIT_EARS_SETTINGS_SCREENSHOTS,name+'.png')});}}
test('Full app Settings replaces theme button, preserves logo, contains themes only and changes themes without touching playback',{skip:!chromium},async()=>{
 const f=await fullApp();try{const{page}=f;assert.equal(await page.locator('#chooseSkin').count(),0);const before=await page.evaluate(()=>({...qaMedia}));await page.locator('#openSettings').focus();await page.keyboard.press('Enter');await page.locator('#settingsDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#settingsSectionAudio').count(),0);assert.equal(await page.locator('.audio-group').count(),0);assert.equal(await page.locator('#settingsSectionTheme .skin-option').count(),9);await screenshot(page,'settings-theme-desktop');
 assert.equal(await page.locator('#captionLanguage option').count(),10);await page.selectOption('#captionLanguage','ar');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('re_caption_language'))),'ar');assert.deepEqual(await page.evaluate(()=>({...qaMedia})),before);
 for(const skin of ['retro','theatre','stadium','modern','cozy','metal','ivory','pixel','gutter']){await page.locator('.skin-option[data-preview='+skin+']').click();assert.equal(await page.locator('body').getAttribute('data-skin'),skin);assert.equal(await page.locator('.skin-option[data-preview='+skin+']').getAttribute('aria-pressed'),'true');}
 assert.deepEqual(await page.evaluate(()=>({...qaMedia})),before);await page.keyboard.press('Escape');assert.equal(await page.locator('#openSettings').evaluate(n=>n===document.activeElement),true);
 for(const width of [320,390,640,1440]){await page.setViewportSize({width,height:1000});for(const skin of ['retro','theatre','stadium','modern','cozy','metal','ivory','pixel','gutter']){await page.evaluate(s=>document.body.dataset.skin=s,skin);const m=await page.evaluate(()=>{const logo=document.querySelector('.wrap>header .site-wordmark').getBoundingClientRect(),gear=document.getElementById('openSettings').getBoundingClientRect();return{logo:logo.width,gear:gear.width,scroll:document.documentElement.scrollWidth};});assert.equal(m.logo,width<=640?Math.min(255,.65*width):Math.min(330,Math.max(220,.26*width)));assert.equal(m.gear,44);assert.ok(m.scroll<=width);}}
 await page.setViewportSize({width:390,height:844});await page.locator('#openSettings').click();await screenshot(page,'settings-theme-mobile');
 }finally{await f.close();}
});



test('stale audio profiles never activate processing; native mute and volume still work',{skip:!chromium},async()=>{
 const f=await fullApp();try{const{page}=f;await page.evaluate(()=>localStorage.setItem('re_audio',JSON.stringify({enabled:true,normalize:true,eq:true,bands:Array(10).fill(12)})));await page.reload();await page.waitForFunction(()=>window.REUI);
 assert.equal(await page.evaluate(()=>typeof window.RabbitAudioSettings),'undefined');assert.equal(await page.evaluate(()=>typeof window.reAudio),'undefined');assert.equal(await page.locator('script[src*="audio-settings"],script[src*="audio-graph"],script[src*="audio-worklet"]').count(),0);
 await page.evaluate(()=>REUI.showChannel());await page.locator('#mute').click();await page.locator('#tv-volume-popup input').fill('37');assert.equal(await page.evaluate(()=>document.getElementById('vid').volume),.37);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('re_tv_volume'))),.37);
 await page.locator('#mute').click();await page.locator('#tv-volume-popup .volume-mute').click();assert.equal(await page.evaluate(()=>document.getElementById('vid').muted),true);
 }finally{await f.close();}
});
