import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {keepProgram,strengthenPool,collectionPrograms} from './program-quality.mjs';
import {channelAdPools,topicsFor} from './themed-ad-library.mjs';
import {siteCode} from './tv-feed.mjs';
const row=(title,seconds=2700)=>['id','file.mp4',seconds,title,'1992',''];
test('full-program gates reject previews but preserve real short-form channels',()=>{
 assert.equal(keepProgram({name:'Drive-In'},row('Movie preview',60)),false);
 assert.equal(keepProgram({name:'Drive-In'},row('Feature film',5400)),true);
 assert.equal(keepProgram({name:'Saturday Toons'},row('Popeye',360)),true);
 assert.equal(keepProgram({name:'Ad Break'},row('Cereal commercial',30)),true);
 assert.equal(keepProgram({name:'Hoops'},row('NBA finals halftime highlights',2700)),false);
 assert.equal(keepProgram({name:'Hoops'},row('NBA Finals full game',9000)),true);
 assert.equal(keepProgram({name:'Pit Lane'},row('Wrestling grand finale',9000)),false);
 assert.equal(keepProgram({name:'Slow TV'},row('Fish Tank Paradox election podcast',7200)),false);
});
test('collections expand full episodes instead of retaining a twelve-second preview',()=>{
 const compatibility={choose:(_files,f)=>f,knownCompatible:()=>true,version:'test'};
 const rows=collectionPrograms({name:'Rerun Alley'},{metadata:{title:'A Sitcom Complete Series',date:'1992'},files:[
  {name:'preview.mp4',length:12}, {name:'S01E01.mp4',length:1500,width:640,height:480},
  {name:'S01E01.ia.mp4',length:1500,width:640,height:480},{name:'S01E02.mp4',length:1501,width:640,height:480},
 ]},'collection',compatibility);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r[6]==='collection'&&r[2]>=1500));assert.notEqual(rows[0][0],rows[1][0]);
 assert.equal(strengthenPool({name:'Rerun Alley'},rows,rows).length,2);
});
test('ads stay on subject, with quiet channels deliberately free of inserted advertising',()=>{
 assert.ok(!topicsFor({id:'toyota',title:'Toyota commercial'}).includes('toys'));
 assert.ok(!topicsFor({id:'catfood',title:'Whiskas cat food commercial'}).includes('kitchen'));
 const ads=[{id:'nintendo',title:'Nintendo commercial',year:1992},{id:'blender',title:'Kitchen blender advert',year:1992}].map(m=>({...m,topics:topicsFor(m)}));
 const pools=channelAdPools([{no:89,name:'Arcade'},{no:86,name:'TV Dinner'},{no:88,name:'Slow TV'}],ads);
 assert.deepEqual(pools[89].map(m=>m.id),['nintendo']);assert.deepEqual(pools[86].map(m=>m.id),['blender']);assert.deepEqual(pools[88],[]);
});
test('a four-hour built-in program completes before matching ads and a station ID',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const catalog={pools:{},channelBumpers:{30:[{id:'own-id',dur:8,file:'assets/id.mp4',local:true}]},channelAds:{30:[{id:'good',dur:30,title:'Home ad',year:1993,file:'good.mp4'},{id:'wrong-era',dur:30,title:'Old ad',year:1970,file:'old.mp4'}]}};
 const args={html,catalog,commercialTiming:await readFile(new URL('../commercial-timing.js',import.meta.url),'utf8'),mediaCompatibility:await readFile(new URL('../media-compatibility.js',import.meta.url),'utf8')};
 const initial=siteCode(args),q=initial.BUILT_IN.find(c=>c.no===30).q;catalog.pools[q]=[['four-hours','full.mp4',14400,'Full movie','1992','']];
 const S=siteCode(args),ch=S.BUILT_IN.find(c=>c.no===30),slots=await S.lineup(ch,S.EPOCH,2),segments=slots[0].timeline.segments;
 assert.equal(segments[0].end,14400);assert.equal(segments[0].offset,0);assert.equal(segments[0].media.dur,14400);
 assert.equal(segments[1].media.id,'good');assert.equal(segments[1].start,14400);assert.equal(segments[2].media.id,'own-id');
 assert.equal(slots[1].start,slots[0].end);assert.equal(slots[1].v0,slots[1].start);
});
