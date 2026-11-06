import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import type { ElementDelta } from '../../../src/scene/delta.ts';
import { createOrderIndex } from '../../../src/scene/order-index.ts';
import { checkProperty } from '../../support/property.ts';
import { anySceneElement, anyStep, bruteOrder, sceneElementId } from '../../support/scenes.ts';

const noRefs = () => ({ elements: [], groups: [] });

/** A scene element with the given identifier and key. */
const keyed = (index: number, order: string): Element => ({
  ...anySceneElement(createRandom(index), sceneElementId(index), noRefs()),
  order: order as OrderKey,
});

/** Random steps over a scene that starts empty. */
function anySteps(random: Random, count: number): ElementDelta[][] {
  const elements = new Map<ElementId, Element>();
  let next = 0;
  const fresh = () => sceneElementId((next += 1));
  return Array.from({ length: count }, () => anyStep(random, elements, noRefs, fresh));
}

describe('the order index', () => {
  it('is empty at first', () => {
    expect(createOrderIndex().ids()).toStrictEqual([]);
  });

  it('REQ-K02 orders by key, then by identifier for equal keys', () => {
    const index = createOrderIndex();
    const elements = [keyed(3, 'V'), keyed(1, 'a'), keyed(2, 'V'), keyed(4, '1')];
    index.update(elements.map((after) => ({ id: after.id, before: undefined, after })));
    expect(index.ids()).toStrictEqual([4, 2, 3, 1].map(sceneElementId));
  });

  it('moves an element whose key changes, drops a removed one and keeps the rest in place', () => {
    const index = createOrderIndex();
    const [a, b, c] = [keyed(1, '1'), keyed(2, '2'), keyed(3, '3')] as const;
    index.update([a, b, c].map((after) => ({ id: after.id, before: undefined, after })));
    const first = index.ids();
    index.update([{ id: b.id, before: b, after: { ...b, x: b.x + 1 } }]);
    expect(index.ids()).toBe(first);
    index.update([
      { id: a.id, before: a, after: { ...a, order: '4' as OrderKey } },
      { id: c.id, before: c, after: undefined },
    ]);
    expect(index.ids()).toStrictEqual([b.id, a.id]);
  });

  it('agrees with sorting the whole scene after every random step', () => {
    checkProperty(
      { seed: 3201, runs: 60 },
      (random) => anySteps(random, 12),
      (steps) => {
        const index = createOrderIndex();
        const elements = new Map<ElementId, Element>();
        for (const step of steps) {
          index.update(step);
          for (const { id, after } of step) {
            if (after === undefined) elements.delete(id);
            else elements.set(id, after);
          }
          expect(index.ids()).toStrictEqual(bruteOrder(elements.values()));
        }
      },
    );
  });
});
