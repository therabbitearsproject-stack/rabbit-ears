CAPTION VERIFICATION AND PUBLICATION

Scope: the282 candidates from the 2026-11-11 source-availability audit whose final cue reached at least95% of the selected video's timeline. The13 shorter candidates and two separate embedded-text discoveries were outside this batch.

Source checks preserve exact Archive item, selected video filename, duration and subtitle bytes. Existing SRT/VTT/ASS text is converted to WebVTT with its original valid timestamps. No new caption dialogue or timing is generated. Tracks containing malformed/empty source cues are held for review; no source cues are silently dropped from published tracks.

All282 prepared WebVTT files were loaded by Chrome's native caption parser and matched their expected cue counts. This is a formatting check, not permission to publish a track whose source had invalid cues.

Independent local speech recognition compares short excerpts near20%,50%,85% of each eligible selected video. Cached Whisper tiny.en/base.en models receive audio only, without the expected caption text as a prompt. Candidate dialogue anchors need seven to24 words and at least five distinct words. Each zone requires text similarity>=0.72, word F1>=0.65, speech start minus caption start between-0.9 and+2seconds, and speech end no later than one second after caption end. Sample offset spread must stay within1.5seconds. Alternate nearby anchors and the base model are tried when needed. Opening/tail or internal caption gaps over120seconds require review. These checks sample dialogue and do not establish word-perfect transcription or every line's synchronization.

Only passed tracks are versioned in captions/, recorded with source/checksum/numeric speech evidence in captions/manifest.json, and linked to exact catalog rows. All final catalog pools revalidate reviewed tracks on rebuild. Missing, changed or unreviewed local assets cannot retain a CC flag. Existing remote sidecar links remain intact.

Protected programming refreshes subtitle metadata only when ID, source, file and duration match exactly. Slot times, scene offsets, cuts, commercials and station bumpers stay unchanged during the protected window. Regression tests cover added/removed links, mismatches and input immutability.

results.json records enabled and pending decisions. Pending means automatic verification was inconclusive or source quality requires repair; it does not prove that the subtitle text is wrong. No paid transcription API or full-video transcription was used.
Additional completeness guard: a repeated identical-caption run longer than60seconds remains pending even if sampled dialogue elsewhere matches.
