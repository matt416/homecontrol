# Open-source materials

HomeControl source, the original blue HomeControl artwork and menu-bar marks, and the original demo landscape are included under the root MIT licence. The app and frame reuse the same HomeControl branding. No stock photos or third-party fonts are included.

Other UI icons are **Lucide 0.468.0**, under ISC, with Feather-derived portions under MIT. Native PNGs are rendered from those SVGs; no SF Symbols artwork is bundled. Keep the Lucide and Feather notices when redistributing the native app or frame. See [Lucide licensing](https://lucide.dev/license).

`dependencies.json` records every package across the contracts, server and frame lockfiles, including optional packages for other platforms. `THIRD-PARTY-NOTICES.txt` preserves the installed packages’ licence text and attribution, with provenance noted for packages whose npm archive has no separate licence file. Run `python3 scripts/audit-licenses.py` after dependency changes. The audit fails for missing or unreviewed SPDX identifiers; new licences need explicit review in that script.

The source archive excludes third-party binaries and `node_modules`; Each project’s `npm ci` retrieves the exact versions and their notices. For a bundled binary distribution, preserve the applicable package licences and notices. `@resvg/resvg-js` is an unmodified **MPL-2.0** development tool used only to regenerate icons. Its [source](https://github.com/thx/resvg-js/tree/v2.6.2) is available upstream; it is not embedded in the Mac executable or browser bundle. The optional Swift photo subject analyser has no third-party Swift packages.

## Platform and weather service

Apple's system frameworks (SwiftUI, AppKit, Photos, EventKit, WebKit and optional Vision) are macOS platform dependencies. They are not open-source libraries bundled by this project. macOS and Xcode remain required for the native app. System fonts are selected by CSS/SwiftUI rather than redistributed.

Weather and place search use Open-Meteo. Weather data is [CC BY 4.0](https://open-meteo.com/en/terms); the frame and Mac settings include attribution. The hosted free endpoint is for [non-commercial use](https://open-meteo.com/en/pricing), despite this application's permissive source licence. Commercial deployments need an appropriate service plan or a compatible self-hosted endpoint. The Open-Meteo server itself is [AGPL-3.0](https://github.com/open-meteo/open-meteo); it is not bundled here.

These service and operating-system terms are separate from the HomeControl source licence.

## Android and the bundled Node runtime

`frame-android` has no third-party runtime dependencies. It uses Android platform APIs, the original MIT HomeControl image and Lucide/Feather vector adaptations with full notices in `assets/NOTICE.txt`. Test SDKs, emulator images and signing keys are excluded.

The Mac packaging script copies the locally installed Node executable and its full distribution LICENSE (including bundled dependency notices) into `Contents/Resources/Runtime`. The source release does not include that binary. This runtime is separate from the npm lockfile inventory. Builds must supply that distribution licence; packaging fails when it is absent.

The Mac accent swatches use selected Tailwind CSS 3.4.17 palette values, under MIT. The upstream licence is preserved in `upstream/tailwindcss.txt` and the generated notices.
