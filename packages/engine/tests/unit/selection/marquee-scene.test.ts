import { describe, expect, it } from 'vitest';

import { contentBounds } from '../../../src/geometry/world-bounds.ts';
import { aabbExpand } from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ChangeOrigin, ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { enclosedBy } from '../../../src/selection/marquee.ts';
import { anyEdit, applyToDocument } from '../../support/edits.ts';
import {
  anyEnclosureElement,
  boundsAndOutline,
  bruteEnclosed,
  nextDown,
  nextUp,
} from '../../support/enclosure.ts';
import { marqueeSweep } from '../../support/perf-bench.ts';
import { checkProperty } from '../../support/property.ts';
import { AUTHOR, color } from '../../support/scene-state.ts';
import { anyQueryBox, chance, pick, sceneElementId } from '../../support/scenes.ts';

// Box selection over whole scenes (REQ-S06): every query agrees with a scan of every element of
// the document, by a reference model of the changes, that knows nothing of how the query keeps
// what it computed between queries.

const CANVAS = { background: color('#ffffff') };
const EMPTY: DocumentState = { elements: new Map(), groups: new Map(), canvas: CANVAS, rev: 0 };

/** Up to `max` awkward elements of every kind, as one `load` change set. */
function anyLoad(random: Random, max: number): ChangeSet {
  const count = randomInt(random, 0, max);
  const elements = Array.from({ length: count }, (_, index) =>
    anyEnclosureElement(random, sceneElementId(index)),
  );
  return {
    elements: elements.map((element) => ({ type: 'add', element })),
    groups: [],
    author: AUTHOR,
    seq: 0,
  };
}

/** A marquee on an element's outline or bounds exactly, or with an edge moved by one double. */
function anyEdgeBox(random: Random, elements: readonly Element[]): Aabb {
  if (elements.length === 0) return anyQueryBox(random);
  const edges = boundsAndOutline(pick(random, elements)).slice(chance(random, 0.7) ? 4 : 0);
  const [left = 0, top = 0, right = 0, bottom = 0] = edges.map((value) =>
    chance(random, 0.7) ? value : pick(random, [nextUp, nextDown])(value),
  );
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Marquees from one corner of everything drawn to the far one, as B6 drags them, and on edges. */
function anyMarquees(random: Random, elements: readonly Element[]): Aabb[] {
  const area = aabbExpand(contentBounds(elements) ?? { x: 0, y: 0, width: 0, height: 0 }, 1);
  return [
    ...marqueeSweep(area, randomInt(random, 1, 12)),
    ...Array.from({ length: 6 }, () => anyEdgeBox(random, elements)),
    anyQueryBox(random),
  ];
}

interface Step {
  readonly changes: ChangeSet;
  readonly origin: ChangeOrigin;
  readonly transient: boolean;
  readonly marquees: readonly Aabb[];
  /** The document's elements afterwards, by the reference model. */
  readonly elements: readonly Element[];
}

/** A random scene, then random moves, turns, resizes, re-keys, additions and removals. */
function anyRun(random: Random): Step[] {
  let document = EMPTY;
  let next = 1_000;
  const fresh = () => (next += 1);
  return Array.from({ length: 10 }, (_, index) => {
    const changes = index === 0 ? anyLoad(random, 30) : anyEdit(random, document, fresh);
    document = applyToDocument(document, changes);
    const elements = [...document.elements.values()];
    return {
      changes,
      origin: index === 0 ? 'load' : pick(random, ['local', 'history', 'remote'] as const),
      transient: index > 0 && chance(random, 0.3),
      marquees: chance(random, 0.3) ? [] : anyMarquees(random, elements),
      elements,
    };
  });
}

describe('marquee queries over whole scenes', () => {
  it('REQ-S06 enclose what a scan of every element encloses, in order, from a small box to all', () => {
    const anyScene = (random: Random) => {
      const changes = anyLoad(random, 40);
      const elements = [...applyToDocument(EMPTY, changes).elements.values()];
      return { changes, elements, marquees: anyMarquees(random, elements) };
    };
    checkProperty({ seed: 3502, runs: 250 }, anyScene, ({ changes, elements, marquees }) => {
      const scene = createSceneStore(CANVAS);
      scene.apply(changes, 'load');
      for (const marquee of marquees) {
        expect(enclosedBy(scene, marquee)).toStrictEqual(bruteEnclosed(elements, marquee));
      }
    });
  });

  it('follow every change of the scene, previews included, between queries', () => {
    checkProperty({ seed: 3503, runs: 120 }, anyRun, (steps) => {
      const scene = createSceneStore(CANVAS);
      for (const { changes, origin, transient, marquees, elements } of steps) {
        scene.apply(changes, origin, { transient });
        for (const marquee of marquees) {
          expect(enclosedBy(scene, marquee)).toStrictEqual(bruteEnclosed(elements, marquee));
        }
      }
    });
  });
});
