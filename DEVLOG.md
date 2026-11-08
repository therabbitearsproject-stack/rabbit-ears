# Rabbit Ears — Developer Log

Newest entries at the top. Each entry: what changed, why, and anything left open.

---

## 2026-11-07 — Channel numbers, logos, captions, tape reports, welcome screen

**Channel numbers in genre bands, with logos.** Like a cable lineup: 2–9 Classic TV, 10s Kids, 20s Movies,
30s Anime, 40s Sports, 50s Music, 60s Learning & oddities, 100+ your own channels. The guide is grouped under
band headings and every channel has an emoji logo (also shown on the on-screen display). Numbers and logos live in
`LINEUP` / `BANDS` in `index.html`, right after the channel list.
- Type a number on the keyboard like a remote: "4", "2" → channel 42 (Ringside). Unknown numbers say "No channel here".
- The last channel watched is now remembered by its search instead of its position (key `re_chq`), so adding
  channels doesn't move people. Returning visitors start once on channel 2 (Ad Break).

**CC (captions).** About 30% of videos have subtitle files on the Archive, mostly its automatic speech-recognition
captions (rough, like YouTube's auto captions); the button says so when they're automatic. Press CC or C; the
choice is remembered (`re_captions`).
- archive.org doesn't let other websites read subtitle files (no CORS), so the nightly job copies them onto this
  site: `build-catalog.mjs` records each video's subtitle file (new 6th catalog field), and the new
  `scripts/fetch-subs.mjs` downloads them, converts SRT to WebVTT and writes `subs/<id>.vtt`.
- The subtitle files are not committed to git (too big). The workflow keeps them in the Actions cache between
  runs and publishes them with the site. To allow that, **GitHub Pages now publishes from the workflow** instead
  of straight from the `main` branch, and the workflow is renamed "Build and publish". It runs on every push
  (rebuilding the catalog only when `index.html` or the scripts change), daily, and on demand.
- First run after this change looks up every video again once (to find subtitle files) and downloads all the
  captions, so it takes a while; later runs only handle new videos.
- Custom channels don't get captions (their videos aren't in the catalog).

**⚑ Report this tape.** Under Now Playing: Won't play / Bad picture or sound / Wrong channel / Not appropriate.
Each report stores `{ tape id, channel, reason, server time }` in Firebase at `/reports`; nothing about the viewer.
A browser only sends the same report once. Rules: anyone can add a report but not change or delete one, only those
four fields, only those four reasons, and the time must be the server's. Reports are publicly readable (they're just
tape IDs): `curl https://project-rabbitears-default-rtdb.firebaseio.com/reports.json`. Tested from outside with
curl: a valid report is accepted; a fake time, unknown reason, extra field or delete is refused (401). One test
report (`rulecheck-test`) is in there; delete it from the Firebase console's Data tab if wanted.

**Donate link.** Footer: "Every program streams from the Internet Archive. ♥ Donate to the Archive".

**Welcome screen.** First visit only (not when arriving on `#radio`): what the site is, three stats (channels,
hours of tape from the catalog, 24/7 in sync), "📺 Tune in" (turns the TV on with sound) or "📻 Listen to radio",
and keyboard tips. Closes with Escape or a click outside; remembered as `re_welcomed`.

Tested locally (desktop and phone width, no sideways scroll): welcome stats (44 channels, 9,564 hours), Tune in,
band headings, number dialing, report flow (with a stubbed send), CC on/off with a sample caption file, and the SRT
converter on a real Archive caption file (568 cues read by the browser).

---

## 2026-11-07 — Timeline guide, pause/rewind, Surprise me

Ideas taken from looking at a similar site (Spelunkr); built our own way.

**Timeline guide.** The Now/Next/Later columns are replaced by a cable-style grid: a time ruler starting at the
current half hour, 3 hours wide (90 minutes on phones), with each program drawn as a block sized by its length
and an amber line marking the current time. The block on air now is outlined in green. Hover a block for its times.
- Runs of programs too short to label (commercials, clips, AMVs) merge into one block, e.g.
  "Gilmore Girls Theme + 68 more"; hovering lists them.
- The window moves forward every half hour by itself; the ruler stays pinned while scrolling the guide.

**Remote.**
- 🎲 **Surprise me** (or R): random channel.
- ⏸ **Pause** (Space), ⏪ **15** / **15** ⏩ (← →): pause or rewind your own picture. Fast-forward stops at live.
  "↻ Back to live" appears whenever you're behind; changing channel or reaching the end of the show also puts
  you back on live. Everyone else's schedule is unaffected.
- Now Playing has a progress bar with elapsed and remaining time.

Tested locally at desktop and phone widths (no sideways scroll), including pause, rewind, forward clamping,
back to live, Surprise me and the R key.

---

## 2026-11-07 — Clean program titles

Archive titles are whatever the uploader typed, so the guide showed things like
"[Kirion] Astro Boy SUBBED (BD 1020x 720 X 264 QAAC)" or "2020-bahrain-grand-prix-formula-1-qualifying".
`cleanTitle()` in `index.html` now tidies every title (catalog and live lookups alike) before it's shown:

| Before | After |
|---|---|
| [VHS Rip] Teenage Mutant Ninja Turtles (1990) - Family Home Entertainment | Teenage Mutant Ninja Turtles (1990) - Family Home Entertainment |
| 2020-bahrain-grand-prix-formula-1-qualifying | 2020 Bahrain Grand Prix Formula 1 Qualifying |
| OCTOBER 2000 WWF SUNDAY NIGHT HEAT | October 2000 WWF Sunday Night Heat |
| The Grinch \| Own it on 4K Ultra HD, Blu-ray, DVD & Digital \| Illumination | The Grinch · Illumination |
| 1988.08.20 - MTV Headbangers Ball - Hosted by Adam Curry - August 20th, 1988 | MTV Headbangers Ball - Hosted by Adam Curry - August 20th, 1988 |
| Harriet Craig (1950) Joan Crawford, Wendell Corey - Full Movie. | Harriet Craig (1950) Joan Crawford, Wendell Corey |

- Removes: [bracketed tags], format/quality words (720p, VHS rip, 60fps, Blu-ray, x264…) and parentheses made
  of them (a lone year stays), "YouTube: id -" and "VHS Tape -" prefixes, "1990.05.19 -" date prefixes,
  website names, promo segments after " | ".
- File-name titles get spaces and capitals; ALL-CAPS titles become Title Case, keeping acronyms (WWF, MTV, NJPW…).
- Random-ID titles (e.g. "hnzrxy6cnbkhu86v") show as "Untitled tape". Titles over 90 characters are shortened.
- Tested against all 12,556 catalog titles: about 3,000 changed, none came out empty.
- Display-only: the catalog and Archive links keep the original titles.

**Also:** found *Nekromantik* (an extremely graphic film) in Creature Feature, an older channel without the `SAFE`
filter. Added a `BLOCKED` list of upload IDs that never air on any channel; those two uploads are on it.

**Open:** older channels (1–24) still don't use `SAFE`; worth a pass over their top videos.

---

## 2026-11-07 — 10 more channels (35–44)

| # | Channel | What's on |
|---|---|---|
| 35 | Toon Toys | '80s Saturday morning cartoons: He-Man, Transformers, G.I. Joe, Care Bears, DuckTales |
| 36 | Cliffhangers | Movie serials, chapter by chapter: Flash Gordon, Captain America, Dick Tracy |
| 37 | Gumshoe | Detective and mystery films and TV: Sherlock Holmes, Mr. Wong, Dragnet |
| 38 | Kaiju Theater | Godzilla, Gamera, Ultraman, Power Rangers |
| 39 | Late Night | Carson, Letterman, Conan, Arsenio, Cavett |
| 40 | Ringside | Classic pro wrestling and boxing |
| 41 | Pit Lane | F1, NASCAR, Daytona, Le Mans, drag racing |
| 42 | Skate & Surf | Skate videos, surf films, BMX |
| 43 | Wild Kingdom | Nature and wildlife documentaries |
| 44 | Soul Train | Soul Train, Top of the Pops, American Bandstand, concert tapes |

- All use the `SAFE` filter. Extra exclusions after checking the top results: video game footage (racing,
  skating, kaiju), Jackass/CKY/Bam (skate), strip-poker and "Divas Undressed" segments (wrestling), Conan Doyle
  (late night), soundtrack uploads (kaiju), Grateful Dead audience tapes (`etree`, concerts).
- Tested locally: all 10 rows filled with Now/Next/Later. The nightly catalog job picks them up on push.
- Considered and skipped: Bollywood (mostly recent pirated films), stand-up (thin, mixed with lectures),
  public access (search too broad), travelogues.
- **Open:** Late Night also pulls whole VHS tapes that contain a talk show among other recordings.

---

## 2026-11-05 — All-time visit count

- Bottom of the page: "📈 N visits since launch", live.
- Stored in Firebase at `stats/visits`. Each browser adds 1 at most once per day (remembered in localStorage as
  `re_counted`), so it counts daily visitors, not page reloads.
- Rules only allow raising it by exactly 1 (or starting it at 1); setting any other number, text or deleting it is
  refused. Tested from outside with curl: all refused (401). Nothing personal is stored.
- Caveat: someone could still add 1 repeatedly with a script; fine for a feedback-stage counter.

---

## 2026-11-05 — Instant guide (pre-built catalog)

**Problem:** the guide took many seconds to fill because every visitor's browser looked up hundreds of videos,
one by one, at the Internet Archive before it could show anything.

**Fix:** do the lookups ahead of time, once, for everyone.
- `scripts/build-catalog.mjs` reads the channel list straight from `index.html`, takes each channel's 300
  most-downloaded matches, looks up each video's file, length, title and year, and writes `catalog.json`.
  Videos already in the previous catalog are reused, so after the first run only newly popular videos are looked up.
- `.github/workflows/catalog.yml` runs it daily at 09:17 UTC, whenever `index.html` or the script changes,
  and on demand ("Run workflow" in the repo's Actions tab). It commits the new `catalog.json` and republishes the site.
- The page loads `catalog.json` first (waits at most 4 s), then draws the whole guide and tunes in with no Archive
  lookups. Only the video itself streams from the Archive.
- Custom channels, and any channel missing from the catalog, still use live lookups.
- Pools are now 300 videos per channel (was 1,000) in both the catalog and the live fallback.

**Result:** first catalog run: 34 channels, 9,310 videos looked up, 0 failures. `catalog.json` is 1.2 MB
(418 KB compressed). On the live site with browser storage cleared, all 34 guide rows were filled and the picture
was playing 1.5 s after the page started loading, with 0 Archive lookups (was many seconds before).

**Note:** when the catalog is rebuilt each morning, a channel's lineup can shift slightly if popular videos changed.

---

## 2026-11-05 — 10 new channels, better picks on every channel

**New channels (25–34)**, chosen to fill gaps and give new visitors something familiar to land on:

| # | Channel | What's on |
|---|---|---|
| 25 | Video Jukebox | MTV-era music video shows: 120 Minutes, Headbangers Ball, countdowns, Pop-Up Video |
| 26 | Kung Fu Theater | Martial arts movies: Shaw Brothers, Bruce Lee, ninja films |
| 27 | Frontier | Westerns from the feature film and classic TV collections |
| 28 | Big Prize | Classic game shows: What's My Line, Card Sharks, Press Your Luck, Double Dare, Supermarket Sweep |
| 29 | Arcade | Console and arcade game playthroughs, plus old video game ads |
| 30 | Strange Signals | UFOs, ghosts, Bigfoot, haunted-house movies |
| 31 | Slow TV | Fireplaces, train rides, aquariums: put-it-on-in-the-background TV |
| 32 | Sweatin' | '80s and '90s workout tapes: Richard Simmons, Jane Fonda, Tae Bo |
| 33 | '90s Kids | Nickelodeon, Fox Kids and friends, 1988–2003 |
| 34 | TV Dinner | Classic cooking shows: Julia Child, Yan Can Cook, the Frugal Gourmet |

- First drafts of several searches pulled in junk: adult content (workout, game show, gaming and music
  searches), Nazi concentration-camp films ("Concentration"), conspiracy videos (cooking), horror hosts
  (kung fu), Jackass (music videos). Each search was tightened, and the new channels share a `SAFE`
  filter that excludes adult content, audio podcasts and TV-news recordings.

**Every channel now draws from its most-watched videos.** Pools used to be the first 1,000 matches sorted by
Archive ID, which on big searches meant mostly filler. Now each pool is the 1,000 most-downloaded matches.
To keep viewers in sync even as popularity shifts, the pool's order and each block's starting video come from
hashing each video's ID, so one video entering or leaving the pool doesn't reshuffle the rest.
This changes every channel's schedule once; cached old pools are ignored (new cache key `re_pool_`).

**Scheduling fix: a cap on very long videos.** Slow TV turned up uploads that run 20+ hours. One of those
overrunning by more than a whole block scrambled the timeline (the guide showed 5:20 PM before 3:59 PM).
Each video now gets at most 3 hours of airtime, then the channel moves on. Normal-length shows still play
in full and can still run past the end of a block. The guide also skips anything an earlier show is still
covering, so times always run forward.

**Open:** the `SAFE` filter relies on Archive tags and titles, so something mislabeled can still slip through.
The older channels (1–24) don't use it yet.

---

## 2026-11-05 — Link preview image

- Shared links showed no picture: the page had no preview (Open Graph) tags.
- Added `og:` and `twitter:` tags with title, description and image.
- Preview image `og.jpg` (800×420) is a capture of `share-card.html`: a retro TV with color bars, the Rabbit·Ears name,
  and "Forgotten TV around the clock, plus live radio from around the world." (No channel count, by request.)
- To change it: edit `share-card.html`, open it at 1200×630, capture it, and replace `og.jpg`.
- Apps cache previews: a link already shared somewhere may keep showing the old (blank) preview for a while.

---

## 2026-11-05 — Old copy offline, project folder

- Turned off GitHub Pages on the old copy under the personal account; its address now returns 404.
  The old repo itself still exists (public) with its earlier history.
- Local project folder `Project_Rabbit_Ears` is now the working copy of this repo, with its git identity set to
  "Rabbit Ears" and the GitHub noreply address so new commits stay anonymous.

---

## 2026-11-05 — Viewer counts, anonymous home, project docs

**Moved to an anonymous home.**
- New GitHub account `therabbitearsproject-stack`; the site now lives at
  https://therabbitearsproject-stack.github.io/rabbit-ears/
- Fresh repository with a single starting commit under the name "Rabbit Ears"; no earlier history carried over.
- Suggestion box now opens issues on the new repo.

**Live viewer and listener counts.**
- Firebase Realtime Database (project `project-rabbitears`, free Spark plan, us-central1).
- Each open page writes one marker, `presence/<room>/<random id> = true`, and Firebase deletes it when the page closes.
  Rooms are `tv-<hash of channel search>` and `radio-<station id>`.
- Shown as "👁 N watching" on each guide row and in Now Playing, and "🎧 N listening" on stations and the radio display.
- Security rules: only `/presence` is readable; writes must be `true` under a well-formed room and 12–24 character id;
  everything else is refused. Verified from outside with curl (allowed writes 200, everything else 401).
- Tested with two tabs: count went 2 → split 1/1 on channel change → 1 after closing a tab.

**Open:** counts can be faked by anyone who reads the code (no sign-in). Fine for feedback; revisit if it matters.

---

## 2026-11-05 — Christmas

- TV channel 24 **Christmas Movies**: Christmas films and specials from feature films, classic TV and cartoon collections, plus
  items tagged as Christmas movies.
- Radio **🎄 Christmas** genre: merges the `christmas`, `xmas` and `christmas music` tags, then keeps only stations whose
  *name* is Christmas-themed, so it's all-Christmas stations only (60 at last check).

---

## 2026-11-05 — Radio tab

- 📺 TV / 📻 Radio tabs; `#radio` links straight to the radio.
- Live stations from the Radio Browser directory: genres, name search, country filter, favorites (saved per device),
  tuning-dial needle, keyboard arrows to change station.
- Only HTTPS, non-HLS, browser-playable streams are listed.
- TV pauses while the radio plays and resumes on its schedule when you come back.

---

## 2026-11-05 — More channels, long shows, speed

- Added Y2K WB, Gilmore Girls (hand-picked clips; the Archive has no playable episodes), PBS, Brit TV.
- Shows longer than the 3-hour planning block now play in full; the next block picks up when they end.
- Small channels skip the show that just aired, so a long tape doesn't air twice back to back.
- Speed: Archive metadata lookups limited to 6 at a time (they slowed to ~7 s each when flooded), fewer lookups per block,
  guide rows load only when on screen, visible rows first. Results cached in the browser.
- Fixed After Dark (its collection didn't exist; now `subject:"film noir"`).

---

## 2026-11-05 — TV guide, sports, Adult Swim, suggestion box

- Scheduler rewritten into 3-hour blocks so programs play to the end and times are predictable.
- TV guide with Now / Next / Later per channel, progress bars, live clock, "Up next" line.
- Channels: Gridiron (football), Rink Side (hockey), Adult Swim.
- Suggestion box that opens a pre-filled GitHub issue.
- Removed the byline.

---

## 2026-11-05 — Anime and more channels

- Channels 9–16: Anime Station, Dubbed Anime, Retro Anime, AMV Hour, Cartoon Vault, Silent Screen, Laugh Track, Mission Control.

---

## 2026-11-05 — Off claude.ai, onto GitHub Pages

- The original claude.ai artifact showed only static: its sandbox blocks requests to archive.org.
- Moved the page to GitHub Pages, where archive.org answers normally (it allows requests from any site).
- First version: 8 channels synced to a shared clock, so everyone on a channel sees the same thing.
