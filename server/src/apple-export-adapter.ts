import { readFile, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import {
  photoIdSchema,
  snapshotSchema,
  type Dashboard,
} from '@homecontrol/contracts/frame-schema';
import { normalizeAllDayEvent } from '@homecontrol/contracts/calendar';
import type { Config } from './config.js';

const MAX_EXPORT_AGE_MS = 10 * 60 * 1000;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export function createAppleExportAdapter(
  config: Config,
  now = () => Date.now(),
) {
  async function getDashboard(timezone = config.timezone): Promise<Dashboard> {
    const empty: Dashboard = {
      name: config.name,
      timezone,
      generatedAt: null,
      idleSeconds: config.idleSeconds,
      calendarStatus: {
        state: 'unavailable',
        message: 'Open HomeControl on your Mac and export a calendar.',
      },
      photoStatus: {
        state: 'unavailable',
        message: 'Choose a shared album in HomeControl on your Mac.',
      },
      events: [],
      photos: [],
    };
    try {
      const file = join(config.exportDir, 'snapshot.json');
      if ((await stat(file)).size > MAX_SNAPSHOT_BYTES)
        throw new Error('Oversized export');
      const snapshot = snapshotSchema.parse(
        JSON.parse(await readFile(file, 'utf8')),
      );
      const age = now() - Date.parse(snapshot.generatedAt);
      if (age > MAX_EXPORT_AGE_MS || age < -60_000) {
        const status = {
          state: 'stale' as const,
          message:
            'The Mac export is out of date. Open the companion and refresh.',
        };
        return {
          ...empty,
          generatedAt: snapshot.generatedAt,
          calendarStatus: status,
          photoStatus: status,
        };
      }
      return {
        ...empty,
        generatedAt: snapshot.generatedAt,
        calendarStatus: snapshot.calendarStatus,
        calendarRevision: snapshot.calendarRevision,
        photoStatus: snapshot.photoStatus,
        events:
          snapshot.calendarStatus.state === 'ready'
            ? snapshot.events.map((event) =>
                normalizeAllDayEvent(event, timezone),
              )
            : [],
        photos: snapshot.photoStatus.state === 'ready' ? snapshot.photos : [],
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return empty;
      const status = {
        state: 'error' as const,
        message:
          'Could not read the Mac export. Check the companion and export folder.',
      };
      return { ...empty, calendarStatus: status, photoStatus: status };
    }
  }

  async function getPhoto(id: string): Promise<Buffer | null> {
    if (!photoIdSchema.safeParse(id).success) return null;
    const dashboard = await getDashboard();
    if (!dashboard.photos.some((photo) => photo.id === id)) return null;
    try {
      const directory = await realpath(join(config.exportDir, 'media'));
      const file = await realpath(join(directory, `${id}.jpg`));
      if (!file.startsWith(`${directory}${sep}`)) return null;
      const info = await stat(file);
      if (!info.isFile() || info.size > MAX_PHOTO_BYTES) return null;
      return await readFile(file);
    } catch {
      return null;
    }
  }
  return { getDashboard, getPhoto };
}
