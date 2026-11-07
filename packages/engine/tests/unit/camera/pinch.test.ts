import { describe, expect, it } from 'vitest';

import { sceneFromScreen, screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import { twoPointerCamera } from '../../../src/camera/pinch.ts';
import type { PointerPair } from '../../../src/camera/pinch.ts';
import { distance, midpoint } from '../../../src/math/vector.ts';
import { anyCamera, anyScreenPoint, gap } from '../../support/cameras.ts';
import { checkProperty } from '../../support/property.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });
const pair = (ax: number, ay: number, bx: number, by: number): PointerPair => [
  { x: ax, y: ay },
  { x: bx, y: by },
];

describe('twoPointerCamera', () => {
  it('REQ-V07 zooms by the ratio of the current distance to the start distance', () => {
    const after = twoPointerCamera(
      camera(0, 0, 2),
      pair(100, 100, 200, 100),
      pair(75, 100, 225, 100),
    );
    expect(after.zoom).toBe(3);
  });

  it('REQ-V07 keeps the scene point under the start midpoint under the current midpoint', () => {
    const start = camera(40, -20, 1.5);
    const from = pair(100, 200, 300, 260);
    const to = pair(420, 80, 700, 200);
    const after = twoPointerCamera(start, from, to);
    const held = sceneFromScreen(midpoint(...from), start);
    expect(gap(screenFromScene(held, after), midpoint(...to))).toBeLessThanOrEqual(1e-9);
  });

  it('REQ-V07 pans by the midpoint delta, divided by the zoom, when the pointers move together', () => {
    const after = twoPointerCamera(camera(10, 10, 4), pair(0, 0, 100, 0), pair(40, -80, 140, -80));
    expect(after).toStrictEqual(camera(0, 30, 4));
  });

  it('changes nothing while the pointers stay where they started', () => {
    const start = camera(-3.25, 8.5, 0.5);
    const pointers = pair(10, 20, 30, 50);
    expect(twoPointerCamera(start, pointers, pointers)).toStrictEqual(start);
  });

  it('does not depend on which pointer comes first', () => {
    const start = camera(5, 6, 1.2);
    const from = pair(10, 20, 300, 40);
    const to = pair(50, 60, 500, 90);
    const swapped = twoPointerCamera(start, [from[1], from[0]], [to[1], to[0]]);
    expect(swapped).toStrictEqual(twoPointerCamera(start, from, to));
  });

  it('only pans when the two pointers started at one point', () => {
    const after = twoPointerCamera(camera(0, 0, 2), pair(50, 50, 50, 50), pair(10, 50, 110, 50));
    expect(after).toStrictEqual(camera(-5, 0, 2));
  });

  it('REQ-V08 stops at the zoom limits and ignores pointers that are not numbers', () => {
    const from = pair(0, 0, 100, 0);
    expect(twoPointerCamera(camera(0, 0, 1), from, pair(0, 0, 0, 0)).zoom).toBe(0.1);
    expect(twoPointerCamera(camera(0, 0, 20), from, pair(0, 0, 200, 0)).zoom).toBe(30);
    expect(twoPointerCamera(camera(1, 2, 3), from, pair(0, Number.NaN, 100, 0))).toStrictEqual(
      camera(1, 2, 3),
    );
  });

  it('REQ-V07 property: zoom is the distance ratio and the midpoint holds, within 10⁻⁴ px', () => {
    checkProperty(
      { seed: 5106, runs: 400 },
      (random) => ({
        camera: anyCamera(random, 1e6),
        from: [anyScreenPoint(random), anyScreenPoint(random)] as const,
        to: [anyScreenPoint(random), anyScreenPoint(random)] as const,
      }),
      ({ camera: start, from, to }) => {
        const after = twoPointerCamera(start, from, to);
        const ratio = distance(...to) / distance(...from);
        expect(after.zoom).toBe(Math.min(30, Math.max(0.1, start.zoom * ratio)));
        const held = sceneFromScreen(midpoint(...from), start);
        expect(gap(screenFromScene(held, after), midpoint(...to))).toBeLessThanOrEqual(1e-4);
      },
    );
  });
});
