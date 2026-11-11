// Import researched, metadata-verified additions. Pass discovery JSON paths explicitly.
import {readFile,writeFile} from 'node:fs/promises';
import {channelsFromIndex} from './site-pages.mjs';
import {strengthenPool} from './program-quality.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
if(!process.argv.slice(2).length)throw Error('Pass one or more researched discovery JSON files.');
const catalog=await read('catalog.json'),library=await read('scripts/channel-programs.json'),{channels}=channelsFromIndex(await readFile(new URL('index.html',root),'utf8'));
let curated={generated:new Date().toISOString(),note:'Deliberately selected additional shows and full events, with metadata and sampled public media checks. Archive availability is not rights clearance or a frame-by-frame completeness review.',channels:{}};
try{curated=await read('scripts/channel-expansion-sources.json');}catch(error){if(error.code!=='ENOENT')throw error;}
let added=0;
for(const path of process.argv.slice(2)){
 const report=JSON.parse(await readFile(path,'utf8'));
 for(const [name,found] of Object.entries(report.channels)){
  const ch=channels.find(c=>c.name===name);if(!ch||ch.library)throw Error('Unknown or reviewed channel cannot be imported: '+name);
  const prior=catalog.pools[ch.q]||[],rows=strengthenPool(ch,[],found.rows||[]);
  const next=strengthenPool(ch,prior,rows);added+=next.length-prior.length;catalog.pools[ch.q]=next;
  const old=library.channels[name]||{sources:[],rows:[]};
  library.channels[name]={sources:[...new Set([...old.sources,...found.sources])],rows:strengthenPool(ch,old.rows,rows)};
  const discoveries=report.discoveries.filter(d=>d.name===name);
  const accepted=new Set(rows.map(r=>r[6]||r[0]));
  const byId=new Map((curated.channels[name]||[]).map(d=>[d.archiveId,d]));
  for(const d of discoveries)if(accepted.has(d.archiveId))byId.set(d.archiveId,{...d,count:rows.filter(r=>(r[6]||r[0])===d.archiveId).length});
  curated.channels[name]=[...byId.values()];
 }
}
library.generated=curated.generated=new Date().toISOString();
await Promise.all([writeFile(new URL('catalog.json',root),JSON.stringify(catalog)),writeFile(new URL('scripts/channel-programs.json',root),JSON.stringify(library)),writeFile(new URL('scripts/channel-expansion-sources.json',root),JSON.stringify(curated,null,2)+'\n')]);
console.log(`Added ${added} playable channel/program entries from researched new sources.`);
