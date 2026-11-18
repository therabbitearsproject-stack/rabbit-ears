import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adThemes,adFitsChannel,channelAdPools,mergeAds,topicsFor} from './themed-ad-library.mjs';
import {siteCode} from './tv-feed.mjs';
import {stageProgramming} from './stage-programming.mjs';

const root=new URL('../',import.meta.url);
const [html,commercialTiming,mediaCompatibility,channelsText,adsText]=await Promise.all(
 ['index.html','commercial-timing.js','media-compatibility.js','community/channels.json','scripts/themed-ads.json'].map(p=>readFile(new URL(p,root),'utf8')));
const channels=JSON.parse(channelsText),ads=JSON.parse(adsText).commercials;
const timing=new Function(commercialTiming+';return CommercialTiming;')();
const reference=siteCode({html,commercialTiming,mediaCompatibility,catalog:{pools:{}}});
const ad=(id,year=1995,dur=30)=>({id,archiveId:'source-'+id,file:'spot.mp4',title:id,year,dur,role:'archival-commercial'});
function fixture(no,programmeCount=4,year=1995){
 const channel=reference.BUILT_IN.find(ch=>ch.no===no),start=html.indexOf('const BUILT_IN = ['),end=html.indexOf('\n];',start)+3;
 const isolated=html.slice(0,start)+'const BUILT_IN = '+JSON.stringify([channel])+';'+html.slice(end);
 const rows=Array.from({length:programmeCount},(_,i)=>['programme-'+i,'programme-'+i+'.mp4',1800,'Programme '+i,String(year),'']);
 return {html:isolated,commercialTiming,mediaCompatibility,catalog:{pools:{[channel.q]:rows},channelAds:{[no]:[]},channelBumpers:{},breakLibraries:{}}};
}
const commercials=slot=>(slot.timeline?.segments||[]).filter(s=>s.kind==='commercial').map(s=>s.media);

test('every general channel has a topic pool while the eight no-extra-ad formats remain isolated',()=>{
 const pools=channelAdPools(channels,mergeAds({},ads));
 const excluded=['Ad Break','AMV Hour','Slow TV','Silent Screen','Home Movies','Ephemera','Duck & Cover','Order Now'];
 const general=reference.BUILT_IN.filter(ch=>!ch.breaks&&!excluded.includes(ch.name));
 assert.equal(general.length,66);
 for(const ch of general)assert.ok(pools[ch.no].length>0,ch.name+' needs its own matching subject pool');
 for(const name of excluded){const ch=channels.find(x=>x.name===name);assert.deepEqual(adThemes(ch),[]);assert.deepEqual(pools[ch.no],[]);}
 assert.deepEqual(pools[42],[],'Midnight Mirage cannot receive consumer-product advertisements');
});

test('curated topics survive merging without mistaking consoles, pet food or alcohol for music/kitchen/kids ads',()=>{
 const [fab]=mergeAds({},[{...ad('fab',1955),title:'Fab detergent',topics:['home']}]);
 assert.ok(fab.topics.includes('home'));
 assert.ok(!topicsFor({id:'console',title:'Sony PlayStation television commercial'}).includes('music'));
 assert.ok(!topicsFor({id:'pet',title:'Whiskas cat food'}).includes('kitchen'));
 assert.equal(adFitsChannel({name:'Toon Toys'},{...ad('unsafe'),title:'Beer promotion',topics:['toys']}),false);
 assert.deepEqual(mergeAds({},[ad('too-old',1930),ad('too-new',2009)]),[]);
});

test('music channels match the actual artist genre or neutral audio gear',()=>{
 const artist=(title,musicGenres)=>({...ad(title),title,topics:['music'],musicGenres});
 const metal=artist('Rammstein album',['metal','rock']),pop=artist('ABBA greatest hits',['pop']),jazz=artist('Porgy and Bess LP',['jazz']);
 assert.equal(adFitsChannel({name:'Jazz Club'},metal),false);
 assert.equal(adFitsChannel({name:'Jazz Club'},jazz),true);
 assert.equal(adFitsChannel({name:'Headbangers'},pop),false);
 assert.equal(adFitsChannel({name:'Headbangers'},metal),true);
 assert.equal(adFitsChannel({name:'Soul Train'},artist('Linkin Park album',['rock'])),false);
 assert.equal(adFitsChannel({name:'Headbangers'},artist('Panasonic headphones',[])),true);
});

test('different Archive files sharing a basename stay distinct, but aliases never duplicate an ad',()=>{
 const a=ad('a'),b=ad('b'),alias={...a,id:'alias'};
 assert.equal(timing.pack([a,b,alias],60,'same-name',{unique:true,maxSpots:3}).length,2);
 const pick=timing.rotation([a,b,alias],'same-name');
 assert.equal(pick([a,b,alias],60,3).length,2);
});

test('small programme pools expose the full eligible ad deck across repeated complete programme passes',async()=>{
 const snapshot=fixture(30),pool=Array.from({length:20},(_,i)=>ad('ad-'+i));
 snapshot.catalog.channelAds[30]=pool;
 const site=siteCode(snapshot),ch=site.BUILT_IN[0],slots=await site.lineup(ch,site.EPOCH,20);
 assert.equal(new Set(slots.flatMap(commercials).map(m=>m.id)).size,20,'a small programme cycle must not permanently hide most advertisements');
 assert.deepEqual(slots.slice(0,4).map(s=>s.m.id),slots.slice(4,8).map(s=>s.m.id),'programme order stays unchanged while ads rotate');
 const pods=slots.map(commercials);
 for(let i=2;i<pods.length;i++){
  const recent=new Set(pods.slice(i-2,i).flat().map(m=>m.id));
  assert.ok(pods[i].every(m=>!recent.has(m.id)),'avoid the previous two pods when the pool permits');
 }
 for(const slot of slots){
  assert.equal(slot.timeline.segments.filter(s=>s.kind==='program').reduce((n,s)=>n+s.end-s.start,0),1800);
  assert.ok(commercials(slot).every(m=>m.dur===30));
 }
});

test('general ad pods respect a five-year programme window, including genuinely early television',async()=>{
 for(const year of [1954,1995]){
  const snapshot=fixture(3,1,year);
  snapshot.catalog.channelAds[3]=[ad('matched',year),ad('wrong-era',year+15)];
  const site=siteCode(snapshot),slots=await site.lineup(site.BUILT_IN[0],site.EPOCH,3);
  assert.ok(slots.every(s=>commercials(s).length>0));
  assert.ok(slots.flatMap(commercials).every(m=>m.id==='matched'));
 }
});

test('Porchlight combines consumer spots with its own library but keeps its two-year era and full acts',async()=>{
 const snapshot=fixture(9,1,2003),own=ad('own',2001),extra=ad('new-consumer',2004),wrong=ad('wrong-era',2006);
 snapshot.catalog.breakLibraries.porchlight={yearRange:[1988,2007],commercials:[own],bumpers:[]};
 snapshot.catalog.channelAds[9]=[own,extra,wrong];
 const site=siteCode(snapshot),slots=await site.lineup(site.BUILT_IN[0],site.EPOCH,3),used=slots.flatMap(commercials);
 assert.ok(used.some(m=>m.id==='new-consumer'));
 assert.ok(used.every(m=>Math.abs(m.year-2003)<=2));
 for(const slot of slots){
  const programme=slot.timeline.segments.filter(s=>s.kind==='program');
  assert.equal(programme.reduce((n,s)=>n+s.end-s.start,0),1800);
  assert.deepEqual(programme.map(s=>s.offset),[0,900]);
 }
});

test('a new themed Porchlight pool stages the next two hours instead of silently replacing current breaks',async()=>{
 const initial=fixture(9,1,2003),own=ad('old-own',2003);
 initial.catalog.breakLibraries.porchlight={yearRange:[1988,2007],commercials:[own],bumpers:[]};
 const now=reference.EPOCH+100,previous=structuredClone(initial);
 previous.catalog.programming=await stageProgramming({previous:initial,next:previous,now,leadSeconds:7200});
 const next=structuredClone(previous);next.catalog.channelAds[9]=[ad('new-consumer',2003)];
 next.catalog.programming=await stageProgramming({previous,next,now:now+60,leadSeconds:7200});
 const before=siteCode(previous),after=siteCode(next),ch=after.BUILT_IN[0],staged=next.catalog.programming.channels[9];
 assert.notEqual(staged.signature,previous.catalog.programming.channels[9].signature);
 assert.ok(staged.until>=now+60+7200);
 for(const t of [now+60,now+3600,now+7200])assert.deepEqual((await after.lineup(ch,t,1))[0],(await before.lineup(ch,t,1))[0]);
 const future=await after.lineup(ch,staged.until,3);
 assert.ok(future.flatMap(commercials).some(m=>m.id==='new-consumer'));
});

test('Midnight Mirage rotates all film spots while preserving a single uninterrupted movie segment',async()=>{
 const snapshot=fixture(42,1,1973),pool=Array.from({length:20},(_,i)=>({...ad('movie-'+i,1980+i),role:'movie-tv-spot'}));
 snapshot.catalog.breakLibraries['midnight-mirage']={yearRange:[1980,1999],commercials:pool,bumpers:[]};
 snapshot.catalog.channelAds[42]=[ad('never-generic',1990)];
 const site=siteCode(snapshot),slots=await site.lineup(site.BUILT_IN[0],site.EPOCH,10);
 assert.equal(new Set(slots.flatMap(commercials).map(m=>m.id)).size,20);
 for(const slot of slots){
  const segments=slot.timeline.segments;
  assert.deepEqual(segments[0],{kind:'program',media:slot.m,start:0,end:1800,offset:0,index:0});
  assert.equal(segments.filter(s=>s.kind==='program').length,1);
  assert.ok(commercials(slot).every(m=>m.role==='movie-tv-spot'));
 }
});
