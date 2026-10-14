import { useEffect, useRef, useState } from 'react';
import type { Subject } from '@homecontrol/contracts/frame-schema';
import { getKenBurnsPlan } from './ken-burns.js';

type Props = {
  url: string;
  alt: string;
  width: number;
  height: number;
  subject?: Subject | null;
  paused: boolean;
  durationMillis: number;
};
export function MovingPhoto({
  url,
  alt,
  width,
  height,
  subject,
  paused,
  durationMillis,
}: Props) {
  const element = useRef<HTMLImageElement>(null);
  const animation = useRef<Animation | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const plan = getKenBurnsPlan({ width, height }, size, subject);
  const start = plan
    ? `translate(${plan.start.x}px, ${plan.start.y}px) scale(${plan.start.scale})`
    : '';
  const end = plan
    ? `translate(${plan.end.x}px, ${plan.end.y}px) scale(${plan.end.scale})`
    : '';
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    preference.addEventListener?.('change', change);
    const parent = element.current?.parentElement;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    if (parent) observer.observe(parent);
    return () => {
      observer.disconnect();
      preference.removeEventListener?.('change', change);
    };
  }, []);
  useEffect(() => {
    if (reduced || !start || !end || !element.current) return;
    const motion = element.current.animate(
      [{ transform: start }, { transform: end }],
      { duration: durationMillis, easing: 'linear', fill: 'forwards' },
    );
    animation.current = motion;
    return () => {
      motion.cancel();
      animation.current = null;
    };
  }, [start, end, reduced, durationMillis]);
  useEffect(() => {
    const update = () => {
      if (paused || document.hidden) animation.current?.pause();
      else animation.current?.play();
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [paused, start, end, reduced, durationMillis]);
  return (
    <img
      ref={element}
      className={`frame-photo ${plan ? 'ken-burns-photo' : ''}`}
      style={
        plan
          ? { width, height, transformOrigin: '0 0', transform: start }
          : undefined
      }
      src={url}
      alt={alt}
    />
  );
}
