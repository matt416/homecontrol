import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_ACCENT_COLOR,
  frameAppearanceSchema,
} from '@homecontrol/contracts/frame-appearance';

export async function getFrameAppearance(directory: string) {
  try {
    const text = await readFile(
      join(directory, 'frame-appearance.json'),
      'utf8',
    );
    if (text.length > 1024) throw new Error('Oversized appearance settings');
    return frameAppearanceSchema.parse(JSON.parse(text));
  } catch {
    // A missing or damaged appearance file should never hide the family calendar.
    return { accentColor: DEFAULT_ACCENT_COLOR };
  }
}
