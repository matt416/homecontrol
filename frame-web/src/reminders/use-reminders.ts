import { useEffect, useState } from 'react';
import type { ReminderState } from '@homecontrol/contracts/reminders';
import { getReminders } from '../api-client.js';

export function useReminders(token: string) {
  const [state, setState] = useState<ReminderState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const next = await getReminders(token);
        if (active) {
          setState(next);
          setError('');
        }
      } catch {
        if (active) {
          setState(null);
          setError(
            'Collection reminders could not be updated. Check your Mac.',
          );
        }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);
  return { state, error };
}
