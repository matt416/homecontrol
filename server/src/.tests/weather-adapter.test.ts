import { expect, it, vi } from 'vitest';
import { createDefaultWeatherSettings } from '@homecontrol/contracts/weather-settings';
import { createWeatherAdapter } from '../weather-adapter.js';

it('coalesces and caches weather calls, marks temporary failure stale, and expires old observations', async () => {
  let now = Date.parse('2026-10-12T16:00:00Z');
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        current: {
          temperature_2m: 14.5,
          weather_code: 2,
          is_day: 1,
          time: now / 1000,
        },
      }),
    ),
  );
  const weather = createWeatherAdapter(
    createDefaultWeatherSettings('America/Toronto'),
    transport,
    () => now,
  );
  const [first, concurrent] = await Promise.all([
    weather.getWeather(),
    weather.getWeather(),
  ]);
  expect(first).toEqual(concurrent);
  expect(first.temperature).toBe(14.5);
  await weather.getWeather();
  expect(transport).toHaveBeenCalledTimes(1);
  expect(String(transport.mock.calls[0]?.[0])).toContain(
    'temperature_unit=celsius',
  );
  transport.mockRejectedValue(new Error('offline'));
  now += 16 * 60 * 1000;
  expect((await weather.getWeather()).state).toBe('stale');
  now += 60 * 60 * 1000;
  expect(await weather.getWeather()).toMatchObject({
    state: 'unavailable',
    temperature: null,
  });
});
it('rejects malformed weather instead of inventing a temperature', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('{"current":{"temperature_2m":"warm"}}'));
  const weather = createWeatherAdapter(
    createDefaultWeatherSettings('America/Toronto'),
    transport,
  );
  expect((await weather.getWeather()).temperature).toBeNull();
});

it('maps the next five local days and skips missing forecast values', async () => {
  const now = Date.parse('2026-10-12T16:00:00Z');
  const start = Date.parse('2026-10-12T04:00:00Z') / 1000;
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        utc_offset_seconds: -14400,
        current: {
          temperature_2m: 16,
          weather_code: 3,
          is_day: 1,
          time: now / 1000,
        },
        daily: {
          time: Array.from({ length: 6 }, (_, i) => start + i * 86400),
          weather_code: [3, 0, 2, 61, 3, 0],
          temperature_2m_max: [16, 18, null, 12, 15, 17],
          temperature_2m_min: [8, 9, 7, 6, 5, 8],
        },
      }),
    ),
  );
  const adapter = createWeatherAdapter(
    createDefaultWeatherSettings('America/Toronto'),
    transport,
    () => now,
  );
  const result = await adapter.getWeather();
  expect(result.forecast.map((day) => day.date)).toEqual([
    '2026-10-13',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
  ]);
  expect(result.forecast[0]).toEqual({
    date: '2026-10-13',
    weatherCode: 0,
    high: 18,
    low: 9,
  });
  const url = new URL(String(transport.mock.calls[0]?.[0]));
  expect(url.searchParams.get('timezone')).toBe('America/Toronto');
  expect(url.searchParams.get('forecast_days')).toBe('6');
});
