/* Adapted from Spelunkr Desktop.
MIT License

Copyright (c) 2026 Spelunkr Desktop contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This license covers only this independent desktop wrapper and its original
icon. It grants no rights to Spelunkr's website, branding, programming, or
third-party videos. Those remain the property of their respective owners.

*/
'use strict';
(function(root) {
  const BANDS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const defaults = () => ({enabled: true, denoise:0, normalize: false, compression: false, amount: 35, linked: true,
    makeup: 2.1, position: 'pre', eq: false, bands: BANDS.map(() => 0)});
  function settings(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const d = defaults(), amount = number(value.amount, d.amount, 0, 100), linked = value.linked !== false;
    return {enabled: value.enabled !== false, denoise:number(value.denoise,0,0,100), normalize: value.normalize === true, compression: value.compression === true,
      amount, linked, makeup: linked ? amount * .06 : number(value.makeup, d.makeup, -12, 18),
      position: value.position === 'post' ? 'post' : 'pre', eq: value.eq === true,
      bands: BANDS.map((_, i) => number(value.bands?.[i], 0, -12, 12))};
  }
  const preset = (id, name, description, values) => ({id, name, description, settings: settings({...defaults(), ...values})});
  const PRESETS = [
    preset('original', 'Straight from the VCR', 'Original sound. All effects off.', {}),
    preset('surfer', 'Channel Surfer', 'Smooth out level changes between shows and commercials.', {normalize:true}),
    preset('living-room', "Living Room â€™89", 'Gentle leveling, a warm middle, and softer tape hiss.', {denoise:20,normalize:true, compression:true, amount:25, eq:true, bands:[-5,-3,0,1,0,0,1,0,-2,-4]}),
    preset('rabbit-ears', 'Rabbit Ears', 'Bring dialogue forward; ease low rumble and bright hiss.', {denoise:30,normalize:true, compression:true, amount:35, eq:true, bands:[-9,-6,-3,-1,0,1,2,2,-3,-6]}),
    preset('late-show', 'The Late Late Show', 'Narrower dynamics for quiet evening listening.', {denoise:20,normalize:true, compression:true, amount:70, position:'post', eq:true, bands:[-6,-4,-2,0,0,1,2,1,-2,-4]}),
    preset('hifi', 'Hi-Fi Stereo', 'A small bass and presence lift for cleaner stereo tapes.', {compression:true, amount:15, eq:true, bands:[0,2,1,0,-1,0,1,1,0,-1]})
  ];
  function config(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const presets = [], used = new Set(PRESETS.map(p => p.name.toLowerCase()));
    for (const p of Array.isArray(value.presets) ? value.presets.slice(0,32) : []) {
      const name = typeof p?.name === 'string' ? p.name.trim().slice(0,48) : '';
      if (!name || used.has(name.toLowerCase())) continue;
      used.add(name.toLowerCase()); presets.push({name, settings:settings(p.settings)});
    }
    return {version:1, cleanup:value.cleanup === true, current:settings(value.current), presets};
  }
  const active = s => s.enabled && (s.denoise>0 || s.normalize || s.compression || s.eq);
  const dbToGain = db => Math.pow(10, db / 20);
  const compressor = amount => ({threshold:-12 - amount * .24, ratio:1 + amount * .07, knee:18, attack:.008, release:.22});
  // RMS leveler, not a claim of broadcast LUFS compliance. Freeze on near-silence
  // so tape hiss and pauses cannot slowly drive the gain to its maximum.
  function normalization({rms, peak, volume = 1, previous = 0, seconds = .05}) {
    if (volume <= .001 || !Number.isFinite(rms) || !Number.isFinite(peak)) return previous;
    const raw = rms / volume;
    if (raw < dbToGain(-48)) return previous;
    // Comfortable program level; isolated peaks are handled by the output limiter,
    // rather than pulling the whole program down on every short meter window.
    const target = Math.max(-18, Math.min(12, -14 - 20 * Math.log10(raw)));
    return previous + (target - previous) * (1 - Math.exp(-seconds / (target < previous ? .12 : 2.5)));
  }
  const api = {BANDS, PRESETS, defaults, settings, config, active, dbToGain, compressor, normalization};
  if (typeof module === 'object') module.exports = api; else root.RabbitAudioModel = api;
})(typeof globalThis === 'object' ? globalThis : this);
