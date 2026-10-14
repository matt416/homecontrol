import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import {
  frameCheckSchema,
  frameUpdateRequestSchema,
} from '@homecontrol/contracts/frame-update';
import { createFrameUpdateAdapter } from './frame-update-adapter.js';

export function registerFrameUpdateRoutes(
  app: FastifyInstance,
  exportDir: string,
) {
  const updates = createFrameUpdateAdapter(exportDir);
  app.get('/api/frame-update', () => updates.status());
  app.post('/api/frame-update/check', async (request, reply) => {
    const parsed = frameCheckSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Invalid frame status.' });
    return updates.check(parsed.data);
  });
  app.post('/api/frame-update/request', async (request, reply) => {
    const parsed = frameUpdateRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Choose a frame and update.' });
    const result = await updates.request(
      parsed.data.deviceId,
      parsed.data.versionCode,
    );
    if (!result)
      return reply
        .code(409)
        .send({ error: 'Refresh the frame status before sending an update.' });
    return result;
  });
  // APK downloads use the same authenticated API as frame content.
  app.get('/api/frame-update/apk', async (_request, reply) => {
    const file = await updates.apk();
    if (!file)
      return reply
        .code(404)
        .send({ error: 'No frame update is published yet.' });
    reply.header('Cache-Control', 'no-store');
    reply.header(
      'Content-Disposition',
      'attachment; filename="HomeControl-Frame.apk"',
    );
    reply.header('Content-Length', file.size);
    return reply
      .type('application/vnd.android.package-archive')
      .send(createReadStream(file.path));
  });
  // Only this signed, non-personal app binary is available without pairing, for initial setup.
  app.get('/install/homecontrol-frame.apk', async (_request, reply) => {
    const file = await updates.apk();
    if (!file)
      return reply
        .code(404)
        .send({ error: 'No frame update is published yet.' });
    reply.header('Cache-Control', 'no-store');
    reply.header(
      'Content-Disposition',
      'attachment; filename="HomeControl.apk"',
    );
    reply.header('Content-Length', file.size);
    return reply
      .type('application/vnd.android.package-archive')
      .send(createReadStream(file.path));
  });
  app.get('/install', async (_request, reply) => {
    const { release } = await updates.status();
    reply.header('Cache-Control', 'no-store');
    return reply
      .type('text/html')
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HomeControl for your frame</title><link rel="stylesheet" href="/install/style.css"></head><body><main><span class="eyebrow">HOMECONTROL</span><h1>Updates, without the cable.</h1><p>Install this standalone frame app once. Future updates can be sent from HomeControl on your Mac over Wi-Fi.</p><section><h2>${release ? `Frame app ${release.versionName}` : 'Update not ready yet'}</h2>${release ? '<a class="download" href="/install/homecontrol-frame.apk">Download for Android</a>' : '<p>Publish a frame update from your Mac first.</p>'}<ol><li>Keep the frame connected to its wall power and home Wi-Fi.</li><li>Download, then open <strong>HomeControl.apk</strong> from the download notification or Downloads app.</li><li>If Android asks, allow installation from this source. Tap <strong>Install</strong>, then <strong>Open</strong>.</li></ol><p class="note">Pair the new app using the address and code in Mac Settings. Next time, use <strong>Settings → Frame updates → Send Update</strong> on the Mac, then confirm Install on the frame.</p></section></main></body></html>`,
      );
  });
  app.get('/install/style.css', async (_request, reply) =>
    reply
      .type('text/css')
      .send(
        `*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#20242b;font:18px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:760px;margin:64px auto;padding:0 28px}.eyebrow{font-size:13px;font-weight:700;letter-spacing:.16em;color:#4263d6}h1{font-size:42px;line-height:1.15;letter-spacing:-.04em;margin:18px 0}h2{font-size:24px;margin:0 0 20px}section{background:white;border:1px solid #e0e3e9;border-radius:20px;padding:30px;margin-top:30px}.download{display:inline-block;background:#2456dc;color:white;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:600}ol{padding-left:24px;margin:28px 0}li{padding:0 0 12px 5px}.note{font-size:15px;color:#586270;margin-bottom:0}@media(max-width:500px){main{margin:32px auto}h1{font-size:34px}section{padding:22px}}`,
      ),
  );
}
