Modular viewing rooms — November 13, 2026

Pixel Deck remains the default. Seven existing skins now share a responsive module system while retaining their own type, materials, surfaces and cabinet silhouettes. Gutter Signal adds an eighties DIY punk room: photocopy texture, acid-yellow labels, hot-pink offsets and a scuffed portable CRT.

TV hardware: Retro Cabinet walnut component CRT; Movie Theatre gold Art Deco projection monitor; Stadium Seat production/scoreboard monitor; Silver Screen brushed-silver studio display; Cozy Den ochre tabletop portable; Midnight Metal touring road case; Ivory Console cream moulding and wine controls; Pixel Deck native-grid navy/teal chassis; Gutter Signal battered black plastic and tape accents. Each uses the existing video, real channel dials, speaker and Rabbit Ears logo. No picture-covering texture or decorative control substitutes. Miniatures in the theme picker match the hardware.

Implementation: assets/modular-themes.css, assets/theme-tvs.css, assets/theme-previews.css, skin registry and preference application in assets/interface.js. Existing skins/saved keys retained. These screenshots are local layout review captures, not a current programming announcement. Styles are native CSS so their edges remain crisp at different sizes.

Checked 63 skin/viewport combinations from320 to1440px, nine fullscreen entry/exit flows, nine portrait layouts with title/actions below the TV, and 18 picker/18 cabinet screenshot captures. Fixed narrow-phone header/timeline overflow and the intermediate-width Ivory left rail. Theme switches preserve the video node.

Discord account preferences save theme, radio appearance, CC on/color/backing, TV volume/mute and radio volume. Guest choices remain local. Authenticated accounts have independent versioned records, with offline pending edits, conflict merging and safe account switching. Restoring preferences never invokes video play/load. See docs/account-preferences.md for deployment, privacy and validation notes.
