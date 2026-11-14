# Fullscreen themed transport — 2026-11-14

Fullscreen now moves the original TV transport into its overlay and restores it on exit. The same nine skin layouts, textured keys, volume menu, captions, comments and reactions are retained. No second video or action-forwarding controls are created. The screen key becomes Exit fullscreen; Pop out is disabled until fullscreen is closed.

The existing three-second idle fade, pointer/touch reveal, keyboard-focus protection and open-menu protection remain. Short landscape screens allow vertical overlay scrolling. The bank is constrained to the viewport and to 1000px on wider screens.

Verified all nine skins at 1440x1000, 800x600, 390x844 and 844x390. Verified identical transport/video nodes, matching button finishes, return placement, idle hiding/reveal, volume-menu protection and native browser fullscreen exit. Settings and popout browser checks: 8 passed. Fullscreen browser checks: 2 passed.
`node --test scripts/*.test.mjs`: 128 passed, 15 browser checks skipped in the default environment; dedicated browser runs above explicitly enabled Chrome.
