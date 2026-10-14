import { randomBytes } from 'node:crypto';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getConfig } from '../dist/config.js';
import { createServer } from '../dist/server.js';
import { readFile } from 'node:fs/promises';

const directory = resolve('data/demo');
await mkdir(`${directory}/media`, { recursive: true, mode: 0o700 });
await copyFile('demo/landscape.jpg', `${directory}/media/demo-landscape.jpg`);
const config = getConfig({
  FRAME_TOKEN: randomBytes(32).toString('hex'),
  PORT: '8798',
  PUBLIC_ORIGIN: 'http://127.0.0.1:8798',
  APPLE_EXPORT_DIR: directory,
  FRAME_TIMEZONE: 'Europe/London',
  FRAME_NAME: 'HomeControl demo',
});
const write = (name, value) =>
  writeFile(`${directory}/${name}.json`, JSON.stringify(value), {
    mode: 0o600,
  });
await write('weather-settings', {
  enabled: true,
  label: 'London',
  latitude: 51.5,
  longitude: -0.12,
  timezone: 'Europe/London',
  temperatureUnit: 'celsius',
});
const today = new Date().toISOString().slice(0, 10);
await write('reminder-settings', {
  bins: {
    enabled: true,
    collectionDay: new Date(`${today}T12:00:00Z`).getUTCDay(),
    anchorDate: today,
    weeks: [
      ['recycling', 'green'],
      ['trash', 'green'],
    ],
  },
});
await write('photo-settings', {
  durationSeconds: 15,
  transitionSeconds: 0.22,
  order: 'custom',
});
const status = { state: 'ready', message: 'Fictional sample content' };
const photos = [
  {
    id: 'demo-landscape',
    caption: 'A quieter kind of evening',
    album: 'Sample landscape',
  },
];
await write('photo-catalog', photos);
function sampleEvents() {
  return [
    'Dinner with friends',
    'A walk in the park',
    'Library visit',
    'Weekend market',
  ].map((title, index) => {
    const start = new Date(`${today}T17:00:00Z`);
    start.setUTCDate(start.getUTCDate() + index);
    return {
      id: `sample-${index}`,
      title,
      calendar: index % 2 ? 'Personal' : 'Home',
      calendarDisplayName: index % 2 ? 'Alex' : 'Laura',
      calendarColor: index % 2 ? '#F8B0D2' : '#95D9FF',
      start: start.toISOString().replace('.000Z', 'Z'),
      end: new Date(+start + 3600000).toISOString().replace('.000Z', 'Z'),
      allDay: false,
      startDay: start.toISOString().slice(0, 10),
      endDay: start.toISOString().slice(0, 10),
    };
  });
}
async function refresh() {
  const events = sampleEvents();
  await write('snapshot', {
    version: 1,
    generatedAt: new Date().toISOString(),
    calendarRevision: 'demo',
    calendarStatus: status,
    photoStatus: status,
    photos,
    events,
  });
  await mkdir(`${directory}/calendar`, { recursive: true });
  const month = today.slice(0, 7);
  await write(`calendar/${month}`, {
    month,
    generatedAt: new Date().toISOString(),
    revision: 'demo',
    status,
    events,
  });
}
await refresh();
const timer = setInterval(() => void refresh(), 60000);
const fetchWeather = async (input) => {
  const url = new URL(String(input));
  const fahrenheit = url.searchParams.get('temperature_unit') === 'fahrenheit';
  const temperature = (celsius) =>
    fahrenheit ? (celsius * 9) / 5 + 32 : celsius;
  const now = Date.now();
  const midnight = Date.parse(`${today}T00:00:00Z`) / 1000;
  return new Response(
    JSON.stringify({
      current: {
        temperature_2m: temperature(18),
        weather_code: 2,
        is_day: 1,
        time: Math.floor(now / 1000),
      },
      daily: {
        time: Array.from({ length: 6 }, (_, i) => midnight + i * 86400),
        weather_code: [2, 0, 2, 3, 61, 0],
        temperature_2m_max: [18, 20, 19, 17, 16, 19].map(temperature),
        temperature_2m_min: [11, 12, 11, 10, 9, 10].map(temperature),
      },
    }),
  );
};
const server = await createServer(config, { fetchWeather });
await server.listen({ host: config.host, port: config.port });

console.log(`Demo: ${config.publicOrigin}`);
const pairing = JSON.parse(
  await readFile(`${directory}/.homeframe-pairing.json`, 'utf8'),
);
console.log(
  `Pairing code: ${pairing.code.slice(0, 4)}-${pairing.code.slice(4)}`,
);
console.log('Sample data only. Weather is simulated. Stop with Ctrl-C.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    void server.close().then(() => process.exit(0));
  });
