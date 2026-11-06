import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import type { ElementDelta } from '../../../src/scene/delta.ts';
import { CELL_SIZE, MAX_CELLS, createSpatialIndex } from '../../../src/scene/spatial-index.ts';
import { checkProperty } from '../../support/property.ts';
import {
  anyQueryBox,
  anyQueryPoint,
  anySceneElement,
  anyStep,
  bruteBox,
  brutePoint,
  sceneElementId,
  sortedIds,
} from '../../support/scenes.ts';

const noRefs = () => ({ elements: [], groups: [] });

/** An unrotated rectangle whose world bounds are exactly the given box (a stroke of 2). */
function rectangle(index: number, { x, y, width, height }: Aabb): Element {
  const { style } = anySceneElement(createRandom(index), sceneElementId(index), noRefs());
  return {
    id: sceneElementId(index),
    kind: 'rectangle',
    order: 'V' as OrderKey,
    x: x + 1,
    y: y + 1,
    width: width - 2,
    height: height - 2,
    rotation: 0,
    style: { ...style, stroke: { ...style.stroke, width: 2 } },
    locked: false,
    rev: 1,
  };
}

/** The box at `x, y` of the given size. */
const box = (x: number, y: number, width: number, height: number): Aabb => ({
  x,
  y,
  width,
  height,
});

const added = (...elements: Element[]): ElementDelta[] =>
  elements.map((after) => ({ id: after.id, before: undefined, after }));

/** Random steps over a scene that starts empty, each with the scene it leaves. */
function anyRun(random: Random) {
  const elements = new Map<ElementId, Element>();
  let next = 0;
  const fresh = () => sceneElementId((next += 1));
  return Array.from({ length: 10 }, () => {
    const step = anyStep(random, elements, noRefs, fresh);
    const boxes = Array.from({ length: 6 }, () => anyQueryBox(random));
    const points = Array.from({ length: 6 }, () => anyQueryPoint(random));
    return { step, scene: [...elements.values()], boxes, points };
  });
}

describe('the spatial index', () => {
  it('finds nothing when empty', () => {
    const index = createSpatialIndex();
    expect(index.queryBox({ x: -1e9, y: -1e9, width: 2e9, height: 2e9 })).toStrictEqual([]);
    expect(index.queryPoint({ x: 0, y: 0 }, 1e9)).toStrictEqual([]);
  });

  it('finds an element whose bounds meet the box, edges included', () => {
    const index = createSpatialIndex();
    const a = rectangle(1, box(0, 0, 100, 100));
    const b = rectangle(2, box(512, 512, 10, 10));
    index.update(added(a, b));
    expect(sortedIds(index.queryBox({ x: 100, y: 100, width: 0, height: 0 }))).toStrictEqual([
      a.id,
    ]);
    expect(sortedIds(index.queryBox({ x: 100, y: 100, width: 412, height: 412 }))).toStrictEqual([
      a.id,
      b.id,
    ]);
    expect(index.queryBox({ x: 100.5, y: 0, width: 411, height: 1_000 })).toStrictEqual([]);
    expect(index.queryBox({ x: -50, y: -50, width: 49.5, height: 49.5 })).toStrictEqual([]);
  });

  it('finds an element whose bounds are within the radius of a point', () => {
    const index = createSpatialIndex();
    const a = rectangle(1, box(0, 0, 100, 100));
    index.update(added(a));
    expect(index.queryPoint({ x: 50, y: 50 }, 0)).toStrictEqual([a.id]);
    expect(index.queryPoint({ x: 103, y: 104 }, 5)).toStrictEqual([a.id]);
    expect(index.queryPoint({ x: 103, y: 104 }, 4.99)).toStrictEqual([]);
    expect(index.queryPoint({ x: -1_000, y: 50 }, 899)).toStrictEqual([]);
  });

  it(`files bounds that touch up to ${String(MAX_CELLS)} cells in the grid, and larger ones apart`, () => {
    const index = createSpatialIndex();
    const side = 8 * CELL_SIZE - 1;
    const fits = rectangle(1, box(0, 0, side, side));
    const wide = rectangle(2, box(0, 0, side + 1, side));
    index.update(added(fits));
    expect(index.occupancy()).toStrictEqual({ cells: 64, large: 0 });
    index.update(added(wide));
    expect(index.occupancy()).toStrictEqual({ cells: 64, large: 1 });
    const far = { x: 5 * CELL_SIZE, y: 5 * CELL_SIZE, width: 0, height: 0 };
    expect(sortedIds(index.queryBox(far))).toStrictEqual([fits.id, wide.id]);
    expect(index.queryPoint({ x: side + 0.5, y: 10 }, 0)).toStrictEqual([wide.id]);
  });

  it('moves an element between cells and empties them when it is removed', () => {
    const index = createSpatialIndex();
    const a = rectangle(1, box(0, 0, 10, 10));
    const moved = rectangle(1, box(2_000, 2_000, 10, 10));
    index.update(added(a));
    index.update([{ id: a.id, before: a, after: moved }]);
    expect(index.queryBox({ x: 0, y: 0, width: 10, height: 10 })).toStrictEqual([]);
    expect(index.queryBox({ x: 2_000, y: 2_000, width: 0, height: 0 })).toStrictEqual([a.id]);
    expect(index.occupancy()).toStrictEqual({ cells: 1, large: 0 });
    index.update([
      { id: a.id, before: moved, after: { ...moved, style: { ...moved.style, opacity: 0.5 } } },
    ]);
    expect(index.occupancy()).toStrictEqual({ cells: 1, large: 0 });
    index.update([{ id: a.id, before: moved, after: undefined }]);
    expect(index.occupancy()).toStrictEqual({ cells: 0, large: 0 });
    expect(index.queryPoint({ x: 2_005, y: 2_005 }, 100)).toStrictEqual([]);
  });

  it.each([
    ['a negative width', { x: 0, y: 0, width: -1, height: 0 }],
    ['a negative height', { x: 0, y: 0, width: 0, height: -1 }],
    ['an infinite side', { x: 0, y: 0, width: Infinity, height: 0 }],
    ['a corner that is not a number', { x: Number.NaN, y: 0, width: 0, height: 0 }],
  ])('refuses a query box with %s', (_, box) => {
    expect(() => createSpatialIndex().queryBox(box)).toThrow(RangeError);
  });

  it.each([
    ['a negative radius', { x: 0, y: 0 }, -1],
    ['an infinite radius', { x: 0, y: 0 }, Infinity],
    ['a point that is not a number', { x: 0, y: Number.NaN }, 1],
  ])('refuses a point query with %s', (_, point, radius) => {
    expect(() => createSpatialIndex().queryPoint(point, radius)).toThrow(RangeError);
  });

  it('agrees with a brute-force scan of the world bounds over random scenes', () => {
    checkProperty({ seed: 3301, runs: 60 }, anyRun, (run) => {
      const index = createSpatialIndex();
      for (const { step, scene, boxes, points } of run) {
        index.update(step);
        for (const box of boxes) {
          expect(sortedIds(index.queryBox(box))).toStrictEqual(bruteBox(scene, box));
        }
        for (const { point, radius } of points) {
          expect(sortedIds(index.queryPoint(point, radius))).toStrictEqual(
            brutePoint(scene, point, radius),
          );
        }
      }
    });
  });
});
