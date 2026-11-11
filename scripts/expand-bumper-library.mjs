// Merge five researched new stories per station and thirty extra Trek stories.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),file=new URL('scripts/channel-branding.json',root),branding=JSON.parse(await readFile(file,'utf8'));
const rows=(await Promise.all(process.argv.slice(2).map(async p=>JSON.parse(await readFile(p,'utf8'))))).flat();
const extras=rows.filter(r=>r.extra),regular=rows.filter(r=>!r.extra),clean=r=>({hook:r.hook,fact:r.fact,source:r.source,credit:r.credit});
const seen=new Set(),key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
function validate(f){if(!f.hook||!f.fact||!f.credit||!f.source?.startsWith('https://'))throw Error('Incomplete story '+f.hook);if(f.fact.split(/\s+/).length>38)throw Error('Story too long '+f.hook);if(seen.has(key(f.fact)))throw Error('Repeated story '+f.hook);seen.add(key(f.fact));}
for(const ch of branding.channels){
 const added=regular.filter(r=>r.no===ch.no);if(added.length!==5||added.some(r=>r.name!==ch.name))throw Error('Need exactly five matching additions: '+ch.name);
 if(ch.tags?.length!==6||new Set(ch.tags).size!==6)throw Error('Need six distinct station IDs: '+ch.name);
 ch.facts=[ch.fact,...added.map(clean)];ch.facts.forEach(validate);
}
if(extras.length!==30)throw Error('Need thirty additional Trek stories.');
const original=JSON.parse(await readFile(new URL('assets/trek-bumpers/facts.json',root),'utf8')).map(f=>({...f,credit:f.source.includes('nasa.gov')?'NASA':'StarTrek.com'}));
const trek=[...original,...extras.map((f,i)=>({id:'extra-'+String(i+7).padStart(2,'0'),...clean(f)}))];trek.forEach(validate);
if(seen.size!==492)throw Error('Expected 492 distinct stories.');
branding.note='Six station IDs and six distinct researched stories per channel, with thirty-six additional Trek stories. Licensed Kevin MacLeod music (CC BY 4.0); factual sources are editorial references, not endorsements.';
await Promise.all([writeFile(file,JSON.stringify(branding,null,2)+'\n'),writeFile(new URL('scripts/trek-bumper-stories.json',root),JSON.stringify(trek,null,2)+'\n')]);
console.log('Expanded copy: 456 station IDs and 492 unique sourced stories (948 total).');
