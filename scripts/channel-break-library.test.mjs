import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadChannelBreakLibrary } from "./channel-break-library.mjs";
const timing = new Function(await readFile(new URL("../commercial-timing.js", import.meta.url), "utf8") + ";return CommercialTiming")();
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const trekPolicy = new Function("return (" + html.match(/name: "Subspace 97"[^\n]*?breaks: (\{[^}]+\})/)[1] + ")")();

test("SCI FI breaks are complete, checksum verified and isolated from the reserved library", async () => {
  const library = await loadChannelBreakLibrary("sci-fi-channel");
  assert.equal(library.commercials.length, 24);
  assert.equal(library.commercials.filter(m => m.role === "star-trek-commercial").length, 6);
  assert.equal(library.bumpers.length, 3);
  const reserved = [["old-ad", "old.mp4", 30, "Reserved ad", 1990]];
  const catalog = { commercials: reserved, bumpers: [{ id: "old-fact", dur: 15 }], breakLibraries: { "sci-fi-channel": library } };
  const selected = timing.library(catalog, "sci-fi-channel");
  assert.deepEqual(timing.library(catalog, "missing"), { commercials: [], bumpers: [] });
  assert.equal(timing.library(catalog).commercials[0].id, "old-ad");
  const build = () => timing.build({ id: "episode", dur: 2640 }, { interval: 600, target: 180, minTail: 120 }, selected.commercials, selected.bumpers, "scifi-slot");
  const plan = build();
  assert.deepEqual(plan, build());
  for (const s of plan.segments.filter(s => s.kind !== "program")) {
    assert.ok([...library.commercials, ...library.bumpers].some(m => m.id === s.media.id));
    assert.ok(Math.abs(s.end - s.start - s.media.dur) < .00001);
  }
  const resumed = plan.segments.filter(s => s.kind === "program")[1];
  assert.equal(timing.at(plan, resumed.start).position, 600);
  assert.deepEqual(catalog.commercials, reserved);
});

test("Subspace uses fewer, shorter breaks with at most three unique complete ads", async () => {
  const library = await loadChannelBreakLibrary("sci-fi-channel");
  const facts = JSON.parse(await readFile(new URL("../assets/trek-bumpers/facts.json", import.meta.url), "utf8"));
  const custom = facts.map(f => ({ id: f.id, dur: 15, role: "custom-bumper" }));
  const policy = trekPolicy;
  assert.equal(policy.interval, 900);
  assert.equal(policy.target, 120);
  assert.equal(policy.maxAds, 3);
  for (let seed = 0; seed < 100; seed++) {
    const make = () => timing.build({ id: "episode", dur: 6000 }, policy, library.commercials, [...library.bumpers, ...custom], "slot" + seed);
    const plan = make();
    assert.deepEqual(plan, make(), "shared-clock order is deterministic");
    const breaks = []; let current;
    for (const s of plan.segments) {
      if (s.kind === "program") { current = []; breaks.push(current); }
      else current.push(s);
    }
    for (const [i, segments] of breaks.filter(b => b.length).entries()) {
      assert.equal(segments[0].kind, "bumper");
      assert.equal(segments.at(-1).kind, "bumper");
      assert.deepEqual(segments.filter(s => s.kind === "bumper").map(s => s.media.role).sort(), ["custom-bumper", "network-id"]);
      const vintage = segments.filter(s => s.kind === "commercial" && s.media.role !== "star-trek-commercial");
      assert.equal(vintage.length, i % 3 === 2 ? 1 : 0);
      const duration = segments.reduce((n, s) => n + s.end - s.start, 0);
      assert.ok(duration > 0 && duration <= policy.target + .001, "two-minute limit includes both bumpers");
      const ads = segments.filter(s => s.kind === "commercial");
      assert.ok(ads.length <= 3);
      assert.equal(new Set(ads.map(s => s.media.id)).size, ads.length, "no ad repeats inside a break");
      assert.equal(new Set(ads.map(s => s.media.file)).size, ads.length, "aliases cannot repeat the same video");
      for (const s of segments) assert.ok(Math.abs(s.end - s.start - s.media.dur) < .00001);
    }
    const program = plan.segments.filter(s => s.kind === "program");
    assert.deepEqual(program.map(s => s.offset), Array.from({ length: 7 }, (_, i) => i * 900));
    assert.ok(Math.abs(program.reduce((n, s) => n + s.end - s.start, 0) - 6000) < .00001);
  }
});

test("a 44-minute Subspace episode now has two breaks and retains every second of the episode", () => {
  const program = { id: "episode", dur: 2640 };
  const ads = [{ id: "short", file: "short.mp4", dur: 10, role: "star-trek-commercial" }];
  const plan = timing.build(program, trekPolicy, ads, [], "single-ad");
  assert.equal(plan.segments.filter(s => s.kind === "commercial").length, 2, "one available ad plays once in each of two breaks");
  assert.deepEqual(plan.segments.filter(s => s.kind === "program").map(s => s.offset), [0,900,1800]);
  assert.equal(plan.duration, 2660, "short breaks finish rather than repeating ads to pad the target");
});

test("unique packing rejects duplicate IDs and duplicate video files without truncating spots", () => {
  const ads = [{ id: "a", file: "a.mp4", dur: 10 }, { id: "a", file: "alternate.mp4", dur: 10 },
    { id: "alias", file: "a.mp4", dur: 10 }, { id: "b", file: "b.mp4", dur: 30 }];
  for (let seed = 0; seed < 100; seed++) {
    const result = timing.pack(ads, 120, "seed" + seed, { unique: true, maxSpots: 3 });
    assert.ok(result.length <= 3);
    assert.equal(new Set(result.map(m => m.id)).size, result.length);
    assert.equal(new Set(result.map(m => m.file)).size, result.length);
    assert.ok(result.every(m => m.dur === 10 || m.dur === 30));
  }
});
