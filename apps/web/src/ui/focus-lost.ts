import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Tells the tool bar when a control leaves the page with the focus inside it, as Tool lock does when
 * the palette becomes the phone's dock, or More's popover when an outside press closes it, so that
 * the tool bar gives the focus to its tab stop rather than to the body (REQ-Y02). The cleanup runs
 * while the control is still in the page; onLost keeps its identity for the control's life.
 */
export function useFocusLost(
  control: RefObject<HTMLElement | null>,
  onLost: (() => void) | undefined,
): void {
  useLayoutEffect(() => {
    const element = control.current;
    return () => {
      if (element?.contains(document.activeElement) === true) onLost?.();
    };
  }, [control, onLost]);
}
