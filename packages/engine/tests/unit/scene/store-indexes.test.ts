import { describe, expect, it } from 'vitest';

import type { Random } from '../../../src/math/random.ts';
import { decodeDocument } from '../../../src/model/decode.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import { encodeDocument } from '../../../src/model/encode.ts';
import type { ChangeOrigin, ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { anyEdit, anySceneLoad, applyToDocument } from '../../support/edits.ts';
import { checkProperty } from '../../support/property.ts';
import { color } from '../../support/scene-state.ts';
import {
  anyQueryBox,
  anyQueryPoint,
  bruteBox,
  bruteConnectors,
  bruteMembers,
  bruteOrder,
  bruteOutermost,
  brutePoint,
  pick,
  sortedIds,
} from '../../support/scenes.ts';

const CANVAS = { background: color('#ffffff') };
const EMPTY: DocumentState = { elements: new Map(), groups: new Map(), canvas: CANVAS, rev: 0 };

interface Step {
  readonly changes: ChangeSet;
  readonly origin: ChangeOrigin;
  readonly transient: boolean;
  /** What the scene holds afterwards, by the reference model. */
  readonly expected: DocumentState;
  readonly boxes: ReturnType<typeof anyQueryBox>[];
  readonly points: ReturnType<typeof anyQueryPoint>[];
}

/** A random scene loaded at once, then random valid change sets of every origin. */
function anyRun(random: Random): Step[] {
  let document = EMPTY;
  let next = 1_000;
  const fresh = () => (next += 1);
  return Array.from({ length: 12 }, (_, index) => {
    const changes = index === 0 ? anySceneLoad(random, 30) : anyEdit(random, document, fresh);
    document = applyToDocument(document, changes);
    return {
      changes,
      origin: index === 0 ? 'load' : pick(random, ['local', 'history', 'remote'] as const),
      transient: random.next() < 0.3,
      expected: document,
      boxes: Array.from({ length: 4 }, () => anyQueryBox(random)),
      points: Array.from({ length: 4 }, () => anyQueryPoint(random)),
    };
  });
}

/** Every query of the store agrees with a scan of the document it holds. */
function expectIndexesAgree(
  store: SceneStore,
  { elements, groups }: DocumentState,
  { boxes, points }: Step,
): void {
  const all = [...elements.values()];
  expect(store.ordered().map(({ id }) => id)).toStrictEqual(bruteOrder(all));
  for (const box of boxes) {
    expect(sortedIds(store.queryBox(box))).toStrictEqual(bruteBox(all, box));
  }
  for (const { point, radius } of points) {
    expect(sortedIds(store.queryPoint(point, radius))).toStrictEqual(
      brutePoint(all, point, radius),
    );
  }
  for (const element of all) {
    expect(store.outermostGroup(element.id)).toBe(bruteOutermost(groups, element));
    expect(sortedIds(store.connectorsOf(element.id))).toStrictEqual(
      bruteConnectors(all, element.id),
    );
  }
  for (const id of groups.keys()) {
    expect(sortedIds(store.members(id))).toStrictEqual(bruteMembers(all, groups, id));
  }
}

describe('the scene store over random change sets', () => {
  it(
    'keeps every index in agreement with a brute-force scan, and the document valid',
    { timeout: 30_000 },
    () => {
      checkProperty({ seed: 3601, runs: 30 }, anyRun, (run) => {
        const store = createSceneStore(CANVAS);
        const updates: SceneUpdate[] = [];
        store.subscribe((update) => {
          updates.push(update);
        });
        for (const step of run) {
          store.apply(step.changes, step.origin, { transient: step.transient });
          expect(updates.at(-1)).toMatchObject({
            origin: step.origin,
            transient: step.transient,
            rev: store.rev,
          });
          const document = store.document();
          expect(document).toStrictEqual(step.expected);
          expect(decodeDocument(encodeDocument(document)).ok).toBe(true);
          expectIndexesAgree(store, document, step);
        }
      });
    },
  );
});
