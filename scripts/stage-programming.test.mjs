import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stageProgramming,fingerprint} from './stage-programming.mjs';
import {siteCode} from './tv-feed.mjs';
const root=new URL('../',import.meta.url);
const [html,commercialTiming,mediaCompatibility,catalogText]=await Promise.all(['index.html','commercial-timing.js','media-compatibility.js','catalog.json'].map(p=>readFile(new URL(p,root),'utf8')));
const base=()=>({html,commercialTiming,mediaCompatibility,catalog:JSON.parse(catalogText)});
const now=Date.UTC(2026,10,11,8)/1000;
function changed(previous,id='new-film'){
 const next=structuredClone(previous),ch=siteCode(next).BUILT_IN.find(c=>c.no===30);
 next.catalog.pools[ch.q]=[[id,'full.mp4',14400,'New full film','1992','']];
 return next;
}
test('published programs and their full timelines survive two hours, then the new rotation starts at a boundary',async()=>{
 const previous=base();delete previous.catalog.programming;
 const next=changed(previous);next.catalog.programming=await stageProgramming({previous,next,now});
 const old=siteCode(previous),fresh=siteCode(next),ch=fresh.BUILT_IN.find(c=>c.no===30),staged=next.catalog.programming.channels[30];
 assert.ok(staged.until>=now+7200);assert.equal(staged.until,staged.items.at(-1).end);
 for(const t of [now,now+3600,now+7200,staged.until-.1])assert.deepEqual((await fresh.lineup(ch,t,1))[0],(await old.lineup(ch,t,1))[0]);
 const boundary=await fresh.lineup(ch,staged.until-.1,3);
 assert.equal(boundary[1].start,boundary[0].end);assert.equal(boundary[1].m.id,'new-film');assert.equal(boundary[1].v0,staged.until);
 assert.equal(boundary[2].start,boundary[1].end);
 const after=(await fresh.lineup(ch,staged.until+30,1))[0];assert.equal(after.start,staged.until);
});
test('unchanged deployments retain the existing anchor rather than restarting the rotation',async()=>{
 const previous=base(),next=changed(previous);
 next.catalog.programming=await stageProgramming({previous,next,now});
 const identical=structuredClone(next);identical.catalog.generated='later';
 assert.deepEqual(await stageProgramming({previous:next,next:identical,now:now+86400}),next.catalog.programming);
});
test('another update during the protected window preserves both current and already-announced future programs',async()=>{
 const previous=base(),first=changed(previous,'first-new-film');
 first.catalog.programming=await stageProgramming({previous,next:first,now});
 const second=changed(first,'second-new-film'),later=now+3600;
 second.catalog.programming=await stageProgramming({previous:first,next:second,now:later});
 const a=siteCode(first),b=siteCode(second),ch=b.BUILT_IN.find(c=>c.no===30);
 for(const t of [later,later+7200])assert.deepEqual((await b.lineup(ch,t,1))[0],(await a.lineup(ch,t,1))[0]);
 const cutoff=second.catalog.programming.channels[30].until;
 assert.equal((await b.lineup(ch,cutoff,1))[0].m.id,'second-new-film');
});
test('an explicitly blocked upload is removed rather than protected for another two hours',async()=>{
 const previous=changed(base(),'removed-film');delete previous.catalog.programming;
 const next=changed(previous,'replacement-film');next.html=next.html.replace('const BLOCKED = new Set([','const BLOCKED = new Set(["removed-film",');
 next.catalog.programming=await stageProgramming({previous,next,now});
 const stage=next.catalog.programming.channels[30];assert.equal(stage.earlyRemoval,true);assert.equal(stage.until,now);assert.deepEqual(stage.items,[]);
 const site=siteCode(next),ch=site.BUILT_IN.find(c=>c.no===30);assert.equal((await site.lineup(ch,now,1))[0].m.id,'replacement-film');
});
test('the updated cycle introduces each new show before returning to the mixed rotation',async()=>{
 const previous=base();delete previous.catalog.programming;
 const next=structuredClone(previous),ch=siteCode(next).BUILT_IN.find(c=>c.no===30);
 const episode=(id,source)=>[id,id+'.mp4',5400,id,'1992','',source];
 next.catalog.pools[ch.q].push(episode('new-a-1','new-series-a'),episode('new-a-2','new-series-a'),episode('new-b-1','new-series-b'));
 next.catalog.programming=await stageProgramming({previous,next,now});
 const site=siteCode(next),cutoff=next.catalog.programming.channels[30].until;
 const slots=await site.lineup(ch,cutoff,2);assert.deepEqual(slots.map(p=>p.m.id),['new-a-1','new-b-1']);
});

function captionFixture(sub=''){
 const previous=changed(base(),'caption-film'),site=siteCode(previous),ch=site.BUILT_IN.find(c=>c.no===30),row=previous.catalog.pools[ch.q][0];
 row[5]=sub;row[6]='caption-source';
 const media=site.rowMedia(row),ad={...media,title:'Unchanged commercial',sub:'ad.srt'},bumper={...media,title:'Unchanged bumper',sub:'bumper.srt'};
 const slot={start:now,end:now+14420,v0:now,m:structuredClone(media),cuts:[[0,7200],[7200,14400]],timeline:{duration:14420,segments:[
  {kind:'program',media:structuredClone(media),start:0,end:7200,offset:0,index:0},
  {kind:'commercial',media:ad,start:7200,end:7210,offset:0,index:1},
  {kind:'custom-bumper',media:bumper,start:7210,end:7220,offset:0,index:2},
  {kind:'program',media:structuredClone(media),start:7220,end:14420,offset:7200,index:3}
 ]}};
 previous.catalog.programming={version:1,fingerprint:'older',created:now-100,notBefore:now+7200,channels:{30:{until:slot.end,items:[slot],leadIds:[]}}};
 return {previous,ch,slot};
}

test('protected programs gain and lose captions without changing any scheduling or break metadata',async()=>{
 for(const [before,after] of [['','local:caption-film.vtt'],['local:caption-film.vtt','']]){
  const {previous,ch,slot}=captionFixture(before),snapshot=structuredClone(previous),next=structuredClone(previous);
  next.catalog.pools[ch.q][0][5]=after;
  const staged=await stageProgramming({previous,next,now}),actual=staged.channels[30].items[0],expected=structuredClone(slot);
  expected.m.sub=after;for(const s of expected.timeline.segments)if(s.kind==='program')s.media.sub=after;
  assert.deepEqual(actual,expected,'only program caption links may change');
  assert.deepEqual(previous,snapshot,'published input remains untouched');
  assert.notEqual(actual,slot);assert.notEqual(actual.timeline,slot.timeline);
 }
});

test('caption refresh refuses mismatched sources, filenames and program durations',async()=>{
 for(const [field,value] of [[0,'different-id'],[1,'different.mp4'],[2,14399],[6,'different-source']]){
  const {previous,ch,slot}=captionFixture('old.srt'),next=structuredClone(previous);
  next.catalog.pools[ch.q][0][field]=value;next.catalog.pools[ch.q][0][5]='new.srt';
  const stage=await stageProgramming({previous,next,now});
  assert.deepEqual(stage.channels[30].items[0],slot,'identity field '+field+' must match exactly');
 }
});

test('matching fingerprints refresh legacy frozen captions while retaining the existing rotation anchor',async()=>{
 const {previous,ch,slot}=captionFixture('old.srt'),next=structuredClone(previous);
 next.catalog.pools[ch.q][0][5]='new.srt';previous.catalog.programming.fingerprint=fingerprint(next);
 const snapshot=structuredClone(previous),stage=await stageProgramming({previous,next,now:now+3600});
 assert.equal(stage.created,previous.catalog.programming.created);assert.equal(stage.notBefore,previous.catalog.programming.notBefore);
 assert.equal(stage.channels[30].until,previous.catalog.programming.channels[30].until);
 assert.equal(stage.channels[30].items[0].m.sub,'new.srt');assert.equal(slot.m.sub,'old.srt');assert.deepEqual(previous,snapshot);
 const deployed={...next,catalog:{...next.catalog,programming:stage}};
 assert.equal(await stageProgramming({previous:deployed,next:deployed,now:now+7200}),stage,'an already refreshed unchanged deployment reuses its anchor');
});

test('protected automatic captions keep their language and provenance without moving the program',async()=>{
 const {previous,ch,slot}=captionFixture(''),next=structuredClone(previous),metadata={kind:'auto-generated',language:'cs',jobId:'a'.repeat(64)};
 next.catalog.pools[ch.q][0][5]='local:auto-'+metadata.jobId+'.vtt';next.catalog.pools[ch.q][0][11]=metadata;
 const staged=await stageProgramming({previous,next,now}),actual=staged.channels[30].items[0];
 assert.deepEqual(actual.m.captionMetadata,metadata);assert.equal(actual.start,slot.start);assert.equal(actual.end,slot.end);
 for(const s of actual.timeline.segments.filter(s=>s.kind==='program'))assert.deepEqual(s.media.captionMetadata,metadata);
 assert.deepEqual(actual.timeline.segments.filter(s=>s.kind!=='program'),slot.timeline.segments.filter(s=>s.kind!=='program'));
});
