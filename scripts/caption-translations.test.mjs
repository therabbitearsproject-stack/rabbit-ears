import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildCaptionIndex} from './build-caption-index.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('saved translations require the identical source hash and never change programming',async()=>{
 const root=await mkdtemp(join(tmpdir(),'translations-'));try{
  const site=join(root,'site'),repo=join(root,'repo');await mkdir(join(site,'subs'),{recursive:true});await mkdir(join(repo,'captions'),{recursive:true});
  const original='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello!\n',translated=original.replace('Hello!','¡Hola!');
  const catalog=JSON.stringify({pools:{q:[['film','film.mp4',60,'Film','','english.srt','archive']]},programming:{epoch:123}});
  await writeFile(join(site,'catalog.json'),catalog);await writeFile(join(site,'subs/film.vtt'),original);
  const file='translated-'+sha(translated)+'.vtt',identity={archiveId:'archive',video:'film.mp4',duration:60};
  await writeFile(join(repo,'captions',file),translated);
  await writeFile(join(repo,'captions/translation-manifest.json'),JSON.stringify({schemaVersion:1,records:[{...identity,language:'es',sourceSha256:sha(original),file,sha256:sha(translated)},{...identity,language:'fr',sourceSha256:'0'.repeat(64),file,sha256:sha(translated)}]}));
  await buildCaptionIndex({repoRoot:repo,siteRoot:site});
  const index=JSON.parse(await readFile(join(site,'caption-translations.json')));assert.equal(index.records.length,1);assert.equal(index.records[0].language,'es');
  assert.equal(await readFile(join(site,'catalog.json'),'utf8'),catalog);assert.equal(await readFile(join(site,'captions',file),'utf8'),translated);
  await buildCaptionIndex({repoRoot:repo,siteRoot:site,externalTranslations:true});
  const external=JSON.parse(await readFile(join(site,'caption-translations.json')));
  assert.equal(external.records[0].deliveryUrl,'https://raw.githubusercontent.com/therabbitearsproject-stack/rabbit-ears/main/captions/'+file+'?v='+sha(translated));
  assert.equal(external.records[0].sourceSha256,sha(original));
  assert.equal(await readFile(join(site,'subs/film.vtt'),'utf8'),original);
  await assert.rejects(readFile(join(site,'captions',file)),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
