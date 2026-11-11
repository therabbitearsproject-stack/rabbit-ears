import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{validateEvent,discordPayload,digest} from './worker.mjs';
const valid=()=>({channel:97,mediaId:'episode-1',file:'episode.mp4',title:'A show',position:42.5,kind:'comment',body:'Hello!',requestId:crypto.randomUUID()});
test('valid comments and reactions preserve original playback time',()=>{
  assert.equal(validateEvent(valid()).position,42.5);
  assert.equal(validateEvent({...valid(),kind:'emoji',body:'🖖'}).body,'🖖');
});
test('reject forged channels, unsafe sizes, impossible timestamps, unknown emoji and malformed identifiers',()=>{
  for(const b of [{channel:999},{position:-1},{position:Infinity},{position:'3'},{kind:'webhook'},{body:'x'.repeat(501)},{kind:'emoji',body:'@everyone'},{requestId:'bad'},{mediaId:''}])assert.throws(()=>validateEvent({...valid(),...b}));
});
test('episode identity changes with file and remains stable between airings',async()=>{
  assert.equal(await digest(JSON.stringify(['a','one.mp4'])),await digest(JSON.stringify(['a','one.mp4'])));
  assert.notEqual(await digest(JSON.stringify(['a','one.mp4'])),await digest(JSON.stringify(['a','two.mp4'])));
});
test('Discord mentions are disabled and timestamps are content time',()=>{
  const payload=discordPayload({id:crypto.randomUUID(),display_name:'**Viewer**',position:125,kind:'comment',body:'@everyone hi <@123>',title:'A show',channel:97});
  assert.deepEqual(payload.allowed_mentions,{parse:[]});assert.match(payload.content,/2:05/);assert.equal(payload.enforce_nonce,true);
});
const env={SITE_ORIGIN:'https://rabbit-ears.stream',API_ORIGIN:'https://community.rabbit-ears.stream'};
const ctx={waitUntil(){}};
test('writes reject foreign origins before touching the database',async()=>{
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/api/events',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(valid())}),env,ctx);
  assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('unauthenticated posts cannot choose their own author',async()=>{
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/api/events',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({...valid(),user_id:'owner'})}),env,ctx);
  assert.equal(response.status,401);
});
test('OAuth callback requires state, so unsolicited codes cannot create sessions',async()=>{
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/auth/callback?code=untrusted&state=forged'),env,ctx);assert.equal(response.status,403);
});
test('CORS only allows the actual site and allows credentialed preflight',async()=>{
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/api/events',{method:'OPTIONS',headers:{Origin:env.SITE_ORIGIN}}),env,ctx);
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.SITE_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),'true');
});
