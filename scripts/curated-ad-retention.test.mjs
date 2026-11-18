import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewedAd,retainReviewedAds} from './curated-ad-retention.mjs';
import {readFile} from 'node:fs/promises';
const ad = () => ({id:'reviewed',archiveId:'reviewed',file:'Spot.ia.mp4',title:'1962 consumer advertisement',
  dur:30,year:1962,role:'archival-commercial',curated:true,topics:['kitchen'],
  source:'https://archive.org/details/reviewed',provenance:{metadataUrl:'https://archive.org/metadata/reviewed',
    archiveMd5:'a'.repeat(32),rangeStatus:206,checkedAt:'2026-11-18T12:00:00Z'}});

test('verified early television spots survive a later limited modern discovery search',()=>{
  const kept=ad(),found={id:'new-search-result',year:1994};
  assert.equal(reviewedAd(kept),true);
  assert.deepEqual(retainReviewedAds([found],[kept]),[found,kept]);
});

test('unreviewed, incomplete, undated or unverified entries cannot become curated carryovers',()=>{
  for(const patch of [{curated:false},{year:0},{year:2026},{dur:160},{topics:['unknown']},
    {source:'https://untrusted.invalid/spot'},{provenance:{archiveMd5:'a'.repeat(32)}}]){
    const rejected={...ad(),...patch};assert.equal(reviewedAd(rejected),false);
    assert.deepEqual(retainReviewedAds([],[rejected]),[]);
  }
});

test('reviewed metadata and hand-assigned topics take precedence over rediscovered aliases',()=>{
  const kept=ad(),alias={...kept,curated:false,topics:['home'],file:'Older-copy.mp4'};
  assert.deepEqual(retainReviewedAds([alias],[kept]),[kept]);
});

test('the published curated inventory has distinct verified files and survives an unrelated search',async()=>{
  const library=JSON.parse(await readFile(new URL('./themed-ads.json',import.meta.url),'utf8'));
  const curated=library.commercials.filter(m=>m.curated);
  assert.ok(curated.length>0);
  assert.ok(curated.every(reviewedAd),'unverified source evidence cannot be retained as reviewed');
  assert.equal(new Set(curated.map(m=>m.id)).size,curated.length);
  assert.equal(new Set(curated.map(m=>m.provenance.archiveMd5)).size,curated.length,'identical Archive files cannot inflate the inventory');
  assert.ok(curated.some(m=>m.year<1970),'classic television gets genuinely earlier source material');
  const retained=retainReviewedAds([{id:'unrelated-discovery',year:1990}],library.commercials);
  assert.ok(curated.every(m=>retained.some(x=>x.id===m.id&&x.file===m.file)));
});
