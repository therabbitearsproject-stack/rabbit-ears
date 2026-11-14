/* Extra chrome for the same radio engine. Nothing creates/replaces the Audio node. */
(() => {
  const player=document.querySelector('#radioView .radio-set'),dial=player?.querySelector('.dial');
  if(!player||!dial||typeof audio==='undefined')return;
  const title=document.createElement('div');title.className='amp-titlebar';
  title.innerHTML='<span class="amp-mark" aria-hidden="true">R-E</span><strong>WINAMP DECK</strong><span class="amp-window-kind">01 / PLAYER</span>';
  player.prepend(title);
  const display=document.createElement('div');display.className='amp-clock-panel';
  const label=document.createElement('span');label.className='amp-clock-label';label.textContent='STREAM TIME';
  const time=document.createElement('output');time.className='amp-time';time.setAttribute('aria-label','Stream time');time.textContent='00:00';
  const state=document.createElement('span');state.className='amp-stream-state';state.setAttribute('aria-hidden','true');
  display.append(label,time,state);dial.append(display);
  let base=null;
  const draw=()=>{
    const value=Number.isFinite(audio.currentTime)?audio.currentTime:0;
    const seconds=Math.max(0,Math.floor(value-(base??value))),hours=Math.floor(seconds/3600);
    time.textContent=(hours?String(hours).padStart(2,'0')+':':'')+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    time.style.setProperty('--amp-time-digits',String(time.textContent.length));
    state.textContent=document.getElementById('rStatus').textContent;
    player.dataset.ampPlaying=String(!audio.paused&&!audio.ended&&audio.readyState>=3);
  };
  audio.addEventListener('playing',()=>{if(base===null)base=Number.isFinite(audio.currentTime)?audio.currentTime:0;draw();});
  for(const event of ['timeupdate','pause','waiting','stalled','error','ended'])audio.addEventListener(event,draw);
  for(const event of ['loadstart','emptied'])audio.addEventListener(event,()=>{base=null;draw();});
  new MutationObserver(draw).observe(document.getElementById('rStatus'),{childList:true,subtree:true,characterData:true});
  draw();
})();
