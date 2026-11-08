# Rabbit Ears — Resources

Everything the project uses, what it's for, and what it costs.

## Hosting and accounts

| Resource | Used for | Cost | Where |
|---|---|---|---|
| GitHub account `therabbitearsproject-stack` | Owns the code and the website | Free | https://github.com/therabbitearsproject-stack |
| GitHub repository `rabbit-ears` | The site's code (one file, `index.html`) plus these docs | Free (public repo) | https://github.com/therabbitearsproject-stack/rabbit-ears |
| GitHub Pages | Hosts the live site; published by the "Build and publish" workflow after each push (a few minutes) | Free | https://therabbitearsproject-stack.github.io/rabbit-ears/ |
| GitHub Issues | Where the suggestion box sends feedback (label `suggestion`) | Free | https://github.com/therabbitearsproject-stack/rabbit-ears/issues |
| GitHub Actions | Workflow "Build and publish": rebuilds `catalog.json`, copies subtitle files (kept in the Actions cache), publishes the site. Daily, on push, on demand | Free for public repos | https://github.com/therabbitearsproject-stack/rabbit-ears/actions |
| Google account (project Gmail) | Owns the Firebase project | Free | — |
| Firebase project `project-rabbitears` | Live viewer/listener counts (Realtime Database) | Free Spark plan: 100 simultaneous connections, 1 GB stored, 10 GB/month downloaded | https://console.firebase.google.com/project/project-rabbitears |

## Content sources

| Resource | Used for | Notes |
|---|---|---|
| Internet Archive — Advanced Search API (`archive.org/advancedsearch.php`) | Each TV channel's list of videos | Called by the daily catalog job; browsers only call it for custom channels |
| Internet Archive — Metadata API (`archive.org/metadata/<id>`) | Each video's title, year, MP4 file and length | Called by the daily catalog job (6 at a time); browsers only call it for custom channels |
| Internet Archive — downloads (`archive.org/download/...`) | The video streams themselves; subtitle files (copied nightly) | Video plays directly in the page |
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
| `scripts/fetch-subs.mjs` | Copies each video's subtitle file from the Archive into `subs/` as WebVTT (not committed; cached by the workflow) |
| `.github/workflows/catalog.yml` | "Build and publish": catalog, subtitles, then publishes the site to Pages |
| `og.jpg` | Link preview image shown when the link is shared (1200×630) |
| `share-card.html` | Source design for `og.jpg` (render with headless Edge at 1200×630; see DEVLOG) |
| `README.md`, `DEVLOG.md`, `RESOURCES.md` | Project docs |

## Data the site stores

| Where | What | Who can see it |
|---|---|---|
| Each visitor's browser (localStorage) | Last channel, custom channels, radio favorites, last station, volume, captions on/off, welcome seen, tapes already reported, cached video lists and metadata | Only that visitor |
| Firebase `/presence/<room>/<random id>` | One `true` marker per open page, removed when the page closes | Anyone (it's just counts; no names, accounts or locations) |
| Firebase `/stats/visits` | All-time visit count (one per browser per day) | Anyone; can only go up by 1 |
| Firebase `/reports` | "Report this tape" reports: tape id, channel, reason, server time | Anyone can read or add; nobody can change or delete (except in the Firebase console) |

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
