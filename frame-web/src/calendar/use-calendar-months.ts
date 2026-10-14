import { useEffect, useState } from 'react';
import type { CalendarMonth } from '@homecontrol/contracts/frame-schema';
import { getCalendarMonth } from '../api-client.js';

export function useCalendarMonths(
  monthKey: string,
  token: string,
  revision: string | undefined,
  enabled: boolean,
) {
  const [pages, setPages] = useState<Record<string, CalendarMonth>>({});
  useEffect(() => {
    if (!enabled || !monthKey) return;
    const controller = new AbortController();
    let timer: number;
    const months = monthKey.split(',');
    async function refresh() {
      const results = await Promise.all(
        months.map(async (month): Promise<CalendarMonth> => {
          try {
            return await getCalendarMonth(month, token, controller.signal);
          } catch {
            return {
              month,
              generatedAt: null,
              revision,
              events: [],
              status: {
                state: 'error',
                message: 'Calendar unavailable. Retrying…',
              },
            };
          }
        }),
      );
      if (controller.signal.aborted) return;
      setPages((previous) => {
        const next = { ...previous };
        for (const result of results) next[result.month] = result;
        const keep = [
          ...months,
          ...Object.keys(next).filter((key) => !months.includes(key)),
        ].slice(0, 12);
        return Object.fromEntries(keep.map((key) => [key, next[key]!]));
      });
      timer = window.setTimeout(
        () => {
          void refresh();
        },
        results.some((page) => page.status.state === 'loading') ? 2000 : 5000,
      );
    }
    timer = window.setTimeout(() => {
      void refresh();
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [monthKey, token, revision, enabled]);
  return enabled ? pages : {};
}
