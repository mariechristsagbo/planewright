import type { SaveStatus } from '@planewright/engine';

// What the web app shows of saving (ADR 0012, decision 12; the v0.2 plan's S7), decided from the
// editor's view.save alone: nothing while saving works, and for the tests the status on the shell's
// root.

/** The shell root's data-save-state: the status's type, or none without storage. */
export type SaveState = SaveStatus['type'] | 'none';

/** The value of data-save-state for a status, which exists for the tests and is never styled. */
export const saveStateOf = (save: SaveStatus | null): SaveState => save?.type ?? 'none';
