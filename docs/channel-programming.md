# Channel programming — November 11, 2026

All 76 broadcast channels have content and at least two new station bumpers. The catalog contains 28,914 channel/program entries, including 6,514 newly exposed entries from collection uploads; 6,356 prior channel entries were removed by title, subject and duration checks. The smallest pool contains 46 programs. These are catalog entries, not a claim of unique films across channels.

Built-in stations now schedule the entire recorded program duration instead of truncating it at three hours. Movie, TV, sports, animation and intentional short-form channels have separate admission policies. Collection files become separate programs with stable episode identities, actual Archive item identifiers and compatible video selection. Reviewed Subspace and Porchlight sources retain their existing review rules and internal break handling.

There are 158 new 8–12 second bumper videos: two per channel, plus six refreshed Subspace fact cards. Each uses the selected transparent bunny-skull wordmark. Generic IDs cover channels where a fact would feel forced. Fact cards retain source links in the manifest. Music uses 47 Kevin MacLeod recordings across 19 styles, under CC BY 4.0, with distinct trimmed excerpts, short fades and adjusted loudness. Each video carries attribution, and the public /music-credits/ page lists full source/license/change information. The music-source manifest includes 50 available recordings, including alternatives not yet used. No paid music license or media-generation service was used.

142 dated individual archival ads supplement the existing reviewed libraries. Topic selection distinguishes toys, games, computers, cars, kitchen, music, sports, holidays, home, space and outdoors. Ordinary channels insert up to two complete matching ads, at most 60 seconds, between programs, only for 1970–2008 programs and ads within five years of the program date. Short-program stations insert less often. Quiet and archival clip channels omit added commercial pods. Existing reviewed channels keep their own policies. These are historical advertisements, not current endorsements or paid placements.

## Validation and limits

Catalog/player and community/fullscreen tests pass, including six-hour gap-free schedules for all 76 channels, a four-hour program preservation regression, and protected-window/repeated-update cases. 86 sampled remote media URLs responded successfully. All 158 bumper videos and audio streams fully decoded without errors; assets are checksum-verified, and audio excerpts are checked for duplication. Admission by title/duration and sample URL checks cannot establish frame-by-frame completeness, continuing remote availability or rights clearance for every Archive upload. Viewer reports and the existing block list remain important.

Per-channel counts, hours, changes, bumper counts and eligible ad pool sizes are in channel-audit.json. Counts describe this snapshot; daily refreshes can change availability.

## Maintenance

- scripts/channel-policies.json controls program duration and title/subject exclusions.
- scripts/refresh-channel-programs.mjs expands selected collection uploads; scripts/build-catalog.mjs applies admission rules on each refresh.
- scripts/refresh-themed-ads.mjs refreshes individual archival spots; scripts/themed-ad-library.mjs assigns channel themes.
- scripts/channel-branding.json contains station copy, music styles and fact citations.
- scripts/fetch-bumper-music.mjs downloads licensed masters and checks their hashes. Pass an explicit local cache directory.
- scripts/build-channel-bumpers.mjs takes a renderer package.json containing @resvg/resvg-js, an ffmpeg executable, a scratch directory and the downloaded music directory. An optional final channel number rebuilds one station.
- scripts/build-music-credits.mjs rebuilds public attribution. scripts/sync-channel-assets.mjs updates catalog asset metadata after local rendering.
- Generated MP4s, manifests and credits are committed. Full source music, render intermediates, private credentials and caches are excluded.

## Protected programming updates

Every deployment reads the currently published schedule and preserves all programs through at least two hours ahead, plus a 15-minute deployment allowance. Each channel starts its updated cycle at the end of the whole protected program, including its breaks. A long movie is never cut at the two-hour mark. Unchanged deployments retain their previous cycle anchor. Another update during the window preserves already announced programming too. The website and TV feeds use the same embedded protected slots and handover timestamps.

Staging runs after subtitle fetching, immediately before the catalog commit and site assembly. It fails the deployment if the published schedule cannot be read or preserved. Existing tabs on the new version poll for programming updates every five minutes; tabs opened before this feature first ships need one reload. Protection covers schedule changes, not a remote source disappearing or becoming unplayable. The 15-minute allowance assumes assembly and deployment finish within that interval.
