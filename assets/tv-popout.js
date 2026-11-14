/* One player, moved between documents. No second stream or second schedule. */
(() => {
  const tv = $('tvView'), video = $('vid'), remote = tv.querySelector('.remote');
  const trigger = document.createElement('button');
  trigger.id = 'popoutTv'; trigger.type = 'button'; trigger.className = 'btn';
  trigger.title = 'Pop out TV'; trigger.setAttribute('aria-label', 'Pop out TV');
  trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M13 4H4v16h16v-9M14 3h7v7M21 3l-10 10"/></svg>';
  remote.append(trigger);
  const placeholder = document.createElement('section'); placeholder.className = 'tv-popout-placeholder'; placeholder.hidden = true;
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  const back = document.createElement('button'); back.type = 'button'; back.className = 'btn'; back.textContent = 'Return TV';
  placeholder.append(message, back); tv.before(placeholder);
  let floating = null, opening = false, poll, restoreFocus = true;
  const full = $('full');
  let transfer = 0, cancelRecovery = () => {};
  function moveTV(destination, before = null) {
    cancelRecovery();
    const ticket = ++transfer, source = video.getAttribute('src'), position = video.currentTime, wasPlaying = !video.paused;
    const recover = () => {
      if (ticket !== transfer || video.getAttribute('src') !== source) return;
      // Chromium can reset media state when a video is adopted into another document.
      // Restore this transport only; do not retune or replace its media source.
      if (Number.isFinite(position) && Math.abs(video.currentTime - position) > .05) {
        try { video.currentTime = position; } catch {}
      }
      if (wasPlaying && video.paused) video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', recover, {once:true});
    video.addEventListener('emptied', recover, {once:true});
    const remove = () => { video.removeEventListener('loadedmetadata', recover); video.removeEventListener('emptied', recover); };
    const expiry = setTimeout(remove, 30000);
    cancelRecovery = () => { clearTimeout(expiry); remove(); };
    destination.insertBefore(tv, before);
    recover();
  }
  function syncTheme() {
    if (!floating || floating.closed) return;
    floating.document.body.dataset.skin = document.body.dataset.skin;
  }
  new MutationObserver(syncTheme).observe(document.body, {attributes:true, attributeFilter:['data-skin']});
  function restore() {
    if (!floating) return;
    const old = floating; floating = null; clearInterval(poll);
    captionUI.closeMenu(false);
    tv.querySelectorAll('[popover]:popover-open').forEach(p => p.hidePopover());
    moveTV(placeholder.parentNode, placeholder.nextSibling); placeholder.hidden = true;
    document.body.classList.remove('tv-is-floating');
    trigger.removeAttribute('aria-pressed'); full.disabled = false; full.title = 'Fullscreen';
    window.dispatchEvent(new Event('resize'));
    if (restoreFocus) trigger.focus({preventScroll:true});
    if (!old.closed) old.close();
  }
  function close() { restore(); }
  async function open() {
    if (opening) return;
    if (floating && !floating.closed) { floating.focus(); return; }
    opening = true;
    let target;
    const pinned = !!window.documentPictureInPicture?.requestWindow;
    try {
      if (document.body.classList.contains('player-fullscreen')) throw Error('Leave fullscreen before popping out the TV.');
      if (pinned) target = await window.documentPictureInPicture.requestWindow({width:640,height:600});
      else target = window.open('about:blank','rabbit-ears-tv','popup=yes,width=640,height=600,resizable=yes,scrollbars=yes');
      if (!target) throw Error('Allow pop-ups for Rabbit Ears, then try again.');
      const doc = target.document;
      doc.title = 'Rabbit Ears · TV';
      const base = doc.createElement('base'); base.href = document.baseURI; doc.head.append(base);
      for (const sheet of document.styleSheets) {
        try {
          const style = doc.createElement('style');
          style.textContent = Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
          doc.head.append(style);
        } catch {
          // Cross-origin font styles cannot be read; request their absolute URL.
          if (sheet.href) { const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = sheet.href; doc.head.append(link); }
        }
      }
      const viewport = doc.createElement('meta'); viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1'; doc.head.append(viewport);
      doc.body.className = 'tv-popout-window'; doc.body.dataset.mode = 'tv'; doc.body.dataset.tvPage = 'channel';
      floating = target; syncTheme();
      captionUI.closeMenu(false);
      tv.querySelectorAll('[popover]:popover-open').forEach(p => p.hidePopover());
      const bar = doc.createElement('div'); bar.className = 'popout-toolbar';
      const label = doc.createElement('span'); label.textContent = pinned ? 'RABBIT EARS · FLOATING TV' : 'RABBIT EARS · TV WINDOW';
      const returnButton = doc.createElement('button'); returnButton.className = 'btn'; returnButton.textContent = 'Return TV'; returnButton.onclick = close;
      bar.append(label, returnButton); doc.body.append(bar); moveTV(doc.body);
      message.textContent = pinned ? 'Your TV is playing in a floating window. Keep this tab open.' : 'Your TV is in a separate window. Keep this tab open; this browser cannot pin the bezel above other windows.';
      placeholder.hidden = false; document.body.classList.add('tv-is-floating');
      trigger.setAttribute('aria-pressed','true');
      full.disabled = true; full.title = 'Return TV to use fullscreen';
      doc.addEventListener('pointerdown', e => {
        const menu = doc.getElementById('caption-options');
        if (menu && !menu.hidden && !menu.contains(e.target) && !e.target.closest('#cc,[data-remote="cc"]')) captionUI.closeMenu(false);
      });
      doc.addEventListener('keydown', e => {
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); $('pause').click(); }
      });
      target.addEventListener('pagehide', restore, {once:true});
      // Ordinary pop-ups can close without a usable pagehide event.
      poll = setInterval(() => { if (floating?.closed) restore(); }, 500);
      target.focus(); target.dispatchEvent(new Event('resize'));
    } catch (error) {
      if (target && !floating) target.close();
      if (floating) restore();
      message.textContent = error.message || 'Could not open the TV window. Try again.';
      placeholder.hidden = false;
    } finally { opening = false; }
  }
  trigger.onclick = open; back.onclick = () => { if (floating) close(); else placeholder.hidden = true; };
  window.RETVPopout = {open, close, get active(){return !!floating && !floating.closed;}, get document(){return floating?.document;}};
  window.addEventListener('pagehide', () => { restoreFocus = false; close(); });
})();
