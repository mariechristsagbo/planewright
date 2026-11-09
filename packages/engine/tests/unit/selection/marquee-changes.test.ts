import { describe, expect, it } from 'vitest';

import { aabbFromCorners } from '../../../src/math/aabb.ts';
import type { Element, ShapeElement } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { SceneReader } from '../../../src/scene/store.ts';
import { enclosedBy } from '../../../src/selection/marquee.ts';
import { freehandElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';
import { changeSet, color } from '../../support/scene-state.ts';

// Box selection as a scene changes (REQ-S06).

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
