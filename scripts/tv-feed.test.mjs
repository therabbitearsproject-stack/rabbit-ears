import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTvFeed, scheduleCode } from "./tv-feed.mjs";

const files = async () => ({
  html: await readFile("index.html", "utf8"), catalog: JSON.parse(await readFile("catalog.json", "utf8")),
  commercialTiming: await readFile("commercial-timing.js", "utf8"), mediaCompatibility: await readFile("media-compatibility.js", "utf8"),
});

test("the schedule code can be found in index.html", async () => {
  const code = scheduleCode((await files()).html);
  assert.match(code, /function lineup/);
  assert.doesNotMatch(code, /document\./);
});

test("every channel gets a gap-free lineup with playable parts", async () => {
  const now = Date.UTC(2026, 10, 10, 12) / 1000;
  const { index, channels, failed } = await buildTvFeed({ ...(await files()), now, hours: 6 });
  assert.deepEqual(failed, []);
  assert.ok(index.channels.length >= 60, "channels: " + index.channels.length);
  for (const { no } of index.channels) {
    const items = channels[no].items;
    assert.ok(items[0].s <= now + 1 && items[0].e > now, `channel ${no} has something on now`);
    assert.ok(items.at(-1).e >= now + 6 * 3600, `channel ${no} covers the window`);
    items.forEach((it, i) => {
      if (i) assert.ok(it.s >= items[i - 1].e - 1, `channel ${no} item ${i} overlaps`);
      assert.ok(it.p.length && it.p.every(([from, to, url]) => to > from && /^https:\/\//.test(url)), `channel ${no} item ${i} parts`);
    });
  }
});
