import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';

const configSchema = z.object({
  FRAME_TOKEN: z
    .string()
    .min(32)
    .refine(
      (value) => !value.startsWith('replace-'),
      'Run npm run setup to create a token',
    ),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(8797),
  PUBLIC_ORIGIN: z.url().default('http://127.0.0.1:8797'),
  FRAME_WEB_DIR: z.string().default('../frame-web/dist'),
  FRAME_NAME: z.string().min(1).max(80).default('Our home'),
  FRAME_TIMEZONE: z
    .string()
    .default(Intl.DateTimeFormat().resolvedOptions().timeZone)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Use an IANA timezone such as America/Toronto'),
  SUBJECT_ANALYZER_PATH: z.string().optional(),
  APPLE_EXPORT_DIR: z
    .string()
    .default(
      resolve(
        homedir(),
        'Library/Application Support/HomeControl Open Source/Frame',
      ),
    ),
  IDLE_SECONDS: z.coerce.number().int().min(0).max(3600).default(120),
});

export function getConfig(environment: NodeJS.ProcessEnv) {
  const result = configSchema.safeParse(environment);
  if (!result.success) {
    // Report field names without accidentally logging the secret input.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}. See .env.example.`,
    );
  }
  const values = result.data;
  const publicUrl = new URL(values.PUBLIC_ORIGIN);
  if (
    !['http:', 'https:'].includes(publicUrl.protocol) ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new Error('PUBLIC_ORIGIN must be a plain http(s) origin.');
  }
  return {
    token: values.FRAME_TOKEN,
    host: values.HOST,
    port: values.PORT,
    publicOrigin: publicUrl.origin,
    name: values.FRAME_NAME,
    timezone: values.FRAME_TIMEZONE,
    exportDir: resolve(values.APPLE_EXPORT_DIR),
    webDir: resolve(values.FRAME_WEB_DIR),
    subjectAnalyzerPath: values.SUBJECT_ANALYZER_PATH
      ? resolve(values.SUBJECT_ANALYZER_PATH)
      : undefined,
    idleSeconds: values.IDLE_SECONDS,
  };
}
export type Config = ReturnType<typeof getConfig>;
