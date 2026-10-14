import { z } from 'zod';
import type { Weather } from '@homecontrol/contracts/frame-schema';
import type { WeatherSettings } from '@homecontrol/contracts/weather-settings';

const responseSchema = z.object({
  utc_offset_seconds: z.number().default(0),
  daily: z
    .object({
      time: z.array(z.number()),
      weather_code: z.array(z.number().int().nullable()),
      temperature_2m_max: z.array(z.number().nullable()),
      temperature_2m_min: z.array(z.number().nullable()),
    })
    .optional(),
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number().int(),
    is_day: z.union([z.literal(0), z.literal(1)]),
    time: z.number(),
  }),
});

export function createWeatherAdapter(
  settings: WeatherSettings,
  fetchWeather: typeof fetch = fetch,
  now = () => Date.now(),
) {
  let cache: Weather | null = null;
  let nextRefresh = 0;
  let pending: Promise<Weather> | null = null;
  async function refresh(): Promise<Weather> {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: String(settings.latitude),
        longitude: String(settings.longitude),
        current: 'temperature_2m,weather_code,is_day',
        temperature_unit: settings.temperatureUnit,
        timeformat: 'unixtime',
        timezone: settings.timezone,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min',
        forecast_days: '6',
      }).toString();
      const response = await fetchWeather(url, {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error('Weather unavailable');
      const {
        current,
        daily,
        utc_offset_seconds: offset,
      } = responseSchema.parse(await response.json());
      const age = now() - current.time * 1000;
      if (age > 60 * 60 * 1000 || age < -60 * 1000)
        throw new Error('Outdated weather');
      cache = {
        state: 'ready',
        unit: settings.temperatureUnit,
        timezone: settings.timezone,
        forecast: (daily?.time ?? []).slice(1, 6).flatMap((time, index) => {
          const weatherCode = daily?.weather_code[index + 1];
          const high = daily?.temperature_2m_max[index + 1];
          const low = daily?.temperature_2m_min[index + 1];
          if (weatherCode == null || high == null || low == null) return [];
          return [
            {
              date: new Date((time + offset) * 1000).toISOString().slice(0, 10),
              weatherCode,
              high,
              low,
            },
          ];
        }),
        label: settings.label,
        temperature: current.temperature_2m,
        weatherCode: current.weather_code,
        isDay: current.is_day === 1,
        observedAt: new Date(current.time * 1000).toISOString(),
      };
      nextRefresh = now() + 15 * 60 * 1000;
    } catch {
      nextRefresh = now() + 60 * 1000;
      if (
        cache?.observedAt &&
        now() - Date.parse(cache.observedAt) < 60 * 60 * 1000
      ) {
        cache = { ...cache, state: 'stale' };
      } else {
        cache = {
          state: 'unavailable',
          unit: settings.temperatureUnit,
          timezone: settings.timezone,
          forecast: [],
          label: settings.label,
          temperature: null,
          weatherCode: null,
          observedAt: null,
          isDay: true,
        };
      }
    }
    return cache;
  }
  return {
    getWeather(): Promise<Weather> {
      if (pending) return pending;
      if (cache && now() < nextRefresh) return Promise.resolve(cache);
      pending = refresh().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
