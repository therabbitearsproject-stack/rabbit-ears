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
