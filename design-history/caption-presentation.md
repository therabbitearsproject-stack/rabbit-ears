# Caption appearance and controls

CC opens **None**, **Yellow** and **White**. A separate **Black backing** checkbox
is optional and defaults to off. Color and backing choices persist on the device;
existing enabled captions migrate to White. Captions remain unavailable for a
program without a caption source.

The face is Arial with Helvetica/sans-serif fallbacks. Text is white (`#fff`) or
yellow (`#ffff00`), with a black outline over a transparent background. Optional
backing uses 85% black. Skin colors and decorative display fonts do not affect it.

Font size follows the active picture height at 6.25%, with a 12px floor for small
players; line height is 1.2 (normally 7.5% of picture height). Captions sit within
5% side margins and at least 1/12 picture height above the bottom. Letterboxing
is accounted for, and visible fullscreen controls move captions upward to avoid
covering them. No cue text or timing is changed.

The browser's WebVTT engine supplies active cues in hidden mode; the site draws
those cues so native browser/OS caption overrides cannot replace the requested
site appearance. Native picture-in-picture/system video fullscreen can use the
native track as a fallback. Site fullscreen includes the styled caption layer.

Reference guidance (these are design choices, not a claim of certification):

- [EBU Tech 3380, section 3.1.2.1](https://tech.ebu.ch/publications/tech3380):
  high-contrast subtitle colors; white/yellow with dark surrounding contrast.
- [W3C Media Accessibility User Requirements, captioning](https://www.w3.org/TR/media-accessibility-reqs/#captioning):
  customizable appearance, outlines, and safe caption positioning. A dark backing
  improves contrast but the user's requested transparent default is preserved.
- [BBC subtitle sizing research](https://bbc.github.io/gaad/how_big_should_subtitles_be/index.html):
  video-relative sizing and the importance of readable line height across screens.
