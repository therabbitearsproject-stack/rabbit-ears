import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/community.js',import.meta.url),'utf8');
const slice=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
test('only authoritative session results reach account preferences; health failures and redraws do not sign out',async()=>{
 const emitted=[];let configured=false,status=200;
 const node=()=>({children:[],setAttribute(){},addEventListener(){},replaceChildren(){this.children=[];},append(...children){this.children.push(...children);},querySelector(){return null;}});
 const context={CustomEvent,AbortController,setTimeout,clearTimeout,
  window:{dispatchEvent:e=>emitted.push(e.detail),rabbitPreferences:null},
  auth:node(),reactionAuth:node(),api:'https://api.test',
  el:(_tag,_cls,text)=>Object.assign(node(),{text}),button:(label,click)=>({label,click}),context:()=>null,controls(){},message(){},renderPreferenceStatus(){},
  fetch:async url=>({ok:status===200,status,json:async()=>url.endsWith('/health')?{configured}:url.endsWith('/api/session')?{user:{id:'viewer-a',name:'A',csrf:'csrf'}}:{ok:true}})};
 vm.createContext(context);
 vm.runInContext("let user=null,authKnown=false,ready=false;\n"+slice('async function call(','function controls(')+slice('function renderAuth(','function replayed(')+slice('async function connect(){','setInterval(()=>{'),context);
 vm.runInContext('renderAuth()',context);await vm.runInContext('connect()',context);
 assert.equal(emitted.length,0,'initial render and unavailable health cannot announce logout');
 configured=true;await vm.runInContext('connect()',context);assert.equal(emitted.at(-1).id,'viewer-a');
 const count=emitted.length;configured=false;await vm.runInContext('connect()',context);vm.runInContext('renderAuth()',context);
 assert.equal(emitted.length,count,'transient failure cannot republish a stale account or clear its preferences');
 configured=true;await vm.runInContext('connect()',context);const logout=context.auth.children.find(c=>c.label==='Sign out');await logout.click();assert.equal(emitted.at(-1),null);
 await vm.runInContext('connect()',context);status=401;await assert.rejects(vm.runInContext("call('/api/events')",context));assert.equal(emitted.at(-1),null);
});
