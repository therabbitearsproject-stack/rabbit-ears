import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

test('original design returns to current guide by mouse, keyboard, mobile and without JavaScript',{skip:!chromium},async()=>{
 const root=path.resolve('.'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
 const server=createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  for(const scenario of ['mouse','keyboard','mobile','no-js','desktop-chrome']){
   const context=await browser.newContext({javaScriptEnabled:scenario!=='no-js',viewport:scenario==='mobile'?{width:390,height:844}:{width:1280,height:850}});
   await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await context.addInitScript(()=>{localStorage.setItem('re_welcomed','true');HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
   const page=await context.newPage();
   await page.goto(origin+'/design-history/2026-11-08-original/#radio');
   if(scenario==='desktop-chrome'){
    if(process.env.RABBIT_EARS_DESKTOP_CHROME){
     const chrome=await readFile(process.env.RABBIT_EARS_DESKTOP_CHROME,'utf8');
     await page.evaluate(source=>{const m={exports:null};new Function('module',source)(m);m.exports({document,window,ipcRenderer:{send(){},on(){}}});},chrome);
    }else await page.evaluate(()=>{const bar=document.createElement('div');bar.id='desktop-window-bar';bar.style.cssText='position:fixed;inset:0 0 auto;height:36px;z-index:2147483647;-webkit-app-region:drag';document.body.prepend(bar);});
    await page.waitForSelector('#desktop-window-bar');
    assert.equal(await page.locator('#originalReturn').evaluate(e=>getComputedStyle(e).getPropertyValue('-webkit-app-region')),'no-drag');
   }
   const link=page.locator('#originalReturn');await link.waitFor({state:'visible'});
   assert.equal(await link.getAttribute('href'),'/index.html#tv');
   if(scenario==='keyboard'){await link.focus();await page.keyboard.press('Enter');}else await link.click();
   await page.waitForURL(origin+'/index.html#tv');
   assert.equal(new URL(page.url()).pathname,'/index.html',scenario);
   assert.equal(await page.locator('#originalReturn').count(),0,scenario);
   assert.equal(await page.locator('#tabTv').count(),1,scenario);
   if(scenario!=='no-js')await page.waitForSelector('#openSettings');
   await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
