import { Fragment, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { useSurface } from '../../editor/surface.ts';
import type { Platform } from '../../platform/platform.ts';
import { ariaKeyShortcuts, shortcutText } from '../../ui/shortcuts.ts';
import { Icon } from '../icons.tsx';
import { MENU_BUTTON_ID, MENU_ID, menuItems } from './menu-items.ts';
import type { MenuAction, MenuItem } from './menu-items.ts';

// The identity island's menu (ADR 0012, decisions 2 and 14; REQ-Y03): a menu of menuitem items
// and one menuitemcheckbox, named by its button. It opens with the focus on its first item; the
// arrow keys, wrapping at the ends, Home and End move; Enter or a press runs an item; Escape
// closes it and gives the focus back to the button; the focus leaving it, as Tab or a press
// elsewhere takes it, closes it where the focus went; and the window losing the focus to another
// window closes it with the focus on the button, where it is when the window comes back.

/** The keys that move the focus through the items, as steps or ends. */
const MOVES: Readonly<Partial<Record<string, number | 'first' | 'last'>>> = {
  ArrowDown: 1,
  ArrowUp: -1,
  Home: 'first',
  End: 'last',
};

const ITEMS = '[role^="menuitem"]';

/** Moves the focus to the item that a key asks for, wrapping past either end. */
function move(menu: HTMLElement, step: number | 'first' | 'last'): void {
  const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)];
  const at = items.findIndex((item) => item === menu.ownerDocument.activeElement);
  const target = step === 'first' ? 0 : step === 'last' ? items.length - 1 : at + step;
  items[(target + items.length) % items.length]?.focus();
}

interface EntryProps {
  readonly item: MenuItem;
  readonly drawer: boolean;
  readonly platform: Platform;
}

/**
 * What an item shows: its glyph, its label, which names it, then its keys in JetBrains Mono, or
 * Show elements' check while the drawer is open, both hidden from assistive technology, since the
 * name, aria-keyshortcuts and aria-checked carry them.
 */
function EntryContent({ item, drawer, platform }: EntryProps) {
  const { action, label, glyph, chords } = item;
  return (
    <>
      <Icon name={glyph} />
      <span className="chrome-menu-label">{label}</span>
      {chords.length > 0 ? (
        <kbd className="chrome-menu-keys" aria-hidden="true">
          {shortcutText(chords, platform)}
        </kbd>
      ) : null}
      {action.kind === 'drawer' && drawer ? <Icon name="check" /> : null}
    </>
  );
}

/** One item: the repository's link, Show elements' checkbox, or a menuitem that runs its action. */
function Entry(props: EntryProps & { readonly onRun: (action: MenuAction) => void }) {
  const { item, drawer, platform, onRun } = props;
  const { action, chords } = item;
  const content = <EntryContent item={item} drawer={drawer} platform={platform} />;
  if (action.kind === 'link') {
    return (
      <a role="menuitem" tabIndex={-1} className="chrome-menu-item" href={action.href}>
        {content}
      </a>
    );
  }
  const checkbox = action.kind === 'drawer';
  return (
    <button
      type="button"
      role={checkbox ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkbox ? drawer : undefined}
      aria-keyshortcuts={chords.length > 0 ? ariaKeyShortcuts(chords, platform) : undefined}
      tabIndex={-1}
      className="chrome-menu-item"
      onClick={() => {
        onRun(action);
      }}
    >
      {content}
    </button>
  );
}

interface MainMenuProps {
  readonly drawer: boolean;
  readonly onRun: (action: MenuAction) => void;
  /** Closes the menu, giving the focus back to its button or leaving it where it went. */
  readonly onClose: (returnFocus: boolean) => void;
}

/**
 * Closes the menu on the window's own blur, giving the focus to the button, since the item that
 * holds it goes with the menu. That blur comes after the item's focusout, which the menu leaves to
 * it: a focusout to no element while the document has lost the focus.
 */
function useWindowBlur(onClose: MainMenuProps['onClose']): void {
  useEffect(() => {
    const blur = (): void => {
      onClose(true);
    };
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('blur', blur);
    };
  }, [onClose]);
}

/** The open menu, under its button; a press inside it keeps the focus on its items. */
export function MainMenu({ drawer, onRun, onClose }: MainMenuProps) {
  const { editor, platform } = useSurface();
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>(ITEMS)?.focus();
  }, []);
  useWindowBlur(onClose);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = MOVES[event.key];
    if (event.key !== 'Escape' && step === undefined) return;
    event.preventDefault();
    if (step === undefined) onClose(true);
    else move(event.currentTarget, step);
  };
  return (
    <div
      ref={menu}
      id={MENU_ID}
      role="menu"
      aria-labelledby={MENU_BUTTON_ID}
      className="chrome-menu"
      onKeyDown={onKeyDown}
      onBlur={({ currentTarget, relatedTarget }) => {
        if (currentTarget.contains(relatedTarget)) return;
        if (relatedTarget === null && !currentTarget.ownerDocument.hasFocus()) return;
        onClose(false);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {menuItems(editor.commands).map((item) => (
        <Fragment key={item.label}>
          {item.separated ? <div role="separator" className="chrome-menu-rule" /> : null}
          <Entry item={item} drawer={drawer} platform={platform} onRun={onRun} />
        </Fragment>
      ))}
    </div>
  );
}
