// Writes the TV apps' schedule files into the site folder: tv/channels.json (the channel list) and
// tv/ch/<number>.json (what airs on that channel for the next couple of days). See tv-feed.mjs.
// Usage: node scripts/build-tv-feed.mjs _site
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildTvFeed } from "./tv-feed.mjs";

const out = process.argv[2] || "_site";
const [html, catalog, commercialTiming, mediaCompatibility] = await Promise.all([
  readFile("index.html", "utf8"), readFile("catalog.json", "utf8").then(JSON.parse),
  readFile("commercial-timing.js", "utf8"), readFile("media-compatibility.js", "utf8"),
]);
const { index, channels, failed } = await buildTvFeed({ html, catalog, commercialTiming, mediaCompatibility });
await mkdir(out + "/tv/ch", { recursive: true });
await writeFile(out + "/tv/channels.json", JSON.stringify(index));
let bytes = 0;
for (const [no, feed] of Object.entries(channels)) {
  const text = JSON.stringify(feed);
  bytes += text.length;
  await writeFile(`${out}/tv/ch/${no}.json`, text);
}
console.log(`📡 TV feed: ${index.channels.length} channels, ${(bytes / 1e6).toFixed(1)} MB, until ${new Date(index.until * 1000).toISOString()}`);
for (const f of failed) console.log("  ⚠️ " + f);
if (index.channels.length < 40) { console.error("Too few channels in the TV feed"); process.exit(1); }
