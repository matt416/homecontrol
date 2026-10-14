import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test('app-owned server reconnects and restricts shutdown to local app control', async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const folder = await mkdtemp(join(tmpdir(), 'homecontrol-managed-'));
  const token = 'fixture-frame-credential-'.repeat(3),
    controlToken = 'fixture-local-control-'.repeat(3);
  const config = join(folder, 'server.json');
  await writeFile(
    config,
    JSON.stringify({
      token,
      controlToken,
      port,
      allowNetwork: false,
      publicOrigin: `http://127.0.0.1:${port}`,
    }),
    { mode: 0o600 },
  );
  let child;
  const base = `http://127.0.0.1:${port}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-HomeControl-Control': controlToken,
  };
  async function launch() {
    child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../scripts/managed.mjs', import.meta.url)),
        config,
        folder,
      ],
      { stdio: 'ignore' },
    );
    for (let i = 0; i < 100; i++) {
      const result = await fetch(`${base}/api/server/status`, {
        headers,
      }).catch(() => null);
      if (result?.ok) return result.json();
      if (child.exitCode !== null)
        throw new Error('Managed server exited before startup');
      await delay(50);
    }
    throw new Error('Server did not start');
  }
  async function stop() {
    const exited = once(child, 'exit');
    const response = await fetch(`${base}/api/server/stop`, {
      method: 'POST',
      headers,
    });
    assert.equal(response.status, 200);
    await exited;
  }
  try {
    assert.equal((await launch()).exportDir, folder);
    assert.equal(
      (
        await fetch(`${base}/api/server/stop`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}/api/server/status`, { headers })).status,
      200,
    );
    await stop();
    assert.equal((await launch()).managed, true);
    assert.equal(
      (
        await fetch(`${base}/api/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
    await stop();
  } finally {
    if (child && child.exitCode === null) child.kill();
    await rm(folder, { recursive: true, force: true });
  }
});
