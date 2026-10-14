import { expect, it } from 'vitest';
import { normalizeAllDayEvent } from '../calendar.js';
import { createEvent } from '../test-support/fixtures.js';
it('includes a holiday whose Apple subscription ends at 23:59:59', () => {
  const event = createEvent({
    allDay: true,
    start: '2026-10-12T04:00:00Z',
    end: '2026-10-13T03:59:59Z',
    startDay: '2026-10-12',
    endDay: '2026-10-12',
  });
  expect(normalizeAllDayEvent(event, 'America/Toronto').endDay).toBe(
    '2026-10-13',
  );
});
it('normalizes inclusive multi-day events without extending exclusive ones twice', () => {
  const event = createEvent({
    allDay: true,
    start: '2026-10-12T04:00:00Z',
    end: '2026-10-15T03:59:59Z',
    startDay: '2026-10-12',
    endDay: '2026-10-14',
  });
  const normalized = normalizeAllDayEvent(event, 'America/Toronto');
  expect(normalized.endDay).toBe('2026-10-15');
  expect(normalizeAllDayEvent(normalized, 'America/Toronto')).toEqual(
    normalized,
  );
  const midnight = {
    ...event,
    end: '2026-10-15T04:00:00Z',
    endDay: '2026-10-15',
  };
  expect(normalizeAllDayEvent(midnight, 'America/Toronto')).toEqual(midnight);
});
