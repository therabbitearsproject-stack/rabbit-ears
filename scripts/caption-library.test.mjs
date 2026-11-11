import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {applyReviewedCaptions,localCaption} from './caption-library.mjs';
const text='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
const row=['episode','video.ia.mp4',2700,'Episode','1990','','archive',720,480];
const entry={video:row[1],duration:row[2],archiveId:row[6],status:'passed',checks:[{fraction:.2,pass:true},{fraction:.8,pass:true}],sha256:createHash('sha256').update(text).digest('hex')};
const manifest=e=>({episodes:{episode:e}});
test('only the reviewed exact stream with intact captions gains CC',async()=>{
 const [result]=await applyReviewedCaptions([row],manifest(entry),async()=>text);assert.equal(result[5],'local:episode.vtt');assert.equal(row[5],'');
 for(const override of [{video:'other.mp4'},{duration:2699},{archiveId:'other'},{status:'needs-review'},{checks:[{fraction:.2,pass:true}]}])assert.equal((await applyReviewedCaptions([row],manifest({...entry,...override}),async()=>text))[0][5],'');
});
test('deleted, changed or unreadable assets cannot retain an old available CC flag',async()=>{
 const previous=[...row];previous[5]='local:episode.vtt';
 for(const load of [async()=>text+'changed',async()=>{throw Error('missing');}])assert.equal((await applyReviewedCaptions([previous],manifest(entry),load))[0][5],'');
 assert.equal((await applyReviewedCaptions([previous],{episodes:{}},async()=>text))[0][5],'');
 const sidecar=[...row];sidecar[5]='English.srt';assert.equal((await applyReviewedCaptions([sidecar],{episodes:{}},async()=>text))[0][5],'English.srt');
});
test('local subtitle paths cannot escape the caption folder',async()=>{
 await assert.rejects(localCaption('../index.html'),/Invalid/);await assert.rejects(localCaption('sub/file.vtt'),/Invalid/);
});

test('ordinary items use their own source identity while expanded programs retain their parent source',async()=>{
 const ordinary=['ordinary','exact/video.mp4',600,'Ordinary','','',''];
 const directEntry={...entry,video:ordinary[1],duration:600,archiveId:'ordinary'};
 const valid={episodes:{ordinary:directEntry,episode:entry}};
 assert.deepEqual((await applyReviewedCaptions([ordinary,row],valid,async()=>text)).map(r=>r[5]),['local:ordinary.vtt','local:episode.vtt']);
 for(const override of [{archiveId:''},{archiveId:'different'},{video:'video.mp4'},{duration:601},{sha256:'wrong'},{status:'unreviewed'}]){
  const [result]=await applyReviewedCaptions([ordinary],{episodes:{ordinary:{...directEntry,...override}}},async()=>text);
  assert.equal(result[5],'',JSON.stringify(override));
 }
 assert.equal((await applyReviewedCaptions([[...ordinary.slice(0,2),NaN,...ordinary.slice(3)]],valid,async()=>text))[0][5],'');
 assert.equal((await applyReviewedCaptions([row],{episodes:{episode:{...entry,archiveId:'episode'}}},async()=>text))[0][5],'','expanded identity must not fall back past an explicit parent');
});

test('multiple ordinary rows independently clear stale locals and preserve remote sidecars',async()=>{
 const make=(id,sub)=>[id,id+'.mp4',600,id,'',sub,''];
 const rows=[make('passed',''),make('removed','local:removed.vtt'),make('unreviewed','local:unreviewed.vtt'),make('remote','English.srt')];
 const episodes=Object.fromEntries(['passed','unreviewed','remote'].map(id=>[id,{...entry,archiveId:id,video:id+'.mp4',duration:600,status:id==='passed'?'passed':'needs-review'}]));
 const result=await applyReviewedCaptions(rows,{episodes},async()=>text);
 assert.deepEqual(result.map(r=>r[5]),['local:passed.vtt','','','English.srt']);
 assert.equal(rows[1][5],'local:removed.vtt','source catalog rows are not mutated');
});
