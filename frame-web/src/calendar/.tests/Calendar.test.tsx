// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Calendar } from '../Calendar.js';
import { getCalendarMonth } from '../../api-client.js';
import { createEvent } from '@homecontrol/contracts/test-support/fixtures';

vi.mock('../../api-client.js', () => ({ getCalendarMonth: vi.fn() }));
const props = {
  token: 'test',
  timezone: 'America/Toronto',
  calendarStatus: { state: 'ready' as const, message: '' },
  now: new Date('2026-10-12T12:00:00-04:00'),
};
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute('data-index') ? 108 : 400;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
    12_000_000,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(
        0,
        0,
        600,
        this.hasAttribute('data-index') ? 108 : 400,
      );
    },
  );
  HTMLElement.prototype.scrollTo = function (
    options: ScrollToOptions | number,
  ) {
    if (typeof options === 'object') this.scrollTop = options.top ?? 0;
    queueMicrotask(() => this.dispatchEvent(new Event('scroll')));
  };
  vi.mocked(getCalendarMonth).mockImplementation(async (month) => ({
    month,
    generatedAt: new Date().toISOString(),
    status: { state: 'ready', message: '' },
    events: [
      createEvent({
        id: 'past',
        title: 'Breakfast',
        start: '2026-10-12T08:00:00-04:00',
        end: '2026-10-12T09:00:00-04:00',
      }),
      createEvent({
        id: 'future',
        title: 'Dinner',
        calendarDisplayName: 'Laura',
        calendarColor: '#95D9FF',
      }),
    ],
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('loads a month and retains every event, fading only finished events', async () => {
  render(<Calendar {...props} />);
  expect(
    (await screen.findByText('Breakfast'))
      .closest('li')
      ?.classList.contains('past-event'),
  ).toBe(true);
  expect(
    screen.getByText('Dinner').closest('li')?.classList.contains('past-event'),
  ).toBe(false);
  expect(document.querySelectorAll('.day-agenda').length).toBeLessThan(20);
});
it('browses beyond three days and can return to today', async () => {
  render(<Calendar {...props} />);
  await screen.findByText('Dinner');
  for (let index = 0; index < 10; index++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next three days' }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await waitFor(() =>
    expect(
      vi
        .mocked(getCalendarMonth)
        .mock.calls.some(([month]) => month === '2026-11'),
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Today', exact: true }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Today', exact: true }),
    ).toBeNull(),
  );
  expect(document.querySelectorAll('.day-agenda').length).toBeLessThan(20);
});

it('reveals the full calendar while browsing and restores details with Today', async () => {
  const onBrowsingChange = vi.fn();
  render(<Calendar {...props} onBrowsingChange={onBrowsingChange} />);
  await screen.findByText('Dinner');
  fireEvent.wheel(screen.getByLabelText('Calendar days'), { deltaY: 100 });
  expect(onBrowsingChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Today', exact: true }));
  expect(onBrowsingChange).toHaveBeenLastCalledWith(false);
  fireEvent.keyDown(screen.getByLabelText('Calendar days'), {
    key: 'PageDown',
  });
  expect(onBrowsingChange).toHaveBeenLastCalledWith(true);
});

it('shows a calendar name next to its time and uses its chosen frame colour', async () => {
  render(<Calendar {...props} />);
  const event = (await screen.findByText('Dinner')).closest('li')!;
  expect(event.textContent).toContain(' – Laura');
  expect(event.style.borderColor).toBe('rgb(149, 217, 255)');
  expect(
    event.querySelector<HTMLElement>('.agenda-event-time')?.style.color,
  ).toBe('rgb(149, 217, 255)');
  expect(
    screen.getByText('Breakfast').closest('li')?.textContent,
  ).not.toContain(' – ');
});
