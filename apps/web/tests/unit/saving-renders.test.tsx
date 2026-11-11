import type { SaveStatus } from '@planewright/engine';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { useShellState } from '../../src/shell/shell-state.ts';
import { hasNotices, problemChipOf, saveStateOf } from '../../src/ui/save-problem.ts';
import { saveHarness } from '../support/saving.ts';
import type { SaveHarness } from '../support/saving.ts';

// What a camera step renders of saving's chrome (ADR 0012, decision 14; the v0.2 plan's S7): the
// shell's root reads view.save through a selector, and view.save keeps its identity across camera
// changes, so a pan or zoom step, which publishes a new view, renders neither the shell nor its
// root, the problem chip or the notices. Each component is counted by the call it makes at each
// render: the shell's useShellState, the root's saveStateOf, the chip's problemChipOf and the
// chip's and the notices' hasNotices.

vi.mock(import('../../src/shell/shell-state.ts'), { spy: true });
vi.mock(import('../../src/ui/save-problem.ts'), { spy: true });

/** Ten camera steps: zooms by command and pans by the wheel, alternately. */
function cameraSteps({ inner }: SaveHarness): void {
  const modifiers = { shift: false, alt: false, mod: false };
  for (let step = 0; step < 10; step += 1) {
    act(() => {
      if (step % 2 === 0) inner.run(step % 4 === 0 ? 'view.zoom-in' : 'view.zoom-out');
      else
        inner.input({
          type: 'wheel',
          at: { x: 400, y: 300 },
          delta: { x: 0, y: 40 },
          zoom: false,
          modifiers,
          time: step,
        });
    });
  }
}

/** How many times each counted component rendered over ten camera steps under a status. */
function rendersOverCameraSteps(save: SaveStatus) {
  const harness = saveHarness(save);
  render(<EditorShell surface={harness.surface} />);
  act(() => {
    harness.inner.resize({ width: 800, height: 600, pixelRatio: 1 });
  });
  const camera = harness.editor.view.camera;
  const counted = {
    shell: vi.mocked(useShellState),
    root: vi.mocked(saveStateOf),
    chip: vi.mocked(problemChipOf),
    notices: vi.mocked(hasNotices),
  };
  for (const spy of Object.values(counted)) spy.mockClear();
  cameraSteps(harness);
  expect(harness.editor.view.camera).not.toEqual(camera);
  return Object.fromEntries(
    Object.entries(counted).map(([name, spy]) => [name, spy.mock.calls.length]),
  );
}

describe('saving’s chrome at camera steps', () => {
  it.each([[{ type: 'saved' }], [{ type: 'failed', reason: 'quota' }]] satisfies [SaveStatus][])(
    'A12 D8 renders neither the shell, its root, the chip nor the notices across ten camera steps under %j',
    (save) => {
      expect(rendersOverCameraSteps(save)).toEqual({ shell: 0, root: 0, chip: 0, notices: 0 });
    },
  );

  it('renders the root, the chip and the notices again when the status changes, so that the counts above can see a render', () => {
    const harness = saveHarness({ type: 'saved' });
    render(<EditorShell surface={harness.surface} />);
    const spies = [vi.mocked(saveStateOf), vi.mocked(problemChipOf), vi.mocked(hasNotices)];
    for (const spy of spies) spy.mockClear();
    harness.setSave({ type: 'failed', reason: 'quota' });
    expect(spies.map((spy) => spy.mock.calls.length > 0)).toEqual([true, true, true]);
  });
});
