import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

try {
  await writeFile(
    '.env',
    `FRAME_TOKEN=${randomBytes(32).toString('hex')}\nHOST=127.0.0.1\nPORT=8797\nPUBLIC_ORIGIN=http://127.0.0.1:8797\nFRAME_NAME=Our home\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.log(
    'Created local configuration. Start the server, then open HomeControl.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing configuration preserved.');
}
