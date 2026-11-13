import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {captionJobIdentity,archiveCaptionSource,captionLanguage,generateCaptionJobs,importCaptionCompletion,validateGeneratedVtt,applyGeneratedCaptions,burnedCaptionSources,sha256} from './caption-jobs.mjs';

const row=(id='film',sub='',video='selected/full movie.mp4',duration=120)=>[id,video,duration,'Feature','1980',sub,'archive-item',640,480];
const channels=[{q:'midnight',no:42,name:'Midnight Mirage'},{q:'active',no:97,name:'Subspace 97'},{q:'other',no:30,name:'Drive-In'}];
const catalog=()=>({pools:{midnight:[row()],active:[row('alias')],other:[['another','other.mp4',180,'Other','1990','','another-item']]}});
const vtt='WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.\n\n00:01:50.000 --> 00:01:52.000\nGoodbye.\n';
function fixture(){
 const c=catalog(),queue=generateCaptionJobs({catalog:c,channels}),job=queue.jobs.find(j=>j.archiveId==='archive-item');
 const completion={schemaVersion:1,project:'rabbit-ears',jobId:job.jobId,archiveId:job.archiveId,video:job.video,duration:job.duration,language:job.language,sourceUrl:job.sourceUrl,detectedLanguage:'en',vtt,vttSha256:sha256(vtt),engine:'whisper',model:'large-v3-turbo',generatedAt:'2026-11-13T00:00:00Z'};
 return {catalog:c,channels,queue,completion};
}

test('exact selected-file identities dedupe across channels, retain aliases and prioritize active shows',()=>{
 const f=fixture();assert.equal(f.queue.jobs.length,2);const job=f.queue.jobs[0];assert.equal(job.priority,0);assert.equal(job.aliases.length,2);assert.deepEqual(job.channels.map(c=>c.no),[42,97]);
 assert.equal(job.sourceUrl,'https://archive.org/download/archive-item/selected/full%20movie.mp4');assert.equal(job.language,'auto');
 const base={archiveId:'archive-item',video:'a.mp4',duration:120,language:'en'};
 assert.equal(captionJobIdentity(base),captionJobIdentity({...base}));
 for(const change of [{archiveId:'other'},{video:'b.mp4'},{duration:120.001},{language:'auto'}])assert.notEqual(captionJobIdentity(base),captionJobIdentity({...base,...change}));
});

test('all missing metadata queues without guessing English or translating non-English sources',()=>{
 const c=catalog();c.pools.midnight.push(row('foreign','','foreign.mp4'));c.pools.midnight.push(row('known','','known.mp4'));
 const q=generateCaptionJobs({catalog:c,channels,sourceRecords:[{archiveId:'archive-item',file:'foreign.mp4',language:'jpn'},{archiveId:'archive-item',video:'known.mp4',language:'eng'}]});
 assert.deepEqual(q.jobs.filter(j=>j.archiveId==='archive-item').map(j=>j.language).sort(),['auto','en','ja']);
 assert.equal(captionLanguage(['eng','cze']),'auto');assert.equal(captionLanguage('und'),'auto');
});

test('any linked alias, reviewed exact track or affirmative burned-source review protects the whole stream',()=>{
 const c=catalog();c.pools.active[0][5]='English.srt';assert.equal(generateCaptionJobs({catalog:c,channels}).jobs.length,1);
 const e={archiveId:'archive-item',video:row()[1],duration:120,status:'passed'};
 assert.equal(generateCaptionJobs({catalog:catalog(),channels,reviewedManifest:{episodes:{film:e}}}).summary.reviewed,1);
 const docs=[{films:[{archiveId:'archive-item',video:row()[1],burnedEnglish:'yes'}]}];
 assert.equal(generateCaptionJobs({catalog:catalog(),channels,reviewDocuments:docs}).summary.burned,1);
 assert.equal(burnedCaptionSources([{films:[{id:'x',video:'x.mp4',burnedEnglishStatus:'No burned English text observed in3sampled frames'}]}]).size,0);
});

test('existing Midnight review documents contribute all seven positively observed burned-English sources',async()=>{
 const docs=await Promise.all(['../docs/midnight-mirage-subtitles-review.json','../docs/midnight-mirage/additional-subtitle-review.json'].map(async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'))));
 assert.equal(burnedCaptionSources(docs).size,7);
});

test('Archive source construction cannot target another host, credentials, query or traversal',()=>{
 for(const id of ['https://evil.test','../x','archive.org@evil','x/y','x?redirect=evil'])assert.throws(()=>archiveCaptionSource(id,'a.mp4'));
 for(const video of ['/etc/passwd','../x.mp4','dir/../x.mp4','a\\b.mp4','a\u0000.mp4','a//b.mp4'])assert.throws(()=>archiveCaptionSource('item',video));
 assert.equal(new URL(archiveCaptionSource('item','a?b#c.mp4')).hostname,'archive.org');
 assert.equal(new URL(archiveCaptionSource('item','a?b#c.mp4')).search,'');
});

test('a completion links exact aliases with distinctly automatic language metadata and preserves reviewed manifest isolation',()=>{
 const f=fixture(),r=importCaptionCompletion(f),entry=r.manifest.jobs[f.completion.jobId];
 assert.equal(entry.status,'auto-generated');assert.equal(entry.detectedLanguage,'en');assert.equal(entry.language,'auto');assert.equal(entry.cues,2);assert.equal(entry.model,'large-v3-turbo');
 assert.equal(r.links.length,2);assert.equal(r.links[0].sub,'local:auto-'+f.completion.jobId+'.vtt');assert.equal(r.links[0].captionMetadata.kind,'auto-generated');assert.equal(f.catalog.pools.midnight[0][5],'');assert.equal(r.asset.text,vtt);
});

test('completed jobs must match project, submitted identity, exact runtime, source URL and VTT SHA',()=>{
 const f=fixture();
 for(const patch of [{project:'audiobooks'},{schemaVersion:2},{jobId:'0'.repeat(64)},{archiveId:'other'},{video:'other.mp4'},{duration:120.01},{language:'en'},{sourceUrl:f.completion.sourceUrl+'?download=1'},{sourceUrl:'http://archive.org/download/archive-item/x.mp4'},{vttSha256:'0'.repeat(64)},{detectedLanguage:'auto'}])assert.throws(()=>importCaptionCompletion({...f,completion:{...f.completion,...patch}}),JSON.stringify(patch));
 assert.throws(()=>importCaptionCompletion({...f,generatedManifest:{project:'audiobooks',jobs:{}}}),/project/);
});

test('valid original-language automatic captions never claim English translation',()=>{
 const f=fixture(),r=importCaptionCompletion({...f,completion:{...f.completion,detectedLanguage:'ja'}});
 assert.equal(r.manifest.jobs[f.completion.jobId].detectedLanguage,'ja');assert.equal(r.links[0].captionMetadata.language,'ja');
});

test('stale completions, newly linked tracks and newly reviewed/burned tracks cannot be overwritten',()=>{
 const f=fixture();
 const stale=structuredClone(f.catalog);stale.pools.midnight[0][2]=121;stale.pools.active[0][2]=121;
 assert.throws(()=>importCaptionCompletion({...f,catalog:stale}),/no longer matches/);
 const linked=structuredClone(f.catalog);linked.pools.active[0][5]='local:reviewed.vtt';assert.throws(()=>importCaptionCompletion({...f,catalog:linked}),/protected/);
 assert.throws(()=>importCaptionCompletion({...f,reviewedManifest:{episodes:{film:{archiveId:'archive-item',video:row()[1],duration:120,status:'passed'}}}}),/protected/);
 assert.throws(()=>importCaptionCompletion({...f,reviewDocuments:[{id:'archive-item',video:row()[1],burnedEnglish:'yes'}]}),/protected/);
});

test('duplicate completion imports are idempotent and a different result cannot silently replace the first',()=>{
 const f=fixture(),first=importCaptionCompletion(f),again=importCaptionCompletion({...f,generatedManifest:first.manifest});assert.equal(again.duplicate,true);assert.deepEqual(again.manifest,first.manifest);
 const changed=vtt.replace('Hello there.','Different text.');assert.throws(()=>importCaptionCompletion({...f,generatedManifest:first.manifest,completion:{...f.completion,vtt:changed,vttSha256:sha256(changed)}}),/cannot be overwritten/);
});

test('generated VTT validates real cues, bounded source times and plain text, not empty or malformed payloads',()=>{
 assert.equal(validateGeneratedVtt(vtt,120).cues,2);
 for(const text of ['WEBVTT\n\n','WEBVTT\n\n00:00:03.000 --> 00:00:01.000\nBackward\n','WEBVTT\n\n00:02:00.000 --> 00:02:01.000\nToo late\n','WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<script>x</script>\n','WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n\n','WEBVTT\n\n00:00:01.000 --> 00:01:20.000\nToo long\n','WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nOne\n\n00:00:02.000 --> 00:00:04.000\nOverlap\n'])assert.throws(()=>validateGeneratedVtt(text,120));
});

test('automatic link application verifies assets, shares cache across aliases, and clears stale automatic flags',async()=>{
 const f=fixture(),r=importCaptionCompletion(f);let loads=0;const load=async()=>{loads++;return vtt;};
 const rows=await applyGeneratedCaptions([row(),row('alias')],r.manifest,load);assert.equal(loads,1);assert.ok(rows.every(r=>/^local:auto-/.test(r[5])));assert.equal(rows[0][11].language,'en');
 const reviewed=row('reviewed','local:reviewed.vtt');reviewed[11]={kind:'auto-generated',language:'en'};const replacement=(await applyGeneratedCaptions([reviewed],r.manifest,load))[0];assert.equal(replacement[5],reviewed[5]);assert.equal(replacement[11],undefined,'a reviewed replacement loses stale automatic labeling');
 for(const loader of [async()=>vtt+'changed',async()=>{throw Error('missing');}])assert.equal((await applyGeneratedCaptions(rows,r.manifest,loader))[0][5],'');
 const removed=await applyGeneratedCaptions(rows,{project:'rabbit-ears',jobs:{}},load);assert.equal(removed[0][5],'');assert.equal(removed[0][11],undefined);
 const wrongProject=await applyGeneratedCaptions(rows,{...r.manifest,project:'audiobooks'},load);assert.equal(wrongProject[0][5],'','other project manifests cannot retain or add automatic CC');
 const burned=await applyGeneratedCaptions([row()],r.manifest,load,{reviewDocuments:[{id:'archive-item',video:row()[1],burnedEnglish:'yes'}]});assert.equal(burned[0][5],'');
});
