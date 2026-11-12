import { useViewValue } from '../editor/surface.ts';

// The shell's part of a text session (the v0.2 plan's S9 and responsive rule 5).

/**
 * Whether a phone in portrait edits a text, while which the dock and history and zoom are hidden.
 * Whether a text is edited is read alone, so that neither a camera step nor a typed value, which
 * publish new views, renders the shell (ADR 0012, decision 14).
 */
export function useTextSession(sheet: boolean): boolean {
  const editing = useViewValue((view) => view.text !== null);
  return sheet && editing;
}
