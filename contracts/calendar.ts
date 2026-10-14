import type { FrameEvent } from './frame-schema.js';

export function addCalendarDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

// EventKit subscriptions can use 23:59:59 instead of an exclusive midnight.
// Normalize once at the adapter boundary; already-exclusive exports stay intact.
export function normalizeAllDayEvent(event: FrameEvent, timezone: string) {
  if (!event.allDay) return event;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(event.end));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const endDate = `${get('year')}-${get('month')}-${get('day')}`;
  const inclusive =
    event.endDay === endDate &&
    (get('hour') !== '00' || get('minute') !== '00' || get('second') !== '00');
  if (event.endDay <= event.startDay || inclusive) {
    return { ...event, endDay: addCalendarDays(event.endDay, 1) };
  }
  return event;
}
