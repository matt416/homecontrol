import { z } from 'zod';
import { addCalendarDays } from './calendar.js';

export const BIN_TYPES = ['recycling', 'trash', 'green', 'brown'] as const;
export type BinType = (typeof BIN_TYPES)[number];
const weekdaySchema = z.number().int().min(0).max(6);
export const reminderSettingsSchema = z.object({
  bins: z
    .object({
      enabled: z.boolean(),
      collectionDay: weekdaySchema,
      anchorDate: z.iso.date(),
      weeks: z
        .array(
          z
            .array(z.enum(BIN_TYPES))
            .max(4)
            .refine((bins) => new Set(bins).size === bins.length),
        )
        .min(1)
        .max(8),
    })
    .refine(
      (bins) =>
        new Date(`${bins.anchorDate}T12:00:00Z`).getUTCDay() ===
        bins.collectionDay,
      'The first collection date must match the collection day.',
    )
    .refine(
      (bins) => !bins.enabled || bins.weeks.some((week) => week.length > 0),
      'Choose at least one bin.',
    ),
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
export const reminderStateSchema = z.object({
  settings: reminderSettingsSchema,
});
export type ReminderState = z.infer<typeof reminderStateSchema>;

export function createDefaultReminderSettings(): ReminderSettings {
  return {
    bins: {
      enabled: false,
      collectionDay: 3,
      anchorDate: '2026-10-14',
      weeks: [[], []],
    },
  };
}
function getLocalDateTime(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}
export function getReminderDay(now: Date, timezone: string) {
  return getLocalDateTime(now, timezone).day;
}
export function getDueReminders(
  state: ReminderState,
  now: Date,
  timezone: string,
) {
  const { day } = getLocalDateTime(now, timezone);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const schedule = state.settings.bins;
  // Today's collection remains visible until local midnight, then the next
  // collection becomes the upcoming one for every day of the following week.
  const daysUntilCollection = (schedule.collectionDay - weekday + 7) % 7;
  const collectionDate = addCalendarDays(day, daysUntilCollection);
  let bins: BinType[] = [];
  if (schedule.enabled) {
    // Compare calendar dates at UTC midnight so DST never shifts the rotation.
    const weekOffset = Math.round(
      (Date.parse(collectionDate) - Date.parse(schedule.anchorDate)) /
        604_800_000,
    );
    const index =
      ((weekOffset % schedule.weeks.length) + schedule.weeks.length) %
      schedule.weeks.length;
    bins = schedule.weeks[index] ?? [];
  }
  let binTiming = new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${collectionDate}T12:00:00Z`));
  if (daysUntilCollection === 0) binTiming = 'Today';
  if (daysUntilCollection === 1) binTiming = 'Tomorrow';
  return {
    bins,
    binTiming,
    collectionDate,
  };
}
