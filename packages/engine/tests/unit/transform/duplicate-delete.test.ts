import { describe, expect, it } from 'vitest';

import type { ArrowElement, Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import { compareDrawingOrder } from '../../../src/model/order-key.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { deletionOf } from '../../../src/transform/delete.ts';
import { DUPLICATE_OFFSET, duplicatesOf } from '../../../src/transform/duplicate.ts';
import { lineElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';
import { groupId } from '../../support/fixtures.ts';
import { AUTHOR, changeSet, color } from '../../support/scene-state.ts';
import { ELLIPSE, RECTANGLE, SMALL, selectionElements } from '../../support/selection-scene.ts';

// Duplicate and delete (docs/architecture/engine/interaction.md#transforms): the copies and the
// complete change set that removes a selection.

const counter = () => {
  let count = 100;
  return (): ElementId => testId((count += 1));
};

describe('duplicating', () => {
  it('REQ-T08 copies with new identifiers, offset by +10, +10, in the selection’s order', () => {
    const scene = sceneOf(...selectionElements());
    const copies = duplicatesOf(scene, [ELLIPSE, RECTANGLE], counter());
    const original = (id: ElementId) => scene.get(id);
    expect(DUPLICATE_OFFSET).toEqual({ x: 10, y: 10 });
    expect(copies.map(({ id, x, y }) => [id, x, y])).toEqual([
      [testId(101), 410, 110],
      [testId(102), 110, 110],
    ]);
    expect(copies[0]).toEqual({
      ...original(ELLIPSE),
      id: testId(101),
      order: copies[0]?.order,
      x: 410,
      y: 110,
    });
  });

  it('REQ-T08 orders each copy just above its original, the topmost included', () => {
    const scene = sceneOf(...selectionElements());
    const copies = duplicatesOf(scene, [RECTANGLE, ELLIPSE, SMALL], counter());
    const ordered = [...scene.ordered(), ...copies].sort(compareDrawingOrder).map(({ id }) => id);
    expect(ordered.slice(0, 4)).toEqual([RECTANGLE, testId(101), ELLIPSE, testId(102)]);
    expect(ordered.slice(-2)).toEqual([SMALL, testId(103)]);
  });
});

const G1 = groupId(1) as GroupId;
const G2 = groupId(2) as GroupId;
const G3 = groupId(3) as GroupId;

/** A in G1 with B; C in G2, which is in G3 with D; an arrow from A to C. */
function groupedScene() {
  const box = (id: number, group: GroupId): Element => ({
    ...shapeElement('rectangle', 10, 10, { id, order: `a${String(id)}`, x: id * 20 }),
    group,
  });
  const arrow: ArrowElement = {
    ...lineElement(
      [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
      ],
      { id: 5, order: 'a5' },
    ),
    kind: 'arrow',
    start: { target: testId(1), anchor: { x: 1, y: 0.5 } },
    end: { target: testId(3), anchor: { x: 0, y: 0.5 } },
    heads: { start: 'none', end: 'arrow' },
    route: 'straight',
  };
  const elements = [box(1, G1), box(2, G1), box(3, G2), box(4, G3), arrow];
  const groups = [{ id: G3 }, { id: G2, parent: G3 }, { id: G1 }];
  const scene = createSceneStore({ background: color('#ffffff') });
  scene.apply(
    changeSet(
      elements.map((element) => ({ type: 'add', element })),
      groups.map((group) => ({ type: 'add', group })),
    ),
    'load',
  );
  return { scene, arrow };
}

describe('deleting', () => {
  it('REQ-T09 removes the elements and drops the attachments that pointed at them', () => {
    const { scene, arrow } = groupedScene();
    const deletion = deletionOf(scene, [testId(1)]);
    expect(deletion).toEqual({
      elements: [
        { type: 'remove', element: scene.get(testId(1)) },
        { type: 'update', id: testId(5), before: { start: arrow.start }, after: { start: null } },
      ],
      groups: [],
    });
    expect(() => {
      scene.apply({ ...deletion, author: AUTHOR, seq: 2 }, 'local');
    }).not.toThrow();
  });

  it('REQ-T09 removes the groups that it leaves empty, nested ones included, and no others', () => {
    const { scene } = groupedScene();
    expect(deletionOf(scene, [testId(1), testId(2)]).groups).toEqual([
      { type: 'remove', group: { id: G1 } },
    ]);
    expect(deletionOf(scene, [testId(3)]).groups).toEqual([
      { type: 'remove', group: { id: G2, parent: G3 } },
    ]);
    const both = deletionOf(scene, [testId(3), testId(4)]);
    expect(both.groups).toEqual([
      { type: 'remove', group: { id: G2, parent: G3 } },
      { type: 'remove', group: { id: G3 } },
    ]);
    expect(() => {
      scene.apply({ ...both, author: AUTHOR, seq: 2 }, 'local');
    }).not.toThrow();
  });

  it('REQ-T09 changes nothing for elements that the scene no longer holds', () => {
    const { scene } = groupedScene();
    expect(deletionOf(scene, [testId(9)])).toEqual({ elements: [], groups: [] });
  });
});
