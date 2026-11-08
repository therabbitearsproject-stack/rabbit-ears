// One-time authoring tool. Pass a package.json beside installed ffmpeg-static and @resvg/resvg-js.
// Generated MP4s are committed; production needs no renderer or music service.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const require = createRequire(resolve(process.argv[2]));
const { Resvg } = require("@resvg/resvg-js");
const ffmpeg = require("ffmpeg-static");
const out = new URL("../assets/trek-bumpers/", import.meta.url);
const work = resolve(process.argv[3]);
await mkdir(work, { recursive: true });
const facts = JSON.parse(await readFile(new URL("facts.json", out), "utf8"));
const xml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function lines(text, limit) { const result = [""]; for (const word of text.split(" ")) { const i = result.length - 1; if ((result[i] + word).length > limit) result.push(word); else result[i] += (result[i] ? " " : "") + word; } return result; }
function text(text, y, size, color, limit) { return lines(text, limit).map((line, i) => `<text x="110" y="${y + i * size * 1.3}" fill="${color}" font-size="${size}" font-family="Arial">${xml(line)}</text>`).join(""); }
for (let index = 0; index < facts.length; index++) {
  const f = facts[index], png = resolve(work, f.id + ".png"), wav = resolve(work, f.id + ".wav");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960"><rect width="1280" height="960" fill="#08090c"/>${text("RABBIT-EARS.STREAM  /  SUBSPACE SNACK " + String(index + 1).padStart(2, "0"), 138, 22, "#818891", 70)}${text(f.hook, 315, 59, "#ffffff", 32)}${text(f.fact, 520, 37, "#e2e4e8", 49)}${text(f.tag, 780, 27, "#bddb9a", 65)}<text x="110" y="858" font-size="22" fill="#818891" font-family="Arial">[we'll be right back in this timeline.]</text></svg>`;
  await writeFile(png, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
  // Original downtempo synth groove, deterministic noise, soft stereo echo. No sampled music.
  const rate = 44100, n = rate * 15, pcm = Buffer.alloc(n * 4);
  const bpm = 82 + index * 3, step = 60 / bpm / 4, notes = [0, 3, 7, 10, 14, 7, 3, 12];
  const signal = new Float32Array(n); let rng = index + 19;
  for (let i = 0; i < n; i++) {
    const t = i / rate, tick = Math.floor(t / step), u = t - tick * step, beat = tick % 16;
    rng = (Math.imul(rng, 1664525) + 1013904223) | 0; const noise = rng / 2147483648;
    const kick = [0, 6, 8, 11].includes(beat) ? Math.sin(2 * Math.PI * (48 * u + 6 * (1 - Math.exp(-u * 35)))) * Math.exp(-u * 20) * .4 : 0;
    const snare = [4, 12].includes(beat) ? noise * Math.exp(-u * 35) * .15 : 0;
    const hat = noise * Math.exp(-u * 150) * (beat % 2 ? .04 : .025);
    const freq = 110 * 2 ** ((notes[(tick + index) % notes.length] + index * 2) / 12);
    const synth = (Math.sin(2 * Math.PI * freq * t + 1.3 * Math.sin(t * 1.7)) + .2 * Math.sin(2 * Math.PI * freq * 2 * t)) * Math.exp(-u * 8) * .12;
    const echo = i > rate * .31 ? signal[i - Math.floor(rate * .31)] * .22 : 0;
    const fade = Math.min(1, t / .15, (15 - t) / .5);
    signal[i] = kick + snare + hat + synth + echo;
    const pan = Math.sin(t * .7 + index) * .25;
    for (let ch = 0; ch < 2; ch++) pcm.writeInt16LE(Math.round(Math.tanh(signal[i]) * fade * (ch ? 1 + pan : 1 - pan) * 19000), i * 4 + ch * 2);
  }
  const header = Buffer.alloc(44); header.write("RIFF"); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  await writeFile(wav, Buffer.concat([header, pcm]));
  const result = spawnSync(ffmpeg, ["-y", "-loop", "1", "-framerate", "24", "-i", png, "-i", wav, "-t", "15", "-vf", "fade=t=in:st=0:d=0.35,fade=t=out:st=14.6:d=0.4", "-af", "loudnorm=I=-20:TP=-2:LRA=7", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", new URL(f.id + ".mp4", out).pathname.replace(/^\/(\w:)/, "$1")], { encoding: "utf8" });
  if (result.status) throw new Error(result.stderr);
  console.log(f.id + ": 15-second original bumper rendered");
}
