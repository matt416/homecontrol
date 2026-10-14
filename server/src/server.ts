import { advertiseFrameServer } from './discovery.js';
import { registerFrameUpdateRoutes } from './frame-update-routes.js';
import { createPairingCode } from './pairing-code.js';
import { publishPairing } from './publish-pairing.js';
import { z } from 'zod';
import { createWeatherSettingsAdapter } from './weather-settings-adapter.js';
import { createRemindersAdapter } from './reminders-adapter.js';
import { timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import type { Config } from './config.js';
import { createAppleExportAdapter } from './apple-export-adapter.js';
import { analyzePhoto, createSubjectCache } from './subject-analyzer.js';
import { calendarMonthKeySchema } from '@homecontrol/contracts/frame-schema';
import { createCalendarMonthAdapter } from './calendar-month-adapter.js';
import { createWeatherAdapter } from './weather-adapter.js';
import { photoSettingsSchema } from '@homecontrol/contracts/photo-settings';
import { getFrameAppearance } from './frame-appearance-adapter.js';
import { createPhotoSettingsAdapter } from './photo-settings-adapter.js';

export async function createServer(
  config: Config,
  options: { fetchWeather?: typeof fetch } = {},
) {
  const app = Fastify({ logger: false, bodyLimit: 1024 });
  let stopDiscovery: (() => void) | undefined;
  app.addHook('onListen', async () => {
    if (config.host === '0.0.0.0')
      stopDiscovery = advertiseFrameServer(config.port);
  });
  app.addHook('onClose', async () => {
    stopDiscovery?.();
  });
  const pairing = createPairingCode();
  app.addHook('onReady', async () => publishPairing(config, pairing.get()));
  const apple = createAppleExportAdapter(config);
  const weatherSettings = createWeatherSettingsAdapter(
    config.exportDir,
    config.timezone,
  );
  async function getDashboard() {
    const settings = await weatherSettings.get();
    const [dashboard, appearance] = await Promise.all([
      apple.getDashboard(settings.timezone),
      getFrameAppearance(config.exportDir),
    ]);
    return { ...dashboard, ...appearance };
  }
  const getCalendarMonth = createCalendarMonthAdapter(config, getDashboard);
  let weatherKey = '';
  let weather: ReturnType<typeof createWeatherAdapter> | null = null;
  const reminders = createRemindersAdapter(config.exportDir);
  const photoSettings = createPhotoSettingsAdapter(config.exportDir);
  const subjects = config.subjectAnalyzerPath
    ? createSubjectCache(async (id) => {
        const bytes = await apple.getPhoto(id);
        return bytes ? analyzePhoto(config.subjectAnalyzerPath!, bytes) : null;
      })
    : null;
  const publicHost = new URL(config.publicOrigin).host;
  const allowedHosts = new Set([
    publicHost,
    `127.0.0.1:${config.port}`,
    `localhost:${config.port}`,
  ]);
  const allowedOrigins = new Set([
    config.publicOrigin,
    `http://127.0.0.1:${config.port}`,
    `http://localhost:${config.port}`,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);

  // Older Android devices may not resolve .local names. Accept this Mac's own
  // IPv4 addresses when LAN sharing is enabled, while retaining Host checks.
  if (config.host === '0.0.0.0') {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (address.internal || address.family !== 'IPv4') continue;
        const host = `${address.address}:${config.port}`;
        allowedHosts.add(host);
        allowedOrigins.add(`http://${host}`);
      }
    }
  }

  await app.register(rateLimit, { max: 180, timeWindow: '1 minute' });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (!allowedHosts.has(request.headers.host ?? ''))
      return reply.code(403).send({ error: 'Unrecognized host' });
    if (request.headers.origin && !allowedOrigins.has(request.headers.origin))
      return reply.code(403).send({ error: 'Origin not allowed' });
    // Match the router's canonical path so encoded URLs cannot skip authentication.
    const routePath = request.routeOptions.url;
    if (!routePath?.startsWith('/api/')) return;
    if (request.method === 'POST' && routePath === '/api/pair') return;
    reply.header('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${config.token}`);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return reply
        .code(401)
        .send({ error: 'Connect this frame using the code on your Mac.' });
  });

  app.post(
    '/api/pair',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const parsed = z.object({ code: z.string() }).safeParse(request.body);
      if (!pairing.consume(parsed.success ? parsed.data.code : '')) {
        return reply
          .code(401)
          .send({ error: 'Code not accepted. Get a new code from your Mac.' });
      }
      await publishPairing(config, pairing.renew());
      return { token: config.token };
    },
  );
  app.post('/api/pairing-code', async () => {
    const value = pairing.renew();
    await publishPairing(config, value);
    return value;
  });
  registerFrameUpdateRoutes(app, config.exportDir);
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/api/photo-settings', async () => photoSettings.get());
  app.post('/api/photo-settings', async (request, reply) => {
    const parsed = photoSettingsSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Invalid slideshow settings.' });
    return photoSettings.save(parsed.data);
  });
  app.get('/api/dashboard', async () => {
    const dashboard = await getDashboard();
    if (!subjects) return dashboard;
    subjects.retain(dashboard.photos.map((photo) => photo.id));
    return {
      ...dashboard,
      photos: dashboard.photos.map((photo) => ({
        ...photo,
        subject: subjects.get(photo.id),
      })),
    };
  });
  app.get<{ Params: { month: string } }>(
    '/api/calendar/:month',
    async (request, reply) => {
      const month = calendarMonthKeySchema.safeParse(request.params.month);
      if (!month.success)
        return reply.code(400).send({ error: 'Invalid calendar month' });
      return getCalendarMonth(month.data);
    },
  );
  app.get('/api/weather', async () => {
    const settings = await weatherSettings.get();
    if (!settings.enabled) {
      weather = null;
      weatherKey = '';
      return {
        state: 'disabled',
        label: '',
        temperature: null,
        weatherCode: null,
        isDay: true,
        observedAt: null,
        forecast: [],
        unit: settings.temperatureUnit,
        timezone: settings.timezone,
      };
    }
    const key = JSON.stringify(settings);
    if (!weather || key !== weatherKey) {
      weather = createWeatherAdapter(settings, options.fetchWeather);
      weatherKey = key;
    }
    return weather.getWeather();
  });
  app.get('/api/reminders', async () => reminders.get());
  app.get<{ Params: { id: string } }>(
    '/api/photos/:id',
    async (request, reply) => {
      const photo = await apple.getPhoto(request.params.id);
      if (!photo) return reply.code(404).send({ error: 'Photo unavailable' });
      return reply.type('image/jpeg').send(photo);
    },
  );
  if (existsSync(config.webDir)) {
    await app.register(staticFiles, {
      root: config.webDir,
      index: ['index.html'],
      setHeaders(response, path) {
        if (path.endsWith('.html'))
          response.header('Cache-Control', 'no-store');
      },
    });
  }
  app.setErrorHandler((error, _request, reply) => {
    const status =
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    reply.code(status).send({
      error:
        status === 429
          ? 'Too many requests. Try again shortly.'
          : 'Request could not be completed.',
    });
  });
  return app;
}
