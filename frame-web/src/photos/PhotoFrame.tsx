import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Images } from 'lucide-react';
import type { Dashboard } from '@homecontrol/contracts/frame-schema';
import { MovingPhoto } from './MovingPhoto.js';
import { getPhotoBlob } from '../api-client.js';
import {
  DEFAULT_PHOTO_SETTINGS,
  type PhotoSettings,
} from '@homecontrol/contracts/photo-settings';
import { updatePhotoOrder } from './photo-order.js';

type Props = Pick<Dashboard, 'photos' | 'photoStatus'> & {
  token: string;
  children?: ReactNode;
  paused?: boolean;
  settings?: PhotoSettings;
};

export function PhotoFrame({
  photos,
  photoStatus,
  token,
  children,
  paused = false,
  settings = DEFAULT_PHOTO_SETTINGS,
}: Props) {
  const [sequence, setSequence] = useState(() => {
    const ids = updatePhotoOrder(
      [],
      photos.map((photo) => photo.id),
      settings.order,
    );
    return { ids, selected: ids[0], order: settings.order };
  });
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [layers, setLayers] = useState<
    Array<{
      id: string;
      url: string;
      width: number;
      height: number;
      alt: string;
    }>
  >([]);
  const urls = useRef(new Set<string>());
  const [failed, setFailed] = useState(false);

  const photo = photos.find((item) => item.id === sequence.selected);
  const photoId = photo?.id;
  const displayedId = layers[layers.length - 1]?.id;
  const transitionMillis = reducedMotion
    ? 0
    : settings.transitionSeconds * 1000;

  useEffect(() => {
    setSequence((current) => {
      const ids = updatePhotoOrder(
        current.ids,
        photos.map((item) => item.id),
        settings.order,
        current.order !== settings.order,
      );
      const selected =
        current.selected && ids.includes(current.selected)
          ? current.selected
          : ids[0];
      if (
        current.order === settings.order &&
        selected === current.selected &&
        ids.length === current.ids.length &&
        ids.every((id, index) => id === current.ids[index])
      )
        return current;
      return { ids, selected, order: settings.order };
    });
  }, [photos, settings.order]);

  useEffect(() => {
    if (
      paused ||
      reducedMotion ||
      sequence.ids.length < 2 ||
      (!failed && displayedId !== photoId)
    )
      return;
    const interval = window.setInterval(() => {
      if (!document.hidden)
        setSequence((current) => ({
          ...current,
          selected:
            current.ids[
              (current.ids.indexOf(current.selected ?? '') + 1) %
                current.ids.length
            ],
        }));
    }, settings.durationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [
    paused,
    reducedMotion,
    sequence.ids.length,
    photoId,
    displayedId,
    failed,
    settings.durationSeconds,
  ]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReducedMotion(preference.matches);
    };
    preference.addEventListener?.('change', change);
    return () => preference.removeEventListener?.('change', change);
  }, []);

  useEffect(() => {
    const owned = urls.current;
    return () => {
      for (const url of owned) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);

  useEffect(() => {
    const visible = new Set(layers.map((layer) => layer.url));
    for (const url of urls.current) {
      if (!visible.has(url)) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
    }
    if (layers.length < 2) return;
    const timer = window.setTimeout(
      () => setLayers((current) => current.slice(-1)),
      transitionMillis,
    );
    return () => window.clearTimeout(timer);
  }, [layers, transitionMillis]);

  useEffect(() => {
    if (!photoId) {
      setLayers([]);
      return;
    }
    const controller = new AbortController();
    let pendingUrl: string | undefined;
    setFailed(false);
    void getPhotoBlob(photoId, token, controller.signal)
      .then(async (blob) => {
        if (controller.signal.aborted) return;
        pendingUrl = URL.createObjectURL(blob);
        const decoded = new Image();
        decoded.src = pendingUrl;
        await decoded.decode();
        if (controller.signal.aborted) return;
        const url = pendingUrl;
        urls.current.add(url);
        pendingUrl = undefined;
        setLayers((current) => [
          ...current.slice(-1),
          {
            id: photoId,
            url,
            width: decoded.naturalWidth,
            height: decoded.naturalHeight,
            alt: photo?.caption || photo?.album || '',
          },
        ]);
      })
      .catch(() => {
        if (pendingUrl) {
          URL.revokeObjectURL(pendingUrl);
          pendingUrl = undefined;
        }
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [photoId, photo?.caption, photo?.album, token]);

  const visibleLayers = layers.filter((layer) =>
    photos.some((item) => item.id === layer.id),
  );
  const ready = photoStatus.state === 'ready';
  return (
    <section className="photo-pane" aria-label="Photo slideshow">
      {visibleLayers.length ? (
        visibleLayers.map((layer, position) => (
          <div
            key={layer.url}
            className={`photo-layer ${position > 0 ? 'photo-enter' : ''}`}
            style={{ animationDuration: `${transitionMillis}ms` }}
            aria-hidden={position < visibleLayers.length - 1 || undefined}
          >
            <MovingPhoto
              {...layer}
              subject={photos.find((item) => item.id === layer.id)?.subject}
              paused={paused || reducedMotion}
              durationMillis={settings.durationSeconds * 1000}
            />
          </div>
        ))
      ) : (
        <div className="photo-empty">
          <Images size={48} strokeWidth={1} />
          <h2>
            {photo
              ? failed
                ? 'Photo unavailable'
                : 'Loading photo…'
              : 'Choose your shared album'}
          </h2>
          <p>
            {photo
              ? failed
                ? 'The photo could not be loaded. Try the next one or refresh the frame.'
                : ''
              : ready
                ? 'Add photos to this album.'
                : photoStatus.message}
          </p>
        </div>
      )}
      {children}
    </section>
  );
}
