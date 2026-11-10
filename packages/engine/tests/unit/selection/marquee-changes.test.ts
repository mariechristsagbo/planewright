import { describe, expect, it } from 'vitest';

import { aabbFromCorners } from '../../../src/math/aabb.ts';
import type { Element, ShapeElement } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { SceneReader } from '../../../src/scene/store.ts';
import { enclosedBy } from '../../../src/selection/marquee.ts';
import { bruteEnclosed } from '../../support/enclosure.ts';
import { freehandElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';
import { changeSet, color } from '../../support/scene-state.ts';
import { watched } from '../../support/watched-scene.ts';

// Box selection as a scene changes (REQ-S06), and what a query reads of the scene's elements.

const EVERYTHING = { x: -1e4, y: -1e4, width: 2e4, height: 2e4 };

const three = (): readonly [ShapeElement, ShapeElement, ShapeElement] => [
  shapeElement('rectangle', 10, 10, { id: 1, order: 'a', x: 0, y: 0 }),
  shapeElement('ellipse', 10, 10, { id: 2, order: 'b', x: 20, y: 0 }),
  shapeElement('diamond', 10, 10, { id: 3, order: 'c', x: 40, y: 0 }),
];

/** The element that the scene holds now. */
function held(scene: SceneReader, id: ElementId): Element {
  const element = scene.get(id);
  if (element === undefined) throw new Error(`The scene holds no ${id}.`);
  return element;
}

const move = (element: Element, x: number) =>
  changeSet([{ type: 'update', id: element.id, before: { x: element.x }, after: { x } }]);

describe('marquee queries as the scene changes', () => {
  it('never enclose a removed element, and enclose it again once it is back', () => {
    const [first, second, third] = three();
    const scene = sceneOf(...three());
    const gone = changeSet([{ type: 'remove', element: held(scene, testId(1)) }]);
    scene.apply(gone, 'local');
    expect(enclosedBy(scene, EVERYTHING)).toStrictEqual([testId(2), testId(3)]);
    scene.apply(changeSet([{ type: 'add', element: first }]), 'history');
    expect(enclosedBy(scene, EVERYTHING)).toStrictEqual([first.id, second.id, third.id]);
  });

  it('follow a new order key into the drawing order', () => {
    const scene = sceneOf(...three());
    const rekey = changeSet([
      { type: 'update', id: testId(1), before: { order: 'a' }, after: { order: 'd' } },
    ]);
    scene.apply(rekey, 'local');
    expect(enclosedBy(scene, EVERYTHING)).toStrictEqual([testId(2), testId(3), testId(1)]);
  });

  it('follow a preview out of the marquee and back', () => {
    const scene = sceneOf(...three());
    const box = { x: 0, y: 0, width: 50, height: 10 };
    const moved = move(held(scene, testId(3)), 41);
    scene.apply(moved, 'local', { transient: true });
    expect(enclosedBy(scene, box)).toStrictEqual([testId(1), testId(2)]);
    scene.apply(move(held(scene, testId(3)), 40), 'local', { transient: true });
    expect(enclosedBy(scene, box)).toStrictEqual([testId(1), testId(2), testId(3)]);
  });

  it('enclose the same whichever way the marquee is dragged', () => {
    const scene = sceneOf(...three());
    const from = { x: 31, y: 12 };
    const to = { x: -1, y: -2 };
    expect(enclosedBy(scene, aabbFromCorners(from, to))).toStrictEqual([testId(1), testId(2)]);
    expect(enclosedBy(scene, aabbFromCorners(to, from))).toStrictEqual([testId(1), testId(2)]);
  });

  it('refuse a marquee that the spatial index refuses, even over an empty scene', () => {
    for (const marquee of [
      { x: Number.NaN, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: Infinity, height: 1 },
      { x: 0, y: 0, width: -1, height: 1 },
    ]) {
      expect(() => enclosedBy(sceneOf(), marquee)).toThrow(
        /^A query box needs a finite corner and size, not /,
      );
    }
  });

  it('refuse such a marquee too while the scene keeps its rows', () => {
    const scene = sceneOf(...three());
    expect(enclosedBy(scene, EVERYTHING)).toHaveLength(3);
    expect(() => enclosedBy(scene, { x: 0, y: Number.NaN, width: 50, height: 10 })).toThrow(
      /^A query box needs a finite corner and size, not /,
    );
  });

  it('follow the ordered elements of a reader whose revision does not follow them', () => {
    const store = sceneOf(...three());
    // A copy keeps the revision that the store had when it was made, and reads the rest from it.
    const copy: SceneReader = { ...store };
    expect(enclosedBy(copy, EVERYTHING)).toHaveLength(3);
    store.apply(move(held(store, testId(2)), 50_000), 'local');
    expect(copy.rev).not.toBe(store.rev);
    expect(enclosedBy(copy, EVERYTHING)).toStrictEqual([testId(1), testId(3)]);
  });

  it('keep the spatial index’s rule that the world bounds meet the marquee', () => {
    // A stroke of 1e-300 grows the bounds of this one-point stroke at 0 to about ±5e-301, which
    // leaves out its point, normalised within the tolerance to 1e-9.
    const stroke = { color: color('#1e2430'), width: 1e-300, dash: 'solid' } as const;
    const dot = freehandElement([{ x: 1e-9, y: 1e-9 }], { id: 4, style: { stroke } });
    const scene = sceneOf(dot);
    expect(enclosedBy(scene, { x: 1e-9, y: 1e-9, width: 0, height: 0 })).toStrictEqual([]);
    expect(enclosedBy(scene, { x: 0, y: 0, width: 1e-9, height: 1e-9 })).toStrictEqual([dot.id]);
  });
});

/** Forty squares in a row, 10 units apart. */
const forty = () =>
  Array.from({ length: 40 }, (_, index) =>
    shapeElement('rectangle', 10, 10, { id: index + 1, order: 'a', x: 20 * index, y: 0 }),
  );

describe('what a marquee query reads', () => {
  it('reads no element of a scene that has not changed since the last query', () => {
    const { reader, reads } = watched(sceneOf(...three()));
    expect(enclosedBy(reader, EVERYTHING)).toStrictEqual([testId(1), testId(2), testId(3)]);
    expect([...reads.keys()].sort()).toStrictEqual([testId(1), testId(2), testId(3)]);
    reads.clear();
    expect(enclosedBy(reader, { x: 0, y: 0, width: 10, height: 10 })).toStrictEqual([testId(1)]);
    expect([...reads.keys()]).toStrictEqual([]);
  });

  it('reads only the elements that changed since the last query, for a marquee over many', () => {
    const store = sceneOf(...three());
    const { reader, reads } = watched(store);
    enclosedBy(reader, EVERYTHING);
    store.apply(move(held(store, testId(2)), 50_000), 'local');
    reads.clear();
    expect(enclosedBy(reader, EVERYTHING)).toStrictEqual([testId(1), testId(3)]);
    expect([...reads.keys()]).toStrictEqual([testId(2)]);
  });

  it('reads only the candidates of a marquee over few, after a change', () => {
    // A marquee over the first of forty squares meets one of them, under a sixteenth.
    const store = sceneOf(...forty());
    const { reader, reads } = watched(store);
    expect(enclosedBy(reader, EVERYTHING)).toHaveLength(40);
    store.apply(move(held(store, testId(30)), 50_000), 'local');
    reads.clear();
    expect(enclosedBy(reader, { x: -1, y: -1, width: 12, height: 12 })).toStrictEqual([testId(1)]);
    expect([...reads.keys()]).toStrictEqual([testId(1)]);
  });

  it('makes the rows again for a marquee that meets many but encloses few, after a change', () => {
    // A thin band across the forty squares meets each of them and encloses none.
    const store = sceneOf(...forty());
    const { reader, reads } = watched(store);
    expect(enclosedBy(reader, EVERYTHING)).toHaveLength(40);
    store.apply(move(held(store, testId(30)), 50_000), 'local');
    reads.clear();
    expect(enclosedBy(reader, { x: -1, y: 4, width: 800, height: 2 })).toStrictEqual([]);
    expect([...reads.keys()]).toStrictEqual([testId(30)]);
  });
});

/**
 * Three squares under one order key, loaded with the largest identifier first, which the spatial
 * index then lists first, and fifty more under the same key away from them.
 */
function tied(): Element[] {
  const ties = [3, 2, 1].map((id) =>
    shapeElement('rectangle', 10, 10, { id, order: 'a', x: 10, y: 10 }),
  );
  const others = Array.from({ length: 50 }, (_, index) =>
    shapeElement('rectangle', 10, 10, { id: index + 4, order: 'a', x: 2_000 + 20 * index, y: 0 }),
  );
  return [...ties, ...others];
}

/** A marquee around the three squares, which meets 3 of the 53 elements, under a sixteenth. */
const TIES = { x: 0, y: 0, width: 30, height: 30 };

describe('marquee queries among elements under one order key', () => {
  it('order the candidates of a marquee over few by identifier, as a scan does', () => {
    const elements = tied();
    const { reader, reads } = watched(sceneOf(...elements));
    expect(reader.queryBox(TIES)).toStrictEqual([testId(3), testId(2), testId(1)]);
    expect(enclosedBy(reader, TIES)).toStrictEqual([testId(1), testId(2), testId(3)]);
    expect(enclosedBy(reader, TIES)).toStrictEqual(bruteEnclosed(elements, TIES));
    expect([...reads.keys()].sort()).toStrictEqual([testId(1), testId(2), testId(3)]);
  });

  it('order them by identifier after a change too, while the rows made before it are kept', () => {
    const elements = tied();
    const store = sceneOf(...elements);
    const { reader, reads } = watched(store);
    expect(enclosedBy(reader, EVERYTHING)).toStrictEqual(bruteEnclosed(elements, EVERYTHING));
    store.apply(move(held(store, testId(4)), 5_000), 'local');
    reads.clear();
    expect(enclosedBy(reader, TIES)).toStrictEqual([testId(1), testId(2), testId(3)]);
    expect([...reads.keys()].sort()).toStrictEqual([testId(1), testId(2), testId(3)]);
  });
});
