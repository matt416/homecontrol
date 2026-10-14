import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createDefaultReminderSettings,
  reminderSettingsSchema,
} from '@homecontrol/contracts/reminders';

export function createRemindersAdapter(directory: string) {
  return {
    async get() {
      try {
        const text = await readFile(
          join(directory, 'reminder-settings.json'),
          'utf8',
        );
        if (text.length > 16_384) throw new Error('Oversized schedule');
        return { settings: reminderSettingsSchema.parse(JSON.parse(text)) };
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return { settings: createDefaultReminderSettings() };
        }
        throw error;
      }
    },
  };
}
