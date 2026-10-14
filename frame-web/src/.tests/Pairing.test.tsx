// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pairing } from '../Pairing.js';
import { exchangePairingCode } from '../api-client.js';

vi.mock('../api-client.js', async (original) => ({
  ...(await original<typeof import('../api-client.js')>()),
  exchangePairingCode: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('formats eight typed digits and exchanges them without exposing a token field', async () => {
  vi.mocked(exchangePairingCode).mockResolvedValue('private-session-token');
  const user = userEvent.setup();
  const onPair = vi.fn();
  render(<Pairing onPair={onPair} />);
  const input = screen.getByRole('textbox', { name: 'Pairing code' });
  await user.type(input, '01234567');
  expect((input as HTMLInputElement).value).toBe('0123-4567');
  await user.click(screen.getByRole('button', { name: 'Connect' }));
  expect(exchangePairingCode).toHaveBeenCalledWith('01234567');
  expect(onPair).toHaveBeenCalledWith('private-session-token', true);
});

it('accepts a pasted code with a dash and permits deleting across the separator', async () => {
  const user = userEvent.setup();
  render(<Pairing onPair={vi.fn()} />);
  const input = screen.getByRole('textbox', { name: 'Pairing code' });
  await user.click(input);
  await user.paste('0012-3456');
  expect((input as HTMLInputElement).value).toBe('0012-3456');
  await user.keyboard(
    '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}',
  );
  expect((input as HTMLInputElement).value).toBe('001');
  expect(
    (screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
