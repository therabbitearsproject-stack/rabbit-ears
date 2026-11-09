import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function loadChannelBreakLibrary(id, root = new URL("../", import.meta.url)) {
  if (id !== "sci-fi-channel") throw new Error("Unknown break library: " + id);
  const manifest = JSON.parse(await readFile(new URL("assets/scifi-breaks/manifest.json", root), "utf8"));
  if (manifest.id !== id || manifest.commercials.length < 3 || !manifest.bumpers.length) throw new Error("Incomplete SCI FI library");
  if (manifest.commercials.filter(m => m.role === "star-trek-commercial").length < 3) throw new Error("Missing primary Star Trek commercials");
  const ids = new Set();
  for (const media of [...manifest.commercials, ...manifest.bumpers]) {
    if (ids.has(media.id) || !/^assets\/scifi-breaks\/[a-z0-9-]+\.mp4$/.test(media.file) || !media.local || !(media.dur > 0 && media.dur <= 90)) throw new Error("Invalid break media: " + media.id);
    if (manifest.commercials.includes(media) && !(media.year >= 1970 && media.year <= 1999)) throw new Error("Undated commercial: " + media.id);
    ids.add(media.id);
    const bytes = await readFile(new URL(media.file, root));
    if (createHash("sha256").update(bytes).digest("hex") !== media.sha256) throw new Error("Break checksum mismatch: " + media.id);
  }
  return manifest;
}
