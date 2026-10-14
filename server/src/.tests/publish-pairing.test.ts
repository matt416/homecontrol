import { expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishPairing } from '../publish-pairing.js';

it('publishes current pairing details privately and replaces them when credentials change', async () => {
  const exportDir = await mkdtemp(join(tmpdir(), 'frame-pairing-'));
  try {
    const config = {
      exportDir,
      token: 'first-test-token',
      publicOrigin: 'http://127.0.0.1:8797',
    };
    await publishPairing(config);
    await publishPairing({ ...config, token: 'replacement-test-token' });
    const file = join(exportDir, '.homeframe-pairing.json');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      token: 'replacement-test-token',
      address: config.publicOrigin,
    });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(exportDir)).toEqual(['.homeframe-pairing.json']);
  } finally {
    await rm(exportDir, { recursive: true, force: true });
  }
});
