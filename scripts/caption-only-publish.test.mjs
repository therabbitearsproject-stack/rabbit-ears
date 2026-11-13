import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workflow=await readFile(new URL('../.github/workflows/catalog.yml',import.meta.url),'utf8');
test('caption-only publishing restores an already deployed artifact and bypasses every programming writer',()=>{
 assert.match(workflow,/actions: read/);
 assert.match(workflow,/grep -qv '\^captions\/'/);
 assert.match(workflow,/status:'success'/);
 assert.match(workflow,/actions\/download-artifact@v4/);
 assert.match(workflow,/tar -xf \.caption-previous\/artifact\.tar -C _site/);
 const steps=workflow.split(/\n      - /);
 for(const name of ['Build catalog.json','Build games.json','Add IMDb matches']){
  const step=steps.find(s=>s.includes('name: '+name));assert.match(step,/if: steps\.need\.outputs\.catalog == 'yes'/,name);
 }
 for(const name of ['Restore subtitles','Fetch subtitles','Save subtitles','Preserve the published next two hours','Commit catalog if changed','Assemble the site']){
  const step=steps.find(s=>s.includes('name: '+name));assert.match(step,/if: steps\.need\.outputs\.captions_only != 'yes'/,name);
 }
 const overlay=steps.find(s=>s.includes('name: Add standalone caption availability'));assert.match(overlay,/node scripts\/build-caption-index\.mjs _site/);assert.doesNotMatch(overlay,/stage-programming|build-catalog|build-games|build-tv-feed|git /);
});
