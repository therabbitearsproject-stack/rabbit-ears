# Subspace 97: SCI FI Channel breaks

Subspace 97 now uses a dedicated `sci-fi-channel` break library: 18 complete commercials and network promos, with three authentic station bumpers. Commercials are from recorded 1996 SCI FI Channel breaks; the two separately archived station IDs date to 2004 and retain the original SCI FI branding.

The product advertisements aired in this recorded channel presentation; they are not claimed to be exclusive SCI FI productions. Three commercial-pool entries are network material: Retro TV, Series Collection / Planet of the Apes, and an Inside Space report. Bumpers feature Christopher Lee, the mystery box, and the butterfly station ID. We avoided introductions naming an unrelated upcoming show.

Sources:

- [1996 SCI FI Channel recorded breaks](https://archive.org/details/1996-scifi-channel-breaks-bumpers)
- [SCI FI commercial bumper, September 23, 2004](https://archive.org/details/MNN-002_302316-302469)
- [SCI FI “If” station ID, September 23, 2004](https://archive.org/details/MNN-002_262920-263223)

`assets/scifi-breaks/manifest.json` records each source filename, extraction boundaries, actual playback duration and checksum. Clips retain the classic 4:3 picture, with browser-compatible H.264 video and AAC audio. Breaks play complete spots, stay on a shared deterministic clock and resume the episode at its original content position. Caption availability continues to follow the episode; captions are disabled during breaks.

## Reserved for later

The previous generic commercial sources remain in `scripts/commercial-library.json` and the catalog's top-level `commercials`. Original Trek fact videos and `facts.json` remain in `assets/trek-bumpers/` and the catalog's top-level `bumpers`. They are preserved but excluded from Subspace 97, including its playback fallback. Other channels are unchanged. A missing named library cannot silently substitute this reserved material.

## Continuing the work

Repository: https://github.com/therabbitearsproject-stack/rabbit-ears

Live site: https://rabbit-ears.stream/

Work is on `main`; GitHub Actions builds the catalog and publishes the site. Run `node --test scripts/*.test.mjs` before pushing. The catalog builder validates every local break asset against the manifest checksum. Changes to the SCI FI assets trigger a catalog rebuild. To add a clip, preserve its source and timing evidence in the manifest and check the entire spot, its first and last frames, and playback in the channel view.

Validation: all 21 extracted files decoded in Chrome with matching durations; Subspace 97's actual timeline contained only SCI FI library media; CC was disabled during an ad; no page errors. All 36 repository tests passed, including library isolation, full-spot duration and correct episode resume position.

A shared Codex chat snapshot supplies context only. Repository contribution access and a local checkout are separate from the chat link.
