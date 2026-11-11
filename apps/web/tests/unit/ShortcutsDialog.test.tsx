import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Platform } from '../../src/platform/platform.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { shortcutText } from '../../src/ui/shortcuts.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The Keyboard shortcuts dialog (ADR 0012, decisions 2 and 13; the v0.2 plan's S4): the
// bottom-right button opens it, and it lists every command of the registry with its keys, as
// shortcutText() writes them, in the modal dialog that About this build uses.

function mount(platform: Platform = 'other') {
  const harness = surfaceHarness(platform);
  render(<EditorShell surface={harness.surface} />);
  const opener = screen.getByRole('button', { name: 'Keyboard shortcuts' });
  return { ...harness, opener };
}

/** Opens the dialog through a press on its opener, and gives it. */
function open(opener: HTMLElement): HTMLElement {
  act(() => {
    fireEvent.click(opener);
  });
  return screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
}

/** Each row's command and keys, as the dialog shows them. */
const rowsOf = (scope: HTMLElement): string[][] =>
  within(scope)
    .getAllByRole('row')
    .map((row) => [
      within(row).getByRole('rowheader').textContent,
      within(row).getByRole('cell').textContent,
    ]);

describe('the Keyboard shortcuts dialog', () => {
  it('A5 lists every registry command once with its shortcutText(), as many rows as the registry has', () => {
    for (const platform of ['other', 'apple'] as const) {
      const { editor, opener } = mount(platform);
      const rows = rowsOf(open(opener));
      const expected = editor.commands.map(({ label, shortcuts }) => [
        label,
        shortcutText(shortcuts, platform),
      ]);
      expect(rows).toHaveLength(editor.commands.length);
      expect(rows).toEqual(expect.arrayContaining(expected));
      expect(new Set(rows.map(([label]) => label)).size).toBe(editor.commands.length);
      expect(rows).toContainEqual(['Undo', platform === 'apple' ? 'Cmd+Z' : 'Ctrl+Z']);
      expect(rows).toContainEqual(['Cancel, clear selection', 'Esc']);
      cleanup();
    }
  });

  it('A5 groups the commands by area in tables named by their headings, each in registry order', () => {
    const { editor, opener } = mount();
    const dialog = open(opener);
    const areas = [
      ['Tools', 'tool.'],
      ['History', 'history.'],
      ['Selection', 'selection.'],
      ['View', 'view.'],
      ['Canvas', 'canvas.'],
    ] as const;
    expect(within(dialog).getAllByRole('table')).toEqual(
      areas.map(([name]) => within(dialog).getByRole('table', { name })),
    );
    for (const [name, area] of areas) {
      const labels = editor.commands
        .filter(({ id }) => id.startsWith(area))
        .map(({ label }) => label);
      expect(rowsOf(within(dialog).getByRole('table', { name })).map(([label]) => label)).toEqual(
        labels,
      );
    }
  });

  it('D3 shows each chord of a command in a key of its own, joined by “or”', () => {
    const { opener } = mount();
    const dialog = open(opener);
    const redo = within(dialog).getByRole('row', { name: /^Redo/u });
    const keys = within(redo).getByRole('cell');
    expect([...keys.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual([
      'Ctrl+Shift+Z',
      'Ctrl+Y',
    ]);
    expect(keys).toHaveTextContent('Ctrl+Shift+Z or Ctrl+Y');
  });

  it('D3 A6 opens from the bottom-right button as a modal dialog with the focus on Close, and gives the focus back to the button', () => {
    const { opener } = mount();
    expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
    expect(opener.closest('[data-island]')).toHaveAttribute('data-island', 'bottom-right');
    expect(opener.querySelector('svg[data-glyph]')).toHaveAttribute('data-glyph', 'keyboard');
    expect(screen.queryByRole('dialog')).toBeNull();
    const dialog = open(opener);
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    act(() => {
      fireEvent.click(close);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
