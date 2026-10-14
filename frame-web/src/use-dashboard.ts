import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dashboard } from '@homecontrol/contracts/frame-schema';
import { getDashboard, PairingError } from './api-client.js';

export function useDashboard(token: string, onUnpair: () => void) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    try {
      const result = await getDashboard(token);
      if (active.current) {
        setData(result);
        setError('');
      }
    } catch (error) {
      if (!active.current) return;
      if (error instanceof PairingError) {
        onUnpair();
        return;
      }
      setError(
        'Connection lost. Showing the last update; trying again shortly.',
      );
    } finally {
      pending.current = false;
      if (active.current) setRefreshing(false);
    }
  }, [token, onUnpair]);
  useEffect(() => {
    active.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5_000);
    return () => {
      active.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);
  return { data, error, refreshing, refresh };
}
