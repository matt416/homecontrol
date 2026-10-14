# HomeControl

A Mac app for sharing photos, calendars, collection day and weather with a household display. Choose what to share on your Mac, then pair an Android frame or browser using eight numbers: `1234-5678`.

![Native Android frame showing fictional photos, family calendar, collection day and weather](docs/android-frame.png)

*The native Android display. Photos, plans and the forecast together, with no browser required.*

> **Vibe-coded / experimental software**
>
> Built with substantial AI-assisted coding. This is a personal open-source spike, not a professionally audited or production-hardened product. Tests and demo checks do not guarantee correctness, privacy or security. Review the code before granting library access, start with the fictional demo, and use a trusted local network. Do not rely on it for critical reminders or expose the server to the internet. Provided **as is, without warranty**, under the MIT licence.

**Photos and Calendar require an awake, running Mac with HomeControl open, the relevant permissions granted, and sharing enabled.** The frame does not connect directly to iCloud. Locking the Mac is fine while it stays awake; sleep, shutdown or quitting HomeControl interrupts library updates. If you leave only the server running, the last Photos/Calendar export expires after ten minutes. A disconnected Android frame can retain cached content locally; this is not remote erasure.

## What it does

- **Photos:** choose an iCloud Shared Album, hide photos, arrange their order and adjust slideshow timing. Add photos by sharing to that album from your iPhone or Mac.
- **Calendar:** select calendars to share; browse dates on the frame. Weather and collection details fade away while browsing to reveal the full-height calendar, and return on **Today**.
- **Collection day:** configure trash, recycling, green bins and brown bags with a repeating weekly schedule. This does not read Apple Reminders.
- **Weather:** choose location, Celsius/Fahrenheit and timezone in the Mac app. Weather starts disabled.
- **Pairing:** one-use codes in `1234-5678` format, valid for ten minutes. Frames store the longer session credential internally.

No camera, plant-care or home-automation integrations are included. The original blue HomeControl house/switch icon and menu-bar artwork are preserved.

![Choose and arrange photos in the Mac companion](docs/screenshots/02-mac-photos.png)

*Manage shared photos and slideshow settings on the Mac.*

## Separate packages, one repository

Each part has its own build and README. There is no root npm package, workspace manager, Nx, Turborepo or Gradle project.

| Folder | Purpose |
| --- | --- |
| [`macos/`](macos/README.md) | Swift Mac app; starts and controls its bundled local server |
| [`server/`](server/README.md) | One shared API for both displays; also serves the browser build |
| [`frame-android/`](frame-android/README.md) | Native Java Android display, with its own APK and tests |
| [`frame-web/`](frame-web/README.md) | React browser display, also used by the Mac's Frame Preview |
| [`contracts/`](contracts/README.md) | TypeScript payload validation and shared schedule/date helpers |

**The Android and browser displays are two explicitly separate clients.** Android contains native views, not a WebView wrapper. Browser access supports other displays and the Mac preview. Display UI changes may require changes in both packages; content export, weather settings, pairing rules and serving are shared. There is no third copy of the web UI inside the Mac source. Clone the whole repository: the JavaScript projects use a local `file:../contracts` dependency.

## Set it up with your agent

Give your coding agent this repository URL and ask:

> Set up HomeControl from https://github.com/matt416/homecontrol. Follow AGENTS.md and docs/AGENT-SETUP.md. Build and install the Mac app and my frame, guide me through permissions and content selection, configure automatic startup for a household kiosk, and verify pairing and Wi-Fi updates. Preserve existing data and signing keys, and show me how to exit or undo the setup.

The [agent setup guide](docs/AGENT-SETUP.md) covers the complete path, including prerequisites, fictional demo, installation, Mac login/sleep settings, Android default-Home setup, update permissions, verification and rollback. An agent still needs your Mac/device access and your input for OS permission and installation confirmations. A GitHub URL does not grant those permissions.

## Build and open the Mac app

Requirements: **macOS 14+**, Xcode command-line tools (**Swift 5.9+**), **Node.js 24 LTS** with npm, and **Python 3**. Node 22.13+ is also supported. Install Apple's tools with `xcode-select --install` if needed.

```sh
git clone https://github.com/matt416/homecontrol.git
cd homecontrol
bash scripts/run.sh
```

The script installs locked dependencies, builds the browser and server, bundles a copy of your Node runtime, builds and ad-hoc signs the Mac app, and opens it. The Node distribution's `LICENSE` must be beside its `bin` directory; otherwise set `HOMECONTROL_NODE_LICENSE=/path/to/that/distribution/LICENSE` when building.

After building, simply open:

```sh
open "macos/dist/HomeControl Open Source.app"
```

**No server terminal needs to stay open.** HomeControl starts its server automatically. The app bundle includes its runtime and builds for the current Mac architecture. This source release is not notarized and is not an App Store installer.

## Set up your frame

1. Open **Photos** and **Calendar**. Each page asks for its own permission before displaying library controls. If access was previously denied, its button opens the relevant Privacy & Security settings. Grant access to **HomeControl Open Source**, then return to the app.
2. Choose a shared album and/or calendars. Click **Start Sharing**. You may use either library independently.
3. In **Collection day**, enable reminders and choose the schedule. Save it.
4. In **Weather**, search for a location, choose a result, select units and save. The selected timezone also controls the clock, calendar and collection schedule. Manual coordinates and timezone are under Advanced.
5. Open **Settings** for the frame address and pairing code. Local-network access starts automatically. Allow the local network connection if macOS asks. Use only a trusted network.
6. Install the native [Android frame](frame-android/README.md), then select the Mac it discovers and enter the code. Use the manual address option if discovery is blocked. Alternatively open the address in a browser and enter the code. **Frame Preview** on the Mac uses the browser package directly.

![Inline calendar selection with per-calendar colours and family member labels](docs/screenshots/01-mac-calendars.png)

*Choose several calendars, give each a colour, and optionally show a name beside event times.*

<details>
<summary>Collection day and weather settings</summary>

![Repeating collection schedule in the Mac app](docs/screenshots/03-mac-collection.png)

![Weather location and units configured on the Mac](docs/screenshots/04-mac-weather.png)

</details>

Settings shows the Mac's `.local` hostname on port 8797. The Mac preview also works at `http://127.0.0.1:8797`. Guest networks may prevent devices reaching one another. Pairing codes expire and work once; choose **New Code** for each additional frame.

### Quitting and reopening

Quit presents a **Keep the frame server running** checkbox, unchecked by default:

- **Unchecked:** quit HomeControl and stop its server.
- **Checked:** quit the app, keep the server available. Reopening HomeControl reconnects to that server rather than starting a duplicate.

Photos/Calendar updates require the app, its permissions and an awake Mac. Leaving the server running does not replace that requirement; exports expire after ten minutes. Weather and collection settings can continue to be served while the Mac stays awake. Closing the main window keeps the app and server running in the menu bar. Automatic startup is optional; see the [kiosk and login setup](docs/AGENT-SETUP.md#5-set-up-everyday-kiosk-use). No login service is installed by the build script.

## Try it with fictional content

```sh
bash scripts/demo.sh
```

Open **http://127.0.0.1:8798** and enter the code printed in the terminal. Control-C stops this standalone demo. It uses an original landscape illustration, fictional events, a sample collection schedule and simulated weather; it does not read Photos/Calendar or fetch forecasts. Restarting resets `server/data/demo/`.

For Mac controls using that sample data, quit another running copy first, then in a second terminal from the repository root:

```sh
bash scripts/build-app.sh
HOMECONTROL_DEMO=1 HOMECONTROL_DATA_DIR="$PWD/server/data/demo" \
  "macos/dist/HomeControl Open Source.app/Contents/MacOS/HomeControl"
```

Demo mode deliberately does not request library permissions or start another server. Weather's Search still sends the entered search to Open-Meteo. Quit and open the app normally to use your own libraries.

![The web frame running inside the Mac companion preview](docs/screenshots/06-mac-frame-preview.png)

*The Mac preview reuses the optional browser client. Android uses its own native interface.*

[Browse all Mac demo screenshots](docs/screenshots/README.md) or view the [standalone browser display](docs/frame.png). All published captures use fictional content.

![Browser pairing](docs/pairing.png)

## Build parts independently

```sh
(cd contracts && npm ci && npm run build)
(cd server && npm ci && npm run build)
(cd frame-web && npm ci && npm run build)
bash macos/scripts/build-app.sh
```

For Android's JDK/SDK setup, APK build, installation and emulator checks, see [`frame-android/README.md`](frame-android/README.md). Android does not require Node or the web client on the device.

The standalone server is a development option. Stop the app-owned server before using the same port:

```sh
cd server
npm run setup
npm start
```

`npm run setup` creates a private `.env` with a random credential and preserves existing settings. A sanitized [`.env.example`](server/.env.example) contains only placeholders. Run these commands from `server/`. For the Mac UI against a manually started server, launch the app executable with `HOMECONTROL_EXTERNAL_SERVER=1`.

For browser development, run `npm run dev` in `frame-web/` with a server on 8797. Open `http://127.0.0.1:5173`; each browser origin has its own pairing session. Rebuild contracts after changes.

## Configuration and privacy

Normal app-managed files are private and outside the checkout:

```text
~/Library/Application Support/HomeControl Open Source/
  Frame/             selected content and weather/collection settings
  Server/server.json private session and local-control credentials
  Server/server.log  local startup diagnostics
```

Change the shared content folder through **Settings → Advanced**; the app updates its server automatically. The app-managed server uses `server.json`, not the development `server/.env`. Do not copy either credential file into the repository or an issue.

Standalone server configuration is documented in [`.env.example`](server/.env.example). `APPLE_EXPORT_DIR` must match the Mac export folder; `FRAME_WEB_DIR` defaults to `../frame-web/dist`. `HOST`, `PORT` and `PUBLIC_ORIGIN` must agree with the address your display uses. The server rejects unrecognized hosts and origins.

No analytics or cloud account is required. Photos/events are served locally to paired clients. Place searches and forecast coordinates go to Open-Meteo. Plain HTTP does not encrypt content or credentials in transit: use a trusted local network, do not forward the port to the internet, and do not treat this spike as secure remote access.

All frames currently share one session credential; there is no per-device revocation. Disconnect clears that client's stored credential. Android caches data/photos for offline display; clear its app storage to remove its local cache. To revoke all frames, stop the server, generate a replacement with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, and replace `token` in the app's private `server.json` (or `FRAME_TOKEN` in the standalone `.env`). Reopen/restart and pair again. Preserve the separate `controlToken` field; it restricts app lifecycle controls to authenticated local requests.

## Checks and troubleshooting

```sh
bash scripts/test.sh
bash frame-android/test.sh  # requires a JDK on PATH
bash scripts/build-app.sh
```

The main checks cover Swift and JavaScript tests, types/lint/format/build and dependency licences. Android has host tests and emulator instrumentation. CI builds the Mac app and runs the Android host tests. See [verification notes](docs/verification.md) for what was exercised and what remains untested.

| Symptom | Next step |
| --- | --- |
| Photos/Calendar asks for permission | Use that page's Allow Access button; previously denied access must be enabled in System Settings. |
| Permission button does nothing in a demo | Quit demo mode and open the packaged app normally. |
| No photos after selecting an album | Share photos to that named iCloud Shared Album from your iPhone or Mac; start sharing and let iCloud sync. |
| No events | Choose calendars, enable sharing and confirm permissions. |
| Frame server offline | Settings → Advanced → Restart Server / Open Server Log. Check that another development server is not using 8797. |
| Another device cannot connect | Check that the Mac app is open; check firewall, hostname and guest Wi-Fi isolation. |
| Code rejected | Get New Code. After too many attempts, wait a minute. |
| Weather missing | Choose a location, enable weather and save; allow up to one minute. |
| Shared contracts cannot resolve | Build `contracts` first and keep the sibling package folders together. |

Browser settings are available through a triple-tap or keyboard Settings button. Android settings use a two-finger hold or Back. Both let you pause photos and disconnect. Browse the calendar to fade weather/collection away; **Today** restores them.

## Licences and contributions

HomeControl source, original branding and demo artwork are **MIT**. Keep [`LICENSE`](LICENSE), [`THIRD-PARTY-NOTICES.txt`](THIRD-PARTY-NOTICES.txt) and relevant attribution when redistributing.

- UI icons: **Lucide ISC**, with **Feather-derived MIT** portions. No SF Symbols artwork or font files are distributed.
- JavaScript dependencies: separately locked per package and audited in [`third-party/dependencies.json`](third-party/dependencies.json). Android uses platform APIs, with no additional runtime libraries.
- Bundled **Node.js**: its full distribution licence and dependency notices are included in the app's `Contents/Resources/Runtime/LICENSE-Node.txt`.
- **Apple frameworks/macOS and the Android SDK are platform/toolchain dependencies**; the MIT licence does not relicense those platforms. They are not redistributed as part of this source release.
- **Open-Meteo** weather data is [CC BY 4.0](https://open-meteo.com/en/terms). Its free hosted API is for [non-commercial use](https://open-meteo.com/en/pricing); commercial use requires appropriate service terms or another provider.
- Accent swatches: **Tailwind CSS MIT** palette values, with attribution; no Tailwind runtime is bundled.
- **resvg-js MPL-2.0** is an unmodified development-only icon renderer, not included in the application runtime.

Read [licence provenance](third-party/README.md). This is a source release, not a claim that every operating system or external service is open source. Contributions should include reproduction steps and verification with fictional data; never attach private exports, keys, tokens or `.env` files.

## Frame updates over Wi-Fi

The Android frame includes a Wi-Fi updater. Keep it on its original wall power supply and on the same network as the Mac. A computer USB port may not supply enough power for a continuously running display.

Build the Android release before packaging the Mac app to include it in **Settings → Frame updates**. Once a newer signed release is available, choose **Send Update**, then confirm **Install** on the frame. The first update may ask you to allow installation from HomeControl Frame. **Android 6 uses the global Security → Unknown sources switch**; newer versions may use a per-app Install unknown apps grant. Enabling the Android 6 switch permits installing apps outside the Play Store. Leave it enabled if you want future Wi-Fi updates, or turn it off after installation and re-enable it next time. Your agent should explain this choice before changing it. Pairing and photo settings stay in place. See [Android update instructions](frame-android/README.md#updates-over-wi-fi) for building and publishing a release.

Select multiple calendars directly on the **Calendar** page. Each selected calendar has a frame colour and an optional visible name. The frame displays names next to event times, for example **6:00pm – Laura**. Leave the name blank to show only the time. These preferences affect the frame and do not rename or recolour your Apple calendars.

### Appearance and everyday use

HomeControl runs in the menu bar. Open Settings to show its window and Dock icon; closing the window hides the Dock icon and keeps sharing and the server running. Quit is a separate action.

On Calendar, the calendar list is always visible beside the preview. Select multiple calendars, choose their colours, and optionally label them with family members’ names. In Settings → Frame appearance, choose a Tailwind swatch or use the native macOS colour picker. The shared accent reaches Android and web displays within a few seconds.

![Shared accent swatches, custom colour and frame update controls](docs/screenshots/05-mac-appearance.png)

*One accent for every connected frame, managed on the Mac.*

The Android pairing screen discovers compatible Macs over Bonjour on the same Wi-Fi. Select the Mac and enter its eight-digit code. A manual address remains available for networks that block discovery. The web frame is reached at the Mac’s address; browsers do not provide native Bonjour discovery.

Updates retain the `org.homecontrol` app identities and private data directory to preserve pairing and settings. Locally rebuilt, ad-hoc signed Mac apps may need library permission again.
