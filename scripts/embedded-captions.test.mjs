import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectMovie,subtitleSamples,decodeText,parseMultipart,toVtt,RangeReader} from './embedded-captions.mjs';
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const box=(type,...body)=>{const b=Buffer.concat(body);return Buffer.concat([u32(b.length+8),Buffer.from(type),b]);};
const full=(type,...body)=>box(type,u32(0),...body);
function fixture({wide=false,edits=false}={}){
 const header=Buffer.concat([Buffer.alloc(8),u32(1000),u32(4000),Buffer.alloc(8)]);
 const offset=wide?Buffer.from('00000001000000000000000100000010','hex'):Buffer.concat([u32(1000),u32(2000)]);
 const stbl=box('stbl',full('stsd',u32(1),box('tx3g',Buffer.alloc(8))),full('stsz',u32(0),u32(2),u32(5),u32(6)),full('stts',u32(1),u32(2),u32(1000)),full('stsc',u32(1),u32(1),u32(1),u32(1)),full(wide?'co64':'stco',u32(2),offset));
 const edit=edits?box('edts',full('elst',u32(2),u32(500),Buffer.from('ffffffff00010000','hex'),u32(2000),u32(0),Buffer.from('00010000','hex'))):Buffer.alloc(0);
 return Buffer.concat([full('mvhd',header),box('trak',edit,box('mdia',full('mdhd',header),full('hdlr',u32(0),Buffer.from('sbtl'),Buffer.alloc(12)),box('minf',stbl)))]);
}
test('sample tables map each subtitle to its own byte range and media clock',()=>{
 const data=fixture(),m=inspectMovie(data),t=m.tracks[0];assert.equal(t.codec,'tx3g');assert.equal(m.duration,4);
 assert.deepEqual(subtitleSamples(data,t),[{start:0,end:1,offset:1000,size:5},{start:1,end:2,offset:2000,size:6}]);
});
test('leading empty edits shift subtitles onto the movie presentation clock',()=>{
 const d=fixture({edits:true}),t=inspectMovie(d).tracks[0];assert.deepEqual(subtitleSamples(d,t).map(s=>[s.start,s.end]),[[.5,1.5],[1.5,2.5]]);
});
test('64-bit chunk offsets remain intact for large original videos',()=>{
 const d=fixture({wide:true});assert.deepEqual(subtitleSamples(d,inspectMovie(d).tracks[0]).map(s=>s.offset),[4294967296,4294967312]);
});
test('text extraction supports UTF-8 and UTF-16 and excludes style records',()=>{
 assert.equal(decodeText(Buffer.from('0003686921ffffffff','hex')),'hi!');
 assert.equal(decodeText(Buffer.from('0006feff00480069','hex')),'Hi');
 assert.throws(()=>decodeText(Buffer.from('001061','hex')),/Truncated/);
});
test('multipart responses are reconstructed by Content-Range, not response order',()=>{
 const body=Buffer.from('--b\r\nContent-Range: bytes 20-22/100\r\n\r\ndef\r\n--b\r\nContent-Range: bytes 0-2/100\r\n\r\nabc\r\n--b--\r\n');
 assert.deepEqual(parseMultipart(body,'multipart/byteranges; boundary=b',[{start:0,end:2},{start:21,end:22}]).map(b=>b.toString()),['abc','ef']);
 assert.throws(()=>parseMultipart(body,'multipart/byteranges; boundary=b',[{start:3,end:4}]),/Missing requested/);
});
test('WebVTT retains long-episode timestamps and escapes text markup',()=>{
 assert.match(toVtt([{start:3600.003,end:3601.5,text:'A < B & C'}]),/01:00:00.003 --> 01:00:01.500\nA &lt; B &amp; C/);
});
test('invalid ranges fail before making any network request',async()=>{
 const reader=new RangeReader('https://example.invalid',100);await assert.rejects(reader.read(99,2),/outside/);assert.equal(reader.requests,0);
});
