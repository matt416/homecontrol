#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
for ARCH in arm64 x86_64; do
  xcrun swiftc main.swift -O -sdk "$SDK_PATH" -target "$ARCH-apple-macosx13.0" -module-cache-path /private/tmp/homeframe-vision-modules -o "build/subject-analyzer-$ARCH"
done
lipo -create build/subject-analyzer-arm64 build/subject-analyzer-x86_64 -output build/homeframe-subject-analyzer
codesign --force --sign - build/homeframe-subject-analyzer
