import type { SaveStatus } from '@planewright/engine';

import type { StorageNotice } from '../platform/storage.ts';

// What the web app shows of saving (ADR 0012, decision 12; the v0.2 plan's S7), decided from the
// editor's view.save and the start-up notice: nothing while saving works, a chip and the notices
// while storage needs attention, and for the tests the status on the shell's root.

/** The shell root's data-save-state: the status's type, or none without storage. */
export type SaveState = SaveStatus['type'] | 'none';

/** The value of data-save-state for a status, which exists for the tests and is never styled. */
export const saveStateOf = (save: SaveStatus | null): SaveState => save?.type ?? 'none';

/** The problem chip's tone, glyph and words, from the table of the v0.2 plan's S7. */
export interface ProblemChip {
  readonly tone: 'error' | 'warning';
  readonly glyph: 'status-problem' | 'status-tabs';
  readonly words: 'Not saved' | 'Storage notice';
}

const FAILED_CHIP: ProblemChip = { tone: 'error', glyph: 'status-problem', words: 'Not saved' };
const STALE_CHIP: ProblemChip = { tone: 'warning', glyph: 'status-tabs', words: 'Not saved' };
const UNAVAILABLE_CHIP: ProblemChip = {
  tone: 'warning',
  glyph: 'status-problem',
  words: 'Not saved',
};
const NOTICE_CHIP: ProblemChip = {
  tone: 'warning',
  glyph: 'status-problem',
  words: 'Storage notice',
};

/**
 * The chip while storage needs attention, or null: "Not saved" for a failed save (the error tone
 * and the triangle), a stale one (the warning tone and the two tabs) and no storage (the warning
 * tone and the triangle), whatever start-up notice comes with them; and "Storage notice" for the
 * unreadable-data notice alone once it is hidden, while saving works.
 */
export function problemChipOf(
  save: SaveStatus | null,
  storageNotice: StorageNotice | null,
  hidden: boolean,
): ProblemChip | null {
  switch (save?.type) {
    case 'failed':
      return FAILED_CHIP;
    case 'stale':
      return STALE_CHIP;
    case undefined:
      return UNAVAILABLE_CHIP;
    case 'saved':
    case 'pending':
      return storageNotice !== null && hidden ? NOTICE_CHIP : null;
  }
}

/** Whether any storage notice applies: a start-up notice, a failed save or a stale one. */
export const hasNotices = (save: SaveStatus | null, storageNotice: StorageNotice | null): boolean =>
  storageNotice !== null || save?.type === 'failed' || save?.type === 'stale';
