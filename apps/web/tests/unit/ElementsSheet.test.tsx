import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { SHEET_QUERY } from '../../src/shell/sheet.ts';
import { surfaceHarness } from '../support/surface.tsx';

// The Elements drawer on a phone in portrait (ADR 0012, decision 14; the v0.2 plan's S5, issue
// #66's D5): a sheet, while open, makes the palette, which S8 makes the phone's dock, and the bottom
// islands inert, and Escape closes it with the focus on the toggle and goes no further. Elsewhere
// nothing is inert and Escape in the list reaches the editor, as in P0.

/** Answers the page's media queries as a viewport would: only the sheet's, and only on a phone. */
function viewport(phone: boolean): void {
  const answer = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: phone && query === SHEET_QUERY,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as Partial<MediaQueryList> as MediaQueryList,
  );
  onTestFinished(() => {
    answer.mockRestore();
  });
}

function mount(phone: boolean) {
  viewport(phone);
  const harness = surfaceHarness();
  harness.editor.resize({ width: 390, height: 844, pixelRatio: 1 });
  act(() => {
    harness.editor.run('tool.rectangle');
    harness.editor.run('canvas.enter');
  });
  render(<EditorShell surface={harness.surface} />);
  const toggle = screen.getByRole('button', { name: 'Elements' });
  act(() => {
    fireEvent.click(toggle);
  });
  const list = screen.getByRole('listbox', { name: 'Elements' });
  const escape = (): void => {
    act(() => {
      fireEvent.keyDown(list, { key: 'Escape', code: 'Escape' });
    });
  };
  return { ...harness, toggle, list, escape };
}

/** The islands whose controls are inert, by name. */
const inert = (): (string | undefined)[] =>
  [...document.querySelectorAll('[inert]')].map(
    (element) => element.closest<HTMLElement>('[data-island]')?.dataset['island'],
  );

describe('the Elements sheet', () => {
  it('D5 A8 makes the dock and the bottom-left and bottom-right groups inert while it is open on a phone', () => {
    const { toggle } = mount(true);
    expect(inert()).toEqual(['tools', 'bottom-left', 'bottom-right']);
    for (const name of ['Rectangle', 'Undo', 'Zoom in', 'Keyboard shortcuts']) {
      expect(screen.getByRole('button', { name, hidden: true }).closest('[inert]')).not.toBeNull();
    }
    expect(toggle.closest('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close Elements' }).closest('[inert]')).toBeNull();
    act(() => {
      fireEvent.click(toggle);
    });
    expect(inert()).toEqual([]);
  });

  it('D5 A8 closes on Escape on a phone, with the focus on the toggle, and the Escape goes no further', () => {
    const { editor, toggle, escape } = mount(true);
    const selected = editor.view.selection;
    expect(selected).toHaveLength(1);
    escape();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(editor.view.selection).toBe(selected);
  });

  it('D5 makes nothing inert elsewhere, where Escape in the list reaches the editor and the drawer stays', () => {
    const { editor, toggle, escape } = mount(false);
    expect(inert()).toEqual([]);
    escape();
    expect(editor.view.selection).toEqual([]);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
