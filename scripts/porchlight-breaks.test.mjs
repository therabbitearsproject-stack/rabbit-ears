import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {loadChannelBreakLibrary} from "./channel-break-library.mjs";
const timing=new Function(await readFile(new URL("../commercial-timing.js",import.meta.url),"utf8")+";return CommercialTiming")();
const policy={mix:"era",eraWindow:2,interval:600,target:180,minTail:120};

test("Porchlight assets are verified, era-matched and show bumpers cannot announce another series",async()=>{
 const own=await loadChannelBreakLibrary("porchlight");
 assert.equal(own.commercials.length,7);assert.equal(own.bumpers.length,4);
 const catalog=JSON.parse(await readFile(new URL("../catalog.json",import.meta.url))),library=timing.library(catalog,"porchlight");
 for(const row of catalog.pools['reviewed:porchlight-v1']){
  const program={id:row[0],title:row[3],dur:row[2],year:row[4]};
  const timeline=timing.build(program,policy,library.commercials,library.bumpers,'slot-'+program.id);
  assert.ok(timeline.segments.some(s=>s.kind==='commercial'),program.title+' needs era commercials');
  for(const s of timeline.segments){
   if(s.kind==='commercial'){assert.ok(Math.abs(Number(s.media.year)-Number(program.year))<=2);assert.ok(Math.abs(s.end-s.start-s.media.dur)<.00001);}
   if(s.kind==='bumper'&&s.media.series)assert.ok(program.title.startsWith(s.media.series+' · '));
  }
 }
 assert.equal(timing.library({commercials:[["modern","x.mp4",30,"modern",2007]]}).commercials.length,0,'Subspace vintage cutoff remains unchanged');
});

test("added breaks preserve every approved Gilmore act and never play the tape gaps or Angel",async()=>{
 const library=JSON.parse(await readFile(new URL("porchlight-library.json",import.meta.url),"utf8")),episode=library.episodes[0],duration=episode.cuts.reduce((n,[a,b])=>n+b-a,0),media={id:episode.id,title:episode.title,dur:duration,year:2001,cuts:episode.cuts};
 const plan=timing.edit(timing.build(media,policy,[{id:'ad',dur:30,year:2001}],[],"reviewed"),media);
 assert.equal(episode.cuts.length,6,'final act after the last commercial break is retained');
 const segments=plan.segments.filter(s=>s.kind==='program');
 assert.ok(Math.abs(segments.reduce((n,s)=>n+s.end-s.start,0)-duration)<.00001);
 for(const s of segments)assert.ok(episode.cuts.some(([a,b])=>s.offset>=a-.00001&&s.offset+s.end-s.start<=b+.00001));
 assert.ok(Math.abs(segments.at(-1).offset+segments.at(-1).end-segments.at(-1).start-episode.cuts.at(-1)[1])<.00001);
 assert.deepEqual(plan.segments.map(s=>s.index),plan.segments.map((_,i)=>i));
 for(let i=1;i<plan.segments.length;i++)assert.ok(Math.abs(plan.segments[i].start-plan.segments[i-1].end)<.00001);
});
