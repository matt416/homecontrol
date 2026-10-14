#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
app="$PWD/macos/dist/HomeControl Open Source.app"
resources="$app/Contents/Resources"
node_bin="$(command -v node)"
node_license="${HOMECONTROL_NODE_LICENSE:-$(dirname "$(dirname "$node_bin")")/LICENSE}"
if [ ! -f "$node_license" ]; then
  echo 'Set HOMECONTROL_NODE_LICENSE to the LICENSE file shipped with your Node.js distribution.' >&2
  exit 1
fi
mkdir -p "$resources/Runtime" "$resources/Server/server/scripts" "$resources/Server/contracts" "$resources/Server/frame-web"
cp "$node_bin" "$resources/Runtime/node"
cp "$node_license" "$resources/Runtime/LICENSE-Node.txt"
node --version > "$resources/Runtime/VERSION.txt"
cp server/package.json server/package-lock.json "$resources/Server/server/"
cp server/scripts/managed.mjs "$resources/Server/server/scripts/"
cp contracts/package.json contracts/package-lock.json "$resources/Server/contracts/"
/usr/bin/ditto contracts/dist "$resources/Server/contracts/dist"
/usr/bin/ditto server/dist "$resources/Server/server/dist"
/usr/bin/ditto frame-web/dist "$resources/Server/frame-web/dist"
(cd "$resources/Server/contracts" && npm ci --omit=dev --no-audit --no-fund)
(cd "$resources/Server/server" && npm ci --omit=dev --no-audit --no-fund)
codesign --force --sign - "$resources/Runtime/node"

# Bundle an optional Android release so the Mac can offer it over Wi-Fi.
if [ -f frame-android/build/homecontrol-frame.apk ]; then
  : "${ANDROID_HOME:?Set ANDROID_HOME to verify the Android APK before packaging it}"
  node server/scripts/publish-native-update.mjs frame-android/build/homecontrol-frame.apk "$resources/Server"
fi
