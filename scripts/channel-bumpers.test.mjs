import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {scoreFor,renderMusic} from './bumper-music.mjs';import branding from './channel-branding.json' with {type:'json'};
test('all 76 stations have two verified branded bumpers, with no reused audio recording',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/channel-bumpers/manifest.json',import.meta.url),'utf8'));
 const audio=new Set();assert.equal(branding.channels.length,76);
 for(const ch of branding.channels){const entries=manifest.channels[ch.no];assert.ok(entries.length>=2,ch.name);
  for(const m of entries){assert.equal(m.channel,ch.no);assert.ok(m.dur===8||m.dur===12);assert.equal(m.music.style,ch.style);assert.ok(!audio.has(m.audioSha256),'repeated score');audio.add(m.audioSha256);
   const bytes=await readFile(new URL('../'+m.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);
   assert.equal(m.music.license,'CC BY 4.0');assert.ok(m.music.source.startsWith('https://incompetech.com/'));
   if(m.kind==='fact')assert.ok(m.source?.startsWith('https://'));
  }
 }
 assert.ok(audio.size>=152);assert.ok(new Set(branding.channels.map(c=>c.style)).size>=16);
});
test('music composition is deterministic and has distinct rhythm/timbre profiles',()=>{
 assert.deepEqual(scoreFor('jazz','same'),scoreFor('jazz','same'));assert.notDeepEqual(scoreFor('jazz','one'),scoreFor('jazz','two'));
 assert.equal(scoreFor('ambient','x').drums,'none');assert.equal(scoreFor('metal','x').voice,'distorted');assert.equal(scoreFor('chiptune','x').voice,'chip');
 const {wav}=renderMusic('piano','test',1,8000);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.ok(wav.subarray(44).some(x=>x!==0));
});
