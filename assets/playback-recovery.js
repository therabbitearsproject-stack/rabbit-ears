// Reconnect the current broadcast without reloading the page or changing settings.
const REPlaybackRecovery = (() => {
  function create({ read, retry, waiting = () => {}, now = Date.now,
    later = setTimeout, cancel = clearTimeout, every = setInterval, stopEvery = clearInterval }) {
    let timer = null, busy = false, needed = false, attempts = 0, stopped = false;
    let identity, lastTime, progressAt = now();
    const eligible = s => s.active && s.online !== false;
    const clear = () => { if (timer !== null) cancel(timer); timer = null; };
    function adopt(s) { identity = s.identity; lastTime = s.time; progressAt = now(); }
    function recovered() {
      clear(); needed = false; attempts = 0; adopt(read());
    }
    function arm(immediate = false) {
      if (stopped || busy || timer !== null || !needed || !eligible(read())) return;
      const expected = read().identity;
      const delay = immediate ? 0 : Math.min(30000, 5000 * 2 ** Math.min(attempts, 3));
      waiting(delay);
      timer = later(async () => {
        timer = null;
        const current = read();
        if (!eligible(current) || current.identity !== expected) return;
        busy = true; attempts++; needed = false;
        try {
          const applied = await retry(current);
          // A user channel/presentation change wins over a late recovery request.
          if (applied === false) { needed = false; attempts = 0; }
        } catch { needed = true; }
        finally {
          busy = false; adopt(read());
          if (needed) arm();
        }
      }, delay);
    }
    function failed() {
      if (stopped) return;
      const s = read();
      if (s.identity !== identity && !busy) { clear(); attempts = 0; adopt(s); }
      needed = true; arm();
    }
    function check() {
      if (stopped) return;
      const s = read();
      if (s.identity !== identity && !busy) { recovered(); return; }
      if (!s.active) { clear(); progressAt = now(); lastTime = s.time; return; }
      if (s.online === false) { clear(); needed = true; return; }
      if (s.playing && s.ready >= 3 && !s.paused && !s.seeking && Number.isFinite(s.time) && Number.isFinite(lastTime) && Math.abs(s.time - lastTime) > .2) {
        recovered(); return;
      }
      lastTime = s.time;
      // Includes startup/tuning, an unexpected pause, a stalled seek and mid-show buffering.
      if (now() - progressAt >= 30000) failed();
      if (needed) arm();
    }
    function wake() {
      const s = read();
      if (!eligible(s)) return;
      if (needed || !s.playing || s.paused || s.ready < 2 || now() - progressAt >= 30000) {
        needed = true; clear(); arm(true);
      } else check();
    }
    adopt(read());
    const interval = every(check, 5000);
    return { failed, recovered, check, wake,
      stop() { stopped = true; clear(); stopEvery(interval); },
      state: () => ({ needed, attempts, busy, scheduled: timer !== null }) };
  }
  return { create };
})();
if (typeof window !== "undefined") window.REPlaybackRecovery = REPlaybackRecovery;
