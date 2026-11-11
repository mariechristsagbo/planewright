import type { SaveFailure } from '@planewright/engine';

import type { StorageNotice } from '../platform/storage.ts';

// The words of the storage notices (docs/architecture/engine/persistence.md#autosave), which the
// notices under the top-right island show and the live region says (REQ-P05, REQ-P06, REQ-P07,
// REQ-Y04).

const FAILURES: Readonly<Record<SaveFailure, string>> = {
  quota: 'the browser’s storage for this page is full',
  unavailable: 'the browser’s storage cannot be reached',
  failed: 'the browser’s storage did not take the change',
};

export const failedText = (reason: SaveFailure): string =>
  `Saving failed: ${FAILURES[reason]}. Your changes are kept in this tab, and saving is tried again.`;

export const STALE_TEXT =
  'Another tab saved a newer version of this drawing, so this tab stopped saving. Load the newer version, which drops this tab’s unsaved changes and its undo history, or keep this version, which replaces the other one.';

export const STORAGE_NOTICE_TEXTS: Readonly<Record<StorageNotice, string>> = {
  unavailable:
    'Saving is unavailable in this browser: the drawing stays in this tab only and is lost when the tab closes.',
  invalid:
    'The drawing saved in this browser could not be read, so a new drawing was opened. The saved data is left unchanged.',
};

/** Whether a value names a save failure. */
export const isSaveFailure = (value: unknown): value is SaveFailure =>
  typeof value === 'string' && Object.hasOwn(FAILURES, value);
