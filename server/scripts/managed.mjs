// App-owned entry point. Credentials stay in the private runtime folder.
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../dist/config.js';
import { createServer } from '../dist/server.js';
import { stageBundledFrameUpdate } from '../dist/bundled-frame-update.js';

const settings = JSON.parse(await readFile(process.argv[2], 'utf8'));
const config = getConfig({
  FRAME_TOKEN: settings.token,
  HOST: settings.allowNetwork ? '0.0.0.0' : '127.0.0.1',
  PORT: String(settings.port),
  PUBLIC_ORIGIN: settings.publicOrigin,
  APPLE_EXPORT_DIR: process.argv[3],
  FRAME_WEB_DIR: fileURLToPath(
    new URL('../../frame-web/dist', import.meta.url),
  ),
});
if (
  typeof settings.controlToken !== 'string' ||
  settings.controlToken.length < 32
)
  throw new Error('Missing local server control credential.');
await stageBundledFrameUpdate(
  fileURLToPath(new URL('../../native-update', import.meta.url)),
  config.exportDir,
);
const server = await createServer(config);
function allowControl(request, reply) {
  const supplied = Buffer.from(request.headers['x-homecontrol-control'] ?? '');
  const expected = Buffer.from(settings.controlToken);
  if (
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip) ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    reply.code(403).send({ error: 'Local app control required.' });
    return false;
  }
  return true;
}
server.get('/api/server/status', async (request, reply) => {
  if (!allowControl(request, reply)) return;
  return {
    managed: true,
    exportDir: config.exportDir,
    publicOrigin: config.publicOrigin,
  };
});
server.post('/api/server/stop', async (request, reply) => {
  if (!allowControl(request, reply)) return;
  reply.send({ ok: true });
  setTimeout(() => void server.close().then(() => process.exit(0)), 100);
});
await server.listen({ host: config.host, port: config.port });
console.log('HomeControl local server started.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => void server.close().then(() => process.exit(0)));
