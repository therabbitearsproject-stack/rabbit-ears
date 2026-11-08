// Copies Archive sidecars and reviewed embedded captions into subs/<id>.vtt, so the
// page can load captions from its own site (archive.org doesn't let other sites read the files
// directly). SRT is converted to WebVTT, the format browsers play. Files already in subs/ are
// kept (the workflow caches the folder between runs); ones no longer in the catalog are removed.
//
// Run after build-catalog.mjs: node scripts/fetch-subs.mjs   (Node 18+; no packages needed)

import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { localCaption } from "./caption-library.mjs";

const DIR = new URL("../subs/", import.meta.url);
const CONCURRENCY = 6;
const MAX_BYTES = 3_000_000;
const UA = "RabbitEarsCatalog/1.0 (+https://github.com/therabbitearsproject-stack/rabbit-ears)";
// Must match subFile() in index.html.
const subFile = id => id.replace(/[^A-Za-z0-9._-]/g, "_") + ".vtt";

function toVtt(text) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (/^WEBVTT/.test(text)) return text + "\n";
  // SRT: "00:00:10,07 --> 00:00:16,86" → "00:00:10.070 --> 00:00:16.860"
  const fixTime = t => t.replace(/(\d+:\d{2}:\d{2})[,.](\d{1,3})/, (m, hms, frac) => hms + "." + frac.padEnd(3, "0"));
  const cues = text.split(/\n{2,}/).map(block => {
    const lines = block.split("\n");
    const i = lines.findIndex(l => l.includes("-->"));
    if (i < 0) return "";
    const [a, b] = lines[i].split("-->").map(s => fixTime(s.trim().split(/\s+/)[0]));
    const body = lines.slice(i + 1).join("\n").replace(/<\/?(font|b|i|u)[^>]*>/gi, "").trim();
    return body ? `${a} --> ${b}\n${body}` : "";
  }).filter(Boolean);
  return cues.length ? "WEBVTT\n\n" + cues.join("\n\n") + "\n" : "";
}

async function download(id, name) {
  const url = `https://archive.org/download/${encodeURIComponent(id)}/${name.split("/").map(encodeURIComponent).join("/")}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (r.status === 404 || r.status === 403) return "";
      if (r.ok) { const t = await r.text(); return t.length > MAX_BYTES ? "" : t; }
    } catch {}
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
  throw new Error("failed: " + url);
}

const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const wanted = new Map(); // file name -> [id, subtitle path]
for (const rows of Object.values(catalog.pools)) for (const [id, , , , , sub, archiveId] of rows) if (sub) wanted.set(subFile(id), [archiveId || id, sub]);

await mkdir(DIR, { recursive: true });
const have = new Set(await readdir(DIR));
let removed = 0;
for (const f of have) if (!wanted.has(f)) { await unlink(new URL(f, DIR)); removed++; }

// Reviewed embedded tracks are versioned with the site, not fetched from an
// Archive sidecar URL. Always copy them, replacing an old cached/empty file.
let local = 0;
for (const [f, [, sub]] of wanted) if (sub.startsWith("local:")) {
  const vtt = await localCaption(sub.slice(6));
  if (!vtt.startsWith("WEBVTT\n") || !vtt.includes(" --> ")) throw Error("Invalid reviewed caption: " + f);
  await writeFile(new URL(f, DIR), vtt); local++;
}
const todo = [...wanted].filter(([f, [, sub]]) => !sub.startsWith("local:") && !have.has(f));
let got = 0, empty = 0, failed = 0, next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < todo.length) {
    const [f, [id, sub]] = todo[next++];
    try {
      const vtt = toVtt(await download(id, sub));
      // An empty file is still written, so a caption-less item isn't fetched again every night.
      await writeFile(new URL(f, DIR), vtt);
      vtt ? got++ : empty++;
    } catch { failed++; }
  }
}));
console.log(`subs: ${wanted.size} in catalog, ${local} reviewed local tracks, ${have.size - removed} kept, ${got} fetched, ${empty} empty, ${failed} failed, ${removed} removed`);
