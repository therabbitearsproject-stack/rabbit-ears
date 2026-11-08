import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { commercialRow } from "./commercial-library.mjs";
const code = await readFile(new URL("../commercial-timing.js", import.meta.url), "utf8");
const timing = new Function(code + "; return CommercialTiming;")();
const program = { id: "episode", dur: 2640, title: "Main show" };
const policy = { interval: 600, target: 180, minTail: 120 };
const ads = Array.from({ length: 8 }, (_, i) => ({ id: "ad" + i, dur: 30, year: "1995" }));
const bumpers = Array.from({ length: 6 }, (_, i) => ({ id: "fact" + i, dur: 15, local: true }));

test("show clock includes regular breaks while content resumes without loss or repeats", () => {
  const plan = timing.build(program, policy, ads, bumpers, "shared-slot");
  const chunks = plan.segments.filter(s => s.kind === "program");
  assert.deepEqual(chunks.map(s => s.offset), [0, 600, 1200, 1800, 2400]);
  assert.equal(chunks.reduce((n, s) => n + s.end - s.start, 0), program.dur);
  assert.equal(plan.segments.filter(s => s.kind === "bumper").length, 4);
  assert.ok(plan.segments.filter(s => s.kind === "bumper").every(s => s.end - s.start === 15));
  assert.ok(plan.duration > program.dur);
  assert.equal(plan.segments.at(-1).kind, "program");
  for (let i = 1; i < plan.segments.length; i++) assert.equal(plan.segments[i].start, plan.segments[i - 1].end);
  const resumed = chunks[1];
  assert.equal(timing.at(plan, resumed.start).position, 600);
  assert.equal(timing.at(plan, resumed.start - .01).kind === "program", false);
  assert.equal(timing.at(plan, resumed.start + 15).position, 615);
});

test("every viewer gets identical ad order and bumper placement for the same show slot", () => {
  assert.deepEqual(timing.build(program, policy, ads, bumpers, "same"), timing.build(program, policy, ads, bumpers, "same"));
  assert.notDeepEqual(timing.build(program, policy, ads, bumpers, "same"), timing.build(program, policy, ads, bumpers, "different"));
});

test("other channels and short shows retain uninterrupted runtime; no break at the end", () => {
  assert.equal(timing.build(program, null, ads, bumpers, "x").duration, program.dur);
  assert.equal(timing.build(program, policy, [], bumpers, "x").duration, program.dur);
  assert.equal(timing.build({ ...program, dur: 660 }, policy, ads, bumpers, "x").duration, 660);
  assert.equal(timing.build({ ...program, dur: 600 }, policy, ads, bumpers, "x").duration, 600);
});

test("only dated, pre-2000 individual commercial spots qualify", () => {
  const data = year => ({ metadata: { date: year, title: "Vintage ad" }, files: [{ name: "ad.mp4", width: 640, height: 480, length: 30, size: 1000000 }] });
  assert.equal(commercialRow("1999", data("1999-12-31"))[4], "1999");
  assert.equal(commercialRow("modern", data("2000-01-01")), null);
  assert.equal(commercialRow("undated", data("")), null);
  const compilation = data("1995"); compilation.files[0].length = 3600;
  assert.equal(commercialRow("compilation", compilation), null);
});

test("commercials play to completion, never cut off to hit an exact break length", () => {
  const picked = timing.pack([{ id: "a", dur: 29.97 }, { id: "b", dur: 59.94 }], 165, "seed");
  assert.ok(picked.every(p => [29.97, 59.94].includes(p.dur)));
  assert.ok(picked.reduce((s, p) => s + p.dur, 0) <= 165.001);
  for (let i = 1; i < picked.length; i++) assert.notEqual(picked[i].id, picked[i - 1].id);
});

test("continuous guide slots cross clock boundaries without clipping the start of another episode", () => {
  const timeline = timing.build(program, policy, ads, bumpers, "stable-program");
  const templates = [{ m: program, timeline, start: 0, v0: 0, end: timeline.duration },
    { m: { ...program, id: "next" }, start: 0, v0: 0, end: 2700 }];
  const guide = timing.cycle(templates, 0, timeline.duration - 1, 5);
  assert.equal(guide[0].start, 0);
  assert.equal(guide[0].end, timeline.duration);
  for (let i = 1; i < guide.length; i++) {
    assert.equal(guide[i].start, guide[i - 1].end);
    assert.equal(guide[i].v0, guide[i].start);
    assert.equal(guide[i].end - guide[i].start, templates[i % 2].end);
  }
  assert.equal(timing.cycle(templates, 0, timeline.duration, 1)[0].m.id, "next");
  const now = timing.cycle(templates, 0, 10800 + 33, 1)[0];
  assert.ok(now.start <= 10833 && now.end > 10833);
});
