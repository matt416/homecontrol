// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { PhotoFrame } from '../PhotoFrame.js';
import { getPhotoBlob } from '../../api-client.js';

vi.mock('../../api-client.js', () => ({ getPhotoBlob: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  let blobNumber = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++blobNumber}`);
  HTMLImageElement.prototype.decode = vi.fn().mockResolvedValue(undefined);
  URL.revokeObjectURL = vi.fn();
  vi.mocked(getPhotoBlob).mockResolvedValue(new Blob());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('advances automatically, wraps, and revokes image blobs on unmount', async () => {
  const view = render(
    <PhotoFrame
      settings={{
        durationSeconds: 4,
        transitionSeconds: 0.35,
        order: 'custom',
      }}
      token="test"
      photoStatus={{ state: 'ready', message: '' }}
      photos={[
        { id: 'one', album: 'Album', caption: 'First memory' },
        { id: 'two', album: 'Album', caption: 'Second memory' },
      ]}
    />,
  );
  await act(async () => {});
  expect(screen.getByRole('img').getAttribute('alt')).toBe('First memory');
  await act(async () => {
    vi.advanceTimersByTime(4_000);
  });
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Second memory');
  await act(async () => {
    vi.advanceTimersByTime(4_000);
  });
  expect(screen.getByRole('img').getAttribute('alt')).toBe('First memory');
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});
it('shows the album empty state without photo controls', () => {
  render(
    <PhotoFrame
      settings={{
        durationSeconds: 4,
        transitionSeconds: 0.35,
        order: 'custom',
      }}
      token="test"
      photoStatus={{ state: 'ready', message: '' }}
      photos={[]}
    />,
  );
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Add photos to this album.')).toBeTruthy();
});

it('keeps the current photo while the next image decodes and releases it after the fade', async () => {
  render(
    <PhotoFrame
      settings={{
        durationSeconds: 4,
        transitionSeconds: 0.35,
        order: 'custom',
      }}
      token="test"
      photoStatus={{ state: 'ready', message: '' }}
      photos={[
        { id: 'one', album: 'Album', caption: 'First' },
        { id: 'two', album: 'Album', caption: 'Second' },
      ]}
    />,
  );
  await act(async () => {});
  let finishDecode: () => void = () => {};
  vi.mocked(HTMLImageElement.prototype.decode).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishDecode = resolve;
      }),
  );
  await act(async () => {
    vi.advanceTimersByTime(4_000);
  });
  expect(screen.getByRole('img').getAttribute('alt')).toBe('First');
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  await act(async () => {
    finishDecode();
  });
  expect(screen.getByRole('img').getAttribute('alt')).toBe('Second');
  expect(document.querySelectorAll('.photo-layer')).toHaveLength(2);
  expect(
    document.querySelector<HTMLElement>('.photo-enter')?.style
      .animationDuration,
  ).toBe('350ms');
  await act(async () => {
    vi.advanceTimersByTime(350);
  });
  expect(document.querySelectorAll('.photo-layer')).toHaveLength(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
});
