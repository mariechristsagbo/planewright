import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import { panBy, wheelPan } from '../../../src/camera/pan.ts';

const camera = (x: number, y: number, zoom: number): Camera => ({ x, y, zoom });

describe('panBy', () => {
  it('REQ-V06 moves the camera against the drag, so the content follows the pointer exactly', () => {
    expect(panBy(camera(0, 0, 1), { x: 30, y: -40 })).toStrictEqual(camera(-30, 40, 1));
    expect(panBy(camera(10, 20, 4), { x: 8, y: 2 })).toStrictEqual(camera(8, 19.5, 4));
    expect(panBy(camera(10, 20, 0.5), { x: 8, y: 2 })).toStrictEqual(camera(-6, 16, 0.5));
  });

  it('REQ-V08 stops at the position limit and ignores a delta that is not a number', () => {
    expect(panBy(camera(-999_999_990, 0, 1), { x: 20, y: 0 })).toStrictEqual(camera(-1e9, 0, 1));
    expect(panBy(camera(1, 2, 3), { x: Number.NaN, y: 0 })).toStrictEqual(camera(1, 2, 3));
  });
});

describe('wheelPan', () => {
  it('REQ-V01 pans vertically by the delta in screen pixels, 1:1 at zoom 1', () => {
    expect(wheelPan(camera(0, 0, 1), { x: 0, y: 120 }, false)).toStrictEqual(camera(0, 120, 1));
    expect(wheelPan(camera(0, 0, 1), { x: 0, y: -53 }, false)).toStrictEqual(camera(0, -53, 1));
  });

  it('REQ-V01 divides the delta by the zoom', () => {
    expect(wheelPan(camera(5, 5, 2), { x: 0, y: 100 }, false)).toStrictEqual(camera(5, 55, 2));
    expect(wheelPan(camera(5, 5, 0.25), { x: 0, y: 100 }, false)).toStrictEqual(
      camera(5, 405, 0.25),
    );
  });

  it('REQ-V01 pans horizontally by a horizontal delta, so a trackpad pans both ways at once', () => {
    expect(wheelPan(camera(0, 0, 1), { x: 30, y: 0 }, false)).toStrictEqual(camera(30, 0, 1));
    expect(wheelPan(camera(0, 0, 2), { x: 30, y: -10 }, false)).toStrictEqual(camera(15, -5, 2));
  });

  it('REQ-V01 pans horizontally with Shift, whichever axis the browser reports the delta on', () => {
    expect(wheelPan(camera(0, 0, 1), { x: 0, y: 200 }, true)).toStrictEqual(camera(200, 0, 1));
    expect(wheelPan(camera(0, 0, 1), { x: 200, y: 0 }, true)).toStrictEqual(camera(200, 0, 1));
    expect(wheelPan(camera(0, 0, 4), { x: 0, y: -100 }, true)).toStrictEqual(camera(-25, 0, 4));
  });

  it('REQ-V08 stops at the position limit and ignores a delta that is not a number', () => {
    expect(wheelPan(camera(0, 999_999_999, 1), { x: 0, y: 5 }, false)).toStrictEqual(
      camera(0, 1e9, 1),
    );
    expect(wheelPan(camera(0, 0, 1), { x: 0, y: -Infinity }, false)).toStrictEqual(
      camera(0, -1e9, 1),
    );
    expect(wheelPan(camera(7, 8, 1), { x: Number.NaN, y: 4 }, true)).toStrictEqual(camera(7, 8, 1));
  });
});
