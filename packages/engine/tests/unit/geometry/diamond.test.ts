import { describe, expect, it } from 'vitest';

import { DIAMOND } from '../../../src/geometry/diamond.ts';
import type { PathCommand } from '../../../src/geometry/path.ts';
import { shapeElement } from '../../support/elements.ts';

/** The path with every number rounded to 10⁻⁹, so that thirds compare exactly. */
const rounded = (path: readonly PathCommand[]): unknown =>
  JSON.parse(
    JSON.stringify(path, (_key, value: unknown) =>
      typeof value === 'number' ? Math.round(value * 1e9) / 1e9 + 0 : value,
    ),
  );

// A 60 by 80 diamond has sides of 50 units, and its round corners a radius of 15.
const sharp = shapeElement('diamond', 60, 80);
const round = shapeElement('diamond', 60, 80, { style: { corners: 'round' } });

describe('the diamond geometry', () => {
  it('outlines a sharp diamond through the midpoints of its box sides', () => {
    expect(DIAMOND.outline(sharp)).toStrictEqual([
      { op: 'move', to: { x: 30, y: 0 } },
      { op: 'line', to: { x: 60, y: 40 } },
      { op: 'line', to: { x: 30, y: 80 } },
      { op: 'line', to: { x: 0, y: 40 } },
      { op: 'close' },
    ]);
    expect(DIAMOND.isClosed(sharp)).toBe(true);
  });

  it('cuts round corners the corner radius along each side and joins the cuts by curves', () => {
    expect(rounded(DIAMOND.outline(round))).toStrictEqual([
      { op: 'move', to: { x: 39, y: 12 } },
      { op: 'line', to: { x: 51, y: 28 } },
      { op: 'cubic', c1: { x: 57, y: 36 }, c2: { x: 57, y: 44 }, to: { x: 51, y: 52 } },
      { op: 'line', to: { x: 39, y: 68 } },
      { op: 'cubic', c1: { x: 33, y: 76 }, c2: { x: 27, y: 76 }, to: { x: 21, y: 68 } },
      { op: 'line', to: { x: 9, y: 52 } },
      { op: 'cubic', c1: { x: 3, y: 44 }, c2: { x: 3, y: 36 }, to: { x: 9, y: 28 } },
      { op: 'line', to: { x: 21, y: 12 } },
      { op: 'cubic', c1: { x: 27, y: 4 }, c2: { x: 33, y: 4 }, to: { x: 39, y: 12 } },
      { op: 'close' },
    ]);
  });

  it('measures the signed distance to its four edges, negative inside', () => {
    expect(DIAMOND.distance(sharp, { x: 30, y: 40 })).toBe(-24);
    expect(DIAMOND.distance(sharp, { x: 30, y: 10 })).toBeCloseTo(-6, 12);
    expect(DIAMOND.distance(sharp, { x: 45, y: 20 })).toBe(0);
    expect(DIAMOND.distance(sharp, { x: 48.2, y: 17.6 })).toBeCloseTo(4, 12);
    expect(DIAMOND.distance(sharp, { x: 75, y: 40 })).toBe(15);
    expect(DIAMOND.distance(round, { x: 30, y: 40 })).toBe(-24);
  });

  it('has no inside when it has no width', () => {
    const flat = shapeElement('diamond', 0, 80);
    expect(DIAMOND.distance(flat, { x: 0, y: 40 })).toBe(0);
    expect(DIAMOND.distance(flat, { x: 3, y: 40 })).toBe(3);
  });
});
