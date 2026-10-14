import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createDefaultWeatherSettings,
  weatherSettingsSchema,
} from '@homecontrol/contracts/weather-settings';

export function createWeatherSettingsAdapter(
  directory: string,
  timezone: string,
) {
  return {
    async get() {
      try {
        const text = await readFile(
          join(directory, 'weather-settings.json'),
          'utf8',
        );
        if (text.length > 4096) throw new Error('Oversized weather settings');
        return weatherSettingsSchema.parse(JSON.parse(text));
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return createDefaultWeatherSettings(timezone);
        throw error;
      }
    },
  };
}
