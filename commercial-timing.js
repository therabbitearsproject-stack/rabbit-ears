// Pure shared-clock planning: commercials belong to a show's slot, never the TV guide.
const CommercialTiming = (() => {
  const hash = value => { let n = 2166136261; for (const c of String(value)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
  function pack(ads, target, seed, { unique = false, maxSpots = 30 } = {}) {
    const order = ads.map(media => ({ media, rank: hash(seed + media.id) }))
      .sort((a, b) => a.rank - b.rank || a.media.id.localeCompare(b.media.id)).map(a => a.media);
    const result = [], usedIds = new Set(), usedFiles = new Set(); let remaining = target;
    for (let cycle = 0; cycle < 30 && result.length < maxSpots && remaining >= 8; cycle++) {
      const next = order.find(a => a.dur <= remaining + .001 && (result.length === 0 || a.id !== result.at(-1).id) &&
        (!unique || (!usedIds.has(a.id) && (!a.file || !usedFiles.has(a.file)))));
      if (!next) break;
      result.push(next); remaining -= next.dur;
      usedIds.add(next.id); if (next.file) usedFiles.add(next.file);
      order.push(...order.splice(order.indexOf(next), 1));
    }
    return result;
  }
  function build(program, policy, ads, bumpers, seed) {
    if (policy?.mix === "era") {
      const year = Number(program.year), window = policy.eraWindow || 2;
      ads = ads.filter(m => Number.isFinite(year) && Math.abs(Number(m.year) - year) <= window);
      bumpers = bumpers.filter(m => !m.series || program.title.startsWith(m.series + " · "));
    }
    const duration = program.dur, segments = []; let content = 0, t = 0, breakNo = 0;
    const append = (kind, media, length, offset = 0) => { segments.push({ kind, media, start: t, end: t + length, offset, index: segments.length }); t += length; };
    const interval = policy?.interval || duration;
    while (content < duration) {
      const length = Math.min(interval, duration - content);
      append("program", program, length, content); content += length;
      if (!policy || !ads.length || duration - content < policy.minTail || content >= duration) continue;
      const number = breakNo++, key = seed + ":break:" + number;
      if (policy.mix === "trek-first") {
        const choose = (items, salt) => items.length ? items[hash(key + salt) % items.length] : null;
        const custom = choose(bumpers.filter(m => m.role === "custom-bumper"), ":custom");
        const network = choose(bumpers.filter(m => m.role === "network-id"), ":network");
        const bookends = [custom, network].filter(Boolean);
        if (hash(key + ":position") % 2) bookends.reverse();
        let budget = policy.target - bookends.reduce((n, m) => n + m.dur, 0);
        const trek = ads.filter(m => m.role === "star-trek-commercial");
        // One general vintage spot every third break; never use vintage ads to fill gaps.
        const vintage = number % (policy.vintageEvery || 3) === (policy.vintageEvery || 3) - 1
          ? choose(ads.filter(m => m.role !== "star-trek-commercial" && m.dur <= budget), ":vintage") : null;
        if (vintage) budget -= vintage.dur;
        const spots = pack(trek, budget, key, { unique: true, maxSpots: (policy.maxAds || 3) - (vintage ? 1 : 0) });
        if (vintage) spots.splice(hash(key + ":insert") % (spots.length + 1), 0, vintage);
        if (bookends[0]) append("bumper", bookends[0], bookends[0].dur);
        for (const ad of spots) append("commercial", ad, ad.dur);
        if (bookends[1]) append("bumper", bookends[1], bookends[1].dur);
        continue;
      }
      const bumper = bumpers.length ? bumpers[hash(key) % bumpers.length] : null;
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
    const [first, last] = source?.yearRange || [1970, 1999];
    const commercials = (source?.commercials || []).map(r => Array.isArray(r)
      ? { id: r[0], file: r[1], dur: r[2], title: r[3], year: r[4], archiveId: r[6] } : r)
      .filter(m => Number(m.year) >= first && Number(m.year) <= last);
    return { commercials, bumpers: source?.bumpers || [] };
  }
  function program(media) {
    let duration = 0;
    const segments = media.cuts.map(([from, to], index) => {
      const start = duration; duration += to - from;
      return { kind: "program", media, start, end: duration, offset: from, index };
    });
    return { segments, duration };
  }
  function edit(timeline, media) {
    const segments = [];
    for (const segment of timeline.segments) {
      if (segment.kind !== "program") { segments.push({ ...segment }); continue; }
      let cursor = 0;
      for (const [from,to] of media.cuts) {
        const end = cursor + to - from;
        const a = Math.max(cursor, segment.offset), b = Math.min(end, segment.offset + segment.end - segment.start);
        if (b > a) segments.push({ ...segment, start: segment.start + a - segment.offset, end: segment.start + b - segment.offset, offset: from + a - cursor });
        cursor = end;
      }
    }
    segments.forEach((s,i) => s.index = i);
    return { ...timeline, segments };
  }
  return { build, at, pack, cycle, library, program, edit };
})();
