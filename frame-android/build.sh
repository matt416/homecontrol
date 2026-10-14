#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
HOMEFRAME_KEYSTORE="${HOMEFRAME_KEYSTORE:-$PWD/.local/development.keystore}"
mkdir -p "$(dirname "$HOMEFRAME_KEYSTORE")"
BT="$ANDROID_HOME/build-tools/35.0.0"
JAR="$ANDROID_HOME/platforms/android-35/android.jar"
HOMEFRAME_VERSION_CODE="${HOMEFRAME_VERSION_CODE:-$(python3 -c 'import json; print(json.load(open("version.json"))["versionCode"])')}"
HOMEFRAME_VERSION_NAME="${HOMEFRAME_VERSION_NAME:-$(python3 -c 'import json; print(json.load(open("version.json"))["versionName"])')}"
mkdir -p build/classes build/generated
# Clear previous classes before changing between test and release builds.
find build/classes -name '*.class' -delete
"$BT/aapt2" compile --dir res -o build/resources.zip
manifest=AndroidManifest.xml
if [ "${HOMEFRAME_TEST_BUILD:-0}" = 1 ]; then
  python3 - <<'PY'
from pathlib import Path
source=Path('AndroidManifest.xml').read_text().replace('android:debuggable="false"','android:debuggable="true"')
source=source.replace('</manifest>','<instrumentation android:name="org.homecontrol.frame.FrameSmokeTests" android:targetPackage="org.homecontrol.frame" /></manifest>')
Path('build/AndroidManifest.xml').write_text(source)
PY
  manifest=build/AndroidManifest.xml
fi
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest "$manifest" \
  -A assets --java build/generated --min-sdk-version 23 --target-sdk-version 35 --version-code "${HOMEFRAME_VERSION_CODE}" --version-name "${HOMEFRAME_VERSION_NAME}" build/resources.zip
sources=(src/org/homecontrol/frame/*.java build/generated/org/homecontrol/frame/R.java)
if [ "${HOMEFRAME_TEST_BUILD:-0}" = 1 ]; then sources+=(tests/FrameSmokeTests.java); fi
javac -source 8 -target 8 -classpath "$JAR" -d build/classes "${sources[@]}"
classes=()
while IFS= read -r file; do classes+=("$file"); done < <(find build/classes -name '*.class')
"$BT/d8" --min-api 23 --lib "$JAR" --output build "${classes[@]}"
(cd build && zip -qj base.apk classes.dex)
"$BT/zipalign" -f 4 build/base.apk build/aligned.apk
if [ ! -f "$HOMEFRAME_KEYSTORE" ]; then
  keytool -genkeypair -keystore "$HOMEFRAME_KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Homeframe Development,O=Homeframe,C=CA" >/dev/null 2>&1
  chmod 600 "$HOMEFRAME_KEYSTORE"
fi
"$BT/apksigner" sign --ks "$HOMEFRAME_KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out build/homecontrol-frame.apk build/aligned.apk
"$BT/apksigner" verify build/homecontrol-frame.apk
