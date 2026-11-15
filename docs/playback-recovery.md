# Compatible video recovery

Playback-only repair, November 15, 2026. Does not change catalog rows, episode IDs,
program durations, ad placement or the shared schedule.

The reported channel97 Safari26 phone failures were `format not supported` for
Enterprise S01E16 Shuttlepod One. Direct probes identified the original as HEVC
Main10/yuv420p10le with AAC, and its Archive derivative as H264 Main/avc1/yuv420p
with AAC. These observations do not establish that all HEVC is unsupported on iOS.

The player now prefers a verified H264 copy, retries distinct same-episode copies
on media errors or a25-second visible-page startup timeout, and stops after at most
three loaded files. Source generation/segment guards discard stale results after
channel or commercial changes. Autoplay permission requests a tap; it does not
trigger file replacement. Exhaustion shows a message and explicit Retry button.
Commercial failures retain the existing same-channel bumper fallback.

Caption `video` identity remains the original selected filename; only playback
`file` changes. Captions, account preferences and the airing clock stay attached
to the original episode. The previous audio-only cache is ignored. Error records
now include a filename suffix so separate copies can be distinguished.

assets/playback-copies.json holds100 reviewed aliases verified against Archive
metadata on November15. Selected rows come from the existing catalog, and each
alias follows that file's original chain, matching duration within2seconds/0.5%,
with derivative h.264 metadata. The lookup covers available alternates in the nine
reviewed Trek sources plus the KaBlam collection seen in phone errors. It is not a
new admission list: it cannot add a show. A same-origin lookup lets these aliases
work even when a phone cannot fetch Archive metadata. Other programs resolve via
the same bounded identity/duration checks against Archive metadata at runtime.
Regenerate reviewed aliases using MediaCompatibility.choose(files, selected,
{preferH264:true}) against catalog rows and source metadata; never infer another
episode, language directory or disc member from just a similar title.

Regression tests: scripts/playback-recovery.test.mjs and media-compatibility.test.mjs.
The mobile Chromium test exercises the actual full page with a failed initial
metadata request, unsupported original, valid alternate and exhausted playback.
It proves recovery wiring, not real iPhone hardware decoding. Physical iPhone
acceptance remains necessary. The iOS WebKit shell uses this same live code and
revalidates its page requests; there is no second native retry loop.
