# Subspace 97: SCI FI Channel breaks

Subspace 97 uses a dedicated `sci-fi-channel` break library with six Star Trek commercials, six custom Trek fact bumpers, three authentic SCI FI station bumpers, and 18 recorded SCI FI commercials/promos available for occasional vintage slots.

Every break opens and closes with one custom bumper and one SCI FI station ID; their order varies. Star Trek commercials fill the middle. Only every third break includes one general vintage commercial or network promo. Breaks now follow fifteen minutes of episode content and last at most two minutes, including bumpers, with no more than three advertisements. An ad ID or video file cannot repeat within the same break. If unique full spots do not fill the target, the episode resumes early. There is no break in the final two minutes, and no ad or episode content is cut to force an exact length. A 44-minute episode has two breaks. Everyone receives the same deterministic schedule.

The product advertisements aired in this recorded channel presentation; they are not claimed to be exclusive SCI FI productions. Three commercial-pool entries are network material: Retro TV, Series Collection / Planet of the Apes, and an Inside Space report. Bumpers feature Christopher Lee, the mystery box, and the butterfly station ID. We avoided introductions naming an unrelated upcoming show.

Sources:

- [1996 SCI FI Channel recorded breaks](https://archive.org/details/1996-scifi-channel-breaks-bumpers)
- [SCI FI commercial bumper, September 23, 2004](https://archive.org/details/MNN-002_302316-302469)
- [SCI FI “If” station ID, September 23, 2004](https://archive.org/details/MNN-002_262920-263223)
- [DS9: The Way of the Warrior home-video commercial, 1996](https://archive.org/details/StarTrekDeepSpaceNineTheWayoftheWarriorVideoAdvert)
- [Star Trek PC games and video commercial, 1996](https://archive.org/details/StarTrekPCVideoGamesAdvert)
- [Star Trek VI cinema commercial, 1992](https://archive.org/details/star-trek-vi-the-undiscovered-country-advert)
- [Sega Star Trek game commercial, 1983](https://archive.org/details/SEGA_-_Star_Trek_commercial_USA_1983)
- [Mego Enterprise gift-set commercial, 1976](https://archive.org/details/star-trek-uss-enterprise-gift-set-by-mego-commercial-1976)
- [Star Trek soundtrack collection with Walter Koenig, 1991](https://archive.org/details/StarTrekCollection)

`assets/scifi-breaks/manifest.json` records each source filename, extraction boundaries, actual playback duration and checksum. Clips retain the classic 4:3 picture, with browser-compatible H.264 video and AAC audio. Breaks play complete spots, stay on a shared deterministic clock and resume the episode at its original content position. Caption availability continues to follow the episode; captions are disabled during breaks.

## Reserved for later

The previous generic commercial sources remain in `scripts/commercial-library.json` and the catalog's top-level `commercials`; that general pool is excluded from Subspace 97. Original Trek fact videos and `facts.json` remain in `assets/trek-bumpers/` and the catalog's top-level `bumpers`, and are now explicitly restored to Subspace 97's named library. The playback fallback stays within the named library. Other channels are unchanged. A missing named library cannot silently substitute reserved material.

## Continuing the work

Repository: https://github.com/therabbitearsproject-stack/rabbit-ears

Live site: https://rabbit-ears.stream/

Work is on `main`; GitHub Actions builds the catalog and publishes the site. Run `node --test scripts/*.test.mjs` before pushing. The catalog builder validates every local break asset against the manifest checksum. Changes to the SCI FI assets trigger a catalog rebuild. To add a clip, preserve its source and timing evidence in the manifest and check the entire spot, its first and last frames, and playback in the channel view.

Validation: all 33 active-library files decoded in Chrome with matching durations; Subspace 97's actual timeline contained custom bumpers, SCI FI IDs and Trek ads; CC was disabled during an ad; no page errors. Updated mix tests use the production channel policy across 100 schedule seeds, checking the three-ad cap, unique IDs and video files, two-minute maximum, fifteen-minute spacing, vintage frequency, both bumper types, full clips, deterministic order and unchanged episode content positions. A single available commercial is never repeated to pad a break. Other channels retain their existing break policies.

A shared Codex chat snapshot supplies context only. Repository contribution access and a local checkout are separate from the chat link.
