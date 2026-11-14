import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
test('account hydration, live updates and cross-account races preserve intent and never start video',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage();await page.setContent('<video id="v"></video>');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/preferences.js',import.meta.url))});
  const result=await page.evaluate(async()=>{
   const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pending=[],writes=[],applications=[],statuses=[];
   window.addEventListener('re:preferences-status',e=>statuses.push(e.detail.state));
   const values=new Map([['re_skin','pixel'],['re_tv_volume',.8]]),store={get:(k,d)=>values.has(k)?values.get(k):d,set:(k,v)=>values.set(k,v)};
   const profiles={A:{version:2,preferences:{re_skin:'theatre',re_caption_style:'yellow',re_tv_volume:.3}},B:{version:1,preferences:{re_skin:'gutter',re_tv_volume:.6}}};
   let account='A',hold=true,offline=false;const video=document.getElementById('v');let played=0,loaded=0;video.currentTime=42;video.play=()=>played++;video.load=()=>loaded++;
   const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
   const profile=id=>({schemaVersion:1,userId:id,...structuredClone(profiles[id])});
   const fetcher=async(url,options)=>{
    if(offline)throw Error('Fixture offline');
    if(url.endsWith('/api/session'))return response({user:{id:account,csrf:account+'-csrf'}});
    if(options.method==='PUT'){
     const {version,changes}=JSON.parse(options.body);writes.push({account,version,changes});
     if(version!==profiles[account].version)return response(profile(account),409);
     Object.assign(profiles[account].preferences,changes);profiles[account].version++;return response(profile(account));
    }
    const id=account;if(hold)return new Promise(resolve=>pending.push(()=>resolve(response(profile(id)))));
    return response(profile(id));
   };
   const sync=RabbitPreferences.create({store,apply:p=>applications.push({...p}),api:'https://api.test',fetcher,pollMs:0,debounceMs:100000});
   await sleep(5);store.set('re_tv_volume',.9);pending.shift()();await sleep(5);
   const hydration={skin:values.get('re_skin'),volume:values.get('re_tv_volume'),style:values.get('re_caption_style')};
   await sync.flush();const firstWrite=writes.at(-1);
   // An in-flight A refresh cannot hydrate B after a same-page account switch.
   sync.setSession({id:'A',csrf:'A-csrf'});await sleep(1);account='B';sync.setSession({id:'B',csrf:'B-csrf'});await sleep(1);
   const switchingSkin=values.get('re_skin');pending.shift()();await sleep(1);pending.shift()();await sleep(5);
   const switched={skin:values.get('re_skin'),volume:values.get('re_tv_volume'),state:sync.getState()};
   hold=false;store.set('re_radio_look','car');profiles.B.version++;profiles.B.preferences.re_caption_backing=true;await sync.flush();await sync.flush();
   const merged=structuredClone(profiles.B.preferences);
   offline=true;await sync.refresh();store.set('re_skin','metal');await sync.flush();const offlineLocal=values.get('re_skin'),offlineCache=structuredClone(values.get('re_account_preferences'));
   sync.setSession(null);const guest={skin:values.get('re_skin'),volume:values.get('re_tv_volume')};store.set('re_skin','cozy');await sync.flush();
   const stoppedWrites=writes.length;
   sync.stop();const guestWriteSafe=writes.length===stoppedWrites;
   // Recreate the client from its pre-signout offline disk snapshot, as a page reload would.
   const disk=new Map(values);disk.set('re_account_preferences',offlineCache);
   const restoredStore={get:(k,d)=>disk.has(k)?disk.get(k):d,set:(k,v)=>disk.set(k,v)};
   offline=false;const restored=RabbitPreferences.create({store:restoredStore,apply:()=>{},api:'https://api.test',fetcher,pollMs:0,debounceMs:100000});
   await sleep(5);const restoredSkin=disk.get('re_skin');await restored.flush();const restoredWrite=writes.at(-1);restored.stop();
   return {hydration,firstWrite,switchingSkin,switched,merged,guest,guestWriteSafe,writes,played,loaded,time:video.currentTime,originalA:profiles.A.preferences,statuses,offlineLocal,restoredSkin,restoredWrite};
  });
  assert.deepEqual(result.hydration,{skin:'theatre',volume:.9,style:'yellow'});
  assert.deepEqual(result.firstWrite.changes,{re_tv_volume:.9});
  assert.notEqual(result.switchingSkin,'theatre');assert.equal(result.switched.skin,'gutter');assert.equal(result.switched.volume,.6);assert.equal(result.switched.state.userId,'B');
  assert.equal(result.merged.re_radio_look,'car');assert.equal(result.merged.re_caption_backing,true);assert.equal(result.merged.re_tv_volume,.6);
  assert.equal(result.guest.skin,'pixel');assert.equal(result.guest.volume,.8);assert.equal(result.guestWriteSafe,true);
  assert.equal(result.played+result.loaded,0);assert.equal(result.time,42);
  assert.equal(result.offlineLocal,'metal');assert.ok(result.statuses.includes('saving'));assert.ok(result.statuses.includes('synced'));assert.ok(result.statuses.includes('offline'));
  assert.equal(result.restoredSkin,'metal');assert.equal(result.restoredWrite.account,'B');assert.deepEqual(result.restoredWrite.changes,{re_skin:'metal'});
 }finally{await browser.close();}
});

test('sparse account profiles use account defaults while only new accounts inherit intentional guest choices',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});
 try{
  const page=await browser.newPage();await page.setContent('<main></main>');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/preferences.js',import.meta.url))});
  const result=await page.evaluate(async()=>{
   const pause=()=>new Promise(r=>setTimeout(r,5)),guest={re_skin:'gutter',re_tv_volume:.2,re_caption_style:'yellow'};
   const profiles={existing:{version:1,preferences:{re_tv_muted:true}},fresh:{version:0,preferences:{}}};let account='existing',offlinePrefs=false;const writes=[];
   const fetcher=async(url,options)=>{
    const response=body=>({ok:true,status:200,json:async()=>body});
    if(url.endsWith('/api/session'))return response({user:{id:account,csrf:'fixture'}});
    if(offlinePrefs)throw Error('Offline profile fixture');
    if(options.method==='PUT'){const body=JSON.parse(options.body);writes.push(body);Object.assign(profiles[account].preferences,body.changes);profiles[account].version++;}
    return response({schemaVersion:1,userId:account,...structuredClone(profiles[account])});
   };
   const make=extra=>{const disk=new Map(Object.entries({...guest,re_guest_preferences:guest,...extra}));const store={get:(k,d)=>disk.has(k)?disk.get(k):d,set:(k,v)=>disk.set(k,v)};const ui=RabbitPreferences.create({store,apply:()=>{},api:'https://fixture.test',fetcher,pollMs:0,debounceMs:100000});return {disk,store,ui};};
   const first=make();await pause();const existing={skin:first.disk.get('re_skin'),volume:first.disk.get('re_tv_volume'),style:first.disk.get('re_caption_style'),writes:writes.length};
   const cache=structuredClone(first.disk.get('re_account_preferences'));first.ui.stop();
   offlinePrefs=true;const offline=make({re_account_preferences:cache});await pause();offline.store.set('re_tv_volume',.55);
   const offlineSaved=structuredClone(offline.disk.get('re_account_preferences'));const offlineView={skin:offline.disk.get('re_skin'),volume:offline.disk.get('re_tv_volume')};offline.ui.stop();
   offlinePrefs=false;account='fresh';const fresh=make({re_account_preferences:cache});await pause();await fresh.ui.flush();
   const seeded={skin:fresh.disk.get('re_skin'),volume:fresh.disk.get('re_tv_volume'),style:fresh.disk.get('re_caption_style'),saved:structuredClone(profiles.fresh.preferences)};fresh.ui.stop();
   return {existing,cache,offlineView,offlineSaved,seeded};
  });
  assert.deepEqual(result.existing,{skin:'pixel',volume:.8,style:'none',writes:0});
  assert.equal(result.cache.values.re_skin,'pixel');assert.equal(result.cache.values.re_radio_look,'vinyl');assert.equal(result.cache.values.re_caption_backing,false);
  assert.deepEqual(result.offlineView,{skin:'pixel',volume:.55});assert.equal(result.offlineSaved.values.re_skin,'pixel');assert.equal(result.offlineSaved.values.re_tv_volume,.55);assert.deepEqual(result.offlineSaved.pending,{re_tv_volume:.55});
  assert.equal(result.seeded.skin,'gutter');assert.equal(result.seeded.volume,.2);assert.equal(result.seeded.style,'yellow');assert.equal(result.seeded.saved.re_skin,'gutter');assert.equal(result.seeded.saved.re_tv_muted,undefined);
 }finally{await browser.close();}
});
