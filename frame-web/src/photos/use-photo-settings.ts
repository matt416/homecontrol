import { useEffect, useState } from 'react';
import { DEFAULT_PHOTO_SETTINGS } from '@homecontrol/contracts/photo-settings';
import { getPhotoSettings } from '../api-client.js';

export function usePhotoSettings(token: string) {
  const [settings, setSettings] = useState(DEFAULT_PHOTO_SETTINGS);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await getPhotoSettings(token, controller.signal);
        if (!controller.signal.aborted)
          setSettings((current) =>
            current.durationSeconds === result.durationSeconds &&
            current.transitionSeconds === result.transitionSeconds &&
            current.order === result.order
              ? current
              : result,
          );
      } catch {
        /* Keep the last working playback settings while offline. */
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [token]);
  return settings;
}
