// Reads only MP4 headers and subtitle sample bytes, never the full video.
// The Archive supports multipart byte ranges, so a season does not require
// downloading hundreds of gigabytes of video just to recover its text tracks.
export function boxes(data, start = 0, end = data.length) {
  const out = [];
  while (start + 8 <= end) {
    let size = data.readUInt32BE(start), header = 8;
    const type = data.toString('ascii', start + 4, start + 8);
    if (size === 1) { size = Number(data.readBigUInt64BE(start + 8)); header = 16; }
    if (!size) size = end - start;
    if (!Number.isSafeInteger(size) || size < header || start + size > end) throw Error('Invalid MP4 box: ' + type);
    out.push({ type, start: start + header, end: start + size }); start += size;
  }
  return out;
}
const child = (data, parent, type) => boxes(data, parent.start, parent.end).find(b => b.type === type);
const timeHeader = (data, b) => {
  const v1 = data[b.start] === 1, offset = b.start + (v1 ? 20 : 12);
  return { scale: data.readUInt32BE(offset), duration: v1 ? Number(data.readBigUInt64BE(offset + 4)) : data.readUInt32BE(offset + 4) };
};
export function parseMultipart(data, type, requested) {
  const boundary = type.match(/boundary="?([^";\s]+)/i)?.[1];
  if (!boundary) throw Error('Missing multipart boundary');
  const parts = [];
  let at = 0;
  for (;;) {
    const begin = data.indexOf(Buffer.from('--' + boundary), at);
    if (begin < 0 || data.subarray(begin + boundary.length + 2, begin + boundary.length + 4).toString() === '--') break;
    const split = data.indexOf(Buffer.from('\r\n\r\n'), begin);
    if (split < 0) throw Error('Malformed range headers');
    const header = data.toString('ascii', begin, split), match = header.match(/Content-Range:\s*bytes\s+(\d+)-(\d+)\/\d+/i);
    if (!match) throw Error('Missing content range');
    const start = Number(match[1]), end = Number(match[2]), body = data.subarray(split + 4, split + 5 + end - start);
    if (body.length !== end - start + 1) throw Error('Truncated range');
    parts.push({ start, end, data: body }); at = split + 4 + body.length;
  }
  return requested.map(r => {
    const part = parts.find(p => p.start <= r.start && p.end >= r.end);
    if (!part) throw Error('Missing requested subtitle range');
    return part.data.subarray(r.start - part.start, r.end - part.start + 1);
  });
}
export class RangeReader {
  constructor(url, length) { this.url = url; this.length = Number(length); this.requests = 0; this.bytes = 0; }
  async ranges(ranges) {
    if (!ranges.length || ranges.some(r => !Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.end) || r.start < 0 || r.end < r.start || r.end >= this.length)) throw Error('Subtitle range outside video');
    let error;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        this.requests++;
        const response = await fetch(this.url, { headers: { Range: 'bytes=' + ranges.map(r => `${r.start}-${r.end}`).join(','), 'User-Agent': 'RabbitEarsCaptions/1.0 (+https://rabbit-ears.stream)' }, signal: AbortSignal.timeout(30000) });
        if (response.status !== 206) { await response.body?.cancel(); throw Error('Range request HTTP ' + response.status); }
        this.url = response.url;
        const data = Buffer.from(await response.arrayBuffer()); this.bytes += data.length;
        if (/multipart\/byteranges/i.test(response.headers.get('content-type') || '')) return parseMultipart(data, response.headers.get('content-type'), ranges);
        const range = response.headers.get('content-range')?.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (!range || data.length !== Number(range[2]) - Number(range[1]) + 1 || ranges.some(r => r.start < Number(range[1]) || r.end > Number(range[2]))) throw Error('Unexpected range response');
        return ranges.map(r => data.subarray(r.start - Number(range[1]), r.end - Number(range[1]) + 1));
      } catch (e) { error = e; if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
    }
    throw error;
  }
  async read(start, length) { return (await this.ranges([{ start, end: start + length - 1 }]))[0]; }
  async movie() {
    if (!(this.length > 8)) throw Error('Missing file size');
    let offset = 0;
    for (let count = 0; count < 30 && offset + 8 <= this.length; count++) {
      const h = await this.read(offset, Math.min(16, this.length - offset));
      let size = h.readUInt32BE(0), header = 8;
      if (size === 1) { size = Number(h.readBigUInt64BE(8)); header = 16; }
      if (!size) size = this.length - offset;
      if (!Number.isSafeInteger(size) || size < header || size > this.length - offset) throw Error('Invalid top-level MP4 box');
      if (h.toString('ascii', 4, 8) === 'moov') {
        if (size > 32_000_000) throw Error('Movie header exceeds budget');
        return this.read(offset + header, size - header);
      }
      offset += size;
    }
    throw Error('No MP4 movie header');
  }
}
function edits(data, trak, movieScale, mediaScale) {
  const edts = child(data, trak, 'edts'), elst = edts && child(data, edts, 'elst');
  if (!elst) return null;
  const v1 = data[elst.start] === 1, count = data.readUInt32BE(elst.start + 4), out = [];
  let p = elst.start + 8, clock = 0;
  for (let i = 0; i < count; i++) {
    const duration = (v1 ? Number(data.readBigUInt64BE(p)) : data.readUInt32BE(p)) / movieScale;
    const media = v1 ? Number(data.readBigInt64BE(p + 8)) : data.readInt32BE(p + 4);
    const rateAt = p + (v1 ? 16 : 8);
    if (data.readInt16BE(rateAt) !== 1 || data.readUInt16BE(rateAt + 2)) throw Error('Unsupported edit rate');
    if (media !== -1) out.push({ start: media / mediaScale, end: media / mediaScale + duration, clock });
    clock += duration; p += v1 ? 20 : 12;
  }
  if (out.length > 1) throw Error('Multiple media edits require separate caption review');
  return out;
}
function onMovieClock(start, end, editList) {
  if (!editList) return { start, end };
  const edit = editList.find(e => start < e.end && end > e.start);
  return edit ? { start: Math.max(start, edit.start) - edit.start + edit.clock, end: Math.min(end, edit.end) - edit.start + edit.clock } : null;
}
export function inspectMovie(data) {
  const root = { start: 0, end: data.length }, mvhd = child(data, root, 'mvhd'), movie = timeHeader(data, mvhd), tracks = [];
  for (const trak of boxes(data).filter(b => b.type === 'trak')) {
    const mdia = child(data, trak, 'mdia'); if (!mdia) continue;
    const hdlr = child(data, mdia, 'hdlr'), mdhd = child(data, mdia, 'mdhd'), media = timeHeader(data, mdhd);
    const handler = data.toString('ascii', hdlr.start + 8, hdlr.start + 12);
    const langAt = mdhd.start + (data[mdhd.start] === 1 ? 32 : 20), lang = data.readUInt16BE(langAt);
    const language = [10, 5, 0].map(s => String.fromCharCode(((lang >> s) & 31) + 96)).join('');
    const minf = child(data, mdia, 'minf'), stbl = minf && child(data, minf, 'stbl'), stsd = stbl && child(data, stbl, 'stsd');
    const codec = stsd && data.toString('ascii', stsd.start + 12, stsd.start + 16);
    tracks.push({ handler, codec, language, scale: media.scale, duration: media.duration / media.scale, edits: edits(data, trak, movie.scale, media.scale), stbl, stsd });
  }
  return { duration: movie.duration / movie.scale, tracks };
}
export function subtitleSamples(data, track, limit = 30000) {
  const get = type => child(data, track.stbl, type);
  const stsz = get('stsz'), stts = get('stts'), stsc = get('stsc'), stco = get('stco') || get('co64'), ctts = get('ctts');
  if (!stsz || !stts || !stsc || !stco) throw Error('Missing subtitle sample tables');
  const size = data.readUInt32BE(stsz.start + 4), count = data.readUInt32BE(stsz.start + 8);
  if (count > limit) throw Error('Too many track samples');
  const sizes = Array.from({ length: count }, (_, i) => size || data.readUInt32BE(stsz.start + 12 + i * 4));
  const decode = [], composition = []; let clock = 0;
  for (let i = 0; i < data.readUInt32BE(stts.start + 4); i++) {
    const at = stts.start + 8 + i * 8, n = data.readUInt32BE(at), delta = data.readUInt32BE(at + 4);
    if (decode.length + n > count) throw Error('Invalid subtitle timing table');
    for (let j = 0; j < n; j++) { decode.push({ start: clock / track.scale, end: (clock + delta) / track.scale }); clock += delta; }
  }
  if (decode.length !== count) throw Error('Incomplete subtitle timing table');
  if (ctts) for (let i = 0; i < data.readUInt32BE(ctts.start + 4); i++) {
    const p = ctts.start + 8 + i * 8, n = data.readUInt32BE(p), offset = (data[ctts.start] === 1 ? data.readInt32BE(p + 4) : data.readUInt32BE(p + 4)) / track.scale;
    if (composition.length + n > count) throw Error('Invalid composition timing');
    for (let j = 0; j < n; j++) composition.push(offset);
  }
  if (ctts && composition.length !== count) throw Error('Incomplete composition timing');
  const rules = Array.from({ length: data.readUInt32BE(stsc.start + 4) }, (_, i) => {
    const p = stsc.start + 8 + i * 12;
    if (data.readUInt32BE(p + 8) !== 1) throw Error('Multiple subtitle sample descriptions');
    return { first: data.readUInt32BE(p), n: data.readUInt32BE(p + 4) };
  });
  const samples = []; let rule = 0, sample = 0;
  for (let chunk = 1; chunk <= data.readUInt32BE(stco.start + 4); chunk++) {
    while (rules[rule + 1]?.first <= chunk) rule++;
    const p = stco.start + 8 + (chunk - 1) * (stco.type === 'co64' ? 8 : 4);
    let offset = stco.type === 'co64' ? Number(data.readBigUInt64BE(p)) : data.readUInt32BE(p);
    for (let j = 0; j < rules[rule].n; j++) {
      if (sample >= count) throw Error('Subtitle chunk count mismatch');
      const duration = decode[sample], shift = composition[sample] || 0;
      const timing = onMovieClock(duration.start + shift, duration.end + shift, track.edits);
      if (sizes[sample] > 2 && timing && timing.end > timing.start) samples.push({ ...timing, offset, size: sizes[sample] });
      offset += sizes[sample++];
    }
  }
  if (sample !== count) throw Error('Incomplete subtitle chunk table');
  return samples;
}
export function decodeText(data) {
  const length = data.readUInt16BE(0);
  if (length > data.length - 2) throw Error('Truncated subtitle text');
  const body = data.subarray(2, length + 2);
  const encoding = body[0] === 0xfe && body[1] === 0xff ? 'utf-16be' : body[0] === 0xff && body[1] === 0xfe ? 'utf-16le' : 'utf-8';
  return new TextDecoder(encoding, { fatal: true }).decode(body).replace(/\r\n?/g, '\n').replace(/\0/g, '').trim();
}
const stamp = t => {
  const ms = Math.max(0, Math.round(t * 1000)), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
export const toVtt = cues => 'WEBVTT\n\n' + cues.map(c => `${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`).join('\n\n') + '\n';
export async function extractTrack(reader, data, track) {
  const samples = subtitleSamples(data, track), cues = [];
  for (let i = 0; i < samples.length; i += 128) {
    const batch = samples.slice(i, i + 128);
    const bodies = await reader.ranges(batch.map(s => ({ start: s.offset, end: s.offset + s.size - 1 })));
    batch.forEach((s, j) => { const text = decodeText(bodies[j]); if (text) cues.push({ start: s.start, end: s.end, text }); });
  }
  return cues;
}
