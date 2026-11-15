# Interface and channel languages

Settings → App language changes navigation, controls, settings, messages and the subtitle preference. English, Mandarin Chinese, Hindi, Spanish, Arabic, French, Bengali, Portuguese, Indonesian and Urdu are available. Programme titles, viewer comments, music titles, source URLs and account names retain their original wording.

Automatic follows supported device languages first. If none is supported, the existing community service supplies a coarse country-based fallback. It requests no GPS permission and writes no location history or database row for this lookup. A manual choice wins over detection; browser/Discord preference sync stores `re_language_mode` and `re_caption_language`. Old explicit language preferences retain manual behavior.

The site ships static interface dictionaries. Inference does not run during website playback. Core controls and channel names use curated translations; longer descriptions are machine-assisted and can be imperfect. Arabic/Urdu layouts use RTL, while video hardware, timelines and EQ frequency order remain LTR. The DOM adapter handles changed interface nodes without replacing media elements or editing user input values. Stable action IDs and original accessibility-label metadata keep controls independent of translated wording.

The 77 original square pixel illustrations are unchanged. Each of nine additional languages has light/dark logo lettering baked into SVG pixel rectangles: 1,386 new image files. Logos change with App language and theme. Original English assets remain available. Channel numbers, catalog keys, Discord room IDs and programming do not change.

Source strings, curated names, overrides, model-authoring helper, reproducible image generator and per-logo checks are backed up under `design-history/localization-2026-11-14/`. Only the generated image assets and dictionaries are used during playback. The desktop client also ships interface dictionaries for native menus and its local Audio/Controls windows.

Checks cover source-hash caption matching, unchanged programming files, ten-language Unicode translation, automatic/manual precedence, browser/Discord profile isolation, RTL, unchanged media calls, all nine translated logo sets at desktop/phone widths, and original icon-pixel preservation. Machine translation has not been certified by professional translators.
