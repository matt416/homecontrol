import { expect, it, vi } from 'vitest';
import { createSubjectCache } from '../subject-analyzer.js';
import { subjectSchema } from '@homecontrol/contracts/frame-schema';

it('coalesces repeated analysis requests and caches a failed analysis as a safe fallback', async () => {
  let finish: (result: null) => void = () => {};
  const analyze = vi.fn(
    () =>
      new Promise<null>((resolve) => {
        finish = resolve;
      }),
  );
  const cache = createSubjectCache(analyze);
  expect(cache.get('one')).toBeUndefined();
  cache.get('one');
  await Promise.resolve();
  expect(analyze).toHaveBeenCalledTimes(1);
  finish(null);
  await new Promise((resolve) => setImmediate(resolve));
  expect(cache.get('one')).toBeNull();
  expect(analyze).toHaveBeenCalledTimes(1);
});
it('rejects subject boxes that extend past an image boundary', () => {
  expect(
    subjectSchema.safeParse({ x: 0.8, y: 0.1, width: 0.4, height: 0.2 })
      .success,
  ).toBe(false);
  expect(
    subjectSchema.safeParse({ x: 0.1, y: 0.1, width: 0.4, height: 0.2 })
      .success,
  ).toBe(true);
});

it('does not repeatedly analyze a shared album larger than the old 100-photo cache', async () => {
  const analyze = vi.fn(async () => null);
  const cache = createSubjectCache(analyze);
  const ids = Array.from({ length: 250 }, (_, index) => `photo-${index}`);
  cache.retain(ids);
  for (const id of ids) cache.get(id);
  await new Promise((resolve) => setImmediate(resolve));
  for (const id of ids) cache.get(id);
  await new Promise((resolve) => setImmediate(resolve));
  expect(analyze).toHaveBeenCalledTimes(ids.length);
  cache.retain(ids.slice(1));
  cache.retain(ids);
  cache.get(ids[0]!);
  await new Promise((resolve) => setImmediate(resolve));
  expect(analyze).toHaveBeenCalledTimes(ids.length + 1);
});
