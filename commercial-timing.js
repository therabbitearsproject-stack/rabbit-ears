// Pure shared-clock planning: commercials belong to a show's slot, never the TV guide.
const CommercialTiming = (() => {
  const hash = value => { let n = 2166136261; for (const c of String(value)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
  const fileKey = media => media.file ? (media.archiveId && !media.local ? media.archiveId + "|" : "") + media.file : "";
  function pack(ads, target, seed, { unique = false, maxSpots = 30 } = {}) {
    const order = ads.map(media => ({ media, rank: hash(seed + media.id) }))
      .sort((a, b) => a.rank - b.rank || a.media.id.localeCompare(b.media.id)).map(a => a.media);
    const result = [], usedIds = new Set(), usedFiles = new Set(); let remaining = target;
    for (let cycle = 0; cycle < 30 && result.length < maxSpots && remaining >= 8; cycle++) {
      const next = order.find(a => a.dur <= remaining + .001 && (result.length === 0 || a.id !== result.at(-1).id) &&
        (!unique || (!usedIds.has(a.id) && (!fileKey(a) || !usedFiles.has(fileKey(a))))));
      if (!next) break;
      result.push(next); remaining -= next.dur;
      usedIds.add(next.id); if (fileKey(next)) usedFiles.add(fileKey(next));
      order.push(...order.splice(order.indexOf(next), 1));
    }
    return result;
  }
  // Subspace keeps one shuffled rolling deck per show instead of reranking the
  // same short list for every break. Move played spots to the back and prefer
  // spots absent from the preceding two breaks; tiny pools may repeat only when
  // no other complete spot fits. No browser history or random clock is involved.
  function rollingDeck(items, seed) {
    const ids = new Set(), files = new Set();
    const order = items.map(media => ({ media, rank: hash(seed + media.id) }))
      .sort((a, b) => a.rank - b.rank || a.media.id.localeCompare(b.media.id))
      .map(a => a.media).filter(media => {
        if (ids.has(media.id) || fileKey(media) && files.has(fileKey(media))) return false;
        ids.add(media.id); if (fileKey(media)) files.add(fileKey(media));
        return true;
      });
    return (target, maxSpots, recent = [], excluded = [], firstRole = null, allowed = () => true) => {
      const chosen = [], usedIds = new Set(excluded.map(m => m.id));
      const usedFiles = new Set(excluded.map(fileKey).filter(Boolean));
      const recentIds = new Set(recent.map(m => m.id));
      const recentFiles = new Set(recent.map(fileKey).filter(Boolean));
      let remaining = target;
      while (chosen.length < maxSpots && remaining >= 8) {
        const fits = media => allowed(media) && media.dur <= remaining + .001 && !usedIds.has(media.id) && (!fileKey(media) || !usedFiles.has(fileKey(media)));
        const priority = chosen.length === 0 && firstRole && order.some(media => fits(media) && media.role === firstRole);
        const eligible = media => fits(media) && (!priority || media.role === firstRole);
        const next = order.find(media => eligible(media) && !recentIds.has(media.id) && (!fileKey(media) || !recentFiles.has(fileKey(media)))) || order.find(eligible);
        if (!next) break;
        chosen.push(next); remaining -= next.dur;
        usedIds.add(next.id); if (fileKey(next)) usedFiles.add(fileKey(next));
        order.push(...order.splice(order.indexOf(next), 1));
      }
      return chosen;
    };
  }
  // A fresh, deterministic deck for each channel's whole programme rotation.
  // Eligible years/topics can vary per show without resetting recent-ad history.
  function rotation(ads, seed) {
    const deck = rollingDeck(ads, seed), recent = [];
    return (eligible, target, maxSpots = 2) => {
      const keys = new Set(eligible.map(media => media.id + "|" + fileKey(media)));
      const chosen = deck(target, maxSpots, recent.flat(), [], null,
        media => keys.has(media.id + "|" + fileKey(media)));
      recent.push(chosen); if (recent.length > 2) recent.shift();
      return chosen;
    };
  }
  function build(program, policy, ads, bumpers, seed, adRotation = null) {
    // Midnight Mirage's fixed-era movie spots are a BETWEEN-FILMS pod, never
    // scene interruptions. The film's release year does not limit these spots.
    if (policy?.mix === "between-films") {
      const segments = [{ kind: "program", media: program, start: 0, end: program.dur, offset: 0, index: 0 }];
      let duration = program.dur;
      const eligible = ads.filter(m => m.role === "movie-tv-spot" && Number.isInteger(Number(m.year)) &&
        Number(m.year) >= 1980 && Number(m.year) <= 1999 && Number.isFinite(m.dur) && m.dur >= 8 && m.dur <= 90);
      for (const media of adRotation ? adRotation(eligible, policy.target || 120, policy.maxAds || 3) : pack(eligible, policy.target || 120, seed + ":after-film", { unique: true, maxSpots: policy.maxAds || 3 })) {
        segments.push({ kind: "commercial", media, start: duration, end: duration + media.dur, offset: 0, index: segments.length });
        duration += media.dur;
      }
      return { segments, duration };
    }
    if (policy?.mix === "era") {
      const year = Number(program.year), window = policy.eraWindow || 2;
      ads = ads.filter(m => Number.isFinite(year) && Math.abs(Number(m.year) - year) <= window);
      bumpers = bumpers.filter(m => !m.series || program.title.startsWith(m.series + " · "));
    }
    const duration = program.dur, segments = []; let content = 0, t = 0, breakNo = 0;
    const subspacePrimary = media => media.role === "star-trek-commercial" || media.role === "subspace-scifi-commercial";
    const trekDeck = policy?.mix === "trek-first" ? rollingDeck(ads.filter(subspacePrimary), seed + ":trek-deck") : null;
    const vintageDeck = policy?.mix === "trek-first" ? rollingDeck(ads.filter(m => !subspacePrimary(m)), seed + ":vintage-deck") : null;
    const recentBreaks = [];
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
        // One general vintage spot every third break; never use vintage ads to fill gaps.
        const vintage = number % (policy.vintageEvery || 3) === (policy.vintageEvery || 3) - 1
          ? vintageDeck(budget, 1, recentBreaks.flat())[0] : null;
        if (vintage) budget -= vintage.dur;
        const spots = trekDeck(budget, (policy.maxAds || 3) - (vintage ? 1 : 0), recentBreaks.flat(), vintage ? [vintage] : [], "star-trek-commercial");
        if (vintage) spots.splice(hash(key + ":insert") % (spots.length + 1), 0, vintage);
        recentBreaks.push(spots); if (recentBreaks.length > 2) recentBreaks.shift();
        if (bookends[0]) append("bumper", bookends[0], bookends[0].dur);
        for (const ad of spots) append("commercial", ad, ad.dur);
        if (bookends[1]) append("bumper", bookends[1], bookends[1].dur);
        continue;
      }
      const bumper = bumpers.length ? bumpers[hash(key) % bumpers.length] : null;
      const before = hash(key + ":position") % 2 === 0;
      if (bumper && before) append("bumper", bumper, bumper.dur);
      const spots = adRotation ? adRotation(ads, policy.target - (bumper?.dur || 0), policy.maxAds || 30) : pack(ads, policy.target - (bumper?.dur || 0), key, { unique: !!policy.uniqueAds, maxSpots: policy.maxAds || 30 });
      for (const ad of spots) append("commercial", ad, ad.dur);
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
  function library(catalog, id, themedAds = []) {
    const source = id ? catalog?.breakLibraries?.[id] : catalog;
    const [first, last] = source?.yearRange || [1970, 1999];
    const commercials = (source?.commercials || []).map(r => Array.isArray(r)
      ? { id: r[0], file: r[1], dur: r[2], title: r[3], year: r[4], archiveId: r[6] } : r)
      .filter(m => Number(m.year) >= first && Number(m.year) <= last);
    if (!themedAds.length) return { commercials, bumpers: source?.bumpers || [] };
    const ids = new Set(), files = new Set();
    const combined = [...commercials, ...themedAds.filter(media =>
      Number.isInteger(Number(media.year)) && Number(media.year) >= 1940 && Number(media.year) <= 2008 &&
      Number.isFinite(media.dur) && media.dur >= 8 && media.dur <= 90)].filter(media => {
      if (ids.has(media.id) || fileKey(media) && files.has(fileKey(media))) return false;
      ids.add(media.id); if (fileKey(media)) files.add(fileKey(media));
      return true;
    });
    // Added consumer spots still pass the programme's existing eraWindow in build().
    return { commercials: combined, bumpers: source?.bumpers || [] };
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
  return { build, at, pack, rotation, cycle, library, program, edit };
})();
