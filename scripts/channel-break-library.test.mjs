import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadChannelBreakLibrary } from "./channel-break-library.mjs";
const timing = new Function(await readFile(new URL("../commercial-timing.js", import.meta.url), "utf8") + ";return CommercialTiming")();

test("SCI FI breaks are complete, checksum verified and isolated from the reserved library", async () => {
  const library = await loadChannelBreakLibrary("sci-fi-channel");
  assert.equal(library.commercials.length, 18);
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
    assert.ok(s.media.id.startsWith("scifi-"));
    assert.ok(Math.abs(s.end - s.start - s.media.dur) < .00001);
  }
  const resumed = plan.segments.filter(s => s.kind === "program")[1];
  assert.equal(timing.at(plan, resumed.start).position, 600);
  assert.deepEqual(catalog.commercials, reserved);
});
