import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config.js';

// The companion reads this through its existing user-approved folder bookmark.
// This file is never exposed by the HTTP API or included in the photo manifest.
export async function publishPairing(
  config: Pick<Config, 'exportDir' | 'token' | 'publicOrigin'>,
  pairing?: { code: string; expiresAt: string },
) {
  await mkdir(config.exportDir, { recursive: true, mode: 0o700 });
  const temporary = join(config.exportDir, `.pairing-${randomUUID()}.tmp`);
  try {
    await writeFile(
      temporary,
      JSON.stringify({
        token: config.token,
        address: config.publicOrigin,
        ...pairing,
      }),
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temporary, join(config.exportDir, '.homeframe-pairing.json'));
  } finally {
    await rm(temporary, { force: true });
  }
}
