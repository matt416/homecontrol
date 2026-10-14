import { spawn } from 'node:child_process';
import { z } from 'zod';
import {
  subjectSchema,
  type Subject,
} from '@homecontrol/contracts/frame-schema';

const analysisSchema = z.object({
  subject: subjectSchema.nullable().optional(),
});
export function analyzePhoto(
  executable: string,
  bytes: Buffer,
): Promise<Subject | null> {
  return new Promise((resolve) => {
    const process = spawn(executable, [], {
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    let output = '';
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (output.length > 8192) process.kill();
    });
    process.on('error', () => resolve(null));
    process.stdin.on('error', () => {});
    process.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        resolve(analysisSchema.parse(JSON.parse(output)).subject ?? null);
      } catch {
        resolve(null);
      }
    });
    process.stdin.end(bytes);
  });
}

export function createSubjectCache(
  analyze: (id: string) => Promise<Subject | null>,
) {
  const results = new Map<string, Subject | null>();
  const pending = new Set<string>();
  let retained: Set<string> | null = null;
  let queue = Promise.resolve();
  return {
    retain(ids: string[]) {
      retained = new Set(ids);
      for (const id of results.keys())
        if (!retained.has(id)) results.delete(id);
    },
    get(id: string) {
      if (!results.has(id) && !pending.has(id)) {
        pending.add(id);
        queue = queue.then(async () => {
          try {
            if (retained && !retained.has(id)) return;
            const result = await analyze(id);
            if (!retained || retained.has(id)) results.set(id, result);
          } catch {
            if (!retained || retained.has(id)) results.set(id, null);
          } finally {
            pending.delete(id);
          }
        });
      }
      return results.get(id);
    },
  };
}
