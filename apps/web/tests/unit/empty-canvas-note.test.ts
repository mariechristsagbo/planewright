import type { SaveStatus } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { BUILD_STATUS } from '../../src/foundation.ts';
import { UNSAVED_NOTE, emptyCanvasNoteOf } from '../../src/shell/empty-canvas-note.ts';

// The empty-canvas note's words (ADR 0012, D5 and D7; issue #86): the pre-release sentence that
// About this build holds while saving works, as D7 has it, and that sentence without its saving
// clause while nothing is saved in this browser, without storage, after a failed save or a stale
// one, when the storage notices say why. Nothing in the note says that a save happened.

describe('the empty-canvas note’s words', () => {
  it.each([[{ type: 'saved' }], [{ type: 'pending' }]] satisfies [SaveStatus][])(
    'repeat the pre-release sentence while saving works, for %j',
    (save) => {
      expect(emptyCanvasNoteOf(save)).toBe(BUILD_STATUS);
    },
  );

  it.each([
    [null],
    [{ type: 'failed', reason: 'quota' }],
    [{ type: 'failed', reason: 'unavailable' }],
    [{ type: 'failed', reason: 'failed' }],
    [{ type: 'stale' }],
  ] satisfies [SaveStatus | null][])(
    'leave out that the drawing is saved in this browser while nothing is, for %j',
    (save) => {
      expect(emptyCanvasNoteOf(save)).toBe(UNSAVED_NOTE);
    },
  );

  it('are the pre-release sentence without its saving clause, with no other word about saving', () => {
    expect(UNSAVED_NOTE).toBe(
      'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them, but there are no files or collaboration yet.',
    );
    expect(BUILD_STATUS.replace('; the drawing is saved in this browser, but', ', but')).toBe(
      UNSAVED_NOTE,
    );
    expect(UNSAVED_NOTE).not.toMatch(/sav(e|ed|ing)\b|browser|stor(e|ed|age)\b/iu);
  });
});
