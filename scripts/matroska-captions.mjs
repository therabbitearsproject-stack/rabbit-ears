// Sparse extraction of indexed Matroska UTF-8 and ASS subtitles. Unsupported codecs,
// compression, lacing and unindexed tracks fail closed instead of guessing.
export function vint(data, at, id = false) {
  const first = data[at]; let length = 1, marker = 128;
  while (length <= 8 && !(first & marker)) { length++; marker >>= 1; }
  if (length > 8 || at + length > data.length || (id && length > 4)) throw Error('Invalid EBML integer');
  let value = BigInt(id ? first : first & (marker - 1));
  for (let i = 1; i < length; i++) value = (value << 8n) | BigInt(data[at + i]);
  const unknown = !id && value === (1n << BigInt(length * 7)) - 1n;
  if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('EBML integer exceeds safe range');
  return { value: unknown ? null : Number(value), length };
}
export function element(data, at = 0) {
  const id = vint(data, at, true), size = vint(data, at + id.length);
  const start = at + id.length + size.length;
  return { id: id.value, start, end: size.value === null ? data.length : start + size.value, size: size.value };
}
export function elements(data, start = 0, end = data.length) {
  const out = [];
  while (start < end) {
    const e = element(data, start); if (e.end > end || e.end <= start) throw Error('Truncated EBML element');
    out.push(e); start = e.end;
  }
  return out;
}
const uint = (d, e) => { if (!e || e.end - e.start > 6) throw Error('Invalid EBML unsigned integer'); let n = 0; for (let i = e.start; i < e.end; i++) n = n * 256 + d[i]; return n; };
const text = (d, e) => e ? new TextDecoder('utf-8', { fatal: true }).decode(d.subarray(e.start, e.end)) : '';
const get = (d, e, id) => elements(d, e.start, e.end).find(c => c.id === id);
export function assText(packet) {
  let at = 0;
  for (let i = 0; i < 8; i++) { at = packet.indexOf(',', at); if (at < 0) throw Error('Invalid Matroska ASS dialogue'); at++; }
  const body = packet.slice(at);
  if (/\{[^}]*\\p[1-9]/.test(body)) return ''; // vector drawing, not caption text
  return body.replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ').trim();
}
export async function extractMatroska(reader) {
  const head = await reader.read(0, Math.min(65536, reader.length));
  const ebml = element(head), segment = element(head, ebml.end);
  if (ebml.id !== 0x1a45dfa3 || segment.id !== 0x18538067) throw Error('Not a Matroska segment');
  const segmentStart = segment.start;
  async function load(offset, budget = 8_000_000) {
    const h = offset + 16 <= head.length ? head.subarray(offset, offset + 16) : await reader.read(offset, 16);
    const e = element(h); if (e.size === null || e.size > budget) throw Error(`Matroska metadata exceeds budget: ${e.id.toString(16)} at ${offset}, ${e.size} bytes`);
    return offset + e.end <= head.length ? head.subarray(offset, offset + e.end) : Buffer.concat([h.subarray(0, e.start), await reader.read(offset + e.start, e.size)]);
  }
  const positions = new Map();
  const first = element(head, segmentStart);
  if (first.id !== 0x114d9b74) throw Error('Matroska seek index missing');
  async function seek(offset) {
    const data = await load(offset), parent = element(data);
    for (const s of elements(data, parent.start, parent.end).filter(e => e.id === 0x4dbb)) {
      const id = get(data, s, 0x53ab), pos = get(data, s, 0x53ac);
      const target = vint(data.subarray(id.start, id.end), 0, true).value;
      positions.set(target, segmentStart + uint(data, pos));
    }
  }
  await seek(segmentStart);
  if (!positions.has(0x1c53bb6b) && positions.has(0x114d9b74)) await seek(positions.get(0x114d9b74));
  if (!positions.has(0x1654ae6b)) throw Error('Matroska track index missing');
  const info = await load(positions.get(0x1549a966)), infoRoot = element(info), scaleElement = get(info, infoRoot, 0x2ad7b1), scale = (scaleElement ? uint(info, scaleElement) : 1000000) / 1e9;
  const dur = get(info, infoRoot, 0x4489);
  const duration = dur ? (dur.end - dur.start === 4 ? info.readFloatBE(dur.start) : info.readDoubleBE(dur.start)) * scale : null;
  const tracksData = await load(positions.get(0x1654ae6b)), tracksRoot = element(tracksData);
  const tracks = elements(tracksData, tracksRoot.start, tracksRoot.end).filter(e => e.id === 0xae).map(e => ({
    number: uint(tracksData, get(tracksData, e, 0xd7)), type: uint(tracksData, get(tracksData, e, 0x83)),
    codec: text(tracksData, get(tracksData, e, 0x86)), language: text(tracksData, get(tracksData, e, 0x22b59c)) || 'eng',
    compressed: !!get(tracksData, e, 0x6d80)
  }));
  const track = tracks.find(t => t.type === 17 && ['S_TEXT/UTF8', 'S_TEXT/ASS'].includes(t.codec) && ['eng', 'en', 'und'].includes(t.language) && !t.compressed);
  if (!track) return { tracks, cues: [], duration, reason: 'no-english-matroska-text-track' };
  if (!positions.has(0x1c53bb6b)) throw Error('Matroska cue index missing');
  const index = await load(positions.get(0x1c53bb6b)), indexRoot = element(index), entries = [];
  for (const point of elements(index, indexRoot.start, indexRoot.end).filter(e => e.id === 0xbb)) {
    const start = uint(index, get(index, point, 0xb3)) * scale;
    for (const position of elements(index, point.start, point.end).filter(e => e.id === 0xb7)) {
      if (uint(index, get(index, position, 0xf7)) !== track.number) continue;
      const relative = get(index, position, 0xf0); if (!relative) throw Error('Subtitle index has no relative block positions');
      entries.push({ start, cluster: segmentStart + uint(index, get(index, position, 0xf1)), relative: uint(index, relative) });
    }
  }
  if (entries.length < 30 || entries.length > 10000) throw Error('Incomplete Matroska subtitle index');
  const clusters = [...new Set(entries.map(e => e.cluster))], clusterData = new Map();
  for (let i = 0; i < clusters.length; i += 128) {
    const batch = clusters.slice(i, i + 128), bodies = await reader.ranges(batch.map(c => ({ start: c, end: Math.min(reader.length - 1, c + 127) })));
    batch.forEach((c, j) => {
      const data = bodies[j], e = element(data); if (e.id !== 0x1f43b675) throw Error('Invalid indexed cluster');
      let at = e.start, clock;
      while (at + 2 < data.length) { const field = element(data, at); if (field.id === 0xe7) { clock = uint(data, field); break; } if (field.end > data.length) break; at = field.end; }
      if (clock === undefined) throw Error('Cluster timestamp missing');
      clusterData.set(c, { start: c + e.start, clock });
    });
  }
  const cues = [];
  for (let i = 0; i < entries.length; i += 128) {
    const batch = entries.slice(i, i + 128), ranges = batch.map(e => { const start = clusterData.get(e.cluster).start + e.relative; return { start, end: Math.min(reader.length - 1, start + 1023) }; });
    const blocks = await reader.ranges(ranges);
    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j]; let data = blocks[j], group = element(data);
      if (group.end > data.length) { if (group.end > 65536) throw Error('Subtitle block exceeds budget'); data = await reader.read(ranges[j].start, group.end); group = element(data); }
      if (group.id !== 0xa0) throw Error('Subtitle index does not point to a block group');
      const block = get(data, group, 0xa1), length = get(data, group, 0x9b); if (!block || !length) throw Error('Subtitle block duration missing');
      const id = vint(data, block.start), at = block.start + id.length;
      if (id.value !== track.number || (data[at + 2] & 6)) throw Error('Unexpected subtitle track or lacing');
      const start = (clusterData.get(entry.cluster).clock + data.readInt16BE(at)) * scale;
      if (Math.abs(start - entry.start) > .001) throw Error('Subtitle index clock mismatch');
      let body = text(data, { start: at + 3, end: block.end }).replace(/\r\n?/g, '\n').trim();
      if (track.codec === 'S_TEXT/ASS') body = assText(body);
      if (body) cues.push({ start, end: start + uint(data, length) * scale, text: body });
    }
  }
  return { tracks, track, duration, cues };
}
