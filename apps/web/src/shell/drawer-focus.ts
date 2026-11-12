import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { DRAWER_ID } from './ElementsDrawer.tsx';

/**
 * Moves the focus as the Elements drawer opens or closes (ADR 0012, decision 14; the v0.2 plan's
 * S5): to its list box once it opens, whichever control opened it, and to the toggle once it
 * closes, so that the focus never stays on a control that went with the drawer, unless the focus
 * stays where it is: the phone's Details sheet opened in its place and takes it (S6), or a text is
 * edited, whose text area keeps it as a phone's session closes the Elements sheet (S9). Nothing
 * moves at load, when the drawer is closed.
 */
export function useDrawerFocus(
  open: boolean,
  toggle: RefObject<HTMLButtonElement | null>,
  kept: boolean,
): void {
  const was = useRef(open);
  useEffect(() => {
    if (open === was.current) return;
    was.current = open;
    if (open) {
      document.getElementById(DRAWER_ID)?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
    } else if (!kept) toggle.current?.focus();
  }, [open, toggle, kept]);
}
