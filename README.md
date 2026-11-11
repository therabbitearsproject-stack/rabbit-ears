# Rabbit-Ears.stream

Forgotten Internet Archive video on synchronized channels, live radio from around the world, and classic Flash games.

**Live:** https://rabbit-ears.stream/ · Radio: [`#radio`](https://rabbit-ears.stream/#radio) · Games: [`#games`](https://rabbit-ears.stream/#games)

- **TV:** each channel is an Internet Archive search played on a shared clock, so everyone on a channel sees the same thing.
  A TV guide shows Now / Next / Later. Programs play to their full catalog duration, with channel-specific station IDs and subject/era-matched vintage ads between programs.
- **Radio:** live stations from the Radio Browser directory, with genres (including all-Christmas), search, country filter and favorites.
- **Games:** about 330 classic Flash games from the Internet Archive on themed shelves, played in the page with the Ruffle emulator. Game of the Day, favorites, recently played and a report button.
- **Compatible audio:** TV playback automatically selects a matching browser-compatible copy when the Archive provides one, including older catalog entries.
- **Live counts:** how many people are watching each channel or listening to each station.
- **Subspace 97 (Star Trek):** [channel 97](https://rabbit-ears.stream/#ch97) plays full episodes and films from reviewed sources, selecting the best available playable MP4 for each episode. HD is preferred; clean SD fills gaps. Trailers, commentary, and unreviewed broadcast tapes are excluded. Reviewed commercial breaks and branded fact bumpers play inside the shows’ guide slots.
- **Station identity:** 948 bumpers: six branded station IDs and six distinct researched stories per channel, plus 36 extra Subspace stories. Compatible musical palettes vary the soundtrack. See [bumper stories and sources](docs/bumper-facts.md), [music credits](https://rabbit-ears.stream/music-credits/) and [programming notes](docs/channel-programming.md).
- **Suggestion box:** opens a GitHub issue.

## Docs

- [DEVLOG.md](DEVLOG.md): what changed and why, newest first
- [RESOURCES.md](RESOURCES.md): every service, API, library and account the project uses

## Working on it

The playback and schedule engine is in `index.html`; the viewing skins and navigation are in `assets/interface.css` and `assets/interface.js`. Channel artwork and its name-to-file map live in `assets/channel-logos/`. Edit, commit and push to `main`; the Build and publish workflow deploys GitHub Pages. UI-only changes use the existing catalog; daily and programming changes rebuild it.

The original interface is available from the footer and preserved under `design-history/`. See its README for the original source tag and rollback instructions.

## Discord watch parties

The optional website watch party uses Discord sign-in, episode-timed comments and
reactions, and matching rooms for the 76 shared broadcast channels. Original posts
go to Discord; replay reads never post again. TV playback and anonymous viewing do
not require sign-in. The panel appears after the community API is configured.

The frontend is in `assets/community.js`; the Cloudflare Worker, D1 schema, channel
map and setup instructions are in [community/README.md](community/README.md).
Secrets are stored in the Worker and the ignored local `community/.dev.vars` file,
never in website assets. Run `npm test` inside `community/` for its security and
timing tests. The existing `node --test scripts/*.test.mjs` checks the player,
catalog, generated pages, subtitles and schedules.
