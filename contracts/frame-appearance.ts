import { z } from 'zod';

export const DEFAULT_ACCENT_COLOR = '#E4FF73';
export const frameAppearanceSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
