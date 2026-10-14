import { z } from 'zod';

export const photoSettingsSchema = z
  .object({
    durationSeconds: z.number().min(1).max(3600),
    transitionSeconds: z.number().min(0).max(5),
    order: z.enum(['random', 'custom']),
  })
  .strict()
  .refine((settings) => settings.transitionSeconds < settings.durationSeconds, {
    message: 'Transition time must be shorter than time per photo.',
  });

export type PhotoSettings = z.infer<typeof photoSettingsSchema>;
export const DEFAULT_PHOTO_SETTINGS: PhotoSettings = {
  durationSeconds: 15,
  transitionSeconds: 0.22,
  order: 'random',
};
