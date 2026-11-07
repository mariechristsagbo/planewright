import { describe, expect, it } from 'vitest';

import { sceneFromScreen, screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { resizeViewport, viewportCenter } from '../../../src/camera/viewport.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { anyCamera, gap } from '../../support/cameras.ts';
import { checkProperty } from '../../support/property.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

const size = (width: number, height: number, pixelRatio = 1): ViewportSize => ({
  width,
  height,
  pixelRatio,
});

const anySize = (random: Random): ViewportSize =>
  size(randomBetween(random, 0, 4000), randomBetween(random, 0, 4000), randomBetween(random, 1, 3));

describe('viewportCenter', () => {
  it('is the screen point at the middle of the canvas', () => {
    expect(viewportCenter(size(1280, 720))).toStrictEqual({ x: 640, y: 360 });
    expect(viewportCenter(size(390, 844, 3))).toStrictEqual({ x: 195, y: 422 });
  });
});

describe('resizeViewport', () => {
  it('keeps the scene point at the viewport centre at the new centre, at the same zoom', () => {
    const after = resizeViewport(camera(0, 0, 2), size(1280, 720), size(800, 600));
    expect(after).toStrictEqual(camera(120, 30, 2));
    expect(sceneFromScreen({ x: 400, y: 300 }, after)).toStrictEqual({ x: 320, y: 180 });
  });

  it('moves nothing when only the device pixel ratio changes', () => {
    expect(
      resizeViewport(camera(-5, 7, 1.5), size(1280, 720, 1), size(1280, 720, 2)),
    ).toStrictEqual(camera(-5, 7, 1.5));
  });

  it('REQ-V08 stops at the position limit and ignores a size that is not a number', () => {
    expect(resizeViewport(camera(1e9, 0, 0.1), size(0, 0), size(-400, 0)).x).toBe(1e9);
    expect(resizeViewport(camera(1, 2, 3), size(100, 100), size(Number.NaN, 100))).toStrictEqual(
      camera(1, 2, 3),
    );
  });

  it('property: the scene point at the old centre is shown at the new one, within 10⁻⁴ px', () => {
    checkProperty(
      { seed: 5104, runs: 300 },
      (random) => ({ camera: anyCamera(random, 1e6), from: anySize(random), to: anySize(random) }),
      ({ camera: start, from, to }) => {
        const after = resizeViewport(start, from, to);
        expect(after.zoom).toBe(start.zoom);
        const kept = sceneFromScreen(viewportCenter(from), start);
        expect(gap(screenFromScene(kept, after), viewportCenter(to))).toBeLessThanOrEqual(1e-4);
      },
    );
  });
});
