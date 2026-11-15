# Language artwork and interface sources

Reference material for the November 14 localization release. Playback loads `assets/ui-translations.js`, `assets/ui-language.js`, and the generated logo images, not these authoring files.

- `ui-source.json`: collected interface text; excludes credentials and user content.
- `catalog.final.json`: generated dictionaries with curated core-control and channel-name overrides.
- `overrides.json`, `channel-names.json`: reviewed wording used instead of unreliable short-name machine translations.
- `build_catalog.py`: resumable, one-time local M2M100 authoring; it does not touch the caption/programming queues.
- `build-logos.cjs`: preserves every original SVG pixel above the existing lettering region and renders localized letters into new pixel rectangles. Requires Playwright/Chrome and the Windows fonts used in the source: Microsoft YaHei, Nirmala UI, Tahoma and Lucida Console. No font binaries are redistributed.
- `logo-proof.json`: image/font/line-layout checks for 77 channels × nine translations, each with light/dark variants.

The English set is unchanged. Channel numbers and internal names stay stable. Programme titles and viewer comments remain original. Interface and artwork updates must never regenerate programming.
