import { describe, expect, it } from 'vitest';

import { sceneFromScreen, screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import {
  WHEEL_ZOOM_MAX_DELTA,
  WHEEL_ZOOM_SCALE,
  wheelZoom,
  wheelZoomFactor,
  zoomAbout,
} from '../../../src/camera/zoom.ts';
import { randomBetween } from '../../../src/math/random.ts';
import { anyCamera, anyScreenPoint, gap } from '../../support/cameras.ts';
import { checkProperty } from '../../support/property.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

/** How far, in screen pixels, the scene point that was under `anchor` before has moved after. */
const drift = (before: Camera, after: Camera, anchor: { x: number; y: number }): number =>
  gap(screenFromScene(sceneFromScreen(anchor, before), after), anchor);

describe('zoomAbout', () => {
  it('REQ-V02 changes the zoom and keeps the scene point under the anchor', () => {
    const after = zoomAbout(camera(200, 200, 1), { x: 640, y: 360 }, 2);
    expect(after).toStrictEqual(camera(520, 380, 2));
    expect(sceneFromScreen({ x: 640, y: 360 }, after)).toStrictEqual({ x: 840, y: 560 });
  });

  it('REQ-V08 clamps the zoom to [0.1, 30] first and still keeps the anchor', () => {
    const start = camera(10, -10, 1);
    const anchor = { x: 300, y: 100 };
    const high = zoomAbout(start, anchor, 50);
    expect(high.zoom).toBe(30);
    expect(drift(start, high, anchor)).toBeLessThanOrEqual(1e-9);
    const low = zoomAbout(start, anchor, 0.01);
    expect(low.zoom).toBe(0.1);
    expect(drift(start, low, anchor)).toBeLessThanOrEqual(1e-9);
  });

  it('REQ-V08 stops at the position limit and ignores a zoom that is not a number', () => {
    expect(zoomAbout(camera(1e9, 0, 1), { x: 5000, y: 0 }, 30).x).toBe(1e9);
    expect(zoomAbout(camera(3, 4, 2), { x: 1, y: 1 }, Number.NaN)).toStrictEqual(camera(3, 4, 2));
  });

  it('property: zooming about a point keeps it, within 10⁻⁴ px, at any zoom asked', () => {
    checkProperty(
      { seed: 5102, runs: 500 },
      (random) => ({
        camera: anyCamera(random, 1e6),
        anchor: anyScreenPoint(random),
        zoom: Math.exp(randomBetween(random, Math.log(0.05), Math.log(40))),
      }),
      ({ camera: start, anchor, zoom }) => {
        const after = zoomAbout(start, anchor, zoom);
        expect(after.zoom).toBe(Math.min(30, Math.max(0.1, zoom)));
        expect(drift(start, after, anchor)).toBeLessThanOrEqual(1e-4);
      },
    );
  });
});

describe('the wheel zoom curve', () => {
  it('REQ-V04 is a factor of exp(−deltaY / 1000) per event, with deltaY clamped to ±200', () => {
    expect([WHEEL_ZOOM_SCALE, WHEEL_ZOOM_MAX_DELTA]).toStrictEqual([1000, 200]);
    expect(wheelZoomFactor(0)).toBe(1);
    expect(wheelZoomFactor(-100)).toBe(Math.exp(0.1));
    expect(wheelZoomFactor(50)).toBe(Math.exp(-0.05));
    expect(wheelZoomFactor(200)).toBe(Math.exp(-0.2));
    expect(wheelZoomFactor(5000)).toBe(Math.exp(-0.2));
    expect(wheelZoomFactor(-Infinity)).toBe(Math.exp(0.2));
  });

  it('REQ-V04 zooms in by 1.105 for a step of −100, where the baseline zoomed by 1.1', () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.105, 3);
  });

  it('REQ-V04 is one continuous curve: small deltas add up to the zoom of their sum', () => {
    const anchor = { x: 400, y: 250 };
    let small = camera(0, 0, 1);
    for (let step = 0; step < 10; step += 1) small = wheelZoom(small, anchor, -12);
    const large = wheelZoom(camera(0, 0, 1), anchor, -120);
    expect(small.zoom).toBeCloseTo(large.zoom, 12);
    expect(small.x).toBeCloseTo(large.x, 9);
    expect(small.y).toBeCloseTo(large.y, 9);
  });
});

describe('wheelZoom', () => {
  it('REQ-V04 zooms about the pointer, not the viewport centre', () => {
    const start = camera(100, 50, 2);
    const pointer = { x: 30, y: 600 };
    const after = wheelZoom(start, pointer, -100);
    expect(after.zoom).toBe(2 * Math.exp(0.1));
    expect(drift(start, after, pointer)).toBeLessThanOrEqual(1e-9);
  });

  it('REQ-V08 stops at the zoom limits and ignores a delta that is not a number', () => {
    expect(wheelZoom(camera(0, 0, 29.9), { x: 0, y: 0 }, -200).zoom).toBe(30);
    expect(wheelZoom(camera(0, 0, 0.101), { x: 0, y: 0 }, 200).zoom).toBe(0.1);
    expect(wheelZoom(camera(1, 2, 3), { x: 0, y: 0 }, Number.NaN)).toStrictEqual(camera(1, 2, 3));
  });

  it('REQ-V04 property: the scene point under the pointer stays within 0.5 px of it', () => {
    checkProperty(
      { seed: 5103, runs: 300 },
      (random) => ({
        camera: anyCamera(random, 1e6),
        pointer: anyScreenPoint(random),
        deltaY: randomBetween(random, -400, 400),
      }),
      ({ camera: start, pointer, deltaY }) => {
        const after = wheelZoom(start, pointer, deltaY);
        const clamped = Math.min(200, Math.max(-200, deltaY));
        expect(after.zoom).toBeCloseTo(
          Math.min(30, Math.max(0.1, start.zoom * Math.exp(-clamped / 1000))),
          12,
        );
        expect(drift(start, after, pointer)).toBeLessThanOrEqual(0.5);
      },
    );
  });
});
