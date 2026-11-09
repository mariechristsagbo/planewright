import { describe, expect, it } from 'vitest';

import { DOCUMENT, autosaveHarness, moveTo, storedRev, storedX } from '../../support/autosave.ts';
import { testId } from '../../support/elements.ts';
import { NO_SESSION } from '../../support/memory-backend.ts';

// Session state (docs/architecture/engine/persistence.md#what-is-saved-where): camera and
// selection ride with the next save, or go alone 1 s after the last change of either; a session
// save never raises the revision, nor moves the base of the next save (REQ-P02, REQ-V11).

const ONE = testId(1);
const MOVED = { camera: { x: 7, y: 8, zoom: 2 }, selection: [ONE] };

const storedSession = (harness: ReturnType<typeof autosaveHarness>) => {
  const result = harness.storage.read(DOCUMENT);
  return result.type === 'loaded' ? result.stored.session : undefined;
};

describe('session saves', () => {
  it('REQ-V11 go alone 1 s after the last camera or selection change, at the same revision', async () => {
    const harness = autosaveHarness();
    harness.session = MOVED;
    harness.autosave.sessionChanged();
    await harness.advance(600);
    harness.autosave.sessionChanged();
    await harness.advance(999);
    expect(harness.requests).toHaveLength(0);
    await harness.advance(1);
    expect(harness.requests.map(({ type }) => type)).toEqual(['session']);
    expect([storedSession(harness), storedRev(harness)]).toEqual([MOVED, 1]);
  });

  it('REQ-P02 ride with the next document save', async () => {
    const harness = autosaveHarness();
    harness.session = MOVED;
    harness.autosave.sessionChanged();
    moveTo(harness.store, ONE, 40);
    await harness.advance(5_000);
    expect(harness.requests.map(({ type }) => type)).toEqual(['delta']);
    expect([storedSession(harness), storedX(harness, 1)]).toEqual([MOVED, 40]);
  });

  it('REQ-P06 never move the base, so a newer save by another tab still makes this one stale', async () => {
    const harness = autosaveHarness();
    const { repository } = harness.storage;
    const other = await repository.save({
      type: 'replace',
      id: DOCUMENT,
      baseRev: 1,
      document: harness.store.document(),
      session: NO_SESSION,
    });
    expect(other).toEqual({ ok: true, rev: 2 });
    harness.session = MOVED;
    harness.autosave.sessionChanged();
    await harness.advance(1_000);
    expect([harness.autosave.status.type, storedRev(harness)]).toEqual(['saved', 2]);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    expect([harness.autosave.status.type, storedX(harness, 1)]).toEqual(['stale', 0]);
  });
});

describe('saveNow', () => {
  it('REQ-P01 starts a waiting save at once, and does nothing when nothing waits', async () => {
    const harness = autosaveHarness();
    harness.autosave.saveNow();
    await harness.advance(0);
    expect(harness.requests).toHaveLength(0);
    moveTo(harness.store, ONE, 40);
    harness.autosave.saveNow();
    await harness.advance(0);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([1, 40]);
    harness.session = MOVED;
    harness.autosave.sessionChanged();
    harness.autosave.saveNow();
    await harness.advance(0);
    expect(harness.requests.map(({ type }) => type)).toEqual(['delta', 'session']);
  });

  it('starts no second save while one runs', async () => {
    const harness = autosaveHarness();
    harness.hold();
    moveTo(harness.store, ONE, 40);
    harness.autosave.saveNow();
    moveTo(harness.store, ONE, 50);
    harness.autosave.saveNow();
    expect(harness.requests).toHaveLength(1);
    await harness.release();
    harness.autosave.saveNow();
    await harness.advance(0);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([2, 50]);
  });
});

describe('dispose', () => {
  it('stops the timers, the store listener and any late result', async () => {
    const harness = autosaveHarness();
    harness.hold();
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    moveTo(harness.store, ONE, 50);
    harness.autosave.dispose();
    const statuses = harness.statuses.length;
    await harness.release();
    moveTo(harness.store, ONE, 60);
    harness.autosave.sessionChanged();
    await harness.advance(60_000);
    expect([harness.requests.length, harness.statuses.length]).toEqual([1, statuses]);
    expect(harness.scheduler.pending()).toBe(0);
  });
});
