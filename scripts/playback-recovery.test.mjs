import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const compatibility=readFileSync(new URL('../media-compatibility.js',import.meta.url),'utf8');
const resolver=html.slice(html.indexOf('const resolvedMedia ='),html.indexOf('\nconst fileUrl ='));
const player=html.slice(html.indexOf('let playbackTimer;'),html.indexOf('// Lock screen, Control Center'));
const files=[{name:'Episode.mp4',length:2700,source:'original',audio_codec:'aac',video_codec:'hevc',width:1920,height:1080},
 {name:'Episode.ia.mp4',original:'Episode.mp4',length:2700,source:'derivative',format:'h.264 IA',width:720,height:400},
 {name:'Other.ia.mp4',length:2700,source:'derivative',format:'h.264 IA'}];
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(fetcher){
 const timers=new Map(),loads=[],errors=[],captions=[],saved=new Map();let timerId=0;
 const span={textContent:''},button={hidden:true},status={hidden:true,querySelector:q=>q==='span'?span:button},power={hidden:true};
 const vid={duration:2700,readyState:4,currentTime:0,pause(){},load(){loads.push(this.src);},play(){return Promise.resolve();}};
 const ctx=vm.createContext({console,AbortSignal,Date,Map,Set,Promise,document:{hidden:false},vid,snow:{style:{opacity:'1'}},
 fetch:fetcher,store:{get:(k,d)=>saved.get(k)??d,set:(k,v)=>saved.set(k,v)},hash:x=>x,limited:fn=>fn(),
 $:id=>id==='playbackStatus'?status:power,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
 resetReport(){},applyCaptions(){captions.push(ctx.activeSegment.media);},reError:(...args)=>errors.push(args),
 tune(){throw Error('Playback must not retune the channel');},channels:()=>[{name:'Test97'}],cur:0,tuneId:1,mediaToken:0,
 activeSegment:null,playing:{v0:1000,end:4000},tvOn:true,held:false,position:937,index:0,
 currentSegment(){return {index:ctx.index,kind:'program',position:ctx.position,media:{id:'stable-episode',archiveId:'collection',file:'Episode.mp4',dur:2700,sub:'local:original.vtt'}};},
 fileUrl:m=>m.file,CommercialTiming:{},catalog:{}});
 ctx.window=ctx;
 vm.runInContext(compatibility+'\n'+resolver+'\n'+player,ctx);
 return {ctx,vid,loads,errors,captions,span,button,status,power,timers,async start(){ctx.syncMedia();await flush();},async error(){vid.error={code:4};vid.onerror();await flush();}};
}
const response=x=>({ok:true,json:async()=>x});

test('same-origin verified copy works even when Archive metadata is unavailable and preserves captions/clock',async()=>{
 const f=fixture(async url=>{assert.equal(url,'assets/playback-copies.json');return response({copies:{'collection|Episode.mp4':{file:'Episode.ia.mp4',duration:2700}}});});
 await f.start();assert.deepEqual(f.loads,['Episode.ia.mp4']);assert.equal(f.captions[0].video,'Episode.mp4');assert.equal(f.captions[0].id,'stable-episode');
 f.ctx.position=999;f.vid.onloadedmetadata();assert.equal(f.vid.currentTime,999);f.vid.onplaying();assert.equal(f.status.hidden,true);assert.equal(f.timers.size,0);
});

test('failed original gets one same-episode alternate without retuning; exhausted files never loop',async()=>{
 let metadata=0;
 const f=fixture(async url=>{if(url.startsWith('assets/'))return response({copies:{}});if(++metadata===1)throw Error('temporary metadata outage');return response({files});});
 await f.start();assert.deepEqual(f.loads,['Episode.mp4']);await f.error();assert.deepEqual(f.loads,['Episode.mp4','Episode.ia.mp4']);
 f.ctx.position=1044;f.vid.onloadedmetadata();assert.equal(f.vid.currentTime,1044);assert.equal(f.captions[1].sub,'local:original.vtt');assert.equal(f.captions[1].video,'Episode.mp4');
 await f.error();assert.match(f.span.textContent,/No compatible copy/);assert.equal(f.button.hidden,false);assert.equal(f.ctx.snow.style.opacity,'0');
 const requests=metadata;await f.error();await f.error();assert.equal(metadata,requests);assert.equal(f.loads.length,2);
 assert.match(f.errors[0][1],/Episode.mp4/);
});

test('late alternate cannot overwrite a newly tuned channel',async()=>{
 let release,metadata=0;const f=fixture(async url=>{
  if(url.startsWith('assets/'))return response({copies:{}});
  if(++metadata===1)throw Error('offline');return new Promise(r=>release=r);
 });
 await f.start();f.vid.error={code:4};f.vid.onerror();await flush();f.ctx.tuneId++;f.ctx.activeSegment={key:'new-channel'};
 release(response({files}));await flush();assert.deepEqual(f.loads,['Episode.mp4']);
});

test('a changed commercial segment is synchronized instead of starting an old episode alternate',async()=>{
 let metadata=0,release;const f=fixture(async url=>{if(url.startsWith('assets/'))return response({copies:{}});if(++metadata===1)throw Error('offline');return new Promise(r=>release=r);});
 await f.start();f.vid.error={code:4};f.vid.onerror();await flush();f.ctx.index=1;release(response({files}));await flush();
 assert.notEqual(f.ctx.activeSegment.key,'1|1000|0');
});

test('startup timeout recovers, while autoplay permission asks for a tap instead of changing files',async()=>{
 const f=fixture(async url=>response(url.startsWith('assets/')?{copies:{}}:{files}));await f.start();
 f.vid.play=()=>Promise.reject(Object.assign(Error('tap required'),{name:'NotAllowedError'}));
 f.vid.onloadedmetadata();await flush();assert.equal(f.power.hidden,false);assert.equal(f.timers.size,0);assert.equal(f.loads.length,1);
 const g=fixture(async url=>response(url.startsWith('assets/')?{copies:{}}:{files}));await g.start();const timer=[...g.timers.values()][0];timer();await flush();assert.equal(g.loads.length,1);assert.match(g.span.textContent,/No compatible copy/);
});

test('verified manifest matches the current affected episode and has bounded durations',()=>{
 const data=JSON.parse(readFileSync(new URL('../assets/playback-copies.json',import.meta.url)));
 const [key,copy]=Object.entries(data.copies).find(([key])=>key.includes('S01E16 - Shuttlepod One'));
 assert.match(key,/star-trek-enterprise-complete\|/);assert.match(copy.file,/Shuttlepod One Bluray-480p\.ia\.mp4$/);assert.ok(copy.duration>2600&&copy.duration<2700);
 for(const [key,copy]of Object.entries(data.copies)){assert.ok(key.includes('|'));assert.ok(copy.file.endsWith('.ia.mp4'));assert.ok(Number.isFinite(copy.duration)&&copy.duration>5);}
});


test('a commercial and its replacement bumper both fail without leaving endless static',async()=>{
 const f=fixture(async()=>{throw Error('not needed');});
 f.ctx.currentSegment=()=>({index:0,kind:'commercial',position:5,media:{id:'ad',file:'assets/ad.mp4',local:true,dur:30}});
 f.ctx.catalog.channelBumpers={'97':[{id:'bumper',file:'assets/bumper.mp4',dur:12,local:true}]};
 f.ctx.channels=()=>[{no:97,name:'Test97'}];
 await f.start();await f.error();assert.deepEqual(f.loads,['assets/ad.mp4','assets/bumper.mp4']);
 await f.error();assert.equal(f.button.hidden,false);assert.equal(f.ctx.snow.style.opacity,'0');assert.equal(f.timers.size,0);
});
