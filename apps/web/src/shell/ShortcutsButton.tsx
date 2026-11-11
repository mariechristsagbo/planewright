import type { Ref } from 'react';

import { Icon } from './icons.tsx';

/**
 * The Keyboard shortcuts button at the bottom right (ADR 0012, decision 2), the last tab stop
 * (decision 14): it opens the Keyboard shortcuts dialog, and shows the keyboard glyph, which its
 * name and its tooltip say in words.
 */
export function ShortcutsButton({
  ref,
  onOpen,
}: {
  readonly ref: Ref<HTMLButtonElement>;
  readonly onOpen: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="glyph-button"
      aria-label="Keyboard shortcuts"
      aria-haspopup="dialog"
      data-chrome-tip="Keyboard shortcuts"
      onClick={onOpen}
    >
      <Icon name="keyboard" />
    </button>
  );
}
