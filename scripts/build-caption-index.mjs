// Caption publication is independent of catalog/schedule generation.
// Read the deployed snapshot; write only the index and caption assets.
import {readFile,writeFile,lstat,mkdir,rename,readdir,unlink} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {applyReviewedCaptions} from './caption-library.mjs';
import {applyGeneratedCaptions,burnedCaptionSources,sha256,captionLanguage,reviewedProvidedCaptionRepair} from './caption-jobs.mjs';

const repository=fileURLToPath(new URL('..',import.meta.url));
const key=r=>JSON.stringify([r[6]||r[0],r[1],r[2]]);
const safeName=name=>typeof name==='string'&&/^[A-Za-z0-9._-]+\.vtt$/.test(name)&&!name.includes('..');
async function regular(path,maxBytes=32*1024*1024){const s=await lstat(path);if(s.isSymbolicLink()||!s.isFile()||s.size>maxBytes)throw Error('Unsafe caption publication input');return readFile(path);}
async function json(path,fallback,maxBytes){try{return JSON.parse((await regular(path,maxBytes)).toString('utf8'));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}}
async function directory(path){await mkdir(path,{recursive:true});const s=await lstat(path);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe caption publication output');}
async function atomic(path,bytes){try{const s=await lstat(path);if(s.isSymbolicLink()||!s.isFile())throw Error('Unsafe caption output file');}catch(e){if(e.code!=='ENOENT')throw e;}const temp=join(dirname(path),'.caption-'+randomUUID());await writeFile(temp,bytes,{flag:'wx'});await rename(temp,path);}

export async function buildCaptionIndex({repoRoot=repository,siteRoot,externalTranslations=false}={}){
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
 const providedCaptionHashes=new Map();
 for(const row of rows){
  if(!reviewedProvidedCaptionRepair(row))continue;
  const name=row[0].replace(/[^A-Za-z0-9._-]/g,'_')+'.vtt';
  try{providedCaptionHashes.set(key(row),sha256(await regular(join(siteRoot,'subs',name))));}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const load=async name=>{if(!safeName(name))throw Error('Unsafe local caption name');const bytes=await regular(join(repoRoot,'captions',name));const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw Error('Invalid caption UTF-8');return text;};
 await directory(join(siteRoot,'captions'));
 // Batches bound temporary transcript memory even after the whole library is captioned.
 for(let offset=0;offset<rows.length;offset+=128){
  const input=rows.slice(offset,offset+128);
  const available=await applyGeneratedCaptions(await applyReviewedCaptions(input,reviewed,load),generated,load,{reviewDocuments:reviews,providedCaptionHashes});
  for(const row of available){
   const identity={archiveId:row[6]||row[0],video:row[1],duration:row[2]},identityKey=key(row);
   if(burned.has(JSON.stringify([identity.archiveId,identity.video]))){records.set(identityKey,{...identity,burned:true});continue;}
   if(row[5]&&!row[5].startsWith('local:')){
    const name=row[0].replace(/[^A-Za-z0-9._-]/g,'_')+'.vtt';
    try{
     const bytes=await regular(join(siteRoot,'subs',name));
     if(bytes.toString('utf8').startsWith('WEBVTT')&&bytes.toString('utf8').includes(' --> ')&&(!records.has(identityKey)||records.get(identityKey).captionMetadata?.kind==='provided'))records.set(identityKey,{...identity,sub:row[5],sourcePath:'/subs/'+name,captionMetadata:{kind:'provided',language:row[11]?.language||'en'},sha256:sha256(bytes)});
    }catch(e){if(e.code!=='ENOENT')throw e;}
    continue;
   }
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
 const translations=await json(join(repoRoot,'captions/translation-manifest.json'),{schemaVersion:1,records:[]},256*1024*1024);
 const translated=[];
 for(const record of translations.records||[]){
  const source=records.get(JSON.stringify([record.archiveId,record.video,record.duration]));
  if(!source||source.burned||source.sha256!==record.sourceSha256||!['en','zh','hi','es','ar','fr','bn','pt','id','ur'].includes(record.language)||!/^translated-[a-f0-9]{64}\.vtt$/.test(record.file||''))continue;
  const bytes=await regular(join(repoRoot,'captions',record.file));
  if(sha256(bytes)!==record.sha256||!bytes.toString('utf8').startsWith('WEBVTT'))throw Error('Invalid translated caption asset');
  if(!externalTranslations)await atomic(join(siteRoot,'captions',record.file),bytes);
  translated.push(externalTranslations?{...record,deliveryUrl:'https://raw.githubusercontent.com/therabbitearsproject-stack/rabbit-ears/main/captions/'+record.file+'?v='+record.sha256}:record);
 }
 await atomic(join(siteRoot,'caption-translations.json'),JSON.stringify({schemaVersion:1,records:translated})+'\n');
 // Keep the complete legacy index for older apps; current clients download only
 // their selected language rather than every translated cue's metadata.
 await directory(join(siteRoot,'caption-translations'));
 for(const language of ['en','zh','hi','es','ar','fr','bn','pt','id','ur']){
  await atomic(join(siteRoot,'caption-translations',language+'.json'),JSON.stringify({schemaVersion:1,language,records:translated.filter(record=>record.language===language)})+'\n');
 }
 if(externalTranslations){
  // Caption-only builds restore the previous artifact. Remove its old VTTs too,
  // while every URL continues working through the already-verified edge route.
  for(const entry of await readdir(join(siteRoot,'captions'),{withFileTypes:true})){
   if(!/^translated-[a-f0-9]{64}\.vtt$/.test(entry.name))continue;
   if(!entry.isFile()||entry.isSymbolicLink())throw Error('Unsafe caption artifact cleanup');
   await unlink(join(siteRoot,'captions',entry.name));
  }
  // The restored artifact may reference a cached older caption client. Change
  // only its script cache key; every programming/catalog byte stays untouched.
  let page;try{page=await regular(join(siteRoot,'index.html'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(page){
   const client=await regular(join(siteRoot,'assets/captions.js')),text=page.toString('utf8');
   const pattern=/assets\/captions\.js\?v=[^"'<>\s]+/g;
   if([...text.matchAll(pattern)].length!==1)throw Error('Expected one caption client in deployed markup');
   await atomic(join(siteRoot,'index.html'),text.replace(pattern,'assets/captions.js?v='+sha256(client).slice(0,16)));
  }
 }
 return {records:index.records.length,assets:assets.size,burned:index.records.filter(r=>r.burned).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await buildCaptionIndex({siteRoot:process.argv[2],externalTranslations:process.argv.includes('--external-translations')})));}catch(e){console.error(e.message);process.exitCode=1;}}
