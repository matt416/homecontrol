import { expect, it } from 'vitest';
import { getKenBurnsPlan } from '../ken-burns.js';

it('keeps the subject visible and the frame filled throughout the motion', () => {
  const image = { width: 1920, height: 1440 };
  const viewport = { width: 1280, height: 800 };
  const subject = { x: 0.1, y: 0.2, width: 0.45, height: 0.4 };
  const plan = getKenBurnsPlan(image, viewport, subject)!;
  expect(plan).not.toBeNull();
  for (let step = 0; step <= 10; step++) {
    const amount = step / 10;
    const scale =
      plan.start.scale + (plan.end.scale - plan.start.scale) * amount;
    const x = plan.start.x + (plan.end.x - plan.start.x) * amount;
    const y = plan.start.y + (plan.end.y - plan.start.y) * amount;
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    expect(x + image.width * scale).toBeGreaterThanOrEqual(
      viewport.width - 0.001,
    );
    expect(y + image.height * scale).toBeGreaterThanOrEqual(
      viewport.height - 0.001,
    );
    expect(x + subject.x * image.width * scale).toBeGreaterThanOrEqual(-0.001);
    expect(y + subject.y * image.height * scale).toBeGreaterThanOrEqual(-0.001);
    expect(
      x + (subject.x + subject.width) * image.width * scale,
    ).toBeLessThanOrEqual(viewport.width + 0.001);
    expect(
      y + (subject.y + subject.height) * image.height * scale,
    ).toBeLessThanOrEqual(viewport.height + 0.001);
  }
});
it.each([
  {
    image: { width: 1440, height: 1920 },
    subject: { x: 0, y: 0.247, width: 1, height: 0.753 },
  },
  { image: { width: 1920, height: 1440 }, subject: null },
  { image: { width: 900, height: 1600 }, subject: undefined },
  {
    image: { width: 4000, height: 1000 },
    subject: { x: 0, y: 0, width: 1, height: 1 },
  },
])(
  'fills the photo area and moves even without a crop-safe subject: $image',
  ({ image, subject }) => {
    const viewport = { width: 640, height: 800 };
    const plan = getKenBurnsPlan(image, viewport, subject)!;
    expect(plan).not.toBeNull();
    expect(plan.end.scale).toBeGreaterThan(plan.start.scale);
    for (let step = 0; step <= 10; step++) {
      const progress = step / 10;
      const scale =
        plan.start.scale + (plan.end.scale - plan.start.scale) * progress;
      const x = plan.start.x + (plan.end.x - plan.start.x) * progress;
      const y = plan.start.y + (plan.end.y - plan.start.y) * progress;
      expect(x).toBeLessThanOrEqual(0.001);
      expect(y).toBeLessThanOrEqual(0.001);
      expect(x + image.width * scale).toBeGreaterThanOrEqual(
        viewport.width - 0.001,
      );
      expect(y + image.height * scale).toBeGreaterThanOrEqual(
        viewport.height - 0.001,
      );
    }
  },
);
it('can fill the screen around a small subject near a portrait edge', () => {
  const plan = getKenBurnsPlan(
    { width: 1200, height: 1600 },
    { width: 1280, height: 800 },
    { x: 0.65, y: 0.1, width: 0.25, height: 0.25 },
  );
  expect(plan).not.toBeNull();
});
