Winamp Deck radio appearance — November 13, 2026 (Chicago)

Original early-2000s desktop-player styling for Rabbit Ears: graphite bevels, ribbed window headers, green display type, a stream-clock module, real transport/volume controls and a numbered station-library window. The player sits above the appearance choices and station library at every window width, including maximized desktops. Vinyl and Car Stereo remain available. The appearance is independent of the main viewing skin.

The existing Audio element and radio engine are retained. Stream time follows currentTime from real playback events. Changing appearance does not call load or play. Search, genres, favorite station controls, previous/next station, start/stop and volume remain the original working controls. This adds no Web Audio interception or audio processing.

Source: assets/radio-winamp.css and assets/radio-winamp.js; registry/in-place restoration in assets/interface.js. Radio appearance winamp is accepted by both the account-preference client and authenticated backend. Existing account synchronization and offline rules apply.

Real Chrome validation: decoded a silent WAV fixture through the actual Audio element, observed stream time advance, changed all three looks with playback retained and zero play/load calls, changed volume and stopped normally, verified saved appearance on reload. Checked Winamp appearance across all nine viewing skins at 320/390/768/1440/1920/2560px with no document overflow and the player above settings/stations in all 54 layouts. Profile hydration accepts Winamp and clears it when switching to an account using the default appearance. Backend tests cover saved Winamp, stale-version conflicts, unrelated volume merges and user isolation (29 checks).

These are local review captures with explicit fictional station fixtures, not a current production station announcement. The live station directory and available streams remain unchanged.
