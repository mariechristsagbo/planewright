import { describe, expect, it } from 'vitest';

import { DOCUMENT, autosaveHarness, moveTo, storedRev, storedX } from '../../support/autosave.ts';
import type { AutosaveHarness } from '../../support/autosave.ts';
import { testId } from '../../support/elements.ts';
import { NO_SESSION } from '../../support/memory-backend.ts';

// What autosave does with a save's result (docs/architecture/engine/persistence.md#autosave):
// failures keep the changes and retry with back-off (REQ-P05); a stale refusal stops every save
// until the user keeps this version or loads the newer one (REQ-P06); session state rides with the
// next save or goes alone 1 s after the last camera or selection change, never as a new revision.

const ONE = testId(1);
const MOVED = { camera: { x: 7, y: 8, zoom: 2 }, selection: [ONE] };

/** Another tab's save: the stored document moves on by one revision. */
async function otherTabSaves(harness: AutosaveHarness, base: number): Promise<void> {
  const { repository } = harness.storage;
  const delta = { upserts: [], removals: [], groups: { upserts: [], removals: [] } };
  const canvas = harness.store.canvas;
  const result = await repository.save({
    type: 'delta',
    id: DOCUMENT,
    baseRev: base,
    delta: { ...delta, canvas },
    session: NO_SESSION,
  });
  expect(result).toEqual({ ok: true, rev: base + 1 });
}

describe('a failed save', () => {
  it('REQ-P05 keeps the changes, retries after 1, 2, 4, 8, 16 and then every 30 s, and reports it until a save succeeds', async () => {
    const harness = autosaveHarness();
    harness.storage.backend.fail({ ok: false, reason: 'quota' }, 7);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    expect(harness.autosave.status).toEqual({ type: 'failed', reason: 'quota' });
    const times: number[] = [];
    for (const wait of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
      await harness.advance(wait - 1);
      times.push(harness.requests.length);
      await harness.advance(1);
    }
    expect(times).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([harness.requests.length, harness.autosave.status.type]).toEqual([8, 'saved']);
    expect([storedX(harness, 1), storedRev(harness)]).toEqual([40, 2]);
  });

  it('REQ-P05 a repository that throws is a failure too, and changes made meanwhile join the retry', async () => {
    const harness = autosaveHarness();
    harness.storage.backend.fail('throw');
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    expect(harness.autosave.status).toEqual({ type: 'failed', reason: 'failed' });
    moveTo(harness.store, ONE, 60);
    await harness.advance(999);
    expect(harness.requests).toHaveLength(1);
    await harness.advance(1);
    expect([harness.requests.length, storedX(harness, 1)]).toEqual([2, 60]);
    expect(harness.autosave.status.type).toBe('saved');
  });

  it('REQ-P05 saveNow retries at once, and a success starts the back-off again', async () => {
    const harness = autosaveHarness();
    harness.storage.backend.fail({ ok: false, reason: 'unavailable' }, 2);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    harness.autosave.saveNow();
    await harness.advance(0);
    expect([harness.requests.length, harness.autosave.status]).toEqual([
      2,
      { type: 'failed', reason: 'unavailable' },
    ]);
    await harness.advance(2_000);
    expect(harness.autosave.status.type).toBe('saved');
  });
});

describe('a stale save', () => {
  it('REQ-P06 stops every save, session saves included, and reports it', async () => {
    const harness = autosaveHarness();
    await otherTabSaves(harness, 1);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    expect(harness.autosave.status).toEqual({ type: 'stale' });
    moveTo(harness.store, ONE, 50);
    harness.session = MOVED;
    harness.autosave.sessionChanged();
    harness.autosave.saveNow();
    await harness.advance(60_000);
    expect([harness.requests.length, storedRev(harness), storedX(harness, 1)]).toEqual([1, 2, 0]);
  });

  it('REQ-P06 keep writes the whole committed document over the newer one, at the next revision', async () => {
    const harness = autosaveHarness();
    await otherTabSaves(harness, 1);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    moveTo(harness.store, testId(2), 75, true);
    harness.autosave.keep();
    await harness.advance(0);
    const request = harness.requests.at(-1);
    expect([request?.type, request?.type === 'replace' ? request.baseRev : 0]).toEqual([
      'replace',
      2,
    ]);
    expect([storedRev(harness), storedX(harness, 1), storedX(harness, 2)]).toEqual([3, 40, 50]);
    expect(harness.autosave.status.type).toBe('saved');
    moveTo(harness.store, ONE, 45);
    await harness.advance(300);
    expect([storedRev(harness), storedX(harness, 1)]).toEqual([4, 45]);
  });

  it('REQ-P06 keep is stale again when yet another save landed, and does nothing unless stale', async () => {
    const harness = autosaveHarness();
    harness.autosave.keep();
    await harness.advance(0);
    expect(harness.requests).toHaveLength(0);
    await otherTabSaves(harness, 1);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    await otherTabSaves(harness, 2);
    harness.autosave.keep();
    await harness.advance(0);
    expect([harness.autosave.status.type, storedRev(harness)]).toEqual(['stale', 3]);
  });

  it('REQ-P06 reset drops what waited and builds the next save on the loaded revision', async () => {
    const harness = autosaveHarness();
    await otherTabSaves(harness, 1);
    moveTo(harness.store, ONE, 40);
    await harness.advance(300);
    moveTo(harness.store, ONE, 0);
    harness.autosave.reset(DOCUMENT, 2);
    expect(harness.autosave.status.type).toBe('saved');
    await harness.advance(5_000);
    expect(harness.requests).toHaveLength(1);
    moveTo(harness.store, ONE, 30);
    await harness.advance(300);
    expect([storedRev(harness), storedX(harness, 1)]).toEqual([3, 30]);
  });
});
