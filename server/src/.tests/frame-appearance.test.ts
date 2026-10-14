import { expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';
import { getConfig } from '../config.js';

it('shares saved Mac accents with clients and keeps the dashboard usable if the file is damaged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homecontrol-appearance-'));
  const token = 'isolated-appearance-token-for-testing-only';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797', authorization: `Bearer ${token}` };
  const read = async () =>
    (await app.inject({ url: '/api/dashboard', headers })).json();
  try {
    expect((await read()).accentColor).toBe('#E4FF73');
    await writeFile(
      join(directory, 'frame-appearance.json'),
      JSON.stringify({ accentColor: '#38BDF8' }),
    );
    expect((await read()).accentColor).toBe('#38BDF8');
    await writeFile(
      join(directory, 'frame-appearance.json'),
      JSON.stringify({ accentColor: 'url(example)' }),
    );
    expect((await read()).accentColor).toBe('#E4FF73');
    expect(
      (
        await app.inject({
          url: '/api/dashboard',
          headers: { host: headers.host },
        })
      ).statusCode,
    ).toBe(401);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
