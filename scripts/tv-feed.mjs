// Schedule files for the TV apps (Roku and others that can't run the website's own code).
//
// The website works out every channel's lineup in the browser. TV apps get the same lineup ready-made:
// this takes the schedule code straight out of index.html (the part between "---------- Channels" and
// "---------- UI"), runs it against catalog.json, and writes out what airs on each channel for the next
// couple of days. Because it's the website's own code, the apps show exactly what the website shows.
//
// Pure function so it runs in Node (scripts/build-tv-feed.mjs) and in a browser for testing.

const SITE = "https://rabbit-ears.stream/";
const HOURS = 54;   // the feed is rebuilt at least daily; this leaves a day's slack if a build fails

// Pull a top-level `const NAME = (() => {...})();` module (commercial-timing.js, media-compatibility.js).
const loadModule = (src, name) => new Function(src + "\nreturn " + name + ";")();

export function scheduleCode(html) {
  const from = html.indexOf("// ---------- Channels ----------");
  const to = html.indexOf("// ---------- UI ----------");
  if (from < 0 || to < from) throw new Error("Couldn't find the schedule code in index.html");
  return html.slice(from, to);
}

// The website's channel and schedule code, running against catalog.json with no network.
// Also used by scripts/build-imdb.mjs for the site's own title cleanup (tidy) and channel list.
export function siteCode({ html, catalog, commercialTiming, mediaCompatibility }) {
  const CommercialTiming = loadModule(commercialTiming, "CommercialTiming");
  const MediaCompatibility = loadModule(mediaCompatibility, "MediaCompatibility");
  const noFetch = () => Promise.reject(new Error("offline: only catalog.json is used"));
  // The schedule code reads `catalog`, `fetch` and `localStorage`; give it the catalog and nothing else.
  const run = new Function("CommercialTiming", "MediaCompatibility", "fetch", "localStorage", "__catalog",
    scheduleCode(html) + `
    catalog = __catalog;
    return { BUILT_IN, BANDS, NO_IMDB, lineup, fileUrl, EPOCH, tidy, rowMedia, blocked,
      programKeys: typeof programKeys === 'function' ? programKeys : undefined,
      sameProgram: typeof sameProgram === 'function' ? sameProgram : undefined,
      distinctPrograms: typeof distinctPrograms === 'function' ? distinctPrograms : undefined };`);
  return run(CommercialTiming, MediaCompatibility, noFetch, undefined, catalog);
}

// Returns { index, channels: { [no]: feed } } for every built-in channel.
export async function buildTvFeed({ html, catalog, commercialTiming, mediaCompatibility, now = Date.now() / 1000, hours = HOURS }) {
  const S = siteCode({ html, catalog, commercialTiming, mediaCompatibility });
  const band = no => S.BANDS.filter(([f]) => no >= f).pop()?.[1] || "";
  const url = m => { const u = S.fileUrl(m); return /^https?:/.test(u) ? u : SITE + u.replace(/^\.?\//, ""); };
  const round = x => Math.round(x * 10) / 10;

  const until = now + hours * 3600, index = [], channels = {}, failed = [];
  for (const ch of S.BUILT_IN) {
    const items = [];
    try {
      let t = now;
      while (t < until) {
        const batch = (await S.lineup(ch, t, 60)).filter(p => !items.length || p.start >= items[items.length - 1].s + 1);
        if (!batch.length) break;
        for (const p of batch) {
          if (p.start >= until) break;
          // Parts are [from, to, url, offset]: from/to count seconds since v (when the show's clock
          // read 0:00); while elapsed is in [from, to) play url at offset + (elapsed - from).
          const parts = p.timeline
            ? p.timeline.segments.map(s => [round(s.start), round(s.end), url(s.media), round(s.offset)])
            : [[0, round(p.end - p.v0), url(p.m), 0]];
          items.push({ s: Math.round(p.start), e: Math.round(p.end), v: Math.round(p.v0), t: p.m.title || "", y: String(p.m.year || "").slice(0, 4), p: parts });
        }
        const next = items[items.length - 1].e;
        if (next <= t) break;
        t = next;
      }
    } catch (e) { failed.push(ch.name + ": " + e.message); }
    if (!items.length) continue;
    index.push({ no: ch.no, name: ch.name, desc: ch.desc || "", icon: ch.icon || "", band: band(ch.no) });
    channels[ch.no] = { no: ch.no, name: ch.name, items };
  }
  return { index: { generated: new Date(now * 1000).toISOString(), until: Math.round(until), channels: index }, channels, failed };
}
