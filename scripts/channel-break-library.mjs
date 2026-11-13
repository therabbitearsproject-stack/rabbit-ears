import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function loadChannelBreakLibrary(id, root = new URL("../", import.meta.url)) {
  const folder = { "sci-fi-channel": "scifi-breaks", "porchlight": "porchlight-breaks", "midnight-mirage": "midnight-mirage-breaks" }[id];
  if (!folder) throw new Error("Unknown break library: " + id);
  const manifest = JSON.parse(await readFile(new URL(`assets/${folder}/manifest.json`, root), "utf8"));
  if (manifest.id !== id || !Array.isArray(manifest.commercials) || manifest.commercials.length < 3 ||
      !Array.isArray(manifest.bumpers) || (id !== "midnight-mirage" && !manifest.bumpers.length)) throw new Error("Incomplete break library: " + id);
  if (id === "midnight-mirage" && (JSON.stringify(manifest.yearRange) !== '[1980,1999]' ||
      manifest.commercials.some(m => m.role !== 'movie-tv-spot' || !Number.isInteger(Number(m.year)) || Number(m.year) < 1980 || Number(m.year) > 1999 || m.dur < 8)))
    throw new Error("Midnight Mirage requires 1980–1999 movie TV spots only");
  if (id === "sci-fi-channel" && manifest.commercials.filter(m => m.role === "star-trek-commercial").length < 3) throw new Error("Missing primary Star Trek commercials");
  const ids = new Set();
  for (const media of [...manifest.commercials, ...manifest.bumpers]) {
    if (id === "midnight-mirage" && !media.archiveId && media.source?.archiveId) media.archiveId = media.source.archiveId;
    if (ids.has(media.id) || !new RegExp(`^assets/${folder}/[a-z0-9-]+\\.mp4$`).test(media.file) || !media.local || !(media.dur > 0 && media.dur <= 90)) throw new Error("Invalid break media: " + media.id);
    const [first,last] = manifest.yearRange || [1970,1999];
    if (manifest.commercials.includes(media) && !(media.year >= first && media.year <= last)) throw new Error("Undated commercial: " + media.id);
    ids.add(media.id);
    const bytes = await readFile(new URL(media.file, root));
    if (createHash("sha256").update(bytes).digest("hex") !== media.sha256) throw new Error("Break checksum mismatch: " + media.id);
  }
  return manifest;
}
