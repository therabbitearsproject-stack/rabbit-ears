import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/window\.rePlaybackContext = \(\) => \{[\s\S]*?\n\};/)[0];
const original='https://archive.org/download/example/edition%20one.mp4',alias='https://archive.org/cors/example/edition%20one.mp4';
function fixture({currentSrc=original,delegate,custom=false,kind='program',readyState=4}={}){
 const media={id:'example',file:'edition one.mp4',title:'The original episode',dur:1800,cuts:[[30,40]]};
 const state={window:{...(delegate?{reAudio:{sourceMatches:delegate}}:{})},URL,location:{href:'https://rabbit-ears.stream/'},mode:'tv',playing:{m:media,v0:1234},channels:()=>[{no:97,name:'Subspace 97',custom}],cur:0,currentSegment:()=>({kind}),vid:{readyState,currentSrc,currentTime:142,paused:false,seeking:false},activeSegment:{media},fileUrl:()=>original};
 vm.runInNewContext(source,state);return {state,media,context:()=>state.window.rePlaybackContext()};
}
test('canonical playback remains usable without optional audio runtime and rejects wrong files',()=>{
 const good=fixture();assert.equal(good.context().file,good.media.file);assert.equal(fixture({currentSrc:alias}).context(),null);
 assert.equal(fixture({currentSrc:'https://archive.org/download/example/edition%20two.mp4'}).context(),null);
});
test('exact authorized CORS transport preserves canonical reaction and caption identity',()=>{
 let expected;
 const good=fixture({currentSrc:alias,delegate:url=>{expected=url;return url===original;}}),context=good.context();
 assert.equal(expected,original);assert.equal(context.mediaId,'example');assert.equal(context.file,'edition one.mp4');assert.equal(context.duration,1800);assert.equal(context.position,142);assert.equal(context.cuts,good.media.cuts);assert.equal(context.airingStart,1234);assert.equal(good.media.file,'edition one.mp4');
 assert.equal(fixture({currentSrc:original,delegate:()=>false}).context(),null,'an explicit mismatch must never fall through to URL equality');
 for(const wrong of ['https://archive.org/cors/example/edition%20two.mp4','https://archive.org/cors/another/edition%20one.mp4'])assert.equal(fixture({currentSrc:wrong,delegate:()=>false}).context(),null);
});
test('audio transport authorization cannot turn ads, custom sources or unreadable media into program context',()=>{
 for(const options of [{custom:true},{kind:'ad'},{readyState:0}])assert.equal(fixture({...options,delegate:()=>true}).context(),null);
});
