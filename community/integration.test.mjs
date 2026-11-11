/* Start `npm run dev -- --port 8797 --var SITE_ORIGIN:http://localhost:4173`
   first. Tests touch only Wrangler's local database, never Discord or production. */
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {digest} from './worker.mjs';
const base=process.env.TEST_API || 'http://localhost:8797', origin='http://localhost:4173';
const uid='local-test-'+crypto.randomUUID(), token=crypto.randomUUID(), csrf=crypto.randomUUID();
const wrangler=new URL('node_modules/wrangler/bin/wrangler.js',import.meta.url);
function sql(command){return execFileSync(process.execPath,[wrangler.pathname.replace(/^\/([A-Za-z]:)/,'$1'),'d1','execute','DB','--local','--command',command],{cwd:new URL('.',import.meta.url),encoding:'utf8',stdio:['ignore','pipe','pipe']});}
sql(`INSERT OR IGNORE INTO channels(number,name,discord_id) VALUES(97,'Local test','local-test-only'); INSERT INTO sessions(token_hash,user_id,display_name,csrf,expires_at) VALUES('${await digest(token)}','${uid}','Test Viewer','${csrf}',${Math.floor(Date.now()/1000)+3600});`);
const headers={Origin:origin,Cookie:'__Host_re_session='+token,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
const body={channel:97,mediaId:uid,file:'episode.mp4',title:'Local-only test episode',position:125.5,kind:'comment',body:'A moment saved with this episode.',requestId:crypto.randomUUID()};
const media=await digest(JSON.stringify([body.mediaId,body.file]));
const get=async path=>{const r=await fetch(base+path,{headers});assert.equal(r.status,200);return r.json();};
let event;
after(()=>sql(`DELETE FROM outbox WHERE event_id IN (SELECT id FROM events WHERE user_id='${uid}'); DELETE FROM events WHERE user_id='${uid}'; DELETE FROM sessions WHERE user_id='${uid}';`));
test('authenticated write persists, retry is idempotent, reads replay without creating more entries',async()=>{
  for(let i=0;i<2;i++){
    const r=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,201,await r.clone().text());const data=await r.json();if(event)assert.equal(event.id,data.event.id);event=data.event;
  }
  for(let i=0;i<3;i++){
    const data=await get(`/api/events?channel=97&media=${media}&from=100&to=150`);assert.equal(data.events.length,1);assert.equal(data.events[0].position,125.5);assert.equal(data.events[0].name,'Test Viewer');assert.equal(data.events[0].canDelete,true);
  }
  const markers=await get(`/api/timeline?channel=97&media=${media}`);assert.deepEqual(markers.markers,[{position:120,count:1,comments:1,sample:body.body,emoji:null}]);
});
test('another episode file and another channel do not inherit the first episode comments',async()=>{
  const other=await digest(JSON.stringify([body.mediaId,'other.mp4']));assert.deepEqual((await get(`/api/events?channel=97&media=${other}&from=100&to=150`)).events,[]);
  assert.deepEqual((await get(`/api/events?channel=90&media=${media}&from=100&to=150`)).events,[]);
});
test('CSRF prevents writes even when an authenticated session cookie is present',async()=>{
  const r=await fetch(base+'/api/events',{method:'POST',headers:{...headers,'X-CSRF-Token':'wrong'},body:JSON.stringify({...body,requestId:crypto.randomUUID()})});assert.equal(r.status,403);
});
test('concurrent posting cannot exceed the per-user limit',async()=>{
  const results=await Promise.all(Array.from({length:20},()=>fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify({...body,kind:'emoji',body:'❤️',requestId:crypto.randomUUID()})})));
  assert.equal(results.filter(r=>r.status===201).length,11);assert.equal(results.filter(r=>r.status===429).length,9);
  const timeline=await get(`/api/timeline?channel=97&media=${media}`);assert.equal(timeline.markers[0].emoji,'❤️');assert.equal(timeline.markers[0].count,12);assert.equal(timeline.markers[0].comments,1);
});
test('deleting a moment removes it from later playback',async()=>{
  const r=await fetch(base+'/api/events/'+event.id,{method:'DELETE',headers});assert.equal(r.status,200);
  const data=await get(`/api/events?channel=97&media=${media}&from=100&to=150`);assert.ok(data.events.every(e=>e.id!==event.id));
});
