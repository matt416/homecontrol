import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameReleaseSchema } from '@homecontrol/contracts/frame-update';

/** Copy the packaged Android release to private storage without replacing a newer release. */
export async function stageBundledFrameUpdate(
  bundleDirectory: string,
  exportDir: string,
) {
  let release;
  let bytes;
  try {
    release = frameReleaseSchema.parse(
      JSON.parse(await readFile(join(bundleDirectory, 'release.json'), 'utf8')),
    );
    bytes = await readFile(join(bundleDirectory, `${release.sha256}.apk`));
    if (
      bytes.length !== release.size ||
      createHash('sha256').update(bytes).digest('hex') !== release.sha256
    )
      return;
  } catch {
    return;
  }
  const destination = join(exportDir, 'native-update');
  try {
    const current = frameReleaseSchema.parse(
      JSON.parse(await readFile(join(destination, 'release.json'), 'utf8')),
    );
    if (current.versionCode >= release.versionCode) return;
  } catch {
    /* First install or a damaged manifest can be repaired by the bundled release. */
  }
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const temporary = join(destination, `${randomUUID()}.tmp`);
  await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
  await rename(temporary, join(destination, `${release.sha256}.apk`));
  await writeFile(temporary, JSON.stringify(release), {
    mode: 0o600,
    flag: 'wx',
  });
  await rename(temporary, join(destination, 'release.json'));
}
