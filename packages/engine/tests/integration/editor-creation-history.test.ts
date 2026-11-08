import { describe, expect, it } from 'vitest';

import { KEYS, shownElements } from '../support/creation-input.ts';
import { editorHarness } from '../support/editors.ts';
import { POINTERS, tapper } from '../support/selection-input.ts';
import { dragFrom } from '../support/transform-scene.ts';

// Creations and the history through the editor (ENG-11): each creation is one undo step, Undo and
// Redo follow the history's availability, and undo never changes the tool.

describe.each(POINTERS)('creations and undo, with %s input', (pointer) => {
  it('REQ-C13 REQ-H01 each creation is one undo step: Mod+Z removes it and leaves nothing selected', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.rectangle);
    const { start, to, end } = dragFrom(pointer, [300, 180, 420, 280]);
    harness.feed(...start, to, end);
    expect(harness.editor.view.selection).toHaveLength(1);
    harness.feed(KEYS.undo);
    expect(shown()).toHaveLength(0);
    expect(harness.editor.view).toMatchObject({ selection: [], canUndo: false, canRedo: true });
  });

  it('REQ-H01 Mod+Shift+Z and Mod+Y redo it, with the new element selected again', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.ellipse, ...tapper(pointer)(400, 300));
    const [id] = harness.editor.view.selection;
    harness.feed(KEYS.undo, KEYS.redo);
    expect(shown().map((element) => element.id)).toEqual([id]);
    expect(harness.editor.view).toMatchObject({ selection: [id], canUndo: true, canRedo: false });
    harness.feed(KEYS.undo, KEYS.redoY);
    expect(shown()).toHaveLength(1);
    expect(harness.editor.view.selection).toEqual([id]);
  });

  it('REQ-H02 Undo enables with the first creation, Redo after an undo, and a new creation disables Redo', () => {
    const harness = editorHarness();
    const tap = tapper(pointer);
    const flags = () => [harness.editor.view.canUndo, harness.editor.view.canRedo];
    expect(flags()).toEqual([false, false]);
    harness.feed(KEYS.line, ...tap(200, 200));
    expect(flags()).toEqual([true, false]);
    harness.feed(KEYS.line, ...tap(200, 400));
    harness.feed(KEYS.undo);
    expect(flags()).toEqual([true, true]);
    harness.feed(KEYS.freehand, ...tap(500, 300));
    expect(flags()).toEqual([true, false]);
    harness.feed(KEYS.undo, KEYS.undo);
    expect(flags()).toEqual([false, true]);
  });

  it('REQ-H05 with tool lock on, undoing and redoing a creation leave the creation tool active', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.lock, KEYS.diamond, ...tapper(pointer)(300, 300));
    harness.feed(KEYS.undo);
    expect(shown()).toHaveLength(0);
    expect(harness.editor.view).toMatchObject({ tool: 'diamond', toolLock: true, selection: [] });
    harness.feed(KEYS.redo);
    expect(shown()).toHaveLength(1);
    expect(harness.editor.view).toMatchObject({ tool: 'diamond', selection: [] });
  });

  it('REQ-H05 without tool lock, undo leaves the Selection tool that the creation chose', () => {
    const harness = editorHarness();
    harness.feed(KEYS.rectangle, ...tapper(pointer)(300, 300), KEYS.undo);
    expect(harness.editor.view).toMatchObject({ tool: 'selection', selection: [] });
  });

  it('REQ-H06 Mod+Z during a creation drag is ignored, and the drag still commits one step', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.lock, KEYS.rectangle, ...tapper(pointer)(100, 100));
    const { start, to, end } = dragFrom(pointer, [300, 300, 400, 400]);
    harness.feed(...start, to, KEYS.undo, end);
    expect(shown()).toHaveLength(2);
    harness.feed(KEYS.undo);
    expect(shown()).toHaveLength(1);
  });

  it('tool lock is the editor’s state, not the document’s: toggling it is no undo step', () => {
    const harness = editorHarness();
    harness.feed(KEYS.lock);
    expect(harness.editor.view).toMatchObject({ toolLock: true, canUndo: false });
    harness.feed(KEYS.lock);
    expect(harness.editor.view.toolLock).toBe(false);
  });
});
