import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

import { useSurface, useViewValue } from '../editor/surface.ts';
import { useDrawerFocus } from './drawer-focus.ts';
import { matchesSheet, SHEET_QUERY } from './sheet.ts';
import type { ShellControls } from './shell-state.ts';

// The shell's part of a text session (the v0.2 plan's S9 and responsive rule 5).

/**
 * Closes the open Elements drawer when a phone in portrait edits a text, since its sheet would cover
 * the Done bar: when the drawer opens during such a session, as a tap that moves no focus opens it,
 * and when a session starts or a window turns to portrait during one while it is open. It listens
 * only while the drawer is open, and reads the current state once it listens, before the browser
 * paints the open sheet.
 */
function useNoSheetInSession(drawer: boolean, closeDrawer: () => void): void {
  const { editor } = useSurface();
  useLayoutEffect(() => {
    if (!drawer) return undefined;
    const close = (): void => {
      if (editor.view.text !== null && matchesSheet()) closeDrawer();
    };
    const media = window.matchMedia(SHEET_QUERY);
    media.addEventListener('change', close);
    const stop = editor.subscribe(close);
    close();
    return () => {
      stop();
      media.removeEventListener('change', close);
    };
  }, [drawer, editor, closeDrawer]);
}

/**
 * Whether a phone in portrait edits a text, while which the dock and history and zoom are hidden
 * and the Done bar shows. Whether a text is edited is read alone, so that neither a camera step nor
 * a typed value, which publish new views, renders the shell (ADR 0012, decision 14). The Elements
 * drawer moves the focus as it opens and closes, except that a closing, and an opening on a phone
 * in portrait, leave a session's focus in its text area, and no Elements sheet stays open over the
 * Done bar.
 */
export function useTextSession(
  shell: Pick<ShellControls, 'drawer' | 'details' | 'closeDrawer'>,
  toggle: RefObject<HTMLButtonElement | null>,
  sheet: boolean,
): boolean {
  const editing = useViewValue((view) => view.text !== null);
  useDrawerFocus(shell.drawer, toggle, shell.details || editing, sheet && editing);
  useNoSheetInSession(shell.drawer, shell.closeDrawer);
  return sheet && editing;
}
