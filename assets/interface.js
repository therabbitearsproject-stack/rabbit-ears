/* Presentation layer. The existing schedule, video, radio and game engines retain ownership. */
(() => {
  const skins = [
    ['retro','Retro Cabinet','Walnut, chrome and tactile television dials.','#765038'],
    ['theatre','Movie Theatre','Velvet curtains and a dark auditorium.','#742739'],
    ['stadium','Stadium Seat','Field stripes and a broadcast scoreboard.','#31583f'],
    ['modern','Silver Screen','Brushed aluminium and a quiet modern setting.','#a6afb7'],
    ['cozy','Cozy Den','Warm wood and soft evening lamplight.','#b48d61'],
    ['metal','Midnight Metal','Black steel, red stage lights and loud type.','#b51d32'],
    ['ivory','Ivory Console','Enamel, burgundy and an easy-to-read guide.','#e6d8bf'],
  ];
  const paths={tv:'M4 7h16v13H4z M8 3l4 4 4-4',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',radio:'M5 9h14v11H5z M7 9l11-6 M8 13h8 M8 16h2 M14 16h2',game:'M7 7h10l4 5v7h-4l-3-3h-4l-3 3H3v-7z M6 11v4 M4 13h4 M16 11h.1 M18 14h.1',palette:'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4 2 2 0 0 1 0-4h3a4 4 0 0 0 4-4c0-4-5-6-9-6 M7 8h.1 M6 13h.1 M11 6h.1 M16 8h.1',play:'M8 4l12 8-12 8z',pause:'M8 5v14 M16 5v14',up:'M5 15l7-7 7 7',down:'M5 9l7 7 7-7',full:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',exit:'M3 8h5V3 M21 8h-5V3 M3 16h5v5 M21 16h-5v5',back:'M11 5l-7 7 7 7 M4 12h16',sound:'M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8',mute:'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',rewind:'M8 4L3 9l5 5 M3 9h10a7 7 0 1 1-7 11',forward:'M16 4l5 5-5 5 M21 9H11a7 7 0 1 0 7 11',share:'M9 7l6 5-6 5 M15 12H3 M14 4h7v16h-7',flag:'M5 21V3l14 3-5 6H5',shuffle:'M3 5h3l12 14h3 M18 16l3 3-3 3 M3 19h3l4-5 M14 9l4-4h3 M18 2l3 3-3 3',cc:'M10 8H6v8h4 M20 8h-4v8h4',close:'M5 5l14 14 M19 5L5 19',heart:'M12 21S2 14 2 7a5 5 0 0 1 10-2A5 5 0 0 1 22 7c0 7-10 14-10 14'};
  const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n]||paths.tv}"/></svg>`;
  const make=(tag,cls,text)=>Object.assign(document.createElement(tag),{className:cls||'',textContent:text||''});
  const button=(label,fn,cls='btn')=>{const b=make('button',cls,label);b.type='button';b.onclick=fn;return b;};
  const donate=()=>{const a=make('a','archive-donate','Support the Internet Archive ↗');a.href='https://archive.org/donate';a.target='_blank';a.rel='noopener';return a;};
  let logos={}, guideScroll=0, guideFocus=null, idleTimer, dialogOpener, channelNo, scheduleToken=0;
  let full=false, radioLook=store.get('re_radio_look','vinyl');
  const body=document.body, tv=$('tvView'), screen=$('screen');
  const initialChannel=/^#ch\d+$/.test(location.hash);
  const skin=store.get('re_skin','retro');
  body.dataset.skin=skins.some(s=>s[0]===skin)?skin:'retro';
  body.dataset.tvPage=initialChannel?'channel':'guide';
  body.dataset.radioLook=radioLook==='car'?'car':'vinyl';
  function station(ch,compact=false){
    const el=make('span','channel-identity'+(compact?' compact':''));
    const info=logos[ch.name];
    el.append(make('span','channel-no',String(ch.no).padStart(2,'0')));
    const mat=make('span','logo-mat');
    if(info){el.style.setProperty('--channel-accent',info.accent);const im=make('img','channel-logo');im.src=info.src;im.alt=ch.name;im.width=180;im.height=100;im.decoding='async';mat.append(im);}
    else mat.append(make('span','channel-name',ch.name));
    el.append(mat);return el;
  }
  const wordmark=()=>'<span class="site-wordmark"><svg viewBox="0 0 80 32" aria-hidden="true"><path d="M24 3l16 22L56 3M13 29h54" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="3" r="3" fill="currentColor"/><circle cx="56" cy="3" r="3" fill="currentColor"/></svg><span>rabbit-ears<small>.stream<i></i></small></span></span>';
  document.querySelectorAll('.brand').forEach(el=>{el.innerHTML=wordmark();});
  const home=make('a','brand-home');home.href='#tv';home.setAttribute('aria-label','Rabbit Ears home');home.innerHTML=wordmark();
  document.querySelector('h1.brand').replaceChildren(home);
  const nav=document.querySelector('.tabs');
  for(const [id,name,label] of [['tabTv','tv','TV guide'],['tabRadio','radio','Radio'],['tabGames','game','Games']]){
    const a=$(id);a.innerHTML=icon(name)+`<span class="nav-name">${label}</span>`;a.title=label;a.setAttribute('aria-label',label);
  }
  const nowLink=make('a','tab');nowLink.href='#now';nowLink.title='On now';nowLink.setAttribute('aria-label','On now');nowLink.innerHTML=icon('clock')+'<span class="nav-name">On now</span>';nav.insertBefore(nowLink,$('tabRadio'));
  const skinButton=button('Skins',()=>openDialog(skinDialog),'tab');skinButton.id='chooseSkin';skinButton.innerHTML=icon('palette')+'<span class="nav-name">Skins</span>';skinButton.title='Choose a viewing skin';skinButton.setAttribute('aria-label','Choose a viewing skin');nav.append(skinButton);
  const currentSkin=make('span','current-skin');document.querySelector('header').append(currentSkin);
  function syncSkin(){currentSkin.textContent=skins.find(s=>s[0]===body.dataset.skin)[1]+(body.dataset.skin==='retro'?' · Default':'');document.querySelector('meta[name="theme-color"]').content=getComputedStyle(body).getPropertyValue('--bg').trim();}
  syncSkin();
  const pack=make('div','player-pack');const cabinet=tv.querySelector('.cabinet');
  const controls=tv.querySelector('.remote'),details=tv.querySelector('.now'),guide=tv.querySelector('.guide');
  pack.append(cabinet,controls,details);
  const hero=make('div','tv-hero');const copy=make('div','landing-copy');
  const landingStation=make('div','landing-station'),landingTitle=make('h2','landing-title');
  const eyebrow=make('p','eyebrow','ON THE AIR · SHARED BROADCAST');
  const landingNext=make('p','landing-next');
  const watch=button('Watch channel',()=>openChannel(cur),'btn watch-channel');watch.innerHTML=icon('play')+'<span>Watch channel</span>';
  copy.append(eyebrow,landingStation,landingTitle,landingNext,watch,donate());
  hero.append(copy,pack);const rail=make('aside','channel-rail');rail.setAttribute('aria-label','Tune to a channel');hero.append(rail);
  tv.prepend(hero); // same video node throughout guide, channel and fullscreen
  const guideBack=button('TV guide',showGuide,'btn guide-back');guideBack.innerHTML=icon('back')+'<span>TV guide</span>';pack.prepend(guideBack);
  const badge=make('div','playing-station');details.prepend(badge);
  const channelSchedule=make('section','channel-schedule');channelSchedule.setAttribute('aria-label','Selected channel schedule');
  const scheduleHeading=make('h3'),scheduleList=make('ol','channel-schedule-list'),scheduleStatus=make('p','schedule-status');
  channelSchedule.append(scheduleHeading,scheduleStatus,scheduleList);pack.append(channelSchedule);
  async function updateSchedule(){
    const ch=channels()[cur];if(!ch)return;const token=++scheduleToken;
    scheduleHeading.textContent=`CH ${String(ch.no).padStart(2,'0')} · ${ch.name} schedule`;
    scheduleStatus.textContent='Loading the schedule…';scheduleStatus.hidden=false;scheduleList.replaceChildren();
    try{
      const programs=await lineup(ch,nowSec(),6);if(token!==scheduleToken)return;
      if(!programs.length)throw Error('No programmes');
      for(const [i,p] of programs.entries()){
        const item=make('li','channel-schedule-item');item.dataset.start=p.start;item.dataset.channel=ch.no;
        item.append(make('span','schedule-state',i===0?'ON NOW':i===1?'UP NEXT':'LATER'));
        const time=make('time','schedule-time',`${clockFmt(p.start)}–${clockFmt(p.end)}`);time.dateTime=new Date(p.start*1000).toISOString();item.append(time);
        const title=button(p.m.title,()=>{
          if(p.start<=nowSec())openChannel(channels().findIndex(c=>c.no===ch.no));
          else{const block=make('span');block.append(make('b','',p.m.title));block.title=`${clockFmt(p.start)}–${clockFmt(p.end)}`;showFuture(ch,block);}
        },'schedule-title');title.title=i===0?'Watch the current broadcast':'Programme information';item.append(title);scheduleList.append(item);
      }
      scheduleStatus.hidden=true;
    }catch{if(token===scheduleToken)scheduleStatus.textContent='The schedule is unavailable. Please try again in a moment.';}
  }
  const hardware=make('div','tv-hardware');hardware.innerHTML='<span class="hardware-brand">RE<br>STREAM</span><div class="speaker-grille" aria-hidden="true"></div><i class="power-led" aria-hidden="true"></i>';
  const tuneUp=button('Next channel',()=>openChannel(cur+1),'tuning-knob');tuneUp.title='Next channel';tuneUp.setAttribute('aria-label','Next channel');
  const tuneDown=button('Previous channel',()=>openChannel(cur-1),'tuning-knob');tuneDown.title='Previous channel';tuneDown.setAttribute('aria-label','Previous channel');
  hardware.insertBefore(tuneUp,hardware.children[1]);hardware.insertBefore(tuneDown,hardware.children[2]);cabinet.append(hardware);
  const guideNote=make('p','guide-instructions','Scroll for every channel · Select a show airing now to watch');guide.querySelector('.guide-head').after(guideNote);
  const nowMarker=make('span','guide-now-label','NOW');$('grid').prepend(nowMarker);
  guide.append(donate());details.append(donate());$('welcome').querySelector('.wcard').append(donate());
  const footerHistory=make('a','','Original design');footerHistory.href='design-history/2026-11-08-original/';footerHistory.title='Visit the preserved original interface';document.querySelector('.foot').append(footerHistory);
  function decorateGuide(){
    rows.forEach(r=>{const t=r.el.querySelector('.t');const viewer=t.querySelector('.vw'),remove=t.querySelector('.x');t.replaceChildren(station(r.ch,true));if(viewer)t.append(viewer);if(remove)t.append(remove);r.el.setAttribute('aria-label',`Channel ${r.ch.no}: ${r.ch.name}. ${r.ch.desc||''}`);});
    renderRail();
  }
  function renderRail(){rail.replaceChildren(make('h3','','Tune in'));for(const [i,ch] of channels().entries()){
    const b=button('',()=>openChannel(i),'rail-channel');b.append(station(ch,true));b.setAttribute('aria-label',`Channel ${ch.no} ${ch.name}`);b.setAttribute('aria-pressed',String(i===cur));rail.append(b);
  }}
  function channelChanged(){
    const ch=channels()[cur];if(!ch)return;
    const changed=channelNo!==ch.no;channelNo=ch.no;
    landingStation.replaceChildren(station(ch));badge.replaceChildren(station(ch,true));fullStation.replaceChildren(station(ch,true));
    rail.querySelectorAll('.rail-channel').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===cur)));
    if(changed){reveal();updateSchedule();}
  }
  function showChannel(){
    if(body.dataset.tvPage==='guide'){guideScroll=window.scrollY;guideFocus=document.activeElement?.closest('.chan');}
    const entering=body.dataset.tvPage!=='channel';body.dataset.tvPage='channel';if(entering)updateSchedule();
  }
  function openChannel(i){
    const was=mode,next=((i%channels().length)+channels().length)%channels().length;
    showChannel();if(mode!=='tv')setMode('tv');showChannel();
    if(next!==cur||(!playing&&was==='tv'))tune(next);else channelChanged();
    history.replaceState(null,'','#ch'+channels()[cur].no);
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function showGuide(){
    if(full)exitFull();body.dataset.tvPage='guide';
    history.replaceState(null,'','#tv');if(mode!=='tv')setMode('tv');
    requestAnimationFrame(()=>{window.scrollTo(0,guideScroll);guideFocus?.focus({preventScroll:true});});
  }
  $('tabTv').addEventListener('click',e=>{e.preventDefault();showGuide();});
  home.addEventListener('click',e=>{e.preventDefault();showGuide();});
  function modeChanged(){
    body.dataset.mode=mode;if(mode!=='tv'&&full)exitFull();
    if(mode==='tv')body.dataset.tvPage=/^#ch\d+$/.test(location.hash)?'channel':'guide';
    if(mode==='tv'&&body.dataset.tvPage==='channel')updateSchedule();
    nowLink.setAttribute('aria-current',mode==='now'?'page':'false');
  }
  function dialog(label){const d=make('dialog','interface-dialog');d.setAttribute('aria-label',label);const close=button('Close',()=>d.close(),'btn dialog-close');close.innerHTML=icon('close');close.title='Close';close.setAttribute('aria-label','Close');d.append(close);d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>dialogOpener?.focus());body.append(d);return d;}
  function openDialog(d){dialogOpener=document.activeElement;d.showModal();}
  const skinDialog=dialog('Choose a viewing skin');skinDialog.append(make('p','eyebrow','MAKE YOURSELF AT HOME'),make('h2','','A different place to tune in'),make('p','dialog-intro','Your channel keeps playing. Your choice stays on this device.'));
  const skinGrid=make('div','skin-options');
  for(const [key,name,desc,col] of skins){const b=button('',()=>{
    body.dataset.skin=key;store.set('re_skin',key);syncSkin();skinGrid.querySelectorAll('button').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));
  },'skin-option');b.dataset.preview=key;b.style.setProperty('--sample',col);b.setAttribute('aria-pressed',String(body.dataset.skin===key));
  const mini=make('span','skin-mini');mini.setAttribute('aria-hidden','true');mini.innerHTML='<i></i><b></b>';b.append(mini,make('strong','',name+(key==='retro'?' · Default':'')),make('small','',desc));skinGrid.append(b);}
  skinDialog.append(skinGrid);
  const futureDialog=dialog('Upcoming programme');
  const futureTitle=make('h2'),futureInfo=make('p');futureDialog.append(make('p','eyebrow','COMING UP NEXT'),futureTitle,futureInfo,make('p','dialog-intro','This programme has not started. Tune in to the current broadcast or return to the guide.'),button('Watch this channel',()=>{futureDialog.close();openChannel(channels().findIndex(c=>c.no===+futureDialog.dataset.channel));}));
  function showFuture(ch,block){futureDialog.dataset.channel=ch.no;futureTitle.textContent=block.querySelector('b')?.textContent||'Upcoming programme';futureInfo.textContent=`CH ${ch.no} · ${ch.name} · ${block.title}`;openDialog(futureDialog);}
  // Fullscreen has its own temporary controls, forwarding to the existing remote actions.
  const fullControls=make('div','fullscreen-controls');
  const fullStation=make('div','fullscreen-station'),fullTitle=make('h2','fullscreen-title'),fullNext=make('p','fullscreen-next');
  const fullRemote=make('div','fullscreen-remote');
  for(const [id,label] of [['down','Previous channel'],['up','Next channel'],['back','Back 15 seconds'],['pause','Pause'],['fwd','Forward 15 seconds'],['mute','Sound'],['cc','Captions']]){
    const b=button(label,()=>{$(id).click();reveal();});b.dataset.remote=id;b.setAttribute('aria-label',label);fullRemote.append(b);
  }
  const exit=button('Exit fullscreen',exitFull);exit.innerHTML=icon('exit');exit.title='Exit fullscreen';exit.setAttribute('aria-label','Exit fullscreen');fullRemote.append(exit);
  fullControls.append(fullStation,fullTitle,fullNext,fullRemote);screen.append(fullControls);
  function reveal(){
    clearTimeout(idleTimer);body.classList.remove('controls-idle');
    if(full)idleTimer=setTimeout(()=>{if(!fullControls.contains(document.activeElement))body.classList.add('controls-idle');},3000);
  }
  async function enterFull(){
    if(mode!=='tv')return;showChannel();full=true;body.classList.add('player-fullscreen');reveal();
    try{const request=screen.requestFullscreen||screen.webkitRequestFullscreen;if(request)await request.call(screen);}catch{/* in-page fullscreen remains available */}
  }
  async function exitFull(){
    full=false;clearTimeout(idleTimer);body.classList.remove('player-fullscreen','controls-idle');
    if(document.fullscreenElement||document.webkitFullscreenElement){try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch{}}
    showChannel();$('full').focus({preventScroll:true});
  }
  $('full').onclick=enterFull;
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&full)exitFull();});
  document.addEventListener('webkitfullscreenchange',()=>{if(!document.webkitFullscreenElement&&full)exitFull();});
  screen.addEventListener('pointermove',reveal);screen.addEventListener('pointerdown',e=>{if(full&&body.classList.contains('controls-idle')){e.preventDefault();reveal();}});screen.addEventListener('touchstart',reveal,{passive:true});fullControls.addEventListener('focusin',reveal);fullControls.addEventListener('focusout',()=>setTimeout(reveal));
  const symbols={down:['down','Previous channel'],up:['up','Next channel'],surf:['shuffle','Random channel'],back:['rewind','Back 15 seconds'],fwd:['forward','Forward 15 seconds'],pause:['pause','Pause'],mute:['mute','Sound off'],cc:['cc','Captions'],full:['full','Fullscreen'],share:['share','Share channel'],report:['flag','Report tape'],gFull:['full','Fullscreen'],gShare:['share','Share game'],gReport:['flag','Report game']};
  function refreshSymbols(){for(const [id,[base,label]] of Object.entries(symbols)){
    const b=$(id);if(!b)continue;let name=base, accessible=b.getAttribute('aria-label')||label;
    if(id==='pause'){name=held?'play':'pause';accessible=held?'Play':'Pause';}
    if(id==='mute'){name=vid.muted?'mute':'sound';accessible=vid.muted?'Sound off':'Sound on';}
    if(id==='share'||id==='gShare'){if(/copied/i.test(b.textContent))accessible='Link copied';}
    const markup=icon(name)+(id==='back'||id==='fwd'?'<small>15</small>':'');
    if(!b.querySelector('svg')||b.dataset.icon!==name){b.innerHTML=markup;b.dataset.icon=name;}
    b.setAttribute('aria-label',accessible);if(id!=='cc'||!b.disabled)b.title=accessible;
  }
  for(const b of fullRemote.querySelectorAll('[data-remote]')){const original=$(b.dataset.remote);if(b.innerHTML!==original.innerHTML)b.innerHTML=original.innerHTML;b.disabled=original.disabled;b.setAttribute('aria-label',original.getAttribute('aria-label')||original.title);b.title=b.getAttribute('aria-label');if(original.hasAttribute('aria-pressed'))b.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));}
  }
  function syncTitle(){landingTitle.textContent=$('title').textContent;landingNext.textContent=$('upnext').textContent||'Everyone tuned in sees the same broadcast.';fullTitle.textContent=$('title').textContent;fullNext.textContent=$('upnext').textContent;refreshSymbols();}
  new MutationObserver(syncTitle).observe(details,{subtree:true,childList:true,characterData:true});
  new MutationObserver(refreshSymbols).observe(controls,{subtree:true,childList:true,characterData:true});
  // Now-list rows are rebuilt each minute; use the same transparent, themed identities.
  new MutationObserver(()=>{for(const r of $('nowList').querySelectorAll('.nowrow')){const ch=channels().find(c=>String(c.no).padStart(2,'0')===r.querySelector('.n')?.textContent);const nm=r.querySelector('.nm');if(ch&&nm&&!nm.querySelector('.channel-identity'))nm.replaceChildren(station(ch,true));}}).observe($('nowList'),{childList:true});
  const radioSet=document.querySelector('.radio-set');
  const platter=make('div','vinyl-platter');platter.setAttribute('aria-hidden','true');platter.innerHTML='<span class="record-label">RE<br><small>33⅓ / LIVE RADIO</small></span><i class="tonearm"></i>';radioSet.prepend(platter);
  const radioAppearance=make('div','radio-appearance');radioAppearance.setAttribute('role','group');radioAppearance.setAttribute('aria-label','Radio appearance');
  for(const [look,label] of [['vinyl','Vinyl deck'],['car','Car stereo']]){const b=button(label,()=>{body.dataset.radioLook=look;store.set('re_radio_look',look);radioAppearance.querySelectorAll('button').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));});b.setAttribute('aria-pressed',String(body.dataset.radioLook===look));radioAppearance.append(b);}
  $('radioView').prepend(radioAppearance);
  const stereoBadge=make('span','stereo-badge','RE AUDIO / FM STEREO');radioSet.append(stereoBadge);
  audio.addEventListener('playing',()=>body.classList.add('radio-playing'));audio.addEventListener('pause',()=>body.classList.remove('radio-playing'));
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||!$('welcome').hidden)return;
    if(e.key==='Escape'&&mode==='tv'){if(full){e.preventDefault();e.stopImmediatePropagation();exitFull();}else if(body.dataset.tvPage==='channel'){e.preventDefault();e.stopImmediatePropagation();showGuide();}return;}
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(full)reveal();
    if(mode==='tv'&&body.dataset.tvPage==='guide'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();const i=rows.findIndex(r=>r.el===document.activeElement);if(e.key==='ArrowUp'||e.key==='ArrowDown'){rows[Math.max(0,Math.min(rows.length-1,(i<0?cur:i)+(e.key==='ArrowDown'?1:-1)))]?.el.focus();}else $('grid').scrollBy({left:e.key==='ArrowRight'?240:-240,behavior:'smooth'});
    }
  },true);
  window.REUI={openChannel,showChannel,showGuide,showFuture,decorateGuide,channelChanged,modeChanged};
  setInterval(()=>{if(mode==='tv'&&body.dataset.tvPage==='channel')updateSchedule();},60000);
  fetch('assets/channel-logos/manifest.json').then(r=>{if(!r.ok)throw Error('Channel logos unavailable');return r.json();}).then(data=>{logos=data;decorateGuide();channelChanged();}).catch(()=>{renderRail();channelChanged();});
  decorateGuide();channelChanged();syncTitle();modeChanged();
})();
