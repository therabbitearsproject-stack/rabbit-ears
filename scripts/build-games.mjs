// Builds games.json: the shelves for the Games tab. Each game is a Flash file from the Internet
// Archive's Flash collection, played in the page with the Ruffle emulator and loaded through
// archive.org/cors/ (the Archive's download address that other websites are allowed to read).
//
// Shelves are Archive searches (most-downloaded first) plus a hand-picked, tested Classics shelf.
// Every search excludes adult, gory and prank content, and games viewers report are dropped.
// Game details already in the previous games.json are reused, so later runs only look up new games.
//
// Run: node scripts/build-games.mjs   (Node 18+; no packages needed)

import { readFile, writeFile } from "node:fs/promises";
import { STYLES, SHELF_STYLE, stylesFor } from "./game-styles.mjs";

const PER_SHELF = 60;
const CONCURRENCY = 6;
const UA = "RabbitEarsCatalog/1.0 (+https://github.com/therabbitearsproject-stack/rabbit-ears)";
const BASE = "collection:softwarelibrary_flash_games";

// Kept off every shelf: adult content, gore, shock/prank "games" (fake viruses, screamers) and
// hateful content. Archive tags are inconsistent, so titles are checked as well as subjects.
const BAD = `(nude OR nudity OR naked OR sex OR sexy OR porn OR hentai OR erotic OR nsfw OR strip OR stripper OR boobs OR breast OR bikini OR lingerie OR fetish OR adult OR "18+" OR xxx OR gore OR mutilate OR torture OR suicide OR shooting OR hitler OR nazi OR virus OR idiot OR screamer OR "scary maze" OR jumpscare OR rape OR drug OR drugs OR weed OR cocaine OR dating OR kissing OR "kiss" OR "hot girl" OR whack OR shit OR fuck OR flirt OR flirting OR sperm OR "saw game" OR blood OR bloody OR massacre OR "road of the dead" OR babe OR babes OR beer OR drunk OR "pico's school" OR "happy wheels" OR madness)`;
const SAFE_GAMES = ` AND NOT subject:${BAD} AND NOT title:${BAD}`;

// Hand-picked famous games, each tested to start in Ruffle. Game of the Day comes from this list.
const CLASSICS = [
  "bloxors", "flash_Line_Rider_2", "qwop_flash", "FPA-1", "portal_flash_version", "adobeflash-supermario63",
  "flash_age_of_war", "bloonstd2_202104", "learn_to_fly_2", "helicoptergame_flash", "cubefield_flash", "raft-wars",
  "flash_papaspizzeria", "papasfreezeria_202011", "robotunicornattack_flash", "stick-rpg-complete", "swords-and-sandals-2",
  "flash_alien_hominid", "tiq2_swf", "supersmashflash_swf", "etp_20200826", "mother_load", "desktop-tower-defence_flash",
  "snailbob_flash", "achievementflash", "this-is-the-only-level", "ducklife2worldchampion_flash", "nv-12", "tetris_20201126",
  "frogger_swf", "shopping-cart-hero", "bubble-shooter_swf", "super-mario-flash-2", "dragracerv3_202012",
  // Added November 2026, each tested in Ruffle.
  "2611-territory-war", "Example_flash13", "fireboy-and-watergirl-3-in-the-ice-temple",
  "fireboy-and-watergirl-4-in-the-crystal-temple", "gemcraft-1716", "2369-shift", "moto-x3m_202309", "sushi-cat-2",
  "ragdollcannon2_flash", "redremover_flash", "wonderputt-kongregate", "duck-life-4_20210406", "jacksmithflashgame",
  "sugarsugar_flash", "warfare-1917", "worlds-hardest-game", "penguin_diner", "tank-trouble_flash", "bloons-td-5_202205", "miniputt",
];

const SHELVES = [
  { name: "Classics", icon: "⭐", ids: CLASSICS },
  { name: "Most played", icon: "🔥", q: BASE },
  { name: "Puzzle & brain", icon: "🧩", q: `${BASE} AND (title:(puzzle OR quiz OR logic OR bloxorz OR tetris OR sudoku OR mahjong OR match OR bubble OR block OR blocks OR maze OR jigsaw OR solitaire OR chess OR "escape") OR subject:(puzzle OR logic OR quiz))` },
  { name: "Action & arcade", icon: "🕹️", q: `${BASE} AND (title:(defense OR defence OR shooter OR arcade OR space OR invaders OR asteroids OR runner OR ninja OR robot OR tank OR war OR battle OR zombie OR zombies OR castle OR fighter) OR subject:(action OR arcade OR shooter OR "tower defense"))` },
  { name: "Sports & racing", icon: "🏁", q: `${BASE} AND (title:(racer OR racing OR race OR football OR soccer OR basketball OR baseball OR "home run" OR golf OR skate OR bmx OR bowling OR hockey OR tennis OR snowboard OR kart OR drift) OR subject:(sports OR racing))` },
  { name: "Adventure & RPG", icon: "🗡️", q: `${BASE} AND (title:(rpg OR adventure OR quest OR dungeon OR hero OR legend OR kingdom OR "point and click") OR subject:(rpg OR adventure OR "point and click"))` },
  { name: "Cartoon tie-ins", icon: "📺", q: `${BASE} AND (title:(spongebob OR scooby OR powerpuff OR "dexter" OR "ben 10" OR "teen titans" OR "kim possible" OR "phineas" OR "avatar" OR simpsons OR "courage" OR "ed edd" OR "fairly oddparents" OR "danny phantom" OR "jimmy neutron") OR subject:("cartoon network" OR nickelodeon OR disney OR "pbs kids" OR "adult swim"))` },
];

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
// The item's main game file (name and size): the .swf named like the item, else the biggest .swf. Must match index.html.
function mainSwf(files, id) {
  const swfs = files.filter(f => /\.swf$/i.test(f.name));
  if (!swfs.length) return null;
  const stem = s => s.toLowerCase().replace(/^.*\//, "").replace(/\.swf$/, "").replace(/[^a-z0-9]/g, "");
  return swfs.find(f => stem(f.name) === stem(id)) || swfs.sort((a, b) => (+b.size || 0) - (+a.size || 0))[0];
}
const MAX_MB = 25; // bigger files take minutes to arrive from the Archive, so they stay off the shelves
async function gameRow(id) {
  const d = await getJSON("https://archive.org/metadata/" + encodeURIComponent(id));
  const f = mainSwf(d?.files || [], id);
  if (!f) return null;
  const mb = Math.round((+f.size || 0) / 1e5) / 10;
  if (mb > MAX_MB) return null;
  const file = f.name;
  const title = String([].concat(d.metadata?.title || id)[0]);
  const year = String([].concat(d.metadata?.year || d.metadata?.date || "")[0]).slice(0, 4);
  const blob = (title + " " + [].concat(d.metadata?.subject || []).join(" ")).toLowerCase();
  // A second check on the full tags, which the search can't always see.
  if (/\b(nude|naked|sex|sexy|porn|hentai|erotic|nsfw|stripper|fetish|gore|mutilat\w*|tortur\w*|suicide|hitler|nazi|screamer|rape|shit|fuck\w*|flirt\w*|sperm|whack your|pico's school|happy wheels|madness)\b/.test(blob)) return null;
  return [id, file, title, year, mb, stylesFor(id, d.metadata?.title, d.metadata?.subject, d.metadata?.description)];
}
async function pool(fn, items) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
  return out;
}

let prev = {};
try { prev = JSON.parse(await readFile(new URL("../games.json", import.meta.url), "utf8")); } catch {}
const known = new Map(Object.entries(prev.games || {}).map(([id, g]) => [id, [id, ...g]]));

// Viewer reports from the "Report this game" button: "not appropriate" twice or "won't play" three times.
let reports = {};
try { reports = (await getJSON("https://project-rabbitears-default-rtdb.firebaseio.com/reports.json")) || {}; } catch {}
const tally = {};
for (const r of Object.values(reports)) if (r?.id && r.ch === "Games") { const t = tally[r.id] ||= {}; t[r.reason] = (t[r.reason] || 0) + 1; }
const pulled = new Set(Object.keys(tally).filter(id => (tally[id].inappropriate || 0) >= 2 || (tally[id].broken || 0) >= 3));

const games = {}, shelves = [];
let looked = 0, reused = 0, failed = 0;
for (const s of SHELVES) {
  let ids = s.ids;
  if (!ids) {
    const url = "https://archive.org/advancedsearch.php?q=" + encodeURIComponent(s.q + SAFE_GAMES) +
                `&fl[]=identifier&rows=${PER_SHELF + 20}&sort[]=downloads+desc&output=json`;
    try { ids = (await getJSON(url)).response.docs.map(d => d.identifier); }
    catch { const old = (prev.shelves || []).find(p => p.name === s.name); ids = old?.ids || []; console.log(`! ${s.name}: search failed, kept old shelf`); }
  }
  const rows = await pool(async id => {
    if (pulled.has(id)) return null;
    // Rows from before styles existed (5 fields) are looked up again once.
    if (known.get(id)?.length >= 6) { reused++; return known.get(id); }
    looked++;
    try { const r = await gameRow(id); known.set(id, r); return r; } catch { failed++; return null; }
  }, ids);
  const keep = rows.filter(Boolean).slice(0, s.ids ? undefined : PER_SHELF);
  for (const [id, file, title, year, mb, styles] of keep) games[id] = [file, title, year, mb, styles];
  shelves.push({ name: s.name, icon: s.icon, ids: keep.map(r => r[0]) });
  console.log(`${s.icon} ${s.name}: ${keep.length} games`);
}

// Games with no style of their own take their search shelf's style (Puzzle & brain → Puzzle, …).
for (const s of shelves) if (SHELF_STYLE[s.name]) for (const id of s.ids) if (!games[id][4]?.length) games[id][4] = [SHELF_STYLE[s.name]];

// Every game on any shelf, in shelf order, so the style filter can look across all of them.
shelves.push({ name: "All games", icon: "🎮", ids: Object.keys(games) });
for (const s of STYLES) console.log(`${s.icon} ${s.name}: ${Object.values(games).filter(g => g[4]?.includes(s.key)).length}`);
console.log(`no style: ${Object.values(games).filter(g => !g[4]?.length).length}`);

await writeFile(new URL("../games.json", import.meta.url), JSON.stringify({ generated: new Date().toISOString(), styles: STYLES, shelves, games }));
console.log(`games: ${Object.keys(games).length} total; ${looked} looked up, ${reused} reused, ${failed} failed; ${pulled.size} pulled by reports`);
