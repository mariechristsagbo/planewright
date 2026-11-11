import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Platform } from '../../src/platform/platform.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The identity island's menu (ADR 0012, decisions 2, 10 and 14; the v0.2 plan's S4): the menu
// button, the first control of the island, opens a menu of menuitem items and one
// menuitemcheckbox, which run the registry's commands or the shell's existing paths. The arrow
// keys, Home and End move through it; Enter runs an item and closes it; Escape closes it and gives
// the focus back to the button. Tab and the browser's focus are checked end to end.

const ITEMS = [
  'Select all',
  'Zoom to fit',
  'Reset zoom',
  'Show elements',
  'Keyboard shortcuts',
  'About this build',
  'Source on GitHub',
];

function mount(platform: Platform = 'other') {
  const harness = surfaceHarness(platform);
  render(<EditorShell surface={harness.surface} />);
  return { ...harness, button: screen.getByRole('button', { name: 'Planewright menu' }) };
}

/** Opens the menu with a press on its button, and gives the menu. */
function openMenu(button: HTMLElement): HTMLElement {
  act(() => {
    fireEvent.click(button);
  });
  return screen.getByRole('menu', { name: 'Planewright menu' });
}

/** The menu's items in order, whichever of their two roles they have. */
const itemsOf = (menu: HTMLElement): HTMLElement[] => [
  ...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
];

/** The one item with an accessible name, a menuitem or the menuitemcheckbox. */
function item(menu: HTMLElement, name: string): HTMLElement {
  const [found, ...others] = ['menuitem', 'menuitemcheckbox'].flatMap((role) =>
    within(menu).queryAllByRole(role, { name }),
  );
  if (found === undefined || others.length > 0) throw new Error(`No one item is named ${name}.`);
  return found;
}

const press = (target: HTMLElement, key: string): void => {
  act(() => {
    fireEvent.keyDown(target, { key });
  });
};

const click = (target: HTMLElement): void => {
  act(() => {
    fireEvent.click(target);
  });
};

describe('the identity island’s menu', () => {
  it('D1 is opened by a named menu button, the identity island’s first control, before Pre-release', () => {
    const { button } = mount();
    const identity = button.closest<HTMLElement>('[data-island]');
    if (identity === null) throw new Error('The menu button is in no island.');
    expect(identity).toHaveAttribute('data-island', 'identity');
    expect(within(identity).getAllByRole('button')).toEqual([
      button,
      screen.getByRole('button', { name: 'Pre-release' }),
    ]);
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    expect(button.querySelector('svg[data-glyph]')).toHaveAttribute('data-glyph', 'menu');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('D2 A2 opens on a press with the focus on its first item, holding its items in order, and the button controls it', () => {
    const { button } = mount();
    const menu = openMenu(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', menu.id);
    expect(itemsOf(menu)).toEqual(ITEMS.map((name) => item(menu, name)));
    expect(itemsOf(menu).map((each) => each.getAttribute('role'))).toEqual([
      'menuitem',
      'menuitem',
      'menuitem',
      'menuitemcheckbox',
      'menuitem',
      'menuitem',
      'menuitem',
    ]);
    expect(itemsOf(menu).map((each) => each.tabIndex)).toEqual(ITEMS.map(() => -1));
    expect(within(menu).getAllByRole('separator')).toHaveLength(2);
    expect(item(menu, 'Select all')).toHaveFocus();
  });

  it('A2 opens on ArrowDown with the focus on its first item', () => {
    const { button } = mount();
    act(() => {
      button.focus();
    });
    press(button, 'ArrowDown');
    expect(item(screen.getByRole('menu'), 'Select all')).toHaveFocus();
  });

  it('A2 moves with ArrowDown and ArrowUp, wrapping at the ends, and with Home and End', () => {
    const { button } = mount();
    const menu = openMenu(button);
    const focused = (): string | undefined =>
      ITEMS.find((name) => item(menu, name) === document.activeElement);
    const seen = ['ArrowDown', 'ArrowDown', 'End', 'ArrowDown', 'ArrowUp', 'Home', 'ArrowUp'].map(
      (key) => {
        press(menu, key);
        return focused();
      },
    );
    expect(seen).toEqual([
      'Zoom to fit',
      'Reset zoom',
      'Source on GitHub',
      'Select all',
      'Source on GitHub',
      'Select all',
      'Source on GitHub',
    ]);
  });

  it('A2 closes on Escape and gives the focus back to the button', () => {
    const { button } = mount();
    const menu = openMenu(button);
    press(menu, 'ArrowDown');
    press(menu, 'Escape');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('A2 closes, without taking the focus back, when the focus leaves it, and on a second press of its button', () => {
    const { button } = mount();
    openMenu(button);
    const tag = screen.getByRole('button', { name: 'Pre-release' });
    act(() => {
      tag.focus();
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(tag).toHaveFocus();
    openMenu(button);
    click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('A3 runs Select all, Zoom to fit and Reset zoom through the registry, closing and giving the focus back to the button', () => {
    const { editor, button } = mount();
    const run = vi.spyOn(editor, 'run');
    for (const name of ['Select all', 'Zoom to fit', 'Reset zoom']) {
      click(item(openMenu(button), name));
      expect(screen.queryByRole('menu')).toBeNull();
      expect(button).toHaveFocus();
    }
    expect(run.mock.calls).toEqual([
      ['selection.select-all'],
      ['view.zoom-to-fit'],
      ['view.zoom-reset'],
    ]);
  });

  it('A3 makes Show elements a menuitemcheckbox whose checked state follows the drawer, both ways', () => {
    const { button } = mount();
    const toggle = screen.getByRole('button', { name: /^Elements/u });
    const check = (): string | null | undefined =>
      item(screen.getByRole('menu'), 'Show elements')
        .querySelector('svg[data-glyph="check"]')
        ?.getAttribute('aria-hidden');
    expect(item(openMenu(button), 'Show elements')).toHaveAttribute('aria-checked', 'false');
    expect(check()).toBeUndefined();
    click(item(screen.getByRole('menu'), 'Show elements'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Elements' })).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(item(openMenu(button), 'Show elements')).toHaveAttribute('aria-checked', 'true');
    // A check shows the state to the eye; it is hidden, so the name stays "Show elements".
    expect(check()).toBe('true');
    press(screen.getByRole('menu'), 'Escape');
    click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(item(openMenu(button), 'Show elements')).toHaveAttribute('aria-checked', 'false');
    expect(item(screen.getByRole('menu'), 'Show elements')).toHaveAccessibleName('Show elements');
  });

  it('A4 shows a shortcut only where the registry has one, hidden, its name and aria-keyshortcuts carrying it', () => {
    for (const [platform, keys, chords] of [
      ['other', ['Ctrl+A', 'Shift+1', 'Ctrl+0'], ['Control+A', 'Shift+1', 'Control+0']],
      ['apple', ['Cmd+A', 'Shift+1', 'Cmd+0'], ['Meta+A', 'Shift+1', 'Meta+0']],
    ] as const) {
      const { button } = mount(platform);
      const menu = openMenu(button);
      const shown = itemsOf(menu).map((each) => {
        const key = each.querySelector('kbd');
        if (key !== null) expect(key).toHaveAttribute('aria-hidden', 'true');
        return [each.getAttribute('aria-keyshortcuts'), key?.textContent ?? null];
      });
      expect(shown).toEqual([
        [chords[0], keys[0]],
        [chords[1], keys[1]],
        [chords[2], keys[2]],
        [null, null],
        [null, null],
        [null, null],
        [null, null],
      ]);
      for (const [index, name] of ITEMS.entries()) {
        expect(itemsOf(menu)[index]).toHaveAccessibleName(name);
      }
      cleanup();
    }
  });

  it('D3 D4 A6 A7 opens Keyboard shortcuts and About this build, the same About as the tag’s, and closing gives the focus to the menu button', () => {
    const { button } = mount();
    const tag = screen.getByRole('button', { name: 'Pre-release' });
    click(tag);
    const fromTag = screen.getByRole('dialog', { name: 'About this build' }).outerHTML;
    click(screen.getByRole('button', { name: 'Close' }));
    expect(tag).toHaveFocus();
    for (const [name, title] of [
      ['Keyboard shortcuts', 'Keyboard shortcuts'],
      ['About this build', 'About this build'],
    ] as const) {
      click(item(openMenu(button), name));
      expect(screen.queryByRole('menu')).toBeNull();
      const dialog = screen.getByRole('dialog', { name: title });
      if (name === 'About this build') expect(dialog.outerHTML).toBe(fromTag);
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
      click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveFocus();
    }
  });

  it('D2 links Source on GitHub to the repository, as About does', () => {
    const { button } = mount();
    const link = item(openMenu(button), 'Source on GitHub');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://github.com/mariechristsagbo/planewright');
  });
});
