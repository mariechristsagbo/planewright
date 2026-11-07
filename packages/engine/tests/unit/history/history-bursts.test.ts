import { describe, expect, it } from 'vitest';

import { BURST_MS, HISTORY_LIMITS } from '../../../src/history/history.ts';
import type { ClientId } from '../../../src/model/ids.ts';
import { recorder } from '../../support/histories.ts';
import { changeSet, contentOf } from '../../support/scene-state.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

const e = fixtureId;

describe('burst merging', () => {
  it('REQ-T10 merges an entry into the top one with its merge key, up to 1 s after the last part', () => {
    const { store, history, commit } = recorder(fixtureStore());
    const start = contentOf(store.document());
    const parts = [0, 1_000, 2_000].map((time, index) =>
      commit(edit(store, 2, { x: 201 + index }), {
        label: 'nudge',
        mergeKey: 'nudge:right',
        time,
        selectionBefore: [e(index)],
        selectionAfter: [e(index + 1)],
      }),
    );
    const merged = history.undo();
    expect(merged).toStrictEqual({
      ...parts[0],
      changes: {
        ...changeSet([{ type: 'update', id: e(2), before: { x: 200 }, after: { x: 203 } }]),
        seq: 101,
      },
      selectionAfter: [e(3)],
      time: 2_000,
    });
    expect(contentOf(store.document())).toStrictEqual(start);
    expect(history.canUndo).toBe(false);
  });

  it('keeps entries apart more than 1 s apart, under other keys, without a key or around an undo', () => {
    const { store, history, commit } = recorder(fixtureStore());
    const nudge = (x: number, time: number, mergeKey?: string) =>
      commit(edit(store, 2, { x }), { time, ...(mergeKey === undefined ? {} : { mergeKey }) });
    nudge(1, 0, 'a');
    nudge(2, 1_001, 'a');
    nudge(3, 1_002, 'b');
    nudge(4, 1_003);
    nudge(5, 1_004);
    nudge(6, 1_005, 'c');
    nudge(7, 1_006, 'd');
    history.undo();
    nudge(8, 1_007, 'c');
    commit(edit(store, 3, { x: 0 }), { time: 1_008, mergeKey: 'c' });
    let count = 0;
    while (history.undo() !== null) count += 1;
    expect(count).toBe(7);
    expect([present(store, 2).x, present(store, 3).x]).toStrictEqual([200, 300]);
  });

  it('keeps apart parts that do not follow each other, as when a remote change came between them', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }), { mergeKey: 'move' });
    store.apply(edit(store, 2, { x: 999 }), 'remote');
    commit(edit(store, 2, { x: 400 }), { mergeKey: 'move' });
    history.undo();
    expect(present(store, 2).x).toBe(999);
    history.undo();
    expect(present(store, 2).x).toBe(999);
  });

  it('drops a burst that ends where it began, and starts the next part afresh', () => {
    const { store, history, commit } = recorder(fixtureStore());
    commit(edit(store, 2, { x: 300 }), { mergeKey: 'move', time: 0 });
    commit(edit(store, 2, { x: 200 }), { mergeKey: 'move', time: 10 });
    expect(history.canUndo).toBe(false);
    commit(edit(store, 2, { x: 250 }), { mergeKey: 'move', time: 20 });
    expect(history.undo()?.changes.elements).toStrictEqual([
      { type: 'update', id: e(2), before: { x: 200 }, after: { x: 250 } },
    ]);
  });
});

describe('limits', () => {
  it('REQ-H03 are 500 entries and an estimated 50 MB, and a burst lasts 1 s', () => {
    expect(HISTORY_LIMITS).toStrictEqual({ entries: 500, bytes: 50_000_000 });
    expect(BURST_MS).toBe(1_000);
  });

  it('drop the oldest entries past 500 by default', { timeout: 30_000 }, () => {
    const { store, history, commit } = recorder(fixtureStore());
    for (let x = 1; x <= 501; x += 1) commit(edit(store, 2, { x }));
    let count = 0;
    while (history.undo() !== null) count += 1;
    expect(count).toBe(500);
    expect(present(store, 2).x).toBe(1);
  });

  it('drop the oldest entries past an estimated 50 MB, two bytes per character of JSON, by default', () => {
    const { store, history } = recorder(fixtureStore());
    const author = 'A'.repeat(13_000_000) as ClientId;
    for (const x of [201, 202]) {
      const set = edit(store, 2, { x });
      store.apply(set, 'local');
      history.record({
        label: 'move',
        changes: { ...set, author },
        selectionBefore: [],
        selectionAfter: [],
        time: 0,
      });
    }
    expect(history.undo()).not.toBeNull();
    expect(history.undo()).toBeNull();
    expect(present(store, 2).x).toBe(201);
  });

  it('drop the oldest entries past smaller limits, but always keep the newest', () => {
    // Three moves between three-digit positions, so that every entry has the same estimated size.
    const size = JSON.stringify(edit(fixtureStore(), 2, { x: 301 })).length * 2;
    const run = (limits: { entries: number; bytes: number }) => {
      const { store, history, commit } = recorder(fixtureStore(), limits);
      for (const x of [301, 302, 303]) commit(edit(store, 2, { x }));
      let count = 0;
      while (history.undo() !== null) count += 1;
      return count;
    };
    expect(run({ entries: 2, bytes: 1e9 })).toBe(2);
    expect(run({ entries: 500, bytes: 2 * size })).toBe(2);
    expect(run({ entries: 500, bytes: 2 * size - 1 })).toBe(1);
    expect(run({ entries: 500, bytes: 1 })).toBe(1);
  });
});
