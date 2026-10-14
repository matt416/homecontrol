import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from '../server.js';
import { getConfig } from '../config.js';

it('requires pairing, targets one online frame and serves the published APK', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'frame-update-'));
  const token = 'test-internal-token-at-least-32-characters';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
  );
  const headers = { host: '127.0.0.1:8797', authorization: `Bearer ${token}` };
  const deviceId = randomUUID();
  const device = {
    deviceId,
    versionCode: 1,
    versionName: '0.1.0',
    status: 'idle',
  };
  const apk = Buffer.from(
    'APK fixture; package/signature checks belong to Android',
  );
  const release = {
    versionCode: 2,
    versionName: '0.2.0',
    sha256: createHash('sha256').update(apk).digest('hex'),
    size: apk.length,
  };
  try {
    await mkdir(join(directory, 'native-update'));
    await writeFile(
      join(directory, 'native-update', `${release.sha256}.apk`),
      apk,
    );
    await writeFile(
      join(directory, 'native-update', 'release.json'),
      JSON.stringify(release),
    );
    for (const url of ['/api/frame-update', '/api/frame-update/apk']) {
      expect(
        (await app.inject({ url, headers: { host: headers.host } })).statusCode,
      ).toBe(401);
    }
    const request = () =>
      app.inject({
        method: 'POST',
        url: '/api/frame-update/request',
        headers,
        payload: { deviceId, versionCode: 2 },
      });
    expect((await request()).statusCode).toBe(409);
    const check = (payload = device) =>
      app.inject({
        method: 'POST',
        url: '/api/frame-update/check',
        headers,
        payload,
      });
    expect((await check()).json()).toEqual({ release, request: null });
    expect((await request()).statusCode).toBe(200);
    expect((await check()).json().request.deviceId).toBe(deviceId);
    expect(
      (await check({ ...device, deviceId: randomUUID() })).json().request,
    ).toBeNull();
    expect(
      (await check({ ...device, versionCode: 2 })).json().request,
    ).toBeNull();
    expect((await request()).statusCode).toBe(409);
    expect(
      (await app.inject({ url: '/api/frame-update/apk', headers })).rawPayload,
    ).toEqual(apk);
    const publicHeaders = { host: headers.host };
    expect(
      (
        await app.inject({
          url: '/install/homecontrol-frame.apk',
          headers: publicHeaders,
        })
      ).rawPayload,
    ).toEqual(apk);
    expect(
      (await app.inject({ url: '/install', headers: publicHeaders })).body,
    ).toContain('0.2.0');
    await writeFile(
      join(directory, 'native-update', `${release.sha256}.apk`),
      'truncated',
    );
    expect(
      (await app.inject({ url: '/api/frame-update/apk', headers })).statusCode,
    ).toBe(404);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
