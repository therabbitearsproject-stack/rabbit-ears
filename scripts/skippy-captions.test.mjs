import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {queueCaptions,importCompleted,main} from './skippy-captions.mjs';
import {sha256} from './caption-jobs.mjs';
const vtt='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA short line.\n';
async function setup(){
 const repo=await mkdtemp(join(tmpdir(),'rabbit-skippy-'));
 for(const part of ['captions','scripts','docs','completed'])await mkdir(join(repo,part));
 const html='const SAFE = ``;\nconst BUILT_IN = [\n{name:"Midnight Mirage",q:"query"}\n];\nconst BANDS = [[30,"Movies"]];\nconst LINEUP = {\n"Midnight Mirage":[42,"moon"]\n};\nconst BLOCKED = new Set([\n]);\n';
 const rows=['one','two','three'].map(id=>[id,id+'.mp4',120,'Film '+id,'1990','',id]);
 await writeFile(join(repo,'index.html'),html);await writeFile(join(repo,'catalog.json'),JSON.stringify({pools:{query:rows}}));
 await writeFile(join(repo,'captions','manifest.json'),JSON.stringify({episodes:{}}));
 await writeFile(join(repo,'scripts','midnight-mirage-library.json'),JSON.stringify({sources:rows.map(r=>({id:r[0],file:r[1],language:'eng'}))}));
 return {repo,output:join(repo,'queue.json'),completed:join(repo,'completed')};
}
async function complete(f,job,patch={}){
 const folder=join(f.completed,job.jobId);await mkdir(folder);
 const metadata={schemaVersion:1,project:'rabbit-ears',jobId:job.jobId,archiveId:job.archiveId,video:job.video,duration:job.duration,language:job.language,sourceUrl:job.sourceUrl,detectedLanguage:'en',vttSha256:sha256(vtt),engine:'whisper',model:'large-v3-turbo',...patch};
 await writeFile(join(folder,'completion.json'),JSON.stringify(metadata));await writeFile(join(folder,'captions.vtt'),vtt);
}
test('queue serialization removes verbose aliases and pilot changes only its exact priority',async()=>{
 const f=await setup();try{
  const result=await queueCaptions({repoRoot:f.repo,output:f.output});assert.equal(result.jobs,3);
  const before=JSON.parse(await readFile(f.output));assert.ok(before.jobs.every(j=>!('aliases'in j)));assert.ok(before.jobs.every(j=>j.language==='en'));
  const pilot=before.jobs[1].jobId;await queueCaptions({repoRoot:f.repo,output:f.output,pilotJobId:pilot});const after=JSON.parse(await readFile(f.output));assert.equal(after.jobs[0].jobId,pilot);assert.equal(after.jobs[0].priority,-100);
  for(const job of before.jobs)assert.equal(after.jobs.find(j=>j.jobId===job.jobId).priority,job.jobId===pilot?-100:job.priority);
  await assert.rejects(queueCaptions({repoRoot:f.repo,output:f.output,pilotJobId:'0'.repeat(64)}),/not in/);
 }finally{await rm(f.repo,{recursive:true,force:true});}
});
test('batch import isolates bad and protected completions, writes only auto assets/manifest, and repeats idempotently',async()=>{
 const f=await setup();try{
  await queueCaptions({repoRoot:f.repo,output:f.output});const q=JSON.parse(await readFile(f.output));
  await complete(f,q.jobs[0]);await complete(f,q.jobs[1],{sourceUrl:'https://evil.test/video.mp4'});await complete(f,q.jobs[2]);
  const c=JSON.parse(await readFile(join(f.repo,'catalog.json')));c.pools.query.find(r=>r[0]===q.jobs[2].archiveId)[5]='English.srt';await writeFile(join(f.repo,'catalog.json'),JSON.stringify(c));
  const catalogBefore=await readFile(join(f.repo,'catalog.json'),'utf8'),reviewedBefore=await readFile(join(f.repo,'captions','manifest.json'),'utf8');
  const result=await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:f.completed});assert.equal(result.imported,1);assert.equal(result.rejected,1);assert.equal(result.preserved,1);
  assert.equal(await readFile(join(f.repo,'catalog.json'),'utf8'),catalogBefore);assert.equal(await readFile(join(f.repo,'captions','manifest.json'),'utf8'),reviewedBefore);
  assert.deepEqual((await readdir(join(f.repo,'captions'))).sort(),['auto-'+q.jobs[0].jobId+'.vtt','generated-manifest.json','manifest.json'].sort());
  const saved=await readFile(join(f.repo,'captions','generated-manifest.json'),'utf8');const again=await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:f.completed});assert.equal(again.duplicate,1);assert.equal(again.imported,0);assert.equal(await readFile(join(f.repo,'captions','generated-manifest.json'),'utf8'),saved);
 }finally{await rm(f.repo,{recursive:true,force:true});}
});
test('junction or symlink completion folders are rejected without following them',async t=>{
 const f=await setup();try{
  await queueCaptions({repoRoot:f.repo,output:f.output});const q=JSON.parse(await readFile(f.output));const outside=join(f.repo,'outside');await mkdir(outside);await writeFile(join(outside,'completion.json'),'{}');
  try{await symlink(outside,join(f.completed,q.jobs[0].jobId),process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Host disallows test symlinks');return;}throw error;}
  const result=await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:f.completed});assert.equal(result.rejected,1);assert.match(result.results[0].reason,/symbolic-link/);assert.equal(result.imported,0);
 }finally{await rm(f.repo,{recursive:true,force:true});}
});
test('queue uses local burned-caption evidence and import rejects path metadata or changed byte hashes',async()=>{
 const f=await setup();try{
  await writeFile(join(f.repo,'docs','midnight-mirage-review.json'),JSON.stringify({films:[{archiveId:'one',video:'one.mp4',burnedEnglish:'yes'}]}));
  assert.equal((await queueCaptions({repoRoot:f.repo,output:f.output})).jobs,2);const q=JSON.parse(await readFile(f.output));await complete(f,q.jobs[0],{video:'../../other.mp4'});await complete(f,q.jobs[1],{vttSha256:'0'.repeat(64)});
  const result=await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:f.completed});assert.equal(result.rejected,2);assert.equal(result.imported,0);
 }finally{await rm(f.repo,{recursive:true,force:true});}
});
test('unsupported commands/options fail before any service or repository operations',async()=>{
 await assert.rejects(main(['deploy']),/Usage/);await assert.rejects(main(['queue','--token','secret']),/Invalid command option/);await assert.rejects(main(['import','--queue']),/Invalid command option/);
});
test('CLI English target mode upgrades only intact owned foreign assets and retains the native file after import',async()=>{
 const f=await setup();try{
  const libraryPath=join(f.repo,'scripts','midnight-mirage-library.json'),library=JSON.parse(await readFile(libraryPath));library.sources.find(s=>s.id==='one').language=null;await writeFile(libraryPath,JSON.stringify(library));
  await queueCaptions({repoRoot:f.repo,output:f.output});const legacy=JSON.parse(await readFile(f.output)),native=legacy.jobs.find(j=>j.archiveId==='one');assert.equal(native.language,'auto');
  await complete(f,native,{detectedLanguage:'cs'});assert.equal((await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:f.completed})).imported,1);
  const nativeName='auto-'+native.jobId+'.vtt',nativePath=join(f.repo,'captions',nativeName),savedNative=await readFile(nativePath);
  const c=JSON.parse(await readFile(join(f.repo,'catalog.json')));c.pools.query.find(r=>r[0]==='one')[5]='local:'+nativeName;await writeFile(join(f.repo,'catalog.json'),JSON.stringify(c));
  library.sources.find(s=>s.id==='one').language='cze';await writeFile(libraryPath,JSON.stringify(library));
  assert.equal((await queueCaptions({repoRoot:f.repo,output:f.output})).jobs,2,'default remains legacy');
  assert.equal((await queueCaptions({repoRoot:f.repo,output:f.output,targetLanguage:'en'})).jobs,3);let target=JSON.parse(await readFile(f.output)).jobs.find(j=>j.archiveId==='one');assert.equal(target.supersedesJobId,native.jobId);assert.equal(target.language,'auto');
  await writeFile(nativePath,'changed');assert.equal((await queueCaptions({repoRoot:f.repo,output:f.output,targetLanguage:'en'})).jobs,2,'manifest label without matching bytes cannot authorize upgrade');
  await writeFile(nativePath,savedNative);await queueCaptions({repoRoot:f.repo,output:f.output,targetLanguage:'en'});target=JSON.parse(await readFile(f.output)).jobs.find(j=>j.archiveId==='one');
  const english=join(f.repo,'english-completed');await mkdir(english);await complete({...f,completed:english},target,{targetLanguage:'en',supersedesJobId:native.jobId,detectedLanguage:'cs',sourceLanguage:'cs',sourceLanguages:['cs'],outputLanguage:'en',translated:true,task:'translate',translationModel:'large-v3'});
  const imported=await importCompleted({repoRoot:f.repo,queueFile:f.output,completedDir:english});assert.equal(imported.imported,1);assert.deepEqual(await readFile(nativePath),savedNative);
  const manifest=JSON.parse(await readFile(join(f.repo,'captions','generated-manifest.json')));assert.equal(Object.keys(manifest.jobs).length,2);assert.equal(manifest.jobs[target.jobId].outputLanguage,'en');
  assert.equal((await queueCaptions({repoRoot:f.repo,output:f.output,targetLanguage:'en'})).jobs,2,'verified English target is not queued again');
  await assert.rejects(queueCaptions({repoRoot:f.repo,output:f.output,targetLanguage:'fr'}),/target/);
 }finally{await rm(f.repo,{recursive:true,force:true});}
});
