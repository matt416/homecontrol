import { expect, it } from 'vitest';
import { updatePhotoOrder } from '../photo-order.js';

it('includes the whole album once, preserving a shuffle across refreshes', () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `photo-${i}`);
  const shuffled = updatePhotoOrder([], ids, 'random', false, () => 0.1);
  expect(new Set(shuffled).size).toBe(5000);
  expect(shuffled).not.toEqual(ids);
  expect(updatePhotoOrder(shuffled, [...ids], 'random')).toEqual(shuffled);
  const changed = updatePhotoOrder(
    shuffled,
    [...ids.slice(1), 'new'],
    'random',
  );
  expect(changed).toEqual([...shuffled.filter((id) => id !== ids[0]), 'new']);
});
it('uses the exact Mac order in custom mode and reshuffles only on an explicit mode change', () => {
  expect(updatePhotoOrder(['b', 'a'], ['a', 'c', 'b'], 'custom')).toEqual([
    'a',
    'c',
    'b',
  ]);
  expect(
    updatePhotoOrder(['b', 'a'], ['a', 'b'], 'random', true, () => 0.9),
  ).toEqual(['a', 'b']);
});
