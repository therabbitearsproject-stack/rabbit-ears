import { createHash } from "node:crypto";

const seconds = value => String(value || 0).split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
const base = name => name.split("/").pop().replace(/(?:\.ia|_512kb)?\.mp4$/i, "");
const episodeCode = name => name.match(/(?:s\s*(\d{1,2})\s*e\s*(\d{1,2})(?:e\d{1,2})?|(\d{1,2})x(\d{2}))/i);
function identity(file, source) {
  const code = episodeCode(file.name);
  const series = file.name.match(/\b(TNG|DS9|VOY)[-._ ]*s\d/i)?.[1]?.toUpperCase() || source.series;
  return code ? `${series}:S${Number(code[1] || code[3])}E${Number(code[2] || code[4])}` : `${series}:${base(file.name).toLowerCase()}`;
}
function better(a, b) {
  // Resolution first, then bitrate: a format label is not a quality measurement.
  return Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height) ||
    Number(b.size) / seconds(b.length) - Number(a.size) / seconds(a.length) ||
    Number(b.source === "original") - Number(a.source === "original") || a.name.localeCompare(b.name);
}
export function selectEpisodeFiles(files, source) {
  const candidates = files.filter(f => /\.mp4$/i.test(f.name) && !f.private &&
    (source.audioPolicy !== "archive-aac" || (/\.ia\.mp4$/i.test(f.name) && f.source === "derivative" && /h\.264/i.test(f.format || ""))) &&
    seconds(f.length) >= (source.kind === "film" ? 3600 : 1200) && seconds(f.length) <= 10800 &&
    Number(f.width) >= 600 && Number(f.height) >= (source.minHeight || 480) &&
    !/\b(trailer|teaser|promo|preview|sample|interview|making.of|behind.the.scenes|extras?|bonus|commentary|recap)\b/i.test(f.name));
  const episodes = new Map();
  for (const f of candidates.sort(better)) {
    const key = identity(f, source);
    if (!episodes.has(key)) episodes.set(key, f);
  }
  return [...episodes.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}
export function episodeRows(data, source, pickSub = () => "") {
  return selectEpisodeFiles(data.files || [], source).map(f => {
    // Each episode needs its own stable schedule/report/caption key, separate from its Archive item.
    const key = source.id + "--" + createHash("sha256").update(identity(f, source)).digest("hex").slice(0, 16);
    const broadcast = base(f.name).match(/^ST9\d+\.(TNG|DS9|VOY)-(s\d+e\d+(?:e\d+)?)\.(.*)$/i);
    const names = { TNG: "The Next Generation", DS9: "Deep Space Nine", VOY: "Voyager" };
    const label = base(f.name).replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
    const title = source.kind === "film" ? source.series : broadcast ?
      `${names[broadcast[1].toUpperCase()]} · ${broadcast[2].toUpperCase()} · ${broadcast[3].replace(/\./g, " ")}` : `${source.series} · ${label}`;
    const year = String([].concat(data.metadata?.year || data.metadata?.date || "")[0]).slice(0, 4);
    // Some reviewed collections number captions separately from their video filenames.
    // Only use an explicit match for this source, and only while the file exists there.
    const captionName = source.captionFiles?.[f.name.replace(/\.ia\.mp4$/i, ".mp4")];
    const mappedCaption = (data.files || []).find(s => s.name === captionName && !s.private && /\.(srt|vtt)$/i.test(s.name));
    return [key, f.name, Math.round(seconds(f.length) * 10) / 10, title, year,
      pickSub(data.files || [], f.name) || mappedCaption?.name || "", source.id, Number(f.width), Number(f.height)];
  });
}

export async function buildTrekPool(library, loadMetadata, pickSub, previous = []) {
  const rows = [];
  const rejected = new Set((library.rejected || []).map(r => r.id));
  for (const source of library.sources.filter(s => !rejected.has(s.id))) {
    try {
      const data = await loadMetadata(source.id);
      const episodes = episodeRows(data || {}, source, pickSub);
      rows.push(...episodes);
      console.log(`  ${source.series}: ${episodes.length} full programs`);
    } catch (error) {
      // Reuse only this approved collection's already-migrated episodes, never the old search pool.
      const saved = previous.filter(r => r[6] === source.id && (source.audioPolicy !== "archive-aac" || /\.ia\.mp4$/i.test(r[1])));
      rows.push(...saved);
      console.log(`! ${source.series}: ${error.message}; kept ${saved.length} previously approved programs`);
    }
  }
  if (!rows.length) throw new Error("No approved Star Trek episodes available; refusing the old unreviewed pool");
  return rows;
}
