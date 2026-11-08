import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

test("franchise searches reserve slots, deduplicate uploads and count only playable, unreported tapes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rabbit-ears-catalog-"));
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  try {
    await mkdir(join(dir, "scripts"));
    await copyFile(new URL("../media-compatibility.js", import.meta.url), join(dir, "media-compatibility.js"));
    await copyFile(new URL("build-catalog.mjs", import.meta.url), join(dir, "scripts/build-catalog.mjs"));
    await copyFile(new URL("trek-programming.mjs", import.meta.url), join(dir, "scripts/trek-programming.mjs"));
    await copyFile(new URL("caption-library.mjs", import.meta.url), join(dir, "scripts/caption-library.mjs"));
    await copyFile(new URL("commercial-library.mjs", import.meta.url), join(dir, "scripts/commercial-library.mjs"));
    await writeFile(join(dir, "index.html"), `const SAFE = \`\`;
const BUILT_IN = [
 {name:"Trek", q:"trek", franchises:[{name:"Old crew", q:"old"}, {name:"New crew", q:"new"}]},
 {name:"Ordinary", q:"ordinary"},
 {name:"Offline", q:"offline"}
];`);
    const oldRow = ["old-pool", "video.mp4", 600, "Old title", "2026", ""];
    await writeFile(join(dir, "catalog.json"), JSON.stringify({ pools: { offline: [oldRow] } }));
    const searches = [];
    globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 1), ...args);
    globalThis.fetch = async input => {
      const url = new URL(input);
      let data;
      if (url.pathname === "/advancedsearch.php") {
        const q = url.searchParams.get("q");
        searches.push({ q, rows: Number(url.searchParams.get("rows")) });
        if (q.includes("offline")) return { ok: false, status: 503 };
        const ids = q.includes("ordinary") ? ["ordinary"] : q.includes("old") ? ["shared", "reported"] : q.includes("new") ? ["shared", "new", "unplayable"] : ["shared", "extra"];
        data = { response: { docs: ids.map(identifier => ({ identifier })) } };
      } else if (url.pathname.startsWith("/metadata/")) {
        const id = url.pathname.split("/").pop();
        data = { metadata: { title: id }, files: id === "unplayable" ? [] : [{ name: "video.mp4", length: "10:00", format: "h.264" }] };
      } else if (url.pathname === "/reports.json") {
        data = Object.fromEntries([1, 2, 3].map(i => [i, { id: "reported", reason: "broken", ch: "Trek" }]));
      } else throw new Error("Unexpected request " + input);
      return { ok: true, json: async () => data };
    };
    await import(pathToFileURL(join(dir, "scripts/build-catalog.mjs")));
    const result = JSON.parse(await readFile(join(dir, "catalog.json"), "utf8"));
    assert.deepEqual(result.pools.trek.map(r => r[0]).sort(), ["extra", "new", "shared"]);
    assert.deepEqual(result.coverage.trek, { "Old crew": 1, "New crew": 2 });
    assert.deepEqual(result.pools.offline, [oldRow], "failed searches preserve the previous pool");
    assert.ok(result.unplayable.includes("unplayable"));
    assert.equal(searches.find(s => s.q.includes("ordinary")).rows, 300);
    assert.ok(searches.filter(s => s.q.includes("trek")).every(s => s.rows === 100));
    assert.equal(searches.filter(s => s.q.includes("trek")).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimeout;
    await rm(dir, { recursive: true, force: true });
  }
});
