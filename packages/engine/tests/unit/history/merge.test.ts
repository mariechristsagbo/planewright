import { describe, expect, it } from 'vitest';

import { mergeChangeSets } from '../../../src/history/merge.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { GroupId } from '../../../src/model/ids.ts';
import type { ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { anyEdit, anySceneLoad, applyToDocument } from '../../support/edits.ts';
import { fixtureDocument, groupId } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';
import { changeSet, color, contentOf } from '../../support/scene-state.ts';
import { fixtureId } from '../../support/stores.ts';

const e = fixtureId;
const g = (index: number) => groupId(index) as GroupId;
const [WHITE, GREY, DARK] = [
  { background: color('#ffffff') },
  { background: color('#808080') },
  { background: color('#202020') },
] as const;

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};
const shape = (): Element => ({ ...fixture(3), id: e(20) });
const update = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ElementChange => ({
  type: 'update',
  id: e(2),
  before,
  after,
});
const merged = (older: readonly ElementChange[], newer: readonly ElementChange[]) =>
  mergeChangeSets(changeSet(older), changeSet(newer))?.elements;

describe('merging the change sets of one burst', () => {
  it('REQ-T10 merges two updates of an element into the older before and the newer after', () => {
    expect(
      merged([update({ x: 200 }, { x: 210 })], [update({ x: 210, y: -100 }, { x: 220, y: 5 })]),
    ).toStrictEqual([update({ x: 200, y: -100 }, { x: 220, y: 5 })]);
  });

  it('drops a field, and then a change, that ends where it began', () => {
    expect(
      merged([update({ x: 200, y: -100 }, { x: 210, y: 0 })], [update({ x: 210 }, { x: 200 })]),
    ).toStrictEqual([update({ y: -100 }, { y: 0 })]);
    expect(
      merged([update({ x: 200 }, { x: 210 })], [update({ x: 210 }, { x: 200 })]),
    ).toStrictEqual([]);
  });

  it('keeps the changes of other elements and groups, the older set’s first, and the newer stamp', () => {
    const older = changeSet([update({ x: 200 }, { x: 1 })]);
    const newer = {
      ...changeSet(
        [{ type: 'update', id: e(3), before: { y: 0 }, after: { y: 1 } }],
        [{ type: 'add', group: { id: g(5) } }],
      ),
      seq: 9,
    };
    expect(mergeChangeSets(older, newer)).toStrictEqual({
      ...newer,
      elements: [...older.elements, ...newer.elements],
    });
  });

  it('adds, as it ends, an element that the older set added and the newer one updated', () => {
    const added = shape();
    expect(
      merged(
        [{ type: 'add', element: added }],
        [{ type: 'update', id: e(20), before: { x: 300 }, after: { x: 5 } }],
      ),
    ).toStrictEqual([{ type: 'add', element: { ...added, x: 5, rev: added.rev + 1 } }]);
  });

  it('drops an element that the older set added and the newer one removed', () => {
    const added = shape();
    expect(
      merged(
        [{ type: 'add', element: added }],
        [{ type: 'remove', element: { ...added, rev: 9 } }],
      ),
    ).toStrictEqual([]);
  });

  it('removes, as it was first, an element that the older set updated and the newer one removed', () => {
    const element = fixture(2);
    expect(
      merged(
        [update({ x: 200 }, { x: 210 })],
        [{ type: 'remove', element: { ...element, x: 210, rev: 2 } }],
      ),
    ).toStrictEqual([{ type: 'remove', element: { ...element, rev: 2 } }]);
  });

  it('drops a group that one set added and the other removed, in either order', () => {
    const group = { id: g(5), parent: g(0) };
    for (const [first, second] of [
      ['add', 'remove'],
      ['remove', 'add'],
    ] as const) {
      expect(
        mergeChangeSets(
          changeSet([], [{ type: first, group }]),
          changeSet([], [{ type: second, group }]),
        )?.groups,
      ).toStrictEqual([]);
    }
  });

  it('merges canvas changes into the older before and the newer after, or drops them when they end where they began', () => {
    const once = changeSet([], [], { before: WHITE, after: GREY });
    expect(
      mergeChangeSets(once, changeSet([], [], { before: GREY, after: DARK }))?.canvas,
    ).toStrictEqual({ before: WHITE, after: DARK });
    expect(
      mergeChangeSets(once, changeSet([], [], { before: GREY, after: WHITE })),
    ).not.toHaveProperty('canvas');
    expect(mergeChangeSets(changeSet([]), once)?.canvas).toBe(once.canvas);
  });
});

describe('change sets that do not merge', () => {
  it('are the parts that do not follow each other, as when another origin changed a field between them', () => {
    const added = shape();
    const element = fixture(2);
    expect(
      merged([update({ x: 200 }, { x: 210 })], [update({ x: 999 }, { x: 220 })]),
    ).toBeUndefined();
    expect(
      merged(
        [{ type: 'add', element: added }],
        [{ type: 'update', id: e(20), before: { x: 1 }, after: { x: 2 } }],
      ),
    ).toBeUndefined();
    expect(
      merged([{ type: 'add', element: added }], [{ type: 'remove', element: { ...added, x: 1 } }]),
    ).toBeUndefined();
    expect(merged([update({ x: 200 }, { x: 210 })], [{ type: 'remove', element }])).toBeUndefined();
    const canvas = changeSet([], [], { before: WHITE, after: GREY });
    expect(
      mergeChangeSets(canvas, changeSet([], [], { before: WHITE, after: GREY })),
    ).toBeUndefined();
  });

  it('are the parts that no single change can express, or that could not follow each other', () => {
    const added = shape();
    const add: ElementChange = { type: 'add', element: added };
    const remove: ElementChange = { type: 'remove', element: added };
    const change: ElementChange = {
      type: 'update',
      id: e(20),
      before: { x: 300 },
      after: { x: 5 },
    };
    const pairs: readonly (readonly [ElementChange, ElementChange])[] = [
      [remove, add],
      [change, add],
      [remove, change],
      [add, add],
      [remove, remove],
    ];
    for (const [older, newer] of pairs) {
      expect(merged([older], [newer])).toBeUndefined();
    }
    const group = { id: g(5) };
    expect(
      mergeChangeSets(
        changeSet([], [{ type: 'add', group }]),
        changeSet([], [{ type: 'add', group }]),
      ),
    ).toBeUndefined();
    expect(
      mergeChangeSets(
        changeSet([], [{ type: 'remove', group }]),
        changeSet([], [{ type: 'add', group: { ...group, parent: g(0) } }]),
      ),
    ).toBeUndefined();
  });
});

const CANVAS = { background: color('#ffffff') };
const EMPTY: DocumentState = { elements: new Map(), groups: new Map(), canvas: CANVAS, rev: 0 };

/** A random scene and two random change sets, the second built on the first. */
function anyPair(random: Random): {
  readonly load: ChangeSet;
  readonly older: ChangeSet;
  readonly newer: ChangeSet;
} {
  const load = anySceneLoad(random, 20);
  let next = 1_000;
  const fresh = () => (next += 1);
  const start = applyToDocument(EMPTY, load);
  const older = anyEdit(random, start, fresh);
  return { load, older, newer: anyEdit(random, applyToDocument(start, older), fresh) };
}

describe('merging random change sets that follow each other', () => {
  it(
    'always merges them, into one set that gives the document their parts give in order',
    { timeout: 30_000 },
    () => {
      checkProperty({ seed: 4101, runs: 200 }, anyPair, ({ load, older, newer }) => {
        const parts = createSceneStore(CANVAS);
        const whole = createSceneStore(CANVAS);
        parts.apply(load, 'load');
        whole.apply(load, 'load');
        const set = mergeChangeSets(older, newer);
        if (set === undefined) throw new Error('The sets did not merge.');
        parts.apply(older, 'local');
        parts.apply(newer, 'local');
        whole.apply(set, 'local');
        expect(contentOf(whole.document())).toStrictEqual(contentOf(parts.document()));
      });
    },
  );
});
