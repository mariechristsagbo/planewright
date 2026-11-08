import { describe, expect, it } from 'vitest';

import { KEYS } from '../support/creation-input.ts';
import { POINTERS } from '../support/selection-input.ts';
import { textAndBox, textHarness } from '../support/text-input.ts';

// Text sessions and the history through the editor (ENG-12): one session is one undo step, a
// double tap edits a text again, and an emptied text is deleted.

describe.each(POINTERS)('text sessions and undo, with %s input', (pointer) => {
  it('REQ-C10 a whole session is one undo step, and Undo and Redo wait for it to end', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'H', 'He', 'Hel');
    expect(harness.editor.run('history.undo')).toBe('disabled');
    harness.commit();
    const id = harness.editor.view.selection[0];
    expect(harness.editor.run('history.undo')).toBe('done');
    expect(harness.shown()).toEqual([]);
    expect(harness.editor.view).toMatchObject({ selection: [], canUndo: false, canRedo: true });
    harness.feed(KEYS.redo);
    expect(harness.shown().map(textAndBox)).toEqual([['Hel', [820, 407.5, 30, 25]]]);
    expect(harness.editor.view.selection).toEqual([id]);
  });

  it('REQ-C10 a double tap on a text edits it again, as one undo step that keeps it selected', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'Hello');
    harness.commit();
    const id = harness.editor.view.selection[0];
    harness.doubleTap(830, 420);
    expect(harness.editor.view).toMatchObject({ tool: 'selection', selection: [] });
    expect(harness.editor.view.text?.element.id).toBe(id);
    expect(harness.next().at(-1)?.scene?.hidden).toEqual([id]);
    harness.type('Hello world');
    expect(harness.editor.run('history.undo')).toBe('disabled');
    harness.commit();
    expect(harness.shown().map(textAndBox)).toEqual([['Hello world', [820, 407.5, 110, 25]]]);
    expect(harness.editor.view.selection).toEqual([id]);
    harness.feed(KEYS.undo);
    expect(harness.shown().map(textAndBox)).toEqual([['Hello', [820, 407.5, 50, 25]]]);
    expect(harness.editor.view).toMatchObject({ selection: [id], canUndo: true });
    harness.feed(KEYS.undo);
    expect(harness.shown()).toEqual([]);
  });

  it('REQ-C10 a text emptied by its session is deleted as one undo step', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'Hello');
    harness.commit();
    const id = harness.editor.view.selection[0];
    harness.doubleTap(830, 420);
    harness.type('');
    harness.commit();
    expect(harness.shown()).toEqual([]);
    expect(harness.editor.view).toMatchObject({ text: null, selection: [], tool: 'selection' });
    harness.feed(KEYS.undo);
    expect(harness.shown().map(textAndBox)).toEqual([['Hello', [820, 407.5, 50, 25]]]);
    expect(harness.editor.view.selection).toEqual([id]);
  });

  it('a session that changes nothing is no undo step', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'Hello');
    harness.commit();
    harness.doubleTap(830, 420);
    harness.type('Help');
    harness.type('Hello');
    harness.tap(400, 600);
    harness.feed(KEYS.undo);
    expect(harness.shown()).toEqual([]);
    expect(harness.editor.view.canUndo).toBe(false);
  });

  it('REQ-C05 with tool lock on, the Text tool stays after a commit and nothing is selected', () => {
    const harness = textHarness(pointer);
    harness.feed(KEYS.lock);
    harness.place(100, 100, 'one');
    harness.commit();
    expect(harness.editor.view).toMatchObject({ tool: 'text', selection: [], text: null });
    harness.tap(100, 300);
    harness.type('two');
    harness.tap(100, 500);
    expect(harness.editor.view.text?.box).toMatchObject({ x: 100, y: 487.5 });
    expect(harness.shown().map(textAndBox)).toEqual([
      ['one', [100, 87.5, 30, 25]],
      ['two', [100, 287.5, 30, 25]],
      ['', [100, 487.5, 0, 25]],
    ]);
  });
});

describe('text edits the session cannot take', () => {
  it('leaves a value past the 100,000-character limit, and an edit with no session, unapplied', () => {
    const harness = textHarness('mouse');
    harness.commit();
    harness.type('lost');
    expect(harness.editor.view.canUndo).toBe(false);
    harness.place(0, 0, 'kept');
    harness.type('x'.repeat(100_001));
    expect(harness.editor.view.text?.element.content.text).toBe('kept');
    harness.type('x'.repeat(100_000));
    expect(harness.editor.view.text?.box.width).toBe(1_000_000);
  });
});
