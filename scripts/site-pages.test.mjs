import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPages, channelsFromIndex, cleanTitle, slugify } from "./site-pages.mjs";

const load = async p => readFile(new URL("../" + p, import.meta.url), "utf8");

test("slugs and titles", () => {
  assert.equal(slugify("Scooby & Friends"), "scooby-and-friends");
  assert.equal(slugify("'90s Kids"), "90s-kids");
  assert.equal(cleanTitle("Heavy Metal - 1981 [1080p]"), "Heavy Metal - 1981");
});

test("builds a page for every channel and game, with no adult titles listed", async () => {
  const { channels, bands, blocked } = channelsFromIndex(await load("index.html"));
  const logos = JSON.parse(await load("assets/channel-logos/manifest.json"));
  const catalog = JSON.parse(await load("catalog.json"));
  const games = JSON.parse(await load("games.json"));
  const { pages, sitemap } = buildPages({ channels, bands, logos, pools: catalog.pools, games, blocked });
  const paths = pages.map(p => p.path);
  assert.equal(new Set(paths).size, paths.length, "duplicate page paths");
  for (const ch of channels) assert.ok(paths.includes(`/channels/${slugify(ch.name)}/`), ch.name);
  assert.ok(paths.includes("/channels/") && paths.includes("/games/"));
  assert.ok(paths.filter(p => p.startsWith("/games/")).length > 100);
  const listed = pages.flatMap(p => [...p.html.matchAll(/<li>([^<]*)<\/li>/g)].map(m => m[1]));
  assert.deepEqual(listed.filter(t => /\b(sex|porn|stripper|hentai|erotic|nude)\b/i.test(t)), []);
  assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length + 1);
});
