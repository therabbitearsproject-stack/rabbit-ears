# Discord account preferences

Signed-in viewers can restore settings on another device. Guests retain browser-local choices. Settings never include playback position, channels watched, comments, Discord tokens, favorites, or other social data.

The nine synchronized keys are `re_skin`, `re_radio_look`, `re_caption_style`, `re_captions`, `re_caption_backing`, `re_tv_volume`, `re_tv_muted`, `re_vol`, and `re_audio`. Skin includes Gutter and the existing eight choices. Volumes must be finite numbers from 0 through 1; captions allow none, yellow, or white. Caption size remains automatically responsive.

`GET /api/preferences` uses the existing authenticated Discord session. `PUT /api/preferences` requires the exact site Origin, session cookie and matching CSRF header, and accepts `{version,changes}`. The session selects the account; clients cannot supply a user ID. D1 stores one sparse preferences object per stable Discord user ID. Conditional version updates and HTTP 409 responses prevent one device from silently overwriting another device's unrelated choices.

`RabbitPreferences.create({store,apply})` wraps only recognized `store.set` changes, debounces saves, and applies remote values through `REUI.applyPreferences`. Remote application cannot echo back as a new user edit. Account hydration restores server choices while retaining intentional edits made during the request. Failed requests retain local controls and retry. Guest choices are stored separately; switching accounts or signing out cannot copy the preceding account's choices into the next one.

The community auth module publishes `re:session` events. A background session check also covers expiry and other-tab changes. `re:preferences-status` reports local, synced, merging, or offline without exposing credentials. Theme, caption and listening-level restoration does not play, reload or retune video. Optional TV effects may reconnect the identical media file after checking audio access, preserving position and paused state. Effects never change the channel, show, schedule or subtitles. Browser audio-start rules still apply.

Deployment: apply `community/migrations/0002_preferences.sql` to D1, then deploy the community worker. Load community configuration before `assets/preferences.js`, and initialize once after the player and presentation hooks exist. The caption controller exposes `applyPreferences` for style/backing updates without replacing the video.

Verification covers real local D1 authentication, account isolation, CSRF, schema/range rejection, conditional multi-device merges, and real-browser hydration/account-switch races with unchanged video time and zero playback-start calls.

Account defaults are shared across devices. Once an account exists, missing saved fields use the site's account defaults rather than the new device's guest choices. Intentional guest choices seed only a genuinely new account. Offline account caches retain a full resolved snapshot and an account-bound patch of unsaved edits, so a reload neither discards those edits nor uploads another account's settings.


The compact header keeps the existing logo dimensions. A Settings gear opens Theme and Audio sections; the standalone theme button is removed. A sign-in link and save status explain local browser storage and Discord sync.

`re_audio` is a strictly validated complete object: `enabled`, `denoise` (0–100), `normalize`, `compression`, `amount` (0–100), `linked`, `makeup` (−12–18 dB), `position` (`pre`/`post`), `eq`, and exactly ten `bands` (−12–12 dB each). The shared desktop defaults leave all effects inactive. Nested settings are cloned at storage, cache, network, and UI boundaries. Presets are six built-in desktop sound profiles; current adjustments sync as a single audio profile.

Audio processing runs locally on captured TV audio with a reversible MediaStream source. It does not permanently attach a MediaElementSource to the video. This allows native sound to return when effects are bypassed or the next source cannot be processed. Radio retains native sound and its independent volume. Browsers without capture/worklet support keep normal sound and show an explanatory status. There is no microphone capture or subtitle-processing option in Audio.


Archive video access: direct `/download/` media permits playback but usually omits browser audio-access headers. The community service now streams exact catalog-approved public files at `/media/<SHA256-of-canonical-download-URL>`. It preserves byte ranges for seeking, supplies the site audio-access headers, and never receives or forwards viewer credentials to Archive. The runtime reconnects to this same-file transport only for requested effects. Its exact alias check keeps comments/reactions and caption identity tied to the original file. Failed transport/seek handoffs restore native playback.

Normal site builds publish 256 small exact-source manifests under `audio-media/`, generated from the final catalog including frozen programming and ads. The media service uses these trusted manifests when a newer file is not in its initial allowlist, so routine content additions do not require another worker deployment. Caption-only builds reuse the deployed manifests and never change programming.
