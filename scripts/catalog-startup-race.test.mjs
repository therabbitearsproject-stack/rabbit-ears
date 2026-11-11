import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
// Execute the actual player functions, with controllable network completion order.
const code=html.slice(html.indexOf('let catalog = null;'),html.indexOf('// Resolve older catalog selections lazily'));
const channel={no:85,name:'Wild Kingdom',q:'wild'};
const row=['target','reviewed.mp4',1800,'Reviewed wildlife','1990','local:target.vtt','archive-source',1280,720,'browser-audio-v1'];
const published=()=>({programming:{fingerprint:'published'},pools:{wild:[row]}});
const response=data=>({ok:true,json:async()=>data});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function player(fetch){
 const saved=new Map(),writes=[];
 const context={fetch,BUILT_IN:[channel],listCache:{},metaCache:{},continuousCache:{},schedCache:{},effCache:{},planCache:{},
  setTimeout:()=>{},AbortSignal,Date,tidy:x=>x,cleanTitle:x=>x,blocked:()=>false,hash:()=>1,parseLen:Number,
  MediaCompatibility:{version:'browser-audio-v1',choose:(_all,f)=>f,knownCompatible:()=>true},
  store:{get:(k,fallback)=>saved.has(k)?saved.get(k):fallback,set:(k,v)=>{saved.set(k,v);writes.push(k);}}};
 vm.createContext(context);vm.runInContext(code+';this.api={loadCatalog,getList,getMeta};',context);
 return {...context,saved,writes,api:context.api};
}

test('first catalog clears warmed list, metadata and scheduling caches',async()=>{
 const p=player(async()=>response(published()));
 for(const name of ['listCache','metaCache','continuousCache','schedCache','effCache','planCache'])p[name].wild='live fallback';
 await p.api.loadCatalog(1000);
 for(const name of ['listCache','metaCache','continuousCache','schedCache','effCache','planCache'])assert.equal(Object.keys(p[name]).length,0,name);
 assert.deepEqual(Array.from(await p.api.getList(channel)),['target']);
 assert.equal((await p.api.getMeta('target')).sub,'local:target.vtt');
});

test('late live searches, including failures, yield to the catalog pool without caching fallback IDs',async()=>{
 for(const failure of [false,true]){
  const search=deferred(),p=player(url=>url==='catalog.json'?Promise.resolve(response(published())):search.promise);
  const pending=p.api.getList(channel);await p.api.loadCatalog(1000);
  if(failure)search.reject(Error('Archive offline'));else search.resolve(response({response:{docs:[{identifier:'wrong-live-episode'}]}}));
  assert.deepEqual(Array.from(await pending),['target']);
  assert.deepEqual(Array.from(await p.api.getList(channel)),['target']);
  assert.equal(p.writes.some(k=>k.startsWith('re_pool_')),false);
 }
});

test('pending live metadata cannot overwrite or erase newly cataloged captions',async()=>{
 for(const failure of [false,true]){
  const metadata=deferred(),p=player(url=>url==='catalog.json'?Promise.resolve(response(published())):metadata.promise);
  const pending=p.api.getMeta('target');await p.api.loadCatalog(1000);
  if(failure)metadata.reject(Error('Archive offline'));else metadata.resolve(response({metadata:{title:'Live title'},files:[{name:'wrong.mp4',length:60}]}));
  const result=await pending;assert.equal(result.file,'reviewed.mp4');assert.equal(result.sub,'local:target.vtt');
  assert.equal((await p.api.getMeta('target')).archiveId,'archive-source');
  assert.equal(p.writes.includes('re_m_audio1_target'),false,'stale live metadata is not persisted');
 }
});

test('catalog metadata beats persisted live metadata before a channel list is warmed',async()=>{
 const p=player(async()=>response(published()));
 p.saved.set('re_m_audio1_target',{id:'target',file:'old.mp4',dur:50});
 await p.api.loadCatalog(1000);assert.equal((await p.api.getMeta('target')).sub,'local:target.vtt');
});

test('channels absent from the catalog retain live lookup and offline cache fallbacks',async()=>{
 const p=player(async url=>response(url==='catalog.json'?{pools:{}}:String(url).includes('advancedsearch')?
  {response:{docs:[{identifier:'live'}]}}:{metadata:{title:'Live fallback'},files:[{name:'live.mp4',length:1800}]}));
 await p.api.loadCatalog(1000);
 assert.deepEqual(Array.from(await p.api.getList(channel)),['live']);
 assert.equal((await p.api.getMeta('live')).file,'live.mp4');
 assert.ok(p.writes.some(k=>k.startsWith('re_pool_')));
 const offline=player(async()=>{throw Error('offline');});
 offline.saved.set('re_pool_1',{t:Date.now(),ids:['cached-live']});
 assert.deepEqual(Array.from(await offline.api.getList(channel)),['cached-live']);
});
