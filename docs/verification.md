# Spike verification

Checked locally on 2026-10-14.

- 12 native XCTest cases passed: calendar appearance persistence/normalization, settings validation, photo ordering and dashed pairing display.
- 46 JavaScript tests passed: 4 contracts, 17 server and 25 web. The separate managed-server lifecycle integration test passed. TypeScript, ESLint, Prettier and production builds passed. Local-listener tests required execution outside the filesystem/network sandbox.
- macOS release built and its packaged ad-hoc signature verified. It bundles Node, server, browser preview, notices and Android 0.3.1 (version code 5).
- The packaged Mac app was inspected with real permission empty states and an isolated fictional-data demo. The duplicate toolbar was removed; page actions sit beside the single heading. Calendar selection, optional names and colours are inline. Shared accent swatches and the native ColorPicker control are present in Settings. Selecting Sky in the demo Mac app propagated `#38BDF8` to the live web frame.
- Closing Settings changed the running app from regular/Dock-visible to accessory/menu-bar-only, while its authenticated server still responded. Quit with the checkbox unchecked stopped the server; keeping the server checked was verified in the earlier lifecycle pass.
- Chrome DevTools inspected the live browser demo, screenshots, event names/colours and geometry at 1280×800. Clock height was 82.8 px; collection items were beside the clock at the far right. The calendar stayed 601.2 px high while weather/collection faded out and Today restored them. The weather begins at y=614.5 with the calendar fading behind its gradient. Reduced-motion CSS uses a brief opacity transition.
- Native Android emulator (API 35, 1280×800) passed pairing, dashed formatting, photo/calendar layout, browsing/Today restoration without resizing, configurable weather and collection/DST checks. Final HomeControl artwork, unclipped clock, upper-right collection items, event names/colours and weather gradient were visually inspected. The app contains no WebView.
- Physical Android 6/API 23 frame: the replacement was installed, paired over Wi-Fi, and the old private frame app removed. The Wi-Fi updater downloaded an authenticated release and reached Android's installer. Android 6's installer required a verified APK via a file URI; this compatibility fix was installed in bootstrap 0.2.1. With the user's approval, the global Unknown sources setting was enabled. The frame then installed 0.3.1 over Wi-Fi, retained its pairing, returned to the native app, and reported version code 5 / idle to the Mac server. USB did not install that final release.
- Bonjour advertisement was observed on the Mac and compatible-service filtering is implemented. Selection of an automatically discovered Mac has not yet been exercised end to end on the physical device. A manual-address fallback remains available.
- All 411 unique dependency versions across 830 npm lockfile entries have reviewed open-source licence identifiers. Original HomeControl artwork, Lucide/Feather, Tailwind palette attribution and bundled Node notices are included as applicable.
- Repository/demo screenshots contain fictional data and the original demo illustration. Shareable Mac and frame screenshots were captured from the running demo, not mockups.

## Hardware and deployment limits

Screen corruption and USB loss were reported while the physical frame was powered only by the Mac's USB port; the user reported normal operation on wall power. Later storage inspection showed about 11.9 GiB free, so storage exhaustion was not supported by that evidence. The low uptime after reconnecting supported a device restart. A power problem is plausible but not a confirmed electrical diagnosis.

Long-duration hardware stability, automatic Home startup after reboot on each vendor's firmware, Mac startup after login, Intel Macs, other macOS versions and public binary notarization remain unverified. Kiosk/login setup and its checks are documented in [AGENT-SETUP.md](AGENT-SETUP.md); these instructions are not a claim that device-owner lock task management is implemented. The Mac app was checked on Apple Silicon. Library access requires the user's Photos/Calendar grants; rebuilding an ad-hoc signed app can require granting them again.

## Package boundaries

Independent `macos`, `contracts`, `server`, `frame-web` and `frame-android` projects. JavaScript projects each have their own lockfile and local contracts dependency; no root workspace. The Mac preview reuses the web client while Android renders native views. The README and agent setup guide cover building each part, installation, permissions, fictional demos, kiosk startup, Wi-Fi updates and undoing setup.
