import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
function tone(){const rate=48000,count=rate*12,b=Buffer.alloc(44+count*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(count*2,40);for(let i=0;i<count;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*6000),44+i*2);return b;}
const wav=tone();
async function server(cors){const s=http.createServer((req,res)=>{if(cors)res.setHeader('Access-Control-Allow-Origin','*');const url=new URL(req.url,'http://localhost');if(url.pathname==='/head-only.wav'&&req.method==='HEAD')res.setHeader('Access-Control-Allow-Origin','*');if(url.pathname==='/slow.wav')res.setHeader('Access-Control-Allow-Origin','*');if(url.pathname==='/slow.wav'&&req.method==='HEAD'){res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Length',wav.length);setTimeout(()=>res.end(),500);return;}if(url.pathname.endsWith('.wav')){res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Length',wav.length);res.end(req.method==='HEAD'?undefined:wav);return;}if(url.pathname.startsWith('/assets/')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(root,url.pathname)));return;}res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><button id="play">Play</button><video id="tv" loop src="/tone.wav"></video><audio id="radio"></audio><section id="settings"></section><script src="/assets/audio-model.js"></script><script src="/assets/audio-graph.js"></script><script src="/assets/audio-settings.js"></script><script>
window.saved={};const store={get:(k,d)=>Object.hasOwn(saved,k)?saved[k]:d,set:(k,v)=>saved[k]=JSON.parse(JSON.stringify(v))};const video=document.querySelector('video'),radio=document.querySelector('audio');video.volume=.8;window.reAudio=RabbitAudioSettings.create({container:document.querySelector('section'),store,video,radio});window.setMuted=value=>{reAudio.setMuted(value);store.set('re_tv_muted',value)};window.setTvVolume=value=>{video.volume=value;store.set('re_tv_volume',value);setMuted(value===0)};document.querySelector('#play').onclick=()=>video.play();</script>`);});await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));return{url:'http://127.0.0.1:'+s.address().port,close:()=>new Promise(resolve=>s.close(resolve))};}
async function fixture(fn){const a=await server(true),b=await server(false),browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{}),args:['--autoplay-policy=no-user-gesture-required']});try{const page=await browser.newPage();await page.addInitScript(()=>{window.audioMeters=[];window.permanentMediaSources=0;const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;connect.call(this,meter);window.audioMeters.push(meter);}return connect.call(this,destination,...args)};const original=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(...args){window.permanentMediaSources++;return original.apply(this,args)};window.outputRms=()=>Math.max(0,...audioMeters.map(m=>{const data=new Float32Array(m.fftSize);m.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((a,b)=>a+b*b,0)/data.length)}));});await page.goto(a.url);await page.click('#play');await fn(page,a.url,b.url);}finally{await browser.close();await a.close();await b.close();}}

test('real captured DSP obeys mute/volume and bypass restores the same native player',{skip:!chromium},async()=>fixture(async(page)=>{
 await page.selectOption('select.audio-presets','hifi');await page.waitForFunction(()=>document.querySelector('section').dataset.audioState==='processing');await page.waitForTimeout(300);
 const active=await page.evaluate(()=>({rms:outputRms(),physical:document.querySelector('video').muted,logical:reAudio.isMuted(),sources:permanentMediaSources,settings:saved.re_audio,time:document.querySelector('video').currentTime}));
 assert.ok(active.rms>.001,'real captured audio must reach the graph output');assert.equal(active.physical,true);assert.equal(active.logical,false);assert.equal(active.sources,0);assert.equal(active.settings.bands.length,10);
 await page.evaluate(()=>setMuted(true));await page.waitForTimeout(180);assert.ok(await page.evaluate(()=>outputRms())<.0001,'logical mute must silence processed output');
 await page.evaluate(()=>setMuted(false));await page.waitForTimeout(180);const loud=await page.evaluate(()=>outputRms());assert.ok(loud>.001);
 await page.evaluate(()=>setTvVolume(.2));await page.waitForTimeout(250);const soft=await page.evaluate(()=>outputRms());assert.ok(soft/loud>.15&&soft/loud<.4,'TV volume must scale captured output once');
 await page.selectOption('select.audio-presets','original');await page.waitForTimeout(200);const bypass=await page.evaluate(()=>({physical:document.querySelector('video').muted,logical:reAudio.isMuted(),paused:document.querySelector('video').paused,time:document.querySelector('video').currentTime,state:document.querySelector('section').dataset.audioState}));assert.equal(bypass.physical,false);assert.equal(bypass.logical,false);assert.equal(bypass.paused,false);assert.equal(bypass.state,'native');assert.ok(bypass.time>=active.time);
}));

test('CORS effects to a non-CORS source restores native audio without replacing video',{skip:!chromium},async()=>fixture(async(page,a,b)=>{
 await page.selectOption('select.audio-presets','rabbit-ears');await page.waitForFunction(()=>document.querySelector('section').dataset.audioState==='processing');
 await page.evaluate(url=>{window.sameVideo=document.querySelector('video');reAudio.prepareSource();sameVideo.src=url;sameVideo.play();},b+'/no-cors.wav');
 await page.waitForFunction(()=>document.querySelector('.audio-status').textContent.startsWith('Original sound —'));
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2&&!document.querySelector('video').paused);
 const result=await page.evaluate(()=>({same:sameVideo===document.querySelector('video'),muted:sameVideo.muted,logical:reAudio.isMuted(),cors:sameVideo.getAttribute('crossorigin'),ready:sameVideo.readyState,paused:sameVideo.paused,permanent:permanentMediaSources,state:document.querySelector('section').dataset.audioState,status:document.querySelector('.audio-status').textContent}));
 assert.equal(result.same,true);assert.equal(result.muted,false);assert.equal(result.logical,false);assert.equal(result.cors,null);assert.ok(result.ready>=2);assert.equal(result.paused,false);assert.equal(result.permanent,0);assert.equal(result.state,'native');
}));

test('unsupported capture and radio controls retain native playback and full preference shape',{skip:!chromium},async()=>fixture(async(page)=>{
 await page.evaluate(()=>{HTMLMediaElement.prototype.captureStream=undefined;HTMLMediaElement.prototype.mozCaptureStream=undefined;});
 await page.selectOption('select.audio-presets','living-room');await page.waitForFunction(()=>document.querySelector('.audio-status').textContent.includes('does not support'));
 await page.locator('input[aria-label="Radio volume"]').fill('0.35');await page.locator('input[aria-label="Radio volume"]').dispatchEvent('input');
 const state=await page.evaluate(()=>({settings:saved.re_audio,radio:document.querySelector('audio').volume,savedRadio:saved.re_vol,native:!document.querySelector('video').muted,paused:document.querySelector('video').paused}));
 assert.deepEqual(Object.keys(state.settings).sort(),['enabled','denoise','normalize','compression','amount','linked','makeup','position','eq','bands'].sort());assert.equal(state.radio,.35);assert.equal(state.savedRadio,.35);assert.equal(state.native,true);assert.equal(state.paused,false);
}));


test('failed real CORS reload restores native transport without invoking the site retune handler',{skip:!chromium},async()=>fixture(async(page,a,b)=>{
 await page.evaluate(url=>{reAudio.prepareSource();const v=document.querySelector('video');window.outerErrors=0;v.onerror=()=>outerErrors++;v.src=url;return v.play();},b+'/head-only.wav');
 await page.selectOption('select.audio-presets','rabbit-ears');
 await page.waitForFunction(()=>document.querySelector('.audio-status').textContent.includes('did not reconnect'));
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2&&!document.querySelector('video').paused);
 const state=await page.evaluate(()=>({errors:outerErrors,muted:document.querySelector('video').muted,cors:document.querySelector('video').getAttribute('crossorigin'),paused:document.querySelector('video').paused,processing:document.querySelector('section').dataset.audioState}));
 assert.equal(state.errors,0);assert.equal(state.muted,false);assert.equal(state.cors,null);assert.equal(state.paused,false);assert.equal(state.processing,'native');
}));

test('pausing while a CORS check waits never resumes or rewinds the TV',{skip:!chromium},async()=>fixture(async(page,a,b)=>{
 await page.evaluate(url=>{reAudio.prepareSource();const v=document.querySelector('video');v.src=url;return v.play();},b+'/slow.wav');
 await page.selectOption('select.audio-presets','hifi');await page.waitForTimeout(100);
 const before=await page.evaluate(()=>{const v=document.querySelector('video');v.pause();v.currentTime=4;return v.currentTime});
 await page.waitForTimeout(700);const state=await page.evaluate(()=>({paused:document.querySelector('video').paused,time:document.querySelector('video').currentTime,state:document.querySelector('section').dataset.audioState}));
 assert.equal(state.paused,true);assert.ok(Math.abs(state.time-before)<.1);assert.equal(state.state,'native');
}));
