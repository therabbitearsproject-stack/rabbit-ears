Physical hardware redesign, version 2 — November 14, 2026

The owner rejected a shared key geometry recoloured for each theme. This revision uses nine separate hardware architectures: long-travel ivory piano keys; circular projection-booth switches with stationary printed legends; an OB switch matrix with two-row transport; horizontal rubber rockers; a balanced domestic pebble console; broad silver machined plates; upright pearl-white paddles; a stepped digital-deck matrix; and cassette pivot levers with replacement keys.

Source files:
assets/vcr-hardware.css — geometry, machining, mounts, motion and responsive layouts.
assets/vcr-materials.css — image-based surface finishes, colour tints and printed VCR symbols.
assets/vcr-materials/material-atlas.png — original generated artwork.
assets/vcr-materials/material-atlas.jpg — web-optimised artwork (334 KB).

The JPEG is embedded once in the material stylesheet, so native floating TV windows render the materials without fetching another resource. The 3x3 atlas order is Retro/Theatre/Stadium, Modern/Cozy/Metal, Ivory/Pixel/Gutter. Native button actions and audio are unchanged.

Artwork mode: built-in image generation. The exact production prompt is in PROMPT.txt. The provided VCR photos informed the design; generated surfaces are photorealistic artwork, not photographs of those devices.

Verification: all nine skins at desktop/390px/320px; 44px minimum touch targets; no overflow; balanced Cozy layout; visible filled VCR transport glyphs; correct guide/channel/pop-out visibility; native volume and comments work. Native floating-window checks confirmed the material bitmap actually decodes and renders on Metal, Theatre and Gutter. Radio and fullscreen controls remain outside this redesign.
