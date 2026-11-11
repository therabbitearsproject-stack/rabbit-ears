import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),branding=JSON.parse(await readFile(new URL('scripts/channel-branding.json',root),'utf8'));
let extra=[];try{extra=JSON.parse(await readFile(new URL('scripts/trek-bumper-stories.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const lines=['# Behind the bumpers','','The library contains six station IDs and six researched stories for each of 76 channels, plus 36 additional Subspace stories: 948 videos, including 492 distinct fact/story cards. Copy is paraphrased for a short reading window. Sources are linked with each story.',''];
for(const ch of branding.channels){lines.push(`## ${ch.no} · ${ch.name}`,'');for(const[i,f]of(ch.facts||[ch.fact]).entries())lines.push(`### ${i+1}. ${f.hook}`,'',f.fact,'',`Source: [${f.credit}](${f.source})`,'');}
lines.push('## Additional Subspace stories','');for(const[i,f]of extra.entries())lines.push(`### ${i+1}. ${f.hook}`,'',f.fact,'',`Source: [${f.credit}](${f.source})`,'');
await writeFile(new URL('docs/bumper-facts.md',root),lines.join('\n'));
console.log('Wrote all station-story source notes.');
