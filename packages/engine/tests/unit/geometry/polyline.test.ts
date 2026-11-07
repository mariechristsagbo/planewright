import { describe, expect, it } from 'vitest';

import type { PathCommand } from '../../../src/geometry/path.ts';
import { FREEHAND, LINE } from '../../../src/geometry/polyline.ts';
import { freehandElement, lineElement } from '../../support/elements.ts';

/** The path with every number rounded to 10⁻⁹, so that thirds compare exactly. */
const rounded = (path: readonly PathCommand[]): unknown =>
  JSON.parse(
    JSON.stringify(path, (_key, value: unknown) =>
      typeof value === 'number' ? Math.round(value * 1e9) / 1e9 + 0 : value,
    ),
  );

const corner = lineElement([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
]);

describe('the line geometry', () => {
  it('outlines the polyline through its points, open', () => {
    expect(LINE.outline(corner)).toStrictEqual([
      { op: 'move', to: { x: 0, y: 0 } },
      { op: 'line', to: { x: 100, y: 0 } },
      { op: 'line', to: { x: 100, y: 50 } },
    ]);
    expect(LINE.isClosed(corner)).toBe(false);
  });

  it('measures the unsigned distance to the nearest of its segments', () => {
    expect(LINE.distance(corner, { x: 50, y: 4 })).toBe(4);
    expect(LINE.distance(corner, { x: 50, y: -4 })).toBe(4);
    expect(LINE.distance(corner, { x: 104, y: 25 })).toBe(4);
    expect(LINE.distance(corner, { x: 96, y: 25 })).toBe(4);
    expect(LINE.distance(corner, { x: -3, y: -4 })).toBe(5);
    expect(LINE.distance(corner, { x: 110, y: 60 })).toBeCloseTo(Math.hypot(10, 10), 12);
  });
});

describe('the freehand geometry', () => {
  it('measures a one-point stroke as the distance to its point', () => {
    const dot = freehandElement([{ x: 0, y: 0 }]);
    expect(FREEHAND.distance(dot, { x: 3, y: 4 })).toBe(5);
    expect(FREEHAND.isClosed(dot)).toBe(false);
    expect(FREEHAND.outline(dot)).toStrictEqual([
      { op: 'move', to: { x: 0, y: 0 } },
      { op: 'line', to: { x: 0, y: 0 } },
    ]);
  });

  it('measures a longer stroke as the distance to the polyline through its points', () => {
    const stroke = freehandElement([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
    ]);
    expect(FREEHAND.distance(stroke, { x: 15, y: 3 })).toBe(3);
    expect(FREEHAND.distance(stroke, { x: 33, y: 15 })).toBe(3);
  });

  it('smooths its outline by quadratic curves through the midpoints, drawn as cubics', () => {
    const stroke = freehandElement([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
      { x: 0, y: 30 },
    ]);
    expect(rounded(FREEHAND.outline(stroke))).toStrictEqual([
      { op: 'move', to: { x: 0, y: 0 } },
      { op: 'cubic', c1: { x: 20, y: 0 }, c2: { x: 30, y: 5 }, to: { x: 30, y: 15 } },
      { op: 'cubic', c1: { x: 30, y: 25 }, c2: { x: 25, y: 30 }, to: { x: 15, y: 30 } },
      { op: 'line', to: { x: 0, y: 30 } },
    ]);
    const two = freehandElement([
      { x: 0, y: 0 },
      { x: 8, y: 6 },
    ]);
    expect(FREEHAND.outline(two)).toStrictEqual([
      { op: 'move', to: { x: 0, y: 0 } },
      { op: 'line', to: { x: 8, y: 6 } },
    ]);
  });

  it('has no outline and is never near when it has no point, which no valid document holds', () => {
    const empty = freehandElement([]);
    expect(FREEHAND.outline(empty)).toStrictEqual([]);
    expect(FREEHAND.distance(empty, { x: 0, y: 0 })).toBe(Infinity);
  });
});
