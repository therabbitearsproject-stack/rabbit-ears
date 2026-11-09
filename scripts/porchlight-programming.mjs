import { createHash } from "node:crypto";
import { buildReviewedEpisodePool } from "./reviewed-episodes.mjs";
import { applyReviewedCaptions } from "./caption-library.mjs";
const patterns = {
  everwood: /^everwood-_season_(\d{2})_-_episode_(\d{2})(?:[ _.-]|$)/i,
  party: /^Party of Five S(\d{2})E(\d{2}) - (.+?)(?:\.ia)?\.mp4$/i,
  oc: /^The\.o\.c\.s(\d{2})e(\d{2})\./i,
  northern: /^Northern Exposure - S(\d{2})E(\d{2}) - (.+?)(?: - \d{2}\.\d{2}\.\d{2})?(?:\.ia)?\.mp4$/i
};
const seconds = v => String(v || 0).split(":").reduce((n,p) => n * 60 + Number(p), 0);

export function porchlightRows(data, source, codecs, pickSub = () => "") {
  const episodes = new Map();
  for (const f of data?.files || []) {
    const match = f.name.split("/").pop().match(patterns[source.pattern]);
    if (!match || !/\.mp4$/i.test(f.name) || f.private || seconds(f.length) < 1800 || seconds(f.length) > 3600 || Number(f.width) < 480 || Number(f.height) < 360) continue;
    const derivative = f.source === "derivative" && /h\.264/i.test(f.format || "");
    const audit = codecs[source.id + "|" + f.name];
    if (source.derivativesOnly ? !derivative : !(audit?.sha1 === f.sha1 && audit.video === "avc1" && audit.audio === "mp4a")) continue;
    const code = `S${match[1]}E${match[2]}`;
    if (episodes.has(code)) continue;
    const key = "porchlight-" + createHash("sha256").update(source.id + "|" + code).digest("hex").slice(0,16);
    const title = `${source.series} · ${code}${match[3] ? " · " + match[3] : ""}`;
    const airdate = f.name.match(/ - \d{2}\.\d{2}\.(\d{2})(?:\.ia)?\.mp4$/i);
    const year = source.pattern === "oc" ? 2002 + Number(match[1]) : source.pattern === "everwood" ? 2001 + Number(match[1]) : source.pattern === "party" ? 1993 + Number(match[1]) : airdate ? 1900 + Number(airdate[1]) : String([].concat(data.metadata?.date || data.metadata?.year || "")[0]).slice(0,4);
    episodes.set(code, [key, f.name, Math.round(seconds(f.length)*1000)/1000, title, year, pickSub(data.files,f.name), source.id, Number(f.width), Number(f.height), "browser-audio-v1"]);
  }
  return [...episodes.values()].sort((a,b) => a[3].localeCompare(b[3], "en", { numeric:true }));
}

export async function buildPorchlightPool(library, codecs, loadMetadata, pickSub, previous = []) {
  const groups = [];
  for (const source of library.sources) {
    let rows;
    try { rows = porchlightRows(await loadMetadata(source.id), source, codecs, pickSub); }
    catch {
      rows = previous.filter(r => r[6] === source.id && r[9] === "browser-audio-v1" && patterns[source.pattern].test(r[1].split("/").pop()) &&
        (source.derivativesOnly || codecs[source.id + "|" + r[1]]));
    }
    groups.push(rows); console.log(`  Porchlight / ${source.series}: ${rows.length} approved episodes`);
  }
  try { groups.push(await buildReviewedEpisodePool(library, loadMetadata, previous)); }
  catch (error) { console.log("! Porchlight / Gilmore Girls: " + error.message); }
  // Interleave collections so one large series does not dominate the initial guide.
  const rows=[];
  for (let i=0; groups.some(g => g.length > i); i++) for (const g of groups) if (g[i]) rows.push(g[i]);
  if (!rows.length) throw new Error("No approved Porchlight episodes available");
  return applyReviewedCaptions(rows);
}
