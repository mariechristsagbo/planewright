import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import { useSurface } from '../editor/surface.ts';
import { useFocusLost } from '../ui/focus-lost.ts';
import { PaletteButton } from '../ui/PaletteButton.tsx';
import { itemsOf } from '../ui/tool-items.ts';
import type { ToolState } from '../ui/tool-items.ts';
import { Icon } from './icons.tsx';
import { MORE_BUTTON_ID, MORE_TOOLS_ID, moreCommands, moreFace } from './more-tools.ts';

// More, the last of the phone dock's stops (ADR 0012, decisions 2, 13 and 14; the v0.2 plan's S8):
// a button named More that shows its glyph, or the active tool's, pressed, while that tool is one
// of its own, and whose popover above the dock holds Hand, Diamond and Tool lock as the palette's
// buttons. A press, Enter or Space opens it with the focus on its first item; the arrow keys,
// wrapping, Home and End move through its items alone; other keys reach the editor's keymap
// through the tool bar. Pressing an item runs its command and closes it with the focus on More, as
// Escape does, which goes no further. The focus leaving it, a press outside it and the dock leaving
// the page close it too. Its items are mounted only while it is open, and its element stays, empty
// and hidden, for More to control.

/** More's state, from the shell's, and the ways to change it. */
export interface MoreControls {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}

/** The keys that move the focus through More's items, as steps or ends. */
const MOVES: Readonly<Partial<Record<string, number | 'first' | 'last'>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: 'first',
  End: 'last',
};

/** Moves the focus to the item that a key asks for, wrapping past either end. */
function move(group: HTMLElement, step: number | 'first' | 'last'): void {
  const items = [...group.querySelectorAll<HTMLElement>('button')];
  const at = items.findIndex((item) => item === group.ownerDocument.activeElement);
  const target = step === 'first' ? 0 : step === 'last' ? items.length - 1 : at + step;
  items[(target + items.length) % items.length]?.focus();
}

interface ItemsProps {
  readonly state: ToolState;
  readonly slot: RefObject<HTMLElement | null>;
  /** Closes More with the focus on its button, once an item has run. */
  readonly onDone: () => void;
  readonly onClose: () => void;
  readonly onLost: () => void;
}

/**
 * The open popover's items, the first focused as it opens, with one tab stop among them; a pointer
 * press outside More and its popover closes it, since a tap need not move the focus.
 */
function MoreItems({ state, slot, onDone, onClose, onLost }: ItemsProps) {
  const { editor, platform } = useSurface();
  const items = itemsOf(moreCommands(editor.commands), state);
  const [stop, setStop] = useState(0);
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  useEffect(() => {
    const press = (event: PointerEvent): void => {
      if (event.target instanceof Node && slot.current?.contains(event.target) === true) return;
      onClose();
    };
    document.addEventListener('pointerdown', press, true);
    return () => {
      document.removeEventListener('pointerdown', press, true);
    };
  }, [slot, onClose]);
  return items.map((item, index) => (
    <PaletteButton
      key={item.command.id}
      item={item}
      platform={platform}
      tabStop={index === stop}
      onRef={(button) => {
        if (index === 0) first.current = button;
      }}
      onFocus={() => {
        setStop(index);
      }}
      onPress={() => {
        editor.run(item.command.id);
        onDone();
      }}
      onLost={onLost}
    />
  ));
}

/**
 * More's popover: its element stays in the page, empty and hidden while More is closed, for More to
 * control; the arrow keys move through its items alone, and a press on it keeps the focus there.
 */
function MorePopover({ open, ...items }: ItemsProps & { readonly open: boolean }) {
  return (
    <div
      id={MORE_TOOLS_ID}
      role="group"
      aria-labelledby={MORE_BUTTON_ID}
      className="more-tools"
      hidden={!open}
      onKeyDown={(event) => {
        const step = MOVES[event.key];
        if (step === undefined) return;
        // The arrow keys move through the items alone, never the dock's tab stop.
        event.preventDefault();
        event.stopPropagation();
        move(event.currentTarget, step);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {open ? <MoreItems {...items} /> : null}
    </div>
  );
}

interface MoreToolsProps {
  readonly controls: MoreControls;
  readonly state: ToolState;
  readonly tabStop: boolean;
  readonly onRef: (button: HTMLButtonElement | null) => void;
  readonly onFocus: () => void;
  /** Called when More or an item leaves the page with the focus inside it. */
  readonly onLost: () => void;
}

/** More and its popover, in a box that adds nothing to the dock's layout. */
export function MoreTools({ controls, state, tabStop, onRef, onFocus, onLost }: MoreToolsProps) {
  const { open, onToggle, onClose } = controls;
  const button = useRef<HTMLButtonElement | null>(null);
  const slot = useRef<HTMLSpanElement>(null);
  useFocusLost(button, onLost);
  // The dock leaving the page, as when the window turns, closes More.
  useEffect(() => onClose, [onClose]);
  const done = (): void => {
    button.current?.focus();
    onClose();
  };
  const face = moreFace(state);
  return (
    <span
      ref={slot}
      className="more-slot"
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        if (!open || event.key !== 'Escape') return;
        // More closes, and the Escape goes no further, so that the selection and the tool stay.
        event.preventDefault();
        event.stopPropagation();
        done();
      }}
      onBlur={({ currentTarget, relatedTarget }) => {
        if (!open || currentTarget.contains(relatedTarget)) return;
        if (relatedTarget === null && !currentTarget.ownerDocument.hasFocus()) return;
        onClose();
      }}
    >
      <button
        ref={(element) => {
          button.current = element;
          onRef(element);
        }}
        id={MORE_BUTTON_ID}
        type="button"
        className="glyph-button"
        tabIndex={tabStop ? 0 : -1}
        aria-label="More"
        aria-pressed={face.pressed}
        aria-expanded={open}
        aria-controls={MORE_TOOLS_ID}
        data-chrome-tip="More"
        onClick={onToggle}
        onFocus={onFocus}
      >
        <Icon name={face.glyph} />
      </button>
      <MorePopover
        open={open}
        state={state}
        slot={slot}
        onDone={done}
        onClose={onClose}
        onLost={onLost}
      />
    </span>
  );
}
