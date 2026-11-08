export function commercialRow(id, data) {
  const date = [].concat(data?.metadata?.date || data?.metadata?.year || "")[0];
  const year = Number(String(date).slice(0, 4));
  if (!Number.isInteger(year) || year < 1940 || year > 1999) return null;
  const files = (data.files || []).filter(f => /\.mp4$/i.test(f.name) && !f.private &&
    Number(f.length) >= 8 && Number(f.length) <= 90 && Number(f.width) >= 320 && Number(f.height) >= 240);
  files.sort((a, b) => Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height) || Number(b.size) / Number(b.length) - Number(a.size) / Number(a.length));
  const f = files[0];
  return f ? [id, f.name, Number(f.length), String([].concat(data.metadata.title || id)[0]), String(year), ""] : null;
}
