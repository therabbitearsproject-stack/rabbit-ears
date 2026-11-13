import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildCaptionIndex} from './build-caption-index.mjs';
import {captionJobIdentity,archiveCaptionSource,sha256} from './caption-jobs.mjs';
const native='WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nPůvodní česká věta.\n';
const english='WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nA translated English sentence.\n';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'caption-index-')),repo=join(root,'repo'),site=join(root,'site');
 for(const path of [join(repo,'captions'),join(repo,'docs'),join(site,'tv')])await mkdir(path,{recursive:true});
 const base={archiveId:'foreign-film',video:'movie.mp4',duration:120,language:'cs'},oldId=captionJobIdentity(base),newId=captionJobIdentity({...base,targetLanguage:'en'});
 const entry=(id,text,extra={})=>({...base,jobId:id,identitySha256:id,status:'auto-generated',sourceUrl:archiveCaptionSource(base.archiveId,base.video),file:'auto-'+id+'.vtt',sha256:sha256(text),detectedLanguage:'cs',...extra});
 const manifest={version:1,project:'rabbit-ears',jobs:{[oldId]:entry(oldId,native),[newId]:entry(newId,english,{targetLanguage:'en',supersedesJobId:oldId,outputLanguage:'en',sourceLanguage:'cs',sourceLanguages:['cs'],translated:true,task:'translate',translationModel:'large-v3'})}};
 for(const [id,text]of [[oldId,native],[newId,english]])await writeFile(join(repo,'captions','auto-'+id+'.vtt'),text);
 await writeFile(join(repo,'captions/generated-manifest.json'),JSON.stringify(manifest));
 await writeFile(join(repo,'captions/reviewed.vtt'),english);
 await writeFile(join(repo,'captions/manifest.json'),JSON.stringify({episodes:{reviewed:{archiveId:'reviewed-film',video:'reviewed.mp4',duration:120,status:'passed',sha256:sha256(english),checks:[{fraction:.2,pass:true},{fraction:.8,pass:true}]}}}));
 const catalog={generated:'unchanged',pools:{q:[['foreign','movie.mp4',120,'Film','', 'local:auto-'+oldId+'.vtt','foreign-film'],['reviewed','reviewed.mp4',120,'Reviewed','','','reviewed-film']]},programming:{epoch:123,slots:[{id:'currently-playing',start:100,end:500}]}};
 const protectedFiles=['catalog.json','games.json','tv/index.json'];
 for(const file of protectedFiles)await writeFile(join(site,file),JSON.stringify(file==='catalog.json'?catalog:{stable:file,epoch:456},null,3)+'\n');
 // An unpublished working-tree catalog must never determine the deployed index.
 await writeFile(join(repo,'catalog.json'),JSON.stringify({pools:{new:[['unpublished','other.mp4',300,'','','','unpublished-item']]}}));
 return {root,repo,site,oldId,newId,protectedFiles};
}
test('caption publication reads the deployed snapshot and leaves every programming/TV byte unchanged',async()=>{
 const f=await fixture();try{
  const before=await Promise.all(f.protectedFiles.map(file=>readFile(join(f.site,file))));
  const result=await buildCaptionIndex({repoRoot:f.repo,siteRoot:f.site});assert.equal(result.records,2);
  const index=JSON.parse(await readFile(join(f.site,'caption-index.json'),'utf8'));
  const foreign=index.records.find(r=>r.archiveId==='foreign-film');assert.equal(foreign.sub,'local:auto-'+f.newId+'.vtt');assert.equal(foreign.captionMetadata.language,'en');assert.equal(foreign.captionMetadata.translated,true);
  assert.equal(index.records.find(r=>r.archiveId==='reviewed-film').captionMetadata.kind,'reviewed');
  assert.equal(await readFile(join(f.site,'captions','auto-'+f.newId+'.vtt'),'utf8'),english);
  for(let i=0;i<f.protectedFiles.length;i++)assert.deepEqual(await readFile(join(f.site,f.protectedFiles[i])),before[i]);
  assert.equal(index.records.some(r=>r.archiveId==='unpublished-item'),false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('corrupt English assets fall back to intact native text without an English label',async()=>{
 const f=await fixture();try{
  await writeFile(join(f.repo,'captions','auto-'+f.newId+'.vtt'),'corrupt');await buildCaptionIndex({repoRoot:f.repo,siteRoot:f.site});
  const index=JSON.parse(await readFile(join(f.site,'caption-index.json'),'utf8')),record=index.records.find(r=>r.archiveId==='foreign-film');
  assert.equal(record.sub,'local:auto-'+f.oldId+'.vtt');assert.equal(record.captionMetadata.language,'cs');assert.equal(record.captionMetadata.translated,false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('affirmative burned-English evidence blocks generated overlays',async()=>{
 const f=await fixture();try{
  await writeFile(join(f.repo,'docs/midnight-mirage-subtitles-review.json'),JSON.stringify({films:[{archiveId:'foreign-film',video:'movie.mp4',burnedEnglish:true}]}));
  await buildCaptionIndex({repoRoot:f.repo,siteRoot:f.site});const index=JSON.parse(await readFile(join(f.site,'caption-index.json'),'utf8'));
  assert.deepEqual(index.records.find(r=>r.archiveId==='foreign-film'),{archiveId:'foreign-film',video:'movie.mp4',duration:120,burned:true});
 }finally{await rm(f.root,{recursive:true,force:true});}
});
