import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function loadChannelBreakLibrary(id, root = new URL("../", import.meta.url)) {
  const folder = { "sci-fi-channel": "scifi-breaks", "porchlight": "porchlight-breaks" }[id];
  if (!folder) throw new Error("Unknown break library: " + id);
  const manifest = JSON.parse(await readFile(new URL(`assets/${folder}/manifest.json`, root), "utf8"));
  if (manifest.id !== id || manifest.commercials.length < 3 || !manifest.bumpers.length) throw new Error("Incomplete SCI FI library");
  if (id === "sci-fi-channel" && manifest.commercials.filter(m => m.role === "star-trek-commercial").length < 3) throw new Error("Missing primary Star Trek commercials");
  const ids = new Set();
  for (const media of [...manifest.commercials, ...manifest.bumpers]) {
    if (ids.has(media.id) || !new RegExp(`^assets/${folder}/[a-z0-9-]+\\.mp4$`).test(media.file) || !media.local || !(media.dur > 0 && media.dur <= 90)) throw new Error("Invalid break media: " + media.id);
    const [first,last] = manifest.yearRange || [1970,1999];
    if (manifest.commercials.includes(media) && !(media.year >= first && media.year <= last)) throw new Error("Undated commercial: " + media.id);
    ids.add(media.id);
    const bytes = await readFile(new URL(media.file, root));
    if (createHash("sha256").update(bytes).digest("hex") !== media.sha256) throw new Error("Break checksum mismatch: " + media.id);
  }
  return manifest;
}
