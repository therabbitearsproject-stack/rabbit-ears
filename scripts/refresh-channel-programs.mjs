// Expand selected collections and deliberately added shows into individual programs.
// No media is downloaded; the Archive remains the playback source.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {channelsFromIndex} from './site-pages.mjs';
import {collectionPrograms,keepProgram,policyFor} from './program-quality.mjs';
const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const {channels}=channelsFromIndex(html),catalog=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const compatibility=Function(await readFile(new URL('media-compatibility.js',root),'utf8')+';return MediaCompatibility')();
const cache=resolve(process.argv[2]||'.channel-metadata-cache');await mkdir(cache,{recursive:true});
const selected=new Map(),jobs=new Set();
let curated={channels:{}};try{curated=JSON.parse(await readFile(new URL('scripts/channel-expansion-sources.json',root),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const ch of channels){
  if(ch.library)continue;
  const rows=catalog.pools[ch.q]||[],p=policyFor(ch);
  const score=r=>/complete|collection|season|series|episodes|longplays/i.test(r[3])?10:0;
  const candidates=rows.filter(r=>keepProgram(ch,r)||r[2]<p.minSeconds).sort((a,b)=>score(b)-score(a));
  const existing=[...new Set(candidates.map(r=>r[6]||r[0]))].slice(0,[60,61,63,66,67].includes(ch.no)?7:3);
  const ids=[...new Set([...(curated.channels[ch.name]||[]).map(s=>s.archiveId),...existing])];
  selected.set(ch.name,ids);ids.forEach(id=>jobs.add(id));
}
const data=new Map(),queue=[...jobs];let cursor=0,failed=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<queue.length){
  const id=queue[cursor++],file=resolve(cache,encodeURIComponent(id)+'.json');
  try{data.set(id,JSON.parse(await readFile(file,'utf8')));continue;}catch{}
  for(let retry=0;retry<2;retry++)try{
    const r=await fetch('https://archive.org/metadata/'+encodeURIComponent(id),{headers:{'User-Agent':'RabbitEarsChannelQuality/1.0 (+https://rabbit-ears.stream)'},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!d.files?.length)throw Error('No media');
    data.set(id,d);await writeFile(file,JSON.stringify(d));break;
  }catch{if(retry===1)failed++;}
  if(cursor%20===0)console.log(`${cursor}/${queue.length} sources checked; ${failed} unavailable`);
}}));
let previous={channels:{}};try{previous=JSON.parse(await readFile(new URL('scripts/channel-programs.json',root),'utf8'));}catch{}
const result={generated:new Date().toISOString(),note:'Duration/filename-qualified programs from selected collections and deliberately added shows; not a frame-by-frame completeness or rights certification.',channels:{}};
for(const ch of channels){
  if(ch.library)continue;
  const sources=selected.get(ch.name)||[],rows=[];
  for(const id of sources){if(!data.has(id)){rows.push(...(previous.channels[ch.name]?.rows||[]).filter(r=>r[6]===id));continue;}
    const d=data.get(id);
    const sub=(_files,name)=>{const stem=name.replace(/(?:\.ia|_512kb)?\.mp4$/i,'');return d.files.find(f=>/\.(srt|vtt)$/i.test(f.name)&&f.name.replace(/(?:\.asr)?\.(srt|vtt)$/i,'')===stem)?.name||'';};
    rows.push(...collectionPrograms(ch,d,id,compatibility,sub));
  }
  result.channels[ch.name]={sources,rows};
  console.log(`${ch.no} ${ch.name}: ${result.channels[ch.name].rows.length} qualified collection programs`);
}
await writeFile(new URL('scripts/channel-programs.json',root),JSON.stringify(result));
console.log(`Checked ${queue.length} selected sources; ${failed} unavailable (previous qualified rows preserved).`);
