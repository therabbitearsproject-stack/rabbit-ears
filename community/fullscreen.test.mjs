import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped fullscreen handlers with browser events and a controlled clock.
const source=readFileSync(new URL('../assets/interface.js',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf('  let fullRequest='),source.indexOf('  const symbols='));
function fixture(kind='standard'){
  const timers=new Map(),log=[],classes=new Set();let clock=0;
  const target=()=>({listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}});
  const screen=target(),video=target(),controls=target(),document=target();
  const caption={hidden:true};let popover=false;
  const focus={inside:false,blur(){this.inside=false;document.activeElement=null;},focus(){document.activeElement=this;}};
  const button={focus(){document.activeElement=this;},blur(){document.activeElement=null;}};
  const body={classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains(n){return classes.has(n);}}};
  screen.querySelector=()=>popover?{}:null;
  screen.querySelectorAll=()=>popover?[{hidePopover(){popover=false;}}]:[];
  controls.contains=el=>!!el?.inside;
  document.getElementById=()=>caption;
  document.activeElement=focus;
  document.exitFullscreen=async()=>{document.fullscreenElement=null;document.webkitFullscreenElement=null;document.emit('fullscreenchange');};
  if(kind==='standard')screen.requestFullscreen=options=>{log.push({options,layoutApplied:classes.has('player-fullscreen')});document.fullscreenElement=screen;document.emit('fullscreenchange');return Promise.resolve();};
  if(kind==='ios')video.webkitEnterFullscreen=()=>{video.webkitDisplayingFullscreen=true;video.emit('webkitbeginfullscreen');};
  if(kind==='ios')video.webkitExitFullscreen=()=>{video.webkitDisplayingFullscreen=false;video.emit('webkitendfullscreen');};
  if(kind==='denied')screen.requestFullscreen=()=>Promise.reject(Error('Denied'));
  const context=vm.createContext({document,screen,vid:video,body,fullControls:controls,mode:'tv',full:false,idleTimer:null,
    captionUI:{closeMenu(){caption.hidden=true;}},$:()=>button,showChannel(){},
    setTimeout(fn){const id=++clock;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(handlers+'\nglobalThis.testApi={enterFull,exitFull,reveal};',context);
  return {screen,video,document,controls,classes,log,focus,caption,timers,api:context.testApi,context,
    tick(){const list=[...timers.values()];timers.clear();list.forEach(fn=>fn());},
    popover(value){popover=value;}};
}
test('first entry requests hidden browser chrome before layout, and hides pointer-focused controls',async()=>{
  const f=fixture();await f.api.enterFull();
  assert.equal(f.log[0].options.navigationUI,'hide');assert.equal(f.log[0].layoutApplied,false);
  f.focus.inside=true;f.document.activeElement=f.focus;f.tick();
  assert.ok(f.classes.has('controls-idle'));assert.equal(f.timers.size,0);
});
test('a menu holds controls open, then closing it allows the timer to recover',async()=>{
  const f=fixture();await f.api.enterFull();f.popover(true);f.tick();
  assert.ok(!f.classes.has('controls-idle'));assert.equal(f.timers.size,1);
  f.popover(false);f.tick();assert.ok(f.classes.has('controls-idle'));
});
test('keyboard users keep focus, and pointer use releases the focus hold',async()=>{
  const f=fixture();await f.api.enterFull();f.focus.inside=true;f.document.activeElement=f.focus;
  f.document.emit('keydown');f.tick();assert.ok(!f.classes.has('controls-idle'));
  f.document.emit('pointerdown');f.tick();assert.ok(f.classes.has('controls-idle'));
});
test('duplicate entry, mixed vendor events, browser exit and re-entry remain synchronized',async()=>{
  const f=fixture();await f.api.enterFull();await f.api.enterFull();assert.equal(f.log.length,1);
  f.document.emit('webkitfullscreenchange');assert.ok(f.classes.has('player-fullscreen'));
  await f.document.exitFullscreen();assert.ok(!f.classes.has('player-fullscreen'));
  await f.api.enterFull();f.tick();assert.ok(f.classes.has('controls-idle'));assert.equal(f.log.length,2);
});
test('iPhone video fullscreen is used when element fullscreen is unavailable',async()=>{
  const f=fixture('ios');await f.api.enterFull();assert.equal(f.video.webkitDisplayingFullscreen,true);
  f.video.webkitDisplayingFullscreen=false;f.video.emit('webkitendfullscreen');assert.ok(!f.classes.has('player-fullscreen'));
});
test('denied fullscreen retains a working fallback and exits cleanly',async()=>{
  const f=fixture('denied');await f.api.enterFull();assert.ok(f.classes.has('player-fullscreen'));
  f.tick();assert.ok(f.classes.has('controls-idle'));await f.api.exitFull();assert.ok(!f.classes.has('player-fullscreen'));assert.equal(f.timers.size,0);
});
test('exit while the native request is pending cannot leave native fullscreen stuck',async()=>{
  const f=fixture();let resolve;
  f.screen.requestFullscreen=()=>new Promise(done=>{resolve=done;});
  const entering=f.api.enterFull();await f.api.exitFull();
  f.document.fullscreenElement=f.screen;resolve();await entering;
  assert.equal(f.document.fullscreenElement,null);assert.ok(!f.classes.has('player-fullscreen'));
});
