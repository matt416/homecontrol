import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPhotoSettingsAdapter } from '../photo-settings-adapter.js';
import { createServer } from '../server.js';
import { getConfig } from '../config.js';

const directory = await mkdtemp(join(tmpdir(), 'photo-settings-'));
afterEach(async () => {
  await rm(join(directory, 'photo-settings.json'), { force: true });
});
it('reads Mac changes immediately and preserves validated settings across restarts', async () => {
  const adapter = createPhotoSettingsAdapter(directory);
  expect((await adapter.get()).order).toBe('random');
  const settings = {
    durationSeconds: 42,
    transitionSeconds: 0,
    order: 'custom' as const,
  };
  await adapter.save(settings);
  expect(await createPhotoSettingsAdapter(directory).get()).toEqual(settings);
  expect(
    (await stat(join(directory, 'photo-settings.json'))).mode & 0o777,
  ).toBe(0o600);
  await writeFile(
    join(directory, 'photo-settings.json'),
    JSON.stringify({ ...settings, durationSeconds: 17 }),
  );
  expect((await adapter.get()).durationSeconds).toBe(17);
  await writeFile(join(directory, 'photo-settings.json'), '{broken');
  await expect(adapter.get()).rejects.toThrow();
});
it('authenticates writes and rejects invalid timing without changing saved settings', async () => {
  const token = 'a-long-private-token-only-for-this-fixture';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797', authorization: `Bearer ${token}` };
  const url = '/api/photo-settings';
  const settings = {
    durationSeconds: 2,
    transitionSeconds: 0.4,
    order: 'custom',
  };
  try {
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { host: headers.host },
          payload: settings,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({ method: 'POST', url, headers, payload: settings })
      ).json(),
    ).toEqual(settings);
    for (const payload of [
      { ...settings, durationSeconds: 0 },
      { ...settings, transitionSeconds: 2 },
      { ...settings, order: 'unknown' },
    ]) {
      expect(
        (await app.inject({ method: 'POST', url, headers, payload }))
          .statusCode,
      ).toBe(400);
    }
    expect(
      JSON.parse(
        await readFile(join(directory, 'photo-settings.json'), 'utf8'),
      ),
    ).toEqual(settings);
    expect((await app.inject({ url, headers })).json()).toEqual(settings);
  } finally {
    await app.close();
  }
});
