# Rabbit-Ears.stream for Roku

A Roku app that plays the same channels as the website, in step with it. Everyone on the site and on
Roku sees the same moment of the same show.

## How it works

- The website works out each channel's lineup in the browser. Roku can't run that code, so the
  nightly build (`scripts/build-tv-feed.mjs`) runs the website's own schedule code and saves the
  result:
  - `https://rabbit-ears.stream/tv/channels.json`: the channel list
  - `https://rabbit-ears.stream/tv/ch/<number>.json`: what airs on that channel for the next ~54 hours
- The app (`components/MainScene.brs`) reads those files and plays the Internet Archive video at the
  right position. Every 2 seconds it checks the clock, moves on to the next show or commercial when
  it's time, and catches up if buffering left it behind.

## Remote

- **Up / Down:** change channel
- **Left or \*:** channel guide
- **OK:** what's on now and next
- **Back:** hide the banner, or exit

The app remembers the last channel.

## Try it on your own Roku (sideloading)

1. **Turn on Developer Mode.** On the Roku remote press Home ×3, Up ×2, Right, Left, Right, Left,
   Right. Note the address it shows (like `http://192.168.1.50`), accept the agreement and choose a
   password. The Roku restarts.
2. **Build the zip.** On the computer, run `powershell -File roku/package.ps1`. This makes
   `roku/out/rabbit-ears-roku.zip`.
3. **Install.** On a computer on the same Wi-Fi, open the Roku's address in a browser and sign in
   with user `rokudev` and the password you chose. Click **Upload**, pick the zip and click
   **Install with zip**. The app starts on the TV.

If something goes wrong, the Roku's debug log is at port 8085 (for example, `telnet 192.168.1.50 8085`).

## Publishing to the Roku Channel Store (later)

Needs a free Roku developer account (developer.roku.com) on the Rabbit Ears Gmail. Upload the same
zip as a new "public channel", then add store artwork, a description and a privacy policy. Roku
reviews it before it goes live. Roku also requires apps to package-sign the zip on a Roku in
Developer Mode (`genkey`, then the "Packager" page) before it's uploaded.

## Images

`powershell -File roku/make-images.ps1` redraws `images/` (icons and splash screen) from
`assets/icon-512.png`.

## Not on Roku yet

Radio, games, captions and custom channels are website-only for now.
