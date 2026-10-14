import { expect, it } from 'vitest';
import { createEvent } from '@homecontrol/contracts/test-support/fixtures';
import {
  addDays,
  getDayKey,
  getEventsForDay,
  getMonthDays,
  getTimedLayout,
} from '../schedule.js';

it('keeps all-day dates independent of tablet timezone and uses an exclusive end', () => {
  const event = createEvent({
    allDay: true,
    startDay: '2026-10-12',
    endDay: '2026-10-14',
  });
  expect(getEventsForDay([event], '2026-10-12', 'Pacific/Honolulu')).toEqual([
    event,
  ]);
  expect(getEventsForDay([event], '2026-10-13', 'Pacific/Honolulu')).toEqual([
    event,
  ]);
  expect(getEventsForDay([event], '2026-10-14', 'Pacific/Honolulu')).toEqual(
    [],
  );
});
it('shows overnight events on both days but not events ending exactly at midnight', () => {
  const event = createEvent({
    start: '2026-10-12T23:00:00-04:00',
    end: '2026-10-13T01:00:00-04:00',
  });
  expect(
    getEventsForDay([event], '2026-10-13', 'America/Toronto'),
  ).toHaveLength(1);
  expect(
    getEventsForDay(
      [{ ...event, end: '2026-10-13T00:00:00-04:00' }],
      '2026-10-13',
      'America/Toronto',
    ),
  ).toHaveLength(0);
});
it('uses the frame timezone and advances calendar dates through DST', () => {
  expect(getDayKey(new Date('2026-10-13T01:00:00Z'), 'America/Toronto')).toBe(
    '2026-10-12',
  );
  expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
});

it('lays overlapping events into separate lanes and clips overnight events at the day boundary', () => {
  const events = [
    createEvent({
      id: 'a',
      start: '2026-10-12T08:00:00-04:00',
      end: '2026-10-12T10:00:00-04:00',
    }),
    createEvent({
      id: 'b',
      start: '2026-10-12T09:00:00-04:00',
      end: '2026-10-12T11:00:00-04:00',
    }),
    createEvent({
      id: 'c',
      start: '2026-10-12T11:00:00-04:00',
      end: '2026-10-13T01:00:00-04:00',
    }),
  ];
  const layout = getTimedLayout(events, '2026-10-12', 'America/Toronto');
  expect(
    layout.map(({ start, end, lane, lanes }) => ({ start, end, lane, lanes })),
  ).toEqual([
    { start: 480, end: 600, lane: 0, lanes: 2 },
    { start: 540, end: 660, lane: 1, lanes: 2 },
    { start: 660, end: 1440, lane: 0, lanes: 1 },
  ]);
});
it('builds a six-week month including leap day and surrounding dates', () => {
  const days = getMonthDays('2028-02-15');
  expect(days).toHaveLength(42);
  expect(days[0]).toBe('2028-01-30');
  expect(days).toContain('2028-02-29');
  expect(days[41]).toBe('2028-03-11');
});
