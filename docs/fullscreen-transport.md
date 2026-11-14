# Fullscreen themed transport — 2026-11-14

Fullscreen now moves the original TV transport into its overlay and restores it on exit. The same nine skin layouts, textured keys, volume menu, captions, comments and reactions are retained. No second video or action-forwarding controls are created. The screen key becomes Exit fullscreen; Pop out is disabled until fullscreen is closed.

The existing three-second idle fade, pointer/touch reveal, keyboard-focus protection and open-menu protection remain. Short landscape screens allow vertical overlay scrolling. The bank is constrained to the viewport and to 1000px on wider screens.

Verified all nine skins at 1440x1000, 800x600, 390x844 and 844x390. Verified identical transport/video nodes, matching button finishes, return placement, idle hiding/reveal, volume-menu protection and native browser fullscreen exit. Settings and popout browser checks: 8 passed. Fullscreen browser checks: 2 passed.
`node --test scripts/*.test.mjs`: 128 passed, 15 browser checks skipped in the default environment; dedicated browser runs above explicitly enabled Chrome.
## Compact fullscreen refinement

Fullscreen now uses 44px-tall keys in a shallow, content-width strip while retaining each skin's materials and shapes. Narrow phones use six columns and two rows. The oversized pause key and disabled pop-out key no longer consume fullscreen space. Reduced panel padding, title size, line wrapping and backdrop opacity keep more of the picture clear. The regular cabinet controls are unchanged.

Browser checks passed across all nine skins at 1440x1000, 800x600, 320x700, 390x844 and 844x390. Asserted the bank remains within the viewport, at most 85px tall on desktop and 130px on phones, with at least 44px touch targets. Existing idle/menu and native-exit checks passed.

## Native phone picture-in-picture — 2026-11-14

On phones/tablets the Pop out action now requests video picture-in-picture: Safari's supported WebKit presentation mode first, otherwise the standard video PiP API. The video and TV remain in the original document, with no new browser tab, second player, seek or reload. Desktop keeps its themed Document PiP / window fallback.

Native enter/leave events synchronize Return TV, the active button and fullscreen availability. Returning from either the native controls or site restores normal control state. Backgrounding the phone does not explicitly exit native PiP. Before metadata is ready, the site asks the viewer to start the TV; unsupported/denied requests show a message and never open a mobile popup tab. Browser/OS support remains required. Native PiP contains the video and system controls, not the custom bezel or HTML overlays.

Validation: 12 popout browser checks passed, including existing desktop paths, standard/WebKit mobile API simulations, denial, unsupported/unready states, backgrounding, repeated return, and actual Chrome video PiP with a playing MP4. Safari/iPhone hardware was not available for direct testing.

References: https://developer.apple.com/documentation/webkitjs/adding_picture_in_picture_to_your_safari_media_controls and https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestPictureInPicture
