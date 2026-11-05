// Builds catalog.json: for every built-in channel, its pool of playable videos with the file,
// length, title and year the page needs. With this file the page can draw the whole TV guide
// at once instead of looking up hundreds of videos at the Internet Archive one by one.
//
// Channels are read from index.html (the SAFE filter and the BUILT_IN list), so they're only
// defined in one place. Video details already in the previous catalog.json are reused, so after
// the first run only newly popular videos get looked up.
//
// Run: node scripts/build-catalog.mjs   (Node 18+; no packages needed)

import { readFile, writeFile } from "node:fs/promises";

const POOL = 300;          // most-downloaded matches kept per channel
const CONCURRENCY = 6;     // the Archive slows down badly when flooded
const UA = "RabbitEarsCatalog/1.0 (+https://github.com/therabbitearsproject-stack/rabbit-ears)";

// ---- channels, straight from index.html ----
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const safeSrc = html.match(/^const SAFE = `[^`]*`;$/m)?.[0];
const listStart = html.indexOf("const BUILT_IN = [");
const listEnd = html.indexOf("\n];", listStart);
if (!safeSrc || listStart < 0 || listEnd < 0) throw new Error("couldn't find SAFE / BUILT_IN in index.html");
const BUILT_IN = new Function(`${safeSrc}\n${html.slice(listStart, listEnd + 3)}\nreturn BUILT_IN;`)();
console.log(`${BUILT_IN.length} channels`);

// ---- previous catalog, for reuse ----
let prev = { meta: {} };
try { prev = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8")); } catch {}
const known = new Map(); // id -> row (or null when the id had no playable video)
for (const rows of Object.values(prev.pools || {})) for (const r of rows) known.set(r[0], r);
for (const id of prev.unplayable || []) known.set(id, null);

// ---- helpers mirroring the page's own logic ----
function parseLen(v) {
  if (v == null) return 0;
  const s = String(v);
  if (s.includes(":")) return s.split(":").reduce((a, p) => a * 60 + parseFloat(p || 0), 0);
  return parseFloat(s) || 0;
}
async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch {}
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error("failed: " + url);
}
async function videoRow(id) {
  const d = await getJSON("https://archive.org/metadata/" + encodeURIComponent(id));
  const files = (d?.files || []).filter(f => /\.mp4$/i.test(f.name) && parseLen(f.length) > 5);
  files.sort((a, b) => (/h\.264/i.test(b.format) ? 1 : 0) - (/h\.264/i.test(a.format) ? 1 : 0) || a.name.localeCompare(b.name));
  const f = files[0];
  if (!f) return null;
  const title = String([].concat(d.metadata?.title || id)[0]);
  const year = String([].concat(d.metadata?.year || d.metadata?.date || "")[0]).slice(0, 4);
  return [id, f.name, Math.round(parseLen(f.length) * 10) / 10, title, year];
}
async function pool(fn, items) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// ---- build ----
const pools = {}, unplayable = new Set();
let looked = 0, reused = 0, failed = 0;
for (const ch of BUILT_IN) {
  const url = "https://archive.org/advancedsearch.php?q=" + encodeURIComponent(`(${ch.q}) AND mediatype:movies`) +
              `&fl[]=identifier&rows=${POOL}&sort[]=downloads+desc&output=json`;
  let ids;
  try { ids = (await getJSON(url)).response.docs.map(d => d.identifier); }
  catch (e) {
    // Keep yesterday's pool rather than emptying the channel.
    if (prev.pools?.[ch.q]) { pools[ch.q] = prev.pools[ch.q]; console.log(`! ${ch.name}: search failed, kept old pool`); }
    else console.log(`! ${ch.name}: search failed`);
    continue;
  }
  const rows = await pool(async id => {
    if (known.has(id)) { reused++; return known.get(id); }
    looked++;
    try { const r = await videoRow(id); known.set(id, r); return r; }
    catch { failed++; return undefined; } // unknown this run; not marked unplayable
  }, ids);
  ids.forEach((id, i) => { if (rows[i] === null) unplayable.add(id); });
  pools[ch.q] = rows.filter(Boolean);
  console.log(`${ch.name}: ${pools[ch.q].length}/${ids.length} playable`);
}

const catalog = { generated: new Date().toISOString(), pools, unplayable: [...unplayable] };
await writeFile(new URL("../catalog.json", import.meta.url), JSON.stringify(catalog));
console.log(`done: ${looked} looked up, ${reused} reused, ${failed} failed`);
