import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import worker,{digest,validatePreferences} from './worker.mjs';
const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fixture")}}',d1Databases:['DB'],compatibilityDate:'2025-01-01'}));
after(()=>runtime.dispose());
const DB=await runtime.getD1Database('DB');
for(const file of ['migrations/0001_community.sql','migrations/0002_preferences.sql'])for(const statement of (await readFile(new URL(file,import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await DB.prepare(statement).run();
const env={DB,SITE_ORIGIN:'https://rabbit-ears.stream',API_ORIGIN:'https://community.rabbit-ears.stream'};
for(const id of ['alice','bob','radio'])await DB.prepare('INSERT INTO sessions(token_hash,user_id,display_name,csrf,expires_at) VALUES(?,?,?,?,?)').bind(await digest(id+'-token'),id,id,id+'-csrf',Math.floor(Date.now()/1000)+3600).run();
const call=(who,method='GET',body,headers={})=>worker.fetch(new Request(env.API_ORIGIN+'/api/preferences',{method,headers:{Origin:env.SITE_ORIGIN,...(who?{Cookie:'__Host_re_session='+who+'-token','X-CSRF-Token':who+'-csrf'}:{}),'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{waitUntil(){}});

test('preferences are authenticated, CSRF protected and never selectable by another user',async()=>{
 assert.equal((await call(null)).status,401);
 assert.equal((await call(null,'PUT',{version:0,changes:{re_skin:'gutter'}})).status,401);
 assert.equal((await call('alice','PUT',{version:0,changes:{re_skin:'gutter'}},{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await call('alice','PUT',{version:0,changes:{re_skin:'gutter'}},{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await call('alice','PUT',{version:0,userId:'bob',changes:{re_skin:'gutter'}})).status,400);
 const response=await call('alice','PUT',{version:0,changes:{re_skin:'gutter',re_tv_volume:.35,re_tv_muted:true,re_caption_style:'yellow'}});
 assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.version,1);assert.equal(saved.userId,'alice');assert.equal(saved.preferences.re_captions,true);
 assert.deepEqual((await(await call('bob')).json()).preferences,{});
 assert.equal((await(await call('alice')).json()).preferences.re_skin,'gutter');
});

test('optimistic versions and sparse patches preserve concurrent device choices',async()=>{
 const [one,two]=await Promise.all([call('alice','PUT',{version:1,changes:{re_radio_look:'car'}}),call('alice','PUT',{version:1,changes:{re_caption_backing:true}})]);
 assert.deepEqual([one.status,two.status].sort(),[200,409]);
 const conflicted=one.status===409?await one.json():await two.json();assert.equal(conflicted.version,2);
 const retry=await call('alice','PUT',{version:2,changes:one.status===409?{re_radio_look:'car'}:{re_caption_backing:true}});
 assert.equal(retry.status,200);const saved=await retry.json();assert.equal(saved.preferences.re_radio_look,'car');assert.equal(saved.preferences.re_caption_backing,true);assert.equal(saved.preferences.re_tv_volume,.35);assert.equal(saved.version,3);
 const read=await call('alice');assert.equal(read.headers.get('Cache-Control'),'no-store');
});

test('Winamp Deck persists across devices and survives a stale unrelated settings update',async()=>{
 assert.deepEqual(validatePreferences({re_radio_look:'winamp'}),{re_radio_look:'winamp'});
 const saved=await call('radio','PUT',{version:0,changes:{re_radio_look:'winamp'}});
 assert.equal(saved.status,200);assert.equal((await saved.json()).preferences.re_radio_look,'winamp');
 const read=await(await call('radio')).json();assert.equal(read.version,1);assert.equal(read.preferences.re_radio_look,'winamp');
 const conflict=await call('radio','PUT',{version:0,changes:{re_vol:.45}});
 assert.equal(conflict.status,409);const current=await conflict.json();assert.equal(current.preferences.re_radio_look,'winamp');
 const retry=await call('radio','PUT',{version:current.version,changes:{re_vol:.45}});
 assert.equal(retry.status,200);const merged=await retry.json();assert.equal(merged.preferences.re_radio_look,'winamp');assert.equal(merged.preferences.re_vol,.45);
 assert.deepEqual((await(await call('bob')).json()).preferences,{});
});

test('preference schema rejects status/social data, invalid ranges and unimplemented settings',async()=>{
 for(const changes of [{re_tv_volume:1.1},{re_vol:-.1},{re_tv_muted:'yes'},{re_skin:'admin'},{re_caption_style:'purple'},{re_caption_size:1.2},{playbackPosition:30},{discordToken:'never'},{re_favs:['private']}]){
  assert.throws(()=>validatePreferences(changes));
  assert.equal((await call('bob','PUT',{version:0,changes})).status,400);
 }
 assert.deepEqual(validatePreferences({re_captions:false}),{re_captions:false,re_caption_style:'none'});
 assert.equal((await call('bob','PUT',{version:0,changes:{}})).status,400);
 assert.equal((await call('bob','PUT',{version:0,changes:{re_skin:'x'.repeat(9000)}})).status,413);
 const options=await worker.fetch(new Request(env.API_ORIGIN+'/api/preferences',{method:'OPTIONS',headers:{Origin:env.SITE_ORIGIN}}),env,{});assert.match(options.headers.get('Access-Control-Allow-Methods'),/PUT/);
});
