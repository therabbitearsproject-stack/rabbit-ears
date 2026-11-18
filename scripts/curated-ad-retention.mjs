// Keep deliberately reviewed ads when a limited discovery search does not return
// them again. This does not admit arbitrary old, undated or unverified entries.
const topics = new Set(['toys','games','computers','cars','kitchen','music','sports','holiday','home','space','outdoors']);
export function reviewedAd(media) {
  if (!media || media.curated !== true || media.role !== 'archival-commercial' ||
      !Number.isInteger(media.year) || media.year < 1950 || media.year > 2008 ||
      !Number.isFinite(media.dur) || media.dur < 8 || media.dur > 90 ||
      typeof media.archiveId !== 'string' || media.archiveId !== media.id ||
      typeof media.file !== 'string' || !/\.mp4$/i.test(media.file) ||
      !Array.isArray(media.topics) || !media.topics.length || media.topics.some(t => !topics.has(t))) return false;
  const proof = media.provenance;
  return media.source === 'https://archive.org/details/' + media.archiveId &&
    proof?.metadataUrl === 'https://archive.org/metadata/' + media.archiveId &&
    /^[a-f0-9]{32}$/i.test(proof.archiveMd5 || '') &&
    [200,206].includes(proof.rangeStatus) && Number.isFinite(Date.parse(proof.checkedAt));
}

export function retainReviewedAds(discovered, previous) {
  const kept = previous.filter(reviewedAd), ids = new Set(kept.map(m => m.id));
  return [...kept, ...discovered.filter(m => !ids.has(m.id))].sort((a,b) => a.id.localeCompare(b.id));
}
