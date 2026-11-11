// Matching the shows and films on the channels to their IMDb pages, through Wikidata (which lists
// the IMDb id, property P345, for most films and series). Pure functions: scripts/build-imdb.mjs
// does the lookups, scripts/imdb-match.test.mjs tests these.
//
// Only confident matches count: the title has to equal a Wikidata label or alias exactly (after
// tidying), and when the year is known, exactly one match may be within a year of it. Anything less
// sure gets no direct link (the site offers an IMDb search instead).

export const norm = s => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");

// Compilations, clip reels and collections aren't one film or show.
const JUNK = /\b(collection|compilation|commercials?|trailers?|promos?|bumpers?|clips|intros?|bloopers|cartoons|highlights|marathon|mix)\b/i;
// "Mister Ed S02E14 …", "Beverly Hillbillies Ep01 …", "The Andy Griffith Show: S3 E23, …", "Show #31: …"
const EPISODE = /^(.+?)[\s:,-]+(?:s\d{1,2}\s*e\d{1,3}|s\d{1,2}\b|ep\.?\s*\d+|episode\s*\d+|#\d+|season\s*\d+|e\d{1,3}\b)/i;

// The search for one catalog title: { q, year, series } or null when it can't be a film or show.
// prefer is what the channel mostly airs ("series" on the classic-TV channels, "film" on the movie
// channels, "" otherwise). "Show · S01E02 · Episode" and other episode-looking titles look up the
// show; on series channels "Show: Episode" and "Show - Episode" do too. A year in the title
// ("Come Drink With Me (1966)", "Master of the Flying Guillotine 1976 English") beats the catalog's
// year, which is sometimes the upload year, and anything after it ("English", "DVD Remux") goes.
export function parseTitle(title, year, prefer = "") {
  let q = String(title ?? "").trim(), series = false;
  if (q.includes(" · ")) { q = q.split(" · ")[0].trim(); series = true; }
  const ep = !series && q.match(EPISODE);
  if (ep) { q = ep[1]; series = true; }
  else if (!series && prefer === "series") {
    const part = q.match(/^(.{3,}?)\s*(?::|\s[-–]\s)\s*\S/);
    if (part) { q = part[1]; series = true; }
  }
  let y = /^(19|20)\d\d$/.test(String(year ?? "")) ? Number(year) : 0;
  const m = q.match(/^(.{2,}?)[\s.([-]+((?:19|20)\d\d)(?!\d)[)\]]?(?:\s.*)?$/);
  if (m && m[1].trim().length >= 2) { q = m[1].trim(); y = Number(m[2]); }
  const bracket = q.match(/\s*[[(]([^\])]*)[\])]\s*$/);
  if (bracket && JUNK.test(bracket[1])) return null;
  q = q.replace(/\s*[[(][^\])]*[\])]\s*$/, "")
    .replace(/\s+(?:tv[- ]show|(?:the\s+)?(?:classic\s+|original\s+)?(?:\d+\s+)?(?:pd\s+)?episodes|complete series|full series)\b.*$/i, "")
    .replace(/[\s.:,#-]+$/, "").trim();
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length || q.length > 70 || words.length > 10 || JUNK.test(q)) return null;
  return { q, year: series ? 0 : y, series };
}

export const cacheKey = ({ q, year, series }, prefer = "") => `${norm(q)}|${year || ""}|${series ? "s" : ""}|${prefer}`;

// Every year a Wikidata entity came out (publication dates P577, start time P580): films often
// have several (festival premiere, release, re-release).
export function entityYears(entity) {
  const years = new Set();
  for (const p of ["P577", "P580"]) for (const c of entity?.claims?.[p] || []) {
    const y = Number(String(c.mainsnak?.datavalue?.value?.time || "").slice(1, 5));
    if (y > 1800) years.add(y);
  }
  return [...years];
}

export function entityImdb(entity) {
  for (const c of entity?.claims?.P345 || []) {
    const v = String(c.mainsnak?.datavalue?.value || "");
    if (/^tt\d{5,10}$/.test(v)) return v;   // tt = a title (nm = a person, co = a company)
  }
  return "";
}

// What a Wikidata description says the thing is: "film", "series", "other" (episodes, seasons,
// games, albums and books share titles with shows and films but aren't what's on the channel),
// or "unknown".
export function kindOf(description) {
  const d = String(description ?? "").toLowerCase();
  if (/episode|season of|video game|album|single|song|novel|book|soundtrack|comic/.test(d)) return "other";
  if (/series|television program|tv program|sitcom|show|anime/.test(d)) return "series";
  if (/film|movie|cartoon|animated short|serial/.test(d)) return "film";
  return "unknown";
}

// candidates: [{ labels: [label, ...aliases], imdb, years: [..], kind }]. prefer as in parseTitle:
// when two things share the title, the one the channel airs ("series" or "film") wins; with no
// preference and no year to tell them apart, there's no match.
export function pick({ q, year, series }, candidates, prefer = "") {
  const want = norm(q), kind = series ? "series" : prefer;
  const exact = candidates.filter(c => c.imdb && c.kind !== "other" && c.labels.some(l => norm(l) === want));
  const one = list => { const ids = [...new Set(list.map(c => c.imdb))]; return ids.length === 1 ? ids[0] : ""; };
  const mine = list => kind ? one(list.filter(c => c.kind === kind)) : "";
  if (!exact.length) return "";
  if (year && !series) { const near = exact.filter(c => c.years.some(y => Math.abs(y - year) <= 1)); return one(near) || mine(near); }
  return one(exact) || mine(exact);
}

// What a channel mostly airs, from its section of the guide.
export const preferFor = band => band === "Classic TV" ? "series" : band === "Movies" ? "film" : "";
