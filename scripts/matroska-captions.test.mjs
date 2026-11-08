import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vint,element,extractMatroska,assText} from './matroska-captions.mjs';
const raw=n=>Buffer.from(n.toString(16).padStart(n>16777215?8:n>65535?6:n>255?4:2,'0'),'hex');
const uint=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
function size(n){if(n<127)return Buffer.from([128|n]);const b=Buffer.alloc(2);b.writeUInt16BE(16384|n);return b;}
const el=(id,...items)=>{const data=Buffer.concat(items);return Buffer.concat([raw(id),size(data.length),data]);};
function movie(wrongClock=false){
 const float=Buffer.alloc(8);float.writeDoubleBE(33000);
 const info=el(0x1549a966,el(0x2ad7b1,uint(1000000)),el(0x4489,float));
 const tracks=el(0x1654ae6b,el(0xae,el(0xd7,Buffer.from([3])),el(0x83,Buffer.from([17])),el(0x86,Buffer.from('S_TEXT/UTF8')),el(0x22b59c,Buffer.from('eng'))));
 const groups=[],relative=[];let offset=el(0xe7,Buffer.from([0])).length;
 for(let i=0;i<32;i++){
  relative.push(offset);const rel=Buffer.alloc(2);rel.writeInt16BE(i*1000+(wrongClock&&i===15?10:0));
  const block=el(0xa0,el(0xa1,Buffer.from([131]),rel,Buffer.from([0]),Buffer.from('Line '+i)),el(0x9b,uint(900)));
  groups.push(block);offset+=block.length;
 }
 const cluster=el(0x1f43b675,el(0xe7,Buffer.from([0])),...groups);
 const seek=(infoAt,tracksAt,cuesAt)=>el(0x114d9b74,...[[0x1549a966,infoAt],[0x1654ae6b,tracksAt],[0x1c53bb6b,cuesAt]].map(([id,pos])=>el(0x4dbb,el(0x53ab,raw(id)),el(0x53ac,uint(pos)))));
 const initial=seek(0,0,0),clusterAt=initial.length+info.length+tracks.length;
 const cues=el(0x1c53bb6b,...relative.map((pos,i)=>el(0xbb,el(0xb3,uint(i*1000)),el(0xb7,el(0xf7,Buffer.from([3])),el(0xf1,uint(clusterAt)),el(0xf0,uint(pos))))));
 return Buffer.concat([el(0x1a45dfa3),el(0x18538067,seek(initial.length,initial.length+info.length,clusterAt+cluster.length),info,tracks,cluster,cues)]);
}
const reader=data=>({length:data.length,async read(start,n){return data.subarray(start,start+n);},async ranges(rs){return rs.map(r=>data.subarray(r.start,r.end+1));}});
test('EBML variable integers retain IDs, multi-byte sizes and unknown segment lengths',()=>{
 assert.deepEqual(vint(Buffer.from([0x40,0x80]),0),{value:128,length:2});
 assert.equal(vint(Buffer.from([0xff]),0).value,null);
 assert.equal(element(Buffer.from('1a45dfa380','hex')).id,0x1a45dfa3);
 assert.throws(()=>vint(Buffer.from([0]),0),/Invalid/);
});
test('indexed Matroska UTF-8 text retains exact block durations and timestamps',async()=>{
 const result=await extractMatroska(reader(movie()));assert.equal(result.duration,33);assert.equal(result.track.language,'eng');assert.equal(result.cues.length,32);
 assert.deepEqual(result.cues[15],{start:15,end:15.9,text:'Line 15'});assert.deepEqual(result.cues.at(-1),{start:31,end:31.9,text:'Line 31'});
});
test('inconsistent Matroska cue and block clocks are rejected',async()=>{
 await assert.rejects(extractMatroska(reader(movie(true))),/clock mismatch/);
});
test('ASS text drops layout commands and retains line breaks and spoken commas',()=>{
 assert.equal(assText('0,0,Default,,0,0,0,,{\\i1}Hello,{\\i0} captain.\\NWelcome aboard.'),'Hello, captain.\nWelcome aboard.');
 assert.equal(assText('0,0,Default,,0,0,0,,{\\p1}m 0 0 l 4 4'),'');
 assert.throws(()=>assText('incomplete'),/Invalid/);
});
