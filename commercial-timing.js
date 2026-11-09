// Pure shared-clock planning: commercials belong to a show's slot, never the TV guide.
const CommercialTiming = (() => {
  const hash = value => { let n = 2166136261; for (const c of String(value)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
  function pack(ads, target, seed) {
    const order = ads.map(media => ({ media, rank: hash(seed + media.id) }))
      .sort((a, b) => a.rank - b.rank || a.media.id.localeCompare(b.media.id)).map(a => a.media);
    const result = []; let remaining = target;
    for (let cycle = 0; cycle < 30 && remaining >= 8; cycle++) {
      const next = order.find(a => a.dur <= remaining + .001 && (result.length === 0 || a.id !== result.at(-1).id));
      if (!next) break;
      result.push(next); remaining -= next.dur;
      order.push(...order.splice(order.indexOf(next), 1));
    }
    return result;
  }
  function build(program, policy, ads, bumpers, seed) {
    const duration = program.dur, segments = []; let content = 0, t = 0, breakNo = 0;
    const append = (kind, media, length, offset = 0) => { segments.push({ kind, media, start: t, end: t + length, offset, index: segments.length }); t += length; };
    const interval = policy?.interval || duration;
    while (content < duration) {
      const length = Math.min(interval, duration - content);
      append("program", program, length, content); content += length;
      if (!policy || !ads.length || duration - content < policy.minTail || content >= duration) continue;
      const key = seed + ":break:" + breakNo++, bumper = bumpers.length ? bumpers[hash(key) % bumpers.length] : null;
      const before = hash(key + ":position") % 2 === 0;
      if (bumper && before) append("bumper", bumper, bumper.dur);
      for (const ad of pack(ads, policy.target - (bumper?.dur || 0), key)) append("commercial", ad, ad.dur);
      if (bumper && !before) append("bumper", bumper, bumper.dur);
    }
    return { segments, duration: t };
  }
  function at(timeline, elapsed) {
    const segment = timeline.segments.find(s => elapsed >= s.start && elapsed < s.end) || timeline.segments.at(-1);
    return { ...segment, position: segment.offset + Math.max(0, Math.min(segment.end - segment.start, elapsed - segment.start)) };
  }
  function cycle(templates, epoch, time, count) {
    const offsets = []; let total = 0;
    for (const p of templates) { offsets.push(total); total += p.end; }
    if (!total) throw new Error("Empty continuous schedule");
    let round = Math.floor((time - epoch) / total), offset = time - epoch - round * total;
    let index = templates.findIndex((p, i) => offsets[i] + p.end > offset);
    const result = [];
    for (let n = 0; n < count; n++) {
      const p = templates[index], start = epoch + round * total + offsets[index];
      result.push({ ...p, start, v0: start, end: start + p.end });
      if (++index === templates.length) { index = 0; round++; }
    }
    return result;
  }
  // A named channel library must never silently use another channel's breaks.
  function library(catalog, id) {
    const source = id ? catalog?.breakLibraries?.[id] : catalog;
    const commercials = (source?.commercials || []).map(r => Array.isArray(r)
      ? { id: r[0], file: r[1], dur: r[2], title: r[3], year: r[4], archiveId: r[6] } : r)
      .filter(m => Number(m.year) >= 1970 && Number(m.year) <= 1999);
    return { commercials, bumpers: source?.bumpers || [] };
  }
  return { build, at, pack, cycle, library };
})();
