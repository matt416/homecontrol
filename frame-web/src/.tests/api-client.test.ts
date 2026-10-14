// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getPhotoBlob } from '../api-client.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function installSlowPhotoTransport() {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, options: RequestInit) => {
      const signal = options.signal!;
      return Promise.resolve({
        status: 200,
        ok: true,
        blob: () =>
          new Promise<Blob>((_resolve, reject) => {
            const fail = () =>
              reject(new DOMException('Aborted', 'AbortError'));
            if (signal.aborted) fail();
            else signal.addEventListener('abort', fail, { once: true });
          }),
      });
    }),
  );
}

it('cancels a slow photo body when the caller moves to another photo', async () => {
  installSlowPhotoTransport();
  const controller = new AbortController();
  const photo = getPhotoBlob('one', 'test-token', controller.signal);
  const assertion = expect(photo).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve();
  controller.abort();
  await assertion;
});

it('times out a photo body even when its response headers have already arrived', async () => {
  vi.useFakeTimers();
  installSlowPhotoTransport();
  const photo = getPhotoBlob('one', 'test-token', new AbortController().signal);
  const assertion = expect(photo).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
});
