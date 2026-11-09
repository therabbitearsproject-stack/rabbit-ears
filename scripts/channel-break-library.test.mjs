import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadChannelBreakLibrary } from "./channel-break-library.mjs";
const timing = new Function(await readFile(new URL("../commercial-timing.js", import.meta.url), "utf8") + ";return CommercialTiming")();

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

test("Trek mix restores custom bumpers, limits vintage ads and keeps full breaks near three minutes", async () => {
  const library = await loadChannelBreakLibrary("sci-fi-channel");
  const facts = JSON.parse(await readFile(new URL("../assets/trek-bumpers/facts.json", import.meta.url), "utf8"));
  const custom = facts.map(f => ({ id: f.id, dur: 15, role: "custom-bumper" }));
  const policy = { mix: "trek-first", vintageEvery: 3, interval: 600, target: 180, minTail: 120 };
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
      // The shortest alternate spot is 10.56s; don't repeat the last ad to fill that final gap.
      assert.ok(duration >= policy.target - 11 && duration <= policy.target + .001, "complete spots keep break near 180 seconds: " + duration);
      for (const s of segments) assert.ok(Math.abs(s.end - s.start - s.media.dur) < .00001);
    }
    const program = plan.segments.filter(s => s.kind === "program");
    assert.deepEqual(program.map(s => s.offset), Array.from({ length: 10 }, (_, i) => i * 600));
    assert.ok(Math.abs(program.reduce((n, s) => n + s.end - s.start, 0) - 6000) < .00001);
  }
});
