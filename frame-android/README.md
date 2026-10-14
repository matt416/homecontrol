# Native Android frame

Independent Java/Android package. Native views render photos, calendar, collection day and weather from the shared HomeControl API. **No WebView and no embedded copy of `frame-web`.** The browser display is a separate optional client. Read the root [experimental warning](../README.md) before using personal content.

## Build

Requires JDK 17+, Android SDK platform 35, build-tools 35.0.0, Python 3 and `zip`. Install these through Android Studio's SDK Manager or the official Android command-line tools. Set `JAVA_HOME`, add its `bin` to `PATH`, and set `ANDROID_HOME` to your SDK directory.

```sh
# From the repository root:
bash frame-android/build.sh
```

Output: `frame-android/build/homecontrol-frame.apk`. The script uses the official Android build tools directly; no Gradle installation is needed. It creates an ignored local development key at `frame-android/.local/development.keystore`. Preserve that key to update your own installation. Do not publish it. `HOMEFRAME_KEYSTORE` can select a different development key path. This script uses standard development-key credentials and is not a production signing pipeline.

The app requires Android 6/API 23+, targets API 35, and is intended for landscape tablets. Package ID: `org.homecontrol.frame`, separate from the original private frame app.

## Install and pair

Enable USB debugging on your test device and select its explicit ID from `adb devices`:

```sh
adb -s DEVICE_ID install -r frame-android/build/homecontrol-frame.apk
```

Open **HomeControl Frame**. On the Mac, open HomeControl → Settings. Select the Mac discovered on the same Wi-Fi, then enter its `1234-5678` code. If the network blocks discovery, expand the manual-address option. Both devices must share a trusted local network. Weather location, units and timezone are configured on the Mac.

Photos and Calendar require an awake Mac with HomeControl running, permissions granted and sharing enabled. Leaving only its server running does not refresh libraries; the server stops serving stale exports after ten minutes. Android can show cached content when disconnected. **Disconnect** removes the session credential; clear Android app storage to erase its local cache.

Swipe photos to browse, tap for full screen, long-press for photo settings. Hold two fingers for 1.5 seconds or press Back to open Settings. Browse calendar dates to fade collection/weather away and use the full calendar height. **Today** restores those panels. Android's disabled-animation preference is respected. Updates can be requested from the Mac or from **Check for update** in frame settings; Android asks for confirmation before installation.

## Verify

Host-only tests:

```sh
bash frame-android/test.sh
```

For a disposable emulator only (the instrumentation resets this app's pairing preferences):

1. Run `bash scripts/demo.sh` in another terminal.
2. Start a landscape emulator; 1280×800 at 160 dpi is the reference layout.
3. Build/install the test variant and connect to the fictional demo:

```sh
HOMEFRAME_TEST_BUILD=1 bash frame-android/build.sh
adb -s emulator-5554 install -r frame-android/build/homecontrol-frame.apk
adb -s emulator-5554 reverse tcp:8798 tcp:8798
adb -s emulator-5554 shell am instrument -w \
  -e server http://127.0.0.1:8798 -e code CODE_FROM_DEMO \
  org.homecontrol.frame/.FrameSmokeTests
```

Use your emulator's actual ID. The test exercises pairing, calendar layout/browsing, photo loading, bin rotation and weather location/units; it writes screenshots in the app cache. A code is single-use: obtain a fresh one before each run. Rebuild **without** `HOMEFRAME_TEST_BUILD` before normal installation; the release excludes instrumentation and is non-debuggable. Do not run these tests on a frame containing personal settings.

Source and original blue icon are MIT; vector UI icons are Lucide ISC/Feather MIT. The APK includes `assets/NOTICE.txt` and exposes it in Settings. Android platform APIs and system fonts are not redistributed here. Physical Android 6 installation and the update flow are covered in the verification notes; see [verification notes](../docs/verification.md).

## Updates over Wi-Fi

Keep the frame on its original wall adapter and the same trusted network as the Mac. USB is needed only for initial installation. Preserve the ignored signing keystore: Android rejects replacement APKs signed with a different key.

1. Increase `versionCode` and `versionName` in `version.json` for each release.
2. Build with `bash frame-android/build.sh` (no `HOMEFRAME_TEST_BUILD`).
3. Build the Mac app with `bash scripts/build-app.sh`; when the Android APK exists and `ANDROID_HOME` is set, it is verified and bundled. Restart HomeControl and its server to publish the bundled release.
4. In Mac **Settings → Frame updates**, choose **Send Update** for the connected frame. It checks within 30 seconds, downloads over Wi-Fi and opens Android's installer.
5. On Android, allow **HomeControl Frame** to install updates if asked (Android 6 uses a global **Unknown sources** setting), then confirm **Install**. Open the frame again after installation if Android does not return automatically.

To publish only an Android update without rebuilding the Mac app, use the shared content folder shown in Mac Settings → Advanced:

```sh
node server/scripts/publish-native-update.mjs   frame-android/build/homecontrol-frame.apk   "$HOME/Library/Application Support/HomeControl Open Source/Frame"
```

The script requires Node.js, `ANDROID_HOME` and Java. It validates the package name, release build and APK signature before publishing. The paired frame also checks the SHA-256 checksum, maximum size (32 MiB), newer version, package ID and matching signer. Downloads and update requests require pairing. This is not a silent installer and does not change Android system software.
