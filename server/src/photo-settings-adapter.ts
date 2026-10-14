import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_PHOTO_SETTINGS,
  photoSettingsSchema,
  type PhotoSettings,
} from '@homecontrol/contracts/photo-settings';

// Shared with the Mac app. Read on each request so an atomic Mac save is visible
// immediately, without keeping a second settings authority in the server.
export function createPhotoSettingsAdapter(directory: string) {
  const file = join(directory, 'photo-settings.json');
  return {
    async get(): Promise<PhotoSettings> {
      let bytes: Buffer;
      try {
        bytes = await readFile(file);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return { ...DEFAULT_PHOTO_SETTINGS };
        }
        throw error;
      }
      if (bytes.length > 4096)
        throw new Error('Photo settings file is too large.');
      return photoSettingsSchema.parse(JSON.parse(bytes.toString('utf8')));
    },
    async save(value: PhotoSettings): Promise<PhotoSettings> {
      const settings = photoSettingsSchema.parse(value);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(settings), {
          mode: 0o600,
          flag: 'wx',
        });
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
      return settings;
    },
  };
}
