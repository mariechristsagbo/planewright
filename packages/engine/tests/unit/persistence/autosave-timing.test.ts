import { describe, expect, it } from 'vitest';

import type { GroupId } from '../../../src/model/ids.ts';
import { createAutosave } from '../../../src/persistence/autosave.ts';
import { openTransaction } from '../../../src/scene/transaction.ts';
import {
  DOCUMENT,
  add,
  autosaveHarness,
  moveTo,
  settle,
  square,
  storedRev,
  storedX,
} from '../../support/autosave.ts';
import { testId } from '../../support/elements.ts';
import { changeSet, color } from '../../support/scene-state.ts';

// When autosave saves (docs/architecture/engine/persistence.md#autosave): 300 ms after the last
// committed change, never later than 1 s after the first unsaved one, and never a transient
// preview or a load (REQ-P01).

const ONE = testId(1);

describe('the autosave timer', () => {
  it('REQ-P01 saves a committed change 300 ms after it, and not before', async () => {
    const harness = autosaveHarness();
    moveTo(harness.store, ONE, 40);
    await harness.advance(299);
    expect(harness.requests).toHaveLength(0);
    await harness.advance(1);
    expect(harness.requests.map(({ type }) => type)).toEqual(['delta']);
    expect([storedX(harness, 1), storedRev(harness)]).toEqual([40, 2]);
    expect(harness.statuses.map(({ type }) => type)).toEqual(['pending', 'saved']);
  });

  it('REQ-P01 waits 300 ms after the last of several changes', async () => {
    const harness = autosaveHarness();
    for (const x of [10, 20, 30]) {
      moveTo(harness.store, ONE, x);
      await harness.advance(200);
    }
    expect(harness.requests).toHaveLength(0);
    await harness.advance(99);
    expect(harness.requests).toHaveLength(0);
    await harness.advance(1);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([1, 30]);
  });

  it('REQ-P01 saves at most 1 s after the first unsaved change, however often changes come', async () => {
    const harness = autosaveHarness();
    for (let x = 1; x <= 5; x += 1) {
      moveTo(harness.store, ONE, x);
      await harness.advance(200);
    }
    // The fifth change came at 800 ms; its 300 ms would end at 1,100 ms, but the first came at 0.
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([1, 5]);
    moveTo(harness.store, ONE, 6);
    await harness.advance(299);
    expect(harness.requests).toHaveLength(1);
    await harness.advance(1);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([2, 6]);
  });

  it('REQ-P01 a change made while a save runs waits for it, then is saved in turn', async () => {
    const harness = autosaveHarness();
    moveTo(harness.store, ONE, 10);
    harness.hold();
    await harness.advance(300);
    moveTo(harness.store, ONE, 20);
    await harness.advance(2_000);
    expect(harness.requests).toHaveLength(1);
    await harness.release();
    expect(harness.autosave.status.type).toBe('pending');
    await harness.advance(300);
    expect([harness.requests.length, storedX(harness, 1), storedRev(harness)]).toEqual([2, 20, 3]);
    expect(harness.autosave.status.type).toBe('saved');
  });

  it('REQ-P03 saves an added element and a removed one in one delta', async () => {
    const harness = autosaveHarness();
    add(harness.store, square(3, 90));
    const two = harness.store.get(testId(2));
    if (two === undefined) throw new Error('The store holds no element 2.');
    harness.store.apply(changeSet([{ type: 'remove', element: two }]), 'local');
    await harness.advance(300);
    const [request] = harness.requests;
    expect(request?.type === 'delta' ? request.delta : undefined).toMatchObject({
      upserts: [square(3, 90)],
      removals: [testId(2)],
    });
    expect([storedX(harness, 3), storedX(harness, 2)]).toEqual([90, undefined]);
  });
});

describe('what autosave never saves', () => {
  it('REQ-P01 a transient preview is never saved, and a cancelled one leaves nothing to save', async () => {
    const harness = autosaveHarness();
    const transaction = openTransaction(harness.store);
    transaction.preview(
      changeSet([{ type: 'update', id: ONE, before: { x: 0 }, after: { x: 70 } }]),
    );
    await harness.advance(5_000);
    transaction.cancel();
    await harness.advance(5_000);
    expect(harness.requests).toHaveLength(0);
    expect(harness.autosave.status.type).toBe('saved');
  });

  it('REQ-P01 a gesture in progress is saved once committed, as committed', async () => {
    const harness = autosaveHarness();
    const transaction = openTransaction(harness.store);
    for (const x of [10, 20, 30]) {
      const before = { x: harness.store.get(ONE)?.x ?? 0 };
      transaction.preview(changeSet([{ type: 'update', id: ONE, before, after: { x } }]));
    }
    await harness.advance(5_000);
    expect(harness.requests).toHaveLength(0);
    transaction.commit({ author: changeSet([]).author, seq: 9 });
    await harness.advance(300);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([1, 30]);
  });

  it('REQ-P01 a preview over a committed change saves the committed value, not the preview', async () => {
    const harness = autosaveHarness();
    moveTo(harness.store, ONE, 40);
    moveTo(harness.store, testId(2), 99, true);
    moveTo(harness.store, ONE, 500, true);
    await harness.advance(300);
    expect([storedX(harness, 1), storedX(harness, 2)]).toEqual([40, 50]);
  });

  it('a load is never saved, neither alone nor with the next change', async () => {
    const harness = autosaveHarness();
    harness.store.apply(changeSet([{ type: 'add', element: square(4) }]), 'load');
    await harness.advance(5_000);
    expect(harness.requests).toHaveLength(0);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    const [request] = harness.requests;
    expect(request?.type === 'delta' ? request.delta.upserts.map(({ id }) => id) : []).toEqual([
      ONE,
    ]);
    await settle();
  });
});

describe('groups and the canvas', () => {
  it('REQ-P01 a delta carries changed groups and the canvas, and a failed one gives them back', async () => {
    const harness = autosaveHarness();
    harness.storage.backend.fail({ ok: false, reason: 'failed' });
    const group = { id: 'G000000000000000000001' as GroupId };
    const grouped = { ...square(3, 90), group: group.id };
    const white = harness.store.canvas;
    const canvas = { before: white, after: { background: color('#fff8e7') } };
    harness.store.apply(
      changeSet([{ type: 'add', element: grouped }], [{ type: 'add', group }], canvas),
      'local',
    );
    await harness.advance(300);
    expect(harness.autosave.status.type).toBe('failed');
    await harness.advance(1_000);
    const request = harness.requests.at(-1);
    const delta = request?.type === 'delta' ? request.delta : undefined;
    expect([delta?.groups, delta?.canvas]).toEqual([
      { upserts: [group], removals: [] },
      { background: '#fff8e7' },
    ]);
    const stored = harness.storage.read(DOCUMENT);
    expect(stored.type === 'loaded' ? stored.stored.document.groups.get(group.id) : null).toEqual(
      group,
    );
    harness.store.apply(
      changeSet([{ type: 'remove', element: grouped }], [{ type: 'remove', group }]),
      'local',
    );
    await harness.advance(300);
    const last = harness.requests.at(-1);
    expect(last?.type === 'delta' ? last.delta.groups : undefined).toEqual({
      upserts: [],
      removals: [group.id],
    });
  });
});

describe('a repository that rejects', () => {
  it('REQ-P05 is a failed save, retried like any other', async () => {
    const harness = autosaveHarness();
    let calls = 0;
    const autosave = createAutosave({
      id: DOCUMENT,
      rev: 1,
      store: harness.store,
      clock: harness.clock,
      scheduler: harness.scheduler,
      repository: {
        load: () => harness.storage.repository.load(),
        save: (request) => {
          calls += 1;
          return calls === 1
            ? Promise.reject(new Error('The storage went away.'))
            : harness.storage.repository.save(request);
        },
      },
      session: () => harness.session,
      onStatus: () => undefined,
    });
    harness.autosave.dispose();
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    expect(autosave.status).toEqual({ type: 'failed', reason: 'failed' });
    await harness.advance(1_000);
    expect([calls, autosave.status.type, storedX(harness, 1)]).toEqual([2, 'saved', 40]);
  });
});
