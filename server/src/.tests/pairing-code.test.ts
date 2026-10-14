import { expect, it } from 'vitest';
import { createPairingCode } from '../pairing-code.js';
it('issues eight digits, allows leading zeros, expires, and consumes once', () => {
  let now = 0;
  const pairing = createPairingCode(() => now);
  const first = pairing.get().code;
  expect(first).toMatch(/^[0-9]{8}$/);
  expect(pairing.consume(first)).toBe(true);
  expect(pairing.consume(first)).toBe(false);
  const second = pairing.renew().code;
  now = 600_000;
  expect(pairing.consume(second)).toBe(false);
});
it('locks a code after ten failed guesses until the Mac renews it', () => {
  const pairing = createPairingCode();
  const valid = pairing.get().code;
  for (let index = 0; index < 10; index++)
    expect(pairing.consume('invalid')).toBe(false);
  expect(pairing.consume(valid)).toBe(false);
  expect(pairing.consume(pairing.renew().code)).toBe(true);
});
it('accepts exactly four digits, a dash, and four digits', () => {
  const pairing = createPairingCode();
  const code = pairing.get().code;
  expect(pairing.consume(`${code.slice(0, 4)}--${code.slice(4)}`)).toBe(false);
  expect(pairing.consume(`${code.slice(0, 4)}-${code.slice(4)}`)).toBe(true);
});
