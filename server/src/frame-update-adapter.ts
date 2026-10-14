import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  frameReleaseSchema,
  type FrameCheck,
} from '@homecontrol/contracts/frame-update';

const requestSchema = z.object({
  id: z.uuid(),
  deviceId: z.uuid(),
  versionCode: z.number().int().positive(),
  expiresAt: z.number(),
});
type Device = FrameCheck & { lastSeen: string };
const ONLINE_MILLIS = 90_000;

export function createFrameUpdateAdapter(exportDir: string) {
  const directory = join(exportDir, 'native-update');
  const devices = new Map<string, Device>();
  const apkPath = (sha256: string) => join(directory, `${sha256}.apk`);
  async function release() {
    try {
      const value = frameReleaseSchema.parse(
        JSON.parse(await readFile(join(directory, 'release.json'), 'utf8')),
      );
      const file = await stat(apkPath(value.sha256));
      if (!file.isFile() || file.size !== value.size) return null;
      return value;
    } catch {
      return null;
    }
  }
  async function pending(device: FrameCheck) {
    try {
      const value = requestSchema.parse(
        JSON.parse(await readFile(join(directory, 'request.json'), 'utf8')),
      );
      if (
        value.expiresAt > Date.now() &&
        value.deviceId === device.deviceId &&
        value.versionCode > device.versionCode
      )
        return value;
    } catch {
      /* Missing or expired requests never trigger an installation. */
    }
    return null;
  }
  async function status() {
    return { release: await release(), devices: [...devices.values()] };
  }
  return {
    status,
    async check(device: FrameCheck) {
      // Bound memory even if a paired client reports new device identities repeatedly.
      if (!devices.has(device.deviceId) && devices.size >= 16)
        devices.delete(devices.keys().next().value!);
      devices.set(device.deviceId, {
        ...device,
        lastSeen: new Date().toISOString(),
      });
      const current = await release();
      const request = await pending(device);
      return {
        release: current,
        request: request?.versionCode === current?.versionCode ? request : null,
      };
    },
    async request(deviceId: string, versionCode: number) {
      const current = await release();
      const device = devices.get(deviceId);
      if (
        !current ||
        current.versionCode !== versionCode ||
        !device ||
        device.versionCode >= versionCode ||
        Date.now() - Date.parse(device.lastSeen) > ONLINE_MILLIS
      )
        return null;
      const request = {
        id: randomUUID(),
        deviceId,
        versionCode,
        expiresAt: Date.now() + 15 * 60_000,
      };
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = join(directory, `request-${request.id}.tmp`);
      await writeFile(temporary, JSON.stringify(request), {
        mode: 0o600,
        flag: 'wx',
      });
      await rename(temporary, join(directory, 'request.json'));
      return request;
    },
    async apk() {
      const current = await release();
      return current
        ? { path: apkPath(current.sha256), size: current.size }
        : null;
    },
  };
}
