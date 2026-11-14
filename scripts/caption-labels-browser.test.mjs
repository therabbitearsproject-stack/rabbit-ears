import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}

test('native caption tracks identify English translations and clear labels when media changes',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="screen" style="width:640px;height:480px"><video id="video" style="width:640px;height:480px"></video><button id="cc">CC</button></div>');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/captions.js',import.meta.url))});
  const results=await page.evaluate(()=>{
   const saved=new Map([['re_caption_style','white']]);
   const video=document.getElementById('video'),screen=document.getElementById('screen'),button=document.getElementById('cc');
   const source=()=>URL.createObjectURL(new Blob(['WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA fixture sentence.\n'],{type:'text/vtt'}));
   const captions=RabbitCaptions.create({video,screen,button,store:{get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>saved.set(k,v)},source});
   const base={id:'same-video',sub:'local:auto-'+ 'a'.repeat(64)+'.vtt'};
   const set=(metadata,sub=base.sub)=>{captions.setMedia({...base,sub,...(metadata?{captionMetadata:metadata}:{})});const track=video.querySelector('track');return {srclang:track.srclang,label:track.label,nativeLanguage:track.track.language,nativeLabel:track.track.label,heading:screen.querySelector('.caption-options-title').textContent,style:saved.get('re_caption_style')};};
   const translated=set({kind:'auto-generated',language:'en',sourceLanguage:'cs',translated:true});
   const mixed=set({kind:'auto-generated',language:'en',sourceLanguage:'en',sourceLanguages:['en','cs','ja','cs'],translated:true});
   // Same video and subtitle URL: only the metadata changes, so an existing native track must refresh.
   const original=set({kind:'auto-generated',language:'ja',sourceLanguage:'ja',translated:false});
   const reviewed=set({kind:'reviewed',language:'en'},'local:reviewed.vtt');
   captions.setMedia({id:'legacy-video',sub:'English.srt'});
   const legacyTrack=video.querySelector('track'),legacy={label:legacyTrack.label,nativeLanguage:legacyTrack.track.language,heading:screen.querySelector('.caption-options-title').textContent};
   const englishOnly=set({kind:'auto-generated',language:'en',sourceLanguage:'en',sourceLanguages:['en'],translated:true});
   const DisplayNames=Intl.DisplayNames;Intl.DisplayNames=undefined;
   const fallback=set({kind:'auto-generated',language:'en',sourceLanguage:'cs',translated:true});Intl.DisplayNames=DisplayNames;
   video.currentTime=37;const sameVideo=video;let loads=0,plays=0;video.load=()=>loads++;video.play=()=>plays++;
   captions.applyPreferences({re_caption_style:'yellow',re_caption_backing:true});
   const applied={color:screen.querySelector('.caption-layer').dataset.color,backing:screen.querySelector('input[type=checkbox]').checked,mode:video.querySelector('track').track.mode,time:video.currentTime};
   captions.applyPreferences({re_captions:false});
   const off={track:!!video.querySelector('track'),sameVideo:video===sameVideo,time:video.currentTime,loads,plays};
   return {translated,mixed,original,reviewed,legacy,englishOnly,fallback,applied,off};
  });
  assert.deepEqual(results.translated,{srclang:'en',label:'English (auto-translated from Czech)',nativeLanguage:'en',nativeLabel:'English (auto-translated from Czech)',heading:'Auto-translated captions',style:'white'});
  assert.equal(results.mixed.label,'English (auto-translated from Czech and Japanese)');
  assert.equal(results.mixed.nativeLanguage,'en');
  assert.equal(results.original.label,'Japanese (auto-generated)');assert.equal(results.original.nativeLanguage,'ja');assert.equal(results.original.heading,'Auto-generated captions');
  assert.equal(results.reviewed.label,'English');assert.equal(results.reviewed.nativeLabel,'English');assert.equal(results.reviewed.nativeLanguage,'en');assert.equal(results.reviewed.heading,'Captions');
  assert.deepEqual(results.legacy,{label:'English',nativeLanguage:'en',heading:'Captions'});
  assert.equal(results.englishOnly.label,'English (auto-translated)');
  assert.equal(results.fallback.label,'English (auto-translated from Czech)');
  assert.deepEqual(results.applied,{color:'yellow',backing:true,mode:'hidden',time:37});
  assert.deepEqual(results.off,{track:false,sameVideo:true,time:37,loads:0,plays:0});
 }finally{await browser.close();}
});

test('standalone caption index hot-refresh changes tracks only and ignores stale media responses',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage();
  await page.route('http://captions.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="screen"><video id="video"></video><button id="cc">CC</button></div>'}));
  await page.goto('http://captions.test/');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/captions.js',import.meta.url))});
  const result=await page.evaluate(async()=>{
   let records=[],pending=null;
   window.fetch=()=>pending?new Promise(resolve=>{pending.resolve=resolve;}):Promise.resolve({ok:true,json:async()=>({schemaVersion:1,records})});
   const video=document.getElementById('video'),screen=document.getElementById('screen'),button=document.getElementById('cc');
   const saved=new Map([['re_caption_style','white']]);let loads=0,plays=0,pauses=0;
   video.load=()=>loads++;video.play=()=>{plays++;return Promise.resolve();};video.pause=()=>pauses++;video.currentTime=35;
   const originalVideo=video,sourceMedia={id:'episode-a',archiveId:'source-a',file:'Feature.mp4',dur:120,sub:''};
   const before=JSON.stringify(sourceMedia),ui=RabbitCaptions.create({video,screen,button,store:{get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>saved.set(k,v)},source:id=>'/subs/'+id+'.vtt'});
   ui.setMedia(sourceMedia);await ui.refreshIndex();const initiallyUnavailable=button.disabled;
   const record={archiveId:'source-a',video:'Feature.mp4',duration:120,sub:'local:auto-'+ 'b'.repeat(64)+'.vtt',sha256:'c'.repeat(64),captionMetadata:{kind:'auto-generated',language:'en',sourceLanguage:'cs',translated:true}};
   records=[record];await ui.refreshIndex();
   const track=video.querySelector('track'),added={disabled:button.disabled,label:track.label,language:track.track.language,url:track.src,heading:screen.querySelector('.caption-options-title').textContent};
   records=[{...record,sha256:'d'.repeat(64)}];await ui.refreshIndex();const checksumReloaded=video.querySelector('track')!==track;
   records=[{...record,duration:121}];await ui.refreshIndex();const wrongDurationRejected=!video.querySelector('track');
   records=[record];ui.setMedia({...sourceMedia,sub:'English.srt'});await ui.refreshIndex();const manual=video.querySelector('track').src;
   ui.setMedia(sourceMedia);records=[{...record,burned:true}];await ui.refreshIndex();const burnedBlocked=!video.querySelector('track');
   records=[record,{...record,sub:'local:reviewed.vtt',captionMetadata:{kind:'reviewed',language:'en'}}];await ui.refreshIndex();const reviewed=video.querySelector('track').label;
   pending={};const delayed=ui.refreshIndex();
   ui.setMedia({id:'episode-b',archiveId:'source-b',file:'Other.mp4',dur:120,sub:''});
   pending.resolve({ok:true,json:async()=>({schemaVersion:1,records:[record]})});pending=null;await delayed;
   const switchedSafe=!video.querySelector('track')&&button.disabled;
   return {initiallyUnavailable,added,checksumReloaded,wrongDurationRejected,manual,burnedBlocked,reviewed,switchedSafe,unchangedMedia:JSON.stringify(sourceMedia)===before,
    sameVideo:video===originalVideo,time:video.currentTime,loads,plays,pauses,style:saved.get('re_caption_style')};
  });
  assert.equal(result.initiallyUnavailable,true);assert.equal(result.added.disabled,false);
  assert.equal(result.added.label,'English (auto-translated from Czech)');assert.equal(result.added.language,'en');assert.equal(result.added.heading,'Auto-translated captions');
  assert.ok(result.added.url.endsWith('/captions/auto-'+'b'.repeat(64)+'.vtt?v='+'c'.repeat(64)));
  assert.equal(result.checksumReloaded,true);assert.equal(result.wrongDurationRejected,true);
  assert.ok(result.manual.endsWith('/subs/episode-a.vtt'));assert.equal(result.burnedBlocked,true);assert.equal(result.reviewed,'English');
  assert.equal(result.switchedSafe,true);assert.equal(result.unchangedMedia,true);assert.equal(result.sameVideo,true);assert.equal(result.time,35);
  assert.equal(result.loads+result.plays+result.pauses,0);assert.equal(result.style,'white');
 }finally{await browser.close();}
});
