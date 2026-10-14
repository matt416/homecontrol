import { randomInt, timingSafeEqual } from 'node:crypto';

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
export function createPairingCode(now = () => Date.now()) {
  let code = '';
  let expiresAt = 0;
  let attempts = 0;
  function renew() {
    code = String(randomInt(100_000_000)).padStart(8, '0');
    expiresAt = now() + CODE_LIFETIME_MS;
    attempts = 0;
    return get();
  }
  function get() {
    return { code, expiresAt: new Date(expiresAt).toISOString() };
  }
  function consume(supplied: string) {
    if (now() >= expiresAt || attempts >= MAX_ATTEMPTS) return false;
    attempts += 1;
    if (/^[0-9]{4}-[0-9]{4}$/.test(supplied))
      supplied = supplied.replace('-', '');
    if (!/^[0-9]{8}$/.test(supplied)) return false;
    if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(code)))
      return false;
    // Consume synchronously, before any asynchronous file/network work.
    expiresAt = 0;
    return true;
  }
  renew();
  return { get, renew, consume };
}
