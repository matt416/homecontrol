# Browser frame

The browser client and the Mac Frame Preview share this one independent React/Vite project for photos, calendars, collection reminders and weather. It uses the blue HomeControl branding and pairs with the local server using `1234-5678` codes. Read the [root README](../README.md) for the vibe-coded/experimental warning and complete setup.

Requires Node 24 LTS (or Node 22.13+) to build. The display itself needs only a browser. From the repository root:

```sh
(cd contracts && npm ci && npm run build)
cd frame-web
npm ci
npm run build
```

The static build is written to `dist/`. Start the sibling [server](../server/README.md), which serves this directory at http://127.0.0.1:8797 together with authenticated API endpoints. Opening `dist/index.html` directly or using an unrelated static server will not supply those APIs.

## Development

With the normal server running on 8797:

```sh
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` requests to the local server; enter the Mac's pairing code in that browser. A browser at another origin has its own saved pairing session. Rebuild `contracts` after shared changes.

```sh
npm run check
```

Checks include types, lint, formatting, component tests and a production build. The output targets Chromium 106-era browsers, but specific physical frame hardware still needs testing. Verify visual changes with live Chrome DevTools checks and screenshots.

Triple-tap the frame to open settings; keyboard users can tab to the Settings button. Weather and collection settings are edited on the Mac. The frame uses a local browser credential after pairing; **Disconnect** clears that browser's copy.

Source and original branding are MIT. Lucide icons are ISC with Feather-derived MIT portions. Licence notices are available at `/licenses.txt` and linked from frame Settings. System fonts are used, with no font files distributed. See the [full licence notes](../third-party/README.md).

The native [Android display](../frame-android/README.md) is a separate package, not a wrapper around this client. Calendar browsing fades the weather/collection overlay; Today restores it. The calendar stays full height underneath, so fading does not move the visible day. Reduced-motion styling uses a short opacity-only fade.
