// Adds IMDb ids to catalog.json (catalog.imdb = { videoId: "tt…" }) so the site can link the show
// or film that's playing to its IMDb page. Run after build-catalog.mjs.
//
// Titles are matched through Wikidata (see imdb-match.mjs). Results, found or not, are remembered in
// scripts/imdb-cache.json and reused, so each title is looked up once; misses are retried after 60
// days. Each run looks up at most LIMIT new titles, so the first fill takes a few nights.
// .github/workflows/imdb.yml does the lookups; the site publish runs this with IMDB_LIMIT=0 to only
// copy the saved matches into catalog.json.
import { readFile, writeFile } from "node:fs/promises";
import { siteCode } from "./tv-feed.mjs";
import { parseTitle, cacheKey, entityYears, entityImdb, kindOf, pick, preferFor } from "./imdb-match.mjs";

const LIMIT = Number(process.env.IMDB_LIMIT || 2500);
const RETRY_DAYS = 60;
const UA = "RabbitEarsCatalog/1.0 (https://rabbit-ears.stream)";
const API = "https://www.wikidata.org/w/api.php?format=json&maxlag=5&";
const read = (p, json = true) => readFile(new URL("../" + p, import.meta.url), "utf8").then(t => json ? JSON.parse(t) : t);

const [html, catalog, commercialTiming, mediaCompatibility] = await Promise.all([
  read("index.html", false), read("catalog.json"), read("commercial-timing.js", false), read("media-compatibility.js", false),
]);
let cache = {};
try { cache = await read("scripts/imdb-cache.json"); } catch {}
const S = siteCode({ html, catalog, commercialTiming, mediaCompatibility });

// Every video on a film or TV channel, with the search its title makes.
const searches = new Map();   // cacheKey -> { s: search, prefer }
const videoKey = {};          // video id -> cacheKey
const band = no => S.BANDS.filter(([f]) => no >= f).pop()?.[1] || "";
for (const ch of S.BUILT_IN) {
  if (S.NO_IMDB.has(ch.name)) continue;
  const prefer = preferFor(band(ch.no));
  for (const row of catalog.pools?.[ch.q] || []) {
    const m = S.tidy(S.rowMedia(row));
    const s = parseTitle(m.title, m.year, prefer);
    if (!s) continue;
    const k = cacheKey(s, prefer);
    searches.set(k, { s, prefer });
    videoKey[m.id] = k;
  }
}

const today = new Date().toISOString().slice(0, 10);
const stale = ([, day]) => (Date.parse(today) - Date.parse(day)) / 864e5 > RETRY_DAYS;
const todo = [...searches.keys()].filter(k => !cache[k] || (!cache[k][0] && stale(cache[k]))).slice(0, LIMIT);

async function api(params) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(API + params, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) throw new Error("busy " + r.status);
      const d = await r.json();
      if (d.error?.code === "maxlag") throw new Error("maxlag");
      return d;
    } catch { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); }
  }
  throw new Error("Wikidata unavailable");
}

async function lookup({ s, prefer }) {
  const found = await api("action=wbsearchentities&type=item&language=en&uselang=en&limit=7&search=" + encodeURIComponent(s.q));
  const ids = (found.search || []).map(x => x.id);
  if (!ids.length) return "";
  const ents = (await api("action=wbgetentities&props=claims|labels|aliases|descriptions&languages=en&ids=" + ids.join("|"))).entities || {};
  const candidates = Object.values(ents).map(e => ({
    imdb: entityImdb(e), years: entityYears(e), kind: kindOf(e.descriptions?.en?.value),
    labels: [e.labels?.en?.value, ...(e.aliases?.en || []).map(a => a.value)].filter(Boolean),
  })).filter(c => c.imdb);
  return pick(s, candidates, prefer);
}

let done = 0, hits = 0, failed = 0;
const started = Date.now();
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length && Date.now() - started < 25 * 60e3) {
    const k = queue.shift();
    try { const id = await lookup(searches.get(k)); cache[k] = [id, today]; done++; if (id) hits++; }
    catch { failed++; }
  }
}));

// Write the matches into the catalog, keyed by video id.
catalog.imdb = {};
for (const [vid, k] of Object.entries(videoKey)) if (cache[k]?.[0]) catalog.imdb[vid] = cache[k][0];
await writeFile(new URL("../catalog.json", import.meta.url), JSON.stringify(catalog));
if (LIMIT > 0) await writeFile(new URL("imdb-cache.json", import.meta.url), JSON.stringify(cache, Object.keys(cache).sort(), 0).replace(/\],"/g, '],\n"'));

const known = [...searches.keys()].filter(k => cache[k]).length;
console.log(`🎬 IMDb: looked up ${done} titles (${hits} matched, ${failed} failed); ${known}/${searches.size} titles checked so far; ${Object.keys(catalog.imdb).length} videos linked`);
