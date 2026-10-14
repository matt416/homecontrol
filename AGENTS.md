# HomeControl spike

For an installation request, a GitHub-URL handoff, first-time setup, kiosk/automatic startup, upgrades or recovery, follow [docs/AGENT-SETUP.md](docs/AGENT-SETUP.md). It defines the build order, device checks, permission handoffs and observable completion criteria. Use the package READMEs for component-specific commands.

This repository contains a standalone macOS companion, local server, native Android frame, and browser frame. Scope is Photos, Calendar, trash collection, and configurable Weather. Keep camera and plant integrations out of this branch.

Preserve the existing blue HomeControl artwork and menu-bar templates. Use Lucide for other UI icons. Do not introduce assets or dependencies without an open-source licence and attribution. Run `python3 scripts/audit-licenses.py` after dependency changes.

Keep real albums, events, local addresses, `.env`, and pairing secrets out of source and screenshots. Use `server/scripts/demo.mjs` for demonstrations. Do not touch another installed HomeControl app or its data.

Run `bash scripts/test.sh` after behavior changes and `bash scripts/build-app.sh` for native packaging. For frontend visual changes, start the local app and verify it with the Chrome DevTools MCP, including a screenshot and relevant DOM/layout checks. Tests do not replace live verification. Attempt Chrome DevTools before declaring browser checks unavailable; report its exact error if it fails. Verify native UI changes in the packaged app as well.

Display clients live in `frame-android` (native Java) and `frame-web` (React, also reused by the Mac preview). Keep API behavior in `server`/`contracts`; document client differences in their READMEs. The Mac app owns server startup and offers a checkbox to leave it running on quit. Use only an isolated emulator for Android instrumentation.
