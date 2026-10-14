import { z } from 'zod';

export const frameReleaseSchema = z
  .object({
    versionCode: z.number().int().positive(),
    versionName: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z
      .number()
      .int()
      .positive()
      .max(32 * 1024 * 1024),
  })
  .strict();
export const frameCheckSchema = z
  .object({
    deviceId: z.uuid(),
    versionCode: z.number().int().positive(),
    versionName: z.string().max(40),
    status: z.enum(['idle', 'downloading', 'ready', 'installing', 'error']),
  })
  .strict();
export const frameUpdateRequestSchema = z
  .object({
    deviceId: z.uuid(),
    versionCode: z.number().int().positive(),
  })
  .strict();
export type FrameRelease = z.infer<typeof frameReleaseSchema>;
export type FrameCheck = z.infer<typeof frameCheckSchema>;
