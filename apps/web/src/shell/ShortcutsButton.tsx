import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

import { Icon } from './icons.tsx';
import { matchesSheet, useSheet } from './sheet.ts';

/**
 * The Keyboard shortcuts button at the bottom right (ADR 0012, decision 2), the last tab stop
 * (decision 14): it opens the Keyboard shortcuts dialog, and shows the keyboard glyph, which its
 * name and its tooltip say in words. A phone in portrait does not show its island (the v0.2 plan's
 * S8), so when a window that turns hides it with the focus on it, onHidden gives the focus to a
 * control that shows, never to the body (REQ-Y02). The browser either tells the phone's query
 * first, the button still focused, or applies the style first, which blurs the button towards no
 * other control while the query already matches; Chromium does either.
 */
export function ShortcutsButton({
  ref,
  onOpen,
  onHidden,
}: {
  readonly ref: RefObject<HTMLButtonElement | null>;
  readonly onOpen: () => void;
  readonly onHidden: () => void;
}) {
  const hidden = useSheet();
  useLayoutEffect(() => {
    if (hidden && ref.current !== null && ref.current === document.activeElement) onHidden();
  }, [ref, hidden, onHidden]);
  return (
    <button
      ref={ref}
      type="button"
      className="glyph-button"
      aria-label="Keyboard shortcuts"
      aria-haspopup="dialog"
      data-chrome-tip="Keyboard shortcuts"
      onClick={onOpen}
      onBlur={(event) => {
        if (event.relatedTarget === null && matchesSheet()) onHidden();
      }}
    >
      <Icon name="keyboard" />
    </button>
  );
}
