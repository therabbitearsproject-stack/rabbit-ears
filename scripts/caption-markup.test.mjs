import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const source=await readFile(new URL('../assets/captions.js',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const {plainText,nativeText}=context.window.RabbitCaptions;

test('provider-escaped formatting is repaired without losing dialogue or comparisons',()=>{
 for(const input of ['<i>- Cerritos,</i> come in.','&lt;i&gt;- Cerritos,&lt;/i&gt; come in.',
  '&amp;lt;i&amp;gt;- Cerritos,&amp;lt;/i&amp;gt; come in.','&#x3c;i&#x3e;- Cerritos,&#x3c;/i&#x3e; come in.']){
  assert.equal(plainText(input),'- Cerritos, come in.');
  assert.equal(nativeText(input),'<i>- Cerritos,</i> come in.');
 }
 assert.equal(plainText('<v Doctor><c.yellow>Hello</c></v><br>2 &lt; 3 &amp; 5 &gt; 4.'),'Hello\n2 < 3 & 5 > 4.');
 assert.equal(plainText('Call <name> &unknown;'),'Call <name> &unknown;');
 assert.equal(nativeText('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
});

const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
test('real WebVTT preserves native italics while custom captions show clean text in all colors',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.setContent('<div id="screen" style="width:960px;height:600px;position:relative;background:#18212d"><video id="video" muted style="width:960px;height:600px"></video><button id="cc">CC</button></div>');
  await page.addStyleTag({path:fileURLToPath(new URL('../assets/captions.css',import.meta.url))});
  await page.addScriptTag({content:source});
  await page.evaluate(async()=>{
   window.fetch=async()=>({ok:false});
   const video=document.getElementById('video'),canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#18212d';ctx.fillRect(0,0,960,600);
   video.srcObject=canvas.captureStream(2);await video.play();
   window.originalVideo=video;window.loads=window.plays=0;video.load=()=>window.loads++;video.play=()=>{window.plays++;return Promise.resolve();};
   const saved=new Map([['re_caption_style','yellow']]);
   window.ui=RabbitCaptions.create({video,screen:document.getElementById('screen'),button:document.getElementById('cc'),store:{get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>saved.set(k,v)},source:()=>URL.createObjectURL(new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:50.000\n&lt;i&gt;- Cerritos,&lt;/i&gt; come in.\n'],{type:'text/vtt'}))});
   ui.setMedia({id:'fixture',sub:'English.srt'});
  });
  await page.waitForFunction(()=>document.querySelector('.caption-text')?.textContent==='- Cerritos, come in.');
  const first=await page.evaluate(()=>{const tr=document.querySelector('track'),cue=tr.track.cues[0];return {text:document.querySelector('.caption-text').textContent,cue:cue.text,italic:!!cue.getCueAsHTML().querySelector('i'),start:cue.startTime,end:cue.endTime,color:document.querySelector('.caption-layer').dataset.color,time:video.currentTime};});
  const inert=await page.evaluate(()=>{
   const cue=new VTTCue(0,50,RabbitCaptions.nativeText('&lt;img src=x onerror=window.captionInjected=true&gt;<i onclick=window.captionInjected=true>Words</i>'));
   const html=cue.getCueAsHTML();return {image:!!html.querySelector('img'),eventAttribute:!!html.querySelector('[onclick]'),injected:window.captionInjected===true,text:html.textContent};
  });
  assert.equal(inert.image,false);assert.equal(inert.eventAttribute,false);assert.equal(inert.injected,false);assert.ok(inert.text.includes('Words'));
  assert.equal(first.text,'- Cerritos, come in.');assert.equal(first.cue,'<i>- Cerritos,</i> come in.');assert.equal(first.italic,true);assert.deepEqual([first.start,first.end],[0,50]);assert.equal(first.color,'yellow');
  await page.evaluate(()=>ui.applyPreferences({re_caption_style:'white',re_caption_backing:true}));
  await page.waitForFunction(()=>document.querySelector('.caption-layer').dataset.color==='white');
  const after=await page.evaluate(()=>({text:document.querySelector('.caption-text').textContent,same:video===originalVideo,loads,plays,time:video.currentTime,backing:document.querySelector('.caption-layer').dataset.backing}));
  assert.equal(after.text,first.text);assert.equal(after.same,true);assert.equal(after.loads+after.plays,0);assert.ok(after.time>=first.time);assert.equal(after.backing,'true');
  // The native fallback uses the repaired cue too, rather than showing <i> text.
  await page.evaluate(()=>video.dispatchEvent(new Event('webkitbeginfullscreen')));
  assert.equal(await page.evaluate(()=>document.querySelector('track').track.mode),'showing');
  assert.equal(await page.evaluate(()=>document.querySelector('track').track.cues[0].getCueAsHTML().textContent),'- Cerritos, come in.');
  await page.evaluate(()=>video.dispatchEvent(new Event('webkitendfullscreen')));
  if(process.env.RABBIT_EARS_MARKUP_SCREENSHOT)await page.screenshot({path:process.env.RABBIT_EARS_MARKUP_SCREENSHOT});
 }finally{await browser.close();}
});
