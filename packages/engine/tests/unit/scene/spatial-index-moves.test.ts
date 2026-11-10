import { describe, expect, it } from 'vitest';

import type { Aabb } from '../../../src/math/aabb.ts';
import { toColor } from '../../../src/model/color.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import { CELL_SIZE, MAX_CELLS, createSpatialIndex } from '../../../src/scene/spatial-index.ts';
import type { SpatialIndex } from '../../../src/scene/spatial-index.ts';
import { sceneElementId } from '../../support/scenes.ts';

// Moves that keep an element in the cells it touches, and moves that change them by one side
// (issue 36): wherever the element goes, the index finds it under its new bounds and nowhere else,
// as a query that reads only the cells it touches would, and keeps no cell it no longer needs.

const ID = sceneElementId(1);

/** An unrotated rectangle whose world bounds are exactly the given box (a stroke of 2). */
const rectangle = ({ x, y, width, height }: Aabb): Element => ({
  id: ID,
  kind: 'rectangle',
  order: 'V' as OrderKey,
  x: x + 1,
  y: y + 1,
  width: width - 2,
  height: height - 2,
  rotation: 0,
  style: {
    stroke: { color: toColor('#1e2430'), width: 2, dash: 'solid' },
    fill: null,
    opacity: 1,
    corners: 'sharp',
    sketch: 0,
  },
  locked: false,
  rev: 1,
});

/** An index holding the rectangle at `from`, then at `to`. */
function moved(from: Aabb, to: Aabb): SpatialIndex {
  const index = createSpatialIndex();
  const before = rectangle(from);
  index.update([{ id: ID, before: undefined, after: before }]);
  index.update([{ id: ID, before, after: rectangle(to) }]);
  return index;
}

/** Whether a query of a zero-sized box at the point finds the element. */
const foundAt = (index: SpatialIndex, x: number, y: number): boolean =>
  index.queryBox({ x, y, width: 0, height: 0 }).includes(ID);

const C = CELL_SIZE;

describe('the spatial index, as an element moves', () => {
  it('finds an element that moved within its cells at its new bounds only', () => {
    const index = moved(
      { x: 10, y: 10, width: 100, height: 100 },
      { x: 11, y: 12, width: 100, height: 100 },
    );
    expect([foundAt(index, 10.5, 50), foundAt(index, 50, 11.5)]).toStrictEqual([false, false]);
    expect([
      foundAt(index, 110.5, 50),
      foundAt(index, 50, 111.5),
      foundAt(index, 11, 12),
    ]).toStrictEqual([true, true, true]);
    expect(index.queryPoint({ x: 112, y: 112 }, 1)).toStrictEqual([ID]);
    expect(index.occupancy()).toStrictEqual({ cells: 1, large: 0 });
  });

  it.each([
    [
      'its right side',
      { x: C - 20, y: 10, width: 10, height: 10 },
      { x: C - 5, y: 10, width: 10, height: 10 },
      [C + 2, 15],
    ],
    [
      'its bottom side',
      { x: 10, y: C - 20, width: 10, height: 10 },
      { x: 10, y: C - 5, width: 10, height: 10 },
      [15, C + 2],
    ],
    [
      'its left side',
      { x: C + 5, y: 10, width: 10, height: 10 },
      { x: C - 5, y: 10, width: 10, height: 10 },
      [C - 2, 15],
    ],
    [
      'its top side',
      { x: 10, y: C + 5, width: 10, height: 10 },
      { x: 10, y: C - 5, width: 10, height: 10 },
      [15, C - 2],
    ],
  ] as const)('finds an element whose %s moved into another cell', (_, from, to, [x, y]) => {
    const index = moved(from, to);
    expect(foundAt(index, x, y)).toBe(true);
    expect(index.occupancy()).toStrictEqual({ cells: 2, large: 0 });
  });

  it('keeps an element that moves while it touches too many cells apart, and files it once it fits', () => {
    const side = 8 * C;
    const index = moved(
      { x: 0, y: 0, width: side, height: side },
      { x: 1, y: 1, width: side, height: side },
    );
    expect(index.occupancy()).toStrictEqual({ cells: 0, large: 1 });
    expect([foundAt(index, 0.5, 0.5), foundAt(index, side + 0.5, side + 0.5)]).toStrictEqual([
      false,
      true,
    ]);
    const inside = rectangle({ x: 1, y: 1, width: side, height: side });
    index.update([
      { id: ID, before: inside, after: rectangle({ x: 1, y: 1, width: 10, height: 10 }) },
    ]);
    expect(index.occupancy()).toStrictEqual({ cells: 1, large: 0 });
    expect([foundAt(index, 5 * C, 5 * C), foundAt(index, 5, 5)]).toStrictEqual([false, true]);
    expect(MAX_CELLS).toBe(64);
  });
});
