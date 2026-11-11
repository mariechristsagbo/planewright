import type { SaveFailure, SaveStatus } from '@planewright/engine';
import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { RECOVERY_TEXT, recoveryStep, useSaveRecovery } from '../../src/a11y/save-recovery.ts';
import { EditorProvider } from '../../src/editor/EditorProvider.tsx';
import { saveHarness } from '../support/saving.ts';

// The one sentence the web app says about saving (ADR 0012, decision 12; the v0.2 plan's S7): after
// a failed save, the next save that succeeds says "The drawing is saved again." in the polite
// region, once, whatever came between but a stale save or no storage. Routine saves say nothing.

const SAVED: SaveStatus = { type: 'saved' };
const PENDING: SaveStatus = { type: 'pending' };
const STALE: SaveStatus = { type: 'stale' };
const failed = (reason: SaveFailure): SaveStatus => ({ type: 'failed', reason });

type Sequence = readonly (SaveStatus | null)[];

/** The positions in a sequence of statuses at which the step function says the sentence. */
function spoken(statuses: Sequence): number[] {
  let memory = false;
  return statuses.flatMap((save, index) => {
    const step = recoveryStep(memory, save);
    memory = step.failed;
    return step.say ? [index] : [];
  });
}

function Recovery() {
  useSaveRecovery();
  return null;
}

/** Mounts the hook over the first status, publishes the others and gives what was said. */
function said([first = null, ...rest]: Sequence, strict = false) {
  const harness = saveHarness(first);
  const tree = (
    <EditorProvider surface={harness.surface}>
      <Recovery />
    </EditorProvider>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  for (const save of rest) harness.setSave(save);
  return harness.said;
}

const ONCE = [{ text: 'The drawing is saved again.', urgency: 'polite' }];

describe('the recovery step', () => {
  it.each([
    [[failed('quota'), SAVED], [1]],
    [[failed('failed'), PENDING, SAVED], [2]],
    [[failed('failed'), PENDING, PENDING, SAVED], [3]],
    [[failed('quota'), failed('failed'), SAVED], [2]],
    [[failed('quota'), SAVED, SAVED], [1]],
    [[failed('quota'), SAVED, PENDING, SAVED], [1]],
    [[PENDING, SAVED], []],
    [[SAVED, PENDING, SAVED], []],
    [[STALE, SAVED], []],
    [[failed('quota'), STALE, SAVED], []],
    [[failed('quota'), STALE, PENDING, SAVED], []],
    [[failed('quota'), null, SAVED], []],
  ] satisfies [Sequence, number[]][])('D7 over %j says the sentence at %j', (statuses, at) => {
    expect(spoken(statuses)).toEqual(at);
  });

  it.each([
    [false, SAVED, { failed: false, say: false }],
    [true, SAVED, { failed: false, say: true }],
    [false, PENDING, { failed: false, say: false }],
    [true, PENDING, { failed: true, say: false }],
    [false, failed('quota'), { failed: true, say: false }],
    [true, failed('unavailable'), { failed: true, say: false }],
    [false, STALE, { failed: false, say: false }],
    [true, STALE, { failed: false, say: false }],
    [false, null, { failed: false, say: false }],
    [true, null, { failed: false, say: false }],
  ] as const)('D7 from memory %s, %j gives %j', (memory, save, step) => {
    expect(recoveryStep(memory, save)).toEqual(step);
  });

  it('is the exact sentence of the ADR', () => {
    expect(RECOVERY_TEXT).toBe('The drawing is saved again.');
  });
});

describe('useSaveRecovery', () => {
  it('A7 says the sentence once, politely, after a failed save succeeds, with or without pending between', () => {
    expect(said([failed('quota'), SAVED])).toEqual(ONCE);
    expect(said([failed('failed'), PENDING, PENDING, SAVED])).toEqual(ONCE);
    expect(said([SAVED, PENDING, failed('quota'), failed('failed'), PENDING, SAVED])).toEqual(ONCE);
  });

  it('A7 says it once under StrictMode, and not again at the next saves', () => {
    expect(said([failed('quota'), PENDING, SAVED, PENDING, SAVED], true)).toEqual(ONCE);
  });

  it('A7 says nothing for routine saves, for Keep or Load after a stale save, or after a failure that turned stale', () => {
    expect(said([SAVED, PENDING, SAVED, PENDING, SAVED])).toEqual([]);
    expect(said([PENDING, STALE, SAVED])).toEqual([]);
    expect(said([failed('quota'), STALE, SAVED])).toEqual([]);
  });

  it('says it again after a second failure, once each time', () => {
    expect(said([failed('quota'), SAVED, PENDING, failed('quota'), SAVED])).toEqual([
      ...ONCE,
      ...ONCE,
    ]);
  });

  it('says nothing at camera steps, which keep the status', () => {
    const harness = saveHarness(failed('quota'));
    render(
      <EditorProvider surface={harness.surface}>
        <Recovery />
      </EditorProvider>,
    );
    harness.inner.resize({ width: 800, height: 600, pixelRatio: 1 });
    for (let step = 0; step < 4; step += 1) {
      act(() => {
        harness.inner.run(step % 2 === 0 ? 'view.zoom-in' : 'view.zoom-out');
      });
    }
    expect(harness.said).toEqual([]);
    harness.setSave(SAVED);
    expect(harness.said).toEqual(ONCE);
  });
});
