// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useIdle } from '../use-idle.js';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('enters photo view after inactivity and resets the timer on wake', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useIdle(120));
  act(() => vi.advanceTimersByTime(120_000));
  expect(result.current.idle).toBe(true);
  act(() => result.current.wake());
  expect(result.current.idle).toBe(false);
  act(() => vi.advanceTimersByTime(119_000));
  expect(result.current.idle).toBe(false);
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.idle).toBe(true);
  act(() =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })),
  );
  expect(result.current.idle).toBe(false);
});
