import { describe, expect, it } from 'vitest';

import { applyWhatFits } from '../../../src/history/fit.ts';
import type { GroupId } from '../../../src/model/ids.ts';
import type { ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { groupId } from '../../support/fixtures.ts';
import { changeSet, color, contentOf } from '../../support/scene-state.ts';
import { fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;
const g = (index: number) => groupId(index) as GroupId;
const move: ElementChange = { type: 'update', id: e(2), before: { x: 200 }, after: { x: 1 } };

describe('applying what still fits', () => {
  it('applies a set that the store accepts whole, and returns it', () => {
    const store = fixtureStore();
    const set = changeSet([move]);
    expect(applyWhatFits(store, set, 'history', [])).toBe(set);
    expect(present(store, 2).x).toBe(1);
  });

  it('leaves out the changes that the store refuses and applies the rest', () => {
    const store = fixtureStore();
    const orphan = { ...present(store, 3), id: e(20), group: g(7) };
    const applied = applyWhatFits(
      store,
      changeSet([{ type: 'add', element: orphan }, move], [], {
        before: { background: color('#ffffff') },
        after: { background: color('nope') },
      }),
      'history',
      [],
    );
    expect(applied).toStrictEqual(changeSet([move]));
    expect(store.get(e(20))).toBeUndefined();
    expect(present(store, 2).x).toBe(1);
    expect(store.canvas).toStrictEqual({ background: '#ffffff' });
  });

  it('keeps a canvas change that the store accepts when it refuses another change', () => {
    const store = fixtureStore();
    const orphan = { ...present(store, 3), id: e(20), group: g(7) };
    const canvas = {
      before: { background: color('#ffffff') },
      after: { background: color('#202020') },
    };
    const applied = applyWhatFits(
      store,
      changeSet([{ type: 'add', element: orphan }], [], canvas),
      'history',
      [],
    );
    expect(applied).toStrictEqual(changeSet([], [], canvas));
    expect(store.canvas).toStrictEqual({ background: '#202020' });
  });

  it('also leaves out a change that becomes invalid once another one is left out', () => {
    const store = fixtureStore();
    const member = { ...present(store, 3), id: e(20), group: g(5) };
    const applied = applyWhatFits(
      store,
      changeSet(
        [{ type: 'add', element: member }, move],
        [{ type: 'add', group: { id: g(5), parent: g(7) } }],
      ),
      'history',
      [],
    );
    expect(applied).toStrictEqual(changeSet([move]));
    expect(store.group(g(5))).toBeUndefined();
  });

  it('returns null and changes nothing when nothing fits', () => {
    const store = fixtureStore();
    const start = contentOf(store.document());
    const rev = store.rev;
    const stale: ElementChange = { type: 'update', id: e(2), before: { x: 9 }, after: { x: 1 } };
    expect(applyWhatFits(store, changeSet([stale]), 'history', [])).toBeNull();
    expect(applyWhatFits(store, changeSet([]), 'history', [])).toBeNull();
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(store.rev).toBe(rev);
  });

  it('gives up, canvas change included, on a refusal that names no single change', () => {
    const tried: ChangeSet[] = [];
    const store = {
      rev: 0,
      apply(changes: ChangeSet) {
        tried.push(changes);
        // A second try would mean the step keeps something that the refusal covered.
        if (tried.length > 1) throw new Error('The set was tried again.');
        throw new ChangeSetError([{ path: 'elements', problem: 'too-many' }]);
      },
    } as unknown as SceneStore;
    const canvas = {
      before: { background: color('#ffffff') },
      after: { background: color('#202020') },
    };
    expect(applyWhatFits(store, changeSet([move], [], canvas), 'history', [])).toBeNull();
    expect(tried).toHaveLength(1);
  });

  it('keeps the error of a listener of the set it applied, and returns that set', () => {
    const store = fixtureStore();
    const failure = new Error('the listener failed');
    store.subscribe(() => {
      throw failure;
    });
    const failures: unknown[] = [];
    const set = changeSet([move]);
    expect(applyWhatFits(store, set, 'history', failures)).toBe(set);
    expect(failures).toStrictEqual([failure]);
  });

  it('rethrows at once an error that is not a refusal, when nothing was applied', () => {
    const store = fixtureStore();
    const caught: unknown[] = [];
    store.subscribe(() => {
      try {
        applyWhatFits(store, changeSet([move]), 'history', []);
      } catch (error) {
        caught.push(error);
      }
    });
    store.apply(changeSet([move]), 'local');
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBeInstanceOf(Error);
    expect((caught[0] as Error).message).toContain(
      'cannot apply a change set while it is notified',
    );
  });
});
