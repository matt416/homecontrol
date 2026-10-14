# Shared contracts

A small independent TypeScript package for the server/frame payload schemas, collection schedules and date helpers. It uses Zod and has its own lockfile. It is a local dependency of `server` and `frame`; there is no root npm workspace and nothing is published to npm.

From this directory:

```sh
npm ci
npm run build
npm run check
```

Build output and declarations go to `dist/`. The sibling projects import `@homecontrol/contracts/...` through `file:../contracts`, so keep this directory beside them. Rebuild after changes and rerun the dependent projects' checks. `test-support/` contains fictional fixtures for their tests.

Source is MIT. Zod and development dependencies retain their own licences; see the root [notices](../THIRD-PARTY-NOTICES.txt). This package is part of the experimental, AI-assisted project described in the [root README](../README.md).
