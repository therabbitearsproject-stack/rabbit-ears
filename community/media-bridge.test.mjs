import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleMediaBridge,canonicalMediaURL,validMediaRange} from './media-bridge.mjs';
import {mediaSources} from './generate-media-sources.mjs';
import worker from './worker.mjs';
import deployedSources from './media-sources.json' with {type:'json'};
const env={SITE_ORIGIN:'https://rabbit-ears.stream'},record={archiveId:'public-item',file:"Season 1/A & B's (1990).mp4"},upstream=canonicalMediaURL(record),id=createHash('sha256').update(upstream).digest('hex'),sources={[id]:record};
const request=(method='GET',headers={},path='/media/'+id)=>new Request('https://community.rabbit-ears.stream'+path,{method,headers});
const handle=(req,fetcher)=>handleMediaBridge(req,env,sources,{fetcher});
const media=(status=200,extra={},body='video bytes')=>new Response(body,{status,headers:{'Content-Type':'video/mp4',...extra}});
test('only the exact hashed allowlisted source is reachable; no auth or caller URL is forwarded',async()=>{
 let calls=0;const fetcher=async(url,options)=>{calls++;assert.equal(url,upstream);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(options.headers.get('Cookie'),null);assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('Referer'),null);return media();};
 const response=await handle(request('GET',{Origin:env.SITE_ORIGIN,Cookie:'session=secret',Authorization:'Bearer secret',Referer:'https://private.invalid'}),fetcher);
 assert.equal(response.status,200);assert.equal(await response.text(),'video bytes');assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.SITE_ORIGIN);assert.match(response.headers.get('Access-Control-Expose-Headers'),/Content-Range/);assert.equal(calls,1);
 assert.equal((await handle(request(),fetcher)).status,200,'originless native media remains public');
 for(const [req,status]of [[request('GET',{Origin:'https://evil.invalid'}),403],[request('POST'),405],[request('GET',{},'/media/'+'a'.repeat(64)),404],[request('GET',{},'/media/'+id+'?url=https://evil.invalid'),404],[request('GET',{},'/media/../../private'),404]])assert.equal((await handle(req,()=>{throw Error('must not fetch');})).status,status);
 assert.equal((await handleMediaBridge(request(),env,{[id]:{archiveId:'other',file:'other.mp4'}},{fetcher})).status,404);
});
test('single byte ranges retain exact 206 headers and streaming body without buffering',async()=>{
 for(const [range,returned]of [['bytes=0-','bytes 0-9/10'],['bytes=2-5','bytes 2-5/10'],['bytes=-3','bytes 7-9/10'],['bytes=4-99','bytes 4-9/10']]){
  const [,a,b]=/^bytes (\d+)-(\d+)/.exec(returned),length=Number(b)-Number(a)+1;let buffered=false;
  const response=await handle(request('GET',{Range:range}),async(url,options)=>{
   assert.equal(options.headers.get('Range'),range);const upstream=media(206,{'Content-Range':returned,'Content-Length':String(length),'Set-Cookie':'must=not-forward'},new ReadableStream({start(c){c.enqueue(new Uint8Array(length));c.close();}}));upstream.arrayBuffer=()=>{buffered=true;throw Error('no buffering');};return upstream;
  });assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),returned);assert.equal(response.headers.get('Content-Length'),String(length));assert.equal(response.headers.get('Accept-Ranges'),'bytes');assert.equal(response.headers.get('Set-Cookie'),null);assert.equal((await response.arrayBuffer()).byteLength,length);assert.equal(buffered,false);
 }
 for(const range of ['bytes=1-0','bytes=-0','bytes=-','bytes=1-2,4-5','items=0-','bytes=0-'.repeat(20),'bytes=90000000000000000-']){assert.equal(validMediaRange(range),false);assert.equal((await handle(request('GET',{Range:range}),()=>{throw Error('must not fetch');})).status,416);}
 assert.equal((await handle(request('GET',{Range:'bytes=2-5'}),async()=>media(200))).status,502,'ignoring a seek range cannot silently restart a movie');
 assert.equal((await handle(request('GET',{Range:'bytes=2-5'}),async()=>media(206,{'Content-Range':'bytes 0-3/10','Content-Length':'4'}))).status,502);
 const unsatisfied=await handle(request('GET',{Range:'bytes=99-'}),async()=>new Response(null,{status:416,headers:{'Content-Range':'bytes */10'}}));assert.equal(unsatisfied.status,416);assert.equal(unsatisfied.headers.get('Content-Range'),'bytes */10');
});
test('HEAD and CORS preflight expose range support without body or credential requests',async()=>{
 const head=await handle(request('HEAD'),async(url,options)=>{assert.equal(options.method,'HEAD');return media(200,{'Content-Length':'123'});});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),'123');
 const preflight=await handle(request('OPTIONS',{Origin:env.SITE_ORIGIN,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'range'}),()=>{throw Error('must not fetch');});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Range');assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
 assert.equal((await handle(request('OPTIONS',{'Access-Control-Request-Headers':'Authorization'}),()=>{})).status,403);
});
test('redirects remain on credential-free HTTPS Archive hosts and retain method/range',async()=>{
 let count=0;const response=await handle(request('GET',{Range:'bytes=0-0'}),async(url,options)=>{assert.equal(options.headers.get('Range'),'bytes=0-0');if(count++===0)return new Response(null,{status:302,headers:{Location:'https://ia800001.us.archive.org/1/items/public-item/movie.mp4'}});return media(206,{'Content-Range':'bytes 0-0/10','Content-Length':'1'},'v');});assert.equal(response.status,206);assert.equal(count,2);
 for(const location of ['http://archive.org/file.mp4','https://archive.org.evil.invalid/file.mp4','https://evil.invalid/archive.org','https://user:pass@archive.org/file.mp4','https://archive.org:444/file.mp4','http://127.0.0.1/private'])assert.equal((await handle(request(),async()=>new Response(null,{status:302,headers:{Location:location}}))).status,502);
 count=0;assert.equal((await handle(request(),async()=>{count++;return new Response(null,{status:302,headers:{Location:'/endless'}});})).status,502);assert.equal(count,6);
});
test('private/unexpected/HTML upstream responses cannot become audio media',async()=>{
 for(const response of [new Response('private',{status:403}),new Response('login',{headers:{'Content-Type':'text/html'}}),new Response('{}',{headers:{'Content-Type':'application/json'}}),media(200,{'Content-Encoding':'gzip'})])assert.equal((await handle(request(),async()=>response)).status,502);
 assert.equal((await handle(request(),async()=>{throw Error('private upstream details');})).status,502);
});
test('allowlist recursively includes protected programs, packed pools and remote breaks but excludes local assets',()=>{
 const catalog={pools:{q:[['packed','episode.mp4',60,'Title','','','real-item']]},programming:{channels:{97:{items:[{m:{id:'protected',file:'frozen.mp4',dur:60}}]}}},channelAds:{1:[{id:'ad',file:'ad.mp4',dur:30}]},breakLibraries:{one:{bumpers:[{id:'local',file:'assets/local.mp4',local:true},{id:'remote',file:'break.mp4'}]}}};
 const list=mediaSources(catalog);assert.equal(Object.keys(list).length,4);assert.deepEqual(new Set(Object.values(list).map(v=>v.archiveId)),new Set(['real-item','protected','ad','remote']));
 for(const [key,value]of Object.entries(list))assert.equal(key,createHash('sha256').update(canonicalMediaURL(value)).digest('hex'));
 for(const value of [{archiveId:'../secret',file:'a.mp4'},{archiveId:'okay',file:'../secret.mp4'},{archiveId:'okay',file:'nested\\a.mp4'},{archiveId:'okay',file:'https://evil/a.mp4'},{archiveId:'okay',file:'note.html'}])assert.equal(canonicalMediaURL(value),null);
});
test('actual worker dispatches anonymous media preflight before account API gates',async()=>{
 const key=Object.keys(deployedSources)[0],req=request('OPTIONS',{Origin:env.SITE_ORIGIN,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Range'},'/media/'+key);
 const response=await worker.fetch(req,{...env,DB:{prepare(){throw Error('media must not read sessions');}}},{});assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Headers'),'Range');
 assert.equal((await worker.fetch(request('GET',{},'/media/'+'0'.repeat(63)),env,{})).status,404);
});
test('new public catalog entries resolve through fixed hash shards and are cached without caller-controlled URLs',async()=>{
 const cache=new Map(),published={[id]:record};let shardReads=0,mediaReads=0;
 const fetcher=async(url,options)=>{
  if(url.startsWith(env.SITE_ORIGIN)){
   shardReads++;assert.equal(url,env.SITE_ORIGIN+'/audio-media/'+id.slice(0,2)+'.json');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cf.cacheTtl,60);
   return Response.json(published);
  }
  mediaReads++;assert.equal(url,upstream);return media();
 };
 for(let i=0;i<2;i++)assert.equal((await handleMediaBridge(request(),env,{}, {fetcher,shardCache:cache})).status,200);
 assert.equal(shardReads,1);assert.equal(mediaReads,2);
 cache.values().next().value.until=0;
 assert.equal((await handleMediaBridge(request(),env,{}, {fetcher,shardCache:cache})).status,200);assert.equal(shardReads,2);
});
test('untrusted or oversized catalog shards never authorize another file or upstream endpoint',async()=>{
 const invalid=[()=>Response.json({[id]:{archiveId:'different',file:'other.mp4'}}),()=>Response.json({[id]:{archiveId:'../private',file:'other.mp4'}}),()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(1024*1024+1)}}),()=>new Response(' '.repeat(1024*1024+1),{headers:{'Content-Type':'application/json'}}),()=>new Response('{}',{headers:{'Content-Type':'text/html'}}),()=>new Response(null,{status:302,headers:{Location:'https://evil.invalid/list.json'}})];
 for(const shard of invalid){let count=0;const response=await handleMediaBridge(request(),env,{}, {shardCache:new Map(),fetcher:async url=>{count++;assert.equal(url,env.SITE_ORIGIN+'/audio-media/'+id.slice(0,2)+'.json');return shard();}});assert.equal(response.status,404);assert.equal(count,1);}
});
