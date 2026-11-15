// Shared by the catalog builder and player. Never swap an episode for another file in its collection.
const MediaCompatibility = (() => {
  const version = "browser-audio-v1";
  const seconds = value => String(value || 0).split(":").reduce((n, part) => n * 60 + Number(part), 0);
  const canonical = name => String(name || "").replace(/\.(mp4|m4v|mkv|avi|mov|mpeg|mpg)$/i, "")
    .replace(/(?:\.ia|_512kb|_h264)$/i, "").toLowerCase();
  function knownCompatible(file) {
    // AAC alone does not make a 10-bit HEVC video a safe browser fallback.
    const video = String(file.video_codec || file.vcodec || file.format || "");
    if (/hevc|h[ .-]?265/i.test(video)) return false;
    const audio = String(file.audio_codec || file.acodec || "");
    if (/ac-?3|eac3|dts|truehd/i.test(audio)) return false;
    return /aac|mp3|mp4a/i.test(audio) || (file.source === "derivative" && /h\.264/i.test(file.format || ""));
  }
  function choose(files, selected, { exclude = [], preferH264 = false } = {}) {
    if (!selected) return null;
    const byName = new Map(files.map(f => [f.name, f]));
    function root(file) {
      const seen = new Set();
      while (file.original && !seen.has(file.name)) {
        // A disc/archive can contain many different programs; it is not a shared video identity.
        if (!/\.(mp4|m4v|mkv|avi|mov|mpeg|mpg|wmv|webm|ogv|flv|vob|ts|m2ts)$/i.test(file.original)) return canonical(file.name);
        seen.add(file.name);
        if (!byName.has(file.original)) return canonical(file.original);
        file = byName.get(file.original);
      }
      return canonical(file.name);
    }
    const identity = root(selected), duration = seconds(selected.length);
    const candidates = files.filter(f => /\.mp4$/i.test(f.name) && !f.private && seconds(f.length) > 5 &&
      root(f) === identity && Math.abs(seconds(f.length) - duration) <= Math.max(2, duration * .005));
    const safe = candidates.filter(f => knownCompatible(f) && !exclude.includes(f.name));
    if (!safe.length) return exclude.length ? null : selected; // No alternate exists: don't replace this program with an unrelated clip.
    safe.sort((a, b) => (preferH264 ? Number(/h[ .]?264|avc/i.test(b.video_codec || b.vcodec || b.format || "")) - Number(/h[ .]?264|avc/i.test(a.video_codec || a.vcodec || a.format || "")) : 0) || Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0) ||
      Number(b.size || 0) / seconds(b.length) - Number(a.size || 0) / seconds(a.length) || a.name.localeCompare(b.name));
    return safe[0];
  }
  return { version, knownCompatible, choose };
})();
