import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewedEpisodeRow, buildReviewedEpisodePool } from "./reviewed-episodes.mjs";
const timing = new Function(await readFile(new URL("../commercial-timing.js", import.meta.url), "utf8") + ";return CommercialTiming")();
const episode = { id: "gilmore-s02e01", title: "Gilmore Girls · S02E01 · Sadie, Sadie", year: 2001, archiveId: "reviewed-tape", file: "Mixed tape.mp4", sourceDuration: 5000, sourceSize: 500000000, cuts: [[120,720],[900,2100],[2500,3100]] };
const data = { files: [{ name: episode.file, length: 5000, size: 500000000, width: 640, height: 480 }] };

test("only an exact reviewed episode window can enter the Gilmore Girls pool", () => {
  const row = reviewedEpisodeRow(episode, data);
  assert.equal(row[2], 2400);
  assert.equal(row[6], "reviewed-tape");
  assert.deepEqual(row[10], episode.cuts);
  for (const overrides of [{ name: "Cast interview.mp4" }, { private: true }, { length: 30 }, { size: 1234 }]) {
    assert.equal(reviewedEpisodeRow(episode, { files: [{ ...data.files[0], ...overrides }] }), null);
  }
  assert.throws(() => reviewedEpisodeRow({ ...episode, cuts: [[100,200],[150,2500]] }, data), /Invalid episode window/);
  assert.throws(() => reviewedEpisodeRow({ ...episode, cuts: [[0,30]] }, data), /Not a full/);
});

test("unavailable sources may retain the identical approved edit but never a mixed tape or old clips", async () => {
  const library = { episodes: [episode] }, offline = async () => { throw Error("offline"); };
  const row = reviewedEpisodeRow(episode, data);
  assert.deepEqual(await buildReviewedEpisodePool(library, offline, [row]), [row]);
  await assert.rejects(buildReviewedEpisodePool(library, offline, [[episode.archiveId, episode.file, 5000, "Mixed tape", 2001, "", episode.archiveId]]), /No reviewed/);
  await assert.rejects(buildReviewedEpisodePool(library, offline, [[...row.slice(0,10), [[0,5000]]]]), /No reviewed/);
  assert.deepEqual(await buildReviewedEpisodePool(library, async () => data), [row]);
});

test("episode playback skips ads and other programs, seeks correctly and loops only the episode", () => {
  const media = { id: episode.id, dur: 2400, cuts: episode.cuts }, plan = timing.program(media);
  assert.equal(plan.duration, 2400);
  assert.deepEqual(plan.segments.map(s => s.kind), ["program","program","program"]);
  assert.equal(timing.at(plan, 599).position, 719);
  assert.equal(timing.at(plan, 600).position, 900);
  assert.equal(timing.at(plan, 1800).position, 2500);
  assert.equal(timing.at(plan, 2399).position, 3099);
  const slots = timing.cycle([{ m: media, timeline: plan, end: plan.duration }], 0, 2399, 3);
  assert.deepEqual(slots.map(s => [s.start,s.end]), [[0,2400],[2400,4800],[4800,7200]]);
});
