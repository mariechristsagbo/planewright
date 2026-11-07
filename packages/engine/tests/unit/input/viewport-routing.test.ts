import { describe, expect, it } from 'vitest';

import { sceneFromScreen } from '../../../src/camera/camera.ts';
import { cameraForWheel, createViewportRouter } from '../../../src/input/viewport-routing.ts';
import { wheelEvent } from '../../support/inputs.ts';

// Viewport routing (docs/architecture/engine/interaction.md#gesture-recogniser): every wheel event
// and every camera gesture reaches the camera rules, whatever the tool. The cameras are the B-36
// test vectors of docs/architecture/engine/scene-and-viewport.md#test-vectors-from-the-baseline.

const NONE = { shift: false, alt: false, mod: false };

describe('wheel events', () => {
  it('REQ-V01 a wheel pans vertically by its delta at zoom 1', () => {
    const camera = cameraForWheel(
      { x: 0, y: 0, zoom: 1 },
      wheelEvent({ x: 5, y: 5 }, { x: 0, y: 200 }),
    );
    expect(camera).toEqual({ x: 0, y: 200, zoom: 1 });
  });

  it('REQ-V01 Shift+wheel pans horizontally', () => {
    const wheel = wheelEvent({ x: 5, y: 5 }, { x: 0, y: 200 }, { shift: true });
    expect(cameraForWheel({ x: 0, y: 200, zoom: 1 }, wheel)).toEqual({ x: 200, y: 200, zoom: 1 });
  });

  it('REQ-V04 a zoom wheel zooms about the pointer, which keeps its scene point', () => {
    const start = { x: 200, y: 200, zoom: 1 };
    const at = { x: 640, y: 360 };
    const camera = cameraForWheel(start, wheelEvent(at, { x: 0, y: -100 }, { zoom: true }));
    expect(camera.zoom).toBeGreaterThanOrEqual(1.09);
    expect(camera.zoom).toBeLessThanOrEqual(1.12);
    const held = sceneFromScreen(at, camera);
    expect(held.x).toBeCloseTo(840, 9);
    expect(held.y).toBeCloseTo(560, 9);
  });
});

describe('camera gestures', () => {
  it('REQ-V06 a camera drag pans by exactly the pointer delta', () => {
    const router = createViewportRouter();
    const camera = router.gesture(
      { x: -90, y: -45, zoom: 1 },
      { type: 'pan', delta: { x: -100, y: -50 } },
    );
    expect(camera).toEqual({ x: 10, y: 5, zoom: 1 });
  });

  it('REQ-V07 a pinch zooms by the distance ratio from the camera at its start', () => {
    const router = createViewportRouter();
    const start = { x: 0, y: 0, zoom: 1 };
    const from = [
      { x: 500, y: 300 },
      { x: 590, y: 300 },
    ] as const;
    expect(router.gesture(start, { type: 'pinch-start', from })).toBe(start);
    const moved = router.gesture(
      { x: 99, y: 99, zoom: 5 },
      {
        type: 'pinch',
        from,
        to: [
          { x: 450, y: 300 },
          { x: 640, y: 300 },
        ],
      },
    );
    expect(moved?.zoom).toBeCloseTo(190 / 90, 9);
    expect(sceneFromScreen({ x: 545, y: 300 }, moved ?? start)).toEqual({ x: 545, y: 300 });
  });

  it('REQ-V07 two fingers moved 80 px up together pan by 80 screen px', () => {
    const router = createViewportRouter();
    const start = { x: 10, y: 20, zoom: 190 / 90 };
    const from = [
      { x: 450, y: 300 },
      { x: 640, y: 300 },
    ] as const;
    router.gesture(start, { type: 'pinch-start', from });
    const to = [
      { x: 450, y: 220 },
      { x: 640, y: 220 },
    ] as const;
    const camera = router.gesture(start, { type: 'pinch', from, to });
    expect(camera?.y).toBeCloseTo(20 + 37.9, 1);
    expect(camera?.zoom).toBeCloseTo(190 / 90, 9);
  });

  it('pinches from the current camera when no start was reported', () => {
    const from = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ] as const;
    const to = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ] as const;
    const camera = createViewportRouter().gesture(
      { x: 10, y: 0, zoom: 1 },
      { type: 'pinch', from, to },
    );
    expect(camera).toEqual({ x: 10, y: 0, zoom: 2 });
  });

  it.each([
    { type: 'press', at: { x: 0, y: 0 }, pointer: 'mouse', modifiers: NONE },
    { type: 'tap', at: { x: 0, y: 0 }, pointer: 'touch', modifiers: NONE },
    { type: 'long-press', at: { x: 0, y: 0 }, pointer: 'touch' },
    { type: 'cancel' },
  ] as const)('leaves a $type to the tool', (gesture) => {
    expect(createViewportRouter().gesture({ x: 0, y: 0, zoom: 1 }, gesture)).toBeNull();
  });
});
