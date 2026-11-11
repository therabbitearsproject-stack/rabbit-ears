import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stageProgramming} from './stage-programming.mjs';
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
