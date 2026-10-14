#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
(cd contracts && npm ci --no-audit --no-fund && npm run build)
(cd frame-web && npm ci --no-audit --no-fund && npm run build)
cd server
npm ci --no-audit --no-fund
npm run demo
