# Rabbit Ears — Resources

Everything the project uses, what it's for, and what it costs.

## Hosting and accounts

| Resource | Used for | Cost | Where |
|---|---|---|---|
| GitHub account `therabbitearsproject-stack` | Owns the code and the website | Free | https://github.com/therabbitearsproject-stack |
| GitHub repository `rabbit-ears` | The site's code (one file, `index.html`) plus these docs | Free (public repo) | https://github.com/therabbitearsproject-stack/rabbit-ears |
| GitHub Pages | Hosts the live site; rebuilds about a minute after each push | Free | https://therabbitearsproject-stack.github.io/rabbit-ears/ |
| GitHub Issues | Where the suggestion box sends feedback (label `suggestion`) | Free | https://github.com/therabbitearsproject-stack/rabbit-ears/issues |
| GitHub Actions | Daily job that rebuilds `catalog.json` (workflow "Build catalog") | Free for public repos | https://github.com/therabbitearsproject-stack/rabbit-ears/actions |
| Google account (project Gmail) | Owns the Firebase project | Free | — |
| Firebase project `project-rabbitears` | Live viewer/listener counts (Realtime Database) | Free Spark plan: 100 simultaneous connections, 1 GB stored, 10 GB/month downloaded | https://console.firebase.google.com/project/project-rabbitears |

## Content sources

| Resource | Used for | Notes |
|---|---|---|
| Internet Archive — Advanced Search API (`archive.org/advancedsearch.php`) | Each TV channel's list of videos | Called by the daily catalog job; browsers only call it for custom channels |
| Internet Archive — Metadata API (`archive.org/metadata/<id>`) | Each video's title, year, MP4 file and length | Called by the daily catalog job (6 at a time); browsers only call it for custom channels |
| Internet Archive — downloads (`archive.org/download/...`) | The video streams themselves | Played directly in the page |
| Radio Browser API (`all.api.radio-browser.info`, fallbacks `de1`/`de2`) | Live radio station directory: search, genres, countries, stream URLs | Free, community-run; https://www.radio-browser.info. Each play is reported back so its popularity counts stay accurate |
| The radio stations themselves | Live audio streams | Run by each station; only HTTPS, non-HLS streams are listed |

## Code libraries and fonts

| Resource | Used for | Loaded from |
|---|---|---|
| Firebase JS SDK 10.12.2 (`firebase-app`, `firebase-database`) | Talking to the Realtime Database | `www.gstatic.com/firebasejs/` |
| Google Fonts: Bricolage Grotesque | Headings and UI text | `fonts.googleapis.com` |
| Google Fonts: VT323 | The TV's on-screen display, clock and radio display | `fonts.googleapis.com` |

No build step, no frameworks, no other packages: the whole site is one HTML file.

## Project files

| File | What it is |
|---|---|
| `index.html` | The whole site, including the channel list |
| `catalog.json` | Generated daily: every channel's videos, pre-looked-up, so the guide loads instantly. Don't edit by hand |
| `scripts/build-catalog.mjs` | Builds `catalog.json` (Node 18+, no packages) |
| `.github/workflows/catalog.yml` | Runs the builder daily, on changes to the site, and on demand |
| `og.jpg` | Link preview image shown when the link is shared |
| `share-card.html` | Source design for `og.jpg` (open at 1200×630 and capture) |
| `README.md`, `DEVLOG.md`, `RESOURCES.md` | Project docs |

## Data the site stores

| Where | What | Who can see it |
|---|---|---|
| Each visitor's browser (localStorage) | Last channel, custom channels, radio favorites, last station, volume, cached video lists and metadata | Only that visitor |
| Firebase `/presence/<room>/<random id>` | One `true` marker per open page, removed when the page closes | Anyone (it's just counts; no names, accounts or locations) |
| Firebase `/stats/visits` | All-time visit count (one per browser per day) | Anyone; can only go up by 1 |

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
