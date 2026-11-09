# Porchlight — channel 09

The former Gilmore Girls channel is now **Porchlight**: small-town stories, family and relationship dramas, and character-driven dramedies. The name, square lantern-and-coffee logo, guide badge, channel rail and channel page all use the new identity. Existing `#ch9` links keep working.

## Episode lineup

| Series | Eligible episodes | Source |
| --- | ---: | --- |
| Everwood | 89 | [Episode collection](https://archive.org/details/everwood-2002-06) |
| Party of Five | 118 | [Episode collection](https://archive.org/details/party-of-five-complete-series) |
| The O.C. | 92 | [Four-season collection](https://archive.org/details/the-o.c.) |
| Northern Exposure | 110 | [Season 1](https://archive.org/details/northern-exposure-s01), with approved collections for seasons 2–6 |
| Gilmore Girls | 1 | [Recorded Season 2 premiere](https://archive.org/details/wb-s-2-gilmore-girls-angel-and-abc-thieves) |
| Total | 410 | |

The source allowlist accepts full episode filenames, suitable duration and usable resolution. It excludes cast interviews, promos, fan edits, screenshot-only items, unrelated programs, low-resolution Party of Five files and a long combined episode file. All 229 original Everwood/Party of Five MP4s were checked for H.264/AAC headers; selected files must retain the audited SHA-1. The O.C. and Northern Exposure use the Archive's browser-compatible derivatives.

Gilmore Girls is an explicit six-act edit of the mixed recording. The playback windows retain the recap, title sequence and final available bedroom scene, and skip advertising, standalone promos, tape static, Angel and Thieves. The tape cuts the credits. The schedule uses the episode's edited duration, not the full tape's duration. Episode window review evidence is recorded in `scripts/porchlight-library.json`.

## Breaks and period advertising

Breaks follow fifteen minutes of episode content, last at most two minutes including the bumper, and skip the final two minutes. Each break contains at most three unique advertisements; neither an ad ID nor a video file can repeat within that break. If the available unique spots do not fill the target, the episode resumes early. Complete spots play without being shortened. A 44-minute episode now has two breaks instead of four. Advertisements must fall within two years of the episode season's original release year (Northern Exposure uses the filename's airdate). The pool contains 31 dated commercials: seven newly sourced coffee, fashion, retail and music spots, nine preserved vintage spots and fifteen advertiser spots from the existing recorded 1996 SCI FI breaks. Those fifteen are ordinary advertiser commercials; SCI FI network promos and IDs do not enter Porchlight.

Two original Porchlight logo bumpers play throughout the channel. Two [archived CTV O.C. bumpers](https://archive.org/details/ctv-the-oc-bumper-2) are restricted to The O.C.; they cannot announce another series. The preceding production card was trimmed from the first archived bumper. Local source URLs, original filenames, dates, trim evidence, actual durations and checksums are recorded in `assets/porchlight-breaks/manifest.json`.

New commercial sources include [Dunkin' breakfast, 2000](https://archive.org/details/NJY-006_219188-220097), [Gap, 2000](https://archive.org/details/GAPAdvert), [Old Navy, 2001](https://archive.org/details/NJY-006_0-437), [Dunkin' latte, 2004](https://archive.org/details/dunkin-donuts-latte-table-commercial-2004), [Super Target, 2004](https://archive.org/details/super-target-stores-commercial-2004), [iPod shuffle, 2005](https://archive.org/details/i-pod-shuffle), and [Alicia Keys at Target, 2007](https://archive.org/details/target-2007-keys).

## Captions

All 27 episodes of The O.C. Season 1 have validated English subtitles from the [matching AMZN WEB-DL release pack](https://subf2m.co/subtitles/the-oc-the-oc-first-season/english/1963019). Every file passed a full timestamp/coverage check and independent early and late dialogue comparisons against the selected MP4 audio. Speech similarity must reach 0.72, with measured start offsets from −0.75 to +1.0 seconds and no excessive end drift. Checks and exact file hashes are in `captions/manifest.json`.

CC is available only on verified episode/track matches, and is disabled during commercials and bumpers. Other Porchlight episodes do not advertise unverified subtitles. The existing white/yellow options, transparent default and optional backing remain available. Subspace 97's 543 captioned episodes and its Trek-first commercial policy are preserved.

## Validation and maintenance

Run `node --test scripts/*.test.mjs`. Tests cover episode isolation, audited media signatures, era filtering across all 410 episodes, show-specific bumper isolation, six-act continuity, complete advertisements and subtitle integrity. Chrome playback was checked on each series, with all six Gilmore Girls act seeks and O.C. caption/commercial transitions. Local break videos were reviewed at their first, middle and last frames.

Adding a series requires an explicit source and episode pattern; there is no broad title-search fallback. Changing a source file invalidates its codec approval. A failed refresh may reuse approved episodes but cannot revive the former clip compilation. Changes to scripts, captions or Porchlight break assets trigger the catalog rebuild and publication workflow.
