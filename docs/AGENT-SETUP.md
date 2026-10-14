# Install HomeControl with an agent

Use this guide when someone gives you this repository URL and asks you to set up a working household frame. Finish with a working system and a short handover, not just build instructions. Preserve existing installations, pairing, and signing keys during an upgrade.

## 1. Inspect the setup

Read the root README and AGENTS.md. Inspect the checkout and its status before editing. Identify the Mac that will serve content and the intended Android display (or browser-only display). Check macOS version, architecture, available disk space, Xcode command-line tools, Node/npm, Python, and Java/Android tools if needed. Do not assume tool paths or use another connected device.

Ask only for information you cannot discover: which display to use if several are connected, the desired album/calendars, weather location/units, and whether to configure automatic startup. Check the current conversation before asking again. Explain any OS permission or on-device confirmation the user must complete.

A real Mac with macOS 14+ is required for Photos/Calendar. Use Node 24 LTS (22.13+ supported), Swift 5.9+, Python 3; Android builds additionally need JDK 17+, SDK platform 35, build-tools 35.0.0, platform-tools and zip. Use official distributions. Follow the package READMEs for platform-specific setup. Avoid replacing a user's existing toolchain; select a compatible installed version first.

Completion: the host, display, prerequisites and existing app/signing-key locations are known.

## 2. Build and demonstrate

Clone the whole repository; these are sibling packages with local `file:../contracts` dependencies, not a root npm workspace.

```sh
git clone https://github.com/matt416/homecontrol.git
cd homecontrol
bash scripts/demo.sh
```

Keep that terminal running. Open `http://127.0.0.1:8798`, enter the printed one-use code, and verify the fictional frame. For web development use the separate `frame-web` instructions. Stop the demo with Control-C when finished.

For a full installation, set `JAVA_HOME`, put its `bin` on PATH, and set `ANDROID_HOME` to the installed SDK. Build Android first so the Mac can bundle its Wi-Fi update:

```sh
bash frame-android/build.sh  # omit for browser-only setups
bash scripts/build-app.sh
bash scripts/test.sh
bash frame-android/test.sh  # Android setups
```

The Mac build installs locked npm dependencies in dependency order and embeds Node, server, web preview and the optional APK. If no Android APK exists, the Mac/web system can still build. Read failed checks and fix their cause before continuing. Use the installed Node distribution's LICENSE; see the root README if packaging cannot find it.

Completion: required checks pass, the release app is signed successfully, and the fictional frame renders correctly. Use Chrome DevTools for browser screenshots/layout checks and inspect the packaged native UI. Android instrumentation is emulator-only and clears that test app's preferences; never run it on the person's frame.

## 3. Install the Mac app and configure content

Use `macos/dist/HomeControl Open Source.app`. For everyday use, copy the built bundle to a stable location such as `~/Applications/HomeControl Open Source.app` before opening it and adding it to Login Items. Quit the previous copy before replacing it. Keep the current folder and app data for rollback; do not overwrite another HomeControl app with a different bundle identifier.

The packaged app starts its own server. There is no separate server terminal or Node installation required to run the built bundle. Check Settings shows **Frame server running**. The normal port is 8797; do not start a second server on that port.

Walk the user through Photos and Calendar permissions using each page's empty-state button. Let the user grant OS access and choose what to share. Choose the shared album, inline calendars, calendar colours and optional names, then start sharing. Configure collection day and weather, and save those settings. Accent swatches and the native colour picker are under Settings → Frame appearance and apply to every display.

Photos/Calendar require an awake, logged-in Mac, the app running, permission grants and sharing enabled. Closing Settings keeps the app/server in the menu bar. Quitting is different: the checkbox can keep the server running, but library exports expire after ten minutes. A rebuilt ad-hoc signed Mac app may require permission again; check this after upgrading.

Completion: selected sources appear in Frame Preview, weather uses the chosen place/units, and the server stays running after closing Settings.

## 4. Install and pair the display

For Android, inspect `adb devices -l` and use the intended serial explicitly:

```sh
adb -s DEVICE_ID install -r frame-android/build/homecontrol-frame.apk
adb -s DEVICE_ID shell am start -n org.homecontrol.frame/.MainActivity
```

Use a release APK, never the instrumentation build. Preserve `frame-android/.local/development.keystore` or the selected `HOMEFRAME_KEYSTORE` privately: future APKs must use that signer. Do not commit or upload it. Resolve a signing mismatch without uninstalling/erasing the user's existing app by default.

Keep the frame on reliable wall power. Some older displays cannot sustain operation from a computer USB port even when their reported average draw looks modest. Use a data cable supported by that hardware for initial installation; USB is not required for normal operation or Wi-Fi updates. No browser is required on the Android frame.

On the pairing screen, select the discovered compatible Mac and enter its `1234-5678` code from Mac Settings. Use the manual address fallback only if discovery fails. Both devices must share a trusted network that permits local traffic. The server advertises `_homecontrol._tcp` with a compatible app marker; a different older HomeControl server may be on the network.

For a browser display, open the Mac address in a browser and enter a new code. Browsers do not perform native Bonjour discovery. The web frame is a separate optional client, also used for the Mac preview.

Completion: the actual display shows the selected content, calendar labels/colours and weather; its clock is unclipped, collection icons are beside the clock, and browsing fades the weather without changing calendar height. Today restores it. Confirm the native frame reports its current version in Mac Settings → Frame updates.

## 5. Set up everyday kiosk use

### Android: default Home app

HomeControl Frame already declares itself as an Android Home app. It uses landscape fullscreen, hides navigation bars while active and keeps the screen awake. For a dedicated household frame, choose **HomeControl Frame** as the default Home/launcher app in Android Settings → Apps → Default apps → Home (wording varies). On older Android versions, press Home and choose HomeControl Frame → Always when the chooser appears.

This makes Home return to the frame and allows Android's normal Home startup after boot/unlock. Do not promise unattended startup before a device's required unlock or on every vendor's firmware: verify the actual device. After the user's approval for the brief interruption, reboot it on wall power and confirm it returns to HomeControl with pairing intact. Verify Wi-Fi reconnects and live content returns.

This is a household kiosk configuration, not a locked-down device-owner deployment. System gestures and Settings remain available. Do not factory-reset, enroll a device owner, disable lock-screen security, or remove system launchers to achieve it. Those are separate management decisions. Android's [lock-task documentation](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode) explains the stronger managed-device option.

To change configuration, use Back or a two-finger hold for frame settings. To leave a default-Home setup, reveal Android's system controls/notification shade, open Android Settings and choose the original launcher as the Home app. **Exit frame** alone may return to HomeControl if it is the default Home app. Record the previous launcher and confirm the user can reach Settings before changing the default.

### Mac: launch at login and stay awake

With the user's agreement, add the stable installed app to **System Settings → General → Login Items & Extensions → Open at Login**. Do not add the server separately: the app owns startup. Verify after the next login that the menu-bar app starts and the frame reconnects. This is startup after user login, not a system daemon or a way around FileVault/login.

For continuous service on mains power, help the user enable **Prevent automatic sleeping on power adapter when the display is off**, where available. The Mac display can sleep while the computer stays awake. Record the setting changed and its previous value. Do not disable passwords or encryption. Consult Apple's [Login Items](https://support.apple.com/guide/mac-help/mh15189/mac) and [sleep settings](https://support.apple.com/guide/mac-help/mchle41a6ccd/mac) instructions for the installed OS.

To undo: remove the app from Open at Login, restore the previous sleep setting, change Android's Home app back, and quit HomeControl with **Keep the frame server running** unchecked. Retain data unless the user asks to erase it.

Completion: the selected automatic-start behavior is configured and verified on that hardware, or clearly recorded as awaiting the user's next login/reboot. Explain how to exit it.

## 6. Verify Wi-Fi updates and hand over

Follow [Android update instructions](../frame-android/README.md#updates-over-wi-fi). Increase the release version, build with the same private signer, bundle/publish it on the Mac, choose Send Update and confirm Install on Android. A USB reinstall does not prove the Wi-Fi updater works.

**Android 6 uses a global Unknown sources switch** under Security to permit these installations. Explain that it allows installing apps obtained outside the Play Store; get the user's choice before enabling it. Leaving it enabled permits future Wi-Fi updates. Turning it off afterward means the user must re-enable it for the next update. Newer Android versions may use a per-app **Install unknown apps** grant instead. Do not silently change either setting. The app checks the downloaded checksum, package, newer version and matching signer before launching Android's installer; installation still requires the device's confirmation.

Confirm the installed version advances, the frame returns to the display, pairing/settings survive, and Mac Settings reports that version as idle/up to date. Leave the device in the native frame app. Keep signing keys and private exports out of screenshots and source.

Hand over: installed app paths and versions; chosen startup behavior; tested restart/update results; outstanding user actions; where to edit content/colours; how to exit the kiosk and stop the server; where the private signing key is backed up. Do not include pairing credentials in the handover or repository.
