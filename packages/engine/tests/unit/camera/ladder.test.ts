import { describe, expect, it } from 'vitest';

import { sceneFromScreen } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import {
  ZOOM_LADDER,
  nextZoomLevel,
  resetZoom,
  zoomIn,
  zoomOut,
} from '../../../src/camera/ladder.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });
const VIEWPORT: ViewportSize = { width: 1000, height: 600, pixelRatio: 2 };
const CENTRE = { x: 500, y: 300 };

const LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 30];

describe('the zoom ladder', () => {
  it('REQ-V03 is the fixed list of levels from 0.1 to 30', () => {
    expect(ZOOM_LADDER).toStrictEqual(LEVELS);
  });

  it('REQ-V03 is walked level by level in, then out, and stays at its ends', () => {
    const inward = [0.1];
    for (let step = 0; step < 18; step += 1) inward.push(nextZoomLevel(inward.at(-1) ?? 0, 'in'));
    expect(inward).toStrictEqual([...LEVELS, 30]);
    const outward = [30];
    for (let step = 0; step < 18; step += 1)
      outward.push(nextZoomLevel(outward.at(-1) ?? 0, 'out'));
    expect(outward).toStrictEqual([...LEVELS].reverse().concat(0.1));
  });

  it.each([
    [1.05, 1.1, 1],
    [0.3, 0.5, 0.25],
    [29, 30, 24],
    [0.11, 0.25, 0.1],
    [40, 30, 30],
    [0.05, 0.1, 0.1],
  ])('REQ-V03 goes from %s, off the ladder, to %s in and %s out', (zoom, inward, outward) => {
    expect(nextZoomLevel(zoom, 'in')).toBe(inward);
    expect(nextZoomLevel(zoom, 'out')).toBe(outward);
  });

  it('REQ-V03 skips a level that the zoom equals but for rounding', () => {
    expect(nextZoomLevel(1.0999999999999999, 'in')).toBe(1.25);
    expect(nextZoomLevel(1.1000000000000003, 'out')).toBe(1);
    expect(nextZoomLevel(0.9000000000000001, 'out')).toBe(0.75);
  });
});

describe('keyboard zoom', () => {
  it('REQ-V02 goes one step in from 100 % to 110 % about the viewport centre', () => {
    const start = camera(10, 20, 1);
    const after = zoomIn(start, VIEWPORT);
    expect(after.zoom).toBe(1.1);
    expect(sceneFromScreen(CENTRE, after).x).toBeCloseTo(sceneFromScreen(CENTRE, start).x, 9);
    expect(sceneFromScreen(CENTRE, after).y).toBeCloseTo(sceneFromScreen(CENTRE, start).y, 9);
  });

  it('REQ-V02 goes two steps out from 110 % to 90 % about the viewport centre', () => {
    const start = camera(-300, 40, 1.1);
    const after = zoomOut(zoomOut(start, VIEWPORT), VIEWPORT);
    expect(after.zoom).toBe(0.9);
    expect(sceneFromScreen(CENTRE, after).x).toBeCloseTo(sceneFromScreen(CENTRE, start).x, 9);
    expect(sceneFromScreen(CENTRE, after).y).toBeCloseTo(sceneFromScreen(CENTRE, start).y, 9);
  });

  it('REQ-V02 resets to 100 % about the viewport centre from any zoom', () => {
    for (const zoom of [0.1, 0.9, 2.37, 30]) {
      const start = camera(55, -66, zoom);
      const after = resetZoom(start, VIEWPORT);
      expect(after.zoom).toBe(1);
      expect(sceneFromScreen(CENTRE, after).x).toBeCloseTo(sceneFromScreen(CENTRE, start).x, 9);
      expect(sceneFromScreen(CENTRE, after).y).toBeCloseTo(sceneFromScreen(CENTRE, start).y, 9);
    }
  });

  it('REQ-V08 leaves the camera where it is at the ends of the ladder', () => {
    expect(zoomIn(camera(1, 2, 30), VIEWPORT)).toStrictEqual(camera(1, 2, 30));
    expect(zoomOut(camera(1, 2, 0.1), VIEWPORT)).toStrictEqual(camera(1, 2, 0.1));
  });
});
