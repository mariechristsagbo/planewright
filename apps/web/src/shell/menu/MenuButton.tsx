import { useRef } from 'react';
import type { Ref } from 'react';

import { Icon } from '../icons.tsx';
import { MENU_BUTTON_ID, MENU_ID } from './menu-items.ts';

interface MenuButtonProps {
  readonly ref: Ref<HTMLButtonElement>;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

/**
 * The menu button (ADR 0012, decisions 2 and 14), the shell's first tab stop, which shows the menu
 * glyph and exposes whether its menu is open (REQ-Y01). A press, Enter, Space or ArrowDown opens
 * the menu, and a press while it is open closes it. A mouse press takes the focus out of an open
 * menu, which closes it, before its click, so the click remembers whether the menu was open when
 * the press began.
 */
export function MenuButton({ ref, open, onOpen, onClose }: MenuButtonProps) {
  const openAtPress = useRef(false);
  return (
    <button
      ref={ref}
      id={MENU_BUTTON_ID}
      type="button"
      className="glyph-button"
      aria-label="Planewright menu"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? MENU_ID : undefined}
      data-chrome-tip="Planewright menu"
      onPointerDown={() => {
        openAtPress.current = open;
      }}
      onClick={(event) => {
        const closing = open || (event.detail > 0 && openAtPress.current);
        openAtPress.current = false;
        if (closing) onClose();
        else onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' || open) return;
        event.preventDefault();
        onOpen();
      }}
    >
      <Icon name="menu" />
    </button>
  );
}
