import { describe, expect, it } from 'vitest';

import type { ArrowElement, Element } from '../../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../../src/model/ids.ts';
import { invertChangeSet } from '../../../src/scene/change-set.ts';
import type {
  ChangeOrigin,
  ChangeSet,
  ElementChange,
  GroupChange,
} from '../../../src/scene/change-set.ts';
import { ChangeSetError, createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';
import { changeSet, color } from '../../support/scene-state.ts';
import { sortedIds } from '../../support/scenes.ts';

const e = (index: number) => elementId(index) as ElementId;
const g = (index: number) => groupId(index) as GroupId;

const fixture = (index: number): Element => {
  const found = fixtureDocument().elements.get(e(index));
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

/** The fixture's arrow, from rectangle 0 to ellipse 1. */
function fixtureArrow(): ArrowElement {
  const found = fixture(6);
  if (found.kind !== 'arrow') throw new Error('The fixture element 6 is an arrow.');
  return found;
}

function loaded(): { readonly store: SceneStore; readonly updates: SceneUpdate[] } {
  const { elements, groups, canvas } = fixtureDocument();
  const store = createSceneStore(canvas);
  store.apply(
    changeSet(
      [...elements.values()].map((element) => ({ type: 'add', element })),
      [...groups.values()].map((group) => ({ type: 'add', group })),
    ),
    'load',
  );
  const updates: SceneUpdate[] = [];
  store.subscribe((update) => {
    updates.push(update);
  });
  return { store, updates };
}

/** Everything that the store shows through its reader. */
const shown = (store: SceneStore) => ({
  document: store.document(),
  rev: store.rev,
  canvas: store.canvas,
  ordered: store.ordered(),
  everywhere: sortedIds(store.queryBox({ x: -2e9, y: -2e9, width: 4e9, height: 4e9 })),
  near: sortedIds(store.queryPoint({ x: 0, y: 0 }, 50)),
  outermost: [0, 1, 2].map((index) => store.outermostGroup(e(index))),
  members: sortedIds(store.members(g(0))),
  connectors: store.connectorsOf(e(0)),
});

/** The errors that apply threw, or none. */
function refusal(apply: () => void): unknown {
  try {
    apply();
  } catch (error) {
    return error instanceof ChangeSetError ? error.errors : error;
  }
  return [];
}

const move: ElementChange = { type: 'update', id: e(2), before: { x: 200 }, after: { x: -4_000 } };
const addition: ElementChange = { type: 'add', element: { ...fixture(3), id: e(20) } };
const regroup: GroupChange = { type: 'add', group: { id: g(5), parent: g(0) } };

describe('a change set with one invalid change', () => {
  it.each([
    [
      'an added identifier that exists',
      { type: 'add', element: fixture(4) },
      'elements[2].element.id',
      'exists',
    ],
    [
      'a before that is not the current value',
      { ...move, id: e(3), before: { x: 1 } },
      'elements[2].before',
      'stale',
    ],
    [
      'an after that makes the element invalid',
      { ...move, id: e(3), before: { x: 300 }, after: { x: 2e9 } },
      'elements[2].after.x',
      'out-of-range',
    ],
    ['an element that does not exist', { ...move, id: e(30) }, 'elements[2].id', 'not-found'],
    [
      'a removed target that an arrow still points at',
      { type: 'remove', element: fixture(0) },
      'elements[2]',
      'still-referenced',
    ],
    [
      'an identifier that the set already changes',
      { type: 'remove', element: fixture(2) },
      'elements[2]',
      'repeated',
    ],
  ] as const)('leaves the store unchanged: %s', (_, invalid, path, problem) => {
    const { store, updates } = loaded();
    const before = shown(store);
    const errors = refusal(() => {
      store.apply(changeSet([move, addition, invalid], [regroup]), 'local');
    });
    expect(errors).toStrictEqual([{ path, problem }]);
    expect(shown(store)).toStrictEqual(before);
    expect(updates).toStrictEqual([]);
  });

  it.each(['local', 'history', 'remote', 'load'] as const)(
    'leaves the store unchanged for the %s origin, whose set is refused whole',
    (origin: ChangeOrigin) => {
      const { store, updates } = loaded();
      const before = shown(store);
      const canvas = {
        before: { background: color('#ffffff') },
        after: { background: color('#fff') },
      };
      const errors = refusal(() => {
        store.apply(changeSet([move, addition], [regroup], canvas), origin);
      });
      expect(errors).toStrictEqual([
        { path: 'canvas.after.background', problem: 'malformed-color' },
      ]);
      expect(shown(store)).toStrictEqual(before);
      expect(updates).toStrictEqual([]);
    },
  );

  it('names each refused change in the error message', () => {
    const { store } = loaded();
    expect(() => {
      store.apply(
        changeSet([
          { ...move, id: e(30) },
          { type: 'add', element: fixture(4) },
        ]),
        'local',
      );
    }).toThrow(
      'The change set was refused: elements[0].id not-found, elements[1].element.id exists.',
    );
  });
});

describe('a patch that sets an optional field to null', () => {
  it('removes the field, survives a JSON round trip, and its inverse restores the field', () => {
    const { store } = loaded();
    const clear = changeSet([
      {
        type: 'update',
        id: e(0),
        before: { link: 'https://example.test/a', group: g(0) },
        after: { link: null, group: null },
      },
      {
        type: 'update',
        id: e(6),
        before: { start: fixtureArrow().start ?? null },
        after: { start: null },
      },
    ]);
    const sent = JSON.parse(JSON.stringify(clear)) as ChangeSet;
    expect(sent).toStrictEqual(clear);
    store.apply(sent, 'local');
    const cleared = store.get(e(0));
    expect(cleared).toMatchObject({ id: e(0), x: 0 });
    expect(['link', 'group'].filter((key) => Object.hasOwn(cleared ?? {}, key))).toStrictEqual([]);
    expect(Object.hasOwn(store.get(e(6)) ?? {}, 'start')).toBe(false);
    expect([store.outermostGroup(e(0)), store.connectorsOf(e(0))]).toStrictEqual([undefined, []]);
    store.apply(invertChangeSet(sent), 'local');
    expect(store.get(e(0))).toStrictEqual({ ...fixture(0), rev: fixture(0).rev + 2 });
    expect(store.get(e(6))).toStrictEqual({ ...fixture(6), rev: fixture(6).rev + 2 });
    expect([store.outermostGroup(e(0)), store.connectorsOf(e(0))]).toStrictEqual([g(0), [e(6)]]);
  });
});

describe('SceneStore.subscribe', () => {
  it('calls its listeners in order until each is cancelled', () => {
    const { store } = loaded();
    const calls: string[] = [];
    const cancelFirst = store.subscribe(() => calls.push('first'));
    store.subscribe(() => calls.push('second'));
    store.apply(changeSet([move]), 'local');
    cancelFirst();
    cancelFirst();
    store.apply(changeSet([{ ...move, before: { x: -4_000 }, after: { x: 0 } }]), 'local');
    expect(calls).toStrictEqual(['first', 'second', 'second']);
  });

  it('refuses a change set applied from inside a listener, after the first set is applied', () => {
    const { store } = loaded();
    const back = changeSet([{ ...move, before: { x: -4_000 }, after: { x: 200 } }]);
    let thrown: unknown;
    store.subscribe(() => {
      try {
        store.apply(back, 'local');
      } catch (error) {
        thrown = error;
      }
    });
    store.apply(changeSet([move]), 'local');
    expect(thrown).toBeInstanceOf(Error);
    expect(store.get(e(2))?.x).toBe(-4_000);
  });

  it('lets an error from a listener through, with the set applied and the store still usable', () => {
    const { store, updates } = loaded();
    const cancel = store.subscribe(() => {
      throw new Error('listener failed');
    });
    expect(() => {
      store.apply(changeSet([move]), 'local');
    }).toThrow('listener failed');
    expect(store.get(e(2))?.x).toBe(-4_000);
    cancel();
    store.apply(changeSet([{ ...move, before: { x: -4_000 }, after: { x: 1 } }]), 'local');
    expect(updates.map(({ rev }) => rev)).toStrictEqual([2, 3]);
  });
});
