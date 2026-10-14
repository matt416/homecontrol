import type { FrameEvent } from '@homecontrol/contracts/frame-schema';

export function getDayKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-');
}
export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function formatDay(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
export function getEventsForDay(
  events: FrameEvent[],
  day: string,
  timezone: string,
) {
  return events
    .filter((event) => {
      if (event.allDay) return event.startDay <= day && event.endDay > day;
      const firstDay = getDayKey(new Date(event.start), timezone);
      const lastDay = getDayKey(new Date(Date.parse(event.end) - 1), timezone);
      return firstDay <= day && lastDay >= day;
    })
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        Date.parse(a.start) - Date.parse(b.start),
    );
}
export function formatEventTime(
  event: FrameEvent,
  day: string,
  timezone: string,
) {
  if (event.allDay) return 'All day';
  if (getDayKey(new Date(event.start), timezone) < day) return 'Continues';
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(event.start))
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function getMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return (
    Number(parts.find((part) => part.type === 'hour')?.value) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value)
  );
}

export function getTimedLayout(
  events: FrameEvent[],
  day: string,
  timezone: string,
) {
  const items = getEventsForDay(events, day, timezone)
    .filter((event) => !event.allDay)
    .map((event) => {
      const start =
        getDayKey(new Date(event.start), timezone) < day
          ? 0
          : getMinutes(new Date(event.start), timezone);
      const end =
        getDayKey(new Date(event.end), timezone) > day
          ? 1440
          : getMinutes(new Date(event.end), timezone);
      return {
        event,
        start,
        end: Math.min(1440, Math.max(start + 30, end)),
        lane: 0,
        lanes: 1,
      };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: typeof items = [];
  let groupEnd = 0;
  function finishGroup() {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    for (const item of group) item.lanes = lanes;
  }
  for (const item of items) {
    if (item.start >= groupEnd) {
      finishGroup();
      group = [];
    }
    const occupied = new Set(
      group
        .filter((other) => other.end > item.start)
        .map((other) => other.lane),
    );
    while (occupied.has(item.lane)) item.lane += 1;
    group.push(item);
    groupEnd = Math.max(...group.map((other) => other.end));
  }
  finishGroup();
  return items;
}

export function getMonthDays(day: string) {
  const first = day.slice(0, 7) + '-01';
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  return Array.from({ length: 42 }, (_, index) =>
    addDays(first, index - weekday),
  );
}
