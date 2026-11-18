import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adOnlyChanges} from './ad-only-publish.mjs';
import {refreshAdCatalog,adAdmission} from './refresh-ad-catalog.mjs';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
test('ad and caption UI changes may reuse programmes but search/admission changes cannot',()=>{
 assert.equal(adOnlyChanges(['scripts/themed-ads.json','commercial-timing.js','assets/captions.js'],html,html),true);
 assert.equal(adOnlyChanges(['scripts/program-quality.mjs'],html,html),false);
 assert.equal(adOnlyChanges(['scripts/porchlight-library.json'],html,html),false);
 assert.equal(adOnlyChanges(['index.html'],html,html.replace('q: "reviewed:midnight-mirage-v1"','q: "changed-search"')),false);
 assert.equal(adOnlyChanges(['index.html'],html,html.replace('const BLOCKED = new Set([','const BLOCKED = new Set(["new-removal",')),false);
 assert.equal(adOnlyChanges(['catalog.json'],html,html.replaceAll('\r\n','\n')),true);
});
test('ad-only refresh preserves exact programme, caption and clock data while replacing only ad libraries',()=>{
 const catalog={generated:'original',pools:{show:[['p','p.mp4',1800,'Show','1995','local:original.vtt']]},programming:{anchor:123,channels:{9:{until:999}}},channelAds:{9:[]},breakLibraries:{porchlight:{commercials:[],bumpers:[]}}};
 const original=structuredClone(catalog),spot={id:'consumer',archiveId:'consumer',file:'spot.mp4',title:'Kitchen food',dur:30,year:1995,topics:['kitchen'],role:'archival-commercial'};
 const next=refreshAdCatalog(catalog,{libraries:{porchlight:{commercials:[],bumpers:[]}},channels:[{no:9,name:'Porchlight'}],themedAds:[spot]});
 assert.deepEqual(catalog,original,'input snapshot is immutable');
 assert.deepEqual(next.pools,original.pools);assert.deepEqual(next.programming,original.programming);assert.equal(next.generated,'original');
 assert.equal(next.channelAds[9][0].id,'consumer');
});
test('viewer removals follow both the stable spot and parent source into recomputed pools',()=>{
 const reports={a:{id:'source',reason:'broken'},b:{id:'source',reason:'broken'},c:{id:'source',reason:'broken'}};
 const allowed=adAdmission(reports,(id,ch)=>id==='blocked'||id==='wrong'&&ch.name==='Porchlight');
 assert.equal(allowed({id:'spot',archiveId:'source'},{name:'Porchlight'}),false);
 assert.equal(allowed({id:'spot',source:{archiveId:'source'}},{name:'Porchlight'}),false);
 assert.equal(allowed({id:'blocked'},{name:'Any'}),false);
 assert.equal(allowed({id:'safe'},{name:'Porchlight'}),true);
});
