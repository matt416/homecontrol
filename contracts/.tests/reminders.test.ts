import { expect, it } from 'vitest';
import { getDueReminders, reminderSettingsSchema } from '../reminders.js';
it('keeps collection visible on collection day and advances the rotation at local midnight', () => {
  const settings = reminderSettingsSchema.parse({
    bins: {
      enabled: true,
      collectionDay: 3,
      anchorDate: '2026-10-14',
      weeks: [['trash'], ['recycling']],
    },
  });
  const state = { settings };
  expect(
    getDueReminders(state, new Date('2026-10-15T03:59:00Z'), 'America/Toronto')
      .bins,
  ).toEqual(['trash']);
  expect(
    getDueReminders(state, new Date('2026-10-15T04:00:00Z'), 'America/Toronto')
      .bins,
  ).toEqual(['recycling']);
  expect(
    getDueReminders(state, new Date('2026-10-15T04:00:00Z'), 'America/Toronto')
      .collectionDate,
  ).toBe('2026-10-21');
});
it('does not serialize plant settings from a legacy schedule', () => {
  const settings = reminderSettingsSchema.parse({
    bins: {
      enabled: false,
      collectionDay: 3,
      anchorDate: '2026-10-14',
      weeks: [[]],
    },
    plants: { enabled: true, days: [3], startHour: 6 },
  });
  expect(settings).not.toHaveProperty('plants');
});
