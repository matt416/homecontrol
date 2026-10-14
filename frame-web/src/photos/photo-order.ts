import type { PhotoSettings } from '@homecontrol/contracts/photo-settings';

export function updatePhotoOrder(
  previous: string[],
  available: string[],
  order: PhotoSettings['order'],
  resetShuffle = false,
  random = Math.random,
): string[] {
  const unique = [...new Set(available)];
  if (order === 'custom') return unique;
  const allowed = new Set(unique);
  const retained = resetShuffle ? [] : previous.filter((id) => allowed.has(id));
  const known = new Set(retained);
  const added = unique.filter((id) => !known.has(id));
  for (let index = added.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [added[index], added[target]] = [added[target]!, added[index]!];
  }
  return [...retained, ...added];
}
