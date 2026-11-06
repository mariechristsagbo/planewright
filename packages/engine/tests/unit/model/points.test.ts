import { describe, expect, it } from 'vitest';

import { TAU } from '../../../src/math/angle.ts';
import { randomBetween, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { add, rotateAbout } from '../../../src/math/vector.ts';
import type { Point } from '../../../src/model/elements.ts';
import { normalizePoints, pointExtent, pointsAreNormalized } from '../../../src/model/points.ts';
import type { PointGeometry } from '../../../src/model/points.ts';
import { checkProperty } from '../../support/property.ts';

/** Where a point of an element is in scene space: its local box turned about its centre. */
function scenePosition(element: PointGeometry, point: Point): Point {
  const xs = element.points.map(({ x }) => x);
  const ys = element.points.map(({ y }) => y);
  const center = {
    x: element.x + (Math.max(...xs) - Math.min(...xs)) / 2,
    y: element.y + (Math.max(...ys) - Math.min(...ys)) / 2,
  };
  return rotateAbout(add({ x: element.x, y: element.y }, point), center, element.rotation);
}

interface Edit {
  readonly before: PointGeometry;
  /** The edited points in the element's old frame; those at `kept` indexes did not move. */
  readonly points: readonly Point[];
  readonly kept: readonly number[];
}

/** A rotated point element within `reach` of the origin, and an edit of some of its points. */
function anyEdit(random: Random, reach: number): Edit {
  const raw = Array.from({ length: randomInt(random, 1, 12) }, () => ({
    x: randomBetween(random, 0, 5_000),
    y: randomBetween(random, 0, 5_000),
  }));
  const minX = Math.min(...raw.map(({ x }) => x));
  const minY = Math.min(...raw.map(({ y }) => y));
  const before: PointGeometry = {
    x: randomBetween(random, -reach, reach),
    y: randomBetween(random, -reach, reach),
    rotation: randomBetween(random, 0, TAU),
    points: raw.map(({ x, y }) => ({ x: x - minX, y: y - minY })),
  };
  const kept: number[] = [];
  const points = before.points.map((point, index) => {
    if (random.next() < 0.6) {
      kept.push(index);
      return point;
    }
    return {
      x: point.x + randomBetween(random, -3_000, 3_000),
      y: point.y + randomBetween(random, -3_000, 3_000),
    };
  });
  if (random.next() < 0.3) {
    points.push({
      x: randomBetween(random, -3_000, 8_000),
      y: randomBetween(random, -3_000, 8_000),
    });
  }
  return { before, points, kept };
}

function expectUnchangedPointsKept({ before, points, kept }: Edit): void {
  const after = { ...normalizePoints(before, points), rotation: before.rotation };
  for (const index of kept) {
    const was = scenePosition(before, before.points[index] ?? { x: Number.NaN, y: 0 });
    const is = scenePosition(after, after.points[index] ?? { x: Number.NaN, y: 0 });
    expect(Math.abs(is.x - was.x)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(is.y - was.y)).toBeLessThanOrEqual(1e-6);
  }
  expect(pointsAreNormalized(after.points)).toBe(true);
  expect(Math.min(...after.points.map(({ x }) => x))).toBe(0);
  expect(Math.min(...after.points.map(({ y }) => y))).toBe(0);
}

describe('normalizePoints', () => {
  it('moves the origin by the smallest point when the element is not rotated', () => {
    const before = {
      x: 100,
      y: 50,
      rotation: 0,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ],
    };
    expect(
      normalizePoints(before, [
        { x: -5, y: 3 },
        { x: 10, y: 20 },
      ]),
    ).toStrictEqual({
      x: 95,
      y: 53,
      points: [
        { x: 0, y: 0 },
        { x: 15, y: 17 },
      ],
    });
  });

  it('leaves normalised points and their origin as they are', () => {
    const before = {
      x: 7,
      y: -3,
      rotation: 1,
      points: [
        { x: 0, y: 4 },
        { x: 2, y: 0 },
      ],
    };
    expect(normalizePoints(before, before.points)).toStrictEqual({
      x: 7,
      y: -3,
      points: before.points,
    });
  });

  it('solves the origin of a rotated element whose size changed', () => {
    // Turned half a turn: the first point is drawn at (10, 0) and must stay there.
    const before = {
      x: 0,
      y: 0,
      rotation: Math.PI,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const after = normalizePoints(before, [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    expect(after.x).toBeCloseTo(-10, 12);
    expect(after.y).toBeCloseTo(0, 12);
    expect(after.points).toStrictEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('keeps every unchanged point of a rotated element at its scene position within 1e-6 units', () => {
    checkProperty(
      { seed: 0x9017, runs: 2_000 },
      (random) => anyEdit(random, 1e6),
      expectUnchangedPointsKept,
    );
  });

  it('keeps them there within 1e-6 units near the coordinate limit of 1e9 too', () => {
    checkProperty(
      { seed: 0x9018, runs: 2_000 },
      (random) => anyEdit(random, 1e9),
      expectUnchangedPointsKept,
    );
  });

  it('refuses an element or an edit without points', () => {
    const before = { x: 0, y: 0, rotation: 0, points: [{ x: 0, y: 0 }] };
    const message = new RangeError('A point element needs at least one point.');
    expect(() => normalizePoints(before, [])).toThrow(message);
    expect(() => normalizePoints({ ...before, points: [] }, before.points)).toThrow(message);
  });
});

describe('pointExtent', () => {
  it('is the size of the box around the points', () => {
    expect(
      pointExtent([
        { x: 0, y: 4 },
        { x: 3, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toStrictEqual({ width: 3, height: 4 });
    expect(pointExtent([{ x: 2, y: 2 }])).toStrictEqual({ width: 0, height: 0 });
  });
});

describe('pointsAreNormalized', () => {
  it.each([
    [
      [
        { x: 0, y: 5 },
        { x: 3, y: 0 },
      ],
      true,
    ],
    [[{ x: 1e-10, y: -1e-10 }], true],
    [[{ x: 1e-9, y: 0 }], true],
    [[{ x: 2e-9, y: 0 }], false],
    [[{ x: 0, y: -2e-9 }], false],
    [[{ x: 1, y: 1 }], false],
  ])('says whether the smallest x and y of %j are 0 within 1e-9: %s', (points, expected) => {
    expect(pointsAreNormalized(points)).toBe(expected);
  });
});
