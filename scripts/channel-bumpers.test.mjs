import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {scoreFor,renderMusic} from './bumper-music.mjs';import branding from './channel-branding.json' with {type:'json'};import trekStories from './trek-bumper-stories.json' with {type:'json'};
test('six distinct IDs and stories per station, plus Trek extras, make the expanded station library',()=>{
 const stories=new Set();
 for(const ch of branding.channels){assert.equal(ch.tags.length,6,ch.name);assert.equal(new Set(ch.tags).size,6,ch.name);assert.equal(ch.facts.length,6,ch.name);assert.deepEqual(ch.facts[0],ch.fact);
  for(const f of ch.facts){assert.ok(f.hook);assert.ok(f.fact.split(/\s+/).length<=38);assert.ok(f.source.startsWith('https://'));assert.ok(f.credit);assert.ok(!stories.has(f.fact),'Repeated story on '+ch.name);stories.add(f.fact);}}
 assert.equal(trekStories.length,36);for(const f of trekStories){assert.ok(!stories.has(f.fact));stories.add(f.fact);}
 assert.equal(stories.size,498);assert.equal(77*6+stories.size,960);
});
test('all 960 videos are verified, have unique excerpts, and match their station copy',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/channel-bumpers/manifest.json',import.meta.url),'utf8'));
 const audio=new Set();assert.equal(branding.channels.length,77);
 let idCount=0,factCount=0;const filePaths=new Set();
 for(const ch of branding.channels){const entries=manifest.channels[ch.no];assert.equal(entries.length,ch.no===97?48:12,ch.name);assert.equal(entries.filter(m=>m.kind==='station-id').length,6,ch.name);
  assert.ok(new Set(entries.map(m=>m.music.isrc)).size>=3,'At least three distinct musical recordings for '+ch.name);
  const story=entries.find(m=>m.id===`ch${String(ch.no).padStart(2,'0')}-moment`);assert.equal(story?.kind,'fact',ch.name);assert.equal(story.title,ch.fact.fact,'Rendered story metadata must match the researched copy');assert.equal(story.source,ch.fact.source);
  for(const m of entries){assert.equal(m.channel,ch.no);assert.ok(m.dur===8||m.dur===12);assert.equal(m.music.style,ch.style);assert.ok(!audio.has(m.audioSha256),'repeated score');audio.add(m.audioSha256);
   assert.ok(!filePaths.has(m.file),'Duplicate media path');filePaths.add(m.file);if(m.kind==='station-id'){idCount++;assert.ok(ch.tags.includes(m.title));}else{factCount++;assert.ok([...ch.facts,...(ch.no===97?trekStories:[])].some(f=>f.fact===m.title&&f.source===m.source),'Stale fact metadata');}
   const bytes=await readFile(new URL('../'+m.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);
   assert.equal(m.music.license,'CC BY 4.0');assert.ok(m.music.source.startsWith('https://incompetech.com/'));
   if(m.kind==='fact')assert.ok(m.source?.startsWith('https://'));
  }
 }
 assert.equal(idCount,462);assert.equal(factCount,498);assert.equal(audio.size,960);assert.ok(new Set(branding.channels.map(c=>c.style)).size>=16);
});
test('music composition is deterministic and has distinct rhythm/timbre profiles',()=>{
 assert.deepEqual(scoreFor('jazz','same'),scoreFor('jazz','same'));assert.notDeepEqual(scoreFor('jazz','one'),scoreFor('jazz','two'));
 assert.equal(scoreFor('ambient','x').drums,'none');assert.equal(scoreFor('metal','x').voice,'distorted');assert.equal(scoreFor('chiptune','x').voice,'chip');
 const {wav}=renderMusic('piano','test',1,8000);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.subarray(44).some(x=>x!==0));
});
