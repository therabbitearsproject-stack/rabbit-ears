import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../media-compatibility.js", import.meta.url), "utf8");
const media = new Function(source + ";return MediaCompatibility;")();
const file = (name, options = {}) => ({ name, length: "2700", width: 1920, height: 1080, size: 900000000, ...options });

test("browser-compatible alternate wins over AC-3 but stays on the same episode", () => {
  const original = file("Season 1/Episode 1.mp4", { audio_codec: "ac3", source: "original" });
  const compatible = file("Season 1/Episode 1.ia.mp4", { original: original.name, source: "derivative", format: "h.264 IA" });
  const unrelated = file("Preview.ia.mp4", { source: "derivative", format: "h.264 IA", length: 12 });
  assert.equal(media.choose([unrelated, compatible, original], original), compatible);
});

test("full-quality AAC original is retained when it is better than the alternate", () => {
  const original = file("Episode.mp4", { audio_codec: "aac" });
  const alternate = file("Episode.ia.mp4", { source: "derivative", original: original.name, format: "h.264 IA", width: 854, height: 480 });
  assert.equal(media.choose([original, alternate], original), original);
});

test("matching follows Archive original chains and chooses the best compatible resolution", () => {
  const original = file("Episode.mkv");
  const old = file("Episode_512kb.mp4", { original: original.name, source: "derivative", format: "h.264", width: 320, height: 240 });
  const better = file("Episode.ia.mp4", { original: original.name, source: "derivative", format: "h.264 IA" });
  assert.equal(media.choose([original, old, better], old), better);
});

test("unrelated files, language paths and shortened cuts cannot replace the selected program", () => {
  const selected = file("English/Episode.mp4");
  const other = file("French/Episode.ia.mp4", { source: "derivative", format: "h.264 IA" });
  const shortened = file("English/Episode.ia.mp4", { source: "derivative", format: "h.264 IA", length: 120 });
  assert.equal(media.choose([selected, other, shortened], selected), selected);
});

test("unknown originals stay available when no compatible alternate exists", () => {
  const selected = file("Silent Film.mp4");
  assert.equal(media.choose([selected], selected), selected);
  assert.equal(media.choose([], null), null);
  assert.equal(media.knownCompatible(file("x.mp4", { audio_codec: "eac3" })), false);
});

test("two episodes derived from the same disc image are never interchangeable", () => {
  const selected = file("S01E01.mp4", { original: "Season1.iso" });
  const other = file("S01E02.ia.mp4", { original: "Season1.iso", source: "derivative", format: "h.264 IA" });
  assert.equal(media.choose([selected, other], selected), selected);
});
