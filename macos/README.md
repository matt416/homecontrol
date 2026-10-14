# macOS companion

A standalone Swift package for macOS 14+. It selects Photos/Calendar content, configures trash collection and weather, and previews a paired frame. No third-party Swift packages are required. See the [root run guide](../README.md) and its experimental/vibecoding notice before granting library access.

From this directory:

```sh
bash scripts/build-app.sh
open "dist/HomeControl Open Source.app"
```

Requires Swift 5.9+, Xcode command-line tools, Node 24 LTS with npm, and Python 3. The script packages the existing blue app icon, native resources and repository licence notices, then ad-hoc signs and verifies the app. It builds for the current architecture and does not notarize the result. Build the complete app bundle rather than running a bare Swift executable for normal library-permission use.

The app bundles and starts the [server](../server/README.md) automatically. Quit offers an unchecked **Keep the frame server running** checkbox; reopening reuses the existing server. The normal native data folder is `~/Library/Application Support/HomeControl Open Source/Frame`. Changing the folder in Settings → Advanced also updates the app-owned server. For standalone development only, match `APPLE_EXPORT_DIR` manually.

An awake Mac, a running HomeControl app, granted Photos/Calendar permissions and enabled sharing are required to keep those libraries served. The server alone cannot refresh them; exports expire after ten minutes. Permission-specific empty states guide first-time and denied access. `HOMECONTROL_EXTERNAL_SERVER=1` opts into a manually started development server.

## Tests

```sh
bash scripts/test.sh
```

Tests use isolated temporary settings and do not need library access. Actual Photos/Calendar permissions and selection still need manual testing. For a native demo, start the server demo and use the command in the [root README](../README.md#2-try-it-without-private-data).

## Optional local photo-subject helper

This helper uses Apple's Vision framework to suggest crop positions. Without it, the frame uses a standard crop. From this directory:

```sh
bash subject-analyzer/build.sh
```

It creates `subject-analyzer/build/homeframe-subject-analyzer` for Apple Silicon and Intel. Set its absolute path as `SUBJECT_ANALYZER_PATH` in `server/.env`, then restart the server. Photos are analysed locally. The helper is not required for setup.

`Assets/` contains the existing app/menu artwork and Lucide source SVGs; `Sources/HomeControl/Resources/Icons/` contains their native resources. Preserve the repository's MIT and third-party notices. Apple's system frameworks are proprietary platform dependencies and are not redistributed here.
