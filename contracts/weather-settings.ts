import { z } from 'zod';

export const weatherSettingsSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string().max(80),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
    temperatureUnit: z.enum(['celsius', 'fahrenheit']),
  })
  .refine((value) => !value.enabled || value.label.trim().length > 0);
export type WeatherSettings = z.infer<typeof weatherSettingsSchema>;
export function createDefaultWeatherSettings(
  timezone: string,
): WeatherSettings {
  return {
    enabled: false,
    label: '',
    latitude: 0,
    longitude: 0,
    timezone,
    temperatureUnit: 'celsius',
  };
}
