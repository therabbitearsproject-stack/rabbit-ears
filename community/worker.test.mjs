import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{validateEvent,discordPayload,digest} from './worker.mjs';
import {contentPosition,editionFile} from '../assets/community-timing.mjs';
const valid=()=>({channel:97,mediaId:'episode-1',file:'episode.mp4',title:'A show',position:42.5,kind:'comment',body:'Hello!',requestId:crypto.randomUUID()});
test('valid comments and reactions preserve original playback time',()=>{
  assert.equal(validateEvent(valid()).position,42.5);
  assert.equal(validateEvent({...valid(),kind:'emoji',body:'🖖'}).body,'🖖');
  assert.equal(validateEvent({...valid(),kind:'emoji',body:'😭'}).body,'😭');
  assert.throws(()=>validateEvent({...valid(),kind:'emoji',body:'📺'}));
});
test('reject forged channels, unsafe sizes, impossible timestamps, unknown emoji and malformed identifiers',()=>{
  for(const b of [{channel:999},{position:-1},{position:Infinity},{position:'3'},{kind:'webhook'},{body:'x'.repeat(501)},{kind:'emoji',body:'@everyone'},{requestId:'bad'},{mediaId:''}])assert.throws(()=>validateEvent({...valid(),...b}));
});
test('episode identity changes with file and remains stable between airings',async()=>{
  assert.equal(await digest(JSON.stringify(['a','one.mp4'])),await digest(JSON.stringify(['a','one.mp4'])));
  assert.notEqual(await digest(JSON.stringify(['a','one.mp4'])),await digest(JSON.stringify(['a','two.mp4'])));
});
test('edited tapes use the episode clock and a changed edit has its own replay identity',()=>{
  const cuts=[[600,1200],[1380,1980]];
  assert.equal(contentPosition(660,cuts),60);
  assert.equal(contentPosition(1440,cuts),660);
  assert.equal(contentPosition(1300,cuts),null);
  assert.equal(contentPosition(125),125);
  assert.equal(editionFile('tape.mp4',cuts),editionFile('tape.mp4',[[600,1200],[1380,1980]]));
  assert.notEqual(editionFile('tape.mp4',cuts),editionFile('tape.mp4',[[600,1200],[1400,1980]]));
});
test('Discord mentions are disabled and timestamps are content time',()=>{
  const payload=discordPayload({id:crypto.randomUUID(),display_name:'**Viewer**',position:125,kind:'comment',body:'@everyone hi <@123>',title:'A show',channel:97});
  assert.deepEqual(payload.allowed_mentions,{parse:[]});assert.match(payload.content,/2:05/);assert.equal(payload.enforce_nonce,true);
  assert.deepEqual(payload.embeds,[]);assert.equal(payload.flags,4100);assert.equal(payload.content.includes('\n'),false);
});
const env={SITE_ORIGIN:'https://rabbit-ears.stream',API_ORIGIN:'https://community.rabbit-ears.stream'};
const ctx={waitUntil(){}};
const authEnv={...env,DISCORD_CLIENT_ID:'123',DISCORD_CLIENT_SECRET:'test-secret',DISCORD_BOT_TOKEN:'test-bot',DISCORD_GUILD_ID:'456'};
test('Discord sign-in requests explicit membership consent and preserves the return channel',async()=>{
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/auth/discord?channel=97'),authEnv,ctx);
  assert.equal(response.status,302);
  const target=new URL(response.headers.get('Location'));
  assert.equal(target.searchParams.get('scope'),'identify guilds.join');
  assert.match(response.headers.get('Set-Cookie'),/__Host_re_return=97/);
});
for(const scenario of [
  {name:'new member',status:201,expected:302},
  {name:'existing member',status:204,expected:302},
  {name:'membership rejected',status:403,expected:502},
  {name:'join request interrupted',throws:true,expected:503},
  {name:'old identity-only authorization',scope:'identify',expected:403},
  {name:'profile unavailable',profileStatus:502,expected:502},
])test('OAuth join flow: '+scenario.name,async t=>{
  const calls=[],writes=[],pending=[];
  t.mock.method(globalThis,'fetch',async (url,init={})=>{
    calls.push({url:String(url),...init});
    if(String(url).endsWith('/token'))return Response.json({access_token:'test-access',scope:scenario.scope||'identify guilds.join'});
    if(String(url).endsWith('/users/@me'))return Response.json({id:'789',username:'Viewer'},{status:scenario.profileStatus||200});
    if(String(url).includes('/members/')){
      assert.equal(init.method,'PUT');assert.equal(init.headers.Authorization,'Bot test-bot');
      assert.deepEqual(JSON.parse(init.body),{access_token:'test-access'});
      assert.equal(String(url),'https://discord.com/api/v10/guilds/456/members/789');
      if(scenario.throws)throw Error('network interrupted');
      return new Response(null,{status:scenario.status});
    }
    if(String(url).endsWith('/token/revoke'))return new Response(null,{status:200});
    throw Error('Unexpected request');
  });
  const DB={prepare(sql){return {bind(...args){return {async run(){writes.push({sql,args});}};}};}};
  const response=await worker.fetch(new Request(env.API_ORIGIN+'/auth/callback?code=test&state=valid',{headers:{Cookie:'__Host_re_oauth=valid; __Host_re_return=97'}}),{...authEnv,DB},{waitUntil(p){pending.push(p);}});
  await Promise.all(pending);
  assert.equal(response.status,scenario.expected);
  assert.equal(calls.filter(c=>c.url.endsWith('/token/revoke')).length,1);
  assert.equal(writes.length,scenario.expected===302?1:0);
  assert.ok(!JSON.stringify(writes).includes('test-access'));
  if(scenario.expected===302){assert.equal(response.headers.get('Location'),env.SITE_ORIGIN+'/#ch97');assert.match(response.headers.get('Set-Cookie'),/__Host_re_session=/);}
});
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

test('Discord mirrors stay compact for multiline comments, markdown and emoji',()=>{
  const base={id:crypto.randomUUID(),display_name:'Viewer',position:133,channel:97};
  const comment=discordPayload({...base,kind:'comment',body:'First line\n\n# Heading *bold* [link](https://example.com)'});
  assert.equal(comment.content.includes('\n'),false);assert.ok(comment.content.includes('First line # Heading \\*bold\\* \\[link\\]'));
  const reaction=discordPayload({...base,kind:'emoji',body:'📺'});
  assert.equal(reaction.content,'**Viewer** · [2:13](<https://rabbit-ears.stream/#ch97>) 📺');
  assert.deepEqual(reaction.embeds,[]);assert.equal(reaction.flags,4100);
});
