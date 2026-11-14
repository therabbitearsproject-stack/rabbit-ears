# Discord account preferences

Signed-in viewers can restore settings on another device. Guests retain browser-local choices. Settings never include playback position, channels watched, comments, Discord tokens, favorites, or other social data.

The eight synchronized keys are `re_skin`, `re_radio_look`, `re_caption_style`, `re_captions`, `re_caption_backing`, `re_tv_volume`, `re_tv_muted`, and `re_vol`. Skin includes Gutter and the existing eight choices. Volumes must be finite numbers from 0 through 1; captions allow none, yellow, or white. Caption size remains automatically responsive.

`GET /api/preferences` uses the existing authenticated Discord session. `PUT /api/preferences` requires the exact site Origin, session cookie and matching CSRF header, and accepts `{version,changes}`. The session selects the account; clients cannot supply a user ID. D1 stores one sparse preferences object per stable Discord user ID. Conditional version updates and HTTP 409 responses prevent one device from silently overwriting another device's unrelated choices.

`RabbitPreferences.create({store,apply})` wraps only recognized `store.set` changes, debounces saves, and applies remote values through `REUI.applyPreferences`. Remote application cannot echo back as a new user edit. Account hydration restores server choices while retaining intentional edits made during the request. Failed requests retain local controls and retry. Guest choices are stored separately; switching accounts or signing out cannot copy the preceding account's choices into the next one.

The community auth module publishes `re:session` events. A background session check also covers expiry and other-tab changes. `re:preferences-status` reports local, synced, merging, or offline without exposing credentials. No settings operation calls video play, load or tune; mute/volume restoration preserves the browser's tap-to-start boundary.

Deployment: apply `community/migrations/0002_preferences.sql` to D1, then deploy the community worker. Load community configuration before `assets/preferences.js`, and initialize once after the player and presentation hooks exist. The caption controller exposes `applyPreferences` for style/backing updates without replacing the video.

Verification covers real local D1 authentication, account isolation, CSRF, schema/range rejection, conditional multi-device merges, and real-browser hydration/account-switch races with unchanged video time and zero playback-start calls.

Account defaults are shared across devices. Once an account exists, missing saved fields use the site's account defaults rather than the new device's guest choices. Intentional guest choices seed only a genuinely new account. Offline account caches retain a full resolved snapshot and an account-bound patch of unsaved edits, so a reload neither discards those edits nor uploads another account's settings.
