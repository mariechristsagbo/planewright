import { describe, expect, it } from 'vitest';

import { sceneFromScreen, screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { zoomToFit } from '../../../src/camera/fit.ts';
import { resetZoom, zoomIn, zoomOut } from '../../../src/camera/ladder.ts';
import { panBy, wheelPan } from '../../../src/camera/pan.ts';
import { twoPointerCamera } from '../../../src/camera/pinch.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';
import { wheelZoom } from '../../../src/camera/zoom.ts';
import type { Point } from '../../../src/model/elements.ts';

// The test vectors of docs/architecture/engine/scene-and-viewport.md#test-vectors-from-the-baseline:
// a 1280 × 720 viewport, cameras translated from the baseline with camera = −scroll. Positions
// must match within 0.5 scene units; zooms within the table's last digit.

const VIEWPORT: ViewportSize = { width: 1280, height: 720, pixelRatio: 1 };
const CENTRE: Point = { x: 640, y: 360 };

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

function expectNear(actual: number, expected: number, within: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(within);
}

function expectCamera(actual: Camera, expected: Partial<Camera>): void {
  if (expected.x !== undefined) expectNear(actual.x, expected.x, 0.5);
  if (expected.y !== undefined) expectNear(actual.y, expected.y, 0.5);
  if (expected.zoom !== undefined) expectNear(actual.zoom, expected.zoom, 0.0005);
}

describe('the camera test vectors from the baseline', () => {
  it('REQ-V01 a wheel deltaY of +200 at (0, 0, 1) gives (0, 200, 1)', () => {
    expectCamera(wheelPan(camera(0, 0, 1), { x: 0, y: 200 }, false), { x: 0, y: 200, zoom: 1 });
  });

  it('REQ-V01 a Shift+wheel deltaY of +200 at (0, 200, 1) gives (200, 200, 1)', () => {
    expectCamera(wheelPan(camera(0, 200, 1), { x: 0, y: 200 }, true), { x: 200, y: 200, zoom: 1 });
  });

  it('REQ-V04 a Mod+wheel deltaY of −100 at (640, 360) zooms (200, 200, 1) to 1.105 about the pointer', () => {
    const after = wheelZoom(camera(200, 200, 1), CENTRE, -100);
    expectCamera(after, { zoom: 1.105 });
    expect(after.zoom).toBeGreaterThanOrEqual(1.09);
    expect(after.zoom).toBeLessThanOrEqual(1.12);
    const under = sceneFromScreen(CENTRE, after);
    expectNear(under.x, 840, 0.5);
    expectNear(under.y, 560, 0.5);
    const shown = screenFromScene({ x: 840, y: 560 }, after);
    expectNear(shown.x, 640, 0.5);
    expectNear(shown.y, 360, 0.5);
  });

  it('REQ-V02 zooming in by keyboard at (200, 200, 1) gives (258.2, 232.7, 1.1)', () => {
    expectCamera(zoomIn(camera(200, 200, 1), VIEWPORT), { x: 258.2, y: 232.7, zoom: 1.1 });
  });

  it('REQ-V02 zooming out by keyboard twice at (258.2, 232.7, 1.1) gives (128.9, 160, 0.9)', () => {
    const after = zoomOut(zoomOut(camera(258.2, 232.7, 1.1), VIEWPORT), VIEWPORT);
    expectCamera(after, { x: 128.9, y: 160, zoom: 0.9 });
  });

  it('REQ-V02 resetting the zoom at (128.9, 160, 0.9) gives (200, 200, 1)', () => {
    expectCamera(resetZoom(camera(128.9, 160, 0.9), VIEWPORT), { x: 200, y: 200, zoom: 1 });
  });

  it.each([
    [0, 0],
    [-90, -45],
    [5000, -300],
  ])(
    'REQ-V09 zoom to fit of content spanning x 340–760 at (%d, %d, 1) gives x = −90, zoom 1',
    (x, y) => {
      const content = { x: 340, y: 200, width: 420, height: 300 };
      expectCamera(zoomToFit(camera(x, y, 1), content, VIEWPORT), { x: -90, zoom: 1 });
    },
  );

  it('REQ-V06 a Space+drag by (−100, −50) at (−90, −45, 1) gives (10, 5, 1)', () => {
    expectCamera(panBy(camera(-90, -45, 1), { x: -100, y: -50 }), { x: 10, y: 5, zoom: 1 });
  });

  it('REQ-V06 a Hand drag by (+50, +50) at (10, 5, 1) gives (−40, −45, 1)', () => {
    expectCamera(panBy(camera(10, 5, 1), { x: 50, y: 50 }), { x: -40, y: -45, zoom: 1 });
  });

  it('REQ-V07 two fingers going from 90 to 190 px apart at zoom 1 give zoom 2.111', () => {
    const from = [
      { x: 595, y: 360 },
      { x: 685, y: 360 },
    ] as const;
    const to = [
      { x: 545, y: 360 },
      { x: 735, y: 360 },
    ] as const;
    expectCamera(twoPointerCamera(camera(0, 0, 1), from, to), { zoom: 2.111 });
  });

  it('REQ-V07 two fingers moved 80 px up together at zoom 2.111 add 37.9 to y', () => {
    const start = camera(300, 170, 2.111);
    const from = [
      { x: 500, y: 400 },
      { x: 700, y: 420 },
    ] as const;
    const to = [
      { x: 500, y: 320 },
      { x: 700, y: 340 },
    ] as const;
    expectCamera(twoPointerCamera(start, from, to), { x: 300, y: 170 + 37.9, zoom: 2.111 });
  });

  it.each([
    [0.05, 0.1],
    [40, 30],
  ])('REQ-V08 a pinch to the distance ratio %s stops at zoom %s', (ratio, zoom) => {
    const from = [
      { x: 540, y: 360 },
      { x: 740, y: 360 },
    ] as const;
    const to = [
      { x: 640 - 100 * ratio, y: 360 },
      { x: 640 + 100 * ratio, y: 360 },
    ] as const;
    expect(twoPointerCamera(camera(0, 0, 1), from, to).zoom).toBe(zoom);
  });
});

describe('the camera test vectors as sessions', () => {
  it('REQ-V01 REQ-V02 follow the wheel and keyboard rows from (0, 0, 1) without rounding between them', () => {
    let current = wheelPan(camera(0, 0, 1), { x: 0, y: 200 }, false);
    current = wheelPan(current, { x: 0, y: 200 }, true);
    expectCamera(current, { x: 200, y: 200, zoom: 1 });
    current = zoomIn(current, VIEWPORT);
    expectCamera(current, { x: 258.2, y: 232.7, zoom: 1.1 });
    current = zoomOut(zoomOut(current, VIEWPORT), VIEWPORT);
    expectCamera(current, { x: 128.9, y: 160, zoom: 0.9 });
    expectCamera(resetZoom(current, VIEWPORT), { x: 200, y: 200, zoom: 1 });
  });

  it('REQ-V06 follow the Space+drag and Hand rows one after the other', () => {
    const start = camera(-90, -45, 1);
    const after = panBy(panBy(start, { x: -100, y: -50 }), { x: 50, y: 50 });
    expectCamera(after, { x: -40, y: -45, zoom: 1 });
  });
});
