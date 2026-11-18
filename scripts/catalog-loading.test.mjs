import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const loader = html.slice(html.indexOf('let catalog = null;'), html.indexOf('const catalogRowMedia ='));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function fixture(fetcher, previous = null) {
  const timers = new Map(), requests = [], tuned = [], errors = [];
  let serial = 0;
  const context = vm.createContext({
    AbortController, Error, Promise, console,
    navigator: { onLine: true }, reError: (...args) => errors.push(args),
    fetch: (...args) => { requests.push(args); return fetcher(...args); },
    setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => timers.delete(id),
    BUILT_IN: [{ q: 'channel' }], listCache: { channel: ['existing'] },
    continuousCache: { old: true }, schedCache: {}, effCache: {}, planCache: {}, metaCache: {},
    channels: () => [{ no: 97 }], cur: 0, playing: { title: 'Uninterrupted show' },
    tune: async value => { tuned.push(value); }
  });
  vm.runInContext(loader + '\nglobalThis.load = loadCatalog; globalThis.current = () => catalog; globalThis.seed = value => { catalog = value; };', context);
  context.seed(previous);
  return { context, timers, requests, tuned, errors, load: () => context.load(4000), timeout: () => [...timers.values()][0]() };
}

test('catalog deadline covers a stalled JSON body and ignores its late completion', async () => {
  const body = deferred(), previous = { pools: { channel: [] }, programming: { fingerprint: 'same' } };
  const f = fixture(async () => ({ ok: true, json: () => body.promise }), previous);
  const work = f.load(); await flush();
  assert.equal(f.requests[0][1].signal.aborted, false);
  f.timeout(); await work;
  assert.equal(f.requests[0][1].signal.aborted, true);
  assert.equal(f.context.current(), previous);
  assert.equal(f.timers.size, 0);
  body.resolve({ pools: { changed: [] }, programming: { fingerprint: 'late' } }); await flush();
  assert.equal(f.context.current(), previous);
  assert.equal(f.tuned.length, 0);
  assert.match(f.errors[0][1], /stage=body;http=0;online=true;type=Error/);
});

test('unresponsive catalog headers cannot block startup indefinitely', async () => {
  const headers = deferred(); const f = fixture(() => headers.promise);
  const work = f.load(); f.timeout(); await work;
  assert.equal(f.context.current(), null);
  assert.equal(f.requests[0][1].signal.aborted, true);
  assert.equal(f.timers.size, 0);
  assert.match(f.errors[0][1], /stage=headers/);
});

test('normal caption-only catalog refresh preserves playback and scheduling caches', async () => {
  const previous = { programming: { fingerprint: 'same', channels: {} } };
  const next = { programming: { fingerprint: 'same', channels: {} }, captionsUpdated: true };
  const f = fixture(async () => ({ ok: true, json: async () => next }), previous);
  await f.load();
  assert.equal(f.context.current(), next);
  assert.equal(f.context.continuousCache.old, true);
  assert.equal(f.context.listCache.channel[0], 'existing');
  assert.equal(f.tuned.length, 0);
  assert.equal(f.timers.size, 0);
});

test('failed catalog refresh retains the existing catalog and playing show', async () => {
  const previous = { pools: { channel: [] } };
  const f = fixture(async () => ({ ok: false }), previous);
  await f.load();
  assert.equal(f.context.current(), previous);
  assert.equal(f.tuned.length, 0);
  assert.equal(f.timers.size, 0);
});
