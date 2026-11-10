import { describe, expect, it } from 'vitest';

import { localBox, worldBounds } from '../../../src/geometry/world-bounds.ts';
import { TAU } from '../../../src/math/angle.ts';
import { aabbExpand } from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { createRandom } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { obbBounds } from '../../../src/math/obb.ts';
import type { Element } from '../../../src/model/elements.ts';
import { LIMITS } from '../../../src/model/limits.ts';
import { anyDocument } from '../../support/documents.ts';
import { anyMixedScene } from '../../support/mixed-sets.ts';
import { perfElements } from '../../support/perf-scenes.ts';
import { checkProperty } from '../../support/property.ts';
import { pick } from '../../support/scenes.ts';

// World bounds as the spatial index files them (issue 36): the bounds of the turned local box,
// grown by half the stroke, exactly as the composition of `localBox`, `obbBounds` and `aabbExpand`
// computes them, to the bit and to the sign of a zero, for every kind, size, place and turn.

/** The world bounds as the geometry's own functions compose them, a point for every corner. */
function composed(element: Element): Aabb {
  const box = localBox(element);
  const turned = element.rotation === 0 ? box : obbBounds({ ...box, rotation: element.rotation });
  return aabbExpand(turned, element.style.stroke.width / 2);
}

/** Whether two boxes hold the same four numbers, -0 and 0 told apart. */
function expectSameBox(actual: Aabb, expected: Aabb): void {
  const sides = (box: Aabb) => [box.x, box.y, box.width, box.height];
  const expectedSides = sides(expected);
  expect(sides(actual).map((side, at) => Object.is(side, expectedSides[at]))).toStrictEqual([
    true,
    true,
    true,
    true,
  ]);
}

const TURNS = [0, 1e-300, 5e-324, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, TAU - 1e-15, 1, 6.2];

/** The element moved, turned, sized and stroked to one of the awkward values. */
function awkward(random: Random, element: Element): Element {
  const at = (values: readonly number[]) => pick(random, values);
  const place = [-0, 0, 0.1, -LIMITS.coordinate, LIMITS.coordinate, 1e-300, 123456.789];
  const size = [0, -0, 1e-300, LIMITS.size, 0.3];
  const stroke = [Number.MIN_VALUE, 1e-12, 2, LIMITS.strokeWidth];
  const sized = 'width' in element ? { width: at(size), height: at(size) } : {};
  return {
    ...element,
    ...sized,
    x: at(place),
    y: at(place),
    rotation: at(TURNS),
    style: { ...element.style, stroke: { ...element.style.stroke, width: at(stroke) } },
  };
}

describe('world bounds', () => {
  it('are the composed bounds of every element of the benchmarks’ scene', () => {
    for (const element of perfElements({
      seed: 15,
      count: 10_000,
      area: { x: 0, y: 0, width: 8_000, height: 4_500 },
    })) {
      expectSameBox(worldBounds(element), composed(element));
    }
  });

  it('are the composed bounds of random documents’ elements', () => {
    checkProperty({ seed: 3665, runs: 200 }, anyDocument, (document) => {
      for (const element of document.elements.values()) {
        expectSameBox(worldBounds(element), composed(element));
      }
    });
  });

  it('are the composed bounds at awkward places, sizes, turns and strokes', () => {
    const elements = [...anyMixedScene(createRandom(3666), 200, false).elements.values()];
    checkProperty(
      { seed: 3666, runs: 3_000 },
      (random) => awkward(random, pick(random, elements)),
      (element) => {
        expectSameBox(worldBounds(element), composed(element));
      },
    );
  });
});
