import type { SaveStatus } from '@planewright/engine';

import { BUILD_STATUS } from '../foundation.ts';

// The empty-canvas note's words (ADR 0012, D5 and D7; AGENTS.md: the UI stays factual): the
// pre-release sentence that About this build holds while saving works, and that sentence without
// its saving clause while nothing is saved in this browser, without storage or after a failed or
// stale save, when the storage notices say why. The note never tells of a save itself.

/** The pre-release sentence without its saving clause; keep it in step with BUILD_STATUS. */
export const UNSAVED_NOTE =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them, but there are no files or collaboration yet.';

/** The note's words for a save status: the pre-release sentence only while saving works (D7). */
export const emptyCanvasNoteOf = (save: SaveStatus | null): string =>
  save?.type === 'saved' || save?.type === 'pending' ? BUILD_STATUS : UNSAVED_NOTE;
