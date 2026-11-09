// Writes the channel and game pages plus sitemap.xml into the assembled site folder.
// Run by .github/workflows/catalog.yml after the site is assembled:  node scripts/build-pages.mjs _site
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildPages, channelsFromIndex } from "./site-pages.mjs";

const out = process.argv[2] || "_site";
const read = async (p, fallback) => { try { return JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8")); } catch { return fallback; } };

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const { channels, bands, blocked } = channelsFromIndex(html);
const logos = await read("assets/channel-logos/manifest.json", {});
const catalog = await read("catalog.json", {});
const games = await read("games.json", { shelves: [], games: {} });

const { pages, sitemap } = buildPages({ channels, bands, logos, pools: catalog.pools || {}, games, blocked });
for (const p of pages) {
  const dir = join(out, ...p.path.split("/").filter(Boolean));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), p.html);
}
await writeFile(join(out, "sitemap.xml"), sitemap);
console.log(`${pages.length} pages written (${channels.length} channels), sitemap has ${pages.length + 1} URLs`);
