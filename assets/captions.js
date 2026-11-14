/* Site-rendered WebVTT captions keep the user's site choices independent of
   browser/OS native-caption styling. The browser still owns cue timing. */
window.RabbitCaptions = (() => {
  function create({ video, screen, button, store, source }) {
    const choices = ['none', 'yellow', 'white'];
    let style = store.get('re_caption_style', store.get('re_captions', false) ? 'white' : 'none');
    if (!choices.includes(style)) style = 'none';
    let backing = store.get('re_caption_backing', false) === true;
    let media = null, baseMedia = null, track = null, opener = null, lastText = '', nativeOnly = false;
    let captionIndex = null, overlaySource = '', requestNumber = 0;
    const exactKey=m=>m&&Number.isFinite(m.dur??m.duration)?JSON.stringify([m.archiveId||m.id,m.file||m.video,m.dur??m.duration]):'';
    const isAuto=m=>m?.captionMetadata?.kind==='auto-generated'||/^local:auto-[a-f0-9]{64}\.vtt$/.test(m?.sub||'');
    const indexRank=r=>r.burned?1000:r.captionMetadata?.kind==='reviewed'?200:r.captionMetadata?.language==='en'?(r.captionMetadata.translated?110:100):10;
    function resolveMedia(){
      let next=baseMedia, url='';
      // Existing manual, embedded and reviewed tracks are never replaced by automatic additions.
      if(baseMedia&&captionIndex&&(!baseMedia.sub||isAuto(baseMedia))){
        const record=captionIndex.get(exactKey(baseMedia));
        if(record?.burned||baseMedia.burnedCaptions||['burned-in','embedded'].includes(baseMedia.captionMetadata?.kind))next={...baseMedia,sub:'',captionMetadata:undefined};
        else if(record?.captionMetadata?.kind==='auto-generated'&&record.captionMetadata.language!=='en'&&baseMedia.captionMetadata?.language==='en'&&baseMedia.sub){/* Keep an existing English track over a foreign automatic alternative. */}
        else if(record){
          next={...baseMedia,sub:record.sub,captionMetadata:record.captionMetadata};
          url='/captions/'+encodeURIComponent(record.sub.slice(6))+(/^[a-f0-9]{64}$/i.test(record.sha256||'')?'?v='+record.sha256:'');
        }else if(isAuto(baseMedia))next={...baseMedia,sub:'',captionMetadata:undefined};
      }
      if(next?.id!==media?.id||next?.sub!==media?.sub||url!==overlaySource){detach();closeMenu(false);}
      media=next;overlaySource=url;updateAppearance();attach();
    }
    async function refreshIndex(){
      const request=++requestNumber;
      try{
        const response=await fetch('/caption-index.json',{cache:'no-cache',signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined});
        if(!response.ok)return;
        const data=await response.json();
        if(request!==requestNumber||data?.schemaVersion!==1||!Array.isArray(data.records))return;
        const records=new Map();
        for(const record of data.records){
          if(!record||typeof record.archiveId!=='string'||typeof record.video!=='string'||!Number.isFinite(record.duration)||record.duration<=0)continue;
          if(!record.burned&&(!/^local:[A-Za-z0-9._-]+\.vtt$/.test(record.sub||'')||record.sub.includes('..')||!['reviewed','auto-generated'].includes(record.captionMetadata?.kind)))continue;
          const key=exactKey(record),old=records.get(key);
          if(!old||indexRank(record)>indexRank(old))records.set(key,record);
        }
        captionIndex=records;resolveMedia();
      }catch{/* A failed refresh preserves the last known caption availability. */}
    }
    const layer = document.createElement('div');
    layer.className = 'caption-layer'; layer.hidden = true;
    layer.setAttribute('role', 'region'); layer.setAttribute('aria-label', 'Captions'); layer.setAttribute('aria-live', 'off');
    const menu = document.createElement('div');
    menu.id = 'caption-options'; menu.className = 'caption-options'; menu.hidden = true;
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'false'); menu.setAttribute('aria-label', 'Caption options');
    const heading = document.createElement('div'); heading.className = 'caption-options-title'; heading.textContent = 'Captions'; menu.append(heading);
    const automatic=()=>media?.captionMetadata?.kind==='auto-generated'||/^local:auto-[a-f0-9]{64}\.vtt$/.test(media?.sub||'');
    const translated=()=>automatic()&&media?.captionMetadata?.translated===true;
    function languageName(code){
      try{const name=new Intl.DisplayNames(['en'],{type:'language'}).of(code);if(name)return name;}catch{}
      return ({en:'English',cs:'Czech',ja:'Japanese',fr:'French',de:'German',es:'Spanish',pl:'Polish',zh:'Chinese',ru:'Russian',ko:'Korean',it:'Italian',pt:'Portuguese',ar:'Arabic',hi:'Hindi'})[code]||code;
    }
    const trackLanguage=()=>translated()?'en':media?.captionMetadata?.language||'en';
    function trackLabel(){
      const name=languageName(trackLanguage());
      if(!translated())return name+(automatic()?' (auto-generated)':'');
      const metadata=media.captionMetadata,valid=code=>typeof code==='string'&&/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(code)&&code.split('-')[0].toLowerCase()!=='en';
      let codes=Array.isArray(metadata.sourceLanguages)?metadata.sourceLanguages.filter(valid):[];
      if(!codes.length&&valid(metadata.sourceLanguage))codes=[metadata.sourceLanguage];
      const names=[...new Set(codes.map(code=>code.toLowerCase()))].map(languageName);
      let sources=names.join(', ');
      try{sources=new Intl.ListFormat(['en'],{style:'long',type:'conjunction'}).format(names);}catch{}
      return name+' (auto-translated'+(sources?' from '+sources:'')+')';
    }
    const colors = document.createElement('div'); colors.className = 'caption-color-options'; colors.setAttribute('role', 'radiogroup'); colors.setAttribute('aria-label', 'Caption color');
    const radios = choices.map(value => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.captionChoice = value;
      b.setAttribute('role', 'radio'); b.textContent = value[0].toUpperCase() + value.slice(1);
      b.addEventListener('click', () => { setStyle(value); closeMenu(); }); colors.append(b); return b;
    });
    const label = document.createElement('label'); label.className = 'caption-backing-option';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = backing;
    checkbox.addEventListener('change', () => { backing = checkbox.checked; store.set('re_caption_backing', backing); updateAppearance(); });
    label.append(checkbox, document.createTextNode('Black backing')); menu.append(colors, label); screen.append(layer, menu);

    function syncButtons() {
      const available = !!media?.sub;
      for (const b of [button, ...screen.querySelectorAll('[data-remote="cc"]')]) {
        b.disabled = !available;
        b.setAttribute('aria-label', available ? `Caption options: ${style === 'none' ? 'off' : style}` : 'Captions unavailable');
        b.title = available ? 'Caption options (C)' : 'No captions for this show';
        b.setAttribute('aria-pressed', String(available && style !== 'none'));
        b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', menu.id); b.setAttribute('aria-expanded', String(!menu.hidden));
      }
      for (const b of radios) { const selected = b.dataset.captionChoice === style; b.setAttribute('aria-checked', String(selected)); b.tabIndex = selected ? 0 : -1; }
    }
    function updateAppearance() {
      heading.textContent=translated()?'Auto-translated captions':automatic()?'Auto-generated captions':'Captions';
      layer.dataset.color = style; layer.dataset.backing = String(backing);
      video.dataset.captionColor = style; video.dataset.captionBacking = String(backing);
      syncButtons();
    }
    function resize() {
      const w = video.clientWidth, h = video.clientHeight, ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3;
      const pictureW = Math.min(w, h * ratio), pictureH = pictureW / ratio;
      let bottom = pictureH / 12;
      const controls = screen.querySelector('.fullscreen-controls');
      if (document.body.classList.contains('player-fullscreen') && !document.body.classList.contains('controls-idle') && controls) {
        const box = video.getBoundingClientRect(), panel = controls.getBoundingClientRect();
        bottom = Math.max(bottom, box.top + (h + pictureH) / 2 - panel.top + pictureH * .02);
      }
      Object.assign(layer.style, { left: (w - pictureW) / 2 + 'px', top: (h - pictureH) / 2 + 'px', width: pictureW + 'px', height: pictureH + 'px', fontSize: Math.max(12, pictureH * .045) + 'px', padding: `0 ${pictureW * .05}px ${bottom}px` });
      video.style.setProperty('--caption-font-size', Math.max(12, pictureH * .045) + 'px');
    }
    function clear() { lastText = ''; layer.replaceChildren(); layer.hidden = true; }
    function render() {
      if (!track || style === 'none' || nativeOnly || video.seeking) { clear(); return; }
      const texts = Array.from(track.track.activeCues || [], cue => cue.getCueAsHTML ? cue.getCueAsHTML().textContent.trim() : cue.text.trim()).filter(Boolean);
      const text = texts.join('\n'); if (text === lastText) return;
      lastText = text; layer.replaceChildren();
      for (const text of texts) { const block = document.createElement('div'), span = document.createElement('span'); block.className = 'caption-block'; span.className = 'caption-text'; span.textContent = text; block.append(span); layer.append(block); }
      layer.hidden = !texts.length; resize();
    }
    function detach() { const old = track; track = null; if (old) { old.track.mode = 'disabled'; old.remove(); } clear(); }
    function attach() {
      if (!media?.sub || style === 'none') { detach(); return; }
      if (track) { track.srclang=trackLanguage(); track.label=trackLabel(); render(); return; }
      const tr = document.createElement('track'); tr.kind = 'captions'; tr.srclang = trackLanguage(); tr.label = trackLabel(); tr.src = overlaySource||source(media.id);
      track = tr; video.append(tr); tr.track.mode = nativeOnly ? 'showing' : 'hidden';
      tr.track.addEventListener('cuechange', render); tr.addEventListener('load', render); tr.addEventListener('error', clear);
      render();
    }
    function setStyle(value) {
      if (!choices.includes(value)) return;
      style = value; store.set('re_caption_style', style); store.set('re_captions', style !== 'none');
      updateAppearance(); attach();
    }
    function setMedia(next) {
      baseMedia=next;resolveMedia();
    }
    function closeMenu(focus = true) { if (menu.hidden) return; menu.hidden = true; syncButtons(); if (focus && opener?.isConnected) opener.focus({ preventScroll: true }); }
    function toggleMenu() {
      if (!media?.sub) return;
      if (!menu.hidden) { closeMenu(); return; }
      opener = menu.ownerDocument.activeElement?.matches('#cc,[data-remote="cc"]') ? menu.ownerDocument.activeElement : button;
      menu.hidden = false; syncButtons(); radios[choices.indexOf(style)].focus({ preventScroll: true });
      screen.dispatchEvent(new Event('captionmenuopen'));
    }
    menu.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
      if (e.target.getAttribute('role') !== 'radio') return;
      const i = radios.indexOf(e.target); let next;
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) next = (i + 1) % radios.length;
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) next = (i + radios.length - 1) % radios.length;
      if (e.key === 'Home') next = 0; if (e.key === 'End') next = radios.length - 1;
      if (next !== undefined) { e.preventDefault(); e.stopPropagation(); setStyle(choices[next]); radios[next].focus(); }
    });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('#cc,[data-remote="cc"]')) closeMenu(false); });
    menu.addEventListener('focusout', () => setTimeout(() => { if (!menu.hidden && !menu.contains(menu.ownerDocument.activeElement)) closeMenu(false); }));
    for (const event of ['loadedmetadata', 'resize']) video.addEventListener(event, resize);
    for (const event of ['timeupdate', 'seeked', 'loadeddata']) video.addEventListener(event, render);
    video.addEventListener('seeking', clear); video.addEventListener('emptied', clear);
    function nativeMode(active) { nativeOnly = active; if (track) track.track.mode = active ? 'showing' : 'hidden'; clear(); render(); }
    video.addEventListener('enterpictureinpicture', () => nativeMode(true)); video.addEventListener('leavepictureinpicture', () => nativeMode(false));
    video.addEventListener('webkitbeginfullscreen', () => nativeMode(true)); video.addEventListener('webkitendfullscreen', () => nativeMode(false));
    new ResizeObserver(resize).observe(video); updateAppearance(); resize();
    new MutationObserver(resize).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    refreshIndex();
    const refreshTimer=setInterval(refreshIndex,5*60*1000);refreshTimer?.unref?.();
    function applyPreferences(values){
      if(choices.includes(values.re_caption_style))style=values.re_caption_style;
      else if(typeof values.re_captions==='boolean')style=values.re_captions?(style==='none'?'white':style):'none';
      if(typeof values.re_caption_backing==='boolean'){backing=values.re_caption_backing;checkbox.checked=backing;}
      updateAppearance();attach();
    }
    return { setMedia, toggleMenu, syncButtons, closeMenu, refreshIndex, applyPreferences };
  }
  return { create };
})();
