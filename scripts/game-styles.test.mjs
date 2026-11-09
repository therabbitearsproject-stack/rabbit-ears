import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLES, OVERRIDES, stylesFor } from "./game-styles.mjs";

const keys = new Set(STYLES.map(s => s.key));

test("every style has a unique key, a name and an icon", () => {
  assert.equal(keys.size, STYLES.length);
  for (const s of STYLES) assert.ok(s.name && s.icon, s.key);
});

test("hand-set styles only use known keys", () => {
  for (const [id, list] of Object.entries(OVERRIDES)) {
    assert.ok(list.length >= 1 && list.length <= 3, id);
    for (const k of list) assert.ok(keys.has(k), `${id}: ${k}`);
  }
});

test("hand-set styles win over the guess", () => {
  assert.deepEqual(stylesFor("bloxors", "Bloxorz racing football", [], ""), ["puzzle"]);
});

test("styles come from titles and tags", () => {
  assert.deepEqual(stylesFor("x1", "Papa's Cupcakeria", [], ""), ["sim"]);
  assert.ok(stylesFor("x2", "Kingdom Rush Tower Defense", [], "").includes("td"));
  assert.ok(stylesFor("x3", "Some Game", ["Racing", "Flash"], "").includes("racing"));
  assert.ok(stylesFor("x4", "Mini Golf World", [], "").includes("sports"));
  assert.ok(stylesFor("x5", "Escape the Room 3", [], "").includes("pointclick"));
});

test("descriptions only add the clearest styles", () => {
  assert.ok(stylesFor("x6", "Blobs", [], "<p>A <b>tower defense</b> game.</p>").includes("td"));
  // "race" in passing in a description shouldn't make it a racing game.
  assert.ok(!stylesFor("x7", "Blobs", [], "Race to the end of each puzzle").includes("racing"));
});

test("at most three styles, and none for an unknown game", () => {
  assert.ok(stylesFor("x8", "Racing soccer tower defense puzzle quiz shooter", [], "").length <= 3);
  assert.deepEqual(stylesFor("x9", "Blorp", [], ""), []);
});

test("shelf fallback styles are real styles", async () => {
  const { SHELF_STYLE } = await import("./game-styles.mjs");
  for (const k of Object.values(SHELF_STYLE)) assert.ok(keys.has(k), k);
});
