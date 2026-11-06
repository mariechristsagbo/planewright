import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { ArrowElement, Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import { createAttachmentIndex } from '../../../src/scene/attachment-index.ts';
import { checkProperty } from '../../support/property.ts';
import {
  anySceneElement,
  anyStep,
  bruteConnectors,
  sceneElementId,
  sortedIds,
} from '../../support/scenes.ts';

const e = sceneElementId;

/** An arrow whose ends are attached to the given targets, where given. */
function arrow(index: number, start?: number, end?: number): ArrowElement {
  const { style } = anySceneElement(createRandom(index), e(index), { elements: [], groups: [] });
  const attach = (target: number) => ({ target: e(target), anchor: { x: 0, y: 0.5 } });
  return {
    id: e(index),
    kind: 'arrow',
    order: 'V' as OrderKey,
    x: 0,
    y: 0,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    rotation: 0,
    style,
    locked: false,
    heads: { start: 'none', end: 'arrow' },
    route: 'straight',
    rev: 1,
    ...(start === undefined ? {} : { start: attach(start) }),
    ...(end === undefined ? {} : { end: attach(end) }),
  };
}

/** Random steps over elements that attach arrows to the elements already there. */
function anyRun(random: Random) {
  const elements = new Map<ElementId, Element>();
  let next = 0;
  const fresh = () => e((next += 1));
  const refs = (ids: readonly ElementId[]) => ({ elements: ids, groups: [] });
  return Array.from({ length: 10 }, () => anyStep(random, elements, refs, fresh));
}

describe('the attachment index', () => {
  it('lists the connectors attached to a target, once each', () => {
    const index = createAttachmentIndex();
    const arrows = [arrow(1, 10, 11), arrow(2, 10, 10), arrow(3, undefined, 11), arrow(4)];
    index.update(arrows.map((after) => ({ id: after.id, before: undefined, after })));
    expect(sortedIds(index.connectorsOf(e(10)))).toStrictEqual([e(1), e(2)]);
    expect(sortedIds(index.connectorsOf(e(11)))).toStrictEqual([e(1), e(3)]);
    expect(index.connectorsOf(e(4))).toStrictEqual([]);
  });

  it('follows a connector whose ends move, and forgets one that leaves', () => {
    const index = createAttachmentIndex();
    const first = arrow(1, 10, 11);
    const moved = arrow(1, 12);
    index.update([{ id: first.id, before: undefined, after: first }]);
    index.update([{ id: first.id, before: first, after: moved }]);
    expect(index.connectorsOf(e(10))).toStrictEqual([]);
    expect(index.connectorsOf(e(11))).toStrictEqual([]);
    expect(index.connectorsOf(e(12))).toStrictEqual([e(1)]);
    index.update([{ id: first.id, before: moved, after: undefined }]);
    expect(index.connectorsOf(e(12))).toStrictEqual([]);
  });

  it('agrees with a scan of every arrow over random scenes', () => {
    checkProperty({ seed: 3501, runs: 60 }, anyRun, (steps) => {
      const index = createAttachmentIndex();
      const elements = new Map<ElementId, Element>();
      const seen = new Set<ElementId>();
      for (const step of steps) {
        index.update(step);
        for (const { id, after } of step) {
          seen.add(id);
          if (after === undefined) elements.delete(id);
          else elements.set(id, after);
        }
        for (const id of seen) {
          expect(sortedIds(index.connectorsOf(id))).toStrictEqual(
            bruteConnectors(elements.values(), id),
          );
        }
      }
    });
  });
});
