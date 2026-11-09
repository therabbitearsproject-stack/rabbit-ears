// Builds the search-engine pages: one page per channel (/channels/<slug>/), one per game
// (/games/<slug>/), an index for each, and sitemap.xml listing all of them.
// Pure function: no file or network access, so it runs the same in Node (scripts/build-pages.mjs,
// during the publish workflow) and in a browser (for previewing).

const ORIGIN = "https://rabbit-ears.stream";
const MAX_SHOWS = 40, MAX_RELATED = 12;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const slugify = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";

// Archive titles carry upload noise ("[1080p]", "VHS rip", file names). Keep the readable part.
const NOISE = /\b(\d{3,4}p|[48]k|hd|sd|dvd\d*|bd|blu-?ray|rip|ripped|vhs ?rip|iso|mkv|mp4|avi|x ?26[45]|hevc|upscaled?|remastered|full (movie|episode|show)|dvd-?r|woc)\b/gi;
export function cleanTitle(t) {
  let s = String(t || "").replace(/\uFFFD/g, " ").replace(/_/g, " ").replace(/\.(mp4|mkv|avi|mpe?g|ogv|webm)$/i, "");
  s = s.replace(/[\[(][^\])]*\b(\d{3,4}p|rip|dvd|vhs|hd|upscale|iso|mkv|esp|spanish|latino)\b[^\])]*[\])]/gi, "");
  s = s.replace(NOISE, "").replace(/\s*[-–|:]\s*$/, "").replace(/\s{2,}/g, " ").replace(/^[\s\-–|:]+/, "").trim();
  return s.length > 90 ? s.slice(0, 87).replace(/\s+\S*$/, "") + "…" : s;
}
// Titles that shouldn't be advertised on a public page even when the tape itself is harmless.
const ADULT = /\b(sex|sexy|sexual|nude|nudity|naked|erotic|erotica|porn|playboy|penthouse|strip|stripper|striptease|xxx|fetish|bikini|lingerie|topless|hustler|swimsuit|burlesque|uncensored|unrated|hentai|harem)\b/i;
const usable = t => t && /[a-z]{3}/i.test(t) && !/\?{3}/.test(t) && !ADULT.test(t);

const STYLE = `
:root { --bg: #120e0b; --card: #1d1712; --line: #3a2c20; --ink: #efe6d6; --soft: #b9ab94; --amber: #ffb648; --green: #8dffb4; }
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(120% 60% at 20% 0%, #2c1f14, var(--bg) 60%) fixed; background-color: var(--bg); color: var(--ink);
  font: 17px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--amber); }
.wrap { max-width: 920px; margin: 0 auto; padding: 20px 16px 48px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
.brand { font-weight: 800; font-size: 22px; letter-spacing: -.02em; color: var(--ink); text-decoration: none; }
.brand span { color: var(--amber); }
.nav a { margin-left: 14px; font-size: 15px; }
.hero { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 24px; align-items: center; background: var(--card);
  border: 2px solid var(--line); border-radius: 20px; padding: 20px; }
.hero img { width: 100%; height: auto; display: block; border-radius: 12px; }
.hero .art { background: color-mix(in srgb, var(--accent, #3a2c20) 35%, #1d1712); border-radius: 14px; padding: 10px; }
.kicker { font: 600 14px/1.2 ui-monospace, monospace; color: var(--green); letter-spacing: .06em; text-transform: uppercase; margin: 0 0 6px; }
h1 { margin: 0 0 8px; font-size: clamp(28px, 6vw, 44px); line-height: 1.05; letter-spacing: -.03em; }
.lede { margin: 0 0 16px; color: var(--soft); }
.go { display: inline-block; background: var(--amber); color: #1a1210; font-weight: 800; text-decoration: none; padding: 12px 20px;
  border-radius: 999px; }
.go:hover { filter: brightness(1.08); }
h2 { margin: 34px 0 10px; font-size: 22px; }
.shows { columns: 2 280px; column-gap: 28px; padding-left: 20px; margin: 0; color: var(--soft); }
.shows li { break-inside: avoid; margin: 0 0 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(170px, 42vw), 1fr)); gap: 12px; padding: 0; margin: 0; list-style: none; }
.grid a { display: flex; flex-direction: column; gap: 6px; background: var(--card); border: 2px solid var(--line); border-radius: 14px;
  padding: 10px; text-decoration: none; color: var(--ink); height: 100%; }
.grid a:hover { border-color: var(--amber); }
.grid img { width: 100%; height: auto; flex: none; aspect-ratio: 3/2; object-fit: contain; border-radius: 8px; background: #0d0a08; }
.grid small { color: var(--soft); }
.band { margin-top: 26px; }
p.note { color: var(--soft); font-size: 15px; }
footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--soft); font-size: 14px; }
@media (max-width: 640px) { .hero { grid-template-columns: minmax(0, 1fr); padding: 14px; } .nav a { margin-left: 8px; font-size: 14px; } .brand { font-size: 19px; } .wrap { padding: 16px 16px 40px; } }
html { overflow-x: hidden; }
`;

function page({ path, title, description, image, imageAlt, jsonld, body }) {
  const url = ORIGIN + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rabbit-Ears.stream">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#120e0b">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="/">Rabbit-Ears<span>.stream</span></a>
<nav class="nav"><a href="/channels/">Channels</a><a href="/games/">Games</a><a href="/#radio">Radio</a></nav></header>
${body}
<footer>Rabbit-Ears.stream plays forgotten TV from the <a href="https://archive.org" rel="noopener">Internet Archive</a> on synchronized
24/7 channels, plus live radio and classic Flash games. Free, no sign-up. <a href="https://archive.org/donate" rel="noopener">♥ Donate to the Archive</a></footer>
</div>
</body>
</html>
`;
}

// channels: [{ name, desc, no, icon, q }] in channel order; bands: [[from, name]];
// logos: manifest.json; pools: catalog.pools (q -> rows); games: games.json.
export function buildPages({ channels, bands, logos = {}, pools = {}, games = { shelves: [], games: {} }, blocked = new Set() }) {
  const isBlocked = (id, ch) => blocked.has(id) || blocked.has(id + "@" + ch.name);
  const out = [];
  const bandOf = no => bands.filter(([from]) => no >= from).pop()?.[1] || "";
  const logoUrl = ch => logos[ch.name]?.src ? ORIGIN + "/" + logos[ch.name].src : ORIGIN + "/og.jpg";

  // ---- channels ----
  const chSlug = new Map();
  for (const ch of channels) chSlug.set(ch.name, slugify(ch.name));
  for (const ch of channels) {
    const slug = chSlug.get(ch.name), path = `/channels/${slug}/`, band = bandOf(ch.no);
    const seen = new Set(), shows = [];
    for (const row of pools[ch.q] || []) {
      if (isBlocked(row[0], ch) || isBlocked(row[6] || row[0], ch)) continue;
      const t = cleanTitle(row[3]); const k = t.toLowerCase();
      if (!usable(t) || seen.has(k)) continue;
      seen.add(k); shows.push(t);
      if (shows.length >= MAX_SHOWS) break;
    }
    const neighbors = channels.filter(c => c !== ch && bandOf(c.no) === band);
    const title = `${ch.name} — Channel ${ch.no} on Rabbit-Ears.stream`;
    const description = `Watch ${ch.name} (${ch.desc}) free, live around the clock on channel ${ch.no}. Everyone tuned in sees the same moment, like real TV.`;
    out.push({ path, html: page({
      path, title, description, image: logoUrl(ch), imageAlt: `${ch.name} channel logo`,
      jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: ORIGIN + path,
        isPartOf: { "@type": "WebSite", name: "Rabbit-Ears.stream", url: ORIGIN + "/" },
        breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Channels", item: ORIGIN + "/channels/" },
          { "@type": "ListItem", position: 2, name: ch.name, item: ORIGIN + path }] } },
      body: `<section class="hero" style="--accent:${esc(logos[ch.name]?.accent || "#3a2c20")}">
  <div class="art"><img src="${esc(logoUrl(ch))}" alt="${esc(ch.name)} logo" width="480" height="320"></div>
  <div><p class="kicker">Channel ${ch.no} · ${esc(band)}</p><h1>${esc(ch.icon)} ${esc(ch.name)}</h1>
  <p class="lede">${esc(ch.desc)}. On the air 24/7, synchronized for everyone watching, with vintage commercial breaks between shows.</p>
  <a class="go" href="/#ch${ch.no}">▶ Watch channel ${ch.no} live</a></div>
</section>
${shows.length ? `<h2>On ${esc(ch.name)}</h2>
<p class="note">A sample of what airs on this channel. Programs stream from the Internet Archive.</p>
<ul class="shows">${shows.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
${neighbors.length ? `<h2>More ${esc(band)} channels</h2>
<ul class="grid">${neighbors.map(c => `<li><a href="/channels/${chSlug.get(c.name)}/"><img src="${esc(logoUrl(c))}" alt="" loading="lazy" width="480" height="320"><b>${c.no} ${esc(c.name)}</b><small>${esc(c.desc)}</small></a></li>`).join("")}</ul>` : ""}`,
    }) });
  }
  // channel index, grouped by band
  const byBand = bands.map(([from, name], i) => [name, channels.filter(c => c.no >= from && c.no < (bands[i + 1]?.[0] ?? 1e9))]).filter(([, cs]) => cs.length);
  {
    const path = "/channels/", title = `All ${channels.length} channels — Rabbit-Ears.stream`;
    const description = `Every channel on Rabbit-Ears.stream: classic TV, cartoons, movies, anime, sports, music and more, streaming free 24/7 from the Internet Archive.`;
    out.push({ path, html: page({ path, title, description, image: ORIGIN + "/og.jpg", imageAlt: "Rabbit-Ears.stream",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: ORIGIN + path },
      body: `<p class="kicker">Channel guide</p><h1>All ${channels.length} channels</h1><p class="lede">${esc(description)}</p>
<a class="go" href="/#tv">▶ Open the live TV guide</a>
${byBand.map(([name, cs]) => `<section class="band"><h2>${esc(name)}</h2><ul class="grid">${cs.map(c => `<li><a href="/channels/${chSlug.get(c.name)}/"><img src="${esc(logoUrl(c))}" alt="" loading="lazy" width="480" height="320"><b>${c.no} ${esc(c.name)}</b><small>${esc(c.desc)}</small></a></li>`).join("")}</ul></section>`).join("")}` }) });
  }

  // ---- games ----
  const shelvesOf = new Map();
  for (const s of games.shelves || []) for (const id of s.ids || []) {
    if (!shelvesOf.has(id)) shelvesOf.set(id, []);
    shelvesOf.get(id).push(s.name);
  }
  const gameList = [], usedSlugs = new Set();
  for (const [id, row] of Object.entries(games.games || {})) {
    const name = cleanTitle(row[1]);
    if (!usable(name)) continue;
    let slug = slugify(name);
    if (usedSlugs.has(slug)) slug = slugify(name + "-" + id);
    usedSlugs.add(slug);
    gameList.push({ id, name, year: row[2] || "", slug, shelves: shelvesOf.get(id) || [] });
  }
  const thumb = id => "https://archive.org/services/img/" + encodeURIComponent(id);
  const gameCard = g => `<li><a href="/games/${g.slug}/"><img src="${esc(thumb(g.id))}" alt="" loading="lazy" width="180" height="120" onerror="this.style.visibility='hidden'"><b>${esc(g.name)}</b>${g.year ? `<small>${esc(g.year)}</small>` : ""}</a></li>`;
  for (const g of gameList) {
    const path = `/games/${g.slug}/`;
    const shelf = g.shelves.find(s => s !== "Most played") || g.shelves[0];
    const related = gameList.filter(o => o !== g && shelf && o.shelves.includes(shelf)).slice(0, MAX_RELATED);
    const title = `Play ${g.name} free online — Rabbit-Ears.stream`;
    const description = `Play ${g.name}${g.year ? ` (${g.year})` : ""}, the classic Flash game, free in your browser. No plugin or download needed; it runs with the Ruffle emulator.`;
    out.push({ path, html: page({
      path, title, description, image: thumb(g.id), imageAlt: g.name,
      jsonld: { "@context": "https://schema.org", "@type": "VideoGame", name: g.name, url: ORIGIN + path, description,
        gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", playMode: "SinglePlayer",
        ...(g.year ? { datePublished: g.year } : {}), image: thumb(g.id),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
      body: `<section class="hero">
  <div class="art"><img src="${esc(thumb(g.id))}" alt="${esc(g.name)}" width="300" height="225"></div>
  <div><p class="kicker">Flash game${g.year ? " · " + esc(g.year) : ""}${shelf ? " · " + esc(shelf) : ""}</p><h1>${esc(g.name)}</h1>
  <p class="lede">Play ${esc(g.name)} free, right in your browser. Rabbit-Ears.stream runs the original Flash file from the Internet Archive's
  collection with Ruffle, so there's nothing to install.</p>
  <a class="go" href="/#play=${encodeURIComponent(g.id)}">▶ Play ${esc(g.name)}</a></div>
</section>
${related.length ? `<h2>More ${esc(shelf)} games</h2><ul class="grid">${related.map(gameCard).join("")}</ul>` : ""}`,
    }) });
  }
  {
    const path = "/games/", title = `${gameList.length} classic Flash games to play free — Rabbit-Ears.stream`;
    const description = `Line Rider, Bloxorz, QWOP, Papa's Pizzeria, Bloons and hundreds more classic Flash games, free in your browser with no plugin.`;
    const shelfNames = (games.shelves || []).map(s => s.name);
    out.push({ path, html: page({ path, title, description, image: ORIGIN + "/og.jpg", imageAlt: "Rabbit-Ears.stream",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description, url: ORIGIN + path },
      body: `<p class="kicker">Games</p><h1>${gameList.length} classic Flash games</h1><p class="lede">${esc(description)}</p>
<a class="go" href="/#games">▶ Open the arcade</a>
${shelfNames.map(n => { const gs = gameList.filter(g => g.shelves[0] === n); return gs.length ? `<section class="band"><h2>${esc(n)}</h2><ul class="grid">${gs.map(gameCard).join("")}</ul></section>` : ""; }).join("")}
${(() => { const rest = gameList.filter(g => !g.shelves.length); return rest.length ? `<section class="band"><h2>More games</h2><ul class="grid">${rest.map(gameCard).join("")}</ul></section>` : ""; })()}` }) });
  }

  // ---- sitemap ----
  const today = new Date().toISOString().slice(0, 10);
  const urls = ["/", ...out.map(p => p.path)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod><changefreq>${u === "/" ? "daily" : "weekly"}</changefreq></url>`).join("\n")}
</urlset>
`;
  return { pages: out, sitemap };
}

// Reads the channel list out of index.html the same way scripts/build-catalog.mjs does.
export function channelsFromIndex(html) {
  const grab = (start, end) => { const i = html.indexOf(start); const j = html.indexOf(end, i); if (i < 0 || j < 0) throw new Error("couldn't find " + start); return html.slice(i, j + end.length); };
  const safe = grab("const SAFE =", "`;");
  const list = grab("const BUILT_IN = [", "\n];");
  const bands = grab("const BANDS =", "];");
  const lineup = grab("const LINEUP = {", "\n};");
  const blockedSrc = grab("const BLOCKED = new Set([", "\n]);");
  const { BUILT_IN, BANDS, LINEUP, BLOCKED } = new Function(`${safe}\n${list}\n${bands}\n${lineup}\n${blockedSrc}\nreturn { BUILT_IN, BANDS, LINEUP, BLOCKED };`)();
  const channels = BUILT_IN.map(c => { const [no, icon] = LINEUP[c.name] || [99, "📺"]; return { name: c.name, desc: c.desc, q: c.q, no, icon }; })
    .sort((a, b) => a.no - b.no);
  return { channels, bands: BANDS.filter(([from]) => from < 100), blocked: BLOCKED };
}
