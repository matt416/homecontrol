import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCalendarMonths } from './use-calendar-months.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  Dashboard,
  FrameEvent,
} from '@homecontrol/contracts/frame-schema';
import {
  addDays,
  formatDay,
  formatEventTime,
  getDayKey,
  getEventsForDay,
} from './schedule.js';

type Props = Pick<
  Dashboard,
  'timezone' | 'calendarStatus' | 'calendarRevision'
> & {
  token: string;
  now: Date;
  clockActions?: ReactNode;
  onBrowsingChange?: (browsing: boolean) => void;
};

function isPast(event: FrameEvent, now: Date, today: string) {
  return event.allDay
    ? event.endDay <= today
    : Date.parse(event.end) <= now.getTime();
}
function calendarTone(name: string) {
  return (
    Array.from(name).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3
  );
}

const FIRST_DAY = '1900-01-01';
const DAY_COUNT = Math.round(
  (Date.parse('2200-01-01T12:00:00Z') - Date.parse(`${FIRST_DAY}T12:00:00Z`)) /
    86_400_000,
);
function dayIndex(day: string) {
  return Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${FIRST_DAY}T12:00:00Z`)) /
      86_400_000,
  );
}

export function Calendar({
  timezone,
  calendarStatus,
  calendarRevision,
  now,
  token,
  clockActions,
  onBrowsingChange,
}: Props) {
  const [browsing, setBrowsing] = useState(false);
  const browsingRef = useRef(false);
  function browse(value: boolean) {
    if (browsingRef.current === value) return;
    browsingRef.current = value;
    setBrowsing(value);
    onBrowsingChange?.(value);
  }
  const today = getDayKey(now, timezone);
  const todayIndex = dayIndex(today);
  const scroll = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: DAY_COUNT,
    getScrollElement: () => scroll.current,
    estimateSize: () => 108,
    initialOffset: () => todayIndex * 108,
    overscan: 3,
  });
  useLayoutEffect(() => {
    virtualizer.scrollToIndex(todayIndex, { align: 'start' });
  }, [todayIndex, virtualizer]);
  const rows = virtualizer.getVirtualItems();
  const months = [
    ...new Set(rows.map((row) => addDays(FIRST_DAY, row.index).slice(0, 7))),
  ]
    .sort()
    .join(',');
  const ready = calendarStatus.state === 'ready';
  const pages = useCalendarMonths(months, token, calendarRevision, ready);
  const firstVisible =
    rows.find((row) => row.end > (virtualizer.scrollOffset ?? 0) + 1)?.index ??
    todayIndex;
  const atTodayStart =
    firstVisible === todayIndex &&
    Math.abs(
      (rows.find((row) => row.index === todayIndex)?.start ?? 0) -
        (virtualizer.scrollOffset ?? 0),
    ) < 2;
  function move(direction: number) {
    browse(true);
    virtualizer.scrollToIndex(
      Math.max(0, Math.min(DAY_COUNT - 1, firstVisible + direction * 3)),
      { align: 'start' },
    );
  }
  return (
    <section
      className="calendar-pane frame-calendar"
      aria-label="Family schedule"
    >
      <div className="calendar-clock clock">
        <strong>
          {new Intl.DateTimeFormat('en', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone,
          })
            .formatToParts(now)
            .filter((part) => part.type !== 'dayPeriod')
            .map((part) => part.value)
            .join('')
            .trim()}
        </strong>
        {clockActions}
      </div>
      <nav
        className="calendar-toolbar three-day-navigation"
        aria-label="Browse calendar dates"
      >
        <span className="calendar-current-date">
          {new Intl.DateTimeFormat('en', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: timezone,
          }).format(now)}
        </span>
        <div className="calendar-navigation">
          <button
            className="icon-button"
            aria-label="Previous three days"
            disabled={firstVisible === 0}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className={`text-button calendar-today ${browsing || !atTodayStart ? '' : 'is-hidden'}`}
            aria-hidden={!browsing && atTodayStart}
            tabIndex={!browsing && atTodayStart ? -1 : 0}
            disabled={!browsing && atTodayStart}
            onClick={() => {
              virtualizer.scrollToIndex(todayIndex, { align: 'start' });
              browse(false);
            }}
          >
            Today
          </button>
          <button
            className="icon-button"
            aria-label="Next three days"
            disabled={firstVisible >= DAY_COUNT - 1}
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </nav>
      {!ready && (
        <p role="status" className="calendar-error">
          {calendarStatus.message}
        </p>
      )}
      <div
        className="day-agendas virtual-agenda"
        ref={scroll}
        tabIndex={0}
        aria-label="Calendar days"
        onWheel={(event) => {
          if (event.deltaY !== 0) browse(true);
        }}
        onTouchMove={() => browse(true)}
        onKeyDown={(event) => {
          if (
            [
              'ArrowUp',
              'ArrowDown',
              'PageUp',
              'PageDown',
              'Home',
              'End',
              ' ',
            ].includes(event.key)
          )
            browse(true);
        }}
      >
        <div
          className="virtual-days"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {rows.map((row) => {
            const day = addDays(FIRST_DAY, row.index);
            const page = pages[day.slice(0, 7)];
            const currentPage =
              page?.revision === calendarRevision ? page : undefined;
            const daily =
              currentPage?.status.state === 'ready'
                ? getEventsForDay(currentPage.events, day, timezone)
                : [];
            return (
              <section
                key={row.key}
                data-index={row.index}
                data-day={day}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${row.start}px)` }}
                className={`day-agenda virtual-day ${day === today ? 'agenda-today' : ''}`}
                aria-label={formatDay(day, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              >
                <div className="agenda-date">
                  <strong>{Number(day.slice(-2))}</strong>
                  <span>
                    {day === today
                      ? 'Today'
                      : day === addDays(today, 1)
                        ? 'Tomorrow'
                        : formatDay(day, { weekday: 'short' })}
                  </span>
                  {(day.slice(0, 7) !== today.slice(0, 7) ||
                    day.endsWith('-01')) && (
                    <span>{formatDay(day, { month: 'short' })}</span>
                  )}
                  {day.slice(0, 4) !== today.slice(0, 4) && (
                    <span>{day.slice(0, 4)}</span>
                  )}
                </div>
                <ol className="day-agenda-events">
                  {ready && currentPage?.status.state !== 'ready' && (
                    <li className="calendar-loading">
                      {currentPage?.status.message || 'Loading…'}
                    </li>
                  )}
                  {daily.map((event) => (
                    <li
                      key={event.id}
                      style={{ borderColor: event.calendarColor }}
                      className={`agenda-event tone-${calendarTone(event.calendar)} ${isPast(event, now, today) ? 'past-event' : ''}`}
                    >
                      <span
                        className="agenda-event-time"
                        style={{ color: event.calendarColor }}
                      >
                        {formatEventTime(event, day, timezone)}
                        {event.calendarDisplayName &&
                          ` – ${event.calendarDisplayName}`}
                      </span>
                      <strong>{event.title}</strong>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
