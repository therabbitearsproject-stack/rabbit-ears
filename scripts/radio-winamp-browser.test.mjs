import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

test('Winamp Deck preserves live audio, real transport/clock/volume and saved appearance across responsive rooms',{skip:!chromium},async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
 const server=createServer(async(req,res)=>{try{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(f.endsWith(path.sep))f+='index.html';if(!f.startsWith(root))throw Error('Outside fixture');res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const wav=Buffer.alloc(44+8000*2*60);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),station={stationuuid:'qa-radio',name:'Night Drive Radio',country:'United States',countrycode:'US',tags:'electronic',codec:'MP3',bitrate:128,url_resolved:'https://radio.example.test/live.wav',favicon:'',lastcheckok:1};
  const names=['Night Drive Radio','Stereo Skyline','The Ambient Room','Midnight Frequency','Static & Soul','After Hours','Electric Avenue','Deep Listening'];
  await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith('http://127.0.0.1:'))return r.continue();if(u.includes('radio-browser.info'))return r.fulfill({json:u.includes('/countries')?[]:names.map((name,i)=>({...station,name,stationuuid:station.stationuuid+i}))});if(u.includes('radio.example.test'))return r.fulfill({contentType:'audio/wav',body:wav});return r.abort();});
  await page.addInitScript(()=>localStorage.setItem('re_welcomed','true'));
  const base='http://127.0.0.1:'+server.address().port;await page.goto(base+'/#radio');await page.waitForFunction(()=>!!window.REUI);await page.locator('.station').first().waitFor();
  await page.getByRole('button',{name:'Winamp Deck',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-radio-look'),'winamp');
  await page.locator('.station').first().click();await page.waitForFunction(()=>!audio.paused&&audio.currentTime>.3);await page.waitForFunction(()=>document.querySelector('.amp-time').textContent!=='00:00');
  if(process.env.RABBIT_RADIO_REVIEW_DIR){await mkdir(process.env.RABBIT_RADIO_REVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RABBIT_RADIO_REVIEW_DIR,'desktop.png')});await page.setViewportSize({width:390,height:1100});await page.screenshot({path:path.join(process.env.RABBIT_RADIO_REVIEW_DIR,'mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});}
  await page.evaluate(()=>{window.originalRadio=audio;window.originalRadioSource=audio.currentSrc;window.radioLoads=0;window.radioPlays=0;const load=audio.load.bind(audio),play=audio.play.bind(audio);audio.load=(...a)=>{radioLoads++;return load(...a);};audio.play=(...a)=>{radioPlays++;return play(...a);};});
  for(const name of ['Vinyl deck','Car stereo','Winamp Deck'])await page.getByRole('button',{name,exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>({same:originalRadio===audio,src:audio.currentSrc===originalRadioSource,paused:audio.paused,loads:radioLoads,plays:radioPlays})),{same:true,src:true,paused:false,loads:0,plays:0});
  await page.evaluate(()=>{const input=document.getElementById('rVol');input.value='.35';input.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>audio.volume),.35);
  for(const skin of ['retro','theatre','stadium','modern','cozy','metal','ivory','pixel','gutter'])for(const width of [320,390,768,1440,1920,2560]){
   await page.evaluate(s=>REUI.applyPreferences({re_skin:s}),skin);await page.setViewportSize({width,height:1000});
   const metrics=await page.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),nav=box('.tabs'),choices=box('.radio-appearance');return {overflow:document.documentElement.scrollWidth>innerWidth+1,main:getComputedStyle(document.querySelector('.amp-titlebar')).display,visible:box('.amp-clock-panel').width>0,playerFirst:box('#radioView .radio-set').bottom<=box('#radioView>.guide').top,choicesAbove:choices.bottom<=box('#radioView .radio-set').top,desktopAligned:innerWidth<1000||Math.abs(nav.top-choices.top)<5&&choices.left>=nav.right};});
   assert.equal(metrics.overflow,false,skin+' '+width);assert.equal(metrics.visible,true);assert.notEqual(metrics.main,'none');assert.equal(metrics.playerFirst,true,skin+' '+width+' player above stations');assert.equal(metrics.choicesAbove,true);assert.equal(metrics.desktopAligned,true,skin+' '+width+' appearance beside main navigation');
  }
  await page.locator('#rPlay').click();await page.waitForFunction(()=>audio.paused&&/Play/.test(document.getElementById('rPlay').textContent));
  await page.reload();await page.waitForFunction(()=>!!window.REUI);assert.equal(await page.locator('body').getAttribute('data-radio-look'),'winamp');assert.equal(await page.locator('.radio-appearance [data-radio-look=winamp]').getAttribute('aria-pressed'),'true');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
