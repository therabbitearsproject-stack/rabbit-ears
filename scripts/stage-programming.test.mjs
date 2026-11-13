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

test('caption links never rewrite the protected programming snapshot',async()=>{
 for(const [before,after] of [['','local:caption-film.vtt'],['local:caption-film.vtt','']]){
  const {previous,ch,slot}=captionFixture(before),snapshot=structuredClone(previous),next=structuredClone(previous);
  next.catalog.pools[ch.q][0][5]=after;
  const staged=await stageProgramming({previous,next,now}),actual=staged.channels[30].items[0],expected=structuredClone(slot);
  assert.deepEqual(actual,expected,'standalone caption index supplies updates; programming bytes retain the published snapshot');
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

test('matching semantic fingerprints leave frozen captions and rotation anchors untouched',async()=>{
 const {previous,ch,slot}=captionFixture('old.srt'),next=structuredClone(previous);
 next.catalog.pools[ch.q][0][5]='new.srt';previous.catalog.programming.fingerprint=fingerprint(next);
 const snapshot=structuredClone(previous),stage=await stageProgramming({previous,next,now:now+3600});
 assert.equal(stage.created,previous.catalog.programming.created);assert.equal(stage.notBefore,previous.catalog.programming.notBefore);
 assert.equal(stage.channels[30].until,previous.catalog.programming.channels[30].until);
 assert.equal(stage.channels[30].items[0].m.sub,'old.srt');assert.equal(slot.m.sub,'old.srt');assert.deepEqual(previous,snapshot);
 const deployed={...next,catalog:{...next.catalog,programming:stage}};
 assert.equal(await stageProgramming({previous:deployed,next:deployed,now:now+7200}),stage,'an already refreshed unchanged deployment reuses its anchor');
});

test('automatic caption metadata belongs to the standalone caption index, not frozen programming',async()=>{
 const {previous,ch,slot}=captionFixture(''),next=structuredClone(previous),metadata={kind:'auto-generated',language:'cs',jobId:'a'.repeat(64)};
 next.catalog.pools[ch.q][0][5]='local:auto-'+metadata.jobId+'.vtt';next.catalog.pools[ch.q][0][11]=metadata;
 const staged=await stageProgramming({previous,next,now}),actual=staged.channels[30].items[0];
 assert.equal(actual.m.captionMetadata,undefined);assert.equal(actual.start,slot.start);assert.equal(actual.end,slot.end);
 for(const s of actual.timeline.segments.filter(s=>s.kind==='program'))assert.equal(s.media.captionMetadata,undefined);
 assert.deepEqual(actual.timeline.segments.filter(s=>s.kind!=='program'),slot.timeline.segments.filter(s=>s.kind!=='program'));
});

function mini(){
 const value=base();
 const definitions=[{name:'Midnight Mirage',q:'mini-42'},{name:'Subspace 97',q:'mini-97'}];
 value.html=value.html.replace(/const BUILT_IN = \[[\s\S]*?\n\];/,'const BUILT_IN = [\n'+definitions.map(c=>JSON.stringify(c)).join(',\n')+'\n];');
 const make=(id,title,source=id,file=id+'.mp4')=>[id,file,600,title,'1990','',source,640,480];
 value.catalog={pools:{'mini-42':[make('el-topo','El Topo'),make('black-moon','Black Moon'),make('fantastic','Fantastic Planet')],
  'mini-97':[make('trek-one','Deep Space Nine · S03E12 · Past Tense-Part 2'),make('trek-two','Deep Space Nine · S05E26 · Call to Arms'),make('trek-three','Enterprise · S03E15 · Harbinger')]}};
 return value;
}
test('ten successive caption-only changes preserve every cycle anchor and the entire programming object',async()=>{
 let previous=mini();const start=siteCode(previous).EPOCH+100;
 previous.catalog.programming=await stageProgramming({previous,next:previous,now:start});
 const original=JSON.stringify(previous.catalog.programming);
 for(let i=0;i<10;i++){
  const next=structuredClone(previous);next.catalog.pools['mini-42'][0][5]='local:auto-'+i+'.vtt';next.catalog.pools['mini-42'][0][11]={kind:'auto-generated',language:'en',jobId:String(i)};
  next.catalog=JSON.parse(JSON.stringify(next.catalog)); // Sparse cuts slot becomes null in real JSON.
  assert.equal(fingerprint(previous),fingerprint(next));
  next.catalog.programming=await stageProgramming({previous,next,now:start+i*600});assert.equal(JSON.stringify(next.catalog.programming),original);
  const before=siteCode(previous),after=siteCode(next),clock=slots=>slots.map(p=>({id:p.m.id,file:p.m.file,start:p.start,end:p.end,v0:p.v0,timeline:p.timeline?.segments.map(s=>({kind:s.kind,id:s.media.id,start:s.start,end:s.end,offset:s.offset}))}));
  for(const ch of after.BUILT_IN)assert.deepEqual(clock(await after.lineup(ch,start+i*600,12)),clock(await before.lineup(before.BUILT_IN.find(c=>c.no===ch.no),start+i*600,12)));
  previous=next;
 }
});
test('another channel content update cannot reset an unchanged channel rotation',async()=>{
 const previous=mini(),start=siteCode(previous).EPOCH+100;previous.catalog.programming=await stageProgramming({previous,next:previous,now:start});
 const next=structuredClone(previous);next.catalog.pools['mini-42'].push(['new-film','new.mp4',1200,'A New Cult Film','1971','','new-source']);
 const actual=await stageProgramming({previous,next,now:start+300});assert.deepEqual(actual.channels[97],previous.catalog.programming.channels[97]);
});
test('legacy frozen repeats are repaired after the current full program rather than freezing the duplicates again',async()=>{
 const previous=mini(),S=siteCode(previous),start=S.EPOCH+100;
 const channels={};for(const ch of S.BUILT_IN){const media=S.rowMedia(previous.catalog.pools[ch.q][0]);channels[ch.no]={until:start+1700,leadIds:[],items:Array.from({length:3},(_,i)=>({m:media,start:start-100+i*600,end:start+500+i*600,v0:start-100+i*600}))};}
 previous.catalog.programming={version:1,fingerprint:'legacy-corrupt',created:start-10,notBefore:start+7200,channels};const next=structuredClone(previous);
 next.catalog.programming=await stageProgramming({previous,next,now:start});const fresh=siteCode(next);
 for(const ch of fresh.BUILT_IN){const stage=next.catalog.programming.channels[ch.no];assert.equal(stage.repeatRepair,true);assert.equal(stage.until,start+500);assert.deepEqual(stage.items,[previous.catalog.programming.channels[ch.no].items[0]]);
  const slots=await fresh.lineup(ch,start,12);for(let i=1;i<slots.length;i++){assert.equal(slots[i].start,slots[i-1].end);assert.equal(fresh.sameProgram(slots[i-1].m,slots[i].m),false);}}
});
test('alternate encodings/episode aliases dedupe without collapsing long episode titles or legitimate one-program pools',async()=>{
 const input=mini(),ch=siteCode(input).BUILT_IN.find(c=>c.no===97),long='A Complete Television Collection With A Very Long Shared Description Which Must Not Be Truncated Before Identifying Each Program · ';
 input.catalog.pools[ch.q]=[['one','episode.mp4',600,'Deep Space Nine · S03E12 · Past Tense-Part 2','1990','','collection'],['alias','episode_512kb.mp4',600,'Deep Space Nine · S03E12 · Another Encoding','1990','','collection'],
 ['another-upload','copy.mp4',600,'Star Trek Deep Space Nine · S03E12 · Alternate upload','2026','','other'],['episode-a','a.mp4',600,long+'Episode 1','1990','','one'],['episode-b','b.mp4',600,long+'Episode 2','1990','','two']];
 const S=siteCode(input),slots=await S.lineup(ch,S.EPOCH,9);assert.equal(new Set(slots.map(p=>p.m.id)).size,3);for(let i=1;i<slots.length;i++)assert.equal(S.sameProgram(slots[i-1].m,slots[i].m),false);
 const single=mini();single.catalog.pools['mini-97']=single.catalog.pools['mini-97'].slice(0,1);const one=siteCode(single),items=await one.lineup(one.BUILT_IN.find(c=>c.no===97),one.EPOCH,3);assert.equal(items.length,3);assert.ok(items.every(p=>p.m.id==='trek-one'));
});
test('late incident deployment removes only a corrupt replay begun after the request and keeps the original program whole',async()=>{
 const previous=mini(),S=siteCode(previous),baseline=Date.parse('2026-11-13T18:03:44Z')/1000,channels={};
 for(const ch of S.BUILT_IN){const m=S.rowMedia(previous.catalog.pools[ch.q][0]);channels[ch.no]={until:baseline+1700,leadIds:[],items:Array.from({length:3},(_,i)=>({m,start:baseline-100+i*600,end:baseline+500+i*600,v0:baseline-100+i*600}))};}
 previous.catalog.programming={version:1,fingerprint:'incident',created:baseline-1000,notBefore:baseline+7200,channels};
 const next=structuredClone(previous);next.catalog.programming=await stageProgramming({previous,next,now:baseline+700});const site=siteCode(next);
 for(const ch of site.BUILT_IN){const p=next.catalog.programming.channels[ch.no];assert.equal(p.until,baseline+500);assert.equal(p.incidentBaseline,baseline);assert.deepEqual(p.items,[previous.catalog.programming.channels[ch.no].items[0]]);assert.equal(site.sameProgram((await site.lineup(ch,baseline+700,1))[0].m,p.items[0].m),false);}
 const later=structuredClone(next);later.catalog.programming=await stageProgramming({previous:next,next:later,now:baseline+800});assert.deepEqual(later.catalog.programming,next.catalog.programming,'migration baseline is never applied again after v2');
});
