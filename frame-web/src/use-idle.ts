import { useCallback, useEffect, useRef, useState } from 'react';

export function useIdle(seconds: number) {
  const [idle, setIdle] = useState(false);
  const lastActivity = useRef(Date.now());
  const wake = useCallback(() => {
    lastActivity.current = Date.now();
    setIdle(false);
  }, []);
  useEffect(() => {
    // Movement keeps the dashboard awake, but only a deliberate tap or key exits photo view.
    const markActivity = () => {
      lastActivity.current = Date.now();
    };
    const keyActivity = () => {
      wake();
    };
    window.addEventListener('pointermove', markActivity);
    window.addEventListener('pointerdown', markActivity);
    window.addEventListener('keydown', keyActivity);
    const interval = window.setInterval(() => {
      if (
        seconds > 0 &&
        !document.hidden &&
        Date.now() - lastActivity.current >= seconds * 1000
      )
        setIdle(true);
    }, 1000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pointermove', markActivity);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', keyActivity);
    };
  }, [seconds, wake]);
  return { idle, wake, showPhotoView: () => setIdle(true) };
}
