import { describe, expect, it } from 'vitest';

import { testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import { keyEvent, move, up, wheelEvent } from '../support/inputs.ts';
import { tapper } from '../support/selection-input.ts';
import { documentOf } from '../support/selection-scene.ts';
import { boxOf, dragFrom, filledBox, sceneWatcher } from '../support/transform-scene.ts';

// Each transform gesture is one undo step, made by one transaction (REQ-T11), that undo and redo
// cannot interrupt (REQ-H06); the selection around it comes back with it (REQ-S13).

const FIRST = testId(1);
const SECOND = testId(2);
const MOD_Z = keyEvent('key-down', 'z', 'KeyZ', { mod: true });
const ESCAPE = keyEvent('key-down', 'Escape', 'Escape');

const twoBoxes = () =>
  editorHarness(documentOf(filledBox(1, [100, 100, 100, 100]), filledBox(2, [300, 100, 100, 100])));

describe('undo steps of transform gestures', () => {
  it('REQ-T11 a move, a resize and a rotation are one undo step each', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    for (const path of [
      [150, 150, 190, 150],
      [240, 200, 260, 220],
      [200, 76, 300, 160],
    ]) {
      const { start, to, end } = dragFrom('mouse', path);
      harness.feed(...start, to, end);
    }
    expect(shown(FIRST)).toMatchObject({ x: 140, y: 100, width: 120, height: 120 });
    expect(shown(FIRST).rotation).toBeCloseTo(Math.PI / 2, 12);
    harness.editor.run('history.undo');
    expect(shown(FIRST)).toMatchObject({ x: 140, width: 120, rotation: 0 });
    harness.editor.run('history.undo');
    expect(boxOf(shown(FIRST))).toEqual([140, 100, 100, 100]);
    harness.editor.run('history.undo');
    expect([boxOf(shown(FIRST)), harness.editor.view.canUndo]).toEqual([
      [100, 100, 100, 100],
      false,
    ]);
  });

  it('REQ-H06 ignores Undo and Redo requested during a move drag', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    const first = dragFrom('mouse', [150, 150, 170, 150]);
    harness.feed(...first.start, first.to, first.end);
    harness.editor.run('history.undo');
    const second = dragFrom('mouse', [150, 150, 150, 190]);
    harness.feed(...second.start, second.to);
    expect([harness.editor.run('history.undo'), harness.editor.run('history.redo')]).toEqual([
      'disabled',
      'disabled',
    ]);
    expect(harness.editor.input(MOD_Z)).toBe(true);
    expect(boxOf(shown(FIRST))).toEqual([100, 140, 100, 100]);
    harness.feed(second.end);
    expect(harness.editor.view).toMatchObject({ canUndo: true, canRedo: false });
    harness.editor.run('history.undo');
    expect([boxOf(shown(FIRST)), harness.editor.view.canUndo]).toEqual([
      [100, 100, 100, 100],
      false,
    ]);
  });

  it('REQ-S13 a selection change after an edit is not undone: undo reverses the edit and restores the selection around it', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    const { start, to, end } = dragFrom('mouse', [150, 150, 180, 150]);
    harness.feed(...start, to, end);
    harness.feed(...tapper('mouse')(350, 150));
    expect(harness.editor.view.selection).toEqual([SECOND]);
    harness.editor.run('history.undo');
    expect([boxOf(shown(FIRST)), harness.editor.view.selection]).toEqual([
      [100, 100, 100, 100],
      [FIRST],
    ]);
    harness.editor.run('history.redo');
    expect([boxOf(shown(FIRST)), harness.editor.view.selection]).toEqual([
      [130, 100, 100, 100],
      [FIRST],
    ]);
  });
});

describe('transform gestures that end without an undo step', () => {
  it('Escape during a move reverts it, and the pointer then does nothing', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    const { start, to } = dragFrom('mouse', [150, 150, 200, 200]);
    harness.feed(...start, to);
    expect(boxOf(shown(FIRST))).toEqual([150, 150, 100, 100]);
    harness.feed(ESCAPE, move(260, 260, { time: 20_000 }), up(260, 260, { time: 20_000 }));
    expect([boxOf(shown(FIRST)), harness.editor.view]).toMatchObject([
      [100, 100, 100, 100],
      { selection: [FIRST], canUndo: false },
    ]);
  });

  it('choosing another tool during a resize reverts it', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    const { start, to, end } = dragFrom('mouse', [200, 200, 260, 260]);
    harness.feed(...start, to);
    harness.editor.run('tool.hand');
    harness.feed(end);
    expect([boxOf(shown(FIRST)), harness.editor.view.canUndo]).toEqual([
      [100, 100, 100, 100],
      false,
    ]);
  });

  it('REQ-T01 a wheel pan during a move keeps the moved element under the pointer at the next move', () => {
    const harness = twoBoxes();
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 150));
    const { start, to } = dragFrom('mouse', [150, 150, 170, 170]);
    harness.feed(...start, to);
    harness.editor.input(wheelEvent({ x: 170, y: 170 }, { x: 100, y: 0 }));
    harness.feed(move(170, 170, { time: 20_000 }));
    // The press's scene point (150, 150) is now shown at the pointer, which shows (270, 170).
    expect(boxOf(shown(FIRST))).toEqual([220, 120, 100, 100]);
  });
});
