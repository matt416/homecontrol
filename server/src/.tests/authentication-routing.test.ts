import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';
import { getConfig } from '../config.js';

it('requires a credential for protected routes with percent-encoded prefixes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homecontrol-auth-routing-'));
  const token = 'synthetic-routing-test-token-at-least-32-characters';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797' };
  try {
    for (const prefix of ['/api', '/%61pi', '/a%70i', '/ap%69']) {
      for (const endpoint of [
        '/dashboard',
        '/photos/example-photo',
        '/calendar/2026-10',
        '/weather',
        '/reminders',
        '/photo-settings',
        '/frame-update',
        '/frame-update/apk',
      ]) {
        const response = await app.inject({
          url: prefix + endpoint,
          headers,
        });
        expect(response.statusCode, prefix + endpoint).toBe(401);
      }
      for (const endpoint of [
        '/pairing-code',
        '/photo-settings',
        '/frame-update/check',
        '/frame-update/request',
      ]) {
        const response = await app.inject({
          method: 'POST',
          url: prefix + endpoint,
          headers,
          payload: {},
        });
        expect(response.statusCode, prefix + endpoint).toBe(401);
      }
    }
    expect(
      (
        await app.inject({
          url: '/%61pi/dashboard',
          headers: { ...headers, authorization: 'Bearer wrong-credential' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          url: '/%61pi/dashboard',
          headers: { ...headers, authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(200);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('allows an encoded pairing route only with a valid one-use code', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homecontrol-encoded-pair-'));
  const token = 'synthetic-routing-test-token-at-least-32-characters';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797' };
  try {
    await app.ready();
    const details = JSON.parse(
      await readFile(join(directory, '.homeframe-pairing.json'), 'utf8'),
    );
    const exchange = () =>
      app.inject({
        method: 'POST',
        url: '/%61pi/pair',
        headers,
        payload: { code: details.code },
      });
    expect((await exchange()).json()).toEqual({ token });
    expect((await exchange()).statusCode).toBe(401);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
