import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

test("franchise searches reserve slots, deduplicate uploads and count only playable, unreported tapes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rabbit-ears-catalog-"));
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  try {
    await mkdir(join(dir, "scripts"));
    await copyFile(new URL("../media-compatibility.js", import.meta.url), join(dir, "media-compatibility.js"));
    await copyFile(new URL("build-catalog.mjs", import.meta.url), join(dir, "scripts/build-catalog.mjs"));
    await copyFile(new URL("program-quality.mjs", import.meta.url), join(dir, "scripts/program-quality.mjs"));
    await copyFile(new URL("channel-policies.json", import.meta.url), join(dir, "scripts/channel-policies.json"));
    await copyFile(new URL("themed-ad-library.mjs", import.meta.url), join(dir, "scripts/themed-ad-library.mjs"));
    await mkdir(join(dir,'community'));
    await writeFile(join(dir,'community/channels.json'),JSON.stringify([{no:1,name:'Ordinary'},{no:2,name:'Trek'}]));
    await copyFile(new URL("trek-programming.mjs", import.meta.url), join(dir, "scripts/trek-programming.mjs"));
    await copyFile(new URL("caption-library.mjs", import.meta.url), join(dir, "scripts/caption-library.mjs"));
    await copyFile(new URL("commercial-library.mjs", import.meta.url), join(dir, "scripts/commercial-library.mjs"));
    await copyFile(new URL("channel-break-library.mjs", import.meta.url), join(dir, "scripts/channel-break-library.mjs"));
    await copyFile(new URL("reviewed-episodes.mjs", import.meta.url), join(dir, "scripts/reviewed-episodes.mjs"));
    await copyFile(new URL("porchlight-programming.mjs", import.meta.url), join(dir, "scripts/porchlight-programming.mjs"));
    await writeFile(join(dir, "index.html"), `const SAFE = \`\`;
const BUILT_IN = [
 {name:"Trek", q:"trek", franchises:[{name:"Old crew", q:"old"}, {name:"New crew", q:"new"}]},
 {name:"Ordinary", q:"ordinary"},
 {name:"Offline", q:"offline"}
];`);
    await writeFile(join(dir, 'index.html'), `\nconst BLOCKED = new Set([\n "blocked-source", "blocked-episode", "channel-blocked-source@Ordinary"\n]);\n`, {flag:'a'});
    const expanded = (id,source) => [id,id+'.mp4',600,'Complete program','1992','',source];
    await writeFile(join(dir,'scripts/channel-programs.json'),JSON.stringify({channels:{
      Ordinary:{rows:[expanded('collection-good','good-source'),expanded('episode-broken','good-source'),expanded('reported-child','reported-source'),expanded('wrong-child','wrong-source'),expanded('blocked-child','blocked-source'),expanded('blocked-episode','good-source'),expanded('channel-blocked-child','channel-blocked-source')]}
    }}));
    const ad=(id,archiveId=id)=>({id,archiveId,file:id+'.mp4',title:'Sears home furniture commercial',year:1992,dur:30});
    await writeFile(join(dir,'scripts/themed-ads.json'),JSON.stringify({commercials:[ad('safe-ad'),ad('reported-ad','reported-source'),ad('episode-broken'),ad('blocked-ad','blocked-source'),ad('wrong-ad','wrong-source'),ad('channel-blocked-ad','channel-blocked-source')]}));
    const captionText='WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nReviewed dialogue\n';
    await mkdir(join(dir,'captions'));
    const captionEntries={};
    for(const [id,video,archiveId] of [['ordinary','video.mp4','ordinary'],['collection-good','collection-good.mp4','good-source']]){
      await writeFile(join(dir,'captions',id+'.vtt'),captionText);
      captionEntries[id]={video,archiveId,duration:600,status:'passed',checks:[{fraction:.2,pass:true},{fraction:.8,pass:true}],sha256:createHash('sha256').update(captionText).digest('hex')};
    }
    await writeFile(join(dir,'captions/manifest.json'),JSON.stringify({episodes:captionEntries}));
    const oldRow = ["old-pool", "video.mp4", 600, "Old title", "2026", "local:removed.vtt"];
    await writeFile(join(dir, "catalog.json"), JSON.stringify({ pools: { offline: [oldRow] } }));
    const searches = [],lookups=[];
    globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 1), ...args);
    globalThis.fetch = async input => {
      const url = new URL(input);
      let data;
      if (url.pathname === "/advancedsearch.php") {
        const q = url.searchParams.get("q");
        searches.push({ q, rows: Number(url.searchParams.get("rows")) });
        if (q.includes("offline")) return { ok: false, status: 503 };
        const ids = q.includes("ordinary") ? ["ordinary","bad-preview"] : q.includes("old") ? ["shared", "reported"] : q.includes("new") ? ["shared", "new", "unplayable"] : ["shared", "extra"];
        data = { response: { docs: ids.map(identifier => ({ identifier })) } };
      } else if (url.pathname.startsWith("/metadata/")) {
        const id = url.pathname.split("/").pop();
        lookups.push(id);
        data = { metadata: { title: id==='bad-preview'?'Movie preview':id }, files: id === "unplayable" ? [] : [{ name: "video.mp4", length: "10:00", format: "h.264" }] };
      } else if (url.pathname === "/reports.json") {
        const reports=[...[1,2,3].map(()=>({id:'reported',reason:'broken',ch:'Trek'})),
          ...[1,2].map(()=>({id:'reported-source',reason:'inappropriate',ch:'Ordinary'})),
          ...[1,2,3].map(()=>({id:'episode-broken',reason:'broken',ch:'Ordinary'})),
          ...[1,2].map(()=>({id:'wrong-source',reason:'wrong',ch:'Ordinary'}))];
        data = Object.fromEntries(reports.map((r,i)=>[i,r]));
      } else throw new Error("Unexpected request " + input);
      return { ok: true, json: async () => data };
    };
    await import(pathToFileURL(join(dir, "scripts/build-catalog.mjs")));
    const result = JSON.parse(await readFile(join(dir, "catalog.json"), "utf8"));
    assert.deepEqual(result.pools.trek.map(r => r[0]).sort(), ["extra", "new", "shared"]);
    assert.deepEqual(result.pools.ordinary.map(r=>r[0]).sort(),['collection-good','ordinary'], 'collection merges cannot restore reported or blocked episodes or their parent sources');
    assert.equal(result.pools.ordinary.find(r=>r[0]==='ordinary')[5],'local:ordinary.vtt','ordinary source IDs support reviewed captions');
    assert.equal(result.pools.ordinary.find(r=>r[0]==='collection-good')[5],'local:collection-good.vtt','reviewed captions apply after collection rows are merged');
    assert.deepEqual(result.channelAds[1].map(m=>m.id),['safe-ad'], 'new ads respect global and channel-specific source reports and blocks');
    assert.deepEqual(result.channelAds[2].map(m=>m.id),['safe-ad','wrong-ad','channel-blocked-ad'], 'wrong-channel exclusions do not spread to other channels');
    assert.deepEqual(result.coverage.trek, { "Old crew": 1, "New crew": 2 });
    assert.deepEqual(result.pools.offline, [[...oldRow.slice(0,5),'']], "failed searches preserve programs but cannot preserve unreviewed local captions");
    assert.ok(result.unplayable.includes("unplayable"));
    assert.equal(searches.find(s => s.q.includes("ordinary")).rows, 400);
    assert.ok(searches.filter(s => s.q.includes("trek")).every(s => s.rows === 133));
    assert.equal(searches.filter(s => s.q.includes("trek")).length, 3);
    assert.ok(result.qualifiedOut.channels.Ordinary.includes('bad-preview'));
    await import(pathToFileURL(join(dir,'scripts/build-catalog.mjs'))+'?refresh');
    assert.equal(lookups.filter(id=>id==='bad-preview').length,1,'daily refresh does not refetch rejected clips');
    await writeFile(join(dir,'scripts/channel-policies.json'),'\n',{flag:'a'});
    await import(pathToFileURL(join(dir,'scripts/build-catalog.mjs'))+'?new-policy');
    assert.equal(lookups.filter(id=>id==='bad-preview').length,2,'changed admission rules recheck cached exclusions');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimeout;
    await rm(dir, { recursive: true, force: true });
  }
});
