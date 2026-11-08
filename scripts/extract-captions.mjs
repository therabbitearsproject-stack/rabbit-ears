// Extract a single original's embedded English track without downloading its video.
// Usage: node scripts/extract-captions.mjs ARCHIVE_ID "SELECTED_VIDEO.mp4" OUTPUT.vtt
// This does not enable CC; speech checks and a reviewed manifest entry are required.
import {writeFile} from 'node:fs/promises';
import {RangeReader,inspectMovie,extractTrack,toVtt} from './embedded-captions.mjs';
import {extractMatroska} from './matroska-captions.mjs';
const [id,video,output]=process.argv.slice(2);
if(!id||!video||!output)throw Error('Usage: node scripts/extract-captions.mjs ARCHIVE_ID SELECTED_VIDEO OUTPUT.vtt');
const response=await fetch('https://archive.org/metadata/'+encodeURIComponent(id),{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Metadata HTTP '+response.status);
const meta=await response.json(),selected=meta.files.find(f=>f.name===video&&!f.private);
if(!selected)throw Error('Selected video is not available');
const original=meta.files.find(f=>f.name===selected.original&&!f.private&&/\.(mp4|mkv)$/i.test(f.name))||selected;
const url='https://archive.org/download/'+encodeURIComponent(id)+'/'+original.name.split('/').map(encodeURIComponent).join('/');
const reader=new RangeReader(url,original.size);let cues,language;
if(/\.mkv$/i.test(original.name)){const result=await extractMatroska(reader);cues=result.cues;language=result.track?.language;}
else{
 const data=await reader.movie(),movie=inspectMovie(data),track=movie.tracks.find(t=>t.codec==='tx3g'&&t.language==='eng')||movie.tracks.find(t=>t.codec==='tx3g'&&t.language==='und');
 if(!track)throw Error('No supported English embedded text track');
 cues=await extractTrack(reader,data,track);language=track.language;
}
if(!cues?.length)throw Error('No supported English embedded captions');
await writeFile(output,toVtt(cues));console.log(JSON.stringify({archiveId:id,selected:video,source:original.name,language,cues:cues.length,first:cues[0].start,last:cues.at(-1).end,requests:reader.requests,bytes:reader.bytes}));
