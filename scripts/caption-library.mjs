import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const captionFile = id => id.replace(/[^A-Za-z0-9._-]/g, '_') + '.vtt';
const root = new URL('../captions/', import.meta.url);
export async function localCaption(name) {
  if (!/^[A-Za-z0-9._-]+\.vtt$/.test(name) || name.includes('..')) throw Error('Invalid local caption filename');
  return readFile(new URL(name, root), 'utf8');
}
export async function applyReviewedCaptions(rows, manifest, load = localCaption) {
  if (!manifest) {
    try { manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; manifest = { episodes: {} }; }
  }
  return Promise.all(rows.map(async row => {
    const out = [...row];
    // Never resurrect a local caption from a previous catalog after its asset
    // or validation record has been removed.
    if (out[5]?.startsWith('local:')) out[5] = '';
    const entry = manifest.episodes?.[out[0]];
    const archiveId = out[6] || out[0];
    if (!entry || !archiveId || entry.video !== out[1] || entry.archiveId !== archiveId ||
        !Number.isFinite(entry.duration) || !Number.isFinite(out[2]) || entry.duration <= 0 ||
        Math.abs(entry.duration - out[2]) > .1 || entry.status !== 'passed') return out;
    const checks = entry.checks || [];
    if (!checks.some(c => c.fraction < .5 && c.pass) || !checks.some(c => c.fraction > .5 && c.pass)) return out;
    try {
      const name = captionFile(out[0]), text = await load(name);
      if (!text.startsWith('WEBVTT\n') || !text.includes(' --> ') || createHash('sha256').update(text).digest('hex') !== entry.sha256) return out;
      out[5] = 'local:' + name;
    } catch { /* Missing or changed assets must not advertise working CC. */ }
    return out;
  }));
}
