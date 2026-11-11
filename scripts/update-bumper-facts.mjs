// Import a complete researched set of short, sourced station stories.
// Usage: node scripts/update-bumper-facts.mjs <fact-array.json> [...]
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),file=new URL('scripts/channel-branding.json',root);
const branding=JSON.parse(await readFile(file,'utf8')),facts=(await Promise.all(process.argv.slice(2).map(async p=>JSON.parse(await readFile(p,'utf8'))))).flat();
const byNo=new Map(),copy=new Set();
for(const fact of facts){
 if(byNo.has(fact.no))throw Error('Duplicate channel '+fact.no);
 if(!fact.hook||!fact.fact||!fact.credit||!/^https:\/\//.test(fact.source))throw Error('Incomplete citation '+fact.no);
 if(fact.fact.split(/\s+/).length>38)throw Error('Story too long for a bumper: '+fact.no);
 if(copy.has(fact.fact))throw Error('Repeated story: '+fact.no);
 copy.add(fact.fact);byNo.set(fact.no,fact);
}
for(const ch of branding.channels){
 const f=byNo.get(ch.no);if(!f||f.name!==ch.name)throw Error('Missing or mismatched station '+ch.no+' '+ch.name);
 ch.fact={hook:f.hook,fact:f.fact,source:f.source,credit:f.credit};
}
branding.note='Original station IDs with licensed Kevin MacLeod recordings (CC BY 4.0). Unique channel-specific stories, researched against linked sources; fact citations are editorial references, not endorsements.';
await writeFile(file,JSON.stringify(branding,null,2)+'\n');
const lines=['# Behind the bumpers','', 'Each station has its own short story, with its source linked below. Copy is paraphrased for a short on-screen reading window.',''];
for(const ch of branding.channels)lines.push(`## ${ch.no} · ${ch.name}`,'',`**${ch.fact.hook}**`,'',ch.fact.fact,'',`Source: [${ch.fact.credit}](${ch.fact.source})`,'');
await writeFile(new URL('docs/bumper-facts.md',root),lines.join('\n'));
console.log('Updated '+branding.channels.length+' unique station stories and their source notes.');
