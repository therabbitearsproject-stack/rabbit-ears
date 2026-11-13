// Local metadata/finished-file bridge only. No SSH, downloads, Git or catalog writes.
import {lstat,open,mkdir,readdir,rename,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {channelsFromIndex} from './site-pages.mjs';
import {generateCaptionJobs,importCaptionCompletion,sha256} from './caption-jobs.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const hex=/^[a-f0-9]{64}$/;
async function regularFile(path,maxBytes,{optional=false}={}){
 let before;
 try{before=await lstat(path);}catch(error){if(optional&&error.code==='ENOENT')return null;throw error;}
 if(before.isSymbolicLink()||!before.isFile())throw Error('Refusing nonregular or symbolic-link file: '+path);
 if(before.size>maxBytes)throw Error('File exceeds allowed size: '+path);
 const handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 try{
  const after=await handle.stat();
  if(!after.isFile()||after.size>maxBytes||after.ino!==before.ino||after.dev!==before.dev)throw Error('File changed while opening: '+path);
  const bytes=await handle.readFile();if(bytes.length>maxBytes)throw Error('File exceeds allowed size: '+path);
  return bytes;
 }finally{await handle.close();}
}
async function directory(path){const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Refusing non-directory or symbolic-link folder: '+path);}
async function json(path,{optional=false,maxBytes=64*1024*1024}={}){const bytes=await regularFile(path,maxBytes,{optional});return bytes===null?null:JSON.parse(bytes.toString('utf8'));}
async function atomicWrite(path,bytes){
 await directory(dirname(path));await regularFile(path,64*1024*1024,{optional:true});
 const temporary=join(dirname(path),'.skippy-'+randomUUID()+'.tmp');
 const handle=await open(temporary,'wx',0o600);
 try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
 try{await rename(temporary,path);}catch(error){await unlink(temporary).catch(()=>{});throw error;}
}
async function reviews(repo){
 const docs=join(repo,'docs'),nested=join(docs,'midnight-mirage'),paths=[];
 for(const [folder,filter]of [[docs,n=>/^midnight-mirage.*\.json$/.test(n)],[nested,n=>/\.json$/.test(n)]]){
  try{
   await directory(folder);
   for(const entry of await readdir(folder,{withFileTypes:true}))if(filter(entry.name)){
    if(entry.isSymbolicLink()||!entry.isFile())throw Error('Invalid local subtitle review document: '+entry.name);
    paths.push(join(folder,entry.name));
   }
  }catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return Promise.all(paths.sort().map(path=>json(path)));
}
async function inputs(repo){
 await directory(repo);
 const [catalog,html,reviewedManifest,reviewDocuments,library]=await Promise.all([
  json(join(repo,'catalog.json')),
  regularFile(join(repo,'index.html'),8*1024*1024),
  json(join(repo,'captions','manifest.json'),{optional:true}),reviews(repo),
  json(join(repo,'scripts','midnight-mirage-library.json'),{optional:true})
 ]);
 const {channels}=channelsFromIndex(html.toString('utf8'));
 return {catalog,channels,reviewedManifest:reviewedManifest||{episodes:{}},reviewDocuments,sourceRecords:library?.sources||[]};
}
export async function queueCaptions({repoRoot=repository,output,pilotJobId}={}){
 if(!output)throw Error('queue requires --output FILE');
 const data=await inputs(resolve(repoRoot)),queue=generateCaptionJobs(data);
 if(pilotJobId){
  if(!hex.test(pilotJobId))throw Error('Invalid pilot job ID');
  const pilot=queue.jobs.find(job=>job.jobId===pilotJobId);if(!pilot)throw Error('Pilot job is not in the missing-caption queue');pilot.priority=-100;
  queue.jobs.sort((a,b)=>a.priority-b.priority||a.jobId.localeCompare(b.jobId));
 }
 // Aliases contain repeated full Archive queries and are never service inputs.
 queue.jobs=queue.jobs.map(({aliases,...job})=>job);
 const bytes=JSON.stringify(queue)+'\n',path=resolve(output);
 if(Buffer.byteLength(bytes)>64*1024*1024)throw Error('Serialized caption queue exceeds service limit');
 await mkdir(dirname(path),{recursive:true});await atomicWrite(path,bytes);
 return {command:'queue',project:'rabbit-ears',output:path,jobs:queue.jobs.length,bytes:Buffer.byteLength(bytes),summary:queue.summary,pilotJobId:pilotJobId||null};
}

export async function importCompleted({repoRoot=repository,queueFile,completedDir}={}){
 if(!queueFile||!completedDir)throw Error('import requires --queue FILE and --completed DIR');
 const repo=resolve(repoRoot),completed=resolve(completedDir),captions=join(repo,'captions');
 await directory(completed);await directory(captions);
 const [data,queue,oldManifest]=await Promise.all([inputs(repo),json(resolve(queueFile)),json(join(captions,'generated-manifest.json'),{optional:true})]);
 let manifest=oldManifest||{version:1,project:'rabbit-ears',jobs:{}};
 if(manifest.project!=='rabbit-ears'||manifest.version!==1||!manifest.jobs||Array.isArray(manifest.jobs))throw Error('Invalid generated-caption manifest');
 if(queue.project!=='rabbit-ears'||queue.schemaVersion!==1||!Array.isArray(queue.jobs)||queue.jobs.length>50000)throw Error('Invalid caption queue');
 const results=[];
 for(const entry of (await readdir(completed,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const jobId=entry.name;
  try{
   if(!hex.test(jobId)||entry.isSymbolicLink()||!entry.isDirectory())throw Error('Invalid or symbolic-link completion folder');
   const folder=join(completed,jobId);await directory(folder);
   const metadata=await json(join(folder,'completion.json'),{maxBytes:1024*1024});
   if(metadata.jobId!==jobId)throw Error('Completion folder does not match job ID');
   await directory(folder);
   const bytes=await regularFile(join(folder,'captions.vtt'),16*1024*1024);
   // Hash the actual UTF-8 bytes, then ensure decoding cannot hide malformed bytes.
   const vtt=bytes.toString('utf8');if(sha256(bytes)!==metadata.vttSha256||!Buffer.from(vtt,'utf8').equals(bytes))throw Error('Completion VTT byte checksum or UTF-8 mismatch');
   const accepted=importCaptionCompletion({...data,queue,generatedManifest:manifest,completion:{...metadata,vtt}});
   const path=join(captions,accepted.asset.name),existing=await regularFile(path,16*1024*1024,{optional:true});
   const changed=!existing||sha256(existing)!==accepted.asset.sha256;
   if(changed)await atomicWrite(path,accepted.asset.text);
   if(!accepted.duplicate)await atomicWrite(join(captions,'generated-manifest.json'),JSON.stringify(accepted.manifest,null,2)+'\n');
   manifest=accepted.manifest;
   results.push({jobId,status:accepted.duplicate?'duplicate':'imported',asset:accepted.asset.name,restoredAsset:accepted.duplicate&&changed,aliases:accepted.links.length});
  }catch(error){
   const reason=String(error.message||error),preserved=/protected|cannot be overwritten/.test(reason);
   results.push({jobId,status:preserved?'preserved':'rejected',reason});
  }
 }
 const counts={imported:0,duplicate:0,preserved:0,rejected:0};for(const result of results)counts[result.status]++;
 return {command:'import',project:'rabbit-ears',...counts,results};
}

export async function main(args=process.argv.slice(2)){
 const [command,...rest]=args,options={};
 const allowed=command==='queue'?new Set(['--output','--pilot-job-id']):command==='import'?new Set(['--queue','--completed']):null;
 if(!allowed)throw Error('Usage: skippy-captions.mjs queue --output FILE [--pilot-job-id ID] | import --queue FILE --completed DIR');
 for(let i=0;i<rest.length;i+=2){if(!allowed.has(rest[i])||!rest[i+1]||rest[i+1].startsWith('--')||options[rest[i]]!==undefined)throw Error('Invalid command option: '+rest[i]);options[rest[i]]=rest[i+1];}
 return command==='queue'?queueCaptions({output:options['--output'],pilotJobId:options['--pilot-job-id']}):importCompleted({queueFile:options['--queue'],completedDir:options['--completed']});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(await main())+'\n');}catch(error){process.stderr.write(JSON.stringify({error:String(error.message||error)})+'\n');process.exitCode=1;}
}
