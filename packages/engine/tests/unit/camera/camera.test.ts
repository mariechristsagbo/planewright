import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  POSITION_LIMIT,
  cameraShowing,
  clampZoom,
  limitCamera,
  sceneFromScreen,
  screenFromScene,
} from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { panBy } from '../../../src/camera/pan.ts';
import { zoomAbout } from '../../../src/camera/zoom.ts';
import { anyCamera, anyScreenPoint, gap } from '../../support/cameras.ts';
import { checkProperty } from '../../support/property.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

describe('sceneFromScreen and screenFromScene', () => {
  it("show the camera's position at the canvas's top-left corner", () => {
    const c = camera(-90, 45, 2.5);
    expect(sceneFromScreen({ x: 0, y: 0 }, c)).toStrictEqual({ x: -90, y: 45 });
    expect(screenFromScene({ x: -90, y: 45 }, c)).toStrictEqual({ x: 0, y: 0 });
  });

  it('divide screen distances by the zoom and multiply scene distances by it', () => {
    const c = camera(100, -200, 4);
    expect(sceneFromScreen({ x: 40, y: -80 }, c)).toStrictEqual({ x: 110, y: -220 });
    expect(screenFromScene({ x: 110, y: -220 }, c)).toStrictEqual({ x: 40, y: -80 });
    expect(screenFromScene({ x: 90, y: -190 }, camera(100, -200, 0.5))).toStrictEqual({
      x: -5,
      y: 5,
    });
  });

  it('property: screen to scene to screen is the identity, within 10⁻⁴ px', () => {
    checkProperty(
      { seed: 5101, runs: 500 },
      (random) => ({ camera: anyCamera(random, POSITION_LIMIT), point: anyScreenPoint(random) }),
      ({ camera: c, point }) => {
        expect(gap(screenFromScene(sceneFromScreen(point, c), c), point)).toBeLessThanOrEqual(1e-4);
      },
    );
  });
});

describe('the camera limits', () => {
  it('REQ-V08 are a zoom from 0.1 to 30 and a position within 10⁹ of the origin', () => {
    expect([MIN_ZOOM, MAX_ZOOM, POSITION_LIMIT]).toStrictEqual([0.1, 30, 1e9]);
  });

  it('REQ-V08 clampZoom keeps a zoom within 0.1 and 30', () => {
    expect([0.05, 0.1, 2.5, 30, 40, Infinity, -1].map(clampZoom)).toStrictEqual([
      0.1, 0.1, 2.5, 30, 30, 30, 0.1,
    ]);
  });

  it('REQ-V08 limitCamera clamps the zoom and each coordinate of the position', () => {
    const previous = camera(1, 2, 1);
    expect(limitCamera(camera(2e9, -3e9, 0.01), previous)).toStrictEqual(camera(1e9, -1e9, 0.1));
    expect(limitCamera(camera(-Infinity, Infinity, 1e6), previous)).toStrictEqual(
      camera(-1e9, 1e9, 30),
    );
    expect(limitCamera(camera(-1e9, 1e9, 30), previous)).toStrictEqual(camera(-1e9, 1e9, 30));
  });

  it.each([
    ['x', camera(Number.NaN, 0, 1)],
    ['y', camera(0, Number.NaN, 1)],
    ['zoom', camera(0, 0, Number.NaN)],
  ])('REQ-V08 limitCamera keeps the previous camera when %s is not a number', (_, next) => {
    const previous = Object.freeze(camera(5, 6, 2));
    const limited = limitCamera(next, previous);
    expect(limited).toStrictEqual(camera(5, 6, 2));
    expect(limited).not.toBe(previous);
  });

  it.each([
    ['x', camera(Number.NaN, 0, 1)],
    ['y', camera(0, Number.NaN, 1)],
    ['zoom', camera(0, 0, Number.NaN)],
  ])(
    'REQ-V08 limitCamera gives the default camera when the previous one holds NaN in %s too',
    (_, held) => {
      expect(DEFAULT_CAMERA).toStrictEqual(camera(0, 0, 1));
      const limited = limitCamera(camera(Number.NaN, Number.NaN, Number.NaN), held);
      expect(limited).toStrictEqual(camera(0, 0, 1));
      expect(limited).not.toBe(DEFAULT_CAMERA);
    },
  );

  it('REQ-V08 an operation on a camera that holds NaN returns the default camera', () => {
    const held = camera(Number.NaN, 4, 2);
    expect(panBy(held, { x: 10, y: 20 })).toStrictEqual(camera(0, 0, 1));
    expect(zoomAbout(held, { x: 1, y: 1 }, 2)).toStrictEqual(camera(0, 0, 1));
    expect(panBy(camera(3, 4, Number.NaN), { x: 0, y: 0 })).toStrictEqual(camera(0, 0, 1));
  });

  it('limitCamera returns a new camera even when nothing needed limiting', () => {
    const next = camera(5, 6, 2);
    expect(limitCamera(next, next)).not.toBe(next);
  });
});

describe('cameraShowing', () => {
  it('is the camera at a zoom that shows a scene point at a screen point', () => {
    expect(cameraShowing({ x: 840, y: 560 }, { x: 640, y: 360 }, 2)).toStrictEqual(
      camera(520, 380, 2),
    );
    const c = cameraShowing({ x: -7.5, y: 3 }, { x: 10, y: 20 }, 0.25);
    expect(screenFromScene({ x: -7.5, y: 3 }, c)).toStrictEqual({ x: 10, y: 20 });
  });
});
