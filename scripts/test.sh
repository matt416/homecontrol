#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
(cd macos && bash scripts/test.sh)
(cd contracts && npm run check)
(cd server && npm run check)
(cd frame-web && npm run check)
python3 scripts/audit-licenses.py
