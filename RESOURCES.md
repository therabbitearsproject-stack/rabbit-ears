# Rabbit Ears — Resources

Everything the project uses, what it's for, and what it costs.

## Hosting and accounts

| Resource | Used for | Cost | Where |
|---|---|---|---|
| GitHub account `therabbitearsproject-stack` | Owns the code and the website | Free | https://github.com/therabbitearsproject-stack |
| GitHub repository `rabbit-ears` | The site's code (one file, `index.html`) plus these docs | Free (public repo) | https://github.com/therabbitearsproject-stack/rabbit-ears |
| GitHub Pages | Hosts the live site at the custom domain; published by the "Build and publish" workflow after each push (a few minutes). The old github.io address forwards to it | Free | https://rabbit-ears.stream/ |
| GitHub Issues | Where the suggestion box sends feedback (label `suggestion`) | Free | https://github.com/therabbitearsproject-stack/rabbit-ears/issues |
| GitHub Actions | Workflow "Build and publish": rebuilds `catalog.json`, copies subtitle files (kept in the Actions cache), publishes the site. Daily, on push, on demand | Free for public repos | https://github.com/therabbitearsproject-stack/rabbit-ears/actions |
| Google account (project Gmail) | Owns the Firebase project and the Cloudflare account | Free | — |
| Domain `rabbit-ears.stream` | The site's address. Registered and DNS hosted at Cloudflare (Rabbit Ears Gmail account). Records: four `A @` → `185.199.108–111.153` and `CNAME www` → `therabbitearsproject-stack.github.io`, all "DNS only" (grey cloud) so GitHub can issue the HTTPS certificate; plus `TXT @` `google-site-verification=…`, which keeps Google Search Console verified (do not delete) | Yearly registration | https://dash.cloudflare.com |
| Google Search Console | Search indexing reports, sitemap (`sitemap.xml`) submission, "Request indexing" | Free; Rabbit Ears Gmail, domain property `rabbit-ears.stream` | https://search.google.com/search-console |
| Bing Webmaster Tools | Bing (and DuckDuckGo/Yahoo, which use Bing) indexing, sitemap submission, URL submission | Free; Rabbit Ears Gmail (signed in with Google). Verified by the `msvalidate.01` meta tag in `index.html` (do not delete) | https://www.bing.com/webmasters |
| TikTok `@rabbitears.stream` | Short promo videos; linked in the site footer and as `sameAs` in the JSON-LD | Free; Rabbit Ears Gmail | https://www.tiktok.com/@rabbitears.stream |
| Cloudflare Web Analytics | Cookieless visit counts, referrers, countries, devices (script `static.cloudflareinsights.com/beacon.min.js`, manual snippet with the site token) | Free; same Cloudflare account | https://dash.cloudflare.com → Web analytics |
| Firebase project `project-rabbitears` | Live viewer/listener counts (Realtime Database) | Free Spark plan: 100 simultaneous connections, 1 GB stored, 10 GB/month downloaded | https://console.firebase.google.com/project/project-rabbitears |

## Content sources

| Resource | Used for | Notes |
|---|---|---|
| Internet Archive — Advanced Search API (`archive.org/advancedsearch.php`) | Each TV channel's list of videos | Called by the daily catalog job; browsers only call it for custom channels |
| Internet Archive — Metadata API (`archive.org/metadata/<id>`) | Each video's title, year, MP4 file and length | Called by the daily catalog job (6 at a time); browsers only call it for custom channels |
| Internet Archive — downloads (`archive.org/download/...`) | The video streams themselves; subtitle files (copied nightly) | Video plays directly in the page |
| Radio Browser API (`all.api.radio-browser.info`, fallbacks `de1`/`de2`) | Live radio station directory: search, genres, countries, stream URLs | Free, community-run; https://www.radio-browser.info. Each play is reported back so its popularity counts stay accurate |
| Internet Archive — Flash games collection (`softwarelibrary_flash_games`), files via `archive.org/cors/<id>/<file>` | The Games tab: shelves (from advancedsearch), each game's Flash file (metadata API) and the file itself, loaded through the CORS download address | About 6,600 games; big files can take 10–25 s to load |
| Internet Archive — thumbnails (`archive.org/services/img/<id>`) | Game card pictures | |
| The radio stations themselves | Live audio streams | Run by each station; only HTTPS, non-HLS streams are listed |

## Code libraries and fonts

| Resource | Used for | Loaded from |
|---|---|---|
| Firebase JS SDK 10.12.2 (`firebase-app`, `firebase-database`) | Talking to the Realtime Database | `www.gstatic.com/firebasejs/` |
| Ruffle 0.7.1 (`cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.7.1`) | Flash emulator that plays the games (WebAssembly); loaded only when the Games tab is opened | jsDelivr |
| Google Fonts: Bricolage Grotesque | Headings and UI text | `fonts.googleapis.com` |
| Google Fonts: VT323 | The TV's on-screen display, clock and radio display | `fonts.googleapis.com` |

No build step, no frameworks, no other packages: the whole site is one HTML file.

## Project files

| File | What it is |
|---|---|
| `index.html` | The whole site, including the channel list |
| `catalog.json` | Generated daily: every channel's videos, pre-looked-up, so the guide loads instantly. Don't edit by hand |
| `media-compatibility.js` | Shared audio-compatible copy selection for the catalog and all TV playback |
| `commercial-timing.js` | Shared-clock segment planning for Subspace 97’s internal commercial breaks |
| `scripts/commercial-library.json` | Approved vintage spots, verified to be from 1970 through 1999 |
| `assets/trek-bumpers/` | Six original 15-second text-and-music bumpers, plus fact sources |
| `scripts/build-bumpers.mjs` | Optional authoring tool; needs ffmpeg-static and @resvg/resvg-js installed beside a passed package.json |
| `scripts/star-trek-library.json` | Approved Star Trek collections and rejected sources; manually reviewed |
| `scripts/trek-programming.mjs` | Expands reviewed collections into full episodes and selects the best playable copy |
| `scripts/build-catalog.mjs` | Builds `catalog.json` (Node 18+, no packages) |
| `scripts/fetch-subs.mjs` | Copies each video's subtitle file from the Archive into `subs/` as WebVTT (not committed; cached by the workflow) |
| `scripts/build-games.mjs` | Builds `games.json` (Games tab shelves) nightly; drops reported games |
| `games.json` | Generated: the game shelves and each game's Flash file, title and year. Don't edit by hand |
| `.github/workflows/catalog.yml` | "Build and publish": catalog, subtitles, then publishes the site to Pages |
| `og.jpg` | Link preview image shown when the link is shared (1200×630) |
| `share-card.html` | Source design for `og.jpg` (render with headless Edge at 1200×630; see DEVLOG) |
| `README.md`, `DEVLOG.md`, `RESOURCES.md` | Project docs |

## Data the site stores

| Where | What | Who can see it |
|---|---|---|
| Each visitor's browser (localStorage) | Last channel, custom channels, radio favorites, last station, volume, captions on/off, welcome seen, tapes and games already reported, game favorites and recently played, last game shelf, cached video lists and metadata | Only that visitor |
| Firebase `/presence/<room>/<random id>` | One `true` marker per open page, removed when the page closes | Anyone (it's just counts; no names, accounts or locations) |
| Firebase `/stats/visits` | All-time visit count (one per browser per day) | Anyone; can only go up by 1 |
| Firebase `/reports` | "Report this tape" and "Report this game" reports (games use channel "Games"): id, channel, reason, server time | Anyone can read or add; nobody can change or delete (except in the Firebase console) |

## Tools used to build it

| Tool | Used for |
|---|---|
| GitHub CLI (`gh`) | Creating the repo, turning on Pages, labels, pushing |
| Git | Version history |
| Claude Code | Writing and testing the site |

## Retired

| Resource | Status |
|---|---|
| Original claude.ai artifact | Shows static (its sandbox blocks archive.org). Don't share: it carries the old byline. |
| Old GitHub Pages copy under the personal account | Website turned off (404). The repo is still public with the earlier history; make it private or delete it to hide that too |
