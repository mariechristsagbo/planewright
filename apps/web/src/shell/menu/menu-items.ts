import type { CommandId, EditorCommand, KeyChord } from '@planewright/engine';

import { REPOSITORY_URL } from '../../foundation.ts';
import type { IconName } from '../glyphs.ts';

// The identity island's menu items (ADR 0012, decision 1; the v0.2 plan's S4): every one runs an
// existing command through the registry or an existing path of the shell, and none is new
// behaviour. Their order and the separators between their groups are the menu's.

/** The menu's identifier, which its button controls, and the button's, which names the menu. */
export const MENU_ID = 'chrome-menu';
export const MENU_BUTTON_ID = 'chrome-menu-button';

/** What an item does: a registry command, the drawer, a dialog, or the repository's page. */
export type MenuAction =
  | { readonly kind: 'command'; readonly id: CommandId }
  | { readonly kind: 'drawer' }
  | { readonly kind: 'dialog'; readonly dialog: 'shortcuts' | 'about' }
  | { readonly kind: 'link'; readonly href: string };

export interface MenuItem {
  readonly action: MenuAction;
  readonly label: string;
  readonly glyph: IconName;
  /** The registry's keys for a command, none for the others. */
  readonly chords: readonly KeyChord[];
  /** Whether a separator comes before it. */
  readonly separated: boolean;
}

/** The items in order, with each one's glyph and, for those that are not commands, its words. */
const ENTRIES: readonly (readonly [MenuAction, IconName, string, boolean])[] = [
  [{ kind: 'command', id: 'selection.select-all' }, 'select-all', '', false],
  [{ kind: 'command', id: 'view.zoom-to-fit' }, 'zoom-fit', '', false],
  [{ kind: 'command', id: 'view.zoom-reset' }, 'zoom-reset', '', false],
  [{ kind: 'drawer' }, 'elements', 'Show elements', true],
  [{ kind: 'dialog', dialog: 'shortcuts' }, 'keyboard', 'Keyboard shortcuts', false],
  [{ kind: 'dialog', dialog: 'about' }, 'info', 'About this build', false],
  [{ kind: 'link', href: REPOSITORY_URL }, 'external-link', 'Source on GitHub', true],
];

/**
 * The menu's items: a command takes its label and keys from the registry (REQ-C14), and one that
 * the registry lacks is left out rather than invented.
 */
export const menuItems = (commands: readonly EditorCommand[]): MenuItem[] =>
  ENTRIES.flatMap(([action, glyph, words, separated]): MenuItem[] => {
    if (action.kind !== 'command') return [{ action, label: words, glyph, chords: [], separated }];
    const command = commands.find(({ id }) => id === action.id);
    if (command === undefined) return [];
    const { label, shortcuts } = command;
    return [{ action, label, glyph, chords: shortcuts, separated }];
  });
