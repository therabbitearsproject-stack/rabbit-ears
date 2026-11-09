/* Site-rendered WebVTT captions keep the user's site choices independent of
   browser/OS native-caption styling. The browser still owns cue timing. */
window.RabbitCaptions = (() => {
  function create({ video, screen, button, store, source }) {
    const choices = ['none', 'yellow', 'white'];
    let style = store.get('re_caption_style', store.get('re_captions', false) ? 'white' : 'none');
    if (!choices.includes(style)) style = 'none';
    let backing = store.get('re_caption_backing', false) === true;
    let media = null, track = null, opener = null, lastText = '', nativeOnly = false;
    const layer = document.createElement('div');
    layer.className = 'caption-layer'; layer.hidden = true;
    layer.setAttribute('role', 'region'); layer.setAttribute('aria-label', 'Captions'); layer.setAttribute('aria-live', 'off');
    const menu = document.createElement('div');
    menu.id = 'caption-options'; menu.className = 'caption-options'; menu.hidden = true;
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'false'); menu.setAttribute('aria-label', 'Caption options');
    const heading = document.createElement('div'); heading.className = 'caption-options-title'; heading.textContent = 'Captions'; menu.append(heading);
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
      for (const b of [button, ...document.querySelectorAll('[data-remote="cc"]')]) {
        b.disabled = !available;
        b.setAttribute('aria-label', available ? `Caption options: ${style === 'none' ? 'off' : style}` : 'Captions unavailable');
        b.title = available ? 'Caption options (C)' : 'No captions for this show';
        b.setAttribute('aria-pressed', String(available && style !== 'none'));
        b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', menu.id); b.setAttribute('aria-expanded', String(!menu.hidden));
      }
      for (const b of radios) { const selected = b.dataset.captionChoice === style; b.setAttribute('aria-checked', String(selected)); b.tabIndex = selected ? 0 : -1; }
    }
    function updateAppearance() {
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
      Object.assign(layer.style, { left: (w - pictureW) / 2 + 'px', top: (h - pictureH) / 2 + 'px', width: pictureW + 'px', height: pictureH + 'px', fontSize: Math.max(12, pictureH * .055) + 'px', padding: `0 ${pictureW * .05}px ${bottom}px` });
      video.style.setProperty('--caption-font-size', Math.max(12, pictureH * .055) + 'px');
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
      if (track) { render(); return; }
      const tr = document.createElement('track'); tr.kind = 'captions'; tr.srclang = 'en'; tr.label = 'English'; tr.src = source(media.id);
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
      if (next?.id !== media?.id || next?.sub !== media?.sub) { detach(); closeMenu(false); }
      media = next; updateAppearance(); attach();
    }
    function closeMenu(focus = true) { if (menu.hidden) return; menu.hidden = true; syncButtons(); if (focus && opener?.isConnected) opener.focus({ preventScroll: true }); }
    function toggleMenu() {
      if (!media?.sub) return;
      if (!menu.hidden) { closeMenu(); return; }
      opener = document.activeElement?.matches('#cc,[data-remote="cc"]') ? document.activeElement : button;
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
    menu.addEventListener('focusout', () => setTimeout(() => { if (!menu.hidden && !menu.contains(document.activeElement)) closeMenu(false); }));
    for (const event of ['loadedmetadata', 'resize']) video.addEventListener(event, resize);
    for (const event of ['timeupdate', 'seeked', 'loadeddata']) video.addEventListener(event, render);
    video.addEventListener('seeking', clear); video.addEventListener('emptied', clear);
    function nativeMode(active) { nativeOnly = active; if (track) track.track.mode = active ? 'showing' : 'hidden'; clear(); render(); }
    video.addEventListener('enterpictureinpicture', () => nativeMode(true)); video.addEventListener('leavepictureinpicture', () => nativeMode(false));
    video.addEventListener('webkitbeginfullscreen', () => nativeMode(true)); video.addEventListener('webkitendfullscreen', () => nativeMode(false));
    new ResizeObserver(resize).observe(video); updateAppearance(); resize();
    new MutationObserver(resize).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return { setMedia, toggleMenu, syncButtons, closeMenu };
  }
  return { create };
})();
