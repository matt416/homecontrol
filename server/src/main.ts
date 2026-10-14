import 'dotenv/config';
import { getConfig } from './config.js';
import { createServer } from './server.js';

const config = getConfig(process.env);
const server = await createServer(config);
await server.listen({ host: config.host, port: config.port });
console.log(`HomeControl listening at ${config.publicOrigin}`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
