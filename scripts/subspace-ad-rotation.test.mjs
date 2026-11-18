import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stageProgramming } from './stage-programming.mjs';
import { siteCode } from './tv-feed.mjs';

const code = readFileSync(new URL('../commercial-timing.js', import.meta.url), 'utf8');
const timing = new Function(code + '; return CommercialTiming;')();
const policy = { mix: 'trek-first', interval: 900, target: 120, maxAds: 3, vintageEvery: 3, minTail: 120 };
const trek = Array.from({ length: 12 }, (_, i) => ({ id: 'trek-' + i, file: 'trek-' + i + '.mp4', dur: 30, role: 'star-trek-commercial' }));
const vintage = Array.from({ length: 6 }, (_, i) => ({ id: 'vintage-' + i, file: 'vintage-' + i + '.mp4', dur: 30, role: 'recorded-advertiser-spot' }));
const bumpers = [{ id: 'custom', dur: 15, role: 'custom-bumper' }, { id: 'network', dur: 5, role: 'network-id' }];
const build = (seed, ads = [...trek, ...vintage], dur = 18000) => timing.build({ id: seed, dur }, policy, ads, bumpers, seed);
function pods(plan) {
  const result = []; let current;
  for (const segment of plan.segments) {
    if (segment.kind === 'program') { current = []; result.push(current); }
    else current.push(segment);
  }
  return result.filter(pod => pod.length);
}

test('Subspace rolls through the full Trek and vintage pools instead of repeating a favored subset', () => {
  for (let seed = 0; seed < 30; seed++) {
    const plan = build('episode-' + seed), commercials = plan.segments.filter(s => s.kind === 'commercial').map(s => s.media);
    const main = commercials.filter(m => m.role === 'star-trek-commercial');
    const extra = commercials.filter(m => m.role !== 'star-trek-commercial');
    assert.equal(new Set(main.slice(0, trek.length).map(m => m.id)).size, trek.length, 'each Trek spot is reached before recycling the deck');
    assert.equal(new Set(extra.slice(0, vintage.length).map(m => m.id)).size, vintage.length, 'occasional vintage spots also rotate');
    assert.deepEqual(plan, build('episode-' + seed), 'the shared schedule stays deterministic');
  }
});

test('a sufficient pool avoids repeats from the previous two breaks while retaining existing break rules', () => {
  const breaks = pods(build('spacing'));
  for (const [i, pod] of breaks.entries()) {
    const ads = pod.filter(s => s.kind === 'commercial').map(s => s.media);
    const prior = new Set(breaks.slice(Math.max(0, i - 2), i).flat().filter(s => s.kind === 'commercial').map(s => s.media.file));
    assert.ok(ads.every(media => !prior.has(media.file)));
    assert.equal(ads.filter(media => media.role !== 'star-trek-commercial').length, i % 3 === 2 ? 1 : 0);
    assert.ok(ads.length <= 3);
    assert.ok(pod.reduce((n, s) => n + s.end - s.start, 0) <= 120.001);
    assert.equal(pod[0].kind, 'bumper'); assert.equal(pod.at(-1).kind, 'bumper');
  }
});

test('small pools may repeat between breaks but never pad or duplicate an ad within one break', () => {
  const plan = build('small', [trek[0], { ...trek[0], id: 'same-video-alias' }], 2640);
  assert.equal(plan.segments.filter(s => s.kind === 'commercial').length, 2);
  for (const pod of pods(plan)) assert.equal(pod.filter(s => s.kind === 'commercial').length, 1);
  assert.equal(plan.segments.filter(s => s.kind === 'program').reduce((n, s) => n + s.end - s.start, 0), 2640);
});

test('expanded pools are used on new show templates without touching protected slot objects', () => {
  const protectedPlan = structuredClone(build('old', trek.slice(0, 3), 2640));
  const before = JSON.stringify(protectedPlan);
  const expanded = build('new');
  assert.ok(expanded.segments.some(s => s.kind === 'commercial' && s.media.id === 'trek-11'));
  assert.equal(JSON.stringify(protectedPlan), before);
});

test('dated sci-fi crossover spots join the primary rotation while genuine Trek stays in every break', () => {
  const scifi = Array.from({ length: 8 }, (_, i) => ({ id: 'scifi-' + i, file: 'scifi-' + i + '.mp4', dur: 30, role: 'subspace-scifi-commercial' }));
  const plan = build('expanded-scifi', [...trek, ...scifi, ...vintage]);
  const commercials = plan.segments.filter(s => s.kind === 'commercial').map(s => s.media);
  assert.equal(new Set(commercials.filter(m => m.role === 'subspace-scifi-commercial').map(m => m.id)).size, scifi.length);
  for (const [i, pod] of pods(plan).entries()) {
    const ads = pod.filter(s => s.kind === 'commercial').map(s => s.media);
    assert.ok(ads.some(m => m.role === 'star-trek-commercial'));
    assert.equal(ads.filter(m => m.role === 'recorded-advertiser-spot').length, i % 3 === 2 ? 1 : 0);
    assert.equal(new Set(ads.map(m => m.file)).size, ads.length);
  }
});

test('publishing a larger Subspace pool preserves its next two hours and other channel anchors', async () => {
  const previous = {
    html: readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
    catalog: JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8')),
    commercialTiming: code,
    mediaCompatibility: readFileSync(new URL('../media-compatibility.js', import.meta.url), 'utf8')
  };
  const next = structuredClone(previous), now = Date.UTC(2026, 10, 17, 12) / 1000;
  next.catalog.breakLibraries['sci-fi-channel'].commercials.push({
    id: 'new-review-fixture', file: 'fixture-only.mp4', title: 'Expanded primary rotation', dur: 30,
    year: 1996, local: true, role: 'subspace-scifi-commercial'
  });
  next.catalog.programming = await stageProgramming({ previous, next, now });
  const old = siteCode(previous), fresh = siteCode(next);
  const channel = old.BUILT_IN.find(ch => ch.no === 97), updated = fresh.BUILT_IN.find(ch => ch.no === 97);
  assert.ok(next.catalog.programming.channels[97].until >= now + 7200);
  for (const time of [now, now + 3600, now + 7199]) {
    assert.deepEqual((await fresh.lineup(updated, time, 1))[0], (await old.lineup(channel, time, 1))[0]);
  }
  assert.deepEqual(next.catalog.programming.channels[30], previous.catalog.programming.channels[30]);
});
