# Reviewed Subspace 97 captions

These WebVTT tracks are extracted from the original Internet Archive MP4/MKV videos
associated with the channel's selected episodes. Source item, filename, stream
duration, content digest and speech-check results are recorded in `manifest.json`.
They are not described as openly licensed merely because the videos are accessible.

Before linking a track, extraction checks MP4 edit lists/presentation timestamps
or Matroska cue/block timestamps, the relationship to the selected stream and its duration. Independent
early and late dialogue samples are compared with the streamed English audio
using local speech recognition. This is automated spot checking, not a complete
manual transcription review. Caption sentences may appear ahead of speech to
allow reading; the validation record specifies the accepted timing tolerances.

The catalog builder links only the exact reviewed video with an intact caption
asset. Removing a validation record, changing the selected video or modifying its
caption file makes the catalog stop advertising that local CC track. Publication
copies approved assets to `subs/` after restoring the ordinary subtitle cache, so
an old empty cached file cannot hide a newly enabled track.

To reproduce an extraction without downloading the full source video:

```text
node scripts/extract-captions.mjs ARCHIVE_ID "SELECTED_VIDEO.mp4" OUTPUT.vtt
```

This command produces a candidate only. It does not add a validation record or
enable CC. The MP4 extractor supports timed text and edit lists; the Matroska
extractor supports indexed UTF-8/ASS text and checks cue timestamps against the
actual block timestamps. Unsupported tracks and inconsistent indexes are rejected.
