# Rabbit Ears — Developer Log

Newest entries at the top. Each entry: what changed, why, and anything left open.

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
