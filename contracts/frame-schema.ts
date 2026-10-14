import { z } from 'zod';

export const photoIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
export const subjectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (value) =>
      value.x + value.width <= 1.00001 && value.y + value.height <= 1.00001,
    'Subject bounds must fit the image',
  );
export type Subject = z.infer<typeof subjectSchema>;
export const photoSchema = z.object({
  id: photoIdSchema,
  caption: z.string().max(300),
  album: z.string().max(200),
  subject: subjectSchema.nullable().optional(),
});
export const eventSchema = z
  .object({
    id: z.string().min(1).max(500),
    title: z.string().max(500),
    calendar: z.string().max(200),
    calendarColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    calendarDisplayName: z.string().trim().max(80).optional(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    allDay: z.boolean(),
    startDay: z.iso.date(),
    endDay: z.iso.date(),
  })
  .refine(
    (event) => Date.parse(event.end) > Date.parse(event.start),
    'Event end must follow start',
  );
export const exportStatusSchema = z.object({
  state: z.enum(['ready', 'denied', 'error']),
  message: z.string().max(1000),
});
export const snapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  calendarStatus: exportStatusSchema,
  calendarRevision: z.string().optional(),
  photoStatus: exportStatusSchema,
  events: z.array(eventSchema).max(2000),
  photos: z.array(photoSchema),
});
export const sourceSchema = z.object({
  state: z.enum(['ready', 'unavailable', 'stale', 'denied', 'error']),
  message: z.string(),
});
export const dashboardSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  name: z.string(),
  idleSeconds: z.number().int().min(0),
  timezone: z.string(),
  generatedAt: z.string().nullable(),
  calendarStatus: sourceSchema,
  calendarRevision: z.string().optional(),
  photoStatus: sourceSchema,
  events: z.array(eventSchema),
  photos: z.array(photoSchema),
});
export type FrameEvent = z.infer<typeof eventSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export const weatherSchema = z.object({
  state: z.enum(['ready', 'stale', 'unavailable', 'disabled']),
  unit: z.enum(['celsius', 'fahrenheit']),
  timezone: z.string(),
  label: z.string(),
  temperature: z.number().nullable(),
  weatherCode: z.number().nullable(),
  isDay: z.boolean(),
  observedAt: z.string().nullable(),
  forecast: z
    .array(
      z.object({
        date: z.iso.date(),
        weatherCode: z.number().int(),
        high: z.number(),
        low: z.number(),
      }),
    )
    .max(5)
    .default([]),
});
export type Weather = z.infer<typeof weatherSchema>;

export const calendarMonthKeySchema = z
  .string()
  .regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
export const calendarMonthSchema = z.object({
  month: calendarMonthKeySchema,
  generatedAt: z.iso.datetime({ offset: true }).nullable(),
  revision: z.string().optional(),
  status: z.object({
    state: z.enum([
      'ready',
      'loading',
      'denied',
      'error',
      'stale',
      'unavailable',
    ]),
    message: z.string(),
  }),
  events: z.array(eventSchema).max(10000),
});
export type CalendarMonth = z.infer<typeof calendarMonthSchema>;
