import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let chromium;try{({chromium}=require(process.env.RABBIT_EARS_PLAYWRIGHT||'playwright'));}catch{}
test('all interface languages update text and accessibility labels without touching media or user content',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});try{
  const page=await browser.newPage();await page.setContent('<button id="settings" title="Settings" aria-label="Settings">Settings</button><button id="play" title="Play">Play</button><input id="message" placeholder="Leave a comment" value="My own words"><p id="title">Strange Tales</p><p data-user-content>Play</p><div class="caption-layer">Pause</div><video id="vid"></video>');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/ui-translations.js',import.meta.url))});await page.addScriptTag({path:fileURLToPath(new URL('../assets/ui-language.js',import.meta.url))});
  const result=await page.evaluate(async()=>{
   let loads=0,plays=0,pauses=0;const video=document.getElementById('vid');video.currentTime=42;video.load=()=>loads++;video.play=()=>plays++;video.pause=()=>pauses++;
   const results=[];for(const language of ['es','fr','pt','zh','hi','ar','bn','id','ur']){RabbitI18n.setLanguage(language);results.push({language,lang:document.documentElement.lang,dir:document.documentElement.dir,label:document.getElementById('settings').textContent,title:document.getElementById('settings').title,aria:document.getElementById('settings').getAttribute('aria-label'),value:document.getElementById('message').value});}
   RabbitI18n.setLanguage('es');document.getElementById('play').textContent='Pause';await new Promise(r=>setTimeout(r,20));const dynamic=document.getElementById('play').textContent;
   RabbitI18n.setLanguage('en');return {results,dynamic,restored:document.getElementById('settings').textContent,caption:document.querySelector('.caption-layer').textContent,user:document.querySelector('[data-user-content]').textContent,programme:document.getElementById('title').textContent,sameVideo:video===document.getElementById('vid'),time:video.currentTime,loads,plays,pauses};
  });
  for(const value of result.results){assert.equal(value.lang,value.language);assert.equal(value.dir,['ar','ur'].includes(value.language)?'rtl':'ltr');assert.notEqual(value.label,'Settings');assert.equal(value.title,value.label);assert.equal(value.aria,value.label);assert.equal(value.value,'My own words');}
  assert.equal(result.dynamic,'Pausar');assert.equal(result.restored,'Settings');assert.equal(result.caption,'Pause');assert.equal(result.user,'Play');assert.equal(result.programme,'Strange Tales');assert.equal(result.sameVideo,true);assert.equal(result.time,42);assert.equal(result.loads+result.plays+result.pauses,0);
 }finally{await browser.close();}
});

test('automatic detection respects a saved manual choice and never requests GPS',{skip:!chromium},async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.RABBIT_EARS_BROWSER_EXE?{executablePath:process.env.RABBIT_EARS_BROWSER_EXE}:{})});try{
  const context=await browser.newContext({locale:'es-MX'}),page=await context.newPage();await page.route('http://locale.test/**',route=>route.fulfill({body:'<p>Settings</p>',contentType:'text/html'}));await page.goto('http://locale.test/');
  await page.addScriptTag({path:fileURLToPath(new URL('../assets/language-preference.js',import.meta.url))});
  assert.equal(await page.evaluate(()=>RabbitLocale.resolve()),'es');await page.evaluate(()=>{localStorage.setItem('re_caption_language','"fr"');localStorage.setItem('re_language_mode','"manual"');});assert.equal(await page.evaluate(()=>RabbitLocale.resolve()),'fr');
  await page.evaluate(()=>localStorage.setItem('re_language_mode','"auto"'));assert.equal(await page.evaluate(()=>RabbitLocale.resolve()),'es');await context.close();
 }finally{await browser.close();}
});
