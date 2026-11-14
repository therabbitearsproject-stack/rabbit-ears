/* Shared volume, tucked behind each remote's speaker button. */
(() => {
  const video=document.getElementById('vid'),screen=document.getElementById('screen');
  for(const [selector,name] of [['#mute','TV volume'],['.fullscreen-remote [data-remote="mute"]','Fullscreen TV volume']]){
    const trigger=document.querySelector(selector);if(!trigger)continue;
    const popup=document.createElement('div');popup.className='watch-popover volume-popover';popup.popover='auto';popup.id=name==='TV volume'?'tv-volume-popup':'fullscreen-volume-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label',name);
    const label=document.createElement('label');label.className='tv-volume';
    const text=document.createElement('span');text.textContent='Volume';
    const input=document.createElement('input');input.type='range';input.min='0';input.max='100';input.step='1';input.setAttribute('aria-label',name);input.setAttribute('aria-orientation','vertical');
    const close=()=>{if(popup.matches(':popover-open'))popup.hidePopover();trigger.focus({preventScroll:true});};
    const value=document.createElement('output'),mute=document.createElement('button');mute.type='button';mute.className='btn volume-mute';mute.addEventListener('click',()=>{setMuted(!video.muted);close();});
    input.addEventListener('input',()=>setTvVolume(Number(input.value)/100));input.addEventListener('change',close);label.append(text,input,value);popup.append(label,mute);screen.append(popup);
    trigger.setAttribute('popovertarget',popup.id);trigger.onclick=null;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',popup.id);trigger.setAttribute('aria-expanded','false');
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(popup.matches(':popover-open')){popup.hidePopover();return;}popup.showPopover();const a=trigger.getBoundingClientRect(),p=popup.getBoundingClientRect();popup.style.left=Math.max(12,Math.min(trigger.ownerDocument.defaultView.innerWidth-p.width-12,a.left+(a.width-p.width)/2))+'px';popup.style.top=Math.max(12,a.top-p.height-8)+'px';input.focus();},true);
    popup.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(popup.matches(':popover-open'))));
    const sync=()=>{input.value=String(Math.round(video.volume*100));value.textContent=video.muted?'Muted':input.value+'%';input.setAttribute('aria-valuetext',input.value+' percent'+(video.muted?', muted':''));mute.textContent=video.muted?'Unmute':'Mute';};video.addEventListener('volumechange',sync);sync();
  }
})();
