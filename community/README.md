# Rabbit Ears Watch Party

This Worker adds Discord sign-in, durable episode-time comments/reactions, and one original Discord post per submission. The public static website stays on GitHub Pages. The API runs on `community.rabbit-ears.stream` with a Cloudflare D1 database.

## Identity and playback

- Discord app: **Rabbit Ears Watch Party**, ID `1569918622103642233`.
- Server: `1569894832615198771`.
- OAuth return URL: `https://community.rabbit-ears.stream/auth/callback` (configured in the developer portal).
- Sign-in requests `identify` and `guilds.join`. After the viewer approves Discord's consent screen, the bot adds them only to Rabbit Ears; existing members are unchanged. Watching/replays need no sign-in or server membership. The service does not request email or read Discord messages.
- Events use a stable SHA-256 key of the original episode ID and filename, plus the broadcast channel and the **source video's playback position**. Commercial insertions and later airing dates do not move reactions to the wrong scene. Reactions pause during separate commercial segments.
- The website polls the current playback window and draws markers across the whole episode. Seeking skips intervening effects; revisiting a scene can replay its effects. Comments remain plain text; no HTML execution or mention pings.
- Writes derive the author from an expiring, server-side session. HttpOnly host-only cookies, OAuth state, strict origin checks and CSRF tokens protect sign-in and writes. Discord access tokens are revoked after the membership attempt, on success or failure, and are not retained. A failed join creates no new session. Existing signed-in viewers must sign out and back in to approve membership.
- Viewers can remove their own entries; IDs in `MODERATOR_IDS` can remove any entry. The original bot post is also queued for removal. Set at least the project owner's Discord ID before promoting posting.

## Secrets

`.dev.vars` is private and ignored by Git. Copy `.dev.vars.example` when setting up elsewhere. Never put a client secret, bot token, access token or webhook URL in a public asset, screenshot, commit, or chat.

The app owner must generate/reset the Client Secret in OAuth2 and the Bot Token on the Bot page themselves. The assistant cannot perform credential resets through browser automation. No privileged Gateway intents are needed.

Install the bot in Rabbit Ears with Create Invite (required for OAuth member joins), View Channels, Send Messages, Embed Links, and Manage Channels. Effective Create Invite access was verified. Membership screening, bans, and channel permissions are not bypassed; sign-in assigns no roles or nicknames. Manage Channels is used to create the matching rooms and categories and can be removed after provisioning. No Administrator, read-message-history, message-content intent, private-message access, or Manage Server permission is required. Discord authorization requires the owner's action-time approval.

## Deploy

From this directory:

```sh
npm ci
npm test
npx wrangler login
# DB and schema have already been created for Rabbit Ears.
npx wrangler d1 migrations apply DB --remote
npm run provision -- --apply
npx wrangler d1 execute DB --remote --file channel-map.sql
npm run deploy
node configure-secrets.mjs
```

Wrangler custom-domain deployment creates only the API subdomain; it does not replace the main website's GitHub Pages records. Cloudflare D1 ID is in `wrangler.jsonc`. Provisioning is sequential, respects rate limits, tags rooms with stable channel numbers, and reuses those rooms when rerun. There are 77 broadcast channels split across two categories (Discord permits at most 50 rooms per category).

Check `/health`, then deploy the static site via its normal GitHub Pages workflow. Verify a real viewer can sign in, comment and react, and that exactly one original reaches the corresponding Discord channel. Seek away/back and reload to verify replay without another Discord post. Check fullscreen and mobile, deletion, sign-out, and that anonymous viewers can still watch.

## Delivery and operations

Events and the outbox are inserted in one D1 batch. A per-user request ID makes retrying the same submission idempotent; 12 entries per rolling minute is enforced in the insert. A leased outbox processes originals immediately and retries via a minute cron. Discord nonces suppress near-term duplicate delivery after ambiguous responses. Replays only read the database and never create outbox entries.

Monitor failed deliveries with:

```sh
npx wrangler d1 execute DB --remote --command "SELECT event_id,attempts,last_error FROM outbox WHERE done=0"
```

After 12 failed attempts, fix the permission/token problem and reset the affected rows' `attempts`, `next_attempt`, and `lease_until` to 0. Discord's nonce deduplication is time-limited, so reconcile ambiguous long-delayed successes before manually retrying them. The service uses public Discord bot messages, not impersonated webhook authors.

Events are public and persist for later airings until removed. Each stores a Discord user ID/display name, text or emoji, episode file identity/title, source playback time, channel, and server-created time. Sessions expire after 7 days and are cleaned by cron. No Discord emails, passwords, or private conversations are stored. D1 and Worker usage should be monitored as audience grows; public playback polling uses the free-plan request allowance.

## Public media transport for optional audio effects

`GET`/`HEAD /media/<sha256>` streams an exact catalog file from the Archive download endpoint with site-restricted CORS and preserved byte ranges. The hash is SHA-256 of the complete canonical download URL. Only static allowlisted records or exact records from the site's fixed `/audio-media/<first-two-hash-characters>.json` shards are accepted. Arbitrary URLs, forwarded account credentials, non-Archive redirects, HTML responses, and ignored or incorrect range responses are rejected. No media is buffered in worker memory or stored in D1.

Normal site assembly publishes 256 small allowlist shards from the final catalog, including protected programming and remote break files. New published files become available without a worker deployment; shard caches expire after 60 seconds. Caption-only deployments retain the published shards and programming unchanged. To generate the site artifacts manually from the repository root:

```sh
node community/generate-media-sources.mjs --catalog _site/catalog.json --output-dir _site/audio-media
```

Running the generator without arguments instead refreshes `community/media-sources.json`, the worker's fast-path snapshot. Redeploy the worker after changing that snapshot or the transport implementation. Unsupported or unknown files retain native playback; optional audio processing must never make playback depend on bridge availability.

## Local verification

```sh
npx wrangler d1 migrations apply DB --local
npm run dev -- --port 8797 --var SITE_ORIGIN:http://localhost:4173 --var API_ORIGIN:http://localhost:8797
# Separate terminal; tests seed/delete only synthetic local records:
npm run test:integration
```

The static site's localhost configuration uses port 8797. Integration tests check persistence, idempotent retries, isolation between episodes/channels, replay reads, CSRF rejection, concurrent rate limiting, and deletion. They never post to Discord when the local bot secret is absent. Do not run with real Discord credentials when using synthetic channel IDs; clear local `.dev.vars` secrets or use a clean test environment.
