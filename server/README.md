# Local server

An independent Node/Fastify project. The normal Mac app bundles and starts it automatically; these manual commands are for development. Stop the app-owned server before using the same port. It serves the frame build, reads the Mac's selected library export and collection/weather settings, fetches forecasts, and handles pairing. Read the root [experimental notice and network guidance](../README.md) before using real content.

Requires Node 24 LTS (or Node 22.13+), npm and a built sibling `contracts` package. From the repository root:

```sh
(cd contracts && npm ci && npm run build)
(cd frame-web && npm ci && npm run build)
cd server
npm ci
npm run setup
npm run build
npm start
```

Open http://127.0.0.1:8797. The Mac app supplies the pairing code and private export. `npm run setup` creates `.env` only if absent; it never overwrites your token or settings. Configuration is loaded from this directory, so run server commands here.

`npm run demo` builds and starts a fictional-data server on http://127.0.0.1:8798, with a short code printed in the terminal. Build `frame-web` first. The demo resets `data/demo/` each time and uses simulated weather. Control-C stops either server.

## Configuration

See [`.env.example`](.env.example). `HOST`, `PORT` and `PUBLIC_ORIGIN` configure access; `APPLE_EXPORT_DIR` must match the native app's folder. `FRAME_WEB_DIR` points to the browser build and defaults to `../frame-web/dist`. Weather location and units come from the native app, not hardcoded server settings.

The default listener is loopback-only. This is not an internet-facing service: no TLS termination, no per-device credential revocation and no independent security audit are provided. Full pairing, local-network setup and token rotation instructions are in the [root README](../README.md).

## Development

```sh
npm run dev
npm run check
```

`dev` watches TypeScript output and restarts the server. Rebuild `contracts` after editing shared payloads. `check` runs types, lint, format checks, tests and the production build. A missing frame build still allows the API to run but leaves no frame page to serve.

Source is MIT. Dependencies retain their own licences; see [notices](../THIRD-PARTY-NOTICES.txt). Open-Meteo's hosted API terms are separate from this source licence.

The app entry point is `scripts/managed.mjs`. It reads private `Server/server.json` settings outside the checkout and offers authenticated, loopback-only lifecycle controls with a separate local-control secret. App mode does not read `server/.env`. Reopening the app reconnects to this server; the quit checkbox chooses whether it stays alive. Photos/Calendar still require the awake Mac and running, authorized app; their exports expire after ten minutes.
