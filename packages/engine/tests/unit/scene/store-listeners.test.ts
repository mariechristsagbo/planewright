import { describe, expect, it } from 'vitest';

import { edit, fixtureStore, present } from '../../support/stores.ts';

/** Runs `act` and returns what it threw, or fails when it threw nothing. */
function thrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  throw new Error('Nothing was thrown.');
}

describe('SceneStore listeners that throw', () => {
  it('cannot keep the later listeners from the update: every one is told, then the first error is rethrown', () => {
    const store = fixtureStore();
    const first = new Error('the first listener failed');
    const told: string[] = [];
    store.subscribe(() => {
      told.push('a');
      throw first;
    });
    store.subscribe((update) => {
      told.push(`b at ${String(update.rev)}`);
    });
    store.subscribe(() => {
      told.push('c');
      throw new Error('the third listener failed');
    });
    store.subscribe(() => {
      told.push('d');
    });
    const thrown = thrownBy(() => {
      store.apply(edit(store, 2, { x: 900 }), 'local');
    });
    expect(thrown).toBe(first);
    expect(told).toStrictEqual(['a', 'b at 2', 'c', 'd']);
  });

  it('leave the set applied, and the store open to the next set and its listeners', () => {
    const store = fixtureStore();
    const told: number[] = [];
    let fail = true;
    store.subscribe(() => {
      if (fail) throw new Error('the listener failed');
    });
    store.subscribe((update) => told.push(update.rev));
    expect(() => {
      store.apply(edit(store, 2, { x: 900 }), 'local');
    }).toThrow('the listener failed');
    expect(store.rev).toBe(2);
    expect(present(store, 2).x).toBe(900);
    fail = false;
    store.apply(edit(store, 2, { x: 950 }), 'local');
    expect(present(store, 2).x).toBe(950);
    expect(told).toStrictEqual([2, 3]);
  });

  it('still refuse a set that a listener applies while it is told, and tell the others first', () => {
    const store = fixtureStore();
    const told: number[] = [];
    store.subscribe(() => {
      store.apply(edit(store, 3, { x: 1 }), 'local');
    });
    store.subscribe((update) => told.push(update.rev));
    expect(() => {
      store.apply(edit(store, 2, { x: 900 }), 'local');
    }).toThrow('cannot apply a change set while it is notified');
    expect(told).toStrictEqual([2]);
    expect(store.rev).toBe(2);
    expect(present(store, 3).x).toBe(300);
  });
});
