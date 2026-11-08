# Rabbit Ears — Developer Log

Newest entries at the top. Each entry: what changed, why, and anything left open.

---

## 2026-11-08 — Fix silent audio on Subspace 97

The ST9 TNG/DS9/Voyager originals and the animated-series originals use AC-3 surround audio.
Some browsers render their video without decoding the sound. Verified Archive derivatives
use AAC-LC instead: select those copies for these two collections, retaining their listed
SD/1080-line dimensions. Other reviewed collections keep their higher-quality originals;
sampled originals, including Enterprise HD and Star Trek Continues HD, already contain AAC.

The source-specific compatibility policy runs before resolution/bitrate ranking. Unsafe originals
cannot return from the previous catalog if a metadata refresh fails. Startup revalidates the
catalog so refreshing the page picks up corrected media choices rather than a cached old file.
All 704 programs remain available, including the same 85 HD programs. Commercials, fact
bumpers and the integrated break schedule remain enabled.

Validation: inspected audio streams across all approved collections; confirmed AAC-LC and
non-silent decoded samples in Angel One and The Animated Series; added selection and failed-
refresh regression checks and rebuilt the catalog.

---

## 2026-11-08 — 🎮 Games tab: classic Flash games

A third tab next to TV and Radio: classic Flash games from the Internet Archive's Flash collection (about 6,600
games), played right on the page.

**How it works**
- The Flash emulator **Ruffle 0.7.1** (from jsDelivr) runs the games; it's only downloaded the first time someone
  opens the Games tab.
- Game files load through `archive.org/cors/<id>/<file>`, the Archive's download address that other websites are
  allowed to read. (The Archive's own embedded player was tried first but stalled in testing; hosting Ruffle
  ourselves is simpler and in our own style.) Big games can take 10–25 seconds to arrive; Ruffle shows a loading bar.
- `scripts/build-games.mjs` builds `games.json` nightly (same schedule and conditions as the catalog): shelves of
  the most-downloaded games per category, each game's Flash file, title and year. It's committed like `catalog.json`
  and published with the site.

**Shelves:** ⭐ Classics (hand-picked, tested), 🔥 Most played, 🧩 Puzzle & brain, 🕹️ Action & arcade,
🏁 Sports & racing, 🗡️ Adventure & RPG, 📺 Cartoon tie-ins, plus ★ Favorites and 🕘 Recent (saved per device) and
a search box over the whole collection.

**Also:** Game of the Day (from Classics, the same for everyone each day), 🎲 Random game, ★ Favorite, ■ Stop,
Full screen, "🎮 N playing" counts (same Firebase presence as TV, room `game-<hash>`), 🔗 Share this game
(`…/#play=<id>` opens straight to it), ⚑ Report this game (Won't play / Not appropriate). The nightly build drops
games reported "not appropriate" twice or "won't play" three times. Leaving the tab switches the game off. On
phones a note says most Flash games need a keyboard and mouse. The TV's keyboard shortcuts are off in the Games
tab so arrow keys and space go to the game. The welcome screen has a "🎮 Play games" button.

**Safety:** every shelf and search excludes adult, gory, shock/prank and hateful content by title and tags, and
the builder double-checks each game's full tags. Caught while reviewing the top results and now excluded:
Mutilate-a-Doll, the "You Are An Idiot" virus prank, Whack Your Boss, Don't Shit Your Pants, Beach Flirting Game,
The Great Sperm Race, SpongeBob Saw Game, Road of the Dead. Pico's School left out of Classics (school-shooting
plot).

**Classics test:** 40 well-known games were each loaded in Ruffle from the Archive. 38 started (Line Rider, QWOP,
Fancy Pants, Portal: The Flash Version, Super Mario 63, Age of War, Bloons TD 2, Learn to Fly 2, Papa's Pizzeria,
Cubefield, Helicopter Game, Raft Wars, Duck Life 2, The Impossible Quiz 2, Alien Hominid…); Plants vs. Zombies has no
Flash file. 34 made the Classics shelf (The Binding of Isaac and The Last Stand left out for theme). Load times ran
3–41 seconds, almost all of it the download.

**Big files:** the Archive sends game files at roughly 0.6 MB/s, so a 35 MB game takes about a minute. The builder
leaves games over 25 MB off the shelves (`MAX_MB`), records each game's size, and the page warns "this one's big"
for anything over 8 MB (e.g. a 35 MB Fancy Pants World 3 found by search).

**Tested locally:** Game of the Day, shelves and thumbnails, playing from a card and from a `#play=` link, switching
games (one player at a time), Favorites shelf, Recent, search (and an adult search term returning nothing), Stop,
leaving the tab switching the game off, arrow keys and space going to the game, "Just you playing", phone layout.
The first real `games.json` is built by the publish run.

---

## 2026-11-08 — Subspace 97: vintage breaks and Subspace Snacks

Renamed the dedicated Star Trek channel to Subspace 97. Its 704 full programs remain in rotation.
Only this channel gets the new breaks: about three minutes after each ten minutes of content,
with no break in the final two minutes. A show keeps one guide listing, and its advertised slot
includes commercials. The shared clock deterministically selects whole spots and resumes the
source episode at the correct content offset. A continuous playlist avoids clipping the next
episode at the legacy three-hour boundaries. Pause, seek and Back to live use the same timeline.

The initial approved pool contains 33 individual commercials dated 1952–1998. Build validation
rejects undated spots, anything after 1999, and long compilations. These are entertainment
archive spots, not paid placements. Viewer reports can remove bad spots at the next catalog build.

Six original, exactly 15-second Subspace Snacks fact bumpers mix before or after ad pods.
They use minimal text cards, original synthesized downtempo beats, H.264 video and AAC audio.
Facts and primary-source links live in assets/trek-bumpers/facts.json; the renderer and original
music generator are in scripts/build-bumpers.mjs. Production serves the committed MP4s.

Checked timing determinism, content continuity, runtime accounting, year cutoff and legacy-channel
behavior with tests; decoded all six MP4s and tested ad/bumper/episode transitions and paused
seeking across a break in the browser. Failed remote spots use a local bumper while preserving
the shared break duration. Other TV channels receive no added breaks.

---

## 2026-11-08 — Name matches the domain: Rabbit-Ears.stream

- The site's name is now **Rabbit-Ears.stream** everywhere it's shown: browser tab title, header, welcome screen,
  link previews (title, site name, image description), the share-sheet text, the lock-screen radio label and the
  suggestion box. ".stream" uses the amber accent color. Web addresses stay lowercase.
- Share image re-rendered with the new name (`og.jpg?v=5`).
- Checked at phone width: the header fits on one line, no sideways scroll.

---

## 2026-11-08 — Full episodes and better picture quality on Star Trek

Channel 97 now uses an approved source library instead of open searches. The heavily blurred
July 1993 TNG recording and the other unreviewed broadcast tapes, promos and commentary
are excluded. Collections are expanded into individual episodes: 704 full programs at launch,
including 517 TNG/DS9/Voyager programs, 97 Enterprise, 50 Lower Decks, 16 animated-series
episodes, the original-series pilot, 21 fan-series episodes and two films.

The selector requires full-episode running times, rejects preview/extra files and very small
encodes, and ranks copies of the same episode by actual dimensions then bitrate. This fixes
Star Trek Continues choosing a 12-second 240p preview over a full 1080p episode, and Enterprise
choosing 480p derivatives when 1080p originals exist. Missing HD sources remain clean SD;
series without approved full-episode sources no longer fill the schedule with clips.

Each episode has a stable schedule/report/caption key separate from its Archive item ID.
Streaming, source links and subtitle downloads retain the real Archive ID. Old search caches
are bypassed, and an unavailable catalog cannot restore unreviewed results. The library is
re-evaluated from source metadata at each catalog build; failures can reuse only approved rows.

Validated with selection/fallback regression tests, a catalog rebuild, and browser playback
and visual sampling of replacement SD and HD sources and the revised channel.

---

## 2026-11-08 — Custom domain: rabbit-ears.stream

- Domain registered at Cloudflare under the Rabbit Ears Gmail account. DNS records (all "DNS only", grey cloud, so
  GitHub can issue the HTTPS certificate): four `A @` → `185.199.108.153`, `.109`, `.110`, `.111`; `CNAME www` →
  `therabbitearsproject-stack.github.io`.
- GitHub Pages custom domain set to `rabbit-ears.stream` (repo Settings → Pages; with workflow publishing it's a
  setting, not a CNAME file). The old `therabbitearsproject-stack.github.io/rabbit-ears/` address forwards to it, so
  links already shared keep working.
- Site links (preview tags, README, launch posts) now use `https://rabbit-ears.stream/`; preview image tag bumped to
  `og.jpg?v=4`. Share links and "Copy post" build their address from the page, so they follow automatically.
- **Lesson:** setting the custom domain before the DNS records existed made GitHub forward the old address to a
  domain that didn't resolve yet; the site was unreachable for about ten minutes until the domain setting was
  removed and the site re-published. Add DNS first, then set the domain.
- Some home routers remember "domain doesn't exist" for a while after a new domain is created, so the address may
  not load on a particular network for up to an hour or so even though it works everywhere else.

---

## 2026-11-07 — Remove the Star Trek directory panel

Removed the franchise directory panel below the player, including its styles and display logic.
Channel 97 and its franchise-spanning programming remain in the TV guide.

---

## 2026-11-07 — Clear picture on every TV channel

Removed the shared CRT overlay (horizontal scanlines and darkened glass edges) from the TV
player, so every channel displays its video without that effect.

---

## 2026-11-07 — Star Trek: The Final Frontier (channel 97)

- Added a dedicated Star Trek channel in the Sci-fi band. Starbase stays the mixed sci-fi channel.
- A bridge-inspired panel appears when tuning to 97: 16 entries span all series (including Short Treks,
  Very Short Treks and Starfleet Academy), films across all eras, and fan films/specials. Each entry
  opens its Archive search; the panel also links to the official Star Trek viewing directory.
- The catalog reserves search slots per franchise, plus a general search, within the existing
  300-candidate budget. This keeps newer crews from disappearing behind popular older uploads.
  Identifiers are deduplicated; playback and the shared clock use the existing scheduler.
- Franchise counts describe playable uploads in the current pool after reports are applied, not
  episode counts or full-season availability. Missing sources are explicitly labeled. The Archive
  currently supplies no playable Starfleet Academy upload; some newer series have clips/promos only.
- Excluded game footage, reaction/review videos, clickbait commentary and adult parodies from the
  channel search. Availability and Archive metadata can change; the usual tape reports still apply.
- Added a dependency-free catalog regression check (also run before publishing): reserved search
  slots, deduplication, playable-only counts, report removal and preservation on search failure.

Validation: rebuilt the catalog against the Archive; tested channel deep links, guide integration,
  franchise links/counts, channel switching and mobile layout in Edge, including actual video playback.

---

## 2026-11-08 — Sci-fi and anime batch (65 channels)

**New Sci-fi band (90s)**, with Starbase (was 12) and Cliffhangers (was 38) moved into it:

| # | Channel | What's on |
|---|---|---|
| 90 | 🖖 Starbase | (moved) Star Trek, Doctor Who, Space: 1999 |
| 91 | 🌠 Hyperdrive | '80s–'00s sci-fi TV: Farscape, Red Dwarf, Stargate, Lexx, Max Headroom, Alien Nation |
| 92 | 🍿 Riff Raff | Mystery Science Theater 3000, RiffTrax, Cinematic Titanic |
| 93 | ⚛️ Atomic Age | '50s and '60s sci-fi movies |
| 94 | 🪐 Deep Space | Space movies from the '70s to '90s |
| 95 | 🏙️ World of Tomorrow | Retro-futurism films: Design for Dreaming, World's Fair films |
| 96 | 🚀 Cliffhangers | (moved) Movie serials |

**More anime (55–59):**

| # | Channel | What's on |
|---|---|---|
| 55 | 🦾 Mecha Hangar | Gundam, Evangelion, Macross/Robotech, Mazinger |
| 56 | ✨ Magical Girls | Sailor Moon, Cardcaptors, Magical DoReMi, Precure, Tokyo Mew Mew |
| 57 | 💥 Power Level | Dragon Ball, Naruto, Yu Yu Hakusho, Inuyasha, One Piece |
| 58 | 🗡️ OVA Vault | '80s–'90s tape-era anime: Lodoss War, Slayers, Dirty Pair, Vampire Hunter D, Venus Wars |
| 59 | 🌌 Toonami Tapes | Toonami blocks taped off Cartoon Network |

- The anime searches skip uploads labeled as Spanish, Portuguese, Italian, German or French dubs (most results
  were), and disc images (ISO), which don't play.
- Dropped after checking results: an anime openings channel (pulled in hateful and adult videos) and a cyberpunk
  channel (too scattershot). The OVA list leaves out titles known for sexual-assault scenes (*Wicked City*,
  *Ninja Scroll*) and excludes hentai/ecchi tags; the '70s–'90s space search excludes *Violence Jack*.
- Logos are unique per channel. Share image re-rendered (Starbase is now 90), preview tag bumped to `og.jpg?v=3`.

Tested locally: 65 channels, no duplicate numbers or logos, all 10 new channels fill.

---

## 2026-11-08 — Share image, radio logos, "On now" page

**New share image (`og.jpg`, now a full 1200×630).** A retro TV, the name, "Forgotten TV around the clock, plus live
radio. Flip channels. Everyone sees the same thing." and a mini TV guide with four real channels (Paint Along,
Chiller Hosts, Starbase, Scooby & Friends). No channel count. The preview tags now point at `og.jpg?v=2` so apps
that cached the old image fetch the new one.
- To change it: edit `share-card.html`, then render it with headless Edge and save as JPEG:
  `msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=8000 --screenshot=og.png share-card.html`
  (then convert to `og.jpg`; quality 90 is about 130 KB).

**Radio station logos.** The radio display shows the playing station's own logo (from the Radio Browser
directory), or 📻 when it has none. The station also shows on phone lock screens and in headphone controls
(Media Session), where next/previous change station.

**"On now" page (`…/#now`, linked in the footer as "📋 Everything on now").** Every channel's current and next show.
Each row has **Copy post** (e.g. "Right now on 🖌️ Paint Along (ch 15): Bob Ross 3-Hour Workshop. Tune in → …/#ch15")
and **Watch**. Refreshes every minute. Made for writing social posts, useful to visitors as a quick schedule too.

Tested locally: all 55 rows fill, Copy post text, Watch jumps to the channel, radio logo and lock-screen info.

**Live check of the previous batch:** both publish runs succeeded; 55 channels, 2,825 videos with captions,
the run summary lists tape reports (only the test report so far, nothing pulled).

---

## 2026-11-08 — 11 more channels, channel links, report handling, better titles

**New channels (55 total)**, filling gaps found by comparing with a similar site (our own names and searches):

| # | Channel | What's on |
|---|---|---|
| 10 | ⭐ Prime Time Tapes | Network nights taped with the ads: TGIF, NBC Thursdays, Sunday Night Movies |
| 11 | 🌀 Strange Tales | Twilight Zone, Outer Limits, Alfred Hitchcock Presents, One Step Beyond, Thriller |
| 12 | 🖖 Starbase | Star Trek, Doctor Who, Space: 1999, Battlestar Galactica, Space Patrol |
| 13 | 👽 Spooky '90s | X-Files, Unsolved Mysteries, Are You Afraid of the Dark?, Goosebumps |
| 14 | ☎️ Order Now | Late-night infomercials |
| 15 | 🖌️ Paint Along | The Joy of Painting episodes |
| 22 | 🐕 Scooby & Friends | Hanna-Barbera: Scooby-Doo, Flintstones, Jetsons, Jonny Quest, Super Friends |
| 25 | 🎒 After School | Bill Nye, Magic School Bus, Wishbone, Beakman, 3-2-1 Contact |
| 33 | 🦇 Chiller Hosts | Horror hosts: Elvira, Joe Bob Briggs' MonsterVision, Svengoolie |
| 81 | ☢️ Duck & Cover | Cold War and civil defense films |
| 82 | 🎥 Home Movies | Amateur films, family trips, travelogues |

- Excluded after checking top results: Twitch streams (Paint Along), *Office Space* (Starbase), "USA Up All Night"
  (mostly risqué B-movies; Chiller Hosts), *Godzilla 2000: Millennium* (Spooky '90s), a concert tape matched by
  "call now" (Order Now).
- "Gumshoe" renamed **Private Eye** (the other site has a channel called Gumshoe).
- **Renumbered** with room to grow: 2–19 Classic TV, 20s Kids, 30s–40s Movies, 50s Anime, 60s Sports, 70s Music,
  80s–90s Learning & oddities.

**Channel links.** The address follows the channel (`…/#ch62` = Ringside), so copying the address shares the
channel, and opening such a link tunes straight to it. "🔗 Share this channel" under Now Playing opens the phone's
share sheet, or copies the link on a computer.

**Report handling (nightly).** `build-catalog.mjs` reads `/reports`: a tape reported "not appropriate" twice or
"won't play" three times leaves every channel; "wrong channel" twice leaves that channel. Every reported tape is
listed with counts and links in the summary of each "Build and publish" run (GitHub → Actions → the run).

**Better titles.**
- Film uploads lose their credits: "Laura (1944) Dir: Otto Preminger, Starring Gene Tierney…" → "Laura (1944)";
  "1959 - Anatomy of a Murder - Anatomía de un asesinato - VOSE" → "Anatomy of a Murder (1959)".
- "WOC" → "with ads"; "Sold as Blank:", "Beta #26:", "Tape #441:" and leftover date prefixes removed.
- `TITLE_FIX` in `index.html`: hand-written titles for 55 long, much-aired tapes, e.g.
  "ABC Saturday Morning, October 27, 1990: Ghostbusters, Beetlejuice and More".

**Blocklist can be per channel** (`"id@Channel name"`). Pulled while reviewing titles: a C-SPAN broadcast (Retro
Anime), a Howard Stern clip show (Sweatin', everywhere), a Twitch stream (TV Dinner, everywhere), and mixed tapes
on the wrong channel (Gridiron, Sweatin', Strange Signals, Wild Kingdom, Ringside).

Tested locally: 55 channels, no duplicate numbers, all 12 new/renamed channels fill, `#ch62` link, title rules,
per-channel blocks.

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
