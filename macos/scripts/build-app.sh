#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build the shared server and browser package before embedding them in the app.
(cd ../contracts && npm ci --no-audit --no-fund && npm run build)
(cd ../server && npm ci --no-audit --no-fund && npm run build)
(cd ../frame-web && npm ci --no-audit --no-fund && npm run build)
python3 ../scripts/audit-licenses.py
export CLANG_MODULE_CACHE_PATH="$PWD/.cache/clang"
export SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.cache/swift"
configuration="${CONFIGURATION:-release}"
swift build --disable-sandbox --cache-path .cache -c "$configuration"
bin="$(swift build --disable-sandbox --cache-path .cache -c "$configuration" --show-bin-path)"
bash scripts/build-icons.sh
app="$PWD/dist/HomeControl Open Source.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$bin/HomeControl" "$app/Contents/MacOS/HomeControl"
cp .build/HomeControl.icns "$app/Contents/Resources/HomeControl.icns"
cp ../LICENSE ../THIRD-PARTY-NOTICES.txt "$app/Contents/Resources/"
/usr/bin/ditto "$bin/HomeControl_HomeControl.bundle" "$app/Contents/Resources/HomeControl_HomeControl.bundle"
# SwiftPM can retain removed resource files across incremental builds.
rm -rf "$app/Contents/Resources/HomeControl_HomeControl.bundle/Icons"
/usr/bin/ditto Sources/HomeControl/Resources/Icons "$app/Contents/Resources/HomeControl_HomeControl.bundle/Icons"
python3 - "$app" <<'PY'
import plistlib,sys
from pathlib import Path
info={'CFBundleName':'HomeControl Open Source','CFBundleDisplayName':'HomeControl Open Source','CFBundleIdentifier':'org.homecontrol.opensource.spike','CFBundleExecutable':'HomeControl','CFBundleIconFile':'HomeControl.icns','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.1.0','CFBundleVersion':'1','LSMinimumSystemVersion':'14.0','LSUIElement':True,'NSHighResolutionCapable':True,'NSCalendarsUsageDescription':'Read calendars you choose for your frame. Events are never modified.','NSCalendarsFullAccessUsageDescription':'Read calendars you choose for your frame. Events are never modified.','NSPhotoLibraryUsageDescription':'Read the shared album you choose for your frame. Photos are never modified.','NSLocalNetworkUsageDescription':'Connect to your local frame server.','NSAppTransportSecurity':{'NSAllowsLocalNetworking':True,'NSAllowsArbitraryLoadsInWebContent':True}}
Path(sys.argv[1], 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
PY
bash ../scripts/package-server.sh
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"
echo "Built $app"
