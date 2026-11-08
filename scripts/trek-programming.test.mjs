import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeRows, selectEpisodeFiles, buildTrekPool } from "./trek-programming.mjs";

const source = { id: "reviewed-item", series: "Enterprise" };
const file = (name, width, height, length = 2700, extra = {}) => ({ name, width, height, length, size: 500_000_000, ...extra });

test("full HD episodes win over SD copies and the old 12-second preview", () => {
  const files = [file("EP101.mp4", 320, 240, 12.24), file("S01E01.ia.mp4", 854, 480),
    file("S01E01.mp4", 1920, 1080), file("S01E02.mp4", 1920, 1080),
    file("S01E03 Trailer.mp4", 1920, 1080), file("S01E04.mp4", 320, 240),
    file("S01E05.mp4", 1920, 1080, 900), file("S01E06.mp4", 1920, 1080, 14400)];
  assert.deepEqual(selectEpisodeFiles(files, source).map(f => f.name), ["S01E01.mp4", "S01E02.mp4"]);
});

test("same-resolution originals with more detail win over lower-bitrate derivatives", () => {
  const files = [file("S01E01.ia.mp4", 1440, 1080, 2700, { size: 100_000_000 }),
    file("S01E01.mp4", 1440, 1080, 2700, { size: 900_000_000, source: "original" })];
  assert.equal(selectEpisodeFiles(files, source)[0].name, "S01E01.mp4");
});

test("collections with incompatible surround originals require the browser-compatible copy at full resolution", () => {
  const policy = { ...source, audioPolicy: "archive-aac" };
  const original = file("S01E01.mp4", 1440, 1080, 2700, { source: "original", size: 900_000_000 });
  const compatible = file("S01E01.ia.mp4", 1440, 1080, 2700, { source: "derivative", format: "h.264 IA", size: 700_000_000 });
  assert.deepEqual(selectEpisodeFiles([original, compatible], policy), [compatible]);
  assert.deepEqual(selectEpisodeFiles([original], policy), []);
  assert.equal(episodeRows({ files: [original, compatible] }, policy)[0][8], 1080);
});

test("failed refreshes cannot bring an old incompatible-audio original back from the cache", async () => {
  const policy = { ...source, audioPolicy: "archive-aac" };
  const original = ["ep1", "S01E01.mp4", 2700, "Episode", "", "", source.id, 1440, 1080];
  const compatible = ["ep2", "S01E02.ia.mp4", 2700, "Episode", "", "", source.id, 1440, 1080];
  const rows = await buildTrekPool({ sources: [policy] }, async () => { throw new Error("offline"); }, undefined, [original, compatible]);
  assert.deepEqual(rows, [compatible]);
});

test("each full episode gets a distinct stable key, real Archive item and own captions", () => {
  const data = { files: [file("ST9001.TNG-s01e01.Pilot.mp4", 642, 496), file("ST9002.DS9-s01e01.Pilot.mp4", 629, 480)] };
  const rows = episodeRows(data, { id: "ST9_mp4", series: "Star Trek" }, (_, name) => name + ".srt");
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0][0], rows[1][0]);
  assert.equal(rows[0][6], "ST9_mp4");
  assert.match(rows[0][3], /The Next Generation/);
  assert.match(rows[1][3], /Deep Space Nine/);
  assert.equal(rows[0][5], rows[0][1] + ".srt");
  const upgraded = episodeRows({ files: [file(data.files[0].name.replace(".mp4", ".ia.mp4"), 1440, 1080)] }, { id: "ST9_mp4", series: "Star Trek" });
  assert.equal(upgraded[0][0], rows[0][0]);
});

test("failures can reuse approved episodes but never restore unreviewed blurry tapes", async () => {
  const previous = [["old-blurry-tape", "tape.mp4", 7000, "VHS", "", ""],
    ["stable-episode", "S01E01.mp4", 2700, "Episode", "", "", source.id, 1920, 1080]];
  const library = { sources: [source, { id: "rejected", series: "Rejected" }], rejected: [{ id: "rejected" }] };
  const rows = await buildTrekPool(library, async () => { throw new Error("offline"); }, undefined, previous);
  assert.deepEqual(rows, [previous[1]]);
  await assert.rejects(buildTrekPool(library, async () => { throw new Error("offline"); }, undefined, [previous[0]]), /No approved/);
});

test("reviewed caption mappings enable only the matching episode and require a present public file", () => {
  const policy = { id: "continues", series: "Continues", captionFiles: {
    "1x01 Pilgrim.mp4": "101-English-CC.srt", "1x02 Lolani.mp4": "102-English-CC.srt",
    "1x03 Fairest.mp4": "103-English-CC.srt"
  } };
  const files = [file("1x01 Pilgrim.ia.mp4", 1920, 1080), file("1x02 Lolani.mp4", 1920, 1080),
    file("1x03 Fairest.mp4", 1920, 1080), { name: "101-English-CC.srt" },
    { name: "103-English-CC.srt", private: true }, { name: "unrelated.srt" }];
  const rows = episodeRows({ files }, policy);
  assert.deepEqual(rows.map(r => r[5]), ["101-English-CC.srt", "", ""]);
  assert.deepEqual(episodeRows({ files }, { ...policy, captionFiles: undefined }).map(r => r[5]), ["", "", ""]);
});
