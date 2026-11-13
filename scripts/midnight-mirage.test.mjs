import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {midnightMirageRows} from './midnight-mirage-programming.mjs';
import {loadChannelBreakLibrary} from './channel-break-library.mjs';
import {channelAdPools} from './themed-ad-library.mjs';
import {siteCode} from './tv-feed.mjs';

const root=new URL('../',import.meta.url);
const commercialTiming=await readFile(new URL('commercial-timing.js',root),'utf8');
const timing=new Function(commercialTiming+';return CommercialTiming;')();
const spot=(id,year=1998,role='movie-tv-spot')=>({id,file:id+'.mp4',year,role,dur:30});
const policy={mix:'between-films',interval:15,target:120,maxAds:3,minTail:0};

test('Midnight Mirage retains every second of a full movie before its only ad pod',()=>{
 for(const year of [1927,1965,1985,2017]){
  const movie={id:'feature',dur:14400,year};
  const ads=[spot('first',1980),spot('last',1999)];
  const plan=timing.build(movie,policy,ads,[{id:'do-not-interrupt',dur:8}], 'same-slot');
  assert.deepEqual(plan,timing.build(movie,policy,ads,[],'same-slot'));
  assert.equal(plan.segments.filter(s=>s.kind==='program').length,1);
  assert.deepEqual(plan.segments[0],{kind:'program',media:movie,start:0,end:14400,offset:0,index:0});
  assert.equal(plan.segments[1].start,14400);
  assert.deepEqual(new Set(plan.segments.slice(1).map(s=>s.media.year)),new Set([1980,1999]),'film year must not narrow the fixed spot era');
  assert.ok(plan.segments.slice(1).every(s=>s.kind==='commercial'&&s.end-s.start===s.media.dur));
 }
});

test('the post-film pod rejects modern, undated, unrelated and long-form ads without another-library fallback',()=>{
 const rejected=[spot('old',1979),spot('new',2000),spot('missing',null),spot('fraction',1989.5),spot('product',1992,'recorded-advertiser-spot'),{...spot('trailer',1990),dur:150}];
 const movie={id:'feature',dur:7200,year:1990};
 const plan=timing.build(movie,policy,[...rejected,spot('actual-film-spot',1986)],[],'x');
 assert.deepEqual(plan.segments.slice(1).map(s=>s.media.id),['actual-film-spot']);
 assert.equal(timing.build(movie,policy,rejected,[],'x').duration,7200);
 assert.deepEqual(timing.library({commercials:[spot('global')],breakLibraries:{}},'midnight-mirage').commercials,[]);
 assert.deepEqual(channelAdPools([{name:'Midnight Mirage',no:42}],[spot('generic')])[42],[]);
});

test('only curated full-program rows survive film admission, not trailers or accidental mixed-in extras',()=>{
 const movie=['feature','full.mp4',6000,'A Cult Feature','1971','','archive-feature',640,480];
 const library={id:'midnight-mirage-v1',rows:[movie,movie,[...movie.slice(0,2),30,'A Cult Feature trailer','1971','','archive-feature'],['bad','bad.mp4',4000,'Behind the scenes','1971','','extra']]};
 assert.deepEqual(midnightMirageRows(library),[movie]);
 assert.throws(()=>midnightMirageRows({id:'midnight-mirage-v1',rows:[]}),/No approved full films/);
});

test('website and exported schedule keep the next full film after the complete post-film pod',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8'),mediaCompatibility=await readFile(new URL('media-compatibility.js',root),'utf8');
 const catalog={pools:{'reviewed:midnight-mirage-v1':[['cult-feature','full.mp4',14400,'A Cult Feature','1965','','source']]},
  channelAds:{42:[spot('never-use-general')]},channelBumpers:{42:[{id:'own-id',dur:8,local:true,file:'assets/own.mp4'}]},
  breakLibraries:{'midnight-mirage':{yearRange:[1980,1999],commercials:[spot('eighties',1981),spot('nineties',1999)],bumpers:[]}}};
 const S=siteCode({html,catalog,commercialTiming,mediaCompatibility}),ch=S.BUILT_IN.find(c=>c.no===42);
 assert.equal(ch.name,'Midnight Mirage');
 const slots=await S.lineup(ch,S.EPOCH,2),segments=slots[0].timeline.segments;
 assert.equal(segments[0].end,14400);assert.equal(segments[0].offset,0);
 assert.deepEqual(segments.map(s=>s.kind),['program','commercial','commercial','bumper']);
 assert.equal(slots[1].start,slots[0].end);assert.equal(slots[1].v0,slots[1].start);
 assert.equal(slots[0].end-slots[0].start,14468);
  delete catalog.breakLibraries['midnight-mirage'];
  const missing=siteCode({html,catalog,commercialTiming,mediaCompatibility});
  const noAds=await missing.lineup(missing.BUILT_IN.find(c=>c.no===42),missing.EPOCH,1);
  assert.deepEqual(noAds[0].timeline.segments.map(s=>s.kind),['program','bumper'],'missing or removed spots never replace the film or borrow other ads');
});

test('the break-library loader permits separate station IDs but enforces exact dated film spots and checksums',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'midnight-mirage-test-')),assetFolder=join(folder,'assets','midnight-mirage-breaks');
 try{
  await mkdir(assetFolder,{recursive:true});
  const bytes=Buffer.from('fixture only'),sha256=createHash('sha256').update(bytes).digest('hex');
  const commercials=Array.from({length:3},(_,i)=>({...spot('spot-'+i,1980+i),file:'assets/midnight-mirage-breaks/spot-'+i+'.mp4',local:true,sha256}));
  for(const media of commercials)await writeFile(join(folder,media.file),bytes);
  const manifest={id:'midnight-mirage',yearRange:[1980,1999],commercials,bumpers:[]},file=join(assetFolder,'manifest.json'),url=pathToFileURL(folder+'/');
  await writeFile(file,JSON.stringify(manifest));assert.equal((await loadChannelBreakLibrary('midnight-mirage',url)).commercials.length,3);
  commercials[0].year=1979;await writeFile(file,JSON.stringify(manifest));await assert.rejects(loadChannelBreakLibrary('midnight-mirage',url),/1980–1999/);
  commercials[0].year=1985;commercials[0].role='product-commercial';await writeFile(file,JSON.stringify(manifest));await assert.rejects(loadChannelBreakLibrary('midnight-mirage',url),/movie TV spots/);
  commercials[0].role='movie-tv-spot';commercials[0].sha256='changed';await writeFile(file,JSON.stringify(manifest));await assert.rejects(loadChannelBreakLibrary('midnight-mirage',url),/checksum/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
