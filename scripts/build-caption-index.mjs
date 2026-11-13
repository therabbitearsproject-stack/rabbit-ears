// Caption publication is independent of catalog/schedule generation.
// Read the deployed snapshot; write only the index and caption assets.
import {readFile,writeFile,lstat,mkdir,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {applyReviewedCaptions} from './caption-library.mjs';
import {applyGeneratedCaptions,burnedCaptionSources,sha256,captionLanguage} from './caption-jobs.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const key=r=>JSON.stringify([r[6]||r[0],r[1],r[2]]);
const safeName=name=>typeof name==='string'&&/^[A-Za-z0-9._-]+\.vtt$/.test(name)&&!name.includes('..');
async function regular(path){const s=await lstat(path);if(s.isSymbolicLink()||!s.isFile()||s.size>32*1024*1024)throw Error('Unsafe caption publication input');return readFile(path);}
async function json(path,fallback){try{return JSON.parse((await regular(path)).toString('utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}}
async function directory(path){await mkdir(path,{recursive:true});const s=await lstat(path);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe caption publication output');}
async function atomic(path,bytes){try{const s=await lstat(path);if(s.isSymbolicLink()||!s.isFile())throw Error('Unsafe caption output file');}catch(e){if(e.code!=='ENOENT')throw e;}const temp=join(dirname(path),'.caption-'+randomUUID());await writeFile(temp,bytes,{flag:'wx'});await rename(temp,path);}

export async function buildCaptionIndex({repoRoot=repository,siteRoot}={}){
 if(!siteRoot)throw Error('A published-site directory is required');
 repoRoot=resolve(repoRoot);siteRoot=resolve(siteRoot);
 const [catalog,reviewed,generated,reviewA,reviewB]=await Promise.all([
  json(join(siteRoot,'catalog.json')),
  json(join(repoRoot,'captions/manifest.json'),{episodes:{}}),
  json(join(repoRoot,'captions/generated-manifest.json'),{version:1,project:'rabbit-ears',jobs:{}}),
  json(join(repoRoot,'docs/midnight-mirage-subtitles-review.json'),{}),
  json(join(repoRoot,'docs/midnight-mirage/additional-subtitle-review.json'),{})
 ]);
 const reviews=[reviewA,reviewB],burned=burnedCaptionSources(reviews),records=new Map(),assets=new Set();
 const rows=Object.values(catalog.pools||{}).flat().filter(r=>Array.isArray(r)&&typeof r[0]==='string'&&typeof r[1]==='string'&&Number.isFinite(r[2])&&r[2]>0);
 const load=async name=>{if(!safeName(name))throw Error('Unsafe local caption name');const bytes=await regular(join(repoRoot,'captions',name));const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw Error('Invalid caption UTF-8');return text;};
 await directory(join(siteRoot,'captions'));
 // Batches bound temporary transcript memory even after the whole library is captioned.
 for(let offset=0;offset<rows.length;offset+=128){
  const input=rows.slice(offset,offset+128);
  const available=await applyGeneratedCaptions(await applyReviewedCaptions(input,reviewed,load),generated,load,{reviewDocuments:reviews});
  for(const row of available){
   const identity={archiveId:row[6]||row[0],video:row[1],duration:row[2]},identityKey=key(row);
   if(burned.has(JSON.stringify([identity.archiveId,identity.video]))){records.set(identityKey,{...identity,burned:true});continue;}
   if(!row[5]?.startsWith('local:'))continue;
   const name=row[5].slice(6);if(!safeName(name))continue;
   const bytes=await regular(join(repoRoot,'captions',name));
   const metadata=row[11]?.kind==='auto-generated'?row[11]:{kind:'reviewed',language:captionLanguage(reviewed.episodes?.[row[0]]?.outputLanguage||reviewed.episodes?.[row[0]]?.captionLanguage||'en')};
   const record={...identity,sub:row[5],captionMetadata:metadata,sha256:sha256(bytes)};
   const prior=records.get(identityKey);
   if(prior?.burned||prior?.captionMetadata?.kind==='reviewed'&&metadata.kind!=='reviewed')continue;
   records.set(identityKey,record);
   if(!assets.has(name)){await atomic(join(siteRoot,'captions',name),bytes);assets.add(name);}
  }
 }
 const index={schemaVersion:1,records:[...records.values()].sort((a,b)=>JSON.stringify([a.archiveId,a.video,a.duration]).localeCompare(JSON.stringify([b.archiveId,b.video,b.duration])))};
 await atomic(join(siteRoot,'caption-index.json'),JSON.stringify(index)+'\n');
 return {records:index.records.length,assets:assets.size,burned:index.records.filter(r=>r.burned).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await buildCaptionIndex({siteRoot:process.argv[2]})));}catch(e){console.error(e.message);process.exitCode=1;}}
