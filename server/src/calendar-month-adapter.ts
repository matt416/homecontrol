import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  calendarMonthSchema,
  type CalendarMonth,
  type Dashboard,
} from '@homecontrol/contracts/frame-schema';
import { normalizeAllDayEvent } from '@homecontrol/contracts/calendar';
import type { Config } from './config.js';

export function createCalendarMonthAdapter(
  config: Config,
  getDashboard: () => Promise<Dashboard>,
  now = () => Date.now(),
) {
  return async function getMonth(month: string): Promise<CalendarMonth> {
    const dashboard = await getDashboard();
    const base = {
      month,
      generatedAt: dashboard.generatedAt,
      revision: dashboard.calendarRevision,
      events: [],
    };
    if (dashboard.calendarStatus.state !== 'ready') {
      return { ...base, status: dashboard.calendarStatus };
    }
    try {
      const path = join(config.exportDir, 'calendar', `${month}.json`);
      if ((await stat(path)).size > 8 * 1024 * 1024)
        throw new Error('Oversized month');
      const page = calendarMonthSchema.parse(
        JSON.parse(await readFile(path, 'utf8')),
      );
      const age = page.generatedAt
        ? now() - Date.parse(page.generatedAt)
        : Infinity;
      if (
        page.month === month &&
        page.revision === dashboard.calendarRevision &&
        age >= -60_000 &&
        age < 300_000
      ) {
        return {
          ...page,
          events:
            page.status.state === 'ready'
              ? page.events.map((event) =>
                  normalizeAllDayEvent(event, dashboard.timezone),
                )
              : [],
        };
      }
    } catch {
      /* Missing or invalid pages are requested again below. */
    }
    // The existing snapshot has complete coverage for these three months.
    if (dashboard.generatedAt && !dashboard.calendarRevision) {
      const date = new Date(dashboard.generatedAt);
      const current = new Intl.DateTimeFormat('en-CA', {
        timeZone: dashboard.timezone,
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(date);
      const year = Number(current.find((part) => part.type === 'year')?.value);
      const index =
        Number(current.find((part) => part.type === 'month')?.value) - 1;
      const target =
        Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1;
      if (Math.abs(target - (year * 12 + index)) <= 1) {
        return {
          ...base,
          status: dashboard.calendarStatus,
          events: dashboard.events,
        };
      }
    }
    const requests = join(config.exportDir, 'calendar-requests');
    await mkdir(requests, { recursive: true, mode: 0o700 });
    const queued = await readdir(requests);
    const filename = `${month}.json`;
    if (!queued.includes(filename)) {
      if (queued.length >= 24)
        return {
          ...base,
          status: {
            state: 'loading',
            message: 'Waiting for the Mac calendar…',
          },
        };
      await writeFile(join(requests, filename), '{}', {
        mode: 0o600,
        flag: 'wx',
      }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      });
    }
    return {
      ...base,
      status: { state: 'loading', message: 'Loading calendar…' },
    };
  };
}
