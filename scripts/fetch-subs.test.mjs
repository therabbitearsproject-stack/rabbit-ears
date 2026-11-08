import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
test('publication replaces empty cached local captions, retains sidecars and removes stale files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rabbit-ears-subs-')),fetch=globalThis.fetch;
 try{
  for(const sub of ['scripts','captions','subs'])await mkdir(join(dir,sub));
  for(const script of ['fetch-subs.mjs','caption-library.mjs'])await copyFile(new URL(script,import.meta.url),join(dir,'scripts',script));
  const text='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
  await writeFile(join(dir,'captions','episode.vtt'),text);await writeFile(join(dir,'subs','episode.vtt'),'');
  await writeFile(join(dir,'subs','ordinary.vtt'),'cached sidecar');await writeFile(join(dir,'subs','removed.vtt'),'stale');
  await writeFile(join(dir,'catalog.json'),JSON.stringify({pools:{trek:[['episode','video.mp4',2700,'Episode','', 'local:episode.vtt','archive']],other:[['ordinary','other.mp4',1000,'Other','','English.srt']]}}));
  globalThis.fetch=()=>{throw Error('Unexpected network fetch');};
  await import(pathToFileURL(join(dir,'scripts','fetch-subs.mjs')));
  assert.equal(await readFile(join(dir,'subs','episode.vtt'),'utf8'),text);
  assert.equal(await readFile(join(dir,'subs','ordinary.vtt'),'utf8'),'cached sidecar');
  await assert.rejects(readFile(join(dir,'subs','removed.vtt')),error=>error.code==='ENOENT');
 }finally{globalThis.fetch=fetch;await rm(dir,{recursive:true,force:true});}
});
