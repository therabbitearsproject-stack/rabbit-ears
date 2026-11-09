// Exact, reviewed episode windows. Mixed-show tapes are never published as whole programs.
export function reviewedEpisodeRow(episode, data) {
  const file = data?.files?.find(f => f.name === episode.file && !f.private);
  const seconds = value => String(value || 0).split(":").reduce((n, p) => n * 60 + Number(p), 0);
  if (!file || !/\.mp4$/i.test(file.name) || Math.abs(seconds(file.length) - episode.sourceDuration) > 2 || Number(file.size) !== episode.sourceSize) return null;
  let end = -1, duration = 0;
  if (!episode.cuts?.length) throw new Error("Episode has no reviewed program windows");
  for (const cut of episode.cuts) {
    if (cut.length !== 2 || !cut.every(Number.isFinite) || cut[0] < 0 || cut[0] < end || cut[1] <= cut[0] || cut[1] > seconds(file.length)) throw new Error("Invalid episode window: " + episode.id);
    duration += cut[1] - cut[0]; end = cut[1];
  }
  if (duration < 1800 || duration > 3600) throw new Error("Not a full Gilmore Girls episode: " + episode.id);
  return [episode.id, file.name, Math.round(duration * 1000) / 1000, episode.title, episode.year, "", episode.archiveId, Number(file.width), Number(file.height), "browser-audio-v1", episode.cuts];
}

export async function buildReviewedEpisodePool(library, loadMetadata, previous = []) {
  const rows = [];
  for (const episode of library.episodes) {
    try {
      const row = reviewedEpisodeRow(episode, await loadMetadata(episode.archiveId));
      if (row) rows.push(row);
    } catch (error) {
      // A failed lookup may reuse only the identical reviewed edit, never an old mixed tape.
      const old = previous.find(r => r[0] === episode.id && r[1] === episode.file && r[6] === episode.archiveId && JSON.stringify(r[10]) === JSON.stringify(episode.cuts));
      if (old) rows.push(old);
      console.log(`! ${episode.title}: ${error.message}; ${old ? "kept reviewed edit" : "unavailable"}`);
    }
  }
  if (!rows.length) throw new Error("No reviewed Gilmore Girls episodes available; refusing promos and mixed-show tapes");
  return rows;
}
