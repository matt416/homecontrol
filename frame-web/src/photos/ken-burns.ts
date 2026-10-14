import type { Subject } from '@homecontrol/contracts/frame-schema';

type Size = { width: number; height: number };
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

// Both endpoints cover the viewport; interpolation cannot reveal a gap.
// Keep the full subject when possible, otherwise center the crop on it.
export function getKenBurnsPlan(
  image: Size,
  viewport: Size,
  subject?: Subject | null,
) {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    return null;
  const scale = Math.max(
    viewport.width / image.width,
    viewport.height / image.height,
  );
  const safeScale = subject
    ? Math.min(
        viewport.width / (image.width * subject.width),
        viewport.height / (image.height * subject.height),
      )
    : 0;
  const preserveSubject = safeScale >= scale * 1.015;
  const focus = subject ?? { x: 0, y: 0, width: 1, height: 1 };
  const endScale = preserveSubject
    ? Math.min(scale * 1.07, safeScale * 0.995)
    : scale * 1.07;
  function position(atScale: number, drift: number) {
    const width = image.width * atScale;
    const height = image.height * atScale;
    const minX = preserveSubject
      ? Math.max(viewport.width - width, -focus.x * width)
      : viewport.width - width;
    const maxX = preserveSubject
      ? Math.min(0, viewport.width - (focus.x + focus.width) * width)
      : 0;
    const minY = preserveSubject
      ? Math.max(viewport.height - height, -focus.y * height)
      : viewport.height - height;
    const maxY = preserveSubject
      ? Math.min(0, viewport.height - (focus.y + focus.height) * height)
      : 0;
    const x = clamp(
      viewport.width / 2 -
        (focus.x + focus.width / 2) * width +
        drift * viewport.width,
      minX,
      maxX,
    );
    const y = clamp(
      viewport.height / 2 -
        (focus.y + focus.height / 2) * height +
        drift * viewport.height,
      minY,
      maxY,
    );
    return { x, y, scale: atScale };
  }
  return {
    mode: 'cover' as const,
    start: position(scale, -0.012),
    end: position(endScale, 0.012),
  };
}
