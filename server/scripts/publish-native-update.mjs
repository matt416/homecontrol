import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [apkInput, exportInput] = process.argv.slice(2);
if (!apkInput || !exportInput || !process.env.ANDROID_HOME)
  throw new Error(
    'Usage: ANDROID_HOME=… node scripts/publish-native-update.mjs signed.apk export-directory',
  );
const apk = resolve(apkInput);
const buildTools = join(process.env.ANDROID_HOME, 'build-tools/35.0.0');
execFileSync(join(buildTools, 'apksigner'), ['verify', apk], { stdio: 'pipe' });
// The installed frame independently rejects packages signed by a different key.
const badging = execFileSync(
  join(buildTools, 'aapt2'),
  ['dump', 'badging', apk],
  { encoding: 'utf8' },
);
const identity =
  /package: name='org.homecontrol.frame' versionCode='(\d+)' versionName='(\d+\.\d+\.\d+)'/.exec(
    badging,
  );
if (!identity || badging.includes('application-debuggable'))
  throw new Error('Publish a non-debug HomeControl frame build.');
const bytes = await readFile(apk);
if (bytes.length > 32 * 1024 * 1024)
  throw new Error('Frame update exceeds 32 MiB.');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const release = {
  versionCode: Number(identity[1]),
  versionName: identity[2],
  sha256,
  size: bytes.length,
};
const directory = join(resolve(exportInput), 'native-update');
await mkdir(directory, { recursive: true, mode: 0o700 });
const temporary = join(directory, `${randomUUID()}.tmp`);
await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
await rename(temporary, join(directory, `${sha256}.apk`));
await writeFile(temporary, JSON.stringify(release, null, 2), {
  mode: 0o600,
  flag: 'wx',
});
await rename(temporary, join(directory, 'release.json'));
console.log(
  `Published HomeControl ${release.versionName} (${release.versionCode}), ${release.size} bytes.`,
);
