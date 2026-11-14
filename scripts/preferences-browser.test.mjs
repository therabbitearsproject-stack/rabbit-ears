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
   const sleep=ms=>new Promise(r=>setTimeout(r,ms)),pending=[],writes=[],applications=[];
   const values=new Map([['re_skin','pixel'],['re_tv_volume',.8]]),store={get:(k,d)=>values.has(k)?values.get(k):d,set:(k,v)=>values.set(k,v)};
   const profiles={A:{version:2,preferences:{re_skin:'theatre',re_caption_style:'yellow',re_tv_volume:.3}},B:{version:1,preferences:{re_skin:'gutter',re_tv_volume:.6}}};
   let account='A',hold=true;const video=document.getElementById('v');let played=0,loaded=0;video.currentTime=42;video.play=()=>played++;video.load=()=>loaded++;
   const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
   const profile=id=>({schemaVersion:1,userId:id,...structuredClone(profiles[id])});
   const fetcher=async(url,options)=>{
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
   sync.setSession(null);const guest={skin:values.get('re_skin'),volume:values.get('re_tv_volume')};store.set('re_skin','cozy');await sync.flush();
   const stoppedWrites=writes.length;
   sync.stop();return {hydration,firstWrite,switchingSkin,switched,merged,guest,stoppedWrites,writes,played,loaded,time:video.currentTime,originalA:profiles.A.preferences};
  });
  assert.deepEqual(result.hydration,{skin:'theatre',volume:.9,style:'yellow'});
  assert.deepEqual(result.firstWrite.changes,{re_tv_volume:.9});
  assert.notEqual(result.switchingSkin,'theatre');assert.equal(result.switched.skin,'gutter');assert.equal(result.switched.volume,.6);assert.equal(result.switched.state.userId,'B');
  assert.equal(result.merged.re_radio_look,'car');assert.equal(result.merged.re_caption_backing,true);assert.equal(result.merged.re_tv_volume,.6);
  assert.equal(result.guest.skin,'pixel');assert.equal(result.guest.volume,.8);assert.equal(result.writes.length,result.stoppedWrites);
  assert.equal(result.played+result.loaded,0);assert.equal(result.time,42);
 }finally{await browser.close();}
});
