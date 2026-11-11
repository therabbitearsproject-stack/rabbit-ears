/* One TV volume, shared by the normal remote and fullscreen controls. */
(() => {
  const video = document.getElementById('vid');
  const controls = [];
  for (const [selector, name] of [['#tvView .remote', 'TV volume'], ['.fullscreen-remote', 'Fullscreen TV volume']]) {
    const remote = document.querySelector(selector);
    if (!remote) continue;
    const label = document.createElement('label'); label.className = 'tv-volume';
    const text = document.createElement('span'); text.textContent = 'Volume';
    const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1'; input.setAttribute('aria-label', name);
    const value = document.createElement('output');
    input.addEventListener('input', () => setTvVolume(Number(input.value) / 100));
    label.append(text, input, value); remote.append(label); controls.push({ input, value });
  }
  function sync() {
    for (const c of controls) {
      c.input.value = String(Math.round(video.volume * 100));
      c.value.textContent = video.muted ? 'Muted' : c.input.value + '%';
      c.input.setAttribute('aria-valuetext', c.input.value + ' percent' + (video.muted ? ', muted' : ''));
    }
  }
  video.addEventListener('volumechange', sync); sync();
})();
