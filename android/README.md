# Rabbit-Ears.stream for Android TV, Google TV and Fire TV

One Android app for TVs (Android TV, Google TV, Fire TV) and for phones and tablets. It plays the same
schedule files as the Roku app (`tv/channels.json` and `tv/ch/<number>.json`, see `roku/README.md`),
so it stays in step with the website.

## Controls

- **TV remote:** Up / Down changes channel, Left (or Menu) opens the channel guide, OK shows what's on
  now and next, Back hides the banner or exits.
- **Phone or tablet:** swipe up or down to change channel, tap for the channel guide.

It remembers the last channel.

## Building

There's no Android tooling on the project computer, so GitHub builds it: the "Android app" workflow
(`.github/workflows/android.yml`) runs whenever `android/` changes, or from its "Run workflow"
button. The finished APK is attached to the run as **rabbit-ears-android** (`rabbit-ears-tv.apk`).
It's debug-signed: fine for sideloading and testing, not for the Play Store.

## Installing on a Fire TV (sideloading)

1. On the Fire TV: Settings → My Fire TV → Developer Options → turn on **Install unknown apps** for
   the Downloader app (install "Downloader" from the Amazon store first). On newer Fire TVs,
   Developer Options appears after clicking "About → Fire TV Stick" seven times.
2. In Downloader, enter `rabbit-ears.stream/app/rabbit-ears-tv.apk` and install it.

On Android TV / Google TV, the same works with any file-manager or "Downloader" app.

## Images

`powershell -File roku/make-images.ps1` redraws the launcher icon and the TV banner from
`assets/icon-512.png`, together with the Roku images.

## Store release (later)

- **Google Play** (Android TV, Google TV, phones): $25 one-time developer account. Needs a release
  signing key, an app bundle (`bundleRelease`), a privacy policy and TV screenshots.
- **Amazon Appstore** (Fire TV): free developer account.

Radio, games and captions are website-only for now.

## Download address

The current build is published at **https://rabbit-ears.stream/app/rabbit-ears-tv.apk** (nothing on
the site links to it, and robots.txt keeps search engines off `/app/`). To update it, download the
APK from the latest "Android app" run and replace `app/rabbit-ears-tv.apk`.
