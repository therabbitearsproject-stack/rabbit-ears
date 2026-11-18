import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../assets/playback-recovery.js',import.meta.url),'utf8');
const recovery=new Function(source+';return REPlaybackRecovery;')();
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function fixture(retry){
 let clock=0,serial=0;
 const timers=new Map(),calls=[],waits=[];
 const state={identity:'tv|97|1',active:true,online:true,playing:true,time:1200,paused:false,ready:4};
 const manager=recovery.create({read:()=>({...state}),now:()=>clock,
  retry:async s=>{calls.push(s);return retry?retry(s):true;},waiting:delay=>waits.push(delay),
  later:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},cancel:id=>timers.delete(id),
  every:()=>1,stopEvery:()=>{}});
 return {state,manager,timers,calls,waits,advance:ms=>clock+=ms,
  async fire(){const [id,t]=timers.entries().next().value;timers.delete(id);clock+=t.delay;await t.fn();await flush();}};
}
test('temporary outages retry with capped backoff and stop when playback resumes',async()=>{
 let f;f=fixture(()=>{f.manager.failed();return true;});
 f.manager.failed();assert.equal(f.timers.size,1);
 for(let i=0;i<5;i++)await f.fire();
 assert.deepEqual(f.waits,[5000,10000,20000,30000,30000,30000]);
 f.state.time+=2;f.manager.check();
 assert.equal(f.timers.size,0);assert.equal(f.manager.state().attempts,0);
});
test('offline retries wait for reconnection and then start immediately',async()=>{
 const f=fixture();f.state.online=false;f.manager.failed();
 assert.equal(f.timers.size,0);assert.equal(f.calls.length,0);
 f.state.online=true;f.manager.wake();assert.equal(f.waits.at(-1),0);
 await f.fire();assert.equal(f.calls.length,1);
});
test('a channel change cancels a queued retry rather than reopening the old channel',async()=>{
 const f=fixture();f.manager.failed();f.state.identity='tv|42|2';
 await f.fire();assert.equal(f.calls.length,0);
 f.manager.check();assert.equal(f.manager.state().needed,false);
});
test('paused, hidden, non-TV, autoplay-blocked and casting states never restart local media',async()=>{
 for(const label of ['paused','hidden','radio','autoplay-blocked','casting']){
  const f=fixture();f.manager.failed();f.state.active=false;
  await f.fire();assert.equal(f.calls.length,0,label);
  f.advance(120000);f.manager.check();f.manager.wake();
  assert.equal(f.timers.size,0,label);
 }
});
test('mid-show stalls and stalled initial tuning recover without page reload',async()=>{
 for(const playing of [true,false]){
  const f=fixture();f.state.playing=playing;
  f.advance(29999);f.manager.check();assert.equal(f.timers.size,0);
  f.advance(1);f.manager.check();assert.equal(f.timers.size,1);
  await f.fire();assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].time,1200);
 }
});
test('clock-correction seeks do not disguise a buffering stall as healthy playback',()=>{
 const f=fixture();f.state.ready=1;f.state.seeking=true;
 for(let i=0;i<6;i++){f.advance(5000);f.state.time+=20;f.manager.check();}
 assert.equal(f.timers.size,1);assert.equal(f.manager.state().needed,true);
});
test('returning to a paused app reconnects promptly while intentional pause remains excluded',async()=>{
 const f=fixture();f.state.active=false;f.advance(60000);f.manager.check();
 f.state.active=true;f.state.paused=true;f.manager.wake();
 assert.equal(f.waits.at(-1),0);await f.fire();assert.equal(f.calls.length,1);
});
test('retries are serialized and ignore a user action during asynchronous recovery',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));
 f.manager.failed();const attempt=f.fire();await flush();
 f.manager.failed();f.manager.wake();assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
 f.state.identity='games|0|2';f.state.active=false;resolve(false);await attempt;
 assert.equal(f.timers.size,0);assert.equal(f.manager.state().needed,false);
});
test('site retries use the live slot, retain preferences and fence late catalog responses',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const integration=html.slice(html.indexOf('if (window.REPlaybackRecovery)'),html.indexOf('// Lock screen, Control Center'));
 assert.match(integration,/current\.token !== expected\.token/);
 assert.match(integration,/current\.channel !== expected\.channel/);
 assert.match(integration,/rabbit-cast/);
 assert.match(integration,/activeSegment = null;\s+syncMedia\(\)/);
 assert.doesNotMatch(integration,/location\.(reload|href)\s*[=(]|localStorage\.clear|currentTime\s*=\s*0/);
});
test('an empty lineup from failed metadata is rebuilt once the source recovers with the same catalog',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('async function continuousLineup'),html.indexOf('async function lineup'));
 let available=false,lookups=0;
 const catalog={programming:{fingerprint:'unchanged',channels:{}}};
 const context=vm.createContext({catalog,EPOCH:0,getList:async()=>['episode'],
  getMeta:async()=>{lookups++;return available?{id:'episode'}:null;},distinctPrograms:items=>items,
  makeSlot:media=>media,CommercialTiming:{cycle:(items,_anchor,_time,count)=>items.slice(0,count)}});
 vm.runInContext('const continuousCache={};'+code+';this.lineup=continuousLineup;this.cache=continuousCache;',context);
 assert.equal((await context.lineup({q:'channel',no:97},100,1)).length,0);
 assert.equal(context.cache.channel,undefined);
 available=true;
 const restored=await context.lineup({q:'channel',no:97},100,1);
 assert.equal(restored[0].id,'episode');assert.equal(lookups,2);
 assert.equal(context.catalog,catalog);
});
test('a slow retune cannot block the recovery controller after the catalog returns',async()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const code=html.slice(html.indexOf('retry: async expected => {'),html.indexOf('\n  });\n  window.addEventListener("online"'));
 const retrySource=code.replace('retry: async expected => {','(async expected => {')+')';
 let calls=0;
 const context=vm.createContext({playing:null,loadCatalog:async()=>{},
  recoverySnapshot:()=>({active:true,online:true,token:1,channel:97}),sourceMetadata:new Map(),resolvedMedia:new Map(),
  playbackCopies:{},listCache:{q:['old']},continuousCache:{q:Promise.resolve([])},metaCache:{failed:null},
  channels:()=>[{q:'q'}],cur:0,tune:()=>{calls++;return new Promise(()=>{});},automaticPlaybackRecovery:{failed(){}}});
 const retry=vm.runInContext(retrySource,context);
 assert.equal(await retry({token:2,channel:97}),false); // stale request exits before tuning
 assert.equal(calls,0);
 context.cur=97;context.channels=()=>Object.assign([],{97:{q:'q'}});
 assert.equal(await retry({token:1,channel:97}),true);
 assert.equal(calls,1);assert.equal(context.continuousCache.q,undefined);
});
test('live recovery policy respects user pause and Cast but keeps visible pop-out playback recoverable',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const code=html.slice(html.indexOf('const recoverySnapshot ='),html.indexOf('automaticPlaybackRecovery = window.REPlaybackRecovery.create'));
 let casting=false;
 const context=vm.createContext({mode:'tv',cur:0,tuneId:1,tvOn:true,held:false,playbackAutoplayBlocked:false,
  playing:{},navigator:{onLine:true},vid:{currentTime:10,paused:false,readyState:4},
  document:{hidden:true,getElementById:()=>({getAttribute:()=>casting?'true':'false'})},
  window:{RETVPopout:{active:false}}});
 vm.runInContext(code+';this.snapshot=recoverySnapshot;',context);
 assert.equal(context.snapshot().active,false);
 context.window.RETVPopout.active=true;assert.equal(context.snapshot().active,true);
 context.held=true;assert.equal(context.snapshot().active,false);
 context.held=false;casting=true;assert.equal(context.snapshot().active,false);
 casting=false;context.window.RETVPopout.active=false;context.document.pictureInPictureElement=context.vid;
 assert.equal(context.snapshot().active,true);
 context.playbackAutoplayBlocked=true;assert.equal(context.snapshot().active,false);
});
