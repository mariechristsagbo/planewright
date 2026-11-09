import { describe, expect, it } from 'vitest';

import { geometryOf } from '../../../src/geometry/kinds.ts';
import type { Element } from '../../../src/model/elements.ts';
import { enclosureRow } from '../../../src/selection/marquee-rows.ts';
import type { EnclosureRow } from '../../../src/selection/marquee-rows.ts';
import { anyEnclosureElement, boundsAndOutline } from '../../support/enclosure.ts';
import { freehandElement, lineElement, shapeElement } from '../../support/elements.ts';
import { BENCH_SCENE, benchElements } from '../../support/perf-bench.ts';
import { checkProperty } from '../../support/property.ts';
import { color } from '../../support/scene-state.ts';
import { sceneElementId } from '../../support/scenes.ts';

const numbersOf = (row: EnclosureRow): number[] => [
  row.boundsLeft,
  row.boundsTop,
  row.boundsRight,
  row.boundsBottom,
  row.left,
  row.top,
  row.right,
  row.bottom,
];

/**
 * Where a row differs from the world bounds and the outline points it stands for. Numbers compare
 * with `===`, as the marquee compares them, so +0 and -0 are alike.
 */
function differences(element: Element): number[] {
  const expected = boundsAndOutline(element);
  return numbersOf(enclosureRow(element)).flatMap((value, index) =>
    value === expected[index] ? [] : [index],
  );
}

describe('enclosure rows', () => {
  it('REQ-S06 hold the world bounds and outline extent of every kind, number for number', () => {
    const anyElement = (random: Parameters<typeof anyEnclosureElement>[0]) =>
      anyEnclosureElement(random, sceneElementId(0));
    checkProperty({ seed: 3501, runs: 3_000 }, anyElement, (element) => {
      expect(differences(element)).toStrictEqual([]);
      expect(enclosureRow(element).id).toBe(element.id);
      expect(enclosureRow(element).enclosable).toBe(geometryOf(element) !== undefined);
    });
  });

  it('hold the same numbers for every element of the benchmarks scene', () => {
    const elements = benchElements();
    expect(elements).toHaveLength(BENCH_SCENE.count);
    expect(elements.filter((element) => differences(element).length > 0)).toStrictEqual([]);
  });

  it('move an unrotated corner by the origin only, so that it stays where it lies', () => {
    // Turned about its centre by 0, this box's left corners would land at 10.299999999999997.
    const row = enclosureRow(shapeElement('rectangle', 120, 100, { x: 10.3, y: 180.3 }));
    expect([row.left, row.top, row.right, row.bottom]).toStrictEqual([
      10.3,
      180.3,
      10.3 + 120,
      180.3 + 100,
    ]);
    expect(row.boundsLeft).toBe(9.3);
  });

  it('take a point kind’s outline from its points, not from its box’s corners', () => {
    const corner = lineElement(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      { rotation: Math.PI / 4 },
    );
    const row = enclosureRow(corner);
    expect(differences(corner)).toStrictEqual([]);
    // Turned by 45° about (50, 50), the leftmost points lie at x = 50, while the box's corner
    // (0, 100) turns to x = 50 - 50√2, which the bounds hold, grown by half the 2-unit stroke.
    expect(row.left).toBeCloseTo(50, 9);
    expect(row.boundsLeft).toBeCloseTo(50 - 50 * Math.SQRT2 - 1, 9);
  });

  it('keep points normalised only within the tolerance where they are', () => {
    const above = freehandElement([{ x: 5e-10, y: -5e-10 }], { x: 3, y: 4 });
    const row = enclosureRow(above);
    expect([row.left, row.top, row.right, row.bottom]).toStrictEqual([
      3 + 5e-10,
      4 - 5e-10,
      3 + 5e-10,
      4 - 5e-10,
    ]);
    expect(differences(above)).toStrictEqual([]);
  });

  it('grow the bounds by half of a stroke too thin to move them, and by nothing more', () => {
    const thin = shapeElement('ellipse', 0, 0, {
      x: 1e9,
      y: -1e9,
      style: { stroke: { color: color('#1e2430'), width: Number.MIN_VALUE, dash: 'solid' } },
    });
    expect(numbersOf(enclosureRow(thin))).toStrictEqual([
      1e9, -1e9, 1e9, -1e9, 1e9, -1e9, 1e9, -1e9,
    ]);
  });
});
