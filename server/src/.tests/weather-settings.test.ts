import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getConfig } from '../config.js';
import { createServer } from '../server.js';
import { weatherSettingsSchema } from '@homecontrol/contracts/weather-settings';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
it('reloads saved location and units, invalidates cached weather, and keeps household routes absent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homecontrol-weather-'));
  directories.push(directory);
  const settings = {
    enabled: true,
    label: 'London',
    latitude: 51.5,
    longitude: -0.12,
    timezone: 'Europe/London',
    temperatureUnit: 'celsius',
  };
  const save = (value: unknown) =>
    writeFile(join(directory, 'weather-settings.json'), JSON.stringify(value));
  const transport = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          current: {
            temperature_2m: 18,
            weather_code: 2,
            is_day: 1,
            time: Math.floor(Date.now() / 1000),
          },
        }),
      ),
  );
  const token = 'isolated-weather-settings-test-token';
  const app = await createServer(
    getConfig({ FRAME_TOKEN: token, APPLE_EXPORT_DIR: directory }),
    { fetchWeather: transport },
  );
  const headers = { host: '127.0.0.1:8797', authorization: `Bearer ${token}` };
  const weather = () => app.inject({ url: '/api/weather', headers });
  try {
    expect((await weather()).json().state).toBe('disabled');
    expect(transport).not.toHaveBeenCalled();
    await save(settings);
    expect((await weather()).json()).toMatchObject({
      label: 'London',
      unit: 'celsius',
    });
    await weather();
    expect(transport).toHaveBeenCalledTimes(1);
    await save({
      ...settings,
      label: 'New York',
      latitude: 40.7,
      longitude: -74,
      timezone: 'America/New_York',
      temperatureUnit: 'fahrenheit',
    });
    expect((await weather()).json()).toMatchObject({
      label: 'New York',
      unit: 'fahrenheit',
    });
    const request = new URL(String(transport.mock.calls[1]?.[0]));
    expect(request.searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(request.searchParams.get('latitude')).toBe('40.7');
    expect(
      (await app.inject({ url: '/api/dashboard', headers })).json().timezone,
    ).toBe('America/New_York');
    await save({ ...settings, latitude: 100 });
    expect((await weather()).statusCode).toBe(500);
    expect(
      (
        await app.inject({
          url: '/api/weather',
          headers: { host: headers.host },
        })
      ).statusCode,
    ).toBe(401);
    for (const url of [
      '/api/cameras',
      '/api/updates',
      '/api/reminders/water',
    ]) {
      expect((await app.inject({ url, headers })).statusCode).toBe(404);
    }
  } finally {
    await app.close();
  }
});
it('rejects unknown units, missing enabled locations, and invalid timezones', () => {
  const valid = {
    enabled: true,
    label: 'London',
    latitude: 51.5,
    longitude: 0,
    timezone: 'Europe/London',
    temperatureUnit: 'celsius',
  };
  for (const update of [
    { temperatureUnit: 'kelvin' },
    { label: ' ' },
    { timezone: 'Not/A_Timezone' },
  ]) {
    expect(
      weatherSettingsSchema.safeParse({ ...valid, ...update }).success,
    ).toBe(false);
  }
});
