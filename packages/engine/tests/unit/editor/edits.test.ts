import { describe, expect, it } from 'vitest';

import { createCore } from '../../../src/editor/editor-core.ts';
import { applyEdit } from '../../../src/editor/edits.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import { shapeElement, testId } from '../../support/elements.ts';
import {
  createCountingIds,
  createFixedAdvanceMeasurer,
  createManualClock,
  createQueueScheduler,
} from '../../support/fakes.ts';
import { documentOf } from '../../support/selection-scene.ts';

// A gesture's preview that the scene store refuses (the ENG-11 review's m1): the error reaches the
// caller, but the gesture's transaction is cancelled first, so the history is never left locked.

function core() {
  const clock = createManualClock();
  const ports = {
    clock,
    scheduler: createQueueScheduler(clock),
    ids: createCountingIds(),
    text: createFixedAdvanceMeasurer(),
  };
  return createCore(ports, documentOf(shapeElement('rectangle', 10, 10, { id: 1 })));
}

describe('a refused preview', () => {
  it('cancels the gesture transaction before its error is thrown', () => {
    const editor = core();
    const moved = {
      elements: [{ type: 'update', id: testId(1), before: { x: 0 }, after: { x: 5 } }],
      groups: [],
    } as const;
    applyEdit(editor, { type: 'preview', changes: moved });
    expect(editor.scene.get(testId(1))?.x).toBe(5);
    const refused = {
      elements: [{ type: 'update', id: testId(9), before: { x: 0 }, after: { x: 1 } }],
      groups: [],
    } as const;
    expect(() => {
      applyEdit(editor, { type: 'preview', changes: refused });
    }).toThrow(ChangeSetError);
    expect([editor.transaction, editor.history.inTransaction]).toEqual([null, false]);
    expect(editor.scene.get(testId(1))?.x).toBe(0);
    applyEdit(editor, { type: 'commit', label: 'move' });
    expect(editor.history.canUndo).toBe(false);
  });
});
