import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';
import { getConfig } from '../config.js';

it('exchanges a one-use code, keeps the token internal, and requires authentication to renew', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homecontrol-pairing-'));
  const token = 'test-internal-token-at-least-32-characters';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797' };
  try {
    await app.ready();
    const details = JSON.parse(
      await readFile(join(directory, '.homeframe-pairing.json'), 'utf8'),
    );
    expect(details.code).toMatch(/^[0-9]{8}$/);
    const exchange = () =>
      app.inject({
        method: 'POST',
        url: '/api/pair',
        headers,
        payload: { code: details.code },
      });
    expect((await exchange()).json()).toEqual({ token });
    expect((await exchange()).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/api/pairing-code', headers }))
        .statusCode,
    ).toBe(401);
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/pairing-code',
      headers: { ...headers, authorization: `Bearer ${token}` },
    });
    expect(fresh.json().code).toMatch(/^[0-9]{8}$/);
    expect(fresh.json()).not.toHaveProperty('token');
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/pair',
          headers,
          payload: { code: 'invalid' },
        }),
      ),
    );
    expect(attempts.some((response) => response.statusCode === 429)).toBe(true);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
