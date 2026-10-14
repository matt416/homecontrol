#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/build-app.sh
open "macos/dist/HomeControl Open Source.app"
